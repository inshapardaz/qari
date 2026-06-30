/**
 * Property 8: FreeDictionary API response mapping preserves content
 *
 * For any valid FreeDictionary API response containing meanings with definitions,
 * the mapping function SHALL produce a DictionaryResult where every meaning's
 * partOfSpeech is preserved, every definition text appears as a Definition.meaning,
 * and every example sentence appears in the corresponding Definition.examples array.
 *
 * **Validates: Requirements 4.3**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { FreeDictionaryProvider } from '../free-dictionary-provider';

/**
 * Arbitrary for a single FreeDictionary API definition entry.
 */
const definitionArb = fc.record({
  definition: fc.string({ minLength: 1, maxLength: 200 }),
  example: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  synonyms: fc.constant([] as string[]),
  antonyms: fc.constant([] as string[]),
});

/**
 * Arbitrary for a single meaning (partOfSpeech + definitions).
 */
const meaningArb = fc.record({
  partOfSpeech: fc.stringOf(fc.constantFrom('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection'), { minLength: 1, maxLength: 1 }).map(() =>
    fc.sample(fc.constantFrom('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection'), 1)[0]
  ),
  definitions: fc.array(definitionArb, { minLength: 1, maxLength: 5 }),
});

/**
 * Simpler arbitrary for partOfSpeech to avoid nested sampling.
 */
const partOfSpeechArb = fc.constantFrom('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection');

/**
 * Arbitrary for a single meaning with a proper partOfSpeech.
 */
const meaningArb2 = fc.tuple(partOfSpeechArb, fc.array(definitionArb, { minLength: 1, maxLength: 5 })).map(
  ([partOfSpeech, definitions]) => ({ partOfSpeech, definitions })
);

/**
 * Arbitrary for a full FreeDictionary API entry.
 */
const entryArb = fc.record({
  word: fc.string({ minLength: 1, maxLength: 50 }),
  phonetic: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  meanings: fc.array(meaningArb2, { minLength: 1, maxLength: 4 }),
});

/**
 * Arbitrary for the full API response (array of entries).
 */
const apiResponseArb = fc.array(entryArb, { minLength: 1, maxLength: 3 });

describe('Feature: language-dictionaries, Property 8: FreeDictionary API response mapping preserves content', () => {
  let provider: FreeDictionaryProvider;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    provider = new FreeDictionaryProvider({ timeout: 5000 });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('every meaning partOfSpeech is preserved in the result', async () => {
    await fc.assert(
      fc.asyncProperty(apiResponseArb, async (apiResponse) => {
        // Mock fetch to return the generated API response
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => apiResponse,
        });

        const result = await provider.lookup('test', 'en', '');

        // Collect all partOfSpeech values from the API response
        const expectedPartsOfSpeech: string[] = [];
        for (const entry of apiResponse) {
          for (const meaning of entry.meanings) {
            for (let i = 0; i < meaning.definitions.length; i++) {
              expectedPartsOfSpeech.push(meaning.partOfSpeech);
            }
          }
        }

        // Every partOfSpeech in the input should appear in the result definitions
        const resultPartsOfSpeech = result.definitions.map(d => d.partOfSpeech);
        expect(resultPartsOfSpeech).toEqual(expectedPartsOfSpeech);
      }),
      { numRuns: 100 }
    );
  });

  it('every definition text appears as a Definition.meaning', async () => {
    await fc.assert(
      fc.asyncProperty(apiResponseArb, async (apiResponse) => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => apiResponse,
        });

        const result = await provider.lookup('test', 'en', '');

        // Collect all definition texts from the API response
        const expectedMeanings: string[] = [];
        for (const entry of apiResponse) {
          for (const meaning of entry.meanings) {
            for (const def of meaning.definitions) {
              expectedMeanings.push(def.definition);
            }
          }
        }

        // Every definition text should appear as a Definition.meaning in the result
        const resultMeanings = result.definitions.map(d => d.meaning);
        expect(resultMeanings).toEqual(expectedMeanings);
      }),
      { numRuns: 100 }
    );
  });

  it('every example sentence appears in the corresponding Definition.examples', async () => {
    await fc.assert(
      fc.asyncProperty(apiResponseArb, async (apiResponse) => {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => apiResponse,
        });

        const result = await provider.lookup('test', 'en', '');

        // Walk through both API response and result in parallel
        let resultIdx = 0;
        for (const entry of apiResponse) {
          for (const meaning of entry.meanings) {
            for (const def of meaning.definitions) {
              const resultDef = result.definitions[resultIdx];
              expect(resultDef).toBeDefined();

              if (def.example !== undefined) {
                // The example should appear in the result's examples array
                expect(resultDef.examples).toBeDefined();
                expect(resultDef.examples).toContain(def.example);
              } else {
                // No example in the input means no examples array in the result
                expect(resultDef.examples).toBeUndefined();
              }

              resultIdx++;
            }
          }
        }

        // Ensure all result definitions were checked
        expect(resultIdx).toBe(result.definitions.length);
      }),
      { numRuns: 100 }
    );
  });
});
