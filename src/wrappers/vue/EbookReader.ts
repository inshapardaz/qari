/**
 * Vue 3 Wrapper Component for the Universal Ebook Reader.
 *
 * This is a thin adapter that mounts the React Reader component inside a Vue
 * component, forwarding reactive props and translating React callbacks into
 * Vue emits.
 *
 * Requirements: 1.2, 1.4, 1.6, 1.7
 */

import {
  defineComponent,
  ref,
  h,
  onMounted,
  onUnmounted,
  watch,
  type PropType,
} from 'vue';

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import { Reader, type ReaderProps, type ReaderSource } from '../../components/Reader';
import type { ThemeName, FontFamily } from '../../models/reader-state';
import type { DictionaryProvider } from '../../interfaces/dictionary';
import type { CustomStoreAdapter } from '../../interfaces/store-adapter';
import type {
  PageChangeEvent,
  BookmarkEvent,
  ReaderError,
  BookLoadedEvent,
} from '../../models/events';

// ---------------------------------------------------------------------------
// Prop validation helpers
// ---------------------------------------------------------------------------

function isValidSource(source: unknown): source is ReaderSource {
  if (!source || typeof source !== 'object') return false;
  const s = source as Record<string, unknown>;
  if (s.type === 'epub') {
    return s.data instanceof ArrayBuffer || (typeof File !== 'undefined' && s.data instanceof File);
  }
  if (s.type === 'url') {
    return typeof s.url === 'string' && s.url.length > 0;
  }
  if (s.type === 'markdown') {
    return (
      typeof s.content === 'string' ||
      (typeof File !== 'undefined' && s.content instanceof File)
    );
  }
  return false;
}

function isValidTheme(theme: unknown): theme is ThemeName {
  return (
    theme === 'light' ||
    theme === 'dark' ||
    theme === 'calm' ||
    theme === 'quiet' ||
    theme === 'paper' ||
    theme === 'focus' ||
    theme === 'high-contrast'
  );
}

function isValidFontFamily(family: unknown): family is FontFamily {
  return (
    family === 'serif' ||
    family === 'sans-serif' ||
    family === 'monospace' ||
    family === 'nastaliq'
  );
}

function isValidDirection(dir: unknown): dir is 'ltr' | 'rtl' | 'auto' {
  return dir === 'ltr' || dir === 'rtl' || dir === 'auto';
}

// ---------------------------------------------------------------------------
// Vue Component Definition
// ---------------------------------------------------------------------------

export const EbookReader = defineComponent({
  name: 'EbookReader',

  props: {
    source: {
      type: Object as PropType<ReaderSource>,
      required: true,
    },
    theme: {
      type: String as PropType<ThemeName>,
      default: 'light',
    },
    fontFamily: {
      type: String as PropType<FontFamily>,
      default: 'serif',
    },
    fontSize: {
      type: Number,
      default: 16,
    },
    zoom: {
      type: Number,
      default: 100,
    },
    direction: {
      type: String as PropType<'ltr' | 'rtl' | 'auto'>,
      default: 'auto',
    },
    dictionaryProviders: {
      type: Array as PropType<DictionaryProvider[]>,
      default: undefined,
    },
    bookmarkAdapter: {
      type: Object as PropType<CustomStoreAdapter>,
      default: undefined,
    },
  },

  emits: ['page-change', 'bookmark-create', 'error', 'ready'],

  setup(props, { emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let reactRoot: ReactDOM.Root | null = null;

    // -------------------------------------------------------------------
    // Prop validation
    // -------------------------------------------------------------------

    function validateProps(): ReaderError | null {
      if (!props.source) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message: 'Required prop "source" is missing',
        };
      }

      if (!isValidSource(props.source)) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message:
            'Prop "source" has invalid type. Expected { type: "epub", data: ArrayBuffer | File } | { type: "url", url: string } | { type: "markdown", content: string | File }',
        };
      }

      if (!isValidTheme(props.theme)) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message: `Prop "theme" has invalid value "${props.theme}". Expected one of: light, dark, calm, quiet, paper, focus, high-contrast`,
        };
      }

      if (!isValidFontFamily(props.fontFamily)) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message: `Prop "fontFamily" has invalid value "${props.fontFamily}". Expected one of: serif, sans-serif, monospace, nastaliq`,
        };
      }

      if (typeof props.fontSize !== 'number' || isNaN(props.fontSize)) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message: 'Prop "fontSize" must be a number',
        };
      }

      if (typeof props.zoom !== 'number' || isNaN(props.zoom)) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message: 'Prop "zoom" must be a number',
        };
      }

      if (!isValidDirection(props.direction)) {
        return {
          code: 'PROP_VALIDATION_ERROR',
          message: `Prop "direction" has invalid value "${props.direction}". Expected one of: ltr, rtl, auto`,
        };
      }

      return null;
    }

    // -------------------------------------------------------------------
    // Build React props from Vue props
    // -------------------------------------------------------------------

    function buildReaderProps(): ReaderProps {
      return {
        source: props.source,
        theme: props.theme as ThemeName,
        fontFamily: props.fontFamily as FontFamily,
        fontSize: props.fontSize,
        zoom: props.zoom,
        direction: props.direction as 'ltr' | 'rtl' | 'auto',
        dictionaryProviders: props.dictionaryProviders,
        bookmarkAdapter: props.bookmarkAdapter,
        onPageChange: (event: PageChangeEvent) => {
          emit('page-change', event);
        },
        onBookmarkCreate: (event: BookmarkEvent) => {
          emit('bookmark-create', event);
        },
        onError: (error: ReaderError) => {
          emit('error', error);
        },
        onReady: (event: BookLoadedEvent) => {
          emit('ready', event);
        },
      };
    }

    // -------------------------------------------------------------------
    // Render the React component
    // -------------------------------------------------------------------

    function renderReact() {
      if (!reactRoot) return;

      const validationError = validateProps();
      if (validationError) {
        emit('error', validationError);
        // Unmount any existing React content when props are invalid
        reactRoot.render(React.createElement('div'));
        return;
      }

      const readerProps = buildReaderProps();
      reactRoot.render(React.createElement(Reader, readerProps));
    }

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    onMounted(() => {
      if (!containerRef.value) return;

      reactRoot = ReactDOM.createRoot(containerRef.value);
      renderReact();
    });

    onUnmounted(() => {
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
    });

    // -------------------------------------------------------------------
    // Watch all props for reactive updates
    // -------------------------------------------------------------------

    watch(
      () => [
        props.source,
        props.theme,
        props.fontFamily,
        props.fontSize,
        props.zoom,
        props.direction,
        props.dictionaryProviders,
        props.bookmarkAdapter,
      ],
      () => {
        renderReact();
      },
      { deep: true }
    );

    // -------------------------------------------------------------------
    // Render function (Vue)
    // -------------------------------------------------------------------

    return () => {
      return h('div', {
        ref: containerRef,
        class: 'ebook-reader-vue-wrapper',
        'data-testid': 'ebook-reader-vue-wrapper',
      });
    };
  },
});

export default EbookReader;
