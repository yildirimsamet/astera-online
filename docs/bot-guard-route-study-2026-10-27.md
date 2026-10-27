# Guard bot gelişim rotası — 27 Ekim 2026

## Sonuç ve kapsam

Öneri: ekonomik açılış → küçük karma savunma → T3 karma filo → ekonomik genişleme ile T4 → filo ve onarım kapasitesi. Gün sayıları botun talimatı değildir; ücretli rotanın ölçülen çıktısıdır.

Rota yerel `astera_guard_route_test` veritabanında, gerçek `joinSeason`, toplama, bina, gemi, uydu, araştırma ve tamamlanma servisleriyle tekrar oynatıldı. Zaman kontrollü ilerletildi; üretimler kendi gerçek bitiş anlarında uygulandı. Ücretsiz kaynak/gemi, fiyat indirimi, doğrudan bina/araştırma seviyesi verme veya prod yazması yapılmadı. Canlı bot davranışı değiştirilmedi.

Snowball audit'in **yöntemi** kullanıldı: gerçek Akademi çıkışı, satın almaların gerçek bedelleri, kuyrukların birlikte ilerlemesi, hak edilmiş ödüller ve kapasitenin satın almadan önce kontrol edilmesi. Eski raporun fiyatları, koloni açılış süreleri veya hata açıklamaları bugünün verisi sayılmadı. Koloni/tüccar/garnizon arama algoritması bu küçük bot paketine eklenmedi.

**Doğrulanan:** belirli başlangıç ve oturum koşullarında kaynak, araştırma, depo, yer savunması ve hangar açısından tıkanmadan ilerleyen bir gelişim yolu.

**Bu ölçümün kapsamı dışında:** rakip saldırıları altında hayatta kalma, bütün oyunculardan hızlı büyüme, zorbalığı azaltma ve her hedefe karşı muharebe başarısı. Bir başlangıç rotasının tamamlanması bütün 60 günlük sezonun dengeli olduğunu kanıtlamaz.

## Başlangıç ve çalışma koşulları

- Mevcut Akademi çıkışı: Core/Refinery/Extractor 2; Vault/Shipyard/Hangar 1; Aegis/Telescope/Radar 1; Uplink; 6 Dart, 1 Warden, 1 Prospector, 1 Courier. Core 3 siparişi zaten ücretli olarak kuyrukta.
- İlk toplama sonrası ölçülen banka: 2.542 A / 1.235 C / 46 D. Bu, Akademi paketinin depodaki kaynakları ve mevcut havuzudur.
- Karar aralığı mevcut botlardaki gibi 7–23 dakika. Referans oturumlar Türkiye saatiyle 08–09, 14–15, 21–22; günde üç saat. 01–08 sessizliği ihlal edilmedi. Bunlar karşılaştırma için sabit pencerelerdir; gerçek botların aynı anda hareket etmesi önerilmiyor.
- Madencilik, ganimet, korsan, ticaret, koloni ve oyuncu yardımı geliri **sıfır** kabul edildi. Bu gelirler canlıda kazanılırsa harcanabilir; önceden var sayılıp sipariş finanse edilmez.
- Önerilen aday, yalnız sunucunun `claimable` dediği normal gelişim ödüllerini alır. Hesap kapsamlı sosyal ödüller ve sezon sonu/sıralama ödülleri bu işin dışında. Ödül almak için ekstra Dart veya gereksiz probe üretilmedi.
- İnşaat, araştırma ve tersanede tur başına en fazla birer yeni sipariş. Harcama sırası ortak bakiyeden yürür; önceki hedef için ayrılan para sonraki hedefe harcanmaz. Ödenmiş/kuyruktaki siparişler tekrar alınmaz.

## Somut rota

Listedeki gemi adetleri ilave sipariş değil, **toplam sahiplik hedefidir**. Evde, görevde, tamirde ve üretimde olanlar sayılır. Farklı kuyruklar paralel ilerlediğinden sıra bir harcama önceliğidir; bir araştırmayı beklerken diğer bütün kuyruklar zorla boş tutulmaz. Aynı inşaat kuyruğundaki ödenmiş Core yükseltmesi sonraki rafineriyi açabilir; başka kuyruktaki bitmemiş tersane/araştırma henüz gemi üretim izni vermez.

### 1. Üretim omurgası ve erken savunma

1. Döteryum Sentezi 1; Döteryum Rafinerisi 1.
2. Her seviye için `Komuta N → Alaşım N → Kristal N`, N=3…9.
3. Komuta 4 aşamasında Döteryum Rafinerisi 2. Döteryum her Core seviyesinde eşitlenmez.
4. Komuta 6 aşamasında Tersane 2; toplam 2 Kazıcı, 2 Thorn, 1 Harpoon, 4 Viper/Engerek, 2 Sentinel/Nöbetçi, 2 Courier/Kurye.
5. Komuta 9'da **Foundry/Körük**. Başlangıç Uplink'i ilk yuvayı tuttuğundan ikinci yuvanın açılması beklenir; gizli/ücretsiz ekstra yuva yoktur.
6. Döteryum Sentezi 2; Döteryum Rafinerisi 3 ve 4.

Erken filonun ve savunmanın maliyeti rotaya dahildir. İkinci Kazıcı ve daha sonra Derrick satın alınsa da hesapta madencilikten kaynak yazılmamıştır.

### 2. Core 12 ekonomisi ve T3 hazırlığı

1. `Komuta N → Alaşım N → Kristal N`, N=10…12.
2. Kasa 2; Hangar 2.
3. Yıldız Gemisi Mühendisliği 1.
4. Tersane 3 ve 4, araştırmalarla paralel.
5. Gemi Gücü 1→2; Gemi Zırhı 1→2; Gemi Kalkanları 1.
6. Yer savunması toplam 4 Thorn, 2 Harpoon, 2 Bastion.
7. Toplam 4 Tempest/Kasırga, 3 Ballista/Balista, 3 Praetorian/Praetoryen.

Hangar 2 kapasitesi 180; bu aşamada tüm mevcut gemilerle yük **156**. Yer savunması yükü **80/140**. Tek sınıf yığmak yerine üç savaş sınıfı birlikte bulunur.

### 3. Core 14 ekonomisi ve ilk T4 filosu

1. `Komuta 13 → Alaşım 13 → Kristal 13 → Komuta 14 → Alaşım 14 → Kristal 14`.
2. Kasa 3.
3. Yıldız Gemisi Mühendisliği 2.
4. Tersane 5→6; Hangar 3.
5. Toplam 3 Corsair/Korsan, 3 Cataclysm/Kıyamet, 2 Paladin/Palatin.
6. Döteryum Rafinerisi 5→6. Sentez 2 bunu zaten açar.

Mühendislik 2 bedeli **64.092 A / 39.442 C**. Core/üretici 12 ve Kasa 2'de kristal kapasitesi **24.629**: yalnız birikimle alınamaz. Core/üretici 14 ve Kasa 3'te kapasite **80.891 A / 40.445 C**: gerçek sipariş verilebilir. Yükseltmeler tamamlanana kadar görülen kısa kapasite beklemeleri kaydedildi; kalıcı tıkanma olmadı.

### 4. Core 16 ve filo/onarım yatırımı

1. `Komuta N → Alaşım N → Kristal N`, N=15…16.
2. Üçüncü uydu yuvası açılınca **Derrick/Matkap**.
3. Yapay Zekâ Robotları 1.
4. Tersane Otomasyonu 1→2; Endüstri 1. Endüstri'nin ön koşulu Otomasyon 2'dir.
5. Gemi Gücü 3; Gemi Zırhı 3; Gemi Kalkanları 2.
6. Döteryum Sentezi 3; Döteryum Rafinerisi 7→8.
7. Hangar 4.
8. Toplam 12 Korsan, 12 Kıyamet, 8 Palatin.

Önceki gemiler de dururken hangar **604/810**. Filo değeri **282.974**; mevcut canlı bot tavanı 260.000 bu hedefi sınırlayacağından guard rotasına bağlanırken guardlara özel ele alınmalıdır.

### 5. İki aylık sezon için büyüme devamı

1. `Komuta N → Alaşım N → Kristal N`, N=17…18.
2. Dördüncü yuvaya **Beacon/Kılavuz**.
3. Gemi Gücü 4; Gemi Zırhı 4; Gemi Kalkanları 3.
4. Döteryum Sentezi 4; Döteryum Rafinerisi 9→10→11→12.
5. Endüstri 2; Hangar 5.
6. Toplam 30 Korsan, 30 Kıyamet, 20 Palatin.

Hangar **1.276/1.550**, yer savunması **80/200**, filo değeri **642.014**. Bu bir gelişim kontrol noktasıdır; guardlar için yeni ve kalıcı bir Core 18 sınırı önerilmemektedir. Sonraki büyüme ve kayıp yenileme, mevcut kaynaklar ve normal kurallar içinde sürdürülmelidir; bu çalışma o devamın veya sürekli PvP'nin tamamını ölçmez.

## Gerçek servis ölçümleri

### Seçilen rota, planlanan 60 günlük tempo ve hak edilmiş gelişim ödülleri

| Kontrol noktası | Akademi çıkışından itibaren |
| --- | ---: |
| Erken filo ve küçük yer savunması | 1,27 gün |
| Core/üreticiler 9 + Körük | 2,25 gün |
| Core/üreticiler 12 + Kasa 2 + Hangar 2 | 4,00 gün |
| İlk T3 karışımı: 4 / 3 / 3 | 7,00 gün |
| İlk T4 karışımı: 3 / 3 / 2 | 12,25 gün |
| T4 karışımı: 12 / 12 / 8 | 19,00 gün |
| Core/üreticiler 18 ve T4 karışımı: 30 / 30 / 20 | 28,00 gün |

Tek deterministik rota tekrarıdır; matematiksel optimum veya oyuncu davranışının tahmini değildir. Ödüllerin tekil kimlikleri ve tutarları kanıtta ayrı listelenir; geri kalan gelir pasif üretimdir. Fiyatlandırma ufku 30 kalırken sezon 60, kaynak çıktısı ×0,85, yapım/araştırma süreleri ×1,15, gemi hızı ×0,90 kullanıldı. Depo/havuz kapasitesinin aynı kalması kontrol edildi. Bu değişiklikler yalnız `.dev` içindeki izole rules kopyasında uygulandı; çalışan ürünün sabitleri değiştirilmedi. Bu, gelecek sürümün tamamının yayın kabulü değildir.

### Seçimi destekleyen karşılaştırmalar

Ödülsüz mevcut tempo, aynı başlangıç/karar takvimi:

| Aday | İlk T3 | İlk T4 | 12/12/8 T4 |
| --- | ---: | ---: | ---: |
| Core 14'te Mühendislik 2 — seçilen sıra | 6,29 gün | 11,25 gün | 16,54 gün |
| Core 12'de Kasa 6 ile erken Mühendislik 2 | 6,29 gün | 10,58 gün | 18,00 gün |
| Core 9'da erken Robotlar 1 | 7,00 gün | 11,29 gün | 17,00 gün |

Erken Mühendislik 2 ilk T4'ü yaklaşık 16 saat öne çekse de hedef filoyu yaklaşık 1,46 gün geciktirdi. Erken Robotlar pahalı başlangıç bütçesini tüketti; %5 yapı süresi kazanımı seçilen rota için erken maliyeti karşılamadı. Robotlar tamamen atlanmadı, Core 16 aşamasına bırakıldı.

Ödülsüz yavaş tempo referansı: ilk T3 **7,58**, ilk T4 **12,58**, 12/12/8 **19,25**, 30/30/20 **28,54 gün**. Hak edilmiş ödüllerle bunlar sırasıyla 7,00 / 12,25 / 19,00 / 28,00 oldu.

## Kaynak, depo ve yakıt yeterliliği

Planlanan yavaş tempodaki kontrol noktaları:

| Ekonomi | Saatlik A / C / D | Depo A / C | Hangar doluluğu |
| --- | --- | --- | --- |
| Core/üretici 12, D raf. 4, Kasa 2 | yaklaşık 1.276 / 638 / 11 | 49.257 / 24.629 | T3 sonunda 156/180 |
| Core/üretici 14, D raf. 6, Kasa 3 | yaklaşık 1.746 / 873 / 17 | 80.891 / 40.445 | İlk T4 sonunda 268/470 |
| Core/üretici 16, D raf. 8, Kasa 3 | yaklaşık 2.300 / 1.150 / 24 | 106.535 / 53.267 | 604/810 |
| Core/üretici 18, D raf. 12, Kasa 3 | yaklaşık 2.940 / 1.470 / 40 | 136.178 / 68.089 | 1.276/1.550 |

Bütün siparişler gerçek sunucu tarafından kabul edildi ve mevcut bankadan ödendi. Sentez tamamlanmadan sonraki Döteryum Rafinerisi seviyesine geçilmedi; geçici `RESEARCH_CEILING`/kuyruk beklemelerinden sonra rota devam etti.

Son filonun savaş gemilerinin yaklaşık %80'inin ve bir Kuryenin 1.000 birim uzaklığa gidiş-dönüş yakıt örneği **798 D**. Saatlik yaklaşık 40 D, günde yaklaşık 960 D eder: böyle bir seferin günlük yakıtı üretimle karşılanabilir; her gün iki böyle sefer pasif yakıtla karşılanamaz. Gerçek kanat, uzaklık, tamir/gemi üretimi ve yakıt rezervi her kalkışta yeniden kontrol edilmelidir. Ganimet bunu iyileştirebilir, fakat garanti sayılmamıştır.

## Oturum ve kesinti sonucu

- **Günde tek saat** ile mevcut 30 günlük tempoda ilk T4 21,04 güne kaldı; 30 gün dolarken 12/12/8 hedefi tamamlanmadı. Bu bir simülasyon hatası değil, yetersiz tur ve toplama sıklığının sonucu olarak raporlandı.
- Yavaş tempoda bir günün bütün oturumları atlandığında ödülsüz rota yeniden devam etti: Core 12 5,26; ilk T3 8,25; ilk T4 13,54; 12/12/8 20,25; 30/30/20 29,25 gün.
- Canlı `botAwakeTarget` oyuncu çevrimiçiliğine bağlıdır ve bu üç oturumu garanti etmez. Guard uygulamasının parçası olarak mevcut oturum mekanizmasından düzenli asgari tur payı ayrılmalıdır. Bu yapılmadan ölçülen takvim canlı için vaat edilmemelidir.

## Uygulama için gereken küçük paket

1. İki guard adayı için bu sıralı hedefleri mevcut bot servis çağrılarına bağlamak. Yeni dövüş motoru, koloni AI'sı veya görev altyapısı gerekmiyor.
2. Hak edilmiş normal gelişim ödüllerini bir kez almak; ödül için gereksiz eylem üretmemek.
3. Her harcamadan sonraki gerçek bakiyeyle devam etmek; pahalı hedefi sürekli ucuz siparişle ertelememek.
4. Gemi hedeflerini toplam sahiplik ve kuyrukla saymak; üst kademeye geçtikten sonra kayıp nedeniyle eski Viper/T3 paketini baştan doldurmamak. Onarım ve mevcut kademenin yenilenmesi öncelikli olmalı. Kayıp altında bu davranışın ayrıca servis regresyonu gerekir; bu ölçümde muharebe kaybı yoktur.
5. Guardlara düzenli oturum payı ayırmak; mevcut gece sessizliğini korumak. Mevcut sabit Core 16 / filo 260.000 frenlerini guardların bu rotasına uygulamamak.
6. Hedef, eksik kaynak, beklenen ön koşul ve kapasite bekleme nedenlerini özel operasyon kayıtlarında saymak. Oyuncuya yeni bot etiketi veya özel güç göstergesi eklememek.

Yoğun Yakıt Hücreleri/İtki ve Gravitik araştırmalar temel rotanın zorunlu kapısı yapılmadı. Bunların keşfi gerçek oyun olaylarına bağlıdır; açılmayan keşfi beklemek ana rotayı kilitlememelidir. Mevcut madencilik/korsan/keşif fırsatları rotayla birlikte normal kurallarla kullanılabilir.

## Kanıt ve tekrar çalıştırma

Hedefli testler **7/7 geçti**. Kaydedilmiş yedi senaryoda **734 ücretli sipariş** kontrol edildi: bütün bedeller sipariş öncesi banka ve depo kapasitesine sığdı, toplamlar harcama kaydıyla eşleşti, bakiyeler negatif olmadı ve beklenmeyen servis hatası çıkmadı. Ödüllü yavaş tempo rotası normal gelişimden bir kez **11.372 A / 5.575 C** aldı; ekstra D veya başka gelir verilmedi. Değişen araçlar için lint geçti.

- [Kaynak hash'leri ve bütün senaryoların özeti](evidence/bot-guard-route-manifest-2026-10-27.json)
- [Rota ve hedef hesabı](../tools/bot-guard-route.mjs)
- [Gerçek servis tekrar aracı](../tools/bot-guard-route-study.mjs)
- [Bağımlılık, kapasite, ödeme ve ödül testleri](../tools/bot-guard-route.test.mjs)
- [Mevcut tempoda üç aday](evidence/bot-guard-route-current-2026-10-27.json)
- [Yavaş tempo, ödülsüz ve Core 18 uzantısı](evidence/bot-guard-route-next-tempo-2026-10-27.json)
- [Seçilen ödüllü yavaş tempo](evidence/bot-guard-route-earned-rewards-next-2026-10-27.json)
- [Günde tek oturumun sonucu](evidence/bot-guard-route-sparse-2026-10-27.json)
- [Bir gün oturum kaybı](evidence/bot-guard-route-missed-day-2026-10-27.json)

Araç yalnız `localhost/127.0.0.1:5433/astera_guard_route_test` adresine izin verir; tablolarını temizler. Geliştirme veya prod veritabanına yönlendirilmez. Yerel test DB bir kez oluşturulduktan sonra:

```bash
nice -n 10 env ASTERA_INCLUDE_LONG_TESTS=1 NODE_OPTIONS=--max-old-space-size=4096 \
  pnpm exec vitest run tools/bot-guard-route.test.mjs \
  --maxWorkers=1 --minWorkers=1 --no-file-parallelism

nice -n 10 env ASTERA_INCLUDE_LONG_TESTS=1 GUARD_ROUTE_VARIANTS=balanced,early-engineering,early-robots \
  NODE_OPTIONS=--max-old-space-size=4096 pnpm exec tsx tools/bot-guard-route-study.mjs
```

Yavaş tempo denemesinde `packages/rules/src` `.dev/bot-guard-route-study-20261027/rules` içine kopyalandı. Yalnız kopyada `producerOutput ×0,85`, `producerCapacityTime ÷0,85`, `buildTime ×1,15`, `FLEET_SPEED_FACTOR ×0,90`, `seasonDays=60` ve evre payları `1/7,2/7,3/7` yapıldı; `progressionDays=30` korundu. TSX paths, **bütün sunucu servislerinin** `@astera/rules` importunu bu kopyaya yönlendirdi. `GUARD_ROUTE_RULES` de aynı kopyanın `index.ts` dosyasını seçti. Güncel kaynakta üretim/hız/süre ayarı değiştirilmedi.

Seviye 1–20 ve Kasa 0–20 üzerinde çıktı ×0,85, yapı süresi ×1,15, korunan depo miktarları ve değişmeyen Mühendislik 2 bedeli ayrıca kontrol edildi. Bu kopya tempo duyarlılığı denemesidir; diğer gelecek sezon değişikliklerinin testini yerine geçmez.
