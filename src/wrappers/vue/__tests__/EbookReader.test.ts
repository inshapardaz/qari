/**
 * Unit tests for the Vue 3 EbookReader wrapper component.
 *
 * Tests reactive prop updates, event emission, prop validation,
 * and mount/unmount lifecycle behavior.
 *
 * Requirements: 1.2, 1.6, 1.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { ReaderSource } from '../../../components/Reader';
import type { ReaderError } from '../../../models/events';

// ---------------------------------------------------------------------------
// Track props passed to React Reader via mocking the Reader module
// ---------------------------------------------------------------------------

let lastRenderedProps: Record<string, unknown> | null = null;
let renderCount = 0;

vi.mock('../../../components/Reader', () => ({
  Reader: 'MockedReader',
}));

// Mock react to track createElement calls
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    createElement: (...args: unknown[]) => {
      // Track calls that target the mocked Reader (string 'MockedReader')
      if (args[0] === 'MockedReader') {
        lastRenderedProps = args[1] as Record<string, unknown>;
        renderCount++;
      }
      return actual.createElement(...(args as Parameters<typeof actual.createElement>));
    },
  };
});

// Mock react-dom/client
const mockRender = vi.fn((element: unknown) => {
  // The element will be the result of createElement; not deeply useful here
  // but we verify render was called
});
const mockUnmount = vi.fn();
const mockCreateRoot = vi.fn((_container?: unknown) => ({
  render: mockRender,
  unmount: mockUnmount,
}));

vi.mock('react-dom/client', () => ({
  createRoot: (container: unknown) => mockCreateRoot(container),
}));

// Import AFTER mocks are set up
const { EbookReader } = await import('../EbookReader');

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createValidSource(): ReaderSource {
  return { type: 'markdown', content: '# Test Book\n\n## Chapter 1\n\nHello world' };
}

function createEpubSource(): ReaderSource {
  return { type: 'epub', data: new ArrayBuffer(100) };
}

function createUrlSource(): ReaderSource {
  return { type: 'url', url: 'https://example.com/book.epub' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EbookReader Vue Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastRenderedProps = null;
    renderCount = 0;
  });

  describe('Mount/Unmount Lifecycle', () => {
    it('should create a React root on mount', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      expect(mockCreateRoot).toHaveBeenCalledTimes(1);
      expect(mockRender).toHaveBeenCalled();
      wrapper.unmount();
    });

    it('should render a container div with correct class and data-testid', () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      const container = wrapper.find('[data-testid="ebook-reader-vue-wrapper"]');
      expect(container.exists()).toBe(true);
      expect(container.classes()).toContain('ebook-reader-vue-wrapper');
      wrapper.unmount();
    });

    it('should unmount React root on Vue component unmount', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();
      wrapper.unmount();

      expect(mockUnmount).toHaveBeenCalledTimes(1);
    });

    it('should pass the container element to createRoot', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      // createRoot should receive an HTMLDivElement
      const arg = (mockCreateRoot.mock.calls[0] as unknown[])[0];
      expect(arg).toBeInstanceOf(HTMLDivElement);
      wrapper.unmount();
    });
  });

  describe('Reactive Prop Updates Propagate to Reader', () => {
    it('should re-render React component when theme prop changes', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource(), theme: 'light' },
      });

      await flushPromises();
      const initialRenderCount = mockRender.mock.calls.length;

      await wrapper.setProps({ theme: 'dark' });
      await nextTick();
      await flushPromises();

      expect(mockRender.mock.calls.length).toBeGreaterThan(initialRenderCount);
      wrapper.unmount();
    });

    it('should re-render React component when fontSize prop changes', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource(), fontSize: 16 },
      });

      await flushPromises();
      const initialRenderCount = mockRender.mock.calls.length;

      await wrapper.setProps({ fontSize: 20 });
      await nextTick();
      await flushPromises();

      expect(mockRender.mock.calls.length).toBeGreaterThan(initialRenderCount);
      wrapper.unmount();
    });

    it('should re-render React component when zoom prop changes', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource(), zoom: 100 },
      });

      await flushPromises();
      const initialRenderCount = mockRender.mock.calls.length;

      await wrapper.setProps({ zoom: 150 });
      await nextTick();
      await flushPromises();

      expect(mockRender.mock.calls.length).toBeGreaterThan(initialRenderCount);
      wrapper.unmount();
    });

    it('should re-render React component when fontFamily prop changes', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource(), fontFamily: 'serif' },
      });

      await flushPromises();
      const initialRenderCount = mockRender.mock.calls.length;

      await wrapper.setProps({ fontFamily: 'monospace' });
      await nextTick();
      await flushPromises();

      expect(mockRender.mock.calls.length).toBeGreaterThan(initialRenderCount);
      wrapper.unmount();
    });

    it('should re-render React component when direction prop changes', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource(), direction: 'auto' },
      });

      await flushPromises();
      const initialRenderCount = mockRender.mock.calls.length;

      await wrapper.setProps({ direction: 'rtl' });
      await nextTick();
      await flushPromises();

      expect(mockRender.mock.calls.length).toBeGreaterThan(initialRenderCount);
      wrapper.unmount();
    });

    it('should re-render React component when source prop changes', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();
      const initialRenderCount = mockRender.mock.calls.length;

      await wrapper.setProps({ source: createUrlSource() });
      await nextTick();
      await flushPromises();

      expect(mockRender.mock.calls.length).toBeGreaterThan(initialRenderCount);
      wrapper.unmount();
    });
  });

  describe('Events Emitted Correctly on State Changes', () => {
    it('should emit error event when onError callback is invoked', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      // lastRenderedProps should have onError from the Reader props
      expect(lastRenderedProps).not.toBeNull();
      expect(lastRenderedProps!.onError).toBeDefined();

      const errorPayload: ReaderError = {
        code: 'LOAD_ERROR',
        message: 'File not found',
        source: 'test.epub',
      };
      (lastRenderedProps!.onError as (e: ReaderError) => void)(errorPayload);

      expect(wrapper.emitted('error')).toBeTruthy();
      expect(wrapper.emitted('error')![0]).toEqual([errorPayload]);
      wrapper.unmount();
    });

    it('should emit page-change event when onPageChange callback is invoked', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      const pageChangePayload = { chapter: 2, page: 5, progress: 42 };
      (lastRenderedProps!.onPageChange as (e: unknown) => void)(pageChangePayload);

      expect(wrapper.emitted('page-change')).toBeTruthy();
      expect(wrapper.emitted('page-change')![0]).toEqual([pageChangePayload]);
      wrapper.unmount();
    });

    it('should emit bookmark-create event when onBookmarkCreate callback is invoked', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      const bookmarkPayload = {
        type: 'created' as const,
        bookmark: {
          id: 'bm-1',
          bookId: 'book-1',
          chapterId: 'ch-1',
          position: 100,
          name: 'My Bookmark',
          createdAt: '2024-01-01T00:00:00Z',
        },
      };
      (lastRenderedProps!.onBookmarkCreate as (e: unknown) => void)(bookmarkPayload);

      expect(wrapper.emitted('bookmark-create')).toBeTruthy();
      expect(wrapper.emitted('bookmark-create')![0]).toEqual([bookmarkPayload]);
      wrapper.unmount();
    });

    it('should emit ready event when onReady callback is invoked', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      const readyPayload = {
        book: { title: 'Test Book', language: 'en' },
        chapterCount: 5,
        direction: 'ltr' as const,
      };
      (lastRenderedProps!.onReady as (e: unknown) => void)(readyPayload);

      expect(wrapper.emitted('ready')).toBeTruthy();
      expect(wrapper.emitted('ready')![0]).toEqual([readyPayload]);
      wrapper.unmount();
    });
  });

  describe('Prop Validation Errors Emit Error Event', () => {
    it('should emit error event for invalid source (missing data field)', async () => {
      const wrapper = mount(EbookReader, {
        props: {
          source: { type: 'epub' } as unknown as ReaderSource,
        },
      });

      await flushPromises();

      const emitted = wrapper.emitted('error');
      expect(emitted).toBeTruthy();
      expect(emitted!.length).toBeGreaterThanOrEqual(1);

      const error = emitted![0][0] as ReaderError;
      expect(error.code).toBe('PROP_VALIDATION_ERROR');
      expect(error.message).toContain('source');
      wrapper.unmount();
    });

    it('should emit error event for invalid theme value', async () => {
      const wrapper = mount(EbookReader, {
        props: {
          source: createValidSource(),
          theme: 'invalid-theme' as any,
        },
      });

      await flushPromises();

      const emitted = wrapper.emitted('error');
      expect(emitted).toBeTruthy();

      const error = emitted![0][0] as ReaderError;
      expect(error.code).toBe('PROP_VALIDATION_ERROR');
      expect(error.message).toContain('theme');
      wrapper.unmount();
    });

    it('should emit error event for invalid fontFamily value', async () => {
      const wrapper = mount(EbookReader, {
        props: {
          source: createValidSource(),
          fontFamily: 'comic-sans' as any,
        },
      });

      await flushPromises();

      const emitted = wrapper.emitted('error');
      expect(emitted).toBeTruthy();

      const error = emitted![0][0] as ReaderError;
      expect(error.code).toBe('PROP_VALIDATION_ERROR');
      expect(error.message).toContain('fontFamily');
      wrapper.unmount();
    });

    it('should emit error event for invalid direction value', async () => {
      const wrapper = mount(EbookReader, {
        props: {
          source: createValidSource(),
          direction: 'upside-down' as any,
        },
      });

      await flushPromises();

      const emitted = wrapper.emitted('error');
      expect(emitted).toBeTruthy();

      const error = emitted![0][0] as ReaderError;
      expect(error.code).toBe('PROP_VALIDATION_ERROR');
      expect(error.message).toContain('direction');
      wrapper.unmount();
    });

    it('should not render Reader when validation fails (renders empty div)', async () => {
      const wrapper = mount(EbookReader, {
        props: {
          source: createValidSource(),
          theme: 'broken' as any,
        },
      });

      await flushPromises();

      // When validation fails, the Reader component should NOT receive props
      // (lastRenderedProps stays null because createElement is called with 'div' not 'MockedReader')
      expect(lastRenderedProps).toBeNull();
      wrapper.unmount();
    });

    it('should not emit error for valid source types', async () => {
      // Test with markdown source
      const wrapper1 = mount(EbookReader, {
        props: { source: createValidSource() },
      });
      await flushPromises();
      expect(wrapper1.emitted('error')).toBeFalsy();
      wrapper1.unmount();

      vi.clearAllMocks();
      lastRenderedProps = null;

      // Test with epub source
      const wrapper2 = mount(EbookReader, {
        props: { source: createEpubSource() },
      });
      await flushPromises();
      expect(wrapper2.emitted('error')).toBeFalsy();
      wrapper2.unmount();

      vi.clearAllMocks();
      lastRenderedProps = null;

      // Test with url source
      const wrapper3 = mount(EbookReader, {
        props: { source: createUrlSource() },
      });
      await flushPromises();
      expect(wrapper3.emitted('error')).toBeFalsy();
      wrapper3.unmount();
    });
  });

  describe('Default Prop Values', () => {
    it('should use default prop values when not explicitly set', async () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      await flushPromises();

      expect(lastRenderedProps).not.toBeNull();
      expect(lastRenderedProps!.theme).toBe('light');
      expect(lastRenderedProps!.fontFamily).toBe('serif');
      expect(lastRenderedProps!.fontSize).toBe(16);
      expect(lastRenderedProps!.zoom).toBe(100);
      expect(lastRenderedProps!.direction).toBe('auto');
      wrapper.unmount();
    });
  });

  describe('Prop Forwarding to React Reader', () => {
    it('should pass all valid props to React Reader component', async () => {
      const source = createValidSource();
      const wrapper = mount(EbookReader, {
        props: {
          source,
          theme: 'dark',
          fontFamily: 'monospace',
          fontSize: 24,
          zoom: 150,
          direction: 'rtl',
        },
      });

      await flushPromises();

      expect(lastRenderedProps).not.toBeNull();
      expect(lastRenderedProps!.source).toEqual(source);
      expect(lastRenderedProps!.theme).toBe('dark');
      expect(lastRenderedProps!.fontFamily).toBe('monospace');
      expect(lastRenderedProps!.fontSize).toBe(24);
      expect(lastRenderedProps!.zoom).toBe(150);
      expect(lastRenderedProps!.direction).toBe('rtl');
      wrapper.unmount();
    });

    it('should pass dictionaryProviders and bookmarkAdapter props', async () => {
      const mockProvider = {
        id: 'test-dict',
        supportedLanguages: ['en'],
        lookup: vi.fn(),
      };
      const mockAdapter = {
        save: vi.fn(),
        load: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
      };

      const wrapper = mount(EbookReader, {
        props: {
          source: createValidSource(),
          dictionaryProviders: [mockProvider],
          bookmarkAdapter: mockAdapter,
        },
      });

      await flushPromises();

      expect(lastRenderedProps).not.toBeNull();
      expect(lastRenderedProps!.dictionaryProviders).toEqual([mockProvider]);
      expect(lastRenderedProps!.bookmarkAdapter).toEqual(mockAdapter);
      wrapper.unmount();
    });
  });

  describe('Multiple Unmount Safety', () => {
    it('should handle unmount gracefully without errors', () => {
      const wrapper = mount(EbookReader, {
        props: { source: createValidSource() },
      });

      // Unmount should not throw
      expect(() => wrapper.unmount()).not.toThrow();
    });
  });
});
