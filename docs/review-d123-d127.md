# Kazanılan Harita — code review ve QA devir teslimi

> **Kapsam:** D123–D127 bilgi katmanı onarımı ve ardından yapılan tam denetim.
>
> **Kime:** İşi hiç görmemiş, projeyi de tanımayabilecek bir gözden geçirene. Bölüm 1–3
> ürünü ve karar yöntemini anlatır; okuduysanız 4'ten başlayın.
>
> **Geçici doküman.** Review ve QA bittiğinde silinir. Kalıcı gerçek `docs/decisions.md`
> D123–D127 ve `CLAUDE.md` değişmezler tablosudur. **Uyuşmazlıkta doküman kodun üstündedir**
> — önce hangisinin yetkili olduğunu bulun, koda bakıp "demek ki böyleymiş" demeyin.

| | |
| --- | --- |
| `pnpm verify` | yeşil — 0 tip hatası · 0 lint hatası |
| Test | **2.482** (rules 357 · server 796 · web 1.262 · sim 67) — önce 2.413 |
| Dokunulan dosya | 79 — 69 değişmiş, 6 yeni kaynak/test, 4 üretilmiş drizzle meta |
| Migration | 2 — `0035_rare_madripoor` · `0036_moaning_master_chief` |
| Bulgu | **11 kusur grubu** (23 ayrı düzeltme) — 10 grup kapatıldı, 1 açık karar |
| Commit | 0 — her şey çalışma ağacında |

---

## 1 · Amacımız ne — Astera Online

Üç kişilik bir ekibin yaptığı, **mobil öncelikli, gerçek zamanlı, çok oyunculu uzay oyunu.**
En fazla 300 gerçek oyuncunun paylaştığı bir galakside her komutanın bir korumalı ana
gezegeni ve en fazla üç kolonisi var. **Mülkler gizlidir; onları keşfetmek ve üzerine
hareket etmek oyunun kendisidir.**

Tek cümlelik hedef:

> **Oyuncu oyunu kapattıktan sonra "yokken ne oldu acaba?" diye merak etsin.**

Ve tasarımın bel kemiği:

> **Filo bahistir. Bilgi oyundur. Gezegen ise ödüldür.**

### Çekirdek döngü

```text
GELİŞTİR → BİRİKTİR → İSTİHBARAT TOPLA → FIRSAT GÖR → HEDEF SEÇ
→ RİSK AL → GÖNDER → ÇEVRİMDIŞI BEKLE → SONUÇ → KAZANÇ / KAYIP → YENİ KARAR
```

Savaş raporları yeni istihbarat üretir ve döngü yeniden başlar. **Ekonomi ve binalar döngüyü
destekler; döngünün kendisi değildir.** Bu ayrım önemli: "daha çok bina, daha çok kaynak"
yönünde giden her öneri döngüyü `İNŞA ET → BEKLE → TOPLA → YÜKSELT`'e çevirir ve oyunu
öldürür.

### Hissiyat çıtası

Her iş üç soruyla yargılanır: **Canlı mı** (başkalarının filoları, madenciliği, savaşları
gözle görülür şekilde akıyor mu), **Şimdi mi** (zamanlı olaylar herkesin ekranında sunucunun
belirlediği anda oluyor mu), **Güzel mi** (oynanış maliyeti sıfırken ölçek, derinlik, ışık
ve gösteri tercih edildi mi). Hedef görüntü: *içinde uçabileceğin canlı bir NASA fotoğrafı.*

**Basit uygulama, muhteşem sunum.** Karmaşıklık sunumda olur, mekanikte değil.

### Neden bu iş yapıldı

Sahibi ilk gerçek oturumdan sonra tek cümleyle söyledi: **taktik yok** — herkes seviye
atlayıp olabildiğince gemi yığıp dalıyor. Kök neden bir denge sorunu değildi;
**bilgi bedavaydı.** 3B disk her filonun tam kompozisyonunu, her dünyanın sahibini,
gelişimini, uydularını ve kalkanını herkese, her mesafede, ücretsiz veriyordu. Teleskop ve
Radar, oyuncunun zaten sahip olduğu şeyi satıyordu. Asimetri yoksa taktiğin yaşayacağı yer
de yoktur.

---

## 2 · Dokunulmaz ilkeler

Bir değişikliği yargılarken ölçüt bunlar. Hepsi tekrar tekrar kazanıldı; gerekçeleri
`docs/decisions.md`'de.

1. **İstemci sonuç belirlemez.** Çizer ve niyet gönderir. Sunucu; kaynağı, filoyu, savaşı,
   seyahati, bekleme sürelerini, yağmayı ve ilerlemeyi işlem içinde belirler.
2. **Kalkan filo geri çağrılamaz.** Risk, geri dönülemez bir taahhüt gerektirir.
3. **İzlemek sessizdir; sonda göndermek gürültülüdür.** Hedef sondaları öğrenir,
   izleyicileri asla.
4. **Bilginin hem bedeli hem kullanma maliyeti vardır.** Bilmek, bileni ele verebilir.
5. **Savaş basit kalır. Beceri bilgi katmanındadır.** Varyans ±%8'i geçmez, yoksa
   istihbaratın değeri silinir.
6. **Kamusal anlar herkese görünür.** Sis, karar öncesi bilgiyi gizler; canlı olayı asla.
7. **Oyuncunun GÖREMEDİĞİ kural, kural değildir (D124).** Bilgi katmanı 3B galakside
   görünür olmak zorundadır, yalnızca payload'da doğru olmak yetmez.
8. **Dünya canlıdır; arayüz onu beklemez.** Tahmin et, uzlaştır, sunucu zamanlı uyandır.
   Tek dokunuş iki gidiş-dönüş gerektirmemeli.
9. **Sis sorguda zorlanır, yalnızca arayüzde değil.** Ve **ihmalle** uygulanır: gizlenen
   alan `null` değil, **yok**. Null'lanmış alan, değiştirilmiş bir istemcinin arayabileceği
   bir alandır.

---

## 3 · Nasıl karar veriyoruz

### Yetki sırası

Yukarıdaki kazanır:

1. Kilitli kısıtlar (mobil-öncelikli dikey, üç kişilik ekip, önce web, gerçek zamanlı
   kalıcı dünya, bir komutan = bir ana gezegen + en fazla üç koloni, sunucu otoritesi)
2. `docs/game-design.md`
3. `docs/decisions.md`
4. Kod
5. `PROVISIONAL` işaretli yönlendirme
6. Ajan/geliştirici tercihi

**Kod otomatik olarak haklı değildir.** Davranış değişecekse önce doküman güncellenir.

### Değişiklik disiplini

> **Yalnızca istenen şey değiştirilir.**

Zorunlu yan değişiklikler (a) gerekçesiyle raporlanır, (b) `docs/decisions.md`'ye ya da
yerel bir yoruma yazılır, (c) bir ölçüm, düşen bir test veya simülatör koşusuyla kanıtlanır.
Aksi hâlde dokunulmaz, sadece bahsedilir.

Yeni bir sistem şu döngüyle doğrulanır: **PROTOTİPLE → OYNA → GÖZLEMLE → KARAR VER.**
Argümanla değil.

### Kalite çıtası

> **TESTİ OLMAYAN KOD BİTMEMİŞ İŞTİR.**

`pnpm verify` = 0 tip hatası · 0 lint hatası · tüm testler yeşil. `any` ve derleyici
susturan cast yasak; güvenilmeyen girdi sınırda Zod ile ayrıştırılır. Riskli sınırlar test
edilir: bozuk/düşmanca girdi, eşzamanlılık, hata, zaman. **Testi ya da kodu değiştirmeden
önce kök neden bulunur.** Ve: *bir özelliği kabul ettirmek için sağlık bandı asla
genişletilmez* — model ya da sabit düzeltilir.

### Bu işte kararlar nasıl alındı — ve neler REDDEDİLDİ

Bu bölüm "nasıl karar verdik"in asıl cevabı. Bu projede **reddedilenler de kayda geçer**,
çünkü bir sonraki deneme aynı çıtayı geçmek zorunda.

| Denendi | Sonuç | Neden |
| --- | --- | --- |
| **Gerçek hacimsel sis** — tutulan dünyaların etrafında temiz hava, gerisi yoğun bulut. Üç taslak: düz düzlem, istiflenmiş düzlemler, derinlik tamponundan ekran-uzayı geçişi. | **Reddedildi** (D124) | Üçüncüsü teknik olarak doğruydu ama sahibinin kararı net oldu: *"kimse oynamaz bunu, kötü görünüyor."* Hissiyat çıtası *eğlenceli, ütopik, epik* istiyor; karenin çoğunu kaplayan gri bulut bunların hiçbiri değil. **Güzellik bir gereklilik, bir eşitlik bozucu değil.** Kötü çizilmiş doğru bir mekanik yayına girmez. |
| **Uzaktaki aracı payload'dan tamamen düşürmek** (D123'ün ilk hâli) | **Düzeltildi** (D125) | Oyuncu "galaksi sessiz" ile "galaksi hareketli ama aletlerim zayıf"ı ayırt edemiyor. Merdiven ikinci ve daha sessiz bir biçimde görünmez oluyor. Artık araç siliniyor değil, **gözü bağlanıyor**. |
| **Saatli radar menzilini (`radarRange`) doğrudan yükseltmek** | **Ölçüldü ve reddedildi** (D126) | Uyarı `oneWay × min(1, menzil / mesafe)`. `docs/balance.md`'ye göre 10. en yakın dünya 510, 25. 754 birimde. 1400 menzilde bu minimum hepsi için doyuyor: **her komşuluk akını tüm uçuş süresini ele veriyor.** Ne zaman geleceğini kesin bilen savunmacı depoyu her seferinde boşaltır, akın hiç ödemez, PvP ekonomisinin dayandığı yağmalanabilir stok yok olur (D9, D13). Çözüm: **geniş menzil gerçek ama saat taşımıyor.** |
| **`?` işaretini sprite ile çizmek** | Değiştirildi | Proje bilerek sprite kullanmıyor (`docs/visual-design.md`). `Billboard` + düzlem mesh'e geçildi. |
| **Ekran-uzayı efekt geçişi** (`postprocessing`) | Terk edildi | Dizi uniform'ları isimle bağlanmıyordu ve MSAA derinlik dokusunu bozuyordu. Nesne başına işleme geçildi. |
| **Gelişim bandını (±2 kademe) korumak** | **Emekli edildi** (D127) | Bandın tek meşruiyeti kademenin açık olmasıydı — *"saldırıdan önce görülebilir"*. Gelişim gizlenince band, filo hazırlandıktan sonra gelen görünmez bir ret olurdu; D49'un `rankFloor` yerine bandı koymasının gerekçesi tam olarak buydu. |

---

## 4 · Ne yapmaya karar verdik — beş karar

- **D123 — Sensör ufku.** Üç değişiklik, her biri var olan bir alete ürününü geri veriyor:
  1. **Kompozisyon açık veriden çıktı.** `Contact.fleet` silindi; yerine `mass` —
     `LIGHT / MEDIUM / HEAVY`, `fleetValue`'dan kovalanmış bir siluet. Disk hâlâ
     "büyük bir şey geçiyor" der, içinde ne olduğunu söylemez.
  2. **Transitteki araç bir izleyici ister.** `fleet` ve `probe` temasları yalnızca
     çağıranın sensör menzilindeyse yayınlanır. **Trafik görüşü Teleskop'undur**; Radar
     bir tehdit çemberi olarak kalır. İkisi de aynı ürünü satarsa ikisi de okunmaz olur.
  3. **Kalkış kamusal bir olgu değil.** Bir araç, bacağının başladığı noktadan
     `SENSOR.departureShroud` kadar uzaklaşana dek hiç kimseye yayınlanmaz.
     *"Filoları evde mi"* oyundaki en değerli bilgidir ve o Teleskop'un ürünüdür;
     doğru anda açık olmanın ödülü değil.

  **Karşılığında Radar merdiveni ürününe kavuştu:** L4 boyut tahminini, L5 kadroyu ve
  geldiği dünyayı satar — ama **açık diskte değil, `pendingThreads` üzerinde**, yani
  *atfedilmiş* payload'da. Bir kadro, sana geldiğini bildiğinde karardır; diskte gezen bir
  benek olduğunda merak.

- **D124 — İlke:** *oyuncunun göremediği kural, kural değildir.* D123 sunucuda doğruydu ve
  ekranda hiçbir şey söylemiyordu.

- **D125 — Uzaktaki araç silinmiyor, gözü bağlanıyor** (`kind: 'unknown'`). Boş galaksi ile
  kör galaksi aynı görünemez. `/api/galaxy` artık çağıranın **kendi** sensör noktalarını da
  yayınlıyor: istemci sınırı çizebilsin ve bir temasın sınırı geçeceği anı kapalı formda
  çözüp tam o saniyede yeniden sorabilsin diye. Sunucu bir bayt kimliği erken göndermiyor.

- **D126 — Radar iki daire çiziyor.** Geniş olan *"bir şey geliyor"* der ve **saat taşımaz**;
  dar olan saatli uyarıyı verir. Ayrıca `SENSOR.maxRadius` geldi: `telescopeRange` L5'te
  `Infinity` ve bu **izleme** için doğru (yuva ve yeniden yöneltme bekleme süresi onu
  sınırlar), **menzil** için yanlış — hiçbir şey menzili sınırlamıyordu ve tek maksimum
  Teleskop bir sezonluk sisi siliyordu. Gerçek bir hesapta ölçüldü.

- **D127 — Harita kazanılıyor.** Bir dünya hakkında **konumu dışında hiçbir şey açık değil.**
  Ne ismi, ne gelişimi, ne donanımı, ne kubbesi. Gelişim kademesi bandı da emekli edildi.

### Sayılar

Gözden geçiren bu tabloyla kodu karşılaştırabilir. Hepsi `packages/rules/src/constants.ts`.

| Sabit | Değer | Ne demek |
| --- | --- | --- |
| `SENSOR.baseRadius` | `500` | Çıplak göz komşuluğu. **PROVISIONAL** — playtest'le oturur. |
| `SENSOR.maxRadius` | `1800` | Teleskop tavanı. Küre bundan geniş: sis asla tamamen kalkmaz. |
| `SENSOR.departureShroud` | `225` | Kalkış perdesi. `GALAXY.minSeparation` ile **eşit**. |
| `SENSOR.shroudMaxShare` | `0.35` | Perdenin bacağa oranı tavanı. Bu olmadan en yakın iki dünya birbirine tüm akın boyunca görünmez olurdu — perde değil, kör nokta. |
| `SENSOR.massMedium` / `massHeavy` | `8.000` / `40.000` | `fleetValue` eşikleri. Altı LIGHT. |
| `INTEL.telescopeRange` | `[0, 500, 725, 1025, 1525, ∞]` | İzleme menzili. `maxRadius` ile kırpılır. |
| `INTEL.radarRange` | `[0, 0, 0, 190, 360, 570]` | **Saatli** uyarı. Dokunulmadı. |
| `INTEL.radarContactRange` | `[0, 0, 0, 1100, 1500, 1900]` | **Saatsiz** niyet küresi. Her kademede saatli olandan geniş olmak zorunda. |

---

## 5 · Bir dünyanın üç hâli

Her dünya, her istekte tam olarak bu üçünden birinde. Gözden geçirmenin yarısı bu ayrımın
her katmanda aynı kalıp kalmadığını kontrol etmek.

### `RESOLVED`

Bir Teleskop menzilinin içinde. D127'den önceki galaksinin aynısı.

- Canlı, renkli, animasyonlu
- İsim, sahip, Core seviyesi, uydular, kubbe
- Dyson halkaları döner

### `REMEMBERED`

Bir sonda gitti. Dünya **karanlık kalır** — sis kalkmaz; sondanın gördükleri `seenAt`
anında **dondurulmuştur**.

- Renksiz ve hareketsiz çizilir: dönen bir halka "şu anda" hakkında bir iddiadır ve bir
  kayıt o iddiayı yapamaz
- Hedef büyüdükçe kayıt yanlışlaşır — **bu özellik, bug değil.** Eski bir kayıt kendi
  kendine değerini kaybeder; bu, bir son kullanma tarihinden daha iyi bir frendir, çünkü
  tam olarak bakmayı bırakan komutanı cezalandırır
- Etikette kaydın yaşı yazar

### `UNKNOWN`

Bakılmamış. Payload'da **id, konum ve iki kamusal an** dışında alan _yok_ — null değil, yok.

- Küçük, sönük, **hepsi birbirinin aynı.** Yalan olmamasını sağlayan şey bu: Core 18 bir
  kale ile boş bir kaya aynı işaret. İşaret *"bakmadım"* demek, *"burası küçük"* değil
- Pin yok, isim yok, halka yok, uydu yok, kubbe yok
- Kapalı göz ikonu var

### Bunu bilerek delen iki şey

**Kurtarma/işgal koruması** ve **açık bir hak penceresi** bilinmeyen bir dünyada da görünür.
İkisi de D52'nin *"sis karar öncesi bilgiyi gizler, canlı kamusal anı asla"* kuralına giriyor:
bir Ölüm Yıldızı çarpması tüm galaksiye anında yayınlanır ve krater o olayın hâlâ yanmasıdır;
hak yarışını yalnızca zaten sonda atmışların görmesi ise yarış olmaz (D112).

Pencere **yalnızca açıkken** ve **yalnızca saati** gönderilir — `tier` göndermek gelişimi
sızdırmak olurdu.

---

## 6 · Review haritası

Katman sırasıyla okumak en verimlisi: kural saf, sunucu onu uygular, istemci sonucu çizer.

### `packages/rules` — saf: bağımlılık, saat, I/O, ortam rastgeleliği yok

| Yer | Bakılacak |
| --- | --- |
| `src/intel.ts:255` `radarSensesIntent` | **Seviye değil, menzil ve mesafe alır.** Bu imza kasıtlı: tek çağıran hesaplanmış menzili elinde tutuyor, eski imza yüzünden kuralı kendi içinde yeniden yazmıştı. Kuralın tek tanımı burada olmalı. |
| `src/intel.ts` `sensorReach` · `withinTelescopeRange` | `maxRadius` yalnızca **tavan**, taban değil. İkisini birbirine bağlamak her düşük Teleskop'a bedava menzil verir — bir kez oldu, `economy.test.ts` yakaladı. |
| `src/intel.ts` `clearedDeparture` | Perde **bacağın çizilen başlangıcına** göre ölçülür, sahipliğe göre değil — dönüş bacağı, yağmaladığı dünyadan ayrılırken de perdelidir. `shroudMaxShare` tavanı olmadan kör nokta olur. |
| `src/intel.ts` `massClass` | `fleetValue` üzerinden, gemi **sayısı** üzerinden değil: altı Bulwark'ı altı Wasp'tan hafif okumak saçma olurdu. Bir sonda ve boş bir dönüş bacağı ikisi de LIGHT çıkar; yabancı bunları ayıramamalı. |
| `src/loot.ts` `AttackRefusal` | Artık yalnız `BASH_LIMIT \| SELF`. Gelişim bandı gitti; anti-farming'in tamamı `ABUSE.bashLimit`. |

### `apps/server` — sis burada zorlanır

| Yer | Bakılacak |
| --- | --- |
| `src/routes/galaxy.ts` üç durumlu redaksiyon | **Sis ihmalle uygulanır.** UNKNOWN dalı tam olarak altı anahtar döndürmeli: `id, intel, isOwned, isSelf, position, state`. REMEMBERED dalındaki her değer `record.silhouette`'ten gelmeli, `world`'den değil — tek istisna, üretimde sabitlenen ve hiç değişmeyen `name`. **Klan arkadaşları RESOLVED değildir** (D114 paylaşılan radarı açıkça dışlar). |
| `src/services/traffic.ts` perde + ufuk | İki ayrı kapı: **perde** aracın kalktığı yerden uzaklaşıp uzaklaşmadığını sorar ve **mutlaktır**; **ufuk** görecek biri var mı diye sorar ve artık silmez, gözü bağlar. |
| `src/services/traffic.ts:647` `aimedAtMe` | Yarıçap, geminin **şu anki** konumuyla ölçülür. Burada `mission.distance` görürseniz hata geri gelmiş demektir. |
| `src/services/session.ts` `pendingThreads` | Radar merdiveninin satıldığı yer: L4 `mass`, L5 `fleet` + `originName`. **Savunmacının o anki radar seviyesinden** okunur, kalkışta alınmış bir anlık görüntüden değil — uçuş sırasında radar yükselten savunmacı tam olarak bunu satın almıştır. |
| `src/services/projections.ts:188` `clear()` | Altı önbelleğin hepsini temizler; `remembered` listede olmalı. |
| `src/services/projections.ts:204` `onEvent` | `probe_report` o oyuncunun sonda kaydını, `build_complete` ise sensör kaydını düşürür. `shard:impact`, hedef kimliği taşımadığı için küçük sensör önbelleğinin tamamını temizler; düşen Merkez seviyesi eski geniş görüşü açık bırakamaz. |
| `src/services/publicGalaxy.ts` `silhouetteOf` | Sonda kaydı ile canlı okuma **aynı projeksiyondan** türer. İkinci bir sorgu olsaydı ikisi ilk düzenlemede birbirinden ayrılırdı. |
| `src/routes/preview.ts:112` | **Kimlik doğrulaması yok.** Ziyaretçiye önerilen koltuğun çıplak göz komşuluğu dışındaki her dünya UNKNOWN olmalı. Canlı sezonun tek kamusal okuması burası; tam payload dönerse D127 ikinci bir sekmeyle tamamen delinir. |

### `apps/web` — yalan söylememesi gereken yer

| Yer | Bakılacak |
| --- | --- |
| `src/api/schemas.ts` `.default()`'lar | **EN KRİTİK OKUMA NOKTASI.** Şema, sunucunun bilerek göndermediği alanları varsayılanla doldurur: `name: ''`, `owner: ''`, `coreTier: 1`, `coreLevel: 0`, `satellites: []`. Bunlar **ölçüm değil, boşluk**. Bu değerleri bir ekrana basan her kod yalan söylüyordur. Bulunan istemci kusurlarının çoğu tam olarak buydu. |
| `src/lib/dossier.ts:194` | Her satır `source` ve `ageMinutes` taşır. UNKNOWN'da sahip/gelişim/donanım **hiç basılmaz** (bir sondanın kapattığı boşluğa dönüşür); REMEMBERED'da `source: 'probe'` ve yaşıyla basılır. `accuracy` bilerek yok — sonda stok ve savunmayı banda çevirir ama dünyanın **dışını** olduğu gibi kaydeder; oraya bir güven değeri eklemek olmayan bir şüphe uydurmak olurdu. |
| `src/galaxy/scene.ts:198` `PlanetNode.kind` | Artık opsiyonel. Eskiden `'CAPITAL'` varsayıyordu ve diskin onda dokuzu başkent iddiasındaydı. Derleyicinin soruyu her okuyucuya sorması bilinçli. |
| `src/galaxy/FocusPanel.tsx:379, 455` | `claimUntil` artık `kind`'a bakmıyor (bilinmeyen dünyada o alan yok). `unsurveyed` bayrağı başlığı, Rival kontrolünü ve strateji rehberini kapatır — ama **saldırıyı kapatmaz**: körlemesine dalmak D127'nin yarattığı seçim. |
| `src/galaxy/GalaxyCanvas.tsx:730` | Etiket konteynerine giren tek korumasız yol **seçimdir**. UNKNOWN kontrolü **isim, sahip ve tür satırlarından önce** gelmeli. |
| `src/galaxy/Fleets.tsx` `SILHOUETTE` | Yabancı filo artık kadrosundan değil, `mass`'ından çizilir: 3 / 8 / 16 işaretçi. **Pip kapalı** — bir pip gerçek gemi sayar ve tahmin üstüne pip basmak payload'da olmayan bir hassasiyet uydurmaktır. |
| `src/galaxy/crossing.ts` | Sınır geçiş anının kapalı formda çözümü. Örnekleme döngüsü değil: daha kısa, kesin ve ayarlanacak bir çözünürlüğü yok. |
| `src/i18n/locales/{en,tr}` | Kullanıcıya görünen hiçbir metin bileşende yaşamaz. İki dil de **eş anahtar** taşımak zorunda; `i18n.test.ts` bunu zorluyor. Türkçe'yi Türkçe yazın — birebir çeviri değil, doğal karşılık. |

---

## 7 · Bulunan ve kapatılan kusurlar

11 grup, 23 ayrı düzeltme. Hepsi önce doğrulandı, sonra düzeltildi ve her biri için
regresyon testi yazıldı.

| Ciddiyet | Nerede | Neydi |
| --- | --- | --- |
| **Kritik** | `docs/decisions.md` | **D1–D90 silinmişti** (2.865 → 572 satır). CLAUDE.md'nin atıf yaptığı 90 karar yoktu. HEAD'den geri getirildi; envanter karşılaştırıldı: 137 karar, kayıp yok, tekrar yok. |
| **Kritik** | `routes/preview.ts` | Kimliksiz istek canlı sezonun tüm sahiplerini, Core seviyelerini, uydularını, kalkanlarını döndürüyordu. D127 tamamen delinebiliyordu. |
| **Kritik** | `services/traffic.ts` | `inbound` yarıçap yerine **bacak uzunluğunu** ölçüyordu. Komşunun akını kalkıştan itibaren işaretleniyor (D9 yasağı), uzaktan gelen akın çarpma anında bile işaretlenmiyordu. |
| **Ciddi** | `lib/dossier.ts` | Bilinmeyen dünya için **"Gelişim: 1. kademe"** ve boş sahip, *public/canlı* damgasıyla basılıyordu. Core 18 kalesi, 1. kademe kaya olarak okunuyordu. REMEMBERED'da da yaş yoktu. |
| **Ciddi** | `galaxy/scene.ts` | `kind` varsayılanı `'CAPITAL'`'dı; diskin onda dokuzu başkent iddiasındaydı ve etiket bunu başkent mavisiyle basıyordu. |
| **Ciddi** | `FocusPanel` · `GalaxyCanvas` | Bilinmeyen dünyaya dokununca boş isim, boş komutan ve **"Tarafsız"** basılıyordu; Rival butonu çıkıyordu (retikülün asla çizilmeyeceği yerde); strateji rehberi "ikinci vuruş ele geçirir" sözü veriyordu — oysa dünya bir **başkent** olabilir ve başkentler ele geçirilemez. |
| **Ciddi** | `FocusPanel` · hak penceresi | Sunucu canlı hak penceresini sisin ardından bilerek yayınlıyordu; panel `kind === 'NEUTRAL'` diye kapıyordu. Disk "Hak açık" halkasını çiziyor, girmenin yolu yoktu. |
| **Ciddi** | `services/projections.ts` | `clear()` `remembered`'ı atlıyordu (kendi sözleşmesini ihlal); sonda raporu indiğinde önbellek düşmüyordu — bildirim "hazır" derken disk 30 sn daha işaretsiz nokta çiziyordu. |
| **Ciddi** | `screens/LaunchSheet.tsx` | Oyunun tek geri dönüşsüz ekranı bilinmeyen hedefte **boş başlıkla** açılıyordu. Sevk toast'ları da boş isim basıyordu. |
| Küçük | `GalaxyView` · `queries.ts` | Kararsız `sensors` prop'u (saniyede bir yeni dizi); radar halkalarının üç float `===` ile eşleşmesi (sessizce kaybolabilirdi); kimliği değişemeyecek temaslar için gereksiz crossing çözümü. |
| Küçük | `rules` · `docs` | `radarSensesIntent` ölü koddu ve kural elle tekrar yazılmıştı; D125/D126 hiç yazılmamıştı; D14/D15/D49 artık çelişiyordu; var olmayan bir `EyeGlyph`'e işaret eden docblock dahil 5 eskimiş yorum. |

---

## 8 · QA senaryoları

**Telefonda yapın.** Bu oyun ayakta, tek elle, dört dakikada oynanıyor; masaüstü tarayıcı
farklı bir ürün. Vite `Network:` adresini yazdırır.

```bash
docker compose up -d
pnpm season migrate                    # 0035 + 0036 gerekli
pnpm season bootstrap --unattended 8   # SADECE DEV: keşfedilecek komşu
pnpm dev
```

### 1. Yeni hesap, ilk açılış

Sıfır Teleskop, sıfır Radar. Galaksiye bak ve uzaklaş.

- **Beklenen:** Kendi dünyan ve yakın komşuluk canlı ve renkli; gerisi küçük, sönük,
  birbirinin aynı noktalar. Her dünyanın üstünde göz ikonu: görülenlerde açık,
  görülmeyenlerde kapalı. Pin yalnızca görülen yabancı dünyalarda.
- **Başarısız sayılır:** Disk tamamen boş hissettiriyorsa. `SENSOR.baseRadius` (500) tek
  ayar düğmesi ve **bunu hiçbir test göremez** — asıl aranan şey bu.

### 2. Bilinmeyen bir dünyaya dokun

Uzaktaki sönük noktalardan birini seç, sonra paneli aç.

- **Beklenen:** Etiket tek satır: *Keşfedilmemiş*. Panel başlığı *Buraya kimse bakmadı*.
  Rival butonu **yok**, strateji rehberi **yok**, "Tarafsız" yazısı **yok**, hiçbir yerde
  boş isim/komutan satırı yok. Saldır butonu **var**.
- **Dosyada:** "Gelişim: 1. kademe" satırı görmemelisin; yerine bir sondanın kapattığı
  boşluk olmalı.

### 3. Sonda gönder, dönmesini bekle

Aynı dünyaya sonda at. Sonda hedefe varınca *değil*, eve dönünce oku — istihbaratın gidiş
dönüş olması, keşfi bir satın alma değil bir taahhüt yapan şeydir.

- **Beklenen:** Dünya karanlık kalır ama isim, sahip, Core halkaları, uydular ve kubbe
  belirir. Halkalar **dönmez**, uydular **durur**, renk yoktur. Etiketin altında kaydın
  yaşı yazar. Dosyada bu satırlar artık *sonda* kaynaklı ve yaşlı.
- **Zamanlama:** Bildirim geldiği anda diskin de güncellenmesi gerekir. 30 saniye gecikirse
  önbellek invalidasyonu bozulmuş demektir.

### 4. Kayıt eskisin

Sonda attığın dünya bir uydu daha kursun ya da Core yükseltsin (ikinci hesap).

- **Beklenen:** Gözlemci **eski hâli görmeye devam eder.** Bu bug değil, D127'nin özelliği.
  Yeni sonda atınca güncellenir; eski rapor Intel merkezinde durmaya devam eder — orası bir
  tarihtir, bir render'a hizmet etsin diye silinmez.

### 5. Kalkış perdesi

İkinci hesabın dünyasını izlerken oradan bir filo kaldır (ya da kendi dünyandan kaldırıp
üçüncü bir hesapla izle).

- **Beklenen:** Filo, dünyanın üstündeyken **hiç kimseye görünmez** — Teleskop menzilinin
  tam içinde duran biri için bile. Ancak 225 birim uzaklaşınca temas olarak belirir.
- **Kısa bacak:** Birbirine çok yakın iki dünya arasındaki akında perde **tüm bacağı
  yutmamalı** (`shroudMaxShare` = 0.35). Yutuyorsa bu perde değil, kör noktadır.
- **Dönüş bacağı:** Yağmadan dönen filo da, ayrıldığı dünyanın üstündeyken perdeli olmalı.

### 6. Teleskop yükselt

Uplink kur, Teleskop'u kademe kademe çıkar. Her kademede diske bak.

- **Beklenen:** Görüş halkası genişler, daha çok dünya canlanır, daha çok temas kimlik
  kazanır. En üst kademede bile **ufuk kalkmaz** — `SENSOR.maxRadius` 1800 ve küre bundan
  geniş.
- **Uplink olmadan:** Teleskop yörüngede olsa bile seviye 0 sayılır ve yalnızca çıplak göz
  tabanı kalır (D25). Bu doğru davranış.

### 7. İki radar dairesi

Radar L3+ kur. İkinci hesaptan uzaktan (2000+ birim) akın gönder.

- **Beklenen:** Akın *yaklaşana kadar* hiçbir şey demez. Geniş alana (1100) girince
  "bir şey geliyor" der — **saat, yön, boyut ve kadro olmadan.** Dar daireye (190) girince
  saatli uyarı gelir.
- **Başarısız sayılır:** Kalkış anında uyarı geliyorsa (D9 ihlali) veya yakın akında hiç
  uyarı gelmiyorsa. Ya da geniş daire bir varış saati taşıyorsa.
- **Sana ait olmayan akın:** Yanından geçip başkasına giden bir akın **asla** "geliyor"
  işaretlenmemeli — yoksa çember bir yakınlık alarmına döner.

### 8. Radar merdiveni — L4 ve L5

Radar'ı L4'e, sonra L5'e çıkar ve her seferinde sana gelen bir akını bekleyen işler
şeridinde (`PendingStrip`) oku.

- **L3'te:** Yalnız "gelen filo" ve saati.
- **L4'te:** Ek olarak **boyut bandı** (hafif/orta/ağır). Harcamak, filoyu dışarı çıkarmak
  ya da beklemek — D9'un yaratmak istediği üç gerçek seçenek bu satırla verilir.
- **L5'te:** **Kadro** (gövde ve sayı) ve **geldiği dünyanın adı**. Bir uyarıyı kine
  çeviren şey dünyayı isimlendirmektir.
- **Kritik:** Bunlar **açık diskte görünmemeli.** Bir yabancı filoya diskten dokunduğunda
  hâlâ yalnız tahmini boyut olmalı. Kadro yalnızca sana gelen akında, yalnızca L5'te.
- **Yükseltme sırasında:** Filo havadayken radar yükseltirsen bir sonraki okumada yeni
  ürünü almalısın. Kalkış anındaki seviye dondurulmuş olmamalı.

### 9. Yabancı filo silueti

Görüş alanının içinden geçen bir yabancı filoya dokun.

- **Beklenen:** Panel **tahmini boyut** der, gövde listesi vermez, "Araç" sayısı
  *bilinmiyor* der. İşaretçi sayısı siluetten gelir (3/8/16); **pip yoktur.**
- **Görüş dışında:** Renksiz çelik bir temas, soru işaretiyle, hiçbir kimlik olmadan.
  Sınırı geçtiği anda kimlik kazanmalı — patlayarak değil, tam o saniyede.

### 10. Kamusal anlar sisin ardından

- **Hak yarışı:** Bir tarafsız dünyada hak penceresi açılsın (kesin bir akından sonra) ve
  o dünya senin görüş alanının dışında olsun. Diskte hak halkası görünmeli **ve** panelde
  Yerleşim butonu çalışmalı. Panelde kademe/tehdit/rezerv **görünmemeli** — yalnız saat.
- **Krater:** Bilinmeyen bir dünyaya Ölüm Yıldızı çarpsın; kurtarma durumu görünmeli.
- **Savaş:** Uzaktaki bir bombardıman tüm galakside görünmeye devam etmeli. Madencilik,
  enkaz ve kurtarma da açık kalır. **Sis yalnızca iki şeyi kapatır: transitteki akın ve
  transitteki sonda.**

### 11. Ziyaretçi akışı

Çıkış yap, oturum açmadan ön izlemeyi aç.

- **Beklenen:** Ziyaretçi de sisin altında. Önerilen koltuğun komşuluğu canlı, gerisi nokta.
  Payload'da uzak bir dünyanın adı **hiçbir alanda** geçmemeli.

### 12. Gerçek telefonda kara dikdörtgen avı

Android Chrome **ve** Brave. Görüş kürelerine doğru dön, uzun süre açık tut.

- **Neden:** Bu daha önce oldu: `mediump` shader + sınırsız `uTime` → NaN → additive
  blend'de siyah kareler. Masaüstü sessizce `highp`'a yükselttiği için harness asla
  yakalayamaz. Düzeltildi, ama tekrar doğrulanması **gerçek cihazda** olmak zorunda.

### 13. Kendi filon etkilenmemiş olmalı

Kendi akınını, sondanı, madencini ve nakliyeni gönder.

- **Beklenen:** Hepsi tam ayrıntısıyla, kendi payload'ından çizilir. Ufuk kendi araçlarına
  **hiç uygulanmaz** — trafik listesi zaten sahip olduklarını dışlar. Kendi filonda eksik
  bir şey görürsen bu sis değil, başka bir hatadır.

---

## 9 · Regresyon riski

- **Şema varsayılanları.** `.default()`'lar eski bir sunucuyla uyumluluk için var, ama aynı
  zamanda her boşluğu sessizce bir değere çeviriyorlar. Yeni bir alan eklerken varsayılanın
  *ekrana basılabilir* olup olmadığı sorulmalı.
- **Payload ayrıştırma tümden başarısız olur.** Bir dünyanın `neutral` bloğu eksik alanla
  gittiğinde `z.coerce.date` Invalid Date üretti ve **106 dünyanın hepsi birden** kayboldu —
  çağıranın kendi dünyası dahil. Kısmi nesne göndermek bu yüzden yasak. `contract.test.ts`
  bunu bekliyor.
- **Önbellek TTL'i 30 sn.** `sensors` ve `remembered` oyuncu anahtarlı. Enstrüman
  tamamlanması sahibine özel `build_complete` yayınlar; testte doğrudan DB'ye yazan bir kurgu bunu yayınlamaz,
  o yüzden `intel-states.test.ts` önbelleği kapalı çalışıyor. **Bu bir ürün ayarı değil,
  kurgu ayarı** — D99 açıkça diyor ki bir önbellek yalnızca hızı değiştirebilir, sonucu asla.
- **Sim yalnızca gösterge.** Botlar hâlâ async dönem `loginsPerDay` kullanıyor ve sonda
  maliyetini bir oturum sayıyorken D121 sondayı 20 saniyeye indirdi. RR ölçümü bu yüzden
  yorumlanamaz durumda; `docs/balance.md`'ye kaydedildi, ayarlanmadı. **Mevcut sim hızına
  göre denge ayarı yapmayın.**
- **Dev DB gürültüsü.** `/health` şu an `ok: false` — tek sebep `staleWorldStates: 4`, eski
  sezondan kalma süresi dolmuş işgal koruması. Bu çalışmadan gelmiyor; peşine düşmeyin.
  (`/health` zaten rapor eder, asla onarmaz — kanıtı korumak için.)

---

## 10 · Kalan işler

### P0'dan kalan iş var mı

**Kod tarafında yok — kabul tarafında var.**

> **Not:** P0/P1 etiketleri bu oturumun çalışma planından; repoda yazılı bir öncelik
> listesi yok. Sıralamanın kendisi `CLAUDE.md` § Next'ten geliyor.

P0, bilgi katmanının onarımıydı (D123–D127) ve kodu bitti, testleri yazıldı, `pnpm verify`
yeşil. İnceleme sonrasında sensör hacimleri sunucudaki üç boyutlu kuralla eşlendi; L4 uzaktaki
tehdidin yaklaşık büyüklüğünü erkenden gösterir hâle geldi; eski sonda kayıtlarının galaksi
sorgusu tek güncel işaretçiyle sınırlandı; kayıtlı uydu ve kalkanlar sönük ve hareketsiz yapıldı.
Yönü hareketten ve gelişimi duruş mesafesinden çıkarmak, ürün sahibinin kabul ettiği görsel
çıkarımlar olarak kaldı. Ama P0'ın kabul kriteri bir test değil, **iki ölçülmüş sayı**:

- keşifle başlayan saldırı **≥ %50**
- içinde bir şey uçarken biten oturum **≥ %80**

*Hiçbiri henüz ölçülmedi.* Yani P0 **code-complete ama kabul edilmemiş** durumda.

### Açık tasarım kararı: `/api/leaderboard` — ürün sahibinin kararı

D127'nin kalan en büyük deliği ve **bilerek düzeltilmedi.** Sıralama tablosu her komutanın
başkentinin `planetId`, `planetName` ve `coreTier`'ını döndürüyor; satıra dokununca kamera
oraya uçuyor. *"Nerede yaşıyorlar"* ve *"ne kadar gelişmişler"* — D127'nin gidip bulmanı
istediği iki soru — 300 başkent için bedava.

Dar çözüm: `coreTier`'ı ve dünya kimliğini düşürüp rütbe, komutan, skor ve klanı bırakmak.
CLAUDE.md'nin ilk değişmezi zaten *"Score is Dominion, not net worth"* diyor.
**Bedeli:** odak sıçraması, gerçek bir özellik.

Chronicle'ın `core_tier` girdisi aynı sınıfta ama daha savunulabilir — o bir *an*, sürekli
bir okuma değil. İkisi de D127'nin altına ve CLAUDE.md'ye "açık" olarak yazıldı.

### Sıradaki iş: iki günlük gerçek oyun

`docs/playtest-log.md` bunun nasıl yapılacağını yazıyor ve ilk satırı şu: **bu bir yapım
aşaması değil, sürerken hiçbir şey inşa etmeyin.** Planlı seanslar değil, gerçek boşluklar —
uyanınca, çaydanlık, yolda, öğle, koltuk, yatmadan önce. Günde 3–5 kez, 4–6 dakika.

Özellikle aranacak şey: **uzakta boş hissettiren bir disk.** `SENSOR.baseRadius` tek düğme
ve hiçbir test onu göremez.

### Sonra

| Öncelik | İş |
| --- | --- |
| — | Simülatörü gerçek zamana göre yeniden türet. Mevcut kapılar yalnızca gösterge; sonda maliyeti, oturum modeli ve `loginsPerDay` D63/D121 sonrası dünyayı temsil etmiyor. |
| P1 | **Aşama B / yakıt.** Bu oturumda hiç dokunulmadı. |
| P2 | **Aşama B / hasar tipleri × savunma profilleri**, batarya yuvaları, sonda tip dökümü, Aegis'in bir katman hâline gelmesi. |
| P3 | **Aşama B / doktrinler.** |
| P4 | **Aşama B / dengenin yeniden türetilmesi.** |

Playtest kapısı geçilmeden Aşama B'den hiçbirinin inmemesi gerekiyor.

### Devralınan açık maddeler

Bu çalışmadan gelmiyor, ama devir teslimin parçası:

- `request_log` var ama kalkış/sipariş idempotency'si bağlı değil.
- SQL `build_orders_slot_check`'i sabit yazıyor; kuyruk derinliği değişirse migration gerek.
- Ele geçirilen kolonilerin eski sahibin uçuştaki inşa siparişlerini koruması makul ama
  test edilmemiş.
- Sezon sonu olayı (`season_end`) var, işleyicisi yok.
- Sabitler `PROVISIONAL`: kasa tabanı, kesinti süresi, kalkan eğrisi, sezon uzunluğu,
  asteroit parametreleri — ve artık `SENSOR.baseRadius`. Hepsi playtest'le oturur.

---

## 11 · Gözden geçirene notlar

- **Hiçbir şey commit edilmedi.** Çalışma ağacında duruyor. İki migration (`0035` siluet
  sütunu — `probe_reports.silhouette jsonb`; `0036` hafıza indeksi —
  `(observer_player_id, delivered_at)`) dev veritabanına uygulandı; yeni bir ortamda
  `pnpm season migrate` şart. **Migration'lar yeni imaj servis edilmeden önce çalışır.**
  Sunucu şemadan geriyse başlatmayı **reddeder** — bu doğru davranış, arıza değil.
- **Testleri okuyun, sadece koştutmayın.** Yeni takımlar: `sensor-horizon` (20),
  `intel-states` (21), `intel-render` (11), `crossing` (9), artı `focus-actions` ve
  `intel-surface` içinde birer blok. Her testin docblock'u *hangi hatanın* onu doğurduğunu
  yazıyor; kuralın gerekçesi orada, testin adında değil.
- **Bir dosyayı düzenlemeden önce docblock'unu okuyun.** 3B dosyalar ve test koşumları
  yerel tuzaklarını belgeliyor. Bu proje bunu bir kural olarak yazıyor.
- **Bir kaynak testi var ve bilinçli.** `intel-render` içindeki etiket testi
  `GalaxyCanvas.tsx`'i metin olarak okur. Sebep: o kural WebGL bağlamı olmadan mount
  edilemeyen bir R3F alt ağacında yaşıyor ve alternatif hiç kontrol etmemek. Dar tutuldu —
  koruma var mı ve önce mi geliyor.
- **Kabul edilen bir sızıntı var, gizlenmedi.** Kimliksiz bir temas *hızını* açık eder:
  pencere iki nokta ve iki andır, sonda filodan 36× hızlıdır. Düzeltilemez — hareketi
  çizmek hızı çizmektir; alternatifler yanlış konum yayınlamak (sis yalan söylemez) ya da
  aracı hiç çizmemek (D125'in reddettiği ölü disk). Ama iddia edilmemesi gerekiyordu;
  docblock artık doğruyu yazıyor.
- **Dev döngüsü tuzakları.** `packages/rules` değişince *iki* dev sunucusunu da yeniden
  başlatın (API galaksiyi önbelleğe alıyor, Vite bağlı paketi izlemiyor). Tailwind v4
  `--color-alloy` yayınlar, `--alloy` değil. `apps/web`'e bağımlılık eklerseniz Vite'ı
  yeniden başlatın, yoksa 504 döner.
- **Türkçe etiketleri asla case-fold etmeyin** — `İ`.toLowerCase() bileşik nokta içerir.

---

## Nereye bakılır

| Dosya | Ne zaman okunur |
| --- | --- |
| `CLAUDE.md` | Her oturumun başında. Değişmezler tablosu bu işin sözleşmesi. |
| `docs/decisions.md` | Yerleşmiş bir davranışı tekrar açmadan önce. D123–D127 bu iş. |
| `docs/game-design.md` | Sistem davranışını değiştirmeden önce. |
| `docs/balance.md` | Sayı değiştirmeden önce. "What the simulator cannot currently answer about D127" bölümü bu işe ait. |
| `docs/architecture.md` | Sunucu kodu yazmadan önce. |
| `docs/interface.md` | Ekran değiştirmeden önce. |
| `docs/visual-design.md` | Görsel iş yapmadan önce. |
| `docs/playtest-log.md` | Gerçek playtest'ten önce. Sıradaki iş bu. |
| `docs/glossary.md` | Bir oyun terimini bilmiyorsanız. |
