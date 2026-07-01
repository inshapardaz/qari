/**
 * Unit tests for FootnotePopover component.
 *
 * Requirements: 5.1, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FootnotePopover } from './FootnotePopover';
import type { FootnoteRefSpan, InlineNode } from '../models/book';

const sampleFootnote: FootnoteRefSpan = {
  type: 'footnote-ref',
  label: '1',
  content: [
    { type: 'text', content: 'This is a footnote.' },
  ],
};

const multiContentFootnote: FootnoteRefSpan = {
  type: 'footnote-ref',
  label: '3',
  content: [
    { type: 'text', content: 'First part. ' },
    { type: 'bold', children: [{ type: 'text', content: 'Bold part.' }] },
  ],
};

const defaultRenderInlineNode = (node: InlineNode, index: number) => {
  if (node.type === 'text') {
    return <span key={index}>{node.content}</span>;
  }
  if (node.type === 'bold') {
    return <strong key={index}>bold</strong>;
  }
  return <span key={index}>node</span>;
};

describe('FootnotePopover', () => {
  describe('rendering nothing when inactive', () => {
    it('renders nothing when footnote is null', () => {
      const { container } = render(
        <FootnotePopover footnote={null} renderInlineNode={defaultRenderInlineNode} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when visible is false', () => {
      const { container } = render(
        <FootnotePopover
          footnote={sampleFootnote}
          visible={false}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when both footnote is null and visible is false', () => {
      const { container } = render(
        <FootnotePopover
          footnote={null}
          visible={false}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('ARIA attributes and accessibility', () => {
    it('renders with role="dialog"', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-label with interpolated footnote label', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Footnote 1');
    });

    it('has aria-label reflecting different labels', () => {
      render(
        <FootnotePopover
          footnote={multiContentFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Footnote 3');
    });

    it('close button has accessible aria-label', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const closeBtn = screen.getByTestId('footnote-close');
      expect(closeBtn).toHaveAttribute('aria-label', 'Close footnote');
    });

    it('has data-testid="footnote-popover"', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      expect(screen.getByTestId('footnote-popover')).toBeInTheDocument();
    });
  });

  describe('close button click', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          onClose={onClose}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      fireEvent.click(screen.getByTestId('footnote-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('outside click dismissal', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls onClose when clicking outside the popover', () => {
      const onClose = vi.fn();
      render(
        <div>
          <div data-testid="outside-area">outside</div>
          <FootnotePopover
            footnote={sampleFootnote}
            onClose={onClose}
            renderInlineNode={defaultRenderInlineNode}
          />
        </div>
      );
      // Advance timers to pass the setTimeout(0) guard
      act(() => {
        vi.runAllTimers();
      });
      fireEvent.mouseDown(screen.getByTestId('outside-area'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when clicking inside the popover', () => {
      const onClose = vi.fn();
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          onClose={onClose}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      act(() => {
        vi.runAllTimers();
      });
      fireEvent.mouseDown(screen.getByTestId('footnote-popover'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Escape key dismissal', () => {
    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          onClose={onClose}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for other key presses', () => {
      const onClose = vi.fn();
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          onClose={onClose}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('focus management', () => {
    let rafCallbacks: FrameRequestCallback[];

    beforeEach(() => {
      rafCallbacks = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function flushRAF() {
      const cbs = [...rafCallbacks];
      rafCallbacks = [];
      cbs.forEach((cb) => cb(performance.now()));
    }

    it('moves focus to popover on open', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      act(() => {
        flushRAF();
      });
      const popover = screen.getByTestId('footnote-popover');
      expect(document.activeElement).toBe(popover);
    });

    it('restores focus to previously focused element on close', () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Trigger';
      document.body.appendChild(triggerButton);
      triggerButton.focus();
      expect(document.activeElement).toBe(triggerButton);

      const onClose = vi.fn();
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          onClose={onClose}
          renderInlineNode={defaultRenderInlineNode}
        />
      );

      act(() => {
        flushRAF();
      });

      // Close via close button (which calls handleClose that restores focus)
      fireEvent.click(screen.getByTestId('footnote-close'));
      expect(document.activeElement).toBe(triggerButton);

      document.body.removeChild(triggerButton);
    });
  });

  describe('max-height and overflow styles', () => {
    it('applies maxHeight of 50vh when anchorPosition is provided', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          anchorPosition={{ top: 100, left: 200 }}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const popover = screen.getByTestId('footnote-popover');
      expect(popover.style.maxHeight).toBe('50vh');
    });

    it('applies overflowY auto when anchorPosition is provided', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          anchorPosition={{ top: 100, left: 200 }}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const popover = screen.getByTestId('footnote-popover');
      expect(popover.style.overflowY).toBe('auto');
    });

    it('applies maxWidth of 340px when anchorPosition is provided', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          anchorPosition={{ top: 100, left: 200 }}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const popover = screen.getByTestId('footnote-popover');
      expect(popover.style.maxWidth).toBe('340px');
    });
  });

  describe('content rendering', () => {
    it('renders footnote content via renderInlineNode', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      expect(screen.getByTestId('footnote-content')).toHaveTextContent('This is a footnote.');
    });

    it('renders multiple content nodes', () => {
      render(
        <FootnotePopover
          footnote={multiContentFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const content = screen.getByTestId('footnote-content');
      expect(content).toHaveTextContent('First part.');
      expect(content).toHaveTextContent('bold');
    });
  });

  describe('positioning', () => {
    it('positions popover using anchorPosition', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          anchorPosition={{ top: 100, left: 200 }}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const popover = screen.getByTestId('footnote-popover');
      expect(popover.style.position).toBe('absolute');
      expect(popover.style.top).toBe('108px'); // top + 8
      expect(popover.style.left).toBe('200px');
    });

    it('uses relative positioning when anchorPosition is not provided', () => {
      render(
        <FootnotePopover
          footnote={sampleFootnote}
          renderInlineNode={defaultRenderInlineNode}
        />
      );
      const popover = screen.getByTestId('footnote-popover');
      expect(popover.style.position).toBe('relative');
    });
  });
});
