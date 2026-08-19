/**
 * The layout panel's single/double/scroll option buttons are native
 * <button> elements. Browsers apply their own UA text color to <button>
 * rather than inheriting the ancestor's `color`, so without an explicit
 * `color` style the icons (which draw via `currentColor`) ignored the
 * active reading theme entirely (issue #9).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

async function openLayoutPanel() {
  await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  return screen.findByTestId('layout-panel');
}

describe('Layout panel theming', () => {
  it('gives every option button an explicit color following the reading theme', async () => {
    render(<Reader source={createMarkdownSource()} theme="sepia" />);
    const panel = await openLayoutPanel();

    const buttons = panel.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => {
      expect((button as HTMLButtonElement).style.color).not.toBe('');
    });
  });

  it('colors the active option with the reader accent, inactive ones with reader foreground', async () => {
    render(<Reader source={createMarkdownSource()} theme="dark" scroll={false} columns={1} />);
    const panel = await openLayoutPanel();

    const active = panel.querySelector('button[aria-pressed="true"]') as HTMLButtonElement;
    const inactive = panel.querySelector('button[aria-pressed="false"]') as HTMLButtonElement;

    expect(active.style.color).toBe('var(--reader-accent, #0071e3)');
    expect(inactive.style.color).toBe('var(--reader-fg, #1a1a1a)');
  });
});
