/**
 * Minimal reproduction: bookmark a mid-chapter page, navigate elsewhere
 * within the *same* chapter, then click the bookmark in the Bookmarks panel
 * — no chapter switch involved at all. Written while investigating issue
 * #21 follow-up reports ("still not working", "same issue appears with
 * bookmarks too") to check whether the bug reproduces even without any
 * cross-chapter measurement race.
 *
 * The chapter's own text is long enough (~3200 real characters) that the
 * stubbed 3-page scrollWidth below is a realistic page count for it —
 * BookmarkPanel now resolves a bookmark's page proportionally against the
 * chapter's real character count rather than by an exact page-index
 * round-trip (see BookmarkPanel.tsx's own comment on why — a later
 * font/layout change can't be allowed to preserve the raw page *number*
 * verbatim), so the test content needs to actually support that: an
 * unrealistically short chapter forced into an inflated page count (as an
 * earlier version of this test used) would make the proportional and
 * absolute answers disagree even with *no* layout change at all.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: `# Book\n\n## Chapter 1\n\nch0-marker ${'x'.repeat(3200)} end of chapter.`,
  };
}

describe('Bookmark navigation within the same chapter', () => {
  it('returns to the bookmarked page, not page 1', async () => {
    const source = createSource();
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

    // Move to page 2 (index 1) and bookmark it.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 2 of 3'));
    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 2 of 3'));

    // Back to page 1.
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 1 of 3'));

    // Open the chapter drawer's Bookmarks tab and click the bookmark.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    const bookmarkPanel = await screen.findByTestId('bookmark-panel');
    fireEvent.click(bookmarkPanel.querySelector('[data-testid^="bookmark-name-"]') as HTMLElement);

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 2 of 3'));
  });
});
