/**
 * Properties 8–10: HookStore Delegation, Missing Callback, Error Propagation
 *
 * Property 8: HookStore Delegates to Callbacks
 * For any Bookmark object and any bookId string, each HookStore method (save, load,
 * remove, list, update) SHALL invoke the corresponding callback function with the exact
 * arguments passed to the method, and SHALL return the callback's resolved value unmodified.
 *
 * Property 9: Missing Callback Rejects
 * For any HookStore instance constructed without a specific callback, calling the
 * corresponding method SHALL reject the Promise with an error indicating the operation
 * is not supported.
 *
 * Property 10: Callback Error Propagation
 * For any HookStore callback that rejects with an Error, the corresponding store method
 * SHALL reject with the same error (identical message and type).
 *
 * Feature: bookmarks-property, Properties 8–10: HookStore Delegation
 *
 * **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { HookStore } from '../hook-store';
import type { Bookmark } from '../../models/bookmark';
import type { HookStoreCallbacks } from '../../interfaces/bookmark-store';

// --- Generators ---

const alphanumChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Alphanumeric string generator using constantFrom (compatible with project's fast-check version).
 */
const alphanumStringArb = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.stringOf(fc.constantFrom(...alphanumChars.split('')), { minLength, maxLength });

/**
 * Generates a valid Bookmark object with arbitrary field values.
 */
const bookmarkArb: fc.Arbitrary<Bookmark> = fc.record({
  id: fc.uuid(),
  bookId: alphanumStringArb(1, 20),
  chapterId: alphanumStringArb(1, 20),
  position: fc.nat({ max: 100000 }),
  name: alphanumStringArb(1, 50),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: undefined }),
});

/**
 * Generates a bookId string.
 */
const bookIdArb: fc.Arbitrary<string> = alphanumStringArb(1, 20);

/**
 * Generates a bookmarkId string (for remove operations).
 */
const bookmarkIdArb: fc.Arbitrary<string> = fc.uuid();

/**
 * Generates an array of bookmarks (for list/load return values).
 */
const bookmarkArrayArb: fc.Arbitrary<Bookmark[]> = fc.array(bookmarkArb, {
  minLength: 0,
  maxLength: 10,
});

/**
 * Generates a non-empty error message string.
 */
const errorMessageArb: fc.Arbitrary<string> = alphanumStringArb(1, 50);

// --- Tests ---

describe('Property 8: HookStore Delegates to Callbacks', () => {
  it('save invokes onSave with exact bookmark and returns void', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, async (bookmark) => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const store = new HookStore({ onSave });

        await store.save(bookmark);

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalledWith(bookmark);
      }),
      { numRuns: 100 }
    );
  });

  it('load invokes onLoad with exact bookId and returns unmodified array', async () => {
    await fc.assert(
      fc.asyncProperty(bookIdArb, bookmarkArrayArb, async (bookId, expectedResult) => {
        const onLoad = vi.fn().mockResolvedValue(expectedResult);
        const store = new HookStore({ onLoad });

        const result = await store.load(bookId);

        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(onLoad).toHaveBeenCalledWith(bookId);
        expect(result).toBe(expectedResult);
      }),
      { numRuns: 100 }
    );
  });

  it('list invokes onList with no arguments and returns unmodified array', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArrayArb, async (expectedResult) => {
        const onList = vi.fn().mockResolvedValue(expectedResult);
        const store = new HookStore({ onList });

        const result = await store.list();

        expect(onList).toHaveBeenCalledTimes(1);
        expect(onList).toHaveBeenCalledWith();
        expect(result).toBe(expectedResult);
      }),
      { numRuns: 100 }
    );
  });

  it('remove invokes onRemove with exact bookmarkId and returns void', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkIdArb, async (bookmarkId) => {
        const onRemove = vi.fn().mockResolvedValue(undefined);
        const store = new HookStore({ onRemove });

        await store.remove(bookmarkId);

        expect(onRemove).toHaveBeenCalledTimes(1);
        expect(onRemove).toHaveBeenCalledWith(bookmarkId);
      }),
      { numRuns: 100 }
    );
  });

  it('update invokes onUpdate with exact bookmark and returns void', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, async (bookmark) => {
        const onUpdate = vi.fn().mockResolvedValue(undefined);
        const store = new HookStore({ onUpdate });

        await store.update(bookmark);

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate).toHaveBeenCalledWith(bookmark);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 9: Missing Callback Rejects', () => {
  it('save rejects with "not supported" when onSave is missing', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, async (bookmark) => {
        const store = new HookStore({});

        await expect(store.save(bookmark)).rejects.toThrow('operation not supported');
      }),
      { numRuns: 100 }
    );
  });

  it('load rejects with "not supported" when onLoad is missing', async () => {
    await fc.assert(
      fc.asyncProperty(bookIdArb, async (bookId) => {
        const store = new HookStore({});

        await expect(store.load(bookId)).rejects.toThrow('operation not supported');
      }),
      { numRuns: 100 }
    );
  });

  it('list rejects with "not supported" when onList is missing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const store = new HookStore({});

        await expect(store.list()).rejects.toThrow('operation not supported');
      }),
      { numRuns: 100 }
    );
  });

  it('remove rejects with "not supported" when onRemove is missing', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkIdArb, async (bookmarkId) => {
        const store = new HookStore({});

        await expect(store.remove(bookmarkId)).rejects.toThrow('operation not supported');
      }),
      { numRuns: 100 }
    );
  });

  it('update rejects with "not supported" when onUpdate is missing', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, async (bookmark) => {
        const store = new HookStore({});

        await expect(store.update(bookmark)).rejects.toThrow('operation not supported');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 10: Callback Error Propagation', () => {
  it('save propagates onSave rejection with same message', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, errorMessageArb, async (bookmark, errorMsg) => {
        const onSave = vi.fn().mockRejectedValue(new Error(errorMsg));
        const store = new HookStore({ onSave });

        await expect(store.save(bookmark)).rejects.toThrow(errorMsg);
      }),
      { numRuns: 100 }
    );
  });

  it('load propagates onLoad rejection with same message', async () => {
    await fc.assert(
      fc.asyncProperty(bookIdArb, errorMessageArb, async (bookId, errorMsg) => {
        const onLoad = vi.fn().mockRejectedValue(new Error(errorMsg));
        const store = new HookStore({ onLoad });

        await expect(store.load(bookId)).rejects.toThrow(errorMsg);
      }),
      { numRuns: 100 }
    );
  });

  it('list propagates onList rejection with same message', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArb, async (errorMsg) => {
        const onList = vi.fn().mockRejectedValue(new Error(errorMsg));
        const store = new HookStore({ onList });

        await expect(store.list()).rejects.toThrow(errorMsg);
      }),
      { numRuns: 100 }
    );
  });

  it('remove propagates onRemove rejection with same message', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkIdArb, errorMessageArb, async (bookmarkId, errorMsg) => {
        const onRemove = vi.fn().mockRejectedValue(new Error(errorMsg));
        const store = new HookStore({ onRemove });

        await expect(store.remove(bookmarkId)).rejects.toThrow(errorMsg);
      }),
      { numRuns: 100 }
    );
  });

  it('update propagates onUpdate rejection with same message', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, errorMessageArb, async (bookmark, errorMsg) => {
        const onUpdate = vi.fn().mockRejectedValue(new Error(errorMsg));
        const store = new HookStore({ onUpdate });

        await expect(store.update(bookmark)).rejects.toThrow(errorMsg);
      }),
      { numRuns: 100 }
    );
  });

  it('callback error type is preserved (TypeError)', async () => {
    await fc.assert(
      fc.asyncProperty(bookmarkArb, errorMessageArb, async (bookmark, errorMsg) => {
        const typeError = new TypeError(errorMsg);
        const onSave = vi.fn().mockRejectedValue(typeError);
        const store = new HookStore({ onSave });

        try {
          await store.save(bookmark);
          expect.fail('should have rejected');
        } catch (err) {
          expect(err).toBeInstanceOf(TypeError);
          expect((err as TypeError).message).toBe(errorMsg);
        }
      }),
      { numRuns: 100 }
    );
  });
});
