import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ThemeEngine } from '../theme-engine';
import type { ThemeName, FontFamily, ReadingPreferences } from '../../interfaces/theme-engine';

/**
 * Property 4: Reading Preferences Round-Trip
 *
 * For any valid combination of reading preferences (theme from the set
 * {light, dark, sepia, high-contrast}, font family from {serif, sans-serif, monospace, nastaliq},
 * font size from 12–48 in 2px steps), persisting to local storage and loading back
 * SHALL produce an identical preferences object.
 *
 * **Validates: Requirements 3.6**
 */

const themeArb: fc.Arbitrary<ThemeName> = fc.constantFrom(
  'light',
  'dark',
  'sepia',
  'high-contrast'
);

const fontFamilyArb: fc.Arbitrary<FontFamily> = fc.constantFrom(
  'serif',
  'sans-serif',
  'monospace',
  'nastaliq'
);

// Font sizes from 12 to 48 in 2px steps: 12, 14, 16, ..., 48
const fontSizeArb: fc.Arbitrary<number> = fc.integer({ min: 6, max: 24 }).map((n) => n * 2);

const preferencesArb: fc.Arbitrary<ReadingPreferences> = fc.record({
  theme: themeArb,
  fontFamily: fontFamilyArb,
  fontSize: fontSizeArb,
});

describe('Feature: universal-ebook-reader, Property 4: Reading Preferences Round-Trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persist then load produces identical preferences for any valid combination', () => {
    fc.assert(
      fc.property(preferencesArb, (prefs) => {
        // Clear localStorage for each iteration
        localStorage.clear();

        // Create engine and set preferences
        const engine = new ThemeEngine();
        engine.setTheme(prefs.theme);
        engine.setFont(prefs.fontFamily);
        engine.setFontSize(prefs.fontSize);

        // Persist preferences
        const persisted = engine.persistPreferences();
        expect(persisted).toBe(true);

        // Load preferences in a new engine instance
        const engine2 = new ThemeEngine();
        const loaded = engine2.loadPersistedPreferences();

        // Assert loaded preferences are identical to the original
        expect(loaded).not.toBeNull();
        expect(loaded!.theme).toBe(prefs.theme);
        expect(loaded!.fontFamily).toBe(prefs.fontFamily);
        expect(loaded!.fontSize).toBe(prefs.fontSize);
      }),
      { numRuns: 100 }
    );
  });
});
