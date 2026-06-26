/**
 * Property 10: Dictionary Context Extraction
 *
 * For any word at any position within a text body, the context passed to
 * the dictionary provider SHALL contain up to 200 characters before and
 * up to 200 characters after the selected word, bounded by the text
 * boundaries (no out-of-bounds access).
 *
 * **Validates: Requirements 7.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DictionaryService } from '../dictionary-service';

describe('Property 10: Dictionary Context Extraction', () => {
  const service = new DictionaryService();

  it('context starts no earlier than max(0, wordPosition - 200)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }),
        fc.nat(),
        fc.integer({ min: 1, max: 20 }),
        (text, rawPosition, wordLength) => {
          // Clamp wordPosition within valid range
          const wordPosition = rawPosition % text.length;
          const clampedWordLength = Math.min(wordLength, text.length - wordPosition);

          const context = service.extractContext(text, wordPosition, clampedWordLength);

          // The context should start no earlier than max(0, wordPosition - 200)
          const expectedStart = Math.max(0, wordPosition - 200);
          const expectedEnd = Math.min(text.length, wordPosition + clampedWordLength + 200);

          // Context must be a substring starting at expectedStart
          expect(context).toBe(text.slice(expectedStart, expectedEnd));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('context ends no later than min(text.length, wordPosition + wordLength + 200)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }),
        fc.nat(),
        fc.integer({ min: 1, max: 20 }),
        (text, rawPosition, wordLength) => {
          const wordPosition = rawPosition % text.length;
          const clampedWordLength = Math.min(wordLength, text.length - wordPosition);

          const context = service.extractContext(text, wordPosition, clampedWordLength);

          const maxEnd = Math.min(text.length, wordPosition + clampedWordLength + 200);
          const minStart = Math.max(0, wordPosition - 200);
          const expectedLength = maxEnd - minStart;

          expect(context.length).toBe(expectedLength);
          expect(context.length).toBeLessThanOrEqual(400 + clampedWordLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('context always contains the word itself', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }),
        fc.nat(),
        fc.integer({ min: 1, max: 20 }),
        (text, rawPosition, wordLength) => {
          const wordPosition = rawPosition % text.length;
          const clampedWordLength = Math.min(wordLength, text.length - wordPosition);
          const word = text.slice(wordPosition, wordPosition + clampedWordLength);

          const context = service.extractContext(text, wordPosition, clampedWordLength);

          expect(context).toContain(word);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no out-of-bounds access: context length never exceeds 400 + wordLength', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }),
        fc.nat(),
        fc.integer({ min: 1, max: 20 }),
        (text, rawPosition, wordLength) => {
          const wordPosition = rawPosition % text.length;
          const clampedWordLength = Math.min(wordLength, text.length - wordPosition);

          const context = service.extractContext(text, wordPosition, clampedWordLength);

          // Context should never exceed 200 (before) + wordLength + 200 (after)
          expect(context.length).toBeLessThanOrEqual(400 + clampedWordLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles word at the very start of text (position 0)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }),
        fc.integer({ min: 1, max: 20 }),
        (text, wordLength) => {
          const clampedWordLength = Math.min(wordLength, text.length);

          const context = service.extractContext(text, 0, clampedWordLength);

          // At position 0, no chars before, so context starts at 0
          const expectedEnd = Math.min(text.length, clampedWordLength + 200);
          expect(context).toBe(text.slice(0, expectedEnd));
          expect(context.length).toBeLessThanOrEqual(200 + clampedWordLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles word at the very end of text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 2000 }),
        fc.integer({ min: 1, max: 20 }),
        (text, wordLength) => {
          const clampedWordLength = Math.min(wordLength, text.length);
          const wordPosition = text.length - clampedWordLength;

          const context = service.extractContext(text, wordPosition, clampedWordLength);

          // At end of text, context ends at text.length
          const expectedStart = Math.max(0, wordPosition - 200);
          expect(context).toBe(text.slice(expectedStart, text.length));
          expect(context.length).toBeLessThanOrEqual(200 + clampedWordLength);
        }
      ),
      { numRuns: 100 }
    );
  });
});
