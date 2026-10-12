# Anıt radyasyonu ve koruma araştırması — 12 Ekim 2026

**Durum güncellemesi — 12 Ekim 2026: karma hasar önerisi kullanıcı tarafından reddedildi.** Geçerli karar [Game Design: sabit HP hasarı](game-design.md#radyasyon--sabit-hp-hasarı-kesin-kullanıcı-kararı-2026-10-12) bölümündedir. Radyasyon geminin canından bağımsız, gemi başına sabit HP/dk vuracak. Gemi HP'sine bağlı yüzdelik hasar ve sabit + yüzdelik karışımı kullanılmayacak.

**Kararın gerekçesi:** yüksek can radyasyona karşı daha uzun dayanmayı sağlamalı. Yüzdesel hasar bu avantajı ortadan kaldırır; karma hasar ise avantajı aşındırırken ileride eklenecek yüzdelerle etkileşim, hata ve bakım yükünü artırır. Tüm gemileri yaklaşık 1–2 saatte öldürme hedefi asistanın fazla sıkı varsayımıydı; kullanıcı tarafından istenmiş bir kural değil.

**Geçerli çalışma yönü:** anıt seviyelerine göre sabit HP/dk hasar ve bu hasarı azaltan koruma araştırması kalibre edilecek. Yeni oranlar henüz kesinleşmedi. Önceki dört seviye, %10/%20/%30/%40 etki ve fiyatlar onaylanmış sayılmaz. Büyük savunma filosunun kârlılığına ilişkin ekonomik tercih de açık kalıyor.

Bu çalışma oyun kurallarını, araştırma listesini veya aktif sezon verisini değiştirmedi; deploy yapılmadı. Aşağıda mevcut 2/5 HP/dk durumunun ölçümleri ve **karar öncesindeki reddedilmiş karma model incelemesi** tarihsel karşılaştırma için korunuyor. Karma modele ait formüller, ölüm tavanları, farm/onarım sonuçları, araştırma taslağı, JSON kanıtı ve hesap aracı güncel uygulama önerisi değildir.

## Arşiv: karar öncesindeki değerlendirme

İlk öneri dört seviyeli Radyasyon Kalkanı, %10 / %20 / %30 / %40 azaltma ve sabit HP hasarına temel gemi HP'sinden hesaplanan bir pay eklenmesiydi. Bu öneri reddedildi. Aşağıdaki eski sonuçlar bu modele aittir; yeni sabit HP kalibrasyonu için kullanılamaz.

## 1. Hedef ve varsayımlar

- Araştırmasız: kolay anıtta zor, zor anıtta çok zor; uygun gemi ve taktikle yapılabilir.
- Azami koruma: kolay anıtta orta, zor anıtta zor. Radyasyon tamamen iptal edilmez.
- Sağlıklı, en dayanıklı filolarda dahi ölüm sınırı kolay anıtta yaklaşık 90–150, zor anıtta 60–100 dakika bandını aşmasın. Bu bant kullanıcıya soruldu; yanıt gelmeden kullanılan tasarım varsayımıdır. İnce gövdeler bu sürelerden önce kaybedilir.
- Süre anıta **varıştan** itibaren hesaplanır. Yolculuk ve dönüşte alan radyasyonu yoktur. Savaş, mevcut hasar ve gelecekteki bomba bu süreyi kısaltabilir.
- “Kayıpsız çalışma süresi” ile “son geminin ölüm süresi” ayrı kavramlardır. Farm tablosunda temkin payı olarak **ilk ölüm süresinin %75'i** kullanıldı; bu otomatik geri çağırma özelliği değildir ve PvP karşısında güvence sağlamaz.
- Tam gece bırakılan aynı filo, yeni gemi/koruma alanı gelmezse 8 saat boyunca kaynak biriktiremesin. Sürekli yeni dalga gönderilmesi, aktif oyuncunun rotasyonu ve üçüncü taraf otomasyonu ayrı konulardır.

**Açık ekonomik tercih:** küçük nöbet + yük filosu mu, büyük savunma ordusu mu kârlı olmalı? Sayısal sonuçla kullanıcıya soruldu. Öneri, üretimi artırmadan ilk seçeneği esas alıyor. Büyük ordu da kârlı olsun denirse aşağıdaki üretim kararı yeniden hesaplanmalı.

## 2. Bugün oyun gerçekten ne yapıyor?

| Anıt | Sayı | Radyasyon | Üretim | İlk NPC garnizonu | Bekleme kapasitesi |
|---|---:|---:|---:|---|---:|
| Seviye 1 / EASY | 4 | Gemi başına 2 HP/dk | Toplam 3 döteryum/dk | 3 Stronghold | 1.550 hacim |
| Seviye 2 / HARD | 4 | Gemi başına 5 HP/dk | Toplam 8 döteryum/dk | 10 Leviathan | 7.270 hacim |

Mevcut anıt sistemi iki radyasyon seviyesi kullanıyor. Gezegensel nötr T1/T2/T3 katmanları üç ayrı anıt radyasyon seviyesi değildir.

Önemli kurallar:

- EASY kısıtı **oyuncunun en yüksek çekirdek seviyesi** üzerinden: en fazla Core 9. Geminin T4 olması tek başına engel değil. Örneğin Shipyard 6, Starship Engineering 2 ve Ship Armor 2 ile Citadel; Propulsion 2 ile Argosy üretilebilir. Bunlar Core 9'da anıta gönderilebilir. İkisinin toplam hacmi yalnızca 47, EASY kapasitesine sığıyor.
- Gönderilebilir **22 hareketli gövdenin tamamı** ölçüldü. Prospector, sonda, yer savunması ve stratejik füze bu filonun üyesi değil. Garbage Collector hasar alır ama kendisi üretim toplayamaz.
- HP, `hulls.ts` içindeki eski ilk literal değerlerden alınmadı. `profileHull()` sonrası dışa verilen **canlı `HULLS`** kullanıldı.
- Ship Armor 5, HP'yi %25 artırır. Yeni koruma bunun üzerine ayrı bir çarpan olur.
- Radyasyon her gemiye uygulanır; 100 gemilik filo hasarı 100'e bölmez.
- Farm deposu yalnız **CARGO ailesindeki yük gemilerinde** vardır. Savaş gemilerinin normal baskın yük kapasitesi anıt üretimini taşımaz.
- Kaynak alabilmek için aynı oyuncunun hem saldırı gücü hem boş yük kapasitesi olmalı. Klan arkadaşının savaş gemileri, yalnız yük gemisi getiren başka oyuncuya otomatik üretim payı sağlamaz.
- 3/8 döteryum **filo başına değil, anıt başına toplamdır**. Hak kazanan oyuncular güçlerine göre paylaşır; dolan deponun kullanılmayan payı yeniden dağıtılır.

Kaynaklar: [`monument.ts`](../packages/rules/src/monument.ts), [`hulls.ts`](../packages/rules/src/hulls.ts), [`tech.ts`](../packages/rules/src/tech.ts), [`monumentCapacity.ts`](../packages/rules/src/monumentCapacity.ts).

## 3. Neden mevcut hasara sadece koruma eklemek yetmiyor?

Mevcut sabit hasarda, tam zırhlı Citadel EASY'de **22,48 saat**, HARD'da **8,99 saat** dayanıyor. Tam zırhlı Argosy EASY'de **14,06 saat**, HARD'da **5,63 saat** dayanıyor. İkisi de EASY'ye yasal olarak gidebildiği için gece bırakma sorunu zaten var.

Sadece %40 koruma eklenirse Argosy HARD'da **9,38 saat** dayanır. Citadel + Argosy, 8 saatin sonunda 3.840 döteryumu hâlâ taşıyabilir. Yeni araştırma, bugün HARD'da yük gemisinin ölümüyle sonlanan gece farmını yeniden açar.

| Model | Sonuç |
|---|---|
| Mevcut 2/5 HP + %40 koruma | Ağır filo için saatlerce AFK farm mümkün; hedefi karşılamıyor. |
| Sabit hasarı EASY 30, HARD 50 HP/dk yapmak | Citadel azami koruma/zırhla yaklaşık 150/90 dk dayanır; araştırmasız Pike ise yaklaşık 1,3/0,8 dk. Küçük gemiyi gereksiz yere eliyor. |
| Yalnız temel HP'nin %1,6 / %2,4'ü | Süreyi sınırlar, ancak radyasyona karşı bütün sağlıklı gövdelerin ömrünü eşitler. Ağır gövde seçiminin bu alandaki yararı kaybolur. |
| Reddedilen sabit + temel HP payı | Süreyi sınırlar; kullanıcı yüksek HP avantajını korumak ve karma oranların etkileşim/bakım yükünü önlemek için bu modeli reddetti. |

## 4. Reddedilen karma hasar ve araştırma taslağı (arşiv)

```text
H = geminin canlı katalogdaki temel HP'si, Ship Armor çarpanı uygulanmadan önce
K = araştırma seviyesi: 0, 1, 2, 3, 4
R(K) = 0, %10, %20, %30, %40

Seviye 1: HP/dk = (1 + 0,0145 × H + ek bomba HP/dk) × (1 - R(K))
Seviye 2: HP/dk = (2 + 0,0220 × H + ek bomba HP/dk) × (1 - R(K))

Kalan can = H × ShipArmorÇarpanı × (1 - mevcut hasar oranı)
Ölüm süresi = kalan can / HP/dk
```

Yüzdelik kısım **temel HP** üzerinden hesaplanır. Artırılmış HP üzerinden hesaplarsak Ship Armor'un sağladığı dayanıklılığı aynı anda hasara ekleyip geri almış oluruz. Hasarın her iki kısmı ve ilerideki bombanın ek hasarı korumadan önce toplanır. Koruma PvP saldırısını, füzenin doğrudan patlama hasarını veya yakıt bedelini azaltmaz.

Örneğin 90 HP Courier, EASY'de 2,305 HP/dk, HARD'da 3,98 HP/dk alır. Koruma 4 ile bunlar **1,383 / 2,388 HP/dk** olur. 2.158 HP Citadel için aynı değerler araştırmasız **32,291 / 49,476 HP/dk**, koruma 4 ile **19,375 / 29,686 HP/dk** olur.

Matematiksel tavan, Ship Armor 5 ve koruma 4 ile, HP ne kadar yüksek olursa olsun:

```text
EASY < 1,25 / (0,0145 × 0,60) = 143,68 dakika
HARD < 1,25 / (0,0220 × 0,60) =  94,70 dakika
```

Mevcut en dayanıklı gemide ölçülen sınırlar **139,2 / 90,9 dakika**. Bu sınır sabit anıt radyasyonu, tek dalganın donmuş teknolojisi ve radyasyonu iptal eden SHELTER bulunmaması için geçerli. SHELTER motoru tam bağışıklık verebiliyor; oyuncuya anıtta böyle bir kaynak açılırsa ayrı bir istisna olur. Daha yüksek Ship Armor tavanı da formülle yeniden denetlenmeli.

### Dört seviye neden daha uygun?

| Araştırma | Hasar azalması | Aynı gemi/zırhla dayanma süresi |
|---|---:|---:|
| Yok | %0 | ×1,00 |
| 1 | %10 | ×1,11 |
| 2 | %20 | ×1,25 |
| 3 | %30 | ×1,43 |
| 4 | %40 | ×1,67 |

İki seviye istenirse **%20 / %40** aynı nihai tavanı verir. Dört seviye, ilk korumayı daha erken aldırıp gelişimi daha fazla adıma böler. **%40 hasar azaltma, %40 daha uzun kalma demek değildir; %66,7 daha uzun kalmadır.** Max zırhla beraber araştırmasız/zırhsız gemiye göre çarpan yaklaşık ×2,08 olur.

### Araştırma fiyatı önerisi

Ad: **Radyasyon Kalkanı**. Teknik kimlik önerisi: `RADIATION_SHIELDING`. Komutan genelinde, azami 4 seviye. Önerilen açılış Core 3, başka araştırma önkoşulu yok. İlk korumaya erişmek için önceden anıttan döteryum çıkarma şartı oluşturulmamalı; üst seviyelerde Core 10 zorunluluğu konmamalı, çünkü EASY erişimini kapatır.

Mevcut ekonomi fiyatlama yönteminin referans aşama 4, 1,5 saat temel çaba, seviye başına ×1,8 büyüme ve mevcut araştırma kristal çarpanı kullanıldı. Fiyatlar oyun koduna eklenmiş değildir.

| Seviye | Alaşım | Kristal | Döteryum | Core 6'da tek seviye araştırma süresi |
|---|---:|---:|---:|---:|
| 1 | 2.331 | 1.434 | 0 | 25,9 dk |
| 2 | 4.196 | 2.582 | 0 | 46,6 dk |
| 3 | 7.552 | 4.647 | 0 | 83,8 dk |
| 4 | 13.593 | 8.365 | 0 | 150,8 dk |
| Toplam | **27.672** | **17.028** | **0** | **307,1 dk** |

Süreler kuyruğun boş, mevcut ekonomi profilinin geçerli olduğu durum içindir. Diğer araştırmaların ve gemilerin yatırım maliyetleri buna dahil değil.

## 5. İlk inceleme: HP ve reddedilen karma modelde dayanma süresi

Dakika, tam can, zırh 0; yeni model sütunlarında **koruma 0 → koruma 4**. Bunlar temel gövde karşılaştırmasıdır: bazı ileri gemilerin üretimi Armor 2 gibi ek önkoşullar ister. Aşağıdaki gerçek filo hesapları bu önkoşulları içerir. Sıfır zırh sütunu bu ileri geminin sıfır araştırmayla üretilebileceği iddiası değildir.

| Gemi | Temel HP | Mevcut EASY / HARD | Reddedilen model EASY, K0 → K4 | Reddedilen model HARD, K0 → K4 |
|---|---:|---:|---:|---:|
| Dart | 77 | 38,5 / 15,4 | 36,4 → 60,6 | 20,8 → 34,7 |
| Pike | 38 | 19,0 / 7,6 | 24,5 → 40,8 | 13,4 → 22,3 |
| Rampart | 106 | 53,0 / 21,2 | 41,8 → 69,6 | 24,5 → 40,8 |
| Warden | 87 | 43,5 / 17,4 | 38,5 → 64,1 | 22,2 → 37,0 |
| Courier | 90 | 45,0 / 18,0 | 39,0 → 65,1 | 22,6 → 37,7 |
| Viper | 223 | 111,5 / 44,6 | 52,7 → 87,8 | 32,3 → 53,8 |
| Talon | 111 | 55,5 / 22,2 | 42,5 → 70,9 | 25,0 → 41,6 |
| Stronghold | 315 | 157,5 / 63,0 | 56,6 → 94,3 | 35,3 → 58,8 |
| Sentinel | 252 | 126,0 / 50,4 | 54,1 → 90,2 | 33,4 → 55,7 |
| Wayfarer | 225 | 112,5 / 45,0 | 52,8 → 88,0 | 32,4 → 54,0 |
| Tempest | 564 | 282,0 / 112,8 | 61,5 → 102,4 | 39,1 → 65,2 |
| Ballista | 282 | 141,0 / 56,4 | 55,4 → 92,4 | 34,4 → 57,3 |
| Leviathan | 801 | 400,5 / 160,2 | 63,5 → 105,8 | 40,8 → 68,0 |
| Praetorian | 626 | 313,0 / 125,2 | 62,1 → 103,5 | 39,7 → 66,2 |
| Atlas | 540 | 270,0 / 108,0 | 61,2 → 101,9 | 38,9 → 64,8 |
| Nullifier | 282 | 141,0 / 56,4 | 55,4 → 92,4 | 34,4 → 57,3 |
| Garbage Collector | 540 | 270,0 / 108,0 | 61,2 → 101,9 | 38,9 → 64,8 |
| Cataclysm | 754 | 377,0 / 150,8 | 63,2 → 105,3 | 40,6 → 67,6 |
| Corsair | 1.508 | 754,0 / 301,6 | 65,9 → 109,9 | 42,9 → 71,5 |
| Citadel | 2.158 | 1.079,0 / 431,6 | 66,8 → 111,4 | 43,6 → 72,7 |
| Paladin | 1.647 | 823,5 / 329,4 | 66,2 → 110,3 | 43,1 → 71,8 |
| Argosy | 1.350 | 675,0 / 270,0 | 65,6 → 109,4 | 42,6 → 71,0 |

### Sağlıklı gerçek filo: azami koruma ve azami zırh

Her örnekte ilk ölüm yük gemisinde gerçekleşiyor. Üretim başka oyuncu yokken anıtın tamamına sahip. Hasar almadan başlayan filo; savaş sonrası filo değil.

| Filo | EASY ilk ölüm | EASY %25 can payıyla bekleme / brüt farm | HARD ilk ölüm | HARD %25 can payıyla bekleme / brüt farm |
|---|---:|---:|---:|---:|
| 1 Rampart + 1 Courier | 81,3 dk | 61,0 dk / 183,0 D | 47,1 dk | 35,3 dk / 282,7 D |
| 1 Stronghold + 1 Wayfarer | 110,0 dk | 82,5 dk / 247,4 D | 67,4 dk | 50,6 dk / 404,7 D |
| 1 Leviathan + 1 Atlas | 127,4 dk | 95,6 dk / 286,7 D | 81,1 dk | 60,8 dk / 486,3 D |
| 1 Citadel + 1 Argosy | 136,7 dk | 102,5 dk / 307,6 D | 88,7 dk | 66,5 dk / 532,3 D |

Araştırma aynı gemiyi bir anda kayıpsız yapmıyor. %50 hasarlı bir Courier'in bu anıtta kalabilecek süresi tam canlının yarısıdır. Filoya bir Pike katmak da ilk ölüm sınırını kısaltır. Fazladan yük gemisi ve Cargo Holds kapasiteyi artırır, ölüm süresini artırmaz. Örneğin Courier'in deposu 1.000, Argosy'ninki 26.000 D; bu üretim hızlarında tek sağlıklı yük gemisinin deposu genellikle radyasyondan önce dolmaz.

## 6. Reddedilen karma modelde araştırmanın etkisi (arşiv)

1 Rampart + 1 Courier, **Armor 0, Industrial 0 her satırda aynı**. Anıt daha önce ele geçirilmiş, tek üretici oyuncu, %25 can payı; hareketli anıta başlangıçta yakın evden gönderim. Yakıt gerçek kesişme ve geri çağırma konumundan hesaplandı.

“Net eşdeğer” gerçek teslim edilen D'den yakıt ve onarımın ekonomik değerini düşer. **32 alaşım = 16 kristal = 1 D** oyunun değerleme referansıdır; oyuncunun kaynaklarını böyle değiştirebildiği veya tüm onarımı D ile ödediği anlamına gelmez. Tablodaki net, ilk ele geçirme savaşının kayıp maliyetini içermez.

| Koruma | EASY bekleme | EASY brüt / net eşdeğer | HARD bekleme | HARD brüt / net eşdeğer |
|---|---:|---:|---:|---:|
| 0 | 29,3 dk | 87,9 / 38,4 | 17,0 dk | 135,7 / 87,3 |
| 1 | 32,5 dk | 97,6 / 48,1 | 18,8 dk | 150,8 / 102,4 |
| 2 | 36,6 dk | 109,8 / 60,3 | 21,2 dk | 169,6 / 120,3 |
| 3 | 41,8 dk | 125,5 / 75,0 | 24,2 dk | 193,8 / 144,5 |
| 4 | 48,8 dk | 146,4 / 95,9 | 28,3 dk | 226,1 / 176,8 |

EASY onarımı her satırda yaklaşık **692 A + 334 C**, HARD **689 A + 333 C**. Aynı can payında geri çekildiğimiz için hasar yüzdesi ve onarım faturası benzer; araştırma bu faturayla daha çok üretim almamızı sağlıyor. Aynı dakika kaldığımızda ise hem hasar hem onarım düşer.

## 7. Reddedilen karma modelde yakıt, net farm ve büyük filo sorunu

“Ortalama” gerçek oyuncu telemetrisi değildir: 4 filo × 2 anıt seviyesi × 3 teknoloji durumu için, her seviyedeki dört anıtın tamamında, 4.500 yarıçapında küreye dağıtılan **12 ev konumu × 12 hareket fazı**, toplam **13.824 kısa yolculuk** ölçüldü. 16 saatlik ortak hareket döngüsü örneklendi. Beacon yok, tam hız; gemilerin asgari üretim araştırmaları ve bunların hız etkileri hesaba dahil. %75 ilk-ölüm bütçesi kullanıldı. Her örnek tek sahipli ve NPC savaşından sonraki farm turudur.

Aşağıdaki satırlarda Armor 5 + Industrial 2 var. Netten onarım, gerçek gidiş/dönüş yakıtı çıkarıldı. Kullanılmadan eve dönen **yakıt rezervi tüketilmiş maliyet sayılmadı**. Kayıp olursa gemi bedeli, kendi yükü ve yanan rezerv ayrıca kayıptır.

| Anıt | Filo, koruma 4 | Bekleme | Brüt D | Ortalama gerçek yakıt | Ortalama net D eşdeğeri | Örneklerde net aralığı |
|---|---|---:|---:|---:|---:|---:|
| EASY | Rampart + Courier | 61,0 dk | 183,0 | 14,8 | **146,9** | 139,7…157,7 |
| EASY | Stronghold + Wayfarer | 82,5 dk | 247,4 | 33,7 | **151,9** | 134,6…175,6 |
| EASY | Leviathan + Atlas | 95,6 dk | 286,7 | 65,5 | **65,2** | 32,8…111,8 |
| EASY | Citadel + Argosy | 102,5 dk | 307,6 | 147,9 | **−244,7** | −318,8…−139,8 |
| HARD | Rampart + Courier | 35,3 dk | 282,7 | 14,9 | **246,6** | 239,4…257,4 |
| HARD | Stronghold + Wayfarer | 50,6 dk | 404,7 | 34,0 | **309,2** | 292,1…333,1 |
| HARD | Leviathan + Atlas | 60,8 dk | 486,3 | 65,8 | **265,1** | 230,9…310,9 |
| HARD | Citadel + Argosy | 66,5 dk | 532,3 | 148,3 | **−19,6** | −96,4…82,6 |

Gidiş, bekleme, dönüş ve onarım birlikte sayıldığında örnek filoların tam çevrimi ortalamada yaklaşık **3,5–4,4 saat** sürüyor. Anıtta 35 dakika çalışmak, 35 dakikada tekrar kullanılabilir filo demek değil. Eve yakın anıta giden filo dönerken anıt daha uzağa taşınmış olabiliyor; örnekler gerçek 8/16 saat hareketini kullandığı için bu gider tabloda var.

Araştırmasız/asgari teknoloji ile Rampart + Courier'in örneklenmiş ortalama neti EASY'de **30,4**, HARD'da **78,3 D eşdeğeri**: uygun küçük filo için sonuç tamamen zarara kilitlenmiyor. Yalnız yeni korumayı 4'e çıkarıp diğer teknolojileri sabit tutunca **89,1 / 168,9** oluyor. Armor 5 ve Industrial 2 ile elde edilen daha yüksek sonuç yalnız yeni araştırmaya atfedilmemeli.

**Büyük savaş ordusu aynı tabloya sığmıyor.** Örneğin başlangıçta yakın evden HARD'a 10 Leviathan + Atlas, max koruma/zırh ve Industrial 2 ile 60,8 dk beklerse 486,3 D topluyor; yakıt + onarım **765,5 D eşdeğeri**, net **−279,2**. 10 Citadel + Argosy için aynı koşulda net yaklaşık **−1.477,9**. Bunlar tek başına büyük orduyu sürekli park etmeyi finanse etmez.

Bu nedenle önerilen kullanım: ele geçirme kuvvetiyle alınır; yaralı ve pahalı savaş gemilerinin gereksiz kısmı çekilir; kontrol/PvP ihtiyacına göre nöbet ve yük filosu yenilenir. Daha çok savunma daha çok toplam üretim oluşturmaz; rakip oyuncu ve klanlara karşı kontrol maliyetidir. Küçük nöbet filosunun kazançlı olması onun NPC garnizonunu yenebileceği veya PvP karşısında anıtı tutabileceği anlamına gelmez.

Büyük ordu da kârlı istenirse üretim ayrı karar. Yakın ev örneğinde yalnız 10 Leviathan + Atlas'ın başa başı yaklaşık **12,6 D/dk**, 10 Citadel + Argosy'ninki **30,2 D/dk** gerektiriyor; uzak evlerde daha yüksek. Tek bir yüksek üretim tüm küçük filolara da ödenir. Bugünkü galaksi üst üretimi **44 D/dk = 63.360 D/gün**. HARD'ları örneğin 30 D/dk yapmak bunu **132 D/dk = 190.080 D/gün** yapar. Bu, yalnız radyasyon ayarı olarak gizlice yapılmamalı.

## 8. İlk incelemenin savaş sonrası filo ve uç durumları (arşiv)

128 kısa, sabit tohumlu NPC savaşı çalıştırıldı: iki anıt tipi, sekiz filo şablonu, iki teknoloji durumu, sekizer tohum. Bu küçük tanı çalışması bir kazanma yüzdesi veya PvP istatistiği iddiası değildir. Koruma 4 grubunda Armor/Power 5 de bulunur; farklı savaş sonucu **radyasyon araştırmasının PvP bonusu** olarak yorumlanamaz.

| Örnek | Sonuç | Savaş sonrası ilk radyasyon kaybı | 30 dk sonra taşınabilir brüt farm |
|---|---|---|---:|
| EASY, 5 Viper + Courier, koruma 0/asgari teknoloji | 8/8 örnekte ele geçirdi | Ortalama 8,4 dk; en erken 0,8 dk | 90 D; bazı savaş gemileri daha önce kaybedilir |
| EASY, 2 Leviathan + Atlas, koruma 0/asgari teknoloji | 8/8 ele geçirdi | Ortalama 37,5 dk; en erken 32,8 dk | 90 D |
| HARD, 24 Tempest + Atlas, koruma 0/asgari teknoloji | 8/8 ele geçirdi | Ortalama 30,3 dk; en erken 20,0 dk | 240 D |
| HARD, 16 Leviathan + Atlas, koruma 4/Armor 5/Power 5 | 8/8 ele geçirdi | Ortalama 39,1 dk; en erken 2,5 dk | 240 D; en yaralı gövde daha erken ölebilir |

**İlk geminin ölümü bütün filonun veya farmın bitmesi değildir.** Olay bazlı hesap, o gemiyi çıkarıp kalan gerçek güç ve yük kapasitesiyle üretime devam etti. Ölen yük gemisinin kendi yükü yok olur; diğer gemiye veya klan arkadaşına aktarılmaz. Örneğin mevcut EASY'de 1 Rampart + Courier için 45. dakikadan hemen önce yaklaşık 135 D vardır; Courier tam 45. dakikada ölünce bu 135 D kaybolur, Rampart hayatta kalır.

İncelenen önemli durumlar:

- **20% ücretsiz onarım eşiği:** bugün %20 ve altı hasar eve dönüşte ücretsiz, %20,01 ve üstü dock/fatura. Max koruma/zırhlı Rampart + Courier için ücretsiz dönüş bütçesi EASY'de yaklaşık **16,3**, HARD'da **9,4 dk**; araştırmasız/zırhsız yaklaşık **7,8 / 4,5 dk**. Bu keskin maliyet farkı kısa rotasyonu teşvik eder. Ücretsiz onarım eşiği bu öneride değiştirilmedi; uzun farmı teşvik etmek istenirse ayrıca değerlendirilir.
- **Hasarlı varış:** savaş öncesi tabloya güvenip yaralı filo bırakılmamalı. En hasarlı kohort ve yük kohortunun ayrı ölüm zamanları gösterilmeli. %25 can payı PvP darbesini garantiyle karşılamaz.
- **Klan:** koruma, zırh, hasar ve yük her katkının kendi dalga teknolojisine ait. Liderin araştırması diğer katkılara uygulanamaz. Klan değişimiyle eski hasar veya yeni koruma hediye edilemez.
- **Araştırma tamamlanması:** mevcut sistemde teknoloji gönderimde donar. Öneride koruma da gönderimde donar; araştırma bitince mevcut HOLD gemisi iyileşmez veya aniden daha uzun dayanmaz. Yeni gönderimler yararlanır. UI bunu açıkça söylemeli.
- **Bölüp geri çekme/yeniden yollama:** `damageBp` ile kesir `remainderBp` birlikte taşınmalı. Bölme, varış, savaş, okuma ve yeniden gönderim hasarı sıfırlamamalı. Eve gerçekten dönen geminin mevcut onarım kuralı geçerlidir.
- **Yakıt:** başta ayrılan rezerv, dönüşteki gerçek ücret ve eve varınca iade ayrı gösterilir. Ölen geminin rezervi yanar. Koruma bunu değiştirmez; hayatta kalan ancak uzaktan dönen gemi daha çok yakıt harcayabilir.
- **Gece farmı:** aynı max teknolojili Citadel + Argosy'yi 8 saat bırakınca önerilen modelde iki anıt tipinde de sağ kalan/yüklü gemi yok. Daha çok gemi, Cargo Holds, düşük uçuş hızı veya filoyu birden çok kohorta bölmek aynı gönderilmiş geminin HP tavanını kaldırmaz. Aktif takviye farklı gemiler getirir; bu tavan tüm oyuncunun oturum süresi sınırlaması değildir.
- **Gelecek radyasyon bombası:** `max(sabitHasar, HPPayı)` kullanmak ağır gövdelerin küçük bomba artışını yok saymasına yol açabilir. Öneride bomba hasarı toplama eklenir ve koruma en son uygulanır. Bomba seviyelerinin oranı/süresi/birikme kuralı ayrı kalibrasyondur. Bu çalışma ana gezegen filosuna yeni bekleme hasarı eklemiyor.

## 9. Reddedilen karma modelin uygulama değerlendirmesi (arşiv; uygulanmayacak)

1. **Ortak rules:** yeni araştırma kimliği, effect ladder, araştırma tavanı/fiyatı/görünümü; ortak radyasyon oranı hesabı. Dört seviyenin her birinin etkisi hem sunucuda hem istemcide aynı olmalı.
2. **HP settlement ve ölüm tahmini:** `applyHpDose`, `hpLethalAtMs`, ilk kayıp planlayıcısı, `settleMonumentHold`, forecast/quote aynı gemiye özel dozu kullanmalı. Mevcut tek bir ortak HP dozunu filo geneline uygulamaya devam edip yalnız tooltip'i değiştirmek hatalı olur. Ham temel HP'nin zamansal profili ile sabit HP profili taşınmalı; her gemiye rastgele değişen doz eklenmemeli.
3. **Kaynak geçmişi:** yeni temel-HP yüzdesi de radyasyon kaynağının tarihsel verisi olmalı. Eski kaynağın geçmiş oranı yeniden yazılmamalı. Geçiş zamanı, eski kaynak sonu ve yeni kaynak başlangıcı kesin olmalı. Eski kayıtların yüzdelik bileşeni sıfır kalmalı.
4. **Dalga/kohort:** normal gönderim, destek, klan katkısı, ele geçirme, fazla kapasitenin dönüşü, kısmi/tam geri çağırma, iniş ve sezon kapanışında araştırma/hasar/kesir/yük/rezerv korunmalı. Sağ kalanlar en yaralı kohorttan itibaren doğru zamanla işlenmeli.
5. **UI:** araştırmada “radyasyon hasarı %x azalır”; göndermeden önce filo için gerçek HP/dk, ilk kayıp tahmini, yük gemisi kayıp tahmini, mevcut hasar; bekleyen filoda geri çağırmaya kalan süre. Brüt yük, tahmini onarımın A/C/D faturası ve yakıt/iade birbirine karıştırılmamalı. Wiki ve altı dil güncellenmeli. Oyuncuya “139 dk güvenli” yazılmamalı; bu ölüm sınırı.
6. **Aktif sezon:** ayar yalnız yeni sezon seed'ine eklenirse mevcut anıtlar değişmez. Kullanıcının boş anıtta deploy planına uygun, OUTBOUND/HOLD/RETURNING/sonda/klan hazırlığı dahil önceki katı boşluk kontrolleriyle açık bir aktivasyon yapılmalı. Araştırma yeni açılır; hiç kimseye geriye dönük hasar/fatura çıkarılmaz. Bu analiz hiçbir aktivasyon yapmadı.

Performans bakımından gereken işlem kohort başına sabit birkaç çarpma ve mevcut olay zamanlarını hesaplamak. Yeni hareketli alan kesişimi veya dakika başına tick gerekmiyor. Kaynak zaman pencereleri ortak hesaplanıp her kohorta uygulanabilir. Bu tasarımın ek yükü hareket hesabından bağımsızdır; oyun entegrasyonunun DB/worker performansı bu analizle ölçülmüş sayılmaz.

## 10. Geçmiş hesapların doğrulaması ve tekrar çalıştırılması

- [`Hesap aracı`](../tools/monument-radiation-study.mjs) yalnız üretimdeki saf rule fonksiyonlarını çağırır; DB veya sunucuya yazmaz.
- [`18 otomatik test`](../tools/monument-radiation-study.test.mjs): canlı HP/üretim önkoşulları, tüm gövdelerde tavan, seviye artışı, kesirli hasar, üretim/cap/paylaşım, tam ölüm anında yük kaybı, sekiz saat bırakma, gerçek onarım eşiği, yakıt rezervi/iade denkliği, farklı ev/hareket fazı ve sekiz anıt, yaralı gemi, mal varlığı kaybı ile cüzdan maliyetinin ayrımı ve geçersiz girdiler. Önce başarısız test çalıştırıldı, ardından uygulama ve yeşil sonuç alındı.
- Mevcut sabit HP modelinin hesap aracı sonucu `settleMonumentHold` ve `hpLethalAtMs` ile karşılaştırıldı. Yeni model oyun koduna entegre edilmiş değildir; araçta aynı HP/üretim fonksiyonlarına gemi başına aday oran verilir.
- 384 yakın/uzak uç örneği + 13.824 konum/faz/anıt örneği + 10 sabit teknolojili araştırma adımı; ayrıca 128 kısa NPC savaşı. Bu bir tam sezon ekonomisi veya PvP simülasyonu değildir.
- İlgili mevcut rules regresyonları: radyasyon HP, anıt üretimi/yakıtı/savaşı/kapasitesi, gemi hasarı ve araştırma; **7 dosyada 148 test geçti**. Yeni araçtaki 18 test de geçti. Araç dosyalarının lint kontrolü ve `git diff --check` temiz. Bu analiz için uygulama kodu değişmediğinden önceki session'ın bütün API/UI test sayıları yeni araştırmanın entegrasyon kanıtı olarak sunulmuyor.
- Makine tarafından okunabilir bütün sonuçlar: [`kanıt JSON`](evidence/monument-radiation-calibration-2026-10-12.json).

```bash
nice -n 10 node --import tsx --test tools/monument-radiation-study.test.mjs
nice -n 10 node --import tsx tools/monument-radiation-study.mjs
```

**Güncel karar:** yukarıdaki `sabit HP + temelHP × yüzde` formülleri ve bunlardan çıkan süre/farm tabloları uygulamaya taşınmayacak. Araştırmasız zor, araştırmayla daha yönetilebilir ve gece boyu başıboş farmı ödüllendirmeyen denge, **yalnız sabit HP/dk** ile yeniden hesaplanacak. Kaynağın gücü aynı koşullardaki her gemiden aynı HP'yi götürecek; yüksek can daha uzun dayanmayı sağlayacak. Kesin yeni oranlar ve araştırma etkileri bu dosyada henüz hesaplanmış veya onaylanmış değildir.
