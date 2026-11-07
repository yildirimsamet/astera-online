# Başlangıç galaksisi: oyuncu testi düzeltme planı

**Tarih:** 2026-11-05. **Durum:** K1–K3 kararları verildi, uygulama başladı.

**Kaynaklar**

- Benim uçtan uca oyun testim: ilk 8 düzeltme ve kalan bulgular.
- Codex'in ilk kez oynayan oyuncu testi: `out/codex-oyun-2026-11-05/codex-oyun/rapor.md` ve `degerlendirme.md`. Bölüm kodları (A-05, D-01 …) oradaki bulgulara karşılık gelir.
- Değerlendirme ölçütü: `docs/oyuncu-testi-degerlendirme-rehberi.md`.

**Kurallar:** Her madde TDD ile yapılır, tasarım ve CSS hariç. Değişen her metin 6 dilde güncellenir. Her ekran 350 px'de görsel olarak doğrulanır. Ortak bileşene dokunan madde ana oyunu da etkiler ve bu planda işaretlenir. Bot ifadesi hiçbir yerde kullanılmaz.

## Faz 0. İlk 8 düzeltme

Kod ve testler yazıldı; typecheck ve lint temiz. Hedefli testler geçti. Tam sunucu koşusu ve ekran doğrulaması yapılmadı.

| # | Düzeltme | Kalan iş |
| --- | --- | --- |
| 0.1 | Filo sayfası gemideyken Tamirhane'ye yönlendirir | Ekran doğrulaması |
| 0.2 | Gemideyken Ölüm Yıldızı bloğu ve "Ulaşılamaz" çipi yok | Ekran doğrulaması |
| 0.3 | Bildirim ve raporlarda ham kod yerine karakol adı ve "Korsanlar" | Ekran doğrulaması |
| 0.4 | Savaş raporu bildirimi raporu açar | Ekran doğrulaması |
| 0.5 | Aegis bitince kalkan dolu başlar | Sahibe bildir: kararı ben verdim |
| 0.6 | Enkaza sonda düğmesi | Ekran doğrulaması; 2.3 ile birlikte ele alınır |
| 0.7 | "Savunmayı hazırla" Tersane ve Tamirhane'ye götürür | Ekran doğrulaması |
| 0.8 | Raporda kargo sınırı ve "muhafız şu saate kadar yok" satırı; muhafızı kaçan karakol da yeniden dolar | Ekran doğrulaması |

## Faz 1. Hatalar

Doğru olan davranış belli; yalnız uygulama yanlış.

| # | Sorun | Kanıt | Kök neden | Düzeltme | Test |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Savaş tekrarı "Tur 1/8" diyor, rapor 6 tur | B-07, ekran 167, 173 | `BattleReplay.tsx:140,216`, toplam olarak `recording.roundLimit` kullanılıyor | Toplam, oynanan tur sayısı olur | Tekrar bileşeni: 6 turluk kayıt "/6" gösterir. **Ana oyunu da etkiler** |
| 1.2 | Sonda raporu bildirimi raporu açmıyor | E-04, ekran 189–190 | `Signals.tsx` `DESTINATION`: yalnız `BATTLE_REPORT` var; `PROBE_REPORT`, `PROBE_DETECTED`, `RADAR_WARNING`, `SHIELD_WARNING`, `FLEET_HOME`, `FLEET_TURNED_BACK`, `REPAIR_DONE` yönsüz | Her gemi bildirimi kendi yerine gider | `notification-routes.test.tsx`: `SHIP_KINDS` tam liste; her tür bir hedefe gider |
| 1.3 | Kaya ekranı "yük havuza iner" diyor, yük doğrudan depoya geçiyor | E-05, ekran 051, 081, 094 | `fleet.ts` dönüşte `alloy/crystal/deuterium` artırıyor; metin ana oyunun (`world.ts:441`, `planet.ts:339`) | **Karar K3**: yük havuza iner (ana oyunla aynı) veya metin gemide değişir | Kural testi + metin testi |
| 1.4 | Dönüş özetinde Döteryum yok; "200 kaynak" türlere ayrılmıyor | E-03, ekran 081, 097, 120 | Gemi dönüş özeti ve toplama bildirimi toplamı yazıyor | Tür başına satır: alaşım, kristal, Döteryum | Özet bileşeni: üç tür ayrı |
| 1.5 | "Havuz durdu" yanlış alarmı | Benim testim | `Signals.tsx` `worksStoppedLine` gemide yanlış koşulda | Koşul gemi durumuna göre düzeltilir | Sinyal testi: dolu olmayan havuzda alarm yok |
| 1.6 | "Sen yokken" kartı açıkken "Tamam" çalışmıyor | Benim testim | İnceleme gerekiyor (üst üste katman) | Odak ve katman sırası | Bileşen testi |
| 1.7 | Geçmişte eski "Radar: 0 dk içinde" satırları | Benim testim | Geçmiş satırı süresi geçmiş uyarıyı tutuyor | Geçmişte göreli süre yerine "geldi" veya saat | Bildirim metni testi |
| 1.8 | Enkaz düğmesi "3 dk", bildirim "2 dk", sayaç 2 dk 14 sn | Codex raporu, ekran 092–093 | Yuvarlama farkı (düğme yukarı, bildirim aşağı) | Tek yuvarlama kuralı | Biçimlendirme testi |
| 1.9 | Yeniden yüklemede yaklaşık 16 adet 401 | Benim testim; Codex koşusunda 163 | Oturum yenilenmeden önce korumalı okumalar gidiyor | Okumalar oturum hazır olunca başlar | İstemci testi: ilk yüklemede 401 yok |
| 1.10 | "Kayıpların çoğu Akıncı" notu 1 Ok + 1 Kargı kaybında yanlış görünüyor | C-03, ekran 200 | `useTargetReading.ts:243` `dominantClass` son savaşın filosundan sınıf seçiyor; notun neyi anlattığı belirsiz | Not, neyi saydığını söyler; çoğunluk yoksa yazılmaz | Kural testi: eşit dağılımda not yok. **Ana oyunu da etkiler** |

## Faz 2. Karar desteği ve anlatım

Kural doğru, ama oyuncu kararı verirken göremiyor.

| # | Sorun | Kanıt | Düzeltme | Test |
| --- | --- | --- | --- | --- |
| 2.1 | Karakolda saldırı yok ve nedeni yazmıyor; kart yine de ödülü gösteriyor | A-05 (engelleyici), ekran 146 | Karakol kartında kilitli saldırı satırı: "İlk savaşından sonra açılır" ve ilk savaşın nasıl geleceği (Aegis sonrası korsanlar). Motor gövdesindeki "ilk savaş raporun" koşulu da aynı açıklamayı taşır. **Karar K1** kuralın kendisini sorar | Odak paneli testi: kilitliyken satır ve neden görünür; açıkken düğme |
| 2.2 | Aegis'in korsanları getirdiği onarımdan sonra öğreniliyor | D-01, ekran 139, 141 | Aegis kartında, satın almadan önce: "Savunma kurar. Bundan sonra korsanlar akın edebilir." Bitiş anı yalnız onaylar | Onarım kartı testi: risk satırı karar öncesi görünür |
| 2.3 | Motor "enkaza veya karakola sonda gönder" diyor, ama sonda düğmesi ve parça işareti henüz yok | D-03, ekran 092, 144, 179 | Yönlendirme yalnız parça hedefleri görünürken gösterilir; öncesinde neyin açacağını söyler | `partsVisible` ile aynı koşul; panel testi |
| 2.4 | Kalkan ve küçük hasar kuralları savaştan sonra öğreniliyor; rapor "tamire gönder" diyor | D-07, ekran 200, 207, 208 | Rapor: "%20'ye kadar hasar inişte kendiliğinden geçer; kalanı Tamirhane'de." Gemi kalkanı kuralı gönderim ekranında tek satır | Rapor testi: istisna satırı; gönderim ekranı testi |
| 2.5 | Sınıf satırı yönü ters okunuyor ("Akıncı güçlü") | B-02, ekran 193–194 | Yön açık yazılır: "Senin Akıncıların onlara karşı güçlü" veya "Onlara karşı Akıncı getir" | `shapes` metin testi. **Ana oyunu da etkiler** |
| 2.6 | Hiç gemi yok etmeden "kısmen başarılı"; kayıp küçük, başlık büyük; düşman filosu gizli | C-03, I-03, ekran 200 | Başlığın yanında neden: "Ganimet aldın, muhafız ayakta." Kayıp başlıkla aynı ağırlıkta. Sonda verisi varsa düşmanın bilinen filosu | Rapor testi: sonuç nedeni ve kayıp satırı başlıkta. **Ana oyunu da etkiler** |
| 2.7 | Güç sayıları ekrandan ekrana farklı ölçüde | B-04, ekran 054, 060, 061 | Kart, rapor ve dosya aynı ölçüyü aynı adla kullanır ya da farkı söyler | Biçim testi: aynı değer aynı etiket |
| 2.8 | "b" birimi ve "/1b" yakıt anlaşılmıyor; uçuş yuvasının neyi saydığı belirsiz | B-01, ekran 056, 111 | Kısaltmaya dokununca tam sayı. Yakıt "1.000 mesafe başına". Uçuş yuvası satırı "Sonda ve Kazıcı sayılmaz" | Biçim ve satır testi |
| 2.9 | "Onarım 2/5" mevcut mu sonraki mi belli değil; %100 iken isteğe bağlı iş kalıyor | B-08, ekran 020, 087, 095 | "2. aşama / 5" ve "zorunlular tamam, kalanlar isteğe bağlı" | Kart metni testi |
| 2.10 | Kilit simgesi sekmenin açılmadığı sanılıyor | A-04, ekran 023, 034 | Kilit, sekmede değil sistemde gösterilir; sekme içinde neyin kilitli olduğu ve neyle açılacağı yazar | Sekme testi |
| 2.11 | Tek dokunuşta ücretli sonda onaysız gidiyor | Benim testim | Bedel görünür; ilk gönderimde onay veya basılı tutma (saldırıdaki gibi) | Gönderim testi |
| 2.12 | Göçte 14.306 alaşım ve 3 gemi kaybı yalnız son ekranda görülüyor | Benim testim | Motor ve göç panelinde, karar öncesi "seninle gelmeyecekler" listesi | Panel testi |

## Faz 3. Etkileşim maliyeti

| # | Sorun | Kanıt | Düzeltme | Test |
| --- | --- | --- | --- | --- |
| 3.1 | Onarım şeridinin devamına ulaşılamıyor; küçük resimlerde ad yok | F-02 (yüksek), ekran 098–103 | Şerit kaydırılabilir olduğunu gösterir, her öğede ad ve aşama vardır, istenen iş doğrudan seçilir | Şerit testi: gizli öğe seçilebilir |
| 3.2 | Tamirhane zor bulunuyor; evdeki gemi satırı haritaya götürüyor | F-01, ekran 184–207 | Hasarlı gemi satırı Tamirhane'ye götürür. 0.1 ve 0.7 ile birlikte doğrulanır | Satır hedefi testi |
| 3.3 | Kayaları karşılaştırmak için tek tek açmak gerekiyor | D-05, ekran 049, 051 | Listede içerik oranı ve yol süresi | Liste testi |
| 3.4 | Satın alınca aynı yerdeki düğme başka bir işe geçiyor | G-04 (tahmin), ekran 021–022 | Kart değişince düğme kısa süre kilitlenir veya değişim görünür | Bileşen testi |
| 3.5 | Araştırmada geniş boşluk, karar kartı altta | F-05, ekran 115 | Tasarım düzeni; yoğunluk 350 px'e göre | Görsel doğrulama |

## Faz 4. Dil ve tutarlılık

| # | Sorun | Kanıt | Düzeltme | Test |
| --- | --- | --- | --- | --- |
| 4.1 | Yardım ve Hızlı başlangıç gemide ana oyunu anlatıyor | B-06 (yüksek), ekran 072–073 | Gemideyken gemi aşamasına ait yardım; ana oyun makaleleri "Ana galakside" diye ayrılır | Yardım testi: gemideyken gemi içeriği |
| 4.2 | "Dünyanın sahip olduğu…", "ilk gezegenini geliştir", "gezegenindeki savunma", "ANA GEZEGEN", "Koloni geminiz" | B-06, ekran 058, 071; benim testim | Gemideyken gemi dili; bütün gemi yüzeylerinde tarama | Metin testi: gemi yüzeylerinde gezegen dili yok |
| 4.3 | Savaş tekrarı ve raporda gemi yerine gezegen | I-04, ekran 173 | Gemi savaşında gemi sahnesi | Tekrar sahne testi |
| 4.4 | Haritada "OP-625C" kodu | Codex raporu, ekran 054 | Karakola ad verilir; kod yalnız ikincil satırda | Ad testi |
| 4.5 | Wiki araması süzmüyor gibi görünüyor | Codex raporu, ekran 069–070 | İnceleme; arama sonucu sayısı ve vurgu | Arama testi |

## Faz 5. Görsel

| # | Sorun | Düzeltme |
| --- | --- | --- |
| 5.1 | Enkaz görseli ucuz duruyor (benim testim) | Görsel yenileme; ana sahne kalitesinde |
| 5.2 | Bir dönüşte birçok açılış birden (A-03) | Açılışlar tek tek, oyuncu kapattıkça |
| 5.3 | Sonuç başlığı kaybı gölgeliyor (I-03) | 2.6 ile birlikte |

## Faz 6. Sahibin kararları

**Verilen kararlar, owner 2026-11-05:**

- **K1:** Kural kalır; 2.1 ile anlatılır.
- **K2:** Denge kalır; daha iyi anlatılır, sonra yeni oyuncu testiyle ölçülür.
- **K3:** Gemi dönüş yükü havuza iner, ana oyundaki gibi.

K4–K7 açık.

| # | Soru | Seçenekler | Önerim |
| --- | --- | --- | --- |
| K1 | Saldırı ilk savaş raporundan sonra açılıyor. Kural kalsın mı? | a) Kalsın, 2.1 ile anlatılsın. b) Aegis bitince açılsın. c) İlk karakol baştan açık olsun | **a.** Kural "önce savun, sonra vur" hikâyesini taşıyor; asıl sorun anlatılmamasıydı |
| K2 | Seviye 1 karakolda 30 kaynak için 2 gemi kaybı | a) Denge kalsın, sonuç ve risk daha iyi anlatılsın. b) Seviye 1 muhafız zayıflasın veya ganimet artsın | **a**, sonra yeni bir oyuncu testiyle ölç. Tek örnek denge kararı için yetmez |
| K3 | Gemi dönüş yükü depoya mı, havuza mı? | a) Havuza, ana oyunla aynı. b) Depoya kalsın, metin değişsin | **a.** Oyuncu ana galakside aynı kuralı bulur |
| K4 | Bilinmeyen sinyal açılışta merak uyandırıyor, devamı gelmiyor (H-03) | a) Gemi aşamasına bir sinyal görevi. b) Açılıştan kaldırılsın | **a**, kapsamı ayrıca konuşalım |
| K5 | Alaşım kristalden yaklaşık 5 kat hızlı geliyor | Denge ölçümü | Uzun simülasyon istersen ölçerim |
| K6 | Gemide sohbet boş (H3) | Tasarım kararı | Ayrı konuşalım |
| K7 | Korsan uyarısından sonra komut için yaklaşık 10 dakika var | a) Kalsın. b) Süre uzasın | Çevrimdışı oyuncu için riskli; senin kararın |

## Faz 7. Doğrulama ve teslim

1. Her madde: önce kırmızı test, sonra kod, sonra yeşil.
2. Her faz sonunda typecheck, lint ve ilgili testler.
3. Bütün ekranlar 350 px'de görsel olarak doğrulanır; 0.x maddeleri de dahil.
4. Bütün iş bitince tam kapı: typecheck, lint, web, rules ve sunucu. Uzun simülasyonlar yalnız istenirse.
5. Yeni bir Codex oyuncusu, Wiki yasak ve yeni personayla aynı yolu baştan oynar (RITE). Aynı bulgu tekrar çıkarsa düzeltme başarısız sayılır.

## Sıra ve tahmin

| Sıra | İş | Kaba süre |
| --- | --- | --- |
| 1 | Faz 1 ve K3 kararı | Kısa |
| 2 | Faz 2: 2.1, 2.2, 2.3, 2.4, 2.6 önce | Orta |
| 3 | Faz 3: 3.1 önce | Orta |
| 4 | Faz 4 | Orta |
| 5 | Faz 5 ve 0.x ekran doğrulaması | Orta |
| 6 | Tam kapı ve yeni oyuncu testi | Uzun |

Süreler kabadır; kesin bir saat sözü değildir.
