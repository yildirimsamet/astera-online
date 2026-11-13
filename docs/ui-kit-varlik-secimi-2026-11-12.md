# Oyun arayüzü kiti: hazır varlık seçimi (2026-11-12)

Owner isteği: "Hud, iconlar, rozetler, effectler... Önce incele, neyi nerede nasıl kullanabiliriz notlarını al, muadilleri de not et. En son derle topla, kararları ver, seç." Bu belge, `ui-ux-iyilestirme-plani-2026-11-11.md` → "Aşama 3 öncesi: oyun arayüzü kiti" bölümünün üstüne kurulur.

**Kaynak:** `~/Desktop/Coding/MyProjects/game-assets` kütüphanesi (32 paket, 4788 dosya). Dosya adları kütüphanedeki yoldur. Canlı görmek için: `tools/serve.sh` → http://127.0.0.1:8765. VFX'ler orada oynar.

**Panolar:** Seçilenler ve muadilleri yan yana, oyunun lacivert zemininde: `out/ui-kit/assets/`. Etiket anlamları: SEÇİLDİ, MUADİL, CODEX (kütüphanede yok, çizilecek), KODLA (SVG veya CSS ile kod çizer).

| Pano | İçerik |
|---|---|
| `a-resimli-ikonlar.png` | ödül sandığı, madalya, kupa, taç, yıldız, hediye, reklam, mağaza, yakıt/süre, menü ikonları |
| `b-glifler.png` | görev türleri, harita işaretleri, durum etkileri, istatistik glifleri |
| `c-seref-dil.png` | Şeref −2…+2 rozetleri, dil bayrakları |
| `d-vfx.png` | three.js efektleri ve Unity paketlerinden dokular |
| `e-klan-bayrak-seviye.png` | klan kimliği (mevcut bayrak skinleri ve amblem karesi), klan seviyesi 1–10 |
| `f-stil-karsilastirma.png` | Codex stil tohumu: aynı ikmal kapsülü iki tarzda, 200/96/48/32 px |
| `g1-…`, `g2-…`, `g3-….png` | Codex ev tarzı ikonları (25 adet), 160/64/48/32 px denetimi |

Panolar `out/ui-kit/assets/spec/` içindeki tarifle yeniden üretilir: `python3 -I board.py spec-a.json a.png`.

## Terimler (kısa)

- **9-slice:** Köşeleri sabit kalan, kenarları uzayan panel resmi. Bir çerçeveyi her boyutta kullanmak içindir.
- **Glif:** Tek renk işaret (kilit, göz, bayrak). Rengi koddan alır.
- **Flipbook:** Bir animasyonun karelerinin tek resimde ızgara olarak dizilmesi. Patlama, duman ve halka bununla oynar.
- **Parçacık (particle):** Efekti oluşturan küçük parçalar. Sayısı telefonun yükünü belirler.
- **KTX2:** Ekran kartında sıkıştırılmış kalan doku biçimi. Büyük flipbook'larda belleği düşürür. Arena gemileri bunu zaten kullanıyor.

## Ana karar: hangi iş hangi kaynaktan

Kit bugün koddan çizili: lacivert çelik paneller, parlak eylem butonları ve 25 SVG glif (`apps/web/src/game-ui/`). Kütüphanede iki tarz var:

- **Layer Lab:** Parlak, casual, Clash Royale ve Brawl Stars dili.
- **Synty:** Koyu, metalik, askerî. Oyunun yarı gerçekçi gemi ve kaynak render'larına yakın.

Bu iki tarz şu kurala göre ayrıldı:

1. **Kontroller kodda kalır.** Buton, panel, çubuk, sekme, şerit, rozet zemini ve sheet CSS ile çizilir. Layer Lab'in 9-slice buton ve panelleri oyuna alınmaz; gölgelendirme örneği olarak kalır. Nedenler:
   - Renkler token'dan gelir; tek değişiklik bütün oyunu değiştirir.
   - DPR 2'de keskin kalır.
   - Resim yüklenmediği için ağırlık eklemez.
   - Testleri yazılmıştır.
   - Layer Lab'in gök mavisi, bizim çelik lacivertle çatışır.

   *Bedeli:* Layer Lab'in hazır doku zenginliği yok. Kit zaten bombe, üst parlama ve alt kenar ile aynı malzemeyi taklit ediyor (`out/ui-kit/play/play-strip.png`).
2. **Resim olan şeyler PNG'dir.** Ev tarzında çizilirler (aşağıda "Ev tarzı"):
   - Metal ve altın nesneler (madalya, kupa, taç, yıldız) Layer Lab'den gelir.
   - Renkli, çizgi film ağırlıklı Layer Lab ikonları (hediye, reklam, menü) ev tarzında yeniden çizilir.
   - Şeref ve klan seviyesi gibi askerî nişanlar Synty'den gelir; metalik dokusu gemi render'larıyla uyuşur.
3. **Glifler tek sistemde toplanır.** Eksik glifler Layer Lab Picto (324 adet) ve Synty durum/harita ikonlarından seçildi. PNG olarak değil, SVG yoluna çevrilerek kitin `PATHS` sistemine girer. Böylece aynı kontur, aynı renk token'ı ve aynı test geçerli olur.
   - **Boyut kuralı (owner onayı 2026-11-12):** 40 px ve üstü resimli ikon (Codex ev tarzı); 32 px ve altı glif. Resimli ikon 24–32 px'te bulanıklaşır; oyunlar bu boyda düz siluet kullanır.
   - **Aile (2026-11-12, `out/ui-kit/assets/glif-aileleri.png`):** Altı aile 16 işlevde 32/24 px'te karşılaştırıldı. Layer Lab Casual'ın yanına aynı tombul, yuvarlak çizgideki **SuperCasual Picto** ikinci kaynak olarak eklendi (göz, kalkan, anahtar, hedef, saat onda daha iyi). Survival Clean ve Softline uygulama ikonu gibi ince; Fantasy RPG ve The Stone fantastik köşeli.
   - **Düz görünmez:** Kit glife koyu kontur ve alt gölge verir; metal plakada ve eylem butonunda oyun ikonu gibi okunur (`out/ui-kit/assets/glif-kit-islemi.png`).
4. **Oyun dünyasının nesneleri bizimdir.** Gemi, gezegen, kaynak ve bina için mevcut render'lar kullanılır. Kütüphanedeki resimli gezegen ve kristaller (cartoon sampler) alınmaz; çocuksu kalıyor.
5. **VFX three.js'te kurulur.** 00GameDevs efektleri hazır çalışır. Unity paketlerinden yalnız doku ve şekil alınır. Hiçbiri telefonda ölçülmeden oyuna girmez.

### Ev tarzı (stil tohumu, 2026-11-12)

Codex aynı ikmal kapsülünü iki tarzda çizdi (`f-stil-karsilastirma.png`, dosyalar `out/ui-kit/assets/codex/`):

- **Layer Lab tarzı:** 32 px'te en iyi okunan. Ama gemi ve kristal render'larının yanında oyuncak gibi kalıyor.
- **Oyunun kendi tarzı:** koyu metal, kehribar ışıklar, camgöbeği derz, ince koyu kontur. Kristal ve gemi render'larıyla aynı aileden görünüyor. 48 px'te okunuyor; 32 px'te biraz griye kaçıyor.

**Karar:** Ev tarzı ikinci yön. Clash of Clans'ın da yarı gerçekçi boyalı ikonları var; bu tarz "Clash gibi ama uzay" hedefine en yakın olan.

- **Kural 1:** Okunması için parlak bir vurgu (ışık, derz) şart.
- **Kural 2:** 32 px'in altında resimli ikon değil glif kullanılır.

Layer Lab'in metal ve altın nesneleri (madalya, kupa, taç, yıldız) bu tarzla çatışmıyor; kalırlar. Owner onayı S22 turunda istenir.

## Seçim tablosu

### Resimli ikonlar (pano A)

| İhtiyaç | Nerede | Seçilen | Muadil |
|---|---|---|---|
| Ödül sandığı | Yeni Komutan 7 Günü (planlı), ödüllü reklam ödülü (altyapı var, ödül yok), sezon ödülleri | **Codex: ikmal kapsülü**, ev tarzı (tohum çizildi). Gövde ve kapak ayrı parça olarak yeniden çizdirilir | `reward-chest-pack` (kapağı ayrı; açılma animasyonu bununla prototiplenir) |
| Madalya 1/2/3 | sıralama ilk üç | Layer Lab `imageicon-medal-gold/silver/bronze` | Synty çelenk + yıldız (pano C) |
| Kupa | sezon şampiyonu, Dominion | Layer Lab `imageicon-trophy-l/m/s` | `menuicon04-trophy` (defneli), casual `trophy01-gold` |
| Taç | lider, klan lideri | Layer Lab `imageicon-crown-gold/silver` | Layer Lab item `crown` |
| Yıldız | görev, derece | Layer Lab `star01-l/m/s`, `stargrade-*-on/off` | casual `star01-gold` |
| Hediye | etkinlik | **Codex**, ev tarzı | Layer Lab `imageicon-gift-blue`, `gift-purple` |
| Ödüllü reklam | AdMob ödül butonu | **Codex**, ev tarzı (holografik ekran) | Layer Lab `imageicon-ad-01-l` (ekran), `imageicon-ad-00-l` (klaket) |
| Mağaza etiketi | Shopier paketleri | Layer Lab `badge-best`, `badge-popular` | — |
| Yakıt, süre | filo gönderme, maliyet satırı | Layer Lab item `icon-oil`, `icon-stopwatch` | `icon-hourglass`; Synty `map-petrol` (glif) |
| Kargo, yuva | filo gönderme | **Codex** | cartoon `mining-wooden-crate-block` (kargo) |
| Kilitli özellik | büyük kilit kartı | **Codex**, ev tarzı | Layer Lab `imageicon-lock01-l/m/s`; küçük boyda kitin kilit rozeti |
| Menü | raporlar, görevler, duyuru, arkadaş, mağaza, klan, sıralama | **Codex**, ev tarzı (çizim düzeni için Layer Lab'e bakılır) | Layer Lab `menuicon04-inbox/mission/news/friends`, `menuicon02-shop/clan-n`, `imageicon-ranking` |
| Alt menü: galaksi, üs, filo, araştırma | ana gezinme | **Codex**, ev tarzı | mevcut render'lar (40 px'te favicon gibi kalır, önerilmez) |
| Kozmetik kategorileri: gezegen, halka, gemi, sonda, madenci, motor, bayrak | koleksiyon ve mağaza sekmeleri | **Codex**, ev tarzı | Picto `planet`, `flag-1`, `rocket` (glif) |
| Sistem | bağlantı koptu, avatar, VS | `imageicon-networkerror`, `imageicon-userthumbnail`, `statsicon-vs` | — |
| Rehber | dokunma işareti | Layer Lab `tutorial-linecircle` | bizim `tutorial-hand-icon.png` kalır (Layer Lab'in eli zırhlı kol, uymuyor) |

### Glifler (pano B)

Kitte olanlar aynen kalır: saldırı, nakliye (kasa), kalkan, hız, süre, kilit, yıldız, uyarı, vb.

| İhtiyaç | Seçilen | Muadil |
|---|---|---|
| Casus sonda, keşif | Picto `view` (göz) | Picto `eyeball` |
| Koloni kur | Picto `flag-1` | Picto `planet` |
| Geri çağır | Picto `undo` | — |
| Kaçış (taktik geri çekilme) | Picto `arrow-rw` | Synty `stat-speed-01` (koşan) |
| Klan desteği | Synty `status-armour` (çerçeve kalkan; kitin dolu kalkanından ayrılır) | Picto `guild` |
| Enkaz toplama | Picto `magnetic` | — |
| Asteroit madenciliği | Picto `dig` (kazma) | Picto `gem-hexagon` |
| Ölüm Yıldızı | **Codex** (kendine özgü süper silah) | Picto `blackhole` |
| Harita: bilinmeyen, tehlike, korsan, hedef, başkent, koloni, işaret | Synty `map-unknown`, `map-danger`, `status-poisoned`, `map-target`, `map-home-02`, `map-flag`, `map-pin` | Synty `map-skull` (korsan) |
| Harita: asteroit | Picto `coal` (yontulmuş kaya) | — |
| Radyasyon | **KODLA:** trefoil, geometrik SVG | Picto `mask` (gaz maskesi) |
| Hasarlı | Synty `status-defensebroken` | Picto `life-break` |
| Onarım | Picto `tool` (anahtar) | Picto `fix` (çekiç) |
| Saldırı artışı | **KODLA:** kitin kılıcı + yukarı ok | Synty `attackup` (tabanca; uzaya uymuyor) |
| Hız artışı, savunma düşüşü, süreli etki | Synty `status-speedup`, `status-defensedown`, `status-time` | — |
| Kritik vuruş | Picto `critical` | — |
| Yakıt | Picto `oil` (bidon) | Synty `map-petrol` (pompa) |
| Gövde dayanıklılığı | Picto `life` (kalp, mobil oyun alışkanlığı) | Synty `status-health-02` (artı) |
| Menzil, sıralama, geçmiş, paylaş, alarm, ayarlar, posta, sohbet, kilit açık, yenile, yakınlaştır | Picto `target`, `leaderboard`, `history`, `share`, `siren`, `setting`, `mail`, `chat`, `unlock`, `refresh`, `zoomin` | — |

Harita işaretleri 4. aşamada galaksi katmanına girer. 2026-11-11'de geri getirilen mobil işaret boyutları korunur.

**Kite girdi (2026-11-12):** Tablodaki 30 glif `PATHS`'e eklendi; kit 53 glif. 27'si kaynak PNG'nin alfa sınırından alt-piksel izlendi (Inkscape izleyicisi dişlinin deliğini kaybettiği için kullanılmadı), 3'ü (radyasyon, saldırı artışı, sancak) elle çizildi. Her glif onaylanan işlemi alır: koyu kontur + üstü kendi rengi, altı bir ton koyu (`.gk-glyph__hi/__lo`). Görüntü: `out/ui-kit/r5/glifler.png`.

*Not:* Kitin ilk elden çizilen glifleri (kılıç, onay, dönüş oku) izlenen Picto gliflerinden biraz ince. Yan yana durduklarında fark seçiliyor; 4. aşamada Picto karşılıklarıyla değiştirilmesi önerilir.

### Şeref, rütbe, klan, dil (pano C)

- **Şeref kademesi −2…+2: Synty katmanları.**
  - Katmanlar: zemin (renklendirilir), metal çerçeve, amblem ve kanat.
  - −2: kırmızı zemin, gümüş çerçeve, kafatası ve kemikler.
  - −1: bronz çerçeve, çapraz kemikler.
  - 0: bronz çerçeve, tek yıldız.
  - +1: gümüş çerçeve, gümüş kanat, yıldız.
  - +2: altın çerçeve, altın kanat, iki yıldız.

  Kademeler koddan doğrulandı: `packages/rules/src/honorBenefits.ts`, `HONOR_BENEFIT_RATES` −2…2. Rozetler derleme anında tek resme birleştirilir; çalışırken katman katman çizilmez.

  *Muadil:* Layer Lab renkli rün çerçeveleri (`runeicon-frame-0…5`). Casual tarzdadır ve askerî anlamı yoktur.

  **Nereye girer:**
  - `ui/HonorBenefits.tsx`: bugün kademe yalnız yazı ve genel `HonorIcon` ile gösteriliyor.
  - Sıralama satırı ve profil.
  - Hedef ekranındaki Şeref bandı.
- **Klan kimliği = mevcut bayrak skinleri (düzeltme, 2026-11-12).** İlk taslakta "arma yok" yazmıştım; yanlıştı.
  - Bugünkü durum:
    - 22 bayrak skini var (`images/cosmetics/flag-*.webp`).
    - Lider bayrağı kuşanır (`apps/server/src/services/cosmetics.ts`).
    - Bayrak, galakside filonun üstünde 3D kumaş olarak dalgalanır (`galaxy/CosmeticEffects.tsx`).

    Bayrak zaten klanın arması. Ayrı bir arma sistemi ikinci bir kimlik yaratır ve satılan bayrağın değerini düşürür; yapılmaz. Synty arma katmanları alınmaz.
  - **Eksik olan küçük boy:** Bayrak 48 px'te okunmuyor. Her bayrağın amblemi kare bir karoya kırpılır; karo listede, sohbette ve sıralamada kullanılır (`e-klan-bayrak-seviye.png`). Amblemin yeri bayraktan bayrağa değiştiği için kırpma merkezi bayrak başına bir tabloda tutulur.
  - **Bayrağı olmayan klan:** Düz sancak ve etiket harfleri. Kodla çizilir.
- **Klan seviyesi 1–10 = Synty rütbe şeritleri.**
  - Kaynak: `CLAN_PERK_LADDER` on basamak; 10. basamak "Altın sancak" (`packages/rules/src/clanPerks.ts`).
  - Eşleme:
    - 1–3 bronz;
    - 4–6 gümüş;
    - 7–8 altın;
    - 9 altın + çelenk;
    - 10 altın + çelenk + kanat.
  - Klan adının yanında küçük rozet olarak kullanılır: klan listesi, sıralama, üye satırı.
  - Mevcut "Klan Sancağı" ekranı (on çentik, `ClanBanner.tsx`) aynen kalır; rozet onun kısa hâlidir.
  - Şekil kuralı:
    - kalkan = kişinin Şerefi;
    - şerit = klanın seviyesi;
    - bayrak = klanın kimliği.
- **Dil seçici:** Layer Lab `languageflag-large-*` / `-small-*`. Oyunun 6 dilinin hepsi var: tur, eng, deu, esp, fra, jpn.

**Kite girdi (2026-11-12, `src/game-ui/ranks.tsx`, görüntü `out/ui-kit/r5/seref-klan.png`):**

- `HonorBadge` (5 kademe) ve `ClanLevelBadge` (10 seviye): katmanlar bir kez birleştirildi. Aile başına tek yükseklik, her rozet kendi genişliğinde; kalkan ve şerit kademe değişince büyüyüp küçülmez. Toplam ~80 KB.
- `ClanEmblem`: 22 bayrağın amblem karosu (bayrak başına kırpma merkezi tablosu; varsayılan merkez çoğu bayrakta amblemi kaçırıyordu). Bayrağı olmayan klan: çelik karoda sancak glifi ve etiketin ilk üç harfi.
- 28 px satırda kalkanın rengi ve biçimi okunuyor, amblem (kafatası, yıldız) seçilmiyor. Satır boyunda anlam renkten gelir; ayrıntı profilde.

### HUD ve arena (pano D'nin alt kısmı)

| İhtiyaç | Seçilen | Muadil |
|---|---|---|
| Arena nişangâhı | Synty `reticle-ring-medium-02` ve reticle seti | Sci-Fi Pack `t-circle*` halkaları |
| Hasar yönü | Synty `damagedirection-02-*` (iç, dış, üçgen katmanları) | `damagedirection-01-*` |
| Bayat istihbarat paraziti | Synty `static-01` + `comms-scanlines-large-01` | Sci-Fi Pack `t-matrix01` |
| Yükleme halkası | kitin CSS halkası | Sci-Fi Pack `t-loading01/02` flipbook (10240 px, küçültülmeli) |

### VFX (pano D)

**three.js efektleri (00GameDevs):** Hepsi aynı ~570 KB motorun bir kopyasını taşır. Motor bir kez ayrılır; her efekt S22'de ölçülür.

| Oyundaki an | Seçilen | Parçacık | Muadil |
|---|---|---|---|
| Aegis gezegen kalkanı | `aegis-weave` | 30 | özel kalkan shader'ı: `sm-dome01` + `t-hexagongrid02` + `t-noise07` (Sci-Fi Pack) |
| Filo kalkışı ve varışı (sıçrama) | `astral-gate` | 512 | `t-vortex-1` + tarama halkaları ile özel kurulum |
| Plazma atışı (arena, savaş tekrarı) | `plasma-bolt` | 512 | `laserbeam06` dokusu, uzatılmış düzlem (en ucuz) |
| Ölüm Yıldızı ışını | `charged-beam` | 768 | `continuous-beam`; çarpma: `thunder-strike` |
| Asteroit madencilik ışını | `continuous-beam` (renk değişir) | 512 | `laserbeam06` |
| Gemi patlaması | mevcut `vfx/premium-v2/explosion` + `fire-explosion` | 256 | `starblade-explosion` (2738, yalnız yüksek kalite) |
| Şok halkası | `impactring01-2x2` flipbook | — | `whiteshockwave01-4x4`, `shockwave.js` |
| Bina bitti, seviye atlama (3D) | `astral-convergence` | 512 | — |
| Hasarlı gemi dumanı | `smoke-puff` | 96 | mevcut `premium-v2/smoke`, `t-smoke01-6x6` |
| Yanan gemi veya gezegen | `flame-style-1…3` flipbook (Realistic Fire) | — | `burning-ground` (1024 parçacık, ağır) |
| Radyasyon bombası alanı | mevcut `radiation-bomb` görselleri | — | `venom-pool` (yeşil ton) |
| Radar ve teleskop taraması | Sci-Fi Pack `t-circles*-2x2` flipbook'ları + `t-circle09` | — | Synty reticle halkaları |
| Motor alevi | mevcut `vfx/engine-flames` GLB + `flow-noise` (kalır) | — | Sci-Fi Pack `sm-thurstercylinder01/02` |
| Ödül patlaması (arayüz) | Layer Lab `fx-rotate-line` (ışınlar) + `fx-special-particle-*` + `fx-star-light` | — | `t-star02/03` |

**Alınmayanlar:**

- Fantastik efektler: `fireball`, `arcane-missile`, `frost-field`, `ice-shatter`, `dust-devil`, `wind-vortex`, `magic-barrier`.
- `billowing-airburst` ve `energy-burst`: karşılığı yok.
- `arc-ray`: oyunda elektrik silahı yok.
- Toon Projectiles: çizgi film tarzı.

## Alınmayanlar ve nedeni

- **Layer Lab:**
  - arka planlar: fantastik açık hava;
  - örnek ekranlar: yalnız referans;
  - pass biletleri ve "CLEAR" mührü: İngilizce yazı resmin içinde;
  - zırhlı el.
- **Cartoon sampler:** Uzay ikonları (uzay kedisi, ahtapot) ve çiftlik, balıkçılık, kış setleri. "Canlı NASA fotoğrafı" kimliğine uymuyor.
- **Wenrexa:**
  - sci-fi kitleri ince hologram çizgili; bu, reddedilen A yönünün dilidir;
  - iksir, büyü ve RPG setleri fantastiktir.
- **Softline, FP Studio:** Kalite düşük.
- **Synty:** Silah, gamepad ve klavye ikonları. Oyunda gamepad yok; ateşli silahlar konuya uymuyor.

## Codex işleri

Hepsi ev tarzında çizilir: koyu metal, kehribar ışık, camgöbeği derz, ince koyu kontur. Tohum: `codex/pod-astera.png`. Çıktıyı Claude denetler; 48 px'te okunmayan geri döner.

1. İkmal kapsülü, gövde ve kapak ayrı parça. Açılma animasyonu kodla yapılır. Kademe (nadir/efsanevi gibi) bugün oyunda yok; ödülü veren özellik tasarlanırken karar verilir.
2. Kargo ve yuva ikonları.
3. Alt menü: galaksi, üs, filo, araştırma.
4. Menü: raporlar, görevler, duyurular, arkadaşlar, mağaza, klan, sıralama.
5. Hediye, ödüllü reklam, büyük kilit.
6. Kozmetik kategorileri: gezegen, halka, gemi, sonda, madenci, motor, bayrak.
7. Ölüm Yıldızı ikonu (resimli ve glif).

Koddan çizilenler: radyasyon trefoil'i, saldırı artışı (kılıç + ok) ve bayraksız klanın sancağı.

### Codex çıktıları (2026-11-12, owner ev tarzını onayladı)

25 ikon çizildi. Dosyalar `out/ui-kit/assets/codex/batch/` (1024 px, şeffaf), tarifler `codex/prompts/`. Denetim panoları her ikonu 160/64/48/32 px'te gösterir:

- `g1-odul-ekonomi.png`: kapsül kapalı ve açık, kargo, yuva, kilit, hediye, reklam, Ölüm Yıldızı.
- `g2-menu.png`: 4 alt menü ve 7 menü ikonu.
- `g3-kozmetik.png`: 7 kozmetik kategorisi.

**Denetim sonucu:**

- Hepsinin alfası temiz.
- Hepsi aynı aileden.
- 48 px'te okunuyor.
- Sıralama podyumu 48 px'te kutu yığını gibi okunuyordu. Altın yıldızlı ikinci sürüm (`menu-ranking-v2`) 32 px'te bile kürsü olarak okunuyor; o alındı.
- Kargo ve kapsül ikisi de metal kutu. Farklı ekranlarda durdukları için kabul edildi: kargo filo gönderme satırında, kapsül ödülde. Yan yana konmaz.

**Oyuna alırken:**

- Doluluk %69–92 arasında değişiyor. Her ikon görünür sınırına kırpılır ve aynı kenar payıyla kareye oturtulur.
- Kapsül açılışı iki kareyle yapılır: kapalı → açık geçişi, ezilip esneme ve ışık patlaması (kitin ödül ışınlarıyla).

**Kite girdi (2026-11-12):**

- 25 ikon `public/assets/ui/icons/<id>.webp` (160 px, aynı kenar payı, toplam ~300 KB); kapsülün iki karesi aynı kadrajda 320 px. Bileşen `ArtIcon` (`src/game-ui/art.tsx`); 40 px altına çizilemez.
- Dock'un istihbarat sekmesi eksikti (Codex araştırma çizmişti, araştırma dock'ta yok). Codex iki seçenek çizdi (`out/ui-kit/assets/intel-secenekleri.png`): **B radar tableti seçildi**, çünkü A'nın çanağı galaksi ikonunun yuvarlak taban + camgöbeği silüetine benziyor. A yedekte.
- Dock resmi 34 → 40 px (boyut kuralı). Görüntü: `out/ui-kit/r5/dock.png`.
- Kapsül: `RewardPod`. Süzülür; dokununca 520 ms sarsılıp ezilir (`crate` sesi, hafif titreşim), kapak flaşla açılır, esner, ışın döner (`claim` sesi, güçlü titreşim), ödül bir kez verilir. Kareler: `out/ui-kit/r5/pod-acilis-kareler.png`.

## İkinci parti paketler (2026-11-12) ve seçime etkisi

12 paket daha kütüphanede (değerlendirme kütüphane README'sinde). Kararlar değişmedi; yalnız muadiller ve bir ses kaynağı eklendi:

- **Survival Clean (Layer Lab):** Koyu lacivert zemin, kesik köşe, camgöbeği parıltı: bugünkü arayüzümüze en yakın paket.
  - Kontroller CSS'te kalır. Kesik köşe ve parıltı ölçüleri CSS için örnek alınır.
  - 68 parıltılı menü ikonu, glif katmanı için Picto'nun muadili. Ev tarzı resimli ikonların yerine geçmez.
  - 11 kademeli altıgen rütbe rozeti, klan seviyesi için Synty şeritlerinin muadili. Yalnız renkle ayrışıyor; bronz / gümüş / altın şeritler seviyeyi daha iyi anlatıyor.
- **Fantasy RPG sandıkları (68):** Kütüphanedeki en iyi ödül görseli, ama fantastik. Uzay kapsülünün (Codex) muadili.
- **SuperCasual derece rozetleri (10):** Kanatlı, defneli lig rozeti. Şeref için Synty katmanlı rozetlerin muadili; renkleri bizim için fazla çocuksu.
- **Stylized Explosions + Sci-Fi Shield (Gabriel Aguiar):** Çarpma halkası ve altıgen kalkan dokusu. Aegis ve patlama için mevcut seçimlere ek doku.

## Ses

Oyunda 10 ses dosyası (`public/assets/audio/premium/`) ve kodla üretilen sesler var (`lib/sound.ts`). Kitin yeni anlarının kendi sesi yok:

- kapsül açılması;
- madalya, rütbe ve Şeref kademesi değişimi;
- sayının sayarak artması;
- basılı tutarken dolma;
- hata.

Owner 6 Kenney ses paketi indirdi (CC0: ticari kullanım serbest, isim vermek zorunlu değil). Kütüphanede 498 ses var; hepsi kütüphane görüntüleyicisinin "Ses" sekmesinde çalınır.

| Paket | Ses | Kitte işe yarayan |
|---|---|---|
| Kenney Interface Sounds | 100 | Arayüz ailesinin omurgası: tık, seçim, onay, hata, aç / kapat, şalter, kaydırma, glitch |
| Kenney UI Audio | 51 | Kısa tık ve üzerine gelme; 38 şalter / anahtar sesi (kol, şalter) |
| Kenney Digital Audio | 62 | İki-üç tonlu bip (bildirim), güç yükselişi (kademe, ödül), faz (sıçrama) |
| Kenney Sci-Fi Sounds | 73 | Lazer, uzay motoru, itici ateşi, kalkan (Aegis), patlama, kapı (hangar) |
| Kenney Impact Sounds | 128 | Metal çarpma (sandık / kapsül kapağı, kilit), madencilik |
| Kenney RPG Audio | 51 | Para sesi (ganimet sayacı), metal mandal (kilit açılması) |
| Space Combat Kit | 33 | Radar kilitlenme (basılı tutma), warp, alarm |

- **Yol:** Owner ücretsiz Kenney yolunu seçti (paketleri indirdi). Kitin sesleri bu kütüphaneden seçilir; ücretli paket şimdilik gerekmiyor.
- **Eşleme:** Entegrasyon turunda her an için 2–3 aday dinlenir, biri seçilir. Seçilenler OGG / Opus olarak `public/assets/audio/ui/` altına girer ve `lib/sound.ts`'e bağlanır.
- **Dinleme sayfası (2026-11-12):** `out/ui-kit/sesler/index.html` (çift tıkla açılır). 8 an × 3 aday: kapsül sarsılması, kapsül açılışı, kademe atlama, sayaç, basılı tut dolması, hata, şalter, sekme. Adaylar parlaklığa göre koyu / orta / parlak seçildi; sayaçta tık ve para şıngırtısı da var. Seçimin altta tek satır birikir. Kazananlar oyunun diğer sesleri gibi MP3'e çevrilip `lib/sound.ts`'e yeni cue olarak bağlanır; kit bugün bu anlarda kodla üretilen `crate` / `claim` seslerini çalıyor. Adaylar depoya girmedi, çünkü `public/` altındaki her dosya APK'ya da girer.

## Oyuna alma kuralları

1. **Kopyala:** Seçilen dosyayı `apps/web/public/assets/ui/<grup>/` altına kopyala (`reward`, `menu`, `honor`, `flags`). Gösterim boyutunun 2 katında webp yap (DPR 2). Örnek: 48 px'te görünen ikon 96 px olur. Kütüphaneye link verme.
2. **Glif çevirisi:** 512 px Picto ve Synty PNG'sini SVG yoluna çevir. Araç: `potrace` (kurulu değil, `apt install potrace`) veya Inkscape "Trace Bitmap". Yolu 24'lük ızgaraya oturtup `icons.tsx`'teki `PATHS`'e ekle. Kitte henüz glif testi yok (`apps/web/test/game-ui/`): önce her kimliğin bir yol çizdiğini doğrulayan test yazılır.
3. **Şeref rozetleri:** Derleme betiğiyle tek resme birleştir (kademe başına bir webp).
4. **VFX:**
   - 00GameDevs motorunu tek modüle ayır.
   - Flipbook'ları 1024–2048 px'e küçült. Büyükleri KTX2 yap.
   - Her efektin parçacık sayısını S22'de kare süresiyle ölç (USB + `adb forward` ile profil).
5. **Kayıt:** `CREDITS.md`'ye her paket için satır ekle: paket, yazar ve `packs.json`'daki lisans. Kütüphanenin `usage.json` dosyasına dosyayı yaz ve `python3 -I tools/ingest.py` çalıştır.
6. **Doğrulama:** Galeride 350×812 DPR 2 fotoğraf, ui-audit sayıları ve S22 turu (kitin mevcut doğrulama yolu).

## Sıradaki adım

Kit galerisine entegrasyon turu:

- ödül sandığı (açılma animasyonu, prototipte `reward-chest-pack`);
- madalya, kupa ve taç satırları;
- Şeref rozeti, klan seviyesi rozeti ve klan amblem karosu bileşenleri;
- glif setinin genişletilmesi;
- durum çipleri;
- dil seçici.

VFX kit galerisine değil, ilgili sahneye (arena, galaksi, savaş tekrarı) girer. Bu iş 4. aşamada ekranla birlikte yapılır.

**Kitin açık kararlarına katkı:**

- **Font:** ✅ Owner seçti (2026-11-12): önce Russo One; aynı gün 2.9 "Komuta + Grafit" ile başlık, buton ve sayı Saira dar kalına geçti (a1e88c45). Gövde metni Saira'da kalır. Uzun Türkçe başlıklarda kesilme S22 turunda kontrol edilir.
- **Alaşım rengi:** ✅ Bakıra kaydı (#c27a55), owner 2026-11-12.
