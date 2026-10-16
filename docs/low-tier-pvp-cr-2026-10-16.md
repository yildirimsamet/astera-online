# Tier 1–3 PvP — CR, 16 Ekim 2026

Kapsam: bu işte yapılan değişiklikler ve bunların çağıranları. Master üzerinde
önceden bulunan değişiklikler korunmuştur. İnceleme → başarısız testle doğrulama →
düzeltme → tekrar doğrulama sırası uygulanmıştır.

## Doğrulanan ve düzeltilen bulgular

### P2 — Korunan uzun kalkan raporda daha kısa anlatılıyordu

Tier 1–3'te kazanılmış kalkan, kademe 4'e geçilince kısaltılmıyor. Ancak yeni
savaşın profili 8 saat olduğu için rapor, gerçekte 11 saat kalan korumayı 8 saat
anlatabiliyordu. Yeni regresyon, 11 saat beklerken 8 saat gördü.

- Var olan `recoveryShieldUntil`, yalnız savunanın raporunda `recovery.until`
  olarak yayımlanıyor. Ek DB alanı gerekmiyor.
- Kazanılan koruma açıklaması, rapor anı ile kayıtlı bitiş arasındaki gerçek süreyi
  kullanıyor. Eşik ve kayıp penceresi savaşın kayıtlı profilinden geliyor.
- Eski sunucularda `until` yoksa profil süresine dönülüyor. Saldıran ve destekçi
  için özel toparlanma bilgisi yine kapalı.
- UI testi, API sözleşme testi ve dar ekran görsel örneği eklendi.

### P2 — Modelin PvP yağma ve sonda hesapları eski profilde kalmıştı

Canlı sunucu yeni profili kullanırken modelin sonda ve PvP yağma çağrıları varsayılan
%60/%30 profilinde kalmıştı. Komutanın küçük ana gezegeni ve gelişmiş kolonisi de
yalnız ana gezegen seviyesiyle değerlendirilebiliyordu.

- Modelde ortak, saf bir komutan profili adaptörü eklendi. Bütün kontrol edilen
  gezegenlerin en yüksek Çekirdeği sayılıyor; başka komutanın kolonisi sayılmıyor.
- PvP yağması, sonda ve kademe kapısı aynı komutan okumasını kullanıyor.
- Tarafsız gezegen, korsan ve bağlamsız filo kalibrasyonu varsayılan profilini koruyor.
- Sadece saf adaptör fonksiyonları test edildi. Dünya/sezon kurulmadı; ekonomi
  simülasyonu veya kalibrasyon çalıştırılmadı.

### P2 — Modelin yağmalanabilir kaynak ölçümü eski hesabı tekrar ediyordu

Modeldeki ölçüm, yağma profilinden bağımsız olarak Havuzun yarısını sayıyordu.
Regresyon örneğinde yeni kurala göre 2.766 beklenirken 10.865 dönüyordu.

- Güncel stok ve kapasite ölçümü artık ortak `raidableStock` hesabını kullanıyor.
- Kademe ve koloni bağlamı günlük ölçüme iletiliyor. Kaynak türlerinin Depo
  tabanları ve Havuz payı da aynı hesaptan geliyor.
- Sağlıklı ekonomi bantları değiştirilmedi; sezon sonucu veya kalibrasyon iddiası yok.

### P3 — Tarafsız sonda regresyonunun beklenen değeri yanlış profilden geliyordu

Test, önce oyuncu olarak oluşturduğu dünyayı sonra tarafsız hedefe dönüştürüyor.
Beklenen tarafsız ganimeti düşük kademe oyuncu profiliyle hesapladığı için 1.080
yerine 450 bekliyordu. Hata tek başına yeniden üretildi.

- Test yardımcısı gerçek komutan profilini okuyor.
- Tarafsız hedefe çevrilecek örnekte beklenen miktar açıkça standart profilden alınıyor.
- Canlı tarafsız gezegen davranışı değiştirilmedi.

## İncelenip hata olmadığı doğrulananlar

- Academy akınının hedefi `NEUTRAL`; özel düşük kademe komutan indirimi uygulanmamalı.
- Sondanın ganimet bandı zaten indirilmiş miktarı içeriyor. İstemcide ikinci kez
  indirim yok. Kısmi/kesin oranı her iki profilde de yarım.
- Normal ve ortak klan akınları profil seçimini savunan komutandan yapıyor.
- Aynı profil kaynak kesintisi, kargo sınırı, sınırsız ganimet ve rapor kaydında kullanılıyor.
- Kalıcı birlik kaybı ve oyuncunun pozitif akın kârı net kayıp hesabında kalıyor.
- Mevcut kalkan kısalmıyor; süreler üst üste toplanmıyor. Üretim bonusu kayıtlı
  kalkan bitişini takip ediyor.
- Koloni arızası 4 saat net kayıp / 6 saat geçmiş koşulunu koruyor; daha kolay
  kalkan yeni oyuncuda daha kolay arıza üretmiyor. Tam 6 saat ve hemen içi test edildi.
- Eski raporlarda profil yoksa eski standart açıklama kullanılıyor. Yeni raporlar
  sonradan kademe değişimiyle yeniden yorumlanmıyor.
- Migration yalnız nullable JSON alanı ekliyor; eski raporları yeniden yazmıyor.
- Yeni API alanları eski yanıtlarla uyumlu ve özel kalkan bitişi saldırana açılmıyor.

## Doğrulama durumu

- İlk tam ortak kural turu: 2.411 test geçti.
- İlk tam web turu: 6.555 test geçti; eski Wiki tablo testi güncellendi ve 12 testlik
  dosya yeniden geçti. CR sonrasında raporun 77 testi tekrar geçti.
- CR saf model testleri: 4 test geçti. Odaklı sunucu/sonda/sözleşme turu: 20 test geçti.
- CR sonrası altı etkilenen web dosyasında 170 test geçti; dört çalışma alanının
  tip kontrolü geçti. Backend/kurallar ve araçlar/model lint grupları geçti.
- İlk rapor ve Wiki görsel kontrolleri geçti. Son rapor turunda yeni %25/%15 ve
  %12,5/%7,5 açıklamaları ile korunmuş 11 saatlik kalkan dar ekranda doğrulandı.
  Araçtaki ayrı filo gönderme örneği, açık geliştirme sunucusunun aynı Toast
  modülünü farklı sürüm URL'lerinden yüklemesi nedeniyle durdu; temiz sunucuda
  tekrar kontrol edilecek.
- Genel web lint turu, bu iş dışında eşzamanlı eklenen
  `apps/web/capacitor.config.ts:10` dosyasındaki `||` kullanımı nedeniyle durdu
  (`prefer-nullish-coalescing`). Bu işin dosyalarında boşluk/diff kontrolü temiz.
- Tam normal sunucu paketi devam ediyor. Uzun ekonomi/sezon simülasyonları kapsam dışıdır.

## Yerel çalışma sınırı

Yeni migration izole test veritabanında çalıştırıldı. Canlıya yayın yapılmadı.
Yerel geliştirme DB'sinde önceden uygulanmamış başka migration bulunduğundan
bu iş kapsamında ilgisiz migration'lar topluca uygulanmadı.
