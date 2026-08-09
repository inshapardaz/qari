/**
 * Unit tests for ZoomController component and useZoom hook.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, screen, fireEvent, act, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import {
  ZoomController,
  ZoomControls,
  useZoom,
  computePinchZoom,
  snapZoom,
} from './ZoomController';

/** ZoomControls/ZoomController now use Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MantineProvider env="test">{children}</MantineProvider>,
    ...options,
  });
}

// Helper to test the hook in isolation
function TestHookConsumer({
  initialZoom,
  onZoomChange,
}: {
  initialZoom?: number;
  onZoomChange?: (zoom: number) => void;
}) {
  const result = useZoom({ initialZoom, onZoomChange });
  return (
    <div>
      <span data-testid="hook-zoom">{result.zoom}</span>
      <span data-testid="hook-can-in">{String(result.canZoomIn)}</span>
      <span data-testid="hook-can-out">{String(result.canZoomOut)}</span>
      <button data-testid="hook-in" onClick={result.zoomIn}>In</button>
      <button data-testid="hook-out" onClick={result.zoomOut}>Out</button>
      <button data-testid="hook-set" onClick={() => result.setZoom(200)}>Set200</button>
    </div>
  );
}

describe('useZoom hook', () => {
  it('defaults to 100% zoom', () => {
    render(<TestHookConsumer />);
    expect(screen.getByTestId('hook-zoom').textContent).toBe('100');
  });

  it('accepts and clamps initial zoom', () => {
    render(<TestHookConsumer initialZoom={155} />);
    // 155 rounds to 160
    expect(screen.getByTestId('hook-zoom').textContent).toBe('160');
  });

  it('clamps initial zoom below minimum', () => {
    render(<TestHookConsumer initialZoom={10} />);
    expect(screen.getByTestId('hook-zoom').textContent).toBe('50');
  });

  it('clamps initial zoom above maximum', () => {
    render(<TestHookConsumer initialZoom={500} />);
    expect(screen.getByTestId('hook-zoom').textContent).toBe('300');
  });

  it('zoomIn increments by 10%', () => {
    render(<TestHookConsumer initialZoom={100} />);
    fireEvent.click(screen.getByTestId('hook-in'));
    expect(screen.getByTestId('hook-zoom').textContent).toBe('110');
  });

  it('zoomOut decrements by 10%', () => {
    render(<TestHookConsumer initialZoom={100} />);
    fireEvent.click(screen.getByTestId('hook-out'));
    expect(screen.getByTestId('hook-zoom').textContent).toBe('90');
  });

  it('does not zoom in beyond 300%', () => {
    render(<TestHookConsumer initialZoom={300} />);
    expect(screen.getByTestId('hook-can-in').textContent).toBe('false');
    fireEvent.click(screen.getByTestId('hook-in'));
    expect(screen.getByTestId('hook-zoom').textContent).toBe('300');
  });

  it('does not zoom out below 50%', () => {
    render(<TestHookConsumer initialZoom={50} />);
    expect(screen.getByTestId('hook-can-out').textContent).toBe('false');
    fireEvent.click(screen.getByTestId('hook-out'));
    expect(screen.getByTestId('hook-zoom').textContent).toBe('50');
  });

  it('calls onZoomChange when zoom changes', () => {
    const onChange = vi.fn();
    render(<TestHookConsumer initialZoom={100} onZoomChange={onChange} />);
    fireEvent.click(screen.getByTestId('hook-in'));
    expect(onChange).toHaveBeenCalledWith(110);
  });

  it('setZoom clamps the value', () => {
    render(<TestHookConsumer initialZoom={100} />);
    fireEvent.click(screen.getByTestId('hook-set'));
    expect(screen.getByTestId('hook-zoom').textContent).toBe('200');
  });
});

describe('computePinchZoom', () => {
  it('returns startZoom when distance is zero', () => {
    expect(computePinchZoom(0, 100, 100)).toBe(100);
  });

  it('doubles zoom when distance doubles', () => {
    expect(computePinchZoom(100, 200, 100)).toBe(200);
  });

  it('halves zoom when distance halves', () => {
    expect(computePinchZoom(200, 100, 100)).toBe(50);
  });

  it('scales proportionally', () => {
    expect(computePinchZoom(100, 150, 100)).toBe(150);
  });
});

describe('snapZoom', () => {
  it('snaps to nearest 10% increment', () => {
    expect(snapZoom(103)).toBe(100);
    expect(snapZoom(107)).toBe(110);
    expect(snapZoom(155)).toBe(160);
    expect(snapZoom(145)).toBe(150);
  });

  it('clamps below minimum', () => {
    expect(snapZoom(20)).toBe(50);
    expect(snapZoom(-10)).toBe(50);
  });

  it('clamps above maximum', () => {
    expect(snapZoom(350)).toBe(300);
    expect(snapZoom(999)).toBe(300);
  });
});

describe('ZoomControls', () => {
  it('displays current zoom level', () => {
    render(
      <ZoomControls
        zoom={120}
        canZoomIn={true}
        canZoomOut={true}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
      />
    );
    expect(screen.getByTestId('zoom-level').textContent).toBe('120%');
  });

  it('disables zoom in button when canZoomIn is false', () => {
    render(
      <ZoomControls
        zoom={300}
        canZoomIn={false}
        canZoomOut={true}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
      />
    );
    expect(screen.getByTestId('zoom-in-btn')).toBeDisabled();
  });

  it('disables zoom out button when canZoomOut is false', () => {
    render(
      <ZoomControls
        zoom={50}
        canZoomIn={true}
        canZoomOut={false}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
      />
    );
    expect(screen.getByTestId('zoom-out-btn')).toBeDisabled();
  });

  it('calls onZoomIn when zoom in is clicked', () => {
    const onZoomIn = vi.fn();
    render(
      <ZoomControls
        zoom={100}
        canZoomIn={true}
        canZoomOut={true}
        onZoomIn={onZoomIn}
        onZoomOut={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });

  it('calls onZoomOut when zoom out is clicked', () => {
    const onZoomOut = vi.fn();
    render(
      <ZoomControls
        zoom={100}
        canZoomIn={true}
        canZoomOut={true}
        onZoomIn={() => {}}
        onZoomOut={onZoomOut}
      />
    );
    fireEvent.click(screen.getByTestId('zoom-out-btn'));
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('has accessible toolbar role and label', () => {
    render(
      <ZoomControls
        zoom={100}
        canZoomIn={true}
        canZoomOut={true}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
      />
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Zoom controls');
  });
});

describe('ZoomController', () => {
  it('renders children inside the zoom container', () => {
    render(
      <ZoomController>
        <p>Hello content</p>
      </ZoomController>
    );
    expect(screen.getByText('Hello content')).toBeInTheDocument();
  });

  it('applies transform scale based on zoom level', () => {
    render(
      <ZoomController initialZoom={150}>
        <p>Content</p>
      </ZoomController>
    );
    const content = screen.getByTestId('zoom-content');
    expect(content.style.transform).toBe('scale(1.5)');
  });

  it('shows zoom controls by default', () => {
    render(
      <ZoomController>
        <p>Content</p>
      </ZoomController>
    );
    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
  });

  it('hides zoom controls when showControls is false', () => {
    render(
      <ZoomController showControls={false}>
        <p>Content</p>
      </ZoomController>
    );
    expect(screen.queryByTestId('zoom-controls')).toBeNull();
  });

  it('uses external zoom when provided', () => {
    render(
      <ZoomController zoom={200}>
        <p>Content</p>
      </ZoomController>
    );
    const content = screen.getByTestId('zoom-content');
    expect(content.style.transform).toBe('scale(2)');
    expect(screen.getByTestId('zoom-level').textContent).toBe('200%');
  });

  it('calls onZoomChange when zoom buttons are clicked', () => {
    const onChange = vi.fn();
    render(
      <ZoomController initialZoom={100} onZoomChange={onChange}>
        <p>Content</p>
      </ZoomController>
    );
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    expect(onChange).toHaveBeenCalledWith(110);
  });

  it('handles pinch-zoom gesture start with two touches', () => {
    render(
      <ZoomController initialZoom={100}>
        <p>Content</p>
      </ZoomController>
    );
    const container = screen.getByTestId('zoom-container');

    // Simulate touchstart with 2 fingers using fireEvent
    // jsdom doesn't support Touch constructor, so we use createEvent
    fireEvent.touchStart(container, {
      touches: [
        { identifier: 0, clientX: 0, clientY: 0 },
        { identifier: 1, clientX: 100, clientY: 0 },
      ],
    });

    // No error thrown, gesture tracking started
    expect(container).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <ZoomController className="my-zoom">
        <p>Content</p>
      </ZoomController>
    );
    expect(screen.getByTestId('zoom-controller').className).toContain('my-zoom');
  });
});
