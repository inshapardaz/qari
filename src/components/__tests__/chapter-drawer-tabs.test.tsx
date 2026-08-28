/**
 * The chapter menu (☰ button) is a drawer, scoped to the reader root, with
 * the book's details pinned above three tabs — Chapters (the default),
 * Bookmarks, and Notes. See Reader.tsx's `chapterDrawerTab` state and the
 * Drawer.Root block in its header. Other aspects of this drawer are covered
 * elsewhere: book-info.test.tsx (the book details block), the
 * chapter-selection/navigation behavior (progress-tracking.test.tsx,
 * hover-nav-after-overlay-close.test.tsx), portal scoping
 * (mantine-portal-target.test.tsx), and side anchoring
 * (header-panel-ui-direction.test.tsx).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world\n\n## Chapter 2\n\nMore content',
  };
}

async function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  return screen.findByTestId('chapter-menu-panel');
}

describe('Chapter drawer tabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens with the Chapters tab active by default, showing the chapter list', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const panel = await openDrawer();

    expect(within(panel).getByRole('tab', { name: 'Chapters', selected: true })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Chapter 1' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Chapter 2' })).toBeInTheDocument();
  });

  it('switches to the Bookmarks tab and shows the bookmark panel instead of the chapter list', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const panel = await openDrawer();
    fireEvent.click(within(panel).getByRole('tab', { name: 'Bookmarks' }));

    expect(within(panel).getByTestId('bookmark-panel')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Chapter 1' })).not.toBeInTheDocument();
  });

  it('switches to the Notes tab and shows the note panel instead of the chapter list', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const panel = await openDrawer();
    fireEvent.click(within(panel).getByRole('tab', { name: 'Notes' }));

    expect(within(panel).getByTestId('note-panel')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Chapter 1' })).not.toBeInTheDocument();
  });

  it('keeps the book info block visible above the tabs regardless of which tab is active', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const panel = await openDrawer();
    expect(within(panel).getByTestId('book-info')).toHaveTextContent('Test Book');

    fireEvent.click(within(panel).getByRole('tab', { name: 'Notes' }));
    expect(within(panel).getByTestId('book-info')).toHaveTextContent('Test Book');
  });

  it('still has a modal backdrop (blocks/closes on outside click) but dims lightly rather than hiding the rest of the reader', async () => {
    // Regression test: the drawer is portalled into the reader root, which
    // spans the header/titlebar and content viewport as well as the drawer
    // itself (see the root's own `transform` comment) — Mantine's default
    // 60%-black Drawer.Overlay backdrop would then dim the *entire* reader,
    // header included, not just the content behind the drawer, reading as
    // the rest of the reader disappearing while it's open. It's still a
    // modal (the overlay element is present, blocking/closing on outside
    // clicks) — just a much lighter scrim (`backgroundOpacity={0.25}`)
    // than Mantine's default, so the header/content stay visible (just
    // dimmed) rather than hidden behind a dark scrim. A
    // `backdrop-filter: blur()` was tried first for a frosted-glass look,
    // but Chromium doesn't reliably composite it through the page content's
    // own `transform: translateX(...)` (used for column-pagination page
    // turns) — it could render fully opaque instead of blurring, hiding the
    // pages completely. A plain low-opacity scrim doesn't have that failure
    // mode.
    const { container } = render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openDrawer();

    const overlay = container.querySelector('.mantine-Overlay-root') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.getPropertyValue('--overlay-bg')).toBe('rgba(0, 0, 0, 0.25)');
    expect(overlay.style.getPropertyValue('--overlay-filter')).toBeFalsy();
    // The header's own controls are still present (not unmounted/hidden).
    expect(screen.getByRole('button', { name: 'Table of contents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reading settings' })).toBeInTheDocument();
  });
});
