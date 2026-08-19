/**
 * Regression coverage for issue #10 (PDF chapter/page mapper). PDFs have one
 * underlying `book.chapters` entry per page, and a caller-supplied
 * `pdfChapters` map can title a long run of pages with the same chapter
 * title — without deduplication, the chapter drawer would show that title
 * repeated once per page. Reader.tsx now collapses each run of consecutive
 * same-titled chapters into a single navigable entry (`chapterMenuEntries`)
 * that jumps to the run's first chapter. This is exercised here with
 * markdown (duplicate `##` headings produce the same same-title-run shape)
 * rather than a mocked PDF, since the collapsing logic itself is
 * PDF-agnostic — it only looks at consecutive chapter titles.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: [
      '# Test Book',
      '## Chapter One',
      'Page 1 of chapter one.',
      '## Chapter One',
      'Page 2 of chapter one.',
      '## Chapter One',
      'Page 3 of chapter one.',
      '## Chapter Two',
      'Only page of chapter two.',
    ].join('\n\n'),
  };
}

async function openChapterMenu() {
  await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  return screen.findByTestId('chapter-menu-panel');
}

describe('Chapter drawer deduplication', () => {
  it('collapses a run of consecutive same-titled chapters into one entry', async () => {
    render(<Reader source={createSource()} />);
    const panel = await openChapterMenu();

    // `panel` is the whole drawer, whose Tabs.List also renders icon-only
    // tab buttons (chapters/bookmarks/notes) with no text content — filter
    // those out rather than trying to scope the query to just the chapters
    // Tabs.Panel, since Mantine doesn't expose a stable selector for it.
    const labels = Array.from(panel.querySelectorAll('button'))
      .map(b => b.textContent)
      .filter((text): text is string => !!text);

    expect(labels).toEqual(['Chapter One', 'Chapter Two']);
  });

  it('jumps to the run\'s first underlying chapter and clears the page', async () => {
    render(<Reader source={createSource()} />);
    await openChapterMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Chapter Two' }));

    await waitFor(() => expect(screen.queryByTestId('chapter-menu-panel')).not.toBeInTheDocument());
    expect(document.body.textContent).toContain('Only page of chapter two');
  });
});
