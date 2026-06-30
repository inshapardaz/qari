# Requirements Document

## Introduction

This feature adds built-in language dictionary support to the Qari ebook reader. When a user selects text and right-clicks (desktop) or long-presses (mobile/touch), a popup displays the meaning of the selected word using dictionary data. The reader supports both online dictionary providers (Free Dictionary API, Wiktionary REST API) and local/offline dictionary providers (Hunspell-compatible .dic/.aff files loaded via nspell). Local dictionaries are checked first for faster lookups without network dependency. Consumers can pass custom providers, use the built-in online providers, or supply Hunspell dictionary files for fully offline spell-check and word suggestion capabilities.

## Glossary

- **Reader**: The main Qari React component that renders ebook content and orchestrates services
- **Dictionary_Popover**: The popup UI component that displays word definitions to the user
- **Dictionary_Service**: The internal service that routes lookup requests to registered providers, checking local providers before online providers
- **Dictionary_Provider**: A plugin interface that implements word lookup for specific languages
- **FreeDictionary_Provider**: A built-in online provider that uses the Free Dictionary API (dictionaryapi.dev) for lookups
- **Wiktionary_Provider**: A built-in online provider that uses the Wikimedia REST API to fetch definitions from Wiktionary
- **Hunspell_Provider**: A built-in local/offline provider that loads Hunspell-compatible .dic/.aff dictionary files via nspell and provides spell checking and word suggestions
- **Selection_Handler**: The internal mechanism that detects text selection and triggers dictionary lookup
- **Context_Menu**: The browser right-click or long-press menu that appears on text selection
- **Word**: A single whitespace-delimited or language-appropriate token selected by the user
- **Dictionary_Buffer**: A pre-loaded ArrayBuffer or Uint8Array containing the binary content of a .dic or .aff file
- **Spell_Check_Result**: An object indicating whether a word is correctly spelled and providing suggestions for misspelled words

## Requirements

### Requirement 1: Text Selection Detection

**User Story:** As a reader, I want to select a word in the ebook content, so that I can look up its meaning without leaving the reading interface.

#### Acceptance Criteria

1. WHEN the user selects text within the Reader content area and right-clicks (desktop) or long-presses (touch), THE Selection_Handler SHALL extract the selected word from the text selection.
2. WHEN the user selects multiple words, THE Selection_Handler SHALL use the first word of the selection for lookup.
3. WHEN the selection is empty or contains only whitespace, THE Selection_Handler SHALL not trigger a dictionary lookup.
4. THE Selection_Handler SHALL determine the character position of the selected word within the chapter text body.

### Requirement 2: Dictionary Popup Display

**User Story:** As a reader, I want to see word definitions in a popup near the selected text, so that I can quickly understand unfamiliar words.

#### Acceptance Criteria

1. WHEN a dictionary lookup is triggered, THE Dictionary_Popover SHALL appear positioned near the selected text anchor point.
2. WHILE the Dictionary_Popover is visible, THE Dictionary_Popover SHALL display the word, its language, part of speech, definition, and example sentences when available.
3. WHEN the user clicks outside the Dictionary_Popover or presses Escape, THE Dictionary_Popover SHALL close.
4. WHEN a lookup is in progress, THE Dictionary_Popover SHALL display a loading indicator.
5. IF the dictionary lookup fails or the word is not found, THEN THE Dictionary_Popover SHALL display an appropriate message indicating no definition was found.
6. WHEN the Hunspell_Provider reports the word is misspelled, THE Dictionary_Popover SHALL display a "misspelled" indicator and show suggested corrections from the Hunspell_Provider.

### Requirement 3: Dictionary Provider Props

**User Story:** As a library consumer, I want to pass dictionary providers via props, so that I can customize which dictionaries are available in my reader instance.

#### Acceptance Criteria

1. THE Reader SHALL accept an optional `dictionaryProviders` prop containing an array of DictionaryProvider instances.
2. WHEN `dictionaryProviders` are supplied, THE Dictionary_Service SHALL register each provider in the order given.
3. WHEN no `dictionaryProviders` are supplied and no `enableBuiltInDictionary` prop is set to true and no `hunspellDictionaries` prop is supplied, THE Dictionary_Service SHALL have no registered providers and dictionary lookup SHALL be disabled.
4. WHEN multiple providers support the same language, THE Dictionary_Service SHALL use the first matching provider in registration order.

### Requirement 4: Built-in Free Dictionary API Provider

**User Story:** As a library consumer, I want a ready-to-use online dictionary provider included with Qari, so that I can enable dictionary lookup without building my own provider.

#### Acceptance Criteria

1. THE FreeDictionary_Provider SHALL implement the DictionaryProvider interface with id "free-dictionary-api".
2. THE FreeDictionary_Provider SHALL support English ("en") lookups using the Free Dictionary API at `https://api.dictionaryapi.dev/api/v2/entries/{language}/{word}`.
3. WHEN a successful response is received, THE FreeDictionary_Provider SHALL map the API response to the DictionaryResult format including word, definitions with meanings, parts of speech, and example sentences.
4. IF the API returns a 404 response, THEN THE FreeDictionary_Provider SHALL return a DictionaryResult with `notFound` set to true.
5. IF the API request fails due to network error or timeout, THEN THE FreeDictionary_Provider SHALL throw an error to be handled by the Dictionary_Service.
6. THE FreeDictionary_Provider SHALL set a request timeout of 5000 milliseconds.

### Requirement 5: Built-in Wiktionary REST API Provider

**User Story:** As a library consumer, I want a multilingual online dictionary provider backed by Wiktionary, so that I can support word lookups in many languages beyond English.

#### Acceptance Criteria

1. THE Wiktionary_Provider SHALL implement the DictionaryProvider interface with id "wiktionary-rest".
2. THE Wiktionary_Provider SHALL accept a list of supported language codes at construction time.
3. WHEN a lookup is requested, THE Wiktionary_Provider SHALL query the Wikimedia REST API at `https://{language}.wiktionary.org/api/rest_v1/page/definition/{word}`.
4. WHEN a successful response is received, THE Wiktionary_Provider SHALL extract definitions, parts of speech, and examples from the response and map them to the DictionaryResult format.
5. IF the API returns a 404 response, THEN THE Wiktionary_Provider SHALL return a DictionaryResult with `notFound` set to true.
6. IF the API request fails due to network error or timeout, THEN THE Wiktionary_Provider SHALL throw an error to be handled by the Dictionary_Service.
7. THE Wiktionary_Provider SHALL set a request timeout of 5000 milliseconds.
8. THE Wiktionary_Provider SHALL strip HTML tags from definition text before returning results.

### Requirement 6: Hunspell Local Dictionary Provider

**User Story:** As a library consumer, I want to load Hunspell .dic/.aff dictionary files so that users can get spell checking and word suggestions offline without any network dependency.

#### Acceptance Criteria

1. THE Hunspell_Provider SHALL implement the DictionaryProvider interface with id "hunspell-local".
2. THE Hunspell_Provider SHALL load dictionary data from Hunspell-compatible .aff (affix) and .dic (dictionary) file pairs using nspell or an equivalent browser-compatible library.
3. THE Hunspell_Provider SHALL accept dictionary data as either pre-loaded buffers (ArrayBuffer or Uint8Array for both .aff and .dic content) or as URLs from which to fetch the files.
4. WHEN dictionary data is provided as URLs, THE Hunspell_Provider SHALL fetch the .aff and .dic files and cache them in memory after the initial load.
5. WHEN dictionary data is provided as pre-loaded buffers, THE Hunspell_Provider SHALL initialize immediately without network requests.
6. WHEN the Hunspell_Provider has completed loading dictionary data, THE Hunspell_Provider SHALL operate fully offline for all subsequent lookups without requiring network access.
7. THE Hunspell_Provider SHALL accept a language code at construction time to identify which language the loaded dictionary supports.
8. WHEN a word lookup is requested, THE Hunspell_Provider SHALL check whether the word is correctly spelled and return a DictionaryResult containing the spell-check status.
9. WHEN a word is misspelled, THE Hunspell_Provider SHALL return suggested corrections in the DictionaryResult definitions array.
10. WHEN a word is correctly spelled, THE Hunspell_Provider SHALL return a DictionaryResult with a definition indicating the word is valid, with `notFound` set to false.
11. IF dictionary files fail to load from URLs due to network error, THEN THE Hunspell_Provider SHALL throw an error during initialization and report the failure via the onError callback.
12. IF dictionary files contain invalid or corrupt data, THEN THE Hunspell_Provider SHALL throw an error during initialization with a descriptive message.

### Requirement 7: Hunspell Dictionary Props

**User Story:** As a library consumer, I want to pass Hunspell dictionary configurations via props, so that I can easily set up offline dictionaries for my reader instance.

#### Acceptance Criteria

1. THE Reader SHALL accept an optional `hunspellDictionaries` prop containing an array of Hunspell dictionary configurations.
2. EACH Hunspell dictionary configuration SHALL specify a language code and either pre-loaded buffers (aff and dic as ArrayBuffer or Uint8Array) or URLs (affUrl and dicUrl as strings) for the dictionary files.
3. WHEN `hunspellDictionaries` are supplied, THE Reader SHALL instantiate a Hunspell_Provider for each configuration and register them with the Dictionary_Service.
4. WHEN both `hunspellDictionaries` and `dictionaryProviders` are supplied, THE Reader SHALL register Hunspell providers before the user-supplied online providers.
5. WHEN both `hunspellDictionaries` and `enableBuiltInDictionary` are supplied, THE Reader SHALL register Hunspell providers first, then user-supplied providers, then built-in online providers.

### Requirement 8: Local-First Provider Priority

**User Story:** As a reader, I want local dictionary lookups to be checked before online providers, so that lookups are fast and work offline when local dictionaries are available.

#### Acceptance Criteria

1. THE Dictionary_Service SHALL categorize providers as either "local" (offline-capable) or "online" (requires network).
2. WHEN a lookup is requested and both local and online providers support the requested language, THE Dictionary_Service SHALL query local providers first.
3. WHEN a local provider returns a successful result (word found or spell-check result), THE Dictionary_Service SHALL return that result without querying online providers.
4. WHEN a local provider indicates the word is correctly spelled but provides no definition, AND an online provider supports the same language, THE Dictionary_Service SHALL query the online provider for a full definition and merge the spell-check status with the definition result.
5. WHEN no local provider supports the requested language, THE Dictionary_Service SHALL fall through to online providers.

### Requirement 9: Spell Check Capability

**User Story:** As a reader, I want misspelled words to be identified and suggestions offered, so that I can understand whether an unfamiliar word is a typo or a real word I do not know.

#### Acceptance Criteria

1. THE Hunspell_Provider SHALL expose a `spellCheck` method that accepts a word and returns a Spell_Check_Result containing a boolean `correct` field and an array of `suggestions`.
2. WHEN the `spellCheck` method receives a correctly spelled word, THE Hunspell_Provider SHALL return `correct` as true and an empty suggestions array.
3. WHEN the `spellCheck` method receives a misspelled word, THE Hunspell_Provider SHALL return `correct` as false and an array of up to 10 suggested corrections.
4. THE Dictionary_Popover SHALL display the spell-check status when a Hunspell_Provider result is available, showing a checkmark icon for correct words and a warning icon with suggestions for misspelled words.
5. WHEN the user selects a suggestion from the spell-check suggestions list, THE Dictionary_Popover SHALL trigger a new lookup for the selected suggestion word.

### Requirement 10: Enable Built-in Dictionary Prop

**User Story:** As a library consumer, I want a simple boolean prop to enable built-in online dictionaries, so that I can get dictionary functionality without manually instantiating providers.

#### Acceptance Criteria

1. THE Reader SHALL accept an optional `enableBuiltInDictionary` prop of type boolean, defaulting to false.
2. WHEN `enableBuiltInDictionary` is true and no `dictionaryProviders` are supplied, THE Reader SHALL instantiate and register the FreeDictionary_Provider and the Wiktionary_Provider with default languages ("en", "fr", "es", "de", "it", "pt", "ru").
3. WHEN both `enableBuiltInDictionary` is true and `dictionaryProviders` are supplied, THE Reader SHALL register the user-supplied providers first, followed by the built-in providers.
4. WHEN `enableBuiltInDictionary` is false and no `dictionaryProviders` are supplied and no `hunspellDictionaries` are supplied, THE Reader SHALL not enable dictionary functionality and the Selection_Handler SHALL not listen for selection events.

### Requirement 11: Context Menu Integration

**User Story:** As a reader, I want to trigger dictionary lookup through right-click or long-press, so that it integrates naturally with my device interaction patterns.

#### Acceptance Criteria

1. WHEN the user right-clicks on selected text within the Reader content area (desktop), THE Selection_Handler SHALL prevent the default browser context menu and trigger a dictionary lookup.
2. WHEN the user long-presses on text within the Reader content area (touch devices), THE Selection_Handler SHALL trigger a dictionary lookup after the selection is complete.
3. WHILE no dictionary providers are registered, THE Selection_Handler SHALL not intercept right-click or long-press events and SHALL allow the default browser behavior.
4. THE Selection_Handler SHALL distinguish between a right-click on selected text (triggers lookup) and a right-click on unselected content (allows default browser context menu).

### Requirement 12: Loading and Error States

**User Story:** As a reader, I want clear feedback when a lookup is in progress or fails, so that I know the system is responding to my action.

#### Acceptance Criteria

1. WHEN a dictionary lookup is initiated, THE Dictionary_Popover SHALL display a loading state within 100 milliseconds of the user action.
2. WHEN the lookup completes successfully, THE Dictionary_Popover SHALL replace the loading state with the definition results.
3. IF a lookup fails due to network error, THEN THE Dictionary_Popover SHALL display an error message indicating the lookup failed.
4. IF a lookup returns no results, THEN THE Dictionary_Popover SHALL display a "not found" message with the searched word.
5. WHEN a new lookup is triggered while a previous lookup is still in progress, THE Dictionary_Service SHALL cancel the previous request and process the new one.
6. WHILE the Hunspell_Provider is loading dictionary files from URLs, THE Dictionary_Service SHALL mark the provider as unavailable and fall through to online providers until loading completes.

### Requirement 13: Keyboard Dismissal and Accessibility

**User Story:** As a reader using assistive technology, I want the dictionary popup to be accessible, so that I can use it with keyboard navigation and screen readers.

#### Acceptance Criteria

1. WHEN the Dictionary_Popover is visible, THE Dictionary_Popover SHALL be focusable and announced as a dialog by screen readers.
2. WHEN the user presses the Escape key while the Dictionary_Popover is visible, THE Dictionary_Popover SHALL close and return focus to the previously focused element.
3. THE Dictionary_Popover SHALL include an aria-label describing its content (the looked-up word).
4. THE Dictionary_Popover SHALL trap focus within itself while visible, allowing Tab navigation between its interactive elements.
5. WHEN spell-check suggestions are displayed, THE Dictionary_Popover SHALL present them as an accessible list with aria-label "Spelling suggestions" allowing keyboard selection.
