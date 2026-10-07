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
  baseWaiting: 'Onarılacak bir şey var',
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
  /** An order behind the head of its lane: no clock yet (2026-10-06). */
  queued: "Öndeki iş bitince başlar",
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
  damageTitle: "Hasarlı çıkanlar",
  damageLot: "{{name}} ×{{count}} · %{{pct}} hasar",
  toDock: "Tamirhaneye",
  patched: "ücretsiz onarıldı",
  landing: "Eve inince değerlendirilir: %20'yi aşan onarım bekler, gerisi ücretsiz onarılır.",
  eyebrow: "Savaş raporu · {{planet}}",
  rounds_one: "{{count}} tur",
  rounds_other: "{{count}} tur",
  you: "Sen",
  destroyed: "{{count}} yok edildi",
  hidden: "Kalanları ve sahaya çıkardığı filo gizli; rapor yalnızca yok ettiğini söyler.",
  whyDecisive: "Kayıplar nereden geldi",
  whyPartial: "Neden kısmi?",
  whyRepelled: "Neden püskürtüldü?",
  why: "Kayıplarının çoğu {{lost}}: {{by}} onlara karşı güçlü, {{bring}} de {{by}} karşısında güçlü.",
  balance: "Bilanço",
  balanceLoot: "ganimet {{amount}}",
  balanceFuel: "yakıt −{{amount}}",
  balanceLost: "kayıp {{list}}",
  balanceNone: "kayıp yok",
  cargoFull: "ambar doldu",
  intel: "{{planet}} savunması {{time}} itibarıyla dosyasında",
  loyalty: "koloni sadakati −{{amount}}",
  watch: "İzle",
  share: "Klana",
  shareLine: "{{planet}}: {{word}} · ganimet {{loot}} · kayıp {{lost}}",
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
  /** The strategic three while their release switch is off: the server refuses them. */
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
  done: 'Galaksiye dön',
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
    report: 'Raporu aç',
    intel: 'Radarı aç',
    base: 'Üsse git',
    orbit: 'Kur',
    signals: 'Sinyalleri aç',
    dossier: 'Dosyayı aç',
    repair: 'onar',
  },
  sighting: '{{planet}} filosu dışarıda',
  sightingBack: 'Dönüş ~{{time}} · Teleskop gördü',
  sightingSeen: 'Teleskop gördü',
  careLoyalty: '{{world}} sadakati %{{loyalty}}',
  careFaults_one: '{{count}} arıza duruyor',
  careFaults_other: '{{count}} arıza duruyor',
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

/** The Repair Station (Kalıcı gemi hasarı, `plan.md` F4/F6). */
export const repairStation = {
  order: "Onarım · {{name}}",
  all: "karışık gemiler",
  title: "Tamirhane",
  role: "Hasarlı gemiler onarılana kadar burada bekler.",
  tagline: "Hasarlı gemileri filoya geri kazandırır.",
  idle: "Bu dünyada hasarlı gemi yok.",
  waitingShips_one: "{{count}} gemi bekliyor",
  waitingShips_other: "{{count}} gemi bekliyor",
  repairingShips_one: "{{count}} onarımda",
  repairingShips_other: "{{count}} onarımda",
  queueFill: "Kuyruk {{used}}/{{total}}",
  statWaiting: "Bekliyor",
  statRepairing: "Onarımda",
  statQueue: "Kuyruk",
  outOfAction: "%20'den fazla hasar alan gemi burada bekler: onarılana kadar uçamaz, savunmaya katılamaz.",
  howItWorks: "Nasıl çalışır",
  ruleFree: "Savaştan ya da radyasyondan gelen %20 ve altı hasar ücretsiz onarılır.",
  rulePrice: "Fiyat: yeni geminin hasar oranı kadarı. %40 hasarlı bir gemi, yenisinin %40'ı kadar tutar.",
  ruleTime: "Süre: üretim süresinin aynı oranı. {{shipyard}} seviyesi ve {{automation}} bu süreyi kısaltır.",
  ruleIndustrial: "{{industrial}} araştırması fiyatı ve süreyi önce %75'e, sonra %50'ye indirir.",
  youPay: "Şu an %{{pct}} ödüyorsun.",
  ruleQueue: "İşler sırayla yapılır; kuyrukta en fazla {{depth}} iş olur ve Tersane kuyruğundan bağımsızdır.",
  ruleCancel: "İptal edersen bedelin yarısı geri döner; gemiler yeniden beklemeye geçer.",
  industrialChip: "{{industrial}} −%{{off}}",
  damagedHeading: "Hasarlı gemiler",
  selectAll: "Tümünü seç",
  selectNone: "Temizle",
  choose: "{{name}} ×{{count}} onar",
  noneWaiting: "Onarım bekleyen gemi yok.",
  damaged: "%{{pct}} hasarlı",
  share: "yeni geminin %{{pct}} kadarı",
  queueHeading: "Onarım kuyruğu",
  queueEmpty: "Onarımda gemi yok.",
  finishing: "Bitiyor…",
  startsIn: "{{time}} sonra başlar",
  ends: "{{time}} içinde biter",
  selected_one: "{{count}} gemi seçili",
  selected_other: "{{count}} gemi seçili",
  afterQueue: "Kuyruk bitince başlar · {{time}} sonra",
  repairSelected_one: "{{count}} gemiyi onar",
  repairSelected_other: "{{count}} gemiyi onar",
  pick: "Onarılacak gemileri seç",
  queueFullShort: "Kuyruk dolu · {{used}}/{{total}}",
  tooMany: "En fazla {{max}} satır seç ya da tümünü seç",
  starting: "Başlıyor…",
  cancel: "İptal",
  docked_one: "{{count}} tamirde",
  docked_other: "{{count}} tamirde",
  started: "Onarım başladı",
  queue: "Tamirhane",
};
