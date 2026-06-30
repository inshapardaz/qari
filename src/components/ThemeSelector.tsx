/**
 * ThemeSelector Component — provides UI controls for theme, font family, and font size.
 * Uses the ThemeEngine from ReaderContext to apply and persist changes.
 */

import React, { useCallback } from 'react';
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
    { value: 'sepia', label: t.themeSepia },
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
      <fieldset className="theme-selector__themes">
        <legend>{t.settingsTheme}</legend>
        <div className="theme-selector__theme-options" role="radiogroup" aria-label="Color theme">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`theme-selector__theme-btn${preferences.theme === value ? ' theme-selector__theme-btn--active' : ''}`}
              data-testid={`theme-btn-${value}`}
              aria-pressed={preferences.theme === value}
              onClick={() => handleThemeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Font Family Picker */}
      <fieldset className="theme-selector__fonts">
        <legend>Font</legend>
        <div className="theme-selector__font-options" role="radiogroup" aria-label="Font family">
          {FONTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`theme-selector__font-btn${preferences.fontFamily === value ? ' theme-selector__font-btn--active' : ''}`}
              data-testid={`font-btn-${value}`}
              aria-pressed={preferences.fontFamily === value}
              onClick={() => handleFontChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Font Size Stepper */}
      <fieldset className="theme-selector__size">
        <legend>Font Size</legend>
        <div className="theme-selector__size-controls" role="group" aria-label="Font size">
          <button
            type="button"
            className="theme-selector__size-btn"
            data-testid="font-size-decrease"
            aria-label="Decrease font size"
            onClick={decrementFontSize}
            disabled={preferences.fontSize <= MIN_FONT_SIZE}
          >
            −
          </button>
          <input
            type="range"
            className="theme-selector__size-slider"
            data-testid="font-size-slider"
            min={MIN_FONT_SIZE}
            max={MAX_FONT_SIZE}
            step={FONT_SIZE_STEP}
            value={preferences.fontSize}
            aria-label="Font size"
            aria-valuemin={MIN_FONT_SIZE}
            aria-valuemax={MAX_FONT_SIZE}
            aria-valuenow={preferences.fontSize}
            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
          />
          <span className="theme-selector__size-value" data-testid="font-size-value" aria-live="polite">
            {preferences.fontSize}px
          </span>
          <button
            type="button"
            className="theme-selector__size-btn"
            data-testid="font-size-increase"
            aria-label="Increase font size"
            onClick={incrementFontSize}
            disabled={preferences.fontSize >= MAX_FONT_SIZE}
          >
            +
          </button>
        </div>
      </fieldset>
    </div>
  );
};

export default ThemeSelector;
