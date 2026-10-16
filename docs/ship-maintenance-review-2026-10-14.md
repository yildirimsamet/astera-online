# Gemi bakımı incelemesi — 14 Ekim 2026

Durum: İlk inceleme ve owner isteğiyle 14–15 Ekim ek CR tamamlandı. Altı ek bulgu doğrulanıp düzeltildi; doğrulama ve bakım dışındaki lint engeli son bölümde kayıtlıdır. Master üzerinde çalışıldı; çalışma alanındaki başka işlerin değişiklikleri korundu. Yayın veya geliştirme/canlı DB migration yapılmadı. Radyasyon bombası ve gezegen/dock doz settlement'ı ikinci aşamadır.

## Kapsam ve kesin kurallar

Öncelik manuel gemi bakımıdır. Otomatik tamirhaneye geçiş ve ücretsiz tamir kaldırılır. Savaşa giriş sınırı **can ≤ %5**; savaşa daha yüksek canla giren gemi sonradan bu sınırın altına düşünce savaştan ayrılmaz. Gezegen hangarındaki kritik gemi baskın dışında korunur; anıttaki kritik gemi ateş etmez, üretir ve vurulabilir. Tamirhanedeki gemi baskından korunur.

Gelecek gezegen radyasyonunda seçilen son karar: radyasyon başladığında onarım siparişleri tam fatura iadesiyle otomatik iptal edilir; otomatik devam yoktur. Gemi gerçek canıyla bekler. Yeni onarım daha sonra güncel hasara göre fiyatlanır. Tamirhaneye giriş, onarım ve parçalama kapanır; hangara geri alma ve normal tahliye açık kalır. Radyasyonun gemilere uygulanması ve onarımları otomatik iptal eden işlem henüz bu bakım aşamasının tamamlanmış çıktısı değildir.

## Bulunan ve regresyon testiyle düzeltilen sorunlar

| Öncelik | Bulgu ve etkisi | Düzeltme / kanıt |
| --- | --- | --- |
| P1 | Kısmi onarım isteği tekrar edilince kalan gemilerden ikinci iş oluşturulup yeniden ücret alınabiliyordu. | Sunucu işlem anahtarıyla tek iş/fatura; arayüz cevabı kaybolan aynı niyet için aynı anahtarı korur. `maintenance-actions`, `manual-repair-station`. |
| P1 | Dock grubunun canı değiştiğinde eski parçalama veya onarım seçimi farklı bedelle uygulanabiliyordu. | Adet ve iki parçalı hasar bilgisi sunucuda kilit altında doğrulanır. Eski seçim `SHIP_SELECTION_CHANGED` ile reddedilir. |
| P1 | Koloni ayrılması ve klan desteği savaş sonrası yazımı yara kaydını veya savaş dışındaki gemileri kaybedebiliyordu. | Owner/konum sınırları içinde fiziksel stok ve yara birlikte korunur. `maintenance-dispatch`, klan desteği savaş regresyonu. |
| P1 | Yaralı Prospector madencilikte hangardan ayrılırken yarası evde kalıyor; stok okuması hata veriyordu. | İki madencilik girişinde yarayı uçuşun `units` konumuna taşı, dönüşte gerçek canıyla indir. Yeni madencilik testi. |
| P1 | Radyasyon uçuş tahmini gemileri tam canlı kabul ediyordu. | Normal saldırı, transfer, korsan, ticaret ve konvoy girişlerinde seçilen gemilerin ilk yaraları tahmine verilir. Yaralı gemiye ölümcül ama sağlıklıya ölümcül olmayan rota testi. |
| P1 | Transfer tahmini tüm yara kayıtlarını iki alt filoya birden vererek mevcut gemiden fazla yaralı gemi hatası üretiyordu. | Sağlık gruplarını ayır, her parçanın kendi kaydıyla hesapla. `radiation-hp-flights` regresyonu. |
| P1 | Eski gezegen muharebe yolunda kesirli yara atılabiliyor ve ücretsiz iyileşme oluyordu. | Yeni bakım muharebesinde hassas hasar taşıma açıldı; eski API'nin varsayılan davranışı korunuyor. `maintenance-combat`. |
| P1 | Konvoya vardığında bütün silahlı gemileri kritik olan filo yine saldırı ödülü alabiliyordu. | Varıştaki savaşabilir filo ödül hesabına girer; kritik gemiler geri döner. Konvoy regresyonu. |
| P1 | Korsan hesaplaması ilk yaraları ve hafif yaraların ücretini yok sayabiliyordu; kritik gemiler ateş edebiliyordu. | Tahmin ve sunucu aynı bakım muharebesini kullanır; bütün yaralar ücretli tamir maliyetine girer. Korsan tahmin regresyonları. |
| P1 | Genel savaş kaybı tahmini kendi yaralı gemilerini tam canlı kabul ediyordu; hedef dosyası kritik gemiyi gönderilebilir güç olarak sayıyordu. | Tahmin kendi seçilen başlangıç yarasını kullanır. Hedef dosyası savaşabilir grubu karşılaştırır. Deferred hesapta adet ve yara aynı snapshot'ta taşınır; birinin eski, diğerinin yeni olması engellenir. `forecast`, `launch-forecast-memo`, `target-dossier`. |
| P1 | Tamirhane açıkken gösterilen gezegen değiştiğinde eski parçalama onayı yeni gezegene taşınabiliyordu. | Bakım içeriği gezegen kimliğiyle yeniden açılır; seçim, işlem anahtarı ve geri alınamaz onay sıfırlanır. Aynı gezegenin canlı güncellemesi seçimi gereksiz yere silmez. `manual-repair-station` gezegen değişimi regresyonu. |
| P1 | Sürekli radyasyon hasarı, eski can snapshot'ını reddederek tamirhaneden tahliyeyi engelleyebilirdi. | RETURN mevcut lot kimliği/adedi ve sunucunun gerçek canıyla çalışır. Radyasyonda yalnız çıkış açıkken UI seçim kimliği can değişimine dayanır; radyasyon bitince fiyat gerektiren seçim yeniden yapılır. Parçalama/onarımda eski can fiyatı hâlâ reddedilir. Sunucu ve UI regresyonları. |
| P2 | Anıttan eve inen sağlık kaydı, anıt lotunun kimlik/araştırma/yük alanlarını da JSON içine taşıyordu. | Ev hasarı yazıcısı yalnız hull/adet/iki parçalı yara alanlarını saklar. Oyuncunun ayrı yük ve araştırma kayıtları mevcut yerlerinde kalır. Veritabanı satırını doğrudan kontrol eden regresyon. |
| P2 | Eski yüzde sezonundaki klan savaşı kişisel raporu kesirli yarayı atarken fiziksel gemi bunu koruyordu. | Kişisel rapor bütün sezonlarda gerçek sağ kalan filo üzerinden hassas yarayı normalleştirir. Fiziksel dönüş ve kişisel rapor aynı canı anlatır. `clan-war-damage`. |
| P2 | Koruma alanı radyasyonu etkisizleştirirken tamirhane yine kapanıyordu. | Tamirhane, radyasyonun gerçek profilini ve hedef kimliğini kullanır; kapanırken çıkış açık kalır. `maintenance-actions`. |
| P2 | Fırlatma ekranı savaşamayacak gemileri seçtiriyordu. | Seçilebilir adet, savunmada kalan sayı ve rota ilk yaraları savaşabilir stokla uyumlu. `launch-sheet`, 77 ilgili arayüz testi. |
| P2 | Filo aktarımı başarısız olduğunda seçim önceden temizleniyor; tekrar deneme yeni anahtar üretiyordu. | Seçim yalnız başarılı cevapta temizlenir; aynı niyetin anahtarı korunur. Filo ekranı ve bağlantı testi. |
| P2 | Eski test kurulumları inişin otomatik dock yarattığını varsayıyordu. | Testlerde açık manuel aktarım kullanılır; inişte yara koruma ayrıca test edilir. 31 mevcut tamirhane/API/bot/depolama testi geçti. |
| P2 | Tamirhane boşken “gezegende hasarlı gemi yok” yazıyor; bazı yüzeyler ücretsiz tamir anlatıyordu. | Tamirhane boşluğu ve hangar hasarı ayrıldı. Tamirhane, araştırma ve Wiki metinleri güncelleniyor; rapor/radyasyon açıklamaları da inceleme kapsamında. |
| P2 | Çok az canı kalan geminin parçalama dönüşü sıfıra yuvarlanınca onayda kaynak alanı boş kalıyordu. | Onay üç kaynağı da tam sayı olarak gösterir; sıfır dönüş açıkça görünür. `manual-repair-station` sıfır getiri regresyonu. |
| P2 | 350px Almanca filo ekranında evde/uçuşta/tamirde adetleri gezegen adını tek harfe kadar sıkıştırıyordu. | Gezegen adı kendi satırında, sayılar esnek ikinci satırda gösterilir. Görsel kontrolde adı kırpmama ölçümü eklendi; filo/tamirhane son tekrarında 60 test geçti. |

## Performans değerlendirmesi

- Fiziksel gemi adedi `units` üzerinde tek otorite olarak kalır. Her gemi için kayıt üretilmez; aynı hull ve tam can bilgisi bir gruptur.
- Parçalama hesabı gemi başına döngü yerine seçilen gruplar üzerinde çalışır. Kaynakları toplamdan sonra aşağı yuvarlar; seçim bölünerek kazanç artırılamaz. Çok küçük kesirler dahil tam aritmetik test edilir.
- İstek başına seçim 50 grupla sınırlıdır. Arayüzde anahtarla grup bulma `Map` kullanır.
- Can grubu satırlarında `content-visibility: auto` görünüm dışında kalan satırların çizim işini azaltır; bu, üretim cihazında ölçülmüş bir süre garantisi değildir.
- Tamirhane erişim kontrolü geçmiş bütün radyasyon olaylarını okumaz; yalnız mevcut kaynakları alır. Uçuş hasarı geçmiş pencereleri okumaya devam eder; geçmişi budamak yanlış hasar hesaplatır.
- `writeHomeHealth` tek SQL güncellemesi kullanır; yalnız gerçek JSON hasarı değişen hull satırları yazılır. Değişmeyen kaydın `xmin` değeriyle gereksiz yazılmadığı test edilir.
- Tekrar kaydında bütün gezegen görünümü tutulmaz; yalnız değişmeyen işlem makbuzu saklanır. Aynı istek tekrarlandığında güncel gezegen görünümü okunur.
- Üretim yüküyle gecikme ölçümü yapılmadı. “Tam optimize” veya belirli kapasite garantisi verilmiyor.

## Tasarım değerlendirmesi

Gerçek tamirhane ve filo ekranları fixture API ile 350×812 ve 1280×812 boyutlarında TR/EN/DE/FR/ES/JA dillerinde görüntülendi. Son düzen dahil **60 ekran durumu geçti**: hangar, parçalama onayı, tamirhanede radyasyon/çıkış, filo ve radyasyonlu filo. Can grubu, sayı seçimi, kaynak dönüşü, gezegen adının okunması ve radyasyonda çıkış kontrol edildi. Ölçümler ve görseller `out/ship-maintenance-review/` altında; komut `node tools/visual.mjs out/ship-maintenance-review --ship-maintenance`.

Olumlu: otomatik seçim yok, can çubuğu ve savaşabilirlik aynı satırda, kısmi adet seçimi var, parçalama geri alınamazlığı ve dönüş kaynakları onayda gösteriliyor. Radyasyon kapanma nedenini ve tahliye için hangara geri alma yolunu açıklar. Ayrıntılı fiyat/süre/kuyruk/iptal kuralları “Nasıl çalışır” ile açılır.

Rapor ve radyasyon metinlerindeki ücretsiz tamir varsayımları temizlendi. Büyük kaynak dönüşleri onayda tam sayı gösterilir; sıfır dönüş de gizlenmez. 50 grup sınırı aşılınca açıklama çıkar. Bot kendi kararıyla manuel aktarım ve ücretli onarım servisini çağırır; güncel kaynaklarla sonraki kararına devam eder. Bunlar testlerle ve son görsel tekrarla doğrulandı.

## Geniş doğrulama ve kalan riskler

- Son savaş tahmini düzeltmesi dahil kuralların tam normal çalıştırması: **130 dosya / 2.264 test geçti** (`/tmp/astera-maintenance-rules-final.log`).
- Yeni bakım entegrasyonları: 25 test geçti.
- Mevcut tamirhane/API/bot/depolama: 31 test geçti.
- Fırlatma arayüzü ve tahmin memo kontrolü: 77 test geçti.
- Filo ve manuel tamirhane etkileşimleri: 37 test geçti; son eklenen exact kaynak onayı ayrıca geçti.
- Korsan/konvoy sunucu regresyonları: 49 test geçti; son korsan overrun düzeltmesi tam sunucu taramasında doğrulandı.
- Rules/sim/server/web TypeScript ve üç lint grubunun hepsi 4 GiB heap sınırıyla geçti. Son sunucu ve arayüz değişikliklerinin tip/lint tekrarları da geçti.
- Disk tabanlı izole test ortamında tam sunucu taraması tamamlandı: 263 dosyada 250 geçti; 13 dosyada eski otomatik dock/ücretsiz tamir beklentisine bağlı 37 kontrol başarısızdı. Güncellenen 13 dosya ve yeni sağlık kaydı dosyasının son tekrarında **14 dosya / 123 test geçti** (`/tmp/astera-maintenance-legacy-final.log`). Klan/bakım/çıkış/depolama son hedefli doğrulamasında ayrıca 35 test geçti. Tam tarama ve düzeltme tekrarları birlikte değerlendirilir; tek çalıştırmada 263 yeşil dosya iddiası verilmez.
- Tam arayüz taraması tamamlandı: 455 dosyada 446 geçti, 8 başarısız, 1 atlandı; 6.114 test geçti, 12 başarısız, 29 atlandı. Başarısız 8 dosyanın son tekrarında **89 test geçti** (`/tmp/astera-maintenance-web-recheck.log`). Eski ücretsiz tamir/otomatik dock beklentileri güncellendi; sıfır parçalama getirisinin boş gösterimi düzeltildi. Tema kontrolü, mevcut Tailwind 4 yönlü gradient sınıflarını da tanır. Tek tam çalıştırmada bütün arayüz dosyalarının yeşil olduğu iddia edilmez.
- Son filo düzeni ve mevcut tamirhane etkileşim tekrarında ayrıca **3 dosya / 60 test geçti** (`/tmp/astera-maintenance-final-fleet.log`).
- Son arayüz tip kontrolü, arayüz ve tools/sim/root lint tekrarları geçti. 60 görsel durumun son tekrarında yatay taşma, kesilen onay/alt işlem düğmesi veya JavaScript sayfa hatası olmadı; filo gezegen adı ayrıca ölçüldü. `git diff --check` temiz.
- Önceki bağlantı/geçici disk sorunlu çalışmalar kanıt olarak sayılmaz. Ekonomi/sezon simülasyonları çalıştırılmadı.

Yüksek dikkat gerektiren alanlar: legacy sezonlarda özel görev dönüşleri; probe savunma gücü ile fiziksel filo sayısının ayrımı; kaçış hesapları; klan ortak saldırısı; sahipsiz kalan dönüşlerin güvenli eve indirilmesi; season cleanup ve eski worker event'leri; onarım iptali/iade yarışları. Radyasyon bombası gelmeden önce gezegen ve dock doz settlement'ı ile tam iade mekanizması aynı atomik işlemde birleştirilecek. Bomba modeli, çarpma ve kalıcı efekt assetleri owner görmeden seçilmeyecek.

### İkinci taramada takip edilen açıklar

- Legacy ticaret/konvoy dönüşünün kaynak dozu olmasa da geminin eski yarasını taşıması; başarısız madencilik dönüşünün worker recovery yolunun da aynı canı koruması.
- Probe fiziksel gemi sayısını göstermeyi sürdürürken ateş gücü ve savunma şekline kritik gemileri katmaması. Klan destek probe verisinin aynı uygunlukla hesaplanması.
- Anıt, konvoy ve klan destek picker'larında %5 sınırının uygulanması. Normal raid picker düzeltildi; diğerleri için testler eklendi.
- Kaynak dozu/radyasyon uyarısı ve rapor metinlerinde kalan otomatik dock/ücretsiz yama varsayımlarının kaldırılması.
- NPC savunma dengesi korunurken kendi oyuncu filosunun NPC karşısında da başlangıç canı kuralına uyması. Savaş içinde eşiği geçen geminin ateşe devam etmesi ve pasif geminin kaçış tehdidini şişirmemesi.
- Botların oyundaki otomatik aktarım kaldırıldıktan sonra normal manuel işlem API'si üzerinden ücretli bakım kararı vermesi.
- Tekrar kayıtlarında tam gezegen görünümü yerine küçük, değişmeyen işlem sonucu tutma; tekrar cevabında güncel gezegeni okuma. Bu hem kayıt boyutunu hem eski arayüz verisi riskini azaltır.

İkinci taramanın bu maddeleri uygulandı ve hedefli testlerde doğrulandı. Ek olarak klan savaşı rota tahmini seçilen başlangıç yaralarını kullanır; yüzde radyasyonu kesirli yarayı atmaz. Canlı stok güncellemesi seçilen transfer gemilerini kaldırırsa gönderim kapanır; son transfer dosyasında 50 test geçti. Boş onarım ve kara savunmasının bakım servisine doğrudan aktarımı reddedilir. Yeni bakım/onarım cevapları merkezi istemci sözleşmesi testine eklendi ve geçti. Tam sunucu ve arayüz taramalarının bulguları ve düzeltme tekrarları yukarıda kayıtlıdır.


## Owner isteğiyle ek CR — 14–15 Ekim 2026

Kapsam yalnız bu işte eklenen manuel bakım, kalıcı yara, savaş uygunluğu ve ilgili arayüz değişiklikleridir. Paylaşılan master üzerindeki Honor, tempo, atmosfer ve stratejik görsel çalışmalar bu CR'nin sahipliği dışındadır; ortak dosyalar bütünüyle geri alınmadı veya yeniden yazılmadı. Radyasyon bombası uygulamasına geçilmedi.

### Doğrulanan bulgular

| Öncelik | Tekrarlanabilir hata | Uygulanan düzeltme ve test |
| --- | --- | --- |
| P1 | Eski kurallı sezonda transferin STAY/RETURN ayrımı `lotsWithin` ile kesirli yarayı siliyor; 0 bp + kesir yarası tamamen kayboluyordu. | Her iki bacakta `normalizeHpDamage` kullanılır. Ruleset 15 ve 18 için gerçek fırlatma/worker/iniş testinde tam yara korunur. `maintenance-review.test.ts`; eski sürüm RED. |
| P1 | Yolda savaşamayacak hâle gelen filo savunmasız hedefe ulaşınca DECISIVE alabiliyordu. Sağlıklı kargo gemileri de bu açığı kapatmıyordu. | Savaş başlangıcında uygun **savaş hull'u** yoksa sonuç REPELLED. Savaş içinde eşik geçişi mevcut kuralıyla devam eder. Kargosuz ve üç Courier'li saf kural testleri RED; gerçek raid worker testinde yağma sıfır, yaralı dönüş korunur. |
| P1 | Parçalama cevabı kaybolunca onay kapatılıp tekrar açıldığında yeni işlem anahtarı oluşuyor, yeterli stok varsa ikinci kez gemi parçalanabiliyordu. | Onay aynı seçim için mevcut niyet anahtarını kullanır. `manual-repair-station` kayıp cevap/yeniden açma testi RED→GREEN. |
| P1 | Radyasyonda tahliye isteğinin can alanları canlı güncellemeyle değişiyor; kayıp cevabı tekrar denemek yeni lot/adet çekme işlemine dönüşebiliyordu. | RETURN yalnız lot kimliği/adet gönderir; gerçek canı sunucu okur, aynı niyet aynı anahtarla tekrar edilir. HTTP şeması RETURN için canı opsiyonel kabul eder; SCRAP için iki can alanı zorunlu kalır. UI tekrar testi ve gerçek HTTP dönüş/aynı anahtarla tekrar testi RED. |
| P2 | DOCK, RETURN ve evden SCRAP teleskop izleyicilerini bilgilendirmiyordu; görünen filo eski kalabiliyordu. | Yalnız evdeki görünür filo değişince mevcut özel sight bildirimi gönderilir. Üç işlem ve aynı anahtarla tekrar testlerinde ilgili gözlemci bir bildirim alır; ilgisiz oyuncuya ve public kanala bildirim gitmez. Üçü de önce RED. |
| P2 | 0 bp + kesirli yara taşıyan gemi ücretli onarım kuyruğunda “0% damaged” görünüyordu. | İş satırı ve çoklu lot chip'leri kesri mevcut yukarı yuvarlanan yüzde gösterimine katar. Tek/iki lot UI testlerinde önce yanlış sıfır gözlendi. |

API kontrolü, tahliye düzeltmesinin yalnız mock UI ile doğrulanmasının yeterli olmadığını gösterdi: eski HTTP şeması canı zorunlu tutup yeni RETURN isteğine 400 veriyordu. Gerçek HTTP regresyonuyla doğrulanıp şema da aynı sözleşmeye getirildi. Parçalamada eksik can hâlâ 400'dür.

### Performans ve kapsam sınırı

- Yeni savaş kontrolü filo/gemi adedi kadar değil, mevcut stack ve sabit hull listesi kadar çalışır.
- Kesirli yara ve parçalama grup bazlı kalır; gemi başına kayıt/iş üretilmez.
- Teleskop yenilemesi shard broadcast yapmaz; yalnız mevcut ilgili watcher'lara, transaction commit'inde gider. Replay aynı bildirimi tekrar üretmez.
- Tahliye anahtarı artık can tick'iyle değişmez; onarım/parçalama fiyat snapshot'ı doğrulaması gevşetilmez.
- Can sırası, kısmi adet, kaynak yuvarlama, manuel onarım iptali ve future radyasyon ayrımı yeniden okundu. Yeni tasarım veya oyun dengesi kuralı eklenmedi.
- Gezegen/dock radyasyon hasarı ve REPAIR otomatik tam iadesi henüz uygulanmış sayılmaz. İkinci aşamada source başlangıcı, worker completion, manuel iptal, ölüm ve sahiplik değişimi aynı kilit/terminal durum kurallarıyla birleşmeli; eski completion event'i iptal edilmiş işi tamamlayamamalı.

### Ek CR doğrulaması

- Tam normal rules: **131 dosya / 2.303 test geçti** (`/tmp/astera-maintenance-cr-full-rules.log`).
- Tam normal server: **271 dosya geçti; 1 dosyada 1 başarısız; 3.697 test geçti, 3 atlandı** (`/tmp/astera-maintenance-cr-full-server.log`). Tek başarısızlık transferde kanonik `remainderBp: 0` alanını eski testin beklememesiydi; beklenti düzeltildi ve ilgili dosya son 15 testlik tekrarda geçti. Tek çalıştırmada 272 yeşil dosya iddiası verilmez.
- İlk hedefli regresyon: rules 72, server 49, web 41 test geçti. Cargo durumu tam rules taramasında geçti. Son transfer/API/worker tekrarında 3 dosya / 15 test geçti (`/tmp/astera-maintenance-cr-api-green.log`).
- İlk tam web çalışması sonuç özeti üretmeden kesildi; başarılı tam tarama olarak sayılmaz.
- Rules/server/sim tip kontrolleri ilk turda geçti. Web tipi RETURN can alanlarının opsiyonelliğine uyarlandı ve son web tip kontrolü de geçti (`/tmp/astera-maintenance-cr-types-web-final.log`).
- Web ve tools/sim/root lint grupları geçti. Server/rules grubunda bakım dışındaki beş mevcut Honor hatası var: `honorActivation.ts:17`, `honorNavy.ts:4`, `honor-shadow-cli.test.ts:22`, `honor-strategic-reference.test.ts:3`, `honorTactical.ts:43`. Owner kapsamı gereği bu dosyalar değiştirilmedi. Bakım dosyalarında lint hatası raporlanmadı; bütün depo lint'i yeşil değildir.
- Son tam web taraması **454 dosya / 6.129 test geçti; 1 dosya ve 29 test atlandı** (`/tmp/astera-maintenance-cr-full-web-final.log`). Başarısız test yok.
- Son görsel kontrol **60 durumun tamamında geçti**: altı dil, 350px/1280px, hangar/parçalama onayı/radyasyonda çıkış/filo/radyasyonlu filo. Görseller ve ölçümler `out/ship-maintenance-review/` altında; Türkçe 350px parçalama onayı ayrıca görüntülenerek kontrol edildi. `git diff --check` temiz.
- Uzun ekonomi/sezon simülasyonları çalıştırılmadı. Geliştirme/canlı veritabanına migration, commit veya yayın yapılmadı.
