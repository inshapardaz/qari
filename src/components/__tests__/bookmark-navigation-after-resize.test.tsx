/**
 * Regression test for issue #21's resize follow-up: `measureAllChapters`
 * (the background pass that fills `pagesPerChapter` for every chapter other
 * than the one currently on screen) only re-ran when a layout/font *setting*
 * changed (columns, margin, font size, etc.) — a plain window resize wasn't
 * in its dependency array at all. So after resizing the window,
 * `pagesPerChapter` entries for other chapters went — and stayed — stale
 * forever (nothing else ever re-triggered the pass), and Bookmarks/Notes/
 * Search (which prefer that real measured total once available — see
 * bookmark-navigation-same-chapter.test.tsx) resolved navigation to those
 * chapters against outdated page counts.
 *
 * `resizeTick` (see its declaration in Reader.tsx) fixes this by also
 * re-running the bulk pass on resize, the same way it already did for
 * layout/font-size changes.
 *
 * Note: unlike Notes/Search, a bookmark's page is recovered as an *exact*
 * index clamped to the chapter's current real page count, not proportionally
 * rescaled — see `resolveBookmarkPageIndex`'s own comment in
 * chapter-navigator.ts for why (a bookmark's `position` isn't a real text
 * offset, so treating it as a fraction of the chapter's character count
 * produces a *different* page even with no layout change at all). So this
 * test's expectation after the resize is still the bookmark's original
 * absolute page index — just clamped to the freshly-measured (larger) total
 * instead of the stale pre-resize one.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Book\n\n## Chapter 1\n\nch0-marker short chapter.\n\n## Chapter 2\n\nch1-marker chapter two content spanning a few pages.',
  };
}

describe('Bookmark navigation to a different chapter after a window resize', () => {
  it('uses the post-resize page count, not a stale pre-resize one', async () => {
    // Chapter 2 measures as 3 real pages before the resize, 5 after —
    // simulating a resize that shrinks the effective page width. Chapter 1
    // is always a single page throughout.
    let resized = false;
    function stubScrollWidthByChapterMarker(el: HTMLElement) {
      Object.defineProperty(el, 'scrollWidth', {
        get: () => {
          const text = el.textContent ?? '';
          if (text.includes('ch1-marker')) return resized ? 5000 : 3000;
          if (text.includes('ch0-marker')) return 500;
          return 0;
        },
        configurable: true,
      });
    }

    const source = createSource();
    const { container } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    const measurerEl = screen.getByTestId('page-count-measurer');

    // Single column, default margin=32: pagePitch = 1000-64+64 = 1000.
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    stubScrollWidthByChapterMarker(columnsEl);
    stubScrollWidthByChapterMarker(measurerEl);
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker'));

    // Visit chapter 2 once so it gets measured (pre-resize: 3 pages), move
    // to its last page (index 2), and bookmark it there.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 2' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 2 of 4'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 4 of 4'));
    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 4 of 4'));

    // Leave, then resize chapter 2 up to 5 real pages.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 1' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker'));

    resized = true;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 1 of 6'));

    // Click the chapter-2 bookmark (originally its last page, page index 2
    // of 3) — with the post-resize real total (5) available, the exact
    // position round-trip should land on that same absolute page index,
    // not get silently re-clamped to whatever the *pre-resize* total would
    // have implied.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    const bookmarkPanel = await screen.findByTestId('bookmark-panel');
    fireEvent.click(bookmarkPanel.querySelector('[data-testid^="bookmark-name-"]') as HTMLElement);

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch1-marker'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 4 of 6'));
  });
});
