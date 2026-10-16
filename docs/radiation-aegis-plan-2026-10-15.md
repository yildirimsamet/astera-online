# Gezegen radyasyon koruması ve 30 dakika bomba

Owner talebi: bomba hasar seviyeleri 9 / 12,5 / 18 HP/dk korunur, her isabetin bağımsız etkisi 30 dakikaya iner. Aegis her aktif seviyede gezegende 1 HP/dk azaltır; sıfır canlı Aegis korumaz, en az 1 HP yeniden biriktiğinde korur. Araştırma yalnız gemiye ait yüzde korumadır; evde gezegen korumasıyla birleşir, anıtta yalnız geminin koruması kalır.

Hesap sırası: kaynakların toplamı → 50 HP/dk üst sınır → aktif Aegis seviyesini çıkar (en az 0) → geminin kendi radyasyon araştırmasının çarpanı. Aegis koruması home/dock, savunma desteği ve STAGED havuzuna bulunduğu gezegende uygulanır. Destek/havuz gemileri kendi komutanlarının araştırmasını kullanır. Anıt, uçuş, kazıcı ve kara savunmasının mevcut kapsamı korunur. Honor yalnız gerçekten alınan hasardan hesaplanır.

Kesin owner kararları: normal savaşta sıfırlanan Aegis doluma 15 dakika sonra başlar. Aegis bütün radyasyon hasarını engelliyorsa tamirhane çalışır; kalan doz sıfırın üstüne çıkarsa kapanır ve devam eden onarım tam iade ile iptal olur. EMP'nin daha uzun 60 dakika engeli korunur. Normal dolum beklemesi ground savunmasını kapatmaz.

Ek owner açıklaması: Aegis radyasyon kaynağını silmez. Yeşil duman, ham toplam radyasyon ve her kaynağın bağımsız süresi koruma dozu tamamen sıfırladığında da görünür. Aegis 10 + tek L1 = kaynak 9 / gemiye 0; ikinci L1 = kaynak 18 / araştırma öncesi 8 HP/dk.

UI: gemi üretim sheet'inde tüm statlara mevcut stile uygun ikon/renk; gemi radyasyon koruması yüzde, bilgi düğmesinde araştırma adı/seviyesi ve yerden bağımsız gemi kapsamı. Kazıcı/kara savunması bağışıklığı doğru gösterilir. Base'de ayrı gezegen koruması HP/dk (0 dahil), Aegis kaynağı/seviyesi ve sıfır can/dolum beklemesi açıklaması. Aegis upgrade sheet'i, radyasyon göstergesi, araştırma ve ilgili Wiki metinleri aynı kuralı anlatır. Yalnız hover açıklaması kullanılmaz. Ortak radyasyon simgesi belirlenir.

Riskler ve doğrulama:
- Hasar tüm zaman aralığının sonundaki Aegis'e göre hesaplanamaz: 0→1 HP eşiği, EMP ve bekleme bitişi, upgrade/core değişimi gerçek sınırında ayrılır.
- Settlement, read-only projeksiyon, geç varan gemi, ölüm timer'ı ve Honor aynı azaltılmış profili kullanmalı; düşük/0 doz timer döngüsü yaratmamalı.
- Normal savaş / klan savaşı / nötr gezegen / EMP / sahiplik değişimi / tatil lazy economy ve istemci shield projeksiyonu tutarlı kalmalı.
- 30 dakika testleri gerçek source expiry'yi doğrulamalı; doğal kaynakların tarihsel pencereleri veya bomba üretim süreleri değişmez. Güncel üretim süreleri L1≈36,6, L2≈54,9, L3≈73,1 dk; bütün seviyeler tam 1 saat değildir.
- TDD: önce süre, azaltma/sıra, sıfır/1 HP ve zaman sınırı, gemi/base bilgi testleri RED; sonra uygulama GREEN. Telefon 350px ve masaüstü, altı dil, gerçek UI görsel kontrolü.
- Master'da çalışma; diğer yerel task değişiklikleri korunur. Canlı migration/aktivasyon/deploy yok.

Doğrulanmış ek bulgular:
- Gecikmiş Core/Aegis işi çözülmeden radyasyonun o tarihten sonrasını kalıcı hesaba yazması engellenir. Aegis donanımı gerçek readyAt zamanında uygulanır; eski ve yeni koruma dönemleri ayrılır.
- Haritada seçilen kendi gezegeninin kadranı, o gezegenin korumasını WorldProvider verisinden alır. Kaynak 9 HP/dk kalırken gemi dozu 0 olabilir; başka gezegenin Aegis’i ödünç alınmaz.
- 0171 migration’ına ait snapshot tamamlandı. Sonraki 0172 trade migration’ında yeniden üretilen Aegis DDL’si çıkarıldı; trade sütunları korundu. Öncesi /tmp/astera-aegis-migration-backup-20261015-1930 altında yedeklendi. Migration çakışması gerçek testte RED verdi; düzeltilmiş zincirin regresyonu tekrar çalıştırılıyor.

İlk toplu kontrol: 6 sunucu dosyası / 66 test, 4 web dosyası / 137 test, 2 rules dosyası / 17 test PASS. Bunlar kapsam genişletilmeden önceki sonuçlardır; son kapanış güncel kontrollerden sonra yazılacak.

Tamamlandı: 30 dakika etki, Aegis koruması ve bilgi arayüzleri uygulandı; ayrıntılı CR bulguları doğrulanıp düzeltildi. Son owner düzenlemesiyle Ölüm Yıldızı ve üç radyasyon bombasının yeni üretimi Core 13 ister. Önleme Ağı iki seviyedir: başlangıç 2, L1 4, L2 6 şarj. Mevcut stok/uçuş korunur; araştırma hazır şarj vermez. Güncel test, temiz DB migration, altı dilde mobil/masaüstü görsel, ilgili lint ve üç workspace tip kontrolü sonuçları `radiation-aegis-review-2026-10-15.md` belgesindedir. Canlıya uygulanmadı.
