/**
 * Property 9: Wiktionary URL construction
 *
 * For any language code and any word string, the Wiktionary provider SHALL
 * construct the request URL as
 * `https://{language}.wiktionary.org/api/rest_v1/page/definition/{encodedWord}`
 * where `{encodedWord}` is the URI-encoded word.
 *
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildWiktionaryUrl } from '../wiktionary-provider';

/**
 * Arbitrary for ISO 639-1 style language codes (2-3 lowercase letters).
 */
const languageCodeArb = fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
  minLength: 2,
  maxLength: 3,
});

/**
 * Arbitrary for word strings that may include unicode, special characters, and spaces.
 * We use a non-empty string to represent a valid word lookup.
 */
const wordArb = fc.string({ minLength: 1, maxLength: 100 });

describe('Feature: language-dictionaries, Property 9: Wiktionary URL construction', () => {
  it('URL follows the pattern https://{language}.wiktionary.org/api/rest_v1/page/definition/{encodedWord}', () => {
    fc.assert(
      fc.property(languageCodeArb, wordArb, (language, word) => {
        const url = buildWiktionaryUrl(language, word);
        const expectedUrl = `https://${language}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
        expect(url).toBe(expectedUrl);
      }),
      { numRuns: 100 }
    );
  });

  it('URL starts with https:// and contains the language subdomain', () => {
    fc.assert(
      fc.property(languageCodeArb, wordArb, (language, word) => {
        const url = buildWiktionaryUrl(language, word);
        expect(url.startsWith(`https://${language}.wiktionary.org/`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('word is properly URI-encoded in the URL', () => {
    fc.assert(
      fc.property(languageCodeArb, wordArb, (language, word) => {
        const url = buildWiktionaryUrl(language, word);
        const encodedWord = encodeURIComponent(word);
        expect(url.endsWith(`/definition/${encodedWord}`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('URL contains the REST API path /api/rest_v1/page/definition/', () => {
    fc.assert(
      fc.property(languageCodeArb, wordArb, (language, word) => {
        const url = buildWiktionaryUrl(language, word);
        expect(url).toContain('/api/rest_v1/page/definition/');
      }),
      { numRuns: 100 }
    );
  });
});
