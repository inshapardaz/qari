/**
 * Tests for font selector name translation integration.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader, DEFAULT_FONT_OPTIONS } from '../../components/Reader';
import type { ReaderSource } from '../../components/Reader';
import { DEFAULT_TRANSLATIONS } from '../defaults';
import { ur, fr } from '../locales';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

/**
 * Mantine's Select associates its `label` prop with both the `<input>` and
 * the (initially hidden) options listbox via `aria-labelledby`, so
 * `getByLabelText` matches more than one element — filter down to the input.
 */
function getFontSelectInput(fontFamilyLabel: string): HTMLElement {
  const matches = screen.getAllByLabelText(fontFamilyLabel);
  const input = matches.find((el) => el.tagName === 'INPUT');
  if (!input) throw new Error(`Could not find the font family <input> labeled "${fontFamilyLabel}"`);
  return input;
}

async function openSettingsPanel(readingSettingsLabel: string, fontFamilyLabel: string) {
  const settingsButton = await screen.findByRole('button', { name: readingSettingsLabel });
  fireEvent.click(settingsButton);
  // Mantine's Modal renders via a portal — wait for its content to land in the DOM.
  await waitFor(() => getFontSelectInput(fontFamilyLabel));
}

/**
 * Opens Mantine's Select dropdown and returns the labels of its options.
 * The options are only mounted once the combobox is opened, and Mantine
 * renders them via a portal, so they must be queried from `screen`, not
 * scoped `within` the select input.
 */
async function getFontOptionLabels(fontFamilyLabel: string): Promise<(string | null)[]> {
  const input = getFontSelectInput(fontFamilyLabel);
  fireEvent.click(input);
  const options = await screen.findAllByRole('option');
  return options.map((o) => o.textContent);
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
    await openSettingsPanel(DEFAULT_TRANSLATIONS.readingSettings, DEFAULT_TRANSLATIONS.settingsFontFamily);

    const optionLabels = await getFontOptionLabels(DEFAULT_TRANSLATIONS.settingsFontFamily);

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
    await openSettingsPanel(ur.readingSettings, ur.settingsFontFamily);

    const optionLabels = await getFontOptionLabels(ur.settingsFontFamily);

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
    await openSettingsPanel(fr.readingSettings, fr.settingsFontFamily);

    const optionLabels = await getFontOptionLabels(fr.settingsFontFamily);

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
    await openSettingsPanel(ur.readingSettings, DEFAULT_TRANSLATIONS.settingsFontFamily);

    const optionLabels = await getFontOptionLabels(DEFAULT_TRANSLATIONS.settingsFontFamily);

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
    await openSettingsPanel(DEFAULT_TRANSLATIONS.readingSettings, DEFAULT_TRANSLATIONS.settingsFontFamily);

    const optionLabels = await getFontOptionLabels(DEFAULT_TRANSLATIONS.settingsFontFamily);

    expect(optionLabels).toContain('Custom Serif Label');
    expect(optionLabels).not.toContain('Serif');
    // Other font names still resolve since fontNames was deep-merged, not replaced
    expect(optionLabels).toContain('Sans');
    expect(optionLabels).toContain('Amiri');
  });
});
