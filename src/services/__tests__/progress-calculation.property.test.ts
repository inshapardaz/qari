/**
 * Property 9: Reading Progress Calculation
 *
 * For any book and any character position within that book, the displayed
 * reading progress SHALL equal round(characters_read / total_characters × 100),
 * yielding an integer percentage from 0 to 100.
 *
 * **Validates: Requirements 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChapterNavigator, getChapterCharCount } from '../chapter-navigator';
import { Book, Chapter, ParagraphNode } from '../../models/book';

// --- Helpers ---

/**
 * Creates a chapter with a single paragraph containing text of the given length.
 */
function createChapterWithLength(id: string, title: string, order: number, charCount: number): Chapter {
  const content: ParagraphNode[] = [];
  if (charCount > 0) {
    content.push({
      type: 'paragraph',
      children: [{ type: 'text', content: 'a'.repeat(charCount) }],
    });
  }
  return { id, title, order, content };
}

/**
 * Creates a Book with chapters of specified character counts.
 */
function createBookWithChapterSizes(chapterSizes: number[]): Book {
  return {
    metadata: { title: 'Test Book' },
    chapters: chapterSizes.map((size, i) => createChapterWithLength(
      `ch-${i}`,
      `Chapter ${i + 1}`,
      i,
      size
    )),
  };
}

// --- Generators ---

/**
 * Generates an array of chapter sizes (character counts).
 * At least 1 chapter, each with 1-5000 characters.
 */
const chapterSizesArb = fc.array(
  fc.integer({ min: 1, max: 5000 }),
  { minLength: 1, maxLength: 10 }
);

/**
 * Generates a valid charsPerPage value.
 */
const charsPerPageArb = fc.integer({ min: 100, max: 3000 });

// --- Tests ---

describe('Property 9: Reading Progress Calculation', () => {
  it('progress equals round(chars_read / total_chars × 100) for any valid position', () => {
    fc.assert(
      fc.property(
        chapterSizesArb,
        charsPerPageArb,
        fc.integer({ min: 0, max: 1000 }),
        (chapterSizes, charsPerPage, positionSeed) => {
          const book = createBookWithChapterSizes(chapterSizes);
          const navigator = new ChapterNavigator(book, charsPerPage);

          const totalChapters = chapterSizes.length;
          // Pick a random chapter
          const chapterIndex = positionSeed % totalChapters;
          // Navigate to that chapter
          navigator.goToChapter(chapterIndex);

          // Determine valid pages within this chapter
          const totalPagesInChapter = navigator.getTotalPagesInChapter(chapterIndex);
          const pageIndex = positionSeed % totalPagesInChapter;
          navigator.goToPage(chapterIndex, pageIndex);

          // Calculate expected progress
          const totalChars = chapterSizes.reduce((sum, s) => sum + s, 0);
          let charsRead = 0;
          // Sum chars from all completed chapters
          for (let i = 0; i < chapterIndex; i++) {
            charsRead += chapterSizes[i];
          }
          // Add chars from current chapter up to current page
          const currentChapterChars = chapterSizes[chapterIndex];
          const charsInCurrentPage = Math.min(
            (pageIndex + 1) * charsPerPage,
            currentChapterChars
          );
          charsRead += charsInCurrentPage;

          const expectedProgress = Math.round((charsRead / totalChars) * 100);
          const clampedExpected = Math.max(0, Math.min(100, expectedProgress));

          const actualProgress = navigator.getReadingProgress();

          expect(actualProgress).toBe(clampedExpected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress is always an integer between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(
        chapterSizesArb,
        charsPerPageArb,
        fc.integer({ min: 0, max: 10000 }),
        (chapterSizes, charsPerPage, navigationSteps) => {
          const book = createBookWithChapterSizes(chapterSizes);
          const navigator = new ChapterNavigator(book, charsPerPage);

          // Navigate forward a random number of steps
          const steps = navigationSteps % 50;
          for (let i = 0; i < steps; i++) {
            navigator.nextPage();
          }

          const progress = navigator.getReadingProgress();

          expect(Number.isInteger(progress)).toBe(true);
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress at the start of the book is greater than or equal to 0', () => {
    fc.assert(
      fc.property(
        chapterSizesArb,
        charsPerPageArb,
        (chapterSizes, charsPerPage) => {
          const book = createBookWithChapterSizes(chapterSizes);
          const navigator = new ChapterNavigator(book, charsPerPage);

          // At the very start (chapter 0, page 0)
          const progress = navigator.getReadingProgress();

          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress is non-decreasing as we navigate forward', () => {
    fc.assert(
      fc.property(
        chapterSizesArb,
        charsPerPageArb,
        (chapterSizes, charsPerPage) => {
          const book = createBookWithChapterSizes(chapterSizes);
          const navigator = new ChapterNavigator(book, charsPerPage);

          let prevProgress = navigator.getReadingProgress();

          // Navigate forward through the entire book
          const maxSteps = chapterSizes.reduce((sum, s) => sum + Math.ceil(s / charsPerPage), 0);
          for (let i = 0; i < maxSteps; i++) {
            navigator.nextPage();
            const currentProgress = navigator.getReadingProgress();
            expect(currentProgress).toBeGreaterThanOrEqual(prevProgress);
            prevProgress = currentProgress;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress at the last page of the last chapter equals 100', () => {
    fc.assert(
      fc.property(
        chapterSizesArb,
        charsPerPageArb,
        (chapterSizes, charsPerPage) => {
          const book = createBookWithChapterSizes(chapterSizes);
          const navigator = new ChapterNavigator(book, charsPerPage);

          // Navigate to the last chapter, last page
          const lastChapter = chapterSizes.length - 1;
          navigator.goToChapter(lastChapter);
          const totalPages = navigator.getTotalPagesInChapter(lastChapter);
          navigator.goToPage(lastChapter, totalPages - 1);

          const progress = navigator.getReadingProgress();
          expect(progress).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress for a book with all empty chapters is 0', () => {
    // Edge case: book with chapters that have 0 characters
    const emptySizesArb = fc.array(
      fc.constant(0),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(emptySizesArb, (sizes) => {
        const book = createBookWithChapterSizes(sizes);
        const navigator = new ChapterNavigator(book, 1500);

        const progress = navigator.getReadingProgress();
        expect(progress).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
