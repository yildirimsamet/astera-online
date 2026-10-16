# Anıt radyasyonu ve koruma araştırması — sabit HP kalibrasyonu

12 Ekim 2026. **Master dalında uygulandı ve doğrulama tamamlandı. Canlı sezon değiştirilmedi. Deploy yapılmadı ve yapılmayacak.** Önceki karma model bu rapordan, hesap aracından ve güncel kanıt JSON'undan çıkarıldı; uygulamaya taşınmadı.

## 1. Kesin hedef ve önerinin sınırı

Kullanıcının netleştirdiği hedef: HARD anıtta **Korsan (CORSAIR), radyasyon koruması 0 ve Gemi Zırhı 0 ile yaklaşık 2 saat; yeni koruma ve mevcut Gemi Zırhı maksimumken yaklaşık 6 saat** dayanmalı. Saniyesi saniyesine eşitleme gerekmiyor. Korsan'ın canlı katalog HP'si 1.508, Gemi Zırhı 5 ile HP'si 1.885.

“Hiç araştırmasız” burada **korumasız/zırhsız** anlamında kullanılıyor. Korsan'ı üretmek için gereken Starship Engineering 2 ve Ship Power 2 gibi önkoşullar ortadan kalkmıyor. Farm örneklerindeki diğer gemilerin kendi üretim önkoşulları da uygulanıyor.

**Kesin hasar kararı:** radyasyon gemi başına sabit HP/dk vurur. Gemi HP'sinin yüzdesi kadar hasar ve sabit + yüzdesel HP hasarı karışımı yasak. Aynı koşulda düşük ve yüksek HP'li gemiden aynı HP düşer; yüksek HP daha uzun dayanmayı sağlar. Kullanıcının gerekçesi, HP'nin anlamını korumak ve ileride başka yüzdelerle etkileşim/hata/bakım yükünü önlemek. Ayrıntı: [Game Design](game-design.md#radyasyon--sabit-hp-hasarı-kesin-kullanıcı-kararı-2026-10-12).

**Kaynak seviyesi ile araştırma seviyesi ayrı:** kullanıcı, radyasyon seviyelerinin belirli sabit hasarları olacağını netleştirdi. **Radyasyon seviye 2'nin temel hasarı 12,5 HP/dk** esas alınacak; HARD anıtlar bu seviyeyi kullanır. Aynı seviye başka bir hedefte kullanıldığında da temel hasarı aynıdır. Koruma araştırması alınan hasarı azaltır; kaynağın radyasyon seviyesini değiştirmez. Seviye 3 şu anda hiçbir yerde kullanılmıyor; bu çalışmada ona yeni hasar atanmadı veya kaynak oluşturulmadı.

**Uygulanan araştırma:** kullanıcı 12 Ekim’de masterda geliştirmeyi başlatmayı onayladı. Dört seviyeli koruma; radyasyon seviye 2, koruma 0 → 4 arasında 12,5 → 5,25 HP/dk vurur. Radyasyon seviye 1 için 9 → 3,78 HP/dk uygulandı. Core 3 ve aşağıdaki fiyatlar kullanıldı. Üretim artışı uygulanmadı: EASY 3 / HARD 8 D/dk korunuyor. Deploy veya canlı sezon aktivasyonu yapılmadı. Kullanıcı 6 saat hesabının maksimum zırhı da içermesini açıkça seçti.

## 2. Geçiş öncesi durum ve yeni hasar tablosu

| Anıt | Sayı | Mevcut radyasyon | Mevcut üretim | NPC garnizonu | Bekleme kapasitesi |
|---|---:|---:|---:|---|---:|
| EASY / radyasyon 1 | 4 | 2 HP/dk | Toplam 3 D/dk | 3 Stronghold | 1.550 hacim |
| HARD / radyasyon 2 | 4 | 5 HP/dk | Toplam 8 D/dk | 10 Leviathan | 7.270 hacim |

Hedeflenen ortak kaynak sabitleri; araştırma uygulanmadan önce:

| Radyasyon seviyesi | Temel hasar | Mevcut kullanım |
|---|---:|---|
| 1 | 9 HP/dk | EASY anıtlar |
| 2 | 12,5 HP/dk | HARD anıtlar |
| 3 | Bu çalışmada atanmadı | Henüz hiçbir yerde yok |

Anıtların ayrı hasar tabloları olmayacak; kendi radyasyon seviyesini bu ortak tablodan okuyacaklar. Aynı radyasyon seviyesi ve aynı koruma, bütün hedeflerde aynı temel etkili HP/dk'yı verir. İlave kaynak varsa onun sabit dozu ayrıca hesaba katılır. Eski sezonların kaynak geçmişi, yeni sabitlerle geriye dönük yeniden hesaplanmaz.

Aşağıdaki bütün oranlar **her gemi için aynı sabit HP/dk** değeridir. Süre tam canla anıta varıştan başlar; uçuş/dönüşte alan radyasyonu yoktur.

| Koruma araştırması seviyesi | Radyasyon 1 HP/dk | Radyasyon 2 HP/dk | HARD Korsan, zırh 0 | HARD Korsan, zırh 5 |
|---|---:|---:|---:|---:|
| 0 | 9.00 | 12.50 | 120.6 dk | 150.8 dk |
| 1 | 7.56 | 10.50 | 143.6 dk | 179.5 dk |
| 2 | 6.12 | 8.50 | 177.4 dk | 221.8 dk |
| 3 | 4.68 | 6.50 | 232.0 dk | 290.0 dk |
| 4 | 3.78 | 5.25 | 287.2 dk | 359.0 dk |

HARD sonuçları yaklaşık **121 dakika → 359 dakika**. Maksimum yeni koruma, zırhsız Korsan'da yaklaşık **287 dakika / 4 saat 47 dakika** verir; yalnız Gemi Zırhı maksimum, yeni koruma yoksa yaklaşık **151 dakika / 2 saat 31 dakika**. Altı saat iki araştırmanın birlikte sonucu; yalnız yeni korumaya atfedilmemeli.

Hesap tek model kullanır:

```text
temel HP/dk = ortak radyasyon hasar tablosu[radyasyon seviyesi]
etkin HP/dk = (temel HP/dk + varsa ek sabit HP/dk) × koruma çarpanı
koruma çarpanları, seviye 0…4: 1,00 / 0,84 / 0,68 / 0,52 / 0,42
kaybedilen HP = etkin HP/dk × anıtta geçen dakika
dayanma süresi = mevcut kalan HP / etkin HP/dk
```

Çarpan **kaynağın şiddetini** azaltır; hasarı geminin HP'sinden türetmez. Örneğin maksimum korumayla HARD anıtta 90 HP Courier de 2.158 HP Citadel de her dakika 5,25 HP kaybeder. Zırh, can miktarını artırır; radyasyon oranını artırmaz. Can oranı biçimindeki `damageBp/remainderBp` yalnız kayıt biçimidir.

Dört seviye, HARD'da hasarı anlaşılır adımlarla azaltır ve ilk yatırımı erişilebilir tutar. İki seviye seçilirse aynı modelin 2. ve 4. basamakları kullanılabilir: HARD 12,5 → 8,5 → 5,25 HP/dk; nihai 6 saat hedefi değişmez. Dört seviyeli düzen uygulandı.

## 3. EASY neden 9 HP/dk?

EASY erişim kısıtı geminin T1/T2/T3/T4 olması değildir: **oyuncunun en yüksek çekirdeği en fazla Core 9 olmalı.** Core 9'da gerekli tersane/araştırmalarla T4 Citadel ve Argosy üretilebilir. İkisinin toplam hacmi 47; EASY kapasitesine rahatlıkla sığar. T4'ü hesap dışında bırakmak gece farmını gizler.

Maksimum Gemi Zırhında en dayanıklı mevcut yük gemisi Argosy **1.687,5 HP**. Aynı geminin, takviye veya radyasyon sığınağı olmadan, 8 saat boyunca yük taşımaya devam etmemesi için:

```text
EASY son HP/dk > 1.687,5 / 480 = 3,515625
0,42 koruma çarpanında EASY başlangıç HP/dk > 8,37
öneri: 9 × 0,42 = 3,78 HP/dk
```

Bu, bütün gemilere ortak ölüm tavanı koymaz. Maksimum zırh/korumada Argosy EASY'de yaklaşık **7 saat 26 dakika**, HARD'da **5 saat 21 dakika** dayanır. Citadel aynı koşulda EASY'de **11 saat 54 dakika**, HARD'da **8 saat 34 dakika** yaşayabilir. Citadel'in can avantajı korunur; **yük gemileri kaybedildiği için aynı filonun gece boyunca biriktirdiği farm eve taşınamaz.** Savaş gemisinin baskın yükü anıt üretimi için depo sayılmaz.

Bedeli: EASY'de korumasız T1 Courier yalnız **10 dakika**, Pike yaklaşık **4 dakika** dayanır. Dolayısıyla EASY adı başlangıç gemilerine rahat park etme anlamına gelmiyor; küçük gemi erken çekilmeli. Bu süre daha uzun istenirse aynı koruma çarpanını bütün anıtlarda kullanma veya 8 saatlik farm sınırı yeniden ele alınır. Yüksek HP avantajını yüzdesel hasarla silerek çözülmez. Yeni daha dayanıklı yük gemileri veya zırh tavanı geldiğinde bu eşik tekrar ölçülmeli.

## 4. Bütün gönderilebilir gemiler: HP ve dayanma

Dakika; sütunlar **koruma 0/zırh 0 → koruma 4/zırh 5**. Bu HP karşılaştırması, her ileri geminin gerçekten sıfır araştırmayla üretilebileceği iddiası değildir. Gerçek farm ve savaş hesapları asgari üretim araştırmalarını içerir.

| Gemi | Temel HP | EASY dakika | HARD dakika |
|---|---:|---:|---:|
| DART | 77 | 8.6 → 25.5 | 6.2 → 18.3 |
| PIKE | 38 | 4.2 → 12.6 | 3.0 → 9.0 |
| RAMPART | 106 | 11.8 → 35.1 | 8.5 → 25.2 |
| WARDEN | 87 | 9.7 → 28.8 | 7.0 → 20.7 |
| COURIER | 90 | 10.0 → 29.8 | 7.2 → 21.4 |
| VIPER | 223 | 24.8 → 73.7 | 17.8 → 53.1 |
| TALON | 111 | 12.3 → 36.7 | 8.9 → 26.4 |
| STRONGHOLD | 315 | 35.0 → 104.2 | 25.2 → 75.0 |
| SENTINEL | 252 | 28.0 → 83.3 | 20.2 → 60.0 |
| WAYFARER | 225 | 25.0 → 74.4 | 18.0 → 53.6 |
| TEMPEST | 564 | 62.7 → 186.5 | 45.1 → 134.3 |
| BALLISTA | 282 | 31.3 → 93.3 | 22.6 → 67.1 |
| LEVIATHAN | 801 | 89.0 → 264.9 | 64.1 → 190.7 |
| PRAETORIAN | 626 | 69.6 → 207.0 | 50.1 → 149.0 |
| ATLAS | 540 | 60.0 → 178.6 | 43.2 → 128.6 |
| NULLIFIER | 282 | 31.3 → 93.3 | 22.6 → 67.1 |
| GARBAGE_COLLECTOR | 540 | 60.0 → 178.6 | 43.2 → 128.6 |
| CATACLYSM | 754 | 83.8 → 249.3 | 60.3 → 179.5 |
| CORSAIR | 1.508 | 167.6 → 498.7 | 120.6 → 359.0 |
| CITADEL | 2.158 | 239.8 → 713.6 | 172.6 → 513.8 |
| PALADIN | 1.647 | 183.0 → 544.6 | 131.8 → 392.1 |
| ARGOSY | 1.350 | 150.0 → 446.4 | 108.0 → 321.4 |

Canlı `HULLS` profilleri kullanıldı; eski literal HP'ler kullanılmadı. Prospector, sonda, yer savunması ve stratejik füzeler bu 22 hareketli filo gövdesinin parçası değil. Garbage Collector radyasyon alır fakat tek başına farm yapamaz. Gemi sayısı hasarı gemilere bölmez ve anıtın toplam üretimini artırmaz.

## 5. Gerçekte ne kadar farm yapılabiliyor?

Korsan'ın tek başına 6 saat dayanması, filo 6 saat kayıpsız farm yapar demek değildir. Maksimum araştırmalı Korsan + Argosy'de ilk yük kaybı **321.4 dakika**. Hesaplarda temkin payı olarak ilk ölümün %75'i kullanıldı: yaklaşık **241 dakika / 4 saat 1 dakika** bekleme. Bu otomatik geri çağırma veya PvP güvenliği değildir; tam canla başlayan, ele geçirme sonrası taze filo örneğidir.

Aşağıdaki bütün filolarda koruma 4, Gemi Zırhı 5, Industrial 2 var. **Mevcut 3/8 D/dk üretim** kullanıldı. Üretim anıt başına toplam; başka hak sahibi oyuncu yok. Sayılar gerçek oyuncu telemetrisi değil, aynı geometrideki örneklerin ortalamasıdır.

| Anıt | Birer gemilik filo | %25 can payıyla bekleme | Brüt D | Ortalama gidiş+dönüş yakıtı | Tamir/yakıt sonrası net D eşdeğeri |
|---|---|---:|---:|---:|---:|
| EASY | Rampart + Courier | 22.3 dk | 67.0 | 15.1 | 31.3 |
| EASY | Stronghold + Wayfarer | 55.8 dk | 167.4 | 34.0 | 77.2 |
| EASY | Leviathan + Atlas | 133.9 dk | 401.8 | 65.8 | 194.9 |
| EASY | Corsair + Argosy | 334.8 dk | 1004.5 | 176.6 | 461.4 |
| EASY | Citadel + Argosy | 334.8 dk | 1004.5 | 153.8 | 497.1 |
| HARD | Rampart + Courier | 16.1 dk | 128.6 | 15.1 | 92.9 |
| HARD | Stronghold + Wayfarer | 40.2 dk | 321.4 | 34.2 | 231.0 |
| HARD | Leviathan + Atlas | 96.4 dk | 771.4 | 65.4 | 564.9 |
| HARD | Corsair + Argosy | 241.1 dk | 1928.6 | 176.2 | 1385.9 |
| HARD | Citadel + Argosy | 241.1 dk | 1928.6 | 153.3 | 1421.6 |

Net eşdeğer: eve taşınan D − gerçek gidiş/dönüş yakıtı − tamirin ekonomik değeri − varsa ölen gemi ve yanan yakıt rezervi. **32 alaşım / 16 kristal = 1 D**, yalnız değerleme referansıdır; oyuncuya bütün faturanın D ile kesildiği veya kaynak takası olduğu anlamına gelmez. Tamir ayrı A/C/D faturasıdır. Sağ kalan geminin kullanılmadan eve getirdiği rezerv tüketim sayılmaz; yalnız gerçekten eve dönen kohortun iadesi vardır. Ölen geminin kendi yükü ve rezervi yanar.

Ortalama örnekleme: beş filo × iki anıt seviyesi × üç teknoloji durumu × küreye dağıtılan 12 ev konumu × 12 hareket fazı × her seviyedeki dört anıt = **17.280 kısa yolculuk**. Ev yarıçapı 4.500, anıt 6.000, hareket 8/16 saat, tam uçuş hızı, beacon yok; gerçek kesişme ve gerçek geri çağırma konumu kullanıldı. Tersane 6 onarım süresi dahil çevrim süreleri JSON'dadır. Çevrimde yol ve onarım süresi vardır; sürekli anıtta kalındığı varsayılmaz.

## 6. Önemli bulgu: uzun ve ücretli onarımlı nöbetin maliyeti

Yeni HARD 12,5 HP/dk hedefine çıkıp üretimi 8 D/dk bırakırsak, **korumasız Korsan + Argosy** 81 dakika bekleyerek 648 D biriktiriyor; gerçek yakıt ve tamir sonrası ortalama **−257 D eşdeğeri**. Fiziksel olarak 2 saat dayanmak, kârlı farm yapmak anlamına gelmiyor. EASY'de de korumasız örnek filolar mevcut 3 D/dk ile zararda.

Bu örnekler ilk kaybın %75'ine kadar uzun beklemeyi değerlendirir; bütün farm stratejilerinin zararda olduğu anlamına gelmez. Ücretsiz %20 onarım sınırından önce geri dönülen küçük filoların masrafı çok daha düşüktür. Büyük nöbetin masrafı gemi sayısıyla büyürken anıtın toplam üretimi sabit kalır. Kullanıcının 10 Korsan örneği ve kısa tur/uzun nöbet ayrımı bölüm 12'de ayrıca hesaplandı. Üretim artışı uygulanmadı.

Yalnız yeni koruma 4'e çıkıp diğer araştırmalar aynı kalırsa HARD Korsan + Argosy yaklaşık 193 dakika bekleyip 1.543 D topluyor, ortalama **+635 D eşdeğeri** kalıyor. EASY'de aynı koruma, zırhsız/Industrial 0 Korsan + Argosy'yi tek başına kâra taşımıyor: yaklaşık **−106 D eşdeğeri**. İlk tablodaki maksimum sonuçlarda Gemi Zırhı ve Industrial'ın da katkısı var.

**Üretim tercihi kullanıcıya soruldu; henüz onaylanmış değil.** İki tutarlı yol:

1. **3/8 D/dk korunur:** para kazanmak için koruma/onarım araştırması gerekir; araştırmasız uzun turların çoğu zarar yazar. Yakın rota veya %20 ücretsiz onarım sınırı içindeki kısa tur bazı durumlarda işe yarar, genel kârlılık garanti edilmez. Bu seçenekte “çok zor ama yapılabilir” fiziksel dayanma için doğrudur; ekonomik erişim daha serttir.
2. **9/14 D/dk üretim önerisi:** incelenen taze küçük nöbet + yük filoları, asgari üretim teknolojileriyle ve yeni koruma olmadan dahi masraflarını karşılar. HARD Korsan + Argosy aynı 81 dakikada 1.134 D toplar, ortalama yaklaşık **+229 D eşdeğeri** bırakır. EASY'de aynı filo yaklaşık **+107 D eşdeğeri**. Başlangıcın ekonomik olarak tamamen kilitlenmemesi için bu seçenek önerildi; aktif sezon kaynak arzına etkisi ayrıca onay gerektiren bir denge kararıdır.

Asgari üretim araştırmaları, Industrial 0, koruma 0, %25 can payı. Citadel/Leviathan gibi gövdeler gerekiyorsa Armor 2 içerir. Yeni üretim sütunları **EASY 9 / HARD 14** içindir.

| Anıt | Birer gemilik filo | Bekleme | Mevcut üretimde ortalama net | 9/14 önerisinde ortalama net | 9/14 örnek net aralığı |
|---|---|---:|---:|---:|---:|
| EASY | Rampart + Courier | 7.5 dk | -33.8 | 11.2 | 4.4…22.4 |
| EASY | Stronghold + Wayfarer | 18.8 dk | -89.8 | 22.7 | 6.4…48.4 |
| EASY | Leviathan + Atlas | 49.5 dk | -198.8 | 98.2 | 65.4…147.4 |
| EASY | Corsair + Argosy | 112.5 dk | -567.9 | 107.1 | 24.6…228.6 |
| EASY | Citadel + Argosy | 123.8 dk | -484.0 | 258.5 | 186.7…361.7 |
| HARD | Rampart + Courier | 5.4 dk | -13.1 | 19.3 | 12.5…30.5 |
| HARD | Stronghold + Wayfarer | 13.5 dk | -38.2 | 42.8 | 25.6…68.6 |
| HARD | Leviathan + Atlas | 35.6 dk | -62.5 | 151.3 | 117.9…199.9 |
| HARD | Corsair + Argosy | 81.0 dk | -257.2 | 228.8 | 144.1…347.1 |
| HARD | Citadel + Argosy | 89.1 dk | -142.0 | 392.6 | 315.3…492.3 |

Bunlar ele geçirilmiş anıtta taze filo turları; **ilk NPC ele geçirme savaşının kayıpları, eski savaş hasarı ve rakip oyuncuların saldırıları dahil değil**. Bütün oyuncular/konumlar için kâr veya anıtı tutabilme garantisi değildir. 6/12 ve 8/14 ara seçenekleri de hesaplandı; JSON'da filo bazında başa baş üretim ve konumlara göre alt/üst net var. Örneğin 8 D/dk EASY, araştırmasız Korsan + Argosy'yi ortalamada hâlâ hafif zararda bırakıyor; tek elverişli yakın konumu “genel sonuç” diye göstermiyoruz.

Galaksi üst sınırı, dört EASY ve dört HARD kesintisiz üretirse:

| Üretim EASY/HARD | Galaksi D/dk | Azami D/gün | Bugüne göre |
|---|---:|---:|---:|
| 3 / 8 — mevcut | 44 | 63.360 | — |
| 6 / 12 — ara seçenek | 72 | 103.680 | +%63,6 |
| 8 / 14 — ara seçenek | 88 | 126.720 | +%100 |
| 9 / 14 — araştırmasız kâr seçeneği | 92 | 132.480 | +%109,1 |

Üretim artışı, maksimum araştırmalı filoya da ödenir: Korsan + Argosy'nin azami araştırmalı HARD turu yaklaşık 3.375 brüt / **2.832 net D eşdeğeri** verir. Bu yüzden üretimi artırmak yalnız başlangıcı düzeltmez; üst seviye gelir ve klan rekabetini de değiştirir. Bu çalışma tam sezon ekonomisini veya PvP dengesini doğrulamış sayılmaz.

Büyük orduyu sürekli park etmek ayrı risk/ödül tercihidir. Onarım ve yakıt gemi sayısıyla artar; toplam üretim artmaz. Yeni uzun dayanma süresinde, max teknolojili 10 Leviathan + Atlas örneği HARD'da yakın evden mevcut 8 D/dk ile bile yaklaşık +114 net eşdeğer bırakabiliyor; eski reddedilmiş karma modelin “büyük ordu hep zararda” sonucu artık geçerli değil. 10 Citadel + Argosy için aynı yakın örnek yaklaşık +125. Farklı konum, yaralı varış ve PvP bu sonucu değiştirir; büyük ordu için genel kârlılık iddiası yok.

## 7. Savaş sonrası aynı süreye güvenilmemeli

128 kısa, sabit tohumlu NPC savaşı çalıştırıldı: sekiz filo, iki teknoloji durumu, sekiz tohum. Küçük tanı örneğidir; kazanma ihtimali veya PvP istatistiği değildir. Maksimum koruma grubunda Gemi Zırhı/Ship Power 5 de var; savaş başarısı yeni radyasyon araştırmasının saldırı bonusu değildir.

| Örnek | Sekiz tohumda ele geçirme | Savaş sonrası ilk radyasyon kaybı |
|---|---:|---|
| EASY, 5 Viper + Courier, koruma 0/asgari teknoloji | 8/8 | En erken 0,36 dk; ortalama 2,88 dk |
| EASY, 2 Leviathan + Atlas, koruma 0/asgari teknoloji | 8/8 | En erken 45,99 dk; ortalama 52,54 dk |
| HARD, 8 Korsan + Argosy, koruma 0/asgari teknoloji | 8/8 | En erken 6,60 dk; ortalama 25,32 dk |
| HARD, 8 Korsan + Argosy, koruma 4/zırh ve güç 5 | 8/8 | En erken 91,58 dk; ortalama 119,91 dk |

Korsan'ın **tam canla 2/6 saat hedefi**, savaşta yaralanmış bir Korsan'ın garantili süresi değildir. %50 canla varan geminin radyasyon bütçesi tam canlının yarısıdır. İlk yaralı savaş gemisi kaybedilse bile başka savaş gemileri ve yük kapasitesi varsa farm sürer; ilk ölüm bütün filonun ölümü değildir. Yük gemisinin ölümü kendi topladığı yükü yok eder, başka gemiye aktarmaz.

## 8. Uygulanan araştırma erişimi ve fiyatları

Uygulama: **Radyasyon Kalkanı**, `RADIATION_SHIELDING`, komutan genelinde dört seviye. Core 3'te erişim, başka araştırma önkoşulu yok; maksimum için Core 10 gerektirilmemeli, aksi halde EASY erişimini kapatır. Önce anıttan D kazanmayı zorunlu kılmamak için D maliyeti yok. Araştırma normal komutan kuyruğuna eklendi; mevcut sezonlarda radyasyon geçişi gerçekleşmeden görünmez veya satın alınamaz.

Mevcut ekonomi fiyatlama yönteminin referans aşama 4, 1,5 saat temel çaba, seviye başına ×1,8 büyüme ve araştırma kristal çarpanı kullanıldı.

| Seviye | Alaşım | Kristal | Döteryum | Core 6'da bu seviye |
|---|---:|---:|---:|---:|
| 1 | 2.331 | 1.434 | 0 | 25.9 dk |
| 2 | 4.196 | 2.582 | 0 | 46.6 dk |
| 3 | 7.552 | 4.647 | 0 | 83.8 dk |
| 4 | 13.593 | 8.365 | 0 | 150.8 dk |
| Toplam | 27.672 | 17.028 | 0 | 307,1 dk |

Bu süre boş araştırma kuyruğu içindir; üretim önkoşulları, Gemi Zırhı ve Industrial yatırımı ayrıca gerekir. Radyasyon koruması PvP hasarını, doğrudan füze darbesini veya yakıtı azaltmaz.

## 9. Uygulama yol haritası ve açık bırakılmaması gerekenler

1. **Ayar kararı:** HARD 2/6 saat hedefi ve sabit HP modeli kesin; EASY 9 HP/dk, dört basamak ve Core 3/fiyatlar uygulandı; 3/8 → 9/14 üretim artışı uygulanmadı. Bu rapor bir deploy veya aktif sezon aktivasyonu yapmaz.
2. **Tek ortak rules tablosu ve hesabı:** radyasyon seviyesi temel HP/dk'yı tek tablodan seçsin; anıt zorluğu yalnız bu seviyeyi belirlesin. Koruma araştırması ayrı seviye olarak uygulansın. Gerçek hasar, `hpLethalAtMs`, ilk kayıp planlayıcısı, settlement ve UI tahmini aynı fonksiyonu kullansın. Gemi HP'sine göre yeni bir hasar bileşeni eklenmesin. Mevcut `radiationSources.ts` görünümü seviyeyi ham hasarı `MONUMENT_BALANCE` ile eşleştirerek buluyor; entegrasyonda seviye açık kaynak/hedef bilgisiyle taşınmalı. Korunmuş hasardan, bomba eklenmiş toplamdan veya yeni sabitlerle uyuşmayan eski kaynak yoğunluğundan seviye çıkarılmamalı. Seviye 3 aktif bir kaynak gibi oluşturulmamalı.
3. **Gönderimde teknoloji sabitlenmesi:** mevcut dalga snapshot kuralı korumaya da uygulanmalı. Araştırma tamamlanınca anıtta bekleyen eski gemi aniden güçlenmez veya iyileşmez; yeni gönderim yararlanır. Eski snapshot'ta yeni anahtar yoksa seviye 0. Klan katkıları liderin değil, kendi dalgasının korumasını kullanır. Farklı korumalı kohortlara tek ortak azaltılmış doz uygulamak hata olur.
4. **Hasar devamlılığı:** hasar ve kesir bölme/destek/geri çağırma/yeniden gönderim/klan savaşı/fazla kapasite dönüşü/iniş boyunca taşınır. Araştırma eski hasarı silmez. Ölen yük/rezerv korunmuş gibi iade edilmez. Sağ kalan kohortun yakıtı gerçek dönüş rotasıyla fiyatlanır; yalnız HOME'da iade edilir.
5. **Tamir eşiği:** mevcut %20 ve altı ücretsiz onarım, üstü dock/fatura kuralı korunur. Bu, kısa tur teşviki ve keskin maliyet farkı yaratır. Korumasız Courier için ücretsiz hasar bütçesi EASY 2, HARD 1,44 dakika; max zırh/korumada EASY 5,95, HARD 4,29 dakika. Ücretsiz onarımı değiştirerek kârlılık gizlice düzeltilmez. Industrial etkisi yeni korumanın kazancı gibi gösterilmez.
6. **Kaynak geçmişi ve aktif sezon:** eski kaynak oranı geçmişe dönük yeniden yazılmamalı; kesin geçiş anıyla eski kaynak kapanır, yenisi açılır. İdempotent aktivasyon, aynı işlemde kilit/yeniden kontrol, OUTBOUND/HOLD/RETURNING/sonda/klan hazırlığı dahil önceki boşluk koşulları korunmalı. Owner'ın boş anıtta geçiş talimatı, yalnız HOLD tablosuna bakmak anlamına gelmez. Araştırma yeni açılır; oyuncuya geçmiş bekleme için ek hasar/fatura çıkarılmaz. Yeni veri varsayılanları ve ruleset/snapshot uyumluluğu doğrulanmalı.
7. **Oyuncuya gösterim:** araştırmada net HP/dk örneği ve teknoloji snapshot kuralı; göndermeden önce mevcut cana göre ilk kayıp ve yük gemisi kaybı; HOLD'da kalan can, gerçek HP/dk ve geri çağırma kararı. “6 saat güvenli” yazılmaz. Brüt yük, tahmini A/C/D onarım, gerçek gidiş/dönüş yakıtı, ayrılan rezerv, bekleyen iade ve kayıpta yanan pay ayrı anlatılır. Wiki ve altı dil aynı kurala taşınmalı.
8. **Gelecek radyasyon bombası:** yalnız ek sabit HP/dk kaynağı; şimdiki öneride ek yoğunluk korumadan önce toplanır. Örnek +5 HP/dk, max korumada herkese ek 2,1 HP/dk vurur. HARD max zırhlı Korsan 5,25 yerine 7,35 HP/dk alıp yaklaşık 4 saat 16 dakika dayanır. Bomba seviyesi/süresi/birikimi ayrı tasarım; bu örnek bombayı veya gezegen bekleme hasarını eklemez.
9. **Performans:** yeni hareketli alan kesişimi veya dakika başına tick gerekmez. Kaynak zaman penceresi dozu bir kez bulunup kohort korumasına uygulanır; mevcut olay bazlı ölüm/üretim settlement korunur. Aday matematik çalışmasının kısa sürmesi sunucu/DB yük testi değildir; entegrasyonda mevcut sorgu sayısı ve planlayıcı olayları ayrıca ölçülür. Koruma yeni bir hareket hesaplaması başlatmamalı.
10. **İstisnalar:** radyasyonu iptal eden SHELTER bu çalışmada yok. Yeni sığınak, anıtta iyileştirme, daha dayanıklı yük gemisi, yüksek zırh tavanı veya farklı üretim koşulu 8 saatlik farm sonucunu değiştirir. Aktif oyuncunun taze filo takviyesi aynı filonun gece boyu bırakılmasıyla aynı şey değildir.

## 10. Doğrulama ve dosyalar

- [Hesap aracı](../tools/monument-radiation-study.mjs): gerçek rules fonksiyonları, DB/sunucu yazımı yok. Gemi HP'sinden türetilen hasar modeli araçtan kaldırıldı.
- [24 otomatik test](../tools/monument-radiation-study.test.mjs): önce başarısız test, ardından uygulama ve yeşil sonuç. Radyasyon seviyesi/koruma seviyesi ayrımı ve kullanılmayan seviye 3'ün reddi; 2/6 saat hedefi; bütün gövdelerde aynı HP kaybı ve seviye ilerlemesi; zırh ile korumanın ayrımı; gerçek settlement ile karşılaştırma; korumanın iki kez uygulanmaması; ölüm anı/yük kaybı; canlı T4 erişimi; sekiz saat farmın bitmesi ama ağır nöbetçinin yaşayabilmesi; kesirli HP onarım eşiği/faturası; yakıt/iade/kayıp denklemleri; yaralı gemiler; geçersiz girdiler; üretilen rapor ve üretim duyarlılığı gerçek turla doğrulandı. Süreler oyun hesabındaki tam milisaniye sınırına yuvarlanır; kullanıcı hedefi saniyesi saniyesine zorlanmaz.
- 22 gövde; 416 yakın/uzak tur; 17.280 ev/faz/anıt turu; 20 sabit teknolojili araştırma adımı; 128 kısa NPC savaşı. **Tam sezon ekonomisi veya PvP simülasyonu çalıştırılmadı.**
- [Makine tarafından okunabilir kanıt](evidence/monument-radiation-calibration-2026-10-12.json): güncel sabit model; eski karma sonuçların yerine yazıldı. Rapor statüsü `IMPLEMENTED_PENDING_DEPLOY`. `CURRENT` hesap modeli geçiş öncesindeki tarihsel 2/5 HP/dk karşılaştırmasını ifade eder.
- İlgili mevcut rules regresyonları: HP radyasyon, anıt üretimi/savaşı/kapasitesi/yakıtı, gemi hasarı ve araştırma; **7 dosyada 148 test geçti**. Hesap aracındaki **23 test de geçti**. İki araç dosyasının lint kontrolü ve `git diff --check` temiz. Bu sayılar ilk hesap aşamasına aittir. Yeni araştırmanın entegrasyonu ayrı rules, API, klan ve arayüz regresyonlarıyla doğrulanır; sonuçları aşağıdaki uygulama takibine eklenir.

```bash
nice -n 10 node --import tsx --test tools/monument-radiation-study.test.mjs
nice -n 10 node --import tsx tools/monument-radiation-study.mjs
```
## 11. Uygulama takibi — 2026-10-12

Kullanıcı uygulamayı master dalında yetkilendirdi; deploy yapılmayacak. Üretim EASY 3 / HARD 8 D/dk olarak korunur. Seviye 1/2 radyasyonun ortak tabanı 9 / 12,5 HP/dk; Radyasyon Kalkanı 0–4 hasar çarpanları 1 / 0,84 / 0,68 / 0,52 / 0,42. Core 3, komutan genelinde araştırma; fiyat ve süre mevcut araştırma kuyruğundan gelir.

Dokunulan sözleşmeler: ortak HP doz motoru ve ölüm zamanı tahmini, araştırma kimlikleri/fiyatları, gönderim anındaki teknoloji kaydı, klan katkılarının ayrı teknoloji kayıtları, anıt üretiminin ölüm anında kesilmesi, sunucu ve arayüz tahminleri, araştırma ağacı/Wiki/çeviriler ve aktif sezon için açıkça çalıştırılacak boş-anıt geçişi. Yakıt rezervi ve iade kuralları korunur; koruma PvP hasarını veya gemi HP'sini değiştirmez.

Kontrol edilecek uçlar: eksik araştırma anahtarı=0, yaralı gemide hasarın silinmemesi, kesirli hasarın bölünmüş işlemlerde korunması, farklı korumalı klan katkıları, yük gemisi ölünce farmın bitmesi, araştırma tamamlanınca eski filonun değişmemesi, kaynağın eski zaman penceresinin yeniden yazılmaması, uçuş/probe/klan hazırlığı varken geçişin reddi ve eşzamanlı gönderimle geçişin kilit sırası. Yeni sezonlar yeni kalibrasyonla başlar; canlı eski sezonlar ayrı geçiş işaretiyle korunur. Seviye 3 oluşturulmaz. Alan uçuş hasarı, yeni gezegen hasarı veya radyasyon füzesi bu uygulamaya eklenmez.

Code review düzeltmeleri: hesap aracı da sunucunun `splitForHpLanding/shipHpRepairCost/shipHpRepairMinutes` fonksiyonlarına taşındı; eski onarım adaptörü kesirli hasarı düşürüp %20 eşiğinin hemen üstünü ücretsiz sayabiliyordu. Bu sunucu bug'ı değildi, hesap aracının doğruluk açığıydı. Başarısız testle gösterilip düzeltildi. Koruma önceden azaltılmış bir doza ikinci kez uygulanmıyor; ham doz ve oyuncuya gösterilen alınan doz ayrı tutuluyor. Korsan ve Argosi HP/fiyatları canlı katalogdan okunur. Araştırma kartındaki “maksimum hasar” olarak okunabilecek genel etiket, son araştırma seviyesinin gerçek HP/dk değeriyle değiştirildi. Tür kontrolünde eski kaynak seviyesinin doğrulanmış difficulty değeri kullanılır; cast ile hata gizlenmez. İlk lint kontrolünün bulduğu üç test dosyasındaki sekiz hata düzeltildi: HTTP teklifi gerçek istemci Zod şemasıyla okunur, gereksiz non-null işaretleri kaldırıldı. Bu üç dosyanın **101 testi yeniden geçti**.

Doğrulama: bütün sunucu regresyonları **234 dosya, 3.433 başarılı / 1 mevcut atlanan test**; buna sonradan eklenen dört seviyenin gerçek araştırma tamamlanmasını ve beşinci seviyenin reddini kapsayan bir test de geçti. Rules taramasındaki 2.125 başarılı teste ek olarak yeni sayı sözleşmesini düzelten iki dosyanın 29 testi geçti (toplam benzersiz 2.127 rules testi doğrulandı). Arayüz taraması **443 dosya; 6.035 başarılı, 1 başarısız, 29 mevcut atlanan test** verdi: tek hata, geçici zırh görselinin yeni araştırmayla ortak kullanılmasıydı. Araştırmaya özgü görsel eklendikten sonra ilgili dosyanın **23 testi geçti**; toplam 6.036 benzersiz arayüz testi doğrulandı. Hesap aracının **24 testi** geçti, kanıt JSON'u yeniden üretildi. Rules/server/sim tür kontrolleri normal, web tür kontrolü 6 GB Node heap ile başarılı; varsayılan heap ile OOM yaşandı. Simülasyon workspace'inin yalnız tür kontrolü yapıldı, uzun testleri çalıştırılmadı. Düzeltmelerden sonra kökte `nice -n 10 pnpm lint` yeniden çalıştırıldı: **0 hata / 0 uyarı**. `git diff --check` temiz. Görsel doğrulama için başlatılan yerel 3217 API ve 5187 Vite süreçleri kapatıldı.

Görsel doğrulama: `node tools/visual.mjs out/radiation-shielding/monument --monument-motion`, yalnız `astera_motion_visual_test` ve sahte kullanıcıyla gerçek API/renderer. Masaüstü + 350 px telefon: anıt ve aura hareketi, açık gönderim panelinde hareket, fiyat teklifi ve seçili geri dönüş taşmasız; hata yok. Araştırma kartı/ayrıntısı da son yeşil/sarı görselle 350/1280 px ölçüldü: ayrıntı genişlikleri 334/623 px, scroll genişliğiyle eşit; taşma veya tarayıcı hatası yok. Bu kontrollerde gönderim/geri çağırma işlemi yapılmadı. Görseller `out/radiation-shielding/` altında yereldir.

Araştırma görseli: kullanıcının yeşil ağırlıklı, sarı detaylı radyasyon görünümüyle **built-in `image_gen`** kullanılarak üretildi/düzenlendi. [Kayıpsız kaynak](../assets/source/premium/research/radiation-shielding-v1.png) 1.254 × 1.254; [oyunda kullanılan WebP](../apps/web/public/assets/images/premium/research/radiation-shielding-v1.webp) 384 × 384, 42.598 bayt. Aynı katalogdaki zırh görseliyle ortak kullanım kaldırıldı. Gerçek düzenleme istemi [prompts.json](../assets/source/premium/research/prompts.json) içindeki `radiation-shielding` kaydında saklandı. Yerel API anahtarı veya CLI üretim yolu kullanılmadı.

Uygulama: ortak HP motoru ve ölüm zamanı tahmini aynı koruma çarpanını kullanır. Sunucu/arayüz HP dozları, klan tahminleri ve geri dönüş tahminleri alınan gerçek hasarı gösterir; motorun girdisi ham kaynak dozu kalır ve koruma ikinci kez uygulanmaz. Araştırma ağacı, Wiki ve altı dil güncellendi. Gönderim ekranındaki kayıp süreleri savaş hasarı hariçtir; gerçek savaş sonrasında HOLD kartındaki kalan HP ve kayıp zamanları esas alınır.

Performans: koruma için yeni DB sorgusu veya dakika başına hasar işi eklenmedi. Araştırma erişimi zaten okunan sezon satırından alınır. Kaynak anlık şiddeti anıt başına bir kez bulunur, her dalganın korumasına sabit çarpım uygulanır. Mevcut ölüm sınırı/üretim olayları korunur; gemi adedi tek tek döngüye girmez, kohort adedi önemlidir. Yeni gönderim tahmini kaynakların sabit zaman pencerelerini kullanır; yörüngeyi radyasyon hesabı için yeniden örneklemez. Bunlar mimari/code review bulgularıdır; 300 oyunculu canlı yük ölçümü iddiası değildir.

Aktif sezon: `0154` migration kaynak oranlarını değiştirmez. Önce bütün roller güncellenir, gerekiyorsa 8 anıt düzeni ve hareket açılır; ardından ayrı `activate-monument-radiation` kuru çalıştırması ve yetkili yayında `--yes`. Geçiş eski kaynak penceresini kapatıp yenisini açar ve araştırmayı aynı transaction içinde erişilebilir yapar. Özel kaynak/sığınak korunur. Etiketsiz ama eski seed kimliği ve 2/5 oranı tam eşleşen kaynaklar, migration sonrasında eski image tarafından oluşturulmuş olsa da tanınır. Eksik/çift/yanlış seviyeli/gelecekte başlayan taban kaynak geçişi durdurur. Ayrıntılar [deploy kılavuzunda](deployment.md#12-october-radiation-shielding-explicit-idle-season-calibration).

İstemci sınırı: eski web bundle'ının araştırma enum'u yeni kimliği okuyamaz. Web build'i aktivasyondan önce yayınlanmalı ve açık eski sekmeler yenilenmelidir; dosyaları yayınlamak çalışan JavaScript'i kendiliğinden değiştirmez. Bu iş genel bir zorunlu istemci güncelleme protokolü eklemez. Aktivasyon öncesinde bu yayın sınırı sağlanmalıdır.

## 12. Kullanıcı örneği: 10 Korsan + 1 Argosi, mesafe 1.500

Koruma 0, Endüstri 0, zırh 0; yalnız gemi üretiminin gerektirdiği Mühendislik 2, Gemi Gücü 2 ve Gemi İtkisi 2 mevcut. Tam HP ile varış, savaş hasarı yok, bütün üretim bu oyuncuya ait. Hareket nedeniyle gerçek dönüş mesafesi değişebilir; bu özel hesapta gidiş/dönüş ayrı ayrı 1.500 kabul edildi. Hareketli anıtta uçuş radyasyonu yok; yalnız HOLD hasarı 12,5 HP/dk.

Gerçek `missionFuel` ve `priceMonumentReturn`: toplam yakıt **210 D** (Korsanlar 192, Argosi 18). Ayrılan dönüş rezervi net masraf değildir; eve dönenlerin kullanılmayan payı iade edilir. `applyHpDose` → `splitForHpLanding` → `shipHpRepairCost(...,100)` ile 60 dakika sonunda onarım **30.778 A + 12.047 K + 173 D**. Mevcut üretim emeği değerlemesi `RESOURCE_VALUE` (32 A = 16 K = 1 D) ile tamir 1.887,75 D eşdeğeri; yakıt dahil **2.097,75 D / 60 = 34,9625 D/dk** başa baş üretim.

| Bekleme | Yakıt + tamir, D eşdeğeri | Başa baş, D/dk |
|---|---:|---:|
| 21,6 dk — bütün gemiler ücretsiz onarım sınırında | 210 | 9,7222 |
| 60 dk | 2.097,75 | 34,9625 |
| 81 dk | 2.757,78125 | 34,0467 |
| 100 dk | 3.354,78125 | 33,5478 |

Yuvarlama hariç, bütün gemiler ücretli onarımdayken eşik yaklaşık `31,44 + 210 / bekleme_dakikası` D/dk'dır. 31,44 D/dk hasarın onarım emeği, ikinci terim ise uçuşun sabit yakıt maliyetidir. Ücretsiz onarım aralığında bu formül uygulanmaz.

Argosi 108. dakikada, Korsan 120,64. dakikada ölür. Yük/rezerv kaybı nedeniyle 108 dakika ve sonrası aynı başa baş formülüyle değerlendirilemez. 60 dakika nöbetin mevcut 8 D/dk üretimi 480 D getirir; yakıt + D tamir sonrası kasada +97 D kalırken A/K tamiri dahil ekonomik sonuç **−1.617,75 D eşdeğeri**. 26.000 kargo bu sürelerde sınırlayıcı değildir. Bu sayı üretim artışı kararı değildir: küçük filo ile büyük nöbetin masrafı farklıdır, toplam anıt üretimi gemi sayısıyla artmaz. İlk gemi yatırım bedeli sağ kalan gemiler için her tur yeniden masraf yazılmadı; savaşta veya radyasyonda kayıp olursa ayrıca eklenir. Döteryum eşdeğeri bir üretim emeği karşılaştırmasıdır, garantili ticaret kuru değildir.
