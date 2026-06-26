import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFromUrl, URLLoaderError } from '../url-loader';
import type { Book } from '../../models/book';

// Mock the parsers so we test URL loader logic in isolation
vi.mock('../epub-parser', () => {
  return {
    EPUBParserImpl: class {
      async parse(_data: ArrayBuffer): Promise<Book> {
        return {
          metadata: { title: 'EPUB Book', author: 'Author', language: 'en' },
          chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, content: [] }],
        };
      }
    },
  };
});

vi.mock('../markdown-parser', () => {
  return {
    MarkdownParserImpl: class {
      parse(_content: string): Book {
        return {
          metadata: { title: 'Markdown Book' },
          chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, content: [] }],
        };
      }
    },
  };
});

describe('URL Loader', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('successful EPUB fetch and delegation', () => {
    it('fetches an EPUB URL and delegates to EPUB parser', async () => {
      const epubBuffer = new ArrayBuffer(100);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/epub+zip' }),
        arrayBuffer: vi.fn().mockResolvedValue(epubBuffer),
      });

      const book = await loadFromUrl('https://example.com/book.epub');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/book.epub', {
        signal: expect.any(AbortSignal),
      });
      expect(book.metadata.title).toBe('EPUB Book');
      expect(book.chapters).toHaveLength(1);
    });

    it('detects EPUB format from URL extension when content-type is octet-stream', async () => {
      const epubBuffer = new ArrayBuffer(50);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        arrayBuffer: vi.fn().mockResolvedValue(epubBuffer),
      });

      const book = await loadFromUrl('https://example.com/library/novel.epub');

      expect(book.metadata.title).toBe('EPUB Book');
    });
  });

  describe('successful Markdown fetch and delegation', () => {
    it('fetches a Markdown URL and delegates to Markdown parser', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/markdown' }),
        text: vi.fn().mockResolvedValue('# Hello\n\nWorld'),
      });

      const book = await loadFromUrl('https://example.com/doc.md');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com/doc.md', {
        signal: expect.any(AbortSignal),
      });
      expect(book.metadata.title).toBe('Markdown Book');
      expect(book.chapters).toHaveLength(1);
    });

    it('detects Markdown format from URL extension when content-type is text/plain', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: vi.fn().mockResolvedValue('# Title\n\nContent'),
      });

      const book = await loadFromUrl('https://example.com/readme.md');

      expect(book.metadata.title).toBe('Markdown Book');
    });

    it('defaults to Markdown for text/plain without a recognized extension', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: vi.fn().mockResolvedValue('Some content'),
      });

      const book = await loadFromUrl('https://example.com/document');

      expect(book.metadata.title).toBe('Markdown Book');
    });
  });

  describe('30-second timeout behavior', () => {
    it('aborts the request after 30 seconds and throws URL_TIMEOUT error', async () => {
      // Simulate a fetch that never resolves until aborted
      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      const promise = loadFromUrl('https://example.com/slow-resource.epub').catch(
        (err) => err
      );

      // Advance timers past the 30-second timeout
      await vi.advanceTimersByTimeAsync(30_001);

      const err = await promise;
      expect(err).toBeInstanceOf(URLLoaderError);
      expect(err.code).toBe('URL_TIMEOUT');
      expect(err.source).toBe('https://example.com/slow-resource.epub');
    });

    it('includes the URL and duration in the timeout error message', async () => {
      mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      const promise = loadFromUrl('https://example.com/timeout-test').catch((err) => err);
      await vi.advanceTimersByTimeAsync(30_001);

      const err = await promise;
      expect(err).toBeInstanceOf(URLLoaderError);
      expect(err.message).toContain('https://example.com/timeout-test');
      expect(err.message).toContain('30 seconds');
    });
  });

  describe('network error handling with error description', () => {
    it('throws NETWORK_ERROR with the original error message', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(loadFromUrl('https://example.com/unreachable'))
        .rejects.toMatchObject({
          code: 'NETWORK_ERROR',
          source: 'https://example.com/unreachable',
        });
    });

    it('includes the network error description in the error message', async () => {
      mockFetch.mockRejectedValue(new TypeError('net::ERR_CONNECTION_REFUSED'));

      try {
        await loadFromUrl('https://example.com/refused');
      } catch (err) {
        expect(err).toBeInstanceOf(URLLoaderError);
        expect((err as URLLoaderError).message).toContain('net::ERR_CONNECTION_REFUSED');
        expect((err as URLLoaderError).message).toContain('https://example.com/refused');
      }
    });

    it('handles non-Error thrown values gracefully', async () => {
      mockFetch.mockRejectedValue('string error');

      try {
        await loadFromUrl('https://example.com/weird-error');
      } catch (err) {
        expect(err).toBeInstanceOf(URLLoaderError);
        expect((err as URLLoaderError).code).toBe('NETWORK_ERROR');
        expect((err as URLLoaderError).message).toContain('Unknown network error');
      }
    });
  });

  describe('HTTP error status codes', () => {
    it('throws HTTP_ERROR for 404 Not Found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      });

      await expect(loadFromUrl('https://example.com/missing.epub'))
        .rejects.toMatchObject({
          code: 'HTTP_ERROR',
          source: 'https://example.com/missing.epub',
          httpStatus: 404,
        });
    });

    it('throws HTTP_ERROR for 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
      });

      await expect(loadFromUrl('https://example.com/server-error'))
        .rejects.toMatchObject({
          code: 'HTTP_ERROR',
          httpStatus: 500,
        });
    });

    it('throws HTTP_ERROR for 403 Forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
      });

      await expect(loadFromUrl('https://example.com/forbidden'))
        .rejects.toMatchObject({
          code: 'HTTP_ERROR',
          httpStatus: 403,
        });
    });

    it('includes HTTP status and status text in error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        headers: new Headers(),
      });

      try {
        await loadFromUrl('https://example.com/gateway');
      } catch (err) {
        expect(err).toBeInstanceOf(URLLoaderError);
        const loaderErr = err as URLLoaderError;
        expect(loaderErr.message).toContain('502');
        expect(loaderErr.message).toContain('Bad Gateway');
        expect(loaderErr.httpStatus).toBe(502);
      }
    });
  });
});
