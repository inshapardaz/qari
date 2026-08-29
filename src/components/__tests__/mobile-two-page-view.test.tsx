/**
 * Regression test for issue #6: a two-column spread doesn't fit
 * comfortably on a phone-width viewport, so the reader hides the
 * "Two columns" layout option and forces single-page layout whenever
 * the viewport is narrow (see MOBILE_VIEWPORT_MAX_WIDTH / isMobileViewport
 * / effectiveColumns in Reader.tsx), regardless of what the `columns` prop
 * says.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

/** Makes `window.matchMedia('(max-width: 768px)')` report as a mobile viewport. */
function mockMobileViewport() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(max-width: 768px)',
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

async function openLayoutPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  await screen.findByTestId('layout-panel');
}

/**
 * On a mobile viewport, Layout (along with Theme and Reading settings)
 * lives behind the header's single "⋯" overflow popover instead of its own
 * button — see that popover's own comment in Reader.tsx.
 */
async function openLayoutPanelOnMobile() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));
  await screen.findByTestId('mobile-more-panel');
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  // The mobile overflow popover swaps its own content in place (see its
  // comment in Reader.tsx) rather than opening a second, separately
  // testid'd `layout-panel` popover — "Single column" only renders once
  // that swap has happened.
  await screen.findByRole('button', { name: 'Single column' });
}

describe('Two-page view on mobile', () => {
  let restoreMatchMedia: (() => void) | null = null;

  afterEach(() => {
    restoreMatchMedia?.();
    restoreMatchMedia = null;
  });

  it('hides the "Two columns" layout option on a mobile viewport', async () => {
    restoreMatchMedia = mockMobileViewport();
    render(<Reader source={createSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openLayoutPanelOnMobile();

    expect(screen.queryByRole('button', { name: 'Two columns' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Single column' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll' })).toBeInTheDocument();
  });

  it('shows the "Two columns" layout option on a non-mobile viewport (contrast check)', async () => {
    render(<Reader source={createSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openLayoutPanel();

    expect(screen.getByRole('button', { name: 'Two columns' })).toBeInTheDocument();
  });

  it('requests columns: 1 via onSettingsChange when started with columns=2 on a mobile viewport', async () => {
    restoreMatchMedia = mockMobileViewport();
    const onSettingsChange = vi.fn();
    render(<Reader source={createSource()} columns={2} onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await waitFor(() => {
      expect(onSettingsChange).toHaveBeenCalledWith({ columns: 1 });
    });
  });

  it('renders a single-column layout even while columns=2 is still passed on a mobile viewport', async () => {
    restoreMatchMedia = mockMobileViewport();
    const { container } = render(<Reader source={createSource()} columns={2} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    // The inner page box (see `pageBoxRef` in Reader.tsx) is capped to a
    // single MAX_PAGE_WIDTH column (plus margin padding) once the mobile
    // viewport forces single-column layout — see scroll-view.test.tsx for
    // the two-column case. `.ebook-reader__viewport` itself stays full-width
    // so the hover/tap zones and edge arrows still cover the whole viewport.
    const pageBoxEl = container.querySelector('.ebook-reader__page-box') as HTMLElement;
    expect(pageBoxEl.style.maxWidth).toBe('584px');
  });
});
