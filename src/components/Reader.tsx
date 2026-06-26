/**
 * Reader Component — the main React component for the Universal Ebook Reader.
 *
 * Orchestrates services (ThemeEngine, DirectionDetector, DictionaryService,
 * BookmarkStore, ChapterNavigator) and manages ReaderState. Accepts a source
 * prop to load books from EPUB, Markdown, or remote URLs.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import type { Book, ContentNode, InlineNode } from '../models/book';
import type { Bookmark } from '../models/bookmark';
import type { ReaderState, ThemeName, FontFamily } from '../models/reader-state';
import type {
  PageChangeEvent,
  BookmarkEvent,
  BookLoadedEvent,
  ReaderError,
} from '../models/events';
import type { DictionaryProvider } from '../interfaces/dictionary';
import type { CustomStoreAdapter } from '../interfaces/store-adapter';

import { ThemeEngine } from '../services/theme-engine';
import { DefaultDirectionDetector } from '../services/direction-detector';
import { DictionaryService } from '../services/dictionary-service';
import { BookmarkStore } from '../services/bookmark-store';
import { ChapterNavigator } from '../services/chapter-navigator';

import { EPUBParserImpl } from '../parsers/epub-parser';
import { MarkdownParserImpl } from '../parsers/markdown-parser';
import { loadFromUrl } from '../parsers/url-loader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EpubSource = { type: 'epub'; data: ArrayBuffer | File };
export type UrlSource = { type: 'url'; url: string };
export type MarkdownSource = { type: 'markdown'; content: string | File };

export type ReaderSource = EpubSource | UrlSource | MarkdownSource;

export interface ReaderProps {
  source: ReaderSource;
  theme?: ThemeName;
  fontFamily?: FontFamily;
  fontSize?: number;
  zoom?: number;
  direction?: 'ltr' | 'rtl' | 'auto';
  dictionaryProviders?: DictionaryProvider[];
  bookmarkAdapter?: CustomStoreAdapter;
  onPageChange?: (event: PageChangeEvent) => void;
  onBookmarkCreate?: (event: BookmarkEvent) => void;
  onError?: (event: ReaderError) => void;
  onReady?: (event: BookLoadedEvent) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ReaderContextValue {
  state: ReaderState;
  themeEngine: ThemeEngine | null;
  directionDetector: DefaultDirectionDetector;
  dictionaryService: DictionaryService;
  bookmarkStore: BookmarkStore | null;
  chapterNavigator: ChapterNavigator | null;
}

export const ReaderContext = createContext<ReaderContextValue | null>(null);

/**
 * Hook to consume ReaderContext from child components.
 */
export function useReaderContext(): ReaderContextValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) {
    throw new Error('useReaderContext must be used within a <Reader /> component.');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Zoom clamping utility (Property 5)
// ---------------------------------------------------------------------------

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 10;

/**
 * Clamps a zoom value to [50, 300] at the nearest 10% increment.
 */
export function clampZoom(value: number): number {
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  return Math.round(clamped / ZOOM_STEP) * ZOOM_STEP;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function createInitialState(): ReaderState {
  return {
    book: null,
    currentChapter: 0,
    currentPage: 0,
    totalPages: 0,
    readingProgress: 0,
    zoom: 100,
    direction: 'ltr',
    directionConfidence: 'high',
    preferences: {
      theme: 'light',
      fontFamily: 'serif',
      fontSize: 16,
    },
    bookmarks: [],
    error: null,
    loading: true,
  };
}

// ---------------------------------------------------------------------------
// Helper: read File as ArrayBuffer or string
// ---------------------------------------------------------------------------

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Helper: extract text from first chapter for direction detection
// ---------------------------------------------------------------------------

function extractTextForDirection(book: Book): string {
  let text = '';
  for (const chapter of book.chapters) {
    for (const node of chapter.content) {
      text += extractContentNodeText(node);
      if (text.length >= 1000) break;
    }
    if (text.length >= 1000) break;
  }
  return text;
}

function extractContentNodeText(node: ContentNode): string {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return extractInlineText(node.children);
    case 'code-block':
      return node.content;
    case 'image':
      return node.alt || '';
    case 'list':
      return node.items
        .map(item => item.children.map(extractContentNodeText).join(''))
        .join('');
    case 'opaque':
      return node.rawContent;
  }
}

function extractInlineText(nodes: InlineNode[]): string {
  let text = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
      case 'code':
        text += node.content;
        break;
      case 'bold':
      case 'italic':
      case 'link':
        text += extractInlineText(node.children);
        break;
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// Helper: get source name for error messages
// ---------------------------------------------------------------------------

function getSourceName(source: ReaderSource): string {
  switch (source.type) {
    case 'epub':
      return source.data instanceof File ? source.data.name : 'epub-buffer';
    case 'url':
      return source.url;
    case 'markdown':
      return source.content instanceof File ? source.content.name : 'markdown-content';
  }
}

function getSourceFormat(source: ReaderSource): string {
  switch (source.type) {
    case 'epub':
      return 'epub';
    case 'url':
      return 'url';
    case 'markdown':
      return 'markdown';
  }
}

// ---------------------------------------------------------------------------
// Content Renderers
// ---------------------------------------------------------------------------

const InlineNodeRenderer: React.FC<{ node: InlineNode }> = ({ node }) => {
  switch (node.type) {
    case 'text':
      return <>{node.content}</>;
    case 'bold':
      return <strong>{node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} />)}</strong>;
    case 'italic':
      return <em>{node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} />)}</em>;
    case 'code':
      return <code>{node.content}</code>;
    case 'link':
      return (
        <a href={node.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--reader-accent, #0066cc)' }}>
          {node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} />)}
        </a>
      );
    default:
      return null;
  }
};

const ContentNodeRenderer: React.FC<{ node: ContentNode }> = ({ node }) => {
  switch (node.type) {
    case 'paragraph':
      return (
        <p>
          {node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} />)}
        </p>
      );
    case 'heading': {
      const Tag = `h${node.level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag>
          {node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} />)}
        </Tag>
      );
    }
    case 'image':
      return <img src={node.src} alt={node.alt || ''} style={{ maxWidth: '100%' }} />;
    case 'code-block':
      return (
        <pre>
          <code className={node.language ? `language-${node.language}` : undefined}>
            {node.content}
          </code>
        </pre>
      );
    case 'list': {
      const ListTag = node.ordered ? 'ol' : 'ul';
      return (
        <ListTag>
          {node.items.map((item, i) => (
            <li key={i}>
              {item.children.map((child, j) => <ContentNodeRenderer key={j} node={child} />)}
            </li>
          ))}
        </ListTag>
      );
    }
    case 'opaque':
      return <div dangerouslySetInnerHTML={{ __html: node.rawContent }} />;
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Reader Component
// ---------------------------------------------------------------------------

export const Reader: React.FC<ReaderProps> = ({
  source,
  theme = 'light',
  fontFamily = 'serif',
  fontSize = 16,
  zoom = 100,
  direction = 'auto',
  dictionaryProviders,
  bookmarkAdapter,
  onPageChange,
  onBookmarkCreate,
  onError,
  onReady,
}) => {
  const [state, setState] = useState<ReaderState>(createInitialState);

  // Refs for services that persist across renders
  const themeEngineRef = useRef<ThemeEngine | null>(null);
  const directionDetectorRef = useRef(new DefaultDirectionDetector());
  const dictionaryServiceRef = useRef(new DictionaryService());
  const bookmarkStoreRef = useRef<BookmarkStore | null>(null);
  const chapterNavigatorRef = useRef<ChapterNavigator | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Initialize BookmarkStore (responds to adapter prop changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    bookmarkStoreRef.current = new BookmarkStore(bookmarkAdapter);
  }, [bookmarkAdapter]);

  // ---------------------------------------------------------------------------
  // Initialize ThemeEngine once root element is available
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (rootRef.current && !themeEngineRef.current) {
      themeEngineRef.current = new ThemeEngine(rootRef.current);
      // Apply initial props immediately
      themeEngineRef.current.setTheme(theme);
      themeEngineRef.current.setFont(fontFamily);
      themeEngineRef.current.setFontSize(fontSize);
    }
  });

  // ---------------------------------------------------------------------------
  // Apply theme/font/zoom props via ThemeEngine
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (themeEngineRef.current) {
      themeEngineRef.current.setTheme(theme);
      setState(prev => ({
        ...prev,
        preferences: { ...prev.preferences, theme },
      }));
    }
  }, [theme]);

  useEffect(() => {
    if (themeEngineRef.current) {
      themeEngineRef.current.setFont(fontFamily);
      setState(prev => ({
        ...prev,
        preferences: { ...prev.preferences, fontFamily },
      }));
    }
  }, [fontFamily]);

  useEffect(() => {
    if (themeEngineRef.current) {
      themeEngineRef.current.setFontSize(fontSize);
      setState(prev => ({
        ...prev,
        preferences: { ...prev.preferences, fontSize },
      }));
    }
  }, [fontSize]);

  useEffect(() => {
    const clampedZoom = clampZoom(zoom);
    setState(prev => ({ ...prev, zoom: clampedZoom }));
  }, [zoom]);

  // ---------------------------------------------------------------------------
  // Register dictionary providers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Re-create dictionary service with new providers
    const service = new DictionaryService();
    if (dictionaryProviders) {
      for (const provider of dictionaryProviders) {
        service.registerProvider(provider);
      }
    }
    dictionaryServiceRef.current = service;
  }, [dictionaryProviders]);

  // ---------------------------------------------------------------------------
  // Load book from source
  // ---------------------------------------------------------------------------
  const loadBook = useCallback(async (src: ReaderSource) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      let book: Book;

      switch (src.type) {
        case 'epub': {
          const epubParser = new EPUBParserImpl();
          let data: ArrayBuffer;
          if (src.data instanceof File) {
            data = await readFileAsArrayBuffer(src.data);
          } else {
            data = src.data;
          }
          book = await epubParser.parse(data);
          break;
        }
        case 'markdown': {
          const mdParser = new MarkdownParserImpl();
          let content: string;
          if (src.content instanceof File) {
            content = await readFileAsText(src.content);
          } else {
            content = src.content;
          }
          book = mdParser.parse(content);
          break;
        }
        case 'url': {
          book = await loadFromUrl(src.url);
          break;
        }
      }

      // Initialize ChapterNavigator with the loaded book
      const navigator = new ChapterNavigator(book);
      chapterNavigatorRef.current = navigator;

      // Detect direction
      const textSample = extractTextForDirection(book);
      const detectionResult = directionDetectorRef.current.detect(textSample);

      let resolvedDirection: 'ltr' | 'rtl';
      let resolvedConfidence: 'high' | 'low';

      if (direction !== 'auto') {
        // Use the explicit prop override
        resolvedDirection = direction;
        resolvedConfidence = 'high';
      } else {
        resolvedDirection = detectionResult.direction;
        resolvedConfidence = detectionResult.confidence;
      }

      // Load bookmarks
      let bookmarks: Bookmark[] = [];
      if (bookmarkStoreRef.current && book.metadata.identifier) {
        try {
          bookmarks = await bookmarkStoreRef.current.load(book.metadata.identifier);
        } catch {
          // Bookmark loading failure is non-fatal
        }
      }

      const totalPages = navigator.getTotalPagesInChapter(0);

      setState(prev => ({
        ...prev,
        book,
        loading: false,
        error: null,
        currentChapter: 0,
        currentPage: 0,
        totalPages,
        readingProgress: navigator.getReadingProgress(),
        direction: resolvedDirection,
        directionConfidence: resolvedConfidence,
        bookmarks,
      }));

      // Emit onReady callback
      if (onReady) {
        onReady({
          book: book.metadata,
          chapterCount: book.chapters.length,
          direction: resolvedDirection,
        });
      }
    } catch (err: unknown) {
      const readerError: ReaderError = {
        code: 'LOAD_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error loading book',
        source: getSourceName(src),
        format: getSourceFormat(src),
      };

      // Copy additional fields from structured errors
      if (err && typeof err === 'object' && 'httpStatus' in err) {
        (readerError as ReaderError).httpStatus = (err as { httpStatus: number }).httpStatus;
      }
      if (err && typeof err === 'object' && 'code' in err) {
        readerError.code = (err as { code: string }).code;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: readerError,
        book: null,
      }));

      if (onError) {
        onError(readerError);
      }
    }
  }, [direction, onReady, onError]);

  useEffect(() => {
    loadBook(source);
  }, [source, loadBook]);

  // ---------------------------------------------------------------------------
  // Context value (memoized)
  // ---------------------------------------------------------------------------
  const contextValue = useMemo<ReaderContextValue>(() => ({
    state,
    themeEngine: themeEngineRef.current,
    directionDetector: directionDetectorRef.current,
    dictionaryService: dictionaryServiceRef.current,
    bookmarkStore: bookmarkStoreRef.current,
    chapterNavigator: chapterNavigatorRef.current,
  }), [state]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (state.loading) {
    return (
      <div ref={rootRef} className="ebook-reader" data-testid="reader-loading" role="status" aria-label="Loading book">
        <div className="ebook-reader__loading">Loading…</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div ref={rootRef} className="ebook-reader" data-testid="reader-error" role="alert">
        <div className="ebook-reader__error">
          <p className="ebook-reader__error-message">{state.error.message}</p>
          {state.error.source && (
            <p className="ebook-reader__error-source">Source: {state.error.source}</p>
          )}
          {state.error.format && (
            <p className="ebook-reader__error-format">Format: {state.error.format}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="ebook-reader"
      data-testid="reader-content"
      dir={state.direction}
      style={{
        zoom: `${state.zoom}%`,
        padding: '2rem',
        fontFamily: 'var(--reader-font-family, Georgia, serif)',
        fontSize: 'var(--reader-font-size, 16px)',
        lineHeight: 1.7,
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'var(--reader-bg, #ffffff)',
        color: 'var(--reader-fg, #1a1a1a)',
        minHeight: '100%',
        transition: 'background-color 0.1s, color 0.1s',
      }}
    >
      <ReaderContext.Provider value={contextValue}>
        <div className="ebook-reader__content" aria-live="polite">
          {state.book && (
            <div className="ebook-reader__book-loaded" data-testid="reader-book-loaded">
              {state.book.chapters.map((chapter, ci) => (
                <section
                  key={chapter.id}
                  className="ebook-reader__chapter"
                  data-chapter-index={ci}
                >
                  <h2 className="ebook-reader__chapter-heading">{chapter.title}</h2>
                  {chapter.content.map((node, ni) => (
                    <ContentNodeRenderer key={ni} node={node} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </ReaderContext.Provider>
    </div>
  );
};

export default Reader;
