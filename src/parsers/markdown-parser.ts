/**
 * Markdown Parser for the Universal Ebook Reader.
 * Parses CommonMark-compliant Markdown into the internal Book representation.
 *
 * Mapping rules:
 * - H1 → book title (metadata)
 * - H2 → chapter boundaries (each H2 starts a new chapter)
 * - Paragraphs, inline formatting, images, code blocks, lists → ContentNode types
 * - No H2 headings → single chapter, title from H1 or "Untitled"
 */

import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { MarkdownParser } from '../interfaces/parser';
import type {
  Book,
  BookMetadata,
  Chapter,
  ContentNode,
  InlineNode,
  ListItem,
  HeadingNode,
  ParagraphNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
} from '../models/book';

const md = new MarkdownIt();

export class MarkdownParserImpl implements MarkdownParser {
  parse(content: string): Book {
    const tokens = md.parse(content, {});
    const title = extractTitle(tokens);
    const chapters = buildChapters(tokens, title);

    const metadata: BookMetadata = {
      title: title || 'Untitled',
    };

    return { metadata, chapters };
  }
}

/**
 * Extracts the first H1 heading text from tokens.
 */
function extractTitle(tokens: Token[]): string | null {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open' && token.tag === 'h1') {
      const inlineToken = tokens[i + 1];
      if (inlineToken && inlineToken.type === 'inline') {
        return inlineToken.content;
      }
    }
  }
  return null;
}

/**
 * Checks whether the tokens contain any H2 headings.
 */
function hasH2Headings(tokens: Token[]): boolean {
  return tokens.some(t => t.type === 'heading_open' && t.tag === 'h2');
}

/**
 * Builds chapters from tokens. If no H2 headings exist, returns a single chapter.
 */
function buildChapters(tokens: Token[], bookTitle: string | null): Chapter[] {
  if (!hasH2Headings(tokens)) {
    // Single chapter: all content (excluding H1)
    const content = parseContentNodes(tokens, true);
    return [
      {
        id: 'chapter-0',
        title: bookTitle || 'Untitled',
        order: 0,
        content,
      },
    ];
  }

  const chapters: Chapter[] = [];
  let currentChapterTitle: string | null = null;
  let currentChapterTokens: Token[] = [];
  let chapterIndex = 0;

  // Track whether we're before the first H2
  let beforeFirstH2 = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'heading_open' && token.tag === 'h2') {
      // Save previous chapter if there was one
      if (currentChapterTitle !== null) {
        chapters.push(createChapter(currentChapterTitle, currentChapterTokens, chapterIndex));
        chapterIndex++;
      }

      // Start new chapter
      beforeFirstH2 = false;
      const inlineToken = tokens[i + 1];
      currentChapterTitle = inlineToken && inlineToken.type === 'inline' ? inlineToken.content : '';
      currentChapterTokens = [];

      // Skip inline and heading_close tokens
      i += 2;
      continue;
    }

    // Skip H1 heading tokens (title already extracted)
    if (token.type === 'heading_open' && token.tag === 'h1') {
      i += 2; // skip inline + heading_close
      continue;
    }

    // Only collect tokens after the first H2
    if (!beforeFirstH2) {
      currentChapterTokens.push(token);
    }
  }

  // Push the last chapter
  if (currentChapterTitle !== null) {
    chapters.push(createChapter(currentChapterTitle, currentChapterTokens, chapterIndex));
  }

  return chapters;
}

function createChapter(title: string, tokens: Token[], order: number): Chapter {
  return {
    id: `chapter-${order}`,
    title,
    order,
    content: parseContentNodes(tokens, false),
  };
}

/**
 * Parses a list of tokens into ContentNode[].
 * If skipH1 is true, H1 headings are excluded.
 */
function parseContentNodes(tokens: Token[], skipH1: boolean): ContentNode[] {
  const nodes: ContentNode[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // Skip H1 if requested
    if (skipH1 && token.type === 'heading_open' && token.tag === 'h1') {
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    // Headings (H3-H6 within chapters, or H2 if in single chapter mode)
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const inlineToken = tokens[i + 1];
      const children = inlineToken && inlineToken.type === 'inline'
        ? parseInlineNodes(inlineToken.children || [])
        : [];
      const headingNode: HeadingNode = { type: 'heading', level, children };
      nodes.push(headingNode);
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    // Paragraphs
    if (token.type === 'paragraph_open') {
      const inlineToken = tokens[i + 1];
      if (inlineToken && inlineToken.type === 'inline') {
        // Check if paragraph contains only an image
        const imageNode = tryExtractImage(inlineToken.children || []);
        if (imageNode) {
          nodes.push(imageNode);
        } else {
          const children = parseInlineNodes(inlineToken.children || []);
          const paragraphNode: ParagraphNode = { type: 'paragraph', children };
          nodes.push(paragraphNode);
        }
      }
      i += 3; // paragraph_open, inline, paragraph_close
      continue;
    }

    // Fenced code blocks
    if (token.type === 'fence') {
      const codeBlockNode: CodeBlockNode = {
        type: 'code-block',
        language: token.info.trim() || undefined,
        content: token.content,
      };
      nodes.push(codeBlockNode);
      i++;
      continue;
    }

    // Indented code blocks
    if (token.type === 'code_block') {
      const codeBlockNode: CodeBlockNode = {
        type: 'code-block',
        content: token.content,
      };
      nodes.push(codeBlockNode);
      i++;
      continue;
    }

    // Ordered lists
    if (token.type === 'ordered_list_open') {
      const { node, endIndex } = parseList(tokens, i, true);
      nodes.push(node);
      i = endIndex + 1;
      continue;
    }

    // Unordered lists
    if (token.type === 'bullet_list_open') {
      const { node, endIndex } = parseList(tokens, i, false);
      nodes.push(node);
      i = endIndex + 1;
      continue;
    }

    i++;
  }

  return nodes;
}

/**
 * Tries to extract a standalone image from inline token children.
 * Returns an ImageNode if the paragraph contains only a single image, null otherwise.
 */
function tryExtractImage(children: Token[]): ImageNode | null {
  // Filter out softbreak tokens for checking
  const meaningful = children.filter(c => c.type !== 'softbreak');
  if (meaningful.length === 1 && meaningful[0].type === 'image') {
    const imgToken = meaningful[0];
    return {
      type: 'image',
      src: imgToken.attrGet('src') || '',
      alt: imgToken.content || undefined,
    };
  }
  return null;
}

/**
 * Parses a list (ordered or unordered) from tokens starting at the list_open token.
 */
function parseList(tokens: Token[], startIndex: number, ordered: boolean): { node: ListNode; endIndex: number } {
  const closeType = ordered ? 'ordered_list_close' : 'bullet_list_close';
  const items: ListItem[] = [];
  let i = startIndex + 1; // skip list_open

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === 'list_item_open') {
      const { item, endIndex } = parseListItem(tokens, i);
      items.push(item);
      i = endIndex + 1;
    } else {
      i++;
    }
  }

  return {
    node: { type: 'list', ordered, items },
    endIndex: i, // points to list_close
  };
}

/**
 * Parses a single list item from tokens.
 * Uses nesting depth tracking to handle nested lists within list items.
 */
function parseListItem(tokens: Token[], startIndex: number): { item: ListItem; endIndex: number } {
  let i = startIndex + 1; // skip list_item_open
  const itemTokens: Token[] = [];
  let depth = 1; // track nesting depth (started at 1 for the opening list_item_open)

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === 'list_item_open') {
      depth++;
    } else if (token.type === 'list_item_close') {
      depth--;
      if (depth === 0) {
        break; // found the matching close for our list item
      }
    }
    itemTokens.push(token);
    i++;
  }

  const children = parseContentNodes(itemTokens, false);
  return {
    item: { children },
    endIndex: i, // points to list_item_close
  };
}

/**
 * Parses inline tokens into InlineNode[].
 */
function parseInlineNodes(children: Token[]): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;

  while (i < children.length) {
    const token = children[i];

    if (token.type === 'text') {
      if (token.content) {
        nodes.push({ type: 'text', content: token.content });
      }
      i++;
      continue;
    }

    if (token.type === 'softbreak' || token.type === 'hardbreak') {
      nodes.push({ type: 'text', content: '\n' });
      i++;
      continue;
    }

    if (token.type === 'code_inline') {
      nodes.push({ type: 'code', content: token.content });
      i++;
      continue;
    }

    if (token.type === 'strong_open') {
      const { inlineNodes, endIndex } = collectUntilClose(children, i + 1, 'strong_close');
      nodes.push({ type: 'bold', children: inlineNodes });
      i = endIndex + 1;
      continue;
    }

    if (token.type === 'em_open') {
      const { inlineNodes, endIndex } = collectUntilClose(children, i + 1, 'em_close');
      nodes.push({ type: 'italic', children: inlineNodes });
      i = endIndex + 1;
      continue;
    }

    if (token.type === 'link_open') {
      const href = token.attrGet('href') || '';
      const { inlineNodes, endIndex } = collectUntilClose(children, i + 1, 'link_close');
      nodes.push({ type: 'link', href, children: inlineNodes });
      i = endIndex + 1;
      continue;
    }

    if (token.type === 'image') {
      // Inline images within text - treat as text with alt
      nodes.push({ type: 'text', content: token.content || '' });
      i++;
      continue;
    }

    // Fallback: treat unknown tokens as text if they have content
    if (token.content) {
      nodes.push({ type: 'text', content: token.content });
    }
    i++;
  }

  return nodes;
}

/**
 * Collects inline nodes from children until a closing token type is found.
 */
function collectUntilClose(
  children: Token[],
  startIndex: number,
  closeType: string
): { inlineNodes: InlineNode[]; endIndex: number } {
  const collected: Token[] = [];
  let i = startIndex;

  while (i < children.length && children[i].type !== closeType) {
    collected.push(children[i]);
    i++;
  }

  return {
    inlineNodes: parseInlineNodes(collected),
    endIndex: i, // points to the close token
  };
}
