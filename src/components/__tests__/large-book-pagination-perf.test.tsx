/**
 * Regression test for issue #8: changing font size/family on a large book
 * froze the UI, because the "measure all chapters' page counts" effect
 * measured every chapter in one uninterrupted synchronous loop, re-running
 * from scratch on every font-size change (each stepper click re-triggers
 * it). It's now a cancellable pass that yields to the main thread between
 * batches of chapters (see CHAPTERS_PER_MEASURE_BATCH / yieldToMainThread
 * in Reader.tsx) — this checks it still produces the correct end result,
 * that it actually yields instead of running as one blocking loop, and
 * that rapid successive changes (cancelling an in-flight pass) don't
 * corrupt the final result.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createManyChapterSource(count: number): ReaderSource {
  const chapters = Array.from({ length: count }, (_, i) => `## Chapter ${i + 1}\n\nContent for chapter ${i + 1}.`).join('\n\n');
  return { type: 'markdown', content: `# Big Book\n\n${chapters}` };
}

// The bulk "measure all chapters" effect reads clientWidth/scrollWidth at
// the moment it runs (on mount and on its own dependency changes) rather
// than in response to a 'resize' event, so — unlike the single-chapter
// recalcPages tests elsewhere — the stub has to be in place *before* the
// component ever mounts, hence prototype-level rather than per-element.
function stubMeasurementDimensions() {
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  // pagePitch = clientWidth - margin*2 + 64 = 1000 - 64 + 64 = 1000 (default margin 32).
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
  // round(2000 / 1000) = 2 pages per chapter.
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 2000 });
  return () => {
    if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    if (originalScrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  };
}

// With more than one chapter, the footer also renders a "· Chapter X of Y"
// suffix as a sibling text node after the page indicator, so the footer's
// full textContent (not screen.getByText, which needs an exact match) is
// what's checked here.
async function waitForFooterText(container: HTMLElement, expected: string) {
  await waitFor(
    () => expect(container.querySelector('.ebook-reader__footer')?.textContent).toBe(expected),
    { timeout: 5000 }
  );
}

describe('Large-book page-count measurement performance', () => {
  let restoreDimensions: (() => void) | null = null;

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreDimensions?.();
    restoreDimensions = null;
  });

  it('eventually produces the correct total across every chapter of a large book', async () => {
    restoreDimensions = stubMeasurementDimensions();
    const CHAPTER_COUNT = 12;
    const { container } = render(<Reader source={createManyChapterSource(CHAPTER_COUNT)} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // 12 chapters * 2 pages/chapter = 24.
    await waitForFooterText(container, 'Page 1 of 24 · Chapter 1 of 12');
  });

  it('yields to the main thread between batches instead of measuring the whole book in one blocking loop', async () => {
    const idleCallbackSpy = vi.fn((cb: () => void) => {
      cb();
      return 0;
    });
    vi.stubGlobal('requestIdleCallback', idleCallbackSpy);
    restoreDimensions = stubMeasurementDimensions();

    const CHAPTER_COUNT = 12;
    const { container } = render(<Reader source={createManyChapterSource(CHAPTER_COUNT)} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await waitForFooterText(container, 'Page 1 of 24 · Chapter 1 of 12');

    expect(idleCallbackSpy.mock.calls.length).toBeGreaterThan(0);
  });

  it('produces the correct final total even when font size changes rapidly mid-measurement (cancelling in-flight passes)', async () => {
    restoreDimensions = stubMeasurementDimensions();
    const CHAPTER_COUNT = 12;
    const { container, rerender } = render(<Reader source={createManyChapterSource(CHAPTER_COUNT)} fontSize={16} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // Simulate a user clicking a font-size stepper repeatedly before any
    // single pass has a chance to finish — each rerender should cancel the
    // previous in-flight measurement pass rather than let a stale one race
    // with (and possibly overwrite) the latest.
    for (const size of [18, 20, 22, 24]) {
      rerender(<Reader source={createManyChapterSource(CHAPTER_COUNT)} fontSize={size} />);
    }

    await waitForFooterText(container, 'Page 1 of 24 · Chapter 1 of 12');
  });
});
