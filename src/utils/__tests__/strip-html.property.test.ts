/**
 * Property 11: HTML tag stripping is correct and idempotent
 *
 * Feature: language-dictionaries, Property 11: HTML tag stripping is correct and idempotent
 *
 * Validates: Requirements 5.8
 *
 * For any string containing HTML tags, the strip function SHALL remove all HTML tags
 * (content between `<` and `>` that forms valid tag syntax) and SHALL preserve all text
 * content that is not part of a tag. Applying the strip function twice SHALL produce
 * the same result as applying it once (idempotence).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { stripHtmlTags } from '../strip-html';

/**
 * Generates a random HTML tag (opening, closing, or self-closing).
 */
const htmlTagArb = fc.oneof(
  // Opening tag with optional attributes
  fc.record({
    tagName: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 6 }),
    attrs: fc.string({ minLength: 0, maxLength: 20 }).map((s) => s.replace(/[<>]/g, '')),
  }).map(({ tagName, attrs }) => attrs ? `<${tagName} ${attrs}>` : `<${tagName}>`),
  // Closing tag
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 6 })
    .map((name) => `</${name}>`),
  // Self-closing tag
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 6 })
    .map((name) => `<${name} />`),
);

/**
 * Generates a text segment that does not contain `<` or `>` characters.
 */
const textSegmentArb = fc.string({ minLength: 0, maxLength: 30 }).map((s) => s.replace(/[<>]/g, ''));

/**
 * Generates a string composed of interleaved text segments and HTML tags.
 */
const htmlStringArb = fc.array(
  fc.oneof(
    textSegmentArb,
    htmlTagArb,
  ),
  { minLength: 1, maxLength: 10 }
).map((parts) => parts.join(''));

describe('Property 11: HTML tag stripping is correct and idempotent', () => {
  /**
   * **Validates: Requirements 5.8**
   *
   * For any string with HTML tags, applying stripHtmlTags removes all HTML tags
   * and the result contains no `<...>` patterns that resemble tags.
   */
  it('removes all HTML tags from generated strings', () => {
    fc.assert(
      fc.property(htmlStringArb, (input) => {
        const result = stripHtmlTags(input);

        // The result should not contain any HTML tags (no < followed by >)
        expect(result).not.toMatch(/<[^>]*>/);
      }),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 5.8**
   *
   * Applying stripHtmlTags twice produces the same result as applying it once (idempotence).
   */
  it('is idempotent: applying strip twice equals applying once', () => {
    fc.assert(
      fc.property(htmlStringArb, (input) => {
        const once = stripHtmlTags(input);
        const twice = stripHtmlTags(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 5.8**
   *
   * Text content between HTML tags is preserved in the output. Given known text
   * segments interleaved with tags, all text segments appear in the stripped result.
   */
  it('preserves all text content that is not part of a tag', () => {
    fc.assert(
      fc.property(
        fc.array(textSegmentArb, { minLength: 1, maxLength: 5 }),
        fc.array(htmlTagArb, { minLength: 1, maxLength: 5 }),
        (textParts, tags) => {
          // Interleave text segments with tags: text[0] + tag[0] + text[1] + tag[1] + ...
          let html = '';
          const maxLen = Math.max(textParts.length, tags.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < textParts.length) html += textParts[i];
            if (i < tags.length) html += tags[i];
          }

          const result = stripHtmlTags(html);

          // Every text segment should appear in the result, concatenated in order
          const expectedText = textParts.join('');
          expect(result).toBe(expectedText);
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 5.8**
   *
   * Strings without any HTML tags are returned unchanged by stripHtmlTags.
   */
  it('returns plain text strings unchanged', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).map((s) => s.replace(/[<>]/g, '')),
        (plainText) => {
          const result = stripHtmlTags(plainText);
          expect(result).toBe(plainText);
        }
      ),
      { numRuns: 150 }
    );
  });
});
