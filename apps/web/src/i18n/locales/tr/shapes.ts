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
} as const;

/** Sondanın bulanık okuması, olduğu gibi çizilir: `RangeBand`. */
export const rangeBand = {
  join: ' – ',
  reading: '{{label}}: {{low}} ile {{high}} arasında bir yerde',
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
  compareHeading: 'Ateş gücü',
  compareYours: 'Gönderilen',
  compareTheirs: 'Orada duran',
  compareRecord: '{{source}}, {{age}}',
  compareLive: '{{source}}, şu an okunuyor',
  compareUnknown: 'Hiç ölçülmedi',
  compareUnknownWhy: 'Bu tarafa bir sayı koyacak olan şey bir sonda.',
  compareLabel: '{{yours}} gönderiyorsun; dünyalarının son okuması {{theirs}}',
  compareRuleToggle: 'Bu nedir?',
  compareRule:
    'Ateş gücü, ateş edebilen gemi ve topların maliyetidir; iki taraf aynı ölçekte. Çizgiler savaş hesabının kendisinden gelir: senin gemilerin, senin araştırman ve sondanın onlar hakkında gördükleri — kalkan, araştırma, savunma dağılımı. İlk çizginin altındaki bir savunmayı bu filo temizler, ikincinin altındakini kırar. ±%8 zar hesaba katılmaz ve okuma eski olabilir.',
  linesClears: '{{at}} altındakini temizler',
  linesBreaks: '{{at}} altındakini kırar',
  lineJoin: ' · ',
  lossLabel: 'Beklenen kayıp {{share}}',
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
} as const;
