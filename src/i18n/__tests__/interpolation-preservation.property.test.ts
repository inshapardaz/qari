/**
 * Property 3: Interpolation preserves unmatched tokens
 *
 * Validates: Requirements 9.3
 *
 * For any template string containing {tokenName} placeholders and a params
 * record that does NOT contain an entry for a given token name,
 * interpolate(template, params) leaves that {tokenName} literally in the output.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { interpolate } from '../interpolate';

describe('Feature: ui-translations, Property 3: Interpolation preserves unmatched tokens', () => {
  /**
   * **Validates: Requirements 9.3**
   *
   * Generate random template strings with {token} placeholders and incomplete
   * params. Assert that unmatched tokens remain literal in the output.
   */
  it('unmatched {token} placeholders remain literal in the output', () => {
    // Generator for valid token names (alphanumeric + underscore, at least 1 char)
    const tokenNameArb = fc.stringOf(
      fc.oneof(
        fc.integer({ min: 97, max: 122 }).map((c) => String.fromCharCode(c)),
        fc.integer({ min: 65, max: 90 }).map((c) => String.fromCharCode(c)),
        fc.integer({ min: 48, max: 57 }).map((c) => String.fromCharCode(c)),
        fc.constant('_')
      ),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(
        // Generate 1-5 token names that will NOT be in params (unmatched)
        fc.array(tokenNameArb, { minLength: 1, maxLength: 5 }),
        // Generate 0-3 token names that WILL be in params (matched)
        fc.array(tokenNameArb, { minLength: 0, maxLength: 3 }),
        // Generate matched param values
        fc.array(fc.oneof(fc.string(), fc.integer().map(String)), { minLength: 0, maxLength: 3 }),
        // Generate prefix/suffix text around tokens
        fc.array(fc.string({ minLength: 0, maxLength: 20 }), { minLength: 2, maxLength: 8 }),
        (unmatchedTokens, matchedTokens, matchedValues, textParts) => {
          // Ensure unmatched tokens are distinct from matched tokens
          const matchedSet = new Set(matchedTokens);
          const actualUnmatched = unmatchedTokens.filter((t) => !matchedSet.has(t));

          // Skip if no truly unmatched tokens remain after filtering
          if (actualUnmatched.length === 0) return;

          // Build template by interleaving text parts and token placeholders
          let template = '';
          const allTokens = [...actualUnmatched, ...matchedTokens];
          for (let i = 0; i < allTokens.length; i++) {
            const prefix = textParts[i % textParts.length] ?? '';
            template += `${prefix}{${allTokens[i]}}`;
          }
          // Add trailing text
          template += textParts[(allTokens.length) % textParts.length] ?? '';

          // Build params only for matched tokens
          const params: Record<string, string | number> = {};
          for (let i = 0; i < matchedTokens.length; i++) {
            params[matchedTokens[i]] = matchedValues[i % Math.max(matchedValues.length, 1)] ?? '';
          }

          // Execute interpolation
          const result = interpolate(template, params);

          // Assert: every unmatched token remains literal in the output
          for (const token of actualUnmatched) {
            expect(result).toContain(`{${token}}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.3**
   *
   * When params is empty, all tokens in the template remain unchanged.
   */
  it('all tokens remain literal when params is empty', () => {
    const tokenNameArb = fc.stringOf(
      fc.oneof(
        fc.integer({ min: 97, max: 122 }).map((c) => String.fromCharCode(c)),
        fc.integer({ min: 65, max: 90 }).map((c) => String.fromCharCode(c)),
        fc.integer({ min: 48, max: 57 }).map((c) => String.fromCharCode(c)),
        fc.constant('_')
      ),
      { minLength: 1, maxLength: 20 }
    );

    fc.assert(
      fc.property(
        fc.array(tokenNameArb, { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 0, maxLength: 30 }),
        (tokens, prefix) => {
          // Build a template with all tokens
          const template = prefix + tokens.map((t) => `{${t}}`).join(' ');

          // Call with empty params
          const result = interpolate(template, {});

          // Every token should remain in the output
          for (const token of tokens) {
            expect(result).toContain(`{${token}}`);
          }

          // The output should equal the input since nothing was replaced
          expect(result).toBe(template);
        }
      ),
      { numRuns: 100 }
    );
  });
});
