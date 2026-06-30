# Qari — Universal Ebook Reader

A framework-agnostic ebook reading component built with React at its core, exposing wrapper layers for Vue 3 and vanilla Web Components. Supports EPUB files, remote URLs, and Markdown input with full RTL/Urdu Nastaliq support, theming, dictionary integration, and configurable bookmark storage.

## Features

- Read EPUB files, Markdown documents, or fetch content from URLs
- Four built-in themes: light, dark, sepia, high-contrast (WCAG AAA)
- Font family and size controls (serif, sans-serif, monospace, Nastaliq)
- Zoom from 50% to 300% with pinch-to-zoom support
- Chapter navigation with progress tracking
- Automatic RTL/LTR detection with Urdu Nastaliq rendering
- Dictionary integration via a plugin interface (language-aware, context-aware)
- Bookmarks stored locally by default, or on a custom server via adapter pattern
- Usable as a React component, Vue 3 component, or standard Web Component

## Project Structure

```
qari/
├── src/
│   ├── models/           # Core data types (Book, Bookmark, ReaderState, Events)
│   ├── interfaces/       # Service contracts (Parser, Dictionary, StoreAdapter, ThemeEngine, DirectionDetector)
│   ├── parsers/          # EPUB parser/printer, Markdown parser/printer, URL loader
│   │   └── __tests__/    # Property-based tests for parsers (round-trip, malformed input)
│   ├── services/         # Business logic (ThemeEngine, BookmarkStore, DictionaryService, DirectionDetector, ChapterNavigator)
│   │   └── __tests__/    # Property-based tests for services
│   ├── components/       # React UI (Reader, ZoomController, ChapterIndex, ThemeSelector, BookmarkPanel, DictionaryPopover)
│   │   └── __tests__/    # Property-based tests for components
│   └── wrappers/         # Framework adapters
│       ├── vue/          # Vue 3 wrapper component
│       ├── web-component/# Custom Element wrapper (Shadow DOM)
│       └── __tests__/    # Wrapper equivalence and event propagation tests
├── .kiro/specs/          # Feature specification (requirements, design, tasks)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Prerequisites

- Node.js 18+
- npm 9+

## Getting Started

```bash
# Install dependencies
npm install

# Start the demo with hot-reload
npm run dev

# Run the test suite
npm test

# Run tests in watch mode
npm run test:watch

# Type-check the project
npm run build
```

## Scripts

| Command              | Description                                       |
|----------------------|---------------------------------------------------|
| `npm run dev`        | Start demo page at localhost:3000 with hot-reload |
| `npm test`           | Run all tests once (Vitest)                       |
| `npm run test:watch` | Run tests in watch mode                           |
| `npm run build`      | TypeScript type-check (no emit)                   |

## Demo

The project includes a live demo page with hot-reload for testing the reader interactively.

```bash
npm run dev
```

This opens `http://localhost:3000` in your browser. The demo lets you:

- **Paste a URL** to an EPUB or Markdown file and click "Load"
- **Pick a local file** (`.epub`, `.md`, `.txt`) from your machine
- **Use a built-in sample** with English and Urdu content

Controls for theme, font family, and font size are available at the top. Any changes you make to files under `src/` or `demo/` will hot-reload instantly in the browser.

The demo source lives in `demo/main.tsx` — modify it freely to test different configurations.

## Usage

### React

```tsx
import { Reader } from 'qari/components/Reader';

<Reader
  source={{ type: 'epub', data: epubArrayBuffer }}
  theme="dark"
  fontFamily="serif"
  fontSize={18}
  onPageChange={(e) => console.log(e)}
/>
```

### Vue 3

```vue
<template>
  <EbookReader
    :source="{ type: 'url', url: 'https://example.com/book.epub' }"
    theme="sepia"
    @page-change="handlePageChange"
  />
</template>

<script setup>
import { EbookReader } from 'qari/wrappers/vue/EbookReader';
</script>
```

### Web Component

```html
<script type="module">
  import 'qari/wrappers/web-component/EbookReaderElement';
</script>

<ebook-reader
  theme="light"
  font-size="16"
></ebook-reader>

<script>
  const reader = document.querySelector('ebook-reader');
  reader.source = { type: 'markdown', content: markdownString };
  reader.addEventListener('page-change', (e) => console.log(e.detail));
</script>
```

## Input Formats

| Format   | How to provide                                         |
|----------|-------------------------------------------------------|
| EPUB     | `{ type: 'epub', data: ArrayBuffer }`                 |
| URL      | `{ type: 'url', url: 'https://...' }`                |
| Markdown | `{ type: 'markdown', content: '# Title\n## Ch1...' }`|

## Bookmark Storage

Bookmarks are enabled by default. The reader provides a built-in bookmark panel (accessible via the 🔖 button in the header) that lets users create, rename, navigate to, and delete bookmarks.

### Default — localStorage

With no configuration, bookmarks persist in `localStorage` keyed by the book's identifier:

```tsx
<Reader source={source} />
```

### Disable Bookmarks

```tsx
<Reader source={source} enableBookmarks={false} />
```

### Controlled Bookmarks (via prop)

Pass bookmarks directly as a prop for full external control. The reader renders them but does not persist them — you manage the array:

```tsx
const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

<Reader
  source={source}
  bookmarks={bookmarks}
  onBookmarkChange={(event) => {
    if (event.type === 'created') {
      setBookmarks(prev => [...prev, event.bookmark]);
    } else if (event.type === 'deleted') {
      setBookmarks(prev => prev.filter(b => b.id !== event.bookmark.id));
    } else if (event.type === 'renamed') {
      setBookmarks(prev => prev.map(b => b.id === event.bookmark.id ? event.bookmark : b));
    }
  }}
/>
```

### Custom Store (server-side)

Implement `BookmarkStoreInterface` to persist bookmarks on your own backend:

```tsx
import type { BookmarkStoreInterface } from 'qari/interfaces/bookmark-store';

const myStore: BookmarkStoreInterface = {
  async save(bookmark) { await api.post('/bookmarks', bookmark); },
  async load(bookId) { return api.get(`/bookmarks?bookId=${bookId}`); },
  async list() { return api.get('/bookmarks'); },
  async remove(bookmarkId) { await api.delete(`/bookmarks/${bookmarkId}`); },
  async update(bookmark) { await api.put(`/bookmarks/${bookmark.id}`, bookmark); },
};

<Reader source={source} bookmarkStore={myStore} />
```

### Legacy Adapter (deprecated)

The older `bookmarkAdapter` prop (without `update`) still works as a fallback:

```tsx
<Reader source={source} bookmarkAdapter={adapter} />
```

### Bookmark Data Model

```ts
interface Bookmark {
  id: string;           // UUID
  bookId: string;       // Identifies the book
  chapterId: string;    // Chapter within the book
  position: number;     // Character offset within chapter
  name: string;         // User-provided label, 1-100 chars
  createdAt: string;    // ISO 8601 UTC
  updatedAt?: string;   // ISO 8601 UTC (set on rename)
}
```

## Reading Progress

Track the user's reading position via the `onProgressChange` callback:

```tsx
<Reader
  source={source}
  onProgressChange={(progress) => {
    console.log(`Page ${progress.currentPage}/${progress.totalPages}`);
    console.log(`Chapter ${progress.currentChapter + 1}/${progress.totalChapters}: ${progress.chapterTitle}`);
    console.log(`${progress.percentage}% complete`);
  }}
/>
```

### ReadingProgress Object

```ts
interface ReadingProgress {
  currentPage: number;      // Current page in the chapter (0-indexed)
  totalPages: number;       // Total pages in the current chapter
  currentChapter: number;   // Current chapter index (0-indexed)
  totalChapters: number;    // Total number of chapters
  chapterTitle: string;     // Title of the current chapter
  percentage: number;       // Overall book progress (0-100)
}
```

## Theming and Typography

### Themes

Four built-in themes are available:

```tsx
<Reader source={source} theme="light" />      // White background, dark text
<Reader source={source} theme="dark" />       // Dark background, light text
<Reader source={source} theme="sepia" />      // Warm paper-like tones
<Reader source={source} theme="high-contrast" /> // WCAG AAA compliant
```

The reader also exposes an in-app theme selector that the user can interact with. When the user changes the theme via the UI, the `onSettingsChange` callback fires.

### Typography Controls

```tsx
<Reader
  source={source}
  fontFamily="serif"       // 'serif' | 'sans-serif' | 'monospace' or custom
  fontSize={18}            // px, 12-48
  justify={true}           // text-align: justify
  lineSpacing={1.5}        // line-height multiplier, 1-3
  letterSpacing={0}        // px, 0-5
  wordSpacing={0}          // px, 0-10
  margin={32}              // px, 0-100 (left/right content padding)
  columns={1}              // 1 or 2 column layout
/>
```

### Custom Fonts

Provide custom font options for the in-app font selector:

```tsx
import { Reader, DEFAULT_FONT_OPTIONS } from 'qari/components/Reader';
import type { FontOption } from 'qari/components/Reader';

const myFonts: FontOption[] = [
  ...DEFAULT_FONT_OPTIONS,
  { name: 'Noto Nastaliq', family: '"Noto Nastaliq Urdu", serif' },
  { name: 'Amiri', family: '"Amiri", serif' },
];

<Reader source={source} fontOptions={myFonts} />
```

### Zoom

```tsx
<Reader source={source} zoom={120} />  // 50-300, clamped to 10% increments
```

Pinch-to-zoom is supported on touch devices and snaps to the nearest 10% increment.

### Listening for Settings Changes

When the user adjusts settings via the in-app UI:

```tsx
<Reader
  source={source}
  onSettingsChange={(settings) => {
    // settings: { theme?, fontFamily?, fontSize?, justify?, lineSpacing?, letterSpacing?, wordSpacing?, margin?, columns? }
    saveToUserPreferences(settings);
  }}
/>
```

## Translations (i18n)

The reader supports full UI translation via the `translations` prop. All visible strings — labels, aria-labels, button text, placeholders — can be overridden. English defaults are used for any keys you don't provide.

### Quick Start

```tsx
import { Reader } from 'qari/components/Reader';

<Reader
  source={source}
  translations={{
    loading: 'Chargement…',
    readingSettings: 'Paramètres de lecture',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
    pageIndicator: 'Page {current} sur {total}',
    bookmarks: 'Signets',
    tableOfContents: 'Table des matières',
  }}
/>
```

Only the keys you provide are overridden — all others fall back to the English defaults.

### Type Safety

Import the `TranslationStrings` type for autocomplete and compile-time checking:

```tsx
import { Reader } from 'qari/components/Reader';
import type { TranslationStrings } from 'qari/i18n';

const frenchTranslations: Partial<TranslationStrings> = {
  loading: 'Chargement…',
  readingSettings: 'Paramètres de lecture',
  // ... other keys
};

<Reader source={source} translations={frenchTranslations} />
```

### Interpolated Strings

Some keys include `{placeholder}` tokens that are replaced at runtime:

| Key | Tokens | Example |
|-----|--------|---------|
| `pageIndicator` | `{current}`, `{total}` | `"Seite {current} von {total}"` |
| `dictionaryNotFound` | `{word}` | `"Pas de définition pour « {word} »."` |
| `dictionaryTryIn` | `{language}` | `"Essayer en {language}"` |
| `goToChapter` | `{title}` | `"Aller au chapitre : {title}"` |

Unmatched tokens are left as-is in the output, so you can include `{token}` in your strings even if a value isn't always available.

### Full Translation Keys

```tsx
import { DEFAULT_TRANSLATIONS } from 'qari/i18n';

// See all available keys and their English defaults:
console.log(DEFAULT_TRANSLATIONS);
```

The full set of keys covers: Reader chrome, settings dialog, dictionary popover, bookmark panel, chapter index, and zoom controls. See `src/i18n/types.ts` for the complete interface.

### Using Outside the Reader

The `useTranslations` hook and `interpolate` utility are exported for use in custom components:

```tsx
import { useTranslations, interpolate } from 'qari/i18n';

function MyCustomComponent() {
  const t = useTranslations();
  return <span>{interpolate(t.pageIndicator, { current: 1, total: 42 })}</span>;
}
```

## Text Direction

```tsx
<Reader source={source} direction="auto" />  // default — auto-detect from content
<Reader source={source} direction="rtl" />   // force RTL
<Reader source={source} direction="ltr" />   // force LTR
```

When set to `"auto"`, the reader detects direction by analyzing character frequencies in the book content. EPUB files with `page-progression-direction` metadata are respected. For Urdu content, Nastaliq font and increased line spacing are applied automatically.

## Events and Callbacks

| Callback | Payload | When |
|----------|---------|------|
| `onReady` | `{ book, chapterCount, direction }` | Book successfully loaded and parsed |
| `onPageChange` | `{ chapter, page, progress }` | User navigates to a new page |
| `onProgressChange` | `ReadingProgress` | Page or chapter changes (detailed progress) |
| `onBookmarkCreate` | `{ type, bookmark }` | A bookmark is created |
| `onBookmarkChange` | `{ type, bookmark }` | Any bookmark CRUD operation |
| `onSettingsChange` | `ReaderSettings` | User changes theme/font/layout via UI |
| `onError` | `{ code, message, source?, format?, httpStatus? }` | Load or runtime error |

```tsx
<Reader
  source={source}
  onReady={(e) => console.log(`Loaded: ${e.book.title}, ${e.chapterCount} chapters`)}
  onPageChange={(e) => console.log(`Chapter ${e.chapter}, page ${e.page}, ${e.progress}%`)}
  onError={(e) => showToast(`Error: ${e.message}`)}
/>
```

## Full Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `ReaderSource` | (required) | Book content — EPUB buffer, URL, or Markdown string |
| `theme` | `'light' \| 'dark' \| 'sepia' \| 'high-contrast'` | `'light'` | Color theme |
| `fontFamily` | `string` | `'serif'` | Font family name |
| `fontSize` | `number` | `16` | Font size in pixels |
| `justify` | `boolean` | `true` | Text justification |
| `lineSpacing` | `number` | `1.5` | Line height multiplier |
| `letterSpacing` | `number` | `0` | Letter spacing in pixels (0-5) |
| `wordSpacing` | `number` | `0` | Word spacing in pixels (0-10) |
| `margin` | `number` | `32` | Content margin in pixels (0-100) |
| `columns` | `1 \| 2` | `1` | Number of text columns |
| `zoom` | `number` | `100` | Zoom level (50-300, snaps to 10%) |
| `translations` | `Partial<TranslationStrings>` | English defaults | UI string overrides for i18n |
| `direction` | `'ltr' \| 'rtl' \| 'auto'` | `'auto'` | Text direction override |
| `enableBookmarks` | `boolean` | `true` | Show/hide bookmark panel |
| `bookmarks` | `Bookmark[]` | `undefined` | Controlled bookmarks array |
| `bookmarkStore` | `BookmarkStoreInterface` | localStorage | Custom bookmark persistence |
| `bookmarkAdapter` | `CustomStoreAdapter` | `undefined` | Legacy store adapter |
| `fontOptions` | `FontOption[]` | Serif, Sans, Mono | Custom font selector options |
| `enableBuiltInDictionary` | `boolean` | `false` | Enable online dictionary lookup |
| `hunspellDictionaries` | `HunspellDictionaryConfig[]` | `undefined` | Offline Hunspell dictionaries |
| `dictionaryProviders` | `DictionaryProvider[]` | `undefined` | Custom dictionary providers |
| `onReady` | `(event) => void` | — | Book loaded callback |
| `onPageChange` | `(event) => void` | — | Page navigation callback |
| `onProgressChange` | `(progress) => void` | — | Reading progress callback |
| `onBookmarkCreate` | `(event) => void` | — | Bookmark created callback |
| `onBookmarkChange` | `(event) => void` | — | Bookmark CRUD callback |
| `onSettingsChange` | `(settings) => void` | — | User settings change callback |
| `onError` | `(error) => void` | — | Error callback |

## Dictionary Integration

The reader provides built-in dictionary lookup on right-click (desktop) or long-press (touch). Select a word, right-click on it, and a popover appears with definitions. Three configuration modes are available — from zero-config to fully custom.

### Quick Start — Built-in Online Dictionaries

Enable the built-in Free Dictionary API (English) and Wiktionary (multilingual) with a single prop:

```tsx
import { Reader } from 'qari/components/Reader';

<Reader
  source={{ type: 'epub', data: epubBuffer }}
  enableBuiltInDictionary={true}
/>
```

This gives you English definitions from [dictionaryapi.dev](https://dictionaryapi.dev) and multilingual support (English, French, Spanish, German, Italian, Portuguese, Russian) from Wiktionary. No API keys needed.

### Offline Spell-Check with Hunspell Dictionaries

For offline-first usage, provide Hunspell `.dic`/`.aff` dictionary files. These are checked before any online lookups:

```tsx
import { Reader } from 'qari/components/Reader';

// Option A: Pre-loaded buffers (immediate, no network)
const affBuffer = await fetch('/dictionaries/en.aff').then(r => r.arrayBuffer());
const dicBuffer = await fetch('/dictionaries/en.dic').then(r => r.arrayBuffer());

<Reader
  source={source}
  hunspellDictionaries={[
    { language: 'en', aff: affBuffer, dic: dicBuffer },
  ]}
  enableBuiltInDictionary={true}
/>

// Option B: URLs (fetched and cached on first load)
<Reader
  source={source}
  hunspellDictionaries={[
    {
      language: 'en',
      affUrl: '/dictionaries/en.aff',
      dicUrl: '/dictionaries/en.dic',
    },
    {
      language: 'fr',
      affUrl: '/dictionaries/fr.aff',
      dicUrl: '/dictionaries/fr.dic',
    },
  ]}
  enableBuiltInDictionary={true}
/>
```

When Hunspell detects a misspelled word, the popover shows spelling suggestions. Clicking a suggestion triggers a new lookup for that word.

### Custom Dictionary Providers

Build your own provider by implementing the `DictionaryProvider` interface:

```tsx
import { Reader } from 'qari/components/Reader';
import type { DictionaryProvider, DictionaryResult } from 'qari/interfaces/dictionary';

const myProvider: DictionaryProvider = {
  id: 'my-custom-dict',
  supportedLanguages: ['en', 'ur'],
  category: 'online', // or 'local'

  async lookup(word, language, context, signal?) {
    const res = await fetch(`/api/dict/${language}/${word}`, { signal });
    const data = await res.json();
    return {
      word,
      language,
      definitions: data.definitions.map(d => ({
        meaning: d.meaning,
        partOfSpeech: d.pos,
        examples: d.examples,
      })),
    };
  },
};

<Reader
  source={source}
  dictionaryProviders={[myProvider]}
/>
```

### Provider Priority Order

When multiple provider sources are configured, lookups follow this priority:

1. **Hunspell providers** (local/offline) — checked first, instant response
2. **User-supplied `dictionaryProviders`** — your custom providers
3. **Built-in online providers** — Free Dictionary API + Wiktionary

```tsx
// All three combined — Hunspell checked first, then custom, then built-in
<Reader
  source={source}
  hunspellDictionaries={[{ language: 'en', affUrl: '/en.aff', dicUrl: '/en.dic' }]}
  dictionaryProviders={[myCustomProvider]}
  enableBuiltInDictionary={true}
/>
```

If a local Hunspell provider confirms the word is spelled correctly but has no semantic definition, the reader automatically queries the next online provider and merges the results (showing both the "correctly spelled" indicator and the full definition).

### Disabling Dictionary

When none of the dictionary props are set, dictionary functionality is completely disabled — no event listeners are attached and right-click behaves normally:

```tsx
// No dictionary — default behavior
<Reader source={source} />
```

### Configuration Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableBuiltInDictionary` | `boolean` | `false` | Enable Free Dictionary + Wiktionary providers |
| `hunspellDictionaries` | `HunspellDictionaryConfig[]` | `undefined` | Array of Hunspell dictionary configs for offline spell-check |
| `dictionaryProviders` | `DictionaryProvider[]` | `undefined` | Custom provider implementations |

#### `HunspellDictionaryConfig`

```ts
interface HunspellDictionaryConfig {
  language: string;           // ISO 639-1 code (e.g., 'en', 'fr')
  aff?: ArrayBuffer | Uint8Array;  // Pre-loaded .aff content
  dic?: ArrayBuffer | Uint8Array;  // Pre-loaded .dic content
  affUrl?: string;            // URL to fetch .aff file
  dicUrl?: string;            // URL to fetch .dic file
}
```

Provide either `aff`+`dic` (buffer mode, immediate) or `affUrl`+`dicUrl` (URL mode, async fetch with in-memory caching).

#### `DictionaryProvider` Interface

```ts
interface DictionaryProvider {
  id: string;
  supportedLanguages: string[];
  category?: 'local' | 'online';
  ready?: boolean;
  lookup(word: string, language: string, context: string, signal?: AbortSignal): Promise<DictionaryResult>;
}

interface DictionaryResult {
  word: string;
  language: string;
  definitions: Definition[];
  notFound?: boolean;
  spellCheck?: { correct: boolean; suggestions: string[] };
}

interface Definition {
  meaning: string;
  partOfSpeech?: string;
  examples?: string[];
}
```

### User Interaction

- **Desktop**: Select a word, then right-click on it → popover appears
- **Touch**: Long-press on a word (~500ms) → popover appears
- **Dismiss**: Click outside the popover, press Escape, or click the × button
- **Suggestions**: When a word is misspelled, click a suggestion to look it up

## RTL Support

The reader automatically detects text direction by analyzing content characters. For Urdu content, it defaults to Noto Nastaliq Urdu font with 2.0x line spacing. Override with the `direction` prop (see Text Direction section above). EPUB files with `page-progression-direction` metadata are respected when direction is set to `"auto"`.

## Testing

The project uses **Vitest** with **fast-check** for property-based testing. Key correctness properties validated:

- EPUB and Markdown round-trip preservation (parse → print → parse = original)
- Direction detection threshold accuracy
- Reading preferences persistence round-trip
- Zoom level clamping and pinch-zoom snapping
- Sequential page navigation invariant (next then previous returns to start)
- Bookmark data integrity and adapter delegation
- Wrapper behavioral equivalence across React, Vue, and Web Component

Run the full suite:

```bash
npm test
```

## Tech Stack

- **Language**: TypeScript (strict mode)
- **UI Core**: React 18
- **Wrappers**: Vue 3, Web Components (Custom Elements + Shadow DOM)
- **EPUB Parsing**: JSZip for archive extraction
- **Markdown Parsing**: markdown-it (CommonMark)
- **Testing**: Vitest + fast-check
- **Build**: TypeScript compiler (tsc)

## License

ISC
