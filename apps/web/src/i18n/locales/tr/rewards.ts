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
  empty: 'Gösterilecek ödül hedefi yok',
  emptyHint: 'Kontrol etmek için ödül listesini yeniden yükle.',
  summaryReady: "Alınabilir ödüller",
  summaryClaimed: "Alınan kademeler",
  allMilestones: "Tüm kademeler",
  eyebrow: 'Görevler ve hedefler',
  title: 'Ödüller',
  intro:
    'Süresi dolmaz, seri istemez. Ödül depoya girer; korumasız kısmı yağmalanabilir.',

  waiting: '{{count}} ödül seni bekliyor',
  allTaken: 'Bütün hedeflerin ödüllerini aldın.',

  claim: 'Al',
  /** The supply pod over the list: the next ready payout, opened by a tap (C34). */
  welcome: {
    board: 'Yeni Komutan · 7 Kutu',
    rule: 'Her kutu artan miktarda sabit kaynak verir; 3. günde Helios gezegen halkası, 4. günden itibaren döteryum, 7. günde Titan İtkisi motor alevi eklenir. Yenisi açtıktan {{gap}} saat sonra hazır; beklerse kaybolmaz.',
    title: 'Komutan kutusu {{box}}/{{of}}',
    opened: 'Açıldı',
    ready: 'Hazır',
    hold: 'Basılı tut',
    wait: '{{time}} sonra',
    big: 'Büyük kutu',
    later: 'Sabit ödül',
    poured: 'Depoya: {{purse}}',
    skinRingHelios: 'Helios Halkası',
    skinEngineTitan: 'Titan İtkisi',
  },
  /** GÜNLÜK GÖREVLER (owner, 2026-11-24): four acts, each paying a small purse once a UTC day. */
  /** Rewards in two tabs (owner 2026-11-24): the day's quests, and the standing goals. */
  tabs: {
    label: 'Ödül bölümleri',
    daily: 'Günlük',
    goals: 'Hedefler',
  },
  daily: {
    title: 'Günlük görevler',
    granted: '+{{alloy}} alaşım · +{{crystal}} kristal · +{{honor}} Honor',
    resets: '{{time}} sonra yenilenir',
    about: 'Günlük görevler nasıl işler',
    fact: 'Her görev günde bir kez ödeme yapar.',
    rule: 'Bugün yaptıkların sayılır; gün 00:00 UTC\'de, herkes için aynı anda yenilenir. Hazır olan görevi al: ödül başkentinin deposuna girer, orada çalınabilir. Kaçırdığın gün hiçbir şey kaybettirmez.',
    quests: {
      PROBES: '3 sonda gönder',
      RIFT: 'Yarık\'a gir',
      PIRATE: 'Bir korsan avla',
      ASTEROID: 'Bir asteroit kaz',
    },
  },
  takeAll: "Tümünü al · {{count}}",
  go: 'Git',
  next: 'Sıradaki: {{name}} · {{count}} kaldı',
  openPod: 'Kapsülü aç',
  podTask: 'Görev',
  podPrize: 'Ödül',
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
    'Depo sınırı aşılır: kaynak kaybolmaz, ama yer açana dek üretimi toplayamazsın.',

  /**
   * Her zincir için ad ve etiket. Ad hedefin NE olduğunu, etiket birinin bunu
   * neden isteyeceğini söyler; on bir kartı tarayan biri ikisine de ihtiyaç duyar.
   */
  chains: {
    VAULT: { name: 'Depo', tag: 'Deponu derinleştir ve bir kısmını akına kapat' },
    PIRATE: { name: 'Yenilen korsanlar', tag: 'Farklı korsanları yen; gemilerin sağ kalsın' },
    PROBE: { name: 'Yollanan sondalar', tag: 'Hedefe gitmeden önce bilgi topla' },
    RAID: { name: 'Akın yapılan dünyalar', tag: 'Her farklı dünya bir kez sayılır' },
    CORE: { name: 'Komuta Çekirdeği', tag: "Hangar dışındaki binaların seviye sınırını yükselt" },
    SHIPYARD: { name: 'Tersane', tag: 'Yeni gemi sınıfları ve daha hızlı üretim' },
    REFINERY: { name: 'Alaşım Rafinerisi', tag: 'Saat başı alaşım' },
    EXTRACTOR: { name: 'Kristal Ocağı', tag: 'Saat başı kristal' },
    SHIPS: { name: 'Üretilen Oklar', tag: 'Sezon boyunca sayılır' },
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
    how: "Nasıl kazanılır",
    howFact: "X'te üç adım.",
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
