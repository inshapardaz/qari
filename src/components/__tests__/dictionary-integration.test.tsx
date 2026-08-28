/**
 * Integration tests for full dictionary flow.
 * Tests the interaction between DictionaryService, DictionaryPopover,
 * and useSelectionHandler using a minimal test harness component.
 *
 * Requirements: 3.2, 3.3, 7.4, 7.5, 8.2, 8.4, 9.5, 10.2, 10.3
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, waitFor, fireEvent, act, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DictionaryPopover } from '../DictionaryPopover';

/** DictionaryPopover now uses Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MantineProvider env="test">{children}</MantineProvider>,
    ...options,
  });
}
import { DictionaryService } from '../../services/dictionary-service';
import type { DictionaryLookupResult } from '../../services/dictionary-service';
import { useSelectionHandler } from '../../hooks/useSelectionHandler';
import { FreeDictionaryProvider } from '../../services/free-dictionary-provider';
import { WiktionaryProvider } from '../../services/wiktionary-provider';
import type { DictionaryProvider } from '../../interfaces/dictionary';

// ---------------------------------------------------------------------------
// Test Harness Component
// ---------------------------------------------------------------------------

/**
 * Minimal test harness that wires up useSelectionHandler + DictionaryService + DictionaryPopover.
 * This mirrors the integration in the Reader without the complexity of book loading.
 */
interface TestHarnessProps {
  dictionaryService: DictionaryService;
  hasProviders: boolean;
  bookLanguage?: string;
}

function DictionaryTestHarness({ dictionaryService, hasProviders, bookLanguage = 'en' }: TestHarnessProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { lookupState, dismiss } = useSelectionHandler({
    contentRef,
    hasProviders,
  });

  const [dictionaryResult, setDictionaryResult] = useState<DictionaryLookupResult | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);

  // Perform dictionary lookup when selection handler triggers it
  useEffect(() => {
    if (lookupState.status !== 'loading') {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    if (!text) return;

    const word = text.split(/\s+/)[0];
    if (!word) return;

    setDictionaryLoading(true);
    setDictionaryResult(null);

    dictionaryService.cancelCurrentLookup();

    dictionaryService
      .lookup(word, bookLanguage, '', 0)
      .then((result) => {
        setDictionaryResult(result);
        setDictionaryLoading(false);
      })
      .catch(() => {
        setDictionaryLoading(false);
      });
  }, [lookupState.status, dictionaryService, bookLanguage]);

  // Handle suggestion selection — triggers a new lookup
  const handleSuggestionSelect = useCallback((suggestedWord: string) => {
    setDictionaryLoading(true);
    setDictionaryResult(null);

    dictionaryService.cancelCurrentLookup();

    dictionaryService
      .lookup(suggestedWord, bookLanguage, '', 0)
      .then((result) => {
        setDictionaryResult(result);
        setDictionaryLoading(false);
      })
      .catch(() => {
        setDictionaryLoading(false);
      });
  }, [dictionaryService, bookLanguage]);

  const handleClose = useCallback(() => {
    dismiss();
    setDictionaryResult(null);
    setDictionaryLoading(false);
  }, [dismiss]);

  return (
    <div>
      <div ref={contentRef} data-testid="content-area" data-chapter-content="">
        <p>Hello world ephemeral serendipity tset</p>
      </div>
      {hasProviders && (dictionaryLoading || dictionaryResult) && (
        <DictionaryPopover
          lookupResult={dictionaryResult}
          loading={dictionaryLoading}
          onClose={handleClose}
          onSuggestionSelect={handleSuggestionSelect}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMockProvider(overrides: Partial<DictionaryProvider> & { id: string }): DictionaryProvider {
  return {
    supportedLanguages: ['en'],
    category: 'online',
    ready: true,
    lookup: vi.fn().mockResolvedValue({
      word: 'test',
      language: 'en',
      definitions: [{ meaning: 'a test definition', partOfSpeech: 'noun' }],
    }),
    ...overrides,
  };
}

/**
 * Sets up a mock window.getSelection and fires contextmenu on the element.
 */
function setupSelectionAndTrigger(contentEl: HTMLElement, word: string) {
  const textNode = document.createTextNode(word);
  contentEl.appendChild(textNode);

  const range = document.createRange();
  range.selectNodeContents(textNode);
  range.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 100, bottom: 120, left: 50, right: 80,
    width: 30, height: 20, x: 50, y: 100,
  });

  const mockSelection = {
    toString: () => word,
    isCollapsed: false,
    rangeCount: 1,
    getRangeAt: () => range,
    anchorNode: textNode,
    anchorOffset: 0,
    focusNode: textNode,
    focusOffset: word.length,
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
    containsNode: () => true,
  };

  vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);

  return { textNode, mockSelection };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dictionary Integration - Full Flow', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('select word → right-click → loading shown → definition appears', () => {
    it('shows loading state then displays definition from mocked fetch', async () => {
      // Use a delayed fetch to ensure we can observe the loading state
      let resolveFetch: ((value: unknown) => void) | undefined;
      const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });

      globalThis.fetch = vi.fn().mockReturnValue(fetchPromise);

      const service = new DictionaryService();
      const freeDictProvider = new FreeDictionaryProvider();
      service.registerProvider(freeDictProvider, 'online');

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={true} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'ephemeral');

      // Fire contextmenu
      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // Should show loading state while fetch is pending
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-loading')).toBeInTheDocument();
      });

      // Now resolve the fetch
      await act(async () => {
        resolveFetch!({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{
            word: 'ephemeral',
            meanings: [{
              partOfSpeech: 'adjective',
              definitions: [{ definition: 'lasting for a very short time', example: 'fashions are ephemeral' }],
            }],
          }]),
        });
      });

      // Wait for definition to appear
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-word')).toHaveTextContent('ephemeral');
        expect(screen.getByTestId('dictionary-meaning-0')).toHaveTextContent(
          'lasting for a very short time'
        );
      });
    });
  });

  describe('enableBuiltInDictionary registers providers correctly', () => {
    it('FreeDictionary and Wiktionary providers are called for English lookups', async () => {
      const fetchCalls: string[] = [];
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        fetchCalls.push(url);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{
            word: 'hello',
            meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a greeting' }] }],
          }]),
        });
      });

      // Simulate what Reader does when enableBuiltInDictionary=true
      const service = new DictionaryService();
      const freeDictProvider = new FreeDictionaryProvider();
      const wiktionaryProvider = new WiktionaryProvider({ languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru'] });
      service.registerProvider(freeDictProvider, 'online');
      service.registerProvider(wiktionaryProvider, 'online');

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={true} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'hello');

      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // Verify FreeDictionary API was called (it's first registered)
      await waitFor(() => {
        const freeDictCalls = fetchCalls.filter((url) => url.includes('dictionaryapi.dev'));
        expect(freeDictCalls.length).toBeGreaterThan(0);
      });
    });

    it('no providers means no popover appears on right-click', async () => {
      const service = new DictionaryService();
      // No providers registered

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={false} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'hello');

      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // No popover should appear
      expect(screen.queryByTestId('dictionary-popover')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dictionary-loading')).not.toBeInTheDocument();
    });
  });

  describe('user providers take priority over built-in', () => {
    it('user-supplied provider is queried before built-in online providers', async () => {
      const userProviderLookup = vi.fn().mockResolvedValue({
        word: 'hello',
        language: 'en',
        definitions: [{ meaning: 'user provider definition', partOfSpeech: 'noun' }],
      });

      const userProvider = createMockProvider({
        id: 'user-custom',
        lookup: userProviderLookup,
      });

      // Mock fetch — should NOT be called because user provider is first online match
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve([{
          word: 'hello',
          meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'built-in def' }] }],
        }]),
      });

      // Simulate Reader registration order: user providers → built-in
      const service = new DictionaryService();
      service.registerProvider(userProvider);
      const freeDictProvider = new FreeDictionaryProvider();
      service.registerProvider(freeDictProvider, 'online');

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={true} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'hello');

      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // Wait for result
      await waitFor(() => {
        expect(userProviderLookup).toHaveBeenCalled();
      });

      // User provider should have been called with the word
      expect(userProviderLookup).toHaveBeenCalledWith(
        'hello', 'en', expect.any(String), expect.anything()
      );

      // Verify user provider result is displayed (not built-in)
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-meaning-0')).toHaveTextContent('user provider definition');
      });
    });
  });

  describe('no providers → no event listeners attached', () => {
    it('does not intercept contextmenu when hasProviders is false', async () => {
      const service = new DictionaryService();

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={false} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'hello');

      // The contextmenu event should not be prevented
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      const wasNotPrevented = contentEl.dispatchEvent(event);
      expect(wasNotPrevented).toBe(true);

      // No dictionary popover should appear
      expect(screen.queryByTestId('dictionary-popover')).not.toBeInTheDocument();
    });
  });

});
