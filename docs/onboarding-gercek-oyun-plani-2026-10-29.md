# Astera Online: gerçek oyunda rehberli onboarding planı

Tarih: 29 Ekim 2026  
Durum: Araştırma, konuşmada netleşen kararlar ve uygulama planı. Oyun koduna uygulanmış özellik değildir.

## 1. Amacımız ve onboarding'e bakışımız

Oyuncu kendi hesabı, ana gezegeni ve gerçek galaksiyle başlayacak. Rehber, başlangıç hazırlıklarını oyuncuya yaptıracak; gerekli bilgiyi kullanılacağı yerde açıklayacak ve giderek geri çekilecek. Yapılan geliştirmeler ve üretimler gerçek hesaptaki ilerleme olacak.

İlk deneyimde oyuncunun şu soruları cevaplayabilmesini istiyoruz:

- Neye sahibim, kendi gezegenime nasıl dönerim?
- Elimde hangi kaynaklar var? Üretim, Havuz ve Depo nasıl ilişkilidir?
- Bir yapının etkisini, bedelini ve süresini nereden görürüm?
- Geliştirmeyi veya gemi üretimini nasıl başlatıp takip ederim?
- Haritada nasıl gezinirim? Gördüğüm bilgiler neden sınırlı olabilir?
- Yardımı nasıl kapatır, ihtiyaç duyduğumda yeniden açarım?
- Oyunu kapatırsam ne devam eder, döndüğümde neyi kontrol edebilirim?

Onboarding'in bitişi, oyuncunun bütün konuşmaları görmesine veya bütün sistemleri öğrenmesine bağlı olmayacak. Başarı, temel ekranları ve işlemleri anlayıp yardımsız kullanabilmesiyle değerlendirilecek.

Astera'nın asıl oyunu bilgi, belirsizlik, fırsat ve oyuncular arasındaki etkileşimdir. Başlangıçta yaptırdığımız ekonomik hazırlıklar bu oyuna giriş sağlar. Oyunu yalnızca bina geliştirip kaynak toplamak olarak tanıtmamalıyız. Bununla birlikte, ana döngüyü ilk oturuma zorunlu bir saldırı olarak sıkıştırmayacağız.

## 2. Araştırmadan ne öğrendik, nasıl kullanacağız?

| Bulgu veya kaynak yaklaşımı | Astera'daki karşılığı | Çıkarmayacağımız sonuç |
| --- | --- | --- |
| Andersen vd. deneyinde tutorial yararı oyun karmaşıklığına göre değişiyor. Karmaşık Foldit'te bağlamsal yardım yararlı; geri dönüşte anlamlı artış gösterilmiyor. | Gerekli açıklamaları kaldırmak yerine ihtiyaç anına yerleştireceğiz. | Her tutorial retention artırır veya daha uzun oynama öğrenmeyi kanıtlar demeyeceğiz. |
| Apple kısa, bağlamsal dersleri ve erken bağımsız oyunu öneriyor. | Küçük bir başlangıç akışı, ardından ihtiyaç anında yardım kullanacağız. | Bütün özellikleri ilk oturumda tanıtmayacağız. |
| George Fan'ın geliştirme deneyimi, mekanikleri zamana yaymayı ve uygulamayla öğretmeyi destekliyor. | Bir yükseltme ve bir üretim üzerinden temel etkileşimi öğreteceğiz. | Her bina için aynı tıklamaları tekrarlatmayacağız; sabit bir kelime sınırını bilimsel kural saymayacağız. |
| Xbox rehberi hedefe, talimatlara ve yardıma tekrar erişimi vurguluyor. | Oyuncu yakın amacını görebilecek; rehber kapatılabilir ve yeniden açılabilir olacak. | Anlamı yalnız el işaretine, renge veya sese bırakmayacağız. |
| Küçük ölçekli CHI PLAY çalışması, ilk deneyimdeki zorunlu pasif bekleyişe ilişkin somut sorun gösteriyor. | Sipariş kabul edilince öğretime devam edeceğiz; sayaç bitişini zorunlu tutmayacağız. | Asenkron oyundaki bütün beklemeleri kaldırmayacağız. |
| Portal geliştirme deneyimi, ilk kez oynayanları gözlemlemenin öğretim sorunlarını açığa çıkardığını gösteriyor. | Testleri, gerçek yeni oyuncu gözlemleriyle tamamlayacağız. | Birinin talimatları takip edebilmesini, oyunu anladığına eşitlemeyeceğiz. |

Bu kaynaklar yaklaşımımıza dayanak oluşturur. Astera'daki akışın başarısı ve süresi ayrıca ölçülecek. Evrensel, kanıtlanmış bir ideal onboarding dakikası yoktur.

Kaynaklar: [Andersen vd., CHI 2012](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/chi2012.pdf), [Apple](https://developer.apple.com/app-store/onboarding-for-games/), [George Fan, GDC 2012](https://media.gdcvault.com/gdc2012/slides/Design%20Track/Fan_George_How%20I%20Got.pdf), [Xbox XAG 109](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109), [Petersen vd., 2017](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf), [Kim Swift: Portal](https://www.gamedeveloper.com/design/thinking-with-portals-creating-valve-s-new-ip).

## 3. Netleşen kararlar ve önerinin sınırları

Konuşmada netleşenler:

1. Ana onboarding deneyimi gerçek oyunda, rehber eşliğinde yaşanacak.
2. İlk akışta hedef seçme veya stratejik karar egzersizi olmayacak.
3. Oyuncuya başka bir oyuncuyu seçtirip saldırı yaptırılmayacak.
4. Saldırı, filo gönderimi veya sefer sonucu onboarding'in bitiş koşulu olmayacak.
5. Görsel örnekler ve uygulama, mevcut oyun arayüzünü ve varlıklarını kullanacak.
6. Oyuncunun önceden yaptığı işler tanınacak; aynı iş yeniden harcatılmayacak.

Bu belgedeki iki geliştirme ve bir Ok üretimi, inceleme için önerilen başlangıç senaryosudur. Süre hedefleri de test edilecek önerilerdir. Bu plan; başlangıç kaynaklarını, fiyatları, üretim sürelerini, koruma kurallarını, PvP'yi veya ilerleme dengesini değiştirme talimatı değildir.

Rehberin tamamlanmasına yeni kaynak veya gemi ödülü bağlamıyoruz. Atlayan ve tamamlayan oyuncular aynı oyun kurallarına tabi kalır. Yeniden yardım açmak, mevcut ilerlemeyi sıfırlamaz ve tekrar ödül üretmez.

## 4. Yapacaklarımız ve kaçınacaklarımız

| Yapacağız | Kaçınacağız |
| --- | --- |
| Oyuncunun sahip olduğu gerçek dünyayla başlayacağız. | Zorunlu ayrı bir eğitim dünyasından geçiş şartı koymayacağız. |
| Etki, maliyet ve süreyi işlemden önce göstereceğiz. | Sonucu belli olmayan veya açıklanmayan bir harcamaya yönlendirmeyeceğiz. |
| Bir seferde bir yakın amaç vereceğiz. | İlk dakikaya bütün bina, cihaz ve menüleri doldurmayacağız. |
| Başlatılan işin gerçek durumunu göstereceğiz. | Sipariş kabulünü işin tamamlanması gibi anlatmayacağız. |
| İlerlemeyi güncel oyun durumuyla değerlendireceğiz. | Yalnızca adım numarasına veya tıklama geçmişine güvenmeyeceğiz. |
| Gerçek galaksinin görülebilen bilgisini kullanacağız. | Eğitim için sahte hareket, hedef, savaş veya sonuç üretmeyeceğiz. |
| Yardımı azaltıp erişilebilir bırakacağız. | Oyuncunun bütün arayüzünü uzun süre kilitlemeyeceğiz. |
| Oyunun kendi süreçlerini geri dönüş sebebi yapacağız. | Sırf oyuncuyu bekletmek için yapay sayaç eklemeyeceğiz. |
| Gizli bilginin sınırlarını koruyacağız. | Rehber üzerinden keşfedilmemiş veya oyuncuya kapalı bilgiyi göstermeyeceğiz. |

Oyuncuya görünen bütün metinlerde [UX yazım standardı](ux-writing.md) uygulanır. Kilitli kimlik ve görünür bilgi kuralları korunur. Yeni bir rehber karakteri veya seslendirme ilk sürümün ön koşulu değildir.

## 5. Başlangıçtan bağımsız oyuna oyuncu senaryosu

### 5.1 Giriş ve hazırlık

Mevcut hesap oluşturma/giriş, gerekli onaylar ve galaksiye yerleşme işlemleri tamamlanır. Rehber, gerçek oyuncu ve ana gezegen verileri kullanılabilir olduğunda başlar. Galaksi doluysa veya yerleşme başarısızsa eğitim başlamış gibi gösterilmez.

Mevcut yerel Akademi yeni rehberin zorunlu ön koşulu olmayacak. Eski istemcilerin kayıt/claim akışlarıyla uyumluluk geçiş sırasında korunacak; mevcut Akademi ilerlemesi yeni gerçek oyun rehberinin ilerleme kaydı gibi yorumlanmayacak.

### 5.2 İlk rehberli bölüm

| Sıra | Gösterilecek yer ve rehber metni | Oyuncunun hareketi | İlerleme koşulu |
| --- | --- | --- | --- |
| 1. Sahiplik | Kamera kendi gezegenine yaklaşır. “Burası senin ana gezegenin. Kaynaklarını burada üretir, yapılarını geliştirir ve gemilerini hazırlarsın.” | Kendi gezegenine dokunur. | Kendi gezegeninin yönetim ekranı açılır. Zaten açıksa yeniden açtırılmaz. |
| 2. Kaynaklar | Kaynak göstergeleri vurgulanır. “Alaşım ve kristali yapılar ve gemiler için kullanırsın. Döteryum, uçuş yakıtıdır.” Sonraki kısa açıklama: “Bu sayılar, Depodaki harcanabilir kaynakların.” | Açıklamadan sonra Devam'a dokunur. | Açıklama görülüp geçilir. Kaynak göstergesine gereksiz tıklama eklenmez. |
| 3. Komuta Çekirdeği | Üretim sekmesinde ilgili kart vurgulanır. “Komuta Çekirdeği, Hangar dışındaki yapıların seviye sınırını belirler. Kartını açıp ilk yükseltmeye bakalım.” | Kartı açar; ayrıntıda bedeli ve süreyi görüp 2. seviye işlemini başlatır. | Sunucu siparişi kabul eder veya 2. seviye zaten vardır/sıradadır. |
| 4. Alaşım Rafinerisi | Karta dönülür. “Alaşım Rafinerisi bu gezegende alaşım üretir. Yükseltme tamamlanınca saatlik üretimin artar.” Gerçek mevcut ve sonraki üretim gösterilir. | Kartı açıp 2. seviye siparişini verir. | Sipariş kabul edilir veya ilgili yükseltme zaten yapılmıştır/sıradadır. Çekirdeğin tamamlanması bekletilmez. |
| 5. Kaynak toplama | Üst çubuktaki Havuz alanı vurgulanır. “Üretim önce Havuzda birikir. Harcayabilmek için kaynakları Depoya toplamalısın.” | Toplanabilir kaynak varsa Havuz alanına dokunur. | Sunucunun doğruladığı aktarım görülür. Boş Havuz veya yer yetersizliği akışı kilitlemez. |
| 6. İlk gemi | Gezegen menüsündeki Filo sekmesi, ardından Ok kartı gösterilir. “İlk geminin bedeli ve süresi burada. Üretim tamamlanınca gemin filona katılır.” | Ok üretim penceresini açar, 1 adet siparişi verir. | Sipariş kabul edilir; önceki üretim veya uygun mevcut sipariş de bu adımı karşılar. Geminin bitmesi beklenmez. |
| 7. Galaksi | Alt menüde Galaksi gösterilir. “Haritayı sürükleyerek çevrene bak.” Ardından: “Diğer gezegenler hakkında bütün bilgileri baştan göremezsin. İstihbarat araçların daha fazlasını öğrenmeni sağlar.” | Haritayı açıp hareket ettirir; kısa açıklamayı geçer. | Gezinme yapılır. Başka bir oyuncuya dokunma şartı yoktur. |
| 8. Kendi dünyasına dönüş | Alt menüde Üs gösterilir. “Kendi gezegenini yönetmek için Üs'e dön.” İşlerin güncel durumları gösterilir. | Üs'e döner ve “Kendim devam edeceğim” ile rehberliği kapatır. | Başlangıç tanıtımı tamamlanır. Ertelenmiş uygulamalı yardımlar ihtiyaç olduğunda erişilebilir kalır. |

**Gerçek arayüz ayrıntısı:** Mevcut bina kartı önce ayrıntı ekranını açar; yükseltme işlemi oradan yapılır. Doğrudan kart üzerinde var olmayan bir “Yükselt” düğmesi tarif edilmeyecek. Ok üretim penceresindeki mevcut işlem etiketi “1 tane yap”tır. Gezegen menüsündeki Filo sekmesiyle alt menüdeki genel Filo ekranı ayrı yerlerdir; işaret ve metin bunu karıştırmayacak.

Yalnız anlatım yapılan adımlarda Devam kullanılabilir. Açma, yükseltme, toplama ve sipariş verme adımlarında gerçek hareket ilerletir; araya ikinci bir Devam eklenmez. İşlem yapamayan oyuncuya açık bir geçme veya daha sonra sürdürme yolu sağlanır.

### 5.3 Sayaçlar ve ilk dönüş

Sipariş kabulü sonrasında kısa açıklama: “Kalan süreyi buradan takip edebilirsin. İşler sen oyunda değilken de devam eder.” Sıradaki iş için “Önündeki iş tamamlanınca başlar” kullanılır.

İlk dönüşte bütün eğitim yeniden başlamaz. Yalnız gerçekten gerçekleşmiş değişim anlatılır. Örneğin Rafineri tamamlandıysa: “Alaşım Rafinerin 2. seviyeye ulaştı. Saatlik üretimin {önceki değer} → {yeni değer} oldu.” Önceki değer güvenilir biçimde bilinmiyorsa karşılaştırma uydurulmaz; güncel üretim gösterilir.

Yarım kalan işlem varsa güncel durumu gösterilir. Toplanabilir kaynak varsa Havuz kısa biçimde hatırlatılabilir. Oyuncu hiçbir sipariş vermemişse verilmiş gibi davranılmaz.

### 5.4 Sonraki ihtiyaçlarda tanıtılacaklar

| Tetikleyici | Verilecek bilgi |
| --- | --- |
| Kristal Ocağı ilk açıldığında | Saatlik kristal üretimi ve kullanım amacı. Tekrar aynı yükseltme dersini zorunlu tutmadan. |
| Depo ilk açıldığında veya toplama kapasite nedeniyle engellendiğinde | Depolama kapasitesi, mevcut boş yer ve ilgili sınır. Depodaki bütün kaynakların korunduğu söylenmez. |
| Bilgi sekmesi ilk açıldığında | Antenin Teleskop ve Radar kurulumunu açtığı. Üç ayrı satın alma görevi eklenmez. |
| Teleskop/Radar ayrıntıları açıldığında | Her aracın kendi görevi, gereksinimi ve bilginin sınırı. Kurulmamış araç çalışıyormuş gibi gösterilmez. |
| Hangar veya doluluk engeli görüldüğünde | Gemilerin kullandığı alan, mevcut kapasite ve engelin gerçek nedeni. |
| Gemi araştırma koşuluna takıldığında | İlgili araştırmanın ve Tersane seviyesinin gerekliliği. Bütün araştırma ağacı anlatılmaz. |
| Oyuncu kendi isteğiyle gönderim/saldırı ekranını açtığında | Gerçek bedel, süre, ilgili koruma etkisi ve kayıp riski. Başlangıç rehberi bu eyleme bağlanmaz. |

Her ekran açılışında yeni bir balon gösterilmez. Kısa açıklamalar aynı ihtiyaç tekrarlandığında sürekli ortaya çıkmaz; ayrıntılar isteğe bağlı yardımdan açılabilir.

## 6. Rehberin ekrandaki davranışı

- Bir seferde bir kısa açıklama ve bir yakın amaç gösterilir. Metinler genellikle 1–2 cümledir.
- Balon, işaret ettiği kartı, maliyeti, süreyi veya işlem düğmesini kapatmaz. Ekranı karartan geniş bir perde kullanılmaz.
- Oyunun mevcut renkleri, yazı tipleri, kartları ve el görseli kullanılır. Gezegen, bina ve gemiler yeniden çizilmez.
- Geometri gerçek öğeden ölçülür. Sabit piksel konumları, örnek resimlerden uygulamaya taşınmaz.
- Menü animasyonu, kaydırma, üst çubuk yüksekliği ve yeni zamanlayıcı satırı yerleşimde hesaba katılır.
- Hedef görünmüyorsa önce doğru ekran açılır ve gerektiğinde bir kez görünür alana kaydırılır. Hedef henüz oluşmadıysa el gösterilmez.
- Başka ekrana geçilince yanlış yerde kalan balon ve el kaldırılır. Rehber duraklar; geri dönüldüğünde güncel duruma göre sürer.
- Dokunma hedefleri mobilde kullanılabilir olur. Metin ve butonlar 350px genişlikte kesilmez. Masaüstü yerleşimi ayrıca doğrulanır.
- Anlam yalnız renk, hareket veya görsel işarete bırakılmaz. Açık işlem adları ve erişilebilir etiketler kullanılır.
- Oyuncu atlayabilir, duraklatabilir ve yardımı yeniden açabilir. Oyun dünyası, sayaçlar ve gerçek uyarılar rehber açıkken çalışmayı sürdürür.

Görsel referanslar: [inceleme sayfası](../out/onboarding-review-2026-10-29/onboarding-ornekleri.html), [dört sahne](../out/onboarding-review-2026-10-29/overview.png). Bunlar gerçek bileşenlerin yerel örnek hesap verisiyle çizilmiş önizlemeleridir. `out/` çıktıları kalıcı dokümantasyon yerine geçmez; gerekirse uygulama öncesi tasarım arşivine alınır.

## 7. Önceden yapılmış işler ve engeller nasıl yönetilecek?

Üç bilgi ayrı değerlendirilecek:

1. **Rehber geçmişi:** Hangi açıklamalar görüldü, uygulamalı adımlar hangilerinde yapıldı, hangileri atlandı?
2. **Oyun durumu:** Hangi yapı, sipariş, gemi veya üretim geçmişi zaten var?
3. **İşlemin şu an yapılabilirliği:** Kaynak, sıra, kapasite, bağlantı ve ilgili oyun koşulları uygun mu?

Bir işlemin şu anda yapılamaması, oyuncunun onu hiç öğrenmediği anlamına gelmez. Bir yapının yüksek seviyede olması da oyuncunun açıklamayı mutlaka okuduğunu kanıtlamaz: Gerekirse kısa açıklama sunulur, fakat tekrar harcama yaptırılmaz.

| Durum | Beklenen davranış |
| --- | --- |
| Çekirdek/Rafineri hedef seviyeye ulaşmış | İlgili harcama adımı tamam sayılır; bir üst seviyeye yönlendirilmez. |
| Hedef seviye sırada veya geliştirme sürüyor | Mevcut sipariş tanınır. Yeni sipariş verilmez; tamamlanması beklenmez. |
| İlgili sipariş iptal edilmiş | Güncel durum değerlendirilir. Oyuncunun onayı olmadan yeniden sipariş verilmez. |
| Oyuncu kaynaklarını başka işe harcamış | Gerçek eksik gösterilir. Akışın başka bölümlerine geçilebilir; kaynak yaratılmaz. |
| İnşaat veya gemi sırası dolu | Dolu sıra açıklanır. Daha sonra sürdürme yolu vardır; iptal zorlanmaz. |
| Havuz boş veya oyuncu kaynakları az önce toplamış | Pasif bekletilmez. Önceki başarılı toplama biliniyorsa tanınır; aksi halde uygulama daha sonraya bırakılır. |
| Depoda yer yok veya yalnız kısmi aktarım yapılabiliyor | Gerçekte aktarılabilen miktar anlatılır. Tam aktarım şartı konmaz. |
| Gemi üretimi sırada veya daha önce yapılmış | İlgili adım için tekrar üretim istenmez. |
| Gemi görevde, onarımda veya kaybedilmiş | Yalnız evdeki mevcut gemi sayısına bakılmaz; doğrulanabilir üretim geçmişi değerlendirilir. |
| Oyuncunun gemisi var ama üretim geçmişi yok | İlk gemi için zorunlu harcama istenmez; üretim ekranı gerektiğinde açıklanır. Gemi sahibi olmakla üretimi öğrenmiş olmak ayrı tutulur. |
| Ekran/sekme zaten açık | Kapatıp yeniden açtırılmaz. |
| Oyuncu başka gezegen veya koloniye geçmiş | Başlangıç rehberinin ana gezegen bağlamı korunur; yanlış dünyada işlem yaptırılmaz. |
| Yenileme, çıkış, başka cihaz veya ikinci sekme | Kalıcı rehber kaydı ve güncel sunucu durumu birlikte değerlendirilir. Eski ekran görüntüsüne göre harcama istenmez. |
| İstek hata vermiş veya sonucu belirsiz | Başarı varsayılmaz. Sonuç güncel sipariş/durum üzerinden kontrol edilmeden aynı işlem tekrar gönderilmez. |
| Oyun verisi henüz yüklenmemiş | Boş veriye “0” muamelesi yapılmaz; adım başarısız veya tamamlandı sayılmaz. |
| Gezegen çevresinde başka oyuncu yok | Harita adımı normal ilerler; hedef üretilmez. |
| Sezon veya aktif yerleşim değişmiş | Önce rehberin bağlamı yenilenir. Geçersiz gezegen kimliğiyle işaret veya mutasyon yapılmaz. |

Kayıt için yerel depolama tek otorite olmayacak. Hesabın gördüğü rehber sürümü ve atlama/tamamlama bilgisi kalıcı tutulacak. Anlık balon konumu veya açık pencere gibi sunum ayrıntıları kalıcı oyun durumu sayılmayacak. Depolama kapalı veya bozuksa oyun kullanılabilir kalacak.

Tamamlanmış öğrenme adımları sırf oyundaki koşullar değişti diye geri alınmayacak. Atlanan/ertelenen adımlar ise yapılmış gibi işaretlenmeyecek. Başlangıç turunu bitirmek, isteğe bağlı yardımların hepsini tüketmek anlamına gelmeyecek.

## 8. Mevcut koddan doğrulanan uygulama dayanakları

Bu bölüm 29 Ekim 2026 tarihindeki hedefli incelemeyi özetler; uygulama başlamadan ilgili kod yeniden kontrol edilir. Eski tasarım dokümanları mekaniklerin kesin kaynağı değildir.

- `App.tsx` mevcut Akademi girişini ve gerçek `GameShell`/`GalaxyView` ağacını içeriyor. Yeni rehber gerçek oyun ağacına bağlanacak.
- `PlanetScreen.tsx` kart, ayrıntı, üretim penceresi ve sekmeleri zaten içeriyor. Yeni bir paralel gezegen arayüzü yapılmayacak.
- `GameShell.tsx`, `HudTop.tsx` ve `WorksLine.tsx` gerçek gezinme, kaynaklar ve Havuz etkileşiminin mevcut yüzeyleri.
- İnşaat sırası önceki siparişlerin sonucunu hesaba katıyor. Çekirdek sıradayken Rafinerinin onun arkasına konabilmesi `build-queue.test.ts` içinde kapsanıyor.
- Yükseltme uçlarında hedef seviye doğrulama desteği var. Eski ekrandan yanlış bir sonraki seviyeyi harcatmamak için bu mevcut sözleşme değerlendirilecek.
- Sunucuda `builtEver` bulunuyor; bunun oyuncuya açık gerekli dar kanıtının mevcut API'de yeterli olup olmadığı doğrulanacak. Gemilerin güncel konumu üretim geçmişinin yerine geçmeyecek.
- `academyStep`, mevcut Akademi/claim başlangıcıyla ilişkili. Yeni gerçek rehberin tamamlanma alanı gibi kullanılmayacak.
- `academyFetch` ve `academyStorage` özel yerel eğitim dünyasına ait. Gerçek oyun rehberi kaynak, filo veya savaş durumu üretmek için bunları kullanmayacak.

## 9. Uygulama sırası

### Aşama 1 — Mevcut akışı ve başlangıç durumunu kesinleştir

Kayıt → yerleşme → gerçek oyun açılışı zinciri çıkarılır. Yeni hesap, mevcut hesap, Akademiden geçmiş hesap ve rehberi atlayan hesap ayrı incelenir. Başlangıç kaynakları, bina seviyeleri, boş filo, üretim süreleri ve gerçek işlem etiketleri kod/testlerden doğrulanır.

**Çıktı:** Adımların gerektirdiği veriler, gerçek UI hedefleri, mevcut yeniden kullanılabilir parçalar ve dokunulacak dosyalar. Yeni kaynak/başlangıç paketi önerilmez.

### Aşama 2 — Adım koşullarını ve testleri önce yaz

Her adımın ön koşulu, mevcut durumdan karşılanması, başarı kanıtı, engellenme ve erteleme davranışı tanımlanır. Yukarıdaki durum tablosu test vakalarına çevrilir. Önce ilgili testlerin başarısız olduğu görülür; sonra en küçük uygulama yapılır.

**Çıktı:** Arayüzden bağımsız, sınanabilir ilerleme kuralları. Dev bir genel görev sistemi kurulmaz.

### Aşama 3 — Kalıcı kayıt ve gerçek işlemlerle bağlantıyı kur

Rehber sürümü, görülen/ertelenen adımlar ve atlama/tamamlama durumu için küçük bir sözleşme kurulur. Gerekli API sınırları Zod ile doğrulanır; kayıt doğru hesaba aittir. Eski kayıtlar tanımlı biçimde ele alınır. Yerel kopya sunucu oyun durumunu geçersiz kılamaz.

Rehber otomatik alışveriş yapmaz; normal işlem, oyuncunun gerçek düğmeye dokunmasıyla gönderilir. Aynı isteğin tekrarı, çift dokunma ve yanıt kaybı kontrol edilir. Hedef seviye değişmişse otomatik olarak sonraki seviyeye yükseltilmez. İkinci sekmeden değişen durum, rehberde yeniden değerlendirilir.

**Çıktı:** Yenileme ve cihaz değişiminde sürdürülebilen kayıt; yeniden oynatma veya yeniden açmada ek harcama/ödül oluşturmayan davranış.

### Aşama 4 — Küçük bir görsel parçayla doğrula

Önce gezegeni açma ve Komuta Çekirdeği adımları gerçek ekranda çalıştırılır. Balon, el, ekran ölçümü, kaydırma, kapatma ve yeniden açma doğrulanır. Kartı açma ile ayrıntıdaki harcama işlemi ayrı hedefler olarak ele alınır.

**Çıktı:** 350px mobil, 390px mobil ve masaüstünde gerçek ekran kanıtı. Bu parça düzgün çalışmadan bütün adımlar eklenmez.

### Aşama 5 — Başlangıç akışını ve bağlamsal yardımları tamamla

Rafineri, Havuz, ilk gemi, harita ve Üs'e dönüş eklenir. Ekran dışına çıkma, önceden yapılmış işler ve erteleme davranışları her adımla birlikte uygulanır. İlk dönüş hatırlatması mevcut dönüş deneyimiyle çakışmayacak biçimde bağlanır.

İlk sürümde bütün cihazlar için zorunlu ders yazılmaz. İlgili ekranın mevcut yardımını kullanmak yeterliyse yeni balon eklenmez. Türkçe ve İngilizce metinler hazırlanır; diğer desteklenen dillerin anahtar ve geri dönüş davranışı kontrol edilir.

### Aşama 6 — Giriş geçişini ve eski hesapları ele al

Yeni oyuncunun ana yolu gerçek oyun rehberine gider. Eski istemcilerin claim davranışları, yarım kalan Akademi ve mevcut hesaplar için regresyon testleri çalıştırılır. Tamamlamış/atlamış oyuncuya her girişte eğitim açılmaz; yardım menüden erişilir. Sezon değişimi tek başına hesabın bütün öğrenme geçmişini sıfırlamaz.

Girişteki tanıtımlar, yardım ve Wiki metinleri bu yeni yol ile tutarlı hale getirilir. İkinci, rakip bir zorunlu onboarding yolu bırakılmaz. Konuyla ilgisiz kod temizliği yapılmaz.

### Aşama 7 — Ölçüm, oyuncu gözlemi ve gerekli düzeltmeler

Mevcut ölçüm altyapısı kullanılır; yeni analitik hizmet ilk koşul yapılmaz. Aşağıdaki kilometre taşları ve erteleme nedenleri izlenir. Ölçüm çalışmıyorsa oyun ve rehber çalışmaya devam eder.

Oyunu ilk kez gören kişiler yönlendirme yapılmadan gözlemlenir. Karşılaştırmalı test yapılacaksa tek bir hipotez seçilir ve atanan bütün yeni oyuncular hesaba katılır. Sadece eğitimi bitirenler üzerinden başarı açıklanmaz.

**Çıktı:** Anlaşılamayan metinler, gereksiz adımlar ve tıkanmalar için somut düzeltme listesi. Süre, tıklama ve geri dönüş birlikte değerlendirilir.

## 10. Doğrulama ve kabul ölçütleri

Uygulama TDD ile ilerler: gereksinim/durumlar → test → FAIL → uygulama → PASS → kod incelemesi → ilgili regresyonlar. Sadece tasarım değişikliklerinde görsel doğrulama yapılır.

| Kontrol alanı | Gerekli kapsama örnekleri |
| --- | --- |
| İlerleme | Taze hesap, önceden yapılmış işlem, sıradaki iş, iptal, atlama, yeniden açma. |
| Gerçek işlemler | Doğru gezegen ve hedef seviye; gerçek maliyet; istek kabulü; hata ve yanıt kaybı; aynı isteğin tekrarı. |
| Eşzamanlılık | Çift dokunma, iki sekme, başka cihazdan yapılmış yükseltme veya toplama. |
| Kalıcılık | Yenileme, çıkış/giriş, bozuk/eksik yerel kayıt, eski rehber sürümü, sezon/yerleşim değişimi. |
| Sunum | Geç açılan pencere, kaydırılmış kart, görünmeyen hedef, üst çubuk yüksekliği değişimi, uzun ad/metin, doğru dil. |
| Ekonomi ve üretim | Boş Havuz, kısmi toplama, dolu Depo/sıra/Hangar, yetersiz kaynak, geminin evde olmaması. |
| Geçiş | Mevcut claim ve Akademi hesaplarının bozulmaması; yeni ödül veya başlangıç hibesi oluşmaması. |

Kabul için:

- Başlangıç rehberinde zorunlu hedef seçimi, saldırı veya gönderim bulunmaz.
- Önceden karşılanmış hiçbir hedef için ikinci kez harcama istenmez.
- Oyuncu boş Havuz, yetersiz kaynak veya dolu sıra yüzünden rehberde kilitli kalmaz.
- Rehber atlanınca oyun kullanılabilir; tekrar açılınca hesap sıfırlanmaz.
- İşlemin kabulü ve tamamlanması doğru ayrılır; önemli bedel işlemden önce görünür.
- Rehber, işaret ettiği işlemi kapatmaz veya yanlış ekranda görünmez.
- Yeni oyuncu kendi gezegenine dönebilir, siparişini bulabilir ve kaynak toplamayı açıklayabilir.
- Gerçek galaksinin bilgi sınırları ve mevcut oyun kuralları korunur.
- İlgili testler, tip kontrolü ve lint geçer; gerçek ekranlar `node tools/visual.mjs` üzerinden ilgili kapsamla doğrulanır. Gerekirse mevcut görsel araca dar bir senaryo eklenir.

Kontroller yerel PC kurallarına göre sıralı, tek workspace/tek test worker'ıyla ve testlerde `nice -n 10` kullanılarak çalıştırılır. Node heap 4 GiB'ı aşmaz. Bu iş için uzun ekonomi/sezon simülasyonu veya snowball çalışması başlatılmaz. Dokunulan alanlar genişse `pnpm verify` ile olağan genel doğrulama tamamlanır.

## 11. Süre ve başarıyı nasıl ölçeceğiz?

İlk rehberli bölüm için **4–6 dakika tasarım hedefidir; kanıtlanmış optimum değildir**. İlk oyun etkileşiminin, oynanabilir ekran hazır olduktan sonraki yaklaşık 10–30 saniyede gerçekleşmesi hedeflenir. Sayaçların tamamlanma süresi bu hedefe karıştırılmaz. Yükleme, hesap açma, aktif oynama ve arka planda kalma ayrı ölçülür.

İzlenecek başlıca olaylar: gerçek oyunun hazır olması, rehber başlangıcı, adımın gösterilmesi, önceden karşılanmış olması, işlemin kabulü, engellenme/erteleme nedeni, atlama, rehberi bitirme, yardımı yeniden açma ve ilk geri dönüş. Her olaya rehber sürümü ve ilgili adım eklenir; gizli oyun verileri taşınmaz. Yeniden çizimler aynı olayı tekrar tekrar üretmez.

Başarı değerlendirmesi:

1. **Anlama:** Oyuncu Depo/Havuz farkını ve başlattığı işin sonucunu açıklayabiliyor mu?
2. **Bağımsız kullanım:** Rehber olmadan Üs'e, siparişlerine ve üretim ekranına dönebiliyor mu? Bir ekranı açmak tek başına anladığını kanıtlamaz.
3. **Akış sağlığı:** Hangi adımda, hangi nedenle duruyor veya ayrılıyor? Atlayan oyuncular da değerlendirmeye dahil mi?
4. **Geri dönüş:** Ertesi gün ve yedinci gün geri dönüşü nasıl değişiyor? Bu değişim yalnız rehbere bağlanmadan, benzer oyuncu gruplarında inceleniyor mu?
5. **Doğal oyuna geçiş:** Oyuncu sonradan gerçek sistemleri kendi isteğiyle kullanıyor mu? İlk saldırı yapmak bir başarı şartı değildir.

İlk kullanıcı gözlemleri için küçük, uygulanabilir bir başlangıç grubu olarak yaklaşık beş yeni oyuncu önerilir. Bu sayı, retention hakkında istatistiksel sonuç çıkarmak için yeterli sayılmaz. Sayısal retention artışı veya evrensel tamamlanma yüzdesi önceden vaat edilmez.

## 12. İşe başlarken yapılacak ilk işler

1. Yeni hesabın mevcut giriş ve başlangıç durumunu kod/testlerden yeniden doğrula.
2. Sekiz adımın karşılanma, engellenme ve erteleme koşullarını yaz; testleri önce ekle.
3. Kalıcı rehber kaydının mevcut hesap/oyun sözleşmesine en küçük ekini belirle.
4. Gerçek ekranda gezegeni açma ve Çekirdek adımlarını çalıştır; mobilde oynayıp değerlendir.
5. Bu parça doğrulanınca kalan akışı, eski hesap geçişini ve ölçümü sırayla tamamla.

Başvuru: [araştırma raporu](../reports/Oyunlarda%20oyuncuyu%20tutan%20onboarding%20tasarımı.md), [mevcut onboarding incelemesi ve tarihçesi](review-onboarding.md), [çalışma kuralları](../CLAUDE.md). Tarihsel dokümanlarla çelişen ürün yönünde bu konuşmada netleşen gerçek oyun rehberi ve zorunlu PvP içermeyen başlangıç esas alınır; mekaniklerin doğruluğu çalışan kod ve testlerden kontrol edilir.
