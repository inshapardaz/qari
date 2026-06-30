/**
 * Bookmark Store interface and related types for the Universal Ebook Reader.
 * Extends CustomStoreAdapter with update capability and defines event/callback types.
 */

import { Bookmark } from '../models/bookmark';
import { CustomStoreAdapter } from './store-adapter';

/**
 * Extended bookmark store interface that adds update capability
 * to the base CustomStoreAdapter contract.
 */
export interface BookmarkStoreInterface extends CustomStoreAdapter {
  update(bookmark: Bookmark): Promise<void>;
}

/**
 * Event emitted when a bookmark is created, deleted, or renamed.
 * Used by the Reader's onBookmarkChange callback.
 */
export interface BookmarkChangeEvent {
  type: 'created' | 'deleted' | 'renamed';
  bookmark: Bookmark;
}

/**
 * Callback configuration for the HookStore implementation.
 * Each callback corresponds to a store operation; missing callbacks
 * cause the operation to reject with "operation not supported".
 * Callbacks that operate on specific bookmarks receive the bookId for context.
 */
export interface HookStoreCallbacks {
  onSave?: (bookmark: Bookmark) => Promise<void>;
  onLoad?: (bookId: string) => Promise<Bookmark[]>;
  onList?: () => Promise<Bookmark[]>;
  onRemove?: (bookmarkId: string, bookId?: string) => Promise<void>;
  onUpdate?: (bookmark: Bookmark) => Promise<void>;
}
