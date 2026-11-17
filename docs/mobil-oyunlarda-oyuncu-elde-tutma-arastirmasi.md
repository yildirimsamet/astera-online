# Mobil Oyunlarda Elde Tutma Mekanikleri: Whiteout Survival, Clash Royale, Survivor.io

Nov 11, 2026 · @Samet

## Özet

Üç oyun da aynı beş katmanlı iskeleti kullanıyor: günlük görev puanıyla açılan sandıklar, ücretsiz ve ücretli iki şeritli sezon pass'i, günlük damla ödül veren abonelik kartı, haftalık dönen puan eşikli etkinlikler ve bunların üstünde şans tabanlı bir harcama katmanı. Fark sadece türe göre ayar: Whiteout Survival sosyal baskı ve takvim yoğunluğuna, Clash Royale maç sayısına (taç), Survivor.io ise enerji ve AFK ödülüne yaslanıyor.

- **Günlük kanca:** Her gün sıfırlanan görev listesi, puan biriktikçe açılan kademeli sandıklar. Kaçırılan gün geri gelmiyor.
- **Sezon kancası:** 4 haftalık pass. Herkes ücretsiz şeridi doldurur, ücretli şerit aynı ilerlemeyle ek ödül açar. Ücretli şeridi almak her zaman "zaten kazandığın şeyin kilidini açmak" gibi hissettirir.
- **Abonelik kancası:** Aylık kart ödülünü 30 güne bölüyor. Değer ancak her gün girersen tam alınıyor, yani para direkt giriş alışkanlığına dönüşüyor.
- **Etkinlik kancası:** Her hafta yeni bir tema, aynı mekanik: puan eşikleri (milestone), üstüne sıralama ödülü.
- **Harcama kancası:** Çark, şans sandığı, büyüme fonu, kumbara. Ücretsiz oyuncuya günde 1 hak verilip daha fazlası elmasla satılıyor.

Aşağıda her oyunun bu iskeleti nasıl doldurduğu, ardından ortak kalıplar ve kendi oyununa uygulanabilir bir şablon var.

## Whiteout Survival

Whiteout Survival'ın elde tutma motoru, oyuncuyu her gün aynı rutine ve her hafta ittifakının takvimine bağlamak. Bireysel ilerleme yavaş, ama ittifak ve sunucu etkinlikleri sosyal sorumluluk yaratıyor: girmezsen takımın puan kaybediyor.

### Günlük döngü

- **Günlük Görevler ve Aktiflik puanı:** 00:00 UTC'de sıfırlanıyor. Giriş (10), bina yükseltme (20), araştırma (20), asker eğitme, toplama, arena, ittifak yardımı ve bağışı, Intel görevleri, Polar Terror kesme gibi işler 5 ile 30 arası puan veriyor. Puan biriktikçe 7 sandık açılıyor; yaygın sürümde son sandık 325 puan istiyor. İlk sandık elmas, son sandıklar Mythic kitap, Gold Key ve Fire Crystal gibi nadir malzeme veriyor. ([kaynak](https://heaven-guardian.com/whiteout-survival-daily-missions-guide/))
- **Lighthouse Intel:** Gün içinde partiler halinde yenilenen küçük PvE görevleri. Günde 24 Intel görevi var; oyuncuyu günde birkaç kez geri çağıran ana kanca bu. ([kaynak](https://buffget.com/news/whiteout-survival-max-alliance-coins-with-f2p-daily-loop))
- **Alliance Activity Triumph:** Kişisel günlük aktivite (Intel başına 50 puan, son iki görev sandığı 100 ve 500 puan) ittifakın ortak puanına ekleniyor ve ittifak mağazası jetonu üretiyor. Yani senin günlük rutinin ittifakın gelirini doğrudan etkiliyor. ([kaynak](https://outof.games/realms/whiteoutsurvival/guides/476-alliance-activity-triumph-in-whiteout-survival/))
- **VIP günlük XP:** Girişle günde 500 VIP XP'ye kadar toplanabiliyor; VIP aktifken günlük ücretsiz sandık da var. ([kaynak](https://tcsn.tcteamcorp.com/blogs/17245/Whiteout-Survival-VIP-System-Unlock-Perks-Rewards))
- **Pasif kuyruklar:** İnşaat, araştırma, eğitim ve toplama kuyrukları boş kalmamalı. Boş kuyruk "kayıp" gibi hissettiriyor, bu da çıkıştan önce son bir kez girme sebebi.

### Etkinlik takvimi

Takvim çakışan döngülerden oluşuyor; hemen her gün en az bir etkinlik açık. ([kaynak](https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-recurring-events-guide-en.html))

| Etkinlik | Sıklık | Süre | Kim | Ödül yapısı |
| --- | --- | --- | --- | --- |
| Bear Hunt | Yaklaşık 48 saatte bir | 30 dk | İttifak | Toplam hasara göre |
| Alliance Championship | Haftalık | 1 hafta, 5 tur | İttifak | Tur galibiyeti ve lig kademesi |
| Fortress Battles | Her Cuma | Belirtilmemiş | İttifak | Kale kontrolü |
| Frostfire Mine | 2 haftada bir | 30 dk | Solo | Kazılan miktar ve sıralama |
| Foundry Battle | 2 haftada bir (Frostfire ile dönüşümlü) | 60 dk | İttifak | Kazanan jeton alır |
| State of Power (SvS) | Aylık | 10 gün | Sunucuya karşı sunucu | Hazırlık puanı, savaş, Supreme President unvanı |
| King of Icefield | 4 haftada bir | 7 gün | 6 sunucu arası | Günlük madalya eşikleri ve sıralama |
| Alliance Showdown | Aylık | 6,5 gün | İttifak | Günde 5 sandık eşiği, kazanan ve kaybedene ödül |
| Lucky Wheel | 2 haftada bir | 3 gün | Solo | Günde 1 bedava çevirme, sonrası elmasla |

- **Puanlama mantığı:** Etkinliklerin çoğu "günlük tema" ile çalışıyor (bir gün inşaat, bir gün asker eğitimi). Oyuncu hızlandırıcı ve kaynaklarını doğru güne saklamayı öğreniyor; bu da sonraki etkinliği bekleme sebebi.
- **Kaybedene de ödül:** Alliance Showdown gibi etkinliklerde kaybeden ittifak da günlük ödül alıyor. Amaç kaybedenin oyunu bırakmaması.
- **Lucky Wheel:** O döneme özel Mythic kahraman çarkın içinde. Günde 1 bedava jeton ile ücretsiz oyuncu çarka alıştırılıyor, kahramanı tamamlamak elmas gerektiriyor. ([kaynak](https://mobi.gg/en/tips/lucky-wheel-whiteout-survival/))
- **Sezonluk etkinlikler:** Bayram ve tatil temalı etkinlikler (örneğin Ramazan için Lantern of Blessings, Yılbaşı için Gilded Jade) kendi günlük görevi, kendi para birimi, bingo tahtası ve 21 kademeli kendi battle pass'i ile geliyor. ([kaynak](https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-gilded-jade-guide-en.html))

### Ücretli katmanlar

- **Aylık Kart:** Anında 300 elmas, 30 gün boyunca günde 200 elmas, toplam 6.300 elmas. Doğrudan elmas almaktan çok daha iyi oran, ama sadece her gün girersen. ([kaynak](https://heaven-guardian.com/which-whiteout-survival-pack-type-gives-the-best-long-term-value/))
- **Weekly Benefits Card:** Haftalık sürümü, görev puanı ve seçmeli sandıkla.
- **Growth Fund (Dawn Fund):** Bir kez ödeniyor, Furnace seviyesi yükseldikçe premium para açılıyor. Oyuncuyu ilerlemeye kilitliyor: bırakırsan ödediğin para kilitli kalıyor. ([kaynak](https://buffget.com/news/whiteout-survival-frost-stars-top-up-31percent-off-and-best-packs))
- **VIP seviyesi:** Kalıcı bonuslar, günlük sandık, üst seviyede günlük Mythic kahraman parçası. Bazı bonuslar sadece VIP aktifken çalışıyor, yani VIP süresi de ayrıca tüketilen bir kaynak.
- **Kalıcı kilit açma:** Ek inşaat kuyruğu, ek yürüyüş kuyruğu.
- **Etkinliğe bağlı paketler:** Etkinlik para birimi ve kahraman parçası içeren, sadece etkinlik süresince görünen paketler. Her büyük etkinlik kendi mağaza vitrinini açıyor.

## Clash Royale

Clash Royale her şeyi tek bir para birimine bağlıyor: maçta kazanılan **taç (Crown)**. Aynı taç aynı anda pass'i, haftalık etkinliği ve mini pass'i ilerletiyor; yani her maç birden fazla çubuğu doldurduğu için "bir maç daha" hissi hep canlı.

### Günlük döngü

- **Günlük ödül:** Ekim 2025 güncellemesiyle herkesin günlük ödülü aynı hale geldi: 4 Magic Lucky Chest. ([kaynak](https://supercell.com/en/games/clashroyale/blog/release-notes/october-update-2025))
- **Lucky Chest mekaniği:** Klasik bekleme süreli sandıkların yerine çevirmeli sandıklar geldi. Common Lucky Chest 3, Magic ve sezonluk sandıklar 4 çevirme hakkıyla açılıyor; her çevirme ödülü bir kademe yükseltme şansı. Sezonluk sandıklarda garanti sistemi var: sezon boyunca ne kadar çok açarsan o kadar çok garanti ödül. (aynı kaynak)
- **Albüm parçaları:** Albüm etkinliğinde parçalar (Snippet) günün ilk üç galibiyetinden geliyor. ([kaynak](https://www.sportsdunia.com/gaming/clash-royale-album-event-guide)) Bu, günlük oyunu kısa tutup her gün gelmeyi ödüllendiren klasik "ilk X galibiyet" kalıbı.
- **Telafi ödülü:** 2026'da test edilen bir özellikle, günlük savaş ödüllerini kaçıran oyuncu sonraki galibiyetinde küçük bir bonus alıyor; kaçırılanın yerini tutmuyor ama geri dönüşü ödüllendiriyor. ([kaynak](https://trophycoach.com/guides/pass-royale-q2-2026-rewards-guide))
- **Klan Savaşları:** Klan için günlük 4 savaş; aynı zamanda taç kazandırdığı için etkinliklere de sayılıyor. ([kaynak](https://www.sportsdunia.com/gaming/clash-royale-album-boost-event-guide-may-2026))

### Pass Royale (sezon pass'i)

- **Yapı:** 90 kademe, taç kazandıkça ilerliyor, sezon yaklaşık 4 ila 5 hafta. İki şerit var: herkese açık Free Pass ve ücretli Diamond Pass. Eski Gold Pass Eylül 2024'te kaldırıldı. ([kaynak](https://timesaver.gg/blog/is-pass-royale-worth-it-october-2026-shocktober))
- **Fiyat:** Supercell'in son yayınladığı ABD liste fiyatı 11,99 dolar; bölgeye göre değişiyor. (aynı kaynak)
- **Ücretsiz vs ücretli farkı:** Kasım 2026 sezonu önizlemesinde ücretsiz şerit 220.000 altın ve 100 elmas, Diamond şerit 520.000 altın ve 325 elmas veriyor. Common Wild Card farkı 750'ye karşı 13.000; kule skini ve emote sadece ücretli şeritte. (aynı kaynak)
- **Ücretli ayrıcalıklar:** Challenge'larda bedava tekrar hakkı, altın renkli isim ve klan arkadaşlarının toplayabildiği bir Clan Gift. ([kaynak](https://support.clashroyale.com/hc/en-us/articles/49484915388443-Pass-Royale)) Clan Gift satın alımı sosyal olarak görünür kılıyor.
- **Yeni kartı ücretli şeride koymak:** Sezonun yeni kahramanı genelde Diamond Pass'te; aynı sezonun yeni Evolution'ı ise ücretsiz albüm etkinliğinde. Ücretsiz oyuncu da yeni içeriğe ulaşıyor ama ücretli oyuncu ilk haftadan sahip oluyor. ([kaynak](https://timesaver.gg/blog/is-pass-royale-worth-it-october-2026-shocktober))
- **Lucky Loop:** Son kademeden sonra sezondaki gün sayısı kadar ek kademe açılıyor, her biri bir Magic Lucky Chest. Bitirdikten sonra günde sadece bir tane alınabiliyor; yani pass'i bitiren oyuncu bile her gün girmeye devam ediyor. ([kaynak](https://support.clashroyale.com/hc/en-us/articles/49484915388443-Pass-Royale))
- **Seri (streak) bonusu:** Pass'i art arda iki sezon almak kademe atlatma ve elmas veriyor; bir sezon atlarsan seri sıfırlanıyor. Aboneliğin olmadığı yerde abonelik etkisi yaratan bir mekanik. (aynı kaynak)
- **Elmasla kademe atlama:** Kalan taç sayısına göre fiyatlanıyor; sezon sonunda eksik kalan kademeler için tasarlanmış. (aynı kaynak)
- **Mini Pass:** 5 ila 7 günlük daha ucuz, küçük bir pass; aynı taçlarla ana pass ile paralel ilerliyor. Büyük pass'i almayan oyuncuya düşük eşikli bir ilk satın alma kapısı. (aynı kaynak)

### Etkinlik takvimi

- **Sezonluk Albüm etkinliği:** 10. yıl dönümüyle (Mart 2026) geldi ve kalıcı format oldu. 9 sahne, her sahne 9 parça, toplam 81 parça. Sahne tamamladıkça milestone ödülü, albüm bitince ana ödül (o sezonun yeni Evolution'ı veya kahramanı). Albüm bitince toplanan fazla parçalar rastgele bonus ödüle dönüşüyor. ([kaynak](https://trophycoach.com/guides/album-event-guide-march-2026), [kaynak](https://support.clashroyale.com/hc/en-us/articles/49484957630619))
- **Haftalık taç etkinlikleri:** Her Pazartesi başlayıp bir hafta süren temalı etkinlik. Tipik yapı: 200 taçlık 15 kademe, içinde Lucky Chest, Gold Crate ve albüm parçası; son kademede "benzersiz" albüm parçası. ([kaynak](https://www.sportsdunia.com/gaming/clash-royale-rhinos-and-riches-event-guide)) Yani haftalık etkinlik, sezonluk albümü besleyen bir alt döngü.
- **Album Boost:** Sezonun son haftası albümü tamamlatmak için ekstra parça veren bir etkinlik. ([kaynak](https://www.sportsdunia.com/gaming/clash-royale-album-boost-event-guide-may-2026)) Son haftada bırakmak üzere olan oyuncuyu yakalamak için.
- **Open Chest Event:** Sezonluk Lucky Chest'ten belli sayıda açınca (örneğin 15) Evolution Box ödülü. ([kaynak](https://www.pulse.bot/gaming/news/clash-royale-what-is-the-ironheart-lucky-chest-and-how-to-unlock-it-3dc3053b-a832-400c-8822-69503573d796))
- **"Yeni Etkinlik!" etiketi:** Mod seçicide yeni etkinlik başlayınca dokunulana kadar duran bir etiket. Küçük ama bilinçli bir dikkat kancası. ([kaynak](https://supercell.com/en/games/clashroyale/blog/release-notes/october-update-2025))

## Survivor.io

Survivor.io'nun motoru **enerji + AFK geliri + reklam**. Oyun günlük sınırlı enerji veriyor, enerji bitince "bekle, reklam izle ya da öde" seçeneği çıkıyor. Oyuncu kapalıyken bile patrol geliri biriktiği için uygulamayı açmak her zaman bir ödül demek.

### Günlük döngü

- **Günlük Görevler:** Her biri 10 ya da 20 puan. Giriş, bölüm oynama, günlük stage, dükkandan alışveriş, ekipman yükseltme ve reklam izleyerek enerji alma 10 puan; dükkanda sandık açma, patrol gelirini 3 kez toplama, quick patrol'ü 2 kez kullanma 20 puan. 100 puan tüm günlük sandıkları açıyor. ([kaynak](https://www.appgamer.com/survivorio/daily-tasks))
- **Dikkat çekici detay:** Görev listesinde "gerçek parayla herhangi bir alım yap" da 20 puanlık bir görev. Yani ilk ödemeyi günlük rutinin bir maddesi gibi gösteriyor. (aynı kaynak)
- **Patrol (AFK geliri):** Oyuncu yokken XP ve altın birikiyor. Quick Patrol 15 enerji karşılığında anında 300 dakikalık gelir veriyor; günde sınırlı sayıda, bir tanesi de reklam izleyerek bedava. ([kaynak](https://onechilledgamer.com/survivor-io-guide-and-tips-for-beginners), [kaynak](https://mturbogamer.com/2022/09/survivor-io-patrol-quick-patrol/))
- **Enerji ekonomisi:** Enerji reklamla ya da elmasla alınıyor. Elmasla alımda fiyat her seferinde artıyor (rehberlere göre 100, 200, 300 elmas). Artan fiyat, "bugünlük yeter, yarın gel" sinyali. ([kaynak](https://mturbogamer.com/2022/10/survivor-io-best-way-to-spend-gems/))
- **Klan bonusu:** Klan seviyesi yükseldikçe ek günlük quick patrol açılıyor. Klanı bırakmak doğrudan gelir kaybı. ([kaynak](https://mturbogamer.com/2022/09/survivor-io-patrol-quick-patrol/))
- **Haftalık Görevler:** Günlük ekranın yanında ayrı bir haftalık görev seti var. ([kaynak](https://www.appgamer.com/survivorio/daily-tasks))

### Etkinlikler

- **Ender's Echo:** 28 günlük sezonlar halinde dönen boss modu. Günde sadece 2 deneme hakkı var, sezon içinde oynadığın gün sayısına göre sandık açılıyor, sonunda sıralama ödülü. Günlük sınırlı hak, "tek seferde bitirme, her gün gel" tasarımının en net örneği. ([kaynak](https://www.appgamer.com/survivorio/enders-echo))
- **Dönen mini oyun etkinlikleri:** Candy Match gibi ana oyundan farklı mekanikli kısa etkinlikler (örneğin 9 ile 14 Ekim arası 6 gün). Bedava bir Legend parça ve klan sıralaması içeriyor. ([kaynak](https://www.treyexgaming.com/?p=11199), [kaynak](https://www.treyexgaming.com/survivor-io-candy-match-event-guide/)) Güncelleme notlarında Moon Mine Mayhem, Rainbow Grid, Lunar Mine Turf gibi isimler de var; her büyük güncelleme yeni bir süreli mini oyun getiriyor. ([kaynak](https://apps.apple.com/mk/app/app/id1528941310))
- **Kolaborasyonlar:** TMNT ve SpongeBob gibi lisanslı işbirlikleri; geri dönen oyuncu için güçlü bir "yeniden indir" sebebi. ([kaynak](https://apps.apple.com/ca/app/survivor-io/id1528941310))
- **PvP katmanı:** Survivor Showdown ile diğer oyuncularla eşleşme eklendi; tek oyunculu oyuna rekabet döngüsü ekliyor. ([kaynak](https://apps.apple.com/mk/app/app/id1528941310))
- **Kod dağıtımı:** Sosyal medyadan düzenli olarak elmas ve enerji veren kodlar yayınlanıyor. Oyun dışında topluluk sayfalarını takip ettirmenin ucuz yolu. ([kaynak](https://mobilematters.gg/redeem-codes/survivor-io-codes))

### Ücretli katmanlar

App Store listesindeki satın alımlar tüm yapıyı gösteriyor: Month Card ve Month Card 2, Survivor Pass (4,99 dolar), Growth Fund, Small Piggy Bank (0,99 dolar), Daily Pack 1 ve 2, Chapter Pack'ler. ([kaynak](https://apps.apple.com/kh/app/survivor-io/id1528941310), [kaynak](https://apppricinglab.com/app/apple/1528941310))

- **Month Card / Super Month Card:** Günlük elmas, ek patrol ve ek enerji. Üst kart reklamları da kaldırıyor. Reklamı rahatsız edici yapıp çözümü abonelikte satmak bilinçli bir kurgu. ([kaynak](https://www.gamigion.com/survivor-io-by-habby-game-breakdown/), [kaynak](https://mturbogamer.com/2022/10/survivor-io-best-way-to-spend-gems/))
- **Kalıcı kart:** Bir kez alınıp her gün elmas ve anahtar veren kalıcı ayrıcalık kartı; aylık kartın süresiz sürümü. (aynı kaynak)
- **Survivor Pass:** Ücretsiz ve ücretli şeritli klasik pass.
- **Growth Fund ve Chapter Pack:** İlerleme eşiklerine bağlı paketler; bölüm geçtikçe açılıyor.
- **Kumbara (Piggy Bank):** Oynadıkça elmas birikiyor ama kırmak için para ödemek gerekiyor. Oyuncu "zaten kazandığım" elması kurtarmak için ödüyor. ([kaynak](https://www.gamigion.com/survivor-io-by-habby-game-breakdown/))
- **Günlük, haftalık, aylık indirim paketleri:** Her birinin üzerinde geri sayım sayacı var. (aynı kaynak)

## Karşılaştırma

Aynı mekanik üç oyunda farklı isimlerle duruyor; tablo her katmanın her oyundaki karşılığını gösteriyor.

| Katman | Whiteout Survival | Clash Royale | Survivor.io |
| --- | --- | --- | --- |
| Ana ilerleme birimi | Aktiflik puanı, etkinlik puanı | Taç (maçta kazanılır) | Enerji ve görev puanı |
| Günlük görev + sandık | 7 sandık, son sandık yaklaşık 325 puan | 4 Magic Lucky Chest, ilk galibiyetlere bağlı ödüller | 10-20 puanlık görevler, 100 puanda tüm sandıklar |
| Gün içinde tekrar girme sebebi | 24 Intel görevi, kuyruklar, Bear Hunt | Klan savaşı, etkinlik taçları | Patrol toplama (3 kez), quick patrol |
| AFK / pasif gelir | Toplama ve inşaat kuyrukları | Yok | Patrol |
| Sezon pass'i | Etkinliğe özel 21 kademeli pass'ler, Premium Pass | 90 kademe, Free + Diamond (yaklaşık 12 dolar) | Survivor Pass (4,99 dolar) |
| Pass bitince | Belirtilmemiş | Lucky Loop: günde 1 sandık | Belirtilmemiş |
| Abonelik | Aylık Kart, Haftalık Kart, VIP süresi | Pass serisi (art arda alım bonusu) | Month Card, Super Month Card, kalıcı kart |
| İlerlemeye bağlı fon | Growth Fund (Furnace seviyesi) | Yok | Growth Fund, Chapter Pack |
| Şans katmanı | Lucky Wheel (2 haftada bir, 3 gün) | Lucky Chest çevirmeleri | Dükkan sandıkları, çarklar |
| Haftalık etkinlik | Alliance Championship, Fortress Battles | Pazartesi başlayan taç etkinliği (200 taç, 15 kademe) | Dönen mini oyunlar |
| Aylık / sezonluk ana etkinlik | SvS, King of Icefield, Alliance Showdown | Albüm (81 parça, 9 sahne) | Ender's Echo (28 gün) |
| Sosyal bağ | İttifak puanı, ittifak mağazası, sunucu savaşı | Klan savaşı, Clan Gift | Klan seviyesiyle ek patrol |
| Reklam | Yok denecek kadar az | Yok | Enerji ve quick patrol için var |
| Kumbara | Yok | Yok | Small Piggy Bank |

## Ortak kalıplar ve psikolojik mekanizmalar

Bu oyunların benzer görünmesinin sebebi aynı birkaç davranış ilkesini aynı sırayla katmanlamaları. Her zaman ölçeğinin kendi "geri gel" sebebi var, kısa döngüler uzun döngüleri besliyor ve her döngüye bir ücretli hızlandırıcı bağlı.

&#91;embedded content: elde tutma döngüleri · 4 zaman ölçeği, 1 para katmanı\]

Gün içi işler günlük puanı doldurur, günlük puan haftalık etkinliği, haftalık etkinlik sezonluk hedefi (albüm, pass, SvS) besler.

1. **Kayıptan kaçınma (loss aversion):** Ödüller "kazanılacak" değil "kaçırılacak" diye sunuluyor. Aylık kart elması o gün alınmazsa yanar, pass sezon sonunda biter, Pass Royale serisi bir sezon atlanınca sıfırlanır, Survivor.io'da boş duran patrol veya kuyruk kayıp gibi hissettirir.
2. **"Zaten kazandın" etkisi (endowed progress):** Ücretli pass şeridi aynı ilerlemeyle dolduğu için oyuncu kilitli ödülleri önceden görüyor; satın alma "yeni bir şey almak" değil "benim olanı açmak" gibi. Kumbara aynı mantık: elması oyuncu biriktirdi, kırmak ücretli.
3. **Seyrek ve sınırlı hak (pacing):** Günde 2 boss denemesi, günün ilk 3 galibiyeti, her seferinde pahalanan enerji, Lucky Loop'ta günde 1 sandık. Oturum kısa kalıyor ama her gün tekrarlanıyor; tükenmişlik (burnout) azalıyor, alışkanlık güçleniyor.
4. **Değişken ödül:** Lucky Chest çevirmeleri, Lucky Wheel, nadirlik oranlı albüm parçaları. Sonucun belirsiz olması açma anını heyecanlı kılıyor. Clash Royale'in sezonluk sandık garantisi bu belirsizliğin hayal kırıklığını yumuşatan bir taban.
5. **Koleksiyon tamamlama:** 81 parçalık albüm, kahraman parçaları, bingo tahtası. Eksik tek parça, tamamlanmış parçalardan daha güçlü bir çağrı. Album Boost gibi son hafta etkinlikleri tam bu eksiği kapatmak için var.
6. **Sosyal yükümlülük:** İttifak puanı, klan seviyesine bağlı ek patrol, Clan Gift, kaybeden ittifaka da ödül. Oyuncu kendisi için değil takımı için giriş yapıyor; bırakmak başkalarını yarı yolda bırakmak demek.
7. **Kademeli fiyat merdiveni:** 0,99 dolarlık kumbara ve günlük paket, 4,99 dolarlık kart ve pass, 10 ila 12 dolarlık premium pass, en üstte etkinlik paketleri ve VIP. Survivor.io günlük görevine "bir ödeme yap" maddesini koyarak ilk basamağı oyun içi bir göreve çeviriyor.
8. **Tadımlık ücretsiz hak:** Lucky Wheel'de günde 1 bedava jeton, bedava quick patrol, ücretsiz pass şeridi. Ücretsiz oyuncu sisteme alışıyor, devamı için fiyat görüyor.
9. **Para zaman satıyor, erişim değil:** Clash Royale'de yeni Evolution bedava albümde, yeni kahraman ise ücretli şeritte veya Hero Coin ile. Ücretsiz oyuncu birkaç hafta sonra yetişiyor; ücretli oyuncu ilk haftayı satın alıyor. Bu denge, ücretsiz kitlenin (yani rakip havuzunun) oyunda kalmasını sağlıyor.
10. **Geri dönüş kancaları:** Telafi bonusu, sosyal medyadan dağıtılan kodlar, lisanslı kolaborasyonlar, "Yeni Etkinlik!" etiketi. Hepsi bırakmış ya da ara vermiş oyuncuyu ucuza geri çağırmak için.

## Kendi oyununa uygulamak için şablon

En küçük çalışan sürüm tek bir ilerleme birimi, bir günlük sandık merdiveni ve iki şeritli bir pass. Gerisi bu üçünün üzerine eklenebilir. Aşağıdaki sıra, üç oyunun ortak kurgusundan çıkarılmış önerilen kurulum sırası.

1. **Tek ilerleme birimi seç:** Clash Royale'deki taç gibi, her oturumda kazanılan ve aynı anda birden fazla çubuğu (pass, haftalık etkinlik, günlük görev) dolduran bir birim. Her maç birden çok hedefi ilerletince "bir tane daha" hissi doğal geliyor.
2. **Günlük görev + sandık merdiveni:** 6 ila 10 görev, 10 ile 30 arası puan, 4 ila 7 sandık. İlk sandık girişle açılsın, son sandık 10 ila 15 dakikalık oyun istesin. Reset saati sabit ve görünür olsun.
3. **Gün içi çağrı:** Biriken bir pasif gelir (patrol, kuyruk) ya da partiler halinde yenilenen mini görevler. Bir üst sınır koy ki uzun süre girmeyen oyuncu "taşma" kaybı yaşasın.
4. **Sezon pass'i (4 hafta):** Ücretsiz ve ücretli şerit aynı ilerlemeyi kullansın. Pass bittiğinde Lucky Loop benzeri "günde 1 bonus" uzantısı ekle ki bitiren oyuncu da gelmeye devam etsin. Art arda alım serisi abonelik etkisi yaratır.
5. **Haftalık etkinlik şablonu:** Her Pazartesi yeni tema, aynı motor: 10 ila 15 puan eşiği, son eşikte özel ödül. İçerik tema ve ödül tablosu olarak config'ten gelsin; yeni etkinlik kod değil veri olsun.
6. **Sezonluk koleksiyon hedefi:** Albüm gibi parça toplama. Haftalık etkinliklerin son ödülü koleksiyonun parçası olsun, son hafta da eksikleri tamamlatan bir "boost" etkinliği.
7. **Abonelik kartı:** Anında küçük ödül + 30 gün boyunca günlük damla. Toplam değer doğrudan para alımından belirgin şekilde iyi olsun ama sadece her gün alınca.
8. **Şans katmanı (opsiyonel):** Günde 1 bedava hak, sonrası premium para. Garanti veya pity sistemi ekle; sezon içinde belli sayıda açımda kesin ödül.
9. **Geri dönüş mekanikleri:** Kaçırılan günden sonra ilk galibiyette küçük telafi bonusu, sosyal medyada kod, yeni etkinlik için görünür rozet.

**Ölçülmesi gereken metrikler:** D1, D7, D30 retention; günlük sandık tamamlama oranı (kaç oyuncu son sandığa ulaşıyor); pass ücretsiz şerit tamamlama oranı; ücretli pass dönüşümü ve art arda sezon tekrar alım oranı; aylık kart yenileme oranı.

**Dikkat edilmesi gerekenler:** Kumar benzeri mekanikler (çark, şans sandığı) bazı ülkelerde loot box düzenlemesine giriyor ve mağazalar oran açıklaması istiyor; Clash Royale de oranları yayınlıyor. Kayıptan kaçınmaya fazla yaslanmak (her gün yanan ödül, sıfırlanan seri) kısa vadede retention'ı artırıp uzun vadede tükenmişliğe yol açabiliyor; Clash Royale'in telafi bonusu ve pass'te geriye dönük talep hakkı bu yüzden var.

## Kaynaklar

Rakamların çoğu topluluk rehberlerinden; fiyat ve ödül miktarları bölgeye, hesap seviyesine ve sezona göre değişiyor. Survivor.io kart ve enerji fiyatları daha eski rehberlerden, güncel oyunda farklı olabilir.

**Whiteout Survival**

- [Daily Missions: Tasks, Activeness, and Rewards](https://heaven-guardian.com/whiteout-survival-daily-missions-guide/) (Heaven Guardian)
- [Recurring Events Guide](https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-recurring-events-guide-en.html) (BlueStacks)
- [Which Pack Type Gives the Best Long-Term Value?](https://heaven-guardian.com/which-whiteout-survival-pack-type-gives-the-best-long-term-value/) (Heaven Guardian)
- [Frost Stars Top Up and Best Packs](https://buffget.com/news/whiteout-survival-frost-stars-top-up-31percent-off-and-best-packs) (BuffGet)
- [Max Alliance Coins with F2P Daily Loop](https://buffget.com/news/whiteout-survival-max-alliance-coins-with-f2p-daily-loop) (BuffGet)
- [Alliance Activity Triumph](https://outof.games/realms/whiteoutsurvival/guides/476-alliance-activity-triumph-in-whiteout-survival/) (Out of Games)
- [Lucky Wheel](https://mobi.gg/en/tips/lucky-wheel-whiteout-survival/) (mobi.gg)
- [Gilded Jade Guide](https://www.bluestacks.com/blog/game-guides/white-out-survival/wos-gilded-jade-guide-en.html) (BlueStacks)
- [VIP System](https://tcsn.tcteamcorp.com/blogs/17245/Whiteout-Survival-VIP-System-Unlock-Perks-Rewards)

**Clash Royale**

- [Pass Royale](https://support.clashroyale.com/hc/en-us/articles/49484915388443-Pass-Royale) (Clash Royale destek)
- [October Update 2025](https://supercell.com/en/games/clashroyale/blog/release-notes/october-update-2025) (Supercell)
- [Is Pass Royale Worth It in October 2026?](https://timesaver.gg/blog/is-pass-royale-worth-it-october-2026-shocktober) (Timesaver)
- [Pass Royale Q2 2026 Guide](https://trophycoach.com/guides/pass-royale-q2-2026-rewards-guide) (TrophyCoach)
- [Album Event Guide, March 2026](https://trophycoach.com/guides/album-event-guide-march-2026) (TrophyCoach)
- [Album snippet drop chances](https://support.clashroyale.com/hc/en-us/articles/49484957630619) (Clash Royale destek)
- [Album Event Guide](https://www.sportsdunia.com/gaming/clash-royale-album-event-guide), [Rhinos and Riches](https://www.sportsdunia.com/gaming/clash-royale-rhinos-and-riches-event-guide), [Album Boost May 2026](https://www.sportsdunia.com/gaming/clash-royale-album-boost-event-guide-may-2026) (SportsDunia)
- [Ironheart Lucky Chest](https://www.pulse.bot/gaming/news/clash-royale-what-is-the-ironheart-lucky-chest-and-how-to-unlock-it-3dc3053b-a832-400c-8822-69503573d796) (GamingonPhone via Pulse)

**Survivor.io**

- [Daily Tasks](https://www.appgamer.com/survivorio/daily-tasks) ve [Ender's Echo](https://www.appgamer.com/survivorio/enders-echo) (AppGamer)
- [Guide and Tips for Beginners](https://onechilledgamer.com/survivor-io-guide-and-tips-for-beginners) (OneChilledGamer)
- [Patrol and Quick Patrol](https://mturbogamer.com/2022/09/survivor-io-patrol-quick-patrol/) ve [Best Way to Spend Gems](https://mturbogamer.com/2022/10/survivor-io-best-way-to-spend-gems/) (MTurboGamer)
- [Game Breakdown](https://www.gamigion.com/survivor-io-by-habby-game-breakdown/) (Gamigion)
- [Candy Match Event Guide](https://www.treyexgaming.com/?p=11199) (Treyex Gaming)
- App Store sayfaları: [güncelleme notları](https://apps.apple.com/mk/app/app/id1528941310), [satın alım listesi](https://apps.apple.com/kh/app/survivor-io/id1528941310), [App Pricing Lab](https://apppricinglab.com/app/apple/1528941310)
- [Codes](https://mobilematters.gg/redeem-codes/survivor-io-codes) (Mobile Matters)
