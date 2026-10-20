# Komutan Gemisi — İstemci (web) mimarisi

> **Durum:** Mimari karar + uygulama rehberi (2026-10-07). §4, §9 ve §10 MVP koduna göre güncel (2026-10-08).
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
## 4. Render mimarisi (KG-T24, KG-T37)

> 2026-10-08 MVP'de uygulanan hâl. Eski plandaki R3F canvas'ı, ayrı silah geçişi ve "post yok"
> kararı geçersiz (KG-K19 3. şahıs, KG-K24 görüntü kalitesi).

- **Düz Three.js:** `client.ts` tek `WebGLRenderer` kurar; React yalnız HUD ve kontrolleri çizer.
  Kare sürücüsü `driver.ts`: sabit adım biriktirici (1/30 sn), **sim adımını yalnız sürücü
  atar**; sonra interpolasyonla kendi gemi, diğerleri ve mermiler yerleşir ve kare çizilir.
- **Post** (`render/post.ts`, pmndrs `postprocessing`): MSAA'lı half-float hedef → tek birleşik geçiş:
  mercek (turboda radyal hız bulanıklığı + hasarda kromatik vuruş) → mipmap bloom (girişi sonlu değer
  korumasından geçer) → kuşak pusu perdesi → vinyet → AgX ton eşleme.
  DPR en düşük kalite ayarı dışında 2'ye kadar.
- **Sahne** (`render/stage.ts`): 2048² Subdivision gökyüzü küpü, ışık için ayrı küçük küpten
  PMREM, güneş halesi, kaya grupları (model başına tek örneklenmiş çizim + her karede CPU'da
  görüş konisi ve mesafe kırpması), kristal haleleri, yapılar (kutu çarpıştırıcısı triplanar
  gövde shader'ıyla çizilir, `render/materials.ts`), kapı fenerleri ve portal, alan sınırı ızgarası.
  Sık kuşakların bulutları kamera içlerine girmeden söner; kuşağın içinde kameranın etrafındaki tek
  bir pus küresi, post perdesi ve koyu sis devralır. Sisin tamamen gizlediği kaya çizilmez (KG-X20).
- **Gemiler** (`render/ships.ts`): gövde yatışı, dokulu motor alevi şeridi (seyirde mavi, turboda turuncu),
  nozul parlaması, başka gemilerde motor izi, seyir ışıkları, gövdeye sarılı kalkan, gizlenme
  titreşimi, isabet parlaması, hasar kıvılcımı, kazı ışını.
- **Efektler** (`render/effects.ts`, `render/dust.ts`): parçacık havuzları (`add` / `alpha` /
  `luma` karışımı), mermi izleri (iki yüzlü, prosedürel çekirdek), namlu parlaması, patlama,
  sekme kıvılcımı, duman; kamera yakınında hıza göre uzayan toz çizgileri.
- **Arka görüş:** ayrı kamera iki karede bir küçük bir half-float hedefe çizilir (kendi gemi
  gizlenir); doku her karede HUD çerçevesine aynalı kompozit edilir.
- **Bellek:** kare/tick yollarında `new` yok; vektörler önceden ayrılır.
- Oyun durumu React dışında; HUD ~10 Hz dış store (`store.ts`, `useSyncExternalStore`);
  nişangâh, önleme işareti, düşman çerçeveleri, iniş halkası ve radar her karede DOM'a yazılır.
- Shader kuralı: bütün `pow` tabanları kıstırılır (MSAA kenar örnekleri NaN üretir, KG-T37);
  kameraya göre dönen dörtgenler iki yüzlü çizilir (sarılma yönü çevrilebilir).

## 5. Efektler ve his (S47, S58, S69)

| Olay | Görsel | Ses | Kural |
|---|---|---|---|
| Atış | namlu ucunda küçük eklemeli parlama (40–60 ms) | kısa atış | **nişangâhı kapatmaz** |
| Uçuş | motor alevi; başka gemilerde zamanla sönen iz (kendi gemide iz yok, KG-X17) | motor katmanları | |
| Ağır hasar (gövde < %50) | gövdeden ara ara kısa kıvılcım çizikleri; < %30'da ince duman izi | %30'a ilk düşüşte tek uyarı | sürekli yanan efekt yok (KG-X19) |
| Gemiye isabet (onaylı) | kıvılcım + nişangâhta beyaz X | belirgin "tık" | **yalnız sunucu `hit`'iyle** |
| Asteroide/yapıya çarpma | sekme + kıvılcım/taş parçası, sert çarpışta sarsıntı | tek seferlik boğuk vuruş (döngü yok) | gemi isabetinden ayırt edilir |
| Kalkana çarpma | mavi dalgalanma | "kalkan" sesi | hasar yok |
| Yok edilme | patlama + ışık + enkaz | patlama | ayrıca "öldürme" işareti |
| Hız | kamera yakınında hıza göre uzayan toz çizgileri, paralaks | motor perdesi hızla | gaz kesilince çizgiler kısalır, perde düşer |
| Turbo | ateşleme parlaması; ivmede gemi kameradan kopar, hız oturunca kamera yetişir; FOV ~+10°, kenarlarda radyal bulanıklık, kameranın etrafında yoğun toz, uzun turuncu alev ve kıvılcımlar | turbo başlangıcı + uğultu | merkez keskin kalır |
| Hasar alma | yönlü yay + o kenarda ince kırmızı | uyarı | titreşim (Android) |
| Duman | yumuşak parçacık (derinlikle solan), arka görüşte de | püskürme | aşırı çizim bütçesi |
| Görünmezlik | sahibine hafif renk filtresi; başkalarına yalnız yakın titreşim | açılış/bozulma | bozulma her iki tarafa net |
| Kalkan | gövdeye sarılı ince parıltı; kalkışta çözülme | kalkış sesi | "KALKAN KALKTI" metni |

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

## 9. Hata ayıklama ve ölçüm (KG-T29, KG-T38)

- Tanı paneli (`diagnostics.ts`; adreste `&diag` ya da uçuşta sol alttaki "fps · tanı"): yakalanan
  hatalar, GPU/WebGL yetenekleri, yükleme süreleri, FPS, çizim çağrısı ve üçgen sayısı.
- `window.__arena` (yalnız dev / `VITE_VISUAL_TEST`): durum ve girdi enjeksiyonu;
  `tools/arena-visual.mjs` bunu kullanır.

## 10. Dosya yerleşimi (2026-10-08)

```
packages/rules/src/arena/   tuning, types, vec, controls, flight, fuel, collision, grid, layout,
                            aim, pilot, visibility, combat, bots, world, protocol, index
packages/rules/test/arena/  *.test.ts (arithmetic: KG-T11 tarayıcısı)
apps/server/src/arena/      server.ts (oda, WS, bot dünyası, snapshot)
apps/server/test/arena/     room.test.ts (gerçek WS), env.test.ts
apps/web/src/arena/         ArenaEntry/ArenaGate/flags (giriş), Sandbox (yükleme → hazırlık →
                            uçuş → sonuç), client (sahne + tahmin + HUD izdüşümü), driver,
                            network, input, Controls, Hud, store, landing, audio, copy,
                            diagnostics, loading, arena.css
apps/web/src/arena/render/  camera, stage, ships, effects, dust, materials, post, procedural
apps/web/src/arena/assets/  manifest (Zod), load (ilerlemeli yükleme, model hazırlama)
apps/web/test/arena/        *.test.ts(x) — istemci testleri MVP onayından sonra yeniden yazılacak (KG-K25)
tools/arena-visual.mjs
```
