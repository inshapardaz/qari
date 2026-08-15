/**
 * Integration tests for the header Bookmarks button: it bookmarks/unbookmarks
 * the current page directly (no picker), toggling in place — see
 * `handleToggleBookmark` in Reader.tsx. The full bookmark list itself lives
 * in the chapter drawer's Bookmarks tab (see chapter-drawer.test.tsx).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

async function openDrawerBookmarksTab() {
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  const panel = await screen.findByTestId('chapter-menu-panel');
  fireEvent.click(within(panel).getByRole('tab', { name: 'Bookmarks' }));
  return panel;
}

describe('Bookmarks button toggles a bookmark for the current page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is unpressed with no bookmark on first load', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('creates a bookmark for the current page on click, and shows it in the drawer', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    const panel = await openDrawerBookmarksTab();
    expect(within(panel).getByTestId('bookmark-list')).toHaveTextContent('Chapter 1, Page 1');
  });

  it('removes the bookmark on a second click (toggle off)', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const button = screen.getByRole('button', { name: 'Bookmarks' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));

    const panel = await openDrawerBookmarksTab();
    expect(within(panel).getByTestId('bookmark-empty')).toBeInTheDocument();
  });

  it('does not show the Bookmarks button when enableBookmarks is false', async () => {
    render(<Reader source={createMarkdownSource()} enableBookmarks={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Bookmarks' })).not.toBeInTheDocument();
  });
});
