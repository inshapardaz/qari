/**
 * The book-spine-style divider between the two pages of a two-column spread
 * (see `PAGE_DIVIDER_STYLE`/`showPageDivider` in Reader.tsx) is purely
 * decorative — `pointerEvents: 'none'` — and rendered as a sibling of the
 * transformed content div, not a child of it, so the page-turn animation
 * doesn't drag it along with the page underneath. These tests only check
 * its presence/absence via the `page-divider` testid and the checkbox that
 * controls it; the actual gradient rendering is a jsdom-unverifiable visual
 * concern (see `text-selection-color.test.tsx` for the same tradeoff with
 * `::selection`).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
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

describe('Page divider (two-column split view)', () => {
  it('renders the divider in two-column mode by default', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.getByTestId('page-divider')).toBeInTheDocument();
  });

  it('does not render the divider in single-column mode', async () => {
    render(<Reader source={createMarkdownSource()} columns={1} scroll={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByTestId('page-divider')).not.toBeInTheDocument();
  });

  it('does not render the divider in scroll mode even with columns=2', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={true} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByTestId('page-divider')).not.toBeInTheDocument();
  });

  it('honors showPageDivider={false}', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={false} showPageDivider={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByTestId('page-divider')).not.toBeInTheDocument();
  });

  it('exposes a checkbox in the layout panel that toggles the divider via onSettingsChange', async () => {
    const handleSettingsChange = vi.fn();
    render(<Reader source={createMarkdownSource()} columns={2} scroll={false} onSettingsChange={handleSettingsChange} />);
    const panel = await openLayoutPanel();

    const toggleEl = panel.querySelector('[data-testid="layout-panel-show-divider"]') as HTMLElement;
    const toggle = (toggleEl.tagName === 'INPUT' ? toggleEl : toggleEl.querySelector('input')) as HTMLInputElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);
    expect(handleSettingsChange).toHaveBeenCalledWith({ showPageDivider: false });
  });
});
