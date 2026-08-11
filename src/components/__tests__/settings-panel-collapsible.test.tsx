/**
 * The settings panel shows only font size and typeface by default (theme
 * and layout are their own separate title-bar items); line height,
 * letter/word spacing, and justify live behind a "More settings" toggle.
 * Restore-to-defaults is a small icon button in the panel's top bar rather
 * than a full-width button at the bottom.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

async function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Reading settings' }));
  await screen.findByTestId('settings-panel');
}

describe('Settings panel: collapsible extra properties, reset icon button', () => {
  it('hides line height, spacing, and justify controls until "More settings" is expanded', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();

    expect(screen.queryByLabelText('Line Spacing')).toBeNull();
    expect(screen.queryByLabelText('Letter Spacing')).toBeNull();
    expect(screen.queryByLabelText('Word Spacing')).toBeNull();
    expect(screen.queryByLabelText('Margin')).toBeNull();
    expect(screen.queryByLabelText('Justify Text')).toBeNull();

    const moreToggle = screen.getByRole('button', { name: 'More settings' });
    expect(moreToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(moreToggle);

    expect(screen.getByLabelText('Line Spacing')).toBeInTheDocument();
    expect(screen.getByLabelText('Letter Spacing')).toBeInTheDocument();
    expect(screen.getByLabelText('Word Spacing')).toBeInTheDocument();
    expect(screen.getByLabelText('Margin')).toBeInTheDocument();
    expect(screen.getByLabelText('Justify Text')).toBeInTheDocument();
    expect(moreToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('restores defaults via the top-bar icon button, without a full-width button at the bottom', async () => {
    const onSettingsChange = vi.fn();
    render(<Reader source={createMarkdownSource()} fontSize={24} onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();

    const resetButtons = screen.getAllByRole('button', { name: 'Reset to Defaults' });
    expect(resetButtons).toHaveLength(1);
    // It's a small icon button, not a full-width button with visible text.
    expect(resetButtons[0].textContent).not.toContain('Reset to Defaults');

    fireEvent.click(resetButtons[0]);

    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 16 }));
  });
});
