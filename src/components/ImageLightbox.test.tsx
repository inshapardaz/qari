/**
 * Unit tests for ImageLightbox component rendering and interaction.
 *
 * Requirements: 1.1, 3.6, 3.7, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ImageLightbox } from './ImageLightbox';

const defaultProps = {
  src: 'https://example.com/image.png',
  alt: 'Test image',
  onClose: vi.fn(),
};

function renderLightbox(props = {}) {
  const merged = { ...defaultProps, onClose: vi.fn(), ...props };
  return {
    ...render(<ImageLightbox {...merged} />, {
      wrapper: ({ children }) => <MantineProvider env="test">{children}</MantineProvider>,
    }),
    onClose: merged.onClose,
  };
}

describe('ImageLightbox', () => {
  describe('ARIA and accessibility', () => {
    it('renders with role="dialog"', () => {
      renderLightbox();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-label from translation strings', () => {
      renderLightbox();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Image viewer');
    });

    it('has data-testid="image-lightbox"', () => {
      renderLightbox();
      expect(screen.getByTestId('image-lightbox')).toBeInTheDocument();
    });

    it('close button has accessible aria-label', () => {
      renderLightbox();
      const closeBtn = screen.getByTestId('lightbox-close-btn');
      expect(closeBtn).toHaveAttribute('aria-label', 'Close image viewer');
    });

    it('zoom in button has accessible aria-label', () => {
      renderLightbox();
      const zoomInBtn = screen.getByTestId('lightbox-zoom-in-btn');
      expect(zoomInBtn).toHaveAttribute('aria-label', 'Zoom in');
    });

    it('zoom out button has accessible aria-label', () => {
      renderLightbox();
      const zoomOutBtn = screen.getByTestId('lightbox-zoom-out-btn');
      expect(zoomOutBtn).toHaveAttribute('aria-label', 'Zoom out');
    });

    it('zoom level region has aria-live="polite"', () => {
      renderLightbox();
      const zoomLevel = screen.getByTestId('lightbox-zoom-level');
      expect(zoomLevel).toHaveAttribute('aria-live', 'polite');
      expect(zoomLevel).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const { onClose } = renderLightbox();
      fireEvent.click(screen.getByTestId('lightbox-close-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked directly', () => {
      const { onClose } = renderLightbox();
      const backdrop = screen.getByTestId('lightbox-backdrop');
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when image is clicked', () => {
      const { onClose } = renderLightbox();
      const image = screen.getByTestId('lightbox-image');
      fireEvent.click(image);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('zoom controls', () => {
    it('displays initial zoom level of 100%', () => {
      renderLightbox();
      expect(screen.getByTestId('lightbox-zoom-level').textContent).toBe('100%');
    });

    it('zoom in increases displayed level by 25%', () => {
      renderLightbox();
      fireEvent.click(screen.getByTestId('lightbox-zoom-in-btn'));
      expect(screen.getByTestId('lightbox-zoom-level').textContent).toBe('125%');
    });

    it('zoom out decreases displayed level by 25%', () => {
      renderLightbox();
      fireEvent.click(screen.getByTestId('lightbox-zoom-out-btn'));
      expect(screen.getByTestId('lightbox-zoom-level').textContent).toBe('75%');
    });

    it('multiple zoom in clicks accumulate correctly', () => {
      renderLightbox();
      const zoomInBtn = screen.getByTestId('lightbox-zoom-in-btn');
      fireEvent.click(zoomInBtn);
      fireEvent.click(zoomInBtn);
      fireEvent.click(zoomInBtn);
      expect(screen.getByTestId('lightbox-zoom-level').textContent).toBe('175%');
    });
  });

  describe('zoom boundary states', () => {
    it('zoom out button is disabled at minimum (50%)', () => {
      renderLightbox();
      const zoomOutBtn = screen.getByTestId('lightbox-zoom-out-btn');
      // Click zoom out from 100% down to 50%: 100 -> 75 -> 50
      fireEvent.click(zoomOutBtn);
      fireEvent.click(zoomOutBtn);
      expect(screen.getByTestId('lightbox-zoom-level').textContent).toBe('50%');
      expect(zoomOutBtn).toBeDisabled();
    });

    it('zoom in button is disabled at maximum (300%)', () => {
      renderLightbox();
      const zoomInBtn = screen.getByTestId('lightbox-zoom-in-btn');
      // Click zoom in from 100% up to 300%: 8 clicks * 25 = 200 + 100 = 300
      for (let i = 0; i < 8; i++) {
        fireEvent.click(zoomInBtn);
      }
      expect(screen.getByTestId('lightbox-zoom-level').textContent).toBe('300%');
      expect(zoomInBtn).toBeDisabled();
    });

    it('zoom out button is enabled when not at minimum', () => {
      renderLightbox();
      expect(screen.getByTestId('lightbox-zoom-out-btn')).not.toBeDisabled();
    });

    it('zoom in button is enabled when not at maximum', () => {
      renderLightbox();
      expect(screen.getByTestId('lightbox-zoom-in-btn')).not.toBeDisabled();
    });
  });

  describe('image rendering', () => {
    it('renders image with correct src and alt', () => {
      renderLightbox({ src: 'https://example.com/photo.jpg', alt: 'A photo' });
      const img = screen.getByTestId('lightbox-image');
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
      expect(img).toHaveAttribute('alt', 'A photo');
    });

    it('applies scale transform based on zoom level', () => {
      renderLightbox();
      const img = screen.getByTestId('lightbox-image');
      // Default is 100% = scale(1)
      expect(img.style.transform).toBe('scale(1)');
      fireEvent.click(screen.getByTestId('lightbox-zoom-in-btn'));
      // 125% = scale(1.25)
      expect(img.style.transform).toBe('scale(1.25)');
    });
  });
});
