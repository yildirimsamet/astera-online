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
  premise: "Bir kez tamamlanır, kalıcı olur ve sahip olduğun bütün dünyalarda geçerlidir.",

  queueTitle: "Araştırma sırası",
  queueCapacity: "{{count}} yuva",
  queueLane: "Komutan araştırması",
  queueGlobalHint:
    "Bu sıra komutanına aittir ve başlayan araştırma iptal edilemez. Her gezegendeki İnşaat ve Tersane sıraları ayrı çalışır.",
  runningLabel: "Sürüyor",
  runningFinishes: "{{time}}’de biter",
  idleLabel: "Sürmekte olan araştırma yok",
  idleHint: "Aşağıdan bir proje başlat. Burada üç proje sıraya girebilir; başladığında iptal edilemez.",

  frontierBand: "Ufuk",
  frontierNote:
    "Galaksideki belirli olaylarla keşfedilir. Keşfettikten sonra kaynak ve araştırma süresi harcayarak tamamlarsın.",
  industryBand: "Endüstri",
  industryNote:
    "İlk dakikadan açıktır ve beşer kademeden oluşur. Üretim, yapım süresi ve taşıma kapasitesini geliştirir.",
  doctrineBand: "Doktrin",
  doctrineNote:
    "İleri gövde seviyelerini açar; Fleet V2 saldırı, zırh ve itki değerlerini ayrı ve sınırlı basamaklarda geliştirir. Savaş seviyeleri sonda raporlarında görünür.",
  strategicBand: "Stratejik",
  strategicNote: "Ölüm Yıldızı’nı, onu durduran Önleme Ağını ve ikinci silah kapasitesini açar.",

  act: "Araştır",
  complete: "araştırıldı",

  needCore: "Komuta Çekirdeğini {{level}}. seviyeye yükselt",
  queueFull: "Sırada zaten 3 araştırma var. Yenisini eklemek için birinin bitmesini bekle.",
  at: "{{duration}} sonra araştırılabilir",
  warAt: "Savaş dönemi {{duration}} sonra başlar",
  isotopeFirst: "Önce İzotop Spektrometrisi’ni araştır",
  graviticFirst: "Önce Gravitik Yükler’i araştır",
  cargoInsight: "Bir akında ambarını doldur; hedefte ganimet kalsın",
  shieldInsight: "Aegis akın hasarının en az {{share}}’ini emsin",

  sheetEyebrow: "Araştırma projesi",
  sheetComplete: "Araştırma tamam",
  sheetCost: "Araştırma bedeli",
  sheetOnce: "Komutanına ait Araştırma sırasına girer. İnşaat veya Tersane yuvası kullanmaz.",
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
    "Tamamlandığında komutanın için Gemi İtkisi araştırmasını kalıcı olarak açar. İtki, Fleet V2 kapsamındaki on sekiz gövdeyi hızlandırır ve Atlas üretim koşullarından biridir; Kazıcı, sonda ve Ölüm Yıldızı bundan etkilenmez.",
  graviticName: "Gravitik Yükler",
  graviticTag: "Söndürücü’yü açar",
  graviticRole:
    "Açmak için savunması ve aktif Aegis’i olan bir dünyaya saldır; kalkan hasarın en az {{share}}’ini emsin. Bir Ok bile yeter, kazanman gerekmez. Söndürücü aktif kalkana beş kat etki eder.",
  graviticDetail:
    "Tamamlandığında Söndürücünün uzman araştırma koşulunu kalıcı olarak karşılar. Söndürücü aktif Aegis’e verilen özel bir cevaptır; genel hasar yükseltmesi değildir ve artan kalkan hasarı gemilere ya da yer toplarına taşmaz.",
  deathStarName: "Ölüm Yıldızı Protokolü",
  deathStarTag: "Ölüm Yıldızı’nı açar",
  deathStarRole:
    "Komuta Çekirdeği 12 ve Tersane 5 olan bir dünyada, tek kullanımlık Ölüm Yıldızı inşa etmeni sağlar. Ana gezegen ele geçirilemez.",
  deathStarDetail:
    "Her atış bir Ölüm Yıldızı tüketir. İlk darbe yerdeki tüm filoyu ve devam eden bina siparişlerini yok eder; depo ile üretim havuzundaki kaynakların yarısını siler, Komuta Çekirdeğini bir, Aegis’i iki seviye düşürür ve sınırı aşan binaları yeni Çekirdek seviyesine indirir. Dünya iki saat üretim yapamaz, kaynak toplayamaz, sipariş veremez veya araç fırlatamaz. Bu toparlanma süresi içinde ele geçirme emriyle yapılan ikinci darbe, yalnız koloni veya tarafsız dünyayı ele geçirir.",

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
  holdsName: "Kazıcı Ambarları",
  holdsTag: "Kazıcılar daha çok taşır",
  holdsRole:
    "Her Kazıcının tek seferde taşıdığı cevheri artırır; Matkabın sağladığı ambar artışı bunun üzerine uygulanır.",
  holdsDetail:
    "Her kademe bütün Kazıcıların tek seferde getirdiği cevheri artırır. Matkabın 2,6 katlık ambar artışı da araştırmayla büyüyen kapasitenin üzerine uygulanır.",
  cargoName: "Gemi Ambarları",
  cargoTag: "Akınlar daha çok getirir",
  cargoRole:
    "Akın filosunun taşıyabileceği ganimeti artırır; dünyalar arası transferi ve asteroit madenciliğini etkilemez.",
  cargoDetail:
    "Her kademe hareketli filonun akında taşıyabileceği ganimeti artırır. Savaş sonunda açık stok kaldığında işe yarar; barışçıl transferleri ve asteroit madenciliğini etkilemez.",

  engineeringName: "Yıldız Gemisi Mühendisliği",
  engineeringTag: "İleri gövde seviyelerini açar",
  engineeringRole:
    "Mühendislik I üçüncü, Mühendislik II dördüncü seviye gövde iznini açar. Her geminin sistem araştırması ve Tersane koşulu ayrıca geçerlidir.",
  engineeringDetail:
    "Mühendislik bir savaş çarpanı değil, üretim iznidir. İlk kademe üçüncü seviye, ikinci kademe dördüncü seviye gövde kapılarını açar; belirli bir gemi ayrıca Güç, Zırh, İtki veya Gravitik Yükler ile belirtilen Tersane seviyesini isteyebilir.",
  powerName: "Gemi Gücü",
  powerTag: "Fleet V2 saldırısını artırır",
  powerRole:
    "Fleet V2 savaş gemilerinin saldırısını yükseltir ve ileri saldırı gövdelerinin üretim koşullarına katkı verir. Yük gemileri ile korunan birimler etkilenmez.",
  powerDetail:
    "Her kademe, Söndürücü dâhil Fleet V2 savaş gemilerinin normal saldırısını artırır ve mevcut gemilere de uygulanır. Nakliye gemilerine saldırı eklemez; Tabya, Kirpi, Kazıcı, sonda ve Ölüm Yıldızı etkilenmez. Saldıran kalkış, savunan çatışma anındaki seviyeyi kullanır.",
  armorName: "Gemi Zırhı",
  armorTag: "Fleet V2 gövde dayanımını artırır",
  armorRole:
    "Nakliye gemileri dâhil on sekiz Fleet V2 gövdesinin dayanımını yükseltir ve ileri savunma gövdelerinin üretim koşullarına katkı verir.",
  armorDetail:
    "Her kademe Kurye, Seyyah ve Atlas dâhil on sekiz Fleet V2 gemisinin gövde dayanımını artırır. Tabya, Kirpi, Kazıcı, sonda ve Ölüm Yıldızı etkilenmez. Saldıran filo kalkış, savunan taraf çatışma anındaki seviyeyi kullanır.",
  propulsionName: "Gemi İtkisi",
  propulsionTag: "Fleet V2 hızını artırır",
  propulsionRole:
    "On sekiz Fleet V2 gemisinin hızını artırır ve Atlas üretim koşuluna katkı verir. Yoğun Yakıt Hücrelerinden sonra açılır.",
  propulsionDetail:
    "Dört kademenin her biri on sekiz Fleet V2 gemisinin taban hızına dörtte bir ekler; sonuncusu hızı ikiye katlar ve her uçuşu yarıya indirir. Karma filo yine en yavaş üyesinin hızında uçar; böylece itki seçilen filoyu geliştirirken gövde profilini silmez. Kazıcı, sonda ve Ölüm Yıldızı etkilenmez; yalnız tamamlandıktan sonra hesaplanan görevler artışı alır.",
  groundDoctrineName: "Tabya/Kirpi Doktrini",
  doctrineTag: "Yer savunmasını geliştirir",
  doctrineRole:
    "Tabya ve Kirpinin saldırı ile gövde dayanımını birlikte yükseltir; kapasite, enkazdan geri kurulum ve sınıf eşleşmeleri değişmez.",
  groundDoctrineDetail:
    "Bütün dünyalarındaki Tabya ve Kirpileri güçlendirir. Yer kapasitesi ve enkazdan geri kurulum kuralı değişmez; savunmada çatışma anındaki kademe kullanılır.",

  gridName: "Önleme Ağı",
  gridTag: "Ölüm Yıldızı’nı düşürür",
  gridRole:
    "Yüklü bir önleyici, stratejik silahı 3. seviye Radar önleme çemberinde veya dünyalarından birinin Teleskop görüşünde otomatik olarak imha eder.",
  gridDetail:
    "Önleyici mühimmatına erişim verir. Mühimmatı kurmak için hedef dünyada Anten ve en az 3. seviye Radar gerekir. Yüklü mühimmat, zamanlı Radar önleme çemberine giren veya dünyalarından birinin Teleskop görüşünde tanımlanan ilk stratejik silahı otomatik imha eder ve sonra tükenir.",
  stockpileName: "Stratejik Stok",
  stockpileTag: "Rampada ikinci silah",
  stockpileRole:
    "Her dünyanın hazır tutabileceği Ölüm Yıldızı sayısını birden ikiye çıkarır; ikinci silah, birincinin üretimi bittikten sonra başlar.",
  stockpileDetail:
    "Ölüm Yıldızı stok sınırını komutan genelinde değil, sahip olduğun her dünya için birden ikiye çıkarır. İkinci silah da tam bedelini ve tam yapım süresini ister; sıraya alınabilir ama birinciyle aynı anda üretilmez. Atış yine silahı tüketir.",
} as const;
