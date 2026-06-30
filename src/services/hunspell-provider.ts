/**
 * Hunspell-based local/offline dictionary provider.
 * Uses nspell to provide spell checking and word suggestions
 * from Hunspell-compatible .dic/.aff files.
 */

import NSpell from 'nspell';
import { DictionaryProvider, DictionaryResult } from '../interfaces/dictionary';

/**
 * Configuration for creating a HunspellProvider instance.
 * Provide either buffer data (aff + dic) for immediate initialization,
 * or URLs (affUrl + dicUrl) for async loading.
 */
export interface HunspellProviderConfig {
  /** ISO 639-1 language code this dictionary supports */
  language: string;
  /** Pre-loaded .aff file content */
  aff?: Buffer | ArrayBuffer | Uint8Array;
  /** Pre-loaded .dic file content */
  dic?: Buffer | ArrayBuffer | Uint8Array;
  /** URL to fetch the .aff file from */
  affUrl?: string;
  /** URL to fetch the .dic file from */
  dicUrl?: string;
}

/** Alias for HunspellProviderConfig — used as the Reader prop type */
export type HunspellDictionaryConfig = HunspellProviderConfig;

/** Maximum number of suggestions to return for misspelled words */
const MAX_SUGGESTIONS = 10;

export class HunspellProvider implements DictionaryProvider {
  readonly id = 'hunspell-local';
  readonly supportedLanguages: string[];
  readonly category: 'local' = 'local';
  ready: boolean;

  private speller: NSpell | null = null;
  private initPromise: Promise<void> | null = null;
  private cachedAff: Buffer | string | null = null;
  private cachedDic: Buffer | string | null = null;

  constructor(private config: HunspellProviderConfig) {
    this.supportedLanguages = [config.language];

    if (config.aff && config.dic) {
      // Buffer data provided — initialize immediately
      this.initFromBuffers(config.aff, config.dic);
      this.ready = true;
    } else if (config.affUrl && config.dicUrl) {
      // URLs provided — fetch asynchronously
      this.ready = false;
      this.initPromise = this.initFromUrls(config.affUrl, config.dicUrl);
    } else {
      throw new Error(
        'HunspellProvider requires either aff/dic buffers or affUrl/dicUrl strings'
      );
    }
  }

  /**
   * Initialize from pre-loaded buffer data.
   * Converts ArrayBuffer/Uint8Array to Buffer for nspell compatibility.
   */
  private initFromBuffers(
    aff: Buffer | ArrayBuffer | Uint8Array,
    dic: Buffer | ArrayBuffer | Uint8Array
  ): void {
    try {
      const affBuffer = this.toBufferOrString(aff);
      const dicBuffer = this.toBufferOrString(dic);

      this.cachedAff = affBuffer;
      this.cachedDic = dicBuffer;
      this.speller = new NSpell(affBuffer, dicBuffer);
    } catch (error) {
      throw new Error(
        `HunspellProvider initialization failed: invalid or corrupt dictionary data - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Fetch .aff and .dic files from URLs and initialize the speller.
   */
  private async initFromUrls(affUrl: string, dicUrl: string): Promise<void> {
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch(affUrl),
        fetch(dicUrl),
      ]);

      if (!affResponse.ok) {
        throw new Error(
          `Failed to fetch .aff file from ${affUrl}: ${affResponse.status} ${affResponse.statusText}`
        );
      }
      if (!dicResponse.ok) {
        throw new Error(
          `Failed to fetch .dic file from ${dicUrl}: ${dicResponse.status} ${dicResponse.statusText}`
        );
      }

      const affText = await affResponse.text();
      const dicText = await dicResponse.text();

      this.cachedAff = affText;
      this.cachedDic = dicText;

      try {
        this.speller = new NSpell(affText, dicText);
      } catch (error) {
        throw new Error(
          `HunspellProvider initialization failed: invalid or corrupt dictionary data - ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      this.ready = true;
    } catch (error) {
      this.ready = false;
      throw error instanceof Error
        ? error
        : new Error(`HunspellProvider failed to load dictionary files: ${String(error)}`);
    }
  }

  /**
   * Wait for async initialization to complete (for URL-based loading).
   * Returns the init promise if loading is in progress, otherwise resolves immediately.
   */
  waitForReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.initPromise) return this.initPromise;
    return Promise.resolve();
  }

  /**
   * Convert ArrayBuffer or Uint8Array to a format nspell accepts (Buffer or string).
   * In browser environments, we decode to string since Buffer may not be available.
   */
  private toBufferOrString(data: Buffer | ArrayBuffer | Uint8Array): Buffer | string {
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return new TextDecoder().decode(data);
    }
    if (data instanceof Uint8Array) {
      return new TextDecoder().decode(data);
    }
    return data as Buffer | string;
  }

  /**
   * Look up a word using the nspell spell checker.
   * Returns a DictionaryResult with spell-check information.
   */
  async lookup(
    word: string,
    language: string,
    context: string,
    signal?: AbortSignal
  ): Promise<DictionaryResult> {
    // Check if the request has been cancelled
    if (signal?.aborted) {
      return {
        word,
        language,
        definitions: [{ meaning: 'Lookup was cancelled.' }],
        notFound: true,
      };
    }

    // If not ready yet, return a not-ready result
    if (!this.ready || !this.speller) {
      return {
        word,
        language,
        definitions: [{ meaning: 'Dictionary is still loading.' }],
        notFound: true,
      };
    }

    try {
      const isCorrect = this.speller.correct(word);

      if (isCorrect) {
        return {
          word,
          language,
          definitions: [],
          notFound: false,
          spellCheck: {
            correct: true,
            suggestions: [],
          },
        };
      } else {
        const allSuggestions = this.speller.suggest(word);
        const suggestions = allSuggestions.slice(0, MAX_SUGGESTIONS);

        return {
          word,
          language,
          definitions: [],
          notFound: false,
          spellCheck: {
            correct: false,
            suggestions,
          },
        };
      }
    } catch (error) {
      // nspell can throw for extremely long input or other edge cases
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
