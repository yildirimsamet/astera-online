# 17 · Paket küçültme planı (V6g, 2026-10-23)

Sahip: "Paket küçültme taskını planla, dikkat edilmesi gereken yerleri not et (test edilmesi
gereken, kabul edilmeyecek durumları da not et) ve başla."

## Neden

50 pilotluk gerçek soket savaşı (16-yarik-v6-plani.md, V6g 50 pilot): anlık görüntü ort. 13 KB ×
15 Hz ≈ pilot başına 1,5 Mbit/sn (~700 MB/saat). Kalemler: mermi 5,1 · duman 3,5 · diğer pilotlar
2,4 · kargo 1,2 · maden 1,0 · kendi gemi 0,3 · çarpma 0,1 KB. Mermi, duman, çarpma, kargo ve maden
her pakette **tam durum** olarak gidiyor; çoğu iki paket arasında hiç değişmiyor.

## Hedef

- 50 pilotluk savaşta paket ort. ≤ 4 KB (Faz 1–3), diğer pilotlar kırpılınca ≤ 2,5 KB (Faz 4).
- Hiçbir yeni bekleme yok: 15 Hz, 133 ms enterpolasyon, girdi tamponu aynı.
- Sunucu tick p95 ve istemci paket çözme süresi 50 pilotta bugünkünden kötü değil.

## Fazlar

**Faz 0 · 100 kişilik odanın kırıkları (paketten bağımsız, önce):**
- İstemci kadroyu (roster) en çok 16 satır kabul ediyor; 14. insan pilot girince herkesin
  bağlantısı "protocol" diye kopar. Sınır ortak sabit olur (`ARENA_MAX_SEATS` + botlar);
  `ARENA_SEATS` bu sabiti aşamaz.
- Kadro her ölüm/katılımda herkese anında gidiyor (N² mesaj). En çok 0,5 sn'de bir, birleşik.
- "Alan dolu: en fazla 8 pilot" metni sayısız olur (tr/en).

**Faz 1 · Ortak akış modülü (rules, saf fonksiyon):** sunucu her anlık-görüntü tickinde önceki
tickle karşılaştırır, yalnız farkı üretir; istemci aynı modülle uygular.
- Mermi: yalnız **doğanlar** (yuva, konum, hız, ömür, sahip) + **erken bitenler** (vuruş/kaya).
  Mermiler düz gider (`advance`); istemci zaten aradaki tickleri ilerletiyor.
- Duman ve çarpma: yalnız doğanlar; istemci yaşlandırır ve ömrü bitince söndürür (sunucuyla
  aynı fonksiyon: `ageEffects`).
- Kargo: yalnız değişen satırlar (konum/miktar/tür; yaş istemcide kullanılmıyor) + silinenler.
- Maden: yalnız ≥ 0,2 birim değişen, 0'a/tam dolana inen, kuruma durumu değişen yuvalar.
- **Anahtar kare (key):** tam durum; istemci havuzları temizleyip baştan kurar.

**Faz 2 · Sunucu:** protokol 5. Ortak fark metni tick başına bir kez kurulur (bugünkü gibi).
Anahtar kare: girişte, yeniden bağlanmada, dev eylemlerinde, **bir gönderim atlandığında**
(`bufferedAmount` sınırı) ve emniyet için pilot başına 10 sn'de bir (pilotlara yayılmış).
Eski sürüm istemciye sessiz bekleme yerine `kick: version`.

**Faz 3 · İstemci:** paketten havuzları ezmek yerine farkı uygular; `version` atılmasında
"Oyun güncellendi, sayfayı yenile".

**Faz 4 · Diğer pilotlar (ölçümden sonra):** uzak gemide kullanılmayan alanları ve gereksiz
hassasiyeti kırp. Hangi alanın uzak gemide okunduğu tek tek doğrulanmadan dokunulmaz.

**Sonraya (bu taskta değil):** duman havuzu (96) büyütme + görüş hesabı için uzaysal ızgara
(havuz büyürse `hiddenBySmoke` maliyeti N² × havuz büyür); mermi AOI; ikili kodlama; UDP.

## Dikkat edilecek yerler

- **Olay kaybı:** TCP kaybetmez, ama sunucu tampon doluyken mesajı atlıyor. Atlanan pilota bir
  sonraki paket anahtar kare olmalı; yoksa mermi/duman/kargo kalıcı olarak eksik kalır.
- **Doğup aynı pencerede ölen mermi** hiç gönderilmez (çarpma ayrıca gider); doğanlar
  bitenlerden **sonra** uygulanır (aynı yuvada eski biter, yeni doğar).
- **Yuva tekrar kullanımı:** havuzlar halka; doğum tespiti "ömür arttı / yaş azaldı / pasiften
  aktife" ile yapılır, imleç sayısına güvenilmez.
- **Anahtar kare tick dışında** (giriş/dev mesajı tickler arası gelir): sonraki fark bir önceki
  anlık-görüntü tickine göre olduğu için yeniden uygulanan satırlar zararsız (yuva bazlı, idempotent).
- **Çözücü sınırları** havuz boyutlarından gelir (sihirli sayı yok): anahtar karede havuzun tamamı.
- Sunucu duman/çarpma yaşlandırması ile istemcininki **aynı fonksiyon** olmalı (ayna).
- Kendi gemi (`self`) tam hassasiyette kalır: uzlaştırma (reconcile) ondan yeniden oynatır.
- Web ve arena **birlikte** deploy edilir (protokol 4 → 5).

## Test edilecekler

- Eşdeğerlik: botlu dünyada her anlık-görüntü tickinde fark uygulanan istemci havuzları =
  sunucu havuzları (mermi konumu ≤ 5 cm, duman/çarpma yaşı ≤ 1 tick, kargo birebir, kristal
  < 0,4 birim: eşik 0,2, anahtar kare tam değer verir, ortak kayıt ±0,2 geride olabilir; rezervin %1'i).
- Geç katılan (anahtar kare + farklar), yeniden bağlanan, atlanan paket sonrası anahtar kare.
- Vuruşla biten mermi bir sonraki pakette istemciden de silinir.
- Aynı yuvada bitip yeniden doğan mermi; aynı pencerede doğup ölen mermi.
- Kargo: mıknatısla çekilen parça hareket eder, toplanan silinir, enkaz dökülmesi doğar.
- Maden: kazılan düşer, kuruyan `dry`, yeniden yarıya dolunca `dry` kalkar.
- Çözücü: havuz sınırını aşan, bozuk, eski sürüm paketi reddeder.
- Oda: 100 kişilik kadro bağlantıyı koparmaz; kadro birleşik gider; eski sürüm `version` alır.
- Ölçüm: 50 pilot savaş önce/sonra (paket boyutu, tick, paket arası, istemci çözme süresi).

## Kabul edilmeyecek durumlar

- Sonsuza kadar uçan mermi, hiç sönmeyen duman, toplanmış ama görünen kargo, yanlış maden.
- Normal bağlantıda görünmeyen mermi/duman; geç katılanın var olan dumanı görmemesi.
- Vurulan geminin içinden bir paketten (66 ms) uzun süre geçen mermi.
- Herhangi bir yeni gecikme veya tampon; tick p95'te gerileme.
- 100 pilotlu odada paketin istemcide reddedilmesi; kadro yüzünden bağlantı kopması.
- Eski istemcinin sessizce yeniden bağlanma döngüsüne girmesi.

## Sonuç (Faz 0–3, 2026-10-23, VPS, aynı 50 pilot savaşı)

| | Protokol 4 (ortak satır tek kez) | Protokol 5 |
|---|---|---|
| Paket ort. / p95 | 13,0 / 15,2 KB | **2,8 / 3,6 KB** |
| Pilot başına indirme | 1565 kbit/sn | **340 kbit/sn** (~150 MB/saat) |
| İstemci JSON.parse ort. | 0,205 ms | **0,047 ms** |
| Sunucu tick p95 (medyan) | 18,4 ms | **14,2 ms** |
| Sunucu CPU | %37 | **%29** |
| Bozuk paket | 0 | 0 |

Kalan pay: diğer pilotlar 2,0 KB (paketin %71'i) → Faz 4. Anahtar kare pilot başına 10 sn'de bir
(600 / 125 sn / 50 pilot). İki kez ~200 ms olay döngüsü takılması (biri 66 ms GC ile); değişiklik
öncesinde de vardı (116–233 ms). Şüphe: sunucu ve 50 istemci aynı 3 CPU'luk konteynerde, Docker
CPU kotası; kanıtlanmadı, ayrı makineden istemciyle ölçülecek.

Kod incelemesinde bulunup düzeltilen: iki paket arası anahtar kare, o arada doğup ölen parçayı
istemcide sonsuza kadar bırakıyordu (eşdeğerlik testi yakaladı) → anahtar kare yalnız paket
ticklerinde. Bilinçli kabul: geç katılanın kristal değeri < 0,4 birim (%1) geride olabilir;
yeni katılanın adı başkalarında en çok 0,5 sn "Rakip N" görünebilir (kadro birleştirme).
Test edilemeyen: sunucu tamponu dolup gönderim atlandığında anahtar kare (yerelde 256 KB tampon
dolmuyor); mantık kural testinde (`feed.test.ts`, atlanan paket) ve kod incelemesinde doğrulandı.
