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
import { render, waitFor, act, fireEvent, within } from '@testing-library/react';
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
 *
 * `bookId` is fixed to `''` (not fuzzed) because `BookmarkPanel` only
 * displays bookmarks whose `bookId` matches the currently loaded book's
 * `metadata.identifier`, which `MarkdownParserImpl` leaves unset (so it
 * resolves to `''`). A fuzzed `bookId` would almost never match, and the
 * panel would filter every generated bookmark out regardless of whether the
 * Reader's own prop-sync logic is working correctly.
 */
const arbBookmark: fc.Arbitrary<Bookmark> = fc.record({
  id: fc.uuid(),
  bookId: fc.constant(''),
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
 * Reads which bookmarks are actually displayed by opening the bookmarks
 * popover and reading `BookmarkPanel`'s rendered `bookmark-item-<id>`
 * elements — i.e. verifying through the real UI rather than React fiber
 * internals (which are an implementation detail liable to break with every
 * unrelated rendering change, e.g. how many passes Mantine's popovers take
 * to settle).
 */
function getDisplayedBookmarkIds(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="bookmark-item-"]')).map((el) =>
    el.getAttribute('data-testid')!.replace('bookmark-item-', '')
  );
}

function openBookmarksPanel(container: HTMLElement): void {
  fireEvent.click(within(container).getByRole('button', { name: 'Bookmarks' }));
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

        // getDisplayedBookmarkIds() queries the whole document (BookmarkPanel
        // renders in a Mantine Popover portal, outside `container`), so every
        // iteration MUST unmount — including on assertion failure — or a
        // leaked Reader instance's bookmark items leak into every later
        // iteration's DOM query and cascade into unrelated failures.
        try {
          await waitFor(() => {
            expect(container.querySelector('[data-testid="reader-content"]')).not.toBeNull();
          });
          openBookmarksPanel(container);

          await waitFor(() => {
            expect(getDisplayedBookmarkIds().sort()).toEqual(bookmarks.map((b) => b.id).sort());
          });
        } finally {
          unmount();
        }
      }),
      // Each run opens a real Mantine Popover (portal + floating-ui
      // positioning), which is far more expensive than a plain render;
      // 15 runs is still a meaningful spread of array sizes/contents
      // without the file taking minutes to complete under parallel
      // test-worker CPU contention.
      { numRuns: 15 }
    );
  }, 45000);

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

        // See the note in the previous test: unmount must always run, even
        // on assertion failure, or leaked bookmark items from this iteration
        // pollute every subsequent iteration's document-wide DOM query.
        try {
          await waitFor(() => {
            expect(container.querySelector('[data-testid="reader-content"]')).not.toBeNull();
          });
          openBookmarksPanel(container);

          // Wait for the initially-opened panel to show the initial bookmarks
          await waitFor(() => {
            expect(getDisplayedBookmarkIds().sort()).toEqual(initial.map((b) => b.id).sort());
          });

          // Rerender with updated bookmarks prop — the popover stays open and
          // should reactively reflect the new list without reopening it.
          await act(async () => {
            rerender(React.createElement(Reader, { source, bookmarks: updated }));
          });

          await waitFor(() => {
            expect(getDisplayedBookmarkIds().sort()).toEqual(updated.map((b) => b.id).sort());
          });
        } finally {
          unmount();
        }
      }),
      // Two Popover interactions per run (open, then react to a rerender);
      // keep this affordable the same way as the test above.
      { numRuns: 15 }
    );
  }, 45000);
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
  }, 20000);

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
