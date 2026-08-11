/**
 * Reading progress data model for the Universal Ebook Reader.
 * Tracks the single furthest/most-recent reading position for a book, so it
 * can be restored the next time that book is opened.
 */

export interface ReadingProgressRecord {
  bookId: string; // Identifies the book
  chapterId: string; // Chapter within the book
  position: number; // Character offset within the chapter, like Bookmark.position
  percentage: number; // 0-100 overall book progress at the time this was saved
  updatedAt: string; // ISO 8601 UTC
}
