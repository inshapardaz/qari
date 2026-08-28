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
 * Retuned to move each theme's exact values toward its nearest counterpart
 * in the Qari Reader Mockups design (light→light, paper→paper, calm→sepia,
 * quiet→dusk, dark→dark, high-contrast→contrast) without renaming any key —
 * the `ThemeName` union is a public API host apps persist and pass back in,
 * so only the color *values* move, never the keys. `focus` has no
 * counterpart in that design (which has `forest` instead, itself with no
 * counterpart here), so it's untouched. Every `secondary` value was
 * contrast-checked against its own `background` after retuning (see the
 * `secondary` paragraph below) — two of the mockup's own raw secondary
 * values (paper, sepia/calm) landed under the 4.5:1 floor and were darkened
 * a step further than the mockup's own choice to clear it.
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
 * high-contrast keep a genuinely distinct accent hue instead — for those
 * three, the accent hue itself was retuned toward the mockup design's own
 * (a muted plum for light, a warmer brick-red for calm/sepia, a brighter
 * gold for high-contrast/contrast), each re-verified against `background`
 * to stay well clear of the same contrast floors.
 */
export const THEMES: Record<ThemeName, ThemeColors> = {
  light: {
    background: '#ffffff',
    foreground: '#1c1c1c',
    accent: '#5a3a5f',
    surface: '#faf9f7',
    border: '#e6e4e0',
    secondary: '#6b6b6b',
  },
  dark: {
    background: '#000000',
    foreground: '#c9c9c9',
    // Same reasoning as paper's own accent below — matches the header's
    // "selected" toggle-button state (backgroundColor: var(--reader-fg)),
    // rather than a separate highlight hue unrelated to the rest of the
    // theme's neutral black/off-white palette.
    accent: '#c9c9c9',
    surface: '#1a1a1a',
    border: '#2a2a2a',
    secondary: '#8a8a8a',
  },
  calm: {
    background: '#ead9be',
    foreground: '#4a3728',
    accent: '#6b3a3a',
    surface: '#ddc9a3',
    border: '#cdb488',
    // Darkened one step past the mockup's own sepia `sub` (#7c6248, which
    // measures 4.10:1 here — under the 4.5:1 AA floor) to actually clear it.
    secondary: '#6f573f',
  },
  quiet: {
    background: '#2b2b30',
    foreground: '#d9d4c8',
    // Same reasoning as dark/paper's own accent — matches the header's
    // "selected" toggle-button state rather than a separate highlight hue.
    accent: '#d9d4c8',
    surface: '#34343a',
    border: '#45454c',
    secondary: '#9a968c',
  },
  paper: {
    background: '#f6efe1',
    foreground: '#3a2f28',
    // Deliberately the same as `foreground`, not a distinct highlight hue
    // like the other themes' accents — matches the header's own "selected"
    // toggle-button state (backgroundColor: var(--reader-fg)), so Paper's
    // neutral, monochrome look (see the Apple Books reference this theme
    // was modeled on) doesn't get an incongruous accent hue bolted onto it.
    accent: '#3a2f28',
    surface: '#efe6d2',
    border: '#ddcfae',
    // Darkened one step past the mockup's own paper `sub` (#7a6a56, which
    // measures 4.56:1 here — a hair over the 4.5:1 AA floor) for a
    // comfortable margin instead of a razor-thin pass.
    secondary: '#6f5c48',
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
    accent: '#ffdd55',
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
    // theme is a fully-controlled value a host app can persist and feed back in on its own (see
    // Reader.tsx's theme prop) - unlike loadPersistedPreferences below, nothing here guarantees
    // it's still one of THEMES' current keys. A theme renamed/removed between qari versions (e.g.
    // sepia -> calm) would otherwise crash applyThemeColors on THEMES[theme].background with no
    // recovery, taking down the whole <Reader> (no error boundary wraps it) - fall back instead.
    const safeTheme = VALID_THEMES.includes(theme) ? theme : 'light';
    if (safeTheme !== theme) {
      console.warn(`[qari] Unknown theme "${theme}" - falling back to "${safeTheme}". This usually means a theme name was renamed/removed between qari versions and the caller is still passing an old persisted value.`);
    }
    this.preferences.theme = safeTheme;
    this.applyThemeColors(safeTheme);
  }

  setFont(family: FontFamily): void {
    // Same reasoning as setTheme above - family is caller-controlled, not just internally
    // persisted, so an unrecognized value must degrade gracefully rather than write an invalid
    // CSS custom property.
    const safeFamily = VALID_FONTS.includes(family) ? family : 'serif';
    if (safeFamily !== family) {
      console.warn(`[qari] Unknown font family "${family}" - falling back to "${safeFamily}".`);
    }
    this.preferences.fontFamily = safeFamily;
    this.applyFontFamily(safeFamily);
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
    // Belt-and-suspenders alongside setTheme's own guard above: THEMES[theme] must never be
    // undefined here, since every caller (setTheme, applyAllProperties off a validated
    // this.preferences.theme) is already supposed to hand this a real key - but a raw lookup
    // crashing the whole reader on any future caller that skips that validation is a far worse
    // failure mode than silently rendering the light theme's colors.
    const colors = THEMES[theme] ?? THEMES.light;
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
