# İlk ziyaret: doğrudan eğitim ve açılış yükü

## Davranış

- Web'de yeni ziyaretçi, Play'e basmadan mevcut uçuş eğitimine girer. Eğitim aynı 11 ana adımdan oluşur; dersin kuralları ve ilerleme kaydı değişmez.
- Çerezle oturum geri yükleme arka planda sürer. Kontrol beklerken veya API geçici olarak erişilemiyorken yerel eğitim oynanabilir.
- Cihazında komutan kaydı bulunan oyuncu mevcut oturum/giriş yolunda kalır. Gerçek hesap geri yüklenirse, cihaz ipucu bulunmasa bile hesabına yönlendirilir. Geçerli önbellekli oyun oturumu eğitim tarafından değiştirilmez.
- Eğitimden giriş ekranına çıkan kişinin tercihi `astera.training-entry.dismissed=1` ile hatırlanır. Bu bir gezinme tercihidir; kimlik veya ziyaret geçmişi içermez. Play ile eğitime tekrar girilebilir.
- Sayfa yenileme, mevcut eğitim kaydını devam ettirir. Depolama kullanılamıyorsa eğitim yine açılır; kalıcı tercih/ilerleme saklanamaz.
- JavaScript yüklenmeden statik Play'e basılması `#play` ile ilk ekran seçimine taşınır. İşaret, React tarafından okunduktan sonra temizlenir; sonraki hesap dönüşünü yanlışlıkla eğitime yönlendirmez. Sorgu parametreleri korunur.
- Native giriş, `/profile`, bağımsız savaş simülatörü, bakım ve sürüm kapıları kendi yollarını korur.

## Yük neden azaldı?

1. Genel API şemaları, bildirimler ve savaş raporları Arena'nın tam modülünden birkaç sabit okuyordu. Bu bağımlılık, üretilmiş Arena geometrisini hem açılışa hem de eğitim ekranına taşıyordu. Bu tüketiciler artık yalnız hafif `@astera/rules/arena/ui` alt yolunu kullanır. `RING_DISTANCE` ve `TACTICS` aynı değerlerle ortak ayar modülüne taşındı; eski dışa aktarımlar korunur.
2. Fransızca, Almanca, İspanyolca ve Japonca sözlükleri yalnız seçildiğinde yüklenir. Türkçe geri dönüş dili ve İngilizce kaynakları başlangıçta bulunur. İlk React ekranı seçilen dil hazır olduktan sonra çizilir.
3. Yeni ziyaretçinin statik tanıtım içeriği ilk boyamada gizlenir; mevcut satır içi hazırlık ekranı kullanılır. Tanıtım görsellerinin zorunlu ön yüklemeleri kaldırıldı. Eğitim açılırken bu görsellerin indirilmediği tarayıcı isteklerinden doğrulandı.

## Doğrulama

- Ana web regresyonu: 32 dosya, 394 test. İlgili rapor, anıt ve eskort ekranları: 9 dosya, 234 test. Arena kuralları ve protokolü: 6 dosya, 73 test. Toplam 701 ayrı test; tekrar koşular bu sayıya eklenmez.
- Yeni davranış testleri önce eski davranışta başarısız olacak şekilde çalıştırıldı. Son incelemede bulunan eski `#play` işaretinin kalması da FAIL → düzeltme → PASS ile doğrulandı.
- Web'de değişen TypeScript dosyaları ve rules workspace tip kontrolü geçti. Tam web tip kontrolü, 2 GiB Node heap sınırında bellek yetersizliğiyle sonlandı; bu kontrol başarılı gösterilmez. Değişen dosyaların lint kontrolü workspace'ler sırayla ele alınarak yapılır. Bu kapsam, bütün deponun `pnpm verify` çalıştırıldığı anlamına gelmez.
- Web üretim derlemesi ve yeni rules alt yolunu kullanan server derlemesi geçti. Veritabanı şeması ve API cevap yapıları değişmez.
- `node tools/visual.mjs out/first-visit --first-visit`: 350 ve 390 px telefon, Almanca masaüstü, komutan ipucu bulunan cihaz. Gerçek eğitim kontrolleriyle ilerleme, yenilemeden devam, giriş ekranına çıkma ve elle yeniden giriş doğrulanır. API çağrıları yerel fixture tarafından karşılanır; canlı oyuncu veya hesap oluşturulmaz.
- Otomatik eğitim girişi `play_clicked` üretmez. Eğitim başlama/hazır olma olayları mevcut gerçek eğitim telemetrisinden gelir.

## Ölçüm yöntemi ve sınırları

Eski ve yeni üretim derlemeleri aynı yerel gzip sunucusunda, boş tarayıcı önbelleğiyle karşılaştırılır. Yavaş profil: 1,6 Mbps indirme, 150 ms gecikme, 4 kat CPU yavaşlatma. Eski akışta Play, düğme hazır olur olmaz otomatik tıklanır; her iki akışta da eğitimin yükleme örtüsünün kalkmasına kadar ölçülür.

Uzun görevlerin 50 ms üzerindeki bölümleri ayrıca toplanır. Bu sayı, ölçüm penceresi nedeniyle Lighthouse TBT puanı olarak sunulmaz. WebGL, headless Chrome/SwiftShader ile çalışır; gerçek telefon GPU süresini temsil etmez. Eğitim sahnesinin 3D hazırlık maliyeti tamamen ortadan kalkmış sayılmaz.

Son eşleştirilmiş ölçüm:

| Ölçüt | Önce | Sonra |
| --- | ---: | ---: |
| İlk JS paketi, gzip, yaklaşık | 2,01 MB | 0,54 MB |
| DOMContentLoaded, yavaş profil | 15,83 sn | 4,61 sn |
| Eğitim görünür ve yükleme örtüsü kalkmış, yavaş profil | 33,65 sn | 16,99 sn |
| Eğitim hazır olana kadarki uzun görevlerin engelleme toplamı | 9,10 sn | 5,37 sn |
| İndirilen script toplamı, yavaş profil | 2,85 MB | 1,38 MB |

Bu karşılaştırma açılıştan eğitime kadar aynı son noktayı kullanır. Yalnız eski landing ekranıyla yeni 3D eğitimi karşılaştıran bir sonuç değildir. Normal ağdaki tarayıcı kabulünde eğitim DOM'u 0,62–0,72 sn'de oluştu; sahnenin hazır olması SwiftShader'da 4,37–16,53 sn arasında değişti. Bu nedenle sahnenin gerçek telefonda bir saniyede hazır olacağı söylenmez.

Tarayıcı kanıtları `out/first-visit/acceptance.json`, ekran görüntüleri ve `performance.json` altındadır. Yayınlama, yerel derleme ve tarayıcı kabulünden ayrı bir işlemdir; bu belge tek başına canlıya çıkıldığı anlamına gelmez.
