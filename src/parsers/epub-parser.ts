/**
 * EPUB Parser implementation.
 * Parses EPUB files (ZIP archives) into the internal Book representation.
 *
 * EPUB structure: ZIP → META-INF/container.xml → rootfile (.opf) → spine + manifest + metadata
 */

import JSZip from 'jszip';
import type { EPUBParser } from '../interfaces/parser';
import type {
  Book,
  BookMetadata,
  Chapter,
  ContentNode,
  InlineNode,
  ListItem,
  OpaqueNode,
  ParagraphNode,
  HeadingNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
} from '../models/book';

/** Structured error for EPUB parse failures */
export class EPUBParseError extends Error {
  public readonly source: string;
  public readonly format: string;
  public readonly reason: string;

  constructor(source: string, format: string, reason: string) {
    super(`EPUB parse error: ${reason}`);
    this.name = 'EPUBParseError';
    this.source = source;
    this.format = format;
    this.reason = reason;
  }
}

/** Elements that should be preserved as OpaqueNode */
const OPAQUE_ELEMENTS = new Set(['audio', 'video', 'script', 'embed', 'object']);

export class EPUBParserImpl implements EPUBParser {
  async parse(data: ArrayBuffer): Promise<Book> {
    const zip = await this.loadZip(data);
    const containerDoc = await this.getContainerXml(zip);
    const rootfilePath = this.getRootfilePath(containerDoc);
    const opfContent = await this.getFileContent(zip, rootfilePath);
    const opfDoc = this.parseXml(opfContent, 'OPF package document');
    const opfDir = rootfilePath.includes('/')
      ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/'))
      : '';

    const metadata = this.extractMetadata(opfDoc);
    const manifest = this.extractManifest(opfDoc);
    const { itemRefs: spineItemRefs, pageDirection } = this.extractSpine(opfDoc);

    if (pageDirection) {
      metadata.pageDirection = pageDirection;
    }

    const chapters = await this.buildChapters(spineItemRefs, manifest, opfDir, zip);

    return { metadata, chapters };
  }

  private async loadZip(data: ArrayBuffer): Promise<JSZip> {
    try {
      return await JSZip.loadAsync(data);
    } catch (e) {
      throw new EPUBParseError(
        'epub',
        'epub',
        `Failed to decompress EPUB archive: ${e instanceof Error ? e.message : 'unknown error'}`
      );
    }
  }

  private async getContainerXml(zip: JSZip): Promise<Document> {
    const containerPath = 'META-INF/container.xml';
    const content = await this.getFileContent(zip, containerPath);
    return this.parseXml(content, 'container.xml');
  }

  private getRootfilePath(containerDoc: Document): string {
    const rootfileEl = containerDoc.getElementsByTagName('rootfile')[0];
    if (!rootfileEl) {
      throw new EPUBParseError(
        'epub',
        'epub',
        'No rootfile element found in container.xml'
      );
    }
    const fullPath = rootfileEl.getAttribute('full-path');
    if (!fullPath) {
      throw new EPUBParseError(
        'epub',
        'epub',
        'Rootfile element missing full-path attribute'
      );
    }
    return fullPath;
  }

  private async getFileContent(zip: JSZip, path: string): Promise<string> {
    const file = zip.file(path);
    if (!file) {
      throw new EPUBParseError(
        'epub',
        'epub',
        `Required file not found in EPUB archive: ${path}`
      );
    }
    return await file.async('string');
  }

  private parseXml(content: string, description: string): Document {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new EPUBParseError(
        'epub',
        'epub',
        `Malformed XML in ${description}: ${parseError.textContent?.substring(0, 200) || 'parse error'}`
      );
    }
    return doc;
  }

  private extractMetadata(opfDoc: Document): BookMetadata {
    const metadataEl = opfDoc.getElementsByTagName('metadata')[0];
    if (!metadataEl) {
      throw new EPUBParseError(
        'epub',
        'epub',
        'No metadata element found in OPF package document'
      );
    }

    const title = this.getDcElement(metadataEl, 'title') || 'Untitled';
    const author = this.getDcElement(metadataEl, 'creator');
    const language = this.getDcElement(metadataEl, 'language');
    const publisher = this.getDcElement(metadataEl, 'publisher');
    const publicationDate = this.getDcElement(metadataEl, 'date');

    return {
      title,
      ...(author && { author }),
      ...(language && { language }),
      ...(publisher && { publisher }),
      ...(publicationDate && { publicationDate }),
    };
  }

  private getDcElement(metadataEl: Element, localName: string): string | undefined {
    // Try dc: prefixed elements with namespace
    const elements = metadataEl.getElementsByTagNameNS(
      'http://purl.org/dc/elements/1.1/',
      localName
    );
    if (elements.length > 0 && elements[0].textContent) {
      return elements[0].textContent.trim();
    }
    // Fallback: try without namespace
    const fallback = metadataEl.getElementsByTagName(`dc:${localName}`);
    if (fallback.length > 0 && fallback[0].textContent) {
      return fallback[0].textContent.trim();
    }
    return undefined;
  }

  private extractManifest(opfDoc: Document): Map<string, { href: string; mediaType: string }> {
    const manifest = new Map<string, { href: string; mediaType: string }>();
    const manifestEl = opfDoc.getElementsByTagName('manifest')[0];
    if (!manifestEl) {
      throw new EPUBParseError(
        'epub',
        'epub',
        'No manifest element found in OPF package document'
      );
    }

    const items = manifestEl.getElementsByTagName('item');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type') || '';
      if (id && href) {
        manifest.set(id, { href, mediaType });
      }
    }
    return manifest;
  }

  private extractSpine(opfDoc: Document): { itemRefs: string[]; pageDirection?: 'ltr' | 'rtl' } {
    const spineEl = opfDoc.getElementsByTagName('spine')[0];
    if (!spineEl) {
      throw new EPUBParseError(
        'epub',
        'epub',
        'No spine element found in OPF package document'
      );
    }

    // Extract page-progression-direction attribute
    const ppd = spineEl.getAttribute('page-progression-direction');
    const pageDirection: 'ltr' | 'rtl' | undefined =
      ppd === 'rtl' ? 'rtl' : ppd === 'ltr' ? 'ltr' : undefined;

    const itemRefs: string[] = [];
    const refs = spineEl.getElementsByTagName('itemref');
    for (let i = 0; i < refs.length; i++) {
      const idref = refs[i].getAttribute('idref');
      if (idref) {
        itemRefs.push(idref);
      }
    }

    if (itemRefs.length === 0) {
      throw new EPUBParseError(
        'epub',
        'epub',
        'Spine contains no itemref elements'
      );
    }

    return { itemRefs, pageDirection };
  }

  private async buildChapters(
    spineItemRefs: string[],
    manifest: Map<string, { href: string; mediaType: string }>,
    opfDir: string,
    zip: JSZip
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];

    for (let i = 0; i < spineItemRefs.length; i++) {
      const idref = spineItemRefs[i];
      const manifestItem = manifest.get(idref);
      if (!manifestItem) {
        throw new EPUBParseError(
          'epub',
          'epub',
          `Spine references manifest item "${idref}" which does not exist`
        );
      }

      const contentPath = opfDir
        ? `${opfDir}/${manifestItem.href}`
        : manifestItem.href;

      const xhtmlContent = await this.getFileContent(zip, contentPath);
      const contentDoc = this.parseXml(xhtmlContent, `content document: ${contentPath}`);

      const title = this.extractChapterTitle(contentDoc, idref);
      const content = this.parseContentDocument(contentDoc);

      chapters.push({
        id: idref,
        title,
        order: i,
        content,
      });
    }

    return chapters;
  }

  private extractChapterTitle(doc: Document, fallbackId: string): string {
    // Try to find a title from the document's <title> element
    const titleEl = doc.getElementsByTagName('title')[0];
    if (titleEl && titleEl.textContent?.trim()) {
      return titleEl.textContent.trim();
    }

    // Try the first heading
    for (let level = 1; level <= 6; level++) {
      const headings = doc.getElementsByTagName(`h${level}`);
      if (headings.length > 0 && headings[0].textContent?.trim()) {
        return headings[0].textContent.trim();
      }
    }

    return fallbackId;
  }

  private parseContentDocument(doc: Document): ContentNode[] {
    const body = doc.getElementsByTagName('body')[0];
    if (!body) {
      return [];
    }
    return this.parseBlockChildren(body);
  }

  private parseBlockChildren(parent: Element): ContentNode[] {
    const nodes: ContentNode[] = [];

    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i];

      if (child.nodeType === 3 /* TEXT_NODE */) {
        const text = child.textContent?.trim();
        if (text) {
          nodes.push({
            type: 'paragraph',
            children: [{ type: 'text', content: text }],
          } as ParagraphNode);
        }
        continue;
      }

      if (child.nodeType !== 1 /* ELEMENT_NODE */) {
        continue;
      }

      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      // Container elements: recurse to extract their block children
      if (this.isContainerElement(tagName)) {
        const nestedNodes = this.parseBlockChildren(el);
        nodes.push(...nestedNodes);
        continue;
      }

      const contentNode = this.elementToContentNode(el, tagName);
      if (contentNode) {
        nodes.push(contentNode);
      }
    }

    return nodes;
  }

  private isContainerElement(tagName: string): boolean {
    return tagName === 'div' || tagName === 'section' || tagName === 'article' ||
           tagName === 'main' || tagName === 'aside' || tagName === 'nav' ||
           tagName === 'header' || tagName === 'footer' || tagName === 'figure' ||
           tagName === 'blockquote';
  }

  private elementToContentNode(el: Element, tagName: string): ContentNode | null {
    // Opaque elements
    if (OPAQUE_ELEMENTS.has(tagName)) {
      return this.createOpaqueNode(el, tagName);
    }

    // Headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6;
      return {
        type: 'heading',
        level,
        children: this.parseInlineChildren(el),
      } as HeadingNode;
    }

    // Paragraphs
    if (tagName === 'p') {
      return {
        type: 'paragraph',
        children: this.parseInlineChildren(el),
      } as ParagraphNode;
    }

    // Code blocks: <pre> containing <code>
    if (tagName === 'pre') {
      return this.parsePreElement(el);
    }

    // Lists
    if (tagName === 'ul' || tagName === 'ol') {
      return this.parseListElement(el, tagName === 'ol');
    }

    // Images
    if (tagName === 'img') {
      return this.createImageNode(el);
    }

    // Fallback: if the element has text content, wrap it as a paragraph
    const textContent = el.textContent?.trim();
    if (textContent) {
      return {
        type: 'paragraph',
        children: this.parseInlineChildren(el),
      } as ParagraphNode;
    }

    return null;
  }

  private createOpaqueNode(el: Element, tagName: string): OpaqueNode {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      attributes[attr.name] = attr.value;
    }

    return {
      type: 'opaque',
      originalTag: tagName,
      rawContent: el.innerHTML,
      attributes,
    };
  }

  private createImageNode(el: Element): ImageNode {
    return {
      type: 'image',
      src: el.getAttribute('src') || '',
      ...(el.getAttribute('alt') && { alt: el.getAttribute('alt')! }),
    };
  }

  private parsePreElement(el: Element): CodeBlockNode {
    const codeEl = el.getElementsByTagName('code')[0];
    if (codeEl) {
      const language = this.extractLanguageFromClass(codeEl);
      return {
        type: 'code-block',
        content: codeEl.textContent || '',
        ...(language && { language }),
      };
    }
    return {
      type: 'code-block',
      content: el.textContent || '',
    };
  }

  private extractLanguageFromClass(el: Element): string | undefined {
    const className = el.getAttribute('class') || '';
    const match = className.match(/(?:language-|lang-)(\w+)/);
    return match ? match[1] : undefined;
  }

  private parseListElement(el: Element, ordered: boolean): ListNode {
    const items: ListItem[] = [];
    const listItems = el.getElementsByTagName('li');

    for (let i = 0; i < listItems.length; i++) {
      // Only process direct child <li> elements
      if (listItems[i].parentElement === el) {
        const children = this.parseBlockChildrenForListItem(listItems[i]);
        items.push({ children });
      }
    }

    return {
      type: 'list',
      ordered,
      items,
    };
  }

  private parseBlockChildrenForListItem(li: Element): ContentNode[] {
    const nodes: ContentNode[] = [];
    let hasBlockChildren = false;

    for (let i = 0; i < li.childNodes.length; i++) {
      const child = li.childNodes[i];
      if (child.nodeType === 1) {
        const el = child as Element;
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'p' || tagName === 'ul' || tagName === 'ol' ||
            tagName === 'pre' || /^h[1-6]$/.test(tagName)) {
          hasBlockChildren = true;
          break;
        }
      }
    }

    if (hasBlockChildren) {
      return this.parseBlockChildren(li);
    }

    // Treat as inline content wrapped in a paragraph
    const inlineNodes = this.parseInlineChildren(li);
    if (inlineNodes.length > 0) {
      nodes.push({
        type: 'paragraph',
        children: inlineNodes,
      } as ParagraphNode);
    }
    return nodes;
  }

  private parseInlineChildren(el: Element): InlineNode[] {
    const inlineNodes: InlineNode[] = [];

    for (let i = 0; i < el.childNodes.length; i++) {
      const child = el.childNodes[i];

      if (child.nodeType === 3 /* TEXT_NODE */) {
        const content = child.textContent || '';
        if (content) {
          inlineNodes.push({ type: 'text', content });
        }
        continue;
      }

      if (child.nodeType !== 1 /* ELEMENT_NODE */) {
        continue;
      }

      const childEl = child as Element;
      const tagName = childEl.tagName.toLowerCase();

      const inlineNode = this.elementToInlineNode(childEl, tagName);
      if (inlineNode) {
        inlineNodes.push(inlineNode);
      }
    }

    return inlineNodes;
  }

  private elementToInlineNode(el: Element, tagName: string): InlineNode | null {
    // Bold
    if (tagName === 'strong' || tagName === 'b') {
      return {
        type: 'bold',
        children: this.parseInlineChildren(el),
      };
    }

    // Italic
    if (tagName === 'em' || tagName === 'i') {
      return {
        type: 'italic',
        children: this.parseInlineChildren(el),
      };
    }

    // Links
    if (tagName === 'a') {
      return {
        type: 'link',
        href: el.getAttribute('href') || '',
        children: this.parseInlineChildren(el),
      };
    }

    // Inline code
    if (tagName === 'code') {
      return {
        type: 'code',
        content: el.textContent || '',
      };
    }

    // Images within inline context - skip (handled at block level)
    if (tagName === 'img') {
      return null;
    }

    // For <span> and other inline wrappers, recurse into children
    if (tagName === 'span' || tagName === 'sub' || tagName === 'sup' ||
        tagName === 'small' || tagName === 'mark' || tagName === 'u' ||
        tagName === 'del' || tagName === 's' || tagName === 'abbr' ||
        tagName === 'cite' || tagName === 'q') {
      // Flatten children into parent inline context
      const children = this.parseInlineChildren(el);
      if (children.length === 1) {
        return children[0];
      }
      // Return as text if multiple children
      if (children.length > 0) {
        return { type: 'text', content: el.textContent || '' };
      }
      return null;
    }

    // Fallback: extract text content
    const text = el.textContent || '';
    if (text) {
      return { type: 'text', content: text };
    }
    return null;
  }
}
