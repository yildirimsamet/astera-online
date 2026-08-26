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
    noRadar: 'Radarın da yok; aynısını sana kimin yaptığını göremiyorsun.',
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
    caught: ' · sondayı yakaladılar',
  },

  radar: {
    heading: 'Sana kim bakıyor',
    level: 'Radar L{{level}}',
    missing: 'Radarın yok',
    gives:
      'Sana gelen sondaları yakalar. L3’ten sonra gezegeninin çevresinde bir daire tarar ve o daireye giren filoyu anında haber verir.',
    cost: 'Biri bu gezegenin tam resmini çıkarabilir, senin haberin bile olmaz.',
    quiet: 'Seni kimse taramadı. Radar L{{level}} dinlemede.',
    scan: 'Tarama yakalandı',
    bearing: ' · galaktik {{bearing}} yönünden',
    origin: ' · {{planet}}',
    noteFleets:
      'Radar L{{level}} bir filoyu {{range}} birim öteden yakalıyor. Ağır ve yavaş bir filo o dairenin içinde hızlısından çok daha uzun kalır; yani sana asıl zarar verecek akınlarda daha çok vaktin oluyor.',
    noteProbes: 'Radar L{{level}} sondaları yakalıyor. L3’ten sonra gelen filoları da haber verir.',
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
  roundsLabel: 'Raunt',
  taken: 'Alınan',
  lost: 'Kaybedilen',
  dominion: 'Hâkimiyet',
  clansAtLaunch: 'Bu filo yola çıktığındaki klanlar',
  yourClan: 'Senin tarafın',
  theirClan: 'Karşı taraf',
  noClan: 'Klan yok',
  theirs: 'Karşıda ne varmış',
  theirsEmpty: 'Karşıdan hiçbir şey yok edilmedi.',
  yours: 'Sana neye mal oldu',
  yoursEmpty: 'Hiçbir şey kaybetmedin.',
  howItWent: 'Çatışma nasıl geçti',
  roundLine: '<0>{{dealt}}</0> vurdun, <1>{{took}}</1> yedin',
  shield: 'kalkan {{amount}}',
  breacherShield: 'Delici +{{amount}}',
  gradeDecisive: 'KESİN',
  gradePartial: 'KISMİ',
  gradeRepelled: 'PÜSKÜRTÜLDÜ',
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

  developmentLabel: 'Gelişim',
  developmentValue: '{{tier}}. kademe',
  developmentInBand:
    'Gezegenin ne kadar geliştiği. Sen {{tier}}. kademedesin; burası vurabileceğin aralıkta.',
  developmentOutOfBand:
    'Menzil dışı. Sen {{tier}}. kademedesin, {{low}} ile {{high}} arasına vurabilirsin.',

  hardwareLabel: 'Yörüngedeki uydular',
  hardwareNote: 'Donanımı görüyorsun. Ne işe yaradığını öğrenmek bir sondaya bakar.',

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

  probeGapLabel: 'Kaynak ve savunma',
  probeGapMissing: 'Buraya hiç yakından bakan olmadı',
  probeGapWhy:
    'Aşağıda ne olduğunu bilmeden koca bir filoyu riske atacaksın. Sonda, o tahmini hiç değilse bir aralığa indirir.',

  compositionLabel: 'Sahaya sürdüğü bilinen',
  compositionValue: 'en az {{fleet}}',
  compositionNote: 'Son çatışmada yok ettiklerin. Yerlerine yenisini koymuş olabilirler.',
  compositionGapLabel: 'Gerçekte ne uçuruyorlar',
  compositionGapMissing: 'Onlarla hiç çatışmadın',
  compositionGapWhy: 'Bir filonun tam bileşimi yalnızca savaş raporundan çıkar.',
} as const;
