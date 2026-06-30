import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Reader } from '../src/components/Reader';

type SourceType = 'markdown' | 'epub' | 'url';

interface ReaderSource {
  type: SourceType;
  content?: string;
  data?: ArrayBuffer;
  url?: string;
}

// ---------------------------------------------------------------------------
// View settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'qari-demo-settings';

interface ViewSettings {
  theme: 'light' | 'dark' | 'sepia' | 'high-contrast';
  fontFamily: 'serif' | 'sans-serif' | 'monospace';
  fontSize: number;
  justify: boolean;
  lineSpacing: number;
  letterSpacing: number;
  wordSpacing: number;
  margin: number;
  columns: 1 | 2;
}

const DEFAULT_SETTINGS: ViewSettings = {
  theme: 'light',
  fontFamily: 'serif',
  fontSize: 16,
  justify: true,
  lineSpacing: 1.5,
  letterSpacing: 0,
  wordSpacing: 0,
  margin: 32,
  columns: 1,
};

function loadSettings(): ViewSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      theme: ['light', 'dark', 'sepia', 'high-contrast'].includes(parsed.theme)
        ? parsed.theme : DEFAULT_SETTINGS.theme,
      fontFamily: ['serif', 'sans-serif', 'monospace'].includes(parsed.fontFamily)
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const { theme, fontFamily, fontSize, justify, lineSpacing, letterSpacing, wordSpacing, margin, columns } = settings;

  const [progress, setProgress] = useState<{
    currentPage: number;
    totalPages: number;
    currentChapter: number;
    totalChapters: number;
    chapterTitle: string;
    percentage: number;
  } | null>(null);

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
      <fieldset style={{
        border: '1px solid #ccc',
        borderRadius: '6px',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <legend style={{ fontWeight: 600, padding: '0 0.5rem' }}>Book Source</legend>

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
              accept=".epub,.md,.markdown,.txt"
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
        </div>

        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888' }}>
          Currently loaded: <strong>{sourceLabel}</strong>
        </p>
      </fieldset>

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
          enableBookmarks={false}
          margin={margin}
          columns={columns}
          onPageChange={(e) => console.log('Page change:', e)}
          onBookmarkCreate={(e) => console.log('Bookmark created:', e)}
          onError={(e) => console.error('Reader error:', e)}
          onReady={() => console.log('Reader ready')}
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
          }}
          onProgressChange={setProgress}
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
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
