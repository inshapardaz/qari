/**
 * Progress Store interface and related types for the Universal Ebook Reader.
 * Mirrors the note store contract (see `note-store.ts`) for a separate,
 * independent reading-progress record — one per book, always upserted,
 * rather than a list of items.
 */

import { ReadingProgressRecord } from '../models/progress';

/**
 * Contract for custom reading-progress persistence (e.g. a server-backed
 * store, so progress syncs across a user's devices). Pass an implementation
 * via the `progressAdapter` prop to sync progress anywhere other than
 * localStorage.
 */
export interface CustomProgressStoreAdapter {
  save(progress: ReadingProgressRecord): Promise<void>;
  load(bookId: string): Promise<ReadingProgressRecord | null>;
  remove(bookId: string): Promise<void>;
}

/**
 * Event emitted when reading progress is persisted, as the user navigates.
 * Used by the Reader's onProgressSave callback.
 */
export interface ProgressChangeEvent {
  type: 'saved';
  progress: ReadingProgressRecord;
}
