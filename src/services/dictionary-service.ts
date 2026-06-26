/**
 * Dictionary Service for the Universal Ebook Reader.
 * Manages dictionary providers and routes lookups to the appropriate provider
 * based on book language.
 */

import { DictionaryProvider, DictionaryResult } from '../interfaces/dictionary';

/**
 * Extended DictionaryResult that includes a fallbackLanguage field
 * when no provider is available for the requested language.
 */
export interface DictionaryLookupResult extends DictionaryResult {
  fallbackLanguage?: string;
}

export class DictionaryService {
  private providers: DictionaryProvider[] = [];
  private defaultLanguage: string | null = null;

  /**
   * Register a dictionary provider. Providers are tried in registration order
   * when multiple match the same language.
   */
  registerProvider(provider: DictionaryProvider): void {
    this.providers.push(provider);
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
    // Find a provider that supports the requested language
    const provider = this.providers.find((p) =>
      p.supportedLanguages.includes(language)
    );

    if (!provider) {
      // No provider for this language - check if we can offer a fallback
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
        const fallbackProvider = this.providers.find((p) =>
          p.supportedLanguages.includes(this.defaultLanguage!)
        );
        if (fallbackProvider) {
          result.fallbackLanguage = this.defaultLanguage;
        }
      }

      return result;
    }

    // Extract context around the selected word
    const context = this.extractContext(text, wordPosition, word.length);

    try {
      const result = await provider.lookup(word, language, context);
      return result;
    } catch {
      // Provider threw an error - return a not-found result with message
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
}
