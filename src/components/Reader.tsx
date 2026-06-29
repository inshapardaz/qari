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
// Page model: CSS column-based pagination
// ---------------------------------------------------------------------------
// Instead of slicing by node count, we render all content for the current
// chapter in a CSS multi-column container whose column width = page width.
// The number of columns (pages) is determined by the browser layout engine.
// We translate horizontally to show one column (page) at a time.
// Each chapter starts from the first page of its column set.
// ---------------------------------------------------------------------------

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
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  // Calculate total pages whenever chapter or layout changes
  // ---------------------------------------------------------------------------
  const recalcPages = useCallback(() => {
    if (!contentRef.current || !containerRef.current) return;
    const scrollWidth = contentRef.current.scrollWidth;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth === 0) return;
    const computed = Math.max(1, Math.round(scrollWidth / containerWidth));
    setTotalPages(computed);
  }, []);

  // Recalculate on chapter change, font/zoom change, or window resize
  useEffect(() => {
    recalcPages();
  }, [currentChapterIdx, state.preferences, state.zoom, recalcPages]);

  useEffect(() => {
    // Small delay to let DOM settle after content render
    const timer = setTimeout(recalcPages, 50);
    return () => clearTimeout(timer);
  }, [currentChapterIdx, state.book, state.preferences.fontSize, state.preferences.fontFamily, state.zoom, recalcPages]);

  useEffect(() => {
    const handleResize = () => recalcPages();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recalcPages]);

  // ---------------------------------------------------------------------------
  // Page navigation
  // ---------------------------------------------------------------------------
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      const next = currentPage + 1;
      setCurrentPage(next);
      if (onPageChange) {
        onPageChange({
          page: next,
          chapter: currentChapterIdx,
          progress: totalPages > 1 ? Math.round((next / (totalPages - 1)) * 100) : 100,
        });
      }
    } else if (state.book && currentChapterIdx < state.book.chapters.length - 1) {
      // Move to next chapter
      const nextChapter = currentChapterIdx + 1;
      setCurrentChapterIdx(nextChapter);
      setCurrentPage(0);
      if (onPageChange) {
        onPageChange({
          page: 0,
          chapter: nextChapter,
          progress: 0,
        });
      }
    }
  }, [currentPage, totalPages, currentChapterIdx, state.book, onPageChange]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      if (onPageChange) {
        onPageChange({
          page: prev,
          chapter: currentChapterIdx,
          progress: totalPages > 1 ? Math.round((prev / (totalPages - 1)) * 100) : 0,
        });
      }
    } else if (currentChapterIdx > 0) {
      // Move to previous chapter (last page)
      const prevChapter = currentChapterIdx - 1;
      setCurrentChapterIdx(prevChapter);
      // Will go to last page after recalc — set to a high number, clamped on next render
      setCurrentPage(9999);
      if (onPageChange) {
        onPageChange({
          page: 0,
          chapter: prevChapter,
          progress: 100,
        });
      }
    }
  }, [currentPage, currentChapterIdx, totalPages, onPageChange]);

  // Clamp currentPage when totalPages changes (e.g., navigating to previous chapter's last page)
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state.direction === 'rtl') {
        if (e.key === 'ArrowLeft') goToNextPage();
        else if (e.key === 'ArrowRight') goToPrevPage();
      } else {
        if (e.key === 'ArrowRight') goToNextPage();
        else if (e.key === 'ArrowLeft') goToPrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextPage, goToPrevPage, state.direction]);

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

  const isFirstPage = currentPage === 0 && currentChapterIdx === 0;
  const isLastPage = currentPage >= totalPages - 1
    && state.book !== null
    && currentChapterIdx >= state.book.chapters.length - 1;

  const currentChapter = state.book?.chapters[currentChapterIdx];
  const chapterTitle = currentChapter?.title ?? '';

  // Overall progress across the whole book
  const overallProgress = (() => {
    if (!state.book || state.book.chapters.length === 0) return 0;
    const chapterCount = state.book.chapters.length;
    const chapterProgress = totalPages > 1 ? currentPage / (totalPages - 1) : 1;
    return Math.round(((currentChapterIdx + chapterProgress) / chapterCount) * 100);
  })();

  return (
    <div
      ref={rootRef}
      className="ebook-reader"
      data-testid="reader-content"
      dir={state.direction}
      style={{
        zoom: `${state.zoom}%`,
        fontFamily: 'var(--reader-font-family, Georgia, serif)',
        fontSize: 'var(--reader-font-size, 16px)',
        lineHeight: 1.7,
        backgroundColor: 'var(--reader-bg, #ffffff)',
        color: 'var(--reader-fg, #1a1a1a)',
        height: '100%',
        transition: 'background-color 0.1s, color 0.1s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ReaderContext.Provider value={contextValue}>
        {/* Page viewport — fixed height, no scroll */}
        <div
          ref={containerRef}
          className="ebook-reader__viewport"
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Column-based content — horizontally paged via transform */}
          <div
            ref={contentRef}
            className="ebook-reader__columns"
            dir="ltr"
            style={{
              columnWidth: containerRef.current
                ? `${containerRef.current.clientWidth - 64}px`
                : '100%',
              columnGap: '64px',
              columnFill: 'auto',
              height: '100%',
              padding: '2rem',
              transform: `translateX(${-(currentPage * (containerRef.current?.clientWidth ?? 0))}px)`,
              transition: 'transform 0.3s ease',
            }}
          >
            {currentChapter && (
              <div dir={state.direction}>
                <h2 style={{
                  borderBottom: '1px solid var(--reader-border, #e0e0e0)',
                  paddingBottom: '0.5rem',
                  marginBottom: '1rem',
                  breakAfter: 'avoid' as const,
                  textAlign: state.direction === 'rtl' ? 'right' : 'left',
                }}>
                  {chapterTitle}
                </h2>
                {currentChapter.content.map((node, ni) => (
                  <ContentNodeRenderer key={`${currentChapterIdx}-${ni}`} node={node} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation bar */}
        <div
          className="ebook-reader__nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 2rem',
            borderTop: '1px solid var(--reader-border, #e0e0e0)',
            backgroundColor: 'var(--reader-surface, #f5f5f5)',
            flexShrink: 0,
            flexDirection: state.direction === 'rtl' ? 'row-reverse' : 'row',
          }}
        >
          {/* Left button: "previous" in LTR, "next" in RTL */}
          <button
            onClick={state.direction === 'rtl' ? goToNextPage : goToPrevPage}
            disabled={state.direction === 'rtl' ? isLastPage : isFirstPage}
            aria-label={state.direction === 'rtl' ? 'Next page (forward)' : 'Previous page'}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--reader-border, #e0e0e0)',
              borderRadius: '4px',
              background: (state.direction === 'rtl' ? isLastPage : isFirstPage)
                ? 'transparent' : 'var(--reader-bg, #fff)',
              color: (state.direction === 'rtl' ? isLastPage : isFirstPage)
                ? 'var(--reader-border, #ccc)' : 'var(--reader-fg, #1a1a1a)',
              cursor: (state.direction === 'rtl' ? isLastPage : isFirstPage)
                ? 'not-allowed' : 'pointer',
              fontSize: '1.2rem',
            }}
          >
            ←
          </button>

          <span style={{ fontSize: '0.85rem', opacity: 0.7, textAlign: 'center' }}>
            {chapterTitle} — Page {currentPage + 1}/{totalPages} — {overallProgress}%
          </span>

          {/* Right button: "next" in LTR, "previous" in RTL */}
          <button
            onClick={state.direction === 'rtl' ? goToPrevPage : goToNextPage}
            disabled={state.direction === 'rtl' ? isFirstPage : isLastPage}
            aria-label={state.direction === 'rtl' ? 'Previous page (backward)' : 'Next page'}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--reader-border, #e0e0e0)',
              borderRadius: '4px',
              background: (state.direction === 'rtl' ? isFirstPage : isLastPage)
                ? 'transparent' : 'var(--reader-bg, #fff)',
              color: (state.direction === 'rtl' ? isFirstPage : isLastPage)
                ? 'var(--reader-border, #ccc)' : 'var(--reader-fg, #1a1a1a)',
              cursor: (state.direction === 'rtl' ? isFirstPage : isLastPage)
                ? 'not-allowed' : 'pointer',
              fontSize: '1.2rem',
            }}
          >
            →
          </button>
        </div>
      </ReaderContext.Provider>
    </div>
  );
};

export default Reader;
