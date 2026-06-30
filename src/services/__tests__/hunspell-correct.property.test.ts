/**
 * Property 12: Hunspell correct words return valid result
 *
 * For any word that the nspell instance reports as correctly spelled,
 * the HunspellProvider SHALL return a DictionaryResult with `notFound`
 * set to false and a `spellCheck` field with `correct: true` and an
 * empty `suggestions` array.
 *
 * **Validates: Requirements 6.10, 9.2**
 *
 * Feature: language-dictionaries, Property 12: Hunspell correct words return valid result
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock nspell before importing HunspellProvider
vi.mock('nspell', () => {
  return {
    default: vi.fn(),
  };
});

import NSpell from 'nspell';
import { HunspellProvider } from '../hunspell-provider';

describe('Feature: language-dictionaries, Property 12: Hunspell correct words return valid result', () => {
  const mockCorrect = vi.fn().mockReturnValue(true);
  const mockSuggest = vi.fn().mockReturnValue([]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCorrect.mockReturnValue(true);
    mockSuggest.mockReturnValue([]);

    (NSpell as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      correct: mockCorrect,
      suggest: mockSuggest,
    }));
  });

  it('correctly spelled words return notFound: false, spellCheck.correct: true, empty suggestions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random non-empty word-like strings
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        fc.constantFrom('en', 'fr', 'de', 'es', 'it'),
        async (word, language) => {
          mockCorrect.mockReturnValue(true);

          const provider = new HunspellProvider({
            language,
            aff: Buffer.from('SET UTF-8'),
            dic: Buffer.from('1\ntest'),
          });

          const result = await provider.lookup(word, language, '');

          // notFound must be false
          expect(result.notFound).toBe(false);

          // spellCheck must exist with correct: true
          expect(result.spellCheck).toBeDefined();
          expect(result.spellCheck!.correct).toBe(true);

          // suggestions must be empty
          expect(result.spellCheck!.suggestions).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result word field matches the input word', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        async (word) => {
          mockCorrect.mockReturnValue(true);

          const provider = new HunspellProvider({
            language: 'en',
            aff: Buffer.from('SET UTF-8'),
            dic: Buffer.from('1\ntest'),
          });

          const result = await provider.lookup(word, 'en', '');

          expect(result.word).toBe(word);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result language field matches the input language', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        fc.constantFrom('en', 'fr', 'de', 'es', 'it', 'pt', 'ru'),
        async (word, language) => {
          mockCorrect.mockReturnValue(true);

          const provider = new HunspellProvider({
            language,
            aff: Buffer.from('SET UTF-8'),
            dic: Buffer.from('1\ntest'),
          });

          const result = await provider.lookup(word, language, '');

          expect(result.language).toBe(language);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('nspell.correct is called with the input word', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        async (word) => {
          mockCorrect.mockReturnValue(true);

          const provider = new HunspellProvider({
            language: 'en',
            aff: Buffer.from('SET UTF-8'),
            dic: Buffer.from('1\ntest'),
          });

          await provider.lookup(word, 'en', '');

          expect(mockCorrect).toHaveBeenCalledWith(word);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('suggest is never called when word is correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        async (word) => {
          mockCorrect.mockReturnValue(true);
          mockSuggest.mockClear();

          const provider = new HunspellProvider({
            language: 'en',
            aff: Buffer.from('SET UTF-8'),
            dic: Buffer.from('1\ntest'),
          });

          await provider.lookup(word, 'en', '');

          expect(mockSuggest).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
