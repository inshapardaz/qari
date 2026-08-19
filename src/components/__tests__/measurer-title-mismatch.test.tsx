/**
 * Regression test for issue #14: the offscreen per-chapter measurement pass
 * (`measureAllChapters`, which feeds `pagesPerChapter`/`trailingLoneColumn`)
 * used to prepend a `<h2>${chapter.title}</h2>` heading before the chapter
 * body when building the HTML it measures — but the real rendered content
 * (`contentRef`) never shows a title inside the paginated flow at all (it's
 * shown separately in the header bar, via `chapterTitle`). That extra
 * heading inflated the offscreen scrollWidth relative to the real one,
 * which could flip the odd/even column-count parity `trailingLoneColumn`
 * depends on and misapply the last-page recentering shift, rendering the
 * actual last page misaligned. The measurer's HTML must be built from the
 * chapter body alone, exactly matching what's really rendered.
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

  it('never injects the chapter title into the measurer, matching the real title-less content flow', async () => {
    restoreDimensions = stubMeasurementDimensions();

    const TITLE_MARKER = 'UNMISTAKABLE_CHAPTER_TITLE_MARKER';
    const source: ReaderSource = {
      type: 'markdown',
      content: `# Book\n\n## ${TITLE_MARKER}\n\nSome chapter body text.`,
    };

    const { container, rerender } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await waitFor(() => expect(container.querySelector('.ebook-reader__footer')?.textContent).toContain('Page 1 of'));

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

    expect(setValues.some(html => html.includes(TITLE_MARKER))).toBe(false);
    expect(setValues.some(html => html.includes('Some chapter body text'))).toBe(true);
  });
});
