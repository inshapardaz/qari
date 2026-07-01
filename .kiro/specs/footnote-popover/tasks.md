# Implementation Plan: Footnote Popover

## Overview

Add footnote support to the Qari ebook reader. Footnote references in EPUB and Markdown content are detected by parsers, represented as a new `FootnoteRefSpan` inline node type, rendered as clickable superscript numbers, and displayed in a popover when clicked. The popover follows the existing `DictionaryPopover` pattern — anchored near the reference, dismissible via close button, outside click, or Escape key, with scrollable overflow for long content.

## Tasks

- [x] 1. Extend content model and add i18n keys
  - [x] 1.1 Add FootnoteRefSpan to InlineNode union type
    - Add `FootnoteRefSpan` interface to `src/models/book.ts` with fields: `type: 'footnote-ref'`, `label: string`, `content: InlineNode[]`
    - Add `FootnoteRefSpan` to the `InlineNode` union type
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Add footnote translation keys to i18n system
    - Add `footnoteClose` and `footnoteDialogLabel` to `TranslationStrings` in `src/i18n/types.ts`
    - Add English defaults in `src/i18n/defaults.ts`: `footnoteClose: 'Close footnote'`, `footnoteDialogLabel: 'Footnote {label}'`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Implement FootnotePopover component
  - [x] 2.1 Create FootnotePopover component
    - Create `src/components/FootnotePopover.tsx` with `FootnotePopoverProps` interface (`footnote`, `anchorPosition`, `visible`, `onClose`, `renderInlineNode`)
    - Implement `role="dialog"` with `aria-label` using `interpolate(t.footnoteDialogLabel, { label })`
    - Add close button with `aria-label={t.footnoteClose}`
    - Implement outside click dismissal, Escape key handling, and focus management (save/restore previous focus)
    - Apply `maxHeight: '50vh'`, `overflowY: 'auto'`, `maxWidth: '340px'` constraints
    - Render footnote content via the `renderInlineNode` delegate function
    - Use inline styles consistent with existing component patterns (DictionaryPopover)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2_

  - [x] 2.2 Write property test for FootnoteRefSpan structural invariant
    - **Property 1: FootnoteRefSpan structural invariant**
    - Test that for any generated `FootnoteRefSpan`, `label` is a non-empty string and `content` is a valid array of `InlineNode` elements
    - Create `src/components/__tests__/footnote-structural-invariant.property.test.ts`
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.3 Write property test for popover content rendering
    - **Property 6: Popover renders all footnote content nodes**
    - Test that for any `FootnoteRefSpan` with non-empty content, when popover is visible, each node in the content array is passed to `renderInlineNode`
    - Create `src/components/__tests__/footnote-popover-content.property.test.ts`
    - **Validates: Requirements 5.3**

  - [x] 2.4 Write property test for translation string usage
    - **Property 7: Translation strings are used for popover accessibility labels**
    - Test that close button `aria-label` equals `footnoteClose` and dialog `aria-label` equals `interpolate(footnoteDialogLabel, { label })`
    - Create `src/components/__tests__/footnote-translation-usage.property.test.ts`
    - **Validates: Requirements 8.1, 8.2**

  - [x] 2.5 Write unit tests for FootnotePopover
    - Create `src/components/FootnotePopover.test.tsx`
    - Verify popover renders with correct ARIA attributes (`role="dialog"`, accessible labels)
    - Verify close button click calls `onClose`
    - Verify outside click calls `onClose`
    - Verify Escape key calls `onClose`
    - Verify focus is moved to popover on open and restored on close
    - Verify max-height and overflow styles are applied
    - Verify popover renders nothing when `footnote` is null or `visible` is false
    - _Requirements: 5.1, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement EPUB footnote detection
  - [x] 4.1 Add footnote resolution to EPUB parser
    - In `src/parsers/epub-parser.ts`, detect `<a>` elements with `epub:type="noteref"` (or namespaced `http://www.idpf.org/2007/ops` type attribute)
    - Implement `resolveFootnoteContent` to look up fragment targets (`#id`) in the same document
    - Produce `FootnoteRefSpan` with `label` from anchor text content and `content` from parsed target element
    - Fall back to standard `LinkSpan` when target cannot be resolved
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.2 Write property test for EPUB noteref detection
    - **Property 2: EPUB noteref detection produces correct FootnoteRefSpan**
    - Test that for any EPUB document with `<a epub:type="noteref">` and a resolvable same-document target, parser produces a `FootnoteRefSpan` with correct label and content
    - Create `src/parsers/__tests__/epub-footnote-detection.property.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 4.3 Write unit tests for EPUB footnote parsing
    - Add tests to `src/parsers/epub-parser.test.ts`
    - Test: noteref with resolvable target produces FootnoteRefSpan
    - Test: noteref with unresolvable target falls back to LinkSpan
    - Test: label is derived from anchor text content
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Implement Markdown footnote detection
  - [x] 5.1 Add footnote parsing to Markdown parser
    - In `src/parsers/markdown-parser.ts`, detect `[^id]` inline references and `[^id]: content` definitions
    - Build a footnote definitions map during block-level parsing
    - Produce `FootnoteRefSpan` nodes with auto-incremented numeric labels ("1", "2", "3", ...)
    - Populate `content` field from matching definition's parsed inline nodes
    - Fall back to `TextSpan` with raw text when definition is missing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Write property test for Markdown footnote reference correctness
    - **Property 3: Markdown footnote reference produces correct FootnoteRefSpan**
    - Test that for any Markdown with `[^id]` and matching `[^id]: content`, parser produces a `FootnoteRefSpan` with correct content
    - Create `src/parsers/__tests__/markdown-footnote-detection.property.test.ts`
    - **Validates: Requirements 3.1, 3.3**

  - [x] 5.3 Write property test for sequential label numbering
    - **Property 4: Markdown footnote labels are sequentially numbered**
    - Test that for any Markdown with K footnote references (each with matching definition), resulting labels are "1" through "K" in order of appearance
    - Create `src/parsers/__tests__/markdown-footnote-labels.property.test.ts`
    - **Validates: Requirements 3.4**

  - [x] 5.4 Write unit tests for Markdown footnote parsing
    - Add tests to `src/parsers/markdown-parser.test.ts`
    - Test: reference with matching definition produces FootnoteRefSpan
    - Test: reference without matching definition produces TextSpan with raw text
    - Test: multiple references are numbered sequentially
    - Test: footnote content is parsed as inline nodes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate footnote rendering into Reader
  - [x] 7.1 Add footnote-ref case to InlineNodeRenderer
    - In `src/components/Reader.tsx`, add a `'footnote-ref'` case to `InlineNodeRenderer`
    - Render a `<sup>` element with `role="button"`, `tabIndex={0}`, `cursor: pointer`, `color: var(--reader-accent, #0066cc)`
    - Display the `label` value as text content
    - Handle click and keyboard (Enter/Space) events to trigger footnote popover
    - Add `aria-label` using `interpolate(t.footnoteDialogLabel, { label })`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Wire FootnotePopover state and rendering in Reader
    - Add `activeFootnote` and `footnoteAnchor` state to Reader component
    - Implement `handleFootnoteClick` callback to compute anchor position and set active footnote
    - Implement `handleFootnoteClose` callback to clear state
    - Import and conditionally render `<FootnotePopover>` when `activeFootnote` is non-null
    - Pass `renderInlineNode` delegate to FootnotePopover (reusing InlineNodeRenderer logic)
    - Add `footnote-ref` case to `inlineNodeToHtml` helper for pagination measurement
    - _Requirements: 5.1, 5.2, 6.5_

  - [x] 7.3 Write property test for footnote reference rendering
    - **Property 5: Footnote reference renders as superscript with correct label**
    - Test that for any `FootnoteRefSpan` with a given label, the renderer produces a `<sup>` element with text content equal to the label
    - Create `src/components/__tests__/footnote-ref-rendering.property.test.ts`
    - **Validates: Requirements 4.1, 4.4**

  - [x] 7.4 Write unit tests for Reader footnote integration
    - Add tests to `src/components/Reader.test.tsx`
    - Test: clicking a footnote ref opens the FootnotePopover
    - Test: popover displays correct footnote content
    - Test: closing popover restores focus to the footnote reference
    - Test: footnote reference is rendered as superscript with accent color
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 6.5_

- [x] 8. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest + fast-check for property-based tests, and @testing-library/react for component tests
- The FootnotePopover follows the same patterns as DictionaryPopover (absolute positioning, outside click dismiss, Escape key, close button, focus management)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2", "4.3", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["7.1", "7.2"] },
    { "id": 4, "tasks": ["7.3", "7.4"] }
  ]
}
```
