/**
 * Property-Based Tests for Bookmark Store Implementations
 *
 * Tests the IndexedDBStore implementation against correctness properties
 * defined in the design document.
 *
 * Uses fast-check for property-based testing and fake-indexeddb for
 * IndexedDB simulation in Node.js/jsdom environments.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import 'fake-indexeddb/auto';
import { IndexedDBStore } from '../indexeddb-store';
import { Bookmark } from '../../models/bookmark';

/**
 * Arbitrary generator for valid Bookmark objects.
 */
const bookmarkArb = (overrides?: Partial<{ bookId: fc.Arbitrary<string> }>) =>
  fc.record({
    id: fc.uuid(),
    bookId: overrides?.bookId ?? fc.string({ minLength: 1, maxLength: 50 }),
    chapterId: fc.string({ minLength: 1, maxLength: 50 }),
    position: fc.nat({ max: 100000 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map((d) => d.toISOString()),
  });

describe('IndexedDBStore - Property Tests', () => {
  let store: IndexedDBStore;
  let dbCounter = 0;

  beforeEach(() => {
    // Use a unique database name per test to avoid cross-test contamination
    dbCounter++;
    store = new IndexedDBStore(`test-bookmarks-db-${dbCounter}-${Date.now()}`);
  });

  afterEach(() => {
    // Clear the indexedDB databases
    store = null as unknown as IndexedDBStore;
  });

  /**
   * Property 1: Save/Load Round-Trip
   *
   * For any valid Bookmark object, saving the bookmark and then calling
   * load(bookmark.bookId) SHALL return a collection containing a bookmark
   * with the same id, bookId, chapterId, position, name, and createdAt.
   *
   * **Validates: Requirements 1.1, 1.2, 3.3, 3.7**
   */
  it('Property 1: Save/Load Round-Trip — saved bookmark is retrievable via load', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb(), async (bookmark: Bookmark) => {
        const testStore = new IndexedDBStore(`roundtrip-${fc.stringify(bookmark.id)}-${Date.now()}`);

        await testStore.save(bookmark);
        const loaded = await testStore.load(bookmark.bookId);

        const found = loaded.find((b) => b.id === bookmark.id);
        expect(found).toBeDefined();
        expect(found!.id).toBe(bookmark.id);
        expect(found!.bookId).toBe(bookmark.bookId);
        expect(found!.chapterId).toBe(bookmark.chapterId);
        expect(found!.position).toBe(bookmark.position);
        expect(found!.name).toBe(bookmark.name);
        expect(found!.createdAt).toBe(bookmark.createdAt);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Load Filters by BookId
   *
   * For any set of bookmarks saved across multiple distinct bookIds,
   * calling load(bookId) SHALL return only bookmarks whose bookId field
   * matches the provided argument, and SHALL return an empty array for
   * any bookId that has no saved bookmarks.
   *
   * **Validates: Requirements 1.2, 3.4**
   */
  it('Property 2: Load Filters by BookId — load returns only bookmarks matching the given bookId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(bookmarkArb(), { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 50 }), // a bookId that may or may not exist
        async (bookmarks: Bookmark[], queryBookId: string) => {
          const testStore = new IndexedDBStore(`filter-${Date.now()}-${Math.random()}`);

          // Save all bookmarks
          for (const bm of bookmarks) {
            await testStore.save(bm);
          }

          // Load by each unique bookId present
          const uniqueBookIds = [...new Set(bookmarks.map((b) => b.bookId))];

          for (const bookId of uniqueBookIds) {
            const loaded = await testStore.load(bookId);
            const expected = bookmarks.filter((b) => b.bookId === bookId);

            // All returned bookmarks must have the queried bookId
            for (const bm of loaded) {
              expect(bm.bookId).toBe(bookId);
            }

            // Count should match (accounting for duplicate IDs which use put/upsert)
            const uniqueExpected = new Map(expected.map((b) => [b.id, b]));
            expect(loaded.length).toBe(uniqueExpected.size);
          }

          // Query a bookId not in the saved set → empty array
          const nonExistentBookId = queryBookId + '__nonexistent__';
          const emptyResult = await testStore.load(nonExistentBookId);
          expect(emptyResult).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Remove Then Absent
   *
   * For any bookmark that has been saved to the store, calling
   * remove(bookmark.id) and then load(bookmark.bookId) SHALL return
   * a collection that does not contain a bookmark with that id.
   *
   * **Validates: Requirements 1.3, 3.5**
   */
  it('Property 3: Remove Then Absent — removed bookmark is no longer retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb(), async (bookmark: Bookmark) => {
        const testStore = new IndexedDBStore(`remove-${Date.now()}-${Math.random()}`);

        // Save, then remove
        await testStore.save(bookmark);
        await testStore.remove(bookmark.id);

        // Load should not contain the removed bookmark
        const loaded = await testStore.load(bookmark.bookId);
        const found = loaded.find((b) => b.id === bookmark.id);
        expect(found).toBeUndefined();

        // Also verify via list
        const all = await testStore.list();
        const foundInList = all.find((b) => b.id === bookmark.id);
        expect(foundInList).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Remove Non-Existent Resolves Gracefully
   *
   * For any string identifier that does not correspond to a bookmark in
   * the store, calling remove(id) SHALL resolve the Promise without
   * throwing an error.
   *
   * **Validates: Requirements 1.4, 3.9**
   */
  it('Property 4: Remove Non-Existent Resolves Gracefully — removing a non-existent id does not throw', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (nonExistentId: string) => {
        const testStore = new IndexedDBStore(`graceful-${Date.now()}-${Math.random()}`);

        // Should not throw when removing an id that was never saved
        await expect(testStore.remove(nonExistentId)).resolves.toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});
