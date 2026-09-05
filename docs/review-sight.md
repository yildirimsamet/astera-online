# Görüş Katmanı — bulgu, onarım ve inceleme devir teslimi

> **Kapsam:** Telescope · Radar · Sonda üçlüsünün backend, frontend ve canlı kanal
> (SSE) tarafının uçtan uca denetimi; ardından yapılan onarım.
>
> **Kime:** İşi görmemiş bir gözden geçirene. Bölüm 1 durum tablosu, 2–4 bulgular,
> 5 açık kalanlar, 6–8 nereye nasıl bakılacağı.
>
> **Geçici doküman.** Review bittiğinde silinir. Kalıcı gerçek `CLAUDE.md`
> değişmezler tablosu ve `docs/decisions.md`'dir. **Uyuşmazlıkta doküman kodun
> üstündedir** — koda bakıp "demek ki böyleymiş" demeyin.
>
> **Konumlar satır numarasıyla değil sembol adıyla verilir.** Bu dokümanın ilk
> hâlinde yedi satır numarasından dördü, o dosyalar sonradan düzenlendiği için
> yanlış yeri gösteriyordu. Bir devir teslim dokümanında bayat satır numarası
> yardımcı değil, yanıltıcıdır.

---

## 1 · Durum

|                      |                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Tip kontrolü         | rules · server · web → **0 hata**                                                             |
| Lint                 | dokunulan her yer → **0 hata**                                                                |
| `@astera/rules`      | **499 / 499** ✅                                                                              |
| `@astera/web`        | **1602 / 1602** ✅                                                                            |
| `@astera/server`     | 993 test · **992 / 993**; tek hata sensör dışı, bilinen `debris.test.ts` zaman varsayımı (§5.3) |
| `@astera/sim`        | 59 / 67 — **önceden var olan sezon kapısı**, `CLAUDE.md`'de kayıtlı                           |
| Yeni kaynak          | `packages/rules/src/sight.ts` (145) · `apps/web/src/galaxy/crossing.ts` yeniden yazıldı (118) |
| Yeni test dosyası    | `probe-readings.test.ts` — 14 test · `intel-refresh.test.tsx` — 1 test                        |
| Yeniden yazılan süit | `sensor-horizon` (27) · `crossing` (13) · rules `intel`                                       |
| Taban                | oturum öncesi tam süit ölçülmedi; **delta iddia edilmiyor**                                   |
| Commit               | 0 — her şey çalışma ağacında                                                                  |

**Üçüncü inceleme sonucu (2026-08-29):** önceki “açık” beş maddenin dördü doğrulandı ve
kapatıldı. ⑬ iki ayrı kavramı karıştırıyordu: eski klan rengi gerçek kusurdu ve
kapatıldı; eski rakip kimliği ise D127'nin donmuş hafıza kuralına uygun. Ayrıca
0043 migration'ında üretim kuralından kopmuş iki eski menzil bulundu ve düzeltildi.
Radar'ın birleşik çemberine rağmen eski iki-çember davranışını satan kullanıcı
metinleri de bulundu ve iki dilde hizalandı.

---

## 2 · Bu oturumda bulunan kusurlar

**Numaralar bu dokümanın kendi numaralarıdır**, ilk sohbet raporundakilerle aynı
değil: "menzilde doğan araç" orada ①'di, burada kökeni ayrı bir mimari kusur olduğu
için ⓪'a alındı; ①–⑧ bir kaydı; 10 raporluk sınır orada ⑬ iken burada ⑨. Eski
numaraya göre arıyorsanız kusurun **adına** bakın.

| #   | Kusur                                                                                                                                          | Ağırlık   | Durum                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------- |
| ⓪   | **Menzil içinde doğan araç görünmüyor** — kalkış perdesi + istemcinin "artık görünür oldu" anını hiç sormaması                                 | 🔴 kritik | ✅ kapandı              |
| ①   | Her sonda hedefini (dönüşte sondacının evini) yayınlıyor                                                                                       | 🔴 kritik | ✅ kapandı              |
| ②   | `doctrines` + `interceptor` sunucudan hiç çıkmıyor                                                                                             | 🔴 kritik | ✅ kapandı              |
| ③   | `deathStar` + `deuteriumStock` payload'da var, çizilmiyor                                                                                      | 🟠        | ✅ kapandı              |
| ④   | Tarama bildirimi bearing'i her Radar seviyesine sızdırıyor                                                                                     | 🟠        | ✅ kapandı              |
| ⑤   | Zamanlı Radar çemberi hiçbir yerde çizilmiyor                                                                                                  | 🟠        | ⚠️ konusuz kaldı (§5.1) |
| ⑥   | Gelen saldırı hangi dünyaya geliyor, söylenmiyor                                                                                               | 🟠        | ✅ kapandı              |
| ⑦   | Koloninin radar kaydı hiçbir yerde okunmuyor                                                                                                   | 🟠        | ✅ kapandı              |
| ⑧   | Teleskop rafı başka dünyanın izlemesini gizliyor ("3 / 1 yuva")                                                                                | 🟠        | ✅ kapandı              |
| ⑨   | 10 rapordan eskisi için panel "hiç sonda göndermedin" diyor                                                                                    | 🟡        | ✅ kapandı              |
| ⑩   | Aynı hedefe birden fazla teleskop yuvası → belirsizlik zarı yeniden atılıyor                                                                   | 🟡        | ✅ kapandı              |
| ⑪   | `shard:launch`/`arrival` galaksiyi tazelemiyor; ama `fleet` alanını tam olarak bunlar değiştiriyor                                             | 🟡        | ✅ kapandı              |
| ⑫   | Intel ekranı açık kalırsa donuyor, yine de "canlı" yazıyor                                                                                     | 🟡        | ✅ kapandı              |
| ⑬   | Donmuş klan/rakip bilgisi yanlış renk ve retikül gösteriyor                                                                                    | 🟡        | ◐ ayrıştırıldı (§5.2)   |
| ⑭   | `pendingThreads` ile radar uyarısı arasında `LEAD_TOLERANCE` farkı                                                                             | ⚪        | ✅ kapandı              |
| ⑮   | Radar tanıtım metni yalan söylüyordu: _"sondalar görülmeden gelip gider"_ — oysa radarı hiç olmayan dünya da ~%15'ini yakalar ve bildirim alır | 🟡        | ✅ kapandı              |
| ⑯   | Sensor epoch backfill migration'ı eski Telescope 4/5 menzillerini yazıyor                                                                      | 🟠        | ✅ kapandı              |
| ⑰   | Radar kartları birleşik çemberde hâlâ “genişte saatsiz, darda saatli” diyor                                                                    | 🟡        | ✅ kapandı              |
| ⑱   | `sensorSphere` tek-kapı değişmezi çalışma zamanı ve preview'da delinmiş                                                                        | 🟡        | ✅ kapandı              |
| ⑲   | **Sunucu süiti tam koşuda kararsız** — sekiz rastgele UUID sonucundan istatistik başarı bekleyen test                                                | 🟠        | ✅ kapandı (§10)        |

**Yanlış alarm çıkanlar** (kontrol edildi, sorun yok — tekrar bakılmasın):
koordinat sistemi karışıklığı şüphesi · izlenen dünyanın "çözümlenmiş" olmaması ·
radar çemberlerinin iç içeliği · gelen saldırı panelinin düşman filosunu kendi
filon gibi göstermesi · yabancı filoların gemi sayısının sızması · rota çizgisinin
yanlış yerde çıkması.

---

## 3 · Kapatılanlar — ne yapıldı, neden

### ⓪ Görünürlük motoru yeniden kuruldu

**Kök sebep iki taneydi ve üst üste biniyorlardı.**

_Sunucu:_ Kalkış perdesi (`clearedDeparture`) bir aracı, bacağının ilk 225 biriminde
**herkesten, her cihaz seviyesinde** siliyordu. Maksimum teleskoplu bir gözlemcinin
300 birim ötesinden kalkan filo, uçuşun %35'i boyunca görünmüyordu.

_İstemci:_ Trafik listesi yalnızca üç anda soruluyordu — kalkış olayı, varış olayı,
60 sn'lik yedek. Her üçü de aracın **perdenin içinde olduğu** anlar. "Artık görünür
oldu" anını ne sunucu haber veriyordu, ne istemcinin hesaplayacak dayanağı vardı.

Ölçüm (maksimum teleskop, tüm rota menzil içinde):

```
sonda 9.2 sn/bacak — tarayıcının sorduğu anlar:
  t= 0.0s -> hiçbir şey    t= 9.2s -> hiçbir şey    t=18.5s -> hiçbir şey
  => X sondayı hiç gördü mü: HAYIR
```

**Yapılan:**

- **Yeni tek kaynak: `packages/rules/src/sight.ts`.** Üç bölge (`NONE` /
  `CONTACT` / `IDENTIFIED`) burada tanımlı. Sunucu filtresi, istemcinin geçiş
  çözücüsü ve testler aynı `sensorZone`'u okuyor.
- **`sensorSphere` tek kapı:** bir cihaz seviyesi mesafeye yalnızca burada dönüşür.
- **Kalkış perdesi kaldırıldı.** Araç bacağının ilk anından itibaren, çemberi
  kapsayan herkese görünür.
- **Kablo adları modele hizalandı:** `reach`/`sense`/`warn` → `identify`/`detect`.
  Sunucu ve istemci artık `SensorSphere` tipini paylaşıyor.
- **`crossing.ts` tek çağrıya indi:** iki çemberi birlikte çözüyor, üç bölge
  arasındaki her geçişte uyanıyor.
- **Trafik yoklaması 60 sn → 5 sn** (`TRAFFIC.refreshMs`). On iki kat daha çok
  istek, ama **istek başına** yük düştü: payload artık galaksinin tamamını değil
  yalnız çemberdekileri taşıyor, ve arkasındaki anlık görüntü shard başına bir kez
  kurulup tüm komutanlarca paylaşılıyor. **Toplam yükün düştüğü ölçülmedi** —
  300 oyunculu bir shard'da doğrulanmalı (§7.5).

**Tablolar** (sahibin kararı — teleskop tavanı 1600, radar tavanı 2200, her
seviyede radar teleskoptan geniş):

| Seviye | Teleskop           | Radar | Fark |
| ------ | ------------------ | ----- | ---- |
| 0      | 500 _(çıplak göz)_ | 0     | —    |
| 1      | 500                | 700   | +200 |
| 2      | 725                | 950   | +225 |
| 3      | 1025               | 1300  | +275 |
| 4      | 1300               | 1700  | +400 |
| 5      | 1600               | 2200  | +600 |

Radar 1 ve 2 ilk kez menzil aldı. Daha önce sıfırdılar ve yalnızca sonda yakalama
oranını oynatıyorlardı — rakip Tersane 4'e çıktığında ikisi de `detectMin` tabanına
(%5) düşüyordu, yani **radarı hiç olmayanla aynı orana**. 1.100 alaşımın karşılığı
buydu.

**Sonda yakalama:** taban `%25 → %15`, tavan `%95 → %80`, eğim `0.18 → 0.13`.
Eğimin gerekçesi matematiksel: 0.18'de `%15 + 4×%18 = %87` tavanı aşıyor ve
**Radar 5, Radar 4'ün üstüne hiçbir şey satmıyordu**. 0.13'te tavan tam merdivenin
tepesinde yakalanıyor.

**Testler:** `sensor-horizon.test.ts` "menzilde kalkan aracı ilk andan görür" ve
"sonda hem gidişte hem dönüşte görünür" · `traffic.test.ts` "bacağın ilk anından
itibaren gösterir" · `sight.ts` birim testleri.

### ① Sonda hedef ifşası

**Kök sebep telin iki yakasında iki ayrı yerde yazılmış bir gerçekti.** Yayınlanan
pencerenin tabanı sunucuda sabit 60 saniyeydi; tarif ettiği şey ise istemcinin
yoklama aralığıydı. Sondanın tüm uçuşu (3–62 sn) o tabanın içinde kaldığı için
**her sonda hedefini yayınlıyordu** — dönüş bacağında da sondacının evini, ki bu
tam olarak Radar 5'in sattığı bilgi.

Üç sabit `@astera/rules`'daki `TRAFFIC` bloğuna taşındı; taban artık yoklama
aralığının **kendisi**.

```
              önce        sonra
sonda  800u   %100        %41   (5.0 sn)
sonda 4000u   %100        %8    (5.0 sn)
filo   800u   %1.1        %1.1  (4.9 sn)
```

Sızıntı "her uçuşun tamamı"ndan **son 5 saniyeye** indi — D52'nin zaten kabul
ettiği son yaklaşma. `probe-motion.test.ts` bacağı 250 ms adımlarla yürüyor.

> **Sınır durumu:** uçuşun kendisi 5 sn'den kısaysa (225 birimlik minimum komşu
> mesafesinde 3.5 sn) tüm uçuş "son yaklaşma" sayılır ve hedef baştan görünür.
> Kabul edilen sınır — bitişik iki dünya arasındaki 3.5 saniyelik sıçramayı izleyen
> biri zaten çıkarır. Mesafe arttıkça pay hızla düşüyor (yukarıdaki tablo).

### ② + ③ Ölü veriler

Sondanın her uçuşta topladığı dört okuma hiçbir ekrana ulaşmıyordu:

| Okuma                  | Önceki hâli                                      |
| ---------------------- | ------------------------------------------------ |
| Muharebe doktrini      | `resolveProbe` yazıyor, hiçbir route göndermiyor |
| İnterceptor şarjı      | aynı                                             |
| Rampadaki Ölüm Yıldızı | payload'da var, hiçbir yüzey okumuyor            |
| Döteryum bandı         | aynı                                             |

Doktrin için `CLAUDE.md` zaten _"combat-relevant doctrine must be probe-visible
(D137)"_ diyordu. İnterceptor olmadan Ölüm Yıldızı 33.000 kaynak + bir saatlik kör
harcama; T10'un tüm tasarım gerekçesi bunun bir **istihbarat kararı** olması.

**Yapılan:** `/api/intel` ikisini de yayınlıyor; dosya (`dossier.ts`) dördünü de
yaşıyla birlikte basıyor. **Yok ≠ sıfır** ayrımı her dalda korundu: alan yoksa
"okuma hiç alınmadı", boşsa "sonda baktı ve bulamadı". Uçtan uca test var —
gerçek sonda uçuruluyor, işçi çalıştırılıyor, `/api/intel` değerleri doğrulanıyor.

### ④ Bearing sızıntısı

`scan_detected` bildirimi bearing'i **her** Radar seviyesine gönderiyordu;
`/api/notifications` payload'ı ham geçiriyor. `readRadarLog` aynı bilgiyi L2'ye
kadar doğru şekilde saklıyordu. İstemci onu çizmiyordu — yani **sis yalnızca
arayüzde uygulanıyordu**, ki `CLAUDE.md` bunu açıkça yasaklıyor.

Testle kanıtlandı: Radar 1 savunmacı, `/api/intel` `bearing: null` derken bildirim
payload'ı `{"bearing":"east"}`.

**Yapılan:** Redakte etmek yerine **kaldırıldı**. Bearing radar kaydının ürünü,
orası zaten doğru kapılı. Bir gerçek, bir yüzey, bir kapı.

### ⑥ + ⑦ + ⑧ Çoklu dünya

- **Radar kaydı komutan geneli oldu.** `/api/intel` yalnızca **başkenti** okuyordu;
  koloniye atılan taramaların `scan_events` satırı yazılıyor, hiçbir ekrana
  ulaşmıyordu. Artık her satır kendi dünyasının radarıyla kapılı ve hangi dünyaya
  geldiğini yazıyor.
- **Teleskop rafı yalnız aktif dünyanın izlemelerini çiziyor.** Yuva numarası bir
  **dünyaya** aittir, izleme listesi **komutana**. Ekran birini payda, diğerini pay
  olarak okuyordu: koloninin 1. yuvası başkentinkini gizliyor, tally "3 / 1"
  basıyor, kapsama bunu "tam" sayıyordu. Aynı karışıklık `dossier.ts`'te de vardı
  (boş yuvası olan dünyada "yuvan kalmadı" engeli).
- **Gelen saldırı hedefini söylüyor** — şeritte ve bildirimde. Radar merdiveni
  saldırganın tarafını satar; hedef okuyanın **kendi dünyası**, gizlenecek bir şey
  değildi. Sunucudaki İngilizce sabit `'inbound fleet'` dizesi de gitti.

### ⑨ Rapor geçmişi / harita hafızası uyuşmazlığı

Rapor listesi 10'da kesiliyordu, harita hafızası (`probe_world_memories`)
sınırsızdı. Aynı panelde _"3 sa önce sonda ile görüldü"_ ve _"buraya hiç bakan
olmadı"_ yan yana duruyordu. Sınır 40'a çıktı **ve** aşıldığında panel artık
"okuman eskidi" diyor — sahip olunmayan bir cehaleti iddia etmiyor.

---

### ⑮ Radar tanıtım metni yalan söylüyordu

**Bu kusur raporun kendi review'ünde bulundu**, oturumun asıl taramasında değil —
§7.2'ye "kontrol edilmeli" diye yazılmış bir not, kontrol edilince gerçek çıktı.

`vocabulary.instrument.RADAR.roleNone` şöyle diyordu: _"Şu anda buraya bir filo
hiç haber vermeden inebilir, **sondalar gelip gider ruhun duymaz**."_ İkinci yarısı
yanlış: `detectChance`'ın bir tabanı var ve radarı **hiç olmayan** bir dünya bile
sondaların yaklaşık yedide birini yakalar ve `scan_detected` bildirimi alır. Bu
kasıtlı — Radar'ın var olduğunu oyuncuya öğreten şey o bildirim.

Bir satın alma kartının ürünü **fazla satması**, bir karar yüzeyinin yapamayacağı
tek şey. İki dilde düzeltildi: filo uyarısı hâlâ "hiç yok", sondalar için
"çoğu fark edilmeden".

---

## 4 · Yan bulgular (yol boyunca çıkan, kalıcı düzeltilen)

1. **İki test "diskteki ilk kayayı" seçiyordu**, "craft'ın yetişebileceği kayayı"
   değil. Artık fırlatmanın kendisine soruyorlar.
2. **`detectChance` eşiği `>= 5/8` sabitti**, yanında "tavan 0.95" yazan yorumla.
   Tavan düşünce ikisi de bayatladı; eşik artık `INTEL.detectMax`'ten türüyor.
3. **`SENSE_AT_L3 = 1100` literali** — tablo değişince ilgisiz bir nedenle 8 test
   düştü. Türetildi.
4. **`telescopeRange` `Infinity` ile bitiyordu**, `SENSOR.maxRadius` onu kesiyordu.
   İki ifade bir sınır → sürüklendiler (L4 = 1525, tavan = 1800; son basamak 275
   birim satıyordu). Tablo artık kendi tavanını söylüyor.
5. **`packages/rules/src/galaxy.ts`** — iki gereksiz tip anotasyonu lint hatası
   veriyordu (benim değil, commit edilmemiş işten). Zorunlu komşu düzeltme.
6. **`0043_backfill_sensor_epochs.sql` eski menzilleri kalıcı geçmişe yazıyordu.**
   Telescope 4/5 için 1525/1800 sabitleri kalmıştı; yürürlükteki tek kaynak
   1300/1600 diyor. Migration bu hâliyle uygulanırsa bazı asteroid keşifleri
   hak edilenden geniş bir sensör geçmişi kazanacaktı. Sabitler 1300/1600 yapıldı;
   çalışma zamanı backfill'i de doğrudan `sensorReach` yerine `sensorSphere`'ın
   `identify` alanını okuyor.
7. **Radar metni geçici birleşmeyi takip etmiyordu.** `radarContactRange` ile
   `radarRange` bugün aynı olmasına rağmen satın alma kartı, unlock metni,
   yönerge ve temas paneli hâlâ önce saatsiz geniş, sonra saatli dar çember
   anlatıyordu. EN/TR metinleri mevcut tek-çember ürününe göre düzeltildi;
   `docs/intel-realtime-qa.md` ve D145 de aynı modele hizalandı.
8. **`sensorSphere` tek-kapı kuralı tamamlanmamıştı.** Kalıcı asteroid sensör
   geçmişi, rehearsal asteroid filtresi ve bazı menzil sunumları seviyeyi doğrudan
   `sensorReach`/`radarContactRange` ile yarıçapa çeviriyordu. Bugünkü sayılar aynı
   olduğu için görünür arıza üretmiyordu; bir sonraki tablo ayrımında drift edecek
   ikinci görüş motoruydu. Canlı/preview görüş kararları ve hareket menzili
   sunumları `sensorSphere`'a geçirildi; Telescope watch mesafesi ayrı ürün olduğu
   için `telescopeWatchRange` olarak kaldı. Üretim kodunda doğrudan `sensorReach(`
   veya `radarContactRange(` çağrısı kalmadığı tarandı.

---

## 5 · İkinci incelemenin sonucu

### 5.1 ⑤ Zamanlı radar çemberi çizilmiyor — şu an konusuz

İki radar çemberi sahibin talimatıyla **geçici olarak birleşik**
(`radarContactRange === radarRange`). Birleşikken çizilecek ikinci bir çember yok,
dolayısıyla kusur şu an görünmüyor. **Ayırdığın gün geri gelecek.**

`packages/rules/test/intel.test.ts` birleşmeyi **doğrulayan** iki test taşıyor;
tabloları ayırdığın gün ikisi de kırılıp seni uyaracak.

> ⚠️ **D9 askıda.** Birleşik çember, saatin tespit yarıçapında çalması demek:
> 2200 birim içindeki bir akın tüm uçuş süresini savunmacıya veriyor. Bu bilinçli
> ve geçici. Tek düzeltme `INTEL.radarContactRange`'i daha dar bir merdivene geri
> yazmak.

### 5.2 Doğrulanan ve kapatılanlar

| #   | Doğrulama                                                                                                                                                                                                                                                                                                                                     | Onarım                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⑩   | Gerçek. Seed `playerId:slot` olduğu için farklı slot bağımsız INTERMITTENT zarı atıyordu; üç yuva %75'i yaklaşık %98'e çıkarabiliyordu.                                                                                                                                                                                                       | `assignWatch`, komutanın sahip olmaya devam ettiği bütün gözlem dünyalarında hedef tekilliğini kontrol ediyor ve `TARGET_ALREADY_WATCHED` döndürüyor. Hedef dünya satırı zaten kilitli olduğundan iki ayrı koloniden eşzamanlı atama da bu kontrolü yarıştıramıyor. Eski build'den kalmış duplicate satırlar okuma sınırında hedef başına teke indiriliyor; en güçlü etkin Telescope, eşitlikte kararlı dünya/slot seçiliyor. |
| ⑪   | Gerçek. İzlenen `fleet` gerçeği `units.location`'dan geliyor ve kalkış/varışta değişiyor; yalnız traffic invalidasyonu yeterli değildi.                                                                                                                                                                                                       | Genel `launch`/`arrival` olayına pahalı `keys.galaxy` eklenmedi. Mutasyon hedefi bilen sunucu, yalnız o dünyayı izleyen komutanlara `private:sight` gönderiyor; istemci `keys.galaxy` + `keys.intel` okuyor. PROSPECTOR gibi Telescope filo gerçeğini değiştirmeyen hareketler olay üretmiyor. 60 sn yoklama güvenlik ağı olarak duruyor.                                                                                     |
| ⑫   | Gerçek. `READ` politikası yaş gösteren Intel ekranını sessizce donduruyordu.                                                                                                                                                                                                                                                                  | `useIntel`, `NET_MS` ile 60 sn'de bir yenileniyor. Seed pencere içinde deterministik ve sunucu doğrulama yazısını ayrıca throttle ettiği için yeniden zar satın alınmıyor. Fake-timer regresyon testi var.                                                                                                                                                                                                                    |
| ⑬   | **Kısmen gerçek.** REMEMBERED owner/core/satellites/dome/clan D127 gereği bakış anında donar. Bu yüzden eski owner üzerinden rakip retikülü kazanılmış tarihsel istihbarattır; onu canlı yapmak sahiplik değişimini sızdırır. Fakat yeşil `isClanmate` aynı zamanda güncel dost ateşi emniyeti gibi sunuluyordu ve donmuş veriden üretilemez. | Klan etiketi tarihsel kayıt olarak gösterilebilir; yeşil klan arkadaşı durumu yalnız `RESOLVED` intel'den türetiliyor. Rakip retikülü bilinçli olarak değiştirilmedi.                                                                                                                                                                                                                                                         |
| ⑭   | Gerçek. Worker `lead + LEAD_TOLERANCE`, pending şeridi yalnız `lead` kullanıyordu.                                                                                                                                                                                                                                                            | İki yüzey aynı dışa aktarılan `LEAD_TOLERANCE` sabitini kullanıyor; sınırın içindeki toleransı doğrulayan test eklendi.                                                                                                                                                                                                                                                                                                       |

### 5.3 Bu oturumun işi olmayan kırmızı

**`debris.test.ts` — "alan söndükten sonra inen hurda seferi boş döner"**

Sebep bulundu: `mining_arrival`, gecikmiş bir işçiyi cezalandırmamak için **duvar
saatiyle değil, kuyruğun söz verdiği anla** çözülüyor (`worker/handlers.ts` →
`onMiningArrival`, `resolveMiningArrival(tx, runId, event.resolveAt)` çağrısı;
commit edilmemiş madencilik işinde bilinçli bir karar). Eski test duvar saati
varsayıyor. Sensörlerle hiç ilgisi yok; madencilik tarafının vermesi gereken bir
karar, o yüzden dokunulmadı.

**Simülatör sezon kapısı** (VFR/ARR/TI) — `CLAUDE.md`'de "önceden var olan engel"
diye kayıtlı. `packages/sim` bu oturumda değiştirilen **hiçbir sabiti kullanmıyor**
(grep ile doğrulandı), dolayısıyla etkilenmesi mümkün değil.

---

### 5.4 ⑲ Sunucu süiti tam koşuda kararsız — **açık**

Bu dokümanın kendi review'ünde ortaya çıktı. Önceki hâli "985 / 986 — 1 kırmızı"
diyordu; ölçüm bunu doğrulamıyor.

**Ölçülen davranış.** `vitest list` **986 test** topluyor ve toplama deterministik
(iki ayrı listeleme birebir 986). Aynı ağaçta arka arkaya yapılan tam koşular:

| Koşu | Sonuç |
| --- | --- |
| A | 985 / 986 — yalnız `debris` |
| B | 958 / 986 — 28 düşük |
| C | `intel.test.ts`'in **tüm bir bloğu** düştü (sonda soğuması, tespit, rapor sahipliği…) |

Aynı dosyalar **izole** koşuldığında (`intel` + `pending` + `sensor-horizon`):
**107 / 107 yeşil.** Üç kez tekrarlandı.

**Elenen sebepler** — tekrar araştırılmasın:

- **Dış süreç değil.** Koşu boyunca `pg_stat_activity` izlendi: yalnız süitin kendi
  bağlantıları (`application_name = astera`) ve gözlemci `psql`. Oturumun *başında*
  gerçekten başka bir vitest süreci vardı; sonrasında yok.
- **Toplama sorunu değil.** İki `vitest list` çıktısı birebir aynı.
- **Testlerin kendisi değil.** İzole koşuda hepsi geçiyor.
- **Tek bir patolojik dosya değil.** Dosya başına süre 10–25 sn arasında dağılmış.

Kalan hipotez: **dosyalar arası sızıntı.** `fileParallelism: false` olduğu için
dosyalar sırayla koşuyor, ama bir dosyanın arkada bıraktığı bir şey — durdurulmamış
bir `EventWorker`/bus, kapanmamış bir `buildApp`, paylaşılan havuzda kalan bir
işlem — sonraki dosyanın `truncateAll`'una karışıyor olabilir. **İlk bakılacak yer:**
`.start()` çağırıp `.stop()` çağırmayan test dosyaları — `asteroid-api-security`,
`galaxy`, `intel-states`, `stream`, `traffic`.

**Neden öncelikli:** bu haldeyken `pnpm verify` yeşil/kırmızı sinyali güvenilmez,
yani bundan sonraki hiçbir değişiklik güvenle doğrulanamaz. Kusurun kendisi bu
oturumun işi değil; ortaya çıkması bu oturumun işi.

> Bu oturumun düzeltmeleri ayrıca doğrulandı: ilgili süitler izole koşuda yeşil,
> `rules` 497/497 ve `web` her koşuda kararlı. Kararsızlık **sunucu süitinin tam
> koşusuna** özgü.

---

## 6 · Nereye code review yapılmalı

Öncelik sırasıyla. Her satırda **ne aranacağı** yazıyor — "genel bak" demiyor.

### 6.1 🔴 `packages/rules/src/sight.ts` — yeni tek kaynak

Bütün görünürlük buradan çıkıyor; burada bir hata olursa hem sunucu hem istemci
aynı anda yanlış olur ve **testler de yanlışı doğrular**.

- `sensorZone`'da `identify` **önce** test ediliyor. Bu kasıtlı: Teleskop 5 +
  Radar 1 tutan bir komutanda tanıma çemberi tespit çemberinden geniştir.
  Sıralamayı bozmanın o dünyayı **hiçbir şey çözemez** hâle getirdiğini doğrula.
- `sensorSphere` dışında bir yerde seviye→mesafe dönüşümü kaldı mı?
  `grep -rn "sensorReach(\|radarContactRange(" apps packages` ile tara; her isabet
  ya bu fonksiyonun içinde ya bir testte olmalı.
- Boş küre listesi, sıfır yarıçap, çakışan küreler, tam sınırda duran nokta.

### 6.2 🔴 `apps/server/src/services/traffic.ts` — projeksiyon

- `zoneAt(slice.from)` **aracın şu anki konumuna** uygulanıyor, bacağına değil.
  Bir yerde bacağa uygulanırsa "yakınından geçen her şeyin tüm uçuşu" yayınlanır.
- `radarReveal` yalnızca **gerçekten tespit eden** postaları sayıyor. Diskin öbür
  ucundaki Radar 5'in konuşmadığını doğrula.
- `windowOf`: `landing` yalnızca `TRAFFIC.refreshMs` içinde `true` olmalı. Bu
  dosyada tekrar mutlak bir süre belirirse ① geri gelir.
- `impact` / `recentDeathStarImpact` efekt olarak bölge kapısından önce döner. `engagement`
  anı da her mesafede döner ama **filo dönmez**: dal kendi içinde tutulma noktasını
  `sensorZone` ile sınar; `NONE` yalnız `effectOnly`, `CONTACT` `?`, `IDENTIFIED` filo
  silüeti üretir. Public event'in gerçek yaklaşma noktasını tekrar sızdırmadığını kontrol et.
- Madencilik döngüsündeki **iki ayrı kapı**: bölge → aracı, kaya keşfi → rotayı
  yönetiyor. Karışırlarsa ya rota sızar ya matkap kaybolur.

### 6.3 🟠 `apps/server/src/routes/intel.ts` + `services/intel.ts`

- `me()` **başkenti** döndürüyor; `/api/intel` artık `projections.commander`
  kullanıyor. `me()`'nin kalan iki kullanımı (watch/probe POST) doğru — oralarda
  varsayılan **origin** gerekiyor. Yeni bir GET yazan bunu karıştırabilir.
- `readRadarLog` her satırı **kendi dünyasının** radarıyla kapılıyor. Tek bir
  seviye ile toplu kapılama (eski hâli) geri gelmemeli.
- `readProbeReports` sınırı 40. Harita hafızası sınırsız; ikisi ayrışırsa ⑨ geri gelir.

### 6.4 🟠 `apps/web/src/api/queries.ts` + `galaxy/crossing.ts`

- `useContactWindows` **tek zamanlayıcı** kuruyor (en erken an). Kalabalık
  galakside `contacts × sensors` zamanlayıcı üretmediğini doğrula.
- `TRAFFIC_MS` sunucunun taban sabitiyle **aynı** olmalı — ayrışırsa ① geri gelir.
- `nextCrossing` kök çiftlerini `1e-9` ile tekilleştiriyor (teğet geçiş, çakışan
  küreler, aynı postanın iki yarıçapı). Kaldırmanın sahte kimlik değişimi
  ürettiğini doğrula.

### 6.5 🟠 `apps/web/src/lib/dossier.ts`

- **Yok ≠ sıfır**: `doctrines === undefined` (okuma alınmadı) ile `{}` (bakıldı,
  bulunamadı) farkı. Bu ayrım bozulursa panel bilgi uyduruyor demektir.
- Her sonda satırı `ageMinutes` taşıyor. Yaşsız basılan bir kayıt, kaydı **canlı
  okuma** gibi gösterir.
- Yuva sayımı aktif dünyaya kapılı; komutan geneline dönerse ⑧ geri gelir.

---

## 7 · Logic review — hangi case'lere bakılmalı

Bunlar testlerin **kapsamadığı** ya da yeni kapsadığı senaryolar. Her biri gerçek
bir oyun durumu.

### 7.1 Görünürlük geçişleri

| Case                                                   | Beklenen                                            | Neden kritik                                                   |
| ------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------- |
| Araç **çemberimin içinde doğar**, hiç çıkmaz           | İlk andan sona kadar görünür                        | ⓪'ın ta kendisi                                                |
| Araç dışarıda doğar, radar çemberime **girer**         | ❓ belirir, ≤5 sn gecikme                           | İstemci kaydı olmadığı için hesaplayamaz; yalnız yoklama bulur |
| ❓ teleskop çemberine girer                            | Kimliğe kavuşur, **tam saniyesinde**                | `nextCrossing` bu anı çözer                                    |
| Teleskoptan çıkar, radarda kalır                       | ❓'ye **geri döner**                                | Dönüş yönü unutulursa okuma lisanssız kalır                    |
| Radardan da çıkar                                      | **Tamamen kaybolur**                                | Kaybolmazsa D125'in eski davranışı geri gelmiş demektir        |
| Çembere **teğet** geçer                                | Kimlik değişmez, titremez                           | Kök çifti tekilleştirmesi                                      |
| İki dünyamın çemberleri **çakışır**, araç aradan geçer | Kimlik kaybolmaz                                    | Birleşim tek hacim gibi davranmalı                             |
| Uplink söker/takar                                     | Etki durur/başlar, **donanım silinmez**             | `instrumentLevels` kapısı                                      |
| Core düşer (Ölüm Yıldızı)                              | Teleskop/Radar kırpılır, `sensors` cache temizlenir | `projections.ts` `shard:impact`                                |
| **Korsan** çemberimden çıkar (D158/D160)               | **Bir kez TANIMLANDIYSA tanımlı kalır**            | Kaya gibi hatırlanır: aynı `sensor_epochs`, aynı `orbitDiscoveredAt`. `sensor_epochs.reach` teleskop yarıçapıdır, yani "keşfedilmiş" zaten "teleskop çemberindeydi" demektir |
| Korsan radar çemberimde                                | ❓ + (L4) kütle + (L5) `silhouette: 'pirate'`        | Kadro ve **seviye** yalnız teleskopta; seviye fiyat etiketidir  |
| Korsan teleskop çemberimde                             | Gerçek kadro + seviye + hasar cezası                | Kadro `roster − losses`; ölmüş gemi yeniden doğmaz              |
| Hatırlanan korsan hiçbir çemberde değil (D160/D166)    | Gemi kendisi — kadro, seviye, kütle — **tam güçte** | `pirateZone` tabanı `IDENTIFIED`; `remembered: true` yayınlanır ve RAY bunu yazıyla söyler, ama disk hiçbir aracı soluklaştırmaz (D166). Yörünge çözülebilir, kadro canlı — kayanın `oreRemaining`'i gibi |
| Hiç tanımlanmamış korsan radar çemberinde (D160)       | ❓ nokta — kütle/silüet yalnız L4/L5                | Hafıza yok, taban yok: radar tek başına manifest satmaz        |
| Korsan **yörüngesi**                                   | **Hiçbir zaman yayınlanmaz**                        | radius/period/phase/inclination/ascendingNode = rota            |
| Korsan pencere süresi                                  | `TRAFFIC.refreshMs × 2` (10 sn), asla altı değil    | 4 dk pencere en kısa turda ~180° yay; kiriş yörüngeyi keser     |
| Korsan **çarpışma** anında                             | Randevu noktasında **durur**, `engagement` fog-kapılı | Yörüngeye devam ederse gemiler uzaklaşırken dövüşür           |
| **Kendi** korsan akınım                                | `traffic`'ten çıkarılır, `pendingThreads`'te görünür | İkisi birden unutulursa filo kalkar ve kaybolur (G1/G2)        |

### 7.2 Sonda yaşam döngüsü

- Sonda **gidiş** bacağı: son 5 sn dışında hedef yayınlanmamalı.
- Sonda **dönüş** bacağı: son 5 sn dışında **sondacının evi** yayınlanmamalı.
  (Dönüş bacağı uçların takas edilmiş hâlidir — kolay gözden kaçar.)
- Çok kısa sıçrama (225 birim, 3.5 sn): tüm uçuş "son yaklaşma" sayılır. Bu kabul
  edilen sınır; iki komşu dünya arası minimum mesafe zaten 225.
- Sonda hedefe varır → dönüş bacağı **yeni bir mission** olarak doğar. O anın
  görünürlüğü ⓪'ın ikinci yarısıydı.
- `detectChance` artık taban %15 / tavan %80. **Radarı olmayan dünya da %15
  yakalıyor** — bu kasıtlı (Radar'ı öğreten bildirim), ama oyun içi metin hâlâ
  "sondalar görülmeden gelip gidiyor" diyorsa **yalan**. Kontrol edilmeli.

### 7.3 Çoklu dünya (1 başkent + 3 koloni)

- Dört dünyanın çemberlerinin **birleşimi** görünürlüğü belirler.
- Teleskop yuvaları **dünya başına** numaralı — iki dünya da "1. yuva" der.
- Radar kaydı **komutan geneli**, satır satır kendi dünyasının radarıyla kapılı.
- Gelen saldırı **hangi dünyaya** geldiğini söyler.
- Koloni el değiştirirse: `commanders` + `sensors` + `remembered` cache'leri
  **birlikte** temizlenmeli (`projections.ts` `shard:control`). Biri unutulursa bir
  oyuncunun sisi başkasına servis edilir.

### 7.4 Sis sınırı — payload'ı incele, CSS'i değil

Her yeni alan için sorulacak soru: **bu alanı gizleyen şey sorgu mu, yoksa
arayüzün onu çizmemesi mi?** ④ tam olarak ikincisiydi.

- `unknown` temas: `mass` yalnız Radar 4+, `silhouette` yalnız Radar 5.
  `fleet`/`route`/`craft` **hiçbir zaman**.
- `IDENTIFIED` temas: `mass` var, `fleet` yok, `route` yalnız madencilik/hurda.
- `incoming` thread: `mass` L4, `fleet` L5, `originName` L5, `targetPlanetId`
  **her zaman** (kendi dünyan).
- `/api/notifications` payload'ı **ham** geçiyor. Oraya yazılan her alan, kapısız
  yayınlanmış demektir.
- `/api/leaderboard`: skor/komutan kimliği kamusal; başkent kimliği ve tier yalnız
  mevcut görüşte veya donmuş probe hafızasında. UNKNOWN satır bunları payload'dan
  tamamen düşürür; isim tıklaması kamera focus'u yerine keşfedilmemiş konum uyarısı verir.

### 7.5 Zamanlama / eşzamanlılık

- Radar uyarısı yeniden teslim edilirse (redelivery) çift bildirim olmamalı.
- `nextInboundRadarCheck` içeri doğru yürümeli ve **durmalı**; `LEAD_TOLERANCE`
  bunu garantiliyor.
- Uçuş ortasında Radar/Uplink kurulursa `wakeInboundRadarWarnings` kalan uyarıyı
  satın almalı.
- İnterception uyarıdan **1 sn önce** çözülür (`interceptBefore`) — "geliyor" ile
  "zaten enkaz" aynı tick'te çıkmasın diye.
- **Radar L1/L2 altında interception çemberi yoktur.** Yalnız hedef dünyanın
  efektif Radar L3+ çemberi ateş hakkı verir. Radar yetmiyorsa, Ölüm Yıldızı
  savunmacının kontrol ettiği herhangi bir dünyanın efektif Telescope görüşüne
  girdiği anda hedef dünyadaki hazır şarj ateşlenir.
- Atış ile çarpışma ayrı, kalıcı olaylardır: füze dört saniyede hedefe ulaşır;
  iki taraf ve çarpışma noktasını Telescope ile tanımlayan diğer komutanlar aynı
  animasyonu görür. Intercept edilen görev daha sonra sahte gezegen patlaması
  üretemez.
- İki Ölüm Yıldızı aynı anda çemberi geçerse **tek şarj tek silahı** düşürmeli
  (`FOR UPDATE` + status guard).

---

## 8 · Manuel oyun testi — gözle bakılacaklar

`docs/intel-realtime-qa.md` hâlâ geçerli; şu maddeler bu oturumun değişikliği
yüzünden **eklendi/değişti**:

1. **Üç profil, üç komutan.** X gözlemci (Teleskop 5 + Radar 5), Y kalkış yapan,
   Z hedef. Y ve Z, X'in teleskop çemberinin **içinde**.
2. Y'den Z'ye filo gönder → X **kalkış anından itibaren** görmeli. Görmüyorsa ⓪
   geri gelmiş demektir.
3. Y'den Z'ye sonda gönder → X hem gidişi hem dönüşü görmeli. Dönüşte
   kayboluyorsa ⓪'ın ikinci yarısı geri gelmiş demektir.
4. Y'yi radar çemberine yakın bir dünyaya taşı → araç dışarıdan içeri girerken
   ❓ **birkaç saniye içinde** belirmeli.
5. Radar 1 ve Radar 5 ile ❓'ye tıkla → L5 türü söylemeli, L4 büyüklüğü, L3 hiçbiri.
6. Sonda raporunda **dört yeni satır** görünmeli: doktrin, stratejik savunma,
   rampadaki silah, döteryum. Hepsinin yanında yaş yazmalı.
7. Koloniye sonda at → Intel ekranının radar kaydında **koloninin adıyla** çıkmalı.
8. İki dünyanın da 1. yuvasını kullan → her dünyanın kendi ekranında kendi
   izlemesi görünmeli.
9. Koloniye saldırı gönder → şeritte ve bildirimde **koloninin adı** yazmalı.
10. **Radarsız bir dünyaya sonda at**, birkaç kez. Yakalanma olmalı (~%15) ve
    bildirim düşmeli. Radar kartının metni artık bunu yalanlamamalı (⑮).
11. **TR ve EN**, telefon genişliğinde. Yeni metinler: `dossier.*` dört blok,
    `intel.radar.onWorld`, `pendingStrip.incomingAt/incomingFromAt`,
    `notifications.incomingAt`, `focus.contact.radarKind`.
12. Aynı komutanın ikinci yuvasını aynı hedefe çevir → `TARGET_ALREADY_WATCHED`
    görülmeli; ilk atama ve cooldown değişmemeli.
13. X, Y'yi izlerken Y'den savaş filosu kaldır/indir → X'in haritasındaki `fleet`
    60 sn'lik yedek yoklamayı beklemeden değişmeli. Aynısını yalnız PROSPECTOR ile
    yapınca gereksiz `private:sight` olayı çıkmamalı.
14. REMEMBERED bir eski klan üyesi klan etiketi taşıyabilir ama yeşil “klan
    arkadaşı” rengi almamalı. Tarihsel rakip retikülü ise kayıt yaşlandıkça kalır.

---

## 9 · Bundan sonra

**1 — `debris.test.ts` (sensör kapsamı dışında).** Tam sunucu koşusu artık aynı
993 testi topluyor ve yalnız bu eski duvar-saati beklentisinde 992/993 kalıyor.
⑲'in gerçek kaynağı event-bus listener'ı değil, rastgele UUID'lerle üretilen sekiz
probe sonucundan istatistik alt sınırı bekleyen olasılıksal assertion'dı; saf kural
olasılığı ve entegrasyon persist sözleşmesi ayrılarak deterministik hale getirildi.

**2 — ⑤, ama bir kusur olarak değil.** Radar'ın temas ve zamanlı uyarı çemberleri
bugün bilinçli biçimde birleşik. İki merdiven ayrıldığı gün ikinci çember çizimi ve
D9 davranışı **birlikte** ele alınmalı (§5.1); mevcut birleşik modelde bunu şimdi
"düzeltmek" ikinci bir kural kaynağı yaratır. `packages/rules/test/intel.test.ts`
birleşmeyi doğrulayan iki test taşıyor — tablolar ayrıldığı gün ikisi de kırılıp
uyaracak.

**3 — `debris.test.ts`.** Madencilik varışı duvar saatiyle değil kuyruğun söz
verdiği anla çözülüyor; eski test duvar saati varsayıyor (§5.3). Sensörlerle ilgisi
yok, madencilik tarafının kararı.

---

## 10 · Üçüncü derin incelemede bulunan ve kapatılan ek kusurlar

| # | Doğrulanmış kusur | Sonuç |
|---|---|---|
| ⑳ | Stratejik interception satırı, `sensorZone`'un 500 birimlik çıplak-göz tabanını Telescope sanıp üçüncü kişiye animasyon veriyordu | Üçüncü kişi artık yalnız `post.telescope === true` ve çarpışma Telescope identify alanındaysa görür; taraflar her zaman görür |
| ㉑ | Füze fırladığı anda `shard:impact` bütün galaksiye gidiyor, gizli interception zamanını dört saniye erken açıklıyordu | Fırlatma yalnız saldıran, savunan ve efektif Telescope tanıklarına `private:strategic-sight` yollar; kamusal `shard:impact` çarpışma anında kalır |
| ㉒ | Leaderboard UNKNOWN bir komutanı güncel `planetId`, başkent adı ve Core tier ile eşliyordu | UNKNOWN bu üç alanı almaz; isim butonu focus yerine keşfedilmemiş konum uyarısı verir. RESOLVED güncel, REMEMBERED donmuş probe tier'ını alır |
| ㉓ | Radar L4 bildirimi kaba `mass` yerine kesin gemi sayısı veriyordu | L4 yalnız LIGHT/MEDIUM/HEAVY; L5 tam kompozisyon. Eski notification satırları geriye dönük render edilmeye devam eder |
| ㉔ | Teslim edilmiş probe raporunun hedef komutan adı güncel ownership/account join'inden okunuyordu | Kimlik raporun donmuş `silhouette.owner` snapshot'ından okunur; sonradan sahip/ad değişimi tarihi yeniden yazmaz |
| ㉕ | “40 rapor yeter” gerekçesi matematiksel olarak yanlıştı; hafızadaki dünyanın dossier'ı endpoint'ten düşebiliyordu | Son 40 geçmişe ek olarak her hedefin en yeni teslim edilmiş raporu döner; tekrarlar rapor id'siyle birleşir |
| ㉖ | Telescope RNG tohumu `playerId:slot` idi; iki koloninin yerel slot 0 izlemesi aynı belirsizlik penceresine bağlanıyordu | Kimlik `observerPlanetId:slot`; dünya-yerel yuvalar bağımsız |
| ㉗ | Mining/salvage CONTACT kolu Radar L4 `mass` ürününü uygulamıyordu | Diğer craft'larla aynı L4 kaba kütle, L5 silhouette sözleşmesine hizalandı |
| ㉘ | Gerçek impact ledger'ı olmadan elle `resolved` yapılan iki eski test artık ghost-impact korumasıyla çelişiyordu | Test fixture'ları gerçek `strategic_impacts` ledger'ını yazar; intercepted görev hâlâ sahte gezegen patlaması üretmez |
| ㉙ | Sensor toggle ikon düğmelerinde klavye focus göstergesi yoktu | Görünür `focus-visible` halkası eklendi; UNKNOWN leaderboard kimliği anlamsız button olmaktan çıkarıldı |

### 10.1 Doğrulanan görünür / görünmez matris

- Genel Radar temas çemberi **L1/L2'de vardır**. Yalnız anti-stratejik
  `interceptionRange` L3 altında sıfırdır; eski “L3 altında Radar çemberi yok”
  cümlesi hiçbir yerde genel Radar'a uygulanmamalı.
- Interception animasyonu saldıran ve savunana sensörden bağımsız görünür.
  Üçüncü kişi çıplak göz, Radar veya Telescope dışı identify tabanıyla göremez;
  yalnız efektif Telescope çarpışma noktasını kapsıyorsa görür.
- Füze uçarken galaksi geneline zaman sinyali yoktur. Dört saniyelik çarpışma
  tamamlanınca Chronicle/impact kamusal olur.
- Radar CONTACT: L1–L3 konum; L4 kaba mass; L5 silhouette; exact fleet yoktur.
  Telescope IDENTIFIED görüş alanında exact hull/adet hem focus yüzeyinde hem gerçek
  hull assetleri ve adet pip'leriyle görünür. L5 gelen-saldırı uyarısı ayrıca kendi
  özel/atfedilmiş kanalında exact roster verebilir.
- Probe: uçuşta rapor yok; eve dönünce snapshot var; snapshot sahibi, tier,
  doktrin ve interception bilgisini sonraki dünya değişikliklerine göre yenilemez.
- Leaderboard: skor, rank, komutan ve clan kamusal; dünya eşlemesi UNKNOWN'da yok,
  REMEMBERED'da donmuş, RESOLVED'da günceldir.

### 10.2 Açık tasarım sınırı

Başka bir koloninin Telescope küresi Ölüm Yıldızı rotasına hedefe **üç saniyeden
daha az** kala teğet girerse iki istek aynı anda karşılanamaz: “görüşe girer girmez
vur” ile “roket animasyonu 3–5 saniye sürsün ve gezegenden önce çarpışsın”. Mevcut
uygulama savunmayı kaybettirmemek için görevi giriş anında çözüp dört saniyelik
animasyonu tamamlıyor; çok uç bir geometride animasyonun sonu eski ETA'yı aşabilir.
Bu, menzil veya yetki sızıntısı değil; fiziksel minimum lead mi yoksa mutlak
Telescope savunması mı üstün gelecek şeklinde ürün kararı gerektirir.
