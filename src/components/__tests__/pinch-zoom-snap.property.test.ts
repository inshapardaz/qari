import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computePinchZoom, snapZoom } from '../ZoomController';

/**
 * Property 7: Pinch-Zoom Gesture Snapping
 *
 * For any pinch gesture magnitude that produces a raw zoom value, the final
 * applied zoom level SHALL be the nearest 10% increment within the [50, 300] range.
 *
 * **Validates: Requirements 4.3**
 */

// Generate positive start distances (finger gap at gesture start)
const startDistanceArb = fc.float({ min: 10, max: 1000, noNaN: true });

// Generate positive current distances (finger gap during gesture)
const currentDistanceArb = fc.float({ min: 1, max: 2000, noNaN: true });

// Generate valid starting zoom levels (any value in the zoom range)
const startZoomArb = fc.integer({ min: 50, max: 300 }).map((n) => {
  // Ensure start zoom is always a valid 10% increment
  return Math.round(n / 10) * 10;
});

describe('Feature: universal-ebook-reader, Property 7: Pinch-Zoom Gesture Snapping', () => {
  it('snapped zoom is always a multiple of 10 within [50, 300] for any gesture magnitude', () => {
    fc.assert(
      fc.property(
        startDistanceArb,
        currentDistanceArb,
        startZoomArb,
        (startDistance, currentDistance, startZoom) => {
          // Compute raw zoom from pinch gesture
          const rawZoom = computePinchZoom(startDistance, currentDistance, startZoom);

          // Snap the raw zoom value
          const snapped = snapZoom(rawZoom);

          // Assert: snapped value is within [50, 300]
          expect(snapped).toBeGreaterThanOrEqual(50);
          expect(snapped).toBeLessThanOrEqual(300);

          // Assert: snapped value is a multiple of 10
          expect(snapped % 10).toBe(0);

          // Assert: snapped value is the nearest 10% increment to the clamped raw value
          const clamped = Math.max(50, Math.min(300, rawZoom));
          const expectedSnap = Math.round(clamped / 10) * 10;
          expect(snapped).toBe(expectedSnap);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('extreme gesture ratios still produce valid snapped zoom', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
        startZoomArb,
        (startDistance, currentDistance, startZoom) => {
          const rawZoom = computePinchZoom(startDistance, currentDistance, startZoom);
          const snapped = snapZoom(rawZoom);

          // Snapped value must always be valid
          expect(snapped).toBeGreaterThanOrEqual(50);
          expect(snapped).toBeLessThanOrEqual(300);
          expect(snapped % 10).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
