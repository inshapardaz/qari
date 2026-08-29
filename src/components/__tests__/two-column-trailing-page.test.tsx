/**
 * In two-column (spread) mode, a chapter's content doesn't always divide
 * evenly into pairs of columns — the last spread can end up with content in
 * only its first column, leaving the second empty. That lone populated
 * column stays pinned to its normal spread position (the leading edge),
 * with a blank column-and-gap's worth of dead space beside it, and (unlike
 * a fully-populated spread) no page divider is drawn next to that blank
 * column — the same treatment `pdfSpreadHasBothPages` already gives a
 * trailing odd PDF page. See `isTrailingLoneColumnPage`'s own comment in
 * Reader.tsx.
 *
 * An earlier version instead added an extra transform offset to re-center
 * the lone column within the spread-wide page box. That was reverted: the
 * shift has nowhere blank to pull from on the side it shifts *toward* — the
 * immediately-preceding column, just a 64px gap away, is real, already-read
 * text, not blank space — so "centering" a lone column that isn't the
 * chapter's only page dragged a slice of that previous column's text into
 * view instead.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

async function renderAndStub(scrollWidth: number, margin: number, showPageDivider: boolean) {
  // A single shared `source` object, reused (same reference) across the
  // initial render and the `rerender` below — the reader reloads the whole
  // book whenever `source` changes identity, which would reset the DOM
  // (and with it, the stubs below) if each render passed a fresh object.
  const source = createSource();
  const { container, rerender } = render(<Reader source={source} columns={2} showPageDivider={showPageDivider} />);
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
  rerender(<Reader source={source} columns={2} margin={margin} showPageDivider={showPageDivider} />);
  await waitFor(() => expect(columnsEl.style.transform).toBe('translateX(0px)'));

  return { container };
}

describe('Two-column trailing lone-column page', () => {
  it('leaves a chapter-ending page whose second column is empty pinned, with no divider', async () => {
    // containerWidth=1000, margin=40: colWidth = (1000-80-64)/2 = 428,
    // colPitch = 428+64 = 492. scrollWidth=492 is exactly one column's
    // worth, an odd total column count, so the last (only) spread's second
    // column is empty.
    const { container } = await renderAndStub(492, 40, true);
    expect(container.querySelector('[data-testid="page-divider"]')).not.toBeInTheDocument();
  });

  it('draws the divider for a chapter-ending page whose spread is fully populated (contrast check)', async () => {
    // Same geometry, but scrollWidth=984 is exactly two columns' worth — an
    // even total column count, so the last spread's second column has
    // content too, and the divider (enabled here) should draw normally.
    const { container } = await renderAndStub(984, 40, true);
    expect(container.querySelector('[data-testid="page-divider"]')).toBeInTheDocument();
  });
});
