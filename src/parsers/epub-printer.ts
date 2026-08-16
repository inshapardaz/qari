/**
 * EPUB Pretty Printer implementation.
 * Serializes the internal Book representation back into an EPUB 3.0-conformant archive.
 *
 * Output structure:
 *   mimetype (uncompressed)
 *   META-INF/container.xml
 *   OEBPS/content.opf
 *   OEBPS/chapter-{id}.xhtml (one per chapter)
 */

import JSZip from 'jszip';
import type { PrettyPrinter } from '../interfaces/parser';
import type {
  Book,
  BookMetadata,
  Chapter,
  ContentNode,
  InlineNode,
  ListItem,
  ParagraphNode,
  HeadingNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
  OpaqueNode,
} from '../models/book';

export class EPUBPrinterImpl implements Pick<PrettyPrinter, 'toEpub'> {
  async toEpub(book: Book): Promise<ArrayBuffer> {
    const zip = new JSZip();

    // mimetype must be the first file, stored uncompressed
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // META-INF/container.xml
    zip.file('META-INF/container.xml', this.generateContainerXml());

    // OEBPS/content.opf
    zip.file('OEBPS/content.opf', this.generatePackageDocument(book));

    // OEBPS/chapter-{id}.xhtml for each chapter
    for (const chapter of book.chapters) {
      const filename = `OEBPS/chapter-${chapter.id}.xhtml`;
      zip.file(filename, this.generateChapterXhtml(chapter));
    }

    return await zip.generateAsync({ type: 'arraybuffer' });
  }

  private generateContainerXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  private generatePackageDocument(book: Book): string {
    const metadata = this.generateMetadataSection(book.metadata);
    const manifest = this.generateManifestSection(book.chapters);
    const spine = this.generateSpineSection(book.chapters);

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  ${metadata}
  ${manifest}
  ${spine}
</package>`;
  }

  private generateMetadataSection(metadata: BookMetadata): string {
    const lines: string[] = [];
    lines.push('<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">');
    lines.push(`    <dc:title>${this.escapeXml(metadata.title)}</dc:title>`);

    if (metadata.author) {
      lines.push(`    <dc:creator>${this.escapeXml(metadata.author)}</dc:creator>`);
    }

    if (metadata.language) {
      lines.push(`    <dc:language>${this.escapeXml(metadata.language)}</dc:language>`);
    }

    if (metadata.publisher) {
      lines.push(`    <dc:publisher>${this.escapeXml(metadata.publisher)}</dc:publisher>`);
    }

    if (metadata.publicationDate) {
      lines.push(`    <dc:date>${this.escapeXml(metadata.publicationDate)}</dc:date>`);
    }

    if (metadata.identifier) {
      lines.push(`    <dc:identifier>${this.escapeXml(metadata.identifier)}</dc:identifier>`);
    }

    lines.push('  </metadata>');
    return lines.join('\n  ');
  }

  private generateManifestSection(chapters: Chapter[]): string {
    const lines: string[] = [];
    lines.push('<manifest>');

    for (const chapter of chapters) {
      lines.push(
        `    <item id="${this.escapeXml(chapter.id)}" href="chapter-${this.escapeXml(chapter.id)}.xhtml" media-type="application/xhtml+xml"/>`
      );
    }

    lines.push('  </manifest>');
    return lines.join('\n  ');
  }

  private generateSpineSection(chapters: Chapter[]): string {
    const lines: string[] = [];
    lines.push('<spine>');

    // Sort chapters by order for correct spine sequence
    const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
    for (const chapter of sortedChapters) {
      lines.push(`    <itemref idref="${this.escapeXml(chapter.id)}"/>`);
    }

    lines.push('  </spine>');
    return lines.join('\n  ');
  }

  private generateChapterXhtml(chapter: Chapter): string {
    const bodyContent = chapter.content
      .map((node) => this.renderContentNode(node))
      .join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${this.escapeXml(chapter.title)}</title>
</head>
<body>
    ${bodyContent}
</body>
</html>`;
  }

  private renderContentNode(node: ContentNode): string {
    switch (node.type) {
      case 'paragraph':
        return this.renderParagraph(node);
      case 'heading':
        return this.renderHeading(node);
      case 'image':
        return this.renderImage(node);
      case 'code-block':
        return this.renderCodeBlock(node);
      case 'list':
        return this.renderList(node);
      case 'opaque':
        return this.renderOpaque(node);
      default:
        return '';
    }
  }

  private renderParagraph(node: ParagraphNode): string {
    const children = this.renderInlineNodes(node.children);
    return `<p>${children}</p>`;
  }

  private renderHeading(node: HeadingNode): string {
    const tag = `h${node.level}`;
    const children = this.renderInlineNodes(node.children);
    return `<${tag}>${children}</${tag}>`;
  }

  private renderImage(node: ImageNode): string {
    const altAttr = node.alt ? ` alt="${this.escapeXml(node.alt)}"` : '';
    return `<img src="${this.escapeXml(node.src)}"${altAttr}/>`;
  }

  private renderCodeBlock(node: CodeBlockNode): string {
    const langClass = node.language ? ` class="language-${this.escapeXml(node.language)}"` : '';
    return `<pre><code${langClass}>${this.escapeXml(node.content)}</code></pre>`;
  }

  private renderList(node: ListNode): string {
    const tag = node.ordered ? 'ol' : 'ul';
    const items = node.items
      .map((item) => this.renderListItem(item))
      .join('\n');
    return `<${tag}>\n${items}\n</${tag}>`;
  }

  private renderListItem(item: ListItem): string {
    const content = item.children
      .map((node) => this.renderContentNode(node))
      .join('');
    return `<li>${content}</li>`;
  }

  private renderOpaque(node: OpaqueNode): string {
    const attrs = Object.entries(node.attributes)
      .map(([key, value]) => ` ${key}="${this.escapeXml(value)}"`)
      .join('');
    return `<${node.originalTag}${attrs}>${node.rawContent}</${node.originalTag}>`;
  }

  private renderInlineNodes(nodes: InlineNode[]): string {
    return nodes.map((node) => this.renderInlineNode(node)).join('');
  }

  private renderInlineNode(node: InlineNode): string {
    switch (node.type) {
      case 'text':
        return this.escapeXml(node.content);
      case 'bold':
        return `<strong>${this.renderInlineNodes(node.children)}</strong>`;
      case 'italic':
        return `<em>${this.renderInlineNodes(node.children)}</em>`;
      case 'code':
        return `<code>${this.escapeXml(node.content)}</code>`;
      case 'link':
        return `<a href="${this.escapeXml(node.href)}">${this.renderInlineNodes(node.children)}</a>`;
      default:
        return '';
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
