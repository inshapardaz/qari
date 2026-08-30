/**
 * Integration tests for the header Bookmarks button: it bookmarks/unbookmarks
 * the current page directly (no picker), toggling in place — see
 * `handleToggleBookmark` in Reader.tsx. The full bookmark list itself lives
 * in the chapter drawer's Bookmarks tab (see chapter-drawer.test.tsx).
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';
import { getTextOffset } from '../../utils/text-highlight';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

// Matches the internal `STORAGE_KEY` in bookmark-store.ts's default
// (adapter-less) local storage fallback — BookmarkStore's own key, not
// LocalStorageStore's per-book `qari-bookmarks-${bookId}` scheme (that
// class is only used for reading progress resume, not bookmarks, in this
// default no-adapter setup).
function readStoredBookmarks(): Array<{ position: number }> {
  return JSON.parse(localStorage.getItem('ebook-reader-bookmarks') ?? '[]');
}

async function openDrawerBookmarksTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  const panel = await screen.findByTestId('chapter-menu-panel');
  fireEvent.click(within(panel).getByRole('tab', { name: 'Bookmarks' }));
  return panel;
}

describe('Bookmarks button toggles a bookmark for the current page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is unpressed with no bookmark on first load', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('creates a bookmark for the current page on click, and shows it in the drawer', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    const panel = await openDrawerBookmarksTab();
    expect(within(panel).getByTestId('bookmark-list')).toHaveTextContent('Chapter 1, Page 1');
  });

  it('removes the bookmark on a second click (toggle off)', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));

    const panel = await openDrawerBookmarksTab();
    expect(within(panel).getByTestId('bookmark-empty')).toBeInTheDocument();
  });

  it('does not show the Bookmarks button when enableBookmarks is false', async () => {
    render(<Reader source={createMarkdownSource()} enableBookmarks={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Bookmarks' })).not.toBeInTheDocument();
  });

  describe('real DOM-offset positioning (issue #21)', () => {
    afterEach(() => {
      delete (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
    });

    it('stores a real DOM-text offset as the bookmark position when caretRangeFromPoint is available', async () => {
      render(<Reader source={createMarkdownSource()} />);
      await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

      const contentEl = document.querySelector('.ebook-reader__columns') as HTMLElement;
      const textNode = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT).nextNode() as Text;
      // A real, non-zero offset partway into the first text node — chosen
      // specifically so it can't be confused with the old `page * 1500`
      // fallback, which is 0 on the book's very first page.
      const fakeRange = document.createRange();
      fakeRange.setStart(textNode, 5);
      fakeRange.setEnd(textNode, 5);
      const expectedOffset = getTextOffset(contentEl, textNode, 5);
      expect(expectedOffset).not.toBe(0);

      (document as unknown as { caretRangeFromPoint: () => Range }).caretRangeFromPoint = () => fakeRange;

      fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Bookmarks' })).toHaveAttribute('aria-pressed', 'true'));

      const stored = readStoredBookmarks();
      expect(stored).toHaveLength(1);
      expect(stored[0].position).toBe(expectedOffset);
    });

    it('falls back to the page-based estimate when no caret-hit-test API is available (e.g. this jsdom test environment)', async () => {
      render(<Reader source={createMarkdownSource()} />);
      await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

      // No caretRangeFromPoint/caretPositionFromPoint stubbed — matches
      // plain jsdom, which implements neither.
      fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Bookmarks' })).toHaveAttribute('aria-pressed', 'true'));

      const stored = readStoredBookmarks();
      expect(stored).toHaveLength(1);
      expect(stored[0].position).toBe(0); // page 0 * charsPerPage
    });
  });
});
