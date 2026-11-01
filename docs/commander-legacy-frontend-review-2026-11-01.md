# Komutan Mirası — frontend incelemesi

1 Kasım 2026. Worktree: `/home/yildirim/.codex/worktrees/legacy-models/blindspace`.

Kapsam: bu görevde eklenen/değişen Legacy bileşenleri, profil menüsü girişi, gezegendeki komutan adına tıklama akışı, API sorguları/şemaları, çeviriler, bütün ödül aileleri ve 3D sunum. Mevcut ana menü yeniden tasarlanmadı.

Skill’ler: `router`, `game-ui-ux`, `create-game-assets`, `threejs-gltf-loading`, `threejs-materials-lighting`, `threejs-scene-setup`; yeni başlık resmi için built-in `imagegen`. Mevcut Three.js 0.185.1 korundu.

## Bulunan ve düzeltilen sorunlar

| Bulgu | Son davranış / doğrulama |
| --- | --- |
| Koleksiyon 12 sayfada sessizce kesiliyordu. | Sunucunun son cursor’ına kadar okunur. 13 sayfalık kariyer regresyonu geçti. |
| Koleksiyon yüklenmeden düzenleyici mevcut seçimleri silebilirdi. | Koleksiyon başarıyla gelene kadar düzenle ve boş raf girişleri açılmaz. |
| Sezon geçmişi yükleniyor/hata durumlarında boş başlık bırakıyordu. | Durum ve hata metni gösterilir; boş geçmişle karışmaz. |
| Ziyaretçinin aktif unvanına “Unvanın” yazılıyordu. | Ziyaretçi için “Aktif unvan”; kişinin özel ilerlemesi okunmaz, sahibi eylemleri gösterilmez. |
| Ödül detayı okuma hatası sessizdi. | Hata ve yeniden dene eylemi var; parça kapanmadan tekrar okunabilir. Yazma hataları da gösterilir. |
| Pencereler klavye odağını arkada bırakıyordu. | Küçük vitrin, tam profil, ödül ve düzenleyici odağı alır; yalnız en üst pencere Tab döngüsünü tutar, kapanış açan düğmeye döner. |
| Kazanım gösterimi odağı/galaksi çizimini yönetmiyordu. | Galaksi örtülür, odak tutulur. Escape/Android Back gösterimi kapatabilir; görülmeyenler sunucuda sonraki ziyaret için kalır. |
| Arka plandaki süre ödülü izlenmiş sayıyordu. | Uygulama etkin değilken bekler; geri dönünce giriş yeniden oynar, ack bir kez verilir. |
| Kısa yatay ekranda kazanım eylemleri kırpılıyordu. | Model ve açıklama yan yana; kısa ekranlarda kapanış erişilebilir. |
| Küçük vitrin altı çok küçük, isimsiz ikon gösteriyordu. | Üçerli iki raf ve her parçanın ismi; bütün koleksiyon bir dokunuş ileride. |
| Yükleme sırasında bulanık renk ovali kalıyordu. | Model gelene kadar net, nötr bir rölyef yer tutucusu; isim ve nadirlik kaybolmaz. |
| Üst üste pencerelerde önceki başlık aynı parlaklıkta kalıyordu. | Yalnız Legacy pencerelerine uygulanan koyu scrim, açık ödülü öne çıkarır. |
| Profil sheet başlığında boş koyu şerit vardı. | Ödül galerisi görseli, anlaşılır başlık ve kapatma düğmesi; diğer Legacy sheet başlıklarıyla aynı görsel aile. |
| Örnek veride raf kimlikleri koleksiyonla uyuşmuyordu. | Aynı kazanımın ilk örneği korunur; sezon detayları ve düzenleyici gerçek kimliklerle çalışır. Bu, gerçek API verisi değil galeri düzeltmesidir. |

Ödül UV/yazı yönü, yıl rozetinin düşük görsel kalitesi, kalp, gemi pozları, yanlış egzozlar, Honor yıldızları, kirli metal ve Ölüm Yıldızı kuşakları da bu kapsamda incelenip düzeltildi. Envanter ve teknik kanıt `commander-legacy-new-awards-2026-11-01.md` içinde.

## Görsel ve etkileşim doğrulaması

`node tools/visual.mjs` üzerinden gerçek bileşenler çalıştırıldı:

- `--legacy-models`: 350×812 ve 1280×900, 36 Meshy + 4 stratejik GLB gerçekten yüklenir; 52 örnek parçanın küçük resimleri; altı screenshot.
- `--legacy-review`: Sezon Hatırası, yıl rozeti, Destekçi, Ok, Başa Bela, Gösterişçi, Son Hüküm, Kıyamet Tersanecisi. Galaksi egzoz kaynakları yüklenir; arena engine-flames yüklenmez.
- `--legacy-frontend-review`: gezegendeki isim → küçük vitrin → ödül → geri → tam profil; ziyaretçi/sahip ayrımı; kategori filtresi, unvan, dolu vitrin, altı seçim sınırı, temizleme/kaydetme/yeniden seçme; sezon kartları; 812×350 yatay kazanım. On bir screenshot. Yatay taşma, asset 404’ü veya tarayıcı hatası yok.

Raporlar `out/legacy-models`, `out/legacy-review`, `out/legacy-frontend-review` altında. Yazılımsal çekimler 4 fps’e sınırlandı; ürün turntable’ları 30 fps, görünmeyen/arka plandaki canvas’lar durur. Kazanım canvas’ı da demand render kullanır. Fiziksel telefon GPU performansı ölçülmedi.

## Kod doğrulaması ve sınırlar

11 frontend/çeviri/profil test dosyasında **153 test**, ayrıca **11 saf Legacy kural testi** geçti. Değişen 30 frontend dosyası proje compiler seçenekleriyle tip kontrolünden geçti; kapsam dosyalarında lint temiz. Üretim Vite derlemesi geçti. Son test ve derleme kayıtları `out/legacy-frontend-review` altındadır.

Tam web/server typecheck önceki entegrasyon sırasında 2 GiB sınırında bellekten taşmıştı; sınır yükseltilmedi. Hedefli tip kontrolü bütün proje typecheck’i olarak sunulmaz. Vite derlemesi mevcut büyük chunk uyarılarını korur; bu tur genel oyun bundle’ı yeniden tasarlanmadı.

LAN kontrolü: oyun, hesap, Legacy profil/ilerleme/katalog ve sunucu listesi 200; girişsiz Legacy profili 401. API ayrı `astera_legacy_models_preview_20261101` kopyasına bağlıdır. Gerçek hesaba sahte ödül, asıl DB’ye migration, ana çalışma alanına kopyalama veya production deploy yapılmadı.

## Başlık görseli

Built-in `image_gen.imagegen` ile üretildi. Kaynak: `assets/source/legacy/header-gallery-v1.png`; runtime: `apps/web/public/assets/legacy/header-gallery-v1.webp` (1200×720, 93.162 byte). Son prompt, araç ve işleme kaydı `assets/source/legacy/header-gallery-v1.json` içindedir. Koyu istasyon galerisi, altın/gümüş/bronz eserler, altın ve cyan ışık; içine yazı basılmadı. Başlıklar gerçek arayüz metni olarak kalır.
