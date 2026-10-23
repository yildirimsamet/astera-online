# Önce 1:2 / 1:3, sonra dengeli savaşların gözlemi

**Son kullanıcı talebi:** Altı turda önce güçsüzün başlangıç filosundan kaçan
payı 1:2 için **%15–25**, 1:3 için **%20–30** olsun. Bu aralıklara ulaşan
ayarlarla 1:1 ve 1:1,5 sonuçları daha sonra gözlemlensin; yakın güç sonuçları
bu turda optimizasyon hedefi yapılmasın.

Önceki tabloda 1:1 fiziksel sağ kalma, diğerlerinde kaçış verilmesi yanıltıcıydı.
Önceki adayın varsayılan kalkandaki gerçek kaçışı: 1:1 %7,8; 1:1,5 %14,4;
1:2 %12,9; 1:3 %24,0. 1:1,5 → 1:2 düşüşü gerçektir; eşit %20 koşullu
şans farklı sayıda yaşayan/uygun gemi ve tur fırsatı üretir.

## Deney planı

- Altı tur ve yalnız 1–5. tur sonlarında kaçış korunur; can/atak, kalkan ve
  bütün uygun hedeflere rastgele dağıtım, kargo/Hurdacı koruması değişmez.
- 1:1 ve 1:1,5 satırları önceki adayla aynı kalır. 1:2 şansı %25/%27,5/%30
  seçenekleriyle; ayrıca daha erken can pencereleriyle karşılaştırılır.
  1:3'te zaten hedefteki %40/≤%75 korunur veya erken pencere varyantı denenir.
- Seçim, tek tek savaşların kota sapmasına değil **ortalama kaçan payına**
  göre yapılır. Kalkan 0/4 ayrı ayrı hedefte olmalı; tek genel ortalamada
  bir kalkan profilinin hedef dışı olması gizlenmez.
- Hedefi sağlayan adaylar arasında hedef aralığının ortasına yakınlık kullanılır.
  Kompozisyon ve tur bazındaki farklar ayrıca raporlanır; her filo için kota yoktur.
- Tarama sadece 1:2/1:3; doğrulama yeni tohumlarla 1:1/1:1,5/1:2/1:2,5/1:3,
  iki yön, kalkan 0/4 ve 20/50/100/200 ölçek içerir.
- TDD: seçim metriği toplam sağ kalma ile kaçışı karıştırmamalı; iki kalkan
  profili ve iki hedef ayrı kontrol edilmeli; yakın oranların politikası değişmemeli.
- Tek CPU ve en fazla 2 GiB cgroup; swap kapalı, heap 1536 MiB. Üretim kodu ve
  deploy değişmez. Kalibrasyon dosyaları önceki kanıtlardan ayrı kaydedilir.

## Tarama ve doğrulama

Altı aday, yalnız 1:2/1:3, 20/100 ölçek, beş kompozisyon, kalkan 0/4,
güçlü saldıran ve 50 tohum: 40 senaryo × 6 aday × 50 = 12.000 savaş.
Yakın oranlar tarama seçim puanına dahil edilmez.

Taramada hedefi sağlayan adaylar arasında aralık ortalarına en yakın olan
`early275` seçildi: 1:2 şansı %27,5 / can eşiği ≤%65, 1:3 şansı %40 /
can eşiği ≤%80. Yakın oranların %10/≤%30 ve %20/≤%45 ayarları değişmedi.
Güçlü taraf şansları yine eşitlikte %10, diğerlerinde %10/%10/%5.

Taramadaki ortalama kaçışlar: 1:2 kalkan 0 için %18,18, kalkan 4 için %22,39;
1:3 sırasıyla %23,81 ve %23,19. Bunlar tarama sonuçlarıdır; son doğrulama
ayrı tohumlarda yapılır. Son doğrulama 400 senaryo ve iki ayar için toplam
34.000 savaş; yakın oranlarda sonuçların referansla birebir aynı kaldığı
her eşleştirilmiş tohumda assert edilir.

Seçim aralıkları, senaryo ortalamasına göredir. Her gemi türüne, her savaşa
veya tek gemiye aynı kurtarma kotası uygulanmaz. Nihai raporda kaçan, aktif,
fiziksel sağ kalan, ölü ve güçlü kontrolü birbirinden ayrılır.

## Matrisin anlamı

Her ana senaryoda iki taraf aynı gemi kompozisyonunun farklı sayıda birimle
ölçeklenmiş halidir; başlangıç güç oranı silahlı kaynak değeriyle sabitlenir.
Beş profil Ok, Korsan, Kale, Kıyamet ve Korsan+Kıyamet karışımıdır. İki tarafın
araştırmaları aynı; kalkan 0 ve 4 ayrı profillerdir. Karşıt gemi sınıfı,
araştırma farkı veya gezegen Aegis'i içeren bütün gerçek savaşların bu ortalamayı
vereceği iddia edilmez. Yer savunması ve yolculuk radyasyonu ana matriste yoktur.

1:1'de güçsüz taraf yoktur; taraflar ayrı ölçülür. 1:1,5'te sonuçlar güçsüz ve
güçlü olarak ayrılır; iki yönü ortalayıp güçlü %100 / güçsüz %14 sonucunu iki
taraf da %57 gibi göstermekten kaçınılır. Yakın oranların politikası değişmediği
ve eşleştirilmiş tohumlarda tam sonuç aynı kaldığı kontrol edildiğinden, yeni
rapor ile eski raporun küçük sayı farkları yeni tohum kümesinden kaynaklanır.

## Kullanıcının sonraki yuvarlama tercihi

Kullanıcı sonuçları olumlu değerlendirdikten sonra kaçış ayarlarının en yakın
çift tam yüzdeye yuvarlanmasını istedi. Sonraki aday `early275-even` olarak
ayrıca doğrulanır: %27,5 şans → %28; can eşikleri %45 → %46, %65 → %66;
güçlü 3× şansı %5 → %6, can eşiği %25 → %26. Tam eşit uzaklıkta üstteki çift
sayı seçilir. Bu yalnız kaçış tablosudur; başlangıç gemi kalkanı %25,
araştırma bonusları ve güç basamakları yuvarlanmaz. Gözlenen kaçış ortalamaları
ise ölçülmüş değer olarak saklanır, hedeflere zorla yuvarlanmaz.

## Son öncelikli doğrulama

12.000 tarama + 34.000 yeni tohumlu doğrulama = 46.000 savaş hesabı. Son doğrulamada seçilen `early275` ayarı iki kalkan profilinde de 1:2 %15–25, 1:3 %20–30 ortalama kaçış hedefini sağladı. Güçlü tarafın kontrolü bu kalibrasyon matrisinde %100 oldu.

| Oran | Kalkan araştırması 0: güçsüz kaçan | Kalkan araştırması 4: güçsüz kaçan |
|---|---|---|
| 1:2 | %17,6 | %22,5 |
| 1:3 | %24,0 | %23,8 |

### Aynı ayarla yakın savaşların gözlemi

| Kalkan araştırması | Savaş / taraf | Kaçan | Aktif | Fiziksel sağ kalan |
|---|---|---|---|---|
| 0 | 1:1 taraf 1 | %7,9 | %10,1 | %18,0 |
| 0 | 1:1 taraf 2 | %7,8 | %9,4 | %17,3 |
| 0 | 1:1,5 güçsüz | %14,4 | %0,0 | %14,4 |
| 0 | 1:1,5 güçlü | %0,0 | %100,0 | %100,0 |
| 4 | 1:1 taraf 1 | %5,3 | %20,1 | %25,4 |
| 4 | 1:1 taraf 2 | %5,3 | %20,1 | %25,4 |
| 4 | 1:1,5 güçsüz | %13,2 | %0,0 | %13,2 |
| 4 | 1:1,5 güçlü | %0,0 | %100,0 | %100,0 |

Varsayılan kalkanda karşılaştırılabilir **gerçek kaçış** sırası 1:1 yaklaşık %7,9; 1:1,5 güçsüz %14,4; 1:2 %17,6; 1:3 %24,0. 1:1 fiziksel sağ kalması %17–18’dir ve kaçışla aynı sayı değildir.
1:2,5 ek gözleminde güçsüz kaçışı kalkan 0 için %16,2, kalkan 4 için %16,6 çıktı. Bu ara oran bu aşamada hedef yapılmadı; yalnız hedeflenen dört ankorda artış olması bütün ara oranlarda monotonluk garantisi değildir.

### Son yuvarlanmış tablo ve kontrol

Kullanıcı bütün kaçış yüzdelerini çift tam sayıya yuvarlama tercihini belirtti. Tam eşit uzaklıkta üst çift seçildi.

| Güç aralığı | Güçsüz şans / kalan can eşiği | Güçlü şans / kalan can eşiği |
|---|---|---|
| 1–<1,5 | %10 / ≤%30 | %10 / ≤%30 |
| 1,5–<2 | %20 / ≤%46 | %10 / ≤%30 |
| 2–<3 | %28 / ≤%66 | %10 / ≤%30 |
| ≥3 | %40 / ≤%80 | %6 / ≤%26 |

Yuvarlama yalnız ayaradır; ölçülen ortalamalar yuvarlanıp hedefe zorlanmadı. Güç oranı basamakları, başlangıç gemi kalkanı %25 ve araştırma bonusları değişmedi.
200 senaryo, 20/100 ölçek, iki yön, kalkan 0/4 ve 30 yeni eşleştirilmiş tohumla 12.000 ek karşılaştırma yapıldı. Yuvarlanmış ayar iki hedefi de korudu:

| Oran | Kalkan 0: gerçek kaçış | Kalkan 4: gerçek kaçış |
|---|---|---|
| 1:2 | %18,4 | %22,9 |
| 1:3 | %24,2 | %23,6 |

50 odak testi ve ilgili araçların lint kontrolü geçti. Testler/simülasyonlar tek CPU ve 2 GiB sınırında sıralı çalıştı; yuvarlama doğrulamasında gözlenen RSS 205 MiB.

Ham veriler: [tarama](evidence/six-round-priority-screen-2026-10-23.json), [doğrulama](evidence/six-round-priority-validation-2026-10-23.json), [çift yüzde kontrolü](evidence/six-round-even-rounding-2026-10-23.json).

## Üretim entegrasyonu yetkisi

Kullanıcı bu son ayarları, altı turu ve onaylı hasar dağıtımını artık asıl oyun koduna entegre etmeyi açıkça istedi. Önce kod incelemesi/etki planı, ardından TDD uygulama yapılacak. Bu raporun kendisi üretim değişikliğinin tamamlandığını veya deploy edildiğini söylemez.
