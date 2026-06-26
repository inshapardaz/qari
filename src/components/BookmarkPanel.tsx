/**
 * BookmarkPanel Component — displays bookmark list with create, rename, and delete capabilities.
 * Uses BookmarkStore and ChapterNavigator from ReaderContext.
 */

import React, { useState, useCallback } from 'react';
import { useReaderContext } from './Reader';
import type { Bookmark } from '../models/bookmark';
import type { BookmarkEvent } from '../models/events';

export interface BookmarkPanelProps {
  /** Called when a bookmark is created */
  onBookmarkCreate?: (event: BookmarkEvent) => void;
  /** Called when a bookmark is selected (navigate to it) */
  onBookmarkSelect?: (bookmark: Bookmark) => void;
}

const MAX_NAME_LENGTH = 100;

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({
  onBookmarkCreate,
  onBookmarkSelect,
}) => {
  const { state, bookmarkStore, chapterNavigator } = useReaderContext();
  const { bookmarks, book, currentChapter } = state;

  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter bookmarks for the current book
  const currentBookId = book?.metadata.identifier || '';
  const bookBookmarks = bookmarks.filter((b) => b.bookId === currentBookId);

  const validateName = (name: string): string | null => {
    if (!name || name.trim().length === 0) {
      return 'Bookmark name must not be empty.';
    }
    if (name.length > MAX_NAME_LENGTH) {
      return `Bookmark name must not exceed ${MAX_NAME_LENGTH} characters.`;
    }
    return null;
  };

  const handleCreate = useCallback(async () => {
    const validationError = validateName(newBookmarkName);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!bookmarkStore || !book) {
      setError('Bookmark store not available.');
      return;
    }

    const chapterId = book.chapters[currentChapter]?.id || '';
    // Use current position (simplified: position 0 for current chapter start)
    const position = 0;

    try {
      const bookmark = await bookmarkStore.create(
        currentBookId,
        chapterId,
        position,
        newBookmarkName.trim()
      );

      setNewBookmarkName('');
      setError(null);

      if (onBookmarkCreate) {
        onBookmarkCreate({ type: 'created', bookmark });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create bookmark.');
    }
  }, [newBookmarkName, bookmarkStore, book, currentChapter, currentBookId, onBookmarkCreate]);

  const handleRenameStart = useCallback((bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditName(bookmark.name);
    setError(null);
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!editingId || !bookmarkStore) return;

    const validationError = validateName(editName);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await bookmarkStore.rename(editingId, editName.trim());
      setEditingId(null);
      setEditName('');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename bookmark.');
    }
  }, [editingId, editName, bookmarkStore]);

  const handleRenameCancel = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setError(null);
  }, []);

  const handleDelete = useCallback(
    async (bookmarkId: string) => {
      if (!bookmarkStore) return;

      try {
        await bookmarkStore.delete(bookmarkId);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete bookmark.');
      }
    },
    [bookmarkStore]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, action: () => void) => {
      if (e.key === 'Enter') {
        action();
      }
    },
    []
  );

  return (
    <div className="bookmark-panel" data-testid="bookmark-panel" role="region" aria-label="Bookmarks">
      <h2 className="bookmark-panel__title">Bookmarks</h2>

      {/* Error display */}
      {error && (
        <div
          className="bookmark-panel__error"
          data-testid="bookmark-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      {/* Create bookmark form */}
      <div className="bookmark-panel__create" data-testid="bookmark-create-form">
        <input
          type="text"
          className="bookmark-panel__input"
          data-testid="bookmark-name-input"
          placeholder="Bookmark name"
          value={newBookmarkName}
          maxLength={MAX_NAME_LENGTH}
          aria-label="New bookmark name"
          onChange={(e) => {
            setNewBookmarkName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => handleKeyDown(e, handleCreate)}
        />
        <button
          type="button"
          className="bookmark-panel__create-btn"
          data-testid="bookmark-create-btn"
          aria-label="Create bookmark"
          onClick={handleCreate}
        >
          Add Bookmark
        </button>
      </div>

      {/* Bookmark list */}
      <ul className="bookmark-panel__list" data-testid="bookmark-list" role="list" aria-label="Bookmark list">
        {bookBookmarks.length === 0 && (
          <li className="bookmark-panel__empty" data-testid="bookmark-empty">
            No bookmarks yet.
          </li>
        )}
        {bookBookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="bookmark-panel__item"
            data-testid={`bookmark-item-${bookmark.id}`}
          >
            {editingId === bookmark.id ? (
              <div className="bookmark-panel__edit" data-testid="bookmark-edit-form">
                <input
                  type="text"
                  className="bookmark-panel__edit-input"
                  data-testid="bookmark-edit-input"
                  value={editName}
                  maxLength={MAX_NAME_LENGTH}
                  aria-label="Rename bookmark"
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, handleRenameConfirm)}
                  autoFocus
                />
                <button
                  type="button"
                  className="bookmark-panel__save-btn"
                  data-testid="bookmark-save-btn"
                  aria-label="Save bookmark name"
                  onClick={handleRenameConfirm}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="bookmark-panel__cancel-btn"
                  data-testid="bookmark-cancel-btn"
                  aria-label="Cancel rename"
                  onClick={handleRenameCancel}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="bookmark-panel__display">
                <button
                  type="button"
                  className="bookmark-panel__name"
                  data-testid={`bookmark-name-${bookmark.id}`}
                  aria-label={`Go to bookmark: ${bookmark.name}`}
                  onClick={() => onBookmarkSelect?.(bookmark)}
                >
                  {bookmark.name}
                </button>
                <div className="bookmark-panel__actions">
                  <button
                    type="button"
                    className="bookmark-panel__rename-btn"
                    data-testid={`bookmark-rename-${bookmark.id}`}
                    aria-label={`Rename bookmark: ${bookmark.name}`}
                    onClick={() => handleRenameStart(bookmark)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="bookmark-panel__delete-btn"
                    data-testid={`bookmark-delete-${bookmark.id}`}
                    aria-label={`Delete bookmark: ${bookmark.name}`}
                    onClick={() => handleDelete(bookmark.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BookmarkPanel;
