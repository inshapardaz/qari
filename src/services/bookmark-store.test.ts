/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkStore } from './bookmark-store';
import { Bookmark } from '../models/bookmark';
import { CustomStoreAdapter } from '../interfaces/store-adapter';

describe('BookmarkStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('create', () => {
    it('should create a bookmark with all required fields', async () => {
      const store = new BookmarkStore();
      const bookmark = await store.create('book-1', 'ch-1', 42, 'My Bookmark');

      expect(bookmark.id).toBeTruthy();
      expect(bookmark.bookId).toBe('book-1');
      expect(bookmark.chapterId).toBe('ch-1');
      expect(bookmark.position).toBe(42);
      expect(bookmark.name).toBe('My Bookmark');
      expect(bookmark.createdAt).toBeTruthy();
      // Validate ISO 8601 format
      expect(new Date(bookmark.createdAt).toISOString()).toBe(bookmark.createdAt);
    });

    it('should persist to localStorage by default', async () => {
      const store = new BookmarkStore();
      await store.create('book-1', 'ch-1', 0, 'Test');

      const stored = JSON.parse(localStorage.getItem('ebook-reader-bookmarks')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Test');
    });

    it('should generate unique ids for each bookmark', async () => {
      const store = new BookmarkStore();
      const b1 = await store.create('book-1', 'ch-1', 0, 'First');
      const b2 = await store.create('book-1', 'ch-1', 10, 'Second');

      expect(b1.id).not.toBe(b2.id);
    });

    it('should reject empty name', async () => {
      const store = new BookmarkStore();
      await expect(store.create('book-1', 'ch-1', 0, '')).rejects.toThrow(
        'Bookmark name must not be empty'
      );
    });

    it('should reject name longer than 100 characters', async () => {
      const store = new BookmarkStore();
      const longName = 'a'.repeat(101);
      await expect(store.create('book-1', 'ch-1', 0, longName)).rejects.toThrow(
        'must not exceed 100 characters'
      );
    });

    it('should accept name exactly 100 characters', async () => {
      const store = new BookmarkStore();
      const name = 'a'.repeat(100);
      const bookmark = await store.create('book-1', 'ch-1', 0, name);
      expect(bookmark.name).toBe(name);
    });

    it('should accept name exactly 1 character', async () => {
      const store = new BookmarkStore();
      const bookmark = await store.create('book-1', 'ch-1', 0, 'A');
      expect(bookmark.name).toBe('A');
    });

    it('should enforce 50 bookmarks per book limit', async () => {
      const store = new BookmarkStore();
      for (let i = 0; i < 50; i++) {
        await store.create('book-1', 'ch-1', i, `Bookmark ${i}`);
      }

      await expect(store.create('book-1', 'ch-1', 50, 'One too many')).rejects.toThrow(
        'maximum of 50 bookmarks per book'
      );
    });

    it('should allow bookmarks for different books independently', async () => {
      const store = new BookmarkStore();
      for (let i = 0; i < 50; i++) {
        await store.create('book-1', 'ch-1', i, `Bookmark ${i}`);
      }

      // Different book should still work
      const bookmark = await store.create('book-2', 'ch-1', 0, 'Other Book');
      expect(bookmark.bookId).toBe('book-2');
    });
  });

  describe('rename', () => {
    it('should rename a bookmark and set updatedAt', async () => {
      const store = new BookmarkStore();
      const original = await store.create('book-1', 'ch-1', 0, 'Original');

      const renamed = await store.rename(original.id, 'Renamed');
      expect(renamed.name).toBe('Renamed');
      expect(renamed.updatedAt).toBeTruthy();
      expect(renamed.id).toBe(original.id);
    });

    it('should reject empty new name', async () => {
      const store = new BookmarkStore();
      const bookmark = await store.create('book-1', 'ch-1', 0, 'Test');

      await expect(store.rename(bookmark.id, '')).rejects.toThrow(
        'Bookmark name must not be empty'
      );
    });

    it('should reject new name longer than 100 characters', async () => {
      const store = new BookmarkStore();
      const bookmark = await store.create('book-1', 'ch-1', 0, 'Test');
      const longName = 'b'.repeat(101);

      await expect(store.rename(bookmark.id, longName)).rejects.toThrow(
        'must not exceed 100 characters'
      );
    });

    it('should throw for non-existent bookmark ID', async () => {
      const store = new BookmarkStore();
      await expect(store.rename('nonexistent-id', 'New Name')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('delete', () => {
    it('should remove a bookmark from localStorage', async () => {
      const store = new BookmarkStore();
      const bookmark = await store.create('book-1', 'ch-1', 0, 'To Delete');

      await store.delete(bookmark.id);

      const all = await store.list();
      expect(all).toHaveLength(0);
    });

    it('should only remove the specified bookmark', async () => {
      const store = new BookmarkStore();
      const b1 = await store.create('book-1', 'ch-1', 0, 'Keep');
      const b2 = await store.create('book-1', 'ch-1', 10, 'Delete');

      await store.delete(b2.id);

      const all = await store.list();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(b1.id);
    });
  });

  describe('list', () => {
    it('should return empty array when no bookmarks exist', async () => {
      const store = new BookmarkStore();
      const bookmarks = await store.list();
      expect(bookmarks).toEqual([]);
    });

    it('should return all bookmarks', async () => {
      const store = new BookmarkStore();
      await store.create('book-1', 'ch-1', 0, 'First');
      await store.create('book-2', 'ch-2', 10, 'Second');

      const all = await store.list();
      expect(all).toHaveLength(2);
    });
  });

  describe('load', () => {
    it('should return bookmarks only for the specified book', async () => {
      const store = new BookmarkStore();
      await store.create('book-1', 'ch-1', 0, 'Book 1 Bookmark');
      await store.create('book-2', 'ch-1', 0, 'Book 2 Bookmark');

      const book1Bookmarks = await store.load('book-1');
      expect(book1Bookmarks).toHaveLength(1);
      expect(book1Bookmarks[0].bookId).toBe('book-1');
    });

    it('should return empty array for book with no bookmarks', async () => {
      const store = new BookmarkStore();
      const bookmarks = await store.load('nonexistent-book');
      expect(bookmarks).toEqual([]);
    });
  });

  describe('custom adapter delegation', () => {
    it('should delegate save to custom adapter', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      await store.create('book-1', 'ch-1', 0, 'Adapter Test');

      expect(adapter.save).toHaveBeenCalledTimes(1);
      expect(adapter.load).toHaveBeenCalledTimes(1); // called for limit check
    });

    it('should delegate list to custom adapter', async () => {
      const mockBookmarks: Bookmark[] = [
        {
          id: 'test-id',
          bookId: 'book-1',
          chapterId: 'ch-1',
          position: 0,
          name: 'From Adapter',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue(mockBookmarks),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      const result = await store.list();

      expect(adapter.list).toHaveBeenCalled();
      expect(result).toEqual(mockBookmarks);
    });

    it('should delegate load to custom adapter', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      await store.load('book-1');

      expect(adapter.load).toHaveBeenCalledWith('book-1');
    });

    it('should delegate remove to custom adapter', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      await store.delete('bookmark-id');

      expect(adapter.remove).toHaveBeenCalledWith('bookmark-id');
    });

    it('should not touch localStorage when adapter succeeds', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      await store.create('book-1', 'ch-1', 0, 'Test');

      expect(localStorage.getItem('ebook-reader-bookmarks')).toBeNull();
    });
  });

  describe('adapter timeout and fallback', () => {
    it('should fall back to localStorage when adapter times out on save', async () => {
      vi.useFakeTimers();

      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      const createPromise = store.create('book-1', 'ch-1', 0, 'Timeout Test');

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(5001);
      const bookmark = await createPromise;

      expect(bookmark.name).toBe('Timeout Test');
      const stored = JSON.parse(localStorage.getItem('ebook-reader-bookmarks')!);
      expect(stored).toHaveLength(1);

      const notifications = store.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('warning');

      vi.useRealTimers();
    }, 10000);

    it('should fall back to localStorage when adapter rejects', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockRejectedValue(new Error('Server error')),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      const bookmark = await store.create('book-1', 'ch-1', 0, 'Fallback Test');

      expect(bookmark.name).toBe('Fallback Test');
      const stored = JSON.parse(localStorage.getItem('ebook-reader-bookmarks')!);
      expect(stored).toHaveLength(1);

      const notifications = store.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toContain('sync failed');
    });

    it('should fall back to localStorage when adapter list rejects', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockRejectedValue(new Error('Server error')),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      // Pre-fill localStorage
      localStorage.setItem(
        'ebook-reader-bookmarks',
        JSON.stringify([
          {
            id: 'local-1',
            bookId: 'book-1',
            chapterId: 'ch-1',
            position: 0,
            name: 'Local',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ])
      );

      const result = await store.list();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Local');
    });

    it('should fall back to localStorage when adapter load rejects', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockRejectedValue(new Error('Server error')),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      localStorage.setItem(
        'ebook-reader-bookmarks',
        JSON.stringify([
          {
            id: 'local-1',
            bookId: 'book-1',
            chapterId: 'ch-1',
            position: 0,
            name: 'Local Book 1',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ])
      );

      const result = await store.load('book-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Local Book 1');
    });

    it('should fall back to localStorage when adapter remove rejects', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockResolvedValue(undefined),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockRejectedValue(new Error('Server error')),
      };

      const store = new BookmarkStore(adapter);
      // Pre-fill localStorage with a bookmark to be removed
      localStorage.setItem(
        'ebook-reader-bookmarks',
        JSON.stringify([
          {
            id: 'to-remove',
            bookId: 'book-1',
            chapterId: 'ch-1',
            position: 0,
            name: 'Will Remove',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ])
      );

      await store.delete('to-remove');

      const stored = JSON.parse(localStorage.getItem('ebook-reader-bookmarks')!);
      expect(stored).toHaveLength(0);
    });
  });

  describe('notifications', () => {
    it('should clear notifications after getting them', async () => {
      const adapter: CustomStoreAdapter = {
        save: vi.fn().mockRejectedValue(new Error('Server error')),
        load: vi.fn().mockResolvedValue([]),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const store = new BookmarkStore(adapter);
      await store.create('book-1', 'ch-1', 0, 'Test');

      const first = store.getNotifications();
      expect(first).toHaveLength(1);

      const second = store.getNotifications();
      expect(second).toHaveLength(0);
    });
  });
});
