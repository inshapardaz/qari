# Requirements Document

## Introduction

This feature adds internationalization (i18n) support to the Qari ebook reader by allowing consumers to pass UI string translations via a prop. All hardcoded English strings in the Reader and its sub-components (DictionaryPopover, BookmarkPanel, ChapterIndex, ZoomController, PageNavigation, ThemeSelector, and the settings dialog) will be replaced with translatable keys resolved from a translations object. A complete set of English defaults ensures backward compatibility when no translations prop is provided.

## Glossary

- **Reader**: The top-level React component (`<Reader />`) that orchestrates the ebook reading experience
- **Translation_Object**: A typed object mapping translation keys to localized string values, passed via props
- **Default_Translations**: A complete English translation object exported from the library, used as fallback when no translations prop is provided
- **Consumer**: A developer integrating the Qari Reader component into their application
- **UI_String**: Any user-visible text rendered by the Reader or its sub-components (labels, button text, status messages, aria-labels, placeholders)

## Requirements

### Requirement 1: Translations Prop Interface

**User Story:** As a consumer, I want to pass a translations object via a prop on the Reader component, so that I can display all UI strings in any language.

#### Acceptance Criteria

1. THE Reader SHALL accept an optional `translations` prop of type `Partial<TranslationStrings>`
2. WHEN the `translations` prop is not provided, THE Reader SHALL use the Default_Translations (English) for all UI strings
3. WHEN the `translations` prop is provided with a partial Translation_Object, THE Reader SHALL merge the provided translations with the Default_Translations, using provided values where available and English defaults for missing keys
4. THE Translation_Object type SHALL be exported from the library so Consumers can reference it for type safety

### Requirement 2: Default English Translations

**User Story:** As a consumer, I want the Reader to work without any translations prop, so that existing integrations remain unaffected.

#### Acceptance Criteria

1. THE Reader SHALL export a `DEFAULT_TRANSLATIONS` constant containing all English UI strings
2. THE Default_Translations SHALL include entries for every UI string key used across all Reader sub-components
3. WHEN no `translations` prop is provided, THE Reader SHALL render all UI strings using the Default_Translations values
4. THE Default_Translations SHALL match the current hardcoded English strings exactly, preserving backward compatibility

### Requirement 3: Reader Component Strings

**User Story:** As a consumer, I want to translate the main Reader UI labels, so that the loading state, error messages, navigation labels, and settings panel appear in the user's language.

#### Acceptance Criteria

1. THE Reader SHALL resolve the loading indicator text from the Translation_Object using key `loading`
2. THE Reader SHALL resolve the error display labels ("Source:", "Format:") from the Translation_Object using keys `errorSource` and `errorFormat`
3. THE Reader SHALL resolve the "Table of contents" aria-label from the Translation_Object using key `tableOfContents`
4. THE Reader SHALL resolve the "Bookmarks" aria-label from the Translation_Object using key `bookmarks`
5. THE Reader SHALL resolve the "Reading settings" aria-label from the Translation_Object using key `readingSettings`
6. THE Reader SHALL resolve the "Enter fullscreen" and "Exit fullscreen" aria-labels from the Translation_Object using keys `enterFullscreen` and `exitFullscreen`
7. THE Reader SHALL resolve the "Previous page" and "Next page" aria-labels from the Translation_Object using keys `previousPage` and `nextPage`
8. THE Reader SHALL resolve the "Page {current}/{total}" footer text from the Translation_Object using key `pageIndicator`
9. THE Reader SHALL resolve the "Reset to Defaults" button text from the Translation_Object using key `resetToDefaults`

### Requirement 4: Settings Dialog Strings

**User Story:** As a consumer, I want to translate the settings dialog labels, so that typography and layout controls are understandable in any language.

#### Acceptance Criteria

1. THE Reader SHALL resolve the "Theme" label from the Translation_Object using key `settingsTheme`
2. THE Reader SHALL resolve theme button labels ("Light", "Dark", "Sepia", "HC") from the Translation_Object using keys `themeLight`, `themeDark`, `themeSepia`, and `themeHighContrast`
3. THE Reader SHALL resolve the "Font Family" label from the Translation_Object using key `settingsFontFamily`
4. THE Reader SHALL resolve the "Font Size" label from the Translation_Object using key `settingsFontSize`
5. THE Reader SHALL resolve the "Justify Text" label from the Translation_Object using key `settingsJustify`
6. THE Reader SHALL resolve the "Line Spacing" label from the Translation_Object using key `settingsLineSpacing`
7. THE Reader SHALL resolve the "Letter Spacing" label from the Translation_Object using key `settingsLetterSpacing`
8. THE Reader SHALL resolve the "Word Spacing" label from the Translation_Object using key `settingsWordSpacing`
9. THE Reader SHALL resolve the "Margin" label from the Translation_Object using key `settingsMargin`
10. THE Reader SHALL resolve the "Columns" label from the Translation_Object using key `settingsColumns`

### Requirement 5: Dictionary Popover Strings

**User Story:** As a consumer, I want to translate dictionary popover messages, so that dictionary lookup feedback is presented in the user's language.

#### Acceptance Criteria

1. THE DictionaryPopover SHALL resolve the "Loading..." text from the Translation_Object using key `dictionaryLoading`
2. THE DictionaryPopover SHALL resolve the "Close dictionary" aria-label from the Translation_Object using key `dictionaryClose`
3. THE DictionaryPopover SHALL resolve the "No definition found" message from the Translation_Object using key `dictionaryNotFound`
4. THE DictionaryPopover SHALL resolve the "No dictionary available for this language" message from the Translation_Object using key `dictionaryNoDictionary`
5. THE DictionaryPopover SHALL resolve the "Try in {language}" button text from the Translation_Object using key `dictionaryTryIn`
6. THE DictionaryPopover SHALL resolve the "Correctly spelled" text from the Translation_Object using key `spellcheckCorrect`
7. THE DictionaryPopover SHALL resolve the "Misspelled" text from the Translation_Object using key `spellcheckMisspelled`
8. THE DictionaryPopover SHALL resolve the "Spelling suggestions" aria-label from the Translation_Object using key `spellingSuggestions`
9. THE DictionaryPopover SHALL resolve the "Dictionary lookup loading" aria-label from the Translation_Object using key `dictionaryLoadingAriaLabel`
10. THE DictionaryPopover SHALL resolve the "Examples" aria-label from the Translation_Object using key `dictionaryExamples`

### Requirement 6: Bookmark Panel Strings

**User Story:** As a consumer, I want to translate bookmark panel labels, so that bookmark management is accessible in any language.

#### Acceptance Criteria

1. THE BookmarkPanel SHALL resolve the "Bookmarks" heading from the Translation_Object using key `bookmarksPanelTitle`
2. THE BookmarkPanel SHALL resolve the "Bookmark name" placeholder from the Translation_Object using key `bookmarkNamePlaceholder`
3. THE BookmarkPanel SHALL resolve the "Add Bookmark" button text from the Translation_Object using key `bookmarkAdd`
4. THE BookmarkPanel SHALL resolve the "No bookmarks yet." empty state text from the Translation_Object using key `bookmarksEmpty`
5. THE BookmarkPanel SHALL resolve the "Rename" button text from the Translation_Object using key `bookmarkRename`
6. THE BookmarkPanel SHALL resolve the "Delete" button text from the Translation_Object using key `bookmarkDelete`
7. THE BookmarkPanel SHALL resolve the "Save" button text from the Translation_Object using key `bookmarkSave`
8. THE BookmarkPanel SHALL resolve the "Cancel" button text from the Translation_Object using key `bookmarkCancel`
9. THE BookmarkPanel SHALL resolve the "New bookmark name" aria-label from the Translation_Object using key `bookmarkNewNameAriaLabel`
10. THE BookmarkPanel SHALL resolve the "Create bookmark" aria-label from the Translation_Object using key `bookmarkCreateAriaLabel`

### Requirement 7: Chapter Index Strings

**User Story:** As a consumer, I want to translate chapter navigation labels, so that the table of contents is presented in the user's language.

#### Acceptance Criteria

1. THE ChapterIndex SHALL resolve the "Chapters" heading from the Translation_Object using key `chaptersTitle`
2. THE ChapterIndex SHALL resolve the "Table of contents" aria-label from the Translation_Object using key `tableOfContents`
3. THE ChapterIndex SHALL resolve the "Go to chapter: {title}" aria-label template from the Translation_Object using key `goToChapter`

### Requirement 8: Zoom Controls Strings

**User Story:** As a consumer, I want to translate zoom control labels, so that zoom functionality is accessible in any language.

#### Acceptance Criteria

1. THE ZoomControls SHALL resolve the "Zoom controls" aria-label from the Translation_Object using key `zoomControls`
2. THE ZoomControls SHALL resolve the "Zoom in" aria-label from the Translation_Object using key `zoomIn`
3. THE ZoomControls SHALL resolve the "Zoom out" aria-label from the Translation_Object using key `zoomOut`
4. THE ZoomControls SHALL resolve the "Zoom in" title from the Translation_Object using key `zoomIn`
5. THE ZoomControls SHALL resolve the "Zoom out" title from the Translation_Object using key `zoomOut`

### Requirement 9: Translation String Interpolation

**User Story:** As a consumer, I want translation strings to support dynamic values, so that translated text can include variables like page numbers and word names.

#### Acceptance Criteria

1. WHEN a translation string contains placeholder tokens in the format `{variableName}`, THE Reader SHALL replace each token with the corresponding runtime value
2. THE Reader SHALL support the following interpolated keys: `pageIndicator` with `{current}` and `{total}` and `{percent}`, `dictionaryNotFound` with `{word}`, `dictionaryTryIn` with `{language}`, `goToChapter` with `{title}`, `zoomIn` with `{level}`, `zoomOut` with `{level}`, `settingsFontSize` with `{size}`, `settingsLineSpacing` with `{value}`, `settingsLetterSpacing` with `{value}`, `settingsWordSpacing` with `{value}`, `settingsMargin` with `{value}`
3. IF a placeholder token in a translation string has no corresponding runtime value, THEN THE Reader SHALL leave the token text as-is in the rendered output

### Requirement 10: Translation Propagation to Sub-Components

**User Story:** As a consumer, I want translations to flow from the Reader to all sub-components, so that I only need to pass translations at the top level.

#### Acceptance Criteria

1. THE Reader SHALL propagate the resolved Translation_Object to sub-components via React context
2. WHEN a sub-component renders a UI string, THE sub-component SHALL read from the Translation_Object provided via context
3. THE Reader SHALL provide a `useTranslations` hook that sub-components use to access the Translation_Object from context
