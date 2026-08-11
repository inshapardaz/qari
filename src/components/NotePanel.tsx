/**
 * NotePanel Component — displays the list of notes for the current book,
 * with comment editing, deletion, and navigation. Notes themselves are
 * created by selecting text in the reading view and right-clicking, not
 * from this panel — there's no create form here.
 * Uses NoteStore from ReaderContext.
 */

import React, { useState, useCallback } from 'react';
import { Textarea, Button, ActionIcon, Alert, Title, Group, Text } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations } from '../i18n';
import { getChapterCharCount } from '../services/chapter-navigator';
import type { Note } from '../models/note';
import type { NoteChangeEvent } from '../interfaces/note-store';
import type { PageChangeEvent } from '../models/events';

export interface NotePanelProps {
  /** Called when a note's comment is created, deleted, or updated */
  onNoteChange?: (event: NoteChangeEvent) => void;
  /** Called when a note is selected (navigate to it) */
  onNoteSelect?: (note: Note) => void;
  /**
   * Called when navigation to a note is requested.
   * Provides the resolved chapter index, page number, and reading progress percentage.
   */
  onNavigate?: (chapterIdx: number, page: number, progress: number) => void;
  /**
   * Called when navigation completes with the standard PageChangeEvent.
   */
  onPageChange?: (event: PageChangeEvent) => void;
  /**
   * Characters per page used for pagination calculation.
   * Defaults to 1500 if not provided.
   */
  charsPerPage?: number;
}

const MAX_COMMENT_LENGTH = 1000;
const DEFAULT_CHARS_PER_PAGE = 1500;
const EXCERPT_LENGTH = 140;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export const NotePanel: React.FC<NotePanelProps> = ({
  onNoteChange,
  onNoteSelect,
  onNavigate,
  onPageChange,
  charsPerPage = DEFAULT_CHARS_PER_PAGE,
}) => {
  const { state, noteStore, removeNote, updateNote } = useReaderContext();
  const t = useTranslations();
  const { notes, book } = state;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentBookId = book?.metadata.identifier || '';
  const bookNotes = notes.filter((n) => n.bookId === currentBookId);

  // Same char-offset -> page/progress approximation used by BookmarkPanel,
  // applied to a note's startOffset instead of a bookmark's position.
  const handleNoteClick = useCallback(
    (note: Note) => {
      if (!book) {
        setError('No book is currently loaded.');
        return;
      }

      const chapterIdx = book.chapters.findIndex((ch) => ch.id === note.chapterId);
      if (chapterIdx === -1) {
        setError('Note target is invalid: chapter not found in current book.');
        return;
      }

      const chapter = book.chapters[chapterIdx];
      const chapterCharCount = getChapterCharCount(chapter);

      let targetPage: number;
      let effectivePosition: number;

      if (note.startOffset > chapterCharCount) {
        const totalPagesInChapter = chapterCharCount === 0
          ? 1
          : Math.ceil(chapterCharCount / charsPerPage);
        targetPage = totalPagesInChapter - 1;
        effectivePosition = chapterCharCount;
      } else {
        targetPage = Math.floor(note.startOffset / charsPerPage);
        effectivePosition = note.startOffset;
      }

      let charsBeforeChapter = 0;
      let totalBookChars = 0;
      for (let i = 0; i < book.chapters.length; i++) {
        const charCount = getChapterCharCount(book.chapters[i]);
        if (i < chapterIdx) {
          charsBeforeChapter += charCount;
        }
        totalBookChars += charCount;
      }

      const progress = totalBookChars > 0
        ? Math.round(
            ((charsBeforeChapter + Math.min(effectivePosition, chapterCharCount)) / totalBookChars) * 100
          )
        : 0;
      const clampedProgress = Math.max(0, Math.min(100, progress));

      setError(null);

      if (onNavigate) {
        onNavigate(chapterIdx, targetPage, clampedProgress);
      }
      if (onPageChange) {
        onPageChange({ chapter: chapterIdx, page: targetPage, progress: clampedProgress });
      }
      if (onNoteSelect) {
        onNoteSelect(note);
      }
    },
    [book, charsPerPage, onNavigate, onPageChange, onNoteSelect]
  );

  const handleEditStart = useCallback((note: Note) => {
    setEditingId(note.id);
    setEditComment(note.comment ?? '');
    setError(null);
  }, []);

  const handleEditConfirm = useCallback(async () => {
    if (!editingId || !noteStore) return;

    if (editComment.length > MAX_COMMENT_LENGTH) {
      setError(`Note comment must not exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    try {
      const updated = await noteStore.updateComment(editingId, editComment.trim());
      updateNote(updated);
      if (onNoteChange) {
        onNoteChange({ type: 'updated', note: updated });
      }
      setEditingId(null);
      setEditComment('');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update note.');
    }
  }, [editingId, editComment, noteStore, updateNote, onNoteChange]);

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditComment('');
    setError(null);
  }, []);

  const handleDelete = useCallback(
    async (noteId: string) => {
      if (!noteStore) return;

      try {
        await noteStore.delete(noteId);
        removeNote(noteId);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete note.');
      }
    },
    [noteStore, removeNote]
  );

  return (
    <div className="note-panel" data-testid="note-panel" role="region" aria-label="Notes">
      <Title order={2} size="h4" mb="sm">{t.notesPanelTitle}</Title>

      {error && (
        <Alert
          data-testid="note-error"
          role="alert"
          aria-live="assertive"
          color="red"
          mb="sm"
        >
          {error}
        </Alert>
      )}

      <ul className="note-panel__list" data-testid="note-list" role="list" aria-label="Note list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {bookNotes.length === 0 && (
          <li className="note-panel__empty" data-testid="note-empty">
            {t.notesEmpty}
          </li>
        )}
        {bookNotes.map((note) => (
          <li
            key={note.id}
            className="note-panel__item"
            data-testid={`note-item-${note.id}`}
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
          >
            <Group justify="space-between" wrap="nowrap" py="xs" gap="xs" align="flex-start">
              <Button
                data-testid={`note-excerpt-${note.id}`}
                aria-label={`Go to note: ${note.text}`}
                onClick={() => handleNoteClick(note)}
                variant="subtle"
                justify="start"
                style={{ flex: 1, height: 'auto', whiteSpace: 'normal', textAlign: 'start' }}
              >
                <div>
                  <Text size="sm" fs="italic" style={{ wordBreak: 'break-word' }}>
                    &ldquo;{truncate(note.text, EXCERPT_LENGTH)}&rdquo;
                  </Text>
                  {note.comment && (
                    <Text size="xs" c="dimmed" mt={2} style={{ wordBreak: 'break-word' }}>
                      {note.comment}
                    </Text>
                  )}
                </div>
              </Button>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  data-testid={`note-edit-${note.id}`}
                  aria-label={`Edit note comment: ${note.text}`}
                  onClick={() => handleEditStart(note)}
                  variant="subtle"
                  size="sm"
                >
                  ✎
                </ActionIcon>
                <ActionIcon
                  data-testid={`note-delete-${note.id}`}
                  aria-label={`Delete note: ${note.text}`}
                  onClick={() => handleDelete(note.id)}
                  variant="subtle"
                  color="red"
                  size="sm"
                >
                  ✕
                </ActionIcon>
              </Group>
            </Group>

            {editingId === note.id && (
              <Group gap="xs" data-testid="note-edit-form" wrap="nowrap" pb="xs" align="flex-start">
                <Textarea
                  data-testid="note-edit-input"
                  placeholder={t.noteCommentPlaceholder}
                  value={editComment}
                  maxLength={MAX_COMMENT_LENGTH}
                  aria-label="Edit note comment"
                  minRows={2}
                  onChange={(e) => {
                    setEditComment(e.target.value);
                    setError(null);
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  data-testid="note-save-btn"
                  aria-label="Save note comment"
                  onClick={handleEditConfirm}
                  size="xs"
                >
                  {t.noteSave}
                </Button>
                <Button
                  data-testid="note-cancel-btn"
                  aria-label="Cancel note edit"
                  onClick={handleEditCancel}
                  variant="subtle"
                  size="xs"
                >
                  {t.noteCancel}
                </Button>
              </Group>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotePanel;
