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
  menuHint: 'Komutan {{name}}; istihbarat, liderlik tablosu, ödüller ve hesap',
  menuWaiting: '{{count}} ödül bekliyor',
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
  openEvent: 'İlgili raporu aç',
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
  whatRewards: 'Ödüllerin',
  whatLeaderboard: 'Hâkimiyet sıralaması',
  whatChat: 'galaksi sohbeti',
  waitingPlanet: 'Gezegen okunuyor',
  waitingIntel: 'Toplanıyor',
  waitingLeaderboard: 'Galaksi sıralanıyor',
  waitingChat: 'Galaksi sohbeti açılıyor',
  planetSigil: 'Gezegen',
} as const;

/**
 * MENÜ — galaksi dışındaki her şeye tek giriş.
 *
 * Buradaki her dize kendine ait; başka bir yerdeki etiketle aynı okunanlar bile.
 * İstihbaratı açan satır, eskiden onu açan başlık düğmesi değildir; biri yeniden
 * yazıldığında diğeri onunla birlikte kaymamalı.
 */
export const menu = {
  eyebrow: 'Komutan',
  intelLabel: 'İstihbarat',
  intelHint: 'Teleskop, sondalar, radar ve savaş raporları',
  rewardsLabel: 'Ödüller',
  rewardsHint: 'Galaksinin sana oynadığın için borcu',
  rewardsWaiting: '{{count}} hazır',
  leaderboardLabel: 'Liderlik tablosu',
  leaderboardHint: 'Bütün komutanların Hâkimiyet sırası',
  accountHeading: 'Hesap',
  soundLabel: 'Ses',
  soundOn: 'Müzik çalıyor.',
  soundOff: 'Bu cihazda kapalı.',
} as const;

export const leaderboard = {
  eyebrow: 'Yerel galaksi',
  title: 'Liderlik tablosu',
  empty: 'Bu galaksiye henüz bir komutan katılmadı.',
  rank: '{{rank}}. sıra',
  tier: '{{tier}}. kademe',
  score: 'Hâkimiyet',
  you: 'Sen',
} as const;

export const chat = {
  eyebrow: 'Bu galakside canlı',
  title: 'Galaksi Sohbeti',
  launcher: 'Galaksi sohbetini aç',
  launcherUnread: 'Galaksi sohbetini aç — {{count}} okunmamış',
  list: 'Galaksi mesajları',
  empty: 'Henüz kimse konuşmadı. Galaksideki ilk ses sen ol.',
  older: 'Eski mesajları yükle',
  loadingOlder: 'Eski mesajlar yükleniyor',
  placeholder: 'Galaksiye mesaj yaz',
  send: 'Gönder',
  remaining: '{{count}} karakter kaldı',
  time: {
    justNow: 'şimdi',
    minutes_one: '{{count}} dakika önce',
    minutes_other: '{{count}} dakika önce',
    hours: '{{hours}} sa {{minutes}} dk önce',
    days_one: '{{count}} gün önce',
    days_other: '{{count}} gün önce',
  },
} as const;
