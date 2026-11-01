# Komutan Mirası — modellerin entegrasyonu ve yerel önizleme

1 Kasım 2026. Worktree: `/home/yildirim/.codex/worktrees/legacy-models/blindspace`; branch: `codex/legacy-award-model-integration-20261031`. Güncel ana çalışma alanındaki tamamlanmamış Legacy frontend/backend mevcut hâliyle bu worktree’ye kopyalandı; ana çalışma alanına yazılmadı. Önceki backend worktree’si de korunuyor. Başlangıç dosyalarının kopyası `/tmp/astera-legacy-model-integration-baseline` altında.

## Açılacak adresler

- Oyun, gerçek yerel hesap/veri kopyası: http://192.168.1.73:5188/
- Bütün yeni modelleri görebileceğin örnek profil: http://192.168.1.73:5188/v2-gallery.html?view=legacy-profile&self=1&lng=tr
- Örnek kazanım sunumu: http://192.168.1.73:5188/v2-gallery.html?view=legacy-reveal&lng=tr

5188 arayüzü API’yi 3100’e yönlendiriyor. API yalnız `astera_legacy_models_preview_20261101` adlı yerel kopyaya bağlı. Asıl `astera` veritabanına migration uygulanmadı. Kopya oluşturulurken eski yerel migration günlüğünün şemayla tutarsız olduğu görüldü; yeni şema sıfırdan migration ile kuruldu ve mevcut veriler uyumlu kolonlarla taşındı. Boş eski Shopier tablolarındaki kaldırılmış kolonlar kopyaya alınmadı. Hesap parolaları değiştirilmedi. Harici ödeme/posta servisleri kapalı; oyun worker’ı başlatılmadı. Bu, kalıcı oyun simülasyonu veya production deployment değildir.

Örnek profil development galerisidir; gerçek ödüllerin yerine hesaba sahte ödül verilmez. Kopyalanan hesap için kanıtlı geçmiş backfill denendi; kapalı ve uygun eski sezon bulunmadığı için ödül eklenmedi. Gerçek profil boşken bütün modelleri incelemek için örnek profil adresi kullanılmalıdır.

## Model ve renk kararının uygulaması

36 GLB `apps/web/public/assets/legacy/models/meshy-v1/` altında; ayrıca dört Ölüm Yıldızı varyantı `strategic-v1/` içinde. Dosya boyutları ve SHA-256 kimlikleri aynı klasördeki manifestte. Kaynak, kullanıcının sağladığı Meshy modelleri; Blender onarımı ve altı ek demir varyantı Downloads içindeki kaynak klasöründe tutuluyor. Honor heykelciklerindeki kalıcı 1/2/3 rakamları kaldırıldı.

| Model ailesi | Ödül |
| --- | --- |
| honor | Honor sıralaması |
| kupa | Hâkimiyet sıralaması |
| gezegen | Koloni Öncüsü |
| korsan | Korsan Avcısı |
| kazici | Asteroit Avcısı |
| roket | Füze Avcısı |
| radyasyon | Radyasyon Ustası |
| silah_arkadasi | Silah Arkadaşı |
| anit_tutma | Anıt Bekçisi |

Yaygın demir, Nadir bronz, Destansı gümüş, Efsanevi altın. Modeller gömülü PBR malzemeleriyle kullanılıyor, ikinci kez tint uygulanmıyor. Yeni roket ödülünde uçuş alevi yok. Podyum sırası 1/2/3/ilk10 karşılığı altın/gümüş/bronz/demir. Sıra ve kazanım eşikleri modelin içine gömülmüyor; arayüzde gösteriliyor.

Sunucu ve placeholderlar aynı `legacyAwardRarity` kuralını kullanıyor. Sadık Komutan Nadir, Araştırmacı ve Destekçi Efsanevi; yıl pini ve sezon hatırası Yaygın. Önceden kaydedilmiş nadirlikler okuma sırasında güncel kurala göre sunuluyor; değerlendirme de mevcut ödülü kimliğini, tarihini, kanıtını ve vitrin seçimini değiştirmeden sınıflandırıyor. Başarım kimlikleri ve sezon kaynak ödülleri korunuyor.

Koloni Avcısı’nın parçalanmış gezegeni, özgün gemi/silah modelleri ve diğer ödüller korunuyor. Koleksiyon küçük resimleri aynı builder’dan üretiliyor; cache anahtarı dereceyi ve model yolunu da içeriyor. Galerideki kazanılmış ödüllerle örnek ilerlemenin çelişmemesi de doğrulanıyor.

## Onaylanan son miktarlar

| Başarım | Eşikler |
| --- | --- |
| Koloni Avcısı | 1 / 5 / 20 / 50 |
| Koloni Öncüsü | 1 / 5 / 20 / 50 |
| Anıt Bekçisi | 1 saat / 12 saat / 1 gün / 3 gün |
| Asteroit Avcısı | 10 / 100 / 500 / 2000 |
| Son Hüküm | 1 / 5 / 20 / 50 |
| Radyasyon Ustası | 1 / 10 / 50 / 100 |
| Füze Avcısı | 1 / 5 / 20 / 50 |
| Silah Arkadaşı | 1 / 5 / 20 / 50 |
| Başa Bela | 1 / 10 / 50 / 100 |

Korsan Avcısı 10/30/50/100, sonda 10/100/1000, gemi üretimleri 100/1000/10000 ve Gösterişçi 1/3/5 olarak kaldı. Anıt Bekçisi artık beş değil dört ödül veriyor. Sayımların kariyer/sezon kapsamları değişmedi.

## İlk entegrasyon sırasındaki doğrulama

Bu bölüm ilk 24 modelin entegrasyon kaydıdır. Son 40-model ve frontend inceleme sonuçları aşağıda bağlantılı iki güncel rapordadır.

- Revize miktarlar: 11 saf kural testi; her yeni eşiğin tam sınırı ve bir eksiği.
- Arayüz/model seçimi/profil/açılış/örnek veri: 28 test.
- Nadirlik entegrasyonu sırasında: 24 ledger ve 13 API/kazanım kuyruğu testi. Her worker ayrı, migration uygulanmış `_test` DB kullandı; iki DB silindi.
- LAN adresinden doğrulanan gerçek API: hesap, Legacy profil ve ilerleme 200; dokuz revize hedef dizisi yanıt içinde birebir kontrol edildi. Girişsiz hesap isteği beklenen 401, sunucu listesi 200.
- `WEB=http://127.0.0.1:5188 node tools/visual.mjs out/legacy-models --legacy-models`: 24 model gerçekten yüklendi, 36 örnek koleksiyon parçasının küçük resmi üretildi, 350×812 ve 1280×900 ekranlarda dört capture alındı. Rapor/screenshotlar `out/legacy-models` altında.
- Yazılımsal WebGL çekiminde turntable 4 fps’e sınırlandı; ürün 30 fps hedefini koruyor. Bunlar fiziksel telefon GPU performans ölçümü değildir.
- Tam web ve server typecheck’leri 2 GiB sınırında bellekten taştı. Heap artırılmadı. Değişen dosyalar kendi proje compiler seçenekleriyle ayrı programlarda kontrol edildi; bu kontrol bütün projenin typecheck’i olarak sunulmaz.
- Değişen dosyalarda proje seçenekleri korunarak yapılan tip kontrolleri ve hedefli lint kontrolleri geçti. `git diff --check` temiz.
- Deployment, ana branch’e kopyalama veya push yapılmadı. 5188 ve 3100 önizleme süreçleri çalışır bırakılıyor.

Sonraki model ve frontend inceleme sonuçları `commander-legacy-new-awards-2026-11-01.md` ve `commander-legacy-frontend-review-2026-11-01.md` içinde. Gemiler kendi modelleriyle yüzen minyatür olarak sunulur; sahte bir gemi plaket asset’i varsayılmaz. Anıt ve özel madalyaların bu turda istenen düzenlemeleri tamamlandı.
