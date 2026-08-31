/**
 * GİRİŞ — ön kapı, galaksi listesi ve aradaki bekleme kareleri.
 *
 * TÜRKÇE YAZILDI, İNGİLİZCEDEN ÇEVRİLMEDİ. İngilizce metnin kendine has bir sesi
 * var: kısa, kesik, tire ile bağlanan cümlecikler. O ses İngilizcede çalışır;
 * Türkçeye birebir taşındığında "kitap çevirisi" gibi okunur. Buradaki kural şu:
 *
 *   · Cümle kurulur, parça bırakılmaz. "Gezegenin ne kadar büyüdüğü" bir cümle
 *     değil, bir isim tamlaması — Türkçede yarım kalmış gibi durur.
 *   · Ad değil, fiil. Türkçe eylemle konuşur; İngilizcenin adlaştırma alışkanlığı
 *     buraya taşınmaz.
 *   · Tire yerine noktalı virgül ya da ayrı cümle. Ard arda tire, Türkçede
 *     vurgu değil dağınıklık verir.
 *   · Karşılık değil, aynı işi gören Türkçe. "Bet a fleet" → "filo yatırmak"
 *     değil, "filoyu riske atmak".
 */

export const landing = {
  populationHeld: '<0>{{amount}}</0> komutan ana gezegenini yönetiyor',
  populationOnline: '<0>{{amount}}</0> şu an galakside',
  register: 'Gezegenini İncele',
  signIn: 'Zaten bir komutanım var',
  reassurance: 'Hesap gerekmiyor. Önce oyna, sonra sahiplen.',

  /**
   * Dönen komutanın kapısı. Bu cihazda daha önce komutan olmuş biri için iki
   * düğmenin ağırlığı yer değiştirir; giriş öne geçer.
   */
  welcomeBack: 'Ana gezegenin bıraktığın yerde duruyor',
  signInPrimary: 'Giriş yap',
  returningHint: 'Aynı komutan, aynı galaksi; hangi tarayıcıdan girersen gir.',
  newCommander: 'Bunun yerine yeni bir komutan başlat',
  opening: 'Galaksi açılıyor',
  ready: 'Gezegenin hazır',
  cover: 'Gökyüzü açılıyor',

  form: {
    labelRegister: 'Komutan oluştur',
    labelLogin: 'Giriş yap',
    close: 'Kapat',
    eyebrowRegister: 'Yeni komutan',
    eyebrowLogin: 'Tekrar hoş geldin',
    headingRegister: 'Gezegenini İncele',
    headingLogin: 'Giriş yap',
    nameLabel: 'Komutan adı',
    namePlaceholder: 'Vantage',
    passwordLabel: 'Parola',
    passwordPlaceholder: 'En az {{count}} karakter',
    submitBusy: 'Bağlanıyor',
    submitRegister: 'Komutanı oluştur',
    submitLogin: 'Giriş yap',
    switchToLogin: 'Zaten komutanım var',
    switchToRegister: 'Yeni komutan oluşturayım',
    badName: 'Ad 3-16 karakter olmalı; harf, rakam ve alt çizgi kullanabilirsin.',
    noName: 'Komutan adını yaz.',
    shortPassword: 'Parola en az {{count}} karakter olmalı.',
    noPassword: 'Parolanı yaz.',
    failed: 'Giriş yapılamadı',
  },
} as const;

export const servers = {
  commanderLabel: 'Komutan',
  signOut: 'Çıkış yap',
  rule:
    'Her galakside en fazla 300 komutan var ve galaksiler sırayla doluyor. Yani katıldığın yerde seni bekleyen insanlar oluyor.',
  loading: 'Gökyüzü taranıyor',
  unreachable: 'Galaksilere ulaşılamadı.',
  retry: 'Tekrar dene',
  listLabel: 'Galaksiler',
  noneOpen: 'Şu an açık galaksi yok. Sezonlar arasındayız; birazdan tekrar bak.',
  allFull: 'Bütün galaksiler dolu. Bir sonraki, sıfırlamada herkesle birlikte açılıyor.',
  online: '<0>{{amount}}</0> şu an galakside',
  yours: 'Senin galaksin',
  status: {
    open: 'Komutan alıyor',
    full: 'Dolu',
    locked: 'Üstteki dolunca açılır',
    closed: 'Sezon arası',
  },
  enter: 'Gir',
  join: 'Katıl',
  joining: '…',
} as const;

export const app = {
  blockedTitle: 'Şimdi olmaz',
  blockedRetry: 'Tekrar dene',
  sessionFailed: 'Sunucuya ulaşılamadı',
} as const;

export const loading = {
  contact: 'Bağlantı kuruluyor',
  sweeping: 'Galaksi taranıyor',
  charting: 'Galaksi çiziliyor',
  raising: 'Görüntü yükleniyor',
} as const;

export const document = {
  description: 'Korunan ana gezegenini yönet, koloniler kazan ve rakiplerinin gücünü keşfet.',
  manifest: '/manifest.tr.webmanifest',
} as const;

export const settings = {
  sectionLabel: 'Dil',
  hint: 'Galaksideki bütün metinler anında değişir; ilerlemen ve ayarların aynı kalır.',
  choose: 'Dil seç',
  current: 'Kullanımda',
} as const;
