import { describe, it, expect } from 'vitest';
import { MarkdownParserImpl } from '../markdown-parser';
import type {
  ParagraphNode,
  HeadingNode,
  CodeBlockNode,
  ListNode,
  ListItem,
  InlineNode,
  BoldSpan,
  ItalicSpan,
  LinkSpan,
} from '../../models/book';

describe('MarkdownParser - Edge Cases', () => {
  const parser = new MarkdownParserImpl();

  describe('no H2 headings → single chapter', () => {
    it('produces a single chapter when input has paragraphs but no H2', () => {
      const md = '# Document Title\n\nFirst paragraph.\n\nSecond paragraph.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].id).toBe('chapter-0');
      expect(book.chapters[0].title).toBe('Document Title');
      expect(book.chapters[0].order).toBe(0);
      expect(book.chapters[0].content.length).toBeGreaterThan(0);
    });

    it('produces a single chapter with H3/H4 headings but no H2', () => {
      const md = '# Title\n\n### Sub-section\n\nSome text.\n\n#### Deep section\n\nMore text.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('Title');
      // content[0] is the chapter's own re-rendered title heading (from the
      // H1) — H3 and H4 appear as heading nodes after it.
      const titleHeading = book.chapters[0].content[0] as HeadingNode;
      expect(titleHeading.type).toBe('heading');
      expect(titleHeading.level).toBe(1);
      const h3 = book.chapters[0].content[1] as HeadingNode;
      expect(h3.type).toBe('heading');
      expect(h3.level).toBe(3);
      const h4 = book.chapters[0].content[3] as HeadingNode;
      expect(h4.type).toBe('heading');
      expect(h4.level).toBe(4);
    });

    it('uses "Untitled" when no H1 and no H2 exist', () => {
      const md = 'Just a paragraph of text.\n\nAnother one.';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('Untitled');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('Untitled');
    });
  });

  describe('H1-only input → title extraction', () => {
    it('extracts title from H1 with no other content', () => {
      const md = '# My Document Title';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('My Document Title');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('My Document Title');
      // Just the chapter's own re-rendered title heading — no body content.
      expect(book.chapters[0].content).toHaveLength(1);
      expect(book.chapters[0].content[0].type).toBe('heading');
    });

    it('extracts title from H1 followed only by whitespace', () => {
      const md = '# Standalone Title\n\n\n';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('Standalone Title');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].content).toHaveLength(1);
      expect(book.chapters[0].content[0].type).toBe('heading');
    });
  });

  describe('complex nested lists', () => {
    it('parses a nested unordered list (list within list)', () => {
      const md = '# T\n\n## C\n\n- Item 1\n  - Nested A\n  - Nested B\n- Item 2';
      const book = parser.parse(md);
      const list = book.chapters[0].content[1] as ListNode;

      expect(list.type).toBe('list');
      expect(list.ordered).toBe(false);
      expect(list.items).toHaveLength(2);

      // First item should contain a paragraph and a nested list
      const firstItem = list.items[0];
      const nestedList = firstItem.children.find(
        (node) => node.type === 'list'
      ) as ListNode | undefined;
      expect(nestedList).toBeDefined();
      if (nestedList) {
        expect(nestedList.ordered).toBe(false);
        expect(nestedList.items).toHaveLength(2);
      }
    });

    it('parses a nested ordered list inside unordered list', () => {
      const md = '# T\n\n## C\n\n- Outer item\n  1. Inner one\n  2. Inner two\n- Another outer';
      const book = parser.parse(md);
      const list = book.chapters[0].content[1] as ListNode;

      expect(list.type).toBe('list');
      expect(list.ordered).toBe(false);

      // First item should have a nested ordered list
      const firstItem = list.items[0];
      const nestedOrderedList = firstItem.children.find(
        (node) => node.type === 'list' && node.ordered === true
      ) as ListNode | undefined;
      expect(nestedOrderedList).toBeDefined();
      if (nestedOrderedList) {
        expect(nestedOrderedList.items).toHaveLength(2);
      }
    });

    it('parses deeply nested lists (3 levels)', () => {
      const md = '# T\n\n## C\n\n- Level 1\n  - Level 2\n    - Level 3';
      const book = parser.parse(md);
      const list = book.chapters[0].content[1] as ListNode;

      expect(list.type).toBe('list');
      expect(list.items).toHaveLength(1);

      // Navigate to level 2
      const level2List = list.items[0].children.find(
        (n) => n.type === 'list'
      ) as ListNode | undefined;
      expect(level2List).toBeDefined();

      // Navigate to level 3
      if (level2List) {
        const level3List = level2List.items[0].children.find(
          (n) => n.type === 'list'
        ) as ListNode | undefined;
        expect(level3List).toBeDefined();
        if (level3List) {
          expect(level3List.items).toHaveLength(1);
        }
      }
    });
  });

  describe('inline formatting combinations', () => {
    it('parses bold inside italic', () => {
      const md = '# T\n\n## C\n\n*This is **bold inside** italic*';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;

      expect(para.type).toBe('paragraph');
      const italic = para.children[0] as ItalicSpan;
      expect(italic.type).toBe('italic');
      // Should contain text + bold + text
      const boldInside = italic.children.find((c) => c.type === 'bold') as BoldSpan | undefined;
      expect(boldInside).toBeDefined();
      if (boldInside) {
        expect(boldInside.children[0]).toEqual({ type: 'text', content: 'bold inside' });
      }
    });

    it('parses link with bold text inside', () => {
      const md = '# T\n\n## C\n\n[**Bold link**](https://example.com)';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;

      const link = para.children[0] as LinkSpan;
      expect(link.type).toBe('link');
      expect(link.href).toBe('https://example.com');
      expect(link.children[0].type).toBe('bold');
      const bold = link.children[0] as BoldSpan;
      expect(bold.children[0]).toEqual({ type: 'text', content: 'Bold link' });
    });

    it('parses code inside a link', () => {
      const md = '# T\n\n## C\n\n[`code`](https://example.com)';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;

      const link = para.children[0] as LinkSpan;
      expect(link.type).toBe('link');
      expect(link.href).toBe('https://example.com');
      expect(link.children[0]).toEqual({ type: 'code', content: 'code' });
    });

    it('parses multiple inline formats in one paragraph', () => {
      const md = '# T\n\n## C\n\n**bold** and *italic* and `code` and [link](http://x.com)';
      const book = parser.parse(md);
      const para = book.chapters[0].content[1] as ParagraphNode;

      const types = para.children.map((c) => c.type);
      expect(types).toContain('bold');
      expect(types).toContain('italic');
      expect(types).toContain('code');
      expect(types).toContain('link');
    });
  });

  describe('code blocks with language annotations', () => {
    it('parses typescript code block', () => {
      const md = '# T\n\n## C\n\n```typescript\ninterface Foo { bar: string; }\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('typescript');
      expect(code.content).toBe('interface Foo { bar: string; }\n');
    });

    it('parses python code block', () => {
      const md = '# T\n\n## C\n\n```python\ndef hello():\n    print("world")\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('python');
      expect(code.content).toBe('def hello():\n    print("world")\n');
    });

    it('parses code block with no language annotation', () => {
      const md = '# T\n\n## C\n\n```\nplain code\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBeUndefined();
      expect(code.content).toBe('plain code\n');
    });

    it('parses code block with uncommon language annotation', () => {
      const md = '# T\n\n## C\n\n```rust\nfn main() {}\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('rust');
    });

    it('preserves code block content with special characters', () => {
      const md = '# T\n\n## C\n\n```html\n<div class="test">&amp;</div>\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[1] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('html');
      expect(code.content).toBe('<div class="test">&amp;</div>\n');
    });
  });

  describe('empty and whitespace-only input', () => {
    it('handles empty string input', () => {
      const book = parser.parse('');

      expect(book.metadata.title).toBe('Untitled');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('Untitled');
      expect(book.chapters[0].content).toHaveLength(0);
    });

    it('handles whitespace-only input', () => {
      const book = parser.parse('   \n\n  \n  ');

      expect(book.metadata.title).toBe('Untitled');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].content).toHaveLength(0);
    });

    it('handles newline-only input', () => {
      const book = parser.parse('\n\n\n');

      expect(book.metadata.title).toBe('Untitled');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].content).toHaveLength(0);
    });
  });

  describe('multiple H1 headings', () => {
    // 2+ H1 headings makes H1 itself the chapter-boundary level (a single
    // markdown file with one `# Chapter Title` per chapter is at least as
    // common a convention as the H2-per-chapter one) — see `buildChapters`'s
    // own comment in markdown-parser.ts. A single H1 keeps the original
    // H1-title/H2-chapter behavior (covered elsewhere in this file/suite).
    it('uses the first H1 as the book title even when H1 also delimits chapters', () => {
      const md = '# First Title\n\n# Second Title\n\n## Subsection\n\nContent.';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('First Title');
    });

    it('creates a chapter per H1, rendering an inner H2 as an ordinary in-content heading rather than a further split', () => {
      const md = '# Title One\n\n# Title Two\n\n## Subsection\n\nText.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[0].title).toBe('Title One');
      expect(book.chapters[1].title).toBe('Title Two');
      const heading = book.chapters[1].content.find((n) => n.type === 'heading');
      expect(heading).toBeDefined();
    });

    it('splits chapters at each H1 and includes each one\'s own following content', () => {
      const md = '# First\n\n# Second\n\nParagraph text.';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('First');
      expect(book.chapters).toHaveLength(2);
      // Just chapter 0's own re-rendered title heading — no body content.
      expect(book.chapters[0].content).toHaveLength(1);
      expect(book.chapters[0].content[0].type).toBe('heading');
      const paragraphs = book.chapters[1].content.filter(
        (n) => n.type === 'paragraph'
      );
      expect(paragraphs).toHaveLength(1);
    });
  });

  describe('H2 with no content between headings → chapter with only its own title heading', () => {
    it('creates chapter with just its title heading when H2 is immediately followed by another H2', () => {
      const md = '# Title\n\n## Empty Chapter\n\n## Non-empty Chapter\n\nSome text.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[0].title).toBe('Empty Chapter');
      expect(book.chapters[0].content).toHaveLength(1);
      expect(book.chapters[0].content[0].type).toBe('heading');
      expect(book.chapters[1].title).toBe('Non-empty Chapter');
      expect(book.chapters[1].content.length).toBeGreaterThan(1);
    });

    it('handles multiple consecutive body-less H2 chapters', () => {
      const md = '# Title\n\n## A\n\n## B\n\n## C\n\nFinal content.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(3);
      expect(book.chapters[0].title).toBe('A');
      expect(book.chapters[0].content).toHaveLength(1);
      expect(book.chapters[1].title).toBe('B');
      expect(book.chapters[1].content).toHaveLength(1);
      expect(book.chapters[2].title).toBe('C');
      expect(book.chapters[2].content.length).toBeGreaterThan(1);
    });

    it('handles the last chapter having no body content', () => {
      const md = '# Title\n\n## First\n\nContent here.\n\n## Last Empty';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[1].title).toBe('Last Empty');
      expect(book.chapters[1].content).toHaveLength(1);
      expect(book.chapters[1].content[0].type).toBe('heading');
    });
  });
});
