/**
 * Regression test: the reader's root element (`data-testid="reader-content"`)
 * must carry the UI's direction, not the book's content direction.
 *
 * That root is also the Mantine portal target for every floating control
 * (Modal, Menu, Popover, Select) and, critically, the ancestor Mantine's own
 * CSS checks via a plain `[dir="rtl"]` descendant-combinator selector for
 * RTL mirroring (e.g. the settings dialog's Slider thumb/track). That
 * selector matches ANY ancestor with the attribute, not just the nearest
 * one, so if the root carried the book's direction, a nested `dir="ltr"`
 * wrapper further down could NOT override it for Mantine's CSS — every
 * floating control would render mirrored whenever book direction differs
 * from UI direction. The book's own reading column sets its own
 * `dir={state.direction}` independently, so it isn't affected by this.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';
import { ur } from '../../i18n/locales';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

describe('Reader root direction follows the UI, not the book', () => {
  it('sets dir="ltr" on the root when the book is RTL but the UI is LTR (English)', async () => {
    render(<Reader source={createMarkdownSource()} direction="rtl" />);

    const root = await screen.findByTestId('reader-content');
    await waitFor(() => expect(root.getAttribute('dir')).toBe('ltr'));
  });

  it('sets dir="rtl" on the root when the book is LTR but the UI is RTL (Urdu)', async () => {
    render(<Reader source={createMarkdownSource()} direction="ltr" translations={ur} />);

    const root = await screen.findByTestId('reader-content');
    await waitFor(() => expect(root.getAttribute('dir')).toBe('rtl'));
  });

  it('still applies the book\'s own direction to the reading column when it differs from the UI', async () => {
    render(<Reader source={createMarkdownSource()} direction="rtl" />);

    await screen.findByTestId('reader-content');
    const columns = document.querySelector('.ebook-reader__columns');
    expect(columns).not.toBeNull();
    expect(columns?.getAttribute('dir')).toBe('rtl');
  });
});
