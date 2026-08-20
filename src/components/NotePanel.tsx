/**
 * NotePanel Component — displays the list of notes for the current book,
 * with deletion and navigation, plus editing a note's comment and
 * highlight color. Notes are *created* by selecting text in the reading
 * view and right-clicking (there's no create form here), but a note's
 * comment and color can be changed after the fact from this panel.
 * Uses NoteStore from ReaderContext.
 */

import React, { useState, useCallback } from 'react';
import { Button, ActionIcon, Alert, Title, Group, Text, Textarea } from '@mantine/core';
import { useReaderContext } from './Reader';
import { useTranslations, interpolate } from '../i18n';
import { getChapterCharCount } from '../services/chapter-navigator';
import { NOTE_HIGHLIGHT_COLORS, DEFAULT_NOTE_COLOR, NOTE_COLOR_ORDER } from '../utils/text-highlight';
import type { Note, NoteColor } from '../models/note';
import type { PageChangeEvent } from '../models/events';

export interface NotePanelProps {
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

const DEFAULT_CHARS_PER_PAGE = 1500;
const EXCERPT_LENGTH = 140;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export const NotePanel: React.FC<NotePanelProps> = ({
  onNoteSelect,
  onNavigate,
  onPageChange,
  charsPerPage = DEFAULT_CHARS_PER_PAGE,
}) => {
  const { state, noteStore, removeNote, updateNote } = useReaderContext();
  const t = useTranslations();
  const { notes, book } = state;

  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');

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

  const handleStartEdit = useCallback((note: Note) => {
    setEditingId(note.id);
    setDraftComment(note.comment ?? '');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setDraftComment('');
  }, []);

  const handleSaveComment = useCallback(
    async (noteId: string) => {
      if (!noteStore) return;

      try {
        const updated = await noteStore.updateComment(noteId, draftComment);
        updateNote(updated);
        setEditingId(null);
        setDraftComment('');
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save comment.');
      }
    },
    [noteStore, draftComment, updateNote]
  );

  const handleColorChange = useCallback(
    async (noteId: string, color: NoteColor) => {
      if (!noteStore) return;

      try {
        const updated = await noteStore.updateColor(noteId, color);
        updateNote(updated);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to change highlight color.');
      }
    },
    [noteStore, updateNote]
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
        {bookNotes.map((note) => {
          const activeColor = note.color ?? DEFAULT_NOTE_COLOR;
          const isEditing = editingId === note.id;

          return (
            <li
              key={note.id}
              className="note-panel__item"
              data-testid={`note-item-${note.id}`}
              style={{ borderBottom: '1px solid var(--reader-border, #e0e0e0)', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}
            >
              <Group justify="space-between" wrap="nowrap" py="xs" gap="xs" align="flex-start">
                <Button
                  data-testid={`note-excerpt-${note.id}`}
                  aria-label={`Go to note: ${note.text}`}
                  onClick={() => handleNoteClick(note)}
                  variant="subtle"
                  justify="start"
                  // A "subtle"-variant Button's text/hover otherwise come from
                  // the (Mantine primary/brand) `--button-color`/`--button-hover`,
                  // not the reading theme — this list is book content, so it
                  // should read in the same colors as the rest of the reader.
                  style={{
                    flex: 1,
                    height: 'auto',
                    whiteSpace: 'normal',
                    textAlign: 'start',
                    color: 'var(--reader-fg, #1a1a1a)',
                    '--button-hover': 'var(--reader-surface, #f5f5f5)',
                  } as React.CSSProperties}
                >
                  <Text size="sm" fs="italic" style={{ wordBreak: 'break-word' }}>
                    &ldquo;{truncate(note.text, EXCERPT_LENGTH)}&rdquo;
                  </Text>
                </Button>
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

              <Group gap={6} wrap="nowrap" px="0.2rem">
                {NOTE_COLOR_ORDER.map((color) => (
                  <button
                    key={color}
                    type="button"
                    data-testid={`note-color-${note.id}-${color}`}
                    aria-label={interpolate(t.noteColorLabel, { color: t.noteColors[color] ?? color })}
                    aria-pressed={activeColor === color}
                    onClick={() => handleColorChange(note.id, color)}
                    style={{
                      width: '1.1rem',
                      height: '1.1rem',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      padding: 0,
                      backgroundColor: NOTE_HIGHLIGHT_COLORS[color],
                      border: activeColor === color
                        ? '2px solid var(--reader-fg, #1a1a1a)'
                        : '1px solid var(--reader-border, #e0e0e0)',
                    }}
                  />
                ))}
                <ActionIcon
                  data-testid={`note-edit-${note.id}`}
                  aria-label={t.noteEditComment}
                  aria-pressed={isEditing}
                  onClick={() => (isEditing ? handleCancelEdit() : handleStartEdit(note))}
                  variant={isEditing ? 'filled' : 'subtle'}
                  size="sm"
                  ml="auto"
                  // Same theme-following override the header's toggle
                  // buttons (theme/layout/settings) use — without it, a
                  // "filled"/"subtle" ActionIcon falls back to Mantine's own
                  // primary/brand color and dimmed gray, clashing with the
                  // reading theme the rest of this panel follows.
                  style={isEditing
                    ? { backgroundColor: 'var(--reader-fg, #1a1a1a)', color: 'var(--reader-bg, #ffffff)' }
                    : { color: 'var(--reader-fg, #1a1a1a)' }}
                >
                  ✎
                </ActionIcon>
              </Group>

              {isEditing ? (
                <div style={{ padding: '0.3rem 0.2rem 0' }}>
                  <Textarea
                    data-testid={`note-comment-input-${note.id}`}
                    aria-label={t.noteCommentPlaceholder}
                    placeholder={t.noteCommentPlaceholder}
                    value={draftComment}
                    onChange={(e) => setDraftComment(e.currentTarget.value)}
                    minRows={2}
                    maxLength={1000}
                    style={{
                      '--input-bg': 'var(--reader-surface, #f5f5f5)',
                      '--input-color': 'var(--reader-fg, #1a1a1a)',
                      '--input-bd': 'var(--reader-border, #e0e0e0)',
                    } as React.CSSProperties}
                  />
                  <Group justify="end" gap="xs" mt={4}>
                    <Button
                      data-testid={`note-cancel-${note.id}`}
                      size="xs"
                      variant="subtle"
                      onClick={handleCancelEdit}
                      // Same theme-following override as the excerpt/result
                      // buttons elsewhere in this panel — a "subtle" Button
                      // otherwise takes its color from Mantine's own
                      // primary/brand color, not the reading theme.
                      style={{
                        color: 'var(--reader-fg, #1a1a1a)',
                        '--button-hover': 'var(--reader-surface, #f5f5f5)',
                      } as React.CSSProperties}
                    >
                      {t.noteCancelEdit}
                    </Button>
                    <Button
                      data-testid={`note-save-${note.id}`}
                      size="xs"
                      onClick={() => handleSaveComment(note.id)}
                      // Default "filled" variant otherwise renders Mantine's
                      // own primary/brand blue — `--reader-accent` is the
                      // reading theme's own highlight color (set by
                      // ThemeEngine), and `--reader-bg` reads reliably on
                      // top of it across all four built-in themes (same
                      // pairing used for the active-chapter highlight).
                      style={{
                        backgroundColor: 'var(--reader-accent, #0071e3)',
                        color: 'var(--reader-bg, #ffffff)',
                      }}
                    >
                      {t.noteSaveComment}
                    </Button>
                  </Group>
                </div>
              ) : (
                note.comment && (
                  <Text
                    data-testid={`note-comment-${note.id}`}
                    size="xs"
                    c="dimmed"
                    px="0.2rem"
                    mt={2}
                    style={{ wordBreak: 'break-word' }}
                  >
                    {note.comment}
                  </Text>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default NotePanel;
