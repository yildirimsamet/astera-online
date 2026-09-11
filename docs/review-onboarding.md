# Onboarding — bulgu raporu ve Akademi spec'i

> **BU BİR DEVİR TESLİM DOKÜMANIDIR.** Bu işi hiç görmemiş, konuşmaya hiç
> katılmamış bir ajan için yazıldı. Buradaki her karar bir owner kararıdır;
> gerekçeleri de yazılıdır ki yeniden açılmasın.
>
> **Önce şunları oku, bu sırayla:** `CLAUDE.md` → `docs/decisions.md` →
> `docs/game-design.md` → bu doküman. Uyuşmazlıkta o dosyalar bunun üstündedir.
>
> **Bu dokümanın iki yarısı var.** §0-§4 **NEDEN** — sahadan gelen şikâyet ve kod
> üzerinde doğrulanmış bulgular. §5 **NE ve NASIL** — kararlaştırılmış çözümün
> spec'i. §5'i §2'yi okumadan uygulama; neyi çözdüğünü bilmeden yapılan bir
> onboarding, çözdüğünü sandığı şeyi çözmez.
>
> **Konumlar satır numarasıyla değil sembol adıyla verilir.** Satır numarası
> verildiği yerlerde bayat olabilir; sembolü ara.
>
> **Bu doküman geçicidir.** §5 bir decision numarası alıp `docs/decisions.md`'e
> geçtiğinde ve iş bittiğinde silinir. Kalıcı gerçek `CLAUDE.md` değişmezler
> tablosu ve `decisions.md`'dir.

---

## 0 · Otuz saniyede durum

**Problem.** Oyuna yeni gelenler ne olduğunu anlamıyor. Sahadan iki şikâyet
geldi: *"Yeni gelen bazılarına tutorial çıkmıyor"* ve *"Bir sürü kişi geldi, ne
oluyor bir şey anlayamadık."* Kitle ortalama 30-40 yaş; sorun okuma değil,
oyunun kendini hiç tanıtmaması.

**Kanıt.** İkisi de doğru çıktı. Provaya hiç girmeyen **iki ayrı yol** var (§2
B1, B2), provayı atlayan **açılış siparişlerini de** kaybediyor (B3), ve "şimdi
ne yapmalıyım"ı cevaplayan motor yazılmış ama **hiçbir yerde çizilmiyor** (B4).

**Amaç.** Yeni oyuncunun ilk on beş dakikasında şunlar olsun: (1) oyunun ne
olduğunu anlasın, (2) her an ne yapacağını bilsin, (3) hiçbir an anlamadığı bir
kontrole bakmasın, (4) hesabını açtığında emeği duruyor olsun, (5) geri dönmek
için sebebi olsun.

**Karar.** Yeni oyuncu, gerçek sunucuya **tek istek atmadan**, client'ta çalışan
**tam kurgu bir ilk oyun** oynar — "Akademi". Sahne yazılıdır: sıradaki ders
korsansa korsan o an yanına spawn olur. Arayüz kapalı başlar, ders ilerledikçe
açılır. Bitince kayıt olur ve **gezegeni olduğu gibi gerçek galaksiye taşınır.**

**Yapılacak iş.** §5. Sırasıyla: paylaşılan checkpoint, sunucu sınır protokolü,
yerel ders motoru ve gerçek arayüzle uçtan uca doğrulama. Ayrıntılı simülatör
kalibrasyonu owner'ın §5.12 kararıyla kapsamdan çıktı.

**Uygulama kodlandı; son kabul kayıtları aşağıdadır.** §3 Katman 1: giriş formu yalnızca giriş yapıyor,
ortak cihazda eğitim kapısı eşit ağırlıkta, Atla eksik açılış siparişlerini
tamamlıyor ve Situation Engine gerçek galaksiye bağlandı. D56/D68 güncellendi.
§1–§2 aşağıdaki tabloları ilk bulgu anını kaydeder; güncel uygulama durumu bu
paragraftır. §5 D172 ile uygulandı: §5.12 kararları aşağıda kapatıldı.
Paylaşılan 40 adımlı checkpoint, yeni ödül zincirleri, atomik sunucu aktarımı ve
bot başlangıcı kodlandı. Yerel zamanlı inşa/üretim dünyası test edildi.
Yeni Akademi girişe ve menüdeki ödülsüz tekrar oynama seçeneğine bağlandı.
Yerel korsan/maden/baskın, gerçek bildirim ve rapor ekranları bağlı; Türkçe 40 adım
350px tarayıcıda tamamlandı. Toast, yükleme, kuyruk kaydırma ve koşulsuz animasyon
değişiklikleriyle 40 adım İngilizce/Türkçe tekrar geçti (`out/academy-complete-en`,
`out/academy-complete-tr`). Ardından owner'ın bulduğu ilk-adet hatası ayrıca
düzeltildi; aşağıdaki tek-basış regresyonu bu son farkı kapsar. Kabul listesi ve
test istisnaları güncel durumu gösterir.

**Katman 2 ara doğrulaması.** Rules Academy/ödüller 30 test; sunucu
claim/ödüller/şema 57 test; web yerel dünya/el/kapı/Atla/eski prova 75 test geçti.
El var olan eğitimde kullanılıyor, karartmalı Spotlight artık orada çizilmiyor.
Bu sayılar yeni 40 adımın tarayıcıda uçtan uca oynandığı anlamına gelmez.

**Yerel API bağlantısı (devam).** `academyFetch.ts` inşa, gemi üretimi,
Aegis ve adım ödüllerini üretim API şemalarıyla cevaplıyor; sipariş zamanı
dolunca aynı checkpoint'e ilerliyor. Yanlış gezegen/adet/adım, bozuk JSON ve
yinelenen ödül testleri var; gerçek `fetch`e geri düşüş yok. `Api.claim`
tamamlanan adımı `{ step }` olarak gönderebiliyor, eski `{ intents }` biçimi
korundu. İlgili beş web dosyası 87/87 ve tüm workspace tip denetimi geçti.
Bu bağlantı artık `Rehearsal` yerine açılıyor. Korsan ve gezegen savaşı paylaşılan
savaş/ganimet kurallarını, maden dönüşü gerçek Works tamponunu kullanıyor.

**Belgenin ikinci tam denetimi — 7 Eylül 2026.** Owner'ın yeniden okuma isteği
üzerine §0–§5.12 uygulamayla tekrar karşılaştırıldı. §5.12 son ders sırasıdır;
eski sonda/araştırma görevleri ve owner'ın kaldırdığı ayrıntılı simülasyon işi
geri eklenmez. Tamamlanmadan bu belge kaldırılmayacak.

- [x] Gerçek hesaptan ayrı yerel API/cache; yanlış istek gerçek ağa düşmez.
- [x] Vault 1/3/5, Aegis 1/3/5 ve korsan ödülleri; ödenen eğitim ödülü tekrar ödenmez.
- [x] Sunucuya yalnız tamamlanan adım; atomik yaratma, retry ve yarış kontrolleri.
- [x] Core 2 tabanlı tam çıkış, gerçek Core 3 kuyruğu; botlar aynı paketle başlar.
- [x] Başlangıçta bütün derslerin parasını vermek yerine sıradaki işlemin açığı tamamlanır.
- [x] Gerçek asteroit gönderim kontrolü ve savaş bildirimi; doğrudan görev atlatma yok.
- [x] Yenilemede yerel ilerleme/sipariş/uçuş dönüşü; depolama erişimi fırlatsa da eğitim açılır.
- [x] Tekrar oynama kayıtlı eğitimi ve gerçek hesabı değiştirmez.
- [x] Sağlanan el görseli, tıklama hareketi, iki dalga halkası; son owner kararıyla animasyonlar OS tercihinden bağımsızdır.
- [x] El/balon konumu DOM üzerinden; balon hedefin üstünü kapatmaz (birim test).
- [x] Akademi sheet'leri gökyüzünü karartmaz; gerçek galaksi görünümü değişmez.
- [x] Sekme/alt satır/yan kontrol açılmaları 350px gerçek kontrollerle oynandı; tanıtılmayan kontroller gizli.
- [x] El/hedef takibi ve scroll geçişleri birim testler + gerçek arayüz oynama/görselleriyle doğrulandı; Dart ilk-adet hatası ayrıca kapatıldı.
- [x] Telescope küresi, korsan/asteroit ve kargo baskını iki dilde 40 adım uçtan uca doğrulandı.
- [x] Erken Atla çıkışına çalışan gerçek kuyruk bırak; tamamlanmamış derse ödül verme.
- [x] Atla ölçümünü ekle; eğitim sırasında gerçek oyun API isteği yapma.
- [x] Eski Spotlight çizicisini ve script'in lit/dim alanlarını kaldır; eski intent uyumluluk testlerini koru.
- [x] Verify/test/görsel sonuçları ve kapsam dışı mevcut başarısızlıklar aşağıda kaydedildi; genel gate yeşil değildir.

**Katman 1 doğrulaması (7 Eylül 2026).** İlgili altı web test dosyası: 92/92;
sunucu `onboarding.test.ts`: 18/18 (retry ve eşzamanlı claim dahil).
350px giriş/Atla/claim/rehber yönlendirmesi için
`node tools/visual.mjs out/onboarding-repair --onboarding` eklendi; kart ile
Chat/Chronicle çakışmasını önce yakaladı, düzeltmeden sonra geçti. Ortak cihazın
iki kapısı da 327px genişliğinde, 350×812 ekran içinde. React rehberi mevcut
veri ve saatten türetir; yeni sorgu veya animasyon ölçüm döngüsü yoktur.

**Son owner etkileşim düzeltmeleri (7 Eylül 2026).** Tanıtımda çerçeve,
eylemde el; yalnız tanıtımda hareketli Devam. Yeni sekme açılırken mevcut
menü kalır. Telescope küresi ekran oranına göre yumuşakça kadraja alınır.
İngilizce ve Türkçe 40 adım kayıt formuna kadar oynandı. Görsel denetim son
baskında eski korsan bildirimini seçme hatasını buldu: rapor dersinde artık
yalnız ilgili savaşın bildirimi gösterilir; iki rapor da kayıtta korunur.
Kayıt formunun eski "dört sipariş" iddiası kaldırıldı. Bu iki düzeltme Türkçe
40 adımlık tarayıcı tekrarında doğrulandı (`out/academy-final-tr`). Ödülsüz tekrar sırasında gerçek SSE/uyarılar
askıya alınır; çıkınca yeniden bağlanır (App sınır testi).

**Açılış hareketi — son owner düzeltmesi.** İlk derste Devam yok; verilen el
gerçek 3D gezegeni işaret eder ve gezegene dokunmak yönetim menüsünü açar.
Yaklaşma 2 saniyelik smoothstep kullanır; merkez zaten hedefte diye zoom'un
erken bitirilmesi kaldırıldı. Rig, Suspense dışında olduğu için hareket model
yükleme/GPU derlemesi sırasında başlıyordu: artık derlenmiş sahnenin ilk çizimini
bekler ve yükleme karesinin süresini hareketten düşmez. İlk kart gezegenden 48px
boşlukla, önceki yerinden 32px yukarıdadır. Elin DOM ölçümleri stil yazımlarından
önce toplanır; değişmeyen kart konumu yeniden yazılmaz. İlgili 80 web testi, web
tip kontrolü, build ve workspace lint geçti. `out/academy-opening-tr/academy-home.png`
350×812 kadrajı ve gerçek gezegen tıklaması doğrulandı; gerçek telefon FPS
doğrulaması henüz yapılmadı.

Rules suite **873/873**, ilgili sunucu claim/ödül/bot/şema suite **76/76** geçti.
Son genel web koşusunda **2364 başarılı / 4 başarısız**: `orbit`,
`progression-state` gri ikon; `chat-launcher`, `chronicle-launcher` konum sınıfı
beklentileri. Önceki koşudaki iki araştırma süre aşımı son tam koşuda tekrarlanmadı.
Bu dört davranışın HEAD'de de aynı olduğu dosya içeriğiyle doğrulandı.
Tam sunucu koşusu tamamlanmadan SIGTERM ile sonlandı; tam suite geçti sayılmaz.
Son `pnpm verify` tip ve lint aşamalarını geçti; simülatörde mevcut altı
başarısızlık (gün 4 araştırma ve beş seed'de ARR LOW) devam ediyor.
Genel gate yeşil ilan edilmiyor; mevcut balance bandları değiştirilmedi.

**Genel gate yeşil değil.** `pnpm verify`: tip ve lint geçti; rules 860/860.
Değiştirilmeyen alanlarda `orbit.test.tsx` BEACON gri görünüm testi,
`fleet-v2-balance.test.ts` gün 4 araştırma temposu ve `season.test.ts` beş seed'de
ARR LOW başarısız. §5.10-T12'deki VFR notu tarihsel; bu çalışmada görülen
sonuç yukarıdadır. Rules/sim/server ve balance bandları değiştirilmedi.
Genel görsel harness ayrıca eski `data-disc-control="worlds"` seçicisinde
duruyor (D163 sonrası kontrol `home`); tüm görsel suite geçmiş sayılmamalı.

---

## 1 · Durum tablosu

| Soru | Cevap |
| --- | --- |
| Prova (D56) çalışıyor mu? | Evet. Dokuz beat, gerçek arayüz, hesapsız. `onboarding/Rehearsal.tsx` + `script.ts`. |
| Her yeni oyuncu provayı görüyor mu? | **Hayır.** En az iki yol provayı hiç açmıyor (B1, B2). |
| Provayı atlayan ne kaybediyor? | Anlatımı **ve** dört açılış siparişini (B3). |
| Provadan sonra rehber var mı? | Menüde tek bir statik HTML sayfası (`shell/guide.ts` · `GUIDE_URL`), PROVISIONAL. |
| "Şimdi ne yapmalıyım" ekranda cevaplanıyor mu? | **Hayır.** Motor yazılmış, çizilmemiş (B4). |
| Ödül paneli öğretiyor mu? | Hayır; yaptırıyor ve ödüyor, göstermiyor (B5). |

---

## 2 · Bulgular

### B1 · Kayıt formundan giren provayı hiç görmüyor · **kritik**

`screens/LandingScreen.tsx`'in `AuthDialog`'unda `switchToRegister` linki var;
`onMode` `register`'a çevirince form kayıt formuna dönüyor. Oradan gelen çağrı
`session/useSession.ts` · `authenticate('register', …)` → `settle()` →
`me.placement` yok → `servers` fazı → `chooseServer` → `ready`.

`App.tsx`'te prova yalnızca `session.phase === 'rehearsing'` iken mount ediliyor.
Bu yolda o faz hiç oluşmuyor.

Sonucu iki katmanlı: oyuncu **hiçbir açıklama görmüyor**, ve prova sonundaki
`ClaimIntent` listesi yalnızca `claim()` yolunda kuyruğa girdiği için
**kuyruğunda tek sipariş olmadan** gezegenine iniyor. Oyunun mümkün olan en boş
ilk ekranı bu.

### B2 · Kullanılmış cihazda ön kapı ters dönüyor · **yüksek**

`lib/returning.ts` — `astera.commander` bayrağı `settle()` içinde **her** gerçek
oturumda yazılıyor ve çıkışta **silinmiyor**. Bayrak varken `LandingScreen`
ağırlıkları takas ediyor: büyük düğme "Giriş yap" oluyor, prova alta küçük alt
çizgili `newCommander` yazısına iniyor.

Bayrağın kendisi doğru — çift hesap açılmasını engelleyen owner-bug düzeltmesi;
dosyanın docblock'u olayı anlatıyor. Yanlış olan, **yeni oyuncunun da o kapıyı
görmesi**: ortak telefon, arkadaşının telefonu, aynı tarayıcıda ikinci kişi.
Büyük düğmeye basıyor, giremiyor, formun altındaki kayıt linkine düşüyor — yani
**B1**.

### B3 · "Atla" siparişleri de atlıyor · **yüksek**

`onboarding/BeatCard.tsx`'teki `onSkip` → `Rehearsal.skipToClaim` bütün beat'leri
tamamlanmış işaretliyor. İlk beat'te basanın `worldRef.current.intents` listesi
boş olduğu için claim ettiğinde **hiçbir şey kuyruğa girmiyor** — B1'in sonucu.

Kontrol her beat'te, sağ altta, "Zaten bir komutanım var" ile aynı görsel
ağırlıkta ve tek kelime: "Atla".

### B4 · Situation Engine ekranda yok · **kritik**

`lib/directives.ts` yazılmış, dokümante edilmiş, test edilmiş
(`test/directives.test.ts`). `ui/DirectiveCard.tsx` çizilmiş. **Hiçbir bileşen
`directives()` çağırmıyor, hiçbir bileşen `DirectiveCard` render etmiyor** —
`PlanetScreen`, `GalaxyView` ve `onboarding/script.ts` o dosyadan yalnızca
`PlanetGroup` **tipini** alıyor.

Bu, dokümante edilmiş bir varsayımı çürütüyor: `onboarding/script.ts`'in
docblock'u tab turu yapmama gerekçesini *"`lib/directives.ts` sezonun geri
kalanında 'şimdi ne yapmalıyım'ı zaten cevaplıyor"* diye yazıyor. Cevaplamıyor.

**"Ne oluyor bir şey anlayamadık"ın mekanik kökü büyük ihtimalle burası.**

### B5 · Ödül paneli "yaptır → öde" yapıyor, "göster" adımı yok · **orta**

`packages/rules/src/rewards.ts` on bir zincir taşıyor ve tasarımı doğru: ödülü
**eyleme** ödüyor; giriş/seri/gün ödülü değil (`game-design.md` üçünü de adıyla
yasaklıyor). Eksik iki şey:

1. **Kural yok.** Zincir adı eylemi söylüyor (`Yollanan sondalar`), etiket bir
   fayda cümlesi veriyor. Sondanın **ne olduğunu** bilmeyen için ikisi de boş.
2. **Sıra yok.** On bir kart eşit ağırlıkta; yeni komutan için "önce şu" yok.

Kapsam boşlukları: korsan (D150), ticaret (D156), koloni ve araştırma zinciri yok.

### B6 · Sözlük borcu · **orta**

İlk doksan saniyede karşılaşılan uydurma isimler: Komuta Çekirdeği, Rafineri,
Kristal Ocağı, Ok/Atmaca, tier, sis, dossier, Aegis, Kasa, Uplink. Satırın detay
sheet'i sayıdan önce tek cümle sade Türkçe ile "bu ne işe yarar" demeli.

### B7 · Prova tekrar oynanamıyor · **düşük**

Claim'den sonra prova erişilemez. Tek yardım menüdeki statik
`public/hizli-baslangic-rehberi.html`: ayrı stil, dil anahtarı yok (yalnızca
Türkçe), i18n ağacını okumuyor, kendi dosyasında PROVISIONAL işaretli.

---

## 3 · Katmanlı öneri

### Katman 1 — kapıyı kapat · saf onarım, oyun kuralına dokunmuyor

- `AuthDialog`'dan `register` modunu kaldır. Ön kapının yüksek sesli düğmesi
  zaten kayıt; giriş formu yalnızca giriş olsun. **B1 kapanır.**
- "Atla" açılış siparişlerini yine kuyruğa koysun. **B3 kapanır.**
- `returning` bayrağı varken iki kapı eşit ağırlıkta çizilsin. **B2 hafifler**,
  bayrağın çözdüğü çift-hesap bug'ı korunur.
- `DirectiveCard`'ı geri tak. **B4 kapanır**; yazılmış ve test edilmiş kod.

**Bu katman Akademi'den bağımsızdır ve önce yapılabilir.** Akademi gelse bile
B1/B2 yolları kapanmalı: Akademi'ye girmeden hesap açabilen biri hâlâ hiçbir şey
öğrenmeden inecektir.

### Katman 2 — Akademi

§5'e devredildi.

### Katman 3 — sözlük

B6'nın denetimi. Her satırın detay sheet'i sayılardan önce tek cümleyle ne
olduğunu söylesin.

---

## 4 · Ölçüm — tahmin edilmedi, ölçülebilir

- `lib/analytics.ts` `sign_up` olayını `method: 'form'` ve `method: 'rehearsal'`
  diye ayırıyor. **B1'in gerçek büyüklüğü bu iki sayının oranıdır** ve GA
  konsolundan bugün okunabilir. Bu doküman oranı tahmin etmiyor.
- Skip oranı ölçülmüyor; `skipToClaim` bir olay basmıyor. Katman 1 ile eklenmeli.

---

# 5 · AKADEMİ — client-side kurgu eğitim

> **Durum: D172 olarak uygulama ve görsel doğrulama aşamasında.** Owner kararı.
> Güncel ders sırası ve etkileşim kuralları §5.12'dedir; önceki taslağın yerine geçer.

## 5.1 · Ne yapacağız

Yeni oyuncu, gerçek sunucuya **tek istek atmadan**, client'ta çalışan tam kurgu
bir ilk oyun oynar. Bitince kayıt olur ve **gezegeni olduğu gibi gerçek galaksiye
taşınır**: ürettiği her şey aynen spawn olur, yaptığı görevler yapılmış sayılır,
yapmadıkları durur.

Dört özellik, dördü de zorunlu:

1. **Sahne yazılıdır.** Sıradaki ders korsansa korsan o an yanına spawn olur;
   asteroitse asteroit o an geçer.
2. **Arayüz kapalı başlar, ders ilerledikçe açılır.** Önce tek sekme, içinde tek
   satır.
3. **Her ders üç parça:** anlat → yaptır → ödülünü al.
4. **Sonunda gerçek aktarma.** Emeği duruyor.

## 5.2 · Neden böyle — ve neden başka türlü değil

**Amaç §0'da.** Bu bölüm, oraya giden yolda **elenen** seçenekleri ve eleme
gerekçelerini kaydeder. Bunlar tartışıldı ve kapandı; yeniden açma.

| Alternatif | Neden reddedildi |
| --- | --- |
| **Gerçek galakside doğrudan eğitim** | İçerik garanti edilemez. "Kazıcıyı asteroide yolla" diyen ders, menzilde kaya yoksa ya da 40 birim uzaktaysa cevapsız kalır. Korsan için de aynı. Sahneyi kurmadan ders anlatılmaz. |
| **Sunucuda özel eğitim shard'ı** | Sunucu yükü kabul edilmedi (owner kararı). Her ziyaretçi için dünya yaratmak istenmiyor. |
| **State aktarımı** (client "Çekirdeğim 5" der, sunucu yazar) | `/api/onboarding/claim` **kimlik doğrulaması olmayan** bir endpoint. Oyunu ilk açan sınırsız kaynakla başlar. Çözüm §5.7. |
| **`PLANET_START`'ı değiştirmek** | O sabiti nötr dünya seed'i de okuyor. Değiştirmek koloni/nötr dünyaları da şişirir. Çözüm: ikinci sabit (§5.8). |
| **Instant build** | Kuyruk değişmezi. `routes/onboarding.ts`'in `replay()`'i `launch` intent'ini tam da bu yüzden reddediyor: *"manufacturing one here would be the instant-build exception the queue exists to remove."* Çözüm: kısa süreler, gerçek kuyruk. |
| **Eğitimi 20 dakikalık bir beklemeyle bitirmek** | Hesabı olmayan oyuncu beklemez, çıkar ve dönmez. Tavan 60 saniye. Design Law #1 §5.6'teki kuyrukla karşılanıyor. |
| **Gerçek sunucuda ilerleyici menü açma** | Kapsam dışı (owner kararı). Aktarmadan sonra arayüz **bugünkü gibi**. |
| **Karartma + spot ışığı** (D56 `Spotlight`) | Pahalı ve kırılgan geometri, ve ilerleyici açmayla birlikte gereksiz. Yerine el + baloncuk. Gerekçe §5.5. |
| **Suistimali şimdi çözmek** | Yeni hesap açarak eğitim paketini tekrar almak **bilerek kabul edilen** bir maliyet. Bu aşamada çözülmeyecek. |

**Kabul edilen iki risk, açıkça:** suistimal göz ardı ediliyor; gerçek sunucuda
gizleme yok.

## 5.3 · Beş kural

1. **Sahne yazılıdır.** Aranan hiçbir şey bulunamamazlık edemez.
2. **Arayüz kapalı başlar, sırayla açılır.** Oyuncu hiçbir an anlamadığı bir
   kontrole bakmaz. Menü itemlarının (Production, Intel, Defend, Fleet etc.) altındaki itemlar'da kapalı başlar. Tanıttıkça sırası gelen açılır.
   Kullanıcının kafası karışmaması ve aşırı bilgi yüklemesi olmaması için, mümkün oldukça her şey tek tek, tane tane açılarak ilerlenilir.
3. **Her ders üç parça:** anlat → yaptır → ödülünü al.
4. **Instant yok, kısa var.** 1sn → 60sn arası artan basamaklar. Kuyruk gerçekten
   çalışır, sadece hızlıdır. **Tavan 60 saniye.**
5. **Sayılar `@astera/rules`'tan gelir, sahneleme script'ten.** Fiyat, süre,
   kapasite — hepsi gerçek kurallardan. `onboarding/rehearsalFetch.ts` bunu bugün
   zaten yapıyor ve on üç endpoint'i cihazda karşılıyor. **Sahte sayı yazan bir
   eğitim, var olmayan bir oyunu öğretir** — hiç eğitim olmamasından kötüdür.

## 5.4 · Ders listesi

Sıra: her ders bir sistemi tanıtır ve bir öncekinin açtığını kullanır. "Açar"
sütunu, o an arayüzde görünür hale gelen şeydir.

| # | Anlatır | Yaptırır | Açar | Ödül |
| --- | --- | --- | --- | --- |
| 1 | Bu senin gezegenin; gücü ve savunması şurada yazıyor | Gezegene dokun | Odak rayı | — |
| 2 | Oyunda üç kaynak var, hangisi ne için | Üretim sekmesini aç | **Üretim** sekmesi | — |
| 3 | Komuta Çekirdeği: hiçbir bina bundan yüksek olamaz | Çekirdek S2 | `CORE` satırı | kaynak |
| 4 | Alaşım en çok kullanılan kaynaktır | Rafineri S2 | `REFINERY` satırı | kaynak |
| 5 | Kristal araştırma ve gelişmiş gemiler için | Kristal Ocağı S2 | `EXTRACTOR` satırı | kaynak |
| 6 | Kasa: deponun bir kısmı her yenilgide korunur | Kasa S1 | `VAULT` satırı | kaynak |
| 7 | Gemi üretmek için tersane gerekir | Tersane S1 | **Filo** sekmesi | kaynak |
| 8 | İlk filon: hızlı, ucuz, her işe yarar | 2 Ok üret | hull satırları | kaynak |
| 9 | Korsanlar: ganimet verir, gemi kazandırır, gemi de kaybettirir | Korsana saldır | korsan hedefi | kaynak + gemi |
| 10 | Asteroit geçiyor; kazıcı ore getirir | Kazıcı üret + gönder | Kazıcı satırı | kaynak |
| 11 | Sis: kimsenin elinde ne olduğunu göremezsin | Komşuya dokun | — | — |
| 12 | Sonda: bilmenin bedeli var, ve seni ele verebilir | Sonda gönder | **İstihbarat** sekmesi | kaynak |
| 13 | Araştırma gezegene değil komutana aittir | 1 araştırma | **Araştırma** sekmesi | kaynak |

**Kural — P4 koşulu.** Eğitim, **öğretmediği sekmeyi bile açmış olarak** bitmeli.
Aktarmadan sonra gizleme olmadığı için, hiç görülmemiş bir sekmenin gerçek
galakside düşmesi §2'nin "ne oluyor" uçurumunu geri getirir. Derinlemesine
öğretilmemesi sorun değil — ödül paneli devralır.

## 5.5 · Ders nasıl gösterilecek — el ve baloncuk

**Owner kararı.** D56'nın karartma + spot ışığı mekanizması **kullanılmayacak**.

**Ne olacak.** Hedefin yanında bir **el işareti**, elin üstünde ya da altında bir
**konuşma baloncuğu**. Baloncuk dersin cümlesini taşır, el neyi kastettiğini
gösterir. Mümkünse baloncuğun gösterdiği şey tek tıklanabilir öğedir; mümkün
değilse sorun değil — arayüz zaten sırayla açılıyor.

El gösterdigi yerde animasyon ile tıklıyormuş gibi hareket eder ve tıkladıgı noktada büyüyen çemberler olur (su dalgası animasyonu gibi, tıklanması gerektigini ifade eder), z-index olarak animasyon altta el üstte olur.

**Ne olmayacak.** Ekranın kararması ve hedefte delik açılması.

### Neden

1. **Karartma pahalı ve kırılgan.** `onboarding/Gate.tsx` · `Spotlight` bugün her
   karede hedefleri ölçüyor, N delikli bir SVG mask çiziyor, iç içe geçmiş
   sheet'lerin en üstte olanını çözüyor (`Rehearsal` · `inTopSurface`) ve kartın
   hangi kenara oturacağına karar veriyor (`usePlacement`). Dosyanın kendi
   docblock'ları bunun neden böyle olmak zorunda olduğunu ve hangi hataların
   çıktığını anlatıyor — kart bir kere build sheet'inin kontrollerinin üstüne
   oturmuş, "neyin basılabildiği" ile "neyin ışıklandırıldığı" tam bu yüzden iki
   ayrı listeye bölünmüş.
2. **Ve gereksiz.** Yeni eğitimde arayüz zaten sırayla açılıyor (§5.3-2). Ekranda
   tek satır varken karartacak bir şey yoktur. İki mekanizma aynı işi iki kez
   yapıyor, ve **açma bunu karartmadan iyi yapıyor — çünkü kaldırıyor,
   karartmıyor.**

### Ne kalıyor: tıklama kilidi

**`Gate.tsx` · `useGate` SİLİNMEYECEK.** "Sadece o tıklanabilir olsun" isteğinin
tam karşılığı odur ve **hiç geometri içermez**: capture fazında aktivasyon
olaylarını dinleyip hedefin dışındakini iptal eder. `preventDefault` yalnızca
`click`'te çağrılır, bu yüzden scroll, pinch ve orbit çalışmaya devam eder.
Kırk satır, yazılmış, sahada çalışıyor.

Ayrım net: **`useGate` (kilit, geometrisiz) KALIR · `Spotlight` (karartma,
geometrili) GİDER.** İkisi bağımsız hook'tur; birini silmek diğerine dokunmaz.

`useGate`'in `data-beat-card` muafiyeti **baloncuğa taşınmalı**, yoksa oyuncu
baloncuğun kendi kontrolüne (ileri / atla) basamaz ve eğitim kilitli kapıya döner.

### Geometri tamamen kaybolmuyor

El ve baloncuk da hedefin **nerede** olduğunu bilmek zorunda. Ama iş çok küçülüyor:
N delikli mask ve en üst yüzey çözümü yerine **tek dikdörtgen** ve "üstte mi altta
mı" kararı.

### Tuzaklar

- **T-A · Baloncuk gösterdiği şeyin üstünü kapatmamalı.** Bu kod tabanında daha
  önce olmuş bir hata; `script.ts`'teki `selectors` / `lit` ayrımı ve
  `usePlacement` tam olarak bunun için var. Hedefin dikdörtgenine bakıp baloncuğu
  karşı tarafa koy.
- **T-B · Takip rAF ile yapılır, state ile değil.** `Spotlight`'ın docblock'u
  sebebini yazıyor: state'e ölçmek işareti bir kare geriye düşürür ve parmak
  ekrandayken bu **gecikme olarak okunur**; ayrıca `GalaxyView` dahil bütün ağacı
  saniyede altmış kez yeniden render eder. Konumu doğrudan DOM'a yaz.
- **T-C · Hedef henüz var olmayabilir.** Sheet açılış animasyonundayken ölçülecek
  kutusu yoktur. `useScrollIntoView` bunu ~2 saniyelik rAF denemesiyle çözüyor;
  aynı bekleme el için de gerekli.
- **T-D · Hedef ekran dışında olabilir.** `useScrollIntoView` beat başına bir kez
  hedefi görünüre getiriyor. **Korunmalı** — işaret ettiği şey görünmeyen bir
  işaret, bozuk bir işarettir.
- **T-E · 350px bütçesi.** Baloncuk hedefin **yanına** değil, üstüne ya da altına
  konur. Tam genişlikte bir satırın yanında baloncuğa yer yoktur (§5.10-T7).
- **T-F · Reddedilen tıklama hissedilmeli.** `useGate`'in `onRefused`'ı bugün
  kartı titretiyor (`BeatCard` · `nudge`). Artık **baloncuğu** titretmeli; sessiz
  bir ret, bozuk bir düğme gibi okunur.

## 5.6 · `TUTORIAL_EXIT` — çıkış durumu

**Tek, yazılmış, sabit.** Herkes aynı gezegenle iner. Bu "oyuncuya göre değişen
başlangıç" değil, **ikinci bir sabit başlangıçtır** — ve dolayısıyla kalibre
edilebilir. Spec'in tamamı bu özelliğe dayanıyor.

**Bunun korunması için eğitimde serbest harcama yoktur.** Her adım tam o adımın
gerektirdiği kaynağı verir. Oyuncu istediği kadar fazladan gemi üretebiliyorsa
çıkış durumu oynaklaşır ve sabit olma özelliği kaybolur.

Alanları:

- bina seviyeleri · hangar içeriği · üç kaynak
- claim edilmiş sayılan ödül tier'ları
- **kuyrukta dönen bir sipariş ve kalan süresi**

**Design Law #1, beklemeyi eğitime sokmadan.** Eğitimde tavan 60 saniye; ama
aktarma **çalışan bir kuyrukla** iner. Oyuncu gerçek gökyüzüne indiğinde "Komuta
Çekirdeği S4 — 18 dk" zaten dönüyordur. Tek saniye beklemedi, hesabını açtı, ve
geri dönmek için sebebi var. İlk gerçek süreyi eğitimde değil, gerçek dünyada ve
doğru anda öğrenir.

## 5.7 · Sınır protokolü — **state değil, adım numarası**

`/api/onboarding/claim` kimlik doğrulaması olmayan bir endpoint'tir. Bugün oradan
gelen on iki adımlık `ClaimIntent` listesine sunucu **inanmıyor**; hepsini
`placeBuildingUpgrade` ve `placeUnitBuild` üzerinden gerçek fiyatla yeniden
çalıştırıyor. `replay()`'in docblock'u bunu şöyle özetliyor: *"Prova hiçbir şeye
karar vermedi."*

**Protokol:** client yalnızca **kaçıncı dersi bitirdiğini** gönderir. Çıkış
durumunun kendisi `TUTORIAL_EXIT` olarak **sunucuda yazılıdır**. Eğitim herkes
için aynı olduğundan buna zaten gerek yoktur; bu, protokolü hem güvenli hem basit
yapar.

Yarıda bırakma bedavaya gelir: on üç dersin altısını bitiren `step: 6` gönderir,
sunucu o basamağın çıkış durumunu yazar.

## 5.8 · Dokunulacak yerler

| Yer | Ne olacak |
| --- | --- |
| `packages/rules/src/constants.ts` · `PLANET_START` | Yanına `PLANET_START_WITH_TUTORIAL` **eklenir**; mevcut sabit **silinmez** — nötr dünya seed'i onu okumaya devam eder. |
| `packages/rules/src/constants.ts` · yeni | `TUTORIAL_EXIT` — §5.6'in alanları. |
| `apps/server/src/services/player.ts` · capital yaratma | Hangi sabitle doğacağını seçer. |
| `apps/server/src/routes/onboarding.ts` · `untouched()` | **Her iki sabiti de** kabul etmeli. Bkz. §5.10-T1. |
| `apps/server/src/routes/onboarding.ts` · `replay()` | Aktarma replay değil; gezegen yaratılırken authored durumla tohumlanır (`seedFromTutorial`). Mevcut intent yolu geriye dönük uyum için kalır. |
| `apps/server/src/schemas/fleet.ts` · `onboardingIntentSchema` | Adım numarası taşıyan alan; **state alanı eklenmez**. |
| `apps/server/src/services/bots/sweep.ts` → `joinSeason` | Botlar da aynı yaratma yolundan geçiyor. Bkz. §5.10-T2. |
| `packages/sim/src/season.ts` | Tarihsel öneri; §5.12 ile ayrıntılı başlangıç/tempo kalibrasyonu kapsamdan çıkarıldı. |
| `apps/web/src/onboarding/Gate.tsx` | `useGate` **kalır** (tıklama kilidi, geometrisiz). `Spotlight` ve `draw()` **silinir**; `usePlacement` baloncuk yerleşimine göre sadeleşir. §5.5. |
| `apps/web/src/onboarding/BeatCard.tsx` | Sabit kenar kartından **el + baloncuğa** dönüşür; `data-beat-card` muafiyeti ve `nudge` onunla taşınır. |
| `apps/web/src/onboarding/script.ts` | `gate.lit` / `gate.dim` alanları düşer — karartacak bir şey kalmadı. `selectors` kalır: kilit onu okuyor. |
| `apps/web/src/onboarding/` | Script motoru: ders tablosu, sahne spawn'ları, ilerleyici açma. |
| `apps/web/src/i18n/locales/{tr,en}/onboarding.ts` | On üç dersin metni, **iki dilde**. |

## 5.9 · Nasıl yapılacak — uygulama sırası

**TDD zorunludur.** `CLAUDE.md`: *"Tek kelime bir kod dahi yazılıyorsa bu method'u
uygulamak ZORUNLU, ŞART."* Her adımda: testi yaz → FAIL gör → implementasyon →
PASS → tüm suite → `pnpm verify`.

Sıra önemli. Sunucu sınırı client'tan önce gelir, çünkü client script'inin şekli
`TUTORIAL_EXIT`'e bağlıdır.

1. **`TUTORIAL_EXIT` ve `PLANET_START_WITH_TUTORIAL`** — `packages/rules`.
   Testleri: iki sabit birbirinden bağımsız, `PLANET_START` değişmemiş,
   `TUTORIAL_EXIT` §5.4'ün derslerinin toplamıyla tutarlı.
2. **`untouched()` iki sabiti de kabul eder** — `apps/server` contract testi.
   Bu adım atlanırsa aktarma sessizce reddedilir (§5.10-T1).
3. **`seedFromTutorial` ve sınır protokolü** — schema + route + contract testi.
   **Adversaryal test şart:** uydurulmuş bir adım numarası, negatif sayı, aralık
   dışı değer, aynı claim'in iki kez gelmesi.
4. **Client script motoru** — ders tablosu ve ilerleyici açma. `rehearsalFetch.ts`,
   `world.ts` ve `Gate.tsx` · `useGate` bugün mevcut ve yeniden kullanılabilir;
   sıfırdan yazma. `Spotlight` bu adımda silinir, `BeatCard` el + baloncuğa
   dönüşür (§5.5).
5. **Sahne spawn'ları** — korsan ve asteroit, ders sırası geldiğinde.
6. **i18n** — iki dil, `t()` tiplenmiş; eksik anahtar derlemede yakalanır.
7. **Simülatör** — tarihsel öneri; §5.12 owner kararıyla ayrıntılı modelleme/kalibrasyon uygulanmaz. Mevcut hata bantları genişletilmez.
8. **Bot başlangıcı** — §5.10-T2'nin kararı uygulanır.
9. **Görsel doğrulama** — `node tools/visual.mjs`, 350px.

**Katman 1 (§3) bu sıradan bağımsızdır ve önce yapılabilir.** Akademi gelse bile
B1/B2 kapanmalı: Akademi'ye girmeden hesap açabilen biri hâlâ hiçbir şey
öğrenmeden iner.

## 5.10 · Nelere dikkat edilecek

**Sessizce kıran yerler.** Aşağıdakiler test yazılmazsa fark edilmeden geçer.

**T1 · `untouched()` aktarmayı reddeder.** `routes/onboarding.ts` · `untouched()`
dört şeye bakıyor: kaynak `PLANET_START`'a eşit mi, `build_orders` boş mu, `units`
boş mu, `missions` boş mu. Gelişmiş bir gezegen tanımı gereği "touched" — ve
`claim` bu durumda **her intent'e `ALREADY_OPENED`** cevabı verir. Hiçbir yer
hata fırlatmaz; aktarma sessizce hiçbir şey yapmaz.

**T2 · Botlar bir adım geride doğar.** `services/bots/sweep.ts` botları
`joinSeason`'a sokuyor — yani insanla **aynı** yaratma yolundan geçiyorlar. İki
sabit olunca her bot her insandan bir adım geride doğar. D159 botlara Core-floor
band ve `coreCeiling` gibi kendi manevralarını vermiş; ayarlanmazsa botlar kalıcı
olarak zayıf hedefe döner — ki botların varlık sebebi canlı hissettiren rakip
olmak. **En basit çözüm: botlar da tutorial sabitiyle doğsun.**

**T3 · D168 tier bandı.** Band ±1 ve **her nerede olursa olsun en yüksek
Çekirdek** ile ölçülüyor. Daha yüksek Çekirdekle inen yeni oyuncu, daha yüksek
tier'lı saldırganlara **yasal hedef** olur. Eğitim onu daha hazırlıklı yapıyor
ama bu bir güvenlik sonucudur; ölçülmeden geçilmemeli.

**T4 · `packages/rules` saf kalır.** Bağımlılık yok, saat yok, I/O yok, ortam
rastgeleliği yok. Ders 9'un savaş sonucu **yazılıdır** (senaryo), ama sayıları
gerçek kurallardan gelmeli. ±8% varyans burada aranmaz; seed'li RNG **çağıranda
bir seam** olur, rules paketine rastgelelik eklenmez.

**T5 · Bandı genişletme.** `CLAUDE.md`: *"Never widen a balance/health band to
make a feature pass; fix model/constants."* Simülatör kırmızı yanarsa çözüm
`TUTORIAL_EXIT`'i küçültmektir, bandı açmak değil.

**T6 · `localStorage` erişimin kendisi fırlatabilir.** Hesapsız oyuncunun eğitim
ilerlemesi orada duracak. `lib/returning.ts`'in docblock'u sebebini anlatıyor:
Safari özel gezinti, site verisi kapalı tarayıcı ve gömülü webview **okumada**
bile fırlatıyor. Her okuma ve yazma try/catch içinde olmalı ve **değer yokken
sayfa doğru çizilmeli**.

**T7 · Ekran bütçesi 350 x 812.** `tools/visual.mjs` tam 350'te çalışır. Ders
kartı bu bütçeye sığmalı; kesilen bir isim küçük bir isimden kötüdür.

**T8 · Compact ve premium.** Owner'ın üç kez tekrarlanmış duran talimatı: **büyük
tasarım yok.** Şüphede kal**ma**, KES. Ders kartı bir cümle, bir kontrol; paragraf
değil.

**T9 · Türkçe yazılır, çevrilmez.** `i18n/locales/tr/entry.ts`'in başındaki
kurallar geçerli: cümle kurulur, ad değil fiil kullanılır, tire yerine noktalı
virgül gelir. `İ` naif şekilde küçültülmez. İki dilde de anahtar bulunmalı; `t()`
tiplenmiş, eksik anahtar derlemede yakalanır.

**T10 · `packages/rules` değişince iki dev sunucusu da yeniden başlatılır.**

**T11 · Kalite kapısı.** `pnpm verify` — sıfır tip hatası, sıfır lint hatası,
beklenen testler yeşil. `pnpm lint`'i kök script üzerinden çalıştır (4 GB heap);
çıplak `eslint .` yetmez. `any` ve derleyici susturan cast yasak.

**T12 · Mevcut tıkalı gate.** `pnpm verify` bugün **D134 ayrı Research kuyruğu
balance regresyonu** dışında yeşil (beş sabit seed'de VFR LOW). Bu iş o gate'i
temizlemez ve ona karşı tuning yapılmaz. `docs/balance.md` denenmiş ve başarısız
kolları listeliyor.

## 5.11 · Balance borcu

İkinci sabit balance işini **yok etmez, daraltır.** Yeniden türetilmesi gereken
şey erken oyun tempo'sudur ve büyüklüğünü kontrol eden **tek kol, eğitimin ne
kadar ileri gittiğidir**:

- Çekirdek 2-3'te biten eğitim = ilk bir saatin sıkıştırılması. Risk küçük.
- Çekirdek 6'da biten eğitim = ilk günün atlanması. Zaten tıkalı olan gate bir
  daha açılmaz.

**Çıkış durumunu küçük tut.** §5.4'ün tablosu bu ilkeye göre yazıldı.

## 5.12 · Owner yanıtları — 7 Eylül 2026 (D172)

Önceki açık soruların yerine geçer:

- D56'nın yerini tamamen yerel Akademi alır; eğitimde gerçek oyuncular olduğu söylenmez.
- Tekrar oynama açık, gerçek hesaba yeniden ödül veya başlangıç paketi yok.
- Korsan savaşı küçük gemi kayıplı zafer olur; eğitim süreleri kısa tutulur,
  genel gemi hızları değiştirilmez.
- Core 2 tabanlı çıkış yeterli. Owner ayrıntılı simülatör kalibrasyonunu istemedi;
  maliyet, kapasite ve aktarım tutarlılığı testleri korunur.
- El görseli owner'ın sağladığı `tutorial-hand-icon.png`; yeni görsel üretilmez.
- Yalnız tanıtım adımlarında el ve tıklama dalgaları **yok**; tanıtılan öğe
  çerçevelenir, detay sheet'i açılmaz. Kısa işlev açıklaması bunun yalnız tanıtım
  olduğunu ve geliştirme yapmadan devam edilmesini söyler. Devam düğmesi
  sürekli büyüyüp küçülür; son owner kararıyla OS hareket tercihi kontrol edilmez.
- Tıklama, sekme açma, inşa, geliştirme, üretim, gönderim veya ödül alma
  gereken adımlarda **Devam yok**; gerçek eylem ilerletir. Rapor açılıp
  incelendikten sonra kapatılması ilerletir; araya ikinci bir Devam konmaz.
- Yeni menü sekmesi tanıtılırken gezegen menüsü kapanmaz. Önceki sekme açık
  kalır; yeni sekme görünür olur ve oyuncu ona dokununca ders ilerler.
- Telescope düğmesi görüş küresini açınca kamera yumuşakça uzaklaşır;
  mesafe ekran oranına göre kürenin tamamını sığdırır. Oyuncuya görmesi için
  kısa süre tanınır, ardından sıradaki tanıtıma geçilir; Devam istenmez.
- Açılışta sahne hazır olduktan sonra mevcut uzak konumdan gezegene 2 saniyede
  süzülür. Devam yerine gerçek gezegene dokunulur; el ve alttaki iki tıklama
  halkası bütün eylem adımlarında döngüsel hareket eder. İlk kart biraz yukarıda
  durur; yalnız tanıtım adımları el yerine çerçeve kullanmaya devam eder.
- Akademi boyunca bütün toast'lar susturulur: önceden bekleyenler temizlenir,
  yenileri kuyruğa girmez; çıkınca normal bildirimler devam eder. Form/öğretici
  kartın kendi doğrulama metinleri bu toast susturmasından etkilenmez.
- Yükleme ekranı elden daha üst katmandadır; yükleme varken el ve halkalar
  gizlenir. İlk derste kapak kalkması yeterli değildir: el, kamera yakınlaşması
  gerçekten bittiğinde görünür (oyuncu kamerayı elle devralırsa hareket sonlanır).
- Ödül adımlarında el Claim'i gösterir; Akademi kartının yerleşimi ise yalnız
  düğmeye değil ödül kartının tamamına göre hesaplanır. Ödül başlığı kapatılmaz.
- İnşa/geliştirme/gemi üretimi kabul edildiğinde menünün kaydırılabilir gövdesi
  yumuşakça en üste döner; aktif kuyruk ve bekleme açıklaması görünür olur.
  Saat güncellemeleri tekrar tekrar kaydırmaz.
- Üretim derslerinde miktar hazır ve dersle aynıdır: ilk/ikinci Dart üretimi 2,
  Kazıcı ve Kurye 1. Oyuncuya yerel motorun reddedeceği "1 Dart üret" sunulmaz.
  Gerçek oyunun serbest miktar seçicisi değişmez. Önceki tarayıcı otomasyonu
  miktarı elle artırarak 27. adım hatasını gizliyordu; artık ilk sunulan adedi
  doğrular ve doğrudan Build'e basar. İki Dart dersinin tek-basış regresyonları
  dahil ilgili 71 test geçti.
  Son üretim build'iyle Türkçe/İngilizce 27 ve 36. adımlar ayrıca tarayıcıda
  **adet artırmadan tek Build basışıyla** geçti: iki Dart kuyruğu, üst konum,
  toast yokluğu ve sonraki adıma ilerleme doğrulandı (`out/academy-build-en`,
  `out/academy-build-tr`). Web tip kontrolü/build geçti; son geniş web koşusu
  2364/2368 ve yukarıdaki dört mevcut hatadır (iki yeni tek-basış testi ayrıca geçti).

**Güncel ders sırası (§5'teki eski ders tablosunun yerine geçer).** Production:
Core, Alloy Refinery, Crystal Extractor tanıt/geliştir/ödül; Deuterium Refinery
ve Foundry yalnız tanıt. Intel: Uplink, Telescope, Radar, Veil tanıt; Telescope
adımında `data-sensor-toggle="telescope"` ile görüş alanını göster. Defend:
Vault ve Aegis tanıt/geliştir/ödül (1/3/5 zincirleri), Thorn/Bastion yalnız tanıt.
Fleet: Shipyard tanıt/geliştir/ödül, Hangar tanıt; iki Dart üret, korsana saldır,
savaş bildirimini ve raporunu göster, korsan ve üretim ödülünü al. Prospector
üret, asteroide gönder, ödül al. Araştırma menüsünü tanıt. İki Dart daha ve bir
Courier üret; kargonun işlevini anlat, kurgu gezegene saldır, sonucu göster,
tebrik ve gerçek galaksiye aktarım.

### Önceki açık sorular (tarihçe)

Aşağıdakiler ilk taslaktaki sorulardır; yukarıdaki yanıtlarla kapatıldı.

1. **D56 provasının kaderi.** Akademi'nin ilk sekiz dersi bugünkü dokuz beat'in
   yerini tutuyor. Prova siliniyor mu, Akademi'nin içine mi katlanıyor, yoksa
   ikisi bir arada mı duracak? Bir arada duramaz gibi görünüyor — iki onboarding
   olur. **Ve bir bedeli var:** bugünkü prova `/api/preview` ile **gerçek**
   frontier galaksisini gösteriyor ve ilk beat'in metni *"Bu galakside gerçek
   insanlar oynuyor"* diyor. Tamamen kurgu bir galaksi bu cümleyi yalan yapar ve
   oyuncu bunu aktarma anında öğrenir. Melez bir yol mümkün: **gökyüzü gerçek,
   sahne öğeleri kurgu.**
2. **Eğitim tekrar oynanabilir mi?** (§2 B7'nin cevabı olurdu.)
3. **Ders 9'un savaşı hep kazandırır mı?** Bir kez kaybettirmek bu oyunun
   öğretmesi gereken en önemli şey — sis ve geri alınamazlık — ama aynı zamanda
   hesabı olmayan oyuncuyu kaçırabilecek tek an.
4. **`TUTORIAL_EXIT` tam olarak nedir?** §5.4 hangi dersin neyi yükselttiğini
   söylüyor; nihai rakamlar simülatörle birlikte kararlaştırılmalı.
