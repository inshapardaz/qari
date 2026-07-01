/**
 * Property 2: Zoom step correctness
 *
 * Validates: Requirements 3.2, 3.3
 *
 * Tests that for any current zoom level within the valid range (50–300%),
 * clicking zoom in produces min(current + 25, 300) and clicking zoom out
 * produces max(current - 25, 50).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { clampLightboxZoom } from '../ImageLightbox';

/**
 * Generator for valid zoom levels: multiples of 25 in range [50, 300].
 * This corresponds to fc.integer({min: 2, max: 12}).map(n => n * 25),
 * yielding values: 50, 75, 100, ..., 275, 300.
 */
const validZoomLevel = fc.integer({ min: 2, max: 12 }).map(n => n * 25);

describe('Property 2: Zoom step correctness', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any valid zoom level, zoom in produces min(current + 25, 300).
   */
  it('zoom in produces min(current + 25, 300) from any valid level', () => {
    fc.assert(
      fc.property(validZoomLevel, (level) => {
        const result = clampLightboxZoom(level + 25);
        const expected = Math.min(level + 25, 300);
        expect(result).toBe(expected);
      }),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * For any valid zoom level, zoom out produces max(current - 25, 50).
   */
  it('zoom out produces max(current - 25, 50) from any valid level', () => {
    fc.assert(
      fc.property(validZoomLevel, (level) => {
        const result = clampLightboxZoom(level - 25);
        const expected = Math.max(level - 25, 50);
        expect(result).toBe(expected);
      }),
      { numRuns: 150 }
    );
  });
});
