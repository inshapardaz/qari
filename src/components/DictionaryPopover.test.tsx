/**
 * Tests for DictionaryPopover component.
 */

import React from 'react';
import { render as rtlRender, screen, fireEvent, type RenderOptions } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { DictionaryPopover } from './DictionaryPopover';
import type { DictionaryLookupResult } from '../services/dictionary-service';

/** DictionaryPopover now uses Mantine components, which require a MantineProvider ancestor. */
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MantineProvider env="test">{children}</MantineProvider>,
    ...options,
  });
}

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
    render(<DictionaryPopover lookupResult={null} />);
    expect(screen.queryByTestId('dictionary-popover')).toBeNull();
  });

  it('renders nothing when visible is false', () => {
    render(<DictionaryPopover lookupResult={foundResult} visible={false} />);
    expect(screen.queryByTestId('dictionary-popover')).toBeNull();
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
    expect(popover.style.top).toBe('108px');
    expect(popover.style.left).toBe('200px');
    expect(popover.style.position).toBe('absolute');
  });

  it('has accessible dialog role and label', () => {
    render(<DictionaryPopover lookupResult={foundResult} />);
    expect(screen.getByRole('dialog', { name: /Dictionary lookup for: ephemeral/ })).toBeInTheDocument();
  });
});

describe('DictionaryPopover - Loading State', () => {
  it('renders loading indicator when loading is true and lookupResult is null', () => {
    render(<DictionaryPopover lookupResult={null} loading={true} />);
    expect(screen.getByTestId('dictionary-loading')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-loading')).toHaveTextContent('Loading...');
  });

  it('renders the popover container with dialog role while loading', () => {
    render(<DictionaryPopover lookupResult={null} loading={true} />);
    expect(screen.getByTestId('dictionary-popover')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders nothing when loading is false and lookupResult is null', () => {
    render(<DictionaryPopover lookupResult={null} loading={false} />);
    expect(screen.queryByTestId('dictionary-popover')).toBeNull();
  });
});

describe('DictionaryPopover - Escape Key Dismiss', () => {
  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<DictionaryPopover lookupResult={foundResult} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other key presses', () => {
    const onClose = vi.fn();
    render(<DictionaryPopover lookupResult={foundResult} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DictionaryPopover - Focus Trapping', () => {
  it('traps focus within popover on Tab - wraps from last to first element', () => {
    const onClose = vi.fn();
    const onSuggestionSelect = vi.fn();
    const resultWithSuggestions: DictionaryLookupResult = {
      word: 'tset',
      language: 'en',
      definitions: [{ meaning: 'test' }],
      notFound: false,
      spellCheck: { correct: false, suggestions: ['test', 'set'] },
    };
    render(
      <DictionaryPopover
        lookupResult={resultWithSuggestions}
        onClose={onClose}
        onSuggestionSelect={onSuggestionSelect}
      />
    );

    // Get focusable elements within popover
    const closeBtn = screen.getByTestId('dictionary-close');
    const suggestion0 = screen.getByTestId('suggestion-0');
    const suggestion1 = screen.getByTestId('suggestion-1');

    // Focus on the last suggestion button
    suggestion1.focus();
    expect(document.activeElement).toBe(suggestion1);

    // Tab should wrap to the first focusable element (close button)
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps focus within popover on Shift+Tab - wraps from first to last element', () => {
    const onClose = vi.fn();
    const onSuggestionSelect = vi.fn();
    const resultWithSuggestions: DictionaryLookupResult = {
      word: 'tset',
      language: 'en',
      definitions: [{ meaning: 'test' }],
      notFound: false,
      spellCheck: { correct: false, suggestions: ['test', 'set'] },
    };
    render(
      <DictionaryPopover
        lookupResult={resultWithSuggestions}
        onClose={onClose}
        onSuggestionSelect={onSuggestionSelect}
      />
    );

    const closeBtn = screen.getByTestId('dictionary-close');
    const suggestion1 = screen.getByTestId('suggestion-1');

    // Focus on the first focusable element (close button)
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab should wrap to the last element
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(suggestion1);
  });
});

describe('DictionaryPopover - Aria Label', () => {
  it('includes the word in the aria-label', () => {
    render(<DictionaryPopover lookupResult={foundResult} />);
    const popover = screen.getByTestId('dictionary-popover');
    expect(popover).toHaveAttribute('aria-label', 'Dictionary lookup for: ephemeral');
  });

  it('includes different words in the aria-label', () => {
    const result: DictionaryLookupResult = {
      word: 'serendipity',
      language: 'en',
      definitions: [{ meaning: 'finding something good by chance' }],
    };
    render(<DictionaryPopover lookupResult={result} />);
    const popover = screen.getByTestId('dictionary-popover');
    expect(popover).toHaveAttribute('aria-label', 'Dictionary lookup for: serendipity');
  });
});

describe('DictionaryPopover - Spell-check Correct', () => {
  it('shows checkmark when spellCheck.correct is true', () => {
    const result: DictionaryLookupResult = {
      word: 'hello',
      language: 'en',
      definitions: [{ meaning: 'a greeting' }],
      spellCheck: { correct: true, suggestions: [] },
    };
    render(<DictionaryPopover lookupResult={result} />);
    expect(screen.getByTestId('spellcheck-correct')).toBeInTheDocument();
    expect(screen.getByTestId('spellcheck-correct')).toHaveTextContent('✓');
  });

  it('does not show incorrect indicator when spelling is correct', () => {
    const result: DictionaryLookupResult = {
      word: 'hello',
      language: 'en',
      definitions: [{ meaning: 'a greeting' }],
      spellCheck: { correct: true, suggestions: [] },
    };
    render(<DictionaryPopover lookupResult={result} />);
    expect(screen.queryByTestId('spellcheck-incorrect')).not.toBeInTheDocument();
  });
});

describe('DictionaryPopover - Spell-check Incorrect', () => {
  it('shows warning when spellCheck.correct is false', () => {
    const result: DictionaryLookupResult = {
      word: 'helo',
      language: 'en',
      definitions: [{ meaning: 'no definition' }],
      notFound: false,
      spellCheck: { correct: false, suggestions: ['hello', 'help'] },
    };
    render(<DictionaryPopover lookupResult={result} />);
    expect(screen.getByTestId('spellcheck-incorrect')).toBeInTheDocument();
    expect(screen.getByTestId('spellcheck-incorrect')).toHaveTextContent('⚠');
  });

  it('shows suggestions list when spellCheck has suggestions', () => {
    const result: DictionaryLookupResult = {
      word: 'helo',
      language: 'en',
      definitions: [{ meaning: 'no definition' }],
      notFound: false,
      spellCheck: { correct: false, suggestions: ['hello', 'help', 'halo'] },
    };
    render(<DictionaryPopover lookupResult={result} />);
    const suggestionsList = screen.getByTestId('spelling-suggestions');
    expect(suggestionsList).toBeInTheDocument();
    expect(suggestionsList).toHaveAttribute('aria-label', 'Spelling suggestions');
    expect(screen.getByTestId('suggestion-0')).toHaveTextContent('hello');
    expect(screen.getByTestId('suggestion-1')).toHaveTextContent('help');
    expect(screen.getByTestId('suggestion-2')).toHaveTextContent('halo');
  });
});

describe('DictionaryPopover - Suggestion Click', () => {
  it('triggers onSuggestionSelect callback when a suggestion is clicked', () => {
    const onSuggestionSelect = vi.fn();
    const result: DictionaryLookupResult = {
      word: 'helo',
      language: 'en',
      definitions: [{ meaning: 'no definition' }],
      notFound: false,
      spellCheck: { correct: false, suggestions: ['hello', 'help'] },
    };
    render(
      <DictionaryPopover lookupResult={result} onSuggestionSelect={onSuggestionSelect} />
    );
    fireEvent.click(screen.getByTestId('suggestion-0'));
    expect(onSuggestionSelect).toHaveBeenCalledWith('hello');
  });

  it('triggers onSuggestionSelect with the correct suggestion word', () => {
    const onSuggestionSelect = vi.fn();
    const result: DictionaryLookupResult = {
      word: 'wrld',
      language: 'en',
      definitions: [{ meaning: 'unknown' }],
      notFound: false,
      spellCheck: { correct: false, suggestions: ['world', 'wild', 'ward'] },
    };
    render(
      <DictionaryPopover lookupResult={result} onSuggestionSelect={onSuggestionSelect} />
    );
    fireEvent.click(screen.getByTestId('suggestion-1'));
    expect(onSuggestionSelect).toHaveBeenCalledWith('wild');
  });
});
