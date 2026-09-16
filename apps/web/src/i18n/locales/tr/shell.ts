/**
 * HİÇ KAYBOLMAYAN ÇERÇEVE — üst şerit, uçuş şeridi, Sinyaller ve her yüzeyin
 * yapıldığı mobilya.
 *
 * "Works" için Türkçesi HAVUZ: üretimin biriktiği, dolduğunda duran ve elle
 * boşaltılan yer. "İşlik" fazla teknik, "ocak" madenle karışıyor; havuz hem
 * dolar hem taşar ve ekrandaki iki kabın resmiyle birebir örtüşür.
 */

export const statusBar = {
  activeWorld: 'Aktif dünya',
  capitalWorld: 'ANA GEZEGEN · {{name}}',
  colonyWorld: 'KOLONİ · {{name}}',
  alloyLabel: 'Alaşım',
  crystalLabel: 'Kristal',
  deuteriumLabel: 'Döteryum',
  storeFull: 'DOLU',
  storeFree: '{{amount}} yer var',
  menuHint: 'Komutan {{name}}; liderlik tablosu, ödüller, duyurular, yardım ve hesap',
  menuWaiting: '{{count}} ödül bekliyor',
  clanWaiting: '{{count}} klan gelişmesi bekliyor',
  newcomerShield: {
    hint: '{{duration}} boyunca sana akın yapılamaz',
  },
  recoveryShield: {
    hint: 'Toparlanma kalkanı: {{duration}} boyunca sana akın yapılamaz',
  },
  bays: {
    hint: '{{total}} rampanın {{used}} tanesi dolu',
    label: 'Rampa',
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
  empty: 'Devam eden uçuş yok',
  openFlights: 'Havadaki araçları aç',
  sheetEyebrow: 'Havadaki araçların',
  sheetTitle: 'Havada',
  sheetEmpty: 'Henüz havada bir aracın yok.',
  incoming: 'Filo geliyor',
  /** Ve hangi dünyaya geldiği. Radar ürünü değil; kendi dünyan. */
  incomingAt: 'Geliyor → {{world}}',
  incomingFromAt: 'Geliyor → {{world}} · {{origin}} yönünden',
  probe: 'Sondan → {{target}}',
  deathStar: 'Ölüm Yıldızın → {{target}}',
  settlement: 'Yerleşim → {{target}}',
  transfer: 'Aktarım → {{target}}',
  pirateOut: 'Akın → {{target}}',
  pirateHome: 'Akın dönüyor · {{target}}',
  tradeOut: 'Konvoy → Ticaret Gemisi',
  tradeHome: 'Konvoy dönüyor · Ticaret Gemisi',
  intergalacticConvoyOut: 'Akın → Galaksilerarası Konvoy',
  intergalacticConvoyHome: 'Akın dönüyor · Galaksilerarası Konvoy',
  fleetHome: 'Filon dönüyor · {{target}}',
  fleetOut: 'Filon → {{target}}',
  engaging: 'Çatışıyor',
  more: '+{{count}}',
  drillOut: 'Kazıcıların → asteroit',
  drillHome: 'Kazıcıların eve dönüyor',
  salvageOut: 'Kazıcıların → enkaz',
  drillCount: '{{count}} Kazıcı',
  recallProspectors: 'Kazıcıları geri çağır',
  recallingProspectors: 'Geri çağrılıyor…',
  recallStarted: 'Kazıcılar rotayı çevirdi · eve dönüyor',
  craftCount: '{{count}} araç',
  craftUnknown: 'Araç dökümü bilinmiyor',
  incomingHint: 'Yaklaşan tehdit · kaynak sisin ardında',
  /** Aynı uyarı, araç senin diskinde görünürken. D162. */
  incomingVisible: 'Yaklaşan tehdit · sensörlerinde — bakmak için dokun',
  incomingFrom: '{{origin}} yönünden geliyor',
  massLight: 'Küçük bir filo geliyor',
  massMedium: 'Orta büyüklükte bir filo geliyor',
  massHeavy: 'Büyük bir filo geliyor',
} as const;

export const signals = {
  beacon: 'Sinyaller',
  beaconUnread: 'Sinyaller — {{count}} okunmamış',
  title: 'Sinyaller',
  eyebrowUnread: '{{count}} yeni',
  eyebrowRead: 'Bildirim geçmişi',
  statusHeading: 'Şu anda',
  eventsHeading: 'Neler oldu',
  openEvent: 'İlgili raporu aç',
  worldEvent: 'Galaksi olayı',
  empty:
    'Henüz bildirim yok. Sana bir filo yöneldiğinde, bir sonda yakalandığında ve gemilerin eve döndüğünde galaksi haber verir.',
  repeat: '×{{count}}',

  status: {
    disruptedLine: 'Havuzun devre dışı',
    disruptedDetail: 'Akın yedin. Üretim {{duration}} sonra başlıyor.',
    worksStoppedLine: 'Havuz durdu',
    worksStoppedDetail: 'Havuz dolu. Toplayana kadar saatte {{amount}} üretim yapılamıyor.',
    alloyStoreLine: 'Alaşım deposu dolu',
    crystalStoreLine: 'Kristal deposu dolu',
    storeDetail: 'Havuzda {{amount}} bekliyor ama depoda yer yok. Kaynak harcayıp yer aç.',
  },
} as const;

export const sheet = {
  back: 'Geri',
  close: 'Kapat',
  dismiss: 'Kapat',
} as const;

export const toast = {
  dismiss: 'Mesajı kapat',
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
  whatChronicle: 'Galaksi Nabzı',
  whatAnnouncements: 'Duyurular',
  whatAdminFeedback: 'oyuncu geri bildirimleri',
  waitingPlanet: 'Gezegen okunuyor',
  waitingIntel: 'Toplanıyor',
  waitingLeaderboard: 'Galaksi sıralanıyor',
  waitingChat: 'Galaksi sohbeti açılıyor',
  waitingChronicle: 'Galaksi okunuyor',
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
  seasonHeading: 'Bu sezon',
  asteraHeading: 'Astera ekibi',
  helpHeading: 'Yardım',
  deviceHeading: 'Bu cihaz',
  marksHeading: 'İşaretlerin',
  intelLabel: 'İstihbarat',
  intelHint: 'İzlediğin dünyalar, Radar kayıtları, sondalar ve savaş raporları',
  rewardsLabel: 'Ödüller',
  rewardsHint: 'Galakside tamamladığın hedeflerden kazandığın kaynaklar',
  guideLabel: 'Hızlı başlangıç',
  guideHint: 'İlk hamleler, yapılması gereken sırayla',
  rewardsWaiting: '{{count}} hazır',
  researchLabel: 'Araştırma',
  researchHint: 'Bir kez tamamlanan ve sahip olduğun bütün dünyalarda geçerli olan projeler',
  leaderboardLabel: 'Liderlik tablosu',
  leaderboardHint: 'Galaksideki bütün komutanların Hâkimiyet sırası',
  announcementsLabel: 'Duyurular',
  announcementsHint: 'Astera ekibinden haberler, güncellemeler ve kısa notlar',
  announcementsWaiting: '{{count}} yeni',
  feedbackLabel: 'Geri bildirim',
  feedbackHint: 'Astera ekibine hata bildir, öneri ilet veya görüşünü paylaş',
  clanLabel: 'Klan',
  clanHint: 'En fazla beş komutanlık bir ekibe katıl veya kendi klanını kur',
  clanMemberLabel: 'Klan · [{{tag}}]',
  clanMemberHint: 'Üyeler, yardımlar, ortak ganimet, klan kaydı ve özel sohbet',
  clanWaiting: '{{count}} bekliyor',
  rivalLabel: 'Rakibin · {{commander}}',
  rivalHint: '{{planet}} dünyasına odaklan ve sonraki hamleni seç',
  rivalLostLabel: 'Rakip sinyali kayboldu',
  rivalLostShort: 'Kayıp işaret',
  rivalLostHint: 'O dünya artık yok. İşareti temizle.',
  rivalCleared: 'Kayıp Rakip işareti temizlendi.',
  accountHeading: 'Hesap',
  soundLabel: 'Ses',
  soundOn: 'Müzik çalıyor.',
  soundOff: 'Bu cihazda kapalı.',
  volumeLabel: 'Müzik seviyesi',
  volumeValue: '%{{volume}}',
  /**
   * ÇÖZÜNÜRLÜK. Üç kademe, her biri tek kelime — üçü yan yana 350 piksele sığmak
   * zorunda. Altındaki cümle seçili kademenin kendisine ait: kademenin adı ne
   * kazandırdığını söylemiyor, cümle söylüyor.
   */
  qualityLabel: 'Görüntü kalitesi',
  quality: {
    high: 'Yüksek',
    balanced: 'Dengeli',
    low: 'Düşük',
  },
  qualityHint: {
    high: 'Tam çözünürlük. En keskin görüntü, en çok pil.',
    balanced: 'Çözünürlük dörtte üçe iner. Fark zor görülür, ısınma belirgin azalır.',
    low: 'Yarım çözünürlük, kenar yumuşatma kapalı. Eski telefonlar için.',
  },
} as const;

export const leaderboard = {
  eyebrow: 'Yerel galaksi',
  title: 'Liderlik tablosu',
  empty: 'Bu galaksiye henüz bir komutan katılmadı.',
  rank: '{{rank}}. sıra',
  tier: '{{tier}}. kademe',
  score: 'Hâkimiyet',
  you: 'Sen',
  searchLabel: 'Komutan, gezegen veya klan ara',
  searchPlaceholder: 'Komutan, gezegen veya klan',
  noMatch: 'Bu aramayla eşleşen komutan, gezegen veya klan yok.',
  locationUnknown: 'Bu kişinin konumunu henüz keşfetmediniz.',
  /*
    SEZON İÇİ ÖDÜL — oyuncunun "ben ne için oynuyorum" sorusunun cevabı.
    Sıralamanın hemen üstünde durur, çünkü karar orada veriliyor.
  */
  rewards: {
    title: 'Sezon sonu ödülü',
    left: 'bitmesine {{duration}}',
    explain: 'Sezon bittiğinde ilk {{places}} komutan, yeni galaksiye kaynakla başlar.',
    table: 'Sıraya göre ödüller',
    rowPrizeLabel: 'Sonraki sezon ödülü: {{alloy}} alaşım, {{crystal}} kristal, {{deuterium}} döteryum',
    holding: '{{place}}. sıra · bunu kazanıyorsun',
    paidWhen: 'Yeni sezonda dünyanı kurduğun anda hesabına geçer.',
    standing: '{{place}}. sıradasın',
    behind: 'İlk {{places}} arasına girmek için {{score}} Hâkimiyet daha lazım.',
    climb: 'İlk {{places}} arasına gir, ödülü al.',
    unranked: 'Bu galaksiye katıl ve sıralamaya gir.',
  },
  archive: {
    selectorLabel: 'Sezon kayıtları',
    archiveIndex: 'Sezon kayıtların',
    waitingArchive: 'Sezon kayıtları yükleniyor',
    live: 'Canlı sezon',
    seasonChoice: 'Sezon {{ordinal}} · {{galaxy}}',
    seasonNumber: 'Sezon {{ordinal}}',
    seasonHeading: 'Sezon {{ordinal}} · {{galaxy}}',
    /* Sıra tek başına övünülecek bir şey değil; payda olmadan anlamı yok. */
    percentile: 'İlk %{{share}} · {{commanders}} komutan içinde {{rank}}.',
    fieldSize: '{{count}} komutan',
    medals: 'Kupalar',
    signature: 'İmza gemin',
    leadWorks: 'Havuzların çıkardığı',
    leadProduced: 'Havuzların toplam çıkardığı',
    leadRuns: '{{count}} asteroid seferinden',
    signatureCount: '{{count}} tane ürettin',
    multiple: '×{{value}} kat',
    share: '%{{value}}',
    loadingOlder: 'Eski sezonlar yükleniyor',
    completedBoard: 'Tamamlanmış sezon sıralaması',
    waitingBoard: 'Tamamlanmış sıralama açılıyor',
    emptyBoard: 'Bu galaksi için kayıtlı komutan sonucu yok.',
    searchLabel: 'Tamamlanmış sezonda komutan ara',
    searchPlaceholder: 'Komutan',
    noMatch: 'Bu aramayla eşleşen komutan yok.',
    openCommander: '{{commander}} sezon karnesini aç',
    openSeasonRecord: 'Sezon {{ordinal}} · {{galaxy}} karnesini aç',
    commanderCard: 'komutan sezon karnesi',
    waitingProfile: 'Komutan karnesi açılıyor',
    back: 'Sezon sıralamasına dön',
    profileViews: 'Komutan karnesi görünümleri',
    seasonTab: 'Sezon {{ordinal}}',
    overall: 'Genel',
    cohort_one: 'Diğerleri = bu sezondaki {{count}} komutanın ortalaması',
    cohort_other: 'Diğerleri = bu sezondaki {{count}} komutanın ortalaması',
    /** Üç sütunlu kırılımda satır kısaltılıyor; uzun cümle bir kez yukarıda. */
    averageShort: 'Diğerleri: {{value}}',
    statsUnavailable: 'Bu sezonun ayrıntılı kaydı tutulmamış.',
    statsUnavailableHint: 'Sıran ve unvanın duruyor. O sezon ölçülmemiş olan şeyler sıfır gibi gösterilmiyor.',
    none: 'Yok',
    ratios: {
      trade: 'Hasar takası',
      haul: 'Akın başına ganimet',
      kept: 'Filoda kalan',
      convoy: 'Konvoy isabeti',
      hourly: 'Saatlik üretim',
      perRun: 'Sefer başına asteroid',
    },
    sections: {
      form: 'Form ve verim',
      competition: 'Rekabet ve savaş',
      economy: 'Ekonomi ve üretim',
      exploration: 'Keşif ve fırsat',
    },
    metrics: {
      finalRank: 'Nihai sıra',
      battles: 'Savaşlar',
      shipsBuilt: 'Üretilen gemi',
      shipsLost: 'Kaybedilen gemi',
      shipsBuiltByHull: 'Gemi türüne göre üretilen',
      shipsLostByHull: 'Gemi türüne göre kaybedilen',
      playerLoot: 'Komutanlardan ganimet',
      productiveTime: 'Tüm dünyalarda üretim süresi',
      produced: 'Havuzların ürettiği',
      asteroidRuns: 'Asteroid seferi',
      asteroidMined: 'Asteroidlerden çıkarılan',
      convoyAttempts: 'Konvoy denemesi',
      convoySuccesses: 'Başarılı konvoy',
      convoyDelivered: 'Teslim edilen konvoy ödülü',
    },
    resources: {
      alloy: 'Alaşım',
      crystal: 'Kristal',
      deuterium: 'Döteryum',
    },
    career: {
      completed: 'Tamamlanan sezon',
      bestRank: 'En iyi derece',
      championships: 'Şampiyonluk',
      podiums: 'Podyum',
      topTen: 'İlk 10',
      noTelemetry: 'Ayrıntılı kaydı olan tamamlanmış sezon henüz yok.',
      recordedTotals: 'Kaydedilmiş kariyer toplamları',
      covered_one: '{{count}} sezon kapsanıyor',
      covered_other: '{{count}} sezon kapsanıyor',
      seasons: 'Sezon sezon',
    },
  },
} as const;

export const chat = {
  eyebrow: 'Canlı kanallar',
  title: 'Sohbet',
  launcher: 'Galaksi sohbetini aç',
  launcherUnread: 'Galaksi sohbetini aç — {{count}} okunmamış',
  launcherClanUnread: 'Sohbeti aç — Klanda {{count}} okunmamış',
  launcherBothUnread: 'Sohbeti aç — Genelde {{general}}, Klanda {{clan}} okunmamış',
  channelsLabel: 'Sohbet kanalları',
  general: 'Genel',
  clan: 'Klan',
  channelUnread: '{{channel}} — {{count}} okunmamış',
  clanLocked: 'Klan sohbeti yalnız ekibine açıktır.',
  clanLockedHint: 'Bir klana katıl veya klan kur; bu kanal hemen açılır.',
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

export const crash = {
  title: 'Bir şeyler bozuldu',
  body: 'Arayüz çizmeyi durdurdu. Yeniden yüklemek seni diske geri getirir — galakside hiçbir şey kaybolmadı.',
  reload: 'Yeniden yükle',
  detailShow: 'Ayrıntıyı göster',
  detailHide: 'Ayrıntıyı gizle',
  copy: 'Raporu kopyala',
  copied: 'Kopyalandı — bize gönder',
  copyFailed: 'Kopyalanamadı. Ayrıntının ekran görüntüsünü al.',
} as const;
