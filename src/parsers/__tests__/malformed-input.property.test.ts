/**
 * Property 14: Malformed Input Error Completeness
 *
 * For any input that is unreadable or in an unsupported format, the resulting error SHALL contain:
 * the input source name, the detected format (if determinable), and a specific failure reason string.
 * No partial Book representation SHALL be produced.
 *
 * Feature: universal-ebook-reader, Property 14: Malformed Input Error Completeness
 *
 * **Validates: Requirements 2.4, 9.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EPUBParserImpl, EPUBParseError } from '../epub-parser';

describe('Property 14: Malformed Input Error Completeness', () => {
  const parser = new EPUBParserImpl();

  it('random byte arrays always throw EPUBParseError with complete error info', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 1024 }),
        async (bytes) => {
          const buffer = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          ) as ArrayBuffer;

          let result: unknown = undefined;
          let error: unknown = undefined;

          try {
            result = await parser.parse(buffer);
          } catch (e) {
            error = e;
          }

          // No partial Book should be produced
          expect(result).toBeUndefined();

          // Must throw an EPUBParseError
          expect(error).toBeInstanceOf(EPUBParseError);

          const parseError = error as EPUBParseError;

          // Error must contain source name (non-empty string)
          expect(typeof parseError.source).toBe('string');
          expect(parseError.source.length).toBeGreaterThan(0);

          // Error must contain format (non-empty string)
          expect(typeof parseError.format).toBe('string');
          expect(parseError.format.length).toBeGreaterThan(0);

          // Error must contain failure reason (non-empty string)
          expect(typeof parseError.reason).toBe('string');
          expect(parseError.reason.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('random strings (not valid EPUB ZIP structures) always throw EPUBParseError with complete error info', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 2048 }),
        async (str) => {
          const encoder = new TextEncoder();
          const buffer = encoder.encode(str).buffer;

          let result: unknown = undefined;
          let error: unknown = undefined;

          try {
            result = await parser.parse(buffer);
          } catch (e) {
            error = e;
          }

          // No partial Book should be produced
          expect(result).toBeUndefined();

          // Must throw an EPUBParseError
          expect(error).toBeInstanceOf(EPUBParseError);

          const parseError = error as EPUBParseError;

          // Error fields must be non-empty strings
          expect(parseError.source.length).toBeGreaterThan(0);
          expect(parseError.format.length).toBeGreaterThan(0);
          expect(parseError.reason.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty ArrayBuffers always throw EPUBParseError with complete error info', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(new ArrayBuffer(0)),
        async (buffer) => {
          let result: unknown = undefined;
          let error: unknown = undefined;

          try {
            result = await parser.parse(buffer);
          } catch (e) {
            error = e;
          }

          // No partial Book should be produced
          expect(result).toBeUndefined();

          // Must throw an EPUBParseError
          expect(error).toBeInstanceOf(EPUBParseError);

          const parseError = error as EPUBParseError;

          // Error fields must be non-empty strings
          expect(parseError.source.length).toBeGreaterThan(0);
          expect(parseError.format.length).toBeGreaterThan(0);
          expect(parseError.reason.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('arrays of zeros/ones always throw EPUBParseError with complete error info', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.nat({ max: 2048 }),
          fc.constantFrom(0x00, 0x01, 0xFF)
        ),
        async ([length, fillByte]) => {
          const bytes = new Uint8Array(length);
          bytes.fill(fillByte);
          const buffer = bytes.buffer;

          let result: unknown = undefined;
          let error: unknown = undefined;

          try {
            result = await parser.parse(buffer);
          } catch (e) {
            error = e;
          }

          // No partial Book should be produced
          expect(result).toBeUndefined();

          // Must throw an EPUBParseError
          expect(error).toBeInstanceOf(EPUBParseError);

          const parseError = error as EPUBParseError;

          // Error fields must be non-empty strings
          expect(parseError.source.length).toBeGreaterThan(0);
          expect(parseError.format.length).toBeGreaterThan(0);
          expect(parseError.reason.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
