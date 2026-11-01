# Onboarding süresi ve başarı ölçümü

## Ne kadar sürmeli ve hangi süreyi ölçüyoruz?

### Takeaway
Evrensel, deneyle kanıtlanmış bir ideal onboarding süresi bulunamadı. İlk eyleme erişim, rehberli öğretim, bağımsız ana döngü ve bütün ilk oturum ayrı ölçülmeli; ilk oturum korelasyonlarından tutorial süresi çıkarılmamalı.

### Cited Findings
- Mark Robinson'ın deltaDNA verileriyle yazdığı 18 Nisan 2016 tarihli birinci el analizi, Ekim 2015–Şubat 2016 döneminde seçilmiş 275 karşılaştırılabilir oyunu inceliyor. Ortalama ilk oturumu 9 dakikadan uzun oyunların D1 retention'ı ortalama %31; kısa olanların %20. Yazar ters nedenselliği de kabul ediyor: kısa oturumun nedeni yüksek terk olabilir. Bu randomize süre deneyi değil, oyunlar arası gözlemsel ilişki; tüm ilk oturum ölçülüyor, tutorial değil. Yazarın 10–20 dakika önerisi bu veri üzerinden yaptığı yorumdur; 2026 için evrensel eşik olarak sunulmamalı. — [How first session length impacts game performance](https://www.gamedeveloper.com/business/how-first-session-length-impacts-game-performance)
- Petersen ve diğerleri, CHI PLAY 2017 araştırmasında 28 katılımcıyla Candy Crush Jelly Saga, WinterForts ve Pogo Chick onboarding'ini yaklaşık yedişer dakika inceledi. Bu süre üç oyunun temel mekaniklerinin öğretildiği araştırma aralığı olarak seçildi ve geliştiricilerce uygun bulundu. Çalışma optimum süreyi karşılaştırmıyor. — [Evaluating the Onboarding Phase of Free-to-Play Mobile Games: A Mixed-Method Approach](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf)
- 45.000'den fazla oyuncuyla üç oyunda sekiz tutorial tasarımını karşılaştıran CHI 2012 araştırması, en karmaşık oyunda oynama süresini %29'a kadar artıran etki bulurken iki daha basit oyunda anlamlı etkileşim artışı bulmadı. Bu bulgu yalnızca incelenen oyun ve tasarımlara aittir; “kısaltmak her zaman iyidir” veya “tutorial her zaman retention artırır” sonucunu desteklemez. — [The Impact of Tutorials on Games of Varying Complexity](https://grail.cs.washington.edu/projects/game-abtesting/chi2012/)

### Inferences
- Aşağıdakiler kanıtlanmış sektör standardı değil, özellikle mobil strateji için prototipte sınanabilecek **başlangıç hedefleri**: ilk anlamlı etkileşim 10–30 saniye; neden oynadığını hissettiren ilk küçük başarı ilk 1–2 dakika; ilk gerçek seçim ilk 1–3 dakika; yoğun rehberli bölüm yaklaşık 3–8 dakika; yardım azaldığında ilk bağımsız tekrar yaklaşık 5–10 dakika. Birbirinden bağımsız kronometre kuralları değildir; aynı akışın örtüşen kilometre taşlarıdır. Aralıklar zorunlu değil, performans ve oyuncu gözlemiyle değiştirilmeli.
- İlk oturumda 10–20 dakikalık ilgi çekici içerik planlamak yararlı bir hipotez olabilir; oyuncuyu bu süre boyunca zorunlu eğitimde tutmak veya çıkmasını engellemek önerilmez. Öğretim ilk oturum sonrasındaki bağlamsal yardımlarla devam edebilir.
- Onboarding bitişi zamana göre değil davranışa göre tanımlanmalı: oyuncu temel amacı anlayıp yeni bir durumda temel döngüyü yardım almadan tekrar edebiliyor mu? Asenkron oyunda ilk gerçek sonuç saatler sonra gelecekse “ilk dispatch” ile “tam ilk döngü” ayrı hedeflerdir. Takvimi değiştirmek araştırma sonucunun gereği değildir.
- “İlk anlamlı eylem” bir Continue düğmesine basmak değildir; oyuncunun oyunun vaadine ilişkin bir sonuç üretmesidir. “İlk anlamlı seçim” oyuncunun en az iki makul seçenek arasında neden seçtiğini açıklayabildiği andır.

### Gaps
- Evrensel “tutorial 3/5/10 dakika olmalı”, “ilk 30 saniye şu oranda retention artırır” türü iddialar için güçlü deneysel dayanak bulunamadı.
- Modern kalıcı çok oyunculu uzay stratejilerinde ideal FTUE süresini izole eden kamuya açık randomize deney bulunamadı.

## Sıkılma, kafa karışıklığı ve gerçek öğrenme nasıl ölçülür?

### Takeaway
Tutorial completion tek başına yeterli başarı ölçütü değil. Adım kaybı ve süreyi, yardım olmadan tekrar, hata sonrası toparlanma ve sonraki oturum dönüşüyle birlikte izlemek gerekir; davranış verisi tek başına duygunun nedenini söylemez.

### Cited Findings
- Unity'nin resmi Funnels dokümanı, sıralı adımların kullanıcı sayısını, terk oranını ve aradaki süreyi ölçmeyi; tutorial'dan sonra öğretilen özelliğin düzenli kullanılıp kullanılmadığını ayrıca izlemeyi öneriyor. — [Unity Analytics: Funnels](https://docs.unity.com/en-us/analytics/funnels/funnels)
- GameAnalytics'in resmi metrik tanımına göre strict D1/D7 retention, başlangıç gününün tam 1/7 gün sonrasında dönen başlangıç kohortunun oranıdır. GameAnalytics günleri UTC'ye göre hesaplar; ertesi gün ile “24 saat sonra” aynı şey olmayabilir. — [GameAnalytics Metrics](https://docs.gameanalytics.com/events-metrics-and-filtering/metrics/)
- CHI PLAY 2017 çalışmasında video üzerinden oyun sonrası görüşmeler, oyuncunun hangi anda neden sıkıldığını veya kafasının karıştığını belirlemeyi sağladı. WinterForts'ta 19/28 katılımcı otomatik savaş sırasında birkaç dakikalık zorunlu bekleyişten rahatsızlık belirtti. Araştırmacılar yüksek fizyolojik uyarılmanın olumlu heyecanla rahatsızlığı tek başına ayıramadığını vurguluyor. Yukarıdaki yedi dakika ve katılımcı bulgularıyla birlikte bu kaynaktan toplam türetilen anlatım 200 kelimeyi geçmemeli. — [Petersen et al., 2017](https://findresearcher.sdu.dk/ws/files/195676326/p377_petersen.pdf)

### Inferences
- Önerilen temel akış: ilk açılış → oynanabilir ekran → ilk temel eylem → ilk karar → ilk sonuç/ödül → yardım olmadan ikinci karar → ikinci oturum. Her öğretim adımına gösterildi/başladı/tamamlandı/atlandı/yardım açıldı kayıtları ve zaman damgası eklenebilir. Asenkron döngünün bekleme ve geri dönüş adımları ayrıca izlenmeli.
- Ana başarı sinyali: **yeni oyuncuların yardım olmadan ikinci temel eylemi tamamlayan oranı**. Tutorial bitirenlerin içindeki oranı da tüm yeni oyuncular içindeki oranı da göster; yalnızca tamamlayanları incelemek terk edenleri gizler.
- Tanı için: her adımın terk oranı, adımda geçen aktif süre, ilk anlamlı eyleme süre, ilk hatadan sonra yeniden deneyen oran, yanlış/sonuçsuz dokunma, yardım ihtiyacı, tutorial sonrası bağımsız tekrar ve D0 ikinci oturum/D1/D7. İlk oturum süresini tek başına büyütme hedefi yapma: bekleyiş veya kafa karışıklığı da süreyi uzatabilir.
- Ortalama yanında medyan ve yavaş kalan oyuncuların dağılımı (ör. p90) incelenmeli; hızlı geçenlerin ortalaması takılan azınlığı gizleyebilir. Yükleme/ağ bekleyişi, arka planda geçirilen süre ve aktif karar süresi ayrılmalı.
- Gözlem protokolü: ilk kez oynayan kişiye yardım etmeden izle; sonra ilgili ekran kaydını gösterip “Burada ne yapmak istiyordun?”, “Bundan sonra ne bekliyordun?”, “Şimdi kendi başına ne yaparsın?” sorularını sor. Her büyük ekrandan sonra görüşmeyle oyunu bölmek doğal ilk deneyimi değiştirebilir.
- Skip oranını tek başına başarı veya sorun diye yorumlama: deneyimli oyuncu hızlı geçebilir, yeni oyuncu sıkıldığı için de atlayabilir. Atlayanların bağımsız oynama ve retention sonuçlarıyla birlikte değerlendir.

### Gaps
- Belirli bir dwell süresi veya tıklama sayısı oyuncunun kesin sıkıldığını göstermez; motivasyonu görüşme/gözlemle doğrulamak gerekir.
- Genre, dağıtım kanalı ve oyuncu profili bilinmeden “tutorial completion %80 olmalı” türü evrensel hedeflerin dayanağı zayıftır.

## Süre ve akış hipotezleri nasıl güvenilir test edilir?

### Takeaway
Başarı ölçütünü önceden seçip yeni oyuncuları rastgele varyantlara ayır; kısa akışın daha çok tamamlanmasına bakmakla yetinme. Öğrenme ve geri dönüşün de iyileştiğini doğrula.

### Cited Findings
- Unity resmi A/B testing açıklaması, rastgele kontrol/varyant grupları, diğer deneyim koşullarının aynı kalması, başarı ölçütünün önceden tanımı ve yeterli örneklem gereğini belirtir. Düşük trafikte testin uzun sürebileceğini, birden fazla değişikliğin sonucu yorumlamayı güçleştirdiğini açıklar. — [Unity: What Is A/B Testing?](https://activation.unity3d.com/glossary/a-b-testing)
- GameAnalytics'in 28 Nisan 2026 retention rehberi, genre ve iş modeline göre retention eğrilerinin değiştiğini; 40/20/10 gibi oranların evrensel yasa olmadığını belirtir. İlk deneyimi tekrar tekrar aynı kişilerle test etmenin onların artık yeni oyuncu olmaması sorununu vurgular; build ve edinim kanalı gibi kohortlarla karşılaştırma önerir. — [How to think about retention](https://www.gameanalytics.com/blog/how-to-think-about-retention-in-games)

### Inferences
- Örnek test: A = tüm özellikleri başta anlatan mevcut akış; B = yalnızca ilk karar için gereken bilgiyi gösteren akış. Ana ölçüt yardım olmadan ikinci core-loop eylemi; D1/D7 ve sonraki hata oranı kontrol ölçütleri olabilir. “B 2 dakika daha kısa” kendi başına kazanım değildir.
- Testi tek bir hipoteze daraltmak daha yorumlanabilir: ör. aynı mekaniğin öğretimini 6 zorunlu adım yerine 2 temel adım + bağlamsal yardım biçiminde sunmak. Bütün UI, ödüller ve tutorial aynı anda değişirse hangi unsurun sonuç yarattığı ayrılamaz.
- Ana analiz tüm rastgele atanmış yeni oyuncuları içermeli; yalnız tutorial bitirenlerde retention karşılaştırmak seçim yanlılığı üretir. Dil, cihaz, edinim kanalı, ağ performansı ve önceki genre deneyimi farklılıklarını kontrol et.
- D7 için kohortun yeterince yaşlanmasını bekle; toplam test süresi için evrensel “bir hafta yeter” kuralı kullanma. Minimum etki büyüklüğü ve örneklem gereği belirlenmeli; küçük sayılardaki dalgalanmaları kazanan ilan etme.
- Çok az yeni oyuncuda önce gözlemle büyük sürtünmeleri bul; küçük örneklemli görüşmeleri retention yüzdesi kanıtı diye sunma.

### Gaps
- Kullanıcının gerçek yeni oyuncu trafiği ve mevcut D1/D7 değerleri olmadan anlamlı örneklem büyüklüğü veya kesin test takvimi hesaplanamaz.
