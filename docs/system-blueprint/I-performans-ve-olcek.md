# I. Performans ve Ölçek (FAZ 4)

- **Dayanak:** ADR-02, 03, 04, 06, 09.
- **Kısıt (owner):** Bugünkü VPS. Gözle görülür iyileşme olmadan sunucu değişmez.

## 1. Hedefler

| Ölçü | Hedef | Bugün |
| --- | --- | --- |
| Kendi komutu, p95 | ≤ 300 ms | 200 test oyuncusunda yazma p95 2–3,5 sn |
| Okuma p95 / p99 | ≤ 250 / 500 ms | 1,2–4,5 sn / 3–9,8 sn |
| Kendi varış sonucu | ≤ 1 sn | Worker gecikmesi p99 839 ms (canlı, düşük yük) |
| Başkasının görünür hareketi | ≤ 3 sn | 5 sn yoklama ve olay |
| 5xx | 0 `RETRYABLE` | 94 (N200) |

## 2. Maliyet modeli ve bütçe

Ölçülen model: API ms/istek = `4,35 + 2,23 × deyim`, PG ms/istek = `0,29 + 1,05 × deyim`.

| Bütçe | Bugün | Hedef |
| --- | --- | --- |
| Ortalama deyim/istek | 4,7 | ≤ 2,5 |
| API ms/istek | 13,8 | ≤ 9 |
| Olay kaynaklı okuma payı | %42 | < %10 |
| PG ms/istek | 4,7 | ≤ 3 |
| Analitik işinin PG payı | %44 | < %5 |
| Worker olay ortalaması | 129 ms | ≤ 60 ms (tavan ~16 olay/sn) |
| Ağır rota deyimi | 12–17 | ≤ 5 |

## 3. Adımlar ve sıra

Her adım ayrı ölçülür. Kazanç sütunu hipotezdir; tutmazsa sıradaki adım yeniden değerlendirilir.

| Sıra | Adım | Beklenen etki | Ölçü |
| --- | --- | --- | --- |
| P1 | `watch.soon()` geri alınır (b0053dd3'teki kira kısmı kalır) | API CPU −%6, okuma p95 normale döner | CPU/istek |
| P2 | Analitik imleci (ADR-09) | PG payı %44 → < %5 | `pg_stat_statements` |
| P3 | `/health` ikiye ayrılır: `/livez` DB'siz (Docker), `/readyz` tek `select 1` (nginx, bakım); istatistik yalnız `/metrics`'te | Aşırı yükte sahte sağlıksız durum kalkar | Sağlık süreleri |
| P4 | Node 24 LTS | ~ −%7 (Node 22'de bayrakla ölçüldü) | CPU/istek |
| P5 | İsabette sıfır deyim: yerleşim kontrolü okumanın içinde; oturum, komutan, saha önbellekte | API ~ −%20 | Deyim/istek |
| P6 | Ağır rotalar ≤ 5 deyim, gruplu gönderim | API ~ −%10 | Rota başına deyim |
| P7 | Komut zarfı, kira havuzu kalkar (ADR-05) | `RETRYABLE` → 0 | 5xx |
| P8 | Delta yayını: saha, korsanlar, trafik (F §6) | API ~ −%28'e kadar | Olay okuma payı |
| P9 | Worker olay başına deyim azaltma ve gruplama | Olay ort. 129 → ≤ 60 ms | Worker metrikleri |
| P10 | `--max-semi-space-size` 16 / 32 | −%5–8; GC p99 izlenir | CPU/istek, GC |

Paralel yürüyen bütünlük hattı (ADR-07, 08, 11, 12) bu sırayı beklemez. Sıralama K'de (FAZ 5).

## 4. Bugünkü makinede beklenen kapasite

Hesap, rapor bütçesine dayanır. `[ARİTMETİK]`, ölçüm değil.

| Durum | API tavanı | Makine tavanı |
| --- | --- | --- |
| Bugün | ~200 test oyuncusu (×2 etkinlik) | ~240 |
| P1–P6 sonrası | ~330 | ~370 |
| P8 sonrası | ~450 | ~510 |

- Test oyuncusu ×2 etkinlikte ~0,9 istek/sn atıyor. Dolu galakside gerçek oyuncu ~0,8 istek/sn. Yani P8 sonrası bugünkü makine **T1'e (500 online) sınırda** yaklaşır.
- Bunun ön koşulları: stage'in düşük öncelikte çalışması (J) ve worker'ın P9 ile yetişmesi.
- T2 (2.000) bugünkü makinede mümkün değil. Owner'ın kuralına göre makine değişikliği, yazılımdaki iyileşme ölçüldükten sonra konuşulur.

## 5. Ölçüm yöntemi

- **Birincil ölçü CPU/istek.** p95 tek koşuda oynak (aynı kod 2.688 ve 1.224 ms verdi).
- **Araç ve senaryo:**
  - Aynı araç ve senaryo: `tools/capacity.mjs --scenario real`, ×2 etkinlik, 5 üreteç, 60 sn giriş ve 300 sn ölçüm.
  - Her adımda önce ve sonra koşusu, aynı gece.
  - Koşular oyun bakımdayken yapılır, canlı veriye dokunulmaz.
  - Owner onayı ve bakım penceresi gerekir.
- **Yük testi bugün üreteci aynı makinede koşturuyor** (~1,2 çekirdek). Bu, sonuçları kötü gösterir. Kıyas aynı koşulda yapıldığı için karar geçerli.
- **Eklenecek senaryolar:**
  - **Worker yükü:** olay hızı 1 → 20/sn merdiveni; gecikme p95 ve doygunluk.
  - **Kayıt dalgası:** kayıt ve onboarding rotaları; `RATE_LIMIT_SIGNUP_MAX`.
  - **Yaşlı veritabanı:** sezonun 50. günü hacminde sentetik tohum; şişme ve plan değişimi.
  - **Delta doğruluğu:** delta uygulanmış durum ile tam okuma karşılaştırması.
- **Uzun testler:** Ekonomi ve sezon simülasyonları ile snowball audit'leri yalnız owner açıkça isterse koşar (CLAUDE.md §5).

## 6. PostgreSQL ayarları (deneme listesi)

Hepsi hipotez. Biri değiştirilir, ölçülür, sonra sıradakine geçilir.

| Ayar | Bugün | Deneme | Neden |
| --- | --- | --- | --- |
| `jit` | on | off | Kısa OLTP sorgularında derleme maliyeti; analitik sorgu 132 ms |
| `wal_compression` | off | lz4 | WAL ve R2 arşiv hacmi azalır; CPU payı küçük |
| `track_io_timing` | off | on | Ölçüm için; maliyeti önce `pg_test_timing` ile ölçülür |
| `pg_stat_statements.track_planning` | off | on (deneme süresince) | Planlama süresi görünür olur |
| `shared_buffers` | 1 GB | aynı | Veritabanı 286 MB, isabet %99,92 |

Bütün ayarlar `postgresql.auto.conf`'tan repoya taşınır (J).
