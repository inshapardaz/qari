/**
 * An in-content image (e.g. an EPUB title/cover page whose only content is
 * a cover image) used to size itself against `calc(100vh - 120px)` — a
 * guess at the *browser viewport's* height that has no idea how tall the
 * reader's own rendered box actually is, nor that two-column pagination
 * mode already spends 2×2rem of a column's height on the content div's own
 * padding. A cover image scaled to fill a column's full width often comes
 * out taller than that column's *real* available height once the guess is
 * wrong, and CSS multi-column's `break-inside: avoid` (see the image's own
 * wrapping `<figure>`) then bumps the *whole* image into the next column
 * instead of shrinking to fit — an EPUB title page rendering as the
 * spread's second page instead of its first. `--reader-page-content-height`
 * (see `pageContentHeight` in Reader.tsx) fixes this by capping the image
 * at the real per-column content height in paginated mode, so it always
 * fits within one column and never forces that break.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSourceWithImage(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\n![Cover](cover.png)',
  };
}

describe('Image max-height respects the real per-column content height', () => {
  it('sets --reader-page-content-height on the reader root once the page box is measured, in paginated mode', async () => {
    // A single shared `source` object, reused (same reference) across the
    // initial render and the `rerender` below — see
    // two-column-trailing-page.test.tsx for why: the reader reloads the
    // whole book whenever `source` changes identity, which would reset the
    // DOM (and the clientHeight stub below) if each render passed a fresh
    // object.
    const source = createSourceWithImage();
    const { container, rerender } = render(<Reader source={source} columns={2} scroll={false} />);
    const root = await screen.findByTestId('reader-content');
    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;

    Object.defineProperty(pageBoxEl, 'clientHeight', { value: 800, configurable: true });
    // A prop change (margin) is what re-triggers the render that re-reads
    // the now-stubbed clientHeight — mirrors the pattern
    // two-column-trailing-page.test.tsx uses for the equivalent
    // clientWidth-dependent geometry.
    rerender(<Reader source={source} columns={2} scroll={false} margin={40} />);

    // 800 - 64 (2x2rem content padding) - 40 (figure margin + rounding
    // slack) — see `pageContentHeight`'s own comment in Reader.tsx.
    await waitFor(() => {
      expect(root.style.getPropertyValue('--reader-page-content-height')).toBe('696px');
    });
  });

  it('does not set --reader-page-content-height in scroll mode', async () => {
    render(<Reader source={createSourceWithImage()} scroll={true} />);
    const root = await screen.findByTestId('reader-content');

    expect(root.style.getPropertyValue('--reader-page-content-height')).toBe('');
  });

  it("references --reader-page-content-height (falling back to the old viewport calc) in the rendered image's max-height", async () => {
    render(<Reader source={createSourceWithImage()} columns={2} scroll={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const img = document.querySelector('.ebook-reader__columns img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.style.maxHeight).toBe('var(--reader-page-content-height, calc(100vh - 120px))');
  });
});
