# Polar entegrasyonu — iş bölümü ve adımlar

## Hedef

Astera Online'daki on sabit fiyatlı görünüm teklifini Polar üzerinden otomatik
teslim etmek. Polar, Paddle'ın yeni otomatik ödemeler için yerini alacak. Shopier'in
mevcut manuel satış ve hak verme yolu korunacak. Mevcut Paddle siparişleri ve
kozmetik hak kayıtları silinmeyecek.

| Ürün | Türkiye | Türkiye dışı |
| --- | ---: | ---: |
| Lava, Ice, Toxic, Desert, Turkey | ₺99 | €2,99 |
| Germany, France, Spain, Japan | €2,99 | €2,99 |
| Dörtlü element paketi | ₺279 | €8,49 |

## Senin yapacakların

1. **Polar hesabı:** [sandbox.polar.sh](https://sandbox.polar.sh) üzerinde canlıdan ayrı
   kullanıcı ve organizasyon oluştur; canlı organizasyon [polar.sh](https://polar.sh)
   üzerinde kalır. Canlı panelde organizasyon seçicisindeki **Go to sandbox** da
   kullanılabilir. İşletme
   ve ürün bilgilerini gerçek durumlarına göre doldur. Polar'ın küçüklerin kullandığı
   hizmetlerle ilgili kuralı için oyuncu kitlesini doğru tarif et; hesap uygunluğunu
   varsayma.
2. **Erişim:** MCP Polar panelinde açılan bir özellik değil; Codex'e eklenen uzaktan
   bağlantı. `polar-sandbox` ve `polar-live` MCP sunucuları bu makinedeki Codex'e
   eklendi. Hesaplar açılınca terminalde aşağıdaki iki komutu çalıştır ve açılan
   tarayıcıda ilgili organizasyona OAuth izni ver:

   ```bash
   codex mcp login polar-sandbox
   codex mcp login polar-live
   ```

   Giriş komutu tarayıcıdan dönen `127.0.0.1` callback'ini bekler; tarayıcıda
   izin verene kadar terminali kapatma. Bağlantı durumunu `codex mcp list` ile
   kontrol et.
   MCP erişimi bu oturumda görünmezse Codex'i yeniden başlatmak gerekebilir.
   Alternatif olarak sandbox ve canlı
   organizasyon erişim anahtarlarını ilgili sunucu `.env` dosyalarına koy. Anahtarları
   sohbete, kaynak koda veya bu dosyaya yazma. MCP yoksa dokuz Polar ürününün
   kimliklerini ve webhook imza anahtarını `.env` üzerinden sağlayabiliriz.
3. **Fiyat ayarı:** Polar organizasyonunun varsayılan ödeme para birimini **EUR**
   seç. On ürünün her birini tek seferlik sabit fiyatlı oluştur. Lava, Ice,
   Toxic, Desert, Turkey ve pakete ayrıca TRY fiyatı ekle; Germany, France, Spain
   ve Japan yalnız EUR kalsın. Çoklu para birimi fiyatları ürünün **Pricing** bölümündedir;
   ayrı bir “regional pricing” menüsü aranmaz. Dokuz ürünün fiyatları artık ürün
   düzeyinde **inclusive** ayarlı; genel vergi ayarını değiştirmek gerekmiyor.
   Gerçek checkout toplamını sandbox'ta doğrulayacağız.
4. **Hesap incelemesi:** Çalışan entegrasyon, fiyat ve politika sayfaları hazır olunca
   Polar panelindeki **Finance → Account** bölümünden işletme başvurusu, kimlik
   doğrulaması ve Stripe Connect Express ödeme hesabı bağlantısını tamamla.
5. **Canlı satış kararı:** Sandbox testleri, canlı webhook ve hesap incelemesi
   sonuçlarını gördükten sonra Polar ödeme düğmesini müşterilere açma kararını ver.

## Benim yapacaklarım

1. **Mevcut akışı koruyarak ayır:** Paddle checkout, sipariş ve webhook kodunu;
   Shopier bağlantılarını; kozmetik haklarını ve güncel çalışma ağacını denetle.
2. **Polar katalog ve ortamı:** On ürünü sandbox ve canlıda karşılaştırıp eksikleri
   oluştur; EUR varsayılan, uygun ürünlerde TRY fiyatı ve vergi dahil tutarı doğrula.
   Polar kimliklerini ve ayrı sandbox/canlı sırlarını ortam değişkenlerine bağla.
3. **Sunucu:** Kimliği doğrulanmış oyuncu için Polar checkout oturumu oluştur;
   `external_customer_id` ve yerel sipariş kimliğiyle hesabı bağla. İmzalı
   `order.paid` olayında skini bir kez ver; tam iade halinde yalnız ilgili hakkı
   kaldır. Tekrar gelen veya sırası değişen webhook'ları, başarısız/süresi dolan
   checkout'ları ve paket çakışmalarını ele al.
4. **Arayüz ve fiyatlar:** Paddle ödeme düğmesini Polar ödeme URL'sine taşı.
   Ülkeye göre fiyat gösterimiyle Polar checkout tutarını eşleştir. Shopier'in TL
   bağlantılarının Türkiye dışındaki EUR gösterimiyle çelişmesini gider.
5. **Herkese açık sayfalar:** Türkçe/İngilizce fiyat, şartlar, gizlilik ve iade
   sayfalarındaki Paddle'a özgü ödeme anlatımını Polar'a göre güncelle.
6. **Doğrulama:** Önce ilgili testleri yazıp başarısız olduklarını gör; uygulamadan
   sonra ilgili testleri ve `pnpm verify --exclude-sims` komutunu çalıştır. Polar sandbox'ta on
   ürün, iki bölge, webhook tekrarı, paket, iade ve gerçek kullanıcı akışını test
   et. Üretim dağıtımını `docs/deployment.md` kurallarına göre hazırla.

## Sıra ve kapılar

1. [x] Kod/hesap envanteri ve Polar ürün eşlemesi.
2. [x] Sandbox ve canlı on ürünlük katalog tamam; API erişimi doğrulandı.
3. [x] Testlerle sunucu entegrasyonu ve ayrı Polar sipariş kayıtları.
4. [x] Mağaza, fiyat sayfaları ve politikalar yerel kodda Polar'a bağlandı.
5. [ ] Tam sandbox satın alma/iade matrisi (tekli TRY, paket ve Japan dahil).
6. [x] Proje doğrulaması, canlı katalog/sır kontrolü ve satış kapalı production dağıtımı.
   Canlı sağlayıcıdan gelen imzalı başarılı ödeme/iade teslimi ayrıca doğrulanacak.
7. [x] Polar hesap incelemesi ve ödeme hesabı.
8. [ ] Onay ve son kontrollerden sonra canlı satışın açılması.

## İlerleme (27 Eylül 2026)

- Codex'e `polar-sandbox` ve `polar-live` sunucuları eklendi; OAuth bağlantıları
  çalışıyor. İlk okumada iki katalog ve iki webhook listesi de boştu.
- Sandbox ve canlı organizasyonların her birine dokuz adet tek seferlik, halka açık
  ürün eklendi. EUR taban fiyatı tekli €2,99, paket €8,49; Lava, Ice, Toxic,
  Desert, Turkey için TRY ₺99, paket için ₺279. Germany, France, Spain yalnız EUR.
  Tüm ürün fiyatları vergi dahil. İki katalog tekrar okunarak sayı ve tutarlar
  doğrulandı.
- Polar ortam değişkenleri, dokuz ürün eşlemesi, üretim Compose aktarımı ve
  satışın varsayılan olarak kapalı kalmasını doğrulayan testler eklendi.
- Polar hesap incelemesi 27 Eylül'de onaylandı. Canlı organizasyon API'sinde
  `status=active` ve `checkout_payments`, `payouts`, `refunds`, `api_access`
  yetkileri `true` olarak doğrulandı. Bu onay entegrasyonun test ve dağıtım
  kapılarını kaldırmaz; satış bayrağı kapalı kalır.
- Yeni sandbox organizasyon erişim anahtarı yerel, git dışı `.env` dosyasında.
  Node istemcisiyle açılan iki gerçek sandbox checkout oturumunda Lava için
  `TRY 9900`, Germany için `EUR 299` doğrulandı; ödeme yapılmadı.
- Sunucuda ayrı Polar sipariş, webhook olay ve iade kayıtları ile imza doğrulaması
  hazır. Oyun içi mağaza Polar ödeme adresini açıyor; fiyat ve politika sayfaları
  Polar'ı anlatıyor. Satış bayrağı kapalı.
- Canlı bildirim hedefi `cc718269-583c-4c47-bfc1-1d6f0892611d` oluşturuldu:
  `https://asteraonline.space/api/polar/webhook`, `order.paid`, `order.refunded`,
  `checkout.expired`. Anahtarı yalnızca git dışındaki, izinleri `600` olan
  `.env.local` dosyasında `POLAR_LIVE_WEBHOOK_SECRET` olarak saklı. Aynı hedefi
  yeniden oluşturma veya anahtarını sıfırlama. Sunucu henüz yayımlanmadığı için
  bu URL'ye imzasız POST şu anda 404 döndürüyor; satış bayrağı kapalı.
- Canlı organizasyon erişim anahtarı kullanıcı tarafından git dışındaki
  `.env.local` dosyasına eklendi. Canlı erişim anahtarı, webhook imza anahtarı ve
  dokuz ürün kimliği VPS'deki izinleri `600` olan `.env` dosyasına aktarıldı;
  aktarım öncesi yedek alındı. `POLAR_ENV=production`, ancak
  `POLAR_CHECKOUT_ENABLED=false`. VPS'deki eski kod bu değişkenleri henüz
  kullanmıyor; kod dağıtımı ve gerçek webhook erişimi bekliyor. Anahtarın
  `checkouts:write` erişimi canlı API'de yalnız okuma yapan liste çağrısıyla
  HTTP 200 dönerek doğrulandı; canlı checkout veya ödeme oluşturulmadı.
- Sandbox testinde geçici HTTPS tüneliyle `bed71857-5345-4692-a581-fa959324756c`
  hedefi oluşturuldu; imza anahtarı git dışındaki `.env.local` dosyasında.
  Yerel sunucuda yeni bir test hesabı açıldı. Lava €2,99 checkout'u Polar'ın
  sandbox test kartıyla `succeeded` oldu; imzalı `order.paid` olayı skin hakkını
  verdi. Aynı siparişin tam iadesi €2,51 + €0,48 vergi olarak işlendi; imzalı
  `order.refunded` olayı skin hakkını kaldırdı. Testten sonra geçici hedef
  **devre dışı bırakıldı** ve tünel kapatıldı; canlı hedef etkilenmedi.
- Gerçek sandbox iadesi `refunded_amount` alanının vergisiz, `refunded_tax_amount`
  alanının ayrı olduğunu gösterdi. İade işleyicisi bu yüzden tam iadeyi
  tutarları yanlış karşılaştırarak değil, Polar'ın `status=refunded` alanıyla
  tanıyor. Süresi dolan checkout'un takılı kalmaması da testle düzeltildi.
- Proje doğrulamasının tümü, alıcı kodunun dağıtımı ve canlı webhook erişimi
  ayrıca tamamlanacak. Satış bayrağı kapalı.

| Ürün | Sandbox ürün ID | Canlı ürün ID |
| --- | --- | --- |
| Lava | `f372f658-e927-4051-b758-e5fa10d09f5f` | `66986348-3d99-491a-812a-c811859d1a70` |
| Ice | `fc685168-53ef-4309-bff8-1dc87c6eeb5a` | `9ff2c27e-e9e1-4e7c-8382-7950c9ba834c` |
| Toxic | `96a964b1-105f-4592-a236-4b118b512359` | `45eb7762-3d38-468f-9a8d-7364ac549ce5` |
| Desert | `519098ee-2d23-4494-b07e-d11eda7a4b8b` | `e4dcc308-8977-4e3a-a5b8-11219448321c` |
| Turkey | `375d09b0-3c33-4800-ba8b-8582eefa5d1f` | `fdce9f79-5287-4a6a-936a-10a21ff72569` |
| Germany | `f557093b-eba9-499c-9788-a41c35eb3ad9` | `648b85c1-b04b-47bc-b742-b2ef73b91458` |
| France | `468d0d5e-1b7b-42cc-9a50-8951292f177e` | `63bcf9e6-d0fc-4cc2-aaa6-533ca6b51f48` |
| Spain | `2851d8bb-6017-4fc3-a3b3-3eae0ea85314` | `ab2d4302-5d25-4cb2-9007-c41ee5bdb0d9` |
| Japan | `0ec62d42-711e-4f7b-90ed-ef92d07a8bdb` | `82b25098-29bb-4b98-a8f4-11cb78ee2e7b` |
| Element paketi | `9840aaf4-7e11-4aba-8234-6ab4f9379dcb` | `34dcfb16-e875-43da-9a9d-e12ee4b5f335` |

## Production kontrolü — 4 Ekim 2026

- Entegrasyon kodu production'a dağıtıldı; üç API ve worker `POLAR_ENV=production`,
  on canlı ürün kimliği, canlı token ve webhook anahtarını alıyor.
  `POLAR_CHECKOUT_ENABLED=false`; public `/api/skins/polar-shop` da `enabled:false`.
- Canlı organizasyon MCP üzerinden yeniden okundu: `status=active`; checkout,
  payout, refund ve API erişimi yetkileri açık. İki ortamda da on aktif ürün,
  beklenen EUR/TRY tutarları ve inclusive vergi fiyatları doğrulandı.
- Mevcut canlı webhook endpoint'i açık, RAW formatında ve `order.paid`,
  `order.refunded`, `checkout.expired` olaylarına abone. Yeniden oluşturulmadı.
  İmza anahtarı ve tüm ürün eşlemeleri dört production container'ıyla eşleşiyor.
- HTTPS webhook URL'si artık 404 değil; imzasız JSON POST 401 veriyor. Gerçek
  Node runtime'ından canlı checkout API GET 200, ürün içermeyen POST 422 döndü;
  token'ın yazma yetkisi doğrulandı, canlı checkout/sipariş/ödeme oluşturulmadı.
  Host'taki Python urllib denemesi Cloudflare 1010 aldı; bu, uygulamanın Node
  erişimiyle aynı sonuç değildir. İlk Node bağlantı zaman aşımından sonraki
  kontroller yaklaşık 0,5 saniyede geçti.
- Sandbox'ta kayıtlı gerçek Lava EUR satın alımı ve tam iadesi sağlayıcıdan tekrar
  doğrulandı: toplam 299 cent, iade 251 + 48 vergi cent. Paket, TRY ve Japan için
  tamamlanmış ödeme/iade kanıtı henüz yok. Birim testlerinde imza, retry,
  idempotency, yanlış hesap/ürün, paket çakışması ve iade akışı release kontrolüne dahil.
- Canlı endpoint'in delivery listesi ve production Polar order/webhook/entitlement
  tabloları henüz boş. Erişilebilir 401 cevabı pozitif imzalı delivery kanıtı sayılmaz.

**Satış açılışında kalanlar:** temsilî sandbox TRY/paket/Japan akışları, ardından
ayrı bir kontrollü canlı satın alım/tam iade ve sağlayıcı delivery kaydıyla doğru
hesaba bir kez skin verilmesi/geri alınması. Son kabulden sonra satış bayrağı
açılıp API'lere aktarılır; frontend runtime shop durumunu okuduğu için yeni build
gerektirmez. Canlı işlem insanın kart/onay adımını gerektirir; hesap incelemesinin
yeniden beklenmesi gerekmiyor. Bu incelemede satış açılmadı.

Sağlayıcı doğrulaması ve yeniden teslim davranışı:
[webhook delivery](https://polar.sh/docs/integrate/webhooks/delivery),
[ayrı sandbox ödeme ortamı](https://polar.sh/docs/integrate/sandbox).

**Çıkış ölçütü:** Polar checkout'ta gösterilen tutar mağazayla eşleşir; ödeme
doğrulanmadan skin verilmez; başarılı ödeme skini yalnız doğru hesaba bir kez verir;
tam iade yalnız Polar'dan alınan hakkı kaldırır; Shopier ve geçmiş Paddle hakları
çalışmaya devam eder.

## Checkout başlangıcının toparlanması — 7 Ekim 2026

Yerel kodda süreç kapanmasına karşı toparlanma düzeltildi. Checkout kimliği ve
sağlayıcı son kullanma tarihi henüz yazılmamış PENDING rezervasyon, oluşturulmasından
60 saniye sonra sonraki satın alma denemesinde FAILED yapılır. Sağlayıcı tarihi
mevcut olan checkout o tarihe kadar yeniden kullanılır. Hesap kilidi altında tüm
süresi geçmiş paket/tekli çakışmaları temizlenir; aktif çakışmalar engellenir.
Eski sipariş silinmez: geç gelen ödeme ve tam iade yerel sipariş metadata'sıyla
işlenmeye devam eder. Migration veya ek servis gerekmiyor.

TDD'de önce başarısız olan regresyonlar uygulamadan sonra geçti: ilgili Polar
testlerinde 28/28 başarılı. Yeni kapsam; başlangıç süresinin sınırı, saat geri
gitmesi, eşzamanlı yeniden deneme, birden fazla çakışma, sağlayıcı hatası,
başka hesapların korunması ve geç ödeme/iade teslimidir.

Canlı organizasyon ve mevcut webhook MCP üzerinden tekrar doğrulandı: hesap
active, ödeme hesabı bağlı, ödeme/iade/payout yetkileri açık; webhook enabled ve
`order.paid`, `order.refunded`, `checkout.expired` olaylarına abone. İlk incelemede
canlı delivery listesi boştu; aşağıdaki canlı denemelerde pozitif imzalı teslimler
doğrulandı. Polar panelinde yeni bir canlı webhook/ürün kurulumu gerekmiyor.

İlk inceleme anında bu düzeltme production'a dağıtılmamıştı ve satış bayrağı
kapalıydı. Kullanıcı 7 Ekim'de eksiklerin tamamlanmasını, düzeltmenin dağıtılmasını
ve satışın açılmasını yetkilendirdi.

Manuel verilen skinler `cosmetic_entitlements` içinde `source=MANUAL` olarak
tutulur; Polar'a aktarılmaları gerekmez. Sahiplik ve checkout kontrolleri tüm
aktif hakları dikkate alır. Polar tam iadesi yalnız aynı Polar siparişinden
gelen hakkı geri alır; manuel hakları etkilemez.

## Açılış doğrulaması — 7 Ekim 2026

Ayrı `astera_polar_release_20261007_test` veritabanı ve geçici HTTPS webhook'u
üzerinden eksik gerçek sandbox senaryoları tamamlandı:

| Senaryo | Ödeme | Tam iade ve hakların geri alınması |
| --- | --- | --- |
| Lava / TRY | ₺99 | Başarılı; ₺82,50 + ₺16,50 vergi |
| Element paketi / TRY | ₺279 | Başarılı; ₺232,50 + ₺46,50 vergi |
| Element paketi / EUR, Almanya fatura ülkesi | €8,49 | Başarılı; €7,13 + €1,36 vergi |
| Japan / EUR, Japonya fatura ülkesi | €2,99 | Başarılı; vergi €0 |

Dört paid ve dört refunded olayı sağlayıcıdan gerçekten geldi ve HTTP 200 aldı.
Paketlerin dört hakkı doğru hesaba bir kez verildi. Sağlayıcı üzerinden paket
paid olayı yeniden gönderildi: yeniden teslim HTTP 200, hak ve olay sayıları
değişmedi. Aynı test hesabındaki manuel Turkey hediyesi, Polar Lava tam iadesinden
sonra aktif kaldı. Testler canlı galakside hesap veya oyuncu koltuğu oluşturmadı.

Gerçek checkout oluşturma 721–1676 ms sürdü; mevcut 8 saniyelik API sınırı içinde.
Yerel web build başarılı. Typecheck/lint temiz; ilgili Polar testleri 28/28.
Genel web taramasındaki tek `resource-state` hatası değişmemiş HEAD kodunda da
aynı testle tekrarlandı; bu release web/rules dosyalarına dokunmuyor. Ekonomi
simülasyonları ve snowball audit kullanıcı talimatıyla kapsam dışında.

Dağıtım kapsamı yalnız Polar servisinin toparlanmasıdır; migration, API şekli,
rules veya oyun döngüsü değişmez. Üç API sırayla, singleton worker en son
yenilenir. Production yedeği ayrı veritabanına geri yüklenip hesap, sezon,
oyuncu, görev, migration ve manuel hak sayıları karşılaştırıldı; eski image,
webroot, Nginx ve ortam dosyası geri dönüş için saklandı. Canlı alım/iade ve
satış bayrağının son durumu açılışın runtime kabul kayıtlarıyla doğrulanır.

## Canlı ödeme, teslim ve tam iade — 7 Ekim 2026

Checkout toparlama düzeltmesi `7d9fdcde9305edb3e2acfc0dc7f8c5dc83d41285`
sürümüyle üç API, worker ve web'e dağıtıldı. Kullanıcının onayıyla `adminlesh`
hesabında iki gerçek Turkey / ₺99 denemesi yapıldı:

| Checkout | Ödeme / skin teslimi | Tam iade |
| --- | --- | --- |
| `d420dfff-dd38-4cc2-9d9a-df1e7e07826e` | Stripe succeeded; Turkey 18:33:42 TRT'de tanımlandı | Başarılı, 18:37:36 TRT'de hak geri alındı |
| `e4541472-7889-4148-bc3b-82409595f1f8` | Stripe succeeded; Turkey 18:47:43 TRT'de tanımlandı, kullanıcı envanterde gördüğünü doğruladı | Kullanıcının talebiyle başarılı; 18:49:50 TRT'de hak geri alındı |

Her iade net ₺82,50 + ₺16,50 vergi, toplam ₺99. Dört canlı paid/refunded
delivery'sinin tamamı HTTP 200; iki yerel sipariş de REVOKED.
İlk denemede sonradan skin görünmemesi, test iadesinin beklenen sonucuydu.

İlk denemede QNB uygulamasında onaydan sonra Mastercard 3D sayfası "sistem hatası"
gösterdi, geçici boş formun ardından Polar başarı ekranı açıldı. İkinci denemede
SMS onayıyla hata görülmedi. İki işlem de API'de başarılı; ret nedeni ve mesajı
boş. Banka uygulamasından tarayıcıya dönüşte ekran durumunun gecikmesi olasıdır,
fakat bankanın kesin 3D hata kodu Polar API'sinde bulunmadığı için kök neden
doğrulanmış sayılmaz. Ödeme/ret nedeni, webhook teslimi ve yerel hak kayıtları
izlenebilir; bankanın sayfasındaki tüm görüntüleme hataları buradan görülemez.

`POLAR_CHECKOUT_ENABLED=true` 18:52:30 TRT itibarıyla üç API ve worker'da
uygulandı; public `/api/skins/polar-shop` enabled=true. Frontend runtime bayrağını
okur. Polar ana ödeme düğmesinde adlandırılır; TRY için mevcut Shopier bağlantısı
"Shopier ile de ödeyebilirsiniz" bölümünde manuel teslim ve komutan adı
talimatıyla sunulur. EUR ülke skinleri yalnız Polar üzerinden satılır.

Kullanıcının Shopier talebiyle Viper'a Ice MANUAL hakkı verildi; aktif.
Önceden var olan 27 MANUAL hakkın içerik hash'i değişmedi. Manuel teslimler için
Polar'a geçmiş ödeme veya ürün hakkı aktarımı gerekmez.
