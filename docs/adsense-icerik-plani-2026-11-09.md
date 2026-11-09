# AdSense site onayı — içerik planı (2026-11-09)

Amaç: `asteraonline.space` AdSense site incelemesinden geçsin; H5 Games Ads onayı
(alındı) reklam gösterebilsin. Ret gerekçesi: düşük değerli içerik.

Kapsam: herkese açık sayfalar (ana sayfa, wiki, rehber, yayıncı sayfaları). Oyun
içi kural, ödül ve reklam yerleşimi bu planın dışındadır.

## 1. Teşhis (canlı site, 2026-11-09 ölçümü)

| Ölçüm | Değer |
| --- | --- |
| Sitemap URL | 258 |
| Wiki URL | 229 (115 EN + 114 TR) |
| Kart tipi wiki sayfası (gemi 29, araştırma 20, donanım 10, bina 8) | dil başına 67, toplam 134 |
| Wiki ana içerik, 20 sayfalık örneklem | medyan ~175 kelime |
| Ana sayfa | ~700 kelime tanıtım |
| Uzun, özgün rehber | 1 (`quick-start-guide.html`, ~665 kelime) |
| Yasal/politika sayfası | ~20 (içerik sayılmaz) |

Teknik taraf temiz: prerender HTML, canonical, hreflang, `ads.txt`, yayıncı adı
ve iletişim mevcut.

İnceleyenin gördüğü: aynı şablondan çıkmış, açıklama cümlesi iki kez tekrarlanan,
gövdesi sayı tablosu olan yüzlerce kısa sayfa; bir tanıtım sayfası; giriş isteyen
bir uygulama. Google'ın tarif ettiği "yalnız site şablonu ve çok az içerik" ve
"büyük ölçekte üretilmiş sayfa" kalıbına uyuyor.

## 2. Araştırma özeti

Resmî (Google):
- Yayıncı içeriği olmayan veya düşük değerli içerik taşıyan ekranlarda reklam
  gösterilmez (Publisher Policies, Inventory value).
- Yalnız şablon ve çok az metinden oluşan, "yapım aşamasında" görünen, çoğu görsel
  veya video olan siteler onaylanmayabilir. İçerik başlık değil, tam cümle ve
  paragraf olmalı. Site düzenli güncellenmeli.
- Gezinme sorunları: giriş arkasındaki sayfalar, kırık bağlantılar, yönlendirmeler,
  açılmamış bölümler, aşırı pop-up.
- Scaled content abuse: insan, yapay zekâ veya ikisiyle üretilmiş fark etmez;
  kullanıcıya değer katmadan çok sayıda sayfa üretmek sorundur.
- Makine çevirisi tek başına spam değil; kalitesiz çeviri sorundur.
- People-first içerik soruları: özgün bilgi, ilk elden deneyim, siteye doğrudan
  gelen biri bunu faydalı bulur mu?
- Düzeltmeden sonra AdSense'te "sorunları düzelttim" onayıyla yeniden başvurulur.

Resmî olmayan (topluluk, doğrulanmamış):
- Kelime veya sayfa sayısı eşiği yok. Sık verilen aralık: tek konuda 8–15 sağlam
  yazı, her biri ~800–1500 kelime.
- Aynı yapıda "A nasıl yapılır / B nasıl yapılır" dizileri ince kopya gibi okunur.
- Oyun siteleri bu redde sık takılır. Oyunun dışında açıklama, nasıl oynanır,
  strateji ve ilgili içerik ister.

Sonuç: sayfa sayısı değil, sayfa başına özgün değer. Reklam yeri ayırmak onaya
katkı yapmaz.

## 3. Yol haritası

### Faz A — İnce katmanı temizle (kod, TDD)
1. 134 kart sayfasını `noindex,follow` yap ve sitemap'ten çıkar. Sayfalar oyuncu
   ve oyun içi bağlantılar için yayında kalır, URL değişmez.
2. Kart sayfalarında açıklama cümlesinin iki kez basılmasını ve her kartta aynı
   kalıp cümleleri kaldır.
3. Her kategori sayfası (Filo, Araştırma, Donanım, Binalar) bir karşılaştırma
   sayfasına dönüşsün: tek tablo + rol bazında açıklama paragrafları + "hangi
   durumda hangisi". İndekslenen sayfa bu olur.
4. Kalan ~48 kavram sayfasını (dil başına) birleştir: aynı konunun parçaları tek
   sayfada toplansın; 300 kelimenin altında kalan ve birleşemeyen `noindex` alsın.

Doğrulama: renderer/sitemap testleri (noindex bayrağı, sitemap dışı kalma,
kategori sayfası içeriği), `node tools/visual.mjs` ile mobil görünüm.

Hedef: indekslenen wiki sayfası 229 → ~40.

### Faz B — Derin, özgün rehberler (asıl iş)
12 rehber, EN + TR, her biri 1200–2500 kelime. Her rehberde: gerçek oyun ekran
görüntüleri (açıklamalı), sayılarla çalışılmış örnek, sık yapılan hata, "ne zaman
yapmalı". Yazar adı ve güncelleme tarihi görünür.

1. Astera Online nasıl oynanır — ilk oturumdan ilk sezona
2. İlk 24 saat: ilk baskına giden yol
3. Savaş raporunu okumak (gerçek rapor üstünden)
4. Karşı döngü ve filo kompozisyonu — örnek savaşlar
5. İstihbarat: teleskop, radar ve sonda ile belirsizlikte karar
6. Hedef seçimi ve risk: Honor bantları, zayıf hedef, geri çekilme
7. Ekonomi planı: üretim, depo, koruma
8. Koloni ele geçirme: ne zaman değer, nasıl yapılır
9. Klanlar ve savunma desteği
10. Sezonlar: nasıl işler, ne kazanılır
11. Korsanlar, enkaz alanları ve asteroidler: PvE fırsatları
12. Komutan Gemisi ve Savaş Alanı

Mekanikler koddan ve testlerden doğrulanır; metin `docs/ux-writing.md`'ye uyar.
Bot ifadesi hiçbir dilde geçmez (kilitli karar 2026-10-28).

Teknik: rehberler wiki içinde ayrı bir **Rehberler** kategorisidir
(`/wiki/guides/<slug>`, `/wiki/tr/guides/<slug>`). Mevcut yayın hattı, nginx
yönlendirmesi ve oyun içi wiki aynen kullanılır. Rehberde tarih görünür. Ana sayfa
ve wiki başlığından görünür bir Rehberler girişi olur.

Yazar: bütün metinleri Claude yazar (owner yazmaz, 2026-11-09). İlk elden deneyim
için oyun normal akışından oynanır, ekran görüntüsü alınır ve sayılar koddan
doğrulanır.

### Faz C — Yaşayan içerik
**Güncellemeler / geliştirici günlüğü:** tarihli, her değişikliğin oyuncuya etkisi
ve nedeni. Ayda en az 2 yazı. Git geçmişi ve `docs/` kaynak.

Sezon kroniği bu planın dışında (owner, 2026-11-09): onay için gerekli değil,
eski sezon verisi eksik, sezon başına sayfa toplu üretim riski taşır. Oyun içi bir
ürün özelliği olarak ayrıca değerlendirilir.

### Faz D — Güven ve gezinme
- Hakkında sayfasına geliştirici hikâyesi: kim, nereden, neden bu oyun, ne zamandan
  beri.
- Tüm herkese açık sayfalarda aynı üst gezinme: Oyun · Rehberler · Wiki ·
  Güncellemeler · Hakkında.
- İnceleyenin oyuna girişsiz ulaşması: eğitim galaksisi ana sayfadan tek tıkla.
- Kırık bağlantı, "yakında" bölümü, boş sayfa kontrolü.
- Sayfalara boş reklam yeri eklenmez.

### Faz E — Yeniden başvuru
1. Search Console'da sitemap'i yeniden gönder, rehberler için dizine ekleme iste.
2. "Sayfalar" raporunda rehberler dizine girene kadar bekle (2–4 hafta).
3. AdSense'te "sorunları düzelttim" ile başvur; aynı anda H5 ekibine ret metniyle
   yaz.

## 4. Sıra

A (1–2 gün) → B (en uzun; rehber başına taslak + ekran görüntüsü) → C ve D B
ile paralel → E.

En az eşik: Faz A tamam + 8 rehber + 3–4 güncelleme yazısı.

## 5. Owner kararları

Verilen (2026-11-09): plan onaylandı, kart sayfaları `noindex`; sezon kroniği yok;
bütün yazıları Claude yazar; rehber dilleri EN + TR; Hakkında sayfası mevcut
yayıncı bilgisinin (Samet Yıldırım + e-posta) ötesine geçmez.

Açık: Search Console'da dizine alınmamış sayfa sayısı ve nedenleri ("Taranıyor,
dizine eklenmedi") — ilk teşhisi doğrular, owner paylaşırsa.

## Kaynaklar

- Google Publisher Policies: https://support.google.com/adsense/answer/10502938
- İçerik ve gezinme sorunları: https://support.google.com/adsense/answer/81904
- Başvurudan önce: https://support.google.com/adsense/answer/7299563
- Yetersiz içerik: https://blog.google/products/adsense/how-to-address-insufficient-content/
- Helpful content: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Mart 2024 spam politikaları: https://developers.google.com/search/blog/2024/03/core-update-spam-policies
- Otomatik çeviri: https://www.seroundtable.com/google-softens-automated-translation-stance-39579.html
- Oyun siteleri (resmî değil): https://adsenseaudit.net/guides/adsense-approval-gaming-sites
- Düşük değerli içerik (resmî değil): https://monetizationguy.com/articles/adsense-low-value-content-the-real-fix-not-just-more-words
