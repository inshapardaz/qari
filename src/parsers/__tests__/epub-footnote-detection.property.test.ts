/**
 * Property 2: EPUB noteref detection produces correct FootnoteRefSpan
 *
 * For any EPUB document containing an `<a>` element with `epub:type="noteref"`
 * and a resolvable same-document fragment target, the parser SHALL produce a
 * FootnoteRefSpan whose `label` equals the anchor's text content and whose
 * `content` contains the parsed inline nodes from the target element.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import JSZip from 'jszip';
import { EPUBParserImpl } from '../epub-parser';
import type {
  InlineNode,
  FootnoteRefSpan,
  ParagraphNode,
} from '../../models/book';

// --- Arbitraries ---

/** Generate a safe XML identifier for use as element IDs */
const xmlIdArb = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom('fn', 'note', 'footnote', 'endnote', 'ref'),
      fc.nat({ max: 999 })
    )
    .map(([prefix, num]) => `${prefix}${num}`);

/** Generate safe text for labels (non-empty, no XML special chars) */
const labelArb = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 999 }),
      fc.constantFrom('', '*', '†', '‡')
    )
    .map(([num, suffix]) => `${num}${suffix}`);

/** Generate safe footnote body text (non-empty, safe for XML) */
const footnoteTextArb = (): fc.Arbitrary<string> =>
  fc
    .array(
      fc.constantFrom(
        'This is a footnote.',
        'See the reference.',
        'Author note.',
        'Published in 2024.',
        'Translated from the original.',
        'Emphasis added.',
        'Citation needed.',
        'Ibid.',
        'Op. cit.',
        'Further reading available.'
      ),
      { minLength: 1, maxLength: 3 }
    )
    .map((parts) => parts.join(' '));

/** Generate content for the footnote target element - can include inline formatting */
interface FootnoteTargetDef {
  html: string;
  expectedTextContent: string;
}

const footnoteTargetArb = (): fc.Arbitrary<FootnoteTargetDef> =>
  fc.oneof(
    // Plain text footnote
    footnoteTextArb().map((text) => ({
      html: text,
      expectedTextContent: text,
    })),
    // Footnote with bold content
    fc
      .tuple(footnoteTextArb(), footnoteTextArb())
      .map(([before, bold]) => ({
        html: `${before} <strong>${bold}</strong>`,
        expectedTextContent: `${before} ${bold}`,
      })),
    // Footnote with italic content
    fc
      .tuple(footnoteTextArb(), footnoteTextArb())
      .map(([before, italic]) => ({
        html: `${before} <em>${italic}</em>`,
        expectedTextContent: `${before} ${italic}`,
      }))
  );

/** Generate the data for a noteref + target pair */
interface NoterefTestCase {
  targetId: string;
  label: string;
  target: FootnoteTargetDef;
}

const noterefTestCaseArb = (): fc.Arbitrary<NoterefTestCase> =>
  fc.tuple(xmlIdArb(), labelArb(), footnoteTargetArb()).map(([targetId, label, target]) => ({
    targetId,
    label,
    target,
  }));

// --- Helper ---

/**
 * Creates a minimal valid EPUB buffer containing a noteref anchor and its target.
 */
async function createEpubWithNoteref(testCase: NoterefTestCase): Promise<ArrayBuffer> {
  const { targetId, label, target } = testCase;

  const chapterContent = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Chapter with footnote</title></head>
<body>
  <p>Some text before the reference <a epub:type="noteref" href="#${targetId}">${label}</a> and after.</p>
  <aside id="${targetId}" epub:type="footnote">${target.html}</aside>
</body>
</html>`;

  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Footnote Book</dc:title>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

  const zip = new JSZip();
  zip.file('META-INF/container.xml', containerXml);
  zip.file('OEBPS/content.opf', opfContent);
  zip.file('OEBPS/chapter1.xhtml', chapterContent);

  return await zip.generateAsync({ type: 'arraybuffer' });
}

/** Extract all inline nodes of a given type from a flat array */
function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.content;
        case 'bold':
        case 'italic':
        case 'link':
          return extractInlineText(node.children);
        case 'code':
          return node.content;
        case 'footnote-ref':
          return node.label;
        case 'inline-image':
          return '';
        default:
          return '';
      }
    })
    .join('');
}

/** Find all FootnoteRefSpan nodes in parsed chapter content */
function findFootnoteRefs(nodes: InlineNode[]): FootnoteRefSpan[] {
  const refs: FootnoteRefSpan[] = [];
  for (const node of nodes) {
    if (node.type === 'footnote-ref') {
      refs.push(node);
    } else if (node.type === 'bold' || node.type === 'italic' || node.type === 'link') {
      refs.push(...findFootnoteRefs(node.children));
    }
  }
  return refs;
}

// --- Property Test ---

describe('Feature: footnote-popover, Property 2: EPUB noteref detection produces correct FootnoteRefSpan', () => {
  const parser = new EPUBParserImpl();

  it('produces a FootnoteRefSpan with correct label and content for any noteref with resolvable target', async () => {
    await fc.assert(
      fc.asyncProperty(noterefTestCaseArb(), async (testCase) => {
        const epubBuffer = await createEpubWithNoteref(testCase);
        const book = await parser.parse(epubBuffer);

        // The book should have at least one chapter
        expect(book.chapters.length).toBeGreaterThanOrEqual(1);

        const chapter = book.chapters[0];

        // Find the paragraph that contains the footnote reference
        const paragraphs = chapter.content.filter(
          (node): node is ParagraphNode => node.type === 'paragraph'
        );

        // Collect all footnote refs across all paragraphs
        const allFootnoteRefs: FootnoteRefSpan[] = [];
        for (const para of paragraphs) {
          allFootnoteRefs.push(...findFootnoteRefs(para.children));
        }

        // There should be exactly one FootnoteRefSpan produced
        expect(allFootnoteRefs.length).toBe(1);

        const footnoteRef = allFootnoteRefs[0];

        // The label should equal the anchor's text content
        expect(footnoteRef.label).toBe(testCase.label);

        // The content should be a non-empty array of InlineNodes
        expect(Array.isArray(footnoteRef.content)).toBe(true);
        expect(footnoteRef.content.length).toBeGreaterThan(0);

        // The text content of the footnote content nodes should match
        // the expected text content from the target element
        const actualTextContent = extractInlineText(footnoteRef.content).trim();
        const expectedTextContent = testCase.target.expectedTextContent.trim();
        expect(actualTextContent).toBe(expectedTextContent);
      }),
      { numRuns: 100 }
    );
  });
});
