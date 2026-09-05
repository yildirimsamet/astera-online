/**
 * TİCARET GEMİSİ — tüccarın rayı, köşedeki rozeti ve konvoy sayfası. D156.
 *
 * Kendi dosyasında; `world.ts`'in sonuna eklenmiş bir blok değil. Dizinin kuralı
 * bu: her yüzeyin kendi ad alanı olur. Tüccar bir yüzeydir — diskte bir ray,
 * köşede bir rozet ve takasın taahhüt edildiği tek sayfa.
 *
 * Buradaki hiçbir satır `transfer` ile paylaşılmaz; yer yer aynı şeyi söyleseler
 * de iki ayrı denetimdir. Biri yeniden yazıldığında diğeri onunla birlikte
 * kaymamalı (D55).
 */
export const trade = {
  /* ── köşedeki rozet ─────────────────────────────────────────── */
  chip: "Ticaret Gemisi",
  chipRemaining: "{{remaining}} kaldı",

  /* ── odak rayı ──────────────────────────────────────────────── */
  eyebrow: "Ticaret penceresi",
  title: "Ticaret Gemisi",
  summaryReach: "{{duration}} sonra yetişir",
  rateHeading: "Eşit değer",
  rateReading: "Bir döteryuma karşılık {{amount}} {{resource}}",
  leavesIn: "Ayrılmasına",
  reachLabel: "En erken varış",
  reachNone: "Yetişilemiyor",
  boundary:
    "Bu gemiyi, yörüngesini ve kurunu galaksideki her komutan görür. Kota da yok, komisyon da.",
  open: "Konvoy gönder",
  noCraft: "Bu dünyada bekleyen gemi yok",
  noCarrier: "Kurye, Seyyah veya Atlas gerek",
  carriersAway: "Kargo gemilerin dışarıda",
  tooLate: "Buradaki hiçbir gemi zamanında yetişemez",

  /* ── konvoy sayfası ─────────────────────────────────────────── */
  sheetEyebrow: "Ticaret penceresi · {{duration}} kaldı",
  sheetTitle: "Ticaret Gemisi",
  alloy: "Alaşım",
  crystal: "Kristal",
  deuterium: "Döteryum",
  convoyHeading: "Konvoy",
  offerHeading: "Veriyorum",
  askHeading: "Alıyorum",
  askUnits: "{{units}} birim",
  carrierRoom: "{{count}} evde · beheri {{volume}} hacim",
  holdReading: "Konvoyun kargo hacmi {{volume}}",
  ceilingStore: "En çok {{amount}} — deponda bu kadar var · tam {{worth}} {{good}} eder",
  ceilingHold: "En çok {{amount}} — tam {{worth}} {{good}} eder. Konvoyu büyüt, artsın.",
  splitLabel: "Ne alacağın",
  splitToward: "daha çok {{resource}}",
  legOut: "Gidiş",
  legHome: "Dönüş",
  legHold: "Konvoy",
  legReturnDecides:
    "Aldığın, verdiğinden hacimli. Dönüşte ancak bu kadarını taşıyabilirsin — üstteki sınırı koyan bu. Daha fazla vermek için konvoya gemi ekle.",
  givePick: "Ne vereceksin",
  giveAmount: "verilecek {{resource}}",
  giveSpend: "Depodan çıkan",
  holdNoCarrier: "Ambarı yalnız Kurye, Seyyah ve Atlas taşır — birini seç.",
  hullNone: "Bu dünyada yok",
  bays: "Uçuş yatakları",
  baysReading: "{{total}} uçuş yatağının {{used}} tanesi dolu",
  homeDefence: "Burada {{ships}} gemi kalır · {{power}} savunma gücü",
  fuel: "iki bacağın yakıtı",
  figureOut: "Gidiş",
  figureAway: "Dışarıda",
  figureDistance: "Mesafe",
  figureNone: "rota yok",
  fewer: "{{name}} azalt",
  more: "{{name}} artır",
  quantity: "{{name}} adedi",
  max: "Tüm {{name}} gemilerini gönder",
  maxShort: "Tümü",

  /* ── taahhüt ────────────────────────────────────────────────── */
  send: "Konvoyu gönder",
  sending: "Yola çıkıyor",
  back: "Geri",
  commit: "Gönder — geri çağrılamaz",
  warning: "Yola çıkan konvoy geri çağrılamaz. {{duration}} boyunca dışarıda olacak.",
  fleetsave: "Dışarıdayken ona akın edilemez; ama bu dünyayı da savunamaz.",
  launched: "Konvoy yola çıktı · {{duration}}",

  /* ── sunucunun her hayırına bir gerekçe ─────────────────────── */
  chooseFleet: "Bir konvoy seç",
  windowClosed: "Tüccar gitti",
  noBay: "Boş uçuş yatağı yok",
  needsCarrier: "Kurye, Seyyah veya Atlas ekle",
  noOffer: "Ne vereceğini seç",
  noAsk: "Ne alacağını seç",
  cannotPay: "Teklifin bunu karşılamıyor",
  selfSwap: "Tüccar bir kaynağı kendisiyle takas etmez",
  badAmount: "Yalnızca tam birim",
  overHold: "Konvoyun kargo hacmi yetmiyor",
  noStock: "Depoda o kadarı yok",
  cannotReach: "Konvoyun varmadan ayrılmış olacak",
  noFuel: "Uçuş için döteryum yetmiyor",
} as const;
