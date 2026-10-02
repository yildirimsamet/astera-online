# Gezegen skinleri: ilk satış ve manuel teslim

Mağaza iki sekmeli: **Element Gezegenleri** (lav, buz, zehir, çöl) ve **Ülke Gezegenleri** (Türkiye, Almanya, Fransa, İspanya, Japonya). Dokuz skin tekil satılır; yalnızca dört element skini için paket vardır. Polar üzerinden Türkiye'de elementler ve Türkiye skini ₺99, paket ₺279; diğer ülke skinleri €2,99 tutar. Türkiye dışında tekil fiyat €2,99, paket €8,49'dur. Polar ödeme ve otomatik teslim yalnızca checkout, ürün kimlikleri ve webhook yapılandırması hazırken açılır. Oyunda Shopier bağlantısı yalnızca element skinleri, Türkiye skini ve element paketinde gösterilir; doğrulanmış Shopier siparişleri aşağıdaki manuel hak akışıyla teslim edilir.

## Operatör akışı

1. Ödemeyi seçilen dış sağlayıcının panelinde doğrula. Siparişte alıcının **Astera kullanıcı adını** ve her skin kalemi için benzersiz bir referans al (çok ürünlü siparişte `sipariş-no:kalem-no` gibi).
2. `ADMIN_USERNAMES` ayarında yetkili hesapla oturum açıp erişim belirteci edin.
3. Yetkili oturumla bir kez hak tanımla:

```http
POST /api/admin/skins/grant
Authorization: Bearer <operator-access-token>
Content-Type: application/json

{
  "username": "buyer_username",
  "skinId": "planet-lava",
  "orderRef": "verified-order-reference"
}
```

4. Başarılı yanıt `accountId`, `skinId`, `grantedAt` içerir. Oyuncu skin sayfasında hakkını görür ve kendi gezegenlerine uygular. Aynı sipariş tekrar gönderilirse aynı hak döner; aynı skin farklı siparişle veya aynı sipariş başka hesaba verilmez.

Desteklenen kimlikler: `planet-lava`, `planet-ice`, `planet-toxic`, `planet-desert`, `planet-turkey`, `planet-germany`, `planet-france`, `planet-spain`, `planet-japan`. Yetkisiz istek 403, bulunmayan kullanıcı 404, sipariş/hak çakışması 409 döner. Hak sezonlar arasında kalır; hesap silinse de sipariş kaydı `cosmetic_entitlements` tablosunda anonim olarak durur; gezegen seçimi sezonluk kayıttır. Kontrol değişiminde seçim temizlenir. Satın alma için oyun kaynağı, üretim veya savaş gücü verilmez. Ülke gezegenleri toparlanma kalkanı sırasında ülke kaplamasını korur ve yüzeyde yanık çatlak görünümü alır.

## Görsel varlıkları yenileme

Kaynak ülke GLB'leri `assets/source/models/planets/country/` altındadır. Bir model değişirse `node tools/models.mjs --only=planets/country/planet_<ülke>.glb` çalıştır; tam ve düşük detaylı sürümler üretilir. Seçim kartlarını yenilemek için Vite geliştirme sunucusu 5199 portunda çalışırken `node tools/skin-cards.mjs` çalıştır. Ön yüzün doğru görünmesi için başlangıç açıları `apps/web/src/screens/SkinPreview.tsx` içindedir. Her iki araç da `planet-assets.json` içindeki içerik karmalarını yeniler; `/assets/` bir yıl değişmez önbelleğe alındığından bu adım zorunludur.

## Japonya ödeme ürünü

Polar Japonya ürünü €2,99 tek seferlik ve vergi dahil olarak açıldı: test `0ec62d42-711e-4f7b-90ed-ef92d07a8bdb`, canlı `82b25098-29bb-4b98-a8f4-11cb78ee2e7b`. `POLAR_PRODUCT_JAPAN` doğru ortamın kimliğini taşımalıdır; diğer ürünlerle aynı webhook doğrulaması, teslim ve iade akışını kullanır. Japonya ve diğer EUR fiyatlı ülke skinleri için oyunda Shopier satın alma seçeneği gösterilmez. Paddle'da Japonya ürünü tanımlı değildir.
