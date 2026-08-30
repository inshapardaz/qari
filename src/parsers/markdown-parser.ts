/**
 * Markdown Parser for the Universal Ebook Reader.
 * Parses CommonMark-compliant Markdown into the internal Book representation.
 *
 * Mapping rules:
 * - H1 → book title (metadata), and chapter boundaries when 2+ H1s exist
 *   (each H1 starts a new chapter — see `buildChapters`'s own comment)
 * - H2 → chapter boundaries (each H2 starts a new chapter) when the
 *   document doesn't use H1 that way (0 or 1 H1 present)
 * - Paragraphs, inline formatting, images, code blocks, lists → ContentNode types
 * - No H2 headings (and fewer than 2 H1s) → single chapter, title from H1 or "Untitled"
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
  InlineImageSpan,
  ListItem,
  HeadingNode,
  ParagraphNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
} from '../models/book';

const md = new MarkdownIt();

/**
 * Regex to match footnote definitions: [^id]: content
 * Captures: id, content (rest of line)
 */
const FOOTNOTE_DEF_REGEX = /^\[\^([^\]]+)\]:\s*(.+)$/gm;

/**
 * Regex to match footnote references: [^id] within inline text.
 * Captures: id
 */
const FOOTNOTE_REF_REGEX = /\[\^([^\]]+)\]/g;

export class MarkdownParserImpl implements MarkdownParser {
  parse(content: string): Book {
    // Extract footnote definitions before parsing
    const footnoteDefinitions = extractFootnoteDefinitions(content);

    // Strip footnote definition lines from content before markdown-it parsing
    const strippedContent = content.replace(FOOTNOTE_DEF_REGEX, '');

    const tokens = md.parse(strippedContent, {});
    const title = extractTitle(tokens);
    const chapters = buildChapters(tokens, title, footnoteDefinitions);

    const metadata: BookMetadata = {
      title: title || 'Untitled',
    };

    return { metadata, chapters };
  }
}

/**
 * Extracts footnote definitions from the raw markdown content.
 * Returns a map of id -> raw content string.
 */
function extractFootnoteDefinitions(content: string): Map<string, string> {
  const definitions = new Map<string, string>();
  const regex = new RegExp(FOOTNOTE_DEF_REGEX.source, FOOTNOTE_DEF_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const id = match[1];
    const defContent = match[2].trim();
    definitions.set(id, defContent);
  }

  return definitions;
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
 * Counts H1 headings — determines whether H1 itself is the chapter-boundary
 * level for this document (see `buildChapters`'s own comment).
 */
function countH1Headings(tokens: Token[]): number {
  return tokens.filter(t => t.type === 'heading_open' && t.tag === 'h1').length;
}

/**
 * Checks whether the tokens contain any H2 headings.
 */
function hasH2Headings(tokens: Token[]): boolean {
  return tokens.some(t => t.type === 'heading_open' && t.tag === 'h2');
}

/**
 * Builds chapters from tokens.
 *
 * The chapter-boundary heading level is normally H2, with a single H1 used
 * only as the book title (stripped from rendered content, same as any
 * metadata field). But a single markdown file with one H1 *per chapter*
 * (`# Chapter One`, `# Chapter Two`, ...) is at least as common a convention
 * as the H2 one — so when the document has *two or more* H1 headings, H1 is
 * treated as the chapter-boundary level instead of H2 (any H2 occurring
 * inside such a chapter renders as an ordinary in-content heading, the same
 * treatment H3-H6 already get within an H2-delimited chapter). A document
 * with zero or one H1 keeps the original H1-title/H2-chapter behavior
 * unchanged, so existing single-H1 books aren't affected.
 */
function buildChapters(tokens: Token[], bookTitle: string | null, footnoteDefinitions: Map<string, string>): Chapter[] {
  // Shared counter across entire document for sequential footnote numbering
  const footnoteCounter = { value: 0 };
  const splitTag: 'h1' | 'h2' = countH1Headings(tokens) >= 2 ? 'h1' : 'h2';

  if (splitTag === 'h2' && !hasH2Headings(tokens)) {
    // Single chapter: all content (excluding H1) — with the H1's own text
    // re-rendered as the chapter's opening heading (see `createChapter`'s
    // own comment on why a chapter's title heading is shown in its content,
    // not just carried as the `chapter.title` metadata field).
    const content = parseContentNodes(tokens, true, footnoteDefinitions, footnoteCounter);
    const resolvedTitle = bookTitle || 'Untitled';
    return [
      {
        id: 'chapter-0',
        title: resolvedTitle,
        order: 0,
        content: bookTitle
          ? [{ type: 'heading', level: 1, children: [{ type: 'text', content: bookTitle }] }, ...content]
          : content,
      },
    ];
  }

  const chapters: Chapter[] = [];
  let currentChapterTitle: string | null = null;
  let currentChapterTitleInline: Token[] | undefined;
  let currentChapterTokens: Token[] = [];
  let chapterIndex = 0;
  const splitLevel = splitTag === 'h1' ? 1 : 2;

  // Track whether we're before the first chapter-boundary heading
  let beforeFirstSplit = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'heading_open' && token.tag === splitTag) {
      // Save previous chapter if there was one
      if (currentChapterTitle !== null) {
        chapters.push(createChapter(currentChapterTitle, currentChapterTitleInline, splitLevel, currentChapterTokens, chapterIndex, footnoteDefinitions, footnoteCounter));
        chapterIndex++;
      }

      // Start new chapter
      beforeFirstSplit = false;
      const inlineToken = tokens[i + 1];
      currentChapterTitle = inlineToken && inlineToken.type === 'inline' ? inlineToken.content : '';
      currentChapterTitleInline = inlineToken && inlineToken.type === 'inline' ? inlineToken.children || [] : undefined;
      currentChapterTokens = [];

      // Skip inline and heading_close tokens
      i += 2;
      continue;
    }

    // When H1 isn't the chapter-boundary level, the single H1 heading (its
    // text already captured as the book title) is still stripped from
    // content — same as before.
    if (splitTag !== 'h1' && token.type === 'heading_open' && token.tag === 'h1') {
      i += 2; // skip inline + heading_close
      continue;
    }

    // Only collect tokens after the first chapter-boundary heading
    if (!beforeFirstSplit) {
      currentChapterTokens.push(token);
    }
  }

  // Push the last chapter
  if (currentChapterTitle !== null) {
    chapters.push(createChapter(currentChapterTitle, currentChapterTitleInline, splitLevel, currentChapterTokens, chapterIndex, footnoteDefinitions, footnoteCounter));
  }

  return chapters;
}

/**
 * Builds a chapter, re-rendering its chapter-boundary heading (the one whose
 * text became `title`, stripped out of `tokens` by the caller) as an actual
 * `HeadingNode` at the start of the chapter's own content — so a reader
 * opening the chapter sees its name the same way an EPUB chapter's own
 * heading already shows, rather than the name only surfacing in the header
 * status line/chapter menu. `titleInline` (the heading's original inline
 * child tokens, when available) preserves any inline formatting — bold,
 * italic, etc. — in the rendered heading; a plain-text fallback covers the
 * one caller (the single-chapter path) that only has the flattened string.
 */
function createChapter(title: string, titleInline: Token[] | undefined, headingLevel: 1 | 2, tokens: Token[], order: number, footnoteDefinitions: Map<string, string>, footnoteCounter: { value: number }): Chapter {
  const content = parseContentNodes(tokens, false, footnoteDefinitions, footnoteCounter);
  const titleChildren = titleInline && titleInline.length > 0
    ? parseInlineNodes(titleInline, footnoteDefinitions, footnoteCounter)
    : [{ type: 'text' as const, content: title }];
  const titleHeading: HeadingNode = { type: 'heading', level: headingLevel, children: titleChildren };
  return {
    id: `chapter-${order}`,
    title,
    order,
    content: title ? [titleHeading, ...content] : content,
  };
}

/**
 * Parses a list of tokens into ContentNode[].
 * If skipH1 is true, H1 headings are excluded.
 */
function parseContentNodes(tokens: Token[], skipH1: boolean, footnoteDefinitions: Map<string, string>, footnoteCounter: { value: number }): ContentNode[] {
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
        ? parseInlineNodes(inlineToken.children || [], footnoteDefinitions, footnoteCounter)
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
          const children = parseInlineNodes(inlineToken.children || [], footnoteDefinitions, footnoteCounter);
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
      const { node, endIndex } = parseList(tokens, i, true, footnoteDefinitions, footnoteCounter);
      nodes.push(node);
      i = endIndex + 1;
      continue;
    }

    // Unordered lists
    if (token.type === 'bullet_list_open') {
      const { node, endIndex } = parseList(tokens, i, false, footnoteDefinitions, footnoteCounter);
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
function parseList(tokens: Token[], startIndex: number, ordered: boolean, footnoteDefinitions: Map<string, string>, footnoteCounter: { value: number }): { node: ListNode; endIndex: number } {
  const closeType = ordered ? 'ordered_list_close' : 'bullet_list_close';
  const items: ListItem[] = [];
  let i = startIndex + 1; // skip list_open

  while (i < tokens.length && tokens[i].type !== closeType) {
    if (tokens[i].type === 'list_item_open') {
      const { item, endIndex } = parseListItem(tokens, i, footnoteDefinitions, footnoteCounter);
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
function parseListItem(tokens: Token[], startIndex: number, footnoteDefinitions: Map<string, string>, footnoteCounter: { value: number }): { item: ListItem; endIndex: number } {
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

  const children = parseContentNodes(itemTokens, false, footnoteDefinitions, footnoteCounter);
  return {
    item: { children },
    endIndex: i, // points to list_item_close
  };
}

/**
 * Parses inline tokens into InlineNode[].
 * Uses a shared footnote counter context for auto-incremented labels.
 */
function parseInlineNodes(children: Token[], footnoteDefinitions: Map<string, string>, footnoteCounter?: { value: number }): InlineNode[] {
  const counter = footnoteCounter || { value: 0 };
  const nodes: InlineNode[] = [];
  let i = 0;

  while (i < children.length) {
    const token = children[i];

    if (token.type === 'text') {
      if (token.content) {
        // Check for footnote references in text content
        const expanded = expandFootnoteRefs(token.content, footnoteDefinitions, counter);
        nodes.push(...expanded);
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
      const { inlineNodes, endIndex } = collectUntilClose(children, i + 1, 'strong_close', footnoteDefinitions, counter);
      nodes.push({ type: 'bold', children: inlineNodes });
      i = endIndex + 1;
      continue;
    }

    if (token.type === 'em_open') {
      const { inlineNodes, endIndex } = collectUntilClose(children, i + 1, 'em_close', footnoteDefinitions, counter);
      nodes.push({ type: 'italic', children: inlineNodes });
      i = endIndex + 1;
      continue;
    }

    if (token.type === 'link_open') {
      const href = token.attrGet('href') || '';
      const { inlineNodes, endIndex } = collectUntilClose(children, i + 1, 'link_close', footnoteDefinitions, counter);
      nodes.push({ type: 'link', href, children: inlineNodes });
      i = endIndex + 1;
      continue;
    }

    if (token.type === 'image') {
      // Inline images — render as inline-image node
      nodes.push({
        type: 'inline-image',
        src: token.attrGet('src') || '',
        alt: token.content || undefined,
      });
      i++;
      continue;
    }

    // Fallback: treat unknown tokens as text if they have content
    if (token.content) {
      const expanded = expandFootnoteRefs(token.content, footnoteDefinitions, counter);
      nodes.push(...expanded);
    }
    i++;
  }

  return nodes;
}

/**
 * Expands footnote references within a text string.
 * Returns an array of InlineNode (text spans and footnote-ref spans).
 */
function expandFootnoteRefs(
  text: string,
  footnoteDefinitions: Map<string, string>,
  counter: { value: number }
): InlineNode[] {
  const nodes: InlineNode[] = [];
  const regex = new RegExp(FOOTNOTE_REF_REGEX.source, FOOTNOTE_REF_REGEX.flags);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add any text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const id = match[1];
    const defContent = footnoteDefinitions.get(id);

    if (defContent) {
      counter.value++;
      // Parse the definition content as inline nodes
      // Use markdown-it to tokenize the definition content for inline parsing
      const defTokens = md.parseInline(defContent, {});
      const defChildren = defTokens.length > 0 && defTokens[0].children
        ? parseInlineNodes(defTokens[0].children, footnoteDefinitions, counter)
        : [{ type: 'text' as const, content: defContent }];

      nodes.push({
        type: 'footnote-ref',
        label: String(counter.value),
        content: defChildren,
      });
    } else {
      // No matching definition — fall back to TextSpan with raw text
      nodes.push({ type: 'text', content: `[^${id}]` });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    nodes.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no matches were found, return the original text as-is
  if (nodes.length === 0) {
    nodes.push({ type: 'text', content: text });
  }

  return nodes;
}

/**
 * Collects inline nodes from children until a closing token type is found.
 */
function collectUntilClose(
  children: Token[],
  startIndex: number,
  closeType: string,
  footnoteDefinitions: Map<string, string>,
  counter: { value: number }
): { inlineNodes: InlineNode[]; endIndex: number } {
  const collected: Token[] = [];
  let i = startIndex;

  while (i < children.length && children[i].type !== closeType) {
    collected.push(children[i]);
    i++;
  }

  return {
    inlineNodes: parseInlineNodes(collected, footnoteDefinitions, counter),
    endIndex: i, // points to the close token
  };
}
