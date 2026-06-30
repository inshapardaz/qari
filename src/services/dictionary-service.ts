/**
 * Dictionary Service for the Universal Ebook Reader.
 * Manages dictionary providers and routes lookups to the appropriate provider
 * based on book language. Implements local-first routing: local providers are
 * queried before online providers for faster offline lookups.
 */

import { DictionaryProvider, DictionaryResult } from '../interfaces/dictionary';

/**
 * Extended DictionaryResult that includes a fallbackLanguage field
 * when no provider is available for the requested language.
 */
export interface DictionaryLookupResult extends DictionaryResult {
  fallbackLanguage?: string;
}

/** Internal provider entry with category metadata */
interface ProviderEntry {
  provider: DictionaryProvider;
  category: 'local' | 'online';
}

export class DictionaryService {
  private providerEntries: ProviderEntry[] = [];
  private defaultLanguage: string | null = null;
  private currentAbortController: AbortController | null = null;

  /**
   * Register a dictionary provider. Providers are tried in registration order
   * when multiple match the same language. Local providers are queried before
   * online providers for the same language.
   *
   * @param provider - The dictionary provider to register
   * @param category - Optional category override ('local' or 'online'). Defaults to the provider's own category field, or 'online' if not specified.
   */
  registerProvider(provider: DictionaryProvider, category?: 'local' | 'online'): void {
    const resolvedCategory = category ?? provider.category ?? 'online';
    this.providerEntries.push({ provider, category: resolvedCategory });
  }

  /**
   * Check if a provider is ready to handle lookups.
   * Returns true if the provider exists and its `ready` field is not explicitly false.
   */
  isProviderReady(providerId: string): boolean {
    const entry = this.providerEntries.find((e) => e.provider.id === providerId);
    if (!entry) {
      return false;
    }
    // If ready is undefined (not set), treat as ready (backward compat)
    return entry.provider.ready !== false;
  }

  /**
   * Cancel any in-progress dictionary lookup. The cancelled request's
   * AbortError will be silently ignored.
   */
  cancelCurrentLookup(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Set the default/fallback language code. When no provider matches the
   * requested language, this language is offered as a fallback.
   */
  setDefaultLanguage(language: string): void {
    this.defaultLanguage = language;
  }

  /**
   * Extract context around a word at a given position in the text.
   * Returns up to 200 characters before and after the word, bounded
   * by text start/end.
   */
  extractContext(text: string, wordPosition: number, wordLength: number): string {
    const contextBefore = Math.max(0, wordPosition - 200);
    const contextAfter = Math.min(text.length, wordPosition + wordLength + 200);
    return text.slice(contextBefore, contextAfter);
  }

  /**
   * Look up a word in the dictionary appropriate for the given language.
   * Uses local-first routing: local providers are queried first, and their
   * results may be merged with online provider results.
   *
   * @param word - The word to look up
   * @param language - The book's language (ISO 639-1 code)
   * @param text - The full text body containing the word
   * @param wordPosition - The character offset of the word within the text
   * @returns A DictionaryLookupResult with definitions or error information
   */
  async lookup(
    word: string,
    language: string,
    text: string,
    wordPosition: number
  ): Promise<DictionaryLookupResult> {
    // Cancel any in-progress lookup before starting a new one
    this.cancelCurrentLookup();

    // Create a new AbortController for this request
    const abortController = new AbortController();
    this.currentAbortController = abortController;
    const { signal } = abortController;

    const context = this.extractContext(text, wordPosition, word.length);

    // Find local providers that support the language and are ready
    const localEntries = this.providerEntries.filter(
      (e) =>
        e.category === 'local' &&
        e.provider.supportedLanguages.includes(language) &&
        e.provider.ready !== false
    );

    // Find online providers that support the language
    const onlineEntries = this.providerEntries.filter(
      (e) =>
        e.category === 'online' &&
        e.provider.supportedLanguages.includes(language)
    );

    // Local-first routing
    if (localEntries.length > 0) {
      // Query local provider (first matching)
      const localProvider = localEntries[0].provider;
      try {
        const localResult = await localProvider.lookup(word, language, context, signal);

        // If local provider returned a misspelled result, return immediately
        if (localResult.spellCheck && !localResult.spellCheck.correct) {
          return localResult;
        }

        // If local provider says word is correct but has no meaningful definition,
        // merge with online provider
        if (localResult.spellCheck && localResult.spellCheck.correct) {
          // Check if the result has real definitions (not just spell-check confirmations)
          const hasSemanticDefinitions = localResult.definitions.some(
            (d) => d.meaning && !d.meaning.includes('correctly spelled')
          );

          if (!hasSemanticDefinitions && onlineEntries.length > 0) {
            // Query online provider and merge
            const onlineProvider = onlineEntries[0].provider;
            try {
              const onlineResult = await onlineProvider.lookup(word, language, context, signal);
              // Merge: take online definitions, add spellCheck from local
              return {
                ...onlineResult,
                spellCheck: localResult.spellCheck,
              };
            } catch (error: unknown) {
              // Silently return empty result for AbortError (expected cancellation)
              if (error instanceof Error && error.name === 'AbortError') {
                return { word, language, definitions: [] };
              }
              // Online failed, return local result as-is
              return localResult;
            }
          }

          // Has real definitions from local or no online fallback
          return localResult;
        }

        // Local result without spellCheck — return it
        return localResult;
      } catch (error: unknown) {
        // Silently return empty result for AbortError (expected cancellation)
        if (error instanceof Error && error.name === 'AbortError') {
          return { word, language, definitions: [] };
        }
        // Local provider threw — fall through to online
      }
    }

    // No local provider for this language, or local provider failed — query online
    if (onlineEntries.length > 0) {
      const onlineProvider = onlineEntries[0].provider;
      try {
        const result = await onlineProvider.lookup(word, language, context, signal);
        return result;
      } catch (error: unknown) {
        // Silently return empty result for AbortError (expected cancellation)
        if (error instanceof Error && error.name === 'AbortError') {
          return { word, language, definitions: [] };
        }
        return {
          word,
          language,
          definitions: [
            {
              meaning: 'Dictionary lookup failed. Please try again.',
            },
          ],
          notFound: true,
        };
      }
    }

    // No provider for this language at all — check all providers for fallback
    const anyProvider = this.providerEntries.find((e) =>
      e.provider.supportedLanguages.includes(language)
    );

    if (!anyProvider) {
      const result: DictionaryLookupResult = {
        word,
        language,
        definitions: [
          {
            meaning: `No dictionary available for ${language}`,
          },
        ],
        notFound: true,
      };

      // If a default language is set and a provider exists for it, offer fallback
      if (this.defaultLanguage && this.defaultLanguage !== language) {
        const fallbackProvider = this.providerEntries.find((e) =>
          e.provider.supportedLanguages.includes(this.defaultLanguage!)
        );
        if (fallbackProvider) {
          result.fallbackLanguage = this.defaultLanguage;
        }
      }

      return result;
    }

    // This case handles providers that exist but are not ready (e.g., local provider loading)
    // Fall through to online which was already attempted above, so return not found
    const result: DictionaryLookupResult = {
      word,
      language,
      definitions: [
        {
          meaning: `No dictionary available for ${language}`,
        },
      ],
      notFound: true,
    };

    if (this.defaultLanguage && this.defaultLanguage !== language) {
      const fallbackProvider = this.providerEntries.find((e) =>
        e.provider.supportedLanguages.includes(this.defaultLanguage!)
      );
      if (fallbackProvider) {
        result.fallbackLanguage = this.defaultLanguage;
      }
    }

    return result;
  }
}
