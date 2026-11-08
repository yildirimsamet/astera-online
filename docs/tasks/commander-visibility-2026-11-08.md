# Komutan gemisi görünürlüğü — 2026-11-08

Owner kapsamı: teleskop görüşündeki başkentte park eden/dolaşan yabancı komutan gemisi; tanımlanabilen yabancı filodaki eşlikçi; kendi ve yabancı filo focus sheet'inde sınıf/seviye/bonus. Deploy owner'ın sonraki açık talimatını bekler.

Çalışma alanı: `../blindspace-commander-visibility`, `codex/commander-visibility-20261108`.
Taban: fetch sonrası `origin/master` (`62a3f65b`) ve yerel `master` (`647eb5f3`) birleştirildi. Ana worktree'nin kaydedilmemiş değişiklikleri alınmadı.

## Kabul ölçütleri ve uygulama

1. Sunucu: yalnız güncel, çalışan teleskop menzilindeki yabancı başkent için gemi sınıfı, seviye ve sabit/yörüngede durumu. Görüş dışı ve eski sonda hafızası canlı gemi durumu vermez. Yarıkta/seferde/tek başına dönüşteki gemi başkentte çizilmez. Kaynaklar, yük, tamir süresi ve arena durumu paylaşılmaz.
2. Ortak trafik snapshot'ı: açık eşlik görevlerini bir kez toplu oku; tanımlanmış filoya sefere çıkış sınıf/seviyesini ekle. Radar soru işareti ve yalnız savaş efekti alan gözlemciye ekleme. Savunma desteğinin çıkış/dönüş görevlerini de eşle.
3. İstemci: mevcut park/yörünge ve filo eşlik modellerini kullan. Yabancı gemi kendi geminin rengiyle gösterilmez; gezegendeki gemiye dokunmak o gezegeni seçer. Filo focus kameraya eşlikçi de sığar.
4. Filo focus: mevcut yerelleştirilmiş bonus metinleri ve kuralların `admiralBonuses` hesabı, hem sahip hem gözlemci için aynı bileşende. Bonus sahibi geminin güncel hangar seviyesinden türetilmez.
5. Canlılık: fiziksel durum değişiklikleri gözlemcinin galaksi/trafik okumalarını yeniler; olay kimlik, konum veya özel gemi verisi taşımaz.
6. Doğrulama: önce başarısız API/UI testleri; uygulama ardından hedefli regresyon, tip/lint ve mobil gerçek akış/görsel doğrulaması. Ekonomi simülasyonları kapsam dışıdır.

## Durum

İstenen görünürlük ve bonus gösterimi uygulandı. Kapsamlı review'da altı bulgu önce testle doğrulandı, ardından düzeltildi. Ayrı dalda, deploy talimatı bekleniyor.

## Model yükleme (owner'ın ek isteği)

- Kök neden: galaksideki eski `useShipModels`, üretimde `/__ref/` isterken erişim çerezi yalnız hangarda açılıyordu. Başkasının gemisini gören, hangara girmemiş bir oyuncu 404 alabilirdi.
- `/arena/galaxy-ships` geçerli hesabı olan herkese yalnız üç hafif, gömülü dokulu sınıf modelini açar. Arena pilot izni gerekmez. Ayrı imzalı, dar yollu HttpOnly çerez; bu çerez tam arena paketini açamaz. Üretimde mevcut `/arena/` proxy'si kullanılır.
- Katalog mevcut olmayan dosyaların URL'lerini döndürmez. Hazır paket yoksa `models: null`; galaksi çalışır ve gemi silueti kalır.
- Galaksinin kataloğu React Query üzerinden ortaktır; hangarın cihazına göre tam/hafif model seçimi ayrı tutulur. Modeller mevcut GLTF önbelleğini kullanır. Teleskopta olup kameradan uzak gezegenlerde model yüklenmez. Oturum 6 saat; katalog 5 saatte yenilenir, süresi geçmiş katalog yenilenmeden yeni URL gösterilmez. Sürüm sorgusu dosya boyutu/mtime ile değişir.
- Web galaksisi yalnız üç hafif webp gemi GLB'sini indirir; arena ortamını, sesleri ve diğer modelleri indirmez. Mevcut yerel üç GLB toplam yaklaşık 2,5 MB, dokuları dosyalarının içindedir; dış doku URL'si yoktur.
- Android gömülü webp kataloğu ve aynı dosya yollarını korur; yeni web çerezine ihtiyaç duymaz. Model indirme/çözme hatası yerel sınırda yakalanır, galaksi kapanmaz. Hatalı GLTF önbelleği temizlenir; bir kez otomatik, ardından bağlantı/odak dönüşünde tekrar denenebilir. Sunucuda başarısız katalog sonucu saklanmaz; istemci geçici eksikliği/hata durumunu 30 saniyede yeniden okur.
- Yayın sırası: hazır gemi dosyaları → migration ve arena/API sunucuları → web istemcisi. Bu worktree deploy edilmedi. Ana worktree'deki kaydedilmemiş migration'larla birleştirme gerektiğinde yeni migration numarası yayın öncesinde uzlaştırılmalıdır.


## Kapsamlı review — doğrulanıp kapatılan bulgular

Her ürün bulgusu önce başarısız testle doğrulandı, ardından düzeltildi:

| Bulgu | Doğrulama | Düzeltme |
| --- | --- | --- |
| İlk istekte hazır olmayan sunucu paketi sonsuza kadar boş kalıyordu | `references`: dosyalar ilk okumadan sonra geldiğinde ikinci katalog da boş dönüyordu | Yalnız başarılı katalog önbellekte tutulur |
| İstemci boş kataloğu 5 saat bekletebiliyordu | `galaxy-ship-loading`: paket hazır olsa da 30 sn sonra model gelmiyordu | Başarılı katalog 5 saat, geçici eksik/hata 30 sn yenilenir |
| İndirme hatasından sonra model geri gelmiyordu; bağlantı olayı hata işlenmesinden önce gelince de toparlanmıyordu | `galaxy-ship-loading`: bağlantı dönüşü, gecikmiş hata ve sınırlı tekrar testleri | Hata önbelleğini temizle; bir kez otomatik tekrar; bağlantı/odak dönüşünde yeniden dene; zamanlayıcıyı unmount'ta temizle |
| Ortak yükleyici masaüstü hangarını hafif modele düşürüyordu | `ship-model-quality`: tam sıkıştırılmış model yerine galaksi modeli geliyordu | `useShipModels` hangarın mevcut davranışını korur; `useGalaxyShipModels` yalnız galaksiyi yönetir |
| Model dosyası değiştiğinde eski `Content-Length` kullanılıyordu | `references`: 38 baytlık içerikte 5 bayt başlığı dönüyordu | Önbellekteki boyut HTTP aktarımına dayatılmaz; tamamı akışla iletilir |
| Eşlikçi geminin gövdesine dokunmak filoyu seçmiyordu | `escort-picking`: model yüklenirken gövde dokunuşunda seçim çağrısı sıfırdı | Kendi/yabancı eşlikçi gemisinin dokunma alanı ilgili filonun mevcut seçim akışına bağlandı |

Görsel araçta ayrıca ekran dışındaki etikete zorunlu tıklamanın kapsayıcıyı yatay kaydırdığı ölçüldü. Araç kamera/pointer hazırlığını düzeltti; ürün koduna doğrulanmamış bir kamera değişikliği yapılmadı.

### Doğrulama kanıtları

- 12 sunucu regresyon dosyasında 144 test; son model erişim paketinde 11 test geçti.
- 20 istemci regresyon dosyasında 215 test; son yükleme/kalite/focus/dokunma kontrollerinde 16 test geçti. Bunlara otomatik tekrar sınırı ve bağlantı olayından önce/sonra hata ulaşması dahildir.
- `node tools/visual.mjs out/commander-sight/visual --commander-sight`: gerçek yerel API'yle normal dokunuşlar, park gemisinden gezegene geçiş, kendi/yabancı eşlikçi gövdesinden filoya geçiş ve bonus, 390/350 px, yatay taşma, tek katalog, gerçek GLB istekleri ve kasıtlı kesinti/toparlanma geçti.
- Sunucu ve istemci typecheck, değişen dosyaların lint kontrolü ve üretim build'leri geçti. `pnpm verify` bütünü çalıştırılmadı; yukarıdaki kapsamla ilgili API/UI regresyonları seçildi.
- Normal akışta sayfa hatası ve model 404'ü sıfır; katalog ve görünen iki sınıf modeli 200 döndü. Kesinti testinde yalnız bilerek engellenen URL'lerin beklenen fetch hata raporlarına izin verilir; galaksi ve gemi modellerinin geri gelmesi ayrıca doğrulanır.
- Yerel kanıt: `out/commander-sight/visual/evidence.json`, `390-foreign-parked.png`, `390-own-escort.png`, `390-foreign-escort.png`, `350-foreign-escort.png`. Bu çıktı ve özel model dosyaları git'e eklenmez.
- Android'in gömülü dosya yolları testle korundu; fiziksel Android cihazda çalıştırma bu oturumda yapılmadı.
- Uzun ekonomi/sezon testleri çalıştırılmadı. Deploy yapılmadı.
- Yerel API/Vite süreçleri kapatıldı; bu göreve ait iki geçici test veritabanı silindi. Görsel kanıtlar worktree'de bırakıldı.
