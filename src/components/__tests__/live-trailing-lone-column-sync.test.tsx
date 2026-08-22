/**
 * `trailingLoneColumn[currentChapterIdx]` used to be updated *only* by the
 * background bulk `measureAllChapters` pass, which measures a separate
 * offscreen element (`measureRef`) — subject to the exact same
 * async-web-font-loading race `recalcPages` itself was fixed for (see
 * `font-load-repagination.test.tsx`): if that background pass last ran
 * before a newly-selected font (e.g. Adobe Arabic, Dehalvi Khush Khat)
 * finished downloading, its `trailingLoneColumn` entry for the currently
 * open chapter is stale, computed against fallback-font metrics. A stale
 * `true` there applies `trailingLoneColumnShift` to a spread that isn't
 * actually a lone-populated-column, shifting it half a column-pitch
 * sideways for no reason — which straddles two adjacent real spreads at
 * once, rendering slivers of three columns (the two real ones plus a
 * fragment of a neighboring page) with the outer two clipped by the page
 * box's edges.
 *
 * `recalcPages` (which reads the *live*, already-really-rendered DOM, not
 * a separate offscreen copy) now recomputes `trailingLoneColumn` for the
 * current chapter too, so it can't disagree with the page count it
 * computes in the same pass. This test proves that: the background pass's
 * offscreen measurer is stubbed to a *conflicting* value (one that would
 * compute `trailingLoneColumn = true`), while the real, live
 * `.ebook-reader__columns` element is stubbed to a value that's actually
 * fully populated (`trailingLoneColumn` should be `false`) — and asserts
 * the live value wins.
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

describe('recalcPages keeps trailingLoneColumn in sync with the live DOM, not just the offscreen bulk pass', () => {
  it('does not shift the current page when the live content fully populates the last spread, even if the offscreen bulk measurer (stale/mismeasured) would have said otherwise', async () => {
    const source = createSource();
    const { container, rerender } = render(<Reader source={source} columns={2} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    const measurerEl = screen.getByTestId('page-count-measurer');

    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    // containerWidth=1000, margin=40: colWidth=(1000-80-64)/2=428, colPitch=492.
    // scrollWidth=984 is exactly two columns' worth — an EVEN column count,
    // so the last spread is fully populated and no shift should apply.
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 984, configurable: true });
    // The offscreen bulk-pass measurer stubbed to a *conflicting* value:
    // one column's worth (492), an ODD count that alone would compute
    // trailingLoneColumn=true — simulating a stale/fallback-font
    // measurement that disagrees with the real, live render.
    Object.defineProperty(measurerEl, 'scrollWidth', { value: 492, configurable: true });

    rerender(<Reader source={source} columns={2} margin={40} />);

    await waitFor(() => expect(columnsEl.style.transform).toBe('translateX(0px)'));
    // Give the background bulk pass (and any further re-renders it might
    // trigger) a chance to run too, then confirm the shift still didn't
    // creep in from it afterward.
    await new Promise((r) => setTimeout(r, 100));
    expect(columnsEl.style.transform).toBe('translateX(0px)');
  });
});
