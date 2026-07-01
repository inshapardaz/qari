# Implementation Plan: Image Lightbox with Zoom Controls

## Overview

Add an image lightbox overlay component to the ebook reader. When a user clicks an image in the book content, a full-viewport modal opens with the image centered on a dark backdrop, zoom in/out controls, and a close button. The component integrates with the existing i18n translation system and follows the inline-style conventions of the codebase.

## Tasks

- [x] 1. Add lightbox translation keys
  - [x] 1.1 Add lightbox keys to TranslationStrings type and defaults
    - Add `lightboxClose`, `lightboxZoomIn`, `lightboxZoomOut`, and `lightboxLabel` to `TranslationStrings` in `src/i18n/types.ts`
    - Add corresponding default English values in `src/i18n/defaults.ts`
    - _Requirements: 6.1, 6.2_

- [x] 2. Implement ImageLightbox component
  - [x] 2.1 Create ImageLightbox component with zoom controls
    - Create `src/components/ImageLightbox.tsx` with `ImageLightboxProps` interface (`src`, `alt`, `onClose`)
    - Export `clampLightboxZoom` utility function (range 50–300, step 25)
    - Implement zoom in/out buttons that increment/decrement by 25%, disable at min/max boundaries
    - Display current zoom level percentage in an aria-live region
    - Add close button and backdrop click-to-close (only when clicking backdrop itself, not children)
    - Use `role="dialog"` with `aria-label` from translation strings
    - Use inline styles consistent with existing component patterns
    - Apply `transform: scale(zoomLevel / 100)` on the image element
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 7.1, 7.2_

  - [x] 2.2 Write property test for lightbox zoom clamping invariant
    - **Property 3: Zoom clamping invariant**
    - Test that for any sequence of zoom operations, result is always in [50, 300] and a multiple of 25
    - Create `src/components/__tests__/lightbox-zoom-clamping.property.test.ts`
    - **Validates: Requirements 3.4, 3.5**

  - [x] 2.3 Write property test for zoom step correctness
    - **Property 2: Zoom step correctness**
    - Test that zoom in produces `min(current + 25, 300)` and zoom out produces `max(current - 25, 50)` from any valid level
    - Create `src/components/__tests__/lightbox-zoom-step.property.test.ts`
    - **Validates: Requirements 3.2, 3.3**

  - [x] 2.4 Write unit tests for ImageLightbox rendering and interaction
    - Create `src/components/ImageLightbox.test.tsx`
    - Verify lightbox renders with correct ARIA attributes (`role="dialog"`, accessible labels)
    - Verify close button click calls `onClose`
    - Verify backdrop click calls `onClose`, but image click does not
    - Verify zoom in/out buttons update displayed level
    - Verify disabled state of zoom buttons at min (50%) and max (300%) boundaries
    - _Requirements: 1.1, 3.6, 3.7, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate lightbox into Reader
  - [x] 4.1 Add lightbox state and image click handler in Reader.tsx
    - Add `lightboxImage` state (`{ src: string; alt: string } | null`) to the Reader component
    - Add `onClick` handler to the image case in `ContentNodeRenderer` that sets `lightboxImage`
    - Add `cursor: 'pointer'` style to clickable images
    - Import and conditionally render `<ImageLightbox>` when `lightboxImage` is non-null
    - Pass `onClose={() => setLightboxImage(null)}` to dismiss the lightbox
    - _Requirements: 1.1, 1.2, 1.3, 4.2, 7.3_

  - [x] 4.2 Write property test for image data passthrough
    - **Property 1: Image data passthrough**
    - Test that for any image src/alt values, clicking the image passes exact same values to the lightbox
    - Create `src/components/__tests__/lightbox-data-passthrough.property.test.ts`
    - **Validates: Requirements 1.2, 7.3**

  - [x] 4.3 Write property test for translation string usage
    - **Property 5: Translation string usage**
    - Test that lightbox buttons use provided translation strings for aria-labels
    - Create `src/components/__tests__/lightbox-translation-usage.property.test.ts`
    - **Validates: Requirements 6.1**

- [x] 5. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest + fast-check for property-based tests, and @testing-library/react for component tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] }
  ]
}
```
