import { describe, it, expect } from 'vitest';
import { MarkdownParserImpl } from './markdown-parser';
import type { Book, ParagraphNode, HeadingNode, CodeBlockNode, ImageNode, ListNode } from '../models/book';

describe('MarkdownParser', () => {
  const parser = new MarkdownParserImpl();

  describe('title extraction', () => {
    it('extracts H1 as book title', () => {
      const md = '# My Book\n\n## Chapter 1\n\nSome text.';
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('My Book');
    });

    it('defaults to "Untitled" when no H1 present', () => {
      const md = '## Chapter 1\n\nSome text.';
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('Untitled');
    });
  });

  describe('chapter splitting', () => {
    it('creates chapters from H2 headings', () => {
      const md = '# Book Title\n\n## Intro\n\nHello.\n\n## Part Two\n\nWorld.';
      const book = parser.parse(md);
      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[0].title).toBe('Intro');
      expect(book.chapters[1].title).toBe('Part Two');
    });

    it('assigns sequential chapter IDs', () => {
      const md = '# Title\n\n## A\n\nText.\n\n## B\n\nText.\n\n## C\n\nText.';
      const book = parser.parse(md);
      expect(book.chapters[0].id).toBe('chapter-0');
      expect(book.chapters[1].id).toBe('chapter-1');
      expect(book.chapters[2].id).toBe('chapter-2');
    });

    it('assigns correct order values', () => {
      const md = '# Title\n\n## A\n\nText.\n\n## B\n\nText.';
      const book = parser.parse(md);
      expect(book.chapters[0].order).toBe(0);
      expect(book.chapters[1].order).toBe(1);
    });

    it('creates single chapter when no H2 headings exist', () => {
      const md = '# My Document\n\nSome content here.\n\nAnother paragraph.';
      const book = parser.parse(md);
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('My Document');
      expect(book.chapters[0].id).toBe('chapter-0');
    });

    it('uses "Untitled" for single chapter when no H1 either', () => {
      const md = 'Just plain text without any headings.';
      const book = parser.parse(md);
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('Untitled');
    });
  });

  describe('paragraphs and inline formatting', () => {
    it('parses plain paragraphs', () => {
      const md = '# Title\n\n## Ch1\n\nHello world.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;
      expect(para.type).toBe('paragraph');
      expect(para.children).toHaveLength(1);
      expect(para.children[0]).toEqual({ type: 'text', content: 'Hello world.' });
    });

    it('parses bold text', () => {
      const md = '# T\n\n## C\n\nThis is **bold** text.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'bold', children: [{ type: 'text', content: 'bold' }] },
        { type: 'text', content: ' text.' },
      ]);
    });

    it('parses italic text', () => {
      const md = '# T\n\n## C\n\nThis is *italic* text.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'italic', children: [{ type: 'text', content: 'italic' }] },
        { type: 'text', content: ' text.' },
      ]);
    });

    it('parses inline code', () => {
      const md = '# T\n\n## C\n\nUse `console.log` here.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'Use ' },
        { type: 'code', content: 'console.log' },
        { type: 'text', content: ' here.' },
      ]);
    });

    it('parses links', () => {
      const md = '# T\n\n## C\n\nVisit [Google](https://google.com) now.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'Visit ' },
        { type: 'link', href: 'https://google.com', children: [{ type: 'text', content: 'Google' }] },
        { type: 'text', content: ' now.' },
      ]);
    });

    it('parses nested bold inside italic', () => {
      const md = '# T\n\n## C\n\n*italic and **bold***';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;
      expect(para.children[0].type).toBe('italic');
    });
  });

  describe('images', () => {
    it('parses standalone images as ImageNode', () => {
      const md = '# T\n\n## C\n\n![Alt text](image.png)';
      const book = parser.parse(md);
      const img = book.chapters[0].content[0] as ImageNode;
      expect(img.type).toBe('image');
      expect(img.src).toBe('image.png');
      expect(img.alt).toBe('Alt text');
    });

    it('handles image with empty alt text', () => {
      const md = '# T\n\n## C\n\n![](photo.jpg)';
      const book = parser.parse(md);
      const img = book.chapters[0].content[0] as ImageNode;
      expect(img.type).toBe('image');
      expect(img.src).toBe('photo.jpg');
      expect(img.alt).toBeUndefined();
    });
  });

  describe('code blocks', () => {
    it('parses fenced code blocks with language', () => {
      const md = '# T\n\n## C\n\n```typescript\nconst x = 1;\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[0] as CodeBlockNode;
      expect(code.type).toBe('code-block');
      expect(code.language).toBe('typescript');
      expect(code.content).toBe('const x = 1;\n');
    });

    it('parses fenced code blocks without language', () => {
      const md = '# T\n\n## C\n\n```\nhello\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[0] as CodeBlockNode;
      expect(code.type).toBe('code-block');
      expect(code.language).toBeUndefined();
      expect(code.content).toBe('hello\n');
    });
  });

  describe('lists', () => {
    it('parses unordered lists', () => {
      const md = '# T\n\n## C\n\n- Item 1\n- Item 2\n- Item 3';
      const book = parser.parse(md);
      const list = book.chapters[0].content[0] as ListNode;
      expect(list.type).toBe('list');
      expect(list.ordered).toBe(false);
      expect(list.items).toHaveLength(3);
    });

    it('parses ordered lists', () => {
      const md = '# T\n\n## C\n\n1. First\n2. Second\n3. Third';
      const book = parser.parse(md);
      const list = book.chapters[0].content[0] as ListNode;
      expect(list.type).toBe('list');
      expect(list.ordered).toBe(true);
      expect(list.items).toHaveLength(3);
    });

    it('parses list items with inline formatting', () => {
      const md = '# T\n\n## C\n\n- **bold item**\n- *italic item*';
      const book = parser.parse(md);
      const list = book.chapters[0].content[0] as ListNode;
      const firstItemPara = list.items[0].children[0] as ParagraphNode;
      expect(firstItemPara.type).toBe('paragraph');
      expect(firstItemPara.children[0].type).toBe('bold');
    });
  });

  describe('headings within chapters', () => {
    it('maps H3-H6 headings as HeadingNode within chapter content', () => {
      const md = '# Title\n\n## Chapter\n\n### Subsection\n\nText.\n\n#### Deep section';
      const book = parser.parse(md);
      const h3 = book.chapters[0].content[0] as HeadingNode;
      expect(h3.type).toBe('heading');
      expect(h3.level).toBe(3);
      expect(h3.children).toEqual([{ type: 'text', content: 'Subsection' }]);
    });
  });

  describe('complex documents', () => {
    it('parses a multi-chapter document correctly', () => {
      const md = `# My Book

## Introduction

Welcome to **my book**. It covers many topics.

## Chapter 1: Basics

Here is some \`code\` and a [link](https://example.com).

\`\`\`javascript
function hello() {
  return "world";
}
\`\`\`

## Chapter 2: Advanced

- Item A
- Item B

![Diagram](fig1.png)
`;
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('My Book');
      expect(book.chapters).toHaveLength(3);
      expect(book.chapters[0].title).toBe('Introduction');
      expect(book.chapters[1].title).toBe('Chapter 1: Basics');
      expect(book.chapters[2].title).toBe('Chapter 2: Advanced');

      // Chapter 1 has paragraph + code block
      expect(book.chapters[1].content[0].type).toBe('paragraph');
      expect(book.chapters[1].content[1].type).toBe('code-block');

      // Chapter 2 has list + image
      expect(book.chapters[2].content[0].type).toBe('list');
      expect(book.chapters[2].content[1].type).toBe('image');
    });

    it('handles empty content', () => {
      const md = '';
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('Untitled');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].content).toHaveLength(0);
    });
  });
});
