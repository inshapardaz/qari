/**
 * Tests for ChapterIndex translation integration.
 * Validates that the component renders translated heading and interpolated
 * goToChapter aria-labels from TranslationContext.
 *
 * Validates: Requirements 7.1, 7.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';
import { ChapterIndex } from '../../components/ChapterIndex';
import { ReaderContext, ReaderContextValue } from '../../components/Reader';
import { ChapterNavigator } from '../../services/chapter-navigator';
import { DefaultDirectionDetector } from '../../services/direction-detector';
import { DictionaryService } from '../../services/dictionary-service';
import type { TranslationStrings } from '../types';
import type { Book } from '../../models/book';
import type { ReaderState } from '../../models/reader-state';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMultiChapterBook(): Book {
  return {
    metadata: { title: 'Test Book' },
    chapters: [
      {
        id: 'ch-1',
        title: 'Introduction',
        order: 0,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'Hello' }] },
        ],
      },
      {
        id: 'ch-2',
        title: 'Getting Started',
        order: 1,
        content: [
          { type: 'paragraph', children: [{ type: 'text', content: 'World' }] },
        ],
      },
    ],
  };
}

function createState(book: Book): ReaderState {
  return {
    book,
    currentChapter: 0,
    currentPage: 0,
    totalPages: 1,
    readingProgress: 0,
    zoom: 100,
    direction: 'ltr',
    directionConfidence: 'high',
    preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
    bookmarks: [],
    error: null,
    loading: false,
  };
}

function renderChapterIndexWithTranslations(translations: TranslationStrings) {
  const book = createMultiChapterBook();
  const navigator = new ChapterNavigator(book);
  const state = createState(book);

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
          <ChapterIndex />
        </ReaderContext.Provider>
      </TranslationContext.Provider>
    </MantineProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChapterIndex - Translation Integration', () => {
  describe('chaptersTitle heading (Requirement 7.1)', () => {
    it('renders the overridden chaptersTitle from TranslationContext', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        chaptersTitle: 'Chapitres',
      };

      renderChapterIndexWithTranslations(customTranslations);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Chapitres');
    });
  });

  describe('goToChapter aria-labels (Requirement 7.3)', () => {
    it('renders interpolated goToChapter pattern with chapter titles', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        goToChapter: 'Aller au chapitre : {title}',
      };

      renderChapterIndexWithTranslations(customTranslations);

      const firstButton = screen.getByTestId('chapter-item-0');
      expect(firstButton).toHaveAttribute(
        'aria-label',
        'Aller au chapitre : Introduction'
      );

      const secondButton = screen.getByTestId('chapter-item-1');
      expect(secondButton).toHaveAttribute(
        'aria-label',
        'Aller au chapitre : Getting Started'
      );
    });
  });
});
