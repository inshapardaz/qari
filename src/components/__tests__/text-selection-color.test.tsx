/**
 * The browser's own native text-selection highlight (selecting book
 * content, a button label, anything) is entirely separate from every
 * `--mantine-*`/`--reader-*` custom-property override elsewhere in
 * Reader.tsx — none of those touch `::selection`, a pseudo-element that
 * can only be targeted by a real stylesheet rule, not an inline style. Was
 * left as the browser's default blue regardless of reading theme; now an
 * injected `<style>` tag scopes `.ebook-reader ::selection` to the active
 * theme's own accent/bg pair (same pairing already used, and proven
 * legible across all seven built-in themes, by the active-chapter
 * highlight elsewhere in this file).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

describe('Native text-selection color follows the reading theme', () => {
  it('injects a ::selection rule using --reader-accent/--reader-bg, not the browser default', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const styleTags = Array.from(document.querySelectorAll('style'));
    const selectionRule = styleTags.find((tag) => tag.textContent?.includes('::selection'));

    expect(selectionRule).toBeDefined();
    expect(selectionRule!.textContent).toContain('.ebook-reader ::selection');
    expect(selectionRule!.textContent).toContain('background-color: var(--reader-accent, #0071e3)');
    expect(selectionRule!.textContent).toContain('color: var(--reader-bg, #ffffff)');
  });

  it('renders the same rule regardless of which reading theme is active — the color swap happens via --reader-accent, not a different rule per theme', async () => {
    render(<Reader source={createMarkdownSource()} theme="quiet" />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const styleTags = Array.from(document.querySelectorAll('style'));
    const selectionRule = styleTags.find((tag) => tag.textContent?.includes('::selection'));

    expect(selectionRule!.textContent).toContain('background-color: var(--reader-accent, #0071e3)');
  });
});
