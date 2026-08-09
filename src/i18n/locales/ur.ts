import type { TranslationStrings } from '../types';

export const ur: TranslationStrings = {
  // Meta
  uiDirection: 'rtl',

  // Reader
  loading: 'لوڈ ہو رہا ہے…',
  errorSource: 'ذریعہ:',
  errorFormat: 'فارمیٹ:',
  tableOfContents: 'فہرست مضامین',
  bookmarks: 'بک مارکس',
  readingSettings: 'پڑھنے کی ترتیبات',
  enterFullscreen: 'فل سکرین میں داخل ہوں',
  exitFullscreen: 'فل سکرین سے باہر نکلیں',
  previousPage: 'پچھلا صفحہ',
  nextPage: 'اگلا صفحہ',
  pageIndicator: 'صفحہ {current} از {total}',
  chapterIndicator: 'باب {current} از {total}',
  resetToDefaults: 'ڈیفالٹ پر واپس',

  // Settings dialog
  settingsTheme: 'تھیم',
  themeLight: 'روشن',
  themeDark: 'تاریک',
  themeSepia: 'سیپیا',
  themeHighContrast: 'اعلیٰ تباین',
  settingsFontFamily: 'فونٹ فیملی',
  settingsFontSize: 'فونٹ سائز',
  settingsJustify: 'متن جواز',
  settingsLineSpacing: 'لائن اسپیسنگ',
  settingsLetterSpacing: 'حروف اسپیسنگ',
  settingsWordSpacing: 'لفظ اسپیسنگ',
  settingsMargin: 'حاشیہ',
  settingsColumns: 'کالم',

  // Dictionary popover
  dictionaryLoading: 'لوڈ ہو رہا ہے...',
  dictionaryClose: 'لغت بند کریں',
  dictionaryNotFound: '"{word}" کی کوئی تعریف نہیں ملی۔',
  dictionaryNoDictionary: 'اس زبان کے لیے کوئی لغت دستیاب نہیں۔',
  dictionaryTryIn: '{language} میں تلاش کریں',
  spellcheckCorrect: 'درست ہجے',
  spellcheckMisspelled: 'غلط ہجے',
  spellingSuggestions: 'ہجے کی تجاویز',
  dictionaryLoadingAriaLabel: 'لغت تلاش ہو رہی ہے',
  dictionaryExamples: 'مثالیں',

  // Bookmark panel
  bookmarksPanelTitle: 'بک مارکس',
  bookmarkNamePlaceholder: 'بک مارک کا نام',
  bookmarkAdd: 'بک مارک شامل کریں',
  bookmarksEmpty: 'ابھی کوئی بک مارک نہیں۔',
  bookmarkRename: 'نام تبدیل',
  bookmarkDelete: 'حذف',
  bookmarkSave: 'محفوظ',
  bookmarkCancel: 'منسوخ',
  bookmarkNewNameAriaLabel: 'نیا بک مارک نام',
  bookmarkCreateAriaLabel: 'بک مارک بنائیں',

  // Chapter index
  chaptersTitle: 'ابواب',
  goToChapter: 'باب پر جائیں: {title}',

  // Zoom controls
  zoomControls: 'زوم کنٹرول',
  zoomIn: 'بڑا کریں',
  zoomOut: 'چھوٹا کریں',

  // Image lightbox
  lightboxClose: 'تصویر دیکھنے والا بند کریں',
  lightboxZoomIn: 'بڑا کریں',
  lightboxZoomOut: 'چھوٹا کریں',
  lightboxLabel: 'تصویر دیکھنے والا',

  // Footnote popover
  footnoteClose: 'فوٹ نوٹ بند کریں',
  footnoteDialogLabel: 'فوٹ نوٹ {label}',

  // Font selector — generic style categories translated; the Urdu/Arabic
  // typeface names are given their Urdu-script renderings.
  fontNames: {
    Serif: 'سیرف',
    Sans: 'بغیر سیرف',
    Mono: 'مونو اسپیس',
    'Adobe Arabic': 'ایڈوبی عربک',
    'Alvi Lahori Nastaleeq': 'علوی لاہوری نستعلیق',
    Amiri: 'امیری',
    'Aref Ruqaa': 'عارف رقعہ',
    'Dehalvi Khush Khat': 'دہلوی خوش خط',
    Dubai: 'دبئی',
    'Emad Nastaleeq': 'عماد نستعلیق',
    'Fajer Noori Nastalique': 'فجر نوری نستعلیق',
    'Gulzar Nastalique': 'گلزار نستعلیق',
    'Jameel Khushkhati': 'جمیل خوش خطی',
    'Jameel Noori Nastaleeq Kasheeda': 'جمیل نوری نستعلیق کشیدہ',
    'Jameel Noori Nastaleeq': 'جمیل نوری نستعلیق',
    Lalezar: 'لالہ زار',
    Lateef: 'لطیف',
    Mada: 'مدا',
    'Mehr Nastaleeq': 'مہر نستعلیق',
    'Mehr Nastaliq Web': 'مہر نستعلیق ویب',
    'Nafees Nastaleeq': 'نفیس نستعلیق',
    'Nafees Web Naskh': 'نفیس ویب نسخ',
    'Noto Naskh Arabic': 'نوٹو نسخ عربی',
    'Noto Nastaliq Urdu': 'نوٹو نستعلیق اردو',
    'Pak Nastaleeq': 'پاک نستعلیق',
    Qahiri: 'قاہری',
    'Reem Kufi': 'ریم کوفی',
    'Sameer Khashab Bold': 'سمیر خشب بولڈ',
    'Scheherazade New': 'شہرزاد نیو',
  },
};
