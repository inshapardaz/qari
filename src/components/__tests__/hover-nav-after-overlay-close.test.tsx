/**
 * Regression test: the hover page-navigation arrows must reappear once an
 * overlay covering the viewport (chapter menu, bookmarks popover, settings
 * dialog, dictionary/footnote popovers, image lightbox) closes, if the
 * pointer is still over the viewport — no matter *how* the overlay was
 * closed (a button inside it, Escape, or clicking outside of it).
 *
 * While such an overlay is open, the browser fires `mouseleave` on the
 * viewport (the pointer is now over the overlay), which correctly hides the
 * arrows. But removing the overlay on close doesn't make the browser fire a
 * fresh `mouseenter` just because the pointer is newly exposed without
 * moving — so without an explicit re-check, `hovered` stays stuck at
 * `false` and the arrows never return until the mouse physically moves.
 *
 * The reader re-derives hover state from the last known pointer position
 * (tracked via a `pointermove` listener) rather than waiting for a
 * `mouseenter` that will never come. jsdom has no real layout, so
 * `getBoundingClientRect` is mocked here to give the viewport a concrete,
 * known position to compare the simulated pointer position against.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createTwoChapterSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world\n\n## Chapter 2\n\nMore content',
  };
}

const VIEWPORT_RECT: DOMRect = {
  left: 0,
  right: 800,
  top: 0,
  bottom: 600,
  width: 800,
  height: 600,
  x: 0,
  y: 0,
  toJSON() {
    return this;
  },
};

/** Give the viewport a concrete bounding rect and report the pointer as resting inside it. */
function mockViewportRectAndHoverPointer() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element
  ) {
    if (this.classList.contains('ebook-reader__viewport')) return VIEWPORT_RECT;
    return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
  });
  fireEvent.mouseMove(window, { clientX: 400, clientY: 300 });
}

describe('Hover nav arrows reappear after a covering overlay closes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the previous-page arrow again once the chapter menu closes via selecting a chapter', async () => {
    render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    mockViewportRectAndHoverPointer();

    // Navigating to chapter 2 (the last chapter) also means it's no longer
    // the first page, so the "previous" arrow becomes eligible to show.
    fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
    await screen.findByTestId('chapter-menu-panel');
    fireEvent.click(screen.getByRole('button', { name: /Chapter 2/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    });
  });

  it('shows the next-page arrow again once the settings panel is closed by clicking outside it', async () => {
    render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    mockViewportRectAndHoverPointer();

    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
    await screen.findByTestId('settings-panel');

    // The settings panel is a Popover, which has no overlay element to
    // click — it closes on an outside click instead, matching the reported
    // reproduction steps.
    fireEvent.mouseDown(document.body);
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });
  });
});
