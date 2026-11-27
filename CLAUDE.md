# CLAUDE.md — Astera Online

Bu dosyayı küçük tut: yalnızca yanlış uygulamayı önleyen, proje genelinde geçerli kurallar burada yer alır.

## 1. Ürün ve temel döngü

Astera Online, galaksi başına 1000 gerçek oyuncuya kadar ölçeklenen, **mobile-first ve android uygulaması olan, kalıcı, çok oyunculu bir uzay oyunudur**.

- **Tasarım:** Oynaması basit; derinliği daha fazla sistemden değil, sistemler arasındaki etkileşimden gelir.
- **Hissiyat:** Eğlenceli, ütopik, epik; içinde uçulabilen canlı bir NASA fotoğrafı.
- **Canlı:** Oyuncu filoları, madencilik, savaşlar ve herkesin görebildiği olaylar görünür biçimde gerçekleşir.
- **Anlık:** Sunucu zamanına bağlı olaylar zamanında görünür. Kaçınılabilir ağ gidiş-dönüşlerini beklemek yerine tahmin ve sunucuyla uzlaştırma kullanılır.
- **Güzel:** Oynanış maliyeti sıfır olduğunda ölçek, derinlik, ışık ve görsel ihtişam tercih edilir.

**Kilitli karar — owner, 2026-10-28:** Oyuncular bir botun bot olduğunu hiçbir zaman anlayamamalıdır. Oyuncuya görünen metinlerde, Wiki'de veya yardım içeriklerinde hiçbir dilde bot ifadesi bulunamaz; client'a bot işareti/flag'i sunulamaz. Gerçek oyuncunun yer aldığı her yerde bot da oyuncu gibi yer alır. Ayrıntı: `docs/ux-writing.md` ("Botlar asla anılmaz").

## 2. Yetki, yaklaşım ve çalışma düzeni

> IMPLEMENT → TEST → PLAY → EVALUATE → FIX → CONTINUE

Mimari, kütüphaneler, sorgular, önbellekleme, bileşenler, dahili API'ler, testler ve küçük, geri alınabilir UX ayrıntıları için kendin karar ver. **Temel döngü, risk/ödül, PvP, sahiplik, sezonlar, ilerleme, kimlik veya kilitli kısıtları değiştirmeden önce owner'a sor.**

Karara bağlanmış konuları owner'a sormadan değiştirme (aşağıdaki kurala bak); dokümanları sonsuza kadar cilalama; kesinlik bekleyerek işi durdurma veya çalışan sistemleri varsayımsal ihtiyaçlar için yeniden tasarlama.

### Kilitli karar = sormadan değiştirme, "asla değişmez" değil (owner, 2026-11-13)

Proje için daha iyisi neyse her konu değişebilir; şartı owner'la konuşmaktır. Plan yaparken "bu konu kilitli, plana buna bağlı kalarak yapmalıyım" diye düşünme: en iyi çözümü tasarla, kilitli bir kararı değiştiriyorsa açıkça işaretle ve owner'a sor:

> "Planda şu madde(ler), şu kilitli kararı (belge/tarih) değiştiriyor. Şu faydaları sağlayacağı için öneriliyor. Değiştirelim mi?"

Onay gelmeden kilitli davranışı uygulamada değiştirme; onay gelirse kararı yöneten belgeyi güncelle.

**Mevcut kurallar fikir eleme filtresi değildir (owner, 2026-11-18).** Bu kural yalnız "kilitli" etiketli kararlar için değil; dokümanlardaki her kural, tasarım ilkesi ("soyulabilirsin, silinemezsin" gibi) ve eski D-numaralı kararlar için de geçerlidir. Beyin fırtınasında ve planda bir fikri "X'i bozar / X'e ters" diyerek eleme. Ölçüt oyuncudur: daha eğlenceli mi, daha çok hırs yaptırıyor mu, daha çok taktik ve akıl oyunu açıyor mu? Fikir mevcut bir kuralla çatışıyorsa bunu ödünleşim olarak sun: hangi kuralı nasıl değiştirir, oyuncuya kazancı ve bedeli ne. Eskiyi değiştirmeden eklenemeyen yeni mekanik bir engel değil, tartışılacak bir seçenektir. Bir sistemin "pratikte işe yaradığını" söylemeden önce kanıtını (ölçüm, playtest) göster; kanıt yoksa varsayım olduğunu yaz. D-numaraları silinmiş `decisions.md`'nin eski referanslarıdır: bir kuralın var olduğunu gösterir, değişmemesi gerektiğini göstermez.

### Akıl hocası ol (owner, 2026-11-11)

Owner oyun yapımında acemidir; sektörün yollarını (hazır asset, mağaza, sanatçı, araç) ve terimleri (model, poly count, shader, VFX…) bilmez. Bir istek geldiğinde önce **en kaliteli yolu** öner: sektör bunu nasıl yapar, nereden alınır (somut link), yaklaşık maliyet ve lisans. Ardından alternatifleri ve bedellerini koy (ör. "almazsan şu yolla yaparız"). İşe başlamadan önce söyle; kendi yapabildiğin yola sessizce girme. Geçen her terimi bir cümleyle, oyundaki karşılığıyla açıkla.

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

Uygulamadan önce sorulan açıklayıcı sorular.

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

Oyuncuya dokunan her frontend işinde (UI, 3D, VFX, ses, etkileşim) **`apps/web/CLAUDE.md` zorunludur**: beş ilke (Clarity, Predictability, Decision support, Interaction cost, Premium design) ve Game feel standardı (owner, 2026-11-06) oradadır. `apps/web` altında çalışırken otomatik yüklenir; plan aşamasında web'e dokunacaksan önce onu oku. Her yerde geçerli kurallar:

- **VFX briefi (owner, 2026-11-18):** Efekt yazmadan önce 3 satırlık VFX briefi yazılır ve teslimde gösterilir: o anda dünyada fiziksel olarak ne oluyor, kütüphaneden hangi asset (yol), neden bu olayı anlatıyor. Yumuşak yuvarlak parlama, büyüyen hale ve "her yere uyan" efekt yasaktır.
- Oyun hareketleri işletim sisteminin hareket tercihinden bağımsızdır. **Yalnız public landing CSS'i**, owner'ın 2026-10-18 tarihli açık erişilebilirlik talebiyle istisnadır.
- Hedef 350 px genişliğinde telefondur; his Unity/Godot/Unreal ile yapılmış bir oyundur, web formu değil.

### 4.1 Oyun Geliştirme El Kitabı — owner, 2026-11-24

`~/Desktop/Coding/MyProjects/game-dev-handbook/` (repo dışı) oyun tasarımı ve oyun mühendisliği ilkelerinin başvuru kaynağıdır. Her ilkenin kalıcı bir ID'si vardır (`GF-03`, `SB-04`, `EN-03`). Kullanılması zorunludur:

1. Geliştirmeye başlamadan `README.md` yönlendirme tablosundan konuya uyan bölümü bul ve oku: oyun hissi, HUD/UI, ödül ve satın alma anları, savaş formülleri ve denge, ilerleme ve ekonomi, zorluk ve adalet, onboarding, seviye ve harita, ses ve haptik, erişilebilirlik, sunucu/ödeme/eşzamanlılık, kayıt, performans, multiplayer, anlatı, monetizasyon.
2. Uyan ilkeleri tasarıma ve koda uygula. Teslimden önce `checklists.md` içindeki ilgili bölümü geçir. Plan ve teslim notunda kullandığın ilkeleri ID'siyle yaz.
3. **Uygunluk filtresi:** İlkeyi yalnız Astera'ya uyuyor ve oyunu iyileştiriyorsa uygula. Astera mobil öncelikli, kalıcı, asenkron (filo gönder, offline bekle) bir istihbarat ve strateji oyunudur. Anlık aksiyon ilkeleri (coyote time, frame data, hit stop, parry) yalnız Komutan Gemisi / Savaş Alanı gibi gerçek zamanlı yüzeylerde anlamlıdır. Uymayan ilkeyi zorla uygulama.
4. **Öncelik:** Bu dosya, `docs/` ve owner kararları el kitabından üstündür. Mekanik gerçekler için kod ve testler esastır. El kitabı mevcut bir kuralla çatışıyor ama oyunu iyileştirecekse §2'ye göre ödünleşim olarak owner'a sor. Bilinen çatışmalar:
   - Reduced motion (`UI-10`, `AC-03`): oyun hareketleri işletim sistemi tercihinden bağımsızdır (§4).
   - Parlama, hale, glow (`UI-02`, `UI-07`, `GF-08`): VFX briefi kuralı ve genel parlama yasağı geçerlidir (§4).
   - Metin boyutları (`UI-14`, `AC-02`): verilen değerler konsol ve PC içindir. Mobil yazı tabanı owner kararıdır.
   - Botlar (`DI-06` ve benzeri): botlar hiçbir koşulda ayırt edilemez (§1).
5. Basis etiketi `Elaboration` veya `Claimed, unverified` olan bir ilkeyi kanıt gibi sunma. Astera için işe yaradığını söylemek ölçüm veya playtest gerektirir.
6. `ML-05` anti-pattern tablosundaki uygulamalar (gelire göre zorluk, kasıtlı kaybettirme, gizli fiyat ayrımı, gizli profilleme) owner'ın yazılı onayı olmadan uygulanmaz. Bir istek bunlara benziyorsa işaretle.

Bir task'a başlarken, nereleri okuduğunu ve neye karar verdiğini owner'a bildirmek zorunlu.

## 5. Kalite ve doğrulama

**Test gerektiren kod, testleri olmadan tamamlanmış sayılmaz; tasarım istisnası Bölüm 3'te tanımlıdır.**

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
- `pnpm test`, `pnpm typecheck` ve `pnpm lint` `tools/heavy.mjs` üzerinden ortak kilitle sıraya girer ve 9 GiB bellek tavanı altında çalışır. Bunları doğrudan (`pnpm exec vitest`, `tsc`, kendi betiğin) orta veya uzun çalıştırırsan başına `node tools/heavy.mjs` ekle; test, typecheck ve lint eşzamanlı çalışmamalıdır.
- Paralellik kuralı uzun ekonomi/sezon simülasyonları veya snowball audit'leri için izin oluşturmaz.

### Yerel PC: genel bellek sınırı — owner, 2026-11-03

- Node heap **3 GiB'ı aşamaz**: en fazla `--max-old-space-size=3072`. Bir kontrolü geçirmek için sınırı yükseltme veya 6 GiB kullanma. Test worker'larında yukarıdaki daha düşük sınır geçerlidir.
- **Tek istisna lint'tir (owner, 2026-11-26):** ESLint süreci en fazla **5 GiB** heap kullanabilir (`--max-old-space-size=5120`). Bunun üstüne çıkma; typecheck ve testler 3 GiB sınırında kalır.
- Heap toplam süreç belleği değildir; RSS'i izle ve PC'nin kullanılabilir kalmasını sağla.
- `pnpm lint` bütün dosyaları 400'lük parçalarla sırayla kontrol eder (tek süreç 3 GiB'a sığmaz). Bkz. `tools/lint.mjs`.

## 6. Bağlam ve dosya okuma stratejisi

- Token tasarrufu uğruna gerekli inceleme, bağımlılık analizi veya testlerden ödün verme.
- **Dokümanlar eski veya hatalı olabilir. Mevcut davranış ve mekanikler için kesin bilgi kaynağı kod ve testlerdir.**

### Doküman haritası

| Dosya | Ne zaman okunur? |
| --- | --- |
| `~/Desktop/Coding/MyProjects/game-assets/AGENTS.md` | Hazır GUI, ikon, VFX, model veya ses ararken (repo dışı ortak kütüphane; çizmeden önce bak, uygun olanı seç) |
| `~/Desktop/Coding/MyProjects/game-dev-handbook/README.md` | Oyuncuya dokunan veya oyun sistemine giren her geliştirmede (repo dışı el kitabı; bkz. §4.1) |
| `docs/product-vision.md` | Ürünün amacını değerlendirirken |
| `docs/game-design.md` | Sistem davranışını değiştirirken |
| `docs/architecture.md` | Sunucu mimarisinde |
| `docs/deployment.md` | Yayınlama ve operasyonlarda |
| `docs/engineering-standards.md` | Kod yazarken |
| `docs/interface.md` | Ekran ve etkileşimlerde |
| `docs/ui-kit.md` | Oyuncuya görünen bir yüzey kurarken veya planlarken: kit zorunlu, hangi iş için hangi parça, token'lar |
| `docs/ux-writing.md` | UI metni, oynanış açıklaması, onboarding, yardım ve Wiki'de |
| `docs/visual-design.md` | Sanat ve 3D çalışmalarında |
| `docs/playtest-log.md` | Playtest yaparken |
| `docs/review-sight.md` | Telescope/Radar/probe görüşüne dokunurken |
| `docs/glossary.md` | Terimler için |
| `docs/komutan-gemisi/README.md` | Komutan Gemisi / Savaş Alanı'na (gerçek zamanlı pilot arenası) dokunurken |

Diğer konular için `docs/` klasörüne bak.

**UI/UX yazım kapsamı:** Yeni veya güncellenen UI, oynanış açıklaması, yardım ve Wiki metinlerinde `docs/ux-writing.md` uygulanır. Lore kapsam dışıdır; içindeki işlevsel talimatlar kapsam içindedir. Bu belge yazım standardıdır; mekanikleri kod ve testlerden doğrula.

## 7. Token optimizasyonu

**Her zaman** owner'a yazdıklarını kısa, net ve sade tut: ne yaptığını, neyi doğruladığını ve owner'dan ne beklediğini söyle; araç çıktısını tekrar etme. Uzun bir işte bir aşamayı bitirdiğinde veya bir sonucu beklerken tek cümleyle durumu yaz.
