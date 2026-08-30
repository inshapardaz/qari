/**
 * BookmarkPanel Component — displays bookmark list with delete and
 * navigation capabilities. There's no create form here: a bookmark is
 * placed for the *current* page via the reader header's bookmark toggle
 * button (see `handleToggleBookmark` in Reader.tsx), which also fires this
 * same auto-naming convention (`t.bookmarkAutoName`) — a duplicate "add"
 * entry point here would just be a second, easier-to-miss way to do the
 * same thing, and unlike the header's toggle, it wouldn't guard against
 * bookmarking the same page twice.
 * Uses BookmarkStore and ChapterNavigator from ReaderContext.
 */

import React, { useState, useCallback } from 'react';
import { Button, ActionIcon, Alert, Title, Group } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations } from '../i18n';
import { getChapterCharCount } from '../services/chapter-navigator';
import type { Bookmark } from '../models/bookmark';
import type { PageChangeEvent } from '../models/events';

export interface BookmarkPanelProps {
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

const DEFAULT_CHARS_PER_PAGE = 1500;

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({
  onBookmarkSelect,
  onNavigate,
  onPageChange,
  charsPerPage = DEFAULT_CHARS_PER_PAGE,
}) => {
  const { state, bookmarkStore, chapterNavigator, removeBookmark, pagesPerChapter = [] } = useReaderContext();
  const t = useTranslations();
  const { bookmarks, book } = state;

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
      const measuredTotalPages = pagesPerChapter[chapterIdx];

      // 3. Calculate target page
      let targetPage: number;
      let effectivePosition: number;

      if (measuredTotalPages && chapterCharCount > 0) {
        // This chapter has already been measured for real (it's the one
        // currently open, or one visited earlier this session) — trust that
        // over the char-count heuristic below.
        //
        // Recovering the page via a plain `floor(position / charsPerPage)`
        // (position was encoded as `page * charsPerPage` at creation time)
        // is only exact as long as pagination hasn't changed since the
        // bookmark was created — but a later font-size, margin, or column
        // change reflows the *whole* chapter, so "page 5" can end up
        // covering a completely different, much smaller or larger, stretch
        // of text than it did before. Landing back on literally "page 5" of
        // the new layout would then miss the bookmarked passage entirely
        // (issue #21). Scaling `position` proportionally across the
        // chapter's real character count instead recovers approximately
        // the same *reading position* regardless of how pagination has
        // changed since — the same fix already applied to Notes/Search,
        // which anchor to a real DOM-text offset for the same reason.
        const clampedPosition = Math.min(bookmark.position, chapterCharCount);
        targetPage = Math.max(0, Math.min(
          Math.round((clampedPosition / chapterCharCount) * (measuredTotalPages - 1)),
          measuredTotalPages - 1
        ));
        effectivePosition = clampedPosition;
      } else if (bookmark.position > chapterCharCount) {
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
    [book, charsPerPage, pagesPerChapter, onNavigate, onPageChange, onBookmarkSelect]
  );

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
            <Group justify="space-between" wrap="nowrap" py="xs" gap="xs">
              <Button
                data-testid={`bookmark-name-${bookmark.id}`}
                aria-label={`Go to bookmark: ${bookmark.name}`}
                onClick={() => handleBookmarkClick(bookmark)}
                variant="subtle"
                justify="start"
                // A "subtle"-variant Button's text/hover otherwise come from
                // the (Mantine primary/brand) `--button-color`/`--button-hover`,
                // not the reading theme — this list is book content, so it
                // should read in the same colors as the rest of the reader.
                style={{
                  flex: 1,
                  color: 'var(--reader-fg, #1a1a1a)',
                  '--button-hover': 'var(--reader-surface, #f5f5f5)',
                } as React.CSSProperties}
              >
                {bookmark.name}
              </Button>
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
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BookmarkPanel;
