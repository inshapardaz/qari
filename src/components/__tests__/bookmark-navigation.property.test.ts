/**
 * Properties 13-17: BookmarkPanel Filtering and Navigation
 *
 * Property 13: BookmarkPanel Filters by Current Book — verify only current book's bookmarks rendered.
 * Property 14: Bookmark Navigation Resolves to Correct Chapter and Page — verify correct chapter/page from chapterId and position.
 * Property 15: Invalid Chapter Navigation Shows Error — verify error shown and page unchanged for invalid chapterId.
 * Property 16: Position Overflow Clamps to Last Page — verify overflow position navigates to last page.
 * Property 17: Navigation Updates Progress and Fires Callback — verify progress calculation and onPageChange callback.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import * as fc from 'fast-check';

import { BookmarkPanel } from '../BookmarkPanel';
import { ReaderContext, ReaderContextValue } from '../Reader';
import type { Bookmark } from '../../models/bookmark';

/** BookmarkPanel now uses Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => React.createElement(MantineProvider, { env: 'test' }, children),
    ...options,
  });
}
import type { Book, Chapter, ContentNode } from '../../models/book';
import { getChapterCharCount } from '../../services/chapter-navigator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CHARS_PER_PAGE = 1500;

/**
 * Creates a paragraph ContentNode with the specified text content.
 */
function makeParagraph(text: string): ContentNode {
  return {
    type: 'paragraph',
    children: [{ type: 'text', content: text }],
  };
}

/**
 * Creates a chapter with a known character count by filling it with content of a specific length.
 */
function makeChapter(id: string, title: string, order: number, charCount: number): Chapter {
  const content = charCount > 0 ? 'a'.repeat(charCount) : '';
  return {
    id,
    title,
    order,
    content: content.length > 0 ? [makeParagraph(content)] : [],
  };
}

/**
 * Creates a mock BookmarkStore for context.
 */
function createMockBookmarkStore() {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    getNotifications: vi.fn().mockReturnValue([]),
  };
}

/**
 * Creates a mock ReaderContextValue with given overrides.
 */
function createMockContext(
  overrides: Partial<ReaderContextValue['state']> = {},
  contextOverrides: Partial<ReaderContextValue> = {}
): ReaderContextValue {
  return {
    state: {
      book: null,
      currentChapter: 0,
      currentPage: 0,
      totalPages: 5,
      readingProgress: 0,
      zoom: 100,
      direction: 'ltr' as const,
      directionConfidence: 'high' as const,
      preferences: { theme: 'light' as const, fontFamily: 'serif' as const, fontSize: 16 },
      bookmarks: [],
      notes: [],
      error: null,
      loading: false,
      ...overrides,
    },
    themeEngine: null,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: createMockBookmarkStore() as any,
    noteStore: null,
    chapterNavigator: null,
    addBookmark: () => {},
    removeBookmark: () => {},
    updateBookmark: () => {},
    addNote: () => {},
    removeNote: () => {},
    updateNote: () => {},
    ...contextOverrides,
  };
}

/**
 * Renders BookmarkPanel within a ReaderContext.Provider using React.createElement.
 */
function renderWithContext(
  props: Record<string, any>,
  context: ReaderContextValue
) {
  return render(
    React.createElement(
      ReaderContext.Provider,
      { value: context },
      React.createElement(BookmarkPanel, props)
    )
  );
}

// ---------------------------------------------------------------------------
// Property 13: BookmarkPanel Filters by Current Book
// ---------------------------------------------------------------------------

describe('Property 13: BookmarkPanel Filters by Current Book', () => {
  /**
   * **Validates: Requirements 8.1**
   *
   * For any set of bookmarks containing bookmarks for multiple different bookIds,
   * the BookmarkPanel SHALL render only the bookmarks whose `bookId` matches
   * the currently loaded book's identifier.
   */
  it('renders only bookmarks matching current book identifier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),   // number of current-book bookmarks
        fc.integer({ min: 1, max: 5 }),   // number of other-book bookmarks
        (numCurrentBookmarks, numOtherBookmarks) => {
          const currentBookId = 'current-book-id';
          const otherBookId = 'other-book-id';

          const currentBookBookmarks: Bookmark[] = Array.from(
            { length: numCurrentBookmarks },
            (_, i) => ({
              id: `current-bm-${i}`,
              bookId: currentBookId,
              chapterId: 'ch-1',
              position: i * 100,
              name: `Current Bookmark ${i}`,
              createdAt: '2024-01-01T00:00:00Z',
            })
          );

          const otherBookBookmarks: Bookmark[] = Array.from(
            { length: numOtherBookmarks },
            (_, i) => ({
              id: `other-bm-${i}`,
              bookId: otherBookId,
              chapterId: 'ch-x',
              position: i * 50,
              name: `Other Bookmark ${i}`,
              createdAt: '2024-01-01T00:00:00Z',
            })
          );

          const allBookmarks = [...currentBookBookmarks, ...otherBookBookmarks];

          const book: Book = {
            metadata: { title: 'Test Book', identifier: currentBookId },
            chapters: [makeChapter('ch-1', 'Chapter 1', 0, 3000)],
          };

          const ctx = createMockContext({
            book: book as any,
            bookmarks: allBookmarks,
            currentChapter: 0,
          });

          const { unmount } = renderWithContext({}, ctx);

          // Only current book's bookmarks should appear in the list
          for (const bm of currentBookBookmarks) {
            expect(screen.getByTestId(`bookmark-name-${bm.id}`)).toBeInTheDocument();
          }

          // Other book's bookmarks should NOT appear
          for (const bm of otherBookBookmarks) {
            expect(screen.queryByTestId(`bookmark-name-${bm.id}`)).not.toBeInTheDocument();
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: Bookmark Navigation Resolves to Correct Chapter and Page
// ---------------------------------------------------------------------------

describe('Property 14: Bookmark Navigation Resolves to Correct Chapter and Page', () => {
  /**
   * **Validates: Requirements 8.2, 8.3**
   *
   * For any bookmark with a valid chapterId and a position within the chapter's
   * character count, clicking that bookmark SHALL navigate to the correct chapter
   * and page (Math.floor(position / charsPerPage)).
   */
  it('navigates to correct chapter and page for valid positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),      // number of chapters
        fc.integer({ min: 500, max: 8000 }), // chars per chapter
        fc.integer({ min: 100, max: 2000 }), // charsPerPage
        (numChapters, chapterCharCount, charsPerPage) => {
          const bookId = 'nav-book';
          const chapters: Chapter[] = Array.from({ length: numChapters }, (_, i) =>
            makeChapter(`ch-${i}`, `Chapter ${i}`, i, chapterCharCount)
          );

          // Pick the last chapter index to navigate to
          const targetChapterIdx = numChapters - 1;
          const targetChapterId = chapters[targetChapterIdx].id;

          // Pick a position within bounds
          const position = Math.min(chapterCharCount - 1, Math.floor(chapterCharCount / 2));

          const bookmark: Bookmark = {
            id: 'bm-nav',
            bookId,
            chapterId: targetChapterId,
            position,
            name: 'Nav Bookmark',
            createdAt: '2024-01-01T00:00:00Z',
          };

          const book: Book = {
            metadata: { title: 'Nav Test', identifier: bookId },
            chapters,
          };

          const onNavigate = vi.fn();

          const ctx = createMockContext({
            book: book as any,
            bookmarks: [bookmark],
            currentChapter: 0,
          });

          const { unmount } = renderWithContext(
            { onNavigate, charsPerPage },
            ctx
          );

          // Click the bookmark to trigger navigation
          fireEvent.click(screen.getByTestId(`bookmark-name-${bookmark.id}`));

          const expectedPage = Math.floor(position / charsPerPage);

          expect(onNavigate).toHaveBeenCalledTimes(1);
          const [calledChapterIdx, calledPage] = onNavigate.mock.calls[0];
          expect(calledChapterIdx).toBe(targetChapterIdx);
          expect(calledPage).toBe(expectedPage);

          unmount();
          onNavigate.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: Invalid Chapter Navigation Shows Error
// ---------------------------------------------------------------------------

describe('Property 15: Invalid Chapter Navigation Shows Error', () => {
  /**
   * **Validates: Requirements 8.4**
   *
   * For any bookmark whose chapterId does not match any chapter in the currently
   * loaded book, attempting to navigate SHALL leave the current page unchanged
   * and display an error message.
   */
  it('shows error and does not navigate for invalid chapterId', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }),  // invalid chapter id
        fc.integer({ min: 1, max: 4 }),              // number of real chapters
        (invalidChapterId, numChapters) => {
          const bookId = 'error-book';
          const chapters: Chapter[] = Array.from({ length: numChapters }, (_, i) =>
            makeChapter(`valid-ch-${i}`, `Chapter ${i}`, i, 3000)
          );

          // Ensure the invalidChapterId doesn't accidentally match a valid chapter
          const chapterIds = chapters.map((ch) => ch.id);
          if (chapterIds.includes(invalidChapterId)) return;

          const bookmark: Bookmark = {
            id: 'bm-invalid',
            bookId,
            chapterId: invalidChapterId,
            position: 500,
            name: 'Invalid Bookmark',
            createdAt: '2024-01-01T00:00:00Z',
          };

          const book: Book = {
            metadata: { title: 'Error Test', identifier: bookId },
            chapters,
          };

          const onNavigate = vi.fn();
          const onPageChange = vi.fn();

          const ctx = createMockContext({
            book: book as any,
            bookmarks: [bookmark],
            currentChapter: 0,
          });

          const { unmount } = renderWithContext(
            { onNavigate, onPageChange },
            ctx
          );

          // Click the bookmark with invalid chapterId
          fireEvent.click(screen.getByTestId(`bookmark-name-${bookmark.id}`));

          // Should show error
          expect(screen.getByTestId('bookmark-error')).toBeInTheDocument();
          expect(screen.getByTestId('bookmark-error').textContent).toContain('invalid');

          // Should NOT have navigated
          expect(onNavigate).not.toHaveBeenCalled();
          expect(onPageChange).not.toHaveBeenCalled();

          unmount();
          onNavigate.mockClear();
          onPageChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16: Position Overflow Clamps to Last Page
// ---------------------------------------------------------------------------

describe('Property 16: Position Overflow Clamps to Last Page', () => {
  /**
   * **Validates: Requirements 8.5**
   *
   * For any bookmark whose position exceeds the total character count of the
   * target chapter, navigation SHALL resolve to the last page of that chapter
   * (Math.ceil(chapterCharCount / charsPerPage) - 1).
   */
  it('navigates to last page when position exceeds chapter char count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),   // chapter char count
        fc.integer({ min: 1, max: 5000 }),     // overflow amount
        fc.integer({ min: 100, max: 2000 }),   // charsPerPage
        (chapterCharCount, overflowAmount, charsPerPage) => {
          const bookId = 'overflow-book';
          const chapter = makeChapter('ch-overflow', 'Overflow Chapter', 0, chapterCharCount);
          const position = chapterCharCount + overflowAmount; // guaranteed overflow

          const bookmark: Bookmark = {
            id: 'bm-overflow',
            bookId,
            chapterId: 'ch-overflow',
            position,
            name: 'Overflow Bookmark',
            createdAt: '2024-01-01T00:00:00Z',
          };

          const book: Book = {
            metadata: { title: 'Overflow Test', identifier: bookId },
            chapters: [chapter],
          };

          const onNavigate = vi.fn();

          const ctx = createMockContext({
            book: book as any,
            bookmarks: [bookmark],
            currentChapter: 0,
          });

          const { unmount } = renderWithContext(
            { onNavigate, charsPerPage },
            ctx
          );

          fireEvent.click(screen.getByTestId(`bookmark-name-${bookmark.id}`));

          const actualCharCount = getChapterCharCount(chapter);
          const expectedLastPage = Math.ceil(actualCharCount / charsPerPage) - 1;

          expect(onNavigate).toHaveBeenCalledTimes(1);
          const [, calledPage] = onNavigate.mock.calls[0];
          expect(calledPage).toBe(expectedLastPage);

          unmount();
          onNavigate.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 17: Navigation Updates Progress and Fires Callback
// ---------------------------------------------------------------------------

describe('Property 17: Navigation Updates Progress and Fires Callback', () => {
  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * For any successful bookmark navigation, the Reader SHALL update reading progress
   * to Math.round((charsBeforeChapter + min(position, chapterCharCount)) / totalBookChars * 100)
   * clamped to 0-100, and SHALL fire onPageChange with chapter, page, and progress.
   */
  it('fires onPageChange with correct progress for valid navigation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),       // number of chapters
        fc.integer({ min: 500, max: 5000 }),  // chars per chapter (uniform for simplicity)
        fc.integer({ min: 100, max: 2000 }),  // charsPerPage
        fc.integer({ min: 0, max: 3 }),       // target chapter index offset
        (numChapters, chapterCharCount, charsPerPage, targetChapterOffset) => {
          const targetChapterIdx = Math.min(targetChapterOffset, numChapters - 1);
          const bookId = 'progress-book';

          const chapters: Chapter[] = Array.from({ length: numChapters }, (_, i) =>
            makeChapter(`ch-${i}`, `Chapter ${i}`, i, chapterCharCount)
          );

          // Position within bounds of target chapter
          const position = Math.floor(chapterCharCount / 2);

          const bookmark: Bookmark = {
            id: 'bm-progress',
            bookId,
            chapterId: chapters[targetChapterIdx].id,
            position,
            name: 'Progress Bookmark',
            createdAt: '2024-01-01T00:00:00Z',
          };

          const book: Book = {
            metadata: { title: 'Progress Test', identifier: bookId },
            chapters,
          };

          const onPageChange = vi.fn();
          const onNavigate = vi.fn();

          const ctx = createMockContext({
            book: book as any,
            bookmarks: [bookmark],
            currentChapter: 0,
          });

          const { unmount } = renderWithContext(
            { onNavigate, onPageChange, charsPerPage },
            ctx
          );

          fireEvent.click(screen.getByTestId(`bookmark-name-${bookmark.id}`));

          // Calculate expected progress
          let charsBeforeChapter = 0;
          let totalBookChars = 0;
          for (let i = 0; i < chapters.length; i++) {
            const charCount = getChapterCharCount(chapters[i]);
            if (i < targetChapterIdx) {
              charsBeforeChapter += charCount;
            }
            totalBookChars += charCount;
          }

          const effectivePosition = Math.min(position, getChapterCharCount(chapters[targetChapterIdx]));
          const expectedProgress = totalBookChars > 0
            ? Math.round(((charsBeforeChapter + effectivePosition) / totalBookChars) * 100)
            : 0;
          const clampedProgress = Math.max(0, Math.min(100, expectedProgress));

          const expectedPage = Math.floor(position / charsPerPage);

          // Verify onPageChange was called with correct values
          expect(onPageChange).toHaveBeenCalledTimes(1);
          expect(onPageChange).toHaveBeenCalledWith({
            chapter: targetChapterIdx,
            page: expectedPage,
            progress: clampedProgress,
          });

          // Verify onNavigate received same values
          expect(onNavigate).toHaveBeenCalledWith(targetChapterIdx, expectedPage, clampedProgress);

          unmount();
          onPageChange.mockClear();
          onNavigate.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.6, 8.7**
   *
   * For overflow positions, progress uses chapterCharCount as the effective position.
   */
  it('fires onPageChange with clamped progress for overflow positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),       // number of chapters
        fc.integer({ min: 500, max: 5000 }),  // chars per chapter
        fc.integer({ min: 100, max: 2000 }),  // charsPerPage
        fc.integer({ min: 1, max: 5000 }),    // overflow amount
        (numChapters, chapterCharCount, charsPerPage, overflowAmount) => {
          const targetChapterIdx = numChapters - 1;
          const bookId = 'overflow-progress-book';

          const chapters: Chapter[] = Array.from({ length: numChapters }, (_, i) =>
            makeChapter(`ch-${i}`, `Chapter ${i}`, i, chapterCharCount)
          );

          const position = chapterCharCount + overflowAmount; // overflow

          const bookmark: Bookmark = {
            id: 'bm-overflow-progress',
            bookId,
            chapterId: chapters[targetChapterIdx].id,
            position,
            name: 'Overflow Progress',
            createdAt: '2024-01-01T00:00:00Z',
          };

          const book: Book = {
            metadata: { title: 'Overflow Progress Test', identifier: bookId },
            chapters,
          };

          const onPageChange = vi.fn();

          const ctx = createMockContext({
            book: book as any,
            bookmarks: [bookmark],
            currentChapter: 0,
          });

          const { unmount } = renderWithContext(
            { onPageChange, charsPerPage },
            ctx
          );

          fireEvent.click(screen.getByTestId(`bookmark-name-${bookmark.id}`));

          // For overflow, effective position = chapterCharCount
          let charsBeforeChapter = 0;
          let totalBookChars = 0;
          for (let i = 0; i < chapters.length; i++) {
            const charCount = getChapterCharCount(chapters[i]);
            if (i < targetChapterIdx) {
              charsBeforeChapter += charCount;
            }
            totalBookChars += charCount;
          }

          const effectivePosition = getChapterCharCount(chapters[targetChapterIdx]);
          const expectedProgress = totalBookChars > 0
            ? Math.round(((charsBeforeChapter + effectivePosition) / totalBookChars) * 100)
            : 0;
          const clampedProgress = Math.max(0, Math.min(100, expectedProgress));

          const expectedLastPage = Math.ceil(
            getChapterCharCount(chapters[targetChapterIdx]) / charsPerPage
          ) - 1;

          expect(onPageChange).toHaveBeenCalledTimes(1);
          expect(onPageChange).toHaveBeenCalledWith({
            chapter: targetChapterIdx,
            page: expectedLastPage,
            progress: clampedProgress,
          });

          unmount();
          onPageChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });
});
