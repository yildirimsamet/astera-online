# Koloni geliştirmesi sonrası arıza koruması

Oyuncu talebi: kabul edilen her bina geliştirmesi, yalnızca o kolonide yeni arızaları
başlatıldığı andan itibaren en az 12 saat engeller. Tamamlanması gerekmez; sonraki
bina emri süreyi yeniler. Kuyruğa kabul de başlangıç sayılır. İptal korumayı geri almaz.

Sınırlar: ana gezegen, diğer koloniler, reddedilen emirler, gemi/uydu/cihaz üretimi,
araştırma ve onarım süreyi yenilemez. Mevcut arızalar onarılmaz. Koruma hem zamanlı
hem saldırı kaynaklı yeni arızaları engeller; savaşın diğer sonuçlarını değiştirmez.
Süre tam dolduğunda normal arıza kuralları yeniden geçerlidir. Var olan daha ileri
bir koruma tarihi kısaltılmaz. Koloni tarafsızlaşınca koruma sıfırlanır.

Değişiklik noktaları: kolonide kalıcı tarih ve migration; bina emrinin kabul edildiği
kilitli işlem; iki arıza kaynağının ortak kapısı; worker ertelemesi/yeniden teslimi;
gezegen yanıtı ve kolonide oyuncunun görebildiği süre/kural.

Doğrulama: bina tamamlanmadan koruma, ikinci koloni izolasyonu, yenileme, başarısız
işlem, mevcut arıza, saldırı, tam süre sınırı, eski/claim edilmiş event, yeniden
teslimde tek sayaç ve geçit altı koloninin daha sonra arızalara açılması.

## Doğrulanan sonuçlar

- Yeni koruma dosyasındaki 22 senaryo geçti; yedi bina türü, aynı oyuncunun ikinci
  kolonisi, iptal, tamamlanma, tam zaman sınırı ve eşzamanlı event teslimi kapsanır.
- Arıza yaşam döngüsü ve saldırı testleriyle ilk turda 70 test geçti. Daha geniş
  bina kuyruğu/ticaret turunda 84 test, HTTP ve savaş entegrasyonunda 5 test geçti.
- İstemci geri sayımı, sürenin yenilenmesi/aşılması ve altı dil anahtarları kontrol
  edildi. 350/1280 piksel Türkçe/İngilizce görsel kontrolleri geçti.
- Tüm paketlerin tip denetimi geçti. Genel test turunda rules: 134 dosya / 2360
  test geçti; server: 319 dosya / 4088 test geçti, 5 dosyada 13 test başarısız.
  Hatalar bu korumayla ilgili değil: galaxy/intel beklentilerindeki `vacation`
  alanı (2), stratejik saldırı tier fixture'ları (8), worker scheduling testlerinin
  sahte veritabanıyla vacation olay kapısını çalıştırması (3). Genel sonuç yeşil
  olarak raporlanamaz. Ayrıntılı günlük: `out/colony-fault-protection/ordinary-all.log`.
- Lint üç ardışık grupta tüm çalışma alanını kapsadı. Sunucu grubundaki test
  ifadeleri düzeltildikten sonraki son tekrar dâhil üç grup da geçti.
- Son genel istemci turu: 486 dosya / 6425 test geçti; 4 dosyada 5 hata,
  29 atlanan test var. Hatalar menü acil eylem sayısı (2), klan destek bildirimi (1),
  Japonca tatil metninin sözcük filtresi (1), tatil ekranındaki `text-xl` sınıfı (1).
  Bu değişiklikten bağımsızlar; genel doğrulama bütünüyle yeşil değil.
  `out/colony-fault-protection/web-all.log` tam sonucu içerir. Ticaret Gemisi'nin
  eski “geri çağrılamaz” kuralını bekleyen Japonca test yeni kurala uyarlandı ve geçti.

Migration: `0173_colony_fault_protection.sql`. Canlı veritabanına uygulanmadı ve
canlıya dağıtım yapılmadı. Yeni tarih başlangıçta null; koruma yeni kabul edilen
bina emirleriyle kazanılır, geçmiş geliştirmelere geriye dönük süre verilmez.

## 16 Ekim: tatil incelemesinin düzeltme kapsamı

Doğrulanan eksik: `shiftClocks`, arıza korumasının tarihini kaydırmıyordu. Diğer
kişisel süreçler dururken 12 saatlik koruma tatilde tüketiliyordu.

Gereksinim: tatil girişinde yalnız gelecekteki koruma tarihini tatil süresi kadar
ileri taşı; erken dönüşte kullanılmayan tatil süresini geri al. Süresi dolmuş/null
korumayı yeniden başlatma. Başka oyuncunun kolonisini etkileme. Aynı bitirme
isteğini tekrarlamak süreyi tekrar kaydırmamalı. Normal bitiş ve geç girişte
oyuncunun kalan koruması yalnız aktif geçen süre kadar azalmalı.

Dokunulan yerler: tatilin mevcut tarih kaydırma işlemi; koloninin koruma sayacı ve
altı dilde duraklama metni. API veya migration gerekmiyor. Sunucu testleri normal,
erken/geç dönüşü, süre sınırını, null/bitmiş korumayı ve sahiplik sınırını; arayüz
testi tatilde sabit kalan sayacı ve tatil bitince tekrar akmasını doğrulayacak.

Uygulandı: `faultProtectedUntil`, mevcut `future(...)` tarih kaydırmasına eklendi.
Arayüz, tatil aktifken koruma bitişinden tatil bitişini çıkararak kalan süreyi sabit
gösteriyor; tatil sona erdiğinde aynı sunucu tarihinden geri sayım devam ediyor.
Duraklama metni altı dilde eklendi. Mevcut bitmiş/null koruma yeniden başlamıyor.

Testler önce hatayı gösterdi: normal/erken/geç dönüşün üçünde de tarih yanlış
kalıyordu; istemci de duraklama göstermiyordu. Düzeltmeden sonra 14 tatil testi,
22 koruma testi ve 27 arıza yaşam döngüsü testi geçti. İstemcide yedi dosyadaki
148 farklı test geçti; tatil ve onarım ekranları ile altı dil anahtarları dahil.
Günlükler: `out/fault-vacation-fix-2026-10-16/`.

Genel tip kontrolünde çalışma alanındaki yeni `TacticalStock` bileşeninin durum
anahtarları `string` olarak genişliyordu. Yalnız bu yerel dizinin tipi geçerli dört
durumla sınırlandı; bileşenin davranışı değiştirilmedi.

Son doğrulama: tüm paketlerin tip denetimleri ve üç lint grubu geçti. İlk görsel
tur çalışma alanındaki eşzamanlı Vite yenilemesinden etkilendi; yalnız test
tarayıcısında HMR bağlantısı kapatılarak tekrarlandı. Son turda 350/1280 piksel,
Türkçe/İngilizce dört görsel senaryo geçti; tatilde kalan 12 saat zaman ilerlerken
sabit kaldı. Yeni migration veya canlıya dağıtım yapılmadı. Önceki genel test
turunun kapsam dışı hataları yukarıda ayrıca kayıtlıdır.
