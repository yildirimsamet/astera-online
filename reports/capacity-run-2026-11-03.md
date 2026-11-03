# Yük testi, gerçek trafik karışımıyla (2026-11-03)

**Sonuç: 100 oyuncu ayakta kaldı ama hedef gecikmenin üstünde. 200 oyuncuda sistem patladı. Canlı sürüm: `60334f1e`.**

Oyun 00:45–01:11 UTC arasında bakımdaydı (26 dakika). Koşu öncesinde online oyuncu ve yolda saldırı filosu yoktu; koşu sonunda canlı açıldı, hata kaydı yok.

| Seviye | Akış | İstek/sn (oyuncu başına) | Okuma p50/p95/p99 | Yazma p50/p95/p99 | 5xx | Zaman aşımı | Sunucu CPU p50/p95 | Sonuç |
|---|---|---|---|---|---|---|---|---|
| 100 | 125 | ~143 (1,56) | 70 / 749 / 1.378 ms | 180 / 1.178 / 2.116 ms | 0 | 0 | %68 / %80 | **Ayakta**, hedef üstü |
| 200 | 250 | ~289 (1,58) | 296 / 3.298 / 11.040 ms | 1.638 / 3.457 / 5.233 ms | 4.205 (%4,05) | 1.056 (%1,02) | %95 / %98 | **Patladı** |
| 100 + savaş | 125 | ~156 (1,56) | 129 / 2.174 / 3.678 ms | 291 / 2.597 / 4.028 ms | 43 (%0,05) | 0 | %67 / %85 | Ayakta, okuma sınırı aşıldı |

Hedefler (`tools/capacity.mjs` kapıları): okuma p95 ≤250 ms, p99 ≤500 ms; yazma p95 ≤400 ms. Hiçbir seviye bunları karşılamadı.

Patlama ölçütleri koşudan önce sabitlendi: 5xx >%1, ağ hatası >%0,5, okuma p95 >2 sn, yazma p95 >5 sn, kopan akış >%5, süreç yeniden başlaması veya hedefin %60'ının altında kalan istek hızı. 200 ilk üç ölçütü aştı; merdiven kurala göre durdu. 100 ile 200 arası ölçülmedi.

## Yük nasıl kuruldu

1 Kasım 00:00 – 2 Kasım 16:00 UTC arası canlı kayıtlardan ölçüldü: 180.103 istek, ortalama 3,82 online, oyuncu başına 0,327 istek/sn. Oranlar günler, yoğun/sakin saatler ve en aktif IP'nin çıkarılması arasında 1–2 puan oynadı.

| Katman | Testte | Neden |
|---|---|---|
| Toplu okumalar (%55) | ×3, gerçek boyut ve rota payları | Oyuncu davranışı |
| Yazmalar (%4) | ×3, gerçek istemci rotaları | Oyuncu davranışı |
| Tek okumalar | ×3 | Oyuncu davranışı |
| Zamanlayıcılar (trafik 5 sn…) | ×1, ekran hep açık | İstemci saati hızlanamaz |
| Olay okumaları | Web'in gerçek tabloları, yalnız açık ekranlar | Galaksi büyüdükçe kendisi büyür |
| Ziyaretler | Kalıcı | Sahip kararı, giriş-çıkış yok |

Yazma gerçek rotaların %84'ünü kapsıyor; oran kalan rotalara bölündü. Savaş koşusunda 25 komutan 60 sn içinde en yakın dünyalara filo gönderdi; tohum filolarıyla birlikte 95 iniş işlendi.

Her seviye aynı temiz veriden başladı (2.000 hesap, 90 filo, 45 madenci), iniş saatleri her seviyede eşitlendi. Şema kontrolü kısa denemelerde her yanıtta temizdi (geçersiz yanıt 0), koşularda her rotanın ilk yanıtı ve sonra her 20. yanıt denetlendi.

## Neden 200'de patladı

1. **5xx'lerin biri dışında tamamı `503 RETRYABLE`.** İstekler API başına 2 bağlantılık özel havuzda (`PLACEMENT_POOL_MAX`) 2 sn bekleyip reddedildi. Etkilenenler okuma listesinde olmayan rotalar: `intel` 828, `monuments` 737, `unknown-signals` 627, `return-applications` 331, `commander-ship` 283, `collect` 190. Bu rotaların p50'si 2 sn'ye yapıştı. Bunlar oyuncu isteklerinin küçük bir kısmı; sıralama ve kronik bu tabloda belirleyici değil.
2. **CPU doydu.** Üç API süreci ortalama %85 (tek süreç bir çekirdekle sınırlı), PostgreSQL %125, üreteçler toplam %111. 6 çekirdekli sunucu %95–98.
3. **Zaman aşımları** ağırlıkla `galaxy/traffic` (841) ve `mining/field` (162). API olay döngüsü p95 55 ms; asıl bekleme CPU ve bağlantı kuyruğunda olmalı, ayrıca ölçülmedi.
4. Veritabanı havuzu da zorlanmaya başladı: bağlantı alma p95 14 ms → 339 ms.

Sunucudaki rota süreleri (`capacity-run-2026-11-03/prom-war100-steady.txt`) tek bir suçlu göstermiyor: en büyük pay trafik (%12,5), ardından `session/pending` (%9,4), `monuments` (%6,5), `planets` (%6,4). Maliyet sorgu sayısına yayılmış: `collect` 77, `planets` 34, `planet` 32–33, `rewards` 20, `session/pending` 19, `monuments` 17 sorgu.

## Önceki söylenenlerin düzeltmesi

- **"Trafik 36 sorgu, SQL'in ~%55'i" yük altında yanlış.** Paylaşılan önbellek sayesinde trafik isteği yük altında 1 sorgu, sunucuda p50 16 ms. 36 sorgu, trafiğin az olduğu canlı anlık ölçümden geliyordu.
- **2 Kasım'daki iki üreteçli koşular geçersiz.** Araç hatası yüzünden ikinci üreteç birincinin hesaplarıyla bağlanıyordu; 300 koşusu 150 ayrı hesaptı. Düzeltildi, testi var.
- **2 Kasım'daki "sakin 200" bugünkü 200 ile karşılaştırılamaz.** O koşuda yük 0,64 istek/sn, karışım yanlış, yazma çok azdı.

## Sınırlar

- **3 kat hedefi tutmadı:** katmanlar ~1,0 istek/sn veriyor, olay okumalarıyla 1,56 oldu (canlının 4,8 katı). `mining/field` payı %17,2 (canlıda %7,3). Galaksi büyüdükçe bu okumaların artması doğal; yine de gerçek davranış için 30 oyunculuk veriden çıkarım yapılamaz.
- **Üreteç aynı sunucuda:** 1,1 çekirdek kullanıyor ve kendi gecikmesini ekliyor. Örnek: trafik sunucu tarafında p95 254 ms, üreteçte 674 ms. Ayrı makineden sonuçlar bir miktar daha iyi olur.
- **HTTP denkliği kabaca:** 100 test oyuncusunun 143 istek/sn'si, ortalama ~440 gerçek oyuncunun HTTP yüküne denk. Açık bağlantı sayısı ve olay yayılımı bu kadar büyümediği için bu "440 oyuncu taşır" demek değildir.
- **`committedStateFreshness` kapısı** bu sistemde gerçekçi değil, `releaseIdentity` konteynerde hep yanlış; kararda kullanılmadı.
- 100 seviyesinde 71 `RATE_LIMITED` geldi (200'de 7, savaşta 0). Muhtemelen araçtaki en büyük toplu okumalar; ayrıca incelenmedi.
- `memoryStable` kapısı üç koşuda da düştü, ama API belleği en çok 211 MB; kısa koşuda ısınma olabilir, sızıntı olarak yorumlanmadı.
- Yükseltme denemelerinin çoğu reddediliyor (`CORE_CEILING`), yükseltme yazma yükü olduğundan az olabilir.

## Bulunan hata

`GET /api/planets/:id` 200 seviyesinde bir kez 500 verdi: `UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1`. Son üç günün canlı kayıtlarında yok. Bağlantı başına `BEGIN` sızıntısı olabilir; kök neden aranmadı.

## Önerilen sıra (eski)

Güncel sıra: `docs/scaling-architecture-plan-2026-10-27.md` §16.

1. **Özel havuz:** yazmayan rotaları okuma listesine almak ve kalanlar için havuz bütçesini ölçmek. 5xx'in kaynağı bu.
2. **`plan_cache_mode=force_custom_plan` denemesi:** 100 seviyesinde en pahalı 25 sorgu 40 sn sürerken PostgreSQL ~300 sn CPU harcadı. Fark planlamadan geliyor olabilir (`track_planning` ile doğrulanmalı).
3. **Sorgu sayısı:** `planets`, `planet`, `session/pending`, `rewards`, `monuments`, `collect`.
4. **Üreteci başka makineye almak**, ardından 100, 150, 200 ile yeniden ölçmek.

## Tekrarlamak için

`tools/capacity.mjs --scenario real --activity-multiplier 3`; tablo `tools/capacity-workload.ts`. Sunucuda: `~/cap-prep4.sh`, `~/cap-ladder.sh`, `~/cap-level.sh`, `~/cap-verdict.py`, `~/cap-restore.sh`. Ham raporlar: `~/capacity-run-20261102/out/real/`. Bu klasörde: `capacity-run-2026-11-03/`.

## Sonraki koşularla karşılaştırırken (2026-11-04)

Araç bu raporun koşularından sonra değişti; yeni sayılar bu tablolarla bire bir kıyaslanamaz.

- **Isınma artık ölçüme girmiyor.** Bu rapordaki gecikmeler rampayı ve ilk okumaları da içeriyordu. Bu, eski sayıları kötü gösterir.
- **Oyuncu işleri artık sunucuyu beklemiyor.** Toplu okuma, tek okuma ve yazmalar kendi takvimiyle başlıyor; eskiden sunucu yavaşlayınca araç da yavaşlıyor ve en kötü gecikmeler gizleniyordu (coordinated omission). Bu, eski doygunluk sayılarını iyi gösterir: 200 seviyesindeki gerçek kuyruk bu rapordakinden kötü olabilir.
- **Araç yeni istemciyi taklit ediyor:** trafik uyandırması, sakin yoklama, olay kapısı, tek dünya okuması ve temas sonu okumaları. Eskiden temas sonu okumaları hiç yoktu.
- **Hâlâ eski olan:** toplu ve tek okuma tabloları eski istemcinin kaydı. İniş patlamaları orada hâlâ bütün ekranları okuyor, yani yük olduğundan fazla olabilir. Yeni sürüm canlıya çıkınca karışım yeniden ölçülmeli.

Yerel küçük deneme (20 oyuncu, 3 dakika, ×3): oyuncu başına ~0,97 istek/sn, trafik payı ~%24, sıfır beklenmeyen durum. Bu rapordaki 1,56 ile kıyas yalnız kaba bir işarettir: galaksi ve oyuncu sayısı farklı, olay okumaları oyuncu sayısıyla büyür.

