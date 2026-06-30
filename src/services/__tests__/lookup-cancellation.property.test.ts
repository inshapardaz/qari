/**
 * Property 15: Superseded lookup cancellation
 *
 * For any sequence of two or more lookup requests made in rapid succession,
 * all lookups except the most recent SHALL be cancelled (their AbortSignal
 * aborted), and only the result of the final lookup SHALL be presented to
 * the user.
 *
 * **Validates: Requirements 12.5**
 *
 * Feature: language-dictionaries, Property 15: Superseded lookup cancellation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DictionaryService } from '../dictionary-service';
import { DictionaryProvider, DictionaryResult } from '../../interfaces/dictionary';

describe('Feature: language-dictionaries, Property 15: Superseded lookup cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Creates a mock provider that captures the AbortSignal passed to each
   * lookup call. The provider delays its response so that multiple lookups
   * can be fired before any resolve.
   */
  function createSignalCapturingProvider(language: string): {
    provider: DictionaryProvider;
    capturedSignals: AbortSignal[];
    resolvers: Array<(result: DictionaryResult) => void>;
  } {
    const capturedSignals: AbortSignal[] = [];
    const resolvers: Array<(result: DictionaryResult) => void> = [];

    const provider: DictionaryProvider = {
      id: 'test-provider',
      supportedLanguages: [language],
      category: 'online',
      lookup: vi.fn((word: string, lang: string, _context: string, signal?: AbortSignal) => {
        if (signal) {
          capturedSignals.push(signal);
        }
        return new Promise<DictionaryResult>((resolve, reject) => {
          resolvers.push(resolve);
          // If signal is already aborted, reject immediately
          if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          // Listen for abort to reject the promise
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    };

    return { provider, capturedSignals, resolvers };
  }

  it('all lookups except the most recent have their AbortSignal aborted', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a sequence of 2-10 words to look up rapidly
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,20}$/), { minLength: 2, maxLength: 10 }),
        async (words) => {
          const { provider, capturedSignals } = createSignalCapturingProvider('en');

          const service = new DictionaryService();
          service.registerProvider(provider, 'online');

          // Fire all lookups rapidly without awaiting (simulates rapid user input)
          const promises = words.map((word) =>
            service.lookup(word, 'en', 'some text with words', 0)
          );

          // Wait a tick to let all lookups register their signals
          await new Promise((resolve) => setTimeout(resolve, 0));

          // All signals except the last one should be aborted
          for (let i = 0; i < capturedSignals.length - 1; i++) {
            expect(capturedSignals[i].aborted).toBe(true);
          }

          // The last signal should NOT be aborted
          const lastSignal = capturedSignals[capturedSignals.length - 1];
          expect(lastSignal.aborted).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only the final lookup result is returned to the caller', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 words for rapid lookups
        fc.array(fc.stringMatching(/^[a-zA-Z]{1,20}$/), { minLength: 2, maxLength: 5 }),
        async (words) => {
          const capturedSignals: AbortSignal[] = [];

          const provider: DictionaryProvider = {
            id: 'test-provider',
            supportedLanguages: ['en'],
            category: 'online',
            lookup: vi.fn(
              (word: string, lang: string, _context: string, signal?: AbortSignal) => {
                if (signal) {
                  capturedSignals.push(signal);
                }
                return new Promise<DictionaryResult>((resolve, reject) => {
                  // Simulate async delay
                  const timer = setTimeout(() => {
                    resolve({
                      word,
                      language: lang,
                      definitions: [{ meaning: `Definition of ${word}` }],
                    });
                  }, 10);

                  // If signal is already aborted, reject with AbortError
                  if (signal?.aborted) {
                    clearTimeout(timer);
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    reject(err);
                    return;
                  }

                  signal?.addEventListener('abort', () => {
                    clearTimeout(timer);
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    reject(err);
                  });
                });
              }
            ),
          };

          const service = new DictionaryService();
          service.registerProvider(provider, 'online');

          // Fire all lookups rapidly without awaiting
          const promises = words.map((word) =>
            service.lookup(word, 'en', 'some text with words', 0)
          );

          // Await all promises
          const results = await Promise.all(promises);

          // The last result should contain the last word's definition
          const lastResult = results[results.length - 1];
          const lastWord = words[words.length - 1];
          expect(lastResult.word).toBe(lastWord);
          expect(lastResult.definitions).toEqual([
            { meaning: `Definition of ${lastWord}` },
          ]);

          // All earlier results should have empty definitions (cancelled)
          for (let i = 0; i < results.length - 1; i++) {
            // Cancelled lookups return { word, language, definitions: [] }
            expect(results[i].definitions).toEqual([]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cancelCurrentLookup aborts the current signal immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z]{1,20}$/),
        async (word) => {
          const { provider, capturedSignals } = createSignalCapturingProvider('en');

          const service = new DictionaryService();
          service.registerProvider(provider, 'online');

          // Start a lookup
          const promise = service.lookup(word, 'en', 'text', 0);

          // Wait a tick so the lookup starts
          await new Promise((resolve) => setTimeout(resolve, 0));

          // Signal should exist and not be aborted yet
          expect(capturedSignals.length).toBe(1);
          expect(capturedSignals[0].aborted).toBe(false);

          // Cancel manually
          service.cancelCurrentLookup();

          // Signal should now be aborted
          expect(capturedSignals[0].aborted).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
