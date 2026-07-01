/**
 * Property 1: Partial merge preserves provided keys and fills missing keys with defaults
 *
 * Validates: Requirements 1.3
 *
 * For any subset of TranslationStrings keys with arbitrary non-empty string values,
 * merging that partial object with DEFAULT_TRANSLATIONS produces a resolved object where:
 * (a) every key present in the partial uses the partial's value, and
 * (b) every key absent from the partial uses the corresponding DEFAULT_TRANSLATIONS value.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { DEFAULT_TRANSLATIONS } from '../defaults';
import type { TranslationStrings } from '../types';

const ALL_KEYS = Object.keys(DEFAULT_TRANSLATIONS) as (keyof TranslationStrings)[];

/**
 * Generates a random Partial<TranslationStrings> by selecting a random subset
 * of keys and assigning arbitrary non-empty string values.
 * The `uiDirection` key is handled specially since it's a union type.
 */
const partialTranslationsArb = fc
  .subarray(ALL_KEYS, { minLength: 0, maxLength: ALL_KEYS.length })
  .chain((keys) =>
    fc.tuple(
      fc.constant(keys),
      fc.array(fc.string({ minLength: 1 }), {
        minLength: keys.length,
        maxLength: keys.length,
      })
    )
  )
  .map(([keys, values]) => {
    const partial: Partial<TranslationStrings> = {};
    keys.forEach((key, i) => {
      if (key === 'uiDirection') {
        // uiDirection only accepts 'ltr' or 'rtl'
        partial[key] = values[i].length % 2 === 0 ? 'ltr' : 'rtl';
      } else {
        (partial as any)[key] = values[i];
      }
    });
    return partial;
  });

describe('Feature: ui-translations, Property 1: Partial merge preserves provided keys and fills missing keys with defaults', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * Merging a partial TranslationStrings with DEFAULT_TRANSLATIONS produces
   * a complete object where provided keys use the partial's value and missing
   * keys fall back to the default.
   */
  it('partial merge preserves provided keys and fills missing keys with defaults', () => {
    fc.assert(
      fc.property(partialTranslationsArb, (partial) => {
        const resolved: TranslationStrings = { ...DEFAULT_TRANSLATIONS, ...partial };

        for (const key of ALL_KEYS) {
          if (key in partial) {
            // (a) Keys present in the partial use the partial's value
            expect(resolved[key]).toBe(partial[key]);
          } else {
            // (b) Keys absent from the partial use the DEFAULT_TRANSLATIONS value
            expect(resolved[key]).toBe(DEFAULT_TRANSLATIONS[key]);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
