/**
 * Tests for ThemeSelector translation integration.
 * Validates: Requirements 4.2
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
      error: null,
      loading: false,
    },
    themeEngine: createMockThemeEngine() as any,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: null,
    chapterNavigator: null,
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    updateBookmark: vi.fn(),
  };
}

function renderWithTranslations(translations: TranslationStrings) {
  const ctx = createMockContext();
  return render(
    <TranslationContext.Provider value={translations}>
      <ReaderContext.Provider value={ctx}>
        <ThemeSelector />
      </ReaderContext.Provider>
    </TranslationContext.Provider>
  );
}

describe('ThemeSelector translation integration', () => {
  it('renders translated theme button labels from context', () => {
    const frenchTranslations: TranslationStrings = {
      ...DEFAULT_TRANSLATIONS,
      themeLight: 'Clair',
      themeDark: 'Sombre',
      themeSepia: 'Sépia',
      themeHighContrast: 'Contraste',
    };

    renderWithTranslations(frenchTranslations);

    expect(screen.getByTestId('theme-btn-light')).toHaveTextContent('Clair');
    expect(screen.getByTestId('theme-btn-dark')).toHaveTextContent('Sombre');
    expect(screen.getByTestId('theme-btn-sepia')).toHaveTextContent('Sépia');
    expect(screen.getByTestId('theme-btn-high-contrast')).toHaveTextContent('Contraste');
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
