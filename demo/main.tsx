import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
// Required once by any app using the Reader — see the README's "Theming" section.
import '@mantine/core/styles.css';
import { Reader } from '../src/components/Reader';
import { LOCALES } from '../src/i18n';
import type { LocaleCode } from '../src/i18n';

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
// Collapsible panel — a plain <details>/<summary> disclosure, styled to
// match the rest of the demo's fieldset-based controls.
// ---------------------------------------------------------------------------

function CollapsiblePanel({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: '1px solid #ccc',
        borderRadius: '6px',
        marginBottom: '1rem',
      }}
    >
      <summary
        style={{
          fontWeight: 600,
          padding: '0.75rem 1rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {title}
      </summary>
      <div style={{ padding: '0 1rem 1rem' }}>
        {children}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// View settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'qari-demo-settings';

interface ViewSettings {
  theme: 'light' | 'dark' | 'sepia' | 'high-contrast';
  fontFamily: string;
  fontSize: number;
  justify: boolean;
  lineSpacing: number;
  letterSpacing: number;
  wordSpacing: number;
  margin: number;
  columns: 1 | 2;
  scroll: boolean;
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
};

function loadSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      theme: ['light', 'dark', 'sepia', 'high-contrast'].includes(parsed.theme)
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
  const [language, setLanguage] = useState<DemoLanguage>('en');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Component props playground — demonstrates props not already covered by
  // the reader's own in-app settings dialog.
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [enableBookmarks, setEnableBookmarks] = useState(false);
  const [enableNotes, setEnableNotes] = useState(true);
  const [enableProgressTracking, setEnableProgressTracking] = useState(true);
  const [enableBuiltInDictionary, setEnableBuiltInDictionary] = useState(true);
  const [direction, setDirection] = useState<'auto' | 'ltr' | 'rtl'>('auto');
  const [zoom, setZoom] = useState(100);
  const [closeMessage, setCloseMessage] = useState<string | null>(null);

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

  const { theme, fontFamily, fontSize, justify, lineSpacing, letterSpacing, wordSpacing, margin, columns, scroll } = settings;

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
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();

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

    // Reset file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadSample = () => {
    setSource({ type: 'markdown', content: SAMPLE_MARKDOWN });
    setSourceLabel('Sample Markdown');
  };

  return (
    <div>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          📖 Qari — Ebook Reader Demo
        </h1>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Live demo with hot-reload. Edit source files and see changes instantly.
        </p>
      </header>

      {/* Source selection */}
      <CollapsiblePanel title="Book Source" defaultOpen>
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
      </CollapsiblePanel>

      {/* Component props playground */}
      <CollapsiblePanel title="Component Props">
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
        </div>

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
      </CollapsiblePanel>

      {/* Reader */}
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        height: '70vh',
      }}>
        <Reader
          source={source as any}
          theme={theme}
          fontFamily={fontFamily}
          fontSize={fontSize}
          justify={justify}
          lineSpacing={lineSpacing}
          letterSpacing={letterSpacing}
          wordSpacing={wordSpacing}
          enableBookmarks={enableBookmarks}
          enableNotes={enableNotes}
          enableProgressTracking={enableProgressTracking}
          enableBuiltInDictionary={enableBuiltInDictionary}
          showCloseButton={showCloseButton}
          direction={direction}
          zoom={zoom}
          margin={margin}
          columns={columns}
          scroll={scroll}
          translations={LOCALES[language]}
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
          }}
          onProgressChange={setProgress}
          onProgressSave={() => setLastProgressSave(new Date().toLocaleTimeString())}
        />
      </div>

      {/* Reading progress info */}
      {progress && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          fontSize: '0.85rem',
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
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
