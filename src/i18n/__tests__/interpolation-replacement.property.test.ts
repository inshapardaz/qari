/**
 * Property 2: Interpolation replaces all matched tokens
 *
 * Validates: Requirements 9.1
 *
 * For any template string containing one or more {tokenName} placeholders and a
 * params record that includes entries for those token names, interpolate(template, params)
 * produces an output where every matched token is replaced with String(params[tokenName]).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { interpolate } from '../interpolate';

describe('Feature: ui-translations, Property 2: Interpolation replaces all matched tokens', () => {
  /**
   * **Validates: Requirements 9.1**
   *
   * Generate random token names (alphanumeric starting with a letter) and random
   * replacement values (strings and numbers). Build template strings with {token}
   * placeholders. Assert all tokens are replaced with their String(value).
   */
  it('replaces all matched {token} placeholders with their corresponding param values', () => {
    // Generator for valid token names: starts with a letter, followed by word chars
    const tokenNameArb = fc.stringMatching(/^[a-zA-Z]\w{0,9}$/);

    // Generator for replacement values: strings or numbers
    const replacementValueArb = fc.oneof(
      fc.string({ minLength: 0, maxLength: 20 }),
      fc.integer({ min: -10000, max: 10000 }),
      fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true })
    );

    // Generator for a set of unique token entries
    const tokenEntriesArb = fc
      .uniqueArray(
        fc.tuple(tokenNameArb, replacementValueArb),
        { minLength: 1, maxLength: 5, selector: ([name]) => name }
      );

    // Generator for filler text (no curly braces to avoid accidental tokens)
    const fillerArb = fc.stringMatching(/^[^{}]{0,15}$/);

    fc.assert(
      fc.property(tokenEntriesArb, fillerArb, (entries, filler) => {
        // Build template with {token} placeholders interleaved with filler
        const template = entries
          .map(([name]) => `${filler}{${name}}`)
          .join(filler) + filler;

        // Build params from entries
        const params: Record<string, string | number> = {};
        for (const [name, value] of entries) {
          params[name] = value;
        }

        const result = interpolate(template, params);

        // Assert no matched token placeholders remain in the output
        for (const [name] of entries) {
          expect(result).not.toContain(`{${name}}`);
        }

        // Assert each token was replaced with String(value)
        for (const [name, value] of entries) {
          expect(result).toContain(String(value));
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.1**
   *
   * When the same token appears multiple times in a template, all occurrences
   * are replaced.
   */
  it('replaces all occurrences of a repeated token', () => {
    const tokenNameArb = fc.stringMatching(/^[a-zA-Z]\w{0,9}$/);
    const replacementValueArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.integer({ min: 0, max: 9999 })
    );
    const repeatCountArb = fc.integer({ min: 2, max: 5 });

    fc.assert(
      fc.property(tokenNameArb, replacementValueArb, repeatCountArb, (name, value, count) => {
        // Use a unique separator that won't appear in the replacement value
        const sep = '|||';
        // Build template with the same token repeated multiple times
        const template = Array(count).fill(`{${name}}`).join(sep);

        const params: Record<string, string | number> = { [name]: value };
        const result = interpolate(template, params);

        // No placeholder should remain
        expect(result).not.toContain(`{${name}}`);

        // The result should equal the replacement value joined by the same separator
        const stringValue = String(value);
        const expected = Array(count).fill(stringValue).join(sep);
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});
