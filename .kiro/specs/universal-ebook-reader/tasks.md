# Implementation Plan: Universal Ebook Reader

## Overview

Build a framework-agnostic ebook reading component using React as the core, with wrapper layers for Vue 3 and Web Components. Implementation proceeds bottom-up: data models → parsers → services → React UI → wrapper layers → integration. TypeScript throughout, tested with Vitest and fast-check.

## Tasks

- [ ] 1. Set up project structure, data models, and core interfaces
  - [ ] 1.1 Initialize project with TypeScript, React, Vitest, and fast-check
    - Create package.json with dependencies: react, react-dom, vitest, fast-check, jsdom
    - Configure tsconfig.json with strict mode
    - Set up vitest.config.ts with jsdom environment
    - Create directory structure: src/models, src/parsers, src/services, src/components, src/wrappers
    - _Requirements: 1.1_

  - [ ] 1.2 Define core data model interfaces and types
    - Create src/models/book.ts with Book, BookMetadata, Chapter, ContentNode, InlineNode types
    - Create src/models/bookmark.ts with Bookmark interface
    - Create src/models/reader-state.ts with ReaderState interface
    - Create src/models/events.ts with PageChangeEvent, BookmarkEvent, BookLoadedEvent, ReaderError
    - All types as defined in the design document
    - _Requirements: 9.1, 2.6, 2.7_

  - [ ] 1.3 Define service interfaces
    - Create src/interfaces/parser.ts with EPUBParser, MarkdownParser, PrettyPrinter interfaces
    - Create src/interfaces/dictionary.ts with DictionaryProvider, DictionaryResult, Definition interfaces
    - Create src/interfaces/store-adapter.ts with CustomStoreAdapter interface (save, load, list, remove)
    - Create src/interfaces/theme-engine.ts with ThemeEngine, ThemeName, FontFamily, ReadingPreferences, ThemeColors
    - Create src/interfaces/direction-detector.ts with DirectionDetector, DirectionResult interfaces
    - _Requirements: 7.2, 8.4, 3.1, 6.1_

- [ ] 2. Implement Markdown Parser and Pretty Printer
  - [ ] 2.1 Implement the Markdown parser
    - Create src/parsers/markdown-parser.ts
    - Parse CommonMark-compliant Markdown into Book representation
    - Map H1 to book title, H2 headings to chapter boundaries
    - Map paragraphs, inline formatting (bold, italic, code, links), images, code blocks, lists to ContentNode types
    - Handle edge case: no H2 headings → single chapter, title from H1 or filename
    - _Requirements: 10.1, 10.4, 2.3_

  - [ ] 2.2 Implement the Markdown Pretty Printer
    - Create src/parsers/markdown-printer.ts
    - Serialize Book representation back to CommonMark Markdown
    - Output book title as H1, each chapter as H2 with content nodes rendered in Markdown syntax
    - Handle all ContentNode types: paragraphs, headings, images, code blocks, lists, inline formatting
    - _Requirements: 10.2_

  - [ ]* 2.3 Write property test for Markdown round-trip preservation
    - **Property 2: Markdown Round-Trip Preservation**
    - Create src/parsers/__tests__/markdown-roundtrip.property.test.ts
    - Generate random Book instances limited to Markdown-expressible content nodes
    - Assert: parse(print(book)) produces structurally equal Book
    - Minimum 100 iterations
    - **Validates: Requirements 2.7, 10.1, 10.2, 10.3**

  - [ ]* 2.4 Write unit tests for Markdown parser edge cases
    - Test no-H2 input → single chapter
    - Test H1-only input → title extraction from H1
    - Test complex nested lists
    - Test inline formatting combinations
    - Test code blocks with language annotations
    - _Requirements: 10.4, 10.1_

- [ ] 3. Implement EPUB Parser and Pretty Printer
  - [ ] 3.1 Implement the EPUB parser
    - Create src/parsers/epub-parser.ts
    - Parse EPUB files (ArrayBuffer) into Book representation
    - Extract metadata: title, author, language, publisher, publication date from package document
    - Extract chapters ordered by spine sequence
    - Map XHTML content to ContentNode types (paragraphs, headings, images, code blocks, lists)
    - Preserve unsupported elements (audio, video, scripts) as OpaqueNode
    - Return structured error for malformed EPUB without producing partial Book
    - _Requirements: 9.1, 9.4, 9.5, 2.1_

  - [ ] 3.2 Implement the EPUB Pretty Printer
    - Create src/parsers/epub-printer.ts
    - Serialize Book to EPUB 3.0-conformant structure
    - Generate container.xml, package document (OPF), and XHTML content documents
    - Preserve OpaqueNode content verbatim in output
    - Produce valid ArrayBuffer output
    - _Requirements: 9.2_

  - [ ]* 3.3 Write property test for EPUB round-trip preservation
    - **Property 1: EPUB Round-Trip Preservation**
    - Create src/parsers/__tests__/epub-roundtrip.property.test.ts
    - Generate random Book instances with varied metadata, chapters, and content node combinations including OpaqueNodes
    - Assert: parse(print(book)) produces structurally equal Book (whitespace normalization permitted)
    - Minimum 100 iterations
    - **Validates: Requirements 2.6, 9.3, 9.5**

  - [ ]* 3.4 Write property test for malformed input error completeness
    - **Property 14: Malformed Input Error Completeness**
    - Create src/parsers/__tests__/malformed-input.property.test.ts
    - Generate random byte sequences and invalid inputs
    - Assert: error contains source name, detected format (if determinable), and failure reason
    - Assert: no partial Book is produced
    - **Validates: Requirements 2.4, 9.4**

- [ ] 4. Checkpoint - Parsers complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement URL Loader
  - [ ] 5.1 Implement the URL loader with timeout and content type detection
    - Create src/parsers/url-loader.ts
    - Fetch resource with 30-second timeout using AbortController
    - Detect content type from response headers to choose EPUB or Markdown parser
    - Return structured error with HTTP status or network error description on failure
    - _Requirements: 2.2, 2.5_

  - [ ]* 5.2 Write unit tests for URL loader
    - Test successful EPUB fetch and delegation
    - Test successful Markdown fetch and delegation
    - Test 30-second timeout behavior
    - Test network error handling with error description
    - Test HTTP error status codes
    - Use mocked fetch
    - _Requirements: 2.2, 2.5_

- [ ] 6. Implement Direction Detector
  - [ ] 6.1 Implement the direction detector
    - Create src/services/direction-detector.ts
    - Analyze first 1000 characters of text content
    - Count RTL Unicode characters (Arabic, Hebrew, Urdu script ranges)
    - Classify: >40% RTL → RTL direction with high confidence
    - Classify: <30% RTL → LTR direction with high confidence
    - Classify: 30-50% RTL → low confidence (triggers user prompt)
    - Detect specific scripts (Arabic, Hebrew, Urdu) for language-specific defaults
    - _Requirements: 6.1, 6.9_

  - [ ]* 6.2 Write property test for direction detection threshold
    - **Property 3: Direction Detection Threshold**
    - Create src/services/__tests__/direction-detector.property.test.ts
    - Generate text strings with controlled RTL character percentages (0-100%)
    - Assert classification matches threshold rules
    - Assert Urdu detection triggers Nastaliq font default with line spacing ≥ 2.0
    - Minimum 100 iterations
    - **Validates: Requirements 6.1, 6.7, 6.9**

- [ ] 7. Implement Theme Engine
  - [ ] 7.1 Implement the theme engine with persistence
    - Create src/services/theme-engine.ts
    - Define four themes: light, dark, sepia, high-contrast (WCAG AAA ≥ 7:1 contrast ratio)
    - Support font families: serif, sans-serif, monospace, nastaliq
    - Support font sizes: 12-48px in 2px increments
    - Apply themes via CSS custom properties on reader root element
    - Persist preferences to localStorage; load on initialization
    - Default: light theme, serif font, 16px font size
    - Handle localStorage unavailability gracefully (in-session only + notification)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 7.2 Write property test for reading preferences round-trip
    - **Property 4: Reading Preferences Round-Trip**
    - Create src/services/__tests__/theme-engine.property.test.ts
    - Generate random valid preference combinations (theme × font × size)
    - Assert: persist then load produces identical preferences
    - Minimum 100 iterations
    - **Validates: Requirements 3.6**

  - [ ]* 7.3 Write unit tests for theme engine
    - Test high-contrast theme meets WCAG AAA (7:1 ratio)
    - Test default values applied when no persisted preferences
    - Test localStorage write failure handling
    - Test theme application within 100ms
    - _Requirements: 3.1, 3.7, 3.8, 3.2_

- [ ] 8. Implement Bookmark Store
  - [ ] 8.1 Implement the bookmark store with adapter pattern
    - Create src/services/bookmark-store.ts
    - Default to localStorage persistence
    - Support CustomStoreAdapter injection for server-side persistence
    - Implement CRUD operations: create, rename, delete, list, load by bookId
    - Validate bookmark name: 1-100 characters; reject empty or too-long names
    - Enforce 50 bookmarks per book limit
    - Implement 5-second timeout for custom adapter operations
    - Fall back to localStorage on adapter timeout/rejection with notification
    - Generate UUID for bookmark IDs, set UTC timestamps
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [ ]* 8.2 Write property test for bookmark data integrity
    - **Property 11: Bookmark Data Integrity**
    - Create src/services/__tests__/bookmark-integrity.property.test.ts
    - Generate valid bookmark inputs (names 1-100 chars)
    - Assert: created bookmark has non-empty bookId, correct chapterId, correct position, provided name, valid UTC timestamp
    - Generate invalid names (empty, >100 chars) and assert rejection
    - Minimum 100 iterations
    - **Validates: Requirements 8.1, 8.8**

  - [ ]* 8.3 Write property test for custom adapter delegation
    - **Property 12: Custom Adapter Delegation**
    - Create src/services/__tests__/bookmark-delegation.property.test.ts
    - Generate sequences of bookmark operations with mock adapter
    - Assert: ALL operations delegated to adapter, NONE touch localStorage
    - Minimum 100 iterations
    - **Validates: Requirements 8.3**

  - [ ]* 8.4 Write property test for adapter timeout fallback
    - **Property 13: Adapter Timeout Fallback**
    - Create src/services/__tests__/bookmark-fallback.property.test.ts
    - Generate timeout/rejection scenarios for custom adapter
    - Assert: operation still completes successfully via localStorage fallback
    - Minimum 100 iterations
    - **Validates: Requirements 8.6**

- [ ] 9. Implement Dictionary Service
  - [ ] 9.1 Implement the dictionary service with plugin interface
    - Create src/services/dictionary-service.ts
    - Support registering multiple DictionaryProvider instances
    - Route lookup to provider matching book language
    - Extract context: up to 200 characters before and after selected word
    - Return DictionaryResult with definitions, part of speech, examples
    - Handle lookup failures: show "not found" message
    - Handle missing provider for language: show "no dictionary" message with fallback offer
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 9.2 Write property test for dictionary context extraction
    - **Property 10: Dictionary Context Extraction**
    - Create src/services/__tests__/dictionary-context.property.test.ts
    - Generate text bodies and word positions
    - Assert: context contains up to 200 chars before and after, bounded by text boundaries
    - Assert: no out-of-bounds access
    - Minimum 100 iterations
    - **Validates: Requirements 7.6**

- [ ] 10. Implement Chapter Navigator
  - [ ] 10.1 Implement chapter navigation and reading progress
    - Create src/services/chapter-navigator.ts
    - Extract Chapter_Index from Book (list chapters by title in document order)
    - Handle books with no identifiable chapter structure (single chapter, hide TOC)
    - Calculate reading progress: round(chars_read / total_chars × 100) as integer 0-100
    - Implement next/previous page navigation within and across chapters
    - Navigate to chapter by selection within 200ms
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 10.2 Write property test for sequential page navigation invariant
    - **Property 8: Sequential Page Navigation Invariant**
    - Create src/services/__tests__/navigation-invariant.property.test.ts
    - Generate book structures and position states
    - Assert: (next, previous) from non-boundary page returns to original
    - Assert: chapter boundary transitions work correctly
    - Minimum 100 iterations
    - **Validates: Requirements 5.4, 5.5, 5.6**

  - [ ]* 10.3 Write property test for reading progress calculation
    - **Property 9: Reading Progress Calculation**
    - Create src/services/__tests__/progress-calculation.property.test.ts
    - Generate books with known character counts and positions
    - Assert: progress equals round(chars_read / total_chars × 100), integer 0-100
    - Minimum 100 iterations
    - **Validates: Requirements 5.3**

- [ ] 11. Checkpoint - Services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement Reader Component (React Core)
  - [ ] 12.1 Implement the Reader component with props, state management, and service orchestration
    - Create src/components/Reader.tsx
    - Accept ReaderProps as defined in design (source, theme, fontFamily, fontSize, zoom, direction, plugins, callbacks)
    - Initialize services via React Context (ThemeEngine, DirectionDetector, DictionaryService, BookmarkStore, ChapterNavigator)
    - Load book from source (delegate to appropriate parser/URL loader)
    - Manage ReaderState
    - Emit events via callback props (onPageChange, onBookmarkCreate, onError, onReady)
    - Display structured error messages for failed inputs (source name, format, reason)
    - _Requirements: 1.1, 2.4_

  - [ ] 12.2 Implement zoom functionality with clamping and pinch-zoom
    - Create src/components/ZoomController.tsx
    - Support zoom levels 50-300% in 10% increments, default 100%
    - Clamp values to [50, 300] at nearest 10% increment
    - Scale content with text reflow, no overflow or clipping
    - Handle pinch-zoom gestures, snap to nearest 10% on gesture end
    - Preserve reading position on zoom change
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 12.3 Write property test for zoom level clamping
    - **Property 5: Zoom Level Clamping and Application**
    - Create src/components/__tests__/zoom-clamping.property.test.ts
    - Generate arbitrary numeric values (negative, zero, huge)
    - Assert: result clamped to [50, 300] at nearest 10% increment
    - Minimum 100 iterations
    - **Validates: Requirements 4.1, 4.5**

  - [ ]* 12.4 Write property test for pinch-zoom gesture snapping
    - **Property 7: Pinch-Zoom Gesture Snapping**
    - Create src/components/__tests__/pinch-zoom-snap.property.test.ts
    - Generate raw float zoom values from gesture magnitudes
    - Assert: final zoom is nearest 10% increment within [50, 300]
    - Minimum 100 iterations
    - **Validates: Requirements 4.3**

  - [ ] 12.5 Implement reading UI: chapter index, page navigation, progress display, RTL support
    - Create src/components/ChapterIndex.tsx for table of contents panel
    - Create src/components/PageNavigation.tsx for next/previous controls
    - Create src/components/ProgressBar.tsx for reading progress display
    - Apply RTL layout when direction is RTL (page turns right-to-left, mirrored UI)
    - Apply Unicode BiDi algorithm for mixed-direction content at paragraph level
    - Support Noto Nastaliq Urdu font; default to Nastaliq + 2.0x line spacing for Urdu
    - Implement direction override UI control with per-book persistence
    - Show user prompt when direction confidence is low
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 12.6 Write property test for display changes preserving reading position
    - **Property 6: Display Changes Preserve Reading Position**
    - Create src/components/__tests__/position-preservation.property.test.ts
    - Generate reading positions and display change tuples (font change, size change, zoom change)
    - Assert: same paragraph visible after change
    - Minimum 100 iterations
    - **Validates: Requirements 3.4, 4.4**

  - [ ] 12.7 Implement theme/font UI controls and bookmark UI
    - Create src/components/ThemeSelector.tsx for theme and font selection
    - Create src/components/BookmarkPanel.tsx for bookmark list, create, rename, delete
    - Create src/components/DictionaryPopover.tsx for word lookup display
    - Wire all UI controls to services
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 7.3, 7.5, 8.5, 8.7_

- [ ] 13. Checkpoint - React core complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement Vue 3 Wrapper
  - [ ] 14.1 Implement the Vue 3 wrapper component
    - Create src/wrappers/vue/EbookReader.vue (or .ts with defineComponent)
    - Define reactive props matching ReaderProps
    - Mount/unmount React Reader component using Vue lifecycle hooks (onMounted, onUnmounted)
    - Watch props and update React component on changes
    - Translate Reader callback events to Vue emits (page-change, bookmark-create, error, ready)
    - Validate props; emit error event for invalid types or missing required props
    - _Requirements: 1.2, 1.4, 1.6, 1.7_

  - [ ]* 14.2 Write unit tests for Vue wrapper
    - Test reactive prop updates propagate to Reader
    - Test events emitted correctly on state changes
    - Test prop validation errors emit error event
    - Test mount/unmount lifecycle
    - _Requirements: 1.2, 1.6, 1.7_

- [ ] 15. Implement Web Component Wrapper
  - [ ] 15.1 Implement the Web Component (Custom Element) wrapper
    - Create src/wrappers/web-component/EbookReaderElement.ts
    - Extend HTMLElement, define observedAttributes
    - Use Shadow DOM for style encapsulation
    - Mount React Reader in Shadow DOM via connectedCallback
    - Handle attributeChangedCallback for simple props, JavaScript properties for complex values
    - Dispatch CustomEvents for Reader state changes
    - Validate props; dispatch error CustomEvent for invalid/missing required props
    - Unmount React on disconnectedCallback
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 15.2 Write unit tests for Web Component wrapper
    - Test Shadow DOM creation and style encapsulation
    - Test attribute changes update Reader
    - Test JavaScript property API for complex values
    - Test CustomEvent dispatch on state changes
    - Test connectedCallback/disconnectedCallback lifecycle
    - Test prop validation errors dispatch error event
    - _Requirements: 1.3, 1.5, 1.6, 1.7_

- [ ] 16. Wrapper property tests
  - [ ]* 16.1 Write property test for wrapper behavioral equivalence
    - **Property 15: Wrapper Behavioral Equivalence**
    - Create src/wrappers/__tests__/wrapper-equivalence.property.test.ts
    - Generate random valid prop configurations
    - Assert: Vue wrapper and Web Component wrapper produce same DOM structure and behavior as direct React usage
    - Assert: dynamic prop updates produce same outcome across all wrappers
    - Minimum 100 iterations
    - **Validates: Requirements 1.4**

  - [ ]* 16.2 Write property test for wrapper event propagation
    - **Property 16: Wrapper Event Propagation**
    - Create src/wrappers/__tests__/wrapper-events.property.test.ts
    - Generate random event payloads (page change, bookmark, error)
    - Assert: Vue wrapper emits correct Vue event, Web Component dispatches correct CustomEvent
    - Assert: payload data is preserved exactly
    - Minimum 100 iterations
    - **Validates: Requirements 1.6**

- [ ] 17. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript as specified in the design document
- Testing framework: Vitest with fast-check for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2", "2.4"] },
    { "id": 4, "tasks": ["2.3", "3.3", "3.4"] },
    { "id": 5, "tasks": ["5.1", "6.1", "7.1", "8.1", "9.1", "10.1"] },
    { "id": 6, "tasks": ["5.2", "6.2", "7.2", "7.3", "8.2", "8.3", "8.4", "9.2", "10.2", "10.3"] },
    { "id": 7, "tasks": ["12.1"] },
    { "id": 8, "tasks": ["12.2", "12.5", "12.7"] },
    { "id": 9, "tasks": ["12.3", "12.4", "12.6"] },
    { "id": 10, "tasks": ["14.1", "15.1"] },
    { "id": 11, "tasks": ["14.2", "15.2", "16.1", "16.2"] }
  ]
}
```
