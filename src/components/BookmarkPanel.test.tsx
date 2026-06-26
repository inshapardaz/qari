/**
 * Tests for BookmarkPanel component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    rename: vi.fn().mockResolvedValue({ ...mockBookmark, name: 'Renamed' }),
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
      error: null,
      loading: false,
    },
    themeEngine: null,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: createMockBookmarkStore() as any,
    chapterNavigator: null,
    ...overrides,
  };
}

function renderWithContext(ui: React.ReactElement, context?: ReaderContextValue) {
  const ctx = context || createMockContext();
  return render(
    <ReaderContext.Provider value={ctx}>
      {ui}
    </ReaderContext.Provider>
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

  it('creates a bookmark when form is submitted', async () => {
    const onBookmarkCreate = vi.fn();
    const ctx = createMockContext();
    renderWithContext(<BookmarkPanel onBookmarkCreate={onBookmarkCreate} />, ctx);

    fireEvent.change(screen.getByTestId('bookmark-name-input'), {
      target: { value: 'New Bookmark' },
    });
    fireEvent.click(screen.getByTestId('bookmark-create-btn'));

    await waitFor(() => {
      expect(ctx.bookmarkStore!.create).toHaveBeenCalledWith(
        'book-123',
        'ch-1',
        0,
        'New Bookmark'
      );
    });
  });

  it('emits onBookmarkCreate callback on successful creation', async () => {
    const onBookmarkCreate = vi.fn();
    const ctx = createMockContext();
    renderWithContext(<BookmarkPanel onBookmarkCreate={onBookmarkCreate} />, ctx);

    fireEvent.change(screen.getByTestId('bookmark-name-input'), {
      target: { value: 'New Bookmark' },
    });
    fireEvent.click(screen.getByTestId('bookmark-create-btn'));

    await waitFor(() => {
      expect(onBookmarkCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'created', bookmark: mockBookmark })
      );
    });
  });

  it('shows validation error for empty name', () => {
    renderWithContext(<BookmarkPanel />);
    fireEvent.click(screen.getByTestId('bookmark-create-btn'));
    expect(screen.getByTestId('bookmark-error')).toHaveTextContent('Bookmark name must not be empty.');
  });

  it('shows validation error for name exceeding 100 characters', () => {
    renderWithContext(<BookmarkPanel />);
    const longName = 'a'.repeat(101);
    fireEvent.change(screen.getByTestId('bookmark-name-input'), {
      target: { value: longName },
    });
    fireEvent.click(screen.getByTestId('bookmark-create-btn'));
    expect(screen.getByTestId('bookmark-error')).toHaveTextContent('must not exceed 100 characters');
  });

  it('enters rename mode when rename button is clicked', () => {
    renderWithContext(<BookmarkPanel />);
    fireEvent.click(screen.getByTestId(`bookmark-rename-${mockBookmark.id}`));
    expect(screen.getByTestId('bookmark-edit-input')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-edit-input')).toHaveValue('My Bookmark');
  });

  it('confirms rename on save button click', async () => {
    const ctx = createMockContext();
    renderWithContext(<BookmarkPanel />, ctx);
    fireEvent.click(screen.getByTestId(`bookmark-rename-${mockBookmark.id}`));
    fireEvent.change(screen.getByTestId('bookmark-edit-input'), {
      target: { value: 'Renamed Bookmark' },
    });
    fireEvent.click(screen.getByTestId('bookmark-save-btn'));

    await waitFor(() => {
      expect(ctx.bookmarkStore!.rename).toHaveBeenCalledWith('bm-1', 'Renamed Bookmark');
    });
  });

  it('cancels rename mode', () => {
    renderWithContext(<BookmarkPanel />);
    fireEvent.click(screen.getByTestId(`bookmark-rename-${mockBookmark.id}`));
    fireEvent.click(screen.getByTestId('bookmark-cancel-btn'));
    expect(screen.queryByTestId('bookmark-edit-input')).not.toBeInTheDocument();
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

  it('creates bookmark on Enter key in name input', async () => {
    const ctx = createMockContext();
    renderWithContext(<BookmarkPanel />, ctx);
    const input = screen.getByTestId('bookmark-name-input');
    fireEvent.change(input, { target: { value: 'Enter Bookmark' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(ctx.bookmarkStore!.create).toHaveBeenCalled();
    });
  });

  it('has accessible roles and labels', () => {
    renderWithContext(<BookmarkPanel />);
    expect(screen.getByRole('region', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Bookmark list' })).toBeInTheDocument();
  });
});
