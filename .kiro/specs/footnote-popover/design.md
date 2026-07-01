# Design Document: Footnote Popover

## Overview

This feature adds footnote support to the Qari ebook reader. Footnote references in EPUB and Markdown content are detected by parsers, represented as a new `FootnoteRefSpan` inline node type, rendered as clickable superscript numbers, and displayed in a popover when clicked. The popover follows the existing `DictionaryPopover` pattern.

## Architecture

The footnote popover feature extends the existing Qari ebook reader pipeline at three levels:

1. **Content Model** — A new `FootnoteRefSpan` inline node type is added to `src/models/book.ts`
2. **Parsers** — Both `epub-parser.ts` and `markdown-parser.ts` detect footnote patterns and produce `FootnoteRefSpan` nodes
3. **Rendering** — The `InlineNodeRenderer` in `Reader.tsx` renders footnote references as clickable superscripts, and a new `FootnotePopover` component displays content on click

This mirrors the existing architecture where parsers produce a shared `Book` model and the `Reader` renders it. The popover follows the `DictionaryPopover` pattern (absolute positioning, outside click dismiss, Escape key, close button, focus trap).

## Components and Interfaces

### 1. Content Model Extension (`src/models/book.ts`)

Add `FootnoteRefSpan` to the `InlineNode` union type.

```typescript
export interface FootnoteRefSpan {
  type: 'footnote-ref';
  label: string;          // Display label, e.g. "1", "2"
  content: InlineNode[];  // Resolved footnote body as inline nodes
}

export type InlineNode =
  | TextSpan
  | BoldSpan
  | ItalicSpan
  | LinkSpan
  | CodeSpan
  | InlineImageSpan
  | FootnoteRefSpan;
```

### 2. EPUB Parser Updates (`src/parsers/epub-parser.ts`)

**Detection logic** in `elementToInlineNode`:

When the parser encounters an `<a>` element, check for `epub:type="noteref"` attribute. If present:
1. Extract the `href` (e.g., `#fn1` or `chapter2.xhtml#fn1`)
2. Resolve the footnote target element within the current document or across documents in the zip
3. Parse the target element's inline content
4. Return a `FootnoteRefSpan` with `label` from the anchor's text content and `content` from the parsed target

**Fallback**: If the target cannot be resolved (missing element, broken href), fall back to producing a standard `LinkSpan`.

```typescript
// In elementToInlineNode, before the existing 'a' handler:
if (tagName === 'a') {
  const epubType = el.getAttribute('epub:type') || el.getAttributeNS('http://www.idpf.org/2007/ops', 'type');
  if (epubType === 'noteref') {
    const href = el.getAttribute('href') || '';
    const footnoteContent = this.resolveFootnoteContent(el, href, doc);
    if (footnoteContent) {
      return {
        type: 'footnote-ref',
        label: el.textContent?.trim() || '',
        content: footnoteContent,
      };
    }
    // Fallback to LinkSpan if resolution fails
  }
  // existing link handling...
}
```

**Footnote resolution** (`resolveFootnoteContent`):

```typescript
private resolveFootnoteContent(anchor: Element, href: string, doc: Document): InlineNode[] | null {
  // Handle fragment-only refs (#fn1) within current document
  if (href.startsWith('#')) {
    const targetId = href.slice(1);
    const targetEl = doc.getElementById(targetId);
    if (!targetEl) return null;
    return this.parseInlineChildren(targetEl);
  }
  // Cross-document refs are not resolved in initial implementation
  return null;
}
```

### 3. Markdown Parser Updates (`src/parsers/markdown-parser.ts`)

**Footnote definition collection**: Before parsing inline content, scan for `footnote_ref` and `footnote_open`/`footnote_close` tokens produced by `markdown-it-footnote` plugin (or implement manual regex-based detection for `[^id]` patterns and `[^id]: content` definitions).

**Strategy**: Use markdown-it's built-in footnote plugin (`markdown-it-footnote`) which produces dedicated token types. The parser will:

1. Collect footnote definitions from `footnote_open`/`footnote_close` block tokens into a `Map<string, InlineNode[]>`
2. When encountering `footnote_ref` inline tokens, produce a `FootnoteRefSpan` with:
   - `label`: Auto-incremented counter as string ("1", "2", ...)
   - `content`: Looked up from the definitions map

**Fallback**: If a `[^id]` reference has no matching definition, produce a `TextSpan` with the raw reference text (e.g., `[^missing]`).

```typescript
// Footnote definition map built during block-level parsing
const footnoteDefinitions = new Map<string, InlineNode[]>();
let footnoteCounter = 0;

// In parseInlineNodes, handle footnote_ref tokens:
if (token.type === 'footnote_ref') {
  const id = token.meta?.id?.toString() || '';
  const content = footnoteDefinitions.get(id);
  if (content) {
    footnoteCounter++;
    nodes.push({
      type: 'footnote-ref',
      label: String(footnoteCounter),
      content,
    });
  } else {
    nodes.push({ type: 'text', content: `[^${id}]` });
  }
  i++;
  continue;
}
```

### 4. Footnote Reference Rendering (`src/components/Reader.tsx`)

Add a `'footnote-ref'` case to `InlineNodeRenderer`:

```typescript
case 'footnote-ref':
  return (
    <sup
      data-testid="footnote-ref"
      onClick={(e) => onFootnoteClick?.(node, e)}
      style={{
        color: 'var(--reader-accent, #0066cc)',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.75em',
      }}
      role="button"
      tabIndex={0}
      aria-label={interpolate(t.footnoteDialogLabel, { label: node.label })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFootnoteClick?.(node, e as unknown as React.MouseEvent);
        }
      }}
    >
      {node.label}
    </sup>
  );
```

### 5. FootnotePopover Component (`src/components/FootnotePopover.tsx`)

A focused component following the `DictionaryPopover` pattern:

```typescript
import React, { useEffect, useRef, useCallback } from 'react';
import type { InlineNode, FootnoteRefSpan } from '../models/book';
import { useTranslations, interpolate } from '../i18n';

export interface FootnotePopoverProps {
  /** The footnote data to display */
  footnote: FootnoteRefSpan | null;
  /** Anchor position for the popover */
  anchorPosition?: { top: number; left: number };
  /** Whether the popover is visible */
  visible?: boolean;
  /** Called when the user dismisses the popover */
  onClose?: () => void;
  /** Render function for inline nodes (passed from Reader) */
  renderInlineNode: (node: InlineNode, index: number) => React.ReactNode;
}

export const FootnotePopover: React.FC<FootnotePopoverProps> = ({
  footnote,
  anchorPosition,
  visible = true,
  onClose,
  renderInlineNode,
}) => {
  const t = useTranslations();
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management, Escape key, outside click, focus trap
  // ... (same patterns as DictionaryPopover)

  if (!visible || !footnote) return null;

  const style: React.CSSProperties = anchorPosition
    ? {
        position: 'absolute',
        top: `${anchorPosition.top + 8}px`,
        left: `${anchorPosition.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'var(--reader-bg, #ffffff)',
        color: 'var(--reader-fg, #1a1a1a)',
        border: '1px solid var(--reader-border, #e0e0e0)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '12px 16px',
        maxWidth: '340px',
        maxHeight: '50vh',
        overflowY: 'auto',
        fontSize: '14px',
        lineHeight: '1.5',
      }
    : { position: 'relative' as const };

  return (
    <div
      data-testid="footnote-popover"
      role="dialog"
      aria-label={interpolate(t.footnoteDialogLabel, { label: footnote.label })}
      style={style}
      ref={popoverRef}
      tabIndex={-1}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <button
          type="button"
          data-testid="footnote-close"
          aria-label={t.footnoteClose}
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '2px 6px',
            borderRadius: '4px',
            color: 'var(--reader-fg, #666)',
            opacity: 0.7,
          }}
        >
          ×
        </button>
      </div>
      <div data-testid="footnote-content">
        {footnote.content.map((node, i) => renderInlineNode(node, i))}
      </div>
    </div>
  );
};
```

### 6. Integration in Reader.tsx

The Reader manages footnote popover state alongside existing DictionaryPopover state:

```typescript
const [activeFootnote, setActiveFootnote] = useState<FootnoteRefSpan | null>(null);
const [footnoteAnchor, setFootnoteAnchor] = useState<{ top: number; left: number } | null>(null);

const handleFootnoteClick = useCallback((node: FootnoteRefSpan, e: React.MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const readerRect = readerRef.current?.getBoundingClientRect();
  if (readerRect) {
    setFootnoteAnchor({
      top: rect.bottom - readerRect.top,
      left: rect.left + rect.width / 2 - readerRect.left,
    });
  }
  setActiveFootnote(node);
}, []);

const handleFootnoteClose = useCallback(() => {
  setActiveFootnote(null);
  setFootnoteAnchor(null);
}, []);
```

## Interfaces

### FootnoteRefSpan (model interface)

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'footnote-ref'` | Discriminant for union type |
| `label` | `string` | Display label (e.g., "1", "2") |
| `content` | `InlineNode[]` | Resolved footnote body |

### FootnotePopoverProps (component interface)

| Prop | Type | Description |
|------|------|-------------|
| `footnote` | `FootnoteRefSpan \| null` | Footnote data to display |
| `anchorPosition` | `{ top: number; left: number }` | Position relative to reader |
| `visible` | `boolean` | Visibility toggle |
| `onClose` | `() => void` | Dismiss callback |
| `renderInlineNode` | `(node: InlineNode, index: number) => React.ReactNode` | Renderer delegate |

## Data Models

### InlineNode Union (extended)

```typescript
export type InlineNode =
  | TextSpan
  | BoldSpan
  | ItalicSpan
  | LinkSpan
  | CodeSpan
  | InlineImageSpan
  | FootnoteRefSpan;  // NEW
```

### TranslationStrings (extended)

```typescript
// Footnote popover
footnoteClose: string;
footnoteDialogLabel: string; // supports {label}
```

### Default translations (English)

```typescript
footnoteClose: 'Close footnote',
footnoteDialogLabel: 'Footnote {label}',
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| EPUB noteref with unresolvable target | Falls back to `LinkSpan` (standard link) |
| Markdown `[^id]` with no matching definition | Produces `TextSpan` with raw text `[^id]` |
| FootnotePopover receives null footnote | Renders nothing (returns null) |
| Empty footnote content array | Popover renders with empty content area |

## Testing Strategy

- **Unit tests**: Verify specific rendering output, accessibility attributes, dismiss interactions (click outside, Escape, close button), and focus management. Cover parser fallback/edge cases with concrete examples.
- **Property tests**: Validate parser correctness across varied inputs (EPUB documents with noterefs, Markdown with footnote definitions), structural invariants of `FootnoteRefSpan`, rendering output for arbitrary labels, sequential label numbering, and translation usage. Minimum 100 iterations per property.
- **Integration tests**: Verify end-to-end flow from parsing a footnoted document to clicking a reference and seeing popover content.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: FootnoteRefSpan structural invariant

*For any* generated `FootnoteRefSpan` node, the `label` field must be a non-empty string and the `content` field must be a valid array (length ≥ 0) where every element is a valid `InlineNode`.

**Validates: Requirements 1.2, 1.3**

### Property 2: EPUB noteref detection produces correct FootnoteRefSpan

*For any* EPUB document containing an `<a>` element with `epub:type="noteref"` and a resolvable same-document fragment target, the parser SHALL produce a `FootnoteRefSpan` whose `label` equals the anchor's text content and whose `content` contains the parsed inline nodes from the target element.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Markdown footnote reference produces correct FootnoteRefSpan

*For any* Markdown document containing a `[^id]` reference with a matching `[^id]: content` definition, the parser SHALL produce a `FootnoteRefSpan` whose `content` field is the parsed inline representation of the definition text.

**Validates: Requirements 3.1, 3.3**

### Property 4: Markdown footnote labels are sequentially numbered

*For any* Markdown document with K footnote references (each with a matching definition), the resulting `FootnoteRefSpan` nodes SHALL have labels "1" through "K" in order of appearance.

**Validates: Requirements 3.4**

### Property 5: Footnote reference renders as superscript with correct label

*For any* `FootnoteRefSpan` node with a given label string, the `InlineNodeRenderer` SHALL produce a `<sup>` element whose text content equals the label value.

**Validates: Requirements 4.1, 4.4**

### Property 6: Popover renders all footnote content nodes

*For any* `FootnoteRefSpan` with a non-empty `content` array, when the `FootnotePopover` is visible, it SHALL render each `InlineNode` in the content array via the provided `renderInlineNode` function.

**Validates: Requirements 5.3**

### Property 7: Translation strings are used for popover accessibility labels

*For any* `TranslationStrings` object with `footnoteClose` and `footnoteDialogLabel` values, the rendered popover close button's `aria-label` SHALL equal `footnoteClose`, and the dialog's `aria-label` SHALL equal `interpolate(footnoteDialogLabel, { label })`.

**Validates: Requirements 8.1, 8.2**
