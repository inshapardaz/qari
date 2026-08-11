/**
 * LocalStorageProgressStore - Default reading-progress persistence
 * implementation. Stores one record per book, upserted in place.
 * Key format: `${keyPrefix}progress-${bookId}`
 *
 * Unlike bookmarks/notes, progress has no `list()`/enumerate-all use case —
 * it's always looked up directly by bookId — so unlike LocalStorageStore/
 * LocalStorageNoteStore, this doesn't maintain a separate book-id index.
 */

import { ReadingProgressRecord } from '../models/progress';
import { CustomProgressStoreAdapter } from '../interfaces/progress-store';

export class LocalStorageProgressStore implements CustomProgressStoreAdapter {
  private readonly keyPrefix: string;

  constructor(keyPrefix: string = 'qari-') {
    this.keyPrefix = keyPrefix;
  }

  private key(bookId: string): string {
    return `${this.keyPrefix}progress-${bookId}`;
  }

  async save(progress: ReadingProgressRecord): Promise<void> {
    try {
      localStorage.setItem(this.key(progress.bookId), JSON.stringify(progress));
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

  async load(bookId: string): Promise<ReadingProgressRecord | null> {
    try {
      const raw = localStorage.getItem(this.key(bookId));
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.chapterId !== 'string') return null;
      return parsed as ReadingProgressRecord;
    } catch {
      return null;
    }
  }

  async remove(bookId: string): Promise<void> {
    try {
      localStorage.removeItem(this.key(bookId));
    } catch {
      // Non-critical — a stale record is harmless, worst case it's reused
      // as a stale-but-valid resume point next load.
    }
  }
}
