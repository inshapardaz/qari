/**
 * Test setup file for vitest.
 * Provides localStorage polyfill for jsdom environment.
 */

import '@testing-library/jest-dom/vitest';

// localStorage polyfill for jsdom (not available by default in newer Node.js versions)
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  const localStorageMock: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
}
