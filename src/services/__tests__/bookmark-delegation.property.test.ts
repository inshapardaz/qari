/**
 * Property 12: Custom Adapter Delegation
 *
 * For any sequence of bookmark operations (create, load, list, delete) when a
 * Custom_Store_Adapter is configured, ALL operations SHALL be delegated to the
 * adapter and NONE shall touch local storage.
 *
 * Feature: universal-ebook-reader, Property 12: Custom Adapter Delegation
 *
 * **Validates: Requirements 8.3**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BookmarkStore } from '../bookmark-store';
import type { CustomStoreAdapter } from '../../interfaces/store-adapter';
import type { Bookmark } from '../../models/bookmark';

// --- Mock Adapter Factory ---

interface MockAdapter extends CustomStoreAdapter {
  saveCalls: Bookmark[];
  loadCalls: string[];
  listCalls: number;
  removeCalls: string[];
  bookmarks: Bookmark[];
}

function createMockAdapter(): MockAdapter {
  const adapter: MockAdapter = {
    saveCalls: [],
    loadCalls: [],
    listCalls: 0,
    removeCalls: [],
    bookmarks: [],

    save: vi.fn(async (bookmark: Bookmark) => {
      adapter.saveCalls.push(bookmark);
      const idx = adapter.bookmarks.findIndex((b) => b.id === bookmark.id);
      if (idx !== -1) {
        adapter.bookmarks[idx] = bookmark;
      } else {
        adapter.bookmarks.push(bookmark);
      }
    }),

    load: vi.fn(async (bookId: string) => {
      adapter.loadCalls.push(bookId);
      return adapter.bookmarks.filter((b) => b.bookId === bookId);
    }),

    list: vi.fn(async () => {
      adapter.listCalls++;
      return [...adapter.bookmarks];
    }),

    remove: vi.fn(async (bookmarkId: string) => {
      adapter.removeCalls.push(bookmarkId);
      adapter.bookmarks = adapter.bookmarks.filter((b) => b.id !== bookmarkId);
    }),
  };

  return adapter;
}

// --- Generators ---

/**
 * Valid bookmark name: 1-100 characters, alphanumeric + spaces.
 */
const validNameArb: fc.Arbitrary<string> = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')
    ),
    { minLength: 1, maxLength: 50 }
  )
  .map((s) => s.trim())
  .filter((s) => s.length >= 1 && s.length <= 100);

/**
 * Book ID generator.
 */
const bookIdArb: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 3,
    maxLength: 10,
  })
  .map((s) => `book-${s}`);

/**
 * Chapter ID generator.
 */
const chapterIdArb: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 3,
    maxLength: 10,
  })
  .map((s) => `ch-${s}`);

/**
 * Position generator.
 */
const positionArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 10000 });

/**
 * Operation type for generating sequences.
 */
type Operation =
  | { type: 'create'; bookId: string; chapterId: string; position: number; name: string }
  | { type: 'load'; bookId: string }
  | { type: 'list' }
  | { type: 'delete'; index: number };

/**
 * Operation generator.
 */
const operationArb: fc.Arbitrary<Operation> = fc.oneof(
  { weight: 4, arbitrary: fc.tuple(bookIdArb, chapterIdArb, positionArb, validNameArb).map(
    ([bookId, chapterId, position, name]) => ({
      type: 'create' as const,
      bookId,
      chapterId,
      position,
      name,
    })
  )},
  { weight: 2, arbitrary: bookIdArb.map((bookId) => ({ type: 'load' as const, bookId })) },
  { weight: 2, arbitrary: fc.constant({ type: 'list' as const }) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 100 }).map((index) => ({
    type: 'delete' as const,
    index,
  })) }
);

/**
 * Sequence of operations (at least 1).
 */
const operationSequenceArb: fc.Arbitrary<Operation[]> = fc.array(operationArb, {
  minLength: 1,
  maxLength: 10,
});

// --- Constants ---

const STORAGE_KEY = 'ebook-reader-bookmarks';

// --- Tests ---

describe('Property 12: Custom Adapter Delegation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('all bookmark operations are delegated to the adapter and none touch localStorage', async () => {
    await fc.assert(
      fc.asyncProperty(operationSequenceArb, async (operations) => {
        // Fresh adapter and store for each test run
        const adapter = createMockAdapter();
        const store = new BookmarkStore(adapter);
        const createdBookmarks: Bookmark[] = [];

        // Clear localStorage before executing operations
        localStorage.removeItem(STORAGE_KEY);

        // Execute the operation sequence
        for (const op of operations) {
          switch (op.type) {
            case 'create': {
              const bookmark = await store.create(
                op.bookId,
                op.chapterId,
                op.position,
                op.name
              );
              createdBookmarks.push(bookmark);
              break;
            }
            case 'load': {
              await store.load(op.bookId);
              break;
            }
            case 'list': {
              await store.list();
              break;
            }
            case 'delete': {
              if (createdBookmarks.length > 0) {
                const idx = op.index % createdBookmarks.length;
                const bookmarkToDelete = createdBookmarks[idx];
                await store.delete(bookmarkToDelete.id);
                createdBookmarks.splice(idx, 1);
              }
              break;
            }
          }
        }

        // Assert: localStorage was NEVER touched
        const storageValue = localStorage.getItem(STORAGE_KEY);
        expect(storageValue).toBeNull();

        // Assert: adapter methods were called for each operation
        const createOps = operations.filter((op) => op.type === 'create');
        const loadOps = operations.filter((op) => op.type === 'load');
        const listOps = operations.filter((op) => op.type === 'list');
        const deleteOpsExecutable = operations.filter(
          (op) => op.type === 'delete'
        );

        // Each create calls adapter.save AND adapter.load (load is called to check per-book limit)
        expect(adapter.saveCalls.length).toBe(createOps.length);

        // Each load operation calls adapter.load
        // Note: create also calls load internally to check the 50-bookmark limit
        expect(adapter.loadCalls.length).toBeGreaterThanOrEqual(loadOps.length);

        // Each list operation calls adapter.list
        expect(adapter.listCalls).toBeGreaterThanOrEqual(listOps.length);

        // Delete operations that had bookmarks to delete should call adapter.remove
        let deleteCount = 0;
        const tempCreated: Bookmark[] = [];
        for (const op of operations) {
          if (op.type === 'create') {
            tempCreated.push({} as Bookmark); // placeholder
          } else if (op.type === 'delete' && tempCreated.length > 0) {
            const idx = op.index % tempCreated.length;
            tempCreated.splice(idx, 1);
            deleteCount++;
          }
        }
        expect(adapter.removeCalls.length).toBe(deleteCount);
      }),
      { numRuns: 100 }
    );
  });
});
