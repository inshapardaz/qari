/**
 * Properties 1, 2, 3: Word extraction correctness
 *
 * Property 1: Word extraction position correctness
 * For any text body and any valid word position within it, extracting the word
 * at that position SHALL return a non-empty string that exactly matches the
 * characters at that position in the text.
 *
 * Property 2: Multi-word selection yields first token
 * For any string containing two or more whitespace-separated words, the word
 * extraction function SHALL return only the first whitespace-delimited token.
 *
 * Property 3: Whitespace-only selection rejection
 * For any string composed entirely of whitespace characters (spaces, tabs,
 * newlines, or empty string), the selection handler SHALL indicate that no
 * lookup should be triggered (returns null).
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * Feature: language-dictionaries, Property 1: Word extraction position correctness
 * Feature: language-dictionaries, Property 2: Multi-word selection yields first token
 * Feature: language-dictionaries, Property 3: Whitespace-only selection rejection
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractFirstWord } from '../useSelectionHandler';

describe('Feature: language-dictionaries, Property 1: Word extraction position correctness', () => {
  it('extracted word matches the first token at the expected position in the text', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty word (no whitespace)
        fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
        // Generate optional leading whitespace
        fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }),
        // Generate optional trailing content (whitespace + more words)
        fc.stringOf(
          fc.constantFrom(' ', '\t', 'a', 'b', 'c', 'x', 'y', 'z'),
          { minLength: 0, maxLength: 30 }
        ),
        (word, leadingSpace, trailing) => {
          // Construct a text body: leading whitespace + word + trailing content
          const text = leadingSpace + word + trailing;

          const result = extractFirstWord(text);

          // The extracted word should be the first whitespace-delimited token
          // after trimming leading whitespace
          const expectedFirstToken = text.trim().split(/\s+/)[0];

          expect(result).not.toBeNull();
          expect(result).toBe(expectedFirstToken);

          // The result should be found within the original text
          expect(text).toContain(result!);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('extractFirstWord on a substring containing a word returns that word', () => {
    fc.assert(
      fc.property(
        // Generate multiple words separated by spaces
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,15}$/), { minLength: 1, maxLength: 10 }),
        // Pick an index to select a word from
        fc.nat(),
        (words, indexSeed) => {
          const text = words.join(' ');
          const index = indexSeed % words.length;
          const targetWord = words[index];

          // Find the position of the target word in the text
          let position = 0;
          for (let i = 0; i < index; i++) {
            position += words[i].length + 1; // +1 for the space
          }

          // Extract from a substring starting at the target word's position
          const substring = text.slice(position);
          const result = extractFirstWord(substring);

          expect(result).not.toBeNull();
          expect(result).toBe(targetWord);

          // Verify the word appears at the expected position in the original text
          expect(text.indexOf(targetWord, position)).toBe(position);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: language-dictionaries, Property 2: Multi-word selection yields first token', () => {
  it('returns only the first whitespace-delimited token from multi-word strings', () => {
    fc.assert(
      fc.property(
        // Generate at least 2 non-empty words (no internal whitespace)
        fc.array(fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/), { minLength: 2, maxLength: 10 }),
        // Generate whitespace separator types
        fc.array(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 3 }),
          { minLength: 1, maxLength: 9 }
        ),
        (words, separators) => {
          // Join the words with the generated separators
          let multiWordString = words[0];
          for (let i = 1; i < words.length; i++) {
            const sep = separators[(i - 1) % separators.length];
            multiWordString += sep + words[i];
          }

          const result = extractFirstWord(multiWordString);

          // Should return only the first word
          expect(result).not.toBeNull();
          expect(result).toBe(words[0]);

          // Verify it did NOT return the full string (unless there was only 1 word somehow)
          if (words.length > 1) {
            expect(result).not.toBe(multiWordString.trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('first token is stable regardless of how many additional words follow', () => {
    fc.assert(
      fc.property(
        // First word
        fc.stringMatching(/^[a-zA-Z]{1,15}$/),
        // Additional words (at least 1)
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,15}$/), { minLength: 1, maxLength: 20 }),
        (firstWord, additionalWords) => {
          // Build strings with varying numbers of additional words
          const fullString = [firstWord, ...additionalWords].join(' ');
          const partialString = firstWord + ' ' + additionalWords[0];

          const resultFull = extractFirstWord(fullString);
          const resultPartial = extractFirstWord(partialString);

          // Both should return the same first word
          expect(resultFull).toBe(firstWord);
          expect(resultPartial).toBe(firstWord);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: language-dictionaries, Property 3: Whitespace-only selection rejection', () => {
  it('returns null for whitespace-only strings', () => {
    fc.assert(
      fc.property(
        // Generate strings composed entirely of whitespace characters
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { minLength: 1, maxLength: 50 }),
        (whitespaceString) => {
          const result = extractFirstWord(whitespaceString);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null for empty string', () => {
    const result = extractFirstWord('');
    expect(result).toBeNull();
  });

  it('returns null for various whitespace combinations', () => {
    fc.assert(
      fc.property(
        // Generate whitespace-only strings of varying composition
        fc.nat({ max: 30 }),
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }),
        (repeatCount, chars) => {
          // Build whitespace string by repeating characters
          let whitespaceString = '';
          for (let i = 0; i <= repeatCount; i++) {
            whitespaceString += chars[i % chars.length];
          }

          const result = extractFirstWord(whitespaceString);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
