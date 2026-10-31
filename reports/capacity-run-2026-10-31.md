# F0.1 kapasite koşusu — 31 Ekim 2026

Prod VPS'te bakım modunda koşuldu. Kod: `491c1a3e`; araç: `4fd5d825`. 6 çekirdek, 11 GB.
Koşulan kurgu: 2.000 komutan (1.000 çevrimiçi), `normal` senaryo (oyuncu başına ortalama 10 dakikada bir hareket; ölçülen gerçek
davranışın ~5 katı) ve 5 sn trafik okuması. Yük üreteci aynı makinede çalıştı.
Ham veri VPS'te `~/capacity-run-20261031/` altında:

- `diag/report-*.json`: kademe raporları.
- `diag/statements-*.txt`: pg_stat_statements.
- `diag/samples/`: vmstat ve API/worker metrikleri (15 sn); Postgres tablo/DB istatistikleri (30 sn).
- `diag/final/postgres-auto-explain.log`: yavaş sorgu planları.
- `diag/profile150/prof/*.cpuprofile`: api1 CPU profili.
- `diag/final/capacity.dump`: 2.000 komutanlık veritabanı. Düzeltmeler bunun üzerinde yeni yük penceresi açmadan denenir.

## Sonuç

**Bugünkü kodla bu makine yaklaşık 100 eşzamanlı oyuncuda yavaşlar, ~200'de doyar.** Darboğaz donanım değil, istek başına maliyet.

| Çevrimiçi | Havuz | Okuma p50 / p95 / p99 | Hareket p95 | Not |
|---|---|---|---|---|
| 10 | 2 | – / 191 / 328 ms | 367 ms | rahat |
| 50 | 2 | – / 289 / 432 ms | 1,9 sn | hareketler yavaşlar |
| 100 | 2 | – / 751 / 1.172 ms | 1,5 sn | belirgin yavaş |
| 200 | 4 | 686 / 1.998 / 3.080 ms | 4,1 sn | **CPU %97**, 386 adet 5xx |
| 150–500 | 2/4 | — | — | açılış dalgasında `/api/galaxy 503 RETRYABLE` (2 sn lease kuyruğu, F1.6) |

300/400/500 kademeleri geçersiz: önceki kademenin API kuyruğu bitmeden başladılar. Bulgu: yük kesilince API'ler 1–2 dakika
birikmiş istek işledi. Kademeler arasına boşalma beklemesi gerekir.

## Kök sebepler (ölçülen, önem sırasıyla)

1. **API istek başına çok CPU harcıyor.** 200 oyuncuda her API 1,1–1,3 çekirdek; Postgres 1,6 çekirdek. Makinenin %72'si kullanıcı,
   %25'i sistem CPU'su; çalışma kuyruğu 16–22. Event loop p95 ~39 ms: tek iş parçacığı değil, toplam CPU doluyor.
   Profil (yük altında, api1):
   - GC %10; soket yazımı (`writeBuffer`/`writev`) %7, yani büyük yanıt gövdeleri.
   - Drizzle sorgu kurulumu (`entity.is`, `sql.js`) ~%6; fastify serialize %1,3.
   - `routes/galaxy` %5,3, `projectGalaxyTraffic` %3,6, `projectHpFlight` %2,5.
   - Prod `tsx` ile koşuyor: modül yükleme ve esbuild derlemesi açılışta ~%15. API'de `packages/rules/src/arena/*` (mesh/layout) da yükleniyor.
2. **`/api/galaxy` en pahalı okuma, açılışı kilitliyor.**
   - Her çağrı galaksinin 1.000 dünyasını okuyor: 67 çağrı → 67.000 satır, ortalama 51 ms SQL. Ardından bunları serialize ediyor.
   - Yerleşim lease'ini tutuyor (galaksi okuması teleskop okumalarını onayladığı için yazıyor). 2 ya da 4 slot, bu yükte kuyruk demek.
   - 150 kişilik bir açılış dalgası bile 503'e düşüyor. Deploy sonrası herkesin geri bağlandığı an bu.
3. **Sıcak satır kilitleri (Postgres, 200 oyuncu, 180 sn):**
   - `update seasons set spawn_gate_through` 30 çağrı, **ortalama 329 ms**, toplam 9,9 sn. Tek sezon satırı yazılıyor; her yazma işlemi o satırı `FOR SHARE` ile kilitliyor.
   - `select id from players where account_id = $1 for update`: 2.320 çağrı, ortalama 5 ms, toplam 11,8 sn. Sayısı `last_active_at` güncellemesiyle aynı (presence). Presence yazımı oyuncu satırını kilitleyip oyun yazmalarıyla yarışıyor.
   - Transaction içinde `ClientRead` bekleyen bağlantılar: lease transaction'ları CPU bekleyen API'yi bekliyor.
4. ~~Tek bir 4,2 sn sorgu~~: koltuk sayımı (`sh.player_cap … count(distinct …)`) oyunun değil, yük aracının kendi mutabakat sorgusu
   (`tools/capacity.mjs`). Oyun için bir bulgu değil.
5. **Postgres ayarsız, prod dahil.** `shared_buffers` 128 MB (11 GB makinede), `work_mem` 4 MB, `effective_cache_size` 4 GB,
   `max_connections` 100. Kapasite DB'si de varsayılandı; ölçüm prod ile aynı koşulda.
6. **Çok sayıda ucuz ama sık sorgu:**
   - yerleşim kontrolü `players` by id: 31.578 çağrı / 180 sn.
   - `buildings` tek tip okuma: 5.680.
   - kimlik kontrolü `accounts`: 3.953.

   Her biri ~0,2 ms ama toplam CPU ve gidiş-dönüş.

## Düzeltme sırası önerisi (bu verilerle, yeni yük testi beklemeden)

1. `/api/galaxy`: lease dışına alınması (teleskop onayı ayrı, kısa bir yazmaya), yanıtın önbelleklenmesi ve küçültülmesi. Açılış dalgasının asıl darboğazı.
2. `seasons.spawn_gate_through` yazımı: sıcak sezon satırından çıkarmak (ayrı tablo/sayaç veya koşullu yazım).
3. Presence: `FOR UPDATE` olmadan koşullu tek `update … where last_active_at < now() - 1 dk`.
4. Postgres ayarı: `shared_buffers` ~2–3 GB, `effective_cache_size` ~6 GB, `work_mem` 8–16 MB. PG restart ister.
5. Prod'u derlenmiş JS ile koşmak (tsx yerine build). Açılış CPU'su ve bellek düşer.
6. Koltuk sayım sorgusu (4,2 sn) ve sık küçük sorguların toplanması.

Her düzeltme `capacity.dump` üzerinde ölçülüp doğrulanır. Son kabul için 1.000 oyunculuk tek bir koşu yeterli (plan §8.2 L3).
Araç notu: kademe arası boşalma beklemesi; soğuk okuma hatası artık yol, kod ve gövdeyi yazıyor (`4fd5d825`).
