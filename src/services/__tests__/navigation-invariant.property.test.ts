/**
 * Property 8: Sequential Page Navigation Invariant
 *
 * For any book with multiple chapters and any valid reading position,
 * the sequence of (next, previous) from any non-boundary page SHALL
 * return to the original page. At chapter boundaries: last page + next
 * = first page of next chapter, and first page + previous = last page
 * of preceding chapter.
 *
 * **Validates: Requirements 5.4, 5.5, 5.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChapterNavigator } from '../chapter-navigator';
import { Book, Chapter, ParagraphNode, TextSpan } from '../../models/book';

// --- Generators ---

/**
 * Creates a chapter with a specified character count by generating
 * paragraph nodes with text content of the desired length.
 */
function createChapter(id: string, title: string, order: number, charCount: number): Chapter {
  const content: ParagraphNode[] = [];
  if (charCount > 0) {
    const textNode: TextSpan = { type: 'text', content: 'x'.repeat(charCount) };
    const paragraph: ParagraphNode = { type: 'paragraph', children: [textNode] };
    content.push(paragraph);
  }
  return { id, title, order, content };
}

/**
 * Generates a book with multiple chapters of varying sizes.
 * Each chapter has between 100 and 5000 characters (ensuring multiple pages).
 */
const bookArb = fc
  .record({
    chapterCount: fc.integer({ min: 2, max: 6 }),
    chapterSizes: fc.array(fc.integer({ min: 100, max: 5000 }), { minLength: 2, maxLength: 6 }),
  })
  .map(({ chapterCount, chapterSizes }) => {
    const sizes = chapterSizes.slice(0, chapterCount);
    // Ensure we have enough sizes
    while (sizes.length < chapterCount) {
      sizes.push(1500);
    }

    const chapters: Chapter[] = sizes.map((size, i) => createChapter(`ch-${i}`, `Chapter ${i + 1}`, i, size));

    const book: Book = {
      metadata: { title: 'Test Book' },
      chapters,
    };
    return book;
  });

/**
 * Generates a valid position (chapter index, page index) for a given book.
 */
function positionArb(book: Book, charsPerPage: number) {
  const chapterIndex = fc.integer({ min: 0, max: book.chapters.length - 1 });
  return chapterIndex.chain((chIdx) => {
    const charCount = book.chapters[chIdx].content.reduce((acc, node) => {
      if (node.type === 'paragraph') {
        return acc + node.children.reduce((s, n) => s + (n.type === 'text' ? n.content.length : 0), 0);
      }
      return acc;
    }, 0);
    const totalPages = charCount === 0 ? 1 : Math.ceil(charCount / charsPerPage);
    const pageIndex = fc.integer({ min: 0, max: totalPages - 1 });
    return pageIndex.map((pIdx) => ({ chapter: chIdx, page: pIdx }));
  });
}

// --- Tests ---

describe('Property 8: Sequential Page Navigation Invariant', () => {
  const CHARS_PER_PAGE = 1500;

  it('nextPage then previousPage returns to original for non-boundary pages', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const nav = new ChapterNavigator(book, CHARS_PER_PAGE);

        // Find a non-boundary page: not the last page of any chapter
        // and not the last page of the last chapter
        for (let chIdx = 0; chIdx < book.chapters.length; chIdx++) {
          const totalPages = nav.getTotalPagesInChapter(chIdx);
          // Test pages that are NOT the last page in the chapter (non-boundary)
          for (let pIdx = 0; pIdx < totalPages - 1; pIdx++) {
            nav.goToPage(chIdx, pIdx);

            const originalChapter = nav.getCurrentChapter();
            const originalPage = nav.getCurrentPage();

            nav.nextPage();
            nav.previousPage();

            expect(nav.getCurrentChapter()).toBe(originalChapter);
            expect(nav.getCurrentPage()).toBe(originalPage);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('previousPage then nextPage returns to original for non-boundary pages', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const nav = new ChapterNavigator(book, CHARS_PER_PAGE);

        // Find a non-boundary page: not the first page of any chapter
        for (let chIdx = 0; chIdx < book.chapters.length; chIdx++) {
          const totalPages = nav.getTotalPagesInChapter(chIdx);
          // Test pages that are NOT the first page in the chapter (non-boundary)
          for (let pIdx = 1; pIdx < totalPages; pIdx++) {
            nav.goToPage(chIdx, pIdx);

            const originalChapter = nav.getCurrentChapter();
            const originalPage = nav.getCurrentPage();

            nav.previousPage();
            nav.nextPage();

            expect(nav.getCurrentChapter()).toBe(originalChapter);
            expect(nav.getCurrentPage()).toBe(originalPage);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('last page of chapter + next = first page of next chapter', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const nav = new ChapterNavigator(book, CHARS_PER_PAGE);

        // For each chapter except the last, verify boundary transition
        for (let chIdx = 0; chIdx < book.chapters.length - 1; chIdx++) {
          const totalPages = nav.getTotalPagesInChapter(chIdx);
          // Go to the last page of this chapter
          nav.goToPage(chIdx, totalPages - 1);

          expect(nav.getCurrentChapter()).toBe(chIdx);
          expect(nav.getCurrentPage()).toBe(totalPages - 1);

          // Next should advance to first page of next chapter
          const pos = nav.nextPage();

          expect(pos.chapter).toBe(chIdx + 1);
          expect(pos.page).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('first page of chapter + previous = last page of preceding chapter', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const nav = new ChapterNavigator(book, CHARS_PER_PAGE);

        // For each chapter except the first, verify boundary transition
        for (let chIdx = 1; chIdx < book.chapters.length; chIdx++) {
          // Go to the first page of this chapter
          nav.goToPage(chIdx, 0);

          expect(nav.getCurrentChapter()).toBe(chIdx);
          expect(nav.getCurrentPage()).toBe(0);

          // Previous should go to last page of preceding chapter
          const pos = nav.previousPage();
          const prevChapterTotalPages = nav.getTotalPagesInChapter(chIdx - 1);

          expect(pos.chapter).toBe(chIdx - 1);
          expect(pos.page).toBe(prevChapterTotalPages - 1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('at first page of first chapter, previousPage stays in place', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const nav = new ChapterNavigator(book, CHARS_PER_PAGE);

        nav.goToPage(0, 0);
        const pos = nav.previousPage();

        expect(pos.chapter).toBe(0);
        expect(pos.page).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('at last page of last chapter, nextPage stays in place', () => {
    fc.assert(
      fc.property(bookArb, (book) => {
        const nav = new ChapterNavigator(book, CHARS_PER_PAGE);

        const lastChapter = book.chapters.length - 1;
        const lastPage = nav.getTotalPagesInChapter(lastChapter) - 1;

        nav.goToPage(lastChapter, lastPage);
        const pos = nav.nextPage();

        expect(pos.chapter).toBe(lastChapter);
        expect(pos.page).toBe(lastPage);
      }),
      { numRuns: 100 }
    );
  });
});
