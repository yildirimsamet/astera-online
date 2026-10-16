# Eşzamanlı bağımsız savaşlar — ortak muhasebe adayı

**Durum: prototipten ayrı aday SHADOW sürümü2'ye bağlandı; ACTIVE açılışı engelli.**
Varsayılan ve mevcut sürüm1aynı. Yeni katsayı paylaşımının ana oyuna alınması
kullanıcı kararını bekliyor. Kanıt `.dev/honor-20261014/manual-simultaneous-audit.json`;
geçmişte yaşanmış bir savaş iddiası değil, aynı delilin yalnız kayıt-id sırası değişiyor.

| Aynı effective-ms, aynı gerçek sonuçlar | Şimdiki sıralı hesap | Ortak aday |
| --- | --- | --- |
| Karşılıklı eşdeğer 100+100 ham Honor | A66,67/D33,33 veya tersi | A50/D50 |
| Bir oyuncunun üç eşdeğer çatışmasında 2:1 ham katkı | Kayıt sırasına bağlı | 80/40 |
| Zayıf hedefe 1000+10000 zarar, önceki tekrar yok | Toplam −4 veya −2,875 | Toplam −3,4375 |

Savaşlar tek savaş hâline getirilmez. Her çatışmanın K/L, verimlilik, kendi
taraf havuzu ve katılım payı aynı kalır. Birlikte yapılan şey yalnız çiftin
azalan puan karşılığı, tekrar basamağı ve mevcut provokasyon bütçesi rezervasyonudur.

1. Aynı milisaniyedeki olayların uygun delilleri hazırlanır; bot/boş/dışarıda
   kalan olaylar puan/tekrar hakkı satın almaz.
2. Yalnız daha eski gerçek karşılık bütçesi, aynı yöndeki gerçek zararlar arasında
   orantılı ayrılır ve bir kez tüketilir. Yeni eşzamanlı zarar geçmişe dönüşmez.
3. Yönlü oyuncu çiftinin gerçek zayıf saldırıları işgal ettikleri tekrar
   basamaklarının katsayısını ortalama ile paylaşır. İlk iki eşzamanlı saldırı
   (1+1,5)/2=1,25; ilk üçü1,5. Sonraki olay geçmişteki gerçek olay sayısını görür.
4. Ortak negatif ceza bir kez yuvarlanır, tam mikroları sonuçlara paylaştırılır.
   Kayıp kesintisi indirimsiz kalır; sıfırda silinmez.
5. Çiftin pozitif ham havuzlarının artan karşılığı bir kez hesaplanır, gerçek
   ham tutar oranında çatışmalara gider. Her çatışmanın taraf payı yine kendi
   katılımcılarına verilir. Bağımsız çiftler birbirinin bütçesini kullanmaz.
6. Aynı ms'ye geciken yeni olay geldiğinde o ortak grubun sonuçları yeniden
   muhasebeleştirilir; eski raporun gösterimi journal'dan güncellenir. Aynı
   delil retry'ı yeni puan üretmez. Sezon kapanışı bekleyen sonuçları önce tamamlar.

Bu aday kayıt kimliğinin büyük bir puan avantajı yaratmasını kaldırır. Bölünmez
1 mikro-Honor remainder'ı deterministik paylaşılır; farklı kayıt-id yalnız bu
tozun sahibini değiştirebilir. Ayrı zamanlı hesap mevcut kuralla birebir aynı.

İzole RED→GREEN prototip11kontrol, tek worker/512MiB heap; ayrıca 20 çift /40
eşzamanlı olayda küçük/orta/büyük imha tutarlarıyla limit ve toplam korunumu
kontrol edildi. Uzun ekonomi/sezon simülasyonu veya gerçek gözlenmiş retention
sonucu değil. Aday SHADOW sürümünün gerçek DB testleri geçirildi:eşzamanlı
commit/retry/conflict rollback, iki insertion yönü, geç grup sonrası bağımlı
rebuild ve seal-öncesi flush. İki gerçek karşılıklı v18 raid de farklı callback
sıralarında ortak cap/ham katkı oranını korudu. Mevcut sürüm1aynı veride eski
sonuçlarını koruyor; aday2ACTIVE açılmıyor. İki farklı sürümün commitment'ları
karıştırılırsa retry/varış işlemi reddediliyor. Doğrulama ayrıntıları uygulama
kaydındadır; release tamamlandı veya kullanıcı politikayı kabul etti demek değildir.

Uygulama alanı: pure accounting zaman gruplaması, ledger'ın aynı-at rebuild
tetiklemesi ve rapor açıklaması. Yeni oyun kaynağı/saldırı komutu/ekonomi yok.
Prototip kodu referans davranışı gösterir; üretime kopyalanacak nihai mimari
veya performans ölçümü değildir.
