import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FreeDictionaryProvider } from './free-dictionary-provider';

describe('FreeDictionaryProvider', () => {
  let provider: FreeDictionaryProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    provider = new FreeDictionaryProvider();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful lookup', () => {
    it('should return mapped definitions from a valid API response', async () => {
      const apiResponse = [
        {
          word: 'hello',
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                {
                  definition: 'A greeting',
                  example: 'Hello, how are you?',
                },
              ],
            },
            {
              partOfSpeech: 'interjection',
              definitions: [
                {
                  definition: 'Used as a greeting',
                },
              ],
            },
          ],
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await provider.lookup('hello', 'en', 'Say hello to the world');

      expect(result.word).toBe('hello');
      expect(result.language).toBe('en');
      expect(result.notFound).toBeFalsy();
      expect(result.definitions).toHaveLength(2);
      expect(result.definitions[0]).toEqual({
        meaning: 'A greeting',
        partOfSpeech: 'noun',
        examples: ['Hello, how are you?'],
      });
      expect(result.definitions[1]).toEqual({
        meaning: 'Used as a greeting',
        partOfSpeech: 'interjection',
      });
    });

    it('should construct the correct API URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ word: 'test', meanings: [] }]),
      });

      await provider.lookup('test', 'en', 'context');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dictionaryapi.dev/api/v2/entries/en/test',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should map multiple entries with multiple definitions', async () => {
      const apiResponse = [
        {
          word: 'run',
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [
                { definition: 'To move quickly on foot', example: 'She runs every morning' },
                { definition: 'To operate or function', example: 'The engine runs smoothly' },
              ],
            },
          ],
        },
        {
          word: 'run',
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: 'An act of running' },
              ],
            },
          ],
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await provider.lookup('run', 'en', '');

      expect(result.definitions).toHaveLength(3);
      expect(result.definitions[0].partOfSpeech).toBe('verb');
      expect(result.definitions[0].examples).toEqual(['She runs every morning']);
      expect(result.definitions[1].partOfSpeech).toBe('verb');
      expect(result.definitions[1].examples).toEqual(['The engine runs smoothly']);
      expect(result.definitions[2].partOfSpeech).toBe('noun');
      expect(result.definitions[2].examples).toBeUndefined();
    });
  });

  describe('404 handling', () => {
    it('should return notFound result when API returns 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ title: 'No Definitions Found' }),
      });

      const result = await provider.lookup('xyznonexistent', 'en', '');

      expect(result.word).toBe('xyznonexistent');
      expect(result.language).toBe('en');
      expect(result.notFound).toBe(true);
      expect(result.definitions).toEqual([]);
    });
  });

  describe('network timeout', () => {
    it('should throw a timeout error when request exceeds timeout', async () => {
      vi.useFakeTimers();

      const shortTimeoutProvider = new FreeDictionaryProvider({ timeout: 100 });

      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((resolve, reject) => {
          if (options.signal.aborted) {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
            return;
          }
          options.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const lookupPromise = shortTimeoutProvider.lookup('slow', 'en', '');

      // Advance past the timeout
      vi.advanceTimersByTime(101);

      await expect(lookupPromise).rejects.toThrow('Dictionary lookup timed out after 100ms');

      vi.useRealTimers();
    });

    it('should throw an error when the network request fails', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(provider.lookup('word', 'en', '')).rejects.toThrow('Failed to fetch');
    });

    it('should throw an error for non-404 HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      await expect(provider.lookup('word', 'en', '')).rejects.toThrow(
        'API request failed with status 500'
      );
    });
  });

  describe('AbortSignal cancellation', () => {
    it('should abort when external signal is aborted', async () => {
      const controller = new AbortController();

      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const lookupPromise = provider.lookup('word', 'en', '', controller.signal);
      controller.abort();

      await expect(lookupPromise).rejects.toThrow();
      await expect(lookupPromise).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('should abort immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          if (options.signal.aborted) {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
            return;
          }
          options.signal.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      await expect(
        provider.lookup('word', 'en', '', controller.signal)
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });

  describe('provider metadata', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('free-dictionary-api');
    });

    it('should support English language', () => {
      expect(provider.supportedLanguages).toEqual(['en']);
    });

    it('should have online category', () => {
      expect(provider.category).toBe('online');
    });

    it('should be ready immediately', () => {
      expect(provider.ready).toBe(true);
    });
  });
});
