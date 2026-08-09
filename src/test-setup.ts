/**
 * Test setup file for vitest.
 * Provides localStorage polyfill for jsdom environment.
 */

import '@testing-library/jest-dom/vitest';

// window.matchMedia polyfill for jsdom (not implemented by default).
// Required by Mantine's color-scheme detection (useMantineColorScheme /
// MantineProvider) and other media-query-based hooks.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// ResizeObserver polyfill for jsdom (not implemented by default).
// Required by Mantine components that measure elements (e.g. SegmentedControl)
// and by floating-ui (used by Popover/Menu/Select/Combobox), which gates a
// floating element behind `display: none` until its `autoUpdate` positioning
// loop receives at least one ResizeObserver callback. A no-op mock leaves
// that gate closed forever, so this synchronously invokes the callback once
// per observed target to unblock it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback([{ target } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  };
}

// Element.scrollIntoView polyfill for jsdom (not implemented by default).
// Required by Mantine's Combobox (e.g. Select) to scroll the active option
// into view as it's navigated/opened.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

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
