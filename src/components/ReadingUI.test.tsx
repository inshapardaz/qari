/**
 * Unit tests for the reading UI components:
 * - ChapterIndex: table of contents panel
 * - PageNavigation: next/previous controls with RTL support
 * - ProgressBar: reading progress display with direction override
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderContext, ReaderContextValue } from './Reader';
import { ChapterIndex } from './ChapterIndex';
import { PageNavigation } from './PageNavigation';
import { ProgressBar } from './ProgressBar';
import type { ReaderState } from '../models/reader-state';
import type { Book } from '../models/book';
import { ChapterNavigator } from '../services/chapter-navigator';
import { DefaultDirectionDetector } from '../services/direction-detector';
import { DictionaryService } from '../services/dictionary-service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMultiChapterBook(): Book {
  return {
    metadata: { title: 'Test Book', author: 'Author' },
    chapters: [
      {
        id: 'ch-1',
        title: 'Introduction',
        order: 0,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'A'.repeat(3000) }] },
        ],
      },
      {
        id: 'ch-2',
        title: 'Chapter One',
        order: 1,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'B'.repeat(3000) }] },
        ],
      },
      {
        id: 'ch-3',
        title: 'Chapter Two',
        order: 2,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'C'.repeat(3000) }] },
        ],
      },
    ],
  };
}

function createSingleChapterBook(): Book {
  return {
    metadata: { title: 'Single Chapter' },
    chapters: [
      {
        id: 'ch-only',
        title: 'Only Chapter',
        order: 0,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'Hello world' }] },
        ],
      },
    ],
  };
}

function createLTRState(book: Book): ReaderState {
  return {
    book,
    currentChapter: 0,
    currentPage: 0,
    totalPages: 2,
    readingProgress: 15,
    zoom: 100,
    direction: 'ltr',
    directionConfidence: 'high',
    preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
    bookmarks: [],
    error: null,
    loading: false,
  };
}

function createRTLState(book: Book): ReaderState {
  return {
    ...createLTRState(book),
    direction: 'rtl',
    directionConfidence: 'high',
  };
}

function createLowConfidenceState(book: Book): ReaderState {
  return {
    ...createLTRState(book),
    direction: 'rtl',
    directionConfidence: 'low',
  };
}

function renderWithContext(
  ui: React.ReactElement,
  contextOverrides: Partial<ReaderContextValue> = {},
  book: Book = createMultiChapterBook()
) {
  const navigator = new ChapterNavigator(book);
  const state = contextOverrides.state ?? createLTRState(book);

  const contextValue: ReaderContextValue = {
    state,
    themeEngine: null,
    directionDetector: new DefaultDirectionDetector(),
    dictionaryService: new DictionaryService(),
    bookmarkStore: null,
    chapterNavigator: navigator,
    addBookmark: () => {},
    removeBookmark: () => {},
    updateBookmark: () => {},
    ...contextOverrides,
  };

  return render(
    <ReaderContext.Provider value={contextValue}>
      {ui}
    </ReaderContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// ChapterIndex Tests
// ---------------------------------------------------------------------------

describe('ChapterIndex', () => {
  it('renders a list of chapters', () => {
    renderWithContext(<ChapterIndex />);

    expect(screen.getByTestId('chapter-index')).toBeDefined();
    expect(screen.getByTestId('chapter-item-0')).toBeDefined();
    expect(screen.getByTestId('chapter-item-1')).toBeDefined();
    expect(screen.getByTestId('chapter-item-2')).toBeDefined();
  });

  it('displays chapter titles', () => {
    renderWithContext(<ChapterIndex />);

    expect(screen.getByText('Introduction')).toBeDefined();
    expect(screen.getByText('Chapter One')).toBeDefined();
    expect(screen.getByText('Chapter Two')).toBeDefined();
  });

  it('highlights the current chapter', () => {
    const book = createMultiChapterBook();
    const state = createLTRState(book);
    state.currentChapter = 1;

    renderWithContext(<ChapterIndex />, { state });

    const items = screen.getByTestId('chapter-item-1').closest('li');
    expect(items?.getAttribute('aria-current')).toBe('true');
  });

  it('calls onChapterSelect when a chapter is clicked', () => {
    const onChapterSelect = vi.fn();
    renderWithContext(<ChapterIndex onChapterSelect={onChapterSelect} />);

    fireEvent.click(screen.getByTestId('chapter-item-2'));
    expect(onChapterSelect).toHaveBeenCalledWith(2);
  });

  it('returns null for single-chapter books (no chapter structure)', () => {
    const book = createSingleChapterBook();
    const { container } = renderWithContext(<ChapterIndex />, {}, book);

    expect(container.querySelector('[data-testid="chapter-index"]')).toBeNull();
  });

  it('applies RTL direction attribute', () => {
    const book = createMultiChapterBook();
    const state = createRTLState(book);

    renderWithContext(<ChapterIndex />, { state });

    const nav = screen.getByTestId('chapter-index');
    expect(nav.getAttribute('dir')).toBe('rtl');
  });

  it('has accessible role and label', () => {
    renderWithContext(<ChapterIndex />);

    const nav = screen.getByRole('navigation', { name: 'Table of contents' });
    expect(nav).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PageNavigation Tests
// ---------------------------------------------------------------------------

describe('PageNavigation', () => {
  it('renders navigation buttons', () => {
    renderWithContext(<PageNavigation />);

    expect(screen.getByTestId('page-navigation')).toBeDefined();
    expect(screen.getByTestId('nav-previous')).toBeDefined();
    expect(screen.getByTestId('nav-next')).toBeDefined();
  });

  it('displays page indicator', () => {
    renderWithContext(<PageNavigation />);

    expect(screen.getByTestId('page-indicator').textContent).toBe('1 / 2');
  });

  it('calls onPageChange with updated state when next is clicked', () => {
    const onPageChange = vi.fn();
    renderWithContext(<PageNavigation onPageChange={onPageChange} />);

    fireEvent.click(screen.getByTestId('nav-next'));
    expect(onPageChange).toHaveBeenCalledWith(
      expect.objectContaining({
        chapter: expect.any(Number),
        page: expect.any(Number),
        progress: expect.any(Number),
      })
    );
  });

  it('calls onPageChange when previous is clicked', () => {
    const onPageChange = vi.fn();
    const book = createMultiChapterBook();
    const navigator = new ChapterNavigator(book);
    navigator.nextPage(); // move to page 1

    const state = createLTRState(book);
    state.currentPage = 1;

    renderWithContext(<PageNavigation onPageChange={onPageChange} />, {
      state,
      chapterNavigator: navigator,
    });

    fireEvent.click(screen.getByTestId('nav-previous'));
    expect(onPageChange).toHaveBeenCalled();
  });

  it('swaps button positions in RTL mode', () => {
    const book = createMultiChapterBook();
    const state = createRTLState(book);

    renderWithContext(<PageNavigation />, { state });

    // In RTL, the left button should be "Next page"
    const leftButton = screen.getByTestId('nav-next');
    expect(leftButton.getAttribute('aria-label')).toBe('Next page');

    // The right button should be "Previous page"
    const rightButton = screen.getByTestId('nav-previous');
    expect(rightButton.getAttribute('aria-label')).toBe('Previous page');
  });

  it('applies dir attribute based on state direction', () => {
    const book = createMultiChapterBook();
    const state = createRTLState(book);

    renderWithContext(<PageNavigation />, { state });

    const nav = screen.getByTestId('page-navigation');
    expect(nav.getAttribute('dir')).toBe('rtl');
  });

  it('returns null when no chapterNavigator is available', () => {
    const book = createMultiChapterBook();
    const state = createLTRState(book);

    const { container } = render(
      <ReaderContext.Provider
        value={{
          state,
          themeEngine: null,
          directionDetector: new DefaultDirectionDetector(),
          dictionaryService: new DictionaryService(),
          bookmarkStore: null,
          chapterNavigator: null,
          addBookmark: () => {},
          removeBookmark: () => {},
          updateBookmark: () => {},
        }}
      >
        <PageNavigation />
      </ReaderContext.Provider>
    );

    expect(container.querySelector('[data-testid="page-navigation"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProgressBar Tests
// ---------------------------------------------------------------------------

describe('ProgressBar', () => {
  it('displays reading progress percentage', () => {
    renderWithContext(<ProgressBar />);

    expect(screen.getByTestId('progress-text').textContent).toBe('15%');
  });

  it('displays current chapter title', () => {
    renderWithContext(<ProgressBar />);

    expect(screen.getByTestId('progress-chapter-title').textContent).toBe('Introduction');
  });

  it('renders a progress bar with correct aria attributes', () => {
    renderWithContext(<ProgressBar />);

    const bar = screen.getByTestId('progress-bar');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('15');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('shows progress bar fill width matching progress percentage', () => {
    renderWithContext(<ProgressBar />);

    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.style.width).toBe('15%');
  });

  it('includes a direction toggle button', () => {
    renderWithContext(<ProgressBar />);

    const toggle = screen.getByTestId('direction-toggle');
    expect(toggle).toBeDefined();
    expect(toggle.getAttribute('aria-label')).toBe('Switch to RTL direction');
  });

  it('calls onDirectionChange when direction toggle is clicked', () => {
    const onDirectionChange = vi.fn();
    renderWithContext(<ProgressBar onDirectionChange={onDirectionChange} />);

    fireEvent.click(screen.getByTestId('direction-toggle'));
    expect(onDirectionChange).toHaveBeenCalledWith('rtl');
  });

  it('shows direction prompt when confidence is low', () => {
    const book = createMultiChapterBook();
    const state = createLowConfidenceState(book);

    renderWithContext(<ProgressBar />, { state });

    expect(screen.getByTestId('direction-prompt')).toBeDefined();
    expect(screen.getByTestId('direction-ltr-btn')).toBeDefined();
    expect(screen.getByTestId('direction-rtl-btn')).toBeDefined();
  });

  it('calls onDirectionChange with selected direction from prompt', () => {
    const book = createMultiChapterBook();
    const state = createLowConfidenceState(book);
    const onDirectionChange = vi.fn();

    renderWithContext(<ProgressBar onDirectionChange={onDirectionChange} />, { state });

    fireEvent.click(screen.getByTestId('direction-ltr-btn'));
    expect(onDirectionChange).toHaveBeenCalledWith('ltr');
  });

  it('hides direction prompt after user selects', () => {
    const book = createMultiChapterBook();
    const state = createLowConfidenceState(book);

    renderWithContext(<ProgressBar />, { state });

    fireEvent.click(screen.getByTestId('direction-rtl-btn'));
    expect(screen.queryByTestId('direction-prompt')).toBeNull();
  });

  it('applies RTL dir attribute', () => {
    const book = createMultiChapterBook();
    const state = createRTLState(book);

    renderWithContext(<ProgressBar />, { state });

    const container = screen.getByTestId('progress-bar-container');
    expect(container.getAttribute('dir')).toBe('rtl');
  });

  it('does not show direction prompt when confidence is high', () => {
    renderWithContext(<ProgressBar />);

    expect(screen.queryByTestId('direction-prompt')).toBeNull();
  });
});
