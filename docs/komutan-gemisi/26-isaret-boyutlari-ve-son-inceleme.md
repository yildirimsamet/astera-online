# Galaksi işaretleri ve son inceleme — 2026-11-10

## İşaret boyutları

Sahibin talebi: yabancı gezegenlerin turuncu üçgenleri, nötrlerin gri üçgenleri ve
kapalı gözler mevcut boyutlarından **2 CSS px** küçülür. Yakın/uzak görünümdeki
kesintisiz mesafe hesabı korunur. Üçgenin yüksekliği ve genişliği ayrı hesaplanır;
her iki eksende azalma 2 px'tir. Sahip olunan dünyaların işaretleri değişmez.

`planetMarkerLayout` bu boyutları simgelerin konumları ve etiket aralıklarıyla birlikte
üretir. Kapalı göz küçültmesi bu yerleşimde uygulanır; `eyeMarkerScale` kullanan
koloni arıza rozeti eski boyutunu korur. Gezegenin seçim alanına dokunulmaz.

Gerçek `GalaxyView` sahnesinde turuncu/gri üçgenler ve bilinmeyen/hatırlanan dünyaların
gözleri, kamera uzaklığı 12/80/400 ayarlanarak önce/sonra ölçüldü. Son uzaklık kontrolün
270 sınırına takılır; ölçüm gerçek kamera derinliğini kullanır. Her eksende beklenen
azalma için tolerans 0,03 px. Kanıt: `out/planet-marker-size/{before,after}-*.png`,
`proof.json`. Komut: `WEB=http://127.0.0.1:5297 node tools/visual.mjs out/planet-marker-size --planet-marker-size`.

## İnceleme: bulgu → doğrulama → düzeltme

İki taktik, ağ/protokol, takım kaydı, kaynak/kaya yerleşimi, galaksi modeli/materyali,
egzoz, inceleme sayfası ve işaretlerin ortak çağrıları gözden geçirildi.

| Doğrulanmış bulgu | Düzeltme ve regresyon kanıtı |
| --- | --- |
| Takım seçimi satın alınan yetenek puanlarını almıyordu; kartlarda yanlış süre/bekleme gösteriyordu. | Takım yanıtı yalnız soran oyuncunun kendi puanlarını içerir; istemci şeması ve seçim bileşeni bunları taşır. `arena-teams`, `team-panel` testleri. |
| İnceleme sayfasında zaten seçili sınıf/görünüme basmak yükleniyor yazısını kalıcı bırakıyordu. | Aynı seçime yeniden yükleme başlatılmaz. `commander-presence-gallery` testi ve gerçek tarayıcı akışı. |
| Filo görünümünde kamera sıfırlama yakın inceleme kadrajına dönüyordu. | Sıfırlama mevcut görünümün kadrajını kullanır. Yakınlaştırma/kaydırma sonrası regresyon testi. |
| Egzozun kapalı ucunda iki sıfır normal vektörü shader hesabını belirsiz bırakıyordu. | Sıfır normal yalnız kuyruk yönüyle tamamlanır; bütün normaller sonlu ve birim uzunlukta. `commander-appearance` testi. |
| Ortak göz ölçeğini küçültmek yakın mesafedeki koloni arıza rozetini de etkiliyordu. | Küçültme kapalı gözün yerleşimine taşındı; ortak ölçek korunur. `planet-marker-layout`, `galaxy-fault-icon` testleri. |
| İkinci taktik düğmesi mobilde joystick'in boşta duran halkasına birkaç piksel giriyordu. | Düğme 15 px yukarı alındı; gerçek 350 px ekranda halka/düğme ayrılığı görsel denetimde ölçülür. |

Her davranış hatası için önce başarısız regresyon testi görüldü, ardından düzeltildi.
Önceki uygulama kontrollerinde bulunan C/çarpışma kısayolu çakışması ve misafir sonraki
uçuşunda ikinci taktik kaybı da düzeltilmiş ve testlenmişti; bkz. [24](24-iki-taktik-ve-manevra-kayalari.md).

İnceleme sonunda otomatik kontrollerin dışında kalan kabul: iki insanla PvP'de dairesel
takibin azalması ve fiziksel Android cihazında kontrol rahatlığı/performans. Bu sonuçlar
otomatik solo tarayıcı denemesinden çıkarılamaz. Canlıya yayın yapılmadı; iki taktik
migration'ı ve protokol 16 için istemci/arena sunucusu birlikte güncellenmelidir.
