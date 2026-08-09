/**
 * Unit tests for ZoomController translation integration.
 *
 * Validates: Requirements 8.1, 8.2, 8.3
 *
 * Verifies that ZoomControls resolves aria-labels and titles
 * from TranslationContext rather than using hardcoded English strings.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationContext, DEFAULT_TRANSLATIONS } from '../index';
import { ZoomControls } from '../../components/ZoomController';

const customTranslations = {
  ...DEFAULT_TRANSLATIONS,
  zoomControls: 'Controles de zoom',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
};

function renderWithTranslations(ui: React.ReactElement) {
  return render(
    <MantineProvider env="test">
      <TranslationContext.Provider value={customTranslations}>
        {ui}
      </TranslationContext.Provider>
    </MantineProvider>
  );
}

describe('ZoomControls translation integration', () => {
  const defaultProps = {
    zoom: 100,
    canZoomIn: true,
    canZoomOut: true,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
  };

  it('renders the toolbar with the overridden zoomControls aria-label', () => {
    renderWithTranslations(<ZoomControls {...defaultProps} />);

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Controles de zoom');
  });

  it('renders the zoom in button with the overridden zoomIn title', () => {
    renderWithTranslations(<ZoomControls {...defaultProps} />);

    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    expect(zoomInBtn).toHaveAttribute('title', 'Acercar');
  });

  it('renders the zoom out button with the overridden zoomOut title', () => {
    renderWithTranslations(<ZoomControls {...defaultProps} />);

    const zoomOutBtn = screen.getByTestId('zoom-out-btn');
    expect(zoomOutBtn).toHaveAttribute('title', 'Alejar');
  });
});
