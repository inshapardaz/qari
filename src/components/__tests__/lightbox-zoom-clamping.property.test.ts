/**
 * Property 3: Zoom clamping invariant
 *
 * Validates: Requirements 3.4, 3.5
 *
 * Tests that for any sequence of zoom operations (zoom in or zoom out, in any
 * order and any count), the resulting zoom level is always within [50, 300]
 * inclusive and always a multiple of 25.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { clampLightboxZoom } from '../ImageLightbox';

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;
const DEFAULT_ZOOM = 100;

/**
 * Simulates a sequence of zoom operations starting from default zoom (100%).
 * Each operation is either a zoom in (+25) or zoom out (-25), clamped after each step.
 */
function simulateZoomSequence(operations: ('in' | 'out')[]): number {
  let zoom = DEFAULT_ZOOM;
  for (const op of operations) {
    if (op === 'in') {
      zoom = clampLightboxZoom(zoom + ZOOM_STEP);
    } else {
      zoom = clampLightboxZoom(zoom - ZOOM_STEP);
    }
  }
  return zoom;
}

describe('Property 3: Zoom clamping invariant', () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * For any sequence of zoom in/out operations starting from default (100%),
   * the resulting zoom level is always in [50, 300] and a multiple of 25.
   */
  it('any sequence of zoom operations produces a value in [50, 300] that is a multiple of 25', () => {
    const zoomOp = fc.constantFrom('in' as const, 'out' as const);

    fc.assert(
      fc.property(
        fc.array(zoomOp, { minLength: 0, maxLength: 50 }),
        (operations) => {
          const result = simulateZoomSequence(operations);

          // Result must be within [50, 300]
          expect(result).toBeGreaterThanOrEqual(MIN_ZOOM);
          expect(result).toBeLessThanOrEqual(MAX_ZOOM);

          // Result must be a multiple of 25
          expect(result % ZOOM_STEP).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * For any arbitrary numeric input, clampLightboxZoom always produces a value
   * in [50, 300] that is a multiple of 25.
   */
  it('clampLightboxZoom produces values in [50, 300] and multiples of 25 for any arbitrary input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const result = clampLightboxZoom(input);

          // Result must be within [50, 300]
          expect(result).toBeGreaterThanOrEqual(MIN_ZOOM);
          expect(result).toBeLessThanOrEqual(MAX_ZOOM);

          // Result must be a multiple of 25
          expect(result % ZOOM_STEP).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * clampLightboxZoom is idempotent: applying it twice yields the same result
   * as applying it once. This ensures stability of clamped values.
   */
  it('clampLightboxZoom is idempotent', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const once = clampLightboxZoom(input);
          const twice = clampLightboxZoom(once);
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 200 }
    );
  });
});
