import type { TranslationStrings } from '../types';

export const fr: TranslationStrings = {
  // Meta
  uiDirection: 'ltr',

  // Reader
  loading: 'Chargement…',
  errorSource: 'Source :',
  errorFormat: 'Format :',
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
  themeSepia: 'Sépia',
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
  bookmarkNamePlaceholder: 'Nom du signet (facultatif)',
  bookmarkAutoName: 'Chapitre {chapter}, Page {page}',
  bookmarkAdd: 'Ajouter un signet',
  bookmarksEmpty: 'Aucun signet pour le moment.',
  bookmarkRename: 'Renommer',
  bookmarkDelete: 'Supprimer',
  bookmarkSave: 'Enregistrer',
  bookmarkCancel: 'Annuler',
  bookmarkNewNameAriaLabel: 'Nouveau nom du signet',
  bookmarkCreateAriaLabel: 'Créer un signet',

  // Note panel
  notesPanelTitle: 'Notes',
  notesEmpty: 'Aucune note pour le moment. Sélectionnez du texte puis faites un clic droit pour en ajouter une.',
  noteAddMenuItem: 'Ajouter une note',
  noteRemoveMenuItem: 'Supprimer la note',
  noteCommentPlaceholder: 'Ajouter un commentaire (facultatif)',
  noteSave: 'Enregistrer',
  noteCancel: 'Annuler',

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
