/**
 * Tests for NotePanel component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { NotePanel } from './NotePanel';
import { ReaderContext, ReaderContextValue } from './Reader';
import type { Note } from '../models/note';

const mockNote: Note = {
  id: 'note-1',
  bookId: 'book-123',
  chapterId: 'ch-1',
  startOffset: 10,
  endOffset: 25,
  text: 'a highlighted passage',
  comment: 'my thoughts',
  createdAt: '2024-01-01T00:00:00Z',
};

function createMockNoteStore() {
  return {
    create: vi.fn(),
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
      bookmarks: [],
      notes: [mockNote],
      error: null,
      loading: false,
    },
    themeEngine: null,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: null,
    noteStore: createMockNoteStore() as any,
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

describe('NotePanel', () => {
  it('renders the note panel', () => {
    renderWithContext(<NotePanel />);
    expect(screen.getByTestId('note-panel')).toBeInTheDocument();
  });

  it('displays existing notes for the current book, with their excerpt and comment', () => {
    renderWithContext(<NotePanel />);
    expect(screen.getByTestId(`note-excerpt-${mockNote.id}`)).toHaveTextContent('a highlighted passage');
    expect(screen.getByTestId(`note-excerpt-${mockNote.id}`)).toHaveTextContent('my thoughts');
  });

  it("colors the note excerpt with the reading theme, not Mantine's default button color", () => {
    // Regression test: a "subtle"-variant Button's text/hover otherwise come
    // from Mantine's primary/brand color, not the reading theme — jarring
    // against a non-default reading theme (e.g. bright blue text on a sepia
    // background). `--reader-fg`/`--reader-surface` are set by ThemeEngine
    // on the reader root, an ancestor of this panel in the real component
    // tree.
    renderWithContext(<NotePanel />);
    const excerptBtn = screen.getByTestId(`note-excerpt-${mockNote.id}`);
    expect(excerptBtn).toHaveStyle({ color: 'var(--reader-fg, #1a1a1a)' });
    expect(excerptBtn.style.getPropertyValue('--button-hover')).toBe('var(--reader-surface, #f5f5f5)');
  });

  it('shows empty message when no notes exist', () => {
    const ctx = createMockContext({
      state: { ...createMockContext().state, notes: [] },
    });
    renderWithContext(<NotePanel />, ctx);
    expect(screen.getByTestId('note-empty')).toBeInTheDocument();
  });

  it('only shows notes belonging to the current book', () => {
    const ctx = createMockContext({
      state: {
        ...createMockContext().state,
        notes: [mockNote, { ...mockNote, id: 'note-other-book', bookId: 'other-book' }],
      },
    });
    renderWithContext(<NotePanel />, ctx);
    expect(screen.getByTestId(`note-excerpt-${mockNote.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId('note-excerpt-note-other-book')).not.toBeInTheDocument();
  });

  it('deletes a note when the delete button is clicked', async () => {
    const ctx = createMockContext();
    renderWithContext(<NotePanel />, ctx);
    fireEvent.click(screen.getByTestId(`note-delete-${mockNote.id}`));

    await waitFor(() => {
      expect(ctx.noteStore!.delete).toHaveBeenCalledWith('note-1');
    });
    expect(ctx.removeNote).toHaveBeenCalledWith('note-1');
  });

  it('calls onNavigate/onPageChange with the resolved chapter and page when a note excerpt is clicked', () => {
    const onNavigate = vi.fn();
    const onPageChange = vi.fn();
    renderWithContext(<NotePanel onNavigate={onNavigate} onPageChange={onPageChange} charsPerPage={1500} />);

    fireEvent.click(screen.getByTestId(`note-excerpt-${mockNote.id}`));

    // startOffset=10, charsPerPage=1500 -> page 0
    expect(onNavigate).toHaveBeenCalledWith(0, 0, expect.any(Number));
    expect(onPageChange).toHaveBeenCalledWith(expect.objectContaining({ chapter: 0, page: 0 }));
  });

  it('shows an error when a note references a chapter no longer in the book', () => {
    const ctx = createMockContext({
      state: {
        ...createMockContext().state,
        notes: [{ ...mockNote, chapterId: 'ch-missing' }],
      },
    });
    renderWithContext(<NotePanel />, ctx);
    fireEvent.click(screen.getByTestId(`note-excerpt-${mockNote.id}`));
    expect(screen.getByTestId('note-error')).toBeInTheDocument();
  });

  it('has accessible roles and labels', () => {
    renderWithContext(<NotePanel />);
    expect(screen.getByRole('region', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Note list' })).toBeInTheDocument();
  });
});
