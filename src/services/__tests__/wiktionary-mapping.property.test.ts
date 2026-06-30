/**
 * Property 10: Wiktionary API response mapping preserves content
 *
 * For any valid Wiktionary REST API response containing definition entries,
 * the mapping function SHALL produce a DictionaryResult where every definition's
 * text content (after HTML stripping) appears as a Definition.meaning, every
 * partOfSpeech is preserved, and every example sentence is included.
 *
 * **Validates: Requirements 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapWiktionaryResponse } from '../wiktionary-provider';

/**
 * Arbitrary for plain text strings (no HTML tags) so that stripHtmlTags is a no-op.
 * This ensures we know the exact expected output.
 */
const plainTextArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz 0123456789'.split('')), {
    minLength: 1,
    maxLength: 100,
  })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for partOfSpeech values used in Wiktionary responses.
 */
const partOfSpeechArb = fc.constantFrom(
  'Noun',
  'Verb',
  'Adjective',
  'Adverb',
  'Pronoun',
  'Preposition',
  'Conjunction',
  'Interjection',
  'Determiner',
  'Particle'
);

/**
 * Arbitrary for a single Wiktionary definition with optional examples.
 */
const wiktionaryDefinitionArb = fc.record({
  definition: plainTextArb,
  parsedExamples: fc.option(
    fc.array(fc.record({ example: plainTextArb }), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  examples: fc.option(
    fc.array(plainTextArb, { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
});

/**
 * Arbitrary for a single Wiktionary API entry (partOfSpeech + definitions).
 */
const wiktionaryEntryArb = fc.record({
  partOfSpeech: partOfSpeechArb,
  language: fc.constantFrom('English', 'French', 'German', 'Spanish'),
  definitions: fc.array(wiktionaryDefinitionArb, { minLength: 1, maxLength: 4 }),
});

/**
 * Arbitrary for a language code key in the response.
 */
const languageCodeArb = fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt');

/**
 * Arbitrary for a full Wiktionary API response (keyed by language code).
 */
const wiktionaryResponseArb = fc
  .tuple(languageCodeArb, fc.array(wiktionaryEntryArb, { minLength: 1, maxLength: 3 }))
  .map(([langCode, entries]) => ({ [langCode]: entries }));

describe('Feature: language-dictionaries, Property 10: Wiktionary API response mapping preserves content', () => {
  it('every definition text content appears as a Definition.meaning', () => {
    fc.assert(
      fc.property(wiktionaryResponseArb, (response) => {
        const result = mapWiktionaryResponse(response);

        // Collect all expected meanings from the response (plain text, no HTML stripping needed)
        const expectedMeanings: string[] = [];
        for (const langCode of Object.keys(response)) {
          const entries = response[langCode];
          for (const entry of entries) {
            for (const def of entry.definitions) {
              // Since we generate plain text, stripHtmlTags is a no-op
              if (def.definition.trim()) {
                expectedMeanings.push(def.definition);
              }
            }
          }
        }

        const resultMeanings = result.map((d) => d.meaning);
        expect(resultMeanings).toEqual(expectedMeanings);
      }),
      { numRuns: 100 }
    );
  });

  it('every partOfSpeech is preserved', () => {
    fc.assert(
      fc.property(wiktionaryResponseArb, (response) => {
        const result = mapWiktionaryResponse(response);

        // Collect expected partOfSpeech for each definition
        const expectedPartsOfSpeech: (string | undefined)[] = [];
        for (const langCode of Object.keys(response)) {
          const entries = response[langCode];
          for (const entry of entries) {
            for (const def of entry.definitions) {
              if (def.definition.trim()) {
                expectedPartsOfSpeech.push(entry.partOfSpeech || undefined);
              }
            }
          }
        }

        const resultPartsOfSpeech = result.map((d) => d.partOfSpeech);
        expect(resultPartsOfSpeech).toEqual(expectedPartsOfSpeech);
      }),
      { numRuns: 100 }
    );
  });

  it('every example sentence is included in the result', () => {
    fc.assert(
      fc.property(wiktionaryResponseArb, (response) => {
        const result = mapWiktionaryResponse(response);

        // Walk through response and result in parallel
        let resultIdx = 0;
        for (const langCode of Object.keys(response)) {
          const entries = response[langCode];
          for (const entry of entries) {
            for (const def of entry.definitions) {
              if (!def.definition.trim()) continue;

              const resultDef = result[resultIdx];
              expect(resultDef).toBeDefined();

              // Collect expected examples from both parsedExamples and examples
              const expectedExamples: string[] = [];
              if (def.parsedExamples) {
                for (const ex of def.parsedExamples) {
                  if (ex.example) {
                    expectedExamples.push(ex.example);
                  }
                }
              }
              if (def.examples) {
                for (const ex of def.examples) {
                  if (ex) {
                    expectedExamples.push(ex);
                  }
                }
              }

              if (expectedExamples.length > 0) {
                expect(resultDef.examples).toBeDefined();
                expect(resultDef.examples).toEqual(expectedExamples);
              } else {
                expect(resultDef.examples).toBeUndefined();
              }

              resultIdx++;
            }
          }
        }

        expect(resultIdx).toBe(result.length);
      }),
      { numRuns: 100 }
    );
  });
});
