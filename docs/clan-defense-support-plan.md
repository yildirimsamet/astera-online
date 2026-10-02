# Klan Savunma Desteği — Uygulama Planı

## Context

Klan Ortak Savaşı (ruleset 10+) üyelerin filolarını birleştirip tek bir yabancı dünyaya
saldırmasını sağlıyor. Savunma tarafında ise bunun karşılığı yok: saldırı yemek üzere olan klan
arkadaşına filo yollanamıyor. Ortak savaş planı (`docs/clan-joint-war-implementation-plan.md`
§16) "ortak savunma / birden fazla defender" konusunu bilinçli olarak kapsam dışı bırakmıştı.

Kodda savaş çözücü yalnızca **tek bir defender Fleet ve tek tech** kabul ediyor
(`packages/rules/src/combat.ts:496`). Defender hattı iki yerde, birbirinin kopyası olarak
kuruluyor: normal baskında `worker/handlers.ts:793-903`, ortak savaşta
`services/clanWarSettlement.ts:262-327`.

Hedef:

- Klan üyeleri birbirlerinin dünyalarına destek filosu yollayabilsin.
- Destek, ev sahibinin hattında tek oyunculu baskına da ortak savaş filosuna da karşı savaşsın.
- Gönderen filosunu geri çağırabilsin.

Böylece ortak saldırının bir karşı hamlesi olur.

## Kesin ürün kararları (sahip, 2026-10-01)

| # | Konu | Karar |
|---|---|---|
| K1 | Kapasite | Yeni bina yok. Her dünyanın Hangar'ında ayrı bir **Klan Desteği bölmesi** olur. Kapasitesi o dünyanın kendi Hangar odasıdır (`hangarCapacity(host.buildings.HANGAR)`, bulk; Hangar 1 = 80). Kullanım = OUTBOUND + STATIONED dalgalar. |
| K2 | Kişisel Hangar | Gönderilen gemiler gönderenin kişisel Hangar'ında sayılmaya devam eder. Ev sahibinin kendi Hangar'ına hiç girmez. |
| K3 | Kademe | Gönderen, ev sahibinin ±1 kademe bandında olmalı. Dispatch'te ve savaş anında kontrol edilir. Savaş anında bant dışı kalan dalga savaşa girmeden eve döner ve bildirim alır. |
| K4 | Savunma duruşu | Her dünyada iki anahtar var: **Taktik geri çekilme** ve **Klan desteği kabul**. İkisi aynı anda açık olamaz. Ayrıntılar aşağıda. |
| K5 | Dominion çarpanı (**revize, 2026-10-02**) | Kafa sayımı yerine güç: **D = hattın gücü ÷ ev sahibinin gücü**, en çok **×5** (klan koltuğu sayısı). Ev sahibinin gücüne ateş eden kara silahları dahildir. Ev sahibi kaybederse kaybı ×D, kazanırsa kazancı ÷D olur. Gücü olmayan (yalnız nakliye) destek D'yi 1'de bırakır. Ortak savaşta A saldıran kişi sayısı kalır: `base>0 → base×D÷A`, `base<0 → base×A÷D`. |
| K6 | Dominion payı (**revize, 2026-10-02**) | **Destekçilerin Hâkimiyeti hiç değişmez.** Savunan tarafın bütün hareketini ev sahibi taşır. (Eski ¼ güç payı kuralı kaldırıldı.) **(b):** D yalnız ev sahibinin kendi savaşını çarpar; destekçilerin kayıp gemileri değerleriyle (1:1) yazılır: `transfer = adjustDefendedDominion(base − destekKaybı, A, D) + destekKaybı`. |
| K7 | Süre ve recall | Gönderen havadayken geri döndürebilir (normal recall kuralı: dönüş, uçulan süre kadar sürer) ya da varıştan sonra her an geri çağırabilir. Dalga en fazla **12 saat** kalır, sonra otomatik döner. Ev sahibi her dalgayı **Geri gönder** ile yollayabilir. |
| K8 | Uçuş yuvası | Her dalga, çıkış dünyasındaki bir **normal** yuvayı dispatch'ten HOME/LOST olana dek tutar. |
| K9 | Probe | Destek, ev filosunun yanında ayrı bir **"Klan desteği"** okuması olarak görünür. Dünyanın **duruşu** da kesin olarak görünür. Saldırı sayfasının tahmini ve kaçış hükmü ikisini de hesaba katar. |
| K10 | Uyarı paylaşımı | Yok. Gelen saldırı uyarısı klana ya da destekçiye düşmez ("klanlarda ortak radar yok" ilkesi). |
| K11 | Rollout | `MULTI_WORLD.clanDefenseRulesetVersion = 15`. Özellik tamamlanınca `rulesetVersion` 14 → 15. Ruleset 15 altında duruş anahtarı yoktur ve kaçış bugünkü gibi otomatik çalışır. Desteksiz savaşların sonucu bit düzeyinde aynı kalır. |

### K4 ayrıntısı — savunma duruşu

Tek bir sütunda tutulur: `ESCAPE | SUPPORT | HOLD`. İki anahtarın ikisinin birden açık olması
imkânsızdır.

| Anahtarlar | Duruş | Savaşta |
|---|---|---|
| Geri çekilme açık, destek kapalı (**varsayılan**) | `ESCAPE` | Bugünkü kaçış kuralı işler. Destek gönderilemez. |
| Geri çekilme kapalı, destek açık | `SUPPORT` | Kaçış yok (destek gelmemiş olsa bile). Klan destek gönderebilir. |
| İkisi kapalı | `HOLD` | Kaçış yok, destek yok. Filo her zaman savaşır. |

- **Klansız oyuncu:** Destek anahtarı kapalı ve devre dışıdır, yanında "Klan desteği için
  bir klana katılmalısın" bilgisi yazar. Klana girince destek anahtarı açılabilir hale gelir
  ama varsayılan kapalı kalır.
- **Karşılıklı dışlama:** Birini açmak diğerini otomatik kapatır.
  - _Yorum notu:_ Birini kapatmak diğerini açmaz; ikisi birden kapalı olabilir (`HOLD`).
    Sahibin "birini toggle edince diğeri otomatik toggle olur" sözünü böyle yorumladım;
    onay ekranında itiraz edilirse iki durumlu yapıya çevrilir.
- **Kaydet:** Değişiklik taslak olarak tutulur ve **Kaydet** butonuyla gönderilir. Kayıtsız
  değişiklik varken buton aktif olur.
- **Kaçışı açarken:** `SUPPORT`'tan `ESCAPE` ya da `HOLD`'a geçiş, o dünyadaki gelen ve
  nöbetteki bütün dalgaları eve gönderir (`HOST_CLOSED`). Kaydet'ten önce satır içi onay
  sorulur: "3 destek dalgası eve döner".
- **Değişiklik zamanı:** Duruş her an değiştirilebilir, saldırı gelirken bile; son dakika
  yardım çağırmanın yolu budur. Savaş anındaki duruş geçerlidir.
- **Duruşun kendiliğinden döndüğü durumlar:**
  - Oyuncu klandan ayrılır, atılır ya da klan dağılırsa, `SUPPORT` olan dünyaları `ESCAPE`'e
    döner ve oyuncuya bildirim gider.
  - Dünya el değiştirirse duruş `ESCAPE`'e sıfırlanır.

## Planlayıcı kararları (küçük, geri alınabilir)

- **Uygunluk:**
  - Gönderen 12 saati dolmuş bir üye olmalı ve yeni oyuncu koruması altında olmamalı
    (clan aid'deki Sybil korumasının aynası).
  - Ev sahibi dünyanın duruşu `SUPPORT` olmalı. Capital da koloni de desteklenebilir.
  - Aynı klan şartı dispatch'te, varışta ve savaşta aranır.
  - Göndermek, gönderenin saldırı korumasını düşürmez.
  - Prospector ve diğer `NON_COMBATANT_HULLS` gönderilemez.
  - Kargo taşınmaz; kaynak teslimi clan aid'in işi. Hauler gemi olarak gönderilebilir.
- **Yakıt ve hız:**
  - Gidiş-dönüş yakıtı peşin alınır: `missionFuel(fleet, d, 2)`, clan aid ile aynı.
  - Recall, geri gönderme ya da süre dolması iade getirmez.
  - Hız clan aid şeridiyle aynıdır (`clanAidTravelMinutes`, ×1.10), tam hızda; pace yok.
- **Savaş:**
  - Destekçi savaş anındaki **canlı** teknolojisiyle savaşır (ev sahibi de zaten canlı okunuyor).
  - Kara silahları ve Aegis ev sahibinindir. Aegis bütün hattı korur.
  - SUPPORT-sınıfı örtü taraf geneldir: hatta combat hull varken taşıyıcılar hedef olmaz.
- **D sayımı:** *(2026-10-02'de kaldırıldı — K5: D artık güçten okunur; `defender_count`
  yalnız raporun kafa sayısıdır.)* Ev sahibi her zaman sayılır. Destekçiler, savaşa en az bir
  gemiyle giren farklı oyuncu sayısı kadar eklenir; aynı oyuncunun birden çok dalgası bir sayılır.
- **K6'daki "güç"** *(bugün K5 çarpanının girdisi)*:
  - `combatValue`, yani probe'un savunma bandı ve kaçışın kullandığı eksen.
  - Hesap savaş başındaki hatta yapılır. Ev sahibinin payına kara silahları da dahildir.
  - Yalnız taşıyıcı yollayan destekçinin gücü 0'dır, payı da 0'dır.
  - Tamsayı payları sıfıra doğru kırpılır; kalan ev sahibine yazılır. Takım toplamı bire bir
    korunur.
- **Kalıcı hasar:**
  - Dalga hasar lot'larını kendi satırında taşır.
  - Sonraki savaşa hasarlı girer; hasarlı gemiler önce ölür.
  - Eve inince normal yama/dock ayrımından geçer.
- **Recovery shield, ganimet kaybı, sadakat:** Yalnız ev sahibine ve yalnız ev sahibinin kendi
  kaybından hesaplanır.
- **Rapor:**
  - Ev sahibi ve her destekçi raporu alır; destekçi defender görünümünü görür.
  - Saldırgan destekçilerin adlarını ve her birinin kanıtlanmış kaybını görür; tam board'u ya
    da survivor'ları göremez.
- **Rivalite ve sezon istatistiği:**
  - Destekçi için saldırgan bir rival karşılaşmasıdır; savaş destekçinin istatistiğine kendi
    payıyla girer.
  - Saldırganın rival'i ev sahibidir.
  - Ev sahibinin istatistiği yalnız kendi stack'ini sayar.
- **Üyelik:**
  - Üyelik kilidi yok.
  - Ayrılma, atılma ya da dağılmada o oyuncuyla ilgili gelen ve giden bütün dalgalar eve döner.
  - Ev sahibi dünyayı kaybederse (el değiştirme, ayrılma, reclaim, terk, hesap silme) o
    dünyadaki dalgalar eve döner.
  - Commander transfer'i (Silent Space dahil), oyuncunun gönderdiği ya da ağırladığı canlı bir
    dalga varken reddedilir.
- **Çıkış dünyası kaybı:**
  - Gönderenin çıkış dünyası el değiştirir ya da koparsa, dalganın çapası (unit satırları ve
    `origin_planet_id`) gönderenin capital'ine taşınır ve nöbet sürer.
  - Gerekçe: `totalUnitsOf` ve `baysInUse` sahibe göre filtrelemiyor. Taşıma yapılmazsa
    gemiler ve yuva yeni sahibin Hangar'ına ve yuva sayımına sızar.
- **Bant dışı dalga:**
  - Bant canlı hesaplanır.
  - Bant dışı dalga probe'un "Klan desteği" okumasına girmez.
  - Ev sahibi bölmesinde ve gönderenin Fleet sayfasında "Bant dışı · saldırı gelirse
    savaşmadan eve döner" rozetiyle görünür.
- **Sezon sonu:**
  - 12 saatlik bitiş sezon sonuna göre kırpılır: `min(varış + 12 sa, sezonSonu − dönüşSüresi)`.
  - Gidiş ve dönüş sezona sığmıyorsa dispatch reddedilir.
  - Havadaki bacaklar freeze'i bekletir. Zorunlu freeze'de nöbetteki dalga anında eve iner.
- **Radyasyon:** Uçuş bacakları, ortak savaş bacakları gibi doz alır. Nöbetteki dalga doz almaz.
- **Bombardıman penceresi:**
  - Yalnız settlement anında `STATIONED` olan dalga savaşır.
  - Varış anı ile worker commit'i arasında gelen recall `409 CLAN_SUPPORT_LANDING` alır; UI
    butonu `arriveAt`'ta gizler.
- **Bildirimler:**
  - Ev sahibi: dispatch'te bildirim ("Ali destek yolladı · varış 14:32") ve ayrılışta
    nedeniyle birlikte bildirim.
  - Gönderen: geri gönderme, süre dolması, bant, üyelik ya da duruş kapanması nedeniyle
    dönüşte bildirim; eve inişte mevcut `fleet_returned`.
  - Destekçi: savaşınca rapora giden bir sonuç bildirimi.
  - Destek uçuşu hostile değildir ve kimseye radar uyarısı üretmez.
- **Botlar:** v1'de destek göndermez ve duruş değiştirmez (dünyaları `ESCAPE`). Saldırı
  kararlarında probe'daki desteği ve duruşu okur.
- **Görünürlük:**
  - Destek uçuşu gönderenin normal trafiği olarak görünür.
  - Telescope v1'de desteği ya da duruşu göstermez; bunları yalnız probe gösterir.
  - Nöbetteki dalga için yeni 3D çizim yok.

## Mimari

### Saf rules — `packages/rules`

**`src/combat.ts`** — yeni `resolveBattle(attackers, defenders: DefenderStack[], shield, rng)`.

- **Tipler:**
  - `DefenderStack = { stackId, playerId, fleet, tech: CombatSide, damage?: DamageLots }`.
  - Index 0 ev sahibidir. Kara silahı yalnız host stack'inde olabilir; aksi `RangeError`.
  - `resolveJointCombat`'ın imzası korunur; ince bir sarmalayıcı olur.
- **Tek defender stack:** bugünkü kod yolu birebir çalışır.
  - Kullanılanlar: `damageMap`, `specialistDamage`, `jointReturnFire(D,…)`,
    `applyCasualties`, yalnız-carry hasar.
  - Parity'yi bir branch korur; `combat-parity-digest.test.ts` bunu doğrular.
- **Birden çok stack:**
  - Saldırgan ateşi `jointReturnFire(live[i], defLive, defStats, aRoll, stats[i])` ile
    hesaplanır ve (stack, hull) başına toplanır.
  - `passRatio` taraf geneli kalır. Nullifier bonusu stack'ler üzerinden toplanır.
  - Defender ateşi Σⱼ `jointReturnFire(defLive[j], live, stats, dRoll, defStats[j])` olur.
  - Defender kayıpları yaralı cohort'larla birlikte `applyJointCasualties` ile uygulanır.
  - Saldırgan kredisinin overkill cap'i defender cohort'u (`hull:hp`) başınadır. Defender
    tarafında kredi gerekmez, çünkü savunan tarafın Hâkimiyeti güçten okunur (K5/K6).
  - `attackerSurvivorDamage`, `stackSurvivorDamage` adıyla genelleştirilir.
  - Grade, lossRatio, walkover ve salvage bütün hat üzerinden hesaplanır. Salvage yalnız host
    silahlarından gelir.
  - Tur başına iki `rng()` çekimi kalır, stack sayısı ne olursa olsun.
- **Sonuç:** `JointCombatResult + defenders: DefenderOutcome[]`.
  - Her outcome: `{ stackId, playerId, sent, survivors, losses, lossValue, survivorDamage }`.
  - Host'un `lossValue`'su defenceSalvage düşülmüş halidir. Böylece parçaların toplamı
    `defenderLossValue`'ya eşittir.

**`src/escape.ts`:**

- `resolveRaid` değişmez. Çağıran taraf mevcut `escape` parametresini şöyle verir:
  `fleetEscapeApplies(rv) && (rv < 15 || posture === 'ESCAPE')`.
- `escapeVerdict(..., posture)`: duruş `SUPPORT` ya da `HOLD` ise `STAND` döner.

**`src/clanWar.ts`:**

- `adjustJointDominion` koşulu `attackers <= defenders` yerine `attackers === defenders` olur.
- Safe-integer koruması eklenir.
- D=1 olan bütün eski sonuçlar değişmez; eski fonksiyon testte oracle olarak tutulur.

**Yeni `src/clanSupport.ts`:**

- `clanDefenseApplies(rv)` ve `CLAN_SUPPORT = { stationHours: 12, supporterShare: 0.25 }`.
- `DEFENCE_POSTURES = ['ESCAPE', 'SUPPORT', 'HOLD']`, `postureFromToggles(escape, support)`
  (ikisi true ise throw) ve `togglesOf(posture)`.
- `supportFuel`, `supportTravelMinutes` (clanAid fonksiyonuna delege eder),
  `supportBayRoom(hangarLevel, used)`, `defenderCount(stacks)`.
- *(2026-10-02 revizyonu, `allocateDefenderTeam` yerine)* `supportFactor({ hostPower, supportPower })`
  (D, en çok ×5), `adjustDefendedDominion(base, A, D)` ve `defendedTransfer(base, supportLoss, A, D)`.
- **Constants:** `MULTI_WORLD.clanDefenseRulesetVersion: 15`; rollout fazında `rulesetVersion: 15`.

### Veri modeli — migration `0126`

Migration expand-only'dir ve untracked 0122–0125'in üstüne gelir.

**Enum ekleri (sona):**

- `mission_kind`: `'clan_support'` (iki bacak).
- `event_kind`: `'clan_support_expiry'`.
- `notification_kind`:
  - `'clan_support_inbound'` — host, dispatch'te, ETA ile;
  - `'clan_support_departed'` — host ve gönderen; `reason` payload'da;
  - `'clan_support_result'` — destekçinin savaş sonucu;
  - `'defence_posture_reset'` — klandan çıkınca `SUPPORT` → `ESCAPE`.

**`planets.defence_posture`:**

- `text NOT NULL DEFAULT 'ESCAPE' CHECK IN ('ESCAPE','SUPPORT','HOLD')`.
- Ruleset 15 altında okunmaz.

**`clan_support_waves`** (status text + CHECK, ortak savaş tabloları gibi):

- Sütunlar: `id`, `season_id`, `clan_id` (snapshot), `sender_player_id`, `host_player_id`,
  `origin_planet_id`, `host_planet_id`, `unit_location` (unique, `support:<uuid>`), `fleet`,
  `damage` (jsonb), `reserved_bulk`, `fuel_paid`, `status`, `return_reason`,
  `outbound_mission_id`, `return_mission_id`, `sent_at`, `arrive_at`, `stationed_at`,
  `expires_at`, `return_at`, `resolved_at`, `battles`.
- `status`: `OUTBOUND | STATIONED | RETURNING | HOME | LOST`.
- `return_reason`: `RECALLED | SENT_BACK | HOST_CLOSED | EXPIRED | BAND | MEMBERSHIP |
  WORLD_CHANGED | FREEZE`.
- CHECK'ler: sender ≠ host; değerler negatif değil; status ile zaman alanları tutarlı.
- İndeksler: `(host_planet_id,status)`, `(sender_player_id,status)`,
  `(origin_planet_id,status)`, `(host_player_id,status)`, `(season_id)`.

**Gemi satırları:**

- `units(origin_planet_id, hull, 'support:<uuid>')`, sahibi gönderen.
- Ortak savaş escrow'unun aynısıdır:
  - `totalUnitsOf` bu satırları gönderenin Hangar'ında sayar (K2);
  - `loadLocked` yalnız `home` okuduğu için ev sahibinde görünmezler;
  - gönderenin dünyası Telescope'ta doğru biçimde AWAY okunur.

**`clan_support_battle_results`** — rapor projeksiyonu, yalnız destek savaştığında yazılır:

- Sütunlar: `report_id`, `mission_id`, `player_id`, `role HOST|SUPPORT`, sent / losses /
  survivors, `power`, `damage`, `loot_lost` (yalnız HOST), `dominion_delta`.
- Unique `(report_id, player_id)`.

**`clan_support_dominion_events`** — destekli **normal** baskının skor günlüğü (FK yok):

- Satır başına: `player_id`, `role ATTACKER|DEFENDER`, `attacker_count`, `defender_count`,
  `base_exchange`, `adjusted_transfer`, `delta`.
- Unique `(mission_id, player_id, role)`.
- Destekli baskın `dominion_events`'e satır **yazmaz**, çünkü o tablonun CHECK'i
  `raw = transfer` istiyor.
- Ortak savaş desteklenen dünyaya saldırırsa D adet DEFENDER satırı
  `clan_war_dominion_events`'e yazılır. Unique (op, player, role) buna zaten izin veriyor.

**`battle_reports`:**

- `defender_count int NOT NULL DEFAULT 1 CHECK (>=1)` eklenir.
- `battle_reports_dominion_audit_check`'e `OR defender_count > 1` eklenir. Bu saf bir
  gevşetmedir. Kısıt `NOT VALID` ile yeniden eklenir, ardından ayrı bir
  `VALIDATE CONSTRAINT` çalışır; böylece büyük tabloda uzun ACCESS EXCLUSIVE kilidi olmaz.
- `reports.ts:863`'teki sabit `defenderCount: 1` artık bu sütundan okunur.

**`probe_reports`:**

- `support jsonb NULL` eklenir: `{ supporters, defence: band, fleetSize: band, classReading }`.
- `posture text NULL` eklenir.
- Yeni `seededFrom` tuzları kullanılır; mevcut bantlar bit düzeyinde aynı kalır.

**Tablo listeleri güncellenir:** `test/helpers.ts` truncate, `servers.ts` wipe (raporlardan
önce sonuçlar), `reclaim.ts` (~:445), `accountDeletion.ts`.

**Durum makinesi:**

```text
dispatch → OUTBOUND                       (host duruşu SUPPORT olmalı)
OUTBOUND  → STATIONED   varış; host kilidi + aynı klan + duruş hâlâ SUPPORT; expiry planlanır
OUTBOUND  → RETURNING   havada recall / send-back / HOST_CLOSED / dünya değişti
                        (movement.recallFlight'tan çıkarılan ortak turnFlight);
                        varışta şart bozuksa MEMBERSHIP / HOST_CLOSED
STATIONED → RETURNING   recall / send-back / HOST_CLOSED / expiry / band / membership / world
                        → planSupportReturn (parentMissionId = outbound, hedef safeHomePlanet)
STATIONED → STATIONED   savaş, survivor var (reserved_bulk ve damage güncellenir)
STATIONED → LOST        savaşta hepsi öldü
RETURNING → HOME        landShips + dock ayrımı
OUTBOUND|RETURNING → LOST  bacakta radyasyon hepsini öldürdü
STATIONED → HOME        zorunlu freeze, anında iniş
```

### Server servisleri

**Yeni `apps/server/src/services/clanSupport.ts`** — `clanWar.ts` desenleriyle:

- `gatherSupport`: tek ret toplayıcı, hem quote hem send kullanır.
- `quoteClanSupport`, `sendClanSupport`, `recallClanSupport`, `sendBackClanSupport`.
- `setDefencePosture(planetId, { escape, support })`: `SUPPORT`'tan çıkışta
  `returnSupportAtWorld(…, 'HOST_CLOSED')` çağırır.
- `planSupportReturn`, `landSupport`, `resolveClanSupportLeg`, `resolveSupportExpiry`,
  `abandonClanSupportLeg`.
- `returnSupportAtWorld(planetId, reason)`, `returnSupportForPlayer(playerId, reason)`,
  `reanchorSupportOrigin(planetId)`.
- `supportBayOf(hostPlanetId)`, `readMySupport`, `publishSupport`.

**Yeni `apps/server/src/services/defenderLine.ts`** — `handlers.ts` ve `clanWarSettlement.ts`
ortak kullanır, kopya kod yok:

- `preReadStations`: host'taki dalgaları kilitsiz okur, aday oyuncu id'lerini `lockLedgers`'a
  ekler.
- `lockStations`:
  - dalga satırlarını kilitler ve durumu yeniden kontrol eder;
  - aynı klanı, `withinTierBand`'i ve duruşun `SUPPORT` olduğunu doğrular;
  - geçemeyenleri savaştan **önce**, dokunmadan eve gönderir ve bildirir;
  - canlı `techOf`, unit satırları ve `wave.damage`'dan stack'leri kurar.
- `escapeAllowed(rv, posture)`.
- `settleStations`: unit satırlarını, hasarı, bulk'ı ve LOST durumunu yazar; destekçi wealth'ini
  yeniden hesaplar.
- `defenderDominion`, `writeDefenderResults`, `notifySupporters`.
- `applyDelta`, `clanWarSettlement`'tan `battleSettlement.ts`'e taşınır.

**Kırılma riskleri** — mevcut çalışan mantığı bozabilecek noktalar:

1. **Toplam survivor ve hasar alanları.**
   - `result.defenderSurvivors` ve `result.defenderDamage` bütün hattın toplamıdır.
   - Bugün ev sahibinin `home` satırları (`handlers.ts:861-885`, `clanWarSettlement.ts:300-312`)
     ve `dockDamaged` (:898) bunlardan yazılıyor.
   - Bu yol değişmezse destekçinin gemileri ev sahibinin `home`'una **kopyalanır**.
   - Çözüm: ev sahibinin home yazımı ve dock'u yalnız host stack outcome'undan okunur.
2. **Toplam kayıp okuyan yerler.** `battle_reports.defenderLosses` toplamdır. Aşağıdakiler
   host-only okumalı (`defender_count > 1` iken `clan_support_battle_results`'tan):
   - recovery lookback (`attackProtection.ts` ~:300) ve `grantRecoveryShield` girdisi;
   - dossier tabanı (`reports.ts` `fieldedAtLeast`);
   - sezon sonu istatistikleri (`handlers.ts` ~:2137-2205). Destekçiler buraya kendi
     satırlarıyla eklenir.
3. **Çıkış dünyası kaybı.** Planlayıcı kararındaki çapa taşıma yapılmazsa gemiler ve yuva yeni
   sahibe sızar.
4. **Parity.** Desteksiz ve duruşu `ESCAPE` olan her savaş bugünküyle bit düzeyinde aynı
   kalmalı (digest ve mevcut raid/joint testleri).
5. **Yeni mission kind.**
   - `session.ts`, `traffic.ts`, `web/galaxy/Fleets.tsx` ve `lib/orders.ts`, `clan_support`'u
     gönderenin normal transfer benzeri uçuşu olarak göstermeli.
   - Web parser'ları bilinmeyen kind'da kırılmamalı (rolling deploy).

**Kilit sırası:** season → planets (id sırası) → clans → players (id sırası) →
`clan_support_waves` (id sırası) → missions.

- Destekçi çıkış dünyaları worker kilit setine **eklenmez**. Settlement o planet satırlarına
  yazmaz; dalga satırı kilidi yeterlidir.
- STATIONED'a geçişi yalnız varış bacağı yapar ve o bacak host kilidini tutar.
- `support:` satırına yazan her yol (reclaim dahil) önce dalga satırını kilitler.
- Dispatch:
  - `{gönderen capital'i, origin, host}` planet'lerini **id sırasıyla** kilitler;
  - sonra host duruşunu ve `SUM(reserved_bulk) FILTER (OUTBOUND, STATIONED)`'ı okur;
  - böylece son yer için yarışta yalnız biri kazanır.
- Recall, send-back ve duruş kaydı önce host planet'ini, sonra dalgaları kilitler. Savaş da aynı
  sırayı izler; aynı anda gelirlerse tek kazanan olur.

**Entegrasyon noktaları:**

- **`worker/handlers.ts`:**
  - `onMissionArrival`, `clan_support` kind'ını generic dallardan önce
    `resolveClanSupportLeg`'e yönlendirir.
  - Normal baskın defender bloğu `defenderLine`'ı kullanır; `escape` duruştan gelir.
  - Destek savaşıyorsa (D > 1) Dominion:
    - `base = battleDominion(...)`, `adj = adjustJointDominion(base, 1, D)`;
    - saldırgana `+adj`, savunan takıma `allocateDefenderTeam(−adj)`;
    - `recordClanBattleScore(adj, −adj)`, günlük satırları ve `report.dominionSwing = adj`
      yazılır;
    - `bookBattle` yalnız bu dalda bypass edilir.
  - `HANDLERS`'a `clan_support_expiry` eklenir; freeze guard'ı canlı dalgaları sayar.
  - `assertDominionLedgers(roster, scoreEvents, rv, [...jointWarEvents, ...supportEvents])`
    (~:2057).
  - Sezon sonu istatistikleri `defender_count > 1` raporlarda payları sonuç tablosundan okur.
- **`services/clanWarSettlement.ts`:** aynı helper kullanılır; `escape` duruştan gelir.
  `defenderCount` sabit 1 olmaktan çıkar ve DEFENDER satırları çoğalır.
- **`services/flight.ts`:**
  - `minesOf`, `kind ≠ 'clan_support'` filtresiyle bu kind'ı dışlar.
  - `baysInUse`, çıkış dünyası bazında HOME ya da LOST olmayan dalgaları ekler.
- **`services/intel.ts` `resolveProbe`:** host'taki bant içi STATIONED dalgalardan support
  okuması üretir ve duruşu kesin yazar.
- **`services/planetView.ts`:** ruleset 15 altında null olan şu alanları ekler:
  - `defencePosture { escape, support, supportLockedReason }`;
  - `clanSupport { room {used, reserved, total}, waves [...] }`.
- **`services/reports.ts`:**
  - `readBattleReportsIn` erişimine `clan_support_battle_results` report id'leri eklenir.
  - Destekçinin `yourFleet` ve `yourLosses` alanları kendi dalgasıdır; bütün hat ayrı bir
    `defenseLine` alanında gelir.
  - Saldırgan isimleri ve kanıtlanmış kayıpları görür.
  - Rival özeti destekçi için saldırganı sayar.
  - `fieldedAtLeast` host-only okur.
- **`services/attackProtection.ts`:** recovery lookback ve `grantRecoveryShield` host-only
  çalışır.
- **Yaşam döngüsü kancaları:**
  - `clan.ts` leave/kick/disband → `returnSupportForPlayer` ve duruş `SUPPORT` → `ESCAPE`.
  - `ownership.ts` `transferPlanetControl`, `loyalty.ts` `secedeColony`,
    `reclaim.ts` ve `accountDeletion.ts`:
    - ağırlanan dalgalar → `returnSupportAtWorld`;
    - çıkmış dalgalar → `reanchorSupportOrigin`;
    - duruş `ESCAPE`'e sıfırlanır.
  - `reclaim.ts` `busy` canlı dalgaları görür.
  - `commanderTransfer.ts` gönderilmiş ya da ağırlanan canlı dalga varken reddeder.
  - `worker/abandon.ts` → `abandonClanSupportLeg`.
  - `radiation.ts` bacak dozunu uygular.
  - `servers.ts` wipe.
  - `session.ts` ve `traffic.ts` yeni kind'ı projekte eder.
- **`services/bots/judgement.ts`:** probe'daki support bandını tahmine ekler; kaçışı duruştan
  okur.

### Public API — strict Zod ve `idempotentMutation`

| Method | Path | Not |
|---|---|---|
| POST | `/api/clan/support/quote` | Body `{originPlanetId, hostPlanetId, fleet}`. Dönüş aşağıda. |
| POST | `/api/clan/support` | Aynı body. `{wave, planet}` döner. Aynı key tekrarlanırsa yakıt ikinci kez alınmaz. |
| POST | `/api/clan/support/:waveId/recall` | Yalnız gönderen. Tekrar çağrı mevcut durumu döner. |
| POST | `/api/clan/support/:waveId/send-back` | Yalnız ev sahibi. |
| GET | `/api/clan/support` | Benim dalgalarım (Fleet sayfası için). |
| POST | `/api/planet/:planetId/defence-posture` | Body `{escape, support}`. `{planet, returnedWaves}` döner. |

Quote dönüş alanları: `refusals[]`, `arriveAt`, `travelMinutes`, `returnMinutes`, `fuel`,
`bays`, `hostRoom {used, reserved, total, after}`, `band {ok, mine, theirs}`, `stationUntil`,
`seasonClipped`, `personalHangar`, `senderShieldUntil`.

**Ret kodları:**

- Genel: `CLAN_SUPPORT_UNAVAILABLE`, `NOT_IN_CLAN`.
- Hedef ve üyelik: `CLAN_SUPPORT_SELF`, `CLAN_SUPPORT_TARGET`, `CLAN_SUPPORT_CLOSED` (host
  duruşu `SUPPORT` değil), `CLAN_SUPPORT_MEMBERSHIP`, `CLAN_SUPPORT_MEMBER_IMMATURE{until}`,
  `SHIELDED_SENDER{until}`, `CLAN_SUPPORT_TIER_BAND{mine,theirs}`.
- Kapasite ve kaynak: `CLAN_SUPPORT_ROOM_FULL{used,total}`, `NO_FREE_BAY`, `FAULT_SHIPYARD`,
  `INSUFFICIENT_FUEL`, `NOT_ENOUGH_SHIPS`, `IMMOBILE_FLEET`, `CLAN_SUPPORT_NONCOMBATANT`,
  `CLAN_SUPPORT_SEASON_TOO_SHORT`.
- Dalga işlemleri: `CLAN_SUPPORT_NOT_FOUND`, `CLAN_SUPPORT_NOT_OWNED`,
  `CLAN_SUPPORT_NOT_HOST`, `CLAN_SUPPORT_LANDING`.
- Duruş: `POSTURE_CONFLICT` (ikisi birden açık).

### Web — 350px, dört soru (Netlik · Tahmin · Karar desteği · Etkileşim maliyeti)

- **Hangar "Savunma duruşu ve Klan Desteği" bölümü:**
  - Yer: `screens/PlanetScreen.tsx`, `HangarRoom` (:2636) yanında; mantık `lib/clanSupport.ts`.
  - **Duruş kartı:**
    - İki anahtar: "Taktik geri çekilme" ve "Klan desteği kabul".
    - Birini açmak diğerini kapatır.
    - Her anahtarın altında tek satır sonuç:
      - "Ezici saldırıda filon kalkar, kurtulur";
      - "Klan arkadaşların filo yollayabilir · filon geri çekilmez";
      - ikisi kapalıyken "Filon her zaman savaşır".
    - Klansızken destek anahtarı devre dışıdır: "Klan desteği için bir klana katılmalısın".
    - **Kaydet** butonu yalnız değişiklik varken aktiftir. `SUPPORT`'tan çıkış dalgaları eve
      gönderecekse satır içi onay sorulur: "3 dalga eve döner, yakıt iadesi yok".
  - **Bölme** (yalnız `SUPPORT` iken ya da dalga varken):
    - Aynı ölçekte iki bar: "Kendi filon 312/470" ve "Klan desteği 205/470 · ayrı bölme,
      senin yerini yemez".
    - Dalga satırları: gönderen, gövde çipleri, bulk, hasar ikonu, "11 sa 20 dk kalır" ya da
      "Geliyor 14:32", ve [Geri gönder] (satır içi onaylı).
    - Bant dışı dalgada rozet: "Bant dışı · saldırı gelirse savaşmadan eve döner".
    - Üçten fazla dalga katlanır.
- **Galaxy Focus "Destek gönder":**
  - Yer: `galaxy/FocusPanel.tsx`, yalnız klan arkadaşının dünyasında.
  - Yeni `screens/ClanSupportSheet.tsx`'i açar; sheet, `ClanWaveSheet` composer'ını ve
    basılı-tut-gönder'i yeniden kullanır.
  - Sheet'te gösterilenler:
    - çıkış dünyası çipleri ve filo seçici;
    - varış saati ve göreli süre (yalnız kendi varışı);
    - "Yakıt X D · gidiş+dönüş, iade yok";
    - uçuş yuvası (ör. 3/5);
    - ev sahibi bölme barı, gönderim öncesi ve sonrası;
    - kademe: "Sen T3 · ev sahibi T4 ✓ (±1)";
    - süre: "En çok 12 saat · bitiş 02:32";
    - Dominion: "Hâkimiyetin değişmez; onu ev sahibi taşır" (2026-10-02 revizyonu).
  - İlk ret nedeni butonun üstünde yazar, ör. "Ali bu dünyada desteğe kapalı".
- **Fleet sayfası** (`v2/hud/FleetPage.tsx` ve `lib/fleetPage.ts`):
  - "Klan desteği" grubu: dalgalarım, durumları ve geri sayımları.
  - [Geri çağır] `arriveAt`'ta gizlenir; varıştan sonra "Dönüş = uçulan süre" notuyla görünür.
- **Probe ve dossier:**
  - Duruş satırı: "Geri çekilme açık" / "Klan desteği açık" / "Sonuna kadar savaşır".
  - "Klan desteği" satırı: "2 destekçi · savunma 8–11k · 30–40 gemi · sınıf".
  - Ruleset 15 altında bu satırlar çizilmez.
- **LaunchSheet ve `lib/useTargetReading.ts`** (:213-227):
  - Destek bandı `opposing`'e eklenir (alt + alt, üst + üst); tahmin ve kırılma çizgileri
    buna göre hesaplanır.
  - Kaçış hükmü duruştan gelir: `ESCAPE` mevcut kuralla, `SUPPORT` ya da `HOLD` "Bu dünya
    geri çekilmez" der.
  - `ForceCompare` ve `ForceRuler` metinleri güncellenir.
- **Defender gezegen kaçış paneli:** duruşu ve anahtara giden kısa yolu gösterir.
- **BattleReports:**
  - "Savunma hattı" bölümü: host ve destekçiler; gönderilen, kayıp, kalan ve Dominion payı.
  - Saldırgan yalnız isimleri ve kayıpları görür.
- **Bildirimler ve cache:**
  - Dört yeni kind `lib/notifications.ts`'e eklenir.
  - `publishPrivate(…,'support')` gönderene ve ev sahibine gider; `session/shardEvents.ts`
    üzerinden `keys.clanSupport` ve planet query'sini invalidate eder.
  - Mutation cevabı güncel planet ve wave'i taşır, waterfall olmaz.
  - `api/schemas.ts`'teki yeni alanlar opsiyonel olur, eski payload kırılmaz.
- **Metinler:** `i18n/locales/*/clanSupport.ts`, beş dilde. Untracked `ja` o sırada duruyorsa
  altıncı dil olarak eklenir.
- **Galeri:** `v2/gallery/Gallery.tsx`'e fixture'lar eklenir ve her yüzey fotoğraflanır.

## Uygulama fazları

Her faz aynı döngüyle ilerler: test yaz → FAIL gör → uygula → hedefli koşu → PASS.

| Faz | Kapsam | İlk yazılacak testler |
|---|---|---|
| P0 | Gate, sabitler, duruş | `rules/test/clan-support.test.ts`: `clanDefenseApplies`, `postureFromToggles` (ikisi açık → throw), `togglesOf` |
| P1 | Çok-defender combat | Parity digest değişmez. `resolveBattle([host])` seeded korpusta `resolveJointCombat`'a deep-equal. N stack için tur başına 2 rng çekimi. Host combat hull'ı destek taşıyıcısını örter. Aegis taraf geneli, Nullifier çok-stack. Host dışı stack'te kara silahı throw. Hasarlı destek önce ölür. Stack toplamları aggregate'e eşit. Eşit teknolojili hattı iki stack'e bölmek tur başına en fazla 1 kill fark yaratır. |
| P2 | Kaçış ve duruş | `escapeVerdict` `SUPPORT`/`HOLD` → STAND, `ESCAPE` → mevcut sonuç. `escapeAllowed(rv, posture)` tablosu (rv < 15 her zaman mevcut kural). |
| P3 | Dominion rules | Eski `adjustJointDominion` oracle olarak: D=1, A=1..10 aynı sonuç. A < D'de iki işaret. Overflow. `allocateDefenderTeam`: Σ = toplam, host ≥ ¾, sıfır güçlü destekçiye 0, işaret takımı izler, deterministik. |
| P4 | Schema | `server/test/clan-support-schema.test.ts`: CHECK ve unique'ler, enum sırası, `defence_posture` CHECK'i, gevşetilmiş rapor CHECK'i (D > 1 ve swing ≠ raw kabul; D=1 ve operasyonsuz red), truncate listesi. |
| P5 | Duruş API | `clan-support-posture.test.ts`: ikisi açık → `POSTURE_CONFLICT`. Klansız destek → `NOT_IN_CLAN`. Kaydet `SUPPORT` → `ESCAPE` dalgaları `HOST_CLOSED` ile döndürür. Leave/kick/disband `SUPPORT` → `ESCAPE` ve bildirim. Control transfer duruşu sıfırlar. Gate. |
| P6 | Dispatch | `clan-support-send.test.ts`: bütün ret kodları (`CLAN_SUPPORT_CLOSED` dahil), gate, yakıt ×2, yuvanın tutulması, gönderen Hangar'ının saydığı ve ev sahibininkinin saymadığı, idempotent key, son yer yarışı (iki bağlantı, `Promise.all`, tam olarak biri kazanır). |
| P7 | Bacaklar | `clan-support-legs.test.ts`: varış → STATIONED ve kırpılmış expiry. Varışta duruş kapalıysa dokunmadan dönüş. Havada recall (dönüş = uçulan süre, iade yok). Varış sonrası recall. `arriveAt` anında recall → 409. Gelen ve nöbetteki dalgayı geri gönderme. Expiry ile send-back aynı anda. Safe-home, radyasyon, yuvanın serbest kalması, abandon, freeze guard. |
| P8 | Normal baskın | `clan-support-battle.test.ts`: **ev sahibinin `home`'u yalnız kendi survivor'larını içerir, destek gemisi kopyalanmaz, dock'a yalnız host hasarı gider**. Canlı tech. Recovery yalnız host (lookback dahil). `SUPPORT` ve `HOLD`'da kaçış yok (destek gelmemişken de). `ESCAPE`'te bugünkü sonuç. Bant ya da üyelik dışı dalga savaştan önce döner ve bildirim alır. Silinen dalga → LOST. Hasar taşınır, sonraki savaş hasarlı girer. A=1, D=2/3'te ledger'lar, klan event'leri ve günlük sıfır toplamlı; host payı ≥ ¾; `dominion_events` satırı yok. 10 saniyelik pencerede her iki sıra. Admin destekçi → scoreEligible false. Mevcut baskın testleri değişmeden geçer. |
| P9 | Ortak savaş ↔ desteklenen dünya | D > A ve A > D'de sıfır toplam ve çoklu DEFENDER satırı. `clan-war-battle` testleri D=1 ile değişmeden geçer. |
| P10 | Yaşam döngüsü | Leave, kick ve disband (gönderen ve ev sahibi olarak), control transfer, secession, reclaim, hesap silme, iki yönde commander transfer reddi, wipe. Çapanın capital'e taşınması (yeni sahibin Hangar'ı ve yuvası temiz). Sezon sonu istatistiği. Freeze'de `assertDominionLedgers` destek satırlarıyla geçer, kurcalanmış satır throw eder. Deadlock soak: savaş + leave + recall + expiry + duruş kaydı ×50, hiç 40P01 yok. |
| P11 | Okumalar | `planetView.defencePosture` ve `clanSupport`; `GET /api/clan/support`. Probe'da support okuması ve kesin duruş; mevcut bantlar destekli ve desteksiz aynı; bant dışı dalga okumaya girmez. Pending ve trafik yeni kind'ı gösterir. Destekçinin rapor erişimi, saldırgan sisi, host-only dossier tabanı. |
| P12 | Web | `apps/web/test/clan-support-*.test.tsx`: duruş kartı (karşılıklı dışlama, Kaydet, klansız devre dışı, onay), Hangar bölmesi, sheet, Fleet grubu, `useTargetReading` (toplam ve duruş hükmü), probe satırları, rapor bölümü, şemalar, `i18n.test.ts`. Ardından galeri kamerası ve 350px'te `node tools/visual.mjs`. |
| P13 | Rollout | `rulesetVersion` 14 → 15. Varsayılan sürüme dayanan testler düzeltilir. Dokümanlar güncellenir. |

**Faz notları:**

- P0–P12 boyunca testler sezonu açıkça ruleset 15 ile kurar. Varsayılan P13'e kadar 14 kalır.
- Migration numarası (0126) uygulama başında `git status` ve Drizzle journal ile yeniden
  kontrol edilir. Başka oturumun migration'ı silinmez ya da ezilmez.

## Birlikte değişmesi gerekenler ve dokümanlar

- **Yansımalar:** server, rules, `bots/judgement.ts`, `useTargetReading`, LaunchSheet, ForceCompare
  metinleri, beş dilde metin (varsa altı) ve testler.
- **`packages/sim`:** değişiklik gerekmez; yalnız solo combat kullanıyor. Testleri parity
  kontrolü olarak koşulur.
- **Dokümanlar:**
  - `docs/game-design.md`: Clans bölümüne savunma desteği; Taktik geri çekilme bölümüne duruş.
  - `docs/balance.md`: 12 saat, bölme = Hangar odası, D çarpanı (≤ ×5), destekçi kayıpları 1:1, yakıt ×2.
  - `docs/interface.md`: duruş kartı, Hangar bölmesi, sheet, Fleet grubu, probe satırları.
  - `docs/battle-reports.md`: savunma hattı ve sis.
  - `docs/glossary.md`: Klan Desteği, Destek bölmesi, Savunma duruşu, Geri gönder.
  - `docs/architecture.md`: kilit sırası, tablolar, mission kind, günlük.
  - `docs/review-sight.md`: probe'da destek ve duruş okuması; ortak radar yok.
  - `docs/clan-joint-war-implementation-plan.md` §16: "ortak savunma" artık ayrı bir özellik
    olarak işaretlenir.

## Kapsam dışı ama gözlendi

Ortak savaşta bugün de var olan iki sorun; bu işte düzeltilmez.

- **Sezon sonu istatistiği:** Ortak savaş raporlarında `attackerPlayerId` liderdir, bu yüzden
  bütün saldırı lidere yazılıyor ve katılımcılar istatistik almıyor.
- **Çıkış dünyası kaybı:** Ortak savaş katkısının çıkış dünyası kaybedilirse escrow satırları ve
  yuva sayımı yeni sahibe sızabilir (24 saatle sınırlı).

İkisi ayrı bir iş olarak sahibe raporlanacak.

## Doğrulama

1. **Her fazda:** dokunulan paketin hedefli testleri koşulur. Server testleri tek Postgres'i
   paylaştığı için seri çalışır; başka bir oturum koşuyorsa ayrı bir `_test` DB kullanılır.
2. **Rules:** `pnpm --filter @astera/rules test`. `combat-parity-digest.test.ts` ve
   `clan-war.test.ts` hep yeşil kalır.
3. **Server:** `clan-support-*.test.ts`, `clan-war-*.test.ts`, `dominion.test.ts`,
   `interception.test.ts`, `crossfire.test.ts` ve fleet escape testleri.
4. **Web:** `clan-support-*`, `clan-war-*`, `launch-sheet`, `intel-surface`, `fleet-escape`,
   `battle-report-*`, `i18n`.
5. **İş bitince, bir kez:** tam kapı `pnpm verify` (typecheck + lint + bütün testler). HEAD'de
   bilinen kırmızı set dışında yeni kırmızı olmamalı.
6. **Görsel:**
   - Galeri kamerasıyla her yeni parça fotoğraflanır: duruş kartı, bölme, sheet, Fleet grubu,
     probe satırları, rapor.
   - 350px'te `node tools/visual.mjs` koşulur. Her koşu bir commander kaydettiği için koşu
     sayısı az tutulur.
7. **Uçtan uca elle oynatma** (iki klan arkadaşı ve bir saldırgan):
   - Ev sahibi duruşu `SUPPORT` yapıp kaydeder.
   - Destek gönderilir ve bölmede görünür.
   - Saldırganın probe'u duruşu ve "Klan desteği" okumasını gösterir.
   - Saldırı gelir; destek birlikte savaşır, kaçış olmaz.
   - Rapor üç tarafta da doğru görünür.
   - Dominion sıfır toplamlı kalır ve ev sahibi en büyük payı alır.
   - Duruş `ESCAPE`'e çevrilince dalgalar döner.
   - Recall ve 12 saatlik otomatik dönüş çalışır.
