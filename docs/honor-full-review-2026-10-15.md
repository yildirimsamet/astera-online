# Honor — uçtan uca review, 15 Ekim 2026

**Sonuç: mevcut durumuyla görünür Honor yarışını açmaya hazır değil.** Yeni hata senaryoları, mevcut regresyonların kapsamadığı beş ayrı sorunu gösterdi. Özellikle ilk sorun SHADOW gözlemi sırasında da gerçek savaşı durdurabiliyor. Uygulama kodu değiştirilmedi; bu çalışma inceleme, yeniden üretim ve düzeltme önerisidir.

## 1. P1 — Silent Space dönüşü savaş işlemini geri alabiliyor

Kaynaklar: `apps/server/src/services/commanderTransfer.ts:277`, `honorCommitment.ts:103`, `honorActivation.ts:78`, `honorTarget.ts:31`.

Gerçek servislerle yeniden üretim:

1. Mevcut komutan Silent Space'e gider.
2. Ana galakside Honor SHADOW gözlemi başlar; dışarıdaki komutanın bu galakside başlangıç gözlemi oluşmaz.
3. Başka bir oyuncu ana galaksideki hedefe saldırı gönderir.
4. Dışarıdaki komutan geri döner, klana katılır ve hedefe destek gönderir; destek saldırıdan önce ulaşır.
5. Savaş işçisi, desteğin saldırı gönderildiği andaki geçmişini arar. Bulamaz. İstisna yalnızca `joinedAt > launchAt` olan yeni hesapları kapsar; dönen mevcut komutan bu koşulu sağlamaz.

**Gözlenen:** `Missing Honor reference history`; saldırı `in_flight` kalıyor, savaş raporu sayısı **0**. Savaşın kaynak/kayıp/rapor yazıları aynı transaction içinde geri alınıyor. Sorun yalnızca bir puan eksikliği değil.

Aynı eksik dönüş kaydı hedef önizlemesini de hata ile bitiriyor; SHADOW sonrası açılış önizlemesi bütün komutanların geçmişini zorunlu kontrol ettiği için tek bir dönüş tüm galaksinin açılışını engelleyebiliyor. Bunlar bağımsız testlerle de yeniden üretildi.

**Basit düzeltme:** dönüş işlemi içinde, hedef sezon yerleşimi tamamlanınca gerçek mevcut envanter gözlemi yazılmalı. Gönderimden sonra ana galaksiye dönen desteği de, gerçek transfer/yerleşim kaydı üzerinden açık bir geç katılım durumu olarak ele almak gerekiyor. Yalnızca dönüşe gözlem eklemek eski gönderimin geçmişini oluşturmaz; iki sınır birlikte çözülmeli. Eksik geçmiş hatalarını genel bir `catch` ile yutmak veya bugünkü filoyu geçmişe yazmak çözüm değil.

**Açılış etkisi:** SHADOW hesapları da gerçek savaş transaction'ında çalışıyor. Görünürlüğü kapatmak bu hatayı izole etmiyor. Bu sorun düzelmeden canlıda SHADOW yapılandırmasını da etkinleştirmemek gerekir; yapılandırmasız kapalı kod deploy'u ayrı bir durumdur.

## 2. P1 — İlişki filtresi son ortak dağıtımda kayboluyor

**Takip kararı, 15 Ekim:** kullanıcı ortak tarafta pozitif Honor'u kapatmayı
onayladı. Yeni sürüm 3 bu yolu kaldırıyor; mevcut v1/v2 geçmişi donmuş halde
korunuyor. [Uygulama sözleşmesi](honor-solo-credit-2026-10-15.md). Aşağıdaki
yeniden üretim review anındaki v1/v2 davranışına aittir.

Kaynak: `packages/rules/src/honorTeam.ts:131`, `honorTeam.ts:174`, `honorTeam.ts:183`. Aday sürümün ortak dağıtımı da aynı ilkeye dayanıyor.

İlk hesap, yakın tarihli klan/yardım ilişkisi olan oyuncunun pozitif rakip maruziyetini doğru biçimde sıfırlıyor. Sonra diğer katılımcının hak ettiği puanlar ortak toplamda birleşip **bütün başlangıç ağırlıklarına** yeniden dağıtılıyor. Böylece pozitif uygunluğu sıfır olan kişi puan alıyor; onun rakip çiftine pozitif rezervasyon da yazılmıyor.

**Sayısal yeniden üretim:** A ve B eşit katılıyor; A ile hedef D ilişkili, B ile D değil. D'nin 50.000 askerî kaybında A'nın pozitif maruziyeti **0**, fakat A'ya **11,111111 Honor** ödeniyor. A–D ham çift kullanımı hâlâ **0**.

**Gerçek destekli savaş:** saldırgan ile yakın geçmişte aynı klanda bulunan ev sahibi, ilişkisiz bir savunma desteğinin ürettiği ortak havuzdan pozitif Honor aldı. Rastgele savaş kimliği kayıpları değiştirdiği için tekrarlar aynı kesin sayıyı üretmiyor; her iki kayıtta da ev sahibi pozitif aldı (yaklaşık **1,36–1,38 Honor**).

**Basit düzeltme:** savaşın K/L verimliliği ortak kalmalı; son vuruş/öldüren gemi hesabına dönülmemeli. Ancak pozitif çift hak edişinin hangi uygun komutana ait olduğu son ödemeye kadar korunmalı. İlişkili kişinin yasaklı rakipten pozitif pay alması, başka üyenin havuzu üzerinden açılamamalı. Bütün takımı otomatik olarak sıfırlamak masum katılımcıyı cezalandırır.

**Ayrı politika riski:** yeni bir takım arkadaşının taze çift bütçesinden, kendi çifti iyice azalmış üyeye de ortak pay aktarılıyor. Bu davranış mevcut plan ve mevcut testlerde açıkça seçilmiş; ayrıca bir kod regresyonu diye sunulmamalı. Fakat mevcut sınırın kişi başına, aynı mağdurdan alınabilecek bütün dolaylı puanları sınırlamadığı anlaşılmalı. Pozitif hak edişin uygun kişiye bağlanması bu tartışmayı da netleştirir.

## 3. P2 — Silent Space'te kurulan klanın ilişki geçmişi dönüşte unutuluyor

Kaynak: `apps/server/src/services/honorRelations.ts:25` ve `honorRelations.ts:29`.

İlişki sorguları yalnızca savaşın **ana sezon kimliğindeki** klan/yardım satırlarını okuyor. Oysa aynı komutan kimlikleri aynı döngü içinde Silent Space'e gidip dönebiliyor.

**Gerçek servislerle yeniden üretim:** iki komutan Silent Space'e taşındı, orada gerçekten klan kurup aynı klana katıldı, sonra ikisi de ana galaksiye döndü. Dönüşten hemen önce `related=true`; dönüşten hemen sonra `related=false`. Son yedi gün içinde örtüşen üyelikler veritabanında duruyor. Pozitif puan kısıtı böyle aşılabiliyor.

**Basit düzeltme:** mevcut aktörlerin savaş sezonuna ait olma şartı korunmalı; fakat ilişki geçmişinin kapsamı, aynı döngüde yerleşim değiştirmiş aynı kimliklerin geçerli geçmişini içermeli. Yeni bir ilişki sistemi gerekmez. Yardım sorgusundaki aynı sezon filtresi de bu düzeltmede denetlenmeli; bu tur gerçek yeniden üretim klan üyeliği üzerinden yapıldı.

## 4. P1 — Sezon devrinde Honor ana yarış olarak devam etmiyor

Kaynak: `apps/server/src/services/servers.ts:434`, `servers.ts:742`, `apps/server/src/services/season.ts:133`.

**Gerçek yeniden üretim:** ACTIVE Honor sezonu kapatıldı, gerçek `season_rollover` işçisi çalıştırıldı. Oluşan iki canlı ana sezonun da Honor yapılandırması **yok**. Mevcut ödül teslim testinin geçmesi bu durumu kontrol etmiyor: eski Honor ödülü yeni sezonda teslim edilebiliyor ama yeni Honor yarışı oluşmuyor.

Sonuç olarak yeni sezonda Honor puanlaması çalışmıyor, ekranlar Hakimiyet'e dönüyor. Mevcut canlı sezona elle SHADOW/açılış komutu vermek, kalıcı ana sıralama sisteminin sezon başlangıç politikasının yerini tutmuyor.

**Basit düzeltme:** onaylı Honor sürümü ve başlangıç modu, ana sezon oluşturma/rollover işleminin açık ve atomik bir parçası olmalı. Silent Space otomatik rekabete dahil edilmemeli; kapalı gözlem ile herkese duyurulmuş yeni sezon başlangıcı ayrımı korunmalı.

## 5. P2 — Honor değişimi tek başına sıralama güncellemesi yayınlamıyor

Kaynak: `apps/server/src/services/honorLedger.ts:138`, `apps/server/src/worker/handlers.ts:1207`, `apps/web/src/session/shardEvents.ts:68`, `apps/web/src/api/queries.ts:588`.

Honor defteri puanı yazıyor ama `score` yayınlamıyor. Normal savaş işçisi bunu ancak Hakimiyet hesabı değişirse yayınlıyor. `arrival` bildirimi de istemcide leaderboard'u yenilemiyor. Leaderboard sorgusundaki 60 saniyelik `staleTime` bir periyodik yenileme zamanlayıcısı değildir; `refetchInterval` yok.

**Gerçek yeniden üretim:** iki tarafın 30 Pike ile savaşı, iki tarafta da pozitif Honor üretti (**+9,551791 / +11,021298**); galaksideki bütün Hakimiyet bakiyeleri **0** kaldı. Yayınlar `arrival`, `protection`, iki `chronicle`; **`score` yok**.

Savaşın tarafları özel bildirimle genel yenileme alabilir; üçüncü bir komutanın açık sıralama ekranı ve haritadaki Honor kürsüsü yeni sonucu öğrenemez. Başka bir uygun olay, odaklanma veya yeniden açma gerekebilir.

**Basit düzeltme:** gerçek görünür Honor toplamı değiştiğinde aynı transaction'dan mevcut `score` olayı yayınlanmalı; SHADOW sonuçları görünür yenileme üretmemeli, tekrar teslimi gereksiz yeni olay basmamalı. Gecikmiş olayın eski sonuçları yeniden hesaplaması da kapsanmalı.

## Yeni keşif olmayan, hâlâ açık lansman eksikleri

1. **Açılabilen sürüm v1; adalet düzeltmeleri yalnızca SHADOW v2'de.** `honorActivation.ts:66` v2 açılışını reddediyor. Eşdeğer eşzamanlı karşılıklı başarı v1'de **66,666666 / 33,333334**, v2'de **50 / 50** üretiyor. Kaynak kimliğinin sırası payı değiştiriyor; bu tur tekrar gösterildi. Ayrıca gönderimde filosu sıfır olan, uçuş sırasında gerçek üretim yapıp saldırganı vuran savunmacı v1'de **0** alıyor. Gerçek üretim/savaş testi iki sürüm için var ve geçti; v1'deki 0 beklentisi oyuncu açısından sorunlu davranışın korunduğunu gösteriyor. Adayı doğrudan açmak yerine onaylı ve tamamlanmış tek bir lansman sürümü seçilmeli; mevcut sezonun donmuş sürümü sessizce değiştirilmemeli.
2. **EMP/Death Star/interceptor sonuç muhasebesi bağlı değil.** `packages/rules/src/honorTactical.ts` açıkça öneri fonksiyonu; gerçek settlement çağrısı yok. Stratejik envanterin askerî güce katılması da yalnızca v2'de. `strategic.ts`, `strategicInterception.ts` ve Death Star işçisi gözlem yazıyor; Honor commitment/sonuç/yaptırım defteri yazmıyor. Ortak çalışma alanındaki yeni radyasyon bombası için de Honor adapter'ı yok. Bu kaynaklardan zayıfa baskı, tekrar, gerçek etki, etkisiz vuruş ve gerçek interception ödülü uçtan uca tamamlanmadan tüm PvP kapsamı hazır sayılamaz.
3. **Kalıcı anıt isimleri hâlâ Hakimiyet sırasından geliyor.** `monumentHonorees.ts:37` doğrudan `final_rank` okuyor. Honor ana prestij sistemi olduğunda sezon sonu unvan/chat kürsüsü ile bu kalıcı onurlandırma farklı kazananları gösterebilir. Bu, statik kod bulgusu; bu tur bunun için ayrı gerçek rollover/isim testi yazılmadı.
4. Ortak operasyon gönderiminde bütün katılımcılarla kişi bazlı Honor rehberi eksik. Mevcut bireysel hedef kartını takımın kesin sonucu gibi sunmamak gerekir. Ayrıca v2 stratejik envanteri kabul edilirse `honorTarget.ts` içindeki yalnızca `units` okuyan önizleme, authoritative envanter hesabıyla birleştirilmeli; mevcut v1'e yeni bir önizleme hatası diye yazılmadı.

## İnceleme ve doğrulama kapsamı

Kural hesabı, 24 saat donanma tepesi/sezon Core tepesi, snapshot sırası, gönderim ve eski uçuş sınırı, normal/destekli/ortak/anıt savaş adapter'ları, kalıcı kayıp ve ücretsiz rebuild, siviller, gerçek kaçış, kalkan katkısı, ilişki/tekrar/karşılık bütçesi, çift sınırı, idempotency/rollback/rebuild, SHADOW → ACTIVE temiz başlangıç, kapanış/arşiv/ödül teslimi, hedef rehberi, leaderboard ve kürsü akışları incelendi.

Özellikle şu mevcut davranışlar regresyonda korundu: savunanın puan kaybetmemesi; boş yağmanın tek başına pozitif Honor üretmemesi; sivrisinek saldırısının gerçek kaybının yazılması; ücretsiz yeniden kurulan yer savunmasının kayıp sayılmaması; kaçan filoya sahte imha yazılmaması; son vuruş yerine ortak taraf verimliliği; aynı kaynağın tekrar puan basmaması; gerçek hata halinde atomik rollback; eşit puana eşit sıra/ödül; Honor ve Hakimiyet kaynak ödüllerinin iki kere toplanmaması; ödülün bir kez teslimi; eski SHADOW raporlarının sonradan görünür puana dönüşmemesi.

Yeni problar `.dev/honor-review-20261015/` altında; beklenen korumayı assert ettikleri için açık hatalarda **RED** kalıyorlar. Varsayılan test keşfine eklenmediler ve uygulama kodu bu incelemede değiştirilmedi. Düzeltmeler sırasında kalıcı regresyon testlerine taşınmaları gerekir. Bazı RED testler aynı kök nedenin ayrı etkileridir; başarısız test sayısı ayrı bug sayısı değildir.

Bu tur kontroller tek işçiyle, `nice -n 10`, testlerde 1024 MiB Node heap ile ve yalnızca ayrılmış `astera_honor_test` veritabanında sıralı çalıştırıldı. Oynanabilir yerel sezon ve production verisi değiştirilmedi. Uzun ekonomi simülasyonu çalıştırılmadı.

## Doğrulama kaydı

| Kontrol | Bu tur sonuç | Log |
| --- | --- | --- |
| Honor kuralları, 7 dosya | **125 PASS** | `.dev/honor-review-20261015/rules-regression.log` |
| Sunucu Honor + ortak anıt + sezon ödülü + contract, 36 dosya | **363 PASS, 2 eski sürüm koşullu SKIP** | `.dev/honor-review-20261015/server-regression.log` |
| Honor gönderim/leaderboard/sonuç/hedef/puan/ödül UI, 6 dosya | **24 PASS** | `.dev/honor-review-20261015/web-regression.log` |
| Yeni inceleme senaryoları, 2 izole dosya | **11 RED, 1 PASS** | `.dev/honor-review-20261015/review-evidence.log` |
| Sunucu tam typecheck | **PASS** | `.dev/honor-review-20261015/server-typecheck.log` |
| Web tam typecheck | **FAIL — Honor dışı 5 tip hatası** | `.dev/honor-review-20261015/web-typecheck.log` |

Toplam **512 mevcut regresyon testi geçti**. Yeni senaryolardaki 11 RED, beş yeni kök nedenin farklı etkileri ile önceden bilinen v1 eşzamanlılık açığının tekrar gösterimidir. PASS kalan yeni senaryo mevcut ortak çift-bütçesi dağıtım tercihinin nicel kaydıdır; hatayı başarı diye işaretlemek için beklentiler değiştirilmedi.

Web genel tip kontrolünün beş hatası: `RadiationHaze.tsx:86` ve `radiation-lib.test.ts:206/207` için radyasyon seviye 3 imzası; `onboarding/world.ts:282` için yeni `radiationBombsAvailable` / `radiationBombs` alanları; `RadiationBombControls.tsx:101` için Toggle'a verilen `label` prop'u. Bu tur bu dosyalar değiştirilmedi. Honor odaklı testlerin geçmesi tüm çalışma alanının typecheck/build'inin yeşil olduğu anlamına gelmiyor.

Testler repo kökünden şu komutlarla tekrar çalıştırılabilir. DB komutları yalnızca ayrılmış, silinebilir test veritabanını hedefler:

```sh
NODE_OPTIONS=--max-old-space-size=1024 nice -n 10 pnpm --filter @astera/rules exec vitest run test/honor.test.ts test/honor-team.test.ts test/honor-history.test.ts test/honor-rewards.test.ts test/honor-valuation.test.ts test/honor-shield-evidence.test.ts test/honor-tactical.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism

DATABASE_URL=postgres://astera:astera@127.0.0.1:55435/astera_honor_test NODE_OPTIONS=--max-old-space-size=1024 nice -n 10 pnpm --filter @astera/server exec vitest run honor- monument-joint-war.test.ts season-rank-rewards.test.ts contract.test.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism

NODE_OPTIONS=--max-old-space-size=1024 nice -n 10 pnpm --filter @astera/web exec vitest run test/honor-leaderboard.test.tsx test/honor-result.test.tsx test/honor-target-card.test.tsx test/honor-launch-guidance.test.tsx test/ranking-scores.test.tsx test/season-reward-receipt.test.tsx --maxWorkers=1 --minWorkers=1 --no-file-parallelism

DATABASE_URL=postgres://astera:astera@127.0.0.1:55435/astera_honor_test NODE_OPTIONS=--max-old-space-size=1024 nice -n 10 pnpm exec vitest run --config .dev/honor-review-20261015/vitest.config.ts --maxWorkers=1 --minWorkers=1 --no-file-parallelism
```

Bu turda uygulama değişmediği için geniş lint/build veya uzun ekonomi simülasyonu çalıştırılmadı. Kod okuması ve mevcut API/UI regresyonları yapıldı; yeni bir tarayıcı görsel turu yapılmadı. İki gerçek savaş hata senaryosu ve Honor-only yayın senaryosu gerçek gönderim, destek/transfer ve savaş işçisi çağrılarıyla test edildi.

## Düzeltme sırası

1. Dönüş/gönderim/katılım sınırları: kapalı gözlemde bile gerçek savaşı durduran hata.
2. Pozitif hak edişte ilişki filtresi ve Silent Space ilişki geçmişi; ortak verimliliği koruyarak.
3. Lansman sürümünün eşzamanlılık, gerçek reaktif savunma ve özel silah kapsamını tamamlayıp sürüm kararını netleştirmek.
4. Yeni sezonun Honor yapılandırması ve görünür puan güncellemesi yayını.
5. Kalıcı prestij yüzeyleri ve ortak gönderim rehberi; sonra açılış/ödül/gerçek savaş regresyonlarını yeniden çalıştırmak.

Bu sorunlar ana fikri terk etmeyi gerektirmiyor. En büyük ihtiyaç yeni puan türleri veya çok sayıda katsayı değil; mevcut ortak hesabın uygunluk, yerleşim, sürüm ve yayın sınırlarını tutarlı hale getirmek.
