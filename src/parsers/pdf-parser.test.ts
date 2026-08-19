import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PDFParserImpl, PDFParseError } from './pdf-parser';

/**
 * `pdfjs-dist` does real PDF parsing and canvas rendering, neither of which
 * jsdom supports (no real layout engine, and `getContext('2d')` returns
 * null by default). These tests mock `pdfjs-dist` itself so they exercise
 * the parser's own logic — page iteration, chapter/metadata construction,
 * error wrapping — independent of real PDF rendering.
 */

interface FakePage {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: unknown) => { promise: Promise<void> };
}

function createFakePage(): FakePage {
  return {
    getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }),
    render: () => ({ promise: Promise.resolve() }),
  };
}

function createFakePdfDocument(numPages: number, title?: string) {
  return {
    numPages,
    getPage: (_pageNumber?: number) => Promise.resolve(createFakePage()),
    getMetadata: () => Promise.resolve({ info: title ? { Title: title } : {} }),
  };
}

vi.mock('pdfjs-dist', () => {
  const GlobalWorkerOptions: { workerSrc: string } = { workerSrc: '' };
  return {
    GlobalWorkerOptions,
    getDocument: vi.fn(),
  };
});

describe('PDFParserImpl', () => {
  beforeEach(() => {
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

  it('produces one chapter per PDF page, each containing a single pdf-page node', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(3)),
    });

    const book = await new PDFParserImpl().parse(new ArrayBuffer(8));

    expect(book.chapters).toHaveLength(3);
    book.chapters.forEach((chapter, i) => {
      expect(chapter.id).toBe(`page-${i + 1}`);
      expect(chapter.order).toBe(i);
      expect(chapter.content).toHaveLength(1);
      const node = chapter.content[0];
      expect(node.type).toBe('pdf-page');
      if (node.type === 'pdf-page') {
        expect(node.pageNumber).toBe(i + 1);
        expect(node.src).toMatch(/^data:image\/png;base64,/);
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBeGreaterThan(0);
      }
    });
  });

  it('uses the PDF metadata title when present', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1, 'My PDF Title')),
    });

    const book = await new PDFParserImpl().parse(new ArrayBuffer(8));

    expect(book.metadata.title).toBe('My PDF Title');
  });

  it('falls back to a default title when metadata has none', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const book = await new PDFParserImpl().parse(new ArrayBuffer(8));

    expect(book.metadata.title).toBe('PDF Document');
  });

  it('falls back to a default title when metadata lookup throws', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    const doc = createFakePdfDocument(1);
    doc.getMetadata = () => Promise.reject(new Error('no metadata'));
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(doc),
    });

    const book = await new PDFParserImpl().parse(new ArrayBuffer(8));

    expect(book.metadata.title).toBe('PDF Document');
  });

  it('wraps document-loading failures in a PDFParseError', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.reject(new Error('corrupt file')),
    });

    await expect(new PDFParserImpl().parse(new ArrayBuffer(8))).rejects.toThrow(PDFParseError);
  });

  it('respects a custom scale option when rendering pages', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });

    const book = await new PDFParserImpl().parse(new ArrayBuffer(8), { scale: 3 });

    const node = book.chapters[0].content[0];
    expect(node.type).toBe('pdf-page');
    if (node.type === 'pdf-page') {
      expect(node.width).toBe(300);
      expect(node.height).toBe(600);
    }
  });

  it('uses a custom workerSrc when provided and does not overwrite an already-configured one', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(createFakePdfDocument(1)),
    });
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    await new PDFParserImpl().parse(new ArrayBuffer(8), { workerSrc: 'https://example.com/worker.mjs' });

    expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('https://example.com/worker.mjs');
  });

  describe('chapter map (issue #10)', () => {
    it('titles each page with the chapter it falls under, per the supplied startPage map', async () => {
      const pdfjsLib = await import('pdfjs-dist');
      (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
        promise: Promise.resolve(createFakePdfDocument(6)),
      });

      const book = await new PDFParserImpl().parse(new ArrayBuffer(8), {
        chapters: [
          { title: 'Chapter One', startPage: 1 },
          { title: 'Chapter Two', startPage: 3 },
          { title: 'Chapter Three', startPage: 5 },
        ],
      });

      expect(book.chapters.map(c => c.title)).toEqual([
        'Chapter One', 'Chapter One',
        'Chapter Two', 'Chapter Two',
        'Chapter Three', 'Chapter Three',
      ]);
    });

    it('falls back to the default "Page N" title for pages before the first entry\'s startPage', async () => {
      const pdfjsLib = await import('pdfjs-dist');
      (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
        promise: Promise.resolve(createFakePdfDocument(3)),
      });

      const book = await new PDFParserImpl().parse(new ArrayBuffer(8), {
        chapters: [{ title: 'Chapter One', startPage: 2 }],
      });

      expect(book.chapters.map(c => c.title)).toEqual(['Page 1', 'Chapter One', 'Chapter One']);
    });

    it('sorts an out-of-order chapter map by startPage before applying it', async () => {
      const pdfjsLib = await import('pdfjs-dist');
      (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
        promise: Promise.resolve(createFakePdfDocument(4)),
      });

      const book = await new PDFParserImpl().parse(new ArrayBuffer(8), {
        chapters: [
          { title: 'Chapter Two', startPage: 3 },
          { title: 'Chapter One', startPage: 1 },
        ],
      });

      expect(book.chapters.map(c => c.title)).toEqual([
        'Chapter One', 'Chapter One', 'Chapter Two', 'Chapter Two',
      ]);
    });
  });

  describe('progressive loading', () => {
    it('only renders the initial page batch eagerly, leaving the rest as pending placeholders', async () => {
      const pdfjsLib = await import('pdfjs-dist');
      const doc = createFakePdfDocument(5);
      const renderSpy = vi.fn(() => ({ promise: Promise.resolve() }));
      doc.getPage = (_pageNumber?: number) =>
        Promise.resolve({
          getViewport: ({ scale }: { scale: number }) => ({ width: 100 * scale, height: 200 * scale }),
          render: renderSpy,
        } as unknown as ReturnType<typeof createFakePage>);
      (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({ promise: Promise.resolve(doc) });

      const onPageRendered = vi.fn();
      const book = await new PDFParserImpl().parse(new ArrayBuffer(8), { initialPageCount: 2, onPageRendered });

      expect(book.chapters).toHaveLength(5);
      for (let i = 0; i < 2; i++) {
        const node = book.chapters[i].content[0];
        expect(node.type).toBe('pdf-page');
        if (node.type === 'pdf-page') {
          expect(node.pending).toBeFalsy();
          expect(node.src).toMatch(/^data:image\/png;base64,/);
        }
      }
      for (let i = 2; i < 5; i++) {
        const node = book.chapters[i].content[0];
        expect(node.type).toBe('pdf-page');
        if (node.type === 'pdf-page') {
          expect(node.pending).toBe(true);
          expect(node.src).toBe('');
          expect(node.width).toBeGreaterThan(0);
          expect(node.height).toBeGreaterThan(0);
        }
      }
      // The remaining 3 pages render in the background without blocking parse()
      // (their `pending: true` snapshot above, captured at parse()'s return,
      // already proves they weren't rendered eagerly — background rendering
      // may race ahead of this point before the assertions below run).
      await vi.waitFor(() => expect(onPageRendered).toHaveBeenCalledTimes(3));
      expect(renderSpy).toHaveBeenCalledTimes(5);
      const renderedPageNumbers = onPageRendered.mock.calls.map(([pageNumber]) => pageNumber).sort();
      expect(renderedPageNumbers).toEqual([3, 4, 5]);
    });

    it('requestPage renders a still-pending page immediately, out of the background order', async () => {
      const pdfjsLib = await import('pdfjs-dist');
      (pdfjsLib.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
        promise: Promise.resolve(createFakePdfDocument(5)),
      });

      const onPageRendered = vi.fn();
      const parser = new PDFParserImpl();
      const book = await parser.parse(new ArrayBuffer(8), { initialPageCount: 1, onPageRendered });

      expect(book.chapters[4].content[0]).toMatchObject({ pending: true });

      await parser.requestPage(5);

      expect(onPageRendered).toHaveBeenCalledWith(5, expect.objectContaining({ pending: false, pageNumber: 5 }));

      // The background pass reaching page 5 later shouldn't render it again.
      // Wait for the whole background pass (pages 2-4) to finish so no
      // dangling async work leaks into the next test.
      await vi.waitFor(() => expect(onPageRendered).toHaveBeenCalledTimes(4));
      expect(onPageRendered.mock.calls.filter(([n]) => n === 5)).toHaveLength(1);
    });
  });
});
