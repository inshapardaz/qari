/**
 * Integration tests for the header Bookmarks button: it bookmarks/unbookmarks
 * the current page directly (no picker), toggling in place — see
 * `handleToggleBookmark` in Reader.tsx. The full bookmark list itself lives
 * in the chapter drawer's Bookmarks tab (see chapter-drawer.test.tsx).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

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

  it('stores the bookmark at exactly page * charsPerPage, and recognizes it as pressed on the same page — not a different one, and not a duplicate on a repeated click', async () => {
    // Regression test: bookmark creation and the toggle-button's "is this
    // page bookmarked" check must resolve a bookmark's page identically
    // (see `resolveBookmarkPageIndex` in chapter-navigator.ts). A brief
    // regression scaled a bookmark's position *proportionally* against the
    // chapter's character count (correct for notes/search, which anchor to
    // a real text offset, but not for bookmarks — see that function's own
    // comment) — the button then failed to recognize its own just-created
    // bookmark as belonging to the current (non-zero, mid-chapter) page, so
    // every click created yet another bookmark instead of toggling the
    // existing one off. A single-page chapter can't catch this: the
    // proportional formula degenerates to always page 0 whenever there's
    // only one real page, coincidentally matching regardless of the bug —
    // this needs a real multi-page chapter and a *non-zero* page.
    const source: ReaderSource = {
      type: 'markdown',
      content: '# Book\n\n## Chapter 1\n\nch0-marker chapter content spanning a few pages.',
    };
    const { container } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    const measurerEl = screen.getByTestId('page-count-measurer');

    // Single column, default margin=32: pagePitch = 1000-64+64 = 1000.
    // scrollWidth=3000 -> 3 real pages for this one chapter.
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 3000, configurable: true });
    Object.defineProperty(measurerEl, 'scrollWidth', { value: 3000, configurable: true });
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 1 of 3'));

    // Move to the middle page (index 1) before bookmarking.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 2 of 3'));

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));

    let stored = readStoredBookmarks();
    expect(stored).toHaveLength(1);
    expect(stored[0].position).toBe(1500); // page 1 * charsPerPage

    // Clicking again while still on the same page must toggle it back off
    // (delete), never add a second one.
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));

    stored = readStoredBookmarks();
    expect(stored).toHaveLength(0);
  });
});
