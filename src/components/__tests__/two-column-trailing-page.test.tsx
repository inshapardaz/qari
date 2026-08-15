/**
 * In two-column (spread) mode, a chapter's content doesn't always divide
 * evenly into pairs of columns — the last spread can end up with content in
 * only its first column, leaving the second empty. Before this fix, that
 * lone populated column stayed pinned to its normal spread position (the
 * leading edge), with a blank column-and-gap's worth of dead space beside
 * it. Reader.tsx now detects this case during chapter measurement
 * (`trailingLoneColumn`, set alongside `pagesPerChapter`) and adds an extra
 * `trailingLoneColumnShift` term to the page-turn transform that re-centers
 * the lone column within the still spread-wide page box — see the comments
 * above `isTrailingLoneColumnPage`/`trailingLoneColumnShift` in Reader.tsx
 * for why this is done as an added transform offset rather than by
 * resizing the column layout itself (which would reflow every other page
 * in the chapter along with it).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

async function renderAndStub(scrollWidth: number, margin: number, expectedTransform: string) {
  // A single shared `source` object, reused (same reference) across the
  // initial render and the `rerender` below — the reader reloads the whole
  // book whenever `source` changes identity, which would reset the DOM
  // (and with it, the stubs below) if each render passed a fresh object.
  const source = createSource();
  const { container, rerender } = render(<Reader source={source} columns={2} />);
  await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

  const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
  const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
  const measurerEl = screen.getByTestId('page-count-measurer');

  Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
  Object.defineProperty(columnsEl, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(measurerEl, 'scrollWidth', { value: scrollWidth, configurable: true });

  // Changing `margin` re-runs both the per-chapter measurement effect (which
  // computes `trailingLoneColumn`) and `recalcPages` — neither depends on
  // `currentPage`/resize alone, so a prop change is what re-triggers them
  // with the stubbed widths now in place (mirrors the pattern in
  // scroll-view.test.tsx's "margin-aware page pitch" test, which uses a
  // window resize event for the same purpose on the simpler, single effect
  // it exercises).
  rerender(<Reader source={source} columns={2} margin={margin} />);

  await waitFor(() => expect(columnsEl.style.transform).toBe(expectedTransform));
}

describe('Two-column trailing lone-column page', () => {
  it('re-centers a chapter-ending page whose second column is empty', async () => {
    // containerWidth=1000, margin=40: colWidth = (1000-80-64)/2 = 428,
    // colPitch = 428+64 = 492. scrollWidth=492 is exactly one column's
    // worth, an odd total column count, so the last (only) spread's second
    // column is empty. Expected shift = (colWidth+64)/2 = 246.
    await renderAndStub(492, 40, 'translateX(246px)');
  });

  it('does not shift a chapter-ending page whose spread is fully populated (contrast check)', async () => {
    // Same geometry, but scrollWidth=984 is exactly two columns' worth — an
    // even total column count, so the last spread's second column has
    // content too, and no re-centering should apply.
    await renderAndStub(984, 40, 'translateX(0px)');
  });
});
