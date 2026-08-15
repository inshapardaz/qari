/**
 * Integration test: loading a `{ type: 'pdf' }` source renders each PDF page
 * as its own single-page "chapter" containing a `pdf-page` image, and page
 * navigation (via the chapter menu) moves between rendered pages.
 *
 * `pdfjs-dist` and canvas rendering are mocked — see pdf-parser.test.ts for
 * why (jsdom has no real PDF parsing or 2D canvas support).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

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

describe('Reader with a PDF source', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
      function (this: HTMLCanvasElement) {
        return `data:image/png;base64,fake-${this.width}x${this.height}`;
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the first PDF page as an image', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(2)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);

    const page = await screen.findByTestId('pdf-page');
    const img = page.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(img?.getAttribute('alt')).toBe('Page 1');
  });

  it('does not open the image lightbox when a PDF page is clicked', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);

    const page = await screen.findByTestId('pdf-page');
    const img = page.querySelector('img')!;
    fireEvent.click(img);

    expect(screen.queryByTestId('image-lightbox')).toBeNull();
  });

  it('navigates to the next PDF page via the chapter menu', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(2)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);

    await screen.findByTestId('pdf-page');

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    await waitFor(() => {
      const img = screen.getByTestId('pdf-page').querySelector('img');
      expect(img?.getAttribute('alt')).toBe('Page 2');
    });
  });

  it('clones the ArrayBuffer before handing it to pdf.js, rather than passing the source object\'s own buffer', async () => {
    // PDF.js transfers whatever buffer it's given to its worker via
    // postMessage, which detaches (neuters) the original — if the same
    // ArrayBuffer instance were ever parsed twice (e.g. a host app passing
    // a fresh `source` object literal each render that wraps one stable
    // buffer it holds in its own state), the second attempt would fail
    // with "ArrayBuffer at index 0 is already detached". Reader.tsx must
    // clone the buffer before handing it off so this can never happen,
    // regardless of how many times loadBook runs for logically-the-same source.
    const pdfjsLib = await import('pdfjs-dist');
    const getDocumentMock = pdfjsLib.getDocument as ReturnType<typeof vi.fn>;
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const sharedBuffer = new ArrayBuffer(8);
    const source: ReaderSource = { type: 'pdf', data: sharedBuffer };
    render(<Reader source={source} />);

    await screen.findByTestId('pdf-page');

    expect(getDocumentMock).toHaveBeenCalledTimes(1);
    const passedData = getDocumentMock.mock.calls[0][0].data;
    expect(passedData).not.toBe(sharedBuffer);
    expect(passedData.byteLength).toBe(sharedBuffer.byteLength);
  });

  it('accepts a File as the pdf data source', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const file = new File([new ArrayBuffer(8)], 'test.pdf', { type: 'application/pdf' });
    const source: ReaderSource = { type: 'pdf', data: file };
    render(<Reader source={source} />);

    await screen.findByTestId('pdf-page');
  });

  it('shows a placeholder for a page beyond the initial batch, then renders it once it loads', async () => {
    // Default initialPageCount is 3, so page 5 starts out pending.
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(5)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);

    await screen.findByTestId('pdf-page');

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: 'Page 5' }));

    // Navigating to a still-pending page triggers an on-demand render for
    // it, replacing the placeholder with the real image (the mocked render
    // resolves near-instantly, so the placeholder itself isn't reliably
    // observable here — see pdf-parser.test.ts for the pending-state
    // assertion on the parser's own output, which is timing-independent).
    await waitFor(() => {
      const img = screen.getByTestId('pdf-page').querySelector('img');
      expect(img?.getAttribute('alt')).toBe('Page 5');
      expect(img?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    });
  });
});
