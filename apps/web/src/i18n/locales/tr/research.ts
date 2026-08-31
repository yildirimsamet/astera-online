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
    "Belirli gemi sınıflarının saldırı gücünü ve gövde dayanımını birlikte artırır. Rakipler bu seviyeleri sonda raporlarından öğrenebilir.",
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
  denseTag: "Koşucuyu açar",
  denseRole:
    "Keşfetmek için bir akında ambarını doldur; hedefte ganimet kalsın. Koşucu, Şilep’ten hızlıdır ama daha az taşır.",
  denseDetail:
    "Tamamlandığında sahip olduğun bütün dünyalarda Koşucu yapımını kalıcı olarak açar. Hızlı akın filon, yavaş Şilebi beklemeden ganimet taşıyabilir.",
  graviticName: "Gravitik Yükler",
  graviticTag: "Delici’yi açar",
  graviticRole:
    "Açmak için savunması ve aktif Aegis’i olan bir dünyaya saldır; kalkan hasarın en az {{share}}’ini emsin. Bir Atmaca bile yeter; kazanman gerekmez. Delici kalkana beş kat vurur.",
  graviticDetail:
    "Tamamlandığında Delici yapımını bütün dünyalarında kalıcı olarak açar. Delici aktif Aegis’e karşı uzman cevaptır; genel saldırı yükseltmesi değildir.",
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

  waspDoctrineName: "Atmaca Doktrini",
  lanceDoctrineName: "Mızrak/Delici Doktrini",
  bulwarkDoctrineName: "Siper Doktrini",
  groundDoctrineName: "Tabya/Kirpi Doktrini",
  generalName: "Silah ve Zırh",
  generalTag: "Sahip olduğun her gövdeyi geliştirir",
  doctrineTag: "Daha iyi saldırı ve zırh",
  doctrineRole:
    "Her kademe ilgili sınıfın saldırı gücünü ve gövde dayanımını birlikte artırır. Sınıf doktrini ile Silah ve Zırh araştırmasının toplam savaş gücü katkısı en fazla %25’tir; doğal sınıf üstünlükleri değişmez.",
  waspDoctrineDetail:
    "Elindeki gemiler dâhil bütün Atmacaların saldırı gücünü ve gövde dayanımını artırır. Saldıran filo kalkış anındaki, savunan taraf ise çatışma anındaki araştırma kademesini kullanır.",
  lanceDoctrineDetail:
    "Elindeki gemiler dâhil bütün Mızrak ve Delicilerin saldırı gücünü ve gövde dayanımını artırır; sınıfların doğal güçlü ve zayıf eşleşmelerini değiştirmez. Saldıran filo kalkış anındaki, savunan taraf çatışma anındaki araştırma kademesini kullanır.",
  bulwarkDoctrineDetail:
    "Bütün Siperlerini güçlendirir ama yavaş uçuşunu değiştirmez. Saldıran filo kalkış anındaki, savunan taraf çatışma anındaki araştırma kademesini kullanır.",
  groundDoctrineDetail:
    "Bütün dünyalarındaki Tabya ve Kirpileri güçlendirir. Yer kapasitesi ve enkazdan geri kurulum kuralı değişmez; savunmada çatışma anındaki kademe kullanılır.",
  generalDetail:
    "Bütün gemi ve yer savunmalarının gövde dayanımını, saldırı değeri olanların da saldırı gücünü artırır; destek gemilerinin yalnız dayanımı yükselir. Sınıf doktriniyle birleşir ve ikisinin eşit maliyetli savaş gücüne toplam katkısı %25’i aşmaz. Saldıran filo kalkış, savunan taraf çatışma anındaki kademeyi kullanır.",

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
