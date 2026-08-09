import { createTheme } from '@mantine/core';
import type { MantineThemeOverride } from '@mantine/core';

/**
 * Default Mantine theme for the Reader's UI chrome (header buttons, chapter
 * menu, bookmarks popover, settings dialog, sliders, switches).
 *
 * This is intentionally light-touch: it sets a primary color, radius, and a
 * font stack matching the reader's own chrome font, and leaves everything
 * else at Mantine's defaults. Pass a `mantineTheme` prop to the `Reader` to
 * override or extend it — see the "Theming" section in the README.
 */
export const DEFAULT_MANTINE_THEME: MantineThemeOverride = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'sm',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  components: {
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.4, blur: 0 },
      },
    },
  },
});
