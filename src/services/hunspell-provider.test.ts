/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HunspellProvider, HunspellProviderConfig } from './hunspell-provider';

// Mock nspell
vi.mock('nspell', () => {
  return {
    default: vi.fn(),
  };
});

import NSpell from 'nspell';

const MockNSpell = vi.mocked(NSpell);

describe('HunspellProvider', () => {
  let mockSpeller: { correct: ReturnType<typeof vi.fn>; suggest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeller = {
      correct: vi.fn(),
      suggest: vi.fn(),
    };
    MockNSpell.mockReturnValue(mockSpeller as unknown as ReturnType<typeof NSpell>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization with buffers', () => {
    it('should initialize immediately and set ready to true when buffers are provided', () => {
      const aff = new Uint8Array([83, 69, 84]); // "SET"
      const dic = new Uint8Array([49, 10, 104, 101, 108, 108, 111]); // "1\nhello"

      const provider = new HunspellProvider({
        language: 'en',
        aff,
        dic,
      });

      expect(provider.ready).toBe(true);
      expect(provider.id).toBe('hunspell-local');
      expect(provider.category).toBe('local');
      expect(provider.supportedLanguages).toEqual(['en']);
      expect(MockNSpell).toHaveBeenCalledTimes(1);
    });

    it('should accept Buffer data for initialization', () => {
      const aff = Buffer.from('SET UTF-8');
      const dic = Buffer.from('1\nhello');

      const provider = new HunspellProvider({
        language: 'en',
        aff,
        dic,
      });

      expect(provider.ready).toBe(true);
      expect(MockNSpell).toHaveBeenCalledWith(aff, dic);
    });

    it('should accept ArrayBuffer data for initialization', () => {
      const encoder = new TextEncoder();
      const aff = encoder.encode('SET UTF-8').buffer;
      const dic = encoder.encode('1\nhello').buffer;

      const provider = new HunspellProvider({
        language: 'en',
        aff: aff as ArrayBuffer,
        dic: dic as ArrayBuffer,
      });

      expect(provider.ready).toBe(true);
      expect(MockNSpell).toHaveBeenCalledTimes(1);
    });
  });

  describe('Initialization with URLs', () => {
    it('should set ready to false initially and true after successful fetch', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('SET UTF-8'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('1\nhello'),
        });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new HunspellProvider({
        language: 'en',
        affUrl: 'https://example.com/en.aff',
        dicUrl: 'https://example.com/en.dic',
      });

      expect(provider.ready).toBe(false);

      await provider.waitForReady();

      expect(provider.ready).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/en.aff');
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/en.dic');
      expect(MockNSpell).toHaveBeenCalledWith('SET UTF-8', '1\nhello');

      vi.unstubAllGlobals();
    });

    it('should throw error when .aff URL fetch fails', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('1\nhello'),
        });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new HunspellProvider({
        language: 'en',
        affUrl: 'https://example.com/en.aff',
        dicUrl: 'https://example.com/en.dic',
      });

      await expect(provider.waitForReady()).rejects.toThrow('Failed to fetch .aff file');
      expect(provider.ready).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should throw error when .dic URL fetch fails', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('SET UTF-8'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new HunspellProvider({
        language: 'en',
        affUrl: 'https://example.com/en.aff',
        dicUrl: 'https://example.com/en.dic',
      });

      await expect(provider.waitForReady()).rejects.toThrow('Failed to fetch .dic file');
      expect(provider.ready).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('Initialization failure with invalid data', () => {
    it('should throw error when nspell fails with corrupt buffer data', () => {
      MockNSpell.mockImplementation(() => {
        throw new Error('Invalid dictionary format');
      });

      expect(() => {
        new HunspellProvider({
          language: 'en',
          aff: new Uint8Array([0, 0, 0]),
          dic: new Uint8Array([0, 0, 0]),
        });
      }).toThrow('HunspellProvider initialization failed');
    });

    it('should throw error when neither buffers nor URLs are provided', () => {
      expect(() => {
        new HunspellProvider({
          language: 'en',
        } as HunspellProviderConfig);
      }).toThrow('HunspellProvider requires either aff/dic buffers or affUrl/dicUrl strings');
    });

    it('should throw error when nspell fails after fetching from URLs', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('corrupt-aff-data'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('corrupt-dic-data'),
        });
      vi.stubGlobal('fetch', mockFetch);

      MockNSpell.mockImplementation(() => {
        throw new Error('Invalid dictionary format');
      });

      const provider = new HunspellProvider({
        language: 'en',
        affUrl: 'https://example.com/en.aff',
        dicUrl: 'https://example.com/en.dic',
      });

      await expect(provider.waitForReady()).rejects.toThrow('HunspellProvider initialization failed');
      expect(provider.ready).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('Correct word lookup', () => {
    it('should return spellCheck.correct = true for a correctly spelled word', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83, 69, 84]),
        dic: new Uint8Array([49, 10, 104]),
      });

      mockSpeller.correct.mockReturnValue(true);

      const result = await provider.lookup('hello', 'en', 'say hello');

      expect(result.word).toBe('hello');
      expect(result.language).toBe('en');
      expect(result.notFound).toBe(false);
      expect(result.spellCheck).toEqual({
        correct: true,
        suggestions: [],
      });
    });

    it('should return empty definitions array for correct words', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      mockSpeller.correct.mockReturnValue(true);

      const result = await provider.lookup('world', 'en', 'hello world');

      expect(result.definitions).toEqual([]);
    });
  });

  describe('Misspelled word lookup', () => {
    it('should return spellCheck.correct = false with suggestions for misspelled word', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      mockSpeller.correct.mockReturnValue(false);
      mockSpeller.suggest.mockReturnValue(['hello', 'hallo', 'hullo']);

      const result = await provider.lookup('helo', 'en', 'say helo');

      expect(result.spellCheck).toEqual({
        correct: false,
        suggestions: ['hello', 'hallo', 'hullo'],
      });
      expect(result.notFound).toBe(false);
    });

    it('should cap suggestions at 10 entries', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      mockSpeller.correct.mockReturnValue(false);
      const manySuggestions = Array.from({ length: 15 }, (_, i) => `suggestion${i}`);
      mockSpeller.suggest.mockReturnValue(manySuggestions);

      const result = await provider.lookup('misspeled', 'en', 'a misspeled word');

      expect(result.spellCheck!.suggestions).toHaveLength(10);
      expect(result.spellCheck!.suggestions).toEqual(manySuggestions.slice(0, 10));
    });

    it('should return empty suggestions when nspell suggests nothing', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      mockSpeller.correct.mockReturnValue(false);
      mockSpeller.suggest.mockReturnValue([]);

      const result = await provider.lookup('xyzzy', 'en', 'the xyzzy word');

      expect(result.spellCheck).toEqual({
        correct: false,
        suggestions: [],
      });
    });
  });

  describe('nspell error during lookup', () => {
    it('should return graceful error result when nspell.correct throws', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      mockSpeller.correct.mockImplementation(() => {
        throw new Error('nspell internal error');
      });

      const result = await provider.lookup('a'.repeat(10000), 'en', 'long input');

      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('lookup failed');
    });

    it('should return graceful error result when nspell.suggest throws', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      mockSpeller.correct.mockReturnValue(false);
      mockSpeller.suggest.mockImplementation(() => {
        throw new Error('suggest failed');
      });

      const result = await provider.lookup('badword', 'en', 'a badword');

      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('lookup failed');
    });
  });

  describe('AbortSignal handling', () => {
    it('should return cancelled result when signal is already aborted', async () => {
      const provider = new HunspellProvider({
        language: 'en',
        aff: new Uint8Array([83]),
        dic: new Uint8Array([49]),
      });

      const controller = new AbortController();
      controller.abort();

      const result = await provider.lookup('hello', 'en', 'say hello', controller.signal);

      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('cancelled');
      expect(mockSpeller.correct).not.toHaveBeenCalled();
    });
  });

  describe('Provider not ready', () => {
    it('should return not-ready result when provider is still loading', async () => {
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise(() => {}) // never resolves
      );
      vi.stubGlobal('fetch', mockFetch);

      const provider = new HunspellProvider({
        language: 'en',
        affUrl: 'https://example.com/en.aff',
        dicUrl: 'https://example.com/en.dic',
      });

      expect(provider.ready).toBe(false);

      const result = await provider.lookup('hello', 'en', 'say hello');

      expect(result.notFound).toBe(true);
      expect(result.definitions[0].meaning).toContain('still loading');

      vi.unstubAllGlobals();
    });
  });
});
