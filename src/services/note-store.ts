/**
 * Note Store for the Universal Ebook Reader.
 * Provides CRUD operations for notes with localStorage default and
 * optional custom adapter delegation with timeout fallback. Mirrors
 * `bookmark-store.ts`'s shape.
 */

import Sqids from 'sqids';
import { Note, NoteColor } from '../models/note';
import { CustomNoteStoreAdapter } from '../interfaces/note-store';
import { LocalStorageNoteStore } from './local-storage-note-store';

const ADAPTER_TIMEOUT_MS = 5000;
const MAX_NOTES_PER_BOOK = 200;
const MAX_COMMENT_LENGTH = 1000;

export interface NoteStoreNotification {
  type: 'warning' | 'error';
  message: string;
}

const sqids = new Sqids();

/**
 * Generates a short, unique-enough id by Sqids-encoding two random 32-bit
 * integers (~64 bits of entropy — far more than needed to avoid collisions
 * within a single book's note list). Uses crypto.getRandomValues() for its
 * higher-quality randomness where available, falling back to Math.random()
 * otherwise.
 */
function generateId(): string {
  const randomInt = (): number => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 0xffffffff);
  };
  return sqids.encode([randomInt(), randomInt()]);
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
    comment?: string,
    color?: NoteColor
  ): Promise<Note> {
    validateComment(comment);

    const existingNotes = await this.load(bookId);
    if (existingNotes.length >= MAX_NOTES_PER_BOOK) {
      throw new Error(
        `Cannot create note: maximum of ${MAX_NOTES_PER_BOOK} notes per book has been reached.`
      );
    }

    const note: Note = {
      id: generateId(),
      bookId,
      chapterId,
      startOffset,
      endOffset,
      text,
      comment,
      color,
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
   * Update an existing note's highlight color.
   */
  async updateColor(noteId: string, color: NoteColor): Promise<Note> {
    const allNotes = await this.list();
    const note = allNotes.find((n) => n.id === noteId);

    if (!note) {
      throw new Error(`Note with id "${noteId}" not found.`);
    }

    const updatedNote: Note = {
      ...note,
      color,
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
