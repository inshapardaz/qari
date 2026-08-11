/**
 * Note Store for the Universal Ebook Reader.
 * Provides CRUD operations for notes with localStorage default and
 * optional custom adapter delegation with timeout fallback. Mirrors
 * `bookmark-store.ts`'s shape.
 */

import { Note } from '../models/note';
import { CustomNoteStoreAdapter } from '../interfaces/note-store';
import { LocalStorageNoteStore } from './local-storage-note-store';

const ADAPTER_TIMEOUT_MS = 5000;
const MAX_NOTES_PER_BOOK = 200;
const MAX_COMMENT_LENGTH = 1000;

export interface NoteStoreNotification {
  type: 'warning' | 'error';
  message: string;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function validateComment(comment: string | undefined): void {
  if (comment !== undefined && comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Note comment must not exceed ${MAX_COMMENT_LENGTH} characters. Provided: ${comment.length} characters.`
    );
  }
}

export class NoteStore {
  private adapter?: CustomNoteStoreAdapter;
  private readonly fallback = new LocalStorageNoteStore();
  private notifications: NoteStoreNotification[] = [];

  constructor(adapter?: CustomNoteStoreAdapter) {
    this.adapter = adapter;
  }

  /**
   * Get and clear pending notifications (e.g., fallback warnings).
   */
  getNotifications(): NoteStoreNotification[] {
    const pending = [...this.notifications];
    this.notifications = [];
    return pending;
  }

  /**
   * Create a new note for a given book, chapter, and highlighted range.
   */
  async create(
    bookId: string,
    chapterId: string,
    startOffset: number,
    endOffset: number,
    text: string,
    comment?: string
  ): Promise<Note> {
    validateComment(comment);

    const existingNotes = await this.load(bookId);
    if (existingNotes.length >= MAX_NOTES_PER_BOOK) {
      throw new Error(
        `Cannot create note: maximum of ${MAX_NOTES_PER_BOOK} notes per book has been reached.`
      );
    }

    const note: Note = {
      id: generateUUID(),
      bookId,
      chapterId,
      startOffset,
      endOffset,
      text,
      comment,
      createdAt: new Date().toISOString(),
    };

    if (this.adapter) {
      try {
        await withTimeout(this.adapter.save(note), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Note sync failed. Saved locally.' });
        await this.fallback.save(note);
      }
    } else {
      await this.fallback.save(note);
    }

    return note;
  }

  /**
   * Update an existing note's comment.
   */
  async updateComment(noteId: string, comment: string): Promise<Note> {
    validateComment(comment);

    const allNotes = await this.list();
    const note = allNotes.find((n) => n.id === noteId);

    if (!note) {
      throw new Error(`Note with id "${noteId}" not found.`);
    }

    const updatedNote: Note = {
      ...note,
      comment,
      updatedAt: new Date().toISOString(),
    };

    if (this.adapter) {
      try {
        await withTimeout(this.adapter.save(updatedNote), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Note sync failed. Saved locally.' });
        await this.fallback.save(updatedNote);
      }
    } else {
      await this.fallback.save(updatedNote);
    }

    return updatedNote;
  }

  /**
   * Delete a note by ID.
   */
  async delete(noteId: string): Promise<void> {
    if (this.adapter) {
      try {
        await withTimeout(this.adapter.remove(noteId), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Note sync failed. Removed locally.' });
        await this.fallback.remove(noteId).catch(() => { /* already gone locally — nothing to do */ });
      }
    } else {
      await this.fallback.remove(noteId).catch(() => { /* already gone locally — nothing to do */ });
    }
  }

  /**
   * List all notes.
   */
  async list(): Promise<Note[]> {
    if (this.adapter) {
      try {
        return await withTimeout(this.adapter.list(), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Note sync failed. Loading from local storage.' });
        return this.fallback.list();
      }
    }
    return this.fallback.list();
  }

  /**
   * Load notes for a specific book.
   */
  async load(bookId: string): Promise<Note[]> {
    if (this.adapter) {
      try {
        return await withTimeout(this.adapter.load(bookId), ADAPTER_TIMEOUT_MS);
      } catch {
        this.notifications.push({ type: 'warning', message: 'Note sync failed. Loading from local storage.' });
        return this.fallback.load(bookId);
      }
    }
    return this.fallback.load(bookId);
  }
}
