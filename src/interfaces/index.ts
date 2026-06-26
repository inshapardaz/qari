/**
 * Service interfaces for the Universal Ebook Reader.
 */

export type { EPUBParser, MarkdownParser, PrettyPrinter } from './parser';
export type { DictionaryProvider, DictionaryResult, Definition } from './dictionary';
export type { CustomStoreAdapter } from './store-adapter';
export type {
  ThemeEngine,
  ThemeName,
  FontFamily,
  ReadingPreferences,
  ThemeColors,
} from './theme-engine';
export type { DirectionDetector, DirectionResult } from './direction-detector';
