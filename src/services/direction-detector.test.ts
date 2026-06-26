import { describe, it, expect } from 'vitest';
import { DefaultDirectionDetector } from './direction-detector';

describe('DefaultDirectionDetector', () => {
  const detector = new DefaultDirectionDetector();

  describe('basic direction detection', () => {
    it('should detect pure Arabic text as RTL with high confidence', () => {
      const arabicText = 'بسم الله الرحمن الرحيم في يوم من الأيام كان هناك رجل يعيش في مدينة كبيرة وكان يحب القراءة كثيراً';
      const result = detector.detect(arabicText);

      expect(result.direction).toBe('rtl');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBeGreaterThan(40);
      expect(result.detectedScript).toBe('Arabic');
    });

    it('should detect pure English text as LTR with high confidence', () => {
      const englishText = 'The quick brown fox jumps over the lazy dog. This is a simple English sentence used for testing purposes.';
      const result = detector.detect(englishText);

      expect(result.direction).toBe('ltr');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBeLessThan(30);
      expect(result.detectedScript).toBeUndefined();
    });

    it('should detect pure Hebrew text as RTL with high confidence', () => {
      const hebrewText = 'בראשית ברא אלהים את השמים ואת הארץ והארץ היתה תהו ובהו וחשך על פני תהום';
      const result = detector.detect(hebrewText);

      expect(result.direction).toBe('rtl');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBeGreaterThan(40);
      expect(result.detectedScript).toBe('Hebrew');
    });

    it('should detect Urdu text and identify Urdu script', () => {
      // Urdu text with Urdu-specific characters (ٹ, پ, چ, ڈ, ڑ, ں, ھ, ہ, ے)
      const urduText = 'پاکستان ایک خوبصورت ملک ہے جہاں مختلف زبانیں بولی جاتی ہیں اردو قومی زبان ہے';
      const result = detector.detect(urduText);

      expect(result.direction).toBe('rtl');
      expect(result.confidence).toBe('high');
      expect(result.detectedScript).toBe('Urdu');
    });
  });

  describe('threshold behavior', () => {
    it('should return high confidence RTL when RTL percentage > 50%', () => {
      // Create text with ~62% RTL characters
      const rtlChars = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'; // 29 Arabic chars
      const ltrChars = 'abcdefghijklmnopqr'; // 18 Latin chars
      const text = rtlChars + ltrChars; // ~62% RTL

      const result = detector.detect(text);
      expect(result.direction).toBe('rtl');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBeGreaterThan(50);
    });

    it('should return high confidence LTR when RTL percentage < 30%', () => {
      // Create text with ~20% RTL characters
      const ltrChars = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'; // 52 Latin chars
      const rtlChars = 'ابتثجحخدذرزسش'; // 13 Arabic chars
      const text = ltrChars + rtlChars; // ~20% RTL

      const result = detector.detect(text);
      expect(result.direction).toBe('ltr');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBeLessThan(30);
    });

    it('should return low confidence when RTL percentage is between 30% and 40%', () => {
      // Create text with ~35% RTL characters
      const ltrChars = 'abcdefghijklmnopqrstuvwxyzabcdefgh'; // 34 Latin chars
      const rtlChars = 'ابتثجحخدذرزسشصضطظع'; // 18 Arabic chars
      const text = ltrChars + rtlChars; // ~35% RTL

      const result = detector.detect(text);
      expect(result.confidence).toBe('low');
      expect(result.direction).toBe('ltr');
      expect(result.rtlPercentage).toBeGreaterThanOrEqual(30);
      expect(result.rtlPercentage).toBeLessThanOrEqual(40);
    });

    it('should return low confidence RTL when RTL percentage is between 40% and 50%', () => {
      // Create text with ~45% RTL: 9 Arabic + 11 Latin = 20 total, 45% RTL
      const ltrChars = 'abcdefghijk'; // 11 Latin chars
      const rtlChars = 'ابتثجحخدذ'; // 9 Arabic chars
      const text = ltrChars + rtlChars; // 9/20 = 45% RTL

      const result = detector.detect(text);
      expect(result.confidence).toBe('low');
      expect(result.direction).toBe('rtl');
      expect(result.rtlPercentage).toBeGreaterThan(40);
      expect(result.rtlPercentage).toBeLessThanOrEqual(50);
    });
  });

  describe('sample size limiting', () => {
    it('should only analyze first 1000 characters', () => {
      // First 1000 chars are English, rest is Arabic
      const englishPart = 'a'.repeat(1000);
      const arabicPart = 'ب'.repeat(2000);
      const text = englishPart + arabicPart;

      const result = detector.detect(text);
      expect(result.direction).toBe('ltr');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBe(0);
    });

    it('should handle text shorter than 1000 characters', () => {
      const shortArabic = 'مرحبا';
      const result = detector.detect(shortArabic);

      expect(result.direction).toBe('rtl');
      expect(result.confidence).toBe('high');
    });
  });

  describe('whitespace handling', () => {
    it('should ignore whitespace when calculating RTL percentage', () => {
      // All non-whitespace chars are Arabic, but lots of whitespace
      const text = 'ب ت ث ج ح خ د ذ ر ز';
      const result = detector.detect(text);

      expect(result.direction).toBe('rtl');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBe(100);
    });

    it('should handle text with only whitespace', () => {
      const text = '     \t\n\r  ';
      const result = detector.detect(text);

      expect(result.direction).toBe('ltr');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBe(0);
    });
  });

  describe('script detection', () => {
    it('should detect Arabic script when Arabic chars dominate', () => {
      const text = 'هذا نص عربي بسيط';
      const result = detector.detect(text);
      expect(result.detectedScript).toBe('Arabic');
    });

    it('should detect Hebrew script when Hebrew chars dominate', () => {
      const text = 'שלום עולם זה טקסט בעברית';
      const result = detector.detect(text);
      expect(result.detectedScript).toBe('Hebrew');
    });

    it('should detect Urdu when Urdu-specific characters are present', () => {
      // Using Urdu-specific chars: پ (0x067E), ٹ (0x0679), چ (0x0686)
      const text = 'پاکستان میں ٹیکنالوجی تیزی سے ترقی کر رہی ہے اور چینی';
      const result = detector.detect(text);
      expect(result.detectedScript).toBe('Urdu');
    });

    it('should not set detectedScript for pure LTR text', () => {
      const text = 'Hello world this is English text';
      const result = detector.detect(text);
      expect(result.detectedScript).toBeUndefined();
    });

    it('should prefer Urdu over Arabic when Urdu-specific chars present', () => {
      // Mix of Arabic and Urdu-specific characters
      const text = 'بسم الله الرحمن الرحيم پاکستان ٹیکنالوجی';
      const result = detector.detect(text);
      expect(result.detectedScript).toBe('Urdu');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = detector.detect('');

      expect(result.direction).toBe('ltr');
      expect(result.confidence).toBe('high');
      expect(result.rtlPercentage).toBe(0);
      expect(result.detectedScript).toBeUndefined();
    });

    it('should handle text with numbers and punctuation', () => {
      // Numbers and punctuation are not RTL characters
      const text = '12345!@#$%^&*()';
      const result = detector.detect(text);

      expect(result.direction).toBe('ltr');
      expect(result.confidence).toBe('high');
    });

    it('should handle mixed Arabic and English text', () => {
      // About 50% Arabic
      const text = 'Hello World مرحبا بالعالم';
      const result = detector.detect(text);

      // Should have some RTL percentage > 0
      expect(result.rtlPercentage).toBeGreaterThan(0);
    });
  });
});
