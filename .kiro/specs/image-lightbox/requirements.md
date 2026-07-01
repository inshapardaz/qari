# Requirements Document

## Introduction

This feature adds an image lightbox overlay to the ebook reader. When a user clicks on an image rendered within the reader content, a modal overlay opens displaying the image at full size with zoom in/out controls. The lightbox is a standalone React component that integrates with the existing translation system and inline styling patterns.

## Glossary

- **ImageLightbox**: A standalone React component that renders a modal overlay displaying a clicked image at full size with zoom controls.
- **Reader**: The main ebook reader component (`Reader.tsx`) that renders book content including images.
- **ZoomControls**: Buttons within the lightbox that allow the user to increase or decrease the displayed image magnification.
- **Backdrop**: A semi-transparent dark overlay behind the lightbox content that dims the reader UI.
- **ZoomLevel**: A numeric percentage representing the current magnification of the image within the lightbox.

## Requirements

### Requirement 1: Image Click Opens Lightbox

**User Story:** As a reader, I want to click on any image in the book content to view it in a larger overlay, so that I can inspect image details more clearly.

#### Acceptance Criteria

1. WHEN the user clicks on an image element rendered by the Reader, THE ImageLightbox SHALL open as a modal overlay displaying the clicked image.
2. THE ImageLightbox SHALL receive the image source URL and alt text from the clicked image element.
3. WHEN the ImageLightbox opens, THE Backdrop SHALL render as a semi-transparent dark overlay covering the entire viewport.

### Requirement 2: Lightbox Display and Layout

**User Story:** As a reader, I want the lightbox to center the image with a dark background, so that I can focus on the image content without distraction.

#### Acceptance Criteria

1. THE ImageLightbox SHALL center the image horizontally and vertically within the viewport.
2. THE Backdrop SHALL use a dark semi-transparent background color to dim the underlying reader content.
3. THE ImageLightbox SHALL display the image with its intrinsic aspect ratio preserved.
4. WHILE the ImageLightbox is open, THE ImageLightbox SHALL render above all other reader UI elements using a fixed position overlay.

### Requirement 3: Zoom Controls

**User Story:** As a reader, I want zoom in and zoom out buttons in the lightbox, so that I can magnify or reduce the image to a comfortable viewing size.

#### Acceptance Criteria

1. THE ImageLightbox SHALL display a zoom in button and a zoom out button.
2. WHEN the user clicks the zoom in button, THE ImageLightbox SHALL increase the ZoomLevel of the displayed image by a fixed step increment.
3. WHEN the user clicks the zoom out button, THE ImageLightbox SHALL decrease the ZoomLevel of the displayed image by a fixed step increment.
4. THE ImageLightbox SHALL enforce a minimum ZoomLevel so the image does not shrink below a readable size.
5. THE ImageLightbox SHALL enforce a maximum ZoomLevel so the image does not exceed a practical magnification limit.
6. WHILE the ZoomLevel is at the minimum value, THE zoom out button SHALL be disabled.
7. WHILE the ZoomLevel is at the maximum value, THE zoom in button SHALL be disabled.

### Requirement 4: Closing the Lightbox

**User Story:** As a reader, I want a clear way to close the lightbox and return to reading, so that I can easily dismiss the overlay when done viewing the image.

#### Acceptance Criteria

1. THE ImageLightbox SHALL display a close button.
2. WHEN the user clicks the close button, THE ImageLightbox SHALL close and return focus to the reader content.
3. WHEN the user clicks on the Backdrop area outside the image, THE ImageLightbox SHALL close.

### Requirement 5: Accessibility

**User Story:** As a reader using assistive technology, I want the lightbox to be properly labelled and navigable, so that I can use it effectively with a screen reader.

#### Acceptance Criteria

1. THE ImageLightbox SHALL render with a `role="dialog"` attribute and an accessible label describing the image.
2. THE close button SHALL have an accessible label from the translation strings.
3. THE zoom in button SHALL have an accessible label from the translation strings.
4. THE zoom out button SHALL have an accessible label from the translation strings.
5. WHEN the ZoomLevel changes, THE ImageLightbox SHALL announce the current ZoomLevel to assistive technologies using an aria-live region.

### Requirement 6: Internationalization

**User Story:** As a developer, I want lightbox UI strings to use the translation system, so that the component supports localization consistently with the rest of the reader.

#### Acceptance Criteria

1. THE ImageLightbox SHALL use translation strings from the TranslationContext for all user-visible text.
2. THE translation system SHALL include strings for the lightbox close button label, zoom in label, and zoom out label.

### Requirement 7: Component Architecture

**User Story:** As a developer, I want the lightbox as a standalone component, so that it is maintainable and testable independently of the Reader.

#### Acceptance Criteria

1. THE ImageLightbox SHALL be implemented as a standalone React component in a separate file (`ImageLightbox.tsx`).
2. THE ImageLightbox SHALL use inline styles consistent with the existing component styling patterns in the codebase.
3. THE Reader SHALL pass the image source URL and alt text to the ImageLightbox component when an image is clicked.
