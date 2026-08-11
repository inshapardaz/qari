/**
 * Note Store interface and related types for the Universal Ebook Reader.
 * Mirrors the bookmark store contract (see `bookmark-store.ts`) for a
 * separate, independent notes collection.
 */

import { Note } from '../models/note';

/**
 * Contract for custom note persistence (e.g. a server-backed store).
 * Pass an implementation via the `noteAdapter` prop to sync notes anywhere
 * other than localStorage.
 */
export interface CustomNoteStoreAdapter {
  save(note: Note): Promise<void>;
  load(bookId: string): Promise<Note[]>;
  list(): Promise<Note[]>;
  remove(noteId: string): Promise<void>;
}

/**
 * Extended note store interface that adds update capability
 * to the base CustomNoteStoreAdapter contract.
 */
export interface NoteStoreInterface extends CustomNoteStoreAdapter {
  update(note: Note): Promise<void>;
}

/**
 * Event emitted when a note is created, deleted, or its comment is updated.
 * Used by the Reader's onNoteChange callback.
 */
export interface NoteChangeEvent {
  type: 'created' | 'deleted' | 'updated';
  note: Note;
}
