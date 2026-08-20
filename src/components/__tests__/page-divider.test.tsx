/**
 * The book-spine-style divider between the two pages of a two-column spread
 * (see `PAGE_DIVIDER_STYLE`/`showPageDivider` in Reader.tsx) is purely
 * decorative — `pointerEvents: 'none'` — and rendered as a sibling of the
 * transformed content div, not a child of it, so the page-turn animation
 * doesn't drag it along with the page underneath. It's also suppressed on a
 * trailing lone-column page (see `isTrailingLoneColumnPage`,
 * `two-column-trailing-page.test.tsx`) — with only one of the two columns
 * actually populated, that reads as a single page, not a spread, so a seam
 * down the middle next to a blank column would be misleading. These tests
 * only check its presence/absence via the `page-divider` testid and the
 * checkbox that controls it; the actual gradient rendering is a
 * jsdom-unverifiable visual concern (see `text-selection-color.test.tsx` for
 * the same tradeoff with `::selection`).
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
  it('is off by default even in two-column mode', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByTestId('page-divider')).not.toBeInTheDocument();
  });

  it('renders when explicitly enabled in two-column mode', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={false} showPageDivider={true} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.getByTestId('page-divider')).toBeInTheDocument();
  });

  it('does not render in single-column mode even when enabled', async () => {
    render(<Reader source={createMarkdownSource()} columns={1} scroll={false} showPageDivider={true} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByTestId('page-divider')).not.toBeInTheDocument();
  });

  it('does not render in scroll mode even with columns=2 and enabled', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={true} showPageDivider={true} />);
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
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(handleSettingsChange).toHaveBeenCalledWith({ showPageDivider: true });
  });

  it('hides the checkbox itself while single-column is the active layout, even though double-column is still an available option', async () => {
    render(<Reader source={createMarkdownSource()} columns={1} scroll={false} />);
    const panel = await openLayoutPanel();

    expect(panel.querySelector('[data-testid="layout-panel-show-divider"]')).not.toBeInTheDocument();
  });

  it('hides the checkbox in scroll mode', async () => {
    render(<Reader source={createMarkdownSource()} columns={2} scroll={true} />);
    const panel = await openLayoutPanel();

    expect(panel.querySelector('[data-testid="layout-panel-show-divider"]')).not.toBeInTheDocument();
  });

  describe('trailing lone-column page', () => {
    async function renderAndStub(scrollWidth: number) {
      // Same stubbing approach as two-column-trailing-page.test.tsx:
      // containerWidth=1000, margin=40 gives colPitch=492, so scrollWidth=492
      // (one column) leaves the last spread's second column empty, while
      // scrollWidth=984 (two columns) fills both.
      const source = createMarkdownSource();
      const { container, rerender } = render(<Reader source={source} columns={2} showPageDivider={true} />);
      await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

      const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
      const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
      const measurerEl = screen.getByTestId('page-count-measurer');

      Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
      Object.defineProperty(columnsEl, 'scrollWidth', { value: scrollWidth, configurable: true });
      Object.defineProperty(measurerEl, 'scrollWidth', { value: scrollWidth, configurable: true });

      rerender(<Reader source={source} columns={2} margin={40} showPageDivider={true} />);
      await waitFor(() => expect(pageBoxEl).toBeInTheDocument());
      return container;
    }

    it('hides the divider when only one column of the spread is populated', async () => {
      const container = await renderAndStub(492);
      await waitFor(() => expect(container.querySelector('.ebook-reader__columns') as HTMLElement).toHaveStyle({ transform: 'translateX(246px)' }));

      expect(container.querySelector('[data-testid="page-divider"]')).not.toBeInTheDocument();
    });

    it('shows the divider when both columns of the spread are populated (contrast check)', async () => {
      const container = await renderAndStub(984);
      await waitFor(() => expect(container.querySelector('.ebook-reader__columns') as HTMLElement).toHaveStyle({ transform: 'translateX(0px)' }));

      expect(container.querySelector('[data-testid="page-divider"]')).toBeInTheDocument();
    });
  });
});
