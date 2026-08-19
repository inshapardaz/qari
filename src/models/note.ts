/**
 * Note data model for the Universal Ebook Reader.
 * A note anchors a user comment to a highlighted range of text within a
 * chapter, captured via text selection.
 */

/** Fixed highlight-color palette for notes — see DEFAULT_NOTE_COLOR/NOTE_HIGHLIGHT_COLORS in text-highlight.ts for the actual CSS values. */
export type NoteColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface Note {
  id: string; // Sqids-encoded id (see generateId in note-store.ts)
  bookId: string; // Identifies the book
  chapterId: string; // Chapter within the book
  startOffset: number; // Character offset within the chapter's rendered text where the highlight starts
  endOffset: number; // Character offset where the highlight ends (exclusive)
  text: string; // The highlighted excerpt, captured at creation time
  comment?: string; // Optional user-provided annotation, 0-1000 chars
  /** Highlight color. Undefined means the default color (see DEFAULT_NOTE_COLOR) — kept optional so notes persisted before this field existed keep rendering the same way. */
  color?: NoteColor;
  createdAt: string; // ISO 8601 UTC
  updatedAt?: string; // ISO 8601 UTC, set when the comment or color is edited
}
