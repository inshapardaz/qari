import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeEngine, THEMES, clampFontSize } from './theme-engine';

describe('ThemeEngine', () => {
  let rootElement: HTMLElement;
  let engine: ThemeEngine;

  beforeEach(() => {
    localStorage.clear();
    rootElement = document.createElement('div');
    engine = new ThemeEngine(rootElement);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('defaults', () => {
    it('should default to light theme, serif font, 16px font size', () => {
      const prefs = engine.getPreferences();
      expect(prefs.theme).toBe('light');
      expect(prefs.fontFamily).toBe('serif');
      expect(prefs.fontSize).toBe(16);
    });

    it('should apply default CSS custom properties on construction', () => {
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.light.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.light.foreground);
      expect(rootElement.style.getPropertyValue('--reader-secondary')).toBe(THEMES.light.secondary);
      expect(rootElement.style.getPropertyValue('--reader-font-size')).toBe('16px');
    });
  });

  describe('setTheme', () => {
    it('should apply dark theme colors', () => {
      engine.setTheme('dark');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.dark.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.dark.foreground);
      expect(rootElement.style.getPropertyValue('--reader-accent')).toBe(THEMES.dark.accent);
      expect(rootElement.style.getPropertyValue('--reader-surface')).toBe(THEMES.dark.surface);
      expect(rootElement.style.getPropertyValue('--reader-border')).toBe(THEMES.dark.border);
      expect(rootElement.style.getPropertyValue('--reader-secondary')).toBe(THEMES.dark.secondary);
    });

    it('should apply calm theme colors', () => {
      engine.setTheme('calm');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.calm.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.calm.foreground);
    });

    it('should apply quiet theme colors', () => {
      engine.setTheme('quiet');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.quiet.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.quiet.foreground);
    });

    it('should apply paper theme colors', () => {
      engine.setTheme('paper');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.paper.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.paper.foreground);
    });

    it('should apply focus theme colors', () => {
      engine.setTheme('focus');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.focus.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.focus.foreground);
    });

    it('should apply high-contrast theme colors', () => {
      engine.setTheme('high-contrast');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe('#000000');
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe('#ffffff');
    });

    it('should update preferences when theme changes', () => {
      engine.setTheme('calm');
      expect(engine.getPreferences().theme).toBe('calm');
    });

    // Regression test: setTheme is reachable from a host app's fully-controlled prop (see
    // Reader.tsx), not just this engine's own internal persisted storage - a caller can pass a
    // theme name renamed/removed between qari versions (e.g. the old "sepia", now "calm") without
    // going through loadPersistedPreferences' own migration at all. This used to throw
    // (THEMES[theme].background on undefined), crashing the whole <Reader> since nothing wraps it
    // in an error boundary.
    it('should fall back to light instead of throwing on an unrecognized theme name', () => {
      // @ts-expect-error - deliberately an invalid ThemeName, simulating a stale runtime value
      // from an older qari version (e.g. a persisted "sepia") or a non-TS caller.
      expect(() => engine.setTheme('sepia')).not.toThrow();
      expect(engine.getPreferences().theme).toBe('light');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.light.background);
    });
  });

  describe('setFont', () => {
    it('should apply sans-serif font family', () => {
      engine.setFont('sans-serif');
      const value = rootElement.style.getPropertyValue('--reader-font-family');
      expect(value).toContain('Segoe UI');
    });

    it('should apply monospace font family', () => {
      engine.setFont('monospace');
      const value = rootElement.style.getPropertyValue('--reader-font-family');
      expect(value).toContain('Fira Code');
    });

    it('should apply nastaliq font family', () => {
      engine.setFont('nastaliq');
      const value = rootElement.style.getPropertyValue('--reader-font-family');
      expect(value).toContain('Noto Nastaliq Urdu');
    });

    it('should update preferences when font changes', () => {
      engine.setFont('monospace');
      expect(engine.getPreferences().fontFamily).toBe('monospace');
    });

    it('should fall back to serif instead of throwing on an unrecognized font family', () => {
      // @ts-expect-error - deliberately an invalid FontFamily.
      expect(() => engine.setFont('comic-sans')).not.toThrow();
      expect(engine.getPreferences().fontFamily).toBe('serif');
    });
  });

  describe('setFontSize', () => {
    it('should apply a valid font size', () => {
      engine.setFontSize(24);
      expect(rootElement.style.getPropertyValue('--reader-font-size')).toBe('24px');
      expect(engine.getPreferences().fontSize).toBe(24);
    });

    it('should clamp font size below minimum to 12px', () => {
      engine.setFontSize(8);
      expect(engine.getPreferences().fontSize).toBe(12);
      expect(rootElement.style.getPropertyValue('--reader-font-size')).toBe('12px');
    });

    it('should clamp font size above maximum to 48px', () => {
      engine.setFontSize(60);
      expect(engine.getPreferences().fontSize).toBe(48);
      expect(rootElement.style.getPropertyValue('--reader-font-size')).toBe('48px');
    });

    it('should round to nearest 2px increment', () => {
      engine.setFontSize(15);
      expect(engine.getPreferences().fontSize).toBe(16);
    });

    it('should round 13 down to 12', () => {
      engine.setFontSize(13);
      expect(engine.getPreferences().fontSize).toBe(14);
    });
  });

  describe('clampFontSize utility', () => {
    it('should clamp below minimum', () => {
      expect(clampFontSize(0)).toBe(12);
      expect(clampFontSize(-10)).toBe(12);
    });

    it('should clamp above maximum', () => {
      expect(clampFontSize(100)).toBe(48);
    });

    it('should round to nearest 2px step', () => {
      expect(clampFontSize(17)).toBe(18);
      expect(clampFontSize(19)).toBe(20);
      expect(clampFontSize(12)).toBe(12);
      expect(clampFontSize(48)).toBe(48);
    });
  });

  describe('persistence', () => {
    it('should persist preferences to localStorage', () => {
      engine.setTheme('dark');
      engine.setFont('monospace');
      engine.setFontSize(24);
      const result = engine.persistPreferences();
      expect(result).toBe(true);

      const stored = JSON.parse(localStorage.getItem('ebook-reader-preferences')!);
      expect(stored.theme).toBe('dark');
      expect(stored.fontFamily).toBe('monospace');
      expect(stored.fontSize).toBe(24);
    });

    it('should load persisted preferences', () => {
      localStorage.setItem(
        'ebook-reader-preferences',
        JSON.stringify({ theme: 'calm', fontFamily: 'sans-serif', fontSize: 20 })
      );
      const loaded = engine.loadPersistedPreferences();
      expect(loaded).toEqual({ theme: 'calm', fontFamily: 'sans-serif', fontSize: 20 });
    });

    it("should migrate a 'sepia' theme persisted before the calm rename to 'calm'", () => {
      localStorage.setItem(
        'ebook-reader-preferences',
        JSON.stringify({ theme: 'sepia', fontFamily: 'sans-serif', fontSize: 20 })
      );
      const loaded = engine.loadPersistedPreferences();
      expect(loaded).toEqual({ theme: 'calm', fontFamily: 'sans-serif', fontSize: 20 });
    });

    it('should return null when nothing is stored', () => {
      expect(engine.loadPersistedPreferences()).toBeNull();
    });

    it('should return null for invalid stored data', () => {
      localStorage.setItem('ebook-reader-preferences', '{"theme":"invalid"}');
      expect(engine.loadPersistedPreferences()).toBeNull();
    });

    it('should return null for non-JSON data', () => {
      localStorage.setItem('ebook-reader-preferences', 'not-json');
      expect(engine.loadPersistedPreferences()).toBeNull();
    });

    it('should load persisted preferences on construction', () => {
      localStorage.setItem(
        'ebook-reader-preferences',
        JSON.stringify({ theme: 'dark', fontFamily: 'monospace', fontSize: 32 })
      );
      const newEngine = new ThemeEngine(rootElement);
      const prefs = newEngine.getPreferences();
      expect(prefs.theme).toBe('dark');
      expect(prefs.fontFamily).toBe('monospace');
      expect(prefs.fontSize).toBe(32);
    });

    it('should apply persisted theme on construction', () => {
      localStorage.setItem(
        'ebook-reader-preferences',
        JSON.stringify({ theme: 'dark', fontFamily: 'nastaliq', fontSize: 28 })
      );
      const newRoot = document.createElement('div');
      const newEngine = new ThemeEngine(newRoot);
      expect(newRoot.style.getPropertyValue('--reader-bg')).toBe(THEMES.dark.background);
      expect(newRoot.style.getPropertyValue('--reader-font-size')).toBe('28px');
      expect(newRoot.style.getPropertyValue('--reader-font-family')).toContain('Noto Nastaliq Urdu');
      // Suppress unused variable warning
      void newEngine;
    });

    it('should return false when localStorage throws on write', () => {
      // jsdom's Storage is Proxy-backed, so directly assigning
      // `localStorage.setItem = ...` silently writes a "setItem" entry
      // instead of overriding the method — spy on the prototype instead.
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const result = engine.persistPreferences();
      expect(result).toBe(false);
      spy.mockRestore();
    });

    it('should return null when localStorage throws on read', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const result = engine.loadPersistedPreferences();
      expect(result).toBeNull();
      spy.mockRestore();
    });
  });

  describe('WCAG AAA contrast for high-contrast theme', () => {
    it('should have black background and white foreground', () => {
      const hc = THEMES['high-contrast'];
      expect(hc.background).toBe('#000000');
      expect(hc.foreground).toBe('#ffffff');
      // Black (#000000) and White (#ffffff) has a contrast ratio of 21:1,
      // which exceeds the WCAG AAA minimum of 7:1
    });
  });

  describe('secondary (dimmed) text contrast', () => {
    // WCAG relative-luminance formula (sRGB), used to compute each theme's
    // actual secondary-vs-background contrast ratio rather than eyeballing it.
    function relativeLuminance(hex: string): number {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const [lr, lg, lb] = [r, g, b].map(linearize);
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    }
    function contrastRatio(hexA: string, hexB: string): number {
      const [la, lb] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
      return (la + 0.05) / (lb + 0.05);
    }

    it.each(['light', 'dark', 'calm', 'quiet', 'paper', 'focus', 'high-contrast'] as const)(
      "%s theme's secondary color clears WCAG AA's 4.5:1 minimum against its own background",
      (theme) => {
        const { background, secondary } = THEMES[theme];
        expect(contrastRatio(background, secondary)).toBeGreaterThanOrEqual(4.5);
      }
    );
  });

  describe('theme application performance', () => {
    it('should apply theme within 100ms', () => {
      const start = performance.now();
      engine.setTheme('dark');
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
      // Verify theme was actually applied
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.dark.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.dark.foreground);
    });

    it('should apply all seven themes within 100ms each', () => {
      const themes: Array<'light' | 'dark' | 'calm' | 'quiet' | 'paper' | 'focus' | 'high-contrast'> = [
        'light',
        'dark',
        'calm',
        'quiet',
        'paper',
        'focus',
        'high-contrast',
      ];
      for (const theme of themes) {
        const start = performance.now();
        engine.setTheme(theme);
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(100);
        expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES[theme].background);
      }
    });
  });

  describe('getPreferences returns a copy', () => {
    it('should not allow mutation of internal state', () => {
      const prefs = engine.getPreferences();
      prefs.theme = 'dark';
      prefs.fontSize = 48;
      // Internal state should remain unchanged
      expect(engine.getPreferences().theme).toBe('light');
      expect(engine.getPreferences().fontSize).toBe(16);
    });
  });
});
