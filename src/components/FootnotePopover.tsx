/**
 * FootnotePopover Component — displays footnote content in a positioned popover.
 * Follows the DictionaryPopover pattern for positioning, dismissal, and focus management.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { InlineNode, FootnoteRefSpan } from '../models/book';
import { useTranslations, interpolate } from '../i18n';

export interface FootnotePopoverProps {
  /** The footnote data to display */
  footnote: FootnoteRefSpan | null;
  /** Anchor position for the popover (relative to reader viewport) */
  anchorPosition?: { top: number; left: number };
  /** Whether the popover is visible */
  visible?: boolean;
  /** Called when the user dismisses the popover */
  onClose?: () => void;
  /** Render function for inline nodes (passed from Reader) */
  renderInlineNode: (node: InlineNode, index: number) => React.ReactNode;
}

export const FootnotePopover: React.FC<FootnotePopoverProps> = ({
  footnote,
  anchorPosition,
  visible = true,
  onClose,
  renderInlineNode,
}) => {
  const t = useTranslations();
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when the popover becomes visible
  useEffect(() => {
    if (visible && footnote) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus the popover after render
      requestAnimationFrame(() => {
        popoverRef.current?.focus();
      });
    }
  }, [visible, footnote]);

  // Restore focus to previously focused element on close
  const handleClose = useCallback(() => {
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      previousFocusRef.current.focus();
    }
    previousFocusRef.current = null;
    onClose?.();
  }, [onClose]);

  // Escape key listener
  useEffect(() => {
    if (!visible || !footnote) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, footnote, handleClose]);

  // Close on click outside the popover
  useEffect(() => {
    if (!visible || !footnote) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const popover = popoverRef.current;
      if (!popover) return;
      if (!popover.contains(event.target as Node)) {
        handleClose();
      }
    };

    // Use a short delay so the opening click doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [visible, footnote, handleClose]);

  // Focus trapping: Tab cycles within popover interactive elements
  useEffect(() => {
    if (!visible || !footnote) {
      return;
    }

    const handleTabTrap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }

      const popover = popoverRef.current;
      if (!popover) {
        return;
      }

      const focusableElements = popover.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) {
        // No focusable elements, keep focus on the popover
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === firstElement || document.activeElement === popover) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabTrap);
    return () => {
      document.removeEventListener('keydown', handleTabTrap);
    };
  }, [visible, footnote]);

  if (!visible || !footnote) {
    return null;
  }

  const style: React.CSSProperties = anchorPosition
    ? {
        position: 'absolute',
        top: `${anchorPosition.top + 8}px`,
        left: `${anchorPosition.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'var(--reader-bg, #ffffff)',
        color: 'var(--reader-fg, #1a1a1a)',
        border: '1px solid var(--reader-border, #e0e0e0)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '12px 16px',
        maxWidth: '340px',
        maxHeight: '50vh',
        overflowY: 'auto',
        fontSize: '14px',
        lineHeight: '1.5',
      }
    : { position: 'relative' as const };

  return (
    <div
      data-testid="footnote-popover"
      role="dialog"
      aria-label={interpolate(t.footnoteDialogLabel, { label: footnote.label })}
      style={style}
      ref={popoverRef}
      tabIndex={-1}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <button
          type="button"
          data-testid="footnote-close"
          aria-label={t.footnoteClose}
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '2px 6px',
            borderRadius: '4px',
            color: 'var(--reader-fg, #666)',
            opacity: 0.7,
          }}
        >
          ×
        </button>
      </div>
      <div data-testid="footnote-content">
        {footnote.content.map((node, i) => renderInlineNode(node, i))}
      </div>
    </div>
  );
};

export default FootnotePopover;
