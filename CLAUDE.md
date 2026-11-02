# CLAUDE.md — Astera Online

Her oturumun başında oku. İş uzadığında veya bağlam daraldığında da bu kurallardan sapma. Özellikle geliştirme disiplini, tasarım disiplini, çalışma yaklaşımı ve bağlam okuma stratejisi her görev boyunca geçerlidir.

Bu dosyayı küçük tut: yalnızca yanlış uygulamayı önleyen, proje genelinde geçerli kurallar burada yer alır. Gerekçeler, geçmiş ve ölçümler `docs/` altında; dosyaya özgü tuzaklar ilgili dosyanın açıklama bloklarında tutulur.

## 1. Ürün ve temel döngü

Astera Online, galaksi başına 300–1000 gerçek oyuncuya kadar ölçeklenen, **mobile-first, kalıcı, çok oyunculu bir uzay oyunudur**. Her komutanın korunan bir başkenti vardır ve en fazla üç koloni ele geçirebilir. Sahip olunan gezegenler keşfedilene kadar gizlidir.

> The fleet is the bet. The information is the game. The planet is the stake.

- **Tasarım:** Oynaması basit; derinliği daha fazla sistemden değil, sistemler arasındaki etkileşimden gelir.
- **Hissiyat:** Eğlenceli, ütopik, epik; içinde uçulabilen canlı bir NASA fotoğrafı.
- **Canlı:** Oyuncu filoları, madencilik, savaşlar ve herkesin görebildiği olaylar görünür biçimde gerçekleşir.
- **Anlık:** Sunucu zamanına bağlı olaylar zamanında görünür. Kaçınılabilir ağ gidiş-dönüşlerini beklemek yerine tahmin ve sunucuyla uzlaştırma kullanılır.
- **Güzel:** Oynanış maliyeti sıfır olduğunda ölçek, derinlik, ışık ve görsel ihtişam tercih edilir.

Her özellik şu değerlerden en az birini güçlendirmelidir:

`OWNERSHIP · CURIOSITY · COMPETITION · AMBITION · RISK · OPPORTUNITY · RE-ENGAGEMENT · MEMORABILITY · FUN`

```text
DEVELOP → ACCUMULATE → GATHER INTEL → SPOT OPPORTUNITY → CHOOSE TARGET
→ TAKE RISK → DISPATCH → WAIT OFFLINE → OUTCOME → GAIN / LOSS → NEW DECISION
```

Savaş raporları yeni istihbarat üretir. Ekonomi ve binalar bu döngüyü destekler; döngünün kendisi değildir.

**Kilitli karar — owner, 2026-10-28:** Oyuncular bir botun bot olduğunu hiçbir zaman anlayamamalıdır. Oyuncuya görünen metinlerde, Wiki'de veya yardım içeriklerinde hiçbir dilde bot ifadesi bulunamaz; client'a bot işareti/flag'i sunulamaz. Gerçek oyuncunun yer aldığı her yerde bot da oyuncu gibi yer alır. Bkz. `docs/decisions.md`, 2026-10-28.

Yeni bir sistem anlamlı bir karar oluşturmalı; gereksiz mikro yönetim yaratmadan etkileşimi, riski, fırsatı, merakı veya geri dönme nedenini güçlendirmelidir. Emin değilsen: **PROTOTYPE → PLAY → OBSERVE → DECIDE**.

Gerileme işaretleri: döngünün `BUILD → WAIT → COLLECT → UPGRADE` hâline gelmesi; eğlencede oyuncuların yerini kaynakların alması; istihbarat → karar → eylem bağının zayıflaması; mikro yönetimin artması; teknik olarak etkileyici ama duygusal açıdan boş sonuçlar.

## 2. Yetki, yaklaşım ve çalışma düzeni

> IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE

Mimari, kütüphaneler, sorgular, önbellekleme, bileşenler, dahili API'ler, testler ve küçük, geri alınabilir UX ayrıntıları için kendin karar ver. **Temel döngü, risk/ödül, PvP, sahiplik, sezonlar, ilerleme, kimlik veya kilitli kısıtları değiştirmeden önce owner'a sor.**

Karara bağlanmış konuları yeniden açma; dokümanları sonsuza kadar cilalama; kesinlik bekleyerek işi durdurma veya çalışan sistemleri varsayımsal ihtiyaçlar için yeniden tasarlama.

### Kodlamadan önce düşün

- Varsayımlarını açıkça belirt; belirsizlikleri gizleme, ödünleşimleri ortaya koy.
- Birden fazla yorum varsa sessizce birini seçme; yorumları sun. Gereksinimde eksik, yanlış, çelişkili veya ucu açık bir nokta varsa uygulamadan önce dur, belirsizliği adlandır ve owner'a sor.
- Daha basit bir yaklaşım varsa belirt; gerektiğinde gerekçeli biçimde itiraz et.
- Kod veya test değiştirmeden önce kök nedeni teşhis et.

### Önce basitlik

- İstenen işi çözen en az kodu yaz. Temiz, basit, stabil, az hata üretecek ve istekle tamamen uyumlu çözümü seç.
- Yeni kod yazmadan, kod silerek veya küçük değişikliklerle çözülüp çözülemeyeceğini incele.
- İstenmeyen özellik, tek kullanımlık kod için soyutlama, talep edilmemiş esneklik/yapılandırılabilirlik veya imkânsız senaryolar için hata yönetimi ekleme.
- 50 satır yeterliyken 200 satır yazdıysan sadeleştir. “Kıdemli bir mühendis bunu gereğinden karmaşık bulur mu?” diye kontrol et.

### Yalnızca gerekli yerleri değiştir

- Her değişen satır doğrudan kullanıcının isteğiyle ilişkilendirilebilmelidir.
- İlgisiz kodu, yorumları veya biçimlendirmeyi iyileştirme; bozuk olmayan yapıları refactor etme. Kendi tercihin farklı olsa da mevcut stile uy.
- Değişikliklerinin kullanılmaz hâle getirdiği import, değişken ve fonksiyonları kaldır.
- Önceden var olan ilgisiz ölü kodu bildir; istenmedikçe silme.

### Doğrulanabilir hedeflerle ilerle

Başarı ölçütlerini tanımla ve doğrulanana kadar devam et. Çok adımlı işlerde kısa bir `adım → doğrulama` planı belirt.

- “Validation ekle” → Geçersiz girdiler için test yaz, ardından geçir.
- “Hatayı düzelt” → Hatayı yeniden üreten test yaz, ardından geçir.
- “X'i refactor et” → Testlerin değişiklikten önce ve sonra geçtiğini doğrula.

Güçlü başarı ölçütleri bağımsız ilerlemeyi sağlar; “çalışır hâle getir” gibi zayıf ölçütler sürekli açıklama gerektirir. Doğru uygulamanın işaretleri: diff'lerde daha az gereksiz değişiklik, aşırı karmaşıklık nedeniyle daha az yeniden yazım ve hatadan sonra değil, uygulamadan önce sorulan açıklayıcı sorular.

## 3. Geliştirme disiplini: zorunlu TDD

**Tüm geliştirme ve güncellemelerde Test Driven Development zorunludur. Tek kelimelik kod değişikliği de buna dahildir. Yalnızca tasarım, stil, `className` ve CSS gibi tasarım konuları istisnadır.**

1. Gereksinimi analiz et.
2. Tüm happy path ve edge case'leri çıkar; eksik, yanlış, çelişkili veya ucu açık noktaları owner'a sor. Çıktıları not al.
3. Dokunulacak yerleri, bağımlılıkları ve mevcut çalışan mantığı bozma ihtimalini ayrıntılı incele; notlarına ekle.
4. **Önce** testleri yaz, güncelle veya ekle.
5. İlgili testleri çalıştır ve **FAIL** aşamasını doğrula. Bu aşamada tüm testleri çalıştırmak gerekmez.
6. Basitlik ve kapsam kurallarına uygun implementation yaz.
7. İlgili testleri çalıştır ve **PASS** aşamasını doğrula.
8. Son code review'u yap: eksik, yanlış, hatalı, unutulmuş veya başka bir yeri bozan değişiklik var mı kontrol et.
9. Değişikliğin kapsamına göre son regresyon kontrolünü yap. Çok sayıda yere dokunulduysa tüm testleri; küçük, sınırlı değişikliklerde ilgili geliştirme testleriyle birlikte bağlantılı alanların testlerini çalıştır. Kapsamı seçme sorumluluğu sendedir. Aşağıdaki uzun test kısıtları her durumda geçerlidir.

## 4. Tasarım disiplini

Frontend görevlerinde ilgili gamedev skill'lerini (Game Development Router) incele ve gerekli olanları kullan. Yeni veya güncellenen her component, sayfa, section, element ve tasarım aşağıdaki **beş ilkeye** uymalıdır. İlk dört kullanılabilirlik ilkesi her ekranda estetik tercihlerden önce gelir; bunlardan birini karşılamayan yüzey, bitmiş görünse de tamamlanmış değildir. Geliştirici sayıların anlamını zaten bildiği için bu eksikleri fark etmeyebilir.

### 1. Clarity — Oyuncu bunu anlıyor mu?

Bir değeri göstermek, anlaşılır kılmak değildir. Oyuncunun karar verirken kullanacağı her sayının yanında şu soruların yanıtı anlaşılabilmelidir:

- Bu neyi temsil ediyor?
- Büyük olması iyi mi?
- Benim karşılık gelen değerimle nasıl kıyaslanıyor?
- Başka nelerle ilişkili?
- Bunu hangi karar için kullanacağım?

### 2. Predictability — Oyuncu sonucu tahmin edebiliyor mu?

Kesinlik verme: belirsizlik oyunun temelidir; “kazanacak mıyım?” sorusuna kesin cevap veren ekran, temel döngüdeki riski ortadan kaldırır. Ancak hiç tahmin edilemeyen sonuç rastgele görünür ve istihbaratın değerini yok eder; belirsizliği azaltmayan bilgiye kimse bedel ödemez.

**Oyuncu bir beklenti oluşturabilmeli ve bu beklentisinde yanılabilmelidir. Girdileri ve kuralı ver; cevabı verme.**

### 3. Decision support — Oyuncu karar vermek için gereken bilgiye sahip mi?

- Kurallar kullanıldıkları yerde, o anda gereken miktarda keşfedilebilir olmalıdır.
- Ne yirmi sayfalık Wiki/her kartta bütün kurallar ne de açıklamasız bir sistem uygundur.
- Kademeli açıklama kullan: satır olguyu, bir dokunuş ilerideki sheet kuralı anlatır.
- Kuralları karar verildikten sonra öğretme. Örnek: her savaşı belirleyen counter cycle çarpanlarının yalnızca filo kaybedildikten sonraki savaş raporunda görünmesi karar desteği değildir (D124).
- Oyuncu özelliğin neden var olduğunu hissedebilmelidir. “Bunu neden yapıyorum?” diyorsa “bana ne kazandırır?” ve “ne zaman kullanmalıyım?” yanıtları yüzeyde eksiktir.

### 4. Interaction cost — Kullanmak ne kadar zahmetli?

Scroll, dokunma ve ekran değiştirme maliyettir. Karşılaştırılacak on öğenin her birinin bir ekran kaplaması ile toplam iki ekrana sığması aynı deneyim değildir.

350 px genişliğindeki telefonda bilgi yoğunluğu ve ekran ekonomisi dekoratif boşluktan önce gelir. **Her boşluğun amacı olmalıdır.** 74 px görsel alanı yüksekliğini hak edebilir; 40 px'e inen render favicon gibi görünür. Kapalı bir bölümün altında duran paragraf ise alanını hak etmez.

### 5. Premium design — Görsel kalite zorunludur

- Baştan savma tasarım yapma. Hedef premium AAA kalitesidir; görsellik ve premium hissiyat oyuncuyu etkileyen başlıca unsurlardandır.
- Her zaman `ui-v2` ilkeleriyle uyumlu, kaliteli, premium ve hayranlık uyandıran tasarımlar üret.
- Geliştirdiğin, güncellediğin veya düzelttiğin işin tasarım gereksinimlerini asla atlama.
- Oyun hareketleri işletim sisteminin hareket tercihinden bağımsızdır. **Yalnız public landing CSS'i**, owner'ın 2026-10-18 tarihli açık erişilebilirlik talebiyle istisnadır. Bkz. `docs/landing-premium-redesign-2026-10-18.md`.

Her yüzey için sor: **“Bu arayüz yalnızca GÖSTERİYOR mu, yoksa YARDIM EDİYOR mu?”** Bütün bilgileri sunmak, oyuncunun karar verebildiği anlamına gelmez; daha fazla göstermek her zaman daha fazla yardımcı olmak değildir.

> Oyuncu API'yi anlamaz. Oyuncu gördüğünü anlar, gösterileni bilir!

## 5. Kalite ve doğrulama

**Temiz, sürdürülebilir, performanslı ve kaliteli geliştir. Test gerektiren kod, testleri olmadan tamamlanmış sayılmaz; tasarım istisnası Bölüm 3'te tanımlıdır.**

```bash
pnpm verify
```

Gerekli sonuç: sıfır type hatası, sıfır lint hatası ve geçmesi gereken testlerin tamamının yeşil olması.

- `any` ve compiler'ı susturan cast'ler yasaktır. Güvenilmeyen sınırlardaki girdileri Zod ile parse et.
- Kötü niyetli girdileri, eşzamanlılığı, hata durumlarını ve zamanı test et.
- Temel oynanışta sessiz placeholder bırakma.
- Frontend değişikliklerini `node tools/visual.mjs` ile görsel olarak doğrula.

### Uzun testler — owner, 2026-10-09

Ekonomi/sezon simülasyonları, snowball audit'leri ve benzeri uzun ekonomi inceleme/kalibrasyon çalışmaları **yalnızca kullanıcı bu uzun testleri açıkça istediğinde** çalıştırılır. “Tüm testleri çalıştır”, “işi bitir” veya “değişikliği doğrula” talebi bu izni vermez. Bu kural eski plan ve test talimatlarından üstündür.

- Normal kural, kaynak işlemi, API ve UI regresyon testleri zorunlu olmaya devam eder.
- `pnpm test` ve `pnpm verify` varsayılan olarak simülasyon workspace'ini ve snowball audit'ini hariç tutar; `--exclude-sims` uyumlu kalır.
- Yalnızca açık talep sonrasında `pnpm verify --include-long-tests` veya `pnpm test:long` kullan.
- Doğrudan `packages/sim` ve server audit keşfi de açıkça izin verilmiş bir çalıştırmada `ASTERA_INCLUDE_LONG_TESTS=1` ayarlanmadıkça kapalıdır.

### Yerel PC: test paralelliği — owner, 2026-10-30

- Kısa, hedefli testlerde **bir worker** kullan.
- Orta/uzun test gruplarını **4 worker** ile paralel çalıştır (owner, 2026-11-02); başka oturum test koşuyor veya boş bellek 3 GiB'in altındaysa 3 worker. Worker başına `--max-old-space-size=1024`; test worker'ı başına asla **1536 MiB** üstüne çıkma. Heap yanında RSS'i de izle.
- Veritabanı kullanan her worker'ın, çalıştırma/worker'a özgü ad taşıyan ve `_test` ile biten **kendine ait geçici veritabanı** olmalıdır. Ortak veritabanında paralel truncation yapma.
- Her veritabanına kullanımdan önce migration uygula. Başarı, hata veya iptal durumunda bağlantıları kapat ve o çalıştırmanın oluşturduğu tüm veritabanlarını sil.
- Saf rules/UI testleri veritabanı gerektirmez.
- Workspace'leri sırayla çalıştır: `--workspace-concurrency=1`. `nice -n 10` kullan. Test, typecheck ve lint'i eşzamanlı çalıştırma.
- Paralellik kuralı uzun ekonomi/sezon simülasyonları veya snowball audit'leri için izin oluşturmaz.

### Yerel PC: genel bellek sınırı — owner, 2026-10-13

- Node heap **2 GiB'ı aşamaz**: en fazla `--max-old-space-size=2048`. Bir kontrolü geçirmek için sınırı yükseltme veya 6 GiB kullanma. Test worker'larında yukarıdaki daha düşük sınır geçerlidir.
- Heap toplam süreç belleği değildir; RSS'i izle ve PC'nin kullanılabilir kalmasını sağla.
- Gerekirse bellek tüketen lint taramasını `pnpm lint` üzerinden sıralı gruplara böl; yine de bütün dosyalar kontrol edilmelidir. Komutlar: `docs/engineering-standards.md`.
- Bu kural yerel dokümanlarda kalmış eski 6 GiB yönlendirmelerinden üstündür.

## 6. Bağlam ve dosya okuma stratejisi

- Gereksiz, tekrarlı ve amaçsız okumadan kaçın. Önce hedefli aramalarla ilgili dosyaları, bağımlılıkları ve çağrı zincirlerini belirle; sonra doğruluk ve mevcut sistemlerle uyumluluk için gereken tüm kodu incele.
- Token tasarrufu uğruna gerekli inceleme, bağımlılık analizi veya testlerden ödün verme.
- Büyük dosyalarda önce ilgili bölümleri oku, gerekirse kapsamı genişlet. Okuduğun ve değişmediğini bildiğin içeriği gereksiz yere yeniden okuma.
- **Dokümanlar eski veya hatalı olabilir. Mevcut davranış ve mekanikler için kesin bilgi kaynağı kod ve testlerdir.**

### Doküman haritası

| Dosya | Ne zaman okunur? |
| --- | --- |
| `docs/product-vision.md` | Ürünün amacını değerlendirirken |
| `docs/game-design.md` | Sistem davranışını değiştirirken |
| `docs/balance.md` | Sayıları veya simülatör ayarlarını değiştirirken; **dosyanın tamamını okuma**, gerekli kelime/konu üzerinden ilgili bölümleri oku |
| `docs/architecture.md` | Sunucu mimarisinde |
| `docs/deployment.md` | Yayınlama ve operasyonlarda |
| `docs/engineering-standards.md` | Kod yazarken |
| `docs/interface.md` | Ekran ve etkileşimlerde |
| `docs/ux-writing.md` | UI metni, oynanış açıklaması, onboarding, yardım ve Wiki'de |
| `docs/visual-design.md` | Sanat ve 3D çalışmalarında |
| `docs/playtest-log.md` | Playtest yaparken |
| `docs/review-sight.md` | Telescope/Radar/probe görüşüne dokunurken |
| `docs/review-onboarding.md` | Onboarding ve yeni oyuncu deneyiminde |
| `docs/glossary.md` | Terimler için |
| `docs/komutan-gemisi/README.md` | Komutan Gemisi / Savaş Alanı'na (gerçek zamanlı pilot arenası) dokunurken |

Diğer konular için `docs/` klasörüne bak.

**UI/UX yazım kapsamı:** Yeni veya güncellenen UI, oynanış açıklaması, yardım ve Wiki metinlerinde `docs/ux-writing.md` uygulanır. Lore kapsam dışıdır; içindeki işlevsel talimatlar kapsam içindedir. Bu belge yazım standardıdır; mekanikleri kod ve testlerden doğrula.

## 7. İletişim ve son hedef

Gerekmiyorsa çıktı verme. Çıktı gerektiğinde kısa, net, basit ve kullanıcının anlayabileceği şekilde yaz; gereksiz uzatma.

> Oyuncuların oyunu kapattıktan sonra “Ne oldu acaba?” diye merak ettiği, AAA+ premium görsel kalitede, optimize edilmiş bir çok oyunculu tarayıcı ve uygulama oyunu geliştir.