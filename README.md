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

By default, bookmarks persist in `localStorage`. To store them on a server, provide a `CustomStoreAdapter`:

```ts
const adapter = {
  async save(bookmark) { /* POST to your API */ },
  async load(bookId) { /* GET bookmarks for book */ },
  async list() { /* GET all bookmarks */ },
  async remove(bookmarkId) { /* DELETE bookmark */ },
};

<Reader source={...} bookmarkAdapter={adapter} />
```

If the adapter fails or times out (5s), the component falls back to local storage and notifies the user.

## Dictionary Integration

Register dictionary providers for language-aware lookups:

```ts
const urduDict = {
  async lookup(word, language, context) {
    // Query your dictionary API
    return { definitions: [...], partOfSpeech: '...', examples: [...] };
  }
};

<Reader source={...} plugins={{ dictionaries: [{ language: 'ur', provider: urduDict }] }} />
```

When a user selects a word, the component shows a popover with definitions, passing surrounding context (up to 200 chars) for disambiguation.

## RTL Support

The reader automatically detects text direction by analyzing content characters. For Urdu content, it defaults to Noto Nastaliq Urdu font with 2.0x line spacing. Users can manually override direction via a UI toggle that persists per-book.

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
