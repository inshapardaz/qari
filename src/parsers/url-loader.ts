/**
 * URL Loader for the Universal Ebook Reader.
 * Fetches remote resources with a 30-second timeout and delegates parsing
 * to the appropriate parser based on content type detection.
 *
 * Content type detection priority:
 * 1. Response Content-Type header
 * 2. File extension in URL path
 */

import type { Book } from '../models/book';
import type { ReaderError } from '../models/events';
import { EPUBParserImpl } from './epub-parser';
import { MarkdownParserImpl } from './markdown-parser';

/** Timeout in milliseconds for URL fetch operations */
const FETCH_TIMEOUT_MS = 30_000;

/** Error thrown by the URL loader with structured ReaderError fields */
export class URLLoaderError extends Error implements ReaderError {
  public readonly code: string;
  public readonly source: string;
  public readonly format?: string;
  public readonly httpStatus?: number;

  constructor(opts: {
    code: string;
    message: string;
    source: string;
    format?: string;
    httpStatus?: number;
  }) {
    super(opts.message);
    this.name = 'URLLoaderError';
    this.code = opts.code;
    this.source = opts.source;
    this.format = opts.format;
    this.httpStatus = opts.httpStatus;
  }
}

/**
 * Determines the format to use for parsing based on Content-Type header
 * and URL path extension.
 */
function detectFormat(contentType: string, url: string): 'epub' | 'markdown' {
  const ct = contentType.toLowerCase();

  // Check Content-Type header first
  if (ct.includes('application/epub+zip') || ct.includes('application/epub')) {
    return 'epub';
  }
  if (ct.includes('text/markdown') || ct.includes('text/x-markdown')) {
    return 'markdown';
  }
  if (ct.includes('text/plain')) {
    // text/plain could be markdown — check URL extension to disambiguate
    const urlPath = extractUrlPath(url);
    if (urlPath.endsWith('.epub')) {
      return 'epub';
    }
    // Default text/plain to markdown
    return 'markdown';
  }

  // Fall back to URL extension
  const urlPath = extractUrlPath(url);
  if (urlPath.endsWith('.epub')) {
    return 'epub';
  }
  if (urlPath.endsWith('.md') || urlPath.endsWith('.markdown')) {
    return 'markdown';
  }

  // Default to markdown for text-like content types
  if (ct.includes('text/')) {
    return 'markdown';
  }

  // If octet-stream or binary, check URL extension
  if (ct.includes('application/octet-stream')) {
    if (urlPath.endsWith('.epub')) {
      return 'epub';
    }
    return 'markdown';
  }

  // Final fallback: use URL extension or default to markdown
  return 'markdown';
}

/**
 * Extracts the pathname from a URL, stripping query params and fragments.
 */
function extractUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase();
  } catch {
    // If URL can't be parsed, just lowercase the whole thing
    return url.toLowerCase();
  }
}

/**
 * Loads and parses a book from a remote URL.
 *
 * @param url - The URL to fetch the book from
 * @returns A parsed Book instance
 * @throws URLLoaderError on network errors, timeouts, or HTTP errors
 */
export async function loadFromUrl(url: string): Promise<Book> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new URLLoaderError({
        code: 'URL_TIMEOUT',
        message: `Request timed out after 30 seconds: ${url}`,
        source: url,
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    throw new URLLoaderError({
      code: 'NETWORK_ERROR',
      message: `Network error fetching ${url}: ${errorMessage}`,
      source: url,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle HTTP errors
  if (!response.ok) {
    throw new URLLoaderError({
      code: 'HTTP_ERROR',
      message: `HTTP ${response.status} ${response.statusText} when fetching ${url}`,
      source: url,
      httpStatus: response.status,
    });
  }

  const contentType = response.headers.get('content-type') || '';
  const format = detectFormat(contentType, url);

  try {
    if (format === 'epub') {
      const arrayBuffer = await response.arrayBuffer();
      const epubParser = new EPUBParserImpl();
      return await epubParser.parse(arrayBuffer);
    } else {
      const text = await response.text();
      const markdownParser = new MarkdownParserImpl();
      return markdownParser.parse(text);
    }
  } catch (error: unknown) {
    // Re-throw URLLoaderError as-is
    if (error instanceof URLLoaderError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown parse error';
    throw new URLLoaderError({
      code: 'PARSE_ERROR',
      message: `Failed to parse ${format} content from ${url}: ${errorMessage}`,
      source: url,
      format,
    });
  }
}
