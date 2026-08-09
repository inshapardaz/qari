/**
 * Property 7: Translation strings are used for popover accessibility labels
 *
 * Validates: Requirements 8.1, 8.2
 *
 * For any TranslationStrings object with `footnoteClose` and `footnoteDialogLabel`
 * values, the rendered popover close button's `aria-label` SHALL equal `footnoteClose`,
 * and the dialog's `aria-label` SHALL equal `interpolate(footnoteDialogLabel, { label })`.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render as rtlRender, cleanup, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationContext, DEFAULT_TRANSLATIONS, interpolate } from '../../i18n';
import { FootnotePopover } from '../FootnotePopover';
import type { FootnoteRefSpan } from '../../models/book';

/** FootnotePopover now uses Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => React.createElement(MantineProvider, { env: 'test' }, children),
    ...options,
  });
}

describe('Property 7: Translation strings are used for popover accessibility labels', () => {
  /**
   * **Validates: Requirements 8.1, 8.2**
   *
   * For any non-empty translation strings and any footnote label, the close button
   * aria-label equals footnoteClose and the dialog aria-label equals
   * interpolate(footnoteDialogLabel, { label }).
   */
  it('close button aria-label equals footnoteClose and dialog aria-label equals interpolate(footnoteDialogLabel, { label })', () => {
    const translationString = fc.stringMatching(/^[A-Za-z ]{1,50}$/);
    const labelArb = fc.stringMatching(/^[A-Za-z0-9]{1,10}$/);

    fc.assert(
      fc.property(
        translationString,
        translationString,
        labelArb,
        (closeLabel, dialogLabelTemplate, footnoteLabel) => {
          cleanup();

          // Ensure the template contains {label} placeholder
          const dialogTemplate = `${dialogLabelTemplate} {label}`;

          const translations = {
            ...DEFAULT_TRANSLATIONS,
            footnoteClose: closeLabel,
            footnoteDialogLabel: dialogTemplate,
          };

          const footnote: FootnoteRefSpan = {
            type: 'footnote-ref',
            label: footnoteLabel,
            content: [{ type: 'text', content: 'Test content' }],
          };

          const { getByTestId, unmount } = render(
            React.createElement(
              TranslationContext.Provider,
              { value: translations },
              React.createElement(FootnotePopover, {
                footnote,
                visible: true,
                onClose: vi.fn(),
                renderInlineNode: (node: unknown, index: number) =>
                  React.createElement('span', { key: index }, 'node'),
              })
            )
          );

          const closeBtn = getByTestId('footnote-close');
          const dialog = getByTestId('footnote-popover');

          // Close button aria-label equals footnoteClose
          expect(closeBtn.getAttribute('aria-label')).toBe(closeLabel);

          // Dialog aria-label equals interpolate(footnoteDialogLabel, { label })
          const expectedDialogLabel = interpolate(dialogTemplate, { label: footnoteLabel });
          expect(dialog.getAttribute('aria-label')).toBe(expectedDialogLabel);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
