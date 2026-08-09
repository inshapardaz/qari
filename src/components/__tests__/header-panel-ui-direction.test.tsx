/**
 * Regression test: the chapter menu and bookmarks panel dropdowns must
 * anchor to the side of the header matching the UI direction, not the
 * book's content direction. The header lays out its buttons via
 * `dir={t.uiDirection}`, so a dropdown anchored by content direction ends
 * up on the wrong side (and off-screen) whenever an RTL book is read in an
 * LTR UI, or vice versa.
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

  it('anchors the chapter menu to the left and bookmarks panel to the right when the book is RTL but the UI is LTR (English)', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} direction="rtl" />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const chapterPanel = screen.getByTestId('chapter-menu-panel');
    expect(chapterPanel.style.left).toBe('0px');
    expect(chapterPanel.style.right).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }));
    const bookmarksPanel = screen.getByTestId('bookmarks-panel');
    expect(bookmarksPanel.style.right).toBe('0px');
    expect(bookmarksPanel.style.left).toBe('');
  });

  it('anchors the chapter menu to the right and bookmarks panel to the left when the book is LTR but the UI is RTL (Urdu)', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} direction="ltr" translations={ur} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: ur.tableOfContents }));
    const chapterPanel = screen.getByTestId('chapter-menu-panel');
    expect(chapterPanel.style.right).toBe('0px');
    expect(chapterPanel.style.left).toBe('');

    fireEvent.click(screen.getByRole('button', { name: ur.bookmarks }));
    const bookmarksPanel = screen.getByTestId('bookmarks-panel');
    expect(bookmarksPanel.style.left).toBe('0px');
    expect(bookmarksPanel.style.right).toBe('');
  });
});
