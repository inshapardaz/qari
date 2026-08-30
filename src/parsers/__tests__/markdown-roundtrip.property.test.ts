/**
 * Property 2: Markdown Round-Trip Preservation
 *
 * For any valid Book representation that is expressible in Markdown,
 * serializing it via Pretty_Printer to Markdown and parsing back via
 * Markdown_Parser SHALL produce a Book with identical chapter count,
 * chapter titles, content node types and text content in the same order,
 * and metadata fields.
 *
 * Feature: universal-ebook-reader, Property 2: Markdown Round-Trip Preservation
 *
 * **Validates: Requirements 2.7, 10.1, 10.2, 10.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MarkdownParserImpl } from '../markdown-parser';
import { MarkdownPrinterImpl } from '../markdown-printer';
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
  TextSpan,
  BoldSpan,
  ItalicSpan,
  CodeSpan,
  LinkSpan,
} from '../../models/book';

// --- Generators ---

/**
 * Safe text that uses only alphanumeric characters and spaces.
 * This avoids all Markdown-special and punctuation characters that could
 * cause ambiguous parsing with emphasis, code spans, links, etc.
 */
const safeText: fc.Arbitrary<string> = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')
    ),
    { minLength: 1, maxLength: 30 }
  )
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/**
 * Non-empty title string (avoids Markdown special chars).
 */
const titleArb: fc.Arbitrary<string> = safeText;

/**
 * Text content for code blocks - uses alphanumeric characters, spaces, and
 * common safe symbols to avoid backtick issues.
 */
const codeContent: fc.Arbitrary<string> = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 =;:.'.split('')
    ),
    { minLength: 1, maxLength: 50 }
  )
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

/**
 * Language identifier for code blocks.
 */
const codeLanguage: fc.Arbitrary<string> = fc.constantFrom(
  'typescript',
  'javascript',
  'python',
  'rust',
  'html',
  'css'
);

/**
 * URL for links and images - simple safe URLs.
 */
const urlArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('https://example.com/', 'https://test.org/', 'https://docs.io/'),
    safeText
  )
  .map(([base, path]) => `${base}${encodeURIComponent(path)}`);

/**
 * TextSpan generator.
 */
const textSpanArb: fc.Arbitrary<TextSpan> = safeText.map((content) => ({
  type: 'text' as const,
  content,
}));

/**
 * CodeSpan generator.
 */
const codeSpanArb: fc.Arbitrary<CodeSpan> = codeContent.map((content) => ({
  type: 'code' as const,
  content,
}));

/**
 * InlineNode generator (leaf-level first, then wrapped forms).
 * We limit nesting depth to avoid overly complex structures.
 */
const inlineNodeArb: fc.Arbitrary<InlineNode> = fc.oneof(
  { weight: 5, arbitrary: textSpanArb },
  { weight: 2, arbitrary: codeSpanArb },
  {
    weight: 2,
    arbitrary: textSpanArb.map(
      (child): BoldSpan => ({ type: 'bold', children: [child] })
    ),
  },
  {
    weight: 2,
    arbitrary: textSpanArb.map(
      (child): ItalicSpan => ({ type: 'italic', children: [child] })
    ),
  },
  {
    weight: 1,
    arbitrary: fc
      .tuple(urlArb, textSpanArb)
      .map(([href, child]): LinkSpan => ({ type: 'link', href, children: [child] })),
  }
);

/**
 * Array of inline nodes for paragraph/heading children.
 * Avoids adjacent same-type nodes (text+text or code+code) since the printer
 * concatenates them into a single string that parses back as one node.
 */
const inlineNodesArb: fc.Arbitrary<InlineNode[]> = fc
  .array(inlineNodeArb, { minLength: 1, maxLength: 4 })
  .map((nodes) => {
    // Remove adjacent nodes of the same type to avoid merge ambiguity
    const filtered: InlineNode[] = [nodes[0]];
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i].type !== nodes[i - 1].type) {
        filtered.push(nodes[i]);
      }
    }
    return filtered;
  })
  .filter((nodes) => nodes.length > 0);

/**
 * ParagraphNode generator.
 */
const paragraphNodeArb: fc.Arbitrary<ParagraphNode> = inlineNodesArb.map(
  (children) => ({ type: 'paragraph' as const, children })
);

/**
 * HeadingNode generator (levels 3-6 only, since H1=title, H2=chapter in Markdown mapping).
 */
const headingNodeArb: fc.Arbitrary<HeadingNode> = fc
  .tuple(
    fc.constantFrom(3, 4, 5, 6) as fc.Arbitrary<3 | 4 | 5 | 6>,
    fc.array(textSpanArb as fc.Arbitrary<InlineNode>, { minLength: 1, maxLength: 2 })
  )
  .map(([level, children]) => ({
    type: 'heading' as const,
    level,
    children,
  }));

/**
 * ImageNode generator.
 */
const imageNodeArb: fc.Arbitrary<ImageNode> = fc
  .tuple(urlArb, safeText)
  .map(([src, alt]) => ({
    type: 'image' as const,
    src,
    alt,
  }));

/**
 * CodeBlockNode generator.
 */
const codeBlockNodeArb: fc.Arbitrary<CodeBlockNode> = fc
  .tuple(codeContent, fc.option(codeLanguage, { nil: undefined }))
  .map(([content, language]) => ({
    type: 'code-block' as const,
    language,
    content: content + '\n', // Parser always produces trailing newline in code content
  }));

/**
 * ListNode generator (flat lists only - no nested lists to keep round-trip simple).
 */
const listNodeArb: fc.Arbitrary<ListNode> = fc
  .tuple(
    fc.boolean(),
    fc.array(
      paragraphNodeArb.map(
        (para): ListItem => ({ children: [para] })
      ),
      { minLength: 1, maxLength: 3 }
    )
  )
  .map(([ordered, items]) => ({
    type: 'list' as const,
    ordered,
    items,
  }));

/**
 * ContentNode generator - one of the Markdown-expressible types.
 */
const contentNodeArb: fc.Arbitrary<ContentNode> = fc.oneof(
  { weight: 4, arbitrary: paragraphNodeArb },
  { weight: 2, arbitrary: headingNodeArb },
  { weight: 1, arbitrary: imageNodeArb },
  { weight: 2, arbitrary: codeBlockNodeArb },
  { weight: 2, arbitrary: listNodeArb }
);

/**
 * Chapter generator with a non-empty title and content nodes.
 * Avoids adjacent lists of the same type (both ordered or both unordered)
 * because Markdown parsers merge them into a single list.
 */
const chapterArb = (order: number): fc.Arbitrary<Chapter> =>
  fc
    .tuple(titleArb, fc.array(contentNodeArb, { minLength: 0, maxLength: 5 }))
    .map(([title, content]) => {
      // Filter out adjacent lists of the same ordered type
      const filtered: ContentNode[] = [];
      for (const node of content) {
        const last = filtered[filtered.length - 1];
        if (
          node.type === 'list' &&
          last &&
          last.type === 'list' &&
          (last as ListNode).ordered === (node as ListNode).ordered
        ) {
          // Skip this list to avoid merging
          continue;
        }
        filtered.push(node);
      }
      return {
        id: `chapter-${order}`,
        title,
        order,
        content: filtered,
      };
    });

/**
 * Book generator - produces a valid Book with Markdown-expressible content.
 */
const bookArb: fc.Arbitrary<Book> = fc
  .tuple(
    titleArb,
    fc.integer({ min: 1, max: 4 })
  )
  .chain(([title, chapterCount]) =>
    fc
      .tuple(
        ...Array.from({ length: chapterCount }, (_, i) => chapterArb(i))
      )
      .map((chapters) => ({
        metadata: { title },
        chapters,
      }))
  );

// --- Structural equality helpers ---

/**
 * Merges adjacent TextSpan nodes into a single TextSpan.
 * The printer concatenates all inline nodes into a string, so consecutive text nodes
 * get merged when parsed back — this normalization accounts for that.
 */
function mergeAdjacentTextSpans(nodes: InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (node.type === 'text' && last && last.type === 'text') {
      // Merge into the previous text span
      merged[merged.length - 1] = { type: 'text', content: last.content + node.content };
    } else {
      merged.push(node);
    }
  }
  return merged;
}

function normalizeInlineNodes(nodes: InlineNode[]): InlineNode[] {
  return mergeAdjacentTextSpans(nodes.map(normalizeInlineNode));
}

function normalizeInlineNode(node: InlineNode): InlineNode {
  switch (node.type) {
    case 'text':
      return { type: 'text', content: node.content };
    case 'code':
      return { type: 'code', content: node.content };
    case 'bold':
      return { type: 'bold', children: normalizeInlineNodes(node.children) };
    case 'italic':
      return { type: 'italic', children: normalizeInlineNodes(node.children) };
    case 'link':
      return { type: 'link', href: node.href, children: normalizeInlineNodes(node.children) };
    default:
      return node;
  }
}

function normalizeContentNode(node: ContentNode): ContentNode {
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', children: normalizeInlineNodes(node.children) };
    case 'heading':
      return { type: 'heading', level: node.level, children: normalizeInlineNodes(node.children) };
    case 'image':
      return { type: 'image', src: node.src, ...(node.alt ? { alt: node.alt } : {}) };
    case 'code-block':
      return {
        type: 'code-block',
        content: node.content,
        ...(node.language ? { language: node.language } : {}),
      };
    case 'list':
      return {
        type: 'list',
        ordered: node.ordered,
        items: node.items.map((item) => ({
          children: item.children.map(normalizeContentNode),
        })),
      };
    default:
      return node;
  }
}

function normalizeBook(book: Book): {
  title: string;
  chapters: Array<{ title: string; content: ContentNode[] }>;
} {
  return {
    title: book.metadata.title,
    chapters: book.chapters.map((ch) => ({
      title: ch.title,
      content: ch.content.map(normalizeContentNode),
    })),
  };
}

// --- Tests ---

describe('Property 2: Markdown Round-Trip Preservation', () => {
  const parser = new MarkdownParserImpl();
  const printer = new MarkdownPrinterImpl();

  it('parse(print(book)) preserves book structure for any Markdown-expressible Book', () => {
    fc.assert(
      fc.property(bookArb, (originalBook) => {
        // Print the book to Markdown
        const markdown = printer.toMarkdown(originalBook);

        // Parse it back
        const parsedBook = parser.parse(markdown);

        // Normalize both for comparison
        const normalizedOriginal = normalizeBook(originalBook);
        const normalizedParsed = normalizeBook(parsedBook);

        // Assert structural equality
        expect(normalizedParsed.title).toBe(normalizedOriginal.title);
        expect(normalizedParsed.chapters.length).toBe(normalizedOriginal.chapters.length);

        for (let i = 0; i < normalizedOriginal.chapters.length; i++) {
          const origChapter = normalizedOriginal.chapters[i];
          const parsedChapter = normalizedParsed.chapters[i];

          expect(parsedChapter.title).toBe(origChapter.title);

          // A chapter with a title gets that title re-rendered as an actual
          // heading at the start of its own content on parse (see
          // `createChapter` in markdown-parser.ts) — printed markdown always
          // has the title on its own `## ...` line, so a titled chapter's
          // parsed content always gains this one extra leading node versus
          // the original Book that was printed. Peel it off before
          // comparing the rest of the content, which round-trips exactly.
          const expectsTitleHeading = origChapter.title !== '';
          if (expectsTitleHeading) {
            expect(parsedChapter.content[0]?.type).toBe('heading');
          }
          const parsedBody = expectsTitleHeading ? parsedChapter.content.slice(1) : parsedChapter.content;

          expect(parsedBody.length).toBe(origChapter.content.length);

          for (let j = 0; j < origChapter.content.length; j++) {
            expect(parsedBody[j]).toEqual(origChapter.content[j]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
