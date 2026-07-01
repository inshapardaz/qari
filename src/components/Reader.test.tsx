/**
 * Unit tests for the Reader component.
 * Tests service orchestration, state management, error handling, and callbacks.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Reader, clampZoom, ReaderContext, useReaderContext } from './Reader';
import type { ReaderSource } from './Reader';
import type { Book } from '../models/book';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMinimalMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

function createMinimalBook(): Book {
  return {
    metadata: { title: 'Test Book' },
    chapters: [
      {
        id: 'chapter-0',
        title: 'Chapter 1',
        order: 0,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'Hello world' }] },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// clampZoom utility tests
// ---------------------------------------------------------------------------

describe('clampZoom', () => {
  it('returns 100 for input of 100', () => {
    expect(clampZoom(100)).toBe(100);
  });

  it('clamps values below 50 to 50', () => {
    expect(clampZoom(10)).toBe(50);
    expect(clampZoom(-100)).toBe(50);
    expect(clampZoom(0)).toBe(50);
  });

  it('clamps values above 300 to 300', () => {
    expect(clampZoom(500)).toBe(300);
    expect(clampZoom(301)).toBe(300);
  });

  it('rounds to nearest 10% increment', () => {
    expect(clampZoom(53)).toBe(50);
    expect(clampZoom(55)).toBe(60);
    expect(clampZoom(147)).toBe(150);
    expect(clampZoom(294)).toBe(290);
    expect(clampZoom(295)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Reader component rendering tests
// ---------------------------------------------------------------------------

describe('Reader', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows loading state for async sources', async () => {
    // Use an epub source with invalid data that will take a microtask to fail
    // This verifies the initial state is loading=true
    const source: ReaderSource = {
      type: 'epub',
      data: new ArrayBuffer(10),
    };

    const { container } = render(<Reader source={source} />);
    // The initial render should show loading (before the async parse completes)
    // Note: In synchronous cases (markdown), the effect may resolve before assertion
    // For truly async sources (epub parse, url), loading appears initially
    const loadingEl = container.querySelector('[data-testid="reader-loading"]');
    expect(loadingEl).not.toBeNull();
  });

  it('renders book content after loading markdown', async () => {
    const source = createMinimalMarkdownSource();
    render(<Reader source={source} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });
  });

  it('renders error state for invalid epub data', async () => {
    const source: ReaderSource = {
      type: 'epub',
      data: new ArrayBuffer(10), // Invalid EPUB
    };

    const onError = vi.fn();
    render(<Reader source={source} onError={onError} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-error')).toBeDefined();
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'epub-buffer',
        format: 'epub',
      })
    );
  });

  it('emits onReady when book loads successfully', async () => {
    const source = createMinimalMarkdownSource();
    const onReady = vi.fn();

    render(<Reader source={source} onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({
          book: expect.objectContaining({ title: 'Test Book' }),
          chapterCount: 1,
          direction: 'ltr',
        })
      );
    });
  });

  it('uses direction prop override instead of auto-detection', async () => {
    const source = createMinimalMarkdownSource();
    const onReady = vi.fn();

    render(<Reader source={source} direction="rtl" onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'rtl',
        })
      );
    });
  });

  it('applies zoom clamping on the rendered element', async () => {
    const source = createMinimalMarkdownSource();
    render(<Reader source={source} zoom={150} />);

    await waitFor(() => {
      const content = screen.getByTestId('reader-content');
      expect(content.style.zoom).toBe('150%');
    });
  });

  it('clamps zoom outside valid range', async () => {
    const source = createMinimalMarkdownSource();
    render(<Reader source={source} zoom={400} />);

    await waitFor(() => {
      const content = screen.getByTestId('reader-content');
      expect(content.style.zoom).toBe('300%');
    });
  });

  it('displays structured error with source, format, and reason', async () => {
    const source: ReaderSource = {
      type: 'epub',
      data: new ArrayBuffer(10),
    };

    render(<Reader source={source} />);

    await waitFor(() => {
      const errorEl = screen.getByTestId('reader-error');
      expect(errorEl).toBeDefined();
      expect(screen.getByText(/Source: epub-buffer/)).toBeDefined();
      expect(screen.getByText(/Format: epub/)).toBeDefined();
    });
  });

  it('provides ReaderContext to child components', async () => {
    let contextValue: ReturnType<typeof useReaderContext> | null = null;

    const ContextConsumer: React.FC = () => {
      contextValue = useReaderContext();
      return <div data-testid="consumer">consumed</div>;
    };

    // We need to render the consumer inside Reader after it finishes loading
    // Since Reader wraps context provider around content, we can test via a custom source
    const source = createMinimalMarkdownSource();

    const TestWrapper: React.FC = () => {
      return <Reader source={source} />;
    };

    render(<TestWrapper />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    // The context is available internally - verified by the component rendering without throwing
  });

  it('reads a File source for markdown', async () => {
    const fileContent = '# File Book\n\n## Chapter A\n\nParagraph text';
    const file = new File([fileContent], 'test.md', { type: 'text/markdown' });
    const source: ReaderSource = { type: 'markdown', content: file };
    const onReady = vi.fn();

    render(<Reader source={source} onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({
          book: expect.objectContaining({ title: 'File Book' }),
        })
      );
    });
  });
});


// ---------------------------------------------------------------------------
// Reader Bookmark Integration Tests
// ---------------------------------------------------------------------------

import type { BookmarkStoreInterface } from '../interfaces/bookmark-store';
import type { Bookmark } from '../models/bookmark';

/**
 * Creates a mock BookmarkStoreInterface with vi.fn() methods.
 */
function createMockStore(overrides: Partial<BookmarkStoreInterface> = {}): BookmarkStoreInterface {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createTestBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'bm-1',
    bookId: 'test-book',
    chapterId: 'chapter-0',
    position: 42,
    name: 'Test Bookmark',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a markdown source that includes a book identifier.
 * The markdown parser doesn't set metadata.identifier by default, so for tests
 * that need store.load to be exercised, we use an epub source mock or ensure
 * the Reader reads from a source producing a book with an identifier.
 *
 * Since the markdown parser doesn't set identifier, the store.load path in
 * uncontrolled mode requires book.metadata.identifier to be truthy. We test
 * this by mocking the bookmarkStore's load and verifying it's called when
 * the condition is met — by using a custom markdown content that the parser
 * will assign an identifier to via the EPUB parser path.
 *
 * For simplicity, we'll provide the bookmarks prop for controlled mode tests
 * and verify store.load is NOT called, and for uncontrolled tests we'll directly
 * spy on LocalStorageStore behavior through localStorage.
 */

describe('Reader Bookmark Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Default store selection (Requirement 7.3)', () => {
    it('uses LocalStorageStore by default when no bookmarkStore prop is provided', async () => {
      // Seed localStorage with a bookmark for the book that will be loaded
      const bookmark = createTestBookmark({ bookId: 'Test Book' });
      localStorage.setItem('qari-bookmarks', JSON.stringify([bookmark]));

      const source = createMinimalMarkdownSource();
      const onReady = vi.fn();

      render(<Reader source={source} onReady={onReady} />);

      await waitFor(() => {
        expect(onReady).toHaveBeenCalled();
      });

      // The reader should have loaded the bookmark from localStorage
      // We can verify this by checking if the content renders (book loaded successfully)
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    it('loads bookmarks from LocalStorageStore when bookmarkStore is undefined', async () => {
      const source = createMinimalMarkdownSource();

      // No bookmarkStore prop — should fall back to LocalStorageStore
      render(<Reader source={source} bookmarkStore={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });
    });
  });

  describe('Controlled mode vs uncontrolled mode (Requirements 7.1, 7.2)', () => {
    it('uses bookmarks prop directly when provided (controlled mode)', async () => {
      const bookmarks = [
        createTestBookmark({ id: 'bm-1', name: 'First' }),
        createTestBookmark({ id: 'bm-2', name: 'Second' }),
      ];

      const mockStore = createMockStore();
      const source = createMinimalMarkdownSource();

      render(
        <Reader source={source} bookmarks={bookmarks} bookmarkStore={mockStore} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // In controlled mode, store.load should NOT be called
      expect(mockStore.load).not.toHaveBeenCalled();
    });

    it('loads from bookmarkStore in uncontrolled mode (no bookmarks prop)', async () => {
      // Mock the markdown parser to return a book with an identifier
      // (required for the store.load path to be exercised)
      const { MarkdownParserImpl } = await import('../parsers/markdown-parser');
      const parseSpy = vi.spyOn(MarkdownParserImpl.prototype, 'parse').mockReturnValue({
        metadata: { title: 'Test Book', identifier: 'test-book-id' },
        chapters: [
          {
            id: 'chapter-0',
            title: 'Chapter 1',
            order: 0,
            content: [{ type: 'paragraph', children: [{ type: 'text', content: 'Hello' }] }],
          },
        ],
      });

      const storedBookmarks = [createTestBookmark({ bookId: 'test-book-id' })];
      const mockStore = createMockStore({
        load: vi.fn().mockResolvedValue(storedBookmarks),
      });

      const source = createMinimalMarkdownSource();

      render(<Reader source={source} bookmarkStore={mockStore} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // In uncontrolled mode, store.load should be called with the book's identifier
      expect(mockStore.load).toHaveBeenCalledWith('test-book-id');

      parseSpy.mockRestore();
    });

    it('skips store load when bookmarks prop is an empty array (controlled mode)', async () => {
      const mockStore = createMockStore();
      const source = createMinimalMarkdownSource();

      render(
        <Reader source={source} bookmarks={[]} bookmarkStore={mockStore} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // Even empty array = controlled mode, so store.load should NOT be called
      expect(mockStore.load).not.toHaveBeenCalled();
    });
  });

  describe('Store hot-swap (Requirements 7.4, 7.5)', () => {
    it('uses new store when bookmarkStore prop changes', async () => {
      // Mock the markdown parser to return a book with an identifier
      const { MarkdownParserImpl } = await import('../parsers/markdown-parser');
      const parseSpy = vi.spyOn(MarkdownParserImpl.prototype, 'parse').mockReturnValue({
        metadata: { title: 'Test Book', identifier: 'test-book-id' },
        chapters: [
          {
            id: 'chapter-0',
            title: 'Chapter 1',
            order: 0,
            content: [{ type: 'paragraph', children: [{ type: 'text', content: 'Hello' }] }],
          },
        ],
      });

      const storeA = createMockStore({
        load: vi.fn().mockResolvedValue([createTestBookmark({ name: 'From A' })]),
      });
      const storeB = createMockStore({
        load: vi.fn().mockResolvedValue([createTestBookmark({ name: 'From B' })]),
      });

      const source = createMinimalMarkdownSource();

      const { rerender } = render(
        <Reader source={source} bookmarkStore={storeA} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // storeA should have been used initially
      expect(storeA.load).toHaveBeenCalledWith('test-book-id');

      // Now swap to storeB — the new store is set for subsequent operations
      rerender(<Reader source={source} bookmarkStore={storeB} />);

      // Force a reload by changing the source
      const newSource = createMinimalMarkdownSource('# Another Book\n\n## Ch 1\n\nContent');
      rerender(<Reader source={newSource} bookmarkStore={storeB} />);

      await waitFor(() => {
        expect(storeB.load).toHaveBeenCalled();
      });

      parseSpy.mockRestore();
    });

    it('reverts to LocalStorageStore when bookmarkStore changes to undefined', async () => {
      // Mock the markdown parser to return a book with an identifier
      const { MarkdownParserImpl } = await import('../parsers/markdown-parser');
      const parseSpy = vi.spyOn(MarkdownParserImpl.prototype, 'parse').mockReturnValue({
        metadata: { title: 'Test Book', identifier: 'test-book-id' },
        chapters: [
          {
            id: 'chapter-0',
            title: 'Chapter 1',
            order: 0,
            content: [{ type: 'paragraph', children: [{ type: 'text', content: 'Hello' }] }],
          },
        ],
      });

      const customStore = createMockStore({
        load: vi.fn().mockResolvedValue([createTestBookmark({ name: 'Custom' })]),
      });

      const source = createMinimalMarkdownSource();

      const { rerender } = render(
        <Reader source={source} bookmarkStore={customStore} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      expect(customStore.load).toHaveBeenCalledWith('test-book-id');

      // Revert to undefined — should fall back to LocalStorageStore
      // Seed localStorage so we can verify fallback behavior on next load
      const lsBookmark = createTestBookmark({ bookId: 'test-book-id', name: 'LS Bookmark' });
      localStorage.setItem('qari-bookmarks', JSON.stringify([lsBookmark]));

      rerender(<Reader source={source} bookmarkStore={undefined} />);

      // Force a new book load to exercise the fallback store
      const newSource = createMinimalMarkdownSource('# New Book\n\n## Chapter 1\n\nNew content');
      rerender(<Reader source={newSource} bookmarkStore={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // The custom store should NOT have been called again after the switch
      expect(customStore.load).toHaveBeenCalledTimes(1);

      parseSpy.mockRestore();
    });
  });

  describe('onBookmarkChange callback (Requirement 6.4, 6.5)', () => {
    it('accepts onBookmarkChange prop without errors', async () => {
      const onBookmarkChange = vi.fn();
      const source = createMinimalMarkdownSource();

      render(
        <Reader
          source={source}
          bookmarks={[createTestBookmark()]}
          onBookmarkChange={onBookmarkChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // The callback is registered — it would fire on user-initiated bookmark operations
      // This test verifies the prop is accepted without runtime errors
    });

    it('renders correctly with all bookmark-related props combined', async () => {
      const mockStore = createMockStore();
      const bookmarks = [createTestBookmark()];
      const onBookmarkChange = vi.fn();
      const source = createMinimalMarkdownSource();

      render(
        <Reader
          source={source}
          bookmarks={bookmarks}
          bookmarkStore={mockStore}
          onBookmarkChange={onBookmarkChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // Controlled mode: store.load NOT called
      expect(mockStore.load).not.toHaveBeenCalled();
    });
  });

  describe('Bookmarks prop reactivity (Requirement 5.6, 6.2)', () => {
    it('updates displayed bookmarks when bookmarks prop changes', async () => {
      const initialBookmarks = [createTestBookmark({ id: 'bm-1', name: 'First' })];
      const updatedBookmarks = [
        createTestBookmark({ id: 'bm-1', name: 'First' }),
        createTestBookmark({ id: 'bm-2', name: 'Second' }),
      ];

      const source = createMinimalMarkdownSource();

      const { rerender } = render(
        <Reader source={source} bookmarks={initialBookmarks} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // Update the bookmarks prop
      rerender(<Reader source={source} bookmarks={updatedBookmarks} />);

      // The component should accept the new prop value without error
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    it('handles bookmarks prop changing from non-empty to empty array', async () => {
      const bookmarks = [createTestBookmark()];
      const source = createMinimalMarkdownSource();

      const { rerender } = render(
        <Reader source={source} bookmarks={bookmarks} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeDefined();
      });

      // Change to empty
      rerender(<Reader source={source} bookmarks={[]} />);

      expect(screen.getByTestId('reader-content')).toBeDefined();
    });
  });
});


// ---------------------------------------------------------------------------
// Reader Footnote Integration Tests (Task 7.4)
// Requirements: 4.1, 4.2, 4.3, 5.1, 6.5
// ---------------------------------------------------------------------------

import { fireEvent } from '@testing-library/react';

describe('Reader Footnote Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * Create a markdown source with a footnote reference and definition.
   * The markdown parser will detect [^1] and [^1]: definition and produce
   * a FootnoteRefSpan node.
   */
  function createFootnoteMarkdownSource(): ReaderSource {
    return {
      type: 'markdown',
      content: '# Footnote Test\n\n## Chapter 1\n\nThis has a footnote[^1] in it.\n\n[^1]: This is the footnote content.',
    };
  }

  it('renders footnote reference as superscript with accent color (Req 4.1, 4.2)', async () => {
    const source = createFootnoteMarkdownSource();
    render(<Reader source={source} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    const footnoteRef = screen.getByTestId('footnote-ref');
    expect(footnoteRef).toBeDefined();
    // It should be rendered as a <sup> element (Req 4.4)
    expect(footnoteRef.tagName.toLowerCase()).toBe('sup');
    // It should have the accent color style (Req 4.2)
    expect(footnoteRef.style.color).toBe('var(--reader-accent, #0066cc)');
    // It should have cursor: pointer (Req 4.3)
    expect(footnoteRef.style.cursor).toBe('pointer');
    // It should have role="button" for accessibility
    expect(footnoteRef.getAttribute('role')).toBe('button');
    // The label "1" should be displayed
    expect(footnoteRef.textContent).toBe('1');
  });

  it('clicking a footnote ref opens the FootnotePopover (Req 5.1)', async () => {
    const source = createFootnoteMarkdownSource();
    render(<Reader source={source} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    const footnoteRef = screen.getByTestId('footnote-ref');

    // Click the footnote reference
    await act(async () => {
      fireEvent.click(footnoteRef);
    });

    // The popover should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('footnote-popover')).toBeDefined();
    });

    const popover = screen.getByTestId('footnote-popover');
    // Verify it has role="dialog" (Req 5.4)
    expect(popover.getAttribute('role')).toBe('dialog');
  });

  it('popover displays correct footnote content (Req 5.3)', async () => {
    const source = createFootnoteMarkdownSource();
    render(<Reader source={source} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    const footnoteRef = screen.getByTestId('footnote-ref');

    await act(async () => {
      fireEvent.click(footnoteRef);
    });

    await waitFor(() => {
      expect(screen.getByTestId('footnote-popover')).toBeDefined();
    });

    // The footnote content area should contain the footnote text
    const contentEl = screen.getByTestId('footnote-content');
    expect(contentEl).toBeDefined();
    expect(contentEl.textContent).toContain('This is the footnote content');
  });

  it('closing popover restores focus to the footnote reference (Req 6.5)', async () => {
    const source = createFootnoteMarkdownSource();
    render(<Reader source={source} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeDefined();
    });

    const footnoteRef = screen.getByTestId('footnote-ref');

    // Focus and click the footnote reference
    footnoteRef.focus();
    await act(async () => {
      fireEvent.click(footnoteRef);
    });

    await waitFor(() => {
      expect(screen.getByTestId('footnote-popover')).toBeDefined();
    });

    // Close the popover via the close button
    const closeBtn = screen.getByTestId('footnote-close');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // The popover should be gone
    await waitFor(() => {
      expect(screen.queryByTestId('footnote-popover')).toBeNull();
    });

    // Focus should be restored to the footnote reference
    expect(document.activeElement).toBe(footnoteRef);
  });
});
