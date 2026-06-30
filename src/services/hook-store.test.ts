import { describe, it, expect, vi } from 'vitest';
import { HookStore } from './hook-store';
import { Bookmark } from '../models/bookmark';
import { HookStoreCallbacks } from '../interfaces/bookmark-store';

const sampleBookmark: Bookmark = {
  id: 'bm-1',
  bookId: 'book-1',
  chapterId: 'ch-1',
  position: 100,
  name: 'My Bookmark',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('HookStore', () => {
  describe('individual callback invocation', () => {
    it('should invoke onSave with the exact bookmark passed to save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const store = new HookStore({ onSave });

      await store.save(sampleBookmark);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(sampleBookmark);
    });

    it('should invoke onLoad with the exact bookId passed to load', async () => {
      const onLoad = vi.fn().mockResolvedValue([sampleBookmark]);
      const store = new HookStore({ onLoad });

      const result = await store.load('book-1');

      expect(onLoad).toHaveBeenCalledTimes(1);
      expect(onLoad).toHaveBeenCalledWith('book-1');
      expect(result).toEqual([sampleBookmark]);
    });

    it('should invoke onList with no arguments and return the result', async () => {
      const bookmarks = [sampleBookmark];
      const onList = vi.fn().mockResolvedValue(bookmarks);
      const store = new HookStore({ onList });

      const result = await store.list();

      expect(onList).toHaveBeenCalledTimes(1);
      expect(onList).toHaveBeenCalledWith();
      expect(result).toEqual(bookmarks);
    });

    it('should invoke onRemove with the exact bookmarkId passed to remove', async () => {
      const onRemove = vi.fn().mockResolvedValue(undefined);
      const store = new HookStore({ onRemove });

      await store.remove('bm-1');

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith('bm-1');
    });

    it('should invoke onUpdate with the exact bookmark passed to update', async () => {
      const updatedBookmark: Bookmark = {
        ...sampleBookmark,
        name: 'Updated Name',
        updatedAt: '2024-06-15T12:00:00.000Z',
      };
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const store = new HookStore({ onUpdate });

      await store.update(updatedBookmark);

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(updatedBookmark);
    });

    it('should return the callback resolved value unmodified from load', async () => {
      const bookmarks: Bookmark[] = [
        sampleBookmark,
        { ...sampleBookmark, id: 'bm-2', position: 200, name: 'Second Bookmark' },
      ];
      const onLoad = vi.fn().mockResolvedValue(bookmarks);
      const store = new HookStore({ onLoad });

      const result = await store.load('book-1');

      expect(result).toBe(bookmarks); // same reference, not just deep equal
    });

    it('should return the callback resolved value unmodified from list', async () => {
      const bookmarks: Bookmark[] = [sampleBookmark];
      const onList = vi.fn().mockResolvedValue(bookmarks);
      const store = new HookStore({ onList });

      const result = await store.list();

      expect(result).toBe(bookmarks); // same reference
    });
  });

  describe('partial callback configuration', () => {
    it('should work when only onSave and onLoad are provided', async () => {
      const callbacks: HookStoreCallbacks = {
        onSave: vi.fn().mockResolvedValue(undefined),
        onLoad: vi.fn().mockResolvedValue([sampleBookmark]),
      };
      const store = new HookStore(callbacks);

      await store.save(sampleBookmark);
      const loaded = await store.load('book-1');

      expect(callbacks.onSave).toHaveBeenCalledWith(sampleBookmark);
      expect(loaded).toEqual([sampleBookmark]);
    });

    it('should reject remove when onRemove is not provided', async () => {
      const store = new HookStore({
        onSave: vi.fn().mockResolvedValue(undefined),
        onLoad: vi.fn().mockResolvedValue([]),
      });

      await expect(store.remove('bm-1')).rejects.toThrow('operation not supported');
    });

    it('should reject list when onList is not provided', async () => {
      const store = new HookStore({
        onSave: vi.fn().mockResolvedValue(undefined),
        onRemove: vi.fn().mockResolvedValue(undefined),
      });

      await expect(store.list()).rejects.toThrow('operation not supported');
    });

    it('should reject update when onUpdate is not provided', async () => {
      const store = new HookStore({
        onSave: vi.fn().mockResolvedValue(undefined),
        onLoad: vi.fn().mockResolvedValue([]),
      });

      await expect(store.update(sampleBookmark)).rejects.toThrow('operation not supported');
    });

    it('should reject save when onSave is not provided', async () => {
      const store = new HookStore({
        onLoad: vi.fn().mockResolvedValue([]),
        onRemove: vi.fn().mockResolvedValue(undefined),
      });

      await expect(store.save(sampleBookmark)).rejects.toThrow('operation not supported');
    });

    it('should reject load when onLoad is not provided', async () => {
      const store = new HookStore({
        onSave: vi.fn().mockResolvedValue(undefined),
        onRemove: vi.fn().mockResolvedValue(undefined),
      });

      await expect(store.load('book-1')).rejects.toThrow('operation not supported');
    });

    it('should reject all operations when no callbacks are provided', async () => {
      const store = new HookStore({});

      await expect(store.save(sampleBookmark)).rejects.toThrow('operation not supported');
      await expect(store.load('book-1')).rejects.toThrow('operation not supported');
      await expect(store.list()).rejects.toThrow('operation not supported');
      await expect(store.remove('bm-1')).rejects.toThrow('operation not supported');
      await expect(store.update(sampleBookmark)).rejects.toThrow('operation not supported');
    });

    it('should support all operations when all callbacks are provided', async () => {
      const callbacks: HookStoreCallbacks = {
        onSave: vi.fn().mockResolvedValue(undefined),
        onLoad: vi.fn().mockResolvedValue([sampleBookmark]),
        onList: vi.fn().mockResolvedValue([sampleBookmark]),
        onRemove: vi.fn().mockResolvedValue(undefined),
        onUpdate: vi.fn().mockResolvedValue(undefined),
      };
      const store = new HookStore(callbacks);

      await store.save(sampleBookmark);
      await store.load('book-1');
      await store.list();
      await store.remove('bm-1');
      await store.update(sampleBookmark);

      expect(callbacks.onSave).toHaveBeenCalledTimes(1);
      expect(callbacks.onLoad).toHaveBeenCalledTimes(1);
      expect(callbacks.onList).toHaveBeenCalledTimes(1);
      expect(callbacks.onRemove).toHaveBeenCalledTimes(1);
      expect(callbacks.onUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
