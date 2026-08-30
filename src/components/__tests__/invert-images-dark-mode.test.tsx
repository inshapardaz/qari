/**
 * Regular content images (block `![alt](src)` images and inline images
 * alike) are baked-in pixels, just like PDF pages — the reading theme's CSS
 * custom properties can't recolor them, so a bright image glares against a
 * dark-background theme (dark/quiet/high-contrast) the same way an
 * un-inverted PDF page would (see `pdf-source.test.tsx`'s own inversion
 * tests). `invertImagesInDarkMode` (prop, default true; also settable live
 * from the theme settings panel) extends that same `invert(1)
 * hue-rotate(180deg)` treatment to content images, and lets a consumer (or
 * the reader's own settings panel) opt out.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSourceWithImages(): ReaderSource {
  return {
    type: 'markdown',
    // A paragraph containing *only* an image parses as a block 'image' node
    // (rendered as a <figure><img>); an image alongside other text in the
    // same paragraph parses as an inline-image node instead (see
    // markdown-parser.ts) — this source exercises both.
    content: '# Test Book\n\n## Chapter 1\n\n![Cover](cover.png)\n\nSome text with an inline image ![Inline](inline.png) too.',
  };
}

async function openThemePanel() {
  await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
  return screen.findByTestId('theme-panel');
}

describe('invertImagesInDarkMode', () => {
  it('inverts block and inline content image colors under a dark theme by default', async () => {
    const { container } = render(<Reader source={createSourceWithImages()} theme="dark" />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const blockImg = container.querySelector('figure img') as HTMLImageElement;
    const inlineImg = container.querySelector('p img') as HTMLImageElement;
    expect(blockImg).toHaveStyle({ filter: 'invert(1) hue-rotate(180deg)' });
    expect(inlineImg).toHaveStyle({ filter: 'invert(1) hue-rotate(180deg)' });
  });

  it('does not invert content image colors under a light theme', async () => {
    const { container } = render(<Reader source={createSourceWithImages()} theme="light" />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const blockImg = container.querySelector('figure img') as HTMLImageElement;
    const inlineImg = container.querySelector('p img') as HTMLImageElement;
    expect(blockImg.style.filter).toBe('');
    expect(inlineImg.style.filter).toBe('');
  });

  it('does not invert content image colors under a dark theme when the prop is explicitly disabled', async () => {
    const { container } = render(<Reader source={createSourceWithImages()} theme="dark" invertImagesInDarkMode={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const img = container.querySelector('figure img') as HTMLImageElement;
    expect(img.style.filter).toBe('');
  });

  it('shows the theme panel toggle only while a dark-background theme is active, and it reflects the current prop value', async () => {
    const { rerender } = render(<Reader source={createSourceWithImages()} theme="light" />);
    const lightPanel = await openThemePanel();
    expect(lightPanel.querySelector('[data-testid="theme-panel-invert-images"]')).not.toBeInTheDocument();

    rerender(<Reader source={createSourceWithImages()} theme="dark" invertImagesInDarkMode={false} />);
    const darkPanel = await screen.findByTestId('theme-panel');
    const toggleEl = darkPanel.querySelector('[data-testid="theme-panel-invert-images"]') as HTMLElement;
    const toggle = (toggleEl.tagName === 'INPUT' ? toggleEl : toggleEl.querySelector('input')) as HTMLInputElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle.checked).toBe(false);
  });

  it('toggling the theme panel switch calls onSettingsChange with invertImagesInDarkMode', async () => {
    let latestSettings: Record<string, unknown> = {};
    render(
      <Reader
        source={createSourceWithImages()}
        theme="dark"
        onSettingsChange={(s) => { latestSettings = { ...latestSettings, ...s }; }}
      />
    );
    const panel = await openThemePanel();

    const toggleEl = panel.querySelector('[data-testid="theme-panel-invert-images"]') as HTMLElement;
    const toggle = (toggleEl.tagName === 'INPUT' ? toggleEl : toggleEl.querySelector('input')) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);
    expect(latestSettings).toEqual({ invertImagesInDarkMode: false });
  });
});
