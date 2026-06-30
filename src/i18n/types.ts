export interface TranslationStrings {
  // Reader component
  loading: string;
  errorSource: string;
  errorFormat: string;
  tableOfContents: string;
  bookmarks: string;
  readingSettings: string;
  enterFullscreen: string;
  exitFullscreen: string;
  previousPage: string;
  nextPage: string;
  pageIndicator: string; // supports {current}, {total}, {percent}
  resetToDefaults: string;

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

  // Bookmark panel
  bookmarksPanelTitle: string;
  bookmarkNamePlaceholder: string;
  bookmarkAdd: string;
  bookmarksEmpty: string;
  bookmarkRename: string;
  bookmarkDelete: string;
  bookmarkSave: string;
  bookmarkCancel: string;
  bookmarkNewNameAriaLabel: string;
  bookmarkCreateAriaLabel: string;

  // Chapter index
  chaptersTitle: string;
  goToChapter: string; // supports {title}

  // Zoom controls
  zoomControls: string;
  zoomIn: string; // supports {level}
  zoomOut: string; // supports {level}
}
