/**
 * PDF Parser for the Universal Ebook Reader.
 *
 * PDFs are fixed-layout documents, not reflowable text like EPUB/Markdown.
 * Each page is rasterized to an image at parse time (via PDF.js) and wrapped
 * as its own single-node "chapter", so the reader's existing per-chapter
 * page/chapter navigation, bookmarks, and progress tracking map 1:1 onto the
 * PDF's real page boundaries without any changes to that machinery.
 *
 * Trade-off: rendered pages have no extractable/selectable text, so
 * dictionary lookup and footnote popovers don't apply to PDF content.
 *
 * Rendering every page up front is slow for large PDFs, so `parse()` only
 * renders the first `initialPageCount` pages before resolving; the rest are
 * returned as lightweight pending placeholders (correct aspect ratio, no
 * raster yet) and rendered afterwards in the background, yielding to the
 * main thread between pages so the UI stays responsive. Call `requestPage()`
 * to jump a specific page to the front of the queue (e.g. the reader lands
 * on a page the background pass hasn't reached yet).
 *
 * `pdfjs-dist` is loaded via dynamic import so it's only pulled into a
 * consumer's bundle when a PDF is actually loaded. PDF.js already runs the
 * document parsing/decoding on its own Web Worker (configured below via
 * `GlobalWorkerOptions.workerSrc`); only the final canvas rasterization of
 * each page has to happen on the main thread, since `CanvasRenderingContext2D`
 * isn't available inside a worker without additional OffscreenCanvas
 * plumbing that PDF.js's own worker doesn't set up for us.
 */

import type { Book, Chapter, PdfPageNode } from '../models/book';
import type { PDFParseOptions, PDFParser, PdfChapterMapEntry } from '../interfaces/parser';
import type * as PdfjsLib from 'pdfjs-dist';

/** Must match the installed `pdfjs-dist` dependency version exactly — PDF.js
 * throws if the main thread and worker script versions mismatch. */
const PDFJS_VERSION = '4.10.38';
const DEFAULT_WORKER_SRC = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
const DEFAULT_SCALE = 2;
const DEFAULT_INITIAL_PAGE_COUNT = 3;

export class PDFParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PDFParseError';
  }
}

/** Yields to the main thread between background page renders. */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout: 200 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export class PDFParserImpl implements PDFParser {
  private pdf?: PdfjsLib.PDFDocumentProxy;
  private scale = DEFAULT_SCALE;
  private onPageRendered?: (pageNumber: number, node: PdfPageNode) => void;
  private renderedPages = new Set<number>();
  private inFlightRenders = new Map<number, Promise<PdfPageNode>>();

  async parse(data: ArrayBuffer, options: PDFParseOptions = {}): Promise<Book> {
    const pdfjsLib: typeof PdfjsLib = await import('pdfjs-dist');

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = options.workerSrc || DEFAULT_WORKER_SRC;
    }

    this.scale = options.scale ?? DEFAULT_SCALE;
    this.onPageRendered = options.onPageRendered;

    try {
      this.pdf = await pdfjsLib.getDocument({ data }).promise;
    } catch (err) {
      throw new PDFParseError(
        `Failed to load PDF document: ${err instanceof Error ? err.message : 'unknown error'}`,
        err
      );
    }
    const pdf = this.pdf;

    let title = 'PDF Document';
    try {
      const meta = await pdf.getMetadata();
      const info = meta.info as { Title?: string } | undefined;
      if (info?.Title) {
        title = info.Title;
      }
    } catch {
      // Metadata is optional; fall back to the default title.
    }

    const initialPageCount = Math.min(options.initialPageCount ?? DEFAULT_INITIAL_PAGE_COUNT, pdf.numPages);
    const chapters: Chapter[] = [];
    // Ascending by startPage regardless of input order, so a caller-supplied
    // map doesn't have to be pre-sorted for `titleForPage` below to work.
    const chapterMap = options.chapters
      ? [...options.chapters].sort((a, b) => a.startPage - b.startPage)
      : undefined;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const node =
        pageNumber <= initialPageCount
          ? await this.renderPage(pageNumber)
          : await this.createPlaceholder(pageNumber);
      chapters.push(makeChapter(pageNumber, node, titleForPage(chapterMap, pageNumber)));
    }

    void this.renderRemainingInBackground(initialPageCount + 1, pdf.numPages);

    return {
      metadata: { title },
      chapters,
    };
  }

  /**
   * Renders a specific page immediately, out of order, if it hasn't been
   * rendered yet — e.g. the reader navigated to a page the background pass
   * hasn't reached. No-op if the page is already rendered or in flight (the
   * background pass will pick up its own result once it gets there).
   */
  async requestPage(pageNumber: number): Promise<void> {
    if (!this.pdf || this.renderedPages.has(pageNumber)) return;
    const node = await this.renderPage(pageNumber);
    this.onPageRendered?.(pageNumber, node);
  }

  private async renderRemainingInBackground(start: number, end: number): Promise<void> {
    for (let pageNumber = start; pageNumber <= end; pageNumber++) {
      if (this.renderedPages.has(pageNumber)) {
        continue; // already handled via requestPage()
      }
      try {
        const node = await this.renderPage(pageNumber);
        this.onPageRendered?.(pageNumber, node);
      } catch (err) {
        console.warn(`[qari] Failed to render PDF page ${pageNumber} in the background`, err);
      }
      await yieldToMainThread();
    }
  }

  private renderPage(pageNumber: number): Promise<PdfPageNode> {
    const inFlight = this.inFlightRenders.get(pageNumber);
    if (inFlight) return inFlight;

    const promise = renderPageToDataUrl(this.pdf!, pageNumber, this.scale).then(({ dataUrl, width, height }) => {
      this.renderedPages.add(pageNumber);
      this.inFlightRenders.delete(pageNumber);
      return { type: 'pdf-page', src: dataUrl, pageNumber, width, height, pending: false } as PdfPageNode;
    });
    this.inFlightRenders.set(pageNumber, promise);
    return promise;
  }

  /** Cheap placeholder with the page's real aspect ratio, no rasterization. */
  private async createPlaceholder(pageNumber: number): Promise<PdfPageNode> {
    const page = await this.pdf!.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.scale });
    return { type: 'pdf-page', src: '', pageNumber, width: viewport.width, height: viewport.height, pending: true };
  }
}

function makeChapter(pageNumber: number, node: PdfPageNode, chapterTitle?: string): Chapter {
  return {
    id: `page-${pageNumber}`,
    title: chapterTitle ?? `Page ${pageNumber}`,
    order: pageNumber - 1,
    content: [node],
  };
}

/**
 * Finds the title of the last chapter-map entry whose `startPage` is at or
 * before `pageNumber` — i.e. the chapter this page falls within. Pages
 * before the first entry's `startPage` (front matter, cover, etc.) get no
 * title here and fall back to `makeChapter`'s default.
 */
function titleForPage(chapterMap: PdfChapterMapEntry[] | undefined, pageNumber: number): string | undefined {
  if (!chapterMap) return undefined;
  let title: string | undefined;
  for (const entry of chapterMap) {
    if (entry.startPage > pageNumber) break;
    title = entry.title;
  }
  return title;
}

async function renderPageToDataUrl(
  pdf: PdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new PDFParseError(`Failed to acquire a 2D canvas context to render page ${pageNumber}`);
  }

  await page.render({ canvasContext: context, viewport }).promise;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: viewport.width,
    height: viewport.height,
  };
}
