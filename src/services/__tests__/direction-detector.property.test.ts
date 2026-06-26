/**
 * Property 3: Direction Detection Threshold
 *
 * For any text with a controlled ratio of RTL characters,
 * the Direction_Detector SHALL classify direction and confidence
 * according to threshold rules:
 * - >50% RTL → RTL with high confidence
 * - <30% RTL → LTR with high confidence
 * - 30-50% RTL → low confidence (RTL if >40%, LTR otherwise)
 *
 * Additionally, when Urdu-specific characters are present, the
 * detectedScript SHALL be 'Urdu'.
 *
 * **Validates: Requirements 6.1, 6.7, 6.9**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DefaultDirectionDetector } from '../direction-detector';

// --- Character pools ---

/** Arabic characters (standard range 0x0600-0x06FF) */
const ARABIC_CHARS = 'أبتثجحخدذرزسشصضطظعغفقكلمنهوي';

/** Hebrew characters */
const HEBREW_CHARS = 'אבגדהוזחטיכלמנסעפצקרשת';

/** Latin characters (LTR) */
const LATIN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Urdu-specific characters that trigger 'Urdu' script detection */
const URDU_SPECIFIC_CHARS = 'ٹپچڈڑںھہے';

// --- Generators ---

/**
 * Builds a string with a controlled percentage of RTL characters.
 * The total character count is fixed at a reasonable size to ensure
 * the detector has enough content to analyze (within 1000 chars).
 */
function buildControlledText(
  rtlPercent: number,
  totalChars: number,
  rtlPool: string,
  ltrPool: string
): string {
  const rtlCount = Math.round((rtlPercent / 100) * totalChars);
  const ltrCount = totalChars - rtlCount;

  const chars: string[] = [];

  // Add RTL characters
  for (let i = 0; i < rtlCount; i++) {
    chars.push(rtlPool[i % rtlPool.length]);
  }

  // Add LTR characters
  for (let i = 0; i < ltrCount; i++) {
    chars.push(ltrPool[i % ltrPool.length]);
  }

  // Shuffle deterministically using a simple interleave pattern
  // to avoid all RTL chars being at start or end
  const result: string[] = [];
  let rtlIdx = 0;
  let ltrIdx = rtlCount;
  const rtlStep = totalChars / (rtlCount || 1);
  const positions = new Set<number>();

  // Place RTL chars at evenly distributed positions
  for (let i = 0; i < rtlCount; i++) {
    positions.add(Math.floor(i * (totalChars / rtlCount)));
  }

  let ltrI = 0;
  let rtlI = 0;
  for (let i = 0; i < totalChars; i++) {
    if (positions.has(i) && rtlI < rtlCount) {
      result.push(chars[rtlI]);
      rtlI++;
    } else if (ltrI < ltrCount) {
      result.push(chars[rtlCount + ltrI]);
      ltrI++;
    } else {
      result.push(chars[rtlI]);
      rtlI++;
    }
  }

  return result.join('');
}

// --- Tests ---

describe('Property 3: Direction Detection Threshold', () => {
  const detector = new DefaultDirectionDetector();

  it('classifies >50% RTL as RTL with high confidence', () => {
    // Generate percentages strictly above 50
    const rtlPercentAbove50 = fc.integer({ min: 51, max: 100 });
    const totalChars = fc.integer({ min: 100, max: 500 });

    fc.assert(
      fc.property(rtlPercentAbove50, totalChars, (rtlPercent, total) => {
        const text = buildControlledText(rtlPercent, total, ARABIC_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        expect(result.direction).toBe('rtl');
        expect(result.confidence).toBe('high');
        expect(result.rtlPercentage).toBeGreaterThan(50);
      }),
      { numRuns: 100 }
    );
  });

  it('classifies <30% RTL as LTR with high confidence', () => {
    // Generate percentages strictly below 30
    const rtlPercentBelow30 = fc.integer({ min: 0, max: 29 });
    const totalChars = fc.integer({ min: 100, max: 500 });

    fc.assert(
      fc.property(rtlPercentBelow30, totalChars, (rtlPercent, total) => {
        const text = buildControlledText(rtlPercent, total, ARABIC_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        expect(result.direction).toBe('ltr');
        expect(result.confidence).toBe('high');
        expect(result.rtlPercentage).toBeLessThan(30);
      }),
      { numRuns: 100 }
    );
  });

  it('classifies 30-50% RTL as low confidence', () => {
    // Generate percentages in the ambiguous range [31, 49] to avoid
    // boundary rounding issues (e.g., requesting 30% of N chars can
    // round down to <30% actual).
    const rtlPercentMid = fc.integer({ min: 32, max: 49 });
    const totalChars = fc.integer({ min: 200, max: 500 });

    fc.assert(
      fc.property(rtlPercentMid, totalChars, (rtlPercent, total) => {
        const text = buildControlledText(rtlPercent, total, ARABIC_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        // Due to rounding, verify that the actual percentage is in range
        expect(result.rtlPercentage).toBeGreaterThanOrEqual(30);
        expect(result.rtlPercentage).toBeLessThanOrEqual(50);
        expect(result.confidence).toBe('low');
      }),
      { numRuns: 100 }
    );
  });

  it('within low confidence, direction is RTL when >40% and LTR when <=40%', () => {
    const rtlPercentMid = fc.integer({ min: 32, max: 49 });
    const totalChars = fc.integer({ min: 200, max: 500 });

    fc.assert(
      fc.property(rtlPercentMid, totalChars, (rtlPercent, total) => {
        const text = buildControlledText(rtlPercent, total, ARABIC_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        // Only assert direction logic when we're actually in low confidence range
        if (result.confidence === 'low') {
          if (result.rtlPercentage > 40) {
            expect(result.direction).toBe('rtl');
          } else {
            expect(result.direction).toBe('ltr');
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('detects Urdu script when Urdu-specific characters are present', () => {
    // Mix Urdu-specific chars with Arabic and Latin chars
    const rtlPercent = fc.integer({ min: 40, max: 100 });
    const totalChars = fc.integer({ min: 50, max: 300 });

    fc.assert(
      fc.property(rtlPercent, totalChars, (pct, total) => {
        // Build text with Urdu-specific characters mixed in
        const urduRtlPool = URDU_SPECIFIC_CHARS + ARABIC_CHARS;
        const text = buildControlledText(pct, total, urduRtlPool, LATIN_CHARS);
        const result = detector.detect(text);

        expect(result.detectedScript).toBe('Urdu');
      }),
      { numRuns: 100 }
    );
  });

  it('detects Arabic script for pure Arabic text without Urdu characters', () => {
    const rtlPercent = fc.integer({ min: 51, max: 100 });
    const totalChars = fc.integer({ min: 50, max: 300 });

    fc.assert(
      fc.property(rtlPercent, totalChars, (pct, total) => {
        const text = buildControlledText(pct, total, ARABIC_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        expect(result.detectedScript).toBe('Arabic');
      }),
      { numRuns: 100 }
    );
  });

  it('detects Hebrew script for pure Hebrew text', () => {
    const rtlPercent = fc.integer({ min: 51, max: 100 });
    const totalChars = fc.integer({ min: 50, max: 300 });

    fc.assert(
      fc.property(rtlPercent, totalChars, (pct, total) => {
        const text = buildControlledText(pct, total, HEBREW_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        expect(result.detectedScript).toBe('Hebrew');
      }),
      { numRuns: 100 }
    );
  });

  it('rtlPercentage is always between 0 and 100', () => {
    // Generate arbitrary text including some with no RTL at all
    const rtlPercent = fc.integer({ min: 0, max: 100 });
    const totalChars = fc.integer({ min: 10, max: 500 });

    fc.assert(
      fc.property(rtlPercent, totalChars, (pct, total) => {
        const text = buildControlledText(pct, total, ARABIC_CHARS, LATIN_CHARS);
        const result = detector.detect(text);

        expect(result.rtlPercentage).toBeGreaterThanOrEqual(0);
        expect(result.rtlPercentage).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });
});
