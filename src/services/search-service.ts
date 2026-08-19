/**
 * In-book text search. Matches are found against the same per-chapter
 * plain-text concatenation `getChapterCharCount` uses (each content node's
 * extracted text joined with no separator) — so a match's `offset` lands in
 * the exact same character-offset universe as `Bookmark.position`/
 * `Note.startOffset`, and SearchPanel can reuse the identical
 * offset-to-page approximation BookmarkPanel/NotePanel already use.
 */

import type { Book, Chapter } from '../models/book';
import { extractContentNodeText } from './chapter-navigator';

export interface SearchResult {
  /** Stable key: unique per chapter + match offset. */
  id: string;
  chapterIdx: number;
  chapterId: string;
  chapterTitle: string;
  /** Character offset of the match within the chapter's plain-text content. */
  offset: number;
  /** Text surrounding the match, for display. */
  snippet: string;
  /** Start/end offset of the matched query within `snippet`. */
  snippetMatchStart: number;
  snippetMatchEnd: number;
}

const DEFAULT_CONTEXT_CHARS = 40;
const DEFAULT_MAX_RESULTS = 200;

function chapterText(chapter: Chapter): string {
  let text = '';
  for (const node of chapter.content) {
    text += extractContentNodeText(node);
  }
  return text;
}

/**
 * Finds every occurrence of `query` (case-insensitive) across the book's
 * chapters, in reading order. Returns at most `maxResults` matches total —
 * a common short query (e.g. a single letter) against a large book could
 * otherwise produce an unbounded result set.
 */
export function searchBook(
  book: Book,
  query: string,
  options: { contextChars?: number; maxResults?: number } = {}
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const contextChars = options.contextChars ?? DEFAULT_CONTEXT_CHARS;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const needle = trimmed.toLocaleLowerCase();
  const results: SearchResult[] = [];

  outer: for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
    const chapter = book.chapters[chapterIdx];
    const text = chapterText(chapter);
    const haystack = text.toLocaleLowerCase();

    let fromIndex = 0;
    while (true) {
      const matchIndex = haystack.indexOf(needle, fromIndex);
      if (matchIndex === -1) break;

      const snippetStart = Math.max(0, matchIndex - contextChars);
      const snippetEnd = Math.min(text.length, matchIndex + needle.length + contextChars);
      results.push({
        id: `${chapter.id}-${matchIndex}`,
        chapterIdx,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        offset: matchIndex,
        snippet: text.slice(snippetStart, snippetEnd),
        snippetMatchStart: matchIndex - snippetStart,
        snippetMatchEnd: matchIndex - snippetStart + needle.length,
      });

      if (results.length >= maxResults) break outer;
      fromIndex = matchIndex + needle.length;
    }
  }

  return results;
}
