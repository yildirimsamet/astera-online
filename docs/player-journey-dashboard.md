# Oyuncu yolculuğu dashboard'u

Giriş: **Admin → Oyuncu yolculuğu**. Mevcut “Oyuncu davranışı” ekranı ayrıntılı
analitik kayıtları için korunur. Yeni yüzey yalnız admin erişimine açıktır ve
`ANALYTICS_ADMIN_ENABLED` ayarını kullanır.

Seçilen aralık **hesabın kayıt zamanıdır**. Bu hesapların ilerlemesi raporun
alındığı ana kadar izlenir. Varsayılan son 24 saat; son 4 saat, son 7 gün veya
son 30 gün içinde özel bir başlangıç/bitiş seçilebilir. Başlangıç dahil, bitiş
hariçtir. Bot ve admin hesapları dışarıda kalır.

## Okuma biçimi

- İlerleme haritası: her aşamaya ulaşan hesaplar. Aşamalar bağımsızdır. Önceki
  çubuktan çıkarılan fark bir terk oranı değildir.
- Ara verme noktaları: son doğrulanan ilerleme aşamasında, seçilen 30 dakika,
  1 saat veya 24 saat boyunca etkinlik kanıtı görülmeyen hesaplar.
- Süre dağılımı: yalnız oyun sahnesi hazır olduktan sonra gözlenen ön plan
  örnekleri. Aynı hesaptaki çakışan sekmeler birleştirilir. Eksik ve kısmi
  ölçümler histogram, ortalama ve medyandan ayrılır.
- Yeni oyuncu akışı: kayıt aralığında hesapların dağılımı.
- Görülen engeller: her engeli gören farklı hesaplar; aynı hesap birden fazla
  engelde bulunabilir.
- Bir çubuk seçilince oyuncu listesi süzülür. Oyuncuya dokununca son rehber
  adımı, rehberi kapatma durumu, son işlem/ekran ve son 20 olay açılır.

## Kaynaklar ve sınırlar

İlerleme ve manuel işlem kanıtları `vessels`, `vessel_orders`,
`vessel_missions` kayıtlarından gelir. Analitik ziyaret kimliği bulunmayan
işlemler de görülebilir. Bu, isteğe bağlı istemci ölçümünü yeniden açmaz.
Oynama süresi, görülen ekran, engel ve hata `analytics_events` gözlemleridir.
Ana galaksiye göçten sonra etkinlik `players.last_active_at` ile izlenir.

Son etkinlik; oyuncunun sunucu etkinliği, manuel işlemleri ve istemci
etkileşimlerinden çıkarılır. İşin çevrimdışı tamamlanması etkinlik sayılmaz.
Son etkinlik anında hâlâ bekleyen işler ayrıca gösterilir. Bu durum ayrılma
nedenini kanıtlamaz. Rehberi kapatmak oyunu bırakmak sayılmaz.

Sunucudaki etkinlik istemci gözlemini iki dakikadan fazla aşıyorsa süre kısmi
işaretlenir. Hazır sahne veya süre örneği eksikse süre bilinmiyor olmalıdır.
Gözlenen toplam ön plan gerçek toplamın altında kalabilir. Kaydı olmayan
zaman ilk ve son işlem arasındaki farkla doldurulmaz.

Bir rapor en fazla 500 hesap ve her olay/işlem kaynağından 20.000 kayıt işler.
Sınıra ulaşınca kısmi veri uyarısı gösterilir; aralık daraltılmalıdır. Ham
analitik saklama sınırı değişmez; geçmişte hiç kaydedilmemiş süre üretilemez.
Oyuncunun kesin çıkış anı ve bırakma nedeni bu kayıtlardan belirlenemez.

## Doğrulama

Model, API sözleşmesi, admin yetkisi, tarih sınırları, bot ayrımı, ölçümsüz
ilerleme, çevrimdışı tamamlanma ve grafik filtreleri hedefli testlerle doğrulanır.
Görsel kontrol: `node tools/visual.mjs out/player-journey --journey`.
Bu kontrolün yerel Vite adresi varsayılan `http://127.0.0.1:5201`;
`ASTERA_VISUAL_WEB` ile değiştirilebilir. Kontrol gerçek admin sekmesini sentetik
veriyle 350, 390 ve 1440 pikselde çalıştırır; üretimde hesap oluşturmaz.
