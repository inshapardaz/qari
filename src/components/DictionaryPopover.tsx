/**
 * DictionaryPopover Component — displays word lookup results in a centered popover.
 * Shows definitions, part of speech, examples, and handles "not found" and
 * "no dictionary for language" states with fallback offers.
 *
 * Always centers in the reader's own viewport (the reader root establishes
 * the containing block for `position: fixed` — see its own comment in
 * Reader.tsx) rather than anchoring to the selection point: a selection near
 * an edge could otherwise push the popover partly or fully off-screen.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Paper, ActionIcon, Button, Loader, Text, Group, Badge } from '@mantine/core';
import type { DictionaryLookupResult } from '../services/dictionary-service';
import { useTranslations, interpolate } from '../i18n';

const CENTERED_POPOVER_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 1000,
  maxHeight: '70vh',
  overflowY: 'auto',
  fontSize: '14px',
  lineHeight: '1.5',
};

export interface DictionaryPopoverProps {
  /** The lookup result to display */
  lookupResult: DictionaryLookupResult | null;
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
  /**
   * Called when the user clicks "Add to note", turning the looked-up
   * selection into a persistent note. Omit this prop (rather than passing a
   * no-op) to hide the button entirely — e.g. when notes are disabled, or
   * there's no selection left to attach a note to.
   */
  onAddToNote?: () => void;
}

export const DictionaryPopover: React.FC<DictionaryPopoverProps> = ({
  lookupResult,
  visible = true,
  loading = false,
  onFallbackLookup,
  onClose,
  onSuggestionSelect,
  onAddToNote,
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
    const style: React.CSSProperties = {
      ...CENTERED_POPOVER_STYLE,
      maxWidth: '320px',
      backgroundColor: 'var(--reader-bg, #fff)',
      color: 'var(--reader-fg, #1a1a1a)',
      borderColor: 'var(--reader-border, #e8e8e8)',
    };

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
        p="md"
        radius="lg"
      >
        <Group
          gap="xs"
          data-testid="dictionary-loading"
          role="status"
          aria-live="polite"
          style={{ color: 'var(--reader-secondary, #666)' }}
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

  const style: React.CSSProperties = {
    ...CENTERED_POPOVER_STYLE,
    maxWidth: '380px',
    minWidth: '240px',
    backgroundColor: 'var(--reader-bg, #fff)',
    color: 'var(--reader-fg, #1a1a1a)',
    borderColor: 'var(--reader-border, #e8e8e8)',
  };

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
      p="md"
      radius="lg"
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
      <Group gap="xs" align="flex-start" mb="sm" pb="sm" style={{ borderBottom: '1px solid var(--reader-border, #e8e8e8)' }}>
        <Group gap={6} align="baseline" style={{ flex: 1, minWidth: 0 }}>
          <Text
            className="dictionary-popover__word"
            data-testid="dictionary-word"
            fw={700}
            style={{ fontSize: '24px', lineHeight: 1.2, color: 'var(--reader-fg, #1a1a1a)', wordBreak: 'break-word' }}
          >
            {word}
          </Text>
          <Text
            className="dictionary-popover__language"
            data-testid="dictionary-language"
            size="xs"
            style={{ color: 'var(--reader-secondary, #888)' }}
          >
            ({language})
          </Text>
        </Group>
        {onClose && (
          <ActionIcon
            className="dictionary-popover__close"
            data-testid="dictionary-close"
            aria-label={t.dictionaryClose}
            onClick={handleClose}
            variant="subtle"
            color="gray"
            size="sm"
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
        <ul className="dictionary-popover__definitions" data-testid="dictionary-definitions" role="list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {definitions.map((def, index) => (
            <li
              key={index}
              className="dictionary-popover__definition"
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--reader-surface, #f5f5f7)',
              }}
            >
              {def.partOfSpeech && (
                <Badge
                  className="dictionary-popover__pos"
                  data-testid={`dictionary-pos-${index}`}
                  variant="light"
                  size="sm"
                  radius="sm"
                  mb={6}
                  style={{
                    textTransform: 'none',
                    // Override Mantine's own (Mantine-blue) badge color vars
                    // directly, rather than passing a `color` prop — Mantine
                    // computes "light"/"outline" tints via JS color math that
                    // can't parse a `var(--reader-*)` reference, but plain CSS
                    // custom properties compose fine (see MANTINE_PRIMARY_COLOR_STYLE
                    // in Reader.tsx for the same technique).
                    ['--badge-bg' as string]: 'color-mix(in srgb, var(--reader-accent, #0071e3) 15%, transparent)',
                    ['--badge-color' as string]: 'var(--reader-accent, #0071e3)',
                  }}
                >
                  {def.partOfSpeech}
                </Badge>
              )}
              <span
                className="dictionary-popover__meaning"
                data-testid={`dictionary-meaning-${index}`}
                style={{ display: 'block', fontSize: '15px', color: 'var(--reader-fg, #1a1a1a)' }}
              >
                {def.meaning}
              </span>
              {def.examples && def.examples.length > 0 && (
                <ul
                  className="dictionary-popover__examples"
                  data-testid={`dictionary-examples-${index}`}
                  role="list"
                  aria-label={t.dictionaryExamples}
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '6px 0 0 0',
                    borderLeft: '2px solid var(--reader-border, #ddd)',
                  }}
                >
                  {def.examples.map((example, exIdx) => (
                    <li
                      key={exIdx}
                      className="dictionary-popover__example"
                      style={{
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: 'var(--reader-secondary, #666)',
                        padding: '1px 0 1px 10px',
                      }}
                    >
                      &ldquo;{example}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
              {def.source && (
                <Badge
                  className="dictionary-popover__source"
                  data-testid={`dictionary-source-${index}`}
                  variant="outline"
                  size="xs"
                  radius="sm"
                  mt={8}
                  style={{
                    textTransform: 'none',
                    fontWeight: 500,
                    ['--badge-bg' as string]: 'transparent',
                    ['--badge-color' as string]: 'var(--reader-secondary, #666)',
                    ['--badge-bd' as string]: '1px solid var(--reader-border, #ccc)',
                  }}
                >
                  {def.source}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Turns the looked-up selection into a persistent note. Only
          rendered when the caller has a selection to attach one to — see
          `onAddToNote`'s own doc comment. */}
      {onAddToNote && !notFound && (
        <Button
          className="dictionary-popover__add-to-note"
          data-testid="dictionary-add-to-note"
          onClick={onAddToNote}
          variant="filled"
          size="compact-sm"
          fullWidth
          mt="sm"
          styles={{
            root: {
              backgroundColor: 'var(--reader-accent, #0071e3)',
              color: 'var(--reader-bg, #ffffff)',
            },
          }}
        >
          {t.dictionaryAddToNote}
        </Button>
      )}
    </Paper>
  );
};

export default DictionaryPopover;
