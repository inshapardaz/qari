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
  /** Header status line's chapter segment when the book has more than one chapter — combines the chapter number and its title. Supports {current}, {title}. */
  headerChapterTitle: string;
  resetToDefaults: string;
  closeReader: string;
  /** Mobile-only header button that collapses Theme/Layout/Text-settings into one overflow menu (see the header's own "more options" popover). */
  moreOptions: string;
  /** Back button inside that overflow popover, returning from a sub-panel (Theme/Layout/Text settings) to its own menu list. */
  backToMenu: string;

  // Settings dialog
  settingsTheme: string;
  themeLight: string;
  themeDark: string;
  themeCalm: string;
  themeQuiet: string;
  themePaper: string;
  themeFocus: string;
  themeHighContrast: string;
  settingsFontFamily: string;
  settingsFontSize: string; // supports {size}
  /** Toolbar button that decreases font size — a distinct label from settingsFontSize since it names an action, not a value. */
  settingsFontSizeDecrease: string;
  /** Toolbar button that increases font size. */
  settingsFontSizeIncrease: string;
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
  settingsLayoutShowDivider: string;
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
  /** Button at the end of the dictionary popover that turns the looked-up selection into a note. */
  dictionaryAddToNote: string;

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
  /** Context menu item shown on right-click after selecting text; copies the selection to the clipboard. */
  noteCopyMenuItem: string;
  /** Context menu item shown on right-click over an existing note highlight. */
  noteRemoveMenuItem: string;
  /** Button that reveals the comment editor for a note. */
  noteEditComment: string;
  noteCommentPlaceholder: string;
  noteSaveComment: string;
  noteCancelEdit: string;
  /** Accessible label for a note's color-swatch row. Supports {color}. */
  noteColorLabel: string;
  /** Display names for each highlight color, keyed by NoteColor. */
  noteColors: Record<string, string>;

  // Search panel
  searchPanelTitle: string;
  searchPlaceholder: string;
  /** Shown before a query has been entered. */
  searchEmpty: string;
  /** Shown when a query has been entered but nothing matched. Supports {query}. */
  searchNoResults: string;
  /** Match count summary shown above the results list. Supports {count}. */
  searchResultsCount: string;
  /** Button that clears the search query. */
  searchClear: string;

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
