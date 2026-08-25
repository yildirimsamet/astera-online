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
  eyebrow: 'Duran teklifler',
  title: 'Ödüller',
  intro:
    'Galaksi, kendisini oynadığın için ödüyor. Hiçbiri zaman aşımına uğramaz, hiçbiri seri tutmanı istemez; hepsi deponda birikir, yani biri gelip alabilir.',

  waiting: '{{count}} ödül seni bekliyor',
  allTaken: 'Masadaki her şeyi aldın. Galaksi büyüdükçe yenileri gelecek.',

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
    'Bu, depo tavanını aşıracak. Hiçbir şey kaybolmuyor; ama bir kısmını harcamadan işlikleri boşaltamazsın.',

  /**
   * Her zincir için ad ve etiket. Ad hedefin NE olduğunu, etiket birinin bunu
   * neden isteyeceğini söyler; on bir kartı tarayan biri ikisine de ihtiyaç duyar.
   */
  chains: {
    PROBE: { name: 'Yollanan sondalar', tag: 'Atlamadan önce bak' },
    RAID: { name: 'Akın yapılan dünyalar', tag: 'Farklı dünyalar; aynısı iki kez sayılmaz' },
    CORE: { name: 'Komuta Çekirdeği', tag: 'Her yapının uyduğu tavan' },
    SHIPYARD: { name: 'Tersane', tag: 'Ağır gövdeleri açar' },
    REFINERY: { name: 'Alaşım Rafinerisi', tag: 'Saat başı alaşım' },
    EXTRACTOR: { name: 'Kristal Çıkarıcı', tag: 'Saat başı kristal' },
    SHIPS: { name: 'Basılan Atmacalar', tag: 'Sezon boyunca sayılır' },
    AEGIS: { name: 'Aegis', tag: 'Dünyanın üstünde bir kalkan' },
    MINE: { name: 'Delinen asteroit', tag: 'Geçen bir kayaya yetiş' },
    SALVAGE: { name: 'Toplanan enkaz', tag: 'Savaştan kalanı al' },
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
