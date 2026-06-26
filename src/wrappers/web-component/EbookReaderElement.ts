/**
 * Web Component (Custom Element) wrapper for the Universal Ebook Reader.
 *
 * Provides a <ebook-reader> custom element that encapsulates the React Reader
 * component inside Shadow DOM. Simple configuration is done via HTML attributes;
 * complex values (source, dictionaryProviders, bookmarkAdapter) are set via
 * JavaScript properties.
 *
 * Dispatches CustomEvents for Reader state changes:
 *   - page-change
 *   - bookmark-create
 *   - error
 *   - ready
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Reader, ReaderProps, ReaderSource } from '../../components/Reader';
import type { DictionaryProvider } from '../../interfaces/dictionary';
import type { CustomStoreAdapter } from '../../interfaces/store-adapter';
import type { ThemeName, FontFamily } from '../../models/reader-state';
import type {
  PageChangeEvent,
  BookmarkEvent,
  BookLoadedEvent,
  ReaderError,
} from '../../models/events';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_THEMES: ThemeName[] = ['light', 'dark', 'sepia', 'high-contrast'];
const VALID_FONT_FAMILIES: FontFamily[] = ['serif', 'sans-serif', 'monospace', 'nastaliq'];
const VALID_DIRECTIONS = ['ltr', 'rtl', 'auto'] as const;

function isValidTheme(value: string): value is ThemeName {
  return VALID_THEMES.includes(value as ThemeName);
}

function isValidFontFamily(value: string): value is FontFamily {
  return VALID_FONT_FAMILIES.includes(value as FontFamily);
}

function isValidDirection(value: string): value is 'ltr' | 'rtl' | 'auto' {
  return (VALID_DIRECTIONS as readonly string[]).includes(value);
}

function isValidFontSize(value: number): boolean {
  return !isNaN(value) && value >= 12 && value <= 48;
}

function isValidZoom(value: number): boolean {
  return !isNaN(value) && value >= 50 && value <= 300;
}

// ---------------------------------------------------------------------------
// EbookReaderElement
// ---------------------------------------------------------------------------

export class EbookReaderElement extends HTMLElement {
  static observedAttributes = ['theme', 'font-family', 'font-size', 'zoom', 'direction'];

  // Shadow DOM root and React root
  private _shadowRoot: ShadowRoot | null = null;
  private _reactRoot: Root | null = null;
  private _container: HTMLDivElement | null = null;

  // Complex property values (not expressible as HTML attributes)
  private _source: ReaderSource | null = null;
  private _dictionaryProviders: DictionaryProvider[] | undefined = undefined;
  private _bookmarkAdapter: CustomStoreAdapter | undefined = undefined;

  // Simple attribute-derived values with defaults
  private _theme: ThemeName = 'light';
  private _fontFamily: FontFamily = 'serif';
  private _fontSize: number = 16;
  private _zoom: number = 100;
  private _direction: 'ltr' | 'rtl' | 'auto' = 'auto';

  // Track whether connected
  private _connected = false;

  constructor() {
    super();
  }

  // ---------------------------------------------------------------------------
  // JavaScript property API for complex values
  // ---------------------------------------------------------------------------

  get source(): ReaderSource | null {
    return this._source;
  }

  set source(value: ReaderSource | null) {
    this._source = value;
    this._renderIfConnected();
  }

  get dictionaryProviders(): DictionaryProvider[] | undefined {
    return this._dictionaryProviders;
  }

  set dictionaryProviders(value: DictionaryProvider[] | undefined) {
    this._dictionaryProviders = value;
    this._renderIfConnected();
  }

  get bookmarkAdapter(): CustomStoreAdapter | undefined {
    return this._bookmarkAdapter;
  }

  set bookmarkAdapter(value: CustomStoreAdapter | undefined) {
    this._bookmarkAdapter = value;
    this._renderIfConnected();
  }

  // ---------------------------------------------------------------------------
  // Simple property getters/setters that mirror attributes
  // ---------------------------------------------------------------------------

  get theme(): ThemeName {
    return this._theme;
  }

  set theme(value: ThemeName) {
    if (isValidTheme(value)) {
      this._theme = value;
      this.setAttribute('theme', value);
    }
  }

  get fontFamily(): FontFamily {
    return this._fontFamily;
  }

  set fontFamily(value: FontFamily) {
    if (isValidFontFamily(value)) {
      this._fontFamily = value;
      this.setAttribute('font-family', value);
    }
  }

  get fontSize(): number {
    return this._fontSize;
  }

  set fontSize(value: number) {
    if (isValidFontSize(value)) {
      this._fontSize = value;
      this.setAttribute('font-size', String(value));
    }
  }

  get zoom(): number {
    return this._zoom;
  }

  set zoom(value: number) {
    if (isValidZoom(value)) {
      this._zoom = value;
      this.setAttribute('zoom', String(value));
    }
  }

  get direction(): 'ltr' | 'rtl' | 'auto' {
    return this._direction;
  }

  set direction(value: 'ltr' | 'rtl' | 'auto') {
    if (isValidDirection(value)) {
      this._direction = value;
      this.setAttribute('direction', value);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle callbacks
  // ---------------------------------------------------------------------------

  connectedCallback(): void {
    this._connected = true;

    // Attach Shadow DOM
    this._shadowRoot = this.attachShadow({ mode: 'open' });

    // Create container div for React mount point
    this._container = document.createElement('div');
    this._container.setAttribute('style', 'width: 100%; height: 100%;');
    this._shadowRoot.appendChild(this._container);

    // Create React root
    this._reactRoot = createRoot(this._container);

    // Initial render
    this._render();
  }

  disconnectedCallback(): void {
    this._connected = false;

    // Unmount React tree
    if (this._reactRoot) {
      this._reactRoot.unmount();
      this._reactRoot = null;
    }

    this._container = null;
  }

  attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void {
    if (newVal === null) return;

    switch (name) {
      case 'theme':
        if (isValidTheme(newVal)) {
          this._theme = newVal;
        } else {
          this._dispatchError({
            code: 'INVALID_PROP',
            message: `Invalid theme value: "${newVal}". Expected one of: ${VALID_THEMES.join(', ')}`,
          });
          return;
        }
        break;

      case 'font-family':
        if (isValidFontFamily(newVal)) {
          this._fontFamily = newVal;
        } else {
          this._dispatchError({
            code: 'INVALID_PROP',
            message: `Invalid font-family value: "${newVal}". Expected one of: ${VALID_FONT_FAMILIES.join(', ')}`,
          });
          return;
        }
        break;

      case 'font-size': {
        const parsed = parseInt(newVal, 10);
        if (isValidFontSize(parsed)) {
          this._fontSize = parsed;
        } else {
          this._dispatchError({
            code: 'INVALID_PROP',
            message: `Invalid font-size value: "${newVal}". Expected a number between 12 and 48.`,
          });
          return;
        }
        break;
      }

      case 'zoom': {
        const parsed = parseInt(newVal, 10);
        if (isValidZoom(parsed)) {
          this._zoom = parsed;
        } else {
          this._dispatchError({
            code: 'INVALID_PROP',
            message: `Invalid zoom value: "${newVal}". Expected a number between 50 and 300.`,
          });
          return;
        }
        break;
      }

      case 'direction':
        if (isValidDirection(newVal)) {
          this._direction = newVal;
        } else {
          this._dispatchError({
            code: 'INVALID_PROP',
            message: `Invalid direction value: "${newVal}". Expected one of: ${VALID_DIRECTIONS.join(', ')}`,
          });
          return;
        }
        break;
    }

    this._renderIfConnected();
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private _renderIfConnected(): void {
    if (this._connected && this._reactRoot) {
      this._render();
    }
  }

  private _render(): void {
    // Validate required props
    if (!this._source) {
      this._dispatchError({
        code: 'MISSING_PROP',
        message: 'Required property "source" is not set. Set the source property via JavaScript.',
      });
      // Render nothing when source is missing
      this._reactRoot!.render(null);
      return;
    }

    const props: ReaderProps = {
      source: this._source,
      theme: this._theme,
      fontFamily: this._fontFamily,
      fontSize: this._fontSize,
      zoom: this._zoom,
      direction: this._direction,
      dictionaryProviders: this._dictionaryProviders,
      bookmarkAdapter: this._bookmarkAdapter,
      onPageChange: (event: PageChangeEvent) => {
        this.dispatchEvent(
          new CustomEvent('page-change', {
            detail: event,
            bubbles: true,
            composed: true,
          })
        );
      },
      onBookmarkCreate: (event: BookmarkEvent) => {
        this.dispatchEvent(
          new CustomEvent('bookmark-create', {
            detail: event,
            bubbles: true,
            composed: true,
          })
        );
      },
      onError: (event: ReaderError) => {
        this.dispatchEvent(
          new CustomEvent('error', {
            detail: event,
            bubbles: true,
            composed: true,
          })
        );
      },
      onReady: (event: BookLoadedEvent) => {
        this.dispatchEvent(
          new CustomEvent('ready', {
            detail: event,
            bubbles: true,
            composed: true,
          })
        );
      },
    };

    this._reactRoot!.render(React.createElement(Reader, props));
  }

  private _dispatchError(error: Partial<ReaderError>): void {
    const readerError: ReaderError = {
      code: error.code || 'PROP_ERROR',
      message: error.message || 'Unknown prop validation error',
      ...error,
    };

    this.dispatchEvent(
      new CustomEvent('error', {
        detail: readerError,
        bubbles: true,
        composed: true,
      })
    );
  }
}

// Register the custom element
customElements.define('ebook-reader', EbookReaderElement);

export default EbookReaderElement;
