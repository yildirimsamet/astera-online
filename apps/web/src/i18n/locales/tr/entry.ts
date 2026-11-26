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
  register: "Gezegenini incele",
  signIn: 'Zaten bir komutanım var',
  reassurance: 'Hesap gerekmiyor. Önce oyna, sonra sahiplen.',

  /**
   * Dönen komutanın kapısı. Bu cihazda daha önce komutan olmuş biri için iki
   * düğmenin ağırlığı yer değiştirir; giriş öne geçer.
   */
  welcomeBack: "Komutanınla oyuna devam et",
  signInPrimary: 'Giriş yap',
  returningHint: 'Aynı komutan, aynı galaksi; hangi tarayıcıdan girersen gir.',
  newCommander: 'Yeni komutan başlat',
  opening: 'Galaksi açılıyor',
  ready: 'Gezegenin hazır',
  cover: "Oyun görselleri yükleniyor",
  publicLinksLabel: "Oyun bilgileri ve politikalar",
  aboutLink: "Astera hakkında",
  guideLink: 'Nasıl oynanır?',
  privacyLink: 'Gizlilik',
  termsLink: 'Koşullar',
  refundsLink: 'İade',
  pricingLink: 'Fiyatlar',
  contactLink: 'İletişim',

  form: {
    labelRegister: 'Komutan oluştur',
    labelLogin: 'Giriş yap',
    close: 'Kapat',
    eyebrowRegister: 'Yeni komutan',
    eyebrowLogin: 'Tekrar hoş geldin',
    headingRegister: "Komutanını oluştur",
    headingLogin: 'Giriş yap',
    nameLabel: 'Komutan adı',
    namePlaceholder: 'Vantage',
    passwordLabel: 'Parola',
    passwordPlaceholder: 'En az {{count}} karakter',
    submitBusy: "Giriş yapılıyor…",
    submitRegister: 'Komutanı oluştur',
    submitLogin: 'Giriş yap',
    switchToLogin: 'Zaten komutanım var',
    switchToRegister: "Yeni komutan oluştur",
    badName: 'Ad 2–32 karakter olmalı. Her dilde harf, rakam, alt çizgi ve tek boşluk kullanabilirsin.',
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
    "Her galakside en fazla {{seats}} komutan oynar. Galaksiler sırayla açılır ve dolar.",
  loading: "Galaksiler yükleniyor",
  unreachable: 'Galaksilere ulaşılamadı.',
  retry: 'Tekrar dene',
  listLabel: 'Galaksiler',
  noneOpen: "Şu anda katılabileceğin açık bir galaksi yok. Galaksi listesini daha sonra kontrol et.",
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
  joining: "Katılınıyor…",
} as const;

export const app = {
  updateTitle: "Güncelleme gerekli",
  updateBody: "Astera Online'ın bu sürümü artık oyun sunucusuyla çalışmıyor. Galaksiye dönmek için uygulamayı güncelle. Hesabın ve ilerlemen sunucuda korunur.",
  updateStore: "Google Play'de güncelle",
  updateWebBody: "Oyun kuralları güncellendi. Güncel sürümü kullanmak için oyunu yenile. Hesabın ve ilerlemen sunucuda korunur.",
  reloadGame: "Oyunu yenile",
  /** OTA F3: a newer release downloaded while the game is open; the player picks the restart. */
  updateReady: "Güncelleme hazır",
  updateRestart: "Yeniden başlat",
  /** F0.9: the screen while nginx holds the maintenance flag. */
  maintenanceTitle: "Bakım sürüyor",
  maintenanceBody: "Sunucu kısa bir bakımda. Hesabın ve ilerlemen sunucuda korunur.",
  maintenanceReturn: "Tahmini dönüş {{time}}",
  maintenanceLate: "Planlanandan biraz uzun sürüyor.",
  maintenanceBack: "Bakım bitince oyun kendiliğinden açılır.",
  blockedTitle: "Oyuna bağlanılamadı",
  blockedRetry: 'Tekrar dene',
  sessionFailed: 'Sunucuya ulaşılamadı',
} as const;

export const loading = {
  contact: "Sunucuya bağlanılıyor",
  sweeping: "Galaksi bilgileri yükleniyor",
  charting: "Galaksi görselleri yükleniyor",
  raising: "Oyun görünümü hazırlanıyor",
  /** OTA F3: the opening scene downloading a newer release; the size is what this phone still lacks. */
  update: "Güncelleme indiriliyor · {{size}}",
  /** OTA F3: every file of the release is already on the phone. */
  updateApplying: "Güncelleme uygulanıyor",
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

export const consent = {
  title: 'Çerez ve reklam tercihin',
  /** The first visit's note (owner 2026-11-27): only the essentials are on; closing it keeps it so. */
  notice: 'Yalnız gerekli çerezler',
  noticeBody: "Ölçüm ve kişiselleştirilmiş reklam kapalı. Menü › Gizlilik'ten açabilirsin.",
  essentials: 'Giriş yapınca her hâlükârda bir oturum çerezi saklanır; bu kısım isteğe bağlı değil.',
  optional:
    'Ölçüm ve reklam depolaması yalnızca izin verirsen kullanılır. Reddedersen oyun aynı şekilde çalışır, reklamlar kişiselleştirilmeden gösterilir.',
  accept: 'Kabul et',
  refuse: 'Reddet',
  close: 'Kapat',
  policy: 'Çerez Politikası',
  menuRowLabel: 'Gizlilik',
  menuLabel: 'Gizlilik ve çerez seçenekleri',
  menuGranted: 'İzin verildi',
  menuDenied: 'Reddedildi',
  menuUnset: 'Henüz seçilmedi',
} as const;
