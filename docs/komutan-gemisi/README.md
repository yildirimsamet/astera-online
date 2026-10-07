# Komutan Gemisi + Savaş Alanı — Özelliğin beyni

> **Durum:** Planlama tamam (2026-10-07); geliştirme başlamadı. Faz durumu: [panoda](#durum-panosu).
> **Hedef okuyucu:** Bu özelliği **hiç görmemiş** ve geliştirmeyi sahibin bilgisayarında yapacak
> agent. Sahip brief'i sana ayrıca vermeyecek: **bu klasör tek kaynaktır** (KG-K7).
> **Okuma sırası:** `CLAUDE.md` → bu dosya → [01-urun](01-urun.md) → [02-kararlar](02-kararlar.md)
> → işine göre konu belgeleri → [12-yol-haritasi](12-yol-haritasi.md).

---

## Ne yapıyoruz (tek ekran)

Astera Online asenkron bir galaksi strateji oyunu. Sahip, ona bağlı ama ayrı bir **aktif
pilotluk modu** istiyor:

- **Komutan Gemisi:** oyuncunun kendi gemisi. Ana gezegende durur. 3D yönetim sayfasında
  **sezon boyunca** geliştirilir, tamir edilir ve hazırlanır.
- **Savaş Alanı:** galaksiden ayrı, **sürekli açık, gerçek zamanlı PvP** alanı. Gemi **dikey
  ekranda, birinci şahıs** sürülür. Ortada nişangâh, yanlarda silahlar, üstte canlı arka görüş
  vardır. Yeteneklerde duman, turbo ve görünmezlik var.
- **Alandaki döngü:** **kaynak topla → tehdidi değerlendir → saldır ya da kaç → bir çıkışta
  tamamen dur, 3 sn hasarsız kal → yük eve.**
  - Yok edilirsen kargo sahaya saçılır, gemi çekilir ve tamir ister.
  - Yakıtın biterse kargo orada kalır.
- Galaksi ana oyun olarak kalır. Bu mod, ürün vizyonunun sahip onaylı bir istisnasıdır
  ([KG-K1](02-kararlar.md#kg-k1)).

**İlk hedef bir oynanabilir prototip:** uçuş, ateş, gerçek zamanlı çatışma, turbo, duman,
görünmezlik, arka görüş, giriş/çıkış, kalkan, patlama/çekilme ve test kargosu. Sahip onu
telefonunda oynayıp **hissi onaylamadan** kapsam büyümez.

## Altın kurallar

1. [01-urun](01-urun.md) maddeleri **kesin**. Değiştirecek, kaldıracak ya da yeni kısıt
   ekleyecek her öneri **önce sahibe** gider (KG-K2). CLAUDE.md'nin "sor" listesi de geçerli:
   çekirdek döngü, risk/ödül, PvP, sahiplik, sezonlar, ilerleme, kimlik.
2. Teknik ayrıntıyı (mimari, kütüphane, test, küçük UX) **sen karar ver**. Kararı
   [02](02-kararlar.md)'ye KG-T olarak yaz.
3. **TDD zorunlu** (tasarım/stil hariç). **Dört soru** her yüzeyde zorunlu. **Sunucu tek
   otorite.** Bağlayıcı belgeler: `CLAUDE.md`, `docs/engineering-standards.md`.
4. **Depo public.** Telefondan çıkarılan referans varlıklar ve onlardan türeyen hiçbir şey git'e,
   `public/`'e, build'e ya da PR'a girmez ([09](09-varliklar-ve-referans-cikarma.md)).
5. **F7 kapısı:** sahip "kontrol rahatlığı ve savaş hissi yeterince iyi" demeden F8 ve sonrası başlamaz.
6. Belgeleri kodla **aynı commit'te** güncel tut ([Belge bakımı](#belge-bakimi)).

## İlk oturum kontrol listesi

1. Bu klasörü okuma sırasıyla oku. Kodda adı geçen sembolleri bul (konumlar sembol adıyla verildi).
2. `pnpm install` → `docker compose up -d` → `pnpm verify`. Sonucu panoya yaz. Daha önceden
   kırık olan bir şey varsa düzeltme, yalnız kaydet.
3. Sahibe şu üç soruyu sor (önerilerle birlikte):
   - [KG-A1](02-kararlar.md#kg-a1): kalkan ne zaman biter?
   - [KG-A2](02-kararlar.md#kg-a2): yakıt bitince kurtarma gecikmesi.
   - [KG-A3](02-kararlar.md#kg-a3): tek döteryum deposu.

   Ayrıca dal/PR düzenini sor. Önerim: `feature/komutan-gemisi` dalı ve faz başına bir PR.
4. [12 F0](12-yol-haritasi.md#f0) adımlarını yap. Ardından F1'e başla.
5. Varlık hattı (V) için sahibe hazır olduğunu söyle; telefon bağlama prosedürü
   [09 §5](09-varliklar-ve-referans-cikarma.md). F1 bu hatta bağımlı değildir.

## Belge haritası

| Dosya | Ne zaman oku |
|---|---|
| [01-urun.md](01-urun.md) | Her zaman — sahibin brief'inin tamamı (S1–S85) |
| [02-kararlar.md](02-kararlar.md) | Her zaman — sahip kararları, teknik kararlar, açık sorular, reddedilenler |
| [03-ucus-ve-kontroller.md](03-ucus-ve-kontroller.md) | Uçuş modeli, dokunmatik kontroller, kamera, nişan |
| [04-savas-mekanikleri.md](04-savas-mekanikleri.md) | Mermi, dağılım, yetenekler, kalkan, çıkış, ölüm, yakıt, alan, **tüm sayılar** |
| [05-ag-ve-sunucu.md](05-ag-ve-sunucu.md) | Arena süreci, WebSocket, protokol, senkron, hile, kalıcılık, dağıtım |
| [06-istemci.md](06-istemci.md) | Uygulama dalı, render, efektler, ses, dosya yerleşimi |
| [07-hud-ve-ekranlar.md](07-hud-ve-ekranlar.md) | Referans görseller, HUD, sonuç/yükleme/yönetim ekranları |
| [08-ilerleme-ve-ekonomi.md](08-ilerleme-ve-ekonomi.md) | Sezonluk gelişim, tamir, yakıt, ekonomi riskleri |
| [09-varliklar-ve-referans-cikarma.md](09-varliklar-ve-referans-cikarma.md) | Kayıt defteri, ADB ile çıkarma, katalog, değişim |
| [10-referans-oyunlar.md](10-referans-oyunlar.md) | Metalstorm, Subdivision, Vendetta, Space Commander dersleri |
| [11-test-ve-playtest.md](11-test-ve-playtest.md) | TDD katmanları, ölçüm, bot senaryoları, sahiple oturum |
| [12-yol-haritasi.md](12-yol-haritasi.md) | Fazlar, riskler, sorular, kabul ölçütleri |
| `referans-gorseller/` | Sahibin 4 görseli — **sahip ayrıca verir**, bu klasöre koy (adlar ve metin dökümü [07 §1](07-hud-ve-ekranlar.md)) |

<a id="durum-panosu"></a>
## Durum panosu

| Faz | Durum | Not |
|---|---|---|
| Belgeler | tamam | 2026-10-07, planlama oturumu |
| F0 Hazırlık | başlamadı | temel `pnpm verify`: — |
| V Referans varlıklar | başlamadı | |
| F1 Çevrimdışı uçuş | başlamadı | |
| F2 Çevrimdışı silahlar | başlamadı | |
| F3 Sunucu + WS | başlamadı | |
| F4 PvP | başlamadı | |
| F5 Extraction | başlamadı | |
| F6 Yetenekler | başlamadı | |
| F7 Sahip incelemesi (kapı) | başlamadı | |
| F8–F11 | bekliyor | F7 onayından sonra |

## Çalışma düzeni

- **Git:** özellik dalında çalış. Her commit'ten önce `pnpm verify` yeşil olmalı. Referans
  varlık asla commit edilmez. Dal/PR düzeni sahibin tercihidir.
- **Sahiple iletişim:**
  - Türkçe konuş.
  - Yalnız ürün kararlarını sor (yukarıdaki 1. kural). Soruyu önerinle ve varsayılanınla sor.
  - Sonuçları **oynatarak** göster ([11 §7](11-test-ve-playtest.md)).
  - Her adımı anlatma. Ne değişti ve sırada ne var, onu söyle.
- **Kapsam:** "basit uygulama" iyidir. "Basitleştirilmiş oynanış" ise bir ürün kararıdır; zor
  diye bir mekaniği sessizce düşürme, sahibe sor.

<a id="belge-bakimi"></a>
## Belge bakımı (sahibin talimatı)

Bu klasör özelliğin beynidir. Gelecekte özelliği anlamak ve geliştirmeye devam etmek için
yeterli olmalı, ama gereksiz tekrar ve uzunluk içermemeli.

- **Tek kaynak:**
  - Her bilgi tek yerde durur, diğer belgeler oraya bağlantı verir.
  - Sayılar yalnız [04 §13](04-savas-mekanikleri.md#baslangic-degerleri)'te.
  - Kararlar yalnız [02](02-kararlar.md)'de.
- **Ne zaman ne güncellenir:**
  - Kodu değiştiren commit, ilgili belgeyi de değiştirir.
  - Faz bitince pano güncellenir.
  - Yeni teknik karar → KG-T.
  - Sahip cevabı → KG-A maddesi KG-K'ye taşınır.
  - Değer değişikliği → 04 tablosu ve günlüğü.
  - Oynanış oturumu → `docs/playtest-log.md`.
- **Denendi, olmadı:** önemliyse [02](02-kararlar.md)'de KG-X olarak tek satır: "şu denendi,
  şu yüzden olmadı". Önemsizse yazma.
- **Eskiyen bilgiyi sil.** Tarih git'te durur. Vazgeçilen yol belgede uzun anlatılmaz.
- **Biçim:**
  - Bir konu büyürse yeni dosya aç ve bu haritaya ekle.
  - Kod konumunu sembol adıyla ver.
  - Türkçe yaz, kod adları İngilizce.

## Sözlük ve kod adları

| Terim | Anlam | Kod |
|---|---|---|
| Komutan Gemisi | oyuncunun sürdüğü tek gemi (geçici ad, KG-A21) | `commanderShip`, `commander_ships` |
| Savaş Alanı / arena | sürekli açık gerçek zamanlı PvP alanı | `arena`, `ROLE=arena`, `/arena/ws` |
| Sortie | bir giriş → çıkış/ölüm seferi | `arena_sorties` |
| Pilot | odadaki oyuncu | `pilot` |
| Komutan (kodda) | **oyuncu** (`accounts.displayName`, `commanderTransfer`) | — |
| Oda | bir arena örneği (varsayılan: galaksi başına) | `roomKeyFor` |
| Çıkış / extraction | çıkış alanında tam durup 3 sn hasarsız kalma | `exit` |
| Çekilme | yok edilme/yakıt/kopma sonrası eve dönüş | `towed` |
| Doğuş kalkanı | 60 sn hasarsızlık | `shield` |
| İzlenen hedef | önleme işaretinin ait olduğu düşman (kilit değil) | — |
| Önleme işareti | hareketli hedefe nereye ateş edileceği | `lead` |
| Referans varlık | telefondan çıkarılan geçici, yalnız yerel model/ses | `/__ref/` |
| Döteryum | yakıt ve mühimmat kaynağı (mevcut üçüncü kaynak) | `deuterium` |

## Brief kapsama izi

Sahibin mesajlarındaki her bölümün bu klasörde nerede karşılandığı:

| Brief bölümü | Nerede |
|---|---|
| Amaç, ana oyunla ilişki | 01 S1–S4 |
| Ana gezegende gemi yönetimi | 01 S5–S8 · 07 §8 · 12 F8 |
| Kamera ve mobil kontrol | 01 S9–S13 · 03 |
| Uçuş, gaz ve yakıt | 01 S14–S17 · 03 §2 · 04 §13 |
| Silahlar ve 8 özellik | 01 S18–S21 · 04 §2–3 · 08 §3 |
| Aktif yetenekler | 01 S22–S25 · 04 §5 |
| Sürekli açık alan, giriş/çıkış, kalkan | 01 S26–S29 · 04 §5, §11 · 05 |
| Çıkış | 01 S30–S31 · 04 §6 · 07 §1, §4 |
| Yok edilme | 01 S32–S34 · 04 §7 · 07 §6 |
| Yakıtın bitmesi | 01 S35–S37 · 04 §8 |
| Kalıcı gelişim | 01 S38–S39 · 08 · 02 KG-K3 |
| Monument bağlantısı | 01 S40–S42 · 08 §9 |
| Kaynak toplama + hayatta kalma döngüsü | 01 S43–S44 · 04 §10 · 08 §6 |
| İlk MVP kapsamı | 01 S45–S48 · 12 |
| Teknik yönergeler (Three.js, netcode, sunucu doğrulaması, geçiş performansı) | 01 S49–S52 · 05 · 06 |
| Tasarım ve oynanabilirlik notları | 01 S53–S60 · 03 · 07 · 08 · 11 |
| Kontrol/ateş/nişan/takip-kaçış uygulama önerileri | 01 S61–S79 · 03 · 04 |
| İlk oynanabilir test, kovalamaca senaryosu, inceleme döngüsü | 01 S80–S84 · 11 §6–7 · 12 F7 |
| Yatay mod izni | 01 S85 · 03 §11 |
| Referans varlık isteği (ADB, katalog, geçicilik, değişim) | 09 V1–V15 · 02 KG-K6 |
| Parça varlıklar (motor alevi, iz, roket, ses) | 09 V9, §7 |
| Metalstorm ve Subdivision'ı incele; "karışım oyun değil" | 10 R1–R3 · 01 S4 |
| Belgeleri konulara ayır, güncel tut, eskiyi sil | bu dosya §Belge bakımı |
| Referans görseller (4) | 07 §1 (metin dökümü; PNG'leri sahip verir) |
| Sahip kararları (sezonluk, görünmezlik hasarı, bağlantı kopması, varlık yolu, yerel geliştirme) | 02 KG-K3–K7 |
