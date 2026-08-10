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
  useId,
} from 'react';

import {
  MantineProvider,
  ActionIcon,
  Menu,
  Popover,
  Modal,
  Select,
  Slider,
  Switch,
  SegmentedControl,
  Button,
  Text,
  Loader,
  mergeThemeOverrides,
} from '@mantine/core';
import type { MantineThemeOverride } from '@mantine/core';
import { DEFAULT_MANTINE_THEME } from '../theme/mantine-theme';

import type { Book, ContentNode, InlineNode, FootnoteRefSpan } from '../models/book';
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
import { URDU_WEB_FONT_OPTIONS, injectUrduWebFontsCss } from '../services/urdu-web-fonts';

import { BookmarkPanel } from './BookmarkPanel';
import { DictionaryPopover } from './DictionaryPopover';
import { FootnotePopover } from './FootnotePopover';
import { ImageLightbox } from './ImageLightbox';

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
import type { PDFParserImpl } from '../parsers/pdf-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EpubSource = { type: 'epub'; data: ArrayBuffer | File };
export type UrlSource = { type: 'url'; url: string };
export type MarkdownSource = { type: 'markdown'; content: string | File };
export type PdfSource = { type: 'pdf'; data: ArrayBuffer | File };

export type ReaderSource = EpubSource | UrlSource | MarkdownSource | PdfSource;

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
 * Default font options: common cross-platform fonts plus the full Urdu/Arabic
 * script collection loaded live from https://github.com/inshapardaz/urdu-web-fonts.
 */
export const DEFAULT_FONT_OPTIONS: FontOption[] = [
  { name: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { name: 'Sans', family: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { name: 'Mono', family: '"SF Mono", "Fira Code", "Cascadia Code", "Courier New", monospace' },
  ...URDU_WEB_FONT_OPTIONS,
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
  /**
   * Override the PDF.js worker script URL used to render PDF pages.
   * Defaults to a version-pinned jsDelivr CDN URL; set this if you need to
   * self-host the worker (e.g. offline use or a strict CSP). Only relevant
   * when loading a `{ type: 'pdf' }` source.
   */
  pdfWorkerSrc?: string;
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
  /**
   * Overrides for the Mantine theme used by the reader's UI chrome (header
   * buttons, chapter menu, bookmarks popover, settings dialog). Deep-merged
   * with the built-in default theme. If this Reader is rendered inside an
   * app that already has its own `<MantineProvider>`, that app's theme is
   * inherited automatically (Mantine nested-provider merging) and this prop
   * only needs to specify what you want to override on top of it.
   * See the "Theming" section in the README.
   */
  mantineTheme?: MantineThemeOverride;
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
    case 'pdf-page':
      return '';
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
    case 'pdf':
      return source.data instanceof File ? source.data.name : 'pdf-buffer';
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
    case 'pdf':
      return 'pdf';
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
      return `<img src="${node.src}" alt="${node.alt || ''}" style="max-width:100%;max-height:calc(100vh - 120px);width:100%;height:auto;object-fit:contain" />`;
    case 'pdf-page':
      return node.pending
        ? ''
        : `<img src="${node.src}" alt="Page ${node.pageNumber}" style="max-width:100%;max-height:calc(100vh - 120px);width:auto;height:auto;object-fit:contain" />`;
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
    case 'footnote-ref': return `<sup style="color:var(--reader-accent,#0066cc);cursor:pointer;font-weight:600;font-size:0.75em">${escapeHtml(node.label)}</sup>`;
    default: return '';
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Content Renderers
// ---------------------------------------------------------------------------

const InlineNodeRenderer: React.FC<{ node: InlineNode; onImageClick?: (src: string, alt: string) => void; onFootnoteClick?: (node: FootnoteRefSpan, e: React.MouseEvent) => void; onLinkClick?: (href: string, e: React.MouseEvent) => void }> = ({ node, onImageClick, onFootnoteClick, onLinkClick }) => {
  const t = useTranslations();
  switch (node.type) {
    case 'text':
      return <>{node.content}</>;
    case 'bold':
      return <strong>{node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} onImageClick={onImageClick} onFootnoteClick={onFootnoteClick} onLinkClick={onLinkClick} />)}</strong>;
    case 'italic':
      return <em>{node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} onImageClick={onImageClick} onFootnoteClick={onFootnoteClick} onLinkClick={onLinkClick} />)}</em>;
    case 'code':
      return <code>{node.content}</code>;
    case 'inline-image':
      return (
        <img
          src={node.src}
          alt={node.alt || ''}
          loading="lazy"
          onClick={() => onImageClick?.(node.src!, node.alt || '')}
          style={{
            maxWidth: '100%',
            maxHeight: '10em',
            verticalAlign: 'middle',
            display: 'inline-block',
            objectFit: 'contain',
            cursor: 'pointer',
          }}
        />
      );
    case 'link':
      // Internal book links (fragment refs or relative paths) should not navigate
      // External links (http/https) open in new tab
      const isExternal = node.href.startsWith('http://') || node.href.startsWith('https://');
      return (
        <a
          href={isExternal ? node.href : undefined}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          style={{ color: 'var(--reader-accent, #0066cc)', cursor: 'pointer' }}
          onClick={isExternal ? undefined : (e) => { e.preventDefault(); onLinkClick?.(node.href, e); }}
        >
          {node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} onImageClick={onImageClick} onFootnoteClick={onFootnoteClick} onLinkClick={onLinkClick} />)}
        </a>
      );
    case 'footnote-ref':
      return (
        <sup
          data-testid="footnote-ref"
          onClick={(e) => onFootnoteClick?.(node, e)}
          style={{
            color: 'var(--reader-accent, #0066cc)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.75em',
          }}
          role="button"
          tabIndex={0}
          aria-label={interpolate(t.footnoteDialogLabel, { label: node.label })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFootnoteClick?.(node, e as unknown as React.MouseEvent);
            }
          }}
        >
          {node.label}
        </sup>
      );
    default:
      return null;
  }
};

const ContentNodeRenderer: React.FC<{ node: ContentNode; onImageClick?: (src: string, alt: string) => void; onFootnoteClick?: (node: FootnoteRefSpan, e: React.MouseEvent) => void; onLinkClick?: (href: string, e: React.MouseEvent) => void }> = ({ node, onImageClick, onFootnoteClick, onLinkClick }) => {
  switch (node.type) {
    case 'paragraph':
      return (
        <p>
          {node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} onImageClick={onImageClick} onFootnoteClick={onFootnoteClick} onLinkClick={onLinkClick} />)}
        </p>
      );
    case 'heading': {
      const Tag = `h${node.level}` as keyof React.JSX.IntrinsicElements;
      return (
        <Tag>
          {node.children.map((child, i) => <InlineNodeRenderer key={i} node={child} onImageClick={onImageClick} onFootnoteClick={onFootnoteClick} onLinkClick={onLinkClick} />)}
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
            onClick={() => onImageClick?.(node.src!, node.alt || '')}
            onError={(e) => console.warn(`[qari] Image failed to load: "${node.src?.substring(0, 80)}"`, e)}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 120px)',
              width: '100%',
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
              borderRadius: '4px',
              cursor: 'pointer',
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
    case 'pdf-page':
      if (node.pending) {
        return (
          <div
            data-testid="pdf-page"
            data-pending="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              breakInside: 'avoid',
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 120px)',
              aspectRatio: `${node.width} / ${node.height}`,
              margin: '0 auto',
            }}
          >
            <Loader />
          </div>
        );
      }
      return (
        <div
          data-testid="pdf-page"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            breakInside: 'avoid',
          }}
        >
          <img
            src={node.src}
            alt={`Page ${node.pageNumber}`}
            loading="lazy"
            onError={(e) => console.warn(`[qari] PDF page ${node.pageNumber} failed to render`, e)}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 120px)',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>
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
              {item.children.map((child, j) => <ContentNodeRenderer key={j} node={child} onImageClick={onImageClick} onFootnoteClick={onFootnoteClick} onLinkClick={onLinkClick} />)}
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
  pdfWorkerSrc,
  zoom = 100,
  direction = 'auto',
  dictionaryProviders,
  hunspellDictionaries,
  enableBuiltInDictionary = false,
  enableBookmarks = true,
  fontOptions = DEFAULT_FONT_OPTIONS,
  mantineTheme,
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
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [activeFootnote, setActiveFootnote] = useState<FootnoteRefSpan | null>(null);
  const [footnoteAnchor, setFootnoteAnchor] = useState<{ top: number; left: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pdfParserRef = useRef<PDFParserImpl | null>(null);

  // Refs for services that persist across renders
  const themeEngineRef = useRef<ThemeEngine | null>(null);
  const directionDetectorRef = useRef(new DefaultDirectionDetector());
  const dictionaryServiceRef = useRef(new DictionaryService());
  const bookmarkStoreRef = useRef<BookmarkStore | null>(null);
  const chapterNavigatorRef = useRef<ChapterNavigator | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Mantine theming — merge the built-in default with the consumer's
  // mantineTheme override, and scope the resulting CSS variables to this
  // Reader instance (rather than :root) so multiple Readers with different
  // themes on the same page don't clobber each other, and so we don't leak
  // variables into the host app's own global scope.
  // ---------------------------------------------------------------------------
  const mantineScopeId = useId();
  const mantineCssVariablesSelector = `[data-qari-mantine-scope="${mantineScopeId}"]`;
  const resolvedMantineTheme = useMemo(
    () => mergeThemeOverrides(DEFAULT_MANTINE_THEME, mantineTheme ?? {}),
    [mantineTheme]
  );
  // Mantine's Menu/Popover/Modal/Select portal into document.body by default.
  // When the reader itself is the fullscreened element (via the Fullscreen
  // API), anything portaled outside of it renders behind it — the browser's
  // fullscreen top layer sits above everything not inside the fullscreen
  // element's own subtree, regardless of z-index. Portaling into the
  // reader's own root keeps these dropdowns/dialogs inside that subtree so
  // they stay visible in fullscreen too.
  const mantinePortalTarget = rootRef.current ?? undefined;

  // ---------------------------------------------------------------------------
  // Track the pointer's last known position (ref only, no re-render) so we
  // can tell whether it's over the viewport at any given moment without
  // relying on `mouseenter`/`mouseleave` events, which don't fire just
  // because an overlay covering the viewport was removed from the DOM. See
  // the hover-resync effect below.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastPointerPositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load the Urdu/Arabic web font CSS (only registers @font-face rules;
  // actual font files are fetched lazily by the browser on first use)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    injectUrduWebFontsCss();
  }, []);

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
  // Footnote popover state management
  // ---------------------------------------------------------------------------
  const handleFootnoteClick = useCallback((node: FootnoteRefSpan, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const readerRect = rootRef.current?.getBoundingClientRect();
    if (readerRect) {
      setFootnoteAnchor({
        top: rect.bottom - readerRect.top,
        left: rect.left + rect.width / 2 - readerRect.left,
      });
    }
    setActiveFootnote(node);
  }, []);

  const handleFootnoteClose = useCallback(() => {
    setActiveFootnote(null);
    setFootnoteAnchor(null);
  }, []);

  /**
   * Handles clicks on internal book links (non-http hrefs).
   * Finds the target content in the book's footnoteMap and shows it as a footnote popover.
   */
  const handleLinkClick = useCallback((href: string, e: React.MouseEvent) => {
    if (!state.book) return;

    // Extract fragment id from href (could be "#id" or "file.xhtml#id")
    const hashIdx = href.indexOf('#');
    if (hashIdx === -1) return;
    const fragmentId = href.substring(hashIdx + 1);
    if (!fragmentId) return;

    // Look up the target content in the book's footnoteMap
    let targetContent: InlineNode[] | null = null;

    if (state.book.footnoteMap) {
      targetContent = state.book.footnoteMap.get(fragmentId) || null;
    }

    // If not found in the map, show a placeholder
    if (!targetContent || targetContent.length === 0) {
      targetContent = [{ type: 'text', content: `[Could not resolve: ${href}]` }];
    }

    // Get the link text as label
    const label = (e.currentTarget as HTMLElement).textContent?.trim() || '?';

    // Create a synthetic FootnoteRefSpan and show the popover
    const syntheticFootnote: FootnoteRefSpan = {
      type: 'footnote-ref',
      label,
      content: targetContent,
    };

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const readerRect = rootRef.current?.getBoundingClientRect();
    if (readerRect) {
      setFootnoteAnchor({
        top: rect.bottom - readerRect.top,
        left: rect.left + rect.width / 2 - readerRect.left,
      });
    }
    setActiveFootnote(syntheticFootnote);
  }, [state.book]);

  const renderInlineNode = useCallback((node: InlineNode, index: number): React.ReactNode => {
    return <InlineNodeRenderer key={index} node={node} />;
  }, []);

  // ---------------------------------------------------------------------------
  // Load book from source
  // ---------------------------------------------------------------------------
  const loadBook = useCallback(async (src: ReaderSource) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    pdfParserRef.current = null;

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
        case 'pdf': {
          const { PDFParserImpl } = await import('../parsers/pdf-parser');
          let data: ArrayBuffer;
          if (src.data instanceof File) {
            data = await readFileAsArrayBuffer(src.data);
          } else {
            data = src.data;
          }
          const parser = new PDFParserImpl();
          pdfParserRef.current = parser;
          book = await parser.parse(data, {
            workerSrc: pdfWorkerSrc,
            onPageRendered: (pageNumber, node) => {
              setState(prev => {
                if (!prev.book) return prev;
                const idx = pageNumber - 1;
                if (!prev.book.chapters[idx]) return prev;
                const chapters = prev.book.chapters.slice();
                chapters[idx] = { ...chapters[idx], content: [node] };
                return { ...prev, book: { ...prev.book, chapters } };
              });
            },
          });
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
        // In controlled mode, defer to `prev.bookmarks`: the dedicated
        // bookmarksProp-sync effect (above) is the source of truth and may
        // have applied a newer prop value while this async load was in
        // flight (e.g. epub/File/url sources with real awaits). Using the
        // `bookmarks` captured at load-start would clobber that update with
        // a stale one.
        bookmarks: bookmarksProp !== undefined ? prev.bookmarks : bookmarks,
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
  }, [direction, onReady, onError, bookmarksProp, pdfWorkerSrc]);

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
      // PDF pages are always a single full-bleed image sized to fit one
      // screen — skip the DOM measurement pass entirely for them, both as
      // an optimization (background page renders patch `state.book` one
      // page at a time, which would otherwise re-measure every chapter on
      // every single page arrival) and because measuring an unrendered
      // (pending) page's empty placeholder would be meaningless anyway.
      if (chapter.content.length === 1 && chapter.content[0].type === 'pdf-page') {
        counts.push(1);
        continue;
      }
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
  // Render a pending PDF page on demand if the reader navigates to it before
  // the background rendering pass gets there.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const node = state.book?.chapters[currentChapterIdx]?.content[0];
    if (node && node.type === 'pdf-page' && node.pending) {
      pdfParserRef.current?.requestPage(node.pageNumber);
    }
  }, [state.book, currentChapterIdx]);

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

  // Keyboard page navigation. Closing the chapter menu / bookmarks popover /
  // settings dialog on Escape or outside-click is handled natively by
  // Mantine's Menu, Popover, and Modal components — no manual wiring needed.
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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNextPage, goToPrevPage, state.direction]);

  // ---------------------------------------------------------------------------
  // Re-sync hover state when an overlay covering the viewport closes.
  // The chapter menu, bookmarks popover, settings dialog, dictionary/footnote
  // popovers, and image lightbox can all render on top of the viewport while
  // open, which makes the browser fire `mouseleave` on it (the pointer is now
  // over the overlay, not the viewport) — correctly hiding the hover nav
  // arrows. But removing that overlay on close doesn't make the browser fire
  // a fresh `mouseenter` just because the pointer is suddenly exposed again
  // without moving — this is true no matter how the overlay closed (a button
  // inside it, Escape, or clicking outside of it), so `hovered` stays stuck
  // at `false` and the arrows never come back until the mouse physically
  // moves. Re-derive it directly from the last known pointer position
  // whenever an overlay finishes closing, instead of waiting for an event
  // that will never come.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      chapterMenuOpen ||
      bookmarksPanelOpen ||
      settingsOpen ||
      lightboxImage ||
      activeFootnote ||
      dictionaryLoading ||
      dictionaryResult
    ) {
      return;
    }
    const pos = lastPointerPositionRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (
      pos &&
      rect &&
      pos.x >= rect.left &&
      pos.x <= rect.right &&
      pos.y >= rect.top &&
      pos.y <= rect.bottom
    ) {
      setHovered(true);
    }
  }, [chapterMenuOpen, bookmarksPanelOpen, settingsOpen, lightboxImage, activeFootnote, dictionaryLoading, dictionaryResult]);

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
    () => ({
      ...DEFAULT_TRANSLATIONS,
      ...translations,
      // Deep-merge fontNames so a partial override doesn't drop the
      // built-in font name translations it didn't mention.
      fontNames: { ...DEFAULT_TRANSLATIONS.fontNames, ...translations?.fontNames },
    }),
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
      <div
        ref={rootRef}
        className="ebook-reader"
        data-testid="reader-loading"
        role="status"
        aria-label="Loading book"
        style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <MantineProvider
          theme={resolvedMantineTheme}
          cssVariablesSelector={mantineCssVariablesSelector}
          env={typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 'test' : 'default'}
        >
          <div
            className="ebook-reader__loading"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}
          >
            <Loader />
            <Text c="dimmed">{t.loading}</Text>
          </div>
        </MantineProvider>
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
      data-qari-mantine-scope={mantineScopeId}
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
      <MantineProvider
        theme={resolvedMantineTheme}
        cssVariablesSelector={mantineCssVariablesSelector}
        env={typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 'test' : 'default'}
      >
      <ReaderContext.Provider value={contextValue}>
        <TranslationContext.Provider value={resolvedTranslations}>
        {/* Header bar with settings */}
        <div
          className="ebook-reader__header"
          dir={t.uiDirection}
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
          {/* Chapter list menu (start) */}
          <Menu
            opened={chapterMenuOpen}
            onChange={setChapterMenuOpen}
            position={t.uiDirection === 'rtl' ? 'bottom-end' : 'bottom-start'}
            withinPortal
            portalProps={{ target: mantinePortalTarget }}
            shadow="md"
            width={240}
          >
            <Menu.Target>
              <ActionIcon
                variant={chapterMenuOpen ? 'filled' : 'default'}
                size="lg"
                aria-label={t.tableOfContents}
              >
                ☰
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown data-testid="chapter-menu-panel" mah={300} style={{ overflowY: 'auto' }}>
              {state.book?.chapters.map((ch, idx) => (
                <Menu.Item
                  key={ch.id}
                  onClick={() => {
                    setCurrentChapterIdx(idx);
                    setCurrentPage(0);
                    setChapterMenuOpen(false);
                  }}
                  bg={idx === currentChapterIdx ? 'var(--mantine-primary-color-filled)' : undefined}
                  c={idx === currentChapterIdx ? 'white' : undefined}
                  style={{
                    textAlign: state.direction === 'rtl' ? 'right' : 'left',
                    fontWeight: idx === currentChapterIdx ? 700 : 400,
                  }}
                >
                  {ch.title}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>

          {/* Chapter title (center) */}
          <Text size="sm" fw={500} truncate="end" style={{ opacity: 0.8, flex: 1, textAlign: 'center' }}>
            {chapterTitle}
          </Text>

          {/* Settings button (right) */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {/* Bookmarks button */}
            {enableBookmarks && (
              <Popover
                opened={bookmarksPanelOpen}
                onChange={setBookmarksPanelOpen}
                position={t.uiDirection === 'rtl' ? 'bottom-start' : 'bottom-end'}
                withinPortal
                portalProps={{ target: mantinePortalTarget }}
                shadow="md"
                width={280}
              >
                <Popover.Target>
                  <ActionIcon
                    variant={bookmarksPanelOpen ? 'filled' : 'default'}
                    size="lg"
                    aria-label={t.bookmarks}
                    aria-expanded={bookmarksPanelOpen}
                    onClick={() => setBookmarksPanelOpen((open) => !open)}
                  >
                    🔖
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown data-testid="bookmarks-panel" mah={400} style={{ overflowY: 'auto' }}>
                  <BookmarkPanel
                    onNavigate={(chapterIdx, page) => {
                      setCurrentChapterIdx(chapterIdx);
                      setCurrentPage(page);
                      setBookmarksPanelOpen(false);
                    }}
                    onPageChange={onPageChange}
                  />
                </Popover.Dropdown>
              </Popover>
            )}

            {/* Fullscreen toggle */}
            <ActionIcon
              variant={isFullscreen ? 'filled' : 'default'}
              size="lg"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t.exitFullscreen : t.enterFullscreen}
            >
              {isFullscreen ? '⊗' : '⛶'}
            </ActionIcon>

            <ActionIcon
              variant={settingsOpen ? 'filled' : 'default'}
              size="lg"
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-label={t.readingSettings}
              aria-expanded={settingsOpen}
            >
              ⚙
            </ActionIcon>
          </div>

          {/* Settings dialog */}
          <Modal
            opened={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            title={t.readingSettings}
            size="xs"
            portalProps={{ target: mantinePortalTarget }}
          >
            <div dir={t.uiDirection}>
              <div style={{ marginBottom: '1rem' }}>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsTheme}
                </Text>
                <Button.Group>
                  {(['light', 'dark', 'sepia', 'high-contrast'] as ThemeName[]).map(thm => (
                    <Button
                      key={thm}
                      onClick={() => {
                        if (onSettingsChange) onSettingsChange({ theme: thm });
                      }}
                      variant={theme === thm ? 'filled' : 'default'}
                      size="xs"
                      fullWidth
                      style={{
                        background: theme === thm
                          ? undefined
                          : thm === 'light' ? '#fff' : thm === 'dark' ? '#1a1a2e' : thm === 'sepia' ? '#f4ecd8' : '#000',
                        color: theme === thm
                          ? undefined
                          : thm === 'dark' || thm === 'high-contrast' ? '#fff' : '#1a1a1a',
                      }}
                    >
                      {thm === 'light' ? t.themeLight : thm === 'dark' ? t.themeDark : thm === 'sepia' ? t.themeSepia : t.themeHighContrast}
                    </Button>
                  ))}
                </Button.Group>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <Select
                  label={t.settingsFontFamily}
                  value={selectedFontFamily}
                  onChange={(family) => {
                    if (!family) return;
                    setSelectedFontFamily(family);
                    const opt = fontOptions.find(o => o.family === family);
                    if (onSettingsChange) onSettingsChange({ fontFamily: opt?.name ?? family });
                  }}
                  data={fontOptions.map(opt => ({ value: opt.family, label: t.fontNames[opt.name] ?? opt.name }))}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: true, portalProps: { target: mantinePortalTarget } }}
                  styles={{ input: { fontFamily: selectedFontFamily } }}
                />
              </div>

              <div>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsFontSize}: {fontSize}px
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ActionIcon
                    variant="default"
                    onClick={() => {
                      if (onSettingsChange) onSettingsChange({ fontSize: Math.max(12, fontSize - 2) });
                    }}
                    disabled={fontSize <= 12}
                    aria-label={t.settingsFontSize}
                  >
                    A-
                  </ActionIcon>
                  <Slider
                    min={12}
                    max={48}
                    step={2}
                    value={fontSize}
                    onChange={(value) => {
                      if (onSettingsChange) onSettingsChange({ fontSize: value });
                    }}
                    label={null}
                    style={{ flex: 1 }}
                  />
                  <ActionIcon
                    variant="default"
                    onClick={() => {
                      if (onSettingsChange) onSettingsChange({ fontSize: Math.min(48, fontSize + 2) });
                    }}
                    disabled={fontSize >= 48}
                    aria-label={t.settingsFontSize}
                  >
                    A+
                  </ActionIcon>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Switch
                  checked={justify}
                  onChange={(e) => { if (onSettingsChange) onSettingsChange({ justify: e.currentTarget.checked }); }}
                  label={t.settingsJustify}
                  aria-label={t.settingsJustify}
                  labelPosition="left"
                  styles={{ body: { justifyContent: 'space-between' }, label: { fontSize: 'var(--mantine-font-size-sm)', fontWeight: 600 } }}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsLineSpacing}: {lineSpacing}×
                </Text>
                <Slider
                  min={1} max={3} step={0.25} value={lineSpacing} label={null}
                  onChange={(value) => { if (onSettingsChange) onSettingsChange({ lineSpacing: value }); }}
                  aria-label={t.settingsLineSpacing}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsLetterSpacing}: {letterSpacing}px
                </Text>
                <Slider
                  min={0} max={5} step={0.5} value={letterSpacing} label={null}
                  onChange={(value) => { if (onSettingsChange) onSettingsChange({ letterSpacing: value }); }}
                  aria-label={t.settingsLetterSpacing}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsWordSpacing}: {wordSpacing}px
                </Text>
                <Slider
                  min={0} max={10} step={1} value={wordSpacing} label={null}
                  onChange={(value) => { if (onSettingsChange) onSettingsChange({ wordSpacing: value }); }}
                  aria-label={t.settingsWordSpacing}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsMargin}: {margin}px
                </Text>
                <Slider
                  min={0} max={100} step={8} value={margin} label={null}
                  onChange={(value) => { if (onSettingsChange) onSettingsChange({ margin: value }); }}
                  aria-label={t.settingsMargin}
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Text size="sm" fw={600} mb="xs">
                  {t.settingsColumns}
                </Text>
                <SegmentedControl
                  fullWidth
                  value={String(columns)}
                  onChange={(value) => { if (onSettingsChange) onSettingsChange({ columns: Number(value) as 1 | 2 }); }}
                  data={[
                    { value: '1', label: '▐' },
                    { value: '2', label: '▐▐' },
                  ]}
                  aria-label={t.settingsColumns}
                />
              </div>

              <Button
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
                variant="default"
                fullWidth
                mt="lg"
              >
                {t.resetToDefaults}
              </Button>
            </div>
          </Modal>
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
                {currentChapter.content.map((node, ni) => (
                  <ContentNodeRenderer key={`${currentChapterIdx}-${ni}`} node={node} onImageClick={(src, alt) => setLightboxImage({ src, alt })} onFootnoteClick={handleFootnoteClick} onLinkClick={handleLinkClick} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer — page info */}
        <div
          className="ebook-reader__footer"
          dir={t.uiDirection}
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
          {state.book && state.book.chapters.length > 1 && (
            <> · {interpolate(t.chapterIndicator, { current: currentChapterIdx + 1, total: state.book.chapters.length, title: chapterTitle })}</>
          )}
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

        {/* Footnote popover — positioned near clicked footnote reference */}
        {activeFootnote && (
          <FootnotePopover
            footnote={activeFootnote}
            anchorPosition={footnoteAnchor ?? undefined}
            visible={true}
            onClose={handleFootnoteClose}
            renderInlineNode={renderInlineNode}
          />
        )}

        {/* Image lightbox overlay */}
        {lightboxImage && (
          <ImageLightbox
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            onClose={() => setLightboxImage(null)}
            portalTarget={mantinePortalTarget}
          />
        )}
        </TranslationContext.Provider>
      </ReaderContext.Provider>
      </MantineProvider>
    </div>
  );
};

export default Reader;
