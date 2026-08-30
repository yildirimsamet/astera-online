/**
 * BİLDİKLERİN — istihbarat merkezi, savaş raporları, netlik okuması ve odak
 * şeridinin kurulduğu dosya satırları.
 *
 * Bu ekranın tek bir işi var: oyuncuya NE BİLMEDİĞİNİ hissettirmek. O yüzden
 * buradaki boş durum metinleri özür değil, davet. Her biri eksik olan cihazın
 * adını verir ve o cihazın ne söyleyeceğini anlatır.
 */

export const intel = {
  openOrbit: 'Yörüngeyi aç',
  tabs: {
    label: 'İstihbarat raporları',
  },
  coverage: {
    label: 'Kapsama',
    blind: 'Tek bir gezegenin bile içini göremiyorsun',
    partial_one: '{{count}} yuvandan {{seen}} tanesi bir yere bakıyor',
    partial_other: '{{count}} yuvandan {{seen}} tanesi bir yere bakıyor',
    full: 'Bütün yuvaların birini izliyor',
    blindHint: 'Bunu bitirmenin en ucuz yolu bir Teleskop.',
    idleHint_one: '{{count}} yuvan boşta duruyor. Galaksiden bir gezegen seç, oraya çevir.',
    idleHint_other: '{{count}} yuvan boşta duruyor. Galaksiden bir gezegen seç, birini oraya çevir.',
    scarcity_one:
      'Dışarıda {{neighbours}} gezegen var, elinde {{count}} göz. Bir yuvayı kaydırmak bekleme süresine mal oluyor; kimi izleyeceğine iyi karar ver.',
    scarcity_other:
      'Dışarıda {{neighbours}} gezegen var, elinde {{count}} göz. Bir yuvayı kaydırmak bekleme süresine mal oluyor; kimi izleyeceğine iyi karar ver.',
    oneMore: 'Teleskop L{{level}} bir gezegen daha izlerdi.',
    noRadar: 'Radarın da yok; sana yönelen tehdidi diğer hareketlerden ayıramazsın.',
  },

  watching: {
    heading: 'İzlediklerin',
    slotsUsed: '{{total}} yuvadan {{used}} tanesi dolu',
    slotLabel: 'Yuva {{slot}}',
    slotEmpty: 'Boşta',
    missingNoSlot: 'Hiçbir yuva bir yere bakmıyor',
    missingNoTelescope: 'Teleskopun yok',
    gives: 'Bir gezegenin filosu havalandığı an sana söyler. Her akını belirleyen bilgi bu.',
    costPoint: 'Galaksiden bir gezegen seç, bir yuvayı ona çevir.',
    costInstall: 'Gezegen ekranından bir tane kur.',
    away: 'Gezegeni şu an geride bıraktıklarına emanet.',
    intermittent:
      'Kesikli okuma en iyi ihtimalle yirmi dakikada bir yenilenir. Tekrar bakmanın faydası yok; pencere dönene kadar cevap değişmez.',
  },

  probes: {
    heading: 'Sonda raporları',
    newest: 'en yeni önce',
    missing: 'Henüz geri dönen bir sonda olmadı',
    gives: 'Gerçek sayılar: ellerinde ne var, kırmak ne kadar zor. Hepsini aralık olarak verir.',
    /** Rakamlar `PROBE` sabitinden gelir; artık elle yazılmaz. D59. */
    cost: 'Hızlı ve ucuz: {{alloy}} alaşım, {{crystal}} kristal. Elindeki hiçbir savaş gemisi ona yetişemez; ama radarları onu yakalayabilir.',
    stock: 'Stok',
    defence: 'Savunma',
    ships: 'Gemi',
    /** `{{percent}}` buraya zaten `%40` biçiminde geliyor; işaret `format.percent`'te. */
    accuracyHome: '{{percent}} isabet · filo evdeydi',
    accuracyOut: '{{percent}} isabet · filo dışarıdaydı',
    caught: 'sondayı yakaladılar',
    /* Sinyal çubuklarının yanındaki iki kelime; isabeti çubuklar taşıyor. */
    homeTag: 'filo evdeydi',
    outTag: 'filo dışarıdaydı',
  },

  radar: {
    heading: 'Sana kim bakıyor',
    level: 'Radar L{{level}}',
    missing: 'Radarın yok',
    gives:
      'Hareket eden araçları görebildiğin çemberi çizer, sana gelen sondaları yakalar ve dünyana yönelen tehdidi varış süresiyle birlikte işaretler.',
    cost: 'Biri bu gezegenin tam resmini çıkarabilir, senin haberin bile olmaz.',
    quiet: 'Seni kimse taramadı. Radar L{{level}} dinlemede.',
    scan: 'Tarama yakalandı',
    bearing: ' · galaktik {{bearing}} yönünden',
    origin: ' · {{planet}}',
    /** Taramanın hangi dünyaya geldiği. */
    onWorld: ' · {{planet}}',
    /* Captions beside the two drawn rings; the picture carries the rest. */
    ringSense: 'Bir şey geliyor',
    ringWarn: 'Zamanlı uyarı',
    /** İki çember tek olduğu sürece tek başlık, çemberin ne yaptığını söyler. */
    ringOne: 'Tespit ve zamanlı uyarı',
    /** Halkaları göremeyen için aynı okuma; iki çember bu bilgiyi zaten taşıyor. */
    noteFleets:
      'Radar L{{level}}, {{sense}} birimde sana yönelen tehdidi ayırt eder ama saat vermez. {{warn}} birime girdiğinde varış süresi açılır.',
    /** Birleşik hâli: tek çember, iki ürün, tek cümle. */
    noteFleetsOne:
      'Radar L{{level}}, {{sense}} birime kadar hareket eden araçları gösterir ve dünyana yönelen tehdidi varış süresiyle işaretler.',
    /** Hiçbir resmin çizemediği yarısı: çemberler sabit, içinde kalma süresi değil. */
    noteSlow: 'Ağır ve yavaş bir filo Radar menzilinde daha uzun kalır.',
    noteProbesLegacy: 'Radar L{{level}} sondaları yakalıyor. L3’ten sonra gelen filoları da haber verir.',
    noteBearing: ' L2 geldikleri yönü de söyler.',
    noteOrigin: ' L5 gezegenin adını verir.',
  },
} as const;

export const reports = {
  heading: 'Savaş raporları',
  newest: 'en yeni önce',
  empty:
    'Henüz kimse kimseyle çatışmadı. Savaş, bu oyunda tahmine dayanmayan tek bilgi kaynağı.',
  youRaided: 'Akın ettiğin: ',
  raidedBy: 'Sana akın eden: ',
  rounds: '{{count}} raunt',
  sheetYouRaided: '{{opponent}} gezegenine akın ettin',
  sheetTheyRaided: '{{opponent}} sana akın etti',
  heldAgainstYou: '{{planet}} dayandı. Artık onu kırmanın neye mal olduğunu biliyorsun.',
  brokenByYou: '{{planet}} dayanamadı.',
  youHeld: 'Dayandın. Artık onlar da seni beklerken elinde ne olduğunu biliyor.',
  youFell: 'Dayanamadın.',
  shipsLost: 'Kaybettiğin gemi',
  haul: 'Eve dönen',
  haulLost: 'Götürdükleri',
  roundsLabel: 'Raunt',
  taken: 'Alınan',
  lost: 'Kaybedilen',
  dominion: 'Hâkimiyet',
  clansAtLaunch: 'Bu filo yola çıktığındaki klanlar',
  yourClan: 'Senin tarafın',
  theirClan: 'Karşı taraf',
  noClan: 'Klan yok',
  verdict: {
    label: 'Savaşın sonucu',
    yourForce: 'Senin filon',
    yourLosses: 'Senin kaybın',
    sent: 'Giden',
    held: 'Vardı',
    total: 'Toplam',
    lost: 'Kaybettin',
    returned: 'Dönen',
    standing: 'Ayakta',
    destroyed: 'Yok ettin',
  },
  theirLosses: 'Yok ettiklerin',
  theirs: 'Karşıda ne varmış',
  theirsEmpty: 'Karşıdan hiçbir şey yok edilmedi.',
  yourForce: 'Senin filon',
  yours: 'Sana neye mal oldu',
  yoursEmpty: 'Hiçbir şey kaybetmedin.',
  howItWent: 'Çatışma nasıl geçti',
  roundDealt: 'Sen vurdun',
  roundTook: 'Sana vurdular',
  roundLine: '<0>{{dealt}}</0> vurdun, <1>{{took}}</1> yedin',
  shield: 'kalkan {{amount}}',
  breacherShield: 'Delici +{{amount}}',
  aegis: {
    aria: 'Aegis kalkanı',
    label: 'AEGIS KALKANI',
    broken: 'KIRILDI',
    damaged: 'HASAR ALDI',
    held: 'DAYANDI',
    before: 'Savaş başında',
    after: 'Savaş sonunda',
    note: 'Gezegen kalkanı, savunmadaki birliklerden önce hasar alır.',
    absorbed: '{{amount}} kalkan hasarı emildi',
  },
  calculation: {
    intro:
      'Yukarıdaki sabit tarif aşağıdaki sayıları üretir. Sonra her raunt aynı üç adımla ilerler.',
    formulaHeading: 'Atış gücü nasıl oluşur',
    formulaBase: '1 · Temel: birlik adedi × saldırı × araştırma.',
    formulaCounter: '2 · Sayaç: güçlü eşleşme ×{{strong}}; zayıf eşleşme ×{{weak}}.',
    formulaRoll: '3 · Atış farkı: −%{{min}} ile +%{{max}}.',
    formulaHp: 'Hasar, hedef türlerin toplam can içindeki payına göre bölünür.',
    formulaCarry: 'Bir birliğin düşmesi için tüm canı bitmelidir; yarım kalan hasar sonraki raunda taşınır.',
    formulaSupport: 'Destek gemileri, kendi taraflarında en az bir savaş birliği kaldığı sürece korunur.',
    resultHeading: 'Sonuç nasıl belirlenir',
    resultDecisive:
      'KESİN · savunmadaki tüm birlikler yok olmuş ve kalkan sıfıra inmiştir · ambar sınırından önce açık stokun %{{decisiveLoot}} kadarı alınabilir.',
    resultPartial:
      'KISMİ · savunma birliklerinin değer olarak en az %{{threshold}} kadarı yok edilmiştir · ambar sınırından önce açık stokun %{{partialLoot}} kadarı alınabilir.',
    resultRepelled:
      'PÜSKÜRTÜLDÜ · savunma birliklerinin değer olarak %{{threshold}} kadarından azı yok edilmiştir · hiçbir şey alınamaz.',
    round: '{{round}}. raunt',
    fire: '1 · Aynı anda ateş',
    fireNote: 'Kayıplar kaldırılmadan önce iki taraf da ateş eder. Bu rauntta yok edilen birlik yine de ateşini yapar.',
    yourShot: 'Senin atışın',
    theirShot: 'Rakibin atışı',
    shotChange: 'Atış farkı',
    positivePercent: '+%{{amount}}',
    negativePercent: '−%{{amount}}',
    neutralPercent: '%0',
    aegis: '2 · Darbeyi Aegis karşılar',
    noAegis: '2 · Aktif Aegis yok',
    shieldCharge: 'Kalkan gücü',
    absorbed: '{{amount}} emildi',
    reachedHulls: 'Gövdelere ulaşan',
    breacher: '{{amount}} yalnız kalkana vuran Delici hasarıydı',
    noAegisNote: 'Darbeyi tutan bir kalkan yoktu; {{amount}} atış gücünün tamamı savunma gövdelerine ulaştı.',
    losses: '3 · Kayıplar savaştan çıkar',
  },
  gradeDecisive: 'KESİN',
  gradePartial: 'KISMİ',
  gradeRepelled: 'PÜSKÜRTÜLDÜ',
  strategicFirstStrike: 'İSABET',
  strategicCaptured: 'ELE GEÇİRİLDİ',
  strategicIneffective: 'ETKİSİZ',
  strategicIntercepted: 'HAVADA VURULDU',
  strategicYouAttacked: 'Ölüm Yıldızı hedefin: ',
  strategicAttackedBy: 'Ölüm Yıldızı gönderen: ',
  strategicDestroyedInFlight: 'Ölüm Yıldızı havada yok edildi',
  strategicRadarTrigger: 'Hedef dünya, araç Radar L3+ önleme çemberini geçince ateş açtı.',
  strategicTelescopeTrigger: 'Savunmacının dünyalarından biri aracı Telescope görüşünde tanımlayınca ateş açtı.',
  strategicTotalDamage: 'Yok edilen toplam değer',
  strategicShieldLost: 'Yok edilen kalkan',
  strategicResourcesLost: 'Yok edilen maden',
  strategicOrdersLost: 'Yok edilen kuyruk işi',
  strategicResourceBreakdown: 'Yok edilen madenler',
  strategicNoFleetLost: 'Gezegendeki filo veya yer savunması kaybı yok.',
  strategicLevelLosses: 'Düşen seviyeler',
  strategicNoLevelLoss: 'Bina veya enstrüman seviyesi düşmedi.',
  strategicDestroyedOrders: 'Yok edilen inşaatlar',
  strategicNoOrdersLost: 'Aktif inşaat emri yok edilmedi.',

  neutralHolder: 'sahipsiz bir dünya',

  /**
   * Raporun tepesindeki damganın ne anlama geldiğini oyun ilk kez söylüyor.
   *
   * JARGONSUZ VE OKUYANIN TARAFINDAN. İlk hâli "savunma değerinin %42 eşiği"
   * diyordu: `defenceValue` oyunun iç hesabı, yüzde kimsenin bir şey yapamayacağı
   * bir eşik, cümle de kimsenin gözünden yazılmamıştı — yani akına uğrayan
   * komutan kendi kaybının tarafsız tarifini okuyordu. Oyuncu bu satırı bitirince
   * KENDİSİNE ne olduğunu ve yağmanın neden o kadar olduğunu bilmeli.
   */
  why: {
    attacking: {
      DECISIVE: 'Savunan ne varsa yok ettin, kalkanı da düşürdün; yağmanın tamamı bu yüzden açıldı.',
      DECISIVE_WITHOUT_SHIELD: 'Savunan ne varsa yok ettin; yağmanın tamamı bu yüzden açıldı.',
      PARTIAL: 'Savunmanın çoğunu kırdın ama hepsini değil; bu yüzden depolarından ancak bir kısmını alabildin.',
      REPELLED: 'Savunmaları dayandı. Filon içeri giremedi, eli boş döndün.',
    },
    defending: {
      DECISIVE: 'Savunmadaki her şeyin düştü, kalkanın da gitti; yağmanın tamamını aldılar.',
      DECISIVE_WITHOUT_SHIELD: 'Savunmadaki her şeyin düştü; yağmanın tamamını aldılar.',
      PARTIAL: 'Savunmanın çoğu düştü ama bir kısmı dayandı; depondan ancak bir parça götürebildiler.',
      REPELLED: 'Savunman dayandı. İçeri giremediler, hiçbir şey götüremediler.',
    },
  },

  /** Savaşın yağma satırının ötesinde yaptıkları; her biri yalnız doğruysa yazılır. */
  effects: {
    heading: 'Bu savaş ne yaptı',
    shieldTheirs: 'Kalkanları, gövdelere ulaşan ilk atıştan önce {{amount}} hasar yuttu.',
    shieldYours: 'Kalkanın, gövdelerine ulaşan ilk atıştan önce {{amount}} hasar yuttu.',
    cargoLimited:
      'Ambarların doldu. O gezegende taşıyabileceğinden fazlası vardı; yanına Yük Gemisi al.',
    salvaged_one: '{{count}} yer topu kendi enkazından yeniden kuruldu; şimdi yine ayakta.',
    salvaged_other: '{{count}} yer topu kendi enkazından yeniden kuruldu; şimdi yine ayakta.',
    worksTheirs: 'Tesisleri {{duration}} boyunca kapalı. Orada hiçbir şey üretilmiyor.',
    worksYours: 'Tesislerin {{duration}} boyunca devre dışı kaldı.',
    wreck: '{{planet}} üzerinde {{amount}} değerinde enkaz sürükleniyor. İsteyen gidip alabilir.',
    wreckYours: 'Kendi yörüngende {{amount}} değerinde enkaz sürükleniyor. İsteyen gidip alabilir; sen de.',
  },

  /** Okuyanın kendi tahtası: savaşa ne girdi, ne öldü, sonunda ne ayakta kaldı. */
  force: {
    reading: '{{sent}} gitti, {{lost}} kayıp, {{left}} kaldı',
    hull: 'Gövde',
    sent: 'Giden',
    held: 'Duran',
    lost: 'Ölen',
    left: 'Kalan',
    summary: 'Savaşa {{brought}} girdi · {{lost}} yok edildi · {{left}} ayakta kaldı',
  },
  roundTheirs: 'Onlar',
  roundYours: 'Sen',
  roundNoLosses: 'Bu rauntta tahtadan hiçbir şey kalkmadı.',
} as const;

export const clarity = {
  barsLabel: 'Netlik: {{state}}',
  stateFull: 'tam',
  stateClear: 'berrak',
  stateIntermittent: 'kesikli',
  stateDegraded: 'bozuk',
  stateBlind: 'kör',
  unreadable: 'OKUNAMIYOR',
  fleetHome: 'FİLO EVDE',
  fleetAway: 'FİLO DIŞARIDA',
  backIn: ' · {{minutes}} dk sonra döner',
  unwatched: 'izlemeye alınmadı',
} as const;

export const dossier = {
  sourcePublic: 'Herkese açık',
  sourceTelescope: 'Teleskop',
  sourceProbe: 'Sonda',
  sourceBattle: 'Savaş raporu',

  confidencePrecise: 'kesin',
  confidenceGood: 'iyi',
  confidenceRough: 'kaba',
  confidenceVague: 'belirsiz',

  ownerLabel: 'Sahibi',
  ownerNote: 'Sezon boyunca herkese açık.',
  ownerRecordNote: 'Sondanın bulduğu bayrak. O günden beri el değiştirmiş olabilir.',

  developmentLabel: 'Gelişim',
  developmentValue: '{{tier}}. kademe',

  hardwareLabel: 'Yörüngedeki uydular',
  hardwareNote: 'Donanımı görüyorsun. Ne işe yaradığını öğrenmek bir sondaya bakar.',
  hardwareRecordNote: 'Sonda geçerken yörüngede ne varsa o. Üstüne yenisini kurmuş olabilirler.',

  fleetLabel: 'Filoları',
  fleetUnreadable: 'Okunamıyor',
  fleetAway: 'Evde değil',
  fleetHome: 'Evde',
  fleetVeiledNote: 'Perdeleri Teleskopunu yeniyor. Ya teleskobu yükselt ya da sonda gönder.',
  fleetAwayUnknownNote: 'Ne zaman döneceğini bilmiyorsun. Aldığın risk tam olarak bu.',
  fleetAwayNote: 'Gezegeni şu an geride bıraktıklarına emanet.',
  fleetHomeNote: 'İzlemek sessizdir; baktığını asla öğrenemezler.',

  fleetGapNoTelescope: 'Teleskopun yok',
  fleetGapOutOfRange: 'Teleskopunun menzili buraya yetmiyor',
  fleetGapNoSlot: 'Buraya bakan bir yuva yok',
  fleetGapWhy:
    'Oyundaki en değerli bilgi: dışarıda olan bir filo kendi gezegenini savunamaz.',
  fleetGapRange: '{{reach}} birim görüyor, o gezegen {{distance}} birim uzakta',
  fleetGapSlots: '{{count}} yuvanın hepsi dolu; birini kaydırman gerek',

  stockLabel: 'Ellerindeki kaynak',
  stockCaught: 'Radarları sondayı yakaladı; birinin baktığını biliyorlar.',
  stockClean: 'Sonda girip çıktı, kimse fark etmedi.',
  defenceLabel: 'Savunma değeri',
  defenceNote: 'Sonda geçerken gezegende ne duruyorsa o.',
  shipsLabel: 'Sayılan gemi',
  shipsAllHome: 'Ellerindeki her şey evdeydi.',
  shipsSomeOut: 'Gemilerinin bir kısmı dışarıdaydı.',

  /** Sondanın hep aldığı ama hiç gösterilmeyen dört okuma. Hepsi bakış anında donar. */
  deuteriumLabel: 'Ellerindeki döteryum',
  deuteriumNote: 'Yakıt. Hâlâ neyi kaldırabilecekleri.',
  strategicLabel: 'Stratejik silah',
  strategicReady: 'Hazır ve kurulu',
  strategicBuilding: 'Yapım aşamasında',
  strategicUnknown: 'Rampada bir şey var',
  strategicNote: 'Sonda geçerken rampada duruyordu. O zamandan beri kalkmış olabilir.',
  strategicUnknownNote: 'Sonda ne kadar ilerlediğini ayırt edecek kadar keskin değildi.',
  interceptorLabel: 'Stratejik savunma',
  interceptorLoaded: 'Şarj dolu',
  interceptorEmpty: 'Şarj yok',
  interceptorLoadedNote:
    'Bu dünyaya gönderilen stratejik silah radar çemberinde imha edilir. Bir şarj bir vuruşu durdurur.',
  interceptorEmptyNote: 'Burada stratejik silahı durduracak bir şey yok. O zamandan beri yüklemiş olabilirler.',
  doctrinesLabel: 'Muharebe doktrini',
  doctrinesNone: 'Hiçbiri araştırılmamış',
  doctrinesNote: 'Gemileri tablodan daha iyi dövüşüyor. Karşılaşacağın çarpan bu.',
  doctrinesNoneNote: 'Sonda baktığında gemilerine hiçbir şey araştırmamışlardı.',

  surfaceGapLabel: 'Bu gezegen hakkında her şey',
  surfaceGapMissing: 'Buraya bugüne kadar kimse bakmadı',
  surfaceGapWhy:
    'Kimin elinde, ne kadar gelişmiş, yörüngesinde ne var; hiçbirini göremiyorsun. Bir sonda hepsini tek seferde getirir.',

  probeGapLabel: 'Kaynak ve savunma',
  probeGapMissing: 'Buraya hiç yakından bakan olmadı',
  probeGapAged: 'Bu dünyaya dair okuman eskidi',
  probeGapWhy:
    'Aşağıda ne olduğunu bilmeden koca bir filoyu riske atacaksın. Sonda, o tahmini hiç değilse bir aralığa indirir.',

  compositionLabel: 'Sahaya sürdüğü bilinen',
  compositionValue: 'en az {{fleet}}',
  compositionNote: 'Son çatışmada yok ettiklerin. Yerlerine yenisini koymuş olabilirler.',
  compositionGapLabel: 'Gerçekte ne uçuruyorlar',
  compositionGapMissing: 'Onlarla hiç çatışmadın',
  compositionGapWhy: 'Bir filonun tam bileşimi yalnızca savaş raporundan çıkar.',
} as const;
