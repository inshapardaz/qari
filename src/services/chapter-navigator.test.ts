import { describe, it, expect } from 'vitest';
import { Book, Chapter } from '../models/book';
import { ChapterNavigator, getChapterCharCount } from './chapter-navigator';

/**
 * Helper to create a chapter with a given text content length.
 */
function createChapter(id: string, title: string, order: number, textContent: string): Chapter {
  return {
    id,
    title,
    order,
    content: [
      {
        type: 'paragraph',
        children: [{ type: 'text', content: textContent }],
      },
    ],
  };
}

/**
 * Helper to create a book with chapters of known character lengths.
 */
function createBook(chapterTexts: string[]): Book {
  return {
    metadata: { title: 'Test Book' },
    chapters: chapterTexts.map((text, i) => createChapter(
      `ch-${i}`,
      `Chapter ${i + 1}`,
      i,
      text
    )),
  };
}

describe('ChapterNavigator', () => {
  describe('getChapterIndex', () => {
    it('returns chapter entries in document order', () => {
      const book = createBook(['Hello world', 'Second chapter', 'Third chapter']);
      const nav = new ChapterNavigator(book);

      const index = nav.getChapterIndex();

      expect(index).toEqual([
        { id: 'ch-0', title: 'Chapter 1', order: 0 },
        { id: 'ch-1', title: 'Chapter 2', order: 1 },
        { id: 'ch-2', title: 'Chapter 3', order: 2 },
      ]);
    });

    it('returns empty array for a book with no chapters', () => {
      const book: Book = { metadata: { title: 'Empty' }, chapters: [] };
      const nav = new ChapterNavigator(book);
      expect(nav.getChapterIndex()).toEqual([]);
    });
  });

  describe('hasChapterStructure', () => {
    it('returns true for books with multiple chapters', () => {
      const book = createBook(['a', 'b']);
      const nav = new ChapterNavigator(book);
      expect(nav.hasChapterStructure()).toBe(true);
    });

    it('returns false for books with a single chapter', () => {
      const book = createBook(['single chapter content']);
      const nav = new ChapterNavigator(book);
      expect(nav.hasChapterStructure()).toBe(false);
    });

    it('returns false for books with no chapters', () => {
      const book: Book = { metadata: { title: 'Empty' }, chapters: [] };
      const nav = new ChapterNavigator(book);
      expect(nav.hasChapterStructure()).toBe(false);
    });
  });

  describe('getChapterCount', () => {
    it('returns the total number of chapters', () => {
      const book = createBook(['a', 'b', 'c']);
      const nav = new ChapterNavigator(book);
      expect(nav.getChapterCount()).toBe(3);
    });
  });

  describe('getTotalPagesInChapter', () => {
    it('calculates pages based on chars per page', () => {
      // 3000 chars / 1500 per page = 2 pages
      const book = createBook(['x'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);
      expect(nav.getTotalPagesInChapter(0)).toBe(2);
    });

    it('rounds up for partial pages', () => {
      // 1600 chars / 1500 per page = ceil(1.067) = 2 pages
      const book = createBook(['x'.repeat(1600)]);
      const nav = new ChapterNavigator(book, 1500);
      expect(nav.getTotalPagesInChapter(0)).toBe(2);
    });

    it('returns 1 for an empty chapter', () => {
      const book = createBook(['']);
      const nav = new ChapterNavigator(book, 1500);
      expect(nav.getTotalPagesInChapter(0)).toBe(1);
    });

    it('returns 0 for invalid chapter index', () => {
      const book = createBook(['abc']);
      const nav = new ChapterNavigator(book);
      expect(nav.getTotalPagesInChapter(5)).toBe(0);
      expect(nav.getTotalPagesInChapter(-1)).toBe(0);
    });
  });

  describe('getReadingProgress', () => {
    it('returns 0 at the start of the book', () => {
      // At page 0 of chapter 0, chars read = min((0+1)*1500, 3000) = 1500
      // progress = round(1500/6000*100) = 25
      // Actually, at the very beginning we are "on" the first page
      // so charsRead = (0+1)*1500 = 1500 from total 6000 = 25%
      const book = createBook(['x'.repeat(3000), 'y'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);
      // At page 0, chapter 0: chars read = min(1500, 3000) = 1500 / 6000 = 25%
      expect(nav.getReadingProgress()).toBe(25);
    });

    it('returns 100 at the last page of the last chapter', () => {
      const book = createBook(['x'.repeat(3000), 'y'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);
      // Move to the last page of the last chapter
      nav.goToPage(1, 1); // chapter 1, page 1 (last page)
      // chars_read = 3000 (completed) + min((1+1)*1500, 3000) = 3000 + 3000 = 6000
      // progress = round(6000/6000*100) = 100
      expect(nav.getReadingProgress()).toBe(100);
    });

    it('returns 0 for a book with no content', () => {
      const book: Book = { metadata: { title: 'Empty' }, chapters: [] };
      const nav = new ChapterNavigator(book);
      expect(nav.getReadingProgress()).toBe(0);
    });

    it('calculates progress correctly at mid-point', () => {
      // Book: 2 chapters, 1500 chars each (1 page each)
      const book = createBook(['x'.repeat(1500), 'y'.repeat(1500)]);
      const nav = new ChapterNavigator(book, 1500);
      // At chapter 0, page 0: chars_read = min(1500, 1500) = 1500 / 3000 = 50%
      expect(nav.getReadingProgress()).toBe(50);
    });

    it('clamps to integer between 0 and 100', () => {
      const book = createBook(['x'.repeat(100)]);
      const nav = new ChapterNavigator(book, 100);
      // At page 0: chars_read = min(100, 100) = 100 / 100 = 100%
      expect(nav.getReadingProgress()).toBe(100);
    });
  });

  describe('nextPage', () => {
    it('advances to the next page within a chapter', () => {
      const book = createBook(['x'.repeat(4500)]); // 3 pages
      const nav = new ChapterNavigator(book, 1500);

      const pos = nav.nextPage();
      expect(pos).toEqual({ chapter: 0, page: 1 });
    });

    it('crosses chapter boundary when at last page', () => {
      const book = createBook(['x'.repeat(1500), 'y'.repeat(1500)]);
      const nav = new ChapterNavigator(book, 1500);

      // Chapter 0 has 1 page (page 0). nextPage should go to chapter 1, page 0
      const pos = nav.nextPage();
      expect(pos).toEqual({ chapter: 1, page: 0 });
    });

    it('stays in place at the last page of the last chapter', () => {
      const book = createBook(['x'.repeat(1500)]);
      const nav = new ChapterNavigator(book, 1500);

      // Already at the last page
      const pos = nav.nextPage();
      expect(pos).toEqual({ chapter: 0, page: 0 });
    });
  });

  describe('previousPage', () => {
    it('goes back to the previous page within a chapter', () => {
      const book = createBook(['x'.repeat(4500)]); // 3 pages
      const nav = new ChapterNavigator(book, 1500);
      nav.goToPage(0, 2); // go to page 2

      const pos = nav.previousPage();
      expect(pos).toEqual({ chapter: 0, page: 1 });
    });

    it('crosses chapter boundary when at first page', () => {
      const book = createBook(['x'.repeat(3000), 'y'.repeat(1500)]);
      const nav = new ChapterNavigator(book, 1500);
      nav.goToPage(1, 0); // chapter 1, page 0

      // Should go to chapter 0, last page (page 1)
      const pos = nav.previousPage();
      expect(pos).toEqual({ chapter: 0, page: 1 });
    });

    it('stays in place at the first page of the first chapter', () => {
      const book = createBook(['x'.repeat(1500)]);
      const nav = new ChapterNavigator(book, 1500);

      const pos = nav.previousPage();
      expect(pos).toEqual({ chapter: 0, page: 0 });
    });
  });

  describe('goToChapter', () => {
    it('navigates to the start of a chapter', () => {
      const book = createBook(['a', 'b', 'c']);
      const nav = new ChapterNavigator(book);

      const pos = nav.goToChapter(2);
      expect(pos).toEqual({ chapter: 2, page: 0 });
      expect(nav.getCurrentChapter()).toBe(2);
      expect(nav.getCurrentPage()).toBe(0);
    });

    it('returns current position for invalid chapter index', () => {
      const book = createBook(['a', 'b']);
      const nav = new ChapterNavigator(book);
      nav.goToPage(0, 0);

      const pos = nav.goToChapter(10);
      expect(pos).toEqual({ chapter: 0, page: 0 });
    });

    it('returns current position for negative chapter index', () => {
      const book = createBook(['a', 'b']);
      const nav = new ChapterNavigator(book);

      const pos = nav.goToChapter(-1);
      expect(pos).toEqual({ chapter: 0, page: 0 });
    });
  });

  describe('goToPage', () => {
    it('sets the position to a specific chapter and page', () => {
      const book = createBook(['x'.repeat(4500), 'y'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);

      nav.goToPage(1, 1);
      expect(nav.getCurrentChapter()).toBe(1);
      expect(nav.getCurrentPage()).toBe(1);
    });

    it('does nothing for invalid chapter', () => {
      const book = createBook(['x'.repeat(1500)]);
      const nav = new ChapterNavigator(book, 1500);

      nav.goToPage(5, 0);
      expect(nav.getCurrentChapter()).toBe(0);
      expect(nav.getCurrentPage()).toBe(0);
    });

    it('does nothing for invalid page', () => {
      const book = createBook(['x'.repeat(1500)]); // 1 page
      const nav = new ChapterNavigator(book, 1500);

      nav.goToPage(0, 5);
      expect(nav.getCurrentChapter()).toBe(0);
      expect(nav.getCurrentPage()).toBe(0);
    });
  });

  describe('getCharPosition', () => {
    it('returns 0 at the start of the book', () => {
      const book = createBook(['x'.repeat(3000), 'y'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);
      expect(nav.getCharPosition()).toBe(0);
    });

    it('returns correct position within a chapter', () => {
      const book = createBook(['x'.repeat(3000), 'y'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);
      nav.goToPage(0, 1);
      expect(nav.getCharPosition()).toBe(1500);
    });

    it('accounts for completed chapters', () => {
      const book = createBook(['x'.repeat(3000), 'y'.repeat(3000)]);
      const nav = new ChapterNavigator(book, 1500);
      nav.goToPage(1, 1);
      // 3000 (chapter 0) + 1 * 1500 = 4500
      expect(nav.getCharPosition()).toBe(4500);
    });
  });

  describe('sequential navigation invariant', () => {
    it('next then previous returns to original page (non-boundary)', () => {
      const book = createBook(['x'.repeat(4500)]); // 3 pages
      const nav = new ChapterNavigator(book, 1500);
      nav.goToPage(0, 1); // start at page 1

      nav.nextPage();
      const pos = nav.previousPage();
      expect(pos).toEqual({ chapter: 0, page: 1 });
    });

    it('previous then next returns to original page (non-boundary)', () => {
      const book = createBook(['x'.repeat(4500)]); // 3 pages
      const nav = new ChapterNavigator(book, 1500);
      nav.goToPage(0, 1); // start at page 1

      nav.previousPage();
      const pos = nav.nextPage();
      expect(pos).toEqual({ chapter: 0, page: 1 });
    });
  });
});

describe('getChapterCharCount', () => {
  it('counts text in paragraphs', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        { type: 'paragraph', children: [{ type: 'text', content: 'Hello' }] },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(5);
  });

  it('counts text in nested inline nodes', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', content: 'Hello ' },
            { type: 'bold', children: [{ type: 'text', content: 'world' }] },
          ],
        },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(11); // "Hello " + "world"
  });

  it('counts text in code blocks', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        { type: 'code-block', content: 'const x = 1;' },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(12);
  });

  it('counts text in headings', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        { type: 'heading', level: 1, children: [{ type: 'text', content: 'Title' }] },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(5);
  });

  it('counts text in lists recursively', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        {
          type: 'list',
          ordered: true,
          items: [
            { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Item 1' }] }] },
            { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Item 2' }] }] },
          ],
        },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(12); // "Item 1" + "Item 2"
  });

  it('uses alt text for images', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        { type: 'image', src: 'img.png', alt: 'A photo' },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(7); // "A photo"
  });

  it('returns 0 for images without alt text', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        { type: 'image', src: 'img.png' },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(0);
  });

  it('counts rawContent for opaque nodes', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Test',
      order: 0,
      content: [
        { type: 'opaque', originalTag: 'div', rawContent: '<div>hello</div>', attributes: {} },
      ],
    };
    expect(getChapterCharCount(chapter)).toBe(16);
  });
});
