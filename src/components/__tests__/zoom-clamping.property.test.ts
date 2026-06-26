/**
 * Property 5: Zoom Level Clamping and Application
 *
 * Validates: Requirements 4.1, 4.5
 *
 * Tests that clampZoom (from Reader) and snapZoom (from ZoomController) both
 * produce identical results: values clamped to [50, 300] at the nearest 10%
 * increment for any arbitrary numeric input.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { clampZoom } from '../Reader';
import { snapZoom } from '../ZoomController';

describe('Property 5: Zoom Level Clamping and Application', () => {
  /**
   * **Validates: Requirements 4.1, 4.5**
   *
   * For any arbitrary number, clampZoom must return a value in [50, 300]
   * that is a multiple of 10.
   */
  it('clampZoom always returns a value in [50, 300] at a 10% increment', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const result = clampZoom(input);

          // Result must be within [50, 300]
          expect(result).toBeGreaterThanOrEqual(50);
          expect(result).toBeLessThanOrEqual(300);

          // Result must be a multiple of 10 (10% increment)
          expect(result % 10).toBe(0);
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 4.1, 4.5**
   *
   * For any arbitrary number, snapZoom must return a value in [50, 300]
   * that is a multiple of 10.
   */
  it('snapZoom always returns a value in [50, 300] at a 10% increment', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const result = snapZoom(input);

          // Result must be within [50, 300]
          expect(result).toBeGreaterThanOrEqual(50);
          expect(result).toBeLessThanOrEqual(300);

          // Result must be a multiple of 10 (10% increment)
          expect(result % 10).toBe(0);
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 4.1, 4.5**
   *
   * clampZoom and snapZoom produce identical results for any input.
   */
  it('clampZoom and snapZoom produce the same result for any input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          expect(clampZoom(input)).toBe(snapZoom(input));
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * Values below 50 are clamped to 50.
   */
  it('clamps values below the minimum to 50', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 49, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const result = clampZoom(input);
          expect(result).toBe(50);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * Values above 300 are clamped to 300.
   */
  it('clamps values above the maximum to 300', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 301, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const result = clampZoom(input);
          expect(result).toBe(300);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Values within [50, 300] snap to the nearest 10% increment.
   */
  it('snaps values within range to the nearest 10% increment', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 50, max: 300, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const result = clampZoom(input);

          // The result should be the closest multiple of 10 to the input
          // within [50, 300]
          const expectedSnapped = Math.round(input / 10) * 10;
          const expectedClamped = Math.max(50, Math.min(300, expectedSnapped));
          expect(result).toBe(expectedClamped);
        }
      ),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 4.1, 4.5**
   *
   * clampZoom is idempotent: applying it twice yields the same result.
   */
  it('clampZoom is idempotent', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (input) => {
          const once = clampZoom(input);
          const twice = clampZoom(once);
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 150 }
    );
  });
});
