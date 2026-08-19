/**
 * DOM-text-offset helpers backing the notes feature.
 *
 * Note positions are plain character offsets into the *rendered* text of a
 * chapter's content container — not offsets into the parsed AST. Measuring
 * directly against the live DOM (rather than re-deriving offsets from the
 * book's content nodes) means the same offset always locates the same
 * characters regardless of font size, margin, column count, or scroll vs.
 * paginated mode, since none of those change the actual text content, only
 * its layout.
 */

import type { NoteColor } from '../models/note';

const HIGHLIGHT_CLASS = 'qari-note-highlight';

/** The color a note gets when it doesn't specify one (e.g. notes created before `color` existed). */
export const DEFAULT_NOTE_COLOR: NoteColor = 'yellow';

/**
 * CSS `background-color` for each note highlight color. Alpha stays low
 * (0.35-0.4) across the board so highlighted text stays readable against
 * any of the four reading themes rather than fighting the theme's own
 * foreground color.
 */
export const NOTE_HIGHLIGHT_COLORS: Record<NoteColor, string> = {
  yellow: 'rgba(255, 202, 40, 0.4)',
  green: 'rgba(76, 217, 100, 0.35)',
  blue: 'rgba(64, 156, 255, 0.35)',
  pink: 'rgba(255, 105, 180, 0.35)',
  purple: 'rgba(175, 82, 222, 0.35)',
};

/**
 * Converts a DOM Range boundary (node + offset) into a plain character
 * offset relative to the start of `container`'s text content. Works for
 * both text-node boundaries (offset = char index) and element-node
 * boundaries (offset = child index) since `Range.setEnd` accepts either.
 */
export function getTextOffset(container: Node, node: Node, offset: number): number {
  const measuringRange = document.createRange();
  measuringRange.selectNodeContents(container);
  measuringRange.setEnd(node, offset);
  return measuringRange.toString().length;
}

/**
 * Returns the start/end character offsets (relative to `container`) spanned
 * by `range`, ordered so start <= end regardless of the selection's
 * anchor/focus direction.
 */
export function getRangeOffsets(container: Node, range: Range): { start: number; end: number } {
  const a = getTextOffset(container, range.startContainer, range.startOffset);
  const b = getTextOffset(container, range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/**
 * Removes all existing note highlight marks from `container`, restoring
 * plain text in their place, and normalizes the container so adjacent text
 * nodes are merged back together (keeping subsequent offset math stable).
 */
export function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });
  container.normalize();
}

/**
 * Wraps each given [start, end) character range in `container` with a
 * `<mark>` highlight element carrying `data-note-id`. Ranges that don't
 * resolve to any text (e.g. a chapter that has since changed) are silently
 * skipped. Call `clearHighlights` first if re-applying from scratch.
 */
export function applyHighlights(
  container: HTMLElement,
  ranges: Array<{ id: string; start: number; end: number; color?: NoteColor }>
): void {
  for (const { id, start, end, color } of ranges) {
    if (end <= start) continue;
    highlightOne(container, id, start, end, color ?? DEFAULT_NOTE_COLOR);
  }
}

function highlightOne(container: HTMLElement, noteId: string, start: number, end: number, color: NoteColor): void {
  // Collect the text nodes overlapping [start, end) in one pass before
  // mutating anything — mutating mid-walk would invalidate the TreeWalker.
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const overlapping: Array<{ node: Text; nodeStart: number }> = [];
  let pos = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    const nodeStart = pos;
    const nodeEnd = pos + len;
    if (nodeEnd > start && nodeStart < end) {
      overlapping.push({ node: node as Text, nodeStart });
    }
    pos = nodeEnd;
    if (pos >= end) break;
  }

  for (const { node, nodeStart } of overlapping) {
    const len = node.textContent?.length ?? 0;
    const localStart = Math.max(0, start - nodeStart);
    const localEnd = Math.min(len, end - nodeStart);
    if (localStart >= localEnd) continue;

    // A range confined to a single text node can always be safely wrapped —
    // it can never "partially select" an element, which is what makes
    // surroundContents throw for multi-node ranges that cross tag
    // boundaries mid-way (e.g. a selection starting inside <strong> text
    // and ending in plain text after it).
    const range = document.createRange();
    range.setStart(node, localStart);
    range.setEnd(node, localEnd);
    const mark = document.createElement('mark');
    mark.className = HIGHLIGHT_CLASS;
    mark.dataset.noteId = noteId;
    // Inline styles rather than a stylesheet rule (this package ships no
    // CSS file at all — everything is inline/custom-properties) and
    // `color: inherit` overrides <mark>'s UA-default black text, which
    // would otherwise fight the current reading theme's foreground color
    // (e.g. white-on-black under the dark/high-contrast themes).
    mark.style.backgroundColor = NOTE_HIGHLIGHT_COLORS[color];
    mark.style.color = 'inherit';
    mark.style.borderRadius = '2px';
    try {
      range.surroundContents(mark);
    } catch {
      // Extremely defensive — shouldn't happen given the single-text-node
      // range constructed above, but a highlight failing to render isn't
      // worth crashing the reader over.
    }
  }
}
