# Savaş sonucu, rapor ve bildirim düzeltme planı

Tarih: 15 Ekim 2026. Durum: kullanıcı onayıyla master üzerinde uygulandı; genel doğrulama sürüyor.
Kullanıcı sınırı: production üzerinde düzenleme, güncelleme, deploy veya veri düzeltmesi yok.
Bu çalışma yalnız salt okunur production sorguları, kaynak incelemesi, yerel fonksiyon çağrıları ve mevcut testleri çalıştırdı. Bu dosya yerel inceleme çıktısıdır.

## 1. Gereksinim ve doğrulanmış vaka

Oyuncu savaşın sonucunu, kendi kaybını/kazancını ve filonun neden döndüğünü anlayabilmeli.
Rapor, rapor listesi, bildirim ve renk aynı olayı çelişkili anlatmamalı.
Savaş derecesi, anıt kontrolü, kişisel filo kaybı ve puan değişimi ayrı gerçeklerdir.

Production sürümü: `efa8f8363f95edde1a7ee39c8620baaa83e64fd5`; API/worker image revision ve yayımlanan web release aynıydı.
Yerel çalışma ağacında henüz yayımlanmamış Honor/bakım/radyasyon değişiklikleri bulunuyor; bunlar production davranışı diye sunulmadı. Uygulama mevcut yerel çalışmaları korumalı ve eski production payload'larıyla uyumlu olmalı.

Atakan34100 / anıt 4 / savaş `57ca7390-373f-44bc-bedd-02260e82660a`:

- 15 Ekim 16:02:37.112 Türkiye saati: 2 Korsan + 1 Argosi, Mr_Ged'in 1 Korsan + 1 Argosi filosuna saldırdı.
- Savunan Korsan 2. turda öldü. Kargo koruması nedeniyle Argosi yalnız 3. turda vuruldu.
- Argosi yaklaşık %0,589 canla yaşadı. Savaş `REPELLED`, kontrol `DEFENDER`; saldıranın 3 gemisi de yaşadı.
- Kalıcı imha değeri: Korsan 7.040 / toplam 21.405 = %32,8895. Mevcut `PARTIAL` eşiği %42; hasarlı yaşayan Argosi imha sayılmıyor.
- Atakan +7.040 Hâkimiyet aldı; filo `DEFEAT` dönüşüne geçti, 16:23:26.420'de eve vardı.
- Savunan Argosi 16:04:26.803'te radyasyonda öldü. Bu sonraki olay savaş sonucunu değiştirmiyor.
- Her iki tarafın savaş bildirimi mevcut. Atakan'ın savaş/dönüş/iniş bildirimleri incelemede `seen=true` idi. Bu değer oyuncunun metni gerçekten okuduğunu kanıtlamaz.

## 2. Kanıt ve benzer durumlar

15 Ekim yaklaşık 17:46 Türkiye saati salt okunur veritabanı kesiti, saklanan anıt kayıtları:

| Doğrulama | Sayı / sonuç |
| --- | --- |
| Anıt savaşı katılımcı kaydı | 372 |
| Eşleşen `raid_result` bildirimi olmayan katılımcı | 0 |
| Saldıran, `REPELLED`, kontrol savunanda, pozitif puan, sağ kalan var | 8 |
| Savunan, aynı tür sonuç, kontrolü korumuş ama negatif puan | 8 |
| Saldıran, `REPELLED`, kontrol savunanda, puan 0, sağ kalan var | 3 |
| Saldıran, `DECISIVE`, kontrol `EMPTY`, sağ kalan var | 2 |
| Saldıran, `PARTIAL`, kontrol savunanda | 3; puan işareti - / 0 / + için birer kayıt |

Atakan daha önce savunan tarafta da aynı durumu yaşamış: 15 Ekim 04:21:41.988 Türkiye saati, Vantasia saldırısı, savaş `e8d6ed84-2958-4fbb-a17f-a71ce42fe382`; kontrol korunmuş, Korsan kaybından -7.040 puan yazılmış.

1 Ekim'den sonraki, anıt olmayan saklanan bildirimlerde:

- `raid_result`: 34 püskürtülmüş saldırıda sağ kalan filo var; bugünkü sınıflandırıcı bu sonuçları `win` yapıyor.
- `raid_result`: 10 negatif Hâkimiyetli saldırıda sağ kalan filo var; sınıflandırıcı puanı dikkate almıyor. Bu grup önceki grupla örtüşebilir; sayılar toplanmamalı.
- `raided`: 77 `REPELLED` kayıt var; savunanın başarılı savunması da olay türü nedeniyle `loss` rengine gidiyor. Saldırı uyarısının önem derecesi ile tamamlanmış savaşın sonucu karışıyor.
- Tamamen yok olan destekçinin tarafı saldırıyı püskürtürse destek bildiriminin `win` olması yerel geçerli payload ile doğrulandı; bu örnek production sayımında bulunmadı.

Yerel mevcut fonksiyonlara verilen geçerli payload'larla doğrulanan çıktılar:

| Durum | Bugünkü çıktı | Sorun |
| --- | --- | --- |
| Atakan vakası | `win`, alarm değil | Kontrol alınamaması ve puan kazanımı tek olumlu renge indirgeniyor. |
| Anıt kontrolünü koruyup puan kaybetmek | `loss` | Başarılı savunma ile ekonomik kayıp ayrı anlatılmıyor. |
| Anıt `DECISIVE + EMPTY`, kargo sağ kalmış | `win` | Kontrol alınmamışken zafer rengi. |
| Anıt püskürtülmüş, puan 0, filo yaşıyor | `win` | Puan kazancı dahi olmadan zafer rengi. |
| Gezegen/korsan saldırısı püskürtülmüş, filo kısmen dönüyor | `win` | Raporun püskürtülme hükmüyle bildirim rengi çelişiyor. |
| Gezegen savunması püskürtmüş, kendi kaybı 0 | `loss` | Başarılı savunma kırmızı sonuç gösteriliyor. |
| Destek filosu tamamen yok, savunma tarafı püskürtmüş | `win` | Taraf başarısı kişisel filonun yok olmasını örtüyor. |

## 3. Kök nedenler ve doğruluk sınırları

1. `notifications.ts`: anıtta `isAlarming` yalnız sıfır sağ kalan veya negatif Hâkimiyet arıyor. Diğer raid sonuçlarında yalnız sıfır dönen gemiye bakıyor. `signalFamily` ardından `signalOutcome` bu sınıfları sonuç gibi yorumluyor. Böylece aciliyet, tehdit kategorisi, ekonomik sonuç ve savaş sonucu birbirine bağlanmış.
2. `MonumentReportSheet.tsx` ve `BattleReports.tsx` anıt satırı `grade` alanını göstermiyor. Kontrol cümlesi oyuncuya göre özelleşmiyor. `EMPTY` metni bütün fiziksel durumları yeterince anlatmıyor.
3. Anıt raporunda üç tur sınırı, kargo koruması ve kısmi derece eşiğinin imha edilmiş kaynak değeri olduğu açıklanmıyor. Bu kurallar genel Wiki'de kısmen var; anıt gönderiminde karar noktasına yeterince taşınmıyor.
4. `HudDock.tsx`, `active === 'intel'` iken bütün rapor bildirimlerini okundu işaretliyor. `IntelScreen.tsx` varsayılan olarak `watch` rafını açıyor; `reports/probes` rafında da savaş listesi gizli olabiliyor. Rapor isteği başarısız olsa bile dock görünürlüğe veya başarıya bakmıyor. Bu davranış mevcut testte özellikle sabitlenmiş; test değişikliği de gerekir.
5. `useLiveAlerts.ts`: ilk yüklemede geçmiş uyarıları göstermemek ve toplu uyarıyı üçle sınırlamak bilinçli davranış. Ancak ayrıştırılamayan satır da üç slotu tüketebiliyor. İstihbaratın erken okundu işaretlemesi ile geçici uyarı filtresinin etkileşimi entegrasyon testi gerektiriyor.

Atakan'ın tarayıcı oturumu kaydedilmediği için geçici uyarıyı neden görmediği kesinleşmedi. Bu plan erken okundu işaretleme ve sonuç sunumundaki doğrulanmış kusurları düzeltir; orijinal olayın bildirim eksikliğini kanıtlanmış gibi sunmaz.

## 4. Düzeltilecek davranış

### Tek sonuç yorumlama, ayrı anlamlar

Web içinde küçük, saf ve tipli bir sonuç yorumlayıcısı kurulacak; mevcut rapor ve bildirim alanlarını kullanacak. Rapor listesi, detay ve bildirim aynı karar tablosunu kullanacak. Yeni bir savaş motoru veya puan hesabı olmayacak.

- Ana sonuç: anıtta oyuncunun tarafına göre kontrol; normal akında saldıran/savunan açısından mevcut `grade`.
- Çatışma derecesi: anıtta da ayrı, mevcut `DECISIVE / PARTIAL / REPELLED` verisiyle. Savunanın gördüğü derece saldıranın derecesidir; ters çevrilmiş metin kullanılmalı.
- Kişisel bedel: kayıplar, sağ kalanlar, tamamen yok olan filo. Ortak taraf kazansa bile kişinin filosu yok olduysa açık kayıp uyarısı.
- Puan ve ganimet: kendi işaretli satırları. Pozitif Hâkimiyet kontrol başarısızlığını zafer yapmayacak; negatif Hâkimiyet korunmuş kontrolü kaybedilmiş gibi anlatmayacak.
- Aciliyet ayrı kalacak. Başarıyla savunan bir oyuncuya saldırı olması hâlâ önemli olabilir; kırmızı tehdit ikonu genel sonuç yenilgisi sayılmayacak.

### Sonuç ve renk tablosu

| Durum | Gösterilecek ana bilgi / görünüm |
| --- | --- |
| Anıt saldıranı, `ATTACKER` | “Tarafın anıtın kontrolünü aldı.” Başarı. Kişisel tam filo kaybı varsa ayrıca belirgin kayıp uyarısı. |
| Anıt savunanı, `DEFENDER` | “Tarafın anıtın kontrolünü korudu.” Başarı; kendi kayıp ve negatif puan ayrıca. |
| Anıt saldıranı, `DEFENDER + PARTIAL` | “Anıt ele geçirilemedi.” Altında “Çatışma: kısmi başarı.” Kısmi görünüm; tam zafer yeşili değil. |
| Anıt saldıranı, `DEFENDER + REPELLED` | “Anıt ele geçirilemedi. Saldırı püskürtüldü.” Başarısız hedef; pozitif puan kendi satırında. |
| Anıt savunanı, `ATTACKER` | “Tarafın anıtın kontrolünü kaybetti.” Kayıp. |
| Anıt `EMPTY`, sağ kalan var | “Savaş sonunda anıtı hiçbir taraf kontrol etmiyor.” Taraf/kişisel duruma uygun nötr veya kayıp; `DECISIVE` otomatik ele geçirme olmayacak. |
| Normal saldıran, `DECISIVE / PARTIAL / REPELLED` | Mevcut rapor hükmüyle aynı başarı / kısmi / başarısızlık metni ve tonu. Puan işareti ayrı. |
| Normal savunan, `REPELLED` | Saldırıyı püskürttü; sonuç başarı. Olayın tehdit ikonu/aciliyeti bundan bağımsız. |
| Destekçi, taraf kazandı ama kendi filo tamamen yok | “Savunma hattı saldırıyı püskürttü. Destek filonun tamamı yok oldu.” Kişisel kayıp belirgin. |

Kısmi görünüm mevcut UI renkleriyle ayrı etiket taşıyacak; yalnız renk bilgi vermeyecek. Genel bildirim sisteminin bütün olaylarını yeniden sınıflandırmak yerine savaş olayları için açık karar verilecek. `win` enum adı oyuncuya yazılmayacak.

### Rapor ve karar desteği

- Anıt listesi ve detayda ana kontrol sonucu, çatışma derecesi, kendi kayıp/sağ kalan, doğrulanan düşman imhası ve puan birlikte okunacak.
- Atakan örneği: “Anıt ele geçirilemedi. Saldırı püskürtüldü. Doğrulanan düşman kaybı: 1 Korsan. Senin kaybın: 0. Hâkimiyet: +7.040.”
- Kısa kural: savaş en fazla `COMBAT.rounds` tur; savaş gemileri yaşarken kargo korunur; anıt için savunmanın tamamı temizlenmeli ve saldıran tarafta savaşabilecek gemi kalmalı. Kargo mevcut kontrolü sürdürebilir.
- Detayda `PARTIAL` için imha edilen kaynak değerinin `COMBAT.partialThreshold` eşiği açıklanacak. Yaşayan hasarlı gemi imha sayılmaz. Bu açıklama “3 tur” veya “%42” kopyasını farklı yerlere sabitlemek yerine ortak sabitlerden üretilecek.
- Rapor tek başına filonun şu an HOLD/dönüş/evde olduğunu söylemeyecek. Kazanan da kapasite nedeniyle dönebilir; bireysel kayıp ile taraf kontrolü farklı olabilir.
- Sonraki radyasyon ölümü ayrı zamanlı olaydır. Geçmiş savaş raporu bugünkü kontrol veya filo durumuyla yeniden yorumlanmayacak.
- Düşman sağ kalan sayısı, türü, canı, toplam başlangıç değeri veya kesin %32,89 oranı oyuncu payload'ına eklenmeyecek. Bu incelemedeki operatör verisi oyun içi istihbarat yetkisi değildir.
- Mevcut alanlarla açıklanabilen ilk düzeltme için DB migrasyonu/API genişletmesi gerekmiyor. Eski raporların nedenini kesin açıklayacak veri yoksa mekanik kural anlatılacak; “kargo kaldı”, “süre doldu” gibi olay nedeni uydurulmayacak.

### Bildirimin okunması ve gösterilmesi

- `HudDock` içindeki genel İstihbarat sayfası açıldı diye yapılan okundu mutasyonu kaldırılacak; dock yalnız rozet hesabı yapacak.
- Okundu işlemi başarılı veriyle gerçekten görünür olan savaş/sonda listesine veya açılan tek rapora taşınacak. `watch`, `radar`, gizli sekme, arka plan belge, yüklenme ve API hatası raporu okumuş sayılmayacak.
- Bildirim `refId`si raporun gerçek id/mission/pirate/support ilişkisiyle eşleştirilecek. Bildirim limitine sığmayan veya rapor limitinin dışındaki satırlar görülmüş varsayılmayacak. Tek rapor açılması diğerlerini tüketmeyecek.
- Çan için mevcut açık feed okuma davranışı korunacak; rapor yolundaki daraltma bütün geçmiş bildirimleri yeniden okunmamış yapmayacak.
- Geçici uyarı sırasına yalnız metni üretilebilen satırlar girecek; sonra öncelik ve üç slot sınırı uygulanacak. Bilinmeyen satır geçerli savaşı slot dışına itmeyecek.
- İlk oturumdaki geçmiş uyarıları topluca göstermeme ve SSE tekrarında çift uyarı vermeme davranışları korunacak. Yeni gelen savaş ve açık rapor/İstihbarat görünürlüğü yarışları gerçek QueryClient ile test edilecek.

## 5. TDD uygulama sırası ve dosyalar

1. **Önce başarısız regresyonlar:** Atakan payload'ı, savunan perspektifi, `EMPTY`, normal püskürtülmüş saldırı, başarılı savunma, yok olan destekçi ve gizli İstihbarat sekmesinin okundu mutasyonu. Bugünkü davranışla FAIL kanıtı alınacak.
2. **Saf sonuç yorumlayıcısı:** `apps/web/src/lib/battleOutcome.ts` (önerilen yeni dosya); `notifications.ts`, `BattleReports.tsx`, `MonumentReportSheet.tsx` ortak kararları kullanacak. Mevcut `isUrgent` ile sonuç rengi ayrılacak. Mevcut raporun tam filo kaybı istisnaları korunacak.
3. **Okunma akışı:** `HudDock.tsx`, `IntelScreen.tsx`, rapor listesi/kapısı ve gerekiyorsa küçük ortak hook; `useLiveAlerts.ts` geçerli metin filtresi. `useMarkSeen` API ve idempotent sunucu davranışı korunacak.
4. **Metin ve tasarım:** altı mevcut dilde bildirim/rapor/anıt metinleri, `MonumentSheet.tsx` karar noktasındaki kısa kural, `wiki/galaxy-content.ts` ve ilgili ortak gerçekler. `docs/ux-writing.md` uygulanacak. Honor bulunan yerel raporlarda Hâkimiyet ve Şeref ayrı kalacak.
5. **Hedefli PASS, review, geniş doğrulama:** saf kuralların değişmediği, bildirim/rapor uyumu, gizli veri sınırı ve tarihi kayıtların okunabilirliği doğrulanacak. Sonrasında sırayla typecheck/lint ve olağan testler.

Sunucu dosyaları varsayılan olarak düzeltme hedefi değil. `monumentReports.ts`, `monumentArrival.ts`, `defenderLine.ts`, `worker/handlers.ts`, `pirateRaid.ts` gerçek payload sözleşmesini doğrulamak için test kapsamındadır. Yeni bir veri alanı kaçınılmaz çıkarsa önce contract testi FAIL ve gizlilik/geriye uyumluluk incelemesi yapılır.

## 6. Zorunlu test matrisi

- Anıt: saldıran/savunan × `ATTACKER/DEFENDER/EMPTY` × geçerli `grade` × puan negatif/sıfır/pozitif; yalnız gerçekten mümkün kombinasyonlar başarı diye yorumlanmalı, bozuk payload güvenli biçimde ele alınmalı.
- Kişi/taraf ayrımı: ortak saldırıda kişinin bütün gemileri yokken tarafın kazanması; savunma korunurken tek destekçinin yok olması; şahıs ve klan kontrolü.
- Kargo: tek kargonun savunma kontrolünü koruması; saldıranın yalnız kargoyla kalıp ele geçirememesi; boş hedefe yalnız kargo varışı; puan 0 olan nötr garnizon savaşı.
- Hasar: yaralı yaşayan gemi imha değildir; %42'nin altı/tam eşiği/üstü; sıfır tur/erken bitiş/azami tur; karşılıklı imha; yerel bakımda savaşamayacak gemiler. RNG veya statlar bu sunum düzeltmesinde değişmeyecek.
- Dönüş: galibiyet sonrası kapasite dönüşü, yenilgi sonrası dönüş, yolda radyasyon kaybı, savaşta sağ kalan geminin sonradan ölmesi. Rapor savaş anını korumalı, iniş bildirimi inişi doğrulamalı.
- Normal savaşlar: gezegen/korsan püskürtülmüş ama sağ kalan var; kısmi başarı; kesin zafer ama kişi filosu yok; başarılı savunma; negatif puanlı başarı ve pozitif puanlı başarısız hedef; escape, salvage, capture ve kargo sınırı mevcut açıklamalarını korumalı.
- Görünürlük: `watch`, `radar`, sonda sekmesi, gizli savaş sekmesi, rapor API hatası, bildirim önce/rapor sonra, tek rapor açma, kayıt limiti, arka plan belge, başarısız mark-seen retry ve desktop/mobile aynı cache.
- Uyarı: ilk snapshot, sonraki yeni savaş, reconnect, aynı id tekrar yayını, üçten fazla olay, geçersiz payload'ın geçerli savaş slotunu tüketmemesi, okundu mutasyonu/uyarı sıralaması.
- Sözleşme: geçmiş production payload'ı, opsiyonel eski alanlar, fraksiyonel BP hasarı, bilinmeyen tür; rakip canlı filo/HP bilgisi sızmamalı. Veri olmadığı durumda sıfır veya kesin neden uydurulmamalı.
- Görsel: TR/EN 350 px ve desktop; uzun anıt/klan adı; başarı/kısmi/başarısızlık/kişisel tam kayıp durumları. Durum metin ve ikonla anlaşılmalı, renge bağlı kalmamalı. `node tools/visual.mjs` yalnız izole yerel test ortamında.

Test hedefleri: web `monument-news`, `signals`, `battle-report-cases`, `battle-report-clarity`, `notification-routes`, `clan-support-report`, `v2/hud-dock`, `v2/bell-rules`; yeni `battle-outcome` ve `live-alerts` regresyonları. Sunucu `monument-reports`, `monument-arrival`, `notifications`, `contract`; rules `monument-combat`, `maintenance-combat` ve mevcut grade sınır testleri.

Çalıştırma sıralı, tek workspace/worker: `nice -n 10`, `--maxWorkers=1 --minWorkers=1 --no-file-parallelism`. Node heap en fazla 4 GiB. Ekonomi/sezon simülasyonları ve snowball audit bu işin kapsamında değil.

## 7. Riskler, mevcut doğrulama ve bitiş ölçütü

- Paylaşılan bildirim yardımcıları çok sayıda olayda kullanılıyor. Sadece savaş sonuçları hedeflenmeli; stratejik saldırı, maden, konvoy, colony ve unlock semantiği korunmalı.
- Savunan açısından derece ters okunur. Ortak tarafın başarısı bireysel kaybı gizlememeli; puan yönü de başarı/yenilgi yerine geçmemeli.
- `hidden` listeler mount edilmiş olabilir; yalnız component mount etmek okuma kanıtı değildir. React Query optimistic `seen` değişimi geçici uyarıyı düşürebilir; bunu entegrasyon testi yakalamalı.
- Geçmiş kayıtların eksik alanları ve henüz yayımlanmamış Honor/bakım değişiklikleri uyumluluk riski. Production olayı ve yerel yeni kurallar ayrı fixture'larla korunmalı.

Bu plan hazırlanırken mevcut beş web dosyasının **75 testi geçti** (`monument-news`, `signals`, `battle-report-cases`, `clan-support-report`, `v2/hud-dock`). Bu bir düzeltme kanıtı değildir: bazı testler sorunlu eski davranışı zaten sabitliyor. Önceki incelemede `monument-combat` 13 testi de geçmişti. Yeni regresyon testleri ve implementation henüz yazılmadı.

Bitiş: Atakan ve yukarıdaki karşı örneklerde liste/detay/bildirim aynı kontrol ve dereceyi anlatır; puan kendi satırında görünür; kısmi başarı gerçekten `PARTIAL` olan vakada belirtilir; görülemeyen rapor okundu sayılmaz; yeni uyarı ve tekrar teslim testleri geçer; gizli rakip verisi açılmaz; olağan doğrulama ve yerel görsel kontrol tamamlanır. Production'a deploy veya veri müdahalesi bu planın hiçbir adımında yoktur.


## 8. Uygulama kaydı

Kullanıcı 15 Ekim'de “Tamam başla, masterda çalış” talimatını verdi. Master korundu; production üzerinde değişiklik yapılmadı. Önceden mevcut Honor/bakım/radyasyon çalışmalarının içeriği korunarak ilerleniyor. Seçili dosyaların başlangıç kopyaları `/tmp/astera-battle-presentation-baseline-20261015` altında tutuldu; Git diff içindeki bütün değişiklikler bu göreve ait değildir.

- Önce kırmızı regresyonlar: `battle-outcome` 14 FAIL; anıt derece/rule ve dock 2 FAIL; geçersiz payload'ın uyarı slotu tüketmesi 1 FAIL. Okuma hook'u başlangıçta mevcut değildi.
- Ortak `battleOutcome` ve tipli tonlar eklendi. Bildirim, rapor satırı/detayı ve ReportScene aynı sonucu kullanıyor. Kısmi sonuç ayrı görünüm taşıyor; kişisel tam kayıp taraf başarısının altında gizlenmiyor.
- Anıtın kontrolü, çatışma derecesi ve kendi puanı ayrı gösteriliyor. Altı dilde metin ve ortak `MonumentBattleRules` eklendi; sayılar doğrudan COMBAT'tan alınıyor. Olay incelemesindeki rakip HP/filo ayrıntıları istemciye açılmadı.
- İstihbarat dock'undaki toplu okundu mutasyonu kaldırıldı. Görünür başarılı rapor/sonda yüzeyi yalnız gösterdiği referansları okundu yapıyor. Görünmeyen sekme, arka plan belge, API hatası ve tek raporun arkasındaki diğer kayıtlar korunuyor. Destek raporu rozete dahil edildi.
- Gezegen sondası payload'ına oyuncunun kendi `missionId` alanı eklendi; istemcide opsiyonel. Eski sunucuyla eşleşmeyen eski sonda raporu okunmuş varsayılmaz, çandan okunabilir. Migrasyon gerekmiyor. Gerçek `/api/intel` contract testi önce FAIL ile alan eksikliğini gösterdi.
- `useLiveAlerts` yalnız anlatılabilen satırları slot hesabına alıyor; ilk snapshot, tekrar teslim ve üç slot limiti korunuyor.
- Kaynak kapsamı dışındaki iki mevcut lint hatası davranış korunarak giderildi: FocusPanel opsiyonel vacation boolean'ı açık `false` varsayıyor; PlanetScreen submit callback'i void gövdesi kullanıyor. İlgili mevcut çalışmalar silinmedi.
- Hedefli son ek testler: 33 PASS. Önceki geniş tekrar kontrolü: 121 PASS. Tüm workspace'lerin sıralı tip kontrolü ilk geçişte PASS. Son koddan sonra genel doğrulama sonuçları ayrıca kaydedilecek.
- Yerel gerçek bileşenlerle 350/1188 px, TR/EN ve beş anıt senaryosu: 20 görünüm, 40 ekran görüntüsü; yatay taşma ve tarayıcı hatası yok. Kanıt: `out/battle-outcome-2026-10-15/verification.json`. Atakan, kısmi başarı ve savunan görselleri ayrıca incelendi. Standart `node tools/visual.mjs ... --battle-reports` koşusu da ayrı çalıştırılıyor.
