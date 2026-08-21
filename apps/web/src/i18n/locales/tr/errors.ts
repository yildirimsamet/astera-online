/**
 * HER RET CEVABI, OYUNCUNUN DİLİNDE.
 *
 * Sunucu bir reddi kararlı bir KOD, İngilizce bir cümle ve o cümlenin kurulduğu
 * sayılarla (`params`) döndürür. İstemci koda bakıp buradaki cümleyi kurar.
 *
 * Kural: cümle teşhis koymaz, ne yapılacağını söyler. "Yetersiz kaynak" bir
 * durum bildirimidir; "Kaynağın yetmiyor" oyuncunun okuduğu cümledir ve aradaki
 * fark, oyuncunun ekranda ne arayacağını bilmesidir. Hiçbiri "hata" demez —
 * bunlar hata değil, oyunun kuralı.
 */

export const errors = {
  unknown: 'Bir şeyler ters gitti',
  unreachable: 'Sunucuyla bağlantı koptu. Birazdan tekrar dene.',
  streamFailed: 'Canlı bağlantı kurulamadı',

  ALREADY_HARVESTING: 'Orada zaten aracın var',
  ALREADY_IN_ORBIT: 'O uydu zaten yörüngede',
  ALREADY_MINING: 'O kayada zaten çalışan aracın var',
  ALREADY_PLACED: 'Başka bir galakside zaten gezegenin var',
  ASTEROID_EMPTY: 'O kaya çoktan boşaltılmış',
  ASTEROID_GONE: 'O kaya diskten çıkmış',
  AT_MAX_LEVEL: '{{instrument}} en üst seviyede; daha fazla kazandıracak bir şeyi kalmadı.',
  BAD_COUNT: 'Adet pozitif bir tam sayı olmalı',
  BAD_COUNT_craft: 'En az bir araç gönder',
  BAD_COUNT_prospector: 'En az bir Kazıcı gönder',
  BAD_CREDENTIALS: 'Bu ad ve parola eşleşmiyor',
  BAD_FLEET: '{{hull}} sayısı geçersiz',
  BAD_REQUEST: 'Bu istek okunamadı',
  BAD_SESSION: 'Oturumun geçersiz ya da süresi dolmuş',
  BAD_SLOT: 'Teleskop L{{level}} en fazla {{slots}} gezegen izleyebilir',
  BASH_LIMIT: 'Bu gezegene son zamanlarda fazla yüklendin',
  CANNOT_INTERCEPT: 'Araçların yetişemeden diskten çıkacak',
  CORE_CEILING: 'Önce Komuta Çekirdeğini yükseltmen gerek',
  CROSS_SEASON: 'O gezegen başka bir galakside',
  EMPTY_FLEET: 'En az bir gemi gönder',
  FIELD_GONE: 'Geriye bir şey kalmamış',
  FLEET_ALREADY_COMMITTED: 'O gezegene yolladığın bir filo zaten var',
  FORBIDDEN: 'O gezegene saldıramazsın',
  GROUND_UNIT: '{{hull}} gezegenden ayrılamaz',
  IMMOBILE_FLEET: 'Bu filo yolculuk edemez',
  INSUFFICIENT_RESOURCES: 'Kaynağın yetmiyor',
  INSUFFICIENT_RESOURCES_probe: 'Sonda için kaynağın yetmiyor',
  INTERNAL: 'Bir şeyler ters gitti',
  NEEDS_UPLINK: 'Önce yörüngeye bir Anten koy',
  NO_FREE_BAY: '{{total}} rampanın hepsi dolu. Önce bir şeyin inmesi gerek.',
  NO_FREE_SLOT: 'Bir yuva daha için Komuta Çekirdeğini yükselt',
  NO_PLANET: 'Önce bir galaksiye katıl',
  NO_SEASON: '{{shard}} şu an kapalı',
  NO_SESSION: 'Oturum çerezi yok',
  NO_SUCH_ASTEROID: 'Böyle bir asteroit yok',
  NO_SUCH_FIELD: 'Böyle bir enkaz sahası yok',
  NO_SUCH_SERVER: 'Bu adda bir galaksi yok',
  NO_TELESCOPE: 'Önce bir Teleskop kur',
  NOT_A_WARSHIP: 'Kazıcılar maden çıkarır, akın yapmaz',
  NOT_ENOUGH_CRAFT: 'Evde sadece {{available}} Kazıcı var',
  NOT_ENOUGH_SHIPS: 'Evde yeterli {{hull}} yok',
  OUT_OF_RANGE:
    'Teleskop L{{level}} {{reach}} birim görüyor; o gezegen {{distance}} birim uzakta',
  PLANET_NOT_FOUND: 'Böyle bir gezegen yok',
  PLAYER_NOT_FOUND: 'Böyle bir oyuncu yok',
  PROBE_ALREADY_OUT: 'O gezegende çalışan bir sondan zaten var',
  PROSPECTOR_CAP: 'En fazla {{max}} Kazıcı tutabilirsin, elinde {{have}} tane var.',
  PROSPECTOR_CAP_atLimit: 'Elinde zaten {{max}} Kazıcı var; sınır bu.',
  RATE_LIMITED: 'Çok sık denedin; {{seconds}} saniye sonra tekrar dene.',
  REHEARSAL_ONLY: 'Bu dünya senin olmadan yapılamaz',
  SEASON_NOT_FOUND: 'Böyle bir sezon yok',
  SELF_ATTACK: 'Kendi gezegenine saldıramazsın',
  SELF_PROBE: 'Kendi gezegeninde ne olduğunu zaten biliyorsun',
  SELF_WATCH: 'Kendi filonun nerede olduğunu zaten biliyorsun',
  SERVER_LOCKED: '{{shard}} henüz açılmadı',
  SERVER_LOCKED_frontier: '{{shard}}, {{frontier}} dolunca açılıyor. Sen {{frontier}} galaksisine katıl.',
  SHARD_FULL: '{{shard}} dolu',
  SHIPYARD_TOO_LOW: 'Tersane L{{level}} gerekiyor',
  SLOT_COOLING: 'O yuva hâlâ yeniden kuruluyor; {{minutes}} dakika kaldı',
  TIER_BAND: 'O gezegen senden iki kademeden fazla uzakta',
  UNAUTHENTICATED: 'Önce giriş yap',
  UNKNOWN: 'Bir şeyler ters gitti',
  USERNAME_TAKEN: 'Bu ad kullanılıyor',
} as const;
