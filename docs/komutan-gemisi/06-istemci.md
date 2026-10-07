# Komutan Gemisi — İstemci (web) mimarisi

> **Durum:** Mimari karar + uygulama rehberi (2026-10-07), koda karşı doğrulandı (HEAD `2fa122f`).
> **Hedef okuyucu:** Arena sahnesini, girişini, efektlerini ve HUD katmanını yazacak agent.
> **Dayanak:** S8–S11, S47, S52–S58, S69 ([01](01-urun.md)); KG-T23–T29 ([02](02-kararlar.md)).
> **Önce oku:** `docs/interface.md`, `docs/visual-design.md`, `docs/visual-quality.md`,
> `docs/incident-ios-lazy-module-2026-09.md`.

---

## 1. Bugün ne var (doğrulandı)

- React 19, Vite 6, Tailwind 4 (v2 token'ları `apps/web/src/v2/tokens.css`), three 0.185 +
  `@react-three/fiber` 9 + drei + postprocessing. Router yok: `App.tsx` oturum fazları
  (`starting/landing/rehearsing/servers/blocked/ready`) ve `academyReplay` dalı.
- Galaksi (`galaxy/GalaxyCanvas.tsx`) `GameShell` içinde **hiç unmount olmaz**; sayfalar onun
  üstünde `Sheet`. Alt dok: Galaksi · Üs · Filo · İstihbarat · Klan (`v2/hud/Dock.tsx`).
- Üs sayfasında `v2/hud/BaseSwitch.tsx` (`'world' | 'research'`): Komutan Gemisi için doğal kapı.
- Kalite kademeleri `lib/quality.ts` (`useRenderQuality`; DPR tavanı 2 / 1,5 / 1), kare sürücüsü
  `galaxy/frames.tsx` (`strideFor`), bağlam kaybı `galaxy/gpuContext.ts` (`useGpuContext`),
  model yönü/ölçeği `galaxy/model.ts`, gemi manifesti `ui/fleet-v2-assets.ts`, sayfa içi 3D
  görüntüleyici örneği `screens/SkinPreview.tsx`, efekt dokuları `galaxy/vfx.ts`.
- Yalnız müzik var (`lib/music.ts`, HTMLAudioElement); efekt sesi ve WebAudio yok. Titreşim
  `lib/haptics.ts` (iOS'ta etkisiz). Joystick yok.
- Performans: `lib/fpsMeter.ts`, `lib/perfSession.ts` + `lib/perfRecorder.ts` (admin panelinden kayıt).
- Lazy yalnız 5 ekranda; başarısız lazy import tek kök sınıra (`shell/ErrorBoundary.tsx`) düşer
  ve **tüm uygulama** çöker; import yeniden denemesi yok.
- `public/` içindeki **her şey** prod'a gider (dev'e özel dışlama yok).
- Diller: tr, en, de, fr, es, ja; `apps/web/test/i18n.test.ts` anahtar ve yer tutucu eşitliğini zorlar.

## 2. Giriş ve bayraklar (KG-T27)

- F1–F7: bayrak açıkken `BaseSwitch`'e üçüncü seçenek. `BaseView`'a `'ship'`, `GalaxyView.tsx`
  `Panel` birliğine yeni değer, `openBase` eşlemesi. 350 px'te üç segment sığsın diye anahtar
  etiketi kısa: **"Gemi"** (sayfa başlığı "KOMUTAN GEMİSİ"). Prototipte sayfa basit bir kart:
  "Savaş alanına gir (prototip)" + prototip ayarları (yerleşim A/B, önleme işareti, hassasiyet,
  efekt sesi). F8'de tam yönetim sayfası ([07 §8](07-hud-ve-ekranlar.md#yonetim-sayfasi)).
- F1–F2 dev kısayolu: `?arena=sandbox` (yalnız `DEV` / `VITE_VISUAL_TEST`) oturum açmadan yerel
  sandbox'ı açar — görsel test ve hızlı deneme için.
- Bayrak: `import.meta.env.DEV || import.meta.env.VITE_ARENA === '1'` (`vite-env.d.ts`'de
  tiplenir); stage'de ayrıca `session.me.isAdmin`. Sunucu tarafı `ARENA_ENABLED`.

<a id="uygulama-dali"></a>
## 3. Uygulama dalı ve geçişler (KG-T23, S8, S52)

- `App.tsx`'te yeni durum `arena: null | { mode: 'enter' | 'resume' }`. Doluyken `GameShell`
  yerine lazy `ArenaRoot` çizilir → galaksi canvas'ı unmount olur → **tek WebGL bağlamı**. React
  Query önbelleği App üstünde olduğu için dönüşte galaksi hızlı açılır.
- **`academyReplay`'den farkı:** App'teki `useEventStream(ready && !academyReplay, …)` ve
  `useLiveAlerts(…)` koşullarına `arena` **eklenmez**: veri uçuşta da tazelenir. Uçuşta galaksi
  toast'ları HUD'u kapatmasın diye `ArenaRoot` `useSilenceToasts()` çağırır (Academy gibi);
  düşen haberler Signals'ta okunmamış kalır.
- **Yerleşim değişimi:** SSE'deki yerleşim değişimi App'te `rollover` çağırır ve oturumu yeniden
  kurar. `arena` açıkken `rollover` **ertelenir**: arena aynı olayla gelen `kick{placement}`
  üzerine "Geri çağrıldın" sonucunu gösterir; oyuncu "Ana gezegene dön" deyince ertelenen
  `rollover` çalışır. Sessizce kaybolmaz.
- **Sayfa atılırsa devam (KG-K5):** girişte `sessionStorage`'a arena niyeti yazılır, sonuç
  ekranında silinir. Oturum `ready` olduğunda kayıt varsa uygulama doğrudan `arena: { mode:
  'resume' }` açar; sunucu canlı pilotu devralır ya da son sonucu gönderir
  ([05 §3](05-ag-ve-sunucu.md#uc-nokta)).
- **Lazy + sınır + yeniden deneme:** `importWithRetry` (başarısızsa 500 ms bekle, bir kez daha);
  yine olmazsa arenaya özel hata kartı ("Savaş alanı yüklenemedi — yenile / geri dön"). Arenanın
  **kendi ErrorBoundary'si** var; kök sınıra düşmez.
- **Yükleme ekranı** dürüst ilerleme gösterir (repo kuralı: ayrıştırılamayan işe sahte yüzde
  yok): kod → modeller (n/m) → sesler → **"BAŞLA"**. BAŞLA dokunuşu tam ekranı, yön kilidini
  (Android) ve `AudioContext`'i açar ([03 §10](03-ucus-ve-kontroller.md)), sonra bağlantı →
  `welcome` (kısa "Bağlanıyor…" katmanı) → doğuş. `resume` kipinde BAŞLA beklenmez (gemi zaten
  sahada); ses ve tam ekran ilk dokunuşta açılır. Beklerken kontrol ipuçları (S12).
- Çıkış (`result` sonrası "Ana gezegene dön"): arena unmount, `arena = null`, galaksi geri gelir;
  F8'de Üs → Komutan Gemisi görünümü açılır.

<a id="render"></a>
## 4. Render mimarisi (KG-T24, KG-T25)

- `<Canvas frameloop="never">`. Kendi `requestAnimationFrame` sürücüsü; kare politikası
  `strideFor(60, refreshMs)`: ekranın her N'inci karesi, 60 fps'in altına düşmeden (60 Hz→60,
  90→90, 120→60, 144→72). Bu bir **tavan değildir**: 90 Hz telefon 90 fps çizer. Isınma ölçülürse
  önce kalite kademesi (DPR), sonra arka görüş; düzensiz aralıklı, zaman kapılı tavan kullanılmaz
  (`frames.tsx` docblock'undaki "beat" sorunu). Sürücü her çizilen karede:
  1. Sabit adım biriktirici: gerekirse `world.step` / tahmin adımları (1/30 sn). **Sim adımını
     yalnız sürücü atar.**
  2. İnterpolasyon katsayısı ile kendi gemi + diğerleri + mermiler konumlanır.
  3. `advance(timestamp)` → tek öncelikli `useFrame` **yalnız çizer**:
     **(a) ana sahne** (kamera burunda) → **(b) silahlar** (`renderer.clearDepth()` sonrası ayrı
     sahne/katman, sabit FOV; asteroide gömülmez) → **(c) arka görüş:** geriye bakan kamera düşük
     çözünürlüklü bir `WebGLRenderTarget`'a (ör. ölçek 0,5) **iki karede bir** çizilir; doku **her
     karede** HUD çerçevesinin ölçülmüş dikdörtgenine, U ekseni çevrilerek (ayna, §6) kompozit
     edilir. Toz/küçük nesneler katmanla dışarıda. Scissor'la doğrudan çizim olmaz: tuval her
     karede silinir (`preserveDrawingBuffer: false`), atlanan karede titrer ve çözünürlük düşmez.
- **Draw call bütçesi** (`docs/visual-quality.md` savaş tavanı 100 içinde): ana ≤ 60, silahlar
  ≤ 6, arka görüş ≤ 25. Üçgen/doku tavanları aynı tablodan.
- **F1–F2 (çevrimdışı):** aynı `rules/arena` dünya adımı (`world.step`, dronlar dahil) istemcide
  yerel koşar. F3'te dünya sunucuya taşınır, istemci yalnız kendi gemisini tahmin eder; bu yüzden
  sim kodu baştan "yerel dünya" ve "sunucu dünyası" arasında değiştirilebilir kurulur.
- Post-processing yok (bloom yerine emissive malzeme + eklemeli sprite). Galaksiyle tutarlı:
  tone mapping yok, sRGB çıkış.
- Instancing: mermiler (halka tampon, ör. 512), duman bulutları (billboard), asteroitler (tür
  başına), toz (`Points`).
- **Bellek ayırma disiplini:** kare/tick yollarında `new` yok; vektör/kuaterniyon/matris önceden
  ayrılır. Sıcak modüller düz TS'tir ve Node'da test edilir (`test/frame-allocations.test.ts`
  yalnız galaksi kamerasının bir dilimini kontrol ediyor — arenayı korumaz).
- Oyun durumu React dışında; HUD bir DOM katmanı: ~10 Hz güncellenen dış store
  (`useSyncExternalStore`); nişangâh, isabet işareti, önleme işareti, hasar yönü yayları **ref
  ile** her karede.
- Kalite: DPR `useRenderQuality`'den; arenaya özgü: arka görüş çözünürlük ölçeği, duman bulutu
  tavanı, toz sayısı kademeye göre. Bağlam kaybı: `useGpuContext`; kayıpta sim ve ağ sürer,
  "Grafik yeniden yükleniyor" katmanı.

## 5. Efektler ve his (S47, S58, S69)

| Olay | Görsel | Ses | Kural |
|---|---|---|---|
| Atış | namlu ucunda küçük eklemeli parlama (40–60 ms) | kısa atış | **nişangâhı kapatmaz** |
| Uçuş | ince eklemeli iz (instanced); kendi izin açık renk, düşman izi tehdit rengi | — | |
| Gemiye isabet (onaylı) | kıvılcım + nişangâhta beyaz X | belirgin "tık" | **yalnız sunucu `hit`'iyle** |
| Asteroide/yapıya çarpma | toz/taş parçası | boğuk | gemi isabetinden ayırt edilir |
| Kalkana çarpma | mavi dalgalanma | "kalkan" sesi | hasar yok |
| Yok edilme | patlama + ışık + enkaz | patlama | ayrıca "öldürme" işareti |
| Hız | kamera yakınında hıza göre uzayan toz çizgileri, paralaks | motor perdesi hızla | gaz kesilince çizgiler kısalır, perde düşer |
| Turbo | FOV +birkaç derece, kenarlarda çizgi | turbo uğultusu | merkez temiz |
| Hasar alma | yönlü yay + o kenarda ince kırmızı | uyarı | titreşim (Android) |
| Duman | yumuşak parçacık (derinlikle solan), arka görüşte de | püskürme | aşırı çizim bütçesi |
| Görünmezlik | sahibine hafif renk filtresi; başkalarına yalnız yakın titreşim | açılış/bozulma | bozulma her iki tarafa net |
| Kalkan | gemi çevresinde balon; kalkışta çözülme | kalkış sesi | "KALKAN KALKTI" metni |

## 6. Arka görüş (S11, S52)

Üst ortada çerçeve (referans görsellerdeki gibi, ekran genişliğinin ~%60'ı, ~80 px yükseklik,
"ARKA GÖRÜŞ" etiketi). İçerik: arkadaki her şey, kendi dumanın dahil. Görüntü **aynalıdır**
(dikiz aynası): sol arkadaki takipçi çerçevenin solunda görünür, tehdit doğru yanda okunur (S74).
Düşman köşe çerçeveleri (küçük) burada da çizilir, isimler gizli. Performans ölçümüne göre
çözünürlük/hız düşürülür; gerekirse dokununca küçülme seçeneği (sahibe F7'de sorulur).

## 7. Ses ve titreşim (KG-T28)

- `apps/web/src/arena/audio/sfx.ts`: WebAudio; `AudioContext` "BAŞLA" dokunuşunda açılır
  (§3); tamponlar yükleme ekranında çözülür; ses havuzu (en çok 16 eşzamanlı), basit uzaklık
  zayıflaması.
- Kategoriler: kendi/başka atış, onaylı isabet, kalkan, asteroit, patlama, motor döngüsü (hıza
  bağlı perde), turbo, duman, görünmezlik aç/boz, düşük yakıt, hasar, çıkış sayacı tıkları, UI.
- Arenada müzik susar ama **kayıtlı tercih değişmez**: `setMusicEnabled` tercihi `localStorage`'a
  yazdığı için kullanılmaz; `lib/music.ts`'e kaydetmeyen bir bastırma eklenir (test: tercih
  değişmez, dönüşte müzik kaldığı yerden). Cihaz başına efekt sesi ayarı (kalite ayarı gibi).
- Kaynak: referans çıkarma (yerel, [09](09-varliklar-ve-referans-cikarma.md)) veya CC0; kalıcı
  sesler F11'de.
- Titreşim `haptic()`: hasar alınca `warn`, öldürme/çıkış `commit`, yetenek `tap`.

## 8. Dil ve görsel kurallar

- i18n tek ad alanı (`game`) kullanır. Arena anahtarları `arena.*` altında: her dilde
  `apps/web/src/i18n/locales/<dil>/arena.ts` yazılır ve o dilin `index.ts`'inde birleştirilir.
  **Tip kaynağı İngilizce** (`Resources = Widen<typeof en>`); altı dil (tr, en, de, fr, es, ja)
  aynı commit'te, `i18n.test.ts` anahtar ve yer tutucu eşitliğini zorlar. Metinler sahibin
  dilinde (Türkçe) tasarlanır.
- DOM/React HUD bileşenleri `apps/web/src/v2/arena/` altında: v2 token testi
  (`test/v2/tokens.test.ts`, ham renk yasağı) burada da geçerli olsun diye. ESLint `text-[Npx]`
  yasağı → tipografi yalnız rol ölçekleriyle ([07](07-hud-ve-ekranlar.md)).

## 9. Hata ayıklama ve ölçüm (KG-T29)

- Dev katmanı (`` ` `` ile aç/kapa): fps, kare ms p50/p95, draw call, üçgen, doku/geometri sayısı
  (`renderer.info`), RTT, jitter, snapshot yaşı, uzlaştırma hatası (m), indirme KB/sn, oda tick p95
  (sunucudan).
- `window.__arena` (yalnız `import.meta.env.DEV` veya `VITE_VISUAL_TEST==='1'`): durum, ölçüler,
  girdi enjeksiyonu, dev mesajları (bot ekle, ağ koşullayıcı) — `tools/arena-visual.mjs` bunu kullanır.
- `perfRecorder` entegrasyonu: arena kareleri de kaydedilir (admin "kayıt" arenada da çalışır;
  sahibin telefonunda ölçüm için).

## 10. Dosya yerleşimi (öneri)

```
packages/rules/src/arena/      tuning, vec (aritmetik), controls, flight, weapons, spread(tablo),
                               collision, abilities, shield, exit, fuel, cargo, layout, pilot,
                               world(step), los, protocol, codec, index
packages/rules/test/arena/     *.test.ts (fast-check ile özellik testleri dahil)
apps/server/src/arena/         register(upgrade + odaları başlat; `buildApp`/`index.ts`'ten),
                               auth, schemas, room, rooms, connection, bots, netsim,
                               lifecycle(bus, presence, sezon, boşaltma), settle (F8)
apps/server/test/arena/        *.test.ts
apps/web/src/arena/            ArenaRoot, loader(importWithRetry), net/(socket, clock),
                               sim/(predict, interpolate, store), render/(driver, passes,
                               rearView, effects/*), input/(joystick, throttle, keyboard, layouts),
                               audio/sfx, assets/registry, dev/
apps/web/src/v2/arena/         HUD ve ekran bileşenleri (DOM)
apps/web/src/i18n/locales/*/arena.ts
apps/web/test/arena/           *.test.ts(x)
tools/arena-visual.mjs
```
