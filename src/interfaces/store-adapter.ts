/**
 * Custom Store Adapter interface for the Universal Ebook Reader.
 * Defines the contract for server-side bookmark persistence.
 */

import { Bookmark } from '../models/bookmark';

export interface CustomStoreAdapter {
  save(bookmark: Bookmark): Promise<void>;
  load(bookId: string): Promise<Bookmark[]>;
  list(): Promise<Bookmark[]>;
  remove(bookmarkId: string): Promise<void>;
}
