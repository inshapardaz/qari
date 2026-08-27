/**
 * FreeDictionaryProvider - Built-in online dictionary provider using the Free Dictionary API.
 * Supports English lookups via https://api.dictionaryapi.dev/api/v2/entries/{language}/{word}
 */

import { DictionaryProvider, DictionaryResult, Definition } from '../interfaces/dictionary';

/**
 * Response shape from the Free Dictionary API.
 */
interface FreeDictionaryApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string; audio?: string }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
}

export class FreeDictionaryProvider implements DictionaryProvider {
  readonly id = 'free-dictionary-api';
  readonly name = 'Free Dictionary';
  readonly supportedLanguages = ['en'];
  readonly category: 'online' = 'online';
  readonly ready = true;

  private readonly timeout: number;

  constructor(config?: { timeout?: number }) {
    this.timeout = config?.timeout ?? 5000;
  }

  /**
   * Look up a word using the Free Dictionary API.
   *
   * @param word - The word to look up
   * @param language - The language code (e.g., "en")
   * @param _context - Surrounding text context (unused by this provider)
   * @param signal - Optional external AbortSignal for cancellation
   * @returns DictionaryResult with definitions, or notFound if 404
   * @throws Error on network failure or timeout
   */
  async lookup(
    word: string,
    language: string,
    _context: string,
    signal?: AbortSignal
  ): Promise<DictionaryResult> {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/${language}/${word}`;

    // Create an internal AbortController for timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), this.timeout);

    // Combine external signal with internal timeout signal
    const combinedSignal = signal
      ? this.combineSignals(signal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const response = await fetch(url, { signal: combinedSignal });

      if (response.status === 404) {
        return {
          word,
          language,
          definitions: [],
          notFound: true,
        };
      }

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data: FreeDictionaryApiEntry[] = await response.json();
      return this.mapResponse(data, word, language);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // If the external signal was aborted, re-throw as AbortError
        if (signal?.aborted) {
          throw error;
        }
        // Internal timeout - throw a timeout error
        throw new Error(`Dictionary lookup timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Map the Free Dictionary API response to our DictionaryResult format.
   */
  private mapResponse(
    entries: FreeDictionaryApiEntry[],
    word: string,
    language: string
  ): DictionaryResult {
    const definitions: Definition[] = [];

    for (const entry of entries) {
      for (const meaning of entry.meanings) {
        for (const def of meaning.definitions) {
          const definition: Definition = {
            meaning: def.definition,
            partOfSpeech: meaning.partOfSpeech,
          };

          if (def.example) {
            definition.examples = [def.example];
          }

          definitions.push(definition);
        }
      }
    }

    return {
      word,
      language,
      definitions,
      notFound: definitions.length === 0,
    };
  }

  /**
   * Combine multiple AbortSignals into one.
   * The combined signal aborts when any of the input signals abort.
   */
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }
      signal.addEventListener('abort', () => controller.abort(signal.reason), {
        once: true,
      });
    }

    return controller.signal;
  }
}
