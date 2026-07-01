# Design Document: Image Lightbox with Zoom Controls

## Overview

The ImageLightbox is a standalone React component that renders a full-viewport modal overlay when a user clicks on an image within the Reader content. It displays the clicked image centered on a dark semi-transparent backdrop, with zoom in/out controls and a close button. The component integrates with the existing i18n translation system and follows the codebase's inline-style conventions.

## Architecture

### Component Hierarchy

```
Reader.tsx
  └── ImageLightbox.tsx (conditionally rendered when lightbox is open)
        ├── Backdrop (onClick → close)
        ├── Close button
        ├── Zoom controls (zoom in / zoom out buttons + level display)
        └── Image (scaled by current zoom level)
```

### State Management

The lightbox state lives in the Reader component:
- `lightboxImage: { src: string; alt: string } | null` — `null` means closed, otherwise holds the image data to display.

The zoom state lives locally in the ImageLightbox component:
- `zoomLevel: number` — current zoom percentage, default 100%, range 50–300%, step 25%.

### Data Flow

1. Reader renders images with an `onClick` handler attached to each `<img>` in the content.
2. On click, Reader sets `lightboxImage` state with `{ src, alt }` from the clicked element.
3. When `lightboxImage` is non-null, Reader renders `<ImageLightbox>`.
4. ImageLightbox manages its own zoom state internally.
5. Closing (via close button or backdrop click) calls an `onClose` prop which sets `lightboxImage` back to `null`.

## Components and Interfaces

### ImageLightbox

**File:** `src/components/ImageLightbox.tsx`

```typescript
import React, { useState } from 'react';
import { useTranslations } from '../i18n';

export interface ImageLightboxProps {
  /** Source URL of the image to display. */
  src: string;
  /** Alt text for the image. */
  alt: string;
  /** Callback invoked when the lightbox should close. */
  onClose: () => void;
}

// Zoom configuration
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;
const DEFAULT_ZOOM = 100;

/**
 * Clamp a zoom value to the valid range [MIN_ZOOM, MAX_ZOOM],
 * snapping to the nearest ZOOM_STEP increment.
 */
export function clampLightboxZoom(value: number): number {
  const snapped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, snapped));
}

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
      aria-label={t.lightboxLabel || alt}
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
```

### Inline Styles

```typescript
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
};
```

## Integration with Reader.tsx

The Reader component adds an `onClick` handler to images in its `renderContentNode` function and conditionally renders the ImageLightbox:

```typescript
// State in Reader component
const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

// In the 'image' case of renderContentNode:
case 'image':
  return (
    <figure style={{ margin: '1rem 0', padding: 0, breakInside: 'avoid' }}>
      <img
        src={node.src}
        alt={node.alt || ''}
        loading="lazy"
        onClick={() => setLightboxImage({ src: node.src!, alt: node.alt || '' })}
        style={{
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 120px)',
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      />
      {node.alt && (
        <figcaption style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '0.4rem', textAlign: 'center' }}>
          {node.alt}
        </figcaption>
      )}
    </figure>
  );

// Render lightbox at the top level of Reader output:
{lightboxImage && (
  <ImageLightbox
    src={lightboxImage.src}
    alt={lightboxImage.alt}
    onClose={() => setLightboxImage(null)}
  />
)}
```

## Data Models

### ImageLightboxProps Interface

| Property | Type | Description |
|----------|------|-------------|
| `src` | `string` | The image source URL |
| `alt` | `string` | The image alt text |
| `onClose` | `() => void` | Callback to close the lightbox |

### Zoom Configuration Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MIN_ZOOM` | 50 | Minimum zoom level (50%) |
| `MAX_ZOOM` | 300 | Maximum zoom level (300%) |
| `ZOOM_STEP` | 25 | Step increment per zoom button click |
| `DEFAULT_ZOOM` | 100 | Initial zoom level when lightbox opens |

## Internationalization

New keys added to `TranslationStrings`:

```typescript
// Image lightbox
lightboxClose: string;
lightboxZoomIn: string;
lightboxZoomOut: string;
lightboxLabel: string; // supports {alt}
```

Default values:

```typescript
// Image lightbox
lightboxClose: 'Close image viewer',
lightboxZoomIn: 'Zoom in',
lightboxZoomOut: 'Zoom out',
lightboxLabel: 'Image viewer',
```

## Error Handling

- If `src` is empty or the image fails to load, the `<img>` element's native error handling applies (broken image icon). The lightbox still renders with controls functional.
- If translation keys are missing, the component falls back to the default English strings via `DEFAULT_TRANSLATIONS`.
- The `clampLightboxZoom` function ensures zoom values always stay within the valid range regardless of arithmetic edge cases.

## Testing Strategy

### Unit Tests
- Verify lightbox renders with correct ARIA attributes when opened
- Verify close button dismisses the lightbox
- Verify backdrop click dismisses the lightbox
- Verify zoom buttons are present and display correct level
- Verify disabled state of zoom buttons at min/max boundaries

### Property Tests
- Zoom clamping invariant across all possible zoom operations
- Zoom step correctness for zoom in/out from any valid level
- Translation string passthrough for all button labels
- Image data passthrough from Reader click to lightbox props
- Aria-live region updates on every zoom level change

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Image data passthrough

For any image element with a source URL and alt text rendered by the Reader, when the user clicks that image, the ImageLightbox SHALL receive the exact same source URL and alt text as its props.

**Validates: Requirements 1.2, 7.3**

### Property 2: Zoom step correctness

For any current zoom level within the valid range (50–300%), clicking the zoom in button SHALL produce a new zoom level equal to `min(current + 25, 300)`, and clicking the zoom out button SHALL produce a new zoom level equal to `max(current - 25, 50)`.

**Validates: Requirements 3.2, 3.3**

### Property 3: Zoom clamping invariant

For any sequence of zoom operations (zoom in or zoom out, in any order and any count), the resulting zoom level SHALL always be within the range [50, 300] inclusive, and SHALL always be a multiple of 25.

**Validates: Requirements 3.4, 3.5**

### Property 4: Zoom level announcement

For any zoom level change (via zoom in or zoom out), the aria-live region SHALL contain a text representation of the current zoom level percentage.

**Validates: Requirements 5.5**

### Property 5: Translation string usage

For any set of translation strings provided via TranslationContext, the lightbox close button's aria-label SHALL equal the provided `lightboxClose` string, the zoom in button's aria-label SHALL equal the provided `lightboxZoomIn` string, and the zoom out button's aria-label SHALL equal the provided `lightboxZoomOut` string.

**Validates: Requirements 6.1**
