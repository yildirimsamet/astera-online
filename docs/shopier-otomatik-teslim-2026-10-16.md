# Shopier otomatik teslim — gereksinim, kenar durumlar, etki (16 Ekim 2026)

İstek: Polar'ın sabit işlem ücreti (5% + 50¢ + yurt dışı kart 1,5%) ₺49–99'luk TL satışların
yarısına yakınını alıyor. Türkiye'deki TL ödemeleri Shopier üzerinden **otomatik teslimle**
alınacak; Türkiye dışı satışlar Polar'da değişmeden kalacak. Bugünkü elle teslim (sipariş
notunda komutan adı → admin formu) yedek yol olarak çalışmaya devam edecek.

## Doğrulanmış Shopier gerçekleri (resmî belge + canlı hesap, 16 Ekim)

- REST API'de ödeme oturumu / sipariş oluşturan uç nokta yok. Siparişte harici kimlik veya
  metadata alanı yok; hesap eşleştirmesi için tek alan alıcının `note` alanı.
- Ürün `customNote`, sipariş notu kutusunun yer tutucusunu değiştirir; zorunlu yapma yok.
- `customListing: true` ile API'den oluşturulan ürün dükkân sayfasında görünmüyor, yalnız
  doğrudan linkle açılıyor (canlı test ürünü 51899218 ile denendi, ardından silindi).
- PAT ile `GET /orders`, `GET /refunds`, `GET /webhooks`, `GET /shop/settings` 200;
  `POST/DELETE /products` 200; `GET /products` ise 403 (yetki kapsamı olmasına rağmen).
- Webhook olayları: `order.created` (yalnız ödenmiş sipariş), `order.fulfilled`,
  `refund.requested`, `refund.updated` (succeeded/failed). Ters ibraz için olay yok.
- İmza: `Shopier-Signature`, HS256 (HMAC-SHA256), anahtar = abonelik oluşturulurken bir kez
  dönen webhook token. İmzalanan baytlar ve kodlama (hex/base64) belgede yazmıyor; ilk gerçek
  webhook ile doğrulanacak. `Shopier-Webhook-Id` yeniden denemelerde aynı kalır.
- 5 sn içinde 200 dönmezse 72 saate kadar 9 yeniden deneme.
- Ödeme hesaba ancak sipariş kapatılınca geçer: `PUT /orders/{id}` ile
  `fulfillments.productType = digital` ve teslim notu.
- Sipariş kimliği sayısal metin (`"329289660"`), tutarlar metin (`"99.00"`), para birimi
  `TRY|USD|EUR`. Mevcut 6 ürün `physical` tipte; dükkânda sepet açık (`cart: true`).

## Akış

1. Oyuncu "Shopier ile öde" der. Sunucu hesap + ürüne bağlı tek kullanımlık bir kod verir
   (`AST-` + 6 karakter, karışan karakterler yok). Aynı hesap + ürün için açık kod varsa aynısı
   döner. Kod süresiz; kullanılınca kapanır.
2. Arayüz kodu kopyalatır, gizli Shopier ürün sayfasını yeni sekmede açar.
3. `order.created` webhook'u gelir → imza → olay tekrarı engeli → sipariş tekrarı engeli →
   tek satır, adet 1, bilinen ürün, TRY ve beklenen tutar → nottaki açık kod aynı ürüne ait →
   haklar `source='SHOPIER'`, `orderRef='<sipariş>:<kozmetik>'` ile verilir, kod kapanır,
   sipariş Shopier'de dijital teslim olarak kapatılır.
4. Uymayan her durum hak vermez; sipariş admin kuyruğuna nedeniyle düşer. Admin doğru
   komutana verir, kapatır (bağış vb.) veya verilen hakkı geri alır (ters ibraz).
5. `refund.updated` + `succeeded` + `full` → bu siparişten gelen SHOPIER hakları geri alınır,
   giyili gezegen görünümü düşer. Kısmi iade hak almaz (admin karar verir).
6. Admin "eşitle" düğmesi Shopier'deki kapanmamış son siparişleri çeker ve aynı işleyiciden
   geçirir (kaybolan webhook, kapanamamış sipariş). Elle kapatılmış eski siparişler alınmaz.

## Mutlu yol ve kenar durumlar (her biri bir test)

Kod: hazır değilken 503 · bilinmeyen/ücretsiz ürün · Shopier karşılığı olmayan ürün · ürün
veya paketin bir parçası zaten sahipli 409 · aynı istek aynı kodu döner · eşzamanlı iki istek
tek açık kod · paket ve tekli için ayrı kodlar · kimliksiz istek 401.

Webhook: token yok 503 · imza eksik/yanlış 401 · hex ve base64 imza kabul · aynı webhook id
ikinci kez işlenmez · aynı sipariş farklı webhook id ile ikinci kez işlenmez · bozuk gövde hak
vermez · bilinmeyen olay yok sayılır.

Eşleşme: kod yok · kod yanlış/var olmayan · kod kullanılmış · kod başka ürüne ait · küçük harf,
boşluk, tire varyasyonları · notta birden fazla kod · birden fazla satır veya adet > 1 ·
bilinmeyen ürün (bağış) · TRY dışı para birimi · indirimli/eksik tutar · ödenmemiş · hesabı
silinmiş kod · ürün zaten sahipli (başka yoldan alınmış) → kuyruk, hak verilmez · paket kısmen
sahipli → eksikler verilir · iade siparişten önce gelir → sonra gelen sipariş hak vermez.

İade: tam iade hakları alır ve gezegen seçimini temizler · kısmi iade hiçbir şey yapmaz ·
başarısız iade hiçbir şey yapmaz · iade tekrarı zararsız · MANUAL ve POLAR hakları etkilenmez.

Kapatma: başarılı eşleşme Shopier'e tek PUT gönderir · PUT hatası webhook'u bozmaz, sipariş
kapanmamış kalır ve eşitle tekrar dener.

Admin: yetkisiz 403 · kuyruk listesi sınırlı · verme yalnız eşleşmemiş ve ürünü bilinen
siparişte · bilinmeyen komutan 404 · zaten sahipli 409 · kapatma · geri alma yalnız verilmiş
siparişte · eşitle kapalı siparişleri almaz, tekrar çalıştırmak zararsız.

## Dokunulan yerler ve kırılma riski

- Yeni: `services/shopier.ts`, `services/shopierSales.ts`, `routes/shopier.ts`, migration,
  `test/shopier-*.test.ts`. Polar ve Paddle dosyalarına dokunulmaz.
- `db/schema.ts`: üç yeni tablo (başka oturumların bekleyen değişiklikleri korunur).
- `env.ts`: `SHOPIER_*` değişkenleri; `shopier_prod_access_token` adı da kabul edilir.
- `app.ts`: route kaydı. `test/helpers.ts`: truncate listesine yeni tablolar.
- `cosmetic_entitlements` şeması değişmez; yalnız yeni `source` değeri. Sahiplik ve takma
  kontrolleri tüm aktif hakları zaten okuduğu için Polar/MANUAL davranışı değişmez.
- Web: mağaza Shopier bölümü statik linkten sunucu yapılandırmasına geçer; admin Skin
  sekmesine kuyruk eklenir; 6 dilde metin. Türkiye dışı akış değişmez.
- Dağıtım: prod release dalından yapılıyor; migration `when` sırası dağıtım anında kontrol
  edilecek.

## Kod incelemesi (16 Ekim) — bulunan ve düzeltilenler

Önce kırmızı test, sonra düzeltme:

- **İmzalı ama okunamayan sipariş kayboluyordu.** Şemaya uymayan `order.created` olayı "görüldü"
  sayılıp düşüyordu; eşitleme de aynı şemayla atlıyordu. Artık kimliği okunabilen her sipariş
  `UNREADABLE` nedeniyle kuyruğa düşer (webhook ve eşitleme).
- **Halka/gemi/bayrak iadesinde galaksi yenilenmiyordu.** Polar gibi, hakkı alınan komutanın
  bulunduğu her sezona `world` bildirimi gider.
- **Kuyruk son 100 kaydı gösteriyordu.** Bekleyen siparişlerin tümü (en çok 200) ve son 50 karar
  ayrı sorgulanır; yoğun bir gün bekleyen alıcıyı gizlemez.
- **Görünmez karakterler kodu bozuyordu** (sıfır genişlikli boşluk vb.). Eşleştirmeden önce silinir.
- **Notta birden fazla kod varsa** admin, ödenen ürüne ait kodu görür.
- İmza reddi değer içermeyen bir uyarı kaydı bırakır (biçim değişikliğini sahtecilikten ayırmak için).
- Resmî PHP ve Python webhook tarifleri imzayı ham gövdenin HMAC-SHA256 **hex** özeti olarak
  doğruluyor; sunucu bunu (ve aynı HMAC'in base64 yazımını) kabul eder.

## Bilinen sınırlar (bilerek bırakıldı)

- Kısmi iade hak almaz; gerekiyorsa admin "Geri al" kullanır. Ters ibraz için Shopier olayı yok.
- Eşitleme son 50 siparişe bakar; Shopier zaten 72 saat yeniden dener.
- Konum fiyatı alınamazsa (ülke sorgusu hatası) Türkiye'de de Shopier görünmez; Polar'la aynı davranış.
- Açık bir Polar checkout'u olan oyuncu aynı ürünü Shopier'den de öderse Polar ikinci ödemeyi sessizce
  tamamlar (hak zaten var). Polar koduna dokunulmadı; olasılık düşük, Polar panelinden iade edilir.
- Webhook yanıtı sipariş kapatmayı bekler (en çok 3 sn). Shopier'in 5 sn sınırı aşılırsa olay
  tekrarlanır ve tekrar zararsızdır; kapanmayan sipariş eşitlemede yeniden kapatılır.

## Yayın kontrol listesi

1. Sunucu + web birlikte; migration 0175'in `when` değeri canlıdaki son migration'dan sonra olmalı.
2. `POST /webhooks` ile `order.created` ve `refund.updated` aboneliği; dönen token `.env`'e.
3. 36 yeni ürün: `type: digital`, `customListing: true`, `customNote` kod yer tutucusu, **yüksek
   `stockQuantity`** (stok biterse ürün satın alınamaz), png/jpg görsel URL'si.
4. Mevcut 6 ürünü dijital + gizli + kod notuna çevir (`PUT /products/{id}` reddedilirse panelden).
5. Dükkân sepetini kapat (`cart: false`); sepetli sipariş koda bağlanamaz.
6. Bayrağı aç; ₺49 tekli ve ₺279 paket gerçek alım + tam iade; ilk webhook'un imzası, siparişin
   kapanması ve hakkın geri alınması doğrulanır.
