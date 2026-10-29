# Komutan Gemisi — Varlıklar ve referans varlık çıkarma (ADB)

> **Durum:** Yerel APK çekimi ve tam içerik taraması yapıldı (2026-10-08).
> Güncel sonuç ve sınırlamalar [13](13-gelistirme-notlari.md)'te; aşağıdaki prosedür yeniden çekim içindir.
> **Hedef okuyucu:** Varlık hattını (V fazı, [12](12-yol-haritasi.md)) yürütecek agent.
> **Dayanak:** KG-K6, KG-T26 ([02](02-kararlar.md)); sahibin isteği aşağıda (V1–V15).

---

## 1. Sahibin isteği (sahibin cümleleriyle)

- **V1** Telefonumda **Vendetta Online, Space Commander: War and Trade, Subdivision Infinity ve
  Metalstorm** kurulu. Prototipi hızlandırmak için bu oyunların modellerini **yerel geliştirmede
  geçici referans varlıkları** olarak kullanmak istiyorum.
- **V2** APK'ları ben sağlamayacağım. Hazır olduğunda telefonu **USB kablosuyla** bağlamamı ve
  gerekiyorsa **USB hata ayıklamayı açıp bilgisayarı onaylamamı** iste.
- **V3** ADB üzerinden **cihazı ve ilgili oyunların paket adlarını** tespit et.
- **V4** **Ana APK, split APK** ve **normal erişimle alınabilen** ilgili varlık dosyalarını bilgisayara çek.
- **V5** Telefonda **uygulamaları veya verilerini değiştirme**; erişilemeyen dosyaları ve engelleri bildir.
- **V6** Dosyaların yapısını ve kullanılan **varlık formatlarını** incele.
- **V7** Astera için gerekli ve kullanışlı **gemileri, silah/namlu modellerini, asteroitleri,
  enkazları, uzay yapılarını ve çevre nesnelerini** çıkar. Gerekli **dokuları ve materyal
  bağımlılıklarını** modellerle birlikte koru.
- **V8** Dosya adlarına bakmakla yetinme; modelleri **görsel olarak önizleyip** uygun olanları seç.
- **V9** Parçalara da bak: tam varlık işe yaramayabilir ama bir geminin **motoru, motor alevi
  animasyonu, mermi izleri, roketler, sesler** vb. — ne lazımsa incele.
- **V10** Seçilenleri Three.js'te kullanılabilecek **GLB/glTF** biçimine hazırla. **Ölçek, yön,
  model merkezi, materyaller, namlu çıkış noktaları ve çarpışma hacimlerini** kontrol et.
- **V11** **Orijinalleri ayrı tut**; dönüştürme ve optimizasyonu **kopyalar** üzerinde yap.
- **V12** Görsel bir **katalog** oluştur: her varlığın **kaynak oyunu, orijinal dosyası, yerel yolu ve
  projede nerede kullanıldığı** kayıtlı olsun.
- **V13** Açıkça **geçici** olarak işaretle; **yalnız yerel geliştirme sürümünde** kullan;
  **yayımlanan sürüme veya herkese açık depoya dâhil etme.**
- **V14** **Oyun mantığını bu modellere bağımlı kurma.** Model, materyal ve efektler sonradan
  kolayca değiştirilebilsin.
- **V15** Ben **"Tamam, oyun oldu"** dediğimde kullanılan bütün geçici varlıkları ve
  bağımlılıklarını denetle, **değiştirileceklerin tam listesini** çıkar ve Astera'ya özgü kendi
  modellerimizle değiştirme aşamasına geç.

## 2. Kırmızı çizgiler

1. Depo **public**. Referans varlık, ondan türetilmiş dosya, ekran görüntüsü veya katalog **git'e
   girmez**, `public/`'e, `assets/source/`'a, CI'ya, prod build'e, PR/issue'ya **girmez**.
   **2026-10-30:** servis edilen paket (`dist/v2`, `audio/v2`) artık tamamen bizim; prod build ve APK
   kısıtı onun için kalktı, native build webp lite paketi gömer ([decisions.md](../decisions.md) 2026-10-30).
   Paket git'e yine girmez; ham arşivdeki yabancı orijinaller hiçbir yere girmez.
2. Telefonda **yalnız okuma**: kurma, kaldırma, `pm clear`, `pm disable`, `am force-stop`,
   `push`, `rm`, `settings put`, `run-as`, `su`/root, `adb backup`, Shizuku vb. **yok**. Telefona bir
   şey kurmak gerekirse önce sahibe sorulur.
3. **Şifreli/korumalı** varlıklar (şifreli Unreal `.pak`, özel şifreli Unity paketleri, DRM)
   **kırılmaz**; anahtar aranmaz. "Erişilemedi" diye raporlanır.
4. Varlıklar yalnız prototip referansıdır; oyun mantığı ve veri onlara bağlanmaz (V14).

## 3. Kod tarafı: değiştirilebilirlik

<a id="kayit-defteri"></a>
### 3.1 Paket sözleşmesi (repo'da)

`apps/web/src/arena/assets/manifest.ts` referans paketinin biçimini Zod ile tanımlar ve yalnız
`/__ref/dist/...` ya da `/__ref/audio/...` yollarını kabul eder. `assets/load.ts`, dev'de
`/__ref/dist/v2/manifest.json`'ı okur ve her şeyi uçuştan önce gerçek ilerlemeyle yükler. Kod
mantıksal adlara bağlıdır: `ships.hero|rivals`, `rocks`, `giants`, `crystals`, `shards`,
`structures`, `props`, `textures`, `sky.faces|env`, `fx.*`, `sounds.*`, `music`.
Gemi kaydı model yolunu, `uvFlip` / `rotateY` düzeltmesini ve motor noktalarını (`engines`)
taşır. Oyun geometrisi (vuruş yarıçapı, çarpıştırıcılar, namlu noktası) `rules/arena`
verisidir, modelden okunmaz.

**Yedek:** manifest yoksa (prod, CI, temiz klon) ya da bir dosya yüklenemezse o parçanın
prosedürel karşılığı çizilir (`render/procedural.ts`). Prod ve testler referans varlığa
muhtaç değildir.

### 3.1b v2 paketi (KG-K22, 2026-10-08)

`astera-refs/prepare_v2.py` paketi üretir (orijinallere dokunmaz):

```sh
~/astera-ref-assets/.tools-venv/bin/python -I astera-refs/prepare_v2.py astera-refs
```

Çıktı: `dist/v2/sky` (2048² gökyüzü küpü, Subdivision set 4 + 256² ışık küpü), `dist/v2/tex`
(1024 px webp dokular), `dist/v2/fx`, `audio/v2/*.ogg`, `dist/v2/manifest.json`.

| Grup | Kaynak |
|---|---|
| Gemiler, kayalar, dev kayalar, kristaller, yapı parçaları, gökyüzü, efekt dokuları, müzik | Subdivision |
| Motor, ambiyans, kayaya çarpma | Subdivision |
| Atış, isabet, turbo, kalkan, gemi patlaması, kilit, kazı döngüsü | Space Commander |
| Uzak/yakın patlama, sekme, hasar uyarısı, öldürme, duman, gizlenme, UI | Metalstorm |

Subdivision'ın FMOD bankasında ayrık efekt sesi az olduğu için seslerin çoğu diğer iki oyundan
gelir. Gemi motor noktaları modellerin nozul ağlarından ölçülüp `prepare_v2.py`'ye yazıldı.

### 3.2 Yerel arşiv ve dev servisi

- Güncel arşiv: worktree kökündeki **`astera-refs/`** (KG-K17), `.gitignore` ve ESLint dışında.
  Orijinal APK'lar `~/astera-ref-assets/raw/` altında korunur; `raw-source.json` konumu kaydeder.
  `extract/`: ham ve tüm dışa aktarılan içerik; `catalog/`: kaynak/kayıt/dönüşüm notları;
  `dist/`: Three.js'e hazırlanmış kopyalar; `audio/`: seçilen örnekler; `manifest.json`: mantıksal eşlemeler.
- Alternatif dizin: `ASTERA_REF_ASSETS_DIR`, `apps/web/.env.local`'da (kökteki
  `.gitignore` `.env.local`'ı her dizinde dışlar) veya kabuk ortamında.
- Vite eklentisi `apps/web/src/lib/refAssetsPlugin.ts` (`apply: 'serve'` — build'de hiç yok):
  `/__ref/*` → `$DIR/dist` ve `$DIR/audio`; `/__ref/manifest.json`. Proje içinde yalnız tam
  `astera-refs/` yolu kabul edilir; diğer proje içi yollar reddedilir. Değişken yoksa bu
  klasörde manifest aranır; o da yoksa referans servisi açılmaz. Gerçek yol kontrolü,
  symlink ve traversal korumaları vardır. Ham APK/Unity dosyaları ve katalog HTTP ile servis edilmez.
  Vite `VITE_` öneki olmayan değişkenleri
  `.env.local`'dan `process.env`'e yüklemez: `vite.config.ts` değeri `loadEnv(mode, root, '')` ile
  okuyup eklentiye verir (önce kabuk ortamı).
- Koruyucular: `.gitignore`'a `astera-refs/`, `astera-ref-assets/`, `**/__ref/**`, `*.ref.glb`; `git ls-files`
  ile bu desenlerde izlenen dosya olmadığını doğrulayan kontrol; web build'ine paket dosyası
  kopyalanmadığı (native build yalnız webp lite paketi `__ref/` altına gömer, 2026-10-30) ve prod'da dev servisinin bulunmadığı kontrolü; kayıt defterinin varsayılanları
  `/__ref/`'e işaret etmez. Kodda sınır doğrulama için `/__ref/` metni bulunması varlığın paketlendiği anlamına gelmez.
- Referans varlıklar **`tools/models.mjs`'ten geçirilmez** (çıktısı `public/`'e yazar).
- İçinde referans varlık görünen görüntü/video yalnız `.dev/arena/` veya `$DIR/captures`.

## 4. Ön koşullar (sahibin bilgisayarı)

`uname -a` ile işletim sistemini öğren (önceki oturumlar Linux kullanıyordu). Gerekli araçlar;
`sudo` gerektiren kurulumdan **önce sahibe sor**:
Android platform-tools (`adb`) · build-tools `aapt2` (isteğe bağlı) · AssetRipper (Unity;
Linux sürümü var) · gerekirse UE Viewer (umodel) / FModel (Unreal) · Blender 4.x (başsız
dönüştürme ve önizleme) · ImageMagick (`magick`; repo araçları da kullanıyor) · `unzip`/`7z` ·
`gltf-transform` (repo dev bağımlılığı: `pnpm exec gltf-transform`). Disk: APK + OBB birkaç GB
olabilir (`df -h ~`).

## 5. ADB prosedürü (sahiple birlikte)

1. Sahibe söyle: **"Varlık çıkarma için hazırım. Telefonunu USB kablosuyla bilgisayara bağlar
   ve ekran kilidini açar mısın?"**
2. `adb devices -l`
   - Liste boşsa: **"Telefonda Ayarlar → Telefon hakkında → Yapı numarasına 7 kez dokunup
     Geliştirici seçeneklerini aç; sonra Geliştirici seçenekleri → USB hata ayıklama'yı aç."**
     Bazı telefonlarda USB modu "Dosya aktarımı" olmalı.
   - `unauthorized` ise: **"Telefonda 'USB hata ayıklamaya izin verilsin mi?' sorusu çıktı;
     'Bu bilgisayara her zaman izin ver'i işaretleyip İzin ver'e dokunur musun?"**
   - Linux'ta `no permissions` ise udev kuralı gerekir (`sudo` ister): önce sahibe sor; onay
     gelirse dağıtımın `android-sdk-platform-tools-common` paketi ya da `51-android.rules`
     kuralı, ardından `adb kill-server`.
3. Cihaz bilgisi (rapora): `adb shell getprop ro.product.model`, `ro.build.version.release`,
   `ro.product.cpu.abi`.
4. Paketleri bul: `adb shell pm list packages -3` → anahtar kelimeler: `metalstorm`, `starform`,
   `vendetta`, `guildsoftware`, `subdivision`, `crescentmoon`, `spacecommander`, `homenet`.
   Doğrula: `adb shell dumpsys package <pkg> | grep -E "versionName|versionCode"`; uygulama adını
   5. adımdan sonra, çekilen `base.apk` üzerinde yerelde
   `aapt2 dump badging base.apk | grep application-label` ile teyit et.

   | Oyun | Beklenen paket (web kaynakları — **cihazda doğrula**) | Beklenen motor |
   |---|---|---|
   | Metalstorm (Starform) | `com.starform.metalstorm` | Unity (URP) |
   | Vendetta Online (Guild Software) | `com.guildsoftware.vendetta` | özel motor (NAOS) |
   | Space Commander: War and Trade | `com.HomeNetGames.SpaceCommander` | büyük olasılıkla Unity |
   | Subdivision Infinity (Crescent Moon / MistFly) | `com.crescentmoongames.subdivision` | mobil sürüm büyük olasılıkla Unity (DX sürümü UE4) |

5. APK'lar: `adb shell pm path <pkg>` → her yolu
   `adb pull <yol> $DIR/raw/<pkg>/<versionCode>/` (base + tüm `split_*.apk`).
6. OBB: `adb shell ls -la /sdcard/Android/obb/<pkg>/` → varsa çek.
7. Dış veri: `adb shell ls -la /sdcard/Android/data/<pkg>/files/` → indirilmiş paketler
   (Unity Addressables/AssetBundle, `.pak` vb.) varsa çek. Android 11+ erişimi cihaza göre
   reddedebilir → **raporla**, zorlama.
8. İç veri `/data/data/<pkg>` root'suz erişilemez → raporla, deneme.
9. Her çekilen dosyanın boyutu ve `sha256`'sı `$DIR/REPORT.md`'ye.
10. Sahibe söyle: **"Çekme bitti, telefonu çıkarabilirsin. İstersen USB hata ayıklamayı tekrar
    kapatabilirsin."**

**`REPORT.md` biçimi:** cihaz · oyun başına paket/sürüm · çekilen dosyalar (yol, boyut, sha256) ·
erişilemeyenler ve nedeni (izin, şifre, iç veri) · motor tespiti · çıkarma sonucu.

## 6. Motor tespiti ve araçlar

- `unzip -l base.apk` (ve split'ler): `lib/*/libunity.so` + `assets/bin/Data/` → **Unity**;
  `libUE4.so`/`libUnreal.so` + OBB'de `.pak` → **Unreal**; hiçbiri → özel motor.
- **Unity → AssetRipper** (ilk tercih): "Primary Content" dışa aktarım (modeller glTF/GLB, dokular
  PNG, sesler OGG/WAV); olmazsa "Unity Project" dışa aktarımı + Blender. Alternatif AssetStudio
  (Windows) → FBX.
- **Unreal → UE Viewer / FModel**, yalnız **şifresiz** `.pak`.
- **Özel motor (Vendetta):** standart dosya (`png/dds/ktx/ogg/wav/obj`) varsa al; özel biçimse
  **raporla ve geç** (düşük öncelik).
- Ham çıktı `$DIR/extracted/<oyun>/` altında **dokunulmadan** kalır (V11).

## 7. İnceleme ve seçim (V7–V9)

- Kategoriler: oyuncu gemisi adayları (hafif/orta/ağır) · ilk şahıs silah/namlu · asteroitler
  (boyut çeşitleri) · enkaz · istasyon/kapı/fener · uydu/şamandıra · kargo kabı · gökyüzü ·
  **parçalar:** motor/egzoz, motor alevi animasyonu veya dokusu, mermi izi, roket, patlama
  sprite/flipbook, duman dokusu, kalkan balonu · **sesler:** atış, isabet, patlama, motor, turbo,
  uyarılar, UI.
- Her aday için Blender başsız (veya three.js + Playwright) ile **önden, yandan, üstten, arkadan**
  PNG önizleme üret ve **görüntüyü kendin incele** (Read aracı resim gösterir) — dosya adına göre
  seçme (V8).
- Ölçütler: Astera kimliğine yakınlık (koyu, ince çizgili, turkuaz vurguya uyum), siluet
  okunurluğu, üçgen bütçesi (gemi ≤ 5k — `docs/visual-design.md`; silah ≤ 2k, asteroit ≤ 1k — öneri),
  doku sayısı ve boyutu, animasyon/parça kullanılabilirliği.
- Kısa liste katalogda `selected` olur; istenirse sahibe tek sayfalık katalogla gösterilir.

## 8. Dönüştürme ve normalize (V10–V11)

Kopya üzerinde (`$DIR/work/<id>/`), çıktı `$DIR/dist/<id>.glb`:
1. Ölçek **metre**; rol hedefi (oyuncu gemisi ~14–18 m boy). Sınır kutusunu kaydet.
2. Yön: burun **+Z**, yukarı **+Y** (repo kuralı).
3. Pivot: gemide sınır kutusu merkezi; silahta kabzaya yakın, namlu +Z'ye.
4. Malzeme: PBR metal/pürüzlülük; emissive (motor ışığı) korunur; dokular ≤ 1024 px (gemi 512),
   WebP; ölü malzeme/doku temizliği.
5. Düğümler: silahta `muzzle`, gemide `engine_*` boş düğümleri (yalnız görsel efekt bağlantısı;
   oyunun namlu noktası `rules/arena` verisidir, uyumsuzluk kataloga yazılır).
6. Çarpışma: sınır küresi yarıçapını hesapla, kurallardaki vuruş yarıçapıyla karşılaştır, farkı yaz.
7. `pnpm exec gltf-transform optimize ... --compress meshopt --texture-compress webp` (istemci
   meshopt'u zaten çözer); isteğe bağlı `_lod`.
8. Sesler: OGG/Opus, tepe −1 dBFS'e normalize, gerekirse mono.
9. `$DIR/manifest.json`'a mantıksal kimlik → dosya eşlemesi ekle.

## 9. Yerel katalog (V12–V13)

`$DIR/catalog/catalog.json` + `index.html` (küçük resim ızgarası, filtreler, her kartta
**"GEÇİCİ — YALNIZ YEREL"** rozeti). Kayıt alanları: `id`, `kind`, `sourceGame`, `package`,
`versionCode`, `originalPath` (APK/paket içindeki yol), `extractedPath`, `distPath`, `sha256`,
`tris`, `materials`, `textures`, `bbox`, `scale`, `hitRadiusDelta`, `notes`, `usedAs` (mantıksal
kimlikler), `usedIn` (repo'da kimliğin geçtiği dosyalar — `grep` ile otomatik), `status`
(`candidate | selected | in-use | rejected`), `temp: true`. Katalog depo dışında kalır.

## 10. "Tamam, oyun oldu" protokolü (V15)

1. `manifest.json`'daki her eşlemeyi ve `usedIn`'i (grep) dök → **değişim listesi**.
2. Repo'ya yalnız **oyun adı içermeyen** liste yazılır: `docs/komutan-gemisi/degisim-listesi.md`
   (mantıksal kimlik · rol · gereken özellik: üçgen, ölçek, düğümler, ses süresi · öncelik).
3. Her kimlik için kendi varlığımız: `docs/visual-design.md` hattı (kaynak `assets/source/models/`,
   `node tools/models.mjs`, kabul çekimi, performans bütçesi, yedek). Gemi GLB'lerinde `?v=` önbellek
   kırıcı yok → model değişiminde sürümleme eklenir (`ui/planet-assets.json` deseni).
4. Kimlikler tek tek manifest'ten düşer; sonunda `ASTERA_REF_ASSETS_DIR` **olmadan** dev oturumu
   eksiksiz görünmeli.
5. Yerel referans dizininin silinip silinmeyeceğini sahip söyler.

## 11. Hukuki not

Ticari oyunların modelleri, dokuları ve sesleri telif hakkıyla korunur; kullanım koşulları
genellikle çıkarmayı yasaklar. Bu varlıklar yalnız sahibin kendi cihazından, yalnız yerel ve
geçici prototip referansı olarak kullanılır; dağıtılmaz, yayımlanmaz, yayın öncesi tamamen
değiştirilir (KG-K6). Şifre/DRM aşılmaz.
