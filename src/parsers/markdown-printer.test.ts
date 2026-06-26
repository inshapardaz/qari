import { describe, it, expect } from 'vitest';
import { MarkdownPrinterImpl } from './markdown-printer';
import type { Book } from '../models/book';

const printer = new MarkdownPrinterImpl();

describe('MarkdownPrinterImpl', () => {
  it('renders book title as H1', () => {
    const book: Book = {
      metadata: { title: 'My Book' },
      chapters: [{ id: 'ch-0', title: 'Intro', order: 0, content: [] }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('# My Book\n');
  });

  it('renders chapters as H2 headings', () => {
    const book: Book = {
      metadata: { title: 'Title' },
      chapters: [
        { id: 'ch-0', title: 'Chapter One', order: 0, content: [] },
        { id: 'ch-1', title: 'Chapter Two', order: 1, content: [] },
      ],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('## Chapter One');
    expect(md).toContain('## Chapter Two');
  });

  it('renders paragraphs with inline text', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'paragraph',
          children: [{ type: 'text', content: 'Hello world' }],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('Hello world');
  });

  it('renders headings with correct level', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'heading',
          level: 3,
          children: [{ type: 'text', content: 'Sub Heading' }],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('### Sub Heading');
  });

  it('renders images as ![alt](src)', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'image',
          src: 'pic.png',
          alt: 'A picture',
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('![A picture](pic.png)');
  });

  it('renders images without alt text', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'image',
          src: 'photo.jpg',
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('![](photo.jpg)');
  });

  it('renders fenced code blocks with language', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'code-block',
          language: 'typescript',
          content: 'const x = 1;\n',
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('```typescript\nconst x = 1;\n```');
  });

  it('renders fenced code blocks without language', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'code-block',
          content: 'plain code\n',
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('```\nplain code\n```');
  });

  it('renders unordered lists', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'list',
          ordered: false,
          items: [
            { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'First' }] }] },
            { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Second' }] }] },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('- First\n- Second');
  });

  it('renders ordered lists', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'list',
          ordered: true,
          items: [
            { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Alpha' }] }] },
            { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Beta' }] }] },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('1. Alpha\n2. Beta');
  });

  it('renders bold inline formatting', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'paragraph',
          children: [
            { type: 'text', content: 'This is ' },
            { type: 'bold', children: [{ type: 'text', content: 'important' }] },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('This is **important**');
  });

  it('renders italic inline formatting', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'paragraph',
          children: [
            { type: 'italic', children: [{ type: 'text', content: 'emphasis' }] },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('*emphasis*');
  });

  it('renders inline code', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'paragraph',
          children: [
            { type: 'text', content: 'Use ' },
            { type: 'code', content: 'npm install' },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('Use `npm install`');
  });

  it('renders links', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'paragraph',
          children: [
            { type: 'link', href: 'https://example.com', children: [{ type: 'text', content: 'click here' }] },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('[click here](https://example.com)');
  });

  it('renders opaque nodes as raw content', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'opaque',
          originalTag: 'div',
          rawContent: '<div class="custom">Hello</div>',
          attributes: { class: 'custom' },
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('<div class="custom">Hello</div>');
  });

  it('renders nested inline formatting (bold inside italic)', () => {
    const book: Book = {
      metadata: { title: 'T' },
      chapters: [{
        id: 'ch-0', title: 'Ch', order: 0,
        content: [{
          type: 'paragraph',
          children: [
            {
              type: 'italic',
              children: [
                { type: 'text', content: 'soft ' },
                { type: 'bold', children: [{ type: 'text', content: 'loud' }] },
              ],
            },
          ],
        }],
      }],
    };
    const md = printer.toMarkdown(book);
    expect(md).toContain('*soft **loud***');
  });

  it('produces output ending with a newline', () => {
    const book: Book = {
      metadata: { title: 'Minimal' },
      chapters: [{ id: 'ch-0', title: 'Only', order: 0, content: [] }],
    };
    const md = printer.toMarkdown(book);
    expect(md.endsWith('\n')).toBe(true);
  });
});
