/**
 * Loads the Urdu/Arabic script font collection live from the
 * inshapardaz/urdu-web-fonts GitHub repository via jsDelivr's GitHub CDN,
 * instead of bundling font files through an npm dependency.
 *
 * Pinned to a specific commit (rather than a branch) so the set of fonts
 * served to the reader doesn't change underneath consumers unexpectedly.
 * Bump `URDU_WEB_FONTS_COMMIT` to pick up upstream additions.
 */

const URDU_WEB_FONTS_COMMIT = '571e360d5c272252efb0b0b21af54d1f63457521';
const URDU_WEB_FONTS_BASE_URL = `https://cdn.jsdelivr.net/gh/inshapardaz/urdu-web-fonts@${URDU_WEB_FONTS_COMMIT}/src/fonts`;

interface UrduWebFontEntry {
  /** Directory name of the font in the urdu-web-fonts repo */
  dir: string;
  /** Display name shown in the font selector UI */
  name: string;
  /** CSS font-family name declared in the font's stylesheet.css */
  family: string;
}

/** All font families published on https://github.com/inshapardaz/urdu-web-fonts */
const URDU_WEB_FONTS: UrduWebFontEntry[] = [
  { dir: 'adobe-arabic', name: 'Adobe Arabic', family: 'AdobeArabic' },
  { dir: 'alvi-lahori-nastalique', name: 'Alvi Lahori Nastaleeq', family: 'AlviLahoriNastaleeq' },
  { dir: 'amiri', name: 'Amiri', family: 'Amiri' },
  { dir: 'aref-ruqqa', name: 'Aref Ruqaa', family: 'Aref Ruqaa' },
  { dir: 'dehalvi-khushkhat', name: 'Dehalvi Khush Khat', family: 'DehalviKhushKhat' },
  { dir: 'dubai', name: 'Dubai', family: 'Dubai' },
  { dir: 'emad-nastaleeq', name: 'Emad Nastaleeq', family: 'EmadNastaleeq' },
  { dir: 'fajer-noori-nastalique', name: 'Fajer Noori Nastalique', family: 'FajerNooriNastalique' },
  { dir: 'gulzar-nastalique', name: 'Gulzar Nastalique', family: 'gulzar-nastalique' },
  { dir: 'jameel-khushkhati', name: 'Jameel Khushkhati', family: 'jameel-khushkhati' },
  { dir: 'jameel-noori-kasheeda', name: 'Jameel Noori Nastaleeq Kasheeda', family: 'JameelNooriNastaleeqKasheeda' },
  { dir: 'jameel-noori-nastalique', name: 'Jameel Noori Nastaleeq', family: 'JameelNooriNastaleeq' },
  { dir: 'lalezar', name: 'Lalezar', family: 'Lalezar' },
  { dir: 'lateef', name: 'Lateef', family: 'Lateef' },
  { dir: 'mada', name: 'Mada', family: 'Mada' },
  { dir: 'mehr-nastalique', name: 'Mehr Nastaleeq', family: 'MehrNastaleeq' },
  { dir: 'mehr-nastalique-2', name: 'Mehr Nastaliq Web', family: 'Mehr Nastaliq Web' },
  { dir: 'nafees-nastaleeq', name: 'Nafees Nastaleeq', family: 'NafeesNastaleeq' },
  { dir: 'Nafees-web-naskh', name: 'Nafees Web Naskh', family: 'NafeesWebNaskh' },
  { dir: 'noto-naskh', name: 'Noto Naskh Arabic', family: 'Noto Naskh Arabic' },
  { dir: 'noto-nastalique', name: 'Noto Nastaliq Urdu', family: 'Noto Nastaliq Urdu' },
  { dir: 'pak-nastaleeq', name: 'Pak Nastaleeq', family: 'PakNastaleeq' },
  { dir: 'qahiri', name: 'Qahiri', family: 'Qahiri' },
  { dir: 'reem-kufi', name: 'Reem Kufi', family: 'Reem Kufi' },
  { dir: 'sameer-khashab-bold', name: 'Sameer Khashab Bold', family: 'sameer-khashab' },
  { dir: 'scheherazade', name: 'Scheherazade New', family: 'Scheherazade New' },
];

/**
 * Font selector entries for every urdu-web-fonts family, ready to spread
 * into `DEFAULT_FONT_OPTIONS` or a consumer's own `fontOptions` list.
 */
export const URDU_WEB_FONT_OPTIONS: { name: string; family: string }[] = URDU_WEB_FONTS.map((font) => ({
  name: font.name,
  family: `"${font.family}", serif`,
}));

let injected = false;

/**
 * Injects a `<link>` per font pointing at jsDelivr's GitHub CDN, registering
 * each `@font-face` without downloading any font binaries up front — browsers
 * only fetch the actual glyph data for whichever font is applied to text.
 * Safe to call from multiple Reader instances; only injects once per page.
 */
export function injectUrduWebFontsCss(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.querySelector('link[data-qari-urdu-fonts]')) {
    injected = true;
    return;
  }

  for (const font of URDU_WEB_FONTS) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${URDU_WEB_FONTS_BASE_URL}/${font.dir}/stylesheet.css`;
    link.setAttribute('data-qari-urdu-fonts', font.dir);
    document.head.appendChild(link);
  }
  injected = true;
}
