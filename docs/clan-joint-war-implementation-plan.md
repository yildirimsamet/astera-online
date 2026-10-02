# Klan Ortak Savaşı — Karar-Tamamlanmış Uygulama Planı

> Durum: Uygulamaya hazır handoff belgesi  
> Hedef okuyucu: Bu sohbeti ve önceki kararları hiç görmemiş uygulayıcı agent  
> Kapsam: Plan ve kabul kriterleri; bu belge ürün kodunu uygulamaz  
> Son doğrulama tarihi: 2026-09-20

## 1. Amaç

Astera Online'a, bir klanın üyelerinin sahipliği kendilerinde kalan filolarını liderin
başkentinde geçici olarak birleştirip tek bir yabancı oyuncu gezegenine saldırabildiği
**Klan Ortak Savaşı** sistemi eklenecek.

Sistem mevcut şu kuralları değiştirmeden genişletmelidir:

- normal tek oyunculu saldırılar;
- mevcut Combat RNG ve üç turlu savaş çözümü;
- Radar/Teleskop bilgi sisi;
- kişisel Hangar ve uçuş yuvası hesapları;
- saldırı koruması, recovery shield, ateşkes ve bash limitleri;
- mevcut battle report gizlilik sınırları;
- Dominion'un sıfır toplamlı olması;
- normal klan baskınlarının olgun üyelere dağıttığı `%10` ganimet payı.

Ortak savaş yeni bir normal saldırı türü gibi davranmamalıdır. Bir operasyon; hedefleme,
desteklerin staging'e taşınması, liderin başlatması, birleşik savaş ve sahip bazlı dönüşlerden
oluşan ayrı ve kalıcı bir durum makinesidir.

## 2. Çalışma Kuralları

Uygulayıcı agent çalışmaya başlamadan önce kökteki `CLAUDE.md` dosyasını tamamen okumalıdır.
Oradaki TDD, tasarım, güvenlik ve doğrulama kuralları bu belgeden üstündür.

Zorunlu çalışma biçimi:

1. Her davranış değişikliği için önce test yaz/güncelle ve hedefli testin gerçekten kırmızı
   olduğunu gör.
2. Yalnızca kırmızı testi geçirmek için gereken minimum uygulamayı yap.
3. İlgili hedefli testleri yeşile getir.
4. Fazın sonunda typecheck/lint ve etkilenen paket testlerini çalıştır.
5. Bütün fazlar sonunda `pnpm verify` çalıştır.
6. UI değişikliklerini gerçek mobil genişlikte `node tools/visual.mjs` ile doğrula.
7. Mevcut normal saldırı kodunu ortak savaş adına geniş çaplı refactor etme. Yalnızca ortak
   ve tekil savaşın gerçekten paylaştığı saf çekirdeği çıkar.
8. Migration üretmeden önce `git status --short`, mevcut Drizzle journal ve son migration
   numarasını tekrar kontrol et. Başkasının değişikliğini silme veya üzerine yazma.

## 3. Kesin Ürün Kararları

Bu bölümdeki kararlar yeniden sorulmayacak ve uygulayıcı tarafından farklı yorumlanmayacaktır.

### 3.1 Rollout ve sezon

- Özellik yalnızca **yeni ruleset ile oluşturulan sezonlarda** açık olacak.
- `MULTI_WORLD.rulesetVersion` artırılacak ve ayrıca açık bir
  `clanJointWarRulesetVersion` eşiği tanımlanacak.
- Mevcut sezonlara backfill yapılmayacak; eski sezonların klanları, savaşları, raporları ve
  Dominion semantiği değişmeyecek.
- Migration sonrası eski ruleset clan satırlarında `level = null` kalır; public API bu sezonlarda
  level/progression göstermez ve bütün treasury/war mutation'ları feature-gate hatası verir.
- Klanlar mevcut veri modelinde sezonluk olduğu için klan seviyesi ve hazinesi de sezonluktur.
- Yeni ruleset'teki her klan seviye `1`, boş hazine ile başlar; en yüksek seviye `10`dur.
- Hedef 24 saat geçerli olduğundan sezonun açık kalacağı süre 24 saatten azsa yeni hedef
  işaretlenemez.

### 3.2 Klan seviyesi ve hazinesi

- Klan seviyesi `1..10` arasındadır ve Klan Hangarı kapasitesini otomatik belirler.
- Bir üst seviyenin maliyeti aynı mevcut seviyedeki normal Hangar yükseltme maliyetinin tam
  kendisidir; kapasite iki kat diye maliyet ikiyle çarpılmaz.
- Her aktif üye, üyelik olgunluğundan bağımsız olarak seçtiği ve kontrol ettiği herhangi bir
  gezegenden Alloy, Crystal ve Deuterium için kısmi bağış yapabilir.
- Hazine sınırsız banka değildir. Her kaynak bakiyesi yalnızca bir sonraki seviye maliyetindeki
  ilgili kaynak miktarına kadar dolabilir. Bu sınırı aşan istek tamamen reddedilir; sessiz kırpma
  yapılmaz.
- Seviye 10'da bir sonraki maliyet olmadığı için bağış ve yükseltme kapalıdır.
- Yalnız aktif lider, hazine exact maliyeti karşıladığında seviyeyi anında yükseltebilir.
- Bağış geri çekilemez; üye ayrıldığında veya atıldığında pay/iade alamaz.
- Klan disband edilirse kalan hazine açık kullanıcı onayıyla yakılır ve immutable audit'e yazılır.
- Klan seviyesi public clan profile/leaderboard'da görünür. Hazine ile kullanılan/rezerve/toplam
  Klan Hangarı kapasitesi yalnız aktif klan üyelerine görünür.

### 3.3 Hedef ve staging

- Yalnızca aktif klan lideri hedef işaretleyebilir.
- Hedef, klan dışındaki gerçek bir oyuncunun keşfedilmiş gezegenidir; neutral, pirate,
  asteroid veya klan arkadaşı hedef olamaz.
- Lider hedefi Galaxy Focus panelindeki `Klan hedefi yap` eyleminden seçer.
- Aynı klan için aynı anda yalnızca bir tamamlanmamış operasyon bulunabilir.
- Hedef işaretlendiği anda liderin o anki korunan `CAPITAL` gezegeni staging gezegeni olarak
  snapshot edilir. Lider sonradan başka dünya elde etse bile staging değişmez.
- Hedef bilgisi olarak klana yalnızca hedef oyuncu/gezegen kimliği ve koordinatlar paylaşılır.
  Liderin probe, Telescope veya Radar istihbaratı paylaşılmaz.
- Aktif hedef ve kalan süre, olgunluk durumundan bağımsız olarak bütün aktif klan üyelerinin
  War sekmesinde görünür; olgunlaşmamış üye görür fakat katkı yapamaz.
- Hedef işaretlemek savunmacıya bildirim göndermez.
- Hedef tam 24 saat geçerlidir. Bu sürede savaş başlamazsa operasyon otomatik iptal edilir.
- Start için son an `expiresAt` değerinden kesin olarak öncedir (`now < expiresAt`). Zamanında
  başlayan birleşik saldırı, target timer yolculuk sırasında dolsa bile normal biçimde devam eder.
- Eski operasyonun iptal/savaş sonrası bütün dönüşleri `HOME` veya `LOST` olmadan yeni hedef
  işaretlenemez.

### 3.4 Katılım

- Lider dahil yalnızca üyelik olgunluğu 12 saati tamamlamış aktif üyeler katılabilir.
- Üye birden fazla katkı gönderebilir; aynı gezegenden birden fazla dalga da gönderilebilir.
- Her dalga ayrı yakıt, teknoloji, durum, recall ve sonuç kaydıdır.
- Katkı, mobil ve saldırıda kullanılabilen gemilerden oluşur. Kara birlikleri ve Prospector
  gönderilemez.
- Tek bir katkı yalnızca support/cargo gemilerinden oluşabilir; fakat lider savaşı başlatırken
  aktif birleşik havuzda en az bir combat hull bulunmalıdır.
- Her katılımcı kendi maksimum Core-türetilmiş gelişim kademesi bakımından hedefin mevcut
  `±1` saldırı bandında olmalıdır. Bu kontrol katkıda ön kontrol, başlatmada kesin kontroldür.
- Katkı quote/dispatch sırasında tier, mevcut target protection, ceasefire ve personal/clan bash
  uygunluğu ön kontrol edilir; kota bu aşamada tüketilmez. Hepsi start transaction'ında yeniden
  kontrol edilir ve kota yalnız başarılı start'ta tüketilir.
- Katkının sahibi savaş teknolojisini katkı gönderildiği anda snapshot eder. Başka oyuncunun
  veya liderin teknolojisi o gemilere uygulanmaz.

### 3.5 Hangar ve uçuş yuvası

- Klan Hangarı normal kişisel Hangardan bağımsız bir ortak kapasite sınırıdır.
- Katkıdaki gemiler, eve dönene veya yok olana kadar sahibinin kişisel Hangar kullanımında
  sayılmaya devam eder; katkı göndermek oyuncuya kişisel kapasite açmaz.
- Fiziksel katkı, çıkış gezegenindeki normal uçuş yuvasını bütün yaşam döngüsü boyunca tutar:
  staging'e gidiş, bekleme, birleşik saldırı ve eve dönüş. Gemi yok olursa yuva savaş
  çözüldüğünde serbest kalır; survivor varsa eve indiğinde serbest kalır.
- Liderin staging başkentinden anlık eklediği katkı uçuş yuvası kullanmaz.
- Klan Hangarı rezervasyonu katkı kabul edilirken alınır. Recall emri verilen katkı artık
  savaş havuzuna ait değildir, rezervasyonu hemen bırakır ve savaşı başlatmayı engellemez.
- Kapasite gemi adedi veya ekonomik değerle değil normal kişisel Hangar'ın kullandığı mevcut
  `hangarLoad`/mobile bulk birimiyle ölçülür.

Kesin kapasite tablosu:

| Klan seviyesi | Klan Hangarı kapasitesi |
|---:|---:|
| 1 | 160 |
| 2 | 360 |
| 3 | 940 |
| 4 | 1.620 |
| 5 | 3.100 |
| 6 | 4.580 |
| 7 | 6.500 |
| 8 | 8.800 |
| 9 | 11.480 |
| 10 | 14.540 |

### 3.6 Lider katkısı

- Liderin yalnızca staging olarak snapshot edilen başkentteki filosu anlık eklenip çıkarılır.
- Bu işlemde cooldown, seyahat süresi, yakıtın staging bacağı, uçuş animasyonu ve flight bay
  yoktur.
- Liderin kolonilerindeki filolar diğer üyeler gibi fiziksel destek uçuşu yapar.
- Lider hiç filo eklemeden savaşı başlatabilir. Bu durumda:
  - kişisel bash kotasına bir saldırı yazılır;
  - saldırı koruması açık onay ile düşer;
  - lider active attacker sayısına, ganimete ve oyuncu Dominion paylaşımına girmez;
  - koordinatör olarak savaş raporunu görür.
- Lider filoyla katılıyorsa kota ve koruma bedeli iki kez uygulanmaz.

### 3.7 Recall, iptal ve üyelik

- Savaş başlamadan önce oyuncu yalnızca kendi katkısını recall edebilir.
- Henüz staging'e varmamış recalled filo uzayda dönmez: önce lider başkentine ulaşır, sonra
  fiziksel dönüşe başlar.
- Staging'deki recalled destek lider başkentinden çıkış gezegenine fiziksel döner.
- Liderin başkent katkısı anında havuzdan çıkar.
- Recall emri verilen inbound katkı başlatmayı engellemez.
- Lider iptal ederse veya hedef süresi dolarsa aynı merkezi iptal akışı kullanılır ve bütün
  aktif destekler sahiplerine döner.
- Staging'deki katkılar izole escrow'dur: lider başkentini savunmaz ve o gezegene yapılan
  baskında hedef alınmaz.
- Katkısı bulunan oyuncu, savaş/iptal/expiry sonucu kesinleşene kadar klandan ayrılamaz ve
  atılamaz. Liderlik devri ve klan disband işlemi de bu süre boyunca engellenir.
- Bu membership kilidi contribution recall edilmiş veya eve dönmüş olsa bile operation hâlâ
  `ASSEMBLING` ise sürer; guard yalnız aktif contribution status'larına değil operation içindeki
  tarihsel contributor varlığına bakar.
- Sonuç kesinleştikten sonra fiziksel dönüş sürse bile üyelik işlemleri açılır; dönüşler
  snapshot sahipliği ile devam eder. Ancak yeni hedef için bütün dönüşler bitmelidir.
- Katılımcı olmayan üyeler ayrılabilir/atılabilir. Yeni üyeler 12 saat olgunlaştıktan sonra
  devam eden `ASSEMBLING` operasyona katılabilir.

### 3.8 Yakıt

- Yakıt katkı ilk gönderildiğinde peşin alınır, iade edilmez ve hiçbir sonraki adımda tekrar
  alınmaz.
- Üye veya lider kolonisi katkısı üç bacağı ayrı ayrı yuvarlayarak öder:
  `çıkış → staging`, `staging → hedef`, `hedef → özgün çıkış`.
- Lider staging başkenti katkısı iki bacağı öder:
  `staging → hedef`, `hedef → staging`.
- Her bacağın yakıtı mevcut `missionFuel(fleet, distance, 1)` semantiğiyle ayrı hesaplanır;
  toplam için mevcut `missionFuelForDistances` kullanılmalıdır.
- Recall/iptal/expiry rotası ön ödemeli rotadan kısa veya uzun olsa bile iade/ek tahsilat yoktur.
- Recall edilen veya lider tarafından anlık çıkarılan gemiler daha sonra yeniden gönderilirse bu
  yeni bir contribution'dır; yeni teknoloji snapshot'ı, yeni idempotency boundary ve yeni tam yakıt
  tahsilatı oluşur. Eski contribution'ın yakıtı yeni gönderime kredi edilmez.
- Gönderim sırasında yakıt düşümü, gemi ayırma, bay tutma, kapasite rezervasyonu ve görev
  oluşturma aynı transaction'da yapılır.
- Fiziksel katkı ancak staging'e hedef süresi dolmadan ulaşabiliyorsa ve en kötü iptal senaryosunda
  (`expiresAt + staging→origin return travel`) sezon bitmeden eve dönebiliyorsa kabul edilir.
  Ayrıca dispatch anında hemen staging'e varıp hemen savaş başlasa battle-return'ün sezon içinde
  bitebilmesi gerekir; aksi halde katkı baştan reddedilir.
- Start, o andaki birleşik saldırı süresi ve her katkının başlangıç filosundan konservatif dönüş
  süresiyle bütün muhtemel return completion zamanlarını yeniden hesaplar. Her biri sezon sonundan
  önce değilse start reddedilir. Quote `latestStartAt` ve `canFinishBeforeSeasonEnd` döndürür.
- Fiziksel katkı gönderildiğinde; lider başkent katkısı ise anlık eklendiğinde saldırı
  koruması mevcut acknowledgement davranışıyla düşer.

### 3.9 Savaş ve dönüş

- Aktif `OUTBOUND` katkı varsa başlatma reddedilir ve kullanıcıya
  `Destek filosu geliyor, bekleyin.` gösterilir.
- Başlatma operasyonu kilitler. Bundan sonra katkı, çıkarma veya recall yapılamaz.
- Birleşik saldırının hızı, her katkının kendi snapshot teknolojisiyle hesaplanan etkili
  hızlar arasındaki en yavaş gemiye göre belirlenir.
- Support outbound süresi çıkış gezegeninin dispatch anındaki mevcut Beacon boost'uyla;
  birleşik saldırı staging başkentinin start anındaki mevcut Beacon boost'uyla hesaplanır.
  Dönüş süresi sahibin snapshot teknolojisini ve dönüş planlanırken özgün varış gezegenindeki
  mevcut Beacon boost'unu kullanır. Beacon, başka oyuncunun savaş teknolojisini devralma yolu
  değildir.
- Combat sonucu mevcut RNG, üç tur, counter, Aegis, support shielding, grade, defence salvage
  ve wreck kurallarıyla belirlenir.
- Her geminin sahibi ve katkısı savaş boyunca korunur.
- Savaş sonunda survivor'lar katkı/owner bazında hedef gezegenden doğrudan özgün çıkış
  gezegenine döner. Ortak filo tekrar staging'de toplanmaz.
- Özgün gezegen artık oyuncuda değilse mevcut `safeHomePlanet` fallback'i uygulanır; ek yakıt
  alınmaz veya iade yapılmaz.
- Dışarıdan birleşik saldırı `[TAG] Klan Filosu` kimliğiyle görünür. Sensor seviyesinin izin
  verdiği mass/silhouette/fleet dışında rota, sahip listesi veya kargo sızdırılmaz.

### 3.10 Ganimet ve salvage

- Önce mevcut `computeLoot` ile, bütün survivor katkıların kendi teknoloji snapshot'larıyla
  hesaplanan toplam cargo kapasitesine göre tek toplam yağma hesaplanır.
- Yağma yalnızca survivor cargo kapasitesi pozitif olan farklı katılımcılar arasında
  **max-min fair allocation** ile dağıtılır:
  - eşitlik mevcut `computeLoot` gibi ham cargo birimiyle ölçülür; bir Alloy, Crystal veya
    Deuterium bir cargo birimidir;
  - herkesin toplam taşıdığı kaynak birimi eşit yükseltilir;
  - kapasitesi dolan oyuncu çıkarılır;
  - kalan diğerlerine yeniden dağıtılır;
  - her oyuncunun bundle'ı toplam yağmanın kaynak kompozisyonunu mümkün olan en yakın tamsayı
    oranında korur;
  - tam sayı artıkları sabit kaynak sırası ve deterministik largest-remainder ile dağıtılır;
  - toplam dağıtım, hesaplanan toplam yağmayla tam eşit olur; mint/burn olmaz.
- Bir oyuncunun birden fazla dönüş dalgası varsa oyuncu payı, survivor dalgaların cargo
  kapasitelerine göre aynı deterministik yöntemle fiziksel dönüş görevlerine bölünür.
- Survivor veya cargo kapasitesi olmayan oyuncu ganimet alamaz.
- Normal klan raid'lerindeki `%10` clan loot share ortak savaşta uygulanmaz.
- Garbage Collector salvage yağmadan ayrıdır. Lift edilen salvage, her sahibin savaş sonrası
  hayatta kalan Garbage Collector lift kapasitesi oranında; eşit fractional durumda player UUID
  ve contribution UUID ile deterministik dağıtılır. Kalan wreck mevcut public debris alanına yazılır.

### 3.11 Dominion oranı

- Oran gemi/dalga sayısından değil savaşa en az bir gemiyle giren farklı oyuncu sayısından
  hesaplanır.
- `A`: farklı aktif saldırgan sayısı. Aynı oyuncunun çoklu dalgaları bir kez sayılır;
  filosuz lider sayılmaz.
- `D`: farklı savunan oyuncu sayısı. Mevcut gezegen savaşı modelinde `D = 1`, fakat audit
  alanı geleceğe dönük olarak ayrıca saklanır.
- Önce mevcut formülle taban transfer hesaplanır:
  `R = loot value + defender permanent loss - attacker permanent loss`.
- Yalnızca saldırgan sayısal üstünse (`A > D`) düzeltme uygulanır:
  - `R > 0`: `adjusted = trunc(R * D / A)`;
  - `R < 0`: `adjusted = trunc(R * A / D)`;
  - `R = 0`: `adjusted = 0`.
- Örnek 3:1'de saldırgan kazanırsa pozitif takım kazancı üçe bölünür; savunmacı kazanırsa
  savunmacının pozitif transferi üç kat büyür.
- Savunmacı ledger değişimi saldırgan takım toplamının tam tersidir; player ve clan
  Dominion daima sıfır toplamlıdır.
- Katılımcı ham ağırlığı: kendisine ayrılan loot değeri + verdiği doğrulanmış hull damage'e
  düşen defender permanent loss − kendi permanent loss değeridir.
- Oyuncu payları takımın `adjusted` toplamına normalize edilir. Tamsayı kalanı player UUID
  sırasıyla deterministik largest-remainder yöntemiyle dağıtılır.
- Base değer, `A:D`, adjusted transfer ve kişi payları immutable audit olarak saklanır.
- Recovery shield yakın dönem kâr/zarar hesabı her katılımcının kendi loot ve kayıp payını
  görür; eski raporlar yeniden fiyatlanmaz.

## 4. Hedef Mimari ve Veri Modeli

### 4.1 Saf rules katmanı

`packages/rules` içinde ortak savaşın storage veya HTTP bilmeyen fonksiyonlarını ekle:

- `clanHangarCapacity(level)`:
  `2 * hangarCapacity(level)`, level `1..10`; geçersiz level mevcut rules yaklaşımıyla fail.
- `clanLevelUpgradeCost(currentLevel)`:
  normal Hangar'ın `buildingCost('HANGAR', currentLevel)` sonucunu kullanır; maliyet tablosunu
  kopyalamaz.
- `jointWarFuel(fleet, distances)`:
  `missionFuelForDistances` delegasyonu veya doğrudan onu çağıran isimli wrapper; ikinci yakıt
  formülü yazma.
- `allocateJointLoot(totalLoot, participants)`:
  owner ve contribution dağılımı için deterministik, conservation/capacity garantili saf fonksiyon.
- `adjustJointDominion(base, attackers, defenders)` ve
  `allocateJointDominion(adjusted, weights)`:
  safe-integer/BigInt ara işlemleriyle yukarıdaki formülü uygular.
- `resolveJointCombat(attackerStacks, defender, shield, rng, defenderTech)`:
  her attacker stack `{ contributionId, playerId, fleet, tech }` taşır; tek stack için mevcut
  `resolveCombat` aggregate sonucuyla aynı RNG çağrı sayısını ve aynı sonucu üretir.

Combat genişletmesi için gereken minimum iç refactor:

- `resolveCombat` public API'sini kırma.
- Mevcut resolver'ın RNG ve round sırasını koruyan ortak internal çekirdek çıkar.
- Attack damage her stack'in kendi tech stat'larıyla toplanır.
- Defender'ın karşı hasarı owner+hull stack'lere mevcut HP ağırlığı ve fractional carry
  davranışını koruyarak uygular.
- Support shielding bütün birleşik saldıran taraf için ortaktır: herhangi bir sahibin combat hull'ı
  hayattaysa bütün allied support hull'lar mevcut resolver'daki gibi hedef dışı kalır. Combat line
  kalmadığında bütün support hull'lar target pool'a girer. HP ve casualty eşiği yine hedef stack
  sahibinin kendi tech snapshot'ından gelir.
- Tur başına tek attacker roll korunur. Her contribution'ın defender hull türüne verdiği damage ayrı
  hesaplanıp toplanır; Nullifier shield-only bonusu da kendi sahibinin tech'iyle hesaplanır.
- Aegis'in global pass ratio'su contribution damage'larına orantılı uygulanır. Dominion attribution
  için credited hull damage, ilgili turdaki kalan targetable effective HP'yi aşarsa bütün attacker
  contribution'ları aynı oranda aşağı ölçeklenir; overkill Dominion ağırlığı üretmez.
- Round aggregate telemetry mevcut şekli korur; ek per-stack kayıp/hasar sonucu ortak savaş
  katılımcı sonucuna gider.
- Support shielding/cargo hull'ları ve hiç ateş etmeyen gemiler casualty dağılımında mevcut
  semantiği korur.

### 4.2 Schema değişiklikleri

Yeni migration expand-only olacak. Postgres enum değerleri yalnızca sona eklenecek; mevcut enum
sırası değiştirilmeyecek.

#### `clans` ek alanları

- `level integer` nullable, check `level is null or level between 1 and 10`. Migration eski clan
  satırlarını null bırakır; yeni joint-war ruleset'te `createClan` açıkça `1` yazar.
- `treasury_alloy`, `treasury_crystal`, `treasury_deuterium`: Drizzle
  `bigint(..., { mode: 'number' })`; non-negative ve JS safe integer sınırında.

#### `clan_treasury_events`

Immutable audit tablosu:

- `id`, `season_id`, `clan_id`;
- `actor_player_id` nullable yalnız sistem/disband yakması için;
- `source_planet_id` nullable;
- `kind`: `DONATION | LEVEL_UP | DISBAND_BURN`;
- signed resource delta ve `level_before/level_after`;
- `idempotency_key` veya mutation receipt bağı;
- `created_at`;
- resource delta/level tutarlılığı için CHECK'ler.

Cached treasury bakiyesi ile event toplamının her request'te toplanması gerekmez; audit testleri
seçili işlemlerde ikisinin uyumunu doğrular.

#### `clan_war_operations`

Alanlar:

- `id`, `season_id`, `clan_id`;
- `leader_player_id`, `staging_planet_id`;
- `target_planet_id`, `target_player_id` ve rapor için hedef adı/koordinat snapshot'ı;
- klan adı/tag snapshot'ı;
- `status`: `ASSEMBLING | ATTACKING | RETURNING | COMPLETED`;
- `close_reason`: nullable `BATTLE | LEADER_CANCEL | EXPIRED | TARGET_CHANGED | FAILED`;
- `created_at`, `expires_at`, `started_at`, `resolved_at`, `completed_at`;
- mission id operation üzerinde tekrar tutulmaz; bütün leg bağlantıları `clan_war_missions`
  relation'ından okunur;
- `attacker_score_clan_id` ve `defender_score_clan_id` nullable snapshot alanları;
- optimistic revision alanı ekleme; concurrency otoritesi row lock ve state predicate'leridir.

Constraint/index:

- `expires_at = created_at + 24h` servis invarianti ve `expires_at > created_at` CHECK;
- clan başına `status <> COMPLETED` partial unique index;
- season/status/expiry worker indeksi;
- hedef ve staging FK'leri;
- close timestamps/state tutarlılığı CHECK'leri.

#### `clan_war_contributions`

- `id`, `operation_id`, `season_id`, `clan_id`;
- `player_id`, `origin_planet_id`;
- `fleet` başlangıç snapshot'ı ve `tech` snapshot'ı;
- `fuel_paid` ve typed JSON `fuel_legs: Array<{ leg, distance, fuel }>`; allowed leg adları
  contribution source türüne göre doğrulanır ve `fuel_paid = sum(fuel_legs.fuel)` servis
  invarianti/testidir;
- `unit_location` benzersiz opaque değer;
- `status`: `OUTBOUND | STAGED | RECALL_ORDERED | IN_BATTLE | RETURNING | HOME | LOST`;
- `reserved_bulk`;
- bütün mission bağlantıları yalnız `clan_war_missions` relation'ından okunur; contribution
  tablosuna tekrarlı mission-id kolonları eklenmez;
- `sent_at`, `staged_at`, `recalled_at`, `battle_at`, `return_at`, `resolved_at`;
- sonuç snapshot'ları: losses, survivors, allocated loot, allocated salvage, personal Dominion;
- lider-capital instant katkısını belirten boolean/source kind.

Her contribution tek bir başlangıç filosudur; update ile yeni gemi eklenmez. Oyuncu ek filo için
yeni contribution oluşturur. Bu, yakıtın ve idempotency'nin sınırını kesin tutar.

#### `clan_war_missions`

- `mission_id` PK/FK;
- `operation_id`;
- `contribution_id` nullable: birleşik attack aggregate mission'da null, bireysel bacaklarda dolu;
- `leg`: `SUPPORT_OUT | SUPPORT_RETURN | COMBINED_ATTACK | BATTLE_RETURN`;
- partial unique `(operation_id, leg)` where `contribution_id is null`, aggregate
  `COMBINED_ATTACK` tekrarını engeller;
- unique `(contribution_id, leg)` where `contribution_id is not null`, aynı contribution için aynı
  support/return bacağının ikinci kez yaratılmasını engeller.

`mission_kind` enum'una append-only `clan_war` ekle. Ayrı leg relation'ı sayesinde enum'u her
bacak için şişirme.

#### Rapor ve Dominion audit tabloları

- `battle_reports` mevcut aggregate alanlarını korur; `clan_war_operation_id` nullable ve unique
  ilişki olarak eklenir. `mission_id` yine birleşik saldırı mission'ını gösterir. Böylece mevcut
  PLAYER/PIRATE exact-one binder CHECK'i değiştirilmez; normal raporda
  `clan_war_operation_id` null olur.
- `clan_war_participant_results`: operation/report/player başına tek aggregate satır; sent/lost/
  survivor fleet toplamı, loot, salvage, damage contribution, Dominion weight/delta ve coordinator
  olmayan participant kimliğini tutar. `(operation_id, player_id)` unique olur.
- Dalga/origin seviyesindeki sent/lost/survivor, loot, salvage ve canlı return status zaten
  `clan_war_contributions` sonuç alanlarında tutulur; aynı sonucu ikinci bir contribution-result
  tablosunda tekrar etme.
- Ortak raporun aggregate attacker fleet/losses alanları eski istemcilerin okuyabileceği toplam
  değerleri taşır.
- Ortak savaş Dominion audit'i mevcut tek-attacker `dominion_events` satırına sıkıştırılmayacak.
  Yeni `clan_war_dominion_events` tablosu `operation_id`, `report_id`, `player_id`,
  `role = ATTACKER | DEFENDER`, taban/düzeltilmiş audit alanları ve stored player delta'yı taşır.
  `(operation_id, player_id, role)` unique olur. Normal `dominion_events` ve eski constraint
  semantiği değişmez.

#### Unit location stratejisi

- `units` PK `(planetId, hull, location)` olduğundan aynı kökenden çoklu dalgayı aynı location'a
  koyma.
- Her contribution için benzersiz opaque `location` kullan; `ownerPlayerId` gerçek sahibi olarak
  kalır.
- Unit row her aşamada `origin_planet_id` üzerinde, contribution'a özel `location` ile kalır;
  hareket ve staging durumu relation/contribution metadata'sından okunur. Böylece kişisel Hangar ve
  wealth gemiyi sayar, staging savunmasına girmez. Mevcut bir query yalnız belirli mission-id
  locations'ını sayıyorsa o query contribution locations'ı kapsayacak kadar genişletilir; gemiler
  hiçbir aşamada staging `home` stack'ine birleştirilmez.

### 4.3 State machine invariants

Geçerli geçişler:

```text
Operation:
  create -> ASSEMBLING
  ASSEMBLING -> ATTACKING     (leader start)
  ASSEMBLING -> RETURNING     (cancel / expiry / target drift)
  ATTACKING  -> RETURNING     (battle settled or launch failure recovery)
  RETURNING  -> COMPLETED     (all contributions HOME or LOST)

Contribution:
  physical: OUTBOUND -> STAGED -> IN_BATTLE -> RETURNING -> HOME
  instant:  STAGED -> IN_BATTLE -> RETURNING/HOME
  recall while outbound: OUTBOUND -> RECALL_ORDERED -> RETURNING -> HOME
  recall while staged: STAGED -> RETURNING -> HOME
  destroyed in combat: IN_BATTLE -> LOST
```

Kurallar:

- Terminal contribution tekrar hareket ettirilemez.
- `ATTACKING` sonrasında recall/add/remove yoktur.
- Operation `COMPLETED` yalnız bütün contributions terminal olduğunda yazılır.
- Cancel/expiry/target-drift anında hiç contribution yoksa operation aynı transaction'da
  `RETURNING` üzerinden `COMPLETED` yapılır; boş operasyon yeni hedefi gereksiz yere kilitlemez.
- Hiç survivor yoksa savaş settlement transaction'ında katkı `LOST` olur ve bay serbest kalır.
- Lider instant survivor'ı hedef dönüş süresinden sonra normal `BATTLE_RETURN` mission ile staging
  başkentine iner; sadece staging'e ekleme/çıkarma anlıktır, savaştan dönüş anlık değildir.
- Lider iptal/expiry öncesinde başkent katkısı fiziksel dönüş yapmadan `HOME` olur.

## 5. Public API Sözleşmesi

Tüm mutation route'ları strict Zod, auth ve mevcut `idempotentMutation` deseni kullanır.
Idempotency header zorunluluğu mevcut clan mutation helper ile uyumlu olmalıdır.

### 5.1 Read

#### `GET /api/clan/war`

Aktif üye için döner:

- `available`: ruleset feature gate;
- public clan level;
- private treasury, next level exact cost, max-level flag;
- hangar `{ used, reserved, total }`;
- operasyon yoksa `operation: null`;
- operasyon varsa target identity/coordinates, staging, timestamps/state/close reason;
- contribution listesi: yalnız klan üyelerine gerekli owner/origin/fleet/status/ETA/recall bilgisi;
- leader actions ve caller actions için server-authoritative capability/reason alanları;
- `serverNow` veya mevcut clock yaklaşımıyla countdown için otorite;
- `RETURNING` aşamasındaki bütün dönüş durumları.

Klan dışı caller bu private endpoint'ten hazine/operasyon alamaz. Public clan profile yalnız `level`
ekler; eski ruleset'te `level: null`, yeni ruleset'te `1..10` olur. Treasury/capacity/target
yayınlamaz.

### 5.2 Treasury

#### `POST /api/clan/treasury/donate`

Body:

```ts
{
  planetId: UUID;
  resources: { alloy: int; crystal: int; deuterium: int };
}
```

- Aktif üyelik gerekir, maturity gerekmez.
- Planet caller tarafından kontrol edilmeli ve operasyonel olmalı.
- En az bir kaynak pozitif olmalı.
- Gezegen ve clan row kilitlenir; kaynak düşümü, treasury artışı ve event audit atomiktir.
- Sonuç güncel planet view ve treasury/next-cost döndürür.

#### `POST /api/clan/level/upgrade`

Body: `{ expectedLevel: int }`.

- Yalnız lider.
- Exact maliyet yoksa reddet.
- Concurrent request beklenmeyen level'ı satın alamaz.
- Başarılı sonuç level, treasury, capacity ve event timestamp döndürür.

### 5.3 Target lifecycle

#### `POST /api/clan/war/target`

Body: `{ targetPlanetId: UUID }`.

- Lider, ruleset, tek operasyon, season horizon, discovered target, foreign player, hostility,
  target protection ve lider tier eligibility kontrol edilir.
- Staging capital snapshot edilir.
- Expiry scheduled event aynı transaction'da yazılır.
- Target owner'a notification gönderilmez.

#### `POST /api/clan/war/cancel`

Body `{}`.

- Yalnız lider ve yalnız `ASSEMBLING`.
- Operation `RETURNING/LEADER_CANCEL` olur; her contribution için merkezi return planner çağrılır.

Mevcut `POST /api/clan/disband` body sözleşmesi de genişletilir:

- hazine sıfırken mevcut boş body kabul edilebilir;
- hazine pozitifken `{ acknowledgeTreasuryBurn: true }` zorunludur;
- aktif ortak savaşın sonucu kesinleşmemişse acknowledgement olsa bile disband reddedilir;
- yakılan exact bakiye treasury audit event'ine yazılır.

### 5.4 Contribution

#### `POST /api/clan/war/contributions/quote`

Body:

```ts
{
  originPlanetId: UUID;
  fleet: MobileFleet;
}
```

Response:

- eligibility ve kesin refusal codes;
- staging/target leg distance;
- bacak bazında fuel ve total fuel;
- staging ETA, tahmini combined leg süresi ve tahmini earliest home;
- flight bay used/total/available;
- personal Hangar used/total ve katkı sonrası değişmediğine ilişkin gösterim verisi;
- clan capacity used/reserved/total ve bu fleet'in bulk'ı;
- origin fuel sufficiency;
- season finish feasibility;
- shield-loss acknowledgement requirement;
- instant leader contribution flag.

Quote karar vermez; launch bütün kontrolleri transaction içinde tekrarlar.

#### `POST /api/clan/war/contributions`

Body:

```ts
{
  originPlanetId: UUID;
  fleet: MobileFleet;
  acknowledgeShieldLoss: boolean;
}
```

- Contribution record sınırıdır; aynı body+idempotency tekrarında yeni wave/yakıt oluşmaz.
- Support-only katkı kabul edilir; combined combat hull kontrolü start'a bırakılır.
- Lider staging capital ise `STAGED`, diğerleri `OUTBOUND` başlar.
- Response güncel planet, pending/traffic ve war state döndürerek istemcide waterfall'ı önler.

#### `POST /api/clan/war/contributions/:id/recall`

- Caller yalnız kendi contribution'ını recall eder.
- `OUTBOUND` ise `RECALL_ORDERED`; `STAGED` ise return mission yaratılır; leader instant ise HOME.
- Tekrarlı recall HTTP 200 ile mevcut contribution/return state'ini döndürür; ikinci return mission
  yaratmaz ve hata sayılmaz.

### 5.5 Start

#### `POST /api/clan/war/start`

Body: `{ acknowledgeShieldLoss: boolean }`; bu alan yalnız filosuz liderin koruması düşecekse
gerekli, fakat schema her zaman boolean kabul edebilir.

Start transaction'ı:

1. Season, staging/target planet, clan/operation ve participant player'ları sabit sırada kilitle.
2. Inline expiry/target drift kontrolü yap; gerekiyorsa start yerine merkezi cancel uygula.
3. Leader, target, protection, ceasefire, tier, membership maturity ve her participant eligibility
   kontrollerini yenile.
4. `OUTBOUND` varsa spesifik `CLAN_WAR_SUPPORT_INBOUND` reddi ver.
5. Aktif contribution ve en az bir combat hull bulunduğunu doğrula.
6. Her farklı participant için personal bash advisory lock; clan için tek clan quota lock al.
7. Normal `attack_commitments` modelini aşağıdaki kesin yöntemle genişlet:
   - unique `mission_id` indeksini unique `(mission_id, attacker_player_id)` yap;
   - ortak mission için her farklı aktif participant adına bir satır yaz;
   - filosuz lider varsa onun adına da bir satır yaz, participant lideri ikinci kez yazma;
   - personal kota sorgusu row saymaya devam eder ve böylece kişi başına bir commitment sayar;
   - clan kota sorgusunu `count(distinct mission_id)` yap; bütün participant satırları klan adına
     tek saldırı sayılır;
   - normal saldırı mission'ında tek satır olduğundan mevcut sonuç değişmez;
   - joint report clan kimliğini bu çoklu tablodan tahmin etmez, operation snapshot'ını kullanır.
   - joint start `recordClanAttack` içindeki normal `clanRaidRoster` üretimini çağırmaz; ortak savaş
     loot'u hiçbir aşamada `allocateClanLoot`/normal `%10` paylaşım yoluna girmez.
8. Filosuz lider için ek personal commitment ve shield drop uygula; participant lideri iki kez sayma.
9. Operation ve contribution'ları `ATTACKING/IN_BATTLE` yap.
10. Aggregate public mission, mission relation, arrival ve radar warning event'lerini yaz.
11. Shard/private stream invalidation yayınla.

Response birleşik mission id, arrive/resolve time ve güncel war state döndürür.

## 6. Server Servis Tasarımı

### 6.1 Dosya sınırları

Yeni servis sınırları:

- `apps/server/src/services/clanWar.ts`: orchestration, reads, target, contribution, recall, cancel,
  start ve lifecycle guard'ları.
- `apps/server/src/services/clanTreasury.ts`: donate/upgrade/read ve immutable audit.
- `apps/server/src/services/clanWarSettlement.ts`: joint combat settlement, loot, Dominion, reports
  ve dönüş planlama.

Mevcut entegrasyon noktaları:

- `routes/clan.ts`: route/schema wiring;
- `services/clanCombat.ts`: ortak hostility/quota primitives; normal attack davranışını bozma;
- `services/mission.ts`: normal launch olduğu gibi kalır; clan-war dispatch doğrudan yeni servise
  gider. Tekrarlanan saf movement hesabı varsa yalnız o küçük helper ortaklaştırılır;
- `worker/handlers.ts`: clan-war mission legs ve expiry handler dispatch;
- `worker/abandon.ts`: stuck joint legs;
- `services/reports.ts`: viewer-aware report projection;
- `services/traffic.ts`: clan identity projection, mevcut fog korunarak;
- `services/clan.ts`: leave/kick/leadership/disband guards ve public level;
- `services/reclaim.ts`, `services/accountDeletion.ts`, `services/servers.ts`: lifecycle cleanup.

`hasHostileFlightWithClan` ve recruitment admission sorguları `COMBINED_ATTACK` bacağını hostile
flight olarak tanır. `ASSEMBLING` target-clan birleşmesi merkezi cancel/return akışını çalıştırır;
`ATTACKING` mission ise mevcut acknowledgement ile uçuşa devam eder.

### 6.2 Lock düzeni

Kod başlamadan mevcut ownership/season lock convention tekrar okunmalı. Ortak savaş için bütün
transaction'larda tek sıra kullanılmalı:

1. season/global lifecycle işlemiyle yarışan akışlarda mevcut season lifecycle lock;
2. planet row'ları UUID sırasıyla;
3. clan row;
4. operation row;
5. contribution row'ları UUID sırasıyla;
6. player rows UUID sırasıyla;
7. personal/clan advisory quota keys deterministik sırayla.

Hiçbir akış bu sırayı tersine çevirmemeli. Concurrency testleri gerçek paralel transaction ile
deadlock ve double-spend'i ölçmelidir.

### 6.3 Capacity ve reservation

- Capacity `sum(reserved_bulk)` üzerinden transaction içinde doğrulanır ve read sırasında türetilir;
  ayrıca cached `used` kolonu eklenmez.
- Aktif capacity statuses: `OUTBOUND`, `STAGED`, `IN_BATTLE`.
- `RECALL_ORDERED`, `RETURNING`, `HOME`, `LOST` kapasite tüketmez.
- İki contribution aynı son slot için yarışırsa biri başarılı, biri `CLAN_HANGAR_FULL` olmalıdır.
- Clan level yükseltmesi kapasiteyi anında artırır; düşürme olmadığı için over-capacity durumu yoktur.
- Klan disband aktif operasyon varken engellendiğinden orphan capacity oluşmaz.
- Mevcut `assertFreeBay`/used-bay sorguları clan-war mission satırlarını generic mission sayımından
  çıkarır ve bunların yerine `source_kind = PHYSICAL` olan, henüz `HOME/LOST` olmayan contribution'ı
  origin gezegeni için bir bay olarak sayar. Böylece support mission + contribution iki kez
  sayılmaz, staging bekleyişi bay'i yanlışlıkla bırakmaz ve leader-capital instant contribution ile
  aggregate combined mission hiçbir bay kullanmaz.

### 6.4 Target revalidation

Event hook eklenmesi gereken işlemler:

- planet ownership/control transfer;
- target player'ın attacking clan'a kabulü;
- target planet deletion/reclaim.

Hook performans için erken cancel sağlar fakat doğruluğun tek kaynağı değildir. `GET`, add, recall,
cancel ve start, expired/invalid operasyonu inline idempotent finalize edebilmelidir.

Target owner/clan drift otomatik iptali yalnız `ASSEMBLING` operasyon içindir. Operation
`ATTACKING` olduktan sonra üyelik kabulü ve hedef koruması/sahipliği için mevcut normal in-flight
kuralları geçerlidir; savaş başlatıldıktan sonra yeni bir ortak-savaş kuralıyla retroaktif iptal
üretilmez. Mevcut hostile-flight admission uyarısı/acknowledgement davranışı korunur.

### 6.5 Worker ve movement

- `event_kind` enum'una append-only `clan_war_expiry` eklenir. Mission bacakları mevcut
  `mission_arrival` handler'ında, generic normal mission dallarından önce `clan_war_missions`
  relation'ına bakılarak joint handler'a dispatch edilir.
- Support outbound arrival:
  - mission claim idempotent;
  - contribution `OUTBOUND -> STAGED`;
  - units location değişse bile personal owner ve origin identity korunur;
  - recalled ise aynı transaction'da return leg planlanır ve `RETURNING` olur.
- Combined attack arrival:
  - operation mission claim edilir;
  - target/protection için mevcut in-flight davranış uygulanır; launch sonrası ownership/protection
    değişiminde normal saldırının `return untouched` semantiği korunur;
  - combat yalnız bir kez settlement edilir;
  - contribution bazında survivors/losses ayrılır;
  - her survivor için doğrudan return mission oluşturulur;
  - hiç survivor olmayan contribution terminal olur.
- Return arrival:
  - `safeHomePlanet`;
  - sadece bu contribution'ın gemi, loot ve salvage'ını home stack/store'a ekler;
  - flight bay lifecycle doğal olarak units/mission sorgularında serbest kalır;
  - son terminal contribution operation'ı `COMPLETED` yapar.
- Expiry handler:
  - yalnız `ASSEMBLING` ve `now >= expiresAt` ise cancel;
  - start ile yarışta operation row lock sonucu tek winner;
  - redelivery ikinci return yaratmaz.

### 6.6 Failure/abandon

- Support outbound kalıcı worker hatası: katkı intact olarak güvenli eve return edilir.
- Combined mission savaş çözülmeden fail olursa bütün active contributions intact return edilir,
  close reason `FAILED` olur ve hiçbir loot/Dominion/report üretilmez.
- Settlement commit olduktan sonra event fail olmuş görünemez; combat/report/return missions aynı
  transaction'dadır.
- Return leg kalıcı fail olursa gems + assigned loot/salvage safe home'a atomik teslim edilir ve
  contribution terminal yapılır.
- `worker/abandon.ts` contribution relation'ını tanımalı; generic unit iadesi ile clanWar state'in
  birbirinden kopmasına izin vermemeli.

## 7. Combat, Loot ve Dominion Ayrıntıları

### 7.1 Joint combat output

Saf resolver aşağıdaki iki görünümü birlikte üretmelidir:

- mevcut sistemin kullanabileceği aggregate `CombatResult`;
- per contribution:
  - starting fleet;
  - total losses;
  - survivors;
  - hull damage contribution;
  - collector/cargo survivors.

Defender tek board olarak kalır. Defender casualties'i oyunculara atamak gerekmez; damage
contribution Dominion paylaşımı için saldıran stack'lere izlenir.

RNG invarianti:

- tur başına mevcut gibi bir attacker ve bir defender roll alınır;
- stack sayısı RNG çağrı sayısını artırmaz;
- tek-stack joint resolver ile `resolveCombat` aynı seed altında eşit aggregate sonuç verir.

### 7.2 Loot allocation kesinliği

Loot fairness mevcut cargo birimini kullanır; `resourceValue` yalnız Dominion loot değerlemesinde
kullanılır. Allocation algoritması:

1. Her eligible player'ın tüm survivor contributions cargo kapasitesini topla.
2. Her player için max-min water-fill ile hedef ham kaynak birimi belirle; toplam hedefler
   `loot.alloy + loot.crystal + loot.deuterium` değerine eşit olmalıdır.
3. Her resource pool'unu player hedeflerine orantılı dağıt; tamsayı remainder'larını canonical
   resource sırası `alloy, crystal, deuterium`, sonra player UUID ile çöz.
4. Bir oyuncu için `alloy + crystal + deuterium <= cargoCapacity` olmalıdır.
5. Oyuncu payını contributions'a bölerken contribution UUID sabit tie-breaker olsun.
6. `sum(player allocations) == total loot` ve `sum(contribution allocations) == player allocation`
   test invariant'ı olsun.

`computeLoot` toplam cargo ile sınırlandığı için toplam loot bütün player hedeflerine sığmalıdır;
algoritma bunu assert etmeli, rounding nedeniyle sessiz kaynak bırakmamalıdır.

### 7.3 Dominion participant allocation

`R` hesaplanırken attacker permanent loss bütün contributors'ın loss toplamıdır. Player ham score:

```text
personalRaw = allocatedLootValue
            + allocatedDefenderPermanentLossValue
            - ownPermanentLossValue
```

Defender permanent loss dağılımı actual post-shield hull damage contribution oranına göredir.
Hiç attacker hull damage yoksa defender permanent loss zaten sıfır olmalıdır. Normalize adımları:

1. Defender permanent loss value, capped credited hull-damage paylarına largest-remainder ile
   dağıtılır; eşitlikte player UUID kullanılır. Allocation toplamı exact defender permanent loss'tur.
   Bu nedenle `teamBase = sum(personalRaw)` base `R` ile tam eşleşmelidir; eşleşmiyorsa settlement
   fail/rollback eder.
2. Team `adjusted` oran kuralıyla hesaplanır.
3. `base != 0` iken her exact rasyonel payı
   `exact_i = adjusted * personalRaw_i / base` olarak hesapla. `adjusted/base` pozitif olduğu için
   personalRaw işareti korunur.
4. Her payı önce sıfıra doğru truncate et. `adjusted - sum(truncated)` kalanını exact payların
   fractional büyüklük sırasına göre birer puan dağıt; eşitlikte player UUID kullan. Kalan negatifse
   aynı sıralamada `-1`, pozitifse `+1` uygula.
5. `base = 0` olduğunda `adjusted = 0` ve bütün participant Dominion delta'ları `0` olur; birbirini
   götüren ally içi pozitif/negatif score üretilmez.
6. Her ledger event ve aggregate report aynı stored delta'yı okur, yeniden hesaplamaz.

Bu karma işaret senaryoları saf testlerle sabitlenmeden server settlement yazılmamalıdır.

### 7.4 Clan Dominion

- Attacker clan id operasyon başlangıcındaki clan snapshot'ıdır.
- Saldıran clan delta'sı participant player delta toplamıdır; ayrı bir bonus/ceza eklenmez.
- Defender clan attribution mevcut maturity-at-launch kuralıyla snapshot edilir.
- Defender clan delta tam zıt takım transferidir.
- Clan score event operation/report key'iyle idempotent olmalıdır.

## 8. Rapor ve Bilgi Sisi

### 8.1 Erişim

Ortak savaş raporuna yalnızca:

- savaşa gemiyle katılan oyuncular;
- hedef defender;
- filosu olmasa da operasyon lideri

erişebilir. Yetki güncel klan üyeliğinden değil battle-time participant/coordinator snapshot'ından
gelir. Ayrılan oyuncu kendi geçmiş raporunu görmeye devam eder.

### 8.2 Payload

Mevcut `BattleReportView` normal savaşlar için değişmeden çalışmalıdır. Ortak rapora opsiyonel
`jointWar` alanı ekle:

- `battle_reports.attacker_player_id` ve aggregate combined `missions.owner_player_id`, mevcut
  zorunlu FK sözleşmesi için operation leader snapshot'ını taşır; bu teknik alan combat ownership,
  participant yetkisi, kişisel kota veya rivalry kaynağı değildir;

- operation id;
- clan id/name/tag snapshot;
- coordinator leader identity;
- target identity, planet ve saldırı zamanı;
- attacker/defender player counts ve oran;
- aggregate sent/lost/survivor totals;
- participants listesi:
  - player identity;
  - contribution/origin waves;
  - sent, losses, survivors;
  - loot/salvage payı;
  - personal Dominion delta;
  - return status/destination;
- total loot ve salvage;
- base/adjusted Dominion audit.

### 8.3 Viewer projection

- Attacker participant: kendi tam sent/loss/survivor ve bütün attacker contributions; defender'ın
  yalnız kanıtlanmış loss/floor bilgisi. Defender starting/surviving full board yok.
- Defender: kendi full defender board/loss/survivor; gelen bütün attacker contributions ve sahipleri.
- Coordinator-only leader: attacker görünümüyle aynı fog; katılımcı olmadığı için kişisel sonuç yok.
- Aggregate legacy fields viewer perspektifine göre mevcut `yourFleet`, `yourLosses`, `theirFleet`
  semantiğini korur.
- Rival summary/history her participant için aynı defender ile bir battle olarak güncellenir;
  coordinator-only lider için participant rivalry yazılmaz.
- `readBattleReports` ortak rapor erişimini participant-result/coordinator ilişkisiyle genişletir.
  Joint rows ordinary history sorgusunun `attacker_player_id` tabanlı rival hesabından çıkarılır;
  participant rival aggregate'i `clan_war_participant_results` üzerinden bir kez üretilir.
- Viewer için `attacking = true`, caller participant veya coordinator ise; yalnız defender için
  `false` olur. Bu değer teknik `attacker_player_id` eşitliğinden türetilmez.
- “Toplam savunma filosu” yalnız defender'ın kendi kopyasında tamdır. Attacker/coordinator
  kopyasında bu alanı doldurmak, mevcut probe değerini ücretsiz açıklayacağı için yasaktır; orada
  yalnız doğrulanmış defender losses/floor gösterilir.
- Her participant bir `raid_result`, defender bir `raided` bildirimi alır. Coordinator-only lider de
  ortak savaş sonucuna/report'a deep-link veren tek bir sonuç bildirimi alır. Lider participant ise
  duplicate bildirim yazılmaz. Her fiziksel dönüş ayrıca mevcut `fleet_returned` bildirimini üretir.

## 9. Traffic, Radar ve Telescope

- Generic `missions.ownerPlayerId` tek owner istediği için combined mission coordinator/leader'ı
  teknik owner olarak taşıyabilir; combat ownership hiçbir zaman bu kolondan türetilmez.
- `[TAG] Klan Filosu` kimliği yalnız `COMBINED_ATTACK` bacağında kullanılır. `SUPPORT_OUT` ve
  pre-battle `SUPPORT_RETURN` bacakları, gönderen oyuncunun mevcut normal fleet traffic/fog
  davranışını korur; staging'e destek gidişi klan aggregate filosu gibi gösterilmez.
- Traffic contact'a yalnız Telescope exact-fleet görünürlüğü kazanıldığında opsiyonel public
  identity eklenir: `{ clanFleet: { clanId, tag, label } }`. Radar'ın unknown/mass/silhouette
  seviyeleri tag veya clan id vermez. Defender'ın mevcut incoming identity eşiğinde oyuncu adı
  yerine/yanında clan kimliği verilir.
- Label `[TAG] Klan Filosu` olur; member usernames traffic payload'a eklenmez.
- Mevcut unknown/radar/telescope seviyeleri aynen korunur:
  - çıplak göz/unknown klan kimliğini görmemeli;
  - Radar yalnız mevcut mass/silhouette hakkını verir;
  - Telescope exact aggregate fleet ile `[TAG] Klan Filosu` kimliğini görür;
  - kargo ve contribution sahipleri hiçbir sensor seviyesinde traffic'ten çıkmaz.
- Defender incoming notification klan kimliğini mevcut radar warning anında taşır; hedef
  işaretlendiğinde veya staging sırasında bildirim yoktur.
- Combined engagement/bombardment public visual davranışı normal attack ile aynı kalır.

## 10. Web UX Planı

Frontend React/Vite/TanStack Query kullanır. Yeni veri yalnız görünürken çekilmeli; birbirinden bağımsız
read'ler paralel olmalı ve mutation response mümkün olan güncel state'i taşımalıdır.

### 10.1 Clan Screen

`ClanTab` içine `war` ekle. `useClanWar(enabled)` yalnız member ve aktif tab `war` iken çalışsın.

War panel mobil-first olarak şu sırada olmalı:

1. **Amaç kartı:** neden yapılır, hedef yoksa liderin Galaxy'den hedef seçmesi gerektiği.
2. **Clan progression:** level, `used/reserved/total`, bir sonraki seviye maliyeti; büyük kapasitenin
   ne anlama geldiği ve normal Hangardan bağımsız olduğu açıklanır.
3. **Treasury:** mevcut kaynaklar, hedef maliyetle karşılaştırma, seçilen owned world ve partial
   donation controls; liderde upgrade action.
4. **Target card:** commander/planet/coordinates, staging, exact expiry countdown ve state.
5. **Contributions:** player ve wave bazında origin, fleet, status, ETA; caller'ın recall action'ı.
6. **Contribution composer:** origin selector, fleet quantities, quote, fuel leg breakdown, flight bay,
   personal capacity, clan capacity, shield warning ve commit action.
7. **Leader controls:** start/cancel ve server reason'dan türeyen disabled açıklaması.
8. **Returning tracker:** bütün filolar terminal olana dek neden yeni target seçilemediğini gösterir.

Tasarım dört soruyu cevaplamalı:

- Clarity: kapasite, reserved, yakıt ve countdown'ın anlamı açık.
- Predictability: oyuncu rota/ETA/yakıt/koruma bedelini commit öncesi görür; savaş sonucu vaat edilmez.
- Decision support: hangi geminin hangi sahibin tech'ini kullandığı ve support-only havuzun neden
  başlayamadığı ilgili kontrol yanında açıklanır.
- Interaction cost: wave karşılaştırması tek ekranda; her contribution için ayrı sayfa açılmaz.

### 10.2 Galaxy Focus

- Yalnız foreign player, discovered target, caller clan leader ve yeni ruleset olduğunda
  `Klan hedefi yap` görünür.
- Mevcut operation veya season horizon gibi kesin engel varsa buton disabled ve kısa nedenli olur.
- İşlem normal attack sheet'i açmaz; target mutation sonucu Clan War tab'ına yönlendirme/başarı
  feedback'i verir.
- Attack/probe controls ve onboarding selector'ları bozulmamalıdır.

### 10.3 Queries ve SSE

- Query key: `['clan', 'war']` ve gerekli treasury state aynı response'ta tutulabilir.
- `ClanPrivateEventKind` append-only olarak `war` ve `treasury` alır.
- Clan üyelerine private publish fan-out mevcut `publishClan` deseniyle yapılır; private veri SSE
  payload'ında taşınmaz, yalnız refetch tetiklenir.
- War mutations yalnız clan war/home, selected planet, pending, traffic, reports ve gerekli
  leaderboard key'lerini invalid eder; bütün cache'i sebepsiz invalidate etmez.
- Arrival countdown client clock ile akar; her saniye API çağrısı yapılmaz.

### 10.4 Battle report UI

- Mevcut report row görsel dili korunur; clan joint badge/tag eklenir.
- Detail sheet'te önce aggregate outcome, sonra participant contribution cards ve loot/Dominion
  dağılımı progressive disclosure ile sunulur.
- Viewer'ın görmeye yetkili olmadığı defender roster için boş tablo veya tahmini survivor çizme.
- Multiple waves aynı player heading altında gruplanır.
- Return status raporun immutable combat sonucundan ayrı, canlı operasyon read'i mevcutsa güncel;
  rapor payload'ındaki snapshot fallback olur.

### 10.5 Yerelleştirme ve erişilebilirlik

- `tr`, `en`, `de`, `fr`, `es` clan/report/focus/error metinleri birlikte eklenir.
- Countdown yalnız renkle anlatılmaz; status text ve `aria-live` yalnız anlamlı sınır değişimlerinde
  kullanılır, her saniye ekran okuyucu spam'i yapılmaz.
- Tab semantics mevcut `Segmented` tablist pattern'ini korur.
- Disabled action'ın nedeni görünür text olmalıdır; tooltip-only kabul edilmez.
- 350px genişlikte yatay taşma ve kesilen CTA olmamalıdır.

## 11. Phase-by-Phase Uygulama Sırası

Her phase kendi kırmızı/yeşil döngüsüyle tamamlanmadan sonrakine geçme.

### Phase 0 — Baseline ve güvenli başlangıç

1. `CLAUDE.md`, ilgili docs ve bu planı oku.
2. `git status --short`, son migration/journal ve branch HEAD'i kaydet.
3. Hedefli baseline testlerini çalıştır:
   - rules: clan, combat, fuel, hangar;
   - server: clan, mission, reports, traffic, hangar, fuel, reclaim, season lifecycle;
   - web: ClanScreen, FocusPanel/GalaxyView, BattleReports, API contract.
4. Mevcut failures varsa ürünü değiştirmeden bir baseline notuna exact test adı/output yaz.
5. Bu belgedeki kararlarla mevcut kod arasında yeni bir çelişki bulunursa uygulamayı durdur ve ürün
   sahibine yalnız gerçekten karar gerektiren soruyu sor.

Çıkış kriteri: temiz/kanıtlı başlangıç, kullanıcı değişiklikleri korunmuş, dokunulacak test yüzeyleri belli.

### Phase 1 — Rules primitives

Önce kırmızı testler:

- level 1..10 exact double capacity ve invalid levels;
- upgrade cost normal Hangar cost ile birebir;
- asymmetric three-leg fuel, per-leg rounding ve two-leg leader cost;
- loot equal distribution, cap redistribution, zero survivor, multi-wave split, deterministic remainder,
  conservation;
- Dominion 1:1, 3:1 positive/negative/zero, multiple waves single player, leader-no-fleet exclusion,
  safe integer ve exact zero sum;
- joint combat single-stack parity, owner tech differences, support-only stacks, casualty ownership,
  Aegis/support shielding ve seeded determinism.

Sonra saf implementation. Public exports mevcut `packages/rules/src/index.ts` düzenine eklenir.

Çıkış kriteri: rules target tests yeşil, eski combat/fuel/hangar tests değişmeden yeşil.

### Phase 2 — Migration ve schema

Önce schema/migration contract testleri yaz:

- enum değerleri append-only;
- one-open-operation constraint;
- treasury, level, status, expiry ve FK checks;
- same-origin multiple contribution row'ları;
- report binder/audit constraints;
- deletion order fixture.

Ardından Drizzle schema'yı değiştir ve repo'nun standart `db:generate` akışıyla bir migration üret.
Generated SQL'i elle incele: enum rebuild/drop, destructive table rewrite veya mevcut migration değişikliği
olmamalı.

Çıkış kriteri: fresh DB migrate, existing DB migrate ve schema tests yeşil.

### Phase 3 — Treasury ve clan progression

Önce server tests:

- L1/zero treasury read;
- member/immature member donation;
- non-member refusal;
- wrong owner/insufficient planet resource;
- all-zero/negative/fractional/unsafe input;
- next-cost overflow rejection;
- concurrent donation cannot overfill;
- leader-only upgrade, expectedLevel race, exact spend;
- L10 donation/upgrade disabled;
- leave no refund; disband burn audit;
- public profile only level, private read treasury/capacity;
- old ruleset unavailable.

Servis/routes/schema projection'ı uygula. Clan create/read/disband yollarını güncelle.

Çıkış kriteri: clan ve treasury tests yeşil; normal clan aid/depot davranışı değişmemiş.

### Phase 4 — Target operation lifecycle

Önce tests:

- leader-only target;
- foreign/discovered/player-only;
- leader ±1 tier, clan-friendly fire, ceasefire/protection;
- exactly one open operation;
- capital staging snapshot;
- exact 24h expiry ve insufficient season horizon;
- no defender notification/no shared intel;
- owner change veya target joins clan auto-cancel;
- later protection blocks start but does not cancel;
- expiry handler + inline expiry race idempotency;
- no new target through RETURNING.

Operation service, route, expiry event ve target drift hooks yaz.

Çıkış kriteri: operasyon targetsız/assembling/cancel-returning states doğru ve worker redelivery güvenli.

### Phase 5 — Contribution quote ve dispatch

Önce tests:

- mature membership; leader/member; leader capital vs colony;
- invalid hull/empty fleet/support-only acceptance;
- owner tech snapshot;
- fuel three/two legs, exact once, no refund;
- shield acknowledgement/drop timing;
- flight bay full/full lifecycle;
- personal Hangar kullanımının azalmaması;
- clan capacity reservation and race;
- same player/origin multiple waves;
- idempotent retry no duplicate fuel/ships/contribution;
- staging escrow raid defence exclusion;
- physical ETA and season boundary.

Quote ve dispatch'i aynı pure calculations'tan besle; route/body Zod'u ekle.

Çıkış kriteri: contribution staging'e gerçek mission ile gider, leader capital anlık olur, bütün resource
hareketleri atomiktir.

### Phase 6 — Recall, cancel ve membership guards

Önce tests:

- owner-only recall;
- outbound recall finishes staging then returns;
- staged recall direct physical return;
- leader instant removal;
- recalled outbound frees clan capacity and does not block start;
- repeat recall no duplicate mission;
- cancel/expiry returns all;
- no extra fuel/refund;
- contributor leave/kick block;
- leadership/disband block;
- nonparticipant membership allowed;
- after outcome membership unlocks while returns continue;
- reclaim/account deletion busy guards.

Merkezi return planner kullan; cancel, expiry ve target drift ayrı kopyalar yazmasın.

Çıkış kriteri: bütün pre-battle çıkışlar sahipliği ve kaynakları korur.

### Phase 7 — Start, quota ve combined movement

Önce tests:

- leader-only/idempotent start;
- inbound error exact code/copy;
- recalled inbound ignored;
- at least one combat hull;
- participant eligibility recheck and actionable invalid list;
- protection/ceasefire/tier/bash recheck;
- one personal quota per distinct participant, one clan quota total;
- leader no fleet quota/shield behavior;
- leader participant no double count;
- normal attack and joint start quota concurrency;
- pool lock prevents add/recall;
- slowest per-owner-tech travel;
- aggregate mission/radar event/traffic publish;
- start vs expiry/cancel race.

Normal `prepareClanAttack` mantığını bozmadan multi-participant quota primitive'i ekle.

Çıkış kriteri: birleşik mission tek kez yola çıkar ve görünür state bütün istemcilere yayınlanır.

### Phase 8 — Combat settlement, loot, Dominion ve returns

Önce integration tests:

- seeded battle with different participant tech;
- per-owner casualties/survivors;
- defender protection/ownership drift after launch uses existing in-flight semantics;
- aggregate vs participant totals exact;
- direct return per origin and safeHome fallback;
- player loot capacity fairness/multi-wave physical allocation;
- zero survivor/zero cargo;
- no ordinary 10% clan share;
- collector salvage ownership/public wreck remainder;
- 1:1/3:1 Dominion both outcomes, exact player/clan zero sum;
- recovery shield profit/loss per participant;
- notification/unlock/visit/rival side effects;
- double delivery produces one report/ledger/return set.

Settlement transaction tek atomik boundary olmalıdır.

Çıkış kriteri: savaş sonucu, ekonomi, ledger, rapor ve dönüş görevleri ya hep birlikte commit olur ya
hiçbiri olmaz.

### Phase 9 — Reports ve traffic

Önce tests:

- participant, defender, coordinator access; outsider denial;
- access survives clan leave;
- attacker fog, defender full incoming breakdown;
- aggregate legacy fields parse;
- participant contribution/loot/Dominion/return details;
- traffic unknown/radar/telescope tiers leak no owner list/cargo;
- exact `[TAG] Klan Filosu` only at permitted identity level;
- defender incoming notification timing;
- report/rival query remains bounded, no N+1.

Projection'ları batch queries/Map ile kur; report başına query yazma.

Çıkış kriteri: API contract ve fog tests yeşil, normal battle/pirate/strategic reports aynı.

### Phase 10 — Web client ve UX

Önce component/query/schema tests:

- lazy war tab query;
- treasury/upgrade/donation states;
- no target, assembling, attacking, returning, completed/null states;
- live expiry countdown;
- quote/fuel legs/capacity/bay/shield acknowledgement;
- multiple waves and own recall;
- exact disabled reasons;
- FocusPanel target action visibility/eligibility;
- report grouping and viewer fog;
- traffic clan label;
- SSE targeted invalidation;
- five locale contract.

Sonra schemas/client/hooks/components/i18n uygula. API response'larını Zod ile parse et; `any` veya
compiler-silencing cast kullanma.

Çıkış kriteri: testler yeşil, 350px mobil görünüm okunur, keyboard/screen reader davranışı doğru.

### Phase 11 — Lifecycle, cleanup ve failure recovery

Önce tests:

- support/combined/return abandon paths;
- reclaim defers active participant/target/coordinator as gerekli;
- account deletion busy refusal;
- season freeze/wipe with every operation state;
- FK deletion order;
- event redelivery/stale claimed event;
- operation completes after final return;
- no capacity/bay leak after failure.

`reclaim.ts`, `accountDeletion.ts`, `servers.ts`, worker abandon ve season lifecycle'i güncelle.

Çıkış kriteri: stuck operasyon, orphan unit, açık reservation veya wipe FK hatası yok.

### Phase 12 — Dokümantasyon, full verification ve handoff

- `docs/game-design.md`: yeni ruleset'te clan level/joint war; eski “yok” ifadesini scope'la.
- `docs/architecture.md`: tables, state machine, locks, workers/idempotency.
- `docs/balance.md`: level/capacity/cost, fuel ve Dominion ratio.
- `docs/battle-reports.md`: participant report ve fog matrix.
- `docs/interface.md`: War tab, target action ve four-questions kararları.
- `docs/glossary.md`: Klan Hangarı, Ortak Savaş Havuzu ve aktif katılımcı terimlerini ekle.

Son doğrulama:

```bash
pnpm verify
node tools/visual.mjs
```

Full verify failure'larını “önceden vardı” diye varsayma; Phase 0 baseline ile exact karşılaştır.
Feature değişikliğinin tetiklediği her failure düzeltilmelidir.

## 12. Test Matrisi

| Alan | Happy path | Kritik edge/concurrency |
|---|---|---|
| Hazine | partial donation, exact upgrade | overflow, double spend, L10, disband burn |
| Hedef | leader marks valid planet | two leaders/request retry, expiry/start race, target joins clan |
| Katkı | physical arrival, leader instant | same-origin waves, capacity last slot, bay full, idempotent retry |
| Recall | staged/leader removal | outbound recall arrival race, double recall |
| Start | all staged combined launch | inbound, invalid participant, quota race, expiry/cancel race |
| Combat | multi-tech owners | support-only stack, wiped owner, RNG parity |
| Loot | equal eligible owners | different caps, zero survivor, rounding, multi-wave |
| Dominion | 1:1 normal | 3:1 win/loss, mixed weights, exact zero sum |
| Return | each origin receives own fleet | lost origin, membership change, worker retry |
| Reports | participant/defender/coordinator | outsider, post-leave access, fog leakage |
| Traffic | clan aggregate visible by sensors | unknown contact identity leak, cargo/owner leak |
| Lifecycle | final return completes operation | reclaim/delete/wipe/abandon in every state |

## 13. Error Kodları

Server stabil, yerelleştirilebilir kodlar üretmelidir. En az:

- `CLAN_JOINT_WAR_UNAVAILABLE`
- `CLAN_WAR_LEADER_ONLY`
- `CLAN_WAR_ALREADY_OPEN`
- `CLAN_WAR_NOT_FOUND`
- `CLAN_WAR_NOT_ASSEMBLING`
- `CLAN_WAR_TARGET_INVALID`
- `CLAN_WAR_TARGET_UNDISCOVERED`
- `CLAN_WAR_TARGET_CHANGED`
- `CLAN_WAR_EXPIRED`
- `CLAN_WAR_SEASON_TOO_SHORT`
- `CLAN_WAR_MEMBER_IMMATURE`
- `CLAN_WAR_PARTICIPANT_INELIGIBLE`
- `CLAN_WAR_SUPPORT_INBOUND`
- `CLAN_WAR_NO_COMBAT_FLEET`
- `CLAN_WAR_POOL_LOCKED`
- `CLAN_WAR_CONTRIBUTION_NOT_OWNED`
- `CLAN_WAR_CONTRIBUTION_TERMINAL`
- `CLAN_HANGAR_FULL`
- `CLAN_TREASURY_OVER_CAP`
- `CLAN_TREASURY_INSUFFICIENT`
- `CLAN_LEVEL_STALE`
- `CLAN_LEVEL_MAX`
- `CLAN_WAR_MEMBERSHIP_LOCKED`

Mevcut `BASH_LIMIT`, `CLAN_ATTACK_LIMIT`, `TIER_BAND`, `TIER_BAND_WEAK`, protection, bay, fuel ve
fleet validation kodları uygun yerde yeniden kullanılmalıdır.

## 14. Code Review Kontrol Listesi

Geliştirme başka agent tarafından tamamlandıktan sonra final reviewer şu sırayla incelemelidir:

### Veri ve sahiplik

- Hiçbir gemi leader/clan owner'a geçirilmiş mi?
- Same-origin multiple waves birbirinin unit row'unu eziyor mu?
- Personal Hangar/wealth staging sırasında gemiyi sayıyor mu?
- Staging escrow savunmaya veya raid casualty'lerine yanlışlıkla giriyor mu?
- Ganimet doğru return contribution ile fiziksel olarak taşınıyor mu?

### Ekonomi

- Yakıt katkı başında, bacak bazında bir kez mi?
- Recall/cancel/worker retry refund veya ikinci charge oluşturuyor mu?
- Treasury cap ve resource debit aynı transaction'da mı?
- Joint loot normal `%10` clan share yolundan tamamen ayrılmış mı?
- Loot/salvage/Dominion toplamlarında mint/burn veya rounding drift var mı?

### PvP ve Dominion

- Her participant tier/ceasefire/protection/bash yeniden doğrulanıyor mu?
- Multiple waves active player sayısını büyütüyor mu? Büyütmemeli.
- Filosuz lider ratio/loot/Dominion dışında, quota/shield içinde mi?
- 3:1 positive/negative formül doğru yönde mi?
- Player ve clan ledger toplamı her savaşta exact zero mu?
- Normal attack'ın RNG, kota ve Dominion davranışı değişmiş mi?

### Concurrency ve idempotency

- Start/cancel/expiry/arrival aynı operation row üzerinde serialize oluyor mu?
- Last capacity slot double-book edilebilir mi?
- Idempotency retry duplicate contribution/fuel/return/report/Dominion yazabilir mi?
- Worker redelivery terminal state'i yeniden işler mi?
- Kilit sırası bütün mutation/worker yollarında aynı mı?

### Fog ve authorization

- Attacker defender survivor/start roster'ını öğrenebiliyor mu?
- Public clan/profile/traffic private treasury, capacity, participant veya cargo sızdırıyor mu?
- Coordinator report access snapshot mı, current membership mi?
- Ayrılan participant geçmiş raporunu görmeye devam ediyor mu?
- Target mark savunmacıya erken bildirim/stream ipucu veriyor mu?

### Lifecycle

- Katılımcı outcome öncesi leave/kick edilebiliyor mu?
- Sonuç sonrası dönüş membership'i gereksiz kilitliyor mu?
- Yeni target bütün dönüşlerden önce açılabiliyor mu?
- Reclaim/account deletion/season wipe FK veya orphan state bırakıyor mu?
- Failed return safe landing ile bay/capacity/state'i kapatıyor mu?

### UI

- Oyuncu commit öncesi yakıt, ETA, bay, capacity ve shield kaybını görüyor mu?
- Disabled buton nedenini söylüyor mu?
- War tab açılmadan ağır/private query yapılıyor mu?
- 350px mobilde wave karşılaştırması ve CTA'lar kullanılabilir mi?
- Beş dil ve accessibility testleri tamam mı?

## 15. Definition of Done

Özellik yalnız aşağıdakilerin tamamı sağlandığında bitmiştir:

- Yeni ruleset sezonunda uçtan uca target → contributions → start → combat → direct returns çalışır.
- Eski ruleset sezonlarında yeni sistem kapalı ve mevcut davranışlar aynıdır.
- Sahiplik, kişisel/Klan Hangarı, flight bay ve yakıt invariants testlerle kanıtlanmıştır.
- İptal, expiry, recall, target drift, membership ve worker failure yolları tamamdır.
- Loot adil ve capacity-safe; Dominion ratio doğru ve exact zero-sum'dır.
- Raporlar participant katkılarını gösterirken mevcut fog'u korur.
- Radar/Telescope görünürlüğü yeni kimlikle çalışır ve private bilgi sızdırmaz.
- Reclaim, account deletion ve season wipe yeni tablolarla güvenlidir.
- UI mobil, erişilebilir, beş dilde ve karar desteği sağlayacak düzeydedir.
- `pnpm verify` yeşildir veya yalnız Phase 0'da exact kanıtlanmış bağımsız baseline failures kalmıştır.
- `node tools/visual.mjs` ile değiştirilmiş yüzeyler görsel olarak incelenmiştir.
- Uygulayıcı agent yaptığı değişiklikleri, test komutlarını ve kalan bilinen riskleri ayrı handoff notunda
  yazmıştır.

## 16. Bilinçli Olarak Kapsam Dışı

- Ortak savunma veya birden fazla defender oyuncu. *(Artık ayrı bir özellik: Klan Savunma
  Desteği, ruleset 15 — `docs/clan-defense-support-plan.md`.)*
- Birden fazla eşzamanlı klan hedefi.
- Hedef değiştirme; mevcut operasyon iptal edilmelidir.
- Klanlar arası diplomasi/savaş ilanı/ittifak sistemi.
- Hazine kaynaklarının üyeye geri çekilmesi veya üyeye refund.
- Mevcut sezonlara backfill.
- Normal tek oyunculu saldırıların recall edilebilir hale gelmesi.
- Target mark anında savunmacıya uyarı.
- Leader intel'inin bütün klana paylaşılması.
- Geniş kapsamlı combat/mission/UI refactor.

Bu sınırların dışına çıkan ihtiyaç bulunursa implementer varsayım yapmamalı; ayrı ürün kararı istemelidir.

## 17. Sorulan Sorular ve Verilen Cevaplar

- **Dominion'da oyuncu oranı combat'ı mı, skoru mu değiştirecek?** Combat değişmeyecek; oran
  yalnız Dominion transferini dengeleyecek. 3:1 saldırgan galibiyetinde pozitif kazanç üçe
  bölünecek, savunmacı galibiyetinde savunmacı lehine transfer üçle çarpılacak.
- **Klan seviyesi nasıl finanse edilecek?** Üyeler ayrı klan hazinesine bağış yapacak; yalnız lider
  exact maliyet biriktiğinde seviye yükseltecek.
- **Klan Hangarı kapasite ve maliyeti ne olacak?** Kapasite normal Hangar seviyesinin tam iki katı,
  yükseltme maliyeti ise normal Hangar maliyetinin aynısı olacak.
- **Hazine sınırsız banka olabilir mi?** Hayır. Her kaynak yalnız bir sonraki seviye maliyetine kadar
  birikecek; aşan bağış reddedilecek, seviye 10'da bağış kapanacak.
- **Bağış kimden ve nereden yapılabilir?** Olgunlaşmamış üye dahil her aktif üye, seçtiği kendi
  gezegeninden kısmi bağış yapabilir. Ayrılana iade yok; disband kalan hazineyi onayla yakar.
- **Katkı gemileri kişisel Hangarda sayılacak mı?** Evet; bütün yaşam döngüsü boyunca kişisel
  Hangar kapasitesini kullanmaya devam edecek.
- **Her filo hangi teknolojiyi kullanacak?** Sahibinin katkıyı gönderdiği andaki teknoloji
  snapshot'ını.
- **Kimler katılabilir ve tier kontrolü nasıl olacak?** Yalnız 12 saat olgunlaşmış üyeler;
  lider hedef koyarken ve her üye katkı/start sırasında kendi maksimum Core-türetilmiş `±1`
  bandına uymalı.
- **Staging gezegeni hangisi?** Hedef işaretlendiği anda liderin korunan başkenti. Yalnız o
  başkentteki lider filosu anlık eklenip çıkarılabilir; lider kolonileri fiziksel uçar.
- **Bir oyuncu birden fazla katkı gönderebilir mi?** Evet; aynı origin gezegenden bile sınırsız
  ayrı wave gönderilebilir. Her wave ayrı yakıt/tech/recall kaydıdır.
- **Yoldaki filo recall edilirse ne olur?** Uzayda dönmez; önce staging'e varır, sonra fiziksel
  olarak eve döner. Recall emrinden itibaren kapasiteyi ve start engelini bırakır.
- **Yakıt ve koruma ne zaman uygulanır?** Bütün planlı bacakların yakıtı contribution dispatch/add
  anında bir kez alınır ve iade edilmez; saldırı koruması da aynı anda acknowledgement ile düşer.
- **Staging'deki destek lider başkentini savunur mu?** Hayır; escrow'dur, savunmaya katılmaz ve
  başkente yapılan raid'de vurulamaz.
- **Ganimet nasıl paylaşılır?** Survivor cargo kapasitesi olan farklı oyuncular arasında max-min
  eşitlik ile; kapasitesi dolanın artanı diğerlerine dağıtılır. Normal `%10` clan raid payı uygulanmaz.
- **Hedef nereden seçilir ve hangi intel paylaşılır?** Lider, keşfedilmiş yabancı oyuncu gezegeninin
  Galaxy Focus panelinden seçer; klana yalnız kimlik/gezegen/koordinat gider, liderin sensor/probe
  bilgisi paylaşılmaz ve hedef oyuncu işaretlemede uyarılmaz.
- **Üyelik işlemleri ne zaman kilitli?** Katkı gönderen oyuncu sonuç kesinleşene kadar ayrılamaz veya
  atılamaz; liderlik devri ve disband de kilitlidir. Sonuçtan sonra dönüşler sürerken üyelik açılır.
- **Hedefin sahibi veya klanı değişirse ne olur?** Start öncesinde sahibi değişirse ya da hedef
  saldıran klana katılırsa operasyon iptal olur. Yeni protection yalnız start'ı engeller. Start
  sonrasında mevcut in-flight kuralları geçerlidir.
- **Yeni hedef ne zaman seçilebilir?** Eski operasyondaki bütün savaş/iptal dönüşleri HOME veya LOST
  olduğunda.
- **Lider filosuz savaş başlatabilir mi?** Evet; kişisel bash kotası kullanılır ve koruması düşer.
  Active attacker oranına, ganimete ve participant Dominion'una girmez; raporu coordinator olarak görür.
- **Flight bay nasıl tutulacak?** Her fiziksel contribution origin bay'ini eve dönene/yok olana kadar
  tutar; leader-capital instant contribution hiç bay kullanmaz.
- **Support-only katkı olabilir mi?** Tek contribution olabilir; fakat birleşik havuzda start için
  en az bir combat hull gerekir.
- **Raporu kim görür ve fog korunur mu?** Katılımcılar, defender ve filosuz coordinator lider görür.
  Attacker defender survivor/full start board'unu göremez; defender kendi board'unu ve bütün gelen
  contribution'ları görür.
- **Özellik hangi sezonlarda açılacak?** Yalnız yeni ruleset ile başlayan sezonlarda; mevcut
  sezonlara backfill yapılmayacak.
