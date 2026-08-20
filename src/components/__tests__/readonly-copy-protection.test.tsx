/**
 * The `readOnly` prop blocks copying out of the book content — the
 * copy/cut clipboard events are prevented, however the copy is triggered.
 * Text selection itself, and the content's right-click menu (notes' "Add
 * note" and dictionary lookup's "Meaning"), are deliberately left working:
 * both features depend on being able to select text, and disabling
 * selection would silently break them too. It's scoped to the book content
 * only — the reader's own UI chrome is unaffected.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello wonderful world of reading',
  };
}

/** Selects `text` within `container` by locating it in the first text node that contains it. */
function selectText(container: HTMLElement, text: string) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const content = node.textContent ?? '';
    const idx = content.indexOf(text);
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
  }
  throw new Error(`Text "${text}" not found in container`);
}

describe('readOnly copy protection', () => {
  beforeEach(() => {
    localStorage.clear();
    window.getSelection()?.removeAllRanges();
    Range.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 80,
      width: 30, height: 20, x: 50, y: 100, toJSON: () => ({}),
    });
  });

  afterEach(() => {
    delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
  });

  it('leaves text selection enabled when readOnly, so notes/dictionary lookup keep working', async () => {
    render(<Reader source={createMarkdownSource()} readOnly />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    expect(content.style.userSelect).not.toBe('none');
  });

  it('blocks copy and cut on the content when readOnly', async () => {
    render(<Reader source={createMarkdownSource()} readOnly />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    // fireEvent returns false when the event's preventDefault() was called.
    expect(fireEvent.copy(content)).toBe(false);
    expect(fireEvent.cut(content)).toBe(false);
  });

  it('does not block copy by default (contrast check)', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    expect(fireEvent.copy(content)).toBe(true);
  });

  it('still shows the "Add note" menu on a text selection when readOnly', async () => {
    render(<Reader source={createMarkdownSource()} readOnly enableNotes />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful world');
    fireEvent.contextMenu(content);

    expect(await screen.findByTestId('note-context-menu')).toBeInTheDocument();
    expect(screen.getByText('Add note')).toBeInTheDocument();
  });

  it('adding a note under readOnly still creates it, even though copying the same selection is blocked', async () => {
    render(<Reader source={createMarkdownSource()} readOnly enableNotes />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful world');

    // The same selection cannot be copied out...
    expect(fireEvent.copy(content)).toBe(false);

    // ...but can still be turned into a note. "Add note" is a label over a
    // row of color-circle buttons now, not itself a clickable item — see
    // notes-feature.test.tsx's clickAddNote helper for the same pattern.
    fireEvent.contextMenu(content);
    await screen.findByText('Add note');
    fireEvent.click(screen.getByTestId('note-add-color-yellow'));

    await waitFor(() => {
      const mark = content.querySelector('mark.qari-note-highlight');
      expect(mark).not.toBeNull();
      expect(mark!.textContent).toBe('wonderful world');
    });
  });
});
