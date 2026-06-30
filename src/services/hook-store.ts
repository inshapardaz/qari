/**
 * Hook-based bookmark store implementation.
 * Delegates all operations to user-provided callbacks for remote persistence.
 */

import { Bookmark } from '../models/bookmark';
import { BookmarkStoreInterface, HookStoreCallbacks } from '../interfaces/bookmark-store';

export class HookStore implements BookmarkStoreInterface {
  private readonly callbacks: HookStoreCallbacks;

  constructor(callbacks: HookStoreCallbacks) {
    this.callbacks = callbacks;
  }

  async save(bookmark: Bookmark): Promise<void> {
    if (!this.callbacks.onSave) {
      return Promise.reject(new Error('operation not supported'));
    }
    return this.callbacks.onSave(bookmark);
  }

  async load(bookId: string): Promise<Bookmark[]> {
    if (!this.callbacks.onLoad) {
      return Promise.reject(new Error('operation not supported'));
    }
    return this.callbacks.onLoad(bookId);
  }

  async list(): Promise<Bookmark[]> {
    if (!this.callbacks.onList) {
      return Promise.reject(new Error('operation not supported'));
    }
    return this.callbacks.onList();
  }

  async remove(bookmarkId: string): Promise<void> {
    if (!this.callbacks.onRemove) {
      return Promise.reject(new Error('operation not supported'));
    }
    return this.callbacks.onRemove(bookmarkId);
  }

  async update(bookmark: Bookmark): Promise<void> {
    if (!this.callbacks.onUpdate) {
      return Promise.reject(new Error('operation not supported'));
    }
    return this.callbacks.onUpdate(bookmark);
  }
}
