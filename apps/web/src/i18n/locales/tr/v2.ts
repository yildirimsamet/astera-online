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
  need: '{{resource}}: {{have}} / {{need}}, {{short}} eksik',
  short: '{{amount}} eksik',
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

/** The battle report scene (B15), the mock's "KISMİ ZAFER" page. */
export const reportScene = {
  eyebrow: "Savaş raporu · {{planet}}",
  rounds_one: "{{count}} tur",
  rounds_other: "{{count}} tur",
  you: "Sen",
  destroyed: "{{count}} yok edildi",
  hidden: "Kalanları ve sahaya çıkardığı filo gizli; rapor yalnızca yok ettiğini söyler.",
  whyHeading: "Neden?",
  why: "Kayıplarının çoğu {{lost}}: {{by}} onlara karşı güçlü, {{bring}} de {{by}} karşısında güçlü.",
  balance: "Bilanço",
  balanceLoot: "ganimet {{amount}}",
  balanceFuel: "yakıt −{{amount}}",
  balanceLost: "kayıp {{list}}",
  balanceNone: "kayıp yok",
  cargoFull: "ambar doldu",
  colonyRule: "Koloni sadakati: kesin zafer {{decisive}}, kısmi zafer {{partial}} düşürür.",
  again: "Yeniden saldır",
} as const;

/** K6: the switch at the top of the Base — this world, or the commander's research. */
export const baseSwitch = {
  label: 'Üs',
  world: 'Bu dünya',
  research: 'Araştırma',
} as const;

/** E8 · K9: the research constellation. */
export const researchMap = {
  label: 'Araştırma haritası',
  closed: '{{group}} · kapalı',
  /** The strategic three while their release switch is off: the server refuses them. */
  shut: 'Şimdilik kapalı',
  /** A prerequisite already held, said on the card. */
  needs: 'Önkoşul: {{name}}',
  /** The next rung of a ladder that opens a hull, and the one rung of a permission. */
  opensAt: '{{level}}. seviye açar',
  opens: 'Açar',
} as const;

export const roomBar = {
  hangar: 'Hangar odası',
  ground: 'Yer odası',
  home: 'evde {{value}}',
  away: 'dışarıda {{value}}',
  queued: 'sırada {{value}}',
  incoming: 'bu sipariş {{value}}',
  free: 'boş {{value}}',
  reading: '{{label}}: {{total}} yerin {{used}} kadarı dolu',
  returnFits: 'Dönen filo her zaman sığar: dışarıdaki gemiler yerini korur.',
  nextHangar: 'Hangar {{level}} odayı {{from}} → {{to}} yapar.',
  gunsStay: 'Toplar dünyadan ayrılmaz.',
  nextCore: 'Komuta Çekirdeği {{level}} odayı {{from}} → {{to}} yapar.',
};

export const away = {
  eyebrow: '{{duration}} yoktun',
  title: 'Sen yokken',
  all: 'Tümü ({{count}})',
  done: 'Tamam',
  taken: '{{loot}} alındı · {{lost}} birim kaybı',
  held: 'Hattı tutarken {{lost}} birim kaybı',
  looted: '+{{loot}} ganimet · {{lost}} gemi kaybı',
  scan_one: 'Bir tarama seni buldu',
  scan_other: '{{count}} tarama seni buldu',
  scanDetail: 'Biri senin resmini çıkarıyor.',
  convoySecured: 'Konvoy ödülleri alındı',
  convoyDelivered: 'Konvoy ödülleri teslim edildi',
  convoyDetail_one: '+{{resources}} kaynak · {{count}} ödül gemisi',
  convoyDetail_other: '+{{resources}} kaynak · {{count}} ödül gemisi',
  accrued: '+{{alloy}} alaşım · +{{crystal}} kristal',
  accruedDetail: 'Sen yokken üretildi',
  door: {
    report: 'Rapor',
    intel: 'Radar',
    base: 'Üs',
    orbit: 'Kur',
    signals: 'Sinyaller',
  },
};

export const outline = {
  label: 'Taslak',
  worlds: 'Dünyalar',
  air: 'Havada',
  airEmpty: 'Havada filo yok — bir dünyanın kartından gönder.',
  queues: 'Kuyruklar',
  research: 'Araştırma',
  idle_one: 'Boş · {{count}} yer açık',
  idle_other: 'Boş · {{count}} yer açık',
  filled: '{{count}} / {{total}}',
  threat_one: '{{count}} saldırı geliyor',
  threat_other: '{{count}} saldırı geliyor',
};
