/**
 * Theme Engine implementation for the Universal Ebook Reader.
 * Manages color themes, font families, font sizes, and persists preferences to localStorage.
 */

import type {
  ThemeEngine as IThemeEngine,
  ThemeName,
  FontFamily,
  ReadingPreferences,
  ThemeColors,
} from '../interfaces/theme-engine';

const STORAGE_KEY = 'ebook-reader-preferences';

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;
const FONT_SIZE_STEP = 2;

/**
 * Four built-in themes.
 * high-contrast meets WCAG AAA ≥ 7:1 contrast ratio (black bg + white text = 21:1).
 */
export const THEMES: Record<ThemeName, ThemeColors> = {
  light: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    accent: '#0066cc',
    surface: '#f5f5f5',
    border: '#e0e0e0',
  },
  dark: {
    background: '#1a1a2e',
    foreground: '#e8e8e8',
    accent: '#4da6ff',
    surface: '#252540',
    border: '#3a3a5c',
  },
  sepia: {
    background: '#f4ecd8',
    foreground: '#3b2e1a',
    accent: '#8b5e3c',
    surface: '#ede3cc',
    border: '#d4c5a9',
  },
  'high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    accent: '#ffff00',
    surface: '#1a1a1a',
    border: '#ffffff',
  },
};

const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  'sans-serif': '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  monospace: '"Fira Code", "Courier New", Consolas, monospace',
  nastaliq: '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", serif',
};

/**
 * Clamp a font size to the valid range [12, 48] and round to the nearest 2px increment.
 */
export function clampFontSize(size: number): number {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  return Math.round(clamped / FONT_SIZE_STEP) * FONT_SIZE_STEP;
}

export class ThemeEngine implements IThemeEngine {
  private preferences: ReadingPreferences;
  private rootElement: HTMLElement;

  constructor(rootElement?: HTMLElement) {
    this.rootElement = rootElement ?? document.documentElement;
    this.preferences = {
      theme: 'light',
      fontFamily: 'serif',
      fontSize: 16,
    };

    // Try to load persisted preferences on initialization
    const persisted = this.loadPersistedPreferences();
    if (persisted) {
      this.preferences = persisted;
    }

    this.applyAllProperties();
  }

  setTheme(theme: ThemeName): void {
    this.preferences.theme = theme;
    this.applyThemeColors(theme);
  }

  setFont(family: FontFamily): void {
    this.preferences.fontFamily = family;
    this.applyFontFamily(family);
  }

  setFontSize(size: number): void {
    this.preferences.fontSize = clampFontSize(size);
    this.applyFontSize(this.preferences.fontSize);
  }

  getPreferences(): ReadingPreferences {
    return { ...this.preferences };
  }

  persistPreferences(): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
      return true;
    } catch {
      return false;
    }
  }

  loadPersistedPreferences(): ReadingPreferences | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!isValidPreferences(parsed)) {
        return null;
      }
      return {
        theme: parsed.theme,
        fontFamily: parsed.fontFamily,
        fontSize: clampFontSize(parsed.fontSize),
      };
    } catch {
      return null;
    }
  }

  // --- Private helpers ---

  private applyAllProperties(): void {
    this.applyThemeColors(this.preferences.theme);
    this.applyFontFamily(this.preferences.fontFamily);
    this.applyFontSize(this.preferences.fontSize);
  }

  private applyThemeColors(theme: ThemeName): void {
    const colors = THEMES[theme];
    this.rootElement.style.setProperty('--reader-bg', colors.background);
    this.rootElement.style.setProperty('--reader-fg', colors.foreground);
    this.rootElement.style.setProperty('--reader-accent', colors.accent);
    this.rootElement.style.setProperty('--reader-surface', colors.surface);
    this.rootElement.style.setProperty('--reader-border', colors.border);
  }

  private applyFontFamily(family: FontFamily): void {
    this.rootElement.style.setProperty('--reader-font-family', FONT_FAMILY_MAP[family]);
  }

  private applyFontSize(size: number): void {
    this.rootElement.style.setProperty('--reader-font-size', `${size}px`);
  }
}

// --- Validation helpers ---

const VALID_THEMES: ThemeName[] = ['light', 'dark', 'sepia', 'high-contrast'];
const VALID_FONTS: FontFamily[] = ['serif', 'sans-serif', 'monospace', 'nastaliq'];

function isValidPreferences(value: unknown): value is ReadingPreferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    VALID_THEMES.includes(obj.theme as ThemeName) &&
    VALID_FONTS.includes(obj.fontFamily as FontFamily) &&
    typeof obj.fontSize === 'number' &&
    obj.fontSize >= MIN_FONT_SIZE &&
    obj.fontSize <= MAX_FONT_SIZE
  );
}
