# Döteryum rafinerisi son seviye bildirimi

Kök neden: sunucu ve ortak kurallar Sentez 5 → Rafineri 15 sınırını doğru uygular.
`useBuildingAction` geçici araştırma engeli ile kalıcı son seviyeyi ayırmadığı için
oyuncuyu var olmayan Sentez 6'ya yönlendirir. Araştırma tavanı testleri mevcut;
rafineri arayüzü testlerinde son seviye kapsamı eksiktir.

Beklenen davranış ve regresyon kapsamı:

- Rafineri 0, araştırma 0: araştırma gerekir.
- Araştırmanın ara sınırları: bir sonraki Sentez seviyesine yönlendirme korunur.
- Rafineri 14, Sentez 5: Çekirdek yeterliyse 15'e yükseltme açıktır.
- Rafineri 15 ve üzeri: son seviye; araştırmaya/Çekirdeğe yönlendirme ve 16+ önizlemesi yoktur.
- Kuyrukta 15'e yükseltme varsa: başka bir yükseltme sunulmaz; kuyruk görünür kalır.
- Son seviye, Çekirdek engelinden ve dolu kuyruktan önce değerlendirilir.

Dokunulan yerler: gezegen bina eylemi ve rafineri kartı, üretim kazanımı,
öğe detayındaki gelecekteki seviyeler. Sunucu, fiyatlar, üretim formülleri,
araştırma/seviye sınırları değişmez. En büyük regresyon riski alt seviyelerin
yanlışlıkla tamamlanmış sayılmasıdır; sınırın altı ve ara araştırma engelleri test edilir.

TDD: önce arayüz/kazanım/gelecek seviye regresyonlarını çalıştırıp hatayı doğrula;
ardından düzelt, ilgili testleri ve standart kontrolleri sırayla çalıştır.

CR bulgusu: son yükseltme henüz kuyruktayken detay panelinin altı tamamlanmış
gibi görünüyordu. Önce bu durumun testi kırmızı görüldü; terminal eylem metninde
kuyruk bilgisine öncelik verilerek düzeltildi. İlgili 150 test geçti.

Görsel kontrol: `node tools/visual.mjs out/refinery-ceiling --refinery-ceiling`.
350/1280 px, Türkçe/İngilizce, seviye 14/15; kart ve detay paneli görüntülenir,
gelecek seviyeler ve taşma ölçülür.

Son doğrulama: ilgili üç dosyada 150/150 test, 8/8 görsel senaryo, web tip
kontrolü ve değişen sekiz kod/test/aracın lint kontrolü geçti. Kullanıcının
talimatıyla tüm test paketi çalıştırılmadı.
