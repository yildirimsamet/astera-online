# Sezon Arşivi, Komutan Karneleri ve Ödüller — Uygulama Süreci

Son güncelleme: 2026-09-15

Kaynak görev: [`season-history-stats-rewards-agent-prompt.md`](season-history-stats-rewards-agent-prompt.md)

## Durum

**Aktif faz:** 5 — Onaylanan reward entitlement/payout akışı (TDD)

**Genel ilerleme:** Arşiv/profile API çekirdeği, versioned stats snapshot altyapısı, çok sahipli gezegen attribution modeli, typed client contract ve mobil arşiv/profile yüzeyi test-first uygulandı. Eksik lifecycle edge-case kapsamı, balance simülasyonu ve reward karar kapısı üzerinde çalışılıyor.

## Değişmezler

- Canlı `/api/leaderboard` veri kapsamı ve satır davranışı değişmeyecek.
- Canlı sezonda hiçbir komutanın ayrıntılı karnesi açılmayacak.
- Ayrıntılı profiller yalnızca tamamlanmış (`frozen`/`wiped`) sezon snapshot'larından okunacak.
- `Genel` görünümü canlı veriyi içermeyecek.
- Server istatistik ve ödül konusunda tek otorite olacak.
- Kod değişiklikleri test-first yapılacak.
- Production veritabanına write yapılmayacak.

## Fazlar

- [x] Görev prompt'u ve repository çalışma kuralları okundu.
- [x] Node.js ve React performans becerilerinin talimatları okundu.
- [x] Mevcut season lifecycle, wipe, transfer, leaderboard, rewards ve account deletion akışları haritalandı.
- [x] Metrik sözlüğü ve mevcut veriden türetilebilirlik sınırları çıkarıldı.
- [x] İlk veri modeli/API testleri önce yazıldı, endpoint yokken beklenen 404 ile kırmızı görüldü ve uygulama sonrası yeşile döndü.
- [x] Snapshot/archive backend'i ve deploy-safe migration uygulandı.
- [x] Client contract, season archive ve completed-only profile UI'ın ilk tam dikey dilimi uygulandı.
- [x] Ödül alternatifleri simüle edilip tek ürün karar kapısı hazırlandı.
- [ ] Onaylanan reward entitlement/payout akışı uygulanıyor.
- [ ] Targeted testler, `pnpm verify` ve görsel doğrulama tamamlanacak.
- [ ] Son code review ve dokümantasyon tamamlanacak.

## Güncel bulgular

1. Mevcut kalıcı kayıt tabanı `seasonResults`; rank, Dominion ve sınırlı recap alanlarını saklıyor.
2. Canlı leaderboard `/api/leaderboard` üzerinden Dominion sırasını ve fog'a bağlı planet/Core alanlarını veriyor; bu endpoint regression sınırı olacak.
3. Season lifecycle `live → frozen → wiped` ilerliyor. Arşiv hem `frozen` hem `wiped` durumlarını okumalı.
4. `seasonResults` account + cycle düzeyinde tek sonuç invariant'ına sahip; MAIN/WAITING transferleri yeni istatistiklerde çift sayılmamalı.
5. Mevcut reward sistemi claim'i idempotent ledger ile yapıyor ancak sezon sıralama ödülü için source/target cycle'a bağlı ayrı entitlement semantiği gerekiyor.
6. Pasif üretim lazy economy advancement ile hesaplanıyor; doğru üretim süresi/çıktısı yalnızca season end'de mevcut bakiyelerden geriye dönük çıkarılamaz.
7. Botlar mevcut canlı/final ranking davranışında özel bir karar gerektiriyor: canlı tabloyu bozmadan gerçek oyuncu ödül yerlerinin nasıl hesaplanacağı balance karar kapısına girecek.
8. `mining_runs.owner_player_id` oyuncuyu launch anında sabitliyor; gezegen sahibini season end'de join ederek yanlış actor'a yazma riski giderildi.
9. Convoy akışı `owner_player_id`, quoted/actual ödül ve `abandoned_at` alanlarıyla güvenilir biçimde ölçülebilir.
10. Gemi üretimini yalnızca season end'deki envanterden çıkarmak savaş kayıpları nedeniyle yanlış olur; tamamlanan üretim anında kümülatif telemetry gerekir.
11. Üretim çıktı/süre ölçümü lazy `advanceEconomy` gerçekleştiği anda biriktirilmelidir. Season end bakiyeleri storage cap ve harcamalar nedeniyle bu bilgiyi taşımaz.
12. Account deletion bugün ilgili `season_results` kayıtlarını siliyor. Arşiv bu silme politikasını ihlal etmeyecek; silinen hesaplar için yeni bir kişisel profil yüzeyi üretmeyecek.
13. Arşiv sıralamasındaki kimlik `season_results.recap.commanderName` snapshot'ından okunmalı; sonradan değişen güncel display name geçmişi yeniden yazmamalı.

## Metrik veri kaynağı

| Metrik | Güvenilir kaynak | Cutover davranışı |
|---|---|---|
| Final sıra / Hâkimiyet | `season_results` | Mevcut geçmişte kullanılabilir |
| Verilen/alınan hasar, savaş/rakip/büyük yağma | Battle/impact kayıtlarından freeze snapshot | Eski recap alanları kadar gösterilir; eksik ayrıntı uydurulmaz |
| Asteroid seferi ve çıkarılan kaynak | Actor'ı launch anında sabitlenmiş `mining_runs` | Yeni telemetry sonrası kullanılabilir |
| Convoy seferi ve kazanılan kaynak | `intergalactic_convoy_runs.owner_player_id` | Mevcut silinmemiş sezonlarda freeze sırasında türetilebilir |
| Üretilen gemiler | Build completion sırasında oyuncu telemetry toplamı | Yeni telemetry sonrası kullanılabilir |
| Etkin üretim süresi ve üretilen kaynak | Lazy economy advancement sırasında oyuncu telemetry toplamı | Yeni telemetry sonrası kullanılabilir |

`Genel` hesapları yalnızca tamamlanmış snapshot'ları toplar. Bir metriğin eski sezonda snapshot'ı yoksa sıfır sayılmaz; API/UI metriği `unavailable` olarak işaretler ve ortalamaya katmaz.

## İş günlüğü

### 2026-09-14 — Başlangıç

- `AGENTS.md` yönlendirmesiyle `CLAUDE.md` tamamen okundu.
- Görev prompt'u tamamlanmış sezon statülerini (`frozen` ve `wiped`) ve canlı bilgi güvenliğini kesinleştirecek şekilde doğrulandı.
- İlgili React/Node.js beceri talimatları okundu.
- Repository'nin mevcut season, leaderboard, recap, reward ve temel schema alanlarının ilk envanteri çıkarıldı.
- MAIN/WAITING transferlerinde aynı `player` ve cycle kimliğinin korunduğu; wipe öncesi gameplay tablolarının silindiği doğrulandı.
- Canlı leaderboard'ın mevcut response ve etkileşim davranışı regression sınırı olarak kaydedildi.
- Metriklerin güvenilir kaynakları ve deploy sonrası telemetry gerektiren alanlar tabloya işlendi.
- Baseline doğrulamalar çalıştırıldı; sonuçlar aşağıda kaydedildi.
- `season_cycles.ordinal` ve `season_results.public_id` modeli eklendi. Ordinal backfill'i `starts_at → ends_at → id` sırasıyla deterministik; yeni cycle tahsisi advisory transaction lock ile yarışa kapalı.
- `/api/season-archive` bounded cursor/limit ile eklendi; live cycle yalnızca güvenli sezon/galaksi metadata'sı yayımlıyor.
- `/api/season-archive/:seasonId/leaderboard` yalnızca `frozen`/`wiped` sezonda açılıyor; live istek `SEASON_NOT_COMPLETE` ile reddediliyor.
- Geçmiş leaderboard adları mühürlü recap'ten geliyor; account UUID yerine rastgele `resultId` kullanılıyor.
- `/api/season-archive/results/:resultId`, seçilen tamamlanmış sezon karnesini ve yalnızca `frozen`/`wiped` sonuçlardan türetilen `Genel` özeti sağlıyor; live sonuç kimliği bilinirse bile ayrıntı 409 ile kapalı.
- `SeasonStatsSnapshot v1` savaş/loot/gemi, Works üretimi/süresi, asteroid ve convoy çekirdek metriklerini mühürlüyor.
- Ortalamalar sealed snapshot'lardan türetiliyor; uygun ama eylemsiz komutan sıfırla dahil, bot/admin cohort'u freeze-time flag ile dışarıda. Public API bu flag'i yayımlamıyor.
- Lazy economy advance gerçek buffer artışını ve en az bir Works kaynağının gerçekten arttığı süreyi atomik planet telemetry'sine yazıyor. Disruption ve collector cap üretim süresini doğal olarak kesiyor; deadline sonrası afterglow üretimi sayılmıyor.
- Mining launch actor'ı immutable `owner_player_id` ile sabitleniyor. Gemi üretimi completion anında planet telemetry'sine ekleniyor.
- Stats activation cycle-wide version ile işaretleniyor: deploy sırasında zaten başlamış cycle ve o cycle'a sonradan açılan WAITING shard'ı partial geçmişi yanlışlıkla “tam” saymıyor.
- Gerçek server response'ları web Zod şemalarıyla contract testinde parse ediliyor. Liste, completed leaderboard ve detail payload'ları ayrılarak profile waterfall/eager payload önlendi.
- Leaderboard sheet artık kalıcı bir `Canlı Sezon / Sezon N · Galaksi` seçicisi içeriyor. `Canlı Sezon` dalı mevcut `LeaderboardScreen` bileşenini değiştirmeden render ediyor; yalnız completed satırlar profile açılıyor.
- Completed profile sezon ve `Genel` sekmelerini, cohort sayısını, legacy `veri yok` durumunu ve temel karşılaştırmalı metrikleri Türkçe/İngilizce gösteriyor.
- Profile UI'a final sıra/Dominion, saldırı/savunma, alınan hasar, convoy denemesi ve üretilen/kaybedilen gemilerin hull kırılımı eklendi. Arşiv index hatası canlı leaderboard'ı kapatmıyor; retry yüzeyi ayrı gösteriliyor.
- Tamamlanmış leaderboard araması Türkçe locale-aware çalışıyor. Arşiv cache'leri sonsuza dek tutulmuyor; silinen kimliklerin istemcide kalıcılaşmaması için sınırlı stale süresi ve focus refetch kullanılıyor.
- `Genel` sezon listesi etkileşimli hale getirildi: her satır kendi opaque result kaydını açıyor; mevcut kayda dönüş de sezon sekmesini doğru seçiyor.
- Ownership değişiminde eski actor telemetry'sini kaybetmemek için `season_telemetry_segments` eklendi. Kontrol devrinde eski sahip katkısı kapalı segmente yazılıyor, aktif gezegen telemetry'si yeni sahip için sıfırlanıyor; freeze ikisini actor bazında birleştiriyor. Wipe/reclaim sıralaması FK güvenliğiyle güncellendi.
- Full storage cap altında Works'in üretim ve productive-time yazmadığı; build completion'ın hull telemetry'sini artırdığı testlerle sabitlendi.
- Rank ödülü için `tools/season-reward-study.ts` ve regresyon testi eklendi. Adaylar shipping kuralına bağlanmadı; kullanıcı kararı gelene kadar yalnız karar kanıtıdır.
- Kod gerçeğinde yeni gezegen `1.500 A / 400 C / 50 D` ile açılıyor. Deuterium Synthesis ilk dakikadan erişilebilir ve ilk rung Deuterium istemiyor; 35. saat Deuterium'un genel unlock'u değil, isotope asteroidlerinin açılışıdır.
- D208 değeriyle (`A + 2C + 32D`) önerilen #1 paketi `900/400/12`: başlangıç değerinin `%53,4`ü, taze L1 A/C üretiminin `10,8` saati ve başlangıç D tankının `%24`ü. Temkinli #1 paketi `600/265/8`: `%35,5`, `7,2 saat`, `%16`.
- Aynı deterministic average-player rotasında iki aday da ödülsüz rotaya karşı 24 ve 48 saatte en fazla bir ek tamamlanmış hull üretiyor. Dünya cüzdanı cycle sonunda silindiği için kullanılmayan kaynak bir sonraki sezona taşınarak compound etmiyor; tekrar kazanan yalnız aynı sınırlı başlangıç avantajını yeniden alıyor.
- Kullanıcının açıklayıcı `3.000/2.000/500` örneği başlangıç değerinin `%589,7`si, `44,4` saat taze A/C ve başlangıç D tankının `10×`i; 24 saatte üç ek hull ürettiği için negatif kontrol olarak unsafe bulundu.
- Önerilen 10 basamağın toplam ekonomik değeri `11.597`; mevcut bir oyuncunun bütün action reward purse değeri `45.041`in `%25,7`si. Temkinli tablo toplamı `7.275` (`%16,2`).
- Ürün sahibi 2026-09-15'te kendi 10 basamaklı tablosunu seçti: #1 `2.000/1.500/300` → #10 `200/50/5`. Önerilen diğer politika maddeleri değişmeden kabul edilmiş varsayıldı: T+0, botlar basamak tüketmez, `Dominion > 0`, immediate-successor expiry.
- Seçilen #1 paketinin ölçülen ekonomik değeri `14.600`: başlangıç değerinin `%374,4`ü, `31,75` saat taze L1 A/C üretimi ve başlangıç D tankının `6×`i. Aynı early-route hassasiyetinde 24/48 saatte iki ek hull üretiyor. Bu, daha önce sunulan güvenli zarfı bilinçli aşan ürün sahibi kararı olarak dokümante edilecek; miktarlar sessizce azaltılmayacak.
- Seçilen tablonun toplam ekonomik değeri `56.510`; mevcut action reward purse değeri `45.041`in `%125,5`i (bu toplam on farklı kazanana dağılır).
- Sıradaki adım: program version + entitlement schema testleri, freeze-time hak ediş, successor bağlama, exactly-once join payout ve UI/contract.

## Test kanıtları

- `pnpm typecheck` — **PASS** (tüm workspace'ler).
- `pnpm --filter @astera/web exec vitest run test/season-recap.test.tsx test/i18n.test.ts` — **PASS**, 2 dosya / 55 test.
- `pnpm --filter @astera/server exec vitest run test/season-lifecycle.test.ts test/contract.test.ts` — lifecycle **PASS** (11 test); contract paketinde görev öncesinden gelen 1 bağımsız failure var: `test/contract.test.ts:618`, clan journey quote beklentisi (`allowed: true`) mevcut balance davranışında `false` dönüyor. 90 contract testi geçti. Bu baseline failure sezon arşivi kapsamında gizlenmeyecek veya gevşetilmeyecek.
- İlk arşiv TDD kırmızı kanıtı: `season-archive.test.ts` — 3/3 test endpoint'ler henüz yokken beklenen 404 nedeniyle **FAIL**.
- `pnpm --filter @astera/server exec vitest run test/season-archive.test.ts` — implementation sonrası **PASS**, 1 dosya / 3 test.
- Profile/`Genel` TDD: endpoint yokken yeni test beklenen 404 ile **FAIL**, implementation sonrası geçti.
- Stats average TDD: schema alanları yokken update sorgusu doğru nedenle **FAIL**, versioned snapshot/aggregation sonrası geçti.
- Telemetry freeze TDD: kolonlar yokken doğru nedenle **FAIL**; action/economy snapshot sonrası geçti.
- Production sınırı testinde deadline sonrası lazy tick önce 1 saat ileri taşıyarak **FAIL** verdi; ekonomi saati `endsAt`'te clamp edilince Works/disruption/deadline grubu **PASS** (3 test).
- `pnpm --filter @astera/server exec vitest run test/season-archive.test.ts test/season-lifecycle.test.ts` — **PASS**, 2 dosya / 22 test. Legacy cutover fixture, ownership handoff attribution, full-cap Works ve build completion telemetry aynı koşuda doğrulandı.
- Reclaim “leaves nothing” ve account deletion “takes the commander...” hedefli testleri yeni telemetry tablosu/FK sırasıyla ayrı ayrı **PASS**.
- Gerçek arşiv endpoint response'larının web Zod şemalarıyla parse edildiği contract testi — **PASS**.
- İlk web TDD koşusu `SeasonArchiveScreen` bulunmadığı için beklenen import failure ile **FAIL**; yüzey uygulandıktan sonra üç davranıştan ikisi geçti. Kalan iki failure aynı 50.000/27.000 değerlerinin iki farklı kaynak kartında doğru görünmesi ve `Segmented` kontrolünün erişilebilir rolünün `tab` olması nedeniyle test seçicilerindeydi; assertion'lar ürün semantiğini koruyacak biçimde netleştirildi.
- `pnpm --filter @astera/web exec vitest run test/season-archive.test.tsx test/leaderboard.test.tsx test/i18n.test.ts` — **PASS**, 3 dosya / 59 test. Arşiv/profile, kariyer navigasyonu, hata izolasyonu ve mevcut canlı leaderboard davranışı birlikte geçti.
- `pnpm --filter @astera/web typecheck` — son kariyer navigasyonu değişikliğiyle **PASS**.
- `pnpm typecheck` — yeni server/client/UI değişiklikleriyle yeniden **PASS**.
- `git diff --check` — **PASS**.
- Reward study ilk koşuda study modülü henüz yokken beklenen import failure ile **FAIL**; implementation sonrası `pnpm exec vitest run tools/season-reward-study.test.ts` — **PASS**, 1 dosya / 4 test.
- `pnpm exec tsx tools/season-reward-study.ts` — **PASS**; iki aday ve unsafe örnek için deterministic JSON ölçüm raporu üretildi.

## Açık kararlar

Reward implementasyonundan önce ölçümle birlikte tek seferde sunulacak:

- Rank 1–10 kaynak tablosu ve Deuterium teslim zamanı
- Bot/all-zero eligibility politikası
- Immediate successor cycle kaçırılırsa entitlement expiry davranışı

### Karar sonucu

- Onaylanan tablo: #1 `2.000/1.500/300`, #2 `1.750/1.250/250`, #3 `1.500/1.000/200`, #4 `1.250/750/150`, #5 `1.000/500/100`, #6 `750/250/50`, #7 `600/175/25`, #8 `450/150/15`, #9 `250/75/10`, #10 `200/50/5`.
- Deuterium: T+0 teslim. Başlangıç tankında zaten 50 D var ve üretim araştırması dakika 0'da açık; yapay bir 35 saat gecikmesi mevcut kurala dayanmıyor.
- Botlar: display `finalRank` değişmeden ödül sırasını tüketmez; uygun gerçek oyuncular ayrı `rewardPlace` 1–10 alır. Public API bot flag yayımlamaz.
- All-zero abuse: ödül için final Dominion `> 0` önerilir; yalnız join-time tie-breaker ile pasif attendance ödülü doğmaz.
- Expiry: yalnız immediate successor cycle boyunca geçerli; o cycle'a katılmayan hesabın entitlement'ı cycle sonunda expire olur.
