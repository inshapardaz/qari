/**
 * ImageLightbox Component — displays an image in a full-viewport modal overlay
 * with zoom in/out controls.
 *
 * Provides:
 * - Full-viewport dark backdrop with centered image
 * - Zoom in/out buttons (25% step, range 50–300%)
 * - Close button and backdrop click-to-close
 * - Accessible dialog with aria-live zoom level announcements
 * - Integration with the i18n translation system
 *
 * Zoom levels: 50-300% in 25% increments, default 100%.
 */

import React, { useState } from 'react';
import { useTranslations } from '../i18n';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;
const DEFAULT_ZOOM = 100;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Clamp a zoom value to the valid range [50, 300],
 * snapping to the nearest 25% increment.
 */
export function clampLightboxZoom(value: number): number {
  const snapped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, snapped));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImageLightboxProps {
  /** Source URL of the image to display. */
  src: string;
  /** Alt text for the image. */
  alt: string;
  /** Callback invoked when the lightbox should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Inline Styles
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  background: 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: '1.5rem',
  cursor: 'pointer',
  padding: '0.5rem',
  lineHeight: 1,
};

const controlsStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  background: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '8px',
  padding: '0.5rem 1rem',
};

const zoomButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  color: '#fff',
  fontSize: '1.2rem',
  cursor: 'pointer',
  padding: '0.25rem 0.75rem',
  borderRadius: '4px',
  lineHeight: 1,
};

const zoomLevelStyle: React.CSSProperties = {
  color: '#fff',
  fontSize: '0.9rem',
  minWidth: '4ch',
  textAlign: 'center',
};

const imageStyle: React.CSSProperties = {
  maxWidth: '90vw',
  maxHeight: '80vh',
  objectFit: 'contain',
  transition: 'transform 0.15s ease',
  background: 'rgba(255, 255, 255, 0.95)',
  borderRadius: '4px',
  padding: '8px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
  const t = useTranslations();
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);

  const canZoomIn = zoomLevel < MAX_ZOOM;
  const canZoomOut = zoomLevel > MIN_ZOOM;

  const handleZoomIn = () => {
    setZoomLevel(prev => clampLightboxZoom(prev + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => clampLightboxZoom(prev - ZOOM_STEP));
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the backdrop itself was clicked, not child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-label={t.lightboxLabel}
      style={overlayStyle}
      onClick={handleBackdropClick}
      data-testid="image-lightbox"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label={t.lightboxClose}
        style={closeButtonStyle}
        data-testid="lightbox-close-btn"
      >
        ✕
      </button>

      {/* Zoom controls */}
      <div style={controlsStyle} role="toolbar" aria-label={t.zoomControls}>
        <button
          onClick={handleZoomOut}
          disabled={!canZoomOut}
          aria-label={t.lightboxZoomOut}
          data-testid="lightbox-zoom-out-btn"
          style={zoomButtonStyle}
        >
          −
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          data-testid="lightbox-zoom-level"
          style={zoomLevelStyle}
        >
          {zoomLevel}%
        </span>
        <button
          onClick={handleZoomIn}
          disabled={!canZoomIn}
          aria-label={t.lightboxZoomIn}
          data-testid="lightbox-zoom-in-btn"
          style={zoomButtonStyle}
        >
          +
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        style={{
          ...imageStyle,
          transform: `scale(${zoomLevel / 100})`,
        }}
        data-testid="lightbox-image"
      />
    </div>
  );
};

export default ImageLightbox;
