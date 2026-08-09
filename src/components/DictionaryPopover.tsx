/**
 * DictionaryPopover Component — displays word lookup results in a positioned popover.
 * Shows definitions, part of speech, examples, and handles "not found" and
 * "no dictionary for language" states with fallback offers.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Paper, ActionIcon, Button, Loader, Text, Group } from '@mantine/core';
import type { DictionaryLookupResult } from '../services/dictionary-service';
import { useTranslations, interpolate } from '../i18n';

export interface DictionaryPopoverProps {
  /** The lookup result to display */
  lookupResult: DictionaryLookupResult | null;
  /** Anchor position for the popover (relative to reader viewport) */
  anchorPosition?: { top: number; left: number };
  /** Whether the popover is visible */
  visible?: boolean;
  /** Whether a lookup is currently in progress */
  loading?: boolean;
  /** Called when the user requests a fallback language lookup */
  onFallbackLookup?: (language: string) => void;
  /** Called when the user dismisses the popover */
  onClose?: () => void;
  /** Called when the user selects a spelling suggestion */
  onSuggestionSelect?: (word: string) => void;
}

export const DictionaryPopover: React.FC<DictionaryPopoverProps> = ({
  lookupResult,
  anchorPosition,
  visible = true,
  loading = false,
  onFallbackLookup,
  onClose,
  onSuggestionSelect,
}) => {
  const t = useTranslations();
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element when the popover becomes visible
  useEffect(() => {
    if (visible && (lookupResult || loading)) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus the popover after render
      requestAnimationFrame(() => {
        popoverRef.current?.focus();
      });
    }
  }, [visible, lookupResult, loading]);

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
    if (!visible || (!lookupResult && !loading)) {
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
  }, [visible, lookupResult, loading, handleClose]);

  // Close on click outside the popover
  useEffect(() => {
    if (!visible || (!lookupResult && !loading)) {
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
  }, [visible, lookupResult, loading, handleClose]);

  // Focus trapping: Tab cycles within popover interactive elements
  useEffect(() => {
    if (!visible || (!lookupResult && !loading)) {
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
  }, [visible, lookupResult, loading]);

  if (!visible || (!lookupResult && !loading)) {
    return null;
  }

  // When loading and no result yet, show loading state
  if (loading && !lookupResult) {
    const style: React.CSSProperties = anchorPosition
      ? {
          position: 'absolute',
          top: `${anchorPosition.top + 8}px`,
          left: `${anchorPosition.left}px`,
          transform: 'translateX(-50%)',
          zIndex: 1000,
          maxWidth: '320px',
          maxHeight: '50vh',
          overflowY: 'auto',
          fontSize: '14px',
          lineHeight: '1.5',
        }
      : { position: 'relative' as const };

    return (
      <Paper
        className="dictionary-popover"
        data-testid="dictionary-popover"
        role="dialog"
        aria-label={t.dictionaryLoadingAriaLabel}
        style={style}
        ref={popoverRef}
        tabIndex={-1}
        shadow="md"
        withBorder
        p="sm"
      >
        <Group
          gap="xs"
          data-testid="dictionary-loading"
          role="status"
          aria-live="polite"
          style={{ color: 'var(--reader-fg, #666)' }}
        >
          <Loader size={14} />
          {t.dictionaryLoading}
        </Group>
      </Paper>
    );
  }

  if (!lookupResult) {
    return null;
  }

  const { word, language, definitions, notFound, fallbackLanguage } = lookupResult;

  const hasNoDictionary =
    notFound &&
    definitions.length > 0 &&
    definitions[0].meaning.startsWith('No dictionary available');

  const isNotFound = notFound && !hasNoDictionary;

  const style: React.CSSProperties = anchorPosition
    ? {
        position: 'absolute',
        top: `${anchorPosition.top + 8}px`,
        left: `${anchorPosition.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: '340px',
        minWidth: '220px',
        maxHeight: '50vh',
        overflowY: 'auto',
        fontSize: '14px',
        lineHeight: '1.5',
      }
    : { position: 'relative' as const };

  return (
    <Paper
      className="dictionary-popover"
      data-testid="dictionary-popover"
      role="dialog"
      aria-label={`Dictionary lookup for: ${word}`}
      style={style}
      ref={popoverRef}
      tabIndex={-1}
      shadow="md"
      withBorder
      p="sm"
    >
      {/* Loading indicator when loading with existing result */}
      {loading && (
        <Group
          gap="xs"
          data-testid="dictionary-loading"
          role="status"
          aria-live="polite"
          mb="xs"
          style={{ color: 'var(--reader-fg, #666)', opacity: 0.7, fontSize: '13px' }}
        >
          <Loader size={12} />
          {t.dictionaryLoading}
        </Group>
      )}

      {/* Header */}
      <Group gap="xs" align="baseline" mb="xs" pb="xs" style={{ borderBottom: '1px solid var(--reader-border, #e8e8e8)' }}>
        <Text className="dictionary-popover__word" data-testid="dictionary-word" fw={700} size="md">
          {word}
        </Text>
        <Text className="dictionary-popover__language" data-testid="dictionary-language" size="xs" c="dimmed">
          ({language})
        </Text>
        {onClose && (
          <ActionIcon
            className="dictionary-popover__close"
            data-testid="dictionary-close"
            aria-label={t.dictionaryClose}
            onClick={handleClose}
            variant="subtle"
            color="gray"
            size="sm"
            ml="auto"
          >
            ×
          </ActionIcon>
        )}
      </Group>

      {/* Spell-check status */}
      {lookupResult.spellCheck && (
        <div className="dictionary-popover__spellcheck" style={{ marginBottom: '8px', fontSize: '13px' }}>
          {lookupResult.spellCheck.correct ? (
            <span
              className="dictionary-popover__spellcheck-correct"
              data-testid="spellcheck-correct"
              aria-label="Word is correctly spelled"
              style={{ color: '#16a34a', fontWeight: 500 }}
            >
              ✓ {t.spellcheckCorrect}
            </span>
          ) : (
            <>
              <span
                className="dictionary-popover__spellcheck-incorrect"
                data-testid="spellcheck-incorrect"
                aria-label="Word is misspelled"
                style={{ color: '#dc2626', fontWeight: 500 }}
              >
                ⚠ {t.spellcheckMisspelled}
              </span>
              {lookupResult.spellCheck.suggestions.length > 0 && (
                <ul
                  className="dictionary-popover__suggestions"
                  data-testid="spelling-suggestions"
                  aria-label={t.spellingSuggestions}
                  role="list"
                  style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0', display: 'flex', flexWrap: 'wrap', gap: '4px' }}
                >
                  {lookupResult.spellCheck.suggestions.map((suggestion, index) => (
                    <li key={index} className="dictionary-popover__suggestion-item">
                      <Button
                        className="dictionary-popover__suggestion-btn"
                        data-testid={`suggestion-${index}`}
                        onClick={() => onSuggestionSelect?.(suggestion)}
                        aria-label={`Use suggestion: ${suggestion}`}
                        variant="default"
                        size="compact-xs"
                      >
                        {suggestion}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* No dictionary for this language */}
      {hasNoDictionary && (
        <div className="dictionary-popover__no-dict" data-testid="dictionary-no-dict" style={{ padding: '4px 0' }}>
          <p className="dictionary-popover__message" style={{ margin: 0, opacity: 0.7 }}>
            {t.dictionaryNoDictionary}
          </p>
          {fallbackLanguage && (
            <Button
              className="dictionary-popover__fallback-btn"
              data-testid="dictionary-fallback-btn"
              aria-label={`Look up in ${fallbackLanguage} instead`}
              onClick={() => onFallbackLookup?.(fallbackLanguage)}
              variant="default"
              size="compact-sm"
              mt="xs"
            >
              {interpolate(t.dictionaryTryIn, { language: fallbackLanguage })}
            </Button>
          )}
        </div>
      )}

      {/* Word not found */}
      {isNotFound && (
        <div className="dictionary-popover__not-found" data-testid="dictionary-not-found" style={{ padding: '4px 0', opacity: 0.7 }}>
          <p className="dictionary-popover__message" style={{ margin: 0 }}>
            {interpolate(t.dictionaryNotFound, { word })}
          </p>
        </div>
      )}

      {/* Definitions */}
      {!notFound && definitions.length > 0 && (
        <ul className="dictionary-popover__definitions" data-testid="dictionary-definitions" role="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {definitions.map((def, index) => (
            <li key={index} className="dictionary-popover__definition" style={{ marginBottom: '10px', paddingBottom: index < definitions.length - 1 ? '10px' : 0, borderBottom: index < definitions.length - 1 ? '1px solid var(--reader-border, #f0f0f0)' : 'none' }}>
              {def.partOfSpeech && (
                <span
                  className="dictionary-popover__pos"
                  data-testid={`dictionary-pos-${index}`}
                  style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--reader-accent, #6366f1)', marginBottom: '2px' }}
                >
                  {def.partOfSpeech}
                </span>
              )}
              <span
                className="dictionary-popover__meaning"
                data-testid={`dictionary-meaning-${index}`}
                style={{ display: 'block', fontSize: '14px' }}
              >
                {def.meaning}
              </span>
              {def.examples && def.examples.length > 0 && (
                <ul
                  className="dictionary-popover__examples"
                  data-testid={`dictionary-examples-${index}`}
                  role="list"
                  aria-label={t.dictionaryExamples}
                  style={{ listStyle: 'none', padding: '4px 0 0 0', margin: 0 }}
                >
                  {def.examples.map((example, exIdx) => (
                    <li key={exIdx} className="dictionary-popover__example" style={{ fontSize: '13px', fontStyle: 'italic', opacity: 0.75, marginTop: '2px' }}>
                      &ldquo;{example}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Paper>
  );
};

export default DictionaryPopover;
