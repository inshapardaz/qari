/**
 * Direction Detector interfaces for the Universal Ebook Reader.
 * Defines the contract for detecting text directionality (LTR/RTL).
 */

export interface DirectionDetector {
  detect(text: string): DirectionResult;
}

export interface DirectionResult {
  direction: 'ltr' | 'rtl';
  confidence: 'high' | 'low'; // low when RTL% is 30-50%
  rtlPercentage: number;
  detectedScript?: string; // e.g., 'Arabic', 'Hebrew', 'Urdu'
}
