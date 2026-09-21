# Klan Ortak Savaşı — Step 0–7 Code Review Bulguları

> **2026-09-21 çözüm kaydı:** Aşağıdaki 18 bulgu sonraki geliştirme turunda ele alındı.
> Phase 0 için değişiklik-öncesi baseline geri kazanılamadığından hiçbir failure
> "pre-existing" sayılmadı. Düzeltme ve son test kanıtı
> [`clan-joint-war-post-change-checkpoint.md`](clan-joint-war-post-change-checkpoint.md)
> dosyasında; gerçek sezon/hesap/worker denemesi
> [`clan-joint-war-manual-test-plan.md`](clan-joint-war-manual-test-plan.md) dosyasında.

> İnceleme tarihi: 2026-09-20  
> Kapsam: `docs/clan-joint-war-implementation-plan.md` içindeki Phase 0–7  
> Yöntem: Yalnız kod, migration, test veya tekrar üretilebilir komutla doğrulanan bulgular yazılır.

## Phase 0 — Baseline ve güvenli başlangıç

### P2 — Feature'a özgü değişiklik-öncesi baseline kaydı bulunmuyor

- **Beklenen:** Plan, rules/server/web hedefli baseline testlerinin implementasyondan önce
  çalıştırılmasını ve mevcut failure'ların exact test adı/output ile kaydedilmesini istiyor.
- **Doğrulama:** Repo genelinde `baseline`, `Phase 0`, `clan joint war` ve `ortak savaş`
  kayıtları tarandı. Bu feature'a ait bir baseline/handoff kaydı bulunmadı. Mevcut
  `docs/test-baseline-2026-09-18.md` bu çalışmadan önceki farklı bir genel baseline; planın
  istediği feature'a özgü test sonuçlarını içermiyor. Çalışma ağacında şu anda
  kapsamlı ürün değişiklikleri bulunduğundan gerçek pre-change baseline artık yeniden üretilemez.
- **Etki:** Sonraki full-verify failure'larının bu implementasyondan mı yoksa önceden mi geldiği
  kanıtla ayrıştırılamaz; Phase 12'de "baseline failure" istisnası güvenilir biçimde
  kullanılamaz.
- **Gerekli düzeltme:** Bu çalışma için mevcut durum bir post-change checkpoint olarak açıkça
  kaydedilmeli; hiçbir failure pre-existing diye etiketlenmemeli. Gelecek feature'larda Phase 0
  çıktısı ilk ürün değişikliğinden önce kalıcı handoff notuna yazılmalı.

## Phase 1 — Rules primitives

### P1 — Filoyu küçük wave'lere bölmek saldıran kayıplarını sıfırlayabiliyor

- **Beklenen:** Ortak havuz tek bir birleşik filo gibi savaşmalı; contribution sınırları gemi
  sahipliğini korumalı fakat aynı filoyu daha çok wave'e bölmek combat sonucunu istismar
  edilebilir ölçüde değiştirmemeli.
- **Kök neden:** `packages/rules/src/combat.ts:346` her contribution için ayrı fractional damage
  carry tutuyor; `packages/rules/src/combat.ts:417-421` defender hasarını her stack'e ayrı uygulayıp
  her birinde `floor(damage / hp)` yapıyor. Plan aynı oyuncuya ve aynı origin'e sınırsız wave
  izni verdiği için oyuncu her gemiyi ayrı contribution'a koyabiliyor.
- **Doğrulama:** Aynı seed, aynı oyuncu, aynı teknoloji ve aynı toplam board ile
  `resolveJointCombat` doğrudan çalıştırıldı. `{ DART: 100 }` tek contribution olarak
  `{ BASTION: 4 }` karşısında 5 DART kaybetti; aynı 100 DART aynı oyuncuya ait 100 adet
  `{ DART: 1 }` contribution'a bölününce 0 DART kaybetti. Daha geniş matris taramasında da
  örneğin 50 DART / 8 BASTION sonucu `23 → 0`, 100 DART / 20 BASTION sonucu `60 → 0`
  oldu.
- **Etki:** Oyuncu aynı filoyu daha fazla wave'e bölerek fiilen hasar bağışıklığı
  kazanır; kayıp, loot, Dominion, recovery shield ve rapor sonuçları bozulur.
- **Gerekli düzeltme:** Defender hasarı contribution başına bağımsız floor edilmemeli.
  Aynı HP/tech kohortunda aggregate casualty sayısı önce belirlenip deterministic olarak
  sahip/wave'lere dağıtılmalı veya fractional carry contribution sınırından bağımsız
  ortak bir casualty allocator ile korunmalı. Tek board ile N wave eşdeğerliğini küçük
  filolarda exact kanıtlayan regression testi eklenmeli.

### P2 — Phase 1 çıkış kriterindeki mevcut Hangar testi yeşil değil

- **Beklenen:** Phase 1 sonunda yeni rules testleri ile eski combat/fuel/hangar testleri yeşil
  olmalı.
- **Doğrulama:** `pnpm --filter @astera/rules exec vitest run test/clan-war.test.ts
  test/combat.test.ts test/fuel.test.ts test/hangar.test.ts` komutunda clan-war (49), combat (61)
  ve fuel (22) testleri geçti; `test/hangar.test.ts:105` ise `0.054863968800650975` sapmayı `%5`
  sınırından küçük beklediği için kaldı. Toplam sonuç: 156 pass, 1 fail.
- **Etki:** Phase 1 planın kendi çıkış kriterini karşılamıyor ve full verification yeşil
  olamaz. Phase 0 kaydı olmadığından bu failure bu çalışma için kanıtlı bir pre-existing
  istisna olarak işaretlenemez.
- **Gerekli düzeltme:** Hangar kontratındaki sapmanın ürün sayısı mı yoksa test toleransı mı
  olduğu ayrıca kararlaştırılıp test yeşile getirilmeli; bu feature'a ilgisizse de exact kanıt
  ile ayrı blocker olarak kapatılmadan Phase 1 tamamlandı sayılmamalı.

## Phase 2 — Migration ve schema

### P1 — Tamamlanmış bir ortak savaş oyuncunun reclaim/account-deletion yolunu kalıcı bozuyor

- **Beklenen:** Aktif operasyon reclaim/account deletion için busy sayılmalı; operasyon sonucu
  kesinleştikten sonra tarihsel snapshot'lar oyuncu ve gezegen satırı silinse de temizlenebilir
  veya korunabilir olmalı. Plan bu nedenle Phase 2'de deletion-order fixture, Phase 6'da busy guard
  testi istiyor.
- **Kök neden:** `clan_war_operations.leader_player_id`, `target_player_id`,
  `staging_planet_id` ve `target_planet_id` ile `clan_war_contributions` sahip/origin alanları
  `ON DELETE no action` foreign key. `apps/server/src/services/reclaim.ts` ise bu tabloları
  toplamıyor veya terminal kayıtları silmeden `players`/`planets` satırlarını siliyor.
  `accountDeletion` da aynı `busy/commanderRows/demolish` yolunu paylaşıyor.
- **Doğrulama:** Gerçek test DB'sinde `COMPLETED/EXPIRED` bir operasyon oluşturulup lider
  reclaim eşiğinin gerisine alındı. `reclaimIdleSeats` sonucu
  `{ "reclaimed": [], "deferred": 0, "failed": 1 }` oldu. Ortada aktif filo veya dönüş
  olmadığı halde FK ihlali transaction'ı geri aldı.
- **Etki:** Bir kez ortak savaşta lider, hedef veya contributor olan hesap sezon sonuna kadar
  idle seat olarak geri kazanılamaz; aynı referanslar kullanıcının hesap silme isteğini de 500/FK
  hatasına çevirebilir. Dolu galakside koltuklar kalıcı takılı kalır.
- **Gerekli düzeltme:** Aktif state'ler açıkça busy/defer edilmeli; terminal operasyonlar için
  reclaim/account deletion sırasında child graph doğru sırayla temizlenmeli veya tarihsel kimlik
  alanları gerçek snapshot semantiğine uygun olarak FK'siz/nullable tasarlanmalı. Hem terminal
  reclaim hem aktif-operation defer entegrasyon testleri eklenmeli.

### P1 — Mission relation başka bir operasyonun contribution'ına bağlanabiliyor

- **Beklenen:** `clan_war_missions.operation_id` ile doluysa `contribution_id` aynı operasyona ait
  olmalı; relation bütün worker/return routing'inin tek otoritesidir.
- **Kök neden:** `clan_war_missions` iki alanı ayrı FK'lerle doğruluyor ancak
  `(contribution_id, operation_id)` için composite FK/constraint yok. Mevcut binding CHECK yalnızca
  `COMBINED_ATTACK` ile null contribution ilişkisini kontrol ediyor.
- **Doğrulama:** Gerçek DB'de Operation A'ya ait contribution oluşturuldu; ayrı klanın
  Operation B mission relation'ına bu contribution ID ile `SUPPORT_OUT` eklendi. Insert başarılı
  oldu ve farklı operation UUID'leri birlikte kalıcılaştı.
- **Etki:** Tek bir servis/concurrency hatasında arrival handler operation B'yi okurken operation
  A'nın filosunu transition edebilir; cancel, return, capacity, sahiplik ve rapor state'i iki
  operasyon arasında karışır. Veritabanı kritik invariantı korumuyor.
- **Gerekli düzeltme:** Contribution tarafında `(id, operation_id)` aday anahtarı ve mission
  relation tarafında composite FK kullanılmalı veya contribution leg'lerinde tekrarlı
  `operation_id` kaldırılıp operation yalnız contribution'dan türetilmeli. Cross-operation insert'i
  reddeden schema regression testi eklenmeli.

## Phase 3 — Treasury ve clan progression

### P1 — Tek bir bağış audit satırı oyuncunun koltuğunu kalıcı olarak reclaim edilemez yapıyor

- **Beklenen:** Bağış immutable audit olarak kalabilir veya sezon-presence temizliğiyle birlikte
  bilinçli olarak silinebilir; her iki durumda da terminal bir bağış oyuncunun daha sonra idle
  reclaim/account deletion yolunu bozmamalı.
- **Kök neden:** `clan_treasury_events.actor_player_id` ve `source_planet_id` `ON DELETE no action`
  FK taşıyor. `commanderRows/demolish` bu tabloyu toplamıyor veya snapshot'a çevirmiyor.
- **Doğrulama:** Gerçek test DB'sinde oyuncunun gezegeninden 1 alloy'luk `DONATION` audit satırı
  yazıldı, oyuncu reclaim eşiğinin gerisine alındı ve `reclaimIdleSeats` çalıştırıldı.
  Sonuç `{ "reclaimed": [], "deferred": 0, "failed": 1 }` oldu.
- **Etki:** Ortak savaşa hiç katılmamış olsa bile klana bir kez bağış yapan her oyuncu sezon
  boyunca boşaltılamayan koltuk haline gelir; hesap silme de aynı ortak demolish yolunda FK
  hatasına dönebilir.
- **Gerekli düzeltme:** Audit kimlikleri reclaim sonrası yaşayacak snapshot ise player/planet FK'leri
  kaldırılmalı; sezon-presence ile silinecekse `demolish` child graph'ına doğru sırada eklenmeli.
  Gerçek donation sonrası reclaim ve account deletion entegrasyon testleri zorunlu olmalı.

### P1 — Inactivity ile otomatik disband hazinedeki kaynakları yakmıyor ve audit yazmıyor

- **Beklenen:** Klan hangi yoldan disband edilirse edilsin kalan hazine sıfırlanmalı ve immutable
  `DISBAND_BURN` hareketi yazılmalı. Kullanıcı eyleminde confirmation gerekir; sistem kaynaklı
  inactivity disband'i actor'less/system audit kullanmalıdır.
- **Kök neden:** `apps/server/src/services/clan.ts:1527-1552` içindeki
  `reconcileClanPlayerReclaim` son aktif lider için üyelikleri kapatıp `disbandedAt` yazıyor fakat
  `burnClanTreasury` çağırmıyor, bakiyeleri sıfırlamıyor ve treasury event oluşturmuyor.
- **Doğrulama:** Tek liderli klana test DB'sinde 400 alloy / 100 crystal hazine yazılıp
  `reconcileClanPlayerReclaim` çalıştırıldı. Sonuç
  `disbanded=true`, `treasury=[400,100,0]`, `burnEvents=0` oldu.
- **Etki:** Disband olmuş klan harcanmamış fakat erişilemeyen bakiye taşır; cached treasury ile
  audit toplamının eşitliği bozulur ve ürünün "disband kalan hazineyi yakar" kuralı yalnız HTTP
  yolunda uygulanmış olur.
- **Gerekli düzeltme:** Inactivity disband aynı merkezi burn primitive'ini system/actor-null modu ile
  kullanmalı; clan, treasury ve audit aynı transaction'da güncellenmeli. Aktif successor varsa
  hazinenin korunduğunu, successor yoksa exact burn yazıldığını test et.

## Phase 4 — Hedef yaşam döngüsü

### P1 — Kilit çakışmasında atlanan target-drift hook'unun authoritative fallback'i yok

- **Beklenen:** Sahibi değişen veya saldıran klana katılan hedef savaş başlamadan otomatik iptal
  edilmeli. `tryCloseFromHook` bilerek `SKIP LOCKED` kullandığı için hook yalnız hızlı yol olmalı;
  kodun kendi kontratında belirtildiği gibi sonraki read/add/recall/cancel/start yolu hedefi yeniden
  doğrulayıp kapanışı kalıcılaştırmalı.
- **Kök neden:** `apps/server/src/services/clanWar.ts:368-397` içindeki `readClanWar` yalnız expiry
  kontrolü yapıyor; güncel controller ve clan membership'i kontrol etmiyor.
  `gatherContribution` controller farkında yalnız `CLAN_WAR_TARGET_CHANGED` fırlatıyor ve operasyonu
  kapatmıyor. `startClanWar` önce `closeOperation` çağırsa da hemen ardından aynı transaction içinde
  exception fırlattığı için route transaction'ı kapanış dahil tamamen rollback oluyor. Recall da
  hedefi doğrulamıyor. Böylece `apps/server/src/services/clanWar.ts:1777-1779` ve
  `1826-1829` yorumlarındaki "hook authority değil, her yol re-check eder" invariantı gerçek değil.
- **Doğrulama:** Gerçek test DB'sinde hedefli bir `ASSEMBLING` operasyon kuruldu. Ayrı transaction
  staging gezegenini `FOR UPDATE` ile kilitlerken hedefin controller'ı değiştirildi ve
  `revalidateClanWarTargetPlanet` çağrıldı. Hook staging lock'ını `SKIP LOCKED` ile alamayıp döndü.
  Kilit bırakıldıktan sonra `readClanWar` çağrısının ve DB satırının sonucu birlikte
  `{ viewStatus: "ASSEMBLING", rowStatus: "ASSEMBLING", closeReason: null }` kaldı; target snapshot
  artık güncel controller'dan farklıydı. Normal, çakışmasız ownership ve membership testleri ise
  geçtiği için eksik özellikle fallback/concurrency yolunda.
- **Etki:** Nadir fakat normal bir lock contention hedef değişimini 24 saatlik expiry'ye kadar
  görünmez bırakabilir. Klan eski hedefi aktif görür; katkı denemeleri sürekli hata alır ve start'ın
  "iptal ettim" değişikliği rollback olur. İçinde wave varsa otomatik dönüş de planlanmaz.
- **Gerekli düzeltme:** Drift doğrulaması tek bir merkezi, transaction içinde kapanışı yapan primitive
  olmalı. Read yolu gerekiyorsa kendi transaction'ında bu primitive'i çağırmalı; mutation yolları
  kapanışı commit edebilmek için kapanıştan sonra exception ile aynı transaction'ı rollback
  etmemeli (ör. kalıcı state sonucunu döndürme veya transaction sınırının dışında hata üretme).
  Staging lock'ı tutulurken owner-change ve target-joins-clan hook'larının atlandığı, kilit açıldıktan
  sonraki her authoritative girişin operasyonu `TARGET_CHANGED` ile kapatıp wave'leri döndürdüğü
  concurrency regression testleri eklenmeli.

## Phase 5 — Contribution quote ve dispatch

### P1 — Sonradan başlayan gezegen koruması quote/dispatch tarafından yok sayılıyor

- **Beklenen:** Contribution quote ve dispatch target'ın o andaki bütün saldırı korumalarını ön
  kontrol etmeli. Target işaretlendikten sonra başlayan planet occupation/recovery koruması
  operasyonu iptal etmemeli fakat yeni katkı kabulü uygun refusal ile durmalıdır.
- **Kök neden:** `apps/server/src/services/clanWar.ts:929-936` target planet satırını okusa da yalnız
  controller snapshot'ını karşılaştırıyor. Daha sonra çağrılan `assertTargetReachable` ve
  `assertAttackProtections` yalnız `players.newcomer_shield_until` /
  `players.recovery_shield_until` alanlarını kontrol ediyor. `planets.protected_until` ve
  `planets.recovery_until` kontrolleri yalnız ilk mark sırasında var.
- **Doğrulama:** Gerçek test DB'sinde target başarıyla işaretlendikten sonra target planet'in iki
  koruma alanı da geleceğe alındı. Aynı leader-capital wave için quote
  `{ quoteOk: true, refusals: [] }` döndürdü; dispatch de `{ accepted: true, status: "STAGED" }`
  oldu ve contribution satırı yazıldı.
- **Etki:** Korunmuş bir dünyaya karşı üyeler yakıt ve filo bağlayabilir. Start tarafında da aynı
  planet-level kontrol eksikse korumanın kendisi aşılır; start düzeltilse bile oyuncular baştan
  reddedilmesi gereken, launch edilemeyen havuza kaynak kilitlemiş olur.
- **Gerekli düzeltme:** Normal saldırı yolundaki world-level occupation/recovery gate'i ortak bir
  helper'a çıkarılıp mark, contribution quote/dispatch ve start'ta kullanılmalı. Mark sonrası
  koruma başlayan target için operasyonun `ASSEMBLING` kaldığını fakat quote ve dispatch'in exact
  refusal code verdiğini test et.

### P1 — Dispatch sezon hesabı birleşik bacakta yanlış gezegenin Beacon'ını kullanıyor

- **Beklenen:** Support outbound çıkış gezegeninin, combined leg ise staging başkentinin mevcut
  Beacon boost'unu kullanmalı. Dispatch yalnız hemen staging'e varıp hemen launch edilen senaryonun
  battle-return'ü sezon içinde bitebiliyorsa wave kabul etmeli.
- **Kök neden:** `apps/server/src/services/clanWar.ts:973-1008` season feasibility hesabındaki
  `combinedMinutes`, `orbitOf(staging, origin)` üzerinden üretiliyor. Bu helper
  `apps/server/src/services/clanWar.ts:1128-1143` içinde staging'i bilerek yok sayıp contributor
  origin orbit'ini döndürüyor. Start ise doğru olarak staging Beacon'ını kullanıyor. Tahmini quote
  sunmak kabul edilebilir olsa da aynı yanlış tahmin authoritative dispatch'in `canFinish`
  kararını da veriyor.
- **Doğrulama:** Member origin'e Beacon takılı, staging'de Beacon olmayan gerçek DB senaryosunda
  clock expiry'den hemen önceye ve season end hesaplanan quote home zamanından bir saniye sonraya
  getirildi. Quote `ok: true`, dispatch `OUTBOUND` oldu. Wave staging'e indikten hemen sonra start
  `CLAN_WAR_SEASON_TOO_SHORT` ile reddedildi. Reprodüksiyonda quote combined/return süreleri
  `1.3692 / 0.6846` dakika, season end `00:02:12.229Z` idi; kabul edilmiş havuz gerçek start
  hesabıyla eve dönemiyordu.
- **Etki:** Sezon sonuna yakın bir oyuncu tam yakıtı peşin ödeyip filosunu staging'e yollar fakat
  liderin hiçbir anda başlatamayacağı bir pool oluşur. Operation expiry'ye kadar gereksiz yere
  kilitlenir ve sonra filo geri döner.
- **Gerekli düzeltme:** Staging orbit'i quote/dispatch transaction'ında gerçekten yüklenmeli ve
  combined estimate onun boost'uyla hesaplanmalı. Authoritative dispatch feasibility ile start
  hesabının aynı travel primitive/boost kaynaklarını kullandığı; origin/staging Beacon'ın dört
  kombinasyonunu ve exact season boundary'yi kapsayan test eklenmeli.

### P2 — Contribution HTTP cevabı planlanan güncel war/traffic state'ini taşımıyor

- **Beklenen:** Planın Phase 5 API kontratına göre başarılı dispatch cevabı güncel planet ile
  birlikte pending/traffic ve war state döndürerek istemcinin art arda refetch yapmasını önlemeli.
- **Doğrulama:** `ClanWarContributionResult` (`apps/server/src/services/clanWar.ts:1217-1226`) ve
  `sendClanWarContribution` dönüşü yalnız contribution metadata, `planet` ve `pending` içeriyor.
  `operation`/war projection veya traffic projection alanı yok; route
  `apps/server/src/routes/clan.ts:392-408` bu sonucu aynen döndürüyor.
- **Etki:** İstemci gönderimden sonra ortak havuzu/kapasiteyi ve görünür trafiği güncellemek için ek
  istek veya SSE turu beklemek zorunda kalır; planlanan atomik UI snapshot kontratı sağlanmaz.
- **Gerekli düzeltme:** Transaction sonunda yetkili war projection ve gerekli traffic/pending
  projection'larını response'a ekle; HTTP schema/contract testinde alanları ve yeni wave'in aynı
  response'ta göründüğünü doğrula.

### P2 — İlgili mevcut server fuel regresyon grubu yeşil değil

- **Beklenen:** Yeni yakıt yolu mevcut fuel/hangar davranışlarını bozmadan eklenmeli; ilgili
  regresyon grupları Phase çıkışında yeşil olmalı.
- **Doğrulama:** `pnpm --filter @astera/server exec vitest run test/hangar.test.ts
  test/fuel.test.ts` sonucunda Hangar 21/21 geçti; fuel grubunda 18 geçti, iki settlement testi
  `INSUFFICIENT_FUEL` yoluna ulaşmadan `COLONY_CAP` ile kaldı:
  `takes the flight and the founding stock out of one store` ve
  `refuses a founding the tank cannot fly, and takes nothing for the attempt`.
- **Etki:** Mevcut server yakıt davranışının tamamı doğrulanmış değil; full verification kırmızı.
  Phase 0 pre-change kaydı bulunmadığından bu iki failure kanıtlı biçimde pre-existing sayılamaz,
  ancak doğrudan ortak savaş implementasyonundan kaynaklandığı da bu review ile iddia edilmez.
- **Gerekli düzeltme:** Fixture'ın colony-cap önkoşulu ile ürün davranışı ayrıştırılmalı; gerçek
  regresyon varsa giderilmeli, fixture eskidiyse ürün kontratını değiştirmeden güncellenmeli ve iki
  test exact beklenen fuel sonucuna kadar çalıştırılmalı.

## Phase 6 — Recall, cancel ve membership/lifecycle guard'ları

### P0 — Commander transfer aktif operasyonu sezondan koparıyor ve cross-season saldırıya izin veriyor

- **Beklenen:** Ortak savaşta coordinator, target, staging veya contributor rolündeki commander
  başka galaxy/season'a taşınamamalı; transfer ya operasyon kesinleşene kadar defer edilmeli ya da
  merkezi ve güvenli bir cancel/return akışı çalıştırmalı. Operation, player ve planet season'ları
  hiçbir anda ayrışmamalı.
- **Kök neden:** `apps/server/src/services/commanderTransfer.ts:105-131` yalnız generic mission,
  non-home unit ve kişisel event'leri blocker sayıyor; açık `clan_war_operations` rolü sorgulanmıyor.
  `apps/server/src/services/commanderTransfer.ts:178-182` clan membership'i doğrudan reconcile/close
  ediyor ve Phase 6 membership guard'ını çağırmıyor. Operation/planet/player FK'leri de aynı season
  invariantını composite olarak korumuyor. `startClanWar` controller eşleşmesini kontrol ediyor
  fakat target planet/player'ın operation season'ında kaldığını kontrol etmiyor.
- **Doğrulama 1:** Katkısız `ASSEMBLING` operasyonun tek lideri owner-requested transfer ile başka
  season'a taşındı. Sonuç `MOVED`; player ve staging yeni season'dayken operation eski season'da ve
  `ASSEMBLING` kaldı, clan disband edildi ve membership kapandı.
- **Doğrulama 2:** Ayrı reprodüksiyonda hedef commander başka season'a `MOVED` edildi. Operation eski
  season'da kalmasına rağmen leader-capital contribution `STAGED` kabul edildi ve `startClanWar`
  başarılı olarak combined mission yarattı. Kaydedilen mission'ın `season_id` değeri eski season,
  `target_planet_id` ise yeni season'a taşınmış gezegendi.
- **Etki:** Season izolasyonu fiilen aşılır. Waiting/Silent Space'teki bir commander eski galaxy'den
  saldırıya uğrayabilir; worker target ve operation'ı farklı lifecycle'lar altında settle ederek
  combat, Dominion, rapor, ownership ve season wipe verisini bozabilir. Leader transferinde staged
  escrow filoları disband edilmiş klanın eski operasyonunda mahsur kalabilir.
- **Gerekli düzeltme:** `transferCommander` source transaction'ında player'ın coordinator/target/
  contributor olduğu tamamlanmamış operation'ları kilitleyip kesin bir transfer disposition
  uygulamalı; güvenli varsayılan defer olmalı. Start/contribution ayrıca operation, staging, target,
  actor ve participant season eşitliğini authoritative olarak doğrulamalı. DB'de mümkün olan
  season-consistency invariantları composite FK/constraint ile güçlendirilmeli. Leader, target ve
  contributor için hem OUT/RETURN transferleri; empty, outbound, staged, attacking ve returning
  state'leri kapsayan regression testleri eklenmeli.

### P1 — Aktif ortak savaş reclaim/account deletion için busy sayılmıyor

- **Beklenen:** Aktif operation'da coordinator, target veya contribution sahibi olan hesap idle
  reclaim'de güvenli biçimde `deferred`, account deletion'da kontrollü `WORLD_BUSY` olmalı. Özellikle
  leader-capital katkısının mission satırı olmadığı için guard operation/contribution graph'ını
  doğrudan okumalı.
- **Kök neden:** `commanderRows` ve `busy` (`apps/server/src/services/reclaim.ts:132-288`) clan-war
  operation/contribution rollerini toplamıyor. `reclaimIdleSeats`
  (`apps/server/src/services/reclaim.ts:714-731`) ile `deleteAccount`
  (`apps/server/src/services/accountDeletion.ts:257-284`) yalnız bu generic busy sonucuna güveniyor.
  Ardından clan membership reconcile/disband edilirken ortak savaş guard'ı da çağrılmıyor; gerçek
  engel en sonda gelen `NO ACTION` FK ihlali oluyor.
- **Doğrulama:** Gerçek DB'de idle liderin `STAGED` leader-capital contribution'ı oluşturuldu; bu
  contribution'ın generic in-flight mission'ı yoktu. `reclaimIdleSeats` sonucu
  `{ reclaimed: [], deferred: 0, failed: 1 }` oldu. Aynı state'te `deleteAccount` kontrollü bir
  `GameError/WORLD_BUSY` yerine `delete from planets ...` sırasında ham query/FK hatası fırlattı;
  transaction rollback olduğu için wave kaldı.
- **Etki:** Health metriği beklenen defer yerine failure üretir ve koltuk her sweep'te yeniden hata
  verir. Kullanıcı/operatör kaynaklı account deletion 409 yerine 500'e dönüşür. FK şu an veri kaybını
  tesadüfen engelliyor; cleanup sırası düzeltildiğinde explicit guard eklenmezse aktif filoyu silme
  riski doğar.
- **Gerekli düzeltme:** `commanderRows/busy` ortak savaş rollerini tek yerde toplamalı: open operation
  leader/target, non-terminal contribution owner/origin ve ilgili clan-war mission'ları. Reclaim bu
  durumda defer etmeli, deletion aynı bilgiyle `WORLD_BUSY` vermeli; inactivity clan reconcile da
  explicit membership guard'ını atlamamalı. Her rol ve her lifecycle state'i için reclaim + deletion
  entegrasyon testleri eklenmeli; terminal history cleanup'ı Phase 2 bulgusuyla birlikte çözülmeli.

## Phase 7 — Start, quota ve combined movement

### P0 — Planet-level protection altındaki hedefe birleşik saldırı gerçekten başlatılabiliyor

- **Beklenen:** Target işaretlendikten sonra başlayan player shield veya planet occupation/recovery
  protection operasyonu iptal etmez; fakat start o anki normal saldırı gate'lerini yeniden okuyup
  launch'ı reddeder.
- **Kök neden:** `startClanWar` target satırını `apps/server/src/services/clanWar.ts:1952-1961`
  aralığında okuyor fakat `target.protectedUntil` / `target.recoveryUntil` kontrolü yapmıyor.
  `apps/server/src/services/clanWar.ts:2050-2069` içindeki `assertAttackProtections` yalnız player
  shield alanlarını kontrol ediyor. Normal saldırı yolu ise bu iki planet alanını ayrıca
  `apps/server/src/services/mission.ts:204-225` aralığında reddediyor.
- **Doğrulama:** Gerçek test DB'sinde leader-capital wave `STAGED` olduktan sonra hedef gezegenin
  `protected_until` ve `recovery_until` değerleri geleceğe alındı. `startClanWar` yine başarılı oldu,
  operation `ATTACKING` durumuna geçti ve bir combined `clan_war` mission oluşturuldu.
- **Etki:** Occupation protection ve world recovery, ortak savaş kullanılarak tamamen bypass
  edilebilir. Bu yalnız yanlış bir UI durumu değil; korunan hedefe gerçek mission gönderilir ve
  combat/loot/Dominion sonuçları üretilebilir.
- **Gerekli düzeltme:** Phase 5 bulgusundaki ortak world-protection helper'ı start'ın irreversible
  işlemlerinden önce çalıştırılmalı. `protectedUntil` ve `recoveryUntil` ayrı ayrı; exact boundary,
  mark sonrası başlayıp/biten koruma ve player shield ile öncelik sırasını kapsayan start testleri
  eklenmeli. Refusal operation'ı `ASSEMBLING` bırakmalı.

### P1 — Start sezon uygunluğunda dönüş Beacon boost'unu yok sayıyor

- **Beklenen:** Start, her contribution'ın konservatif olarak başlangıç filosunu kullansa da dönüş
  süresini planın kesin kuralına göre sahibinin snapshot teknolojisi ve dönüş planlanırken seçilen
  gerçek destination gezegenin mevcut Beacon boost'u ile hesaplamalı.
- **Kök neden:** `apps/server/src/services/clanWar.ts:2101-2108` destination'ı yüklüyor fakat
  `fleetTravelExact` çağrısına sabit `boost: 1` veriyor. Gerçek return planner ise
  `apps/server/src/services/clanWar.ts:1538-1544` aralığında destination orbit'ini okuyup Beacon'ı
  uyguluyor. Böylece start'ın gate'i kendi yaratacağı dönüşten daha yavaş hayali bir dönüş ölçüyor.
- **Doğrulama:** Staging/leader capital'de Beacon bulunan ve expiry'den bir saniye önce launch edilen
  leader-capital wave için season end, quote'un gerçek Beacon'lı earliest-home zamanından bir saniye
  sonraya ayarlandı. Quote `ok: true`, contribution `STAGED` oldu; start buna rağmen
  `CLAN_WAR_SEASON_TOO_SHORT` döndürdü. Quote combined ve return sürelerinin ikisi de
  `0.684615...` dakika, `earliestHome=00:01:31.153Z`, season end `00:01:32.153Z` idi.
- **Etki:** Tamamen geçerli, sezon bitmeden dönebilecek havuz launch edilemez; oyuncular peşin
  yakıt ödemiş ve filolarını kilitlemiş halde expiry/cancel beklemek zorunda kalır.
- **Gerekli düzeltme:** Feasibility check ile `planContributionReturn` aynı destination-selection ve
  orbit/Beacon primitive'ini kullanmalı. Original origin ile `safeHomePlanet` fallback'inin Beacon
  olan/olmayan kombinasyonları ve exact season end eşitliği test edilmeli.

### P1 — Combined mission mevcut radar/pending/traffic semantiğine bağlanmamış ve yanlış kimlik sızdırıyor

- **Beklenen:** Combined strike tek aggregate mission olarak mevcut sensor kurallarına uymalı;
  defender'ın radar warning/pending/contact yüzeyleri ordinary hostile fleet ile aynı zamanda
  görünmeli. Kimlik seviyesi açıldığında kişisel leader değil operation snapshot'ındaki
  `[TAG] Klan Filosu` görünmeli; owner listesi ve cargo sızmamalı.
- **Kök neden:** Yeni mission kind generic olarak `fleet` çizilse de hostile özel dalları yalnız
  `'attack' | 'death_star'` tanıyor:
  `apps/server/src/services/traffic.ts:1026-1035` `clan_war` için `inbound` üretmiyor,
  `apps/server/src/services/session.ts:658-680` defender pending satırını tamamen atlıyor ve
  `apps/server/src/services/traffic.ts:1143-1146` engagement moment'ini yalnız ordinary attack için
  üretiyor. Generic radar worker ise `apps/server/src/worker/handlers.ts:1562-1574` içinde staging
  gezegeninin güncel sahibini okuyarak leader username/planet/clan tag'ini yayınlıyor; operation'ın
  frozen clan identity'sini okumuyor.
- **Doğrulama:** Etkin Uplink + Radar L5 sahibi defender'a combined strike başlatıldı. Mission public
  traffic'te `fleet` ve `LIGHT` olarak vardı fakat `inbound: false`; `pendingThreads` hiç `incoming`
  satırı üretmedi. Radar event işlenince notification exact aggregate fleet'i yanında
  `originUsername: "Tester0"`, leader'ın gezegen adı/id'si ve `originClanTag: "VIS"` yayınladı;
  `[VIS] Klan Filosu` aggregate kimliği yoktu.
- **Etki:** Defender canlı incoming şeridinden hedeflenen saldırıyı göremez veya contact'a focus
  olamaz; engagement penceresinde public bombardment semantiği kaybolur. En yüksek radar seviyesinde
  ürün kararına aykırı olarak coordinator'ın kişisel kimliği ve staging gezegeni açığa çıkar.
- **Gerekli düzeltme:** Hostile-kind sınıflandırmasını ortak helper'a taşıyıp `clan_war` combined leg'i
  traffic intent, pending ve engagement yollarına ekle. Radar identity projection'ı
  `clan_war_missions → clan_war_operations` üzerinden frozen tag/name ve klan filosu label'ı
  üretmeli; support/return leg'leri yanlışlıkla hostile sayılmamalı. NONE/CONTACT/IDENTIFIED,
  Radar L3/L4/L5, Telescope, engagement ve tüm dört clan-war leg'i için fog regression testleri yaz.

### P2 — Planlanan start idempotency ve cross-lane concurrency testleri eksik

- **Beklenen:** Phase 7 test listesi aynı idempotency key ile start replay'ini, ordinary attack ile
  joint start'ın personal/clan quota yarışını ve start'ın expiry/cancel ile gerçek eşzamanlı yarışını
  doğrudan kanıtlamalı.
- **Doğrulama:** `apps/server/test/clan-war-start.test.ts` içindeki 18 test tarandı. İki eşzamanlı
  joint start testi ve start sonrasında sequential expiry testi var; HTTP/idempotency-key replay,
  normal attack + joint start concurrency veya `Promise.allSettled` ile start-vs-expiry/cancel yarışı
  yok. Ceasefire ve planet-level protection recheck testi de yok; mevcut protection testi yalnız
  `players.newcomerShieldUntil` alanını kapsıyor.
- **Etki:** Kodun advisory-lock ve operation-lock sırası önemli olsa da en riskli cross-lane yarışlar
  regression korumasız. Planet protection bypass'ı bu coverage boşluğu içinde yeşil suite ile geçti.
- **Gerekli düzeltme:** Planın exact race matrisini bariyer/advisory-lock kontrollü entegrasyon
  testleriyle ekle; yalnız iki promise'i rastgele başlatmayı concurrency kanıtı sayma. HTTP aynı-key
  replay'in tek mission, tek commitment seti ve aynı response ürettiğini de doğrula.
