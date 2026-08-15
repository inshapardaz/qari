/**
 * A third reading layout — continuous vertical scroll within the current
 * chapter — alongside the existing single/two-column paginated layouts.
 * Enabled via the `scroll` prop, and selectable as the third option in the
 * reader's own Layout title-bar panel.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createTwoChapterSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world\n\n## Chapter 2\n\nMore content',
  };
}

async function openLayoutPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  await screen.findByTestId('layout-panel');
}

describe('Scroll view', () => {
  beforeEach(() => {
    // Markdown sources here have no metadata identifier, so reading-progress
    // tracking (on by default) persists under the same shared bookId ('')
    // across every test in this file — without clearing it, a chapter
    // navigation in one test resumes as the starting position of the next.
    localStorage.clear();
  });


  it('renders the content in a scrollable flow (no CSS columns) when scroll is true', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} scroll />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(container.querySelector('.ebook-reader__scroll')).not.toBeNull();
    expect(container.querySelector('.ebook-reader__columns')).toBeNull();
  });

  it('renders the paginated columns layout by default (scroll false)', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(container.querySelector('.ebook-reader__columns')).not.toBeNull();
    expect(container.querySelector('.ebook-reader__scroll')).toBeNull();
  });

  it('shows a "Next chapter" (not "Next page") hover arrow in scroll mode, which navigates chapters', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} scroll />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);

    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
    const nextChapter = screen.getByRole('button', { name: 'Next chapter' });
    fireEvent.click(nextChapter);

    await waitFor(() => {
      expect(screen.getByText('More content')).toBeInTheDocument();
    });
  });

  it('shows a "Previous chapter" hover arrow in scroll mode once past the first chapter', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} scroll />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);
    fireEvent.click(screen.getByRole('button', { name: 'Next chapter' }));
    await waitFor(() => expect(screen.getByText('More content')).toBeInTheDocument());

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);
    expect(screen.queryByRole('button', { name: 'Previous page' })).toBeNull();
    const prevChapter = screen.getByRole('button', { name: 'Previous chapter' });
    fireEvent.click(prevChapter);

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  it('resets scroll position to the top when the chapter changes in scroll mode', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} scroll />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const scrollEl = container.querySelector('.ebook-reader__scroll') as HTMLElement;
    Object.defineProperty(scrollEl, 'scrollTop', { value: 500, writable: true });
    expect(scrollEl.scrollTop).toBe(500);

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);
    fireEvent.click(screen.getByRole('button', { name: 'Next chapter' }));

    await waitFor(() => expect(scrollEl.scrollTop).toBe(0));
  });

  it('caps the reading column at a max width and centers it in scroll mode', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} scroll />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // The cap is applied to an inner "page box" wrapping the content, not
    // `.ebook-reader__viewport` itself — that outer element stays full-width
    // so the hover/tap zones and edge-navigation arrows (which listen and
    // position on it) still cover the whole viewport, not just the narrow
    // centered column; see `pageBoxRef`/`pageBoxMaxWidth` in Reader.tsx. At
    // the default 32px margin, one MAX_PAGE_WIDTH (520px) column plus
    // margin*2 padding is 584px.
    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    expect(pageBoxEl.style.maxWidth).toBe('584px');
    expect(pageBoxEl.style.margin).toBe('0px auto');
  });

  it('caps the reading column at a max width and centers it in single-column paginated mode', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} columns={1} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    expect(pageBoxEl.style.maxWidth).toBe('584px');
    expect(pageBoxEl.style.margin).toBe('0px auto');
  });

  it('caps each column at a max width in two-column paginated mode, not the whole spread', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} columns={2} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // Two MAX_PAGE_WIDTH (520px) columns, plus margin*2 padding (32*2) and
    // the 64px inter-column gap: 520*2 + 64 + 64 = 1168.
    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    expect(pageBoxEl.style.maxWidth).toBe('1168px');
    expect(pageBoxEl.style.margin).toBe('0px auto');
  });

  it('uses a margin-aware page pitch for the page-turn transform, not the raw container width', async () => {
    // Regression test: the CSS-column pagination trick puts a fixed 64px
    // gap between every column (including across page boundaries), but
    // `margin` is applied as padding on the same element, which only lands
    // once at the very start/end of the whole flow — not once per page.
    // The true per-page pixel distance is `containerWidth - margin*2 + 64`;
    // using the raw container width only happened to work at the 32px
    // default margin (where that correction term is zero), and broke as
    // soon as `margin` was changed.
    const { container } = render(<Reader source={createTwoChapterSource()} margin={80} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const viewportEl = container.querySelector('.ebook-reader__viewport') as HTMLElement;
    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;

    // Column width/page-pitch are derived from the capped inner page box's
    // width, not the (full-width) viewport's — see `pageBoxRef` in Reader.tsx.
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 3000, configurable: true });
    fireEvent(window, new Event('resize'));

    fireEvent.mouseEnter(viewportEl);
    const nextPage = await screen.findByRole('button', { name: 'Next page' });
    fireEvent.click(nextPage);

    await waitFor(() => {
      // pagePitch = containerWidth - margin*2 + 64 = 1000 - 160 + 64 = 904
      expect(columnsEl.style.transform).toBe('translateX(-904px)');
    });
  });

  it('shows the next-page hover arrow in paginated mode for the same content (contrast check)', async () => {
    const { container } = render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.mouseEnter(container.querySelector('.ebook-reader__viewport')!);

    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('layout panel: selecting "Scroll" calls onSettingsChange with scroll: true', async () => {
    const onSettingsChange = vi.fn();
    render(<Reader source={createTwoChapterSource()} onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openLayoutPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Scroll' }));

    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ scroll: true }));
  });

  it('layout panel: selecting "Single column" while in scroll mode calls onSettingsChange with scroll: false, columns: 1', async () => {
    const onSettingsChange = vi.fn();
    render(<Reader source={createTwoChapterSource()} scroll onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openLayoutPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Single column' }));

    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ scroll: false, columns: 1 }));
  });

  it('layout panel: the Scroll layout button is marked pressed when scroll is active', async () => {
    render(<Reader source={createTwoChapterSource()} scroll />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openLayoutPanel();

    expect(screen.getByRole('button', { name: 'Scroll' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Single column' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Two columns' })).toHaveAttribute('aria-pressed', 'false');
  });
});
