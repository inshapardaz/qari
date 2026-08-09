/**
 * PageNavigation Component — next/previous page controls for the Universal Ebook Reader.
 *
 * Provides navigation buttons that call ChapterNavigator's nextPage/previousPage.
 * Applies RTL layout: when direction is RTL, visual positions are swapped
 * (next is on the left, previous is on the right).
 * Emits onPageChange callback with updated state.
 */

import React from 'react';
import { ActionIcon, Group, Text } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations, interpolate } from '../i18n';
import type { PageChangeEvent } from '../models/events';

export interface PageNavigationProps {
  /** Callback emitted after page changes */
  onPageChange?: (event: PageChangeEvent) => void;
}

export const PageNavigation: React.FC<PageNavigationProps> = ({ onPageChange }) => {
  const { state, chapterNavigator } = useReaderContext();
  const t = useTranslations();

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
  const leftLabel = isRTL ? t.nextPage : t.previousPage;
  const rightLabel = isRTL ? t.previousPage : t.nextPage;
  const leftTestId = isRTL ? 'nav-next' : 'nav-previous';
  const rightTestId = isRTL ? 'nav-previous' : 'nav-next';

  return (
    <Group
      className="ebook-reader__page-navigation"
      dir={state.direction}
      role="navigation"
      aria-label="Page navigation"
      data-testid="page-navigation"
      justify="space-between"
    >
      <ActionIcon
        className="ebook-reader__nav-button ebook-reader__nav-button--left"
        onClick={leftAction}
        aria-label={leftLabel}
        data-testid={leftTestId}
        variant="default"
      >
        ‹
      </ActionIcon>

      <Text className="ebook-reader__page-indicator" data-testid="page-indicator" size="sm">
        {interpolate(t.pageIndicator, { current: state.currentPage + 1, total: state.totalPages })}
      </Text>

      <ActionIcon
        className="ebook-reader__nav-button ebook-reader__nav-button--right"
        onClick={rightAction}
        aria-label={rightLabel}
        data-testid={rightTestId}
        variant="default"
      >
        ›
      </ActionIcon>
    </Group>
  );
};

export default PageNavigation;
