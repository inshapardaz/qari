/**
 * Property 4: Popover renders all DictionaryResult fields
 *
 * Feature: language-dictionaries, Property 4: Popover renders all DictionaryResult fields
 *
 * Validates: Requirements 2.2
 *
 * For any valid DictionaryResult with at least one definition, the rendered popover
 * output SHALL contain the word, the language, and every definition's meaning.
 * For each definition that includes a partOfSpeech, that value SHALL appear in the output.
 * For each definition that includes examples, those example strings SHALL appear in the output.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import React from 'react';
import { MantineProvider } from '@mantine/core';

import { DictionaryPopover } from '../../components/DictionaryPopover';
import type { DictionaryLookupResult } from '../../services/dictionary-service';

/** DictionaryPopover now uses Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => React.createElement(MantineProvider, { env: 'test' }, children),
    ...options,
  });
}
import type { Definition } from '../../interfaces/dictionary';

/**
 * Generator for a simple alphanumeric string (no special characters)
 * to ensure clean matching in DOM text content.
 */
const simpleStringArb = (minLength = 1, maxLength = 20) =>
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength, maxLength });

/**
 * Generator for a Definition object with optional partOfSpeech and examples.
 */
const definitionArb: fc.Arbitrary<Definition> = fc.record({
  meaning: simpleStringArb(3, 40),
  partOfSpeech: fc.option(simpleStringArb(3, 15), { nil: undefined }),
  examples: fc.option(
    fc.array(simpleStringArb(5, 30), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
  source: fc.option(simpleStringArb(3, 20), { nil: undefined }),
});

/**
 * Generator for a valid DictionaryLookupResult with at least one definition
 * and notFound set to false so definitions render.
 */
const dictionaryResultArb: fc.Arbitrary<DictionaryLookupResult> = fc.record({
  word: simpleStringArb(2, 20),
  language: simpleStringArb(2, 5),
  definitions: fc.array(definitionArb, { minLength: 1, maxLength: 5 }),
  notFound: fc.constant(false),
});

describe('Property 4: Popover renders all DictionaryResult fields', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any valid DictionaryResult with at least one definition, the rendered popover
   * SHALL display the word, language, and every definition's meaning.
   * partOfSpeech and examples SHALL appear when present.
   */
  it('renders word, language, and all definition fields', () => {
    fc.assert(
      fc.property(dictionaryResultArb, (result) => {
        const { container } = render(
          React.createElement(DictionaryPopover, {
            lookupResult: result,
            visible: true,
          })
        );

        // Verify word is rendered
        const wordEl = container.querySelector('[data-testid="dictionary-word"]');
        expect(wordEl).not.toBeNull();
        expect(wordEl!.textContent).toBe(result.word);

        // Verify language is rendered
        const langEl = container.querySelector('[data-testid="dictionary-language"]');
        expect(langEl).not.toBeNull();
        expect(langEl!.textContent).toContain(result.language);

        // Verify each definition's meaning is rendered
        result.definitions.forEach((def, index) => {
          const meaningEl = container.querySelector(
            `[data-testid="dictionary-meaning-${index}"]`
          );
          expect(meaningEl).not.toBeNull();
          expect(meaningEl!.textContent).toBe(def.meaning);

          // Verify partOfSpeech appears when present
          if (def.partOfSpeech) {
            const posEl = container.querySelector(
              `[data-testid="dictionary-pos-${index}"]`
            );
            expect(posEl).not.toBeNull();
            expect(posEl!.textContent).toBe(def.partOfSpeech);
          }

          // Verify examples appear when present
          if (def.examples && def.examples.length > 0) {
            const examplesEl = container.querySelector(
              `[data-testid="dictionary-examples-${index}"]`
            );
            expect(examplesEl).not.toBeNull();
            def.examples.forEach((example) => {
              expect(examplesEl!.textContent).toContain(example);
            });
          }

          // Verify source (dictionary name) appears when present
          if (def.source) {
            const sourceEl = container.querySelector(
              `[data-testid="dictionary-source-${index}"]`
            );
            expect(sourceEl).not.toBeNull();
            expect(sourceEl!.textContent).toBe(def.source);
          }
        });
      }),
      { numRuns: 100 }
    );
  });
});
