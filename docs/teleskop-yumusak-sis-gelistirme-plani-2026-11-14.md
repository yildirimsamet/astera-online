# Teleskop görüşü ve yumuşak dış sis — geliştirme planı

**Tarih:** 14 Kasım 2026  
**Durum:** Uygulama öncesi plan. Özellik oyuna uygulanmadı; geçici lab, testleri ve deneme çıktıları temizlendi. Karar ve hesap referansı bu belgede korunuyor.  
**Görsel karar:** Owner'ın lab değerlendirmesi: **Yumuşak fade · %2,5 perde yoğunluğu · 38 birim geçiş genişliği.**

## 1. Amaç ve oyuncunun yaşayacağı deneyim

Oyuncu, haritaya ilk baktığında kendi görüşündeki uzayın açık, görüşünün dışındaki uzayın hafif sisli olduğunu anlayabilmeli. Gezegenlerin konumları ve siluetleri seçilebilmeli; galaksi boş veya terk edilmiş görünmemeli. Sis, canlı bilgiye erişimin sınırını anlatmalı.

Beklenen akış:

1. Oyuncu kendi dünyasının çevresini ve burada gerçekten görünür olan hareketi rahatça izler.
2. Uzak dünyaları ince bir sisin arkasında görür. Bu dünyalara dokunup mevcut keşif/sonda akışını kullanabilir.
3. Bir filo görüş sınırını geçtiğinde mevcut görünürlük kurallarına göre belirir, radar temasına dönüşür veya kaybolur. Sis bu sınırın nedenini görsel olarak açıklar.
4. Teleskop yükselince açık alan genişler. Yeni alanın canlı bilgisi mevcut sunucu akışıyla gelir.
5. Birden fazla dünyası varsa açık alanlar birlikte çalışır. Örtüşen alanın ortasında yeni bir sis perdesi veya iç duvar belirmez.

Sisin arkasındaki boşluğu doldurmak için sahte filo, sahte faaliyet veya kazanılmamış bilgi gösterilmeyecek. Galaksinin canlılığı, izin verilen gerçek hareketten ve mevcut ortam görsellerinden gelecek.

## 2. Karara bağlanan görünüm ve parametreler

| Konu | Uygulanacak davranış |
| --- | --- |
| Geçiş yöntemi | Yumuşak fade; kamera ile görüş sınırı arasında sürekli, yumuşak açılma |
| Perde yoğunluğu | `%2,5`; labdaki yoğunluk hesabına verilecek sayısal değer `0.025` |
| Geçiş genişliği | Tam `38` **oyun birimi**; piksel veya teleskop yarıçapının yüzdesi değil |
| Sisli bölge | Bütün geçerli görüş hacimlerinin dışındaki uzayın tamamı |
| Açık bölge | Geçerli görüş alanlarının birleşimi; kamera önündeki dış sis bu bölgedeki görünür nesneleri örtmez |
| Sınırın yönü | `R` yarıçapında iç bölge temiz; yumuşak geçiş `R → R + 38` aralığında dışarı doğru gerçekleşir |
| Teleskop görünümü | Gerçek oyunun `SensorRings` mavimsi küresi; mevcut renk, doku çizgileri ve açılış hissi temel alınır |
| Kameraya tepki | Açıklık gerçek kamera ışınlarından ve 3D görüş hacminden hesaplanır |
| Oyuncu ayarı | Labdaki karşılaştırma/yoğunluk kontrolleri oyun arayüzüne taşınmaz; mevcut teleskop göster/gizle kontrolü kullanılır |

### Sayıların anlamı ve ölçek

- `%2,5`, labdaki **yoğunluk parametresidir**. Ekranın her pikseline sabit `%2,5` saydamlık uygulanması veya son sis opaklığının `%2,5` ile sınırlandırılması anlamına gelmez. Labda sis, ışının dış hacimde katettiği mesafe ve yoğunluk dokusuyla hesaplanır; bu ilişki korunacak.
- Mevcut `VIEW.scale = 50` ve `VIEW.verticalExaggeration = 1` ile `38 / 50 = 0.76` Three.js sahne birimi eder. Konumlar `toWorld`, yarıçap ve genişlikler ortak ölçek üzerinden dönüştürülecek.
- Deneme arayüzü geçiş genişliğini yuvarlayarak gösteriyordu: `37,5` oyun birimi ekranda `38` görünüyordu. Bu plan, owner'ın söylediği **tam 38** değerini esas alır. Üretim referans çekimi tam değerle alınacak; fark gizlenmeyecek.
- `%2,5` için gerçek shader girdisi `0.025` olarak doğrulanacak; tam sayıya yuvarlanan bir etiket doğru ayar sayılmayacak.
- Parametreler tek bir sunum ayarında tanımlanacak. Oyun ve testler farklı sayıları kopyalayıp taşımayacak.

### Silinen denemeden hesap referansı

Bu bilgiler görünümü tekrar kurmak içindir; ayrı bir labı yeniden oluşturmak gerekmez:

- Ortak `radiationVolume.ts` üreticisinin 48³ tek kanallı yoğunluk dokusu kullanılıyordu; altı orta nokta örneği alınıyordu.
- Her örneğin yoğunluğu `0.22 + 0.78 × dokuDeğeri` idi. Alan dışı ve kameraya yakınlık maskeleri uygulanan örneklerin toplamı, dış yol uzunluğu / 6 ile çarpılarak `C` yoğunluk sütununa dönüştürülüyordu.
- Sis opaklığı `1 − exp(−C × yoğunluk × 0.065)` idi. Seçilen yoğunluk bu ifadede `0.025` olacak; yumuşak açıklık maskesi sonuçla çarpılacak.
- Sis rengi lineer RGB `(0.105, 0.15, 0.20)` idi. Doku dünya konumunda `0.045` ölçekle, zamanla `(0.002, −0.001, 0.001)` hızlarında kaydırılıyor; dikişleri önlemek için aynalanarak örnekleniyordu. Zaman 2000 saniyede sarılıyordu.
- Denemede yakın kamera maskesi `0.6 → 2.8`, dış hacim yoğunluk maskesi `R → R + 0.25` sahne birimindeydi. Bunlar, açıklığın **38 oyun birimlik** geçişinden ayrı yumuşatmalardır.
- Işın yolu denemede 60 sahne birimiyle sınırlandırılıyordu. Bu sınır üretimin geniş kamera/galaksi ölçeğine körü körüne taşınmayacak; uzaktaki dış sisin kaybolmadığı doğrulanacak.

## 3. Kapsam ve bilgi sınırları

Bu özellik, mevcut görüş kurallarının 3D sunumudur. Sunucu hangi nesne ve bilgiyi gönderiyorsa çizim onunla sınırlı kalacak.

| Durum | Sis ve bilgi davranışı |
| --- | --- |
| Canlı görüş / `RESOLVED` | Geçerli canlı bilgi gösterilir; canlı nesne üzerindeki kamera kaynaklı perde kaldırılır |
| Eski kayıt / `REMEMBERED` | Dünya dış sis içinde kalır; mevcut donmuş kayıt ve kayıt yaşı gösterilir |
| Bilinmeyen / `UNKNOWN` | İzin verilen konum ve siluet bulunabilir; güncel sahip, seviye veya faaliyet üretilmez |
| Radar / `CONTACT` | Mevcut anonim temas okunabilir kalır; radar teleskop gibi alanı açmaz ve teması gerçek filo olarak çözmez |
| Oyuncunun kendi araçları ve kamusal olaylar | Mevcut özel görünürlük hakları korunur; yeni efekt bunları yanlışlıkla görünmez kılmaz |
| Asteroidler | Yalnız mevcut keşif ve görünürlük projeksiyonunun izin verdiği nesneler çizilir; sis kaldırılarak yenileri keşfedilmiş sayılmaz |

Özellikle dikkat edilecekler:

- Görüşün kaynağı `sensors` içindeki yetkili alanlardır. Seviye → yarıçap dönüşümü yeniden yazılmayacak; `sensorSphere` / başlangıçta `vesselSphere` akışı esas alınacak.
- Canlı kapsama hesabında `identify` kullanılır. `detect` radar yarıçapıdır; canlı açıklık oluşturmaz. Teleskop almamış oyuncunun mevcut çıplak göz alanı da geçerli açıklıktır.
- Teleskop yuvasıyla uzaktan izleme ve sonda kaydı, yeni bir mekânsal görüş küresi oluşturmaz.
- Sonda verisi, gerçek oyunda raporun teslim edildiği mevcut anda kullanılabilir olur. Labdaki basitleştirilmiş varışta kayıt alma davranışı oyun kuralı olarak taşınmayacak.
- Görüş dışındaki level-up, yeni uydu, sahip değişimi ve filo hareketi; animasyon, ışık, etiket veya yan efekt üzerinden sızmayacak.
- Sisi veya mavi küreyi kapatmak veri erişimi kazandırmayacak. Erişim sınırı API projeksiyonunda kalacak.

Bu çalışma menzil tablosu, radar kademesi, sonda teslim zamanı, PvP dengesi veya ekonomi değişikliği içermez. Bunları gerektiren yeni bir ihtiyaç bulunursa ayrı ürün kararı olarak ele alınır.

## 4. Mevcut koddan çıkan entegrasyon noktaları

| Kaynak | Bulgu ve planlanan kullanım |
| --- | --- |
| `apps/web/src/screens/GalaxyView.tsx` | Mevcut `sensors` verisi ve teleskop görünürlük tercihi buradan gelir |
| `apps/web/src/galaxy/GalaxyCanvas.tsx` | Gerçek sahne, sensör küreleri, kamera, başlangıç hazırlığı ve GPU bağlam yaşam döngüsü |
| `apps/web/src/galaxy/GalaxyPostprocessing.tsx` | Mevcut ortak efekt zinciri: `Bloom` ve `Vignette`. Sis bunun içine entegre edilecek |
| `apps/web/src/galaxy/SensorRings.tsx` | Gerçek mavi küre. Birden fazla alanın içte kalan yüzeyleri için birleşim maskesi burada ele alınacak |
| `apps/web/src/galaxy/PlanetField.tsx` | Canlı ve canlı olmayan dünyaların mevcut parlaklık/renk ayrımı. Sis eklendikten sonra okunabilirliği karşılaştırılacak |
| `packages/rules/src/sight.ts`, `packages/rules/src/view.ts` | Görüş geometrisi ve ortak koordinat dönüşümü; yeni bir görüş motoru kurulmayacak |
| `apps/web/src/lib/quality.ts`, `apps/web/src/galaxy/SceneWarmup.tsx` | Kalite profilleri, hazırlık ve yeniden çizim düzenine uyum |

`SensorRings.tsx` içindeki eski açıklama `SensorFocus` adlı bir katmandan söz ediyor; aktif kaynakta böyle bir katman yok. Var olan dünya karartması ise `PlanetField` içinde çalışıyor. Plan bu ikisini birbirine karıştırmayacak.

Geçici prototip ve ona özel testler kaldırıldı. Yeni efekt mevcut üretim zincirinde geliştirilecek; doğrulama mevcut görsel kontrol aracına hedefli bir senaryo eklenerek yapılacak. Prototipin özel render döngüsü veya deneme simülasyonu üretim bağımlılığı olmayacak.

`docs/visual-design.md` önceki yoğun gri sis denemesinin reddini kaydediyor. Yeni referans owner'ın bu tarihte seçtiği çok hafif ayardır; eski görsel denemenin yorumları uygulama sırasında buna göre güncellenecek. Haritanın bulunabilirliği ve bilgi gizliliği ilkeleri geçerli kalır.

## 5. Birden fazla gezegen: birleşme, kesişme ve ayrılma

**Temel kural:** Oyuncunun toplam canlı görüşü, sunucunun gönderdiği bütün geçerli `identify` hacimlerinin **birleşimidir**. Bir noktanın herhangi bir alanda olması yeterlidir. Aktif gezegen seçimi, bu birleşimin yerine geçmez.

Bir nokta için her merkeze uzaklıktan o alanın yarıçapı çıkarılır. Bu değerlerden en küçüğü sıfır veya negatifse nokta en az bir alanın içindedir. Sis hesabında bütün alanlar tek bir açıklık oluşturur; her gezegen için ayrı sis katmanı çizilip üst üste eklenmez.

| Yerleşim / olay | Beklenen sonuç |
| --- | --- |
| İki alan birbirinden uzak | İki ayrı açık hacim; aradaki gerçek boşluk sisli |
| Alanlar kısmen kesişiyor | Kesintisiz açık hacim; kesişimde sis, koyu şerit veya fazladan bulanıklık yok |
| Alanlar yalnız teğet | Gerçek geometrik temas korunur; titreşim veya yapay geniş bir koridor oluşmaz |
| Bir alan diğerinin tamamen içinde | Büyük alanın açıklığı geçerli; iç küre sis sınırı gibi görünmez |
| Merkez ve yarıçapları aynı | Açıklık ve mavi yüzeyler iki kez birikmez |
| Üç veya dört alan zincir gibi örtüşüyor | Ortak hacim açık; gerçekte kapsanmayan aralıklar ve boşluklar sisli |
| Alanlar yalnız ekran görüntüsünde üst üste | Perspektif çakışması gerçek 3D birleşme sayılmaz; aradaki derinlikteki nesne kendi konumuna göre değerlendirilir |
| Bir koloninin teleskobu gelişiyor | Yalnız ilgili yarıçap güncellenir; birleşim yeniden hesaplanır, diğer alanlar korunur |
| Gezegen kaybediliyor / kaynak kaldırılıyor | O alan birleşimden çıkar; başka bir kaynak hâlâ kapsıyorsa bölge açık kalır |
| Aktif gezegen değişiyor | Kamera ve seçim değişebilir; toplam kapsama kaybolmaz veya sırayla açılıp kapanmaz |
| Teleskop küresi gizleniyor | Mavi sınır çizimi gizlenir; toplam görüş ve dış sisin açıklığı aynı kaynakları kullanmayı sürdürür |

### Kesişimlerde mavi kürenin davranışı

Gerçek `SensorRings` görünümü korunacak; birleşimin içinde kalan kabuk parçalarının görünürlüğü maskelenecek. Böylece A alanından B alanına geçerken ortada ikinci bir mavi duvar görülmeyecek. Dışarıdan görülen sınır, birleşimin dış yüzeyidir; ayrı alanlar ayrı küreler olarak okunur.

Tam çakışan yüzeyler kararlı kaynak kimliğiyle bir kez çizilecek. Bu, yeni bir birleşik 3D model üretmeyi veya her karede geometri birleştirmeyi gerektirmeyecek. Kesme maskesi mevcut küre shader'ına uygulanacak; renk ve çizgi karakteri yeniden tasarlanmayacak.

### Kamera ışını üzerindeki birleşim

Bir kamera ışını birden fazla açık hacme girip çıkabilir. Işın–küre giriş/çıkış aralıkları bulunacak; çakışan aralıklar birleştirilip toplam yoldan **bir kez** çıkarılacak. A ve B'nin kesişimi iki kez düşülmeyecek. Ayrı iki hacmin arasındaki dış mesafe ise sis hesabına dahil edilecek.

Geçiş genişliği bütün alanlarda 38 oyun birimidir. İki geçiş bandının yakınlaşması gerçek görüş menzilini artırmaz; filoların görünürlük anı her zaman asıl `identify` sınırında kalır.

## 6. Çizim yaklaşımı

### 6.1. Tek sahne ve ortak efekt zinciri

Önerilen yol, bölüm 2'de kaydedilen derinlik tabanlı tek sis hesabını üretimin mevcut `EffectComposer` zincirine entegre etmektir. Derinlik dokusu, ekrandaki görünen yüzeyin kameraya uzaklığını verir; sis bu uzaklığı ve kamera ışınını kullanarak 3D konumu hesaplar.

- Sahne ikinci kez tam olarak çizilmeyecek; ikinci bir composer kurulmayacak.
- Mevcut renk/derinlik kaynakları paylaşılacak. Sis için ayrıca normal dokusu üretilmeyecek.
- Sis, dünya renginin bir parçası olarak bloom/vignette öncesine yerleştirilecek; son renk dönüşümü ortak çıkışta bir kez yapılacak.
- Bloom ve mavi küreyle birlikte seçilen görünüm gerçek sahnede değerlendirilecek. Zincirin geçişleri birleştirmesi derinlik okumasının sırasını değiştiriyorsa ayrı, sırası belirli bir sis geçişi kullanılacak; sıra açık bir testle tutulacak.
- Üretimde A/B modu ve dither fade dalı taşınmayacak. Mevcut son çıktı dithering'i ise karanlık renklerde bantlaşmayı önleyen ayrı bir işlemdir; yumuşak fade seçimi onu kaldırmayı gerektirmez.

### 6.2. Sis ve kameraya göre açılma

1. Her piksel için kamera ışını ve varsa görünen yüzeyin dünya konumu hesaplanır.
2. Işının bütün geçerli görüş hacimleriyle kesişimleri bulunur.
3. Canlı hacimlerin dışında kalan yolda ortak yoğunluk dokusu örneklenir. Dış uzayda, gezegen bulunmayan piksellerde de sis vardır.
4. Gerçekten canlı hacimdeki yüzey üzerinde ön perde açılır. Alan dışındaki bir gezegenin yalnız ekranda kürenin arkasına denk gelmesi onu canlı yapmaz.
5. Boş gökyüzünde açıklık kamera ışınının hacme bakışına göre hesaplanır. Kamera içerideyken dış sis çıkıştan sonra başlar; bütün galaksi koşulsuz temizlenmez.
6. 38 birimlik dış bantta sürekli yumuşak geçiş uygulanır.

Sis şekli dünya koordinatlarına bağlı kalacak. Kamera döndüğünde lensin üzerine yapışmış leke veya düz perde hissi oluşmayacak. Mevcut 48³ tek kanallı yoğunluk dokusu ve az sayıda hacim örneği başlangıç çözümüdür. Kalın volumetrik bulut sistemi, ışık saçılımı veya hacim gölgesi eklenmeyecek.

### 6.3. Şeffaf nesneler ve mevcut efektlerle etkileşim

Derinlik dokusu her şeffaf parçanın konumunu içermez. Özellikle gemi parlamaları, egzoz, radar ve mavi küre için yalnız arka plan derinliğine bakmak hatalı sis üretebilir.

- Önce gerçek malzemelerle, gezegen önü/arkası ve boş gökyüzü üzerinde doğrulama yapılacak. Dolu gemi gövdelerinin yazdığı derinlik ile ışık/egzoz katmanları ayrı değerlendirilecek.
- Hata çıkan şeffaf efektte gerçek nesne konumundan aynı birleşim maskesi kullanılacak; bütün şeffaf çizim sistemi topluca yeniden yazılmayacak.
- Teleskop içi gemi ve egzoz sis yüzünden silinmeyecek; bir gezegenin arkasındaki gemi sis düzeltmesi uğruna gezegenin önüne çıkarılmayacak.
- Gezegen seçimi, mevcut radar temasları, kayıt yaşı ve dokunma hedefleri okunabilir kalacak.
- Mevcut uzaklık sisi, radyasyon ve dünya karartması birlikte karşılaştırılacak. Yeni sisin üstüne gereksiz karartma eklenmeyecek; radyasyon gibi ayrı anlam taşıyan efekt silinmeyecek.

## 7. Performans ve yaşam döngüsü

**%2,5 yoğunluk düşük maliyet garantisi değildir.** Yoğunluk görüntüyü hafifletir; ekran çözünürlüğü, örnek sayısı ve hedef sayısı GPU maliyetini belirler. Önce aynı sahnede sis kapalı/açık ölçümü alınacak.

- Birleşim bütün alanları tek sis hesabında işler. Gezegen sayısıyla tam ekran sis geçişi sayısı artmaz.
- Labdaki altı hacim örneği başlangıç noktasıdır. Örnek azaltma veya yarım çözünürlük ancak ölçülen ihtiyaç varsa ve seçilen görünüm korunuyorsa denenir.
- `38 birim`, `%2,5` ve görüş geometrisi kalite seviyesine göre değişmez. Mevcut `high / balanced / low` çözünürlük ve MSAA sınırlarına uyulur; sürükleme sırasında geçici DPR düşürülmez.
- Yoğunluk dokusu bir kez hazırlanır. Kamera hareketinde, gezegen seçiminde ve her karede render hedefi, doku, materyal veya yeni alan dizisi oluşturulmaz.
- Mevcut `frameloop="demand"` düzeni korunur. Sisin hafif hareketi mevcut sahne saatini ve yeniden çizim düzenini kullanır; görünmeyen/arka plandaki harita için bağımsız sürekli döngü açılmaz.
- İlk sahne hazırlığında shader da hazırlanır. Kalite değişimi, ekran yönü/boyutu değişimi ve GPU bağlamının kaybı/geri gelişi mevcut yaşam döngüsüne uyar; kaynaklar temizlenir.
- Henüz gelmemiş sensör verisi ile gerçekten boş alan listesi ayrılır. İlk açılışta tüm haritayı kısa süreli açık gösteren veya yanlış sisle örten bir kare üretilmez. Yeni veriye geçiş sahneyle aynı güncellemede yapılır.
- Küre büyümesinin görsel animasyonu bilgi erişimini geciktirmez veya önden açmaz; yetkili yarıçap ile kozmetik animasyon ayrımı korunur.

Gerçek cihaz kabulü, [mevcut kalite sözleşmesine](visual-quality.md#real-device-performance-gate) göre yapılacak: amiral gemisi cihazda p95 kare süresi ≤20 ms, orta sınıf Android'de ≤24 ms, desteklenen düşük sınıfta ≤33,3 ms. Yüklenmiş savaş sırasında 100 ms üstü uzun görev oluşmayacak. Aynı kamera rotasında efektin ek CPU/GPU süresi, geçiş sayısı ve hedef belleği ayrıca raporlanacak. Bunlar henüz ölçülmüş sonuçlar değildir.

Yoğunluk dokusunun küçük olması toplam bellek maliyeti diye sunulmayacak; renk/derinlik hedefleri ve MSAA dahil hesaplanacak. Bütçe aşılıyorsa önce ek hedef/örnek maliyeti giderilecek. Görünüm veya mekanik sessizce değiştirilerek başarılı sayılmayacak.

## 8. Uygulama sırası ve her adımın doğrulaması

| Adım | Yapılacak iş | Tamamlanma ölçütü |
| --- | --- | --- |
| 1. Kesin parametre ve taban | Soft + `0.025` + tam 38 birimi tek ayarda tanımlama; mevcut gerçek sahneden aynı kamera rotasında görsel ve performans tabanı | Dönüşümler testle doğrulanır; sis öncesi referans kaydedilir |
| 2. Birleşim modeli | Mevcut sensörlerden dönüştürülmüş alanlar, nokta kapsamı ve ışın aralıklarının birleşimi | Önce başarısız test, sonra ayrık/kesişen/iç içe/teğet durumlarda geçen hedefli testler |
| 3. Tek alan entegrasyonu | Üretim zincirine yumuşak sis; doğru derinlik ve renk sırası; tam ayarla mobil/masaüstü referans çekimi | Seçilen hafif görünüm gerçek oyunda değerlendirilir; canlı nesnede sis katkısı sıfır, dış boşlukta pozitif katkı |
| 4. Çoklu alan ve küre yüzeyleri | Aynı sis geçişinde birleşim, içte kalan mavi yüzeylerin maskelenmesi, dinamik alan değişimleri | Kesişimde duvar/şerit/çift yoğunluk yok; aktif dünya değişimi toplam kapsamayı değiştirmez |
| 5. Gerçek akışlar | Filo geçişi, radar, sonda, teleskop gelişimi, dünyayı kazanma/kaybetme; başlangıç galaksisinin yetkili kaynakları | Normal oyunda mevcut bilgi sınırları ve zamanlama korunur; yeni oyuncu uzak dünyayı seçip keşfe ilerleyebilir |
| 6. Mobil ve kaynak kontrolü | Kalite profilleri, şeffaf efektler, bağlam geri gelişi, bellek ve cihaz ölçümleri | Görsel ve gerçek cihaz eşikleri geçer; hedefler tekrar tekrar kurulup birikmez |
| 7. Son inceleme | İlgili testler, tip/lint/derleme kontrolleri, gerçek oyun görsel kontrolü ve teknik belgelerin hizalanması | Kayıtlı kanıtlar ve son kabul listesi tamamlanır; geçici deneme dosyaları bırakılmaz |

Her davranış değişikliğinde proje kuralı olan **FAIL → uygula → PASS** sırası izlenecek. Saf sunum/CSS kontrolleri görsel doğrulamayla yapılacak. Uzun ekonomi, sezon ve snowball testleri bu özellik için çalıştırılmayacak.

## 9. Test ve kabul matrisi

### Otomatik doğrulama

- **Geometri:** boş alan listesi, sıfır yarıçap, sınırın tam üstü, farklı yükseklikler, eş merkez, tam çakışma, iç içe alan, teğet, iki/üç/dört alan birleşimi, ayrık alanların arasındaki mesafe ve ışının kameranın arkasındaki kesişimleri.
- **Geçiş:** `R`, `R + 19`, `R + 38` noktalarında süreklilik; geçiş bandı bilgi menzilini değiştirmez. `%2,5` değeri `%2` veya `%3`e yuvarlanmaz.
- **GPU/görsel:** canlı nesnede ve uygun boş iç pikselde sis katkısı sıfır; dışarıdaki gezegensiz pikselde pozitif; üretimdeki çok hafif sis için gerekirse hassas kayan noktalı test okuması kullanılır. Labın yüksek yoğunlukta çalışan 8 bit okumasına körü körüne güvenilmez.
- **Perspektif:** küre dışı, içi ve sınırında kamera; eğik/üst/yan açı; yakın/uzak görünüm; ekranda çakışan fakat 3D'de ayrı hacimler; yakın ve uzak clipping sınırları.
- **Veri/yaşam döngüsü:** aktif dünya değişimi, küre görünürlüğü, teleskop güncellemesi, kaynak ekleme/çıkarma, sensör sırasının değişmesi, ilk veri yüklemesi, kalite değişimi, resize, context kaybı ve restore.
- **Mevcut regresyonlar:** `sensor-rings`, `sensor-shaders`, `sensor-framing`, `crossing`, `galaxy-postprocessing`, `render-cost`, `gpu-context`, `quality-switch`, `planet-visibility` ve `fog` testleri dokunulan kapsama göre çalıştırılır. Bilgi akışına temas eden değişiklik olursa ilgili traffic/probe/world-memory ve başlangıç görüş testleri de eklenir.

Yeni ortak geometri için hedefli birim testleri, üretim efekt entegrasyonu için mevcut postprocessing testleri ve gerçek GPU çıktısı için `tools/visual.mjs` akışı kullanılacak. Kısa testler tek worker; ağır kontroller `tools/heavy.mjs` ortak sırasından, `CLAUDE.md` bellek sınırlarıyla çalıştırılacak.

### Gerçek oyun ve görsel kabul

- 350 px genişlikte telefon, standart portre ve masaüstü görünümü incelenir; Android uygulamasının WebView akışı da denenir.
- Yalnız görüşünde kalan gerçek hareketi olan yeni oyuncu, dış dünyaları görebilir ve seçebilir. Ses veya uzun açıklama olmadan açık/sisli ayrımı anlaşılır.
- Alan dışındaki gezegenin önünde, arkasında ve boş gökyüzünde geçen görünür gemi/temas; egzoz, mavi küre ve seçim işaretleriyle birlikte izlenir.
- İki ayrı alan, kesişen iki alan ve zincir hâlindeki üç/dört alan için kamera hareket videosu alınır. Sabit ekran görüntüsü tek başına yeterli değildir.
- Sonda kaydı geldiğinde yalnız izin verilen kayıt güncellenir; o dünyanın çevresindeki uzay açılmaz. Kayıt eskir, dünya canlıymış gibi level-up oynamaz.
- Radyasyon, savaş ve kamusal olaylarla aynı karede sis okunabilirliği kontrol edilir.
- Mümkünse mekaniği daha önce bilmeyen birkaç kişiye açıklama yapmadan harita gösterilir: nerede canlı hareket görebileceği ve uzaktaki dünyayı nasıl inceleyeceği anlaşılabiliyor mu gözlenir. Bu çalışma otomatik testin geçtiği iddiasına dahil edilmez; gözlem olarak kaydedilir.

## 10. Başlıca riskler ve karşılıkları

| Risk | Önlem / kontrol |
| --- | --- |
| `%2,5` gerçek sahnede fark edilmiyor | Ayarı artırmadan önce doğru yoğunluk aktarımı, bloom/renk sırası ve referans eşleşmesi kontrol edilir. Hâlâ sorun varsa görüntüyle owner'a sunulur |
| Galaksi tekrar gri ve boş görünüyor | Uzak dünya bulunabilirliği ve mevcut karartmayla toplam etki mobilde incelenir; yeni bir kat karartma otomatik eklenmez |
| Kesişimde sis koyulaşıyor veya iç duvar var | Tek birleşim hesabı ve iç küre yüzey maskesi; tam çakışmada tek çizim |
| Kamera açısı dış nesneyi yanlışlıkla temizliyor | Gerçek yüzey derinliği ile boş gökyüzü maskesi ayrılır; ekran çakışması testi |
| Şeffaf efekt yanlış arka plan derinliğini kullanıyor | Gerçek malzemelerle test; gereken efekte nesne konumundan ortak maske |
| Uzun oturumda desen çizgisi/titreşim/bantlaşma | Dünya koordinatlı aynalı örnekleme, yeterli hassasiyet, kontrollü zaman sarmalama ve tek renk çıkışı |
| Mobilde maliyet/ısınma artıyor | Tek ortak zincir, ek hedeflerden kaçınma, sabit örnek bütçesi ve gerçek cihaz karşılaştırması |
| Başlangıç sahnesi yanlış sensör kaynağını kullanıyor | Başlangıç gemisinin `vesselSphere` verisi ile gezegenlerin `sensorSphere` verisi ayrı kaynaklardan aynı sunum biçimine taşınır; prologda sunucu görüşü uydurulmaz |

## 11. Teslimde bulunacaklar

- Gerçek oyunda seçilen ayarla çalışan yumuşak dış sis ve gerçek mavi teleskop küresi.
- Birleşen/kesişen görüş alanları ve iç yüzey temizliği; tek alanlı labla sınırlı olmayan çözüm.
- Tek kaynaklı görsel parametreler, hedefli testler ve genişletilmiş görsel kontrol senaryoları.
- Mobil/masaüstü referanslar, çoklu alan kamera videosu ve gerçek cihazda önce/sonra maliyet kaydı.
- Bu plan ve ilgili görsel tasarım açıklamalarında son kararın kaydı; eski yorumların güncellenmesi.

**Son kabul:** Seçilen hafif görünüm korunuyor; iç/dış ayrımı anlaşılıyor; uzak dünyalar bulunabiliyor; görüş alanları 3D'de doğru birleşiyor; canlı bilgi sızmıyor; gerçek oyunun mobil performans ve GPU geri dönüş kontrolleri geçiyor.

## Kaynaklar

- [Proje çalışma kuralları](../CLAUDE.md)
- [Görüş katmanı incelemesi](review-sight.md) — tarihsel bulgular; mevcut davranış kod ve testlerle doğrulanır.
- [Görsel tasarım ilkeleri](visual-design.md)
- [Görsel kalite ve gerçek cihaz kabulü](visual-quality.md)
- [Güncel başlangıç ve onboarding ayrımı](review-onboarding.md)
- [Sis araştırması](../reports/Astera%20için%20hafif%20uzay%20sisi.md)
