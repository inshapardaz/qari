/**
 * The chapter drawer's chrome (background, text, borders) used to come
 * entirely from Mantine's own forced light/dark colorScheme (see
 * `mantineColorScheme` in Reader.tsx) — a binary palette that can't
 * represent calm or high-contrast, so both rendered as generic Mantine
 * light/dark instead of their actual reading-theme colors. Drawer.Content
 * now re-points Mantine's own `--mantine-color-body`/`--mantine-color-text`/
 * `--mantine-color-default-border`/`--mantine-color-dimmed`/
 * `--mantine-primary-color-*` variables at the exact `--reader-*` colors
 * ThemeEngine sets for the active theme, so the whole drawer (including
 * nested Mantine controls in BookmarkPanel/NotePanel/SearchPanel — Switch,
 * Slider, Select, etc.) inherits them like Mantine's own dark-mode override
 * works, instead of falling back to Mantine's own defaults (plain gray text,
 * plain blue "primary" controls) for anything not manually given an
 * explicit `color` prop.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello world',
  };
}

async function openDrawer() {
  await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Table of contents' }));
  return screen.findByTestId('chapter-menu-panel');
}

describe('Chapter drawer theming', () => {
  it("re-points Mantine's own body/text/border variables at the exact --reader-* colors, not just light/dark", async () => {
    render(<Reader source={createMarkdownSource()} theme="calm" />);
    const panel = await openDrawer();

    expect(panel.style.getPropertyValue('--mantine-color-body')).toBe('var(--reader-bg, #ffffff)');
    expect(panel.style.getPropertyValue('--mantine-color-text')).toBe('var(--reader-fg, #1a1a1a)');
    expect(panel.style.getPropertyValue('--mantine-color-default-border')).toBe('var(--reader-border, #e0e0e0)');
    expect(panel.style.backgroundColor).toBe('var(--reader-bg, #ffffff)');
    expect(panel.style.color).toBe('var(--reader-fg, #1a1a1a)');
  });

  it("re-points Mantine's own --mantine-color-dimmed (c=\"dimmed\" secondary/muted text) at the reading theme's own secondary color", async () => {
    // Regression: `c="dimmed"` Text (chapter subtitles, author names,
    // captions throughout the drawer/popovers) used Mantine's own
    // `--mantine-color-dimmed`, a plain gray keyed off the binary
    // light/dark colorScheme — never the reading theme, so secondary text
    // stayed generic Mantine gray under every theme.
    render(<Reader source={createMarkdownSource()} theme="calm" />);
    const panel = await openDrawer();

    expect(panel.style.getPropertyValue('--mantine-color-dimmed')).toBe('var(--reader-secondary, #6e6e73)');
  });

  it('re-points --mantine-color-dimmed at the reader root too, so every c="dimmed" Text inherits it by default', async () => {
    render(<Reader source={createMarkdownSource()} theme="high-contrast" />);
    const root = await screen.findByTestId('reader-content');

    expect(root.style.getPropertyValue('--mantine-color-dimmed')).toBe('var(--reader-secondary, #6e6e73)');
  });

  it('applies the same override regardless of which reading theme is active (contrast check)', async () => {
    render(<Reader source={createMarkdownSource()} theme="high-contrast" />);
    const panel = await openDrawer();

    // Deliberately the same `--reader-*` indirection, not a different value
    // per theme — the actual color swap happens at ThemeEngine's level
    // (which sets `--reader-bg` etc. on the reader root), not here.
    expect(panel.style.getPropertyValue('--mantine-color-body')).toBe('var(--reader-bg, #ffffff)');
  });

  it.each(['light', 'dark', 'calm', 'quiet', 'paper', 'focus', 'high-contrast'] as const)(
    "re-points Mantine's own --mantine-primary-color-* variables at the %s theme's own accent, not Mantine's default blue",
    async (theme) => {
      // Regression: Mantine controls that don't take an explicit `color`
      // prop (the settings panel's Justify Switch and its four Sliders, the
      // font Select's active-option highlight, etc.) fall back to
      // `--mantine-primary-color-*`, Mantine's own default blue "primary"
      // palette — previously never redirected at the reading theme's own
      // accent, so those controls showed plain Mantine blue under every
      // theme except where the theme's own accent (light's `#0071e3`) or
      // background (contrast text) happened to coincidentally look similar.
      render(<Reader source={createMarkdownSource()} theme={theme} />);
      const panel = await openDrawer();

      expect(panel.style.getPropertyValue('--mantine-primary-color-filled')).toBe('var(--reader-accent, #0071e3)');
      expect(panel.style.getPropertyValue('--mantine-primary-color-filled-hover')).toBe('var(--reader-accent, #0071e3)');
      expect(panel.style.getPropertyValue('--mantine-primary-color-light-color')).toBe('var(--reader-accent, #0071e3)');
      expect(panel.style.getPropertyValue('--mantine-primary-color-contrast')).toBe('var(--reader-bg, #ffffff)');
    }
  );

  it('re-points --mantine-primary-color-filled at the reader root too, so every unstyled Mantine control inherits it by default', async () => {
    render(<Reader source={createMarkdownSource()} theme="focus" />);
    const root = await screen.findByTestId('reader-content');

    expect(root.style.getPropertyValue('--mantine-primary-color-filled')).toBe('var(--reader-accent, #0071e3)');
  });
});
