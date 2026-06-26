/**
 * Property 13: Adapter Timeout Fallback
 *
 * For any Custom_Store_Adapter operation that does not resolve within 5 seconds
 * or rejects with an error, the Bookmark_Store SHALL fall back to local storage
 * for that operation and the operation SHALL still complete successfully (data
 * persisted locally).
 *
 * Feature: universal-ebook-reader, Property 13: Adapter Timeout Fallback
 *
 * **Validates: Requirements 8.6**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { BookmarkStore } from '../bookmark-store';
import type { CustomStoreAdapter } from '../../interfaces/store-adapter';
import type { Bookmark } from '../../models/bookmark';

// --- Constants ---

const STORAGE_KEY = 'ebook-reader-bookmarks';
const ADAPTER_TIMEOUT_MS = 5000;

// --- Failing Adapter Factories ---

type FailureMode = 'reject' | 'timeout';

/**
 * Creates an adapter that either rejects immediately or never resolves (timeout).
 */
function createFailingAdapter(mode: FailureMode): CustomStoreAdapter {
  if (mode === 'reject') {
    return {
      save: vi.fn(() => Promise.reject(new Error('Adapter save failed'))),
      load: vi.fn(() => Promise.reject(new Error('Adapter load failed'))),
      list: vi.fn(() => Promise.reject(new Error('Adapter list failed'))),
      remove: vi.fn(() => Promise.reject(new Error('Adapter remove failed'))),
    };
  }

  // Timeout mode: returns promises that never resolve
  return {
    save: vi.fn(() => new Promise<void>(() => {})),
    load: vi.fn(() => new Promise<Bookmark[]>(() => {})),
    list: vi.fn(() => new Promise<Bookmark[]>(() => {})),
    remove: vi.fn(() => new Promise<void>(() => {})),
  };
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
 * Failure mode generator.
 */
const failureModeArb: fc.Arbitrary<FailureMode> = fc.constantFrom('reject', 'timeout');

// --- Tests ---

describe('Property 13: Adapter Timeout Fallback', { timeout: 60000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('bookmark creation still succeeds via localStorage fallback when adapter fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookIdArb,
        chapterIdArb,
        positionArb,
        validNameArb,
        failureModeArb,
        async (bookId, chapterId, position, name, failureMode) => {
          localStorage.clear();
          const adapter = createFailingAdapter(failureMode);
          const store = new BookmarkStore(adapter);

          let createPromise: Promise<Bookmark>;

          if (failureMode === 'timeout') {
            // Start the create operation (will hang on adapter)
            createPromise = store.create(bookId, chapterId, position, name);
            // Advance timers past the 5-second timeout multiple times
            // because create() internally calls load() first (limit check) then save()
            // both of which will timeout
            await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS + 1);
            await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS + 1);
          } else {
            // Rejection is immediate
            createPromise = store.create(bookId, chapterId, position, name);
          }

          const bookmark = await createPromise;

          // 1. Bookmark creation still succeeds (returns a valid Bookmark)
          expect(bookmark).toBeDefined();
          expect(bookmark.id).toBeTruthy();
          expect(bookmark.bookId).toBe(bookId);
          expect(bookmark.chapterId).toBe(chapterId);
          expect(bookmark.position).toBe(position);
          expect(bookmark.name).toBe(name);
          expect(bookmark.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

          // 2. The bookmark is stored in localStorage
          const stored = localStorage.getItem(STORAGE_KEY);
          expect(stored).not.toBeNull();
          const parsedBookmarks: Bookmark[] = JSON.parse(stored!);
          const found = parsedBookmarks.find((b) => b.id === bookmark.id);
          expect(found).toBeDefined();
          expect(found!.bookId).toBe(bookId);
          expect(found!.name).toBe(name);

          // 3. Notifications are generated about the sync failure
          const notifications = store.getNotifications();
          expect(notifications.length).toBeGreaterThan(0);
          expect(notifications.some((n) => n.type === 'warning')).toBe(true);
          expect(
            notifications.some((n) => n.message.toLowerCase().includes('sync failed'))
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('bookmark deletion completes via localStorage fallback when adapter fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookIdArb,
        chapterIdArb,
        positionArb,
        validNameArb,
        failureModeArb,
        async (bookId, chapterId, position, name, failureMode) => {
          localStorage.clear();

          // First, create a bookmark locally (no adapter) so it exists in localStorage
          const setupStore = new BookmarkStore();
          const bookmark = await setupStore.create(bookId, chapterId, position, name);

          // Verify it's in localStorage
          const storedBefore = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as Bookmark[];
          expect(storedBefore.some((b) => b.id === bookmark.id)).toBe(true);

          // Now create a store with a failing adapter and try to delete
          const adapter = createFailingAdapter(failureMode);
          const store = new BookmarkStore(adapter);

          let deletePromise: Promise<void>;

          if (failureMode === 'timeout') {
            deletePromise = store.delete(bookmark.id);
            await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS + 1);
          } else {
            deletePromise = store.delete(bookmark.id);
          }

          await deletePromise;

          // Deletion should have fallen back to localStorage
          const storedAfter = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || '[]'
          ) as Bookmark[];
          expect(storedAfter.some((b) => b.id === bookmark.id)).toBe(false);

          // Notification about sync failure
          const notifications = store.getNotifications();
          expect(notifications.length).toBeGreaterThan(0);
          expect(notifications.some((n) => n.type === 'warning')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('bookmark listing falls back to localStorage when adapter fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        bookIdArb,
        chapterIdArb,
        positionArb,
        validNameArb,
        failureModeArb,
        async (bookId, chapterId, position, name, failureMode) => {
          localStorage.clear();

          // Create a bookmark in localStorage first (no adapter)
          const setupStore = new BookmarkStore();
          const bookmark = await setupStore.create(bookId, chapterId, position, name);

          // Now use a failing adapter
          const adapter = createFailingAdapter(failureMode);
          const store = new BookmarkStore(adapter);

          let loadPromise: Promise<Bookmark[]>;

          if (failureMode === 'timeout') {
            loadPromise = store.load(bookId);
            await vi.advanceTimersByTimeAsync(ADAPTER_TIMEOUT_MS + 1);
          } else {
            loadPromise = store.load(bookId);
          }

          const bookmarks = await loadPromise;

          // Should return the bookmarks from localStorage
          expect(bookmarks.length).toBeGreaterThan(0);
          expect(bookmarks.some((b) => b.id === bookmark.id)).toBe(true);

          // Notification about sync failure
          const notifications = store.getNotifications();
          expect(notifications.length).toBeGreaterThan(0);
          expect(notifications.some((n) => n.type === 'warning')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
