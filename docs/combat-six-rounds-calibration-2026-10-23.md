# Altı tur ve tur sonu kaçış kalibrasyonu

**Son kullanıcı yönlendirmesi:** Savaş altı tur olsun. Güç farkı büyüdükçe
güçsüz tarafta kaçış daha yüksek can yüzdesinde tetiklensin; kaçış şansı bu
pencereye giren gemiler üzerinden kalibre edilsin. Gemi can/atakları değişmez.

Önceden seçilen “son tur hariç” kuralı altı tur için 1–5. turların sonunda
kaçış, 6. tur sonunda kaçış olmaması şeklinde uygulanır. Tur içinde, ölümcül
hasardan önce veya öldükten sonra kaçış yoktur. Bu çalışma simülasyondur;
üretim kodu ve deploy değiştirilmez.

- Önceki bütün uygun hedeflere rastgele hasar dağıtımı, hasarın aynı atışta
  aktarılması, kargo/Hurdacı koruması ve eşzamanlı atış hakları korunur.
- Sağ kalan, aktif ve kaçan ayrı raporlanır. Her turdaki uygun gemi sayısı
  “kaçış denemesi”dir; aynı gemi birden fazla turda uygun olabilir.
- Can penceresi örnekleri kesin kota değildir. Güçsüz can eşiği artan iki
  merdiven ve farklı kaçış şansı merdivenleri karşılaştırılır.
- Küçük filolar ana ortalamaya girmez; en az 20 gemi, son doğrulamada ayrıca
  50/100/200 ölçek, kalkan 0/4, iki yön ve farklı kompozisyonlar kullanılır.
- Başarı: dengeli savaşta iki tarafın ayrı ayrı %10–20 fiziksel sağ kalması;
  1:2'de güçsüzden %10–20, 1:3'te %20–30 kaçması; güçlü tarafın kontrolü alması.
  Tek ortalamada bir türün %100, diğerinin %0 kalması başarı olarak gizlenmez.
- Aynı can/atak ve altı turla gerçekleşmeyen hedefler açıkça raporlanır.
- Hesaplama tek CPU, 2 GiB cgroup, swap kapalı ve 1536 MiB heap altında yapılır.

## Kale hesabının bağımsız kontrolü

Güncel oyun verisinde Kale atak 445, can 2158, başlangıç kişisel kalkan 539,5.
Kale → Kale sınıf çarpanı 1. On Kale dört turda `445 × 10 × 4 = 17.800`
hasar verir; karşı on Kalenin toplam can+kalkanı `2697,5 × 10 = 26.975`.
Kalan toplam gövde canı 9.175, gemi başına ortalama 917,5'tir. Kullanıcının
yuvarlak 2200/540 sayılarıyla da `(2200 + 540) × 10 = 27.400` olur, 12.740 değil.

Bir Kale sabit atış çarpanı 1 ile tur sonlarında şu gövde canını taşır:
2158 → 1807,5 → 1362,5 → 917,5. Kalkan yalnız ilk tur 445, ikinci tur 94,5 emer;
sonraki turlarda yenilenmez. Bağımsız tek-gemi hesabı, 20 gemiye eşit dağılım
ve gerçek rastgele 20-gemilik resolver ile hasar bütçesi ayrı test edildi.
Bu senaryoda hasarın unutulması veya dört tur yerine üç tur çalışması bulunmadı.

## Deney yöntemi

Yedi başlangıç ayarı: mevcut kaçış ayarı; can eşikleri A = %30/%45/%60/%75,
B = %40/%50/%70/%85; her biri için güçsüz şansları düşük = %10/%15/%20/%30,
orta = %15/%20/%25/%35 ve yüksek = %20/%25/%30/%40. İlk basamakta iki taraf aynı;
diğerlerinde güçlü şansı %10/%10/%5 ve güçlü can eşiği %30/%30/%25.

Tarama: en az 20 gemi, beş kompozisyon, kalkan araştırması 0/4, dört güç oranı,
güçlü saldıran, 30 eşleştirilmiş tohum; 40 senaryo × 7 ayar × 30 = 8.400 savaş.
Tarama skoru her savaşın hedef aralığından karesel uzaklığıdır; küresel optimum
veya kullanıcı hedefinin tam karşılığı olarak sunulmaz. Nihai tabloda güç
basamakları başlangıçta sabit olduğu için taramada ölçülen satırlar birleştirilir.

Birleşik aday: A-düşük eşitlik satırı, A-orta 1,5 satırı, A-düşük 2 satırı,
A-yüksek 3 satırı. Böylece düşük oranlarda şans sınırlı kalırken 1:3 ortalama
kaçışı taramadaki %17 seviyesinden %20–30 hedefine yaklaşır. Bu seçim bir
uygulama onayı değil, son doğrulama adayıdır.

| Başlangıç büyük/küçük güç | Güçsüz şans / can eşiği | Güçlü şans / can eşiği |
|---|---|---|
| 1–<1,5 | %10 / ≤%30 | %10 / ≤%30 |
| 1,5–<2 | %20 / ≤%45 | %10 / ≤%30 |
| 2–<3 | %20 / ≤%60 | %10 / ≤%30 |
| ≥3 | %40 / ≤%75 | %5 / ≤%25 |

Son doğrulama: mevcut altı-tur ayarı ve birleşik aday, 400 senaryo, her iki yön,
20/50/100/200 ölçek ve yeni tohumlar; senaryo başına 100/40/20/10 tekrar.
Her modelde 17.000, toplam 34.000 savaş. Büyük ölçekte örneklem azlığı nedeniyle
nadir olaylara sıfır olasılık veya küçük farklara kesin iyileşme denmez.

Her eşleştirilmiş tohumda ilk tur ölüm sayılarının aynı olduğu assert edilir:
yüzde denemeleri ilk tur hasarını değiştiremez. Özetler beş kaçış penceresini
içerir; aktif + kaçan = fiziksel sağ kalan ve ölü + sağ kalan = başlangıç
korunumu kontrol edilir. 6. tur sonunda kaçış olmadığı ayrıca doğrulanır.

## Son doğrulama sonuçları

Birleşik tablo (`balanced`) ve mevcut yüzdeler altı turluk aynı modelde 400 senaryoda 17.000’er kez karşılaştırıldı: 34.000 savaş. Tarama ile birlikte 42.400 hesap. Son doğrulama tohumları taramadan ayrıdır.

Bu tablolar örneklenen senaryoların eşit ağırlıklı ortalamasıdır. Her savaş veya her kompozisyon için garanti kurtarma kotası değildir. İlk iki turdan sonra savaş bitmişse kalan turlar yapay olarak çalıştırılmaz. Fiziksel sağ kalma = aktif + kaçan; kaçış sayısı ölü değildir.

### Eşit güç: iki taraf ayrı

| Kalkan araştırması | Mevcut ayar: taraf 1 / taraf 2 fiziksel sağ kalan | Birleşik aday: taraf 1 / taraf 2 fiziksel sağ kalan |
|---|---|---|
| 0 | %26,1 / %26,8 | %16,7 / %17,3 |
| 4 | %32,3 / %31,9 | %25,5 / %25,1 |

### Kalkan araştırması 0: güç farkı

| Güç oranı | Mevcut güçsüz kaçan | Aday güçsüz kaçan | Aday güçsüz fiziksel sağ kalan | Aday güçlü fiziksel sağ kalan |
|---|---|---|---|---|
| 1:1,5 | %14,9 | %14,4 | %14,4 | %100,0 |
| 1:2 | %34,9 | %12,9 | %12,9 | %100,0 |
| 1:2,5 | %19,3 | %10,2 | %10,2 | %100,0 |
| 1:3 | %41,6 | %24,0 | %24,0 | %100,0 |

### Kalkan araştırması 0: güçsüz tarafta tur tur kaçış

| Oran | Tur 1 | Tur 2 | Tur 3 | Tur 4 | Tur 5 | Toplam |
|---|---|---|---|---|---|---|
| 1:1 | %1,8 | %0,3 | %0,0 | %3,9 | %1,9 | %7,8 |
| 1:1,5 | %3,6 | %5,0 | %5,8 | %0,0 | %0,0 | %14,4 |
| 1:2 | %0,8 | %12,0 | %0,1 | %0,0 | %0,0 | %12,9 |
| 1:2,5 | %6,2 | %4,0 | %0,0 | %0,0 | %0,0 | %10,2 |
| 1:3 | %24,0 | %0,0 | %0,0 | %0,0 | %0,0 | %24,0 |

1:1 satırında güçsüz yoktur; bu tur tablosunda savunan taraf gösterilir. Yukarıdaki eşit güç tablosu iki tarafı ayrı raporlar.

### Kalkan araştırması 4: güç farkı

| Güç oranı | Mevcut güçsüz kaçan | Aday güçsüz kaçan | Aday güçsüz fiziksel sağ kalan | Aday güçlü fiziksel sağ kalan |
|---|---|---|---|---|
| 1:1,5 | %14,3 | %13,2 | %13,2 | %100,0 |
| 1:2 | %42,6 | %15,5 | %15,5 | %100,0 |
| 1:2,5 | %32,6 | %12,0 | %12,0 | %100,0 |
| 1:3 | %30,8 | %22,2 | %22,2 | %100,0 |

### Kalkan araştırması 4: güçsüz tarafta tur tur kaçış

| Oran | Tur 1 | Tur 2 | Tur 3 | Tur 4 | Tur 5 | Toplam |
|---|---|---|---|---|---|---|
| 1:1 | %0,2 | %1,0 | %0,0 | %0,1 | %3,8 | %5,1 |
| 1:1,5 | %1,1 | %0,0 | %8,1 | %4,0 | %0,0 | %13,2 |
| 1:2 | %3,5 | %8,1 | %4,0 | %0,0 | %0,0 | %15,5 |
| 1:2,5 | %0,2 | %11,7 | %0,0 | %0,0 | %0,0 | %12,0 |
| 1:3 | %14,3 | %7,8 | %0,0 | %0,0 | %0,0 | %22,2 |

1:1 satırında güçsüz yoktur; bu tur tablosunda savunan taraf gösterilir. Yukarıdaki eşit güç tablosu iki tarafı ayrı raporlar.

## Kaçış şansı ile gerçek filo kaçışı

| Varsayılan kalkan, aday | Başlangıç 100 gemi başına uygun kaçış denemesi | Gerçek kaçan | Kaçan / deneme |
|---|---|---|
| 1:1 | 78.9 | 7.8 | %9,9 |
| 1:1,5 | 71.8 | 14.4 | %20,1 |
| 1:2 | 63.9 | 12.9 | %20,1 |
| 1:2,5 | 49.9 | 10.2 | %20,4 |
| 1:3 | 59.9 | 24.0 | %40,1 |

Aynı gemi birden fazla turda uygun olabilir; “kaçış denemesi” benzersiz gemi sayısı değildir. Geminin kaçtığı turdan sonra yeniden denemesi ve hedef olması yoktur. 1:2’de yaklaşık %20 koşullu şans, başlangıç filosunun yaklaşık %13 kaçmasına; 1:3’te %40 koşullu şans yaklaşık %24 kaçmasına dönüştü. Bu ölçüm, şans yüzdesinin doğrudan kaçacak filo yüzdesi olmadığını doğrular.

## Kompozisyon ayrımı: eşit güçte aday

| Tür | Kalkan 0: taraf 1 / taraf 2 fiziksel sağ kalan | Kalkan 4: taraf 1 / taraf 2 fiziksel sağ kalan |
|---|---|---|
| Ok | %9,7 / %9,5 | %9,9 / %9,7 |
| Korsan | %9,8 / %10,2 | %10,3 / %9,9 |
| Kale | %48,3 / %49,9 | %100,0 / %100,0 |
| Kıyamet | %9,0 / %8,8 | %1,2 / %1,0 |
| Korsan + Kıyamet | %6,6 / %8,3 | %6,0 / %5,1 |

## Karşılanan ve karşılanmayan hedefler

- Varsayılan kalkanla 1:1 ortalaması iki tarafta yaklaşık %17: kullanıcının %10–20 hedefine yakın.
- 1:2’de güçsüz kaçışı varsayılan kalkanla %12,9, kalkan 4 ile %15,5: %10–20 hedefinde.
- 1:3’te güçsüz kaçışı varsayılan kalkanla %24,0, kalkan 4 ile %22,2: %20–30 hedefinde.
- 1:1,5’te güçsüz fiziksel sağ kalması yaklaşık %13–14 olurken güçlü tarafın fiziksel sağ kalması bu matriste %100 kaldı. “İki taraf da %10–20 kalsın” hedefi karşılanmadı; yalnız güçsüz yüzdesiyle başarı ilan edilmedi.
- Kalkan 4 eşit güç genel ortalaması yaklaşık %25; %10–20 hedefinin üzerinde. Kale %100’e yakın, Kıyamet %1 civarında kalabiliyor. Genel ortalama bu farkları gizlememeli.
- Bazı yüksek ateş gücü kompozisyonları tur sonunu göremeyebilir. Kaçış şansı ölen gemiye uygulanmaz; bu çalışma can/atak veya kaçış anını değiştirmedi.
- Denenen seçenekler arasında bu tablo dengeli bir simülasyon adayıdır; bütün hedeflere ulaşan ayar veya üretime hazır uygulama olarak sunulmaz.

## Kontrol ve tekrar

- 44 odak testi geçti. Üç/dört/altı tur motorlarının cache ayrımı, dört ve altı tam turun gerçekten çalışması, altı tur hasar bütçesine ölen gemilerin canının da dahil edilmesi, beş kaçış penceresinin sayılması ve son turda kaçış olmaması kontrol edildi.
- Kale için dört tur bütçesi üç bağımsız senaryoda doğrulandı. Can veya kalkan yenilenmesi, hasarın turlar arasında unutulması ve tur sayısının yanlış olması bulunmadı.
- 400 son doğrulama özetinde aktif + kaçan = fiziksel sağ kalan, ölü + fiziksel sağ kalan = başlangıç ve sonuç kategorileri toplamı 1 bağımsız hesapla kontrol edildi.
- Tarama 10,5 saniye / 188 MiB gözlenen RSS; son doğrulama 159,5 saniye / 210 MiB. İkisi de tek CPU ve 2 GiB cgroup altında.

Kod `study/random-distribution-20261023` dalında, yeni araçlar canlı kaynaklara bağlı değildir.

```bash
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx tools/six-round-retreat-calibration.mjs --stage=screen
systemd-run --user --scope -p MemoryMax=2G -p MemorySwapMax=0 -p CPUQuota=100% nice -n 10 node --v8-pool-size=1 --max-old-space-size=1536 --import tsx tools/six-round-retreat-calibration.mjs --stage=validation
```

Ham veriler: [tarama](evidence/six-round-retreat-screen-2026-10-23.json), [son doğrulama](evidence/six-round-retreat-validation-2026-10-23.json).
