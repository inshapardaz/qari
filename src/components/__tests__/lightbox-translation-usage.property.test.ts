/**
 * Property 5: Translation string usage
 *
 * Validates: Requirements 6.1
 *
 * For any set of translation strings provided via TranslationContext, the
 * lightbox close button's aria-label SHALL equal the provided `lightboxClose`
 * string, the zoom in button's aria-label SHALL equal the provided
 * `lightboxZoomIn` string, and the zoom out button's aria-label SHALL equal
 * the provided `lightboxZoomOut` string.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../../i18n';
import { ImageLightbox } from '../ImageLightbox';

describe('Property 5: Translation string usage', () => {
  /**
   * **Validates: Requirements 6.1**
   *
   * For any non-empty translation strings, the lightbox buttons use those
   * exact strings as aria-labels.
   */
  it('lightbox buttons use provided translation strings for aria-labels', () => {
    const translationString = fc.stringMatching(/^[A-Za-z ]{1,50}$/);

    fc.assert(
      fc.property(
        translationString,
        translationString,
        translationString,
        (closeLabel, zoomInLabel, zoomOutLabel) => {
          cleanup();

          const translations = {
            ...DEFAULT_TRANSLATIONS,
            lightboxClose: closeLabel,
            lightboxZoomIn: zoomInLabel,
            lightboxZoomOut: zoomOutLabel,
          };

          const { getByTestId, unmount } = render(
            React.createElement(
              TranslationContext.Provider,
              { value: translations },
              React.createElement(ImageLightbox, {
                src: 'https://example.com/image.png',
                alt: 'Test image',
                onClose: vi.fn(),
              })
            )
          );

          const closeBtn = getByTestId('lightbox-close-btn');
          const zoomInBtn = getByTestId('lightbox-zoom-in-btn');
          const zoomOutBtn = getByTestId('lightbox-zoom-out-btn');

          expect(closeBtn.getAttribute('aria-label')).toBe(closeLabel);
          expect(zoomInBtn.getAttribute('aria-label')).toBe(zoomInLabel);
          expect(zoomOutBtn.getAttribute('aria-label')).toBe(zoomOutLabel);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 6.1**
   *
   * The lightbox dialog uses the provided lightboxLabel translation as its
   * aria-label.
   */
  it('lightbox dialog uses the provided lightboxLabel translation', () => {
    const translationString = fc.stringMatching(/^[A-Za-z ]{1,50}$/);

    fc.assert(
      fc.property(
        translationString,
        (dialogLabel) => {
          cleanup();

          const translations = {
            ...DEFAULT_TRANSLATIONS,
            lightboxLabel: dialogLabel,
          };

          const { getByTestId, unmount } = render(
            React.createElement(
              TranslationContext.Provider,
              { value: translations },
              React.createElement(ImageLightbox, {
                src: 'https://example.com/image.png',
                alt: 'Test image',
                onClose: vi.fn(),
              })
            )
          );

          const dialog = getByTestId('image-lightbox');
          expect(dialog.getAttribute('aria-label')).toBe(dialogLabel);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
