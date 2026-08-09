/**
 * Structural tests for the built-in locale files (src/i18n/locales).
 *
 * These lock in that every shipped locale stays a complete, consistent
 * TranslationStrings — same top-level keys and same fontNames keys as the
 * canonical English set — so a future key addition can't silently leave
 * ur/fr partially untranslated.
 */

import { describe, it, expect } from 'vitest';
import { en, ur, fr, LOCALES } from '../locales';
import { DEFAULT_TRANSLATIONS } from '../defaults';
import { URDU_WEB_FONT_OPTIONS } from '../../services/urdu-web-fonts';

const ALL_LOCALES = { en, ur, fr };
const CANONICAL_KEYS = Object.keys(en).sort();
const CANONICAL_FONT_NAME_KEYS = Object.keys(en.fontNames).sort();

describe('built-in locales', () => {
  it('DEFAULT_TRANSLATIONS is the English locale', () => {
    expect(DEFAULT_TRANSLATIONS).toBe(en);
  });

  it('LOCALES exposes en, ur, and fr', () => {
    expect(Object.keys(LOCALES).sort()).toEqual(['en', 'fr', 'ur']);
  });

  for (const [code, locale] of Object.entries(ALL_LOCALES)) {
    describe(`locale: ${code}`, () => {
      it('has exactly the same top-level keys as the English canonical set', () => {
        expect(Object.keys(locale).sort()).toEqual(CANONICAL_KEYS);
      });

      it('has no empty string values', () => {
        for (const [key, value] of Object.entries(locale)) {
          if (key === 'fontNames' || key === 'uiDirection') continue;
          expect(typeof value).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      });

      it('has exactly one fontNames entry per built-in font (3 generic + urdu-web-fonts)', () => {
        expect(Object.keys(locale.fontNames).sort()).toEqual(CANONICAL_FONT_NAME_KEYS);
      });

      it('has a non-empty label for every font name', () => {
        for (const label of Object.values(locale.fontNames)) {
          expect(label.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('fontNames covers every URDU_WEB_FONT_OPTIONS display name plus Serif/Sans/Mono', () => {
    const expectedKeys = ['Serif', 'Sans', 'Mono', ...URDU_WEB_FONT_OPTIONS.map((f) => f.name)].sort();
    expect(CANONICAL_FONT_NAME_KEYS).toEqual(expectedKeys);
  });

  it('ur locale is right-to-left', () => {
    expect(ur.uiDirection).toBe('rtl');
  });

  it('en and fr locales are left-to-right', () => {
    expect(en.uiDirection).toBe('ltr');
    expect(fr.uiDirection).toBe('ltr');
  });
});
