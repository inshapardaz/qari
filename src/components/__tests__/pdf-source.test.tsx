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
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

  it('renders two PDF pages side by side in two-column (spread) mode', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(4)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} columns={2} />);

    await waitFor(() => {
      const pages = screen.getAllByTestId('pdf-page');
      expect(pages.map(p => p.querySelector('img')?.getAttribute('alt'))).toEqual(['Page 1', 'Page 2']);
    });
  });

  it.each(['dark', 'quiet', 'high-contrast'] as const)('inverts the PDF page image colors under the %s theme', async (theme) => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} theme={theme} />);
    const page = await screen.findByTestId('pdf-page');

    expect(page.querySelector('img')).toHaveStyle({ filter: 'invert(1) hue-rotate(180deg)' });
  });

  it.each(['light', 'calm', 'paper', 'focus'] as const)('does not invert the PDF page image colors under the %s theme', async (theme) => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} theme={theme} />);
    const page = await screen.findByTestId('pdf-page');

    expect(page.querySelector('img')?.style.filter).toBe('');
  });

  it('does not invert the PDF page image colors under a dark theme when invertImagesInDarkMode is explicitly disabled', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} theme="dark" invertImagesInDarkMode={false} />);
    const page = await screen.findByTestId('pdf-page');

    expect(page.querySelector('img')?.style.filter).toBe('');
  });

  it('steps by two pages at a time when paging through a spread', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(4)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    const { container } = render(<Reader source={source} columns={2} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('pdf-page')).toHaveLength(2);
    });

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      const pages = screen.getAllByTestId('pdf-page');
      expect(pages.map(p => p.querySelector('img')?.getAttribute('alt'))).toEqual(['Page 3', 'Page 4']);
    });

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Previous page' }));

    await waitFor(() => {
      const pages = screen.getAllByTestId('pdf-page');
      expect(pages.map(p => p.querySelector('img')?.getAttribute('alt'))).toEqual(['Page 1', 'Page 2']);
    });
  });

  it('lays out an RTL spread with plain row direction, not row-reverse, so `dir` alone determines page order', async () => {
    // Regression test: the spread container sets `dir={state.direction}`,
    // which already flips the flex main axis for RTL (first DOM child lands
    // on the right, not the left). Also setting `flexDirection: row-reverse`
    // for RTL cancels that back out to LTR-like (left-to-right) positioning
    // — the earlier page (spreadStart, first in DOM) must stay the *first*
    // child regardless of direction; only `dir` should determine which side
    // of the screen it renders on.
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(4)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    const { container } = render(<Reader source={source} columns={2} direction="rtl" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('pdf-page')).toHaveLength(2);
    });

    const spreadEl = container.querySelector('.ebook-reader__pdf-spread') as HTMLElement;
    expect(spreadEl).toHaveAttribute('dir', 'rtl');
    expect(spreadEl.style.flexDirection).toBe('row');

    const pages = screen.getAllByTestId('pdf-page');
    expect(pages.map(p => p.querySelector('img')?.getAttribute('alt'))).toEqual(['Page 1', 'Page 2']);
  });

  it('zooms a single PDF page and scrolls to reveal the part that no longer fits', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    const { container } = render(<Reader source={source} />);
    await screen.findByTestId('pdf-page');

    // Not shown for non-PDF books, and not exposed as the (meaningless for
    // PDFs) text-settings panel's controls.
    expect(screen.queryByRole('button', { name: 'Reading settings' })).toBeNull();

    const zoomIn = screen.getByRole('button', { name: /Zoom in/ });
    const zoomOut = screen.getByRole('button', { name: /Zoom out/ });
    expect(zoomIn).not.toBeDisabled();
    expect(zoomOut).not.toBeDisabled();

    // Regression test: these used Mantine's plain bordered `variant="default"`
    // button style, visually inconsistent with every other header button
    // (bookmark, theme, layout, fullscreen), which are all transparent
    // icon-only buttons colored from the reading theme, not Mantine's
    // default palette.
    expect(zoomIn).toHaveStyle({ color: 'var(--reader-fg, #1a1a1a)' });
    expect(zoomOut).toHaveStyle({ color: 'var(--reader-fg, #1a1a1a)' });
    expect(screen.getByText('100%')).toHaveStyle({ color: 'var(--reader-fg, #1a1a1a)' });

    const scrollEl = container.querySelector('.ebook-reader__pdf-zoom-scroll') as HTMLElement;
    const spreadEl = container.querySelector('.ebook-reader__pdf-spread') as HTMLElement;
    expect(scrollEl.style.overflow).toBe('auto');
    expect(spreadEl.style.transform).toBe('scale(1)');

    fireEvent.click(zoomIn);
    expect(screen.getByText('110%')).toBeInTheDocument();
    expect(spreadEl.style.transform).toBe('scale(1.1)');

    fireEvent.click(zoomOut);
    fireEvent.click(zoomOut);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(spreadEl.style.transform).toBe('scale(0.9)');
  });

  it('clamps PDF zoom to the 50%-300% range', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);
    await screen.findByTestId('pdf-page');

    const zoomOut = screen.getByRole('button', { name: /Zoom out/ });
    for (let i = 0; i < 10; i++) fireEvent.click(zoomOut);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();

    const zoomIn = screen.getByRole('button', { name: /Zoom in/ });
    for (let i = 0; i < 30; i++) fireEvent.click(zoomIn);
    expect(screen.getByText('300%')).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });

  it('ignores `scroll` for PDF sources — no continuous vertical flow, zoom controls always shown', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    const { container } = render(<Reader source={source} scroll />);
    await screen.findByTestId('pdf-page');

    expect(screen.getByRole('button', { name: /Zoom in/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zoom out/ })).toBeInTheDocument();
    expect(container.querySelector('.ebook-reader__pdf-zoom-scroll')).not.toBeNull();
    expect(container.querySelector('.ebook-reader__scroll')).toBeNull();
  });

  it('hides the "Scroll" layout option for PDF sources', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);
    await screen.findByTestId('pdf-page');

    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    expect(screen.queryByRole('button', { name: 'Scroll' })).toBeNull();
  });

  it('centers a single lone page for the trailing spread of an odd-paged PDF', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(3)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    const { container } = render(<Reader source={source} columns={2} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('pdf-page')).toHaveLength(2);
    });

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      const pages = screen.getAllByTestId('pdf-page');
      expect(pages.map(p => p.querySelector('img')?.getAttribute('alt'))).toEqual(['Page 3']);
    });

    // No further spread beyond the lone trailing page.
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
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

  it('hides the text-settings ("Aa") panel and the drawer\'s Notes tab for a PDF book', async () => {
    // Font size/family, justify, line/letter/word spacing, and margin all
    // only affect reflowable text — a PDF page is a fixed-size rasterized
    // image, and notes anchor to rendered DOM text that a PDF page doesn't
    // have either (see `notesEnabled` in Reader.tsx). Contrast-checked
    // against a non-PDF source below.
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const source: ReaderSource = { type: 'pdf', data: new ArrayBuffer(8) };
    render(<Reader source={source} />);
    await screen.findByTestId('pdf-page');

    expect(screen.queryByRole('button', { name: 'Reading settings' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const panel = await screen.findByTestId('chapter-menu-panel');
    expect(within(panel).queryByRole('tab', { name: 'Notes' })).toBeNull();
  });

  it('shows the text-settings panel and Notes tab for a non-PDF book (contrast check)', async () => {
    const source: ReaderSource = { type: 'markdown', content: '# Book\n\n## Chapter 1\n\nHello world' };
    render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Reading settings' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    const panel = await screen.findByTestId('chapter-menu-panel');
    expect(within(panel).getByRole('tab', { name: 'Notes' })).toBeInTheDocument();
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
