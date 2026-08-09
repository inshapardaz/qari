/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { URDU_WEB_FONT_OPTIONS, injectUrduWebFontsCss } from './urdu-web-fonts';

describe('urdu-web-fonts', () => {
  describe('URDU_WEB_FONT_OPTIONS', () => {
    it('lists every font family from the urdu-web-fonts collection', () => {
      expect(URDU_WEB_FONT_OPTIONS.length).toBe(26);
    });

    it('gives every option a non-empty display name and a quoted CSS family with a serif fallback', () => {
      for (const option of URDU_WEB_FONT_OPTIONS) {
        expect(option.name.length).toBeGreaterThan(0);
        expect(option.family).toMatch(/^".+", serif$/);
      }
    });

    it('has no duplicate display names', () => {
      const names = URDU_WEB_FONT_OPTIONS.map((o) => o.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('includes well-known fonts referenced elsewhere in the reader (e.g. ThemeEngine nastaliq mapping)', () => {
      const names = URDU_WEB_FONT_OPTIONS.map((o) => o.name);
      expect(names).toContain('Noto Nastaliq Urdu');
      expect(names).toContain('Jameel Noori Nastaleeq');
    });
  });

  describe('injectUrduWebFontsCss', () => {
    it('injects one stylesheet link per font pointed at the jsDelivr GitHub CDN, and is idempotent on repeated calls', () => {
      injectUrduWebFontsCss();
      const links = document.querySelectorAll('link[data-qari-urdu-fonts]');
      expect(links.length).toBe(26);
      for (const link of links) {
        expect(link.getAttribute('rel')).toBe('stylesheet');
        expect(link.getAttribute('href')).toMatch(
          /^https:\/\/cdn\.jsdelivr\.net\/gh\/inshapardaz\/urdu-web-fonts@[0-9a-f]{40}\/src\/fonts\/.+\/stylesheet\.css$/
        );
      }

      // Calling it again (e.g. a second Reader instance mounting) must not add duplicates
      injectUrduWebFontsCss();
      expect(document.querySelectorAll('link[data-qari-urdu-fonts]').length).toBe(26);
    });
  });
});
