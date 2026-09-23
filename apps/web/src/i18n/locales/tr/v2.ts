/** Gözlemevi v2 kiti — yeni bileşenlerin metinleri (docs/ui-v2/gozlemevi.md). */

/** B9: basılı tutarak gönder. */
export const hold = {
  hint: 'Basılı tut ya da onaylamak için iki kez Enter’a bas',
  confirm: '{{label}} · emin misin?',
};

/** B12: halka olarak çizilen kuyruk hattı. */
export const lane = {
  /** Hatta boş duran yer. */
  free: '+ Boş hat',
};

/** B1: üst çubuktaki kaynak ölçeri. */
export const meter = {
  /** Read by a screen reader: the stock against the store. */
  reading: '{{resource}}: {{value}} / {{cap}}',
  /** The same, when the store is full. */
  full: '{{resource}}: {{value}} / {{cap}}, depo dolu',
};

/** B5: güç cetveli. */
export const ruler = {
  /** In place of the defence strip when nothing was ever measured. */
  unknown: 'Sonda yok: savunma bilinmiyor',
  /** The button that closes that gap. */
  probe: 'Sonda gönder',
};

/** v2 sayfası: tutamacı. */
export const handle = {
  /** Opens the sheet one height further. */
  expand: 'Genişlet',
  /** At the top: settles it one height lower. */
  collapse: 'Daralt',
};

/** B4: dock, sabit sırada beş sekme. */
export const dock = {
  /** The navigation landmark, for a screen reader. */
  label: 'Ana gezinme',
  galaxy: 'Galaksi',
  base: 'Üs',
  fleet: 'Filo',
  intel: 'İstihbarat',
  clan: 'Klan',
  /** The dot on Base, read aloud. */
  baseWaiting: 'Toplanacak ya da onarılacak bir şey var',
  /** Beside the Fleet ring: your own craft in the air. */
  airborne: 'Havada: {{count}}',
  /** The count on Intel: reports you have not seen. */
  reports: 'Yeni rapor: {{count}}',
  /** The count on Clan. */
  attention: 'Seni bekleyen: {{count}}',
};

/** B2: Şimdi hattı, en önemli tek zamanlayıcı. */
export const now = {
  /** The line, for a screen reader. */
  label: 'En acil zamanlayıcı',
  /** The sheet one tap under it: every timer. */
  sheet: 'Zamanlayıcılar',
  work: 'İş bitiyor',
  research: 'Araştırma bitiyor',
  event: 'Olay bitiyor',
  shield: 'Kalkanın bitiyor',
  shieldDetail: 'Sonrasında saldırıya açıksın',
  /** The clock time beside a countdown in the sheet. */
  at: 'saat {{time}}',
};

/** K1: zil sayfası, üç sekme. */
export const bell = {
  /** The tab list, for a screen reader. */
  label: 'Sinyaller, kronik ve sohbet',
  signals: 'Sinyaller',
  chronicle: 'Kronik',
  chat: 'Sohbet',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} okunmamış',
};
