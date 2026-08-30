import { Book, Chapter, ContentNode, InlineNode } from '../models/book';

/**
 * Represents a chapter entry in the table of contents.
 */
export interface ChapterEntry {
  id: string;
  title: string;
  order: number;
}

/**
 * Represents a navigation position within the book.
 */
export interface NavigationPosition {
  chapter: number;
  page: number;
}

/**
 * Extracts the text content from an array of InlineNode elements recursively.
 */
function extractInlineText(nodes: InlineNode[]): string {
  let text = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        text += node.content;
        break;
      case 'code':
        text += node.content;
        break;
      case 'bold':
      case 'italic':
      case 'link':
        text += extractInlineText(node.children);
        break;
    }
  }
  return text;
}

/**
 * Recursively extracts all text content from a ContentNode.
 */
export function extractContentNodeText(node: ContentNode): string {
  switch (node.type) {
    case 'paragraph':
      return extractInlineText(node.children);
    case 'heading':
      return extractInlineText(node.children);
    case 'image':
      return node.alt ?? '';
    case 'pdf-page':
      return '';
    case 'code-block':
      return node.content;
    case 'list':
      return node.items
        .map((item) => item.children.map(extractContentNodeText).join(''))
        .join('');
    case 'opaque':
      return node.rawContent;
  }
}

/**
 * Calculates the total character count of a chapter's content nodes.
 */
export function getChapterCharCount(chapter: Chapter): number {
  let count = 0;
  for (const node of chapter.content) {
    count += extractContentNodeText(node).length;
  }
  return count;
}

/**
 * Resolves a *real* chapter-relative character offset — a note's
 * `startOffset` or a search match's `offset`, both measured directly against
 * the rendered DOM text (see `utils/text-highlight.ts`) — to a page index.
 * Shared by NotePanel/SearchPanel's click-to-navigate handlers.
 *
 * Do not use this for bookmarks — see `resolveBookmarkPageIndex` below for
 * why they need a different (exact-index, not proportional) resolver.
 *
 * When `measuredTotalPages` is available (the chapter has actually been
 * rendered and measured for real this session — see `pagesPerChapter` in
 * Reader.tsx), `offset` is scaled *proportionally* across the chapter's real
 * character count rather than divided by a fixed `charsPerPage`: a fixed
 * assumption rarely matches how many characters actually fit on a rendered
 * page (depends on font size, margin, columns, viewport), and — critically —
 * doesn't survive a *later* layout change reflowing the whole chapter into a
 * different number of pages (issue #21). Proportional scaling recovers
 * approximately the same reading position regardless. This is sound
 * specifically *because* the input is a real offset — proportionally
 * rescaling a value that isn't (see `resolveBookmarkPageIndex`) recovers
 * nothing meaningful.
 *
 * Without a real measured total (the chapter hasn't been visited this
 * session), falls back to the simple `offset / charsPerPage` estimate — the
 * same heuristic used to resolve an initial reading-progress position before
 * any real measurement has run.
 */
export function resolveOffsetToPage(
  offset: number,
  chapterCharCount: number,
  measuredTotalPages: number | undefined,
  charsPerPage: number
): number {
  if (measuredTotalPages && chapterCharCount > 0) {
    const clampedOffset = Math.min(offset, chapterCharCount);
    return Math.max(0, Math.min(
      Math.round((clampedOffset / chapterCharCount) * (measuredTotalPages - 1)),
      measuredTotalPages - 1
    ));
  }
  if (offset > chapterCharCount) {
    const totalPagesInChapter = chapterCharCount === 0
      ? 1
      : Math.ceil(chapterCharCount / charsPerPage);
    return totalPagesInChapter - 1;
  }
  return Math.floor(offset / charsPerPage);
}

/**
 * Resolves a bookmark's `position` to a page index. Shared by
 * `BookmarkPanel`'s click-to-navigate handler and Reader's own "is the
 * current page bookmarked" toggle-button check, so the two always agree — a
 * bookmark that resolves to page 5 when clicked also lights up the toggle
 * button on page 5, never some other page.
 *
 * Unlike notes/search (`resolveOffsetToPage`), a bookmark's `position` is
 * *not* a real character offset — it's recorded as `page * charsPerPage` at
 * creation time (see `handleToggleBookmark` in Reader.tsx), using whatever
 * page the reader really was on. Recovering that exact page back via a
 * plain `floor(position / charsPerPage)` is therefore *exact* as long as
 * pagination hasn't changed since, which is what makes the toggle-button
 * check reliable in the overwhelmingly common case: checking whether the
 * page you're on *right now*, in the *same reading session*, is the one you
 * just bookmarked. (Proportionally rescaling this value the way
 * `resolveOffsetToPage` does for real offsets was tried and reverted — the
 * position isn't a fraction of the chapter's real character count, so
 * treating it as one produces a *different* page even with no layout change
 * at all whenever the chapter's real characters-per-page differs from the
 * fixed `charsPerPage` assumption, which is almost always — surfacing as
 * the toggle never recognizing its own just-created bookmark and letting
 * the user create several more on repeated clicks.) The trade-off is that a
 * bookmark can still land on a different-but-nearby page after a later
 * font-size/margin/column change reflows the chapter — a real limitation,
 * but a far less common and less confusing one than breaking same-session
 * identification entirely.
 *
 * `measuredTotalPages`, when available, only clamps the recovered index
 * down to a valid page for the chapter's *current* real measurement (e.g. if
 * the chapter got shorter since) — it does not attempt to rescale the
 * position itself.
 */
export function resolveBookmarkPageIndex(
  position: number,
  chapterCharCount: number,
  measuredTotalPages: number | undefined,
  charsPerPage: number
): number {
  const exactPage = Math.floor(position / charsPerPage);
  if (measuredTotalPages) {
    return Math.max(0, Math.min(exactPage, measuredTotalPages - 1));
  }
  if (position > chapterCharCount) {
    const totalPagesInChapter = chapterCharCount === 0
      ? 1
      : Math.ceil(chapterCharCount / charsPerPage);
    return totalPagesInChapter - 1;
  }
  return exactPage;
}

/**
 * ChapterNavigator provides chapter-based navigation and reading progress
 * calculation for a Book instance.
 *
 * It supports:
 * - Extracting a chapter index (table of contents)
 * - Detecting books with no identifiable chapter structure
 * - Calculating reading progress as an integer percentage (0-100)
 * - Next/previous page navigation within and across chapters
 * - Direct chapter navigation
 */
export class ChapterNavigator {
  private readonly book: Book;
  private readonly charsPerPage: number;
  private readonly chapterCharCounts: number[];
  private readonly totalChars: number;

  private currentChapterIndex: number = 0;
  private currentPageIndex: number = 0;

  /**
   * @param book - The Book to navigate
   * @param charsPerPage - Characters per page (default ~1500)
   */
  constructor(book: Book, charsPerPage: number = 1500) {
    this.book = book;
    this.charsPerPage = charsPerPage;

    // Pre-compute character counts per chapter
    this.chapterCharCounts = book.chapters.map(getChapterCharCount);
    this.totalChars = this.chapterCharCounts.reduce((sum, c) => sum + c, 0);
  }

  /**
   * Returns the chapter index (table of contents) listing all chapters
   * by title in document order.
   */
  getChapterIndex(): ChapterEntry[] {
    return this.book.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      order: chapter.order,
    }));
  }

  /**
   * Returns false if the book has only 1 chapter (no identifiable chapter structure).
   * When false, the TOC panel should be hidden.
   */
  hasChapterStructure(): boolean {
    return this.book.chapters.length > 1;
  }

  /**
   * Returns the total number of chapters in the book.
   */
  getChapterCount(): number {
    return this.book.chapters.length;
  }

  /**
   * Returns the current chapter index (0-based).
   */
  getCurrentChapter(): number {
    return this.currentChapterIndex;
  }

  /**
   * Returns the current page index within the current chapter (0-based).
   */
  getCurrentPage(): number {
    return this.currentPageIndex;
  }

  /**
   * Returns the total number of pages in a given chapter.
   * A chapter with 0 characters still has 1 page.
   */
  getTotalPagesInChapter(chapterIndex: number): number {
    if (chapterIndex < 0 || chapterIndex >= this.book.chapters.length) {
      return 0;
    }
    const charCount = this.chapterCharCounts[chapterIndex];
    if (charCount === 0) {
      return 1;
    }
    return Math.ceil(charCount / this.charsPerPage);
  }

  /**
   * Calculates reading progress as an integer percentage (0-100).
   * Progress = round(characters_read / total_characters × 100)
   * Characters_read = sum of all chars in completed chapters + chars in current chapter up to current page.
   */
  getReadingProgress(): number {
    if (this.totalChars === 0) {
      return 0;
    }

    // Sum chars from all completed chapters
    let charsRead = 0;
    for (let i = 0; i < this.currentChapterIndex; i++) {
      charsRead += this.chapterCharCounts[i];
    }

    // Add chars from current chapter up to current page
    const currentChapterChars = this.chapterCharCounts[this.currentChapterIndex] ?? 0;
    const charsInCurrentPage = Math.min(
      (this.currentPageIndex + 1) * this.charsPerPage,
      currentChapterChars
    );
    charsRead += charsInCurrentPage;

    const progress = Math.round((charsRead / this.totalChars) * 100);
    return Math.max(0, Math.min(100, progress));
  }

  /**
   * Advances to the next page. If at the last page of a chapter,
   * crosses to the first page of the next chapter.
   * Returns the new navigation position.
   */
  nextPage(): NavigationPosition {
    const totalPages = this.getTotalPagesInChapter(this.currentChapterIndex);

    if (this.currentPageIndex < totalPages - 1) {
      // Move to next page within the current chapter
      this.currentPageIndex++;
    } else if (this.currentChapterIndex < this.book.chapters.length - 1) {
      // Cross chapter boundary to the next chapter
      this.currentChapterIndex++;
      this.currentPageIndex = 0;
    }
    // If at the very last page of the last chapter, stay in place

    return {
      chapter: this.currentChapterIndex,
      page: this.currentPageIndex,
    };
  }

  /**
   * Goes back to the previous page. If at the first page of a chapter,
   * crosses to the last page of the preceding chapter.
   * Returns the new navigation position.
   */
  previousPage(): NavigationPosition {
    if (this.currentPageIndex > 0) {
      // Move to previous page within the current chapter
      this.currentPageIndex--;
    } else if (this.currentChapterIndex > 0) {
      // Cross chapter boundary to the preceding chapter
      this.currentChapterIndex--;
      this.currentPageIndex = this.getTotalPagesInChapter(this.currentChapterIndex) - 1;
    }
    // If at the very first page of the first chapter, stay in place

    return {
      chapter: this.currentChapterIndex,
      page: this.currentPageIndex,
    };
  }

  /**
   * Navigates to the start of a specified chapter.
   * Returns the new navigation position.
   */
  goToChapter(chapterIndex: number): NavigationPosition {
    if (chapterIndex < 0 || chapterIndex >= this.book.chapters.length) {
      // Invalid chapter index — stay at current position
      return {
        chapter: this.currentChapterIndex,
        page: this.currentPageIndex,
      };
    }

    this.currentChapterIndex = chapterIndex;
    this.currentPageIndex = 0;

    return {
      chapter: this.currentChapterIndex,
      page: this.currentPageIndex,
    };
  }

  /**
   * Sets the navigator to a specific chapter and page position.
   */
  goToPage(chapter: number, page: number): void {
    if (chapter < 0 || chapter >= this.book.chapters.length) {
      return;
    }

    const totalPages = this.getTotalPagesInChapter(chapter);
    if (page < 0 || page >= totalPages) {
      return;
    }

    this.currentChapterIndex = chapter;
    this.currentPageIndex = page;
  }

  /**
   * Returns the current character offset from the start of the book.
   */
  getCharPosition(): number {
    let position = 0;
    for (let i = 0; i < this.currentChapterIndex; i++) {
      position += this.chapterCharCounts[i];
    }
    position += this.currentPageIndex * this.charsPerPage;
    return position;
  }
}
