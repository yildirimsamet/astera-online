# Tactical üretim kartları ve stok dili

Owner kararı: Ölüm Yıldızı radyasyon bombalarının onaylanan üretim düzenini kullanır. Tally hücreleri yalnız stok/şarj yuvasıdır; radyasyon seviyesini göstermez. Seviye, açık seviye yazısına eşlik eden 1/2/3 radyasyon simgesiyle gösterilir.

Uygulama:

- Ölüm Yıldızı ve batarya mevcut görsellerini koruyarak radyasyon kartlarıyla aynı sahne/gövde/başlık/stok/bilgi/fiyat/kontrol stilini kullanır. Ölüm Yıldızı EMP süresi ve koloni sadakati kaybını ayrı iki bilgi alanında gösterir.
- Üçünde de ortak `TacticalStock`: açık `Stok kullanılan/kapasite` veya `Şarj kullanılan/kapasite`, ortak `ChargeTally` ve durum özeti. Hazır dolu turkuaz, üretimde turkuaz çerçeve, duraklamış amber çerçeve, uçuşta mor çerçeve, boş koyu hücre. Renklerin yanında durum yazıları vardır.
- Radyasyon bombasının her seviyesinde tam bir stok hücresi vardır. Uçuşta ve duraklamış bomba dolu yuvayı tutar; hazır veya üretiliyor diye gösterilmez, ikinci üretim sunulmaz.
- Ölüm Yıldızı ve bataryanın gerçek üretimdeki/duraklamış adetleri ayrılır. Yeni sahibinin kapasitesini aşan ele geçirilmiş stok kaybolmaz: bütün mevcut hücreler çizilir, sayı gerçek sahip kapasitesine göre gösterilir (ör. 2/1).
- Üretim kapıları, fiyatlar, süreler, kapasite araştırmaları, geri çağırma ve sunucu işlemleri değiştirilmedi. Batarya Savunma sekmesinde kalır. Diğer görevlerin dosyaları topluca yeniden biçimlendirilmedi.

Doğrulama:

- RED: dört test dosyasında yeni ortak kart/stok/seviye ve rezerv hücre testleri beklenen sebeple başarısız oldu (`/tmp/tactical-stock-red.log`).
- GREEN: 6 dosya / 174 test PASS; 29 eski stratejik-offline testi mevcut feature-flag şartı nedeniyle atlanır (`/tmp/tactical-stock-green-final.log`). Kontroller Core 13 kapısını, üretim düğmelerini, 2/4/6 batarya kapasitesini, karma hazır/duraklamış stokları, uçuşta stok işgalini ve gezegenler arası stok değişimini kapsar.
- Görsel araç gerçek `PlanetScreen` kartlarını üretir; iki ekran genişliği, altı dil, boş/hazır/üretimde/duraklamış/uçuşta/karma/kilitli durumlarında kontrol edilir. Sayaçlar, seviye simgeleri, bütün görseller, çeviriler ve ilgili kartların taşmaması ölçülür.
- Fransızca 350px Savunma sekmesinin eski kara savunması başlığı (`v2-legend shrink-0`) belgeyi 440px'e taşır. Yeni batarya kartı ve stok göstergesi taşmaz. Araç bu ilgisiz sayfa taşmasını ayrı `documentFits`/`outside` alanlarında kaydeder; kart sonucunu bütün sayfa temizmiş gibi sunmaz. Bu task kapsamında kara savunması başlığı değiştirilmedi.
- Kapanış görsel turu: 88 kart görünümü PASS (`/tmp/astera-tactical-stock-20261016-closing/checks.json`). Yukarıda açıklanan Fransızca eski kara savunması başlığı bu sonuçta ayrıca kaydedilir; yeni kartların viewport sınırları ve stokları temizdir.
- Web typecheck PASS (`/tmp/tactical-stock-typecheck-closing.log`). Yeni stok durumlarının çeviri anahtarları açık bir literal union ile tiplidir.
- `pnpm lint` üzerinden ilgili 17 dosyanın tamamı dosya sayısı da doğrulanarak kontrol edildi: 17/17, sıfır hata/uyarı (`/tmp/tactical-stock-lint-closing.log`). Diğer yerel doğrulamalar ve bellek kullanımı dikkate alınarak sırayla çalıştırıldı.
- Son masaüstü, mobil karma stok ve batarya görüntüleri `.dev/tactical-stock-20261016/` altında. Yerel API sağlık kontrolü ve whitespace kontrolü PASS. Çalışma master üzerinde yereldir; commit/push/deploy yapılmadı.
