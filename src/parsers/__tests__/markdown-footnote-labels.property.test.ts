/**
 * Property 4: Markdown footnote labels are sequentially numbered
 *
 * For any Markdown document with K footnote references (each with a matching
 * definition), the resulting FootnoteRefSpan nodes SHALL have labels "1" through
 * "K" in order of appearance.
 *
 * **Validates: Requirements 3.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MarkdownParserImpl } from '../markdown-parser';
import type {
  FootnoteRefSpan,
  InlineNode,
  ContentNode,
  ParagraphNode,
} from '../../models/book';

// --- Arbitraries ---

/** Generate a safe footnote identifier (alphanumeric, no special chars) */
const footnoteIdArb = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom('fn', 'note', 'ref', 'src', 'cite'),
      fc.nat({ max: 999 })
    )
    .map(([prefix, num]) => `${prefix}${num}`);

/** Generate safe footnote definition content (plain text, no special markdown chars) */
const footnoteContentArb = (): fc.Arbitrary<string> =>
  fc.constantFrom(
    'This is a footnote.',
    'See the original source.',
    'Author comment.',
    'Published in 2024.',
    'Translated from Arabic.',
    'Emphasis added by editor.',
    'Citation from the book.',
    'Reference to chapter one.',
    'Further details available.',
    'Historical context provided.'
  );

/** Generate paragraph text that doesn't contain footnote-like patterns */
const paragraphTextArb = (): fc.Arbitrary<string> =>
  fc.constantFrom(
    'This is some text',
    'Here is another sentence',
    'The quick brown fox',
    'A paragraph of content',
    'Some more reading material'
  );

/**
 * Generate a complete Markdown document with K unique footnote references
 * and matching definitions. Each reference appears in a separate sentence
 * within a single paragraph, with definitions at the end.
 */
interface MarkdownWithFootnotes {
  markdown: string;
  count: number;
  ids: string[];
}

const markdownWithFootnotesArb = (): fc.Arbitrary<MarkdownWithFootnotes> =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 5 }),
      fc.infiniteStream(footnoteIdArb()),
      fc.infiniteStream(footnoteContentArb()),
      fc.infiniteStream(paragraphTextArb())
    )
    .map(([count, idStream, contentStream, textStream]) => {
      // Generate unique IDs
      const usedIds = new Set<string>();
      const ids: string[] = [];
      const idIterator = idStream[Symbol.iterator]();
      while (ids.length < count) {
        const { value } = idIterator.next();
        if (!usedIds.has(value)) {
          usedIds.add(value);
          ids.push(value);
        }
      }

      // Build the markdown content with references in a paragraph
      const textIterator = textStream[Symbol.iterator]();
      const contentIterator = contentStream[Symbol.iterator]();

      // Create paragraph lines with embedded footnote references
      const paragraphParts: string[] = [];
      for (let i = 0; i < count; i++) {
        const { value: text } = textIterator.next();
        paragraphParts.push(`${text}[^${ids[i]}]`);
      }
      const paragraph = paragraphParts.join('. ') + '.';

      // Create footnote definitions at the end
      const definitions: string[] = [];
      for (let i = 0; i < count; i++) {
        const { value: content } = contentIterator.next();
        definitions.push(`[^${ids[i]}]: ${content}`);
      }

      const markdown = `${paragraph}\n\n${definitions.join('\n')}`;

      return { markdown, count, ids };
    });

// --- Helpers ---

/** Recursively collect all FootnoteRefSpan nodes from content in document order */
function collectFootnoteRefs(contentNodes: ContentNode[]): FootnoteRefSpan[] {
  const refs: FootnoteRefSpan[] = [];

  for (const node of contentNodes) {
    if (node.type === 'paragraph') {
      collectFootnoteRefsFromInline(node.children, refs);
    } else if (node.type === 'heading') {
      collectFootnoteRefsFromInline(node.children, refs);
    } else if (node.type === 'list') {
      for (const item of node.items) {
        refs.push(...collectFootnoteRefs(item.children));
      }
    }
  }

  return refs;
}

function collectFootnoteRefsFromInline(nodes: InlineNode[], refs: FootnoteRefSpan[]): void {
  for (const node of nodes) {
    if (node.type === 'footnote-ref') {
      refs.push(node);
    } else if (node.type === 'bold' || node.type === 'italic' || node.type === 'link') {
      collectFootnoteRefsFromInline(node.children, refs);
    }
  }
}

// --- Property Test ---

describe('Feature: footnote-popover, Property 4: Markdown footnote labels are sequentially numbered', () => {
  const parser = new MarkdownParserImpl();

  it('assigns labels "1" through "K" in order of appearance for K footnote references', () => {
    fc.assert(
      fc.property(markdownWithFootnotesArb(), ({ markdown, count }) => {
        const book = parser.parse(markdown);

        // Collect all footnote refs across all chapters in document order
        const allRefs: FootnoteRefSpan[] = [];
        for (const chapter of book.chapters) {
          allRefs.push(...collectFootnoteRefs(chapter.content));
        }

        // There should be exactly K FootnoteRefSpan nodes
        expect(allRefs.length).toBe(count);

        // Labels should be "1", "2", ..., "K" in order
        for (let i = 0; i < count; i++) {
          expect(allRefs[i].label).toBe(String(i + 1));
        }
      }),
      { numRuns: 100 }
    );
  });
});
