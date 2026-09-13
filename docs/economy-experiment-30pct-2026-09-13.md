# %30 ekonomi + daha güçlü tarafsızlar — 2026-09-13

Baz `147deca`. Sahibin %25 denemesini %30 ile değiştirme ve tarafsız filolarını
artırma talebi. Önceki artışın üstüne eklenmedi: çarpanlar **1,30 / 0,70 / 1,30**.
Bu production deploy'u veya sezon güvenliği kabulü değildir.

Tarihsel ölçüm: bu rapor **T1 AEGIS 0 / Viper 0 / Stronghold 0** adayına aittir.
Sahibin sonraki T1 AEGIS 1 + Viper 1 + Stronghold 1 talebi ayrı
[kalkanlı tekrar raporunda](economy-experiment-t1-aegis-2026-09-13.md) ölçülür.
Aşağıdaki 201,39 dakika güncel kalkanlı T1'in süresi değildir.
Koloni kapısı da bu ölçümden sonra `9 / 12 / 15` olarak değişti. Dolayısıyla bu
rapordaki Core 6 ile biten koloni süreleri güncel kuralla geçerli sonuç değildir.

## Aday kurallar

- Uçan gemilerin alloy/crystal faturaları checkpoint'e göre +%30, yukarı yuvarlanır;
  probe dahil. Üretim D'si, hull donanımı, hız/cargo ve uçuş süreleri değişmez.
  Dart/Pike 390/78; Courier 780/195; Talon 975/234/2; probe 65/39.
- Üç gerçek üretici her level'da −%30; tasarım referansı sabit, bina/araştırma/
  enstrüman faturaları otomatik ucuzlamaz. Saat bazlı depo/WORKS kaynak miktarları
  aynı oranla azalır. Gemi değerinden türeyen sefer yakıtı olağan kuraldan ödenir.
- Tüm bina/gemi/yer savunması/araştırma/uydu/stratejik imalat süreleri +%30;
  eski 480 dakika tavan 624 dakika. Uplink 6,5, Death Star 78, Anti-Strategic 39 dk.
  Yer savunması/stratejik silah kaynak fiyatları ve savaş/takviye/toparlanma saatleri değişmez.
- Sezon ödül kesesi zaten yarımdır: **22.743 A / 11.149 C / 0 D**, yeniden yarılanmadı.
  Akademi telafisi 2.223/1.089 sabit; pahalı alışveriş sonrası çıkış **2.518/1.484/46**.
  Yeni kaynak veya gemi telafisi verilmez; temel `PLANET_START` 1.500/400/50 sabit.

| Tarafsız | Filo | Yer savunması | AEGIS |
| --- | --- | --- | --- |
| T1 | 12 Dart, 6 Pike | 1 Thorn | 0 |
| T2 | 20 Dart, 20 Pike, 8 Viper, 8 Stronghold | 2 Thorn, 2 Bastion | 2 |
| T3 | 15 Viper, 15 Stronghold, 5 Tempest/Ballista/Sentinel/Leviathan/Praetorian | 5 Thorn, 3 Bastion | 4 |

Ölçüm anında binalar, capture stock, o zamanki başkent Core 6/9/12 kapısı ve T1 yok /
T2 6s / T3 4s takviye düzeni değişmemişti. Kapı daha sonra 9/12/15 oldu. Seeding/reset
ve tam ücretsiz takviye gerçek DB'de kontrol edilir.

## Ölçümün doğruluk sınırı

Eski 52,59 dakika rotasını körlemesine tekrarlamak güncel hızlı oyuncuyu modellemez:
Refineri 2'de sabit 12 Pike için bekler, üretim yatırımı ve Akademi Prospector'unu
kullanmaz. Birebir eski sipariş 4,82 dakikada 3.741 A bankaya karşı 4.680 A fatura
nedeniyle reddedilir. Ücretli parçalı 12 Pike uyarlamasında iki gerçek baskın PARTIAL
kalır; savunmada 1 Pike kaldığı için `NO_ACTIVE_CLAIM` döner. Bu bir kolonileşme süresi değildir.

Uyarlanan oyuncu yalnızca normal servisleri kullanır:

1. Aynı seed 4242/300 kapasite haritasına gerçek Akademi çıkışıyla katılır. Başka
   hesap/yardım, ek grant/hull, merchant veya gezegen taşıma yoktur.
2. Ödenmiş beş probe ile başlangıç fırsatlarını açar; sadece `rewardsView`'ın
   gerçekten claimable bulduğu yarım ödülleri normal `claimReward` ile alır.
3. Core/Refineri/Extractor yatırımlarını yapar; Core 6'yı baskından önce hazırlar.
   Örneğin Refineri 3 maliyeti 154 A, ödülü 494 A; Extractor 3 maliyeti 77 A,
   ödülü 494 A. **Yarım ödüller bile bu iki yükseltmede anlık kaynak fazlası verir.**
4. Madencilik seçeneğinde ikinci Prospector'u öder, sadece sensör geçmişinin açtığı
   aktif normal asteroidleri, API'nin opak id'siyle normal `launchMining` üzerinden
   hedefler. Ham schedule/key, gizli isotope veya numeric-index bypass kullanmaz.
   Ore normal dönüşte WORKS'e gelir; kapasite, dinlenme ve flight bay kısıtları korunur.
5. Canlı fiyatlar/donanımla, açılmış tersanenin üretebildiği gövdelerden iki türlük
   bounded arama yapar; en kötü saldırgan/defender roll'unda DECISIVE kalan ve iki
   Courier'yi koruyan, gerçek tankın üretim D'si + uçuş yakıtına yettiği orduyu seçer.
   Ödenecek alloy'dan sadece gerçekten açılacak Dart ödülleri düşülerek plan sıralanır.
6. Her siparişi öder; Core/yard/mining gerçek scheduled-event anlarında ilerler.
   Baskın haulu actual settlement bedelini finanse eder; phantom loot yazılmaz.
   Founding için önceden gereksiz bir 1.000/500 yedek zorlanmaz. Normal settlement
   servisi ve worker sonunda kontrolün gerçekten oyuncuya geçtiği doğrulanır.

Aktif oyuncu madencilik fırsatlarını en fazla bir dakika arayla kontrol eder; bu
sunucu üretim tick'i veya yeni oyun kuralı değildir. 24 saat measurement horizon'u
bir sezon/time gate değildir. Test secret alanı için sabit UUID
`00000000-0000-4000-8000-000000004242` kullanılır; ilk karşılaştırmada her stratejinin alanı aynıdır,
oyuncunun kararına bu UUID/ham schedule verilmez. Battle RNG normal mission UUID'sidir.

Bu arama global optimum veya her spawn garantisi değildir; daha hızlı legal/abuse
rotalar ayrıca araştırılmalıdır. NPC ya da başka oyuncunun saldırısı/rekabeti bu
tek oyunculu ilk fetih kanıtına eklenmedi.

## Sonuç ve teslim

İlk taze tam hedefli koşunun altı yasal strateji sonucu (aynı asteroid alanı):

| Üretici yatırımı | Madencilik | Tersane | Koloni, dakika | Yaklaşık süre |
| --- | --- | --- | ---: | --- |
| Refineri/Extractor 3 | yok | 1 | 1.079,83 | 18 saat |
| Refineri/Extractor 5 | yok | 1 | 651,63 | 10 saat 52 dk |
| Refineri/Extractor 3 | 2 Prospector | 1 | 274,30 | 4 saat 34 dk |
| Refineri/Extractor 5 | 2 Prospector | 1 | 247,14 | 4 saat 7 dk |
| Refineri/Extractor 3 | 2 Prospector | 2 | 206,16 | 3 saat 26 dk |
| Refineri/Extractor 5 | 2 Prospector | 2 | 206,06 | 3 saat 26 dk |

Tersane 1 planı 21 ücretli Pike; Tersane 2 planı 4 ücretli Pike + 5 ücretli Talon'dur.
İkisinde de paid opening Dart dahil 5 Dart + 1 Warden + 2 Courier kullanılır.
Yeni 12 Dart/6 Pike/1 Thorn savunması tek gerçek DECISIVE baskında temizlenir.
Örnek Tersane 2 kaybı 2 Dart/1 Pike/1 Talon; iki Courier kalır. İlk haul örneği
**1.477 A / 738 C / 369 D**; founding 1.000/500'e yeter, stoktan fazladan kaynak yazılmaz.

Önceki 305,63/298,93/238,16 dakika ölçümleri gereksiz ön-founding yedeği olan
konservatif oyuncuya aittir, en hızlı rota diye sunulmaz. Yedek kaldırılınca daha
hızlı rota bulundu; oyun kuralı veya kaynak değişmedi.

Güven kontrolü: sipariş faturaları ve tam +%30 süreleri DB makbuzlarından yeniden
doğrulanır; açılış bankası/WORKS, yeni claim makbuzları, seviyelere göre üretim
integrali, gerçekten dönmüş madencilik ve raid loot'u karşısında tüm faturalar,
probe bedelleri, founding, yakıt ve son bank/WORKS toplamı karşılaştırılır.
Gelir kapasitede boşa gidebilir ama kaynak yaratılması kabul edilmez. En hızlı
oyuncu ayrıca farklı iki asteroid UUID alanında tekrar ölçüldü:

| Asteroid alanı UUID sonu | Ref/Ext | Tersane | Doğrulanmış koloni |
| --- | --- | --- | --- |
| 4242 | 5 | 2 | 206,06 dk — 3 saat 26 dk |
| 4243 | 5 | 2 | **201,39 dk — 3 saat 21 dk 23 sn** |
| 4244 | 5 | 2 | 215,26 dk — 3 saat 35 dk |

Üç alanın hepsinde garrison, fiyat/süre, sahiplik ve A/C/D kaynak denetimi geçti.
Alan 4242 / Ref/Ext 3 / Yard 2 tekrarının 206,16 dakikalık kaynak denetimi de geçti.
**En hızlı BULUNAN ve doğrulanan solo rota 201,39 dakikadır; global minimum değildir.**
**Doğal 6 saat hedefi bu adayda sağlanmamıştır.**

En hızlı rotanın alloy makbuz toplamı:

| Gelir | A | Harcama / kalan | A |
| --- | ---: | --- | ---: |
| Açılış bankası + WORKS | 2.602 | Ödenmiş siparişler | 13.969 |
| Level/süre integrali üretim | 1.700,39234 | Ödenmiş beş probe | 325 |
| Gerçek yeni yarım ödül claim'leri | 6.426 | Ödenmiş founding | 1.000 |
| Gerçek dönmüş madencilik | 3.795 | Son bank + WORKS | 706,39276 |
| Gerçek dönmüş baskın | 1.477 | | |
| Toplam | 16.000,39234 | Toplam | 16.000,39276 |

0,00042 A fark lazy-economy yuvarlamasıdır; denetim toleransı 0,01 kaynak birimi.
D denkliği tam: 46 açılış + 369 gerçek loot = 10 imalat + 20 sefer yakıtı + 385 kalan.
Kristal hesabı da geçti. Kaynak tablosu planlanan gelir değil, actual DB makbuzlarıdır.

Bir rotanın başarısız olması 6 saatten önce hiçbir rotanın mümkün olmadığı anlamına gelmez.

Kanıt: [gerçek sunucu rotaları](../apps/server/test/snowball-audit.test.ts),
[ekonomi kontrolleri](../packages/rules/test/economy-adjustment.test.ts),
[garnizon/takviye kontrolleri](../apps/server/test/neutral-colony-d209.test.ts).
Hedefli doğrulama tam `pnpm verify` veya yeni D208 filo/season kalibrasyonu yerine geçmez.
Doğrulama kayıtları: ekonomi/ödül/garnizon rules paketi 61/61; ilk taze sunucu
rotaları + caretaker/transfer paketi 42/42; son fiyat/süre/kaynak/sahiplik denetimli
Tier 2 rota tekrarları 4/4 (diğer 12 test `-t` filtresiyle seçilmedi); rules/server
typecheck exit 0, `git diff --check` temiz. Son aday için tam `pnpm verify` çalıştırılmadı.
Korsan tekrar-kese bug'ı ve fiyat artışından etkilenen sabit admission-liability sınırı
bu deneyde değiştirilmedi. Push, deploy, reset veya yeni commit yapılmadı.
