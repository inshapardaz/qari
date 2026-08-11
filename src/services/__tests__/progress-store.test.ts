/**
 * Tests for ProgressStore — save/load/clear and adapter fallback-to-localStorage
 * behavior. Mirrors note-store.test.ts's coverage for the equivalent behaviors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressStore } from '../progress-store';
import type { CustomProgressStoreAdapter } from '../../interfaces/progress-store';
import type { ReadingProgressRecord } from '../../models/progress';

function makeAdapter(overrides: Partial<CustomProgressStoreAdapter> = {}): CustomProgressStoreAdapter {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProgressStore (localStorage default, no adapter)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads a reading position', async () => {
    const store = new ProgressStore();
    const progress = await store.save('book-1', 'ch-1', 1500, 42);

    expect(progress.bookId).toBe('book-1');
    expect(progress.chapterId).toBe('ch-1');
    expect(progress.position).toBe(1500);
    expect(progress.percentage).toBe(42);
    expect(progress.updatedAt).toBeTruthy();

    const loaded = await store.load('book-1');
    expect(loaded).toEqual(progress);
  });

  it('loading a book with no saved progress returns null', async () => {
    const store = new ProgressStore();
    expect(await store.load('unknown-book')).toBeNull();
  });

  it('save upserts — a second save for the same book replaces the first', async () => {
    const store = new ProgressStore();
    await store.save('book-1', 'ch-1', 0, 0);
    const second = await store.save('book-1', 'ch-2', 3000, 55);

    const loaded = await store.load('book-1');
    expect(loaded).toEqual(second);
  });

  it('progress for different books is independent', async () => {
    const store = new ProgressStore();
    await store.save('book-1', 'ch-1', 100, 10);
    await store.save('book-2', 'ch-1', 200, 20);

    expect((await store.load('book-1'))?.position).toBe(100);
    expect((await store.load('book-2'))?.position).toBe(200);
  });

  it('clears a saved reading position', async () => {
    const store = new ProgressStore();
    await store.save('book-1', 'ch-1', 100, 10);
    await store.clear('book-1');

    expect(await store.load('book-1')).toBeNull();
  });

  it('clearing a book with no saved progress does not throw (idempotent)', async () => {
    const store = new ProgressStore();
    await expect(store.clear('missing-book')).resolves.toBeUndefined();
  });
});

describe('ProgressStore (custom adapter)', () => {
  it('delegates save to the adapter instead of localStorage', async () => {
    const adapter = makeAdapter();
    const store = new ProgressStore(adapter);
    const progress = await store.save('book-1', 'ch-1', 100, 10);

    expect(adapter.save).toHaveBeenCalledWith(expect.objectContaining({ bookId: 'book-1', chapterId: 'ch-1', position: 100, percentage: 10 }));
    expect(progress.bookId).toBe('book-1');
  });

  it('delegates load/clear to the adapter', async () => {
    const existing: ReadingProgressRecord = {
      bookId: 'book-1', chapterId: 'ch-1', position: 100, percentage: 10, updatedAt: '2024-01-01T00:00:00Z',
    };
    const adapter = makeAdapter({ load: vi.fn().mockResolvedValue(existing) });
    const store = new ProgressStore(adapter);

    expect(await store.load('book-1')).toEqual(existing);

    await store.clear('book-1');
    expect(adapter.remove).toHaveBeenCalledWith('book-1');
  });

  it('falls back to localStorage when the adapter rejects on save, and records a notification', async () => {
    localStorage.clear();
    const adapter = makeAdapter({ save: vi.fn().mockRejectedValue(new Error('network down')) });
    const store = new ProgressStore(adapter);

    const progress = await store.save('book-1', 'ch-1', 100, 10);
    expect(progress.bookId).toBe('book-1');

    expect(store.getNotifications()).toEqual([
      { type: 'warning', message: 'Progress sync failed. Saved locally.' },
    ]);
  });

  it('falls back to localStorage when the adapter rejects on load', async () => {
    localStorage.clear();
    const adapter = makeAdapter({ load: vi.fn().mockRejectedValue(new Error('network down')) });
    const store = new ProgressStore(adapter);

    const result = await store.load('book-1');
    expect(result).toBeNull();
    expect(store.getNotifications()).toEqual([
      { type: 'warning', message: 'Progress sync failed. Loading from local storage.' },
    ]);
  });

  it('getNotifications clears the pending queue after reading', async () => {
    const adapter = makeAdapter({ save: vi.fn().mockRejectedValue(new Error('down')) });
    const store = new ProgressStore(adapter);
    await store.save('book-1', 'ch-1', 0, 0);

    expect(store.getNotifications().length).toBe(1);
    expect(store.getNotifications().length).toBe(0);
  });
});
