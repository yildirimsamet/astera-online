# Ödüller ve aktarım seçimi — 8 Ekim 2026

1. Aktarım seçimleri cihazda tutulur: yalnız cargoShips/otherShips için STAY/RETURN.
İlk açılışta mevcut RETURN/STAY varsayılanı kullanılır. Son seçim değiştirildiği anda
kaydedilir; ekran kapatma, yeniden açma ve sayfa yenilemede geri gelir. Filo, kargo,
hedef ve hız kaydedilmez. Bozuk/eksik kayıt veya kapalı/dolu storage oyunu durdurmaz.
Yeni kayıtta şema sürümü vardır. Yakıt, geri dönüş filosu ve hangar hesabı aynı planı
kullanmayı sürdürür. Ekranda kalıcı seçim de normal sefer gibi açıkça gösterilir.

2. Ödüller ui-v2 Gözlemevi diliyle yeniden kurulur. Veri ve ödeme sunucuda kalır;
ödül tutarları, hak kazanma ve sezon/hesap kapsamı değişmez. Kısa ödül kademesi
özeti, üstte topluluk bonusu, alınabilirler önce, hedef adı ve gerçek birimlerde
ilerleme, kaynak ikonlarıyla kesin tutarlar. Alınabilir bütün kademeler ve ilk
kilitli kademe görünür. Sonraki kademeler/aşılmış ödüller açılabilir ve açılım
useAccordion ile cihazda hatırlanır. Topluluk adımları yalnız henüz alınmamışsa;
hesap kapsamı alındığında açıkça belirtilir. Taşma uyarısı başkent verisine ve tek
ödüle dayanır. Bekleme, hata/tekrar dene ve boş durumlar aynı tasarım dilini kullanır.
Boş liste ödüllerin alındığı anlamına gelmez; hedef olmadığı söylenir ve yeniden
yükleme sunulur. Sayım ilerlemesi, alınmayı bekleyen eski hedefe değil ilk kilitli
hedefe göre gösterilir.

Risk/testler: kalıcılık ve yalnız tercih verisi; bozuk kayıt; okuma/yazma hatası;
tercihin mutation, yakıt ve boş başlangıçlara etkisi; her claimable görünür; katlama
sonrası erişim; server sonucu gelmeden ödendi denmemesi; pending ve hata; unknown
chain; full storage; altı dil, 350 px ve geniş ekran. Mevcut tests önce, davranış
regresyonları eklenip FAIL, ardından uygulama ve PASS. Görsel doğrulama için mevcut
v2 gallery kullanılır. Çalışma alanının önceki değişiklikleri korunur.

Görsel kontrol: `node tools/visual.mjs out/rewards-v2 --rewards`.
Altı dilde 350×812; hazır/tamamlanmış/boş 350×667; 430×932, 844×390,
1440×900 geçti. Kademe açılımı ve iki aktarım tercihi gerçek sayfa yenilemesiyle
kontrol edildi. Görüntüler ve ölçümler `out/rewards-v2/` içinde.
Tip kontrolü ve lint temiz; aktarım, ödül yüzeyi, ödül dikkat sinyali ve çevirilerde
151 ilgili test geçti. Genel test denemesinde kuralların 1.998 testi geçti;
sezon simülasyonundaki `TAX` bandı 0,0325 ile LOW kaldı. Bu arayüz değişikliğinin
dışındaki denge kuralı veya eşiği değiştirilmedi.
Tam web denemesi: 5.500 test geçti; yapı/gemi detayları, anıt bildirimi, Wiki
metadata ve korsan geri çağırma alanlarında bu işin dışında kalan 5 test kaldı.
Owner'ın son talimatı: ekonomi simülasyonu, snowball audit ve konu dışındaki
uzun testler çalıştırılmaz. Son doğrulama yalnız bu işin 151 ilgili testiyle,
lint/tip kontrolü ve ödül/aktarım görsel kontrolüyle yapılır.
