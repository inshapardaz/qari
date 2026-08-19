/**
 * SearchPanel Component — full-text search across the current book, with
 * a result list (chapter + snippet) that navigates to a match on click.
 * Search runs against `state.book` from ReaderContext; there's no store —
 * unlike bookmarks/notes, search results aren't persisted, just recomputed
 * from the live query.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Text, TextInput } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations, interpolate } from '../i18n';
import { getChapterCharCount } from '../services/chapter-navigator';
import { searchBook } from '../services/search-service';
import type { SearchResult } from '../services/search-service';
import type { PageChangeEvent } from '../models/events';
import { SearchIcon } from './icons';

export interface SearchPanelProps {
  /**
   * Called when navigation to a search result is requested.
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
// Recomputing the search on every keystroke is cheap for a typical book,
// but a large one could still make each keystroke visibly janky — this
// debounce keeps typing itself smooth without adding real latency to the
// result the user sees.
const DEBOUNCE_MS = 200;

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onNavigate,
  onPageChange,
  charsPerPage = DEFAULT_CHARS_PER_PAGE,
}) => {
  const { state } = useReaderContext();
  const t = useTranslations();
  const { book } = state;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(
    () => (book ? searchBook(book, debouncedQuery) : []),
    [book, debouncedQuery]
  );

  // Same char-offset -> page/progress approximation used by BookmarkPanel/
  // NotePanel, applied to a match's chapter-relative `offset` instead of a
  // bookmark's position or a note's startOffset.
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      if (!book) return;

      const chapter = book.chapters[result.chapterIdx];
      if (!chapter) return;
      const chapterCharCount = getChapterCharCount(chapter);

      let targetPage: number;
      let effectivePosition: number;

      if (result.offset > chapterCharCount) {
        const totalPagesInChapter = chapterCharCount === 0
          ? 1
          : Math.ceil(chapterCharCount / charsPerPage);
        targetPage = totalPagesInChapter - 1;
        effectivePosition = chapterCharCount;
      } else {
        targetPage = Math.floor(result.offset / charsPerPage);
        effectivePosition = result.offset;
      }

      let charsBeforeChapter = 0;
      let totalBookChars = 0;
      for (let i = 0; i < book.chapters.length; i++) {
        const charCount = getChapterCharCount(book.chapters[i]);
        if (i < result.chapterIdx) {
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

      if (onNavigate) {
        onNavigate(result.chapterIdx, targetPage, clampedProgress);
      }
      if (onPageChange) {
        onPageChange({ chapter: result.chapterIdx, page: targetPage, progress: clampedProgress });
      }
    },
    [book, charsPerPage, onNavigate, onPageChange]
  );

  return (
    <div className="search-panel" data-testid="search-panel" role="region" aria-label={t.searchPanelTitle}>
      <TextInput
        data-testid="search-input"
        aria-label={t.searchPanelTitle}
        placeholder={t.searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<SearchIcon size="1em" />}
        mb="sm"
        // A default-variant TextInput otherwise takes its background/text/
        // border/placeholder color from Mantine's own forced light/dark
        // colorScheme (see the reader root's own comment on this) rather
        // than the reading theme — this panel is book content, so it
        // should read in the same colors as the rest of the reader.
        style={{
          '--input-bg': 'var(--reader-surface, #f5f5f5)',
          '--input-color': 'var(--reader-fg, #1a1a1a)',
          '--input-bd': 'var(--reader-border, #e0e0e0)',
          '--input-placeholder-color': 'var(--reader-fg, #1a1a1a)',
        } as React.CSSProperties}
      />

      {debouncedQuery.trim() === '' ? (
        <Text data-testid="search-empty" size="sm" c="dimmed">
          {t.searchEmpty}
        </Text>
      ) : results.length === 0 ? (
        <Text data-testid="search-no-results" size="sm" c="dimmed">
          {interpolate(t.searchNoResults, { query: debouncedQuery.trim() })}
        </Text>
      ) : (
        <>
          <Text data-testid="search-results-count" size="xs" c="dimmed" mb="xs">
            {interpolate(t.searchResultsCount, { count: results.length })}
          </Text>
          <ul
            className="search-panel__list"
            data-testid="search-list"
            role="list"
            aria-label="Search results"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {results.map((result) => (
              <li
                key={result.id}
                className="search-panel__item"
                data-testid={`search-result-${result.id}`}
                style={{ borderBottom: '1px solid var(--reader-border, #e0e0e0)' }}
              >
                <Button
                  data-testid={`search-result-button-${result.id}`}
                  aria-label={`Go to result in ${result.chapterTitle}`}
                  onClick={() => handleResultClick(result)}
                  variant="subtle"
                  justify="start"
                  fullWidth
                  // Same theme-following override as BookmarkPanel/NotePanel's
                  // list buttons — see their own comment on this.
                  style={{
                    height: 'auto',
                    whiteSpace: 'normal',
                    textAlign: 'start',
                    color: 'var(--reader-fg, #1a1a1a)',
                    '--button-hover': 'var(--reader-surface, #f5f5f5)',
                  } as React.CSSProperties}
                >
                  <div>
                    <Text size="xs" c="dimmed" mb={2}>
                      {result.chapterTitle}
                    </Text>
                    <Text size="sm" style={{ wordBreak: 'break-word' }}>
                      {result.snippet.slice(0, result.snippetMatchStart)}
                      <mark style={{ backgroundColor: 'var(--reader-accent, #0071e3)', color: 'var(--reader-bg, #ffffff)' }}>
                        {result.snippet.slice(result.snippetMatchStart, result.snippetMatchEnd)}
                      </mark>
                      {result.snippet.slice(result.snippetMatchEnd)}
                    </Text>
                  </div>
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default SearchPanel;
