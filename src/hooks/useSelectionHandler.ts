/**
 * Selection handler hook and word extraction utilities for dictionary lookups.
 *
 * This module provides:
 * - extractFirstWord: Pure helper to extract the first whitespace-delimited token from a string
 * - extractWordAtSelection: DOM-aware helper that extracts the selected word and its position
 *   within the chapter text body
 * - useSelectionHandler: React hook that listens for contextmenu/long-press events,
 *   extracts the selected word, computes anchor position, and manages lookup state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DictionaryLookupResult } from '../services/dictionary-service';

/**
 * Extracts the first whitespace-delimited token from a string.
 *
 * @param text - The input string to extract a word from
 * @returns The first token, or null if the string is empty or whitespace-only
 */
export function extractFirstWord(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }
  const tokens = text.trim().split(/\s+/);
  return tokens[0] || null;
}

/**
 * Extracts the selected word and determines its character position within
 * the chapter text body.
 *
 * @param selection - The browser Selection object
 * @returns An object with the extracted word and its character position, or null
 *          if the selection is empty or whitespace-only
 */
export function extractWordAtSelection(
  selection: Selection
): { word: string; position: number } | null {
  const text = selection.toString();

  const word = extractFirstWord(text);
  if (!word) {
    return null;
  }

  // Determine the character position of the word within the chapter text body.
  // We walk backwards from the anchor node to compute the offset within the
  // containing block (the content area).
  const anchorNode = selection.anchorNode;
  const anchorOffset = selection.anchorOffset;

  if (!anchorNode) {
    return { word, position: 0 };
  }

  // Find the position by calculating the text offset from the start of
  // the container element. Walk up to find the nearest block-level container
  // that represents the chapter content area.
  const container = findContentContainer(anchorNode);
  if (!container) {
    return { word, position: anchorOffset };
  }

  const position = getTextOffsetInContainer(container, anchorNode, anchorOffset);
  return { word, position };
}

/**
 * Finds the nearest ancestor element that acts as a content container.
 * Looks for common reader content area markers (data attributes, class names,
 * or falls back to the closest block-level parent).
 */
function findContentContainer(node: Node): Element | null {
  let current: Node | null = node;

  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      // Check for common content container markers
      if (
        element.hasAttribute('data-chapter-content') ||
        element.getAttribute('role') === 'article' ||
        element.classList.contains('reader-content') ||
        element.tagName === 'ARTICLE'
      ) {
        return element;
      }
    }
    current = current.parentNode;
  }

  // Fall back to the body or the closest parent element of the anchor
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }
  return node.parentElement;
}

/**
 * Calculates the text character offset from the start of a container element
 * to a specific point (node + offset) within it using a TreeWalker.
 */
function getTextOffsetInContainer(
  container: Element,
  targetNode: Node,
  targetOffset: number
): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;

  let current = walker.nextNode();
  while (current) {
    if (current === targetNode) {
      return offset + targetOffset;
    }
    offset += (current.textContent?.length ?? 0);
    current = walker.nextNode();
  }

  // If we didn't find the exact node (shouldn't happen in practice),
  // return the accumulated offset
  return offset + targetOffset;
}


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnchorPosition {
  top: number;
  left: number;
}

export type SelectionLookupStatus = 'idle' | 'loading' | 'success' | 'error' | 'not-found';

export interface SelectionLookupState {
  status: SelectionLookupStatus;
  result: DictionaryLookupResult | null;
  error?: string;
}

export interface UseSelectionHandlerOptions {
  /** Ref to the content area element to attach event listeners to */
  contentRef: React.RefObject<HTMLElement | null>;
  /** Whether any dictionary providers are registered */
  hasProviders: boolean;
  /** Long-press threshold in milliseconds (default: 500) */
  longPressThreshold?: number;
  /**
   * When true, the hook does not attach its own native `contextmenu`
   * listener — the caller has its own right-click handling (e.g. a unified
   * context menu offering both a dictionary lookup and other actions) and
   * invokes `triggerFromCurrentSelection` itself once the user picks the
   * lookup option. Defaults to false.
   *
   * Only affects the `contextmenu` (mouse/right-click) listener — pair with
   * `onLongPress` to also redirect the separate touch long-press gesture to
   * the same caller-owned menu; leaving `onLongPress` unset while this is
   * true means long-press keeps going straight to the dictionary lookup
   * even though right-click no longer does, which is rarely what's wanted.
   */
  disableContextMenu?: boolean;
  /**
   * When provided, a detected long-press (touch) calls this instead of the
   * hook's own dictionary-lookup trigger — mirroring `disableContextMenu`
   * for the touch gesture. Given the long-press's screen position and the
   * original touch's target element (the same two pieces of information a
   * `contextmenu`/`click` event's `clientX`/`clientY`/`target` would give a
   * caller-owned handler), and returning whether it actually did something
   * with the gesture; when it returns `false` (e.g. there was no selection
   * or note highlight to act on), the hook falls back to its own dictionary
   * lookup so a plain word long-press keeps working even with this set.
   */
  onLongPress?: (position: { x: number; y: number }, target: EventTarget | null) => boolean;
}

export interface UseSelectionHandlerReturn {
  /** Position for the popover anchor (null when no lookup is active) */
  anchorPosition: AnchorPosition | null;
  /** Current lookup state */
  lookupState: SelectionLookupState;
  /** Trigger a lookup for a given word/position programmatically */
  triggerLookup: (word: string, position: number) => void;
  /** Dismiss the popover and reset state to idle */
  dismiss: () => void;
  /**
   * Computes the anchor position and triggers a lookup for the current
   * browser selection — exactly what the hook's own contextmenu handler
   * does internally. Exposed for callers using `disableContextMenu: true`.
   * Returns false if there's no usable selection to look up.
   */
  triggerFromCurrentSelection: () => boolean;
}

// ---------------------------------------------------------------------------
// Hook: useSelectionHandler
// ---------------------------------------------------------------------------

/**
 * Hook that listens for contextmenu (right-click) and long-press events on
 * the reader content area, extracts the selected word, computes anchor
 * position, and manages the selection lookup state.
 *
 * @param options - Configuration for the selection handler
 * @returns Object with anchorPosition, lookupState, triggerLookup, and dismiss
 */
export function useSelectionHandler(
  options: UseSelectionHandlerOptions
): UseSelectionHandlerReturn {
  const { contentRef, hasProviders, longPressThreshold = 500, disableContextMenu = false, onLongPress } = options;

  const [anchorPosition, setAnchorPosition] = useState<AnchorPosition | null>(null);
  const [lookupState, setLookupState] = useState<SelectionLookupState>({
    status: 'idle',
    result: null,
  });

  // Track when contentRef.current becomes available (for lazy-mounted content areas)
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Poll briefly for the ref to be populated (handles conditional rendering)
    const check = () => {
      if (contentRef.current && contentRef.current !== contentElement) {
        setContentElement(contentRef.current);
      }
    };
    check();
    // Re-check after a short delay in case the element mounts later
    const timer = setTimeout(check, 100);
    const timer2 = setTimeout(check, 500);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  });

  // Refs for long-press detection
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Compute anchor position from the selection's bounding rect.
   * Positions the anchor at the bottom-center of the first range rect,
   * relative to the content area's nearest positioned ancestor.
   */
  const computeAnchorPosition = useCallback((): AnchorPosition | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    // Get the positioned ancestor (the reader root with position: relative)
    // to compute relative coordinates for the absolutely-positioned popover
    const container = contentElement?.closest('[style*="position"]') 
      ?? contentElement?.offsetParent 
      ?? document.body;
    const containerRect = (container as HTMLElement).getBoundingClientRect();

    return {
      top: rect.bottom - containerRect.top,
      left: rect.left + rect.width / 2 - containerRect.left,
    };
  }, [contentElement]);

  /**
   * Trigger a dictionary lookup. This sets the state to 'loading'.
   * The actual lookup is performed externally (by the Reader/parent component)
   * which should call updateLookupResult when done.
   */
  const triggerLookup = useCallback((word: string, position: number) => {
    setLookupState({
      status: 'loading',
      result: null,
    });
  }, []);

  /**
   * Dismiss the popover and reset state to idle.
   */
  const dismiss = useCallback(() => {
    setAnchorPosition(null);
    setLookupState({
      status: 'idle',
      result: null,
    });
  }, []);

  /**
   * Handle a selection trigger (from either contextmenu or long-press).
   * Extracts the selected word, computes anchor position, and initiates lookup.
   */
  const handleSelectionTrigger = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const extracted = extractWordAtSelection(selection);
    if (!extracted) {
      return false;
    }

    const anchor = computeAnchorPosition();
    if (!anchor) {
      return false;
    }

    setAnchorPosition(anchor);
    triggerLookup(extracted.word, extracted.position);
    return true;
  }, [computeAnchorPosition, triggerLookup]);

  // ---------------------------------------------------------------------------
  // Context menu (right-click) handler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const element = contentElement;
    if (!element || !hasProviders || disableContextMenu) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      // Check if there's a text selection
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        // No text selected — allow default context menu
        return;
      }

      // Check if the selection is within the content area
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !element.contains(anchorNode)) {
        // Selection is outside content area — allow default
        return;
      }

      // Text is selected and providers are registered — prevent default and trigger lookup
      event.preventDefault();
      handleSelectionTrigger();
    };

    element.addEventListener('contextmenu', handleContextMenu);

    return () => {
      element.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [contentElement, hasProviders, disableContextMenu, handleSelectionTrigger]);

  // ---------------------------------------------------------------------------
  // Long-press (touch) handler
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const element = contentElement;
    // Previously gated on `hasProviders` alone, which meant a consumer with
    // notes enabled but no dictionary providers configured never got a
    // long-press listener attached at all — "Add note" by touch silently
    // didn't work in that configuration. `onLongPress` (the caller-owned
    // unified-menu path) is an equally valid reason to listen.
    if (!element || (!hasProviders && !onLongPress)) {
      return;
    }

    const handleTouchStart = (event: TouchEvent) => {
      // Record the touch start position (for move detection, and as the
      // long-press's own anchor point — see its use below) plus the
      // original target element, mirroring what a `contextmenu`/`click`
      // event would give a caller-owned handler.
      const touch = event.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      const target = event.target;

      // Start a timer for long-press detection
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        const position = touchStartPosRef.current;
        // `onLongPress` (when provided) owns this gesture — e.g. Reader's
        // own unified note/dictionary menu — falling back to the built-in
        // dictionary-only trigger only if it declines to handle this
        // particular long-press (no selection or highlight under it).
        if (onLongPress && position) {
          if (onLongPress(position, target)) return;
        }
        handleSelectionTrigger();
      }, longPressThreshold);
    };

    const handleTouchMove = (event: TouchEvent) => {
      // If the user moves their finger significantly, cancel long-press
      if (longPressTimerRef.current && touchStartPosRef.current) {
        const touch = event.touches[0];
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Cancel if moved more than 10px
        if (distance > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    };

    const handleTouchEnd = () => {
      // Cancel the long-press timer if the touch ends before the threshold
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      touchStartPosRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);

      // Clean up any pending timer on unmount
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
  }, [contentElement, hasProviders, longPressThreshold, handleSelectionTrigger, onLongPress]);

  return {
    anchorPosition,
    lookupState,
    triggerLookup,
    dismiss,
    triggerFromCurrentSelection: handleSelectionTrigger,
  };
}
