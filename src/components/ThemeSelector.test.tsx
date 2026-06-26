/**
 * Tests for ThemeSelector component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeSelector } from './ThemeSelector';
import { ReaderContext, ReaderContextValue } from './Reader';

// Mock ThemeEngine
function createMockThemeEngine() {
  return {
    setTheme: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    getPreferences: vi.fn().mockReturnValue({ theme: 'light', fontFamily: 'serif', fontSize: 16 }),
    persistPreferences: vi.fn().mockReturnValue(true),
    loadPersistedPreferences: vi.fn().mockReturnValue(null),
  };
}

function createMockContext(overrides: Partial<ReaderContextValue> = {}): ReaderContextValue {
  return {
    state: {
      book: null,
      currentChapter: 0,
      currentPage: 0,
      totalPages: 0,
      readingProgress: 0,
      zoom: 100,
      direction: 'ltr',
      directionConfidence: 'high',
      preferences: { theme: 'light', fontFamily: 'serif', fontSize: 16 },
      bookmarks: [],
      error: null,
      loading: false,
    },
    themeEngine: createMockThemeEngine() as any,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: null,
    chapterNavigator: null,
    ...overrides,
  };
}

function renderWithContext(ui: React.ReactElement, context?: ReaderContextValue) {
  const ctx = context || createMockContext();
  return render(
    <ReaderContext.Provider value={ctx}>
      {ui}
    </ReaderContext.Provider>
  );
}

describe('ThemeSelector', () => {
  it('renders theme buttons for all four themes', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByTestId('theme-btn-light')).toBeInTheDocument();
    expect(screen.getByTestId('theme-btn-dark')).toBeInTheDocument();
    expect(screen.getByTestId('theme-btn-sepia')).toBeInTheDocument();
    expect(screen.getByTestId('theme-btn-high-contrast')).toBeInTheDocument();
  });

  it('renders font family buttons', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByTestId('font-btn-serif')).toBeInTheDocument();
    expect(screen.getByTestId('font-btn-sans-serif')).toBeInTheDocument();
    expect(screen.getByTestId('font-btn-monospace')).toBeInTheDocument();
    expect(screen.getByTestId('font-btn-nastaliq')).toBeInTheDocument();
  });

  it('renders font size controls', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByTestId('font-size-slider')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-decrease')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-increase')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-value')).toHaveTextContent('16px');
  });

  it('marks the active theme button as pressed', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByTestId('theme-btn-light')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('theme-btn-dark')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls themeEngine.setTheme when a theme button is clicked', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByTestId('theme-btn-dark'));
    expect(ctx.themeEngine!.setTheme).toHaveBeenCalledWith('dark');
  });

  it('calls themeEngine.setFont when a font button is clicked', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByTestId('font-btn-monospace'));
    expect(ctx.themeEngine!.setFont).toHaveBeenCalledWith('monospace');
  });

  it('calls themeEngine.setFontSize when slider changes', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.change(screen.getByTestId('font-size-slider'), { target: { value: '24' } });
    expect(ctx.themeEngine!.setFontSize).toHaveBeenCalledWith(24);
  });

  it('persists preferences on change', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByTestId('theme-btn-sepia'));
    expect(ctx.themeEngine!.persistPreferences).toHaveBeenCalled();
  });

  it('calls onChange callback with updated preferences', () => {
    const onChange = vi.fn();
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector onChange={onChange} />, ctx);
    fireEvent.click(screen.getByTestId('theme-btn-dark'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' })
    );
  });

  it('disables decrease button at minimum font size', () => {
    const ctx = createMockContext({
      state: {
        ...createMockContext().state,
        preferences: { theme: 'light', fontFamily: 'serif', fontSize: 12 },
      },
    });
    renderWithContext(<ThemeSelector />, ctx);
    expect(screen.getByTestId('font-size-decrease')).toBeDisabled();
  });

  it('disables increase button at maximum font size', () => {
    const ctx = createMockContext({
      state: {
        ...createMockContext().state,
        preferences: { theme: 'light', fontFamily: 'serif', fontSize: 48 },
      },
    });
    renderWithContext(<ThemeSelector />, ctx);
    expect(screen.getByTestId('font-size-increase')).toBeDisabled();
  });

  it('increments font size by 2 when increase button is clicked', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByTestId('font-size-increase'));
    expect(ctx.themeEngine!.setFontSize).toHaveBeenCalledWith(18);
  });

  it('decrements font size by 2 when decrease button is clicked', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByTestId('font-size-decrease'));
    expect(ctx.themeEngine!.setFontSize).toHaveBeenCalledWith(14);
  });

  it('has accessible labels and roles', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByRole('group', { name: 'Reading preferences' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Color theme' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Font family' })).toBeInTheDocument();
  });
});
