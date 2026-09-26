# Gezegen skinleri: ilk satış ve manuel teslim

Mağaza iki sekmeli: **Element Gezegenleri** (lav, buz, zehir, çöl) ve **Ülke Gezegenleri** (Türkiye, Almanya, Fransa, İspanya). Sekiz skinin tekil fiyatı ₺99 / $2,99. Yalnızca ilk dört skin için ₺279 / $8,49 dörtlü paket vardır; ülke skinleri sadece tekil satılır (sahip kararı, 2026-09-26). Fiyatlar gösterilir, ancak `apps/web/src/lib/skinStore.ts` içindeki HTTPS ödeme bağlantıları boş olduğu sürece satın alma düğmeleri devre dışıdır. Otomatik ödeme/teslim henüz kurulmadı; doğrulanmış siparişler aşağıdaki kalıcı hak kaydına manuel dönüştürülür.

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

Desteklenen kimlikler: `planet-lava`, `planet-ice`, `planet-toxic`, `planet-desert`, `planet-turkey`, `planet-germany`, `planet-france`, `planet-spain`. Yetkisiz istek 403, bulunmayan kullanıcı 404, sipariş/hak çakışması 409 döner. Hak sezonlar arasında kalır; hesap silinse de sipariş kaydı `cosmetic_entitlements` tablosunda anonim olarak durur; gezegen seçimi sezonluk kayıttır. Kontrol değişiminde seçim temizlenir. Satın alma için oyun kaynağı, üretim veya savaş gücü verilmez. Ülke gezegenleri toparlanma kalkanı sırasında ülke kaplamasını korur ve yüzeyde yanık çatlak görünümü alır.

## Görsel varlıkları yenileme

Kaynak ülke GLB'leri `assets/source/models/planets/country/` altındadır. Bir model değişirse `node tools/models.mjs --only=planets/country/planet_<ülke>.glb` çalıştır; tam ve düşük detaylı sürümler üretilir. Seçim kartlarını yenilemek için Vite geliştirme sunucusu 5199 portunda çalışırken `node tools/skin-cards.mjs` çalıştır. Her iki araç da `planet-assets.json` içindeki içerik karmalarını yeniler; `/assets/` bir yıl değişmez önbelleğe alındığından bu adım zorunludur.

## Gelecek ödeme entegrasyonu

Shopier veya başka bir yöntem seçildiğinde ödeme bildirimi önce sipariş doğrulamasından ve hesap eşleştirmesinden geçmeli, ardından aynı hak servisinde idempotent olarak işlenmelidir. Dijital dosya teslimi tek başına oyun hesabına hak vermez. İade/iptal, otomatik mutabakat, ayrı satılan gezegen ekleri ve bunların hangi temel skinlerle uyumlu olduğu, ödeme yöntemi kesinleşirken tasarlanacaktır.
