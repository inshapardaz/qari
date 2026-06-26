import { DirectionDetector, DirectionResult } from '../interfaces/direction-detector';

/**
 * Unicode range helpers for RTL script detection.
 */

function isArabicChar(code: number): boolean {
  return (
    (code >= 0x0600 && code <= 0x06FF) || // Arabic
    (code >= 0x0750 && code <= 0x077F) || // Arabic Supplement
    (code >= 0x08A0 && code <= 0x08FF) || // Arabic Extended-A
    (code >= 0xFB50 && code <= 0xFDFF) || // Arabic Presentation Forms-A
    (code >= 0xFE70 && code <= 0xFEFF)    // Arabic Presentation Forms-B
  );
}

function isHebrewChar(code: number): boolean {
  return (
    (code >= 0x0590 && code <= 0x05FF) || // Hebrew
    (code >= 0xFB1D && code <= 0xFB4F)    // Hebrew Presentation Forms
  );
}

/**
 * Urdu-specific characters that distinguish Urdu from generic Arabic.
 * These are characters in the Arabic range that are primarily used in Urdu script.
 */
const URDU_SPECIFIC_CHARS = new Set([
  0x0679, // ٹ TTEH
  0x067E, // پ PEH
  0x0686, // چ TCHEH
  0x0688, // ڈ DDAL
  0x0691, // ڑ RREH
  0x06BA, // ں NOON GHUNNA
  0x06BE, // ھ HEH DOACHASHMEE
  0x06C1, // ہ HEH GOAL
  0x06D2, // ے YEH BARREE
]);

function isUrduSpecificChar(code: number): boolean {
  return URDU_SPECIFIC_CHARS.has(code);
}

function isWhitespace(code: number): boolean {
  return (
    code === 0x0020 || // space
    code === 0x0009 || // tab
    code === 0x000A || // newline
    code === 0x000D || // carriage return
    code === 0x00A0 || // non-breaking space
    code === 0x2000 || // en quad
    code === 0x2001 || // em quad
    code === 0x2002 || // en space
    code === 0x2003 || // em space
    code === 0x2004 || // three-per-em space
    code === 0x2005 || // four-per-em space
    code === 0x2006 || // six-per-em space
    code === 0x2007 || // figure space
    code === 0x2008 || // punctuation space
    code === 0x2009 || // thin space
    code === 0x200A || // hair space
    code === 0x200B || // zero-width space
    code === 0x3000    // ideographic space
  );
}

/**
 * Detects the primary script from character analysis.
 */
function detectScript(
  arabicCount: number,
  hebrewCount: number,
  urduSpecificCount: number
): string | undefined {
  // If we have Urdu-specific characters, it's Urdu
  if (urduSpecificCount > 0) {
    return 'Urdu';
  }

  // Determine dominant script
  if (arabicCount > 0 && arabicCount >= hebrewCount) {
    return 'Arabic';
  }

  if (hebrewCount > 0) {
    return 'Hebrew';
  }

  return undefined;
}

/**
 * Default implementation of DirectionDetector.
 *
 * Analyzes the first 1000 characters of text content to determine
 * text directionality (LTR/RTL) and identify the primary script.
 */
export class DefaultDirectionDetector implements DirectionDetector {
  detect(text: string): DirectionResult {
    // Take first 1000 characters for analysis
    const sample = text.slice(0, 1000);

    let totalNonWhitespace = 0;
    let rtlCount = 0;
    let arabicCount = 0;
    let hebrewCount = 0;
    let urduSpecificCount = 0;

    for (let i = 0; i < sample.length; i++) {
      const code = sample.codePointAt(i)!;

      // Skip surrogate pairs (codePointAt handles them, but we need to advance index)
      if (code > 0xFFFF) {
        i++;
      }

      if (isWhitespace(code)) {
        continue;
      }

      totalNonWhitespace++;

      if (isArabicChar(code)) {
        rtlCount++;
        arabicCount++;
        if (isUrduSpecificChar(code)) {
          urduSpecificCount++;
        }
      } else if (isHebrewChar(code)) {
        rtlCount++;
        hebrewCount++;
      }
    }

    // Calculate RTL percentage
    const rtlPercentage = totalNonWhitespace === 0
      ? 0
      : (rtlCount / totalNonWhitespace) * 100;

    // Determine direction and confidence based on thresholds:
    // > 50% RTL → RTL with high confidence
    // < 30% RTL → LTR with high confidence
    // 30-50% RTL → low confidence (triggers user prompt)
    //   Within low confidence: direction is RTL if > 40%, LTR otherwise
    let direction: 'ltr' | 'rtl';
    let confidence: 'high' | 'low';

    if (rtlPercentage > 50) {
      direction = 'rtl';
      confidence = 'high';
    } else if (rtlPercentage < 30) {
      direction = 'ltr';
      confidence = 'high';
    } else {
      // 30-50% range: low confidence, direction is majority
      direction = rtlPercentage > 40 ? 'rtl' : 'ltr';
      confidence = 'low';
    }

    // Detect script
    const detectedScript = detectScript(arabicCount, hebrewCount, urduSpecificCount);

    const result: DirectionResult = {
      direction,
      confidence,
      rtlPercentage: Math.round(rtlPercentage * 100) / 100,
    };

    if (detectedScript) {
      result.detectedScript = detectedScript;
    }

    return result;
  }
}
