# D208 + D209 — tek hesaplı snowball incelemesi

2026-09-13. Çalışma ağacı `0a28f55` üzerindeki D208/D209 değişiklikleri ve devralma düzeltmeleri.
Multi-account hariçtir. Üretimde yazma, deploy, wipe veya oyuncu üzerinde deneme yapılmadı.
Sunucu kanıtları yalnızca yerel, adı `_test` ile biten veritabanlarında çalıştırıldı.

## Sonuç: bu haliyle erken snowball kapatılmış değildir

**Tek oyuncu, gerçek seed 4242 konumlarında, kendi ödediği gemilerle, Akademi çıkışından
52,59 dakika sonra T1 koloni kurdu.** Merchant yok, ek kaynak yok, gezegen taşıma yok,
başka oyuncunun yardımı yok. Bu bir ortalama-bot simülasyonu değil: gerçek `joinSeason`,
build/probe/reward/attack/settlement servisleri ve `EventWorker` kullanıldı.

Kanıt: [sunucu saldırgan regresyonları](../apps/server/test/snowball-audit.test.ts).
52,59 dakika bulunan bir rota süresidir; matematiksel en hızlı süre veya her spawn için garanti
değildir. Bir tek geçerli karşı örnek bile “1–2 saatte koloni artık mümkün değil” iddiasını çürütür.

D208'in gövde kalibrasyonu tutarlı; D209'un eski stok/garnizon/başkent kapısı hatalarını
onarması doğru yönde. Fakat **filo karşılaştırmasının geçmesi, oyunun en hızlı gelişme
rotasının dengeli olduğunu kanıtlamaz.** Sezonu aynı kurallarla yeniden açmak erken fark
açılmasını engelleyecek bir çözüm olarak sunulmamalıdır.

## Doğrulanmış sorunlar

| Öncelik / tür | Bulgular | Durum / kanıt |
| --- | --- | --- |
| P1 — sezon tasarımı | Core 6, pahalı bir zaman kapısı değil; birinci oturumda solo fetih mümkün | 52,59 dk gerçek sunucu rotası; sahip kararı gerekir |
| P2 — onboarding tasarımı | Son Akademi checkpoint'i client `step` değeriyle, dersleri oynama kanıtı olmadan seçilebiliyor | Tek gerçek HTTP claim 200 + tam paket; mevcut onboarding regresyonu yeniden geçti; paket bir kez, **kural kararı açık** |
| P1 — kod hatası | Korsan PARTIAL ödemesi keseyi azaltmıyor; aynı dünyadan dönüş sonrası tekrar vurulabiliyor | İki normal launch/return, ilk hoard'dan fazla A/C ödeme; **açık** |
| P2 — PvP tasarımı | Core 6 / Yard 6, ödenmiş research ile Tier 4 üretebilir ama Core 2 hâlâ attack band'inde | Canlı production şartları + `canAttack(6,2)` yeşil; timer/solo-T4 rotası iddiası değil, **kural kararı açık** |
| P1 — eşzamanlı veri hatası | İlk asteroid claim'inde olmayan satıra `FOR UPDATE` uygulanıyor; toplam cevher kaydı eziliyor | Gerçek PostgreSQL kilidiyle 1.200 alınan / 600 yazılan cevher; **düzeltildi**, şimdi 1.200/1.200 |
| P2 — takviye | Tarafsız Aegis seviyesi yenileniyor ama kalkan yükü 0 kalıyordu | T2/T3 tam yük sunucu regresyonu; **düzeltildi** |
| P2 — kilit sırası | Takviye state→world kilitliyor, battle/acquisition world→state ilerliyordu | PostgreSQL NOWAIT ile çakışan sıra doğrulandı; world→state yapıldı, **düzeltildi** |
| P2 — model | Sim tarafsız kalkanını her savaşa sıfırdan tam kuruyor, kalan yükü saklamıyordu | Kalıcı yük + yenilenme + savaş sonrası yazma + tam takviye; **düzeltildi** |
| P2 — devir | NULL-owner temizliği tarafsız olmayan sahip değişimlerine de uygulanıyordu | Beklenen eski denetleyici NULL ile sınırlandı; **düzeltildi** |
| P2 — ölçüm / araç | Rapor 64 örnek, araç 128; kapasite aracı eski 51 dünya; tarihsel araçlarda kaldırılmış Hangar / eski ödül, kapı ve yakıt kopyaları | Canlı kurallara bağlandı, test edildi; **düzeltildi** |
| P3 — doküman | Manual capture pool'u original roster, araştırma servisinin yorumu funding-world Core diyordu | D150 kararı / pool regresyonu ve D209 capital-Core regresyonlarıyla doğrulandı; **düzeltildi**, gameplay değişmedi |
| Yanlış pozitif | Koloni Core 8 ile başkentin Core 7 ödülünü almak | HTTP daima CAPITAL seçiyor; query/body koloni ID'si sonucu değiştirmiyor; **elendi** |

### Korsan kesesini tekrar ödeme — sonlu ama gerçek hata

[Korsan çözümü](../apps/server/src/services/pirateRaid.ts) hasarı `pirate_state.losses` içine
yazar; **alınan hoard'ı yazmaz veya düşmez.** Sonraki savaş yine `computeLoot(spec.hoard, …)`
çağırır. [Kısmi unique index](../apps/server/src/db/schema.ts) ve launch kontrolü yalnızca
`outbound/returning` seferlerini engeller; `done` sonrası aynı köken dünyadan yeni sefer kabul edilir.
Bu tekrar kabulü, D150/manual'daki “origin world başına bir raid” kuralıyla da çelişir;
DB şu an yalnızca aynı anda bir raid garanti eder. Kese takibi ve tek-deneme kuralı ayrı meselelerdir.

Tek hesaplı tekrar üretim: L1, iki Dart korsanına 2 Dart + 1 Courier gönder, PARTIAL sonrası dön,
aynı yaşayan filoyla kalan Dart'a tekrar git. İlk seferdeki hoard kalıcı olarak azalmaz.
Hem iki gerçek servis seferiyle hem [sayısal araçla](../tools/snowball-audit.ts) doğrulandı.

| | A | C | D | Fiziksel toplam |
| --- | ---: | ---: | ---: | ---: |
| İlk kesenin tamamı | 720 | 393 | 14 | 1.127 |
| PARTIAL ödeme | 251 | 137 | 4 | 392 |
| Sonraki DECISIVE ödeme | 503 | 275 | 9 | 787 |
| Toplam ödeme | 754 | 412 | 13 | **1.179** |

Ortalama-roll örneğinde iki savaşta da saldırgan gemi kaybı yok. 300 uzaklıkta iki seferin
yakıtı ayrı ayrı 2 D; yakıt bedavadır iddiası yok. Aynı orijinal korsanı doğrudan silmekten
daha çok hoard alınır; yakıt ve konum nihai net kazancı etkiler.

**Sonsuz döngü değildir:** her PARTIAL mürettebatı azaltır; korsan silinir veya ömrü biter.
Ama kese aynı başlangıç miktarından yeniden ödenir. Takvim arz testleri her korsanın hoard'ını
bir kez toplar; bu çoklu ödeme davranışını sınamaz. Testlerin yeşil olması bu hatayı kapatmıyor.

Kalıcı çözüm için sahip kuralı netleşmelidir: PARTIAL ödemeye devam edilecekse, kalan hoard
küresel korsan-state kilidi altında azaltılmalıdır; ödeme arrival'da düşmeli, return/retry'de
tekrar düşmemelidir. Oyuncu/sefer silinmesi geçmişi yok etse de kalan kese korunmalıdır.
Sadece aynı dünyaya “bir deneme” kuralı koymak, kolonilerden sırayla PARTIAL atmayı çözmez.
PARTIAL'i tamamen kaldırmak veya deneme kuralını değiştirmek risk/ödül değişimidir; uygulanmadı.

### İlk asteroid yarışının sınırı

İki farklı dünyanın aynı komutana ait olması yeterli; çoklu hesap gerekmiyor. İki legal
2-Prospector squad'ı ilk kez ziyaret edilen aynı rock'a eşzamanlı gelince ikisi de boş ledger
okuyabiliyordu. İkinci upsert ilk toplamı ezer; sonradan aynı cevher tekrar mevcut görünür.

[Düzeltme](../apps/server/src/services/mining.ts): sıfır claim satırını
`ON CONFLICT DO NOTHING` ile **önce** oluştur, sonra `FOR UPDATE` ile oku ve güncelle.
Test gerçek PostgreSQL tablo kilidiyle iki transaction'ı çakıştırır; kilit/cevher sorgusu mock değil.

Mevcut worker tek süreçte tick'leri ve batch'i seri işler. Dolayısıyla bu bulgu “üretimdeki
1–2 saatlik patlamanın kanıtlanmış nedeni” değildir. Paralel worker/arrival, geçiş veya farklı
çağırıcı halinde açılan kalıcı veri hatasıdır; restart/concurrency invariant'ı için kapatıldı.

Takviyede ayrıca ters sıra bulundu: önce neutral state, sonra world kilitleniyordu; settlement/
combat önce world'ü kilitleyip sonra state'i günceller/siler. Gerçek PostgreSQL NOWAIT testi,
takviye world'de beklerken state'in kilitli kaldığını gösterdi. Takviye artık world→state ilerler;
bir acquisition beklerken ihtiyaç duyduğu state'i tutmaz. Bu da seri-worker'daki mevcut sezon
patlamasının kanıtlanmış nedeni değil, çakışan caller/arrival için doğrulanmış kilit hatasıdır.

## Ben kurnaz bir oyuncu olsam nasıl oynardım?

### 1. Akademi + ödüllerle ücretli ilk baskını kurar, sonra koloni kapısına koşardım

Doğrulanmış solo rota:

1. Akademi mezunu olarak gir: Core/Ref/Ext 2, Yard 1; 2.518 A / 1.691 C / 46 D;
   4 Dart, 1 Warden, 1 Courier, 1 Prospector; Core 3 siparişi zaten ödenmiş.
2. Bir Dart üret. En yakın beş farklı dünyaya probe gönder; ilgili ödülleri al.
   `CORE:3`, `SHIPS:5`, Akademinin açtığı `RAID:1`, `PROBE:1/3/5` kullanılabilir.
3. Bir Courier ve 12 Pike **üretim bedellerini ödeyerek** yap.
4. 5 Dart + Warden + 12 Pike + 2 Courier ile en yakın T1'i temizle; Core 4'ü paralel yükselt.
5. Dönen yaşayan filo ile aynı artık boş T1'e tekrar git; ilave kayıpsız haulla founding'i finanse et.
6. Core 5 ödülünü al, Core 6'yı bitir; iki Courier ve 1.000/500 founding ile açık claim'e yetiş.

İlk denemede tek raid, Core 6 sonrasında founding A'sına yetmedi; bu nedenle “tek raid yeter”
iddiası yapılmıyor. İkinci gerçek baskın rotayı tamamladı. Dünyalar yerinde, iki raidden önce
garnizon gerçek, gemiler ücretli, zamanlar gerçek scheduled-event sınırlarından ilerletildi.

Başkent Core kapısının bağımsız maliyeti:

| Yükseltme | A | C | Temel dakika |
| --- | ---: | ---: | ---: |
| 2→3 | 125 | 34 | 3,70 |
| 3→4 | 445 | 120 | 5,03 |
| 4→5 | 720 | 194 | 6,84 |
| 5→6 | 1.147 | 309 | 9,31 |
| Toplam | 2.437 | 657 | **24,88** |

Core 3 zaten çıkışta ödenmiştir. Yalnız Core 3/5 ve RAID 1 ödülleriyle, raid yapmadan da
Core 6 + ikinci Courier + founding bedeli 26 dakika altı finanse edilebildi; bu ayrı sunucu
testidir. Bu ikinci rota **solo garnizon temizliği** iddiası değildir.

Ödüller sonlu ve claim'ler atomiktir; tekrar talep ederek para çoğaltma doğrulanmadı.
Sorun, gelirin ve ucuz açılış rungs'larının aynı ilk oturumda birleştirilebilmesidir.
Sahibin gemi D'sini artırması bu ilk rotayı kesmez: üretilen Dart/Pike/Courier'nin üretim D'si 0;
önce Tier 1 ile T1 bankını kullanıyorum. Döteryum sefer yakıtında yine ödeniyor.
Academy exit 2.223/1.089 telafisi sahibin kilitli kararıdır; bu turda değiştirilmedi.

Kod bilen kullanıcı Akademi süresini de beklemek zorunda değil: `onboarding/claim` bounded
`step = ACADEMY_STEPS.length` kabul eder; sunucu checkpoint'i kendisi türetir ama dersleri
oynadığımı kanıtlayan bir server session/ilerleme istemez. Mevcut
`onboarding.test.ts` "seeds the Academy once…" testi tek HTTP isteğiyle tam paketi alıyor;
hedefli tekrar 1/1 geçti. Rastgele kaynak miktarı seçilemez ve retry ikinci paket vermez.
Bu yüzden Akademi ekranında geçen süre de güvenilir bir sezon zaman kapısı değildir.
Tam paket herkes için serbest bir başlangıç mı, eğitim tamamlayana mahsus mu: sahip kararıdır.

### 2. Fethedemediğim tarafsızı bile yağmalardım; boş T1'i acele kapatmazdım

[Attack servisi](../apps/server/src/services/mission.ts) neutralleri newcomer shield,
komutan Core bandı ve PvP bash hesabı dışında tutuyor. **Core 6 yalnızca kolonileşme kapısı;
yağma kapısı değil.** Bay, ücretli filo, yakıt ve aynı origin-target için aktif sefer sınırı var;
“limitsiz/bedava attack” iddiası yok.

| Tier / adet | İlk A | İlk C | İlk D | A/saat | C/saat |
| --- | ---: | ---: | ---: | ---: | ---: |
| T1 / 38 | 3.878 | 1.939 | 970 | 246,23 | 123,11 |
| T2 / 19 | 12.763 | 6.381 | 3.191 | 810,33 | 405,16 |
| T3 / 8 | 23.512 | 11.756 | 5.878 | 1.492,85 | 746,43 |

Kaynak: [seeding](../apps/server/src/services/season.ts),
[tarafsız ekonomi](../apps/server/src/services/neutral.ts), ortak canlı rate/cap kuralları.
65 dünyadaki ilk D toplamı **144.513**, toplam stok değeri `A+2C+32D` ile **5.780.311**.
Bu oyuncu başına kota değil, ilk gelenin paylaşabildiği ortak bankadır.

T1 ilk DECISIVE sonrası hiç takviye almaz. Claim kapanınca küçük bir kuvvetle tekrar yağmala;
depo A/C üretimiyle dolar. Başlangıç D'si **yenilenmez**, dolayısıyla sonsuz D kaynağı değildir.
38 T1'in bir kez temizlenmesi, diğer oyunculara da açık savunmasız çiftlikler bırakır.
T2/T3 ise 6/4 saatte ücretsiz re-arm olur; büyük temizlik aralarını ve claim beklemesini kullanırdım.
Bu takviye zamanları zaman kapısı değil, ilk temizliğin **sonrasındaki** yeniden kurulumdur.

Sahibin T1 takviyesiz ve başlangıç stock'u değişmeden bırakma kararı uygulanmış durumda;
bu kod hatası diye sessizce değiştirilmedi. Solo 52,59 dakikalık örnek bunun ekonomik kullanımını kanıtlıyor.

### 3. Claim'i başkası açarsa savaş parasını ödemeden alırdım

[Settlement launch/arrival](../apps/server/src/services/movement.ts) aktif claim,
başkent kapasitesi, kurye, ücret, bay ve ETA'yı doğrular. **Claim'i açan komutanın ben olmam
gerekmiyor.** Claim devletin kamu fırsatı; ilk yetişen settler sahip olur. Sermaye eşiği 26 dakika
altı olduğu için, daha pahalı T2/T3 temizliğini başka gerçek oyuncu yaparsa onun savaş maliyetini
ödemeden yüksek altyapıyı alabilirim. İşbirliği veya ikinci hesabım gerekli değil.

Bu bir sahiplik/auth açığı değil; mevcut “ilk yetişen alır” tasarımıdır. “Daha güçlü garnizon”
o garnizonu **bizzat temizleyen** kişiyi pahalılaştırır; her settler'ı aynı maliyete bağlamaz.

### 4. Önce yağmalar, sonra SET edilen capture stock'u alırdım

Ele geçirme stoğunun artık sabit olması eski dolu-depo devrini kapatıyor. Ancak yeni stock
remaining stock değildir: [arrival](../apps/server/src/services/movement.ts) önceki yağmayı
hesaba katmadan tier stock'unu yeniden yaratır. En iyi yasal sıra bu yüzden **raid → haul → settle**.

| Tier | Capture A/C/D | `A+2C+32D` | 1.000/500 founding sonrası kaynak farkı |
| --- | --- | ---: | ---: |
| T1 | 1.000 / 500 / 0 | 2.000 | 0 |
| T2 | 5.000 / 2.500 / 1.000 | 42.000 | +40.000 |
| T3 | 15.000 / 5.000 / 3.000 | 121.000 | **+119.000** |

Savaş, yakıt ve taşınan gemilerin maliyeti bu tabloda yok; toplam net kâr iddiası değildir.
İki settler Courier de yeni dünyaya taşınır, bedava çoğalmaz. Buna rağmen stok kendi başına
T2/T3'te büyük kazanımdır. 3.000 D, D208 referansıyla **96.000 A** değerindedir.
T1 ise capture D'si 0 olduğu için, oraya D taşınana kadar outgoing filo/transfer kaldıramaz;
kendi Courier'lerim yerleşimde yeni dünyaya taşınır. Yakıt lojistiği ve gerekiyorsa ek carrier
planlanmalıdır. T1'in pasif üretim artışı gerçek ama anında çalışan bedava bir sefer merkezi değildir.

Yeterli cargo ile tam T3'ten DECISIVE haul 16.458/8.229/4.114'tür. Sonraki capture
15.000/5.000/3.000 verir: toplam **31.458/13.229/7.114**, başlangıçtaki 23.512/11.756/5.878'den
fazladır. Owner SET kuralının doğal sonucu; hesap hatası/dupe değildir. Cargo, sefer süreleri,
claim süresi ve garrison maliyeti uygulanmaya devam eder.

Hazır Ref/Ext seviyesi de sürer. Ref 2 başkente karşı T1 toplam pasif A hızını 2×,
T2 ~4,29×, T3 ~7,06× yapar. Başkent üretimi zaten yükselmişse oran daha küçüktür.
Hazır Yard 2 T2 üretimini açar; Yard 4 tek başına T3 research şartlarını kaldırmaz.

### 5. D fazlasını merchant ile açılış yatırımına çevirirdim

[Merchant](../packages/rules/src/trade.ts) kota/komisyon taşımıyor; hold, bay, prepaid fuel
ve pencere sınırı var. Yeni takvimde 1 D = 32 A = 16 C. Neutral başlangıç D'sini veya yeni
T2/T3 capture D'sini ucuz Core/Yard/producer yatırımlarına yönlendirmek güçlü zincirdir.
Core 6→9'un invoice'u 9.048 A / 2.437 C, temel timer toplamı ~53,27 dakikadır;
para gelirse ikinci colony slot'u da bir günlük zorunlu bekleme gerektirmez.

3.000 D→96.000 A tek seferde iki Courier ile taşınamaz: `quoteTrade` dönüş hacmini de
kontrol eder. Örnek olarak 60 D→1.920 A, iki araştırmasız Courier'nin 2.000 hold'una sığar;
aynı 3.000 D için bunun 50 seferi gerekir. Büyük carrier, cargo research, konum ve etkinlik
penceresi hız sınırlarıdır; “tüm D anında nakit” iddiası yapılmıyor.

Wipe TRT 00:00 ise ilk merchant 01–03 penceresi ilk koloni rotasının hemen arkasına gelebilir.
52,59 dakikalık kanıt bu etkinliği **kullanmadan** geçmiştir; merchant ikinci aşama hızlandırıcıdır.

### 6. Dünya sayısıyla paralel üretim, mining ve Convoy payını büyütürdüm

Queues ve bay'ler dünya başına; Prospector cap'i de dünya başına iki. Bir capital + üç colony,
sekiz Prospector'a ve dört dünya-local YARD/CONSTRUCTION hattına kadar izin verir.
Research ise tek komutan queue'sudur; dörde çoğalmaz.

[Convoy ration](../apps/server/src/services/intergalacticConvoyRaid.ts) komutan başına değil,
`planetId+occurrenceId` başına bir strike. İki günlük pencere dört dünya için sekiz denemeye
çıkar. [Ödül cap'i](../packages/rules/src/intergalacticConvoy.ts) o dünyanın producer hızının
iki saati; hazır yüksek producer'lı koloni, daha yüksek cap taşır. Bu yeterli firepower/cargo
gönderilirse gerçekleşir; gemiler kayıpsız döner ama fuel/bay/time ücretleri sürer.

Ship reward `maxTier`, yalnız savaş gemisinin değil **gönderilen her mobile hull'un** tier'ını
okur. Argosy + düşük-tier savaşçılar tier-4 pool'una erişebilir. Argosy normal üretim şartları
durur; yalnız bu route'la tier 1'den sebepsizce tier 4'e atlanmaz. Korsandan kazanılmış üst-tier
hull da “kullanım için üretim research şartı” olmadan uçabildiğinden bu pool tavanını yükseltir.
Bu kalıcı büyüme avantajıdır, garanti drop/sonsuz income değildir. D201 prize kuralı değiştirilmedi.

Newcomer shield'ını PvE sırasında koruyabilirim; tarafsız raid ve settling onu düşürmüyor.
T3 colony'nin Core 8'i research/colony kapısını açmaz ama **PvP peak-Core bandında** sayılır;
Core 1–3 komutanlar artık iki band uzakta kalabilir. Bu savunmalı büyüme bileşimidir, auth hatası değil.

### 7. Gerçek klan arkadaşlarının yardımını koloni ekonomimle büyütürdüm

Multi-account kullanmadan başka gerçek oyunculardan destek almak da ikinci aşama legal
hızlandırıcıdır. `clanEconomyEnvelope` tüm kontrollü dünyaları toplar; yeni colony'nin hazır
producer'ı, [aid allowance](../packages/rules/src/clan.ts) sınırını da yükseltir. Alıcıya rolling
24 saatte en fazla dört saatlik A/C üretimi ve toplam D kapasitesinin %20'si taahhüt edilir;
bu gönderen başına ayrı kota değildir, çok arkadaş kota sınırını çoğaltmaz.
Üyelik adaptasyonu 12 saattir, bu yüzden fresh-season ilk 52,59 dakika rotasına yardım
katılmadı. Gemi hediyelerinde alıcının üretim erişimi de doğrulanır; research atlatma iddiası yok.
Klan raid kesesi %10 yağmayı paylaştırır, yeni kaynak yaratmaz. Yüksek koloni ekonomisi mevcut
kotaları büyütür; bu growth loop'tur, doğrulanmış auth/dupe açığı değildir.

### 8. Core'u 6'da tutup gemi gücünü büyüterek zayıf PvP hedeflerini kaybetmezdim

`build.ts` diğer binaları Core seviyesinde sınırlar; Core 6'da **Yard 6 mümkündür**, Yard 7
değildir. Cataclysm, Yard 6 + `STARSHIP_ENGINEERING:2`, `SHIP_POWER:4`, `SHIP_ARMOR:2` ister.
Bu projelerde ayrıca yüksek-Core veya sezon-zaman kapısı yok (`availableAtMinutes = 0`);
prerequisite'ları yine ödenip araştırılmalıdır. Üretim kontrolü Yard + research okur, PvP kontrolü
ise yalnız tüm kontrollü dünyaların **güncel en yüksek Core**'unu okur.

[Canlı kural kanıtı](../tools/snowball-audit.ts) ve araç regresyonu:
`hullRequirementsMet(CATACLYSM, tech)` / Yard 6 üretim erişimi geçer;
`canAttack(Core 6, Core 2, 0)` geçer, Core 7'ye çıkınca aynı hedef `TIER_BAND_WEAK` ile reddedilir.
Bu yüzden Tier 4'e yatırım yapmak ile daha yüksek Core'a çıkmak farklı fırsat maliyetleri taşır:
T1/T2 colony + Core 6 ile düşük Core'lu rakiplere erişimi korur, benim filomu onların seviyesinde
tutan bir kural olmadan büyürdüm. T3 colony'nin Core 8'i bu özel rotayı kapatır.

Bu kanıt research/gemi parasını ücretsiz vermiyor ve **birinci saatte solo Tier 4** veya süre
garantisi değildir. Newcomer shield, fuel/bay, bash ve clan sınırları sürer. Oyuncuların ilk gün
PvP kalkanını kaybetmesi veya kalkanın bitmesi gerekir. Core'un gerçek savaş gücü için vekil
ölçü olarak seçildiği D168 tasarımının kör noktasıdır; kilitli PvP kuralı değiştirilmedi.

## Elenen veya yanlış sunulmaması gereken iddialar

- Koloni seviye ödülü: mevcut CAPITAL-only HTTP rotası nedeniyle elendi; handoff düzeltildi.
- Daha ucuz 8 Warden + tek raid açılışı: gerçek garnizonu silemedi, settlement `NO_ACTIVE_CLAIM`
  ile reddedildi. Yeni bir 45-dakika-altı solo rota olarak sunulmadı; negatif sunucu testi var.
- Fethettim, commander'a research geldi: D209 commander-owned state ve capital gate regresyonları geçiyor.
- Fethettim, NPC filosunu aldım: NULL-owner garrison temizleniyor; gelenler kendi settler Courier'lerim.
- Cargo taşmasını merchant izin veriyor: give ve want hacimlerinin maksimumu transaction'da kontrol ediliyor.
- Sürekli reward claim / duplicate arrival para basıyor: ledger anahtarları ve status geçişleri idempotent;
  normal tekrarı sınayan testler geçiyor. Bu bütün olası yarışların yokluğu garantisi değildir.
- Korsan payout veya neutral bank sonsuz D: ikisi de sonlu; T1'in sürekli kaynağı yalnız A/C üretimidir.
- Research olmadan T3 üretimi: captured Yard yeterli değildir; üst research şartları komutanımda bulunmalıdır.
- Gemilere üretim D'si ×2 uygulamak: bu deneme hiyerarşik verimlilik nedeniyle geri alındı;
  ölçülen canlı D208 baseline 2/6/20, uygulanmış bir sahip ×2 çarpanı değildir.

## Kalibrasyon ve teslim sınırı

[D208 raporu](fleet-calibration-d208.md): 64 örnek, 657.088 izole savaş; counter/progression/
small-wallet yön hatası 0. Bu **fleet kalibrasyonu** için iyi kanıt. 12 event-free sezonda
92.056 attack var. ARR her kohortta floor altında; 30 günlük SV düşük; bantlar genişletilmedi.

Ortalama sim oyuncusunun ilk colony'si 300 kişilik koşularda gün 4,52/4,53. Sim merchant,
shower ve Convoy'u dışlar; ayrıca bu gerçek servislerdeki Akademi/ödül/solo saldırgan rotayı
oynamaz. Gerçek 52,59 dakika sonucu varken “ilk koloni sim'de dört gün” güvenlik kabulü olamaz.
Owner'ın event-free ekonomi ölçüm kararı korundu; ayrı saldırgan sunucu testi bu kör noktayı örter.

Son taze, seri tam doğrulama **exit 0**: typecheck ve lint geçti; rules 1.155, server 1.573,
web 2.807, sim 112 — **5.647 test geçti, 13 test atlandı**. Ek kök araç paketi 22 dosyada
154/154; saldırgan + D209 + mining hedefli gerçek sunucu koşusu 55/55 geçti. Bu testler
mevcut erken-fetih ve korsan tekrar-ödeme davranışını da kanıtlar; yeşil sonuç bu açıkların
kapatıldığı anlamına gelmez. Kabul bantları genişletilmedi; `git diff --check` temiz.

Tekrar üretim komutları (tam koşuda ayrı yerel `_test` DB kullanıldı; DB kimlik bilgileri
yerel ayardan verilmelidir, production URL'si kullanılmamalıdır):

```sh
npm_config_workspace_concurrency=1 pnpm verify
pnpm exec vitest run tools
pnpm --filter @astera/server exec vitest run test/snowball-audit.test.ts test/neutral-colony-d209.test.ts test/mining.test.ts
pnpm exec tsx tools/snowball-audit.ts
node tools/visual.mjs /tmp/blindspace-visual-review
```

Görsel koşu 350×812: kontroller geçti, runtime error yok. Ek component-fixture tarayıcı koşusunda
TR/EN T3 yerleşim bedeli/açılış stoğu ve sabit kontroller taşmadı; ekran görüntüleri incelendi.
TR/EN baskın öncesi Core 6 / şu an 4 bilgi kutusu da 350px'te okunuyor ve viewport içinde kalıyor.
Bu ek koşu gerçek settlement başlatmadı; servis doğrulaması ayrı sunucu testindedir.
Araç ve sunucu kanıtları tekrarlanabilir;
ham ölçüm geçici JSON/log olarak saklandı, megabaytlık kalibrasyon çıktısı repoya eklenmedi.

## Sezon açılmadan sahibi gerektiren kararlar

Sahibin inceleme sonrası yönü (2026-09-13): ilk koloninin en erken yaklaşık **6 saatte**
alınmasını hedefliyor; ayrı süre kilidi yerine alınmasının maliyet/zorlukla güçlendirilmesini
istiyor. Değiştirilecek sayıları ayrıca verecek; bu checkpoint'te yeni kalibrasyon uygulanmadı.
52,59 dakika mevcut karşılaştırma baseline'ı olarak korunuyor.

1. 6 saat hedefinin maliyet/garnizon/ekonomi adaylarını gerçek servis rotalarıyla sınamak.
   Core 6 yerine rastgele threshold veya ek süre kilidi seçilmedi; kesin ekonomik alt sınır,
   claim'i başkasından alma ve etkinlik gelirleri dahil karşı örneklerle doğrulanmalıdır.
2. Korsan kalan kesesinin kalıcı ve atomik takip kuralı; PARTIAL/tek-deneme tercihi açıkça kararlaştırılmalı.
3. T1 kalıcı boş raid çiftliği ve ilk neutral bank'ın korunup korunmayacağı.
4. T2/T3 capture D'sinin **yeni 32 valuation ile** büyüklüğü; free producer/Yard ve dünya başına
   Convoy ration'unun amaçlanan colony ödülü mü, fazla compound gain mi olduğu.
5. Core 6'da üst-tier filo ile düşük-Core PvP hedeflerini tutmanın amaçlanan strateji olup olmadığı.

Bu beş başlık gameplay/risk-reward değiştirir; kilitli kararlar kullanıcı adına yeniden yazılmadı.
Yeni hull table ve yeni merchant calendar aynı reset sınırında uygulanmalı. Persist edilmiş eski
merchant rate yeni fiyatlara otomatik dönmez; wipe/restamp sonrası gerçek occurrence rate'i doğrulanmalı.
Deploy/reset bu incelemede yapılmadı. “Kritik bug kalmadı / production snowball tamamen kapandı”
şeklinde teslim edilemez: korsan bug'ı ve kanıtlanmış erken-growth rotası açıkça kalıyor.
