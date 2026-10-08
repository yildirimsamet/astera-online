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
  compareHeading: 'Silahlı birliklerin değeri',
  compareYours: 'Gönderilen',
  compareTheirs: 'Orada duran',
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, şu an okunuyor',
  compareUnknown: 'Hiç ölçülmedi',
  compareUnknownWhy: 'Bu tarafa bir sayı koyacak olan şey bir sonda.',
  compareLabel: '{{yours}} gönderiyorsun; dünyalarının son okuması {{theirs}}',
  /** Taktik geri çekilme: karşılaştırmadaki sonuç satırı ve bir dokunuş derindeki kural. */
  escapeRun: 'Hatları ateş gücünün üçte birinin altında: yakıtları yetiyorsa gemileri kaçar, yalnız yer topları savaşır.',
  escapeStand: 'Gemileri kalıp savaşır: okuma ateş gücünün üçte birinden yüksek ya da bu kanadın silebileceğinden fazla.',
  escapeUnsure: 'Gemileri kaçabilir; okuma geri çekilmenin tüm koşullarını göstermiyor.',
  escapeAt: 'Kaçış güç çizgisi: {{at}}',
  escapeRule:
    "Taktik geri çekilme için saldıran ateş gücü savunmanın en az üç katı olmalı ve saldırı savunma hattını yok edecek durumda olmalıdır. Gezegen deposunda {{distance}} birimlik gidiş-dönüşün yakıtı da bulunmalıdır. Koşullar sağlanırsa gemiler savaştan kaçar. Yer savunması kalır ve kaynaklar yine yağmalanabilir.",
  escapeMinimumRule: 'Savunanın gezegende en az {{count}} savaş gemisi de olmalı. Sonda okuması gemi sayısını göstermez.',
  compareRuleToggle: 'Bu nedir?',
  compareMeaning: 'Kaynak maliyetidir; saldırı hasarı değildir. Büyük filo tek başına zafer garantisi vermez.',
  compareRule:
    "İki tarafın ateş edebilen gemi ve yer savunmaları kaynak değeriyle karşılaştırılır; kalkan ve silahsız gemiler bu değere dahil değildir. Tahmin, sınıfları, araştırmaları ve bilinen kalkanı da kullanır. Kısmi ve tam başarı için en az bir geminin sağ kalması gerekir. Bilinmeyen sınıflar veya kalkan, eşikleri aralık haline getirir: sol uç en kötü, sağ uç en iyi durumdur. Alttaki kayıp tahmini savaşın olası bedelini gösterir. Bilgi eski olabilir; rastgele atış değişimleri tahmine dahil değildir.",
  linesClears: 'Savunma en çok {{at}} ise tam başarı',
  linesBreaks: 'Savunma en çok {{at}} ise en az kısmi başarı',
  lineJoin: ' · ',
  lossLabel: 'Senin tahmini kaybın: filonun {{share}} kadarı (kaynak değerine göre)',
  lossUncertainty: 'Bu bir kazanma olasılığı değil, mevcut bilgilere dayalı kayıp aralığıdır.',
  lossTotalRisk: 'Yüksek risk: Hiçbir gemin geri dönmeyebilir.',
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
