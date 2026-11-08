# Yeni Oyun Deneyimi: Uygulama Planı

**2026-11-08 · Kaynak:** owner'ın oluşturttuğu `new-play-experience.md` raporu. Kurallar ve sayılar koddan doğrulandı; savaş oranları starter çözücüsüyle ölçüldü.
**Durum:** Kararlar alındı; kod yazılmadı.
**Yerini aldığı yerler:** `ilk-deneyim-elde-tutma-plani-2026-11-06.md` §5.1 (zaman çizelgesi), §6.1'deki motor süreleri, §6.3 (rehber), §6.4'teki onarım dronu ile ilk savaş ve ilk PvP satırları, Q3, Q5 ve Q10. O planda korunan maddeler §4 F9'dadır.

> Hedef döngü: **bilgi edin → gerçek seçenekleri karşılaştır → filoyu gönder → sonucu gör → kendi ikinci kararını ver.**
> İlk duygusal tepe, sekizinci onarım değil, oyuncunun kendi seçtiği ilk dış seferin sonucudur.

## 1. Kararlar (owner, 2026-11-08)

| No | Konu | Karar | Değişen kural |
|---|---|---|---|
| N1 | Rehber | Kısa temel + danışman. Yalnız güç, toplama ve ilk onarım sıkıdır (~2–3 dk). Sonra harcama kilidi kalkar. NPC 2–3 gerçek fırsatı bedeli ve sonucuyla sunar; oyuncu seçer, el yalnız seçileni gösterir. Kötü seçim engellenmez, telafi yolu gösterilir. | Sıkı bölüm (`LAST_STRICT_CHAPTER`) temel bölüme iner; `ROAD`'un doğrusal sırası danışmana döner. |
| N2 | İlk savaş | Karakol saldırısı **Tersane 1** ile açılır. Başka bir gemiye saldırmak için saldırganın da **Aegis 1**'i ve koruma kaydı olmalı. Korsan tehdidi, oyuncu kendisi en az bir dış sefer başlattıktan sonra gelir. | Karakol `fleet` ile açılır; `attack` (gemiye saldırı) ayrıca Aegis ister. Yeni özellik eklenmez. |
| N3 | Sensörler | **Teleskop 1 ve Radar 1 çıkış için zorunlu, Aegis 1 seçimli.** Aegis, PvP'ye ve korsan akınına giriş kapısıdır. | `DRIVE_HULL`'a `RADAR 1` gereksinimi eklenir (Radar, Teleskop'u ister). `AEGIS 1` `required: false` olur. |
| N4 | Tempo | Motor gövdesindeki `FIRST_BATTLE_REPORT` şartı kalkar; gövde ve itki **4 + 4 saat**. | Ladder 480 → 240 dk |
| N5 | Havuz taşması | Kural değişmez; gönderimden önce ve dönüşte açıkça gösterilir. | Yok |
| N6 | İlk av kurgusu | İki **isimli korsan karakolu** sondalanır, rapor okunur, karşı gemi seçilir, saldırılır (owner fikri). | §5 |
| N7 | Kurgu zamanı | **Tersane 1'den hemen sonra**, Kazıcı ilk madene giderken başlar. Teleskop, Teleskop 1'de gerçek temasla öğretilir. | Yok |
| N8 | Eski plandan | Sohbette galaksi olayları + kohort yerleşimi, Kuruluş haftası ve Yeni Komutan 7 Günü kalır; 7 Gün en sonda. Onarım dronu çıkarıldı. | — |
| N9 | İlk zaferin karşılığı | Kargo kuralı kalır ve raporda "taşıyabileceğin: X" olarak görünür. İlk kesin karakol zaferine **tek seferlik bir kasa** verilir. | Kurtarma Kasalarına yeni bir kasa eklenir (eylem kasası, modül kasası değil). |

**Planlayıcının kararları (owner itiraz etmedikçe):**
- **A/B deneyi yok.** Starter canlı değil ve oyuncu sayısı güç hesabına yetmez. Değişiklik herkese gider; ölçüm huni ve nitel playtest ile yapılır (owner + Codex fare testçisi).
- **Tek seferlik kurtarma hibesi yok.** Önce mevcut yollarla toparlanma ölçülür.
- **"Dünya karşılık verir" anı sonraya kalır.** Bu, botun bildiği bilgiye göre tepki vermesidir. Botların ilk gün yeni komşuyu sondalaması sürer.
- **Kaya sayısı ve galaksi boyutu** batch4 K8 sonucunda kalır.

**N9'un gerekçesi (ölçüm, 400 tohum):**
- Karakol ganimeti, hayatta kalan gemilerin kargosuyla sınırlıdır (`outpostHaul`).
- 2 Ok ile Sv1 karakoldan ortalama **~42 kaynak** gelir, ama **~250 değerinde gemi** kaybedilir.
- 2 Ok + 2 Kargı ile Sv2'den ~130 gelir, ~109 kaybedilir.
- Kasa olmasaydı ilk zafer ekonomik olarak zarar olurdu ve oyuncuya "karakol vurmak kötü" dersi verirdi.

**Kasanın kuralları:**
- Mevcut Kurtarma Kasalarının devamıdır; ana oyundaki PIRATE ödül zincirinin aynasıdır.
- Gemi başına bir kez verilir ve aynı "Al" hareketiyle açılır.
- Botlar da aynı kuralla alır.
- Göç ambarı tavanı değişmez.
- Miktar pacing testinde belirlenir; en az ortalama gemi kaybını karşılamalıdır.

## 2. Hedef akış

Saat, Oyuna Başla'dan başlar; prolog ve kayıt dahildir. Süreler sınanacak aralıklardır, garanti değildir.

### Oturum 1 (~30–35 dk)

| Dakika | Oyuncu ne yaşar | Ne değişti |
|---|---|---|
| 0–3 | Prolog: şalter, ateşleme, sinyal, sahiplen + kayıt | Değişmez |
| 3–5 | Gemiye **tek** geçiş anı: üretim kartı, ilk toplama ve ilk onarım (Rafineri 2: bedel, süre, kuyruk). Tek sıkı bölüm budur. | `lookAround`, `welcome`, `online` ve `collect` birleşir; ikinci karşılama yok. |
| 5–12 | Danışman 2–3 fırsat gösterir (ör. Çıkarıcı, Anten, Topla). Uzun hedef olarak "Tersane = ilk filo" görünür. Kasalar ikincil işaretle durur. | SPEND kilidi yok; el yalnız seçilen fırsatta |
| 12–15 | Tersane 1 → 1 Kazıcı + 2 Ok. Kaya seçimi yapılır: ilk kaya 150–300 birimde garanti (`ensureFirstRock`), başka kaya varsa yakın/az ile uzak/çok karşılaştırılır. ETA, kargo ve **dönüşte havuzda kalacak yer** görünür. | Kaya seçimi oyuncunun |
| 15–30 | **İlk av** (§5): iki sonda (~1 dk gidiş-dönüş), rapor, karar. Karşı gemi üretimi ~5 dk, karakola uçuş 3–5 dk (savaş varışta). Kazıcı bu sırada döner: getirilen, eklenen ve kaybolan ayrı görünür; toplanır. İki olay birbirini kesmez, alt yüzey tek sahiplik kuralına uyar. | Yeni kurgu |
| 30–35 | Savaş sonucu ve filo dönüşü. Kendi ikinci kararı: diğer karakol, yeni kaya, onarım planı ya da çıkmak. Kontrol devri: gerçek ETA'lar ve "döndüğünde ne olacak". Native'de push izni burada sorulur. | Veda = kontrol devri |

### Sonraki oturumlar

| Ne zaman | Oyuncu ne yaşar |
|---|---|
| Oturum 2 (+1–3 sa) | Dönüşte önce **kendi emrinin sonucu**, sonra yeni seçenek. Anten 2 → sohbet, galaksi olayları akışta (karakol sondası `FIRST_PROBE_REPORT`'u yazar). Hangar 2 → araştırma. |
| Teleskop 1 | Gerçek komşu uçuşu menzile girince kısa bir an: halka, tanınan gemi, menzilden çıkınca da izlenen rota. Temas yoksa ders bekler. Radar 1'den sonra gelen korsan gözcüsü de teleskop menziline (450) girdiğinde tanınır. Sahte temas üretilmez. |
| Radar 1 | Gözcü, Radar 1 sahibine oyundayken gerçek bir görev olarak gelir (`launchPirates`: son 10 dk'da görülmüş olmak). Önce 600 birimde `?`, sonra 450 birimde tanınan gemi olarak görünür. Bu, radar dersinin pratikte garanti olan gerçek temasıdır. Bana gelen saldırı ayrı tonda gösterilir. |
| Aegis kararı | Açık bedel/fayda kartı:<br>• **Aegis ile:** savunmada kalkan; 12 saat sonra korsan akınları başlar ve komşular sana saldırabilir; sen de komşulara saldırabilirsin.<br>• **Aegis olmadan:** ne korsan ne komşu sana saldırabilir; sen de gemilere saldıramazsın, yalnız karakollara.<br>Oyuncu seçer. |
| Motor hazırlığı | Tek plan görünümünde DT1 → DT2 erken önerilir (yakıt darboğazı); gövde 4 sa, parça avı, itki 4 sa ve yakıt aynı yerde görünür. |
| Geçiş (hızlı ~20 sa, normal 2–3 gün) | Taşınan ve taşınmayan önizlemesi (düzeltilmiş). Sezon ve slot engeli **erken** gösterilir. Atlanabilir sıçrama, ardından ana galaksi Kuruluş haftası ve ilk bağımsız karar. |

**Tempo hesabı (koddan):**
- **Çıkış kapısı kümesi 16 adımdır:** Rafineri 2/3/4, Çıkarıcı 1/2/3, Anten 1/2, Tersane 1, Hangar 2, Teleskop 1, Radar 1, DT1/2, gövde ve itki.
  - Seri onarım tabanı ≈ **14 sa 41 dk**; bugünkü zorunlu küme 23 sa 28 dk.
  - Kapı adımlarının dışında 3 parça, ilk sonda raporu ve ilk maden dönüşü gerekir.
- **Depo 1 önerilen sırada kalır ama kapı değildir.** Depo 0'da da alaşım tavanı Rafineri 4'te 8.355, kristal tavanı Çıkarıcı 3'te 2.299'dur; motor bedelleri sığar.
- **Asıl darboğaz yakıttır.** Gereken 90 D'nin 20'si DT1 hibesidir. DT1 saatte 1,9 D, DT2 saatte 4,37 D üretir. D deposu ~1.600 tuttuğu için D baştan birikir. DT2 bittikten sonra yakıt yaklaşık **15 saatte** dolar; uçuşların harcadığı D bunu uzatır. DT1'in ön şartı yoktur. Danışman DT1 ve DT2'yi erken önerirse en erken çıkış ≈ 19–20 saattir.

## 3. Rapor → iş eşlemesi

| Rapor maddesi | Karar | Paket |
|---|---|---|
| A: Mevcut sistem envanteri | Bilgi; kodla doğrulandı | — |
| B P0: ROAD ve SPEND sırası dar | Danışman (N1) | F3 |
| B P0: Bilgi karardan kopuk | İlk sonda karakol kararına bağlanır (N6) | F4 |
| B P0: Hedef sıradaki işi bitmiş sayıyor | Gerçek hata: `objective.ts:43` | F0, F1 |
| B P0: Rehber kapanınca anlam azalıyor | Tek fırsat seçicisini koç, hedef satırı, nabız ve sahne birlikte kullanır | F1, F3 |
| B P0: Başarı, istemci kilometre taşıyla karışıyor | accepted → resolved → viewed zinciri | F1 |
| B P0: Erken PvE, PvP'yi açıyor | Saldırgan için Aegis şartı (N2) | F2 |
| B P1: Tehdit, dış seferden önce geliyor | Gözcü, gönüllü bir seferden sonra gelir (N2) | F2 |
| B P1: ShipHero hasarı modülle uyuşmuyor | Hasar ve ışık modül bazlı olur | F8 |
| B P1: Rehbersiz bekleme "Waiting" kalıyor, bildirim rehbere bağlı | ETA + beklenen sonuç + sonraki karar; tercihler ayrılır | F3, F5 |
| B P1: Göç önizlemesi commit'ten farklı | Gerçek hata: önizleme `migration.ts:84`, commit `:140` | F0 |
| B P1: Sosyal bağ yok | Sohbet olayları + kohort, komşulara yakın iniş | F9 |
| B P2: Antende hareketli parça yok | Sonraya | — |
| C An 1–6 (ilk 30 dk) | §2 Oturum 1 | F3, F4, F5 |
| C An 7 (dönüş) | Önce oyuncunun kendi emrinin sonucu | F5 |
| C An 8, 12 (teleskop, radar) | Gerçek olayla öğretilir; gözcü garanti temastır | F6 |
| C An 9, 10 (sonda, ilk risk) | İlk av kurgusu | F4 |
| C An 11 (dünya tepkisi) | Sonraya | — |
| C An 13 (savunma sonrası) | Rapor/replay + kalan güç + dock | F4, F6 |
| C An 14 (komşuluk) | Sohbet olayları, kohort | F9 |
| C An 15–17 (motor, sıçrama, ana galaksi) | Plan görünümü, önizleme düzeltmesi, erken engel, ilk karar | F7, F9 |
| C: Hızlı yol dışı davranışlar tablosu | Her satır bir test senaryosu olur | F3–F7 |
| D: Görsel yoğunluğun üç kademesi | Her paketin kabulüne girer | Hepsi |
| E: PvE/PvP/dock izin sözleşmesi | Uygulanır | F2 |
| E: İlk gün pilotu | N3 ve N4'e uyarlanarak uygulanır | F2, F7 |
| E: Kurtarma hakkı | Yok | — |
| F: Metrik sözleşmesi, D1 paydası | Uygulanır | F1 |
| F: A/B ve hipotez deneyleri | Yerine huni + nitel test | F1 |

## 4. İş paketleri

Her paket TDD ile ilerler. Her kural değişikliğinin aynaları test edilir: rules, sunucu, web, botlar, 6 dil, analytics şemasının iki tarafı, pacing testleri, `packages/sim` derlemesi ve dokümanlar. Uzun simülasyon yalnız owner isterse çalışır.

### F0. Zemin — tamamlandı, 2026-11-08
- **Batch4 incelemesi:** K1–K6 ve Z1–Z3 incelendi, engelleyici kusur yok. `StarterGoalPulse`, basılacak adım yokken de 250 ms'de bir tarıyor; F3'teki yeniden yazımda düzeltilir.
- **Hata 1, göç önizlemesi:** `paidBack()`, aktif işlerin tam iadesini önizlemede ve atlayışta aynı hesapla yapar. Tavanın hem altı hem üstü test edildi.
- **Hata 2, hedef satırı:** Bütün zorunlu adımlar sıradayken itki ya da DT2 bitmemişse satır `fuel` yerine `wait` verir.
- **Zemin:** Başlangıç galaksisi `starter-galaxy` dalına alındı ve kapı yeşil olduktan sonra commit edildi (§7).

### F1. Tek gerçek durum, fırsat seçicisi ve ölçüm — tamamlandı, 2026-11-08
- **Fırsat seçicisi:** `shipObjective`'in yerini alan saf bir fonksiyondur; `apps/web/src/starter/opportunities.ts`. Bugün yapılabilecek gerçek işleri üretir:
  - Onarım, topla, kaya, karakol, sonda, gemi üretimi ve yakıt.
  - Eksik olan olgular (ilk sonda, ilk maden) de fırsat olarak çıkar.
  - Her fırsat şunları taşır: bedel, süre, ne açtığı, uygunluk ve öneri sırası.
  - Durum ayrımları: `queued / working / done` ve `havuz / depo / tank`. Sıradaki iş bitmiş sayılmaz.
- **Tüketiciler:** Koç, `ObjectiveLine`, `visualGoal` ve `StarterGoalPulse` aynı kaynaktan okur.
- **Ölçüm:**
  - Emir → sonuç → görüldü zinciri sunucu kimlikleriyle tutulur.
  - Huni paydaları: uygun → sunuldu → seçildi → kabul → çözüldü → görüldü → yeni karar.
  - D1/D3/D7 `account_created` kohortundan sayılır; `game_ready` ikincil seridir.
  - İlk kaynak başarısı net kazançla ölçülür (kargo − kaybolan).
- **Kabul:**
  - Seçici testleri şu durumları kapsar: sırada/çalışıyor/bitti, havuz/depo/tank, rehber açık/kapalı ve "yanlış erken yakıt çağrısı yok".
  - Analytics Zod şemaları iki tarafta da test edilir.
- **Teslim (2026-11-08):**
  - `opportunities()` boş olmayan sıralı bir liste döner. İlk eleman satırın söylediği şeydir; bekleme, yoldaki iş, olgu, parça veya biriktirme gibi bir durum da olabilir. Geri kalanlar o an yapılabilen işlerdir: kasanın ödediği onarımlar (önce zorunlular), ilk işler, toplama ve yakıt. Onarım fırsatı `RepairStep`'i taşır; bedel, süre ve açtığı modül oradadır. `shipObjective` silindi. `ObjectiveLine` seçiciden okur. Galakside başka gemi yoksa sonda önerilmez.
  - Starter emirleri ana oyunun ölçüm hattına bağlandı. `vessel_orders` ve `vessel_missions` artık `ordered_at`, izinli ziyaret ve deneme kimliğini taşıyor (migration 0243). Kurtarma işlemi `command_accepted` ve `outcome_resolved` kayıtlarını aynı satır kimliğiyle bir kez yazar. Maden dönüşünde `value` net kazancı, `count` dolu tesis yüzünden kaybolanı taşır. Kaydı olmayan komutlar (toplama, yakıt, izleme, geri çağırma, iptal) yanıtla onaylanır.
  - "Görüldü" kaydı istemcidedir: ekranda gösterilen toast ve açılan bildirim akışı, sonucu sunucu kimliğiyle `outcome_visible` olarak bildirir.
  - Uçtan uca yürüyüşte bulunan hata düzeltildi. Bir iş bitince sunucu `private:vessel` yayınlar, ama istemci bu olayda bildirim listesini yenilemiyordu. Bu yüzden biten onarım, tersane, araştırma ve dock işlerinin bildirimi (Teleskop ve Keşif onarımları hariç) oyuncu ekrandayken gelmiyordu: ne toast çıkıyordu ne de zil sayısı artıyordu. Olay artık bildirimleri de yeniliyor.
  - Admin raporunda iki yeni bilgi var. Birincisi `account_created` kohortudur: `accounts.created_at`'tan D1/D3/D7; bot ve admin hariç, ölçülmeyen hesap ayrı sayılır. İkincisi starter zinciridir: kabul → çözüldü → görüldü → yeni emir ve ilk maden dönüşünün net kazancı. Eski game_ready kohortu ikincil seri olarak duruyor.
- **Bilinçli olarak sonraki pakete kalanlar:**
  - Koç, `visualGoal`, `StarterGoalPulse`, ShipHero ve `backIn`, ROAD'un yerini alan F3 danışmanıyla seçiciye geçer. Bugün geçirmek aynı işi iki kez yapmak olurdu.
  - Karakol ve gemi üretimi fırsatları kural değişikliği (F2) ve İlk av (F4) ile gelir.
  - Uygun → sunuldu → seçildi adımları danışman kartlarıyla (F3) ölçülür.
  - Savaş zinciri F4'te bağlanır: `BATTLE_REPORT` rapor kimliğini taşır, seferin kimliği `vessel_battle_reports.mission_id`'dedir.

### F2. Kural değişiklikleri (rules + sunucu)
- **Ladder:**
  - `DRIVE_HULL`: `FIRST_BATTLE_REPORT` çıkar, `needs('RADAR', 1)` girer, süre 240 dk.
  - `DRIVE_THRUST`: 240 dk.
  - `AEGIS 1`: `required: false`. Onarım yüzdesi ve DEFENCE grubunun toplamı değişir: grup Teleskop 1 ve Radar 1 ile 2 adım olur.
  - `partsVisible` motor paneline bağlı kalır; panel yeni gereksinimle açılır.
- **Saldırı izinleri:**
  - Karakol saldırısı `fleet` ile açılır (`launchVesselFleet` içindeki karakol dalı).
  - `attack` (gemiye saldırı) için `OPENS.attack` = `FIRST_BATTLE_REPORT` ve `AEGIS ≥ 1`.
  - `canAttackVessel` saldırganın `pvpOpenAt` kaydını da ister; hedef için aynı şart zaten var. Kontrol gönderimde ve varışta yapılır.
  - Dock (hasar onarımı) `attack` yerine `fleet` ve gerçek hasara bağlanır.
- **Özellik kartları:** `fleet` kartı karakolları da anlatır. `attack` kartının metni Aegis şartını söyler. İkisi de 6 dilde.
- **Korsan:** Gözcü yalnız oyuncunun en az bir gönüllü dış seferi (`MINE`, `PROBE` veya `RAID_SITE`) varsa gelir. Akın yine Aegis ister.
- **Karakol garantisi:** `ensureFirstRock` desenindedir. Tersane 1 bitince geminin 300–450 birim yakınında iki karakol olur (Ok ile 3–5 dk uçuş):
  - **Sv1 Sur bekçili:** elindeki Ok'lar yener.
  - **Sv2 Akıncı veya Mızrak bekçili:** karşı gemi gerektirir.
  - Böyle bir çift yoksa ortak bir karakol yerleştirilir. Galaksi başına bir sınır vardır ve karakol kimseye ayrılmaz.
  - **Ölçülen kesin zafer oranları** (starter çözücüsü, 400 tohum):

    | Saldıran | 2 Muhafız (Sv1 Sur) | 3 Ok (Sv2 Akıncı) | 3 Kargı (Sv2 Mızrak) |
    |---|---|---|---|
    | 2 Ok (başlangıç filosu) | **%89** | %0 | %0 |
    | 2 Ok + 2 Kargı | — | **%96** | %62 |
    | 2 Ok + 2 Muhafız | — | %75 | **%92** |

    Doğru karşı gemi oranı belirgin biçimde yükseltir; yanlış seçim kaybettirmez ama riski artırır. Hiçbir sonuç kesin değildir.
- **Botlar:** Aynı kurallar ve aynı servisler geçerlidir; bot için ayrı yol veya işaret yoktur.
  - Botlar `takeShipBotTurn` içinde `nextRequiredStep`'i izler; Aegis seçimli olunca hiçbir bot Aegis almazdı ve PvP'de, korsan akınında yalnız insanlar kalırdı, bu da botu ayırt ettirir. (Warmstart `startPartWay` en fazla 8 adım verir, Aegis'e ulaşmaz.)
  - Bu yüzden `shipBots` içinde Aegis için insanlarınkine benzer bir seçim politikası tanımlanır.
- **Kabul:**
  - Aegis'siz bir karakol galibi, başka bir gemiye doğrudan API isteğiyle saldıramaz; gerçek ve bot hedef aynı cevabı alır.
  - PvE hasarı PvP'ye girmeden onarılabilir.
  - Gönderim ile varış arasında değişen uygunluk yeniden kontrol edilir.
  - Pacing testleri yeni kapı kümesiyle geçer; ilk gün çıkışı yalnız en hızlı yolda mümkündür.
  - Yeni ret metinleri 6 dilde vardır.
- **Teslim (2026-11-08):**
  - Ladder: gövde Radar 1 ister, gövde ve itki 240 dk; Aegis 1 isteğe bağlı adımların başında. Göç kapısı 16 adım, ilerleme çubuğu 19 üzerinden sayar. Gemi saldırısı `attack` (Aegis 1 + `FIRST_BATTLE_REPORT`); `canAttackVessel` saldırganda `pvpOpenAt` yoksa `FEATURE_LOCKED` döner. Saldırganın şartları geri gitmez (Aegis ve olgu düşmez), varışta hedefin şartları zaten yeniden sorulur.
  - Karakol baskını, Onarım İstasyonu (dock) ve savaş simülatörü `fleet` ile açılır; sunucu ve web aynı kapıyı okur. Karakol kartı kapalıyken Tersane şartını, gemi kartı kapalıyken Aegis + savaş şartını ve Aegis'in gemiyi de hedef yaptığını söyler. `fleet`, `attack` ve `defence` kartları 6 dilde güncellendi.
  - Gözcü, gemi sahibinin `vessel_missions` içinde kendi gönderdiği bir satırı yoksa gelmez (korsan ve gözcü satırlarının sahibi yoktur).
  - İlk iki karakol `ensureFirstOutposts` ile Tersane 1 bitince eklenir (`firstOutposts: near 300, far 450, extraMax 8`); yerleşim kuralları `packages/rules/src/starter/sites.ts`'te. Tersane 1'in bitişi `private:vessel-sight` yayınlar, harita yeni karakolları hemen çizer. `layOutOnce` yalnız enkaza bakar; ilk karakollar galaksinin kendi yerleşiminden önce gelirse o yerleşim yine yapılır.
  - Botlar: her gemi `seededFrom(id, 'aegis')` ile bir kez seçer, yaklaşık %60'ı Aegis 1 alır; onarım ve karakol baskını `fleet` ile açılır, gemi saldırısı `attack` altında kalır. Warmstart (`startPartWay`) en fazla Kristal Ocağı 3'e ulaştığı için Aegis vermez; ayrı bir `pvpOpenAt` düzeltmesi gerekmedi, değişmez testle bağlandı.
  - 350×812 yürüyüşü (Tersane 1 yeni bitmiş, savaşsız ve Aegis'siz gemi): galakside 8 + 2 karakol, karakol kartında "Saldırı planla" açık, Tersane güvertesinde Onarım İstasyonu var, yatay taşma ve sayfa hatası yok. Gemi kartının kilit metni yalnız birim testle doğrulandı; haritada bir gemiyi açacak DOM yolu yok. Harita listesi karakolları adla sıralıyor, ilk ikisini öne almıyor: bu F4'ün işaretleme işidir.
  - Yürüyüşte bulunan ve düzeltilen hata: koç alta yerleşmişken "Rehber istemiyorum" onayı kartın altında açılıyor, onay düğmelerine basılamıyordu. Onay açıkken kart çekiliyor, "Rehberle devam et" ile geri geliyor.
  - **Tempo, plandan farklı çıktı.** Aynı model (`starter-pacing`): günde 1 oturum 6,8 gün, 2 oturum 3,4 gün, 3–4 oturum 2,5 gün, 15 oturum 1,7 gün. "İlk gün çıkışı yalnız en hızlı yolda" kabulü tutmaz: hiçbir düzen ilk gün göç etmez. Darboğaz motor veya yakıt değil, onarımlar ve kaynak; Döteryum Rafinerisini öne çekmek süreyi uzatır. Testler ölçülene sabitlendi; daha hızlı bir tempo isteniyorsa owner kararıdır.

### F3. Rehber: kısa temel + danışman
- **Sıkı bölüm:** Yalnız birleşik geçiş anı, ilk toplama ve ilk onarım (bedel, süre, kuyruk). Kapı, el ve harcama kilidi yalnız burada.
- **Danışman:**
  - Seçiciden en fazla 3 fırsat kartı gösterilir; biri önerilen olarak işaretlenir.
  - Kartta bedel, süre ve ne açtığı ikon ve sayıyla, az yazıyla verilir.
  - Oyuncu birini seçer; el ve nabız yalnız onu gösterir.
  - Öneri dışı bir hamle de geçerli ilerleme sayılır, liste yeniden hesaplanır. Yapılmış şey tekrar öğretilmez.
- **İlk kez gelen anlar:** İlk tersane, ilk kaya, ilk karakol ve ilk sensör tek bir kısa vurguyla tanıtılır. Sonraki örneklerde el yoktur; oyuncu isterse yardımı geri çağırır.
- **Kasalar:** Yalnız ilk kasa öğretilir; diğerleri ikincil işaret olarak kalır.
- **Bekleme:** Gerçek ETA, beklenen sonuç ve dönüşteki karar gösterilir. `AwayChip` kalır.
- **Tercihler:** "Rehber istemiyorum" hesapta saklanır (cihazlar arası, yeni sütun ve migration dosyası). Bildirim izni rehber tercihinden bağımsızdır.
- **Aynalar:** `STARTER_TUTORIAL_STEPS` sunucudaki rehber hunisini (`starterFunnel`) ve analytics sözlüğünü besler; ikisi de yeni adımlarla güncellenir.
- **Kabul:**
  - Senaryo testleri: rehber açık/kapalı, öneri dışı seçim, bütün kaynağı harcama, 2. dakikada çıkış, uçuş sürerken çıkış.
  - 350×812 yürüyüşleri iki türlüdür: biri işaretleri izler, diğeri rehbersiz kendi kararını verir.
- **Teslim (2026-11-08):**
  - **Çekirdek:** `online` (karşılama, güç kartının üstünde tek an) → `collect` → `orderRefinery` → `waitFirst`. Kart "1/2, 2/2" sayar. Kapı ve harcama kilidi yalnız burada. Rafineri 2 bitince çekirdek biter; gemi kaydı ilerideyse yeni telefonda da tekrar edilmez.
  - **Anlar (zaman sırasıyla, kilitsiz):** ilk kasa → ilk sonda raporu (`openIntel`, `openReport`, `report`) → ilk av (`mine`, `mineFlying`, `collectMine`, `farewell`) → teleskop ×3 → radar ×3. Geri kalan her an `{ kind: 'advise' }`.
  - **Danışman:** Sıradaki satırı seçimi, yoksa ilk teklifi söyler. Yanındaki "Diğer seçenekler" en fazla 3 satır açar: ikon, bedel, süre, kazanç; ilki "Önerilen". Çekirdekten sonra gemi başına bir kez kendiliğinden açılır (yalnız rehber açıkken). Seçim cihazda gemi başına (`astera.starter.advice.<vesselId>`) tutulur; listeden düşünce bırakılır. Öneri dışı hamle geçerlidir, liste yeniden hesaplanır.
  - **İşaret kuralı (benim UX kararım, geri alınabilir):** Nabız rehberin adımını, yoksa seçimi, yoksa ilk teklifi izler; böylece rehbersiz oyuncu da nereye basacağını görür (Z2). El yalnız rehber açıkken seçimde çıkar. Alt sekme çubuğundaki hedefte el zaten gizlenir (`TutorialHand` taban kuralı, eskiden beri); orada çerçeve görünür.
  - **Bekleme satırı:** Rehberin beklediği onarım veya danışmanın bekleme teklifi gerçek geri sayım ve arkasındaki kasayla gösterilir.
  - **Hesap tercihi:** Migration 0244 `accounts.starter_guide_off_at`. `/api/auth/me` ve claim yanıtı `starterGuideOff` taşır; `PUT /api/auth/me/starter-guide { off }`. İstemci anında uygular, kayıt düşerse bu ziyaret yine hatırlar. Menü → Akademi → "Rehberi yeniden aç" (yalnız gemide ve rehber kapalıyken). Kapatma onayı geri dönüş yolunu söyler (6 dil).
  - **Bildirim izni bağımsız:** Rehber kapalı oyuncuya izin sorusu, rehberin veda edeceği yerde (ilk av eve dönünce) gelir; subayın ipucu gelmez.
  - **Aynalar:** `STARTER_TUTORIAL_STEPS` = `ROAD` sırası; huni ve analytics `starter-tutorial.v2` sayar.
  - **Kaldırılanlar:** Metin anahtarları (6 dil): `lookAround`, `welcome`, `orderExtractor`, `orderAntenna`, `orderExtractor2`, `waitAntenna`, `intelOnline`, `probe`, `probeFlying`, `welcomeBack`, `collectAgain`, `orderRefinery3`, `finale`, `openCrates`, `orderVault`, `waitRefinery`, `openRefineryCrate`, `orderShipyard`, `orderExtractor3`, `waitShipyard`, `openShipyardCrate`, `collectForExtractor`; 3. ve 5. bölüm adları. Kod: cihazdaki `guidePreference.ts`, çekirdek dışı harcama kilidinin dalı ve yalnız onun okuduğu `goal` alanı.
  - **Bulunan hata ve kural düzeltmesi (owner onayına):** Döteryum Rafinerisi 1'in şartı yoktu ve 300 kristal istiyordu; bu, açılıştaki kristalin tamamı. Kristal Ocağı 1'den önce gemi kristal üretmez. Rehbersiz oyuncu ilk dakikada (rehberli oyuncu ilk kasadan sonra) bunu alırsa hiçbir onarımı bir daha ödeyemiyordu. Eski rehberin harcama kilidi bunu gizliyordu; N1 kilidi çekirdekle sınırlayınca açığa çıktı. Şimdi Kristal Ocağı 1 ister. `starter-ladder` Kristal Ocağından önce erişilebilen her durumu tarar ve kilitlenme bulmaz; sunucu reddi ayrıca test edildi. Tempo testleri değişmeden geçer. Başka bir çözüm istenirse tek satırdır.
  - **Senaryo testleri:** `starter-guide-scenarios` (rehber açık/kapalı, öneri dışı seçim, her şeyi harcama, 2. dakikada çıkış, uçuş sürerken çıkış).
  - **350×812 yürüyüşleri:** İşaretleri izleyen oyuncu çekirdeği, ilk kasayı ve kendiliğinden açılan danışmanı geçti; öneri dışı seçim sıradaki satıra ve işarete yansıdı. Rehbersiz oyuncuda onay geri dönüş yolunu söyledi, yeniden yüklemede subay gelmedi, seçimde el çıkmadı, Akademi'den rehber geri geldi ve kaldığı adımdan sürdü. Yatay taşma ve sayfa hatası yok.

### F4. İlk av (karakol kurgusu, N6–N7)
§5'teki akış uygulanır.
- **Mevcut parçalar kullanılır:**
  - Sonda karakola gider; `readSite` tahmini bekçi sayısını ve `classReading` sınıf okumasını verir.
  - Starter tersanesi Ok, Kargı ve Muhafız üretir (2 gemi ≈ 5–6 dk).
  - `signalGuide` ekran dışındaki hedefe ok çizer.
  - `CounterMark` sınıf üstünlüğü işaretini, `matchupPower` güç karşılaştırmasını verir.
  - Karakolların isimleri `outpostName` ile zaten var.
- **Eklenecekler:**
  - Raporda sınıf üçgeni ve "taşıyabileceğin: X" kargo satırı.
  - Üretim ve gönderim ekranlarında seçilen hedefe karşı ✓/✗ işareti.
  - Karakol bayrağı görseli.
  - Savaştan sonra ganimet, hasar ve dock yolu.
  - İlk zafer kasası (N9). Aynaları: `crates.ts`, kasa kaydı (çift alma ve eşzamanlılık testleri), botların kasa alması, `CrateBay` ve 6 dil.
- **Kabul:**
  - Kazanma, kısmi sonuç, kaybetme ve "başkası önce aldı" sonuçlarının her biri anlaşılır bir sonraki adımla biter.
  - Zafer garantisi veya gizli hasar azaltımı yoktur.
  - Ses, titreşim ve görsel tepki birlikte gelir; sessiz modda da sonuç okunur.
- **Teslim (2026-11-08):**
  - **Zafer kasası (N9):** Olgu `FIRST_OUTPOST_VICTORY`; kasa Tersane 1 bölmesinde, 450 alaşım / 200 kristal. Miktarı `starter-victory-crate` sabitler: kesin zaferde en kötü dalın ortalama kaybını (kayıp + dock bedeli − ganimet) karşılar. Çift açma, eşzamanlı açma ve botların açması test edildi.
  - **Ölçerken bulunan hata:** `dockBill`, alt baz-puan hasarlı bir gemi parçasında (`damageBp` 0, kalan > 0) çöküyordu: tersane ekranı, sunucudaki dock emri (500) ve bot döngüsü. Artık ana oyunun `shipRepairMinutes` yolundan geçer.
  - **Rapor (F4b):** Karakol okumasında üçgen (bekçinin sınıfı yanar, "› sağdakini yener · ↺ Mızrak › Akıncı"), sınıf payları yüzde olarak ve "taşıyabileceğin: X" kargo satırı. Yüzde birimi hatası (5500–10000%) görsel yürüyüşte bulundu, önce test sonra kod düzeltildi.
  - **✓/✗ (F4c):** Tersanede "Karşı" seçicisi (en yeni okunmuş karakol varsayılan) ve her gövdede `MatchupMark`; saldırı planında da aynı işaret. İşaret ✓/=/✗ ve gerçek çarpan (×1,6, ×1, ×0,625); üçgen kullanılmaz, çünkü Akıncı'nın simgesiyle çakışıyordu. Gemiden çıkan saldırı planının başlığı artık kaynağı yazmıyor (gemi adı = komutan adı, hedef gibi okunuyordu).
  - **Bul (F4d):** Sunucu, avın iki karakoluna haritada `firstHunt` işareti koyar. İşaret ilk zaferde, karakol düşükken ve başka bir geminin haritasında kalkar. Galakside adlı altın flama durur; ekran dışındaysa kenarda bekleyip yönü gösterir, hedef satırının üstünde kalır ve açık karakolda gizlenir. Karakol listesinde ikisi "İlk av · Muhafız seviyesi N" diye başta yer alır.
  - **Rehber anı (F4e):** `huntStage` haritadan, raporlardan ve geminin kendi uçuşlarından avın adımını okur: sondala → sondalar yolda → karşılaştır → filo yolda. Kazıcı gönderildikten sonra hedef satırı bunu söyler: "Kazıcın yolda. Bu arada iki korsan karakolu var…". Dokunuş sondalanacak karakola ya da sonda raporlarına gider. Danışmanda av ilk sıradadır; el sonda düğmesini, yoksa karakolun flamasını gösterir.
  - **Sonuç dalları (F4f):**
    - Oyuncu galaksideyken biten karakol savaşı, filonun izlendiği yerde bir sonuç kartıyla gelir. Kartın rengi, sesi ve titreşimi derecesine uyar: zafer `claim` + `commit`, kısmi `confirm`, püskürtülme `impact` + `thunk` ve sarsıntı. Kart filo izlemesini kapatır.
    - İlk zaferde "Kasayı aç" gemiyi açar; diğer sonuçlarda "Raporu oku" raporun kendisini açar.
    - Dışarıdayken biten savaş bu kartta gösterilmez; onu "Sen yokken" kartı anlatır, böylece iki kez anlatılmaz.
    - Raporun "neden" kutusu sınıf eşleşmesini çarpanla söyler. Kötü ya da denk eşleşmede o bekçiyi yenen gemiyi adlandırır.
    - Kaybedilen gemilerin yeniden yapım bedeli ve süresi yazılır, ardından "İlerlemen yerinde" denir.
    - İlk zafer kasanın beklediğini, "başkası önce vardı" ise kimin vardığını söyler. Zil metinleri de aynısını söyler.
    - Dock yolu raporun hasar kutusunda zaten vardı.
  - **Kural değişikliği (owner onayına, geri alınabilir):** Bekçisi başka bir geminin akınıyla düşmüş bir karakola inmek zafer sayılmaz. Kasa açılmaz, av sürer ve harita işareti öteki karakola döner. Sebep: savaşsız bir iniş kasayı bedavaya veriyordu ve planın "başkası önce aldı → öteki karakol" dalıyla çelişiyordu.
  - **Bulunan önceki hata:** Gemide zildeki savaş bildirimi raporu değil listeyi açıyordu. Bildirim rapor kimliğini taşıyor, `reportFor` ise yalnız sefer kimliğiyle eşleşiyordu. Artık yalnız gemi raporlarında kendi kimliğiyle de eşleşir; ana oyunun "yalnız sefer" kuralı korunur.
  - **Kararsız test düzeltildi:** `starter-first-outposts`'taki "başka geminin haritasında işaret yok" testi öteki gemiyi bizimkinin aynasına koyuyordu. Merkeze yakın doğan bir gemide ayna nokta aynı banda düşüyor ve işaret doğru biçimde görünüyordu. Test artık iki karakolun bandının dışında bir nokta seçiyor. Kod değişmedi.
  - **Senaryo testleri:** `starter-hunt-scenario` (sondala → karar → kayıp → karar → zafer, başkası önce aldı), sunucuda `starter-combat` (ilk zafer işareti, başkası önce aldı, savaşsız inişte kasa yok).
  - **350×812 yürüyüşleri:** okuma kartı, tersane seçicisi ve işaretler, saldırı planı, flamalar ve liste, danışman satırı → sonda raporları. Gerçek akışta da iki saldırı yapıldı: Tevis'e 2 Ok (kesin zafer, ilk zafer) ve Eldeth'e 2 Ok (denk, püskürtüldü). Kart savaş yerinde, dönen filoyla birlikte göründü; "Raporu oku" doğrudan raporu açtı, "neden" kutusu denk eşleşmeyi söyledi. Yatay taşma ve sayfa hatası yok. Sonda aşamasının hedef satırı yürüyüşte görülmedi, çünkü kullanıcı zaten sondalamıştı; birim testle doğrulandı.

### F5. Sonuç ve dönüş
- **Kaya gönderimi:** "Dönüşte havuzda X yer var" bilgisi ve gerekirse "önce topla" önerisi.
- **Maden dönüşü:** Getirilen, eklenen ve kaybolan miktar ayrı görünür; `returnStory` kaybolanı (`wasted`) düşer.
- **Dönüş özeti:** Önce oyuncunun kendi emri ve sonucu, beklenen ile gerçekleşenin farkıyla. Sonra yeni seçenek. `newUnlocks` doldurulur. Tek ana an gösterilir, ayrıntılar isteğe bağlıdır. Çoklu cihazda aynı büyük karşılama tekrar etmez.
- **Kasa açılışı:** Ship log'a kayıt düşer; batch4'te açık kalan boşluk budur.
- **Teslim (2026-11-08):**
  - **Kaya gönderimi (F5a):**
    - Kaya ve enkaz kartı artık her zaman bir satır söyler: "Döndüklerinde havuzda X yer olacak".
    - Eski hesap iki yerde yanlıştı. Bugünkü boş yeri tek toplam olarak gösteriyordu. Oysa uçuş sürerken havuz üretimle dolar (dönüş yükle yarım hızdadır, toplam yol ≈ 3 × gidiş) ve her kaynak kendi tavanında durur.
    - Yeni hesap `haulAtHome`, `worksAt` ile havuzu dönüş anına ilerletir; takviye ve kesinti de buna dahildir.
    - Kayıp varsa kaybolan kaynak adıyla söylenir ("117 alaşım ve 63 kristal sığmaz"). Toplanacak bir şey varsa kartta "Önce topla" düğmesi çıkar (titreşim, kargo sesi, toast). Depo da doluysa "önce bir şey harca" denir.
    - Kart ana oyunla ortak; düzeltme iki tarafa da gider. Kural değişmedi, yalnız anlatım düzeldi.
  - **Maden dönüşü (F5b):**
    - Zil ve canlı toast getirilen, havuza giren ve sığmayan miktarı ayrı söyler. Boş dönüş ve itki parçası ayrıca söylenir.
    - "Sen yokken" kartı ve `returnStory`, havuza girmeyeni (`wasted`) düşer ve ayrıca yazar.
  - **Dönüş özeti (F5c):**
    - Gemide kart tek bir büyük anla açılır: oyuncunun kendi emrinin sonucu. Öncelik sırası ilk zafer, sonra diğer savaşlar, sonra maden dönüşü.
    - Kendi emri yoksa ana anı tehdit alır. Geri kalanı "Ayrıntılar (n)" altında bir dokunuş uzaktadır.
    - Püskürtülen saldırı amber "kayıp" tonuyla gösterilir; kırmızı yalnız tehdide aittir (K2). Ana an tonuna göre ses çalar.
    - Sunucu 5 satır sınırından önce oyuncunun kendi emirlerini öne alır; çok sayıda saldırı varken filo dönüşü artık listeden düşmez.
    - `newUnlocks` doldurulur: açılmış ama henüz anlatılmamış özellikler. Kart bunları sistem adıyla tek satırda söyler ("Sen yokken yeniden çalışmaya başladı: Kargo ve hangar · Sörvey anteni"). Asıl anlatımı yine galaksideki açılış anı yapar, böylece iki kez anlatılmaz.
    - Ana oyunun kartı değişmedi.
    - Çoklu cihaz: pencere gemi kaydında kapanır. Bir cihazda kapatılan hikâye ötekinde yeniden açılmaz; oyuncu bir cihazda oynarken pencere sürekli ileri alındığından ikinci cihazda karşılama çıkmaz.
  - **Kasa (F5d):** Açılış `CRATE_OPENED` olarak seyir kaydına okunmuş biçimde düşer (oyuncunun kendi eliyle yaptığı iş zili çaldırmaz). Zafer kasası adıyla, diğerleri sayısıyla yazılır ve gemiye götürür. El kitabının "havuz" maddesine maden yükü kuralı eklendi (6 dil).
  - **350×812 yürüyüşü:** Uzak kartında ana an "Tevis düştü" (zafer kasası), sonra amber "Saldırın püskürtüldü" ve ayrıntılar göründü. Kaya kartında kayıp satırı göründü, "Önce topla" sonrası yalnız deposu dolu kristalin kaldığı görüldü. Kasa kaydı düştü. Taşma ve sayfa hatası yok.
  - **Yürüyüşte bulunup düzeltilenler:** İlk zafer, maden dönüşünün altında kalıyordu; repelled saldırı yeşildi; "bol yer var ama kayboluyor" satırı kaynağı söylemiyordu.

### F6. Sensörler ve Aegis kararı
- `sightLesson`'daki "İleri" ile geçilen üç okuma, gerçek olayla tetiklenen kısa anlara döner: göster, incele, izle.
  - Teleskop: önce komşu trafiği, yoksa gözcü.
  - Radar: gözcünün `?` görüntüsü.
  - Temas yoksa ders bekler. Radar 1 çıkış kapısında ve gözcü oyundaki her Radar 1 sahibine geldiği için iki ders de pratikte çıkıştan önce yaşanır; ana galaksiye bayrak taşımak gerekmez.
- Aegis seçim kartı §2'deki metinle yapılır.
- **Teslim (2026-11-08):**
  - **Sensör dersleri gerçek temasla açılır.** Her adım kendi öznesini bekler (`ready`); temas yoksa ders susar, uydurma temas yoktur. Canlı gökyüzü `sightNow` ile okunur (halkada tanınan uçuş, halkadan çıkıp izlenen uçuş, radar `?`'i).
    - Teleskop: halkada bir uçuş belirince "göster" satırı; ardından "Uçuşa dokun" (basma adımı): sahnedeki işaret dokunulabilir olur ve temas paneli açılır; uçuş halkadan çıkınca "izle" satırı.
    - Radar: gözcünün `?`'i radar halkasına girince iki satır; teleskop o uçuşu tanıyınca kapanış satırı ("Sonda içini okur, teleskop tanır, radar uyarır").
    - Gözcü önce radara girdiği için radar dersi önce başlayabilir; teleskop dersi kapanış satırından önce araya girer.
    - İlk görüşte ses ve titreşim: radarda uyarı, teleskopta onay sesi.
  - **Aegis seçim kartı:** Savunma sekmesinde Aegis 1 kartı "Aegis ile / Aegis olmadan"ı yan yana gösterir; onarım basılı tutularak yapılır (geri alınamaz).
    - **Koddan doğrulanan metin, §2'den farklı:** Korsanlar Aegis 1'den hemen sonra gelir (`launchPirates`), 12 saat beklemez. 12 saat yalnız komşuların saldırısı için geçerlidir (`shieldHours`). Kart bunu söyler; kural değişmedi.
    - Eski tek satırlık risk uyarısı (`feature.defence.risk`) kartın yerini aldığı için silindi (6 dil).
  - **Yürüyüşte bulunan ve düzeltilen hatalar:**
    - Rehberin "basınca sayılan" adımları basma sırasında kaydediliyordu. Kayıt rehberi ilerletiyor ve adımın kendi işaretini kaldırıyordu; düğmenin kendi işi (temas panelini açmak) hiç çalışmıyordu. Kayıt artık basma bittikten sonra yapılır (`ackAfterPress`); tüm basma adımlarını kapsar.
    - Sahne işaretine dokunuş arkadaki gökyüzüne de gidiyor ve "Hedefin: Vantage" kartını açıyordu. İşaret artık dokunuşu sahneye geçirmez.
    - Starter'da korsan veya gözcü temasına dokunmak hiçbir şey açmıyordu: ana galaksinin korsan paneli starter'da olmayan korsan listesini okur. Gemideyken korsan teması sıradan temas paneliyle açılır (`contactRail`). Bu daha önceden var olan bir hataydı.
  - **350×812 yürüyüşü (gerçek gözcü ve bot sondası):** Radar `?` → iki radar satırı → teleskop satırı → "Uçuşa dokun" → dokunuş "Korsan filosu · Küçük filo" panelini açtı → kapanış satırı. Aegis kartı tam genişlikte, taşma ve sayfa hatası yok. "İzle" satırı yürüyüşte görülmedi (gözcü halkadan çıkmadan vardı); birim testle bağlı.
  - **Not, kapsam dışı:** Bana gelen korsanın temas panelinde "Varışı bilinmiyor" yazıyor; radar varışı biliyor. Mevcut ana oyun metni, raporlandı.

### F7. Motor, yakıt ve geçiş
- **Plan görünümü:** DT1 ve DT2 erken önerilir, yakıt darboğazı süresiyle birlikte gösterilir; parça avı ve iki motor da aynı görünümde.
- **Adlandırma:** "Çıkışa hazırlık" (kapı kümesi) ile "geminin tüm sistemleri" (onarım yüzdesi) ayrı adlandırılır.
- **Erken engeller:** Sezonun son 5 günü ve `NO_FRONTIER`/slot engelleri önceden gösterilir.
- **İnişten sonra:** İlk bağımsız ana oyun kararı. Taşınan kargo, ilk sezon paketi ve kullanılabilir toplam ayrı gösterilir.
- **Kabul:** Saga her aşamada çökme ve yeniden başlama testinden geçer; tek başkent ve tek kargo oluşur. 24/48/72 saat sonra dönüş ve uyku senaryoları test edilir.

### F8. Gemi görseli
- `ShipHero` ve `VesselBody` hasarı ve ışığı, genel %35/%80 eşikleri yerine o modülün gerçek durumundan okur; onarılan bölümün hasar efekti söner.
- Üç yoğunluk kademesi uygulanır: rutin seçimde küçük yerel cevap, ilk yetenekte nesne + sahne + tek bilgi, büyük sonuçta kısa güçlü sunum. Aynı olay üç kez kutlanmaz.
- Antenin pivotu ve rig'i sonraya kalır.

### F9. Eski plandan korunanlar
- Sohbette galaksi olayları + kohort yerleşimi (eski F5, dron hariç).
- Kuruluş haftası (eski F7–F8): ödül paneli, Tümünü al, Git kapıları, eski komşulara yakın iniş, klan önerisi, ilk hafta push ve silinme sınırı.
- Yeni Komutan 7 Günü (eski F6), en sonda.

## 5. İlk av: akış

1. **Tetik:** Tersane 1 biter ve oyuncu Kazıcı'yı gönderir. NPC: "Kazıcın yolda. Bu arada iki korsan karakolu var, bekçilerini bilmeden saldırmayız."
2. **Bul:** Kamera serbest kalır; ekran kenarındaki oklar iki karakolu gösterir. Oyuncu kamerayı kaydırıp onları bulur. Karakolların ismi ve bayrağı vardır.
3. **Sondala:** İki karakola sonda gönderilir; her biri 65 alaşım / 40 kristal, gidiş-dönüş ~1 dk. Sondaların uçtuğu görünür. Rapor, sonda eve dönünce okunur.
4. **Oku:** İki rapor yan yana gelir: tahmini bekçi sayısı, sınıf karışımı, stok ve "taşıyabileceğin" kargo. Kurallar raporun içindedir:
   - Sınıf üçgeni: Mızrak, Akıncı'yı yener; Akıncı, Sur'u; Sur, Mızrak'ı.
   - Gemi karşılıkları: Kargı = Mızrak, Ok = Akıncı, Muhafız = Sur.
   - Cevap verilmez; girdiler ve kural verilir.
5. **Karar:**
   - **Şimdi:** Sur bekçili Sv1 karakola elindeki 2 Ok ile saldır. %89 kesin zafer, ortalama ~0,6 Ok kaybı, hemen sonuç.
   - **Yatırım:** Önce karşı gemi üret, sonra Sv2 karakolu vur:
     - Akıncı bekçiliye karşı 2 Kargı: 608 alaşım / 242 kristal.
     - Mızrak bekçiliye karşı 2 Muhafız: 760 alaşım / 304 kristal.
     - Üretim ~5–6 dk. Kazanç, daha güçlü ve kalıcı bir filodur.
   - **Vazgeç:** Kazıcı'ya dön.
   - Ganimet iki dalda da kargoyla sınırlıdır ve bu açıkça yazar. İlk kesin zafer ayrıca tek seferlik zafer kasasını açar (N9).
   - Üretim ve gönderim ekranındaki ✓/✗ işareti, her geminin hedefe karşı durumunu gösterir.
6. **Saldır ve gör:** Uçuş görünür ve savaş varışta olur; sahne atlanabilir. Sonuç gelir: ganimet filo dönünce depoya iner, hasarlı gemi dock'ta onarılabilir. Rapor kararın nedenini anlatır, örneğin "Kargıların Akıncı bekçileri dağıttı". Bu zafer `FIRST_BATTLE_REPORT`'u yazar.
7. **Sonraki soru:** Diğer karakol hâlâ orada; Kazıcı'nın getirdiği toplanacak; bir onarım karşılanabilir. Oyuncu ikinci kararını kendisi verir.

**Sonuç dalları:**
- **Kayıp:** Prospector etkilenmez. Yeni Ok'un bedeli (304/121) ve süresi (~2,5 dk) gösterilir; ilerleme sıfırlanmaz.
- **Başkası önce vurdu:** Gerçek neden gösterilir, öteki karakol önerilir. Karakol 6 saatte yeniden doğar.
- **Oyuncu çıktı:** Üretim ve uçuşlar gerçek zamanda biter; dönüşte sonuç önce gelir.

## 6. Sıra ve bağımlılık

```text
F0 zemin → F1 seçici + ölçüm ─┬→ F2 kurallar ─┬→ F3 rehber ─┬→ F4 ilk av ─→ [M1 owner playtest: ilk oturum]
                              │               │             └→ F6 sensörler + Aegis
                              │               └→ F7 motor ve geçiş ─→ F9 eski plan maddeleri
                              └→ F5 sonuç ve dönüş
F8 görsel: F0'dan sonra, bağımsız                           → [M2 owner playtest: 2. oturum → geçiş]
```

**M1 kabulü:** Owner yeni bir hesapla ilk 30–35 dakikayı oynar. Codex fare testçisi de oynar ve rapor yazar; rapor körü körüne kabul edilmez, doğrulanır.

## 7. Çalışma yöntemi
- **Uygulama (owner, 2026-11-08):** Paketleri sırayla Claude uygular, CLAUDE.md'ye ve TDD'ye uyarak. Süre baskısı yoktur.
- **Yer (owner, 2026-11-08):** Bütün iş `blindspace-starter` worktree'sinde, `starter-galaxy` dalında yapılır. Bu dal master `647eb5f3`'ten açıldı. Her paket kendi commit'iyle kapanır ve push edilmez. master'a gelen her commit dala hemen birleştirilir, özellikle migration içeriyorsa. Main'deki commit edilmemiş kopyaya dokunulmaz.
- **Test:** Kısa koşular 1 worker. Tam koşular 4 worker × 1 GiB, her worker kendi `_test` DB'siyle.
- **VPS deploy, prod migration:** Yalnız owner istediğinde. Yerel migration dosyası yazmak serbesttir.
- **Doküman güncellemeleri (her paketle):**
  - `baslangic-galaksisi-plani-2026-11-04.md`: ladder, süreler, izinler.
  - `game-design.md`, `review-onboarding.md`.
  - Wiki ve yardım, 6 dilde.

## 8. Riskler

| Risk | Önlem |
|---|---|
| Yakıt darboğazı (DT2 bitişi + ~15 sa) ilk gün hedefini zorlar | Danışman DT1 ve DT2'yi erken önerir; ölçümden sonra gerekirse owner'a yakıt hızı sorulur |
| İlk oturum 30–35 dakikaya uzar | Yatırım dalı doğal bir dönüş nedenidir; oturumun dakika tavanı yoktur, huni ölçer |
| İlk karakol zaferi ekonomik olarak zarar (kargo sınırı) | İlk zafer kasası (N9); kargo kuralı raporda açık gösterilir |
| Erken kayıp (2 Ok) moral bozar | Sv1 Sur'da 2 Ok %89 kazanır; kayıpta yeni Ok ucuz ve hızlıdır; rapor nedeni söyler |
| Yatırım dalı ilk oturumda karşılanamaz | 600–760 alaşım tutarı kasalar ve üretimle pacing testinde ölçülür; karşılanamazsa yatırım dalı oturum 2'nin dönüş nedeni olur |
| Ortak karakollar kalabalık galakside yetmez | Garanti fonksiyonu, 6 saatte yeniden doğma ve galaksi tavanı; ölçülür |
| Aegis seçimli olunca starter'da PvP azalır | Bilinçli karar (N3); Aegis alan oranı ölçülür |
| Danışman çok seçenekle yeni oyuncuyu boğar | En fazla 3 kart, biri önerilen; kartta az yazı |
| Botlar yeni saldırı şartında ayırt edilebilir hâle gelir (Aegis almayan botlar) | `shipBots` Aegis politikası + bot testleri; kilitli karar (2026-10-28) korunur |
