import type { TranslationStrings } from '../types';

export const fr: TranslationStrings = {
  // Meta
  uiDirection: 'ltr',

  // Reader
  loading: 'Chargement…',
  errorSource: 'Source :',
  errorFormat: 'Format :',
  devToolsBlockedMessage: 'Contenu masqué pendant que les outils de développement sont ouverts.',
  tableOfContents: 'Table des matières',
  bookmarks: 'Signets',
  readingSettings: 'Paramètres de lecture',
  enterFullscreen: 'Plein écran',
  exitFullscreen: 'Quitter le plein écran',
  previousPage: 'Page précédente',
  nextPage: 'Page suivante',
  previousChapter: 'Chapitre précédent',
  nextChapter: 'Chapitre suivant',
  pageIndicator: 'Page {current} sur {total}',
  chapterIndicator: 'Chapitre {current} sur {total}',
  resetToDefaults: 'Réinitialiser',
  closeReader: 'Fermer le lecteur',

  // Settings dialog
  settingsTheme: 'Thème',
  themeLight: 'Clair',
  themeDark: 'Sombre',
  themeCalm: 'Calme',
  themeQuiet: 'Silencieux',
  themePaper: 'Papier',
  themeFocus: 'Concentration',
  themeHighContrast: 'Contraste',
  settingsFontFamily: 'Police',
  settingsFontSize: 'Taille',
  settingsJustify: 'Justifier',
  settingsLineSpacing: 'Interligne',
  settingsLetterSpacing: 'Espacement lettres',
  settingsWordSpacing: 'Espacement mots',
  settingsMargin: 'Marge',
  settingsColumns: 'Colonnes',
  settingsLayout: 'Mise en page',
  settingsLayoutSingle: 'Colonne unique',
  settingsLayoutDouble: 'Deux colonnes',
  settingsLayoutScroll: 'Défilement',
  settingsLayoutShowDivider: 'Afficher le séparateur de pages',
  settingsMore: 'Plus de réglages',
  settingsPreviewText: 'Le renard brun rapide saute par-dessus le chien paresseux. Cet aperçu montre à quoi ressembleront vos paramètres de lecture.',
  settingsApply: 'Appliquer',
  settingsCancel: 'Annuler',

  // Dictionary popover
  dictionaryLoading: 'Chargement...',
  dictionaryClose: 'Fermer le dictionnaire',
  dictionaryNotFound: 'Aucune définition trouvée pour « {word} ».',
  dictionaryNoDictionary: 'Aucun dictionnaire disponible pour cette langue.',
  dictionaryTryIn: 'Essayer en {language}',
  spellcheckCorrect: 'Orthographe correcte',
  spellcheckMisspelled: 'Mal orthographié',
  spellingSuggestions: 'Suggestions orthographiques',
  dictionaryLoadingAriaLabel: 'Recherche dans le dictionnaire',
  dictionaryExamples: 'Exemples',
  dictionaryLookupMenuItem: 'Signification',

  // Bookmark panel
  bookmarksPanelTitle: 'Signets',
  bookmarkAutoName: 'Chapitre {chapter}, Page {page}',
  bookmarksEmpty: 'Aucun signet pour le moment.',
  bookmarkDelete: 'Supprimer',

  // Note panel
  notesPanelTitle: 'Notes',
  notesEmpty: 'Aucune note pour le moment. Sélectionnez du texte puis faites un clic droit pour en ajouter une.',
  noteAddMenuItem: 'Ajouter une note',
  noteRemoveMenuItem: 'Supprimer la note',
  noteEditComment: 'Modifier le commentaire',
  noteCommentPlaceholder: 'Ajouter un commentaire…',
  noteSaveComment: 'Enregistrer',
  noteCancelEdit: 'Annuler',
  noteColorLabel: 'Définir la couleur de surlignage : {color}',
  noteColors: {
    yellow: 'Jaune',
    green: 'Vert',
    blue: 'Bleu',
    pink: 'Rose',
    purple: 'Violet',
  },

  // Search panel
  searchPanelTitle: 'Recherche',
  searchPlaceholder: 'Rechercher dans le livre…',
  searchEmpty: 'Tapez pour rechercher dans le livre.',
  searchNoResults: 'Aucun résultat pour « {query} ».',
  searchResultsCount: '{count} résultats',
  searchClear: 'Effacer la recherche',

  // Chapter index
  chaptersTitle: 'Chapitres',
  goToChapter: 'Aller au chapitre : {title}',

  // Zoom controls
  zoomControls: 'Contrôles de zoom',
  zoomIn: 'Agrandir',
  zoomOut: 'Réduire',

  // Image lightbox
  lightboxClose: "Fermer la visionneuse d'image",
  lightboxZoomIn: 'Agrandir',
  lightboxZoomOut: 'Réduire',
  lightboxLabel: "Visionneuse d'image",

  // Footnote popover
  footnoteClose: 'Fermer la note de bas de page',
  footnoteDialogLabel: 'Note de bas de page {label}',

  // Font selector — generic style categories translated; typeface proper
  // names (Amiri, Lateef, etc.) are kept as-is, as is standard practice for
  // font names.
  fontNames: {
    Serif: 'Empattement',
    Sans: 'Sans empattement',
    Mono: 'Chasse fixe',
    'Adobe Arabic': 'Adobe Arabic',
    'Alvi Lahori Nastaleeq': 'Alvi Lahori Nastaleeq',
    Amiri: 'Amiri',
    'Aref Ruqaa': 'Aref Ruqaa',
    'Dehalvi Khush Khat': 'Dehalvi Khush Khat',
    Dubai: 'Dubai',
    'Emad Nastaleeq': 'Emad Nastaleeq',
    'Fajer Noori Nastalique': 'Fajer Noori Nastalique',
    'Gulzar Nastalique': 'Gulzar Nastalique',
    'Jameel Khushkhati': 'Jameel Khushkhati',
    'Jameel Noori Nastaleeq Kasheeda': 'Jameel Noori Nastaleeq Kasheeda',
    'Jameel Noori Nastaleeq': 'Jameel Noori Nastaleeq',
    Lalezar: 'Lalezar',
    Lateef: 'Lateef',
    Mada: 'Mada',
    'Mehr Nastaleeq': 'Mehr Nastaleeq',
    'Mehr Nastaliq Web': 'Mehr Nastaliq Web',
    'Nafees Nastaleeq': 'Nafees Nastaleeq',
    'Nafees Web Naskh': 'Nafees Web Naskh',
    'Noto Naskh Arabic': 'Noto Naskh Arabic',
    'Noto Nastaliq Urdu': 'Noto Nastaliq Urdu',
    'Pak Nastaleeq': 'Pak Nastaleeq',
    Qahiri: 'Qahiri',
    'Reem Kufi': 'Reem Kufi',
    'Sameer Khashab Bold': 'Sameer Khashab Bold',
    'Scheherazade New': 'Scheherazade New',
  },
};
