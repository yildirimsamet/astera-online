# Gezegen skinleri: ilk satış ve manuel teslim

Skin sayfasında fiyat ve ödeme ifadesi **gösterilmez**; sahip olunmayan skinler oyuncuya "Yakında" olarak sunulur (sahip kararı, 2026-09-18). Ödeme bağlantısı ve satın alma düğmesi yoktur. Ödeme sağlayıcısı kararlaştırılınca doğrulanmış sipariş, aşağıdaki kalıcı hesaba bağlı hak kaydına dönüştürülebilir; otomatik ödeme/teslim henüz kurulmadı.

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

Desteklenen ilk kimlikler: `planet-lava`, `planet-ice`, `planet-toxic`, `planet-desert`. Yetkisiz istek 403, bulunmayan kullanıcı 404, sipariş/hak çakışması 409 döner. Hak sezonlar arasında kalır; hesap silinse de sipariş kaydı `cosmetic_entitlements` tablosunda anonim olarak durur; gezegen seçimi sezonluk kayıttır. Kontrol değişiminde seçim temizlenir. Satın alma için oyun kaynağı, üretim veya savaş gücü verilmez.

## Gelecek ödeme entegrasyonu

Shopier veya başka bir yöntem seçildiğinde ödeme bildirimi önce sipariş doğrulamasından ve hesap eşleştirmesinden geçmeli, ardından aynı hak servisinde idempotent olarak işlenmelidir. Dijital dosya teslimi tek başına oyun hesabına hak vermez. İade/iptal, otomatik mutabakat, ayrı satılan gezegen ekleri ve bunların hangi temel skinlerle uyumlu olduğu, ödeme yöntemi kesinleşirken tasarlanacaktır.
