/**
 * Property 7: Spell-check merges with online definitions
 *
 * For any lookup where a local provider indicates the word is correctly spelled
 * but provides no semantic definition, AND an online provider supports the same
 * language, the DictionaryService SHALL query the online provider and the final
 * result SHALL contain both the `spellCheck.correct = true` status from the
 * local provider AND the definitions from the online provider.
 *
 * **Validates: Requirements 8.4**
 *
 * Feature: language-dictionaries, Property 7: Spell-check merges with online definitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DictionaryService } from '../dictionary-service';
import { DictionaryProvider, DictionaryResult, Definition } from '../../interfaces/dictionary';

/**
 * Generator for a non-empty word-like string.
 */
const wordArb = fc.stringMatching(/^[a-zA-Z]{1,20}$/);

/**
 * Generator for a language code.
 */
const languageArb = fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt', 'ru');

/**
 * Generator for a single Definition with a meaningful meaning string.
 */
const definitionArb: fc.Arbitrary<Definition> = fc.record({
  meaning: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  partOfSpeech: fc.option(fc.constantFrom('noun', 'verb', 'adjective', 'adverb'), { nil: undefined }),
  examples: fc.option(
    fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
});

/**
 * Generator for an array of definitions (at least one).
 */
const definitionsArb = fc.array(definitionArb, { minLength: 1, maxLength: 5 });

/**
 * Creates a mock local provider that returns spellCheck.correct = true with no definitions.
 */
function createLocalProvider(language: string, word: string): DictionaryProvider {
  return {
    id: 'local-spell-check',
    supportedLanguages: [language],
    category: 'local',
    ready: true,
    lookup: vi.fn().mockResolvedValue({
      word,
      language,
      definitions: [],
      spellCheck: { correct: true, suggestions: [] },
    } satisfies DictionaryResult),
  };
}

/**
 * Creates a mock online provider that returns definitions for the given word.
 */
function createOnlineProvider(
  language: string,
  word: string,
  definitions: Definition[]
): DictionaryProvider {
  return {
    id: 'online-definitions',
    supportedLanguages: [language],
    category: 'online',
    ready: true,
    lookup: vi.fn().mockResolvedValue({
      word,
      language,
      definitions,
    } satisfies DictionaryResult),
  };
}

describe('Feature: language-dictionaries, Property 7: Spell-check merges with online definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merged result contains spellCheck.correct = true from local provider', async () => {
    await fc.assert(
      fc.asyncProperty(wordArb, languageArb, definitionsArb, async (word, language, definitions) => {
        const service = new DictionaryService();
        const localProvider = createLocalProvider(language, word);
        const onlineProvider = createOnlineProvider(language, word, definitions);

        service.registerProvider(localProvider, 'local');
        service.registerProvider(onlineProvider, 'online');

        const result = await service.lookup(word, language, `context with ${word} in it`, 0);

        // Merged result must have spellCheck.correct = true
        expect(result.spellCheck).toBeDefined();
        expect(result.spellCheck!.correct).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('merged result contains definitions from online provider', async () => {
    await fc.assert(
      fc.asyncProperty(wordArb, languageArb, definitionsArb, async (word, language, definitions) => {
        const service = new DictionaryService();
        const localProvider = createLocalProvider(language, word);
        const onlineProvider = createOnlineProvider(language, word, definitions);

        service.registerProvider(localProvider, 'local');
        service.registerProvider(onlineProvider, 'online');

        const result = await service.lookup(word, language, `context with ${word} in it`, 0);

        // Merged result must have the online definitions
        expect(result.definitions).toEqual(definitions);
      }),
      { numRuns: 100 }
    );
  });

  it('online provider is queried when local returns correct spelling with no definitions', async () => {
    await fc.assert(
      fc.asyncProperty(wordArb, languageArb, definitionsArb, async (word, language, definitions) => {
        const service = new DictionaryService();
        const localProvider = createLocalProvider(language, word);
        const onlineProvider = createOnlineProvider(language, word, definitions);

        service.registerProvider(localProvider, 'local');
        service.registerProvider(onlineProvider, 'online');

        await service.lookup(word, language, `context with ${word} in it`, 0);

        // Both providers should have been called
        expect(localProvider.lookup).toHaveBeenCalledTimes(1);
        expect(onlineProvider.lookup).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 }
    );
  });

  it('merged result preserves word and language fields', async () => {
    await fc.assert(
      fc.asyncProperty(wordArb, languageArb, definitionsArb, async (word, language, definitions) => {
        const service = new DictionaryService();
        const localProvider = createLocalProvider(language, word);
        const onlineProvider = createOnlineProvider(language, word, definitions);

        service.registerProvider(localProvider, 'local');
        service.registerProvider(onlineProvider, 'online');

        const result = await service.lookup(word, language, `context with ${word} in it`, 0);

        expect(result.word).toBe(word);
        expect(result.language).toBe(language);
      }),
      { numRuns: 100 }
    );
  });

  it('merged result has empty suggestions array from spell-check', async () => {
    await fc.assert(
      fc.asyncProperty(wordArb, languageArb, definitionsArb, async (word, language, definitions) => {
        const service = new DictionaryService();
        const localProvider = createLocalProvider(language, word);
        const onlineProvider = createOnlineProvider(language, word, definitions);

        service.registerProvider(localProvider, 'local');
        service.registerProvider(onlineProvider, 'online');

        const result = await service.lookup(word, language, `context with ${word} in it`, 0);

        // spellCheck suggestions should be empty (word is correctly spelled)
        expect(result.spellCheck!.suggestions).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});
