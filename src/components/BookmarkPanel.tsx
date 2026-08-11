/**
 * BookmarkPanel Component — displays bookmark list with create, rename, delete,
 * and navigation capabilities.
 * Uses BookmarkStore and ChapterNavigator from ReaderContext.
 */

import React, { useState, useCallback } from 'react';
import { TextInput, Button, ActionIcon, Alert, Title, Group } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations, interpolate } from '../i18n';
import { getChapterCharCount } from '../services/chapter-navigator';
import type { Bookmark } from '../models/bookmark';
import type { BookmarkEvent, PageChangeEvent } from '../models/events';

export interface BookmarkPanelProps {
  /** Called when a bookmark is created */
  onBookmarkCreate?: (event: BookmarkEvent) => void;
  /** Called when a bookmark is selected (navigate to it) */
  onBookmarkSelect?: (bookmark: Bookmark) => void;
  /**
   * Called when navigation to a bookmark is requested.
   * Provides the resolved chapter index, page number, and reading progress percentage.
   */
  onNavigate?: (chapterIdx: number, page: number, progress: number) => void;
  /**
   * Called when navigation completes with the standard PageChangeEvent.
   */
  onPageChange?: (event: PageChangeEvent) => void;
  /**
   * Characters per page used for pagination calculation.
   * Defaults to 1500 if not provided.
   */
  charsPerPage?: number;
}

const MAX_NAME_LENGTH = 100;
const DEFAULT_CHARS_PER_PAGE = 1500;

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({
  onBookmarkCreate,
  onBookmarkSelect,
  onNavigate,
  onPageChange,
  charsPerPage = DEFAULT_CHARS_PER_PAGE,
}) => {
  const { state, bookmarkStore, chapterNavigator, addBookmark, removeBookmark, updateBookmark } = useReaderContext();
  const t = useTranslations();
  const { bookmarks, book, currentChapter, currentPage } = state;

  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter bookmarks for the current book
  const currentBookId = book?.metadata.identifier || '';
  const bookBookmarks = bookmarks.filter((b) => b.bookId === currentBookId);

  /**
   * Handles clicking a bookmark to navigate to its position.
   * Implements the navigation algorithm from the design:
   * 1. Look up chapterId in book.chapters
   * 2. If chapter not found → show error, stay on current page
   * 3. Calculate target page: Math.floor(position / charsPerPage)
   * 4. If position > chapter char count → navigate to last page
   * 5. Update state via onNavigate callback
   * 6. Fire onPageChange callback with new position
   * 7. Recalculate reading progress
   */
  const handleBookmarkClick = useCallback(
    (bookmark: Bookmark) => {
      if (!book) {
        setError('No book is currently loaded.');
        return;
      }

      // 1. Look up chapterId in book.chapters
      const chapterIdx = book.chapters.findIndex((ch) => ch.id === bookmark.chapterId);

      // 2. If chapter not found → show error, stay on current page
      if (chapterIdx === -1) {
        setError('Bookmark target is invalid: chapter not found in current book.');
        return;
      }

      const chapter = book.chapters[chapterIdx];
      const chapterCharCount = getChapterCharCount(chapter);

      // 3. Calculate target page
      let targetPage: number;
      let effectivePosition: number;

      if (bookmark.position > chapterCharCount) {
        // 4. If position > chapter char count → navigate to last page
        const totalPagesInChapter = chapterCharCount === 0
          ? 1
          : Math.ceil(chapterCharCount / charsPerPage);
        targetPage = totalPagesInChapter - 1;
        effectivePosition = chapterCharCount;
      } else {
        targetPage = Math.floor(bookmark.position / charsPerPage);
        effectivePosition = bookmark.position;
      }

      // 7. Calculate reading progress
      // Progress = (charsBeforeChapter + min(position, chapterCharCount)) / totalBookChars * 100
      let charsBeforeChapter = 0;
      let totalBookChars = 0;
      for (let i = 0; i < book.chapters.length; i++) {
        const charCount = getChapterCharCount(book.chapters[i]);
        if (i < chapterIdx) {
          charsBeforeChapter += charCount;
        }
        totalBookChars += charCount;
      }

      const progress = totalBookChars > 0
        ? Math.round(
            ((charsBeforeChapter + Math.min(effectivePosition, chapterCharCount)) / totalBookChars) * 100
          )
        : 0;
      const clampedProgress = Math.max(0, Math.min(100, progress));

      // Clear any previous error
      setError(null);

      // 5. Update state via onNavigate callback
      if (onNavigate) {
        onNavigate(chapterIdx, targetPage, clampedProgress);
      }

      // 6. Fire onPageChange callback
      if (onPageChange) {
        onPageChange({
          chapter: chapterIdx,
          page: targetPage,
          progress: clampedProgress,
        });
      }

      // Also call the legacy onBookmarkSelect if provided
      if (onBookmarkSelect) {
        onBookmarkSelect(bookmark);
      }
    },
    [book, charsPerPage, onNavigate, onPageChange, onBookmarkSelect]
  );

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
    // A custom name is optional — leaving the field blank auto-names the
    // bookmark from where it actually is (chapter + page), rather than
    // requiring the user to type something just to place a bookmark.
    const trimmedName = newBookmarkName.trim();
    if (trimmedName) {
      const validationError = validateName(trimmedName);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!bookmarkStore || !book) {
      setError('Bookmark store not available.');
      return;
    }

    const chapterId = book.chapters[currentChapter]?.id || '';
    // Approximate char offset for the current page, inverting the
    // charsPerPage-based `position -> page` calculation used elsewhere in
    // this component (handleBookmarkClick) so navigating back to this
    // bookmark lands on the same page it was created from.
    const position = currentPage * charsPerPage;
    const name = trimmedName || interpolate(t.bookmarkAutoName, { chapter: currentChapter + 1, page: currentPage + 1 });

    try {
      const bookmark = await bookmarkStore.create(
        currentBookId,
        chapterId,
        position,
        name
      );

      addBookmark(bookmark);
      setNewBookmarkName('');
      setError(null);

      if (onBookmarkCreate) {
        onBookmarkCreate({ type: 'created', bookmark });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create bookmark.');
    }
  }, [newBookmarkName, bookmarkStore, book, currentChapter, currentPage, charsPerPage, currentBookId, onBookmarkCreate, addBookmark, t]);

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
      const renamed = await bookmarkStore.rename(editingId, editName.trim());
      updateBookmark(renamed);
      setEditingId(null);
      setEditName('');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename bookmark.');
    }
  }, [editingId, editName, bookmarkStore, updateBookmark]);

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
        removeBookmark(bookmarkId);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete bookmark.');
      }
    },
    [bookmarkStore, removeBookmark]
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
      <Title order={2} size="h4" mb="sm">{t.bookmarksPanelTitle}</Title>

      {/* Error display */}
      {error && (
        <Alert
          data-testid="bookmark-error"
          role="alert"
          aria-live="assertive"
          color="red"
          mb="sm"
        >
          {error}
        </Alert>
      )}

      {/* Create bookmark form */}
      <Group gap="xs" mb="sm" data-testid="bookmark-create-form" wrap="nowrap">
        <TextInput
          data-testid="bookmark-name-input"
          placeholder={t.bookmarkNamePlaceholder}
          value={newBookmarkName}
          maxLength={MAX_NAME_LENGTH}
          aria-label={t.bookmarkNewNameAriaLabel}
          onChange={(e) => {
            setNewBookmarkName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => handleKeyDown(e, handleCreate)}
          style={{ flex: 1 }}
        />
        <Button
          data-testid="bookmark-create-btn"
          aria-label={t.bookmarkCreateAriaLabel}
          onClick={handleCreate}
        >
          {t.bookmarkAdd}
        </Button>
      </Group>

      {/* Bookmark list */}
      <ul className="bookmark-panel__list" data-testid="bookmark-list" role="list" aria-label="Bookmark list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {bookBookmarks.length === 0 && (
          <li className="bookmark-panel__empty" data-testid="bookmark-empty">
            {t.bookmarksEmpty}
          </li>
        )}
        {bookBookmarks.map((bookmark) => (
          <li
            key={bookmark.id}
            className="bookmark-panel__item"
            data-testid={`bookmark-item-${bookmark.id}`}
          >
            {editingId === bookmark.id ? (
              <Group gap="xs" data-testid="bookmark-edit-form" wrap="nowrap" py="xs">
                <TextInput
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
                  style={{ flex: 1 }}
                />
                <Button
                  data-testid="bookmark-save-btn"
                  aria-label="Save bookmark name"
                  onClick={handleRenameConfirm}
                  size="xs"
                >
                  {t.bookmarkSave}
                </Button>
                <Button
                  data-testid="bookmark-cancel-btn"
                  aria-label="Cancel rename"
                  onClick={handleRenameCancel}
                  variant="subtle"
                  size="xs"
                >
                  {t.bookmarkCancel}
                </Button>
              </Group>
            ) : (
              <Group justify="space-between" wrap="nowrap" py="xs" gap="xs">
                <Button
                  data-testid={`bookmark-name-${bookmark.id}`}
                  aria-label={`Go to bookmark: ${bookmark.name}`}
                  onClick={() => handleBookmarkClick(bookmark)}
                  variant="subtle"
                  justify="start"
                  style={{ flex: 1 }}
                >
                  {bookmark.name}
                </Button>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon
                    data-testid={`bookmark-rename-${bookmark.id}`}
                    aria-label={`Rename bookmark: ${bookmark.name}`}
                    onClick={() => handleRenameStart(bookmark)}
                    variant="subtle"
                    size="sm"
                  >
                    ✎
                  </ActionIcon>
                  <ActionIcon
                    data-testid={`bookmark-delete-${bookmark.id}`}
                    aria-label={`Delete bookmark: ${bookmark.name}`}
                    onClick={() => handleDelete(bookmark.id)}
                    variant="subtle"
                    color="red"
                    size="sm"
                  >
                    ✕
                  </ActionIcon>
                </Group>
              </Group>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BookmarkPanel;
