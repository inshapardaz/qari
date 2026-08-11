/**
 * Progress Store for the Universal Ebook Reader.
 * Persists a single reading-progress record per book, with localStorage
 * default and optional custom adapter delegation with timeout fallback.
 * Mirrors `note-store.ts`'s shape.
 */

import { ReadingProgressRecord } from '../models/progress';
import { CustomProgressStoreAdapter } from '../interfaces/progress-store';
import { LocalStorageProgressStore } from './local-storage-progress-store';

const ADAPTER_TIMEOUT_MS = 5000;

export interface ProgressStoreNotification {
  type: 'warning' | 'error';
  message: string;
}

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

export class ProgressStore {
  private adapter?: CustomProgressStoreAdapter;
  private readonly fallback = new LocalStorageProgressStore();
  private notifications: ProgressStoreNotification[] = [];

  constructor(adapter?: CustomProgressStoreAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get and clear pending notifications (e.g., fallback warnings).
   */
  getNotifications(): ProgressStoreNotification[] {
    const pending = [...this.notifications];
    this.notifications = [];
    return pending;
  }

  /**
   * Save (upsert) the current reading position for a book.
   */
  async save(bookId: string, chapterId: string, position: number, percentage: number): Promise<ReadingProgressRecord> {
    const progress: ReadingProgressRecord = {
      bookId,
      chapterId,
      position,
      percentage,
      updatedAt: new Date().toISOString(),
    };

    if (this.adapter) {
      try {
        await withTimeout(this.adapter.save(progress), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Progress sync failed. Saved locally.' });
        await this.fallback.save(progress);
      }
    } else {
      await this.fallback.save(progress);
    }

    return progress;
  }

  /**
   * Load the saved reading position for a book, or null if none exists.
   */
  async load(bookId: string): Promise<ReadingProgressRecord | null> {
    if (this.adapter) {
      try {
        return await withTimeout(this.adapter.load(bookId), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Progress sync failed. Loading from local storage.' });
        return this.fallback.load(bookId);
      }
    }
    return this.fallback.load(bookId);
  }

  /**
   * Clear the saved reading position for a book.
   */
  async clear(bookId: string): Promise<void> {
    if (this.adapter) {
      try {
        await withTimeout(this.adapter.remove(bookId), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Progress sync failed. Removed locally.' });
        await this.fallback.remove(bookId).catch(() => { /* already gone locally — nothing to do */ });
      }
    } else {
      await this.fallback.remove(bookId).catch(() => { /* already gone locally — nothing to do */ });
    }
  }
}
