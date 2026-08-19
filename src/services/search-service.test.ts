import { describe, it, expect } from 'vitest';
import { Book, Chapter } from '../models/book';
import { searchBook } from './search-service';

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

function createBook(chapterTexts: string[]): Book {
  return {
    metadata: { title: 'Test Book' },
    chapters: chapterTexts.map((text, i) => createChapter(`ch-${i}`, `Chapter ${i + 1}`, i, text)),
  };
}

describe('searchBook', () => {
  it('returns an empty array for a blank query', () => {
    const book = createBook(['The quick brown fox']);
    expect(searchBook(book, '')).toEqual([]);
    expect(searchBook(book, '   ')).toEqual([]);
  });

  it('finds a single match with the correct chapter and offset', () => {
    const book = createBook(['The quick brown fox jumps over the lazy dog']);
    const results = searchBook(book, 'brown');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chapterIdx: 0,
      chapterId: 'ch-0',
      chapterTitle: 'Chapter 1',
      offset: 10,
    });
  });

  it('is case-insensitive', () => {
    const book = createBook(['The Quick Brown Fox']);
    const results = searchBook(book, 'brown');
    expect(results).toHaveLength(1);
    expect(results[0].offset).toBe(10);
  });

  it('finds multiple matches within one chapter, in order', () => {
    const book = createBook(['cat sat on the cat mat with a cat']);
    const results = searchBook(book, 'cat');

    expect(results.map(r => r.offset)).toEqual([0, 15, 30]);
    expect(results.map(r => r.occurrence)).toEqual([0, 1, 2]);
  });

  it('finds matches across multiple chapters, in reading order', () => {
    const book = createBook(['no match here', 'a needle in this chapter', 'another needle here']);
    const results = searchBook(book, 'needle');

    expect(results).toHaveLength(2);
    expect(results[0].chapterIdx).toBe(1);
    expect(results[1].chapterIdx).toBe(2);
  });

  it('resets occurrence per chapter rather than counting globally', () => {
    const book = createBook(['cat and cat', 'cat and cat and cat']);
    const results = searchBook(book, 'cat');

    expect(results.filter(r => r.chapterIdx === 0).map(r => r.occurrence)).toEqual([0, 1]);
    expect(results.filter(r => r.chapterIdx === 1).map(r => r.occurrence)).toEqual([0, 1, 2]);
  });

  it('does not match overlapping occurrences (advances past each match)', () => {
    const book = createBook(['aaaa']);
    const results = searchBook(book, 'aa');
    expect(results.map(r => r.offset)).toEqual([0, 2]);
  });

  it('builds a snippet around the match, bounded by contextChars', () => {
    const book = createBook(['0123456789needle0123456789']);
    const results = searchBook(book, 'needle', { contextChars: 5 });

    expect(results).toHaveLength(1);
    expect(results[0].snippet).toBe('56789needle01234');
    expect(results[0].snippetMatchStart).toBe(5);
    expect(results[0].snippetMatchEnd).toBe(11);
  });

  it('clamps the snippet at the start/end of the chapter text', () => {
    const book = createBook(['needle']);
    const results = searchBook(book, 'needle', { contextChars: 40 });

    expect(results[0].snippet).toBe('needle');
    expect(results[0].snippetMatchStart).toBe(0);
    expect(results[0].snippetMatchEnd).toBe(6);
  });

  it('caps the total number of results at maxResults across the whole book', () => {
    const book = createBook(['aaaaaaaaaa', 'aaaaaaaaaa']);
    const results = searchBook(book, 'a', { maxResults: 5 });
    expect(results).toHaveLength(5);
  });

  it('returns no results when the query is not found', () => {
    const book = createBook(['The quick brown fox']);
    expect(searchBook(book, 'zebra')).toEqual([]);
  });
});
