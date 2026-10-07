# Komutan Gemisi — Test, ölçüm ve sahiple oynanış

> **Durum:** Test stratejisi + oturum protokolü (2026-10-07).
> **Hedef okuyucu:** Her fazda test yazacak ve sahiple oynanış oturumu yürütecek agent.
> **Dayanak:** CLAUDE.md "Development discipline" (TDD **zorunlu**; tasarım/stil/CSS hariç) ve
> "Quality bar"; `docs/engineering-standards.md`; S60, S63, S80–S83 ([01](01-urun.md)).

---

## 1. Her iş için TDD akışı

CLAUDE.md "Development discipline" adımları aynen uygulanır: kenar durumları → önce testler →
**FAIL** → en basit implementasyon → **PASS** → inceleme → tüm testler. "Yeşil" tanımı (temel
çizgi): [README §Çalışma düzeni](README.md#calisma-duzeni). Test koda uydurulmaz; önce kök neden.

## 2. Katmanlar

**`packages/rules/test/arena/` (Node, vitest, fast-check)**
- Uçuş: `s ≥ 0` her zaman; gaz 0 → sonlu sürede tam 0; durmuşken `idleBurn`; bırakınca dönüş
  ≤ 4 tick'te durur, aşma yok; turbo dönüş cezası; roll dengelemesi sınırları; sınır ve itme.
- **Determinizm:** aynı tohum + aynı girdi dizisi → bit düzeyinde aynı durum (özellik testi).
- **Aritmetik kuralı:** `packages/rules/src/arena/` kaynağında
  `Math.sin|cos|tan|asin|acos|atan|atan2|pow|exp|log|hypot|cbrt` veya `**` operatörü geçerse
  başarısız olan kaynak tarama testi (KG-T11).
- Ateş temposu (uzun sürede tam `fireRate`), yakıt maliyeti, dağılım tablosu (koni içinde, merkez
  ağırlıklı, seviyeyle daralır, 300 m'de ~%80 isabet), swept çarpışma (çok yüksek hızda tünel yok,
  siper keser, göreli hareket), baş mesafesi.
- Durum makineleri: kalkan (ateş, çıkışa giriş, kargo toplama, süre), çıkış (her neden metni;
  yerinde dönüş sıfırlamaz), yakıt bitmesi (girdi yok, kurtarma sayacı, bu sürede ölüm), bağlantı
  kopması (tekrar → nötr → kopma → dönüş), görünmezlik (ateşle bozulur, hasar alır, süre biter),
  turbo şarjı, duman ömrü, LOS. **Durum × olay tablosunun her hücresi**
  ([04 §1](04-savas-mekanikleri.md#durum-olay)).
- Kargo korunumu (toplam yalnız çıkış ve kapsül yok oluşuyla azalır), kısmi toplama, aynı tick'te
  iki pilotun aynı kapsülü alması (deterministik sıra: pilot kimliği). Doğuş yönü yatay.
- Codec gidiş-dönüş (fast-check), bozuk girdide çözücünün atması.

**`apps/server/test/arena/` (vitest, `FixedClock`, gerçek zamanlayıcı yok)**
- `room.step()` ile tick; girdi disiplini (taşkında basış bitleri taşınır, boşlukta
  `inputRepeatMax` sonra nötr, eski/atlamalı `seq`, `ackSeq`, kırpma, hız sınırı düşürür ama
  kesmez, 4 KB); hesap başına tek pilot (devralma); `hello.mode=resume` asla doğurmaz; protokol
  sürümü uyuşmazlığı; kimlik hataları (bozuk, süresi dolmuş, yanlış `typ`); `ARENA_ENABLED=false`;
  `ARENA_ADMIN_ONLY`; Origin izin listesi; kadro (`roster`, `join`, `leave`); AOI ve görünmezlik
  filtresi; `Presence.touch` çağrısı; `placement_changed` tepkisi; oda uykusu (kapsül veya sayaç
  varken uyumaz); bir odadaki istisnanın diğerlerini durdurmaması; kapanışta boşaltma; **bayt/sn
  eşiği**; rol başına route kümeleri (`api`/`both` bugünküyle aynı).
- WS entegrasyonu gerçek geçici portta (desen: `apps/server/test/stream.test.ts`): bağlan →
  `hello` → `welcome` → `snap`; yanlış sürüm → `kick`; ikinci bağlantı → eskisi `replaced`.
- F8: işlem idempotentliği (aynı yerleşim iki kez → tek etki), `SEASON_FROZEN`, transfer bekleme,
  TEST kargonun asla yatırılmaması, geri çağrılmada kargonun ambarda kalması.

**`apps/web/test/arena/` (vitest + jsdom + Testing Library; R3F mock'u
`test/skin-preview-still.test.tsx` gibi)**
- Saf modüller: tahmin + uzlaştırma (yapay gecikmeyle; **sıfır gecikmede düzeltme tam 0**),
  interpolasyon tamponu uyarlaması, arena saati, çubuk eğrisi ve ölü bölge, gaz kolu yapışma +
  çift dokunuş, kısa dokunuş kilidi, **yerleşim isabet alanları** (çakışma yok, en küçük boyutlar,
  kenar boşlukları), önleme işareti çözücüsü ve ufuk formülü, HUD store hız sınırı,
  `importWithRetry`, kayıt defteri çözümü ve `/__ref/` koruması.
- Uygulama dalı: `rollover` arenada ertelenir; `sessionStorage` niyeti → `resume`; müzik
  bastırması kayıtlı tercihi değiştirmez; toast'lar uçuşta susar.
- Bileşenler: durumlar yalnız renkle değil metin + ikonla; çıkış paneli neden metinleri; sonuç
  ekranları; i18n anahtarları (mevcut `i18n.test.ts` altı dili zorlar).

**Araçlar:** referans varlık koruması (`git ls-files` desen testi); F10'da `apps/web/dist`'te
`__ref` yok kontrolü.

## 3. Kenar durumları — sıra kuralları

`Room.step()` sırası sabit ([05 §5](05-ag-ve-sunucu.md)); buna göre aynı tick'teki çakışmalar:
isabet çıkış sayacından **önce** işlenir (son tick'teki isabet sayacı sıfırlar; gövde ≤ 0 ise
yok edilme) · çıkış yakıttan **önce** (aynı tick'te çıkış tamamlanıp yakıt biterse çıkış kazanır)
· kalkan süresi ile ateş aynı tick'te → kalkan kalkar · sezon kapanışı çıkış sayacının ortasında
→ zorunlu güvenli dönüş. Ayrıca: NaN/Infinity/metin girdileri Zod'da reddedilir · 2 sn takılmadan
sonra ≤ 5 yakalama adımı · `towed` sonrası yeniden bağlanan sonucu alır, yeniden doğmaz · bus
kopuksa yerleşim değişimi kaçmasın diye 60 sn'de bir `placementVersion` kontrolü (yedek).

## 4. Performans ölçümü (S60)

- **Gerçek cihaz** (sahibin telefonu). SwiftShader/başsız sonuçlar kabul kanıtı değildir
  (`docs/deployment.md`); yalnız regresyon sayacıdır.
- En kötü sahne: yakında 8 bot ateş ediyor, 2–3 duman bulutu, patlamalar, arka görüş açık.
  Dev katmanı + `perfRecorder` ile 5 dk kayıt.
- Hedef (dengeli kalite): kare p50 ≥ 55 fps, p95 ≤ 25 ms; draw call bütçesi
  [06 §4](06-istemci.md#render); üçgen/doku tavanları `docs/visual-quality.md` savaş tavanını aşmaz; 5 dk sonra telefonun
  ısınması sahibe sorulur. Aşılırsa önce arka görüş çözünürlüğü/hızı, sonra duman tavanı, sonra toz.
- **Geçiş (S52):** "Savaş alanına gir" → BAŞLA hazır p50 ≤ 4 sn (önbellekli, Wi-Fi), arena →
  galaksi ≤ 2 sn; 5 giriş-çıkış döngüsünden sonra sızıntı yok (`renderer.info` sayıları ve JS
  heap başa döner, WebGL bağlamı tek).

## 5. Ağ koşulları

Dev ağ koşullayıcı ön ayarları: 0 / 80 / 150 / 250 ms ± 30 ms, takılma patlamaları. Ölçülen:
uzlaştırma hatası (m), gecikme kovası başına isabet oranı, his (sahip). F10'da stage üzerinden 4G.

## 6. Bot senaryoları (S82)

| # | Senaryo | Gösterir |
|---|---|---|
| B1 | Sahip test kargosu taşır, `chaser` bot kovalar, sahip çıkışa gider | kaçış mümkün mü (S82) |
| B2 | `carrier` bot turbo/dumanla kaçar, sahip kovalar | yakalama mümkün mü |
| B3 | Sahip çıkışta durur, `camper` ateş eder | sayaç sıfırlanması + nedeni; duman/görünmezlikle çıkış |
| B4 | Dev komutuyla yakıt düşük | kurtarma sayacı, kargo düşmesi, sonuç ekranı |
| B5 | Sahip yok edilir | patlama → sonuç → bot kapsülleri toplar |
| B6 | Uygulama 10 sn ve 40 sn arka planda; sayfa yeniden yüklenince | devam / çekilme / `resume` |
| B7 | Doğuş, ateş; doğuş, çıkışa giriş | kalkan kalkışının anlaşılması (KG-A1) |
| B8 | B1, 150 ms gecikmeyle | gecikme hissi |
| B9 | En kötü sahne | performans |
| B10 | Telefon vs masaüstü (F10) | PC/mobil farkı |

<a id="sahiple-oturum"></a>
## 7. Sahiple oynanış oturumu (S80–S83)

- **Kurulum:** sahibin bilgisayarında `pnpm start` (Postgres + API + web; arena süreci de
  `tools/dev-up.sh`'e eklenmiş olmalı) ve `pnpm phone` (aynı Wi-Fi için LAN adresi + QR). İkinci
  oyuncu: masaüstü sekmesinde **ikinci bir hesap** (klavye, [03 §12](03-ucus-ve-kontroller.md));
  aynı hesap telefonu düşürür (tek pilot). `ARENA_DEV`'de tüm pilotlar tek odada olduğundan
  hesabın galaksisi önemsizdir. Ya da botlar. LAN'da HTTP: iOS'ta jiroskop yok, titreşim yalnız
  Android.
- **Akış:** senaryoyu bir cümleyle anlat → sahip oynasın → yapılandırılmış sorular: kontrol (A mı
  B mi), hız hissi, nişan, isabet geri bildirimi, gecikme, ısınma, kaçabildin mi / yakalayabildin
  mi, çıkış anlaşılır mıydı, sonuç ekranı ne olduğunu anlattı mı.
- **"Oynatarak göster" (S83):** sahip telefonda oynar; agent ayrıca bot senaryolarının Playwright
  kayıtlarını (`tools/arena-visual.mjs --record`) `.dev/arena/`'ya üretip gösterir (referans varlık
  görünen kayıt paylaşılmaz/commit edilmez).
- **Kayıt:** `docs/playtest-log.md`'ye "Komutan Gemisi" bölümü (dosyanın dili — İngilizce — ve
  biçimiyle: gün · saat · cevaplar) + ölçüm tablosu. Kararlar [02](02-kararlar.md)'ye, değer değişiklikleri
  [04 §13](04-savas-mekanikleri.md#baslangic-degerleri) günlüğüne.
- **Kapı:** sahip "kontrol rahatlığı ve savaş hissi yeterince iyi" demeden kapsam büyümez (S83).

## 8. Görsel doğrulama

`tools/arena-visual.mjs` (Playwright, 350×812, DPR 2, dokunma açık; `tools/visual.mjs`
deseninde): `window.__arena` ile deterministik senaryo (gir, uç, ateş et, çıkış, yok edilme),
PASS/FAIL kontrolleri (HUD metinleri, merkez temiz, konsol hatası yok, sayaçlar), ekran
görüntüleri `.dev/arena/`. Galaksi etkilenmediği için mevcut `node tools/visual.mjs` de geçmeli.
