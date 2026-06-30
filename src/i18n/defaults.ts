import type { TranslationStrings } from './types';

export const DEFAULT_TRANSLATIONS: TranslationStrings = {
  // Reader
  loading: 'Loading\u2026',
  errorSource: 'Source:',
  errorFormat: 'Format:',
  tableOfContents: 'Table of contents',
  bookmarks: 'Bookmarks',
  readingSettings: 'Reading settings',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  pageIndicator: 'Page {current}/{total}',
  resetToDefaults: 'Reset to Defaults',

  // Settings dialog
  settingsTheme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSepia: 'Sepia',
  themeHighContrast: 'HC',
  settingsFontFamily: 'Font Family',
  settingsFontSize: 'Font Size',
  settingsJustify: 'Justify Text',
  settingsLineSpacing: 'Line Spacing',
  settingsLetterSpacing: 'Letter Spacing',
  settingsWordSpacing: 'Word Spacing',
  settingsMargin: 'Margin',
  settingsColumns: 'Columns',

  // Dictionary popover
  dictionaryLoading: 'Loading...',
  dictionaryClose: 'Close dictionary',
  dictionaryNotFound: 'No definition found for \u201c{word}\u201d.',
  dictionaryNoDictionary: 'No dictionary available for this language.',
  dictionaryTryIn: 'Try in {language}',
  spellcheckCorrect: 'Correctly spelled',
  spellcheckMisspelled: 'Misspelled',
  spellingSuggestions: 'Spelling suggestions',
  dictionaryLoadingAriaLabel: 'Dictionary lookup loading',
  dictionaryExamples: 'Examples',

  // Bookmark panel
  bookmarksPanelTitle: 'Bookmarks',
  bookmarkNamePlaceholder: 'Bookmark name',
  bookmarkAdd: 'Add Bookmark',
  bookmarksEmpty: 'No bookmarks yet.',
  bookmarkRename: 'Rename',
  bookmarkDelete: 'Delete',
  bookmarkSave: 'Save',
  bookmarkCancel: 'Cancel',
  bookmarkNewNameAriaLabel: 'New bookmark name',
  bookmarkCreateAriaLabel: 'Create bookmark',

  // Chapter index
  chaptersTitle: 'Chapters',
  goToChapter: 'Go to chapter: {title}',

  // Zoom controls
  zoomControls: 'Zoom controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
};
