/**
 * Regression test for issue #21's resize/layout follow-up. Two compounding
 * bugs, both in the same area:
 *
 * 1. `measureAllChapters` (the background pass that fills `pagesPerChapter`
 *    for every chapter other than the one currently on screen) only re-ran
 *    when a layout/font *setting* changed (columns, margin, font size,
 *    etc.) — a plain window resize wasn't in its dependency array at all.
 *    So after resizing, `pagesPerChapter` entries for other chapters went —
 *    and stayed — stale forever. Fixed by `resizeTick` (see its declaration
 *    in Reader.tsx), which also re-runs the bulk pass on resize.
 * 2. Even with a fresh, correct page *count*, `BookmarkPanel` used to
 *    recover a bookmark's page by exact index (`floor(position /
 *    charsPerPage)`) — but "page 2" means something completely different
 *    once the chapter has reflowed into a different number of pages. A
 *    bookmark placed roughly halfway through a chapter should still land
 *    roughly halfway through it after a resize/font/layout change, not at
 *    whatever absolute page index it happened to be created on. Fixed by
 *    scaling the position proportionally across the chapter's real
 *    character count instead (see BookmarkPanel.tsx's own comment) — the
 *    same fix already applied to Notes/Search.
 *
 * This test exercises both: it resizes to a *much* larger page count (so
 * the two fixes' effects are large enough to tell apart) and checks the
 * bookmark lands near its original *relative* position, not literally at
 * its original page index (which the pre-fix exact-recovery approach would
 * have produced).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

// Long enough that the chapter's real character count is a realistic basis
// for proportional scaling (an unrealistically short chapter forced into an
// inflated page count would make the fix's own math behave oddly — see
// bookmark-navigation-same-chapter.test.tsx's identical concern).
const FILLER = 'x'.repeat(6000);

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: `# Book\n\n## Chapter 1\n\nch0-marker short chapter.\n\n## Chapter 2\n\nch1-marker ${FILLER} end of chapter two.`,
  };
}

describe('Bookmark navigation to a different chapter after a window resize', () => {
  it('lands near the bookmark\'s original relative position, not its stale absolute page index', async () => {
    // Chapter 2 measures as 6 real pages before the resize, 12 after —
    // simulating a resize that roughly halves the effective page width.
    // Chapter 1 is always a single page throughout.
    let resized = false;
    function stubScrollWidthByChapterMarker(el: HTMLElement) {
      Object.defineProperty(el, 'scrollWidth', {
        get: () => {
          const text = el.textContent ?? '';
          if (text.includes('ch1-marker')) return resized ? 12000 : 6000;
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

    // Visit chapter 2 once so it gets measured (pre-resize: 6 pages), move
    // to its roughly-halfway page (index 2 of 6), and bookmark it there.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 2' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 2 of 7'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 4 of 7'));
    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 4 of 7'));

    // Leave, then resize chapter 2 up to 12 real pages.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 1' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker'));

    resized = true;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 1 of 13'));

    // Click the chapter-2 bookmark. The old exact-index recovery would clamp
    // to its original absolute page index (2 of 0-11, i.e. book page 4 of
    // 13) — roughly the first sixth of the now-12-page chapter, nowhere near
    // where it actually was (roughly the middle). The proportional fix
    // should land near book page 7-8 of 13 instead (chapter-2 page index
    // ~5-6 of 12): comfortably distinct from both the stale absolute index
    // and the chapter's first/last page, so this can't pass by coincidence.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    const bookmarkPanel = await screen.findByTestId('bookmark-panel');
    fireEvent.click(bookmarkPanel.querySelector('[data-testid^="bookmark-name-"]') as HTMLElement);

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch1-marker'));
    const statusText = screen.getByTestId('header-status').textContent ?? '';
    const match = statusText.match(/Page (\d+) of (\d+)/);
    expect(match).not.toBeNull();
    const landedPage = Number(match![1]);
    expect(landedPage).toBeGreaterThanOrEqual(6);
    expect(landedPage).toBeLessThanOrEqual(9);
  });
});
