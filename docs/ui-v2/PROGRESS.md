# Gözlemevi arayüzü — ilerleme defteri

**Bağlam sıkıştırıldıysa ya da yeni oturumsan önce bunu oku.** Okuma sırası:
1. Bu dosya (özellikle "Sıradaki iş").
2. `docs/ui-v2/gozlemevi.md` (şartname, ~1.000 satır) içinde sıradaki işin kimliğiyle geçen bölüm;
   tamamını okuma: `grep -n "B9 ·\|E3 ·\|^| K8" docs/ui-v2/gozlemevi.md` ile bul, o aralığı oku.
3. İlgili kod. Şartname ile kod çelişirse **kod kazanır**; çelişki buraya ve şartnameye yazılır.

- **Şartname:** `docs/ui-v2/gozlemevi.md` — tek kaynak, doğrudan düzenlenir (sahip kararı 2026-09-23: HTML ve
  artifact bırakıldı). İkonlar `docs/ui-v2/icons.svg`; mockup HTML'i yalnız geçmişte (commit 08bf3f6,
  `docs/ui-v2/gozlemevi.html`).
- Onaylı plan: `~/.claude/plans/bu-g-revi-sen-yapacaks-n-fluttering-sketch.md`.
- Dal / worktree: `ui-v2` @ `.claude/worktrees/ui-v2` (ana ağaca dokunma, `git stash` yok). Master her faz başında birleştirilir.
- Yayın: bayrak yok; önümüzdeki sezonla. K1–K11 sahip tarafından 2026-09-23'te tamamen onaylandı.

## Çalışma kuralları (CLAUDE.md, zorunlu)
- TDD: test → FAIL → kod → PASS → review. Yalnız stil/CSS istisna.
- `pnpm verify` sıfır tip ve lint hatası; kırmızı test seti aşağıdaki listeden büyümez.
- Sunucu testleri bu worktree'de özel `astera_uiv2_test` veritabanında koşar (adı `_test` ile bitmeli;
  `DATABASE_URL=postgres://astera:astera@localhost:5433/astera_uiv2_test npx vitest run <dosyalar>`, apps/server),
  paylaşılan `astera_test`'e dokunma. **Sahip talimatı (2026-09-23):** tam sunucu paketi ~40 dk; iş sırasında yalnız
  dokunulan kodun test dosyaları, tam paket yalnız teslimde bir kez. Web paketi hızlı, commit öncesi koşar.
- Her yeni metin 5 dilde (tr, en, de, fr, es); testler İngilizce çalışır.
- **Görmeden tasarım yok (sahip talimatı 2026-09-23: "Gözü kapalı yapmamalısın").** Her v2 bileşeni
  `apps/web/v2-gallery.html` galerisine (`src/v2/gallery/Gallery.tsx`, örnek veriyle) eklenir ve commit'ten önce
  fotoğraflanıp okunur: sunucu `pnpm --filter @astera/web exec vite --port 5199 --strictPort --host 127.0.0.1`,
  kamera `node tools/v2-gallery.mjs <çıktı> en tr de` (350 px DPR 2 bölüm bölüm + 1280 px + sayfa görünümleri;
  hesap açmaz, kayıt limitine takılmaz). Uzun dillerde (tr, de, fr) taşma bakılır. Gerçek oyun kabuğa bağlandıktan
  sonra `node tools/visual.mjs` ile (kayıt limiti: ~5 koşu / 30 dk).
- **Gerçek oyunda kamera (F2'den beri):** özel veritabanı `astera_ui_v2` (@5433; `astera` ve test veritabanlarına
  dokunma), API `DATABASE_URL=postgres://astera:astera@localhost:5433/astera_ui_v2 PORT=3199 npx tsx src/index.ts`
  (apps/server), web `ASTERA_API=http://localhost:3199 npx vite --port 5199 --strictPort --host 127.0.0.1` (apps/web).
  `COMMANDER=shell83807481 node tools/v2-shell.mjs <çıktı> [en|tr]` kayıt açmadan girer (şifre `correct-horse-battery`);
  diğer diller için girişten sonra `localStorage['astera.language']` değiştirilip sayfa yenilenir. Saatlerce
  sürecek durumlar bu veritabanında sahnelenir (ör. `players.newcomer_shield_until`, `planets.buffer_*`).
  Akademi: `WEB=http://127.0.0.1:5199 node tools/visual.mjs <çıktı> --academy` (39 ders baştan sona).
- Boyutlar sıkı: gövde 12 px (sahibin "büyük yazı yok" talimatı).

## Durum
| Faz | İçerik | Durum |
|---|---|---|
| Adım 0 | Worktree, başlangıç ölçümü, şartname kopyası + fleet escape güncellemesi, gezegen modelleri | Tamam |
| F0 | H1 (`lib/directives.ts` kalkanlıyken tehdit), H2 (`shell/StatusBar.tsx` depo dolu kırmızısı) — `ui-v2`'ye commit, sahip master'a cherry-pick eder | Tamam (074f338, a7b8348) |
| F1 | v2 token, yazı tipi, ikon, kit (B5–B9, B12, v2 Sheet, kaynak ölçeri) | Tamam |
| F2 | v2 HUD (B1–B4), kabuk, IA | Tamam |
| F3 | E2 Dosya, E3/B14 Fırlatma, E4 Filo, S1, S2 | Tamam (faz incelemesi `fa16b98`, `e7f062e`) |
| F4 | E6 Rapor, S4 | Tamam (`35d7bf6`, `d52bc68`, `aad6e0d`) |
| F5 | E5 Üs + Araştırma (K6, K9) | Tamam (`5b80f0b` … `642b16c`) |
| F6 | E7 İstihbarat, E9 Klan, Komutan sayfası | Sırada |
| F7 | E10 Sen yokken + S3 | Bekliyor |
| F8 | E11 Masaüstü | Bekliyor |
| F9 | 3D gezegenler (16 `.glb`, Draco → meshopt, LOD) | Bekliyor |
| F10 | Temizlik | Bekliyor |

## Sahip geri bildirimi (2026-09-24) — F3'ün geri kalanından ÖNCE
Sahip: *"Bana o tasarımları gösterip başka bir şey yapmamalısın."* Taslak ekran görüntüleri
`docs/ui-v2/design-mocks/` altında (image*.png): HUD (image, image copy 4), atmosfer, renk, netlik, ekranlar
(image copy 5: dosya, fırlatma, filo; 6: üs, rapor, istihbarat; 7: araştırma, klan, sen yokken; 8: masaüstü).
Her v2 yüzeyi bu görüntülerle karşılaştırılır. Maddeler (hepsi yapıldı, gerçek oyunda / galeride görüldü):
1. ~~Aktif gezegene yakınlaşma~~ `8ffcde3`: sağda View'ın altında yuvarlak saydam Home (`flyHome`, dock'un ikinci
   Galaksi basışıyla aynı).
2. ~~Aktif olay~~ `8ffcde3`: Now hattının altında solda olay çipleri (kalan süreyle); seçim varken çekilir (B3).
3. ~~Havuz~~ `2b30f0d`: Üs cüzdanında `CollectBubble place="base"` — ilk birimden itibaren, yanında havuzun adı
   ("Havuz"/"Works", doluysa sarı "Havuz dolu"); depo doluysa Üretim sekmesine (Depo). Galaksi balonu %10 eşiğinde kalır.
4. ~~Zil~~ `8ffcde3`: kenarlıklı küçük kare, rozet kırmızı.
5. ~~Komutan çipi~~ `03e2c68`: Komutan sayfası komutan kartıyla açılır (avatar, klan, galaksi + sezon günü, sıra /
   alan, dünyalar / en çok, kalkan); çip taslaktaki gibi iki harfli kare. Menü kalemleri kartın altında.
6. ~~Dock saydam~~ `8ffcde3`.
7. ~~Sohbet~~ `8ffcde3`: Home'un altında yuvarlak düğme, okunmamışta nokta.
8. ~~Rafineri görselleri~~ `a04ffe6`: Rafineri/Çıkarıcı kendi 3 kademeli render'larıyla; Döteryum Tesisi'nin render'ı
   yok, döteryum görselinde kalır. "Yeni donanım" işareti artık resmin değiştiği yerden okunur (Hangar'ı da düzeltti).
9. ~~Üs sekmeleri~~ `a04ffe6`: v2 anahtar görünümü, her etiket tam, içerik genişliğinde; sığmayan dil yana kayar
   (Fransızca 350'de sığıyor).
10. ~~Now hattı~~ `8ffcde3`: içeriden kart.
11. ~~Taslaklara benzerlik~~ `86bfdd0` Filo (tam sayfa, sekmeler önce ve sayılı, çizgili satırlar, geri çağırma satırın
    altında cümleyle); `c532bf5` Fırlatma/transfer/konvoy (tek satır gemi + kompakt "− 32 + Maks", D142 istatistikleri
    ikinci satırda küçük, bantlar ince başlık, cetvel kartsız, figürler tek kart, basılı tut turkuaz ve "Basılı tut ·"
    önekli). Kalan fark bilinçli: cetvelin "ne temsil ettiği" satırı yüzeyde kalır (netlik; testi var).

## Sahip geri bildirimi 2 (2026-09-24 akşam) — F6'dan ÖNCE, bu sırayla
Sahip: *"Bunlar önemli. Gerekirse işini durdur bunları baştan planla."* F6 (İstihbarat) okumada durduruldu, kod yazılmadı.
Sahibin sorusuna cevap (3. madde): İstihbarat ve Klan savaş odası F6'ydı (sırası gelmişti); **eşya sheet'leri, kapasite
bölümleri, ÖY/önleyici kartları Üs'ün yüzeyleriydi ve F5 onlarsız kapatıldı — atlandı**; klan ekranının geri kalanı ve sohbet
sheet'i şartnamenin faz listesinde yoktu (yalnız E9 savaş odası, K1 "sohbet zilde") — plan boşluğu, şimdi eklendi.
Mock yok: eşya sheet'i, klan ekranının tamamı, sohbet, kapasite, ÖY kartları → mock dilinden türetilir (fırlatma sheet'i
`image copy 5` orta, savaş odası `image copy 7` orta, Üs kartları `image copy 6` sol). Dört soru her yüzeyde uygulanır.

**A · Galaksi ekranı (küçük, net):**
- A1 (madde 1) Zil sayfası yalnız **Sinyaller · Kronik**; Sohbet sekmesi kalkar (K1'in bu kısmı sahip kararıyla geri alındı).
  Sohbet kendi sayfasında açılır; okunmamış noktası yalnız sohbet düğmesinde.
- A2 (madde 2) Sohbet düğmesi galakside **sağ alt**, dock'un hemen üstü (başparmak); bağlam kartı/toplama balonuyla çakışmaz.
- A3 (madde 6) Görünüm sayfasındaki galaksi özeti (çevrimiçi, kaya, enkaz, korsan) galakside **sağ üstte**, kompakt ve
  saydam; Görünüm çipi yalnız teleskop ikonu (yazısız; erişilebilir adı kalır).
**B (madde 4)** Menü kartlarındaki "kendini X içinde öder" (`gains.repays`) kalkar.
**C (madde 5)** Toplanan her yerde (galaksi balonu, Üs cüzdanı) havuz **kaynak başına** yazılır (ikon + miktar): arızada
bir kaynak durur, depo doluyken kısmi toplama olur — tek sayı ("1,5b") hangi kaynağın kaldığını söylemez.
**D · Eski görünümde kalan yüzeyler, mock diline göre baştan (madde 3):**
- D1 Eşya detay sheet'leri: `ItemSheet` (bina/alet/uydu yükseltme) ve `BuildSheet` (gemi/top üretimi, miktar).
- D2 Sekmelerdeki kapasite bölümleri (Hangar odası, yer savunması odası; `CapacityBar`).
- D3 Ölüm Yıldızı kartı (`DeathStarForge`) ve önleyici bataryası kartı (`InterceptorBattery`).
- D4 İstihbarat sheet'inin tamamı (E7 + K11).
- D5 Klan sheet'inin tamamı (E9 savaş odası dahil, üyeler, yardım vb.).
- D6 Sohbet sheet'i (A1 ile kendi sayfası).
Sonra F7 (Sen yokken), F8, F9, F10 planlandığı gibi.

Biten: **A1+A2** `7647328` (zil Sinyaller·Kronik; sohbet `ChatHost` kendi sayfası; düğme sağ altta bağlam yuvasının
`corner`'ında — kartın üstünde, seçimde gizli, donuk sezonda sonraki-sezon kartının üstünde) · **A3** `c523823`
(`GalaxyReadout` sağ üstte, Görünüm çipi yuvarlak ikon) · **B** `b2dc8aa` (`gains.repays` ve metni kalktı) · **C** `0a68033`
(`collectState.each/noRoom`; balon ve Üs havuz düğmesi kaynak başına, depo almayan kaynak sarı; "1 rock" çoğul düzeltmesi).
Birleşim: master `15e4dc3` `b118777`'de alındı (movement/clanCombat/transfer-recall çakışmaları iki niyet korunarak çözüldü;
etkilenen sunucu testleri 126/126). Sunucu bilinen kırmızısına eklenen: `notifications.test.ts` "is the list the client
routes" (koloni arızası türleri listede yok — birleşimden önce de kırmızı).

## Sıradaki iş
**ARA İŞ (sahip, 2026-09-24): 13 maddelik geri bildirim listesi F8'den önce.** Liste ve plan: aşağıdaki "Geri bildirim 3"
bölümü. Bittiğinde F8'e dönülür.

### Geri bildirim 3 (sahip, 2026-09-24) — 13 madde, gruplu plan
Durum işaretleri: [ ] bekliyor · [x] bitti (commit).
- **A · Sunucu hatası (8).** Sadakatle nötre düşen koloninin havadaki Kazıcıları: `resolveMiningReturn` ve
  `abandonMiningRun` onları `setUnits(origin)` ile sahipsiz indiriyor → nötr dünyada `PLANET_NOT_OWNED` → işlem geri
  alınıyor → sefer sonsuza dek "dönüyor", kurtarma yolu da aynı hatayla düşüyor (kullanıcıda 6 birikti). Düzeltme:
  çıkış dünyasının komutanı yoksa (ayrılma) sefer, komutanının hâlâ tuttuğu dünyaya (`safeHomePlanet` → başkent)
  iner, cevher oranın works'üne; bildirim komutana. Ele geçirmede Kazıcılar yeni sahibe geçer — mevcut, testli kural,
  dokunulmadı (sahibe soruldu). Canlıdaki takılı seferler `sweepStranded` ile kendiliğinden toplanır. Diğer iniş
  yolları (görev, transfer, yardım, korsan, ticaret, konvoy) sahipliği zaten yeniden doğruluyor. Açık not: korsan
  baskınının (`pirate_arrival/return`) hiç `abandon`/stranded ağı yok (gösterilmiş hata değil). [x]
- **B · HUD ufak (1, 12, 13).** NowLine noktası her zaman nabız; zil rozeti zil ikonuyla birlikte nabız (acil);
  "Dünyana uç" ile "Görünüm" düğmelerinin yeri değişir (ev üstte). [x]
- **C · Galaksi olayı kartı (11).** Kapatılan olay kartı yeniden açılışta dönmesin: kapatılan `event:<id>` anahtarları
  cihazda (localStorage, try/catch) 3 gün saklanır; saldırı ve öneri kartı saklanmaz. [x]
- **D · Üs ekonomisi (4, 5, 6).** Kuyrukta başı dışındaki bekleyen siparişlerde geri sayım yok, sarı kum saati +
  "Sırada"; Works satırı yeniden: dolan bir havuz (dolum çubukları + miktar + "Topla"), büyük sayılarda taşmaz,
  dolunca uyarı; depo çubukları yeniden bölmeli (tırtıklı), korunan bölmeler kalkanlı parantez içinde. [ ]
- **E · İstihbarat (7).** Sonda raporu aralık çubukları: ölçeğin ne olduğu görünür (0 → ölçek, senin değerin çizgisi),
  hizalamanın anlamı okunur. [ ]
- **F · Yıldız arka planları (2, 3).** Üs kahramanındaki gökyüzü daha soluk; Araştırma takımyıldızında arka plan
  yıldızları küçük/sönük, düğüm yıldızları büyük/parlak, araştırılmış ve araştırılmamış düğümler biraz daha parlak. [ ]
- **G · Galaksi sahnesi (9, 10).** Uçan her şeyin dış çizgisi %50 ince, renk parlaklığı %25 az; galaktik konvoyun
  rüzgârı yerine sade hız çizgileri ("rüzgârı delen araç"). [ ]

**F8 · E11 Masaüstü (K10) — yarıda (F8a commit'li).** Şartname: `grep -n "^#### E11 ·\|^| K10" docs/ui-v2/gozlemevi.md`.
Biten (F8a): kırılımlar `v2-split` 700 / `v2-desk` 1100 (`tokens.css`, `lib/media.ts` `DESK_QUERY`); ≥1100 dock üst çubukta
sekme çubuğu (`Dock bar`, 1–5 tuş ipucu), solda 260 px `Outline` (Dünyalar · Havada · Kuyruklar; `lib/outline.ts`,
`OutlineHost`); `--v2-dock-h` 0; ≥700 v2 Sheet `placement`: sayfa sağ sütun (440 / min(720, 50vw), karartma yok, tam boy),
diyalog (yalnız `fit`: eşya, inşa, sen yokken) ortada 32 rem; İstihbarat ve Klan `placement="page"`; eski kit Sheet sağ
sütun; bağlam kartı ve odak paneli ≥700 sağda 320 px; `--v2-top-h` kabuk ölçer. Klavye (`lib/shortcuts.ts`): 1–5 sekme,
Space seçiliyi çerçeveye getirir (`centerSignal` → `Rig`) / seçim yoksa eve uçar, sayfa yokken Esc seçimi bırakır.
1280 ve 1920'de fotoğraflandı.
Kalan: sayfa açıkken galaksi merkezinin görünür alana kayması (seçili dünya sayfanın altında kalabiliyor); raster
görsellerin doğal boyut denetimi (Üs kartları 720 px sütunda); eski kit sayfalarının (menü, sıralama) masaüstü görünümü;
700–1099 aralığının fotoğrafı; Almanca üst çubuk.

**F7 (tamam):** S3 `16cc039` — GET `/api/session/return` hiçbir şey yazmaz, `asOf` döner; POST `/api/session/return/seen`
pencereyi `asOf`'a kadar kapatır (geri gitmez, şimdiyi aşmaz) ve kilit-açmaları o an kaydeder; girişler tür + parametre.
E10 `4263ad5` — `AwayHost` galaksiden sonra ister, 30 dk eşik + en az bir giriş; en fazla 3 satır (tehdit → kazanç → fırsat,
önce her türden biri), her satırda tek kapı; her çıkış onaydır; anlatacak bir şey yoksa hemen kapatır; oyuncu buradayken
pencere 5 dk'da bir şimdiye çekilir (eski 1. hata: oyunun ortasında yeniden yükleme yokluk sayılmaz). 5 dil.
**Not (sunucu):** `/api/session/return` artık yan etkisiz; tam sunucu paketi teslimde koşulacak.

**D (tamam):** D1–D6 ve 2. tur kuralları bitti. Kapanış çubuk taraması `aeb6e67` (sadakat, transfer/ticaret evde kalan
savunma, rapor sahnesi hayatta kalanlar, SurvivorBar, ForceRuler tabanı artık kimin olduğunu söyleyen renkte). Eski kitte
kalan ama D kapsamı dışındaki yüzeyler (sezon arşivi, liderlik, menü, PendingStrip) F10 temizliğine.

Tasarımlar onaylı (sahip: *"Resim dağılımı uygun, D1'den başla"*). Tuval: https://claude.ai/artifact/J4sm7UHkX2bpB8GNJXy9bq
(kaynak betiği: oturum scratchpad `design/gen.py` + `patch2.py`).

**D1 (tamam):**
- `c5fb2a2` `ItemSheet` v2: `fit` sheet; kahraman (duran resim + sonraki seviyenin kazancı), kural "Nasıl çalışır ›" arkasında;
  sonraki 3 seviye kazanç/fiyat/süre ile (ilk basamak kahramanı tekrarlamaz, Çekirdek'te seviye iki kez yazılmaz, etiketi
  farklı basamak etiketini söyler, tavanda durur); "Yeni görünüm · Sv.N"; `NeedBar` (tutulan kaynak renginde, eksik sarı
  taralı); alt bar fiyat + süre + inşaat sırası + "~X sonra yeter" diyen birincil; kapı sarı. Uydu: yörünge soketleri (dolu /
  kesikli hedef / boş / kilitli), yuva kartı ("sonra 0 boş kalır; Komuta Çekirdeği 9 bir yuva daha açar"). `artTier`
  (tavanlıda üçte bir, tavansızda 1–8/9–14/15+). İç içe sheet'te Escape yalnız üsttekini kapatır (`claimEscape`; iki kit).
- `80bcb92` `BuildSheet` v2: kahraman (sınıf çipi, evde·dışarıda — topta "N kurulu", resim, 6 etiketli değer), kural bir
  dokunuş derinde, eşleşme satırı çarpanlarla (`factor`: ×1,6 / ×0,625; zayıf sarı), sınıf döngüsü kendi dokunuşunda,
  v2 stepper "Maks · N" + neyin durdurduğu (kaynak / Hangar / yer / yuva; derste yalnız ders sayısı), `RoomBar`, eksikte
  `NeedBar`, alt bar parti fiyatı + süre + tersane sırası. Akademi 39/39; EN/TR/DE 350 px'te görüldü.

**D2 (tamam) `0f425b9`:** Filo sekmesinde Hangar odası, Savunma'da yer odası `RoomBar` (evde / dışarıda / sırada, lejantlı)
+ bir sonraki Hangar basamağının / Komuta Çekirdeği'nin odayı ne yaptığı ("dönen filo her zaman sığar", "toplar dünyadan
ayrılmaz"); yer odası üç topu adıyla sayar, top resmi yok. `CapacityBar` (Transfer, klan yardımı) gri dolguyu bıraktı.

**D3 (tamam) `f31005a`:** Ölüm Yıldızı ocağı (Taktiksel sekme) ve önleyici bataryası (Savunma) v2 kart: yuvalar
`ChargeTally` (yüklü turkuaz, yüklenen çerçeveli, boş koyu), üretim ilerlemesi canlı saatten (`buildShare`) turkuaz çubuk,
gereksinimler çip (eksik olan sarı kapı → ilgili satır), fiyat + süre, ilk eksiği söyleyen düğme. ÖY iptal edilemez →
basılı tut (K4); şarj dokunuş. **Sapma:** tasarım tuvali önleyiciyi Taktiksel'de çizmişti; Savunma'da kalmasının kararı
(T10/T12) testli olduğu için yeri değişmedi — sahip isterse taşınır. ÖY testleri sahibin açtığı Taktiksel sekmesine taşındı
(`09c0bb5`); bilinen dört kırmızı böylece kapandı.

**D4 (tamam) `b36c55a`:** İstihbarat üç raf (E7): Gözlem (teleskop soketleri + sonraki seviyenin kilitli soketi, işaretli
rakipler slot renginde ve dokununca galakside, "Bildiklerin" tek listesi: canlı okuma netlik çubuklu ve dışarıdaki filoya
süreli "Pencere" çipi, sonda okuması yaş greniyle — K11 mevcut `ageTier`/`AgedThumb`), Raporlar (sonda kartları aralık
satırları senin renginde, filo evdeyken keskin/dışarıdayken açık, "Dosyayı aç"; savaş listesi aynen), Radar (gerçek ölçekli
halka, 24 saat çizgisi — son 6 saat kırmızı —, kayıt). v2 Sheet `fit` içinde. Galeri `?view=intel` dolu hâli çizer.

**D5 (tamam) `d3d1175`:** Klan odası v2 Sheet ve v2 yüzeylerde: `v2/kit/Surface.tsx` eski kitin `Section`, `Plate`, `Button`,
`Chip`, `EmptyState`, `Note`, `Stat`, `PriceTag` prop'larını alır (mantık değişmeden dil değişti), sınıflar v2 jetonlarına
(gri dolgu yok, klan kimliği müttefik mavisi). Üye başlığı tek kimlik kartı; klansızken kompakt kart + 2×2 fayda + tek satır
kuruluş kapısı. Klan yardımı geri çağrılamaz → basılı tut (K4). Savaş odası (E9): hedef + toplanma hattında dalgalar önde,
dalga başına pay çubuğu, klan hangarı çubuk. Galeri `?view=clan|clan-strength|clan-members|clan-aid|wave`.
**Kalan (D5 dışı, not):** Güç sekmesinin iri istatistik kartları ve üyeler listesinin tasarımdaki satır düzeni ince ayar ister.

**D6 (tamam) `98a4af8`:** Sohbet: iki oda v2 anahtarında (sekme adları tam: "Genel — 1 okunmamış"), dil seçici satır
sonunda küçük; mesajlar balon (baş harfler, kendi mesajın sağda senin renginde / klanda müttefik renginde, yönetici sessiz
altın halka — artık `premium`), hap şeklinde yazma alanı + yuvarlak gönder.

**Sahibin tasarım turu 2 kuralları (2026-09-24) — D kodlanırken uygulanacak:**
- Şarjlı şeyler (Ölüm Yıldızı, önleyici) şarjı `Tally` tarzı hücrelerle gösterir (yüklü turkuaz, yüklenen çerçeveli, boş koyu).
- Bina/alet resimleri seviyelere yayılır (bugün `tierOf`: 1–2 / 3–4 / 5+ — 5'ten sonra hiç değişmiyor). Öneri (sahibe
  soruldu): tavanı olan merdivende 3 resim tavana eşit bölünür (`ceil(level×3/max)`: Hangar 10 → 1–3 / 4–6 / 7–10,
  Teleskop/Radar 8 → 1–2 / 3–5 / 6–8), tavansızda sahibin örneği 1–8 / 9–14 / 15+; tek resimli (Döteryum Tesisi) sabit.
- Yer odasında belirli bir topun resmi yok (ileride hangar gibi bir resim gelebilir).
- Beyaz/gri ilerleme çubukları kafa karıştırıyor: site genelinde anlamlı renklere (senin rengin üç tonda: evde / dışarıda /
  sırada; lejant aynı) — D işlerinde taranıp değiştirilecek (ör. sadakat `bg-v2-ink/50`, istihbarat aralık çubukları).
- **Sheet'ler içerik kadar açılır**; içerik sığmazsa tam açılır ve kayar (v2 `Sheet`'e içerik boyu "fit" yüksekliği).
  Sohbet gibi sayfa olanlar tam kalır.

**F6 · E7 İstihbarat (K11 yaş dili) + E9 Klan savaş odası + Komutan sayfası.** Şartname:
`grep -n "^#### E7 ·\|^#### E9 ·\|^| K11\|Komutan sayfası" docs/ui-v2/gozlemevi.md`; mock `design-mocks/image copy 6.png` sağ
(İstihbarat: gözlem defteri) ve `image copy 7.png` orta (Klan savaş odası). Kod: İstihbarat sayfası (`screens/Intel*`), telescope
rafı, `lib/dossier.ts`, `screens/ClanWarPanel.tsx`, Komutan sayfası (`v2/shell/CommanderHost.tsx`, menü). Açık not F6'ya:
`clanWar.noTarget` 5 dilde var olmayan "Galaxy Focus" denetimini anıyor.

**F5 (tamam) · E5 Üs + Araştırma segmenti (K6) + takımyıldız (K9).** Şartname: `grep -n "^#### E5 ·\|^| K6\|^| K9" docs/ui-v2/gozlemevi.md`;
mock `design-mocks/image copy 6.png` sol (Üs) ve `image copy 7.png` sol (Araştırma takımyıldızı). Kod: `screens/PlanetScreen.tsx`
(Üs; `PlanetHero`, cüzdan, kuyruklar, sekmeler, `UpgradeRow` kartları, `Band`), `screens/ResearchPanel.tsx`.

F5'te biten: K6 anahtarı `5b80f0b`; kahraman (dünya ortada) `e23530b`; kuyruklar halka + iptal sayfası `54cf5be`; Büyüme
sekmesi iki sütun kart `1196c56`; takımyıldız + kart `71d3277`; **liste kalktı** `dd44743` (yıldız → kart; kart basamak,
tavan, tutulan önkoşul, `hullDoor` ile açtığı gemiler, tek yerde söylenen ret — düzeltilebilen kapı sarı düğme, önkoşulda
yıldızı seçer; stratejik üçlü bayrak kapalıyken haritada kapalı, sunucu da reddediyor; hat `QueueLane`, hücre projeyi seçer).
Testte bayrak getter'lı `vi.mock` ile çevriliyor (stratejik kapıların testleri bayrak açıkken koşar).

**F5 E5 işleri (hepsi gerçek oyunda 350 px'te görüldü):**
1. ~~Üretim satırı~~ `92dc01d`: kahramanın altında kaynak başına `+oran /sa`, depo çubuğu (Kasa dilimi D190 çerçevesi ve
   kalkanıyla), "depo %62 · güvenli %35", dolunca sarı "depo dolu". Ateş gücü, savunma, kalkan, açıktaki miktar ve filo
   `DefenceReadings` olarak Savunma sekmesinin başında (hiçbir bilgi düşmedi). `PlanetHero`'nun ulaşılmaz tam ekran dalı ve
   `PlanetScreen` `embedded` prop'u silindi.
2. ~~Uydu yuvaları~~ `c5352f0`: kahramanın yörüngesinde 4 sabit yuva (dolu = uydu, boş = kesikli halka, kilitli = kilit +
   açılacağı Çekirdek, eşikler `satelliteSlots`'tan), altında "Yörünge 1/2 · Çekirdek 12'de +1"; sekmelerin üstündeki
   D108 rafı (`OrbitContext`, `ORBIT_UNLOCKS` kopyası) kalktı. Toplama balonu bilerek cüzdanda (yapışkan, her sekmeden).
3. ~~Koloni arızaları en üstte~~ `92dc01d` (sadakat satırının hemen üstünde, sarı çerçeve).
4. ~~EscapeReadout sarı~~ `92dc01d`.
5. ~~Diğer sekmeler iki sütun kart~~ `c917c46` (gövde kartında kademe + ev/dış adın altında, D195c). **Kalan:** paylaşılan
   `Band` başlığı hâlâ eski görünüm; `DecisionGroup` yalnız Üretim'de `bare`.
6. ~~Ölü sınıflar~~ `92dc01d`: `surface-vocabulary` yeşil (bilinen kırmızılardan çıktı).

Sahip isteği (2026-09-24, sonra) `5dcb54a`: dock hiçbir sayfa açık değilken tamamen saydam (gradyan ve çizgi yok, etikette
gölge), sayfa açılınca gradyan. `b9fea67`: `StarField` (tohumlu durağan gökyüzü) **yalnız** gezegen bölümünde ve
takımyıldız kutusunda — tüm sayfada değil (sahip açıkça istemedi); haritada her dairenin içinde yıldız (seviye 0 soluk
beyaz, seviye arttıkça turkuaz ve parlak). Gökyüzü renkleri `--color-v2-sky-*` token'ı; Tailwind v4 bir değişkeni
yalnız kaynakta adı tam geçiyorsa yayımlıyor — parçadan kurulan ad tarayıcıya boş gider.

**Ders:** v2 ham renk koruması (`test/v2/tokens.test.ts`) `ReportScene`'den (F4) beri kırmızıydı, fark edilmedi. Her
commit öncesi `npx vitest run test/v2` klasörün tamamı koşulur.

**F5 kapanışı:** `61ff6dd` bant başlığı v2 ve tüm sekmeler çıplak (sekme adını tekrar eden başlık yalnız ekran okuyucuya);
faz incelemesi `53c2498` (Üs'teki araştırma kapısı projeyi söyler, harita o yıldızda açılır; `isResearchProject`),
`642b16c` (de/es kuyruk başlığı "kuyruk oluştur" diyordu, de "keine Sicherheit", es Aegis'i çevirmiş; yüzdede bölünmez boşluk;
yer bandı etiketi iki kez). Akademi turu 39/39 (araç artık menünün kuyruğa süzülmesinin oturmasını bekliyor — kart ızgarası
yolu uzattı). Tam web paketi: 13 kırmızı, hepsi bilinen (`surface-vocabulary` kapandı). 350 px'te tr/de/fr görüldü.

**F4 (tamam) · E6 Savaş raporu (B15) + S4.** `35d7bf6` S4: `readBattleReports` saldırana `fuelPaid` (dünya baskını
`missions.fuel_paid`, ortak savaşta kendi dalgalarının toplamı; savunana, korsana ve kolon öncesi 0'a null); web şeması
isteğe bağlı okur. `d52bc68` B15: `v2/hud/ReportScene` rapor sayfasının tepesinde (görsel, üst satır, ganimet şeridi +
"ambar doldu", iki taraf — kendin gönderilen→kalan, karşı taraf saldırana yalnız yok edilenler + "kalanlar gizli" (kural 15),
savunana saldıran filonun tamamı —, sınıf döngüsünden tek cümle "neden" (`lib/reportScene`), bilanço ganimet·yakıt·kayıp,
kolonide sadakat kuralı, galaksiden açılınca "Yeniden saldır" → hedefin açık dosyası). `aad6e0d` çatışmasız savaşta tur
sayısı yazılmaz. Gerçek oyunda dev baskınla doğrulandı (yakıt −4). Açık notlar: tekrar oynatma ve klana paylaşma
özellikleri yok (şartname "varsa"; paylaşma yeni sunucu işi — sahibe sorulacak); korsan baskını yakıt saklamıyor (göç
gerekir); eski "Ne oldu" kutusu sahneyle kısmen tekrarlıyor (testleri sahneye taşınarak F10'da birleşecek); savunanın
kendi kolonisi için sadakat satırı yok (rapor savaş anındaki dünya türünü tutmuyor).

**F4 (eski plan) · E6 Savaş raporu (B15) + S4 ödenen yakıt.** Şartname: `grep -n "^#### B15 ·\|^#### E6 ·\|^| S4" docs/ui-v2/gozlemevi.md`;
mock `design-mocks/image copy 6.png` orta ("KISMİ ZAFER"). Kod: `screens/BattleReports*`/rapor sayfası (bugünkü görünüm),
sunucu `services/reports.ts` `viewOf` (S4: `missions.fuel_paid` kalkışta yazılıyor → rapora dön), rapor şeması
(`api/schemas.ts`). Kural 15 (saldırgana karşı tarafın kalanları asla), taktik geri çekilme metinleri (`BattleReports`).
F3 kapanışı: web paketi 14 bilinen kırmızı (büyümedi), web lint/tsc temiz, Akademi tarayıcıda 39/39, galeri 5 dilde
(araç artık her görünümü taze sayfada çekiyor). Sunucu tam paketi teslimde koşulacak (sahip talimatı).

**F3 (tamam) · Hedef dosyası, Fırlatma, Filo; S1, S2.** Şartname: B10, B11, B14, E2, E3, E4, K8 ve sunucu tablosu S1/S2
(`grep -n "^#### B10 ·\|^#### B11 ·\|^#### B14 ·\|^#### E2 ·\|^#### E3 ·\|^#### E4 ·\|^| K8\|^| S1\|^| S2" docs/ui-v2/gozlemevi.md`).
Kod: `screens/LaunchSheet.tsx` (bugünkü fırlatma, ~1.300 satır; mantığı yeniden kullanılır), `shell/PendingStrip.tsx`
(`FlightList`, `useAirborne`; F2'de Filo sayfası bunu çiziyor), `v2/hud/FleetSheet.tsx` (ara sayfa), galaksinin odak
kartları (`screens/GalaxyView.tsx` odak rayı), sunucu `services/movement.ts` (`recallTransfer`), `services/session.ts`
(`recallable`, pending projeksiyonu), `routes/planet.ts` (saldırı rotası "IRREVERSIBLE"), `api/client.ts`.
Master F3 başında kontrol edildi: branch noktasından (a64b230) beri değişmemiş.
- ~~F3.0~~ Taban çizgisi yeniden ölçülmedi (sahip: "bilinen hatalar", yeniden ölçme); ilgili dosyalarda görülen
  kırmızılar HEAD'de de kırmızı olduğu doğrulanarak aşağıya yazıldı.
- ~~F3.1 S1~~ `1b5bd95`: kendi uçuşlarında `pace` (`missions.pace`); dönüş bacağı 1; gelen saldırıda yok. Web şeması
  okur (0 < pace ≤ 1).
- ~~F3.2 S2 (K8)~~ `c29a1c2`: `recallFlight` (eski `recallTransfer`) saldırıyı da çevirir; geri çağrılan baskın dönüş
  bacağı gibi iner (rapor, ganimet yok), `attack_commitments` satırı silinir; `isHostileMission` çevrilmiş baskını
  düşmanca saymaz (gelen uyarı, radar bildirimi, trafik inbound); RAID ödülü, toparlanma kalkanı, klan üyelik
  kontrolü, Teleskop "dışarıda" saati uyar. Fırlatma sayfası dünya baskınında "Launch" + kural notu, korsan baskınında
  "no recall", Akademi'de not yok; dönüş bildirimi "called back before it struck". Gerçek oyunda görüldü (onay, Filo
  sayfasında düğme, çevrildikten sonra "home from …"). Yeni sunucu testi `attack-recall.test.ts` (16).
- ~~F3.3 E4 Filo sayfası~~ `bb725cf`: `v2/hud/FleetPage.tsx` (sunum) + `v2/shell/FleetHost.tsx` (veri) + `lib/fleetPage.ts`
  (`legProgress`, `recallPreview`, `paceShown`, `garrisonOf`, `roomOf`). Başlıkta aktif dünyanın uçuş yuvası ve Hangar'ı;
  Havada = `useAirborne` satırları (geri sayım, bacak dolgusu — dönüşte sağdan —, hız, varış saati, geri çağırma
  sütununda "back in X"); Evde = dünya başına garnizon (sınıf şekilli çipler, dışarıdaki sayısı); Hangar = dünya başına
  Hangar ve zemin, doluysa sarı, üstte tek cümlelik kural. `FleetSheet` ve testi silindi. Galeride `?view=fleet`,
  `fleet-home`, `fleet-room`. Gerçek oyunda baskın + geri çağırma ile görüldü.
- ~~F3.4a~~ `7c55044`: `LaunchSheet` mantığı birebir `lib/useLaunchPlan.ts`'e taşındı (rota, hız, yakıt, okuma, tahmin,
  kaçış, notlar, ders sınırı, `refusal`, `commit`, `classReading`); sayfa yalnız çizer.
- ~~F3.4b~~ `1859f29`: saldırı + korsan v2 anatomisinde (`screens/LaunchSheet.tsx`, aynı dışa aktarım): yapışkan
  `ForceRuler` (+ `MatchupLine`, yakıt çubuğu içinde — D183), aileye göre gemi satırları (sınıf şekli, istatistik,
  `QuantityStepper`), `PaceRow` (B10; v2 renklerine geçti, transfer/klan da etkilendi, iki ölü sınıf kalktı), bilgi
  ızgarası (`data-launch-figures`: tek yön + iniş saati, açıkta, kargo, boş yuva, mesafe), alt bölümde ücret satırı
  (`data-launch-warning`; dünya/korsan ayrı, K8 doğru), kalkan uyarısı, geri çağırma notu + fleetsave, `HoldButton`
  (`data-launch-commit`; iki adımlı onay kalktı). Akademi eli `[data-launch-commit] button:not(:disabled)`;
  `tools/academy-visual.mjs` basılı tutuyor; 39 ders tarayıcıda geçti. Eski onayın "This cannot be recalled" metni
  dünya baskınında K8'e aykırıydı → düzeldi; korsan dersi artık "korsan baskını geri çağrılamaz" diyor.
- F3.4c ilerleme: ~~transfer~~ `f8e0f83` (v2 Sheet/renk, B14 sırası, `HoldButton` + ret nedenleri: filo yok, varış
  Hangar'ı dolu, ambar aşımı, yakıt yok); ~~yerleşim~~ `8bdc902` (basılı tut; tek dokunuş artık kuruluş bedelini
  harcamıyor). Aynı commit: galeriye sorgu/API sağlayıcıları (fetch hiç yanıt vermez) + `?view=launch`,
  `launch-pirate`, `transfer`, `settlement` (hesap açmadan 5 dilde çekim); gemi satırında etiketli istatistik şeridi
  Almancada üst üste biniyor/kesiliyordu → satırda ikon+değer, listenin üstünde tek `StatLegend` (D142 korunur);
  Almanca "Startseite"/"Einbahnstraße" yanlış çevirileri düzeldi.
- F3.4c ~~konvoy~~ (v2 + basılı tut, satırlar B14 satırı; geri bildirimle birlikte) · ~~ticaret~~ `d9d6a98` (v2 Sheet,
  iki adımlı onay yerine basılı tut, "geri çağrılamaz" + dışarıda kalma süresi düğmeden önce, taşıyıcı satırları B14,
  "Veriyorum" seçici v2 anahtar; `trade.back/commit` silindi) · ~~klan dalgası~~ `786e851` (teklif kendiliğinden,
  350 ms yerleşince; "Hesapla" düğmesi yok; stepper satırları; basılı tut, sebep düğmede; "saldırı başlayana kadar geri
  çağrılabilir" kuralı düğmeden önce — sunucunun `canRecall`'u; "Send — no recall" metni klan YARDIMININ, doğru) ·
  ~~Ölüm Yıldızı~~ `d457469` (raydaki basış v2 yarım sayfa açar, bedeli yazar, "EMP'yi fırlat" basılı tut; portal
  ile body'ye; "Hold fire" kalktı; yıkım `Confirm`'de kalır). Galeride `trade`, `wave`, `strike` görünümleri.
- F3.4 açık notlar: `QuantityStepper`'ın `look="v2"` görünümü fırlatma/transfer/konvoyda; Üs, ticaret ve klan
  çağıranları eski görünümde (F5 ve kendi işlerinde geçer);
  yapışkan cetvel uzun listede satırların üstünü örtüyor (tasarım gereği; masaüstünde F8'de iki sütun).
- **F3.5 E2 hedef dosyası** (mock: `design-mocks/image copy 5.png` sol, bağlam kartı `image.png`). Bugün yabancı dünya
  `galaxy/FocusPanel.tsx` `PlanetFocus` (eski kit `Shell` rayı) ile açılıyor; `lib/dossier.ts` (olgu/boşluk, kaynak+yaş)
  zaten saf. Parçalar:
  - **F3.5a** `useLaunchPlan`'deki hedef okumasını (`report`, `opposing`, `forecastInput`, `lines`, `matchups`, `hint`,
    `loss`, `escape`, `notes`) `lib/useTargetReading.ts`'e birebir taşı (fırlatma testleri korur); dosya aynı hook'u
    evdeki savaş kanadıyla çağırır.
  - **F3.5b** `lib/lootEstimate.ts` (saf, test): probe `stock` bandı ZATEN `computeLoot × vaultProtects` (kesin zafer,
    sınırsız ambar; `services/intel.ts`), `deuteriumStock` onun döteryum payı. Tahmin = bant ↔ evdeki kargo; kısmi
    zafer `COMBAT.lootPartial/lootDecisive` oranı; kargo bandın altındaysa sarı "büyük kısmı geride kalır".
  - **F3.5c** `v2/hud/TargetDossier.tsx` (sunum): başlık çipleri (rakip işareti, mesafe, uçuş), kaynak+yaş satırı
    (`Freshness`), Güç (`ForceRuler`, kanat = evdeki savaş gemileri), Okunan dağılım (yüzde yalnız SHARES) +
    `MatchupLine`, yer savunması (biliniyorsa), Ganimet, Koloni kuralı (yalnız COLONY; değer yok), Geçmiş
    (`RivalHistory`); olgu/boşluk satırları v2'de.
  - **F3.5d** `Shell` → v2 çerçeve: kapalı = bağlam kartı (başlık + tek güç satırı + Sonda/Saldırı planla, mock),
    açık = yarım/tam dosya; eylemler ve ret nedenleri (bant, tekrar sınırı, kalkan süresi, köken toparlanıyor, tersane
    isyanı) korunur; yerleşim/klan hedefi/Ölüm Yıldızı kontrolleri kaybolmaz. Diğer odak türleri aynı çerçeveyi alır.
  - Durum: ~~F3.5a~~ `727e8e3` (`useTargetReading`) · ~~F3.5b~~ `1de64fd` (`lootEstimate`) · ~~F3.5c~~ `8e19f7d`
    (`v2/hud/TargetDossier`: çipler, okuma kaynağı+yaş — sonda yoksa "henüz sonda gitmedi", evdeki kanatla `ForceRuler`
    + `MatchupLine`, ganimet bandı ↔ ambar, koloni kuralı `FAULT.battleLoyaltyLoss` + `services/loyalty.ts` kopuş kuralı;
    `ForceRuler.yoursLabel`) · ~~F3.5d~~ `0ad18c4` (kapalı = içeriden kart, açık = üstü yuvarlak dosya; düğmeler v2, ekran
    başına tek birincil `data-primary`; iç renkler v2 eşlemesiyle; K2: son dakika/karşılanmamış/ret = sarı, kırmızı yalnız
    tehdit) + `43d37e5` (kapalı kartta mock'un güç satırı + Sonda/Saldır). Akademi tarayıcıda 39/39.
  - Kalan küçük farklar: dosya başlığı hâlâ eski `Headline`/`WorldKind` metinleri (v2 renkte); `Band` (UpgradeRow,
    paylaşılan) F5'te Üs'le v2'ye; toplama balonu yakın ölçekte gezegenin üstüne biniyor (mock sağ üstte).
- **F3.6** faz sonu review + gerçek oyunda görsel tur (350 ve 1280 px, 5 dil).

## Biten işler
- Adım 0 (2026-09-23): worktree `ui-v2` @ a64b230; şartname kopyası; fleet escape (a64b230) şartnameye
  işlendi (kural 16/16b, B5, B15, E5); karar defteri "onaylandı"; 16 gezegen `.glb` dala eklendi.
  Sonra sahip kararıyla şartname yalnız Markdown'a geçti; HTML, betikler ve artifact bırakıldı; ikonlar `icons.svg`'ye,
  token listesi şartnameye taşındı.
- F0 (2026-09-23): **H1** `074f338` — kalkan varken "yer savunması yok", "açıktaki stok" ve "tarama" yönergeleri
  `growth`; yer savunması kartı kalkanın bitişini söyler; `inbound` tehdit kalır (`Situation.shieldUntil/now`,
  `SituationGuide` saati geçirir, `GalaxyView` `season.data.shieldUntil` verir; 5 dilde `undefendedShieldedTitle`).
  **H2** `a7b8348` — "Depo dolu" etiketi `text-threat` yerine `text-alloy`. İkisi de canlı sezon için master'a
  cherry-pick edilebilir (sahibe hash'ler verildi). Web: bilinen 14 kırmızı aynen, +7 yeni test yeşil.
- F1.1 (2026-09-23): `apps/web/src/v2/tokens.css` — `@theme` içinde `v2-` önekli renkler (şartname değerleri),
  5 rakip slotu, `font-v2-ui` / `font-v2-mono`, `ease-v2`; `styles.css` içe aktarıyor. Kullanım: Tailwind
  sınıfları (`bg-v2-panel`, `text-v2-ink-2`, `bg-v2-self/15`); CSS'te `var(--color-v2-*)` + `color-mix()`.
  Kanal (`--ch-*`) deseni v2'de yok: opaklık Tailwind değiştiricisiyle. Koruyucu: `test/v2/tokens.test.ts`
  (değerler, çakışmasızlık, kontrast, `src/v2` altında ham renk yasağı). `surface-vocabulary.test.ts` artık
  v2 token'larını da okuyor. Tailwind kullanılmayan tema değişkenlerini derlemeye koymuyor; bileşenler
  kullanınca çıkar (F1.4'te kontrol et).
- F1.2 (2026-09-23): `@fontsource-variable/archivo` eklendi (`standard.css`: wght 100–900 + wdth 62–125,
  latin-ext dahil); IBM Plex Mono 400/500 artık gerçekten içe aktarılıyor (bugünkü tema adı kullanıyordu ama
  hiç yüklemiyordu → sistem yazı tipine düşüyordu). Genişlik: Tailwind `font-stretch-75%` / `font-stretch-125%`.
  Koruyucu: `test/v2/fonts.test.ts` (içe aktarım + aile adı paketin tanımladığıyla aynı).
- F1.3 (2026-09-23): `apps/web/src/v2/icons.tsx` — tek `Icon` bileşeni, `id` ile seçilir (`i-*` çizgi 1.75,
  `c-*` dolgu amblem, `m-*`/`sel` işaret 1.6); `isIconId` tip koruyucusu. 40 şekil `docs/ui-v2/icons.svg` ile
  birebir (test şekil şekil karşılaştırıyor: `test/v2/icons.test.tsx`). Başlıksız ikon `aria-hidden`.
- F1.4 · B9 (2026-09-23): `apps/web/src/v2/kit/HoldButton.tsx` — `HOLD_MS = 600`; basma butonun kendi
  `pointerdown`'ında başlar (orta/sağ tuş hariç; jsdom'da `button` tanımsız geldiği için `=== 0` değil),
  bırakınca/dışarı kayınca/blur'da iptal; Space basılı tutulur; Enter satır içi iki adımlı onay (4 sn);
  onay tıklaması `useOwnPress` ile; `disabledReason` varsa etiket yerine sebep, silahsız. `tone`: `self` | `hostile`.
  Metinler yeni ad alanı `hold` (`locales/*/v2.ts`, dizinlere kayıtlı) — v2 kit metinleri bu dosyalara eklenir.
  Tailwind v2 sınıflarını derliyor (build'de `--color-v2-self` ve `bg-v2-self/10` görüldü).
- F1.4 · B8 `d6c7894`: `apps/web/src/v2/kit/ClassEmblem.tsx` — SKIRMISHER `c-sk` ▲, BULWARK `c-bw` ⬢, LANCE `c-ln` ◆,
  SUPPORT `c-sp` ●; `classEmblemId(cls)`; başlık `combatClassLabel` (i18n/names.ts); `decorative` yazılı adın
  yanında sessiz. Renk yok: rengi kimin gemisi olduğu verir.
- F1.4 · B7: `apps/web/src/lib/clarity.ts` — `CLARITY_BARS` (FULL 5 … BLIND 1), `CLARITY_WORD` (i18n anahtarları),
  `ageTier(dk)` → `fresh` <60 · `aging` <360 · `stale` <1440 · `old` (K11). Eski `ui/Clarity.tsx` artık bunları içe
  aktarıyor (F10'da eski silinince v2 kırılmasın). `apps/web/src/v2/kit/Freshness.tsx` — `ClarityMark` (5 çubuk +
  kelime, tek `role="img"`), `AgeStamp` (`staleness()`, `data-age`), `AgedThumb` (yuvarlak resim; netlik →
  `brightness-*`, yaş → `.v2-grain` + `old`'da soluk; BLIND → kesikli çerçeve + "?", resim yok, `alt` etiket olur).
  Gren `src/v2/surfaces.css` (styles.css içe aktarıyor; SVG gürültü, `data-age` ile şiddet). **F10 notu:** yanan
  çubuklar eski `bg-clarity-*` token'larını kullanıyor (parlaklık rampası); F10 bunları silmemeli, v2'ye taşımalı.
- F1.4 · B12 halkaları: `lib/orders.ts` `orderProgress(order, now)` (yalnız baş koşar; başlamamış/zamansız 0, biten 1).
  `apps/web/src/v2/kit/QueueLane.tsx` — `BUILD.queueDepth` (3) hücre: sipariş = konik halka (`data-ring`,
  `data-progress`) + içinde render + ad + `×N` (yalnız >1) + bitişe kalan (`countdown`); zamansız sipariş
  `planet.queue.committing` / `staged`; boş yer "+ Boş hat" (`lane.free`, 5 dil). Hücre `onOpen` çağırır; iptal
  işareti yok (yarısı yanar, kuyruk sayfasında). Not: sunucu bina/alet/uydu siparişinde `count: 1` yazar; `count`
  yalnız gövdede anlamlı (`lib/orders.ts` yorumu "seviye taşır" diyor, eskimiş).
- F1.4 · kaynak ölçeri (B1): `lib/format.ts` `stock(v)` — 99.999'a kadar `full`, üstü `compact` (şartname; eski
  `Stock` hep `full` yazıyordu, 3 ölçer 350 px'e sığsın diye). `apps/web/src/v2/kit/ResourceMeter.tsx` — 16 px ikon +
  değer + 2 px çizgi (kaynak rengi, `data-fill`), dolu/taşmışta ucunda `bg-v2-warn` çentik (`data-full`), kırmızı yok;
  `onOpen` varsa buton, yoksa `role="img"`; ad `meter.reading` / `meter.full` (5 dil), kaynak adı `statusBar.*Label`.
  Vault güvenli dilimi (`vaultProtected`) üst çubukta yok; şartnameye göre E5 üretim satırında.
- F1.4 · B5 güç cetveli: `lib/ruler.ts` — `ForceReading`/`ForceLines` tipleri buraya taşındı (eski `ForceCompare`
  yeniden dışa aktarıyor, `LaunchSheet` değişmedi) ve `rulerTop(...)` = en büyük × 1,15, iki anlamlı basamağa yukarı.
  `apps/web/src/v2/kit/ForceRuler.tsx` — eski `ForceCompare` ile aynı proplar (+ `onProbe`): kanat şeridi (`bg-v2-self`),
  savunma şeridi (tabana kadar dolu `bg-v2-ink-3`, bant `.v2-hatch`), şeritte `clears` (turkuaz kenar) / `breaks`
  (açık kenar) aralık işaretleri ve `escape-line` (sarı kesikli); açıklama listesi mevcut `counter.escapeAt`,
  `linesClears`, `linesBreaks`; hüküm `counter.escape{Run,Stand,Unsure}`; kayıp, notlar, "Bu ne?" kuralı (+ kaçış
  kuralı). Bakılmamışsa şerit yok: `ruler.unknown` + `ruler.probe` butonu (5 dil). `.v2-hatch` `surfaces.css`'te.
  **Sapma (şartnameye uygun):** eski bileşen, okuma varken çizgileri eksene katmayıp kırpıyordu; şartname
  `breaks` üstünü eksene katıyor, v2 öyle yapıyor. `children` B6 satırı için.
- F1.4 · B6 karşı sınıf satırı: `lib/matchup.ts` `matchupHint(m)` → BRING cls / SINGLE / PROBE / null (LaunchSheet'teki
  mantık buraya taşındı, `LaunchSheet` artık bunu çağırıyor). `apps/web/src/v2/kit/MatchupLine.tsx` — props
  `wing`, `reading` (`ClassReading`); `matchupsAgainst` içeride. Satır 1 (`data-matchup-wall`): MAJORITY "◆ Mostly
  Lance — more than half", SPLIT "Read split · ◆ Lance 60% · …" (sıfır pay yok), MIXED "Mixed defence…"; sonra ipucu
  (Bring = `text-v2-self` amblemli, Single/Probe = `text-v2-warn`), sonra kalan okunmadı. UNREAD: `counter.noteShapeUnread`
  · `dossier.shapeUnreadNote`. NONE / okuma yok: hiçbir şey. Satır 2 (`data-matchup-wing`): kanadın her sınıfı için
  `matchupExposure`. Yeni metin yok, hepsi mevcut anahtarlar.
- F1.4 · v2 Sheet: `lib/sheet.ts` — `Detent` = `peek` | `half` | `full`, `nextDetent(detents, cur, 'up'|'down')` (yukarı
  tepede durur, en alttan aşağı `null` = kapan), `dragStep(dy)` (±40 px eşik). `apps/web/src/v2/kit/Sheet.tsx` —
  `detents` (varsayılan half+full; bağlam kartı `['peek','half','full']`), yükseklik peek `max-h-[140px]` / half
  `55dvh` / full `92dvh`; tutamaç butonu (`handle.expand` / tepede `handle.collapse`, 5 dil) dokununca bir basamak;
  baş bölgesinden sürükleme (bırakma `window`'da dinlenir, sürüklemeden sonraki tıklama yutulur); peek'te perde yok
  ve `aria-modal=false` (galaksi canlı), half/full'de `data-scrim` (`useOwnPress`); Escape, X, `onBack`; `children`
  fonksiyon olabilir (detent'i alır: kart → dosya). `bottom: var(--v2-dock-h, 0px)` — F2'de kabuk dock yüksekliğini
  bu değişkene yazacak. Masaüstünde `max-w-xl` ortalı. Build'de yeni sınıfların hepsi derlendi (kontrol edildi).
- F1.4 · B12 kuyruk sayfası: `apps/web/src/v2/kit/QueueSheet.tsx` — v2 Sheet içinde iki hat (İnşaat, Tersane),
  her siparişte halka + ad + kalan + "İptal"; hat başında "ends HH:MM"; boş hat `planet.queue.idle`. İptal →
  `CancelConfirm` (artık `ui/QueueStrip.tsx`'ten dışa aktarılıyor; eski `Confirm`/eski `Sheet` üstünde — **F10:**
  v2 Confirm gerekince buradan taşınır). Confirm açıkken Escape yalnız Confirm'ü kapatır. Zamansız siparişte iptal
  yok; bir iptal uçuştayken hepsi kilitli. `QueueLane.tsx` artık `OrderRing`, `OrderName`, `orderLeft` dışa aktarıyor.
- **F1 bitti (2026-09-23).** Workspace `typecheck` + `lint` temiz; web: bilinen 14 kırmızı aynen, v2 testleri yeşil.
- **F1 faz sonu review'u (2026-09-23)** — eski koda dokunulan yerler temiz (`directives()`'in tek çağıranı
  `SituationGuide`; `LaunchSheet` ipucu birebir; Plex Mono eski arayüzde yalnız duyuru kod bloklarında). Bulunan ve
  testle düzeltilen: (1) B6 — eşit en büyük paylı SHARES okuması "karışık" diye bölüşümü düşürüyordu (artık tür
  karar veriyor); (2) Sheet — başlıktan sürüklemeden sonra tutamaç dokunuşu yutuluyordu (her hareket temiz başlar)
  ve klavye Enter'ı da yutulabiliyordu (`detail 0` asla yutulmaz); (3) `AgeStamp` dil değişimine abone değildi;
  (4) kuyruk sayfası uçuştaki iptalin satırında "Cancelling…" yazıyor.

- **F2 · v2 HUD, kabuk, bilgi mimarisi (2026-09-23).** Saf mantık `98a09fa` (`lib/{nowLine,collect,dock,contextSlot,
  bell,flights,shellRoute,useRequest}.ts`); sunum `73b9d6c`, `8012378`, `1efb94d`, `bc84a4c`, `7c23d3d` (`v2/hud/{Dock,NowLine,
  TopBar,CollectBubble,BellSheet,FleetSheet,ViewSheet,ContextSlot}.tsx`, `v2/kit/Segmented.tsx`, galeri); kabuk `4383861`,
  `2bc2867`, `a94ee0d` (`v2/shell/{GameShell,HudTop,HudDock,BellHost,CollectHost}.tsx`; `App` bunu çiziyor); bağlam yuvası
  ve toplama balonu `d4f45fd`, `ee732ac`. GalaxyView'den `DiscControls`, `SensorToggles`, `DiscReadout`, sohbet/kronik
  başlatıcıları, `SituationGuide`, `DirectiveCard`, `ActiveGalaxyEvent` testleriyle silindi; davranışları v2
  testlerinde. Toplama balonu drei `<Html>` içinde değil: sahne bir çapa öğesi verir, galaksi `createPortal` ile
  çizer (`<Html>` kendi React köküdür, sağlayıcıları kaybeder).
- **F2.5–F2.6 düzeltmeleri:** Akademi Teleskop dersi Görünüm çipinden ulaşılır `a227cc0`; dock'ta Galaksi'ye tekrar
  basmak disk Home'u gibi (odağı temizler, aktif dünyayı odaklar, bir dokunuş yönetimi açar; D163) `2480843`; Akademi
  baskın dersi "iki Dart" diyordu, ders ve Max dört gönderiyor — metin sayı söylemiyor, `tools/academy-visual.mjs` Max'e
  basıyor `b4f5ea8` (**canlı sezon için master'a cherry-pick adayı**); `tools/visual.mjs` dock ve yuvaya göre
  `a1a561b`, `ec91890`. **F2.6 kararı:** Akademi kendi kabuğunda kalır (şartname: "Onboarding bu işin kapsamı dışında;
  yalnız token'ları alır", E1 "Lesson modu: bugünkü kısıtlar korunur"); `Rehearsal.tsx` fiilen ölü → F10.
- **F2 faz sonu review'u (2026-09-23)** `b2b3f7a`, `d776697`, `ce77854`, `660d1cb` — bulunan ve testle düzeltilen:
  (1) bağlam yuvası kapatılan kartları kendi tutuyordu ama her sayfa açılışında sökülüyor → Üs'e gidip gelince hepsi
  geri geliyordu; kayıt artık GalaxyView'de; (2) olay kartı olay kümesiyle hatırlanıyordu → biri bitince kapatılmış
  diğeri geri geliyordu; artık olay başına; (3) Now hattının zamanlayıcı sayfası kendi durumuydu, sayfalarla aynı
  katmanda: dock'a basınca Üs üstüne açılıyor, Üs kapanınca altta kalan sayfa beliriyordu; kabuk tutuyor, her
  gezintide kapatıyor; (4) üst çubuk `h-12` + çentik dolgusu çentikli telefonda satırı ~1 px bırakıyordu
  (`viewport-fit=cover`); (5) Almanca "Galaxy-Ereignis", "Galaxy Chronicle" (Sie ile) ve de/es sayım ayırıcılarında
  eksik boşluk ("134 Welten· 1 Pirat"). Gerçek oyunda 350 px'te 5 dil ve 1280 px görüldü. Tam web paketi: bilinen 14
  kırmızı aynen.

## Şartnameden sapmalar ve eklemeler
- **Fleet escape (a64b230, şartnameden sonra geldi):** güç cetvelinde üçüncü "kaçar" çizgisi
  (`escapeLine`), `escapeVerdict` hükmü, Savunma sekmesinde `EscapeReadout`, raporda kaçış metinleri.
- **Saldırı geri çağırma (S2):** kodda yok (`routes/planet.ts` "IRREVERSIBLE", `session.ts` `recallable`
  yalnız transfer). K8 kuralı: yoldayken bir kez, dönüş uçulan süre, yakıt iadesi yok, iniş sığar,
  son dakika kilidi yok, tekrar saldırı sınırına sayılmaz.
- **Gezegen modelleri:** Draco sıkıştırmalı, ~10.400 üçgen, 3 × 1024 WebP. Yükleyici meshopt ve Draco kapalı;
  modeller `tools/models.mjs` ile meshopt'a çevrilecek, düşük LOD üretilecek.
- **K3:** yazı tipi değişir, boyutlar değişmez (gövde 12 px).

## F10'a devredilenler (temizlikte silinmemeli / taşınmalı)
- v2'nin kullandığı eski ad alanlarındaki metin anahtarları: `statusBar.{alloy,crystal,deuterium}Label`,
  `planet.queue.*`, `counter.*` (compare/lines/escape/matchup/loss), `dossier.shapeUnreadNote`, `clarity.*`,
  `sheet.back/close`, `units.*`. Eski bileşen silinince anahtar kalır (ya da v2 ad alanına taşınır).
- `bg-clarity-*` token'ları (`ClarityMark` parlaklık rampası).
- `CancelConfirm` + eski `Confirm`/`Sheet` (kuyruk sayfası iptali bunlarla açılıyor) → v2 Confirm'e taşınır.
- `onboarding/Rehearsal.tsx` fiilen ölü (yalnız `onboarding-skip` testi çiziyor) → testiyle silinir.
- `GalaxyView` `goHome` (Akademi'nin uçuşu, D56) ve `homeRequest` (dock, D163) ikisi de yaşıyor; Akademi v2'ye geçerse biri kalkar.

## Açık sorunlar
- Almanca Üs başlığında kaynak satırı sıkışıyor (sayılar ikonlara değiyor, "Produktionslager voll" iki satır) — D1 sırasında
  görüldü, kapsam dışı; F8/F10'dan önce bakılmalı.
- **Akademi eski HUD'u öğretiyor** (StatusBar, PendingStrip); mezun olan oyuncu galakside v2'yi görüyor. Şartname
  gereği kapsam dışı; sahibe soruldu mu: hayır — F10 öncesi sahibe sorulacak.
- **Masaüstü (1280):** üst çubuk ölçerleri, Now hattı ve dock tüm genişliğe yayılıyor (ölçer ~390 px, Now hattının
  sayacı en sağda) → F8 (E11). Sayfalar zaten `max-w-xl` ortalı.
- GalaxyView'in kendi sayfaları (Görünüm, Dünyalar, odak rayı) dock'tan açılan bir sayfanın altında kalır, o kapanınca
  geri görünür (eski düzen, bilerek korundu). Kabuğun kendi sayfaları (zil, Filo, Now) her gezintide kapanır.
- Eski `LaunchSheet`: yapışkan "Sending / Standing there" kutusu 350 px'te ilk gemi satırının üstünü örtüyor → F3 (E3).
- Üs: "Build defence" Savunma sekmesini açıyor ama içerik ekranın altında (depo ve kuyruklar önce) → F5.
- `tools/visual.mjs`: hibe harcama döngüsünün `dismiss()`'i Üs sayfasını da kapatıyor, "affordable in" sekme turu hiçbir
  şey ölçmüyor (önceden var) → F5'te Üs ile.
- `clanWar.noTarget` 5 dilde var olmayan "Galaxy Focus" denetimini anıyor → F6.
- de/es/fr `notifications.fleetHome*` çevirileri kötü ("Flottenheimat", "Accueil de la flotte", "Inicio de la flota")
  — önceden var; bildirimler F7'de (E10) ele alınırken düzeltilmeli.
- Akademi turu (`tools/visual.mjs --academy`) S2 sonrası yeniden koşulmadı; araç Türkçe düğmeyi artık `^Gönder` ile
  arıyor. F3.4'te fırlatma bileşeniyle birlikte koşulacak.
- **İki v2 Sheet üst üste açılırsa Escape ikisini birden kapatır** (her biri `window`'u dinliyor). F2'de zil sayfası
  ile bağlam kartı üst üste gelebilirse en üstteki kapanacak şekilde çöz.
- `QueueLane` hücresi 350 px'te ~55 px metin alanı bırakıyor; uzun İngilizce/Almanca adlar kesilir (render yanında
  durduğu için kabul). F5'te görsel kontrol.
- Kırılgan: `research-panel.test.tsx` "opens a clear, item-specific explanation for every project" tek başına ~4,6 s;
  tam paketin yükü altında 5 s zaman aşımını bir kez aştı (değişiklikle ilgisiz).
- Transfer sayfasında bu dünyada olmayan dört taşıyıcı ölü stepper'larla tam satır kaplıyor (D132 gereği listeleniyor);
  tek satırlık nota indirmek F3 incelemesinde değerlendirilecek. Yerleşim metni (de) "Sie" hitabı kullanıyor.
- **Ölü sınıflar (başlangıçtan, sahibin son işlerinden):** ~~`ui/PaceRow.tsx` `bg-accent/20`, `text-bright`~~ (F3.4b'de
  v2'ye geçti); `screens/PlanetScreen.tsx` `bg-cyan-400/10`, `border-cyan-400/40`, `text-cyan-100` — temada yoklar, hiçbir şey
  çizmiyorlar (`surface-vocabulary.test.ts` kırmızısının sebebi). PaceRow B10 ile, PlanetScreen F5 ile değişecek;
  canlı sezonda düzeltilmesi istenirse sahibe söylendi.

## Bilinen kırmızı testler (2026-09-23 @ a64b230, worktree)
typecheck 0 hata · lint 0 hata.
- rules (4): `academy.test.ts` "makes the Academy exit whole…"; `economy-profile.test.ts` "links the other purchases…";
  `intergalactic-convoy.test.ts` "uses combat-only firepower…"; `transport-ladder.test.ts` "carries more than it cost…".
- sim (1): `season.test.ts` "TAX holds its band".
- web (9, 2026-09-24 D3/D4 sonu tam paket): `api-bodies.test.ts` disbandClan; ~~`build-sheet.test.tsx` strategic hardware ×4~~
  (D3'te ocak Taktiksel sekmesine göre yeniden yazıldı, yeşil); `chronicle-screen.test.tsx` capital strike; `locked-rows.test.tsx` research gate (test dünyasında Tersane yok, kapı Tersane'ye
  gidiyor — öncül eskimiş); `predict.test.ts` ×2; `recovery-boost.test.tsx` ×2; `research-gains.test.ts` ×2.
  ~~`surface-vocabulary.test.ts`~~ F5'te (`92dc01d`) yeşile döndü.
- server (tam paket ölçülmedi; ilgili dosyalarda görülen, HEAD'de de kırmızı): `contract.test.ts` ×4 ("GET /api/planet
  parses" hangar/ground şekli; devre dışı Ölüm Yıldızı/önleyici rotaları 404 yerine 200); `intel-states.test.ts` ×3
  (klan sensör küresi, teleskop erişimi). `garbage-collector.test.ts` "is built behind Shipyard 4…" (fiyat 13000 ≠ 10000;
  kural paketi, 2026-09-24'te görüldü, madencilik düzeltmesiyle ilgisiz).
