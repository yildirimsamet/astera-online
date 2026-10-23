# Yeni sağ kalma hedefi — 23 Ekim 2026

**Kullanıcı açıklaması:** Önceki hedef toplam sağ kalmayı artırmak değildir.
Yakın güçte karşılıklı ağır kayıp, büyük güç farkında zayıf tarafa kaçış fırsatı istenir.
Önceki `targeted` aday bu yeni hedefe uygun ayar veya onaylanmış uygulama değildir.

| Başlangıç güç oranı | İstenen yaklaşık sonuç |
|---|---|
| 1:1 ve 1:1,5 | İki tarafın da başlangıç filosunun ortalama %10–20'si fiziksel olarak sağ kalsın; aktif + kaçan dahil |
| 1:2 | Güçlü taraf kazansın; güçsüzün başlangıç filosunun %10–20'si kaçarak kurtulsun |
| 1:3 | Güçlü taraf kazansın; güçsüzün başlangıç filosunun %20–30'u kaçarak kurtulsun |

Bunlar yaklaşık denge hedefleridir; her savaşta garanti kota değildir.
1:1'de güçsüz taraf yoktur: iki taraf ayrı raporlanmalıdır. Büyük farkta kaçan
oranı ile fiziksel sağ kalan ve aktif kalan ayrı ölçülmelidir. Kompozisyonlar
tek ortalama altında gizlenmemelidir.

## Uygulama sınırı

Onaylanan bütün hedeflere rastgele hasar dağıtımı ve kargo/Hurdacı koruması
korunur. Üç tur ve yalnız ilk iki turun sonunda kaçış mevcut sözleşmedir.
Bu hedef kaydı can/atak, tur sayısı veya kaçış anında yeni bir mekanik onayı
anlamına gelmez. Önce mevcut sınırların hedefi mümkün kılıp kılmadığı incelenir.
Bu çalışma canlı koda uygulanmaz ve deploy edilmez.

## Mevcut sınırların kontrolü

7.200 savaş hesabı: 24 dizilim × 100 tohum × 3 ayar (mevcut kaçış, kaçış kapalı, önceki ölçülü öneri). Tek CPU ve 2 GiB toplam bellek sınırı kullanıldı. Bu, yeni mekanik denemesi değildir; önce mevcut sınırların teşhisidir.

| Dizilim, kişisel kalkan %25 | Kaçış kapalı: saldıran fiziksel sağ kalan | Savunan fiziksel sağ kalan |
|---|---|---|
| 20 Korsan → 20 Korsan | %100.0 | %100.0 |
| 30 Korsan → 20 Korsan | %100.0 | %46.0 |
| 20 Kale → 20 Kale | %100.0 | %100.0 |
| 30 Kale → 20 Kale | %100.0 | %100.0 |
| 20 Kıyamet → 20 Kıyamet | %0.0 | %0.0 |
| 30 Kıyamet → 20 Kıyamet | %100.0 | %0.0 |

Kaçış kapalıyken bile Korsan/Kale taraflarının sağ kalması, bu durumlarda yalnız kaçış şansını azaltmanın %10–20 fiziksel sağ kalma hedefini oluşturmadığını gösterir. Kıyamet ise eşitlikte karşılıklı yok olabilir, 1:1,5’te güçsüz taraf ilk tur ölürken güçlü tarafın tüm gemileri sağ kalabilir. Sonuç gemi rolüne çok bağlıdır.

## İyimser hasar bütçesiyle matematiksel sınır

Sağlıklı başlayan, aynı tür ve sınıftaki mobil gemiler için, karşı tarafın bütün gemilerinin üç tur boyunca ateş ettiğini, her tur en yüksek 1,08 çarpanını çektiğini ve hasarı kusursuz odakladığını varsayalım. Bunlar gerçekte olduğundan daha fazla ölüm sağlayan iyimser varsayımlardır. Her öldürülen geminin tam kalkanı ve canı tüketilmelidir.

`Fiziksel sağ kalan güçlü oranı ≥ max(0, 1 − 3 × atak × 1,08 / (güç oranı × (can + kişisel kalkan)))`

| Tür, kalkan %25 | Eşit güçte teorik en az sağ kalan | 1:1,5 güçlü tarafta teorik en az sağ kalan |
|---|---|---|
| Korsan | %29.9 | %53.2 |
| Kale | %46.6 | %64.4 |

Bu sınırlar bile %10–20 hedefinin üzerinde. Üstelik gerçek rastgele dağıtım hasarı bütün hedeflere yaydığı için yukarıdaki örneklerde çok daha fazla gemi sağ kalıyor. Kaçışla hayatta kalan sayısını artırmak, öldürmeye yetecek hasar eksikliğini çözmez.

## Bir sonraki denemenin başarı ölçütü

- Dengeli savaş: iki tarafın fiziksel sağ kalması ayrı ayrı %10–20 civarında; aktif ve kaçan ayrıca raporlanır.
- 1:2: güçsüz başlangıç filosunun yaklaşık %10–20’si kaçsın, güçlü taraf çoğunlukla kontrolü alsın.
- 1:3: güçsüz başlangıç filosunun yaklaşık %20–30’u kaçsın, güçlü taraf çoğunlukla kontrolü alsın.
- Gemi türleri ve küçük/büyük filo ayrı değerlendirilir. Sağlıklı dayanıklı filoların %100, kırılganların %0 kalmasının ortalaması tek başına başarı değildir.
- Doğrudan ilk tur ölümüne fırsat yaratmak için kaçışın tetiklenme anı; dayanıklı filolarda yeterli kayıp oluşması için can/atak veya savaş süresi incelenmek zorundadır. Bunlar önceki yüzde kalibrasyonundan farklı mekanik/balance seçenekleridir.

Önceki kullanıcı onayında üç tur ve yalnız ilk iki turun sonunda kaçış sabitti. Bu sınırların yeni hedef kapsamında nasıl ele alınacağı kullanıcıya soruldu; yanıt beklenirken hasar/kaçış/tur mantığı değiştirilmedi.

[Ham teşhis verisi](evidence/combat-survival-target-feasibility-2026-10-23.json).
