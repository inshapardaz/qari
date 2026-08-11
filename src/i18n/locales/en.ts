import type { TranslationStrings } from '../types';

export const en: TranslationStrings = {
  // Meta
  uiDirection: 'ltr',

  // Reader
  loading: 'Loading…',
  errorSource: 'Source:',
  errorFormat: 'Format:',
  tableOfContents: 'Table of contents',
  bookmarks: 'Bookmarks',
  readingSettings: 'Reading settings',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  previousChapter: 'Previous chapter',
  nextChapter: 'Next chapter',
  pageIndicator: 'Page {current} of {total}',
  chapterIndicator: 'Chapter {current} of {total}',
  resetToDefaults: 'Reset to Defaults',
  closeReader: 'Close reader',

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
  settingsLayout: 'Layout',
  settingsLayoutSingle: 'Single column',
  settingsLayoutDouble: 'Two columns',
  settingsLayoutScroll: 'Scroll',
  settingsMore: 'More settings',
  settingsPreviewText: 'The quick brown fox jumps over the lazy dog. This preview shows how your reading settings will look.',
  settingsApply: 'Apply',
  settingsCancel: 'Cancel',

  // Dictionary popover
  dictionaryLoading: 'Loading...',
  dictionaryClose: 'Close dictionary',
  dictionaryNotFound: 'No definition found for “{word}”.',
  dictionaryNoDictionary: 'No dictionary available for this language.',
  dictionaryTryIn: 'Try in {language}',
  spellcheckCorrect: 'Correctly spelled',
  spellcheckMisspelled: 'Misspelled',
  spellingSuggestions: 'Spelling suggestions',
  dictionaryLoadingAriaLabel: 'Dictionary lookup loading',
  dictionaryExamples: 'Examples',
  dictionaryLookupMenuItem: 'Meaning',

  // Bookmark panel
  bookmarksPanelTitle: 'Bookmarks',
  bookmarkNamePlaceholder: 'Bookmark name (optional)',
  bookmarkAutoName: 'Chapter {chapter}, Page {page}',
  bookmarkAdd: 'Add Bookmark',
  bookmarksEmpty: 'No bookmarks yet.',
  bookmarkRename: 'Rename',
  bookmarkDelete: 'Delete',
  bookmarkSave: 'Save',
  bookmarkCancel: 'Cancel',
  bookmarkNewNameAriaLabel: 'New bookmark name',
  bookmarkCreateAriaLabel: 'Create bookmark',

  // Note panel
  notesPanelTitle: 'Notes',
  notesEmpty: 'No notes yet. Select text and right-click to add one.',
  noteAddMenuItem: 'Add note',
  noteRemoveMenuItem: 'Remove note',
  noteCommentPlaceholder: 'Add a comment (optional)',
  noteSave: 'Save',
  noteCancel: 'Cancel',

  // Chapter index
  chaptersTitle: 'Chapters',
  goToChapter: 'Go to chapter: {title}',

  // Zoom controls
  zoomControls: 'Zoom controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',

  // Image lightbox
  lightboxClose: 'Close image viewer',
  lightboxZoomIn: 'Zoom in',
  lightboxZoomOut: 'Zoom out',
  lightboxLabel: 'Image viewer',

  // Footnote popover
  footnoteClose: 'Close footnote',
  footnoteDialogLabel: 'Footnote {label}',

  // Font selector — English is also the canonical source of font display
  // names, so this is an identity map for every built-in FontOption.
  fontNames: {
    Serif: 'Serif',
    Sans: 'Sans',
    Mono: 'Mono',
    'Adobe Arabic': 'Adobe Arabic',
    'Alvi Lahori Nastaleeq': 'Alvi Lahori Nastaleeq',
    Amiri: 'Amiri',
    'Aref Ruqaa': 'Aref Ruqaa',
    'Dehalvi Khush Khat': 'Dehalvi Khush Khat',
    Dubai: 'Dubai',
    'Emad Nastaleeq': 'Emad Nastaleeq',
    'Fajer Noori Nastalique': 'Fajer Noori Nastalique',
    'Gulzar Nastalique': 'Gulzar Nastalique',
    'Jameel Khushkhati': 'Jameel Khushkhati',
    'Jameel Noori Nastaleeq Kasheeda': 'Jameel Noori Nastaleeq Kasheeda',
    'Jameel Noori Nastaleeq': 'Jameel Noori Nastaleeq',
    Lalezar: 'Lalezar',
    Lateef: 'Lateef',
    Mada: 'Mada',
    'Mehr Nastaleeq': 'Mehr Nastaleeq',
    'Mehr Nastaliq Web': 'Mehr Nastaliq Web',
    'Nafees Nastaleeq': 'Nafees Nastaleeq',
    'Nafees Web Naskh': 'Nafees Web Naskh',
    'Noto Naskh Arabic': 'Noto Naskh Arabic',
    'Noto Nastaliq Urdu': 'Noto Nastaliq Urdu',
    'Pak Nastaleeq': 'Pak Nastaleeq',
    Qahiri: 'Qahiri',
    'Reem Kufi': 'Reem Kufi',
    'Sameer Khashab Bold': 'Sameer Khashab Bold',
    'Scheherazade New': 'Scheherazade New',
  },
};
