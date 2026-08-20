/**
 * Tests for BookmarkPanel component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { BookmarkPanel } from './BookmarkPanel';
import { ReaderContext, ReaderContextValue } from './Reader';
import type { Bookmark } from '../models/bookmark';

const mockBookmark: Bookmark = {
  id: 'bm-1',
  bookId: 'book-123',
  chapterId: 'ch-1',
  position: 0,
  name: 'My Bookmark',
  createdAt: '2024-01-01T00:00:00Z',
};

function createMockBookmarkStore() {
  return {
    create: vi.fn().mockResolvedValue(mockBookmark),
    delete: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    getNotifications: vi.fn().mockReturnValue([]),
  };
}

function createMockContext(overrides: Partial<ReaderContextValue> = {}): ReaderContextValue {
  return {
    state: {
      book: {
        metadata: { title: 'Test Book', identifier: 'book-123' },
        chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, content: [] }],
      } as any,
      currentChapter: 0,
      currentPage: 0,
      totalPages: 5,
      readingProgress: 20,
      zoom: 100,
      direction: 'ltr',
      directionConfidence: 'high',
      preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
      bookmarks: [mockBookmark],
      notes: [],
      error: null,
      loading: false,
    },
    themeEngine: null,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: createMockBookmarkStore() as any,
    noteStore: null,
    chapterNavigator: null,
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    addNote: vi.fn(),
    removeNote: vi.fn(),
    updateNote: vi.fn(),
    ...overrides,
  };
}

function renderWithContext(ui: React.ReactElement, context?: ReaderContextValue) {
  const ctx = context || createMockContext();
  return render(
    <MantineProvider env="test">
      <ReaderContext.Provider value={ctx}>
        {ui}
      </ReaderContext.Provider>
    </MantineProvider>
  );
}

describe('BookmarkPanel', () => {
  it('renders the bookmark panel', () => {
    renderWithContext(<BookmarkPanel />);
    expect(screen.getByTestId('bookmark-panel')).toBeInTheDocument();
  });

  it('displays existing bookmarks for the current book', () => {
    renderWithContext(<BookmarkPanel />);
    expect(screen.getByTestId(`bookmark-name-${mockBookmark.id}`)).toHaveTextContent('My Bookmark');
  });

  it("colors the bookmark name with the reading theme, not Mantine's default button color", () => {
    // Regression test: a "subtle"-variant Button's text/hover otherwise come
    // from Mantine's primary/brand color, not the reading theme — jarring
    // against a non-default reading theme (e.g. bright blue text on a calm
    // background). `--reader-fg`/`--reader-surface` are set by ThemeEngine
    // on the reader root, an ancestor of this panel in the real component
    // tree.
    renderWithContext(<BookmarkPanel />);
    const nameBtn = screen.getByTestId(`bookmark-name-${mockBookmark.id}`);
    expect(nameBtn).toHaveStyle({ color: 'var(--reader-fg, #1a1a1a)' });
    expect(nameBtn.style.getPropertyValue('--button-hover')).toBe('var(--reader-surface, #f5f5f5)');
  });

  it('shows empty message when no bookmarks exist', () => {
    const ctx = createMockContext({
      state: {
        ...createMockContext().state,
        bookmarks: [],
      },
    });
    renderWithContext(<BookmarkPanel />, ctx);
    expect(screen.getByTestId('bookmark-empty')).toHaveTextContent('No bookmarks yet.');
  });

  it('does not render an add/create bookmark control — creation happens via the reader header toggle only', () => {
    renderWithContext(<BookmarkPanel />);
    expect(screen.queryByTestId('bookmark-create-btn')).not.toBeInTheDocument();
  });

  it('deletes a bookmark when delete button is clicked', async () => {
    const ctx = createMockContext();
    renderWithContext(<BookmarkPanel />, ctx);
    fireEvent.click(screen.getByTestId(`bookmark-delete-${mockBookmark.id}`));

    await waitFor(() => {
      expect(ctx.bookmarkStore!.delete).toHaveBeenCalledWith('bm-1');
    });
  });

  it('calls onBookmarkSelect when a bookmark name is clicked', () => {
    const onBookmarkSelect = vi.fn();
    renderWithContext(<BookmarkPanel onBookmarkSelect={onBookmarkSelect} />);
    fireEvent.click(screen.getByTestId(`bookmark-name-${mockBookmark.id}`));
    expect(onBookmarkSelect).toHaveBeenCalledWith(mockBookmark);
  });

  it('has accessible roles and labels', () => {
    renderWithContext(<BookmarkPanel />);
    expect(screen.getByRole('region', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Bookmark list' })).toBeInTheDocument();
  });
});


describe('BookmarkPanel navigation', () => {
  const charsPerPage = 1500;

  function makeChapterWithContent(id: string, title: string, charCount: number) {
    return {
      id,
      title,
      order: 0,
      content: [
        {
          type: 'paragraph' as const,
          children: [{ type: 'text' as const, content: 'a'.repeat(charCount) }],
        },
      ],
    };
  }

  function createNavContext(overrides: Partial<ReaderContextValue> = {}): ReaderContextValue {
    const chapters = [
      makeChapterWithContent('ch-1', 'Chapter 1', 4500), // 3 pages (0,1,2)
      makeChapterWithContent('ch-2', 'Chapter 2', 3000), // 2 pages (0,1)
    ];

    return {
      state: {
        book: {
          metadata: { title: 'Nav Test Book', identifier: 'book-nav' },
          chapters,
        } as any,
        currentChapter: 0,
        currentPage: 0,
        totalPages: 5,
        readingProgress: 0,
        zoom: 100,
        direction: 'ltr',
        directionConfidence: 'high',
        preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
        bookmarks: [
          {
            id: 'bm-nav-1',
            bookId: 'book-nav',
            chapterId: 'ch-2',
            position: 1600,
            name: 'Valid Bookmark',
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'bm-nav-invalid',
            bookId: 'book-nav',
            chapterId: 'ch-missing',
            position: 500,
            name: 'Invalid Chapter Bookmark',
            createdAt: '2024-01-02T00:00:00Z',
          },
          {
            id: 'bm-nav-overflow',
            bookId: 'book-nav',
            chapterId: 'ch-1',
            position: 9999,
            name: 'Overflow Bookmark',
            createdAt: '2024-01-03T00:00:00Z',
          },
          {
            id: 'bm-nav-progress',
            bookId: 'book-nav',
            chapterId: 'ch-1',
            position: 3000,
            name: 'Progress Bookmark',
            createdAt: '2024-01-04T00:00:00Z',
          },
        ],
        notes: [],
        error: null,
        loading: false,
      },
      themeEngine: null,
      directionDetector: {} as any,
      dictionaryService: {} as any,
      bookmarkStore: createMockBookmarkStore() as any,
      noteStore: null,
      chapterNavigator: null,
      addBookmark: vi.fn(),
      removeBookmark: vi.fn(),
      updateBookmark: vi.fn(),
      addNote: vi.fn(),
      removeNote: vi.fn(),
      updateNote: vi.fn(),
      ...overrides,
    };
  }

  it('navigates to correct chapter and page when a valid bookmark is clicked', () => {
    const onNavigate = vi.fn();
    const ctx = createNavContext();

    renderWithContext(
      <BookmarkPanel onNavigate={onNavigate} charsPerPage={charsPerPage} />,
      ctx
    );

    // Bookmark bm-nav-1: chapterId='ch-2', position=1600
    // ch-2 is at index 1. Page = Math.floor(1600 / 1500) = 1
    fireEvent.click(screen.getByTestId('bookmark-name-bm-nav-1'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    const [chapterIdx, page] = onNavigate.mock.calls[0];
    expect(chapterIdx).toBe(1); // ch-2 is at index 1
    expect(page).toBe(1); // Math.floor(1600 / 1500) = 1
  });

  it('shows error when bookmark chapterId is not found in the current book', () => {
    const onNavigate = vi.fn();
    const ctx = createNavContext();

    renderWithContext(
      <BookmarkPanel onNavigate={onNavigate} charsPerPage={charsPerPage} />,
      ctx
    );

    // Bookmark bm-nav-invalid: chapterId='ch-missing' which doesn't exist
    fireEvent.click(screen.getByTestId('bookmark-name-bm-nav-invalid'));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('bookmark-error')).toHaveTextContent(
      'Bookmark target is invalid: chapter not found in current book.'
    );
  });

  it('navigates to last page when bookmark position exceeds chapter char count', () => {
    const onNavigate = vi.fn();
    const ctx = createNavContext();

    renderWithContext(
      <BookmarkPanel onNavigate={onNavigate} charsPerPage={charsPerPage} />,
      ctx
    );

    // Bookmark bm-nav-overflow: chapterId='ch-1', position=9999
    // ch-1 has 4500 chars. 9999 > 4500, so navigate to last page.
    // Last page = Math.ceil(4500 / 1500) - 1 = 3 - 1 = 2
    fireEvent.click(screen.getByTestId('bookmark-name-bm-nav-overflow'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    const [chapterIdx, page] = onNavigate.mock.calls[0];
    expect(chapterIdx).toBe(0); // ch-1 is at index 0
    expect(page).toBe(2); // last page: Math.ceil(4500/1500) - 1 = 2
  });

  it('calculates correct progress for a specific bookmark position', () => {
    const onNavigate = vi.fn();
    const onPageChange = vi.fn();
    const ctx = createNavContext();

    renderWithContext(
      <BookmarkPanel
        onNavigate={onNavigate}
        onPageChange={onPageChange}
        charsPerPage={charsPerPage}
      />,
      ctx
    );

    // Bookmark bm-nav-progress: chapterId='ch-1' (index 0), position=3000
    // Total book chars: 4500 + 3000 = 7500
    // Chars before ch-1 = 0
    // Effective position = min(3000, 4500) = 3000
    // Progress = Math.round((0 + 3000) / 7500 * 100) = Math.round(40) = 40
    // Page = Math.floor(3000 / 1500) = 2
    fireEvent.click(screen.getByTestId('bookmark-name-bm-nav-progress'));

    expect(onNavigate).toHaveBeenCalledWith(0, 2, 40);
    expect(onPageChange).toHaveBeenCalledWith({
      chapter: 0,
      page: 2,
      progress: 40,
    });
  });

  it('fires onPageChange with correct values on valid navigation', () => {
    const onPageChange = vi.fn();
    const ctx = createNavContext();

    renderWithContext(
      <BookmarkPanel onPageChange={onPageChange} charsPerPage={charsPerPage} />,
      ctx
    );

    // Bookmark bm-nav-1: chapterId='ch-2' (index 1), position=1600
    // Total book chars: 4500 + 3000 = 7500
    // Chars before ch-2 = 4500
    // Effective position = min(1600, 3000) = 1600
    // Progress = Math.round((4500 + 1600) / 7500 * 100) = Math.round(81.33) = 81
    // Page = Math.floor(1600 / 1500) = 1
    fireEvent.click(screen.getByTestId('bookmark-name-bm-nav-1'));

    expect(onPageChange).toHaveBeenCalledWith({
      chapter: 1,
      page: 1,
      progress: 81,
    });
  });
});
