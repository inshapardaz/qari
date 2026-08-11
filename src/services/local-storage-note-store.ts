/**
 * LocalStorageNoteStore - Default note persistence implementation.
 * Stores notes in separate localStorage keys per book.
 * Key format: `${keyPrefix}notes-${bookId}`
 * Implements NoteStoreInterface with graceful error recovery.
 */

import { Note } from '../models/note';
import { NoteStoreInterface } from '../interfaces/note-store';

const MAX_NOTES_PER_BOOK = 200;

export class LocalStorageNoteStore implements NoteStoreInterface {
  private readonly keyPrefix: string;

  constructor(keyPrefix: string = 'qari-') {
    this.keyPrefix = keyPrefix;
  }

  private bookKey(bookId: string): string {
    return `${this.keyPrefix}notes-${bookId}`;
  }

  private get indexKey(): string {
    return `${this.keyPrefix}notes-index`;
  }

  private readBook(bookId: string): Note[] {
    try {
      const raw = localStorage.getItem(this.bookKey(bookId));
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Note[];
    } catch {
      return [];
    }
  }

  private writeBook(bookId: string, notes: Note[]): void {
    try {
      localStorage.setItem(this.bookKey(bookId), JSON.stringify(notes));
      this.addToIndex(bookId);
    } catch (error: unknown) {
      if (error instanceof DOMException) {
        if (error.name === 'QuotaExceededError' || error.code === 22) {
          throw new Error('localStorage quota exceeded');
        }
        if (error.name === 'SecurityError') {
          throw new Error('localStorage is unavailable');
        }
      }
      throw new Error('localStorage is unavailable');
    }
  }

  private addToIndex(bookId: string): void {
    const ids = this.getBookIds();
    if (!ids.includes(bookId)) {
      ids.push(bookId);
      try {
        localStorage.setItem(this.indexKey, JSON.stringify(ids));
      } catch {
        // Non-critical — list() may miss some books
      }
    }
  }

  private getBookIds(): string[] {
    try {
      const raw = localStorage.getItem(this.indexKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as string[];
    } catch {
      return [];
    }
  }

  /**
   * Save a note to the store. Enforces the per-book limit for brand-new
   * notes, but upserts (replaces in place) when the id already exists —
   * this makes `save` safe to reuse as the update path too, so a single
   * fallback store instance can serve both create and update without
   * needing the note to have originated from local storage in the first
   * place (e.g. after a custom adapter starts failing mid-session).
   */
  async save(note: Note): Promise<void> {
    let bookNotes: Note[];
    try {
      bookNotes = this.readBook(note.bookId);
    } catch {
      return Promise.reject(new Error('localStorage is unavailable'));
    }

    const existingIndex = bookNotes.findIndex((n) => n.id === note.id);
    if (existingIndex === -1 && bookNotes.length >= MAX_NOTES_PER_BOOK) {
      return Promise.reject(new Error('per-book limit reached'));
    }

    if (existingIndex !== -1) {
      bookNotes[existingIndex] = note;
    } else {
      bookNotes.push(note);
    }

    try {
      this.writeBook(note.bookId, bookNotes);
    } catch (error: unknown) {
      return Promise.reject(error instanceof Error ? error : new Error('localStorage is unavailable'));
    }
  }

  async load(bookId: string): Promise<Note[]> {
    return this.readBook(bookId);
  }

  async list(): Promise<Note[]> {
    const bookIds = this.getBookIds();
    const all: Note[] = [];
    for (const bookId of bookIds) {
      all.push(...this.readBook(bookId));
    }
    return all;
  }

  async remove(noteId: string): Promise<void> {
    const bookIds = this.getBookIds();
    for (const bookId of bookIds) {
      let bookNotes: Note[];
      try {
        bookNotes = this.readBook(bookId);
      } catch {
        continue;
      }

      const index = bookNotes.findIndex((n) => n.id === noteId);
      if (index !== -1) {
        bookNotes.splice(index, 1);
        try {
          this.writeBook(bookId, bookNotes);
        } catch (error: unknown) {
          return Promise.reject(error instanceof Error ? error : new Error('localStorage is unavailable'));
        }
        return;
      }
    }

    return Promise.reject(new Error('note not found'));
  }

  /**
   * Update an existing note's comment. Upserts (see `save`) rather than
   * rejecting when the note isn't already present locally.
   */
  async update(note: Note): Promise<void> {
    return this.save({ ...note, updatedAt: new Date().toISOString() });
  }
}
