# Requirements Document

## Introduction

This feature adds footnote support to the Qari ebook reader. Footnote references in EPUB and Markdown content are detected by parsers, represented as a new inline node type in the content model, rendered as highlighted superscript numbers, and displayed in a popover when clicked. The popover follows the existing DictionaryPopover pattern — anchored near the reference, dismissible via close button or outside click, with scrollable overflow for long content.

## Glossary

- **Reader**: The React-based ebook reading component (`Reader.tsx`) that renders book content.
- **EPUB_Parser**: The parser module (`epub-parser.ts`) that converts EPUB files into the internal Book model.
- **Markdown_Parser**: The parser module (`markdown-parser.ts`) that converts Markdown files into the internal Book model.
- **Content_Model**: The shared internal data representation (`book.ts`) used by all parsers and the renderer.
- **FootnoteRefSpan**: A new inline node type representing a footnote reference with embedded footnote content.
- **Footnote_Popover**: A new React component that displays footnote content in a floating dialog anchored to the clicked reference.
- **InlineNodeRenderer**: The existing renderer switch within Reader that maps inline node types to React elements.
- **Footnote_Reference**: A marker in source content that links to footnote content (e.g., `<a epub:type="noteref">` in EPUB, `[^id]` in Markdown).

## Requirements

### Requirement 1: Content Model Extension

**User Story:** As a developer, I want a dedicated inline node type for footnote references, so that parsers and renderers can handle footnotes distinctly from regular links.

#### Acceptance Criteria

1. THE Content_Model SHALL include a `FootnoteRefSpan` type in the `InlineNode` union with a `type` field of `'footnote-ref'`.
2. THE FootnoteRefSpan SHALL contain a `label` field of type string representing the display label (e.g., "1", "2").
3. THE FootnoteRefSpan SHALL contain a `content` field that holds the resolved footnote body as an array of `InlineNode` elements.

### Requirement 2: EPUB Footnote Detection

**User Story:** As a reader, I want footnotes in EPUB books to be automatically detected, so that I can view footnote content without navigating away from the current page.

#### Acceptance Criteria

1. WHEN the EPUB_Parser encounters an `<a>` element with `epub:type="noteref"`, THE EPUB_Parser SHALL produce a FootnoteRefSpan node instead of a LinkSpan node.
2. WHEN the EPUB_Parser produces a FootnoteRefSpan, THE EPUB_Parser SHALL resolve the linked footnote content and embed it in the FootnoteRefSpan `content` field.
3. WHEN the EPUB_Parser produces a FootnoteRefSpan, THE EPUB_Parser SHALL derive the `label` from the text content of the anchor element.
4. IF the EPUB_Parser cannot resolve the footnote target content, THEN THE EPUB_Parser SHALL fall back to producing a standard LinkSpan node.

### Requirement 3: Markdown Footnote Detection

**User Story:** As a reader, I want footnotes in Markdown books to be automatically detected, so that I can view footnote content inline.

#### Acceptance Criteria

1. WHEN the Markdown_Parser encounters a `[^id]` reference in inline text, THE Markdown_Parser SHALL produce a FootnoteRefSpan node.
2. WHEN the Markdown_Parser encounters a `[^id]: content` definition, THE Markdown_Parser SHALL store the content for resolution into FootnoteRefSpan nodes.
3. WHEN the Markdown_Parser produces a FootnoteRefSpan, THE Markdown_Parser SHALL populate the `content` field with the parsed inline content from the matching footnote definition.
4. WHEN the Markdown_Parser produces a FootnoteRefSpan, THE Markdown_Parser SHALL assign an auto-incremented numeric string as the `label` (e.g., "1", "2", "3").
5. IF the Markdown_Parser encounters a `[^id]` reference with no matching definition, THEN THE Markdown_Parser SHALL produce a TextSpan containing the raw reference text.

### Requirement 4: Footnote Reference Rendering

**User Story:** As a reader, I want footnote references to appear as highlighted superscript numbers, so that I can identify them without disrupting my reading flow.

#### Acceptance Criteria

1. WHEN the InlineNodeRenderer encounters a FootnoteRefSpan node, THE Reader SHALL render a clickable superscript element displaying the `label` value.
2. THE Reader SHALL style the footnote reference with a highlight color (using the CSS variable `--reader-accent`) to distinguish it from surrounding text.
3. THE Reader SHALL apply `cursor: pointer` styling to footnote reference elements to indicate interactivity.
4. THE Reader SHALL render the footnote reference as a `<sup>` HTML element to produce superscript positioning.

### Requirement 5: Footnote Popover Display

**User Story:** As a reader, I want to see footnote content in a tooltip-like popover when I click a footnote reference, so that I can read the footnote without leaving my current position.

#### Acceptance Criteria

1. WHEN a user clicks a footnote reference element, THE Footnote_Popover SHALL become visible and display the footnote content.
2. THE Footnote_Popover SHALL be positioned anchored near the clicked footnote reference (floating above or below the text).
3. THE Footnote_Popover SHALL render the footnote content (array of InlineNode) using the InlineNodeRenderer.
4. THE Footnote_Popover SHALL have a `role="dialog"` attribute for accessibility.
5. THE Footnote_Popover SHALL receive keyboard focus when opened.

### Requirement 6: Footnote Popover Dismissal

**User Story:** As a reader, I want to dismiss the footnote popover easily, so that I can return to reading without obstruction.

#### Acceptance Criteria

1. WHEN a user clicks outside the Footnote_Popover, THE Footnote_Popover SHALL close.
2. THE Footnote_Popover SHALL display a close button with an accessible aria-label.
3. WHEN a user clicks the close button, THE Footnote_Popover SHALL close.
4. WHEN a user presses the Escape key while the Footnote_Popover is open, THE Footnote_Popover SHALL close.
5. WHEN the Footnote_Popover closes, THE Reader SHALL restore keyboard focus to the previously focused element.

### Requirement 7: Footnote Popover Overflow Handling

**User Story:** As a reader, I want long footnote content to be scrollable within the popover, so that I can read the full footnote without the popover growing unbounded.

#### Acceptance Criteria

1. THE Footnote_Popover SHALL constrain its maximum height to 50% of the viewport height.
2. WHILE the footnote content exceeds the maximum height, THE Footnote_Popover SHALL display a vertical scrollbar.
3. THE Footnote_Popover SHALL constrain its maximum width to 340 pixels.

### Requirement 8: Internationalization Support

**User Story:** As a developer, I want footnote-related UI strings to be translatable, so that the reader supports multiple languages.

#### Acceptance Criteria

1. THE Reader SHALL use a translation string for the footnote popover close button aria-label.
2. THE Reader SHALL use a translation string for the footnote popover dialog aria-label (supports `{label}` interpolation).
3. THE Reader SHALL add footnote translation keys to the TranslationStrings interface and provide English defaults.
