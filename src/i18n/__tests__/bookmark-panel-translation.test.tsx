/**
 * Tests for BookmarkPanel translation integration.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookmarkPanel } from '../../components/BookmarkPanel';
import { ReaderContext, ReaderContextValue } from '../../components/Reader';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';

const customTranslations = {
  ...DEFAULT_TRANSLATIONS,
  bookmarksPanelTitle: 'Marcadores',
  bookmarkNamePlaceholder: 'Nombre del marcador',
  bookmarkAdd: 'Agregar Marcador',
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
      error: null,
      loading: false,
    },
    themeEngine: null,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: {
      create: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
      load: vi.fn(),
      list: vi.fn(),
      getNotifications: vi.fn().mockReturnValue([]),
    } as any,
    chapterNavigator: null,
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement, context?: ReaderContextValue) {
  const ctx = context || createMockContext();
  return render(
    <TranslationContext.Provider value={customTranslations}>
      <ReaderContext.Provider value={ctx}>
        {ui}
      </ReaderContext.Provider>
    </TranslationContext.Provider>
  );
}

describe('BookmarkPanel translation integration', () => {
  it('renders translated heading from bookmarksPanelTitle', () => {
    renderWithProviders(<BookmarkPanel />);
    expect(screen.getByText('Marcadores')).toBeInTheDocument();
  });

  it('renders translated placeholder from bookmarkNamePlaceholder', () => {
    renderWithProviders(<BookmarkPanel />);
    expect(screen.getByPlaceholderText('Nombre del marcador')).toBeInTheDocument();
  });

  it('renders translated button label from bookmarkAdd', () => {
    renderWithProviders(<BookmarkPanel />);
    expect(screen.getByText('Agregar Marcador')).toBeInTheDocument();
  });

  it('renders translated empty state from bookmarksEmpty', () => {
    renderWithProviders(<BookmarkPanel />);
    expect(screen.getByText('No hay marcadores aún.')).toBeInTheDocument();
  });
});
