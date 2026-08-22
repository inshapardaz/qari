/**
 * Web fonts (in particular the Urdu/Arabic Nastaliq family — see
 * `injectUrduWebFontsCss`) load asynchronously from a remote CDN, well
 * after `recalcPages`/the bulk chapter-measurement effect first run. The
 * browser renders with a fallback font and *silently reflows* once the
 * real font's glyph data arrives, with no React state change to trigger a
 * re-measurement — so `totalPages`/`pagesPerChapter` stayed stuck at the
 * pre-reflow (typically undercounted, since Nastaliq generally needs more
 * vertical space per line than a generic serif fallback) page count,
 * leaving a chapter's true trailing content permanently unreachable via
 * page/chapter navigation even though it was already in the DOM. Reader.tsx
 * now listens for `document.fonts`' 'loadingdone' event and re-runs
 * `recalcPages` (and, via `fontLoadGeneration`, the background bulk
 * measurement) when it fires.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

describe('Re-paginates once a web font finishes loading', () => {
  it("re-runs recalcPages when document.fonts fires 'loadingdone', picking up a scrollWidth the fallback-font measurement missed", async () => {
    const source = createSource();
    const { container } = render(<Reader source={source} columns={2} margin={40} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    // Also stubbed identically to columnsEl at every step, matching
    // two-column-trailing-page.test.tsx's own pattern — the background bulk
    // `measureAllChapters` pass measures this separate offscreen element
    // and would otherwise race/overwrite `recalcPages`'s own result with
    // whatever jsdom's real (always-zero) scrollWidth happens to be.
    const measurerEl = screen.getByTestId('page-count-measurer');
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });

    // Fallback-font metrics: content only measures as needing one spread.
    // containerWidth=1000, margin=40 → pagePitch = 1000-80+64 = 984.
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 984, configurable: true });
    Object.defineProperty(measurerEl, 'scrollWidth', { value: 984, configurable: true });
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('1 of 1'));

    // The real Nastaliq font finishes loading: the browser has already
    // reflowed the same DOM to something taller/wider (here simulated as
    // needing two full spreads instead of one), but nothing re-measures
    // until the font-load event fires.
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 1968, configurable: true });
    Object.defineProperty(measurerEl, 'scrollWidth', { value: 1968, configurable: true });
    expect(screen.getByTestId('reader-content').textContent).toContain('1 of 1'); // still stale

    act(() => {
      (document.fonts as unknown as EventTarget).dispatchEvent(new Event('loadingdone'));
    });

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('1 of 2'));
  });
});
