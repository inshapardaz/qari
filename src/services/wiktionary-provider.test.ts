import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WiktionaryProvider } from './wiktionary-provider';

describe('WiktionaryProvider', () => {
  let provider: WiktionaryProvider;
  const mockFetch = vi.fn();

  beforeEach(() => {
    provider = new WiktionaryProvider({ languages: ['en', 'fr', 'es'] });
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful lookup', () => {
    it('should return mapped definitions from a valid API response', async () => {
      const apiResponse = {
        en: [
          {
            partOfSpeech: 'Noun',
            language: 'English',
            definitions: [
              {
                definition: 'A domesticated animal',
                parsedExamples: [{ example: 'The cat sat on the mat.' }],
              },
              {
                definition: 'A feline mammal',
              },
            ],
          },
          {
            partOfSpeech: 'Verb',
            language: 'English',
            definitions: [
              {
                definition: 'To hoist an anchor',
                examples: ['They catted the anchor.'],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await provider.lookup('cat', 'en', 'The cat is here');

      expect(result.word).toBe('cat');
      expect(result.language).toBe('en');
      expect(result.notFound).toBeFalsy();
      expect(result.definitions).toHaveLength(3);
      expect(result.definitions[0]).toEqual({
        meaning: 'A domesticated animal',
        partOfSpeech: 'Noun',
        examples: ['The cat sat on the mat.'],
      });
      expect(result.definitions[1]).toEqual({
        meaning: 'A feline mammal',
        partOfSpeech: 'Noun',
      });
      expect(result.definitions[2]).toEqual({
        meaning: 'To hoist an anchor',
        partOfSpeech: 'Verb',
        examples: ['They catted the anchor.'],
      });
    });

    it('should construct the correct API URL with language subdomain', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ en: [] }),
      });

      await provider.lookup('word', 'en', 'context');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://en.wiktionary.org/api/rest_v1/page/definition/word',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should use the specified language in the URL subdomain', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ fr: [] }),
      });

      await provider.lookup('bonjour', 'fr', 'context');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fr.wiktionary.org/api/rest_v1/page/definition/bonjour',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should return notFound when response has no definitions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ en: [] }),
      });

      const result = await provider.lookup('xyznonexistent', 'en', '');

      expect(result.notFound).toBe(true);
      expect(result.definitions).toEqual([]);
    });
  });

  describe('HTML stripping in definitions', () => {
    it('should strip HTML tags from definition text', async () => {
      const apiResponse = {
        en: [
          {
            partOfSpeech: 'Noun',
            language: 'English',
            definitions: [
              {
                definition: '<b>A bold</b> definition with <i>italic</i> text',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await provider.lookup('test', 'en', '');

      expect(result.definitions[0].meaning).toBe('A bold definition with italic text');
    });

    it('should strip HTML tags from example text', async () => {
      const apiResponse = {
        en: [
          {
            partOfSpeech: 'Verb',
            language: 'English',
            definitions: [
              {
                definition: 'To perform an action',
                parsedExamples: [{ example: '<i>He <b>did</b> the thing.</i>' }],
                examples: ['<span class="example">Another example</span>'],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await provider.lookup('do', 'en', '');

      expect(result.definitions[0].examples).toEqual([
        'He did the thing.',
        'Another example',
      ]);
    });

    it('should handle self-closing HTML tags', async () => {
      const apiResponse = {
        en: [
          {
            partOfSpeech: 'Noun',
            language: 'English',
            definitions: [
              {
                definition: 'First part<br/>second part',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await provider.lookup('test', 'en', '');

      expect(result.definitions[0].meaning).toBe('First partsecond part');
    });
  });

  describe('404 handling', () => {
    it('should return notFound result when API returns 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ type: 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' }),
      });

      const result = await provider.lookup('xyznonexistent', 'en', '');

      expect(result.word).toBe('xyznonexistent');
      expect(result.language).toBe('en');
      expect(result.notFound).toBe(true);
      expect(result.definitions).toEqual([]);
    });
  });

  describe('network timeout', () => {
    it('should throw when request exceeds timeout', async () => {
      vi.useFakeTimers();

      const shortTimeoutProvider = new WiktionaryProvider({
        languages: ['en'],
        timeout: 100,
      });

      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          if (options.signal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
          }
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });

      const lookupPromise = shortTimeoutProvider.lookup('slow', 'en', '');

      vi.advanceTimersByTime(101);

      await expect(lookupPromise).rejects.toThrow();

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
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      await expect(provider.lookup('word', 'en', '')).rejects.toThrow(
        'Wiktionary API error: 500 Internal Server Error'
      );
    });
  });

  describe('URI encoding of special characters', () => {
    it('should URI-encode words with spaces', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ en: [] }),
      });

      await provider.lookup('hot dog', 'en', '');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://en.wiktionary.org/api/rest_v1/page/definition/hot%20dog',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should URI-encode words with special characters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ fr: [] }),
      });

      await provider.lookup('café', 'fr', '');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fr.wiktionary.org/api/rest_v1/page/definition/caf%C3%A9',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should URI-encode words with slashes and ampersands', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ en: [] }),
      });

      await provider.lookup('rock/pop & jazz', 'en', '');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://en.wiktionary.org/api/rest_v1/page/definition/rock%2Fpop%20%26%20jazz',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  describe('AbortSignal cancellation', () => {
    it('should abort when external signal is aborted', async () => {
      const controller = new AbortController();

      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
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

      await expect(
        provider.lookup('word', 'en', '', controller.signal)
      ).rejects.toMatchObject({ name: 'AbortError' });

      // fetch should not have been called since signal was already aborted
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('provider metadata', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('wiktionary-rest');
    });

    it('should have the configured supported languages', () => {
      expect(provider.supportedLanguages).toEqual(['en', 'fr', 'es']);
    });

    it('should have online category', () => {
      expect(provider.category).toBe('online');
    });
  });
});
