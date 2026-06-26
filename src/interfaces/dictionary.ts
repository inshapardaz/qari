/**
 * Dictionary interfaces for the Universal Ebook Reader.
 * Defines the plugin interface for language-aware dictionary lookups.
 */

export interface DictionaryProvider {
  /** Unique identifier for this provider */
  id: string;
  /** Languages this provider supports (ISO 639-1 codes) */
  supportedLanguages: string[];
  /** Look up a word with context */
  lookup(word: string, language: string, context: string): Promise<DictionaryResult>;
}

export interface DictionaryResult {
  word: string;
  language: string;
  definitions: Definition[];
  notFound?: boolean;
}

export interface Definition {
  meaning: string;
  partOfSpeech?: string;
  examples?: string[];
}
