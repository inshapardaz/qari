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
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useId,
} from 'react';

import {
  MantineProvider,
  DirectionProvider,
  ActionIcon,
  Menu,
  Popover,
  Select,
  Slider,
  Switch,
  Button,
  Text,
  Loader,
  mergeThemeOverrides,
} from '@mantine/core';
import type { MantineThemeOverride } from '@mantine/core';
import { DEFAULT_MANTINE_THEME } from '../theme/mantine-theme';

import type { Book, BookMetadata, ContentNode, InlineNode, FootnoteRefSpan } from '../models/book';
import type { Bookmark } from '../models/bookmark';
import type { Note } from '../models/note';
import type { ReadingProgressRecord } from '../models/progress';
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
import type { CustomNoteStoreAdapter, NoteChangeEvent } from '../interfaces/note-store';
import type { CustomProgressStoreAdapter, ProgressChangeEvent } from '../interfaces/progress-store';

import { ThemeEngine, THEMES } from '../services/theme-engine';
import { DefaultDirectionDetector } from '../services/direction-detector';
import { DictionaryService } from '../services/dictionary-service';
import { BookmarkStore } from '../services/bookmark-store';
import { LocalStorageStore } from '../services/local-storage-store';
import { NoteStore } from '../services/note-store';
import { ProgressStore } from '../services/progress-store';
import { ChapterNavigator, getChapterCharCount } from '../services/chapter-navigator';
import { URDU_WEB_FONT_OPTIONS, injectUrduWebFontsCss } from '../services/urdu-web-fonts';
import { getRangeOffsets, applyHighlights, clearHighlights } from '../utils/text-highlight';

import { BookmarkPanel } from './BookmarkPanel';
import { NotePanel } from './NotePanel';
import { DictionaryPopover } from './DictionaryPopover';
import { FootnotePopover } from './FootnotePopover';
import { ImageLightbox } from './ImageLightbox';
import { BookmarkIcon, NoteIcon, ThemeIcon, SinglePageIcon, DoublePageIcon, ScrollIcon, ExitFullscreenIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

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
  /** Continuous vertical scroll within the current chapter, instead of paginated columns. Defaults to false. */
  scroll?: boolean;
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
  /**
   * Overrides for the book info (title, author, publisher, cover, etc.)
   * shown in the reader's chapter menu and reported via `onReady`. Merged
   * over whatever was parsed from the source (e.g. EPUB OPF metadata) at
   * load time — any field given here takes priority over the parsed value,
   * so a host app that already has its own (more reliable) catalog data can
   * supply it directly instead of trusting the source file's own metadata.
   * Markdown/URL/PDF sources have little or no metadata of their own, so
   * this is also how they get a real title/author/cover shown at all.
   */
  bookInfo?: Partial<BookMetadata>;
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
  /** Continuous vertical scroll within the current chapter, instead of paginated columns. Defaults to false. */
  scroll?: boolean;
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
  /** Enable or disable the notes feature (select text, right-click to add a note). Defaults to true. */
  enableNotes?: boolean;
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
   * app that already has its own `<MantineProvider>`, that app's theme
   * tokens (colors, radius, etc.) are inherited automatically (Mantine
   * nested-provider merging) and this prop only needs to specify what you
   * want to override on top of it. The UI chrome's light/dark colorScheme is
   * a separate concern and does NOT follow the host app — it's always
   * derived from the reader's own `theme` prop instead, so the chrome stays
   * in sync with the reading theme the user picked in the reader itself
   * rather than switching if the host app's own dark-mode toggle changes.
   * See the "Theming" section in the README.
   */
  mantineTheme?: MantineThemeOverride;
  bookmarkAdapter?: CustomStoreAdapter;
  bookmarks?: Bookmark[];
  bookmarkStore?: BookmarkStoreInterface;
  /** Custom persistence for notes (e.g. a server-backed store). Defaults to localStorage. */
  noteAdapter?: CustomNoteStoreAdapter;
  /**
   * Enable or disable automatic reading-progress tracking. Defaults to true.
   * When enabled, the reader silently persists the current chapter/position
   * as the user navigates, and resumes there the next time the same book
   * (matched by `source`'s metadata identifier) is opened.
   */
  enableProgressTracking?: boolean;
  /** Custom persistence for reading progress (e.g. a server-backed store, to sync across devices). Defaults to localStorage. */
  progressAdapter?: CustomProgressStoreAdapter;
  /** Show a close button in the header. Defaults to false. */
  showCloseButton?: boolean;
  onBookmarkChange?: (event: BookmarkChangeEvent) => void;
  onPageChange?: (event: PageChangeEvent) => void;
  onBookmarkCreate?: (event: BookmarkEvent) => void;
  /** Called when a note is created, deleted, or its comment is updated. */
  onNoteChange?: (event: NoteChangeEvent) => void;
  /** Called whenever the current reading position is persisted (see `enableProgressTracking`). */
  onProgressSave?: (event: ProgressChangeEvent) => void;
  onError?: (event: ReaderError) => void;
  onReady?: (event: BookLoadedEvent) => void;
  onSettingsChange?: (settings: ReaderSettings) => void;
  onProgressChange?: (progress: ReadingProgress) => void;
  /** Called when the close button (see `showCloseButton`) is clicked. */
  onClose?: () => void;
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
  noteStore: NoteStore | null;
  chapterNavigator: ChapterNavigator | null;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (bookmarkId: string) => void;
  updateBookmark: (bookmark: Bookmark) => void;
  addNote: (note: Note) => void;
  removeNote: (noteId: string) => void;
  updateNote: (note: Note) => void;
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

/**
 * Best-effort touch-primary device detection, combining the `(hover: none)`
 * media feature with `navigator.maxTouchPoints`. Neither signal alone is
 * fully reliable — some mobile browsers/WebViews have been known to
 * misreport `hover: none` as `hover: hover`, and `maxTouchPoints` alone
 * would flag hybrid mouse+touchscreen laptops as touch-only — but either
 * being true is a good enough signal that the device is primarily
 * touch-driven. Deliberately not using `'ontouchstart' in window`: several
 * non-touch desktop browsers (and jsdom) define it speculatively, making it
 * an unreliable signal on its own.
 */
function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const hoverNone = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
  const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return hoverNone || hasTouchPoints;
}

// Mirrors BookmarkPanel's own DEFAULT_CHARS_PER_PAGE (and ChapterNavigator's
// default charsPerPage) — resuming a saved position converts its character
// offset back to a page with the same `Math.floor(position / charsPerPage)`
// bookmarks use, so the two round-trip consistently even though neither
// reads this position via real DOM/column pagination (see the comment above
// `handleBookmarkClick` in BookmarkPanel.tsx).
const DEFAULT_CHARS_PER_PAGE = 1500;

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
    notes: [],
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
  bookInfo,
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
  scroll = false,
  pdfWorkerSrc,
  zoom = 100,
  direction = 'auto',
  dictionaryProviders,
  hunspellDictionaries,
  enableBuiltInDictionary = false,
  enableBookmarks = true,
  enableNotes = true,
  enableProgressTracking = true,
  fontOptions = DEFAULT_FONT_OPTIONS,
  mantineTheme,
  bookmarkAdapter,
  bookmarks: bookmarksProp,
  bookmarkStore: bookmarkStoreProp,
  noteAdapter,
  progressAdapter,
  showCloseButton = false,
  onBookmarkChange,
  onPageChange,
  onBookmarkCreate,
  onNoteChange,
  onProgressSave,
  onError,
  onReady,
  onSettingsChange,
  onProgressChange,
  onClose,
}) => {
  const [state, setState] = useState<ReaderState>(createInitialState);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1); // pages in current chapter
  const [pagesPerChapter, setPagesPerChapter] = useState<number[]>([]); // cached page counts per chapter
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  // Whether the typeface <Select>'s own dropdown is open. Its options render
  // in a separate portal (comboboxProps.portalProps below) that's a DOM
  // *sibling* of the settings Popover's dropdown, not a descendant — even
  // though both target the same mantinePortalTarget node, each portal call
  // appends independently, so one doesn't nest inside the other. Mantine's
  // Popover dismisses on outside `mousedown`/`touchstart` by walking up from
  // the event target to check whether it's contained in its own dropdown
  // node; since the option isn't, tapping an option looks like an "outside"
  // tap to the settings Popover. On desktop this is harmless (option
  // selection fires on `click`, which is unaffected), but on touch devices
  // the `touchstart` alone is enough to close the settings Popover — and
  // with it, unmount the option — before the selection's `click` can ever
  // fire, so nothing gets selected and the panel just closes. Suppressing
  // closeOnClickOutside on the settings Popover while this dropdown is open
  // avoids that race.
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = useState(false);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  // Pending note context menu — position, plus whichever of these apply to
  // the right-click that opened it: a fresh text selection (offers "Add
  // note" and, if configured, "Meaning") and/or an existing note highlight
  // under the cursor (offers "Remove note"). Both can be present at once
  // (e.g. selecting across part of an existing highlight). The selection's
  // Range is captured up front so "Meaning" can restore it before handing
  // off to dictionary lookup — clicking a menu item can collapse the live
  // selection before that hook re-reads it.
  const [pendingNote, setPendingNote] = useState<{
    x: number;
    y: number;
    selection: { start: number; end: number; text: string; range: Range } | null;
    noteId: string | null;
  } | null>(null);
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
  // iOS Safari and Firefox-for-iOS (both WebKit-based) don't implement the
  // Fullscreen API for arbitrary elements on iPhone — `requestFullscreen`
  // is either absent or its returned promise always rejects. When that's
  // detected, we fall back to a CSS-only "fake fullscreen" (position:
  // fixed over the viewport) toggled purely by this state, instead of the
  // native API.
  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Whether the primary pointer is touch-only (no hover capability) — e.g.
  // phones/tablets, as opposed to a mouse/trackpad. Used to hide the
  // hover-only page-turn arrows on touch devices — they're not reachable by
  // touch anyway (nothing before a tap can "hover" first), and on touch,
  // taps that landed near the reader edges have been observed to reveal
  // them via the browser's touch-to-mouse-event emulation, which then
  // intercepts a tap meant for something else. Touch devices get side-tap
  // zones instead (see the same buttons below).
  //
  // `(hover: none)` is the feature Mantine's own CSS gates real `:hover`
  // styles behind, but some mobile browsers/WebViews (certain Android
  // WebViews and in-app browsers) have been known to misreport it as
  // `hover: hover` regardless of the device — so it's backed up with a
  // direct touch-support check (`ontouchstart`/`maxTouchPoints`), and either
  // signal being true is enough to call the device touch-primary.
  const [isTouchDevice, setIsTouchDevice] = useState(detectTouchDevice);
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
  const noteStoreRef = useRef<NoteStore | null>(null);
  const progressStoreRef = useRef<ProgressStore | null>(null);
  const chapterNavigatorRef = useRef<ChapterNavigator | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // PDF pages don't reflow like text — each one is a single fixed-size image
  // occupying its own chapter (see pdf-parser.ts). The page-display strategy
  // (columns / scroll) still applies to them, but rather than CSS-column
  // pagination or a per-chapter scroll flow, it changes which *chapters* are
  // shown and how: scroll mode stacks every page vertically in one
  // continuous flow, and two-column mode shows a spread of two consecutive
  // pages side by side instead of one page at a time.
  // ---------------------------------------------------------------------------
  const isPdfBook = source.type === 'pdf';
  const pdfScrollStack = scroll && isPdfBook;
  const pdfSpread = !scroll && columns === 2 && isPdfBook;
  const spreadStart = pdfSpread ? currentChapterIdx - (currentChapterIdx % 2) : currentChapterIdx;

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
  // Mantine resolves light/dark by default off a `data-mantine-color-scheme`
  // attribute it writes to the *document root* — shared by every
  // MantineProvider on the page, including a host app's own. Without
  // `forceColorScheme`, our nested provider would silently pick up whatever
  // colorScheme the host app's provider last set there, so the reader's UI
  // chrome (buttons, menus, popovers) would follow the host app's theme
  // instead of the reader theme the user actually picked (light/sepia read
  // as Mantine "light"; dark/high-contrast read as Mantine "dark").
  const mantineColorScheme: 'light' | 'dark' = theme === 'dark' || theme === 'high-contrast' ? 'dark' : 'light';
  // Mantine's default `getRootElement` is `document.documentElement` — with
  // `forceColorScheme` alone, the reader would still write its own
  // colorScheme onto that same shared `<html>` element, clobbering whatever
  // the host app's own MantineProvider (or dark-mode toggle) had set there.
  // Scoping it to the reader's own root instead keeps the reader's forced
  // colorScheme — and the CSS variables Mantine derives from it — self
  // contained, matching the `data-qari-mantine-scope` scoping already used
  // for `cssVariablesSelector` above.
  const mantineGetRootElement = useCallback(() => rootRef.current ?? document.documentElement, []);
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
    const supportsFullscreenApi =
      document.fullscreenEnabled && typeof rootRef.current.requestFullscreen === 'function';
    if (!supportsFullscreenApi) {
      setIsFakeFullscreen((prev) => !prev);
      return;
    }
    if (!document.fullscreenElement) {
      rootRef.current.requestFullscreen().catch(() => {
        // Real API present but the request was refused anyway (seen on
        // some iPadOS Safari versions) — fall back to fake fullscreen
        // rather than silently doing nothing.
        setIsFakeFullscreen(true);
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

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(hover: none)');
    const handleChange = () => setIsTouchDevice(detectTouchDevice());
    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Initialize BookmarkStore (responds to adapter prop changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    bookmarkStoreRef.current = new BookmarkStore(bookmarkAdapter);
  }, [bookmarkAdapter]);

  // ---------------------------------------------------------------------------
  // Initialize NoteStore (responds to adapter prop changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    noteStoreRef.current = new NoteStore(noteAdapter);
  }, [noteAdapter]);

  // ---------------------------------------------------------------------------
  // Initialize ProgressStore (responds to adapter prop changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    progressStoreRef.current = new ProgressStore(progressAdapter);
  }, [progressAdapter]);

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
  const { anchorPosition, lookupState, triggerLookup, dismiss, triggerFromCurrentSelection } = useSelectionHandler({
    contentRef,
    hasProviders,
    // When notes are enabled, Reader owns the right-click gesture itself
    // (see handleContentContextMenu below) so it can offer a unified menu
    // with both "Add note" and the dictionary lookup, instead of the two
    // features fighting over the same contextmenu event.
    disableContextMenu: enableNotes,
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
  // Note state management callbacks (exposed via context). Declared here
  // (rather than alongside the bookmark ones, further down) because the
  // note-creation handler just below needs `addNote` in its closure.
  // ---------------------------------------------------------------------------
  const addNote = useCallback((note: Note) => {
    setState(prev => ({
      ...prev,
      notes: [...prev.notes, note],
    }));
    if (onNoteChange) {
      onNoteChange({ type: 'created', note });
    }
  }, [onNoteChange]);

  const removeNote = useCallback((noteId: string) => {
    setState(prev => {
      const note = prev.notes.find(n => n.id === noteId);
      if (note && onNoteChange) {
        onNoteChange({ type: 'deleted', note });
      }
      return {
        ...prev,
        notes: prev.notes.filter(n => n.id !== noteId),
      };
    });
  }, [onNoteChange]);

  const updateNoteInState = useCallback((note: Note) => {
    setState(prev => ({
      ...prev,
      notes: prev.notes.map(n => n.id === note.id ? note : n),
    }));
    if (onNoteChange) {
      onNoteChange({ type: 'updated', note });
    }
  }, [onNoteChange]);

  // ---------------------------------------------------------------------------
  // Notes — right-click a text selection inside the content to add a note,
  // or right-click an existing note highlight to remove it (both can apply
  // at once, e.g. selecting across part of a highlight). Position is
  // captured as a plain character offset into the chapter's rendered text
  // (see `utils/text-highlight.ts`), not an AST offset, so it stays valid
  // across font/margin/layout changes that don't alter the text itself.
  //
  // Right-click-over-a-selection is also how dictionary lookup triggers
  // (see `useSelectionHandler`). When notes are enabled, Reader owns the
  // gesture and shows one unified menu with all applicable actions — see
  // the `disableContextMenu: enableNotes` passed to that hook above, and
  // the Menu rendered near the content div for the actual menu items.
  // ---------------------------------------------------------------------------
  const handleContentContextMenu = useCallback((e: React.MouseEvent) => {
    if (!enableNotes) return;

    const targetEl = e.target as HTMLElement | null;
    const highlightEl = targetEl?.closest?.('.qari-note-highlight') as HTMLElement | null;
    const noteId = highlightEl?.dataset.noteId ?? null;

    let selectionInfo: { start: number; end: number; text: string; range: Range } | null = null;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      if (contentRef.current && contentRef.current.contains(range.commonAncestorContainer)) {
        const { start, end } = getRangeOffsets(contentRef.current, range);
        if (start !== end) {
          selectionInfo = { start, end, text: selection.toString(), range: range.cloneRange() };
        }
      }
    }

    // Nothing for the unified menu to offer — let the normal context menu appear.
    if (!selectionInfo && !noteId) return;

    e.preventDefault();
    // The reader root has its own `transform` (see its style comment) so it
    // acts as the containing block for this menu's `position: fixed`
    // target — coordinates need to be relative to the root's box, not the
    // raw (viewport-relative) clientX/Y, or the menu renders offset from
    // the actual click whenever the reader isn't flush with the viewport's
    // top-left corner. Same fix as handleFootnoteClick/handleLinkClick use.
    const readerRect = rootRef.current?.getBoundingClientRect();
    const x = e.clientX - (readerRect?.left ?? 0);
    const y = e.clientY - (readerRect?.top ?? 0);
    setPendingNote({ x, y, selection: selectionInfo, noteId });
  }, [enableNotes]);

  const handleCreateNoteFromSelection = useCallback(async () => {
    const pending = pendingNote?.selection;
    setPendingNote(null);
    if (!pending || !noteStoreRef.current || !state.book) return;

    const chapterId = state.book.chapters[currentChapterIdx]?.id;
    // Not every source has a metadata identifier (e.g. plain markdown) —
    // fall back to '' like BookmarkPanel's currentBookId does, rather than
    // silently refusing to create a note at all.
    const bookId = state.book.metadata.identifier || '';
    if (!chapterId) return;

    // Clear the browser's own selection highlight now that it's being
    // handed off to a persistent note highlight instead.
    window.getSelection()?.removeAllRanges();

    try {
      const note = await noteStoreRef.current.create(
        bookId,
        chapterId,
        pending.start,
        pending.end,
        pending.text
      );
      addNote(note);
    } catch {
      // Note creation failure is non-fatal — the reader stays usable either way.
    }
  }, [pendingNote, state.book, currentChapterIdx, addNote]);

  const handleRemoveNoteFromMenu = useCallback(async () => {
    const noteId = pendingNote?.noteId;
    setPendingNote(null);
    if (!noteId || !noteStoreRef.current) return;

    try {
      await noteStoreRef.current.delete(noteId);
      removeNote(noteId);
    } catch {
      // Note deletion failure is non-fatal — the reader stays usable either way.
    }
  }, [pendingNote, removeNote]);

  // ---------------------------------------------------------------------------
  // Apply persistent highlights for the current chapter's notes. Re-derived
  // from scratch (clear then reapply) on every relevant change rather than
  // incrementally patched — see `clearHighlights`/`applyHighlights` for why
  // that's both simpler and safe here.
  // ---------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!enableNotes || !contentRef.current || !state.book) return;
    const chapterId = state.book.chapters[currentChapterIdx]?.id;
    if (!chapterId) return;

    const bookId = state.book.metadata.identifier || '';
    const chapterNotes = state.notes.filter(n => n.bookId === bookId && n.chapterId === chapterId);

    clearHighlights(contentRef.current);
    applyHighlights(
      contentRef.current,
      chapterNotes.map(n => ({ id: n.id, start: n.startOffset, end: n.endOffset }))
    );
  }, [enableNotes, state.book, state.notes, currentChapterIdx]);

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
            // Clone rather than hand over the consumer's own buffer directly
            // — if `source` gets recreated (e.g. a new object literal each
            // render, common when embedding this in a host app) `loadBook`
            // can run again with the same underlying ArrayBuffer, and any
            // parser step that transfers it (postMessage to a worker, which
            // detaches the original) would otherwise fail the second time.
            data = src.data.slice(0);
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
            // Clone rather than hand over the consumer's own buffer directly.
            // PDF.js transfers this buffer to its worker via postMessage,
            // which detaches (neuters) the original — reusing that same
            // ArrayBuffer instance across renders (e.g. a host app passing
            // a fresh `source` object literal wrapping the same underlying
            // buffer) then fails on the second load with "ArrayBuffer at
            // index 0 is already detached". Cloning makes every load get
            // its own fresh buffer regardless of how many times this runs.
            data = src.data.slice(0);
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

      // Apply bookInfo overrides (see its doc comment on ReaderProps) before
      // anything downstream reads book.metadata, so identifier-keyed
      // bookmark/note/progress storage and pageDirection detection below
      // also pick up an overridden identifier/pageDirection, not just the
      // display fields.
      if (bookInfo) {
        book = { ...book, metadata: { ...book.metadata, ...bookInfo } };
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

      // Load bookmarks and notes concurrently (rather than one after the
      // other) — they're independent, and a prior version that awaited
      // them sequentially added enough extra latency to this already-async
      // chain to break a timing-sensitive test elsewhere that reopens the
      // reader without an explicit wait.
      let bookmarks: Bookmark[] = [];
      const bookmarksLoaded = (async () => {
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
      })();

      // Not every source has a metadata identifier (e.g. plain markdown) —
      // fall back to '' like note creation does, rather than skipping the
      // load and never seeing notes saved under that same ''.
      let notes: Note[] = [];
      const notesLoaded = (async () => {
        if (noteStoreRef.current) {
          try {
            notes = await noteStoreRef.current.load(book.metadata.identifier || '');
          } catch {
            // Note loading failure is non-fatal
          }
        }
      })();

      // Resolve a saved reading position (if any) to resume at, the same
      // way bookmark navigation resolves a chapterId + character offset —
      // see handleBookmarkClick in BookmarkPanel.tsx. Falls back to the
      // start of the book (chapter 0, page 0) if tracking is disabled, no
      // record exists, or its chapterId no longer matches any chapter in
      // this book (e.g. the source content changed since it was saved).
      let savedProgress: ReadingProgressRecord | null = null;
      const progressLoaded = (async () => {
        if (enableProgressTracking && progressStoreRef.current) {
          try {
            savedProgress = await progressStoreRef.current.load(book.metadata.identifier || '');
          } catch {
            // Progress loading failure is non-fatal
          }
        }
      })();

      await Promise.all([bookmarksLoaded, notesLoaded, progressLoaded]);

      let resolvedChapterIdx = 0;
      let resolvedPage = 0;
      if (savedProgress) {
        const progress: ReadingProgressRecord = savedProgress;
        const chapterIdx = book.chapters.findIndex((ch) => ch.id === progress.chapterId);
        if (chapterIdx !== -1) {
          const chapterCharCount = getChapterCharCount(book.chapters[chapterIdx]);
          const position = progress.position;
          resolvedChapterIdx = chapterIdx;
          if (position > chapterCharCount) {
            resolvedPage = Math.max(0, navigator.getTotalPagesInChapter(chapterIdx) - 1);
          } else {
            resolvedPage = Math.floor(position / DEFAULT_CHARS_PER_PAGE);
          }
        }
      }
      // Sync the navigator's own position so the readingProgress percentage
      // below reflects the resumed position, not a fresh book's 0%.
      navigator.goToPage(resolvedChapterIdx, resolvedPage);

      const totalPages = navigator.getTotalPagesInChapter(resolvedChapterIdx);

      setState(prev => ({
        ...prev,
        book,
        loading: false,
        error: null,
        currentChapter: resolvedChapterIdx,
        currentPage: resolvedPage,
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
        notes,
      }));

      // Initialize page count tracking per chapter (will be filled as chapters are visited)
      setCurrentChapterIdx(resolvedChapterIdx);
      setCurrentPage(resolvedPage);
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
  }, [direction, onReady, onError, bookmarksProp, pdfWorkerSrc, enableProgressTracking, bookInfo]);

  useEffect(() => {
    loadBook(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // ---------------------------------------------------------------------------
  // Calculate total pages whenever chapter or layout changes
  // ---------------------------------------------------------------------------
  const recalcPages = useCallback(() => {
    // Scroll mode has no pages — the whole chapter is one continuously
    // scrollable flow.
    if (scroll) {
      setTotalPages(1);
      setPagesPerChapter(prev => {
        const updated = [...prev];
        updated[currentChapterIdx] = 1;
        return updated;
      });
      return;
    }
    if (!contentRef.current || !containerRef.current) return;
    const scrollWidth = contentRef.current.scrollWidth;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth === 0) return;
    // See `pagePitch` near the render return for why this isn't just
    // `scrollWidth / containerWidth` — the 64px inter-column gap and the
    // margin-as-padding both throw off the naive per-page pixel distance.
    const pagePitch = containerWidth - margin * 2 + 64;
    const computed = Math.max(1, Math.round(scrollWidth / pagePitch));
    setTotalPages(computed);
    // Update cached pages for current chapter
    setPagesPerChapter(prev => {
      const updated = [...prev];
      updated[currentChapterIdx] = computed;
      return updated;
    });
  }, [currentChapterIdx, scroll, margin]);

  // Recalculate on chapter change, font/zoom change, or window resize
  useEffect(() => {
    recalcPages();
  }, [currentChapterIdx, state.preferences, state.zoom, recalcPages]);

  useEffect(() => {
    // Small delay to let DOM settle after content render
    const timer = setTimeout(recalcPages, 50);
    return () => clearTimeout(timer);
    // isFullscreen/isFakeFullscreen: entering/exiting fullscreen changes the
    // container's width without necessarily firing a window 'resize' event —
    // real Fullscreen API toggles don't reliably fire one across browsers,
    // and the CSS-only fake-fullscreen fallback (position: fixed over the
    // viewport) never changes the window's own dimensions at all. Without
    // this, pagination stays computed for the pre-toggle width, so the page
    // ends up misaligned after exiting.
  }, [currentChapterIdx, state.book, state.preferences.fontSize, state.preferences.fontFamily, state.zoom, columns, margin, scroll, lineSpacing, letterSpacing, wordSpacing, recalcPages, isFullscreen, isFakeFullscreen]);

  useEffect(() => {
    const handleResize = () => recalcPages();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recalcPages]);

  // ---------------------------------------------------------------------------
  // Measure all chapters' page counts on book load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!state.book) return;

    // Scroll mode has no pages — every chapter is a single continuous flow.
    if (scroll) {
      setPagesPerChapter(new Array(state.book.chapters.length).fill(1));
      return;
    }

    if (!containerRef.current || !measureRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth === 0) return;

    const colWidth = (containerWidth - margin * 2 - (columns === 2 ? 64 : 0)) / columns;
    // Same page-pitch correction as recalcPages — see the comment above
    // the `pagePitch` const near the render return.
    const pagePitch = containerWidth - margin * 2 + 64;
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
      const pages = Math.max(1, Math.round(measurer.scrollWidth / pagePitch));
      counts.push(pages);
    }

    measurer.innerHTML = '';
    setPagesPerChapter(counts);
  }, [state.book, columns, margin, scroll, fontSize, lineSpacing, letterSpacing, wordSpacing]);

  // ---------------------------------------------------------------------------
  // Render a pending PDF page on demand if the reader navigates to it before
  // the background rendering pass gets there. In two-page spread mode, both
  // pages of the current spread need this, not just currentChapterIdx.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const requestIfPending = (idx: number) => {
      const node = state.book?.chapters[idx]?.content[0];
      if (node && node.type === 'pdf-page' && node.pending) {
        pdfParserRef.current?.requestPage(node.pageNumber);
      }
    };
    requestIfPending(currentChapterIdx);
    if (pdfSpread) requestIfPending(spreadStart + 1);
  }, [state.book, currentChapterIdx, pdfSpread, spreadStart]);

  // ---------------------------------------------------------------------------
  // In scroll mode, jump the scroll position back to the top whenever the
  // chapter changes (e.g. via the previous/next chapter hover arrows, or the
  // chapter menu) — the scrollable content div persists across chapters, so
  // its scrollTop wouldn't otherwise reset on its own.
  //
  // Not for the PDF stacked-scroll case: there, every page lives in the same
  // continuous flow and `currentChapterIdx` changes *because* the user
  // scrolled (see the IntersectionObserver effect below) — resetting
  // scrollTop in response would immediately fight the user's own scroll.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (scroll && !pdfScrollStack && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentChapterIdx, scroll, pdfScrollStack]);

  // ---------------------------------------------------------------------------
  // PDF stacked-scroll mode: track which page is most in view and keep
  // currentChapterIdx (used for the footer indicator, chapter-menu highlight,
  // and progress callbacks) in sync as the user scrolls through the stack.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!pdfScrollStack || !contentRef.current || typeof IntersectionObserver === 'undefined') return;
    const container = contentRef.current;
    const pageEls = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page-index]'));
    if (pageEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number(entry.target.getAttribute('data-pdf-page-index'));
          if (best === null || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best !== null) {
          setCurrentChapterIdx((prev) => (prev === best!.idx ? prev : best!.idx));
        }
      },
      { root: container, threshold: [0.25, 0.5, 0.75, 1] }
    );

    pageEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pdfScrollStack, state.book?.chapters.length]);

  // ---------------------------------------------------------------------------
  // Scrolls a specific PDF page (by chapter index) into view within the
  // stacked-scroll container. Used by chapter/bookmark/note navigation and
  // the next/prev page arrows when pdfScrollStack is active, since all pages
  // are already mounted and a plain state update wouldn't move the scroll
  // position on its own.
  // ---------------------------------------------------------------------------
  const scrollToPdfPage = useCallback((idx: number) => {
    requestAnimationFrame(() => {
      const el = contentRef.current?.querySelector<HTMLElement>(`[data-pdf-page-index="${idx}"]`);
      el?.scrollIntoView({ block: 'start' });
    });
  }, []);

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

  // ---------------------------------------------------------------------------
  // Swipe (touch) page navigation. Mirrors the ArrowLeft/ArrowRight keyboard
  // handler below, but via a single-finger horizontal drag on the page
  // viewport. Only mostly-horizontal single-touch gestures past a distance
  // threshold qualify, so this doesn't fight vertical scrolling (scroll
  // mode) or a text-selection drag.
  // ---------------------------------------------------------------------------
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleContentTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleContentTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;

    // A drag that left behind a real text selection was the user selecting
    // text, not paging — don't also turn the page out from under them.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const SWIPE_THRESHOLD = 50;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;

    const swipedLeft = dx < 0;
    if (state.direction === 'rtl') {
      if (swipedLeft) goToPrevPage(); else goToNextPage();
    } else {
      if (swipedLeft) goToNextPage(); else goToPrevPage();
    }
  }, [state.direction, goToNextPage, goToPrevPage]);

  // ---------------------------------------------------------------------------
  // Keep the exposed ReaderState's currentChapter/currentPage/totalPages in
  // sync with the real navigation state. These only ever got set once, at
  // book-load time (see createInitialState / loadBook), and were never
  // updated as the reader paginated — so `useReaderContext().state` was
  // stuck reporting chapter 0, page 0 for the rest of the session.
  // Consumers that read the current position directly off context (e.g.
  // BookmarkPanel, to know where to place a new bookmark) need this to
  // track the same currentChapterIdx/currentPage/totalPages used for
  // rendering, not just their initial values.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setState(prev => {
      if (prev.currentChapter === currentChapterIdx && prev.currentPage === currentPage && prev.totalPages === totalPages) {
        return prev;
      }
      return { ...prev, currentChapter: currentChapterIdx, currentPage, totalPages };
    });
  }, [currentChapterIdx, currentPage, totalPages]);

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

  // Persist the current reading position (see enableProgressTracking), so
  // the book resumes here next time it's opened (see the resume logic in
  // loadBook). Independent of onProgressChange above — that callback's
  // payload has no bookId/chapterId, so this recomputes what it needs
  // directly rather than depending on it firing.
  useEffect(() => {
    if (!enableProgressTracking || !progressStoreRef.current || !state.book) return;
    const chapter = state.book.chapters[currentChapterIdx];
    if (!chapter) return;
    const bookId = state.book.metadata.identifier || '';
    // Inverts the same charsPerPage-based position -> page calculation used
    // to resume (and that BookmarkPanel uses for its own bookmarks), so
    // resuming lands back on this same page.
    const position = currentPage * DEFAULT_CHARS_PER_PAGE;
    const pagesBefore = pagesPerChapter.slice(0, currentChapterIdx).reduce((sum, p) => sum + (p || 1), 0);
    const bookPage = pagesBefore + currentPage + 1;
    const bookTotal = pagesPerChapter.reduce((sum, p) => sum + (p || 1), 0);
    const percentage = bookTotal > 0 ? Math.round((bookPage / bookTotal) * 100) : 0;

    progressStoreRef.current.save(bookId, chapter.id, position, percentage)
      .then((progress) => {
        if (onProgressSave) onProgressSave({ type: 'saved', progress });
      })
      .catch(() => { /* Progress save failure is non-fatal */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, currentChapterIdx, pagesPerChapter, state.book, enableProgressTracking]);

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
      notesPanelOpen ||
      pendingNote ||
      themePanelOpen ||
      layoutPanelOpen ||
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
  }, [chapterMenuOpen, bookmarksPanelOpen, notesPanelOpen, pendingNote, themePanelOpen, layoutPanelOpen, settingsOpen, lightboxImage, activeFootnote, dictionaryLoading, dictionaryResult]);

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
    noteStore: noteStoreRef.current,
    chapterNavigator: chapterNavigatorRef.current,
    addBookmark,
    removeBookmark,
    updateBookmark: updateBookmarkInState,
    addNote,
    removeNote,
    updateNote: updateNoteInState,
  }), [state, addBookmark, removeBookmark, updateBookmarkInState, addNote, removeNote, updateNoteInState]);

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
        <DirectionProvider initialDirection={t.uiDirection} detectDirection={false} key={t.uiDirection}>
          <MantineProvider
            theme={resolvedMantineTheme}
            cssVariablesSelector={mantineCssVariablesSelector}
            forceColorScheme={mantineColorScheme}
            getRootElement={mantineGetRootElement}
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
        </DirectionProvider>
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

  // The CSS-column pagination trick advances the flow one virtual "column
  // group" at a time, with a fixed 64px gap between every column (page
  // boundaries included) but with `margin` applied as padding on the same
  // element — which only lands once at the very start/end of the whole
  // flow, not on every page. So the true pixel distance from one page's
  // columns to the next is `containerWidth - margin*2 + 64`, not
  // `containerWidth` on its own; using the raw container width for the
  // page-turn transform (and for the page-count math) only happened to
  // line up when margin was exactly half the gap (the 32px default).
  const pagePitch = (containerRef.current?.clientWidth ?? 0) - margin * 2 + 64;

  return (
    <div
      ref={rootRef}
      className="ebook-reader"
      data-testid="reader-content"
      data-qari-mantine-scope={mantineScopeId}
      // Intentionally the UI direction, not the book's `state.direction`:
      // this element is also the Mantine portal target (mantinePortalTarget
      // below), and Mantine's own CSS keys RTL mirroring off a plain
      // `[dir="rtl"]` ancestor-selector match — which matches ANY ancestor
      // with that attribute, not just the nearest one. So if this root
      // carried the book's (possibly RTL) direction, every floating
      // Mantine control (Modal, Menu, Popover, Select, and especially
      // Slider, whose thumb/track positioning is selector-driven) would
      // render mirrored whenever book direction differs from UI direction,
      // no matter what `dir` a nested wrapper re-asserts — a `[dir="rtl"]`
      // descendant-combinator match isn't overridden by a closer `dir="ltr"`
      // in between. The book content itself sets its own `dir={state.direction}`
      // independently further down, so this doesn't affect its rendering.
      dir={t.uiDirection}
      style={{
        zoom: `${state.zoom}%`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        backgroundColor: 'var(--reader-bg, #ffffff)',
        // Deliberately NOT `var(--reader-fg)` here — this is the color
        // inherited by descendants that don't set their own (chapter/
        // bookmarks/theme/layout/settings menus and popovers), and those
        // are UI chrome, not book content. The header and footer bars are
        // the exception: their background/border already follow the
        // reading theme (`--reader-surface`/`--reader-border`), so their
        // text does too, via an explicit `color: var(--reader-fg)` on each
        // (see below) rather than relying on this root default. The content
        // div gets the same explicit override for the same reason.
        color: 'var(--mantine-color-text, #1a1a1a)',
        height: '100%',
        transition: 'background-color 0.1s, color 0.1s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        // A harmless identity transform establishes this element as the
        // containing block for `position: fixed` descendants. Mantine's
        // Modal (and other overlays) use position:fixed internally, which
        // is normally viewport-relative — but we portal them into this
        // element (mantinePortalTarget below, for the fullscreen z-index
        // fix), so without this they'd center/size against the whole
        // browser window instead of the reader's own box. That's wrong
        // whenever the reader is embedded in a constrained area rather
        // than filling the viewport (e.g. the demo's `height: 70vh` box).
        transform: 'translate(0, 0)',
        // Fake-fullscreen fallback (see isFakeFullscreen above): pin the
        // reader over the full viewport with `position: fixed`. `100dvh`
        // rather than `100vh` so it accounts for the address bar on iOS
        // instead of extending behind it.
        ...(isFakeFullscreen
          ? {
              position: 'fixed' as const,
              inset: 0,
              width: '100vw',
              height: '100dvh',
              zIndex: 2147483647,
            }
          : {}),
      }}
    >
      <DirectionProvider initialDirection={t.uiDirection} detectDirection={false} key={t.uiDirection}>
        <MantineProvider
          theme={resolvedMantineTheme}
          cssVariablesSelector={mantineCssVariablesSelector}
          forceColorScheme={mantineColorScheme}
          getRootElement={mantineGetRootElement}
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
                  color: 'var(--reader-fg, #1a1a1a)',
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
                      variant={chapterMenuOpen ? 'filled' : 'transparent'}
                      size="lg"
                      aria-label={t.tableOfContents}
                      style={chapterMenuOpen
                        ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                        : { color: 'var(--reader-fg, #1a1a1a)' }}
                    >
                      ☰
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown data-testid="chapter-menu-panel" mah={340} style={{ overflowY: 'auto' }}>
                    {state.book?.metadata && (
                      <div
                        data-testid="book-info"
                        dir={t.uiDirection}
                        style={{
                          display: 'flex',
                          gap: '0.6rem',
                          alignItems: 'center',
                          padding: '0.4rem 0.7rem 0.7rem',
                          marginBottom: '0.25rem',
                          borderBottom: '1px solid var(--mantine-color-default-border)',
                        }}
                      >
                        {state.book.metadata.coverImage && (
                          <img
                            src={state.book.metadata.coverImage}
                            alt=""
                            style={{
                              width: '2.5rem',
                              height: '3.5rem',
                              objectFit: 'cover',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={700} truncate="end">
                            {state.book.metadata.title}
                          </Text>
                          {state.book.metadata.author && (
                            <Text size="xs" c="dimmed" truncate="end">
                              {state.book.metadata.author}
                            </Text>
                          )}
                        </div>
                      </div>
                    )}
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
                          variant={bookmarksPanelOpen ? 'filled' : 'transparent'}
                          size="lg"
                          aria-label={t.bookmarks}
                          aria-expanded={bookmarksPanelOpen}
                          onClick={() => setBookmarksPanelOpen((open) => !open)}
                          style={bookmarksPanelOpen
                            ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                            : { color: 'var(--reader-fg, #1a1a1a)' }}
                        >
                          <BookmarkIcon />
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

                  {/* Notes button — notes themselves are created by
                      selecting text and right-clicking (see the content
                      div's onContextMenu below); this panel just lists,
                      edits, and navigates to existing ones. */}
                  {enableNotes && (
                    <Popover
                      opened={notesPanelOpen}
                      onChange={setNotesPanelOpen}
                      position={t.uiDirection === 'rtl' ? 'bottom-start' : 'bottom-end'}
                      withinPortal
                      portalProps={{ target: mantinePortalTarget }}
                      shadow="md"
                      width={300}
                    >
                      <Popover.Target>
                        <ActionIcon
                          variant={notesPanelOpen ? 'filled' : 'transparent'}
                          size="lg"
                          aria-label={t.notesPanelTitle}
                          aria-expanded={notesPanelOpen}
                          onClick={() => setNotesPanelOpen((open) => !open)}
                          style={notesPanelOpen
                            ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                            : { color: 'var(--reader-fg, #1a1a1a)' }}
                        >
                          <NoteIcon />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown data-testid="notes-panel" mah={400} style={{ overflowY: 'auto' }}>
                        <NotePanel
                          onNavigate={(chapterIdx, page) => {
                            setCurrentChapterIdx(chapterIdx);
                            setCurrentPage(page);
                            setNotesPanelOpen(false);
                          }}
                          onPageChange={onPageChange}
                        />
                      </Popover.Dropdown>
                    </Popover>
                  )}

                  {/* Theme button — its own title-bar item rather than a
                      section buried in the settings panel. */}
                  <Popover
                    opened={themePanelOpen}
                    onChange={setThemePanelOpen}
                    position={t.uiDirection === 'rtl' ? 'bottom-start' : 'bottom-end'}
                    withinPortal
                    portalProps={{ target: mantinePortalTarget }}
                    shadow="md"
                    radius="lg"
                  >
                    <Popover.Target>
                      <ActionIcon
                        variant={themePanelOpen ? 'filled' : 'transparent'}
                        size="lg"
                        onClick={() => setThemePanelOpen((open) => !open)}
                        aria-label={t.settingsTheme}
                        aria-expanded={themePanelOpen}
                        style={themePanelOpen
                          ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                          : { color: 'var(--reader-fg, #1a1a1a)' }}
                      >
                        <ThemeIcon />
                      </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown data-testid="theme-panel" p="sm">
                      <div dir={t.uiDirection} style={{ display: 'flex', gap: '0.75rem' }}>
                        {(['light', 'dark', 'sepia', 'high-contrast'] as ThemeName[]).map(thm => {
                          const active = theme === thm;
                          const label = thm === 'light' ? t.themeLight : thm === 'dark' ? t.themeDark : thm === 'sepia' ? t.themeSepia : t.themeHighContrast;
                          return (
                            <div key={thm} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                              <button
                                type="button"
                                onClick={() => { if (onSettingsChange) onSettingsChange({ theme: thm }); }}
                                aria-pressed={active}
                                aria-label={label}
                                style={{
                                  width: '3rem',
                                  height: '3rem',
                                  borderRadius: 'var(--mantine-radius-lg)',
                                  border: active ? '2px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)',
                                  boxShadow: active ? '0 2px 6px rgba(0, 0, 0, 0.15)' : 'none',
                                  backgroundColor: THEMES[thm].background,
                                  color: THEMES[thm].foreground,
                                  fontWeight: 700,
                                  fontSize: '1.1rem',
                                  cursor: 'pointer',
                                  padding: 0,
                                  transition: 'box-shadow 0.15s, border-color 0.15s',
                                }}
                              >
                                Aa
                              </button>
                              <Text size="10px" c="dimmed" fw={active ? 700 : 500} style={{ textAlign: 'center', lineHeight: 1.15, maxWidth: '3.5rem' }}>
                                {label}
                              </Text>
                            </div>
                          );
                        })}
                      </div>
                    </Popover.Dropdown>
                  </Popover>

                  {/* Layout button — its own title-bar item; the icon
                      tracks whichever layout is currently active. */}
                  <Popover
                    opened={layoutPanelOpen}
                    onChange={setLayoutPanelOpen}
                    position={t.uiDirection === 'rtl' ? 'bottom-start' : 'bottom-end'}
                    withinPortal
                    portalProps={{ target: mantinePortalTarget }}
                    shadow="md"
                    radius="lg"
                  >
                    <Popover.Target>
                      <ActionIcon
                        variant={layoutPanelOpen ? 'filled' : 'transparent'}
                        size="lg"
                        onClick={() => setLayoutPanelOpen((open) => !open)}
                        aria-label={t.settingsLayout}
                        aria-expanded={layoutPanelOpen}
                        style={layoutPanelOpen
                          ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                          : { color: 'var(--reader-fg, #1a1a1a)' }}
                      >
                        {scroll ? <ScrollIcon /> : columns === 2 ? <DoublePageIcon /> : <SinglePageIcon />}
                      </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown data-testid="layout-panel" p="sm">
                      <div dir={t.uiDirection} style={{ display: 'flex', gap: '0.5rem' }}>
                        {([
                          { key: 'single', active: !scroll && columns === 1, icon: <SinglePageIcon size="1.2em" />, label: t.settingsLayoutSingle, onClick: () => { if (onSettingsChange) onSettingsChange({ scroll: false, columns: 1 }); } },
                          { key: 'double', active: !scroll && columns === 2, icon: <DoublePageIcon size="1.2em" />, label: t.settingsLayoutDouble, onClick: () => { if (onSettingsChange) onSettingsChange({ scroll: false, columns: 2 }); } },
                          { key: 'scroll', active: scroll, icon: <ScrollIcon size="1.2em" />, label: t.settingsLayoutScroll, onClick: () => { if (onSettingsChange) onSettingsChange({ scroll: true }); } },
                        ]).map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={opt.onClick}
                            aria-pressed={opt.active}
                            aria-label={opt.label}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              borderRadius: 'var(--mantine-radius-md)',
                              border: opt.active ? '2px solid var(--mantine-primary-color-filled)' : '1px solid var(--mantine-color-default-border)',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {opt.icon}
                          </button>
                        ))}
                      </div>
                    </Popover.Dropdown>
                  </Popover>

                  <Popover
                    opened={settingsOpen}
                    onChange={setSettingsOpen}
                    position={t.uiDirection === 'rtl' ? 'bottom-start' : 'bottom-end'}
                    withinPortal
                    portalProps={{ target: mantinePortalTarget }}
                    shadow="md"
                    radius="lg"
                    width={300}
                    trapFocus
                    // See fontDropdownOpen above — keeps a tap on the nested
                    // typeface dropdown's options from being misread as an
                    // outside tap that closes this whole panel.
                    closeOnClickOutside={!fontDropdownOpen}
                  >
                    <Popover.Target>
                      <ActionIcon
                        variant={settingsOpen ? 'filled' : 'transparent'}
                        size="lg"
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        aria-label={t.readingSettings}
                        aria-expanded={settingsOpen}
                        style={settingsOpen
                          ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                          : { color: 'var(--reader-fg, #1a1a1a)' }}
                      >
                        <span aria-hidden="true" style={{ fontWeight: 600 }}>Aa</span>
                      </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown data-testid="settings-panel" p="sm">
                      <div dir={t.uiDirection}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--mantine-spacing-sm)' }}>
                          <Text fw={700} size="lg">
                            {t.readingSettings}
                          </Text>
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            aria-label={t.resetToDefaults}
                            title={t.resetToDefaults}
                            onClick={() => {
                              const defaultFamily = fontOptions.find(o => o.name.toLowerCase() === 'serif')?.family
                                ?? fontOptions[0]?.family
                                ?? 'Georgia, "Times New Roman", serif';
                              setSelectedFontFamily(defaultFamily);
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
                          >
                            ↺
                          </ActionIcon>
                        </div>

                        {/* Font size — chip row with a percentage readout
                            (relative to the 16px baseline), no slider. Every
                            control here applies immediately via onSettingsChange. */}
                        <div style={{ marginBottom: '1.1rem' }}>
                          <Text size="xs" c="dimmed" fw={500} mb={4}>
                            {t.settingsFontSize}
                          </Text>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ActionIcon
                              variant="default"
                              radius="md"
                              onClick={() => { if (onSettingsChange) onSettingsChange({ fontSize: Math.max(12, fontSize - 2) }); }}
                              disabled={fontSize <= 12}
                              aria-label={t.settingsFontSize}
                            >
                              −
                            </ActionIcon>
                            <Text data-testid="font-size-percent" fw={600} style={{ flex: 1, textAlign: 'center' }}>
                              {Math.round((fontSize / 16) * 100)}%
                            </Text>
                            <ActionIcon
                              variant="default"
                              radius="md"
                              onClick={() => { if (onSettingsChange) onSettingsChange({ fontSize: Math.min(48, fontSize + 2) }); }}
                              disabled={fontSize >= 48}
                              aria-label={t.settingsFontSize}
                            >
                              +
                            </ActionIcon>
                          </div>
                        </div>

                        {/* Typeface */}
                        <div style={{ marginBottom: '1.1rem' }}>
                          <Select
                            size="xs"
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
                            onDropdownOpen={() => setFontDropdownOpen(true)}
                            onDropdownClose={() => setFontDropdownOpen(false)}
                            comboboxProps={{ withinPortal: true, portalProps: { target: mantinePortalTarget } }}
                            styles={{
                              label: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-dimmed)', fontWeight: 500, marginBottom: 4 },
                              input: { fontFamily: selectedFontFamily },
                            }}
                          />
                        </div>

                        {/* Justify text */}
                        <div style={{ marginBottom: '1.1rem' }}>
                          <Switch
                            size="sm"
                            checked={justify}
                            onChange={(e) => { if (onSettingsChange) onSettingsChange({ justify: e.currentTarget.checked }); }}
                            label={t.settingsJustify}
                            aria-label={t.settingsJustify}
                            labelPosition="left"
                            styles={{ body: { justifyContent: 'space-between' }, label: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600 } }}
                          />
                        </div>

                        {/* Extra properties — collapsed by default, since
                            they're not part of the primary at-a-glance
                            controls above (font size, typeface, justify).
                            Theme and layout are now their own title-bar
                            items. */}
                        <Button
                          variant="subtle"
                          size="xs"
                          color="gray"
                          fullWidth
                          justify="space-between"
                          rightSection={<span aria-hidden="true" style={{ transform: moreSettingsOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms', display: 'inline-block' }}>⌄</span>}
                          onClick={() => setMoreSettingsOpen((open) => !open)}
                          aria-expanded={moreSettingsOpen}
                        >
                          {t.settingsMore}
                        </Button>
                        {moreSettingsOpen && (
                          <div style={{ marginTop: '1.1rem' }}>
                            {/* Line height */}
                            <div style={{ marginBottom: '1.1rem' }}>
                              <Text size="xs" c="dimmed" fw={500} mb={4}>
                                {t.settingsLineSpacing}
                              </Text>
                              <Slider
                                size="xs"
                                min={1} max={3} step={0.25} value={lineSpacing}
                                onChange={(value) => { if (onSettingsChange) onSettingsChange({ lineSpacing: value }); }}
                                marks={[1, 2, 3].map(value => ({ value, label: value.toFixed(1) }))}
                                label={(value) => `${value}×`}
                                aria-label={t.settingsLineSpacing}
                                mb="0.6rem"
                              />
                            </div>

                            {/* Letter spacing */}
                            <div style={{ marginBottom: '1.1rem' }}>
                              <Text size="xs" c="dimmed" fw={500} mb={4}>
                                {t.settingsLetterSpacing}
                              </Text>
                              <Slider
                                size="xs"
                                min={0} max={5} step={0.5} value={letterSpacing}
                                onChange={(value) => { if (onSettingsChange) onSettingsChange({ letterSpacing: value }); }}
                                marks={[0, 2.5, 5].map(value => ({ value, label: String(value) }))}
                                label={(value) => `${value}px`}
                                aria-label={t.settingsLetterSpacing}
                                mb="0.6rem"
                              />
                            </div>

                            {/* Word spacing */}
                            <div style={{ marginBottom: '1.1rem' }}>
                              <Text size="xs" c="dimmed" fw={500} mb={4}>
                                {t.settingsWordSpacing}
                              </Text>
                              <Slider
                                size="xs"
                                min={0} max={10} step={1} value={wordSpacing}
                                onChange={(value) => { if (onSettingsChange) onSettingsChange({ wordSpacing: value }); }}
                                marks={[0, 5, 10].map(value => ({ value, label: String(value) }))}
                                label={(value) => `${value}px`}
                                aria-label={t.settingsWordSpacing}
                                mb="0.6rem"
                              />
                            </div>

                            {/* Margin */}
                            <div style={{ marginBottom: '1.1rem' }}>
                              <Text size="xs" c="dimmed" fw={500} mb={4}>
                                {t.settingsMargin}
                              </Text>
                              <Slider
                                size="xs"
                                min={0} max={100} step={8} value={margin}
                                onChange={(value) => { if (onSettingsChange) onSettingsChange({ margin: value }); }}
                                marks={[0, 50, 100].map(value => ({ value, label: String(value) }))}
                                label={(value) => `${value}px`}
                                aria-label={t.settingsMargin}
                                mb="0.6rem"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Popover.Dropdown>
                  </Popover>

                  {/* Fullscreen toggle */}
                  <ActionIcon
                    variant={isFullscreen || isFakeFullscreen ? 'filled' : 'transparent'}
                    size="lg"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen || isFakeFullscreen ? t.exitFullscreen : t.enterFullscreen}
                    style={isFullscreen || isFakeFullscreen
                      ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                      : { color: 'var(--reader-fg, #1a1a1a)' }}
                  >
                    {isFullscreen || isFakeFullscreen ? <ExitFullscreenIcon /> : '⛶'}
                  </ActionIcon>

                  {showCloseButton && (
                    <ActionIcon
                      variant="transparent"
                      size="lg"
                      onClick={() => onClose?.()}
                      aria-label={t.closeReader}
                      style={{ color: 'var(--reader-fg, #1a1a1a)' }}
                    >
                      ✕
                    </ActionIcon>
                  )}
                </div>

              </div>

              {/* Page viewport — fixed height, no scroll */}
              <div
                ref={containerRef}
                className="ebook-reader__viewport"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onTouchStart={handleContentTouchStart}
                onTouchEnd={handleContentTouchEnd}
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

                {/* Edge navigation zones — in scroll mode there are no
                    pages, so these turn into previous/next CHAPTER
                    navigation instead (isFirstPage/isLastPage and
                    goToPrevPage/goToNextPage already reduce to chapter-level
                    boundaries and navigation when totalPages is forced to 1,
                    which recalcPages does for every chapter in scroll mode).
                    On hover-capable devices these are the visible chevron
                    arrows, shown on hover. On touch devices (isTouchDevice)
                    there's no hover to reveal them, so instead they're
                    always-present but fully invisible tap zones — matching
                    "touch the sides to turn the page" — with swipe (see
                    handleContentTouchStart/End) covering the rest of the
                    screen. */}
                {(isTouchDevice ? !isFirstPage : hovered && !isFirstPage) && (
                  <button
                    onClick={goToPrevPage}
                    aria-label={scroll ? t.previousChapter : t.previousPage}
                    style={{
                      position: 'absolute',
                      [state.direction === 'rtl' ? 'right' : 'left']: 0,
                      top: 0,
                      bottom: 0,
                      width: '60px',
                      border: 'none',
                      background: isTouchDevice ? 'transparent' : 'linear-gradient(to right, rgba(0,0,0,0.04), transparent)',
                      color: 'var(--reader-fg, #1a1a1a)',
                      cursor: 'pointer',
                      opacity: isTouchDevice ? 0 : 0.6,
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!isTouchDevice) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (!isTouchDevice) (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
                  >
                    {!isTouchDevice && (state.direction === 'rtl' ? <ChevronRightIcon size="1.75rem" /> : <ChevronLeftIcon size="1.75rem" />)}
                  </button>
                )}
                {(isTouchDevice ? !isLastPage : hovered && !isLastPage) && (
                  <button
                    onClick={goToNextPage}
                    aria-label={scroll ? t.nextChapter : t.nextPage}
                    style={{
                      position: 'absolute',
                      [state.direction === 'rtl' ? 'left' : 'right']: 0,
                      top: 0,
                      bottom: 0,
                      width: '60px',
                      border: 'none',
                      background: isTouchDevice ? 'transparent' : 'linear-gradient(to left, rgba(0,0,0,0.04), transparent)',
                      color: 'var(--reader-fg, #1a1a1a)',
                      cursor: 'pointer',
                      opacity: isTouchDevice ? 0 : 0.6,
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!isTouchDevice) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (!isTouchDevice) (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
                  >
                    {!isTouchDevice && (state.direction === 'rtl' ? <ChevronLeftIcon size="1.75rem" /> : <ChevronRightIcon size="1.75rem" />)}
                  </button>
                )}

                {/* Content — either horizontally paged via CSS columns +
                    transform, or (scroll mode) a normal vertically
                    scrollable flow with no columns/pages at all. */}
                <div
                  ref={contentRef}
                  className={scroll ? 'ebook-reader__scroll' : 'ebook-reader__columns'}
                  dir={state.direction}
                  onContextMenu={handleContentContextMenu}
                  style={scroll ? {
                    height: '100%',
                    overflowY: 'auto',
                    padding: `2rem ${margin}px`,
                    color: 'var(--reader-fg, #1a1a1a)',
                    fontFamily: selectedFontFamily,
                    fontSize: 'var(--reader-font-size, 16px)',
                    lineHeight: lineSpacing,
                    textAlign: justify ? 'justify' : undefined,
                    letterSpacing: `${letterSpacing}px`,
                    wordSpacing: `${wordSpacing}px`,
                  } : {
                    columnWidth: containerRef.current
                      ? `${(containerRef.current.clientWidth - margin * 2 - (columns === 2 ? 64 : 0)) / columns}px`
                      : '100%',
                    columnGap: '64px',
                    columnFill: 'auto',
                    height: '100%',
                    padding: `2rem ${margin}px`,
                    transform: state.direction === 'rtl'
                      ? `translateX(${currentPage * pagePitch}px)`
                      : `translateX(${-(currentPage * pagePitch)}px)`,
                    transition: 'transform 0.3s ease',
                    color: 'var(--reader-fg, #1a1a1a)',
                    fontFamily: selectedFontFamily,
                    fontSize: 'var(--reader-font-size, 16px)',
                    lineHeight: lineSpacing,
                    textAlign: justify ? 'justify' : undefined,
                    letterSpacing: `${letterSpacing}px`,
                    wordSpacing: `${wordSpacing}px`,
                  }}
                >
                  {currentChapter && (
                    <div style={(scroll || columns === 1) ? { maxWidth: '720px', margin: '0 auto' } : undefined}>
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
                  color: 'var(--reader-fg, #1a1a1a)',
                  flexShrink: 0,
                }}
              >
                {interpolate(t.pageIndicator, { current: bookPageNumber, total: bookTotalPages, percent: overallProgress })}
                {state.book && state.book.chapters.length > 1 && (
                  <> · {interpolate(t.chapterIndicator, { current: currentChapterIdx + 1, total: state.book.chapters.length, title: chapterTitle })}</>
                )}
              </div>

              {/* Unified selection context menu — appears at the cursor on
                  right-click over a text selection and/or an existing note
                  highlight inside the content (see handleContentContextMenu);
                  a virtual 1x1 target positioned at the click point anchors
                  the Mantine Menu since there's no real element to attach it
                  to. "Add note" comes first when there's a selection to add,
                  "Remove note" shows up when right-clicking an existing
                  highlight, and the dictionary lookup ("Meaning") only shows
                  up when providers are configured and there's a selection —
                  all applicable actions share this one menu instead of
                  fighting over the same right-click. */}
              {enableNotes && (
                <Menu
                  opened={!!pendingNote}
                  onChange={(opened) => { if (!opened) setPendingNote(null); }}
                  withinPortal
                  portalProps={{ target: mantinePortalTarget }}
                  position="bottom-start"
                  shadow="md"
                >
                  <Menu.Target>
                    <div
                      data-testid="note-context-menu-anchor"
                      style={{
                        position: 'fixed',
                        left: pendingNote?.x ?? 0,
                        top: pendingNote?.y ?? 0,
                        width: 1,
                        height: 1,
                        pointerEvents: 'none',
                      }}
                    />
                  </Menu.Target>
                  <Menu.Dropdown data-testid="note-context-menu">
                    {pendingNote?.selection && (
                      <Menu.Item onClick={handleCreateNoteFromSelection}>
                        {t.noteAddMenuItem}
                      </Menu.Item>
                    )}
                    {pendingNote?.noteId && (
                      <Menu.Item color="red" onClick={handleRemoveNoteFromMenu}>
                        {t.noteRemoveMenuItem}
                      </Menu.Item>
                    )}
                    {hasProviders && pendingNote?.selection && (
                      <Menu.Item
                        onClick={() => {
                          // Restore the selection captured at right-click
                          // time — clicking a menu item can collapse the
                          // live selection before the lookup hook gets a
                          // chance to re-read it.
                          const sel = window.getSelection();
                          sel?.removeAllRanges();
                          sel?.addRange(pendingNote.selection!.range);
                          triggerFromCurrentSelection();
                          setPendingNote(null);
                        }}
                      >
                        {t.dictionaryLookupMenuItem}
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              )}

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
      </DirectionProvider>
    </div>
  );
};

export default Reader;
