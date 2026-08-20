/**
 * KENDİ GEZEGENİN — dört karar başlığı, satırları, satırın arkasındaki detay
 * sayfası ve saldırı planlayıcısı.
 *
 * SEKME ADLARI HEPSİ AD, HİÇBİRİ EMİR DEĞİL. İngilizcesi Defend / Orbit / Reach /
 * Grow: ikisi fiil, ikisi ad, ve İngilizcede bu karışım göze batmaz. Türkçede
 * "Savun / Yörünge / Menzil / Büyüt" diye karışık dizmek sekme çubuğunu dağıtır,
 * çünkü Türkçede emir kipi doğrudan oyuncuya seslenir ve ad öyle değildir. Dördü
 * de ad oldu: Üretim · Yörünge · Savunma · Filo. Sekme "burada ne var" der,
 * altındaki soru "burada neye karar veriyorsun" der.
 */

export const planet = {
  tabs: {
    defendProblem: 'Savunma',
    defendQuestion: 'Biri buraya inerse ayakta ne kalır?',
    orbitProblem: 'Yörünge',
    orbitQuestion: 'Yörüngede dört uydu, gezegende dört cihaz. İstediğini, istediğin sırayla.',
    reachProblem: 'Filo',
    reachQuestion: 'Ne gönderebilirsin, nereye kadar?',
    growProblem: 'Üretim',
    growQuestion: 'Ne kadar cevher çıkarıyorsun, nereye kadar inşa edebiliyorsun.',
  },

  wallet: {
    inTheWorks: 'havuzda <0>{{amount}}</0>',
  },

  roles: {
    vault: 'Akının dokunamadığı tek stok. Üstünde kalan her şey alınabilir.',
    shipyard: 'Daha ağır gövdeleri açar, gönderdiğin her sondayı keskinleştirir.',
    refinery: 'İnşa ettiğin her şey bu sayıyı bekliyor.',
    extractor: 'Kıt kaynak. Ağır gövdeler ve yüksek bina seviyeleri buna bakıyor.',
    coreCapped_one: '{{count}} şey tavana dayandı; bu yükselmeden açılmıyor.',
    coreCapped_other: '{{count}} şey tavana dayandı; bu yükselmeden açılmıyorlar.',
    coreClear: 'Hiçbir bina Çekirdeği geçemez. Her şeyin tavanı o.',
  },

  defend: {
    groundBand: 'Yerdekiler',
    groundNote:
      'Buradan hiç ayrılmazlar. Biri neye zayıfsa öteki ona güçlü; tek çeşit dizersen, seni gözetleyen akıncı tam onun karşıtıyla gelir.',
    thornNone: 'Hafif toplar. Ağır gövdeleri biçerler, Mızraklar onları teker teker toplar.',
    thornStanding: 'Yerde {{count}} tane var. Ağırlara güçlü, Mızraklara zayıf.',
    thornGain: 'Diken',
    bastionNone: 'Ağır toplar. Mızrakları kırarlar, Atmaca sürüsünün altında ezilirler.',
    bastionStanding:
      'Yerde {{count}} tane var. Mızraklara güçlü, sürülere zayıf. Kaybettiklerinin %60’ı bedavaya geri gelir.',
    groundGain: 'Yerdeki birlik',
    aegisPointer: 'Kalkan bir donanım; <0>{{name}}</0> Yörünge sekmesinde.',
  },

  orbit: {
    inOrbitBand: 'Yörüngede',
    inOrbitNote: 'Her biri bir yuva kaplar. Bir kez alınır, seviyesi yoktur.',
    onPlanetBand: 'Gezegende',
    onPlanetNote:
      'Yuva istemez. Bunların seviyesi var; Komuta Çekirdeğin izin verdiği kadar yükseltirsin.',
    slotsFree_one: 'Yukarıda {{count}} yuva daha boş',
    slotsFree_other: 'Yukarıda {{count}} yuva daha boş',
    slotsNone: 'yörünge dolu',
    slotsUsed: '{{used}}/{{total}}',
    slotsNext: ' · Çekirdek L{{level}}’de +1',
    alreadyInOrbit: 'zaten yörüngede',
  },

  reach: {
    warshipsBand: 'Savaş gemileri',
    warshipsNote: 'Bunlar dövüşür. Başka bir gezegene gönderilir.',
    supportBand: 'Destek',
    supportNote: 'Dövüşmez. Filonun aldığını taşımak için gider.',
    miningBand: 'Madenci',
    miningNote: 'Gezegene değil asteroide gider. Cevheri eve getirir.',
    ownedGain: 'Elinde',
  },

  blocked: {
    core: 'Çekirdek L{{level}}',
    uplink: 'yörüngede Röle',
    orbitSlot: 'boş yörünge yuvası',
    shipyard: 'Tersane L{{level}}',
    maxed: 'en üst seviyede',
  },

  done: {
    raised: '{{name}} artık L{{level}}',
    instrument: '{{name}} L{{level}} olarak devrede',
    satellite: '{{name}} yörüngeye yerleşti',
    built: '{{count}} {{name}} yapıldı',
  },

  buildSheet: {
    eyebrowGround: 'Yer savunması · hiç kalkmaz',
    eyebrowMobile: 'Hareketli gövde',
    howMany: 'Kaç tane',
    max: 'En fazla {{count}}',
    build: '{{count}} tane yap',
    capped:
      'Elinde zaten {{count}} tane var, sınır bu. Birini gönder ve geri getir; dördüncüyü yapamazsın.',
    heldOfMax: 'Elinde {{max}} üzerinden {{owned}} var. Dışarıdakiler de sayılıyor.',
    defenceAfter: 'Sonrasında evde {{count}} birlik kalır',
  },
} as const;

export const itemSheet = {
  eyebrowNotInOrbit: 'Yörüngede değil',
  eyebrowInOrbit: 'Yörüngede',
  eyebrowNotInstalled: 'Kurulu değil',
  eyebrowLevel: 'Seviye {{level}}',
  actPutInOrbit: 'Yörüngeye çıkar',
  actAlreadyInOrbit: 'Zaten yörüngede',
  actInstall: 'Kur',
  actRaise: 'L{{level}} seviyesine çıkar',
  lockedNote: 'Kilitli. Gereken: {{reason}}.',
  shortAlloy: '{{amount}} alaşım',
  shortCrystal: '{{amount}} kristal',
  shortJoin: ' ve ',
  shortNote: '{{parts}} eksiğin var.',
  ladderHeading: 'Hangi seviye ne getiriyor',
  rungLevel: 'L{{level}}',
  rungNewHardware: 'L{{level}}’de yeni donanım',
  orbitalDoesHeading: 'Ne işe yarar',
  orbitalCostHeading: 'Neye mal olur',
  orbitalOnce: 'bir kere; asla yükseltilmez',
  orbitalFree: '{{total}} yuvadan {{free}}’i boş',
  orbitalNoSlot: 'Boş yuva yok. Komuta Çekirdeğini yükselt',
} as const;

export const upgradeRow = {
  about: '{{name}} nedir',
  nextTierAlt: '{{name}} bir üst kademede',
  becomes: 'olur',
  affordableIn: 'Bu hızla <0>{{duration}}</0> sonra alabilirsin',
} as const;

export const action = {
  verbRaise: 'Yükselt',
  verbBuild: 'Yap',
  verbInstall: 'Kur',
  verbClaim: 'Topla',
  verbSend: 'Gönder',
  short: 'Eksik',
  shortfallAlloy: '{{amount}} alaşım',
  shortfallCrystal: '{{amount}} kristal',
  shortfallJoin: ' ve ',
  shortfallLabel: 'Eksik: {{parts}} gerekiyor',
  statAttack: 'Saldırı',
  statHull: 'Gövde',
  statSpeed: 'Hız',
  statSpeedFixed: 'sabit',
  statCargo: 'Ambar',
  statCargoNone: '—',
} as const;

export const planetHero = {
  power: 'Güç',
  perHour: 'Saatte',
  perHourSuffix: '/sa',
  disrupted: 'Akın yedin, üretim durdu · {{countdown}}',
  defence: 'Savunma',
  defenceNone: 'Yok',
  defenceThin: 'Zayıf',
  defenceHeld: 'Sağlam',
  defenceShipsOnly: 'sadece {{count}} gemi',
  defenceOnGround: 'yerde {{count}} tane',
  shield: 'Kalkan',
  shieldNone: 'Yok',
  shieldAbsorbs: 'ilk darbeyi emer',
  shieldNoAegis: 'aegis yok',
  atRisk: 'Risk altında',
  atRiskSafe: '{{amount}} güvende',
} as const;

export const launch = {
  eyebrow: 'Saldırı',
  back: 'Geri',
  launching: 'Kalkıyor',
  commit: 'Gönder — geri dönüşü yok',
  chooseFleet: 'Filonu seç',
  send: '{{count}} gemi gönder',
  launched: 'Filo kalktı. {{duration}} boyunca açıktasın, evde {{count}} birlik kalıyor.',
  whileAway: 'Bu filo dışarıdayken',
  defending: 'Evi {{count}} birlik savunuyor',
  nothingSent: 'Henüz gemi seçmedin',
  exposedFor: '{{duration}} boyunca açıksın',
  oneWay: 'Tek yön',
  oneWayUnknown: '—',
  cargo: 'Ambar',
  distance: 'Mesafe',
  fleetHeading: 'Filo',
  atHome: 'evde {{count}}',
  fewer: '{{name}} azalt',
  more: '{{name}} artır',
  all: 'Hepsi',
  noShips: 'Evde gemi yok. Tersanede yap ya da dışarıdakilerin dönmesini bekle.',
  warning:
    'Bunu geri çağıramazsın. Kalktıktan sonra aşağıda ne olduğunu ancak inişini izleyerek öğrenirsin; o dönene kadar gezegeninde {{count}} birlik kalıyor.',
  fleetsave: 'Havadaki gemiler yağmalanamaz. Gezegenin yağmalanabilir.',
} as const;
