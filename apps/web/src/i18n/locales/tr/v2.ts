/** Gözlemevi v2 kiti — yeni bileşenlerin metinleri (docs/ui-v2/gozlemevi.md). */

/** B9: basılı tutarak gönder. */
export const hold = {
  hint: 'Basılı tut ya da onaylamak için iki kez Enter’a bas',
  confirm: '{{label}} · emin misin?',
  /** Shown on the face after a release that came too soon. */
  release: 'Onaylamak için basılı tut',
  verb: 'Basılı tut',
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
  /** The sheet's name: all three tabs answer it. */
  title: 'Neler oldu',
  /** The tab list, for a screen reader. */
  label: 'Sinyaller, kronik ve sohbet',
  signals: 'Sinyaller',
  chronicle: 'Kronik',
  chat: 'Sohbet',
  /** The dot on Chat, read aloud. */
  chatUnread: '{{count}} okunmamış',
};

/** B1: üst çubuk. */
export const topBar = {
  /** The shield's time on the commander chip: whole hours, rounded down. */
  hours: '{{h}}s',
};

/** Görünüm çipi ve sayfası: katmanlar, olay rehberi ve galaksi başlığı. */
export const view = {
  chip: 'Görünüm',
  title: 'Görünüm',
  layers: 'Katmanlar',
  telescope: 'Teleskop menzili',
  telescopeDetail: 'Dünyalarının filo durumunu gördüğü alan',
  radar: 'Radar menzili',
  radarDetail: 'Radarının gelen filoyu haber verdiği alan',
  events: 'Galaksi olayları rehberi',
  /** The round button under the View chip: the disc's old Home mark. */
  home: 'Dünyana uç',
};

/** B3: bağlam yuvası, bir seferde tek kart. */
export const slot = {
  incoming: 'Gelen saldırı',
  prepare: 'Savunmayı hazırla',
  look: 'Ona bak',
  event: 'Galaksi olayı',
  show: 'Göster',
  lands: '{{time}} sonra iner',
  ends: '{{time}} sonra biter',
  pill: 'Gelen saldırı: {{count}}',
  dismiss: 'Kapat',
};

/** E4: the Fleet page — in flight, at home, the Hangar. */
export const fleetPage = {
  views: "Filo görünümleri",
  air: "Havada",
  home: "Evde",
  bays: "Uçuş yuvaları",
  hangar: "Hangar",
  pace: "%{{pct}} hız",
  recall: "Geri çağır",
  recallHome: "Geri çağırırsan {{time}} içinde evde",
  recalling: "Dönüyor…",
  emptyAir: "Havada bir şey yok. Gemi göndermek için galakside bir dünyaya, kayaya ya da korsana dokun.",
  shipsHome_one: "Evde {{count}} gemi",
  shipsHome_other: "Evde {{count}} gemi",
  away: "{{count}} dışarıda",
  noShips: "Evde gemi yok",
  capital: "Başkent",
  colony: "Koloni",
  roomRule: "Dünyanın sahip olduğu her gemi için yer — evde, dışarıda ve tersanede. Dolu Hangar tersaneyi ve gelen transferi durdurur; geri çağrılan filo her zaman sığar.",
  ground: "Yer savunması",
  ceiling: "bu Çekirdek’le en çok {{shown}}",
  full: "Dolu",
};
