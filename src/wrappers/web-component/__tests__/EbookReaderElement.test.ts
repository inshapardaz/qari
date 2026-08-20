/**
 * Unit tests for EbookReaderElement Web Component wrapper.
 *
 * Tests focus on wrapper logic: attribute handling, property storage,
 * event dispatch, and lifecycle management. Full React rendering inside
 * Shadow DOM is not tested here since jsdom has limited Shadow DOM support.
 *
 * Validates: Requirements 1.3, 1.5, 1.6, 1.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock react-dom/client to avoid actual React rendering in Shadow DOM
vi.mock('react-dom/client', () => {
  const mockRoot = {
    render: vi.fn(),
    unmount: vi.fn(),
  };
  return {
    createRoot: vi.fn(() => mockRoot),
  };
});

// Mock the Reader component
vi.mock('../../../components/Reader', () => ({
  Reader: vi.fn(() => null),
}));

import { EbookReaderElement } from '../EbookReaderElement';
import { createRoot } from 'react-dom/client';

describe('EbookReaderElement', () => {
  let element: EbookReaderElement;

  beforeEach(() => {
    element = document.createElement('ebook-reader') as EbookReaderElement;
  });

  afterEach(() => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  // -------------------------------------------------------------------------
  // Shadow DOM creation and style encapsulation (Requirement 1.5)
  // -------------------------------------------------------------------------

  describe('Shadow DOM creation and style encapsulation', () => {
    it('creates a Shadow DOM when connected to the document', () => {
      document.body.appendChild(element);

      expect(element.shadowRoot).not.toBeNull();
      expect(element.shadowRoot!.mode).toBe('open');
    });

    it('creates a container div inside the Shadow DOM', () => {
      document.body.appendChild(element);

      const container = element.shadowRoot!.querySelector('div');
      expect(container).not.toBeNull();
      expect(container!.getAttribute('style')).toContain('width: 100%');
      expect(container!.getAttribute('style')).toContain('height: 100%');
    });

    it('mounts React root inside Shadow DOM container', () => {
      document.body.appendChild(element);

      expect(createRoot).toHaveBeenCalledWith(
        element.shadowRoot!.querySelector('div')
      );
    });

    it('encapsulates styles within Shadow DOM boundary', () => {
      document.body.appendChild(element);

      // Shadow DOM content should not be accessible via document.querySelector
      const containerFromDocument = document.querySelector('ebook-reader > div');
      expect(containerFromDocument).toBeNull();

      // But accessible via shadowRoot
      const containerFromShadow = element.shadowRoot!.querySelector('div');
      expect(containerFromShadow).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Attribute changes update Reader (Requirement 1.3)
  // -------------------------------------------------------------------------

  describe('Attribute changes update Reader', () => {
    it('processes theme attribute change', () => {
      document.body.appendChild(element);
      element.setAttribute('theme', 'dark');

      expect(element.theme).toBe('dark');
    });

    it('processes font-family attribute change', () => {
      document.body.appendChild(element);
      element.setAttribute('font-family', 'sans-serif');

      expect(element.fontFamily).toBe('sans-serif');
    });

    it('processes font-size attribute change', () => {
      document.body.appendChild(element);
      element.setAttribute('font-size', '20');

      expect(element.fontSize).toBe(20);
    });

    it('processes zoom attribute change', () => {
      document.body.appendChild(element);
      element.setAttribute('zoom', '150');

      expect(element.zoom).toBe(150);
    });

    it('processes direction attribute change', () => {
      document.body.appendChild(element);
      element.setAttribute('direction', 'rtl');

      expect(element.direction).toBe('rtl');
    });

    it('triggers re-render when valid attribute changes', () => {
      document.body.appendChild(element);
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      // Set source so render will actually call render (not just render null)
      element.source = { type: 'markdown', content: '# Test' };
      const renderCallCount = mockRoot.render.mock.calls.length;

      element.setAttribute('theme', 'calm');

      // Should have triggered another render
      expect(mockRoot.render.mock.calls.length).toBeGreaterThan(renderCallCount);
    });

    it('has correct observedAttributes', () => {
      expect(EbookReaderElement.observedAttributes).toEqual([
        'theme',
        'font-family',
        'font-size',
        'zoom',
        'direction',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // JavaScript property API for complex values (Requirement 1.3)
  // -------------------------------------------------------------------------

  describe('JavaScript property API for complex values', () => {
    it('stores source property', () => {
      const source = { type: 'markdown' as const, content: '# Hello World' };
      element.source = source;

      expect(element.source).toBe(source);
    });

    it('stores dictionaryProviders property', () => {
      const providers = [
        { language: 'en', lookup: vi.fn() },
      ];
      element.dictionaryProviders = providers as any;

      expect(element.dictionaryProviders).toBe(providers);
    });

    it('stores bookmarkAdapter property', () => {
      const adapter = {
        save: vi.fn(),
        load: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
      };
      element.bookmarkAdapter = adapter as any;

      expect(element.bookmarkAdapter).toBe(adapter);
    });

    it('triggers re-render when source is set while connected', () => {
      document.body.appendChild(element);
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      const renderCallsBefore = mockRoot.render.mock.calls.length;

      element.source = { type: 'markdown', content: '# New Content' };

      expect(mockRoot.render.mock.calls.length).toBeGreaterThan(renderCallsBefore);
    });

    it('triggers re-render when dictionaryProviders is set while connected', () => {
      document.body.appendChild(element);
      element.source = { type: 'markdown', content: '# Test' };
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      const renderCallsBefore = mockRoot.render.mock.calls.length;

      element.dictionaryProviders = [];

      expect(mockRoot.render.mock.calls.length).toBeGreaterThan(renderCallsBefore);
    });

    it('does not trigger render when setting properties before connect', () => {
      // Element not yet appended to DOM
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      const renderCallsBefore = mockRoot?.render?.mock.calls.length ?? 0;

      element.source = { type: 'markdown', content: '# Test' };
      element.dictionaryProviders = [];

      // Should not have called render since not connected
      const renderCallsAfter = mockRoot?.render?.mock.calls.length ?? 0;
      expect(renderCallsAfter).toBe(renderCallsBefore);
    });

    it('supports setting source to null', () => {
      element.source = { type: 'markdown', content: '# Test' };
      element.source = null;

      expect(element.source).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // CustomEvent dispatch on state changes (Requirement 1.6)
  // -------------------------------------------------------------------------

  describe('CustomEvent dispatch on state changes', () => {
    it('dispatches error CustomEvent when source is missing on render', () => {
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      document.body.appendChild(element);

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event).toBeInstanceOf(CustomEvent);
      expect(event.detail.code).toBe('MISSING_PROP');
      expect(event.detail.message).toContain('source');
    });

    it('error CustomEvent has bubbles and composed properties', () => {
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      document.body.appendChild(element);

      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    });

    it('dispatches error CustomEvent with INVALID_PROP code for invalid theme', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('theme', 'neon');

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
      expect(event.detail.message).toContain('neon');
    });

    it('dispatches error CustomEvent for invalid font-size', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('font-size', '5'); // Below minimum of 12

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
      expect(event.detail.message).toContain('font-size');
    });

    it('dispatches error CustomEvent for invalid zoom value', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('zoom', '500'); // Above maximum of 300

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
      expect(event.detail.message).toContain('zoom');
    });

    it('dispatches error CustomEvent for invalid direction', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('direction', 'up');

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
      expect(event.detail.message).toContain('up');
    });

    it('dispatches error CustomEvent for invalid font-family', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('font-family', 'comic-sans');

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
      expect(event.detail.message).toContain('comic-sans');
    });
  });

  // -------------------------------------------------------------------------
  // connectedCallback/disconnectedCallback lifecycle (Requirement 1.3)
  // -------------------------------------------------------------------------

  describe('connectedCallback/disconnectedCallback lifecycle', () => {
    it('sets up Shadow DOM and React root on connectedCallback', () => {
      document.body.appendChild(element);

      expect(element.shadowRoot).not.toBeNull();
      expect(createRoot).toHaveBeenCalled();
    });

    it('unmounts React root on disconnectedCallback', () => {
      document.body.appendChild(element);
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      document.body.removeChild(element);

      expect(mockRoot.unmount).toHaveBeenCalled();
    });

    it('does not render after disconnectedCallback', () => {
      document.body.appendChild(element);
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      document.body.removeChild(element);
      const renderCallsAfterDisconnect = mockRoot.render.mock.calls.length;

      // Setting a property after disconnect should not trigger render
      element.source = { type: 'markdown', content: '# After disconnect' };

      expect(mockRoot.render.mock.calls.length).toBe(renderCallsAfterDisconnect);
    });

    it('renders immediately on connectedCallback with default values', () => {
      document.body.appendChild(element);
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      // Should have rendered at least once (even if rendering null due to no source)
      expect(mockRoot.render).toHaveBeenCalled();
    });

    it('uses properties set before connection when rendering', () => {
      // Set source before connecting
      element.source = { type: 'markdown', content: '# Pre-connect' };
      element.setAttribute('theme', 'dark');

      document.body.appendChild(element);
      const mockRoot = (createRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      // Should have rendered with the source (not null)
      // The last render call should use React.createElement with Reader
      expect(mockRoot.render).toHaveBeenCalled();
      // theme should have been processed
      expect(element.theme).toBe('dark');
    });
  });

  // -------------------------------------------------------------------------
  // Prop validation errors dispatch error event (Requirement 1.7)
  // -------------------------------------------------------------------------

  describe('Prop validation errors dispatch error event', () => {
    it('dispatches error for missing required source prop', () => {
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      document.body.appendChild(element);

      // Should dispatch error because source is required but not set
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            code: 'MISSING_PROP',
            message: expect.stringContaining('source'),
          }),
        })
      );
    });

    it('does not dispatch error when valid source is set', () => {
      element.source = { type: 'markdown', content: '# Valid' };
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      document.body.appendChild(element);

      // Should not get MISSING_PROP error since source is set
      const missingPropErrors = errorHandler.mock.calls.filter(
        (call) => (call[0] as CustomEvent).detail.code === 'MISSING_PROP'
      );
      expect(missingPropErrors).toHaveLength(0);
    });

    it('does not update internal state when invalid attribute is provided', () => {
      document.body.appendChild(element);

      element.setAttribute('theme', 'invalid-theme');

      // Theme should remain at default
      expect(element.theme).toBe('light');
    });

    it('does not update font-size for out-of-range values', () => {
      document.body.appendChild(element);

      element.setAttribute('font-size', '100'); // Above max 48

      // Font size should remain at default
      expect(element.fontSize).toBe(16);
    });

    it('does not update zoom for out-of-range values', () => {
      document.body.appendChild(element);

      element.setAttribute('zoom', '10'); // Below min 50

      // Zoom should remain at default
      expect(element.zoom).toBe(100);
    });

    it('does not update direction for invalid values', () => {
      document.body.appendChild(element);

      element.setAttribute('direction', 'center');

      // Direction should remain at default
      expect(element.direction).toBe('auto');
    });

    it('property setters validate values before applying', () => {
      document.body.appendChild(element);

      // These should be silently ignored for invalid values via property API
      element.theme = 'invalid' as any;
      element.fontFamily = 'comic' as any;
      element.fontSize = 5;
      element.zoom = 1000;
      element.direction = 'diagonal' as any;

      // All should remain at defaults
      expect(element.theme).toBe('light');
      expect(element.fontFamily).toBe('serif');
      expect(element.fontSize).toBe(16);
      expect(element.zoom).toBe(100);
      expect(element.direction).toBe('auto');
    });

    it('handles non-numeric font-size attribute gracefully', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('font-size', 'abc');

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
    });

    it('handles non-numeric zoom attribute gracefully', () => {
      document.body.appendChild(element);
      const errorHandler = vi.fn();
      element.addEventListener('error', errorHandler);

      element.setAttribute('zoom', 'big');

      expect(errorHandler).toHaveBeenCalled();
      const event = errorHandler.mock.calls[0][0] as CustomEvent;
      expect(event.detail.code).toBe('INVALID_PROP');
    });
  });

  // -------------------------------------------------------------------------
  // Default values
  // -------------------------------------------------------------------------

  describe('Default values', () => {
    it('has correct default theme', () => {
      expect(element.theme).toBe('light');
    });

    it('has correct default font family', () => {
      expect(element.fontFamily).toBe('serif');
    });

    it('has correct default font size', () => {
      expect(element.fontSize).toBe(16);
    });

    it('has correct default zoom', () => {
      expect(element.zoom).toBe(100);
    });

    it('has correct default direction', () => {
      expect(element.direction).toBe('auto');
    });

    it('has null default source', () => {
      expect(element.source).toBeNull();
    });

    it('has undefined default dictionaryProviders', () => {
      expect(element.dictionaryProviders).toBeUndefined();
    });

    it('has undefined default bookmarkAdapter', () => {
      expect(element.bookmarkAdapter).toBeUndefined();
    });
  });
});
