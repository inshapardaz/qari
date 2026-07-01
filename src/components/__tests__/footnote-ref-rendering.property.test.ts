/**
 * Property 5: Footnote reference renders as superscript with correct label
 *
 * Validates: Requirements 4.1, 4.4
 *
 * For any FootnoteRefSpan node with a given label string, the InlineNodeRenderer
 * SHALL produce a `<sup>` element whose text content equals the label value.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

/**
 * Generator for a positive integer (footnote number) between 1 and 99.
 * Markdown footnotes get auto-incremented numeric labels, so we generate
 * markdown with K footnotes and verify each has a matching <sup> element.
 */
const footnoteCountArb = fc.integer({ min: 1, max: 5 });

/**
 * Generator for simple footnote definition text (alphanumeric, no special chars).
 */
const definitionTextArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
  { minLength: 3, maxLength: 30 }
);

/**
 * Builds a markdown string with K footnote references and definitions.
 * Each reference gets an auto-incremented label "1", "2", ..., "K".
 */
function buildMarkdownWithFootnotes(count: number, definitions: string[]): string {
  const refs = Array.from({ length: count }, (_, i) => `ref[^fn${i + 1}]`).join(' ');
  const defs = Array.from({ length: count }, (_, i) => `[^fn${i + 1}]: ${definitions[i] || 'definition'}`).join('\n');
  return `# Test\n\n${refs}\n\n${defs}`;
}

describe('Property 5: Footnote reference renders as superscript with correct label', () => {
  /**
   * **Validates: Requirements 4.1, 4.4**
   *
   * For any number of footnote references in a markdown document,
   * the Reader renders each as a <sup> element with text content
   * equal to the sequential label ("1", "2", ...).
   */
  it('each footnote reference renders as a <sup> element with correct sequential label', async () => {
    await fc.assert(
      fc.asyncProperty(
        footnoteCountArb,
        fc.array(definitionTextArb, { minLength: 5, maxLength: 5 }),
        async (count, definitions) => {
          cleanup();

          const markdown = buildMarkdownWithFootnotes(count, definitions);
          const source: ReaderSource = { type: 'markdown', content: markdown };

          const { container, unmount } = render(
            React.createElement(Reader, { source })
          );

          // Wait for the reader to finish loading and rendering
          await waitFor(() => {
            expect(container.querySelector('[data-testid="reader-content"]')).not.toBeNull();
          });

          // Find all footnote-ref <sup> elements
          const supElements = container.querySelectorAll('[data-testid="footnote-ref"]');

          // There should be exactly `count` footnote references
          expect(supElements.length).toBe(count);

          // Each <sup> element should have text content equal to its sequential label
          supElements.forEach((sup, index) => {
            const expectedLabel = String(index + 1);
            expect(sup.tagName.toLowerCase()).toBe('sup');
            expect(sup.textContent).toBe(expectedLabel);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1, 4.4**
   *
   * For any single footnote reference, the rendered <sup> element
   * has role="button" and contains the correct label text.
   */
  it('footnote reference <sup> has role="button" attribute', async () => {
    await fc.assert(
      fc.asyncProperty(
        definitionTextArb,
        async (definition) => {
          cleanup();

          const markdown = `# Test\n\nSome text[^note1] here.\n\n[^note1]: ${definition}`;
          const source: ReaderSource = { type: 'markdown', content: markdown };

          const { container, unmount } = render(
            React.createElement(Reader, { source })
          );

          await waitFor(() => {
            expect(container.querySelector('[data-testid="reader-content"]')).not.toBeNull();
          });

          const sup = container.querySelector('[data-testid="footnote-ref"]');
          expect(sup).not.toBeNull();
          expect(sup!.tagName.toLowerCase()).toBe('sup');
          expect(sup!.getAttribute('role')).toBe('button');
          expect(sup!.textContent).toBe('1');

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
