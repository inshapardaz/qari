/**
 * Tests for DictionaryPopover component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DictionaryPopover } from './DictionaryPopover';
import type { DictionaryLookupResult } from '../services/dictionary-service';

const foundResult: DictionaryLookupResult = {
  word: 'ephemeral',
  language: 'en',
  definitions: [
    {
      meaning: 'lasting for a very short time',
      partOfSpeech: 'adjective',
      examples: ['The ephemeral nature of fashion trends.'],
    },
    {
      meaning: 'an ephemeral plant',
      partOfSpeech: 'noun',
    },
  ],
};

const notFoundResult: DictionaryLookupResult = {
  word: 'xyzzy',
  language: 'en',
  definitions: [{ meaning: 'Dictionary lookup failed. Please try again.' }],
  notFound: true,
};

const noDictResult: DictionaryLookupResult = {
  word: 'كتاب',
  language: 'ar',
  definitions: [{ meaning: 'No dictionary available for ar' }],
  notFound: true,
  fallbackLanguage: 'en',
};

const noDictNoFallbackResult: DictionaryLookupResult = {
  word: 'mot',
  language: 'fr',
  definitions: [{ meaning: 'No dictionary available for fr' }],
  notFound: true,
};

describe('DictionaryPopover', () => {
  it('renders nothing when lookupResult is null', () => {
    const { container } = render(<DictionaryPopover lookupResult={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when visible is false', () => {
    const { container } = render(<DictionaryPopover lookupResult={foundResult} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays the word and language', () => {
    render(<DictionaryPopover lookupResult={foundResult} />);
    expect(screen.getByTestId('dictionary-word')).toHaveTextContent('ephemeral');
    expect(screen.getByTestId('dictionary-language')).toHaveTextContent('(en)');
  });

  it('displays definitions with part of speech', () => {
    render(<DictionaryPopover lookupResult={foundResult} />);
    expect(screen.getByTestId('dictionary-pos-0')).toHaveTextContent('adjective');
    expect(screen.getByTestId('dictionary-meaning-0')).toHaveTextContent('lasting for a very short time');
    expect(screen.getByTestId('dictionary-pos-1')).toHaveTextContent('noun');
    expect(screen.getByTestId('dictionary-meaning-1')).toHaveTextContent('an ephemeral plant');
  });

  it('displays examples when available', () => {
    render(<DictionaryPopover lookupResult={foundResult} />);
    expect(screen.getByTestId('dictionary-examples-0')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-examples-0')).toHaveTextContent('The ephemeral nature of fashion trends.');
  });

  it('shows "not found" message when notFound is true', () => {
    render(<DictionaryPopover lookupResult={notFoundResult} />);
    expect(screen.getByTestId('dictionary-not-found')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-not-found')).toHaveTextContent('No definition found');
  });

  it('shows "no dictionary for this language" message', () => {
    render(<DictionaryPopover lookupResult={noDictResult} />);
    expect(screen.getByTestId('dictionary-no-dict')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-no-dict')).toHaveTextContent('No dictionary available for this language');
  });

  it('shows fallback button when fallbackLanguage is available', () => {
    render(<DictionaryPopover lookupResult={noDictResult} />);
    expect(screen.getByTestId('dictionary-fallback-btn')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-fallback-btn')).toHaveTextContent('Try in en');
  });

  it('does not show fallback button when no fallbackLanguage', () => {
    render(<DictionaryPopover lookupResult={noDictNoFallbackResult} />);
    expect(screen.queryByTestId('dictionary-fallback-btn')).not.toBeInTheDocument();
  });

  it('calls onFallbackLookup when fallback button is clicked', () => {
    const onFallbackLookup = vi.fn();
    render(<DictionaryPopover lookupResult={noDictResult} onFallbackLookup={onFallbackLookup} />);
    fireEvent.click(screen.getByTestId('dictionary-fallback-btn'));
    expect(onFallbackLookup).toHaveBeenCalledWith('en');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DictionaryPopover lookupResult={foundResult} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('dictionary-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('positions the popover using anchorPosition', () => {
    render(
      <DictionaryPopover
        lookupResult={foundResult}
        anchorPosition={{ top: 100, left: 200 }}
      />
    );
    const popover = screen.getByTestId('dictionary-popover');
    expect(popover.style.top).toBe('100px');
    expect(popover.style.left).toBe('200px');
    expect(popover.style.position).toBe('absolute');
  });

  it('has accessible dialog role and label', () => {
    render(<DictionaryPopover lookupResult={foundResult} />);
    expect(screen.getByRole('dialog', { name: /Dictionary lookup for: ephemeral/ })).toBeInTheDocument();
  });
});
