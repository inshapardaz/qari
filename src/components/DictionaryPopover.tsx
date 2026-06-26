/**
 * DictionaryPopover Component — displays word lookup results in a positioned popover.
 * Shows definitions, part of speech, examples, and handles "not found" and
 * "no dictionary for language" states with fallback offers.
 */

import React from 'react';
import type { DictionaryLookupResult } from '../services/dictionary-service';

export interface DictionaryPopoverProps {
  /** The lookup result to display */
  lookupResult: DictionaryLookupResult | null;
  /** Anchor position for the popover (relative to reader viewport) */
  anchorPosition?: { top: number; left: number };
  /** Whether the popover is visible */
  visible?: boolean;
  /** Called when the user requests a fallback language lookup */
  onFallbackLookup?: (language: string) => void;
  /** Called when the user dismisses the popover */
  onClose?: () => void;
}

export const DictionaryPopover: React.FC<DictionaryPopoverProps> = ({
  lookupResult,
  anchorPosition,
  visible = true,
  onFallbackLookup,
  onClose,
}) => {
  if (!visible || !lookupResult) {
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
        top: `${anchorPosition.top}px`,
        left: `${anchorPosition.left}px`,
        zIndex: 1000,
      }
    : { position: 'relative' };

  return (
    <div
      className="dictionary-popover"
      data-testid="dictionary-popover"
      role="dialog"
      aria-label={`Dictionary lookup for: ${word}`}
      style={style}
    >
      {/* Header */}
      <div className="dictionary-popover__header">
        <span className="dictionary-popover__word" data-testid="dictionary-word">
          {word}
        </span>
        <span className="dictionary-popover__language" data-testid="dictionary-language">
          ({language})
        </span>
        {onClose && (
          <button
            type="button"
            className="dictionary-popover__close"
            data-testid="dictionary-close"
            aria-label="Close dictionary"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      {/* No dictionary for this language */}
      {hasNoDictionary && (
        <div className="dictionary-popover__no-dict" data-testid="dictionary-no-dict">
          <p className="dictionary-popover__message">
            No dictionary available for this language.
          </p>
          {fallbackLanguage && (
            <button
              type="button"
              className="dictionary-popover__fallback-btn"
              data-testid="dictionary-fallback-btn"
              aria-label={`Look up in ${fallbackLanguage} instead`}
              onClick={() => onFallbackLookup?.(fallbackLanguage)}
            >
              Try in {fallbackLanguage}
            </button>
          )}
        </div>
      )}

      {/* Word not found */}
      {isNotFound && (
        <div className="dictionary-popover__not-found" data-testid="dictionary-not-found">
          <p className="dictionary-popover__message">
            No definition found for &ldquo;{word}&rdquo;.
          </p>
        </div>
      )}

      {/* Definitions */}
      {!notFound && definitions.length > 0 && (
        <ul className="dictionary-popover__definitions" data-testid="dictionary-definitions" role="list">
          {definitions.map((def, index) => (
            <li key={index} className="dictionary-popover__definition">
              {def.partOfSpeech && (
                <span
                  className="dictionary-popover__pos"
                  data-testid={`dictionary-pos-${index}`}
                >
                  {def.partOfSpeech}
                </span>
              )}
              <span
                className="dictionary-popover__meaning"
                data-testid={`dictionary-meaning-${index}`}
              >
                {def.meaning}
              </span>
              {def.examples && def.examples.length > 0 && (
                <ul
                  className="dictionary-popover__examples"
                  data-testid={`dictionary-examples-${index}`}
                  role="list"
                  aria-label="Examples"
                >
                  {def.examples.map((example, exIdx) => (
                    <li key={exIdx} className="dictionary-popover__example">
                      &ldquo;{example}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DictionaryPopover;
