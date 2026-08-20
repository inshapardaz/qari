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
    updateComment: vi.fn().mockImplementation((id: string, comment: string) =>
      Promise.resolve({ ...mockNote, id, comment, updatedAt: '2024-02-01T00:00:00Z' })),
    updateColor: vi.fn().mockImplementation((id: string, color: string) =>
      Promise.resolve({ ...mockNote, id, color, updatedAt: '2024-02-01T00:00:00Z' })),
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
    expect(screen.getByTestId(`note-comment-${mockNote.id}`)).toHaveTextContent('my thoughts');
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

  it("colors the edit (comment) button with the reading theme, not Mantine's default primary color", () => {
    // Same regression as the excerpt button above, for the ✎ edit toggle:
    // a "filled"/"subtle" ActionIcon otherwise falls back to Mantine's own
    // primary/brand color and dimmed gray rather than the reading theme.
    renderWithContext(<NotePanel />);
    const editBtn = screen.getByTestId(`note-edit-${mockNote.id}`);
    expect(editBtn).toHaveStyle({ color: 'var(--reader-fg, #1a1a1a)' });

    fireEvent.click(editBtn);
    expect(editBtn).toHaveStyle({
      backgroundColor: 'var(--reader-fg, #1a1a1a)',
      color: 'var(--reader-bg, #ffffff)',
    });
  });

  it("colors the comment editor's Save/Cancel buttons with the reading theme, not Mantine's default primary blue", () => {
    renderWithContext(<NotePanel />);
    fireEvent.click(screen.getByTestId(`note-edit-${mockNote.id}`));

    expect(screen.getByTestId(`note-save-${mockNote.id}`)).toHaveStyle({
      backgroundColor: 'var(--reader-accent, #0071e3)',
      color: 'var(--reader-bg, #ffffff)',
    });
    expect(screen.getByTestId(`note-cancel-${mockNote.id}`)).toHaveStyle({
      color: 'var(--reader-fg, #1a1a1a)',
    });
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

  describe('editing a note comment', () => {
    it('opens the comment editor with the current comment prefilled', () => {
      renderWithContext(<NotePanel />);
      fireEvent.click(screen.getByTestId(`note-edit-${mockNote.id}`));

      const input = screen.getByTestId(`note-comment-input-${mockNote.id}`) as HTMLTextAreaElement;
      expect(input.value).toBe('my thoughts');
    });

    it('saves an edited comment via noteStore.updateComment and syncs it into state', async () => {
      const ctx = createMockContext();
      renderWithContext(<NotePanel />, ctx);

      fireEvent.click(screen.getByTestId(`note-edit-${mockNote.id}`));
      fireEvent.change(screen.getByTestId(`note-comment-input-${mockNote.id}`), {
        target: { value: 'a new thought' },
      });
      fireEvent.click(screen.getByTestId(`note-save-${mockNote.id}`));

      await waitFor(() => {
        expect(ctx.noteStore!.updateComment).toHaveBeenCalledWith('note-1', 'a new thought');
      });
      expect(ctx.updateNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1', comment: 'a new thought' }));
    });

    it('discards the draft and closes the editor on cancel', () => {
      const ctx = createMockContext();
      renderWithContext(<NotePanel />, ctx);

      fireEvent.click(screen.getByTestId(`note-edit-${mockNote.id}`));
      fireEvent.change(screen.getByTestId(`note-comment-input-${mockNote.id}`), {
        target: { value: 'discarded' },
      });
      fireEvent.click(screen.getByTestId(`note-cancel-${mockNote.id}`));

      expect(screen.queryByTestId(`note-comment-input-${mockNote.id}`)).not.toBeInTheDocument();
      expect(ctx.noteStore!.updateComment).not.toHaveBeenCalled();
      expect(screen.getByTestId(`note-comment-${mockNote.id}`)).toHaveTextContent('my thoughts');
    });
  });

  describe('highlight color', () => {
    it('marks the note\'s current color as pressed among the swatches, defaulting to yellow', () => {
      renderWithContext(<NotePanel />);
      expect(screen.getByTestId(`note-color-${mockNote.id}-yellow`)).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId(`note-color-${mockNote.id}-blue`)).toHaveAttribute('aria-pressed', 'false');
    });

    it('changes color via noteStore.updateColor and syncs it into state', async () => {
      const ctx = createMockContext();
      renderWithContext(<NotePanel />, ctx);

      fireEvent.click(screen.getByTestId(`note-color-${mockNote.id}-blue`));

      await waitFor(() => {
        expect(ctx.noteStore!.updateColor).toHaveBeenCalledWith('note-1', 'blue');
      });
      expect(ctx.updateNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-1', color: 'blue' }));
    });
  });
});
