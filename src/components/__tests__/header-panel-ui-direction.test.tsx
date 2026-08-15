/**
 * Regression test: the chapter drawer must open on the side of the header
 * matching the UI direction, not the book's content direction. The header
 * lays out its buttons via `dir={t.uiDirection}`, so a drawer positioned by
 * content direction would end up on the wrong side (and potentially
 * off-screen) whenever an RTL book is read in an LTR UI, or vice versa.
 *
 * The drawer's side isn't exposed as a simple DOM attribute — Mantine
 * encodes `position="right"` as a `--drawer-justify: flex-end` CSS custom
 * property on the drawer root (left is the unset default), so that's what
 * this asserts rather than a floating-ui `data-position` (which Drawer,
 * unlike Menu/Popover, doesn't produce).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';
import { ur } from '../../i18n/locales';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

/** True if the drawer root's `--drawer-justify` var docks it to the end (right) side. */
function drawerJustifiesEnd(panel: HTMLElement): boolean {
  const root = panel.closest('.mantine-Drawer-root') as HTMLElement | null;
  return !!root?.style.cssText.includes('--drawer-justify: flex-end');
}

describe('Chapter drawer anchoring follows UI direction, not book content direction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens the chapter drawer on the left when the book is RTL but the UI is LTR (English)', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} direction="rtl" />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const drawerPanel = await screen.findByTestId('chapter-menu-panel');
    expect(drawerJustifiesEnd(drawerPanel)).toBe(false);
  });

  it('opens the chapter drawer on the right when the book is LTR but the UI is RTL (Urdu)', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} direction="ltr" translations={ur} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: ur.tableOfContents }));
    const drawerPanel = await screen.findByTestId('chapter-menu-panel');
    expect(drawerJustifiesEnd(drawerPanel)).toBe(true);
  });
});
