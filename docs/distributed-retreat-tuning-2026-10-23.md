# Rastgele dağıtımda kaçış yüzdelerinin hafif kalibrasyonu

**Sonraki kullanıcı açıklaması:** Bu çalışmanın toplam kurtulmayı artıran
`targeted` önerisi, daha sonra açıklanan yakın güçte %10–20 sağ kalma hedefiyle
uyumlu değildir. [Yeni hedef ve teşhis](combat-survival-targets-2026-10-23.md)
esas alınmalıdır; bu rapor önceki denemenin kaydıdır, uygulama onayı değildir.

**Talep:** Onaylanan hasar dağıtımını koruyarak kaçış şansı ve can eşiğinde küçük
değişiklikler dene; kırılgan/dayanıklı gemiler arasındaki sonuç farkını azalt.
Bu çalışma simülasyondur; canlı ayar değişikliği veya deploy yetkisi değildir.

## Sınırlar ve değerlendirme

- Üç tur, yalnız ilk iki tur sonunda kaçış, rastgele hasar dağılımı, aynı atışta
  artan hasarın aktarılması, kargo/Hurdacı koruması ve mevcut can/atak/kalkan korunur.
- Güç basamakları 1/1,5/2/3 değişmez. Şans en çok 5 yüzde puan, can eşiği en çok
  10 yüzde puan değiştirilerek sınırlı adaylar denenir; üçüncü tur kaçışı eklenmez.
- İlk tur ölen gemi hiçbir can eşiği veya şans ayarıyla kurtarılamaz. Bu sınır
  verilerde ayrıca belirtilir; optimizasyon bunu çözdüğünü iddia etmemelidir.
- Aynı filo ve aynı tohumlarda eski/yeni ayarlar eşleştirilir. Tarama ve son
  doğrulama farklı tohumlarla yapılır. İki taraf eşitken aynı pencere kullanılır.
- Sadece toplam ortalamaya bakılmaz: Kıyamet/karma, Korsan/Kale, küçük/büyük filo,
  kalkan 0/4, iki saldırı yönü ve 1:1–1:3 oranları ayrı incelenir.
- Kurtulanlar kaçanları içerir; aktif filo yokluğu fiziksel sıfırlanma değildir.
  Gereksiz erken kaçış, iki tarafın aktif filosunun boşalması ve zafer değişimi izlenir.
- Etkilenen alanlar yalnız `tools/distributed-damage-model.mjs` simülasyon
  yardımcıları, yeni kalibrasyon aracı/testleri ve bu rapor/ham verilerdir.
  `packages/rules`, sunucu ve web kaynakları değiştirilmez.
- Yerelde tek hesaplama iş parçacığı, bir CPU kotası, 2 GiB toplam bellek sınırı,
  swap yok ve 1536 MiB Node heap. Testler/çalışmalar sırayla çalışır.

## Denenen ayarlar

Mevcut ayar dahil dokuz aday tarandı: can eşiği +5/+10 puan, şans +5 puan,
ikisinin birleşimleri, şans -5 / eşik +10, yalnız düşük oranları değiştiren
aday ve aşağıdaki ölçülü aday. Hasar, gemi istatistikleri, kalkan ve tur kuralları
bütün adaylarda aynı kaldı.

| Güç aralığı | Güçsüz: şans / can eşiği | Güçlü: şans / can eşiği |
|---|---|---|
| 1–<1,5 | %30 / ≤%35 | %30 / ≤%35 |
| 1,5–<2 | %35 / ≤%35 | %20 / ≤%30 |
| 2–<3 | %55 / ≤%60 | %15 / ≤%30 |
| ≥3 | %65 / ≤%75 | %10 / ≤%25 |

Bu tablo `targeted` simülasyon adayıdır; canlı veya kullanıcı tarafından son
uygulama kararı verilmiş ayar olarak yorumlanmamalıdır.

## Doğrulama yöntemi

Tarama: 300 senaryo × 9 aday, küçük/orta filoda 50, büyük filoda 20 tekrar;
toplam 108.000 savaş. İlk karşılaştırmadan farklı tohumlar kullanıldı.

Son doğrulama: mevcut ayar, ölçülü aday ve daha geniş +5 şans/+10 eşik adayı;
400 senaryo, ölçek 2/10 için 300, ölçek 50 için 100, ölçek 200 için 30 tekrar.
Her ayar için 73.000, toplam 219.000 savaş. Bu tohumlar taramadan ayrıdır.

Her eşleştirilmiş savaşta **ilk tur fiziksel kayıplarının aynı olduğu** ayrıca
assert edildi. Böylece yüzde denemelerinin hasar dağıtımını, gemi canını veya
ilk kaçış penceresinden önceki ölümleri değiştirmediği kontrol edildi.

Kurtulan yüzdeleri kaçanları içerir. Güçsüz/güçlü yüzdeleri başlangıçtaki kendi
mobil gemi sayısına göredir. Eşit güçte etiketler yalnız iki tarafı ayırt eder.
Sonuçlar her kompozisyon/boyut/kalkan/yön senaryosuna eşit ağırlık verir; canlı
oyuncu filosu dağılımı veya matematiksel küresel optimum iddiası değildir.

## Sonuç ve öneri

Önerilen ölçülü aday `targeted`. Bu kullanıcıya sunulan simülasyon önerisidir;
henüz onaylanmış canlı ayar değildir. Karar kaydındaki hasar dağıtım sözleşmesi
ve mevcut canlı kaçış yüzdeleri bu çalışma ile değiştirilmedi.

| Tüm doğrulama senaryolarının ortalaması | Mevcut | Ölçülü aday | Daha geniş aday |
|---|---|---|---|
| En az bir taraf fiziksel olarak tamamen silindi | %35,0 | %32,0 | %30,6 |
| Kıyamet/karma senaryolarında tamamen silinme | %78,6 | %74,1 | %72,8 |
| Güçlü tarafın toplam kaçışı | %0,7 | %1,1 | %1,1 |
| Korsan/Kale güçsüz tarafın ilk tur kaçışı | %9,8 | %11,3 | %14,7 |
| İki tarafın aktif filosu da bitti | %6,6 | %6,4 | %6,4 |
| Anıt kontrolü mevcut ayardan farklı | %0,0 | %0,6 | %1,0 |

Daha geniş aday tüm güçsüz taraf can eşiklerine +10, kaçış şanslarına +5 puan ekliyor.
Bu aday ölçülü seçeneğe göre tamamen silinmeyi yaklaşık 1,5 puan daha azaltırken,
Korsan/Kale ilk tur kaçışını yaklaşık 3,4 puan daha fazla artırıyor. Kullanıcının
“abartmadan, küçük oynamalar” sınırı nedeniyle daha ölçülü seçenek önerildi.
Bu seçim matematiksel tek optimum iddiası değildir.

## Kalkan araştırması 0 — eşleştirilmiş son doğrulama

| Güç oranı | Tam silinme: mevcut → aday | Güçsüz fiziksel sağ kalan: mevcut → aday | Aday 1. tur kaçış Z/G | Aday 2. tur kaçış Z/G |
|---|---|---|---|---|
| 1:1 | %25,0 → %21,3 | %65,0 → %67,2 | %4,7 / %4,5 | %0,8 / %0,8 |
| 1:1,5 | %30,4 → %26,9 | %43,0 → %43,5 | %3,7 / %0,2 | %1,7 / %0,2 |
| 1:2 | %34,5 → %34,1 | %33,7 → %33,9 | %3,6 / %0,0 | %29,8 / %0,0 |
| 1:2,5 | %51,4 → %45,2 | %19,0 → %25,8 | %15,2 / %0,0 | %10,6 / %0,0 |
| 1:3 | %41,5 → %41,8 | %40,4 → %38,5 | %38,2 / %0,0 | %0,2 / %0,0 |

## Kalkan araştırması 4 — eşleştirilmiş son doğrulama

| Güç oranı | Tam silinme: mevcut → aday | Güçsüz fiziksel sağ kalan: mevcut → aday | Aday 1. tur kaçış Z/G | Aday 2. tur kaçış Z/G |
|---|---|---|---|---|
| 1:1 | %23,3 → %13,5 | %63,3 → %65,9 | %1,6 / %1,7 | %3,4 / %3,4 |
| 1:1,5 | %34,0 → %30,0 | %59,6 → %60,0 | %0,8 / %0,1 | %0,0 / %0,1 |
| 1:2 | %24,3 → %23,8 | %48,5 → %49,1 | %8,9 / %0,0 | %22,3 / %0,0 |
| 1:2,5 | %40,9 → %40,5 | %30,2 → %31,0 | %1,2 / %0,0 | %29,7 / %0,0 |
| 1:3 | %44,2 → %43,2 | %29,6 → %33,8 | %21,7 / %0,0 | %12,1 / %0,0 |

## Kırılgan ve dayanıklı gemiler

| Eşit güçte senaryo | Tam silinme: mevcut → aday | Bir tarafta fiziksel sağ kalan: mevcut → aday |
|---|---|---|
| Kıyamet, kalkan araştırması 0 | %36,2 → %26,1 | %15,0 → %23,7 |
| Kıyamet, kalkan araştırması 4 | %92,0 → %51,9 | %2,7 → %7,8 |
| Korsan + Kıyamet, kalkan araştırması 0 | %89,0 → %80,5 | %10,4 → %12,6 |
| Korsan + Kıyamet, kalkan araştırması 4 | %24,6 → %15,7 | %13,5 → %21,5 |

- Eşit güçte Korsan fiziksel sağ kalması iki ayarda da %99,96875, Kale %100 olarak kaldı. Korsan'ın %100'e yuvarlanması nadir küçük-filo kayıplarını gizlediği için burada hassas değer verildi; bu senaryolarda adayın fiziksel sağ kalma sonucu mevcut ayarla aynı.
- Araştırmasız 1:3 toplamında tamamen silinme %41,5 → %41,8: iyileşme iddiası yok, küçük fark örnekleme ve politika etkisi birlikte olabilir. Güçsüz tarafta sağ kalan %40,4 → %38,5. Kalkan 4 için silinme %44,2 → %43,2, sağ kalan %29,6 → %33,8.
- Saf Kıyamet güçsüz tarafı 1:2 ve üzerindeki karşılaştırmalarda tamamen silinmeye devam ediyor. İlk turda canı sıfırlanan gemiye tur sonu ihtimal artışı yardım etmiyor. Bu sınırın çözülmesi başka bir mekanik/istatistik değişikliği gerektirir; bu çalışmada böyle bir değişiklik yapılmadı.
- Daha yüksek can eşiği daha erken fırsat sağlıyor; %65 kaçış şansı ise 3× güçsüz tarafta eski %70’e göre bu erken fırsatın toplu kaçışı aşırı büyütmesini sınırlıyor. Bu açıklama tabloyu tanımlar; her gemide kurtulmanın artacağı garantisi değildir.
- Büyük filolar için senaryo başına 30 tekrar kullanıldı; küçük yüzde farkları kesin iyileşme olarak sunulmadı. Sonuçlar ayrıca kalkan seviyesi ve kompozisyona ayrıldı.

## Kontroller ve tekrar çalıştırma

- 31 odak testi geçti: önceki 25 kontrolün yanında mevcut politika eşliği, basamak sınırları, cargo/Hurdacı güçten dışlama, yüzde değişimi sınırları, ayarlar arası durum sızıntısı olmaması ve ilk tur ölümü sınırı doğrulandı.
- Hem tarama hem son doğrulama ham özetlerinde aktif + kaçan = fiziksel sağ kalan ve sağ kalan + ölü = başlangıç ayrıca bağımsız hesapla kontrol edildi.
- Hasar dağıtım fonksiyonu değişmedi. Kaynak savaş dosyasının SHA-256 değeri yine `d4d863b05c613ad2f9e030b07f8e6aa0e0ea27751702a50f3b1001dbe9409ad1`.
- Tarama 51,4 saniye / gözlenen en yüksek RSS 251 MiB; son doğrulama 314,9 saniye / 229 MiB. Her iki çalışma 2 GiB toplam bellek ve bir CPU kotası altında yapıldı.

Son olarak 14 önceki kargo/Hurdacı/anıt dizilimi ve Vantasia'nın gerçek dizilimi,
mevcut ve ölçülü ayarla ayrı bir tohum kümesinde 1.000'er kez çalıştırıldı:
30.000 ek savaş, toplam çalışma 357.000 savaş hesabı. Anıttaki 2 Korsan → 1
Korsan, 5 Korsan → 2 Korsan ve 3 Korsan → 1 Korsan + Argosi örnekleri ölçülü
adayda her iki kalkan seviyesinde 1.000/1.000 saldıran kontrolü üretti. Yalnız
kargo/Hurdacı olan iki taraf savaşmadı ve savunan kontrolü korudu. Vantasia
dizilimi 1.000/1.000 kesin zafer olarak kaldı. Bunlar örneklem sonuçlarıdır.
Gezegenin sonuç derecesi ile anıtın silahlı kontrol kuralı farklı metriklerdir;
destek gemileri kalan anıtta saldıran kontrolü, gezegen derecesinden hesaplanmadı.

[Odak kontrol verileri](evidence/distributed-retreat-tuning-focused-2026-10-23.json).

Komutlar `study/random-distribution-20261023` dalında, bağımlılıkları kurulu çalışma dizininde:

```bash
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx --test --test-concurrency=1 tools/distributed-retreat-tuning.test.mjs tools/distributed-damage-model.test.mjs tools/distributed-damage-study.test.mjs
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx tools/distributed-retreat-tuning.mjs --stage=screen
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx tools/distributed-retreat-tuning.mjs --stage=validation --ids=baseline,chance-plus5-hp-plus10,targeted
```

Ham veriler: [tarama](evidence/distributed-retreat-tuning-screen-2026-10-23.json), [son doğrulama](evidence/distributed-retreat-tuning-validation-2026-10-23.json).
