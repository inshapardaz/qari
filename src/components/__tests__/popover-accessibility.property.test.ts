/**
 * Property 16: Accessible aria-label contains looked-up word
 *
 * Feature: language-dictionaries, Property 16: Accessible aria-label contains looked-up word
 *
 * Validates: Requirements 13.3
 *
 * For any non-empty word passed to the DictionaryPopover, the rendered element's
 * aria-label attribute SHALL contain that word string.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

import { DictionaryPopover } from '../DictionaryPopover';
import type { DictionaryLookupResult } from '../../services/dictionary-service';

describe('Feature: language-dictionaries, Property 16: Accessible aria-label contains looked-up word', () => {
  afterEach(() => {
    cleanup();
  });

  /**
   * **Validates: Requirements 13.3**
   *
   * For any non-empty alphanumeric word string, the DictionaryPopover's dialog element
   * SHALL have an aria-label attribute that contains the looked-up word.
   */
  it('rendered dialog aria-label contains the looked-up word', () => {
    fc.assert(
      fc.property(
        // Generate simple alphanumeric word strings (avoid HTML special chars)
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 1, maxLength: 50 }),
        (word) => {
          const lookupResult: DictionaryLookupResult = {
            word,
            language: 'en',
            definitions: [{ meaning: 'test' }],
          };

          const { container } = render(
            React.createElement(DictionaryPopover, {
              lookupResult,
              visible: true,
            })
          );

          const dialog = container.querySelector('[role="dialog"]');
          expect(dialog).not.toBeNull();

          const ariaLabel = dialog!.getAttribute('aria-label');
          expect(ariaLabel).not.toBeNull();
          expect(ariaLabel).toContain(word);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
