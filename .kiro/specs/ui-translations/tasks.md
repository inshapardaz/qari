# Implementation Plan: UI Translations

## Overview

This plan implements an i18n layer for the Qari ebook reader. The work is structured in three phases: (1) build the `src/i18n/` module with types, defaults, context, and interpolation utility, (2) integrate the translation context into the Reader and all sub-components, and (3) validate correctness with property-based and unit tests.

## Tasks

- [x] 1. Create the i18n module foundation
  - [x] 1.1 Create `src/i18n/types.ts` with the `TranslationStrings` interface
    - Define the `TranslationStrings` interface containing all translation keys as specified in the design
    - Export the interface
    - _Requirements: 1.4, 2.2_

  - [x] 1.2 Create `src/i18n/defaults.ts` with `DEFAULT_TRANSLATIONS` constant
    - Implement the complete English defaults object matching all current hardcoded strings
    - Import and satisfy the `TranslationStrings` type
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 1.3 Create `src/i18n/interpolate.ts` with the `interpolate()` utility
    - Implement the token replacement function using `{token}` regex pattern
    - Unmatched tokens remain literal in the output
    - _Requirements: 9.1, 9.3_

  - [x] 1.4 Create `src/i18n/context.ts` with `TranslationContext` and `useTranslations` hook
    - Create the React context with `DEFAULT_TRANSLATIONS` as the default value
    - Export `useTranslations()` hook that calls `useContext(TranslationContext)`
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 1.5 Create `src/i18n/index.ts` barrel export
    - Re-export `TranslationStrings`, `DEFAULT_TRANSLATIONS`, `TranslationContext`, `useTranslations`, and `interpolate`
    - _Requirements: 1.4_

- [x] 2. Integrate TranslationContext into the Reader component
  - [x] 2.1 Add `translations` prop to `Reader.tsx` and wrap children with `TranslationContext.Provider`
    - Add optional `translations?: Partial<TranslationStrings>` prop to the Reader component
    - Merge with defaults using `useMemo`: `{ ...DEFAULT_TRANSLATIONS, ...translations }`
    - Wrap the existing render tree with `<TranslationContext.Provider value={resolvedTranslations}>`
    - _Requirements: 1.1, 1.2, 1.3, 10.1_

  - [x] 2.2 Replace all hardcoded strings in `Reader.tsx` with translation keys
    - Use `useTranslations()` to get the resolved translation object
    - Replace loading text, error labels, aria-labels, page indicator, settings labels, and navigation labels
    - Use `interpolate()` for dynamic strings (`pageIndicator`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

- [x] 3. Checkpoint - Verify i18n module and Reader integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate translations into sub-components
  - [x] 4.1 Update `DictionaryPopover.tsx` to use translation context
    - Import `useTranslations` and `interpolate` from `../i18n`
    - Replace all hardcoded strings with translation keys
    - Use `interpolate()` for `dictionaryNotFound` and `dictionaryTryIn`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 4.2 Update `BookmarkPanel.tsx` to use translation context
    - Import `useTranslations` from `../i18n`
    - Replace all hardcoded strings with translation keys
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [x] 4.3 Update `ChapterIndex.tsx` to use translation context
    - Import `useTranslations` and `interpolate` from `../i18n`
    - Replace heading and aria-labels with translation keys
    - Use `interpolate()` for `goToChapter`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.4 Update `ZoomController.tsx` to use translation context
    - Import `useTranslations` from `../i18n`
    - Replace aria-labels and titles with translation keys
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.5 Update `PageNavigation.tsx` to use translation context
    - Import `useTranslations` and `interpolate` from `../i18n`
    - Replace navigation aria-labels and page indicator with translation keys
    - Use `interpolate()` for `pageIndicator`
    - _Requirements: 3.7, 3.8, 9.2_

  - [x] 4.6 Update `ThemeSelector.tsx` to use translation context
    - Import `useTranslations` from `../i18n`
    - Replace theme button labels with translation keys
    - _Requirements: 4.1, 4.2_

- [x] 5. Checkpoint - Verify sub-component integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Property-based tests for i18n module
  - [x] 6.1 Write property test for partial merge correctness
    - **Property 1: Partial merge preserves provided keys and fills missing keys with defaults**
    - Generate random `Partial<TranslationStrings>` objects and verify merge produces correct values for all keys
    - Minimum 100 iterations
    - **Validates: Requirements 1.3**

  - [x] 6.2 Write property test for interpolation replacement
    - **Property 2: Interpolation replaces all matched tokens**
    - Generate random template strings with `{token}` placeholders and matching params, assert all tokens are replaced
    - Minimum 100 iterations
    - **Validates: Requirements 9.1**

  - [x] 6.3 Write property test for interpolation preservation
    - **Property 3: Interpolation preserves unmatched tokens**
    - Generate random template strings with `{token}` placeholders and incomplete params, assert unmatched tokens remain literal
    - Minimum 100 iterations
    - **Validates: Requirements 9.3**

- [x] 7. Unit tests for component translation integration
  - [x] 7.1 Write unit tests for Reader translation integration
    - Test Reader renders default translations when no prop is provided
    - Test Reader renders overridden translations when partial prop is provided
    - _Requirements: 1.2, 1.3, 2.3_

  - [x] 7.2 Write unit tests for DictionaryPopover translation integration
    - Test popover renders translated strings in loading, notFound, and noDictionary states
    - Test interpolated `dictionaryNotFound` and `dictionaryTryIn` messages
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 7.3 Write unit tests for BookmarkPanel translation integration
    - Test panel renders translated heading, placeholder, button labels, and empty state
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.4 Write unit tests for ChapterIndex translation integration
    - Test chapter index renders translated heading and interpolated `goToChapter` aria-labels
    - _Requirements: 7.1, 7.3_

  - [x] 7.5 Write unit tests for ZoomController translation integration
    - Test zoom controls render translated aria-labels and titles
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.6 Write unit tests for PageNavigation translation integration
    - Test page navigation renders translated aria-labels and interpolated page indicator
    - _Requirements: 3.7, 3.8_

  - [x] 7.7 Write unit tests for ThemeSelector translation integration
    - Test theme selector renders translated theme button labels
    - _Requirements: 4.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific integration examples and edge cases
- The i18n module is independent and can be tested in isolation before component integration
- `DEFAULT_TRANSLATIONS` values must exactly match the current hardcoded English strings to preserve backward compatibility

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 5, "tasks": ["4.1", "4.2"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7"] }
  ]
}
```
