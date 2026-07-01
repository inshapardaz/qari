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
  InlineImageSpan,
  FootnoteRefSpan,
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

/** Internal type extending Chapter with the base directory for image path resolution */
interface ChapterWithBaseDir extends Chapter {
  _baseDir: string;
}

export class EPUBParserImpl implements EPUBParser {
  /** The current document being parsed, used for footnote resolution */
  private currentDoc: Document | null = null;
  /** The ZIP archive, stored during parsing for cross-document footnote resolution */
  private zip: JSZip | null = null;
  /** The base directory of the current content file being parsed */
  private currentBaseDir: string = '';
  /** Cache of all parsed content documents, keyed by their path in the ZIP */
  private docCache: Map<string, Document> = new Map();

  async parse(data: ArrayBuffer): Promise<Book> {
    const zip = await this.loadZip(data);
    this.zip = zip;
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

    // Resolve image sources: extract from ZIP and convert to blob URLs
    await this.resolveImageSources(chapters, zip);

    // Build footnote map: collect all elements with IDs from all cached documents
    // so that internal links can be resolved at runtime in the Reader
    const footnoteMap = this.buildFootnoteMap();

    return { metadata, chapters, footnoteMap };
  }

  /**
   * Walks all content nodes in chapters, finds ImageNodes, and resolves
   * their relative src to blob URLs by extracting from the ZIP.
   */
  private async resolveImageSources(
    chapters: ChapterWithBaseDir[],
    zip: JSZip
  ): Promise<void> {
    const blobUrlCache = new Map<string, string>();

    let totalImages = 0;
    let resolvedImages = 0;

    for (const chapter of chapters) {
      const counts = await this.resolveImagesInNodes(chapter.content, chapter._baseDir, zip, blobUrlCache);
      totalImages += counts.total;
      resolvedImages += counts.resolved;
    }
  }

  /**
   * Builds a map of element IDs to their parsed inline content from all cached documents.
   * This allows the Reader to resolve internal links at click time even when the parser
   * couldn't resolve them during initial parsing.
   */
  private buildFootnoteMap(): Map<string, InlineNode[]> {
    const map = new Map<string, InlineNode[]>();

    for (const [, doc] of this.docCache) {
      this.collectElementsWithIds(doc.documentElement, map);
    }

    return map;
  }

  /**
   * Recursively collects all elements with an `id` attribute and stores their
   * parsed inline content in the map.
   */
  private collectElementsWithIds(el: Element, map: Map<string, InlineNode[]>): void {
    const id = el.getAttribute('id');
    if (id) {
      // Parse the element's inline content
      const content = this.parseInlineChildren(el);
      if (content.length > 0) {
        map.set(id, content);
      }
    }

    // Recurse into children
    for (let i = 0; i < el.children.length; i++) {
      this.collectElementsWithIds(el.children[i], map);
    }
  }

  private async resolveImagesInNodes(
    nodes: ContentNode[],
    baseDir: string,
    zip: JSZip,
    cache: Map<string, string>
  ): Promise<{ total: number; resolved: number }> {
    let total = 0;
    let resolved = 0;

    for (const node of nodes) {
      if (node.type === 'image' && node.src && !node.src.startsWith('data:') && !node.src.startsWith('blob:') && !node.src.startsWith('http')) {
        total++;
        const resolvedPath = this.resolveRelativePath(baseDir, node.src);
        
        if (cache.has(resolvedPath)) {
          node.src = cache.get(resolvedPath)!;
          resolved++;
        } else {
          const blobUrl = await this.extractImageAsBlob(zip, resolvedPath);
          if (blobUrl) {
            cache.set(resolvedPath, blobUrl);
            node.src = blobUrl;
            resolved++;

          } 
        }
      } else if (node.type === 'list') {
        for (const item of node.items) {
          const counts = await this.resolveImagesInNodes(item.children, baseDir, zip, cache);
          total += counts.total;
          resolved += counts.resolved;
        }
      } else if (node.type === 'paragraph' || node.type === 'heading') {
        // Walk inline children for inline-image nodes
        const inlineCounts = await this.resolveInlineImages(node.children, baseDir, zip, cache);
        total += inlineCounts.total;
        resolved += inlineCounts.resolved;
      }
    }

    return { total, resolved };
  }

  private async resolveInlineImages(
    nodes: InlineNode[],
    baseDir: string,
    zip: JSZip,
    cache: Map<string, string>
  ): Promise<{ total: number; resolved: number }> {
    let total = 0;
    let resolved = 0;

    for (const node of nodes) {
      if (node.type === 'inline-image' && node.src && !node.src.startsWith('data:') && !node.src.startsWith('blob:') && !node.src.startsWith('http')) {
        total++;
        const resolvedPath = this.resolveRelativePath(baseDir, node.src);
        
        if (cache.has(resolvedPath)) {
          node.src = cache.get(resolvedPath)!;
          resolved++;
        } else {
          const blobUrl = await this.extractImageAsBlob(zip, resolvedPath);
          if (blobUrl) {
            cache.set(resolvedPath, blobUrl);
            node.src = blobUrl;
            resolved++;
          }
        }
      } else if (node.type === 'bold' || node.type === 'italic' || node.type === 'link') {
        const counts = await this.resolveInlineImages(node.children, baseDir, zip, cache);
        total += counts.total;
        resolved += counts.resolved;
      } else if (node.type === 'footnote-ref') {
        const counts = await this.resolveInlineImages(node.content, baseDir, zip, cache);
        total += counts.total;
        resolved += counts.resolved;
      }
    }

    return { total, resolved };
  }

  private resolveRelativePath(baseDir: string, relativeSrc: string): string {
    // Handle ../ prefixes
    const parts = (baseDir ? baseDir + '/' + relativeSrc : relativeSrc).split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.' && part !== '') {
        resolved.push(part);
      }
    }
    return resolved.join('/');
  }

  private async extractImageAsBlob(zip: JSZip, path: string): Promise<string | null> {
    const file = zip.file(path);
    if (!file) {
      // Try case-insensitive lookup
      const allFiles = Object.keys(zip.files);
      const match = allFiles.find(f => f.toLowerCase() === path.toLowerCase());
      if (match) {
        const matchedFile = zip.file(match);
        if (matchedFile) {
          const blob = await matchedFile.async('blob');
          return URL.createObjectURL(blob);
        }
      }
      return null;
    }
    const blob = await file.async('blob');
    return URL.createObjectURL(blob);
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
  ): Promise<ChapterWithBaseDir[]> {
    const chapters: ChapterWithBaseDir[] = [];

    // Pre-cache all XHTML/HTML content documents from the manifest for cross-document
    // footnote resolution. This allows synchronous lookup during inline parsing.
    this.docCache.clear();
    for (const [, item] of manifest) {
      if (item.mediaType.includes('xhtml') || item.mediaType.includes('html')) {
        const path = opfDir ? `${opfDir}/${item.href}` : item.href;
        try {
          const content = await this.getFileContent(zip, path);
          const doc = this.parseXml(content, `content document: ${path}`);
          this.docCache.set(path, doc);
        } catch {
          // Skip documents that fail to parse — not all manifest items are valid content
        }
      }
    }

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

      // Directory of the content file — used to resolve relative image paths
      const contentDir = contentPath.includes('/')
        ? contentPath.substring(0, contentPath.lastIndexOf('/'))
        : '';

      const contentDoc = this.docCache.get(contentPath);
      if (!contentDoc) {
        const xhtmlContent = await this.getFileContent(zip, contentPath);
        const parsedDoc = this.parseXml(xhtmlContent, `content document: ${contentPath}`);
        this.docCache.set(contentPath, parsedDoc);
      }
      const doc = this.docCache.get(contentPath)!;

      const title = this.extractChapterTitle(doc, idref);
      this.currentBaseDir = contentDir;
      const content = this.parseContentDocument(doc);

      const imageCount = content.filter(n => n.type === 'image').length;

      chapters.push({
        id: idref,
        title,
        order: i,
        content,
        _baseDir: contentDir,
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
    this.currentDoc = doc;
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

      // Skip aside elements that are footnote/endnote containers
      // (their content is shown in popovers, not inline)
      if (tagName === 'aside' && this.isFootnoteElement(el)) {
        continue;
      }

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

  /**
   * Checks if an element is a footnote/endnote container that should be excluded
   * from the main content flow (its content is resolved into popovers instead).
   */
  private isFootnoteElement(el: Element): boolean {
    // Must have an id (so it can be referenced by a link)
    if (!el.getAttribute('id')) return false;

    // Check epub:type
    const epubType = el.getAttribute('epub:type') || el.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '';
    if (epubType.includes('footnote') || epubType.includes('endnote') || epubType.includes('rearnote')) {
      return true;
    }

    // Check DPUB-ARIA role
    const role = el.getAttribute('role') || '';
    if (role === 'doc-footnote' || role === 'doc-endnote') {
      return true;
    }

    // Check class/id patterns
    const className = (el.getAttribute('class') || '').toLowerCase();
    const id = (el.getAttribute('id') || '').toLowerCase();
    const footnotePatterns = ['footnote', 'endnote', 'rearnote'];
    const shortPatterns = [/^fn\d/, /^note\d/, /^en\d/];

    for (const pattern of footnotePatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }

    for (const pattern of shortPatterns) {
      if (pattern.test(id)) {
        return true;
      }
    }

    return false;
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
      const href = el.getAttribute('href') || '';
      const epubType = el.getAttribute('epub:type') || el.getAttributeNS('http://www.idpf.org/2007/ops', 'type');
      const role = el.getAttribute('role') || '';

      // Check if this is a footnote reference:
      // 1. epub:type="noteref" (EPUB3 formal)
      // 2. role="doc-noteref" (DPUB-ARIA)
      // 3. Same-document fragment link (#...) whose target looks like a footnote
      // 4. Same-document fragment link (#...) where the link itself looks like a footnote ref
      //    (short numeric/symbol content, or wrapped in <sup>)
      // 5. Cross-document fragment link (file.xhtml#id) that resolves to footnote content
      const isExplicitNoteref = epubType === 'noteref' || role === 'doc-noteref';
      const hasFragment = href.includes('#') && href.length > 1;

      if (isExplicitNoteref || hasFragment) {
        const footnoteContent = this.resolveFootnoteContent(href);
        if (footnoteContent) {
          // For explicit noterefs, always treat as footnote
          // For implicit links, treat as footnote if:
          //   - the target element looks like a footnote, OR
          //   - the link itself looks like a footnote reference (numeric label, in <sup>, etc.)
          if (isExplicitNoteref || this.isFootnoteTarget(href) || this.looksLikeFootnoteRef(el)) {
            return {
              type: 'footnote-ref',
              label: el.textContent?.trim() || '',
              content: footnoteContent,
            } as FootnoteRefSpan;
          }
        }
        // Fallback to LinkSpan if resolution fails or target isn't a footnote
      }
      return {
        type: 'link',
        href,
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

    // Inline images
    if (tagName === 'img') {
      return {
        type: 'inline-image',
        src: el.getAttribute('src') || '',
        ...(el.getAttribute('alt') && { alt: el.getAttribute('alt')! }),
      } as InlineImageSpan;
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

  /**
   * Resolves footnote content from a href within the current or a referenced document.
   * Handles both same-document fragment refs (#id) and cross-document refs (file.xhtml#id).
   * Returns parsed inline nodes from the target element, or null if unresolvable.
   */
  private resolveFootnoteContent(href: string): InlineNode[] | null {
    if (!this.currentDoc) return null;

    // Same-document fragment refs (#fn1)
    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      const targetEl = this.findElementById(this.currentDoc, targetId);
      if (!targetEl) return null;
      return this.parseInlineChildren(targetEl);
    }

    // Cross-document refs (e.g., "notes.xhtml#fn1" or "../notes/fn.xhtml#note1")
    if (href.includes('#')) {
      const hashIdx = href.indexOf('#');
      const filePart = href.substring(0, hashIdx);
      const fragmentId = href.substring(hashIdx + 1);
      if (!filePart || !fragmentId) return null;

      // Resolve relative path from current document's base directory
      const resolvedPath = this.resolveRelativePath(this.currentBaseDir, filePart);

      const cachedDoc = this.docCache.get(resolvedPath);
      if (cachedDoc) {
        const targetEl = this.findElementById(cachedDoc, fragmentId);
        if (!targetEl) return null;
        return this.parseInlineChildren(targetEl);
      }
    }

    return null;
  }

  /**
   * Finds an element by its id attribute. Works in both HTML and XML parsing modes.
   * In XML mode, getElementById may fail because the parser doesn't know which
   * attributes are IDs without a DTD. This method falls back to querySelector.
   */
  private findElementById(doc: Document, id: string): Element | null {
    // Try getElementById first (works in HTML mode or with DTD)
    const el = doc.getElementById(id);
    if (el) return el;

    // Fallback: use querySelector with attribute selector (works in XML mode)
    try {
      return doc.querySelector(`[id="${id}"]`);
    } catch {
      // If querySelector fails (e.g., special characters in id), try manual traversal
      return this.findElementByIdManual(doc.documentElement, id);
    }
  }

  /**
   * Manual DOM traversal to find an element by id attribute.
   * Last resort when getElementById and querySelector both fail.
   */
  private findElementByIdManual(root: Element, id: string): Element | null {
    if (root.getAttribute('id') === id) return root;
    for (let i = 0; i < root.children.length; i++) {
      const found = this.findElementByIdManual(root.children[i], id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Determines if a same-document fragment target looks like a footnote/endnote.
   * Checks:
   * - Target element's epub:type contains "footnote" or "endnote"
   * - Target element's role is "doc-footnote" or "doc-endnote"
   * - Target element is an <aside> (commonly used for footnotes)
   * - Target element's class or id contains "footnote", "endnote", "note", or "fn"
   */
  private isFootnoteTarget(href: string): boolean {
    if (!this.currentDoc) return false;

    let targetEl: Element | null = null;

    if (href.startsWith('#')) {
      const targetId = href.slice(1);
      targetEl = this.findElementById(this.currentDoc, targetId);
    } else if (href.includes('#')) {
      const hashIdx = href.indexOf('#');
      const filePart = href.substring(0, hashIdx);
      const fragmentId = href.substring(hashIdx + 1);
      if (!filePart || !fragmentId) return false;
      const resolvedPath = this.resolveRelativePath(this.currentBaseDir, filePart);
      const cachedDoc = this.docCache.get(resolvedPath);
      if (cachedDoc) {
        targetEl = this.findElementById(cachedDoc, fragmentId);
      }
    }

    if (!targetEl) return false;

    // Check epub:type attribute
    const epubType = targetEl.getAttribute('epub:type') || targetEl.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '';
    if (epubType.includes('footnote') || epubType.includes('endnote') || epubType.includes('rearnote')) {
      return true;
    }

    // Check DPUB-ARIA role
    const role = targetEl.getAttribute('role') || '';
    if (role === 'doc-footnote' || role === 'doc-endnote') {
      return true;
    }

    // Check if target is an <aside> element (common footnote container)
    if (targetEl.tagName.toLowerCase() === 'aside') {
      return true;
    }

    // Check class/id patterns for common footnote conventions
    const className = (targetEl.getAttribute('class') || '').toLowerCase();
    const id = (targetEl.getAttribute('id') || '').toLowerCase();
    const footnotePatterns = ['footnote', 'endnote', 'rearnote'];
    const shortPatterns = [/^fn\d/, /^note\d/, /^en\d/];

    for (const pattern of footnotePatterns) {
      if (className.includes(pattern) || id.includes(pattern)) {
        return true;
      }
    }

    for (const pattern of shortPatterns) {
      if (pattern.test(id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines if a link element itself looks like a footnote reference based on
   * its content and context. This catches plain bookmark links like <a href="#fn1">1</a>
   * or <sup><a href="#note">2</a></sup> that don't have explicit footnote attributes.
   *
   * Heuristics:
   * - Link text is a short number (1-4 digits), optionally with brackets/symbols
   * - Link is wrapped in a <sup> parent element
   * - Link's class contains "footnote", "noteref", or similar
   */
  private looksLikeFootnoteRef(el: Element): boolean {
    const text = (el.textContent || '').trim();

    // Check if the link's class/id suggests it's a footnote reference
    const className = (el.getAttribute('class') || '').toLowerCase();
    const id = (el.getAttribute('id') || '').toLowerCase();
    if (className.includes('footnote') || className.includes('noteref') ||
        className.includes('note-ref') || className.includes('fn-ref') ||
        id.includes('fnref') || id.includes('noteref')) {
      return true;
    }

    // Check if parent is <sup> (common pattern: <sup><a href="#fn1">1</a></sup>)
    const parent = el.parentElement;
    if (parent && parent.tagName.toLowerCase() === 'sup') {
      return true;
    }

    // Check if the link text looks like a footnote marker:
    // - Pure number: "1", "23", "142"
    // - Bracketed number: "[1]", "(2)", "{3}"
    // - Number with common symbols: "1*", "†", "‡", "§", "*"
    // - Roman numerals: "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"
    const footnoteRefPattern = /^[\[\(]?\d{1,4}[\]\)]?[*†‡§]?$/;
    const symbolPattern = /^[*†‡§¶‖]+$/;
    const romanPattern = /^[ivxlc]{1,5}$/i;

    if (footnoteRefPattern.test(text) || symbolPattern.test(text) || romanPattern.test(text)) {
      return true;
    }

    return false;
  }
}
