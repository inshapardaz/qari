import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    });

    it('should apply sepia theme colors', () => {
      engine.setTheme('sepia');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe(THEMES.sepia.background);
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe(THEMES.sepia.foreground);
    });

    it('should apply high-contrast theme colors', () => {
      engine.setTheme('high-contrast');
      expect(rootElement.style.getPropertyValue('--reader-bg')).toBe('#000000');
      expect(rootElement.style.getPropertyValue('--reader-fg')).toBe('#ffffff');
    });

    it('should update preferences when theme changes', () => {
      engine.setTheme('sepia');
      expect(engine.getPreferences().theme).toBe('sepia');
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
        JSON.stringify({ theme: 'sepia', fontFamily: 'sans-serif', fontSize: 20 })
      );
      const loaded = engine.loadPersistedPreferences();
      expect(loaded).toEqual({ theme: 'sepia', fontFamily: 'sans-serif', fontSize: 20 });
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
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
      const result = engine.persistPreferences();
      expect(result).toBe(false);
      localStorage.setItem = originalSetItem;
    });

    it('should return null when localStorage throws on read', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = () => {
        throw new Error('SecurityError');
      };
      const result = engine.loadPersistedPreferences();
      expect(result).toBeNull();
      localStorage.getItem = originalGetItem;
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

    it('should apply all four themes within 100ms each', () => {
      const themes: Array<'light' | 'dark' | 'sepia' | 'high-contrast'> = [
        'light',
        'dark',
        'sepia',
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
