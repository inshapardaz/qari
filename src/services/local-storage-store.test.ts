/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LocalStorageStore } from './local-storage-store';
import { Bookmark } from '../models/bookmark';

/**
 * Unit tests for LocalStorageStore edge cases.
 * Validates: Requirements 2.6, 2.9, 2.10
 */

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: `bm-${Math.random().toString(36).slice(2)}`,
    bookId: 'book-1',
    chapterId: 'ch-1',
    position: 0,
    name: 'Test Bookmark',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('LocalStorageStore edge cases', () => {
  let store: LocalStorageStore;

  beforeEach(() => {
    localStorage.clear();
    store = new LocalStorageStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('quota exceeded error handling (Requirement 2.6)', () => {
    it('should reject with quota exceeded error when localStorage.setItem throws QuotaExceededError', async () => {
      const quotaError = new DOMException('Storage quota exceeded', 'QuotaExceededError');
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw quotaError;
      });

      const bookmark = makeBookmark();
      await expect(store.save(bookmark)).rejects.toThrow('localStorage quota exceeded');

      localStorage.setItem = originalSetItem;
    });

    it('should reject update with quota exceeded error when localStorage is full', async () => {
      // First save a bookmark normally
      const bookmark = makeBookmark({ id: 'existing-1' });
      await store.save(bookmark);

      // Now mock setItem to throw quota exceeded
      const quotaError = new DOMException('Storage quota exceeded', 'QuotaExceededError');
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw quotaError;
      });

      const updated = { ...bookmark, name: 'Updated Name' };
      await expect(store.update(updated)).rejects.toThrow('localStorage quota exceeded');

      localStorage.setItem = originalSetItem;
    });
  });

  describe('localStorage unavailability (Requirement 2.6)', () => {
    it('should reject save with unavailable error when localStorage.setItem throws a generic error', async () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });

      const bookmark = makeBookmark();
      await expect(store.save(bookmark)).rejects.toThrow('localStorage is unavailable');

      localStorage.setItem = originalSetItem;
    });

    it('should reject remove with unavailable error when localStorage.setItem throws', async () => {
      // Save a bookmark first
      const bookmark = makeBookmark({ id: 'to-remove' });
      await store.save(bookmark);

      // Now mock setItem to throw
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(store.remove('to-remove')).rejects.toThrow('localStorage is unavailable');

      localStorage.setItem = originalSetItem;
    });

    it('should reject update with unavailable error when localStorage.setItem throws', async () => {
      // Save a bookmark first
      const bookmark = makeBookmark({ id: 'to-update' });
      await store.save(bookmark);

      // Now mock setItem to throw
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Access denied');
      });

      const updated = { ...bookmark, name: 'New Name' };
      await expect(store.update(updated)).rejects.toThrow('localStorage is unavailable');

      localStorage.setItem = originalSetItem;
    });
  });

  describe('50-bookmark per-book limit boundary (Requirement 2.9)', () => {
    it('should allow saving exactly 50 bookmarks for the same book', async () => {
      for (let i = 0; i < 50; i++) {
        const bookmark = makeBookmark({
          id: `bm-${i}`,
          bookId: 'book-1',
          name: `Bookmark ${i}`,
        });
        await store.save(bookmark);
      }

      const loaded = await store.load('book-1');
      expect(loaded).toHaveLength(50);
    });

    it('should reject the 51st bookmark for the same book with per-book limit error', async () => {
      for (let i = 0; i < 50; i++) {
        const bookmark = makeBookmark({
          id: `bm-${i}`,
          bookId: 'book-1',
          name: `Bookmark ${i}`,
        });
        await store.save(bookmark);
      }

      const fiftyFirst = makeBookmark({
        id: 'bm-50',
        bookId: 'book-1',
        name: 'One Too Many',
      });

      await expect(store.save(fiftyFirst)).rejects.toThrow('per-book limit reached');
    });

    it('should allow saving to a different book even when one book is at limit', async () => {
      for (let i = 0; i < 50; i++) {
        const bookmark = makeBookmark({
          id: `bm-${i}`,
          bookId: 'book-1',
          name: `Bookmark ${i}`,
        });
        await store.save(bookmark);
      }

      const otherBookBookmark = makeBookmark({
        id: 'bm-other',
        bookId: 'book-2',
        name: 'Other Book Bookmark',
      });

      await expect(store.save(otherBookBookmark)).resolves.toBeUndefined();

      const loaded = await store.load('book-2');
      expect(loaded).toHaveLength(1);
    });
  });

  describe('remove non-existent rejects with descriptive error (Requirement 2.10)', () => {
    it('should reject with "bookmark not found" when removing a non-existent bookmark id', async () => {
      await expect(store.remove('non-existent-id')).rejects.toThrow('bookmark not found');
    });

    it('should reject with "bookmark not found" when removing from an empty store', async () => {
      await expect(store.remove('any-id')).rejects.toThrow('bookmark not found');
    });

    it('should reject with "bookmark not found" when updating a non-existent bookmark', async () => {
      const bookmark = makeBookmark({ id: 'does-not-exist' });
      await expect(store.update(bookmark)).rejects.toThrow('bookmark not found');
    });
  });
});
