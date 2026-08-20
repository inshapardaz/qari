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
 * Seven built-in themes, tuned after the reading themes of leading e-reader
 * apps — light/dark/calm/quiet/paper/focus specifically mirror the Apple
 * Books appearance picker's own six (Books' "Original" is this file's
 * `light`; its "Bold" is a font-weight variant, not a color theme, so it
 * has no equivalent here): soft near-black text rather than pure black on
 * light, a warm parchment tone for calm (formerly named "sepia" — same
 * colors, renamed to match Books' own naming), a true-black dark theme with
 * off-white (not pure white) text to cut glare, a softer charcoal-on-gray
 * quiet theme as a lower-contrast alternative to dark, a cool light gray
 * paper theme as an alternative to stark white, and a warm off-white focus
 * theme between paper and calm in tone. high-contrast is a distinct
 * accessibility theme, not an aesthetic one — it meets WCAG AAA ≥ 7:1
 * contrast (black bg + white text = 21:1) and keeps that guarantee
 * regardless of the other themes' tuning.
 *
 * `secondary` is each theme's own muted/dimmed text tone (subtitles, author
 * names, captions) — every value here clears WCAG AA's 4.5:1 text-contrast
 * minimum against that theme's own `background`, high-contrast comfortably
 * clearing far more than that in keeping with its own guarantee above.
 *
 * `accent` is each theme's own highlight color (active-chapter background,
 * the chapter drawer's Tabs underline, Mantine's own "primary" controls —
 * see `--reader-accent` and `MANTINE_PRIMARY_COLOR_STYLE` in Reader.tsx).
 * dark/quiet/paper/focus deliberately set it to the *same* value as their
 * own `foreground` rather than a distinct hue — matching the header's own
 * "selected" toggle-button state (`backgroundColor: var(--reader-fg)`), so
 * a chapter-list selection or a Tabs underline in one of these themes
 * reads as the exact same "selected" color the header's own toggle buttons
 * already use there, instead of an unrelated accent hue that only agrees
 * with `foreground` by coincidence (or not at all). light/calm/
 * high-contrast keep a genuinely distinct accent hue instead.
 */
export const THEMES: Record<ThemeName, ThemeColors> = {
  light: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    accent: '#0071e3',
    surface: '#f5f5f7',
    border: '#d2d2d7',
    secondary: '#6e6e73',
  },
  dark: {
    background: '#000000',
    foreground: '#d6d6d6',
    // Same reasoning as paper's own accent below — matches the header's
    // "selected" toggle-button state (backgroundColor: var(--reader-fg)),
    // rather than a separate highlight hue unrelated to the rest of the
    // theme's neutral black/off-white palette.
    accent: '#d6d6d6',
    surface: '#1c1c1e',
    border: '#38383a',
    secondary: '#98989d',
  },
  calm: {
    background: '#f6ecd8',
    foreground: '#5b4636',
    accent: '#8b5e34',
    surface: '#efe1c6',
    border: '#ddcba6',
    secondary: '#7a6754',
  },
  quiet: {
    background: '#3a3a3c',
    foreground: '#c7c7cc',
    // Same reasoning as dark/paper's own accent — matches the header's
    // "selected" toggle-button state rather than a separate highlight hue.
    accent: '#c7c7cc',
    surface: '#48484a',
    border: '#5a5a5c',
    secondary: '#a5a5aa',
  },
  paper: {
    background: '#e9e9e7',
    foreground: '#1c1c1e',
    // Deliberately the same as `foreground`, not a distinct highlight hue
    // like the other themes' accents — matches the header's own "selected"
    // toggle-button state (backgroundColor: var(--reader-fg)), so Paper's
    // neutral, monochrome look (see the Apple Books reference this theme
    // was modeled on) doesn't get an incongruous blue accent bolted onto it.
    accent: '#1c1c1e',
    surface: '#dcdcda',
    border: '#c7c7c5',
    secondary: '#636368',
  },
  focus: {
    background: '#faf6ef',
    foreground: '#1c1c1e',
    // Same reasoning as dark/quiet/paper's own accent — matches the
    // header's "selected" toggle-button state rather than a separate
    // highlight hue the rest of the theme's palette doesn't otherwise use.
    accent: '#1c1c1e',
    surface: '#f1ebe0',
    border: '#e3dccc',
    secondary: '#6e6e73',
  },
  'high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    accent: '#ffff00',
    surface: '#1a1a1a',
    border: '#ffffff',
    secondary: '#c9c9c9',
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
      // A preference persisted before the sepia->calm rename would otherwise
      // just fail validation below and silently fall back to the 'light'
      // default — migrate it forward instead so a returning reader keeps
      // whichever theme they'd actually picked.
      if (parsed && typeof parsed === 'object' && parsed.theme === 'sepia') {
        parsed.theme = 'calm';
      }
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
    this.rootElement.style.setProperty('--reader-secondary', colors.secondary);
  }

  private applyFontFamily(family: FontFamily): void {
    this.rootElement.style.setProperty('--reader-font-family', FONT_FAMILY_MAP[family]);
  }

  private applyFontSize(size: number): void {
    this.rootElement.style.setProperty('--reader-font-size', `${size}px`);
  }
}

// --- Validation helpers ---

const VALID_THEMES: ThemeName[] = ['light', 'dark', 'calm', 'quiet', 'paper', 'focus', 'high-contrast'];
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
