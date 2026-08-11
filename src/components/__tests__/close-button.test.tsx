/**
 * The reader's header can optionally show a close button (`showCloseButton`)
 * that invokes an `onClose` callback — for consumers presenting the reader
 * in a modal/overlay of their own and needing a way to dismiss it.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

describe('Close button', () => {
  it('is not rendered by default', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Close reader' })).toBeNull();
  });

  it('renders when showCloseButton is true and calls onClose when clicked', async () => {
    const onClose = vi.fn();
    render(<Reader source={createMarkdownSource()} showCloseButton onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    const closeButton = screen.getByRole('button', { name: 'Close reader' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not throw when clicked without an onClose callback', async () => {
    render(<Reader source={createMarkdownSource()} showCloseButton />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close reader' }));
    }).not.toThrow();
  });
});
