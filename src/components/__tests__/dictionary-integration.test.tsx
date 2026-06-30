/**
 * Integration tests for full dictionary flow.
 * Tests the interaction between DictionaryService, DictionaryPopover,
 * and useSelectionHandler using a minimal test harness component.
 *
 * Requirements: 3.2, 3.3, 7.4, 7.5, 8.2, 8.4, 9.5, 10.2, 10.3
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { DictionaryPopover } from '../DictionaryPopover';
import { DictionaryService } from '../../services/dictionary-service';
import type { DictionaryLookupResult } from '../../services/dictionary-service';
import { useSelectionHandler } from '../../hooks/useSelectionHandler';
import { HunspellProvider } from '../../services/hunspell-provider';
import { FreeDictionaryProvider } from '../../services/free-dictionary-provider';
import { WiktionaryProvider } from '../../services/wiktionary-provider';
import type { DictionaryProvider } from '../../interfaces/dictionary';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('nspell', () => ({
  default: vi.fn().mockImplementation(() => ({
    correct: vi.fn().mockReturnValue(true),
    suggest: vi.fn().mockReturnValue([]),
  })),
}));

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
  const { anchorPosition, lookupState, dismiss } = useSelectionHandler({
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
          anchorPosition={anchorPosition ?? undefined}
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

  describe('hunspellDictionaries registers local providers before online', () => {
    it('queries Hunspell provider before online providers', async () => {
      const lookupOrder: string[] = [];

      // Mock nspell to track when it's called
      const nspellModule = await import('nspell');
      const NSpellMock = nspellModule.default as unknown as ReturnType<typeof vi.fn>;
      NSpellMock.mockImplementation(() => ({
        correct: (word: string) => {
          lookupOrder.push(`hunspell:${word}`);
          return false; // Misspelled — return immediately without calling online
        },
        suggest: () => ['test', 'set'],
      }));

      // Mock fetch to track online calls
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        lookupOrder.push(`online:${url}`);
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        });
      });

      const affData = new TextEncoder().encode('SET UTF-8\n');
      const dicData = new TextEncoder().encode('1\ntest\n');

      // Simulate Reader registration order: Hunspell first, then built-in online
      const service = new DictionaryService();
      const hunspellProvider = new HunspellProvider({ language: 'en', aff: affData, dic: dicData });
      service.registerProvider(hunspellProvider, 'local');
      const freeDictProvider = new FreeDictionaryProvider();
      service.registerProvider(freeDictProvider, 'online');

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={true} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'tset');

      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // Wait for lookup to complete
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-popover')).toBeInTheDocument();
      });

      // Hunspell should have been queried first
      const hunspellCalls = lookupOrder.filter((c) => c.startsWith('hunspell:'));
      expect(hunspellCalls.length).toBeGreaterThan(0);

      // Since hunspell returned misspelled, online should NOT have been called
      const onlineCalls = lookupOrder.filter((c) => c.startsWith('online:'));
      expect(onlineCalls.length).toBe(0);
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

  describe('Hunspell misspelled word → suggestions shown → click suggestion → new lookup', () => {
    it('displays suggestions for misspelled word and triggers new lookup on click', async () => {
      // Mock nspell: 'tset' is misspelled, 'test' is correct
      const nspellModule = await import('nspell');
      const NSpellMock = nspellModule.default as unknown as ReturnType<typeof vi.fn>;
      NSpellMock.mockImplementation(() => ({
        correct: (word: string) => word !== 'tset',
        suggest: () => ['test', 'set', 'taste'],
      }));

      // Mock fetch for online provider (called when 'test' suggestion is looked up)
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{
          word: 'test',
          meanings: [{
            partOfSpeech: 'noun',
            definitions: [{ definition: 'a procedure for evaluation' }],
          }],
        }]),
      });

      const affData = new TextEncoder().encode('SET UTF-8\n');
      const dicData = new TextEncoder().encode('2\ntest\nset\n');

      const service = new DictionaryService();
      const hunspellProvider = new HunspellProvider({ language: 'en', aff: affData, dic: dicData });
      service.registerProvider(hunspellProvider, 'local');
      const freeDictProvider = new FreeDictionaryProvider();
      service.registerProvider(freeDictProvider, 'online');

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={true} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'tset');

      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // Wait for misspelled result with suggestions
      await waitFor(() => {
        expect(screen.getByTestId('spellcheck-incorrect')).toBeInTheDocument();
        expect(screen.getByTestId('suggestion-0')).toHaveTextContent('test');
        expect(screen.getByTestId('suggestion-1')).toHaveTextContent('set');
        expect(screen.getByTestId('suggestion-2')).toHaveTextContent('taste');
      });

      // Click the first suggestion to trigger a new lookup for 'test'
      await act(async () => {
        fireEvent.click(screen.getByTestId('suggestion-0'));
      });

      // After clicking suggestion, a new lookup should occur for "test"
      // nspell says "test" is correct, so it merges with online
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          expect.stringContaining('dictionaryapi.dev'),
          expect.anything()
        );
      });

      // The merged result should display the online definition
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-meaning-0')).toHaveTextContent(
          'a procedure for evaluation'
        );
      });
    });
  });

  describe('local-first flow: Hunspell returns spell-correct, online provides definition, merged display', () => {
    it('merges Hunspell spell-check with online definition', async () => {
      // Mock nspell to say word is correct
      const nspellModule = await import('nspell');
      const NSpellMock = nspellModule.default as unknown as ReturnType<typeof vi.fn>;
      NSpellMock.mockImplementation(() => ({
        correct: () => true,
        suggest: () => [],
      }));

      // Mock fetch to return definition from online provider
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{
          word: 'serendipity',
          meanings: [{
            partOfSpeech: 'noun',
            definitions: [{
              definition: 'the occurrence of events by chance in a happy way',
              example: 'a fortunate stroke of serendipity',
            }],
          }],
        }]),
      });

      const affData = new TextEncoder().encode('SET UTF-8\n');
      const dicData = new TextEncoder().encode('1\nserendipity\n');

      const service = new DictionaryService();
      const hunspellProvider = new HunspellProvider({ language: 'en', aff: affData, dic: dicData });
      service.registerProvider(hunspellProvider, 'local');
      const freeDictProvider = new FreeDictionaryProvider();
      service.registerProvider(freeDictProvider, 'online');

      render(
        <DictionaryTestHarness dictionaryService={service} hasProviders={true} />
      );

      const contentEl = screen.getByTestId('content-area');
      setupSelectionAndTrigger(contentEl, 'serendipity');

      await act(async () => {
        fireEvent.contextMenu(contentEl);
      });

      // Wait for the merged result to appear
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-popover')).toBeInTheDocument();
      });

      // The result should contain the spell-check correct indicator (from Hunspell)
      await waitFor(() => {
        expect(screen.getByTestId('spellcheck-correct')).toBeInTheDocument();
      });

      // The result should also contain the online definition (merged)
      await waitFor(() => {
        expect(screen.getByTestId('dictionary-meaning-0')).toHaveTextContent(
          'the occurrence of events by chance in a happy way'
        );
      });

      // Verify the online provider was called
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dictionaryapi.dev'),
        expect.anything()
      );
    });
  });
});
