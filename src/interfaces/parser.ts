/**
 * Parser interfaces for the Universal Ebook Reader.
 * Defines contracts for EPUB parsing, Markdown parsing, and Pretty Printing (serialization).
 */

import { Book, PdfPageNode } from '../models/book';

export interface EPUBParser {
  parse(data: ArrayBuffer): Promise<Book>;
}

export interface MarkdownParser {
  parse(content: string): Book;
}

/**
 * One entry in a caller-supplied PDF chapter map — see
 * `PDFParseOptions.chapters`. Every page from `startPage` up to (but not
 * including) the next entry's `startPage` is titled with this entry's
 * `title`; pages before the first entry's `startPage` keep the default
 * `Page N` title.
 */
export interface PdfChapterMapEntry {
  title: string;
  /** 1-based PDF page number this chapter begins on. */
  startPage: number;
}

export interface PDFParseOptions {
  /** Rendering scale/DPI multiplier for page rasterization. Defaults to 2. */
  scale?: number;
  /** Override the PDF.js worker script URL (defaults to a version-pinned jsDelivr CDN URL). */
  workerSrc?: string;
  /** Number of pages rendered eagerly before `parse()` resolves; the rest render in the background. Defaults to 3. */
  initialPageCount?: number;
  /** Called each time a page beyond the initial batch finishes rendering in the background (or via `requestPage`). */
  onPageRendered?: (pageNumber: number, node: PdfPageNode) => void;
  /**
   * Explicit chapter/page map — PDFs have no table-of-contents of their own
   * (unlike EPUB's spine), so without this every page ends up as its own
   * untitled "Page N" chapter. Titles are applied per-page during parsing;
   * the chapter drawer separately collapses consecutive same-titled pages
   * into a single navigable entry.
   */
  chapters?: PdfChapterMapEntry[];
}

export interface PDFParser {
  parse(data: ArrayBuffer, options?: PDFParseOptions): Promise<Book>;
}

export interface PrettyPrinter {
  toEpub(book: Book): Promise<ArrayBuffer>;
  toMarkdown(book: Book): string;
}
