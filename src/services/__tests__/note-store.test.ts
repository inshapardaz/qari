/**
 * Tests for NoteStore — CRUD, validation, per-book limits, and adapter
 * fallback-to-localStorage behavior. Mirrors the bookmark-store test
 * coverage for the equivalent behaviors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NoteStore } from '../note-store';
import type { CustomNoteStoreAdapter } from '../../interfaces/note-store';
import type { Note } from '../../models/note';

function makeAdapter(overrides: Partial<CustomNoteStoreAdapter> = {}): CustomNoteStoreAdapter {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('NoteStore (localStorage default, no adapter)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a note and persists it to localStorage', async () => {
    const store = new NoteStore();
    const note = await store.create('book-1', 'ch-1', 10, 20, 'excerpt text', 'my comment');

    expect(note.id).toBeTruthy();
    expect(note.bookId).toBe('book-1');
    expect(note.chapterId).toBe('ch-1');
    expect(note.startOffset).toBe(10);
    expect(note.endOffset).toBe(20);
    expect(note.text).toBe('excerpt text');
    expect(note.comment).toBe('my comment');
    expect(note.createdAt).toBeTruthy();

    const loaded = await store.load('book-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(note.id);
  });

  it('creates a note without a comment', async () => {
    const store = new NoteStore();
    const note = await store.create('book-1', 'ch-1', 0, 5, 'hi');
    expect(note.comment).toBeUndefined();
  });

  it('rejects a comment over 1000 characters', async () => {
    const store = new NoteStore();
    await expect(store.create('book-1', 'ch-1', 0, 5, 'hi', 'a'.repeat(1001))).rejects.toThrow(/1000/);
  });

  it('enforces the per-book note limit', async () => {
    const store = new NoteStore();
    for (let i = 0; i < 200; i++) {
      await store.create('book-1', 'ch-1', i, i + 1, 'x');
    }
    await expect(store.create('book-1', 'ch-1', 999, 1000, 'x')).rejects.toThrow(/maximum of 200/);
  });

  it('updates a note comment', async () => {
    const store = new NoteStore();
    const note = await store.create('book-1', 'ch-1', 0, 5, 'hi');
    const updated = await store.updateComment(note.id, 'updated comment');

    expect(updated.comment).toBe('updated comment');
    expect(updated.updatedAt).toBeTruthy();

    const loaded = await store.load('book-1');
    expect(loaded[0].comment).toBe('updated comment');
  });

  it('rejects updating a comment that is too long', async () => {
    const store = new NoteStore();
    const note = await store.create('book-1', 'ch-1', 0, 5, 'hi');
    await expect(store.updateComment(note.id, 'a'.repeat(1001))).rejects.toThrow(/1000/);
  });

  it('rejects updating a note that does not exist', async () => {
    const store = new NoteStore();
    await expect(store.updateComment('missing-id', 'x')).rejects.toThrow(/not found/);
  });

  it('deletes a note', async () => {
    const store = new NoteStore();
    const note = await store.create('book-1', 'ch-1', 0, 5, 'hi');
    await store.delete(note.id);

    const loaded = await store.load('book-1');
    expect(loaded).toHaveLength(0);
  });

  it('deleting a note that does not exist does not throw (idempotent)', async () => {
    const store = new NoteStore();
    await expect(store.delete('missing-id')).resolves.toBeUndefined();
  });

  it('load only returns notes for the given book', async () => {
    const store = new NoteStore();
    await store.create('book-1', 'ch-1', 0, 5, 'a');
    await store.create('book-2', 'ch-1', 0, 5, 'b');

    expect(await store.load('book-1')).toHaveLength(1);
    expect(await store.load('book-2')).toHaveLength(1);
  });

  it('list returns notes across all books', async () => {
    const store = new NoteStore();
    await store.create('book-1', 'ch-1', 0, 5, 'a');
    await store.create('book-2', 'ch-1', 0, 5, 'b');

    expect(await store.list()).toHaveLength(2);
  });
});

describe('NoteStore (custom adapter)', () => {
  it('delegates create to the adapter instead of localStorage', async () => {
    const adapter = makeAdapter();
    const store = new NoteStore(adapter);
    const note = await store.create('book-1', 'ch-1', 0, 5, 'hi');

    expect(adapter.save).toHaveBeenCalledWith(expect.objectContaining({ id: note.id, bookId: 'book-1' }));
  });

  it('delegates load/list/delete to the adapter', async () => {
    const existing: Note = {
      id: 'n1', bookId: 'book-1', chapterId: 'ch-1', startOffset: 0, endOffset: 5, text: 'hi', createdAt: '2024-01-01T00:00:00Z',
    };
    const adapter = makeAdapter({
      load: vi.fn().mockResolvedValue([existing]),
      list: vi.fn().mockResolvedValue([existing]),
    });
    const store = new NoteStore(adapter);

    expect(await store.load('book-1')).toEqual([existing]);
    expect(await store.list()).toEqual([existing]);

    await store.delete('n1');
    expect(adapter.remove).toHaveBeenCalledWith('n1');
  });

  it('falls back to localStorage when the adapter rejects on create, and records a notification', async () => {
    localStorage.clear();
    const adapter = makeAdapter({ save: vi.fn().mockRejectedValue(new Error('network down')) });
    const store = new NoteStore(adapter);

    const note = await store.create('book-1', 'ch-1', 0, 5, 'hi');
    expect(note.id).toBeTruthy();

    expect(store.getNotifications()).toEqual([
      { type: 'warning', message: 'Note sync failed. Saved locally.' },
    ]);
  });

  it('falls back to localStorage when the adapter rejects on load', async () => {
    localStorage.clear();
    const adapter = makeAdapter({ load: vi.fn().mockRejectedValue(new Error('network down')) });
    const store = new NoteStore(adapter);

    const result = await store.load('book-1');
    expect(result).toEqual([]);
    expect(store.getNotifications()).toEqual([
      { type: 'warning', message: 'Note sync failed. Loading from local storage.' },
    ]);
  });

  it('getNotifications clears the pending queue after reading', async () => {
    const adapter = makeAdapter({ save: vi.fn().mockRejectedValue(new Error('down')) });
    const store = new NoteStore(adapter);
    await store.create('book-1', 'ch-1', 0, 5, 'hi');

    expect(store.getNotifications().length).toBe(1);
    expect(store.getNotifications().length).toBe(0);
  });
});
