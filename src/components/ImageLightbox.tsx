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
import { Modal, ActionIcon, Group, Text } from '@mantine/core';
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

const bodyStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  color: '#fff',
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
    // Only close if the backdrop itself was clicked, not child elements.
    // Mantine's Modal.Overlay sits behind the full-screen Content and isn't
    // reachable by clicks in fullScreen mode, so this reproduces
    // click-outside-to-close on the content's own background area.
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Modal.Root opened onClose={onClose} fullScreen radius={0}>
      <Modal.Overlay />
      <Modal.Content
        data-testid="image-lightbox"
        aria-label={t.lightboxLabel}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      >
      <Modal.Body style={{ height: '100%', padding: 0 }}>
      <div style={bodyStyle} onClick={handleBackdropClick} data-testid="lightbox-backdrop">
        {/* Close button */}
        <ActionIcon
          onClick={onClose}
          aria-label={t.lightboxClose}
          style={closeButtonStyle}
          data-testid="lightbox-close-btn"
          variant="subtle"
          color="gray"
          size="lg"
        >
          ✕
        </ActionIcon>

        {/* Zoom controls */}
        <Group style={controlsStyle} role="toolbar" aria-label={t.zoomControls} gap="sm">
          <ActionIcon
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            aria-label={t.lightboxZoomOut}
            data-testid="lightbox-zoom-out-btn"
            variant="default"
          >
            −
          </ActionIcon>
          <Text
            aria-live="polite"
            aria-atomic="true"
            data-testid="lightbox-zoom-level"
            style={zoomLevelStyle}
          >
            {zoomLevel}%
          </Text>
          <ActionIcon
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            aria-label={t.lightboxZoomIn}
            data-testid="lightbox-zoom-in-btn"
            variant="default"
          >
            +
          </ActionIcon>
        </Group>

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
      </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
};

export default ImageLightbox;
