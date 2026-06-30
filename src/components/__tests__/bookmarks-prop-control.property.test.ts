/**
 * Properties 11-12: Bookmarks Prop Controls Display & Skips Store Load
 *
 * Property 11: For any Bookmark array passed as the `bookmarks` prop, the
 * displayed bookmark collection SHALL equal the prop value, and when the prop
 * reference changes, the displayed collection SHALL update to match.
 *
 * Property 12: For any Reader render where the `bookmarks` prop is defined
 * (including an empty array), the configured bookmarkStore's `load` method
 * SHALL NOT be invoked during book initialization.
 *
 * **Validates: Requirements 5.2, 5.5, 5.6, 6.1, 6.2**
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import * as fc from 'fast-check';

import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';
import type { Bookmark } from '../../models/bookmark';
import type { BookmarkStoreInterface } from '../../interfaces/bookmark-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMarkdownSource(content = '# Test\n\n## Chapter 1\n\nHello'): ReaderSource {
  return { type: 'markdown', content };
}

/**
 * Arbitrary for generating valid Bookmark objects.
 */
const arbBookmark: fc.Arbitrary<Bookmark> = fc.record({
  id: fc.uuid(),
  bookId: fc.string({ minLength: 1, maxLength: 20 }),
  chapterId: fc.string({ minLength: 1, maxLength: 20 }),
  position: fc.nat({ max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }).map(d => d.toISOString()),
});

/**
 * Arbitrary for generating arrays of bookmarks (0-10 items).
 */
const arbBookmarkArray = fc.array(arbBookmark, { minLength: 0, maxLength: 10 });

/**
 * Creates a mock BookmarkStoreInterface with spied methods.
 */
function createMockStore(): BookmarkStoreInterface & { load: ReturnType<typeof vi.fn> } {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Reads the Reader component's internal bookmarks state from the React fiber tree.
 * Uses the fiber alternate (work-in-progress tree) for the most current committed state.
 */
function getBookmarksFromFiber(container: HTMLElement): Bookmark[] | null {
  const el = container.querySelector('[data-testid="reader-content"]');
  if (!el) return null;

  const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
  if (!fiberKey) return null;

  let fiber = (el as any)[fiberKey];
  while (fiber) {
    if (fiber.type === Reader) {
      // Use alternate (most recent committed state) when available
      const target = fiber.alternate || fiber;
      const state = target.memoizedState?.memoizedState;
      if (state && 'bookmarks' in state) return state.bookmarks;
      // Fallback to current fiber
      const state2 = fiber.memoizedState?.memoizedState;
      if (state2 && 'bookmarks' in state2) return state2.bookmarks;
    }
    fiber = fiber.return;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 11: Bookmarks Prop Controls Display', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 5.2, 6.1, 6.2**
   *
   * For any bookmark array passed as the `bookmarks` prop, the Reader's
   * internal displayed collection SHALL equal that prop value.
   */
  it('displayed bookmarks equal the prop value for any bookmark array', async () => {
    await fc.assert(
      fc.asyncProperty(arbBookmarkArray, async (bookmarks) => {
        const source = createMarkdownSource();

        const { container, unmount } = render(
          React.createElement(Reader, { source, bookmarks })
        );

        // Wait for state to settle with the correct bookmarks
        await waitFor(() => {
          const displayed = getBookmarksFromFiber(container);
          expect(displayed).toEqual(bookmarks);
        });

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.6, 6.2**
   *
   * When the bookmarks prop reference changes to a new array, the displayed
   * collection SHALL update to match the new value.
   */
  it('prop change updates the displayed collection', async () => {
    await fc.assert(
      fc.asyncProperty(arbBookmarkArray, arbBookmarkArray, async (initial, updated) => {
        const source = createMarkdownSource();

        const { container, rerender, unmount } = render(
          React.createElement(Reader, { source, bookmarks: initial })
        );

        // Wait for initial bookmarks to appear in state
        await waitFor(() => {
          expect(getBookmarksFromFiber(container)).toEqual(initial);
        });

        // Rerender with updated bookmarks prop
        await act(async () => {
          rerender(React.createElement(Reader, { source, bookmarks: updated }));
        });

        // State should reflect the new prop value
        await waitFor(() => {
          expect(getBookmarksFromFiber(container)).toEqual(updated);
        });

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 12: Bookmarks Prop Skips Store Load', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * When the `bookmarks` prop is defined (including empty array), the
   * configured bookmarkStore's `load` method SHALL NOT be invoked.
   */
  it('store.load is NOT called when bookmarks prop is defined', async () => {
    await fc.assert(
      fc.asyncProperty(arbBookmarkArray, async (bookmarks) => {
        const mockStore = createMockStore();
        const source = createMarkdownSource();

        const { unmount } = render(
          React.createElement(Reader, {
            source,
            bookmarks,
            bookmarkStore: mockStore,
          })
        );

        // Wait for the book to finish loading
        await waitFor(() => {
          expect(document.querySelector('[data-testid="reader-content"]')).not.toBeNull();
        });

        // Store load must NOT have been called
        expect(mockStore.load).not.toHaveBeenCalled();

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.5**
   *
   * Even with an empty bookmarks array prop, store.load is skipped.
   */
  it('store.load is NOT called when bookmarks prop is an empty array', async () => {
    const mockStore = createMockStore();
    const source = createMarkdownSource();

    const { unmount } = render(
      React.createElement(Reader, {
        source,
        bookmarks: [],
        bookmarkStore: mockStore,
      })
    );

    await waitFor(() => {
      expect(document.querySelector('[data-testid="reader-content"]')).not.toBeNull();
    });

    expect(mockStore.load).not.toHaveBeenCalled();

    unmount();
  });
});
