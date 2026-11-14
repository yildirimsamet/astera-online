# Arayüz envanteri (UI/UX 4.A)

Başlangıç: 2026-11-13. Plan: [`ui-ux-iyilestirme-plani-2026-11-11.md`](ui-ux-iyilestirme-plani-2026-11-11.md) §4.0–4.D.

**Amaç:** oyuncunun görebileceği her ekranı, sekmeyi, sheet'i, katmanı ve durumu baştan sona çıkarmak. Yeniden tasarım (4.B grupları) bu haritadan yapılır. Hiçbir şey sessizce atlanmaz; kapsam dışı olan gerekçesiyle yazılır.

**Kaynak:** kod (kesin bilgi), yerel oyun (`astera_play`), galeri (`v2-gallery.html?view=…`), ölçüm aracının yüzey listesi (`packages/ui-audit/src/inventory.ts`, 55 yüzey).

**Okuma durumu:** her bölümün başında hangi dosyaların tam okunduğu yazılır. "Okundu" yazmayan bölüm taslaktır.

**Durum kalıbı** (her yüzeyde aranır): boş · tipik · yoğun · kilitli · bekliyor/gönderiliyor · yükleniyor · hata · eğitim vurgusu · en uzun dil (DE/FR) · masaüstü.

---

## 1. Uygulama katmanları

Okundu: `App.tsx` (tam).

`App` sırayla şunlara bakar; ilk tutan çizilir:

| # | Koşul | Çizilen | Grup |
|---|---|---|---|
| 1 | `?starterPreview=1` (geliştirici) | `StarterPreview` | kapsam dışı (oyuncu görmez) |
| 2 | `?simulator=1` | `BattleSimulator` (tam ekran) | G11 |
| 3 | `?arena=…` sandbox | `ArenaGate` | G12 |
| 4 | sürüm eski | `UpdateRequired` | G13 (hata ekranları) |
| 5 | bakım | `MaintenanceScreen` | G13 |
| 6 | her zaman, üstte | `JumpScene` → `MigrationSequence` (başlangıç galaksisinden sıçrama) | G15 |
| 7 | oturum açılıyor, web, tanınmayan cihaz | `WebLandingGate restoring` | G13 |
| 8 | oturum açılıyor | `LoadingScreen` ("bağlantı") | G13 |
| 9 | `landing` | web: `WebLandingGate`; uygulama: `LandingScreen` (güvenlik uyarısı, e-posta, hata, açık dialog) | G13 |
| 10 | `rehearsing` | `TrainingDoor` (prolog, el kitabı, uçuş okulu, hesap alma) | G15 |
| 11 | `servers` | `ServersScreen` (galaksi seçimi; geçen sezon sonucu, hata) | G10 |
| 12 | `blocked` | web: `LandingScreen` + hata + tekrar dene; uygulama: düz `main` (başlık, mesaj, buton) | G13 |
| 13 | akademi tekrarı | `TrainingDoor replay` | G15 |
| 14 | arena açık | `ArenaGate` | G12 |
| 15 | oyun | `WorldProvider` → `GameShell` (kabuk) + içinde `GalaxyView`, gemide değilse `ArrivalHost`, profil rotasında `ProfileHost` | G1… |

Görünmeyen yardımcılar (çizim yok, kapsam dışı): `LocalAlertSync`, `PushDeviceSync`, `PushOpenRoute`.

## 2. Oyun: paneller (`Panel`, 21 değer)

Okundu: `GalaxyView.tsx` 1490–2583 (panel ve sheet bağlama bölgesi). Panel türü `screens/GalaxyView.tsx:281`.

Hepsi `V2Sheet` içinde açılır (`v2/kit/Sheet.tsx`), aksi yazmıyorsa `detents={['full']}`. "Menüden" = `menuBack`: başlıkta geri oku menüye döner.

| Panel | Çerçeve | İçerik | Nereden açılır (bilinen) | Grup |
|---|---|---|---|---|
| `planet` (gemi yoksa) | full, bleed, görsel başlık `baseWorld`, **kit başlığı** (`kit={{tone:'self'}}`), başlık gezegen adı (en) | `BaseSwitch` (Üs/Araştırma/Gemi) + `PlanetScreen` | alt menü Üs; bağlam kartı; araştırmanın "Çekirdek gerek" yönlendirmesi; istihbarat "yörünge" | G2 |
| `planet` (gemi varsa) | full, bleed, görsel `repair`, rozet + gemi adı | `VesselScreen` | başlangıç galaksisi | G15 |
| `research` | full, görsel `research` | `BaseSwitch` + `ResearchPanel` | Üs anahtarı; Üs içinden | G2 |
| `ship` (arena açıksa) | full, görsel `commanderShip` | `BaseSwitch` + `HangarPanel` (arena hangarı) | Üs anahtarı | G12 |
| `return` | `SilentSpaceNotice` (kendi çerçevesi) | Sessiz Uzay dönüşü | otomatik / bildirim | G10 |
| `menu` | full; alt sayfada geri oku | `MenuPanel` (sayfalar: home + alt sayfalar) | üst bar ☰ | G1 |
| `wiki` | full, bleed, menüden, sessiz başlık | `WikiScreen` | menü | G11 |
| `rewards` | full, menüden, görsel `rewards` | `RewardsScreen` | menü, üst bar 🎁 | G6 |
| `leaderboard` | full, bleed, menüden, görsel `season` | `SeasonArchiveScreen` | menü | G9 |
| `announcements` | full, menüden, görsel | `AnnouncementsScreen` | menü (Topluluk) | G8 |
| `feedback` | full, menüden | `FeedbackScreen` | menü (Topluluk) | G8 |
| `donate` | full, menüden | `DonateScreen` | menü (Destek ol) | G6 |
| `skin-shop` | full, bleed, menüden | `SkinsScreen` (deneme, envantere geçiş) | menü, üst bar Mağaza | G6 |
| `skin-inventory` | full, bleed, menüden | `SkinInventoryScreen` | menü, mağazadan | G6 |
| `admin` | full, contained, bleed, menüden | `AdminPanel` | menü (yönetici) | G14 |
| `clan` | **fit**, `placement="page"`, bleed, görsel `clan` | `ClanScreen` (sekmeler; arena; klan sohbeti) | alt menü Klan; anıt/hedef işaretleme | G7 |
| `report` | kendi çerçevesi (`BattleReportDoor`) | tek savaş raporu; yoksa savaş listesine | bildirim, zil | G5 |
| `intel` | **fit**, page, bleed, görsel `intel` | `IntelScreen` (raf: `probes` / `battles`) | alt menü İstihbarat | G3 |
| `recap` | kendi çerçevesi (`SeasonRecap`) | sezon özeti | menü, sezon sonu | G9 |
| `chat`, `chronicle`, `profile` | kabuk tarafında (bkz. §3) | | | G8, G5, G10 |

## 3. Oyun kabuğu (G1)

Okundu (tam): `v2/shell/GameShell.tsx`, `HudTop.tsx`, `HudDock.tsx`, `BellHost.tsx`, `ChatHost.tsx`, `FleetHost.tsx`, `OutlineHost.tsx`, `CommanderHost.tsx`, `AwayHost.tsx`; `v2/hud/TopBar.tsx`, `Dock.tsx`, `WorksLine.tsx`, `NowLine.tsx`, `GalaxyCorners.tsx`, `ContextSlot.tsx`, `BellSheet.tsx`; `v2/kit/ResourceMeter.tsx`; `shell/MenuPanel.tsx`; `shell/Signals.tsx` 120–320; `brand/Identity.tsx` (masthead); `ui/SignalBoostNote.tsx`; `lib/dock.ts`, `lib/shellRoute.ts` (yönlendirme). Göz atıldı: `ui/Toast.tsx`, `brand/RecallHost.tsx`.

**Kit durumu:** kabukta oyun kitinden (`game-ui/`) tek parça yok. Hepsi v2 token'larıyla elle çizilmiş; sinyal akışı ise daha eski (v1) token'larla (`plate`, `legend`, `text-bone`, `text-faint`, `border-line-soft`, `threat`).

### 3.1 Yerleşim (telefon / masaüstü)

```
Telefon (≤ v2-split)                         Masaüstü (E11 · K10)
┌ BrandMasthead (logo · Mağaza · tam ekran) ┐  ┌ Masthead ────────────────────────────────┐
├ [Tatil şeridi]                            ┤  ├ TopBar: kaynaklar | 5 sekme (1–5) | 🎁 🔔 ☰ ┤
├ TopBar: [dünya] 3×kaynak  🎁 🔔 ☰          ┤  ├ Outline sütunu │ galaksi / sayfa          ┤
│         Atölye çizgisi (topla)            │  │ (dünyalar,     │                          │
├ [Sinyal güçlendirme şeridi]               ┤  │  uçuşlar,      │                          │
├ NowLine (yüzer kart, en acil sayaç)       ┤  │  kuyruklar)    │                          │
│ galaksi + köşeler + bağlam kartı          │  └────────────────┴──────────────────────────┘
└ Dock (5 sekme, galaksi üstünde saydam)    ┘
```

### 3.2 Yüzeyler

| # | Yüzey | Dosya | Ne gösterir | Durumlar | Açılış / eylem | Not (kod okuması) |
|---|---|---|---|---|---|---|
| 1 | Marka şeridi | `brand/Identity.tsx` `BrandMasthead` | sigil + ASTERA ONLINE; web'de Mağaza + tam ekran düğmesi, yoksa adres | mağazalı / adresli; gemideyken mağazasız | Mağaza → `skin-shop` | Oyun ekranında her zaman ~1 satır yer kaplıyor; oyuncu kararına katkısı yok. Kabuk tasarımında yeri sorgulanacak. |
| 2 | Tatil şeridi | `HudTop` | "Tatil · bitiş" | yalnız tatildeyken | — | düz metin şerit |
| 3 | Üst bar | `v2/hud/TopBar.tsx` | dünya işareti (2+ dünya), 3 kaynak ölçeri, hediye, zil, ☰ | dünya tek/çok; gemide döteryum gizli; ödül var/yok; zil okunmamış/acil; kalkan süresi ☰ altında; güçlendirme oku; toplama parçacığı | ölçer → ekonomi (Üs, Büyüt); dünya → `WorldsPanel`; 🎁 → ödüller; 🔔 → zil sheet'i; ☰ → menü | Kalkan süresi ☰ düğmesinin altına 8 px yazı olarak asılı: kalkan oyuncu için kritik ama en küçük öğe. ☰ "Komutan" sayfasını açıyor ama simgesi hamburger. Kit'te `ResourceHud`, `RoundButton`, `CountBadge` karşılıkları var. |
| 4 | Kaynak ölçeri | `v2/kit/ResourceMeter.tsx` | simge + sayı + depo çubuğu (kasa payı işaretli) | dolu (uyarı çentiği); güçlendirilmiş; toplama animasyonu | dokununca ekonomi | v2 kit parçası; oyun kitindeki `ResourceHud` / `StoreGauge` ile yan yana iki ayrı dil var. |
| 5 | Atölye çizgisi | `v2/hud/WorksLine.tsx` | her kaynağın atölye kabı (+N), doluluk dolgusu | boş (soluk); toplanabilir (halka); dolu/durdu veya depoda yer yok (sarı, nabız); bekliyor (disabled); ilk ipucu balonu (`☝`) | tek dokunuş toplar; depo doluysa Üs'ü açar | 16 px yükseklik, 10 px yazı: en sık yapılan eylem (toplama) ekranın en küçük dokunma hedefi. İpucu emojiyle çizilmiş. Kit `GameHold`/`GameButton` + `CargoBar` adayı. |
| 6 | Sinyal güçlendirme şeridi | `ui/SignalBoostNote.tsx` | "×2 / ×2,5 üretim · kalan süre" | yalnız etkinken | — | düz metin şerit; aynı bilgi ölçerdeki okta da var |
| 7 | Now çizgisi | `v2/hud/NowLine.tsx` | en acil sayaç: nokta, başlık, ayrıntı, geri sayım, +N | düşman (kırmızı), uyarı (Sessiz Uzay, bakım: sarı), kendi (mavi); hiç sayaç yoksa çizilmez | dokununca sayaç sheet'i | — |
| 8 | Sayaç sheet'i | `NowLine` içindeki `Sheet` | bütün sayaçlar: geri sayım + saat; kuyrukta bekleyen "Sırada" | düşman / uyarı / kendi; odaklanabilir satır (uçuşa git) / salt okunur | satır → kamerayı uçuşa çevir | düz liste; satır türleri yalnız noktayla ayrılıyor |
| 9 | Dock (alt menü) | `v2/hud/Dock.tsx`, `HudDock.tsx` | Galaksi · Üs · Filo · İstihbarat · Klan | aktif çizgi; Üs uyarı noktası (onarılmamış arıza); Filo havadaki sayısı + iniş halkası; İstihbarat okunmamış rapor; Klan bekleyen iş; kilitli (asma kilit, gemide); yeni açıldı ("Yeni" ışıltısı); devre dışı (klansız sezon); galaksi üstünde saydam / sayfa açıkken zeminli; masaüstünde üst barda kısayollu | Galaksi tekrar → eve uç; diğerleri sayfa açar; kilitliye basınca kilit tostu | Kit'te `BottomNav` + `DOCK_ART` (sanat simgeleri) hazır ve hiç kullanılmıyor. Sahibinin "kit oyunda yok" dediği ilk yer. |
| 10 | Galaksi okuması (sağ üst) | `GalaxyCorners.tsx` `GalaxyReadout` | bugün aktif oyuncu; dünya/gemi, uzaktaki filo, kaya, korsan, enkaz, karakol, anıt sayıları | her sayı 0 ise gizli; tıklanabilir sayı (noktalı alt çizgi) → hedef listesi açılır (anıtlar zor/kolay başlıklı) | liste satırı → hedefe odak | 10 px mono yazı, zemin yok, gölgeyle okunuyor. Açılan liste kendi elle çizilmiş popover. |
| 11 | Ev / sohbet düğmeleri | `GalaxyCorners.tsx` `HomeChip`, `ChatChip` | yuvarlak 36 px | sohbet okunmamış noktası | ev → kamerayı aktif dünyaya; sohbet → `ChatHost` | Kit'te `RoundButton` var. |
| 12 | Olay çipleri | `GalaxyCorners.tsx` `EventChips` | sürmekte olan olay + çarpan + kalan süre | olay yoksa yok | olay → gemisine odak | — |
| 13 | Bağlam kartı | `v2/hud/ContextSlot.tsx` | tek kart: gelen saldırı > olay(lar) > öneri | saldırı (kırmızı, Hazırlan/Bak); olay (tekli/çoklu, Göster); öneri açık / katlanmış tek satır; kapatıldı (anahtar bazında hatırlanır); seçim varken kırmızı sayı hapı (sol üst) | Hazırlan → Üs; Bak → saldırgan filo; öneri eylemi | Kart ve iki düğmesi elle çizilmiş; saldırı anı oyunun en ağır anı ama düz bir kart. Kit'te `Banner`, `GameButton`, `Timer` var. |
| 14 | Zil sheet'i | `BellSheet.tsx` + `BellHost.tsx` | Sinyaller / Kronik sekmeleri (`Segmented`) | yarım/tam yükseklik; "N yeni" başlık üstü | 🔔; `chronicle` paneli bu sekmeyi açar | Kit'te `GameTabs` var. |
| 15 | Sinyal akışı | `shell/Signals.tsx` `SignalsFeed` | "Şu an" (canlı klan alarmı + durumlar), sonra olaylar (gruplanmış) | boş (zil simgesi + metin); okunmamış/bu açılışta okunan; gidilebilir satır (→) | satır → panel/raf/rapor/odak (`DESTINATION`) | **Eski (v1) token'larla çizilmiş**: v2 ile bile aynı dilde değil. Ok işareti düz `→` karakteri. Öncelikli. |
| 16 | Kronik | `screens/ChronicleScreen.tsx` | galaksinin olay geçmişi | — | dünya → kamera; kendi dünyası → Üs | G5'te ayrıntılı okunacak |
| 17 | Menü (Komutan) | `shell/MenuPanel.tsx` | kimlik (avatar harfleri, bayrak, klan) → profil; galaksi + sezon süresi; gemideyse gemi günlüğü; Sessiz Uzay / sezon sonucu / ödül satırları; mağaza vitrini; Bildirim Merkezi kartı; sıralama karosu; Ödüller, Akademi, Topluluk, Destek ol, Ayarlar kategorileri; işaretli rakipler; yükle + devam | gemide (sıralama/ödül/mağaza yok, kalkış panosu var); yönetici; sezon bitti; işaret kayıp | alt sayfalar: Akademi (Wiki, Simülatör, rehberi aç, akademi tekrarı), Topluluk (duyurular, geri bildirim, yönetici), Ayarlar | Uzun tek sütun; karo, satır, kart, kategori dört ayrı öğe dili. Kit'te `ListRow`, `Plate`, `SectionTag`, `Emblem` var. |
| 18 | Ayarlar | `MenuPanel` `settings` | dil, müzik (aç/kapa + ses), efektler (aç/kapa + ses), çalan parça, görüntü kalitesi, FPS, analitik, gizlilik onayı | — | — | Kit'te `Toggle`, `Slider`, `LanguagePicker` hazır ve hiç kullanılmıyor. HTML `range` + elle düğmeler. |
| 19 | Bildirim Merkezi sheet'i | `screens/NotificationCenterSheet.tsx` | ödenen saldırı uyarıları cüzdanı | kurulu değil / boş / kapsıyor | menü kartı | G8'de okunacak |
| 20 | Sohbet | `v2/shell/ChatHost.tsx` + `screens/ChatScreen.tsx` | tam sayfa; başlıkta sessize alınanlar ve engellenenler | okunmamışa göre kanal (DM > genel > klan); klavye açık/kapalı | sohbet düğmesi, klan | G8 |
| 21 | Sessize alınanlar | `ChatHost` içi `Sheet` | liste + "Aç" | boş / dolu | sohbet başlığı | G8 |
| 22 | Filo sayfası | `v2/hud/FleetPage.tsx` + `FleetHost.tsx` | havada / dünyalar / hangar sekmeleri; geri çağır; bakıma al; anıtlar; klan dalgaları | gemide | Dock Filo | G2'de |
| 23 | Masaüstü özeti | `v2/hud/Outline.tsx` + `OutlineHost.tsx` | dünyalar, uçuşlar, kuyruklar | gemide dünyalar yok | dünya/uçuş → galaksi; kuyruk → Üs/araştırma | yalnız masaüstü |
| 24 | Dönüş hikâyesi | `v2/hud/AwaySheet.tsx` + `AwayHost.tsx` | yokken olanlar: kahraman satır + satırlar + gözlemler + bakım | gemide ayrı hikâye; eşik altı gösterilmez; eğitim konuşurken bekler | otomatik (1,5 s sonra) | G5 |
| 25 | Marka hatırlatma / quiz | `brand/RecallHost.tsx` | yükleme önerisi kartı, marka quiz'i | quiz / dönüş / yok | otomatik | G13 ile birlikte bakılacak |
| 26 | Tost | `ui/Toast.tsx` | üstte kısa mesaj, kapatma | bilgi / hata | her eylem sonucu | v2 dili; kit'te karşılık yok (kit boşluğu adayı) |
| 27 | Komutan kartı | `v2/hud/CommanderCard.tsx` + `CommanderHost.tsx` | sıra, Onur, dünyalar, kalkan, sezon günü | — | profil sayfası | G10 |

**Kabuk davranışları (değişirse korunacak):** sekme kilidi tostu (`gate.tabLock`), klavye 1–5 / Boşluk / Esc, kronik → zil sekmesi, Galaksi'ye ikinci basış eve uçar, sayfa açılınca sayaç sheet'i kapanır, dock galaksi üstünde saydam.

**Canlı oyunda olmayan eski kabuk (ölü kod adayı, silinmedi; tam liste "Paylaşılan arayüz parçaları" bölümünde de):** `shell/StatusBar.tsx`, `PendingStrip` bileşeni ve sinyal düğmesi `Signals` yalnızca eski `onboarding/Academy.tsx` ve `onboarding/Rehearsal.tsx` içinde çiziliyor; bu iki dosyayı hiçbir canlı dosya içe aktarmıyor (yalnız testler). `useAirborne` ve `FlightList` canlıda kullanılıyor. Owner'a liste olarak sunulacak.

### 3.3 G1: göz (2026-11-11 ölçümünün görüntüleri, `out/ui-envanter/temel-2026-11-11/`)

Bakıldı: `galaxy-hud__client-galaxy-mid`, `menu__client-menu` (+ `.p1`), `bell__gallery-bell`.

1. **Üst krom ≈ 90 CSS px:** marka şeridi (≈ 38) + kaynak barı (≈ 50). Galaksiden önce ekranın %11'i; marka şeridi karar taşımıyor.
2. **Atölye ipucu balonu Now çizgisinin üstüne biniyor:** "☝ Üretim havuzda birikir…" balonu en acil sayacın metnini kapatıyor (galakside ve galeride). Hata.
3. **Zil galerisi yer tutucu:** "Signal rows draw here (SignalsFeed)." Sinyal akışının gerçek görüntüsü hiç ölçülmemiş. `inventory.ts` içinde `bell.unreached` olarak kayıtlı; ulaşım yolu G1'in 1. adımında eklenir.
4. **Menüde tekrar:** "20 ödül hazır" satırı + "Ödüller" kategorisi aynı yere gidiyor; Mağaza üç yerden (marka şeridi, menü karosu, üst bar dışında vitrin) açılıyor. Menü dört ayrı öğe biçimi taşıyor (satır, iki karo, geniş karo, kategori listesi).
5. **Dock:** düz çizgi simgeler + 10 px etiket. Kitteki sanat simgeleri (`DOCK_ART`) ve `BottomNav` kullanılmıyor.
6. **Galaksi okuması:** "177 gezegen · 30 enkaz / 8 anıt" noktalı alt çizgili 10 px mono; dokunulabilir olduğu anlaşılmıyor.

### 3.4 G1 için ilk gözlemler (ekran görüntüsü öncesi, koddan)

1. Kit kabukta hiç yok: Dock, ayarlar ve menü için kit parçaları (`BottomNav`, `Toggle`, `Slider`, `LanguagePicker`, `ListRow`) hazır duruyor.
2. Sinyal akışı v1 dilinde: kabuktaki tek "üç dil" yeri.
3. Kalkan süresi ve toplama çizgisi, önemlerine göre çok küçük.
4. Menü tek sütunda dört ayrı öğe biçimi taşıyor; kategoriler ve karolar karışık.
5. Saldırı kartı oyunun en ağır anı ama sıradan bir kart.
6. Marka şeridi her oyun ekranında yer tutuyor.

### 3.5 G1 karar notu (4.C 1. ve 2. adım, 2026-11-14)

**Oyuncunun anı:** Oyuncu oyunu her açtığında bu kabuğu görür. İlk bakışta üç şeyi anlamalı:
- Güvende miyim? (kalkan, gelen saldırı)
- Ne birikti? (kaynak, atölye)
- Sırada ne var? (en yakın sayaç)

Ardından tek dokunuşla toplar ya da bir yere gider. Galaksi oyunun sahnesidir; kabuk onu örtmez.

**Göz (galeri, 2026-11-14, `out/ui-audit/g1-2026-11-14/`):** her G1 durumuna galeri yolu açıldı (969343ae). Eksikler:

| Yer | Bugün |
|---|---|
| Zil | aynı sondanın iki satırı ayrı ayrı duruyor (gruplanmıyor); sheet yarım yükseklikte açılıyor; aile renkleri iyi okunuyor; dosya v1 dilinde (38 iz) |
| Bağlam kartı | saldırı kartı düz bir kart, geri sayım mono yazıyla saniye saniye; tekli olayda "Göster" yok; ticaret gemisi satırında iki yazı tipi karışık |
| Menü | ayarlarda dil seçimi tarayıcının `<select>` kutusu (web formu); ses sürgüleri elle çizilmiş; kitteki `LanguagePicker`, `Slider`, `Toggle` kullanılmıyor; dört öğe biçimi; "2 ödül hazır" kartı "Ödüller" satırının tekrarı; sezon bitince iki kart üst üste; Akademi karoları yarım satır bırakıyor; galeri sheet başlığı İngilizce sabit ("Commander / Your account") |
| Üst bar | kalkan süresi "⌂6s", ☰ düğmesinin ~8 px altında; sinyal güçlendirme ve tatil düz metin şeritleri; marka şeridi ≈ 38 px; atölye ipucu balonu Şimdi çizgisinin üstüne biniyor; alt menü etiketleri 10 px |
| Tost | kısmi toplama hata tonunda (kırmızı ⚠): renk rolü hatası; tost atölye ipucunun yerine biniyor |
| Galaksi okuması | iki sütunlu mono ızgara hizasız, başıboş "·" işaretleri; basılabilir sayılar yalnız noktalı alt çizgiyle belli; hedef listesi elle çizilmiş popover |

**Ölçüm (öncesi, `reports/ui-audit/g1-before-2026-11-14.md`):** 17 galeri yolu, 6 dil, telefon, dar ekran ve masaüstü; 238 ölçüm, 2 zaman aşımı. Telefonda (tr + en):

| Ölçü | Sonuç |
|---|---|
| 12 px altı metin | 788 metnin 629'u (%80); en küçüğü 7 px (kalkan süresi) |
| 44 px altı dokunma hedefi | 476 hedefin 336'sı (%71) |
| Basınca 100 ms içinde tepki | 232 hedefin 0'ı; %95'inde hiç tepki yok |
| Kesilen metin | 15 (menüdeki ödül satırı fr/es/tr; fr dar ekranda "Renseignement") |
| Kelime bütçesi | yalnız zil aşıyor: ekran başına 54,5 kelime, 3 uzun blok |

En kötü üç yer: ayarlar (puan 119), galaksi okuması (90), zil (82).

**Kit karşılaştırması:** kitin HUD görünümü (`out/ui-kit/r5/kit-ui-kit-hud.png`) bu kabuğun hedefi:
- kaynak hapları (sanat + sayı + depo çubuğu);
- sayaç plakaları (halka + süre + başlık);
- durum çipleri;
- sanat simgeli alt menü.

Rakip (Whiteout, `out/competitors/2026-11-11/whiteout/`) için menü girişi oyuncunun portresidir. Etkiler portrenin altında simge satırı olarak durur. Alt menüde boyalı simgeler ve kırmızı nokta kullanılır.

**İş birimleri (sırayla; her biri kendi 4.C döngüsünden geçer, biri bitmeden öteki başlamaz):**

| # | Birim | Ne değişir | Neden |
|---|---|---|---|
| G1-a | Alt menü | Kitin `BottomNav` parçası, sanat simgeleri (`DOCK_ART`) ile. Galakside saydam kalır, sayfa açıkken metal zemin alır. Masaüstünde üst bardaki sekme çubuğu aynı parçadan çizilir. Basışın sesi ve titreşimi olur. | Owner'ın "kit oyunda yok" dediği ilk yer. Önce kite girecekler: filo iniş halkası, sessiz sayı (havadaki gemi), Üs uyarı noktası, "Yeni" ışıltısı, devre dışı yer, aynı sekmeye ikinci basış (eve uç), saydam kip, masaüstü sekme çubuğu ve 1–5 tuşu |
| G1-b | Üst bar | Kaynaklar kitin `ResourceHud` parçasıyla (sanat, sayı, depo çubuğu) çizilir. Atölye çizgisi 44 px dokunma alanlı tek toplama düğmesi olur; ilk ipucu `CoachMark` ile gösterilir. ☰ düğmesinin yerine komutan rozeti gelir. Kalkan, sinyal güçlendirme ve tatil, barın altında tek `StatusChip` satırında toplanır. Hediye ve zil `RoundButton` + `Dot` olur. Marka şeridi kitin diline geçer. | Kalkan oyuncu için kritik ama bugün en küçük öğe; toplama en sık eylem ama 16 px; üç ayrı düz metin şeridi var |
| G1-c | Şimdi çizgisi, sayaç sheet'i | Kitin sayaç plakası: halka, süre, başlık, ton kenarı. Sheet satırları aynı dilde, türüne göre glif taşır. | Kit HUD görünümündeki plakalar |
| G1-d | Köşeler, bağlam kartı, tost | Galaksi okuması kit çipleri ve kit açılır listesiyle çizilir. Ev ve sohbet `RoundButton`, olay çipleri `StatusChip` olur. Saldırı kartı kırmızı `CutPlate`, `Timer` halkası ve `GameButton` alır; saldırı gelince ses ve titreşim. Tekli olayda da "Göster" olur. Tost kitin `Banner` tost biçimini alır; kısmi toplama sarı (uyarı) olur. | Saldırı oyunun en ağır anı; kısmi toplamada renk rolü hatası |
| G1-e | Zil, sinyal akışı | Sekmeler `GameTabs`. Satırlar kit satırı: aile rengi, glif, zaman. Üst üste gelen aynı olay gruplanır. Boş akış `EmptyState`. | Kabuktaki tek v1 yeri |
| G1-f | Menü, ayarlar | Bölümler `SectionTag` ile ayrılır, tek öğe dili kullanılır. Ödül tekrarı kalkar. Ayarlarda kitin `LanguagePicker`, `Toggle`, `Slider` parçaları. Akademi karoları satırı doldurur. Sheet başlığı çevrilir. | Dört öğe biçimi; web formu seçim kutusu |
| G1-g | Masaüstü özeti | Kitin `Plate`, `QueueSlot`, `FreeSlot` parçaları | Yalnız masaüstü |

**Gezinme değişiklikleri:**
1. ☰ düğmesi komutan rozetine döner. Gittiği yer aynı: Komutan sayfası. Kalkan süresi rozetin altından durum satırına geçer.
2. Menüdeki "N ödül hazır" kartı kalkar. Ödüller üst bardaki hediyeden ve menüdeki tek "Ödüller" satırından açılır.
3. Bunun dışında gezinme değişmez. Korunanlar:
   - alt menünün sırası;
   - Galaksi'ye ikinci basışla eve uçuş;
   - 1–5, Boşluk ve Esc tuşları;
   - kronik → zil sekmesi.

**Korunan owner kararları:**
- atölye üst barda, tek bakışta (2026-09-25);
- zil sayısı kırmızı (2026-09-24);
- alt menü galakside saydam (2026-09-24);
- güçlendirme işareti kalkanla aynı renk (2026-09-16);
- oyunda görünen marka adı (2026-10-07; 2026-11-14'te owner kararıyla şerit kalktı, ad menüde ve yükleme ekranında).

**Owner kararı (2026-11-14, G1-b sırasında soruldu):** marka şeridi oyun ekranından kalktı. Bu, 2026-10-07 tarihli "oyunda görünen ad" kararını değiştirir; soru bunu açıkça söyledi, owner onayladı. Ad yükleme ekranında, menünün altındaki imza satırında ve Akademi başlığında kalır (`docs/brand-recall-plan.md`, "Owner decision — 2026-11-14"). Galaksiye ≈ 38 px yer açıldı.

**Envanter düzeltmesi:** `starter/UniverseChip.tsx`, `starter/MainGalaxyRow.tsx`, `starter/DepartureBoard.tsx` ve `starter/ShipLog.tsx` yalnız koloni gemisindeyken çiziliyor. Dördü G15 `starter` yüzeyine taşındı (owner: başlangıç yolculuğu en sonda).

`shell/PendingStrip.tsx` içinde iki tür kod var:
- canlı kanca `useAirborne` ve türleri G1-d'de `lib/` altına taşınacak;
- `PendingStrip` ve `FlightList` bileşenlerini yalnız ölü `Academy`/`Rehearsal` ile bir regresyon testi kullanıyor.

Taşımadan sonra dosya ölü kod listesine girer; silme owner onayıyla yapılır.

### 3.6 G1 ilerleme

**G1-a alt menü ✅ (2026-11-14).** Kitin `BottomNav` parçası oyunun alt menüsü oldu.

Önce kite eklenenler (galeri: `ui-kit` "Alt menü" bölümü):
- sessiz sayı (havadaki gemi, çelik renk);
- uyarı noktası (onarılacak arıza);
- iniş halkası;
- "Yeni" ışıltısı;
- devre dışı yer;
- açık yere ikinci basış (`onReselect`);
- saydam kip;
- masaüstü sekme çubuğu ve tuşu.

Davranış:
- Kilitli sekme nedenini yerinde, reddetme sesiyle söyler. Klavye yine kabuğun tostuyla karşılanır.
- Basışta sekme sesi ve hafif titreşim gelir.

Kabuk artık alt menünün gerçek yüksekliğini yayınlar (69 px; `--v2-dock-h`), böylece sheet'ler menünün üstünde biter.

Ölçüm (`out/ui-audit/g1a-2026-11-14/`, 6 dil × 3 boyut):
- etiketler 12 px (önce 10 px);
- kesilme yok (önce fr dar ekranda "Renseignement" kesiliyordu);
- hedefler 53–99 × 64 px.

Kit ölçümü (`reports/ui-audit/kit-2026-11-14.md`): 12 px altı yazı, 44 px altı hedef ve kontrast hatası 0.

Yerel oyunda yeni bir komutanla beş sekmeye basıldı: sayfa açıkken menü metal zemin alıyor, açık sekme yanıyor. `Dock.tsx` eski dil izi 0.

**G1-b üst bar ✅ (2026-11-14).** Owner'ın seçtiği düzen:
- marka şeridi oyun ekranından kalktı (karar yukarıda);
- üst bar = kitin `ResourceHud` hapları (sanat, sayı, depo çubuğu; atölye birikimi hapın içinde, tek dokunuşla toplanır) + sağ uçta komutan madalyonu;
- madalyon (`Medallion`, yeni kit parçası): metal halkalı yuvarlak portre, içinde baş harfler; menüyü açar, eski çelik kare ☰ düğmesinin yerini aldı;
- zil galakside sağ alta, sohbetin soluna indi (`SignalBell`); ikisi de plakasız boyalı simge (`RoundButton art`), haber gelince zil sallanır (`data-rang`), acil haberde nabız atar;
- barın altında tek durum satırı (`StatusLine`), solda: iki dünya varken okunan dünya, kalkan, güçlendirmeler ve tatil kit çipleriyle (süreleriyle; basınca anlamı söylenir), yanında hediye;
- Mağaza kapısı aynı satırın sağ ucunda boyalı simge (yalnız web ödemesi açıkken, koloni gemisinde yok);
- tam ekran düğmesi menünün altına, kurulum düğmesinin yanına taşındı; altında marka imzası.

Kite eklenenler (galeri: `ui-kit` "Üst bar" bölümü): `Medallion`, `RoundButton` haber sallanması, üç Codex sanatı (`hud-medallion`, `hud-bell`, `hud-chat`, ev stilinde, 160 px webp).

Palet: owner 2026-11-14'te üç temayı karşılaştırdı ve Gözlemevi lacivertini seçti (grafit solgun kalıyordu). Kitin bütün metal, cam ve çelik token'ları `tokens.css`'te bu lacivertle yeniden yazıldı; koruyucu test mavi tonu ve v2 zeminine eşitliği arar.

Yerel oyunda 350 px'te (tr, ja) denendi: madalyon menüyü açıyor; zil "Neler oldu" sheet'ini açıyor; kalkan ve hediye solda, Mağaza sağda; sohbet ve zil bağlam kartının üstünde.

Ölçüm (`reports/ui-audit/g1b-after-2026-11-14.md`; kabuğun 16 galeri yolu, 6 dil × 3 boyut, G1 öncesiyle karşılaştırmalı):

| Ölçü (telefon) | G1 öncesi | G1-b sonrası |
|---|---|---|
| 12 px altı metin | 629 | 321 |
| 44 px altı hedef | 336 | 110 |
| Basınca tepkisiz hedef | 220 | 88 |
| Kontrast hatası | 137 | 94 |
| Kesilen metin (bütün diller) | 15 | 10 |

Üst barın bütün hedefleri (üç hap, madalyon, dünya çipi, kalkan/sinyal/tatil çipleri, Mağaza) 44 px ve basınca tepki veriyor. Ölçümün bulduğu iki eksik kapatıldı: durum çipleri basınca tepki vermiyordu, menüdeki marka imzası 3,87:1 kontrastta kalıyordu (şimdi 8,55:1). Kalan bulgular sıradaki birimlerin yüzeylerinde (sayaçlar, köşeler, bağlam kartı, zil, menü) ve galaksi etiketlerinde (G4).

Kit ölçümü (`reports/ui-audit/kit-2026-11-14.md`, yeniden): 12 px altı yazı, 44 px altı hedef ve kontrast hatası 0. Lacivert palette kitin sessiz yazısı (`--gk-ink-3`) aydınlık plaka yüzlerinde 4,2:1'e düşüyordu; #95a3c1'e açıldı. Acil haberli zilin nabzı basış küçülmesini örtüyordu; basışa parlama eklendi.

Ölçüm sırasında bulunan G1-b hatası: `chrome.css`, Şimdi çizgisi varken galaksinin üst köşelerini sabit 3rem aşağı itiyordu; köşeler artık yüzen satırların ölçülen yüksekliğiyle (`--v2-float-h`) iniyor, çift itme kalktı.

Bilinen boşluk: Uçuş Okulu ve mağaza keşif galerisi zil göstermez (`showGuidance` kapalı; G15'te ele alınacak). Koloni gemisinde bir seçim açıkken köşe kümesi gizlenir (sohbet de önceden böyleydi).

`v2/hud/WorksLine.tsx` ve testi silindi: atölye çizgisinin işini kaynak hapları devraldı (yerine geçen parça, ölü kod değil).

G1-b'nin bıraktığı ölü kod adayları (silinmedi, owner'a liste olarak sunulacak):
- `brand/Identity.tsx` içindeki `BrandMasthead` ve `brand/styles.css` içindeki `.brand-masthead` kuralları: yalnız marka önizlemesi ve testler çiziyor. `.brand-masthead-fullscreen*` canlı: tam ekran düğmesi menüde bu kuralları kullanıyor.
- `v2/kit/ResourceMeter.tsx`: yalnız galeri ve kendi testi.
- `ui/SignalBoostNote.tsx`: yalnız ölü `shell/StatusBar.tsx` içinde.

**G1-c Şimdi çizgisi ve sayaç sheet'i ✅ (2026-11-14).** Oyuncunun anı: oyun açılınca "bana bir şey geliyor mu, sıradaki ne iniyor?" Durum satırının altındaki tek plaka bunu söyler; bir dokunuş bütün sayaçları açar.

Önce kite eklenenler (galeri: `ui-kit` "Sayaçlar" bölümü):
- `TimerPlate`: kesik köşeli plaka, rengi sayacın sahibinden (sen teal, düşman kırmızı, uyarı amber); halka, büyük süre, ad ve tek cümle, arkasındakiler için "+N". Plakanın tamamı tek basış (ses + titreşim). Düşman adı bir kez okunur (`aria-live`), saniye okunmaz. Baştaki sayaç değişince plaka yukarıdan düşerek gelir.
- `TimerRow`: sayaç listesinin satırı; halka ve işaret, ad ve cümle, süre ve "saat 14:32"; sırada bekleyen iş için kum saati ve "Sırada" (owner, 2026-10-06). Kameranın gidebildiği satır basılabilir, gerisi bilgi.
- `Timer`: renk (`tone`), sürerken nabız (`beat`, owner 2026-09-24: her sayaçta işaret atar), yalnız halka (metinsiz) ve bütünü bilinmeyen sayaçta yalnız iz.
- Kesik plakanın uyarı rengi (`gk-cut--warn`).
- Codex ile ev stilinde boyalı kronometre (`hud-timers`): sayaç sheet'inin başlığı.

Kural (`lib/nowLine.ts`, testli):
- `nowSpan`: halka yalnız oyunun bildiği bütün üzerinde boşalır (uçuşun kalkışı, işin başlangıcı, olayın penceresi, süren bakım). Kalkan, Sessiz Uzay'a geçiş, ilerideki bakım ve sırada bekleyen iş için uydurma bir bütün yerine yalnız iz çizilir. Düşmanın kalkışı ancak galaksi onu görüyorsa bilinir.
- `nowGlyph`: her sayacın işareti (saldırı siren, vuruş, filo roket, dönüş geri çağırma, sonda göz, aktarım/konvoy sandık, destek, koloni, radyasyon, anıt yıldız, sinyal hedef, sondaj kazma, yapım ok, araştırma büyüteç, olay türüne göre, kalkan, uyarı, bakım dişli).
- `nowTone`: kırmızı yalnız düşmana.

Sheet: başlıkta kronometre ve sıralama kuralı ("Önce düşman, sonra en yakını", 6 dil): bir saat uzaktaki düşmanın bir dakikada inen aktarımın üstünde durması hata değil, kural olarak okunur. Düşman yoldayken başlık plakası kırmızı.

Oyunda bulunan iki hata (ikisi de G1-b'nin yüzen katmanından):
- Plaka basılamıyordu: yüzen katman basışları galaksiye geçiriyor, kit düğmesi geri almıyordu. Düzeltildi, testli.
- Sayaç sheet'i yüzen katmanın içinde kaldığı için galaksinin bağlam kartı ve köşe düğmeleri sheet'in üstüne çiziliyordu. Sheet artık `body`'ye açılıyor, testli.

Hizalama (owner notu 2): plaka, durum satırı ve ilk ipucu bandı 12 px'lik ana boşluktan başlıyor.

Ölçüm (`reports/ui-audit/g1c-after-2026-11-14.md`, `gallery:timers`, 6 dil × 3 boyut), G1 öncesine göre telefonda: 12 px altı metin 25 → 0, kontrast hatası 5 → 0, 44 px altı hedef 8 → 1, tepkisiz hedef 9 → 2, kesilen metin 0 (dar ekranda ad iki satıra sarılıyor). Kalan hedef ve tepkisiz alan bütün sheet'lerin ortak parçası: 16 px'lik "Genişlet" tutamağı ve adsız arka plan. Sheet birimine (G1-g, owner notu 1 ile) bırakıldı.

Yerel oyunda 350 px'te denendi: yapım başlatıldı, plaka "ALAŞIM RAFİNERİSİ · İş bitiyor · +2" ile halkası dolarak göründü; basınca sheet açıldı, sıradaki iş kum saatiyle, olay sandıkla okundu; galaksinin köşeleri plakanın altından başlıyor.

Kit ölçümünde G1'den önce de olan tek tepkisiz hedef: galerideki `Slider` örneği ("Ok"); kit sürgüsüne dokunan birimde ele alınacak (G1-f ayarlar).

## 3A. Genel bulgu: üç tasarım dili yan yana

Ölçüldü (2026-11-13, `apps/web/src`, test/galeri/dev hariç):

| Dil | İşaret | Dosya |
|---|---|---|
| v1 | `ui/kit` (`Button`, `Sheet`, `Meter`, `Chip`), token `text-bone/faint/dim`, `plate`, `legend`, `slab`, `field` | 69 dosya v1 token'ı taşıyor, 30'u `ui/kit` içe aktarıyor |
| v2 | `v2/kit` (`Sheet`, `Segmented`, `HoldButton`, `Cost`, `NeedBar`, `RoomBar`), token `v2-*` | 88 dosya |
| Oyun kiti | `game-ui` (`gk-*`), 2. aşamanın yazı ölçeği | 11 dosya (4.1 Üs parçaları + `v2/kit/Sheet` başlığı) |

**Yazı ölçeği:** `styles.css` bugün `--text-body 12px`, `--text-label 11px`, `--text-caption 10px`, `--text-micro 9px`. Kit dışındaki her yüzey 2. aşama kararının (12 px altı yazı yok; 12/13/14/16/19/24, sayı 18) altında kalıyor. Kit kendi ölçeğini taşıyor (`--gk-t-floor`, `--gk-t-small`, `--gk-t-body`, `--gk-t-lead`, `--gk-t-title`, `--gk-t-number`). Yeniden tasarım her yüzeyi kit ölçeğine taşır; eski token'lar yüzey yüzey boşalır.

**Sonuç:** bir yüzeyi "bitti" saymak için eski dillerden hiçbir kalıntı kalmamalı.

**Ölçüm (4.A.4, 2026-11-13):** `pnpm --filter @astera/ui-audit cli static` raporunun ilk bölümü "Tasarım dili ve ulaşılmamış durumlar" adını taşır. Bölüm, her yüzeyin dosyalarındaki işaretleri dört sütunda sayar:

| Sütun | Neyi sayar |
|---|---|
| v1 | `ui/kit`, `styles.css` ve `chrome.css` sınıfları, bone/dim/faint, eski yazı ölçeği `text-body/label/caption/micro` |
| v2 | `v2/kit`, `v2/*.css` ve `atmosphere.css` sınıfları, `*-v2-*` |
| kendi CSS'i | simülatör, Wiki, arena, giriş, miras, eğitim |
| kit | `game-ui`, `gk-*` |

Aynı tablo, her yüzeyin henüz hiçbir yolla ulaşılamayan durumlarını da listeler. Kod: `packages/ui-audit/src/static.ts` `dialectOf` ve `classDialects`; `inventory.ts` `group` ve `unreached`.

İlk ölçüm `reports/ui-audit/static-2026-11-14.md` dosyasında. Kendi dosyası olan 50 yüzeyin 50'sinde eski dil izi var. Kit izi yalnız Üs'te (30) ve kabukta (2). Ulaşılmamış durum sayısı 66.

**Bitti kuralı:** bir yüzey ancak şu iki koşul birlikte sağlanınca biter:
- bu tabloda v1, v2 ve kendi CSS'i sütunları 0;
- ulaşılmamış durum listesi boş.

Paylaşılan parçalar (`ui/`, `v2/kit/`) bu tabloda sayılmaz; ilk kullanan grupta kite taşınırlar. Tek kelimelik düz bir dize yalnız `className` içindeyse sınıf sayılır, böylece `'name'` gibi veri anahtarları sayılmaz.

## Öncelik: ölçüm puanı (2026-11-11, telefon, tr, yüzeyin en kötü yolu)

Puan = 12 px altı metin + 3 × kontrast hatası + 2 × 44 px altı hedef + tepkisiz hedef + 3 × kesilen metin + 5 × yana taşma (`packages/ui-audit/src/report.ts`). O günden beri değişen tek yüzey Üs (4.1); diğer puanlar geçerli. Görüntüler: `out/ui-envanter/temel-2026-11-11/` (tr telefon, 356 dosya).

| Puan | Yüzey (grup) | En kötü yol |
|---|---|---|
| 2019 | profil (G10): ülke seçici | `gallery:country-picker` |
| 585 | ödüller (G6) | `client:rewards` |
| 472 | klan (G7): yardım | `gallery:clan-aid` |
| 465 | Üs (G2): Filo sekmesi (4.1 öncesi) | `gallery:base-fleet` |
| 363 | savaş tekrarı (G5) | `client:battle-replay` |
| 250 | başlangıç (G15) | `starter:drive` |
| 242 | yerleşme (G4) | `gallery:claim-mine` |
| 235 | aktarma (G4) | `gallery:transfer-radiation` |
| 232 | olay rehberi (G3) | `client:events-guide` |
| 206 | odak (G4) | `gallery:support-focus` |
| 203 / 202 / 201 / 200 | araştırma (G2) / istihbarat (G3) / sohbet (G8) / anıt (G9) | |
| 199 / 193 / 191 / 190 / 188 | arena (G12) / simülatör (G11) / bilinmeyen sinyal (G4) / saldırı (G4) / konvoy (G4) | |
| 182 / 181 / 179 / 174 / 171 / 171 | raporlar (G5) / ticaret (G4) / galaksi HUD (G1) / miras (G10) / mağaza (G6) / dünyalar (G2) | |
| 163–140 | kronik, geri bildirim, menü (G1: 149), duyurular, bildirim merkezi, giriş | |
| ≤ 115 | sıralama, Sessiz Uzay, sezon özeti, klan desteği, Wiki, filo, envanter, bağış, Now çizgisi (74), eğitim, kuyruk, dönüş (67), vuruş, görüş sheet'i, deneme şeridi, galaksiler, zil (46, yer tutucu), göz atma | |

**Sıra kuralı:** grup sırası §4.B'de kalır (önce kabuk: her ekranın çerçevesi). Grup içinde yüzeyler bu puan ve "Oyuncu anı" ağırlığıyla sıralanır. Ölçülmemiş durumlar (her grubun tablosundaki "Durumlar" sütunu) grubun 1. adımında (§4.C incele) görüntülenir.

## G2. Üs, araştırma, tersane, filo, onarım

Okundu: `screens/PlanetScreen.tsx` 182–700 (ekran gövdesi, sekmeler, sheet'ler), 2012–2420 (Filo sekmesi iskeleti), 2747–3106 (`BuildSheet`); `screens/ResearchPanel.tsx` 146–575 (gövde); `screens/RepairStation.tsx` 354–468 (sheet); `screens/FaultSheet.tsx` 126–227; `v2/hud/FleetPage.tsx` 435–534; `screens/WorldsPanel.tsx` 127–275. 4.1'de kite geçen parçalar: `PlanetHero`, `UpgradeRow`, `ItemSheet`, `CoreTierInfo`, `BaseQueues`, `BaseSwitch`, `ColonyAbandonment`, `PlanetRadiationProtection`, `CoreConsent`.

**Üs ekranının sırası (yukarıdan aşağı):** arıza onarımları (varsa) → dünya kahramanı + radyasyon koruması + hedef radyasyon aleti + koloni bırakma → kuyruklar (inşa / tersane / onarım) → toparlanma ya da EMP bandı → 5 sekme (Üretim · İstihbarat · Savunma · Taktik · Filo; arızalı sekme işaretli) → sekmenin "sorun + soru" başlığı ve satırları.

| # | Yüzey | Dosya | Oyuncu anı · karar | Durumlar | Açılış | Dil | Not |
|---|---|---|---|---|---|---|---|
| 1 | Üs anahtarı | `v2/hud/BaseSwitch.tsx` | Üs / Araştırma / Gemi (arena) arasında geçiş | arena kapalıysa 2 seçenek | Üs sheet'inin başı | kit | 4.1 |
| 2 | Üs gövdesi | `PlanetScreen` | "Ne inşa edeyim, ne bozuk?" | yükleniyor (`Waiting`), hata (`Unreachable`), akademi dersi (sekmeler kısıtlı, kahraman yok), toparlanıyor (sekme soluk, tıklanmaz), EMP, arızalı | Dock Üs, ölçer, bağlam kartı, bildirim (sekme + satır odaklı) | kit + v2 | Toparlanma sırasında bütün sekme soluk: neden olduğu bant ile anlatılıyor. |
| 3 | Arıza onarımları | `PlanetScreen` `FaultRepairs` | "Bozuk olanı onar" | yok (çizilmez), bozuk ama onarılmıyor (tek satır), onarılıyor (3 paralel hat) | Üs başı | v2 | |
| 4 | Arıza sheet'i | `screens/FaultSheet.tsx` | "Onarmaya değer mi?" saatlik kayıp, sadakat, fiyat | onarılıyor (geri sayım), hatlar dolu, kaynak yetmiyor | arızalı satır | **v1** (`plate`, `legend`, `text-faint`, v1 `Button`) | Onar düz buton; harcayan eylem → kit kuralı 1 sn basılı tutma. |
| 5 | Sekmeler: Üretim, İstihbarat, Savunma, Filo | `Grow`, `Orbit`, `Defend`, `Reach` | yükseltme kararı | satır durumları `UpgradeRow`'da (kilitli, kuyrukta, yetmiyor, bitti, bozuk) | sekme | kit satırlar + v2 bant | 4.1'de yapıldı; G2'de kabukla birlikte yeniden bakılacak. Filo sekmesi tek sekmede: tersane binaları, hangar alanı, savunma duruşu, klan desteği bölmesi, gövde aileleri, madencilik, uydular → uzun. |
| 6 | Taktik sekmesi | `DeathStarForge`, `InterceptorBattery`, `RadiationBombForgeHost` | stratejik silah üret | kilitli, şarj oluyor, hazır, depo dolu (`CapacityNext`) | sekme | v2 (`HoldButton`, `Cost`, `TacticalStock`) | v2 `HoldButton` → kit `GameHold`. |
| 7 | Gemi üretme (tersane) | `PlanetScreen` `BuildSheet` | "Kaç tane, hangi gövde?" | kilitli (kapı), kuyruk dolu, hangar/zemin dolu, Prospektör sınırı, yetmiyor (ne zaman yeteceği), ders (sabit adet), özel rol (Nullifier, Çöpçü) | gövde satırı | v2 | Uzun yığın: resim kartı + istatistik + metin + özel rol + karşı döngü + adet + alan çubuğu + eksik çubukları. Üret düz buton (harcayan → 1 sn basılı tutma). Kitte `UnitCard`/`UnitBay` hazır ve kullanılmıyor. Yüksek öncelik. |
| 8 | Öğe sheet'i | `ui/ItemSheet.tsx` | bina / alet / uydu yükseltme | kilitli, kuyrukta, bitti, yetmiyor | satır | kit | 4.1 |
| 9 | Çekirdek onayı | `CoreConsent` | tatil sırasında Çekirdek yükseltme uyarısı | — | Çekirdek satırı | kit | 4.1 |
| 10 | Onarım istasyonu kartı | `RepairStation.tsx` `RepairStationCard` | hasarlı gemi sayısı | hasar yok / var / onarımda | Filo sekmesi | v2 | |
| 11 | Onarım istasyonu sheet'i | `RepairStationSheet` | "Hangi gemileri onarayım / hurdaya ayırayım?" | radyasyon uyarısı, onar / hurda, hangar / atölye, seçim eskidi, çok fazla parti, kuyruk dolu, yetmiyor, boş; hurda onayı ve iptal onayı (`Confirm`) | kart, Filo sayfası, bildirim | v2 + v1 `Confirm` | **Tıka basa:** 250 px kahraman + açıklama + 3 istatistik + 2 `Segmented` alt alta + ipucu + seçim düğmeleri + liste + kuyruk + 2–5 satırlık alt bilgi. Owner'ın Klan örneğiyle aynı sorun. Yüksek öncelik. |
| 12 | Araştırma | `screens/ResearchPanel.tsx` | "Sırada hangi araştırma?" | yükleniyor, hata, gemide (kısa merdiven), çalışıyor / boşta, tatilde duraklatılmış | Üs anahtarı, "Çekirdek gerek" yönlendirmesi | v1 + v2 | Önsöz paragrafı + yıldız haritası + seçili kart + hat + 3 küçük metin satırı. 9–10 px yazı yoğun. |
| 13 | Proje sheet'i | `ResearchPanel` `ProjectSheet` | ayrıntı + başlat | kilitli, kuyrukta, bitti | kart | v2 | |
| 14 | Filo sayfası | `v2/hud/FleetPage.tsx` + `FleetHost` | "Gemilerim nerede, kaç tane, geri çağırayım mı?" | Havada (boş / uçuşlar / klan dalgaları / anıtta bekleyen), Evde (dünya başına garnizon, bakıma al), Hangar (alan kuralı + dünya başına); gemide | Dock Filo | v2 | `Segmented` → kit `GameTabs`. Anıt dalgası satırları elle çizilmiş düğme yığını. |
| 15 | Dünyalar paneli | `screens/WorldsPanel.tsx` | "Hangi dünyamda ne var? Kaynak aktar" | tek dünya (aktarma yok), aktif dünya, başkent/koloni | üst bar dünya işareti | **v1** (`plate`, `legend`, `slab`, `field`, v1 `Meter`, `Chip`) | Gönder bölümü iki **yerli `<select>`**: oyun değil form. Yüksek öncelik. |
| 16 | Tatil sheet'i | `screens/VacationSheet.tsx` | — | — | — | — | G10'da |
| 17 | Gemi (arena hangarı) | `HangarPanel` | — | — | Üs anahtarı | — | G12'de |
| 18 | Gemi ekranı (gemideyken) | `VesselScreen` | — | — | — | — | G15'te |

**G2 için ilk gözlemler (koddan):**

1. Üs'ün satırları kite geçti, ama Üs'ten açılan sheet'lerin çoğu (tersane, onarım, arıza, araştırma, dünyalar) hâlâ v1/v2.
2. Kaynak harcayan dört eylem düz butonla yapılıyor (gemi üret, onar, arıza onar, aktar). 2. aşama kuralı: harcayan → 1 sn basılı tutma.
3. Onarım istasyonu ve tersane sheet'i owner'ın Klan örneğindeki "tıka basa" kalıbında. Sekme ya da adım, bilgi kutusu ve kısa metin gerekiyor.
4. Filo sekmesi (Üs içinde) yedi bölümü tek kaydırmada taşıyor. Ayrı Filo sayfasıyla görev paylaşımı yeniden düşünülecek (G2 karar notu).

## G3. İstihbarat

Okundu: `screens/IntelScreen.tsx` 60–260 (gövde, raflar), 274–940 iskelet (raf bileşenleri); `v2/hud/ViewSheet.tsx` iskelet.

| # | Yüzey | Dosya | Oyuncu anı · karar | Durumlar | Açılış | Dil | Not |
|---|---|---|---|---|---|---|---|
| 1 | İstihbarat sayfası | `IntelScreen` | "Komşularım hakkında ne biliyorum, kime saldırabilirim?" | yükleniyor, hata, gemide; raf: Gözetleme / Raporlar / Radar | Dock İstihbarat; bildirim (Raporlar rafı + savaş/sonda) | v2 + v1 (`Clarity`) | **İç içe iki sekme çubuğu:** Raporlar rafının içinde ikinci bir `Segmented` (Sondalar / Savaşlar). |
| 2 | Gözetleme rafı · teleskop rafı | `TelescopeShelf` | teleskop yuvaları neyi izliyor | teleskop yok (alet kartı), boş yuva, kısmi / tam kapsama, radar yok uyarısı, aralıklı görüş notu | raf | v2 | Uyarı ve notlar 9 px. |
| 3 | Gözetleme rafı · işaretli rakipler | `Rivals` | işaretlediğim rakibe git | yok; kayıp işaret | raf | v2 | Menüdeki işaret çipleriyle aynı veri, iki yerde. |
| 4 | Gözetleme rafı · bilinenler | `Known`, `KnownWatch`, `KnownProbe` | bildiğim dünyalar, ne kadar taze | boş; teleskop / sonda satırı; tazelik işareti; açıklama aç/kapa | raf | v2 + v1 `ClarityMark` | |
| 5 | Radar özeti | `RadarGlance` + `DayLine` | son 24 saatte kaç temas | radar yoksa yok | Gözetleme rafının altı → Radar rafı | v2 | |
| 6 | Raporlar · sondalar | `ProbeShelf`, `RangeRow`, `HuntHowTo` | sonda raporu: stok / savunma / gemi aralıkları, benimkiyle kıyas | sonda yok (alet kartı: maliyet), rapor yok, filo evde (keskin) / uzakta (geniş), yakalandı, gemide av ipucu, karakol | raf | v2 | Karar desteğinin kalbi: aralık + "benim değerim" doğru fikir; görsel dili eski. |
| 7 | Raporlar · savaşlar | `screens/BattleReports.tsx` (2472 satır) | savaş listesi ve raporu | | raf, bildirim | | G5'te |
| 8 | Radar rafı | `RadarShelf`, `RadarReach` | radar menzili, uyarı süresi, günün temasları | radar yok, seviyeye göre notlar (yavaş filo, köken) | raf | v2 | |
| 9 | Alet kartı | `Instrument` | eksik aleti kur | — | teleskop / sonda / radar yokken | v2 | "Kur" Üs'ün İstihbarat sekmesine götürür. |
| 10 | Görüş çipi + sheet'i | `v2/hud/ViewSheet.tsx` `ViewChip`, `ViewSheet` | galakside teleskop / radar katmanlarını aç-kapa; olay rehberi | katman açık / kapalı | galaksi köşesi | v2 | Kit `Toggle` adayı. |
| 11 | Galaksi olay rehberi | `screens/GalaxyEventsGuide.tsx` | olaylar nasıl çalışır | | `ViewSheet` | v1 | |

**G3 için ilk gözlemler:** iç içe sekmeler (raf + alt raf) tek düzeye inmeli; uyarılar ve notlar 9 px; teleskop yuvaları ile "bilinenler" aynı konuyu iki listede anlatıyor (karar notunda birleşme düşünülecek).

## G4. Galaksi ve gönderme

Okundu: `galaxy/FocusPanel.tsx` 195–370 (ortak çerçeve `Shell`), 538–1363 iskelet (`PlanetFocus`); dosya haritası aşağıda. Hangi yüzeyin nereden açıldığı §4 ve §5'te.

**Ortak çerçeve (`Shell`, bütün odak kartları):** kapalıyken galaksinin altında tek satırlık ray (üst etiket, başlık, tek olgu, aç oku, kapat ×), altında isteğe bağlı "göz atma" bölümü. Açıkken dock'tan yukarı en çok `65dvh` dosya; eylemler alttaki yapışkan şeritte, sarılarak dizilir. Telefonun geri hareketi önce dosyayı kapatır, sonra seçimi bırakır. Dil: v2. 9 px üst etiket ve özet.

| # | Yüzey | Dosya (satır) | Oyuncu anı · karar | Durumlar | Dil | Not |
|---|---|---|---|---|---|---|
| 1 | Gezegen odağı | `FocusPanel.tsx` `PlanetFocus` (538–1363) | **Oyunun ana karar yüzeyi:** "Bu dünyaya saldırayım mı, sonda mı, yerleşeyim mi?" | keşfedilmemiş; kendi dünyam (`OwnedPlanetFocus`); klan üyesi; tatilde; kalkanlı; menzil (Onur bandı) dışı; Sessiz Uzay; tersane isyanı; uçuş yuvası yok; pencere açık; radyasyon sığınağı | v2 | Açık dosya: stratejik rehber, pencere, radyasyon, `TargetDossier`, rakip geçmişi, kaynağa göre olgular (`FactRow`), boşluk satırları (`GapRow` + `CloseGap`), hedef radyasyon aleti, Ölüm Yıldızı, radyasyon bombası. Eylemler: saldır, sonda, yerleş, aktar, destek gönder, klan hedefi. Engel nedeni düğme etiketinde. Yüksek öncelik, en karmaşık yüzey. |
| 2 | Hedef dosyası | `v2/hud/TargetDossier.tsx` (357) | bildiklerim ve tahmin aralıkları | | v2 | |
| 3 | Ölüm Yıldızı vuruşu | `FocusPanel` `DeathStarSection`, `StrikeSheet` | | engeller (menzil, kalkan, köken toparlanıyor, yuva) | v2 | |
| 4 | Anıt odağı | `MonumentFocus` → `screens/MonumentSheet.tsx` (280) | | | v2 | G9 ile birlikte |
| 5 | Asteroit / madencilik | `FocusPanel` `AsteroidFocus` + `GalaxyView` `AsteroidFocusHost` | "Hangi gemiyle kazayım?" | taahhütler, gemi dinleniyor, eve taşıma, depo dolu | v2 | `CraftPicker` |
| 6 | Enkaz | `DebrisFocus` + `DebrisFocusHost` | enkaz topla | | v2 | |
| 7 | Korsan | `PirateFocus` + `PirateFocusHost` | korsana saldır | | v2 | |
| 8 | Ticaret gemisi | `TradeFocus` → `screens/TradeSheet.tsx` (780) | takas | | v2 | sheet'te 2 `range`, `Segmented`, 2 sayıcı |
| 9 | Galaksiler arası konvoy | `IntergalacticConvoyFocus` → `screens/IntergalacticConvoySheet.tsx` (356) | konvoya baskın | | v2 | |
| 10 | Madencilik uçuşu | `RunFocus` | geri çağır | | v2 | |
| 11 | Uçuş (kendi / gelen) | `ThreadFocus` | geri çağır; anıta odak | | v2 | |
| 12 | Temas | `ContactFocus` | salt okunur | | v2 | |
| 13 | Saldırı gönder | `screens/LaunchSheet.tsx` (449) | "Hangi gemilerle, ne kadar?" | dünya / korsan hedefi | v2 | basılı tutma (v2 `HoldButton`), 2 sayıcı |
| 14 | Aktar | `screens/TransferSheet.tsx` (613) | dünyalar arası kaynak / gemi | | v2 | `range` + 2 sayıcı + basılı tutma |
| 15 | Yerleş | `screens/SettlementSheet.tsx` (148) | koloni kur | | v2 | basılı tutma |
| 16 | Klan desteği gönder | `screens/ClanSupportSheet.tsx` | | | v2 | G7 |
| 17 | Bilinmeyen sinyal | `screens/UnknownSignalHud.tsx` çip + `UnknownSignalSheet.tsx` (140) | "Sinyali araştırmaya gemi göndereyim mi?" | açık (geri sayım) / sonuç (korsan, kaplama) / gemi yok → üret | v2 | köken seçimi **yerli `<select>`**; gönder düz buton |
| 18 | Dünyalar paneli | `WorldsPanel` | | | v1 | G2'de yazıldı |

**G4 için ilk gözlemler:** gönderme sheet'leri zaten basılı tutmayla onaylanıyor (iyi), ama v2 `HoldButton` görünümünde; kit `GameHold` ağırlıkları (harcayan 1 sn, kesin 1,5 sn) uygulanacak. Gezegen odağı bir yüzeyde 10'dan fazla bölüm taşıyor; dosya içinde sekme/bölüm düzeni karar notunda. `FocusPanel.tsx` 4191 satır: yeniden tasarımda bileşenlere bölünmesi bakım için de gerekli.

## G5. Sonuç: rapor, tekrar, kronik, dönüş

Okundu: `screens/BattleReports.tsx` fonksiyon haritası + `ReportSheet` gövdesi (633–1080 iskelet); `battle-simulator/BattleReplayAction.tsx` (tam); `screens/ChronicleScreen.tsx` iskelet; `v2/hud/AwaySheet.tsx` 233–313.

| # | Yüzey | Dosya | Oyuncu anı · karar | Durumlar | Açılış | Dil | Not |
|---|---|---|---|---|---|---|---|
| 1 | Savaş listesi | `BattleReports` | geçmiş savaşlar | boş; okunmamış; stratejik satır (Ölüm Yıldızı, bomba) | İstihbarat › Raporlar › Savaşlar | v2 | |
| 2 | Rapor kapısı | `BattleReportDoor` | bildirimden tek rapora; yoksa listeye | | `report` paneli | v2 | |
| 3 | Savaş raporu | `BattleReports` `ReportSheet` | **"Ne oldu, neden, şimdi ne yapayım?"** — sonuç yeni istihbarat üretir | kazandı / kaybetti / berabere; korsan; ortak savaş (klan); savunma hattı; boş geçiş; gemi ele geçirildi; kalkan etkisi; Hakimiyet dökümü; ganimet; sadakat darbesi | liste, bildirim, zil | v2 | **Tek kaydırmada 15+ bölüm:** tekrar düğmeleri, hüküm, yerler, neden, dönüm noktası, onların tahtası, benim gücüm, kayıplar, turlar (tur başına hesap + atış kartı), formül (`details`), Hakimiyet dökümü, sonuçlar, klanlar. Sekme (Özet / Kuvvetler / Turlar / Sonuç) adayı. "Tekrar saldır" → hedef dosyası. Yüksek öncelik. |
| 4 | Stratejik rapor | `StrategicReportSheet` | Ölüm Yıldızı / bomba sonucu | | stratejik satır | v2 | |
| 5 | Savaş tekrarı | `battle-simulator/BattleReplayDialog.tsx`, `BattleReplay.tsx`, `BattleStage.tsx` (3D) | savaşı izle | kayıt yok / güç yetersiz / çok büyük; yükleniyor; yüklenemedi (yeniden yükle) | raporun "Savaşı izle ▷" | v2 + `simulator.css` | ▷ ve ↗ düz karakter. G11 simülatörüyle aynı sahneyi paylaşır. |
| 6 | Simülatörde dene | `SimulatorHost` | aynı kuvvetleri simülatörde dene | | raporun "Simülatörde dene ↗" | | G11 |
| 7 | Anıt raporu | `screens/MonumentReportSheet.tsx` (88) | | | | v2 | G9 ile |
| 8 | Kronik | `screens/ChronicleScreen.tsx` (245) | galakside ne oldu | yükleniyor, hata, boş | zil › Kronik | **v1** (`ui/kit` `Button`, `EmptyState`, `Waiting`) | |
| 9 | Dönüş hikâyesi | `v2/hud/AwaySheet.tsx` | "Ben yokken ne oldu?" | gemide ayrı hikâye; kahraman satır + satırlar + gözlemler + onarım bakımı | otomatik | v2 | Owner'ın 'Ne oldu acaba?' hedefinin karşılandığı an; sunumu düz liste. Yüksek öncelik (yeniden katılım). |

## G6. Ödüller, mağaza, envanter, kozmetik

Okundu: `screens/RewardsScreen.tsx` iskelet; `SkinsScreen`, `SkinInventoryScreen`, `DonateScreen` iskelet; dil sayımı (v1/v2/kit) aşağıdaki tablodaki her dosya için.

| # | Yüzey | Dosya (satır) | Oyuncu anı · karar | Durumlar | Açılış | Dil | Not |
|---|---|---|---|---|---|---|---|
| 1 | Ödüller | `RewardsScreen` (225) | "Ne kazandım, al" | yükleniyor, hata, boş; sosyal kart (adımlar, sürekli / bekliyor / alındı); hedef zincirleri (açık / katlı, alınabilir önde), aşama satırları, taşma uyarısı (başkente gider) | üst bar 🎁, menü | v2 (`v2/kit/Surface` `Button`, `Plate`) | **Ödül alma düz buton.** Kitte `RewardPod` (kapsül açılma animasyonu) hazır ve kullanılmıyor: CLAUDE.md §4.6 "önemli an kendine özgü sunum". Yüksek öncelik (ilk oturumda oyuncunun gördüğü ilk ödül anı). |
| 2 | Mağaza (kaplamalar) | `SkinsScreen` (482) | "Hangi görünüm, ne kadar?" | gezegen kategorisi (önizleme 15 rem, koleksiyon, paket) / diğer kategoriler (`CosmeticCollection`); web / uygulama; deneme | menü, üst bar Mağaza, sinyal sonucu | v2 + 2 v1 izi | Kategori gezinmesi `CosmeticNavigation` |
| 3 | Envanter | `SkinInventoryScreen` (205) | sahip olduklarımı giy | boş (mağazaya git), gezegen başına görünüm çipleri, bekliyor | menü, mağaza | v2 + 1 v1 izi | |
| 4 | Kozmetik koleksiyonu / önizleme / gezinme | `CosmeticCollection` (97), `CosmeticPreview` (62), `CosmeticNavigation` (33), `SkinPreview` (73), `ShipSkinDrive` (18) | | | mağaza, envanter | v2 | |
| 5 | Ödeme | `ShopierCheckout` (94) | satın al | | mağaza | v2 | Polar / Shopier akışı; sunucu kuralı değişmez. |
| 6 | Deneme şeridi | `CosmeticTrialBar` (30) | denediğim kaplamayı al / bırak | | galakside, deneme sırasında | v2 | |
| 7 | Mağaza vitrini (menüde) | `shell/ShopShowcase` (73) | | | menü | v2 | G1 menüsüyle birlikte |
| 8 | Destek ol | `DonateScreen` (222) | bağış | web / uygulama (adres satırları, destek kartları) | menü | v2 | |
| 9 | Komutan Mirası ödül açılışı | `legacy/AwardReveal` (295), `AwardScene` (157), `AwardStage` (82), `AwardSheet` (164), `AwardTile` (73), `LegacyPeek` (190) | ödül / unvan açılış anı | sırada bekleyen açılışlar | otomatik (`LegacyRevealHost`), profil | v2 + `legacy.css` | Kendi sahnesi var; kit ödül dili (`RewardPod`, ışın) ile birleşmeli. Envanterde `legacy` yüzeyi G10'da (profil ve vitrinle tek yüzey); kit ödül dili G6'da kurulur, açılış G10'da ona taşınır. |

## G7. Klan (owner örneği)

Okundu: `screens/ClanScreen.tsx` fonksiyon haritası, 100–330 (gövde ve dallar), 312–617 ve 1559–1946 iskelet (dışarıdan bakış, yardım paneli); diğer klan dosyalarında dil sayımı.

**Dallar:** yükleniyor / hata / **dışarıda** (`ClanOutside`: başlık, faydalar, klan kur, klan profilleri, katıl) / **üye** (`ClanHeader` + Genel sekmesinde arena takım paneli + 5 sekme: Genel · Güç · Üyeler · Yardım · Savaş).

| # | Yüzey | Dosya (satır) | Oyuncu anı · karar | Durumlar | Dil | Not |
|---|---|---|---|---|---|---|
| 1 | Dışarıda | `ClanOutside`, `ClanBenefits`, `FoundClan`, `ClanProfile` | "Klana gireyim mi, kurayım mı?" | davet, başvuru, klan kur (ad / etiket girişi) | v2 | uzun tanıtım + faydalar + form + liste tek sayfada |
| 2 | Klan başlığı | `ClanHeader` | klanım: ad, etiket, rolüm | lider / üye | v2 | |
| 3 | Genel | `ClanOverview`, `ClanSeats`, `ClanStandings`, `ClanEventRow` | klanın durumu, sıralaması, olaylar | olgun klan (olaylar) / yeni | v2 | arena takım paneli üstte |
| 4 | Güç | `ClanStrengthPanel`, `ClanStrengthView` | klanın gücü | | v2 | |
| 5 | Üyeler | `ClanMembers` | üyeler, roller, yönetim | lider eylemleri, onay (`Confirmation`) | v2 | |
| 6 | Yardım | `ClanAidPanel` (1559–1946) | kaynak isteği / bağış / limit | uyum sağlıyor (bekleme), istek formu, limit, kalan | v2 | **Owner'ın gösterdiği yer:** `Plate` içinde `Plate` (içe gömülü `sunk`), istek formu **3 yerli `<select>`** (`SelectField`), kaynak rakam blokları alt alta. |
| 7 | Savaş | `ClanWarPanel` (506) | klan savaşı | hata, veri | v2 + 1 v1 | basılı tutma var |
| 8 | Klan bayrağı | `ClanBanner` (294) | | | v2 | |
| 9 | Bağış sheet'i | `ClanDonateSheet` (111) | | | v2 | |
| 10 | Dalga sheet'i | `ClanWaveSheet` (228) | | | v2 | basılı tutma |
| 11 | Destek gönder | `ClanSupportSheet` (244) | | | v2 | basılı tutma |
| 12 | Savunma duruşu + destek bölmesi | `ClanSupportBay` (271) `DefencePostureCard`, `ClanSupportBay` | gelen destek, duruş anahtarı | | v2 | Üs › Filo sekmesinde duruyor (G2 ile ortak) |
| 13 | Klan sohbeti | `ChatScreen` klan kanalı | | | | G8 |

**G7 için ilk gözlemler:** owner'ın tarifi kodda doğrulandı: kart içinde kart, form alanları yerli `select`, uzun metin blokları. Yardım sekmesi kendi içinde en az üç iş taşıyor (istek, bağış, limit); sekme ya da adım gerekecek.

## G8. İletişim

Okundu: `screens/ChatScreen.tsx` iskelet + 235–266 (dil seçimi); `v2/shell/ChatHost.tsx` (tam, G1); diğerlerinde dil sayımı.

| # | Yüzey | Dosya (satır) | Oyuncu anı · karar | Durumlar | Dil | Not |
|---|---|---|---|---|---|---|
| 1 | Sohbet | `ChatScreen` (1095) + `ChatHost` | konuş, rakibi tanı, klanla plan | kanal: Genel / Klan / DM (`Segmented`); gemide yalnız Genel; okunmamış; sessize alınmış gizli; yönetici klan kanalı; medya ekleme (yönetici); tepki listesi; klan olay satırı; klavye açık | v2 | Genel kanalın dil seçimi **yerli `<select>`** → kitte `LanguagePicker` hazır. Yönetici klan kanalı da `<select>`. |
| 2 | DM paneli | `ChatScreen` `DmPanel` | özel mesaj | | v2 | |
| 3 | Medya, tepkiler | `ChatMediaAttachment` (111), `ChatMediaComposer` (97), `ChatReactionRoster` (73) | | | v2 | |
| 4 | İçerik bildir | `ContentReportSheet` (61) | mesaj / oyuncu bildir | | v2 | 2 yerli `<select>` |
| 5 | Sessize alınanlar | `ChatHost` içi sheet | | boş / liste | v2 | G1'de |
| 6 | Engellenenler | `CommunityBlocks` (66) `BlockedPlayersSheet` | | | v2 | |
| 7 | Topluluk kuralları | `CommunityPolicy` (59) | | | v2 | |
| 8 | Duyurular | `AnnouncementsScreen` (70) | | okunmamış | **v1** | |
| 9 | Geri bildirim | `FeedbackScreen` (88) | | | **v1** + `Segmented` | |
| 10 | Bildirim Merkezi | `NotificationCenterSheet` (379) | "Saldırı olursa haberim olsun mu, ne kadara?" | kurulu değil, boş cüzdan, kapsıyor; zamanlama | v2 + 1 v1 | menüdeki kartla açılır |

## G9. Sıralama, sezon, anıtlar

Okundu: `screens/SeasonArchiveScreen.tsx` fonksiyon haritası + 66–176 (gövde); diğerlerinde dil sayımı.

| # | Yüzey | Dosya (satır) | Oyuncu anı · karar | Durumlar | Dil | Not |
|---|---|---|---|---|---|---|
| 1 | Sıralama sayfası | `SeasonArchiveScreen` (1320) | "Neredeyim, kimi geçebilirim, ne kazanırım?" | yatay sezon şeridi (canlı + geçmiş; kaydırdıkça yüklenir), yükleniyor, hata | **v1 ağırlıklı** (78 v1 token) | |
| 2 | Canlı sıralama | `LeaderboardScreen` (330) + `ui/SeasonRewardBoard` (232) | sıram, ödül merdiveni | Onur / Hakimiyet; ben | v1 + v2, `Segmented` | ödül tahtası sıralamanın üstünde |
| 3 | Geçmiş sezon | `ArchivedLeaderboard`, `GalaxyRecordPanel`, `RecordNotices` | | dondu / silindi; kayıt eksik (eski sezonlar) | v1 | |
| 4 | Komutan profili (arşiv) | `CommanderProfile` + `SeasonStats`, `CareerStats`, `HullBreakdown`, `ResourceStats`, `ComparedStat`, `LeadCard`, `HeroFigure` | bir komutanın sezonu ve kariyeri | `Segmented` sekmeler | v1 | büyük istatistik yığını |
| 5 | Sezon özeti | `SeasonRecap` (316) | sezon bitti: ne yaptım | | **v1** | menü, sezon sonu |
| 6 | Sonraki sezon | `ui/NextSeason` (39) | sezon dondu, sıradaki ne zaman | | v1 | galaksi katmanı |
| 7 | Anıt sheet'i | `MonumentSheet` (280) + `MonumentBattleRules` (21), `MonumentRoutePreview` (36) | anıta dalga gönder | zor / kolay; dalga beklemede | v2 | 4 basılı tutma |
| 8 | Anıt raporu | `MonumentReportSheet` (88) | | | v2 | |

## G10. Hesap

Okundu: `shell/ProfilePage.tsx` (gövde); diğerlerinde dil sayımı.

| # | Yüzey | Dosya (satır) | Oyuncu anı · karar | Durumlar | Dil | Not |
|---|---|---|---|---|---|---|
| 1 | Profil (Hesap) | `shell/ProfilePage` (122) | kimliğim, ayarlarım | | v2 + v2 `Button` | komutan kartı, tatil, güvenlik, hesap silme, ülke, miras, çıkış |
| 2 | Komutan kartı | `v2/hud/CommanderCard` (111) | sıra, Onur, dünyalar, kalkan, gün | | v2 | |
| 3 | Komutan Mirası profili | `legacy/LegacyProfile` (271), `ShowcaseEditor` (65), `ShowcaseShelf` (111) | vitrinim | `Segmented` | v2 + 3 v1 | |
| 4 | Ülke seçici | `CountryPicker` | | | v2 | |
| 5 | Tatil | `VacationSheet` (110) | tatile çık | | v2 + 1 v1 | |
| 6 | Hesap güvenliği / şifre / silme | `AccountSecuritySheet` (96), `PasswordResetSheet` (60), `AccountDeletionSheet` (62) | | | v2 | |
| 7 | Sessiz Uzay dönüşü | `shell/SilentSpaceNotice` (90) | 30 saat emir yok: geri dön | | **v1** | `return` paneli |
| 8 | Galaksi seçimi | `screens/ServersScreen` (247) | hangi galaksiye gireyim | geçen sezon sonucu, hata | **v1** | uygulama katmanı 11 |

## G11. Wiki, Akademi, simülatör

Okundu: dosya haritası ve dil sayımı. Ayrıntılı okuma grubun sırası gelince.

| # | Yüzey | Dosya (satır) | Dil | Not |
|---|---|---|---|---|
| 1 | Wiki | `screens/WikiScreen` (54) + `wiki/WikiContent.tsx` (112) + içerik dosyaları (`wiki/*.ts`) | kendi `wiki-*` CSS'i | **Dördüncü dil.** Owner: oyuncular Wiki'yi açmıyor; kural yalnız orada ise anlatılmamış sayılır. Bot ifadesi yasağı burada da geçerli. |
| 2 | Akademi menüsü | `MenuPanel` › Akademi | v2 | G1'de |
| 3 | Savaş simülatörü | `battle-simulator/BattleSimulator` (141), `SimulatorDialog` (37), `SideEditor` (94), `UnitInspector` (48), `SimulationNumberInput` (25), `BattleBalance`, `RetreatRoster`, 3D `BattleStage` | kendi `simulator.css`'i (`sim-*`) | **Beşinci dil.** Tam ekran (`?simulator=1`), menü karosu, rapordan "dene". |

## G12. Savaş Alanı (arena)

Okundu: dosya haritası. `src/arena` 50 dosya, 17 bileşen; kendi `arena.css`'i (altıncı dil), kendi HUD'u.

| # | Yüzey | Dosya (satır) |
|---|---|---|
| 1 | Giriş kapısı | `ArenaGate` (44) |
| 2 | Kum havuzu / maç | `Sandbox` (579), `Hud` (198), `Controls` (306), `PingWheel` (116), `MapSheet` (124), `LoopLine` (14), `SpectatorPanel` (27) |
| 3 | Seçiciler | `ModePicker` (22), `ClassPicker` (84), `GraphicsPicker` (14) |
| 4 | Takım | `TeamPanel` (184) (klan Genel sekmesinde de) |
| 5 | Hangar | `Hangar` (83), `hangar/HangarPanel` (232), `HangarStage` (279), `ShipDesk` (336) (Üs anahtarı › Gemi) |
| 6 | Emeği geçenler | `credits.tsx` (20) |

Not: arena gerçek zamanlı; HUD'un dokunma ve okunma kuralları (başparmak alanı, hareket halinde okuma) ayrı incelenecek. `docs/komutan-gemisi/README.md` okunacak.

## G13. Giriş, kayıt, halka açık sayfalar, hata ekranları

| # | Yüzey | Dosya (satır) | Dil | Not |
|---|---|---|---|---|
| 1 | Web giriş sayfası | `landing/public/PublicLanding.tsx`, `PublicLandingScreen.tsx`, `WebLandingGate.tsx` (30), `ConsentPlacement.tsx`, `public-landing.css` | kendi CSS'i | Owner kararı (2026-10-18): yalnız bu CSS'te hareket tercihi (reduced motion) dikkate alınır. `docs/landing-premium-redesign-2026-10-18.md`. |
| 2 | Uygulama giriş ekranı | `screens/LandingScreen` (423) + `landing/LandingScene.tsx` (466, 3D) | v2 + `landing-*` | güvenlik uyarısı, e-posta, hata, açık dialog |
| 3 | Giriş / kayıt dialogu | `screens/LandingAuthDialog` (214) | v2 + 1 v1 | |
| 4 | Yükleniyor | `shell/LoadingScreen` (51) | `landing-*` | bağlantı; galakside tarama / harita / yükseltme örtüsü |
| 5 | Bakım | `shell/MaintenanceScreen` (67) | v1 + v2 | |
| 6 | Sürüm eski | `shell/UpdateRequired` (40) | v1 | |
| 7 | Hata sınırı | `shell/ErrorBoundary` (173) | v1 | çökme ekranı |
| 8 | Engellendi | `App.tsx` katman 12 | web: `LandingScreen`; uygulama: düz `main` | uygulamadaki hâli çıplak |
| 9 | Marka quiz'i / yükleme kartı | `brand/BrandQuiz` (60), `brand/RecallHost` (114) | `brand-*` | |
| 10 | Halka açık sayfalar | `public/*.html` (22: TR/EN çiftleri; fiyatlar, gizlilik, çerez, KVKK, koşullar, iade, iletişim, hakkında, hızlı başlangıç, topluluk kuralları, hesap silme, ödeme) | düz HTML + CSS | |

## G14. Yönetim paneli (oyuncu görmez, en son)

`screens/AdminPanel`, `AdminPlayersPanel`, `AdminContentReports`, `AdminReportMedia`, `AdminDeletionQueue`, `AdminShopierQueue`, `AdminStarterPanel`, `AnalyticsAdminPanel` (toplam 1274 satır). v1 ağırlıklı.

## G15. Başlangıç yolculuğu (owner: en sona)

| Parça | Dosyalar |
|---|---|
| Prolog | `onboarding/prologue/Prologue.tsx`, `Handbook.tsx` |
| Eğitim kapısı | `onboarding/TrainingDoor.tsx`, `ClaimDialog.tsx`, `Gate.tsx`, `TutorialHand.tsx`, `BeatCard.tsx` |
| Uçuş okulu | `onboarding/flightSchool/FlightSchool.tsx`, `SchoolCamera`, `SchoolCoach`, `SchoolHighlight`, `SchoolLookHint`, `SchoolPointer` |
| Başlangıç galaksisi | `starter/*` (22 bileşen: `VesselScreen`, `ShipHero`, `ShipLog`, `RepairCard`, `RepairSlots`, `YardDeck`, `CrateBay`, `DepartureBoard`, `JumpCall`, `LandingChoice`, `MainGalaxyRow`, `MigrationPanel`, `ObjectiveLine`, `OutpostOutcome`, `OutpostReading`, `PartHere`, `SystemTabs`, `TempoNote`, `UniverseChip`, `UnlockMoment`, `ArrivalHost`, `StarterPreview`), kabuktaki `StarterGoalPulse`, `StarterTutorialCoach`, `StarterAftercare`, `JumpScene`, `MigrationSequence` |
| Eski Akademi (canlıda yok) | `onboarding/Academy.tsx`, `Rehearsal.tsx`: hiçbir canlı dosya içe aktarmıyor; ölü kod adayı (§3.2 sonu) |

## Paylaşılan arayüz parçaları (`ui/`)

Ölçüldü (2026-11-13): satır, kaç canlı dosyanın kullandığı, dil. Bir parça kite geçince kullanan her ekran birden düzelir; bu yüzden grup işinin içinde, ilk kullanan grupta ele alınır.

| Parça | Satır | Kullanan | Dil | Kit karşılığı (aday) | İlk grup |
|---|---|---|---|---|---|
| `Toast` | 166 | 33 | v2 | yok → **kit boşluğu** | G1 |
| `AtmosphereArt` | 23 | 11 | — | `Plate` / `CutPlate` sanatı | G1 |
| `QuantityStepper` | 194 | 10 | v1 + v2 | yok → **kit boşluğu** (sayıcı) | G2 |
| `RankingScores`, `HonorSoloNotice`, `HonorBenefits`, `HonorBattleSummary`, `HonorTargetCard` | 20–92 | 1–7 | v2 | `HonorBadge`, `StatPlaque` | G9 / G4 |
| `marks` (`FaultMark` vb.) | 81 | 6 | v1 | `Glyph` | G2 |
| `UpgradeRow` | 916 | 6 | kit (+ v1 izi) | — | 4.1 |
| `RadiationPreview`, `RadiationIndicator`, `TargetRadiationInstrument`, `ShipRadiationProtection`, `PlanetRadiationProtection` | 18–74 | 1–6 | v2 / kit | `StatusChip`, `ProgressBar` | G2 / G4 |
| `Tally`, `Rungs`, `Medal`, `PlanetSigil`, `ClanTag`, `PerkArt` | 19–159 | 2–5 | — / v1 | `LevelBadge`, `Emblem`, `ClanEmblem` | G7 / G9 |
| `SpendBar`, `CapacityBar`, `SurvivorBar`, `FlightBar` | 131–168 | 1–5 | v1 | `SpendBar`, `CargoBar`, `ProgressBar` (kitte var) | G2 / G4 |
| `CounterMark` (`CounterCycle`) | 260 | 5 | v1 | `MultiplierBadge` | G2 |
| `Action` | 570 | 5 | v1 + v2 | `GameButton` / `GameHold` | G2 |
| `PaceRow`, `EscortRow`, `FlightEscort`, `EscapeReadout`, `BattleEnemyFleet`, `BattleRetreatNote`, `DistributedFireRules`, `PirateProfitCard` | 13–115 | 1–3 | v2 | `ListRow`, `StatPlaque` | G4 / G5 |
| `QueueStrip` | 273 | 2 | v1 | `QueueSlot` | G2 |
| `ShipHealthInventory` | 68 | 2 | v2 | `UnitCard` | G2 |
| `FleetCards` | 160 | 1 | v1 | `UnitCard` / `UnitBay` | G4 |
| `RichContent` | 120 | 2 | v1 | — | G8 |
| `SeasonRewardBoard`, `SeasonRewardReceipt` | 26–232 | 1 | v1 / v2 | `RewardPod` | G9 |
| `LanguageSwitch` | 29 | 3 | v2 | `LanguagePicker` (kitte var) | G1 |
| `FpsReadout`, `hitboxDebug` | — | — | — | geliştirici; kapsam dışı | — |

**Kitte olmayan, sık kullanılan parçalar (kit boşluğu adayları, ilk kullanan grupta önce kite eklenir):** tost (`Toast`), sayıcı (`QuantityStepper`), aralıklı okuma (`RangeRow`/aralık çubuğu, G3), onay dialogu (`Confirm`: kitte `Dialog` var, uyumu bakılacak), sekme içi seçim (iki seçenekli `Segmented` → `GameTabs` ya da `Lever`), ülke / bayrak seçici.

**Canlıda kullanılmayan (yalnız testler):** `ui/RangeBand.tsx`, `ui/Clarity.tsx` (İstihbarat `v2/kit/Freshness` kullanıyor). Ölü kod adayı listesine eklendi.

**Kalan küçük dosyalar ve gruplar:** `screens/RadiationBombControls` (G2 Taktik, G4), `screens/securityFields` (G10), `screens/faultScope` (G2, çizimsiz bağlam), `shell/ConsentNotice` (G13; çerez / analitik onayı, menü Ayarlar'dan yeniden açılır), `shell/ShopShowcasePoster` (G6), `v2/hud/ReportScene` (G5), `v2/hud/ResearchConstellation` (G2), `brand/FullscreenButton`, `brand/Install`, `brand/OpeningScene`, `brand/Preview` (G13), `onboarding/prologue/ShipScene` (G15).

## v2 kitinin parçaları (`v2/kit`, `v2/identity`) ve oyun kitindeki yerleri

Ölçüldü (2026-11-13). `Sheet` çerçevesi kalır (başlığı 4.1'de kite geçti); diğerleri kullanan yüzey yeniden tasarlandıkça boşalır. Son kullanıcı gidince parça silinmek üzere owner'a listelenir.

| v2 parçası | Satır | Kullanan | Oyun kitinde | Not |
|---|---|---|---|---|
| `Sheet` | 334 | 46 | `SheetFrame` + mevcut çerçeve | çerçeve davranışı (detent, geri, odak) korunur |
| `Surface` (`Button`, `Plate`, `EmptyState`, `PriceTag`…) | 272 | 42 | `GameButton`, `Plate`, `EmptyState`, `CostLine` | |
| `HoldButton` | 134 | 18 | `GameHold` (ağırlık 0,6 / 1 / 1,5 sn) | |
| `Segmented` | 80 | 14 | `GameTabs`, `Lever` | |
| `ClassEmblem` | 38 | 12 | `Emblem` / sınıf rozeti | sınıf renkleri kıyası (plan §4.E) |
| `Flag` | 29 | 11 | `flagTileSrc` / bayrak karosu | |
| `Cost` | 37 | 7 | `CostLine` | |
| `Toggle` | 40 | 6 | `Toggle` | |
| `QueueLane`, `QueueSheet` | 130, 141 | 6, 3 | `QueueSlot` | |
| `ChoiceChips` | 60 | 4 | `Chip` | |
| `Figure`, `SignalBars`, `ChargeTally`, `StoreBar`, `RoomBar`, `NeedBar`, `ResourceMeter` | 18–109 | 1–3 | `StatPlaque`, `RangeBars`, `StoreGauge`, `CargoBar`, `SpendBar`, `ResourceHud` | |
| `MatchupLine`, `ForceRuler` | 124, 222 | 2 | `MultiplierBadge`, yok → bakılacak | savaş kıyas çizgisi |
| `Freshness` (`AgeStamp`, `ClarityMark`) | 108 | 2 | yok → **kit boşluğu** (tazelik damgası) | G3 |
| `CountryPicker` | 51 | 2 | yok → **kit boşluğu** | G10 |
| `StarField` | 93 | 2 | — | dekor |

## 3D sahne (`galaxy/`, ~90 dosya)

Arayüz yüzeyi değil, oyun dünyası: gezegenler, filolar, uçuşlar, efektler (`NukeBlast`, `EmpStorm`, `StrategicBlast`, `DeathStarImpact`, `CoreLevelUps`, `ScanReveals`, `MiningDig`, `JumpStreaks`…), işaretler (`FaultMarks`, `PartMarks`, `SensorRings`, `AlarmRings`, `RankBadge`, `CommanderShipLabel`). Bu envanterin satırı değil; her grubun "sonuç dünyada görünsün" adımında ilgili sahne parçası birlikte ele alınır (plan §4.E VFX dağılımı). Sahne üstündeki **etiket ve işaretler** (`RankBadge`, `CommanderShipLabel`, `OutpostGuide`, `UnknownSignalGuide`, `TargetMapPreview`) arayüz sayılır ve G4'te bakılır.

## 4. Galaksi: odak ve katmanlar

Okundu: `GalaxyView.tsx` 1490–1990.

**Odak (galakside bir şeye dokununca; `focus.kind`)** — hepsi aynı kalıp: önce kısa ray (rail), `detail` ile açılan geniş sayfa (`open`/`onToggle`), `close`:

| `focus.kind` | Bileşen | Eylemler | Grup |
|---|---|---|---|
| `planet` | `PlanetFocus` (+ `TargetDossier` ayrıntı) | saldır → `LaunchSheet`; aktar → `TransferSheet`; yerleş → `SettlementSheet`; destek gönder → `ClanSupportSheet`; klan hedefi işaretle; Ölüm Yıldızı; teleskop kur → Üs | G4 |
| `monument` | `MonumentFocus` → `MonumentSheet` | incele; klan hedefi (lider) | G9 |
| `debris` | `DebrisFocusHost` | enkaz toplamaya gönder | G4 |
| `asteroid` | `AsteroidFocusHost` | madenciliğe gönder | G4 |
| `tradeShip` | `TradeFocus` → `TradeSheet` | ticaret konvoyu | G4 |
| `intergalacticConvoy` | `IntergalacticConvoyFocus` → `IntergalacticConvoySheet` | konvoya baskın | G4 |
| `run` | `RunFocus` | madencilik uçuşunu geri çağır | G4 |
| `thread` | `ThreadFocus` | filoyu geri çağır; anıta odaklan | G4 |
| `contact` | `ContactFocus` (salt okunur) / `PirateFocusHost` (korsan) | korsana saldır → `LaunchSheet` | G4 |

**Galaksinin üstündeki katmanlar:** `GalaxyReadout` (sağ üst, bulunabilir hedefler), `HomeChip`, `ViewChip` → `ViewSheet` (teleskop/radar katmanları) → `GalaxyEventsGuide`, `UniverseChip`, `MainGalaxyRow` (başlangıç: ana galaksiye yol), `NextSeason` (sezon dondu), sohbet düğmesi, `ContextSlot` (bağlam kartı: saldırı > olaylar > öneri), başlangıçta alt blok (`OutpostOutcome`, `JumpCall`, `UnlockMoment`/`ObjectiveLine`), `CosmeticTrialBar`, `LegacyRevealHost` ve `CommanderLegacy`, `SilentSpaceNotice`, örtü `LoadingScreen` (tarama/harita/yükseltme), `FpsReadout` ve `HitboxLegend` (geliştirici, kapsam dışı).

## 5. Eylem sheet'leri

| Sheet | Açan | Grup |
|---|---|---|
| `LaunchSheet` (dünya / korsan) | `PlanetFocus` saldır, `PirateFocusHost` | G4 |
| `TradeSheet` | `TradeFocus` | G4 |
| `IntergalacticConvoySheet` | `IntergalacticConvoyFocus` | G4 |
| `SettlementSheet` | `PlanetFocus` yerleş | G4 |
| `WorldsPanel` | dünyalar isteği (kabuk) | G2 |
| `TransferSheet` | `PlanetFocus` aktar, `WorldsPanel` | G4 |
| `ClanSupportSheet` | `PlanetFocus` destek gönder | G7 |
| `BattleReportDoor` | `report` paneli | G5 |
