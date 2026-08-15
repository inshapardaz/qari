/**
 * Regression test: the chapter drawer (and its bookmarks/notes tabs), theme
 * panel, layout panel, settings dialog (and its font Select), and the image
 * lightbox must portal their floating content inside the reader's own root
 * element rather than as a document.body-level sibling.
 *
 * This matters specifically for fullscreen mode: `rootRef.current` is the
 * element passed to `requestFullscreen()`, and the Fullscreen API promotes
 * it to the browser's "top layer" — content portaled outside its subtree
 * (Mantine's default, document.body) renders behind it regardless of
 * z-index. Portaling inside the reader's own root keeps floating UI in the
 * same subtree, so it stays visible in fullscreen too.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world with an image'): ReaderSource {
  return { type: 'markdown', content };
}

/** True if `el` is a descendant of the reader's own root element. */
function isInsideReaderRoot(el: Element): boolean {
  return el.closest('[data-testid="reader-content"]') !== null;
}

describe('Mantine floating UI portals inside the reader root (fullscreen top-layer fix)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('portals the chapter drawer inside the reader root', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const panel = await screen.findByTestId('chapter-menu-panel');

    expect(isInsideReaderRoot(panel)).toBe(true);
  });

  it("portals the chapter drawer's Bookmarks tab inside the reader root", async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    const panel = await screen.findByTestId('bookmark-panel');

    expect(isInsideReaderRoot(panel)).toBe(true);
  });

  it("portals the chapter drawer's Notes tab inside the reader root", async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    const panel = await screen.findByTestId('note-panel');

    expect(isInsideReaderRoot(panel)).toBe(true);
  });

  it('portals the theme panel inside the reader root', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    const panel = await screen.findByTestId('theme-panel');

    expect(isInsideReaderRoot(panel)).toBe(true);
  });

  it('portals the layout panel inside the reader root', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    const panel = await screen.findByTestId('layout-panel');

    expect(isInsideReaderRoot(panel)).toBe(true);
  });

  it('portals the settings dialog inside the reader root', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
    const panel = await screen.findByTestId('settings-panel');

    expect(isInsideReaderRoot(panel)).toBe(true);
  });

  it('portals the font family Select dropdown (nested inside the settings dialog) inside the reader root', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
    const input = (await screen.findAllByLabelText('Font Family')).find((el) => el.tagName === 'INPUT')!;
    fireEvent.click(input);
    const options = await screen.findAllByRole('option');

    expect(options.length).toBeGreaterThan(0);
    expect(isInsideReaderRoot(options[0])).toBe(true);
  });

  it('portals the image lightbox modal inside the reader root', async () => {
    render(<Reader source={createMarkdownSource('# Test\n\n## Ch1\n\n![alt text](https://example.com/img.png)')} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByAltText('alt text'));
    const lightbox = await screen.findByTestId('image-lightbox');

    expect(isInsideReaderRoot(lightbox)).toBe(true);
  });
});
