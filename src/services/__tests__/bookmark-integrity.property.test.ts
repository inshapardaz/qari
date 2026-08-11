/**
 * Property 11: Bookmark Data Integrity
 *
 * For any bookmark creation with a valid name (1–100 characters), the resulting
 * bookmark SHALL contain a non-empty bookId, correct chapterId, correct position
 * offset, the provided name, and a valid UTC timestamp. For any rename attempt
 * with an empty name or a name exceeding 100 characters, the operation SHALL be
 * rejected and the bookmark SHALL remain unchanged.
 *
 * **Validates: Requirements 8.1, 8.8**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { BookmarkStore } from '../bookmark-store';

describe('Property 11: Bookmark Data Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('created bookmark has non-empty bookId, correct chapterId, correct position, provided name, and valid UTC timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid bookmark name: 1-100 characters
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.length >= 1),
        fc.string({ minLength: 1, maxLength: 50 }), // bookId
        fc.string({ minLength: 1, maxLength: 50 }), // chapterId
        fc.nat(), // position (non-negative integer)
        async (name, bookId, chapterId, position) => {
          localStorage.clear();
          const store = new BookmarkStore();

          const bookmark = await store.create(bookId, chapterId, position, name);

          // Non-empty id (Sqids-encoded)
          expect(bookmark.id).toBeTruthy();
          expect(bookmark.id.length).toBeGreaterThan(0);

          // Correct bookId
          expect(bookmark.bookId).toBe(bookId);

          // Correct chapterId
          expect(bookmark.chapterId).toBe(chapterId);

          // Correct position
          expect(bookmark.position).toBe(position);

          // Provided name
          expect(bookmark.name).toBe(name);

          // Valid UTC timestamp (ISO 8601)
          const timestamp = new Date(bookmark.createdAt);
          expect(timestamp.toString()).not.toBe('Invalid Date');
          // Verify it ends with 'Z' (UTC) or contains timezone offset
          expect(bookmark.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects empty name on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // bookId
        fc.string({ minLength: 1, maxLength: 50 }), // chapterId
        fc.nat(), // position
        async (bookId, chapterId, position) => {
          localStorage.clear();
          const store = new BookmarkStore();

          await expect(store.create(bookId, chapterId, position, '')).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects name exceeding 100 characters on create', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 101, maxLength: 300 }), // invalid name (>100 chars)
        fc.string({ minLength: 1, maxLength: 50 }), // bookId
        fc.string({ minLength: 1, maxLength: 50 }), // chapterId
        fc.nat(), // position
        async (name, bookId, chapterId, position) => {
          localStorage.clear();
          const store = new BookmarkStore();

          await expect(store.create(bookId, chapterId, position, name)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects empty name on rename', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.length >= 1), // valid initial name
        fc.string({ minLength: 1, maxLength: 50 }), // bookId
        fc.string({ minLength: 1, maxLength: 50 }), // chapterId
        fc.nat(), // position
        async (validName, bookId, chapterId, position) => {
          localStorage.clear();
          const store = new BookmarkStore();

          // Create a valid bookmark first
          const bookmark = await store.create(bookId, chapterId, position, validName);

          // Attempt rename with empty name should be rejected
          await expect(store.rename(bookmark.id, '')).rejects.toThrow();

          // Bookmark should remain unchanged
          const bookmarks = await store.load(bookId);
          const found = bookmarks.find((b) => b.id === bookmark.id);
          expect(found).toBeDefined();
          expect(found!.name).toBe(validName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects name exceeding 100 characters on rename', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.length >= 1), // valid initial name
        fc.string({ minLength: 101, maxLength: 300 }), // invalid new name
        fc.string({ minLength: 1, maxLength: 50 }), // bookId
        fc.string({ minLength: 1, maxLength: 50 }), // chapterId
        fc.nat(), // position
        async (validName, invalidName, bookId, chapterId, position) => {
          localStorage.clear();
          const store = new BookmarkStore();

          // Create a valid bookmark first
          const bookmark = await store.create(bookId, chapterId, position, validName);

          // Attempt rename with too-long name should be rejected
          await expect(store.rename(bookmark.id, invalidName)).rejects.toThrow();

          // Bookmark should remain unchanged
          const bookmarks = await store.load(bookId);
          const found = bookmarks.find((b) => b.id === bookmark.id);
          expect(found).toBeDefined();
          expect(found!.name).toBe(validName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
