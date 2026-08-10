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

export interface PDFParseOptions {
  /** Rendering scale/DPI multiplier for page rasterization. Defaults to 2. */
  scale?: number;
  /** Override the PDF.js worker script URL (defaults to a version-pinned jsDelivr CDN URL). */
  workerSrc?: string;
  /** Number of pages rendered eagerly before `parse()` resolves; the rest render in the background. Defaults to 3. */
  initialPageCount?: number;
  /** Called each time a page beyond the initial batch finishes rendering in the background (or via `requestPage`). */
  onPageRendered?: (pageNumber: number, node: PdfPageNode) => void;
}

export interface PDFParser {
  parse(data: ArrayBuffer, options?: PDFParseOptions): Promise<Book>;
}

export interface PrettyPrinter {
  toEpub(book: Book): Promise<ArrayBuffer>;
  toMarkdown(book: Book): string;
}
