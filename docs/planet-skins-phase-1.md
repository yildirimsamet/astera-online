# Gezegen skinleri · Faz 1: katalog ve görsel reçete

## Hedef ve sınır

İlk sürümde Lav, Buz, Zehir ve Çöl dört ayrı skin kimliğidir. Her skinin normal
görünümü `test_planet_modal.glb`; saldırıya uğrayan gezegenin altı saatlik
toparlanma kalkanı sırasında görünümü `patlamis_gezegen_2.glb` modelidir.
İki görünüm aynı satın alma hakkına dahildir. Her modelin dokusundaki çatlaklar
ayrı Lav/Buz/Zehir/Çöl paletiyle boyanır; shader eşikleri modele göre ayarlanır.
Stash'teki volkan, mağara, kanyon ve diğer dokuz yüzey modeli bu sürümün
reçetesine dahil değildir.

Skin **hesabın kalıcı kozmetik hakkı** olacak. Aynı hak birden fazla gezegende
aynı anda kullanılabilecek; oyuncu farklı gezegenlerine farklı skinler de
takabilecek. Bu kuralın veri tabanı ve uygulama işlemi Faz 2'de yapıldı.
Skin takılmayan gezegenin mevcut PNG görünümü korunacak.

## Reçete sözleşmesi

Her satılabilir skinin değişmeyen bir `id`'si, hedef türü ve tarif sürümü var.
Tarif bir temel model, modelin hazır materyali **veya** bir renk/efekt paleti,
isteğe bağlı dahil edilen ek assetler ve durumlara özel görünüm değişiklikleri
tarif ediyor. Fiyat ve ödeme bağlantısı bu tarifin parçası değil: satış kanalı
değişse de skin kimliği ve görünümü aynı
kalmalı. İleride ayrı satılacak bir volkanın dahil edilen bir skin paketinde
görünmesi, alıcısına otomatik olarak ayrıca takılabilir volkan hakkı vermez;
bu hak ürünün tanımında açıkça belirtilmeli.

Sunucunun tanıyacağı kimlikler ve bileşen ilişkisi `@astera/rules` içinde.
Web, model dosyası yolunu ve shader ayarlarını aynı kimlikten çözüyor. Bilinmeyen
bir kimlik geçerli bir görsele dönüşmez; ileride istemci bunun yerine mevcut
PNG'yi gösterir. Bu ayrım, oyuncunun kendi renk değerlerini API'ye göndererek
satılmayan bir görünüm oluşturmasını da engeller.

## Uygulama ve kabul ölçütleri

1. Dört benzersiz kimlik, dört ayrı palet, normal ve toparlanma kalkanı modelleri
   ile boş ek asset listeleri tanımlanır. Durum değişimi yeni bir ürün oluşturmaz.
2. Stash'teki ayarlar üretim kataloğuna taşınır; test sayfasının tamamı ürüne
   aktarılmaz. Model, mevcut optimize edilmiş web dosyasına bağlanır.
3. Katalog testi geçerli kimlikleri ve hatalı/eski kimliğin reddini doğrular.
   Web testi her iki durumun gerçek, dokulu ve optimize `.glb` dosyasına
   ulaştığını doğrular.
4. İlgili testler, tip denetimi ve lint çalıştırılır. Bu faz yalnızca tarifin
   temelini oluşturur; galaksi, sahiplik ve skin sayfası sonraki fazlarda bağlanır.

## Sonraki fazlarda çözülen teknik işler

POC tek görünümü aynı anda bütün test gezegenlerine uyguluyor ve shader ayarlarını
paylaşıyor. Üretimde aynı galakside Lav, Buz, Zehir, Çöl ve PNG yan yana
olacağından materyal ayarları **skin başına yalıtıldı**. Model yükleme ve
instancing görünüm türüne göre gruplandı; keşif sisi yeni oyuncu kimliği sızdırmıyor.

Durum seçimi genel `PROTECTED` etiketinden yapılamaz: bu etiket yeni oyuncu
kalkanını ve işgal korumasını da kapsar. Vurulan gezegenin kendisine yazılan
`recoveryBoostUntil` aktifken `RECOVERY_SHIELD` görünümü seçilir; süre bitince
veya kalkan harcanınca normal görünüme dönülür. Death Star'ın iki saatlik
`RECOVERY` kesintisi ayrı bir oyun durumudur ve onun mevcut görsel efektleriyle
çakışma Faz 3'te kontrol edildi.
