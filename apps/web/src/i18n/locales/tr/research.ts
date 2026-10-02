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
    "İlk dakikadan açıktır ve beşer kademeden oluşur. Üretim, yapım süresi ve taşıma kapasitesini geliştirir.",
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
  sheetRung: "{{max}} kademenin {{level}}. kademesi. Her kademe ayrı alınır.",

  isotopeName: "İzotop Spektrometrisi",
  isotopeTag: "Döteryum madenciliğini açar",
  isotopeRole:
    "İzotop kayalarındaki Döteryumu gösterir ve onlara Kazıcı göndermeni sağlar. Dönen yük üretim havuzuna gelir.",
  isotopeDetail:
    "Bir kez tamamlandığında izotop asteroitlerini seçilebilir maden hedeflerine çevirir. Kapışılan Döteryuma erişim açar; gezegende kendiliğinden yakıt üretmez.",
  denseName: "Yoğun Yakıt Hücreleri",
  denseTag: "Gemi İtkisini açar",
  denseRole:
    "Keşfetmek için bir akında ambarını doldur ve hedefte ganimet bırak. Tamamlandığında Gemi İtkisi araştırma basamaklarını açar.",
  denseDetail:
    "Tamamlandığında komutanın için Gemi İtkisi araştırmasını kalıcı olarak açar. İtki, filondaki bütün gemileri hızlandırır ve Atlas üretim koşullarından biridir; Kazıcı ve sonda bundan etkilenmez.",
  graviticName: "Gravitik Yükler",
  graviticTag: "Söndürücü’yü açar",
  graviticRole:
    "Açmak için savunması ve aktif Aegis’i olan bir dünyaya saldır; kalkan hasarın en az {{share}}’ini emsin. Bir Ok bile yeter, kazanman gerekmez. Söndürücü aktif kalkana beş kat etki eder.",
  graviticDetail:
    "Tamamlandığında Söndürücünün uzman araştırma koşulunu kalıcı olarak karşılar. Söndürücü aktif Aegis’e verilen özel bir cevaptır; genel hasar yükseltmesi değildir ve artan kalkan hasarı gemilere ya da yer toplarına taşmaz.",

  synthesisName: "Döteryum Sentezi",
  synthesisTag: "Rafineri seviye sınırını yükseltir",
  synthesisRole:
    "Her kademe, bütün dünyalarında üç yeni Döteryum Rafinerisi seviyesi açar.",
  synthesisDetail:
    "Her araştırma kademesi bütün dünyalarında Döteryum Rafinerisinin seviye sınırını üç artırır. Yakıt üretmek istediğin dünyada bu Rafineri seviyelerini ayrıca kurarsın.",
  yardName: "Tersane Otomasyonu",
  yardTag: "Gemileri daha hızlı kurar",
  yardRole:
    "Hareketli gemilerin üretim süresini kısaltır; yer savunmalarını ve üretim sırası kapasitesini etkilemez.",
  yardDetail:
    "Her kademe bundan sonra vereceğin bütün hareketli gemi siparişlerini, Kazıcı dâhil, tüm dünyalarında daha çabuk bitirir. Yer savunmalarını hızlandırmaz; kaynak bedelini düşürmez ve Tersane sırasına yeni yuva eklemez.",
  robotsName: "Yapay Zekâ Robotları",
  robotsTag: "Yapıları daha hızlı kurar",
  robotsRole:
    "İnşaat sırasına giren her şeyin süresini kısaltır; gemileri ve yer savunmalarını etkilemez.",
  robotsDetail:
    "Her kademe bütün dünyalarında İnşaat sırasına vereceğin her siparişi daha çabuk bitirir: binalar, enstrümanlar ve uydular. Gemileri hızlandırmaz — o Tersane Otomasyonu'nun işidir; kaynak bedelini düşürmez ve sıraya yeni yuva eklemez.",
  industrialName: "Endüstri",
  industrialTag: "Gemileri daha ucuza ve hızlı onarır",
  industrialRole:
    "Tamirhanedeki her işin bedelini ve süresini kısaltır",
  industrialDetail:
    "Her kademe, tüm dünyalarında hasarlı bir gemiyi onarmanın bedelinden ve süresinden dörtte bir düşer: 1. seviyede %75, 2. seviyede %50. Gemileri daha hızlı üretmez — o Tersane Otomasyonu'nun işidir — ve savaştan sonra %20 ya da daha az hasar alan gemi zaten ücretsiz onarılır.",
  holdsName: "Kazıcı Ambarları",
  holdsTag: "Kazıcılar daha çok taşır",
  holdsRole:
    "Her Kazıcının tek seferde taşıdığı cevheri artırır; Matkabın sağladığı ambar artışı bunun üzerine uygulanır.",
  holdsDetail:
    "Her kademe bütün Kazıcıların tek seferde getirdiği cevheri artırır. Matkabın 2 katlık ambar artışı da araştırmayla büyüyen kapasitenin üzerine uygulanır; üçüncü kademe her dünyada üçüncü Kazıcı yuvasını açar.",
  cargoName: "Gemi Ambarları",
  cargoTag: "Her ambar daha çok taşır",
  cargoRole:
    "Akın ganimetini, dünyalar arası transferi ve ticaret konvoyunu birlikte artırır; asteroit madenciliğinin kendi kademesi vardır.",
  cargoDetail:
    "Her kademe akınlarda ve dünyaların arasındaki aktarımlarda bütün hareketli gemilerin ambarını büyütür. Kurye, Seyyah, Atlas ve Argosi ticaret konvoylarında da daha çok taşır. Kazıcılar için Kazıcı Ambarları gerekir.",

  engineeringName: "Yıldız Gemisi Mühendisliği",
  engineeringTag: "Üst seviye gemileri açar",
  engineeringRole:
    "Mühendislik I üçüncü, Mühendislik II dördüncü seviye gövde iznini açar. Her geminin sistem araştırması ve Tersane koşulu ayrıca geçerlidir.",
  engineeringDetail:
    "Mühendislik bir savaş çarpanı değil, üretim iznidir. İlk kademe üçüncü seviye, ikinci kademe dördüncü seviye gövde kapılarını açar; belirli bir gemi ayrıca Güç, Zırh, İtki veya Gravitik Yükler ile belirtilen Tersane seviyesini isteyebilir.",
  powerName: "Gemi Gücü",
  powerTag: "Savaş gemilerinin saldırısını artırır",
  powerRole:
    "Filondaki savaş gemilerinin saldırısını yükseltir ve ileri saldırı gemilerinin üretim koşullarına katkı verir. Yük gemileri ve yer savunması etkilenmez.",
  powerDetail:
    "Her kademe, Söndürücü dâhil bütün savaş gemilerinin normal saldırısını artırır ve hâlihazırda sahip olduğun gemilere de uygulanır. Nakliye gemilerine saldırı eklemez; Tabya, Kirpi, Kazıcı ve sonda etkilenmez. Saldıran kalkış, savunan çatışma anındaki seviyeyi kullanır.",
  armorName: "Gemi Zırhı",
  armorTag: "Gemilerin gövde dayanımını artırır",
  armorRole:
    "Nakliye dâhil filondaki bütün gemilerin dayanımını yükseltir ve ileri savunma gemilerinin üretim koşullarına katkı verir.",
  armorDetail:
    "Her kademe, Kurye, Seyyah, Atlas ve Argosi dâhil filondaki bütün gemilerin gövde dayanımını artırır. Tabya, Kirpi, Kazıcı ve sonda etkilenmez. Saldıran filo kalkış, savunan taraf çatışma anındaki seviyeyi kullanır.",
  propulsionName: "Gemi İtkisi",
  propulsionTag: "Filonun hızını artırır",
  propulsionRole:
    "Filondaki bütün gemilerin hızını artırır ve Atlas üretim koşuluna katkı verir. Yoğun Yakıt Hücrelerinden sonra açılır.",
  propulsionDetail:
    "Dört kademenin her biri filondaki bütün gemilerin taban hızına dörtte bir ekler; sonuncusu hızı ikiye katlar ve her uçuşu yarıya indirir. Karma filo yine en yavaş üyesinin hızında uçar; böylece itki seçtiğin filoyu geliştirirken gövde profilini silmez. Kazıcı ve sonda etkilenmez; yalnız tamamlandıktan sonra hesaplanan görevler artışı alır.",
  groundDoctrineName: "Tabya/Kirpi Doktrini",
  doctrineTag: "Yer savunmasını geliştirir",
  doctrineRole:
    "Tabya ve Kirpinin saldırı ile gövde dayanımını birlikte yükseltir; kapasite, enkazdan geri kurulum ve sınıf eşleşmeleri değişmez.",
  groundDoctrineDetail:
    "Bütün dünyalarındaki Tabya ve Kirpileri güçlendirir. Yer kapasitesi ve enkazdan geri kurulum kuralı değişmez; savunmada çatışma anındaki kademe kullanılır.",

  gridName: "Önleme Ağı",
  gridTag: "Dünya başına dört önleyici şarj",
  gridRole: "Her dünyanın tutabileceği önleyici şarj sayısını 2'den 4'e çıkarır.",
  gridDetail: "Araştırma olmadan her dünya 2 önleyici şarj yükleyebilir; bu araştırma sınırı her dünyada 4'e çıkarır. Şarj için o dünyada Anten ve Radar 3 gerekir. Yüklü şarj, zamanlı Radar önleme çemberine giren veya dünyalarından birinin Teleskop görüşünde tanımlanan ilk Ölüm Yıldızı’nı imha eder ve tükenir. Bir şarj bir silahı durdurur; dolu bir dünya ancak şarjından fazla silah aynı anda gelirse vurulur.",
  stockpileName: "Stratejik Stok",
  stockpileTag: "Dünya başına iki Ölüm Yıldızı",
  stockpileRole: "Her dünyanın tutabileceği Ölüm Yıldızı sayısını 1'den 2'ye çıkarır; ikincisi birincinin üretimi bitince başlar.",
  stockpileDetail: "Araştırma olmadan her dünya 1 Ölüm Yıldızı tutar; bu araştırma sınırı komutan genelinde değil, her dünya için 2'ye çıkarır. İkinci silah da tam bedelini ve tam yapım süresini ister ve birinciden sonra üretilir. Birkaç dünyadan aynı anda vurmak, savunmacının şarjlarını aşmanın yoludur.",
} as const;
