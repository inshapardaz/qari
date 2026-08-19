/**
 * Tests for the DOM-text-offset helpers backing the notes feature.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTextOffset, getRangeOffsets, applyHighlights, clearHighlights, findTextRange } from '../text-highlight';

function setContainerHTML(html: string): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe('getTextOffset', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns 0 at the very start of the container', () => {
    container = setContainerHTML('<p>Hello world</p>');
    const textNode = container.querySelector('p')!.firstChild!;
    expect(getTextOffset(container, textNode, 0)).toBe(0);
  });

  it('returns the correct offset mid-way through a single text node', () => {
    container = setContainerHTML('<p>Hello world</p>');
    const textNode = container.querySelector('p')!.firstChild!;
    expect(getTextOffset(container, textNode, 6)).toBe(6);
  });

  it('accounts for preceding elements when computing an offset', () => {
    container = setContainerHTML('<p>Hello</p><p>world</p>');
    const secondTextNode = container.querySelectorAll('p')[1].firstChild!;
    // "Hello" (5 chars) precedes the second paragraph's text entirely.
    expect(getTextOffset(container, secondTextNode, 0)).toBe(5);
  });

  it('accepts an element-node boundary (child-index offset), not just a text-node one', () => {
    container = setContainerHTML('<p>one</p><p>two</p>');
    // offset 1 on <div> = "after the first <p>" = after "one" (3 chars)
    expect(getTextOffset(container, container, 1)).toBe(3);
  });

  it('counts text inside nested inline elements (bold/italic)', () => {
    container = setContainerHTML('<p>a <strong>bold</strong> word</p>');
    const wordTextNode = container.querySelector('p')!.lastChild!;
    // "a " (2) + "bold" (4) = 6, then " word" starts
    expect(getTextOffset(container, wordTextNode, 0)).toBe(6);
  });
});

describe('getRangeOffsets', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns start <= end regardless of selection direction', () => {
    const container = setContainerHTML('<p>Hello world</p>');
    const textNode = container.querySelector('p')!.firstChild!;

    const forward = document.createRange();
    forward.setStart(textNode, 0);
    forward.setEnd(textNode, 5);
    expect(getRangeOffsets(container, forward)).toEqual({ start: 0, end: 5 });

    // A range object itself is always start<=end internally, but this
    // guards the helper's own min/max handling regardless.
    const backward = document.createRange();
    backward.setStart(textNode, 0);
    backward.setEnd(textNode, 5);
    expect(getRangeOffsets(container, backward)).toEqual({ start: 0, end: 5 });
  });
});

describe('applyHighlights / clearHighlights', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps the exact character range in a <mark> with the note id', () => {
    const container = setContainerHTML('<p>Hello wonderful world</p>');
    applyHighlights(container, [{ id: 'note-1', start: 6, end: 15 }]);

    const mark = container.querySelector('mark.qari-note-highlight')!;
    expect(mark).not.toBeNull();
    expect(mark.getAttribute('data-note-id')).toBe('note-1');
    expect(mark.textContent).toBe('wonderful');
    expect(container.textContent).toBe('Hello wonderful world');
  });

  it('wraps a range that spans across an inline element boundary without throwing', () => {
    const container = setContainerHTML('<p>a <strong>bold</strong> word here</p>');
    // Highlight "bold word" — starts inside <strong>, ends in plain text after it.
    const start = getTextOffset(container, container.querySelector('strong')!.firstChild!, 0);
    const end = start + 'bold word'.length;

    expect(() => applyHighlights(container, [{ id: 'note-2', start, end }])).not.toThrow();

    const marks = container.querySelectorAll('mark.qari-note-highlight');
    expect(marks.length).toBeGreaterThan(0);
    expect(container.textContent).toBe('a bold word here');
    // "bold" stays inside <strong>, so the highlight must be split into two
    // marks (one inside <strong>, one in the plain text) rather than one
    // mark illegally straddling the tag boundary.
    expect(marks.length).toBe(2);
  });

  it('applies multiple non-overlapping highlights independently', () => {
    const container = setContainerHTML('<p>one two three four</p>');
    applyHighlights(container, [
      { id: 'note-a', start: 0, end: 3 },
      { id: 'note-b', start: 14, end: 19 },
    ]);

    expect(container.querySelector('mark[data-note-id="note-a"]')!.textContent).toBe('one');
    expect(container.querySelector('mark[data-note-id="note-b"]')!.textContent).toBe('four');
    expect(container.textContent).toBe('one two three four');
  });

  it('clearHighlights removes marks and restores plain text, merging text nodes back', () => {
    const container = setContainerHTML('<p>Hello wonderful world</p>');
    applyHighlights(container, [{ id: 'note-1', start: 6, end: 15 }]);
    expect(container.querySelector('mark')).not.toBeNull();

    clearHighlights(container);

    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Hello wonderful world');
    // normalize() should have merged the split text back into one node.
    const p = container.querySelector('p')!;
    expect(p.childNodes.length).toBe(1);
    expect(p.firstChild!.nodeType).toBe(Node.TEXT_NODE);
  });

  it('re-applying highlights after clearing is idempotent (no leftover duplicate marks)', () => {
    const container = setContainerHTML('<p>Hello wonderful world</p>');
    applyHighlights(container, [{ id: 'note-1', start: 6, end: 15 }]);
    clearHighlights(container);
    applyHighlights(container, [{ id: 'note-1', start: 6, end: 15 }]);

    expect(container.querySelectorAll('mark.qari-note-highlight').length).toBe(1);
  });

  it('silently skips a degenerate (empty) range instead of throwing', () => {
    const container = setContainerHTML('<p>Hello world</p>');
    expect(() => applyHighlights(container, [{ id: 'note-1', start: 5, end: 5 }])).not.toThrow();
    expect(container.querySelector('mark')).toBeNull();
  });
});

describe('findTextRange', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the first occurrence of a needle by default', () => {
    const container = setContainerHTML('<p>Hello wonderful world</p>');
    const range = findTextRange(container, 'wonderful');
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('wonderful');
  });

  it('is case-insensitive', () => {
    const container = setContainerHTML('<p>Hello WONDERFUL world</p>');
    const range = findTextRange(container, 'wonderful');
    expect(range!.toString()).toBe('WONDERFUL');
  });

  it('finds the Nth occurrence when given a non-zero occurrence index', () => {
    const container = setContainerHTML('<p>cat sat on the cat mat with a cat</p>');
    expect(findTextRange(container, 'cat', 0)!.toString()).toBe('cat');
    const second = findTextRange(container, 'cat', 1)!;
    expect(second.toString()).toBe('cat');
    expect(getRangeOffsets(container, second)).toEqual({ start: 15, end: 18 });
    const third = findTextRange(container, 'cat', 2)!;
    expect(getRangeOffsets(container, third)).toEqual({ start: 30, end: 33 });
  });

  it('returns null when the needle does not occur', () => {
    const container = setContainerHTML('<p>Hello world</p>');
    expect(findTextRange(container, 'zebra')).toBeNull();
  });

  it('returns null when asked for an occurrence beyond how many exist', () => {
    const container = setContainerHTML('<p>one cat, no more</p>');
    expect(findTextRange(container, 'cat', 1)).toBeNull();
  });

  it('returns null for a blank needle', () => {
    const container = setContainerHTML('<p>Hello world</p>');
    expect(findTextRange(container, '  ')).toBeNull();
  });

  it('finds a match that spans across an inline element boundary', () => {
    const container = setContainerHTML('<p>a <strong>bold</strong> word here</p>');
    const range = findTextRange(container, 'bold word');
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('bold word');
  });
});
