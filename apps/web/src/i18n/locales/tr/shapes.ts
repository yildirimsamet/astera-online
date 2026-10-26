/**
 * ÇİZİM DİLİNİN KENDİ SÖZCÜKLERİ. D142.
 *
 * Buradaki her satır, işini zaten yapmış bir şeklin altyazısı; ya da şekli hiç
 * göremeyen ekran okuyucu için kurulmuş bir cümle. Hiçbiri yükü tek başına
 * taşımaz: tek kelime okumayan bir oyuncu da yakıtın uçuşa yetip yetmediğini,
 * sondanın ne kadar emin olduğunu ve filonun hangi yöne baktığını görür.
 */

/** Depodan çıkan pay: `SpendBar`. */
export const spend = {
  reading: '{{label}}: {{spend}} gider, {{left}} kalır',
  readingSpend: '{{label}} — miktar: {{spend}}',
  readingShort: '{{label}}: {{short}} eksik',
  shortfall: '{{short}} eksik',
} as const;

/** Sondanın bulanık okuması, olduğu gibi çizilir: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: {{low}} ile {{high}} arasında bir yerde',
  yours: 'seninki {{value}}',
} as const;

/** Aracın yönü ve yolun neresinde olduğu: `FlightBar`. */
export const flightBar = {
  out: 'Gidiyor, bu dünyadan uzaklaşıyor',
  back: 'Bu dünyaya dönüyor',
  incoming: 'Üstümüze geliyor — yeri bilinmiyor',
} as const;

/** Counter döngüsünün kendi sözcükleri. D124. */
export const counter = {
  heading: 'Eşleşmeler',
  strongVs: '{{class}} sınıfına güçlü',
  weakVs: '{{class}} sınıfına zayıf',
  supportNote: 'Silahsız. Kendi tarafında bir muharip ayakta olduğu sürece korunur.',
  strong: 'Güçlü',
  weak: 'Zayıf',
  even: 'Eşit',
  none: 'Saldırısı yok',
  multiplier: '×{{mult}}',
  matchupLabel: '{{attacker}}, {{defender}} karşısında: {{outcome}}, ×{{mult}} hasar',
  cycleLabel: 'Akıncı Sur\'u, Sur Mızrak\'ı, Mızrak Akıncı\'yı yener',
  /** Combat v3 force ruler (owner 2026-10-25): each side’s power, their ratio, and the rule one tap deep. */
  compareHeading: "Göreli güç",
  compareLabel: "Senin gücün {{yours}}; onların gücü {{theirs}}",
  comparePick: "Bu hedefe karşı tartmak için gemi seç.",
  compareMeaning: "Birbirine karşı ateş gücü ve dayanıklılık; sınıf üstünlükleri dahil. Güçlü taraf filosunun daha büyük kısmını korur.",
  compareRule: "Güç, silahlı gemileri ve aktif yer savunmasını sayar: araştırmaları, hasarları ve karşı tarafa göre sınıf üstünlükleri ile Aegis yükü dahildir. Silahsız gemiler güce katkı vermez. Sonda aralık okur; bu yüzden her taraf bir aralıktır ve oranın alt ucu senin için en kötü durumdur. Okumalar eskir ve her savaşta atışlar rastgele sonuç verir.",
  ratioYou: "Sen {{band}} kat güçlüsün",
  ratioThem: "Onlar {{band}} kat güçlü",
  ratioOpen: "Okuma kimin güçlü olduğunu netleştirmiyor: onlar en çok {{them}}, sen en çok {{you}} kat güçlü olabilirsin",
  ratioEven: "Aşağı yukarı eşit",
  ratioNoFire: "Orada karşılık veren silah yok",
  ratioUnarmed: "Filonda ateş eden gemi yok",
  axisTheirs: "Onlar güçlü",
  axisEven: "Eşit",
  axisYours: "Sen güçlüsün",
  outcomeHeading: "Ortalamada her tarafın elinde kalan",
  outcomeRatio: "Oran",
  outcomeWeak: "Zayıf korur",
  outcomeStrong: "Güçlü kaybeder",
  outcomeNote: "Çok sayıda savaşın ortalamasıdır. Geri çekilip kurtulan gemiler korunmuş sayılır. 1:1 oranda büyük filolar daha çok korur.",
  escapeRun: "Okumanın tamamında gücün onlarınkinin en az {{ratio}} katı. Filon hatlarını yok edebiliyorsa ve depoları kalkışı karşılıyorsa gemileri kaçar.",
  escapeStand: "Gemileri kalıp savaşır: okumanın tamamında gücün onlarınkinin {{ratio}} katının altında.",
  escapeRule: "Gücün, aktif yer savunması dahil hatlarının gücünün en az {{ratio}} katıysa gemileri savaştan önce kaçar. Filon o hattı tamamen yok edebilmelidir. Gezegenleri {{distance}} birimlik gidiş-dönüş yakıtını karşılamalıdır. Yer savunması kalır ve kaynaklar yine yağmalanabilir.",
  compareYours: 'Gönderilen',
  compareTheirs: 'Orada duran',
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, şu an okunuyor',
  compareUnknown: 'Hiç ölçülmedi',
  compareUnknownWhy: 'Bu tarafa bir sayı koyacak olan şey bir sonda.',
  escapeUnsure: 'Gemileri kaçabilir; okuma geri çekilmenin tüm koşullarını göstermiyor.',
  escapeMinimumRule: 'Savunanın gezegende en az {{count}} savaş gemisi de olmalı. Sonda okuması gemi sayısını göstermez.',
  compareRuleToggle: 'Bu nedir?',
  lineJoin: ' · ',
  noteShieldUnmeasured: 'Kalkan gücü ölçülmedi',
  noteShapeUnread: 'Savunma dağılımı okunmadı',
  noteUnarmedUnknown: 'Yük gemileri sayılmadı',
  noteUnarmed_one: 'Savunmada {{band}} yük gemisi var',
  noteUnarmed_other: 'Savunmada {{band}} yük gemisi var',
  noteSeen: 'Sondanı fark ettiler',
  noteSomeAway: 'Sonda vardığında filolarının bir kısmı dışarıdaydı',
  noteTelescopeAway: 'Teleskop: filoları şu an dışarıda',
  noteTelescopeHome: 'Teleskop: filoları evde',
  noteLastRaid: 'Son akında ağırlıklı {{class}} düştü',
  mixMostly: 'Ağırlıklı olarak {{class}}',
  mixEven: 'Baskın bir sınıf yok',
  matchupMajority: 'Ağırlıklı {{class}} — yarıdan fazla',
  matchupRemainder: 'kalanı okunmadı, seni karşılayabilir',
  matchupUnread: "%{{share}} okunamadı",
  matchupMixed: 'Karma savunma — tek bir sert counter yok',
  matchupSplit: 'Okunan dağılım',
  matchupBring: '{{class}} getir',
  matchupSingle: 'Filon tek sınıf — counteri okunmayan kısımda olabilir',
  matchupExposure: 'güçlü %{{strong}} · zayıf %{{weak}}',
  matchupProbe: '2 tersane seviyesi üstü sonda dağılımı açar',
} as const;
