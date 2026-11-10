# Canlı ölçüm, 5 Kasım 2026 (S1)

- **Zaman:** 2026-11-05, ~19:22 UTC.
- **Yöntem:** Prod PostgreSQL'e salt okunur oturum (`default_transaction_read_only = on`, 30 sn deyim sınırı), worker `/metrics`, Postgres günlüğü ve makine özeti. Yazma, dağıtım veya yeniden başlatma yapılmadı.
- **Canlı sürüm:** api1-3 ve worker `62a3f65b`, arena `491c1a3e`.
- **Oyun durumu:** Sezon 28 Ekim'de başladı (8. gün). 3 canlı sezon satırı, 189 komutan. Son 15 dakikada 8, son 24 saatte 41 aktif komutan. 1.798 hesap: TR 1.576, ES 149, JP 42, DE 20.
- **Sayaçların kapsamı:** `pg_stat_statements` 28 Ekim 22:00'den beri (~8 gün). `pg_stat_database`, SLRU ve checkpoint sayaçları 4 Eylül'den beri.
- **Atlanan:** Bekleme örneklemesi. Ölçüm anında tek aktif bağlantı vardı, örnekleme bir şey göstermezdi. Çekişme kanıtı yük testlerinde (A §10).

## Makine

- 6 vCPU, 11 GiB RAM (7,7 GiB kullanılabilir). Yük ortalaması 1,2–1,4.
- Disk 193 GB, %81 dolu (37 GB boş).
- Aynı makinede **stage yığını da çalışıyor**: 3 API, worker, arena, PostgreSQL, Valkey. İzleme (Prometheus, Alertmanager) de burada.

## PostgreSQL ayarları

| Ayar | Değer | Not |
| --- | --- | --- |
| `shared_buffers` | 1 GB | 31 Ekim'de 128 MB'tı |
| `effective_cache_size` | 3 GB | |
| `work_mem` | 8 MB | |
| `maintenance_work_mem` | 256 MB | |
| `random_page_cost` | 1,1 | SSD'ye uygun |
| `effective_io_concurrency` | 200 | |
| `max_wal_size` / `min_wal_size` | 1 GB / 80 MB | |
| `max_connections` | 100 | |
| `checkpoint_timeout` | 5 dk | varsayılan |
| `synchronous_commit` | on | varsayılan |
| `jit` | on | varsayılan; kısa OLTP sorgularında gereksiz olabilir `[HİPOTEZ]` |
| `track_io_timing`, `wal_compression` | off | varsayılan |
| `idle_in_transaction_session_timeout` | 0 | varsayılan; sınır yok |

Bu değerler `ALTER SYSTEM` ile `postgresql.auto.conf` dosyasına yazılmış. Dosya veri dizininde duruyor, repoda değil. Yedekten geri yüklemede veri diziniyle birlikte gelir, ama repodan sıfırdan kurulan sunucuda gelmez.

## Boyut ve şişme

- `astera` veritabanı 285 MB: tablo verisi 96 MB, index 176 MB. **Index'ler veriden büyük.** Önbellek isabeti %99,92; bütün veri RAM'e sığıyor.
- Aynı kümede iki eski kopya duruyor:
  - `astera_play_rehearsal_20261019t143306z`, 219 MB
  - `astera_honor_restore_20261017_final`, 189 MB

  İkisi de oyuncu verisi içeriyor. Silinip silinmeyecekleri owner kararı ve bir VPS işlemi.
- **Index şişmesi (Y10 doğrulandı):**

  | Tablo | Canlı satır | Index boyutu |
  | --- | --- | --- |
  | `notifications` | 24 bin | 61 MB |
  | `scheduled_events` | 30 bin | 35 MB |
  | `missions` | 2,4 bin | 11 MB |
  | `clan_messages` | 30 | 1,6 MB |
  | `attack_commitments` | 26 | 1,1 MB |

  Nedeni sezon silmesindeki `DELETE` ve yoğun güncelleme. Autovacuum index'i küçültmez.
- **`scheduled_events`:** 1,1 milyon güncellemenin yalnız %3,4'ü HOT. Sezon başından beri 27.159 `done` satır duruyor; bekleyen satır 2.559.
- **Kullanılmayan index'ler:** 34 index hiç taranmamış, toplam 2,5 MB. Küçük; bir kısmı analitik için.

## Sorgular (8 gün)

- **Toplam PG çalışma süresi:** 10.259 sn, yani ortalama ~0,015 çekirdek. Bugünkü yük çok düşük.
- **Analitik kurtarma işi PG süresinin %44'ü.**
  - İş: `recoverAnalyticsCommands` (`analyticsFacts.ts:10`). Son 30 günün komut tablolarını `UNION ALL` ile tarıyor.
  - Ölçülen: dört deyimi 26.640'ar kez çalışmış; ortalama 132 + 15 + 11 + 10 ms; toplam 4.469 sn.
  - Tetiklenme: her API dakikada bir ve her başarılı POST'tan sonra (`app.ts:215-219`, `analyticsRecorder.ts:7-12`). Yalnız aynı API'de ikinci koşu engelleniyor.
  - Sonuç: Yazma hızı ve 30 günlük veri büyüdükçe bu iş her API'de kesintisiz çalışır hâle gelir. `[KOD]` `[ÖLÇÜM]`
  - Yük testlerinde açık olup olmadığını bilmiyorum.
- **Worker yoklaması:** `scheduled_events` okuma ve claim deyimleri 2,3–2,4 milyon çağrı, ~0,1 ms, toplam ~530 sn. Sorun değil.
- **`pg_notify`:** 2,03 milyon çağrı; bildirim kuyruğu doluluğu %0.
- **Sezon satırı:** 1,45 milyon kez okunmuş. `update seasons set spawn_gate_through` 76.716 çağrı, ortalama 1,05 ms. Bu yükte sorun yok.
- **Kilit bekleyen deyimler:**
  - `select id from players where account_id = $1 for update`: 42.205 çağrı, ortalama 4,2 ms. Kaynağı bu turda belirlenmedi.
  - `pg_advisory_xact_lock`: 611 çağrı, ortalama 82 ms.
- **`/health` maliyeti:**
  - Bağlantı sayan deyim 216.981 kez çalışmış, ~0,7 ms.
  - Worker `/health`, sistem neredeyse boşken bile p50 61 ms, p95 150 ms, en çok 1,9 sn.
- `track_planning` kapalı; planlama süresi görünmüyor.

## Kilitler ve tutarlılık

- **Deadlock:** `astera` veritabanında 90. Son 5 günün günlüğünde 2 tane var, ikisi de aynı çift:
  - `update players set wealth = ...`
  - `select season_id from players where id = ... for update`

  `players.wealth` önbellek sütunu (O1), satır kilidi sırası tutarsız.
- **MultiXact:** 4 Eylül'den beri 19.216 member ve 16.880 offset bloğu yazılmış; mxid yaşı 2,4 milyon. Var, ama bu yükte küçük. Y3'ün MultiXact kısmı bugün önemsiz.
- **Commit ve rollback:** 381 milyon commit, 169 bin rollback.

## Worker (son örnekler; süreç 18 saattir açık)

- **Gecikme** (`resolve_at` ile başlangıç arası): p50 8 ms, p95 225 ms, p99 839 ms, en çok 2,2 sn.
- **Partide bekleme:** p95 596 ms, p99 6,4 sn. Bunlar aynı partide arkada kalan olaylar.
- **Olay süreleri:**

  | Olay | p50 | p95 | En çok | Deyim (p50) |
  | --- | --- | --- | --- | --- |
  | `build_complete` | 174 ms | 434 ms | 1.068 ms | 48 |
  | `mining_return` | 194 ms | 644 ms | 2.394 ms | 62 |
  | `mission_arrival` | 114 ms | 380 ms | 1.725 ms | 27 |
  | `pirate_arrival` | 283 ms | 875 ms | 880 ms | 66 |
  | `monument_arrival` | 362 ms | 508 ms | 508 ms | 85 |

- **Deyim maliyeti:** ~3,6 ms. API'deki deyim maliyetine yakın.
- **Tavan** `[ARİTMETİK]`: 2.892 olay 374 sn sürmüş, ortalama 129 ms. Tek sıralı worker'ın tavanı saniyede ~7–8 olay.
- **T1 ve T2'de yeterli mi?** `[ARİTMETİK]`, zayıf varsayımla:
  - Bugün saniyede ~0,04 olay işleniyor (8 günde ~27 bin).
  - Bu hız online oyuncuyla doğrusal büyürse (bot olayları dahil, ortalama ~4 online), T1'de ~5 olay/sn ile worker %65 dolu olur.
  - T2'de ~20 olay/sn gelir; bu, tavanın 2,6 katı.

  **Worker hiç yük testinden geçmedi.** K2 yalnız sağlamlık değil, T1–T2 arasında kapasite sorunu da olabilir.

## Kaynak büyüklüğü (K3)

- Sezonun 8. gününde en büyük değerler: alloy 47.100, crystal 25.775. 4 milyonun üstünde değer yok.
- Negatif kaynak ve negatif gemi sayısı yok.
- Bu sezon float4 sınırına yaklaşılmadı. Sezon sonu değeri bilinmiyor, çünkü eski sezon silindi.
- K3 bugün canlı bir hata değil, tasarım riski olarak kalıyor.

## Yedek

- pgBackRest arşivi çalışıyor: 11.072 WAL, sonuncusu 19:22'de.
- 2 hata var; sonuncusu 4 Kasım 19:43, dağıtım saatine yakın.
- `pgbackrest info` bu turda okunmadı.
- Geri yükleme hiç denenmedi (S12).
