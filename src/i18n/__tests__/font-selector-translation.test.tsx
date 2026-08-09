/**
 * Tests for font selector name translation integration.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader, DEFAULT_FONT_OPTIONS } from '../../components/Reader';
import type { ReaderSource } from '../../components/Reader';
import { DEFAULT_TRANSLATIONS } from '../defaults';
import { ur, fr } from '../locales';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

async function openSettingsPanel(readingSettingsLabel: string) {
  const settingsButton = await screen.findByRole('button', { name: readingSettingsLabel });
  fireEvent.click(settingsButton);
}

describe('Font selector translation integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders every DEFAULT_FONT_OPTIONS entry using its English display name by default', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });
    await openSettingsPanel(DEFAULT_TRANSLATIONS.readingSettings);

    const select = screen.getByRole('combobox');
    const optionLabels = within(select).getAllByRole('option').map((o) => o.textContent);

    for (const opt of DEFAULT_FONT_OPTIONS) {
      expect(optionLabels).toContain(opt.name);
    }
  });

  it('renders font names using the Urdu fontNames translations when translations={ur}', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} translations={ur} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });
    await openSettingsPanel(ur.readingSettings);

    const select = screen.getByRole('combobox');
    const optionLabels = within(select).getAllByRole('option').map((o) => o.textContent);

    expect(optionLabels).toContain(ur.fontNames['Serif']);
    expect(optionLabels).toContain(ur.fontNames['Amiri']);
    expect(optionLabels).toContain(ur.fontNames['Noto Nastaliq Urdu']);
    // English display names must not leak through when a translation exists
    expect(optionLabels).not.toContain('Serif');
  });

  it('renders font names using the French fontNames translations when translations={fr}', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} translations={fr} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });
    await openSettingsPanel(fr.readingSettings);

    const select = screen.getByRole('combobox');
    const optionLabels = within(select).getAllByRole('option').map((o) => o.textContent);

    expect(optionLabels).toContain(fr.fontNames['Serif']); // 'Empattement'
    // Proper-noun typeface names are intentionally left untranslated
    expect(optionLabels).toContain('Amiri');
  });

  it('falls back to the built-in font name translation when a partial translations override omits fontNames', async () => {
    const source = createMarkdownSource();
    render(<Reader source={source} translations={{ readingSettings: ur.readingSettings }} />);

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });
    await openSettingsPanel(ur.readingSettings);

    const select = screen.getByRole('combobox');
    const optionLabels = within(select).getAllByRole('option').map((o) => o.textContent);

    // No fontNames override was provided, so English defaults are used
    expect(optionLabels).toContain('Serif');
  });

  it('preserves untouched built-in font name translations when only some are overridden', async () => {
    const source = createMarkdownSource();
    render(
      <Reader
        source={source}
        translations={{ fontNames: { Serif: 'Custom Serif Label' } }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('reader-content')).toBeInTheDocument();
    });
    await openSettingsPanel(DEFAULT_TRANSLATIONS.readingSettings);

    const select = screen.getByRole('combobox');
    const optionLabels = within(select).getAllByRole('option').map((o) => o.textContent);

    expect(optionLabels).toContain('Custom Serif Label');
    expect(optionLabels).not.toContain('Serif');
    // Other font names still resolve since fontNames was deep-merged, not replaced
    expect(optionLabels).toContain('Sans');
    expect(optionLabels).toContain('Amiri');
  });
});
