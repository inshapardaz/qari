/**
 * Regression test: the chapter menu and bookmarks panel dropdowns must open
 * on the side of the header matching the UI direction, not the book's
 * content direction. The header lays out its buttons via `dir={t.uiDirection}`,
 * so a dropdown positioned by content direction would end up on the wrong
 * side (and potentially off-screen) whenever an RTL book is read in an LTR
 * UI, or vice versa.
 *
 * Positioning itself is delegated to Mantine's Menu/Popover (floating-ui),
 * so this asserts the resolved `data-position` placement rather than raw
 * inline left/right styles.
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

describe('Header panel anchoring follows UI direction, not book content direction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens the chapter menu bottom-start and bookmarks panel bottom-end when the book is RTL but the UI is LTR (English)', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} direction="rtl" />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const chapterPanel = await screen.findByTestId('chapter-menu-panel');
    expect(chapterPanel.getAttribute('data-position')).toBe('bottom-start');

    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
    const bookmarksPanel = await screen.findByTestId('bookmarks-panel');
    expect(bookmarksPanel.getAttribute('data-position')).toBe('bottom-end');
  });

  it('opens the chapter menu bottom-end and bookmarks panel bottom-start when the book is LTR but the UI is RTL (Urdu)', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} direction="ltr" translations={ur} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: ur.tableOfContents }));
    const chapterPanel = await screen.findByTestId('chapter-menu-panel');
    expect(chapterPanel.getAttribute('data-position')).toBe('bottom-end');

    fireEvent.click(screen.getByRole('button', { name: ur.bookmarks }));
    const bookmarksPanel = await screen.findByTestId('bookmarks-panel');
    expect(bookmarksPanel.getAttribute('data-position')).toBe('bottom-start');
  });
});
