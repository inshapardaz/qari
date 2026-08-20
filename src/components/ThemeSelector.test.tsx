/**
 * Tests for ThemeSelector component.
 */

import React from 'react';
import { render as rtlRender, screen, fireEvent, type RenderOptions } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ThemeSelector } from './ThemeSelector';
import { ReaderContext, ReaderContextValue } from './Reader';

/** ThemeSelector now uses Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MantineProvider env="test">{children}</MantineProvider>,
    ...options,
  });
}

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
      notes: [],
      error: null,
      loading: false,
    },
    themeEngine: createMockThemeEngine() as any,
    directionDetector: {} as any,
    dictionaryService: {} as any,
    bookmarkStore: null,
    noteStore: null,
    chapterNavigator: null,
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    addNote: vi.fn(),
    removeNote: vi.fn(),
    updateNote: vi.fn(),
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
  it('renders theme options for all seven themes', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Calm' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Quiet' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Paper' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Focus' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'HC' })).toBeInTheDocument();
  });

  it('renders font family options', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByRole('radio', { name: 'Serif' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sans-Serif' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Monospace' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Nastaliq' })).toBeInTheDocument();
  });

  it('renders font size controls', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByTestId('font-size-slider')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-decrease')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-increase')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-value')).toHaveTextContent('16px');
  });

  it('marks the active theme option as checked', () => {
    renderWithContext(<ThemeSelector />);
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Dark' })).not.toBeChecked();
  });

  it('calls themeEngine.setTheme when a theme option is selected', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(ctx.themeEngine!.setTheme).toHaveBeenCalledWith('dark');
  });

  it('calls themeEngine.setFont when a font option is selected', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByRole('radio', { name: 'Monospace' }));
    expect(ctx.themeEngine!.setFont).toHaveBeenCalledWith('monospace');
  });

  it('calls themeEngine.setFontSize when the slider is moved via keyboard', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    const slider = screen.getByTestId('font-size-slider').querySelector('[role="slider"]')!;
    (slider as HTMLElement).focus();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    // Step is 2, so one step from 16 lands on 18
    expect(ctx.themeEngine!.setFontSize).toHaveBeenCalledWith(18);
  });

  it('persists preferences on change', () => {
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector />, ctx);
    fireEvent.click(screen.getByRole('radio', { name: 'Calm' }));
    expect(ctx.themeEngine!.persistPreferences).toHaveBeenCalled();
  });

  it('calls onChange callback with updated preferences', () => {
    const onChange = vi.fn();
    const ctx = createMockContext();
    renderWithContext(<ThemeSelector onChange={onChange} />, ctx);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
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
