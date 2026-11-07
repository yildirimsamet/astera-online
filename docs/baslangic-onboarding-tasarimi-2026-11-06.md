# Başlangıç galaksisi onboarding'i: inceleme ve yeni tasarım

**Tarih:** 2026-11-06. **Durum:** §9'daki bütün kararlar verildi (owner, 2026-11-06). Uygulama başlamadı; yalnız §9-3 uygulandı.
**Kapsam:** Bayrak açıkken (`STARTER_GALAXY_ENABLED`) hiç oynamamış hesabın ilk açılıştan ana galakside ilk haftasına kadarki yolu.
**Bağlı belgeler:** `baslangic-galaksisi-plani-2026-11-04.md` (K1–K14, A1–A20), `baslangic-oyun-hissi-plani-2026-11-06.md`, CLAUDE.md §4.6.

## 1. Özet

Bugünkü onboarding'in parçaları doğru, ama çoğu **yazı**. Prolog artık oynanan bir sahne. Claim'den sonra ise oyuncuyu tek cümlelik kartlar, bir "Sıradaki" çizgisi ve menüdeki seyir defteri yönlendiriyor. Oyuncuya bir şeyin nerede olduğunu gösteren bir el yok. Bir sistemin açılması bir tören değil. Hikâye de prologdan sonra susuyor.

Yeni tasarımda 3–5 günlük yol **altı perdeye** bölünüyor. Her perdede beş şey var: bir sistem uyanır, oyuncu ilk kez fiziksel bir jest yapar, başka bir komutana dokunur, hikâyeden bir parça açılır ve oturum uçuşta bir şey bırakarak biter. Bütün bunları tek bir **rehberlik katmanı** taşır: Rota çizgisi, El, Uyanış töreni, Seyir defteri, Kilit kapısı ve Dönüş brifingi.

## 2. Bugün ne var, nasıl yapılmış

### 2.1 Katmanlar

| Katman | Ne yapar | Nasıl | Kaynak |
| --- | --- | --- | --- |
| Kapı | Bayrak açıksa prolog, kapalıysa FlightSchool | `capabilities.starterGalaxy` 2,5 sn beklenir | `onboarding/TrainingDoor.tsx` |
| Prolog | Hesap istemeden 5 adımlık sahne. Sırayla: şalter, ocak, toplama, kaynak, sinyal, warp, 3D gemi, claim | Yerel durum makinesi. Ağa gitmez. Gösterilen gövde sunucuya gider | `onboarding/prologue/*`, `world.ts`, `ShipScene.tsx` |
| Claim | Hesap açılır, gemi kurulur | Sunucu gemiyi `STARTER.opening`'den kurar, tarayıcıdan ilerleme kabul etmez | `routes/onboarding.ts`, `services/starter/enlist.ts` |
| Onarım merdiveni | 18 zorunlu ve 11 isteğe bağlı adım; "sıradaki" en uygun zorunlu adım | Saf kural. Önerilen sıra `starter-pacing` testinde oynanır | `rules/starter/ladder.ts` |
| Kademeli açılım | 13 özellik, her biri bir modül aşaması ya da olaydan açılır | Durumdan türetilir. Yalnız "duyuruldu" kaydedilir. Sunucu da kilitler | `rules/starter/features.ts` |
| Olay kapıları | İlk sonda raporu, ilk madencilik dönüşü ve ilk savaş raporu | `facts` | `ladder.ts` |
| Açılış anı | Tek cümle ve "Tamam" | Sırada bekleyen tek özellik gösterilir | `starter/UnlockMoment.tsx` |
| Sıradaki çizgisi | Galaksi üstünde sıradaki tek adım | `shipObjective` (bugün eklendi) | `starter/objective.ts`, `ObjectiveLine.tsx` |
| Seyir defteri | Menüde Güç ve 5 sistem: durum, ne işe yaradığı, "Git" | Bugün eklendi | `starter/ShipLog.tsx` |
| Sekme kilidi | Asma kilit. Basılınca neyin açacağını söyler. Açılan sekmede "Yeni" yazar | Bugün geri geldi | `v2/hud/Dock.tsx`, `starter/gate.ts` |
| Vantage kartı | Hedef galaksi, hikâye ve onarım/yakıt ilerlemesi | Bugün yenilendi | `starter/MainGalaxyRow.tsx` |
| Tehdit sırası | Radar'dan sonra keşifçi, Aegis'ten sonra ilk korsan akını, sonra 18 saatte bir | Yalnız oyundaki oyuncuya | `services/starter/npcRaids.ts` |
| Dönüş | "Sen yokken" özeti ve ücretsiz push (A12) | Gemi notlarından | `services/starter/returnStory.ts`, `push.ts` |
| Göç ve iniş | 3 aday adres, göç sahnesi, iniş kartı, 7 günlük ipucu takvimi | | `MigrationSequence.tsx`, `LandingChoice.tsx`, `landingTips.ts` |
| El kitabı | Menüdeki Akademi beş kuralı gösterir, prolog yeniden oynanır | | `prologue/Handbook.tsx` |

### 2.2 İyi olanlar (korunur)

- **Gerçek oyun, gerçek oyuncular (K4, K9).** Ders yok. Sonda gerçekten komşunun ekranına düşer.
- **Durum okur, tıklama saymaz.** Yapılmış iş tekrar istenmez. Sunucu kilidi gerçektir.
- **Tek seferde tek açılış.** Oyuncu yokken birden çok sistem açıldıysa sırayla gösterilir.
- **İlerleme sunucuda.** Prolog yalnız bir vaattir. Hile yüzeyi yoktur.
- **Kural kaynağı tek.** Ekonomi, savaş ve sonda ana oyunun kurallarıdır. İnişten sonra öğrenilen hiçbir şey çöpe gitmez.

### 2.3 Neden yetmiyor

1. **Rehberlik yazıyla yapılıyor.** "Sonda yolla" deniyor, ama hangi noktaya ve hangi düğmeyle olduğu gösterilmiyor. FlightSchool'daki el (`TutorialHand`, `SchoolPointer`) gerçek oyunda kullanılmıyor.
2. **Açılış anı sönük.** Bir sistemin geri gelmesi oyunun en güzel anı olabilir. Bugün bir kart çıkıyor ve "Tamam"a basılıyor. Gemi yanmıyor, ses yok ve "şimdi dene" çağrısı yok.
3. **Hikâye prologdan sonra susuyor.** Resif, dağılan filo ve sinyalin kimden geldiği bir daha anılmıyor. Oyuncunun "neden yapıyorum?" sorusuna yalnız "motoru onar" cevabı kalıyor.
4. **Olay kapılarına rastlantıyla varılıyor.** İlk sonda raporu, ilk dönüş ve ilk savaş, motoru açan koşullardır. Ama oyuncu bunları bir hedef olarak değil, engel olarak öğreniyor (oyuncu testi A-05, D-03).
5. **Bekleme boşlukları.** İlk 15 dakikada 4 onarım ve ilk sonda yapılıyor; toplam 590 alaşım. Eski 650 açılışla geriye 120 alaşım kalıyordu. Rafineri 3 548 alaşım istiyor ve Rafineri 2 saatte 146,5 üretiyor; yani yaklaşık 2,9 saat bekleniyordu. Bu bekleme 1 saate indirildi (§9-3). Boşluk bir kanca ile kapanmazsa döngü `BUILD → WAIT → COLLECT → UPGRADE` hâline gelir (CLAUDE.md gerileme işareti).
6. **Oturum sonu belirsiz.** Oyuncu ne zaman bırakabileceğini ve dönünce onu ne beklediğini bilmiyor.
7. **Ölçüm yok.** Prologun telemetrisi var. Claim'den sonra hangi perdede kaç oyuncunun düştüğü ölçülmüyor.

## 3. İlkeler

1. **Göster, sonra söyle.** Bir şeyi ilk kez yaparken oyuncu eli takip eder. İkinci kez kendisi yapar. Yazı, elin yerini almaz.
2. **Her açılış bir tören.** Gemi yanar, ses ve titreşim gelir, sistem bir cümleyle ne verdiğini söyler. Ardından "Dene" çıkar ve el gelir.
3. **Hikâye, gerekçeyi taşır.** Her sistemin geri gelişi seyir defterine bir kayıt ekler. Kayıtlar resifin ve sinyalin hikâyesini parça parça açar (MEMORABILITY, CURIOSITY).
4. **Her perde başka bir komutana dokunur.** Sonda, madencilik yarışı, keşifçi, enkaz yarışı, parça yarışı. Kaynak tek başına eğlence değildir.
5. **Oturum uçuşta biter.** Her perdenin sonunda havada bir şey vardır: bir sonda, bir kazıcı, bir onarım. Bir de "dönünce" cümlesi.
6. **Kural, karardan önce gelir.** Aegis'in korsanları getirdiği, saldırı butonu basılmadan önce söylenir. Savaşın neyle kazanıldığı, savaştan önce söylenir (D124).
7. **Atlanabilir ama kaybolunmaz.** El kapatılabilir. Rota çizgisi ise her zaman sıradaki adımı söyler.

## 4. Yapı: altı perde

Süreler, günde iki oturum oynayan oyuncu içindir (`starter-pacing`: 3–5 gün).

| Perde | Ne zaman | Uyanan sistem | İlk kez yapılan (jest) | Başka komutana temas | Hikâye kaydı | Oturumu bitiren kanca |
| --- | --- | --- | --- | --- | --- | --- |
| 0. Prolog | İlk 3 dk | Güç, Rafineri | Şalter, ateşleme, kaynak, warp, sahiplenme | Sinyal (vaat) | "Karanlıkta uyanış" | Hesap |
| 1. Uyanış | 1. oturum, ~15 dk | Keşif anteni 1 → İstihbarat | İlk toplama, ilk onarım (basılı tut), **ilk sonda** (fırlatma) | Komşunun içi okunur, sondan ona düşer | "Yalnız değiliz" | Sonda havada. Sayaç: "Rafineri 3 yaklaşık 1 saat sonra ödenebilir" |
| 2. Tersane | 1. gün, 2. oturum | Tersane → Filo; Anten 2 → Sohbet | **İlk kazıcı** (asteroide gönder) | Aynı asteroide giden başka kazıcı, sohbet | "Filonun kalıntıları" | Kazıcı yolda |
| 3. Gözler | 2. gün | Hangar 2 → Araştırma; Teleskop, Radar | Teleskopla izle, Radar halkası | **Keşifçi** gelir (push: "Radar: biri geliyor") | "Resifin korsanları" | Gelen keşifçi ve "Aegis'i onar" kararı |
| 4. Kalkan ve ilk savaş | 2.–3. gün | Aegis → Savunma; ilk savaş raporu → Saldırı | **Kalkanı şarj et** (basılı tut), tekrarı izle | Korsan akını, enkaz yarışı, karakol | "Sinyali kim gönderdi" | Kalkan dolu, filo onarımda |
| 5. Motor | 3.–4. gün | Döteryum, Motor gövdesi → parça işaretleri | **Parça avı** (enkaz/karakol), yakıt yükle | Parçayı ilk alan götürür. Kalkış panosu | "Atlayışın bedeli" | Parça peşindeki filo |
| 6. Atlayış ve iniş | 4.–5. gün | Göç | **Adresi seç, kolu çek** | Komşular panoda. Ana galakside gerçek rakipler | "Vantage" | İlk hafta: günlük tek ipucu |

Her perdenin açılışı ve kapanışı aynı kalıptadır. Açılışta Uyanış töreni ve seyir defteri kaydı gelir. Kapanışta Rota çizgisi "Şimdilik bu kadar" der, havada olanı gösterir ve dönüş saatini söyler.

## 5. Rehberlik katmanı

Altı parçanın hepsi aynı kaynaktan okur: `shipObjective` + açılan özellikler + `facts` + ilk kez yapılanlar. Hiçbiri tıklama saymaz. "İlk kez" bilgisi durumdan türetilir. Sondası olmayan, sondayı hiç yollamamıştır. Kazıcısı hiç dönmemiş olan, kazıyı hiç yapmamıştır.

### 5.1 Rota çizgisi (var olan "Sıradaki" çizgisinin büyümesi)

- Tek satırda sıradaki adımı, nedenini (bir kelime) ve hedefi gösterir. Örnek: "Keşif antenini onar · İstihbarat açılır".
- Dokunulunca El'i çağırır. Rota yalnız gemiyi açmakla kalmaz, eli doğrudan doğru düğmeye götürür.
- Adım tamamlanınca kendine özgü bir an yaşanır: çizgi parlar, `confirm` sesi çalar, sıradaki adım içeri kayar.
- Perde sonunda "Şimdilik bu kadar" hâline geçer. Havada olanı bir sayaçla gösterir ("Sonda 4 dk · Rafineri 3 ödenebilir: 19:40").
- Bugün var: `ObjectiveLine`. Eklenecekler: neden kelimesi, El tetiği, perde sonu hâli.

### 5.2 El (ilk kez yapılan eylemler)

- FlightSchool'un elini (`TutorialHand`) gerçek oyuna taşır: kaplama yok, kaydırma serbest, yalnız hedefi gösterir.
- **Yalnız ilk kez** çıkar. Liste: ilk toplama, ilk onarım, ilk sonda, ilk kazıcı, ilk teleskop hedefi, ilk saldırı ve ilk yakıt yükleme. İkinci kez çıkmaz.
- Hedef haritadaysa (komşu gemi, asteroit) kamera oraya döner ve hedef halkayla vurgulanır. Gerisi kararır, ama dokunma engellenmez.
- Kapatılabilir. Kapatılırsa Rota çizgisi yine söyler, El bir daha kendiliğinden gelmez.

### 5.3 Uyanış töreni (`UnlockMoment`'in yerine)

1. Kamera 1,2 sn içinde gemide o sistemin bölmesine döner (`VESSEL_BAYS`).
2. Bölme iki kez titreyip yanar. O sistemin ışığı açılır (`vesselLights`). `switch` sesi ve `commit` titreşimi gelir.
3. Kart: sistemin adı ve "çevrimiçi", ne verdiği (tek cümle), **Dene** düğmesi.
4. "Dene" El'i başlatır. "Sonra" yalnız kapatır, Rota çizgisi zaten söyler.
5. Sekmesi olan sistemde sekme "Yeni" ile parlar (bugün eklendi).
6. Oyuncu yokken birden çok sistem açıldıysa tören sırayla gelir. Dönüş brifinginden sonra en fazla iki tören yapılır, kalanlar kart olarak gelir.

### 5.4 Seyir defteri ve telsiz kayıtları

- Menüdeki seyir defteri (bugün eklendi) her bölüme bir **kayıt** ekler. Kayıt 2–3 cümlelik bir hikâyedir, sistem geri geldiğinde açılır ve okunmamışsa nokta taşır.
- Kayıtlar resifin ve sinyalin hikâyesini parça parça açar: filo neydi, neden dağıldı, korsanlar kim, sinyali kim gönderdi, Vantage'da ne bekliyor.
- İsteğe bağlı (owner kararı §9-1): kayıtları okuyan bir **gemi sesi** karakteri. Önce yazı ve ses efekti gelir, seslendirme sonra.

### 5.5 Kilit kapısı

- Kilitli sekmeye basınca bir alt sayfa açılır: neyin açacağı, şu anki aşama ("Tersane: Rafineri 3 ister, 2/3"), tahmini süre ve "Rotaya ekle".
- Kapalı sekmenin içi gösterilmez. Asma kilit vaat eder, sayfa yol gösterir.

### 5.6 Dönüş brifingi

- Bugünkü "Sen yokken" özeti, sırası belli bir brifinge dönüşür: önce olanlar, sonra açılan sistemler (tören), en sonda Rota.
- Her olay tıklanınca kendi yerine gider (raporu açar, kamerayı oraya çevirir).

## 6. Perde ayrıntıları

### Perde 1. Uyanış (ilk oturum, ~15 dk)

1. Claim'den sonra kamera 3D sahneden galaksideki gemiye iner. Gemi ortadadır, Vantage önde ve üsttedir.
2. Rota: "Rafinerinin ürettiğini topla". El, üst çubuktaki havuzu gösterir. Havuzda 60 alaşım vardır (B2). Toplayınca kaynak sayaca akar.
3. Rota: "Rafineri 2'yi onar". El gemiyi açar ve Onar'ı gösterir. Onarım **basılı tutularak** verilir. Kaynak kıvılcımı çıkar ve bölme yanmaya başlar (1 dk).
4. Çıkarıcı 1 ve Keşif anteni 1 verilir (3 dk). Beklerken Rota sayaç gösterir.
5. **Uyanış: Keşif anteni.** Kamera üst çanağa döner, çanak döner ve ışık yanar. "Dene" basılır.
6. El, haritada en yakın komşu gemiyi halkayla gösterir. Oyuncu sondayı **fırlatır**: kısa bir sürükleme ya da basılı tutma, ardından sondanın izi.
7. Sonda havadayken Rota: "Çıkarıcı 2'yi onar" (10 dk) ve "Rafineri 3 · yaklaşık 1 saat sonra ödenebilir".
8. Rapor gelir. Ekran **çözülerek** açılır ve bir kez okunur: "Bu gemi senden önde/geride". Kayıt açılır: "Yalnız değiliz."
9. Perde sonu: "Şimdilik bu kadar. Rafineri 3 19:40'ta ödenebilir, sonra Tersane."

### Perde 2. Tersane

- Tersane ile birlikte 1 Kazıcı ve 2 Ok gelir (bugünkü hediye). Tören hangar kapaklarında yapılır, kapaklar açılır.
- İlk kazıcı: El asteroidi gösterir. Gönderme ekranında yalnız kazıcı seçilidir. Yük, süre ve risk tek satırdır.
- Dönüş: yük havuza iner ve toplama anı tekrar yaşanır. Böylece enkaz alanları açılır.
- Anten 2: sohbet açılır. Galaksi kanalında "yeni geldin" karşılaması olur (sohbetteki bütün komşular oyuncu gibi görünür).

### Perde 3. Gözler

- Teleskop: El bir komşuyu izlemeye almayı gösterir. Kalkışını bir izle görürsün.
- Radar: halka açılır. Kısa süre sonra **keşifçi** gelir. Push: "Radar: bir uçuş sana geliyor." Keşifçi bakar ve gider. Rota: "Bir dahakine yalnız gelmeyebilir. Aegis'i onar."
- Aegis kartı satın alınmadan önce korsanları getirdiğini söyler (oyuncu testi D-01, çözüldü).

### Perde 4. Kalkan ve ilk savaş

- Aegis onarımı bitince **kalkanı şarj et**: basılı tutulur, gemi çevresinde kalkan kabuğu belirir, `ignite` sesi çalar.
- İlk korsan akını, filonla denk büyüklükte gelir. Radar uyarısı ve push gider.
- Savaştan sonra rapor kendiliğinden tekrarı oynatır. Kural satırı tek cümleyle gösterilir (tempo, kalkan, sınıflar).
- Saldırı açılır. El bir karakolu gösterir. Karakol kartı ödülü, muhafızı ve yeniden dolma süresini gösterir.
- Kayıt: "Sinyali kim gönderdi" (merak kancası, Perde 6'da kapanır).

### Perde 5. Motor

- Motor gövdesinin şartları seyir defterinde tek tek işaretlenir.
- Parça işaretleri haritada belirir. "İlk varan alır" kuralı karar anında, kartın üstünde yazar. Kalkış panosu kimin yaklaştığını gösterir.
- Döteryum 2 ve yakıt: **yakıtı pompala**. Basılı tutulur, tank dolar.

### Perde 6. Atlayış ve iniş

- Göç anı bugünkü sahnedir: 3 adres, kol ve göç animasyonu. Bu sahne törenin en büyüğüdür.
- İniş kartı: neyin taşındığı, 72 saat kalkan ve "3 gün girmezsen gezegen silinir".
- İlk hafta: günde tek ipucu (`landingTips`). Seyir defteri gemiyle birlikte biter. Son kaydı "Vantage" olur ve inişte okunur (§9-5).

## 7. Jest ve his kataloğu

Her satır aynı üç cevabı verir: ses (`lib/sound`), titreşim (`haptic`) ve görsel.

| An | Jest | Ses | Titreşim | Görsel |
| --- | --- | --- | --- | --- |
| Toplama | Havuza dokun | `cargo` | `commit` | Kaynaklar sayaca uçar |
| Onarım ver | Basılı tut | `weld` | `tap` → `commit` | Kıvılcım, bölme ışığı başlar |
| Onarım biter | — | `switch` | `thunk` | Uyanış töreni |
| Sonda fırlat | Basılı tut, sonra bırak | `warp` (kısa) | `warp` | Sonda izi, kamera bir an takip eder |
| Rapor gelir | Dokun | `confirm` | `tap` | Rapor çözülerek açılır |
| Kazıcı gönder | Basılı tut | `launch` | `commit` | Kazıcı kalkar, yörünge izi |
| Keşifçi geliyor | — | `alert` | `warn` | Radar halkasında kırmızı iz |
| Kalkanı şarj et | Basılı tut | `ignite` | `rumble` | Kalkan kabuğu kapanır |
| Savaş | Tekrarı izle | savaş sesleri | vuruşta `tap` | Tekrar |
| Yakıt yükle | Basılı tut | `ignite` (alçak) | `rumble` | Tank göstergesi dolar |
| Atlayış | Kolu çek | `warp` | `warp` | Göç sahnesi |

Yeni sesler `synth.ts` ile üretilir: `launch`, `decode`, `shield` (owner kararı §9-6). Başka dosya indirilmez.

## 8. Ölçüm

Her perde için iki olay tutulur: açıldı ve tamamlandı. Süreleri ölçülür, düşüş noktası görülür. Bugünkü `vesselAnalytics` ve `prologueTelemetry` genişletilir.

| Olay | Anlamı |
| --- | --- |
| `starter_act_started` / `starter_act_completed` | Perde 0–6 |
| `starter_first_action` | İlk toplama, onarım, sonda, kazıcı, saldırı, yakıt |
| `starter_hand_shown` / `starter_hand_dismissed` | El yardımcı oluyor mu |
| `starter_return` | Dönüş, perde ve aradaki saat |

Hedef: Perde 1'i bitirenlerin oranı, D1 dönüşü ve Perde 6'ya ulaşanların oranı.

## 9. Owner kararları (2026-11-06)

1. **Gemi sesi karakteri:** Evet. Önce yazı ve ses efekti gelir, seslendirme sonra.
2. **Perde ödülü:** Hayır. Ödül, açılan sistemin kendisidir.
3. **İlk oturumdan sonraki bekleme:** Yaklaşık 1 saat olur. İlk sonda dahil ölçülen bekleme 2,9 saatti. Yalnız geminin açılış stoğu değişti, 650 → 930 alaşım. Onarım fiyatları ana oyunun bina fiyatlarıyla aynı kaldı, üretim formülü de ortak kaldı; ana galaksi etkilenmez. Test: `starter-first-session` (uygulandı).
4. **İlk sondanın hedefi:** Karar bana bırakıldı. El en yakın komşuyu gösterir, oyuncu başka birini seçebilir.
5. **Ana galakside devam:** Hayır. Seyir defteri gemiyle birlikte biter; ana galakside bu kurgu yoktur ve tekrara dönerdi.
6. **Yeni sesler:** Koddan üretilir (`synth.ts`). Owner beğenmezse ses dosyası bulur.
7. **FlightSchool:** Silinmez, gizlenir. Kod bir süre kalır.

## 10. Uygulama fazları

Her faz TDD ile yapılır: kural testi, ekran testi, 350 px görsel kontrol, ses ve titreşim elle denenir. Değişen her metin 6 dilde yazılır.

| Faz | İçerik | Ana dosyalar | Doğrulama |
| --- | --- | --- | --- |
| O1 | "İlk kez" türetimi ve perde durumu (saf kural) | `rules/starter/acts.ts` (yeni) | Her perde ve ilk kez eylem için kural testi |
| O2 | Rota çizgisi: neden kelimesi, perde sonu hâli, El tetiği | `starter/objective.ts`, `ObjectiveLine.tsx` | Bileşen testi |
| O3 | El'in gerçek oyuna taşınması ve hedef kayıt noktaları (`data-guide`) | `onboarding/TutorialHand.tsx`, hedef bileşenler | El her ilk kez eylemde doğru hedefi bulur |
| O4 | Uyanış töreni: kamera, bölme ışığı, kart, "Dene" | `starter/UnlockMoment.tsx` → `Awakening.tsx`, `GalaxyCanvas` kamera | Tören sırası ve tek tek gösterim testi |
| O5 | Seyir defteri kayıtları (hikâye) ve okunmadı noktası | `starter/ShipLog.tsx`, 6 dil | Kayıt açılma testi |
| O6 | Kilit kapısı alt sayfası | `v2/hud/Dock.tsx`, `starter/gate.ts` | Sayfa testi |
| O7 | Jestler: sonda fırlatma, kazıcı, kalkan, yakıt; yeni sesler | `lib/synth.ts`, ilgili ekranlar | Ses ve jest testleri |
| O8 | Dönüş brifingi sırası | `AwayHost`, `returnStory.ts` | Sıralama testi |
| O9 | Ölçüm olayları | `vesselAnalytics.ts`, sunucu analitik | Olay testi |

Sıra: O1 → O2 → O3 → O4 ilk oturumu (Perde 1) tamamlar ve önce telefonda oynanır. Ardından O5–O9 gelir.

**Durum (2026-11-06, commit edilmedi):** O1–O4 yapıldı. Uygulamada farklılaşan noktalar:

- **O1:** Perde takibi O9'a, ölçümle birlikte taşındı. "İlk kez" bilgisi şimdilik cihazda tutuluyor (`astera.guide.learned`).
- **O2:** İlk sonda ve ilk maden, sistemleri açılır açılmaz istenir (`objective.ts`). En yakın komşu `starter/neighbour.ts` ile bulunur.
- **O3:** El `starter/guide.ts` ve `GuideHand.tsx` içinde. Hedefler `works`, `objective`, `repair-order` ve `probe`.
- **O4:** Tören `UnlockMoment.tsx` içinde kaldı; ayrı bir `Awakening.tsx` gerekmedi. Kamera eve döner, bölme `OwnVessel` içinde üç kez atar. Yükleme ekranı kalkana kadar bekler.

**Güncelleme (2026-11-06, owner kararları):** O3'teki serbest el kaldırıldı. Yerine FlightSchool NPC'siyle **sıkı ve atlanamaz** bir eğitim geldi (`starter/tutorial/`).

- **Kartlar:** `SchoolCoach`, `SchoolPointer` ve `useGate` kullanılıyor. Çıkış tuşu yok.
- **İlk dört onarım:** 10 sn, 10 sn, 30 sn ve 60 sn. Ekonomi değişmedi.
- **İlk oturumun yolu:** uyanış → topla → Rafineri 2 ve Ekstraktör 1 → anten ve Ekstraktör 2 → "Dene" → en yakın gemiye sonda → İstihbarat'ta rapor → kasalar ve onarımlar → ilk Kazıcı dönüşü → veda.
- **Dönüş:** ikinci bölüm, Rafineri 3 parası birikince başlar: tekrar hoş geldin → topla → Rafineri 3 → kapanış.
- **Adım belirleme:** Adımlar gemi durumundan bulunur, cihazda yalnız okuma ve basma onayları tutulur.
- **Diğer sayfalar:** Eğitim konuşurken dönüş hikâyesi ve hatırlatmalar bekler.


### Yayın A rehber güncellemesi — 2026-11-06

§9-3'ün eski kaynak bekleme/veda yeri, ilk deneyim planı §6.1–§6.3 ile değişti.
Bölüm 5: kazanılan kasalar → Rafineri 3 → Depo 1 → rafineri kasası → Tersane 1 → tersaneyi bekle → tersane kasası → havuzu topla → Ocak 3.
Bölüm 6: en yakın asteroide ilk Kazıcı → uçuşu izle → dönüş ganimetini topla → veda.
Rehber 6 bölümdür. Veda kalan uçuşun dönüş saatini ve sıradaki onarımın tahmini ödeme süresini söyler.
Sonrasında kapı yoktur: sistem açılışı ve adım bariz değilse oturumda tek, dokunarak kapanan kart.
Native push izni vedada sunulur; ret sonrası yeni ≥15 dk onarımda tek tekrar vardır.
4 sn bulunamayan işaret ve 90 sn aşan bekleme kapıyı serbest bırakır; `blocker_visible` kaydedilir.
Adım görünürlüğü `training_scene_visible`, `trainingVersion: starter-tutorial.v1`, `scene: adım kimliği` ile ölçülür.
