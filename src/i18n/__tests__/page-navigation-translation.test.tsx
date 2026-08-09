/**
 * Unit tests for PageNavigation translation integration.
 *
 * Validates: Requirements 3.7, 3.8
 *
 * Verifies that PageNavigation resolves aria-labels and interpolated page
 * indicator text from TranslationContext rather than hardcoded English strings.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';
import { PageNavigation } from '../../components/PageNavigation';
import { ReaderContext } from '../../components/Reader';
import type { ReaderContextValue } from '../../components/Reader';
import type { ReaderState } from '../../models/reader-state';
import type { Book } from '../../models/book';
import { ChapterNavigator } from '../../services/chapter-navigator';
import { DefaultDirectionDetector } from '../../services/direction-detector';
import { DictionaryService } from '../../services/dictionary-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestBook(): Book {
  return {
    metadata: { title: 'Test Book' },
    chapters: [
      {
        id: 'ch-1',
        title: 'Chapter 1',
        order: 0,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'Hello world' }] },
        ],
      },
    ],
  };
}

function createState(book: Book): ReaderState {
  return {
    book,
    currentChapter: 0,
    currentPage: 2,
    totalPages: 10,
    readingProgress: 20,
    zoom: 100,
    direction: 'ltr',
    directionConfidence: 'high',
    preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
    bookmarks: [],
    error: null,
    loading: false,
  };
}

function renderWithTranslationsAndContext(
  ui: React.ReactElement,
  translations: typeof DEFAULT_TRANSLATIONS,
  stateOverrides: Partial<ReaderState> = {}
) {
  const book = createTestBook();
  const navigator = new ChapterNavigator(book);
  const state = { ...createState(book), ...stateOverrides };

  const contextValue: ReaderContextValue = {
    state,
    themeEngine: null,
    directionDetector: new DefaultDirectionDetector(),
    dictionaryService: new DictionaryService(),
    bookmarkStore: null,
    chapterNavigator: navigator,
    addBookmark: () => {},
    removeBookmark: () => {},
    updateBookmark: () => {},
  };

  return render(
    <MantineProvider env="test">
      <TranslationContext.Provider value={translations}>
        <ReaderContext.Provider value={contextValue}>
          {ui}
        </ReaderContext.Provider>
      </TranslationContext.Provider>
    </MantineProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PageNavigation translation integration', () => {
  const customTranslations = {
    ...DEFAULT_TRANSLATIONS,
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    pageIndicator: 'Página {current} de {total}',
  };

  it('renders the previous page button with the overridden previousPage aria-label', () => {
    renderWithTranslationsAndContext(<PageNavigation />, customTranslations);

    const prevButton = screen.getByTestId('nav-previous');
    expect(prevButton).toHaveAttribute('aria-label', 'Página anterior');
  });

  it('renders the next page button with the overridden nextPage aria-label', () => {
    renderWithTranslationsAndContext(<PageNavigation />, customTranslations);

    const nextButton = screen.getByTestId('nav-next');
    expect(nextButton).toHaveAttribute('aria-label', 'Página siguiente');
  });

  it('renders the page indicator with the interpolated pageIndicator pattern', () => {
    renderWithTranslationsAndContext(<PageNavigation />, customTranslations, {
      currentPage: 2,
      totalPages: 10,
    });

    const indicator = screen.getByTestId('page-indicator');
    // currentPage is 0-indexed in state, displayed as +1 → "3 de 10"
    expect(indicator).toHaveTextContent('Página 3 de 10');
  });
});
