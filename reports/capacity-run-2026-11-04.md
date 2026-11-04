# Yük testi, 4 Kasım 2026

Sürüm `85977d9e`, 6 çekirdek / 12 GB sunucu, dolu galaksi tohumu (2.000 hesap, galaksi başına 1.000), `--scenario real`. Her seviye aynı temiz veriden başladı: 60 sn kademeli giriş, 300 sn ölçüm. Oyun iki oturumda 100 dakika bakımdaydı (00:56–02:12 ve 02:19–02:43 UTC); öncesinde online oyuncu ve yolda filo yoktu. Canlı veriye dokunulmadı.

## Sonuç

Düzeltilmiş araçla ve istenen ~3 kata yakın oranda (oyuncu başına ~1,1 istek/sn):

| Aktif oyuncu | İstek/sn | Okuma p50 / p95 / p99 | Yazma p50 / p95 / p99 | 5xx | Zaman aşımı | Sunucu CPU p50 / p95 | Sonuç |
|---|---|---|---|---|---|---|---|
| 150 | ~166 (1,11) | 34 / 921 / 3.451 ms | 158 / 1.686 / 3.252 ms | 141 (%0,26) | 0 | %70 / %93 | Ayakta, hedef üstü |
| 200 | ~217 (1,09) | 67 / 2.688 / 6.968 ms | 248 / 2.251 / 4.900 ms | 613 (%0,86) | 107 | %84 / %96 | **Kırıldı** (okuma p95 > 2.000) |
| 250 | ~274 (1,10) | 292 / 5.973 / 13.718 ms | 942 / 4.131 / 6.602 ms | 1.939 (%2,14) | 3.648 (%4,03) | %94 / %98 | **Kırıldı** |

Bugünkü sınır: **dolu galakside ~150 aktif oyuncu**, 200 kırılma noktası. Üç seviye de hedefleri (okuma p95 ≤250 ms, yazma p95 ≤400 ms) karşılamadı. 100 seviyesi düzeltilmiş araçla koşulmadı. Bu sayılar bugünkü küçük canlı galaksiler için değil, dolu galaksi içindir.

**Bu sonuç iyileştirme kanıtı değildir.** 200, ×3 yükte de kırıldı (bu koşu araç düzeltilmeden önceydi). Araç bu arada değiştiği için 3 Kasım'la sayılar birebir kıyaslanamaz. Bkz. "3 Kasım'la kıyas".

## Bulgular

1. **Sınırı CPU belirliyor.** 200'de sunucu CPU'su p95 %96. API süreçleri ortalama %65–80, Postgres %74. API olay döngüsü rahat kalıyor (p95 45 ms), bağlantı havuzu bekliyor (p95 832 ms). Üreteçler toplam ~1,2 çekirdek yiyor, yani kapasitenin bir kısmı testin kendisine gidiyor.
2. **5xx'lerin neredeyse tamamı `placementGate` kuyruğu.** 150 ve 200'de 5xx'lerin tümü, 250'de 1.939'un 1.937'si `RETRYABLE` kodlu. Bu kod iki yerden gelebiliyor, ama çalışma anı sayaçları kuyruk zaman aşımını gösteriyor. Etkilenen ~22 rota isteklerin yalnız ~%6,5'i. API başına 2 kira var ve 2 saniyede sıra gelmezse 503 dönüyor. En çok `GET /api/monuments` (200'de 196), `POST /api/planets/:id/collect` (51), `GET /api/legacy/me/reveals` (49), `POST /api/auth/refresh` (40) etkileniyor. `monuments` okurken yazdığı için kira tutuyor; diğerleri incelenecek.
3. **Olay yayılımı isteklerin yarısından fazlası, oyuncu sayısıyla da azalmıyor.** Her `launch`, `mining`, `arrival` ve `pirate` olayı galaksideki herkese gidiyor, herkes trafik ve/veya saha okuyor. Oyuncu başına 0,32 trafik + 0,25 saha okuması, yani toplamın ~%52'si. Dinleyici hesap ~0,4 olay/sn saydı (200 sn'de 28 `mining`, 23 `launch`, 14 `arrival`, 8 `pirate`, 6 `traffic`). Bu olayların çoğu tohumun sabit uçuş takviminden geliyor. Bu okumalar tek tek ucuz, ama toplam oyuncu × olay kadar büyüyor. Uyanma (`shard:traffic`) devredeyken bu okumalar büyük ölçüde gereksiz olabilir.
4. **Hipotez, kanıtlanmadı: sezon satırında kilit kuyruğu.** `update seasons set spawn_gate_through` ortalaması yük altında uzuyor: 200'de 466 ms, 250'de 1.718 ms (canlıda 1 ms). `GET /api/monuments` ve başka akışlar sezon satırında paylaşımlı kilit alıyor (`monumentView.ts:34`). Bekleyen bu `update`, arkasından gelen paylaşımlı kilitleri de sıraya sokuyor olabilir. Doğrulamak için bir sonraki koşuda `pg_locks` örneklemek gerekiyor.

## Ölçümü bozan hatalar

- **Tek üreteç 100 oyuncuda doyuyor.** İlk koşu okuma p50 1.378 ms ile "kırıldı", aynı yük dört üreteçle p50 30 ms verdi. Sunucu değil, üretecin kendi olay döngüsüydü. Yeni kurulumda oyuncu başına üreteç payı düşürüldü (5 üreteç). 150 ×2'nin iki üreteçli koşusu da bu yüzden güvenilmez.
- **Araç trafiği olay başına iki kez okuyordu (benim hatam, `85977d9e`).** Gerçek istemci (`useEventStream`) trafiği olay başına bir kez okuyor. Düzeltince trafik 0,54'ten 0,32 istek/sn'ye indi. Bu hatadan önceki bütün koşular şişik. Düzeltme bu raporla birlikte, henüz commit edilmedi. Canlı sürümü etkilemiyor.
- **Yavaş görünen `sh.ordinal` sorgusu** (8,7 sn) aracın koşu sonu denetimi, oyun yükü değil.
- `releaseIdentity` konteynerde hep yanlış; imaj ve commit elle doğrulandı.

## Doğrulanmamış koşular (hatalı araç, yalnız eğilim için)

| Koşu | Çarpan | İstek/sn | Okuma p95 | Yazma p95 | 5xx | Sonuç |
|---|---|---|---|---|---|---|
| 100, 1 üreteç | ×3 | 1,48 | 6.208 | 6.061 | 91 | Geçersiz, üreteç doydu |
| 100, 4 üreteç | ×3 | 1,56 | 488 | 1.354 | 72 | Ayakta |
| 100, 4 üreteç | ×2 | 1,30 | 220 | 604 | 2 | Ayakta, hedefe en yakın |
| 150, 2 üreteç | ×2 | 1,29 | 572 | 1.353 | 108 | Ayakta |
| 200, 5 üreteç | ×2 | 1,33 | 1.801 | 2.260 | 430 | Ayakta, sınırda |
| 250, 5 üreteç | ×2 | 1,32 | 8.266 | 5.529 | 2.439 | Kırıldı |
| 200, 5 üreteç | ×3 | 1,43 | 5.178 | 4.090 | 2.445 | Kırıldı |
| 200, 5 üreteç | ×1 | 0,83 | 2.022 | 1.775 | 34 | Kırıldı (22 ms farkla) |
| 250, 5 üreteç | ×1 | 0,77 | 949 | 1.604 | 69 | Ayakta |

**Koşular gürültülü.** 200 ×1, 250 ×1'den kötü çıktı ve 150'nin düzeltilmiş p95'i (921) hatalı koşudan (572) yüksek. Tek koşu sınırı ±50 oyuncu içinde kesinleştirmez. 200 ×1'de iki `asteroid_hour` olayı denk geldi; etkisi ayrıca ölçülmedi.

## 3 Kasım'la kıyas

Aynı ×3 ve 200 oyuncuda (düzeltme öncesi araçla) 5xx %4,05'ten %2,60'a, zaman aşımı 1.056'dan 162'ye indi; ama okuma p95 3.298'den 5.178 ms'ye çıktı. Araç arada değişti: sunucu yavaşlayınca yükü kısmayı bıraktı, ısınmayı ölçümden çıkardı ve 3 Kasım koşusunda üreteç doymuş olabilir. O yüzden "şu kadar iyileşti" denemez. Gerçek iyileşme ancak aynı araçla önce/sonra koşusuyla ölçülür.

## Kapasite yorumu

- **Yük yüksek tutuldu.** 1,1 istek/sn, eski istemcinin 0,327'sinin ~3,4 katı. Araçtaki toplu okuma tabloları hâlâ eski istemciden. Ayrıca herkes sürekli online.
- **HTTP denkliği kaba:** 150 oyuncunun 166 istek/sn'si eski istemcili ~500 gerçek oyuncuya denk. Bağlantı sayısı ve olay yayılımı o kadar büyümediği için bu "500 kişi taşırız" demek değil.
- **Ayrı makineli üreteç** ~1,2 çekirdek geri verir; sınırı biraz yukarı taşır, ama değiştirmez.

## Sıradaki adımlar

1. Kira tutan okuma rotalarını incele; yazmayanları `PLACEMENT_READ_ROUTES`'a taşı, `monuments` için ayrı çözüm bul. Beklenti: 5xx'ler büyük ölçüde gider.
2. Sezon satırı kilit hipotezini `pg_locks` ile doğrula. Doğruysa `spawn_gate_through`'u sezon satırından ayır.
3. Uyanma açıkken olaylardaki trafik okumasını kaldırmayı değerlendir (isteklerin ~%29'u). Ödünleşim: başkasının filosu birkaç saniye geç görünür. Bu "Anlık" ilkesine dokunduğu için owner kararı.
4. Aynı araçla önce/sonra koşusu; ardından 16.7 ve F2/F3.

## Kanıt

Sunucuda `~/capacity-run-20261104/out/real/` (F150, F200, F250 ve diğerleri): rapor JSON'ları, SQL özetleri, CPU ve bağımsız yoklama örnekleri. Dinleyici sayımı: `out/witness-150.json`, `out/witness-200.json`. Betikler: `~/capq-*.sh`.
