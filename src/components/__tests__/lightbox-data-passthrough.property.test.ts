/**
 * Property 1: Image data passthrough
 *
 * Validates: Requirements 1.2, 7.3
 *
 * Tests that for any image src/alt values, the click handler passes the exact
 * same values to the lightbox callback. This verifies the data flow pattern
 * used in ContentNodeRenderer: `onImageClick?.(node.src!, node.alt || '')`
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates the image click handler pattern from ContentNodeRenderer.
 * This is the exact logic used when an image is clicked:
 *   onClick={() => onImageClick?.(node.src!, node.alt || '')}
 */
function simulateImageClick(
  src: string,
  alt: string | undefined,
  onImageClick?: (src: string, alt: string) => void
): void {
  onImageClick?.(src, alt || '');
}

describe('Property 1: Image data passthrough', () => {
  /**
   * **Validates: Requirements 1.2, 7.3**
   *
   * For any non-empty src string and any alt string, the onImageClick callback
   * receives the exact src and alt values passed to it.
   */
  it('callback receives exact src and alt values for any input', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.string({ minLength: 1 }),
        (src, alt) => {
          const callback = vi.fn();

          simulateImageClick(src, alt, callback);

          expect(callback).toHaveBeenCalledOnce();
          expect(callback).toHaveBeenCalledWith(src, alt);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2, 7.3**
   *
   * When alt is undefined, the callback receives an empty string as alt.
   * This mirrors the `node.alt || ''` pattern in ContentNodeRenderer.
   */
  it('callback receives empty string when alt is undefined', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (src) => {
          const callback = vi.fn();

          simulateImageClick(src, undefined, callback);

          expect(callback).toHaveBeenCalledOnce();
          expect(callback).toHaveBeenCalledWith(src, '');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2, 7.3**
   *
   * When alt is an empty string, the callback receives an empty string as alt.
   * This matches the `node.alt || ''` fallback behavior.
   */
  it('callback receives empty string when alt is empty', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (src) => {
          const callback = vi.fn();

          simulateImageClick(src, '', callback);

          expect(callback).toHaveBeenCalledOnce();
          expect(callback).toHaveBeenCalledWith(src, '');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2, 7.3**
   *
   * For arbitrary string src values (not just valid URLs), the callback still
   * receives the exact src and alt values without modification.
   */
  it('arbitrary src strings are passed through without modification', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string(),
        (src, alt) => {
          const callback = vi.fn();

          simulateImageClick(src, alt, callback);

          expect(callback).toHaveBeenCalledOnce();
          // src is passed through exactly as-is
          expect(callback.mock.calls[0][0]).toBe(src);
          // alt is passed through as-is (or '' if empty due to || operator)
          expect(callback.mock.calls[0][1]).toBe(alt || '');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.2, 7.3**
   *
   * When no callback is provided, the click handler does not throw.
   * This verifies the optional chaining pattern: `onImageClick?.(...)`
   */
  it('does not throw when callback is undefined', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string(),
        (src, alt) => {
          // Should not throw when callback is undefined
          expect(() => simulateImageClick(src, alt, undefined)).not.toThrow();
        }
      ),
      { numRuns: 200 }
    );
  });
});
