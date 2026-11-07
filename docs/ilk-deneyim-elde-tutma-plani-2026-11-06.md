# İlk Deneyim ve Elde Tutma: Rework Planı

**Tarih:** 2026-11-06 · **Durum:** Kararlar verildi (§9), uygulama bekliyor · **Kapsam:** prolog → starter galaksi → göç → ana galakside ilk hafta

Owner, 2026-11-06: *"Kararları senin akıllıca vermeni istiyorum ve sana bırakıyorum."* §9'daki kararlar bu yetkiyle verilmiştir. Eski dokümanlardaki yasaklar kilit sayılmamış, tek tek değerlendirilmiştir (§9.2). CLAUDE.md'deki kilitli karar (botlar ayırt edilemez) aynen geçerlidir.

Bu belge deploy, migration veya uzun ekonomi simülasyonu izni vermez. Sayılar `packages/rules` kodundan ölçülmüştür; dokümanlarla çelişirse kod esastır.

> **2026-11-08 güncellemesi:** Aşağıdaki bölümlerin yerini [`yeni-oyun-deneyimi-plani-2026-11-08.md`](yeni-oyun-deneyimi-plani-2026-11-08.md) aldı:
> - §5.1 (zaman çizelgesi)
> - §6.1'deki motor süreleri (8 sa yerine 4 + 4 sa)
> - §6.3 (sıkı rehber yerine kısa temel + danışman)
> - §6.4'teki onarım dronu, ilk savaş ve ilk PvP satırları
> - Q3, Q5 ve Q10
>
> Kasalar, rampa, bildirimler ve Yayın B/C'nin dron dışındaki maddeleri geçerlidir.

---

## 1. Sorun

Yeni oyuncu ilk dakikada dört onarım yapıyor, sonra oyun onu durduruyor. Starter galakside ilk dakikadan sonraki her adım **kaynak** bekliyor: önce 35 dakika, sonra 2 saat, sonra 5 saat. İnşa süresi kısaltılsa bile duvar kaynaktadır. Oyuncu bir şey kurmadan, kimseyle karşılaşmadan ve aidiyet hissetmeden bekliyor ve oyunu kapatıyor. İkinci oturuma çağıran sinyal de zayıf: telefon bildirimi starter'da ücretsiz, ama izin hiçbir anda istenmiyor. Ana galakside ise inişte büyük bir ödül birikiyor, ama oyuncu bunu göremiyor.

## 2. Bugünkü durum (koddan ölçüm)

**Yayın durumu:** Starter galaksi (Faz 1–10) yerelde tamam, commit ve deploy edilmedi. Starter için canlı bir ölçüm yok. Bu yüzden bu plan starter'ın **ilk yayınına** girer.

### 2.1 Starter galaksi: zorunlu onarım yolu

Açgözlü oyuncu modeli: açılış 930/300 + 60 havuz, 3 inşaat kuyruğu, gerçek üretim oranları. Madencilik ve yağma modele dahil değil.

| Sipariş anı | Onarım | İnşa | O anki üretim (alaşım/kristal saatte) |
|---|---|---|---|
| 0 sn | Rafineri 2, Çıkarıcı 1, Keşif anteni 1 | 10–30 sn | 60 / 0 |
| 1 dk | Çıkarıcı 2 | 60 sn | 147 / 24 |
| **35 dk** | Rafineri 3 | 45 dk | 147 / 59 |
| **2,6 sa** | Depo 1 | 30 dk | 248 / 59 |
| **7,7 sa** | Tersane 1 | 60 dk | 248 / 59 |
| 11–24 sa | Çıkarıcı 3, Keşif anteni 2, Hangar 2, Teleskop 1 | 60–90 dk | 248 / 59–99 |
| 51 / 63 sa | Motor gövdesi / itkisi | 8 sa | 361 / 99 |

- **Uçurum dakika 1'de:** dört onarım saniyeler, beşincisi 35 dakika kaynak + 45 dakika inşa.
- **Duvar süre değil, kaynak.** Gün içinde asıl kıt olan kaynak **kristal**: Çıkarıcı 2 saatte 59 kristal üretir; Keşif anteni 2, Hangar 2 ve Teleskop 1 birlikte ~1.200 kristal ister.
- **Filo (Tersane) ~8. saatte, sohbet ~16. saatte, teleskop ~25. saatte açılıyor.** İlk oturumda başka bir oyuncuyla tek temas sonda.
- `repairProgress` açılışta 1/21 (%5) gösteriyor.

### 2.2 Ana oyun: ilk seviyeler

| Seviye | İnşa (`buildingMinutes`) | Kaynak bekleme (yaklaşık) |
|---|---|---|
| 1 | 2,8 dk | ~40 dk |
| 3 | 5,2 dk | ~37 dk |
| 5 | 9,6 dk | ~1,8 sa |
| 10 | 45 dk | ~1,8 sa |
| 15 | 3,5 sa | ~7 sa |

Göçle inen oyuncu ilk sezon paketiyle gelir: Core 3, Rafineri/Çıkarıcı 2, Tersane/Depo/Aegis 1, 1.500/1.000/50 kaynak, 72 saat kalkan. Yanında ambar da vardır (en fazla 2.000/1.000/50 ve 6 gemi). İlk yükseltmeler ucuzdur (Core 3→4: 445/120, Rafineri 2→3: 154/20). Yani inişte kaynak sorunu yoktur; sorun, oyuncunun neyi neden yapacağını görmemesidir (§7.1).

### 2.3 Geri dönüş sinyalleri

| Ne | Durum |
|---|---|
| Starter push türleri | `incoming_attack`, `probe_detected`, `raid_over`, `raided`, `system_open`, `shield_falling` (`services/starter/push.ts`) |
| Onarım bitti push'u | Yalnız bir **sistem açıldığında** (`system_open`, `worker/starterHandlers.ts`). Sistem açmayan onarım sessiz biter. |
| Push izni | Yalnız menüdeki Bildirim Merkezi'nde isteniyor (`NotificationCenterSheet`, `ask: true`). `PushDeviceSync` yalnız önceden izin verilmişse bağlanıyor. Starter oyuncusundan izin **hiçbir zaman** bağlam içinde istenmiyor. |
| Web | Telefon bildirimi web'de kapalı. Dönüş özeti (`AwayHost`) web'de de var. |
| Gece sessizliği | Yok. Cihazın saat dilimi push kaydında tutulmuyor (`push_devices`: token, locale). Analytics istemcisi ise saat farkını zaten gönderiyor (`foreground_started.offsetMinutes`). |

### 2.4 Ölçüm altyapısı (var olan)

| İhtiyaç | Var olan olay |
|---|---|
| Oturum sayısı ve süresi | `foreground_started` / `foreground_ended` |
| Push izin sonucu | `alert_permission` (`variant: push \| local`) |
| Starter adımları | `vessel_enlisted`, `vessel_step_completed`, `vessel_feature_opened`, `vessel_first_probe_sent/received`, `vessel_first_mine`, `vessel_first_battle`, `vessel_first_pvp`, `vessel_part_found`, `vessel_migration_started/landed` |
| Prolog | `training_*` |
| Rehber takılması | `blocker_visible` (`surface: starter_tutorial`) |
| **Eksik** | Rehber adım hunisi. `training_scene_visible` kullanılacak; `step` alanı 1–11 ile sınırlı olduğu için adım kimliği `scene` alanına yazılır, `trainingVersion: starter-tutorial.v1`. Admin hunisi FlightSchool'u `step` ile süzdüğü için karışmaz. |

## 3. Araştırma

| Bulgu | Kaynak |
|---|---|
| Medyan mobil oyunda D1 ~%22, D7 ~%4, D30 ~%0,7–0,8; en iyi %1'de D1 %64–68. | GameAnalytics 2026 |
| Strateji/mid-core için D1 %32–45, D7 %10–21, D30 %4–12 (kaynaklar çelişiyor). İyi FTUE işareti D1 %45. | Innovecs, PocketGamer.biz |
| Last War iOS ABD: D1 %34, D7 %11, D30 %4. Whiteout Survival: %42 / %17 / %8. | Naavik (2025) |
| Last War'da tam 4X döngüsü ilk oturumun 40–50. dakikasında açılıyor. Eğitim 30–60 dakika sürüyor ve kaynak/hızlandırma ödülleriyle dolu. İlk gün: inşaatçı boş kalmasın, 3 günlük kalkan, ittifaka katıl, 7 günlük yeni oyuncu giriş ödülü. | Naavik, Last War Vault |
| Çekirdek oyuna 60 saniyede girilmeli, "aha" anı 90 saniyeyi geçmemeli. İlk oturumda görünür başarı ve 1. gün bildirimi D1'e 5–10 puan ekliyor (satıcı iddiası). | Playio |
| Önce çekirdek döngü, sonra çok oyunculu, ödül ve sıralama. Her hedef açık olmalı, her başarı kutlanmalı. Her eğitim adımı ayrı ölçülmeli. | PocketGamer.biz |
| Bağışlanmış ilerleme: 2'si önceden damgalı 10 kutulu kartta tamamlama %19 → %34. | Nunes & Dreze, Game Developer |
| Clash of Clans: ilk saldırı eğitimin ortasında gelir, sistemler kademeli açılır, oyuncu erkenden klana yönlendirilir. | Game Developer (2014) |
| Yeni oyuncu koruması: Travian 1–7 gün, Evony 7 gün. | Travian, Evony |
| Yarım kalan iş, zamanlı ödül ve bildirim geri çağırmanın ana araçları; bilimsel destek tartışmalı. | SMU tezi 2026 |
| Push'a izin verenler ilk ayda %55, vermeyenler %29 kalıyor (korelasyon). İzin, değer açıklanarak ve bağlam içinde istenince artıyor. | Urban Airship / PocketGamer.biz, Flaregames |
| İlk maçlarda botla eşleştirme, yeni oyuncuya cezasız pratik verir (Clash Royale). | Naavik |

**İlkeler:**

1. İlk 20–25 dakikada hiçbir bekleme 1–2 dakikayı geçmez. Gerçek ilk bekleme, oyuncu bir şey kurduktan sonra gelir.
2. Süre eğrisi pürüzsüz ve geometriktir, uçurum yoktur.
3. Kaynak eğrisi süre eğrisiyle birlikte tasarlanır.
4. Her oturum, sonucu merak edilen ve **ne zaman geleceği bilinen** bir şeyle biter.
5. Başka bir oyuncu ilk oturumda görünür olur.
6. İlerleme gerçektir ve görünür; sahte ilerleme gösterilmez.
7. Ödül çoğunlukla eyleme verilir. Tek katılım ödülü, seri gerektirmeyen tek seferlik "Yeni Komutan 7 Günü"dür (§7.2).

## 4. Psikolojik etkenler ve bizdeki karşılığı

| Etken | Astera'da uygulama | Sınır |
|---|---|---|
| **Bağışlanmış ilerleme** | İlk oturum sonunda "Onarım" çubuğu %5'ten ~%38'e (8/21) çıkar; sistem bölmeleri ışıklanır | Yalnız gerçekten yapılan onarım sayılır |
| **Hedefe yaklaşınca hızlanma** | Sıradaki sistemin açılmasına kalan adım hep görünür | |
| **Yarım kalan iş** | Oturum asla boş kuyrukla bitmez; NPC ayrılırken uçuşta olanı ve dönüş saatini söyler | |
| **Emek → sahiplik** | Gemiye ad verme, sistemlerin modelde onarıldığını görme, ilk filoyu kendin üretme | |
| **Değişken ödül** | Enkazda parça veya fazladan kaynak, sonda raporunda sürpriz, karakol ganimeti | Ücretli şans kutusu yok |
| **Yetkinlik** | İlk savaş Aegis korumalı korsan akını; ilk karakol doğru sınıfla rahat kazanılır | Sonuç garanti edilmez; girdi ve kural verilir |
| **Merak** | Karanlık noktalar, sinyal, komşunun gizli onarım hâli | |
| **Sosyal kanıt** | Kalkış panosu, kalkan komşunun izi, sohbetteki galaksi olayları | |
| **Karşılıklılık** | Komşuya onarım dronu (§6.4) | Günlük sınır |
| **Randevu** | Oyuncunun kendi başlattığı işin sonucu haber verir | Gece sessizliği (§6.6) |
| **Kayıptan kaçınma** | Kalkan bitiyor bildirimi (var) | Sahte sayaç yok |
| **Zirve-son** | Oturumun son anı bir açılış ya da kalkış; NPC vedası onun üstüne gelir | |

## 5. Hedef yolculuk

### 5.1 Zaman çizelgesi (3–4 oturum/gün oynayan oyuncu)

| An | Oyuncu ne yaşar | Tatlı nokta | Bırakılan merak |
|---|---|---|---|
| **0–3 dk** (prolog, var) | Karanlık gemi, şalter, ocak, sinyal, sahiplen | Aha ≤ 90 sn | Sinyal |
| **3–8 dk** | Rafineri, Çıkarıcı, Keşif anteni; ilk sonda en yakın gemiye | İlk başka oyuncu ≤ 8 dk | "Bu kim?" |
| **8–20 dk** | Rafineri 3, Depo, Tersane, Çıkarıcı 3 (süreler 90 sn – 5 dk, paralel); kasalar açılır; Tersane'nin verdiği Kazıcı en yakın asteroide gider | İlk filo ≤ 15 dk | Kazıcı yolda |
| **20–25 dk** | Kazıcı döner, enkaz açılır; veda; telefon izni | 1. oturum 20–25 dk | Çıkarıcı 3'ün ve kaynağın saati |
| **2. oturum** (+~1 sa) | Keşif anteni 2 → sohbet | İlk sosyal an; botlar yeni komşuyu ilk gün sondalar (var) | Sohbet |
| **3. oturum** (+~3 sa) | Hangar 2 → araştırma | | Araştırma sonucu |
| **4. oturum** (+~8 sa) | Teleskop 1 → komşu trafiği görünür | | Teleskopta görülen filo |
| **2. gün** | Radar 1 → korsan gözcüsü; Aegis 1 → ilk korsan akını, savaş raporu, Saldır açılır; 12 saat kalkan | İlk savaş | Kalkan |
| **2–3. gün** | Karakol, ilk PvP, enkaz yarışı, motor gövdesi | İlk rakip | "Neden yenildim?" |
| **3–4. gün** | İtki parçası avı, yakıt, kalkış | Göç | Yeni dünya |
| **İniş + 7 gün** | Kuruluş haftası (§7) | İlk klan ≤ 3. gün | |

Radar ve Aegis bilerek 2. güne bırakıldı. Bir günde açılan sistem sayısı 6'da kalır (kademeli öğrenme, K8). PvP kalkanı da oyuncunun ilk gecesine denk gelmez.

### 5.2 Hedef KPI'lar

| Ölçü | Hedef |
|---|---|
| Prologa giren → gemiyi sahiplenen | ≥ %70 |
| 1. oturum süresi (medyan) | 20–25 dk |
| 1. → 2. oturum | ≥ %55 |
| D1 / D7 | ≥ %40 / ≥ %15 |
| İlk sonda / ilk filo | ≤ 8 dk / ≤ 15 dk |
| Gemiyi sahiplenenlerden göç eden | ≥ %35 |
| Push izni (native, sorulanlar içinde) | ≥ %50 |

**Karar kuralı:** En az 200 yeni oyuncu ve 2 hafta sonra 1.→2. oturum oranı %45'in altındaysa veda anı ve dönüş süresi yeniden ayarlanır. Medyan 1. oturum 15 dakikanın altındaysa rehber hunisindeki en büyük düşüş adımı düzeltilir. Bu kontrol haftalık yapılır.

## 6. Starter galaksi

### 6.1 Süre eğrisi

| # | Onarım | Bugün | Yeni |
|---|---|---|---|
| 1–4 | Rafineri 2, Çıkarıcı 1, Keşif anteni 1, Çıkarıcı 2 | 10 sn – 60 sn | aynı |
| 5 | Rafineri 3 | 45 dk | **90 sn** |
| 6 | Depo 1 | 30 dk | **2 dk** |
| 7 | Tersane 1 | 60 dk | **3 dk** |
| 8 | Çıkarıcı 3 | 60 dk | **5 dk** |
| 9 | Keşif anteni 2 | 60 dk | **20 dk** |
| 10 | Hangar 2 | 90 dk | **30 dk** |
| 11 | Teleskop 1 | 90 dk | **40 dk** |
| 12 | Rafineri 4 | 120 dk | **60 dk** |
| 13–16 | Radar 1, Döteryum 1, Aegis 1, Döteryum 2 | 45–120 dk | aynı |
| 17–18 | Motor gövdesi, itkisi | 8 sa | aynı |

- **Yumuşak rampa (sahip, 2026-11-07):** "30 sn'den 3 dk'ya geçiyoruz?" üzerine 5–8. adımlar 90 sn / 2 / 3 / 5 dk oldu; 9. adımdan sonrası değişmedi. Rehberli oturumda hiçbir şey sürmezken depoda bir dakikadan uzun beklenmez (`starter-first-session.test.ts`).
- Motor adımları 8 saatte kalır. Toplam süre 3–5 gün sözünü korur; değişiklik yalnız başlangıcı öne çeker.
- İsteğe bağlı onarımlar değişmez.

### 6.2 Kurtarma Kasaları (starter'ın ödül zincirleri)

Süre kısalınca duvar kaynakta kalır. Kasalar bu açığı kapatır.

- **Ne:** Sistem bölmelerindeki mühürlü kargo kasaları. Belirli bir onarım bitince o bölmenin kasası "alınabilir" olur, oyuncu dokunup açar. Kasa eyleme bağlıdır, beklemeye değil.
- **Nerede:** Ana galaksinin ödül paneliyle **aynı panel ve aynı "Al" hareketi** (§7.1). Oyuncu sistemi gemide öğrenir, inişte tanıdığı şeyi görür.
- **Hangi adımlarda:** Rafineri 2, Keşif anteni 1, Rafineri 3 ve Tersane 1 (1. oturum), Çıkarıcı 3 ve Keşif anteni 2 (1. gün, ağırlıklı kristal).
- **Ne kadar (uygulandı, `starter/crates.ts`):** Rafineri 2 → 150/40, Keşif anteni 1 → 300/150, Rafineri 3 → 800/300, Tersane 1 → 250/200, Çıkarıcı 3 → 100/250, Keşif anteni 2 → 150/250. Toplam 1.750 alaşım / 1.190 kristal. Daha küçük bir set denendi; ilk gün teleskop hedefini kaçırdı.
- **Hedef çizelge (test kabulü):** 1. oturumda Tersane ve Çıkarıcı 3 sipariş edilir. +1 saatte Keşif anteni 2, +3 saatte Hangar 2, +8 saatte Teleskop 1 ödenebilir.
- **Servet yaratmaz:** Göç ambarı tavanı (2.000/1.000) değişmez.
- **Botlar:** Kasaları aynı kurallarla alır ve açar (`shipBots`). Bot ile insanın kaynak eğrisi ayırt edilemez.
- **Görünüm:** Gemi ekranındaki sistem kartında bir kasa görseli belirir (Codex ile üretilir). Açılınca kapak açılır, ışık ve parçacık çıkar, kaynak sayaçlara akar; ses ve titreşim gelir.

### 6.3 Rehber (NPC)

| Bölüm | İçerik | Mod |
|---|---|---|
| 1–3 (var) | Güç, toplama, ilk onarımlar, anten | Sıkı |
| 4 (var) | Sonda ve rapor; raporda komşunun gemisi gerçek hâliyle görünür | Sıkı |
| 5 (yeni) | Rafineri 3, Depo, Tersane, Çıkarıcı 3; kasaları açma | Sıkı |
| 6 (yeni) | İlk Kazıcı en yakın asteroide gider, uçuş izlenir, dönüşte toplanır | Sıkı |
| Veda (yeni yer) | Kazıcı dönüp ilk enkaz göründükten sonra. NPC uçuşta olanı ve dönüş saatini söyler. Native'de telefon izni burada istenir. | Sıkı |
| Sonrası | **Hafif rehber** | Kapı yok |

- **Hafif rehber:** Kapı (gate) yoktur. NPC yalnız iki anda görünür: bir sistem açıldığında (mevcut `UnlockMoment`) ve oturum başında, sıradaki adım bariz değilse tek bir kartla. Tek dokunuşla kapanır. Oturum başına en fazla bir kart gösterilir.
- **İlk asteroit garantisi:** Asteroitler aktif gemi başına saatte 0,5 doğar, bu yüzden 15. dakikada yakında bir kaya olmayabilir. Bir geminin Tersane 1'i bittiğinde ona 300 birimden yakın bir asteroit yoksa, gemiye 150–300 birim uzağa bir asteroit konur. Bu, saatlik arzdan düşülür. Kazıcı uçuşu böylece 1 dakika civarında kalır.
- **Mevcut koddaki etkisi:** `script.ts` içindeki `away` adımının koşulu (`canPayNext`, Rafineri 3) yeni veda noktasına taşınır. `TUTORIAL_CHAPTERS` 5'ten 6'ya çıkar.
- **Kurtarma:** Bugün eklenen kapı kurtarması (işaret 4 sn yoksa kapı açılır, `blocker_visible` kaydı) ve 90 saniyelik bekleme sınırı geçerlidir.
- **Bekleme kilitlemez (sahip, 2026-11-07):** "Oyuncuyu 10 sn'den fazla, bir şey yapmasına izin vermeden kitleyemeyiz." Bekleme adımının toplam süresi 10 sn ve altındaysa kapı açık kalır (kilit). 10–60 sn arasında oyuncu serbestçe gezer, yalnız harcama düğmeleri (onarım, sonda, maden, sistemi dene) kapalıdır. 60 sn ve üstünde NPC "bitince seni çağıracağım, ~saat" der, "Tamam" ile köşedeki çipe çekilir ve iş bitince sesle geri gelir (`waitMode`, `AwayChip`).
- **İlk sistem kartı sırasını bekler (sahip, 2026-11-07):** Rehber konuşurken "çevrimiçi" kartı, satırın işaretleri karta değmedikçe görünmez (`unlockHold`).

### 6.4 Gerçek oyuncuyla erken temas

| An | Kim | Kural |
|---|---|---|
| İlk sonda (≤ 8 dk) | En yakın gemi, gerçek ya da bot | Var |
| Sondalanmak (1. gün) | Botlar yeni gerçek komşuyu ilk gün sondalar | Var (`shipBots.newNeighbourToRead`) |
| **Onarım dronu** | Gerçek ve bot | Komşunun süren onarımına dron yollanır; onarımdan 1 dk düşer, gönderen 20 alaşım + 10 kristal alır. Günde 3 dron, her biri farklı komşuya; aynı komşu aynı gün bir kez. Dron haritada uçar, iki tarafa da bildirim düşer. Sonda gibi "Keşif anteni 1" ile açılır. |
| **Sohbette galaksi olayları** | Sistem | Herkese açık olaylar sohbet akışında satır olarak görünür: kalkış, enkaz alanı çıktı, karakol boşaldı. Kim kazdı, kim topladı söylenmez (ana oyunun Chronicle kuralı). Botlar konuşturulmaz. |
| **Kohort yerleşimi** | Sistem | Yeni oyuncu, son 24 saatte gerçek oyuncu almış ve yeri olan galaksiye girer. Böyle bir galaksi yoksa bugünkü kural geçerlidir (yeri olan en eski galaksi). |
| İlk savaş (2. gün) | Korsan NPC, Aegis korumalı | Var |
| İlk PvP (2–3. gün) | Gerçek ve bot | Var: bash ve günlük akın sınırları |

Bot kuralı (kilitli, 2026-10-28) korunur. Dron, kasa ve kohort kodunda bot için ayrı bir yol, işaret veya satır yoktur. Bunu test korur.

### 6.5 Hızlandırma

- "Ekibi zorla" (basılı tutarak ücretsiz bitirme) **şimdilik yok**. 6.1 ve 6.2 yeterli olabilir; ölçümden sonra yeniden bakılır.
- Ücretli hızlandırma yok.
- Ödüllü reklamla hızlandırma, AdSense kabulünden sonra ayrı bir karar konusudur.

### 6.6 Bildirimler

| Olay | Kapsam | Kural |
|---|---|---|
| **Uzun onarım bitti** (yeni) | Starter | Oyuncunun başlattığı ≥ 15 dk'lık onarımlar. Aynı 30 dakikada bitenler tek bildirimde toplanır. Sistem açan onarım `system_open` olarak gider (var). |
| **Kazıcı döndü** (yeni) | Starter | İlk 3 dönüş; sonra yalnız ganimette parça varsa |
| **Sıradaki onarımın parası hazır** (yeni, Y1) | Starter + inişten sonraki 7 gün | Günde en fazla 1. Yalnız oyuncu son 3 saattir girmemişse ve sıradaki zorunlu adım ödenebilir hâle geldiyse gider. Sunucu bunu, ödenebilir olacağı ana bir olay planlayarak gönderir; her sipariş ve toplamada plan yenilenir. Yarıda kalan "6. madde" budur. |
| **Yokken olanlar** (yeni, Y2) | Starter + ana galaksi | 24 saat girmeyen oyuncuya, o sürede **gerçekten olan** en az bir olay varsa tek bildirim: "Yokken gemine sonda geldi, komşun Vela kalktı." Olay yoksa gitmez. Aynı yokluk için en fazla 2 kez gider (24. ve 72. saatte). |
| Sondalandın, filo yaklaşıyor, akın sonucu, kalkan | Starter | Var |

- **Gece sessizliği:** 23:00–08:00 arasında, cihazın yerel saatine göre, yalnız saldırı uyarısı (`incoming_attack`) gider. Diğerleri 08:00'e kayar. Bunun için push kaydına saat farkı eklenir (`registerPushDevice` + `push_devices.utcOffsetMinutes`).
- **Web:** Telefon bildirimi yok. Web oyuncusu dönüş özeti ve yükleme önerisiyle (`install_offer`) karşılanır.
- **Push izni:** Yalnız native. Vedada sorulur: "Onarım bitince ve biri gemine yaklaşınca haber vereyim mi?" Ret halinde bir sonraki ≥ 15 dk'lık onarımda bir kez daha sorulur, sonra hiç sorulmaz. Sonuç `alert_permission` ile ölçülür.

## 7. Ana galaksi: Kuruluş Haftası

1. **İniş ödül anı (§7.1).** İniş kartından sonra NPC, gemideki onarımların burada ödül olduğunu söyler. Tek bir **Tümünü al** hareketiyle ~1.980 alaşım ve ~970 kristal sayaçlara akar. Ardından ilk ucuz yükseltmeler gösterilir.
2. **Sıradaki hedef satırı.** Starter'daki `ObjectiveLine` ana galakside de sürer ve ödül zincirlerinden beslenir (§7.1).
3. **Klan önerisi.** İnişin 1. günü bir klan önerilir. Önce eski starter komşularının bulunduğu, son 3 günde aktif ve yeri olan klan; yoksa aktif ve yeri olan herhangi bir klan.
4. **Komşularla in.** İniş ekranındaki 3 adaydan biri, son 7 günde aynı starter galaksisinden inen bir oyuncuya en yakın boş adres olur (varsa). Ekranda "Eski komşun Vela yakında" yazar.
5. **Kademeli tanıtım (planlı, başlangıç galaksisi planı §3.8).** 1. gün Çekirdek/kademe, 2. gün koloni, 3. gün klan, sonra Dominion ve Honor.
6. **İlk hafta korumaları:** Temel push'lar ilk 7 gün ücretsiz (Y8). Hareketsizlikle silinme sınırı ilk 7 gün 3 yerine 7 gün (Y9). İniş kartındaki "3 gün" ve "Bildirim Merkezi" satırları buna göre değişir.
7. **İnşa hızlandırması yok.** Ana ekonomiye dokunur ve uzun simülasyon ister. İniş kaynağı zaten yeterli; sorun görünürlük (§7.1).

### 7.1 Ödül sistemi incelemesi (`rewards.ts`, `RewardsScreen.tsx`)

**Kural doğru kurulmuş.** 13 zincir, 40 kademe, sezonda toplam ~23.700 alaşım ve ~11.650 kristal. Ödül eyleme bağlı, depoya düşüyor ve yağmalanabiliyor. Kademeler süresiz ve biriktirilebiliyor. En büyük ödüller sonda ve akında.

**İnişteki itki görünmüyor.** İlk sezon paketi yüzünden oyuncu iner inmez 7 kademeyi hak ediyor: Core 2–3, Rafineri 2, Çıkarıcı 2, Tersane 1, Aegis 1, Depo 1. Toplamı ~1.980 alaşım ve ~970 kristal, yani Rafineri 2'nin ~13 saatlik üretimi. 350 px galeride (`?view=rewards-ready`) bakıldı:

| # | Bulgu | Etki |
|---|---|---|
| R1 | İniş kartı ödüllerden söz etmiyor; tek işaret üst çubukta sallanan hediye ikonu | Oyuncu bekleyen kaynağı bilmeden "param yok" diyebilir |
| R2 | Starter'da ödül paneli kapalı (`MenuPanel`: gemide ödül yok) | Sistem ilk kez 3–5 gün sonra görülüyor |
| R3 | Alınacak ödül yokken hediye ikonu kayboluyor; hedef listesi menüde kalıyor | Ödül, "sıradaki ne?" rehberi olamıyor |
| R4 | 350 px'te 11 ayrı "Al" düğmesi, 13 kart, ~5–6 ekran kaydırma; "Tümünü al" yok | Etkileşim maliyeti yüksek |
| R5 | İlk ekranın ~%70'ini X takip kartı kaplıyor | Oyun içi hedefler kaydırmanın altında kalıyor |
| R6 | Hedeften eyleme "Git" kapısı yok | Gösteriyor, yardım etmiyor |
| R7 | Alma anı yalnız titreşim ve toast | Game feel eksik |

**Kararlar:**

- **Tümünü al:** Tek sunucu isteği, tek transaction. Depo sınırı kuralı bugünkü gibi kademe başına uygulanır.
- **Kart düzeni:** Alınabilir kademeler en üstte tek satır olur, kalanlar katlı durur. Topluluk (X) kartı listenin en altına iner ve tek satıra küçülür.
- **Sıradaki hedef seçimi (deterministik):**
  1. Alınabilir ödül varsa: "N ödül hazır".
  2. Yoksa, eylem zincirlerinde (PROBE, MINE, SALVAGE, PIRATE, RAID) bir sonraki kademeye en az adım kalanı. Eşitlikte ödülü büyük olan seçilir.
  3. O da yoksa, kalan seviyesi en az olan bina zinciri.
- **Git kapıları (mevcut `ShellRoute`):**
  - PROBE → en yakın keşfedilmemiş dünya.
  - MINE → en yakın asteroit.
  - SALVAGE → en taze enkaz (`freshestWreckAt`).
  - PIRATE → en yakın korsan.
  - RAID → İstihbarat.
  - Bina zincirleri → Üs sayfasında o bina.
- **Alma anı:** Kaynak ikonları sayaca akar, ses ve titreşim gelir.

### 7.2 Yeni Komutan 7 Günü (Y3)

- **Ne:** Hesap başına bir kez. Gemi sahiplenildiğinde başlar, inişten sonra da sürer.
- **Seri yok:** Gün sayılmaz, **alınan kutu** sayılır. Kaçırılan gün kaybolmaz, sıradaki kutu bekler. Günde en fazla bir kutu açılır, bir sonraki kutu son açılıştan 20 saat sonra hazır olur.
- **İçerik:** Yalnız kaynak; her kutu o anki üretimin ~1 saati kadar, kristal ağırlıklı, 7. kutu ~3 saat. Gemideyken gemiye, indikten sonra başkente ve depoya düşer, yani yağmalanabilir (`rewards.ts` ilkesi: kaybedilemez ödül yok).
- **Yeri:** Ödül panelindeki ayrı bir şerit. Hediye ikonu ve sıradaki hedef satırı kutuyu da sayar.
- **Kötüye kullanım:** Hesap başına bir kez. Starter'daki kaynak, göç ambarı tavanıyla sınırlıdır.

## 8. Uygulama planı

TDD zorunludur (önce test, FAIL, kod, PASS). Her kural değişikliğinin aynaları listelenip test edilir: rules, sunucu, web, 6 dil, testler, botlar, analytics şemasının iki tarafı ve dokümanlar.

### 8.1 Yayın A: Starter'ın ilk yayını

Starter henüz canlı olmadığı için A'daki her şey **ilk günden** yayında olur. "Önce eski huniyi ölç" adımı yoktur; kıyas, A'nın ilk iki haftası ile sonraki ayarlar arasında yapılır.

| Faz | İş | Kabul |
|---|---|---|
| **F0 Ölçüm** | Rehber adım hunisi (`training_scene_visible`, `scene` = adım), admin hunisine starter bölümü (oturum, 1.→2. oturum, adım düşüşü, push izni, kasa açma) | Şema testleri iki tarafta; huni sorgusu testi |
| **F1 Eğri ve kasalar (rules)** | `REPAIR_LADDER` süreleri (§6.1), kasa zincirleri ve miktarları; `starter-pacing` ve `starter-first-session` testleri §6.2'deki hedef çizelgeye göre | Pacing testi: 1. oturumda Tersane + Çıkarıcı 3; +1 sa Keşif anteni 2; +3 sa Hangar 2; +8 sa Teleskop 1; 3 oturum/gün oyuncu 3–4 günde göç |
| **F2 Kasalar (sunucu + web)** | Gemi için ödül görünümü ve alma ucu (ilerleme gemiden türetilir, alınan kademeler gemide yeni bir sütunda saklanır, migration gerekir), gemide ödül paneli, kasa anı, botların kasa alması, ilk asteroit garantisi, 6 dil | Çift alma, eşzamanlılık, göçte ambar tavanı, bot ayırt edilemezliği testleri; 350 px görsel kontrol |
| **F3 Rehber** | Bölüm 5–6, yeni veda, hafif rehber, push izni anı | Senaryo testleri; 350×620, 350×760 ve masaüstünde baştan sona oynanış |
| **F4 Bildirimler** | Uzun onarım bitti, Kazıcı döndü, parası hazır, yokken olanlar, gece sessizliği, push kaydına saat farkı (yeni sütun ve starter olay türleri: migration) | Sunucu testleri: zaman, toplama, günlük sınır, gece kaydırması; 6 dil |

### 8.2 Yayın B: Sosyal

| Faz | İş | Kabul |
|---|---|---|
| **F5** | Onarım dronu (yeni görev türü: migration), sohbette galaksi olayları, kohort yerleşimi | Kötüye kullanım (kendine, ikinci hesap, sınır), eşzamanlılık, sis kuralı ve bot testleri |
| **F6** | Yeni Komutan 7 Günü | Seri olmaması, 20 saat kuralı, hesap başına bir kez, gemi → başkent geçişi |

### 8.3 Yayın C: Ana galaksi

| Faz | İş | Kabul |
|---|---|---|
| **F7 Ödül paneli** | Tümünü al, kart düzeni, sıradaki hedef, Git kapıları, alma anı | Ekran ve rota testleri; 350 px görsel kontrol |
| **F8 Kuruluş haftası** | İniş ödül anı, klan önerisi, komşularla iniş, ilk hafta push ve silinme sınırı, iniş kartı metinleri | Sunucu testleri (7 günlük pencere, fiyat 0, `idleDays`), 6 dil |

### 8.4 Doküman güncellemeleri (her yayınla)

| Belge | Değişiklik |
|---|---|
| `product-vision.md` | "Eğitim yok" yasası, sıkı rehber kararıyla güncellenir. Hedef kitle satırına ilk oturum istisnası eklenir (Y10, Y11). |
| `game-design.md` | Bildirim yasakları §6.6'ya göre, "dönüş ekranı yok" (D23) dönüş özetine göre güncellenir. |
| `baslangic-galaksisi-plani-2026-11-04.md` | §3.3, §3.4, §3.10 yeni çizelge, süreler, kasalar ve bildirimlerle güncellenir. |
| `baslangic-onboarding-tasarimi-2026-11-06.md` | Rehber bölümleri ve veda yeri güncellenir. |
| Wiki ve yardım | Kasalar, dron, 7 gün, ilk hafta korumaları, 6 dilde |

## 9. Kararlar

### 9.1 Plan kararları

| No | Konu | Karar | Neden |
|---|---|---|---|
| Q1 | Süre eğrisi | §6.1; motor 8 saatte kalır | Başı öne çeker, 3–5 gün sözünü korur |
| Q2 | Kaynak açığı | Kurtarma Kasaları, ödül panelinin zincirleri olarak | Eyleme bağlı; ödül sistemini gemide öğretir |
| Q3 | Sıkı rehber | Kazıcının ilk dönüşüne kadar (~20–25 dk), sonra hafif | Last War 30–60 dk; bizim oyunun öğrenme eğrisi yüksek |
| Q4 | Push izni | Native, vedada; bir kez daha, sonra asla | Bağlam içinde izin oranı yüksek |
| Q5 | Onarım dronu | Evet, Yayın B | Ucuz, gerçek karşılıklılık |
| Q6 | Kohort | Evet, son 24 saat kuralı | Komşu "benim gibi biri" olur |
| Q7 | Ana galakside inşa hızlandırması | Hayır | Sorun kaynak değil görünürlük; ekonomi riski |
| Q8 | Komşularla iniş | Evet, 3 adaydan biri | Sosyal bağı ana galaksiye taşır |
| Q9 | Ekibi zorla | Şimdilik hayır | Önce ölçüm |
| Q10 | Starter süresi | 2–3 oturum/gün için 3–5 gün kalır (ölçüm: 2 oturum 4,4 gün, 3 oturum 3,4 gün); 4 oturum 2,75 gün | Değişen yalnız ilk gün; sık gelen ödüllenir |
| Q11 | Starter'da ödül paneli | Evet | R2 |
| Q12 | Tümünü al, sıradaki hedef, Git | Evet | R3–R6 |

### 9.2 Eski yasaklar

| No | Bugünkü kural | Karar |
|---|---|---|
| Y1 | "Depon doldu" bildirimi yok | **Açıldı, sınırlı:** "Sıradaki onarımın parası hazır"; starter ve inişten sonraki 7 gün, günde 1, gece sessizliği (§6.6) |
| Y2 | "Seni özledik" yok | Boş çağrı yasak kalır; **haber tabanlı "yokken olanlar"** açıldı (§6.6) |
| Y3 | Günlük giriş ödülü yok | Genel günlük ödül yasak kalır; **seri gerektirmeyen tek seferlik Yeni Komutan 7 Günü** açıldı (§7.2) |
| Y4 | Seri uyarısı yok | Yasak kalır |
| Y5 | Bekleyerek kazanılan ödül yok | Kalır (üretim zaten bekleyerek gelir) |
| Y6 | Hızlandırma yok | Ücretli yok; ödüllü reklam AdSense'ten sonra; ücretsiz "Ekibi zorla" ölçümden sonra |
| Y7 | Geçiş reklamı yok | Yasak kalır |
| Y8 | Ana galakside push ücretli | İnişten sonraki ilk 7 gün temel push'lar ücretsiz |
| Y9 | 3 gün girmeyenin gezegeni silinir | İnişten sonraki ilk 7 gün sınır 7 gün; sonra 3 gün |
| Y10 | "Eğitim yok", "dönüş ekranı yok" | Zaten değişmişti; dokümanlar güncellenir (§8.4) |
| Y11 | Hedef kitle: 4–6 dk oturum | İlk oturum istisnası yazılır (§8.4) |

## 10. Riskler ve ölçümle ayarlanacaklar

| Risk / parametre | Önlem |
|---|---|
| 25 dakikalık sıkı rehber sıkabilir | Hiçbir adımda 60 sn'den uzun bekleme yok; huni adım adım ölçülür; kapı kurtarması var |
| Kasalar ekonomiyi şişirir | Miktarlar testte hedef çizelgeye bağlı; göç ambarı tavanı |
| Kristal/alaşım dengesi gün içinde kayar | Pacing testi her iki kaynağı da kontrol eder; ilk iki haftanın verisiyle kasa içeriği ayarlanır |
| Bildirim yorgunluğu | Günlük sınır, toplama, gece sessizliği, Y2'de olay şartı |
| Dron ve 7 gün kötüye kullanımı | Günlük ve farklı hedef sınırı, hesap başına bir kez, ambar tavanı |
| Kohort az nüfusta galaksileri boş bırakır | 24 saat kuralı tutmazsa eski kural; botlar boşluğu doldurur (var) |
| Bot ayırt edilebilir hâle gelir | Kasa, dron ve 7 gün için bot ayırt edilemezlik testleri |
| Araştırma sayıları satıcı bloglarına dayanıyor | Karar kuralı kendi verimizle (§5.2) |

Ölçümle ayarlanacaklar: kasa miktarları, 9–12. adım süreleri, dron etkisi (1 dk), 7 gün kutu miktarı, Y1 sessizlik eşiği (3 sa), Y2 saatleri (24/72 sa).

## 11. Kaynaklar

- [GameAnalytics — 2026 Mobile & PC Gaming Benchmarks](https://www.gameanalytics.com/reports/2026-mobile-pc-gaming-benchmarks)
- [Innovecs — Mobile Game Retention Benchmarks 2026](https://www.innovecsgames.com/blog/mobile-game-retention-benchmarks/)
- [Naavik — Why Last War Is Winning the 4X Game](https://naavik.co/digest/how-last-war-is-winning-the-4x-game/)
- [Last War Vault — Your First 24 Hours](https://lastwarvault.com/guides/general/first-24-hours-guide/)
- [Matej Lancaric — The Rise of Sophisticated Onboarding](https://lancaric.substack.com/p/the-rise-of-sophisticated-onboarding)
- [PocketGamer.biz — Creating the ultimate first time user experience](https://www.pocketgamer.biz/first-impressions-count-creating-the-ultimate-first-time-user-experience/)
- [Playio — Onboarding Decides Your D1](https://blog.playio.co/mobile-game-onboarding-retention)
- [Game Developer — The Endowed Progress Effect and Game Quests](https://www.gamedeveloper.com/game-platforms/the-psychology-of-games-the-endowed-progress-effect-and-game-quests)
- [Game Developer — Analysis of Clash of Clans](https://www.gamedeveloper.com/business/game-monetization-design-analysis-of-clash-of-clans)
- [Supercell — Cost and Time Reductions (Dec 2023)](https://supercell.com/en/games/clashofclans/blog/news/cost-and-time-reductions-december-2023/)
- [Travian — Beginner's Protection](https://support.travian.com/support/solutions/articles/7000060689)
- [Wikipedia — Evony](https://en.wikipedia.org/wiki/Evony)
- [SMU Guildhall — Freemium mechanics and the Zeigarnik effect](https://scholar.smu.edu/guildhall_production_etds/11)
- [Naavik — A Primer on Great Online Matchmaking](https://naavik.co/digest/guide-to-matchmaking/)
- [PocketGamer.biz — Why getting players to opt in to push notifications matters](https://www.pocketgamer.biz/chart-of-the-week-why-getting-players-to-opt-in-to-game-push-notifications-matters/)
- [Flaregames — Encouraging Mobile Gamers to Opt In For Push Notifications](https://medium.com/flaregames-blog/encouraging-mobile-gamers-to-opt-in-for-push-notifications-3dde706bc8c7)
