/**
 * Regression test: pressing "previous page" on a chapter's first page must
 * land on the *actual* last page of the preceding chapter, not some
 * intermediate page determined by the chapter being left.
 *
 * `goToPrevPage` sets a placeholder `currentPage` (9999) when crossing a
 * chapter boundary backward, relying on `recalcPages` (via `goToLastPageRef`)
 * to correct it once the new chapter's real page count is measured. Without
 * that ref, a generic "clamp currentPage to totalPages-1" effect would fire
 * first using `totalPages` as it still stood for the chapter being left —
 * landing on the wrong page whenever the two chapters' page counts differ,
 * worse the larger the difference (reported as the reader jumping "5-6
 * pages back" instead of landing on the true last page).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nch0-marker content\n\n## Chapter 2\n\nch1-marker content',
  };
}

/**
 * The footer shows *book-wide* page totals (`bookPageNumber`/`bookTotalPages`,
 * summed across `pagesPerChapter`), not the current chapter's own
 * `currentPage`/`totalPages` — so both the live (`recalcPages`) and
 * background bulk (`measureAllChapters`) measurement paths need stubbing:
 * chapter 1 ("ch0-marker") as 5 pages, chapter 2 ("ch1-marker") as 2 pages,
 * for a deterministic 7-page book total throughout.
 */
function stubScrollWidthByChapterMarker(el: HTMLElement) {
  Object.defineProperty(el, 'scrollWidth', {
    get: () => {
      const text = el.textContent ?? '';
      if (text.includes('ch0-marker')) return 5000;
      if (text.includes('ch1-marker')) return 2000;
      return 0;
    },
    configurable: true,
  });
}

describe('Previous-page navigation across a chapter boundary', () => {
  it('lands on the actual last page of the preceding chapter, even when it has many more pages than the one being left', async () => {
    const source = createSource();
    const { container } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    const measurerEl = screen.getByTestId('page-count-measurer');

    // Single column, default margin=32: pagePitch = 1000 - 64 + 64 = 1000,
    // so scrollWidth 5000/2000 measure as 5/2 pages respectively.
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    stubScrollWidthByChapterMarker(columnsEl);
    stubScrollWidthByChapterMarker(measurerEl);
    fireEvent(window, new Event('resize'));
    // Chapter 2 hasn't been visited yet, so its entry in `pagesPerChapter`
    // still reflects the background `measureAllChapters` pass's own
    // (unstubbed, at the time it ran) reading rather than the live-measured
    // value — the book-wide total only becomes fully accurate once every
    // chapter has actually been opened. Just confirm chapter 1's own
    // measurement (5 pages) took effect for now.
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 1 of'));
    expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker');

    // Advance through all 5 pages of chapter 1, then once more to cross into
    // chapter 2's page 1 (book page 6 of 7).
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
    }
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch1-marker'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 6 of 7'));

    // Now press "previous" from chapter 2's first page — should land back on
    // chapter 1's true last page (book page 5 of 7), not some page
    // determined by chapter 2's own (smaller) page count.
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 5 of 7'));
  });
});
