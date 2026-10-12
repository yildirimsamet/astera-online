# Bireysel akın bekleme süresi

Owner kararları (2026-10-12): Taraflardan biri kademe 1–3 ise aynı komutana
bireysel akın, gerçekleşen savaştan itibaren 12 saatte bir yapılabilir. Yönler
bağımsızdır; bütün koloniler birlikte sayılır. İki taraf 4+ ise mevcut 3/12 saat
kuralı sürer. Kademe yeni gönderimde okunur. Geri çağrı veya savaşsız dönüş süre
başlatmaz. Ölüm Yıldızı ve ortak klan operasyonları yeni sınırın dışındadır;
mevcut klan kotası ve ortak savaşın kişisel kotayla ilişkisi korunur.

Uygulama: savaş raporunun gerçekleşme zamanı beklemenin kaynağıdır. Aynı komutana
henüz savaşmamış bireysel akın varsa ikinci gönderim engellenir. Kontrol oyuncu
çifti yönünde kilitlenir; farklı kolonilerden eşzamanlı gönderim sınırı aşamaz.
Yeni veritabanı tablosu veya sayaç eklenmez. Sunucu ret mesajı bitiş zamanını
taşır; hedef açıklaması, yerelleştirilmiş hatalar ve Wiki aynı kuralı anlatır.

Etki alanı: bireysel akın gönderimi, ortak sabitler, oyuncu metinleri. Ortak
klan saldırı kontrolü, stratejik silah gönderimi ve savaş çözümü değişmez.
Riskler: ortak görevlerin bireysel sayılması, uçuş süresinin beklemeden düşmesi,
gezegen değiştirerek sınırın aşılması, eşzamanlı istekler, tam süre sınırı.

TDD: düşük/yüksek kademe eşleşmeleri, savaş anı + 12 saat sınırı, iki yön,
koloniler, geri çağrı, savaşsız yok olma, eşzamanlı gönderim, kademe yükselmesi,
ortak klan ve Ölüm Yıldızı istisnaları. Ardından normal proje doğrulamaları;
uzun ekonomi simülasyonları kapsam dışındadır.

Doğrulama: 22 yeni sunucu senaryosu ve 138 ilgili regresyon testi geçti. Yeni
hata mesajlarının 7 testi, 90 yerelleştirme testi ve 28 kademe aralığı testi
geçti. `tools/visual.mjs --wiki` ve hedef paneli kontrolü Türkçe 350 px mobilde
ve İngilizce masaüstünde tamamlandı; yeni metinlerde taşma görülmedi. Bu iş yeni
veritabanı migration'ı gerektirmiyor.

CR düzeltmesi: Yoldaki akının hedef kolonisi el değiştirirse bekleyen saldırı
kontrolü gönderim anındaki kayıt yerine koloninin güncel sahibini izlemeli.
Yeni sahibin başka gezegenine ikinci akın engellenmeli; eski sahibin gezegenine
gönderim serbest kalmalı. Geri çağrı yeni sahibin hakkını da serbest bırakmalı.
Regresyonlar mevcut ve klan öncesi kural sürümlerini kapsar. Değişiklik yalnızca
bireysel akının bekleyen görev sorgusundadır; geçmiş savaşların bekleme süresi,
klan kotaları, sahiplik devri ve savaş çözümü değişmez.

CR doğrulaması: Eklenen 5 sahiplik devri regresyonunun 3'ü düzeltmeden önce
beklenen sebeple başarısız oldu. Güncel sahibin doğrudan kontrol edilmesiyle
27 bireysel akın testi ve 138 ilgili saldırı/geri çağrı/klan/Ölüm Yıldızı/
radyasyon regresyonu geçti (7 dosyada toplam 165 test).

Son kontrol: Sunucu tip kontrolü radyasyon aralığının genel dizi olarak
çıkarılması ve anıt dönüş hesabına geniş `HullId` verilmesi nedeniyle kırıldı.
Owner bu sorunların da giderilmesini istedi. Aralık açık iki elemanlı tuple
olarak tanımlanacak; dönüş hesabı mevcut doğrulanmış mobil gemi kataloğunu
kullanacak. Oyun kuralı veya sayılar değişmeyecek. Başarısız tip kontrolü
görüldükten sonra tip kontrolü, radyasyon ve klan/anıt dönüş regresyonları
yeniden doğrulanacak.

Son entegrasyon turunda farklı çıkış kolonileri testi bir oyuncu kilidi
deadlock'u verdi. PostgreSQL kaydı ve sahiplik devri kodu incelendi: fixture
koloniyi aktarırken `statsOwnerPlayerId` alanını eski sahibinde bırakıyordu.
`loadLocked` bunu onarırken ek foreign-key kilidi alıyordu; gerçek
`transferPlanetControl` iki sahip alanını birlikte yazar. Fixture sahip alanları
ve çıkıştaki gemilerin sahibi tutarlı hâle getirildi. Tek başarılı gönderim ve
diğerinin `PERSONAL_RAID_PENDING` ile reddi beklentileri korunur.

Tip düzeltmelerinden sonra 66 radyasyon/yakıt kural testi, 93 ortak anıt
saldırısı/klan katkısı/klan geri çağrı testi ve 5 hedef radyasyonu entegrasyonu
geçti. Geniş kontrolde anıt yakıtı test dosyasında bu değişikliklerle ilişkili
olmayan iki hata görüldü (disk dışı ev için rezerv ve önbellekteki servet
yuvarlaması); bu akının kapsamı dışındadır. Genel lint çalışması da anıt
dosyalarında 13 hata verdi. Bu sonuçlar genel repo doğrulaması yeşil olarak
sunulmaz; bu düzeltmede değişen dosyalar ayrıca doğrulanır.

Nihai doğrulama: Fixture düzeltmesinden sonra 7 dosyadaki 165 ilgili sunucu
testi yeniden geçti. Ortak kurallar, sunucu ve istemci tip kontrolleri temiz;
istemci varsayılan Node heap'ini aştığı için 6 GB heap ile doğrulandı. Değişen
`personalRaid.ts`, `personal-raid-cooldown.test.ts`, `clanWar.ts` ve
`radiation.ts` dosyaları `pnpm lint --stdin --stdin-filename ...` ile ayrı ayrı
kontrol edildi; hata yok. `git diff --check` temiz.
