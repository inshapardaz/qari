export interface TranslationStrings {
  // Meta — UI layout direction for the translation language
  uiDirection: 'ltr' | 'rtl';

  // Reader component
  loading: string;
  errorSource: string;
  errorFormat: string;
  /** Shown in place of the book content when `blockDevTools` detects the browser's devtools are open. */
  devToolsBlockedMessage: string;
  tableOfContents: string;
  bookmarks: string;
  readingSettings: string;
  enterFullscreen: string;
  exitFullscreen: string;
  previousPage: string;
  nextPage: string;
  previousChapter: string;
  nextChapter: string;
  pageIndicator: string; // supports {current}, {total}, {percent}
  chapterIndicator: string; // supports {current}, {total}, {title}
  resetToDefaults: string;
  closeReader: string;

  // Settings dialog
  settingsTheme: string;
  themeLight: string;
  themeDark: string;
  themeSepia: string;
  themeHighContrast: string;
  settingsFontFamily: string;
  settingsFontSize: string; // supports {size}
  settingsJustify: string;
  settingsLineSpacing: string; // supports {value}
  settingsLetterSpacing: string; // supports {value}
  settingsWordSpacing: string; // supports {value}
  settingsMargin: string; // supports {value}
  settingsColumns: string;
  settingsLayout: string;
  settingsLayoutSingle: string;
  settingsLayoutDouble: string;
  settingsLayoutScroll: string;
  settingsMore: string;
  settingsPreviewText: string;
  settingsApply: string;
  settingsCancel: string;

  // Dictionary popover
  dictionaryLoading: string;
  dictionaryClose: string;
  dictionaryNotFound: string; // supports {word}
  dictionaryNoDictionary: string;
  dictionaryTryIn: string; // supports {language}
  spellcheckCorrect: string;
  spellcheckMisspelled: string;
  spellingSuggestions: string;
  dictionaryLoadingAriaLabel: string;
  dictionaryExamples: string;
  /** Context menu item that triggers a dictionary lookup for the selected text. */
  dictionaryLookupMenuItem: string;

  // Bookmark panel
  bookmarksPanelTitle: string;
  /** Bookmark name, always auto-generated (no custom naming). Interpolates {chapter} and {page} (both 1-indexed). */
  bookmarkAutoName: string;
  bookmarksEmpty: string;
  bookmarkDelete: string;

  // Note panel
  notesPanelTitle: string;
  notesEmpty: string;
  /** Context menu item shown on right-click after selecting text. */
  noteAddMenuItem: string;
  /** Context menu item shown on right-click over an existing note highlight. */
  noteRemoveMenuItem: string;

  // Chapter index
  chaptersTitle: string;
  goToChapter: string; // supports {title}

  // Zoom controls
  zoomControls: string;
  zoomIn: string; // supports {level}
  zoomOut: string; // supports {level}

  // Image lightbox
  lightboxClose: string;
  lightboxZoomIn: string;
  lightboxZoomOut: string;
  lightboxLabel: string;

  // Footnote popover
  footnoteClose: string;
  footnoteDialogLabel: string; // supports {label}

  /**
   * Localized display labels for font selector entries (FontOption.name -> label).
   * Fonts without an entry fall back to their FontOption.name as-is.
   */
  fontNames: Record<string, string>;
}
