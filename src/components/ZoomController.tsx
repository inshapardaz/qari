/**
 * ZoomController Component — manages zoom level and pinch-zoom gestures.
 *
 * Provides:
 * - useZoom hook for zoom state management
 * - ZoomController wrapper component with pinch-zoom gesture handling
 * - ZoomControls UI for zoom in/out buttons and level display
 *
 * Zoom levels: 50-300% in 10% increments, default 100%.
 * Pinch-zoom snaps to nearest 10% on gesture end.
 * Reading position is preserved on zoom changes.
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

import { ActionIcon, Group, Text } from '@mantine/core';
import { clampZoom } from './Reader';
import { useTranslations } from '../i18n';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 10;
const DEFAULT_ZOOM = 100;

// ---------------------------------------------------------------------------
// useZoom Hook
// ---------------------------------------------------------------------------

export interface UseZoomOptions {
  /** Initial zoom level (will be clamped). Defaults to 100. */
  initialZoom?: number;
  /** Callback invoked when zoom level changes. */
  onZoomChange?: (zoom: number) => void;
}

export interface UseZoomResult {
  /** Current zoom level (always a clamped, snapped value). */
  zoom: number;
  /** Set zoom to a specific value (will be clamped and snapped). */
  setZoom: (value: number) => void;
  /** Increment zoom by one step (10%). */
  zoomIn: () => void;
  /** Decrement zoom by one step (10%). */
  zoomOut: () => void;
  /** Whether zoom can be increased further. */
  canZoomIn: boolean;
  /** Whether zoom can be decreased further. */
  canZoomOut: boolean;
}

/**
 * Hook for managing zoom state with clamping and 10% step snapping.
 */
export function useZoom(options: UseZoomOptions = {}): UseZoomResult {
  const { initialZoom = DEFAULT_ZOOM, onZoomChange } = options;
  const [zoom, setZoomState] = useState<number>(() => clampZoom(initialZoom));
  const onZoomChangeRef = useRef(onZoomChange);

  // Keep the callback ref up to date without triggering effects
  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  const setZoom = useCallback((value: number) => {
    const clamped = clampZoom(value);
    setZoomState(prev => {
      if (prev === clamped) return prev;
      // Notify via callback
      onZoomChangeRef.current?.(clamped);
      return clamped;
    });
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState(prev => {
      const next = clampZoom(prev + ZOOM_STEP);
      if (next !== prev) {
        onZoomChangeRef.current?.(next);
      }
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState(prev => {
      const next = clampZoom(prev - ZOOM_STEP);
      if (next !== prev) {
        onZoomChangeRef.current?.(next);
      }
      return next;
    });
  }, []);

  return {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
  };
}

// ---------------------------------------------------------------------------
// Pinch-Zoom Gesture Utilities
// ---------------------------------------------------------------------------

/**
 * Calculate the distance between two touch points.
 */
function getTouchDistance(touch1: React.Touch | Touch, touch2: React.Touch | Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute zoom from a pinch gesture given a starting distance,
 * current distance, and the zoom level at gesture start.
 */
export function computePinchZoom(
  startDistance: number,
  currentDistance: number,
  startZoom: number
): number {
  if (startDistance === 0) return startZoom;
  const scale = currentDistance / startDistance;
  return startZoom * scale;
}

/**
 * Snap a raw zoom value to the nearest 10% increment within [50, 300].
 * This is equivalent to clampZoom but named for clarity in gesture context.
 */
export function snapZoom(rawZoom: number): number {
  return clampZoom(rawZoom);
}

// ---------------------------------------------------------------------------
// ZoomControls Component
// ---------------------------------------------------------------------------

export interface ZoomControlsProps {
  /** Current zoom level. */
  zoom: number;
  /** Whether zoom in is available. */
  canZoomIn: boolean;
  /** Whether zoom out is available. */
  canZoomOut: boolean;
  /** Called when user clicks zoom in. */
  onZoomIn: () => void;
  /** Called when user clicks zoom out. */
  onZoomOut: () => void;
}

/**
 * Zoom control buttons with current level display.
 */
export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
}) => {
  const t = useTranslations();
  return (
    <Group
      className="zoom-controls"
      data-testid="zoom-controls"
      role="toolbar"
      aria-label={t.zoomControls}
      gap="xs"
    >
      <ActionIcon
        className="zoom-controls__btn zoom-controls__btn--out"
        data-testid="zoom-out-btn"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label={`${t.zoomOut}. Current zoom ${zoom}%`}
        title={t.zoomOut}
        variant="default"
      >
        −
      </ActionIcon>
      <Text
        className="zoom-controls__level"
        data-testid="zoom-level"
        aria-live="polite"
        aria-atomic="true"
        size="sm"
      >
        {zoom}%
      </Text>
      <ActionIcon
        className="zoom-controls__btn zoom-controls__btn--in"
        data-testid="zoom-in-btn"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label={`${t.zoomIn}. Current zoom ${zoom}%`}
        title={t.zoomIn}
        variant="default"
      >
        +
      </ActionIcon>
    </Group>
  );
};

// ---------------------------------------------------------------------------
// ZoomController Component
// ---------------------------------------------------------------------------

export interface ZoomControllerProps {
  /** Children to render inside the zoom container. */
  children: React.ReactNode;
  /** Initial zoom level (default 100). */
  initialZoom?: number;
  /** Callback when zoom changes. */
  onZoomChange?: (zoom: number) => void;
  /** Whether to show zoom control buttons (default true). */
  showControls?: boolean;
  /** External zoom override — when provided, overrides internal state. */
  zoom?: number;
  /** Class name for the container. */
  className?: string;
}

/**
 * ZoomController wraps content and provides:
 * - Pinch-zoom gesture support on touch devices
 * - Zoom in/out buttons
 * - CSS transform scaling with reading position preservation
 */
export const ZoomController: React.FC<ZoomControllerProps> = ({
  children,
  initialZoom = DEFAULT_ZOOM,
  onZoomChange,
  showControls = true,
  zoom: externalZoom,
  className,
}) => {
  const {
    zoom: internalZoom,
    setZoom,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
  } = useZoom({ initialZoom, onZoomChange });

  // Use external zoom if provided, otherwise use internal state
  const activeZoom = externalZoom !== undefined ? clampZoom(externalZoom) : internalZoom;

  // Pinch gesture tracking refs
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    startDistance: number;
    startZoom: number;
    active: boolean;
  }>({ startDistance: 0, startZoom: activeZoom, active: false });

  // Track scroll position for reading position preservation
  const scrollRef = useRef<{ scrollTop: number; scrollHeight: number; ratio: number }>({
    scrollTop: 0,
    scrollHeight: 0,
    ratio: 0,
  });

  // Sync external zoom to internal state when it changes
  useEffect(() => {
    if (externalZoom !== undefined) {
      setZoom(externalZoom);
    }
  }, [externalZoom, setZoom]);

  // ---------------------------------------------------------------------------
  // Reading position preservation
  // ---------------------------------------------------------------------------

  const saveScrollPosition = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      const scrollHeight = el.scrollHeight - el.clientHeight;
      scrollRef.current = {
        scrollTop: el.scrollTop,
        scrollHeight,
        ratio: scrollHeight > 0 ? el.scrollTop / scrollHeight : 0,
      };
    }
  }, []);

  const restoreScrollPosition = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      // Use requestAnimationFrame to ensure DOM has reflowed after zoom change
      requestAnimationFrame(() => {
        const newScrollHeight = el.scrollHeight - el.clientHeight;
        if (newScrollHeight > 0) {
          el.scrollTop = scrollRef.current.ratio * newScrollHeight;
        }
      });
    }
  }, []);

  // Restore scroll position whenever zoom changes
  const prevZoomRef = useRef(activeZoom);
  useEffect(() => {
    if (prevZoomRef.current !== activeZoom) {
      restoreScrollPosition();
      prevZoomRef.current = activeZoom;
    }
  }, [activeZoom, restoreScrollPosition]);

  // ---------------------------------------------------------------------------
  // Pinch-zoom touch handlers
  // ---------------------------------------------------------------------------

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Save scroll position before gesture starts
      saveScrollPosition();

      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      gestureRef.current = {
        startDistance: distance,
        startZoom: activeZoom,
        active: true,
      };
    }
  }, [activeZoom, saveScrollPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!gestureRef.current.active || e.touches.length !== 2) return;

    // Prevent default scrolling during pinch
    e.preventDefault();

    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const rawZoom = computePinchZoom(
      gestureRef.current.startDistance,
      currentDistance,
      gestureRef.current.startZoom
    );

    // Apply zoom without snapping during gesture (smooth feel)
    // We still clamp to boundaries
    const bounded = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom));
    setZoom(bounded);
  }, [setZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!gestureRef.current.active) return;

    // If fewer than 2 fingers remain, end the gesture
    if (e.touches.length < 2) {
      gestureRef.current.active = false;

      // Snap to nearest 10% increment on gesture end
      setZoom(activeZoom);
    }
  }, [activeZoom, setZoom]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const containerStyle: React.CSSProperties = {
    overflow: 'auto',
    touchAction: 'pan-x pan-y',
    position: 'relative',
    width: '100%',
    height: '100%',
  };

  const contentStyle: React.CSSProperties = {
    transform: `scale(${activeZoom / 100})`,
    transformOrigin: 'top left',
    width: `${10000 / activeZoom}%`,
  };

  return (
    <div
      className={`zoom-controller ${className || ''}`.trim()}
      data-testid="zoom-controller"
    >
      {showControls && (
        <ZoomControls
          zoom={activeZoom}
          canZoomIn={canZoomIn}
          canZoomOut={canZoomOut}
          onZoomIn={() => {
            saveScrollPosition();
            zoomIn();
          }}
          onZoomOut={() => {
            saveScrollPosition();
            zoomOut();
          }}
        />
      )}
      <div
        ref={containerRef}
        className="zoom-controller__container"
        data-testid="zoom-container"
        style={containerStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="zoom-controller__content"
          data-testid="zoom-content"
          style={contentStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ZoomController;
