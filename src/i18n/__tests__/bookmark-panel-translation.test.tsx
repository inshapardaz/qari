/**
 * Tests for BookmarkPanel translation integration.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { BookmarkPanel } from '../../components/BookmarkPanel';
import { ReaderContext, ReaderContextValue } from '../../components/Reader';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';

const customTranslations = {
  ...DEFAULT_TRANSLATIONS,
  bookmarksPanelTitle: 'Marcadores',
  bookmarksEmpty: 'No hay marcadores aún.',
};

function createMockContext(overrides: Partial<ReaderContextValue> = {}): ReaderContextValue {
  return {
    state: {
      book: {
        metadata: { title: 'Test Book', identifier: 'book-123' },
        chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, content: [] }],
      } as any,
      currentChapter: 0,
      currentPage: 0,
      totalPages: 5,
      readingProgress: 20,
      zoom: 100,
      direction: 'ltr',
      directionConfidence: 'high',
      preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
      bookmarks: [],
      notes: [],
      error: null,
      loading: false,
    },
    themeEngine: null,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: {
      create: vi.fn(),
      delete: vi.fn(),
      load: vi.fn(),
      list: vi.fn(),
      getNotifications: vi.fn().mockReturnValue([]),
    } as any,
    noteStore: null,
    chapterNavigator: null,
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    addNote: vi.fn(),
    removeNote: vi.fn(),
    updateNote: vi.fn(),
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement, context?: ReaderContextValue) {
  const ctx = context || createMockContext();
  return render(
    <MantineProvider env="test">
      <TranslationContext.Provider value={customTranslations}>
        <ReaderContext.Provider value={ctx}>
          {ui}
        </ReaderContext.Provider>
      </TranslationContext.Provider>
    </MantineProvider>
  );
}

describe('BookmarkPanel translation integration', () => {
  it('renders translated heading from bookmarksPanelTitle', () => {
    renderWithProviders(<BookmarkPanel />);
    expect(screen.getByText('Marcadores')).toBeInTheDocument();
  });

  it('renders translated empty state from bookmarksEmpty', () => {
    renderWithProviders(<BookmarkPanel />);
    expect(screen.getByText('No hay marcadores aún.')).toBeInTheDocument();
  });
});
