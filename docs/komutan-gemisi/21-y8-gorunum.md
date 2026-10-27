# ERTELENDİ · aşağıdaki Y8 kaydı tarihçedir

Sahibin son talimatıyla skin ekleri aktif uygulamadan geri alındı. Güncel kapsam ve kabul:
[22](22-ilk-surum-mantigi.md). Aşağıdaki testler ve tamamlandı ifadeleri önceki prototipi
anlatır; bugünkü aktif özellik durumu değildir. Yerel yedek korunur.

# Y8 · Gemi görünümü

24 Ekim 2026 · görünüm/kostüm hattı ve otomatik doğrulama tamam; ayrı modüler sanat ve fiziksel cihaz kabulü açık.

## Kapsam ve kabul

- Kullanıcı Y8'i başlattı: seviyeye bağlı 1/5/10/15/20 görsel kademeler, boya/desen,
  amblem/motor görünümü, hangarda önizleme ve seçim. Güç, görünürlük avantajı ve vuruş
  alanı değişmez. Görsel kademe doğrudan gemi seviyesinden gelir; satın alınamaz.
- Mevcut sınıf modelleri birleşik mesh ve üç uzaklık ayrıntısından oluşuyor. Görünüm,
  bu hazırlanmış modellerin ölçüsünü, geometri/collider verisini ve silah çıkışını korur.
  Aynı görünüm hangar, kendi uçuşu, rakip, illüzyon ve uzak gemi çiziminde kullanılmalı.
- Katalog/hesap envanteri, sahiplik ve iade/geri alma denetimi mevcut kozmetik hattındadır.
  Yeni boya ürünlerinin gerçek satış fiyatı ve sağlayıcı ürün eşlemesi uydurulmaz;
  mevcut Polar/Shopier yapılandırmasıyla sunulur. Yapılandırılmamış ürün satın alınamaz.
- Önizleme sahiplik veya seçimi değiştirmez. Kaydetme sunucuda doğrulanır. Uçuşta/takımın
  hazır kadrosunda görünüm değiştirmek mevcut uçuşun görünümünü değiştiremez.
- Hazırlık, kalkışta dondurulmuş görünümü tutar; oturumdan gelen sahte boya/seviye/ürün
  hakları kabul edilmez. İade edilmiş haklar sonraki kalkışta varsayılan görünüme döner.
- Materyal/texture/LOD paylaşımı bozulmaz; yeni görünüm model başına sınırsız shader,
  malzeme veya uzak gemi draw-call çoğalmasına neden olmaz. Eski hesaplarda görünüm
  varsayılanına düşer. Eski stok/ilerleme/takım davranışları korunur.

## Etkilenen zincir ve test planı

Pure görünüm/kademe kuralları + kozmetik katalog → hesap ekipmanı/sahiplik → hangar ve
kalkış yükü → sunucu roster/illüzyon → ağ sınırı → hangar/flight materyali ve uzak instancing.

Önce seviye eşikleri, geçersiz değer, geometri/stat değişmezliği; sonra sahiplik/iptal,
envanter/seçim, hazır kadro ve kalkışta dondurma; ardından yakın/uzak/illüzyon görünüm
ve materyal temizliği testlenir. Son olarak TR/EN 350/1280 px ve gerçek render ekranları
görsel olarak incelenir. Uzun ekonomi/sezon simülasyonu kapsamda değildir.

## Uygulanan davranış

- Kademe doğrudan gerçek gemi seviyesinden hesaplanır: 1/5/10/15/20. Başka bir seviye
  seçmek yalnız hangar önizlemesini değiştirir; üstteki gerçek seviye ve kaynak bedelleri
  değişmez. Önizleme etiketi vardır; görünüm bölümü kapatılınca gerçek görünüm geri gelir.
- Kademe 2 kanat zırhı/panel yüzeylerini, kademe 3 ray ve rütbe işaretlerini, kademe 4 ışık
  şeritlerini, kademe 5 imza desenini ekler. **Bunlar yüzey shader'ıdır:** mevcut birleşik
  modellerde yeni namlu/kanat/ek motor geometrisi üretildiği iddia edilmez. §6'daki ayrı
  modüler parçalar ve amiral silueti hâlâ sanat varlığı önerisidir; bu uygulama mevcut
  sınıf modellerinin geometri, ölçü ve namlu noktalarını aynen korur.
- Hesap kataloğuna `COMMANDER` yuvası eklendi: `arena-standard` ücretsiz, `arena-helios`
  ve `arena-nebula` ücretli ürün kimlikleridir. Boya farklılığı yalnız yüzeydedir.
  Boya/amblem authored texelleri karartmaz, opaklık ve kapsama değişmez.
- Motor yuvası altı mevcut `ENGINE` ürünüyle ortaktır; ikinci motor envanteri veya ikinci
  ödeme yoktur. Hangar motor parıltısı, uçuş parıltısı, alev paleti ve uzaktaki izler aynı
  seçimi izler. Turbo geçişi ve alev uzunluğu eski okunabilirlik kurallarını korur.
- Amblem aktif klanın liderinin **sahipliği doğrulanmış** bayrağıdır. Klan yoksa amblem
  yoktur; liderin seçimi yoksa ücretsiz Vanguard kullanılır. Oyuncu URL gönderemez.
- Hangardaki her görünüm alınmadan denenebilir. Yalnız sahip olunan ürün uygulanır;
  `POST /api/cosmetics/equip` tek yuvanın kategori/ürün kimliğini alır. Kademe, istatistik
  veya önizleme seviyesi kaydedilmez. Uçuşta hangardan uygulama kapalıdır.
- Hangardaki uygulama sonrası `/arena/hangar` yeniden okunur. Sınıf/seviye/tamir/yetenek
  yanıtları da görünümü taşır; bu işlemler boyayı yanlışlıkla varsayılana döndürmez.
- Takımın hazır parmak izi görünümü içerir. Ortak kalkış, hazır denetiminde doğrulanan
  görünümü kullanır; kalkışın ikinci bir hesap okuması farklı bir seçimi araya sokamaz.
  Mevcut uçuşun yükü, hesap seçimi sonradan değişse bile sabittir. İade sonraki kalkışta
  hak denetiminden geçemez ve standart boya uygulanır.
- Mağaza ve envanter ayrı Komutan gemisi kategorisi sunar. Mağaza boya incelemesi public
  bir denetim gövdesidir; oyuncunun gerçek üç sınıf modeli hangarda görünür. Mağaza adı,
  açıklaması ve kategori kapsamı altı dilde vardır; hangar mevcut TR/EN Yarık kopyasını izler.

## Varlık, ağ ve çalışma sınırları

- Yeni migration yok; hesap `cosmeticEquipment` JSON'u ve mevcut satın alma/iade hattı
  kullanılır. Pilot/sortie roster JSON'una isteğe bağlı `appearance` eklenir; eski yük ve
  roster standart görünür. Sayısal snapshot boyu/değeri ve protokol **14** korunur.
- Her boya/kademe için ayrı GLB indirilmez. Yakın gemide mevcut malzeme kopyaları,
  uzakta sınıf başına mevcut instanced batch ve `aLook` özniteliği kullanılır. Farklı boya
  ve seviyedeki iki uzak gemi aynı gövde çiziminde kalır. Paylaşılan model geometrisine
  görünüm özniteliği yazılmaz; batch kendi hafif uzak-geometri kopyasına sahiptir.
- 22 klan standardı tek 1024×512 atlas'tadır: miplerle yaklaşık **2,67 MiB** GPU dokusu.
  Atlas arena doku bütçesine bir kez eklenir ve istemci kapanınca bırakılır. Hangar
  önizlemesi kendi malzemelerini bırakır; model önbelleğinin geometri/dokularını silmez.
- Satış fiyatı, Polar/Shopier ürün eşlemesi veya canlı ödeme yapılandırılmadı. Mevcut
  konfigürasyon yeni kimlikleri destekler; eşlemesi olmayan ürün satın alınamaz. Testler
  sağlayıcıya gerçek ödeme/sipariş göndermez. Manuel test hakkı kullanıcıya verilmedi.
- Fiziksel iPhone bellek/FPS ve sahibin tasarım/oynanış kabulü otomatik tarayıcı kanıtı
  sayılmaz. Önceki Y3/Y4/Y5 kabul açıkları ve Öz gelene kadar rütbe 3 tavanı korunur.

## Doğrulama kaydı

Kanıt klasörü: `.dev/arena/2026-10-24-y8/`. Yeni davranışlar önce kırmızı testle yazıldı;
`*-red.log` ve ilgili yeşil günlükler dosyalanmıştır. Uzun ekonomi/sezon simülasyonu yok.

- Saf kural, sahiplik/yanlış yuva/iade, bütün hangar yanıtları, hazır kadronun bozulması,
  kalkış yükü, illüzyon ve sahte istemci görünümü testleri var.
- TR/EN × 350/1280 px × beş kademe: gerçek GLB ve WebGL shader'ı ile **20 kontrol geçti**.
  Sahip olunmayan boya denenip uygulanamıyor; sahip olunan boya/motor ayrı doğru yuvaya
  yazılıyor. Yatay taşma ve tarayıcı/shader hatası yok. Kademe geçişinde köşe sayısı,
  program önbelleği ve doku sayısı sabit (örnek sahnede 19 program / 29 doku).
- Gerçek uçuş renderer'ında sunucu roster'ı + sayısal snapshot fixture'ı: kendi gemisi ve
  üç rakipte farklı kademe/boya/motor, iki uzak gemide tek instanced gövde batch'i geçti.
  Fixture yalnız ayrı tarayıcı bağlamındadır; gerçek hesaba ve kaynağa yazmaz.
- Genel regresyon: **181 dosya / 3.152 saf kural testi** geçti. **95 dosya / 596 ilgili
  istemci testi** geçti; son malzeme/tip düzeltmelerinden sonra 55 odaklı test tekrar geçti.
  Sunucu tarafında 25 dosyalık ilgili kümenin başarılı testlerine ek olarak güncellenen
  oda/katalog/ödeme beklentileri 58 testlik tekrar, sortie 13 testlik tekrar ile doğrulandı:
  toplam **327 farklı ilgili sunucu testi**. Uzun simülasyon yok.
- Katalog testi daha önce tüm ücretli kimlikleri yayımlanmış sağlayıcı kataloğu sayıyordu;
  yeni boyalar henüz onaylı fiyat/eşleme kapsamında değildir. Test bu sınırı açık tutar,
  ücretsiz boyaya fiyat konmasını ve eşlenmemiş boyayla checkout açılmasını reddeder.
  Mevcut sağlayıcı ürün kimlikleri ve fiyat dosyaları değiştirilmedi.
- Kurallar/sunucu/web/sim tip kontrolü; sunucu+rules, ilgili web kaynakları/testleri ve
  görsel araçlarının lint'i sıfır hatayla geçti. Web üretim derlemesi geçti; mevcut büyük
  chunk uyarısı sürüyor. `git diff --check` temiz. Sonuç günlüğü `checks.json`.
- İlk genel istemci turu yeni ürün adlarının çeviri istisnasını ve takım ekranında ilk
  boyamadan önce çift taktik seçicisini yakaladı; düzeltildi. Sunucu oda testi yeni
  illüzyon görünüm alanını bekleyecek şekilde genişletildi. Sonraki ilgili tekrarlar yeşil.
- Uzun test tekrarı sırasında yalnız geçici PostgreSQL'in tmpfs/WAL belleği 512 MiB sınırına
  ulaşıp bağlantıyı kesti. Bu test ortamı disk volume'ü üzerinde 512 MiB / 1 CPU ile yeniden
  kuruldu; etkilenen 58 test tekrar geçti, OOM sayacı 0. Oyun DB'si `astera-pg` ayrıdır.

## Yerel çalışma ve devralma

- Worktree `../blindspace-arena-playtest`, dal `release/arena-playtest-20261020`.
  Önceki Y6/Y7 değişiklikleri korunmuştur. Commit/push/canlı dağıtım yapılmadı.
- Web **5199**, API/worker **3100**, Yarık **3101**. Web bu devamda durmuş bulundu;
  aynı portta `tsx` yükleyicisi ve polling ile yeniden açıldı. Başka worktree'nin 5184
  sunucusuna dokunulmadı. API ve arena sıfır pilot/bağlantı varken SIGTERM ile yenilendi;
  kendi önceki ortamları kullanıldı, `ARENA_DEV=false` ve erişim kuralları korundu.
- API sağlık cevabı, DB/queue/stream; proxy'den etkin `/arena/health` ve 5199 bağlantısı
  kontrol edildi (200; oturumsuz takım kapısı beklenen 401). Kaynak harcayan gerçek kullanıcı
  işlemi test için tekrar gönderilmedi.
- Son kanıtlar `visual/` (TR/EN ve ekran genişlikleri), `flight-final/` (yakın/uzak),
  `art-final/` (diğer iki sınıf + mağaza boyaları). Çekimler gerçek modelleri ve WebGL'i
  kullanır; yalnız hesap/roster/snapshot verisi tarayıcı bağlamında fixture'dır.
- Kalan: §6'nın ayrı modüler parça/amiral silueti sanat önerisi, sahibin tasarım kabulü ve
  fiziksel telefon bellek/FPS/oynanış testi. Gerçek satış için ayrıca ürün/fiyat eşlemesi
  gerekir. Y9 Amiral rolü yeni sezon ruleset kapısına bağlıdır; bu değişiklikte başlatılmadı.

- Son temizlikte yalnız `astera-yarik-y8-pg` ve ona ait test volume'ü kaldırıldı.
  `astera-pg`, web 5199, API 3100 ve Yarık 3101 açık bırakıldı. Son sağlık kanıtı
  `health-final.json`, toplu doğrulama özeti `verification.json`.
