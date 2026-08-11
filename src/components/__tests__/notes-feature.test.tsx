/**
 * Integration tests for the notes feature: selecting text and right-clicking
 * to create a note, the note appearing in the Notes panel, and the noted
 * passage staying visually highlighted in the reading view.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

describe('Notes feature', () => {
  beforeEach(() => {
    localStorage.clear();
    window.getSelection()?.removeAllRanges();
    // jsdom's Range doesn't implement getBoundingClientRect at all (so
    // there's nothing for vi.spyOn to wrap) — assign it directly, on the
    // prototype rather than per-instance, since jsdom's Selection.addRange
    // stores its own clone of the range, not the exact object we created.
    // The dictionary lookup hook reads this when computing its popover
    // anchor position, both from its own native listener and from
    // `triggerFromCurrentSelection`.
    Range.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 80,
      width: 30, height: 20, x: 50, y: 100, toJSON: () => ({}),
    });
  });

  afterEach(() => {
    delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
  });

  it('shows an "Add note" context menu when right-clicking a text selection, and creates the note on click', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful world');

    fireEvent.contextMenu(content);

    const menuItem = await screen.findByTestId('note-context-menu');
    expect(menuItem).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add note'));

    // The note should now be visually highlighted in the content.
    await waitFor(() => {
      const mark = content.querySelector('mark.qari-note-highlight');
      expect(mark).not.toBeNull();
      expect(mark!.textContent).toBe('wonderful world');
    });
  });

  it('offers "Remove note" when right-clicking an existing note highlight, and removing it clears the highlight', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful world');
    fireEvent.contextMenu(content);
    await screen.findByTestId('note-context-menu');
    fireEvent.click(screen.getByText('Add note'));

    const mark = await waitFor(() => {
      const el = content.querySelector('mark.qari-note-highlight');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // Right-click directly on the highlight, with no fresh selection this time.
    window.getSelection()?.removeAllRanges();
    fireEvent.contextMenu(mark);

    const menu = await screen.findByTestId('note-context-menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual(['Remove note']);

    fireEvent.click(screen.getByText('Remove note'));

    await waitFor(() => {
      expect(content.querySelector('mark.qari-note-highlight')).toBeNull();
    });
  });

  it('offers both "Add note" and "Remove note" when right-clicking a highlight while a separate fresh selection is active', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful');
    fireEvent.contextMenu(content);
    await screen.findByTestId('note-context-menu');
    fireEvent.click(screen.getByText('Add note'));

    const mark = await waitFor(() => {
      const el = content.querySelector('mark.qari-note-highlight');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    selectText(content, 'world');
    fireEvent.contextMenu(mark);

    const menu = await screen.findByTestId('note-context-menu');
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Add note', 'Remove note']);
  });

  it('positions the context menu relative to the reader root, not raw viewport coordinates', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // Simulate the reader being embedded away from the viewport's top-left
    // corner (e.g. below a page header) — the root has its own `transform`
    // (see its style comment in Reader.tsx) making it the containing block
    // for this menu's `position: fixed` target, so the target's on-screen
    // coordinates must be computed relative to the root's box.
    const root = document.querySelector('.ebook-reader') as HTMLElement;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      top: 200, left: 100, bottom: 800, right: 900, width: 800, height: 600, x: 100, y: 200, toJSON: () => ({}),
    });

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful');
    fireEvent.contextMenu(content, { clientX: 150, clientY: 250 });

    const anchor = await screen.findByTestId('note-context-menu-anchor');
    expect(anchor.style.left).toBe('50px'); // 150 - 100
    expect(anchor.style.top).toBe('50px'); // 250 - 200
  });

  it('does not intercept the context menu when there is no text selection', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    window.getSelection()?.removeAllRanges();

    fireEvent.contextMenu(content);

    expect(screen.queryByTestId('note-context-menu')).not.toBeInTheDocument();
  });

  it('lists a created note in the Notes panel and navigating to it closes the panel', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'Hello');
    fireEvent.contextMenu(content);
    await screen.findByTestId('note-context-menu');
    fireEvent.click(screen.getByText('Add note'));

    await waitFor(() => {
      expect(content.querySelector('mark.qari-note-highlight')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    const panel = await screen.findByTestId('notes-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('note-list')).toHaveTextContent('Hello');

    fireEvent.click(screen.getByTestId(/^note-excerpt-/));
    await waitFor(() => {
      expect(screen.queryByTestId('notes-panel')).not.toBeInTheDocument();
    });
  });

  it('shows a unified menu with both "Add note" and "Meaning" when dictionary providers are configured', async () => {
    render(<Reader source={createMarkdownSource()} enableBuiltInDictionary />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful world');
    fireEvent.contextMenu(content);

    const menu = await screen.findByTestId('note-context-menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual(['Add note', 'Meaning']);
  });

  it('triggers a dictionary lookup when "Meaning" is clicked, and closes the menu', async () => {
    const originalFetch = globalThis.fetch;
    // Never-resolving fetch — keeps the popover in its loading state for
    // the duration of the test, avoiding a flake where a fast reject (fetch
    // isn't otherwise mocked here) flips it back off before the assertion
    // below gets a chance to observe it.
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

    try {
      render(<Reader source={createMarkdownSource()} enableBuiltInDictionary />);
      await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

      const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
      selectText(content, 'wonderful');
      fireEvent.contextMenu(content);
      await screen.findByTestId('note-context-menu');

      fireEvent.click(screen.getByText('Meaning'));

      expect(screen.queryByTestId('note-context-menu')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(document.querySelector('[data-testid="dictionary-popover"]')).not.toBeNull();
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('only shows "Add note" (no "Meaning") when no dictionary providers are configured', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful world');
    fireEvent.contextMenu(content);

    const menu = await screen.findByTestId('note-context-menu');
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Add note']);
  });

  it('does not show the notes button or accept right-click note creation when enableNotes is false', async () => {
    render(<Reader source={createMarkdownSource()} enableNotes={false} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Notes' })).not.toBeInTheDocument();

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'Hello');
    fireEvent.contextMenu(content);

    expect(screen.queryByTestId('note-context-menu')).not.toBeInTheDocument();
  });

  it('persists the note to localStorage so it survives a remount', async () => {
    const { unmount } = render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const content = document.querySelector('.ebook-reader__columns') as HTMLElement;
    selectText(content, 'wonderful');
    fireEvent.contextMenu(content);
    await screen.findByTestId('note-context-menu');
    fireEvent.click(screen.getByText('Add note'));

    await waitFor(() => {
      expect(content.querySelector('mark.qari-note-highlight')).not.toBeNull();
    });

    unmount();

    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const newContent = document.querySelector('.ebook-reader__columns') as HTMLElement;
    await waitFor(() => {
      const mark = newContent.querySelector('mark.qari-note-highlight');
      expect(mark).not.toBeNull();
      expect(mark!.textContent).toBe('wonderful');
    });
  });
});
