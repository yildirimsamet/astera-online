# E. Veritabanı Tasarımı (FAZ 4)

- **Dayanak:** ADR-05, 06, 07, 08, 09, 11.
- **Kapsam:** Hedef şemanın ilkeleri, değişen ve yeni yapılar (DDL), transaction sınırları ve migration yolu.
- **Kapsam dışı:** 168 tablonun tamamının DDL'i burada yeniden yazılmaz. Değişmeyen tablolar `schema.ts`'teki hâliyle kalır.
- **DDL hakkında:** Buradaki SQL hedefi gösterir. Uygulamada Drizzle şeması ve üretilen migration esas alınır. Her değişiklik önce testle gelir (CLAUDE.md §3).

## 1. İlkeler

1. **Tek PostgreSQL 16.** Üç şema:
   - `public`: canlı veri.
   - `archive`: ekleme-yalnız arşiv.
   - `stats`: ileride, sezon özetleri.
2. **Tablo sınıfları.** Her yeni tablo bir sınıfa girer; sınıf yaşam döngüsünü belirler.

   | Sınıf | Örnek | Sezon sonunda |
   | --- | --- | --- |
   | Global kalıcı | `accounts`, `legacy_*`, `season_results`, `cosmetic_entitlements`, ödeme tabloları, analitik | Kalır |
   | Dünya | `players` ve onun FK kapanışı (canlıda 73 tablo): `planets`, `missions`, `units`, `buildings`, klan, sohbet… | Geçmiş sınıfındakiler önce arşive; sonra silme |
   | Başlangıç galaksisi | `vessels`, `starter_*`, `vessel_missions` | Sürekli temizlik; önce arşiv |
   | İşletim | `scheduled_events`, `request_log`, `mail_outbox`, `outbox_jobs` | Kendi saklama kuralı |

3. **Normalizasyon.** 3NF hedeflenir. Bilinçli istisnalar yazılı tutulur:
   - Değişmez anlık görüntüler JSON kalır: savaş raporu, uçuştaki filo bileşimi, ödül anlık görüntüsü. Bunlar o anın gerçeğidir, türetilmez.
   - Önbellek sütunları (`players.wealth` gibi) yalnız üç koşulla kalır: türetilebilir olmalı, aynı transaction'da yazılmalı, G'deki kilit sırasına uymalı.
   - Ölü sütunlar (`recovery_relief_at`, `disrupted_until`) bir sonraki sezon geçişinde silinir.
4. **Kimlik.**
   - Var olan tablolarda UUID kalır. Tablolar küçük (veritabanı 286 MB); değişikliğin maliyeti faydasından büyük.
   - Yeni, yüksek hacimli ekleme-yalnız tablolarda `bigint GENERATED ALWAYS AS IDENTITY` kullanılır: sıralı ve küçük index.
5. **Tipler.** Kaynak miktarları `double precision` olur. Koordinatlar ve görsel değerler `real` kalabilir. Zaman `timestamptz`.
6. **Son savunma hattı.** Negatif olamayan her miktarda `CHECK (x >= 0)` bulunur. Kod clamp etmez, hata verir.
7. **Kısmi index'te parametre tuzağı.** Kısmi index'in koşulu sorguda **literal** olmalı. Drizzle'ın `eq(status, 'pending')` ifadesi `$1` parametresi üretir. Genel plan (generic plan) bu index'i kullanamaz. Bu sorgular ``sql`status = 'pending'` `` ile yazılır.
   - Kesin: PostgreSQL, kısmi index'i ancak koşul plan anında kanıtlanabiliyorsa kullanır.

## 2. Kaynak tipleri ve kısıtlar (ADR-07)

Canlı katalogdan çıkan, kaynak taşıyan `real` sütunlar:
- `planets`: `alloy`, `crystal`, `buffer_alloy`, `buffer_crystal`, `pending_leak_*`
- `account_rewards`, `reward_grants`
- `clan_loot_shares`, `debris_fields`, `mining_runs`, `planet_faults`
- `asteroid_claims.ore_taken`
- (`players.wealth` tip değişikliğine girmez; tamamen kaldırılıyor, K A2.4)

```sql
ALTER TABLE planets
  ALTER COLUMN alloy                  TYPE double precision,
  ALTER COLUMN crystal                TYPE double precision,
  ALTER COLUMN buffer_alloy           TYPE double precision,
  ALTER COLUMN buffer_crystal         TYPE double precision,
  ALTER COLUMN pending_leak_alloy     TYPE double precision,
  ALTER COLUMN pending_leak_crystal   TYPE double precision,
  ALTER COLUMN pending_leak_deuterium TYPE double precision,
  ADD CONSTRAINT planets_stock_nonneg CHECK (
    alloy >= 0 AND crystal >= 0 AND deuterium >= 0
    AND buffer_alloy >= 0 AND buffer_crystal >= 0 AND buffer_deuterium >= 0);

ALTER TABLE units ADD CONSTRAINT units_count_nonneg CHECK (count >= 0);
-- Aynı tip değişikliği ve ilgili >= 0 kısıtları: account_rewards, reward_grants, clan_loot_shares,
-- debris_fields, mining_runs, planet_faults, asteroid_claims.ore_taken.
```

Notlar:
- **Canlı veri bugün bu kısıtları ihlal etmiyor:** negatif kaynak ve gemi 0 (canlı ölçüm). Her kısıt, onu ihlal etmeye çalışan bir testle birlikte gelir.
- **Zamanlama:** Tablolar küçük (`planets` 284 satır). Tip değişikliği milisaniyeler süren bir tablo yeniden yazımı. Kısa bir bakımda veya sezon geçişinde yapılabilir.
- **`setUnits` clamp'i** (`planet.ts:938,941`) kaldırılır. Fazla düşüm `GameError` verir.

## 3. Kaynak ve gemi defteri (ADR-07)

```sql
CREATE TABLE economy_ledger (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id   uuid NOT NULL REFERENCES seasons(id),
  planet_id   uuid NOT NULL,           -- FK yok: satır, gezegen silinse de arşive gider
  player_id   uuid,                    -- tarafsız dünyada NULL
  at          timestamptz NOT NULL,    -- oyun anı (olayda resolve_at)
  cause       text NOT NULL,           -- production, build, research, loot, raid_loss, mining, trade, reward, repair, refund, admin
  ref_id      uuid,                    -- görev, sipariş veya olay
  d_alloy     double precision NOT NULL DEFAULT 0,
  d_crystal   double precision NOT NULL DEFAULT 0,
  d_deuterium double precision NOT NULL DEFAULT 0,
  CONSTRAINT economy_ledger_nonzero CHECK (d_alloy <> 0 OR d_crystal <> 0 OR d_deuterium <> 0)
);
CREATE INDEX economy_ledger_planet_idx ON economy_ledger (planet_id, id);
CREATE INDEX economy_ledger_ref_idx    ON economy_ledger (ref_id) WHERE ref_id IS NOT NULL;

CREATE TABLE unit_ledger (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_id uuid NOT NULL REFERENCES seasons(id),
  planet_id uuid NOT NULL,
  player_id uuid,
  at        timestamptz NOT NULL,
  cause     text NOT NULL,             -- build, loss, repair, scrap, reward, admin
  ref_id    uuid,
  unit_type text NOT NULL,
  delta     integer NOT NULL CHECK (delta <> 0)
);
CREATE INDEX unit_ledger_planet_idx ON unit_ledger (planet_id, id);
```

Kurallar:
- **Kaynak defteri** dünyanın **toplam** stoğunu (depo + tampon) izler. Toplamaya basmak (`collect`) tampondan depoya iç aktarımdır; deftere yazılmaz.
- **Üretim:** Her tembel tick'te tek satır, dönemin toplamı olarak yazılır. Bugün 8 günde ~36 bin gezegen güncellemesi var, yani hacim küçük.
- **Gemi defteri** yalnız yaratma ve yok olmayı kaydeder. Gemilerin yer değiştirmesi (üs ↔ görev) deftere girmez.
- **Değişmezler:**
  - Gezegen başına `stok = başlangıç + Σ defter`.
  - Oyuncu başına `bütün konumlardaki gemiler = Σ unit_ledger`.

  Worker bakımı bunları günde bir denetler; sapma alarm üretir.
- **Maliyet:** Yazma başına +1–2 deyim. Aynı gidiş-dönüşte gruplanır (ADR-03).
- **Yaşam döngüsü:** Dünya ve geçmiş sınıfında. Sezon sonunda arşive gider, sonra silinir. İstatistik ve çoklu hesap raporu (S11) buradan beslenir.
- **Var olan toplamlarla ilişkisi:** `planets.season_telemetry` (üretim, üretim süresi, inşa edilen gemi) ve sezon sonuç istatistikleri zaten kümülatif toplam tutuyor. Defter bunların olay bazlı kaynağı olur. Günlük denetim, `Σ defter = telemetri toplamı` eşitliğini de kontrol eder. Böylece iki ayrı doğruluk kaynağı oluşmaz.
- **Boyut:** Bu, planın en büyük refactor'ü. Kodda 32 dosyada 52 gezegen güncelleme noktası ve gemi değiştiren 31 dosya var. Hepsi tek bir ekonomi yardımcısına taşınır.

## 4. Arşiv (ADR-08)

Tek, şemasız bir arşiv tablosu kullanılır. Gerekçe: dünya tablolarının şeması her sürümde değişiyor. Sütun sütun kopya tabloları her migration'da kayardı. JSONB satır kopyası kaymaz. İstatistik ihtiyacı netleştikçe `stats` altında tipli özet tabloları buradan üretilir.

```sql
CREATE SCHEMA archive;

CREATE TABLE archive.world_rows (
  id          bigint GENERATED ALWAYS AS IDENTITY,
  archived_at timestamptz NOT NULL DEFAULT now(),
  season_id   uuid,                    -- başlangıç galaksisi satırlarında NULL olabilir
  scope_id    uuid,                    -- başlangıç galaksisi kimliği vb.
  table_name  text NOT NULL,
  row_id      text NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('season_end','reclaim','starter_retention','event_done')),
  row         jsonb NOT NULL,
  PRIMARY KEY (archived_at, id)
) PARTITION BY RANGE (archived_at);
ALTER TABLE archive.world_rows ALTER COLUMN row SET COMPRESSION lz4;   -- canlıda lz4 destekleniyor

CREATE INDEX world_rows_season_table_idx ON archive.world_rows (season_id, table_name);
CREATE INDEX world_rows_account_idx ON archive.world_rows ((row->>'account_id')) WHERE table_name = 'players';

-- Worker bakımı her ay bir sonraki ayın bölümünü önceden açar:
-- CREATE TABLE archive.world_rows_2026_12 PARTITION OF archive.world_rows
--   FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
```

**Neyin arşivleneceği.** Kodda 75 dosyada 299 silme noktası var (inceleme, 2026-11-06). Çoğu oyun geçmişi değil, geçici durum temizliği: taahhüt, kilit, kuyruk, okundu işareti. Bu yüzden tablolar iki sınıfa ayrılır:
- **Geçmiş** (owner onayı, 2026-11-06): görevler, raporlar, savaş, madencilik, ticaret, gemi, bina ve araştırma siparişleri, defterler, klan olayları, sezon olguları. Silinmeden önce arşive gider. Tablo düzeyindeki eşleme A2.1 envanterinde çıkarılır.
- **Geçici durum:** Arşivlenmeden silinir.

Bir katalog testi her tablonun sınıfını ister. Geçmiş sınıfındaki bir tabloyu arşivsiz silen kod testten geçmez.

**Satır bazında silen yollar** (koltuk geri alma, başlangıç galaksisi temizliği, biten olaylar ve geçmiş sınıfındaki diğer silmeler) tek atomik deyim kullanır:

```sql
WITH gone AS (
  DELETE FROM missions WHERE player_id = $1 RETURNING *
)
INSERT INTO archive.world_rows (season_id, table_name, row_id, reason, row)
SELECT gone.season_id, 'missions', gone.id::text, 'reclaim', to_jsonb(gone) FROM gone;
```

Kod tarafında tek yardımcı fonksiyon olur: `archiveThenDelete(tx, table, where, reason)`. Geçmiş sınıfındaki bütün silmeler bunu kullanır.

**Sezon sonu.** Tek transaction'da:
1. Sezon sonuçları global hesaba katlanır (bugünkü 1. adım).
2. Geçmiş sınıfındaki her dünya tablosu arşive kopyalanır: `INSERT INTO archive.world_rows SELECT ..., to_jsonb(t) FROM t`.
3. Bugünkü `DELETE` sırası çalışır.
4. Yeni sezonlar açılır.
5. Transaction'dan sonra, oyun açıkken: dünya tablolarına `REINDEX TABLE CONCURRENTLY`. Ölçülen index şişmesini (176 MB'a 96 MB) kilitsiz temizler.

**Neden `TRUNCATE` değil (inceleme düzeltmesi).**
- `TRUNCATE`, dünya tablolarına FK ile bağlanan **her** tabloyu da boşaltmak zorundadır; ON DELETE kuralı fark etmez.
- Canlıda `return_applications` (sezon dışı, 73 satır) `players`'a `SET NULL` ile bağlı. Bugün silmeden sağ çıkıyor (68 satırın oyuncusu `NULL`). `TRUNCATE` bu veriyi yok ederdi.
- Ayrıca kapanış 73 tablo; sabit bir liste her yeni tabloyla kayar.

Kural:
- Kalıcı bir tablo dünya tablosuna FK ile bağlanmaz. Oyuncu kimliği düz sütun olarak tutulur. Bir katalog testi bunu korur.
- `TRUNCATE` ancak geçiş süresi ölçülüp sorun çıkarsa ve bu kural sağlandıktan sonra yeniden değerlendirilir.

**Kişisel veri.**
- Sohbet, DM, IP ve cihaz bilgisi arşive girmez. Bugünkü saklama kuralları geçerli.
- Hesap silindiğinde `world_rows_account_idx` ile oyuncu satırları bulunur, ad gibi alanlar silinir. Oyun olguları anonim kalır.

**Büyüme ve RTO.** Bölümler aylık. Arşiv aynı veritabanında büyüdükçe yedek ve geri yükleme süresi de uzar; bu, RTO ≤ 30 dk hedefini tehdit eder. Kural: Aylık tatbikatta geri yükleme 10 dakikayı veya arşiv 2 GB'ı geçerse en eski aylar sıkıştırılmış dosya olarak R2'ye alınır. Sonra bölüm `DETACH` ve `DROP` edilir. Geri yükleme yolu yazılı tutulur. Eşikler ölçümle ayarlanır.

## 5. Olay kuyruğu (ADR-06)

```sql
-- Sıcak index'ler yalnız bekleyen ve işlenen satırları tutar.
CREATE INDEX CONCURRENTLY events_pending_due_idx ON scheduled_events (resolve_at, ref_id, id) WHERE status = 'pending';
CREATE INDEX CONCURRENTLY events_processing_idx  ON scheduled_events (claimed_at)            WHERE status = 'processing';
DROP INDEX CONCURRENTLY events_due_idx;       -- (status, resolve_at)
DROP INDEX CONCURRENTLY events_claimed_idx;   -- (status, claimed_at)
```

- **Claim sorgusu** zaten literal `'pending'` kullanıyor (`queue.ts:26-41`). Drizzle ile yazılan "sonraki uyanma" sorgusu literal'e çevrilir (§1.7).
- **Biten olaylar:** Worker bakımı, bir günden eski `done` satırları `archiveThenDelete(..., 'event_done')` ile taşır. Sıcak tablo sezon boyunca küçük kalır. Bugün 27 bin `done` satırına 35 MB index düşüyor.
- **Tek örnek ve kurtarma:**
  - Worker açılışta ayrı bir oturum bağlantısında `pg_try_advisory_lock(hashtext('astera:worker'))` alır. Alamazsa bekler.
  - Kilidi alan, `status = 'processing'` satırları hemen `pending`'e döndürür. Yeniden başlatma 5 dakika beklemez (Y7).
  - Galaksiye göre paralel işleme gelirse kilit anahtarı `astera:worker:<galaxy>` olur.
- **Dış çağrılar:** FCM gibi çağrılar `outbox_jobs` tablosuna yazılır, ayrı döngüde zaman aşımıyla gönderilir. `mail_outbox` deseni genelleştirilir. Ücretli bildirim (O6) ücretle aynı transaction'da outbox'a girer, yani en az bir kez gönderilir.

```sql
CREATE TABLE outbox_jobs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         text NOT NULL,                -- push, ...
  dedupe_key   text NOT NULL UNIQUE,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts     integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_jobs_due_idx ON outbox_jobs (next_attempt) WHERE status = 'pending';
```

## 6. Sezon satırının sıcak yazarı (Y3)

`update seasons set spawn_gate_through` sezon satırının tek sık yazarı: 8 günde 76.716 kez. Oysa 63 çağrı noktası bu satırı `FOR SHARE` ile kilitliyor. Yük testinde bu yazma 158–1.718 ms bekledi. Sütun kendi tablosuna taşınır:

```sql
CREATE TABLE season_spawn_gates (
  season_id uuid PRIMARY KEY REFERENCES seasons(id),
  gate_from timestamptz NOT NULL,
  gate_through timestamptz NOT NULL
);
```

Böylece sezon satırına yalnız dondurma ve geçiş yazar. Bu işlemler zaten bütün yazmaları beklemesi gereken işlemler. Okuyucular (`spawnGateRead.ts`) yeni tabloyu okur.

## 7. Idempotency ve analitik

- **Idempotency.**
  - `request_log` yapısı yeterli; kapsamı `(player_id, operation, idempotency_key)`.
  - Eksik beş rota anahtar alır: `fleet/launch`, `fleet/transfer`, `planet/build`, `planet/upgrade`, `mining/launch`.
  - Bu tablo oyun verisi değil, yanıt önbelleği. 48 saatten eski satırlar silinir.
- **Analitik imleci** (ADR-09):

  ```sql
  CREATE TABLE analytics_cursors (
    source  text PRIMARY KEY,          -- build_orders, research_orders, mining_runs, missions, ...
    last_at timestamptz NOT NULL,
    last_id uuid NOT NULL
  );
  ```

  - Okuma: `WHERE origin = 'manual_http' AND analytics_visit_hash IS NOT NULL AND (ordered_at, id) > ($at, $id) AND ordered_at < now() - interval '30 seconds' ORDER BY ordered_at, id LIMIT 500`.
  - Koşul, mevcut `*_analytics_order_idx` kısmi index'leriyle aynı ve literal yazılır. Bu index'ler bugün hiç kullanılmıyor (`idx_scan` 0).
  - 30 saniyelik gecikme, geç commit edilen satırları kaçırmamak için. API'de deyim zaman aşımı bunun altında.
  - **Sonuç olguları için ayrı imleç (inceleme düzeltmesi).** İşin ikinci yarısı tamamlanmış siparişleri arıyor (`status = 'COMPLETED'`). Tamamlanma, sipariş anından saatler sonra gelir. `ordered_at` imleci bu olguları kaçırırdı.
    - Seçenek 1: İmleç tamamlanma anına kurulur.
    - Seçenek 2, daha basit olan: Sonuç olgusunu tamamlanmayı yazan worker transaction'ı yazar.

    Seçim prototipte, olgu sayısı eski yolla karşılaştırılarak yapılır.
  - Bugünkü 30 günlük tam tarama günde bir mutabakat olarak kalır.
  - Not: Canlıda `pg_stat_statements` 58 kez kayıt tahliye etmiş. Çağrı sayıları alt sınırdır; süre payları yine de geçerli.

## 8. Roller (ADR-11)

Docker imajındaki ilk kullanıcı (`astera`) bootstrap superuser'dır. Nesnelerinin sahipliği devredilemez. Bu yüzden `astera`, yalnız migration ve bakım için kullanılan sahip rolü olarak kalır. Çalışan süreçler superuser olmayan rollerle bağlanır.

```sql
CREATE ROLE astera_app      LOGIN PASSWORD :'app_pw';      -- API
CREATE ROLE astera_worker   LOGIN PASSWORD :'worker_pw';   -- worker
CREATE ROLE astera_arena    LOGIN PASSWORD :'arena_pw';    -- arena
CREATE ROLE astera_readonly LOGIN PASSWORD :'ro_pw';       -- ölçüm

GRANT USAGE ON SCHEMA public TO astera_app, astera_worker, astera_arena, astera_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO astera_app, astera_worker, astera_arena;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO astera_app, astera_worker, astera_arena;
ALTER DEFAULT PRIVILEGES FOR ROLE astera IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO astera_app, astera_worker, astera_arena;
ALTER DEFAULT PRIVILEGES FOR ROLE astera IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO astera_app, astera_worker, astera_arena;

GRANT USAGE ON SCHEMA archive TO astera_app, astera_worker;
GRANT INSERT ON ALL TABLES IN SCHEMA archive TO astera_app, astera_worker;  -- arşiv silinmez
GRANT SELECT ON ALL TABLES IN SCHEMA archive TO astera_worker, astera_readonly;
-- Sezon geçişi worker'da (handlers.ts:2744) DML ile çalışır. REINDEX CONCURRENTLY tablo sahibi ister:
-- geçiş sonrasındaki bakım adımı tek seferlik konteynerde sahip rolüyle çalışır.
-- Elle zorlanan geçiş (cli/season.ts) de tek seferlik konteynerde sahip rolüyle çalışır.

GRANT SELECT ON ALL TABLES IN SCHEMA public TO astera_readonly;
GRANT pg_read_all_stats TO astera_readonly;

ALTER ROLE astera_app    SET statement_timeout = '5s';
ALTER ROLE astera_app    SET lock_timeout = '2s';
ALTER ROLE astera_app    SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE astera_worker SET statement_timeout = '20s';
ALTER ROLE astera_worker SET lock_timeout = '5s';
ALTER ROLE astera_worker SET idle_in_transaction_session_timeout = '30s';
```

Sayılar başlangıç değeridir, ölçümle ayarlanır. Uygulamadaki mevcut oturum ayarları önceliklidir; rol ayarı alt sınır güvencesidir.

## 9. Transaction sınırları

| İşlem | Sınır | Kilit ve sıra |
| --- | --- | --- |
| Oyuncu komutu (yazma) | Tek transaction: komut zarfı | G §2 |
| Olay işleyici | Olay başına tek transaction; `complete()` ayrı (bugünkü gibi) | G §2, aynı sıra |
| Arşivle ve sil | Silmeyle aynı deyim (CTE) | Silinen satırın kilidi |
| Sezon geçişi | Tek transaction; ardından transaction dışında `REINDEX CONCURRENTLY` | Sezon satırı `FOR UPDATE` önce |
| Outbox gönderimi | Transaction dışında ağ çağrısı; durum ayrı kısa transaction | Satır başına |
| Analitik imleci | Parti başına kısa transaction | İmleç satırı `FOR UPDATE` |
| Defter denetimi | Salt okunur, `REPEATABLE READ` anlık görüntü | Kilit yok |

## 10. Migration yolu

| Değişiklik | Yöntem | Pencere |
| --- | --- | --- |
| Yeni tablolar (`economy_ledger`, `unit_ledger`, `outbox_jobs`, `analytics_cursors`, `season_spawn_gates`, `archive.*`) | Ekle; kod sonra kullanır | Sezon içinde, kesintisiz |
| Kısmi index'ler | `CREATE INDEX CONCURRENTLY`, sonra eskisini düşür | Sezon içinde |
| Kaynak tipi ve CHECK | Küçük tablolar; kısa kilit | Kısa bakım veya sezon geçişi |
| `spawn_gate_through` taşıma | Expand-contract: yeni tabloya da yaz, okumayı taşı, eski sütunu sonra düşür | Sezon içinde |
| Roller | Yeni roller; servisler sırayla yeni rolle yeniden başlar | Sezon içinde, sırayla yeniden başlatma |
| Sezon silmesine arşiv adımı ve sonrasında `REINDEX CONCURRENTLY` | Kod değişikliği; ilk kullanım bir sonraki sezon geçişi | Planlı sezon geçişi (27 Aralık) |
| Kalıcı → dünya FK'lerinin kaldırılması (`return_applications` vb.) | Expand-contract; FK düşer, sütun kalır | Sezon içinde |
| Ölü sütunlar | Düşür | Sezon geçişi |
