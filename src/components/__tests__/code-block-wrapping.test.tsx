/**
 * Regression test for issue #7: some EPUB sources (e.g. Project Gutenberg's
 * Moby Dick) use bare <pre> for verse/poetry formatting, which the parser
 * maps to a `code-block` content node — the same node type real fenced code
 * uses. Left at the browser's default `white-space: pre`, a long unbroken
 * line in one of these blocks overflows the CSS column's width instead of
 * wrapping, which both clips the text and (since it's the same element the
 * pagination measurer sizes off) throws off page-count measurement, causing
 * later content to appear shifted onto the wrong page.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSourceWithLongCodeBlockLine(): ReaderSource {
  return {
    type: 'markdown',
    content:
      '# Test Book\n\n## Chapter 1\n\n' +
      '```\n' +
      'This is a single unbroken line of verse that is deliberately much longer than any reasonable column width so it would overflow if left unwrapped\n' +
      '```\n',
  };
}

describe('Code block text wrapping', () => {
  it('wraps long lines inside a code block instead of overflowing the column', async () => {
    const { container } = render(<Reader source={createSourceWithLongCodeBlockLine()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pre = container.querySelector('pre') as HTMLElement;
    expect(pre).not.toBeNull();
    expect(pre.style.whiteSpace).toBe('pre-wrap');
    expect(pre.style.overflowWrap).toBe('anywhere');
    expect(pre.style.maxWidth).toBe('100%');
  });
});
