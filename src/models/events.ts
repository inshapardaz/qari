/**
 * Event models for the Universal Ebook Reader.
 */

import type { BookMetadata } from './book';
import type { Bookmark } from './bookmark';

export interface PageChangeEvent {
  chapter: number;
  page: number;
  progress: number; // 0-100
}

export interface BookmarkEvent {
  type: 'created' | 'renamed' | 'deleted';
  bookmark: Bookmark;
}

export interface BookLoadedEvent {
  book: BookMetadata;
  chapterCount: number;
  direction: 'ltr' | 'rtl';
}

export interface ReaderError {
  code: string;
  message: string;
  source?: string; // input source name
  format?: string; // detected format
  httpStatus?: number; // for URL errors
}
