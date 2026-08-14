/**
 * On touch devices (no real hover capability), the page-turn arrows used to
 * only ever appear via `hovered`, which is driven by `mouseenter`/`mouseleave`
 * — events a touchscreen has no reliable way to produce. In practice this
 * meant the arrows were either never reachable, or (worse) got exposed by
 * the browser's touch-to-mouse-event emulation at the wrong moment (see the
 * mobile font-selector bug this same emulation caused, fixed separately).
 *
 * On such devices the reader now always renders the same edge regions as
 * invisible tap zones instead of hover-revealed arrows — "touch the sides to
 * turn the page" — leaving swipe (see Reader's touch handlers) to cover the
 * rest of the screen. Detection combines the `(hover: none)` media feature
 * (what Mantine's own CSS gates real `:hover` styles behind) with
 * `navigator.maxTouchPoints`, since some mobile browsers/WebViews have been
 * observed to misreport `hover: none` as `hover: hover`.
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

/** Makes `window.matchMedia('(hover: none)')` report as touch-only (no hover). */
function mockTouchOnlyDevice() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(hover: none)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/**
 * Simulates a real phone whose browser misreports `hover: hover` (matching
 * every media query as if a real mouse were present) but does correctly
 * report touch points — the exact combination the maxTouchPoints fallback
 * exists to catch.
 */
function mockMisreportingTouchDevice() {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(Navigator.prototype, 'maxTouchPoints');
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
  return () => {
    window.matchMedia = originalMatchMedia;
    if (originalMaxTouchPoints) {
      Object.defineProperty(Navigator.prototype, 'maxTouchPoints', originalMaxTouchPoints);
    } else {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    }
  };
}

describe('Edge navigation on touch devices', () => {
  let restoreMatchMedia: (() => void) | null = null;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreMatchMedia?.();
    restoreMatchMedia = null;
  });

  it('shows an invisible next-page tap zone without needing hover', async () => {
    restoreMatchMedia = mockTouchOnlyDevice();
    render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // No mouseenter/hover fired — on a touch device the zone must still be present.
    const nextZone = await screen.findByRole('button', { name: 'Next page' });
    expect(nextZone).toBeInTheDocument();

    // It's a tap target, not a visible arrow.
    expect(nextZone.textContent).toBe('');
    expect(nextZone).toHaveStyle({ opacity: '0' });
  });

  it('navigates chapters when the invisible tap zone is clicked', async () => {
    restoreMatchMedia = mockTouchOnlyDevice();
    const onPageChange = vi.fn();
    render(<Reader source={createTwoChapterSource()} onPageChange={onPageChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const nextZone = await screen.findByRole('button', { name: 'Next page' });
    fireEvent.click(nextZone);

    await waitFor(() => {
      expect(onPageChange).toHaveBeenCalledWith(expect.objectContaining({ chapter: 1 }));
    });
  });

  it('does not show the previous-page zone on the first page', async () => {
    restoreMatchMedia = mockTouchOnlyDevice();
    render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Previous page' })).toBeNull();
  });

  it('hides the arrows via maxTouchPoints even when hover media queries misreport hover support', async () => {
    restoreMatchMedia = mockMisreportingTouchDevice();
    render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const nextZone = await screen.findByRole('button', { name: 'Next page' });
    expect(nextZone.textContent).toBe('');
    expect(nextZone).toHaveStyle({ opacity: '0' });
  });

  it('does not show edge zones on a hover-capable (non-touch) device without hovering', async () => {
    // Default matchMedia mock (see test-setup.ts) reports no hover capability
    // restrictions either way (`matches: false` for every query), so this
    // exercises the normal mouse/desktop path used by the rest of the suite.
    render(<Reader source={createTwoChapterSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });
});
