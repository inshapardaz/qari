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
function extractContentNodeText(node: ContentNode): string {
  switch (node.type) {
    case 'paragraph':
      return extractInlineText(node.children);
    case 'heading':
      return extractInlineText(node.children);
    case 'image':
      return node.alt ?? '';
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
