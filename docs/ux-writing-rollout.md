# UI/UX yazım dönüşümü

Kapsam: altı oyun dili (`tr`, `en`, `fr`, `de`, `es`, `ja`), ekranlarda doğrudan
yazılan işlevsel metinler, Türkçe/İngilizce Wiki, onboarding ve herkese açık
oyun rehberleri. Lore bu dönüşümün dışında kalır.

Başlangıç envanteri: her oyun dilinde 4.147 metin anahtarı. Mevcut Wiki çalışması,
yerel değişiklikler ve stashler korunur. Mekanikler eski dokümanlardan değil,
uygulama ve ilgili testlerden doğrulanır.

## İnceleme bulguları

- Bilinmeyen API kodu ve sıradan `Error`, ham mesajı UI'ya taşıyabiliyor. Bu,
  çevrilmemiş sunucu cümlesi veya geliştirici hatası gösterebiliyor.
- Bağlantı hatası, işlem sonucunu bilmeden yeniden denemeye yönlendiriyor.
- Bazı sezon kayıtları hâlâ “telemetri” diyor; oyuncunun bilmesi gereken şey
  hangi kayıtların eksik olduğu.
- Türkçe hata metninde “item”, Wiki gezinmesinde “public” kalmış.
- Koloni yarışı bazı hatalarda “yerleşim talebi” diye adlandırılıyor.
- Wiki'de uzun cümleler, dolaylı anlatım ve işlev yerine kurgu kullanan 404 var.

## Değişiklik ve doğrulama yaklaşımı

Metin anahtarları, interpolasyon alanları, bağlantı slotları ve kalıcı Wiki
adresleri korunur. Yazım değişikliği mekanik, bakiye, görünürlük veya risk
kuralını değiştirmez. Durum/hata sunumunda davranış değişmesi gerekirse önce
anlamlı test yazılır; metinlerin yalnız birebir eski ifadeyi sabitleyen testleri
yeni anlamı koruyacak şekilde güncellenir.

Kontrol durumları: bilinmeyen hata, eksik hata parametresi, ağ/akış kesintisi,
sonucu doğrulanmamış işlem, kaynak yetersizliği, iptal/iade, bilgi yaşı,
bilinmeyen savunma, sıfır/büyük sayılar, uzun adlar ve altı dilde yer tutucular.
UI değişiklikleri 350 px mobil ve masaüstünde gözden geçirilir.

## Uygulanan dönüşüm — 8 Ekim 2026

İşlevsel metin envanteri incelendi; zaten kısa ve doğru olan metinler korundu.
Bu çalışma kapsamında 1.062 mevcut locale metni değiştirildi:

| Dil | Değişen metin |
| --- | ---: |
| Türkçe | 190 |
| İngilizce | 191 |
| Fransızca | 170 |
| Almanca | 172 |
| İspanyolca | 172 |
| Japonca | 167 |

Bu sayım yalnız yazım dönüşümündeki anahtarları kapsar. Aynı çalışma alanındaki
yeni marka, Sessiz Uzay ve korsan geri çağırma özelliklerinin bağımsız metin
eklemeleri bu sayıya dahil değildir.

Güncellenen yüzeyler: giriş ve oturum, Academy, menü, bekleme ve hata durumları,
kaynak toplama ve depolama, bina ve gemi açıklamaları, araştırmalar, gönderim
ve hız seçimi, radyasyon, transfer, ticaret, konvoy, anıtlar, onarım, koloni
arızaları ve sadakat, klan savaşı ve destek, istihbarat, savaş raporları, sezon
arşivi, bildirimler ve cihaz ayarları. Türkçe/İngilizce Wiki açıklamaları ve
public başlangıç rehberleri de aynı koşul ve terminolojiyle düzenlendi.

Önemli doğruluk düzeltmeleri:

- Komuta Çekirdeği açıklaması Hangarın ayrı seviye sınırını, ana gezegenin
  araştırma etkisini ve 9/13/16. seviyelerdeki koloni yuvalarını ayırır.
- Depo; bir sonraki eş seviyeli üretici yükseltmesi için gerekli kapasiteyi ve
  yağmadan korunan miktarın sınırını açıklar.
- Endüstriyel araştırmanın iki seviyesi, ön koşulu ve onarım etkisi; gemi
  araştırmalarının yer savunmalarına uygulanmaması doğru anlatılır.
- Hız azaltma yakıt indirimi vaat etmez; süre sınırı yavaşlatılmış uçuş
  ayakları için açıklanır.
- Sonda raporu kesin sonuç vaat etmez. Radar kayıtlarının boş olması,
  fark edilen tarama bulunmadığı anlamına gelir. Radar olmadan da tarama
  fark edilebildiği için ilk seviye açıklaması “yakalamaya başlar” demez.
- Klan desteğindeki Hâkimiyet etkisi ev sahibinin kazanç ve kayıp kapsamıyla
  açıklanır. Kısmi/tam savaş başarısı tüm filonun sağ kalacağını vaat etmez.
- Korsan akını için yeni kod davranışı esas alınır: çatışma öncesinde bir
  kez geri çağırma, ganimet alınmaması, yakıtın iade edilmemesi ve dönüşte
  radyasyon riski. Rehber ve Wiki eski geri çağrılamama kuralını kullanmaz.
- Cihaz kalite ayarları gerçek çözünürlük ve kenar yumuşatma farklarını
  anlatır; sıcaklık veya pil ömrü için kesin sonuç vaat etmez.

Bu maddelerin mekanik dayanakları mevcut `packages/rules/src/` hesapları,
ilgili `apps/server/src/services/` işlemleri ve davranış testleridir.
Bu kayıt veya eski tasarım belgeleri mekanik kanıtı değildir.

## Davranış ve gezinme düzeltmeleri

Hata sunumu, izin verilen API kodları için yerelleştirilmiş açıklama kullanır.
Bilinmeyen kodlar, JavaScript hataları, eksik parametreler ve nesne
prototipindeki adlar ham tanıyı veya çözülemeyen değişkeni oyuncuya taşımaz.
Giriş formu ve soğuk oturum başlangıcı da aynı hata sunumunu kullanır.
Bu değişiklikler önce başarısız test, sonra uygulama ve geçen test ile yapıldı.

Mobil public Wiki, kapalı başlayan yerel HTML kategori menüsünü kullanır;
masaüstünde yan menü kalır. Oyun içi Wiki'de kategori/bağlantı seçimi veya dil
değişimi açık menüyü kapatır. Gezinme, yeni içeriği kısa üst çubuğun altına
getirir ve başlığa erişilebilir odak verir. Uzun açık menü kendi içinde
kaydırılır. Public Wiki'nin içeriği ve menüsü JavaScript gerektirmez.
Bu davranışın üç başarısız kontrolü uygulamadan sonra geçti.

## Doğrulama

Kullanıcının bilgisayar yükü talebi nedeniyle testler küçük gruplarda,
`--maxWorkers=1 --minWorkers=1` ve düşük işlem önceliğiyle yürütüldü.
Test, üretim build'i ve tarayıcı kontrolleri aynı anda çalıştırılmadı.

- 36 ilgili test dosyasında 1.128 farklı test geçti; tekrar koşulan testler
  bu sayıya yeniden eklenmedi. Wiki, yerelleştirme, hata/oturum/giriş,
  gönderim, araştırma, kaynaklar, menü, onboarding, istihbarat ve rapor
  kontrolleri dahil.
- Web tip kontrolü geçti. Wiki, dönüşüm locale dosyaları ve ilgili uygulama/
  test dosyalarının kapsamlı lint kontrolü geçti.
- Public Wiki yayın testleri; tüm sayfalarda benzersiz title/description,
  canonical, tek h1, iç bağlantılar, breadcrumb, structured data, Open Graph,
  otomatik sitemap, ilk HTML içeriği ve script bağımsızlığını doğrular.
  HTTP testleri gerçek 404/noindex ve kalıcı yönlendirmeleri doğrular.
- Üretim build'i 222 public Wiki sayfası üretir. Masaüstü ve 350 px Türkçe/
  İngilizce mobil tarayıcı kontrollerinde JavaScript kapalı public içerik,
  çalışan kategori bağlantıları ve oyun içi arama/bağlantı/geri gezinmesi
  doğrulandı. Seçim sonrası yeni başlık ilk görünür alandadır.
- İzole Nginx üzerinde son üretim çıktısındaki 222 sayfanın tamamı HTTP 200
  ve doğru HTML ile açıldı. Dört eksik adres gerçek 404/noindex verdi; beş
  mevcut adres biçimi sorgu parametresini koruyan 308 yönlendirmesi verdi.
  Sitemap ve robots kontrolleri geçti.
- Altı dilde 350 px mobil, Türkçe/İngilizce masaüstü için 15 farklı yüzeyin
  toplam 120 görünümü incelendi. Sayfa/sheet taşması, çözülemeyen değişken
  veya çalışma zamanı hatası görülmedi. Görseller `out/ux-writing-ui/`,
  Wiki gezinme görselleri `out/ux-writing-wiki/` altında bulunur.

Tüm workspace testlerinin geçtiği iddia edilmez. Ayrı marka/yükleme ekranı
çalışması nedeniyle `no-reduced-motion.test.ts` ve `tutorial-hand.test.tsx`
kontrolleri başarısızdır; bu testler gevşetilmedi. Önceki temiz HEAD
simülatör kontrolünde de `season.test.ts` içindeki `TAX holds its band`
başarısızlığı yeniden üretilmişti; bu turda bütün simülasyon paketi yeniden
çalıştırılmadı. Bu yazım çalışması oyun dengesini değiştirmez.

Yerel değişiklikler ve verilen `stash@{7}` / `stash@{8}` korunur. Canlı
dağıtım bu çalışmaya dahil değildir.
