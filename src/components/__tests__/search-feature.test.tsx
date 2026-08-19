/**
 * Integration tests for in-book search (issue #11): the chapter drawer's
 * Search tab, typing a query, the debounced result list, and clicking a
 * result to navigate to its chapter/page.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello wonderful world\n\n## Chapter 2\n\nA needle in a haystack',
  };
}

// Mirrors pdf-source.test.tsx's mocking of `pdfjs-dist` (jsdom has no real
// PDF parsing or 2D canvas support) — only used by the last test below.
function createFakePdfDocument(numPages: number) {
  return {
    numPages,
    getPage: () =>
      Promise.resolve({
        getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 200 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    getMetadata: () => Promise.resolve({ info: { Title: 'Test PDF' } }),
  };
}

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

async function openSearchTab() {
  await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  const panel = await screen.findByTestId('chapter-menu-panel');
  fireEvent.click(within(panel).getByRole('tab', { name: 'Search' }));
  return panel;
}

describe('Search feature', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the empty state before typing a query', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    expect(within(panel).getByTestId('search-empty')).toBeInTheDocument();
  });

  it('finds a match and shows its chapter and snippet, debounced', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    fireEvent.change(within(panel).getByTestId('search-input'), { target: { value: 'needle' } });

    await waitFor(() => expect(within(panel).getByTestId('search-list')).toBeInTheDocument());
    const resultButton = within(panel).getByRole('button', { name: /Go to result in Chapter 2/ });
    expect(within(resultButton).getByText('Chapter 2')).toBeInTheDocument();
    expect(within(resultButton).getByText('needle')).toBeInTheDocument();
  });

  it('shows a no-results state for a query that matches nothing', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    fireEvent.change(within(panel).getByTestId('search-input'), { target: { value: 'zzzznotfound' } });

    await waitFor(() => expect(within(panel).getByTestId('search-no-results')).toBeInTheDocument());
  });

  it('shows no clear button before typing, and clears the query and results when clicked', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    expect(within(panel).queryByTestId('search-clear')).not.toBeInTheDocument();

    fireEvent.change(within(panel).getByTestId('search-input'), { target: { value: 'needle' } });
    await waitFor(() => expect(within(panel).getByTestId('search-list')).toBeInTheDocument());

    fireEvent.click(within(panel).getByTestId('search-clear'));

    expect(within(panel).getByTestId('search-input')).toHaveValue('');
    await waitFor(() => expect(within(panel).getByTestId('search-empty')).toBeInTheDocument());
    expect(within(panel).queryByTestId('search-clear')).not.toBeInTheDocument();
  });

  it('navigates to the matched chapter and closes the drawer on result click', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    fireEvent.change(within(panel).getByTestId('search-input'), { target: { value: 'haystack' } });
    await waitFor(() => expect(within(panel).getByTestId('search-list')).toBeInTheDocument());

    fireEvent.click(within(panel).getByRole('button', { name: /Go to result in Chapter 2/ }));

    await waitFor(() => expect(screen.queryByTestId('chapter-menu-panel')).not.toBeInTheDocument());
    expect(document.body.textContent).toContain('A needle in a haystack');
  });

  it('selects the matched text in the reading view after navigating to a result', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    fireEvent.change(within(panel).getByTestId('search-input'), { target: { value: 'haystack' } });
    await waitFor(() => expect(within(panel).getByTestId('search-list')).toBeInTheDocument());

    fireEvent.click(within(panel).getByRole('button', { name: /Go to result in Chapter 2/ }));

    await waitFor(() => expect(screen.queryByTestId('chapter-menu-panel')).not.toBeInTheDocument());
    await waitFor(() => expect(window.getSelection()?.toString().toLowerCase()).toBe('haystack'));
  });

  it('persists the query and results after closing and reopening the drawer', async () => {
    render(<Reader source={createMarkdownSource()} />);
    const panel = await openSearchTab();

    fireEvent.change(within(panel).getByTestId('search-input'), { target: { value: 'needle' } });
    await waitFor(() => expect(within(panel).getByTestId('search-list')).toBeInTheDocument());

    // Close the drawer (toggling the same button that opens it) without
    // clicking a result, then reopen and switch back to the Search tab.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await waitFor(() => expect(screen.queryByTestId('chapter-menu-panel')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const reopenedPanel = await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(within(reopenedPanel).getByRole('tab', { name: 'Search' }));

    expect(within(reopenedPanel).getByTestId('search-input')).toHaveValue('needle');
    expect(within(reopenedPanel).getByTestId('search-list')).toBeInTheDocument();
    expect(within(reopenedPanel).getByRole('button', { name: /Go to result in Chapter 2/ })).toBeInTheDocument();
  });

  describe('with a PDF source (no extractable text)', () => {
    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,fake');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('hides the Search tab', async () => {
      const pdfjsLib = await import('pdfjs-dist');
      (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
        promise: Promise.resolve(createFakePdfDocument(2)),
      });

      const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
      render(<Reader source={source} />);
      await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
      const panel = await screen.findByTestId('chapter-menu-panel');

      expect(within(panel).queryByRole('tab', { name: 'Search' })).not.toBeInTheDocument();
    });
  });
});
