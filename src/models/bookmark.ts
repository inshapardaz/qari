/**
 * Bookmark data model for the Universal Ebook Reader.
 */

export interface Bookmark {
  id: string; // Sqids-encoded id (see generateId in bookmark-store.ts)
  bookId: string; // Identifies the book
  chapterId: string; // Chapter within the book
  position: number; // Character offset within chapter
  name: string; // User-provided, 1-100 chars
  createdAt: string; // ISO 8601 UTC
  updatedAt?: string; // ISO 8601 UTC, set on rename
}
