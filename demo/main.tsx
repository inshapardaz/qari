import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
// Required once by any app using the Reader — see the README's "Theming" section.
import '@mantine/core/styles.css';
import { Reader } from '../src/components/Reader';
import { LOCALES } from '../src/i18n';
import type { LocaleCode } from '../src/i18n';
import type { PdfChapterMapEntry } from '../src/interfaces/parser';
import type { StarDictDictionaryConfig } from '../src/services/stardict-provider';
// Vite's `?raw` suffix inlines the file's text content at build/dev time —
// no runtime fetch, no need to also copy the README into demo/public. Lets
// the "Load README" button exercise the reader against a large, real-world,
// multi-heading Markdown document instead of just the short hand-written sample.
import README_CONTENT from '../README.md?raw';

type SourceType = 'markdown' | 'epub' | 'pdf' | 'url';

// ---------------------------------------------------------------------------
// UI translations for demo language selector — built into the library
// (see src/i18n/locales); the demo just picks which one is active.
// ---------------------------------------------------------------------------

type DemoLanguage = LocaleCode;

const LANGUAGE_LABELS: Record<DemoLanguage, string> = {
  en: 'English',
  ur: 'اردو',
  fr: 'Français',
};

interface ReaderSource {
  type: SourceType;
  content?: string;
  data?: ArrayBuffer;
  url?: string;
}

// ---------------------------------------------------------------------------
// Default offline Urdu dictionary ("فرہنگ آصفیہ") bundled with the demo
// (demo/public/dictionaries) and always available for Urdu-language books —
// English books fall back to the built-in online dictionary
// (enableBuiltInDictionary) instead, so no default is loaded for 'en'.
// Served from Vite's public dir at BASE_URL ('/' in dev, '/qari/' in the
// GitHub Pages build). Declared once at module scope — Reader re-creates its
// StarDictProvider (re-fetching the multi-MB .dict file) whenever the
// `stardictDictionaries` array reference changes, so this must stay a stable
// object rather than being rebuilt inline on every render.
// ---------------------------------------------------------------------------

const DEFAULT_URDU_DICTIONARY: StarDictDictionaryConfig = {
  language: 'ur',
  name: 'فرہنگ آصفیہ',
  ifoUrl: `${import.meta.env.BASE_URL}dictionaries/farhang.ifo`,
  idxUrl: `${import.meta.env.BASE_URL}dictionaries/farhang.idx`,
  dictUrl: `${import.meta.env.BASE_URL}dictionaries/farhang.dict`,
};

const DEFAULT_STARDICT_ENTRY = {
  id: 'default-urdu',
  label: `${DEFAULT_URDU_DICTIONARY.name} (ur) — default`,
  config: DEFAULT_URDU_DICTIONARY,
  isDefault: true as const,
};

// ---------------------------------------------------------------------------
// Icons — plain monochrome (currentColor) SVGs instead of colour emoji, so
// the header/dialog chrome stays black-and-white regardless of platform
// emoji rendering.
// ---------------------------------------------------------------------------

function IconBook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function IconFolderOpen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1H8a2 2 0 0 0-1.94 1.5L4 19" />
      <path d="M3 7v11a2 2 0 0 0 2 2h13.2a2 2 0 0 0 1.94-1.5l1.66-6.5A1 1 0 0 0 21 11H8a2 2 0 0 0-1.94 1.5L4 19" />
    </svg>
  );
}

function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function IconClose(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Modal — a plain fixed-overlay dialog (no Mantine dependency in the demo
// shell itself) used for the "Open book" and "Settings" popups. Closes on
// backdrop click or Escape.
// ---------------------------------------------------------------------------

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '5vh 1rem',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          background: '#fff',
        }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'none',
              lineHeight: 1,
              cursor: 'pointer',
              color: '#333',
              padding: '0.25rem',
              display: 'flex',
            }}
          >
            <IconClose />
          </button>
        </div>
        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function HeaderButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 500,
        color: '#111',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// View settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'qari-demo-settings';

interface ViewSettings {
  theme: 'light' | 'dark' | 'calm' | 'quiet' | 'paper' | 'focus' | 'high-contrast';
  fontFamily: string;
  fontSize: number;
  justify: boolean;
  lineSpacing: number;
  letterSpacing: number;
  wordSpacing: number;
  margin: number;
  columns: 1 | 2;
  scroll: boolean;
  showPageDivider: boolean;
  invertImagesInDarkMode: boolean;
  pdfZoom: number;
}

const DEFAULT_SETTINGS: ViewSettings = {
  theme: 'light',
  fontFamily: 'Serif',
  fontSize: 16,
  justify: true,
  lineSpacing: 1.5,
  letterSpacing: 0,
  wordSpacing: 0,
  margin: 32,
  columns: 1,
  scroll: false,
  showPageDivider: false,
  invertImagesInDarkMode: true,
  pdfZoom: 100,
};

function loadSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      theme: ['light', 'dark', 'calm', 'quiet', 'paper', 'focus', 'high-contrast'].includes(parsed.theme)
        ? parsed.theme : DEFAULT_SETTINGS.theme,
      fontFamily: typeof parsed.fontFamily === 'string' && parsed.fontFamily.length > 0
        ? parsed.fontFamily : DEFAULT_SETTINGS.fontFamily,
      fontSize: typeof parsed.fontSize === 'number' && parsed.fontSize >= 12 && parsed.fontSize <= 48
        ? parsed.fontSize : DEFAULT_SETTINGS.fontSize,
      justify: typeof parsed.justify === 'boolean' ? parsed.justify : DEFAULT_SETTINGS.justify,
      lineSpacing: typeof parsed.lineSpacing === 'number' && parsed.lineSpacing >= 1 && parsed.lineSpacing <= 3
        ? parsed.lineSpacing : DEFAULT_SETTINGS.lineSpacing,
      letterSpacing: typeof parsed.letterSpacing === 'number' && parsed.letterSpacing >= 0 && parsed.letterSpacing <= 5
        ? parsed.letterSpacing : DEFAULT_SETTINGS.letterSpacing,
      wordSpacing: typeof parsed.wordSpacing === 'number' && parsed.wordSpacing >= 0 && parsed.wordSpacing <= 10
        ? parsed.wordSpacing : DEFAULT_SETTINGS.wordSpacing,
      margin: typeof parsed.margin === 'number' && parsed.margin >= 0 && parsed.margin <= 100
        ? parsed.margin : DEFAULT_SETTINGS.margin,
      columns: [1, 2].includes(parsed.columns) ? parsed.columns : DEFAULT_SETTINGS.columns,
      scroll: typeof parsed.scroll === 'boolean' ? parsed.scroll : DEFAULT_SETTINGS.scroll,
      showPageDivider: typeof parsed.showPageDivider === 'boolean' ? parsed.showPageDivider : DEFAULT_SETTINGS.showPageDivider,
      invertImagesInDarkMode: typeof parsed.invertImagesInDarkMode === 'boolean' ? parsed.invertImagesInDarkMode : DEFAULT_SETTINGS.invertImagesInDarkMode,
      pdfZoom: typeof parsed.pdfZoom === 'number' && parsed.pdfZoom >= 50 && parsed.pdfZoom <= 300
        ? parsed.pdfZoom : DEFAULT_SETTINGS.pdfZoom,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: ViewSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // silently fail
  }
}

const SAMPLE_MARKDOWN = `# The Art of Reading

## Chapter 1: Beginning

Reading is one of the most fundamental skills a person can develop. It opens doors to knowledge, imagination, and understanding that no other medium can match.

Books have been companions to humanity for thousands of years. From clay tablets in ancient Mesopotamia to digital screens today, the written word persists as our primary means of preserving and sharing ideas.

### The Joy of Discovery

Every book is a new world waiting to be explored. The reader becomes an adventurer, navigating through landscapes of thought and emotion crafted by the author.

## Chapter 2: The Digital Age

Technology has transformed how we read. E-readers, tablets, and phones have made entire libraries portable. Yet the essence of reading remains unchanged — the intimate connection between author and reader.

### Accessibility

Digital reading has made books more accessible than ever. Font sizes can be adjusted, colors changed, and text-to-speech can read aloud for those who need it.

## Chapter 3: Reading in Urdu

اردو ادب دنیا کے قدیم ترین ادب میں سے ایک ہے۔ اردو شاعری اور نثر نے صدیوں سے لوگوں کے دلوں کو چھوا ہے۔

غالب، اقبال، اور فیض جیسے شعرا نے اردو ادب کو عالمی شہرت دلائی۔ ان کی تحریریں آج بھی اتنی ہی مقبول ہیں جتنی ان کے زمانے میں تھیں۔

## Chapter 4: Conclusion

Reading is not just a skill — it is a gateway. Whether in English, Urdu, Arabic, or any language, the act of reading connects us to the broader human experience.

Keep reading. Keep growing.
`;

function App() {
  const [settings, setSettings] = useState<ViewSettings>(loadSettings);
  const [source, setSource] = useState<ReaderSource>({ type: 'markdown', content: SAMPLE_MARKDOWN });
  const [urlInput, setUrlInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('Sample Markdown');
  // Bookmarks/notes/progress are all keyed by `book.metadata.identifier` —
  // but markdown and PDF sources never have one parsed from their own
  // content (unlike EPUB's <dc:identifier>), so without an explicit
  // override every such book collapses onto the same empty-string storage
  // key and ends up sharing bookmarks/notes with every other one. Tracked
  // here and always passed via `bookInfo.identifier` below so each loaded
  // source gets its own key regardless of format.
  const [bookIdentifier, setBookIdentifier] = useState('sample-markdown');
  const [language, setLanguage] = useState<DemoLanguage>('en');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Component props playground — demonstrates props not already covered by
  // the reader's own in-app settings dialog.
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [enableBookmarks, setEnableBookmarks] = useState(false);
  const [enableNotes, setEnableNotes] = useState(true);
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableProgressTracking, setEnableProgressTracking] = useState(true);
  const [enableBuiltInDictionary, setEnableBuiltInDictionary] = useState(true);
  // StarDict/GoldenDict offline dictionaries (.ifo/.idx/.dict[.dz]) — loaded as
  // sets of local files, since that's how these dictionaries are normally
  // distributed. Multiple dictionaries can be loaded at once (even for the
  // same language — the reader merges definitions from all of them);
  // `stardictLanguage` tags which book language the next one loaded applies to;
  // `stardictName` is its display name (shown as the source label on each of
  // its definitions in the popover) — left blank to fall back to the .ifo
  // file's own `bookname` field.
  const [stardictLanguage, setStardictLanguage] = useState('en');
  const [stardictName, setStardictName] = useState('');
  const [stardictEntries, setStardictEntries] = useState<
    { id: string; label: string; config: StarDictDictionaryConfig }[]
  >([]);
  const [stardictStatus, setStardictStatus] = useState('');
  const stardictFileInputRef = useRef<HTMLInputElement>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [blockDevTools, setBlockDevTools] = useState(false);
  const [direction, setDirection] = useState<'auto' | 'ltr' | 'rtl'>('auto');
  const [zoom, setZoom] = useState(100);
  const [closeMessage, setCloseMessage] = useState<string | null>(null);
  // bookInfo overrides — left blank by default so the reader falls back to
  // whatever title/author/language was parsed from the loaded source (see
  // the bookInfo prop's doc comment on ReaderProps). `language` matters for
  // dictionary lookup: it's matched exactly against each provider's
  // supportedLanguages, and the Markdown/PDF parsers never set it, so the
  // sample book (and any plain-text/PDF source) defaults to 'en' — override
  // it to 'ur' here to exercise the bundled Urdu StarDict dictionary against
  // the sample's Urdu chapter.
  const [bookInfoTitle, setBookInfoTitle] = useState('');
  const [bookInfoAuthor, setBookInfoAuthor] = useState('');
  const [bookInfoLanguage, setBookInfoLanguage] = useState('');
  // PDF chapter map (see `pdfChapters` prop, only relevant for `{ type: 'pdf' }`
  // sources) — entered as one "startPage: title" pair per line rather than
  // building a whole mini-editor for a handful of rows.
  const [pdfChaptersInput, setPdfChaptersInput] = useState('1: Foreword\n5: Chapter 1');

  // Popup visibility — "Open" (book source) and "Settings" (component props
  // playground) are the only two config surfaces now; everything else lives
  // full-page behind them.
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Persist settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Clear the onClose demo message after a few seconds
  useEffect(() => {
    if (!closeMessage) return;
    const timer = setTimeout(() => setCloseMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [closeMessage]);

  const updateSetting = useCallback(<K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const { theme, fontFamily, fontSize, justify, lineSpacing, letterSpacing, wordSpacing, margin, columns, scroll, showPageDivider, invertImagesInDarkMode, pdfZoom } = settings;

  const [progress, setProgress] = useState<{
    currentPage: number;
    totalPages: number;
    currentChapter: number;
    totalChapters: number;
    chapterTitle: string;
    percentage: number;
  } | null>(null);
  // Tracks the last time the reader persisted the reading position, so a
  // reload of this demo page (or reopening the same book) resumes here —
  // this is purely a display of the onProgressSave callback; the reader
  // itself already persisted it to its default localStorage-backed store.
  const [lastProgressSave, setLastProgressSave] = useState<string | null>(null);

  const handleLoadUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setSource({ type: 'url', url: trimmed });
    setSourceLabel(trimmed.length > 50 ? trimmed.slice(0, 50) + '…' : trimmed);
    // The URL itself is already a stable, unique identifier.
    setBookIdentifier(trimmed);
    setSourceModalOpen(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    // Name + size as the identifier: cheap, synchronous, and distinguishes
    // same-named files that actually differ, which name alone wouldn't.
    const identifier = `${file.name}-${file.size}`;

    if (name.endsWith('.epub')) {
      const buffer = await file.arrayBuffer();
      setSource({ type: 'epub', data: buffer });
      setSourceLabel(file.name);
    } else if (name.endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      setSource({ type: 'pdf', data: buffer });
      setSourceLabel(file.name);
    } else if (name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt')) {
      const text = await file.text();
      setSource({ type: 'markdown', content: text });
      setSourceLabel(file.name);
    } else {
      // Try reading as text
      const text = await file.text();
      setSource({ type: 'markdown', content: text });
      setSourceLabel(file.name + ' (as text)');
    }
    setBookIdentifier(identifier);
    setSourceModalOpen(false);

    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStardictFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    let ifo: string | undefined;
    let idx: ArrayBuffer | undefined;
    let dict: ArrayBuffer | undefined;
    let dictName = '';

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.ifo')) {
        ifo = await file.text();
      } else if (name.endsWith('.idx')) {
        idx = await file.arrayBuffer();
      } else if (name.endsWith('.dict') || name.endsWith('.dict.dz') || name.endsWith('.dz')) {
        dict = await file.arrayBuffer();
        dictName = file.name;
      }
    }

    if (ifo && idx && dict) {
      const id = `${dictName}-${Date.now()}`;
      const trimmedName = stardictName.trim();
      const label = trimmedName ? `${trimmedName} (${stardictLanguage})` : `${dictName} (${stardictLanguage})`;
      setStardictEntries((prev) => [
        ...prev,
        {
          id,
          label,
          config: {
            language: stardictLanguage,
            ...(trimmedName && { name: trimmedName }),
            ifo,
            idx,
            dict,
          },
        },
      ]);
      setStardictStatus('');
    } else {
      setStardictStatus('Incomplete set — select the matching .ifo + .idx + .dict(.dz) files together');
    }

    if (stardictFileInputRef.current) {
      stardictFileInputRef.current.value = '';
    }
  };

  const handleRemoveStardict = (id: string) => {
    setStardictEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleClearAllStardict = () => {
    setStardictEntries([]);
    setStardictStatus('');
  };

  const handleLoadSample = () => {
    setSource({ type: 'markdown', content: SAMPLE_MARKDOWN });
    setSourceLabel('Sample Markdown');
    setBookIdentifier('sample-markdown');
    setSourceModalOpen(false);
  };

  const handleLoadReadme = () => {
    setSource({ type: 'markdown', content: README_CONTENT });
    setSourceLabel('Project README');
    setBookIdentifier('project-readme');
    setSourceModalOpen(false);
  };

  const bookInfo = {
    identifier: bookIdentifier,
    ...(bookInfoTitle.trim() && { title: bookInfoTitle.trim() }),
    ...(bookInfoAuthor.trim() && { author: bookInfoAuthor.trim() }),
    ...(bookInfoLanguage.trim() && { language: bookInfoLanguage.trim() }),
  };

  // Parses the "startPage: title" lines above into a PdfChapterMapEntry[] —
  // malformed lines (no leading "N:") are silently skipped rather than
  // blocking the rest of the map from applying.
  const pdfChapters: PdfChapterMapEntry[] = pdfChaptersInput
    .split('\n')
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s*:\s*(.+)$/);
      return match ? { startPage: Number(match[1]), title: match[2].trim() } : null;
    })
    .filter((entry): entry is PdfChapterMapEntry => entry !== null);

  // Memoized so the array reference only changes when the user actually adds
  // or removes a dictionary — Reader re-creates (and re-fetches) every
  // StarDictProvider whenever this reference changes, so a fresh array on
  // every render would restart the default Urdu dictionary's ~6MB fetch
  // before it ever finished loading.
  const stardictDictionaries = useMemo(
    () => [DEFAULT_URDU_DICTIONARY, ...stardictEntries.map((entry) => entry.config)],
    [stardictEntries]
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        marginBottom: '0.5rem',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.15rem',
            marginBottom: '0.15rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}>
            <IconBook /> Qari — Ebook Reader Demo
          </h1>
          <p style={{ color: '#666', fontSize: '0.8rem' }}>
            Currently loaded: <strong>{sourceLabel}</strong> ·{' '}
            <a
              href="https://github.com/inshapardaz/qari"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#2563eb' }}
            >
              View on GitHub
            </a>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <HeaderButton onClick={() => setSourceModalOpen(true)}><IconFolderOpen /> Open</HeaderButton>
          <HeaderButton onClick={() => setSettingsModalOpen(true)}><IconSettings /> Settings</HeaderButton>
        </div>
      </header>

      <Modal title="Open Book" open={sourceModalOpen} onClose={() => setSourceModalOpen(false)}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {/* URL input */}
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              Load from URL (EPUB or Markdown)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="url"
                placeholder="https://example.com/book.epub"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                }}
              />
              <button
                onClick={handleLoadUrl}
                disabled={!urlInput.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: urlInput.trim() ? '#2563eb' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                }}
              >
                Load
              </button>
            </div>
          </div>

          {/* File picker */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              Or select a local file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,.pdf,.md,.markdown,.txt"
              onChange={handleFileSelect}
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          {/* Sample button */}
          <button
            onClick={handleLoadSample}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Load Sample
          </button>

          {/* README button — a large, real-world Markdown document (multiple
              headings, code blocks, tables, links) to exercise the reader
              against something bigger than the short hand-written sample. */}
          <button
            onClick={handleLoadReadme}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Load README
          </button>

          {/* Language selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              UI Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as DemoLanguage)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            >
              {(Object.keys(LANGUAGE_LABELS) as DemoLanguage[]).map((lang) => (
                <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
              ))}
            </select>
          </div>
        </div>

        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
          Currently loaded: <strong>{sourceLabel}</strong>
        </p>
      </Modal>

      <Modal title="Settings" open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={showCloseButton}
              onChange={(e) => setShowCloseButton(e.target.checked)}
            />
            showCloseButton
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={enableBookmarks}
              onChange={(e) => setEnableBookmarks(e.target.checked)}
            />
            enableBookmarks
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={enableNotes}
              onChange={(e) => setEnableNotes(e.target.checked)}
            />
            enableNotes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={enableSearch}
              onChange={(e) => setEnableSearch(e.target.checked)}
            />
            enableSearch
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={enableProgressTracking}
              onChange={(e) => setEnableProgressTracking(e.target.checked)}
            />
            enableProgressTracking
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={enableBuiltInDictionary}
              onChange={(e) => setEnableBuiltInDictionary(e.target.checked)}
            />
            enableBuiltInDictionary
          </label>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              stardictDictionaries — language
            </label>
            <input
              type="text"
              value={stardictLanguage}
              onChange={(e) => setStardictLanguage(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                width: '70px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              name (shown as its source label — optional)
            </label>
            <input
              type="text"
              placeholder="(use .ifo bookname)"
              value={stardictName}
              onChange={(e) => setStardictName(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                width: '160px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              Add a StarDict/GoldenDict dictionary (.ifo + .idx + .dict[.dz]) — load more than one, even for the same language, to see them merged
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                ref={stardictFileInputRef}
                type="file"
                accept=".ifo,.idx,.dict,.dz"
                multiple
                onChange={handleStardictFilesSelect}
                style={{ fontSize: '0.9rem' }}
              />
              {stardictEntries.length > 0 && (
                <button
                  onClick={handleClearAllStardict}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: '#444' }}>
              <li style={{ marginBottom: '0.15rem' }}>
                {DEFAULT_STARDICT_ENTRY.label}
              </li>
              {stardictEntries.map((entry) => (
                <li key={entry.id} style={{ marginBottom: '0.15rem' }}>
                  {entry.label}{' '}
                  <button
                    onClick={() => handleRemoveStardict(entry.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
            {stardictStatus && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>{stardictStatus}</p>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
            />
            readOnly
          </label>

          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
            title="Only takes effect in a production build (checks process.env.NODE_ENV) — has no visible effect here under `npm run dev`."
          >
            <input
              type="checkbox"
              checked={blockDevTools}
              onChange={(e) => setBlockDevTools(e.target.checked)}
            />
            blockDevTools <span style={{ color: '#888', fontSize: '0.8rem' }}>(prod only)</span>
          </label>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              direction
            </label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'auto' | 'ltr' | 'rtl')}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            >
              <option value="auto">auto</option>
              <option value="ltr">ltr</option>
              <option value="rtl">rtl</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              zoom: {zoom}%
            </label>
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '160px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              bookInfo.title
            </label>
            <input
              type="text"
              placeholder="(use parsed title)"
              value={bookInfoTitle}
              onChange={(e) => setBookInfoTitle(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                width: '180px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              bookInfo.author
            </label>
            <input
              type="text"
              placeholder="(use parsed author)"
              value={bookInfoAuthor}
              onChange={(e) => setBookInfoAuthor(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                width: '180px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
              bookInfo.language
            </label>
            <input
              type="text"
              placeholder="(use parsed language, e.g. 'ur')"
              value={bookInfoLanguage}
              onChange={(e) => setBookInfoLanguage(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                width: '220px',
              }}
            />
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#888', maxWidth: '260px' }}>
              Dictionary lookup matches this exactly against each provider's language — Markdown/PDF sources never
              parse a language, so set this to <strong>ur</strong> to try the default StarDict dictionary against
              the sample's Urdu chapter.
            </p>
          </div>

          {source.type === 'pdf' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#555' }}>
                pdfChapters (one "startPage: title" per line)
              </label>
              <textarea
                value={pdfChaptersInput}
                onChange={(e) => setPdfChaptersInput(e.target.value)}
                rows={3}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  width: '220px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          )}
        </div>

        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
          bookInfo overrides show up in the reader's chapter menu (☰) — see the book title/author there.
          {source.type === 'pdf' && ' pdfChapters titles the matching page ranges there too, instead of "Page N".'}
          {' '}StarDict: <strong>فرہنگ آصفیہ (ur) loaded by default{stardictEntries.length > 0 ? `, plus ${stardictEntries.length} more` : ''}</strong> — right-click a word in a matching-language book to look it up offline.
        </p>

        {closeMessage && (
          <p style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '4px',
            fontSize: '0.85rem',
            color: '#065f46',
          }}>
            {closeMessage}
          </p>
        )}
      </Modal>

      {/* Reader — fills the entire page below the (minimal, fixed-height)
          header; there's no outer max-width constraining it horizontally
          either, so it gets the full viewport in both dimensions. */}
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
      }}>
        <Reader
          source={source as any}
          bookInfo={bookInfo}
          theme={theme}
          fontFamily={fontFamily}
          fontSize={fontSize}
          justify={justify}
          lineSpacing={lineSpacing}
          letterSpacing={letterSpacing}
          wordSpacing={wordSpacing}
          enableBookmarks={enableBookmarks}
          enableNotes={enableNotes}
          enableSearch={enableSearch}
          enableProgressTracking={enableProgressTracking}
          enableBuiltInDictionary={enableBuiltInDictionary}
          stardictDictionaries={stardictDictionaries}
          readOnly={readOnly}
          blockDevTools={blockDevTools}
          showCloseButton={showCloseButton}
          direction={direction}
          zoom={zoom}
          pdfZoom={pdfZoom}
          margin={margin}
          columns={columns}
          scroll={scroll}
          showPageDivider={showPageDivider}
          invertImagesInDarkMode={invertImagesInDarkMode}
          translations={LOCALES[language]}
          pdfChapters={source.type === 'pdf' ? pdfChapters : undefined}
          onPageChange={(e) => console.log('Page change:', e)}
          onBookmarkCreate={(e) => console.log('Bookmark created:', e)}
          onError={(e) => console.error('Reader error:', e)}
          onReady={() => console.log('Reader ready')}
          onClose={() => setCloseMessage(`onClose fired at ${new Date().toLocaleTimeString()} — your app would hide/unmount the reader here.`)}
          onSettingsChange={(s) => {
            if (s.theme) updateSetting('theme', s.theme);
            if (s.fontFamily) updateSetting('fontFamily', s.fontFamily);
            if (s.fontSize !== undefined) updateSetting('fontSize', s.fontSize);
            if (s.justify !== undefined) updateSetting('justify', s.justify);
            if (s.lineSpacing !== undefined) updateSetting('lineSpacing', s.lineSpacing);
            if (s.letterSpacing !== undefined) updateSetting('letterSpacing', s.letterSpacing);
            if (s.wordSpacing !== undefined) updateSetting('wordSpacing', s.wordSpacing);
            if (s.margin !== undefined) updateSetting('margin', s.margin);
            if (s.columns !== undefined) updateSetting('columns', s.columns);
            if (s.scroll !== undefined) updateSetting('scroll', s.scroll);
            if (s.showPageDivider !== undefined) updateSetting('showPageDivider', s.showPageDivider);
            if (s.invertImagesInDarkMode !== undefined) updateSetting('invertImagesInDarkMode', s.invertImagesInDarkMode);
            if (s.pdfZoom !== undefined) updateSetting('pdfZoom', s.pdfZoom);
          }}
          onProgressChange={setProgress}
          onProgressSave={() => setLastProgressSave(new Date().toLocaleTimeString())}
        />
      </div>

      {/* Reading progress info */}
      {progress && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          fontSize: '0.85rem',
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span><strong>Page:</strong> {progress.currentPage}/{progress.totalPages}</span>
          <span><strong>Chapter:</strong> {progress.currentChapter + 1}/{progress.totalChapters} — {progress.chapterTitle}</span>
          <span><strong>Progress:</strong> {progress.percentage}%</span>
          {enableProgressTracking && lastProgressSave && (
            <span title="Reload this page (or switch books and back) to see the reader resume from here">
              <strong>Saved:</strong> {lastProgressSave}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
