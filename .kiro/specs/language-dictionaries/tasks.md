# Implementation Plan: Language Dictionaries

## Overview

This plan implements built-in language dictionary support for the Qari ebook reader. The implementation extends the existing dictionary infrastructure with two REST API providers (Free Dictionary API and Wiktionary), adds a local/offline Hunspell-based spell-checking provider via `nspell`, enhances `DictionaryService` with local-first provider routing and spell-check result merging, adds a text selection handler hook, and enhances the `DictionaryPopover` with loading/error/spell-check states and accessibility improvements. Tasks are ordered to build foundational utilities first, then providers (local and online), then service enhancements, then the selection hook, and finally integration into the Reader component.

## Tasks

- [x] 1. Install dependencies and extend interfaces
  - [x] 1.1 Install nspell and extend DictionaryProvider interface
    - Install `nspell` as a runtime dependency and `@types/nspell` as a dev dependency
    - Modify `src/interfaces/dictionary.ts`:
      - Add optional `category?: 'local' | 'online'` field to `DictionaryProvider`
      - Add optional `ready?: boolean` field to `DictionaryProvider`
      - Add optional `signal?: AbortSignal` parameter to `lookup` method
      - Add `SpellCheckResult` interface with `correct: boolean` and `suggestions: string[]`
      - Add optional `spellCheck?: SpellCheckResult` field to `DictionaryResult`
    - Ensure backward compatibility — existing providers without new fields still work
    - _Requirements: 6.2, 8.1, 9.1, 12.5_

  - [x] 1.2 Create HTML tag stripping utility
    - Create `src/utils/strip-html.ts` with a `stripHtmlTags(input: string): string` function
    - Use regex to remove all HTML tags while preserving text content
    - Handle edge cases: self-closing tags, nested tags, empty strings
    - _Requirements: 5.8_

  - [x] 1.3 Write property test for HTML stripping (Property 11)
    - **Property 11: HTML tag stripping is correct and idempotent**
    - Create `src/utils/__tests__/strip-html.property.test.ts`
    - Generate random strings with HTML tags, verify all tags removed and text preserved
    - Verify idempotence: applying strip twice equals applying once
    - **Validates: Requirements 5.8**

- [x] 2. Implement HunspellProvider
  - [x] 2.1 Create HunspellProvider class
    - Create `src/services/hunspell-provider.ts`
    - Implement `DictionaryProvider` interface with id `"hunspell-local"` and `category: "local"`
    - Accept `HunspellProviderConfig` at construction: language code, aff/dic data (Buffer/ArrayBuffer/Uint8Array or URLs)
    - Initialize nspell instance from provided .aff and .dic data
    - When data provided as buffers: initialize immediately, set `ready = true`
    - When data provided as URLs: fetch files asynchronously, set `ready = false` until loaded, cache in memory
    - Implement `lookup(word, language, context, signal?)`:
      - Call `nspell.correct(word)` to check spelling
      - If correct: return `DictionaryResult` with `notFound: false`, `spellCheck: { correct: true, suggestions: [] }`
      - If misspelled: call `nspell.suggest(word)`, cap at 10 suggestions, return `DictionaryResult` with `spellCheck: { correct: false, suggestions }`
    - Catch errors from nspell (e.g., extremely long input) and return "lookup failed" result
    - Throw error during initialization if files fail to load or data is corrupt
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

  - [x] 2.2 Write property test for Hunspell correct words (Property 12)
    - **Property 12: Hunspell correct words return valid result**
    - Create `src/services/__tests__/hunspell-correct.property.test.ts`
    - Mock nspell instance with `correct()` returning true
    - Generate random words; verify result has `notFound: false`, `spellCheck.correct: true`, empty suggestions
    - **Validates: Requirements 6.10, 9.2**

  - [x] 2.3 Write property test for Hunspell misspelled words (Property 13)
    - **Property 13: Hunspell misspelled words return capped suggestions**
    - Create `src/services/__tests__/hunspell-misspelled.property.test.ts`
    - Mock nspell instance with `correct()` returning false and `suggest()` returning variable-length arrays
    - Generate random words with varying suggestion counts; verify `spellCheck.correct: false` and suggestions capped at 10
    - **Validates: Requirements 6.9, 9.3**

  - [x] 2.4 Write unit tests for HunspellProvider
    - Create `src/services/hunspell-provider.test.ts`
    - Test initialization with buffers (immediate ready)
    - Test initialization with URLs (async fetch, ready after load)
    - Test correct word lookup returns spellCheck.correct = true
    - Test misspelled word returns suggestions capped at 10
    - Test initialization failure with invalid data throws error
    - Test nspell error during lookup returns graceful error result
    - _Requirements: 6.3, 6.4, 6.5, 6.8, 6.9, 6.10, 6.11, 6.12_

- [x] 3. Implement FreeDictionaryProvider
  - [x] 3.1 Create FreeDictionaryProvider class
    - Create `src/services/free-dictionary-provider.ts`
    - Implement `DictionaryProvider` interface with id `"free-dictionary-api"` and `category: "online"`
    - Set `supportedLanguages` to `["en"]`
    - Implement `lookup()` method: construct URL as `https://api.dictionaryapi.dev/api/v2/entries/{language}/{word}`
    - Map API response to `DictionaryResult` format: extract meanings, definitions, parts of speech, examples
    - Handle 404 → return `{ notFound: true }`
    - Handle network/timeout errors → throw error
    - Set 5000ms timeout using AbortController
    - Support optional `signal` parameter for external cancellation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 3.2 Write property test for FreeDictionary response mapping (Property 8)
    - **Property 8: FreeDictionary API response mapping preserves content**
    - Create `src/services/__tests__/free-dictionary-mapping.property.test.ts`
    - Generate random valid FreeDictionary API response shapes
    - Verify every meaning's partOfSpeech is preserved in result
    - Verify every definition text appears as a Definition.meaning
    - Verify every example sentence appears in the corresponding Definition.examples
    - **Validates: Requirements 4.3**

  - [x] 3.3 Write unit tests for FreeDictionaryProvider
    - Create `src/services/free-dictionary-provider.test.ts`
    - Test successful lookup with mocked fetch response
    - Test 404 handling returns notFound result
    - Test network timeout throws error
    - Test AbortSignal cancellation
    - _Requirements: 4.2, 4.4, 4.5, 4.6_

- [x] 4. Implement WiktionaryProvider
  - [x] 4.1 Create WiktionaryProvider class
    - Create `src/services/wiktionary-provider.ts`
    - Implement `DictionaryProvider` interface with id `"wiktionary-rest"` and `category: "online"`
    - Accept language list at construction time via config
    - Implement `lookup()` method: construct URL as `https://{language}.wiktionary.org/api/rest_v1/page/definition/{encodedWord}`
    - URI-encode the word in the URL
    - Map API response to `DictionaryResult` format: extract definitions, parts of speech, examples
    - Use `stripHtmlTags` on definition text before returning
    - Handle 404 → return `{ notFound: true }`
    - Handle network/timeout errors → throw error
    - Set 5000ms timeout using AbortController
    - Support optional `signal` parameter for external cancellation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x] 4.2 Write property test for Wiktionary URL construction (Property 9)
    - **Property 9: Wiktionary URL construction**
    - Create `src/services/__tests__/wiktionary-url.property.test.ts`
    - Generate random language codes and word strings
    - Verify URL is constructed as `https://{language}.wiktionary.org/api/rest_v1/page/definition/{encodedWord}`
    - **Validates: Requirements 5.3**

  - [x] 4.3 Write property test for Wiktionary response mapping (Property 10)
    - **Property 10: Wiktionary API response mapping preserves content**
    - Create `src/services/__tests__/wiktionary-mapping.property.test.ts`
    - Generate random valid Wiktionary API response shapes
    - Verify every definition's text content (after HTML stripping) appears as a Definition.meaning
    - Verify every partOfSpeech is preserved
    - Verify every example sentence is included
    - **Validates: Requirements 5.4**

  - [x] 4.4 Write unit tests for WiktionaryProvider
    - Create `src/services/wiktionary-provider.test.ts`
    - Test successful lookup with mocked fetch response
    - Test HTML stripping in definitions
    - Test 404 handling returns notFound result
    - Test network timeout throws error
    - Test URI encoding of special characters in word
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 5. Enhance DictionaryService with local-first routing, merging, and cancellation
  - [x] 5.1 Add provider category tracking and local-first routing to DictionaryService
    - Modify `src/services/dictionary-service.ts`
    - Add `ProviderEntry` internal type with `{ provider, category }` structure
    - Replace flat `providers` array with `ProviderEntry[]` registry
    - Add `registerProvider(provider, category?)` overload — defaults to `"online"` if no category
    - Implement local-first lookup routing:
      - Find local providers that support the language, query them first
      - If local provider returns misspelled result → return immediately
      - If local provider returns correct but no definition → query online provider and merge
      - If no local provider for language → fall through to online providers directly
    - Add `isProviderReady(providerId)` method
    - When a local provider has `ready === false`, skip it and fall through to online
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.6_

  - [x] 5.2 Add cancellation support to DictionaryService
    - Add `private currentAbortController: AbortController | null` field
    - Add `cancelCurrentLookup()` method that aborts the current controller
    - In `lookup()`, cancel any in-progress request before starting a new one
    - Pass `AbortSignal` to the provider's `lookup()` call
    - Silently ignore `AbortError` (expected cancellation)
    - _Requirements: 12.5_

  - [x] 5.3 Write property test for local-first provider routing (Property 6)
    - **Property 6: Local-first provider routing**
    - Create `src/services/__tests__/local-first-routing.property.test.ts`
    - Generate random configurations with local + online providers supporting the same language
    - Verify local provider is always queried first
    - Verify online provider is NOT queried when local returns misspelled result
    - Verify online is queried when no local provider supports the language
    - **Validates: Requirements 8.2, 8.3, 8.5**

  - [x] 5.4 Write property test for spell-check merging (Property 7)
    - **Property 7: Spell-check merges with online definitions**
    - Create `src/services/__tests__/spellcheck-merge.property.test.ts`
    - Generate scenarios where local provider says word is correct (no definition) and online provider has definitions
    - Verify merged result contains `spellCheck.correct = true` AND definitions from online provider
    - **Validates: Requirements 8.4**

  - [x] 5.5 Write property test for provider registration order (Property 5)
    - **Property 5: Provider registration order and priority**
    - Create `src/services/__tests__/provider-ordering.property.test.ts`
    - Generate random ordered lists of providers with overlapping language support and categories
    - Verify registration order: Hunspell first, then user-supplied, then built-in online
    - Verify lookups route to the first provider in registration order supporting the requested language
    - **Validates: Requirements 3.2, 3.4, 7.4, 7.5, 10.3**

  - [x] 5.6 Write property test for lookup cancellation (Property 15)
    - **Property 15: Superseded lookup cancellation**
    - Create `src/services/__tests__/lookup-cancellation.property.test.ts`
    - Generate sequences of rapid lookup requests
    - Verify all lookups except the most recent are cancelled (AbortSignal aborted)
    - Verify only the final lookup's result is returned
    - **Validates: Requirements 12.5**

- [x] 6. Checkpoint - Core services and providers implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create useSelectionHandler hook
  - [x] 7.1 Implement word extraction utility
    - Create `src/hooks/useSelectionHandler.ts`
    - Implement helper function `extractWordAtSelection(selection: Selection): { word: string; position: number } | null`
    - Extract first whitespace-delimited token from selection text
    - Return null for empty or whitespace-only selections
    - Determine character position of word within chapter text body
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Implement selection event handling and hook logic
    - In `src/hooks/useSelectionHandler.ts`, implement the `useSelectionHandler` hook
    - Listen for `contextmenu` events (right-click) on the content area
    - Implement long-press detection for touch (touchstart/touchend with ~500ms threshold)
    - Prevent default context menu when text is selected and providers are registered
    - Allow default context menu when no text is selected or no providers registered
    - Compute anchor position from selection bounding rect
    - Manage `SelectionLookupState` (`idle` | `loading` | `success` | `error` | `not-found`)
    - Expose `{ anchorPosition, lookupState, triggerLookup, dismiss }` from hook
    - _Requirements: 1.1, 11.1, 11.2, 11.3, 11.4_

  - [x] 7.3 Write property tests for word extraction (Properties 1, 2, 3)
    - **Property 1: Word extraction position correctness**
    - **Property 2: Multi-word selection yields first token**
    - **Property 3: Whitespace-only selection rejection**
    - Create `src/hooks/__tests__/word-extraction.property.test.ts`
    - Generate random text bodies and positions; verify extracted word matches characters at position
    - Generate random multi-word strings; verify only first token returned
    - Generate whitespace-only strings; verify null/undefined returned
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 7.4 Write unit tests for useSelectionHandler
    - Create `src/hooks/useSelectionHandler.test.ts`
    - Test right-click on selected text triggers lookup
    - Test right-click without selection allows default behavior
    - Test long-press triggers lookup on touch
    - Test dismiss clears state
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 8. Enhance DictionaryPopover with loading, spell-check UI, and accessibility
  - [x] 8.1 Add loading state and keyboard dismiss to DictionaryPopover
    - Modify `src/components/DictionaryPopover.tsx`
    - Add `loading` prop — when true, display a loading spinner/skeleton
    - Add `useEffect` for Escape key listener that calls `onClose`
    - Implement focus trapping: Tab cycles within popover interactive elements
    - On close, restore focus to previously focused element
    - Update `aria-label` to dynamically include the looked-up word
    - _Requirements: 2.4, 12.1, 12.2, 13.1, 13.2, 13.3, 13.4_

  - [x] 8.2 Add spell-check display and suggestion interaction to DictionaryPopover
    - Modify `src/components/DictionaryPopover.tsx`
    - Add `spellCheck` display section:
      - When `spellCheck.correct === true`: render a checkmark icon (✓) indicating correct spelling
      - When `spellCheck.correct === false`: render a warning icon (⚠) with misspelled indicator
    - Render suggestions as an accessible list with `aria-label="Spelling suggestions"`
    - Each suggestion is a clickable button that triggers `onSuggestionSelect(word)` callback
    - Add `onSuggestionSelect?: (word: string) => void` prop
    - Ensure keyboard navigation within suggestions list
    - _Requirements: 2.6, 9.4, 9.5, 13.5_

  - [x] 8.3 Write property test for spell-check UI display (Property 14)
    - **Property 14: Spell-check UI display and accessibility**
    - Create `src/components/__tests__/popover-spellcheck.proper
    - Generate random `SpellCheckResult` objects (varying correct/incorrect, 0-10 suggestions)
    - Verify checkmark icon rendered when `correct === true`
    - Verify warning icon + suggestions list rendered when `correct === false`
    - Verify suggestions list has `aria-label="Spelling suggestions"`
    - **Validates: Requirements 2.6, 9.4, 13.5**

  - [x] 8.4 Write property test for popover field rendering (Property 4)
    - **Property 4: Popover renders all DictionaryResult fields**
    - Create `src/components/__tests__/popover-fields.property.test.ts`
    - Generate random valid DictionaryResult objects with definitions
    - Verify rendered output contains word, language, and every definition's meaning
    - Verify partOfSpeech appears when present; examples appear when present
    - **Validates: Requirements 2.2**

  - [x] 8.5 Write property test for accessible label (Property 16)
    - **Property 16: Accessible aria-label contains looked-up word**
    - Create `src/components/__tests__/popover-accessibility.property.test.ts`
    - Generate random non-empty word strings
    - Verify rendered element's aria-label contains the word
    - **Validates: Requirements 13.3**

  - [x] 8.6 Write unit tests for DictionaryPopover enhancements
    - Update `src/components/DictionaryPopover.test.tsx`
    - Test loading state renders spinner/skeleton
    - Test Escape key closes popover
    - Test focus trapping with Tab
    - Test aria-label includes word
    - Test spell-check correct shows checkmark
    - Test spell-check incorrect shows warning + suggestions
    - Test clicking suggestion triggers onSuggestionSelect callback
    - _Requirements: 2.4, 2.6, 9.4, 9.5, 12.1, 13.2, 13.3, 13.4, 13.5_

- [x] 9. Checkpoint - UI and hook implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrate everything into the Reader component
  - [x] 10.1 Add hunspellDictionaries and enableBuiltInDictionary props and wire up in Reader
    - Modify `src/components/Reader.tsx`
    - Add `hunspellDictionaries?: HunspellDictionaryConfig[]` prop
    - Add `enableBuiltInDictionary?: boolean` prop (default: false)
    - When `hunspellDictionaries` provided, instantiate `HunspellProvider` for each config and register as `"local"`
    - When `enableBuiltInDictionary` is true, instantiate `FreeDictionaryProvider` and `WiktionaryProvider` with default languages
    - Registration order: Hunspell providers → user `dictionaryProviders` → built-in online providers
    - Integrate `useSelectionHandler` hook — pass content area ref, providers status
    - Connect hook output to `DictionaryPopover`: pass `loading`, `lookupResult`, `anchorPosition`, `onClose`, `onSuggestionSelect`
    - `onSuggestionSelect` triggers a new lookup via DictionaryService for the selected suggestion word
    - Call `DictionaryService.cancelCurrentLookup()` when new lookup starts
    - When no providers registered, don't attach selection listeners
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.1, 7.2, 7.3, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4, 12.5, 12.6_

  - [x] 10.2 Write integration tests for full dictionary flow
    - Create `src/components/__tests__/dictionary-integration.test.tsx`
    - Test: select word → right-click → loading shown → definition appears (mocked fetch)
    - Test: enableBuiltInDictionary registers providers correctly
    - Test: hunspellDictionaries registers local providers before online
    - Test: user providers take priority over built-in
    - Test: no providers → no event listeners attached
    - Test: Hunspell misspelled word → suggestions shown → click suggestion → new lookup
    - Test: local-first flow: Hunspell returns spell-correct, online provides definition, merged display
    - _Requirements: 3.2, 3.3, 7.4, 7.5, 8.2, 8.4, 9.5, 10.2, 10.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest + fast-check for property testing and @testing-library/react for component tests
- All providers use native `fetch` API — no external HTTP dependencies needed
- The `nspell` package is the runtime dependency for Hunspell support; `@types/nspell` provides type definitions
- The AbortSignal parameter on DictionaryProvider is optional for backward compatibility
- Local-first routing ensures offline Hunspell lookups are attempted before any network calls
- Spell-check merging combines local correctness info with online definitions for a richer UX

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "4.2", "4.3", "4.4"] },
    { "id": 3, "tasks": ["5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "5.6", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] },
    { "id": 6, "tasks": ["7.4", "8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 8, "tasks": ["8.6", "10.1"] },
    { "id": 9, "tasks": ["10.2"] }
  ]
}
```
