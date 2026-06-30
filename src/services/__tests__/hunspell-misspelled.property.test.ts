/**
 * Property 13: Hunspell misspelled words return capped suggestions
 *
 * For any word that the nspell instance reports as incorrectly spelled,
 * the HunspellProvider SHALL return a DictionaryResult with `spellCheck.correct`
 * set to false and `spellCheck.suggestions` containing at most 10 entries
 * from nspell's suggest output.
 *
 * **Validates: Requirements 6.9, 9.3**
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

describe('Feature: language-dictionaries, Property 13: Hunspell misspelled words return capped suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('misspelled words return spellCheck.correct = false with suggestions capped at 10', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random word (non-empty alphabetic to avoid edge cases)
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        // Generate a random number of suggestions (0 to 30)
        fc.integer({ min: 0, max: 30 }),
        async (word, suggestionCount) => {
          // Generate suggestion strings
          const allSuggestions = Array.from(
            { length: suggestionCount },
            (_, i) => `suggestion_${i}`
          );

          // Mock the nspell constructor to return a mock instance
          const mockSpeller = {
            correct: vi.fn().mockReturnValue(false),
            suggest: vi.fn().mockReturnValue(allSuggestions),
          };
          vi.mocked(NSpell).mockReturnValue(mockSpeller as unknown as InstanceType<typeof NSpell>);

          // Create a HunspellProvider with buffer data
          const aff = Buffer.from('SET UTF-8\n');
          const dic = Buffer.from('1\ntest\n');
          const provider = new HunspellProvider({
            language: 'en',
            aff,
            dic,
          });

          const result = await provider.lookup(word, 'en', 'some context');

          // spellCheck.correct should be false
          expect(result.spellCheck).toBeDefined();
          expect(result.spellCheck!.correct).toBe(false);

          // Suggestions should be capped at 10
          expect(result.spellCheck!.suggestions.length).toBeLessThanOrEqual(10);

          // If nspell returned more than 10 suggestions, we get exactly 10
          if (suggestionCount > 10) {
            expect(result.spellCheck!.suggestions.length).toBe(10);
          } else {
            expect(result.spellCheck!.suggestions.length).toBe(suggestionCount);
          }

          // The suggestions should be the first N entries from nspell's output
          const expectedSuggestions = allSuggestions.slice(0, 10);
          expect(result.spellCheck!.suggestions).toEqual(expectedSuggestions);

          // notFound should be false (the word was processed, just misspelled)
          expect(result.notFound).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('misspelled words never exceed MAX_SUGGESTIONS (10) regardless of nspell output size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        // Generate large suggestion arrays (11 to 100)
        fc.integer({ min: 11, max: 100 }),
        async (word, suggestionCount) => {
          const allSuggestions = Array.from(
            { length: suggestionCount },
            (_, i) => `word_${i}`
          );

          const mockSpeller = {
            correct: vi.fn().mockReturnValue(false),
            suggest: vi.fn().mockReturnValue(allSuggestions),
          };
          vi.mocked(NSpell).mockReturnValue(mockSpeller as unknown as InstanceType<typeof NSpell>);

          const aff = Buffer.from('SET UTF-8\n');
          const dic = Buffer.from('1\ntest\n');
          const provider = new HunspellProvider({
            language: 'en',
            aff,
            dic,
          });

          const result = await provider.lookup(word, 'en', '');

          expect(result.spellCheck!.suggestions.length).toBe(10);
          // Verify it's the first 10 from nspell's output
          expect(result.spellCheck!.suggestions).toEqual(allSuggestions.slice(0, 10));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('suggestions array preserves order from nspell output', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,30}$/),
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,20}$/), { minLength: 1, maxLength: 25 }),
        async (word, suggestions) => {
          const mockSpeller = {
            correct: vi.fn().mockReturnValue(false),
            suggest: vi.fn().mockReturnValue(suggestions),
          };
          vi.mocked(NSpell).mockReturnValue(mockSpeller as unknown as InstanceType<typeof NSpell>);

          const aff = Buffer.from('SET UTF-8\n');
          const dic = Buffer.from('1\ntest\n');
          const provider = new HunspellProvider({
            language: 'en',
            aff,
            dic,
          });

          const result = await provider.lookup(word, 'en', '');

          const expected = suggestions.slice(0, 10);
          expect(result.spellCheck!.suggestions).toEqual(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
