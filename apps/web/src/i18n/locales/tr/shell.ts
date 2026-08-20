/**
 * HİÇ KAYBOLMAYAN ÇERÇEVE — üst şerit, uçuş şeridi, Sinyaller ve her yüzeyin
 * yapıldığı mobilya.
 *
 * "Works" için Türkçesi HAVUZ: üretimin biriktiği, dolduğunda duran ve elle
 * boşaltılan yer. "İşlik" fazla teknik, "ocak" madenle karışıyor; havuz hem
 * dolar hem taşar ve ekrandaki iki kabın resmiyle birebir örtüşür.
 */

export const statusBar = {
  alloyLabel: 'Alaşım',
  crystalLabel: 'Kristal',
  storeFull: 'DOLU',
  storeFree: '{{amount}} yer var',
  commanderHint: 'Komutan {{name}} — sezon, galaksi ve çıkış',
  seasonUnknown: '—',
  intelHint: 'İstihbarat — bildiklerin',
  bays: {
    hint: '{{total}} rampanın {{used}} tanesi dolu',
    label: 'Havada',
    free: '{{count}} boş',
  },
  works: {
    label: 'Havuz',
    labelFull: 'Havuz dolu',
    collect: 'Topla',
    idle: '—',
    hintFull: 'Havuz doldu, hemen topla',
    hintCollect: '{{amount}} topla',
    collected: '{{amount}} toplandı',
    collectedPartly: '{{moved}} toplandı, {{held}} sığmadı',
    storeFull: 'Depo dolu',
  },
} as const;

export const pendingStrip = {
  empty: 'Havada bir şey yok',
  incoming: 'Filo geliyor',
  probe: 'Sondan → {{target}}',
  fleetHome: 'Filon dönüyor · {{target}}',
  fleetOut: 'Filon → {{target}}',
  more: '+{{count}}',
} as const;

export const signals = {
  beacon: 'Sinyaller',
  beaconUnread: 'Sinyaller — {{count}} okunmamış',
  title: 'Sinyaller',
  eyebrowUnread: '{{count}} yeni',
  eyebrowRead: 'Sana bildirilen her şey',
  statusHeading: 'Şu anda',
  eventsHeading: 'Neler oldu',
  empty:
    'Henüz bir şey yok. Sana bir filo yöneldiğinde, bir sonda yakalandığında ve gemilerin eve döndüğünde galaksi haber verir.',
  repeat: '×{{count}}',

  status: {
    disruptedLine: 'Havuzun devre dışı',
    disruptedDetail: 'Akın yedin. Üretim {{duration}} sonra başlıyor.',
    worksStoppedLine: 'Havuz durdu',
    worksStoppedDetail: 'Dolu ve boşta. Saatte {{amount}} çöpe gidiyor; topla.',
    alloyStoreLine: 'Alaşım deposu dolu',
    crystalStoreLine: 'Kristal deposu dolu',
    storeDetail: 'Havuzda {{amount}} bekliyor ama gidecek yeri yok. Bir şeye harca.',
  },
} as const;

export const sheet = {
  close: 'Kapat',
  dismiss: 'Kapat',
} as const;

export const surface = {
  unreachable: '{{what}} okunamadı.',
  retry: 'Tekrar dene',
  whatPlanet: 'Gezegenin',
  whatIntel: 'Bildiklerin',
  whatReports: 'Savaş raporların',
  waitingPlanet: 'Gezegen okunuyor',
  waitingIntel: 'Toplanıyor',
  planetSigil: 'Gezegen',
} as const;
