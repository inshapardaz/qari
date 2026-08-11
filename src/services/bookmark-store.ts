/**
 * Bookmark Store for the Universal Ebook Reader.
 * Provides CRUD operations for bookmarks with localStorage default
 * and optional custom adapter delegation with timeout fallback.
 */

import Sqids from 'sqids';
import { Bookmark } from '../models/bookmark';
import { CustomStoreAdapter } from '../interfaces/store-adapter';

const STORAGE_KEY = 'ebook-reader-bookmarks';
const ADAPTER_TIMEOUT_MS = 5000;
const MAX_BOOKMARKS_PER_BOOK = 50;
const MAX_NAME_LENGTH = 100;

export interface BookmarkStoreNotification {
  type: 'warning' | 'error';
  message: string;
}

const sqids = new Sqids();

/**
 * Generates a short, unique-enough id by Sqids-encoding two random 32-bit
 * integers (~64 bits of entropy — far more than needed to avoid collisions
 * within a single book's bookmark list). Uses crypto.getRandomValues() for
 * its higher-quality randomness where available, falling back to
 * Math.random() otherwise.
 */
function generateId(): string {
  const randomInt = (): number => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 0xffffffff);
  };
  return sqids.encode([randomInt(), randomInt()]);
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve/reject within
 * the specified time, the returned promise rejects with a timeout error.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Validates a bookmark name. Must be 1-100 characters.
 * Throws an error with a descriptive message if invalid.
 */
function validateName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error('Bookmark name must not be empty. Allowed length: 1-100 characters.');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(
      `Bookmark name must not exceed ${MAX_NAME_LENGTH} characters. Provided: ${name.length} characters.`
    );
  }
}

export class BookmarkStore {
  private adapter?: CustomStoreAdapter;
  private notifications: BookmarkStoreNotification[] = [];

  constructor(adapter?: CustomStoreAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get and clear pending notifications (e.g., fallback warnings).
   */
  getNotifications(): BookmarkStoreNotification[] {
    const pending = [...this.notifications];
    this.notifications = [];
    return pending;
  }

  /**
   * Create a new bookmark for a given book, chapter, and position.
   */
  async create(
    bookId: string,
    chapterId: string,
    position: number,
    name: string
  ): Promise<Bookmark> {
    validateName(name);

    // Check per-book limit
    const existingBookmarks = await this.load(bookId);
    if (existingBookmarks.length >= MAX_BOOKMARKS_PER_BOOK) {
      throw new Error(
        `Cannot create bookmark: maximum of ${MAX_BOOKMARKS_PER_BOOK} bookmarks per book has been reached.`
      );
    }

    const bookmark: Bookmark = {
      id: generateId(),
      bookId,
      chapterId,
      position,
      name,
      createdAt: new Date().toISOString(),
    };

    if (this.adapter) {
      try {
        await withTimeout(this.adapter.save(bookmark), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({
          type: 'warning',
          message: 'Bookmark sync failed. Saved locally.',
        });
        this.saveToLocalStorage(bookmark);
      }
    } else {
      this.saveToLocalStorage(bookmark);
    }

    return bookmark;
  }

  /**
   * Rename an existing bookmark.
   */
  async rename(bookmarkId: string, newName: string): Promise<Bookmark> {
    validateName(newName);

    const allBookmarks = await this.list();
    const bookmark = allBookmarks.find((b) => b.id === bookmarkId);

    if (!bookmark) {
      throw new Error(`Bookmark with id "${bookmarkId}" not found.`);
    }

    const updatedBookmark: Bookmark = {
      ...bookmark,
      name: newName,
      updatedAt: new Date().toISOString(),
    };

    if (this.adapter) {
      try {
        await withTimeout(this.adapter.save(updatedBookmark), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({
          type: 'warning',
          message: 'Bookmark sync failed. Saved locally.',
        });
        this.updateInLocalStorage(updatedBookmark);
      }
    } else {
      this.updateInLocalStorage(updatedBookmark);
    }

    return updatedBookmark;
  }

  /**
   * Delete a bookmark by ID.
   */
  async delete(bookmarkId: string): Promise<void> {
    if (this.adapter) {
      try {
        await withTimeout(this.adapter.remove(bookmarkId), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({
          type: 'warning',
          message: 'Bookmark sync failed. Removed locally.',
        });
        this.removeFromLocalStorage(bookmarkId);
      }
    } else {
      this.removeFromLocalStorage(bookmarkId);
    }
  }

  /**
   * List all bookmarks.
   */
  async list(): Promise<Bookmark[]> {
    if (this.adapter) {
      try {
        return await withTimeout(this.adapter.list(), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({
          type: 'warning',
          message: 'Bookmark sync failed. Loading from local storage.',
        });
        return this.getAllFromLocalStorage();
      }
    }
    return this.getAllFromLocalStorage();
  }

  /**
   * Load bookmarks for a specific book.
   */
  async load(bookId: string): Promise<Bookmark[]> {
    if (this.adapter) {
      try {
        return await withTimeout(this.adapter.load(bookId), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({
          type: 'warning',
          message: 'Bookmark sync failed. Loading from local storage.',
        });
        return this.getFromLocalStorageByBookId(bookId);
      }
    }
    return this.getFromLocalStorageByBookId(bookId);
  }

  // --- localStorage helpers ---

  private getAllFromLocalStorage(): Bookmark[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Bookmark[];
    } catch {
      return [];
    }
  }

  private getFromLocalStorageByBookId(bookId: string): Bookmark[] {
    return this.getAllFromLocalStorage().filter((b) => b.bookId === bookId);
  }

  private saveToLocalStorage(bookmark: Bookmark): void {
    const all = this.getAllFromLocalStorage();
    all.push(bookmark);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  private updateInLocalStorage(updatedBookmark: Bookmark): void {
    const all = this.getAllFromLocalStorage();
    const index = all.findIndex((b) => b.id === updatedBookmark.id);
    if (index !== -1) {
      all[index] = updatedBookmark;
    } else {
      all.push(updatedBookmark);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  private removeFromLocalStorage(bookmarkId: string): void {
    const all = this.getAllFromLocalStorage();
    const filtered = all.filter((b) => b.id !== bookmarkId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
}
