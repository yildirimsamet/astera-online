/**
 * ÖDÜLLER.
 *
 * Türkçe yazıldı, İngilizceden çevrilmedi. Bu ekranın iki işi var: oyuncuya *ne
 * yapması gerektiğini* ve *karşılığında ne alacağını* söylemek. Hiçbir cümle
 * tebrik etmez, acele ettirmez, geri sayım tutmaz; burası duran bir teklif
 * listesi, peşine düşülen bir kampanya değil.
 *
 * Başlıklar ödülün değil HEDEFİN adını taşıyor — "Keşif Ödülü I" değil, "Yollanan
 * sondalar". Çünkü listenin asıl işi, yeni bir komutana daha denemediği oyun
 * parçalarını göstermek: sonda, akın, madencilik ve enkaz toplama.
 */
export const rewards = {
  eyebrow: 'Kalıcı hedefler',
  title: 'Ödüller',
  intro:
    'Bu hedeflerin süresi dolmaz ve hiçbiri kesintisiz seri gerektirmez. Aldığın kaynaklar doğrudan depoya eklenir; depo sınırını aşabilir ve akınlarda kaybedilebilir.',

  waiting: '{{count}} ödül seni bekliyor',
  allTaken: 'Bütün hedeflerin ödüllerini aldın.',

  claim: 'Al',
  claimed: 'Alındı',
  /** Kalanı söyler, azarlamaz. */
  toGo: '{{count}} tane kaldı',
  locked: 'Kapalı',

  goalCount: '×{{n}}',
  goalLevel: 'S{{n}}',
  progressCount: '{{have}} / {{need}}',
  progressLevel: 'S{{have}}',
  progressDone: 'Tamamlandı',

  granted: '+{{alloy}} alaşım · +{{crystal}} kristal',
  overCap:
    'Bu ödül depo sınırını aşacak. Kaynak kaybolmaz; ancak depoda yer açmadan üretim havuzundan kaynak toplayamazsın.',

  /**
   * Her zincir için ad ve etiket. Ad hedefin NE olduğunu, etiket birinin bunu
   * neden isteyeceğini söyler; on bir kartı tarayan biri ikisine de ihtiyaç duyar.
   */
  chains: {
    PROBE: { name: 'Yollanan sondalar', tag: 'Hedefe gitmeden önce bilgi topla' },
    RAID: { name: 'Akın yapılan dünyalar', tag: 'Her farklı dünya bir kez sayılır' },
    CORE: { name: 'Komuta Çekirdeği', tag: 'Bina seviyelerinin üst sınırı' },
    SHIPYARD: { name: 'Tersane', tag: 'Yeni gemi sınıfları ve daha hızlı üretim' },
    REFINERY: { name: 'Alaşım Rafinerisi', tag: 'Saat başı alaşım' },
    EXTRACTOR: { name: 'Kristal Ocağı', tag: 'Saat başı kristal' },
    SHIPS: { name: 'Üretilen Atmacalar', tag: 'Sezon boyunca sayılır' },
    AEGIS: { name: 'Aegis', tag: 'Dünyanın üstünde bir kalkan' },
    MINE: { name: 'Kazılan asteroitler', tag: 'Hareketli kayaya Kazıcı gönder' },
    SALVAGE: { name: 'Toplanan enkaz', tag: 'Enkaz sahasından kaynak getir' },
    SOCIAL: { name: '@JoinAstera hesabını takip et', tag: 'Hesap başına, bir kez' },
  },

  /**
   * Topluluk ödülü; oyunun dışında yapılacak tek iş olduğu için açıklama değil
   * TALİMAT olarak yazıldı. Üç adım, yapılacakları sırasıyla.
   */
  social: {
    eyebrow: 'Topluluk ödülü',
    handle: '@JoinAstera',
    url: 'https://x.com/JoinAstera',
    alloy: 'alaşım',
    crystal: 'kristal',
    open: "@JoinAstera'yı X'te aç",
    step1: '@JoinAstera hesabını takip et; aşağıdaki düğme yeni sekmede açar.',
    step2: 'Bize komutan adını yazıp DM at:',
    step3: 'Elle kontrol ediyoruz. Onayladığımız anda ödül burada seni bekliyor olacak.',
    pending: 'Mesajın bekleniyor',
    ready: 'Onaylandı; ödülünü al',
    /**
     * Bunu zaten almış oyuncu okur. "Alındı" demek yetmiyor: paneldeki diğer her
     * kart bunu BU sezon için söyler ve yeni galakside hepsi geri gelir. Bu
     * gelmez; kart da bunu açıkça söylüyor ki kimse zaten takip ettiği hesabı
     * yeniden takip edip gelmeyecek bir onayı beklemesin.
     */
    forever: 'Ödendi. Bu bonusu hesap başına bir kez veriyoruz; yeni galakside geri gelmez.',
  },
} as const;
