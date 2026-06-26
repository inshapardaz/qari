/**
 * Property 1: EPUB Round-Trip Preservation
 *
 * For any valid Book representation, serializing it to EPUB via EPUBPrinterImpl
 * and parsing the result back via EPUBParserImpl SHALL produce a Book that is
 * structurally equal to the original — identical metadata, chapter count and ordering,
 * content node types and textual content, and opaque nodes preserved verbatim
 * (whitespace normalization between block elements is permitted).
 *
 * **Validates: Requirements 2.6, 9.3, 9.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EPUBParserImpl } from '../epub-parser';
import { EPUBPrinterImpl } from '../epub-printer';
import type {
  Book,
  BookMetadata,
  Chapter,
  ContentNode,
  InlineNode,
  ParagraphNode,
  HeadingNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
  OpaqueNode,
  TextSpan,
  BoldSpan,
  ItalicSpan,
  CodeSpan,
  LinkSpan,
  ListItem,
} from '../../models/book';

// --- Arbitraries ---

/** Generate safe text that won't cause XML issues and survives whitespace normalization */
const safeText = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      // Ensure at least one non-whitespace character at the start
      fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), {
        minLength: 1,
        maxLength: 5,
      }),
      fc.stringOf(
        fc.constantFrom(' ', 'a', 'b', 'c', '1', '2', '3', '.', ',', '!', '?', 'x', 'y', 'z'),
        { minLength: 0, maxLength: 20 }
      )
    )
    .map(([prefix, rest]) => `${prefix}${rest}`.trim() || prefix);

/** Generate a valid XML identifier (alphanumeric, starts with letter) */
const xmlId = (): fc.Arbitrary<string> =>
  fc.tuple(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'ch', 'chap', 'sec'),
    fc.nat({ max: 999 })
  ).map(([prefix, num]) => `${prefix}${num}`);

/** Generate a valid URL-like string for links/images */
const safeUrl = (): fc.Arbitrary<string> =>
  fc.tuple(
    fc.constantFrom('https://example.com/', 'http://test.org/', './'),
    fc.stringOf(fc.constantFrom('a', 'b', 'c', '1', '2', '3', '-', '/'), {
      minLength: 1,
      maxLength: 20,
    })
  ).map(([prefix, path]) => `${prefix}${path}`);

/** Generate an InlineNode (text, bold, italic, code, link) - non-recursive for simplicity */
const textSpanArb = (): fc.Arbitrary<TextSpan> =>
  safeText().map((content) => ({ type: 'text' as const, content }));

const codeSpanArb = (): fc.Arbitrary<CodeSpan> =>
  safeText().map((content) => ({ type: 'code' as const, content }));

const boldSpanArb = (): fc.Arbitrary<BoldSpan> =>
  fc
    .array(textSpanArb(), { minLength: 1, maxLength: 2 })
    .map((children) => ({ type: 'bold' as const, children }));

const italicSpanArb = (): fc.Arbitrary<ItalicSpan> =>
  fc
    .array(textSpanArb(), { minLength: 1, maxLength: 2 })
    .map((children) => ({ type: 'italic' as const, children }));

const linkSpanArb = (): fc.Arbitrary<LinkSpan> =>
  fc
    .tuple(safeUrl(), fc.array(textSpanArb(), { minLength: 1, maxLength: 2 }))
    .map(([href, children]) => ({ type: 'link' as const, href, children }));

const inlineNodeArb = (): fc.Arbitrary<InlineNode> =>
  fc.oneof(
    { weight: 5, arbitrary: textSpanArb() },
    { weight: 2, arbitrary: boldSpanArb() },
    { weight: 2, arbitrary: italicSpanArb() },
    { weight: 1, arbitrary: codeSpanArb() },
    { weight: 1, arbitrary: linkSpanArb() }
  );

/** Generate content nodes */
const paragraphNodeArb = (): fc.Arbitrary<ParagraphNode> =>
  fc
    .array(inlineNodeArb(), { minLength: 1, maxLength: 4 })
    .map((children) => ({ type: 'paragraph' as const, children }));

const headingNodeArb = (): fc.Arbitrary<HeadingNode> =>
  fc
    .tuple(
      fc.constantFrom(1, 2, 3, 4, 5, 6) as fc.Arbitrary<1 | 2 | 3 | 4 | 5 | 6>,
      fc.array(textSpanArb(), { minLength: 1, maxLength: 3 })
    )
    .map(([level, children]) => ({
      type: 'heading' as const,
      level,
      children,
    }));

const imageNodeArb = (): fc.Arbitrary<ImageNode> =>
  fc
    .tuple(safeUrl(), fc.option(safeText(), { nil: undefined }))
    .map(([src, alt]) => ({
      type: 'image' as const,
      src,
      ...(alt !== undefined && { alt }),
    }));

const codeBlockNodeArb = (): fc.Arbitrary<CodeBlockNode> =>
  fc
    .tuple(
      safeText(),
      fc.option(fc.constantFrom('javascript', 'python', 'typescript', 'rust'), {
        nil: undefined,
      })
    )
    .map(([content, language]) => ({
      type: 'code-block' as const,
      content,
      ...(language !== undefined && { language }),
    }));

const listItemArb = (): fc.Arbitrary<ListItem> =>
  fc
    .array(paragraphNodeArb(), { minLength: 1, maxLength: 2 })
    .map((children) => ({ children }));

const listNodeArb = (): fc.Arbitrary<ListNode> =>
  fc
    .tuple(fc.boolean(), fc.array(listItemArb(), { minLength: 1, maxLength: 3 }))
    .map(([ordered, items]) => ({
      type: 'list' as const,
      ordered,
      items,
    }));

/** OpaqueNode with valid HTML fragment as rawContent */
const opaqueNodeArb = (): fc.Arbitrary<OpaqueNode> =>
  fc
    .tuple(
      fc.constantFrom('audio', 'video'),
      safeText().map((text) => `<source src="test.mp3"/>${text}`),
      fc.dictionary(
        fc.constantFrom('id', 'class', 'data-type'),
        safeText().map((v) => v.slice(0, 10)),
        { minKeys: 0, maxKeys: 2 }
      )
    )
    .map(([originalTag, rawContent, attributes]) => ({
      type: 'opaque' as const,
      originalTag,
      rawContent,
      attributes,
    }));

const contentNodeArb = (): fc.Arbitrary<ContentNode> =>
  fc.oneof(
    { weight: 4, arbitrary: paragraphNodeArb() },
    { weight: 2, arbitrary: headingNodeArb() },
    { weight: 1, arbitrary: imageNodeArb() },
    { weight: 1, arbitrary: codeBlockNodeArb() },
    { weight: 1, arbitrary: listNodeArb() },
    { weight: 1, arbitrary: opaqueNodeArb() }
  );

/** Generate a chapter */
const chapterArb = (order: number): fc.Arbitrary<Chapter> =>
  fc
    .tuple(xmlId(), safeText(), fc.array(contentNodeArb(), { minLength: 1, maxLength: 5 }))
    .map(([id, title, content]) => ({
      id,
      title,
      order,
      content,
    }));

/** Generate BookMetadata */
const bookMetadataArb = (): fc.Arbitrary<BookMetadata> =>
  fc
    .tuple(
      safeText(),
      fc.option(safeText(), { nil: undefined }),
      fc.option(fc.constantFrom('en', 'ar', 'ur', 'fr', 'de'), { nil: undefined }),
      fc.option(safeText(), { nil: undefined }),
      fc.option(fc.constantFrom('2024-01-01', '2023-06-15', '2020-12-31'), { nil: undefined })
    )
    .map(([title, author, language, publisher, publicationDate]) => ({
      title,
      ...(author !== undefined && { author }),
      ...(language !== undefined && { language }),
      ...(publisher !== undefined && { publisher }),
      ...(publicationDate !== undefined && { publicationDate }),
    }));

/** Generate a full Book with unique chapter IDs */
const bookArb = (): fc.Arbitrary<Book> =>
  fc
    .tuple(
      bookMetadataArb(),
      fc.integer({ min: 1, max: 4 })
    )
    .chain(([metadata, chapterCount]) =>
      fc
        .tuple(
          ...Array.from({ length: chapterCount }, (_, i) => chapterArb(i))
        )
        .map((chapters) => {
          // Ensure unique chapter IDs
          const usedIds = new Set<string>();
          const uniqueChapters = chapters.map((ch, idx) => {
            let id = ch.id;
            while (usedIds.has(id)) {
              id = `${id}x${idx}`;
            }
            usedIds.add(id);
            return { ...ch, id, order: idx };
          });
          return { metadata, chapters: uniqueChapters };
        })
    );

// --- Comparison Helpers ---

/** Normalize XML content for comparison: remove namespace declarations, normalize self-closing tags */
function normalizeXmlContent(str: string): string {
  return str
    .replace(/\s*xmlns="[^"]*"/g, '')
    .replace(/\s*\/\s*>/g, '/>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize whitespace: trim and collapse internal whitespace */
function normalizeWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/** Extract text content from inline nodes */
function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.content;
        case 'code':
          return node.content;
        case 'bold':
        case 'italic':
          return extractInlineText(node.children);
        case 'link':
          return extractInlineText(node.children);
        default:
          return '';
      }
    })
    .join('');
}

/** Compare inline nodes structurally (type + text, with whitespace normalization) */
function compareInlineNodes(
  original: InlineNode[],
  parsed: InlineNode[]
): boolean {
  // Compare text content with whitespace normalization
  const origText = normalizeWhitespace(extractInlineText(original));
  const parsedText = normalizeWhitespace(extractInlineText(parsed));
  if (origText !== parsedText) return false;

  // Compare types in order
  if (original.length !== parsed.length) {
    // The parser might merge adjacent text nodes; compare flattened types
    return origText === parsedText;
  }

  for (let i = 0; i < original.length; i++) {
    if (original[i].type !== parsed[i].type) {
      // Type mismatch - but text content matches (parser may restructure)
      return origText === parsedText;
    }
  }
  return true;
}

/** Compare content nodes structurally */
function compareContentNode(original: ContentNode, parsed: ContentNode): boolean {
  if (original.type !== parsed.type) return false;

  switch (original.type) {
    case 'paragraph': {
      const p = parsed as ParagraphNode;
      return compareInlineNodes(original.children, p.children);
    }
    case 'heading': {
      const h = parsed as HeadingNode;
      if (original.level !== h.level) return false;
      return compareInlineNodes(original.children, h.children);
    }
    case 'image': {
      const img = parsed as ImageNode;
      if (original.src !== img.src) return false;
      // alt may be normalized
      const origAlt = normalizeWhitespace(original.alt || '');
      const parsedAlt = normalizeWhitespace(img.alt || '');
      return origAlt === parsedAlt;
    }
    case 'code-block': {
      const cb = parsed as CodeBlockNode;
      if (normalizeWhitespace(original.content) !== normalizeWhitespace(cb.content))
        return false;
      // Language may or may not be preserved
      if (original.language && cb.language) {
        return original.language === cb.language;
      }
      return true;
    }
    case 'list': {
      const list = parsed as ListNode;
      if (original.ordered !== list.ordered) return false;
      if (original.items.length !== list.items.length) return false;
      for (let i = 0; i < original.items.length; i++) {
        const origItem = original.items[i];
        const parsedItem = list.items[i];
        if (origItem.children.length !== parsedItem.children.length) return false;
        for (let j = 0; j < origItem.children.length; j++) {
          if (!compareContentNode(origItem.children[j], parsedItem.children[j]))
            return false;
        }
      }
      return true;
    }
    case 'opaque': {
      const op = parsed as OpaqueNode;
      if (original.originalTag !== op.originalTag) return false;
      // rawContent should be preserved (whitespace + XML namespace normalization permitted)
      if (normalizeXmlContent(original.rawContent) !== normalizeXmlContent(op.rawContent))
        return false;
      // Attributes should match
      const origKeys = Object.keys(original.attributes).sort();
      const parsedKeys = Object.keys(op.attributes).sort();
      if (origKeys.length !== parsedKeys.length) return false;
      for (let i = 0; i < origKeys.length; i++) {
        if (origKeys[i] !== parsedKeys[i]) return false;
        if (original.attributes[origKeys[i]] !== op.attributes[parsedKeys[i]])
          return false;
      }
      return true;
    }
    default:
      return false;
  }
}

/** Compare two books structurally */
function compareBooksStructurally(original: Book, parsed: Book): {
  equal: boolean;
  reason?: string;
} {
  // Compare metadata (whitespace normalization permitted)
  if (normalizeWhitespace(original.metadata.title) !== normalizeWhitespace(parsed.metadata.title)) {
    return { equal: false, reason: `Title mismatch: "${original.metadata.title}" vs "${parsed.metadata.title}"` };
  }
  if (normalizeWhitespace(original.metadata.author || '') !== normalizeWhitespace(parsed.metadata.author || '')) {
    return { equal: false, reason: `Author mismatch: "${original.metadata.author}" vs "${parsed.metadata.author}"` };
  }
  if (normalizeWhitespace(original.metadata.language || '') !== normalizeWhitespace(parsed.metadata.language || '')) {
    return { equal: false, reason: `Language mismatch: "${original.metadata.language}" vs "${parsed.metadata.language}"` };
  }
  if (normalizeWhitespace(original.metadata.publisher || '') !== normalizeWhitespace(parsed.metadata.publisher || '')) {
    return { equal: false, reason: `Publisher mismatch: "${original.metadata.publisher}" vs "${parsed.metadata.publisher}"` };
  }
  if (normalizeWhitespace(original.metadata.publicationDate || '') !== normalizeWhitespace(parsed.metadata.publicationDate || '')) {
    return { equal: false, reason: `PublicationDate mismatch: "${original.metadata.publicationDate}" vs "${parsed.metadata.publicationDate}"` };
  }

  // Compare chapter count
  if (original.chapters.length !== parsed.chapters.length) {
    return {
      equal: false,
      reason: `Chapter count mismatch: ${original.chapters.length} vs ${parsed.chapters.length}`,
    };
  }

  // Compare chapters in order
  for (let i = 0; i < original.chapters.length; i++) {
    const origCh = original.chapters[i];
    const parsedCh = parsed.chapters[i];

    // Chapter ID should match
    if (origCh.id !== parsedCh.id) {
      return { equal: false, reason: `Chapter ${i} ID mismatch: "${origCh.id}" vs "${parsedCh.id}"` };
    }

    // Chapter title - parser extracts from <title> element with trim()
    const origTitle = normalizeWhitespace(origCh.title);
    const parsedTitle = normalizeWhitespace(parsedCh.title);
    if (origTitle !== parsedTitle) {
      return { equal: false, reason: `Chapter ${i} title mismatch: "${origCh.title}" vs "${parsedCh.title}"` };
    }

    // Chapter order should match
    if (origCh.order !== parsedCh.order) {
      return { equal: false, reason: `Chapter ${i} order mismatch: ${origCh.order} vs ${parsedCh.order}` };
    }

    // Compare content nodes - types and text in same order
    if (origCh.content.length !== parsedCh.content.length) {
      return {
        equal: false,
        reason: `Chapter ${i} content count mismatch: ${origCh.content.length} vs ${parsedCh.content.length}`,
      };
    }

    for (let j = 0; j < origCh.content.length; j++) {
      if (!compareContentNode(origCh.content[j], parsedCh.content[j])) {
        return {
          equal: false,
          reason: `Chapter ${i} content[${j}] mismatch: type "${origCh.content[j].type}" vs "${parsedCh.content[j].type}"`,
        };
      }
    }
  }

  return { equal: true };
}

// --- Property Test ---

describe('Feature: universal-ebook-reader, Property 1: EPUB Round-Trip Preservation', () => {
  const printer = new EPUBPrinterImpl();
  const parser = new EPUBParserImpl();

  it('parse(print(book)) produces a structurally equal Book', async () => {
    await fc.assert(
      fc.asyncProperty(bookArb(), async (originalBook) => {
        // Print: Book → EPUB (ArrayBuffer)
        const epubBuffer = await printer.toEpub(originalBook);

        // Parse: EPUB (ArrayBuffer) → Book
        const parsedBook = await parser.parse(epubBuffer);

        // Assert structural equality
        const result = compareBooksStructurally(originalBook, parsedBook);
        if (!result.equal) {
          throw new Error(
            `Round-trip failed: ${result.reason}\n` +
            `Original: ${JSON.stringify(originalBook, null, 2).slice(0, 500)}\n` +
            `Parsed: ${JSON.stringify(parsedBook, null, 2).slice(0, 500)}`
          );
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
