/**
 * The settings panel applies every change immediately — there's no draft,
 * no Apply/Cancel step, and no separate preview. Each control reads
 * straight from the reader's committed props and calls `onSettingsChange`
 * as soon as it's touched.
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
  // findByRole (not getByRole) so this tolerates the reader still being
  // mid-reload (e.g. right after a source/prop change triggers a fresh
  // async load) instead of requiring the button to already be present.
  const settingsButton = await screen.findByRole('button', { name: 'Reading settings' });
  fireEvent.click(settingsButton);
  await screen.findByTestId('settings-panel');
}

async function openThemePanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
  await screen.findByTestId('theme-panel');
}

async function openLayoutPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  await screen.findByTestId('layout-panel');
}

describe('Settings panel applies changes immediately', () => {
  it('has no Apply or Cancel buttons', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();

    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('calls onSettingsChange with the new font size as soon as the + chip is clicked', async () => {
    const onSettingsChange = vi.fn();
    render(<Reader source={createMarkdownSource()} fontSize={16} onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();
    fireEvent.click(screen.getByText('+').closest('button')!);

    expect(onSettingsChange).toHaveBeenCalledTimes(1);
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 18 }));
  });

  it('calls onSettingsChange as soon as a theme swatch is clicked', async () => {
    const onSettingsChange = vi.fn();
    render(<Reader source={createMarkdownSource()} theme="light" onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openThemePanel();
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('calls onSettingsChange as soon as a layout (columns) button is clicked', async () => {
    const onSettingsChange = vi.fn();
    render(<Reader source={createMarkdownSource()} columns={1} onSettingsChange={onSettingsChange} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openLayoutPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Two columns' }));

    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ scroll: false, columns: 2 }));
  });

  it('reflects the current committed fontSize prop directly (no stale draft) each time it reopens', async () => {
    const { rerender } = render(<Reader source={createMarkdownSource()} fontSize={16} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();
    expect(screen.getByTestId('font-size-percent').textContent).toBe('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Reading settings' })); // close
    rerender(<Reader source={createMarkdownSource()} fontSize={24} />);

    await openSettings();
    expect(screen.getByTestId('font-size-percent').textContent).toBe('150%');
  });
});
