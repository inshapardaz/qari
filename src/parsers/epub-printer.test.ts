import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { EPUBPrinterImpl } from './epub-printer';
import type { Book, Chapter, ContentNode } from '../models/book';

describe('EPUBPrinterImpl', () => {
  const printer = new EPUBPrinterImpl();

  function makeBook(overrides: Partial<Book> = {}): Book {
    return {
      metadata: {
        title: 'Test Book',
        author: 'Test Author',
        language: 'en',
        publisher: 'Test Publisher',
        publicationDate: '2024-01-01',
        identifier: 'urn:isbn:9780000000000',
      },
      chapters: [
        {
          id: 'ch1',
          title: 'Chapter One',
          order: 0,
          content: [
            { type: 'paragraph', children: [{ type: 'text', content: 'Hello world' }] },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('should produce a valid ZIP archive', async () => {
    const book = makeBook();
    const result = await printer.toEpub(book);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // Verify it's a valid ZIP
    const zip = await JSZip.loadAsync(result);
    expect(zip).toBeDefined();
  });

  it('should include mimetype file with correct content', async () => {
    const book = makeBook();
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const mimetype = await zip.file('mimetype')?.async('string');
    expect(mimetype).toBe('application/epub+zip');
  });

  it('should include META-INF/container.xml pointing to OEBPS/content.opf', async () => {
    const book = makeBook();
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const container = await zip.file('META-INF/container.xml')?.async('string');
    expect(container).toBeDefined();
    expect(container).toContain('full-path="OEBPS/content.opf"');
    expect(container).toContain('media-type="application/oebps-package+xml"');
  });

  it('should include OEBPS/content.opf with metadata', async () => {
    const book = makeBook();
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const opf = await zip.file('OEBPS/content.opf')?.async('string');
    expect(opf).toBeDefined();
    expect(opf).toContain('<dc:title>Test Book</dc:title>');
    expect(opf).toContain('<dc:creator>Test Author</dc:creator>');
    expect(opf).toContain('<dc:language>en</dc:language>');
    expect(opf).toContain('<dc:publisher>Test Publisher</dc:publisher>');
    expect(opf).toContain('<dc:date>2024-01-01</dc:date>');
    expect(opf).toContain('<dc:identifier>urn:isbn:9780000000000</dc:identifier>');
  });

  it('should omit optional metadata fields when not present', async () => {
    const book = makeBook({
      metadata: { title: 'Minimal Book' },
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const opf = await zip.file('OEBPS/content.opf')?.async('string');
    expect(opf).toContain('<dc:title>Minimal Book</dc:title>');
    expect(opf).not.toContain('<dc:creator>');
    expect(opf).not.toContain('<dc:language>');
    expect(opf).not.toContain('<dc:publisher>');
    expect(opf).not.toContain('<dc:date>');
    expect(opf).not.toContain('<dc:identifier>');
  });

  it('should include manifest items for each chapter', async () => {
    const book = makeBook({
      chapters: [
        { id: 'ch1', title: 'One', order: 0, content: [] },
        { id: 'ch2', title: 'Two', order: 1, content: [] },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const opf = await zip.file('OEBPS/content.opf')?.async('string');
    expect(opf).toContain('id="ch1" href="chapter-ch1.xhtml"');
    expect(opf).toContain('id="ch2" href="chapter-ch2.xhtml"');
  });

  it('should include spine itemrefs in chapter order', async () => {
    const book = makeBook({
      chapters: [
        { id: 'ch2', title: 'Two', order: 1, content: [] },
        { id: 'ch1', title: 'One', order: 0, content: [] },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const opf = await zip.file('OEBPS/content.opf')?.async('string');
    const spine = opf!.substring(opf!.indexOf('<spine>'), opf!.indexOf('</spine>'));
    const ch1Pos = spine.indexOf('idref="ch1"');
    const ch2Pos = spine.indexOf('idref="ch2"');
    // ch1 has order 0, ch2 has order 1 — ch1 should come first in spine
    expect(ch1Pos).toBeLessThan(ch2Pos);
  });

  it('should generate XHTML content documents for each chapter', async () => {
    const book = makeBook();
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toBeDefined();
    expect(xhtml).toContain('<title>Chapter One</title>');
    expect(xhtml).toContain('<p>Hello world</p>');
  });

  it('should render headings correctly', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test',
          order: 0,
          content: [
            { type: 'heading', level: 2, children: [{ type: 'text', content: 'Section Title' }] },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('<h2>Section Title</h2>');
  });

  it('should render images correctly', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test',
          order: 0,
          content: [
            { type: 'image', src: 'img/photo.jpg', alt: 'A photo' },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('<img src="img/photo.jpg" alt="A photo"/>');
  });

  it('should render code blocks with language class', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test',
          order: 0,
          content: [
            { type: 'code-block', language: 'typescript', content: 'const x = 1;' },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('<pre><code class="language-typescript">const x = 1;</code></pre>');
  });

  it('should render ordered and unordered lists', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test',
          order: 0,
          content: [
            {
              type: 'list',
              ordered: false,
              items: [
                { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Item 1' }] }] },
                { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'Item 2' }] }] },
              ],
            },
            {
              type: 'list',
              ordered: true,
              items: [
                { children: [{ type: 'paragraph', children: [{ type: 'text', content: 'First' }] }] },
              ],
            },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('<ul>');
    expect(xhtml).toContain('<li><p>Item 1</p></li>');
    expect(xhtml).toContain('<li><p>Item 2</p></li>');
    expect(xhtml).toContain('</ul>');
    expect(xhtml).toContain('<ol>');
    expect(xhtml).toContain('<li><p>First</p></li>');
    expect(xhtml).toContain('</ol>');
  });

  it('should render OpaqueNode content verbatim', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test',
          order: 0,
          content: [
            {
              type: 'opaque',
              originalTag: 'video',
              rawContent: '<source src="movie.mp4" type="video/mp4">',
              attributes: { controls: '', width: '320' },
            },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('<video controls="" width="320"><source src="movie.mp4" type="video/mp4"></video>');
  });

  it('should render inline formatting correctly', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test',
          order: 0,
          content: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', content: 'Hello ' },
                { type: 'bold', children: [{ type: 'text', content: 'bold' }] },
                { type: 'text', content: ' and ' },
                { type: 'italic', children: [{ type: 'text', content: 'italic' }] },
                { type: 'text', content: ' and ' },
                { type: 'code', content: 'code' },
                { type: 'text', content: ' and ' },
                { type: 'link', href: 'https://example.com', children: [{ type: 'text', content: 'link' }] },
              ],
            },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('Hello <strong>bold</strong> and <em>italic</em> and <code>code</code> and <a href="https://example.com">link</a>');
  });

  it('should escape XML special characters in text content', async () => {
    const book = makeBook({
      chapters: [
        {
          id: 'ch1',
          title: 'Test & "Quotes"',
          order: 0,
          content: [
            { type: 'paragraph', children: [{ type: 'text', content: 'x < y && y > z' }] },
          ],
        },
      ],
    });
    const result = await printer.toEpub(book);
    const zip = await JSZip.loadAsync(result);

    const xhtml = await zip.file('OEBPS/chapter-ch1.xhtml')?.async('string');
    expect(xhtml).toContain('<title>Test &amp; &quot;Quotes&quot;</title>');
    expect(xhtml).toContain('<p>x &lt; y &amp;&amp; y &gt; z</p>');
  });
});
