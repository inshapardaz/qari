# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`qari` (`@inshapardaz/qari`) is a framework-agnostic ebook reader component. The core is a single large React component (`src/components/Reader.tsx`), with thin wrapper layers exposing it to Vue 3 and as a vanilla Web Component. It reads EPUB, PDF, Markdown, and remote-URL sources, with theming, RTL/Urdu Nastaliq support, dictionary lookup, bookmarks, notes, and reading-progress tracking.

Full prop/API reference, feature docs, and usage examples for all three framework surfaces live in `README.md` — read it for anything user-facing (props, callbacks, storage adapters, i18n keys, dictionary provider setup, etc.) rather than re-deriving it from source. This file only covers what the README doesn't: commands and internal architecture.

## Commands

```bash
npm run dev          # Start the demo app (Vite) at localhost:3000 with hot-reload
npm test              # Run the full Vitest suite once
npm run test:watch    # Vitest in watch mode
npm run build          # Emit dist/ (tsc -p tsconfig.build.json + fix ESM extensions)
npm run typecheck      # tsc --noEmit against tsconfig.json (includes tests)
```

Run a single test file or test name:

```bash
npx vitest run src/components/Reader.test.tsx
npx vitest run -t "renders the first PDF page"
npx vitest src/parsers/epub-parser.test.ts   # watch mode for one file
```

Demo source is `demo/main.tsx` — edit it freely to exercise different Reader configurations; it hot-reloads.

There is no separate lint script; `npm run typecheck` (strict TS) is the correctness gate. CI (`.github/workflows/publish.yml`) runs typecheck → build → test on every push/PR. **Every push to `main` auto-bumps the patch version and publishes to npm** (`npm version patch` + `npm publish`) once CI passes — there is no manual release step, so be deliberate about what lands on `main`.

## Architecture

### Parse once, render one way

Every input format (EPUB, Markdown, URL-fetched content) is normalized by its parser into one shared `Book` model (`src/models/book.ts`): `Book.chapters[].content[]`, a `ContentNode` union (`paragraph`, `heading`, `image`, `code-block`, `list`, `opaque`, `pdf-page`) built from `InlineNode`s (`text`, `bold`, `italic`, `link`, `code`, `inline-image`, `footnote-ref`). `Reader.tsx` only ever renders this AST via `ContentNodeRenderer` — it has no format-specific rendering logic. Parsers live in `src/parsers/` (`epub-parser.ts`, `markdown-parser.ts`, `pdf-parser.ts`, `url-loader.ts`); EPUB and Markdown also have printers (`epub-printer.ts`, `markdown-printer.ts`) that serialize a `Book` back to the original format, tested via round-trip property tests.

PDF is the odd one out: it isn't reflowable text, so each page is rasterized to an image at parse time (`pdf-parser.ts`, via `pdfjs-dist` in a Web Worker) and becomes its own single-page chapter (`makeChapter` — `PdfPageNode`, `pending: true` until rendered). Only an initial batch of pages renders eagerly; the rest render progressively in the background (`renderRemainingInBackground`), with `requestPage`/`onPageRendered` letting the reader jump the queue for a page the user navigates to early. Because PDF chapters are one-page-each, the page-display strategy (`columns`/`scroll` props) is reinterpreted specially for PDFs in `Reader.tsx` (stacking pages vertically in scroll mode, showing two-page spreads in two-column mode) rather than using the CSS-column pagination trick described below.

### Pagination model (non-PDF, non-scroll)

Text content isn't sliced into pages by node count. Instead, the current chapter's full content is rendered into a CSS multi-column container (`column-width` = viewport width, `column-fill: auto`), and the "page" count is however many columns the browser's layout engine produces. Turning a page is a CSS `transform: translateX(...)` by one `pagePitch` (container width, corrected for the column gap and margin — see the comment above `pagePitch` in `Reader.tsx`), not a re-render. Page/chapter counts are (re)computed by rendering chapter HTML into an offscreen hidden measurer element (`measureRef`) and reading `scrollWidth`. Scroll mode (`scroll={true}`) bypasses all of this — it's a plain vertically-scrollable flow with no column pagination.

### Service interfaces + swappable persistence

`src/interfaces/` defines the contracts the Reader depends on; `src/services/` provides the default implementations:

- `Parser`/`PrettyPrinter` — see above.
- `BookmarkStoreInterface` / `CustomStoreAdapter`, the equivalent `note-store.ts` pair for notes, and `progress-store.ts` for reading-progress — three independent storage abstractions (`BookmarkStore`/`NoteStore`/`ProgressStore` orchestration classes over `LocalStorageStore`/`LocalStorageNoteStore`/`LocalStorageProgressStore` by default, or a consumer-supplied adapter/store for server-side persistence). These are intentionally not shared code even though they're structurally similar — see their file-level comments if extending one; changes to one should not be assumed to apply to the others. `ProgressStore` differs in one respect: it's a single upserted record per book (no `list()`, no per-book index) rather than a collection, since there's nothing to enumerate.
- `ThemeEngine` (`theme-engine.ts`) — applies the seven built-in reading themes (light/dark/calm/quiet/paper/focus/high-contrast — calm/quiet/paper/focus mirror the Apple Books appearance picker; calm was named "sepia" before that alignment) as CSS custom properties (`--reader-bg`, `--reader-fg`, `--reader-secondary`, etc.) on the reader root. This is independent of Mantine's own light/dark colorScheme (the UI chrome's theme, not the book content's) — the Reader forces Mantine's `colorScheme` from the reading `theme` prop and scopes it (`forceColorScheme` + `getRootElement`) to its own root so it neither inherits nor clobbers a host app's own Mantine setup.
- `DirectionDetector` (`direction-detector.ts`) — analyzes character frequencies to auto-detect LTR/RTL when `direction="auto"`.
- `DictionaryService` + provider interface (`dictionary.ts`) — orchestrates local (e.g. StarDict) → user-supplied → built-in online providers in that priority order. Every local provider matching the book's language is queried and their definitions merged (so multiple dictionaries configured for one language all contribute), not just the first; a misspelling reported by any of them short-circuits the rest. See README's Dictionary Integration section for the provider contract.
- `ChapterNavigator` — chapter-list traversal/lookup helper used by the chapter menu.

### Notes and bookmarks are position-anchored, not node-anchored

Both `Bookmark.position` and `Note.startOffset`/`endOffset` are character offsets into the chapter's **rendered DOM text**, not the parsed content AST. This is deliberate: it keeps the same offset pointing at the same characters regardless of font size, margin, column count, or scroll-vs-paginated mode, none of which change the actual text content. Note highlighting (`src/utils/text-highlight.ts`) walks the rendered DOM with `TreeWalker` to re-derive text-node ranges from these offsets and wrap them in `<mark>` — it clears and reapplies all highlights from scratch on every relevant change rather than incrementally patching, to avoid mutation-order edge cases.

`ReadingProgressRecord.position` follows the same convention, but via a cheaper heuristic rather than real DOM measurement: it's `page * DEFAULT_CHARS_PER_PAGE` (a fixed 1500 chars/page constant, matching `BookmarkPanel`'s own `DEFAULT_CHARS_PER_PAGE` and `ChapterNavigator`'s default `charsPerPage` — deliberately kept in sync by convention across all three, not by import), inverted back to a page via `Math.floor(position / 1500)` on resume. This lets `loadBook` resolve where to open a book synchronously at load time, before any real column-pagination measurement (`recalcPages`, see below) has had a chance to run.

### The unified selection context menu

Right-clicking a text selection can offer up to three actions in one Mantine `Menu`: "Add note" (if `enableNotes`), "Remove note" (if right-clicking an existing highlight), and "Meaning" (dictionary lookup, if configured) — these used to be two competing right-click handlers and were merged so they no longer fight over the same gesture (see `handleContentContextMenu` in `Reader.tsx` and `disableContextMenu`/`triggerFromCurrentSelection` on `useSelectionHandler`).

The reader root has a deliberate `transform: translate(0, 0)` (documented inline) so Mantine's portaled `position: fixed` overlays anchor to the reader's own box instead of the whole browser window — this makes the reader root the CSS containing block for those overlays, so any new code positioning something at raw `clientX`/`clientY` must subtract the root's own `getBoundingClientRect()` offset first (see `handleFootnoteClick`/`handleLinkClick`/the note context menu for the existing pattern).

### Wrappers are thin adapters, not reimplementations

`src/wrappers/vue/EbookReader.ts` and `src/wrappers/web-component/EbookReaderElement.ts` both mount the same React `Reader` component (`react-dom/client` `createRoot`) and translate their host framework's idioms (Vue props/emits; HTML attributes/properties + `CustomEvent`s, inside Shadow DOM) to `ReaderProps`/callback props. Cross-wrapper behavioral parity is enforced by property-based tests in `src/wrappers/__tests__/` (`wrapper-equivalence.property.test.ts`, `wrapper-events.property.test.ts`) — if you change `Reader`'s props or events, check whether the wrappers' attribute/property lists and validation need the same update.

### i18n

`src/i18n/types.ts` defines the full `TranslationStrings` interface; `src/i18n/locales/{en,fr,ur}.ts` are complete translations (including a `fontNames` map for the font selector). The `translations` prop is a `Partial<TranslationStrings>`, deep-merged over the English defaults via `useTranslations()`/`TranslationContext`. Adding a new user-visible string means adding it to `types.ts` **and** all three locale files, not just `en.ts`.

## Testing conventions

Vitest + `fast-check` (property-based testing), jsdom environment, config in `vitest.config.ts` (`src/test-setup.ts` sets up jsdom polyfills: `matchMedia`, `ResizeObserver`, `scrollIntoView`, `localStorage` — add new browser-API polyfills there following the existing pattern, e.g. `IntersectionObserver`). Tests sit next to the code they cover (`Foo.ts` → `Foo.test.ts`) or in a local `__tests__/` folder for property tests (`*.property.test.ts`).

Property tests validate invariants like: EPUB/Markdown round-trip (parse → print → parse = original), direction-detection thresholds, zoom clamping/pinch-snap, sequential page navigation (next then previous returns to start), bookmark/note data integrity and adapter delegation, and wrapper behavioral equivalence.

Known environmental flakiness (not a code regression signal): `footnote-ref-rendering.property.test.ts` and `bookmarks-prop-control.property.test.ts` occasionally time out or report "No test suite found" under full-suite/parallel load — re-run the file in isolation (`npx vitest run <file>`) to confirm before treating a failure there as real.

Two jsdom/testing-library gotchas worth knowing before writing selection-related tests: `Selection.addRange()` clones the `Range` internally, so per-instance stubs (`range.getBoundingClientRect = ...`) don't survive — stub on `Range.prototype` instead (and delete it in `afterEach`, since jsdom's `Range.prototype` has no such method by default, so `vi.spyOn` can't be used — assign directly).
