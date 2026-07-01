/**
 * Unit tests for Reader translation integration.
 *
 * Validates:
 * - Requirement 1.2: Reader uses DEFAULT_TRANSLATIONS when no translations prop is provided
 * - Requirement 1.3: Reader merges partial translations with defaults
 * - Requirement 2.3: Reader renders all UI strings using DEFAULT_TRANSLATIONS values
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../../components/Reader';
import type { ReaderSource } from '../../components/Reader';
import { DEFAULT_TRANSLATIONS } from '../defaults';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Reader translation integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Default translations (no translations prop)', () => {
    it('renders default loading text when no translations prop is provided', () => {
      // Use an epub source that will stay in loading state momentarily
      const source: ReaderSource = { type: 'epub', data: new ArrayBuffer(10) };
      render(<Reader source={source} />);

      const loadingEl = screen.getByTestId('reader-loading');
      expect(loadingEl).toBeInTheDocument();
      expect(loadingEl).toHaveTextContent(DEFAULT_TRANSLATIONS.loading);
    });

    it('renders default "Reading settings" aria-label after book loads', async () => {
      const source = createMarkdownSource();
      render(<Reader source={source} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeInTheDocument();
      });

      const settingsButton = screen.getByRole('button', { name: DEFAULT_TRANSLATIONS.readingSettings });
      expect(settingsButton).toBeInTheDocument();
    });

    it('renders default "Table of contents" aria-label after book loads', async () => {
      const source = createMarkdownSource();
      render(<Reader source={source} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeInTheDocument();
      });

      const tocButton = screen.getByRole('button', { name: DEFAULT_TRANSLATIONS.tableOfContents });
      expect(tocButton).toBeInTheDocument();
    });

    it('renders default page indicator in footer after book loads', async () => {
      const source = createMarkdownSource();
      render(<Reader source={source} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeInTheDocument();
      });

      // The footer should contain the interpolated page indicator (e.g. "Page 1 of 1")
      expect(screen.getByText(/Page \d+ of \d+/)).toBeInTheDocument();
    });
  });

  describe('Overridden translations (partial translations prop)', () => {
    it('renders overridden "readingSettings" while other strings remain as defaults', async () => {
      const source = createMarkdownSource();
      const customTranslations = { readingSettings: 'Paramètres de lecture' };

      render(<Reader source={source} translations={customTranslations} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeInTheDocument();
      });

      // Overridden string should appear
      const settingsButton = screen.getByRole('button', { name: 'Paramètres de lecture' });
      expect(settingsButton).toBeInTheDocument();

      // Default string for tableOfContents should still be present
      const tocButton = screen.getByRole('button', { name: DEFAULT_TRANSLATIONS.tableOfContents });
      expect(tocButton).toBeInTheDocument();
    });

    it('renders overridden loading text when translations prop includes "loading" key', () => {
      const source: ReaderSource = { type: 'epub', data: new ArrayBuffer(10) };
      const customTranslations = { loading: 'Chargement en cours…' };

      render(<Reader source={source} translations={customTranslations} />);

      const loadingEl = screen.getByTestId('reader-loading');
      expect(loadingEl).toHaveTextContent('Chargement en cours…');
    });

    it('renders overridden "tableOfContents" while readingSettings stays default', async () => {
      const source = createMarkdownSource();
      const customTranslations = { tableOfContents: 'Table des matières' };

      render(<Reader source={source} translations={customTranslations} />);

      await waitFor(() => {
        expect(screen.getByTestId('reader-content')).toBeInTheDocument();
      });

      // Overridden TOC label
      const tocButton = screen.getByRole('button', { name: 'Table des matières' });
      expect(tocButton).toBeInTheDocument();

      // Default settings label remains
      const settingsButton = screen.getByRole('button', { name: DEFAULT_TRANSLATIONS.readingSettings });
      expect(settingsButton).toBeInTheDocument();
    });
  });
});
