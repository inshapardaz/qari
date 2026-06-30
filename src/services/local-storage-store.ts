/**
 * LocalStorageStore - Default bookmark persistence implementation.
 * Stores bookmarks in separate localStorage keys per book.
 * Key format: `${keyPrefix}bookmarks-${bookId}`
 * Implements BookmarkStoreInterface with graceful error recovery.
 */

import { Bookmark } from '../models/bookmark';
import { BookmarkStoreInterface } from '../interfaces/bookmark-store';

const MAX_BOOKMARKS_PER_BOOK = 50;

export class LocalStorageStore implements BookmarkStoreInterface {
  private readonly keyPrefix: string;

  constructor(keyPrefix: string = 'qari-') {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Returns the localStorage key for a specific book's bookmarks.
   * Format: `${keyPrefix}bookmarks-${bookId}`
   */
  private bookKey(bookId: string): string {
    return `${this.keyPrefix}bookmarks-${bookId}`;
  }

  /**
   * Returns the localStorage key that stores the index of all book IDs.
   */
  private get indexKey(): string {
    return `${this.keyPrefix}bookmarks-index`;
  }

  /**
   * Read bookmarks for a specific book from localStorage.
   * Returns empty array if JSON is corrupted or key doesn't exist.
   */
  private readBook(bookId: string): Bookmark[] {
    try {
      const raw = localStorage.getItem(this.bookKey(bookId));
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Bookmark[];
    } catch {
      // Corrupted JSON → treat as empty collection
      return [];
    }
  }

  /**
   * Write bookmarks for a specific book to localStorage.
   * Rejects if localStorage is unavailable or quota is exceeded.
   */
  private writeBook(bookId: string, bookmarks: Bookmark[]): void {
    try {
      localStorage.setItem(this.bookKey(bookId), JSON.stringify(bookmarks));
      this.addToIndex(bookId);
    } catch (error: unknown) {
      if (error instanceof DOMException) {
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          throw new Error('localStorage quota exceeded');
        }
        if (error.name === 'SecurityError') {
          throw new Error('localStorage is unavailable');
        }
      }
      throw new Error('localStorage is unavailable');
    }
  }

  /**
   * Track which book IDs have bookmark entries.
   */
  private addToIndex(bookId: string): void {
    const ids = this.getBookIds();
    if (!ids.includes(bookId)) {
      ids.push(bookId);
      try {
        localStorage.setItem(this.indexKey, JSON.stringify(ids));
      } catch {
        // Non-critical — list() may miss some books
      }
    }
  }

  /**
   * Get all tracked book IDs from the index.
   */
  private getBookIds(): string[] {
    try {
      const raw = localStorage.getItem(this.indexKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as string[];
    } catch {
      return [];
    }
  }

  /**
   * Save a bookmark to the store.
   * Enforces 50 bookmarks per book limit.
   * Rejects on quota exceeded or localStorage unavailability.
   */
  async save(bookmark: Bookmark): Promise<void> {
    let bookBookmarks: Bookmark[];
    try {
      bookBookmarks = this.readBook(bookmark.bookId);
    } catch {
      return Promise.reject(new Error('localStorage is unavailable'));
    }

    // Enforce per-book limit
    if (bookBookmarks.length >= MAX_BOOKMARKS_PER_BOOK) {
      return Promise.reject(new Error('per-book limit reached'));
    }

    bookBookmarks.push(bookmark);

    try {
      this.writeBook(bookmark.bookId, bookBookmarks);
    } catch (error: unknown) {
      return Promise.reject(error instanceof Error ? error : new Error('localStorage is unavailable'));
    }
  }

  /**
   * Load bookmarks for a specific book.
   * Returns empty array for corrupted JSON.
   */
  async load(bookId: string): Promise<Bookmark[]> {
    return this.readBook(bookId);
  }

  /**
   * List all bookmarks across all books.
   * Returns empty array for corrupted JSON.
   */
  async list(): Promise<Bookmark[]> {
    const bookIds = this.getBookIds();
    const all: Bookmark[] = [];
    for (const bookId of bookIds) {
      all.push(...this.readBook(bookId));
    }
    return all;
  }

  /**
   * Remove a bookmark by id.
   * Rejects with "bookmark not found" if the id doesn't exist.
   */
  async remove(bookmarkId: string): Promise<void> {
    // Search across all books for the bookmark
    const bookIds = this.getBookIds();
    for (const bookId of bookIds) {
      let bookBookmarks: Bookmark[];
      try {
        bookBookmarks = this.readBook(bookId);
      } catch {
        continue;
      }

      const index = bookBookmarks.findIndex((b) => b.id === bookmarkId);
      if (index !== -1) {
        bookBookmarks.splice(index, 1);
        try {
          this.writeBook(bookId, bookBookmarks);
        } catch (error: unknown) {
          return Promise.reject(error instanceof Error ? error : new Error('localStorage is unavailable'));
        }
        return;
      }
    }

    return Promise.reject(new Error('bookmark not found'));
  }

  /**
   * Update an existing bookmark.
   * Replaces the matching bookmark and sets updatedAt.
   * Rejects if the bookmark id is not found.
   */
  async update(bookmark: Bookmark): Promise<void> {
    // Search across all books for the bookmark
    const bookIds = this.getBookIds();
    for (const bookId of bookIds) {
      let bookBookmarks: Bookmark[];
      try {
        bookBookmarks = this.readBook(bookId);
      } catch {
        continue;
      }

      const index = bookBookmarks.findIndex((b) => b.id === bookmark.id);
      if (index !== -1) {
        bookBookmarks[index] = {
          ...bookmark,
          updatedAt: new Date().toISOString(),
        };
        try {
          this.writeBook(bookId, bookBookmarks);
        } catch (error: unknown) {
          return Promise.reject(error instanceof Error ? error : new Error('localStorage is unavailable'));
        }
        return;
      }
    }

    return Promise.reject(new Error('bookmark not found'));
  }
}
