import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { extractFirstWord, useSelectionHandler } from './useSelectionHandler';
import type { UseSelectionHandlerOptions } from './useSelectionHandler';

describe('extractFirstWord', () => {
  it('returns null for empty string', () => {
    expect(extractFirstWord('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(extractFirstWord('   ')).toBeNull();
    expect(extractFirstWord('\t\n  ')).toBeNull();
  });

  it('extracts the first word from a single-word string', () => {
    expect(extractFirstWord('hello')).toBe('hello');
  });

  it('extracts the first word from a multi-word string', () => {
    expect(extractFirstWord('hello world')).toBe('hello');
  });

  it('trims leading whitespace before extracting', () => {
    expect(extractFirstWord('  hello world')).toBe('hello');
  });

  it('handles various whitespace delimiters', () => {
    expect(extractFirstWord('hello\tworld')).toBe('hello');
    expect(extractFirstWord('hello\nworld')).toBe('hello');
  });

  it('returns the first token from multi-word selections', () => {
    expect(extractFirstWord('the quick brown fox')).toBe('the');
  });
});

describe('useSelectionHandler', () => {
  let contentElement: HTMLDivElement;
  let contentRef: { current: HTMLDivElement };

  beforeEach(() => {
    vi.useFakeTimers();
    contentElement = document.createElement('div');
    contentElement.setAttribute('data-chapter-content', '');
    contentElement.textContent = 'Hello world this is a test';
    document.body.appendChild(contentElement);
    contentRef = { current: contentElement };
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.removeChild(contentElement);
    vi.restoreAllMocks();
  });

  function mockSelection(text: string, element: Node) {
    const textNode = element.firstChild || element;

    // Create a mock range with getBoundingClientRect
    const mockRange = {
      getBoundingClientRect: () => ({
        top: 100,
        left: 50,
        bottom: 120,
        right: 100,
        width: 50,
        height: 20,
        x: 50,
        y: 100,
        toJSON: () => ({}),
      }),
      startContainer: textNode,
      startOffset: 0,
      endContainer: textNode,
      endOffset: text.length,
    };

    const mockSel: Partial<Selection> = {
      toString: () => text,
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange as unknown as Range,
      anchorNode: textNode,
      anchorOffset: 0,
    };

    vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as Selection);
  }

  function mockEmptySelection() {
    const mockSelection: Partial<Selection> = {
      toString: () => '',
      isCollapsed: true,
      rangeCount: 0,
      getRangeAt: () => { throw new Error('No ranges'); },
      anchorNode: null,
      anchorOffset: 0,
    };
    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as Selection);
  }

  describe('right-click on selected text triggers lookup (Requirement 11.1)', () => {
    it('prevents default and triggers lookup when text is selected and providers exist', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true })
      );

      // Verify initial state is idle
      expect(result.current.lookupState.status).toBe('idle');
      expect(result.current.anchorPosition).toBeNull();

      // Mock a text selection
      mockSelection('hello', contentElement);

      // Dispatch contextmenu event
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        contentElement.dispatchEvent(event);
      });

      // Should prevent default (requirement 11.1)
      expect(preventDefaultSpy).toHaveBeenCalled();

      // Should trigger lookup — state changes to loading
      expect(result.current.lookupState.status).toBe('loading');
      expect(result.current.anchorPosition).not.toBeNull();
      expect(result.current.anchorPosition!.top).toBeGreaterThan(0);
      expect(result.current.anchorPosition!.left).toBeGreaterThan(0);
    });
  });

  describe('right-click without selection allows default behavior (Requirement 11.4)', () => {
    it('does not prevent default when no text is selected', () => {
      renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true })
      );

      // Mock empty selection
      mockEmptySelection();

      // Dispatch contextmenu event
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        contentElement.dispatchEvent(event);
      });

      // Should NOT prevent default (requirement 11.4)
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('does not prevent default when selection is whitespace-only', () => {
      renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true })
      );

      // Mock whitespace selection
      const range = document.createRange();
      const textNode = contentElement.firstChild!;
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1);

      const mockSel: Partial<Selection> = {
        toString: () => '   ',
        isCollapsed: false,
        rangeCount: 1,
        getRangeAt: () => range,
        anchorNode: textNode,
        anchorOffset: 0,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSel as Selection);

      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        contentElement.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('no providers registered — allows default behavior (Requirement 11.3)', () => {
    it('does not intercept contextmenu when hasProviders is false', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: false })
      );

      mockSelection('hello', contentElement);

      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      act(() => {
        contentElement.dispatchEvent(event);
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(result.current.lookupState.status).toBe('idle');
      expect(result.current.anchorPosition).toBeNull();
    });
  });

  describe('long-press triggers lookup on touch (Requirement 11.2)', () => {
    it('triggers lookup after holding for longPressThreshold', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true, longPressThreshold: 500 })
      );

      // Mock a selection that would appear after long-press
      mockSelection('world', contentElement);

      // Simulate touchstart
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 50, clientY: 100, identifier: 0 } as Touch],
      });

      act(() => {
        contentElement.dispatchEvent(touchStartEvent);
      });

      // Before threshold elapses, state should still be idle
      expect(result.current.lookupState.status).toBe('idle');

      // Advance time past the threshold
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // After the long-press threshold, lookup should be triggered
      expect(result.current.lookupState.status).toBe('loading');
      expect(result.current.anchorPosition).not.toBeNull();
    });

    it('does not trigger lookup if touch ends before threshold', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true, longPressThreshold: 500 })
      );

      mockSelection('world', contentElement);

      // Simulate touchstart
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 50, clientY: 100, identifier: 0 } as Touch],
      });

      act(() => {
        contentElement.dispatchEvent(touchStartEvent);
      });

      // End touch before threshold
      act(() => {
        vi.advanceTimersByTime(200);
      });

      const touchEndEvent = new TouchEvent('touchend', {
        bubbles: true,
      });

      act(() => {
        contentElement.dispatchEvent(touchEndEvent);
      });

      // Advance past threshold to confirm timer was cancelled
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // State should remain idle
      expect(result.current.lookupState.status).toBe('idle');
    });

    it('cancels long-press if finger moves significantly', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true, longPressThreshold: 500 })
      );

      mockSelection('world', contentElement);

      // Simulate touchstart
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        touches: [{ clientX: 50, clientY: 100, identifier: 0 } as Touch],
      });

      act(() => {
        contentElement.dispatchEvent(touchStartEvent);
      });

      // Move finger more than 10px
      const touchMoveEvent = new TouchEvent('touchmove', {
        bubbles: true,
        touches: [{ clientX: 80, clientY: 100, identifier: 0 } as Touch],
      });

      act(() => {
        contentElement.dispatchEvent(touchMoveEvent);
      });

      // Advance past threshold
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Should still be idle because the touch moved
      expect(result.current.lookupState.status).toBe('idle');
    });
  });

  describe('dismiss clears state (Requirement 11.1)', () => {
    it('resets anchorPosition and lookupState to idle', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true })
      );

      // Trigger a lookup first
      mockSelection('hello', contentElement);

      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });

      act(() => {
        contentElement.dispatchEvent(event);
      });

      // Confirm lookup is active
      expect(result.current.lookupState.status).toBe('loading');
      expect(result.current.anchorPosition).not.toBeNull();

      // Call dismiss
      act(() => {
        result.current.dismiss();
      });

      // State should be reset
      expect(result.current.lookupState.status).toBe('idle');
      expect(result.current.lookupState.result).toBeNull();
      expect(result.current.anchorPosition).toBeNull();
    });

    it('can be called when already idle without side effects', () => {
      const { result } = renderHook(() =>
        useSelectionHandler({ contentRef, hasProviders: true })
      );

      // State is already idle
      expect(result.current.lookupState.status).toBe('idle');

      // Should not throw
      act(() => {
        result.current.dismiss();
      });

      expect(result.current.lookupState.status).toBe('idle');
      expect(result.current.anchorPosition).toBeNull();
    });
  });
});
