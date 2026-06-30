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
import type { BookmarkStoreInterface, BookmarkChangeEvent } from '../interfaces/bookmark-store';

import { ThemeEngine } from '../services/theme-engine';
import { DefaultDirectionDetector } from '../services/direction-detector';
import { DictionaryService } from '../services/dictionary-service';
import { BookmarkStore } from '../services/bookmark-store';
import { LocalStorageStore } from '../services/local-storage-store';
import { ChapterNavigator } from '../services/chapter-navigator';

import { BookmarkPanel } from './BookmarkPanel';
import { DictionaryPopover } from './DictionaryPopover';

import { TranslationContext, DEFAULT_TRANSLATIONS, useTranslations, interpolate } from '../i18n';
import type { TranslationStrings } from '../i18n';

import { HunspellProvider } from '../services/hunspell-provider';
import type { HunspellDictionaryConfig } from '../services/hunspell-provider';
import { FreeDictionaryProvider } from '../services/free-dictionary-provider';
import { WiktionaryProvider } from '../services/wiktionary-provider';
import { useSelectionHandler } from '../hooks/useSelectionHandler';
import type { DictionaryLookupResult } from '../services/dictionary-service';

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

export type LineSpacing = 1 | 1.5 | 2 | 2.5 | 3;

export interface ReaderSettings {
  theme?: ThemeName;
  fontFamily?: string;
  fontSize?: number;
  justify?: boolean;
  lineSpacing?: number;
  letterSpacing?: number; // in px, 0-5
  wordSpacing?: number; // in px, 0-10
  margin?: number; // in px, 0-100
  columns?: 1 | 2;
}

export interface FontOption {
  /** Display name shown in the font selector UI */
  name: string;
  /** CSS font-family value (e.g., 'Georgia, serif' or 'Noto Nastaliq Urdu') */
  family: string;
}

/**
 * Default font options with common cross-platform fonts.
 */
export const DEFAULT_FONT_OPTIONS: FontOption[] = [
  { name: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { name: 'Sans', family: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { name: 'Mono', family: '"SF Mono", "Fira Code", "Cascadia Code", "Courier New", monospace' },
];

export interface ReaderProps {
  source: ReaderSource;
  translations?: Partial<TranslationStrings>;
  theme?: ThemeName;
  fontFamily?: FontFamily;
  fontSize?: number;
  justify?: boolean;
  lineSpacing?: number;
  letterSpacing?: number;
  wordSpacing?: number;
  margin?: number;
  columns?: 1 | 2;
  zoom?: number;
  direction?: 'ltr' | 'rtl' | 'auto';
  dictionaryProviders?: DictionaryProvider[];
  /** Hunspell dictionary configurations for local/offline spell checking */
  hunspellDictionaries?: HunspellDictionaryConfig[];
  /** Enable built-in online dictionary providers (FreeDictionary + Wiktionary). Defaults to false. */
  enableBuiltInDictionary?: boolean;
  /** Enable or disable the bookmarks feature. Defaults to true. */
  enableBookmarks?: boolean;
  /**
   * Custom font options for the font selector.
   * Each entry provides a display name and CSS font-family value.
   * Defaults to DEFAULT_FONT_OPTIONS (Serif, Sans, Mono) if not provided.
   */
  fontOptions?: FontOption[];
  bookmarkAdapter?: CustomStoreAdapter;
  bookmarks?: Bookmark[];
  bookmarkStore?: BookmarkStoreInterface;
  onBookmarkChange?: (event: BookmarkChangeEvent) => void;
  onPageChange?: (event: PageChangeEvent) => void;
  onBookmarkCreate?: (event: BookmarkEvent) => void;
  onError?: (event: ReaderError) => void;
  onReady?: (event: BookLoadedEvent) => void;
  onSettingsChange?: (settings: ReaderSettings) => void;
  onProgressChange?: (progress: ReadingProgress) => void;
}

export interface ReadingProgress {
  currentPage: number;
  totalPages: number;
  currentChapter: number;
  totalChapters: number;
  chapterTitle: string;
  percentage: number;
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
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmark: Bookmark) => void;
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
// HTML serializer for measurement (simple, no React rendering needed)
// ---------------------------------------------------------------------------

function contentNodeToHtml(node: ContentNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${inlineNodesToHtml(node.children)}</p>`;
    case 'heading':
      return `<h${node.level}>${inlineNodesToHtml(node.children)}</h${node.level}>`;
    case 'image':
      return `<img src="${node.src}" alt="${node.alt || ''}" style="max-width:100%" />`;
    case 'code-block':
      return `<pre><code>${escapeHtml(node.content)}</code></pre>`;
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const items = node.items.map(item =>
        `<li>${item.children.map(contentNodeToHtml).join('')}</li>`
      ).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'opaque':
      return node.rawContent;
  }
}

function inlineNodesToHtml(nodes: InlineNode[]): string {
  return nodes.map(inlineNodeToHtml).join('');
}

function inlineNodeToHtml(node: InlineNode): string {
  switch (node.type) {
    case 'text': return escapeHtml(node.content);
    case 'bold': return `<strong>${inlineNodesToHtml(node.children)}</strong>`;
    case 'italic': return `<em>${inlineNodesToHtml(node.children)}</em>`;
    case 'code': return `<code>${escapeHtml(node.content)}</code>`;
    case 'link': return `<a href="${node.href}">${inlineNodesToHtml(node.children)}</a>`;
    default: return '';
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    case 'inline-image':
      return (
        <img
          src={node.src}
          alt={node.alt || ''}
          loading="lazy"
          style={{
            maxWidth: '100%',
            maxHeight: '10em',
            verticalAlign: 'middle',
            display: 'inline-block',
            objectFit: 'contain',
          }}
        />
      );
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
      return (
        <figure style={{ margin: '1rem 0', padding: 0, breakInside: 'avoid' }}>
          <img
            src={node.src}
            alt={node.alt || ''}
            loading="lazy"
            onError={(e) => console.warn(`[qari] Image failed to load: "${node.src?.substring(0, 80)}"`, e)}
            style={{
              maxWidth: '100%',
              maxHeight: '70vh',
              width: 'auto',
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
              borderRadius: '4px',
            }}
          />
          {node.alt && (
            <figcaption style={{
              fontSize: '0.8em',
              opacity: 0.7,
              marginTop: '0.4rem',
              textAlign: 'center',
            }}>
              {node.alt}
            </figcaption>
          )}
        </figure>
      );
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
  translations,
  theme = 'light',
  fontFamily = 'serif',
  fontSize = 16,
  justify = true,
  lineSpacing = 1.5,
  letterSpacing = 0,
  wordSpacing = 0,
  margin = 32,
  columns = 1,
  zoom = 100,
  direction = 'auto',
  dictionaryProviders,
  hunspellDictionaries,
  enableBuiltInDictionary = false,
  enableBookmarks = true,
  fontOptions = DEFAULT_FONT_OPTIONS,
  bookmarkAdapter,
  bookmarks: bookmarksProp,
  bookmarkStore: bookmarkStoreProp,
  onBookmarkChange,
  onPageChange,
  onBookmarkCreate,
  onError,
  onReady,
  onSettingsChange,
  onProgressChange,
}) => {
  const [state, setState] = useState<ReaderState>(createInitialState);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1); // pages in current chapter
  const [pagesPerChapter, setPagesPerChapter] = useState<number[]>([]); // cached page counts per chapter
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = useState(false);
  const [selectedFontFamily, setSelectedFontFamily] = useState<string>(() => {
    // Try to match the fontFamily prop against available font options
    if (fontFamily) {
      const match = fontOptions.find(opt =>
        opt.name.toLowerCase() === fontFamily.toLowerCase() ||
        opt.family.toLowerCase().includes(fontFamily.toLowerCase())
      );
      if (match) return match.family;
    }
    return fontOptions[0]?.family ?? 'Georgia, serif';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Refs for services that persist across renders
  const themeEngineRef = useRef<ThemeEngine | null>(null);
  const directionDetectorRef = useRef(new DefaultDirectionDetector());
  const dictionaryServiceRef = useRef(new DictionaryService());
  const bookmarkStoreRef = useRef<BookmarkStore | null>(null);
  const chapterNavigatorRef = useRef<ChapterNavigator | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Fullscreen toggle
  // ---------------------------------------------------------------------------
  const toggleFullscreen = useCallback(() => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      rootRef.current.requestFullscreen().catch(() => {
        // Fullscreen not supported or denied — ignore
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Initialize BookmarkStore (responds to adapter prop changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    bookmarkStoreRef.current = new BookmarkStore(bookmarkAdapter);
  }, [bookmarkAdapter]);

  // ---------------------------------------------------------------------------
  // Bookmark store interface instance (new pluggable store system)
  // Precedence: bookmarkStoreProp > LocalStorageStore default
  // ---------------------------------------------------------------------------
  const defaultLocalStoreRef = useRef<LocalStorageStore>(new LocalStorageStore());
  const bookmarkStoreInterfaceRef = useRef<BookmarkStoreInterface>(
    bookmarkStoreProp ?? defaultLocalStoreRef.current
  );

  useEffect(() => {
    if (bookmarkStoreProp) {
      bookmarkStoreInterfaceRef.current = bookmarkStoreProp;
    } else {
      bookmarkStoreInterfaceRef.current = defaultLocalStoreRef.current;
    }
  }, [bookmarkStoreProp]);

  // ---------------------------------------------------------------------------
  // Prop-driven bookmark reactivity: when bookmarks prop changes, sync state
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (bookmarksProp !== undefined) {
      setState(prev => ({
        ...prev,
        bookmarks: bookmarksProp,
      }));
    }
  }, [bookmarksProp]);

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
    // Sync selectedFontFamily when fontFamily prop changes
    if (fontFamily) {
      const match = fontOptions.find(opt =>
        opt.name.toLowerCase() === fontFamily.toLowerCase() ||
        opt.family.toLowerCase().includes(fontFamily.toLowerCase())
      );
      if (match) {
        setSelectedFontFamily(match.family);
      }
    }
  }, [fontFamily, fontOptions]);

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
    // Re-create dictionary service with new providers in priority order:
    // 1. Hunspell providers (local)
    // 2. User-supplied dictionaryProviders
    // 3. Built-in online providers (when enableBuiltInDictionary is true)
    const service = new DictionaryService();

    // 1. Register Hunspell providers for each config
    if (hunspellDictionaries) {
      for (const config of hunspellDictionaries) {
        try {
          const hunspellProvider = new HunspellProvider({
            language: config.language,
            aff: config.aff,
            dic: config.dic,
            affUrl: config.affUrl,
            dicUrl: config.dicUrl,
          });
          service.registerProvider(hunspellProvider, 'local');
        } catch {
          // Initialization failure for this config — skip it
        }
      }
    }

    // 2. Register user-supplied providers
    if (dictionaryProviders) {
      for (const provider of dictionaryProviders) {
        service.registerProvider(provider);
      }
    }

    // 3. Register built-in online providers when enabled
    if (enableBuiltInDictionary) {
      const freeDictProvider = new FreeDictionaryProvider();
      service.registerProvider(freeDictProvider, 'online');

      const wiktionaryProvider = new WiktionaryProvider({
        languages: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru'],
      });
      service.registerProvider(wiktionaryProvider, 'online');
    }

    dictionaryServiceRef.current = service;
  }, [dictionaryProviders, hunspellDictionaries, enableBuiltInDictionary]);

  // ---------------------------------------------------------------------------
  // Determine whether any providers are registered (for selection handler)
  // ---------------------------------------------------------------------------
  const hasProviders = useMemo(() => {
    return !!(
      (dictionaryProviders && dictionaryProviders.length > 0) ||
      (hunspellDictionaries && hunspellDictionaries.length > 0) ||
      enableBuiltInDictionary
    );
  }, [dictionaryProviders, hunspellDictionaries, enableBuiltInDictionary]);

  // ---------------------------------------------------------------------------
  // Selection handler hook — bridges user text interactions with dictionary lookups
  // ---------------------------------------------------------------------------
  const { anchorPosition, lookupState, triggerLookup, dismiss } = useSelectionHandler({
    contentRef,
    hasProviders,
  });

  // ---------------------------------------------------------------------------
  // Dictionary lookup state management
  // ---------------------------------------------------------------------------
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryLookupResult | null>(null);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);

  // Perform dictionary lookup when selection handler triggers it
  useEffect(() => {
    if (lookupState.status !== 'loading') {
      return;
    }

    // Extract the selected word from browser selection
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

    // Cancel any in-progress lookup
    dictionaryServiceRef.current.cancelCurrentLookup();

    // Determine the book language (default to 'en')
    const language = state.book?.metadata?.language ?? 'en';
    const chapterText = ''; // Simplified context — full text extraction not needed for basic lookup
    const position = 0;

    dictionaryServiceRef.current
      .lookup(word, language, chapterText, position)
      .then((result) => {
        setDictionaryResult(result);
        setDictionaryLoading(false);
      })
      .catch(() => {
        setDictionaryLoading(false);
      });
  }, [lookupState.status, state.book]);

  // Handle suggestion selection — triggers a new lookup for the suggested word
  const handleSuggestionSelect = useCallback((suggestedWord: string) => {
    setDictionaryLoading(true);
    setDictionaryResult(null);

    // Cancel any in-progress lookup
    dictionaryServiceRef.current.cancelCurrentLookup();

    const language = state.book?.metadata?.language ?? 'en';
    const chapterText = '';
    const position = 0;

    dictionaryServiceRef.current
      .lookup(suggestedWord, language, chapterText, position)
      .then((result) => {
        setDictionaryResult(result);
        setDictionaryLoading(false);
      })
      .catch(() => {
        setDictionaryLoading(false);
      });
  }, [state.book]);

  // Handle popover close
  const handleDictionaryClose = useCallback(() => {
    dismiss();
    setDictionaryResult(null);
    setDictionaryLoading(false);
  }, [dismiss]);

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
      // Priority: 1) explicit prop, 2) EPUB page-progression-direction, 3) character analysis
      let resolvedDirection: 'ltr' | 'rtl';
      let resolvedConfidence: 'high' | 'low';

      if (direction !== 'auto') {
        // Use the explicit prop override
        resolvedDirection = direction;
        resolvedConfidence = 'high';
      } else if (book.metadata.pageDirection) {
        // Use EPUB spine page-progression-direction
        resolvedDirection = book.metadata.pageDirection;
        resolvedConfidence = 'high';
      } else {
        // Fall back to character-based detection
        const textSample = extractTextForDirection(book);
        const detectionResult = directionDetectorRef.current.detect(textSample);
        resolvedDirection = detectionResult.direction;
        resolvedConfidence = detectionResult.confidence;
      }

      // Load bookmarks
      let bookmarks: Bookmark[] = [];
      if (bookmarksProp !== undefined) {
        // Controlled mode: use prop value directly, skip store load
        bookmarks = bookmarksProp;
      } else if (book.metadata.identifier) {
        // Uncontrolled mode: load from the configured store interface
        try {
          bookmarks = await bookmarkStoreInterfaceRef.current.load(book.metadata.identifier);
        } catch {
          // Bookmark loading failure is non-fatal
          // Also try legacy bookmark store as fallback
          if (bookmarkStoreRef.current) {
            try {
              bookmarks = await bookmarkStoreRef.current.load(book.metadata.identifier);
            } catch {
              // Non-fatal
            }
          }
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

      // Initialize page count tracking per chapter (will be filled as chapters are visited)
      setCurrentChapterIdx(0);
      setCurrentPage(0);
      setPagesPerChapter(new Array(book.chapters.length).fill(1));

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
  }, [direction, onReady, onError, bookmarksProp]);

  useEffect(() => {
    loadBook(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

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
    // Update cached pages for current chapter
    setPagesPerChapter(prev => {
      const updated = [...prev];
      updated[currentChapterIdx] = computed;
      return updated;
    });
  }, [currentChapterIdx]);

  // Recalculate on chapter change, font/zoom change, or window resize
  useEffect(() => {
    recalcPages();
  }, [currentChapterIdx, state.preferences, state.zoom, recalcPages]);

  useEffect(() => {
    // Small delay to let DOM settle after content render
    const timer = setTimeout(recalcPages, 50);
    return () => clearTimeout(timer);
  }, [currentChapterIdx, state.book, state.preferences.fontSize, state.preferences.fontFamily, state.zoom, columns, margin, lineSpacing, letterSpacing, wordSpacing, recalcPages]);

  useEffect(() => {
    const handleResize = () => recalcPages();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recalcPages]);

  // ---------------------------------------------------------------------------
  // Measure all chapters' page counts on book load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!state.book || !containerRef.current || !measureRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth === 0) return;

    const colWidth = (containerWidth - margin * 2 - (columns === 2 ? 64 : 0)) / columns;
    const measurer = measureRef.current;

    // Apply same column styles as the real content
    measurer.style.columnWidth = `${colWidth}px`;
    measurer.style.columnGap = '64px';
    measurer.style.columnFill = 'auto';
    measurer.style.height = `${containerRef.current.clientHeight}px`;
    measurer.style.padding = `2rem ${margin}px`;
    measurer.style.fontFamily = getComputedStyle(contentRef.current || measurer).fontFamily;
    measurer.style.fontSize = `${fontSize}px`;
    measurer.style.lineHeight = `${lineSpacing}`;
    measurer.style.letterSpacing = `${letterSpacing}px`;
    measurer.style.wordSpacing = `${wordSpacing}px`;

    const counts: number[] = [];

    for (const chapter of state.book.chapters) {
      // Build simple HTML for measurement
      let html = `<h2>${chapter.title}</h2>`;
      for (const node of chapter.content) {
        html += contentNodeToHtml(node);
      }
      measurer.innerHTML = html;
      const pages = Math.max(1, Math.round(measurer.scrollWidth / containerWidth));
      counts.push(pages);
    }

    measurer.innerHTML = '';
    setPagesPerChapter(counts);
  }, [state.book, columns, margin, fontSize, lineSpacing, letterSpacing, wordSpacing]);

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

  // Fire progress callback on navigation
  useEffect(() => {
    if (!onProgressChange || !state.book) return;
    const pagesBefore = pagesPerChapter.slice(0, currentChapterIdx).reduce((sum, p) => sum + (p || 1), 0);
    const bookPage = pagesBefore + currentPage + 1;
    const bookTotal = pagesPerChapter.reduce((sum, p) => sum + (p || 1), 0);
    onProgressChange({
      currentPage: bookPage,
      totalPages: bookTotal,
      currentChapter: currentChapterIdx,
      totalChapters: state.book.chapters.length,
      chapterTitle: state.book.chapters[currentChapterIdx]?.title ?? '',
      percentage: bookTotal > 0 ? Math.round((bookPage / bookTotal) * 100) : 0,
    });
  }, [currentPage, currentChapterIdx, pagesPerChapter, state.book]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChapterMenuOpen(false);
        setSettingsOpen(false);
        setBookmarksPanelOpen(false);
        return;
      }
      if (state.direction === 'rtl') {
        if (e.key === 'ArrowLeft') goToNextPage();
        else if (e.key === 'ArrowRight') goToPrevPage();
      } else {
        if (e.key === 'ArrowRight') goToNextPage();
        else if (e.key === 'ArrowLeft') goToPrevPage();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      // Ignore clicks inside popup containers (they use stopPropagation,
      // but this is a safety check for capture-phase registration)
      const header = rootRef.current?.querySelector('.ebook-reader__header');
      if (header && header.contains(e.target as Node)) {
        return;
      }
      setChapterMenuOpen(false);
      setSettingsOpen(false);
      setBookmarksPanelOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    if (chapterMenuOpen || settingsOpen || bookmarksPanelOpen) {
      // Use mousedown instead of click to avoid race conditions with re-renders
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [goToNextPage, goToPrevPage, state.direction, chapterMenuOpen, settingsOpen, bookmarksPanelOpen]);

  // ---------------------------------------------------------------------------
  // Context value (memoized)
  // ---------------------------------------------------------------------------
  // Bookmark state management callbacks (exposed via context)
  // ---------------------------------------------------------------------------
  const addBookmark = useCallback((bookmark: Bookmark) => {
    setState(prev => ({
      ...prev,
      bookmarks: [...prev.bookmarks, bookmark],
    }));
    if (onBookmarkChange) {
      onBookmarkChange({ type: 'created', bookmark });
    }
  }, [onBookmarkChange]);

  const removeBookmark = useCallback((bookmarkId: string) => {
    setState(prev => {
      const bookmark = prev.bookmarks.find(b => b.id === bookmarkId);
      if (bookmark && onBookmarkChange) {
        onBookmarkChange({ type: 'deleted', bookmark });
      }
      return {
        ...prev,
        bookmarks: prev.bookmarks.filter(b => b.id !== bookmarkId),
      };
    });
  }, [onBookmarkChange]);

  const updateBookmarkInState = useCallback((bookmark: Bookmark) => {
    setState(prev => ({
      ...prev,
      bookmarks: prev.bookmarks.map(b => b.id === bookmark.id ? bookmark : b),
    }));
    if (onBookmarkChange) {
      onBookmarkChange({ type: 'renamed', bookmark });
    }
  }, [onBookmarkChange]);

  // ---------------------------------------------------------------------------
  // Resolved translations (memoized merge of defaults + overrides)
  // ---------------------------------------------------------------------------
  const resolvedTranslations = useMemo(
    () => ({ ...DEFAULT_TRANSLATIONS, ...translations }),
    [translations]
  );

  const t = resolvedTranslations;

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
    addBookmark,
    removeBookmark,
    updateBookmark: updateBookmarkInState,
  }), [state, addBookmark, removeBookmark, updateBookmarkInState]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (state.loading) {
    return (
      <div ref={rootRef} className="ebook-reader" data-testid="reader-loading" role="status" aria-label="Loading book">
        <div className="ebook-reader__loading">{t.loading}</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div ref={rootRef} className="ebook-reader" data-testid="reader-error" role="alert">
        <div className="ebook-reader__error">
          <p className="ebook-reader__error-message">{state.error.message}</p>
          {state.error.source && (
            <p className="ebook-reader__error-source">{t.errorSource} {state.error.source}</p>
          )}
          {state.error.format && (
            <p className="ebook-reader__error-format">{t.errorFormat} {state.error.format}</p>
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

  // Book-wide page numbers
  const pagesBefore = pagesPerChapter.slice(0, currentChapterIdx).reduce((sum, p) => sum + (p || 1), 0);
  const bookPageNumber = pagesBefore + currentPage + 1;
  const bookTotalPages = pagesPerChapter.reduce((sum, p) => sum + (p || 1), 0);

  return (
    <div
      ref={rootRef}
      className="ebook-reader"
      data-testid="reader-content"
      dir={state.direction}
      style={{
        zoom: `${state.zoom}%`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        backgroundColor: 'var(--reader-bg, #ffffff)',
        color: 'var(--reader-fg, #1a1a1a)',
        height: '100%',
        transition: 'background-color 0.1s, color 0.1s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <ReaderContext.Provider value={contextValue}>
        <TranslationContext.Provider value={resolvedTranslations}>
        {/* Header bar with settings */}
        <div
          className="ebook-reader__header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--reader-border, #e0e0e0)',
            backgroundColor: 'var(--reader-surface, #f5f5f5)',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* Chapter list button (left) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setChapterMenuOpen(!chapterMenuOpen)}
              aria-label={t.tableOfContents}
              aria-expanded={chapterMenuOpen}
              style={{
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--reader-border, #e0e0e0)',
                borderRadius: '4px',
                background: chapterMenuOpen ? 'var(--reader-accent, #0066cc)' : 'var(--reader-bg, #fff)',
                color: chapterMenuOpen ? '#fff' : 'var(--reader-fg, #1a1a1a)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ☰
            </button>

            {chapterMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  ...(state.direction === 'rtl' ? { right: '0' } : { left: '0' }),
                  marginTop: '0.5rem',
                  background: 'var(--reader-bg, #fff)',
                  border: '1px solid var(--reader-border, #e0e0e0)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  minWidth: '240px',
                  zIndex: 200,
                }}
              >
                {state.book?.chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setCurrentChapterIdx(idx);
                      setCurrentPage(0);
                      setChapterMenuOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.6rem 1rem',
                      border: 'none',
                      background: idx === currentChapterIdx
                        ? 'var(--reader-accent, #0066cc)'
                        : 'transparent',
                      color: idx === currentChapterIdx
                        ? '#fff'
                        : 'var(--reader-fg, #1a1a1a)',
                      textAlign: state.direction === 'rtl' ? 'right' : 'left',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid var(--reader-border, #e0e0e0)',
                    }}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chapter title (center) */}
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 500,
            opacity: 0.8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'center',
          }}>
            {chapterTitle}
          </span>

          {/* Settings button (right) */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {/* Bookmarks button */}
            {enableBookmarks && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setBookmarksPanelOpen(!bookmarksPanelOpen)}
                aria-label={t.bookmarks}
                aria-expanded={bookmarksPanelOpen}
                style={{
                  padding: '0.4rem 0.6rem',
                  border: '1px solid var(--reader-border, #e0e0e0)',
                  borderRadius: '4px',
                  background: bookmarksPanelOpen ? 'var(--reader-accent, #0066cc)' : 'var(--reader-bg, #fff)',
                  color: bookmarksPanelOpen ? '#fff' : 'var(--reader-fg, #1a1a1a)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                🔖
              </button>

              {bookmarksPanelOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    ...(state.direction === 'rtl' ? { left: '0' } : { right: '0' }),
                    marginTop: '0.5rem',
                    background: 'var(--reader-bg, #fff)',
                    border: '1px solid var(--reader-border, #e0e0e0)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    padding: '0.75rem',
                    zIndex: 200,
                    minWidth: '280px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  <BookmarkPanel
                    onNavigate={(chapterIdx, page) => {
                      setCurrentChapterIdx(chapterIdx);
                      setCurrentPage(page);
                      setBookmarksPanelOpen(false);
                    }}
                    onPageChange={onPageChange}
                  />
                </div>
              )}
            </div>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t.exitFullscreen : t.enterFullscreen}
              style={{
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--reader-border, #e0e0e0)',
                borderRadius: '4px',
                background: isFullscreen ? 'var(--reader-accent, #0066cc)' : 'var(--reader-bg, #fff)',
                color: isFullscreen ? '#fff' : 'var(--reader-fg, #1a1a1a)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              {isFullscreen ? '⊗' : '⛶'}
            </button>

            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-label={t.readingSettings}
              aria-expanded={settingsOpen}
              style={{
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--reader-border, #e0e0e0)',
                borderRadius: '4px',
                background: settingsOpen ? 'var(--reader-accent, #0066cc)' : 'var(--reader-bg, #fff)',
                color: settingsOpen ? '#fff' : 'var(--reader-fg, #1a1a1a)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ⚙
            </button>
          </div>

          {/* Settings dialog */}
          {settingsOpen && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }}
              onClick={() => setSettingsOpen(false)}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSettingsOpen(false);
              }}
            >
            <div
              style={{
                background: 'var(--reader-bg, #fff)',
                border: '1px solid var(--reader-border, #e0e0e0)',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                padding: '1.25rem',
                width: '100%',
                maxWidth: '320px',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsTheme}
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {(['light', 'dark', 'sepia', 'high-contrast'] as ThemeName[]).map(thm => (
                    <button
                      key={thm}
                      onClick={() => {
                        if (onSettingsChange) onSettingsChange({ theme: thm });
                      }}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        border: theme === thm ? '2px solid var(--reader-accent, #0066cc)' : '1px solid var(--reader-border, #e0e0e0)',
                        borderRadius: '4px',
                        background: thm === 'light' ? '#fff' : thm === 'dark' ? '#1a1a2e' : thm === 'sepia' ? '#f4ecd8' : '#000',
                        color: thm === 'dark' || thm === 'high-contrast' ? '#fff' : '#1a1a1a',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        fontWeight: theme === thm ? 700 : 400,
                      }}
                    >
                      {thm === 'light' ? t.themeLight : thm === 'dark' ? t.themeDark : thm === 'sepia' ? t.themeSepia : t.themeHighContrast}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsFontFamily}
                </label>
                <select
                  value={selectedFontFamily}
                  onChange={(e) => {
                    const family = e.target.value;
                    setSelectedFontFamily(family);
                    const opt = fontOptions.find(o => o.family === family);
                    if (onSettingsChange) onSettingsChange({ fontFamily: opt?.name ?? family });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--reader-border, #e0e0e0)',
                    borderRadius: '4px',
                    background: 'var(--reader-bg, #fff)',
                    color: 'var(--reader-fg, #1a1a1a)',
                    fontSize: '0.85rem',
                    fontFamily: selectedFontFamily,
                    cursor: 'pointer',
                  }}
                >
                  {fontOptions.map(opt => (
                    <option key={opt.family} value={opt.family} style={{ fontFamily: opt.family }}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsFontSize}: {fontSize}px
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      if (onSettingsChange) onSettingsChange({ fontSize: Math.max(12, fontSize - 2) });
                    }}
                    style={{
                      width: '28px', height: '28px',
                      border: '1px solid var(--reader-border, #e0e0e0)',
                      borderRadius: '4px',
                      background: 'var(--reader-bg, #fff)',
                      color: 'var(--reader-fg, #1a1a1a)',
                      cursor: fontSize <= 12 ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                    }}
                    disabled={fontSize <= 12}
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    min={12}
                    max={48}
                    step={2}
                    value={fontSize}
                    onChange={(e) => {
                      if (onSettingsChange) onSettingsChange({ fontSize: Number(e.target.value) });
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      if (onSettingsChange) onSettingsChange({ fontSize: Math.min(48, fontSize + 2) });
                    }}
                    style={{
                      width: '28px', height: '28px',
                      border: '1px solid var(--reader-border, #e0e0e0)',
                      borderRadius: '4px',
                      background: 'var(--reader-bg, #fff)',
                      color: 'var(--reader-fg, #1a1a1a)',
                      cursor: fontSize >= 48 ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                    }}
                    disabled={fontSize >= 48}
                  >
                    A+
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsJustify}
                  <button
                    onClick={() => { if (onSettingsChange) onSettingsChange({ justify: !justify }); }}
                    style={{
                      width: '40px', height: '22px',
                      borderRadius: '11px',
                      border: 'none',
                      background: justify ? 'var(--reader-accent, #0066cc)' : 'var(--reader-border, #ccc)',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    aria-label="Toggle justify"
                    role="switch"
                    aria-checked={justify}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: justify ? '20px' : '2px',
                      width: '18px', height: '18px',
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </label>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsLineSpacing}: {lineSpacing}×
                </label>
                <input
                  type="range" min={1} max={3} step={0.25} value={lineSpacing}
                  onChange={(e) => { if (onSettingsChange) onSettingsChange({ lineSpacing: Number(e.target.value) }); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsLetterSpacing}: {letterSpacing}px
                </label>
                <input
                  type="range" min={0} max={5} step={0.5} value={letterSpacing}
                  onChange={(e) => { if (onSettingsChange) onSettingsChange({ letterSpacing: Number(e.target.value) }); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsWordSpacing}: {wordSpacing}px
                </label>
                <input
                  type="range" min={0} max={10} step={1} value={wordSpacing}
                  onChange={(e) => { if (onSettingsChange) onSettingsChange({ wordSpacing: Number(e.target.value) }); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsMargin}: {margin}px
                </label>
                <input
                  type="range" min={0} max={100} step={8} value={margin}
                  onChange={(e) => { if (onSettingsChange) onSettingsChange({ margin: Number(e.target.value) }); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600, color: 'var(--reader-fg, #333)' }}>
                  {t.settingsColumns}
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {([1, 2] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => { if (onSettingsChange) onSettingsChange({ columns: c }); }}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        border: columns === c ? '2px solid var(--reader-accent, #0066cc)' : '1px solid var(--reader-border, #e0e0e0)',
                        borderRadius: '4px',
                        background: 'var(--reader-bg, #fff)',
                        color: 'var(--reader-fg, #1a1a1a)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: columns === c ? 700 : 400,
                      }}
                    >
                      {c === 1 ? '▐' : '▐▐'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  if (onSettingsChange) onSettingsChange({
                    theme: 'light',
                    fontFamily: 'serif',
                    fontSize: 16,
                    justify: true,
                    lineSpacing: 1.5,
                    letterSpacing: 0,
                    wordSpacing: 0,
                    margin: 32,
                    columns: 1,
                  });
                }}
                style={{
                  marginTop: '1.25rem',
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--reader-border, #e0e0e0)',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: 'var(--reader-fg, #1a1a1a)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {t.resetToDefaults}
              </button>
            </div>
            </div>
          )}
        </div>

        {/* Page viewport — fixed height, no scroll */}
        <div
          ref={containerRef}
          className="ebook-reader__viewport"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Hidden div for measuring chapter page counts */}
          <div
            ref={measureRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: '-9999px',
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
              visibility: 'hidden',
              pointerEvents: 'none',
            }}
          />

          {/* Hover navigation overlays */}
          {hovered && !isFirstPage && (
            <button
              onClick={goToPrevPage}
              aria-label={t.previousPage}
              style={{
                position: 'absolute',
                [state.direction === 'rtl' ? 'right' : 'left']: 0,
                top: 0,
                bottom: 0,
                width: '60px',
                border: 'none',
                background: 'linear-gradient(to right, rgba(0,0,0,0.04), transparent)',
                color: 'var(--reader-fg, #1a1a1a)',
                cursor: 'pointer',
                fontSize: '1.5rem',
                opacity: 0.6,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
            >
              {state.direction === 'rtl' ? '→' : '←'}
            </button>
          )}
          {hovered && !isLastPage && (
            <button
              onClick={goToNextPage}
              aria-label={t.nextPage}
              style={{
                position: 'absolute',
                [state.direction === 'rtl' ? 'left' : 'right']: 0,
                top: 0,
                bottom: 0,
                width: '60px',
                border: 'none',
                background: 'linear-gradient(to left, rgba(0,0,0,0.04), transparent)',
                color: 'var(--reader-fg, #1a1a1a)',
                cursor: 'pointer',
                fontSize: '1.5rem',
                opacity: 0.6,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
            >
              {state.direction === 'rtl' ? '←' : '→'}
            </button>
          )}

          {/* Column-based content — horizontally paged via transform */}
          <div
            ref={contentRef}
            className="ebook-reader__columns"
            dir={state.direction}
            style={{
              columnWidth: containerRef.current
                ? `${(containerRef.current.clientWidth - margin * 2 - (columns === 2 ? 64 : 0)) / columns}px`
                : '100%',
              columnGap: '64px',
              columnFill: 'auto',
              height: '100%',
              padding: `2rem ${margin}px`,
              transform: state.direction === 'rtl'
                ? `translateX(${currentPage * (containerRef.current?.clientWidth ?? 0)}px)`
                : `translateX(${-(currentPage * (containerRef.current?.clientWidth ?? 0))}px)`,
              transition: 'transform 0.3s ease',
              fontFamily: selectedFontFamily,
              fontSize: 'var(--reader-font-size, 16px)',
              lineHeight: lineSpacing,
              textAlign: justify ? 'justify' : undefined,
              letterSpacing: `${letterSpacing}px`,
              wordSpacing: `${wordSpacing}px`,
            }}
          >
            {currentChapter && (
              <div>
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

        {/* Footer — page info */}
        <div
          className="ebook-reader__footer"
          style={{
            textAlign: 'center',
            padding: '0.4rem 1rem',
            fontSize: '0.8rem',
            opacity: 0.6,
            borderTop: '1px solid var(--reader-border, #e0e0e0)',
            backgroundColor: 'var(--reader-surface, #f5f5f5)',
            flexShrink: 0,
          }}
        >
          {interpolate(t.pageIndicator, { current: bookPageNumber, total: bookTotalPages, percent: overallProgress })}
        </div>

        {/* Dictionary popover — positioned near selected text */}
        {hasProviders && (dictionaryLoading || dictionaryResult) && (
          <DictionaryPopover
            lookupResult={dictionaryResult}
            loading={dictionaryLoading}
            anchorPosition={anchorPosition ?? undefined}
            onClose={handleDictionaryClose}
            onSuggestionSelect={handleSuggestionSelect}
          />
        )}
        </TranslationContext.Provider>
      </ReaderContext.Provider>
    </div>
  );
};

export default Reader;
