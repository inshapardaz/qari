/**
 * Property 6: Local-first provider routing
 *
 * For any lookup request where both a local provider and an online provider
 * support the requested language, the DictionaryService SHALL query the local
 * provider first. If the local provider returns a successful result (misspelled
 * with suggestions, or word found), the online provider SHALL NOT be queried.
 * If no local provider supports the language, online providers SHALL be queried
 * directly.
 *
 * **Validates: Requirements 8.2, 8.3, 8.5**
 *
 * Feature: language-dictionaries, Property 6: Local-first provider routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DictionaryService } from '../dictionary-service';
import { DictionaryProvider, DictionaryResult } from '../../interfaces/dictionary';

/**
 * Helper to create a mock provider with vi.fn() for lookup.
 */
function createMockProvider(
  id: string,
  supportedLanguages: string[],
  category: 'local' | 'online',
  lookupResult: DictionaryResult
): DictionaryProvider {
  return {
    id,
    supportedLanguages,
    category,
    ready: true,
    lookup: vi.fn().mockResolvedValue(lookupResult),
  };
}

describe('Feature: language-dictionaries, Property 6: Local-first provider routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('local provider is always queried first when both local and online support the language', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random word
        fc.stringMatching(/^[a-zA-Z]{1,20}$/),
        // Generate a random language code
        fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt', 'ru'),
        // Generate random suggestions for misspelled result
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,15}$/), { minLength: 1, maxLength: 5 }),
        async (word, language, suggestions) => {
          const service = new DictionaryService();

          // Local provider returns a misspelled result (successful result with suggestions)
          const localResult: DictionaryResult = {
            word,
            language,
            definitions: [],
            spellCheck: { correct: false, suggestions },
          };

          const onlineResult: DictionaryResult = {
            word,
            language,
            definitions: [{ meaning: 'online definition' }],
          };

          const localProvider = createMockProvider(
            'local-provider',
            [language],
            'local',
            localResult
          );

          const onlineProvider = createMockProvider(
            'online-provider',
            [language],
            'online',
            onlineResult
          );

          service.registerProvider(localProvider, 'local');
          service.registerProvider(onlineProvider, 'online');

          await service.lookup(word, language, 'some context text', 0);

          // Local provider must be called
          expect(localProvider.lookup).toHaveBeenCalled();

          // Verify local was called with the word
          expect(localProvider.lookup).toHaveBeenCalledWith(
            word,
            language,
            expect.any(String),
            expect.anything()
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('online provider is NOT queried when local returns misspelled result', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,20}$/),
        fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt', 'ru'),
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,15}$/), { minLength: 1, maxLength: 10 }),
        async (word, language, suggestions) => {
          const service = new DictionaryService();

          // Local provider returns misspelled result
          const localResult: DictionaryResult = {
            word,
            language,
            definitions: [],
            spellCheck: { correct: false, suggestions },
          };

          const onlineResult: DictionaryResult = {
            word,
            language,
            definitions: [{ meaning: 'online definition' }],
          };

          const localProvider = createMockProvider(
            'local-provider',
            [language],
            'local',
            localResult
          );

          const onlineProvider = createMockProvider(
            'online-provider',
            [language],
            'online',
            onlineResult
          );

          service.registerProvider(localProvider, 'local');
          service.registerProvider(onlineProvider, 'online');

          const result = await service.lookup(word, language, 'some context text', 0);

          // Online provider must NOT be called
          expect(onlineProvider.lookup).not.toHaveBeenCalled();

          // Result should be the local misspelled result
          expect(result.spellCheck).toBeDefined();
          expect(result.spellCheck!.correct).toBe(false);
          expect(result.spellCheck!.suggestions).toEqual(suggestions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('online provider is queried directly when no local provider supports the language', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,20}$/),
        // The target language and a different language for local provider
        fc.constantFrom('en', 'fr', 'de', 'es', 'it'),
        fc.constantFrom('ja', 'zh', 'ko', 'ar', 'hi'),
        async (word, targetLanguage, localLanguage) => {
          const service = new DictionaryService();

          const localResult: DictionaryResult = {
            word,
            language: localLanguage,
            definitions: [],
            spellCheck: { correct: true, suggestions: [] },
          };

          const onlineResult: DictionaryResult = {
            word,
            language: targetLanguage,
            definitions: [{ meaning: 'online definition' }],
          };

          // Local provider only supports a different language
          const localProvider = createMockProvider(
            'local-provider',
            [localLanguage],
            'local',
            localResult
          );

          // Online provider supports the target language
          const onlineProvider = createMockProvider(
            'online-provider',
            [targetLanguage],
            'online',
            onlineResult
          );

          service.registerProvider(localProvider, 'local');
          service.registerProvider(onlineProvider, 'online');

          const result = await service.lookup(word, targetLanguage, 'some context text', 0);

          // Local provider should NOT be called (doesn't support the language)
          expect(localProvider.lookup).not.toHaveBeenCalled();

          // Online provider SHOULD be called
          expect(onlineProvider.lookup).toHaveBeenCalled();

          // Result should come from online
          expect(result.definitions).toEqual(onlineResult.definitions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('local provider result is returned immediately when word is misspelled (no online fallback)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,20}$/),
        fc.constantFrom('en', 'fr', 'de', 'es'),
        fc.array(fc.stringMatching(/^[a-zA-Z]{2,10}$/), { minLength: 1, maxLength: 8 }),
        async (word, language, suggestions) => {
          const service = new DictionaryService();

          const localResult: DictionaryResult = {
            word,
            language,
            definitions: [],
            spellCheck: { correct: false, suggestions },
          };

          const onlineResult: DictionaryResult = {
            word,
            language,
            definitions: [{ meaning: 'should not be reached' }],
          };

          const localProvider = createMockProvider(
            'hunspell-local',
            [language],
            'local',
            localResult
          );

          const onlineProvider = createMockProvider(
            'free-dictionary-api',
            [language],
            'online',
            onlineResult
          );

          service.registerProvider(localProvider, 'local');
          service.registerProvider(onlineProvider, 'online');

          const result = await service.lookup(word, language, 'test context', 0);

          // The returned result must be the misspelled local result
          expect(result.word).toBe(word);
          expect(result.language).toBe(language);
          expect(result.spellCheck).toBeDefined();
          expect(result.spellCheck!.correct).toBe(false);

          // Online must not be queried
          expect(onlineProvider.lookup).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('online is queried when no local provider exists at all', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,20}$/),
        fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt'),
        async (word, language) => {
          const service = new DictionaryService();

          const onlineResult: DictionaryResult = {
            word,
            language,
            definitions: [{ meaning: 'definition from online', partOfSpeech: 'noun' }],
          };

          const onlineProvider = createMockProvider(
            'online-provider',
            [language],
            'online',
            onlineResult
          );

          // Only register online provider, no local at all
          service.registerProvider(onlineProvider, 'online');

          const result = await service.lookup(word, language, 'some text', 0);

          // Online provider should be called
          expect(onlineProvider.lookup).toHaveBeenCalled();

          // Result should contain the online definitions
          expect(result.definitions).toEqual(onlineResult.definitions);
        }
      ),
      { numRuns: 100 }
    );
  });
});
