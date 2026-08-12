/**
 * Tests for the "book info" feature: the chapter menu shows the book's
 * title/author/cover, sourced from the parsed source's metadata by default
 * but overridden field-by-field by the `bookInfo` prop when given — see the
 * doc comment on `bookInfo` in Reader.tsx.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

async function openChapterMenu() {
  const menuButton = await screen.findByRole('button', { name: 'Table of contents' });
  fireEvent.click(menuButton);
  await screen.findByTestId('chapter-menu-panel');
}

describe('Book info', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the parsed title in the chapter menu by default', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openChapterMenu();

    const info = screen.getByTestId('book-info');
    expect(info).toHaveTextContent('Test Book');
  });

  it('prefers the bookInfo prop over the parsed title/author', async () => {
    render(
      <Reader
        source={createMarkdownSource()}
        bookInfo={{ title: 'Overridden Title', author: 'Overridden Author' }}
      />
    );
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openChapterMenu();

    const info = screen.getByTestId('book-info');
    expect(info).toHaveTextContent('Overridden Title');
    expect(info).toHaveTextContent('Overridden Author');
    expect(info).not.toHaveTextContent('Test Book');
  });

  it('reports the merged metadata via onReady', async () => {
    const onReady = vi.fn();
    render(
      <Reader
        source={createMarkdownSource()}
        bookInfo={{ author: 'Overridden Author' }}
        onReady={onReady}
      />
    );

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({
          book: expect.objectContaining({ title: 'Test Book', author: 'Overridden Author' }),
        })
      );
    });
  });

  it('renders the cover image when bookInfo supplies one', async () => {
    render(
      <Reader
        source={createMarkdownSource()}
        bookInfo={{ coverImage: 'https://example.com/cover.jpg' }}
      />
    );
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openChapterMenu();

    const info = screen.getByTestId('book-info');
    const img = info.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });
});
