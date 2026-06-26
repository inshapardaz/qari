/**
 * PageNavigation Component — next/previous page controls for the Universal Ebook Reader.
 *
 * Provides navigation buttons that call ChapterNavigator's nextPage/previousPage.
 * Applies RTL layout: when direction is RTL, visual positions are swapped
 * (next is on the left, previous is on the right).
 * Emits onPageChange callback with updated state.
 */

import React from 'react';
import { useReaderContext } from './Reader';
import type { PageChangeEvent } from '../models/events';

export interface PageNavigationProps {
  /** Callback emitted after page changes */
  onPageChange?: (event: PageChangeEvent) => void;
}

export const PageNavigation: React.FC<PageNavigationProps> = ({ onPageChange }) => {
  const { state, chapterNavigator } = useReaderContext();

  if (!chapterNavigator) {
    return null;
  }

  const isRTL = state.direction === 'rtl';

  const handleNext = () => {
    if (!chapterNavigator) return;

    const position = chapterNavigator.nextPage();
    const progress = chapterNavigator.getReadingProgress();

    if (onPageChange) {
      onPageChange({
        chapter: position.chapter,
        page: position.page,
        progress,
      });
    }
  };

  const handlePrevious = () => {
    if (!chapterNavigator) return;

    const position = chapterNavigator.previousPage();
    const progress = chapterNavigator.getReadingProgress();

    if (onPageChange) {
      onPageChange({
        chapter: position.chapter,
        page: position.page,
        progress,
      });
    }
  };

  // In RTL mode, the visual "forward" button (left) triggers next,
  // and the visual "backward" button (right) triggers previous.
  const leftAction = isRTL ? handleNext : handlePrevious;
  const rightAction = isRTL ? handlePrevious : handleNext;
  const leftLabel = isRTL ? 'Next page' : 'Previous page';
  const rightLabel = isRTL ? 'Previous page' : 'Next page';
  const leftTestId = isRTL ? 'nav-next' : 'nav-previous';
  const rightTestId = isRTL ? 'nav-previous' : 'nav-next';

  return (
    <div
      className="ebook-reader__page-navigation"
      dir={state.direction}
      role="navigation"
      aria-label="Page navigation"
      data-testid="page-navigation"
    >
      <button
        className="ebook-reader__nav-button ebook-reader__nav-button--left"
        onClick={leftAction}
        aria-label={leftLabel}
        data-testid={leftTestId}
      >
        ‹
      </button>

      <span className="ebook-reader__page-indicator" data-testid="page-indicator">
        {state.currentPage + 1} / {state.totalPages}
      </span>

      <button
        className="ebook-reader__nav-button ebook-reader__nav-button--right"
        onClick={rightAction}
        aria-label={rightLabel}
        data-testid={rightTestId}
      >
        ›
      </button>
    </div>
  );
};

export default PageNavigation;
