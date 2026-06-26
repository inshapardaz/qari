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
      // H3 and H4 should appear as heading nodes in the content
      const h3 = book.chapters[0].content[0] as HeadingNode;
      expect(h3.type).toBe('heading');
      expect(h3.level).toBe(3);
      const h4 = book.chapters[0].content[2] as HeadingNode;
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
      expect(book.chapters[0].content).toHaveLength(0);
    });

    it('extracts title from H1 followed only by whitespace', () => {
      const md = '# Standalone Title\n\n\n';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('Standalone Title');
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].content).toHaveLength(0);
    });
  });

  describe('complex nested lists', () => {
    it('parses a nested unordered list (list within list)', () => {
      const md = '# T\n\n## C\n\n- Item 1\n  - Nested A\n  - Nested B\n- Item 2';
      const book = parser.parse(md);
      const list = book.chapters[0].content[0] as ListNode;

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
      const list = book.chapters[0].content[0] as ListNode;

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
      const list = book.chapters[0].content[0] as ListNode;

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
      const para = book.chapters[0].content[0] as ParagraphNode;

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
      const para = book.chapters[0].content[0] as ParagraphNode;

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
      const para = book.chapters[0].content[0] as ParagraphNode;

      const link = para.children[0] as LinkSpan;
      expect(link.type).toBe('link');
      expect(link.href).toBe('https://example.com');
      expect(link.children[0]).toEqual({ type: 'code', content: 'code' });
    });

    it('parses multiple inline formats in one paragraph', () => {
      const md = '# T\n\n## C\n\n**bold** and *italic* and `code` and [link](http://x.com)';
      const book = parser.parse(md);
      const para = book.chapters[0].content[0] as ParagraphNode;

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
      const code = book.chapters[0].content[0] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('typescript');
      expect(code.content).toBe('interface Foo { bar: string; }\n');
    });

    it('parses python code block', () => {
      const md = '# T\n\n## C\n\n```python\ndef hello():\n    print("world")\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[0] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('python');
      expect(code.content).toBe('def hello():\n    print("world")\n');
    });

    it('parses code block with no language annotation', () => {
      const md = '# T\n\n## C\n\n```\nplain code\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[0] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBeUndefined();
      expect(code.content).toBe('plain code\n');
    });

    it('parses code block with uncommon language annotation', () => {
      const md = '# T\n\n## C\n\n```rust\nfn main() {}\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[0] as CodeBlockNode;

      expect(code.type).toBe('code-block');
      expect(code.language).toBe('rust');
    });

    it('preserves code block content with special characters', () => {
      const md = '# T\n\n## C\n\n```html\n<div class="test">&amp;</div>\n```';
      const book = parser.parse(md);
      const code = book.chapters[0].content[0] as CodeBlockNode;

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
    it('uses only the first H1 as the book title', () => {
      const md = '# First Title\n\n# Second Title\n\n## Chapter\n\nContent.';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('First Title');
    });

    it('does not create additional chapters from extra H1s', () => {
      const md = '# Title One\n\n# Title Two\n\n## Real Chapter\n\nText.';
      const book = parser.parse(md);

      // Only one chapter from the H2
      expect(book.chapters).toHaveLength(1);
      expect(book.chapters[0].title).toBe('Real Chapter');
    });

    it('does not include extra H1 content in single-chapter mode', () => {
      const md = '# First\n\n# Second\n\nParagraph text.';
      const book = parser.parse(md);

      expect(book.metadata.title).toBe('First');
      expect(book.chapters).toHaveLength(1);
      // The content should only have the paragraph (H1s are skipped)
      const paragraphs = book.chapters[0].content.filter(
        (n) => n.type === 'paragraph'
      );
      expect(paragraphs).toHaveLength(1);
    });
  });

  describe('H2 with no content between headings → empty chapter', () => {
    it('creates chapter with empty content when H2 is immediately followed by another H2', () => {
      const md = '# Title\n\n## Empty Chapter\n\n## Non-empty Chapter\n\nSome text.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[0].title).toBe('Empty Chapter');
      expect(book.chapters[0].content).toHaveLength(0);
      expect(book.chapters[1].title).toBe('Non-empty Chapter');
      expect(book.chapters[1].content.length).toBeGreaterThan(0);
    });

    it('handles multiple consecutive empty H2 chapters', () => {
      const md = '# Title\n\n## A\n\n## B\n\n## C\n\nFinal content.';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(3);
      expect(book.chapters[0].title).toBe('A');
      expect(book.chapters[0].content).toHaveLength(0);
      expect(book.chapters[1].title).toBe('B');
      expect(book.chapters[1].content).toHaveLength(0);
      expect(book.chapters[2].title).toBe('C');
      expect(book.chapters[2].content.length).toBeGreaterThan(0);
    });

    it('handles last chapter being empty', () => {
      const md = '# Title\n\n## First\n\nContent here.\n\n## Last Empty';
      const book = parser.parse(md);

      expect(book.chapters).toHaveLength(2);
      expect(book.chapters[1].title).toBe('Last Empty');
      expect(book.chapters[1].content).toHaveLength(0);
    });
  });
});
