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
import { Alert, Button, ActionIcon, Progress, Text, Group, Stack } from '@mantine/core';
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
    <Stack
      className="ebook-reader__progress-bar-container"
      dir={state.direction}
      data-testid="progress-bar-container"
      gap="xs"
    >
      {/* Low-confidence direction prompt */}
      {showDirectionPrompt && state.directionConfidence === 'low' && (
        <Alert
          className="ebook-reader__direction-prompt"
          data-testid="direction-prompt"
        >
          <Text className="ebook-reader__direction-prompt-text" size="sm" mb="xs">
            Text direction could not be determined with confidence. Please select:
          </Text>
          <Group gap="xs">
            <Button
              className="ebook-reader__direction-prompt-btn"
              onClick={() => handleDirectionConfirm('ltr')}
              data-testid="direction-ltr-btn"
              size="xs"
              variant="default"
            >
              Left-to-Right (LTR)
            </Button>
            <Button
              className="ebook-reader__direction-prompt-btn"
              onClick={() => handleDirectionConfirm('rtl')}
              data-testid="direction-rtl-btn"
              size="xs"
              variant="default"
            >
              Right-to-Left (RTL)
            </Button>
          </Group>
        </Alert>
      )}

      {/* Chapter title */}
      <Text className="ebook-reader__progress-chapter" data-testid="progress-chapter-title" size="sm" fw={500}>
        {currentChapterTitle}
      </Text>

      {/* Progress bar */}
      <Group className="ebook-reader__progress-bar-wrapper" gap="xs" wrap="nowrap">
        <Progress.Root
          className="ebook-reader__progress-bar"
          data-testid="progress-bar"
          style={{ flex: 1 }}
        >
          <Progress.Section
            className="ebook-reader__progress-bar-fill"
            value={progress}
            aria-label={`Reading progress: ${progress}%`}
            data-testid="progress-bar-fill"
          />
        </Progress.Root>
        <Text className="ebook-reader__progress-text" data-testid="progress-text" size="sm">
          {progress}%
        </Text>
      </Group>

      {/* Direction override toggle */}
      <ActionIcon
        className="ebook-reader__direction-toggle"
        onClick={handleDirectionToggle}
        aria-label={`Switch to ${isRTL ? 'LTR' : 'RTL'} direction`}
        data-testid="direction-toggle"
        title={`Current: ${state.direction.toUpperCase()}. Click to switch.`}
        variant="subtle"
        w="auto"
        px="xs"
      >
        {isRTL ? '⟵ LTR' : 'RTL ⟶'}
      </ActionIcon>
    </Stack>
  );
};

export default ProgressBar;
