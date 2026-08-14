/**
 * Regression test for issue #5: toggling fullscreen (real or the CSS-only
 * "fake fullscreen" fallback used when the Fullscreen API is unavailable —
 * which is also what jsdom exercises, since it has no Fullscreen API at all)
 * changes the container's available width without firing a window 'resize'
 * event. Pagination (`recalcPages`) used to only be wired up to font/zoom/
 * layout-prop changes and 'resize', so leaving fullscreen left `totalPages`
 * computed for the fullscreen width, misaligning the page.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

describe('Repagination on fullscreen toggle', () => {
  it('recalculates total pages after exiting fullscreen without a resize event', async () => {
    const { container } = render(<Reader source={createSource()} margin={80} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const viewportEl = container.querySelector('.ebook-reader__viewport') as HTMLElement;
    const columnsEl = container.querySelector('.ebook-reader__columns') as HTMLElement;

    // Establish the pre-fullscreen layout: containerWidth=1000 -> pagePitch
    // 1000-160+64=904, scrollWidth 3000 -> 3 pages.
    Object.defineProperty(viewportEl, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 3000, configurable: true });
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());

    // Simulate the container measuring wider, as it would full-bleed over
    // the viewport in fullscreen — set *before* the click, since a real
    // browser's layout update from the CSS change is synchronous with the
    // DOM mutation, well before recalcPages's own settle timer fires.
    Object.defineProperty(viewportEl, 'clientWidth', { value: 1400, configurable: true });
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 3000, configurable: true });

    // jsdom has no Fullscreen API, so this exercises the fake-fullscreen
    // fallback path — same one iOS Safari (the environment in the reported
    // issue) uses. Deliberately no 'resize' event fired: fake fullscreen
    // (and often even the real Fullscreen API) never changes the window's
    // own dimensions.
    fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    await screen.findByRole('button', { name: 'Exit fullscreen' });

    // pagePitch = 1400-160+64=1304 -> round(3000/1304) = 2 pages.
    await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument());

    // Exiting fullscreen changes the width back — again, no 'resize' event —
    // and set before the click for the same reason as above.
    Object.defineProperty(viewportEl, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(columnsEl, 'scrollWidth', { value: 3000, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    await screen.findByRole('button', { name: 'Enter fullscreen' });

    await waitFor(() => expect(screen.getByText('Page 1 of 3')).toBeInTheDocument());
  });
});
