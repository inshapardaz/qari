/**
 * Core Book data model for the Universal Ebook Reader.
 * All parsers (EPUB, Markdown) produce this shared internal representation.
 */

export interface Book {
  metadata: BookMetadata;
  chapters: Chapter[];
}

export interface BookMetadata {
  title: string;
  author?: string;
  language?: string; // ISO 639-1
  publisher?: string;
  publicationDate?: string; // ISO 8601
  identifier?: string; // ISBN or unique ID
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
  | OpaqueNode; // For unsupported EPUB elements

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

export type InlineNode =
  | TextSpan
  | BoldSpan
  | ItalicSpan
  | LinkSpan
  | CodeSpan;

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
