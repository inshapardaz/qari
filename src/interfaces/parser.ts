/**
 * Parser interfaces for the Universal Ebook Reader.
 * Defines contracts for EPUB parsing, Markdown parsing, and Pretty Printing (serialization).
 */

import { Book } from '../models/book';

export interface EPUBParser {
  parse(data: ArrayBuffer): Promise<Book>;
}

export interface MarkdownParser {
  parse(content: string): Book;
}

export interface PrettyPrinter {
  toEpub(book: Book): Promise<ArrayBuffer>;
  toMarkdown(book: Book): string;
}
