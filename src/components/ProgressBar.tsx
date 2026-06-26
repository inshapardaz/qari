/**
 * ProgressBar Component — reading progress display for the Universal Ebook Reader.
 *
 * Displays:
 * - Current chapter title
 * - Reading progress as a percentage (0-100)
 * - A visual progress bar
 *
 * Also includes:
 * - RTL direction support (bar fills from right)
 * - Direction override toggle (when directionConfidence is 'low', prompts user)
 */

import React, { useState } from 'react';
import { useReaderContext } from './Reader';

export interface ProgressBarProps {
  /** Callback when user overrides text direction */
  onDirectionChange?: (direction: 'ltr' | 'rtl') => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ onDirectionChange }) => {
  const { state } = useReaderContext();
  const [showDirectionPrompt, setShowDirectionPrompt] = useState(
    state.directionConfidence === 'low'
  );

  const book = state.book;
  const currentChapterTitle = book?.chapters?.[state.currentChapter]?.title ?? '';
  const progress = state.readingProgress;
  const isRTL = state.direction === 'rtl';

  const handleDirectionToggle = () => {
    const newDirection = state.direction === 'rtl' ? 'ltr' : 'rtl';
    if (onDirectionChange) {
      onDirectionChange(newDirection);
    }
    setShowDirectionPrompt(false);
  };

  const handleDirectionConfirm = (direction: 'ltr' | 'rtl') => {
    if (onDirectionChange) {
      onDirectionChange(direction);
    }
    setShowDirectionPrompt(false);
  };

  return (
    <div
      className="ebook-reader__progress-bar-container"
      dir={state.direction}
      data-testid="progress-bar-container"
    >
      {/* Low-confidence direction prompt */}
      {showDirectionPrompt && state.directionConfidence === 'low' && (
        <div
          className="ebook-reader__direction-prompt"
          role="alert"
          data-testid="direction-prompt"
        >
          <span className="ebook-reader__direction-prompt-text">
            Text direction could not be determined with confidence. Please select:
          </span>
          <button
            className="ebook-reader__direction-prompt-btn"
            onClick={() => handleDirectionConfirm('ltr')}
            data-testid="direction-ltr-btn"
          >
            Left-to-Right (LTR)
          </button>
          <button
            className="ebook-reader__direction-prompt-btn"
            onClick={() => handleDirectionConfirm('rtl')}
            data-testid="direction-rtl-btn"
          >
            Right-to-Left (RTL)
          </button>
        </div>
      )}

      {/* Chapter title */}
      <div className="ebook-reader__progress-chapter" data-testid="progress-chapter-title">
        {currentChapterTitle}
      </div>

      {/* Progress bar */}
      <div className="ebook-reader__progress-bar-wrapper">
        <div
          className="ebook-reader__progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Reading progress: ${progress}%`}
          data-testid="progress-bar"
        >
          <div
            className="ebook-reader__progress-bar-fill"
            style={{
              width: `${progress}%`,
              [isRTL ? 'marginRight' : 'marginLeft']: '0',
              [isRTL ? 'marginLeft' : 'marginRight']: 'auto',
            }}
            data-testid="progress-bar-fill"
          />
        </div>
        <span className="ebook-reader__progress-text" data-testid="progress-text">
          {progress}%
        </span>
      </div>

      {/* Direction override toggle */}
      <button
        className="ebook-reader__direction-toggle"
        onClick={handleDirectionToggle}
        aria-label={`Switch to ${isRTL ? 'LTR' : 'RTL'} direction`}
        data-testid="direction-toggle"
        title={`Current: ${state.direction.toUpperCase()}. Click to switch.`}
      >
        {isRTL ? '⟵ LTR' : 'RTL ⟶'}
      </button>
    </div>
  );
};

export default ProgressBar;
