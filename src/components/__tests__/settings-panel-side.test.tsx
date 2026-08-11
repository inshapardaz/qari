/**
 * Regression test: the settings panel (a Popover anchored to the settings
 * button) must open on the side of the header matching the UI direction,
 * not the book's content direction — bottom-end (visually right) for an
 * LTR UI, bottom-start (visually left) for an RTL one. Same rationale as
 * the chapter menu / bookmarks panel (see header-panel-ui-direction.test.tsx).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';
import { ur } from '../../i18n/locales';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

describe('Settings panel anchors to the settings button\'s side', () => {
  it('opens bottom-end for an LTR UI (English), regardless of book direction', async () => {
    render(<Reader source={createMarkdownSource()} direction="rtl" />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
    const panel = await screen.findByTestId('settings-panel');

    expect(panel.getAttribute('data-position')).toBe('bottom-end');
  });

  it('opens bottom-start for an RTL UI (Urdu), regardless of book direction', async () => {
    render(<Reader source={createMarkdownSource()} direction="ltr" translations={ur} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: ur.readingSettings }));
    const panel = await screen.findByTestId('settings-panel');

    expect(panel.getAttribute('data-position')).toBe('bottom-start');
  });
});
