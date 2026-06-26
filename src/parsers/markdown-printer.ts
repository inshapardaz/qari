/**
 * Markdown Pretty Printer for the Universal Ebook Reader.
 * Serializes the internal Book representation back to CommonMark Markdown.
 *
 * Mapping rules:
 * - Book title (metadata.title) → H1 heading
 * - Each chapter → H2 heading with chapter.title
 * - ContentNode types → corresponding Markdown syntax
 * - InlineNode types → corresponding inline Markdown formatting
 */

import type { PrettyPrinter } from '../interfaces/parser';
import type {
  Book,
  Chapter,
  ContentNode,
  InlineNode,
  ParagraphNode,
  HeadingNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
  ListItem,
  OpaqueNode,
} from '../models/book';

export class MarkdownPrinterImpl implements Pick<PrettyPrinter, 'toMarkdown'> {
  toMarkdown(book: Book): string {
    const lines: string[] = [];

    // Book title as H1
    lines.push(`# ${book.metadata.title}`);
    lines.push('');

    // Each chapter as H2 + content
    for (const chapter of book.chapters) {
      lines.push(`## ${chapter.title}`);
      lines.push('');
      const chapterContent = renderContentNodes(chapter.content);
      if (chapterContent) {
        lines.push(chapterContent);
      }
    }

    return lines.join('\n').trimEnd() + '\n';
  }
}

/**
 * Renders an array of ContentNode into Markdown text.
 */
function renderContentNodes(nodes: ContentNode[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    parts.push(renderContentNode(node));
  }

  return parts.join('\n\n');
}

/**
 * Renders a single ContentNode into Markdown text.
 */
function renderContentNode(node: ContentNode): string {
  switch (node.type) {
    case 'paragraph':
      return renderParagraph(node);
    case 'heading':
      return renderHeading(node);
    case 'image':
      return renderImage(node);
    case 'code-block':
      return renderCodeBlock(node);
    case 'list':
      return renderList(node);
    case 'opaque':
      return renderOpaque(node);
    default:
      return '';
  }
}

/**
 * Renders a ParagraphNode: inline content on a single line.
 */
function renderParagraph(node: ParagraphNode): string {
  return renderInlineNodes(node.children);
}

/**
 * Renders a HeadingNode with the appropriate number of # characters.
 */
function renderHeading(node: HeadingNode): string {
  const prefix = '#'.repeat(node.level);
  const text = renderInlineNodes(node.children);
  return `${prefix} ${text}`;
}

/**
 * Renders an ImageNode as ![alt](src).
 */
function renderImage(node: ImageNode): string {
  const alt = node.alt || '';
  return `![${alt}](${node.src})`;
}

/**
 * Renders a CodeBlockNode as a fenced code block with optional language.
 */
function renderCodeBlock(node: CodeBlockNode): string {
  const lang = node.language || '';
  // Code block content from the parser typically includes a trailing newline.
  // We strip it here because the fences provide the block structure.
  const content = node.content.endsWith('\n')
    ? node.content.slice(0, -1)
    : node.content;
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

/**
 * Renders a ListNode as unordered (- item) or ordered (1. item) list.
 */
function renderList(node: ListNode): string {
  return node.items
    .map((item, index) => renderListItem(item, node.ordered, index))
    .join('\n');
}

/**
 * Renders a single list item. Handles nested content by indenting continuation lines.
 */
function renderListItem(item: ListItem, ordered: boolean, index: number): string {
  const prefix = ordered ? `${index + 1}. ` : '- ';
  const indent = ' '.repeat(prefix.length);

  // Render item children as content nodes
  const parts: string[] = [];
  for (const child of item.children) {
    parts.push(renderContentNode(child));
  }

  const content = parts.join('\n\n');
  const lines = content.split('\n');

  // First line gets the prefix, subsequent lines get indented
  const result = lines
    .map((line, i) => (i === 0 ? `${prefix}${line}` : `${indent}${line}`))
    .join('\n');

  return result;
}

/**
 * Renders an OpaqueNode as raw content (preserved verbatim).
 */
function renderOpaque(node: OpaqueNode): string {
  return node.rawContent;
}

/**
 * Renders an array of InlineNode into Markdown inline text.
 */
function renderInlineNodes(nodes: InlineNode[]): string {
  return nodes.map(renderInlineNode).join('');
}

/**
 * Renders a single InlineNode into its Markdown representation.
 */
function renderInlineNode(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return node.content;
    case 'bold':
      return `**${renderInlineNodes(node.children)}**`;
    case 'italic':
      return `*${renderInlineNodes(node.children)}*`;
    case 'code':
      return `\`${node.content}\``;
    case 'link':
      return `[${renderInlineNodes(node.children)}](${node.href})`;
    default:
      return '';
  }
}
