/**
 * Regression test for issue #21: clicking a note in the Notes panel that
 * belongs to a chapter *other* than the one currently open — with that note
 * positioned somewhere in the middle of its chapter, not the first page —
 * used to land on the target chapter's first page instead of the page the
 * note is actually on. Two compounding bugs were involved:
 *
 * 1. `NotePanel` used to resolve a target page via `Math.floor(startOffset /
 *    1500)` — a fixed characters-per-page assumption that rarely matches
 *    the chapter's *real* rendered characters-per-page (depends on font
 *    size, margin, columns, viewport), so even a correctly-*bounded* target
 *    page could land on the wrong one. Fixed by having `NotePanel` prefer
 *    the chapter's real, already-measured page count (`pagesPerChapter` on
 *    ReaderContext) when available — this chapter has already been visited
 *    (the note was just created there), so a proportional offset/total
 *    scaling against that real count is exact where the fixed-heuristic
 *    guess wasn't.
 * 2. Separately, even a *correctly* resolved target page used to get
 *    silently overridden: `totalPages` at the moment of the click still
 *    describes the chapter being *left* (chapter 1), and the reader's
 *    generic "clamp currentPage to totalPages-1" effect fired on that
 *    stale, unrelated total before `recalcPages` had a chance to
 *    re-measure the chapter actually being navigated to. See
 *    `pendingTargetPageRef` in Reader.tsx, which suppresses that clamp
 *    until the real measurement lands (the same mechanism `goToLastPageRef`
 *    already used for the analogous previous-chapter "last page" jump —
 *    see prev-chapter-last-page.test.tsx).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

// Equal-sized filler before and after the note's own marker text puts it at
// roughly the chapter's real character-count midpoint — with chapter 2
// measuring as 3 real pages (see the scrollWidth stub below), that resolves
// to page index 1, comfortably distinct from both chapter 2's first page
// (index 0 — the pre-fix buggy result, see this file's own top comment) and
// its last page (index 2), so a passing test can't be mistaken for the note
// having simply landed on either end by some other coincidence.
const FILLER_BEFORE = 'x'.repeat(1700);
const FILLER_AFTER = 'y'.repeat(1700);

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: `# Book\n\n## Chapter 1\n\nch0-marker short chapter.\n\n## Chapter 2\n\nch1-marker ${FILLER_BEFORE} NOTEMARKER ${FILLER_AFTER} end of chapter two.`,
  };
}

/** Same technique as prev-chapter-last-page.test.tsx: key the stubbed
 * scrollWidth off which chapter's own marker text is currently rendered, so
 * chapter 1 always measures as a single page and chapter 2 as several. */
function stubScrollWidthByChapterMarker(el: HTMLElement) {
  Object.defineProperty(el, 'scrollWidth', {
    get: () => {
      const text = el.textContent ?? '';
      if (text.includes('ch1-marker')) return 3000;
      if (text.includes('ch0-marker')) return 500;
      return 0;
    },
    configurable: true,
  });
}

function clickAddNote(color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' = 'yellow') {
  fireEvent.click(screen.getByTestId(`note-add-color-${color}`));
}

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

async function openChapterMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  return screen.findByTestId('chapter-menu-panel');
}

describe('Navigating to a note in a different, not-yet-measured chapter', () => {
  it('lands on the note\'s real page, not chapter 1 (issue #21)', async () => {
    localStorage.clear();
    window.getSelection()?.removeAllRanges();
    Range.prototype.getBoundingClientRect = () => ({
      top: 100, bottom: 120, left: 50, right: 80,
      width: 30, height: 20, x: 50, y: 100, toJSON: () => ({}),
    } as DOMRect);

    const source = createSource();
    const { container } = render(<Reader source={source} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;
    const measurerEl = screen.getByTestId('page-count-measurer');

    // Single column, default margin=32: pagePitch = 1000 - 64 + 64 = 1000.
    Object.defineProperty(pageBoxEl, 'clientWidth', { value: 1000, configurable: true });
    stubScrollWidthByChapterMarker(columnsEl);
    stubScrollWidthByChapterMarker(measurerEl);
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker'));

    // Navigate to chapter 2 to create the note there.
    await openChapterMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 2' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch1-marker'));

    selectText(columnsEl, 'NOTEMARKER');
    fireEvent.contextMenu(columnsEl);
    await screen.findByTestId('note-context-menu');
    clickAddNote();
    await waitFor(() => expect(columnsEl.querySelector('mark.qari-note-highlight')).not.toBeNull());

    // Back to chapter 1 — its own (small) totalPages is now what's current
    // when the note gets clicked below. The header status line shows
    // *book-wide* page totals (1 page in chapter 1 + 3 in chapter 2 = 4),
    // not the current chapter's own total — chapter 1's page 1 is book
    // page 1 of 4.
    await openChapterMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Chapter 1' }));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch0-marker'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 1 of 4'));

    // Open the Notes tab and click the note — should land back on chapter 2,
    // on the page the note actually falls on (its own page index 1, i.e.
    // book page 3 of 4) — neither chapter 2's own first page (book page 2,
    // the buggy pre-fix result — see this file's own top comment) nor its
    // last page (book page 4, index 2).
    await openChapterMenu();
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    const notePanel = await screen.findByTestId('note-panel');
    fireEvent.click(within(notePanel).getByTestId(/^note-excerpt-/));

    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('ch1-marker'));
    await waitFor(() => expect(screen.getByTestId('reader-content').textContent).toContain('Page 3 of 4'));

    delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
  });
});
