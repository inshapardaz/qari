/**
 * Core Book data model for the Universal Ebook Reader.
 * All parsers (EPUB, Markdown) produce this shared internal representation.
 */

export interface Book {
  metadata: BookMetadata;
  chapters: Chapter[];
  /** Map of fragment IDs to their inline content, for runtime footnote resolution */
  footnoteMap?: Map<string, InlineNode[]>;
}

export interface BookMetadata {
  title: string;
  author?: string;
  language?: string; // ISO 639-1
  publisher?: string;
  publicationDate?: string; // ISO 8601
  identifier?: string; // ISBN or unique ID
  pageDirection?: 'ltr' | 'rtl'; // from EPUB spine page-progression-direction
}

export interface Chapter {
  id: string;
  title: string;
  order: number; // spine sequence position
  content: ContentNode[];
}

export type ContentNode =
  | ParagraphNode
  | HeadingNode
  | ImageNode
  | CodeBlockNode
  | ListNode
  | OpaqueNode // For unsupported EPUB elements
  | PdfPageNode;

export interface ParagraphNode {
  type: 'paragraph';
  children: InlineNode[];
}

export interface HeadingNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface ImageNode {
  type: 'image';
  src: string;
  alt?: string;
}

export interface CodeBlockNode {
  type: 'code-block';
  language?: string;
  content: string;
}

export interface ListNode {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export interface ListItem {
  children: ContentNode[];
}

export interface OpaqueNode {
  type: 'opaque';
  originalTag: string;
  rawContent: string; // Preserved verbatim for round-trip
  attributes: Record<string, string>;
}

/**
 * A single rasterized PDF page, rendered to an image (data URL) at parse
 * time. Unlike other content nodes, this has no extractable/selectable
 * text — dictionary lookup and footnote popovers don't apply to it.
 */
export interface PdfPageNode {
  type: 'pdf-page';
  src: string; // data URL of the rendered page raster; empty while pending
  pageNumber: number; // 1-based page number within the source PDF
  width: number; // raster (or, while pending, estimated) width in px
  height: number; // raster (or, while pending, estimated) height in px
  /** True until this page's raster has actually been rendered. */
  pending?: boolean;
}

export type InlineNode =
  | TextSpan
  | BoldSpan
  | ItalicSpan
  | LinkSpan
  | CodeSpan
  | InlineImageSpan
  | FootnoteRefSpan;

export interface TextSpan {
  type: 'text';
  content: string;
}

export interface BoldSpan {
  type: 'bold';
  children: InlineNode[];
}

export interface ItalicSpan {
  type: 'italic';
  children: InlineNode[];
}

export interface LinkSpan {
  type: 'link';
  href: string;
  children: InlineNode[];
}

export interface CodeSpan {
  type: 'code';
  content: string;
}

export interface InlineImageSpan {
  type: 'inline-image';
  src: string;
  alt?: string;
}

export interface FootnoteRefSpan {
  type: 'footnote-ref';
  label: string;          // Display label, e.g. "1", "2"
  content: InlineNode[];  // Resolved footnote body as inline nodes
}
