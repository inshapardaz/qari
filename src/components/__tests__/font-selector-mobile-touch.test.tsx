/**
 * Regression test for GitHub issue: "Font selection in mobile is broken" —
 * tapping a typeface option closed the settings popup without selecting a
 * font (and could turn the page underneath it): see the
 * fontDropdownOpen/closeOnClickOutside comment on the settings <Popover> in
 * Reader.tsx for the root cause.
 *
 * Mantine's Popover dismisses itself on outside `mousedown` *or* `touchstart`
 * (@mantine/hooks' useClickOutside), by checking whether the event's
 * composedPath() contains the Popover's own target/dropdown DOM nodes. In a
 * real (non-test) browser render, the typeface <Select>'s own dropdown
 * portals separately from the settings Popover's dropdown, so a touch
 * landing on one of its options isn't contained in either node and looks
 * like an outside tap — closing (and unmounting) the whole settings panel,
 * option included, before the `click` that performs the actual selection
 * can fire. (Mantine's `env="test"` mode, used by this component in tests,
 * renders everything inline instead of through real portals, which is why
 * this is exercised here via a synthetic outside touch rather than by
 * relying on the library's real DOM layout.)
 *
 * The fix suppresses the settings Popover's closeOnClickOutside while the
 * nested typeface dropdown is open, so this test drives that flag directly:
 * an outside touch shouldn't close the settings panel while the font
 * dropdown is open, but should once it's closed again.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { Reader } from '../Reader';
import type { ReaderSource } from '../Reader';

function createMarkdownSource(content = '# Test Book\n\n## Chapter 1\n\nHello world'): ReaderSource {
  return { type: 'markdown', content };
}

function getFontSelectInput(): HTMLElement {
  const matches = screen.getAllByLabelText('Font Family');
  const input = matches.find((el) => el.tagName === 'INPUT');
  if (!input) throw new Error('Could not find the font family <input>');
  return input;
}

async function openSettings() {
  const settingsButton = await screen.findByRole('button', { name: 'Reading settings' });
  fireEvent.click(settingsButton);
  await screen.findByTestId('settings-panel');
}

/** Fires a `touchstart` on an element clearly outside the reader chrome. */
function touchOutside() {
  act(() => {
    document.body.dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
  });
}

describe('Font selector touch-tap race (mobile)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not dismiss the settings panel on an outside touch while the typeface dropdown is open', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();
    fireEvent.click(getFontSelectInput());
    await screen.findAllByRole('option');

    // An outside touch while the nested typeface dropdown is open must not
    // be mistaken for a tap outside the settings panel itself.
    touchOutside();

    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
  });

  it('still dismisses the settings panel on an outside touch once the typeface dropdown is closed', async () => {
    render(<Reader source={createMarkdownSource()} />);
    await waitFor(() => expect(screen.getByTestId('reader-content')).toBeInTheDocument());

    await openSettings();
    const input = getFontSelectInput();
    fireEvent.click(input);
    const options = await screen.findAllByRole('option');
    const sansOption = options.find((o) => o.textContent === 'Sans');
    if (!sansOption) throw new Error('Could not find the "Sans" typeface option');

    // Selecting an option closes the nested dropdown, so ordinary
    // outside-tap-to-close behavior for the settings panel should resume.
    fireEvent.click(sansOption);

    touchOutside();

    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    });
  });
});
