/**
 * Regression test for issue #14: the offscreen per-chapter measurement pass
 * (`measureAllChapters`, which feeds `pagesPerChapter`/`trailingLoneColumn`)
 * used to prepend its own separately-synthesized `<h2>${chapter.title}</h2>`
 * heading before the chapter body when building the HTML it measures —
 * independent of, and not matching, whatever `chapter.content` the real
 * rendered flow (`contentRef`) actually shows. That extra heading inflated
 * the offscreen scrollWidth relative to the real one, which could flip the
 * odd/even column-count parity `trailingLoneColumn` depends on and misapply
 * the last-page recentering shift, rendering the actual last page
 * misaligned. The measurer's HTML must be built from `chapter.content`
 * alone — no separate title synthesis of its own — so it always matches
 * what's really rendered exactly, whatever that content happens to contain.
 *
 * The Markdown parser now re-renders a chapter's own title as a real
 * heading *inside* `chapter.content` itself (see `createChapter` in
 * markdown-parser.ts), so it legitimately shows up in both the measurer and
 * the real render alike — this test's marker is expected to appear in both,
 * exactly once, not synthesized independently by the measurer.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function stubMeasurementDimensions() {
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 2000 });
  return () => {
    if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  };
}

describe('Offscreen page-count measurement matches the real rendered content', () => {
  let restoreDimensions: (() => void) | null = null;

  afterEach(() => {
    restoreDimensions?.();
    restoreDimensions = null;
  });

  it('never lets the measurer synthesize its own title heading independent of chapter.content', async () => {
    restoreDimensions = stubMeasurementDimensions();

    const TITLE_MARKER = 'UNMISTAKABLE_CHAPTER_TITLE_MARKER';
    const source: ReaderSource = {
      type: 'markdown',
      content: `# Book\n\n## ${TITLE_MARKER}\n\nSome chapter body text.`,
    };

    const { container, rerender } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await waitFor(() => expect(container.querySelector('[data-testid="header-status"]')?.textContent).toContain('Page 1 of'));

    const measurerEl = screen.getByTestId('page-count-measurer');
    const setValues: string[] = [];
    const nativeDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
    Object.defineProperty(measurerEl, 'innerHTML', {
      configurable: true,
      get(this: Element) { return nativeDescriptor.get!.call(this); },
      set(this: Element, value: string) {
        setValues.push(value);
        nativeDescriptor.set!.call(this, value);
      },
    });

    // Re-triggers the measurement effect (its dependency array includes
    // `margin`) now that the spy is attached to the freshly-mounted
    // measurer element.
    rerender(<Reader source={source} margin={48} />);
    await waitFor(() => expect(setValues.length).toBeGreaterThan(0));

    // The title now legitimately lives in chapter.content (as a real
    // heading node), so it's expected in the measured HTML too — the
    // invariant this test actually guards is that the measurer never adds
    // it a *second* time on top of what's already in that content.
    const measuredHtmlWithTitle = setValues.find(html => html.includes(TITLE_MARKER));
    expect(measuredHtmlWithTitle).toBeDefined();
    expect(setValues.some(html => html.includes('Some chapter body text'))).toBe(true);

    const countOccurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;
    const realContentHtml = container.querySelector('.ebook-reader__columns')!.innerHTML;
    expect(countOccurrences(measuredHtmlWithTitle!, TITLE_MARKER)).toBe(countOccurrences(realContentHtml, TITLE_MARKER));
  });
});
