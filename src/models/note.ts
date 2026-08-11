/**
 * Note data model for the Universal Ebook Reader.
 * A note anchors a user comment to a highlighted range of text within a
 * chapter, captured via text selection.
 */

export interface Note {
  id: string; // UUID
  bookId: string; // Identifies the book
  chapterId: string; // Chapter within the book
  startOffset: number; // Character offset within the chapter's rendered text where the highlight starts
  endOffset: number; // Character offset where the highlight ends (exclusive)
  text: string; // The highlighted excerpt, captured at creation time
  comment?: string; // Optional user-provided annotation, 0-1000 chars
  createdAt: string; // ISO 8601 UTC
  updatedAt?: string; // ISO 8601 UTC, set when the comment is edited
}
