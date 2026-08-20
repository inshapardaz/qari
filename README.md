# Qari — Universal Ebook Reader

A framework-agnostic ebook reading component built with React at its core, exposing wrapper layers for Vue 3 and vanilla Web Components. Supports EPUB files, remote URLs, and Markdown input with full RTL/Urdu Nastaliq support, theming, dictionary integration, and configurable bookmark storage.

**[Live Demo](https://inshapardaz.github.io/qari/)** — try the reader in your browser, no install required. Source: [github.com/inshapardaz/qari](https://github.com/inshapardaz/qari).

## Features

- Read EPUB files, Markdown documents, or fetch content from URLs
- Seven built-in themes: light, dark, calm, quiet, paper, focus, high-contrast (WCAG AAA)
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
| `npm run build:demo` | Build the static demo site (used by GitHub Pages) |

## Demo

A hosted build of this demo is live at **[inshapardaz.github.io/qari](https://inshapardaz.github.io/qari/)** — no setup required. It's redeployed automatically (via [`.github/workflows/deploy-demo.yml`](.github/workflows/deploy-demo.yml)) on every push to `main`.

To run it locally instead, with hot-reload for testing the reader interactively:

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

> **Peer dependencies:** the reader's UI is built with [Mantine](https://mantine.dev) (v8 or v9). Install `@mantine/core` and `@mantine/hooks` alongside `qari`, and import `@mantine/core/styles.css` once in your app's entry point. See [UI Chrome Theming](#ui-chrome-theming-mantine) below for details and how to customize or inherit an existing Mantine setup.

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
    theme="calm"
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
| PDF      | `{ type: 'pdf', data: ArrayBuffer }`                  |

### PDF Support

```tsx
<Reader source={{ type: 'pdf', data: pdfArrayBuffer }} />
```

PDFs are fixed-layout documents, not reflowable text like EPUB/Markdown. Each page is rasterized to an image (via [PDF.js](https://mozilla.github.io/pdf.js/)) and shown as its own page — one page in, one page out, matching the original PDF's real layout exactly. `data` also accepts a `File`.

Trade-offs versus EPUB/Markdown, inherent to rendering pages as images:
- No dictionary word lookup or footnote popovers on PDF content — there's no selectable text, just a raster image.
- Bookmarks and chapter/page navigation work per-page, but bookmark position within a page isn't meaningful (a PDF page is always a single "position").
- `columns={2}` isn't useful for PDFs (each page is already a complete image); it's ignored in practice since each page is its own single-page chapter.

PDF rendering uses a Web Worker (via `pdfjs-dist`, loaded lazily so it doesn't add to your bundle unless you actually load a PDF). By default the worker script loads from a version-pinned jsDelivr CDN URL; override it with `pdfWorkerSrc` if you need to self-host it (offline use, strict CSP):

```tsx
<Reader
  source={{ type: 'pdf', data: pdfArrayBuffer }}
  pdfWorkerSrc="/assets/pdf.worker.min.mjs"
/>
```

Unlike EPUB (which has a real spine/table of contents), a PDF carries no chapter information of its own — without more, every page shows up in the chapter drawer as its own untitled "Page N" entry. Pass `pdfChapters` to map real chapter titles onto page ranges instead:

```tsx
<Reader
  source={{ type: 'pdf', data: pdfArrayBuffer }}
  pdfChapters={[
    { title: 'Foreword', startPage: 1 },
    { title: 'Chapter 1: The Beginning', startPage: 5 },
    { title: 'Chapter 2: The Middle', startPage: 32 },
  ]}
/>
```

Each entry's `title` applies to every page from its `startPage` up to (not including) the next entry's `startPage`; pages before the first entry's `startPage` keep the default "Page N" title. The chapter drawer collapses each run of same-titled pages into a single entry that jumps to the chapter's first page — internally, pagination/bookmarks/progress tracking are unaffected and still work per-page. Use `bookInfo` (see below) alongside this to also set the book's title/author/language, since PDFs don't reliably carry that either.

## Bookmark Storage

Bookmarks are enabled by default. The reader provides a built-in bookmark panel (accessible via the 🔖 button in the header) that lets users create, rename, navigate to, and delete bookmarks. Naming a bookmark is optional — leaving the name field blank auto-names it from the current position (e.g. "Chapter 3, Page 4"); typing a name overrides that.

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
  id: string;           // Sqids-encoded id
  bookId: string;       // Identifies the book
  chapterId: string;    // Chapter within the book
  position: number;     // Character offset within chapter
  name: string;         // User-provided label, 1-100 chars
  createdAt: string;    // ISO 8601 UTC
  updatedAt?: string;   // ISO 8601 UTC (set on rename)
}
```

## Notes

Notes are enabled by default (📝 button in the header). Select text in the reading view and right-click to bring up an "Add note" row of five highlight-color circles (yellow, green, blue, pink, purple) — clicking one creates the note immediately in that color, shown with a persistent highlight in the text. Right-clicking directly on an existing highlight (with or without a fresh selection) adds a "Remove note" option to the same menu. If a dictionary is configured (`enableBuiltInDictionary` or `dictionaryProviders`), "Meaning" appears in that same menu too, rather than the two features fighting over the same right-click. Open the notes panel to navigate to a note, delete it, add/edit its comment (✎ button, next to the color swatches), or change its highlight color after the fact — yellow is the default for notes created without a color choice. Notes storage mirrors bookmark storage: localStorage by default, or a custom adapter.

### Default — localStorage

```tsx
<Reader source={source} />
```

### Disable Notes

```tsx
<Reader source={source} enableNotes={false} />
```

### React to Note Changes

```tsx
<Reader
  source={source}
  onNoteChange={(event) => {
    // event.type: 'created' | 'deleted' | 'updated'
    console.log(event.type, event.note);
  }}
/>
```

### Custom Store (server-side)

Implement `CustomNoteStoreAdapter` to persist notes on your own backend (same shape as `bookmarkAdapter` — a comment edit is just another `save()` with the updated note, so there's no separate update method to implement):

```tsx
import type { CustomNoteStoreAdapter } from 'qari/interfaces/note-store';

const myNoteStore: CustomNoteStoreAdapter = {
  async save(note) { await api.post('/notes', note); }, // also used to persist an edited comment
  async load(bookId) { return api.get(`/notes?bookId=${bookId}`); },
  async list() { return api.get('/notes'); },
  async remove(noteId) { await api.delete(`/notes/${noteId}`); },
};

<Reader source={source} noteAdapter={myNoteStore} />
```

### Note Data Model

```ts
interface Note {
  id: string;           // Sqids-encoded id
  bookId: string;        // Identifies the book
  chapterId: string;     // Chapter within the book
  startOffset: number;   // Character offset within the chapter's rendered text
  endOffset: number;     // Character offset where the highlight ends (exclusive)
  text: string;          // The highlighted excerpt, captured at creation time
  comment?: string;      // Optional user-provided annotation, 0-1000 chars
  color?: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'; // Highlight color; undefined means 'yellow'
  createdAt: string;     // ISO 8601 UTC
  updatedAt?: string;    // ISO 8601 UTC (set when the comment or color is edited)
}
```

`startOffset`/`endOffset` are measured against the chapter's *rendered* text (not the parsed content AST), so the same offsets keep locating the same characters regardless of font size, margin, column count, or scroll vs. paginated mode.

## Search

In-book search is enabled by default — a 🔍 Search tab in the chapter drawer alongside Chapters/Bookmarks/Notes. Type a query to see every match across the whole book, each shown with its chapter title and a snippet of surrounding text; clicking a result jumps to that chapter and page and selects the matched text there. The query and result list stay put if you close the drawer without clicking a result (e.g. to re-read some context) and reopen it — they only clear when you actually change the query. Search isn't available for PDF sources, since rasterized pages have no extractable text (same limitation as notes/dictionary lookup).

```tsx
<Reader source={source} enableSearch={false} />
```

There's no separate search API to call — it's entirely internal to the chapter drawer's Search tab.

## Reading Progress

There are two independent things called "progress" here: a live callback for driving your own UI (e.g. a progress bar), and persistent tracking that resumes the book where the user left off. You can use either, both, or neither.

### Live Progress Callback

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

#### ReadingProgress Object

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

### Persistent Progress Tracking (resume where you left off)

Enabled by default. As the user navigates, the reader silently persists the current chapter and position, and the next time the same book (matched by its metadata identifier) is opened, it resumes there instead of starting from chapter 1. Storage mirrors bookmarks/notes: localStorage by default, or a custom adapter for syncing across devices.

#### Default — localStorage

```tsx
<Reader source={source} />
```

#### Disable Progress Tracking

```tsx
<Reader source={source} enableProgressTracking={false} />
```

#### React to Progress Being Saved

```tsx
<Reader
  source={source}
  onProgressSave={(event) => {
    // event.type is always 'saved'; event.progress is the persisted record
    console.log('Progress saved:', event.progress);
  }}
/>
```

#### Custom Store (server-side)

Implement `CustomProgressStoreAdapter` to sync reading progress to your own backend:

```tsx
import type { CustomProgressStoreAdapter } from 'qari/interfaces/progress-store';

const myProgressStore: CustomProgressStoreAdapter = {
  async save(progress) { await api.put(`/progress/${progress.bookId}`, progress); },
  async load(bookId) { return api.get(`/progress/${bookId}`).catch(() => null); },
  async remove(bookId) { await api.delete(`/progress/${bookId}`); },
};

<Reader source={source} progressAdapter={myProgressStore} />
```

#### ReadingProgressRecord Data Model

```ts
interface ReadingProgressRecord {
  bookId: string;        // Identifies the book
  chapterId: string;     // Chapter within the book
  position: number;      // Character offset within the chapter (like Bookmark.position)
  percentage: number;    // 0-100 overall book progress at the time this was saved
  updatedAt: string;     // ISO 8601 UTC
}
```

If the saved `chapterId` no longer matches any chapter in the book (e.g. the source content changed since the record was saved), the reader falls back to opening at the start of the book rather than erroring.

## Theming and Typography

### Themes

Seven built-in themes are available — light/dark/calm/quiet/paper/focus mirror the Apple Books appearance picker's own six (Books' "Original" is this library's `light`; its "Bold" is a font-weight variant, not a color theme, so it has no equivalent here):

```tsx
<Reader source={source} theme="light" />         // White background, dark text
<Reader source={source} theme="dark" />          // True-black background, off-white text
<Reader source={source} theme="calm" />          // Warm parchment/paper-like tones (formerly named "sepia")
<Reader source={source} theme="quiet" />         // Softer charcoal background, muted light text
<Reader source={source} theme="paper" />         // Cool light gray background, dark text
<Reader source={source} theme="focus" />         // Warm off-white background, dark text
<Reader source={source} theme="high-contrast" /> // WCAG AAA compliant
```

The reader also exposes in-app controls as popovers anchored to their own title-bar buttons, each opening on whichever side of the header that button sits on. Theme (🎨) and layout (an icon that tracks whichever layout is currently active) each get their own button; the settings button (**Aa**) covers font size, typeface, and justification up front, with line height, letter/word spacing, and margin behind a "More settings" toggle. Restore-to-defaults is a small icon button in the settings panel's top bar. Every control applies immediately: there's no Apply/Cancel step, and `onSettingsChange` fires as soon as a control is touched. The `light`/`dark`/`calm`/`quiet`/`paper`/`focus` reading themes are tuned after the reading themes of leading e-reader apps (Apple Books, Kindle); `high-contrast` remains a distinct WCAG AAA accessibility theme (≥7:1 contrast) rather than an aesthetic one.

> **Migrating from before this rename:** the `sepia` theme was renamed to `calm` (same colors) when `quiet`/`paper`/`focus` were added — update any `theme="sepia"` prop to `theme="calm"`. A previously *persisted* `sepia` preference (from the in-app theme popover) migrates to `calm` automatically the next time it's loaded, no action needed there.

The layout picker has three options: a single-column paginated view (turned via the page-edge hover arrows or arrow keys), also capped at a comfortable reading width and centered; a two-column paginated view, which spans the full available width; and a third **scroll** view (`scroll={true}`) that renders the current chapter as one continuously scrollable flow, likewise capped and centered. There are no pages in scroll mode, so the page counter doesn't apply and the page-edge hover arrows become chapter navigation instead — "Next"/"Previous" move to the next/previous chapter (resetting scroll position to the top) rather than turning a page.

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
  columns={1}              // 1 or 2 column layout (ignored when scroll is true)
  scroll={false}           // true for continuous vertical scroll instead of paginated columns
/>
```

### Custom Fonts

`DEFAULT_FONT_OPTIONS` ships with three generic system fonts (Serif, Sans, Mono) plus the full Urdu/Arabic script collection from [inshapardaz/urdu-web-fonts](https://github.com/inshapardaz/urdu-web-fonts) — Amiri, Lateef, Scheherazade New, Noto Nastaliq Urdu, Jameel Noori Nastaleeq, and 20+ others. The reader loads that collection's CSS live from jsDelivr's GitHub CDN (no npm dependency, no bundled font files); each `@font-face` rule is registered up front but the actual font file is only downloaded by the browser once a font is selected.

To override the selector entirely, or add your own fonts on top:

```tsx
import { Reader, DEFAULT_FONT_OPTIONS } from 'qari/components/Reader';
import type { FontOption } from 'qari/components/Reader';

const myFonts: FontOption[] = [
  ...DEFAULT_FONT_OPTIONS,
  { name: 'My Custom Font', family: '"My Custom Font", serif' },
];

<Reader source={source} fontOptions={myFonts} />
```

### Zoom

```tsx
<Reader source={source} zoom={120} />  // 50-300, clamped to 10% increments
```

## UI Chrome Theming (Mantine)

The reader's interactive chrome — header buttons, the chapter menu, the bookmarks popover, the settings dialog, sliders, switches, and selects — is built with [Mantine](https://mantine.dev). This is separate from the reading-content theming above (`theme`, `fontFamily`, etc.), which controls the *book's* appearance, not the surrounding controls.

### Setup

`@mantine/core` and `@mantine/hooks` are peer dependencies — install them alongside `qari`. Both Mantine 8 and Mantine 9 are supported:

```bash
npm install qari @mantine/core @mantine/hooks
```

The reader renders its own internal `MantineProvider`, so its UI chrome doesn't clash with a different Mantine major your app might already use elsewhere — you don't need to match versions with the rest of your app, only satisfy Mantine's own peer requirements for whichever major you install (Mantine 9 requires React 19.2+; Mantine 8 supports React 18.3+ and 19).

Import Mantine's base stylesheet **once**, anywhere in your app's entry point:

```tsx
import '@mantine/core/styles.css';
```

If your app already uses Mantine, you've already done this — nothing else is required. Qari does not import this CSS itself, since a component library forcing a global CSS side-effect import breaks under plain Node ESM and gives you no control over load order; see the note in [`src/services/urdu-web-fonts.ts`](src/services/urdu-web-fonts.ts) for the same reasoning applied to font CSS.

### Default styling

Out of the box, the reader ships a small default theme (a blue primary color and a small border radius) so it looks reasonable with zero configuration. You do **not** need to wrap `<Reader>` in your own `<MantineProvider>` — it renders one internally.

### Customizing the theme

Pass a `mantineTheme` prop with any [`MantineThemeOverride`](https://mantine.dev/theming/theme-object/) to change colors, radius, fonts, spacing, or per-component default props:

```tsx
import { Reader } from 'qari/components/Reader';

<Reader
  source={source}
  mantineTheme={{
    primaryColor: 'grape',
    defaultRadius: 'md',
  }}
/>
```

This is deep-merged with the reader's built-in default theme, so you only need to specify what you want to change.

### Inheriting your app's Mantine theme

If your app already renders its own `<MantineProvider>` (i.e. you already use Mantine elsewhere), the Reader's internal provider is a *nested* Mantine provider — Mantine merges nested provider themes automatically, so the reader's chrome inherits your app's colors, fonts, and component defaults with no extra configuration:

```tsx
import { MantineProvider } from '@mantine/core';
import { Reader } from 'qari/components/Reader';
import '@mantine/core/styles.css';

function App() {
  return (
    <MantineProvider theme={{ primaryColor: 'violet' }}>
      {/* Your app's own Mantine-based UI */}
      <Reader source={source} />
    </MantineProvider>
  );
}
```

The reader's own `mantineTheme` prop, if provided, is layered on top of whatever it inherits — use it for reader-specific overrides without affecting the rest of your app, or omit it entirely to match your app's look exactly.

The reader also scopes its Mantine CSS variables to its own root element (rather than `:root`), so its theme never leaks into the rest of your page, and multiple `<Reader>` instances with different `mantineTheme` props on the same page stay independent.

### Chrome colorScheme follows the reader theme, not your app's

Theme *tokens* (colors, radius, fonts) inherit from an ancestor `MantineProvider` as described above, but light/dark **colorScheme** is deliberately not inherited. The reader forces its chrome's colorScheme from its own `theme` prop (`light`/`calm`/`paper`/`focus` → Mantine `light`; `dark`/`quiet`/`high-contrast` → Mantine `dark`), scoped to its own root element — so switching your app's own dark-mode toggle won't flip the reader's buttons and menus out of sync with the reading theme the user picked inside the reader, and the reader won't overwrite your app's own colorScheme in the other direction either.

Mantine's own "primary" color (`--mantine-primary-color-*` — the fill Switch/Slider/Select and similar controls use unless they're given an explicit `color` prop) is likewise re-pointed at the active reading theme's own accent color rather than `mantineTheme.primaryColor`, so a Switch or Slider inside the reader always matches whichever of the seven built-in themes is currently selected instead of showing a fixed color that clashes with it.

The browser's own native text-selection highlight follows the reading theme too — selecting book content (or any text inside the reader) uses the active theme's accent color instead of the browser's default blue, since none of the CSS custom property overrides above touch the `::selection` pseudo-element on their own.

Pinch-to-zoom is supported on touch devices and snaps to the nearest 10% increment.

### Listening for Settings Changes

When the user adjusts settings via the in-app UI:

```tsx
<Reader
  source={source}
  onSettingsChange={(settings) => {
    // settings: { theme?, fontFamily?, fontSize?, justify?, lineSpacing?, letterSpacing?, wordSpacing?, margin?, columns?, scroll? }
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

The full set of keys covers: Reader chrome, settings dialog, dictionary popover, bookmark panel, chapter index, zoom controls, and font selector display names (`fontNames`). See `src/i18n/types.ts` for the complete interface.

### Built-in Locales

Complete translations ship for English, Urdu, and French as separate files under `src/i18n/locales`:

```tsx
import { Reader } from 'qari/components/Reader';
import { LOCALES } from 'qari/i18n';

<Reader source={source} translations={LOCALES.ur} />
```

```tsx
import { en, ur, fr } from 'qari/i18n';
```

Each locale is a complete `TranslationStrings` object, including a `fontNames` map that gives every built-in `FontOption` (Serif/Sans/Mono plus the full [urdu-web-fonts](https://github.com/inshapardaz/urdu-web-fonts) collection) a localized display label in the font selector — e.g. Urdu renders "Serif" as "سیرف" and typeface names like "Jameel Noori Nastaleeq" in Urdu script. `fontNames` is deep-merged with the defaults, so a partial `translations` override only needs to include the font names it wants to change:

```tsx
<Reader source={source} translations={{ fontNames: { Serif: 'My Serif Label' } }} />
```

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
| `onProgressSave` | `{ type: 'saved', progress }` | The reading position is persisted (see `enableProgressTracking`) |
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
| `bookInfo` | `Partial<BookMetadata>` | `undefined` | Book info (title, author, publisher, cover, etc.) overrides, merged over — and taking priority over — whatever was parsed from `source` |
| `theme` | `'light' \| 'dark' \| 'calm' \| 'quiet' \| 'paper' \| 'focus' \| 'high-contrast'` | `'light'` | Color theme |
| `fontFamily` | `string` | `'serif'` | Font family name |
| `fontSize` | `number` | `16` | Font size in pixels |
| `justify` | `boolean` | `true` | Text justification |
| `lineSpacing` | `number` | `1.5` | Line height multiplier |
| `letterSpacing` | `number` | `0` | Letter spacing in pixels (0-5) |
| `wordSpacing` | `number` | `0` | Word spacing in pixels (0-10) |
| `margin` | `number` | `32` | Content margin in pixels (0-100) |
| `columns` | `1 \| 2` | `1` | Number of text columns (ignored when `scroll` is true) |
| `scroll` | `boolean` | `false` | Continuous vertical scroll within the chapter instead of paginated columns |
| `pdfWorkerSrc` | `string` | jsDelivr CDN URL | Override the PDF.js worker script URL (only relevant for `{ type: 'pdf' }` sources) |
| `pdfChapters` | `PdfChapterMapEntry[]` | `undefined` | Chapter/page map for PDFs — `{ title, startPage }[]` — since a PDF has no table of contents of its own (only relevant for `{ type: 'pdf' }` sources; see PDF Support above) |
| `zoom` | `number` | `100` | Zoom level (50-300, snaps to 10%) |
| `translations` | `Partial<TranslationStrings>` | English defaults | UI string overrides for i18n |
| `direction` | `'ltr' \| 'rtl' \| 'auto'` | `'auto'` | Text direction override |
| `enableBookmarks` | `boolean` | `true` | Show/hide bookmark panel |
| `enableSearch` | `boolean` | `true` | Show/hide the chapter drawer's in-book Search tab (not available for PDF sources) |
| `showCloseButton` | `boolean` | `false` | Show a close button in the header |
| `bookmarks` | `Bookmark[]` | `undefined` | Controlled bookmarks array |
| `bookmarkStore` | `BookmarkStoreInterface` | localStorage | Custom bookmark persistence |
| `bookmarkAdapter` | `CustomStoreAdapter` | `undefined` | Legacy store adapter |
| `enableProgressTracking` | `boolean` | `true` | Persist and resume reading position across sessions |
| `progressAdapter` | `CustomProgressStoreAdapter` | localStorage | Custom reading-progress persistence |
| `fontOptions` | `FontOption[]` | Serif, Sans, Mono + urdu-web-fonts | Custom font selector options |
| `mantineTheme` | `MantineThemeOverride` | `undefined` | Overrides for the UI chrome's Mantine theme (deep-merged with defaults) |
| `enableBuiltInDictionary` | `boolean` | `false` | Enable online dictionary lookup |
| `hunspellDictionaries` | `HunspellDictionaryConfig[]` | `undefined` | Offline Hunspell dictionaries |
| `dictionaryProviders` | `DictionaryProvider[]` | `undefined` | Custom dictionary providers |
| `onReady` | `(event) => void` | — | Book loaded callback |
| `onPageChange` | `(event) => void` | — | Page navigation callback |
| `onProgressChange` | `(progress) => void` | — | Reading progress callback |
| `onProgressSave` | `(event) => void` | — | Reading position persisted callback |
| `onBookmarkCreate` | `(event) => void` | — | Bookmark created callback |
| `onBookmarkChange` | `(event) => void` | — | Bookmark CRUD callback |
| `onSettingsChange` | `(settings) => void` | — | User settings change callback |
| `onError` | `(error) => void` | — | Error callback |
| `onClose` | `() => void` | — | Close button callback (see `showCloseButton`) |

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
