# Başlangıç Galaksisi ve Koloni Gemisi: Uygulama Planı

**Tarih:** 2026-11-04 · **Durum:** Faz 1–10 kodu tamam, commit ve deploy yok; açık kalan iki iş: S22 ölçümü ve kademeli yük testi (owner ile) · **İncelenen kod:** `b0053dd3`

Bu belge deploy, migration veya prod sorgusu izni vermez. Kararlar burada tutulur.

## 1. Özet

Yeni oyuncu ana galaksiye doğrudan girmez. Vantage'ın yanında duran küçük, gerçek çok oyunculu bir galakside, arızalı bir Koloni Gemisi'yle başlar. 3–5 gün boyunca kaynak üretir, sonda yollar, teleskop ve radar kullanır, filo gönderir, küçük savaşlara girer. Bütün bunları gerçek oyuncularla yaşarken geminin beş arızalı sistemini onarır. Motor onarılınca gemi kalkar, animasyonla ana galaksiye geçer, tüketilir ve yerinde oyuncunun ilk gezegeni oluşur.

Çözülen sorunlar:

- **Dayak:** Yeni oyuncu, oyunu öğrenmeden güçlü oyuncularla karşılaşmaz.
- **Öğrenme eğrisi:** Sistemler birer birer ve ihtiyaç duyulduğu anda açılır.
- **İçerik:** 3–5 günlük yeni bir oyun bölümü eklenir.

Mimari tek cümlede: **aynı gökyüzü, ayrı veri.** Gemi gezegen değildir, kendi tabloları ve servisleri vardır. Saf oyun kuralları ve ekranlar ortak kullanılır. Bu galaksiye özel bir kural gerekirse ana kuralı değiştirmeden ek olarak yazılır.

## 2. Kararlar

### 2.1 Owner kararları

| No | Karar |
|---|---|
| K1 | Galaksi, Vantage'ın gerçekten yanındadır. Ana galaksi görünür, gezegenleri keşfedilmemiş noktadır. Teleskop ve radar oraya ulaşmaz, ana galaksi olayları bu oyunculara gönderilmez. Ana galaksideki gezegenler ile etkileşime girilemez (sonda yollama, filo yollama, oradaki eventlere filo gemi vs yollama.) Yani aradaki bağ tamamen ayrıdır. |
| K2 | Harita ortak, veri ayrıdır. Başlangıç galaksisi Vantage'a bağlıdır. |
| K3 | Gemi gezegen sayılmaz: kendi tabloları ve servisleri vardır. Kurallar ve ekranlar ortaktır. Özel yeni kurallar eklenebilir. |
| K4 | Süreç, 3–5 gün süren gerçek oyundur. Kısa bir onboarding değildir. |
| K5 | Bu galakside tier yoktur. |
| K6 | Beş arızalı sistem vardır: Rafineri modülü, Keşif anteni, Savunma sistemleri, Kargo ve hangar, Yıldızlararası motor. |
| K7 | Onarım normal oyun mekanikleriyle yapılır, ayrı mini oyun yoktur. Motor için gereken özel parça, tarafsız enkaz bölgelerinden toplanır. |
| K8 | Sistemler ve menüler kademe kademe açılır. (Oyundaki öğrenme eğrisi fazla oldugu için yavaş şekilde oyuncuya öğretilir, oyuncu ısıtılır) |
| K9 | Etkileşimler gerçektir: sonda gerçekten karşı tarafın ekranına düşer, filo gerçekten haritada hareket eder. Yalnız görev olarak yaşanmazlar. |
| K10 | Kalıcı kayıp sınırlıdır. Savaşta yok olabilir ama savaş sonrası bazı gemilerin hayatta kalabilecegi bir senaryo düşünülmeli (örn: savaş round sayısını kısıtlamak veya buradaki savaş gemilerinin can'ını biraz arttırmak yada atagını biraz düşürmek gibi). Kazanan küçük bir kaynak alır, yağma oranı düşüktür. |
| K11 | Tarafsız enkazlar, terk edilmiş istasyonlar ve asteroitler paylaşılır. NPC hedefler gezegen gibi görünebilir, veride gezegen sayılmaz. |
| K12 | FlightSchool bu yapıya uygun olarak yenilenir. |
| K13 | Gemi kolonizasyon seferinde tüketilir. Göç animasyonludur, ana galakside yeni gezegen oluşturulur. |
| K14 | Kayıt ölçümü gerekmez, kod maliyeti kriter değildir. Hedef, tam sürümde iyi bir akıştır. |

**K10 hakkında not:** Owner, gerçek savaş koduyla yapılan ölçüme bakarak savaş temposunu yarıya indirdi: ana oyunda 0,20, burada 0,10. Gemi yok olabilir, ama savaştan daha çok gemi çıkar (§3.5). Hasar yarı olunca Aegis 1 PvP'yi kapattığı için Aegis de aynı oranda yarıdır. Diğer seçenekler ölçülüp elendi:

- **Can veya atak çarpanı:** Sonucu değiştirmez, çünkü `tempoScale` iki tarafın tur başına kaybını sabit orana eşitler. İki tarafa %50 fazla can veya %30 az atak vermek aynı sonucu verdi.
- **Raunt sınırı:** 4 rauntta ezici savaş aynı kalır (16 Ok → 3 Ok, savunan %0), kesin zafer %52'den %7'ye düşer.
- **Kurtarma payı:** Savaş bitince yok olanların yarısı ağır hasarlı kurtulur. Önerildi, seçilmedi.

### 2.2 Alınan kararlar

Owner bu satırların hepsini 2026-11-04'te kabul etti. Biri değişirse ilgili bölüm güncellenir.

| No | Konu | Karar | Değişirse etkilenen |
|---|---|---|---|
| A1 | Prolog | §3.9'daki 5 adımlı, yaklaşık 3 dakikalık akış | Faz 9 |
| A2 | PvP başlangıcı | Aegis 1 onarılınca 12 saat kalkan, ilk saldırıda erken düşer. Göç için oyuncuya saldırmak şart değildir. | §3.6, Faz 6 |
| A3 | İnişte taşınan | İlk sezon paketi ve tavanlı ambar | §3.8, Faz 7 |
| A4 | Kim gemide başlar | Yalnız hiç oynamamış hesaplar | §3.2, Faz 2 |
| A5 | Sezon sonu | Gemi sezondan bağımsız yaşar, sezonun son 5 gününde kalkış yeni sezonu bekler | §3.8, Faz 7 |
| A6 | Sohbet | Bu galaksinin kendi kanalı. Az nüfusta sessiz kalabilir. | Faz 8 |
| A7 | İniş noktası | Ana galakside 3 aday arasından oyuncu seçer. Sunucu yalnız o an önerilen üç adresi kabul eder; adres gitmişse başka yere koymaz, `LANDING_GONE` ile yeni adresleri gösterir (owner, 2026-11-05). | §3.8, Faz 7 |
| A8 | Hikaye ve adlar | "Sığlık" çalışma adı (§3.11). "Koloni Gemisi" adı korunur, oysa ana oyunda "koloni" ele geçirilen dünyadır ve iniş başkent oluşturur. | Metinler |
| A9 | Gemide kalma sınırı | Göçe hazır olan veya 14 günü geçen gemi artık oyuncuya saldıramaz, NPC'ye saldırabilir. Sınır olmazsa gemide kalıp yeni gelenleri ezmek mümkündür. | §3.6, Faz 6 |
| A10 | Bot isimleri | Owner'ın 100 isimlik listesinden ana galakside oturmayanlar kullanılır. Yetmezse owner yeni isim ekler, isim üretilmez. | §3.12, Faz 8 |
| A11 | Bot kalkışı | Bot yalnız ana galakside bot koltuğu açılınca iner. Diğerleri yavaş oynar veya uykuya geçer. Pano yalnız gerçekten inenleri gösterir, bu yüzden seyrek dolar. | §3.12, Faz 8 |
| A12 | Telefon bildirimi | Radar uyarısı dahil push bu galakside ücretsizdir. İnişten sonra ana oyunun ücretli Bildirim Merkezi kuralı geçerlidir, iniş kartı bunu söyler. | §3.10, Faz 8 |
| A13 | Vantage dolarsa | Gemi o an açık olan ana galaksiye iner ve oyuncu onay ekranında bunu görür. Sınır olmazsa `SHARD_FULL` gemiyi kalıcı olarak bekletir. | §3.8, Faz 7 |
| A14 | Filo onarım bedeli | Ana oyunun onarımı kullanılır, bedel ¼, süre 12 katıdır. %40 hasarlı 6 Ok 183/73 ve 18 dakika, %95 hasarlı 6 Ok 434/173 ve 43 dakika tutar. Her yara ödenir; inişte hiçbir hasar kendiliğinden geçmez, ana oyunda olduğu gibi (sahip, 2026-11-06). | §3.5, Faz 6 |
| A15 | Savaş enkazı | Savaşta yok olan gemilerin değerinin %10'u (ana oyunda %30), 40 dakika durur, 100 kaynağın altında alan oluşmaz. Ana oyunun enkaz yarışını öğretir. | §3.5, Faz 6 |
| A16 | Gemiyi atlama | Atlama yok. Yeni hesap, arkadaşı ana galakside olsa bile önce gemiden geçer. | §3.2, Faz 2 |
| A17 | Günde tek oturum | Kabul edilir: yaklaşık 9 gün. 3–5 gün hedefi günde en az iki girişe göredir. | §3.4 |
| A18 | Ana galaksiden görünüm | Başlangıç galaksisi, ana galaksinin gökyüzünde uzak ve dokunulamaz bir ışık kümesidir. Oyuncu indikten sonra geldiği yeri görür. Veri taşımaz. | §3.8, Faz 7 |
| A19 | Geminin 3D modeli | Owner, Codex konseptlerinden üretir: 3 gövde × 3 hâl. Tek tek sistemleri modelin üstündeki ucuz ışıklar gösterir. | §3.11, Faz 0 |
| A20 | İnişten sonraki boşluk | Değişmez: 3 gün girmeyenin gezegeni silinir (`idleDays`). Oyuncu günler harcamış olsa da aynı kural geçerlidir, iniş kartı bunu söyler. | §3.8, Faz 7 |

## 3. Oyun tasarımı

### 3.1 Gemi ve gezegen

| Özellik | Koloni Gemisi | Gezegen |
|---|---|---|
| Temel amaç | Hazırlanmak ve göç etmek | Kalıcı medeniyet kurmak |
| Üretim | Sınırlı rafineri modülleri | Gelişmiş maden tesisleri |
| Gelişim | Geminin onarılması | Ekonomik ve askerî büyüme |
| Konum | Başlangıç galaksisinde | Ana galakside |
| Savunma | Hafif savunma sistemleri | Tam kapsamlı savunma |
| Filo | Küçük gemiler ve sondalar | Tüm gemi sınıfları |
| Son durum | Kolonizasyon seferinde tüketilir | Kalıcı olarak varlığını sürdürür |
| Kademe | Yok | Çekirdeğe bağlı tier |
| Savaş | Hasar ve Aegis yarıdır, gemi yok olabilir | Tam hasar, tam Aegis |
| Menüler | Kademeli açılır | Hepsi açık |

**Gemide seviye gösterilmez.** Ekran "Rafineri modülü · Onarım 3/4" der. Sebep: gemide Rafineri 4 gören oyuncu, gezegene indiğinde Rafineri 2 görürse bunu ceza sanır. Onarım aşaması gezegen seviyesiyle kıyaslanmaz.

### 3.2 Kim nereden başlar

| Hesap durumu | Akış |
|---|---|
| Yeni kayıt veya hiç oynamamış eski hesap | Koloni Gemisi |
| Gemisi var | Koloni Gemisi |
| Geçmişi var, gezegeni yok | Mevcut sunucu ekranı |
| Gezegeni var | Mevcut oyun |
| Admin | Mevcut akış |

"Oyun geçmişi", `joinSeason` içindeki mevcut kontrolle aynıdır: `accounts.first_season_started_at` doluysa veya `legacy_participation`, `season_results`, `players`, `lifetime.seasons` kayıtlarından biri varsa hesap oynamış sayılır. Eski oyuncular her sezon doğrudan ana galaksiye gider, çünkü 3–5 günlük süreci her sezon tekrarlamak cezaya döner.

Galaksinin yeri doluysa yeni hesap gemide bekletilmez, doğrudan ana galaksiye gider ve mevcut koruma geçerli olur. İnen bir gemi bir daha açılmaz (`vessels.account_id` benzersizdir).

### 3.3 Yolculuk

| Zaman | Oyuncu ne yaşar | Bir sonraki dönüşün sebebi |
|---|---|---|
| İlk oturum (~20–25 dk) | Prolog, sahiplenme, ilk sonda; kasalar, Rafineri 3, Depo 1, Tersane 1 ve Ocak 3 siparişleri. İlk Kazıcı en yakın asteroide gider, döner ve ganimet toplanır. Ardından veda. | Süren onarım ve sıradaki adımın saati |
| 1. gün | Keşif anteni 2 Sohbeti açar. Tersane açılır: iki karakol gösterilir, oyuncu sondalar, karşı sınıfı kurar ve ilk baskınını kendisi seçer. Kazıcı asteroide gider. Oyuncu bir asteroidin başkası tarafından boşaltıldığını görür ve "Bunu kim yaptı?" diye sorar. | Onarım, madencilik ve baskın dönüşü |
| 2. gün | Teleskop çevredeki hareketi görünür kılar. Kendi seferinden sonra Radar, gemiye yaklaşıp dönen bir korsan gözcüsünü gösterir. Aegis isteğe bağlıdır: onaran oyuncuya korsanlar ve diğer gemiler saldırabilir, o da bir savaştan sonra gemilere saldırabilir. 12 saatlik oyuncu kalkanı başlar. | "Kalkanım bitiyor", savaş raporu |
| 3. gün | Küçük akınlar, karşılıklı sondalar, ilk rakip. Rapordan "Neden yenildim?" sorusu doğar. Araştırma ve filo kararları anlam kazanır. | Akın sonucu, açılan enkaz |
| 4–5. gün | Motor gövdesi, itki parçası avı, yakıt. Komşular kalkmaya başlar. | Son parça, son yakıt |
| Göç | Oyuncu kalkar, ana galaksiye geçer, gezegeni oluşur. | Ana oyun başlar |

Ana galaksiye indikten sonra mevcut koruma devreye girer: 72 saatlik ilk oyun kalkanı, ±1 kademe bandı ve kademe 1–3 için düşük yağma.

FlightSchool'un 11 dersinin hepsi (gezegen, kaynak, üretim, teleskop, madencilik, sonda, filo, akın, radar, savunma, gerçek galaksi) bu yolculukta gerçek oyun olarak yaşanır. Çekirdek, kademe, koloni, klan, Dominion ve Honor burada öğretilmez, inişten sonra tanıtılır (§3.8).

### 3.4 Beş sistem ve onarım merdiveni

Her onarım normal bir üretim emridir: kaynak öder, kuyruğa girer, süre dolunca biter. Yapılacak iş ana oyundakiyle aynıdır, adı "onarım"dır. Dört adımda ayrıca gerçek bir oyun eylemi şarttır: ilk sonda raporu, ilk madencilik dönüşü, ilk savaş raporu ve 3 itki parçası.

İlk değerler (`alaşım/kristal · süre`):

| Sistem | Adım | Bedel | Şart | Açtığı |
|---|---|---|---|---|
| Rafineri modülü | Alaşım Rafinerisi 1 | Prolog sonunda hazır | | Alaşım üretimi, Toplama, Gemi ekranı |
| | Alaşım Rafinerisi 2 | 154/20 · 10 sn | | |
| | Kristal Ocağı 1 | 44/33 · 10 sn | | Kristal üretimi |
| | Kristal Ocağı 2 | 77/58 · 60 sn | | |
| | Alaşım Rafinerisi 3 | 548/69 · 90 sn | | |
| | Depo 1 | 300/150 · 2 dk | | Depo tavanı, korumalı pay |
| | Kristal Ocağı 3 | 274/206 · 5 dk | | |
| | Alaşım Rafinerisi 4 | 886/111 · 60 dk | | |
| | Döteryum Rafinerisi 1 | 400/300 · 1 sa | | Döteryum, uçuş yakıtı. Hediye: 20 Döteryum |
| | Döteryum Rafinerisi 2 | 800/600 · 2 sa | Kristal Ocağı 2 | |
| Keşif anteni | Keşif anteni 1 | 250/120 · 30 sn | Kristal Ocağı 1 | Sonda, İstihbarat, karanlık noktalar |
| | Keşif anteni 2 | 600/350 · 20 dk | İlk sonda raporu | Sohbet, daha dar sonda bandı |
| Kargo ve hangar | Tersane 1 | 800/300 · 3 dk | Keşif anteni 1, Rafineri 3 | Filo, asteroit. Hediye: 1 Kazıcı, 2 Ok |
| | Hangar 2 | 1000/350 · 30 dk | İlk madencilik dönüşü | Hangar odası 20'den 32'ye, ikinci saldırı yuvası, Araştırma |
| Savunma sistemleri | Teleskop 1 | 700/500 · 40 dk | Tersane 1 | Trafik, gözlem |
| | Radar 1 | 500/380 · 1 sa | Teleskop 1 | Uyarı halkası, korsan gözcüsü |
| Yıldızlararası motor | Motor gövdesi | 2200/1100 · 4 sa | Rafineri 4, Kristal Ocağı 3, Keşif anteni 2, Hangar 2, Radar 1 | |
| | İtki montajı | 1800/1200 · 4 sa | 3 itki parçası | Yakıt deposu |
| | Yakıt | 90 Döteryum | İtki montajı, Döteryum 2 | Göç |

**Olayla açılanlar.** İlk madencilik dönüşü enkaz alanlarını açar. Karakol baskını, Onarım İstasyonu ve savaş simülatörü Tersane 1 ile açılır; gemilere saldırı Aegis 1 ve ilk savaş raporunu birlikte ister (§3.6, §3.7; owner, 2026-11-08, N2–N3).

**Teleskop 1 ve Radar 1 göç için zorunludur, Aegis 1 değildir** (owner, 2026-11-08, N3). Aegis PvP'nin ve korsan akınının kapısıdır: onaran oyuncu korunur ama hedef olur.

**Parça avı, Motor gövdesi şartları karşılanınca başlar** (§3.5, §3.7 `drive`), gövde onarımını beklemez. Böylece 4 saatlik gövde onarımı sırasında oyuncunun yapacak işi olur. Süre hesabı da buna göre yapıldı.

**Kristal Ocağı şartları neden var.** Depo tavanı üretime bağlıdır. Motor gövdesinin 1100 kristali Ocak 1 tavanına (551), Döteryum 2'nin 600 kristali Ocak 0 tavanına sığmaz. Şart olmasaydı oyuncu sebebini anlamadığı bir fiyatla karşılaşırdı (`starter-ladder`). İsteğe bağlı adımlarda da aynı kural geçerlidir.

**İlk oturum.** Açılış 930/300 ve havuzda 60 alaşımdır. Rafineri 2, Keşif anteni 1,
Rafineri 3, Tersane 1, Ocak 3 ve Keşif anteni 2 kasaları toplam 1.750/1.190 verir;
her biri yalnız bir kez, ilgili onarım bittikten sonra basılı tutarak açılır. İlk oturum Tersane
ve Ocak 3 siparişlerine ulaşır; +1 saatte anten 2, +3 saatte Hangar 2, +8 saatte Teleskop 1
hedeflenir. Göçün 2.000/1.000/50 ambar tavanı değişmez. Tersane 1 bittiğinde o anda 300 birim
çevrede asteroit yoksa 150–300 birim uzağa ortak kaya kurallarıyla bir kaya konur ve saatlik arzdan sayılır.
Yörünge eğimleri kürenin kutuplarını da kapsar; dar bir ekvator kuşağı kutuptaki gemiye bu garantiyi veremiyordu.

**İsteğe bağlı onarımlar** göç için şart değildir, karar yaratır: Aegis 1 (315/237 · 45 dk, Radar 1 ister; savunma, korsan akını, PvP), Rafineri 5 (1433/180 · 3 sa), Ocak 4 (444/334 · 2 sa), Depo 2 (600/300 · 1,5 sa), Keşif anteni 3 (1200/700 · 2,5 sa), Hangar 3 (2000/700 · 3 sa), Teleskop 2 (1500/1100 · 2 sa), Teleskop 3 (2600/1900 · 4 sa, ikinci gözlem yuvası, `telescopeSlots`), Radar 2 (1000/760 · 2 sa), Radar 3 (1800/1300 · 3 sa), Aegis 2 (504/379 · 1,5 sa), Araştırma. Aegis 3 ve üstü burada yoktur (§3.5).

**Araştırma.** Ana oyunun gerçek projelerinden bir alt küme kullanılır: `SHIP_POWER`, `SHIP_ARMOR`, `SHIP_PROPULSION`, `PROSPECTOR_HOLDS`. Her biri en fazla 2 seviyedir. Bedeli ve süresi Faz 1'de ana oyunun ilk seviyelerinden alınır. Gemi tüketilince araştırma da biter, gezegene geçmez. Araştırma satırı bunu baştan söyler: "Bu araştırma gemiyle kalır."

**Süre hesabı.** `starter-pacing` testi gerçek merdiveni ve gerçek üretim kurallarını oynar. Varsayımlar: 930/300 açılış (+60 havuz), inşaat ve tersane kuyruğu ayrı, kuyruk derinliği 3 (ana oyundaki `queueDepth`), gerçek toplama ve depo tavanı, 20 dakikalık oturum, Tersane'den sonra oturum başına 2 Kazıcı seferi (+300/+100), Motor paneli açılınca oturum başına en fazla 1 parça, bir kez 1800/700 filo alımı, yağma ve savaş kaybı yok.

**2026-11-08 temposu (N3–N4: savaş yolda yok, motor parçaları 4 sa, Radar kapıda).** Aynı model: günde 1 oturum 6,8 gün, 2 oturum 3,4 gün, 3–4 oturum 2,5 gün, 15 oturum 1,7 gün. Hiçbir oturum düzeni ilk gün içinde göç ettirmez. Gemi motoru ya da yakıtı değil, onarımları ve kaynağı bekler; Döteryum Rafinerisini erken almak süreyi uzatır, çünkü bedeli depodan çıkar. Planın "en hızlı ~20 saat" hedefi bu modelde tutmaz (`starter-pacing`).

Önceki ölçüm (2026-11-04 merdiveni, 8 saatlik motor, savaş raporu kapıda):

| Oyuncu | Bitiş | 1./2./3./4./5. gün sonunda biten adım (19 üzerinden, yakıt hariç) |
|---|---|---|
| Günde 4 oturum | 3,4 gün | 9 / 15 / 18 / 19 / 19 |
| Günde 3 oturum | 3,9 gün | 9 / 14 / 18 / 19 / 19 |
| Günde 2 oturum | 4,8 gün | 8 / 12 / 17 / 18 / 19 |
| Günde 1 oturum | 8,8 gün | 6 / 9 / 11 / 13 / 17 |
| Aşırı aktif (günde 15 oturum) | 2,7 gün | 11 / 17 / 19 / 19 / 19 |

- Keşif anteni 3 ve Teleskop 2 isteğe bağlı oldu. Zorunlu kalsalar günde 2 oturum 4,8 gün sürüyor, oyuncunun seçimi de kalmıyordu.
- Motor adımları 5 saatten 8 saate çıktı, çünkü sınırı en hızlı oyuncu belirliyor; owner 2026-11-08'de 4 saate indirdi (N4). Günde 15 oturum ve oturum başına 10 Kazıcı seferiyle bile bitiş 2,3 gündür.
- Günde tek oturumda toplama tavanını 24 saate çıkarmak tek başına süreyi değiştirmiyor. Buna kuyruk derinliği 4 veya iki kat madencilik eklenirse süre ancak 7,8 güne iniyor. Bkz. A17.
- Savaş kaybı modele girmez. Filosu yok olan oyuncu yeniden üretmek zorunda değildir, hiçbir onarım adımı savaş gemisi istemez (§3.6).
- Bu sayılar modeldir. Gerçek değer oyun testinden sonra ayarlanır.

### 3.5 Çok oyunculu etkileşimler

Hepsi gerçek uçuş ve gerçek olaydır. Hiçbiri senaryo değildir.

**Sonda ve istihbarat**

- Oyuncu başka bir gemiye sonda yollar. Sonda gerçek bir uçuştur ve ana galaksideki gibi gidip döner: ölçümü varınca alır, rapor sondayla birlikte eve gelince okunur (sahip, 2026-11-07; `vessel_probe_reports.delivered_at`, `landVesselProbe`). Hedefe "biri seni sondaladı" haberi varışta düşer.
- Rapor kaynakları, filoyu ve **onarım ilerlemesini** bant olarak verir (`fuzzBand`, `classReading`).
- Bandın genişliği Keşif anteni aşamasına bağlıdır. `probeAccuracy(aşama − 1, 0)` kullanılır, çünkü doğruluk 0,80'de durur ve aşama doğrudan verilirse üçüncü aşama neredeyse hiçbir şey kazandırmaz. Bant, gerçek değerin yaklaşık 2,6 / 2,0 / 1,5 katı genişliğindedir. Geniş bant gören oyuncu, keşfi neden geliştirmesi gerektiğini yaşayarak öğrenir.
- Hedefin radarı sondayı yakalayabilir (`detectChance`): Radar 0–3 için %15, %28, %41, %54. Yakalarsa hedefe "Biri seni sondaladı" bildirimi düşer.
- **Bir gemiye gelen ilk sonda her zaman fark edilir.** Radar gelmeden önce %15 şans, çoğu oyuncunun bu anı hiç yaşamaması demektir. Bu kural herkes için aynıdır, botlar da ilk gün içinde yeni komşularını sondalar.
- Sonda, hedefin radar menzilindeyken haritada görünür. Radarı olmayan oyuncu uçuşu görmez, yalnız bildirimi alır. Radar isteği buradan doğar.
- Rapor, görülen anın kaydıdır. Sonradan değişmez, üstünde tarihi yazar (`REMEMBERED`).

**Radar ve teleskop**

- Teleskop menzilindeki filonun içeriği, çıkış noktası ve hedefi görünür.
- Yalnız radar menzilindeki filo, türü bilinmeyen hareketli bir işarettir (`kind: 'unknown'`).
- Radar 2 saldırının yönünü de söyler (`radarRevealsBearing`). Büyüklük Radar 4'te, köken ve bileşim Radar 5'te açılır, yani ana galaksiye kalır.
- Oyuncu erken uyarının değerini sürede görür:

| Seviye | Teleskop menzili | Radar menzili | Ok filosu için en uzun uyarı |
|---|---|---|---|
| 0 | 150 (çıplak göz) | 0 | Yok |
| 1 | 450 | 600 | 6,6 dk |
| 2 | 750 | 1000 | 11 dk |
| 3 | 1100 | 1500 | 16,5 dk |

Uyarı, saldıran menzil dışından geliyorsa bu kadar sürer. En yakın komşu 250 birim uzakta olabilir, Ok bu mesafeyi 2,75 dakikada alır.

Ana oyunun menzilleri burada kullanılamaz: Teleskop 1 bile 2137 birim görür ve bu küçük galaksinin neredeyse tamamını kapsar, dolayısıyla teleskobun değeri öğrenilemez.

**Küçük PvP**

- Savaş, ana oyunun `resolveBattle` çözücüsüyle yapılır (`maintenance = true`, yani %95 ve üstü hasarlı gemi ateş etmez). Karşı sınıf döngüsü, 8 raunt, savaş içi kaçış, 10 saniyelik temas (`engagementEndsAt`), rapor ve tekrar izleme aynıdır, öğrenilen şey inişte de geçerlidir.
- **Tek fark hızdır (K10).** Savaş temposu burada 0,10'dur, ana oyunda 0,20. Hasar yarıya iner, gemi yok olabilir, ama savaştan daha çok gemi çıkar. Aegis de aynı oranda yarıdır: Aegis 1 75, Aegis 2 113 can verir.
- **Aegis neden yarı.** PvP ancak Aegis 1 onarılınca açıldığı için her PvP hedefinde Aegis vardır. Hasar yarıya inip Aegis 150 kalsaydı 6 Ok, 3 Ok + Aegis 1'e saldırınca %86 boş dönerdi. Ana oyunda bu oran %13'tür.
- **Aegis 2'den ötesi yok.** Aegis 2 isteğe bağlı bir karardır. Aegis 3 ve üstü ana galaksiye kalır, çünkü burada ucuza PvP'yi kapatır. 6 Ok → 3 Ok saldırısında boş dönüş Aegis 1'de %27, Aegis 2'de %70, Aegis 3'te (807/606) %91, Aegis 4'te %98'dir.

Ölçüm (gerçek `resolveBattle`, savunanda Aegis 1, kaçan gemiler kalan sayılır):

| Savaş | Kalan gemi, saldıran / savunan | Ana oyunda | Kesin / kısmi / boş | Ana oyunda |
|---|---|---|---|---|
| 3 Ok → 2 Ok | %26 / %70 | %5 / %69 | 15 / 42 / 43 | 17 / 30 / 53 |
| 6 Ok → 2 Ok | %90 / %90 | %63 / %58 | 60 / 34 / 6 | 100 / 1 / 0 |
| 6 Ok → 3 Ok | %71 / %65 | %29 / %45 | 34 / 40 / 27 | 75 / 12 / 13 |
| 6 Ok → 4 Ok | %52 / %46 | %15 / %44 | 31 / 59 / 9 | 48 / 32 / 20 |
| 6 Ok → 6 Ok | %12 / %57 | %7 / %53 | 2 / 49 / 49 | 9 / 45 / 46 |
| 10 Ok → 6 Ok | %71 / %41 | %42 / %35 | 39 / 60 / 2 | 93 / 6 / 1 |
| 16 Ok → 3 Ok | %100 / %46 | %99 / %21 | 100 / 0 / 0 | 100 / 0 / 0 |
| 16 Ok → 10 Ok | %73 / %37 | %55 / %28 | 49 / 51 / 0 | 99 / 1 / 0 |

Aegis'siz eşit savaş (6 Ok ↔ 6 Ok) %24–28 gemi bırakır, ana oyunda %17–19. Eşit filoya saldırmak kötü bir karardır, oyuncu önce sonda yollayıp oranı görmeyi burada öğrenir.

- **Hasar.** Savaştan çıkan gemi yarasıyla çıkar ve her yara Onarım İstasyonu'nda ödenir (sahip, 2026-11-06: ana oyunda olduğu gibi inişte iyileşme yok): bedel ana oyunun ¼'ü, süre 12 katıdır (A14). %40 hasarlı 6 Ok 183/73 ve 18 dakika tutar.
- **Filonun tamamı yok olursa dönüş uçuşu olmaz,** ana oyunla aynıdır.
- **Yağma.** Kesin zaferde %10, kısmi zaferde %5. Gemilerin yük sınırı (Ok 30, Kurye 1000) ayrıca sınır koyar. Boş dönüşte yağma yoktur.
- **Savaş enkazı (A15).** Savaşta yok olan gemilerin değerinin %10'u, 40 dakika duran bir enkaz alanı olur. 6 Ok yok olursa yaklaşık 255 kaynaktır, 100 kaynağın altında alan oluşmaz. Yok olan geminin değerinden hep düşük olduğu için kendi kendine savaşarak kazanılamaz.
- **Kural nasıl öğretilir.** Filo gönderme ekranında ve savaş raporunda şu satır durur: "Burada hasar ve Aegis yarıdır. Ana galakside aynı savaş iki kat hızlı geçer." Oyuncu kuralı ilk kaybından önce öğrenir.
- **Oran tablosu.** Ana oyunun tablosu (`combatOutcomeTable`) bu tempoda geçerli değildir. Wiki ve botlar bu galaksinin ölçülmüş tablosunu okur, simülatör aynı tempoyla çalışır:

| Güç oranı | 1:1 | 1:1,2 | 1:1,4 | 1:1,6 | 1:1,8 | 1:2 | 1:2,5 | 1:3 |
|---|---|---|---|---|---|---|---|---|
| Zayıf taraf korur | %24 | %31 | %36 | %38 | %52 | %65 | %80 | %85 |
| Güçlü taraf kaybeder | %68 | %47 | %30 | %24 | %13 | %6 | %4 | %2 |

**Paylaşılan noktalar**

| Tür | Görünüm | Nasıl kullanılır | Ne verir | Arz (ilk değer) |
|---|---|---|---|---|
| Asteroit | Mevcut asteroitler, yörüngede | Kazıcı | Alaşım, kristal, nadiren Döteryum | Aktif gemi başına saatte 0,5 kaya, kaya başına 400–800 cevher |
| Enkaz alanı | Mevcut enkaz görseli | Kazıcı | Kaynak, bazen itki parçası | 6 alan, 300–600 kaynak, boşalınca 2 saatte yenilenir |
| Terk edilmiş karakol | Issız gezegen veya istasyon | Muhafızı yenen filo | Kaynak (250/450/900), bazen itki parçası | 8 karakol, 3 seviye, 6 saatte yenilenir |

**İlk av'ın iki karakolu (owner, 2026-11-08, N6–N7).** Tersane 1 bittiğinde gemiden 300–450 birim uzakta (2 Ok için 3–5 dk) iki karakol garanti edilir: Muhafız tutan 1. seviye (2 Ok'un alabileceği) ve Ok ya da Kargı tutan 2. seviye (karşı sınıf ister). Yalnız eksik olan eklenir, düşmüş karakol sayılmaz; galaksiye kendi 8 karakolunun üstüne en fazla 8 eklenir (`firstOutposts`, `ensureFirstOutposts`). Kimsenin değildir, herkes baskın yapabilir.

Kazıcı arzı bilinçli olarak sınırlıdır. Sefer başına 200 cevher, sınırsız olsa üretimi ezer ve 3–5 gün hedefini bozar. Kaya sayısı aktif gemiye göre `asteroidTargetPerHour` ile belirlenir, çünkü `planAsteroidHour` ana oyunun oyuncu başına 0,75 oranına bağlıdır. Karakol muhafızı ana oyundaki nötr dünya gibi çözülür (`services/neutral.ts`, `maintenanceExempt`), ama ele geçirme veya yerleşme yoktur. Karakolda Aegis yoktur. Üç seviyede 2, 3 ve 6 gemi bekler, her karakolun sınıfı farklıdır ve sonda raporu bunu söyler. Bu tempoda doğru sınıf rahat kazanır, yanlış sınıf zorlanır: 6 Ok, 6 Muhafız'a karşı %85 kesin zafer alır, 6 Kargı, 3 Muhafız'a karşı %61.

**İtki parçası yarışı.** Oyunun ana döngüsü burada küçük hâliyle yaşanır:

1. Parça, rastgele bir enkaz veya karakolda belirir. Yalnız Motor paneli açık ve parça alacak yeri olan oyuncu görür ve alır. Görmek için teleskop menzili veya o noktanın sonda raporu gerekir.
2. Oyuncu yakınındaki filoları teleskopla izler ve yarışıp yarışmayacağına karar verir.
3. Parçayı oraya ilk ulaşan filo alır. Muhafızlı noktada kesin zafer gerekir. Geç kalan yalnız kalan kaynağı alır.
4. Alınan parça başkası tarafından çalınamaz. Bir gemi en fazla 3 parça tutar, fazlası sahada kalır. Böylece kimse parçaları başkası almasın diye toplayamaz.

Az nüfusta oyuncu takılmasın diye, açık parça sayısı her zaman `max(2, motor aşamasındaki oyuncu sayısının yarısı)` olur.

**Korsan gözcüsü ve ilk akın.** Radar 1 bittikten sonra, oyuncu oyundayken küçük bir NPC gözcüsü gemiye yaklaşıp döner, savaş olmaz. Radar uyarır, teleskop içeriğini söyler. Gözcü, oyuncu kendi ilk seferini (madencilik, sonda veya baskın) göndermeden gelmez (owner, 2026-11-08, N2). Oyuncu radarın değerini ilk kez burada hisseder ve "Bu saldırsaydı ne olurdu?" diye sorar. Aegis 1'i seçen oyuncuya ilk gerçek akın gelir. Akın, oyuncunun filosuyla eşit sayıda gelir ve Aegis oyuncuyu korur: 2 Ok + Aegis 1'e gelen 2 Ok %87 boş döner, oyuncu gemilerinin %93'ünü korur. Yine de gemi yok olabilir. Sonraki akınlar seyrektir, bakım penceresine düşmez. Aegis'siz gemiye korsan gelmez; onun ilk savaşı karakoldur.

**Görünür kalkış.** Bir komşu göç ettiğinde, galaksideki herkes gökyüzünde parlak bir iz görür. Kalkış panosuna adı düşer.

### 3.5.1 Teleskop, Radar ve Sonda — owner tanımı, 2026-11-07

- **Teleskop:** Gözünle gördüğün alan. Bu alandaki komşu gemilerin, filoların,
  asteroidlerin ve korsanların hareketini görürsün. Bir aracın rotasını gördükten
  sonra, alandan çıksa da o uçuş bacağını izlemeyi sürdürürsün.
- **Radar:** Teleskobun göremediği yerde de radar mesafesindeki hareketi `?` olarak
  gösterir. Sana gelen saldırı filosu, radar alanına girdiğinde görünür ve uyarır.
- **Sonda:** Hedefin içini okur: kaynaklar, filo ve savunma. Rapor belirli bir anın
  ölçümüdür; hareket takibinin yerine geçmez.

Starter trafik servisinde görülmüş uçuş bacağı, menzilden çıkınca kaybolmaz.
Geçmiş görüş, tamamlanmış teleskop siparişlerinin bitiş anlarından hesaplanır;
yeni teleskop geçmişte kaçırdığı bir geçişi sonradan öğrenmez. Henüz görüşe girmemiş
gelecek geçişler görünmez. Gizli gönderen/hedef/rota uçları yayımlanmaz; mevcut kısa
hareket penceresi sürer. `vessels.sight_since`, gemi o konuma yerleşmeden önceki
geçişleri hafıza saymayı önler; uyku sonrası yer değişince sıfırlanır. Menziller, uçuş süreleri ve ekonomi değişmez.

İlk Teleskop 1 ve Radar 1 sonrasında, rehber açıksa 7 ve 8. bölümler gerçek
sensör halkasını ve mevcut hareketi sahnede gösterir. Görülmüş bölümler tekrarlanmaz;
rehberi kapatma bu bölümleri de kapatır. Canlı temas yoksa bir araç uydurulmaz;
halka gösterilir ve genel işlev anlatılır. Ana galaksinin ayrı görüş uygulaması bu
starter düzeltmesinin kapsamında değiştirilmedi.

### 3.6 Koruma modeli

Tier olmadığı için herkes herkese saldırabilir, ama şu kurallar içinde:

1. **Aegis 1 onarılmadan** oyunculardan saldırı yemezsin, oyunculara da saldıramazsın: gemi saldırısı kendi Aegis 1'ini ve ilk savaş raporunu ister (owner, 2026-11-08, N3). Karakol baskını Tersane 1 ile açılır. Sonda hep serbesttir.
2. Aegis 1 sonrası **12 saat kalkan** başlar. Oyuncu hazırlanır ve "Kalkanım bitiyor" diye geri döner. İlk saldırıyı kendisi yaparsa, onay istenir ve kalkan erken düşer (ana oyundaki D183 mantığı).
3. **Aynı saldırgan aynı hedefe** 12 saatte en fazla 2 kez saldırabilir.
4. Kesin yenilgiden sonra **3 saat toparlanma kalkanı** gelir.
5. Bir gemi 24 saatte en fazla 3 başarılı akın yiyebilir.
6. **Onarım geri gitmez.** Biten onarım bozulmaz, parça ve yakıt deposu çalınmaz. Yalnız depodaki kaynak yağmalanır, depo tabanı korunur.
7. **Filo tavanı** küçüktür: Hangar odası 20, 32, 50 (yaklaşık 6, 10, 16 gemi). En güçlü ile en zayıf filo arasındaki fark bununla sınırlanır.
8. Geçiş için oyuncuya saldırmak şart değildir, ilk savaş korsana karşı da sayılır. PvP daha kazançlıdır, zorunlu değildir.
9. **Gemide kalma sınırı (A9):** Göçe hazır olan veya 14 günü geçen gemi oyuncuya saldıramaz. Sınır olmazsa biri göçü geciktirip tam filoyla yeni gelenleri ezebilir.
10. **Şart uçuş sırasında bozulursa filo savaşmadan döner.** Hedef kalkmış, uykuya geçmiş, kalkan almış veya günlük akın sınırına ulaşmış olabilir. Bu kural sonda ve parça uçuşları için de geçerlidir. Gelen filodan kaçmak için kalkış yapmak serbesttir.
11. **Kilitlenme yoktur.** Bütün filo yok olsa da üretim sürer, gemi ve Kazıcı yeniden üretilir. Hiçbir onarım adımı savaş gemisi istemez, parça enkaz alanından Kazıcı ile de alınır.

### 3.7 Kademeli açılım

Oyunun öğrenme eğrisi yüksektir, bu yüzden oyuncu yavaş yavaş ısıtılır (K8). **Bir açılmada tek sistem açılır.** İlk oturumda oyuncu yalnız üretimi ve sondayı öğrenir, böylece ilk gün başka bir oyuncuya dokunur.

Kapalı bir menünün sebebi keyfi bir seviye şartı değil, o sistemin arızalı olmasıdır. İki kapı olaya bağlıdır: oyuncu önce kazar, sonra enkazı görür. Önce savaşı yaşar, sonra gemilere saldırabilir.

| Özellik anahtarı | Açılan yüzey | Şart |
|---|---|---|
| `production` | Üs sekmesi (Gemi ekranı), Toplama, alaşım ve kristal sayacı | Rafineri 1 |
| `intel` | İstihbarat sekmesi, Sonda düğmesi, karanlık noktalar | Keşif anteni 1 |
| `chat` | Sohbet | Keşif anteni 2 |
| `fleet` | Filo sekmesi, gemi üretimi, asteroitler, karakol baskını, Onarım İstasyonu, savaş simülatörü | Tersane 1 |
| `salvage` | Enkaz alanları | İlk madencilik dönüşü |
| `research` | Araştırma | Hangar 2 |
| `telescope` | Teleskop halkası, trafik, gözlem | Teleskop 1 |
| `radar` | Radar halkası, uyarılar | Radar 1 |
| `defence` | Savunma, savaş raporu, ilk korsan akını | Aegis 1 |
| `attack` | Gemilere saldırı | Aegis 1 ve ilk savaş raporu |
| `deuterium` | Döteryum sayacı, uçuş yakıtı | Döteryum 1 |
| `drive` | Motor paneli, parça işaretleri | Motor gövdesi şartları |
| `migration` | Göç düğmesi | Yakıt tamam |

**Ana galaksiyle açılanlar:** Klan, Dominion, Honor, koloni, anıtlar, Death Star ve Taktik sekmesi, konvoy, radyasyon, Yarık, sıralama, DM, mağaza. Ana galakside seviye kilidi yoktur, kurallar orada dallanmaz. Bu sistemler inişten sonra sırayla tanıtılır.

Arayüz kuralları:

- **Yalnız sıradaki kilit görünür.** Dokununca neden kapalı olduğunu ve neyin açacağını söyler. Daha ilerisi gizlidir. Tek istisna Klan sekmesidir: baştan kilitli görünür ve "Ana galakside açılır" der, çünkü bir vaattir.
- **Görevler durum okur, tıklama saymaz.** Yapılmış iş tekrar istenmez.
- **Açılma anı:** Geminin o bölmesi ışıklanır, yeni düğme belirir, tek cümle ne işe yaradığını söyler. Art arda modal açılmaz. Oyuncu yokken birden fazla sistem açıldıysa biri gösterilir, sonraki oyuncunun ilk eyleminden sonra gelir.
- **Sunucu da kilitler.** Menüyü gizlemek tek başına kilit sayılmaz.
- Açılan özellik türetilir, kaydedilen yalnız "duyuruldu" bilgisidir. Ana oyundaki `currentUnlocks` / `unlocksSeen` ayrımının aynısıdır. Ancak `currentUnlocks` bugün hiçbir eylemi kapatmıyor, yalnız duyuru üretiyor. Gerçek kilit yeni yazılır.

Gemi ekranı (350 px):

```text
┌ Koloni Gemisi ───────── Onarım %43 ┐
│  [gemi kesiti: 5 bölüm, ışıklı]    │
├────────────────────────────────────┤
│ Sıradaki: Tersane       800 / 300  │
│ Açar: Filo, Kazıcı       1 sa [Onar]│
├────────────────────────────────────┤
│ Rafineri modülü  ●●●○  Çalışıyor  ▸│
│ Keşif anteni     ●○○   Hasarlı    ▸│
│ Kargo ve hangar  ○○    Rafineri 3 ister
└────────────────────────────────────┘
```

Risk: Bu yapı "kur, bekle, yükselt" döngüsüne dönebilir, `CLAUDE.md` bunu gerileme işareti sayar. Bu yüzden Tersane'den sonra her sistemde en az bir adımın ilerlemesi, başka bir gemiye veya paylaşılan noktaya gitmekten geçer.

### 3.8 Harita ve göç

**Harita.** Başlangıç galaksisinin yarıçapı 900 birimdir. Ana galaksinin merkezi 20.000 birim uzakta ve aşağıdadır (yaklaşık 50° yükseklik), böylece spiral düz bir çizgi değil, geniş bir elips görünür. Gemiden bakınca ana galaksi gökyüzünün 24–28 derecesini kaplar, telefonda bütün spiral tek kareye sığar. İki galaksinin kenarları arasında 14.000 birim boşluk kalır. En geniş bu galaksi sensörü 1500 birimdir, kenardan bile ana galaksiye ulaşamaz. Uzaklık Faz 0'da telefon görüntüsüyle seçildi: 16.000'de kollar kareden taşıyor, 24.000'de hedef küçülüyor ve kamera uzak düzlemi yetmiyor.

**İlk kamera.** Oyuncunun gördüğü ilk kare gemiden ana galaksiye bakar. Oyuncu nereye gideceğini ilk saniyede görür (K1).

Ana galaksi bütün olarak dokunulabilir. Açılan salt okunur satır herkese açık bilgileri söyler: ad, dünya sayısı, sezonun kalan günü ve "Göç için motoru onar". Tek tek noktalar seçilemez. O an canlı sezon yoksa son bilinen noktalar kalır, satır yeni sezonun beklendiğini söyler.

**İki galaksi oyunda birbirine dokunmaz (K1).** Buradan ana galaksideki gezegene saldırılmaz, sonda yollanmaz, asteroide Kazıcı gönderilmez, korsana, konvoya veya etkinliğe filo gönderilmez. Ana galaksiden de bu galaksiye hiçbir şey gönderilmez. Sohbet, DM, klan ve sıralama ortak değildir. Tek geçiş göçtür ve tek yönlüdür.

**Göç şartları.** Yakıt tamam, bütün filolar evde, sezonun son 5 gününde değil. Sürüyor olan onarım ve üretim emirleri iptal edilip bedeli iade edilir.

**Onay ekranı.** Hedef galaksiyi, ambarı ve şu uyarıyı gösterir: "Gemi bu seferde tüketilir. Ambarın dışında kalan kaynak ve gemiler kaybolur."

**Ambar (A3).** Üstüne eklenenler: en fazla 2000 alaşım, 1000 kristal, 50 Döteryum ve 6 sağlam gemi. Standart ilk sezon paketi aynen verilir. Tavan, botla veya ikinci hesapla kaynak aktarmayı değersiz kılar. İlk sezon filosu 20 oda, ambardaki 6 gemi en çok 24 oda tutar, Hangar 1 ise 80 odadır. Yani ambar hangara her zaman sığar.

**İniş noktası (A7).** `pickSpawnSlot` mantığıyla seçilmiş, birbirinden uzak 3 boş adres gösterilir. Her birinde yakındaki dünya sayısı yazar: seyrek bölge daha güvenli ve hedefe uzaktır, yoğun bölge fırsatlı ve risklidir. Bu bilgi zaten herkese açık konumlardan gelir. Adres kapılırsa sunucu kendi `pickSpawnSlot` seçimini kullanır.

**Evren yapısı (owner, 2026-11-05).** Her sunucuda tek evren var: ortada ana galaksi, çevresinde dolup açılan başlangıç galaksileri. Amaç, oyuncunun aynı uzayda durduğunu hissetmesi.

- **Konum:** Galaksinin yeri yalnız sıra numarasından çıkar (`starterGalaxyCentre(ordinal)`), veritabanında ayrıca tutulmaz. İlk kabuk ana merkezden 10.500 uzakta, 28 yerlidir; dolunca 6500 dışarıda yeni kabuk açılır. Galaksiler ve sensörleri birbirine ve ana galaksiye değmez; bunu test korur.
- **Koordinat:** Gemiler kendi galaksilerinin yerel koordinatındadır. Ana galaksi `mainOffsetOf(ordinal)` kadar uzakta çizilir. Sabit bir ofset yoktur.
- **Çizim:** Ana galaksi kopyalanmaz. Gezegenler `PlanetField`, anıtlar `Monuments`, bulutlar `RadiationHaze` ile, ana oyunun kendi çizim kodundan geçer; yalnız konum kaydırılır (`motion.pivot`).
- **Veri ayrı kalır:** Gemi gezegen olmaz, `planets` tablosuna girmez. Ana galaksiden kimliksiz konum gelir, kimlikler istemcide üretilir, seçilemez ve keşif işareti taşımaz.
- **Kapasite ve boyut (owner, 2026-11-05):** Galaksi 30 gemi alır, yarıçapı 900'dür. Ölçüm: ilk teleskop ortalama 3, ikincisi 11, üçüncüsü 22 komşu görür; ilk teleskopta hiç komşu görmeyen oyuncu %4'tür (1500'de %47 idi).
- **Yer alma:** Yeni oyuncu yeri olan en eski galaksiye girer. Boşalan yer, yeni galaksi açılmadan önce doldurulur. Hepsi doluysa sıradaki galaksi açılır. `CLOSED` yalnız elle kapatmak içindir.
- **Sessiz gemi (owner, 2026-11-05):** Ana oyundaki 30 saat kuralı burada 48 saattir. 48 saat ilerleme olmayan gemi (bugün yalnız onarım; giriş ve toplama sayılmaz, Faz 4'ten sonra saldırı, sonda, araştırma ve filo da sayılacak) `DORMANT` olur: haritadan ve sayımdan çıkar, yeri boşalır. Sahibi gemiye bakabilir ve toplama yapabilir, son 12 saatte uyarı görür. Yeni onarım gemiyi uyandırır: kendi galaksisinde yer varsa oraya, yoksa yeri olan galaksiye geçer ve kaynak kazanmaz, kaybetmez.

- **Evren görünümü (yapıldı, 2026-11-05):** Uzaklaşma sınırına gelince "Evreni gör" düğmesi çıkar; biraz daha uzaklaşmak da açar (tekerlek üç tık, iki parmak bir hareket). Kamera aynı sahnede 1,6 saniyede geri çekilir: ortada ana galaksi, çevrede toplar, oyuncunun kendi galaksisi turkuaz. Kamera, kendi galaksisini ana galaksinin önünde bırakmayan açıyı seçer. Yakınlaşmak veya "Geri dön" oyuncuyu bıraktığı yere döndürür; seçim veya Ev kamerayı oraya götürür. Yalnız bakmak içindir: hiçbir emir, kimlik veya konum taşımaz. Veri `GET /api/universe`: galaksi numarası ve gemi sayısı; ana galaksi oyuncusu da aynı ucu okur, başlangıç galaksisi yoksa görünüm hiç sunulmaz. Sayım dakikada bir yapılır.
- **Gemi gövdeleri (owner, 2026-11-05):** `SPINE`, `WEDGE`, `SEED`. Üçüncü gövde halka olamaz: farklı açılardan farklı görünür, geniş hero görseline oturmaz, kalkışta burnuyla uçmaz. Gövde gemi kimliğinden türer, sütun tutmaz. Modeller `assets/source/models/vessels/`, her biri 400–600 KB. Komşu gemiler şimdilik karanlık gezegen olarak çizilir; sonda raporu gelince gerçek gövde Faz 4'te bağlanır.

Henüz yapılmayanlar, sırayla:
1. **Sessiz bot gemileri:** Botlar aynı kurala uyar, Faz 8'de bot turuyla birlikte bağlanır.
2. **Olası etkileşim:** Galaksiler arası etkileşim bugün yoktur (K1) ve "ileride, belki" durumundadır. Yapılırsa ayrı bir uçtan geçer; kimliksiz gökyüzü verisi buna dönüştürülmez.

**Hedef galaksi (A13).** Gemi Vantage'ın yanındadır, ama iniş o an katılıma açık ana galaksiye yapılır (`status: 'open'`). Bugün bu Vantage'dır. Vantage dolunca onay ekranı yeni hedefi açıkça söyler.

**Sezon sonu (A5).** Gemi sezondan bağımsızdır, sezon silmesinden etkilenmez. Son 5 günde göç düğmesi şunu söyler: "Sezon X gün sonra bitiyor. Yeni sezonda ilk gelenlerden biri olmak için bekle." Oyuncu bu galakside oynamaya devam eder. Yeni sezon açılınca bekleyen gemilere bildirim gider. Sezon yoksa veya hedef kapalıysa kalkış olmaz, sebep söylenir, gemi sağlam kalır.

**Sahne (yaklaşık 25 saniye, tekrar izlenirken atlanabilir):**

| Saniye | Görüntü |
|---|---|
| 0–5 | Motor yanar, kamera geri çekilir, komşular kalkışı görür |
| 5–10 | Gemi hızlanır, arkasında iz bırakır |
| 10–18 | Boşluk geçilir, ana galaksi büyür, noktalar gerçek dünyalara dönüşür |
| 18–23 | Gemi seçilen adrese düşer ve tüketilir, gezegen ışıkla oluşur |
| 23–25 | Kamera geri çekilir, canlı galaksi ve tanıdık arayüz açılır |

Sonuç sunucuya önce yazılır, sahne sonra oynar. Tarayıcı kapanırsa oyuncu zaten gezegenindedir, son bölüm bir kez gösterilir.

**İniş sonrası ilk kart.** Kısa satırlar: "Savaşlar artık iki kat sert, Aegis tam gücünde. Kalkanın 72 saat sürer. 3 gün girmezsen gezegenin silinir. Çekirdek dünyanın kademesini belirler. Klan ve sıralama açıldı." Bildirim Merkezi kuralı da burada söylenir (A12).

**İniş sonrası tanıtım.** Ana galakside seviye kilidi yoktur. Yeni sistemler, ilk haftaya yayılan tek satırlık kartlarla tanıtılır: 1. gün Çekirdek ve kademe, 2. gün koloni, 3. gün klan, sonra Dominion ve Honor. Mevcut `AwayHost` ve bildirim yüzeyleri kullanılır. Kart oyuncunun zaten yaptığı şeyi tekrar anlatmaz.

### 3.9 Prolog

*Uygulama notu: prolog gerçek ekranları yerel fetch ile sürmek yerine kendi sahnesini çizer (`onboarding/prologue/Prologue.tsx`), bu yüzden `fetch.ts` ve `copy.ts` yoktur, metinler `starter.prologue` altındadır. Gövde gösterilmez: gövde sunucunun verdiği kimlikten çıkar ve oyuncu sevdiği gemiden başkasını almamalıdır.*

Bugünkü FlightSchool, sonda, akın ve savunma dahil bütün oyunu 11 bölüme sıkıştırıyor. Bu dersler artık günlere yayıldığı için prologun tek işi, yeni geleni hesap istemeden oyuna bağlamaktır.

| An | Oyuncu | Amaç |
|---|---|---|
| İlk 20 sn | Play'e basmadan karanlık gemide başlar, camın ötesinde ana galaksi durur | Vaat |
| 20–60 sn | Tek dokunuşla yedek gücü bağlar, bölmeler ışıklanır | Sahiplik |
| 1–3. dk | Rafineriyi çalıştırır, ilk kaynağı toplar, ilk onarımı başlatır | İlk kazanç |
| Yaklaşık 3. dk | Kör sensörler uzakta bir sinyal yakalar | Merak |
| Sonra | "Gemiyi sahiplen", ad ve şifre | Hesap |

- Yerel çalışır, hesap açmadan çıkan kişi için oyun kaydı oluşmaz.
- Tek yollu olduğu için herkes aynı noktada biter. Sunucu bu başlangıcı `STARTER.opening` sabitinden kendisi kurar, tarayıcıdan gelen ilerlemeye güvenmez.
- "Atla" ve hesabı olanlar için giriş yolu kalır. Menüden yeniden oynanabilir, menüdeki Akademi sayfası kısa bir el kitabına döner.
- Mevcut ilk ziyaret, cihaz ipucu ve `#play` davranışı korunur (`docs/first-visit-startup-2026-11-03.md`). Bütçe aynı kalır: ilk JS paketi 0,54 MB, yavaş profilde toplam script 1,38 MB. Gemi modeli ayrı ve sonradan yüklenir.
- Bayrağı bilmek için herkese açık `GET /api/auth/capabilities` yanıtına `starterGalaxy` eklenir. Cevap gelmezse Faz 11'e kadar eski eğitim açılır.

### 3.10 Geri dönüş nedenleri

Starter telefon bildirimleri ücretsizdir; web dönüş özeti kullanır. Native izin vedada sorulur;
ret sonrası yeni başlayan ≥15 dk onarımda bir kez daha sorulur. Sonuç `alert_permission` ile ölçülür.

- Sistem açan onarım `system_open`; diğer ≥15 dk onarımlar bitince bildirilir. Sonraki 30 dk içinde başka uzun onarım varsa son bitişte tek bildirim gider.
- Kazıcının ilk üç dönüşü; sonrasında yalnız parça taşıyan dönüş.
- Sıradaki zorunlu adımın parası hazır: starter ve inişten sonraki 7 gün, son 24 saatte en fazla bir,
  son etkinlikten en az 3 saat sonra. Sipariş ve toplama ödeme randevusunu yeniler.
- Yokken olanlar: gerçek seyir defteri olayları varsa yokluğun 24. ve 72. saatinde; aynı yoklukta en fazla iki.
- Sonda, yaklaşan saldırı, akın sonucu ve kalkan uyarıları sürer.
- Cihazın yerel saatinde 23:00–08:00 ücretli uyarılar, saldırı ve kalkan uyarısı geçer; diğer ücretsiz push mesajları 08:00'e ertelenir.

Ana galakside ilk hafta ücretsiz temel push ve diğer Kuruluş Haftası değişiklikleri Yayın C kapsamındadır.

### 3.11 Hikaye ve görünüm (A8)

**Çalışma adı: Sığlık.** Yerleşim filosu, ana galaksiye girerken bir kütleçekim resifine çarpar ve yanındaki küçük uydu galaksiye saçılır. Koloni gemilerinin içinde yeni bir dünya kuracak her şey vardır, ama gemiler arızalıdır. Hedef gözle görünecek kadar yakındır. Kurtulanlar aynı kaynaklar için yarışır, gemisini ilk onaran ilk gider. Bu hikaye, hafif savaşı ve ana galaksinin neden görünür olduğunu açıklar. Lore metni `docs/ux-writing.md` kapsamı dışındadır, içindeki işlevsel talimatlar kapsam içindedir.

**Gemi.** Beş sistem gövdede ayrı görünür, böylece onarım gözle okunur:

| Sistem | Yeri | Arızalı | Onarılmış |
|---|---|---|---|
| Rafineri modülü | Orta gövde, tank kümeleri | Kararmış, kıvılcımlı | Sıcak iç ışık |
| Keşif anteni | Üst çanak | Eğik, ölü | Dönen, parlayan |
| Savunma sistemleri | Yan kubbeler | Delik panel | Aegis kabuğu |
| Kargo ve hangar | Karın kapakları | Sıkışmış | Açılır, ışıklı |
| Yıldızlararası motor | Kuyruk | Parçalanmış nozül | Mavi motor ışığı |

**Gövde ve hâl (owner, 2026-11-04).** Üç gövde (Omurga, Kama, Tohum; owner kararıyla halka gövde çıkarıldı, yerine WEDGE) × üç hâl (haraba, yarı onarılmış, yenilenmiş) = 9 model. Gövde gemi kimliğinden sabit seçilir, hâl onarımdan gelir. Modelleri owner üretir (Codex konseptleri `out/starter-ship-concepts/`, Meshy/Tripo). Gelene kadar yer tutucu çizilir.

**Başkasının gemisi (owner, 2026-11-04).** Kendi gemin gerçek hâlinde görünür. Başkasının gemisi, sondalanana kadar haraba görünür; sonda raporundan sonra raporun gösterdiği hâle döner (D127 kuralı). Onarım ilerlemesi böylece gizli kalır ve sondanın haritada da karşılığı olur.

Konsept görseller Codex ile üretilir. **Ana galaksi fotoğraf değil, kendisidir (owner, 2026-11-04):** gerçek gezegen konumları isimsiz nokta olarak, gerçek anıtlar ve gaz bulutları. Asteroit, korsan, filo ve olay gönderilmez. Spiral plaka, oyuncunun varacağı yere benzemediği için kaldırıldı. Codex 3D model üretmez, modelin kaynağı A19'dur. Görsel, pahalı gerçek zamanlı ışık yerine ucuz shader numaralarıyla kurulur. Telefonda ölçülür.

**Adlar.** Oyunda üç benzer sözcük çakışır: ana oyunda "Anten" Teleskop'u açan uydudur, bu yüzden burada hep "Keşif anteni" yazılır. "Onarım" geminin sistemleri, "Onarım İstasyonu" hasarlı filolar içindir. Gemi ekranındaki satır "Onarım 3/4" der, başka ekranlarda iki kavram "sistem onarımı" ve "filo onarımı" diye ayrılır. "Koloni" için bkz. A8.

### 3.12 Botlar

**Kilitli karar:** Oyuncular bir botun bot olduğunu asla anlayamaz. Metinde bot ifadesi geçmez, client'a işaret gitmez.

Az nüfusta galaksi canlı görünmek zorundadır, bu yüzden botlar burada gerçek oyuncu gibi yaşar:

- Aynı `vessels` tablosunu ve aynı servisleri kullanır. Görünümlerde bot ile gerçek oyuncu arasında alan farkı yoktur.
- Onarır, toplar, sonda yollar, kazar, korsana ve enkaza gider, nadiren oyuncuya saldırır, kalkış yapar.
- Hedef sayı, gerçek oyuncunun yakınında komşu olacak şekilde belirlenir: `sınırla(8 + 4 × aktif gerçek oyuncu, 12, 60)`. Komşular paylaşıldığı için oyuncu başına ayrı bot gerekmez. Gerçek oyuncu çoğaldıkça oran düşer.
- Yeni bot farklı onarım aşamalarında başlar, böylece önde olan komşular görülür.
- **İsimler (A10):** `BOT_IDENTITIES` owner'ın 100 ismidir ve EU-1'in 100 bot koltuğuyla eşittir. Ayrı havuz yoktur. Ana galakside oturmayan isimler burada kullanılır. Ana galaksi koltuk isterse önce kalkışa hazır bot iner, o yoksa bot gemisi uykuya geçer. Yetmezse `reportShortRoster` uyarır ve owner isim ekler, isim üretilmez.
- Parça kıtsa gerçek oyuncuya öncelik verilir. Bunu oyuncu görmez, bot o anda başka işe gider.
- Aynı gerçek oyuncuya 24 saatte en fazla 1 saldırı yapar. Saldırı kararı bu galaksinin oran tablosunu okur (`starterOutcomeTable`).
- **Akıbet (A11):** Bot yalnız ana galakside koltuk açılınca iner (`joinSeason(seat: 'SERVER')`). Diğerleri yavaş oynar, sonra uykuya geçer ve haritadan çekilir, bu da oyunu bırakan bir insandan ayırt edilemez. Uyuyan bot aynı gemiyle uyanabilir, böylece isim yanmaz. İnmiş bir bot yeni gemi açamaz. Kalkış panosunda adı görünen bot, ana galakside gerçekten vardır.

## 4. Sayılar

İlk değerler, hepsi `packages/rules/src/starter/constants.ts` içinde tek yerde durur:

```ts
export const STARTER = {
  radius: 900, minSeparation: 250, capacity: 30, idleMs: 48 saat,
  mainOffset: { x: -6746, y: -8043, z: 0 },          // merkezler arası 10.500: anıt kabuğunun (6000) 3000 ötesi (owner, 2026-11-04)
  opening: { alloy: 930, crystal: 300, deuterium: 0, modules: { REFINERY: 1 }, works: { alloy: 60 } },
  nakedEye: 150,
  telescope: [0, 450, 750, 1100],
  radar: [0, 600, 1000, 1500],
  probeSpeed: 790,        // 2369'da 300 birim 9 saniye sürer, uçuş görülemez
  prospectorSpeed: 300,   // kısa mesafede madencilik üretimi ezmesin
  hulls: ['DART', 'PIKE', 'WARDEN', 'COURIER', 'PROSPECTOR'],
  hangarRoom: [20, 32, 50], attackBays: [1, 2, 3],
  queues: { construction: 3, yard: 3, dock: 1, research: 1 },
  pvp: {
    lootDecisive: 0.10, lootPartial: 0.05, lootBufferShare: 0.5,
    shieldHours: 12, recoveryShieldHours: 3,
    bashLimit: 2, bashWindowMinutes: 720, dailyRaidCap: 3,
    lockAfterDays: 14,
  },
  combat: { tempo: 0.10, aegisMax: 2 },   // ana oyun 0,20; Aegis aynı oranda ölçeklenir
  repair: { pct: 25, dockTimeMult: 12 },
  battleDebris: { share: 0.10, minimum: 100, decayMinutes: 40 },
  sites: {
    asteroidsPerActivePerHour: 0.5, asteroidOre: [400, 800],
    wrecks: { count: 6, stock: [300, 600], respawnMinutes: 120 },
    outposts: { count: 8, guards: [2, 3, 6], stock: [250, 450, 900], respawnMinutes: 360 },
  },
  parts: { needed: 3, respawnMinutes: 120, minOpen: 2 },
  research: { projects: ['SHIP_POWER', 'SHIP_ARMOR', 'SHIP_PROPULSION', 'PROSPECTOR_HOLDS'], maxLevel: 2 },
  fuelForJump: 90, deuteriumGrant: 20,
  carry: { alloy: 2000, crystal: 1000, deuterium: 50, ships: 6 },
  retentionDays: 30, migrationCutoffDays: 5, // dormantHours ve slotReleaseDays kaldırıldı: yuva hemen boşalır, eşik idleMs 48 saat (owner, 2026-11-05)
  bots: { base: 8, perActive: 4, min: 12, max: 60 },
} as const;
```

- Uçuşlar: Ok 250 birimi 2,75 dakikada, 1000 birimi 11 dakikada gider. En uzak uçuş 33 dakikadır. Kısa oturumda sonucu görmeye uygundur.
- `minSeparation` 250'dir: çıplak göz (150) hiçbir komşuyu görmez, 30 yuva 900 yarıçapa rahat sığar. `generateGalaxy` ana galaksi sabitlerini okuduğu için `starterSlots` ayrı bir üreticidir.
- Sonda ve Kazıcı hızları ayrı tutulur, ama istemciye ayna gerekmez: sonda süresi ve Kazıcı hızı (`craftSpeed`) sunucu yanıtından gelir.
- Gemi fiyatları ana oyunla aynıdır (Ok 304/121). 6 gemi yaklaşık 10 saatlik üretimdir, filo ile onarım arasında gerçek bir karar doğar.
- `combat.tempo`, `resolveBattle`'a verilen tek savaş ayarıdır. Aegis'in burada verdiği can `shieldHp(aşama) × tempo ÷ COMBAT.tempo` ile hesaplanır (`vesselAegisHp`): Aegis 1 75, Aegis 2 113. Hasar ve kalkan böylece tek sayıyla birlikte oynar.
- %95 ve üstü hasarlı gemi savaşamaz, bu mevcut `shipCanFight` sınırıdır.
- Yakıt açılana kadar uçuş yakıtsızdır. Açılınca `missionFuel` işler (6 Ok, 300 birim gidiş-dönüş 2, 1000 birim 6 Döteryum) ve uçuş ile motor yakıtı arasında karar doğar. Yakıtsız filo kalkmaz, bu yüzden Döteryum 1 ile 20 Döteryum hediye gelir. Yoksa açıldığı an oyuncunun bütün uçuşları durur.
- Hangar, ana oyunla aynı birimi kullanır (`hangarLoad`: Ok, Kargı ve Kurye 3, Muhafız ve Kazıcı 4). Ana oyunda Hangar 1 80 odadır. Böylece arayüz "18/20 oda" der ve oyuncu gerçek kuralı öğrenir.
- `attackBays`, ana oyundaki `flightSlots` ile aynı şeyi sayar: aynı anda kaç saldırı uçabilir. Madencilik ve sonda sayılmaz.
- `STARTER_PVP_BALANCE`, `PvpBalance` tipinin altı alanını da doldurur, raporlara yazılır.

## 5. Teknik mimari

### 5.1 Genel yapı

```text
Tarayıcı: GameShell + GalaxyView + FocusPanel (ortak ekranlar)
  ana oyuncu    → /api/planet, /api/galaxy ...       (değişmez)
  gemi oyuncusu → starterTransport → /api/starter/*  (yol ve şekil eşlemesi)

Sunucu:
  routes/starter.ts → services/starter/* → vessel_*, starter_* tabloları
                         ↑ @astera/rules (savaş, üretim, uçuş, sensör)
  worker: scheduled_events (ana) · starter_events (bu galaksi)
  bus:    p:<vesselId> · s:<starterGalaxyId>         (ana topic'lere abonelik yok)

Göç: services/starter/migration.ts → joinSeason → players + planets
```

**Neden ekranlar ortak:** Ayrı arayüz, çift bakım demektir ve oyuncu ana galakside başka bir ekrana alışmak zorunda kalır. Aynı arayüz bu yüzden bir özelliktir: oyuncu gerçek düğmeleri öğrenir. FlightSchool, gerçek `GameShell` ve `GalaxyView` ekranlarını yerel bir `fetch` ile besleyerek bunun mümkün olduğunu kanıtlıyor (`onboarding/flightSchool/api.ts`).

**Neden `players` satırı yok:** Bu satır `history.played` değerini true yapar ve ilk sezon paketini bozar, sezon silmesinde gider, 66 yabancı anahtara bağlıdır. Gemideki oyuncunun kimliği `accounts` satırıdır. İnişte `joinSeason` çağrılır, ilk sezon paketi ve 72 saatlik kalkan olduğu gibi çalışır.

**Neden ayrı sezon yok:** Sezon 60 gün sonra silinir, gemi ise sezonlar arası yaşar. Bu galaksinin `shards` veya `seasons` satırı yoktur, `/api/servers` listesi değişmez, nüfus sayımı etkilenmez.

### 5.2 Koordinatlar

Bu galaksinin verisi **yerel koordinattadır**, merkez orijindir. Ana galaksi sahnede `STARTER.mainOffset` kadar kaydırılmış çizilir.

Sebep: `asteroidPosition` orijin çevresinde yörünge hesaplar, kamera tasması (`sphericalLeashCorrection`) orijine göre çalışır, `GalaxyCanvas` ve ortam katmanları orijin varsayar. Yerel koordinat bunların hepsini değiştirmeden kullanmamızı sağlar.

Göç sahnesi yerel çerçevede biter, gezegenin ışıkla oluştuğu anda sahne ana çerçeveye geçer. Gökyüzü sonsuzda olduğu için geçiş görünmez.

Mevcut sınırlar yeterlidir: kamera uzak düzlemi en az 600 dünya birimi, ana galaksinin uzak kenarı kameradan en çok yaklaşık 520. Gökyüzü küresi 500 yarıçapındadır, ana galaksinin en uzak noktası orijinden yaklaşık 490 kalır ve gökyüzü derinlik yazmadığı için onu örtmez.

### 5.3 Veritabanı

Hepsi ek migration'dır, mevcut tablolarda yapı değişmez. Tablolar kullanıldıkları fazda eklenir: Faz 2 `0228` (`starter_galaxies`, `vessels`, `vessel_units`, `vessel_orders`, `vessel_notifications`, `starter_events`) ve `0229` (akış trigger'ları). `0228` ve `0229` ana oyun verisine dokunmaz. Sıra numarası uygulama anında kontrol edilir. Journal `when` tuzağına dikkat edilir.

| Tablo | Ana alanlar | Not |
|---|---|---|
| `starter_galaxies` | `id`, `shard_id`, `ordinal`, `seed`, `epoch`, `capacity`, `status` | `unique(shard_id, ordinal)`. `epoch`, zaman hesabının başlangıcıdır. |
| `vessels` | `id`, `account_id` (unique), `starter_galaxy_id`, `slot_index` (boş olabilir), `x/y/z`, `name`, kaynaklar, buffer'lar, `shield`, `last_tick_minutes`, `modules` (jsonb), `research` (jsonb), `facts` (jsonb), `parts`, `fuel`, `status`, `pvp_open_at`, `recovery_until`, `unlocks_seen`, zaman damgaları | `status`: `ACTIVE`, `DORMANT`, `DEPARTING`, `DEPARTED`. Yuva benzersizliği, `DEPARTED` hariç partial index'le sağlanır. 30 gün uyuyan geminin yuvası boşalır, döndüğünde yeni yer alır. |
| `vessel_units` | `vessel_id`, `hull`, `location`, `count` | Gemi sayısının tek kaydı |
| `vessel_damage_lots` | `vessel_id`, `hull`, `count`, `damage_bp`, `remainder_bp`, `location`, `order_id` | Mevcut `HpDamageLot` şekli |
| `vessel_orders` | `vessel_id`, `queue`, `subject`, `count`, `cost`, `start_at`, `complete_at`, `status` | Onarım, gemi, dock, araştırma |
| `vessel_missions` | `starter_galaxy_id`, `owner_vessel_id` (NPC'de null), `kind`, `target_vessel_id`, `target_site_id`, `fleet`, `damage`, `cargo`, `depart_at`, `arrive_at`, `return_at`, `status`, `idempotency_key` | `unique(owner_vessel_id, idempotency_key)` |
| `starter_sites` | `starter_galaxy_id`, `kind`, `position`, `orbit`, `level`, `stock`, `guard`, `part_ready_at`, `part_taken_by`, `respawn_at` | Asteroit, enkaz, karakol |
| `vessel_probe_reports` | gözlemci, hedef, `at`, `accuracy`, `snapshot`, `detected` | Rapor görülen anın kaydıdır |
| `vessel_watches` | gözlemci, yuva, hedef, `cooldown_until` | Teleskop gözlemi |
| `vessel_scan_events` | hedef, `at`, `detected` | Radar kaydı |
| `vessel_battle_reports` | saldıran, savunan, yer, `at`, `result`, `loot`, `ruleset_version`, `balance`, `replay` (jsonb) | Mevcut rapor görünümüne eşlenir. Ana `battle_replays` tablosu sezona bağlı olduğu için tekrar izleme verisi burada durur (`prepareBattleReplay` ortaktır). |
| `vessel_notifications` | `vessel_id`, `kind`, `payload`, `ref_id`, `seen` | `unique(vessel_id, kind, ref_id)` tekrar teslimi güvenli kılar |
| `vessel_bot_state` | `vessel_id`, `persona`, `next_action_at`, `session_until_at` | Yalnız sunucu okur, hiçbir görünüme girmez |
| `starter_events` | `scheduled_events` ile aynı şekil, `season_id` yerine `starter_galaxy_id` | Ayrı kuyruk (§5.5) |
| `starter_chat_messages` | galaksi, `author_account_id`, `language`, `content`, `created_at`, moderasyon alanları | Yalnız metin |
| `starter_departures` | galaksi, `account_id`, `display_name`, `country`, `at` | Kalkış panosu. Ad kopyası tutar, bu yüzden hesap silinince satır da silinir. |
| `vessel_migrations` | `vessel_id` (PK), `idempotency_key`, `status`, `target_season_id`, `slot_choice`, `cargo`, `player_id`, `planet_id`, `arrival_seen_at`, `last_error` | Göç çıkış kutusu. `player_id` ve `planet_id` yabancı anahtar değildir, sezon silmesini engellemesin diye. |

Yabancı anahtar kuralları:

- `vessels.account_id` ve `vessel_*` alanları `ON DELETE CASCADE` kullanır. Hesap silinince gemi temiz gider.
- Başkasının raporundaki gemi referansı `SET NULL` olur.
- `starter_galaxies.shard_id` kısıtlıdır. Sezon silmesi `shards` satırlarını silmez, kod okunarak doğrulandı (`wipeAllServers`).
- Hiçbir tablo `players`, `planets` veya `seasons` satırına yabancı anahtarla bağlanmaz. Böylece `wipeAllServers` bu tablolara dokunmaz ve silme listesine ek gerekmez.

Trigger'lar: `astera_stream_revoke_account` işlevi `vessels` satırlarını da bilgilendirecek şekilde genişletilir, `vessels` için yeni bir `status` değişim trigger'ı eklenir (§5.6).

Dizinler: `vessels (starter_galaxy_id, status)`, `vessel_missions (target_vessel_id, status)` ve `(owner_vessel_id, status)`, `starter_events (status, resolve_at)`, rapor ve bildirimlerde `(vessel_id, at)`.

**Veri büyümesi.** Ana oyunda sezon silmesi tabloları temizler, burada silme yoktur. Bir süpürme `DEPARTED` gemilerin ayrıntılarını, biten olayları ve eski raporları `retentionDays` sonra siler. `vessels` satırı ve `vessel_migrations` kalır, çünkü tek gemi kuralı buna dayanır. Bu galaksinin sohbeti de aynı süpürmeyle temizlenir.

### 5.4 Saf kurallar: `packages/rules/src/starter/`

Bu galaksiye özel kurallar burada ek olarak yazılır, ana oyunun davranışı değişmez (K3).

| Dosya | İçerik |
|---|---|
| `constants.ts` | `STARTER` |
| `ladder.ts` | Modüller, adımlar, şartlar, `nextSteps`, `repairProgress`, `canOrderStep` |
| `features.ts` | `openFeatures(state)`, kapalı özellik listesi |
| `economy.ts` | Modül seviyelerini `PlanetEconomyInput` şekline çevirir. `advanceEconomy` ve `collect` aynen kullanılır, Aegis bu galaksinin biriminde saklanır, dolma süresi ana oyunla aynıdır. |
| `sensors.ts` | `vesselSphere` → mevcut `SensorSphere`, `vesselProbeAccuracy`. `sensorZone` aynen kullanılır. |
| `aegis.ts` | `vesselAegisHp` |
| `battle.ts` | `STARTER_PVP_BALANCE`, `starterBattle` (bu galaksideki her savaşın tek girişi), `starterOutcomeTable`, `canAttackVessel`, `vesselPvpOpenAt`, `recoveryUntilAfter` |
| `sites.ts` | Yer üretimi, parça yerleştirme, açık parça hedefi, `asteroidTargetPerHour` |
| `placement.ts` | `starterSlots(seed)`, `pickVesselSlot` (mevcut `pickSpawnSlot`'un tersi: aktif komşuya yakın yer seçer) |
| `carry.ts` | `migrationCargo(state)` |

Değişmeden kullanılanlar: `computeLoot`, `raidableStock`, `travelExact`, `fleetTravelExact`, `fleetPace`, `missionFuel`, `engagementEndsAt`, `sensorZone`, `probeAccuracy`, `detectChance`, `fuzzBand`, `classReading`, `telescopeReading`, `telescopeSlots`, `advanceEconomy`, `collect`, `hangarLoad`, `shipHealthGroups`, `partitionCombatFleet`, `shipRepairCost`, `shipRepairMinutes`, `asteroidPosition`, `claimOre`, `claimDebris`.

**`resolveBattle` tek ek alır:** isteğe bağlı `tempo` parametresi (`resolveRandomBattle`, `battleBalance` ve `tempoScale` üzerinden). Can ve atak çarpanları (`hullMult`, `damageMult`) bu işi göremez, çünkü `tempoScale` onları siler. Parametre verilmezse sonuç bit bit aynıdır.

**Hangi kural sürümü:** Savaş, yeni sezonların kullandığı güncel `rulesetVersion` ile çözülür ve rapora yazılır. Böylece oyuncu, tempo ve Aegis dışında ineceği kuralı öğrenir. Taktik geri çekilme ve klan savunması bu galakside kapalıdır, arayüz bunları sürüm numarasından okuduğu için `starter/season` yanıtı ve kapı birlikte bunu sağlar (§5.7).

Saat, I/O ve rastgelelik içermez, `Rng` argüman olarak verilir. Ana oyunun ekonomi değerleri değişmez, ana simülatör etkilenmez.

### 5.5 Sunucu

`apps/server/src/services/starter/`:

| Dosya | Görev |
|---|---|
| `enlist.ts` | Uygunluk, gemi oluşturma. Tek hesap tek gemi, çift istek tek satır üretir. |
| `galaxy.ts` | Galaksi açma, yer seçme, yerleri kurma |
| `vessel.ts` | `withVesselLock`, tembel ekonomi, özel görünüm |
| `repair.ts`, `yard.ts`, `research.ts`, `dock.ts` | Emirler, iptal, iade |
| `probe.ts`, `watch.ts`, `intel.ts` | Sonda, gözlem, rapor |
| `fleet.ts` | Uçuş, geri çağırma, idempotency |
| `mining.ts`, `sites.ts` | Madencilik, enkaz, karakol, parça |
| `combat.ts` | Savaşı `starterBattle` ile tek transaction'da çözer |
| `traffic.ts` | Sis uygulanmış kontak listesi |
| `publicView.ts` | Galaksi görünümü, sis sorguda uygulanır |
| `mainSky.ts` | Ana galaksi noktaları |
| `notifications.ts`, `chat.ts`, `departures.ts` | Bildirim, sohbet, pano |
| `migration.ts` | Göç (§5.8) |
| `dormancy.ts` | Sessiz gemiler |
| `npcRaids.ts` | Korsan akınları |
| `bots/` | Gemi botu turu ve nüfus |

`apps/server/src/routes/starter.ts` (girdiler Zod ile `schemas/starter.ts` içinde):

```text
GET  /api/starter/vessel                  POST /api/starter/enlist
GET  /api/starter/season                  POST /api/starter/collect
GET  /api/starter/galaxy                  POST /api/starter/repair
GET  /api/starter/traffic                 POST /api/starter/build
GET  /api/starter/pending                 POST /api/starter/orders/:id/cancel
GET  /api/starter/intel                   POST /api/starter/research
GET  /api/starter/mining                  POST /api/starter/dock
GET  /api/starter/mining/field            POST /api/starter/probe
GET  /api/starter/mining/status           POST /api/starter/watch
GET  /api/starter/reports                 POST /api/starter/fleet/launch
GET  /api/starter/reports/:id/replay      POST /api/starter/fleet/:id/recall
GET  /api/starter/notifications           POST /api/starter/mining/launch
GET  /api/starter/return                  POST /api/starter/mining/harvest
GET  /api/starter/main-sky                POST /api/starter/mining/runs/:id/recall
GET  /api/starter/departures              POST /api/starter/notifications/seen
GET  /api/starter/migration               POST /api/starter/return/seen
GET  /api/starter/chat/messages           POST /api/starter/unlocks/seen
GET  /api/starter/chat/unread             POST /api/starter/chat/messages
                                          POST /api/starter/chat/read
                                          POST /api/starter/migrate
```

Her yazma: `requireAuth`, Zod ile parse, `withVesselLock`, `assertFeatureOpen`, mevcut hız sınırı sınıfları. Uçuş, sonda, gözlem ve kazı hedefi aynı galaksideki `vessels` veya `starter_sites` satırı olmak zorundadır, `planets` ve ana oyunun etkinlik tabloları hiç okunmaz (K1). Yeni hata kodları: `STARTER_REQUIRED`, `STARTER_CLOSED`, `VESSEL_NOT_FOUND`, `VESSEL_NOT_ELIGIBLE`, `UNKNOWN_STEP`, `ALREADY_REPAIRED`, `FEATURE_LOCKED`, `REPAIR_REQUIREMENT`, `PVP_PROTECTED`, `PVP_LOCKED`, `MIGRATION_NOT_READY`, `MIGRATION_FLEET_OUT`, `MIGRATION_SEASON_WAIT`. Var olanlar yeniden kullanılır: `HANGAR_FULL`, `INSUFFICIENT_FUEL`, `INSUFFICIENT_RESOURCES`, `QUEUE_FULL`, `BUILD_ORDER_NOT_FOUND`, `BUILD_ORDER_HAS_DEPENDENTS`, `BASH_LIMIT`, `PLACEMENT_CHANGED`. Gemi `DEPARTED` ise bütün `/api/starter/*` istekleri `PLACEMENT_CHANGED` döner, ikinci sekme veya cihaz da böylece yeni yerine geçer.

**Worker.** `worker/starterQueue.ts`, `queue.ts` ile aynı sözleşmeyi uygular: `claimDue`, `nextDueAt`, `complete`, `fail`, `reap`, `schedule`. Ayrı tablo seçildi, çünkü `scheduled_events.season_id` zorunludur, `wipeAllServers` kuyruğu toptan siler ve el değmemiş handler'lar `event.seasonId` okur. `worker/starterHandlers.ts` olayları işler:

```text
vessel_order_complete · vessel_mission_arrival · vessel_mission_return
vessel_radar_warning · site_respawn · npc_raid_launch · pvp_shield_warning
```

`EventWorker` (`worker/loop.ts`) ikinci kuyruğu aynı döngüde, kendi `try/catch` bloğuyla işler: bu kuyruktaki hata ana kuyruğu durdurmaz.

Kurallar:

- Her handler tek transaction'dır, `claimMission` tarzı bir bayrakla tekrar teslimde hiçbir şey yapmaz.
- Gemiler sabit id sırasında kilitlenir.
- Varış anında bütün şartlar yeniden okunur. Bozulan şartta filo savaşmadan döner (§3.6).
- Süpürmeler: sessiz gemi, takılı uçuş (`sweepStranded` örneği), yarım göç, bot turu, eski veri.
- Uçuşlar `assertLandsOutsideMaintenance` kuralına uyar. Bakım penceresine düşen saldırı reddedilir, sonda serbesttir.
- `failedEventCount` ve `oldestPendingAge` bu kuyruk için de `/health` yanıtına eklenir, takılan kuyruk görünür olur.

**Ana sıra kapısı.** `installPlacementGate`, `players` satırı olmayan çağrıyı zaten geçirir, ama bağlantı kirası alabilir. `/api/starter/` yolları kapı dışında tutulur. Kapı `x-astera-rules` sürüm kontrolünü de yaptığı için bu kontrol aynı şekilde `/api/starter/` yollarına eklenir, yoksa eski istemci yeni kurallarla çalışır.

### 5.6 Gerçek zaman

`/api/stream` tek yol olarak kalır. Hesabın `players` satırı yoksa gemi dalına girer:

- `bus.subscribe(vesselId)` ve `bus.subscribeShard(starterGalaxyId)` kullanılır. Topic metindir, UUID çakışmaz, `activityGate` ve client'ın olay eşlemesi değişmeden çalışır.
- **Ana sezon topic'ine abone olunmaz.** K1'in performans şartı budur. `subscribeGlobal` kalır, duyurular gelir.
- `StreamFence` bugün `players` tablosunu okur ve satır yoksa `auth` iptali yapar. `FencedStream` alanına `vesselId` eklenir, doğrulama `vessels` üzerinden yürür.
- Göçte `vessels.status` değişince trigger `placement_changed` yayınlar, client yeni yerleşimi okur.
- Trafik uyandırma (`watchTraffic`, `trafficSignature`) gemi okumasıyla aynen kullanılır.

Galaksi olayları mevcut kısa türleri kullanır: `launch`, `arrival`, `mining`, `pirate`, `world`, `chat`. Yeni tür: `departure`. Payload yalnız galaksi kimliği ve türdür, özel bilgi taşımaz.

**Ana galaksi noktaları.** `GET /api/starter/main-sky`, tamsayıya yuvarlanmış konum dizisi, dünya sayısı, sunucu adı ve sezon bitişini döner. Süreç içinde 10 dakika önbelleklenir, `ETag` ile gelir, client 30 dakika tutar. Kimlik, ad, sahip, hareket içermez, bu yüzden istemci ana galaksideki bir dünyayı hedef gösteremez (K1). Bu yol herhangi bir olayla tetiklenmez, ana galaksi yükünü artırmaz.

### 5.7 Web

**Taşıma katmanı (`apps/web/src/starter/transport.ts`).** Kök `Api` (`main.tsx`) `starterFetch(globalFetch, starterMode)` ile kurulur. `starterMode` kapalıyken istek aynen geçer, bu yüzden ana oyuncular etkilenmez. Tek `Api` ve tek token kalır, yenileme mantığı tekrar yazılmaz. FlightSchool'dakinden farkı, ikinci `Api` ve ikinci sorgu önbelleği olmamasıdır.

`api/client.ts` 218 ayrı yol çağırır. Her yol üç sınıftan birine girer. **Varsayılan kapalıdır:** listede olmayan yol ağa çıkmaz, `STARTER_CLOSED` döner. FlightSchool'un `ACADEMY_ONLY` yanıtı aynı şekilde çalışıyor.

| Sınıf | Yollar | İşlem |
|---|---|---|
| Hesaba bağlı, aynen geçer | `/api/auth/*`, `/api/onboarding/claim`, `/api/announcements*`, `/api/feedback`, `/api/maintenance`, `/api/community/*`, `/api/push/devices` | Dokunulmaz |
| Gemiye yönlenir | `GET /api/planet`, `/api/planets`, `/api/planets/:id` | `/api/starter/vessel` + `vesselToPlanetView` |
| | `GET /api/season` | `/api/starter/season`: `seed`, `status`, `startsAt` (galaksi `epoch`), `endsAt`, `rulesetVersion`, `shard`, `shardName`, `shieldUntil`, boş `rivals`, `result: null`. `GalaxyView`, `useLaunchPlan`, `HudTop` ve `StatusBar` bunsuz çalışmaz. |
| | `GET /api/galaxy`, `/api/galaxy/traffic`, `/api/intel`, `/api/reports`, `/api/reports/:kind/:id/replay`, `/api/notifications`, `/api/session/pending`, `/api/session/return`, `/api/mining`, `/api/mining/field`, `/api/mining/status`, `/api/chat/messages`, `/api/chat/unread` | Aynı şekil |
| | `POST /api/planet/upgrade`, `instrument`, `satellite` ve `/api/planets/:id/upgrade`, `instrument`, `satellite` | `/api/starter/repair`, tür eşlemesi |
| | `POST /api/planet/build`, `/collect`, `/research`, `/build-orders/:id/cancel`, hepsinin `/api/planets/:id/...` biçimi, `/api/planets/:id/repairs`, `/maintenance` | `/api/starter/*`, yanıt `vesselToPlanetView` ile sarılır |
| | `POST /api/intel/probe`, `/api/intel/watch`, `/api/fleet/launch`, `/api/fleet/:id/recall`, `/api/mining/launch`, `/api/mining/harvest`, `/api/mining/runs/:id/recall`, `/api/notifications/seen`, `/api/session/return/seen`, `/api/chat/messages`, `/api/chat/read` | `/api/starter/*` |
| Kapalı, boş şema döner | Klan, anıt, korsan listesi, bilinmeyen sinyal, olay takvimi, konvoy, ticaret, ödül, sıralama, Honor, DM, kozmetik, skin, Miras, kronik, Komutan Gemisi, dönüş başvurusu, tatil, Bildirim Merkezi | `GalaxyView` bunların bir kısmını açılışta okur. Şekilleri `academyFetch.ts` içinde hazırdır. |

`vesselToPlanetView` bütün `planetSchema` alanlarını doldurur ve testte bu şemayla parse edilir. Ana arayüz değişirse test kırılır, sessiz kayma olmaz. Galaksi yanıtında bütün gemiler `coreLevel: 1` taşır, böylece `outOfBandAbove` her zaman false kalır ve bant kuralı kod değişmeden kapanır.

**Oturum (`session/useSession.ts`).**

- `/api/auth/me` yanıtına `vessel` ve `starterEligible` eklenir. `vessel` yalnız `ACTIVE`, `DORMANT` ve `DEPARTING` durumunda dolu gelir.
- `settle(me)`: `vessel` varsa kipi açar ve `ready` olur. `Standing` galaksi ve gemi adından kurulur. `starterEligible` ise `enlist` çağırır. Yoksa bugünkü akış sürer.
- `DEPARTING` durumunda ekran "Kalkış sürüyor" der ve sonucu bekler. Oyuncu bu sırada kapatsa da süpürme işi tamamlar.
- Yeni bir aşama eklenmez, oyun yine `ready` altında çalışır. `App.tsx` en az değişir.
- `onPlacementLost` gemi kipinde `rollover` yerine `me` okuyup yerleşir, böylece sunucu ekranı arada görünmez. Gemi ve gezegen aynı sorgu anahtarlarını kullandığı için geçişte `queries.clear()` şarttır.

**Kapılar.** `StarterGateContext` (`starter/gate.tsx`) varsayılan olarak boştur ve "hepsi açık" demektir, ana oyun etkilenmez.

| Dosya | Değişiklik |
|---|---|
| `v2/hud/Dock.tsx`, `v2/shell/HudDock.tsx` | `locked` sekme: dokununca sebebi söyler (`disabled` dokunmayı keser, açıklayamaz) |
| `screens/GalaxyView.tsx` | `panel === 'planet'` iken gemi kipinde `VesselScreen` çizer, `BaseSwitch` gizlenir |
| `galaxy/FocusPanel.tsx` | Saldır, Sonda, Gözlem, Kazı düğmeleri kapıyı okur. Karakolda yerleşme yolu kapalıdır. |
| `lib/colonization.ts` | Gemi kipinde yerleşme aşaması döndürmez. Karakol `kind: 'NEUTRAL'` olduğu için bu şarttır. |
| `lib/dossier.ts`, `v2/hud/TargetDossier.tsx` | Kademe satırı gemide gizlenir, sonda raporundaki onarım bandı gösterilir |
| `screens/LaunchSheet.tsx`, `lib/useLaunchPlan.ts` | Geri çekilme ve destek kontrolleri gizlenir, "Burada hasar ve Aegis yarıdır" satırı eklenir |
| `lib/useTargetReading.ts` | Aegis tavanı `shieldHp(coreLevel)` yerine `vesselAegisHp(aegisMax)` okunur, yoksa güç aralığı şişer |
| `battle-simulator/scenario.ts`, `fromReplay.ts` | Gemi kipinde `STARTER.combat.tempo` ve `vesselAegisHp` kullanılır, raporu simülatörde açarken Aegis seviyesi buna göre çözülür |
| `shell/MenuPanel.tsx` | Sıralama, ödül, mağaza gizlenir, kalkış panosu eklenir, simülatör `attack` ile açılır |
| `v2/shell/HudTop.tsx` | Açılmamış Döteryum sayacı gizlenir, sezon günü yerine sistem onarımı yazar |

**Yeni yüzeyler (`apps/web/src/starter/`):** `VesselScreen`, `SystemRow`, `NextRepairCard`, `UnlockMoment`, `MigrationPanel`, `LandingChoice`, `DepartureBoard`, `MainGalaxyRow`, `LandingCard`.

**Sahne (`galaxy/`):**

| Dosya | Değişiklik |
|---|---|
| `GalaxyCanvas.tsx` | `frame` prop'u: yarıçap, ana galaksi. Gezinme yarıçapı bu galaksiye göre hesaplanır |
| `scene.ts` | `PlanetNode.body`: `WORLD`, `VESSEL` veya `OUTPOST`. Karakol gezegen gibi çizilir, veride gezegen değildir. |
| `PlanetField.tsx` | `VESSEL` düğümlerini çizmez |
| `initialHomeCameraPosition` | Gemi kipinde ilk kamera ana galaksiye bakar |
| `Environment.tsx` | `DISC_RADIUS` kullanan katmanlar çerçeveden okur. `Disc` ana galaksi için kullanılmaz, yakında güzel ama bu uzaklıkta sarmalı okunmuyor |
| Yeni `MainGalaxySky.tsx` | Gerçek ana galaksi: noktalar, anıt modelleri (8 GLB), gaz bulutları; hiçbiri seçilemez |
| Yeni `VesselField.tsx` | Instanced gemiler, LOD, seçim mevcut boru hattını kullanır |
| Yeni `OwnVessel.tsx` | Hasar durumu ve ışıklar yalnız kendi gemide |
| Yeni `DepartureBeams.tsx`, `MigrationSequence.tsx` | Kalkış izi, göç sahnesi |
| Yeni `StarterGlow.tsx` (A18) | Ana galaksinin gökyüzünde tek çizim çağrılı ışık kümesi, dokunulamaz, veri okumaz |

**Şemalar (`api/schemas.ts`):** `meSchema` için `vessel` ve `starterEligible`, `galaxySchema` için `body`, probe raporu için `repair` bandı, `claimSchema` için gemi dalı. Hepsi eski sunucu için isteğe bağlıdır.

**Prolog (`onboarding/prologue/`):** `Prologue.tsx`, `world.ts`, `fetch.ts`, `copy.ts`, `telemetry.ts`. `ClaimDialog` aynen kullanılır. `App.tsx` içindeki `Academy` lazy importu buna döner.

**Metin:** Altı dilde yeni `starter.ts` (`tr`, `en`, `de`, `es`, `fr`, `ja`), hata kodları (`errors.ts`), bildirim metinleri (`data.ts`, `lib/notifications.ts`). `docs/ux-writing.md` uygulanır. Wiki'ye (`wiki/`) Koloni Gemisi ve göç eklenir. Wiki ana oyunun sayılarını anlatır (`wiki/facts.ts`), bu yüzden gemi bölümü farkları açıkça yazar: menziller, yarı tempo ve yarı Aegis, bu galaksinin oran tablosu, tier yokluğu. Herkese açık tanıtım sayfası ve mağaza metni "yeni oyuncu gemide başlar" diyecek şekilde gözden geçirilir. Hiçbir dilde bot ifadesi geçmez.

### 5.8 Göç

Tek transaction kullanılmaz. `joinSeason`'ın kendi yeniden deneme döngüsü, kilidi ve `onConflictDoNothing` sınıflandırması vardır, korunmaları gerekir. Bu yüzden her adımı idempotent bir saga kullanılır:

```text
1. Transaction: gemi kilidi, şartlar, emirleri iptal ve iade, ambar hesabı.
   vessels.status = DEPARTING, vessel_migrations satırı (idempotency anahtarıyla).
2. Açık ana galaksi bulunur (seatOnFrontier gibi, 3 deneme) + joinSeason(COMMANDER, preferredSlot).
   Zaten yerleşmişse aynı sonucu döner.
   Hata (SHARD_FULL, SERVER_LOCKED, NO_FRONTIER, NO_SEASON, SEASON_ENDED):
   gemi ACTIVE'e döner, oyuncuya sebep söylenir, kayıp olmaz.
3. withPlanetLock: ambarı ekler, recomputeWealth çalışır. vessel_migrations.status ile tek sefer çalışır.
4. Transaction: vessels.status = DEPARTED, starter_departures satırı, galaksiye "departure" olayı.
   Trigger placement_changed gönderir.
```

Bir sweep, belli süredir `DEPARTING` kalan gemiyi 2. adımdan yeniden çalıştırır. Yanıt `{ placement, planet }` döner, client sahneyi oynar. `arrival_seen_at` boşsa son bölüm bir kez gösterilir. Zorla silme 2. ve 3. adım arasına düşerse gezegen yok demektir: gemi `ACTIVE`'e döner, ambar korunur, oyuncu yeniden kalkar.

`joinSeason` iki küçük değişiklik alır:

- `accountHasPlayHistory`, aynı kontrol olarak dışarı alınır ve `enlist` ile paylaşılır.
- İsteğe bağlı `preferredSlot` parametresi. Yuva boşsa ve `spec.slots` içindeyse o seçilir, değilse `LANDING_GONE` döner: seçilen adres başka adresle değiştirilmez (owner, 2026-11-05). Parametre verilmezse davranış aynıdır.

### 5.9 Ana oyunda dokunulan yerler

Bu liste kısa kalmalıdır. Hepsi bayrak kapalıyken davranış değiştirmez.

| Dosya | Değişiklik |
|---|---|
| `packages/rules`: `combat.ts`, `randomBattle.ts`, `battleRetreat.ts` | `resolveBattle` isteğe bağlı `tempo` alır, verilmezse sonuç bit bit aynıdır |
| `services/player.ts` | `accountHasPlayHistory` dışarı alınır, `joinSeason` `preferredSlot` alır |
| `routes/onboarding.ts` | Uygun hesap için `seatOnFrontier` yerine `enlist` |
| `routes/servers.ts` | Uygun hesap veya gemisi olan hesap doğrudan katılırsa `STARTER_REQUIRED` |
| `routes/auth.ts` | `me` yanıtına `vessel` ve `starterEligible` |
| `services/accountSecurity.ts` | `capabilities` yanıtına `starterGalaxy` |
| `routes/session.ts`, `stream/fence.ts`, `stream/bus.ts` | Gemi akışı dalı, `departure` türü |
| `routes/health.ts` | Bu kuyruğun sağlık değerleri |
| `services/placementGate.ts` | `/api/starter/` muafiyeti |
| `services/accountDeletion.ts` | Silme açıklamasına gemi eklenir, satırlar cascade ile gider |
| `services/bots/sweep.ts` | Ana galaksi koltuğu için önce gemisi olmayan, sonra kalkışa hazır bot seçilir. Hazır olmayan gemili bot alınırsa gemisi uykuya geçer. |
| `worker/loop.ts` | İkinci kuyruk ve süpürmeler |
| `env.ts`, `app.ts` | `STARTER_GALAXY_ENABLED`, rota kaydı |
| `drizzle/` | Trigger işlevi genişletilir |

`wipeAllServers`, `listServers`, `peopleIn`, `canAttack` ve ekonomi kurallarına dokunulmaz. Savaş kuralındaki tek ek yukarıdaki parametredir.

**Admin ve operasyon.** Admin panelinde gemi sayısı, aşama dağılımı, kuyruk gecikmesi, gerçek ve bot oranı görünür. `pnpm starter status`, `pnpm starter land-all` ve beta için `pnpm starter reset` komutları eklenir (varsayılan dry-run). `wipeAllServers` gemilere dokunmadığı için beta sıfırlamasında bu ayrı komut gerekir. Mevcut `placement_completed` analitiği artık inişte çalışır, huni okumaları buna göre yorumlanır.

### 5.10 Performans

| Kural | Değer |
|---|---|
| Gemideki oyuncu, ana galaksi olayı almaz | Test: ana sezon olayında sıfır frame |
| Ana galaksi noktaları | Gzip ile 30 KB altı, 10 dakikada en çok bir veritabanı okuması |
| Galaksi başına 300 gemi | Toplam sorgu ve bellek, tam bir ana galaksinin 1/5'inden az |
| Oyuncu başına sorgu sayısı | Gemi sayısıyla büyümez (mevcut sorgu sayısı testi örneği) |
| Sahne | Ana galaksi sahnesinden daha ucuz, S22'de ölçülür |
| Kuyruk | Bu galaksi hatası ana kuyruğu geciktirmez |
| Veri | Silme olmadığı için `retentionDays` süpürmesi tablo büyümesini sınırlar |

### 5.11 Kural aynaları

Bir şey değişince nereye yansıdığı:

| Değişiklik | Yansıdığı yer |
|---|---|
| Yeni `planetSchema` alanı | `vesselToPlanetView`, `starter-adapter` testi |
| Yeni istemci yolu | `starter/transport.ts`, sınıflandırma testi |
| Yeni gemi veya `rulesetVersion` | `STARTER.hulls`, `starter-battle`, `LaunchSheet` kapısı |
| `COMBAT` ayarı (tempo, raunt, kaçış, karşı sınıf) | `starterOutcomeTable` yeniden ölçülür, `starter-outcome-table` testi uyarır |
| İlk sezon paketi | `starter-carry`, iniş kartı |
| Bu galaksinin bir kuralı | `rules/starter`, sunucu, ekran, 6 dil, Wiki, test |
| `packages/sim` | Bu galaksiyi modellemez. Ambar, ana galaksideki ilk sezon ekonomisini biraz değiştirir. Etkisi yalnız owner açıkça isterse uzun testle ölçülür. |

## 6. Güvenlik

| Risk | Önlem | Test |
|---|---|---|
| Menü gizli ama istek atılabilir | Her yazma `assertFeatureOpen` çağırır | Kapalı özelliğe doğrudan istek reddedilir |
| Client geri alınmış ilerleme gönderir | Sunucu ilerleme kabul etmez, başlangıcı sabitten kurar | `claim` gövdesindeki alanlar yok sayılır |
| Botun fark edilmesi | Görünümlerde alan farkı yok, `vessel_bot_state` görünüme girmez | Bot ve gerçek gemi görünümlerinin anahtarları birebir aynı. Yeni metinlerde yasak kelime taraması. |
| Sis sızıntısı | Sis sorguda, alan yokluğuyla uygulanır | `UNKNOWN` gemi yalnız `id`, `position`, `body` taşır |
| Onarım ilerlemesinin sızması | Yalnız sonda raporunda, bant olarak | Galaksi görünümünde ilerleme alanı yok |
| Çift göç veya çift hediye | Hesap başına tek gemi, `vessel_migrations` PK, ambar tek sefer | Her adımda kesinti testi, eşzamanlı iki istek |
| İkinci hesapla kaynak aktarma | Düşük yağma, günlük akın sınırı, ambar tavanı | Tavan testi |
| Eski oyuncunun yeni hesapla ezmesi | Filo tavanı, yarı tempo, 12 saatte 2 saldırı | Kural testleri |
| Ana galaksiye uçuş, sonda, kazı veya ters yönde erişim | Hedef yalnız aynı galaksideki gemi veya noktadır. Ana galaksi kimliği hiçbir yanıtta yoktur. Ana oyun yolları gemi kimliği tanımaz. | `starter-isolation` |
| Kötü niyetli girdi | Zod ile strict parse, tamsayı ve üst sınırlar, idempotency anahtarı | Geçersiz girdi testleri |
| Eşzamanlılık | Satır kilidi, sabit kilit sırası, tek transaction'da savaş | Aynı anda iki emir tek ödeme, iki filo tek parça |
| Zaman | `Clock` enjekte, tembel ekonomi | Saat ileri alınarak testler |
| Toplu kayıt | Mevcut `app.limits.signup`, galaksi `capacity` sınırı | Galaksi dolunca kapanır, sıradaki açılır (bkz. Evren yapısı) |
| Gemide kalıp ezme | Göçe hazır veya 14 günlük gemi saldıramaz (A9) | `PVP_LOCKED` testi |
| Parça istifleme | Gemi en fazla 3 parça tutar | Dördüncü parça sahada kalır |
| Sonda ve bildirim seli | Sonda bedeli, 5 saniye bekleme, bildirim `unique(vessel_id, kind, ref_id)` | Tekrarlı sonda tek uyarı üretir |
| Kısa ömürlü hesapla enkaz beslemesi | Enkaz, yok olan geminin değerinin %10'udur | Kârsızlık testi |
| Sohbet | `findProfanity`, hız sınırı, `communityBlocks`, içerik raporu | Moderasyon testleri |
| Hesap silme ve ban | Cascade, ban'lı gemi gizlenir, akış kapanır | Silme ve ban testleri |
| Eski istemci | `me.vessel` bilmeyen native sürüm sunucu ekranında kalır | Bayrak açılmadan asgari sürüm yükseltilir, eski sürüm `UPDATE_REQUIRED` alır |

## 7. Geçiş ve yayın

1. Migration'lar eklemelidir, bayrak kapalıyken davranış aynıdır.
2. `STARTER_GALAXY_ENABLED=false` ile ana sunucuya çıkılabilir. Deploy yalnız owner'ın o turdaki talimatıyla yapılır.
3. `bootstrapStarterGalaxy` komutu (`cli/starter.ts`): EU-1 için galaksiyi ve yerleri kurar, tekrar çalıştırılabilir.
4. Önce stage'de oynanır, bayrak orada açılır.
5. Bayrak prod'da açılınca yeni hesaplar ve hiç oynamamış eski hesaplar bir sonraki girişlerinde gemiye gider. Oynamış oyuncular ve sezonlar etkilenmez, sıfırlama gerekmez.
6. EU-2 (Kestrel) yalnız insanlara açıktır ve botları kabul etmez. Galaksi EU-1'e bağlıdır, gerçek oyuncunun inişi açık galaksiye yönlenir (A13), bot yalnız EU-1'e iner.

**Geri alma.** Bayrak yalnız yeni gemi açılmasını durdurur, yeni hesaplar eski akışa döner. Var olan gemiler çalışmaya devam eder, oyuncu ortada kalmaz. Bu yüzden FlightSchool ancak yayın oturduktan sonra silinir (Faz 11). Hepsini kapatmak gerekirse `pnpm starter land-all` komutu, gemileri standart paketle indirir ve varsayılanı dry-run'dır.

**Yayın ölçümü.** Yeni analitik olaylar (`analyticsSchemas.ts`): `vessel_enlisted`, `vessel_step_completed`, `vessel_feature_opened`, `vessel_first_probe_sent`, `vessel_first_probe_received`, `vessel_first_mine`, `vessel_first_battle`, `vessel_first_pvp`, `vessel_part_found`, `vessel_migration_started`, `vessel_migration_landed`. Prolog mevcut `training_*` olaylarını `trainingVersion: 'prologue.v1'` ile kullanır.

Başarı ölçütleri:

| Soru | Ölçüt |
|---|---|
| Oyuncu kalıyor mu? | Hesap açandan 1. ve 3. gün dönüşü |
| Süre doğru mu? | Göç edenlerin süresi, ortanca 3–5 gün |
| Öğreniyor mu? | Göç edenin ilk 7 günde yardım istemeden sonda, gözlem ve filo kullanması |
| Dayak azaldı mı? | İnişten sonraki 7 günde kesin yenilgi sayısı ve bırakma, mevcut ilk oyun oyuncularıyla karşılaştırma |
| Etkileşim gerçek mi? | Oyuncu başına alınan sonda ve savaş, gerçek-gerçek oranı |
| Motive edici mi? | Her adımdaki terk oranı |

## 8. Aşamalar

Her aşama TDD ile ilerler: önce testler yazılır ve FAIL görülür, sonra kod yazılır ve PASS görülür. Kısa testler 1 worker, orta ve uzun gruplar 4 worker, her veritabanlı worker kendi `_test` veritabanıyla çalışır. Her adımda dokunulan testler, iş bitince tam set çalışır. Uzun ekonomi testleri çalıştırılmaz. Görsel doğrulama `node tools/visual.mjs` ile yapılır. Kayıt sınırına takılmamak için görsel testler sabit yerel hesap kullanır.

### Faz 0: Görsel doğrulama

- **Hedef:** Yan yana galaksi fikri telefonda görülsün.
- **İş:** Codex ile gemi ve kesit konsepti, 3D model kaynağı. Yerel `?starterPreview=1` sahnesi: ana galaksi plakası, 1230 nokta, tek gemi.
- **Çıkış:** Owner görüntüyü onaylar. S22'de kare süresi ölçülür. `mainOffset` ve gemi modeli boyut bütçesi kesinleşir.

### Faz 1: Saf kurallar

- **Hedef:** Bütün kurallar sunucusuz test edilebilir olsun.
- **İş:** `packages/rules/src/starter/*`, `resolveBattle` için isteğe bağlı `tempo`.
- **Önce testler:** `starter-geometry`, `starter-ladder`, `starter-first-session`, `starter-features`, `starter-economy`, `starter-pacing`, `starter-battle`, `combat-tempo-default`, `starter-outcome-table`, `starter-protection`, `starter-carry`, `starter-sensors`, `starter-placement`, `starter-site-plan`.
- **Çıkış:** Süre testi hedef bandında geçer. `tempo` verilmeyen savaş bit bit aynıdır. `starter-pacing` saf ve kısa bir testtir, `packages/sim` veya uzun test kapsamına girmez. Mevcut rules testleri aynıdır.

### Faz 2: Veri, gemi ve onarım

- **Hedef:** Hesap gemi alır, kaynak toplar, onarım yapar. Şimdilik yalnız API ile.
- **İş:** Migration'lar, `enlist`, `galaxy`, `vessel`, `repair`, `starter_events` kuyruğu, bildirim, `me`, `claim` ve `servers` dalları, bayrak, `/api/stream` gemi dalı, fence ve trigger, hesap silme.
- **Önce testler:** `starter-enlist`, `starter-repair`, `starter-stream`, `starter-survives` (sezon silme, hesap silme, ilk sezon paketi, bayrak kapalı).
- **Çıkış:** Geçmiş tuzağı testi yeşil: gemi yaşamış hesap `joinSeason` ile ilk sezon paketini ve 72 saatlik kalkanı alır. Sezon silmesi gemiye dokunmaz. Ana sezon olayında gemi akışına frame gitmez.

### Faz 3: Oynanabilir ilk gün

- **Hedef:** Owner gemiye girip rafineriyi onarır ve ana galaksiyi görür.
- **İş:** `starterTransport` (218 yolun sınıflandırması, varsayılan kapalı), `vesselToPlanetView`, `/api/starter/season`, kapı bağlamı, `useSession` dalı, `Dock` kilidi, `VesselScreen`, `UnlockMoment`, `MainGalaxySky`, `/api/starter/main-sky`, `OwnVessel`, `VesselField`, ilk kamera.
- **Önce testler:** `starter-transport`, `starter-adapter`, `starter-season`, `starter-gate`, `vessel-screen`, `starter-session`, `main-sky-fog`.
- **Çıkış:** 350 px, 390 px ve masaüstü ekran görüntüleri. Beş tasarım ilkesi denetimi. **Owner oynar.**
- **Uygulamada verilen kararlar (2026-11-04):**
  - Kapı için Context yerine `gateOf(vessel)` ve `useStarterGate()`: gemi zaten `usePlanet` verisinde, ikinci bir durum kaynağı gerekmedi.
  - Onarım ekranı `/api/planet/upgrade` yerine doğrudan `/api/starter/repair` çağırır; o yol gemi kipinde kapalıdır.
  - Komşu gemiler bu fazda `PlanetField`'ın karanlık gezegen yolunda çizilir ve dokununca kart açmaz (`gate.worldCards`). Kartı Faz 4 açar, gemi modelini `VesselField` A19 GLB'leriyle alır.
  - Kendi gemin A19 gelene kadar arena gövdesiyle çizilir; `vesselLook` ve `vesselHull` hazırdır.
  - Faz 3'te kapalı kalanlar: `/api/session/return` (dönüş hikâyesi çıkmaz), bildirim listesi boş, Keşif sekmesi açılır ama içeriği ana oyunun metniyle durur (Faz 4). Kayıt formundaki başlangıç paketi metni ve eski 11 dersli FlightSchool Faz 9'dadır.

### Faz 4: Görmek ve bakmak

- **Hedef:** İki hesap birbirine sonda yollar, sonda karşı tarafın ekranına düşer.
- **İş:** Keşif anteni, `publicView`, `probe`, `intel`, `watch`, `traffic`, Teleskop ve Radar, sensör halkaları.
- **Önce testler:** `starter-fog`, `starter-probe`, `starter-watch`, `starter-traffic`.
- **Çıkış:** Bant genişliği Keşif anteniyle daralır. Kontak yalnız menzilde görünür. Bir gemiye gelen ilk sonda her zaman bildirim üretir.

### Faz 5: Filo ve paylaşılan noktalar

- **Hedef:** Filo haritada gerçekten uçar, oyuncular aynı hedef için yarışır.
- **İş:** `yard`, `fleet`, `mining`, `sites`, Hangar, araştırma, kaya arzı (`asteroidTargetPerHour`), yakıt ve Döteryum hediyesi, itki parçası, açık parça hedefi, enkaz ve asteroit görselleri, karakol düğümü.
- **Önce testler:** `starter-yard`, `starter-fleet`, `starter-isolation`, `starter-research`, `starter-mining`, `starter-supply`, `starter-sites`, `starter-part-race`.
- **Çıkış:** Ana galaksideki hiçbir hedefe uçuş gitmez. İki filo aynı ana gelirse parçayı biri alır. Az nüfusta açık parça hedefi korunur. Sürekli kazan oyuncu da arz sınırını aşamaz.

### Faz 6: Savaş

- **Hedef:** Küçük savaşlar gerçek, kayıp sınırlı olsun.
- **İş:** `combat`, karakol muhafızı, `npcRaids` (önce gözcü, Aegis sonrası akın), koruma kuralları, saldırı kilidi (A9), Onarım İstasyonu, savaş enkazı, tekrar izleme, rapor satırı, filo gönderme ekranındaki kural, simülatörün tempo ve Aegis bağlantısı, Aegis tavanı, tier ve geri çekilme kontrollerinin gizlenmesi.
- **Önce testler:** `starter-combat`, `starter-protection-api`, `starter-damage-dock`, `starter-no-softlock`, `starter-npc-raid`, `starter-report`, `starter-simulator`, `starter-band-ui`.
- **Çıkış:** Savaş yarı tempoyla çözülür, gemi yok olabilir, hasar ve fatura doğrudur. Filosunu kaybeden oyuncu kilitlenmez. Hedef kaybolursa savaş olmaz. Tekrar teslim ikinci savaş üretmez. Rapor ve gönderme ekranı yarı hızı söyler. Karşı sınıf bilgisi karardan önce görünür. Arayüzde kademe yazmaz.

### Faz 7: Motor ve göç

- **Hedef:** Oyunun doruk anı.
- **İş:** Motor adımları, yakıt, `MigrationPanel`, `LandingChoice`, `joinSeason` `preferredSlot`, açık galaksi seçimi, `migration.ts` saga, `MigrationSequence`, `LandingCard`, iniş sonrası tanıtım kartları, `departures`, `DepartureBeams`, `StarterGlow`, sezon sonu kuralı ve yeni sezon bildirimi.
- **Önce testler:** `starter-migration`, `starter-migration-crash` (her adımda kesinti), `starter-migration-season`, `starter-landing-slot`, `starter-landing-switch`, `migration-sequence`.
- **Çıkış:** Baştan sona: gemi, göç, gezegen, ilk sezon paketi, 72 saat kalkan, ambar bir kez. Kesintide oyuncu kayıp yaşamaz. Vantage doluysa açık galaksiye iner. Sahne S22'de akıcıdır. **Owner oynar.**

### Faz 8: Canlı galaksi

- **Hedef:** Tek gerçek oyuncu bile canlı bir galaksi görsün.
- **İş:** Gemi botu turu, nüfus, isim havuzu, ana galaksi koltuğuyla uyum, kalkış ve inme, sessiz gemi ve yuva boşaltma, eski veri süpürmesi, sohbet, ücretsiz bildirimler, dönüş özeti, admin görünümü.
- **Önce testler:** `starter-bots`, `starter-bots-indistinguishable`, `starter-dormancy`, `starter-retention`, `starter-chat`, `starter-push`.
- **Çıkış:** Hızlandırılmış saatle 3 günlük testte (uzun ekonomi testi değildir) botlar onarır, koltuk varsa iner, yoksa çekilir. Görünümlerde fark yoktur. Kalkış panosundaki bot ana galakside vardır. Ana galaksinin mevcut bot koltukları eksilmez.

### Faz 9: Prolog ve metinler

- **Hedef:** Yeni gelenin ilk 3 dakikası.
- **İş:** `onboarding/prologue/*`, ilk ziyaret bağlantısı, `capabilities` bayrağı, `claim` gemi dalı, menüdeki el kitabı, altı dil, Wiki, tanıtım metinleri, analitik olaylar, `tools/starter-visual.mjs` ve `tools/visual.mjs --starter`.
- **Önce testler:** `prologue`, `prologue-claim`, `starter-capabilities`, `starter-i18n-parity`, `starter-no-bot-word`, `first-visit` güncellemesi.
- **Çıkış:** Hesapsız başlar, hesapla aynı gemide sürer. Yüklenme, mevcut ilk ziyaret değerlerinden kötü değildir (0,54 MB ilk paket, 1,38 MB yavaş profil toplamı). Ölçüm, 2026-11-05: ilk JS paketi 0,56 MB gzip (20 KB büyüdü, 6 KB'ı İngilizce gemi metni), prolog ekranına kadar inen script 0,90 MB (reklam dahil), Prolog parçası 4 KB.

### Faz 10: Sertleştirme ve yayın

- **Hedef:** Güvenli açılış.
- **İş:** Güvenlik incelemesi, `tools/capacity.mjs --scenario starter` (adım adım, son tutan seviyeden başlayarak), `/health` değerleri, `pnpm starter` komutları, asgari istemci sürümü ve yeni Android paketi, belgeler, stage oynanışı (deploy yalnız owner o turda isterse).
- **Çıkış:** `pnpm verify` yeşil (bilinen kırmızı set dışında). Owner onayı. Bayrak açılışı ayrı talimatla.

### Faz 11: Temizlik

Yayın oturduktan sonra:

- `onboarding/flightSchool/`, `Academy.tsx`, `Rehearsal.tsx`, `academy*`, `rehearsalFetch.ts` ve testleri silinir. `tools/flight-school-visual.mjs` kaldırılır.
- `academyFetch.ts` içindeki boş şemalar `starter/closedSystems.ts` dosyasına taşınır.
- `packages/rules/src/academy.ts`, bot koltukları (`services/bots/sweep.ts`) hâlâ kullandığı için bu aşamada kalır. Ayrı karar gerekir.
- `docs/game-design.md` içindeki eski "unlock cascade" düzeltilir.

**Belgeler:** `docs/game-design.md`, `docs/architecture.md`, `docs/interface.md`, `docs/glossary.md`, `docs/review-onboarding.md`, `docs/review-sight.md` ve `CLAUDE.md` doküman haritası güncellenir. Şu an başka bir çalışmanın commit edilmemiş değişiklikleri olan dosyalara dokunmadan önce durum kontrol edilir.

## 9. Test planı

Her ölçüt bir testtir. Dosyalar: `packages/rules/test/`, `apps/server/test/`, `apps/web/test/`.

| Ölçüt | Test | Faz |
|---|---|---|
| En geniş sensör ana galaksiye ulaşamaz, galaksiler kesişmez | `starter-geometry` | 1 |
| Her adıma ulaşılabilir, döngü yok, beş sistem var, her bedel o aşamadaki depo tavanına sığar | `starter-ladder` | 1 |
| Açılış kaynağı ilk sonda ve ilk uzun onarıma yeter, ilk üç onarım 5 dakikayı geçmez | `starter-first-session` | 1 |
| Her özellik doğru adımda açılır, bir açılmada tek sistem açılır, kapalı liste kapalı kalır, savaş raporu ilk akından önce açıktır, Saldır ilk rapordan önce kapalıdır | `starter-features` | 1 |
| Arızalı modül üretmez, üretim `advanceEconomy` ile aynıdır | `starter-economy` | 1 |
| Günde 2 oturum en çok 5 gün, 4 oturum en az 3 gün, aşırı aktif oyuncu en az 2 gün | `starter-pacing` | 1 |
| Savaş `STARTER.combat.tempo` ile çözülür, gemi yok olabilir, filonun tamamı yok olursa dönüş olmaz, Aegis tempo oranında ölçeklenir ve Aegis 2'de durur, hiç tier alanı okunmaz | `starter-battle` | 1 |
| `tempo` verilmeyen `resolveBattle` bit bit aynı sonucu verir | `combat-tempo-default` | 1 |
| `starterOutcomeTable` gerçek çözücüyle 5 puan içinde uyuşur (kısa test, uzun ekonomi testi değildir) | `starter-outcome-table` | 1 |
| PvP açılışı, kalkan düşmesi, 2 saldırı sınırı, 3 akın sınırı | `starter-protection` | 1 |
| Ambar tavanı, hasarlı gemi taşınmaz | `starter-carry` | 1 |
| `vesselSphere` menzilleri `STARTER.telescope` ve `STARTER.radar` ile aynıdır, çıplak göz 150'dir | `starter-sensors` | 1 |
| `starterSlots` `minSeparation` kuralına uyar, `pickVesselSlot` aktif komşuya yakın boş yuva seçer | `starter-placement` | 1 |
| Yer planı sayılara, kapasiteye ve mesafeye uyar, açık parça hedefi ve kaya arzı doğrudur | `starter-site-plan` | 1 |
| Yeni hesap ve hiç oynamamış eski hesap gemi alır, geçmişi olan alamaz, çift istek tek satır, gemisi olan doğrudan katılamaz, galaksi doluysa ana galaksiye gider | `starter-enlist` | 2 |
| Gemi yaşamış hesap ilk sezon paketini ve 72 saat kalkanı alır | `starter-survives` | 2 |
| Bayrak kapalıyken eski akış aynı, var olan gemi çalışır | `starter-survives` | 2 |
| Onarım öder, kuyruğa girer, şart ister, eşzamanlı çift emir tek ödeme | `starter-repair` | 2 |
| `wipeAllServers` gemi, uçuş ve olaylara dokunmaz | `starter-survives` | 2 |
| Hesap silinince gemi gider, galaksi kalır (başkasının raporu Faz 6'da) | `starter-survives` | 2 |
| Gemi akışı açılır, ana sezon olayı gelmez, galaksi olayı gelir | `starter-stream` | 2 |
| Kapalıyken taşıma katmanı isteğe dokunmaz, açıkken bilinmeyen yol ağa çıkmaz, `api/client.ts` içindeki her yol sınıflıdır | `starter-transport` | 3 |
| `vesselToPlanetView` çıktısı `planetSchema` ile parse edilir | `starter-adapter` | 3 |
| `/api/starter/season` `seasonSchema` ile parse edilir, `GalaxyView` açılışı hata üretmez | `starter-season` | 3 |
| Kilitli sekme ve düğme görünmez veya sebebini söyler | `starter-gate` | 3 |
| Sıradaki onarım doğru gösterilir, seviye yazmaz | `vessel-screen` | 3 |
| `me` yanıtına göre doğru ekran açılır | `starter-session` | 3 |
| Ana galaksi noktaları kimlik içermez | `main-sky-fog` | 3 |
| `UNKNOWN` gemi yalnız izinli alanları taşır, ilerleme sızmaz | `starter-fog` | 4 |
| Sonda gerçek uçar, yakalanırsa hedefe bildirim düşer, ilk sonda her zaman yakalanır | `starter-probe` | 4 |
| Bant genişliği her Keşif anteni aşamasında daralır, rapor sonradan değişmez | `starter-probe` | 4 |
| Kontak yalnız menzilde, radar yalnız işaret, teleskop içerik | `starter-traffic` | 4 |
| Radar uyarısı doğru anda gelir | `starter-traffic` | 4 |
| Gözlem sayısı `telescopeSlots` ile sınırlıdır, bekleme süresi uygulanır | `starter-watch` | 4 |
| Gemi üretimi öder, `STARTER.hulls` dışındaki gemi reddedilir, tersane kuyruğu inşaat kuyruğundan ayrıdır | `starter-yard` | 5 |
| Hangar odası, saldırı yuvası, idempotency, yakıtsız uçuş reddi, Döteryum hediyesi tek sefer | `starter-fleet` | 5 |
| Ana galaksideki gezegen, asteroit, korsan, konvoy veya etkinlik hedef gösterilemez, ana oyun yolları gemi kimliğini tanımaz, sohbet ayrıdır | `starter-isolation` | 5 |
| Araştırma Hangar 2 ile açılır, gemiyle kalır, gezegene geçmez | `starter-research` | 5 |
| Madencilik ve enkaz kaynağı tek sefer verir | `starter-mining`, `starter-sites` | 5 |
| Kaya arzı aktif gemiyle ölçeklenir, sürekli kazan oyuncu arzı aşamaz | `starter-supply` | 5 |
| İki filo aynı ana gelirse parçayı biri alır, parça çalınamaz, 3'ten fazla tutulamaz | `starter-part-race` | 5 |
| Parça görünürlüğü sise ve Motor paneline uyar, açık parça hedefi korunur | `starter-sites` | 5 |
| Savaş tek transaction, tekrar teslim ikinci savaş üretmez, muhafızlı noktada parça yalnız kesin zaferle alınır | `starter-combat` | 6 |
| Hedef kalkmış, uykuda veya kalkanlıysa filo savaşmadan döner | `starter-combat` | 6 |
| Korumalı hedefe saldırı reddedilir, onaylı ilk saldırı kalkanı düşürür, göçe hazır ve 14 günlük gemi saldıramaz | `starter-protection-api` | 6 |
| %95 ve üstü hasarlı gemi saldıramaz, %20'ye kadar hasar ücretsizdir, dock faturası ve süresi doğrudur, savaş enkazı yok olan gemi değerinin %10'udur, 100 kaynağın altında alan oluşmaz | `starter-damage-dock` | 6 |
| Bütün filosu yok olan oyuncu üretim, Kazıcı ve enkaz yoluyla göçe ulaşır | `starter-no-softlock` | 6 |
| Gözcü Radar 1 ve oyuncunun kendi ilk seferi sonrası savaşsız döner, ilk akın Aegis 1 sonrası oyuncu aktifken gelir, rapor Saldır'ı açar | `starter-npc-raid` | 7 |
| Rapor ve gönderme ekranı yarı hızı söyler, tekrar izleme açılır | `starter-report` | 6 |
| Gemi kipinde simülatör ve hedef okuması bu galaksinin tempo ve Aegis değerini kullanır | `starter-simulator` | 6 |
| Gemi kipinde `outOfBand` yok, kademe ve yerleşme kontrolleri görünmez | `starter-band-ui` | 6 |
| Göç: gemi tüketilir, `players` ve gezegen oluşur, ambar bir kez, servet yeniden hesaplanır | `starter-migration` | 7 |
| Her saga adımında kesintiden sonra sweep tamamlar, zorla silme arada kalırsa gemi geri döner | `starter-migration-crash` | 7 |
| `SHARD_FULL`, `SERVER_LOCKED`, `NO_FRONTIER`, `NO_SEASON` ve `SEASON_ENDED` sonrası gemi sağlam döner | `starter-migration` | 7 |
| Seçilen yuva boşsa o alınır, kapılmışsa `LANDING_GONE` döner ve yeni adresler gösterilir, parametresiz davranış aynıdır | `starter-landing-slot`, `starter-hardening` | 7 |
| Vantage doluyken açık galaksiye iner, önbellek temizlenir, sunucu ekranı arada görünmez | `starter-landing-switch` | 7 |
| Sezonun son 5 gününde kalkış bekler, silmeden sonra açılır ve bildirim gider | `starter-migration-season` | 7 |
| Eşzamanlı iki göç isteği tek sonuç verir, ikinci cihaz `PLACEMENT_CHANGED` alır | `starter-migration` | 7 |
| Sahne kesilirse son bölüm bir kez gösterilir | `migration-sequence` | 7 |
| Bot turu ilerler, parça önceliği gerçek oyuncudadır, ilk gün yeni komşuyu sondalar | `starter-bots` | 8 |
| Bot ve gerçek gemi görünümleri aynı anahtarları taşır | `starter-bots-indistinguishable` | 8 |
| Kalkış panosundaki bot ana galakside vardır, bot yalnız koltuk açılınca iner, EU-2'ye inmez, inmiş bot yeni gemi açamaz | `starter-bots` | 8 |
| Ana galaksi bot koltuğu önce gemisiz, sonra hazır botla dolar | `starter-bots` | 8 |
| Sessiz gemi haritadan çekilir, dönünce geri gelir, yuvası hemen boşalır (owner, 2026-11-05) | `starter-quiet-ships` | 8 |
| Kalkmış geminin ayrıntıları süre sonunda silinir, tek gemi kuralı korunur | `starter-retention` | 8 |
| Sohbette küfür, hız, engel ve rapor çalışır | `starter-chat` | 8 |
| Radar uyarısı dahil telefon bildirimi bu galakside ücretsizdir, inişten sonra ana kural geçerlidir | `starter-push` | 8 |
| Prolog hesapsız çalışır, ağa oyun isteği çıkmaz | `prologue` | 9 |
| Sahiplenince sunucu başlangıcı `STARTER.opening` ile aynıdır | `prologue-claim` | 9 |
| Bayrak `capabilities` ile okunur, cevap yoksa eski eğitim açılır | `starter-capabilities` | 9 |
| Altı dilde anahtarlar tam, bot ifadesi yok | `starter-i18n-parity`, `starter-no-bot-word` | 9 |
| `/api/starter/galaxy` sorgu sayısı gemi sayısıyla büyümez | `starter-query-count` | 10 |

**Görsel kontroller (`tools/starter-visual.mjs`):** Gemi ekranı, her açılma anı, kilitli sekme, ana galaksi görünümü, sonda raporu, savaş raporu, göç paneli, iniş kartı. 350 px, 390 px ve masaüstünde. v2 parçaları galeri kamerasıyla da çekilir.

**Regresyon:** İlgili ana oyun testleri her fazda (`academy-*`, `account-deletion*`, stream, sezon silme, bot). Faz 10'da tam set.

## 10. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Savaş burada yarı hızda olduğu için ana galakside ilk savaş sert gelir | Bırakma | Rapor satırı, gönderme ekranı, iniş kartı. Ölçülür. Gerekirse tempo yükseltilir, tek sayıdır. |
| Eşit savaş yine pahalıdır: Aegis'siz 6 Ok ↔ 6 Ok %24–28 gemi bırakır | Oyuncu filo kurmaktan çekinir | Oyun testinde izlenir. Yetmezse tempo 0,08 denenir (10 gemilik eşit savaşta %36 kalır) veya kurtarma payı yeniden değerlendirilir. |
| Eşit filoya saldırı genelde boşa gider: 6 Ok → 6 Ok + Aegis 1 %49 boş döner, saldıranın %12'si kalır | Cesaret kırılır | Bu bir derstir: sonda raporu Aegis'i söyler, simülatör ve oran tablosu karardan önce görünür. |
| Süreç "bekle, topla, yükselt" hissi verir | Temel döngüden sapma | Her sistemde dünyaya bakan adım, oyun testi, adım başına terk ölçümü |
| 3–5 gün yeni oyuncuya uzun gelir | Erken kayıp | Her dönüşte yeni bir şey açılır. İlk iki adım dakikalar içinde biter. Veriye göre kısaltılır. |
| Az nüfusta galaksi boş görünür | Yalnızlık | Komşu hedefli botlar, aktif gemilere yakın yerleşme |
| Sohbet sessiz kalır | Sosyal kayıp | Kendi kanalı korunur (A6), veriyle değerlendirilir |
| Taşıma katmanı ana arayüzün gerisinde kalır | Sessiz bozulma | `planetSchema` parse testi, kapalı sistemler için boş şema testi |
| Mantık iki kez yazılır, kurallar ayrışır | Yanlış öğrenme | Formüller ortak `@astera/rules`. Yalnız kalıcılık ayrıdır. |
| Geç sezonda inen oyuncunun dengi az olur | Yalnızlık veya zorluk | Ana oyunun ±1 bandı korur. Dengi azsa ayrı içerik kararı gerekir. |
| Bot davranışı sırıtır | Kilitli kural ihlali | Görünüm eşitliği testi, oturum ve sessiz saat mantığı, oyuncu gözlemi |
| Ana galaksi görseli telefonda pahalı kalır | Akıcılık | Faz 0 ölçümü, tek çizim çağrısı, ucuz shader |
| Göç sırasında ana sunucu dolu veya sezon bitmiş | Hayal kırıklığı | Gemi sağlam döner, sebep net söylenir, tekrar denenir |
| Motor için parça bulunamaz | Takılma | Asgari açık parça hedefi, gerçek oyuncu önceliği |
| Tier olmadığı için 16 gemilik oyuncu yeni kalkan bitmiş 3 gemilik oyuncuyu vurur | Dayak geri gelir | Düşük yağma, yarı tempo (savunan gemilerinin %46'sını korur, ana oyunda %21), akın sınırları, 14 gün kilidi. Oyun testinde izlenir. Yetmezse yağma, saldıran ile hedefin gücüne göre düşürülür. |
| İhtiyatlı oyuncu Aegis'i sona bırakıp PvP'den kaçar | Ders eksik kalır | Kabul edilir, korsan akını ilk savaşı garanti eder |
| Günler harcayan oyuncu inişten sonra 3 gün girmeyince gezegenini kaybeder | Bırakma | İniş kartı söyler. Karar A20. |
| Bot isimleri ana galaksiyle yarışır | Ana galakside koltuk eksilir | Ana galaksi önceliklidir, `reportShortRoster` uyarır, owner isim ekler |
| Gerçek oyuncu azken pano boş kalır | Az sosyal kanıt | Yalnız gerçek inişler yazılır, oyunda dürüstlük önceliklidir |
| Web oyuncusuna telefon bildirimi gitmez | Dönüş azalır | Dönüş özeti. E-posta hatırlatması kapsam dışıdır. |

## 11. Kapsam dışı

Bu sürümde yok, sonraki genişlemeler için aday:

- Bu galakside klan veya mürettebat, ticaret, taktik geri çekilme.
- Birlikte kalkış (kafile) ve arkadaşla aynı adrese iniş.
- Bu galaksiye özel etkinlik takvimi ve mevsimlik olaylar.
- Gemi kozmetiği, Komutan Mirası'na "ilk göç" kaydı.
- Vantage dışındaki sunuculara bağlı başlangıç galaksileri.
- Geç sezon inişleri için yakalama mekanizması.
- Web oyuncuları için e-posta hatırlatması.
- Oyuncunun gemisine ad vermesi ve gezegene taşıması.
