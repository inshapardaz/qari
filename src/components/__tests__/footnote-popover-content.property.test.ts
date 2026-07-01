/**
 * Property 6: Popover renders all footnote content nodes
 *
 * Validates: Requirements 5.3
 *
 * For any FootnoteRefSpan with a non-empty content array, when the FootnotePopover
 * is visible, it SHALL render each InlineNode in the content array via the provided
 * renderInlineNode function.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';

import { FootnotePopover } from '../../components/FootnotePopover';
import type { InlineNode, FootnoteRefSpan } from '../../models/book';

/**
 * Generator for a simple alphanumeric string to avoid special characters
 * that could cause issues in DOM matching.
 */
const simpleStringArb = (minLength = 1, maxLength = 20) =>
  fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
    { minLength, maxLength }
  );

/**
 * Generator for a TextSpan InlineNode — the simplest node type for content testing.
 */
const textSpanArb: fc.Arbitrary<InlineNode> = simpleStringArb(1, 30).map((content) => ({
  type: 'text' as const,
  content,
}));

/**
 * Generator for a BoldSpan InlineNode with a single text child.
 */
const boldSpanArb: fc.Arbitrary<InlineNode> = simpleStringArb(1, 20).map((content) => ({
  type: 'bold' as const,
  children: [{ type: 'text' as const, content }],
}));

/**
 * Generator for an ItalicSpan InlineNode with a single text child.
 */
const italicSpanArb: fc.Arbitrary<InlineNode> = simpleStringArb(1, 20).map((content) => ({
  type: 'italic' as const,
  children: [{ type: 'text' as const, content }],
}));

/**
 * Generator for an arbitrary InlineNode (one of text, bold, italic).
 */
const inlineNodeArb: fc.Arbitrary<InlineNode> = fc.oneof(
  textSpanArb,
  boldSpanArb,
  italicSpanArb
);

/**
 * Generator for a non-empty content array of InlineNodes.
 */
const nonEmptyContentArb: fc.Arbitrary<InlineNode[]> = fc.array(inlineNodeArb, {
  minLength: 1,
  maxLength: 10,
});

/**
 * Generator for a FootnoteRefSpan with non-empty content.
 */
const footnoteRefSpanArb: fc.Arbitrary<FootnoteRefSpan> = fc
  .tuple(simpleStringArb(1, 5), nonEmptyContentArb)
  .map(([label, content]) => ({
    type: 'footnote-ref' as const,
    label,
    content,
  }));

describe('Property 6: Popover renders all footnote content nodes', () => {
  /**
   * **Validates: Requirements 5.3**
   *
   * For any FootnoteRefSpan with non-empty content, when the FootnotePopover
   * is visible, the renderInlineNode function is called once for each node
   * in the content array, with the correct node and index.
   */
  it('renderInlineNode is called for each node in the content array', () => {
    fc.assert(
      fc.property(footnoteRefSpanArb, (footnote) => {
        const renderInlineNode = vi.fn((node: InlineNode, index: number) =>
          React.createElement('span', { key: index, 'data-testid': `node-${index}` }, `node-${index}`)
        );

        render(
          React.createElement(FootnotePopover, {
            footnote,
            visible: true,
            renderInlineNode,
          })
        );

        // renderInlineNode should be called exactly once per content node
        expect(renderInlineNode).toHaveBeenCalledTimes(footnote.content.length);

        // Each node should be passed with the correct index
        footnote.content.forEach((node, index) => {
          expect(renderInlineNode).toHaveBeenCalledWith(node, index);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 5.3**
   *
   * For any FootnoteRefSpan with non-empty content, the rendered output of
   * renderInlineNode appears in the footnote-content container in the DOM.
   */
  it('rendered nodes appear in the footnote-content container', () => {
    fc.assert(
      fc.property(footnoteRefSpanArb, (footnote) => {
        const renderInlineNode = vi.fn((_node: InlineNode, index: number) =>
          React.createElement('span', { key: index, 'data-testid': `rendered-node-${index}` }, `content-${index}`)
        );

        const { container } = render(
          React.createElement(FootnotePopover, {
            footnote,
            visible: true,
            renderInlineNode,
          })
        );

        const contentContainer = container.querySelector('[data-testid="footnote-content"]');
        expect(contentContainer).not.toBeNull();

        // Each rendered node should be present in the DOM
        footnote.content.forEach((_node, index) => {
          const renderedNode = contentContainer!.querySelector(
            `[data-testid="rendered-node-${index}"]`
          );
          expect(renderedNode).not.toBeNull();
          expect(renderedNode!.textContent).toBe(`content-${index}`);
        });
      }),
      { numRuns: 100 }
    );
  });
});
