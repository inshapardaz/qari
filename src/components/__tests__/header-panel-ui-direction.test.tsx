/**
 * Regression test: the chapter drawer must open on the side of the header
 * matching the UI direction, not the book's content direction — physically
 * on the right when the UI is RTL (e.g. Urdu), physically on the left when
 * it's LTR, regardless of which direction the book content itself reads in.
 *
 * The drawer's `position` prop is intentionally the *same* constant
 * ('left') in both cases rather than flipped per direction — Mantine's
 * position values are logical/direction-relative (`'left'` means CSS
 * flex-start, `'right'` means flex-end), and the reader root's own
 * `dir={t.uiDirection}` (an ancestor of the drawer, since it's portalled
 * within the reader root — see `mantineContentPortalTarget`) already makes
 * the browser mirror flex-start/flex-end to the correct physical side on
 * its own. Manually flipping `position` per direction on top of that
 * double-flips it, landing the drawer on the *wrong* physical side under
 * RTL — confirmed visually in a real browser (screenshots comparing before/
 * after), since jsdom has no real layout engine and can't itself resolve
 * `direction`-dependent flex-end/flex-start into a physical position. What
 * this test file *can* assert from jsdom: the drawer's `position` prop
 * stays constant regardless of UI direction (no `--drawer-justify: flex-end`
 * in either branch — see `drawerJustifiesEnd`'s comment), and that the
 * reader root's `dir` attribute — the thing that actually drives the
 * physical mirroring in a real browser — matches the active UI direction.
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

/** True if the drawer root's `--drawer-justify` var docks it to the end (flex-end) side. */
function drawerJustifiesEnd(panel: HTMLElement): boolean {
  const root = panel.closest('.mantine-Drawer-root') as HTMLElement | null;
  return !!root?.style.cssText.includes('--drawer-justify: flex-end');
}

describe('Chapter drawer anchoring follows UI direction, not book content direction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the same drawer position (flex-start, not flex-end) when the book is RTL but the UI is LTR (English)', async () => {
    const source = createMarkdownSource();
    const { container } = render(<Reader source={source} direction="rtl" />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    expect(container.querySelector('.ebook-reader')?.getAttribute('dir')).toBe('ltr');

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const drawerPanel = await screen.findByTestId('chapter-menu-panel');
    expect(drawerJustifiesEnd(drawerPanel)).toBe(false);
  });

  it('uses the same drawer position (flex-start, not flex-end) when the book is LTR but the UI is RTL (Urdu) — the reader root\'s own dir is what actually mirrors it to the physical right', async () => {
    const source = createMarkdownSource();
    const { container } = render(<Reader source={source} direction="ltr" translations={ur} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    expect(container.querySelector('.ebook-reader')?.getAttribute('dir')).toBe('rtl');

    fireEvent.click(screen.getByRole('button', { name: ur.tableOfContents }));
    const drawerPanel = await screen.findByTestId('chapter-menu-panel');
    expect(drawerJustifiesEnd(drawerPanel)).toBe(false);
  });
});
