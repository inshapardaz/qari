import { describe, it, expect } from 'vitest';
import { EPUBParserImpl, EPUBParseError } from './epub-parser';
import JSZip from 'jszip';

/**
 * Helper to create a minimal valid EPUB structure as an ArrayBuffer.
 */
async function createEpubBuffer(options: {
  metadata?: string;
  spineItems?: { id: string; href: string; content: string }[];
  containerXml?: string;
  opfContent?: string;
  opfPath?: string;
} = {}): Promise<ArrayBuffer> {
  const opfPath = options.opfPath || 'OEBPS/content.opf';
  const containerXml = options.containerXml || `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const spineItems = options.spineItems || [
    {
      id: 'chapter1',
      href: 'chapter1.xhtml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><p>Hello world</p></body>
</html>`,
    },
  ];

  const metadata = options.metadata || `
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Test Publisher</dc:publisher>
    <dc:date>2024-01-01</dc:date>`;

  const manifestItems = spineItems
    .map((item) => `<item id="${item.id}" href="${item.href}" media-type="application/xhtml+xml"/>`)
    .join('\n      ');

  const spineRefs = spineItems
    .map((item) => `<itemref idref="${item.id}"/>`)
    .join('\n      ');

  const opfContent = options.opfContent || `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadata}
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineRefs}
  </spine>
</package>`;

  const zip = new JSZip();
  zip.file('META-INF/container.xml', containerXml);
  zip.file(opfPath, opfContent);

  // Add content files
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
  for (const item of spineItems) {
    const contentPath = opfDir ? `${opfDir}/${item.href}` : item.href;
    zip.file(contentPath, item.content);
  }

  return await zip.generateAsync({ type: 'arraybuffer' });
}

describe('EPUBParserImpl', () => {
  const parser = new EPUBParserImpl();

  describe('metadata extraction', () => {
    it('should extract all metadata fields', async () => {
      const epub = await createEpubBuffer();
      const book = await parser.parse(epub);

      expect(book.metadata.title).toBe('Test Book');
      expect(book.metadata.author).toBe('Test Author');
      expect(book.metadata.language).toBe('en');
      expect(book.metadata.publisher).toBe('Test Publisher');
      expect(book.metadata.publicationDate).toBe('2024-01-01');
    });

    it('should handle missing optional metadata', async () => {
      const epub = await createEpubBuffer({
        metadata: '<dc:title>Minimal Book</dc:title>',
      });
      const book = await parser.parse(epub);

      expect(book.metadata.title).toBe('Minimal Book');
      expect(book.metadata.author).toBeUndefined();
      expect(book.metadata.language).toBeUndefined();
      expect(book.metadata.publisher).toBeUndefined();
      expect(book.metadata.publicationDate).toBeUndefined();
    });

    it('should default title to "Untitled" if dc:title is missing', async () => {
      const epub = await createEpubBuffer({
        metadata: '<dc:language>ar</dc:language>',
      });
      const book = await parser.parse(epub);

      expect(book.metadata.title).toBe('Untitled');
    });
  });

  describe('chapter ordering (spine sequence)', () => {
    it('should order chapters by spine sequence', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>First Chapter</title></head>
<body><p>Chapter 1 content</p></body>
</html>`,
          },
          {
            id: 'ch2',
            href: 'ch2.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Second Chapter</title></head>
<body><p>Chapter 2 content</p></body>
</html>`,
          },
          {
            id: 'ch3',
            href: 'ch3.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Third Chapter</title></head>
<body><p>Chapter 3 content</p></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);

      expect(book.chapters).toHaveLength(3);
      expect(book.chapters[0].id).toBe('ch1');
      expect(book.chapters[0].order).toBe(0);
      expect(book.chapters[0].title).toBe('First Chapter');
      expect(book.chapters[1].id).toBe('ch2');
      expect(book.chapters[1].order).toBe(1);
      expect(book.chapters[2].id).toBe('ch3');
      expect(book.chapters[2].order).toBe(2);
    });
  });

  describe('content node mapping', () => {
    it('should map <p> to ParagraphNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><p>A simple paragraph.</p></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('paragraph');
      if (node.type === 'paragraph') {
        expect(node.children[0]).toEqual({ type: 'text', content: 'A simple paragraph.' });
      }
    });

    it('should map <h1>-<h6> to HeadingNode with correct level', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <h3>Heading 3</h3>
</body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const content = book.chapters[0].content;

      expect(content[0].type).toBe('heading');
      if (content[0].type === 'heading') {
        expect(content[0].level).toBe(1);
        expect(content[0].children[0]).toEqual({ type: 'text', content: 'Heading 1' });
      }
      expect(content[1].type).toBe('heading');
      if (content[1].type === 'heading') {
        expect(content[1].level).toBe(2);
      }
      expect(content[2].type).toBe('heading');
      if (content[2].type === 'heading') {
        expect(content[2].level).toBe(3);
      }
    });

    it('should map <img> to ImageNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><img src="image.png" alt="A test image"/></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('image');
      if (node.type === 'image') {
        expect(node.src).toBe('image.png');
        expect(node.alt).toBe('A test image');
      }
    });

    it('should map <pre><code> to CodeBlockNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><pre><code class="language-typescript">const x = 42;</code></pre></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('code-block');
      if (node.type === 'code-block') {
        expect(node.content).toBe('const x = 42;');
        expect(node.language).toBe('typescript');
      }
    });

    it('should map <ul> and <ol> to ListNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <ul><li>Item 1</li><li>Item 2</li></ul>
  <ol><li>First</li><li>Second</li></ol>
</body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const content = book.chapters[0].content;

      expect(content[0].type).toBe('list');
      if (content[0].type === 'list') {
        expect(content[0].ordered).toBe(false);
        expect(content[0].items).toHaveLength(2);
      }

      expect(content[1].type).toBe('list');
      if (content[1].type === 'list') {
        expect(content[1].ordered).toBe(true);
        expect(content[1].items).toHaveLength(2);
      }
    });
  });

  describe('inline element mapping', () => {
    it('should map <strong>/<b> to BoldSpan', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><p>This is <strong>bold</strong> and <b>also bold</b></p></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('paragraph');
      if (node.type === 'paragraph') {
        expect(node.children[1]).toEqual({
          type: 'bold',
          children: [{ type: 'text', content: 'bold' }],
        });
        expect(node.children[3]).toEqual({
          type: 'bold',
          children: [{ type: 'text', content: 'also bold' }],
        });
      }
    });

    it('should map <em>/<i> to ItalicSpan', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><p>This is <em>italic</em> text</p></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      if (node.type === 'paragraph') {
        expect(node.children[1]).toEqual({
          type: 'italic',
          children: [{ type: 'text', content: 'italic' }],
        });
      }
    });

    it('should map <a> to LinkSpan', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><p>Visit <a href="https://example.com">here</a></p></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      if (node.type === 'paragraph') {
        expect(node.children[1]).toEqual({
          type: 'link',
          href: 'https://example.com',
          children: [{ type: 'text', content: 'here' }],
        });
      }
    });

    it('should map inline <code> to CodeSpan', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><p>Use <code>console.log()</code> for debugging</p></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      if (node.type === 'paragraph') {
        expect(node.children[1]).toEqual({
          type: 'code',
          content: 'console.log()',
        });
      }
    });
  });

  describe('OpaqueNode for unsupported elements', () => {
    it('should preserve <audio> as OpaqueNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><audio src="song.mp3" controls="controls">fallback text</audio></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('opaque');
      if (node.type === 'opaque') {
        expect(node.originalTag).toBe('audio');
        expect(node.attributes.src).toBe('song.mp3');
        expect(node.attributes.controls).toBe('controls');
        expect(node.rawContent).toBe('fallback text');
      }
    });

    it('should preserve <video> as OpaqueNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><video src="movie.mp4" width="640" height="480"></video></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('opaque');
      if (node.type === 'opaque') {
        expect(node.originalTag).toBe('video');
        expect(node.attributes.src).toBe('movie.mp4');
        expect(node.attributes.width).toBe('640');
        expect(node.attributes.height).toBe('480');
      }
    });

    it('should preserve <script> as OpaqueNode', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body><script type="text/javascript">alert("hi");</script></body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const node = book.chapters[0].content[0];

      expect(node.type).toBe('opaque');
      if (node.type === 'opaque') {
        expect(node.originalTag).toBe('script');
        expect(node.rawContent).toBe('alert("hi");');
        expect(node.attributes.type).toBe('text/javascript');
      }
    });
  });

  describe('error handling for malformed EPUB', () => {
    it('should throw EPUBParseError for non-ZIP data', async () => {
      const invalidData = new TextEncoder().encode('not a zip file').buffer;

      await expect(parser.parse(invalidData)).rejects.toThrow(EPUBParseError);
      await expect(parser.parse(invalidData)).rejects.toMatchObject({
        source: 'epub',
        format: 'epub',
      });
    });

    it('should throw EPUBParseError when container.xml is missing', async () => {
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      const buf = await zip.generateAsync({ type: 'arraybuffer' });

      await expect(parser.parse(buf)).rejects.toThrow(EPUBParseError);
      await expect(parser.parse(buf)).rejects.toMatchObject({
        reason: expect.stringContaining('META-INF/container.xml'),
      });
    });

    it('should throw EPUBParseError when rootfile path is missing', async () => {
      const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

      const zip = new JSZip();
      zip.file('META-INF/container.xml', containerXml);
      const buf = await zip.generateAsync({ type: 'arraybuffer' });

      await expect(parser.parse(buf)).rejects.toThrow(EPUBParseError);
      await expect(parser.parse(buf)).rejects.toMatchObject({
        reason: expect.stringContaining('full-path'),
      });
    });

    it('should throw EPUBParseError when OPF is malformed XML', async () => {
      const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

      const zip = new JSZip();
      zip.file('META-INF/container.xml', containerXml);
      zip.file('OEBPS/content.opf', '<this is not valid xml');
      const buf = await zip.generateAsync({ type: 'arraybuffer' });

      await expect(parser.parse(buf)).rejects.toThrow(EPUBParseError);
      await expect(parser.parse(buf)).rejects.toMatchObject({
        reason: expect.stringContaining('Malformed XML'),
      });
    });

    it('should throw EPUBParseError when spine has no items', async () => {
      const epub = await createEpubBuffer({
        opfContent: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Empty Spine Book</dc:title>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
  </spine>
</package>`,
      });

      await expect(parser.parse(epub)).rejects.toThrow(EPUBParseError);
      await expect(parser.parse(epub)).rejects.toMatchObject({
        reason: expect.stringContaining('Spine contains no itemref'),
      });
    });

    it('should never produce a partial Book - always throw structured error', async () => {
      const invalidData = new Uint8Array([0, 1, 2, 3, 4]).buffer;

      try {
        await parser.parse(invalidData);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(EPUBParseError);
        const parseErr = err as EPUBParseError;
        expect(parseErr.source).toBeDefined();
        expect(parseErr.format).toBeDefined();
        expect(parseErr.reason).toBeDefined();
      }
    });
  });

  describe('container elements (div, section)', () => {
    it('should recurse into div containers', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Test</title></head>
<body>
  <div>
    <p>Inside a div</p>
    <p>Also inside a div</p>
  </div>
</body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const content = book.chapters[0].content;

      expect(content.length).toBe(2);
      expect(content[0].type).toBe('paragraph');
      expect(content[1].type).toBe('paragraph');
    });
  });

  describe('EPUB footnote parsing', () => {
    it('should produce FootnoteRefSpan for noteref with resolvable target', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Test</title></head>
<body>
  <p>Some text<a epub:type="noteref" href="#fn1">1</a> continues.</p>
  <aside id="fn1">This is the footnote content.</aside>
</body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const para = book.chapters[0].content[0];

      expect(para.type).toBe('paragraph');
      if (para.type === 'paragraph') {
        const footnoteRef = para.children.find((child) => child.type === 'footnote-ref');
        expect(footnoteRef).toBeDefined();
        expect(footnoteRef!.type).toBe('footnote-ref');
        if (footnoteRef!.type === 'footnote-ref') {
          expect(footnoteRef!.label).toBe('1');
          expect(footnoteRef!.content).toBeInstanceOf(Array);
          expect(footnoteRef!.content.length).toBeGreaterThan(0);
          expect(footnoteRef!.content[0]).toEqual({
            type: 'text',
            content: 'This is the footnote content.',
          });
        }
      }
    });

    it('should fall back to LinkSpan for noteref with unresolvable target', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Test</title></head>
<body>
  <p>Some text<a epub:type="noteref" href="#nonexistent">2</a> continues.</p>
</body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const para = book.chapters[0].content[0];

      expect(para.type).toBe('paragraph');
      if (para.type === 'paragraph') {
        const link = para.children.find((child) => child.type === 'link');
        expect(link).toBeDefined();
        expect(link!.type).toBe('link');
        if (link!.type === 'link') {
          expect(link!.href).toBe('#nonexistent');
          expect(link!.children).toEqual([{ type: 'text', content: '2' }]);
        }
        // Ensure no footnote-ref was produced
        const footnoteRef = para.children.find((child) => child.type === 'footnote-ref');
        expect(footnoteRef).toBeUndefined();
      }
    });

    it('should derive label from anchor text content', async () => {
      const epub = await createEpubBuffer({
        spineItems: [
          {
            id: 'ch1',
            href: 'ch1.xhtml',
            content: `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Test</title></head>
<body>
  <p>Reference<a epub:type="noteref" href="#note-a">Note A</a> here.</p>
  <aside id="note-a">Footnote body text.</aside>
</body>
</html>`,
          },
        ],
      });

      const book = await parser.parse(epub);
      const para = book.chapters[0].content[0];

      expect(para.type).toBe('paragraph');
      if (para.type === 'paragraph') {
        const footnoteRef = para.children.find((child) => child.type === 'footnote-ref');
        expect(footnoteRef).toBeDefined();
        if (footnoteRef!.type === 'footnote-ref') {
          expect(footnoteRef!.label).toBe('Note A');
        }
      }
    });
  });
});
