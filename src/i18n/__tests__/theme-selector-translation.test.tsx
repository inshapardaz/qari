/**
 * Tests for ThemeSelector translation integration.
 * Validates: Requirements 4.2
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ThemeSelector } from '../../components/ThemeSelector';
import { ReaderContext, ReaderContextValue } from '../../components/Reader';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';
import type { TranslationStrings } from '../index';

function createMockThemeEngine() {
  return {
    setTheme: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    getPreferences: vi.fn().mockReturnValue({ theme: 'light', fontFamily: 'serif', fontSize: 16 }),
    persistPreferences: vi.fn().mockReturnValue(true),
    loadPersistedPreferences: vi.fn().mockReturnValue(null),
  };
}

function createMockContext(): ReaderContextValue {
  return {
    state: {
      book: null,
      currentChapter: 0,
      currentPage: 0,
      totalPages: 0,
      readingProgress: 0,
      zoom: 100,
      direction: 'ltr',
      directionConfidence: 'high',
      preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
      bookmarks: [],
      notes: [],
      error: null,
      loading: false,
    },
    themeEngine: createMockThemeEngine() as any,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: null,
    noteStore: null,
    chapterNavigator: null,
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    addNote: vi.fn(),
    removeNote: vi.fn(),
    updateNote: vi.fn(),
  };
}

function renderWithTranslations(translations: TranslationStrings) {
  const ctx = createMockContext();
  return render(
    <MantineProvider env="test">
      <TranslationContext.Provider value={translations}>
        <ReaderContext.Provider value={ctx}>
          <ThemeSelector />
        </ReaderContext.Provider>
      </TranslationContext.Provider>
    </MantineProvider>
  );
}

describe('ThemeSelector translation integration', () => {
  it('renders translated theme option labels from context', () => {
    const frenchTranslations: TranslationStrings = {
      ...DEFAULT_TRANSLATIONS,
      themeLight: 'Clair',
      themeDark: 'Sombre',
      themeCalm: 'Calme',
      themeQuiet: 'Silencieux',
      themePaper: 'Papier',
      themeFocus: 'Concentration',
      themeHighContrast: 'Contraste',
    };

    renderWithTranslations(frenchTranslations);

    expect(screen.getByRole('radio', { name: 'Clair' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sombre' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Calme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Silencieux' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Papier' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Concentration' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Contraste' })).toBeInTheDocument();
  });

  it('renders translated settingsTheme legend from context', () => {
    const customTranslations: TranslationStrings = {
      ...DEFAULT_TRANSLATIONS,
      settingsTheme: 'Thème',
    };

    renderWithTranslations(customTranslations);

    expect(screen.getByText('Thème')).toBeInTheDocument();
  });
});
