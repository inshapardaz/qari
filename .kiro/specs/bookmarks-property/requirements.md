# Requirements Document

## Introduction

This feature enhances the bookmark system in the Qari ebook reader. It introduces a pluggable bookmark store architecture with a common interface, enabling multiple storage backends. The Reader component exposes a `bookmarks` property for supplying initial bookmarks, and delegates persistence to whichever store implementation is configured. Three implementations are provided: localStorage (default), IndexedDB, and a hook-based adapter for server-side persistence via HTTP.

## Glossary

- **Reader**: The main React component (`Reader.tsx`) that orchestrates book rendering, navigation, and state management.
- **Bookmark**: A data object representing a saved position in a book, conforming to the `Bookmark` interface (id, bookId, chapterId, position, name, createdAt, updatedAt?).
- **Bookmarks_Property**: An optional prop on the Reader component that accepts an array of `Bookmark` objects to use as the initial bookmark collection.
- **Bookmark_Store_Interface**: An abstract interface that defines CRUD operations for bookmark persistence. Multiple implementations can conform to this interface.
- **LocalStorage_Store**: The default Bookmark_Store_Interface implementation that serializes all bookmarks as a single JSON string in the browser localStorage.
- **IndexedDB_Store**: A Bookmark_Store_Interface implementation that persists bookmarks in the browser IndexedDB.
- **Hook_Store**: A Bookmark_Store_Interface implementation that invokes user-provided callback functions for each CRUD operation, enabling the consumer to persist bookmarks on a remote server via HTTP calls.
- **Empty_Collection**: An empty array (`[]`) representing the absence of bookmarks.
- **BookmarkPanel**: The React UI component that displays the browseable list of bookmarks for the current book, with support for creating, renaming, deleting, and navigating to bookmarks.

## Requirements

### Requirement 1: Bookmark Store Interface

**User Story:** As a library developer, I want a common interface for bookmark storage, so that multiple persistence backends can be used interchangeably.

#### Acceptance Criteria

1. THE Bookmark_Store_Interface SHALL define a `save` method that accepts a Bookmark object and returns a Promise resolving to void when the bookmark is persisted.
2. THE Bookmark_Store_Interface SHALL define a `load` method that accepts a bookId string and returns a Promise resolving to an array of Bookmark objects for that book, returning an empty array if no bookmarks exist for the given bookId.
3. THE Bookmark_Store_Interface SHALL define a `remove` method that accepts a bookmarkId string and returns a Promise that resolves to void when the bookmark is deleted.
4. IF the `remove` method is called with a bookmarkId that does not exist in the store, THEN THE Bookmark_Store_Interface SHALL resolve the Promise without error.
5. THE Bookmark_Store_Interface SHALL define a `list` method that returns a Promise resolving to an array of all stored Bookmark objects, returning an empty array if no bookmarks exist.
6. THE Bookmark_Store_Interface SHALL define an `update` method that accepts a Bookmark object and returns a Promise resolving to void when the bookmark is updated.
7. IF the `update` method is called with a Bookmark whose id does not exist in the store, THEN THE Bookmark_Store_Interface SHALL reject the Promise with an error indicating the bookmark was not found.

### Requirement 2: LocalStorage Store Implementation

**User Story:** As a library consumer, I want bookmarks persisted in localStorage by default, so that bookmarks survive page reloads without additional configuration.

#### Acceptance Criteria

1. THE LocalStorage_Store SHALL implement the Bookmark_Store_Interface.
2. THE LocalStorage_Store SHALL serialize all bookmarks for a given bookId as a single JSON string value in localStorage, using a consistent key prefix to namespace entries.
3. WHEN the `save` method is called, THE LocalStorage_Store SHALL add the bookmark to the stored collection and persist the updated JSON string.
4. WHEN the `load` method is called, THE LocalStorage_Store SHALL parse the JSON string from localStorage and return bookmarks matching the provided bookId.
5. WHEN the `remove` method is called, THE LocalStorage_Store SHALL remove the bookmark with the matching id from the stored collection and persist the updated JSON string.
6. IF localStorage is unavailable or throws an error, THEN THE LocalStorage_Store SHALL reject the Promise with an error message indicating the nature of the failure (e.g., storage unavailable or quota exceeded).
7. WHEN the `list` method is called, THE LocalStorage_Store SHALL return all bookmarks across all books stored in localStorage.
8. WHEN the `update` method is called, THE LocalStorage_Store SHALL replace the existing bookmark with the matching id and persist the updated JSON string.
9. IF the `save` method is called and the stored collection for the target bookId already contains 50 bookmarks, THEN THE LocalStorage_Store SHALL reject the Promise with an error message indicating the per-book limit has been reached.
10. IF the `remove` or `update` method is called with an id that does not exist in the stored collection, THEN THE LocalStorage_Store SHALL reject the Promise with an error message indicating the bookmark was not found.
11. IF the stored JSON string in localStorage is corrupted or unparseable, THEN THE LocalStorage_Store SHALL treat the stored collection as empty and continue the operation without throwing.

### Requirement 3: IndexedDB Store Implementation

**User Story:** As a library consumer, I want bookmarks persisted in IndexedDB, so that large bookmark collections are handled efficiently without localStorage size limits.

#### Acceptance Criteria

1. THE IndexedDB_Store SHALL implement the CustomStoreAdapter interface (save, load, list, remove).
2. THE IndexedDB_Store SHALL store each bookmark as a separate record in an IndexedDB object store, using the bookmark `id` field as the object store key path and maintaining a `bookId` index for filtered queries.
3. WHEN the `save` method is called, THE IndexedDB_Store SHALL add the bookmark as a new record if no record with the same `id` exists, or replace the existing record if a record with the same `id` already exists.
4. WHEN the `load` method is called with a bookId, THE IndexedDB_Store SHALL query the object store using the bookId index and return all bookmark records matching that bookId.
5. WHEN the `remove` method is called, THE IndexedDB_Store SHALL delete the record matching the provided bookmarkId from the object store.
6. IF the IndexedDB connection fails or a transaction errors, THEN THE IndexedDB_Store SHALL reject the returned Promise with an Error whose message includes the operation name that failed and the underlying error reason.
7. WHEN the `list` method is called, THE IndexedDB_Store SHALL return all bookmark records from the object store.
8. WHEN the IndexedDB_Store is instantiated, THE IndexedDB_Store SHALL open (or create) the IndexedDB database and create the object store and bookId index if they do not already exist via an upgrade transaction.
9. IF the `remove` method is called with a bookmarkId that does not exist in the object store, THEN THE IndexedDB_Store SHALL resolve the Promise successfully without error.

### Requirement 4: Hook-Based Store Implementation

**User Story:** As a library consumer, I want to provide callback functions for bookmark persistence, so that I can store bookmarks on a remote server via HTTP calls.

#### Acceptance Criteria

1. THE Hook_Store SHALL implement the Bookmark_Store_Interface.
2. THE Hook_Store SHALL accept a configuration object with callback functions for each CRUD operation (onSave, onLoad, onRemove, onList, onUpdate).
3. WHEN the `save` method is called, THE Hook_Store SHALL invoke the `onSave` callback with the Bookmark object.
4. WHEN the `load` method is called, THE Hook_Store SHALL invoke the `onLoad` callback with the bookId and return the resulting Bookmark array.
5. WHEN the `remove` method is called, THE Hook_Store SHALL invoke the `onRemove` callback with the bookmarkId.
6. IF a callback function is not provided for an operation, THEN THE Hook_Store SHALL reject the Promise with an error indicating the operation is not supported.
7. WHEN the `list` method is called, THE Hook_Store SHALL invoke the `onList` callback and return the resulting Bookmark array.
8. WHEN the `update` method is called, THE Hook_Store SHALL invoke the `onUpdate` callback with the updated Bookmark object.
9. IF a callback rejects or throws an error, THEN THE Hook_Store SHALL propagate the error as a rejected Promise to the caller.

### Requirement 5: Bookmarks Property on Reader Component

**User Story:** As a library consumer, I want to pass bookmarks as a property to the Reader component, so that I can supply pre-loaded bookmarks from an external data source.

#### Acceptance Criteria

1. THE Reader SHALL accept an optional `bookmarks` prop of type `Bookmark[]`.
2. WHEN the `bookmarks` prop is provided with a non-empty array, THE Reader SHALL use the provided array as the initial bookmark collection in its state without modification.
3. WHEN the `bookmarks` prop is provided with an empty array, THE Reader SHALL initialize the bookmark collection as an Empty_Collection.
4. WHEN the `bookmarks` prop is not provided (undefined), THE Reader SHALL initialize the bookmark collection as an Empty_Collection and load bookmarks from the Bookmark_Store_Interface during book initialization.
5. WHEN the `bookmarks` prop is provided, THE Reader SHALL skip loading bookmarks from the Bookmark_Store_Interface during book initialization.
6. WHEN the `bookmarks` prop value changes to a new array reference after initial render, THE Reader SHALL replace the current bookmark collection in state with the new prop value.
7. WHEN a bookmark is created at runtime and the `bookmarks` prop was provided, THE Reader SHALL append the new bookmark to the current in-state collection without persisting to the Bookmark_Store_Interface.

### Requirement 6: Bookmarks Property Precedence and Reactivity

**User Story:** As a library consumer, I want the bookmarks property to take precedence over store-loaded bookmarks and react to changes, so that I have deterministic control over the bookmark state.

#### Acceptance Criteria

1. WHEN both the `bookmarks` prop and a `bookmarkStore` store implementation are configured, THE Reader SHALL use the `bookmarks` prop value as the displayed bookmark collection, ignoring any bookmarks returned by the store's `load` method.
2. WHEN the `bookmarks` prop value changes after initial render (detected by reference or shallow comparison of array contents), THE Reader SHALL update its displayed bookmark collection to match the new prop value within the same render cycle.
3. WHEN the `bookmarks` prop changes from a non-empty array to an empty array (`[]`), THE Reader SHALL remove all bookmarks from its displayed state so that zero bookmarks are rendered.
4. WHEN a bookmark is created or deleted by user interaction while the `bookmarks` prop is provided, THE Reader SHALL persist the change through the configured `bookmarkStore` and fire the `onBookmarkChange` callback, but SHALL NOT update the displayed bookmark collection until the `bookmarks` prop itself is updated by the parent component.
5. IF a bookmark is created or deleted by user interaction and no `bookmarkStore` is configured while the `bookmarks` prop is provided, THEN THE Reader SHALL fire the `onBookmarkChange` callback without modifying the displayed bookmark collection.
6. IF the `bookmarks` prop is not provided (undefined), THEN THE Reader SHALL load bookmarks from the configured `bookmarkStore` and manage bookmark state internally, updating the display on each create or delete operation.

### Requirement 7: Store Selection via Reader Props

**User Story:** As a library consumer, I want to configure which bookmark store implementation the Reader uses, so that I can choose the persistence strategy appropriate for my application.

#### Acceptance Criteria

1. THE Reader SHALL accept an optional `bookmarkStore` prop that accepts any object conforming to the Bookmark_Store_Interface.
2. WHEN a `bookmarkStore` prop is provided, THE Reader SHALL delegate all bookmark create, rename, delete, and load operations to that store instance.
3. WHEN no `bookmarkStore` prop is provided, THE Reader SHALL instantiate and use the LocalStorage_Store as the default persistence backend.
4. WHEN the `bookmarkStore` prop value changes to a new store instance, THE Reader SHALL use the new store for all subsequent bookmark operations while retaining the currently displayed bookmarks in the UI until the next explicit load from the new store.
5. IF the `bookmarkStore` prop is changed from a defined value to undefined, THEN THE Reader SHALL revert to using the LocalStorage_Store for all subsequent bookmark operations.

### Requirement 8: Bookmark Browser Navigation

**User Story:** As a reader, I want to click a bookmark in the bookmarks browser and have the reader navigate to that bookmark's position, so that I can quickly return to previously saved locations in the book.

#### Acceptance Criteria

1. THE BookmarkPanel SHALL render each bookmark in the current book's collection as a clickable item in a scrollable list, filtered to only include bookmarks whose `bookId` matches the currently loaded book's identifier.
2. WHEN the user clicks a bookmark item in the BookmarkPanel, THE Reader SHALL navigate to the chapter identified by the bookmark's `chapterId` field.
3. WHEN the user clicks a bookmark item in the BookmarkPanel, THE Reader SHALL navigate to the page that contains the character offset specified by the bookmark's `position` field within the target chapter, where the target page is determined by dividing the position by the characters-per-page value used for pagination.
4. IF the bookmark's `chapterId` does not match any chapter in the currently loaded book, THEN THE Reader SHALL remain on the current page and display an error message indicating the bookmark target is invalid.
5. IF the bookmark's `position` exceeds the total character count of the target chapter, THEN THE Reader SHALL navigate to the last page of the target chapter.
6. WHEN navigation to a bookmark completes, THE Reader SHALL update the reading progress percentage based on the ratio of characters read (all completed chapters plus current position within the target chapter) to total book characters.
7. WHEN navigation to a bookmark completes, THE Reader SHALL fire the `onPageChange` callback with the new chapter index, page number, and progress percentage (0–100).
