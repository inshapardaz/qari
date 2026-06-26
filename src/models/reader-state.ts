/**
 * Reader state model for the Universal Ebook Reader.
 */

import type { Book } from './book';
import type { Bookmark } from './bookmark';
import type { ReaderError } from './events';

export interface ReadingPreferences {
  theme: ThemeName;
  fontFamily: FontFamily;
  fontSize: number; // 12-48
}

export type ThemeName = 'light' | 'dark' | 'sepia' | 'high-contrast';
export type FontFamily = 'serif' | 'sans-serif' | 'monospace' | 'nastaliq';

export interface ReaderState {
  book: Book | null;
  currentChapter: number;
  currentPage: number;
  totalPages: number; // within current chapter
  readingProgress: number; // 0-100, percentage of total book
  zoom: number; // 50-300
  direction: 'ltr' | 'rtl';
  directionConfidence: 'high' | 'low';
  preferences: ReadingPreferences;
  bookmarks: Bookmark[];
  error: ReaderError | null;
  loading: boolean;
}
