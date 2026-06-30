/**
 * ChapterIndex Component — navigable table of contents for the Universal Ebook Reader.
 *
 * Displays a list of chapters with title and order. Highlights the current chapter.
 * Hidden when the book has no chapter structure (single chapter).
 * Uses ReaderContext to access the ChapterNavigator.
 */

import React from 'react';
import { useReaderContext } from './Reader';
import { useTranslations, interpolate } from '../i18n';

export interface ChapterIndexProps {
  /** Callback when the user navigates to a different chapter */
  onChapterSelect?: (chapterIndex: number) => void;
}

export const ChapterIndex: React.FC<ChapterIndexProps> = ({ onChapterSelect }) => {
  const { state, chapterNavigator } = useReaderContext();
  const t = useTranslations();

  // Don't render if there's no navigator or no chapter structure
  if (!chapterNavigator || !chapterNavigator.hasChapterStructure()) {
    return null;
  }

  const chapters = chapterNavigator.getChapterIndex();
  const currentChapter = state.currentChapter;

  const handleChapterClick = (chapterIndex: number) => {
    if (!chapterNavigator) return;

    chapterNavigator.goToChapter(chapterIndex);

    if (onChapterSelect) {
      onChapterSelect(chapterIndex);
    }
  };

  return (
    <nav
      className="ebook-reader__chapter-index"
      dir={state.direction}
      aria-label={t.tableOfContents}
      data-testid="chapter-index"
    >
      <h2 className="ebook-reader__chapter-index-title">{t.chaptersTitle}</h2>
      <ol className="ebook-reader__chapter-list" role="list">
        {chapters.map((chapter, index) => {
          const isCurrent = index === currentChapter;
          return (
            <li
              key={chapter.id}
              className={`ebook-reader__chapter-item${isCurrent ? ' ebook-reader__chapter-item--active' : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <button
                className="ebook-reader__chapter-button"
                onClick={() => handleChapterClick(index)}
                aria-label={interpolate(t.goToChapter, { title: chapter.title })}
                data-testid={`chapter-item-${index}`}
              >
                <span className="ebook-reader__chapter-order">{chapter.order + 1}.</span>
                <span className="ebook-reader__chapter-title">{chapter.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default ChapterIndex;
