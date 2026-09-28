# Polar entegrasyonu — iş bölümü ve adımlar

## Hedef

Astera Online'daki dokuz sabit fiyatlı gezegen görünümünü Polar üzerinden otomatik
teslim etmek. Polar, Paddle'ın yeni otomatik ödemeler için yerini alacak. Shopier'in
mevcut manuel satış ve hak verme yolu korunacak. Mevcut Paddle siparişleri ve
kozmetik hak kayıtları silinmeyecek.

| Ürün | Türkiye | Türkiye dışı |
| --- | ---: | ---: |
| Lava, Ice, Toxic, Desert, Turkey | ₺99 | €2,99 |
| Germany, France, Spain | €2,99 | €2,99 |
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
   seç. Dokuz ürünün her birini tek seferlik sabit fiyatlı oluştur. Lava, Ice,
   Toxic, Desert, Turkey ve pakete ayrıca TRY fiyatı ekle; Germany, France, Spain
   yalnız EUR kalsın. Çoklu para birimi fiyatları ürünün **Pricing** bölümündedir;
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
2. **Polar katalog ve ortamı:** Dokuz ürünü sandbox ve canlıda karşılaştırıp eksikleri
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
   sonra ilgili testleri ve `pnpm verify` komutunu çalıştır. Polar sandbox'ta dokuz
   ürün, iki bölge, webhook tekrarı, paket, iade ve gerçek kullanıcı akışını test
   et. Üretim dağıtımını `docs/deployment.md` kurallarına göre hazırla.

## Sıra ve kapılar

1. [x] Kod/hesap envanteri ve Polar ürün eşlemesi.
2. [x] Sandbox ve canlı katalog tamam; sandbox API erişimi doğrulandı.
3. [x] Testlerle sunucu entegrasyonu ve ayrı Polar sipariş kayıtları.
4. [x] Mağaza, fiyat sayfaları ve politikalar yerel kodda Polar'a bağlandı.
5. [ ] Tam sandbox satın alma/iade testleri ve proje doğrulaması.
6. [ ] Canlı ürün, sır ve webhook doğrulaması; satış kapalı dağıtım.
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
| Element paketi | `9840aaf4-7e11-4aba-8234-6ab4f9379dcb` | `34dcfb16-e875-43da-9a9d-e12ee4b5f335` |

**Çıkış ölçütü:** Polar checkout'ta gösterilen tutar mağazayla eşleşir; ödeme
doğrulanmadan skin verilmez; başarılı ödeme skini yalnız doğru hesaba bir kez verir;
tam iade yalnız Polar'dan alınan hakkı kaldırır; Shopier ve geçmiş Paddle hakları
çalışmaya devam eder.
