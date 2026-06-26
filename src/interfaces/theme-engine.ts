/**
 * Theme Engine interfaces and types for the Universal Ebook Reader.
 * Defines the contract for managing color themes, fonts, and visual presentation.
 */

export type ThemeName = 'light' | 'dark' | 'sepia' | 'high-contrast';

export type FontFamily = 'serif' | 'sans-serif' | 'monospace' | 'nastaliq';

export interface ReadingPreferences {
  theme: ThemeName;
  fontFamily: FontFamily;
  fontSize: number; // 12-48
}

export interface ThemeColors {
  background: string;
  foreground: string;
  accent: string;
  surface: string;
  border: string;
}

export interface ThemeEngine {
  setTheme(theme: ThemeName): void;
  setFont(family: FontFamily): void;
  setFontSize(size: number): void;
  getPreferences(): ReadingPreferences;
  persistPreferences(): boolean; // returns false if storage unavailable
  loadPersistedPreferences(): ReadingPreferences | null;
}
