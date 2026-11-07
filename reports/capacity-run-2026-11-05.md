# Yük testi ve darboğaz analizi, 5 Kasım 2026

Test edilen kod: `b0053dd3` (yerel master, canlıda değil). Kontrol: aynı gece `85977d9e`. 6 paylaşımlı çekirdek / 12 GB sunucu, dolu galaksi tohumu (2.000 hesap), `--scenario real`, ×2 etkinlik, 5 üreteç. Oyun 02:36–04:31 TR arası bakımdaydı. Canlı veriye dokunulmadı.

## Sonuç

1. **Duvar, istek işleme CPU'su.** Üç API, süreç başına ~%83'e, toplam ~2,5 çekirdeğe geldiğinde gecikme patlıyor. Bu tavan her seviyede aynı (2,41–2,51 çekirdek).
2. **Maliyet büyük oranda SQL gidiş-dönüşünde.** Bir istek API'de yaklaşık `4,4 ms + deyim başına 2,2 ms`, Postgres'te deyim başına ~1 ms harcıyor. Ortalama istek 4,7 deyim atıyor.
3. **Model gerçeği tutuyor.** Tek tek ölçülen rota maliyetleri oyuncu karışımıyla çarpılınca 14,4 ms API ve 4,5 ms PG çıkıyor. Yük altında ölçülen 13,8 ve 4,7 ms. Trafiksiz koşunun 15,3 ms'lik sonucunu da aynı hesap birebir veriyor.
4. **Sunucu çatısı, API çatısının hemen üstünde.** Hesap: API süreçleriyle ~200, makineyle ~240 oyuncu (×2 etkinlik, üreteç hariç). Yani sadece API süreci eklemek fazla kazandırmaz.
5. **`b0053dd3`'teki `watch.soon()` zararlı, canlıya gitmemeli.** Kira değişikliği ise işe yarıyor (5xx −%67) ve kalmalı.
6. **Akış bağlantıları duvar değil.** 250 açık akış API'lerde toplam 0,16 çekirdek tutuyor.

## Seviyeler

Her satır 60 sn giriş + 300 sn ölçüm. Süreler ms. Çekirdek sütunları ortalamadır.

| Seviye | Oyuncu | İstek/sn (kişi başı) | Okuma p50/95/99 | Yazma p50/95/99 | 5xx | Ağ hatası | API çekirdek | PG çekirdek | API ms/istek | Sonuç |
|---|---|---|---|---|---|---|---|---|---|---|
| C200, eski kod `85977d9e` | 200 | 214 (1,07) | 76/1.224/3.166 | 293/2.224/3.874 | 283 | 0 | 2,36 | 0,82 | 11,0 | Ayakta |
| N150, yeni kod | 150 | 139 (0,93) | 62/4.513/9.782 | 194/2.809/7.455 | 50 | 208 | 2,49 | 0,84 | 17,9 | Kırıldı |
| N200, yeni kod | 200 | 182 (0,91) | 124/3.384/7.311 | 307/3.505/6.215 | 94 | 0 | 2,51 | 0,85 | 13,8 | Kırıldı |
| T200, trafik okuması yok | 200 | 157 (0,79) | 126/1.853/3.627 | 347/3.036/5.183 | 95 | 0 | 2,41 | 0,92 | 15,3 | Ayakta |
| E300, olay okuması yok | 300 | 169 (0,56) | 621/6.390/9.596 | 691/5.026/8.358 | 649 | 3.038 | 2,48 | 0,91 | 14,7 | Kırıldı |

Tek koşunun p95'i güvenilir değil: aynı kod iki gecede 200 oyuncuda 2.688 ve 1.224 verdi. CPU/istek çok daha kararlı olduğu için kararlar ona dayanıyor.

## Deneyler

### Yalnız akış (S200)

250 akış, oyun etkinliği yok. API toplam 0,16 çekirdek, süreç başına ~90 MB. Bu koşuda olay yayılımı neredeyse yok, yani bu sayı boştaki bağlantının maliyeti.

### Rota başına maliyet (U1)

Sessiz sistemde rota başına 1.000 istek, 40 istek/sn. Birim maliyet × N200'deki sayı:

| API payı | PG payı | İstek payı | API ms | Deyim | Rota |
|---|---|---|---|---|---|
| %15,7 | %9,8 | %27,7 | 7,7 | 2,3 | `GET /api/mining/field` |
| %11,3 | %8,6 | %8,6 | 17,7 | 5,7 | `GET /api/pirates` |
| %10,1 | %8,6 | %14,8 | 9,1 | 2,9 | `GET /api/galaxy/traffic` |
| %8,7 | %14,7 | %2,8 | 42,1 | 12,9 | `GET /api/planets` |
| %6,0 | %6,2 | %3,4 | 23,5 | 8,1 | `GET /api/session/pending` |
| %5,2 | %5,9 | %2,0 | 35,6 | 12,7 | `GET /api/rewards` |
| %4,8 | %4,4 | %3,5 | 18,1 | 4,8 | `GET /api/intel` |
| %4,4 | %4,7 | %3,5 | 16,8 | 4,6 | `GET /api/mining/status` |
| %4,2 | %5,6 | %3,1 | 18,2 | 6,6 | `GET /api/season` |
| %4,0 | %2,1 | %3,0 | 18,5 | 3,5 | `GET /api/galaxy` (193 KB) |
| %3,8 | %3,4 | %1,9 | 26,8 | 17,5 | `GET /api/monuments` |

İsteklerin %94'ü ölçüldü. Yazma rotaları (isteklerin ~%3'ü) bu tabloda yok. `/api/session/return` (17,2 deyim, 40 ms) az çağrılıyor ama pahalı.

Regresyon, `galaxy` ve `leaderboard` hariç 27 rota: API `4,35 + 2,23 × deyim` (R² 0,79), PG `0,29 + 1,05 × deyim` (R² 0,57).

### En sık deyimler (N200, 59.988 istek, 247.465 işlem)

| Çağrı | İstek başına | Deyim |
|---|---|---|
| 52.086 | 0,87 | Kira sonrası yerleşim kontrolü (`players.id, season_id, placement_version`) |
| 12.075 | 0,20 | Asteroit satırı (`mining/field` ve benzerleri) |
| 7.992 | 0,13 | Oturum kontrolü (`accounts.auth_version`) |
| 6.922 | 0,12 | Komutan satırı |
| 6.014 | 0,10 | `sensor_epochs` |

Yerleşim kontrolü tek başına işlemlerin %21'i. Postgres'te ucuz (0,17 ms), maliyeti API'de: regresyona göre istek başına ~1,9 ms, yani API CPU'sunun ~%13'ü. Eski notum "~%7" diyordu, ölçüm daha yüksek çıktı.

### Deyim maliyeti (tek deyim, API süreci gözünden)

| Yol | 100/sn | 400/sn | 400/sn, 10'lu grup |
|---|---|---|---|
| Ham `postgres.js` | 0,33 ms | 0,51 ms | 0,25 ms |
| Drizzle | 1,38 ms | 0,95 ms | 0,36 ms |
| Drizzle `.prepare()` | 1,78 ms | 0,78 ms | ölçülmedi |
| Ham, Docker köprüsü olmadan | 0,50 ms | 0,19 ms | ölçülmedi |

- **Grup halinde göndermek en büyük kazanç:** deyim başına %50–60 ucuz. Daha az uyanma ve sistem çağrısı demek.
- **`.prepare()` umduğum kadar kazandırmıyor.** Basit sorguda 400/sn'de −%18, 100/sn'de kazanç yok. Profilde `_prepare` %13,8 görünse de ilk iş bu olmamalı.
- Docker köprüsü ölçülebilir ama küçük. Unix soketi denemesi kurulum hatasıyla çalışmadı.

### Taban (boş istek)

| Hedef | 40/sn | 120/sn | Sınırsız, üreteç hızı kadar |
|---|---|---|---|
| Çıplak Node HTTP | 1,78 ms | 1,18 ms | 0,23 ms, 2.010/sn |
| Fastify | 2,68 ms | 1,64 ms | 0,36 ms, 1.341/sn |
| + hız sınırı, bellekte | 2,52 ms | 2,14 ms | 0,32 ms, 1.735/sn |
| + hız sınırı, Valkey | 2,73 ms | 2,98 ms | 0,53 ms, 1.167/sn |
| Bizim API, `/api/maintenance` anonim | 4,73 ms | 3,99 ms | 1,86 ms, 605/sn |

- Çerçeve ve hız sınırı darboğaz değil. Fastify'dan kurtulmanın anlamı yok.
- Aynı API, ağır iş olmayınca **605 istek/sn** yapıyor. Gerçek karışımda süreç başına ~60 istek/sn. 10 kat fark uygulama işinde.
- İstek başına CPU, hız arttıkça düşüyor. Yani bu tablo yük altındaki sayılardan pahalı görünür. U1'in 4,35 ms'lik sabiti de biraz şişiktir.
- Bu ölçüm için `/api/maintenance` tokenlı satırı geçersiz: tek hesap 300/dk sınırına çarptı.
- `/health` 25 ms tutuyor ve aşırı yükte 20 sn'ye çıkıyor, çünkü veritabanı soruyor.

### Node bayrakları, aynı pencerede A/B

Üç API aynı yükü alırken bayraklar dönüşümlü verildi (AB1–AB3, 180 sn). Log-doğrusal model: koşu + konum + bayrak.

| Bayrak | CPU/istek | Bedeli |
|---|---|---|
| `--max-semi-space-size=64` | −%8,6 | RSS +120 MB/API, GC duraklaması p50 4→20 ms, p99 ~30→85–200 ms |
| `--experimental-async-context-frame` | −%7,2 | Görünür bedeli yok. Node 22'de deneysel |
| İkisi birlikte, aynı API'de | −%16 ila −%22 | Olay döngüsü p99 70–80 → 52–57 ms |

Model artığı ~%3,5, tek dizi. Semi-space 64 duraklamaları fazla uzatıyor: daha küçük değer (16–32) denenmeli. Bu kısa koşular günün ağır anını içermediği için N200 ile gecikme kıyası yapılamaz.

## `b0053dd3` kararı

| Değişiklik | Ölçüm | Karar |
|---|---|---|
| 12 okuma kirasız, `monuments` yazınca kiraya geçiyor | 5xx 283 → 94, `monuments` hata listesinden çıktı | Kalsın |
| Akış başına sunucu trafik kontrolü (`watch.soon()`) | İstek −%15 ama API CPU +%6, okuma p95 ×2,8, trafik p95 8.637 ms | **Geri alınmalı** |

Kendi hatam: okumayı sunucuya taşımak işi azaltmadı, her bağlantı için aynı hesabı sunucuda tekrarlattı. N150'deki 208 ağ hatasının 197'si trafik rotasının 15 sn zaman aşımı. Bu kadar uzun bekleyişin kesin nedenini bulmadım. Aday, geçersiz kılınan önbellek dolumunun kendini zincirlemesi (`asyncCache.ts`). Kanıtlanmadı.

## Bulunanlar ve çürütülenler

- **Olay kaynaklı okumalar isteklerin ~%42'si, API CPU'sunun ~%28'i.** Olay okuması yokken oyuncu başına 330 sn'de `mining/field` 83 → 19, `pirates` 26 → 9, trafik 45 → 0. Oyuncu başına oran sunucudaki 5,5 sn'lik kapıyla sınırlı. Bu yüzden sayı oyuncuyla katlanmıyor, ama yoğun galakside her oyuncu ~4 sn'de bir saha okuyor. Kıyas 200 ve 300 oyuncu arasında, kapı doluyken geçerli sayıyorum.
- **Ucuz istekleri kaldırmak beklenenden az kazandırıyor.** T200'de isteklerin %27'si azaldı (eski koda göre), API CPU ~%4 düştü. Çünkü en ucuz istek bile 2–3 deyim atıyor. İki boyut birlikte çalışılmalı: istek sayısı ve istek maliyeti.
- **Kalan 5xx'lerin tamamı yazmalarda kira kuyruğu.** N200'de 94'ün 94'ü `RETRYABLE`. `auth/me` dışında hepsi `POST`.
- **Sezon kilidi hipotezi desteklenmedi.** `update seasons set spawn_gate_through` kısa bakışların %9–14'ünde bekliyor (ort. 158–896 ms), ama bekleyen en fazla 1–2. ≤200 oyuncuda kuyruk yok.
- **"Makine hızı değişiyor" tahminim tutmadı.** Hash ölçümü seviyeler boyunca p50 0,41–0,44 ms sabit. Makine ölçümü ancak P200'den sonrasını kapsıyor.
- **Dakika başı takılması tekrar doğrulandı.** Tüm gece, 5.702 örnek: dakikanın ilk 6 sn'sinde bellek taraması p95 134 ms (kalan 32), `fsync` p95 146 ms (kalan 11). Ayrıntı: VPS'in paylaşımlı çekirdekleri.
- **Yanıltıcı görünen şey:** koşu sonu Postgres %470 ve 9–15 sn'lik `sh.ordinal` sorgusu aracın kendi denetimi. Oyun yükü değil.
- **Açıklanamayan:** yük tavanın altındayken `api2` diğerlerinin yarısı kadar istek alıyor (27 ve ~50/sn), üç koşuda da. Tavana yaklaşınca dengeleniyor. Nedeni (`least_conn`, işçi başına sayaç) doğrulanmadı.

## F2 / F3 için önerilen sıra

Bütçe hesabı, ölçüm değil. ×2 etkinlik, üreteçsiz. API tavanı 2,5 çekirdek (3 süreç), makine tavanı 4,5 çekirdek (%75).

| Adım | API ms | PG ms | İstek/kişi | API tavanı | Makine tavanı |
|---|---|---|---|---|---|
| Bugün | 14 | 5 | 0,9 | ~200 | ~240 |
| 1. Bayraklar, `soon()` geri | 12 | 5 | 0,9 | ~230 | ~270 |
| 2. Sık deyimleri sıfırla | 9,5 | 4 | 0,9 | ~290 | ~330 |
| 3. Ağır rotaları birleştir | 8,5 | 3,5 | 0,9 | ~330 | ~370 |
| 4. Olay okumalarını kaldır (F3) | | | CPU −%28 | ~450 | ~510 |
| 5. Adanmış ve daha çok çekirdek | | | | süreç sayısıyla büyür | çekirdekle büyür |

1. **Bayraklar ve `soon()` geri alma.** En ucuz adım, `NODE_OPTIONS` ve küçük kod. Semi-space için 16 ve 32 ayrıca ölçülür.
2. **İsabette sıfır deyim.** Hedef: önbellekten dönen okuma veritabanına hiç gitmesin.
   - Yerleşim kontrolü: ayrı deyim yerine okumanın kendisine bindirilir. Aynı SQL tek anlık görüntü okuduğu için güvencesi bugünkünden zayıf olmaz. `placement-read.test.ts` yarışı kilitliyor, önce test.
   - Oturum, komutan, asteroit satırları: mevcut `NOTIFY` geçersiz kılmasıyla bellekte.
3. **Ağır rotalar:** `planets`, `planets/:id`, `planet`, `rewards`, `monuments`, `session/return`. 12–17 deyim, gruplanırsa deyim başına yarı fiyat. Hedef ≤5 deyim.
4. **F3, ama sahadan başlayarak.** Sıra F3.2 değil, en büyük pay olan `mining/field` (F3.3). Olay başına bir kez galaksi düzeyinde hesap, bağlantı başına tekrar yok. Sisli veri için bağlantı başına projeksiyon yalnız aday izleyicide (F3.2 tasarımı). Sonra `pirates`, sonra trafik. Fog kuralı aynen geçerli: sonraki görüş değişimi tele gitmez.
5. **F2, yazmalar için gerekli ama ilk iş değil.** `NOTIFY` kilidi ≤200'de bir sorun olarak görünmedi. F2.2 komut hattı kira havuzunu kaldırdığı için kalan 5xx'leri çözer, F3'ün sıralı akışı da ona dayanır. Bu yüzden 1–3'ten sonra, F3'ün sahadan sonraki parçalarıyla birlikte. Ara çözüm adayı: `PLACEMENT_POOL_MAX` 2 → 4, denenmedi.
6. **Altyapı en son değil, paralel.** Adanmış çekirdek dakika başı takılmasını kaldırır, kod adımlarının kazancını ölçmeyi de kolaylaştırır. App/DB ayrımı F5.1 ile kalıyor.

Her adımdan sonra aynı araçla CPU/istek ölçülür. Tablodaki sayıların hiçbiri söz değildir.

## Ölçülemeyenler

Süre bitince koşmadı: oturumum E300'ün ardından kesildi, bekçi oyunu planlandığı gibi 04:31 TR'de açtı. Bir sonraki bakımda:

- **5 API aynı makinede:** override hazır (`capr-a5.env`). Çatının API mi makine mi olduğunu ölçer.
- **Hız sınırı Valkey'siz, tam yükte:** override hazır (`capr-nolimit.env`). Taban testine göre kazanç küçük.
- **E500:** E300 kırıldığı için anlamsız. Adım 4'ten sonra.
- **Üye olma dalgası hiç ölçülmedi.** Araçta kayıt ve onboarding rotası yok, `RATE_LIMIT_SIGNUP_MAX` 18. **Reklam kampanyasından önce mutlaka gerekli.**
- Yazma rotalarının birim maliyeti, `PLACEMENT_POOL_MAX` 4, unix soketi.

## Bakım kaydı

- 02:36 TR kapandı, 04:31 TR bekçi betiğiyle açıldı. Söz verilen sınır 05:00'ti.
- Doğrulandı: API, worker ve arena sağlıklı (`62a3f65b`, `491c1a3e`), `/api/servers` 200, kapasite konteyneri 0, bakım satırı iptal, geçmiş olayların tamamı işlendi, son 30 dk'da seviye 50+ log yok.
- Kanıtlar sunucuda `~/capacity-run-20261105/`. CPU profilleri P200 klasöründe.
