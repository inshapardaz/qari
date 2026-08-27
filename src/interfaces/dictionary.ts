/**
 * Dictionary interfaces for the Universal Ebook Reader.
 * Defines the plugin interface for language-aware dictionary lookups.
 */

export interface DictionaryProvider {
  /** Unique identifier for this provider */
  id: string;
  /** Human-readable display name shown as this provider's source label in results (e.g. "Oxford Concise"). Falls back to `id` when not set. */
  name?: string;
  /** Languages this provider supports (ISO 639-1 codes) */
  supportedLanguages: string[];
  /** Provider category for priority routing */
  category?: 'local' | 'online';
  /** Whether the provider is ready to handle lookups */
  ready?: boolean;
  /** Look up a word with context */
  lookup(word: string, language: string, context: string, signal?: AbortSignal): Promise<DictionaryResult>;
}

export interface SpellCheckResult {
  /** Whether the word is correctly spelled */
  correct: boolean;
  /** Suggested corrections for misspelled words */
  suggestions: string[];
}

export interface DictionaryResult {
  word: string;
  language: string;
  definitions: Definition[];
  notFound?: boolean;
  /** Spell-check result from local providers */
  spellCheck?: SpellCheckResult;
}

export interface Definition {
  meaning: string;
  partOfSpeech?: string;
  examples?: string[];
  /** Display name of the dictionary this definition came from (e.g. "Oxford Concise"). Auto-filled from the provider's `name`/`id` by DictionaryService when a provider doesn't set it itself. */
  source?: string;
}
