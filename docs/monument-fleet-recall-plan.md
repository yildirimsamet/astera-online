# Anıta giden filonun geri çağrılması

## Gereksinim ve mevcut durum

Anıta giderken oyuncu filosunu haritadaki filo odağından, uçuş listesinden ve
Filo ekranından geri çağırabilmeli. `recallMonument` zaten OUTBOUND/HOLD için
seçili fiziksel gemileri mevcut konumlarından döndürüyor. Eksik bağlantı,
`monumentPendingThreads` çıktısının geri çağırma verisi taşımaması ve ortak
`useRecallFlight` işleminin yalnız normal görev/korsan uçuşlarını yönlendirmesi.

## Kapsam ve regresyon riskleri

- Anıt uçuş projeksiyonu, ortak geri çağırma girdisi/işlemi, uçuş listesi,
  harita odağı ve Filo ekranı güncellenecek.
- Mevcut anıt geri çağırma servisi kullanılacak; savaş, hasar, yakıt, kargo,
  kısmi geri çağırma ve dönüş süresi kuralları değişmeyecek.
- Tek tıkla uçuşta kalan tüm fiziksel gemiler seçilecek. Kısmi geri çağırma
  anıtın mevcut ayrıntı ekranında kalacak.
- Anıtın dönüş tahmini kullanılacak; normal uçuşun simetrik süre varsayımı
  anıt filosuna uygulanmayacak.
- Başarılı işlem anıtlar, gezegenler, uçuşlar ve harita verilerini yenilemeli.
- Normal filo, korsan ve madenci geri çağırma yolları korunmalı.

## Test durumları

- OUTBOUND saldırı ve takviye filoları: bütün filoyu geri çağırma niyeti sabit
  idempotency anahtarıyla anıt adresine gönderilir; sunucu güncel yaşayan
  lotları doğru sayılarla seçer.
- RETURNING/HOLD uçuş satırları, varış anı/geçmiş varış, tamamen kayıp filo
  ve sondalar ortak uçuş geri çağırması sunmaz.
- Harita odağı, uçuş listesi ve Filo ekranı aynı anıt girdisini kullanır.
- İstek sürerken tekrar tıklama engellenir; hata görünür olur; başarısızlıkta
  filo istemcide dönmüş gibi gösterilmez.
- Başarıda ilgili önbellekler geçersizleşir; mutasyon yeniden denenirse aynı
  idempotency anahtarı kullanılır.
- Mevcut sunucu testleri: gerçek ara konum, hasar/kargo korunumu, yabancı
  filo/lot reddi, yarışma, geç varış, eski olay ve çift teslim güvenliği.

## Doğrulama

Önce regresyon testleri FAIL, sonra uygulama ve aynı testler PASS. Ardından
tek workspace/tek Vitest worker ile ilgili sunucu testleri ve bütün olağan
testler, typecheck ve lint. Uzun ekonomi/sezon simülasyonları kapsam dışı.
Değişen yüzeyler 350 px mobil ve masaüstünde görsel olarak kontrol edilecek.

## Uygulama ve ilk sonuçlar

`flightRecallInput` üç yüzeyin aynı geri çağırma girdisini üretmesini sağlıyor.
Anıt girdisi bütün filoyu geri çağırma niyetini taşıyor; `useRecallFlight`
bunu dalga kimliğinden türetilen sabit anahtarla mevcut anıt servisine iletiyor.
Servis hasar hesaplandıktan sonra yaşayan fiziksel lotları seçiyor. Anıtlar ve ilişkili
gezegen/uçuş/harita okumaları yalnız başarılı yanıttan sonra yenileniyor.

Regresyon testleri önce 7 FAIL verdi; uygulamadan sonra ilgili 71 test PASS.
Kurallar paketindeki 111 dosya / 2.026 test PASS. Türkçe ve İngilizce,
350 px ve 1280 px, üç yüzeyde toplam 12 görsel senaryo PASS; ekran görüntüleri
ve istek ölçümleri `out/monument-recall/` altında.

Genel web testlerinde `focus-clocks.test.tsx` içindeki gerçek saat yarışı
yakalandı: render sırasında `9m 00s`, birkaç ms sonraki beklentide `8m 59s`.
Test sabit saat kullanacak şekilde düzeltildi; bir saniye ilerletilince canlı
sayacın güncellendiği de doğrulanıyor. Oyun saati veya sayaç uygulaması değişmedi.

Ortak `astera_test` veritabanının `accounts.first_game_shield_available`
kolonu eksikti. Sunucu testleri için ayrı, sıfırdan migration uygulanmış bir
`astera_monument_recall_*_test` veritabanı kullanıldı ve testler bittikten sonra
silindi. Sunucu paketinin 212 dosyası / 3.145 testi PASS (1 mevcut skip).
Web paketinin tam tekrarında 413 dosya / 5.678 test PASS (1 dosya / 29 test
mevcut skip). Üç pakette toplam 10.849 olağan test PASS.
Dört workspace'in son typecheck kontrolü, kök `pnpm lint` ve
`git diff --check` PASS. Kontroller tek workspace / tek worker ve `nice -n 10`
ile sırayla çalıştırıldı. Uzun ekonomi/sezon simülasyonları çalıştırılmadı.
Bu görev kapsamında oyun veritabanı veya mevcut migration dosyaları
değiştirilmedi.

## CR bulgularının doğrulanması ve düzeltilmesi

Geçici regresyon testlerinde dört durum FAIL olarak yeniden üretildi: UUID
desteği olmayan ortamda render hatası, kayıp yanıttan sonra değişen istek
anahtarı, radyasyonda yok olan bir lot yüzünden bütün geri çağırmanın reddi ve
uçuş sürerken sabit kalan dönüş tahmini. Mevcut ilgili 52 test PASS kaldı.
Gemi kaybı durumu ayrıca gerçek HTTP/PostgreSQL akışında doğrulandı.

- Ortak uçuş işlemi `{ all: true }` niyetini gönderiyor. Sunucu, hasar
  hesaplandıktan sonra kilit altındaki yaşayan lotları seçiyor. Mevcut açık
  seçimli/kısmi geri çağırma sözleşmesi korundu.
- Bir anıt dalgası yalnız bir kez tamamen dönebildiğinden, bu işlem dalga
  kimliğinden türetilen sabit bir anahtar kullanıyor. Render sırasında UUID
  üretimi gerekmiyor; yeniden render, tekrar tıklama ve yeniden açılış aynı
  gövdeyi ve anahtarı taşıyor.
- Dönüş tahminine gerçek dönüş noktasının konumu ve etkili filo hızı
  eklendi. İstemci yol üzerindeki güncel konumu sunucu saatiyle ilerletip
  ortak seyahat kurallarıyla canlı süre gösteriyor; eski yanıtlar mevcut
  tahmini okuyabiliyor.
- Regresyonlar: kayıplı ve tamamen kayıp filo, yabancı dalga, eşzamanlı
  istek/yanıt tekrarı, geçersiz/çelişkili gövde, kısmi geri çağırmanın korunması,
  UUID olmayan ortam, yeniden render ve ikinci istemci örneği, sıfır mesafe,
  farklı dönüş noktası/hızı ve canlı süre.
- Önce kalıcı regresyonlar FAIL, sonra uygulama PASS. Olağan testler,
  typecheck/lint ve üç yüzeyin mobil/masaüstü görsel kontrolleri sırayla
  çalıştırıldı. Sunucu testleri ayrı `_test` veritabanını kullandı.

Kalıcı testlerin ilk çalışmasında web 7 FAIL / 1 PASS, sunucu 5 FAIL / 27 PASS
verdi. Gerçek HTTP senaryosunda eski seçim `BAD_MONUMENT_RECALL` verirken,
aynı kayıp anında bütün filo niyeti yalnız yaşayan ARGOSY gemilerini, hasar
ve yükleriyle döndürüyor. Uygulama sonrası yeni web regresyonlarının 8'i ve
sunucu regresyonlarının 5'i PASS. Eşzamanlı/sonraki yanıt tekrarları aynı
JSON değerini döndürüyor; JSONB'nin anahtar sırası bir sözleşme değil.

CR düzeltmelerinden sonra tam olağan test taraması: kurallar 111 dosya /
2.026 test, sunucu 212 dosya / 3.150 test, web 414 dosya / 5.686 test PASS.
Toplam 10.862 test PASS; sunucuda 1, webde 29 mevcut test atlandı.
Uzun ekonomi/sezon simülasyonları çalıştırılmadı. Bu tur için oluşturulan
ayrı `astera_monument_recall_fix_*_test` veritabanı tam taramadan sonra silindi.

Son dört-workspace typecheck, kök `pnpm lint` ve `git diff --check` PASS.
UUID desteği kapalı gerçek tarayıcıda Türkçe/İngilizce, 350/1280 px ve
Filo/uçuş listesi/harita odağı kombinasyonlarının 12'si PASS. Filo ekranında
önbellek yenilenmeden 30 saniye ilerleyen dönüş tahmini ayrıca doğrulandı.
Görsel araç açılış animasyonunun bitmesini bekliyor ve geri çağırma butonunun
tamamen görünür alanda olduğunu denetliyor. Son ekran görüntüleri ve istek
ölçümleri `out/monument-recall-fix/` altında; uçuş listesinin ve harita odağının
son görüntüleri gözle de kontrol edildi. Geçici Vite sunucusu kapatıldı.
