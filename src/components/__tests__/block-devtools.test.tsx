/**
 * `blockDevTools` swaps the book content for a placeholder while the
 * browser's devtools appear to be open (heuristic: a large gap between
 * `window.outerWidth/outerHeight` and `innerWidth/innerHeight`, meaning a
 * docked devtools panel is eating into the viewport) — but only in
 * production builds (`process.env.NODE_ENV === 'production'`), so it never
 * interferes with developing/debugging against the reader itself.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(): ReaderSource {
  return {
    type: 'markdown',
    content: '# Test Book\n\n## Chapter 1\n\nHello wonderful world of reading',
  };
}

const originalNodeEnv = process.env.NODE_ENV;
const originalOuterWidth = window.outerWidth;
const originalOuterHeight = window.outerHeight;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

function setWindowSize(outerWidth: number, innerWidth: number, outerHeight = 800, innerHeight = 800) {
  Object.defineProperty(window, 'outerWidth', { value: outerWidth, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: innerWidth, configurable: true });
  Object.defineProperty(window, 'outerHeight', { value: outerHeight, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true });
}

describe('blockDevTools', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    Object.defineProperty(window, 'outerWidth', { value: originalOuterWidth, configurable: true });
    Object.defineProperty(window, 'outerHeight', { value: originalOuterHeight, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
  });

  it('does not hide content outside production, even with a devtools-sized viewport gap', async () => {
    process.env.NODE_ENV = 'test';
    setWindowSize(1200, 800); // 400px gap — well past the threshold

    render(<Reader source={createMarkdownSource()} blockDevTools />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.getByText('Hello wonderful world of reading')).toBeInTheDocument();
    expect(screen.queryByText('Content hidden while developer tools are open.')).toBeNull();
  });

  it('hides content in production once a devtools-sized viewport gap is detected', async () => {
    process.env.NODE_ENV = 'production';
    setWindowSize(1200, 800);

    render(<Reader source={createMarkdownSource()} blockDevTools />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getByText('Content hidden while developer tools are open.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Hello wonderful world of reading')).toBeNull();
  });

  it('does not hide content in production when the viewport has no such gap (contrast check)', async () => {
    process.env.NODE_ENV = 'production';
    setWindowSize(1200, 1200);

    render(<Reader source={createMarkdownSource()} blockDevTools />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.getByText('Hello wonderful world of reading')).toBeInTheDocument();
    expect(screen.queryByText('Content hidden while developer tools are open.')).toBeNull();
  });

  it('does not hide content in production when blockDevTools is off (contrast check)', async () => {
    process.env.NODE_ENV = 'production';
    setWindowSize(1200, 800);

    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    expect(screen.getByText('Hello wonderful world of reading')).toBeInTheDocument();
    expect(screen.queryByText('Content hidden while developer tools are open.')).toBeNull();
  });
});
