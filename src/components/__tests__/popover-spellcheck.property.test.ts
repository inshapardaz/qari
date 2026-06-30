/**
 * Property 14: Spell-check UI display and accessibility
 *
 * Feature: language-dictionaries, Property 14: Spell-check UI display and accessibility
 *
 * Validates: Requirements 2.6, 9.4, 13.5
 *
 * For any DictionaryResult containing a spellCheck field, the DictionaryPopover SHALL
 * display a checkmark icon when correct is true, and a warning icon with a list of
 * suggestions when correct is false. When suggestions are present, they SHALL be rendered
 * as an accessible list with aria-label="Spelling suggestions".
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';

import { DictionaryPopover } from '../../components/DictionaryPopover';
import type { DictionaryLookupResult } from '../../services/dictionary-service';

/**
 * Generator for non-empty word strings.
 */
const wordArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0);

/**
 * Generator for suggestion strings (non-empty, trimmed).
 */
const suggestionArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

describe('Property 14: Spell-check UI display and accessibility', () => {
  /**
   * **Validates: Requirements 2.6, 9.4**
   *
   * When spellCheck.correct === true, the component SHALL render
   * a checkmark icon (data-testid="spellcheck-correct") and SHALL NOT
   * render a warning icon.
   */
  it('renders checkmark icon when spellCheck.correct === true', () => {
    fc.assert(
      fc.property(
        wordArb,
        (word) => {
          const lookupResult: DictionaryLookupResult = {
            word,
            language: 'en',
            definitions: [],
            spellCheck: { correct: true, suggestions: [] },
          };

          const { container } = render(
            React.createElement(DictionaryPopover, {
              lookupResult,
              visible: true,
            })
          );

          const correctIcon = container.querySelector('[data-testid="spellcheck-correct"]');
          expect(correctIcon).not.toBeNull();
          expect(correctIcon!.textContent).toContain('✓');

          // Should NOT render the incorrect/warning icon
          const incorrectIcon = container.querySelector('[data-testid="spellcheck-incorrect"]');
          expect(incorrectIcon).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.6, 9.4**
   *
   * When spellCheck.correct === false, the component SHALL render
   * a warning icon (data-testid="spellcheck-incorrect") and SHALL NOT
   * render a checkmark icon.
   */
  it('renders warning icon when spellCheck.correct === false', () => {
    fc.assert(
      fc.property(
        wordArb,
        fc.array(suggestionArb, { minLength: 0, maxLength: 10 }),
        (word, suggestions) => {
          const lookupResult: DictionaryLookupResult = {
            word,
            language: 'en',
            definitions: [],
            spellCheck: { correct: false, suggestions },
          };

          const { container } = render(
            React.createElement(DictionaryPopover, {
              lookupResult,
              visible: true,
            })
          );

          // Should render the warning icon
          const incorrectIcon = container.querySelector('[data-testid="spellcheck-incorrect"]');
          expect(incorrectIcon).not.toBeNull();
          expect(incorrectIcon!.textContent).toContain('⚠');

          // Should NOT render the correct/checkmark icon
          const correctIcon = container.querySelector('[data-testid="spellcheck-correct"]');
          expect(correctIcon).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.4, 13.5**
   *
   * When spellCheck.correct === false and suggestions are present (length > 0),
   * the suggestions SHALL be rendered as an accessible list with
   * aria-label="Spelling suggestions", and each suggestion SHALL be displayed
   * with the correct data-testid.
   */
  it('renders accessible suggestions list with correct content when suggestions present', () => {
    fc.assert(
      fc.property(
        wordArb,
        fc.array(suggestionArb, { minLength: 1, maxLength: 10 }),
        (word, suggestions) => {
          const lookupResult: DictionaryLookupResult = {
            word,
            language: 'en',
            definitions: [],
            spellCheck: { correct: false, suggestions },
          };

          const { container } = render(
            React.createElement(DictionaryPopover, {
              lookupResult,
              visible: true,
            })
          );

          // Suggestions list should be present
          const suggestionsList = container.querySelector('[data-testid="spelling-suggestions"]');
          expect(suggestionsList).not.toBeNull();

          // Must have aria-label="Spelling suggestions" for accessibility
          expect(suggestionsList!.getAttribute('aria-label')).toBe('Spelling suggestions');

          // Verify each suggestion is rendered at the correct index
          for (let i = 0; i < suggestions.length; i++) {
            const suggestionEl = container.querySelector(`[data-testid="suggestion-${i}"]`);
            expect(suggestionEl).not.toBeNull();
            expect(suggestionEl!.textContent).toBe(suggestions[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * When spellCheck.correct === false but suggestions array is empty,
   * the suggestions list element SHALL NOT be rendered (no empty list in DOM).
   */
  it('does not render suggestions list when incorrect with empty suggestions', () => {
    fc.assert(
      fc.property(
        wordArb,
        (word) => {
          const lookupResult: DictionaryLookupResult = {
            word,
            language: 'en',
            definitions: [],
            spellCheck: { correct: false, suggestions: [] },
          };

          const { container } = render(
            React.createElement(DictionaryPopover, {
              lookupResult,
              visible: true,
            })
          );

          // Warning icon should still be present
          const incorrectIcon = container.querySelector('[data-testid="spellcheck-incorrect"]');
          expect(incorrectIcon).not.toBeNull();

          // But no suggestions list should be rendered
          const suggestionsList = container.querySelector('[data-testid="spelling-suggestions"]');
          expect(suggestionsList).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
