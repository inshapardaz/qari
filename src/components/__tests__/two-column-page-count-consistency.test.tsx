/**
 * Regression test for issues #14 ("Last page of certain books not rendered
 * correctly") and #16 ("On certain width the two page layout show the
 * single column and we show divider").
 *
 * In two-column mode, `recalcPages`/`measureAllChapters` used to derive the
 * spread count (`Math.round(scrollWidth / pagePitch)`) and the
 * trailing-lone-column parity (`Math.round(scrollWidth / colPitch) % 2`)
 * from two *independent* roundings of `scrollWidth` — even though
 * `pagePitch` is algebraically exactly `2 * colPitch`. A real browser's
 * `scrollWidth` is rarely an exact multiple of the JS-computed pitch (a few
 * px of sub-pixel column-width rounding is normal), and that noise flips
 * the two roundings out of sync with each other worst exactly when the true
 * column count is odd: halving an odd count lands precisely on
 * `Math.round`'s 0.5 boundary, where a fraction of a pixel is enough to
 * flip it, while the whole-count rounding stays far from its own boundary.
 * The result was a chapter's page count undercounted by one whole spread —
 * its last page (or two) became unreachable via normal navigation.
 *
 * Both are now derived from a single rounding of the column count instead.
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

describe('Two-column page count stays consistent under sub-pixel scrollWidth noise', () => {
  it('does not undercount the spread total when scrollWidth is a few px short of an exact 3-column multiple', async () => {
    const source = createSource();
    const { container, rerender } = render(<Reader source={source} columns={2} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    const measurerEl = screen.getByTestId('page-count-measurer');

    // containerWidth=1000, margin=40: colWidth=(1000-80-64)/2=428,
    // colPitch=492, pagePitch=984 (exactly 2*colPitch). A true 3-column
    // chapter measures scrollWidth ~= 3*492=1476 — stubbed here 6px short
    // (1470), well within normal sub-pixel rendering noise:
    //   - column count:  round(1470/492)  = round(2.988) = 3 (odd, correct)
    //   - old buggy spreads: round(1470/984) = round(1.494) = 1 (WRONG —
    //     should be ceil(3/2)=2; this is exactly the issue #14/#16 bug)
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 1470, configurable: true });
    Object.defineProperty(measurerEl, 'scrollWidth', { value: 1470, configurable: true });

    rerender(<Reader source={source} columns={2} margin={40} />);

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('1 of 2'));
  });
});
