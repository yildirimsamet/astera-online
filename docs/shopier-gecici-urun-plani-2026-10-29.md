# Shopier — oyuncuya özel geçici ürün planı (29 Ekim 2026)

Bu plan `docs/shopier-otomatik-teslim-2026-10-16.md` içindeki **"sipariş notuna kod yapıştır"**
yönteminin yerine geçer. O belgedeki Shopier gerçekleri, webhook, iade, kuyruk ve eşitleme
kuralları geçerli kalır; değişen yalnız oyuncunun kim olduğunun nasıl bilindiğidir.

## Amaç

Türkiye'deki oyuncu (yalnız web; Android ayrı ele alınacak) görünümü Shopier'den TL ile
alır, **hiçbir şey yazmadan** görünüm hesabına kendiliğinden gelir.

## Sahip kararları (29 Ekim)

- Bağlama yöntemi: "Satın al" basışında o hesap + o ürün için **gizli, dijital, stoğu 1 olan
  geçici bir Shopier ürünü** açılır. Siparişteki `lineItems[0].productId` hesabı söyler.
- Ödenmeyen geçici ürün **48 saat** açık kalır; oyuncu her bastığında süre baştan başlar.
- Çift ödeme önlenir (çakışan açık ürünler kapanır). Yine de olursa sipariş "zaten sahip"
  nedeniyle kuyruğa düşer, iadeyi sahip Shopier panelinden yapar. Otomatik iade yok.
- Sayfa açıkken ürünün silinmesi canlı denemede ayrıca sınanmaz (48 saat bunu pratikte kapatır);
  yine de olursa temel kural gereği teslim edilir.

## Temel kural

Her geçici ürünün sunucuda bir kaydı vardır ve kayıt **hiç silinmez**. Bizim ürün
numaralarımızdan birine gelen **ödenmiş sipariş, kaydın durumu ne olursa olsun teslim edilir**
(açık, süresi dolmuş, iptal). Para geldiyse görünüm verilir.

## Akış

1. Oyuncu "Shopier ile öde · ₺99" basar → `POST /api/skins/shopier-checkout { itemId }`.
2. Sunucu, hesap kilidi altında: sahiplik kontrolü → çakışan açık kayıtları iptal → aynı ürün
   için açık kayıt varsa onu döndürür ve süresini 48 saat uzatır → yoksa önce **kendi kaydını**
   yazar, sonra Shopier'de ürünü oluşturur, ürün numarası + bağlantıyı kayda yazar.
3. Arayüz "Shopier'de öde ↗" bağlantısını gösterir; oyuncu dokununca Shopier yeni sekmede açılır.
4. `order.created` → imza → olay/sipariş tekrar engeli → tek satır, adet 1, TRY, kayıttaki tutar
   → kayıt bulunur → hak verilir (`source='SHOPIER'`, `orderRef='<sipariş>:<kozmetik>'`) → kayıt
   `PAID` → sipariş Shopier'de dijital teslimle kapatılır.
5. Oyuncu oyuna dönünce mağaza kendini yeniler (`useSkins` zaten `refetchOnWindowFocus` + 30 sn).
6. Arka plan temizliği süresi dolan, iptal edilen ve ödenip kapanan ürünleri Shopier'den siler.

## Aşama 0 — canlı deneme (kod yazılmadan önce, sahip onayıyla)

Tek gizli, dijital, stoğu 1, düşük fiyatlı test ürünü API'den açılır; sahip kendi kartıyla alır
ve iade eder. Webhook aboneliği bu aşamada açılır (token `.env`'e). Doğrulanacaklar:

| # | Soru | Sonuç kodu nasıl etkiler |
|---|------|--------------------------|
| A1 | API'den açılan ürünün bağlantısı hemen çalışıyor mu? | Çalışmıyorsa bağlantı gecikmeli verilir |
| A2 | `order.created` gövdesinde `lineItems[].productId` geliyor mu? | Gelmiyorsa yöntem çöker, plan durur |
| A3 | İmza hex mi, base64 mü, ham gövde mi? | `verifyShopierSignature` sadeleşir |
| A4 | Stok 0 olunca ikinci alım engelleniyor mu? | Engellenmiyorsa ikinci ödeme kuyruğa düşer |
| A5 | Başarısız ödeme stoğu düşürüyor/kilitliyor mu? | Düşürüyorsa stok 2 olur |
| A6 | `PUT /orders/{id}` dijital teslimle siparişi kapatıyor mu? | Kapatmıyorsa ödeme hesaba geçmez |
| A7 | Ödenmiş siparişin ürünü silinince sipariş, ödeme ve iade bozuluyor mu? | Bozuluyorsa ödenen ürün silinmez, yalnız gizli kalır |
| A8 | `refund.updated` gövdesi (`orderId`, `type`, `status`) | İade eşlemesi |
| A9 | Mevcut 6 ürünün KDV/kargo ayarları (`GET /products/{id}` izin veriyorsa) | Geçici ürün aynı ayarla açılır |

A2 olumsuzsa plan durur ve sahibe dönülür.

### Aşama 0 sonuçları (29 Ekim, canlı hesap; test ürünleri 52353763 ve 52354521, sipariş 969746749)

- **A1 ✅** Ürün 0,3 sn'de oluşur, `url` hemen açılır, dükkân sayfasında görünmez.
- **A2 ✅** `order.created` ödemeden ~1 sn sonra geldi; `lineItems[0].productId` ürün numarasını taşıyor.
  Not boş bırakıldı (`"note": ""`).
- **A3 ✅** `Shopier-Signature` = ham gövdenin HMAC-SHA256 **hex** özeti. **Her aboneliğin kendi
  token'ı var** (olay başına ayrı abonelik) → sunucu tek token değil token **listesi** kabul eder
  (`SHOPIER_WEBHOOK_TOKENS`, virgülle). Ek başlıklar: `shopier-account-id`, `shopier-api-version`,
  `shopier-event`, `shopier-timestamp` (saniye), `shopier-webhook-id`; `user-agent: Shopier`.
- **A4 ✅** Stok 0 olunca ürün sayfasından satın al düğmesi kalkar.
- **A5 ✅** Başarısız ödeme (3D) stoğu düşürmez, bildirim göndermez → stok 1 yeterli.
- **A6 ✅** `PUT /orders/{id}` `{"fulfillments":{"productType":"digital","note":…}}` → `status: fulfilled`,
  ardından `order.fulfilled` bildirimi.
- **A7 ✅** Ödenmiş siparişin ürünü silinince sipariş (satır, ürün no, başlık, tutar) ve bakiye
  hareketi bozulmaz. İkinci silme 404 `notFound` → "zaten silinmiş" sayılır. Silinen ürünün linki
  dükkân ana sayfasına yönlenir. → Kapanmış `PAID` ürünler de silinir.
- **A8 ⏭** Sahip ₺1 iadeyi atladı. Refund modeli belgede `orderId`, `type (full|partial)`,
  `status (pending|failed|succeeded)` — mevcut `refundSchema` ile aynı; ilk gerçek iadede doğrulanır.
- **A9 ❌** `GET /products/{id}` de 403. API'den açılan ürünün `vatPercent` değeri boş. KDV oranını
  sahip panelden söyler.
- Bilgi: ₺1'lik satıştan ₺0,66 kesinti (hizmet ₺0,55 + KDV ₺0,11); oran ₺49+ satışta ayrıca görülür.

## Veri modeli (tek migration, sıradaki boş numara — şu an 0211)

Bayrak canlıda hiç açılmadığı için `shopier_purchase_codes` boştur; tablo kaldırılır.

`shopier_checkouts`
- `id uuid pk`, `account_id uuid → accounts (set null)`, `item_id text`, `amount integer` (kuruş)
- `product_id text null` (Shopier yanıtına kadar boş), `url text null`
- `status` `PENDING | OPEN | PAID | EXPIRED | CANCELLED | FAILED`
- `order_id text null`, `created_at`, `expires_at`, `paid_at null`, `removed_at null` (Shopier'den silindi)
- tekil: `product_id` (null değilken); hesap + ürün için tek `PENDING|OPEN` (kısmi indeks)

`shopier_orders`: `code` sütunu yerine `checkout_id uuid null`. Diğer her şey aynı.

## Sunucu değişiklikleri

- `env.ts`: `SHOPIER_PRODUCTS` (ürün no + fiyat) yerine `SHOPIER_PRICES` (`{"planet-lava":9900,…}`,
  ücretsiz kozmetik reddedilir), `SHOPIER_IMAGE_BASE_URL` (görsellerin herkese açık adresi) ve
  `SHOPIER_WEBHOOK_TOKEN` yerine `SHOPIER_WEBHOOK_TOKENS` (abonelik başına bir token, virgülle; A3).
  `shopierReady` = bayrak + iki anahtar + en az bir fiyat + görsel adresi.
- `services/shopier.ts`: `createShopierProduct` (başlık, `type: digital`, `customListing: true`,
  `stockQuantity: 1`, `shippingPayer: sellerPays`, fiyat, görsel, açıklamada kayıt kısa kimliği)
  ve `deleteShopierProduct` (404 = zaten silinmiş = başarılı). İkisi de 3 sn zaman aşımı.
- `services/shopierSales.ts`:
  - `startShopierCheckout` — Polar'daki `startPolarPurchase` kalıbı: kayıt önce yazılır, Shopier
    sonra çağrılır; Shopier hata verirse kayıt `FAILED`, oyuncuya hata. Takılı kalmış `PENDING`
    (60 sn) iptal sayılır. Hesap başına en çok 5 açık kayıt; 6. basışta en eski açık kayıt iptal edilir.
  - `match` — not ayıklama kalkar; `line.productId` → kayıt. Kayıt yoksa `UNKNOWN_PRODUCT`
    (eski 6 ürün, sahipsiz ürün). Tutar kayıttaki `amount` ile karşılaştırılır.
  - `sweepShopierCheckouts` — en çok 20 kayıt/tur: süresi geçmiş `OPEN` → `EXPIRED`; içeriği
    başka yoldan sahiplenilmiş, hesabı silinmiş veya fiyatı artık güncel fiyattan farklı `OPEN` → `CANCELLED`; sonra `EXPIRED`,
    `CANCELLED` ve kapanmış `PAID` ürünleri (A7) Shopier'den silip `removed_at` yazar.
  - Webhook, iade, admin verme/kapatma/geri alma, eşitleme: mevcut kod aynen.
- Temizlik nerede koşar: worker rolünde, 10 dakikada bir, **oyun döngüsünü beklemeyen** ayrı bir
  zamanlayıcı (çalışırken ikinci tur başlamaz, hata yalnız log'a yazılır). Polar ve admin koduna
  dokunulmaz; "başka yoldan alındı" durumu temizlik turunda yakalanır.
- `routes/shopier.ts`: `POST /api/skins/shopier-code` → `POST /api/skins/shopier-checkout`
  (aynı kimlik doğrulama ve dakikada 20 istek limiti).

## Web değişiklikleri

- `ShopierCheckout.tsx`: kod paneli, kopyala düğmesi ve "nota yapıştır" adımları kalkar. Basış →
  "Hazırlanıyor…" → tek büyük "Shopier'de öde ↗" bağlantısı + "Ödeme gelince görünüm hesabına
  kendiliğinden eklenir" satırı. İki adım bilerek: istek sonrası `window.open` telefon
  tarayıcılarında engelleniyor, gerçek dokunuşla açılan bağlantı engellenmiyor.
- Görünüm hesaba gelince mevcut "sahipsin" durumu kendiliğinden görünür (yenileme zaten var).
- `AdminShopierQueue.tsx`: "kod" sütunu yerine kayıt/komutan; nedenler aynı.
- 6 dilde metin: kod anahtarları kalkar, yenileri eklenir (`docs/ux-writing.md`).
- Görsel kontrol: 350 px ve 1280 px, TR ve EN; `tools/shopier-store-visual.mjs` güncellenir.

## Görseller

Shopier yalnız jpg/png/bmp kabul ediyor, efekt görsellerimiz WebP. `tools/shopier-images.mjs`
(sharp) her satılık kozmetik için png üretir → `apps/web/public/assets/images/shopier/<id>.png`.
Gezegen pngleri zaten var. Ürün açılırken Shopier görseli `SHOPIER_IMAGE_BASE_URL/<id>.png`'den çeker.

## Kenar durumlar → testler (her satır bir test, kod öncesi yazılır)

Başlatma: bayrak kapalı 503 · kimliksiz 401 · ücretsiz/bilinmeyen ürün · fiyatı olmayan ürün ·
zaten sahip 409 · paketin bir parçası sahipli 409 · aynı basış aynı bağlantı + süre uzar · eşzamanlı
iki basış tek Shopier ürünü · paket basışı açık tekli ürünleri iptal eder (ve tersi) · Shopier hata
→ `FAILED` + hata, sonraki basış yeni dener · takılı `PENDING` 60 sn sonra yenilenir · 6. basış en eski
açık kaydı iptal eder · hesap silinmiş.

Sipariş: doğru ürün → hak + `PAID` + tek kapatma isteği · süresi dolmuş/iptal kayda ödeme → yine
teslim · bilinmeyen ürün → kuyruk · adet > 1 / çok satır → kuyruk · TRY dışı / yanlış tutar →
kuyruk · zaten sahip (çift ödeme) → kuyruk, hak yok · hesabı silinmiş kayıt → kuyruk · aynı sipariş
iki kez → tek hak · okunamayan gövde → `UNREADABLE` kuyruk · kapatma hatası webhook'u bozmaz,
eşitleme tekrar dener · iade siparişten önce gelir → sonraki sipariş hak vermez.

İade: tam iade hakkı alır ve giyili görünümü düşürür · kısmi/başarısız iade bir şey yapmaz ·
tekrar zararsız · POLAR/MANUAL hakları etkilenmez.

Temizlik: süresi geçen `OPEN` → `EXPIRED` + silme · başka yoldan sahiplenilen veya fiyatı değişen → `CANCELLED` + silme
· silme 404 = başarılı · silme hatası → `removed_at` boş, sonraki tur dener · tur başına 20 sınırı ·
aynı anda iki tur çalışmaz · temizlik hatası oyun döngüsünü durdurmaz.

Web: basış → hazırlanıyor → bağlantı · hata mesajı + Polar yerinde · Türkiye dışında Shopier yok ·
sahip olunca düğme kalkar · admin kuyruğu yeni sütunlar · 6 dil anahtar eşitliği.

## Dokunulan yerler ve kırılma riski

- Yeni/değişen: `services/shopier.ts`, `services/shopierSales.ts`, `routes/shopier.ts`, `env.ts`,
  `db/schema.ts` (yalnız Shopier tabloları), migration, `test/helpers.ts` truncate listesi,
  `index.ts` (temizlik zamanlayıcısı), `.env.example` + `.env.production.example`,
  `ShopierCheckout.tsx`, `AdminShopierQueue.tsx`, `SkinsScreen.tsx` (yalnız Shopier bağlantısı),
  `api/queries.ts`, 6 dil dosyası, testler, görsel aracı.
- Dokunulmaz: Polar, Paddle, kozmetik sahiplik ve takma kodu, Türkiye dışı akış.
- Risk: canlı `.env`'de eski `SHOPIER_PRODUCTS` kalırsa env şeması onu yok saymalı (test edilir).
- Risk: `db/schema.ts` ve migration journal'ında başka oturumların commit edilmemiş değişiklikleri
  var (0210) — yalnız kendi parçalarımız commit edilir, numara commit anında yeniden kontrol edilir.
- Risk: temizlik HTTP çağrıları oyun döngüsünü geciktirmemeli → ayrı zamanlayıcı, beklenmez.

## Yayın sırası (her canlı adım sahibin o turdaki onayıyla)

1. ~~Aşama 0 canlı deneme~~ — yapıldı, sonuçlar yukarıda.
2. TDD ile uygulama → dokunulan testler → tip/lint → görsel kontrol → teslimde tam test takımı.
3. Görsellerin web sürümüyle yayına girmesi (ürün açılmadan önce adresleri çalışmalı).
4. Sunucu + web yayını; `order.created` ve `refund.updated` abonelikleri canlı adrese açılır;
   `.env`: `SHOPIER_PRICES`, `SHOPIER_IMAGE_BASE_URL`, `SHOPIER_WEBHOOK_TOKENS`.
5. Shopier: dükkân sepeti kapalı (`cart: false`); eski 6 ürün silinir veya gizlenir (sahip kararı).
6. Bayrak açılır; sahip ₺49'luk bir görünüm ve ₺279'luk paketi alıp tam iade eder: teslim,
   kapanış, iade geri alımı ve temizlik doğrulanır.

## Sahip kararları (29 Ekim, Aşama 0 sonrası)

- KDV: boş (sahip henüz vergi mükellefi değil; panelde alan yok). Mükellef olunca `vatPercent` eklenir.
- Ürün başlığı: "Astera Online · <tür> görünümü" (ör. "Astera Online · Gezegen halkası görünümü").
  Görünümün kendi adı yalnız web çevirilerinde olduğu için sunucu türü yazar; ürün görseli görünümün
  kendisini gösterir. Görünüm adını başlığa koymak istenirse sunucuya Türkçe ad tablosu eklenir.
- **Görünümler yalnız oyun içinden alınır.** Dükkândaki 9 görünüm ürünü silinir (gizlenmez: gizli
  ürün eski linkle hâlâ satılır ve kimseye bağlanamaz). Silme yayın günü, sahibin o turdaki onayıyla:
  51278662 Lav · 51278677 Buz · 51278683 Zehir · 51278652 Çöl · 51278730 Türkiye · 51278695 Fransa ·
  51278771 Almanya · 51278822 İspanya · 51278911 4'lü paket.
- 4 destek kartı kalır (51278327 ₺49 · 51278343 ₺99 · 51278354 ₺199 · 51278360 ₺499). Satılırsa
  `UNKNOWN_PRODUCT` ile kuyruğa düşer; sahip "Kapat" der (ödemenin hesaba geçmesi için de gerekli).

## Uygulama durumu (29 Ekim)

Kod master'da, commit edilmedi, yayınlanmadı. Sunucu: `startShopierCheckout`, `match` (ürün no),
`sweepShopierCheckouts` (worker'da 10 dk), migration 0211 (`shopier_checkouts`; boş
`shopier_purchase_codes` silinir — yayından önce canlıda boş olduğu doğrulanır). Web: tek bağlantılı
"Sana özel ödeme sayfası" paneli, 6 dil. Görseller: web dev sunucusu açıkken `node tools/shopier-images.mjs` → oyunun kendi 3D önizlemesinden
(yapılı gezegen, halka, gemi) eski Shopier ürün görselinin gece/yıldız/yörünge stilinde 1200 × 1200 jpg,
`apps/web/public/assets/images/shopier/` (42 dosya, 2,9 MB). Görsel kontrol:
`node tools/visual.mjs out/shopier-store --shopier-store`.
