# Implementation Plan: Bookmarks Property

## Overview

This plan implements the pluggable bookmark store architecture for the Qari ebook reader. It introduces the `BookmarkStoreInterface`, three store implementations (LocalStorageStore, IndexedDBStore, HookStore), updated Reader props for externally-controlled bookmark state, and bookmark navigation from the BookmarkPanel. Tasks are ordered so that foundational interfaces come first, store implementations second, Reader integration third, and navigation last.

## Tasks

- [x] 1. Define BookmarkStoreInterface and update exports
  - [x] 1.1 Create BookmarkStoreInterface and BookmarkChangeEvent types
    - Create `src/interfaces/bookmark-store.ts` defining the `BookmarkStoreInterface` (save, load, list, remove, update methods) extending `CustomStoreAdapter` with the `update` method
    - Define `BookmarkChangeEvent` interface with `type: 'created' | 'deleted' | 'renamed'` and `bookmark: Bookmark`
    - Define `HookStoreCallbacks` interface with optional onSave, onLoad, onList, onRemove, onUpdate callbacks
    - Export all types from `src/interfaces/index.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 4.2_

- [x] 2. Implement LocalStorageStore
  - [x] 2.1 Implement LocalStorageStore class
    - Create `src/services/local-storage-store.ts` implementing `BookmarkStoreInterface`
    - Use configurable key prefix (default `qari-`), storing all bookmarks as a single JSON array
    - Implement `save`: append to collection, enforce 50 bookmark per-book limit, reject on quota/unavailability
    - Implement `load`: filter by bookId, return empty array for corrupted JSON
    - Implement `list`: return all bookmarks, return empty array for corrupted JSON
    - Implement `remove`: reject with "bookmark not found" if id doesn't exist
    - Implement `update`: replace matching bookmark, reject if id not found, set updatedAt
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [x] 2.2 Write property tests for LocalStorageStore (Properties 1-3, 5-7)
    - **Property 1: Save/Load Round-Trip** — save a bookmark, load by bookId, verify all fields match
    - **Property 2: Load Filters by BookId** — save across multiple bookIds, verify load returns only matching
    - **Property 3: Remove Then Absent** — save then remove, verify absent from load
    - **Property 5: Update Reflected in Load** — save then update, verify updated fields in load
    - **Property 6: Update Non-Existent Rejects** — update a non-existent id, verify rejection
    - **Property 7: Corrupted Storage Recovery** — corrupt localStorage, verify load/list return empty and save succeeds after
    - Write in `src/services/__tests__/bookmark-store-roundtrip.property.test.ts`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.10, 2.11**

  - [x] 2.3 Write unit tests for LocalStorageStore edge cases
    - Test quota exceeded error handling
    - Test localStorage unavailability (throws on setItem)
    - Test 50-bookmark per-book limit boundary
    - Test remove non-existent rejects with descriptive error
    - Write in `src/services/local-storage-store.test.ts`
    - _Requirements: 2.6, 2.9, 2.10_

- [x] 3. Implement IndexedDBStore
  - [x] 3.1 Implement IndexedDBStore class
    - Create `src/services/indexeddb-store.ts` implementing `BookmarkStoreInterface`
    - Open/create IndexedDB database (`qari-bookmarks-db`) with object store (`bookmarks`, keyPath: `id`) and `bookId` index
    - Implement `save`: use `put` for upsert semantics
    - Implement `load`: query via bookId index
    - Implement `list`: return all records
    - Implement `remove`: delete by id, resolve without error if id doesn't exist
    - Implement `update`: use `put` to replace record (verify existence first, reject if not found)
    - Include operation name in all error messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 3.2 Write property tests for IndexedDBStore (Properties 1-4)
    - **Property 1: Save/Load Round-Trip** — verify round-trip through IndexedDB
    - **Property 2: Load Filters by BookId** — verify filtering by bookId index
    - **Property 3: Remove Then Absent** — verify removal
    - **Property 4: Remove Non-Existent Resolves Gracefully** — verify no error on missing id
    - Write in `src/services/__tests__/bookmark-store-roundtrip.property.test.ts` (extend existing file)
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 3.3, 3.4, 3.5, 3.7, 3.9**

  - [x] 3.3 Write unit tests for IndexedDBStore
    - Test database initialization and schema creation
    - Test connection failure error format (includes operation name)
    - Test transaction error handling
    - Write in `src/services/indexeddb-store.test.ts`
    - _Requirements: 3.6, 3.8_

- [x] 4. Implement HookStore
  - [x] 4.1 Implement HookStore class
    - Create `src/services/hook-store.ts` implementing `BookmarkStoreInterface`
    - Accept `HookStoreCallbacks` in constructor
    - Each method delegates to corresponding callback, passing exact arguments
    - Missing callback → reject with "operation not supported" error
    - Callback errors propagate directly to caller (no wrapping)
    - No local caching — every call delegates to callback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 4.2 Write property tests for HookStore (Properties 8-10)
    - **Property 8: HookStore Delegates to Callbacks** — verify each method invokes correct callback with exact args and returns unmodified value
    - **Property 9: Missing Callback Rejects** — verify missing callback rejects with "not supported" error
    - **Property 10: Callback Error Propagation** — verify callback errors propagate with same message/type
    - Write in `src/services/__tests__/hook-store-delegation.property.test.ts`
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**

  - [x] 4.3 Write unit tests for HookStore
    - Test individual callback invocation with specific examples
    - Test partial callback configuration (some ops supported, some not)
    - Write in `src/services/hook-store.test.ts`
    - _Requirements: 4.3, 4.6_

- [x] 5. Checkpoint - Verify store implementations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update Reader component with bookmarks prop and store selection
  - [x] 6.1 Add bookmarks, bookmarkStore, and onBookmarkChange props to Reader
    - Update `ReaderProps` interface in `src/components/Reader.tsx` to add `bookmarks?: Bookmark[]`, `bookmarkStore?: BookmarkStoreInterface`, and `onBookmarkChange?: (event: BookmarkChangeEvent) => void`
    - Implement prop-driven bookmark state: if `bookmarks` prop provided, use it directly; skip store load
    - Implement reactivity: when `bookmarks` prop reference changes, sync displayed state immediately
    - When `bookmarks` prop is undefined, load from configured `bookmarkStore` (default to LocalStorageStore)
    - When `bookmarkStore` prop changes, use new store for subsequent operations
    - When `bookmarkStore` reverts to undefined, fall back to LocalStorageStore
    - Fire `onBookmarkChange` callback on create/delete/rename when `bookmarks` prop is provided
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Write property tests for bookmarks prop behavior (Properties 11-12)
    - **Property 11: Bookmarks Prop Controls Display** — verify prop value equals displayed collection, prop change updates display
    - **Property 12: Bookmarks Prop Skips Store Load** — verify store.load is NOT called when bookmarks prop is defined
    - Write in `src/components/__tests__/bookmarks-prop-control.property.test.ts`
    - **Validates: Requirements 5.2, 5.5, 5.6, 6.1, 6.2**

  - [x] 6.3 Write unit tests for Reader bookmark integration
    - Test default store selection (LocalStorageStore when no bookmarkStore prop)
    - Test controlled mode (bookmarks prop provided) vs uncontrolled mode
    - Test store hot-swap when bookmarkStore prop changes
    - Test onBookmarkChange fires correctly
    - Write in `src/components/Reader.test.tsx` (extend existing)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Implement bookmark navigation in BookmarkPanel
  - [x] 7.1 Add navigation logic to BookmarkPanel
    - Update `src/components/BookmarkPanel.tsx` to handle bookmark click navigation
    - On bookmark click: look up `chapterId` in book chapters
    - If chapter not found → show error, stay on current page
    - Calculate target page: `Math.floor(position / charsPerPage)`
    - If position > chapter char count → navigate to last page of chapter
    - Update `currentChapterIdx` and `currentPage` state via a new callback prop or context method
    - Fire `onPageChange` callback with new position
    - Recalculate and update reading progress
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 7.2 Write property tests for BookmarkPanel filtering and navigation (Properties 13-17)
    - **Property 13: BookmarkPanel Filters by Current Book** — verify only current book's bookmarks rendered
    - **Property 14: Bookmark Navigation Resolves to Correct Chapter and Page** — verify correct chapter/page from chapterId and position
    - **Property 15: Invalid Chapter Navigation Shows Error** — verify error shown and page unchanged for invalid chapterId
    - **Property 16: Position Overflow Clamps to Last Page** — verify overflow position navigates to last page
    - **Property 17: Navigation Updates Progress and Fires Callback** — verify progress calculation and onPageChange callback
    - Write in `src/components/__tests__/bookmark-navigation.property.test.ts`
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

  - [x] 7.3 Write unit tests for BookmarkPanel navigation
    - Test click handling with specific bookmark examples
    - Test error display for invalid chapter navigation
    - Test last-page clamping with specific position values
    - Write in `src/components/BookmarkPanel.test.tsx` (extend existing)
    - _Requirements: 8.2, 8.4, 8.5_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All store implementations share the same `BookmarkStoreInterface` contract
- The existing `BookmarkStore` class and `bookmarkAdapter` prop remain functional for backward compatibility
- `fast-check` is already in devDependencies — no new test dependency needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.2", "4.3"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3"] }
  ]
}
```
