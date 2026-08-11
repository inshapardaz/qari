/**
 * Integration tests for reading-progress tracking: the reader silently
 * persists the current chapter/position as the user navigates, and resumes
 * there the next time the same book is opened. Mirrors the bookmark/note
 * adapter-delegation test style.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';
import type { CustomProgressStoreAdapter } from '../../interfaces/progress-store';
import type { ReadingProgressRecord } from '../../models/progress';

function createTwoChapterSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter One\n\nContent of chapter one.\n\n## Chapter Two\n\nContent of chapter two.',
  };
}

/** An in-memory adapter that actually round-trips, for resume-across-remount tests. */
function createStatefulAdapter(): CustomProgressStoreAdapter {
  const records = new Map<string, ReadingProgressRecord>();
  return {
    save: vi.fn(async (progress: ReadingProgressRecord) => {
      records.set(progress.bookId, progress);
    }),
    load: vi.fn(async (bookId: string) => records.get(bookId) ?? null),
    remove: vi.fn(async (bookId: string) => {
      records.delete(bookId);
    }),
  };
}

async function navigateToChapterTwo() {
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  await screen.findByTestId('chapter-menu-panel');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Chapter Two' }));
}

describe('Reading progress tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves the reading position through a custom progressAdapter as the user navigates', async () => {
    const adapter = createStatefulAdapter();
    render(<Reader source={createTwoChapterSource()} progressAdapter={adapter} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await navigateToChapterTwo();
    await screen.findByText('Chapter Two');

    await waitFor(() => {
      expect(adapter.save).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: '', position: 0, percentage: expect.any(Number) })
      );
    });
  });

  it('resumes at the saved chapter the next time the same book is opened, via a custom adapter', async () => {
    const adapter = createStatefulAdapter();
    const source = createTwoChapterSource();

    const { unmount } = render(<Reader source={source} progressAdapter={adapter} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await navigateToChapterTwo();
    await screen.findByText('Chapter Two');
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());

    unmount();

    render(<Reader source={source} progressAdapter={adapter} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await screen.findByText('Chapter Two');
    expect(screen.queryByText('Chapter One')).not.toBeInTheDocument();
  });

  it('defaults to localStorage when no progressAdapter is provided', async () => {
    const source = createTwoChapterSource();

    const { unmount } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await navigateToChapterTwo();
    await screen.findByText('Chapter Two');
    await waitFor(() => {
      expect(localStorage.getItem('qari-progress-')).toBeTruthy();
    });

    unmount();

    render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await screen.findByText('Chapter Two');
  });

  it('does not save or resume progress when enableProgressTracking is false', async () => {
    const adapter = createStatefulAdapter();
    const source = createTwoChapterSource();

    const { unmount } = render(<Reader source={source} progressAdapter={adapter} enableProgressTracking={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await navigateToChapterTwo();
    await screen.findByText('Chapter Two');

    expect(adapter.save).not.toHaveBeenCalled();

    unmount();

    render(<Reader source={source} progressAdapter={adapter} enableProgressTracking={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await screen.findByText('Chapter One');
    expect(adapter.load).not.toHaveBeenCalled();
  });

  it('fires onProgressSave with the persisted record', async () => {
    const adapter = createStatefulAdapter();
    const onProgressSave = vi.fn();
    render(<Reader source={createTwoChapterSource()} progressAdapter={adapter} onProgressSave={onProgressSave} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await navigateToChapterTwo();
    await screen.findByText('Chapter Two');

    await waitFor(() => {
      expect(onProgressSave).toHaveBeenCalledWith({
        type: 'saved',
        progress: expect.objectContaining({ bookId: '', position: 0 }),
      });
    });
  });

  it('falls back to the start of the book when the saved chapterId no longer matches any chapter', async () => {
    const adapter = createStatefulAdapter();
    // Pre-seed a record pointing at a chapter that doesn't exist in this book.
    await adapter.save({ bookId: '', chapterId: 'no-such-chapter', position: 0, percentage: 50, updatedAt: new Date().toISOString() });

    render(<Reader source={createTwoChapterSource()} progressAdapter={adapter} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
    await screen.findByText('Chapter One');
  });
});
