# Sessiz Uzay — şema ve kilit envanteri

8 Eylül 2026 çalışma ağacı. Bu envanter şema ve doğrudan kilit ifadelerinden çıkarılmıştır;
dinamik SQL, JSON içindeki UUID anlamı veya dolaylı helper çağrıları için semantik incelemenin
yerini tutmaz. Politika planlanan transfer davranışıdır; bütün adaptörlerin uygulanmış olduğu
anlamına gelmez. Uygulanan parçalar `sessiz-uzay-uygulama-durumu.md` içinde ayrıdır.

## Tablo ilişkileri

| Tablo | Açık FK hedefleri | JSON kolonları | Taşıma politikası |
|---|---|---|---|
| `accounts` | — | `lifetime` | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |
| `announcements` | `accounts` | — | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |
| `announcement_reads` | `accounts`, `announcements` | — | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |
| `feedback_entries` | `accounts` | — | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |
| `bot_profiles` | `accounts` | — | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |
| `shards` | — | — | Yerleşim altyapısı; kaynak/target cycle ve rol uyumu zorunlu. |
| `season_cycles` | — | — | Yerleşim altyapısı; kaynak/target cycle ve rol uyumu zorunlu. |
| `return_queue_counters` | `seasonCycles`, `shards` | — | Yerleşim altyapısı; kaynak/target cycle ve rol uyumu zorunlu. |
| `seasons` | `seasonCycles`, `shards` | — | Yerleşim altyapısı; kaynak/target cycle ve rol uyumu zorunlu. |
| `season_results` | `accounts`, `seasons` | `recap` | Final placement/cycle sonucu; tek sonuç güvencesi henüz eklenmedi. |
| `players` | `accounts`, `seasons`, `shards` | `unlocks_seen` | Player ve bütün owned worlds atomik taşınır; UUID korunur. |
| `return_applications` | `players`, `seasonCycles`, `shards` | — | Kalıcı sıra; geçici blocker sequence değiştirmez. Terminal history player snapshot ile kalır. |
| `clans` | `seasons` | — | Kaynak klan kalır; zorunlu çıkış ve leadership uzlaştırması yapılmalı. |
| `clan_memberships` | `clans`, `players`, `seasons` | — | Kaynak klan kalır; zorunlu çıkış ve leadership uzlaştırması yapılmalı. |
| `clan_requests` | `clans`, `players`, `seasons` | — | Kaynak klan kalır; zorunlu çıkış ve leadership uzlaştırması yapılmalı. |
| `clan_ceasefires` | `clans`, `players`, `seasons` | — | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `clan_messages` | `clans`, `players`, `seasons` | — | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `clan_events` | `clans`, `seasons` | `payload` | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `chat_messages` | `players`, `seasons` | — | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `galaxy_events` | `seasons` | `payload` | Kaynak mekânsal durum/takvim; hedefe taşınmaz. Enkazın konumu kendi snapshotıdır. |
| `galaxy_event_occurrences` | `seasons` | `effect` | Kaynak mekânsal durum/takvim; hedefe taşınmaz. Enkazın konumu kendi snapshotıdır. |
| `planets` | `players`, `seasons` | `built_ever` | Player ve bütün owned worlds atomik taşınır; UUID korunur. |
| `neutral_planet_state` | `planets` | — | Yalnız taşınan kontrollü koloninin state bağı varsa denetlenir; gerçek neutrals taşınmaz. |
| `buildings` | `planets` | — | World/commander FK üzerinden korunur; yeniden başlangıç yapılmaz. |
| `player_research` | `players` | — | World/commander FK üzerinden korunur; yeniden başlangıç yapılmaz. |
| `planet_research` | `planets` | — | World/commander FK üzerinden korunur; yeniden başlangıç yapılmaz. |
| `satellites` | `planets` | — | World/commander FK üzerinden korunur; yeniden başlangıç yapılmaz. |
| `sensor_epochs` | `planets`, `players`, `seasons` | — | Source epoch kapanır; target epoch açılır. SQL season filtresi ve eşit koordinat testi eklendi. |
| `units` | `planets`, `players` | — | Own/pad assets korunur; canlı foreign/away/interception blocker. |
| `missions` | `planets`, `players`, `seasons` | `fleet`, `loot`, `cargo`, `tech` | Tarih kaynakta kalır; aktif leg ve ilgili third-party uçuş blocker. |
| `attack_commitments` | `clans`, `missions`, `players`, `seasons` | — | Tarih/cooldown korunur; gidip dönmek aktif limiti sıfırlamaz. |
| `clan_aid_commitments` | `clans`, `missions`, `planets`, `players`, `seasons` | `value` | Tarih/cooldown korunur; gidip dönmek aktif limiti sıfırlamaz. |
| `clan_raid_roster` | `clans`, `missions` | — | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `clan_loot_shares` | `clans`, `players`, `seasons` | — | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `clan_score_events` | `clans`, `seasons` | — | Kaynak sosyal/savaş tarihi ve cooldown; yeni galaksiye join ile taşınmaz. |
| `strategic_assets` | `missions`, `planets` | — | Own/pad assets korunur; canlı foreign/away/interception blocker. |
| `build_orders` | `planets` | `cost` | Kimlik, maliyet ve deadline korunur; typed kişisel event eşleştirilir. |
| `research_orders` | `planets`, `players` | `cost` | Kimlik, maliyet ve deadline korunur; typed kişisel event eşleştirilir. |
| `scheduled_events` | `seasons` | `payload` | transferReferences.ts politikasına göre; typed ref sahipliği ayrıca doğrulanmalı. |
| `battle_reports` | `missions`, `pirateRaids`, `planets`, `players`, `seasons` | `rounds`, `loot`, `attacker_losses`, `defender_losses`, `attacker_fleet`, `defender_fleet`, `defence_salvage` | Kaynak tarihi/snapshot korunur; aktif effect blocker; current-world join okuyucuları denetlenmeli. |
| `strategic_impacts` | `missions`, `planets`, `players`, `seasons` | `destroyed_fleet`, `destroyed_resources`, `level_changes`, `destroyed_orders` | Kaynak tarihi/snapshot korunur; aktif effect blocker; current-world join okuyucuları denetlenmeli. |
| `strategic_interceptions` | `missions`, `planets`, `players`, `seasons`, `strategicAssets` | — | Kaynak tarihi/snapshot korunur; aktif effect blocker; current-world join okuyucuları denetlenmeli. |
| `scan_events` | `planets` | — | Kaynak tarihi/snapshot korunur; aktif effect blocker; current-world join okuyucuları denetlenmeli. |
| `probe_reports` | `missions`, `planets`, `players` | `stock`, `deuterium_stock`, `defence`, `fleet_size`, `silhouette` | Kaynak tarihi/snapshot korunur; aktif effect blocker; current-world join okuyucuları denetlenmeli. |
| `probe_world_memories` | `planets`, `players`, `probeReports` | `silhouette` | Tarih korunur; yeni placement için earned-sight ayrımı hâlâ yapılacak. |
| `watches` | `planets`, `players` | — | Observer veya target taşınınca canlı bağ kapanır; cooldown geçmişi korunur. |
| `asteroid_claims` | `seasons` | — | Kaynak mekânsal durum/takvim; hedefe taşınmaz. Enkazın konumu kendi snapshotıdır. |
| `pirate_state` | `players`, `seasons` | `losses` | Kaynak mekânsal durum/takvim; hedefe taşınmaz. Enkazın konumu kendi snapshotıdır. |
| `debris_fields` | `missions`, `planets`, `seasons` | — | Kaynak mekânsal durum/takvim; hedefe taşınmaz. Enkazın konumu kendi snapshotıdır. |
| `pirate_raids` | `planets`, `players`, `seasons` | `fleet`, `tech`, `loot` | Tarih kaynakta kalır; aktif leg ve ilgili third-party uçuş blocker. |
| `trade_runs` | `galaxyEventOccurrences`, `planets`, `players`, `seasons` | `fleet`, `give`, `want`, `rate` | Tarih kaynakta kalır; aktif leg ve ilgili third-party uçuş blocker. |
| `mining_runs` | `debrisFields`, `planets`, `seasons` | — | Tarih kaynakta kalır; aktif leg ve ilgili third-party uçuş blocker. |
| `notifications` | `players` | `payload` | Kişisel geçmiş korunur; link/replay current placement eylemi başlatmamalı. |
| `request_log` | `players` | `response` | Kişisel geçmiş korunur; link/replay current placement eylemi başlatmamalı. |
| `reward_grants` | `players` | — | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |
| `account_rewards` | `accounts` | — | Kimlik/ödül korunur; taşıma yeni ödül veya account yaratmaz. |

## Doğrudan kilit alan noktalar

Bu liste pre-read → lock → final authority yeniden okumasını incelemek için başlangıçtır.
`FOR SHARE` tek başına transferi diğer ordinary mutations ile dışlamaz; transfer iki season
satırını baştan UPDATE kilitlemelidir. Presence player→application yönünde kalır.

```text
apps/server/src/routes/season.ts:152:        .for('update')
apps/server/src/routes/planet.ts:114:        .for('update');
apps/server/src/routes/planet.ts:136:      )).for('update');
apps/server/src/db/schema.ts:232:   * with `FOR UPDATE SKIP LOCKED`, so two workers can never drive one bot at once
apps/server/src/db/schema.ts:1744: * had to learn the hard way that `SELECT ... FOR UPDATE` cannot lock a row that
apps/server/src/services/tradeField.ts:17: * table and therefore cannot reach D150's "seed the row before `FOR UPDATE`"
apps/server/src/services/season.ts:312:        .for('update');
apps/server/src/services/clanChat.ts:104:  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-chat:${membership.clanId}`}))`);
apps/server/src/services/clanChat.ts:185:    )).for('update');
apps/server/src/services/clanCombat.ts:30:    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for('update');
apps/server/src/services/clanCombat.ts:127:  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`personal-attack:${input.attackerPlayerId}:${input.targetPlayerId}`}))`);
apps/server/src/services/clanCombat.ts:145:    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-attack:${attackerMembership.clanId}:${input.targetPlayerId}`}))`);
apps/server/src/services/planet.ts:210:    .for('share');
apps/server/src/services/planet.ts:251:  const [row] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
apps/server/src/services/pirateRaid.ts:431:   * `SELECT ... FOR UPDATE` locks a ROW, and it cannot lock one that is not there.
apps/server/src/services/pirateRaid.ts:458:    .for('update');
apps/server/src/services/clan.ts:171:    .for('update');
apps/server/src/services/clan.ts:210:    .for('update');
apps/server/src/services/clan.ts:642:  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-identity:${input.actor.seasonId}`}))`);
apps/server/src/services/clan.ts:934:    .where(eq(clanRequests.id, input.requestId)).for('update');
apps/server/src/services/clan.ts:1037:  )).for('update');
apps/server/src/services/clan.ts:1264:  )).for('update');
apps/server/src/services/returnQueue.ts:10:  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`admission:${cycleId}:${targetShardId}`}, 0))`);
apps/server/src/services/returnQueue.ts:36:  const [commander] = await tx.select().from(players).where(eq(players.id, initial.id)).for('update');
apps/server/src/services/returnQueue.ts:52:    .for('update');
apps/server/src/services/returnQueue.ts:97:    )).for('update');
apps/server/src/services/presence.ts:57:          .where(eq(players.accountId, accountId)).for('update');
apps/server/src/services/waitingServers.ts:19:    await tx.execute(sql`select pg_advisory_xact_lock(83202488)`);
apps/server/src/services/waitingServers.ts:20:    const [source] = await tx.select().from(seasons).where(eq(seasons.id, sourceSeasonId)).for('share');
apps/server/src/services/mining.ts:588:      .for('update');
apps/server/src/services/mining.ts:851: * row is taken `FOR UPDATE` so two harvesters landing in the same second block on
apps/server/src/services/mining.ts:865:    .for('update');
apps/server/src/services/strategic.ts:360:      .for('update');
apps/server/src/services/strategic.ts:462:    .for('update');
apps/server/src/services/strategic.ts:504:    .for('update');
apps/server/src/services/strategic.ts:726:    .for('update');
apps/server/src/services/clanLoot.ts:156:    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-loot:${playerId}`}))`);
apps/server/src/services/clanLoot.ts:259:  )).orderBy(asc(clanLootShares.createdAt), asc(clanLootShares.id)).for('update');
apps/server/src/services/galaxyEvents.ts:306:    .for(purpose === 'membership' ? 'share' : 'update');
apps/server/src/services/research.ts:64:      .for('update');
apps/server/src/services/research.ts:238:    .for('update');
apps/server/src/services/research.ts:290:      .for('update');
apps/server/src/services/chat.ts:136:    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`chat:${me.player.seasonId}`}))`);
apps/server/src/services/chat.ts:218:      .for('update');
apps/server/src/services/ownership.ts:107:    const [world] = await tx.select().from(planets).where(eq(planets.id, id)).for('update');
apps/server/src/services/ownership.ts:201:  await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, capital.id)).for('update');
apps/server/src/services/reclaim.ts:579:          .for('update');
apps/server/src/services/neutral.ts:62:  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
apps/server/src/services/neutral.ts:422:    .where(eq(neutralPlanetState.planetId, planetId)).for('update');
apps/server/src/services/neutral.ts:424:  const [world] = await tx.select().from(planets).where(eq(planets.id, planetId)).for('update');
apps/server/src/services/bots/roster.ts:109:    `pg_advisory_xact_lock` serialises the `max(ordinal) + 1` read against a second
apps/server/src/services/bots/roster.ts:114:    await tx.execute(sql`select pg_advisory_xact_lock(159159159)`);
apps/server/src/services/bots/sweep.ts:29: * moving `next_action_at` forward under `FOR UPDATE SKIP LOCKED` — so two processes
apps/server/src/services/bots/sweep.ts:304:      `FOR UPDATE` over a join locks a row in BOTH tables, so claiming a turn also
apps/server/src/services/bots/sweep.ts:318:      .for('update', { skipLocked: true })
apps/server/src/services/movement.ts:458:    .for('update');
apps/server/src/services/movement.ts:515:    .for('update');
apps/server/src/services/idempotency.ts:39:    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope}))`);
apps/server/src/services/servers.ts:426:    await tx.execute(sql`select pg_advisory_xact_lock(83202488)`);
apps/server/src/services/clanAid.ts:437:  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-aid:${input.recipientPlayerId}`}))`);
apps/server/src/services/clanAid.ts:585:    .where(eq(clanAidCommitments.missionId, rootMissionId)).for('update');
apps/server/src/worker/handlers.ts:213:      await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, id)).for('update');
apps/server/src/worker/handlers.ts:1505:      .for('update');
apps/server/src/worker/handlers.ts:1713:      .for('update');
apps/server/src/worker/handlers.ts:1857:      .for('update');
apps/server/src/worker/handlers.ts:1968:      Held FOR UPDATE and spent with a status guard, because two strikes crossing
apps/server/src/worker/handlers.ts:1989:      .for('update');
apps/server/src/worker/queue.ts:18: * FOR UPDATE SKIP LOCKED is what makes this crash-safe and horizontally scalable
apps/server/src/worker/queue.ts:24: * `FOR UPDATE SKIP LOCKED` inside a subquery, which is why this one is raw.
apps/server/src/worker/queue.ts:37:          FOR UPDATE SKIP LOCKED
```

## Açık zorunlu kontroller

- Her live GET için tek placement snapshot; HTTP intent version ve eski SSE frame guard.
- claimDue→handler aralığı ve complete/fail/abandon için claim generation.
- Klan helperlarında season→clan→player→world sırası; zorunlu ayrılık tüm dalları.
- Tarih sorgularının current planets/players join ile target konumunu tarih diye okumaması.
- Pirate reward distinct kimliğinin season+index olması; cycle recap ve tek sonuç.
- Shared admission altında yeni join/Academy/bot ile main vacancy consumption yarışı.
- Personal event typed ref sahipliği: order ID / strategic asset ID / mission ID ayrımı.
- Audit/outbox FK ve global wipe sırası; bu tablolar henüz mevcut değil.
