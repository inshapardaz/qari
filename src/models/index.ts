/**
 * Core data models for the Universal Ebook Reader.
 */

export type {
  Book,
  BookMetadata,
  Chapter,
  ContentNode,
  ParagraphNode,
  HeadingNode,
  ImageNode,
  CodeBlockNode,
  ListNode,
  ListItem,
  OpaqueNode,
  InlineNode,
  TextSpan,
  BoldSpan,
  ItalicSpan,
  LinkSpan,
  CodeSpan,
} from './book';

export type { Bookmark } from './bookmark';

export type {
  ReaderState,
  ReadingPreferences,
  ThemeName,
  FontFamily,
} from './reader-state';

export type {
  PageChangeEvent,
  BookmarkEvent,
  BookLoadedEvent,
  ReaderError,
} from './events';
