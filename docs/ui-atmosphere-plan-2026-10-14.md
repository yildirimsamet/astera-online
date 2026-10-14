# Astera — görsel atmosfer ve bölüm sanatı planı

14 Ekim 2026, revizyon 3 — onaylı uygulama. İlk tasarım önizlemesi: [ikinci tasarım panosu](../out/ui-art-audit/v2/index.html). Güncel gerçek bileşen görüntüleri `out/atmosphere-implementation/` altında. Revizyon 2 önizlemesi aşağıda tarihsel kanıt olarak korunur; uygulama için **revizyon 3 kararları** geçerlidir.

Sahibin ilk önizleme geri bildirimi bu revizyonun yönünü belirler: menü kartlarının yaklaşımı beğenildi; arka planın üstüne PNG bina koymak reddedildi; daha fazla yüzey ve küçük tasarım değişiklikleri istendi. Uygun hazır Stellar görsellerinin doğrudan kullanımına izin var, fakat ucuz görünen veya konuyla uyuşmayan resim kullanılmayacak.

## İstenen deneyim

Oyuncu aynı mavi kutulardan oluşan bir uygulamayı değil, kendine ait dünyayı yönettiği bir uzay oyununun komuta güvertesini hissetmeli. Bazı bölümlerde ve bazı navigasyon butonlarında konuya uygun resimler, ölçek, malzeme ve ışık bu hissi güçlendirecek. Araştırma ağacı bunun mevcut başarılı örneği.

Sahibin açıklaması: Stellar yalnızca isteği anlatan örnek. Astera'nın menü yapısı, ikonları, gemileri, kuralları ve Command Deck kimliği esas. Yeni sanat bu kimliğin devamı olacak; referans oyunun görsel sistemi tasarım hedefi değil.

Bu aşamanın çıktısı: kod ve ekran incelemesi, APK arşivi/görsel envanteri, ekran–sanat eşleştirmesi, Astera'ya özgü bir atmosfer eskizi, gerçek bileşenler üzerinde geçici CSS kompozisyonları ve uygulama sırası.

## Çalışma ve sürüm sınırı

- Worktree: `/home/yildirim/Desktop/Coding/MyProjects/blindspace-ui-atmosphere`.
- Branch: `design/astera-atmosphere`.
- Başlangıç: `77b3c2be17a06209305d299c0818dcc8d1db75ac`.
- Başlangıç SHA'sı çalışma sırasında `https://asteraonline.space/release.txt` üzerinden okundu. Bu web yayınının kimliğidir; bütün sunucu rollerinin sürümünü doğrulayan bir deploy incelemesi yapılmadı.
- Master'ın HEAD'i `a8abe4c` idi ve yüzlerce bekleyen değişikliği vardı. Bu worktree master'ın çalışma dosyalarından oluşturulmadı; bekleyen değişiklikler taşınmadı.
- APK'lar ve inceleme dosyaları `out/ui-art-audit/` altında. Kaynak oyunun APK'sı ve ham arşivi yayın paketine girmeyecek.
- Revizyon 3 ile web uygulama kaynakları ve görseller güncelleniyor. Oyun kuralları, şema ve API değişmedi; deploy yapılmadı. Normal sunucu testleri için ayrı `astera_atmosphere_test` veritabanı kullanılır; bu bir ürün veritabanı değişikliği değildir.
- Uygulama aşaması da bu worktree'de ilerlemeli. Erken yayın yalnız bu dala ait seçilmiş değişikliklerle hazırlanmalı. Master'a toplu merge erken yayının önkoşulu yapılmamalı. Yayın günü temel sürüm yeniden okunmalı; aradaki gerekli hotfix'ler seçilerek alınmalı.

## İnceleme kanıtı

Okunanlar: `CLAUDE.md`, ilgili `docs/interface.md`, `docs/visual-design.md`, `docs/ui-v2/gozlemevi.md` bölümleri; shell, navigasyon, araştırma, bina kartları, filo, istihbarat, klan, ödül ve liderlik bileşenleri.

İlk inceleme mevcut master dosyaları üzerinde yapıldı. Ayrı worktree talebinden sonra **yayındaki commit'in gerçek bileşenleri** 350×812, 585×1266 ve 1280×812 boyutlarında yeniden görüntülendi. Karşılaştırmanın esas kaynağı `out/ui-art-audit/live-baseline/`; `astera/` klasörü önceki incelemedir.

Görüntüler geliştirme galerisindeki fixture verileriyle gerçek React bileşenlerini çalıştırır. Bunlar bir oyuncunun canlı hesabının durumunu veya cihaz FPS'ini doğrulamaz. Giriş/eğitim ekranı ayrıca ilk incelemede görüntülendi; hesap açılmadı. Üst kaynak barı ve dock galeride ayrıca yakalandı. Gerçek shell'in masthead ve desktop yerleşimi koddan incelendi.

Yerel inceleme panosu: [index.html](../out/ui-art-audit/index.html). Kaynak ölçümleri ve ekran kontrolü: `image-inventory.json`, `apk-manifest.json`, `concept-review.json`.

## Mevcut yapıda ne var?

| Yüzey | Gerçek yapı | Görsel değerlendirme |
| --- | --- | --- |
| Üst alan | `HudTop` içinde `BrandMasthead`, üç kaynak ve üretim okuması, bildirim/menü, `NowLine` | Kaynakların kendi render'ı ve ayrı rengi zaten var. Baskın koyu mavi metal, küçük resimler ve sık tekrarlanan çerçeveler atmosferi düzleştiriyor. |
| Alt dock | Galaksi / Üs / Filo / İstihbarat / Klan; 64 px, ikon + ad, durum rozetleri | Galaksi üzerinde saydam; panel açılınca zemin kazanıyor. Beş ayrı büyük resim için alan dar. Durumların ve ikon siluetlerinin okunması öncelikli. |
| Ana menü | Mağaza vitrini, sezon kutuları, Astera ekibi, yardım, cihaz/hesap tercihleri; iki sütun | Mağaza zaten güçlü bir görsel örnek. Diğer hedef kutuları aynı küçük ikon ve düz yüzeyi tekrar ediyor. Grup hiyerarşisi değerli. |
| Üs | Gezegen portresi + StarField, depolar, kuyruklar, Üretim / Bilgi / Savunma / Taktiksel / Filo | Üst gezegen sahnesi başarılı. Aşağıda çoğu kartın 96 px sanat alanında 84 px izole render ve aynı mavi radial zemin var. |
| Araştırma | Nebula ve SVG yıldızları üzerinde takımyıldız; altta seçilen projenin kararı | Görsel, bölümün işleviyle örtüşüyor. Gökyüzü karar düğümlerini bastırmıyor. Korunacak örnek. |
| Filo sayfası | Havada / Evde / Hangar; uçuş ve kapasite bilgileri, dünya satırları | Filo konusu güçlü; özet yüzeyinde onu hissettiren çevre sanatı yok. Liste yoğunluğu korunmalı. |
| İstihbarat | Gözlem / Raporlar / Radar; hedefler, netlik, pencereler ve zaman çizelgeleri | Veriye öncelik doğru. Başlık ve sınırlı bağlam alanı sensör/observatuvar kimliği taşıyabilir. |
| Klan | Klan kimliği, beş koltuk, kuvvetler/yardım/savaş, sıralama | İşlevsel ama ortak operasyon salonu hissi zayıf. En yüksek kazanç klan kimliği yüzeyinde. |
| Liderlik / Ödüller | Sıralama ve kademe okumaları; ödül zincirleri ve alma butonları | Prestij üst bağlamda artabilir. Sıra tabloları ve ödül kararları sakin, karşılaştırılabilir kalmalı. |
| Giriş / mağaza | Kendi sahnesi, logo dili, ürün vitrini | Mevcut güçlü yüzeyler. İlk uygulama önceliği oyun içi tekrarlayan alanlar. |

Temel neden resim eksikliği kadar **bütün yüzeylerin aynı ağırlıkta olması**. Aynı panel zemini, radial ışık ve ince çerçeve bir sonraki bölümü öncekinin devamı gibi gösteriyor. Mevcut sanatın çoğu nesne render'ı: bina veya gemi var, fakat o nesnenin yaşadığı ortam yok.

Görsel atmosfer için öznel ilk değerlendirme: 6/10. Bu bir kullanılabilirlik veya performans puanı değil. 10/10 hedefi için bölüm kimliği, doğal malzeme çeşitliliği, mobilde seçilebilen sanat, içerikle ilişkili kompozisyon ve gerçek cihaz doğrulaması birlikte sağlanmalı.

## Referans oyundan öğrenilenler

ADB ile cihazdaki `fr.enoxys.stellardominion` paketi bulundu: Stellar Dominion 5.4.0, versionCode 5040001. Ana APK ve beş split APK çekildi. Ana APK 92.168.677 byte; diğerleriyle birlikte paket dosyaları yaklaşık 118 MB.

Flutter varlık dizini: `assets/flutter_assets/assets/`. 422 raster görsel bulundu: 398 JPG, 24 PNG; görüntü dosyaları toplam 65.074.697 byte. Görsel dışı bu dizinde 138 JSON, altı TTF, beş WAV, beş MP3 ve bir SVG de var. Kaynak adları, ölçüler, byte sayıları kataloglandı; APK SHA-256 değerleri kaydedildi. Telefon çıkarıldıktan sonra inceleme yerel dosyalarla sürüyor.

Görsel aileler anlamlı: `Banner_*` dar navigasyon sahneleri; `BG_*` çevreler; `Nav_*` navigasyon resimleri; bina/teknoloji/gemi resimleri; `Tutorial_*` açıklayıcı sahneler. Referansların başarısı, bu aileleri aynı amaç için kullanmamaları.

- Dar yatay sahne, başlığın neye açıldığını daha okumadan hissettiriyor.
- Nesne ve çevre birlikte gösterilince bina kartı bir ikon olmaktan çıkıyor.
- Sıcak endüstriyel ışık, koyu metal, uzay ve nadir mor derinlik ekranın ritmini değiştiriyor.
- Metin resmin en hareketli yerine konmuyor; karanlık bir cep ve yönlü geçiş oluşturuluyor.
- Seçili/kilitli durumlar görselden bağımsız okunabiliyor.

Ekran görüntülerindeki `Banner_Orbit.jpg` (1024×344), `Banner_Scanner.jpg` (1024×207), `Banner_RaidDifficulty.jpg` (1024×574) gibi dosyalar bulundu. Orbit / Scanner / Raid / Expedition etiketleri Astera'ya taşınmayacak: aynı adlar altında farklı mekanikler var.

### Arşivden hangi görseller işe yarayabilir?

Bu bir **aday/reference listesi**, oyun için onaylanmış sanat listesi değil. Kullanıcı yeniden kullanıma izin verdi; ayrı bir lisans araştırması yapılmadı. Görselin Astera'ya ait görünmesi seçimin ana ölçütü.

| Dosyalar | Yararlı tarafı | Astera'daki değerlendirme |
| --- | --- | --- |
| `BG_Commander`, `Achievement_Empire` | Komuta güvertesi, pencere, karanlık metal, sıcak ışık | Özgün komutan/menü sanatı için ışık ve kompozisyon referansı. |
| `BG_Alliance_Hall`, `Achievement_Strategy` | Ortak salon ve operasyon masası | Klan sahnesi için yerleşim referansı; mevcut Astera klan kimliğine göre yeniden üretim tercih edilir. |
| `BG_Orbit`, `Banner_Orbit` | Dar alanda gezegen ölçeği ve orbital derinlik | Yörünge ve filo başlığı için kırpma/ölçek referansı. |
| `Banner_Mail_Espionage`, `Banner_Scanner` | Sensör, uzay ve bilginin yönü | İstihbarat başlığı için aday; finalde sahte radar düğmeleri/halkaları içermeyen Astera observatuvarı tercih edilir. |
| `Tutorial_Economy`, `BG_Commerce`, `BG_Optimization` | Üretim mekânı, tesis, metal yüzey | Üretim kartlarına çevre derinliği verme referansı. |
| `Tutorial_Fleet`, `Tutorial_Defense`, `Spec_CalesSeches` | Hangar ve savunma mekânı | Çevre mimarisi incelenir; resimdeki başka gemi/bina Astera nesnesi olarak sunulmaz. |
| `Banner_Exp_Resources`, `Tutorial_Mining`, `Stat_Debris` | Madencilik, enkaz, hammadde dokusu | Astera'nın mevcut madencilik/enkaz bağlamları için atmosfer adayı. Yeni bir görev menüsü yaratmaz. |
| `Galaxy_*` | Farklı yıldız, toz ve galaksi tonları | Uzak uzay ışığı ve renk dengesi için referans; canlı 3D galaksinin yerine düz arka plan koyulmaz. |
| `BG_Season`, `Achievement_Special` | Sezon/prestij sahnesi | Sezon bağlamı için araştırma; mevcut gameplay sınırlarına ve ödüllerin gerçek içeriğine göre sanat hazırlanır. |
| `Nav_*`, `Rank_*`, gemi/bina/portre resimleri | Stil ailesini anlamaya yardım ediyor | Mevcut ikon ve model kimliğimizin yerine geçmesi önerilmiyor. Katalogda korunuyor. |

Çıkarmak, incelemek ve kullanmak ayrı aşamalar. Hepsi arşivde erişilebilir; bir görsel yalnız güzel olduğu için bir Astera nesnesinin karşılığı yapılmayacak.

## Astera'nın kendi sanat yönü

**Üzerine resim yapıştırılmış paneller yerine, sahneye açılan işlenmiş metal yüzeyler.**

Mekân, mevcut nesne render'larından türetilmeli: Command Core'un ağır katmanlı kütlesi, rafinerinin sıcak çekirdeği, hangarın mekanik parçaları, yeni araştırma görsellerindeki gerçekçi çelik ve seramik. Binanın tanınan silueti, nesne türü ve kademesi korunur. Kartta **bina ve çevresi tek resimdir**: perspektif, zemin teması, ışık ve gölge resmin içinde çözülür. Mevcut PNG yalnız üretim referansı olabilir; ürün yüzeyinde bir arka planın üstüne ayrıca bindirilmez.

| Bölüm | Mekân ve malzeme | Işık/atmosfer | Oyuncuya hissettirdiği |
| --- | --- | --- | --- |
| Komutan / menü | Grafit komuta güvertesi, metal pencere çerçevesi, uzak gezegen | Çelik beyazı, sınırlı sıcak yansıma | Ben bu dünyanın komutanıyım. |
| Üretim | Bakır borular, cevher, ağır tesis ve robotik servis | Sıcak fırın ışığı; kristalde buzlu beyaz, yakıtta mevcut kaynak kimliği | Bir üretim altyapısı geliştiriyorum. |
| Filo / tersane / hangar | Derin servis hangarı, iskeleler, özgün Astera gövdesi | Soğuk beyaz görev ışıkları, motor ve metal yansımaları | Filom bir listeden ibaret değil. |
| Bilgi / istihbarat | Observatuvar penceresi, optik sistemler, uzak uzay | Soluk yıldız beyazı ve derin gece; parça olarak ölçülü mor | Uzakta göremediğim bir şey var. |
| Savunma | Zırhlı yapı, bariyer, kalın malzeme | Nötr metal ve yerel çalışma ışığı | Dünyamın dayanıklılığını kuruyorum. |
| Taktiksel | Kontrollü ağır teknoloji, karanlık servis bölmesi | Yoğun kütle, lokal beyaz ışık | Yüksek etkili bir araç yönetiyorum. |
| Klan | Ortak operasyon salonu, uzun masa, dışarıda bir filo | Klan mavisi sınırlı işaretlerde; çevre nötr | Başka komutanlarla birlikte hareket ediyorum. |
| Sezon / ödül | Gezegen şafağı, yolculuk ve gelişen donanım | Doğal altın ışık; premium yalnız gerçek premium yerde | İlerlememin bir sonucu ve hedefi var. |

Sahibin revizyon talebiyle sıcak/mor/beyaz farklılıklar artık sanatla sınırlı değil: **bölüm zemini, malzeme çerçevesi ve sekmenin konu çizgisi** de çeşitlenebilir. Bakır üretim, mor bilgi/araştırma, çelik filo/savunma, gece mavisi klan, şampanya sezon yüzeyleri deneniyor. Bunlar oyun durumunu değil bölümün malzemesini anlatır. Kırmızı tehdit, turkuaz kendi eylemi/seçili durum, mavi klan, sarı kapanabilir eksik; kaynak renkleri ikonlarıyla birlikte kalır. Sakin savunma kartı sırf askeri olduğu için kırmızıya boyanmaz.

Metal zeminde grafit ve nötr koyuluk, sahnede doğal renk çeşitliliği, etkin kontrolde mevcut semantik ışık kullanılır. Bütün `v2-panel` renklerini tek hamlede değiştirmek yerine önce birkaç yüzeyde kanıtlanır.

## Ekran ve uygulama haritası

| Öncelik | Yer / kaynak | Önerilen uygulama | Kapsam sınırı |
| --- | --- | --- | --- |
| 1 | `shell/MenuPanel.tsx` → `MenuTile` | Liderlik, ödül, duyuru ve Wiki hedeflerinde sağ/üst odaklı sanat. Mevcut iki sütun, adlar, grup başlıkları ve kutu yüksekliği korunur. Destek, geri bildirim ve tercihler daha sakin metal taşır. | Tüm kutuları tam genişlikte banner listesine çevirmemek. Mevcut mağaza vitriniyle yarışmamak. |
| 1 | `ui/UpgradeRow.tsx` → `layout="card"` | Mevcut 96 px sanat alanında bina ve çevresini içeren tek tam sahne. Sanat aşağı doğru bölümün metaline erir. Kademeye uygun, tanınan bina silueti kullanılır. | Ayrı PNG bindirme yok. Fiyat, süre, kazanç ve kilit koşulu kendi sakin alanında. İyi sahne yoksa mevcut sade nesne resmi kalır. |
| 1 | `screens/PlanetScreen.tsx` bölüm bağlamları | Üretim ve filo grubundaki mevcut karar alanlarına küçük, içeriğe göre kırpılmış atmosfer. Yeni ayrı bir dev hero eklenmez. | Gezegen portresi zaten güçlü; altında ikinci bir büyük gezegen görseliyle alan tüketmemek. |
| 1 | `v2/hud/FleetPage.tsx` | Başlık/özet için ince hangar penceresi; uçuş kapasitesi ve hangar rakamları sağlam koyu zeminde. Liste, dönüş/çağrı kontrolleri ve zamanlar sakin kalır. | Filo hareket satırlarını ayrı ayrı resimli banner yapmak karşılaştırmayı zorlaştırır. |
| 1, ölçülü | `v2/hud/TopBar.tsx`, `ResourceMeter.tsx`, `brand/Identity.tsx`, `brand/styles.css` | Nötr metal, daha belirgin mevcut kaynak görüntüsü, lokal ışık. Mevcut yükseklik ve veri hiyerarşisi korunur; kaynak resimlerini 18–20 px denemek yalnız genişlik bütçesi izin verirse. | Kaynak rakamlarının arkasında resim veya bütün şeritte yoğun uzay fotoğrafı yok. Masthead kimliği korunur. |
| 1, ölçülü | `v2/hud/Dock.tsx` | İşlenmiş yüzey hissi, daha iyi ikon kontrastı ve seçili düğmenin kendi ışığı. Görsel denenecekse yalnız seçili düğmenin ikon arkasında çok zayıf bağlam dokusu. | Sıra, 64 px yükseklik, ikon/ad/rozet ve galaksi üzerindeki saydamlık korunur. Beş fotoğraf/farklı neon renk kullanılmaz. |
| 2 | `screens/IntelScreen.tsx` | Başlık veya mevcut boş durum açıklamasında optik/observatuvar ortamı. Gözlem–radar–rapor için ilgili kırpma. | Netlik rampası, sensör şekilleri, süre ve karşılaştırma çizgileri sanatın önünde kalır. Resimde sahte canlı sinyal görünmez. |
| 2 | `screens/ClanScreen.tsx` klan kimliği | Mevcut klan kimliği paneli ortak operasyon salonuna açılır. Etiket, üye sayısı, güç/hâkimiyet ve lider durumu okunur. | Beş koltuk, üye listeleri ve savaş sayıları aynı karşılaştırılabilir düzende kalır. |
| 2 | `LeaderboardScreen.tsx`, `RewardsScreen.tsx`, `SeasonRecap.tsx` | Üst bağlamda prestij/ilerleme sanatı; gerçek ödül kaynakları ve mevcut item art'ı görünür. | Sıra tabloları ve her ödül kademesi yoğun fotoğraf taşımaz. Sıralama hesabına dokunulmaz. |
| 2 | `ResearchPanel.tsx` seçili proje | Takımyıldız korunur. Seçili proje kartı/detayında kendi premium proje görseli daha büyük ve kompozisyonun parçası olabilir. | Projenin resmi başka projenin arka planı yapılmaz; proje yıldızlarından daha parlak arka plan yıldızları eklenmez. |
| 3 | `BattleReports.tsx`, `ReportScene.tsx` | Savaş sonucunun mevcut kimliğini destekleyen sınırlı sahne; mevcut Astera gövdeleri ve sonuç anlatımı. | Tablolar, kayıp/kazanç ve gerçek savaş verisi baskılanmaz; herkes için aynı zafer sanatı gösterilmez. |
| 3 | `ServersScreen.tsx`, `WorldsPanel.tsx`, Wiki | Mevcut galaksi/gezegen seçiminin kendi görsel kimliğini küçük alanda güçlendirmek. Wiki'de içeriğe bağlı bölüm resmi. | Formlara ve her paragrafın arkasına genel nebula eklenmez. |

Kural: Görsel için **mevcut alan** kazanır. Bir bölümde zengin bir resim, altındaki bütün satırlara ayrı resim eklemekten daha güçlüdür. Bir görsel yalnız başlığı süslüyorsa düşük öncelik; nesneyi tanıtıyor, mekânı anlatıyor veya farklı karar alanını ayırıyorsa yüksek öncelik.

## İlk özgün sanat paketi

Başlangıç için yaklaşık 8–10 çevre kompozisyonu yeterli. Her bina için baştan ayrı sahne üretmek gereksiz; birkaç doğru çevre, mevcut özgün nesneler ve farklı kırpma ile güçlü çeşitlilik sağlar. Hiçbir iki farklı nesneye aynı temsil resmi atanmamalı.

| Sanat brief'i | Kullanım | Kompozisyon |
| --- | --- | --- |
| Komuta güvertesi | Duyuru/komutan bağlamı | Koyu sol cep, sağda dış uzay ve işlenmiş metal. Gömülü yazı veya arayüz yok. |
| Üretim dökümhanesi | Alaşım/üretim bölümü | Bakır ve sıcak fırın; mevcut rafineri önde. Resme yeni bir bina kimliği işlenmez. |
| Kristal işleme ortamı | Kristal kartı | Keskin soğuk malzeme, beyaz ışık; kristal kendi kaynağının renginde. |
| Yakıt tesisi | Döteryum kartı | Seramik/borular, ölçülü mevcut yakıt ışığı. |
| Orbital hangar | Filo ve tersane | İskeleler, mekanik ölçek; tanınabilir bir gövde olacaksa yalnız mevcut Astera gövdesi. |
| Observatuvar | Bilgi/istihbarat | Lens/mekanik yapı + derin uzay; fotoğrafta radar düğmeleri ve sahte veri yok. |
| Zırhlı çevre | Savunma | Nötr ağır metal; barış zamanında tehdit kırmızısı yok. |
| Ortak operasyon salonu | Klan | Mevcut klan kimliğini taşıyacak sakin alan; hayvan arması veya başka oyunun bayrağı yok. |
| Sezon ufku | Liderlik/sezon | Büyük ölçek, doğal yıldız ışığı, sakin koyu metin alanı. |
| Madencilik/enkaz | İlgili karar bağlamları | Kaynak ve uzay dokusu; mevcut kazıcı kimliğiyle tutarlı. |

Master dosyaları öneri: 1536×1024 / 1536×512; kart çevreleri 1024×640. Yayında kare render, yatay banner ve mobil kırpma ayrı değerlendirilir. Konu odak noktası ve güvenli metin bölgesi her varlıkla kaydedilir.

**Mevcut özgün eskiz:** `out/ui-art-audit/original/astera-orbital-deck-concept-v1.png`. Yerleşik `image_gen` ile üretildi; Stellar resmi veya ikonu üretim girdisi olmadı. Bu tek çevre, Astera'nın karanlık mekanik malzemelerini sıcak doğal ışık ve gezegen ölçeğiyle birleştirme yönünü sınamak için hazırlandı. Final çevre ailesinin tamamı değildir.

Eskizin sağdaki ufku çok parlak; küçük kartta metin bu alana konmamalı. Nihai varlıklarda mobil kırpma için daha büyük sakin bölgeler hazırlanmalı. Farklı bölümlerin hepsine bu tek resmi tekrar etmek hedef değil.

## Görselin yüzeye yerleşme kuralları

1. Sanat, metin, durum ve etkileşim ayrı katmanlar. Sanat dekoratif ve tıklama yakalamaz; başlık, kilit, rozet ve focus üstte kalır.
2. Yönlü karartma kullanılır. Resmin tamamını çok düşük opaklığa indirip yine düz bir mavi kutu üretmek çözüm değil. Sanat kendi cebinde görünür; metin kendi cebinde nettir.
3. Kart resmi doğal metal zeminle geçiş kurar. Bina ve ortam **tek sanat dosyasıdır**. `cover` yalnız buna göre hazırlanmış tam sahnede kullanılır; nesnenin tepesi/üretim organı kırpılmaz. Resmin üstüne yeniden PNG nesne konmaz.
4. Bir sanatın odağı hover'a veya masaüstüne bağlı olmaz. İlk mobil çizimde işlevi okunur.
5. Kilitli nesnede sanat desatüre edilir; ad, neden ve açma koşulu güçlü kalır. Üretimde ve tamamlanmış durumda kilit görseli kullanılmaz.
6. Hareket ilk pass'in koşulu değildir. Statik ortam, canlı 3D galaksinin üzerine yeni Canvas/video/blur yükü bindirmez. Daha sonra hareket eklenecekse mevcut tek geçiş eğrisi ve anlamlı durumla sınırlanır.
7. `plate / slab / socket`, mevcut font ve tür ölçeği korunur. Büyük reklam başlıkları ve yeni ikon sistemi eklenmez.
8. Sanat yüklenmese de yüzey ve etkileşim çalışır; ölçüsü ilk çizimden itibaren ayrılır. Sayının arka planı ve kontrastı görüntüye bağımlı olmaz.

Hedef ölçüler: menü kutusu mevcut ~80 px; bina sanat alanı mevcut 96 px; dar bağlam bandı ancak mevcut başlık alanının içinde 48–72 px. 350 px telefonda yeni dekoratif boşluk veya fazladan scroll oluşturmak kabul edilmez. Ölçüler uygulama öncesi gerçek DOM'dan yeniden ölçülür.

## Teknik kapsam ve doğrulama

İlk yayın **web sanat/CSS/bileşen sunumu** ile sınırlı tutulabilir; mevcut API ve rules paketinden bağımsız olmalı. Dekoratif çevre eşlemesi, nesne temsil eşlemesinden ayrılır. Bir ihtiyaç kanıtlanmadan büyük bir tema motoru veya tüm UI için soyut component ailesi kurulmaz.

Beklenen dokunma alanları: yukarıdaki bileşenlerin sanat kapsayıcıları, `v2/surfaces.css`, gerekiyorsa ayrı küçük bir ortam CSS'i, özgün sanat manifesti ve optimize görsel dosyaları. `ui/assets.ts` içindeki bina/gemi/araştırma ID → temsil sözleşmeleri korunur. Yeni varlıkların canonical yolları sürümlü olur; immutable cache dikkate alınır. Üretim klasörü önerisi `public/assets/images/atmosphere/`, orijinaller `assets/source/atmosphere/`.

Hedef ağ bütçesi, ölçülmüş sonuç değil: küçük kutu resmi yaklaşık 15–40 KB, çevre banner'ı 30–70 KB; bir ilk görünümün ek sanatı mümkünse 200–300 KB altında. Dosya boyutunu tutturmak için okunabilir sanat bozulmaz. Görünmeyen bölümün büyük resmi başlangıç paketiyle yüklenmez; sonraki aynı URL tarayıcı önbelleğini kullanır. Ham 65 MB referans arşivi ürün paketi değildir.

| Doğrulama | Kabul ölçütü |
| --- | --- |
| Mobil 350×812 ve 585×1266, masaüstü ≥1100 | Yatay taşma yok; isim, fiyat, süre, kapasite ve koşul görünür. Dock/safe-area ve kolon düzeni doğru. |
| Ekran ekonomisi | Aynı ilk görünümde önceki karar sayısı korunur; görüntü dekorasyonu yüzünden liste aşağı itilmez. |
| Kontrast | Metin alanlarında küçük yazı için en az 4,5:1 hedefi; sanatın parlak/karanlık kırpmalarında ayrı ölçüm. Geçici mockup'lar bunun nihai kanıtı değil. |
| Durumlar | Seçili, kilitli, elde olmayan, üretimde, tamamlanmış, hasarlı, yüklenemeyen resim ayrı gözden geçirilir. Semantik ışık korunur. |
| Etkileşim | Sanat butona/hold kontrolüne dokunmayı engellemez. Önkoşul linkleri, geri dönüş, keyboard/focus ve erişilebilir adlar korunur. |
| Dil | TR/EN yanında uzun DE/FR ve JA; başlık ve fiyat satırı kesilmez. |
| Performans | Gerçek telefonda ağ/çözümleme, scroll ve sahne frame zamanı ölçülür. Headless SwiftShader FPS sonucu cihaz FPS'i olarak raporlanmaz. |
| Yayın kapsamı | Başlangıç sürümüne karşı diff yalnız bu görev. Sunucu/rules/schema/migration değişikliği yok. Master WIP yok. |

CSS ve statik tasarım istisnası repo kuralında mevcut. Yeni manifest/koşul/render davranışı yazılırsa TDD: önce ID eşlemesi ve durum/etkileşim regresyonları, FAIL → uygulama → PASS. Görsel kontroller `node tools/visual.mjs` ailesiyle yapılır. Uygulama sonrası gerekli `pnpm verify` kontrolleri tek workspace/tek worker, `nice -n 10`, Node heap en çok 4096 MB. Uzun ekonomi simülasyonları bu görev kapsamında çalıştırılmaz.

Mevcut riskler: ortak `UpgradeRow` bütün bina/gemi kartlarını etkileyebilir; üstteki sanat uzun isimleri ve state rozetlerini kapatabilir; bir CSS `background` tanımı mevcut state zeminini silebilir; dock'un galaksi üzerindeki saydamlığı bozulabilir; sabit resimler görsel olarak canlı veri sanılabilir. Uygulama önce sınırlı 2–3 yüzeyde yapılır, sonra ortaklaştırılır.

## Uygulama sırası

1. **İnceleme ve görsel yön:** bu doküman, referans kataloğu, özgün çevre eskizi ve mevcut bileşenlerle kompozisyon. Bu aşama tamamlandıktan sonra ilk sanat brief'leri kesinleşir.
2. **En görünür ilk pass:** menüde seçili hedef kutuları, üretim kartları, filo başlığı; üst/dock'ta ölçülü malzeme ve kontrast çalışması. Mevcut akış ve ekran alanıyla kanıtlanır.
3. **Bölüm kimlikleri:** istihbarat, klan, savunma/taktiksel, sezon/ödül; yalnız ilk pass'in başarılı dili yayılır.
4. **Ayrıntılar:** proje kartları, rapor bağlamı, ilgili boş durumlar, Wiki ve galaksi seçimi. Yoğun tablolar en son ve yalnız ihtiyaç varsa.
5. **Yayın hazırlığı:** görsel ve etkileşim kontrolleri, normal gerekli kontroller, optimize varlıklar ve temiz görev diff'i. Erken deploy için ayrı inceleme paketi hazırlanır; bu tasarım planı bir deploy işlemi değildir.

## İlk önizlemelerin sınırı — revizyon 1 arşivi

`concepts/` dosyaları yayındaki gerçek bileşenlere **yalnız tarayıcı içinde** CSS ekleyerek hazırlanır. Metin, fiyat, state, route veya veriler yeniden yazılmadı. Menü örneğinde mevcut Astera kaynak/nebula resimleri ve özgün çevre eskizi kullanılıyor; Stellar görselleri bu kompozisyonlarda yok.

Bu çalışmalar katman, daha nötr metal, çevrenin görünürlük miktarı ve mevcut yüksekliğin korunmasını gösterir. Final sanat seçimi, bütün durumların erişilebilirlik kabulü veya uygulama/test tamamlanması değildir. Ortam sayısı bu aşamada az olduğundan bazı kırpmalar tekrar eder; final plan her bölümün kendi mekânını ister.

Tamamlanan inceleme kontrolleri: temiz sürüm üzerinde 27 ekran (dokuz görünüm × üç genişlik); sıfır tarayıcı hatası ve yatay belge taşması; kompozisyon uygulanan menü kutuları ve ilk bina kartlarında öncesi/sonrası yükseklik eşit. İnceleme panosunda genişlik değiştirme ve arşivde arama çalışıyor; 422 görsel kaydı, sıfır bozuk yüklenmiş resim ve 1440 px'de sıfır taşma kontrol edildi. Bu aşamada ürün kodu değişmediğinden ürün test paketi çalıştırılmadı. Geçici inceleme Vite süreci kapatıldı; pano doğrudan yerel HTML olarak açılır.

## Revizyon 2 — kapsam ve somut tasarım kararları

Önceki PNG + çevre denemesi kaldırılan yaklaşım olarak arşivde durur. Güncel pano onu öneri olarak göstermez. İkinci pass, gerçek bileşenlerin 18 farklı görünümü ile üst bar ve dock'u birlikte kapsar. Her biri 350, 585 ve 1280 px olarak hazırlanır; inceleme sırasında aynı fixture ve aynı dil üzerinden önce/sonra alınır.

### Resim seçimi ve üretim

İyi hazır resim varsa kullanılır. Kriterler: konu doğruluğu, mobilde seçilebilir ana odak, Astera'nın işlenmiş metal ve uzay dili, kırpmada temiz metin alanı, uygun renk dengesi, yeterli kaynak çözünürlüğü. Görselin yalnız yüksek çözünürlüklü olması kalite kanıtı değildir.

Altı özgün tam sahne üretildi: Komuta Çekirdeği, Alaşım Rafinerisi, Kristal Ocağı, Döteryum Rafinerisi, Tersane, Hangar. Her birinde kendi mevcut Astera bina render'ı `image_gen` için referanstı. Sonuçta nesne ve ortam birlikte çizildi; kartta tek `img` gösteriliyor. Kaynaklar ve birebir prompt'lar `out/ui-art-audit/v2/scenes/` ve `v2/prompts.json` içinde.

Bu altı sahne T1 yön çalışmasıdır. T2/T3 veya her seviyeye aynısını atamak yok: uygulama öncesi kademe sözleşmesi ve eksik sahneler tamamlanmalı. Depo için incelenen hazır resimler mevcut ağır güvenli kasa kimliğini yeterince iyi taşımadı; ona uygunsuz bir resim zorlanmadı ve mevcut sade art korundu. Yeni bina art'ı olmayan kartın arkasına dekoratif ortam eklenmedi.

Hazır kaynakların güncel kullanımı:

| Kaynak | Görüntülendiği yer | Seçim nedeni |
| --- | --- | --- |
| `Banner_Mail_News.jpg` | Duyurular menü kutusu | Büyük haber penceresi ve uzay; doğrudan haber/komuta bağlamı. |
| `Banner_Exp_Resources.jpg` | Ödüller kutusu ve ödül özeti | Gerçek kaynak ödüllerine uygun hammadde/uzay sahnesi; yeni para birimi veya sandık mekaniği önermez. |
| `BG_Commander.jpg` | Wiki kutusu ve istihbarat başlığı | Komuta/sensör araçları, gerçekçi koyu metal, güçlü konu bağlantısı. Arka plandaki resim gerçek oyun verisi olarak gösterilmez. |
| `Achievement_Strategy.jpg` | Klan kimliği ve klan operasyon bağlamı | Ortak masa ve operasyon mekânı; başka oyunun klan arması kullanılmıyor. |
| `BG_OffSeason.jpg` | Liderlik ve Sen Yokken başlığı | Gezegen ufku, ölçek ve doğal sıcak ışık; ödül nesnesi gibi gösterilmez. |
| `BG_Orbit.jpg` | Bilgi/yörünge bölümünün küçük bağlam alanı | Geniş orbital derinlik, karanlık metin cebi; gerçek gemi envanteri yerine kullanılmaz. |
| `Spec_Arsenal.jpg` | Savunma/taktiksel bölüm bağlamı | Ağır zırhlı endüstriyel alan; yeni bir bina satırı veya kapasite bilgisi değildir. |
| `Sensor_T2.jpg` | Araştırma başlık bağlamı | Gece gözlemi ve donanım; gökyüzü üzerinde seçilebilir sahte proje düğümü eklenmez. |

İncelenip elenen örnekler: `StorageTech` neon tel kafes; `Spec_ObservatoireStelaire` parlak plastik/oyuncak mimarisi; `BG_Alliance_Hall` baskın başka oyun armaları; `Achievement_Special` büyülü semboller ve aşırı altın; `Banner_Exp_Journal` konuya uymayan ritüel monolitleri; `Tutorial_Defense` mevcut savunmayla karışabilecek büyük başka gemi. Kayıt: `v2/asset-selection.json`.

### Daha geniş yüzey haritası

| Yüzey | Güncel deneme / sonraki net değişiklik |
| --- | --- |
| Ana menü | Beğenilen iki sütunlu görselli hedef kutuları korunur; her hedef ayrı konu resmi, daha nötr zemin ve hafif sezon malzemesi alır. |
| Üretim üst kartları | İki ayrı tam sahne; 96 px art alanı, daha sıcak metal gövde, isim ile kazanç arasındaki küçük ayraç. |
| Üretim alt kartları | Kristal için buzlu sahne; döteryum için yakıt tesisi; kilit yalnız art'ı soldurur, koşul metni okunur. |
| Tersane / Hangar | Aynı nesne PNG'lerini tekrar koymak yerine kendi tam tesis sahneleri. Çelik yüzeyler üretimden ayrılır. |
| Beş üs sekmesi | Bakır / mor / çelik / koyu bronz / soğuk metal konu çizgileri; seçili sekmede aynı turkuaz alt işaret ve güçlü face. |
| İnşaat / tersane / onarım kuyrukları | Her kuyruk daha belirgin bir istasyon yüzeyi içinde; boş slot, aktif iş ve bekleyen iş birbirinden okunur. Fazladan hero değil, küçük çerçeve değişikliği. |
| Bilgi / yörünge | Mor gece malzemesi, küçük orbital bağlam. Radar/teleskop kararları ve asıl nesne art'ı korunur. |
| Savunma | Grafit/çelik ve kalın malzeme; mevcut gerçek savunma rakamları sakin zeminde. Savunma sayfası bütünüyle kırmızı olmaz. |
| Taktiksel | Kontrollü ağır teknoloji malzemesi ve bağlam sanatı; hazır/üretimde/kilitli durum ayrı kalır. |
| Araştırma | Başlık ve proje kartında mor malzeme; kendi mevcut tamamlanmış proje görseli daha belirgin, fiyat/eylem kendi alanında. Takımyıldız okunabilirliği korunur. |
| İstihbarat / Gözlem | Komuta/sensör başlığı, gece moru sekme yüzeyi; hedef listesi ve netlik rampası sakin. |
| Radar | Gözlemle aynı oda ailesi; zaman çizelgeleri ve görsel sensör diyagramları gerçek verisini taşır. Arka plandaki gösterge gerçek sinyal gibi kullanılmaz. |
| Filo / Havada | Hangar bağlamlı başlık, çelik sekmeler ve sakin kapasite plakaları; uçuş satırları karşılaştırılabilir. |
| Filo / Evde | Aynı aile; dünya satırlarında mevcut onarım ve hangar bağlantıları önde. |
| Klan / Özet | Operasyon masası klan kimliğinin parçası; beş koltuk koyu deniz mavisi malzeme ve daha güçlü sınır taşır. |
| Klan / Savaş | Aynı operasyon odası; aktif savaş/tehdit varsa kırmızı gerçek durumun üzerinde, oda dekorasyonunda değil. |
| Ödüller | Kaynak sahnesi özet yüzeyinde; alt zincirlerde daha sıcak metal/ayıraç. Alma butonu ve gerçek ödül miktarı öncelikli. |
| Liderlik | Başlıkta gezegen ufku ve şampanya metal; yoğun sıra listesine her oyuncu için fotoğraf eklenmez. |
| Sen Yokken | Başlıkta ufuk; gerçek olay satırlarında sonuç ve bir sonraki eylem baskın. |
| Savaş raporu | İlk pass küçük malzeme geçişi; mevcut rapor zaten olay ve sonuç sanatı taşıyor. Yeni resim eklemek ancak mevcut sonuç anlatımına katkı sağlarsa. |
| Üst kaynak barı | Daha nötr, işlenmiş metal; mevcut kaynak görselleri, kapasite ve toplama okumaları korunur. |
| Dock | Daha güçlü ikon silueti, seçili sekmenin sakin ışığı, metal yüzey. Panel açık durumuna uygulanabilir; canlı galaksi üzerindeki saydamlık korunmalı. |
| Gezegen/dünya seçimi | Sonraki pass: oyuncunun gerçek gezegen resmi ve sahiplik bilgisiyle kompakt dünya kartları. |
| Gönderim / hedef dosyası | Sonraki pass: gerçek hedef portresiyle karar alanı; basılı tutma, maliyet ve güç karşılaştırması değişmez. |
| Wiki / açıklama alanları | Sonraki pass: ilgili konu için bölüm başlığı sanatı; her paragrafın arkasına genel resim koyulmaz. |

Bu kapsamdaki küçük tasarım değişiklikleri resim eklemekten bağımsızdır: bölüm metalinin rengi, seçili sekmenin face'i, konu çizgileri, kuyruk gruplarının çerçevesi, isim/kazanç ayracı, klan koltuklarının derinliği ve proje görselinin boyutu. Ekran hiyerarşisi ve oyun mantığı yeniden kurulmaz.

### Önizleme ve uygulama sınırı

Güncel pano `out/ui-art-audit/v2/index.html` dosyasıdır. Resimler, sayfa aileleri, kaynak seçimi ve önce/sonra görüntüleri aynı yerde. İlk denemelerde reddedilen PNG bindirme yaklaşımı bu panoda yok.

Revizyon 2 de gerçek release bileşenlerine tarayıcı içinde uygulanan CSS/art denemesidir. Bu çalışma tasarımın kapsamını somutlaştırır; ürün branch'inde component uygulaması, tüm kademelerin sanat paketi veya deploy tamamlandı anlamına gelmez. Kontrol kaydı `v2/review.json`. Kaynak koduna geçildiğinde TDD gerektiren eşleme/durum davranışları ve normal yayın kontrolleri ayrı tamamlanır.

Revizyon 2 sonuçları: 18 görünüm × üç genişlik = **54 önce/sonra ekran çifti**, ayrıca iki chrome yüzeyi × üç genişlik = altı çift. 54 görünümde sıfır browser error, sıfır yatay belge taşması, menü ve ilk bina kartlarında sıfır yükseklik farkı. Sayaç içeren içerik çekimler arasında bir saniye ilerleyebilir; metin farkları kontrol edildi ve kuyruk/varış geri sayımlarından geldi. Pano 20 karşılaştırma alanı içerir; 350 ve 1440 px'de taşma yok; genişlik değiştirme ve bütün önizlemeyi yeni/mevcut gösterme kontrolleri çalışır; yüklenmiş görsellerde bozuk dosya görülmedi. Kanıt: `v2/board-review.json`.

Pano ve doküman ürün testinin yerine geçmez. Mevcut aşamada uygulama kaynakları değişmediği için normal ürün testleri çalıştırılmadı; oluşturulanlar tasarım artefaktlarıdır. Branch'in tek takip edilebilir yeni dosyası bu plan; büyük APK/inceleme/sanat dosyaları gitignore altındaki `out/` içindedir. Geçici Vite süreci kapatıldı; güncel pano doğrudan yerel HTML olarak açılır.

## Revizyon 3 — sahibin son onayı ve ürün uygulaması

Sahip planı aşağıdaki değişikliklerle onayladı ve uygulamayı istedi:

1. Ana mavi renk ve menü zemini korunacak. Yerel bölüm çizgileri ve sınırlı malzeme ışığı farklılaşabilir.
2. Üst kaynak barı, alt dock, bunların arka planları ve opaklıkları korunacak. Galaksiyi geniş hissettiren saydamlık değişmeyecek.
3. Bilgi ve Taktiksel açıklamalarının arkasındaki ince dikdörtgen resimler kaldırılacak; bu açıklamalar sakin metin alanı kalacak.
4. Sheet header sanatı devam edecek; her bölümün gerçek konusuna uygun sahne seçilecek. Filo başlığında hangar binası yerine gemilerin olduğu sahne kullanılacak.
5. Resimlerin üstüne ayrı PNG bina bindirilmeyecek; tam sahneler tek resim olarak kullanılacak.

### Uygulanan kapsam

- Dört menü hedefi: liderlik, ödül, duyuru, Wiki. Mevcut iki sütun, yönlendirme, erişilebilir ad ve rozetler korunur. Ana menü body ve tercih zeminleri aynıdır.
- T1 bina kartları: Komuta Çekirdeği, Alaşım Rafinerisi, Kristal Ocağı, Döteryum Rafinerisi, Tersane ve Hangar. Ortam ve nesne tek WebP. Kademeye ait sahnesi olmayan T2/T3 ve Depo kendi orijinal resmini korur; yanlış kademe resmi gösterilmez.
- Sheet başlıkları: Filo (`Capsule_Exp_Ships`, geminin ve asteroitlerin olduğu geniş orbital sahne), Araştırma (sensör donanımı/gece), İstihbarat (komuta ve sensör odası), Klan (operasyon masası), Ödüller (kaynak sahnesi), Liderlik/Sen Yokken (gezegen ufku), Duyurular (haber/komuta penceresi).
- Üs sekmelerinde bakır, mor gece ve çelik konu çizgileri; ana yüzey değişmeden kart kenarı/yerel ışık; seçili durum kendi UI-v2 mantığını korur.
- Kuyruk gruplarında sakin çerçeve; araştırma karar kartında daha belirgin mevcut proje görseli ve ölçülü mor ışık; klan kimliği/koltuklarında operasyon atmosferi; ödül özetinde hafif sıcak malzeme.
- Resim yükleme hatasında dekoratif sanat kaldırılır; bina sahnesi başarısızsa kendi orijinal nesne resmine döner. Sanat tıklama almaz, erişilebilir ad üretmez, kontrol veya durum mesajlarını değiştirmez.

### Kaynak ve teknik notlar

Canonical varlıklar `apps/web/public/assets/images/atmosphere/`; orijinaller, prompt'lar ve kaynak SHA-256 kayıtları `assets/source/atmosphere/` içindedir. Ürün klasöründe 14 optimize WebP toplam 1.030.258 byte. Bütün paket ilk açılışta yüklenmez; ilgili başlık/menü geldiğinde dekoratif resim, görünür bina kartlarında lazy sahne yüklenir. Ham APK arşivi ürün paketine girmez.

İlgili küçük bileşenler `ui/atmosphere.ts` (dekoratif sanat ve tam kademe eşlemesi) ve `ui/AtmosphereArt.tsx` (tek sahne/fallback). Oyundaki asıl `buildingArt` sözleşmesi değişmez; detay ve başka yüzeyler orijinal nesnenin aynı kademesini göstermeye devam eder. CSS `styles/atmosphere.css` yalnız içerik ve başlıkları etkiler; HUD/dock/menu ground için genel tema override'ı yok.

Yeni eşleme, fallback, erişilebilirlik, route ve sheet kontrol testleri önce FAIL verdi; uygulama sonrası 59 ilgili test PASS. Tüm workspace tip kontrolleri sırayla çalıştırıldı; web varsayılan 2 GiB Node heap sınırına takılınca aynı kontrol `--max-old-space-size=4096` ile PASS verdi. Lint bütün kaynakları üç sıralı grupta PASS verdi. Son görsel ve tam normal test sonuçları bu bölümün devamına yazılır.

Gerçek bileşen görüntüleme komutu: `node tools/visual.mjs out/atmosphere-implementation --atmosphere`. Bu harness preview CSS veya resim route'u enjekte etmez; uygulamadaki gerçek art'ı kullanır. Chromium'un uzun süre tek sayfada navigasyonla biriktirdiği kaynaklar sınıra ulaştığı için her görünümden sonra context kapatılır. Bu DOM/resim incelemesi için WebGL yazılım compositor'ü gerekmez. Görüntüleme gerçek telefonda FPS ölçümü değildir.

Revizyon 3 görsel sonuçları: 14 görünüm × üç genişlik = 42 layout kaydı; altı dil × beş görünüm = 30 dil çekimi, ayrıca HUD/dock ve üs alt alanları. Sıfır tarayıcı hatası, sıfır yatay belge taşması ve sıfır kırık resim. Uygulama panosu `out/atmosphere-implementation/index.html`; 350 ve 1440 px panel kontrolleri geçer. Filo başlığı son seçimle tekrar görüntülendi.

Web normal koşusu: 6.144 test PASS, 29 skip; tek infra hatası eksik Nginx Docker imajının container start sırasında zaman aşımına uğramasıydı. `nginx:1.28-alpine` hazırlandı ve ilgili dosyadaki iki test tekrar PASS verdi. Rules normal koşusu: 116 dosyada 2.082 test PASS. Uzun ekonomi/snowball testleri çalıştırılmadı. Sunucu testleri ayrı veritabanında sürüyor.

Yerel oyun önizlemesi: web `http://localhost:5176/`, bu dalın API'si `http://127.0.0.1:3116/`. İlk bağlantı master API'sine (3100) gidiyordu: yeni `RADIATION_SHIELDING` research enum'u, release tabanlı istemcinin gezegen sözleşmesini reddettirdi ve Üs paneli açılmadı. `/api/planet` ve `/api/planets` için gerçek yanıtla sorun doğrulandı. Ürün sözleşmesi değiştirilmeden aynı dala ait ayrı API bağlandı; iki yanıt da 200 ve schema PASS. Master'ın yerel `astera` veritabanının bir kopyası `astera_atmosphere_dev` adıyla ayrı container'a alındı; master DB'si ve 3100 API'si değiştirilmedi. Önizlemedeki oyun işlemleri bu kopyaya yazılır.

Yerel Vite başlatma komutu (web workspace'inde): `ASTERA_API=http://127.0.0.1:3116 pnpm exec vite --configLoader runner --host 127.0.0.1 --port 5176 --strictPort`. API, bu worktree'nin gitignore altındaki `.env` dosyasıyla `pnpm --filter @astera/server exec tsx src/index.ts` komutunu kullanır. Config gerçek faturalama veya paylaşılan Redis bağlantısı taşımaz. Galeri adresleri `http://localhost:5176/v2-gallery.html?view=menu&lng=tr` biçimindedir.

Sunucu ilk test koşusu ayrı DB kullanmasına rağmen ortak `astera-pg` instance'ında signal 9 ile PostgreSQL process restart'ları gördü; kontamine koşu durduruldu. Tek worker ile ayrı `astera-atmosphere-pg-20261014` container'ında yeniden başlatıldı. Bu geçici yerel kopya/test instance'ı 1 GiB bellek ve 1 CPU ile sınırlı; TRUNCATE sırasında disk senkronizasyon beklemeleri nedeniyle yalnız bu disposable instance'da `fsync=off` ve `synchronous_commit=off` ayarlandı. Bu sonuçlar güç kesintisi/disk dayanıklılığı doğrulaması değildir. Asıl DB/container ayarları değişmedi.

## Revizyon 4 — tam kart sahneleri ve eksik üs donanımları

Sahip gerçek uygulamada şu eksikleri bildirdi: resimlerin yalnız 96 px üst alanla sınırlanması; Depo/Körük/Bilgi/Savunma/Taktiksel/Tamirhane için sahne olmaması; üst kademelerin eski küçük nesne resmine dönmesi. Ek talimatlar: bütün sahneleri hafif loşlaştır; komutan bilgi kartına komuta merkezinden gezegen görünümü koy; anti-stratejik görselde gelen büyük saldırı silahının burnu gezegene dönük olsun.

Uygulama bütün üs donanımlarını kapsayacak şekilde genişletildi: 7 bina × 3 kademe, 4 sensör/kalkan × 3 kademe, 3 savunma bataryası × 3 kademe, 4 yörünge aracı, Tamirhane ve 2 taktiksel silah. Her kademe kendi referans geometrisini koruyan ayrı tek-parça çevre sahnesidir. `cardScene` kesin dosya yolu üzerinden eşler; bilinmeyen nesneyi başka nesneyle değiştirmez. Mobil gemi kataloğunun mevcut kendi hull render'ları değiştirilmez.

Kart sahnesi artık bütün kartı kaplar. 96 px üst alan engellenmemiş görüş alanı olarak kalır; isim/açıklama/maliyet alanı %70 koyu mavi cam ve 1 px blur ile resmin üzerinde durur. Görseller loş, isimler ve gerçek işlem durumları parlak kalır. Açma yüzeyi resmin üstünde, düzeltme/aksiyon düğmeleri de onun üzerinde kalır. Yeni komutan kartının ayrı gözlem odası sahnesinde gezegen sağ üstte; avatar ve ölçümler kendi yerindedir. Tamirhane ve taktiksel kartlarda tek çevre sahnesi vardır, üstüne ikinci nesne PNG'si bindirilmez.

43 yeni donanım/kademe sahnesi ve komutan odası built-in image_gen ile üretildi. Orijinaller ve prompt seti `assets/source/atmosphere/`, optimize servis dosyaları `apps/web/public/assets/images/atmosphere/` içindedir. Eski T1 altılısı korunur. İlk yönü yanlış anti-battery taslağı ürünün son versiyonu değildir; gelen büyük hedef aşağı-sola, küçük önleyiciler yukarı-sağa gider.

Yeni davranış/eşleme testleri önce RED (7 fail) verdi. Varlıklar ve eşleme tamamlanınca ilgili 7 dosyada 115 test PASS. Web typecheck tekrar PASS. Bu revizyon sürerken sunucu normal testleri 29 tamamlanmış dosyada kayıtlı PASS sonrası durduruldu; kalan dosyalar son uygulamadan sonra tek worker ile tamamlanır. Daha önceki revizyonun sayıları bu revizyonun son kontrol sonucu olarak kullanılmaz.


## Revizyon 5 — son ekran incelemesi

Sahibin yeni ekran geri bildirimi uygulandı: Sen Yokken kartının üst 8 px padding'i resimli header'ın içine taşındı; komutan odası %50/%22 odakla yeniden kadrajlandı; Üs kartlarının resim scale/transition ve açma yüzeyinin hover boyası kaldırıldı; bilgi alanının zemini %75 koyu maviye, sahne ışığı .7 brightness'a geldi. Anti-battery ve Ölüm Yıldızı yüzeyleri min. 260 px; Tamirhane düğmesi min. 240 px, sahne odağı %50/%72 ve bilgi bölümü altta. Seçili araştırmada yuvarlak premium-art maskesi kaldırıldı: 104×78 px dikdörtgen, sadece alınmamış durumda gri/.7 opacity.

Yeni 6 menü sahnesi built-in image_gen ile üretildi: iletişim/Feedback, ortak istasyon inşası/Donate, komuta simülatörü/Academy, galaksi gözlemevi, mevsimsel yörünge şafağı, kozmetik showroom/Envanter. Menü tabanı, Shop hero'su, kaynak barı ve dock aynı kalır. Menü ve Envanter yönlendirme/hata testleri önce 6 FAIL, sonra 153 ilgili test PASS verdi. Prompt seti `assets/source/atmosphere/menu-prompts-v1.json`; bütün aktif dosyaların kaydı `provenance.json`.

Gerçek oyun kontrolü (galeri dışı, ayrı yerel API/DB): Üs hem dock'tan hem gerçek 3D gezegene dokunarak açılır. Beş sekmede sıfır page error, yatay belge taşması veya kırık resim. Ekranlar `out/atmosphere-implementation/live-*-390-v2.png`; log `out/atmosphere-live-base-v2.log`. Bu kayıt revizyon 4'ün gerçek oyun doğrulamasıdır; son boyut/hover değişikliklerinin genişlik/dil taraması `out/atmosphere-final/` altında yeniden alınır.

Görsel harness uzun katalogdaki ek lazy resimleri viewport dışında decode etmeye çalıştığı için bekledi; artık yalnız çekilen viewport içindeki resimlerin decode'unu bekler. Revizyon 4'ün 42 genişlik/görünüm ve 30 dil çekimi sıfır issue ile tamamlandı. Son koşu ayrıca hover sırasında görsel boyutu/transform/filtre/yüzey renginin değişmediğini, araştırma resminin maskesiz dikdörtgen olduğunu ve Sen Yokken header'ının üstte boş inset bırakmadığını ölçer.


## Revizyon 6 — araştırma arka planı ve tamirhane modalı

Sahibin son talimatıyla seçili araştırmanın 104×78 thumbnail'ı kaldırıldı; kendi `RESEARCH_ART` dosyası aynı kartın tek tam arka planı oldu. Seçim değişince sahne değişir, resim dekoratif ve etkileşimsizdir; fiyat/resource ikonları ve gerçek araştırma aksiyonu korunur. Tamirhane modalının küçük PNG'si kaldırıldı; 250 px min-height hero'da `repair-v2` sahnesi, altta etiket/3 durum hücresi durur. Üs sahnesi `brightness(.85)`, metin camı `backdrop-filter: blur(3px)` kullanır. Üs kartları ve Tamirhane chevron'u hover'da animasyon yapmaz.

Sharpness regresyonu, bu sahibin açık 3px talimatı için yalnız `[data-layout='card'] [data-art]:has(.building-scene-art) ~ [data-card-copy]` bloğunda tam `backdrop-filter: blur(3px)` satırına izin verir; diğer kaynakların blur yasağı sürer. Anti-battery testindeki eski PNG beklentisi, güncel tek sahneye taşındı; orijinal commissioned art sözleşmesinin sabitliği de kontrol edilir.

Son tam web koşusu 465 dosyada 6.148 PASS, 29 skip ve 2 eski tasarım beklentisi FAIL verdi (anti-battery PNG, genel blur yasağı). Bunlar yukarıdaki açık talimatlara göre güncellendi. Son araştırma/Tamirhane testleri önce 2 FAIL, uygulamadan sonra ilgili 5 dosyada 134 test PASS verdi. Daha sonraki nihai test/derleme kaydı aşağıya eklenir.


## Revizyon 7 — bütün gemiler ve Kazıcı

Sahip Fleet kataloğundaki bütün atak/defans/kargo/özel gemiler için kendi gemisi referanslı, gerçekçi, ön planda gemi ve benzer açı istedi; Kazıcı için ayrıca asteroitli çalışma sahnesi istedi. Katalog 22 mobile hull + PROSPECTOR içerir. Her biri için tekil built-in image_gen çağrısı, kendi `HULL_ART` identity referansı, aynı önden üç çeyrek port kamera ve sola dönük burun yönergesi kullanılır. Prompt seti `assets/source/atmosphere/ship-prompts-v1.json`. Hiçbir gemi başka geminin dosyasına eşlenmez; 3D modeller, ikonlar ve orijinal render sözleşmeleri değişmez. Kartta eşleme/fallback `cardScene` ile genişletilir. Bütün hull'ları dolaşan kapsama testi önce RED verdi; son varlıklar üretildikten sonra PASS doğrulanır.


## Revizyon 8 — gemi kartı ve konvoy

Gemi kartları yalnız ad, tür ikonu, level, in/out, fiyat ve süre gösterir. Tam açıklama ve satın alma sınırı modalda kalır; sıra/sınır durumları erişilebilir `sr-only` status olarak korunur. Bütün 23 gemi sahnesi ayrı 3:2 alanda `contain` gösterilir; modal aynı yeni sahneyi kullanır. Kart satır/sütun aralıkları 12px, kategori başlıkları 13px/bold/beyaz; kategori sayısı ve chevron ana turkuazdır.

Konvoyun yapay renkli küreleri kaldırıldı. Normal filolarla aynı native motor/nozzle sistemi, tek instanced EngineJets draw olarak kullanılır. Egzozların z hareketi hull'ların bounded throttle drift'iyle aynı fonksiyonu/saati okur; normal filoların varsayılan davranışı korunur. Rüzgâr 12 instanced quad olarak kalır: genişlik span×.0012, opacity .17, kısa farklı uzunluklar, yumuşak giriş/çıkış ve çok küçük shader bend; ek texture/CPU particle sistemi yok. Yeni doğrulamalar önce 4 FAIL, ardından ilgili 7 dosyada 124 PASS verdi.

## Revizyon 9 — loading sırasında site zoom

İlk inline HTML cover, ana styles/viewport guard modülünden önce boyanıyordu; loading `touch-action:none` taşımıyordu. Ortak critical opening.css hem boot hem React cover'da pinch'i engeller. Nonce'lu küçük early guard loading sırasında ctrl-wheel/Safari gesture ve Ctrl/Cmd +/- engeller; kalıcı guard kurulunca geçici listener'lar kaldırılır. Keyboard magnification hazır sayfada, Ctrl/Cmd+0 reset ve normal scroll korunur. Sahne OrbitControls jestleri değiştirilmez. 7 yeni regression önce FAIL verdi.


## Revizyon 10 — yatay araştırma sahneleri ve seçime kaydırma

Sahip bütün araştırma resimlerinin kare ve karta uygunsuz olduğunu bildirdi. 16 proje için konuya özgü ayrı landscape sahne built-in image_gen ile üretildi. PNG master'lar `assets/source/atmosphere/research-*-scene-v1.png`, 960×640 WebP'ler atmosphere public dizinindedir. Prompt seti `research-prompts-v1.json`; kaynak hash'leri provenance records'a eklendi. İlk kare `RESEARCH_ART` sözleşmeleri referans/provenance olarak korunur; seçili kart ve Details modalında yeni RESEARCH_SCENES kullanılır.

Ana buton kontrast hatası, disabled utility class string'ine yanlışlıkla eşleşen `[class*='ink-3']` dekoratif CSS idi; yalnız gerçek `text-v2-ink-3` class token'ına eşleşecek şekilde düzeltildi. Fiyat ve iki buton `mt-auto` footer'a sabitlenir, kart min220px. İlk odak/arka plandaki yenileme scroll başlatmaz; ağaç, prerequisite kapısı veya queue seçiminde commit sonrası gerçek karta `scrollIntoView({behavior:'smooth',block:'nearest'})` çağrılır. Aynı yıldıza ikinci kez basmak da kaydırır. Yeni 3 regresyon önce FAIL, uygulama ve varlıklar sonrası ilgili iki dosyada 84 PASS.

Konvoy native jet'lerinin bilinen drift sınırı ayrıca culling yarıçapına eklendi; ekran dışında instance buffer upload yapmaz, geri gelince doğru zamana atlar. Bu durum önce 1 FAIL, sonra konvoy/formation iki dosyada 32 PASS verdi. Gerçek SwiftShader sahnesinde 22 hull, 1.080 engine particle, 12 wind instance ve sıfır sphere doğrulandı; egzoz tek draw, wind tek draw. Bu ölçüm mobil FPS iddiası değildir.


## Revizyon 11 — döteryumun görsel rengi

Sahip döteryumla bağlantılı araştırmaların çizimlerinin yeşil olmasını istedi. İzotop Spektrometri, Yoğun Yakıt Hücreleri, Gravitik Yükler ve Döteryum Sentezi'nin mevcut tam sahneleri built-in image_gen edit ile düzeltildi: aktif yakıt/enerji/laser/containment ve yansımalar canonical `#8eea36` yeşil; mimari, kompozisyon, doğal gökyüzü ve amber çalışma ışıkları korundu. Dört v2 PNG master ve 960×640 WebP, `research-green-prompts-v2.json` prompt seti; aktif mapping/provenance v2'ye geçirildi. Önceki renkli v1 kaynakları supersededRecords olarak korunur, gereksiz served v1 dosyaları kaldırıldı.

## Sahibin istediği CR

Doğrulanmış görsel bulgu: seçili kartın maskesi kaldırılmıştı, ancak Details modalındaki yeni yatay scene hâlâ global `premium-art` oval maskesini taşıyordu. Actual Chromium 350px ölçümü `radial-gradient(closest-side, ...)`, 334×192px; before screenshot/JSON `out/atmosphere-cr/research-details-before.*`. Fix: landscape fotoğrafın eski masked class'ını kaldır; existing rung index küçük L02 gibi bir foreground badge ile resmin üzerinde kalır. Kapsama JS logic değişimi yok; modal mask/fit browser harness'e eklendi. Research ve chat ilgili regresyon grubu 183 PASS.


## Revizyon 12 — gemi bilgi paneli ve ortak ışık seviyesi

Son sahip isteği: tüm yeni brightness uygulamaları 0.85; `.atmosphere-image`, `.building-scene-art` ve locked scene filtresi aynı değerdedir. Mevcut HUD/dock arkaplanları/opaklıkları ve menü zemini değiştirilmedi. Hull kartının altı koyu mavi/graphite bir materyal, daha belirgin 12px isim, ayrı seviye/adet satırı ve ince çizgiyle ayrılan kaynak/süre satırıdır. 350px'te üç kaynakla süre gerektiğinde doğal olarak ikinci satıra geçer; bilgi taşmaz. İçerik sahibi tarafından istenen ad, sınıf simgesi, seviye, in/out, kaynak ve süreyle sınırlı kalır. Hover büyümesi yoktur; 3:2 contain resim alanı ve 12px grid aralıkları korunur.

Aktif 103 optimized scene toplam 8.38 MiB; source SHA-256, served byte ve provenance kapsamı sıfır hatayla doğrulandı. PNG master/prompt/provenance repository'de korunur; Docker bağlamı root source art'ı dışlar, yalnız optimized public resimler yayınlanır.

Sahip bütün bu değişikliklerin deploy edilmesini açıkça istedi. Release `design/astera-atmosphere` worktree'sinden alınacak; `origin/master` gate yerine sahibi tarafından istenen ayrı branch/full SHA sabitlenir. Base SHA `77b3c2be17a06209305d299c0818dcc8d1db75ac` canlı checkout, runtime ve web release kimliğiyle eşleşir. Server, rules, migrations, lockfile ve production Compose farkı yok; şema/oyun mekanikleri için yeni adoption veya production DDL gerekmez. Manual production runbook'un build, restore rehearsal, rollback ve dört runtime/web kimliği kabulü uygulanır.


Son ordinary web koşusu 467 dosya/6.221 test keşfetti. Kartların kaldırılan açıklama/requirement yazılarını hâlâ arayan iki eski test dosyası 5 beklentiyle RED verdi. Bunların mevcut sahibi tarafından onaylanmış kompakt kart akışını test etmesi sağlandı: her hull adı/seviyesi/sınıf glyph'i kartta, capital açıklaması detail'da; tüm akordionlar açılarak kilitli hull'ların detail'ındaki reason ve gerçek Shipyard/research yönlendirmesi ayrıca doğrulanır. İki dosyanın 55 testi GREEN; kalan 464 dosya aynı tam koşuda GREEN. Son kapsam 6.192 PASS / 29 mevcut skip; testlerden vazgeçilmedi, kontrol detail yüzeyine taşındı. Backend değişikliği yoktur.
