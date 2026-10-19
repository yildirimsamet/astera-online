# Bilinmeyen sinyal yön oku

## İstenen davranış

Galaksi ekranındaki ok sabit bir HUD noktasına bağlanmaz. Kamera dönüşü, kaydırma ve
yakınlaştırma sırasında hem konumu hem açısı sinyalin ekrandaki izdüşümünü takip eder.
Görünen sinyalde ok işaretin gerisinde durur; kadraj dışında ve kamera arkasında hedefin
yönünü ekranın kullanılabilir kenarında gösterir. Masaüstü yan paneli Canvas alanının
dışındadır; mobil alt menüsü ve üst köşe kontrolleri için okun içinde kalacağı boşluk ayrılır.
Ok mevcut sinyal penceresini açar. Filo gönderildiğinde ve süre dolduğunda kaldırılır.

## Sınırlar ve etkilenen yerler

- Yalnızca frontend sunumu: zamanlama, ödül, filo ve görünürlük yetkileri değişmez.
- `GalaxyCanvas`: DOM oku ile kamera izdüşümü arasındaki ref bağlantısı.
- Yeni geometri yardımcısı ve yön oku bileşeni; mevcut harita işareti, uçuş ve pusu efekti korunur.
- Mevcut `unknownSignal` metinleri ve gönderim penceresi kullanılır.
- Kare başına React state güncellemesi veya ağ isteği eklenmez.

## Test planı

Önce kırmızı, sonra uygulama ve yeşil: masaüstü/mobil görünür hedeflerde yer ve açı;
kamera dönüşü/kaydırma/zoom; dört ekran kenarı; kamera arkası ve tam arkası; hedef kamera
merkezindeyken sonlu geometri; sıfır boyutlu viewport; mobil yeniden boyutlandırma;
gönderilmiş/dönüşte/bitmiş/kaybolmuş/geri çağrılmış ve süresi dolmuş sinyallerde ok yokluğu;
oktan mevcut sinyal kimliğiyle açma; kamera hareketinde DOM güncellemesi.

Tarayıcı kontrolü gerçek galaksi bileşenleriyle telefon ve masaüstünde yapılır; kamera
hareketinde konum/açı ve kenar sınırları ölçülür, görüntüler incelenir. Normal doğrulamalar
tek worker ile ardışık çalışır; uzun ekonomi/sezon testleri kapsam dışıdır.

## Uygulama ve doğrulama

- Konum/açı hesabı gerçek kamera matrisini kullanır. Her gösterge kendi vektörlerini ve
  sonuç nesnesini tekrar kullanır; kamera hareketi React state'i veya ek ağ isteği oluşturmaz.
- DOM düğmesi Canvas'ın kardeşidir: kamera arkasındaki hedef, Three.js HTML işaretinin
  görünmezliğine takılıp yön okunu da kaybettirmez.
- Mobil dokunma alanı 52 px, masaüstü 60 px. Ok mevcut sinyal penceresini açar.
- Önce eksik uygulama, sonra eski kamera matrisi ve yatay mobil alt menü sınırı için
  kırmızı testler gözlendi. İlgili sinyal regresyonları 3 dosyada 51 test; yön oku dosyası 21 test geçti.
- Rules/server/web/sim tip kontrolleri tek çalışma alanı ile ardışık geçti.
- `node tools/visual.mjs out/unknown-signal-guide-2026-10-19 --unknown-signal-guide`:
  350×812, 844×390, 1280×812; toplam 15 kamera görünümü. Konum, gerçek kamera yönüyle
  açı eşleşmesi, kenarlar, tıklama ve gerçek istemci mutasyonu sonrasında okun kaldırılması geçti.
  Fixture yalnızca tarayıcı içindedir; production'a istek veya oyuncu yazması yapmaz.
- Normal testler tek worker ile ardışık tamamlandı: rules 2493 geçti; server 4544 geçti,
  3 atlandı; web 7069 geçti, 29 atlandı, 26 başarısız. Sinyalle ilgili 51 test genel
  koşuda da geçti. Uzun ekonomi/sezon simülasyonları çalıştırılmadı.
- Web'deki 26 hata mevcut public landing/onboarding, Academy menüsü, CSP, sitemap ve
  landing renk/boyut sözlüğü değişikliklerinde: `onboarding`, `academy-replay`,
  `stray-click`, `production-csp`, `wiki-publication`, `surface-vocabulary` test dosyaları.
  Sonuncusu `PublicLandingScreen.tsx` içindeki `text-xs` sınıfını bildiriyor.
- Genel lint kontrolünde mevcut hesap silme değişikliklerinden 9 hata çıktı
  (`account.ts`, `account-deletion-request.test.ts`, `account-deletion-ui.test.tsx`).
  Sinyal bileşenleri, testleri ve görsel kontrol aracı için lint hatası yok.
- Son fark incelemesi ve `git diff --check` tamamlandı. İlgisiz mevcut çalışmalar
  değiştirilmedi; commit, push veya production yayını yapılmadı.
