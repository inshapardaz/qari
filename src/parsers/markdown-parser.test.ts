import { describe, it, expect } from 'vitest';
import { MarkdownParserImpl } from './markdown-parser';
import type { ParagraphNode, HeadingNode, CodeBlockNode, ImageNode, ListNode, FootnoteRefSpan, TextSpan } from '../models/book';

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

    it('treats each H1 as a chapter boundary when 2+ H1 headings are present', () => {
      const md = '# Chapter One\n\nFirst chapter text.\n\n# Chapter Two\n\nSecond chapter text.';
      const book = parser.parse(md);
      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[0].title).toBe('Chapter One');
      expect(book.chapters[1].title).toBe('Chapter Two');
      // content[0] of each chapter is its own re-rendered title heading.
      const para0 = book.chapters[0].content[1] as ParagraphNode;
      const para1 = book.chapters[1].content[1] as ParagraphNode;
      expect(para0.children).toEqual([{ type: 'text', content: 'First chapter text.' }]);
      expect(para1.children).toEqual([{ type: 'text', content: 'Second chapter text.' }]);
    });

    it('uses the first H1 as the book title even when H1 also delimits chapters', () => {
      const md = '# Chapter One\n\nText.\n\n# Chapter Two\n\nText.';
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('Chapter One');
    });

    it('renders an H2 inside an H1-delimited chapter as an ordinary in-content heading, not a further split', () => {
      const md = '# Chapter One\n\n## A Subsection\n\nText.\n\n# Chapter Two\n\nMore text.';
      const book = parser.parse(md);
      expect(book.chapters).toHaveLength(2);
      // content[0] is chapter 0's own title heading (level 1, "Chapter One");
      // the H2 "A Subsection" is the ordinary in-content heading after it.
      const heading = book.chapters[0].content[1] as HeadingNode;
      expect(heading.type).toBe('heading');
      expect(heading.level).toBe(2);
      expect(heading.children).toEqual([{ type: 'text', content: 'A Subsection' }]);
    });

    it('keeps single-H1-as-title/H2-as-chapter behavior unchanged when only one H1 is present', () => {
      const md = '# My Book\n\n## Intro\n\nHello.\n\n## Part Two\n\nWorld.';
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('My Book');
      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[0].title).toBe('Intro');
      expect(book.chapters[1].title).toBe('Part Two');
    });
  });

  describe('paragraphs and inline formatting', () => {
    it('parses plain paragraphs', () => {
      const md = '# Title\n\n## Ch1\n\nHello world.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;
      expect(para.type).toBe('paragraph');
      expect(para.children).toHaveLength(1);
      expect(para.children[0]).toEqual({ type: 'text', content: 'Hello world.' });
    });

    it('parses bold text', () => {
      const md = '# T\n\n## C\n\nThis is **bold** text.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'bold', children: [{ type: 'text', content: 'bold' }] },
        { type: 'text', content: ' text.' },
      ]);
    });

    it('parses italic text', () => {
      const md = '# T\n\n## C\n\nThis is *italic* text.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'italic', children: [{ type: 'text', content: 'italic' }] },
        { type: 'text', content: ' text.' },
      ]);
    });

    it('parses inline code', () => {
      const md = '# T\n\n## C\n\nUse `console.log` here.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'Use ' },
        { type: 'code', content: 'console.log' },
        { type: 'text', content: ' here.' },
      ]);
    });

    it('parses links', () => {
      const md = '# T\n\n## C\n\nVisit [Google](https://google.com) now.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;
      expect(para.children).toEqual([
        { type: 'text', content: 'Visit ' },
        { type: 'link', href: 'https://google.com', children: [{ type: 'text', content: 'Google' }] },
        { type: 'text', content: ' now.' },
      ]);
    });

    it('parses nested bold inside italic', () => {
      const md = '# T\n\n## C\n\n*italic and **bold***';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;
      expect(para.children[0].type).toBe('italic');
    });
  });

  describe('images', () => {
    it('parses standalone images as ImageNode', () => {
      const md = '# T\n\n## C\n\n![Alt text](image.png)';
      const book = parser.parse(md);
      const img = book.chapters[0].content[1] as ImageNode;
      expect(img.type).toBe('image');
      expect(img.src).toBe('image.png');
      expect(img.alt).toBe('Alt text');
    });

    it('handles image with empty alt text', () => {
      const md = '# T\n\n## C\n\n![](photo.jpg)';
      const book = parser.parse(md);
      const img = book.chapters[0].content[1] as ImageNode;
      expect(img.type).toBe('image');
      expect(img.src).toBe('photo.jpg');
      expect(img.alt).toBeUndefined();
    });
  });

  describe('code blocks', () => {
    it('parses fenced code blocks with language', () => {
      const md = '# T\n\n## C\n\n```typescript\nconst x = 1;\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;
      expect(code.type).toBe('code-block');
      expect(code.language).toBe('typescript');
      expect(code.content).toBe('const x = 1;\n');
    });

    it('parses fenced code blocks without language', () => {
      const md = '# T\n\n## C\n\n```\nhello\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;
      expect(code.type).toBe('code-block');
      expect(code.language).toBeUndefined();
      expect(code.content).toBe('hello\n');
    });
  });

  describe('lists', () => {
    it('parses unordered lists', () => {
      const md = '# T\n\n## C\n\n- Item 1\n- Item 2\n- Item 3';
      const book = parser.parse(md);
      const list = book.chapters[0].content[1] as ListNode;
      expect(list.type).toBe('list');
      expect(list.ordered).toBe(false);
      expect(list.items).toHaveLength(3);
    });

    it('parses ordered lists', () => {
      const md = '# T\n\n## C\n\n1. First\n2. Second\n3. Third';
      const book = parser.parse(md);
      const list = book.chapters[0].content[1] as ListNode;
      expect(list.type).toBe('list');
      expect(list.ordered).toBe(true);
      expect(list.items).toHaveLength(3);
    });

    it('parses list items with inline formatting', () => {
      const md = '# T\n\n## C\n\n- **bold item**\n- *italic item*';
      const book = parser.parse(md);
      const list = book.chapters[0].content[1] as ListNode;
      const firstItemPara = list.items[0].children[0] as ParagraphNode;
      expect(firstItemPara.type).toBe('paragraph');
      expect(firstItemPara.children[0].type).toBe('bold');
    });
  });

  describe('headings within chapters', () => {
    it('maps H3-H6 headings as HeadingNode within chapter content', () => {
      const md = '# Title\n\n## Chapter\n\n### Subsection\n\nText.\n\n#### Deep section';
      const book = parser.parse(md);
      // content[0] is the chapter's own title heading ("Chapter", level 2).
      const h3 = book.chapters[0].content[1] as HeadingNode;
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

      // content[0] of each chapter is its own title heading.
      // Chapter 1 has paragraph + code block after it
      expect(book.chapters[1].content[0].type).toBe('heading');
      expect(book.chapters[1].content[1].type).toBe('paragraph');
      expect(book.chapters[1].content[2].type).toBe('code-block');

      // Chapter 2 has list + image after it
      expect(book.chapters[2].content[0].type).toBe('heading');
      expect(book.chapters[2].content[1].type).toBe('list');
      expect(book.chapters[2].content[2].type).toBe('image');
    });

    it('handles empty content', () => {
      const md = '';
      const book = parser.parse(md);
      expect(book.metadata.title).toBe('Untitled');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].content).toHaveLength(0);
    });
  });

  describe('footnote parsing', () => {
    it('reference with matching definition produces FootnoteRefSpan', () => {
      const md = 'This has a footnote[^1] in it.\n\n[^1]: This is the footnote content.';
      const book = parser.parse(md);
      // No H1 in this source, so no title heading is prepended.
      const para = book.chapters[0].content[0] as ParagraphNode;

      const footnoteNode = para.children.find(n => n.type === 'footnote-ref') as FootnoteRefSpan;
      expect(footnoteNode).toBeDefined();
      expect(footnoteNode.type).toBe('footnote-ref');
      expect(footnoteNode.label).toBe('1');
      expect(footnoteNode.content.length).toBeGreaterThan(0);
      // The content should contain the parsed definition text
      const textContent = footnoteNode.content.find(n => n.type === 'text') as TextSpan;
      expect(textContent).toBeDefined();
      expect(textContent.content).toBe('This is the footnote content.');
    });

    it('reference without matching definition produces TextSpan with raw text', () => {
      const md = 'This has a footnote[^missing] with no definition.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;

      // Should contain a TextSpan with the raw reference text
      const rawRef = para.children.find(
        n => n.type === 'text' && (n as TextSpan).content === '[^missing]'
      ) as TextSpan;
      expect(rawRef).toBeDefined();
      expect(rawRef.type).toBe('text');
      expect(rawRef.content).toBe('[^missing]');
    });

    it('multiple references are numbered sequentially', () => {
      const md = 'First[^a] and second[^b] and third[^c].\n\n[^a]: Note A\n[^b]: Note B\n[^c]: Note C';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;

      const footnotes = para.children.filter(n => n.type === 'footnote-ref') as FootnoteRefSpan[];
      expect(footnotes).toHaveLength(3);
      expect(footnotes[0].label).toBe('1');
      expect(footnotes[1].label).toBe('2');
      expect(footnotes[2].label).toBe('3');
    });

    it('footnote content is parsed as inline nodes', () => {
      const md = 'Text[^fn1] here.\n\n[^fn1]: Content with **bold** and *italic* formatting.';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;

      const footnoteNode = para.children.find(n => n.type === 'footnote-ref') as FootnoteRefSpan;
      expect(footnoteNode).toBeDefined();
      expect(footnoteNode.content.length).toBeGreaterThan(1);

      // Should contain bold and italic spans from parsed definition
      const boldSpan = footnoteNode.content.find(n => n.type === 'bold');
      expect(boldSpan).toBeDefined();

      const italicSpan = footnoteNode.content.find(n => n.type === 'italic');
      expect(italicSpan).toBeDefined();
    });
  });
});
