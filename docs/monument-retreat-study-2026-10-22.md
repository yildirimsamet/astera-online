# Anıt / yaralı gemi kaçışı incelemesi — 22 Ekim 2026

## Son onaylanan model

Bu çalışma yalnız simülasyondur; oyun kodu ve deploy değiştirilmedi. Aşağıdaki
son karar, raporda ayrıca ölçülen önceki sabit %50 modelinin yerini alır.

- Kişisel gemi kalkanı yok. Normal araştırmalı can/atak ve sınıf karşılıkları var.
- Savaş en fazla üç tur; iki tarafın tur başındaki ateş hakkı korunur.
- Atış sırası ve hedefler rastgele; önce savaş gemileri hedef olur. Bir turda
  savunma hattı tükenirse o turun kalan atışları kargoya gider. Bir atışın fazla
  hasarı başka gemiye taşınmaz; sonraki kullanılmamış atışlar yeni hedef seçer.
- Can yenilenmez. Ölen gemi kaçamaz. Kaçan gemi sonraki turlara katılmaz,
  kaçtığı andaki canını korur ve savaş çıkışındaki fiziksel sağ kalmaya dahildir.
- Kaçış yalnız birinci ve ikinci tur sonunda, **HP ≤ maksimum HP'nin %30'u** için.
- Oran savaş başlangıcında mevcut `combatValue` ile sabitlenir; ateş etmeyen kargo
  bu hesaba girmez. Bu ölçü oyunun mevcut silahlı filo kaynak değeri ölçüsüdür;
  ayrı bir araştırma/yaralı HP çarpanı eklenmez. Çatışmadaki gerçek HP/atak ise
  araştırmayı ve gelişteki hasarı normal biçimde kullanır.

| Başlangıç güç farkı (büyük / küçük) | Güçsüz tarafın kaçışı | Güçlü tarafın kaçışı |
| --- | --- | --- |
| Tam eşit | %25 | %25 |
| 1'den büyük, 1.5'ten küçük | %25 | %25 |
| 1.5 dahil, 3'ten küçük | %50 | %25 |
| 3 ve üzeri | %75 | %25 |

Şans her uygun canlı gemiye bağımsız uygulanır; ilk tur kaçamayan, ikinci turu
sağ geçer ve eşikte kalırsa yeniden dener. %75 bir filonun %75'inin kurtulacağı
anlamına gelmez: bu şans yalnız turu sağ tamamlayan yeterince yaralı gemilerindir.
Kargoların ateş gücü sıfırdır; iki tarafta sadece kargo varsa çatışma başlamaz ve
savunan kontrolü korur. Kontrol kaçanlar hariç aktif filo ile belirlenir; kazananın
kaçanları kendi filosuna, kaybedenin kaçanları dönüş filosuna katılacak şekilde
fiziksel sağ kalmaya dahil sayılır. İki aktif savaş gücü de yok olursa EMPTY /
cargo kontrol kuralları uygulanır.

## İlk karşılaştırmanın kapsamı

İlk karşılaştırma isteği: önce mevcut anıt şikâyetlerini doğrula, sonra kişisel gemi kalkanı
olmadan tur sonunda HP'si en fazla %30 olan her canlı gemiye bağımsız %50 kaçış
şansı vererek simüle et. Oyun kodu, canlı veri ve deploy değişmeyecek.

- Oranlar 1:1, 1:1.5, 1:2, 1:2.5, 1:3. Büyük taraf saldıran; ters yön de kontrol.
- Aynı gemi oranı güç oranını temsil eder. Farklı kompozisyonlarda oran üretim
  kaynak bütçesidir; bunun aynı savaş gücü anlamına gelmediği sonuçlarda belirtilir.
- Owner açıklaması: savaş 3 tur kalır; kaçış yalnız 1. ve 2. tur sonunda yapılır.
  Ek 100 tur kontrolü yalnız tur sınırının etkisini ayıran teşhis deneyidir;
  ürün önerisi veya geliştirme değildir. Bu kontrolde de kaçış sadece ilk iki turdur.
- İki taraf aynı turda ateş eder; ölen gemi kaçamaz; kaçan sonraki tur ateş edemez,
  hedef olamaz. Kaçanlar sonuç için saf dışıdır, fiziksel olarak hayattadır.
- Üçüncü tur sonunda kaçış yoktur. İki aktif taraf da biterse EMPTY olur;
  savunanın kaçanlarının anıta dönmesi yalnız DEFENDER sonucunda düşünülür.
- Kazananın kaçanları kendi filosuna döner; kaybedenin kaçanları eve döner.
  Fiziksel iade / yol / radyasyon / tamir / Dominion entegrasyonu bu simülasyonda
  uygulanmaz. Sağ kalma savaş çıkışındaki durumdur, eve varış garantisi değildir.
- Eşik araştırmalı maksimum HP'ye göre hesaplanır; başlangıç radyasyon yaraları
  korunur. Gezegen Aegis'i ve savaş öncesi 3× filo kaçışı ana matriste yoktur.
- Tek süreç, tek worker; Docker 1 CPU / toplam 2 GiB sert bellek sınırı,
  Node heap 1536 MiB; ağ ve DB bağlantısı yok. Testler sırayla çalışır.

## Etkilenen yerler / test planı

Yalnız yeni `tools/monument-retreat-simulation*.mjs`,
`tools/monument-random-target-model.mjs` ve bu rapor/evidence.
Son oran politikası ayrıca `tools/monument-escape-policy.mjs` dosyasında.
Gerçek resolver'ın geçici kopyası kullanılır; kaynak SHA-256 kaydedilir. Hasar,
counter, araştırma, hedefleme ve eşzamanlı atış hesapları korunur. Sadece anıt
resolver'ının tur sonuna kaçış kancası ve çalışma kopyasına tur sınırı eklenir.
Kancanın kapalı olduğu kopya gerçek resolver ile birebir karşılaştırılır.

Önce test: %30 dahil, üstü hariç, ölüler hariç, bağımsız %50, yaralı grup +
sağlıklı kohortun kısmi hasarı, sahiplik, can/filo korunumu, eşzamanlı atış,
kaçanın sonraki turda yokluğu, EMPTY, deterministik tekrar, girişlerin değişmemesi.
Oyuncu örnekleri + farklı gemiler/katmanlar, küçük/büyük filolar, araştırma farkı,
radyasyon yarası, cargo ve uzun tur sınırı kontrolü raporlanır.

İnceleme riski: mevcut hedefleme toplam hasarı gemileri sırayla öldürmek için
kullanıyor; sağlıklı başlayan tek tip filoda bir turda genellikle yalnız bir
yaralı gemi kalıyor. %30/%50 kaçışın büyük filolarda az gemiyi kurtarması mümkün.
Bu varsayım sonuçlarla doğrulanacak, hedefleme sessizce değiştirilmeyecek.

Owner'ın sonraki isteğiyle ayrı rastgele hedef modeli eklendi: her silahlı gemi
her tur başında canlı düşmanlar arasından eşit olasılıkla tek hedef seçer. Eskort
varken yük gemileri korunur. Aynı turda ateş eşzamanlıdır; aynı hedefe fazla gelen
hasar başka gemiye aktarılmaz. Karşı sınıf çarpanı hedef seçildikten sonra uygulanır;
mevcut ±%8 taraf/tur atış çarpanı korunur. Can ne tur sonunda ne kaçışta yenilenir.
Bu model gerçek motorla yalnız 1v1'de aynı olmak zorundadır; çoklu gemilerde
hedefleme ve fazla hasarın boşa gitmesi bilinçli olarak farklıdır.

Testte canlı HULLS verisinin kaynak literalinden farklı olduğu da kontrol edildi:
`profileHull` dönüşümünden sonra araştırmasız Korsan **408 atak / 1508 HP**.
Simülasyon tüm gemilerde bu çalışma zamanı değerlerini kullanır.

Sonraki owner isteği: kargo sıralamada en son hedef; savaş gemileri aynı tur içinde
tükenirse kalan atışlar kargoya geçer. Bunun için `random_live` karşılaştırması
ayrıdır. Her taraf tur başında ateş edebilen gemilerini belirler, atış sırasını
karıştırır, her atışta o tarafın önceki atışlarıyla ölmüş hedefleri havuzdan çıkarır.
Tek atışın fazla hasarı taşınmaz. Karşı tarafın tur başındaki ateş hakkı korunur;
gerçek HP iki tarafın atışlarından sonra birlikte düşülür. Bu yöntem ilk ateş eden
tarafa bedava avantaj vermez. Kargo-kargo durumunda ateş eden yoktur: savaş/kaçış
turu üretilmez ve savunan tutar. `combatValue` zaten saldırısı sıfır gemileri güç
karşılaştırmasından çıkarır; kargo sağ kalması ve savaş gemisi sağ kalması ayrı ölçülür.

## Canlı şikâyetlerin doğrulanması

Canlı Postgres yalnız `default_transaction_read_only=on` ve 10 saniye sorgu sınırı
ile okundu. İncelenen savaş kaynakları release `527e6ca8` ile aynı; canlı veri
değiştirilmedi. Ekrandaki caLvin adlı iki kaydı birebir eşleştiremedim; aşağıdaki
şikâyetlere uyan kayıtlar doğrudan savaş geçmişinden doğrulandı.

| Zaman (UTC, 22 Ekim) | Başlangıç | Savaş çıkışı | Kontrol |
| --- | --- | --- | --- |
| 05:49:02 | Saldıran 2 Korsan + 1 Argosy; savunan 1 Korsan + 1 Argosy | Her iki filo da eksiksiz | Savunan |
| 05:51:23 | Saldıran 5 Korsan + 1 Argosy; savunan 2 Korsan + 1 Argosy | Saldıran eksiksiz; savunanda 1 Korsan + 1 Argosy | Savunan |

İlk kayıtta saldıranın üç turdaki 3078 hasarının 2820'si kişisel kalkana gidiyor;
yalnız 258'i gövdeye ulaşıyor. Saldırana gelen 1470 hasarın tamamı kişisel kalkanda
kalıyor. Gövde hasarsız dönüş bu kayıtta hasarın uygulanmamasından kaynaklanmıyor.

İkinci kayıtta savunanın son Korsan'ı %14.41 canla hayatta. Saldıranın üç turda
aldığı 2356 hasar tamamen kalkanda. Anıt kazanılamaması ve gövde hasarsız dönüş
şikâyeti doğrulandı. Savunanda savaş gemisi kaldığı için kontrol değişmiyor.

Doğrulanan sebep: kişisel kalkan ek etkin can sağlıyor, savaş yine üç turda
bitiyor, savunanda tek savaş gemisi kalması kontrolü korumaya yetiyor. Her yeni
savaşta kişisel kalkanın tekrar tam başlaması art arda küçük saldırıların da
etkisini sınırlıyor. Savaş içi tur arası kalkan yenilenmesi bu kayıtların açıklaması
değil: mevcut kod yenilemiyor. Anıtlar savaş öncesi 3× gezegen filo kaçışını kullanmıyor.

Bildirim yalnız "Saldırı püskürtüldü" diyerek sebebi açıklamakta yetersiz kalıyor.
Geliştirmede tur sınırı ve kalan aktif savunma gemisi sayısı görünür olmalı.

## Çalıştırma ve doğrulama

Yeni simülasyon kodu TDD ile yazıldı. Şunlar sınandı: eşik ve olasılık sınırları,
ölünün kaçamaması, yaralı gruplar ve kohort hasarı, sahiplik, iki tarafın aynı turda
ateş etmesi, kaçanın sonraki tur ateş etmemesi/hedef olmaması, canın korunması,
üçüncü tur kaçış yasağı, cargo önceliği, aynı tur cargo'ya geçiş, cargo-only kontrolü,
rastgele atış sırası, JSON anahtar sırasının etkisizliği ve cargo'nun savaş gemisi
istatistiğini maskelememesi. CLI ayrıca ayrı süreçte smoke testinden geçirildi.

Kapalı kaçışla 128 gerçek motor karşılaştırması birebir geçti. Rastgele modelin
1v1 sonucu tüm 17 silahlı mobil geminin birbirine karşı, iki araştırma setinde,
sekiz seed ile 4624 savaşta orijinal motorla kontrol/can/kayıp açısından eşleşti.
10.000 seed'li bağımsız matematik kontrolü 3 Korsan'a karşı 1 Korsan'ın birinci tur
sonunda tek bir %50 kaçış fırsatı olduğunu doğruladı. Ayrıca 2 Pike / 2 Pike tek
tur kontrolünde iki bağımsız hedef seçiminin beklenen 1.5 ortalama imhası doğrulandı.

Her toplu simülasyonda iki taraf için başlangıç = ölen + kaçan + aktif kontrolü
çalışır. Sonuçlar seed'li ve tekrar üretilebilir. Ana tablo tüm ölenleri ortalamaya
sıfır olarak dahil eder; yalnız kurtulan savaşları seçmez.

Tekrar çalıştırma (ayrı ayrı; proje kökünde):

```sh
docker run --rm --network none --memory=2g --memory-swap=2g --cpus=1 \
  -e NODE_OPTIONS=--max-old-space-size=1536 -e UV_THREADPOOL_SIZE=1 \
  -v "$PWD:/study" -v "$PWD/packages/rules:/study/packages/rules:ro" -w /study \
  node:22-alpine nice -n 10 node --v8-pool-size=1 --import tsx \
  --test --test-concurrency=1 tools/monument-retreat-simulation.test.mjs
# Aynı Docker sınırlarıyla, test komutunun son iki satırı yerine:
# node:22-alpine nice -n 10 node --v8-pool-size=1 --import tsx tools/monument-retreat-simulation.mjs --run
# node:22-alpine nice -n 10 node --v8-pool-size=1 --import tsx tools/monument-retreat-simulation.mjs --run-live
# node:22-alpine nice -n 10 node --v8-pool-size=1 --import tsx tools/monument-retreat-simulation.mjs --run-ratio
```

## Sonuçlar — son onaylanan oran politikası

22 Ekim ek deney isteği: önceki tabloyu aynı seed'ler ve aynı filo/araştırma/
hedefleme/kaçış olasılıklarıyla tekrar ölç; değişen tek mekanik HP kaçış eşiği
%30 yerine %50. Bu bir simülasyon karşılaştırmasıdır, canlı değişiklik değildir.
Yeni çıktı ayrı dosyaya yazılacak; önceki %30 kanıtı korunacak. Tur 3'te kaçış
olmaması, %50 sınırının dahil olması, %50 üstünün hariç olması, ölülerin dahil
olmaması ve hasarın korunması kontrol edilecek. Kaynak hash'leri eski veriyle
eşleşmeden karşılaştırma yapılmayacak. Önceki tek CPU / toplam 2 GiB sınırı geçerli.

Toplam **1.274.368 savaş**: ilk karşılaştırma 770.560, tur içinde hedef değiştirme
347.136, son oran politikası 156.672. Yeni simülasyonun **31 testi ve dört araç
dosyasının lint'i geçti**. Tek simülasyon worker'ı / 1 CPU / toplam 2 GiB sert sınır
ile sıralı çalıştı. Kaydedilen en yüksek simülasyon RSS'si 230.3 MiB; son oran
taramasının RSS'si 201.9 MiB. Simülasyonların toplam çalışma süresi yaklaşık 13.2 dk.

Ana karşılaştırma dört tier × altı oluşum = **24 kompozisyon**: Raider, Striker,
Fortress, Escort, eşit Raider/Striker/Fortress ve 2 Raider/1 Striker/1 Escort.
Her hücre 128 seed. Tek tipte 2/10/100/1000 gemi, karışık filoda kompozisyon
ağırlığının bu katları kullanıldı. Oranlar aynı kompozisyonda tamdır. Aşağıdaki
ortalamalar kompozisyonlara eşit ağırlık verir; gerçek oyuncu filosu sıklığının
ortalaması veya bütün savaşlar için garanti değildir.

"Kalan" = aktif + kaçan savaş gemisi; sıfır kurtulan savaşlar ortalamaya dahildir.
"Silinme" = en az bir tarafın fiziksel savaş gemilerinin tamamının ölmesi;
kaçıp kurtulanlar ölü sayılmaz. 1:1'de taraflar eşit; diğerlerinde küçük taraf
savunandır. Tablo savaş çıkışıdır; dönüş yolunda radyasyon / tamir / yakıt / canlı
yerleşim ve iade entegrasyonu henüz yoktur.

### Büyük filolar, aynı kompozisyon

Tek tipte küçük tarafta 1000 gemi; karışık filoda 3000–4000 gemi. Her satır 3072 savaş.

| Oran (küçük:büyük) | Küçük tarafın en az bir gemi kurtarma ihtimali | Küçük tarafın ortalama kalan filosu | En az bir taraf tamamen silindi | Anıt saldırana geçti |
| --- | --- | --- | --- | --- |
| 1:1 | %83.6 | %44.5 | %16.7 | %0.2 |
| 1:1.5 | %81.8 | %13.3 | %18.2 | %83.3 |
| 1:2 | %77.9 | %7.6 | %22.1 | %100 |
| 1:2.5 | %77.9 | %6.0 | %22.1 | %100 |
| 1:3 | %48.8 | %6.3 | %51.2 | %100 |

1:1'de %83.3, 1:1.5'te %16.7 savaş üç tur sonunda her iki tarafta aktif gemi
ile bitti. Bunlarda savunan kontrolü korudu. Böyle bir sonuç fiziksel silinme
değildir; tabloda "kaybeden" yerine başlangıçtaki küçük/savunan taraf gösterilmesi
bu ayrımı korur. 1:2 ve üzerinde bu matriste aktif savunma temizlendi.

### 1:3'te filo büyüklüğü farkı

| Küçük tarafın kompozisyon çarpanı | Ortalama kurtulan filo | En az bir taraf tamamen silindi |
| --- | --- | --- |
| 2 | %10.0 | %81.7 |
| 10 | %7.8 | %58.7 |
| 100 | %6.4 | %52.5 |
| 1000 | %6.3 | %51.2 |

Küçük filoda bir geminin ölmesi/kurtulması büyük yüzde farkı yapıyor. Büyük filo
sonucunu 1–2 gemilik savaşa aynı olasılık gibi taşımamak gerekir.

### Farklı kompozisyonlar, eşit kaynak bütçesi

Her tier'da altı kompozisyonun birbirine karşı 36 çifti, küçük taraf için bir
milyon kaynak bütçesi, hücre başına 64 seed. Oran güç/üretim kaynak değeridir;
bu, karşı sınıf avantajına sahip iki farklı filonun eşit gerçek atış gücünde
olduğu anlamına gelmez. Gemiler tam sayıya yuvarlandığından politika gerçek
`combatValue` oranıyla seçildi; nominal 1:3 hücresi tam 3'ün biraz altında ise
zayıf taraf %50 kategorisinde kalır. Her hücrede gerçek güç ve seçilen iki şans kayıtlı.

| Nominal oran | Küçük tarafın ortalama kalan filosu | En az bir taraf tamamen silindi | Anıt saldırana geçti |
| --- | --- | --- | --- |
| 1:1 | %46.7 | %11.0 | %15.6 |
| 1:1.5 | %18.3 | %11.8 | %79.8 |
| 1:2 | %10.2 | %16.5 | %95.0 |
| 1:2.5 | %7.2 | %26.2 | %100'e yakın |
| 1:3 | %7.7 | %41.0 | %100 |

### Korsan ve anıt şikâyetleri

Araştırmasız çalışma zamanı değerleri, başlangıçta sağlıklı filolar; örnek başına
512 seed. Eşit güç/armor araştırma çarpanları ayrıca kontrol edildi. Bunlar canlı
oyuncuların geçmişteki araştırma ve başlangıç yaralarını birebir geri oynatma
iddiası değildir; canlı kayıtlar yukarıda ayrıca doğrulandı.

| Saldıran : savunan Korsan | Anıt ele geçirildi | Savunanın ortalama kurtulan Korsan'ı |
| --- | --- | --- |
| 1:1 | %0 | %100 |
| 2:1 | %100 | %0.2 |
| 3:1 | %100 | %74.0 |
| 5:2 | %100 | %15.2 |
| 4:1 | %100 | %1.8 |
| 5:1 | %100 | %0 |

2:1'de çoğu Korsan ilk turun sonunda %30'dan fazla cana sahip, ikinci tur ateşinde
ölüyor; kaçış penceresine ulaşamıyor. 3:1'de ilk tur genellikle %30 altına düşüp
hayatta kaldığı için %75 fırsatını kullanabiliyor. Daha güçlü 4:1 / 5:1 ateşi ise
onu ilk turda öldürebiliyor. Bu nedenle "güç farkı arttı → kurtulan oranı mutlaka
artar" sonucu çıkmaz. Ölüler tur sonu kaçışına katılmaz. Tekli Korsan 1:1'de
üç turu da sağ geçiriyor; eşik ancak üçüncü turda aşıldığından kaçış yok.

300 Korsan'a karşı 100 Korsan'da savunandan ortalama **16.5 Korsan** kurtuldu;
128 tekrarın hepsinde en az bir Korsan kurtuldu ve anıt saldırana geçti. İki
tarafta kargolar eklenen 512 tekrarlı kontrolde de sonuç yaklaşık **16.5 Korsan**.
Kargoların çokluğu güç kategorisini değiştirmedi. İki taraf yalnız kargoysa tüm
tekrarlarda savunan korudu; kargo tek başına anıtı ele geçirmedi.

### Değerlendirme

Shield'sız mevcut toplu/hedefe odaklanan hasara sadece kaçış eklemek büyük
filoları yeterince kurtarmıyor: ilk %50 modelinde 1:3 büyük filo ortalamasında
kalan zayıf filo yalnız %0.01 civarı. Rastgele hedef ve tur içi canlı hedef havuzu,
yaralı ama canlı gemiler üreterek asıl farkı yaratıyor. Son onaylanan politika
büyük filo 1:3 silinme sıklığını hedeflenen yaklaşık %50'ye getirdi; ortalama
kurtulan filo bütün kompozisyonlarda %10'a ulaşmadı (%6.3; bütçe matrisinde %7.7).

Gemi profili belirleyici. 1:3'te büyük saf Raider/Fortress filolarında kalan pay
yaklaşık %13–18; saf Striker filolarında %0. Bazı karışımlarda da %0'a yakın.
Yüksek hasarlı atış gemiyi kaçış kontrolünden önce öldürüyor. Kaçış olasılığını
yükseltmek bu gemiye kurtulma hakkı yaratmıyor. Son modelin bu sınırı saklanmamalı.

Bu aşamada oyun dosyaları, araştırmalar, Dominion/loot, iade işlemleri ve canlı
deploy değiştirilmedi. Kaçan gemiler sonuç hesabında saf dışıdır; fiziksel gemi
kaybı/enkaz veya imha edilmiş gemi puanı olarak sayılmaları bu simülasyonun yaptığı
bir şey değildir. Oyuna entegrasyonda bu ayrım ve gemi/hasar/yakıt sahipliği korunmalı.

Ham kanıtlar:

- [İlk karşılaştırma](evidence/monument-retreat-study-2026-10-22.json)
- [Tur içi canlı hedefler ve kargo](evidence/monument-retreat-live-targets-study-2026-10-22.json)
- [Son onaylanan oran politikası](evidence/monument-retreat-ratio-study-2026-10-22.json)

## Ek karşılaştırma — kaçış için HP eşiği %50

Owner'ın sonraki isteğiyle yalnız HP eşiği %30 → %50 olarak değiştirildi.
Güçsüz %25/%50/%75, güçlü %25; ilk iki tur kaçış; 3 tur savaş; rastgele canlı
hedefler ve aynı tur kargoya geçiş aynen korundu. Oyun kodu/canlı değişmedi.
Yeni deney 156.672 savaş, 101.1 saniye, en yüksek RSS 205.0 MiB; 1 CPU ve
toplam 2 GiB Docker sert sınırı altında. 33 test ve değişen araçların lint'i geçti.

Önceki %30 ile hücre sırası, hücre başına tekrar sayısı, seed, bütün filo/hasar/
araştırma girdileri, seçilen kaçış olasılıkları ve dokuz oyun kaynak dosyasının
hash'leri aynı. Oran politikası olan hücrelerde tek config farkı `threshold: 0.5`.
Karşılaştırma için tekrar edilen eski cargo kontrol hücreleri birebir aynı çıktı.
Sınır testleri %50'nin dahil olduğunu, %50 üstünün ve ölülerin hariç kaldığını,
kaçanın yarasının korunduğunu doğruladı; %30 varsayılanı değiştirilmedi.

Önceki ana tabloyla aynı 24 kompozisyon, küçük tarafın 1000 kompozisyon çarpanı,
hücre başına aynı 128 seed; her satır 3072 savaş. Küçük taraf savunan; 1:1'de
taraflar eşit. Kalan = aktif + kaçan savaş gemileri. Sıfırlar ortalamaya dahildir.

| Güç oranı | Ortalama kalan, HP ≤%30 | Ortalama kalan, HP ≤%50 | Bir taraf tamamen silindi, HP ≤%30 | Bir taraf tamamen silindi, HP ≤%50 |
| --- | --- | --- | --- | --- |
| 1:1 | %44.5 | %47.4 | %16.7 | %16.7 |
| 1:1.5 | %13.3 | %19.3 | %18.2 | %16.4 |
| 1:2 | %7.6 | %14.8 | %22.1 | %16.7 |
| 1:2.5 | %6.0 | %11.5 | %22.1 | %16.7 |
| 1:3 | %6.3 | %11.8 | %51.2 | %51.2 |

Bu matriste anıt ele geçirme 1:2 / 1:2.5 / 1:3'te iki eşikte de %100;
1:1.5'te %83.3; 1:1'de %0.2. Kurtulan oranı artarken 1:3 silinme oranının
aynı kalabilmesinin sebebi, bazı kompozisyonların tur sonu kaçışına gelmeden
ölmesi; kurtuluş fırsatı bulunan kompozisyonların ise daha fazla gemi kurtarması.
Bu iki istatistik birbirinden farklıdır. Ana 1:3 ortalaması önceki yaklaşık %50
silinme / yaklaşık %10 kalan hedefini bu örneklemde birlikte karşılıyor.

Farklı kompozisyonlar ve küçük taraf için bir milyon kaynak bütçesi matrisinde:

| Oran | Ortalama kalan %30 → %50 eşik | Tam silinme %30 → %50 eşik |
| --- | --- | --- |
| 1:1 | %46.7 → %48.7 | %11.0 → %10.1 |
| 1:1.5 | %18.3 → %23.2 | %11.8 → %9.4 |
| 1:2 | %10.2 → %16.2 | %16.5 → %14.6 |
| 1:2.5 | %7.2 → %12.3 | %26.2 → %24.5 |
| 1:3 | %7.7 → %12.2 | %41.0 → %40.8 |

Küçük filolar aynı yüzdeleri paylaşmaz: 1:3'te kompozisyon çarpanı 2 için
ortalama kalan %10.0 → %20.3, tam silinme %81.7 → %63.5; çarpan 10 için
%7.8 → %13.7, tam silinme %58.7 → %54.9. Büyük filo tablo ortalaması bütün
kompozisyonlar veya her filo büyüklüğü için garanti değildir.

Korsan kontrol örnekleri: sağlıklı 2:1'de savunanın ortalama kurtuluşu %0.2 →
%51.6; 5:2'de %15.2 → %29.7; anıt iki örnekte de bütün 512 tekrarda saldırana
geçti. 300 Korsan'a karşı 100 Korsan'da kurtulan yaklaşık 16.5 → 30.2 Korsan.
1v1 Korsan'da fiziksel olarak iki gemi de bütün tekrarlarda kurtuluyor, fakat
%50 eşiğinde ikinci tur sonunda çekilme mümkün olduğundan kontrol de değişebiliyor:
saldıranın alma oranı %0 → %18.6. %30'da eşik ancak üçüncü turda aşılınca kaçış
olmadığından savunan koruyordu. Daha erken kaçışın kontrolü etkilemesi modelin
bilinçli sonucudur; ücretsiz iyileşme yoktur.

[HP %50 ham kanıtı](evidence/monument-retreat-ratio-hp50-study-2026-10-22.json).
Tekrar çalıştırma: yukarıdaki Docker sınırlarıyla
`tools/monument-retreat-simulation.mjs --run-ratio --threshold-50`.

## Ek deney planı — maksimum HP'nin %25'i kadar kişisel kalkan

Owner isteği: son %50 HP kaçış eşiğiyle aynı filolar/seed'ler üzerinde, her mobil
geminin araştırmalı maksimum HP'sinin %25'i kadar kalkanı olsun. Kalkan savaş
başında dolu, tur aralarında yenilenmez; ilk gelen hasar kalkandan düşer, fazlası
gövdeye gider. HP kaçış eşiğinde kalkan dikkate alınmaz. Radyasyon geliş yaraları
gövdede kalır; maksimum değil mevcut HP'ye göre kalkan küçültülmez. Kalkan
araştırması bu sabit %25 deneye ek çarpan vermez. Kargo da %25 alır ama güç
hesabına girmez. Ground bu mobil filo matrisinde yoktur. Ölen gövdeyi kalan
kalkan yaşatamaz. Diğer bütün kurallar ve tek CPU / 2 GiB sert sınırı aynı.

Yalnız simülasyon modeli, CLI ve testleri değişecek; oyun/canlı veri değişmeyecek.
Önce test: tam %25 kapasite, önce kalkan sonra HP, tur arası yenilenmeme,
hedef havuzundan çıkarma sınırının HP+kalkan olması, eşzamanlı ateş, gövdeye göre
kaçış, araştırmalı maksimum HP, yaralı giriş ve sıfır kalkanla eski sonuçlar.
%50 kalkansız veri korunacak; yeni çıktı ayrı dosyaya yazılacak.

### %25 kalkan deneyinin sonuçları

Son owner açıklaması ayrı kalkan modelini doğruladı: **100 gövde + 25 kalkan**;
kaçış gövde ≤50 olunca mümkün. 125 maksimum gövde / 62.5 kaçış sınırı kullanılmadı.
Modelde hiçbir geminin gövde maksimumu değiştirilmedi. Kalkan kapasitesi araştırmalı
maksimum HP ×0.25; radyasyonun bıraktığı başlangıç yarası iyileşmiyor. Her iki
tarafın kalkanları aynı kuralla ve savaş başında tam başlıyor.

156.672 savaş, aynı hücreler/seed'ler ve filo/hasar/araştırma girdileriyle 121.5
saniyede çalıştı; tepe simülasyon RSS 212.2 MiB. Tek CPU ve toplam 2 GiB sert sınır
korundu. 39 test ve değişen üç araç dosyasının lint'i geçti. Dokuz oyun kaynak
hash'i önceki koşuyla aynı; oran politikası hücrelerinde tek config farkı
`shieldFraction: 0.25`. Kontrol amacıyla tekrar edilen kalkansız cargo hücreleri
birebir aynı. Ayrıca kalkanı sıfırlayan yeni modelle önceki ana tablonun bütün
24 kompozisyon × 5 oran × 128 seed = 15.360 savaşı yeniden oynatıldı; tüm
özet metrikleri kalkan kodu eklenmeden önceki JSON ile birebir eşleşti.

Önceki ana tabloyla aynı büyük, aynı kompozisyondaki filolar; her satır 3072 savaş.
Kaçış eşiği iki koşuda da gövde HP ≤%50, güçlü taraf %25, güçsüz %25/%50/%75;
kaçış yalnız 1. ve 2. tur sonu. Kalan = aktif + kaçan savaş gemileri, sıfır
kurtulanlar ortalamaya dahil. Bir tarafın tamamen silinmesi, o tarafta kaçan dahil
hiçbir savaş gemisinin fiziksel olarak hayatta kalmaması demek.

| Güç oranı | Ortalama kalan, kalkansız | Ortalama kalan, %25 kalkan | Tam silinme, kalkansız | Tam silinme, %25 kalkan |
| --- | --- | --- | --- | --- |
| 1:1 | %47.4 | %62.2 | %16.7 | %0 |
| 1:1.5 | %19.3 | %29.2 | %16.4 | %0 |
| 1:2 | %14.8 | %14.7 | %16.7 | %16.7 |
| 1:2.5 | %11.5 | %12.9 | %16.7 | %16.7 |
| 1:3 | %11.8 | %16.0 | %51.2 | %16.7 |

Owner'ın 1:2.5'te %12.9 iken 1:3'te %16.0 olmasını sormasının açıklaması:
güçsüz tarafın uygun yaralı gemi başına kaçış şansı 1:2.5'te %50, tam 1:3'te
%75. Bu basamak, güç arttıkça kurtulan oranının sürekli düşmesini gerektirmiyor.
Daha yüksek düşman ateşi ile daha yüksek kaçış şansı birlikte değişiyor;
burada yüksek kaçış şansı daha çok gemiyi kurtarıyor. Her iki satırda eşik
gövde HP ≤%50 ve güçlü tarafın şansı %25 olarak aynı kalıyor.

Kalkanla 1:3'te yalnız dört saf Striker kompozisyonu tamamen siliniyor; diğer 20
kompozisyonda her tekrarda en az bir savaş gemisi kurtuldu. Dört Striker / 24
eşit ağırlıklı kompozisyon, bu matriste görülen %16.7'yi açıklıyor. Bu, canlı
oyuncu kompozisyonlarının ölçülmüş sıklığı değildir; her savaşa garanti vermez.
1:2'de daha fazla dayanıklılık her durumda daha fazla kurtuluş üretmiyor:
kaçış eşiğine hangi turda girildiği ve sonraki atışlar da değişiyor.

### Anıt ele geçirme etkisi

| Güç oranı | Kalkansız ele geçirme | %25 kalkanla ele geçirme | Kalkanlı, iki taraf aktifken 3 tur doldu |
| --- | --- | --- | --- |
| 1:1 | %0.2 | %0 | %100 |
| 1:1.5 | %83.3 | %66.7 | %33.3 |
| 1:2 | %100 | %96.5 | %3.5 |
| 1:2.5 | %100 | %100 | %0 |
| 1:3 | %100 | %100 | %0 |

Filo sağ kalması belirgin iyileşiyor; ancak üç tur sonunda aktif savunma kalması
da artıyor. 1:2'de bitmeyen büyük filo hücreleri Fortress mirror: T2 Stronghold
%7.0, T3 Leviathan %24.2, T4 Citadel %52.3. Bu özel karşılaşmalardaki anıtı
alamama oranı, tüm kompozisyonların %3.5 ortalamasından daha yüksek.

Sağlıklı Korsan kontrolünde 2:1 ve 5:2 yine bütün 512 tekrarda anıtı aldı.
Savunanın ortalama kurtulan payı sırasıyla %52.5 ve %24.3. 100 savunan / 300
saldıran Korsan'da yaklaşık 30.0 gemi kurtuldu ve anıt bütün tekrarlarda saldırana
geçti (kalkansız yaklaşık 30.2). Kargolu 2:1 ve 5:2 kontrolü de bütün tekrarlarda
ele geçirildi; cargo-only savunan kontrolü tuttu.

Farklı kompozisyonlar ve küçük taraf için bir milyon kaynak bütçesi matrisinde:

| Nominal oran | Ortalama kalan, kalkansız → %25 kalkan | Tam silinme, kalkansız → %25 kalkan | Kalkanla anıt ele geçirme |
| --- | --- | --- | --- |
| 1:1 | %48.7 → %60.3 | %10.1 → %2.1 | %10.5 |
| 1:1.5 | %23.2 → %30.2 | %9.4 → %1.6 | %63.6 |
| 1:2 | %16.2 → %18.5 | %14.6 → %6.7 | %93.7 |
| 1:2.5 | %12.3 → %13.5 | %24.5 → %13.9 | %97.2 |
| 1:3 | %12.2 → %16.3 | %40.8 → %20.4 | %99.97 |

Gemi miktarının etkisi de sürüyor: 1:3 ve kompozisyon çarpanı 2'de kalan %20.3 →
%22.5, tam silinme %63.5 → %49.2. Çarpan 10'da kalan %13.7 → %17.7, silinme
%54.9 → %19.3. Büyük filo tablosu küçük filolara doğrudan genellenmemeli.

Bu deneyde %25 kalkan, önceki yaklaşık %50 silinme hedefinin epey altına iniyor;
oyuncu filosunu daha çok korurken 1:1–1:2 aralığında anıt savunmasını uzatıyor.
Oyun koduna/canlıya uygulanmadı. Sonuç tek başına kalkan eklensin kararı değildir.

[HP %50 + %25 kalkan ham kanıtı](evidence/monument-retreat-ratio-hp50-shield25-study-2026-10-22.json).
Tekrar çalıştırma: yukarıdaki Docker sınırlarıyla
`tools/monument-retreat-simulation.mjs --run-ratio --threshold-50 --shield-25`.

## Ek deney planı — %25 temel kalkan, iki taraf da kalkan araştırması L4

Owner isteği: %25 temel kalkanla iki oyuncu da SHIP_SHIELDS L4 olduğunda
1:1 / 1:1.5 / 1:2 / 1:3 oranlarını ölç. Mevcut `shipShieldMult` fonksiyonu L4'te
2 verir; araştırmalı maksimum gövde HP ×0.25×2 = gövde HP'nin %50'si kadar
kalkan. Hull HP/atak araştırması ve geliş yaraları aynı; gövde kaçış eşiği %50,
kaçış yalnız 1. ve 2. tur sonu, güçlü %25 ve güçsüz %25/%50/%75. Can/kalkan
yenilenmez. Güç oranından kargo hariç; aynı turda savaş hattı tükenince kalan
atışlar kargoya geçer. Ana matris sağlıklı başlar; yaralı girişler ayrıca kontrol.

Yalnız simülasyon kodu, test ve bu rapor değişecek. Önce test: L0–L4
çarpanları, yeni taban %25'in L4'te %50 olması (gövdenin %200'ü olmaması), iki
tarafın ayrı araştırması, kapasitenin maksimum HP üzerinden hesaplanması ve eski
sabit kalkan deneyinin araştırmayı ek çarpan olarak kullanmadan aynen kalması.
Tek CPU / toplam 2 GiB sert sınırı ve ayrı evidence dosyası korunacak.

### İki taraf L4 sonuçları

Temel %25 × mevcut `shipShieldMult({ SHIP_SHIELDS: 4 })=2` = **maksimum gövde
HP'nin %50'si kadar ayrı kalkan**. 100 gövde +50 kalkan; kaçış gövde ≤50.
Kalkan araştırması gövdeyi veya ateş gücünü değiştirmedi. Diğer araştırmalar
önceki deneydeki gibi; bu çalışma bütün araştırmaları L4 yapma deneyi değildir.

141.312 savaş, 131.0 saniye, tepe RSS 217.1 MiB; tek CPU / toplam 2 GiB sınırı.
43 test ve değişen üç araç dosyasının lint'i geçti. Kaynak hash'leri, seed'ler,
başlangıç yaraları, filolar, kaçış eşikleri ve şansları önceki deneyle eşleşti.
Tek fark oran politikası hücrelerinde her iki oyuncuya SHIP_SHIELDS L4 atanması
ve kalkan kapasitesine mevcut araştırma çarpanının eklenmesi. Gemi ve hasar
korunumu her savaşta kontrol edildi. Kontrol amaçlı eski cargo hücreleri aynı.
Önceki deneyde yinelenen L0/L4 Korsan örnekleri bu kez yalnız L4 ile çalıştırıldı;
bu nedenle toplam örnek sayısı 156.672 yerine 141.312.

Ana matris dört tier × altı kompozisyon, küçük taraf kompozisyon çarpanı 1000,
hücre başına aynı 128 seed. Her satır 3072 savaş; sağlıklı başlangıç, toplam üç
tur, kaçış yalnız ilk iki tur sonunda. Kalan = aktif + kaçan savaş gemileri,
ölü savaşlar sıfır olarak ortalamaya dahil. 1:1'de eşit olan savunan taraf
gösterilir; diğer oranlarda küçük taraf savunandır. Kargo sağ kalması bu savaş
gemisi istatistiğine katılmaz; kaçan savaş gemisi canlıdır.

| Oran | Küçük/savunan tarafın ortalama kalan filosu | En az bir taraf tamamen silindi | Anıt saldırana geçti | İki taraf aktifken üç tur doldu |
| --- | --- | --- | --- | --- |
| 1:1 | %70.8 | %0 | %0.2 | %99.4 |
| 1:1.5 | %40.5 | %0.3 | %44.1 | %55.9 |
| 1:2 | %22.4 | %16.7 | %83.3 | %16.7 |
| 1:2.5 | %13.9 | %16.7 | %98.4 | %1.6 |
| 1:3 | %18.7 | %16.7 | %100 | %0 |

1:2.5 → 1:3'te kalan payın yine yükselmesi, güçsüz taraftaki uygun gemilerin
kaçış şansının %50 → %75 basamağından kaynaklanır; daha çok düşman ateşi ve
daha yüksek kaçış şansı aynı anda değişir.

Önceki araştırmasız sabit %25 kalkanla karşılaştırma:

| Oran | Ortalama kalan L0 → L4 | Anıt ele geçirme L0 → L4 |
| --- | --- | --- |
| 1:1 | %62.2 → %70.8 | %0 → %0.2 |
| 1:1.5 | %29.2 → %40.5 | %66.7 → %44.1 |
| 1:2 | %14.7 → %22.4 | %96.5 → %83.3 |
| 1:3 | %16.0 → %18.7 | %100 → %100 |

Buradaki korunmanın bir kısmı kaçıştan, bir kısmı üç turun sonunda hâlâ aktif
gemiler bulunmasından geliyor. Örneğin 1:2 saf Fortress vs Fortress büyük
filolarında dört tier'ın hepsinde savunan bütün tekrarlarda aktif gemiyle
kaldı ve anıt alınamadı. %22.4 kalan payı yalnız kaybeden/geri dönen filonun
ortalaması diye yorumlamak yanlış olur. Üç tur sınırı ve yüksek kalkan birlikte
anıt savunmasını uzatıyor. Korsan özelinde sağlıklı 2:1 ve 5:2 ise bütün 512
tekrarda anıtı aldı; bunlar bütün gemi türlerine genellenmemeli.

Farklı kompozisyonlar / aynı kaynak bütçesi matrisinde L4:

| Nominal oran | Küçük taraf ortalama kalan | En az bir taraf silindi | Anıt ele geçirme |
| --- | --- | --- | --- |
| 1:1 | %67.2 | %8.3 | %8.4 |
| 1:1.5 | %38.6 | %4.6 | %44.5 |
| 1:2 | %21.8 | %7.3 | %85.5 |
| 1:3 | %16.9 | %18.8 | %97.3 |

Bu tablo aynı kompozisyon tablosundan farklıdır: karşı sınıf üstünlüğü, kaynak
bütçesinden yuvarlanan gerçek gemi sayıları ve gerçek güç oranı farklıdır.
Oran politikasının kademesi her hücrenin gerçek kargosuz `combatValue` oranıyla
hesaplandı. Sonuçlar gerçek oyuncu kompozisyonlarının sıklık ortalaması değildir.

Küçük filo farkı: L4, 1:3 ve kompozisyon çarpanı 2 için ortalama kalan %25.2,
tam silinme %43.7; çarpan 10 için %20.1 ve %18.8. Büyük filo yüzdeleri her
küçük savaşa taşınmamalı.

Sağlıklı tekli Korsan'da L4 3:1 ilginç bir sınır oluşturuyor: ilk turdan sonra
gövde hâlâ %50 üstünde olduğu için kaçış yok, ikinci turda ise çoğunlukla ölüyor.
Bu yüzden savunanın kurtuluşu L0'daki %72.3 yerine bu seed'lerde yaklaşık %0.2.
Bağımsız 1000 seed'li matematik kontrolü, iki tur hasarını ve yalnız hayatta
kaldığında %75 kaçış zarını hesaplayarak bu sonucu doğruladı. Daha fazla kalkan
her gemi/filo boyutunda daha fazla fiziksel kurtuluş garantilemez; tur sonu
kaçış penceresini de değiştirir. Büyük 300 Korsan vs100 Korsan'da ise L4'te
ortalama yaklaşık 20.6 Korsan kurtuldu ve anıt bütün tekrarlarda alındı.

[İki taraf L4 ham kanıtı](evidence/monument-retreat-ratio-hp50-shield25-l4-study-2026-10-22.json).
Tekrar çalıştırma: yukarıdaki Docker sınırlarıyla
`tools/monument-retreat-simulation.mjs --run-ratio --threshold-50 --shield-25 --shield-research-4`.
Bu deneyde de oyun kodu, canlı veri ve deploy değiştirilmedi.

## Yeni deney planı — taraf başına ayrı kaçış eşiği ve şansı

Owner'ın son isteği ve 1:1 düzeltmesi: mobil gemilerde araştırma artışı olmayan
%25 sabit kalkan, yine en fazla üç tur; kaçış sadece 1. ve 2. tur sonunda.
Gövde/kalkan yenilenmez, kargo güçten hariç ve son hedef. Oran başlangıçtaki
`combatValue` ile sabit; büyük taraf saldıran, ters yön ayrıca kontrol.

| Gerçek büyük/küçük güç oranı | Güçsüz şans / HP eşiği | Güçlü şans / HP eşiği |
| --- | --- | --- |
| 1 dahil, 1.5'ten küçük | %25 / ≤%25 | %25 / ≤%25 |
| 1.5 dahil, 2'den küçük | %33 / ≤%30 | %20 / ≤%30 |
| 2 dahil, 3'ten küçük | %50 / ≤%50 | %15 / ≤%30 |
| 3 ve üzeri | %75 / ≤%70 | %10 / ≤%25 |

1:2.5, 1:2 kademesinde. %33, tam 0.33 olarak alınır (1/3 değil).
Şanslar her uygun canlı gemiye bağımsız; ölüler kaçamaz ve kaçan sonraki
turlara katılamaz. Kontrol aktif filoyla, fiziksel kurtuluş aktif + kaçanla
ölçülür. Savaş gemisi ve kargo sağ kalması ayrı; sıfırlar ortalamaya dahil.

Yalnız araç/politika/test ve rapor değişecek; oyun/canlı/deploy değişmeyecek.
Önce test: tüm kademe sınırları, güç yönü, kargo/boş güç, farklı taraf HP
eşikleri, eşikteki geminin dahil olması, üçüncü turda kaçış olmaması, yaraların
korunması; eski politika ve %25 sabit kalkan çıktıları aynı kalmalı. Aynı
matris ve seed'lerle ayrı JSON; tek CPU / toplam 2 GiB sert sınır.

### Yeni taraf eşikleriyle sonuçlar ve kod incelemesi

156.672 savaş, 125.6 saniye, tepe RSS 212.5 MiB; tek CPU / toplam 2 GiB
sert sınır. **49 test ve değişen dört araç dosyasının lint'i geçti.** Dokuz
oyun kaynak hash'i, bütün filo/araştırma/başlangıç hasarı girdileri ve seed'ler
önceki araştırmasız %25 kalkan koşusuyla aynı. Oran politikasında değişenler
yalnız taraf başına kaçış şansı ve gövde HP eşiği. Kalkan tam %25, araştırma
çarpanı kapalı; kalkan ve gövde tur aralarında yenilenmiyor.

Ana tablo aynı 24 kompozisyon, küçük tarafta kompozisyon çarpanı 1000, hücre
başına 128 seed; satır başına 3072 savaş. "Kalan" aktif + kaçan savaş gemileri;
hiç kurtulan olmayan savaşlar ortalamaya sıfır olarak dahil. 1:1'de eşit olan
savunan, diğer oranlarda küçük/savunan taraf gösterilir. Kargo ayrı tutulur.

| Oran | Küçük/savunan ortalama kalan | Bunun kaçan kısmı (başlangıç filosunun payı) | En az bir taraf tamamen silindi | Anıt saldırana geçti |
| --- | --- | --- | --- | --- |
| 1:1 | %60.6 | %5.2 | %0 | %0.2 |
| 1:1.5 | %22.8 | %7.8 | %0 | %66.7 |
| 1:2 | %14.7 | %14.3 | %16.7 | %96.5 |
| 1:2.5 | %12.9 | %12.9 | %16.7 | %100 |
| 1:3 | %22.8 | %22.8 | %16.7 | %100 |

1:1'de savaşların %99.4'ü, 1:1.5'te %33.3'ü, 1:2'de %3.5'i üç tur sonunda
iki taraf da aktifken bitti. Bu yüzden kalan filoyu yalnız "kaçıp kurtulan
kaybeden" gibi yorumlamamak gerekir. 1:2.5 ve 1:3'te savunanın kalan gemilerinin
hepsi kaçanlar; bu matriste aktif savunma tamamen temizlendi.

Önceki sabit %25 kalkan / iki tarafta HP ≤%50 / güçsüz %25-%50-%75, güçlü %25
politikasına göre: 1:1 kalan %62.2 → %60.6; 1:1.5 %29.2 → %22.8; 1:2
%14.7 → %14.7; 1:3 %16.0 → %22.8. Büyük filo anıt ele geçirme oranları
neredeyse aynı; temel üç tur sınırının oluşturduğu aktif savunma kalması sürüyor.
1:3'te yüksek kalan pay, yeni %70 HP eşiği ve %75 kaçış şansının ortak sonucu.

Farklı kompozisyonlar / küçük tarafın bir milyon kaynak bütçesi matrisinde:

| Nominal oran | Küçük taraf ortalama kalan | En az bir taraf tamamen silindi | Anıt ele geçirme |
| --- | --- | --- | --- |
| 1:1 | %57.9 | %10.4 | %10.0 |
| 1:1.5 | %22.7 | %5.7 | %61.7 |
| 1:2 | %16.8 | %7.3 | %93.7 |
| 1:2.5 | %13.5 | %13.9 | %97.2 |
| 1:3 | %22.2 | %20.4 | %99.97 |

Bu oranlar kaynak bütçesi oranıdır, farklı sınıfların gerçek atış gücünün eşit
olduğu iddiası değildir. Tam gemi sayısına yuvarlama sonrası politika gerçek
kargosuz `combatValue` ile seçilir; nominal 1:3 gerçek 3'ün biraz altına düştüyse
bir önceki kademe uygulanır. Hücre bazında seçilen iki şans ve iki HP eşiği
ham JSON'da kayıtlıdır. Kompozisyonlara eşit ağırlık verilmiştir; canlı oyuncu
filolarının sıklığı veya her savaş için garanti ölçülmemiştir.

Küçük filo kontrolü: kompozisyon çarpanı 2 / oran 1:3'te ortalama kalan %33.2,
tam silinme %32.3; çarpan 10'da %25.4 ve %17.2. Büyük filo tablosu küçük
filoya doğrudan genellenmemeli. Saf Striker gibi kaçış penceresine ulaşmadan
ölen profillerin tamamen silinmesi devam eder.

Sağlıklı Korsan 2:1 ve 5:2 örnekleri bütün 512 tekrarda anıtı aldı; savunanın
ortalama kurtuluşu %52.5 ve %24.3. 300 Korsan'a karşı 100 Korsan'da ortalama
37.3 Korsan kurtuldu; bütün 128 tekrarda anıt saldırana geçti.

Owner'ın ayrıca istediği kod incelemesinde doğrulananlar: başlangıçta sabit güç
oranı, tarafların karıştırılmaması, tam 1.5/2/3 sınırları, %33'ün tam 0.33 olması,
HP eşiğine eşit geminin dahil edilmesi, kalkanın HP eşiğine katılmaması, ölülerin
kaçmaması, iki tarafın tur başı ateş hakkı, kaçanın sonraki tur ateş/hedef dışı
kalması, aynı turda ölü hedefi geçip kargoya atış yapılması, kalkanın ve hasarın
korunması, cargo-only savunanın kontrolü ve fiziksel gemi korunumu. Önceki
simülasyonların politikası ayrı tutuldu; yeni politika onları değiştirmedi.

İncelemede yalnız sentetik/normal gönderimde engellenen ≤%5 başlangıç HP
girdisinde bir eksik bulundu: simülatörde ateş edemeyen gemi kontrol hesabında
anıt alabiliyordu. Gerçek `resolveMonumentCombat(..., maintenance=true)` ile
karşılaştıran test önce FAIL verdi; kontrol hesabına başlangıç uygunluğu filtresi
eklenince PASS oldu. Gövdesi savaş sırasında %5'in altına düşen ama başlangıçta
uygun olan gemiyi bu filtre saf dışı bırakmıyor; mevcut kural korunuyor. Bu
çalışmanın bütün girdileri başlangıçta >%5 HP ile uygun; tek tek doğrulandı.
Bu düzeltme kayıtlı 156.672 savaşın hiçbirinin sonucunu değiştiremez.

[Yeni taraf eşikleri ham kanıtı](evidence/monument-retreat-ratio-adaptive-shield25-study-2026-10-22.json).
Tekrar çalıştırma: yukarıdaki Docker sınırlarıyla
`tools/monument-retreat-simulation.mjs --run-ratio --shield-25 --adaptive-escape`.
Oyun koduna, canlı veriye veya deploy'a dokunulmadı.

## Sonraki karşılaştırma planı — iki kademe düzeltmesi

Owner'ın yeni isteği: önceki taraf bazlı politikanın sadece iki kademesi değişir.
2 ≤ oran <3'te güçsüz taraf %55 şans / HP ≤%55 (önce %50 / ≤%50);
güçlü taraf %15 / ≤%30 kalır. Oran ≥3'te güçsüz taraf %70 şans / HP ≤%70
(önce %75 / ≤%70); güçlü %10 / ≤%25 kalır. 1:1 iki taraf %25 / ≤%25,
1:1.5 güçsüz %33 / ≤%30 ve güçlü %20 / ≤%30 değişmez. 1:2.5, 1:2 bandında.
%25 sabit kalkan ve kalan bütün mekanikler aynı. Eski politika saklanıp yeni
koşu `adaptive-v2` adıyla ayrı kaydedilir. Oyun veya deploy değişmeyecek.

Önce test: iki yeni şans/eşik, tam sınırlar ve ters yönde doğru tarafa uygulama,
değişmeyen iki alt kademe, eski politikayı tekrar üretme; aynı filolar ve seed'ler
üzerinde farkı ölç. Tek CPU / toplam 2 GiB sert sınır, sıralı kontroller.

## İki kademe düzeltmesi sonucu — adaptive-v2

Yeni politika yukarıdaki isteğe göre yalnız simülasyona eklendi. Önceki
`adaptive` politikası ve kanıtı korunuyor; yeni CLI seçimi
`--run-ratio --shield-25 --adaptive-escape-v2`.
%25 kalkan, araştırma çarpanı kapalı, üç tur, yalnız ilk iki tur sonunda kaçış,
kargosuz başlangıç gücü, rastgele canlı hedefler, aynı turda kargoya devam ve
hasarın korunması değişmedi. Kalkan HP eşiğine katılmıyor.

156.672 savaş / 1.341 hücre, 124.69 saniye, en yüksek Node RSS 210.42 MiB.
Docker toplam bellek ve swap sınırı 2 GiB, tek CPU ve tek worker. Bütün
girdiler, örnek sayıları, seed ve dokuz oyun kaynak hash'i önceki koşuyla aynı.
Değişmeyen politikalı 559 hücrenin bütün sonuçları eski kanıtla birebir aynı.
Diğer hücrelerde de yalnız istenen iki güçsüz taraf kademesi değişmiş; güçlü
taraf, alt kademeler, başlangıç hasarı ve araştırmalar tek tek doğrulandı.

Ana tablo: öncekiyle aynı 24 bileşim (dört tier × altı oluşum), küçük taraf
bileşim çarpanı 1000; hücre başına 128 seed. Kalan = aktif + kaçan, sıfır
kurtulanlar da ortalamada. Eşit güçte savunan kullanıldı. Bu test dağılımı
canlı oyundaki savaşların görülme sıklığıyla ağırlıklandırılmış değildir.

| Oran | Önce kalan | Yeni kalan | Yeni kaçan payı | En az bir taraf fiziksel olarak tamamen silindi | Saldıran anıtı aldı |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1:1 | %60.57 | %60.57 | %5.23 | %0 | %0.20 |
| 1:1.5 | %22.84 | %22.84 | %7.82 | %0 | %66.67 |
| 1:2 | %14.67 | %17.62 | %17.31 | %16.67 | %97.01 |
| 1:2.5 | %12.87 | %15.60 | %15.60 | %16.67 | %100 |
| 1:3 | %22.82 | %21.29 | %21.29 | %16.67 | %100 |

Tam silinme, kaçan dahil hiç sağ gemi kalmaması demek. Büyük filolarda %16.67
aynı kaldı: 24 bileşimin dördü olan saf STRIKER aynalarındaki tam kayıplar bu
iki kaçış değişikliğiyle düzelmedi; diğer yirmi bileşimde fiziksel tam silinme
olmadı. Bu oran sağ kalan gemi miktarından ayrı bir ölçü.
1:1'de savaşların %99.41'inde, 1:1.5'te %33.33'ünde, 1:2'de %2.99'unda
üç tur sonunda iki tarafın da aktif gemisi var. Eşit güç tablosu kesin kaybeden
tarafın kalan filosu diye okunmamalı.

Küçük filo (bileşim çarpanı 2) kontrolü: 1:2 kalan %21.89 → %26.00,
tam silinme %47.07 → %40.30. 1:3 kalan %33.21 → %31.03, tam silinme
%32.32 → %34.54. Büyüklük sonuçları değiştiriyor; ana tablo küçük filolar
için genellenemez.

Farklı bileşimlerin eşit kaynak bütçesiyle kurulduğu çapraz kontrol:

| Nominal bütçe oranı | Savunan ortalama kalan | En az bir taraf tamamen silindi | Saldıran anıtı aldı |
| --- | ---: | ---: | ---: |
| 1:1 | %57.94 | %10.44 | %9.98 |
| 1:1.5 | %22.70 | %5.73 | %61.65 |
| 1:2 | %19.03 | %7.31 | %93.91 |
| 1:2.5 | %16.18 | %13.83 | %97.22 |
| 1:3 | %20.90 | %20.39 | %99.98 |

Bütçe hücrelerinde gemi sayısı aşağı yuvarlanır; kaçış kademesi nominal bütçe
değil gerçek kargosuz `combatValue` oranıyla seçilir.

Sağlıklı Korsan örnekleri, her biri 512 seed: 2→1 saldırı %100 ele geçirme,
savunan %57.03 ortalama kurtulan (tek gemi olduğundan kurtulma ihtimaliyle
aynı); 3→1 %100 ele geçirme / %70.70 kurtulan; 5→2 %100 ele geçirme /
%26.66 kurtulan. 1→1 hiçbirinde anıt değişmiyor, iki gemi de sağ. 5→1'de ise
ele geçirme %100 ama savunan kurtulma %1.76: tur sonuna kadar öldürülen gemi
kaçış şansı alamaz. Yeni kural her güç oranında kurtuluş garantilemiyor.

Doğrulama: yeni kademe ve CLI testleri önce FAIL, uygulama sonrası ilgili
51 testin tamamı PASS; dört simülasyon dosyasının `pnpm lint` kontrolü PASS,
`git diff --check` temiz. Ayrıca önceki kod incelemesinden sonra eski sabit
HP50/%25 kalkan ve adaptive-v1 ana tabloları ayrı ayrı 15.360 savaşla yeniden
üretildi; ikisi de kayıtlı metriklerle birebir aynı.

[Yeni ham kanıt](evidence/monument-retreat-ratio-adaptive-v2-shield25-study-2026-10-22.json).
Oyun kodu, canlı veri ve deploy değiştirilmedi.
