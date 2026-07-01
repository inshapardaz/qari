/**
 * Property 1: FootnoteRefSpan structural invariant
 *
 * Feature: footnote-popover, Property 1: FootnoteRefSpan structural invariant
 *
 * Validates: Requirements 1.2, 1.3
 *
 * For any generated FootnoteRefSpan node, the `label` field must be a non-empty string
 * and the `content` field must be a valid array (length >= 0) where every element is
 * a valid InlineNode.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import type {
  FootnoteRefSpan,
  InlineNode,
  TextSpan,
  BoldSpan,
  ItalicSpan,
  LinkSpan,
  CodeSpan,
  InlineImageSpan,
} from '../../models/book';

/**
 * Generator for a non-empty alphanumeric label string.
 */
const labelArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 1, maxLength: 10 }
);

/**
 * Generator for a TextSpan node.
 */
const textSpanArb: fc.Arbitrary<TextSpan> = fc.record({
  type: fc.constant('text' as const),
  content: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * Generator for a CodeSpan node.
 */
const codeSpanArb: fc.Arbitrary<CodeSpan> = fc.record({
  type: fc.constant('code' as const),
  content: fc.string({ minLength: 1, maxLength: 50 }),
});

/**
 * Generator for an InlineImageSpan node.
 */
const inlineImageSpanArb: fc.Arbitrary<InlineImageSpan> = fc.record({
  type: fc.constant('inline-image' as const),
  src: fc.webUrl(),
  alt: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

/**
 * Generator for leaf-level InlineNode (non-recursive).
 */
const leafInlineNodeArb: fc.Arbitrary<InlineNode> = fc.oneof(
  textSpanArb,
  codeSpanArb,
  inlineImageSpanArb
);

/**
 * Generator for InlineNode with one level of nesting (Bold, Italic, Link wrapping leaves).
 */
const inlineNodeArb: fc.Arbitrary<InlineNode> = fc.oneof(
  textSpanArb,
  codeSpanArb,
  inlineImageSpanArb,
  fc.record({
    type: fc.constant('bold' as const),
    children: fc.array(leafInlineNodeArb, { minLength: 1, maxLength: 3 }),
  }) as fc.Arbitrary<BoldSpan>,
  fc.record({
    type: fc.constant('italic' as const),
    children: fc.array(leafInlineNodeArb, { minLength: 1, maxLength: 3 }),
  }) as fc.Arbitrary<ItalicSpan>,
  fc.record({
    type: fc.constant('link' as const),
    href: fc.webUrl(),
    children: fc.array(leafInlineNodeArb, { minLength: 1, maxLength: 3 }),
  }) as fc.Arbitrary<LinkSpan>
);

/**
 * Generator for a valid FootnoteRefSpan.
 */
const footnoteRefSpanArb: fc.Arbitrary<FootnoteRefSpan> = fc.record({
  type: fc.constant('footnote-ref' as const),
  label: labelArb,
  content: fc.array(inlineNodeArb, { minLength: 0, maxLength: 5 }),
});

/**
 * Type guard: checks if a value is a valid InlineNode based on the union's type discriminant.
 */
function isValidInlineNode(node: unknown): node is InlineNode {
  if (node === null || node === undefined || typeof node !== 'object') return false;
  const n = node as Record<string, unknown>;
  const validTypes = ['text', 'bold', 'italic', 'link', 'code', 'inline-image', 'footnote-ref'];
  if (!validTypes.includes(n.type as string)) return false;

  switch (n.type) {
    case 'text':
      return typeof n.content === 'string';
    case 'code':
      return typeof n.content === 'string';
    case 'inline-image':
      return typeof n.src === 'string';
    case 'bold':
    case 'italic':
      return Array.isArray(n.children) && (n.children as unknown[]).every(isValidInlineNode);
    case 'link':
      return typeof n.href === 'string' && Array.isArray(n.children) && (n.children as unknown[]).every(isValidInlineNode);
    case 'footnote-ref':
      return typeof n.label === 'string' && Array.isArray(n.content) && (n.content as unknown[]).every(isValidInlineNode);
    default:
      return false;
  }
}

describe('Property 1: FootnoteRefSpan structural invariant', () => {
  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any generated FootnoteRefSpan, the label field is a non-empty string
   * and the content field is a valid array of InlineNode elements.
   */
  it('label is a non-empty string and content is a valid array of InlineNode elements', () => {
    fc.assert(
      fc.property(footnoteRefSpanArb, (span) => {
        // Verify type discriminant
        expect(span.type).toBe('footnote-ref');

        // Requirement 1.2: label is a non-empty string
        expect(typeof span.label).toBe('string');
        expect(span.label.length).toBeGreaterThan(0);

        // Requirement 1.3: content is a valid array of InlineNode elements
        expect(Array.isArray(span.content)).toBe(true);
        for (const node of span.content) {
          expect(isValidInlineNode(node)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
