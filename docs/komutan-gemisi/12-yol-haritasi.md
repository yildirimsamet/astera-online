# Komutan Gemisi — Yol haritası

> **Durum:** Faz planı (2026-10-07). Güncel faz durumu [README](README.md#durum-panosu)'deki
> panodadır; bu dosya fazların **içeriğini** tanımlar.
> **Hedef okuyucu:** Geliştirmeyi yürüten agent.
> **İlke (S45, S80–S83):** önce his. Sahip "kontrol rahatlığı ve savaş hissi yeterince iyi"
> demeden (F7 kapısı) kapsam büyümez. Her faz TDD ile ([11](11-test-ve-playtest.md)), her faz
> sonunda tam `pnpm verify` yeşil ([tanım](README.md#calisma-duzeni)) ve belgeler güncel
> ([README §Belge bakımı](README.md#belge-bakimi)).

---

<a id="f0"></a>
## F0 — Hazırlık

- Belgeleri okuma sırasıyla oku. `pnpm install`, `docker compose up -d`, `pnpm verify` → başarısız
  test **adlarını** README panosuna yaz: bu **temel çizgidir** (eski `docs/test-baseline-2026-09-18.md`
  güncel olmayabilir). Önceden kırık testi düzeltme, yalnız kaydet.
- `master`'dan özellik dalı (ör. `feature/komutan-gemisi`).
- **Sahibe sor:** [KG-A1](02-kararlar.md#kg-a1) (kalkan bitişi), [KG-A2](02-kararlar.md#kg-a2)
  (yakıt bitince kurtarma gecikmesi), [KG-A3](02-kararlar.md#kg-a3) (tek depo); [KG-A27](02-kararlar.md#kg-a27)'yi
  bilgi olarak anlat (onay F5'ten önce). Cevapları KG-K'ye taşı. Cevap beklenmez: gelene kadar
  prototip varsayılanıyla devam.
- `.gitignore` koruyucuları + koruma testi; `ASTERA_REF_ASSETS_DIR`; bayrakların tipleri
  (`VITE_ARENA` → `vite-env.d.ts`; `ARENA_ENABLED`, `ARENA_DEV` → `env.ts`).
- **Kabul:** temel çizgi kayıtlı, koruyucular ve test yerinde, sorular soruldu (cevap ya da
  "varsayılanla devam" kayıtlı).

<a id="v"></a>
## V — Referans varlık hattı (paralel; sahip ve telefon gerekir)

Prosedür [09](09-varliklar-ve-referans-cikarma.md). Sıra: ADB çekme (sahiple) → `REPORT.md` →
motor tespiti ve çıkarma → önizleme ve seçim → normalize → `dist/` + `manifest.json` → yerel
katalog. Kod tarafı (kayıt defteri, dev eklentisi, koruyucular) F1 içinde, prosedürel yer
tutucularla birlikte TDD ile yapılır.
- **Kabul:** katalogda seçilenler "GEÇİCİ" rozetli; `ASTERA_REF_ASSETS_DIR` ile dev oturumu
  onları kullanır, olmadan prosedürel yer tutucular; `git ls-files`'ta tek bir referans dosya yok.

<a id="f1"></a>
## F1 — Çevrimdışı uçuş sandbox'ı (ağ yok)

- **Amaç:** ağ kodundan önce uçuş hissini kurmak ve sahibin telefonunda denemek.
- **Rules:** `arena/` iskeleti + `@astera/rules/arena` subpath; `tuning`, `vec` (aritmetik),
  `controls`, `flight`, `fuel`, `layout`, gemi–küre çarpışması, sınır.
- **Web:** bayraklı giriş (`BaseSwitch`), `App.tsx` dalı, lazy + kendi sınırı + yeniden deneme,
  yükleme ekranı, render sürücüsü, üç geçiş (ana, silahlar, arka görüş), sahne (kayıt defteri),
  girdi (çubuk, gaz kolu, yerleşim A/B, klavye), asgari HUD (gövde, yakıt + kalan süre, hız, gaz),
  dev katmanı, ayarlar (hassasiyet, pitch ters, yerleşim), uçan hedef dronları (yerel), dev
  kısayolu `?arena=sandbox` ([06 §2](06-istemci.md)). Sim adımını yalnız render sürücüsü atar.
- **Kapsar:** S9–S17, S47, S53–S56, S61–S63.
- **Kırılma riski:** `App.tsx` (galaksinin unmount/remount'u; SSE sürekliliği; panel durumu;
  `academyReplay` ile etkileşim) · `BaseSwitch` mevcut görünümleri · altı dil eşitliği.
- **Sahip ara kontrolü** (kısa, kapı değil): telefonda yön, gaz, hız hissi, arka görüş, A/B.
- **Kabul:** testler yeşil; görsel doğrulama; sahibin kısa notları kayıtlı.

<a id="f2"></a>
## F2 — Çevrimdışı silahlar

- **Rules:** ateş temposu, dağılım tablosu (+ tek seferlik üretim betiği), mermi, göreli swept
  çarpışma, hasar, atış başına yakıt, önleme çözücüsü.
- **Web:** izler, namlu parlaması, isabet efektleri (gemi ↔ kaya ayrı), isabet/öldürme işaretleri,
  dron hasarı ve patlaması, önleme işareti + izlenen hedef, WebAudio ses modülü, titreşim.
- **Kapsar:** S18, S58, S64–S73.
- **Kabul:** "ateş ettim" ile "vurdum" net ayrışıyor; 300 m'de nişanlı atışların ~%80'i isabet.

<a id="f3"></a>
## F3 — Sunucu, WebSocket, senkronizasyon

- **Sunucu:** `ROLE=arena` (`buildApp` üzerinden), rol başına route, sağlık, `/arena/ws`, Origin
  izin listesi, `hello` (kimlik, `mode`, `ARENA_ADMIN_ONLY`), odalar (dev'de tek oda), `Room.step`,
  girdi FIFO'su, snapshot (self tam hassasiyet) + AOI, kadro, olaylar, ping/pong, backpressure,
  protokol sürümü, `Presence.touch`, bus dinleyicisi (`placement_changed`), dev ağ koşullayıcı, ölçüler.
  `pnpm dev` ve `tools/dev-up.sh` arena sürecini başlatır; Vite proxy `/arena` (`ws: true`).
- **Web:** soket, arena saati, tahmin + uzlaştırma (sıfır gecikmede düzeltme 0), interpolasyon,
  uzak gemiler, mermi spawn olayları ve çift iz engeli, ağ ölçüleri, `kick` → "yenile".
- **Kapsar:** S26, S49–S51, S60.
- **Kırılma riski:** `app.ts` route kaydının rol başına ayrılması (api/both rollerinde route
  kümesi **birebir aynı kalmalı** — testle), `env.ts` şeması, Vite proxy (`/api` `ws: false` kalmalı).
- **Kabul:** telefon + masaüstü birlikte uçuyor; 150 ms yapay gecikmede kendi gemi akıcı;
  WS entegrasyon testi dahil yeşil.

<a id="f4"></a>
## F4 — PvP

- Sunucu tarafı hasar/ölüm/sonuç; rastgele giriş; doğuş kalkanı (F0 cevabıyla); botlar
  (`chaser`, `carrier`, `drone`, `camper`, `runner`); gecikme kovasına göre isabet ölçümü.
- Web: hasar yönü, arka görüşte çerçeveler, düşman çerçevesi + izlenen hedefin gövdesi, kalkan
  görseli ve "KALKAN KALKTI", patlama → sonuç ekranı → dönüş.
- **Kapsar:** S26–S29, S32–S34 (kalıcılık hariç), S74–S75.
- **Sahip ara kontrolü** (isteğe bağlı, kapı değil; S80): ilk PvP hissi — telefon + masaüstü
  ikinci hesap veya botlar.
- **Kabul:** B1/B2 botlarla oynanıyor; TTK ölçüldü ([04 §4](04-savas-mekanikleri.md)).

<a id="f5"></a>
## F5 — Extraction

- **Önce:** [KG-A27](02-kararlar.md#kg-a27) onayı (durum × olay kuralları).
- Çıkış alanları, çıkış durum makinesi ve panel nedenleri; durum × olay tablosu
  ([04 §1](04-savas-mekanikleri.md#durum-olay)); test kargosu; saçılma ve (kısmi) toplama; yakıt
  bitmesi (F0 cevabı); bağlantı kopması (30 sn; görünürlük değişiminde yeniden bağlanma; sayfa
  atılırsa `resume`); yerleşim/sezon olaylarında geri çağrılma ve ertelenen `rollover`; tüm sonuç
  ekranları.
- **Kapsar:** S30–S31, S35–S37, S43–S44, S57, S79; KG-K5.
- **Kabul:** B3–B7 geçiyor; "neden başlamadı/kesildi" her durumda yazılı.

<a id="f6"></a>
## F6 — Yetenekler

- Turbo (şarj, basılı/kısa, dönüş cezası), duman (LOS, HUD gizleme), görünmezlik (sunucu
  filtresi, titreşim, ateşle bozulma, hasar), yetenek HUD durumları, sesler.
- **Kapsar:** S22–S25 (geliştirme hariç), S56, S58, S76–S78; KG-K4.
- **Kabul:** B1/B2 yeteneklerle; turbo tek başına kaçışı garantilemiyor (ölçüldü).

<a id="f7"></a>
## F7 — Sahip incelemesi (KAPI)

- Sahibin bilgisayarında LAN kurulumu; B1–B9 sahiple; telefonda performans kaydı; gecikme ön
  ayarları; yapılandırılmış sorular ([11 §7](11-test-ve-playtest.md)). Bulgu → öneri → uygulama →
  tekrar.
- **Kararlar:** KG-A4 (yerleşim, dikey/yatay), KG-A5, KG-A19, KG-A22, KG-A23, KG-A25, KG-A26,
  değer ayarları.
- **Kabul:** sahip hissi açıkça onaylar. O zamana kadar F8+ başlamaz.

<a id="f8"></a>
## F8 — Kalıcılık ve yönetim sayfası

- **Önce sor:** KG-A6, A7, A8, A9, A10, A11, A13, A14, A15, A16, A17, A20, A21, A24 +
  `ekonomi-etudu.md` ([08 §8](08-ilerleme-ve-ekonomi.md)).
- Tablolar ve migration'lar, sortie REST + soket sahiplenmesi, tek işlemli yerleşim, transfer ve
  freeze korumaları, açılışta kurtarma, yönetim sayfası (3D hangar, sekmeler, geliştirme
  satırları, tamir, yakıt doldurma, basılı tutarak giriş), onaylanırsa galaksi temsili ve sortie
  raporu, ruleset kapısı.
- **Kırılma riski:** migration sırası (`docs/deployment.md` kural 5–6), `commanderTransfer`,
  `freezeSeason`, `loadLocked`, bus kind'ları (yalnız eklenir), `apps/server/test/contract.test.ts`
  (istemcinin ayrıştırdığı yeni route'lar eklenir).
- **Kabul:** idempotentlik testleri; uçtan uca: gir → çık → sortie yerleşti, **TEST kargo
  yatırılmadı**; geri çağrılmada kargo ambarda; patla → tamir gerekli. Gerçek kargo yatırma yolu
  sentetik kargoyla birim testinde (uçtan uca F9'da).

<a id="f9"></a>
## F9 — Kaynak toplama ve ekonomi

KG-A12 kararı; kaynak düğümleri/kırılan asteroitler/kapsüller; gerçek kargo türleri; simülatörle
ekonomi etüdü; yeni kaynak/kartlar (KG-A10). **Kabul:** sahip onaylı etüt; simülasyonda ARR
bantta; uçtan uca gir → topla → çık → gerçek kargo başkentte.

<a id="f10"></a>
## F10 — Yayın hazırlığı

[05 §15](05-ag-ve-sunucu.md) listesi; sunucu tarafı duman filtresi (KG-T18 kapısı); botlarla
kapasite testi (oda × pilot, tick p95, bant); stage'de 4G oynanış; PC/mobil ölçümü (KG-A18);
repo belgeleri (`architecture.md`, `deployment.md`, `game-design.md`, `glossary.md`,
`interface.md`, `visual-design.md` varlık envanteri); bayrakla açılış planı; her kesinti için
sahip onayı (dağıtım kuralı 12). **Kabul:** stage yeşil; sahip yayını onaylar.

<a id="f11"></a>
## F11 — Varlık değişimi ("Tamam, oyun oldu")

[09 §10](09-varliklar-ve-referans-cikarma.md) protokolü. **Kabul:** `ASTERA_REF_ASSETS_DIR`
olmadan eksiksiz görünüm; değişim listesi kapandı.

## Sonra

Monument ödüllerine kart/yeni kaynak (S41) · klan müttefikliği (KG-A7) · NPC/bot canlılığı
(KG-A6) · tilt seçeneği · öldürme akışı · hıza bağlı dönüş gibi derinlik fikirleri (yalnız
sahibin onayıyla).
