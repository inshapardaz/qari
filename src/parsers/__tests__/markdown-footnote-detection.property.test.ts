/**
 * Property 3: Markdown footnote reference produces correct FootnoteRefSpan
 *
 * For any Markdown document containing a `[^id]` reference with a matching
 * `[^id]: content` definition, the parser SHALL produce a `FootnoteRefSpan`
 * whose `content` field is the parsed inline representation of the definition text.
 *
 * **Validates: Requirements 3.1, 3.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MarkdownParserImpl } from '../markdown-parser';
import type {
  InlineNode,
  FootnoteRefSpan,
  ParagraphNode,
} from '../../models/book';

// --- Arbitraries ---

/**
 * Generate a valid footnote ID (alphanumeric, no special chars that would
 * interfere with regex matching).
 */
const footnoteIdArb = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom('note', 'fn', 'ref', 'src', 'cite', 'bib'),
      fc.nat({ max: 999 })
    )
    .map(([prefix, num]) => `${prefix}${num}`);

/**
 * Generate plain text content for footnote definitions.
 * Avoids characters that could be misinterpreted as markdown syntax.
 */
const plainContentArb = (): fc.Arbitrary<string> =>
  fc
    .array(
      fc.constantFrom(
        'This is a footnote.',
        'See the original source.',
        'Author commentary.',
        'Published in 2024.',
        'Translated from Latin.',
        'Emphasis mine.',
        'Citation needed.',
        'Ibid.',
        'Op. cit.',
        'Refer to chapter 3.'
      ),
      { minLength: 1, maxLength: 2 }
    )
    .map((parts) => parts.join(' '));

/**
 * Generate footnote definition content that can include inline formatting.
 */
interface FootnoteDefContent {
  raw: string; // The raw markdown definition content
  expectedText: string; // The expected text content after parsing
}

const footnoteDefContentArb = (): fc.Arbitrary<FootnoteDefContent> =>
  fc.oneof(
    // Plain text definition
    plainContentArb().map((text) => ({
      raw: text,
      expectedText: text,
    })),
    // Definition with bold text
    fc
      .tuple(plainContentArb(), plainContentArb())
      .map(([before, bold]) => ({
        raw: `${before} **${bold}**`,
        expectedText: `${before} ${bold}`,
      })),
    // Definition with italic text
    fc
      .tuple(plainContentArb(), plainContentArb())
      .map(([before, italic]) => ({
        raw: `${before} *${italic}*`,
        expectedText: `${before} ${italic}`,
      }))
  );

/**
 * Generate a complete test case with footnote ID, definition content,
 * and surrounding paragraph text.
 */
interface MarkdownFootnoteTestCase {
  id: string;
  defContent: FootnoteDefContent;
  paragraphBefore: string;
  paragraphAfter: string;
}

const markdownFootnoteTestCaseArb = (): fc.Arbitrary<MarkdownFootnoteTestCase> =>
  fc
    .tuple(
      footnoteIdArb(),
      footnoteDefContentArb(),
      fc.constantFrom(
        'Some text before',
        'In the beginning',
        'As noted',
        'Consider this',
        'The evidence shows'
      ),
      fc.constantFrom(
        'and text after.',
        'continues here.',
        'as expected.',
        'in context.',
        'for reference.'
      )
    )
    .map(([id, defContent, paragraphBefore, paragraphAfter]) => ({
      id,
      defContent,
      paragraphBefore,
      paragraphAfter,
    }));

// --- Helpers ---

/**
 * Build a Markdown document from a test case with a footnote reference
 * and its matching definition.
 */
function buildMarkdown(testCase: MarkdownFootnoteTestCase): string {
  const { id, defContent, paragraphBefore, paragraphAfter } = testCase;
  return [
    `${paragraphBefore} [^${id}] ${paragraphAfter}`,
    '',
    `[^${id}]: ${defContent.raw}`,
  ].join('\n');
}

/**
 * Extract all text content from an array of InlineNode.
 */
function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.content;
        case 'bold':
        case 'italic':
        case 'link':
          return extractInlineText(node.children);
        case 'code':
          return node.content;
        case 'footnote-ref':
          return node.label;
        case 'inline-image':
          return '';
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Find all FootnoteRefSpan nodes in chapter paragraph content.
 */
function findFootnoteRefs(nodes: InlineNode[]): FootnoteRefSpan[] {
  const refs: FootnoteRefSpan[] = [];
  for (const node of nodes) {
    if (node.type === 'footnote-ref') {
      refs.push(node);
    } else if (node.type === 'bold' || node.type === 'italic' || node.type === 'link') {
      refs.push(...findFootnoteRefs(node.children));
    }
  }
  return refs;
}

// --- Property Test ---

describe('Property 3: Markdown footnote reference produces correct FootnoteRefSpan', () => {
  const parser = new MarkdownParserImpl();

  /**
   * **Validates: Requirements 3.1, 3.3**
   *
   * For any Markdown with [^id] and matching [^id]: content, parser produces
   * a FootnoteRefSpan with content matching the parsed definition.
   */
  it('produces a FootnoteRefSpan with correct content for any footnote reference with matching definition', () => {
    fc.assert(
      fc.property(markdownFootnoteTestCaseArb(), (testCase) => {
        const markdown = buildMarkdown(testCase);
        const book = parser.parse(markdown);

        // The book should have at least one chapter
        expect(book.chapters.length).toBeGreaterThanOrEqual(1);

        const chapter = book.chapters[0];

        // Find all paragraphs in the chapter content
        const paragraphs = chapter.content.filter(
          (node): node is ParagraphNode => node.type === 'paragraph'
        );

        // Collect all footnote refs across all paragraphs
        const allFootnoteRefs: FootnoteRefSpan[] = [];
        for (const para of paragraphs) {
          allFootnoteRefs.push(...findFootnoteRefs(para.children));
        }

        // Requirement 3.1: A [^id] reference with a matching definition
        // SHALL produce a FootnoteRefSpan
        expect(allFootnoteRefs.length).toBe(1);

        const footnoteRef = allFootnoteRefs[0];

        // Verify it has the correct type
        expect(footnoteRef.type).toBe('footnote-ref');

        // Requirement 3.3: The content field should contain the parsed inline
        // representation of the definition text
        expect(Array.isArray(footnoteRef.content)).toBe(true);
        expect(footnoteRef.content.length).toBeGreaterThan(0);

        // The text content of the footnote's content nodes should match
        // the expected text from the definition
        const actualTextContent = extractInlineText(footnoteRef.content).trim();
        const expectedTextContent = testCase.defContent.expectedText.trim();
        expect(actualTextContent).toBe(expectedTextContent);
      }),
      { numRuns: 100 }
    );
  });
});
