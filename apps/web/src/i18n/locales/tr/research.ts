/**
 * ARAŞTIRMA EKRANI. T12.
 *
 * Türkçesi Türkçe yazılır: İngilizceden çevrilmiş cümle değil, bir Türk oyuncunun
 * kuracağı cümle. "Under way" burada "Sürüyor" — "yolda" değil; slot bir sıra
 * değil, tek bir tezgâh.
 */
export const research = {
  eyebrow: "Komutan",
  title: "Araştırma",
  premise:
    "Bir kez tamamlanır, kalıcı olur ve sahip olduğun bütün dünyalarda geçerlidir.",

  queueTitle: "Araştırma sırası",
  queueCapacity: "{{count}} yuva",
  queueLane: "Komutan araştırması",
  queueGlobalHint:
    "Bu sıra komutanına aittir ve başlayan araştırma iptal edilemez. Her gezegendeki İnşaat ve Tersane sıraları ayrı çalışır.",
  runningLabel: "Sürüyor",
  runningFinishes: "{{time}}’de biter",
  idleLabel: "Sürmekte olan araştırma yok",
  idleHint:
    "Haritadan bir yıldız seç. Burada üç proje sıraya girebilir.",

  frontierBand: "Ufuk",
  frontierNote:
    "Galaksideki belirli olaylarla keşfedilir. Keşfettikten sonra kaynak ve araştırma süresi harcayarak tamamlarsın.",
  industryBand: "Endüstri",
  industryNote:
    "Üretimi, yapım ve onarım süresini, taşıma kapasitesini geliştirir. Seviye sınırını ve ön koşulları her projenin ayrıntısında görebilirsin.",
  doctrineBand: "Doktrin",
  doctrineNote:
    "Üst seviye gemileri açar; saldırı, zırh ve itki değerlerini ayrı ve sınırlı basamaklarda geliştirir. Savaş seviyeleri sonda raporlarında görünür.",
  strategicBand: "Stratejik",
  strategicNote: "Her dünyanın tutabileceği Ölüm Yıldızı ve önleyici şarj sayısını artırır.",

  act: "Araştır",
  details: "Ayrıntılar",
  cannotAfford: "Kaynak yetmiyor",
  complete: "araştırıldı",
  rowRunning: "Araştırılıyor",
  rowQueued: "Sırada",

  needCore: "Ana gezegende Komuta Çekirdeğini {{level}}. seviyeye yükselt",
  queueFull:
    "Sırada zaten 3 araştırma var. Yenisini eklemek için birinin bitmesini bekle.",
  at: "{{duration}} sonra araştırılabilir",
  isotopeFirst: "Önce İzotop Spektrometrisi’ni araştır",
  /* Ek almayan bir kalıp: her proje adı bu cümleye eksiz oturur. */
  prerequisiteFirst: "Önce {{name}} araştırmasını tamamla",
  prerequisiteLevelFirst: "Önce {{name}} araştırmasını {{level}}. seviyeye çıkar",
  nameAtLevel: "{{name}} {{level}}. seviye",
  cargoInsight: "Bir akında ambarını doldur; hedefte ganimet kalsın",
  shieldInsight: "Aegis akın hasarının en az {{share}}’ini emsin",

  sheetEyebrow: "Araştırma projesi",
  sheetComplete: "Araştırma tamam",
  sheetCost: "Araştırma bedeli",
  sheetOnce:
    "Komutanına ait Araştırma sırasına girer. İnşaat veya Tersane yuvası kullanmaz.",
  sheetRung: "{{max}} seviyenin {{level}}. seviyesi. Her seviye ayrı satın alınır.",

  isotopeName: "İzotop Spektrometrisi",
  isotopeTag: "Döteryum madenciliğini açar",
  isotopeRole:
    "Keşfedilmiş izotop asteroitlerinden döteryum toplamayı açar.",
  isotopeDetail:
    "Bir kez tamamlayınca izotop asteroitlerini maden hedefi olarak seçebilirsin. Kazıcılar yükü Havuza getirir; harcamadan önce toplamalısın. Başka oyuncular kaynakları önce alabilir. Araştırma, gezegende otomatik yakıt üretimi sağlamaz.",
  denseName: "Yoğun Yakıt Hücreleri",
  denseTag: "Gemi İtkisini açar",
  denseRole:
    "Gemi İtkisi araştırmasını açar. Keşif için akında kargon dolmalı ve hedefte ganimet kalmalıdır.",
  denseDetail:
    "Keşif, Yoğun Yakıt Hücrelerini araştırmaya açar; otomatik tamamlamaz. Tamamlanınca Gemi İtkisini açar. İtki, filo gemilerini hızlandırır; Atlas ve Argosi için gerekir. Kazıcılar ve sondalar ayrı hız kuralları kullanır.",
  graviticName: "Gravitik Yükler",
  graviticTag: "Söndürücü’yü açar",
  graviticRole:
    "Söndürücüyü açar. Keşif için aktif Aegis, verdiğin hasarın en az {{share}}’ini emmelidir.",
  graviticDetail:
    "Keşif koşulu için savunması ve aktif Aegis’i olan gezegene saldır; kazanman gerekmez. Keşfedilen araştırmayı tamamlamak, Söndürücünün uzmanlık koşulunu karşılar. Tersane ve Mühendislik koşulları da geçerlidir. Söndürücünün ek hasarı yalnız aktif kalkana uygulanır; gemilere veya yer savunmalarına geçmez.",

  synthesisName: "Döteryum Sentezi",
  synthesisTag: "Rafineri seviye sınırını yükseltir",
  synthesisRole:
    "Her araştırma seviyesi, bütün gezegenlerinde Döteryum Rafinerisi sınırını üç seviye artırır.",
  synthesisDetail:
    "Araştırma, izin verilen seviyeyi artırır; Rafineriyi senin yerine kurmaz. Yakıt üretmek istediğin her gezegende Rafineriyi ayrıca yükselt. Gezegenin Komuta Çekirdeği de yeni seviyeye izin vermelidir.",
  yardName: "Tersane Otomasyonu",
  yardTag: "Gemileri daha hızlı kurar",
  yardRole:
    "Bütün gezegenlerinde yeni gemi ve yer savunması üretim siparişlerini hızlandırır.",
  yardDetail:
    "Her seviye, Kazıcılar ve yer savunmaları dahil yeni Tersane siparişlerinin üretim süresini azaltır. Tablo, temel sürenin ne kadarının kaldığını gösterir. Kaynak bedeli ve sıra kapasitesi değişmez. İnşaat ve gemi onarımları ayrı araştırmalardan etkilenir.",
  robotsName: "Yapay Zekâ Robotları",
  robotsTag: "Yapıları daha hızlı kurar",
  robotsRole:
    "Bina, gezegen cihazı ve uydu için yeni İnşaat siparişlerinin süresini kısaltır.",
  robotsDetail:
    "Etki, bütün gezegenlerindeki yeni İnşaat siparişlerine uygulanır. Tablo, temel sürenin ne kadarının kaldığını gösterir. Gemiler ve yer savunmaları Tersaneyi kullanır; etkilenmezler. Kaynak bedeli ve sıra kapasitesi değişmez.",
  industrialName: "Endüstri",
  industrialTag: "Gemileri daha ucuza ve hızlı onarır",
  industrialRole:
    "Bütün Tamirhanelerde gemi onarımının bedelini ve süresini azaltır.",
  industrialDetail:
    "1. seviyede normal onarım bedeli ve süresinin %75’i, 2. seviyede %50’si kullanılır. Etki bütün gezegenlerinde geçerlidir. Yeni gemi üretimini hızlandırmaz. %20 veya daha az hasarlı gemiler inişte zaten ücretsiz onarılır.",
  holdsName: "Kazıcı Ambarları",
  holdsTag: "Kazıcılar daha çok taşır",
  holdsRole:
    "Kazıcıların taşıma kapasitesini artırır. 3. seviye, her gezegende üçüncü Kazıcı yuvasını açar.",
  holdsDetail:
    "Her seviye, Kazıcının bir seferde taşıyabileceği kaynağı artırır. Matkabın ambar bonusu, araştırmayla büyüyen kapasiteye de uygulanır. Etki bütün gezegenlerinde geçerlidir. Normal akın veya ticaret kargosunu artırmaz.",
  cargoName: "Gemi Ambarları",
  cargoTag: "Her ambar daha çok taşır",
  cargoRole:
    "Akın, gezegen transferi ve ticaret için filo kargo kapasitesini artırır.",
  cargoDetail:
    "Her seviye, akın ve transferlerde filo gemilerinin ambarını büyütür. Kurye, Seyyah, Atlas ve Argosi ticarette de daha çok taşır. Hedefte az kaynak varsa büyük ambar daha fazla ganimeti garanti etmez. Kazıcılar için Kazıcı Ambarları kullanılır.",

  engineeringName: "Yıldız Gemisi Mühendisliği",
  engineeringTag: "Üst seviye gemileri açar",
  engineeringRole:
    "1. seviye, 3. kademe gemilerin; 2. seviye, 4. kademe gemilerin mühendislik koşulunu karşılar.",
  engineeringDetail:
    "1. seviye, 3. kademe gemilerin; 2. seviye, 4. kademe gemilerin mühendislik koşulunu karşılar. Doğrudan saldırı veya dayanım bonusu vermez. Gemiye göre Gemi Gücü, Gemi Zırhı, Gemi İtkisi veya Gravitik Yükler de gerekebilir. Gezegenin Tersane koşulu da karşılanmalıdır.",
  powerName: "Gemi Gücü",
  powerTag: "Savaş gemilerinin saldırısını artırır",
  powerRole:
    "Bütün gezegenlerindeki savaş gemilerinin saldırısını artırır; bazı gelişmiş gemilerin koşulunu karşılar.",
  powerDetail:
    "Her seviye, Söndürücü dahil normal saldırıyı artırır; mevcut gemilerine de uygulanır. Silahsız gemilere saldırı eklemez. Yer savunmaları, Kazıcılar ve sondalar etkilenmez. Saldıran filolar kalkış, normal savunma ise savaş anındaki araştırmaları kullanır.",
  armorName: "Gemi Zırhı",
  armorTag: "Gemilerin gövde dayanımını artırır",
  armorRole:
    "Nakliyeciler dahil filo gemilerinin dayanımını artırır; bazı gelişmiş gemilerin koşulunu karşılar.",
  armorDetail:
    "Artış, bütün gezegenlerindeki mevcut filo gemilerine de uygulanır. Yer savunmaları, Kazıcılar ve sondalar etkilenmez. Saldıran filolar kalkış, normal savunma ise savaş anındaki araştırmaları kullanır. Dayanım artışı, saldırı veya kargo eklemez.",
  propulsionName: "Gemi İtkisi",
  propulsionTag: "Filonun hızını artırır",
  propulsionRole:
    "Filo hızını artırır; Atlas ve Argosi itki koşullarını karşılar. Yoğun Yakıt Hücreleri gerekir.",
  propulsionDetail:
    "Dört seviyenin her biri temel hıza %25 ekler; son seviyede hız iki katına çıkar. Karma filo, en yavaş gemisinin geliştirilmiş hızında uçar. Etki, tamamlanmadan sonra gönderilen görevlere uygulanır. Kazıcılar ve sondalar etkilenmez.",
  groundDoctrineName: "Yer Savunma Doktrini",
  doctrineTag: "Yer savunmasını geliştirir",
  doctrineRole:
    "Bütün gezegenlerindeki Tabya, Zıpkın ve Kirpinin saldırısını ve dayanımını artırır.",
  groundDoctrineDetail:
    "Etki, mevcut Tabya, Zıpkın ve Kirpi yer savunmalarına da uygulanır. Savunmalar, savaş başladığında tamamlanmış araştırma seviyesini kullanır. Yer kapasitesi, ücretsiz yeniden kurulum ve sınıf eşleşmeleri değişmez. Hareketli gemilere bonus eklemez.",

  gridName: "Önleme Ağı",
  gridTag: "Dünya başına dört önleyici şarj",
  gridRole: "Her gezegende önleyici şarj kapasitesini 2’den 4’e çıkarır.",
  gridDetail: "Araştırma kapasiteyi artırır; ücretsiz şarj vermez. Her şarj, Anten ve Radar 3 bulunan gezegende üretilmelidir. Çalışan sensörler bir Ölüm Yıldızının önlenmesini tetikleyebilir; atışta bir şarj tüketilir. Kapasite artışı, şarjlar hazırsa işe yarar.",
  stockpileName: "Stratejik Stok",
  stockpileTag: "Dünya başına iki Ölüm Yıldızı",
  stockpileRole: "Her gezegende Ölüm Yıldızı kapasitesini 1’den 2’ye çıkarır. Her silah ayrı üretilir ve ödenir.",
  stockpileDetail: "Sınır, bütün filona ortak değil her gezegene ayrı uygulanır. İkinci silah, birincinin üretimi bitince başlar; tam bedelini ve süresini kullanır. Birden fazla silah, hazır önleyici şarj sayısını aşabilir; isabet garanti değildir.",
} as const;
