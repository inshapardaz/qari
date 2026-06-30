/**
 * Wiktionary REST API Dictionary Provider.
 * Fetches definitions from the Wikimedia REST API for multiple languages.
 */

import { DictionaryProvider, DictionaryResult, Definition } from '../interfaces/dictionary';
import { stripHtmlTags } from '../utils/strip-html';

/**
 * Configuration for the WiktionaryProvider.
 */
export interface WiktionaryProviderConfig {
  /** ISO 639-1 language codes this provider supports */
  languages: string[];
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Shape of the Wiktionary REST API response.
 * The response is keyed by language code, each containing an array of entries.
 */
interface WiktionaryApiEntry {
  partOfSpeech: string;
  language: string;
  definitions: Array<{
    definition: string;
    parsedExamples?: Array<{ example: string }>;
    examples?: string[];
  }>;
}

interface WiktionaryApiResponse {
  [languageCode: string]: WiktionaryApiEntry[];
}

/**
 * Constructs the Wiktionary REST API URL for a given language and word.
 */
export function buildWiktionaryUrl(language: string, word: string): string {
  const encodedWord = encodeURIComponent(word);
  return `https://${language}.wiktionary.org/api/rest_v1/page/definition/${encodedWord}`;
}

/**
 * Maps a Wiktionary API response to an array of Definition objects.
 * Strips HTML tags from definition text and extracts examples.
 */
export function mapWiktionaryResponse(response: WiktionaryApiResponse): Definition[] {
  const definitions: Definition[] = [];

  for (const languageCode of Object.keys(response)) {
    const entries = response[languageCode];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (!entry.definitions || !Array.isArray(entry.definitions)) continue;

      for (const def of entry.definitions) {
        const meaning = stripHtmlTags(def.definition || '');
        if (!meaning) continue;

        const examples: string[] = [];

        // Extract from parsedExamples
        if (def.parsedExamples && Array.isArray(def.parsedExamples)) {
          for (const ex of def.parsedExamples) {
            if (ex.example) {
              examples.push(stripHtmlTags(ex.example));
            }
          }
        }

        // Extract from examples array
        if (def.examples && Array.isArray(def.examples)) {
          for (const ex of def.examples) {
            if (ex) {
              examples.push(stripHtmlTags(ex));
            }
          }
        }

        const definition: Definition = {
          meaning,
          partOfSpeech: entry.partOfSpeech || undefined,
        };

        if (examples.length > 0) {
          definition.examples = examples;
        }

        definitions.push(definition);
      }
    }
  }

  return definitions;
}

/**
 * WiktionaryProvider fetches word definitions from the Wiktionary REST API.
 * Supports multiple languages configured at construction time.
 */
export class WiktionaryProvider implements DictionaryProvider {
  readonly id = 'wiktionary-rest';
  readonly supportedLanguages: string[];
  readonly category: 'online' = 'online';

  private readonly timeout: number;

  constructor(config: WiktionaryProviderConfig) {
    this.supportedLanguages = config.languages;
    this.timeout = config.timeout ?? 5000;
  }

  /**
   * Look up a word using the Wiktionary REST API.
   *
   * @param word - The word to look up
   * @param language - ISO 639-1 language code
   * @param context - Surrounding text context (unused by this provider)
   * @param signal - Optional external AbortSignal for cancellation
   * @returns DictionaryResult with definitions or notFound status
   */
  async lookup(
    word: string,
    language: string,
    context: string,
    signal?: AbortSignal
  ): Promise<DictionaryResult> {
    const url = buildWiktionaryUrl(language, word);

    // Create an internal AbortController for timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), this.timeout);

    // If an external signal is provided, abort internal controller when external aborts
    const onExternalAbort = () => timeoutController.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      signal.addEventListener('abort', onExternalAbort);
    }

    try {
      const response = await fetch(url, { signal: timeoutController.signal });

      if (response.status === 404) {
        return {
          word,
          language,
          definitions: [],
          notFound: true,
        };
      }

      if (!response.ok) {
        throw new Error(`Wiktionary API error: ${response.status} ${response.statusText}`);
      }

      const data: WiktionaryApiResponse = await response.json();
      const definitions = mapWiktionaryResponse(data);

      if (definitions.length === 0) {
        return {
          word,
          language,
          definitions: [],
          notFound: true,
        };
      }

      return {
        word,
        language,
        definitions,
      };
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Re-throw abort errors (either timeout or external cancellation)
        throw error;
      }
      // Network or other errors
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }
}
