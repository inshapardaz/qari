/**
 * ThemeSelector Component — provides UI controls for theme, font family, and font size.
 * Uses the ThemeEngine from ReaderContext to apply and persist changes.
 */

import React, { useCallback } from 'react';
import { Fieldset, SegmentedControl, ActionIcon, Slider, Text, Group } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations } from '../i18n';
import type { ThemeName, FontFamily } from '../models/reader-state';

const FONTS: { value: FontFamily; label: string }[] = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans-serif', label: 'Sans-Serif' },
  { value: 'monospace', label: 'Monospace' },
  { value: 'nastaliq', label: 'Nastaliq' },
];

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;
const FONT_SIZE_STEP = 2;

export interface ThemeSelectorProps {
  /** Optional callback when any preference changes */
  onChange?: (preferences: { theme: ThemeName; fontFamily: FontFamily; fontSize: number }) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ onChange }) => {
  const { state, themeEngine } = useReaderContext();
  const { preferences } = state;
  const t = useTranslations();

  const THEMES: { value: ThemeName; label: string }[] = [
    { value: 'light', label: t.themeLight },
    { value: 'dark', label: t.themeDark },
    { value: 'calm', label: t.themeCalm },
    { value: 'quiet', label: t.themeQuiet },
    { value: 'paper', label: t.themePaper },
    { value: 'focus', label: t.themeFocus },
    { value: 'high-contrast', label: t.themeHighContrast },
  ];

  const applyAndPersist = useCallback(
    (updatedPrefs: { theme: ThemeName; fontFamily: FontFamily; fontSize: number }) => {
      if (themeEngine) {
        themeEngine.persistPreferences();
      }
      if (onChange) {
        onChange(updatedPrefs);
      }
    },
    [themeEngine, onChange]
  );

  const handleThemeChange = useCallback(
    (theme: ThemeName) => {
      if (themeEngine) {
        themeEngine.setTheme(theme);
        const updated = { ...preferences, theme };
        applyAndPersist(updated);
      }
    },
    [themeEngine, preferences, applyAndPersist]
  );

  const handleFontChange = useCallback(
    (fontFamily: FontFamily) => {
      if (themeEngine) {
        themeEngine.setFont(fontFamily);
        const updated = { ...preferences, fontFamily };
        applyAndPersist(updated);
      }
    },
    [themeEngine, preferences, applyAndPersist]
  );

  const handleFontSizeChange = useCallback(
    (fontSize: number) => {
      if (themeEngine) {
        themeEngine.setFontSize(fontSize);
        const updated = { ...preferences, fontSize };
        applyAndPersist(updated);
      }
    },
    [themeEngine, preferences, applyAndPersist]
  );

  const incrementFontSize = useCallback(() => {
    const newSize = Math.min(MAX_FONT_SIZE, preferences.fontSize + FONT_SIZE_STEP);
    handleFontSizeChange(newSize);
  }, [preferences.fontSize, handleFontSizeChange]);

  const decrementFontSize = useCallback(() => {
    const newSize = Math.max(MIN_FONT_SIZE, preferences.fontSize - FONT_SIZE_STEP);
    handleFontSizeChange(newSize);
  }, [preferences.fontSize, handleFontSizeChange]);

  return (
    <div className="theme-selector" data-testid="theme-selector" role="group" aria-label="Reading preferences">
      {/* Theme Picker */}
      <Fieldset className="theme-selector__themes" legend={t.settingsTheme}>
        <SegmentedControl
          className="theme-selector__theme-options"
          aria-label="Color theme"
          value={preferences.theme}
          onChange={(value) => handleThemeChange(value as ThemeName)}
          data={THEMES.map(({ value, label }) => ({ value, label }))}
          data-testid="theme-options"
        />
      </Fieldset>

      {/* Font Family Picker */}
      <Fieldset className="theme-selector__fonts" legend="Font">
        <SegmentedControl
          className="theme-selector__font-options"
          aria-label="Font family"
          value={preferences.fontFamily}
          onChange={(value) => handleFontChange(value as FontFamily)}
          data={FONTS.map(({ value, label }) => ({ value, label }))}
          data-testid="font-options"
        />
      </Fieldset>

      {/* Font Size Stepper */}
      <Fieldset className="theme-selector__size" legend="Font Size">
        <Group className="theme-selector__size-controls" role="group" aria-label="Font size" wrap="nowrap">
          <ActionIcon
            className="theme-selector__size-btn"
            data-testid="font-size-decrease"
            aria-label="Decrease font size"
            onClick={decrementFontSize}
            disabled={preferences.fontSize <= MIN_FONT_SIZE}
            variant="default"
          >
            −
          </ActionIcon>
          <Slider
            className="theme-selector__size-slider"
            data-testid="font-size-slider"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step={FONT_SIZE_STEP}
            value={preferences.fontSize}
            aria-label="Font size"
            onChange={handleFontSizeChange}
            label={null}
            style={{ flex: 1 }}
          />
          <Text className="theme-selector__size-value" data-testid="font-size-value" aria-live="polite" size="sm">
            {preferences.fontSize}px
          </Text>
          <ActionIcon
            className="theme-selector__size-btn"
            data-testid="font-size-increase"
            aria-label="Increase font size"
            onClick={incrementFontSize}
            disabled={preferences.fontSize >= MAX_FONT_SIZE}
            variant="default"
          >
            +
          </ActionIcon>
        </Group>
      </Fieldset>
    </div>
  );
};

export default ThemeSelector;
