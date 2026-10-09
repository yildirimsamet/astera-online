# Filo kaçışı incelemesi — 2026-10-09

## Onaylanan kapsam

- Yalnız filo kaçışı incelenir; koloni arızaları ve koloniyi bırakma bu çalışmanın dışında.
- Yer savunması güç oranında kalır. Çekirdek arızası / EMP ile devre dışı kalan savunma hesaba girmez.
- En az beş savaş gemisi şartı ve kaçış öncesindeki savaşın DECISIVE olması şartı korunur.
- Eşik 3'ten 3,5'e çıkarılır; mevcut eşitlik davranışı korunur: tam 3,5 dahil, üst sınır yok.
- Yakıt, duruş, eski sezon kapıları, ganimet ve Dominion kuralları korunur.
- Son yönlendirme uyarınca ekonomi simülasyonları ve `snowball-audit.test.ts`
  kabul kontrolleri dışında bırakılır. Daha önce gözlenen sonuçlar kayıtlı kalır;
  bu testlerin başarılı olduğu varsayılmaz.

## İnceleme kapsamı ve değişiklik riski

| Alan | Kontrol |
| --- | --- |
| Oran | 3; 3,5'in hemen altı; tam 3,5; üzeri; büyük saldırı; aktif yer savunmasının payı |
| Birlikler | 0–4 / 5 savaş gemisi; nakliye; yalnız yer savunması; boş gezegen; Prospector; onarımda ve görevdeki gemiler |
| Savaş | Kalkan, karşı sınıflar, araştırma, nakliye duvarı, radyasyon ve kalıcı hasar |
| Yakıt | Tam maliyet; bir eksik; kesirli / sıfır / bozuk depo; tüm gemilerin maliyeti; yağmadan önce tahsilat |
| Duruş | ESCAPE / HOLD / SUPPORT; klan desteğinin gelişi, geri çağrılması ve duruş değişikliği |
| Sezon | 11 öncesi kapalı; 11–12 gemi sayısı alt sınırı yok; 13+ beş; 15+ duruş |
| Çoklu saldırı | Birleşik saldırıdaki tüm katkılar; eşzamanlı saldırılar; yinelenen teslimat; işlem geri alma |
| Sonuç | Kaçan gemilerin korunması; kalan savunma ve yeniden inşa; hasar; ganimet; Dominion; dönüş |
| İstemci | Kendi eşik hesabı; düşman okumasının belirsizliği; yardım / rapor metinleri; geçmiş raporlar |
| Simülatör | Sunucuyla aynı saf kural; eşik sınırı ve yakıt |

Dokunulacak yerler: ortak `ESCAPE.ratio`, ilgili kural / sunucu / simülatör testleri,
eşikten söz eden arayüz metinleri ve güncel mekanik dokümantasyonu. Üretim veritabanı
ve mevcut çalışma alanındaki ilgisiz değişiklikler değiştirilmez.

İstemcide aynı metinleri tüketen hem `ForceCompare` hem `ForceRuler` yardım ve sonuç
satırları yeni oranı geçmelidir; iki bileşen de altı dilde kontrol edilir.

TDD: önce yeni sınır ve regresyon testleri → eski eşikle FAIL → ortak sabit ve
gerekli metin değişiklikleri → hedefli PASS → tüm `pnpm verify` → son inceleme.

## Sonuçlar

Oran **3,5 ve üzeri** olarak güncellendi. Aktif yer savunması korunuyor. İncelenen
sunucu senaryolarında hatalı kaçış, gemi kaybı veya çift yakıt kesintisi yeniden
üretilemedi. Bir arayüz tutarsızlığı doğrulandı; aşağıda ayrı bulgu olarak kayıtlı.
Yeni oran ayrıca mevcut sezon denge testini bozuyor: aynı beş tohumda GRINDER'ın
lider olduğu koşu sayısı 3 / 5'ten 2 / 5'e düşüyor. Bu etki kontrollü olarak
doğrulandı; testin beklentisi değiştirilmedi.

### Kaçışın gerçek koşulları

Oran, doğrudan saldırı hasarı değildir. `combatValue`, ateş edebilen birliklerin
alaşım + kristal + döteryum yapım maliyetini toplar. Nakliyeler bu değere girmez;
aktif yer savunması girer. Araştırmalar, karşı sınıflar, hasar ve kalkan bu oranın
sayısına eklenmez; ayrıca yapılan gerçek savaş hesabını etkiler.

```text
saldıran bütün dalgaların combatValue toplamı
    >= 3,5 × (savunan evdeki savaş gemileri + aktif yer savunması).combatValue
```

Güncel kurallarda aşağıdakilerin tamamı gerekir:

1. Gezegenin duruşu `ESCAPE` olmalı. `HOLD` ve `SUPPORT` kaçışı kapatır.
2. Savaş hattında en az beş savaş gemisi olmalı. Nakliye, Prospector ve yer
   savunması bu sayıyı tamamlamaz.
3. Yukarıdaki oran sağlanmalı. Tam 3,5 yeterlidir; 3 ve 3,5'in hemen altı yetmez.
   4, 10 veya daha büyük oranlarda üst sınır yoktur.
4. Filo yerinde kalsaydı gerçekleşecek savaş `DECISIVE` olmalı: savunan hat tamamen
   silinmeli ve ilgili kalkan koşulu sağlanmalı. Sadece oranı aşmak yeterli değildir.
5. Gezegen deposunda tüm kaçan gemilere yetecek döteryum bulunmalı. Bedel,
   `missionFuel(kaçanGemiler, 600, 2)` ile hesaplanan gidiş-dönüştür. Tam bedel
   yeterlidir; bir birim eksikse filo savaşır ve kaçış yakıtı kesilmez.

Kaynak: [escape.ts](../packages/rules/src/escape.ts),
[hulls.ts](../packages/rules/src/hulls.ts),
[clanSupport.ts](../packages/rules/src/clanSupport.ts).

### Sınır durumlarının sonucu

| Durum | Doğrulanan davranış | Kanıt |
| --- | --- | --- |
| Eski 3×, 3,5'in hemen altı, tam 3,5 ve üzeri | İlk ikisinde savaş; tam eşik ve üzerinde diğer şartlar sağlanırsa kaçış | Saf kural ve gerçek görev testleri; simülatörde 3 / 3,5 karşılaştırması |
| Aktif yer savunması | Savunanın değerini yükseltir, tek başına gemilerin sağladığı oran kaçışa yetmeyebilir | Kural testi; sunucuda `THORN: 1` ile kaçışın engellenmesi |
| EMP / Çekirdek arızası | Devre dışı yer savunması ve kalkan savaşa ve orana girmez; bu toplar yok edilmez | İki sunucu yolu aynı `defenceOnline` kontrolünü kullanır; EMP ile gerçek kaçış ve korunmuş Bastion testi |
| 0–4 / 5 savaş gemisi | Güncel sezonda ilk grupta kaçış yok; beş gemiyle diğer şartlar sağlanırsa var | Kural testi; güncel kurallarla 4 / 5 gemili gerçek görev |
| Nakliye filosu / yalnız top / boş gezegen | Güncel sezonda kaçış yok. Nakliyeler beş gemi şartını doldurmaz; toplar kaçmaz | Saf kural testleri |
| Savaş gemileri yanında nakliye | Nakliye oranı yükseltmez ama kalan gemilerle birlikte kaçar ve yakıt bedeline girer | Tam / eksik yakıt testi; nakliye duvarının `DECISIVE` koruması |
| Prospector | Savaş hattına ve kaçış yakıtına girmez; gezegende korunur | `garrisonOf`; sunucu ve simülatör testleri |
| Görevdeki veya onarımdaki gemiler | Evdeki savaş hattında olmadıkları için bu çatışmanın oranına ve kaçışına girmez | Görev varışı `homeFleet` ve `ground` okur; onarıma ayrılan gemiler ayrı konumdadır |
| Kalkan, karşı sınıflar, araştırma | Oran sağlansa bile savunma tamamen kaybetmiyorsa kaçış yok | Kalkan / nakliye duvarı kural testleri; gerçek savaş motoruyla `DECISIVE` kontrolü |
| Kaçış açık / kapalı; uçuş sırasında kapatma | Duruş saldırı başlarken değil, savaş çözülürken okunur | Uçuş sırasında `HOLD` seçilerek kaçışın engellenmesi testi |
| Klan savunma desteği | Destekli hat kaçmaz. `SUPPORT`, destek henüz gelmemiş olsa da kaçışı kapatır | Kuralın çelişkili girdiyi reddetmesi; destekli savaş ve duruş testleri |
| Birleşik saldırı | Her dalga ayrı karşılaştırılmaz; gelen tüm katkıların değeri toplanır | Saf kuralda birlikte tam 3,5 sağlayan üç dalga; birleşik saldırı sunucu testi |
| Sıfır / kesirli / geçersiz yakıt | Negatif ve sonlu olmayan depo sıfır; kesirler aşağı yuvarlanır. Kısmi kaçış yok | Saf kural yakıt testleri |
| Yağma ve yakıtın sırası | Başarılı kaçış yakıtı yağmadan önce düşer; depo negatife inmez | Gerçek veritabanında depo = önceki depo − kaçış yakıtı − ganimet |
| Aynı görevin eşzamanlı veya tekrar teslimi | Bir rapor ve bir yakıt kesintisi | İki ilk teslimi paralel çalıştıran test; çözülmüş görevin paralel yeniden teslim testi |
| Farklı saldırıların aynı gezegene gelmesi | Gezegen satırı kilitlenir; her işlem güncel filo ve depo üzerinden çözülür | `onMissionArrival` ve birleşik varışın işlem / kilit akışının kod incelemesi |
| İşlem hatası | Görev claim'i, filo, yakıt, ganimet, rapor ve dönüş aynı işlemde; hata halinde birlikte geri alınır | Sunucu işlem sınırının kod incelemesi |
| Kaçan gemiler ve kalan toplar | Gemiler evde korunur; toplar ve kalkan aynı başlangıç tohumu ile yeniden savaşır; top kurtarma uygulanır | Kural, sunucu ve destekli / birleşik savaş testleri |
| Radyasyon ve kalıcı hasar | Varış hasarı iki çözümde de korunur; kaçış, dokunulmayan saldıran gemileri iyileştirmez | Kesirli hasar testi ve HP savaş regresyon testleri |
| Dominion, ganimet, koruma ve saldıranın dönüşü | Kaçış sonrasındaki gerçek savaş sonucu üzerinden işler; kaçış kaynakları korumaz | Tekli / birleşik savaş yerleşim kodu ve regresyon testleri |
| Kaçış sonrasında koloninin sadakatten ayrılması | Kaçış koloniyi korumaz. Ayrılma akışı evde kalan mobil gemileri sahibinin başkentine taşır; toplar gezegende kalır | `loyalty.ts` / `secedeColony` kod incelemesi; kaçış gemileri `home` konumunda tutar |
| Radar ve sonda belirsizliği | Kararı radar görünürlüğü etkilemez. Güç okuması beş gemiyi veya yakıtı kanıtlamadığı için güncel istemci kesin kaçış vadetmez | Sunucu girdileri; `escapeVerdict` / arayüz testleri |
| Rapor ve bildirim gizliliği | Savunan gemi sayısı ve yakıtı görür; saldıran sadece gerçekleşen kaçışı görür. Yakıt yetersizliği saldırana sızmaz | Sunucu / istemci sözleşme ve bildirim testleri |
| Geçmiş raporlar ve çeviriler | Eski rapora bugünkü oran atfedilmez. Güncel yardımda oran ortak sabitten gelir; altı dilde sayı biçimi doğru | İstemci / i18n testleri; Türkçe ve İngilizce telefon görünümü |

Kaçış bir uçuş görevi oluşturmaz: gemiler yerleşim kaydında evde kalır. Dolayısıyla
dolu uçuş kapasitesi, kaçışı ayrıca engelleyen bir şart değildir. İlk saldırıdan
sonra gemiler ikinci bir saldırıda yine değerlendirilir; her başarılı kaçış ayrı
yakıt ister. Bu, geçici koruma veya başka gezegene sevk değildir.

Sezon kapıları değişmedi: 11 öncesinde kaçış yok; 11–12'de beş savaş gemisi alt sınırı
yok; 13+ bu alt sınırı uygular; 15+ gezegen duruşunu okur. Eşik ortak sabitten
okunduğu için bu değişiklik, kaçışın etkin olduğu kuralların oranını 3,5 yapar.

### Doğrulanan denge etkisi: 3× → 3,5×

Tam simülatör paketindeki tek başarısız kontrol,
[season.test.ts](../packages/sim/test/season.test.ts) içindeki
`the informed archetype reaches the top rank on a majority of seeds, including a tie`.
Sabit 50 oyuncu / 14 gün / 10-5-2 nötr yerleşimli modelde GRINDER bot türünün
medyan sıralamasının beş tohumun çoğunda en iyi olması bekleniyor.

Kaynak dosyasına dokunmadan, ayrı bir süreçte yalnız `ESCAPE.ratio` değiştirilerek
aynı çalışma alanı ve aynı beş tohumla eski / yeni oran karşılaştırıldı:

| Oran | Koşulu sağlayan tohumlar | Sağlamayan tohumlar | Çoğunluk testi |
| --- | --- | --- | --- |
| 3× | 7, 99, 1337 — 3 / 5 | 42, 4242 | Geçiyor |
| 3,5× | 7, 1337 — 2 / 5 | 42, 99, 4242 | Başarısız |

99 tohumunda GRINDER medyan sırası 7'den 10,5'e değişiyor; TURTLE 8'de kalarak
öne geçiyor. Dolayısıyla bu başarısızlık eski bir arızaya veya test zamanlamasına
atfedilemez; oran değişikliğinin ölçülmüş denge etkisidir. Bu model 50 oyunculu
regresyon karşılaştırmasıdır; canlı 300 oyunculu galaksinin birebir tahmini değildir.

İstenen 3,5× oranı uygulandı. Başka denge sabitleri veya bu ölçütün kabul sınırı
değiştirilmedi. Ekonomi simülasyonları son kullanıcı yönlendirmesinde kabul
kontrolleri dışında bırakıldı; ölçülen bu etki inceleme kaydında korunuyor.

Tekrar üretim: `out/fleet-escape-review/ratio-balance-probe.ts`;
beşer koşunun sonuçları: `out/fleet-escape-review/ratio-balance-proof.json`.

### Doğrulanmış bulgu: EMP / arıza sırasında kendi eşik göstergesi

**Oyuncuya etkisi:** Savunma sekmesi devre dışı topları da sayarak kaçışın gerçekte
olacağından daha büyük bir saldırı gerektirdiğini gösteriyor. Sunucunun kaçış
hesabı doğru; sorun oyuncunun kendi gezegenindeki gösterimde.

- [EscapeReadout.tsx](../apps/web/src/ui/EscapeReadout.tsx), topları daima aktif
  kabul ederek `garrisonOf(fleet, ground)` kuruyor. Dosyanın açıklaması da bu
  varsayımı açıkça kaydediyor.
- [PlanetScreen.tsx](../apps/web/src/screens/PlanetScreen.tsx), bu bileşene EMP /
  Çekirdek arızası sırasında da tüm `planet.ground` değerini veriyor.
- [handlers.ts](../apps/server/src/worker/handlers.ts) ve
  [clanWarSettlement.ts](../apps/server/src/services/clanWarSettlement.ts),
  `defenceOnline` false iken topları ve kalkanı çıkarıyor.

**Tekrar üretim:** Evde 20 Dart + 2 Bastion, yeterli döteryum, `ESCAPE` duruşu,
aktif EMP. Dart değeri 8.500, Bastion değeri 6.000. Ekran
`3,5 × 14.500 = 50.750` gösteriyor (yaklaşık 51 bin). EMP sırasında doğru eşik
`3,5 × 8.500 = 29.750` (yaklaşık 30 bin). 70 Dart + 20 Courier saldırısında sunucu
filoyu 10 döteryuma kaçırıyor ve devre dışı iki Bastion'u koruyor.

Geçici teşhis testi, gerçek bileşende **beklenen 30k / görünen 51k** ile başarısız
oldu; sunucu EMP testi geçti. Bilinen hatayı taşıyan teşhis testi kalıcı test
paketine eklenmedi. İnceleme talebi doğrultusunda bu gösterim davranışı değiştirilmedi.
Tekrar üretim çıktısı: `out/fleet-escape-review/emp-readout-proof.log`.

### Doğrulanmış sınır durumu: iki tarafın da yok olacağı savaş

`DECISIVE`, savunan hattın tamamen yok olması üzerinden belirlenir; saldıranın
sağ kalmasını ayrıca şart koşmaz. Bu yüzden iki tarafın da yok olacağı bir savaş
kaçışı tetikleyebilir. Hasarlı saldıran gemiler oran hesabında hâlâ tam yapım
değerleriyle sayılır; mevcut hasar gerçek savaş hesabına taşınır.

Saf kuralda tekrar üretildi: `mulberry32(24680)`, sıfır kalkan / araştırma,
`preciseDamage: true`, depoda 1.000 döteryum. %95 hasarlı (`damageBp: 9500`)
75 Dart, evdeki sağlıklı 20 Dart'a saldırıyor. Oran 3,75. Kaçış kapalıyken her iki filo da yok oluyor ve
sonuç `DECISIVE`. Kaçış açık ve depo yeterliyken 20 savunan Dart 10 döteryuma
kaçıyor; saldıran 75 hasarlı Dart savaşmadan kalıyor. Bu örnek sunucu görevi
olarak ayrıca kurulmadı; `resolveRaid` üzerinden doğrulandı.

Dolayısıyla mevcut koruma gemileri kurtarır; savunanın tüm ekonomik sonucunun
veya Dominion hesabının mutlaka daha iyi olacağını garanti etmez. Mevcut
`DECISIVE` koşulunu koruma kararı kapsamında davranış değiştirilmedi. Bu bir
arıza iddiası yerine, karar verirken bilinmesi gereken doğrulanmış davranış
olarak kaydedildi.

Tekrar üretim: `out/fleet-escape-review/mutual-destruction-probe.ts`;
çıktı: `out/fleet-escape-review/mutual-destruction-proof.json`.

### Simülatörün sınırı

Simülatör aynı `resolveRaid` ve yeni ortak oranı kullanıyor; 3× / 3,5× ve yetersiz
yakıt testleri geçti. Ancak eski sezon kapılarını `world.rulesetVersion` yerine
`MULTI_WORLD.rulesetVersion` üzerinden okuyor. Bu, `SimConfig` açıklamasında zaten
kayıtlı bir sınırlama; özel eski sezon simülasyonunu canlı sunucu davranışının
kanıtı olarak kullanmadım. Canlı sunucu sezonun kayıtlı sürümünü kullanıyor.

### Kaçış dışındaki sunucu regresyonları

Geniş taramada [snowball-audit.test.ts](../apps/server/test/snowball-audit.test.ts)
içindeki üç ekonomi / korsan teşhis testi de başarısız oldu. Kaynak dosyasına
dokunmadan, ayrı süreç ve ayrı test veritabanında eski 3× oranı verilerek üçü de
yeniden çalıştırıldı. Üçünde de yeni oranla aynı sonuç alındı:

| Test | Beklenti | Her iki oranda gözlenen |
| --- | --- | --- |
| Core 6 sonrasında koloni kurma bütçesi | Alaşım < 1.000 | 1.063 |
| Sabit orduyla ikinci nötr akın | `NO_ACTIVE_CLAIM` hatası | `NOT_A_WARSHIP` hatası |
| Korsana iki akının eski gelir teşhisi | Toplam alaşım > 850 | 765 |

Bu üç başarısızlık 3,5× değişikliğine bağlanamaz. Testler ve ilgili ekonomi /
korsan kodu bu çalışmada değiştirilmedi. Tekrar üretim çıktısı:
`out/fleet-escape-review/server-oldratio.log`; yalnız test sürecinin sabitini
değiştiren yapılandırma: `out/fleet-escape-review/old-ratio-vitest.config.ts`.

Uzun ekonomi senaryoları da tamamlandı. Dosyanın tamamında 8 test geçti, 16 test
başarısız oldu. Yukarıdaki üçü dışındaki başarısızlıkların nedenleri ayrıca
araştırılmadı; kullanıcı ekonomi simülasyonları ve bu dosyanın geçilmesini istedi.
Kaçış dışındaki bu sonuçlar, sunucu kaçışında doğrulanmış hata olarak sunulmuyor.

## Doğrulama kaydı

Yeni beklentiler, uygulama değişikliğinden önce eski 3× sabitiyle başarısız oldu:
kural paketinde 7, sunucuda 3, istemcide 10, simülatörde 1 test. Ardından ortak
sabit ve metinler güncellenerek hedefli paketler tekrar çalıştırıldı.

| Kontrol | Sonuç |
| --- | --- |
| Kural: kaçış + HP gezegen savaşı + klan desteği | 57 / 57 geçti |
| Sunucu: kaçış + destekli savaş + duruş + birleşik saldırı | 84 / 84 geçti |
| İstemci: kaçış + i18n + Japonca + ForceRuler | 155 / 155 geçti |
| İstemcinin tam paketi | 5.579 geçti, 29 mevcut atlama; 402 dosya geçti, 1 mevcut atlama |
| Simülatör: kaçış | 4 / 4 geçti |
| Simülatörün tam paketi | Önceki koşu: 181 geçti, 11 mevcut atlama, 1 denge testi başarısız; ekonomi simülasyonları son talimatla kabul kontrolü dışında |
| Kural paketinin tamamı | 2.021 / 2.021 geçti; 110 dosya |
| Çalışma alanı TypeScript kontrolü | Geçti |
| Çalışma alanı lint kontrolü | Geçti |
| 350 px Türkçe / İngilizce gerçek bileşen kontrolü | ForceCompare ve ForceRuler geçti; taşma yok; 29.750'lik kanadın kaçış çizgisi 8.500 |
| 350 px Türkçe / İngilizce gerçek savaş raporu | Savunan / saldıran görünümleri geçti; gemi sayısı ve yakıt saldırana gösterilmiyor |
| Sunucu; `snowball-audit.test.ts` hariç tamamı | 208 dosya geçti; 3.025 test geçti, 1 mevcut atlama |
| `snowball-audit.test.ts` | Son talimatla kabul kontrolü dışında; önceki tamamlanan koşu: 8 geçti, 16 başarısız |

Sunucu testleri bu iş için oluşturulan ayrı bir `_test` veritabanında çalıştırıldı.
Mevcut varsayılan test veritabanında, kaçışla ilgisiz eski şema eksikliği vardı;
geliştirme veritabanına veya mevcut göçlere müdahale edilmedi.

Geniş doğrulamada önce yeni metinlerle ilgili Japonca ve ForceRuler regresyonları
bulundu ve düzeltildi. Sonraki koşuda kaçış dışındaki `v2/away.test.tsx` zamanlama
testi bir kez başarısız oldu; aynı dosya tek başına 15 / 15 geçti. Başlangıçtaki
geniş koşuda da bu dosya geçmişti. Bu alan değiştirilmedi. Aynı kapsamı tamamlamak
için istemci en çok dört, simülatör en çok iki worker ile çalıştırıldı. Sunucu
209 dosyanın tamamını kapsayan dört Vitest shard'ına ayrıldı; son shard'ın kalan
47 dosyası üç ayrı veritabanında tamamlandı. En uzun dosyanın 16 bağımsız ekonomi
senaryosu, ad filtresiyle shard'dan ayrılarak dört ek veritabanında 3 + 5 + 4 + 4
senaryo halinde tamamlandı. Her süreç ayrı `_test` veritabanı kullandı; uygulama
ve test yapılandırması değişmedi. Dosya kapsamı ve sonuçları
`out/fleet-escape-review/final-server-coverage.json` ile karşılaştırıldı:
208 sunucu dosyası geçti, kalan tek dosya son talimatla kapsam dışında bırakıldı.
TypeScript ve lint son kod incelemesinden sonra tekrar geçti.

Standart `node tools/visual.mjs` kontrolü de denendi; yardımcı araçtaki eski
LaunchSheet / Toast import'u yüzünden çalışmadı. Bunun ardından Vite üzerinden
gerçek `ForceCompare` ve `EscapeReadout` bileşenleriyle bağımsız Playwright kontrolü
çalıştırıldı; `ForceRuler` da aynı kontrolün kapsamına eklendi. API istekleri
engellendi. Ayrıca gerçek `BattleReports` bileşeninde savunan ve saldıran görünümü
Türkçe / İngilizce kontrol edildi. Görseller ve ölçümler
`out/fleet-escape-review/` altında.
