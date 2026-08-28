/**
 * Tests for DictionaryPopover translation integration.
 * Validates that the component renders translated strings from TranslationContext
 * in loading, notFound, and noDictionary states.
 *
 * Validates: Requirements 5.1, 5.3, 5.4, 5.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';
import { DictionaryPopover } from '../../components/DictionaryPopover';
import type { TranslationStrings } from '../types';

/**
 * Helper to render DictionaryPopover within a custom TranslationContext.
 * DictionaryPopover now uses Mantine components, which require a
 * MantineProvider ancestor.
 */
function renderWithTranslations(
  ui: React.ReactElement,
  translations: TranslationStrings
) {
  return render(
    <MantineProvider env="test">
      <TranslationContext.Provider value={translations}>
        {ui}
      </TranslationContext.Provider>
    </MantineProvider>
  );
}

describe('DictionaryPopover - Translation Integration', () => {
  describe('loading state (Requirement 5.1)', () => {
    it('renders translated dictionaryLoading text when loading', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        dictionaryLoading: 'Chargement...',
      };

      renderWithTranslations(
        <DictionaryPopover lookupResult={null} loading={true} />,
        customTranslations
      );

      expect(screen.getByTestId('dictionary-loading')).toHaveTextContent('Chargement...');
    });
  });

  describe('notFound state (Requirement 5.3)', () => {
    it('renders interpolated dictionaryNotFound message with the word', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        dictionaryNotFound: 'Aucune définition trouvée pour « {word} ».',
      };

      renderWithTranslations(
        <DictionaryPopover
          lookupResult={{
            word: 'test',
            language: 'en',
            definitions: [],
            notFound: true,
          }}
        />,
        customTranslations
      );

      expect(screen.getByTestId('dictionary-not-found')).toHaveTextContent(
        'Aucune définition trouvée pour « test ».'
      );
    });
  });

  describe('noDictionary state (Requirement 5.4)', () => {
    it('renders translated dictionaryNoDictionary text', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        dictionaryNoDictionary: 'Aucun dictionnaire disponible pour cette langue.',
      };

      renderWithTranslations(
        <DictionaryPopover
          lookupResult={{
            word: 'test',
            language: 'ar',
            definitions: [{ meaning: 'No dictionary available for ar', partOfSpeech: '' }],
            notFound: true,
            fallbackLanguage: 'English',
          }}
        />,
        customTranslations
      );

      expect(screen.getByTestId('dictionary-no-dict')).toHaveTextContent(
        'Aucun dictionnaire disponible pour cette langue.'
      );
    });
  });

  describe('add-to-note button', () => {
    it('renders translated dictionaryAddToNote text', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        dictionaryAddToNote: 'Ajouter à une note',
      };

      renderWithTranslations(
        <DictionaryPopover
          lookupResult={{
            word: 'test',
            language: 'en',
            definitions: [{ meaning: 'a trial', partOfSpeech: 'noun' }],
          }}
          onAddToNote={() => {}}
        />,
        customTranslations
      );

      expect(screen.getByTestId('dictionary-add-to-note')).toHaveTextContent('Ajouter à une note');
    });
  });

  describe('fallback language button (Requirement 5.5)', () => {
    it('renders interpolated dictionaryTryIn message on the fallback button', () => {
      const customTranslations: TranslationStrings = {
        ...DEFAULT_TRANSLATIONS,
        dictionaryTryIn: 'Essayer en {language}',
      };

      renderWithTranslations(
        <DictionaryPopover
          lookupResult={{
            word: 'test',
            language: 'ar',
            definitions: [{ meaning: 'No dictionary available for ar', partOfSpeech: '' }],
            notFound: true,
            fallbackLanguage: 'English',
          }}
        />,
        customTranslations
      );

      expect(screen.getByTestId('dictionary-fallback-btn')).toHaveTextContent(
        'Essayer en English'
      );
    });
  });
});
