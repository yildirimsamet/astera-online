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

**Yapıldı (2026-11-14, `e4fa9c3b`):** `useAirborne`, `AirborneItem`, `FlightMark` ve `StripFocus` artık `lib/airborne.ts` içinde; davranış değişmedi. `shell/PendingStrip.tsx` (`PendingStrip`, `FlightList`) ölü kod aday listesinde.

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

**G1-d1 bağlam kartı ✅ (2026-11-14).** Oyuncunun anı: galaksiye bakarken "şu an bilmem gereken tek şey ne?" Ekranın altında tek kart durur: önce gelen saldırı, yoksa galaksi olayı, yoksa tek öneri. Kural (`contextSlot`) ve kapatılan kartların hafızası değişmedi; kartın kendisi kitin diline geçti.

Önce kite eklenenler (galeri: `ui-kit` "Bağlam kartı" bölümü):
- `ContextCard`: kesik köşeli plaka, rengi kimin olduğundan. Başlıkta halka içinde işaret, üst satırda ne olduğu, altında büyük süre ("9 dk 00 sn sonra iner"). Halka zamanı bilinen bütün üzerinde boşalır. Yalnız düşmanda nabız atar: her zaman kıpırdayan kart okunmaz. Başlığın sağında yuvarlak düğmeler (bak, katla, kapat), altta ad, tek cümle ve eylem satırı. Kart aşağıdan yükselerek gelir.
- `ContextStrip`: katlanmış öneri; tek satır, tek basış, kendi renginde.
- Satır (`gk-crow`): birden çok olay aynı kartta, her biri kendi "Göster" düğmesiyle.

Kartlar:
- Saldırı: siren, düşmanın galaksinin gördüğü uçuşu üzerinde boşalan halka, "Savunmayı hazırla" (kalkan işaretli kırmızı düğme). Görüşteki saldırıya başlıkta göz düğmesi ("Ona bak"). İki düğme yan yana yalnız Japoncada tek satıra sığıyordu; alt alta durunca kart 175 px yerine 227 px oluyor, galaksinin üçte birini kapatıyordu. Göz, katla düğmesiyle aynı desende başlığa çıktı; eylem satırı her dilde tek düğme.
- Olay: tekse kendi işareti (yağmur göktaşı, tüccar ve konvoy sandık) ve penceresi üzerinde boşalan halka; birden çoksa yıldız. Kalan süre gövdede yazdığı için başlıkta tekrar edilmez. Tüccarın kuru resimlerle çizilir (kitin maliyet satırı, aralarında sessiz "="); kalan süresi diğer olaylarla aynı yazıda.
- Öneri: türüne göre (tehdit uyarı, fırsat hedef); katlanınca şerit, tercih cihazda kalır.
- Seçim açıkken bekleyen saldırı: kırmızı durum çipi, siren ve sayı (eskiden kılıç; saldırı her yerde sirenle çizilir).

Bulunan ve düzeltilen hata: seçim açıkken saldırı çipi galaksinin `top-2` noktasına konuyordu. G1-b'den beri durum satırı galaksinin üstünde yüzdüğü için çip kalkan çipinin altında kalırdı. Artık köşeler gibi yüzen satırların ölçülen yüksekliğinden (`--v2-float-h`) başlıyor. Zil ve sohbet, kart yokken 8 px'ten, kart varken 12 px'ten duruyordu; ikisi de 12 px'lik ana boşlukta.

Kontrast: kırmızı plakada kırmızı üst satır 3,97:1'de kalıyordu; düşman kartında ve şeridinde bir ton açık kırmızı (`--gk-hostile-hi`) kullanılıyor.

Galeriye iki yol eklendi (`context-suggestion`, `context-selected`); saldırı yolu artık görüşteki bir saldırı (halka ve göz düğmesiyle).

Ölçüm (`reports/ui-audit/g1d-after-2026-11-14.md`, 5 yol × 6 dil × 3 boyut), aynı üç yolun G1-b ölçümüne göre telefonda: 12 px altı metin 34 → 0, kontrast hatası 2 → 0, 44 px altı hedef 10 → 0, tepkisiz hedef 5 → 0, kesilen metin 0.

Yerel oyunda 350 px'te galaksi açıldı; hesabın o an saldırısı, olayı ya da önerisi yoktu, kart çizilmedi ve zil ile sohbet alt köşede tek başına duruyordu. Kartın kendisi galeride, oyunun alt menüsüyle aynı yerleşimde denetlendi. Saldırı gelince ses zaten var (canlı uyarı tostu "alert" çalıyor); titreşim tost birimine (G1-d3) bırakıldı.

**G1-d2 galaksinin köşeleri ✅ (2026-11-14).** Oyuncunun anı: "dışarıda benim için ne var, ben neredeyim?" Sağ üst köşe döngünün bulucusudur (istihbarat → fırsat): sayıma basınca o şeylerin listesi düşer, satıra basınca kamera oraya uçar.

Önce kite eklenenler (galeri: `ui-kit` "Bulucu" bölümü; `game-ui/finder.tsx`):
- `Tally`: dışarıdaki bir şeyin sayımı. İşareti kendi renginde (kaya kristal mavisi, korsan düşman kırmızısı, enkaz alaşım, karakol amber, anıt döteryum), rakam büyük. Kelime okuyucunun adıdır ve listenin başlığında yazar. Basılabilen sayımda küçük bir ok listeyi söyler, liste açıkken döner.
- `DropPanel` + `DropGroup`: sayımın altından düşen kesik köşeli liste, başlığı sayımın renginde; anıtlarda "Zor/Kolay" başlıkları.
- `PickRow`: sıra (anıtın sırası), ad ve cümle, uçulacak yerin işareti. Basınca satır senin renginde yanar, kenarında ışık çizgisi belirir, işaret büyür.
- `pirate` glifi (çizildi: kafatası).
- `RoundButton` `lit`: kendi durumu açık olan düğmenin ayağında küçük bir lamba.
- Codex ile ev stilinde iki boyalı ikon: `hud-home` (bir dünyanın üstünde konum iğnesi) ve `hud-view` (kaideli teleskop). İkişer varyant üretildi; kubbe varyantı alt menüdeki "Üs" ile, kubbeli teleskop top taretiyle karışacağı için seçilmedi.

Köşeler:
- Okuma: kim burada iki sessiz satırda kelimeyle ("24 saatte 4 çevrimiçi", "177 gezegen · 4 filo dışarıda"); bulunabilenler tek sıra sayım. Sütun en fazla `min(82vw, 320px)`; tr ve de'de dört sayım tek satıra sığıyor (64vw'de anıt ikinci satıra düşüp 44 px yer kaplıyordu).
- Ev ve görünüm: boyalı yuvarlak düğmeler (zil ve sohbet gibi). Görünümün eski teal halkasının yerini lamba aldı (bir sensörün menzili haritada çizili).
- Olay çipleri: kitin durum çipi; işaret, yağmurun çarpanı, kalan süre. Olayın adı okuyucunun adıdır ve olay geldiğinde bağlam kartının başlığıdır. Ad yazılmadığı için konvoy artık roket işaretini taşıyor (önce tüccarla aynı sandığı taşıyordu); Şimdi çizgisinde ve kartta da aynı işaret.
- Bilinmeyen sinyal: kitin durum çipi, hedef işareti (Şimdi çizgisindeki işaret) ve kalan süre.
- İki köşe de 12 px'lik ana boşlukta.

Denetim aracında bulunan hata (`packages/ui-audit`, testli): araç hedeflere sırayla dokunuyor. Listenin dışındaki bir hedefe (olay çipi, kaynak hapı) dokunması listeyi kapatıyor, sıra gelince var olmayan satırlar "tepkisiz" sayılıyordu. Kaybolan hedef artık "ölçülemedi". Satırların basış tepkisi ayrıca doğrudan ölçüldü: zorlanan basışta satır piksellerinin %92'si değişiyor.

Ölçüm (`reports/ui-audit/g1d2-after-2026-11-14.md`, `gallery:readout` artık iki köşeyi oyundaki gibi diziyor, 6 dil × 3 boyut), aynı yolun G1-b ölçümüne göre telefonda: 12 px altı metin 45 → 0, kontrast hatası 16 → 0, 44 px altı hedef 12 → 2, tepkisiz hedef 6 → 0, kesilen metin 0. Kalan iki hedef ve iki aralık bulgusu aynı şey: liste açıkken altında kalan ev düğmesi (açılır liste dokunulunca kapanır; bilinçli).

Yerel oyunda 350 px'te denendi: "Sen yokken" penceresi kapatıldı, anıt sayımına basıldı, gerçek sekiz anıt Zor/Kolay başlıklarıyla açıldı; ev iğnesi ve teleskop sayımların altında.

Kit ölçümünün (ana kit sayfası, tr ve en telefon) G1-c'den bulduğu iki eksik kapatıldı: kırmızı sayaç plakasındaki süre 4,28:1 kalıyordu (artık bir ton açık kırmızı, bağlam kartının üst satırı gibi); plakanın alt cümlesi kesiliyordu ("Bir yapım, araştırma ya da saldırı başlat": Sessiz Uzay'dan çıkış yolu), artık sarılıyor. Kitte kalan kesilmeler taban kuyruğu yuvalarında ("Komuta Çekirdeği", "Duraklatıldı — tatil modu", "sahiplenince başlar"); G2'de (Üs) ele alınacak.

Owner'a soru (karar bekliyor, uygulamayı durdurmuyor): sayımlar artık kelimesiz (işaret + rakam), kelimeler okuyucuda ve basınca açılan listenin başlığında. "Bir bakışta" isteği (2026-09-24) yerinde, ama ilk kez gelen oyuncu kafatasının "korsan" olduğunu basmadan bilmeyebilir. İstenirse sayımın altına küçük kelime eklenir (köşe ≈ 20 px uzar).

**G1-d3 bildirim balonu ✅ (2026-11-14).** Oyuncunun anı: bir şeye bastı ya da bir şey oldu; "oldu mu, olmadı mı?" Her eylemin cevabı üst çubuğun altına düşen tek satırdır. Sıra kuralı (D45), süreler ve Akademi'nin susturması değişmedi; balonun kendisi kitin diline geçti.

Balon (kitin `Banner` toast biçimi):
- Üç ton, rengini söylediği şeyden alır: haber bilgi mavisinde yıldızla; "oldu ama" (depo dolu, bir kısmı havuzda kaldı) uyarı amberinde; ret ya da tehdit düşman kırmızısında. Kenar ve işaret renkli, yazı düz mürekkepte: her biri okunur.
- Yeni `warn` tonu: kısmi toplama artık ret gibi kırmızı değil, amber (`HudTop`, eski `StatusBar`). Bir ret kadar ekranda kalır (4 sn) ve elde hissedilir.
- Ses ve titreşim: haber "confirm" çalar, titreşmez (canlı haberler sık gelir); uyarı "confirm" + `haptic('warn')`; ret "alert" + `haptic('warn')`. Ret hâlâ hemen okunur (`role=alert`, `aria-live=assertive`).
- Kapatma kitin küçük yuvarlak düğmesi (44 px).
- Kenarlar 12 px'lik ana boşlukta, en fazla 384 px.
- Kitte: `Banner` `role` aldı (toast varsayılanı `status`; içinde durduğu yer zaten konuşuyorsa `null`).

Bulunan ve düzeltilen hata: üst çubuğun ilk ipucu şeridi ("Toplamak için bir kaynağa dokun") kitin kök sınıfı dışında kaldığı için kit yazısı yerine eski IBM Plex'e düşüyordu (G1-b'den kalma). Şerit artık `.gk` içinde, Saira.

Galeriye `toast-warn` yolu eklendi; `toast-error` artık gerçek bir ret ("Buradaki hiçbir filo akını zamanında tamamlayamaz").

Ölçüm (`reports/ui-audit/g1d3-after-2026-11-14.md`, 3 yol × 6 dil × 3 boyut), G1-b'deki iki balon yoluna göre telefonda: 12 px altı metin 4 → 0, 44 px altı hedef 4 → 0, tepkisiz hedef 2 → 0, kontrast ve kesilme 0.

Rapordaki tek bulgu, bilgi balonunun kapatma ikonunda 1,00:1, ölçüm aracının yanılgısı. Araç arka planı birkaç karede çekiyor; 2,4 sn'lik bilgi balonu bu sırada kalkıyor. Balon 9 sn tutulunca aynı düğme 11,1:1 ölçüldü (uyarı ve ret balonlarında da 11,1:1). Eski balonda raporlanan 1,00:1 de büyük olasılıkla aynı yanılgıydı.

Yerel oyunda 350 px'te denendi: kaynak hapına basıldı, "1,4K toplandı" üst çubuğun altına düştü (≈0,45 sn) ve süresi dolunca kalktı. Açıkken sağ üst sayımların ilk satırını örtüyor; tek satırlık ve 2,4 sn'lik olduğu için bilinçli.

**G1-e zil ve sinyal akışı ✅ (2026-11-14).** Oyuncunun anı: döndü, zile bastı; "ben yokken ne oldu, hangisi beni bekliyor?" Akış döngünün istihbarat halkasıdır: savaş raporu yeni istihbarat, satır o rapora, yuvarlak düğme o dünyaya götürür. Hangi haberin nereye açıldığı (`DESTINATION`), aile ve sonuç kuralları (D142, owner'ın yeşil/kırmızı zemini), okunmuş işaretleme ve sayaç değişmedi.

Önce kite eklenenler (galeri: `ui-kit` "Haberler" bölümü; `game-ui/news.tsx`):
- `NewsRow`: ailesinin renginde para ve içinde olanın işareti, cümle, ne kadar önce.
  - Zemin sonucu söyler: kazanç ince yeşil, kısmi ince amber, kayıp ince kırmızı, ikisi de değilse zemin yok.
  - Yeni satırın parası yanar ve köşesinde nokta durur (kayıpta kırmızı). Okunmuş satır rengini daha düşük ışıkta tutar.
  - Satıra basınca ilgili şey açılır; basılınca satır senin renginde yanar.
  - Sonda kendi yuvarlak düğmesi durabilir.
  - Herkesi ilgilendiren satırın (galaksi olayı) başında ne olduğu yazar, kenarında kendi renginde ray olur.
- `NewsList`: başlıklı ya da yalnız okuyucuya adlı liste, kesik köşeli plaka.

Akış:
- Sekmeler kitin `GameTabs` parçası; açık sekmenin gövdesi adlandırdığı panel. Kronik sekmesinin içi G5'te.
- "Şu anda" (dolu atölye, bozulan üretim, dolu depo, havadaki klan alarmı) ve "Neler oldu" aynı satırla çizilir. İkinci başlık yalnız ilki varken yazar.
- İşaretler kitin glifleri, Şimdi çizgisiyle aynı dil: gelen saldırı siren, akın kılıç, korsan kafatası, sondan göz, birinin taraması büyüteç, dönüş geri ok, fetih bayrak, kaybedilen dünya koloni, stratejik silah radyasyon. Galaksi olayı kendi işaretini taşır (yağmur göktaşı, tüccar sandık, konvoy roket).
- Kimlik (oyuncu, gezegen) cümlede kalın. Oraya uçuş satırın sonunda yuvarlak hedef düğmesi ("Haritada göster: Sable"). Eskiden altı çizili adın kendisiydi: başparmağın tutturması gereken bir yazı satırıydı ve satırın kendi basışının üstünde duruyordu.
- Aynı dünyadan art arda gelen sonda raporları tek satır ("×2"; yakalanan sonda ya da başka dünya ayrı kalır). Taramalar zaten katlanıyordu (D45).
- Boş akış kitin `EmptyState` parçası: zilin boyalı resmi, "Ortalık sakin" ve buraya neyin geleceği.
- Satırların yazısı düz mürekkepte. Eskiden alarm satırları kırmızı yazıyla yazılıyordu; renk artık para ve zeminde (kitin kuralı: ton çerçeveyi ve işareti boyar, sözü değil).

Ölçüm (`reports/ui-audit/g1e-after-2026-11-14.md`, 2 yol × 6 dil × 3 boyut), G1-b'deki aynı yollara göre telefonda: 12 px altı metin 30 → 2, kontrast hatası 15 → 2, 44 px altı hedef 16 → 8, tepkisiz hedef 18 → 6, kesilen metin 0. Kalanların hepsi ortak sheet çerçevesinde ve G1-g'nin işi: başlıktaki "3 yeni" (9 px, 3,87:1), "Genişlet" tutamacı (16 px), adsız arka perde, "Kapat"ın basış tepkisi. Akışın satırlarında bulgu yok.

Kelime yükü ekran başına 55'ten 52,5'e indi (bütçe 55). "Uzun blok" sayısı 3 kalıyor: her satır bir haber cümlesi, paragraf değil. Cümleler sunucudan ve bildirim kataloğundan geliyor; kısaltmak ayrı bir yazı işi.

Yerel oyunda 350 px'te zil açıldı. Hesabın gerçek akışı (üç galaksi olayı) başlık, ray ve okunmamış noktalarıyla çizildi; Kronik sekmesine geçildi.

**G1-f1 ayarlar ✅ (2026-11-14).** Oyuncunun anı: "sesi kısayım, dili değiştireyim, telefonum ısınıyor." 2026-11-11 ölçümünün en kötü yüzeyi (puan 119). Ayarların kendileri ve ne yaptıkları değişmedi; her satır kitin bir kontrolü oldu.

Önce kite eklenenler (galeri: `ui-kit`):
- `Slider` `readout`: ses düzeyi gibi bir seviye, "Tümü" düğmesinin yerinde yüzdesini söyler.
- `Slider` basış tepkisi: başparmak değince tutamaç büyür ve yanar. Kit ölçümünün G1'den önce de bulduğu tek tepkisiz hedef ("Ok" sürgüsü) kapandı.
- `Choices`: bir ayarın birkaç konumu. Sekme plakası görünümünde, seçili olan yanar; radyo grubudur ve basınca hemen geçer.
- `SettingLink`: başka yerde açılan bir ayar; adı, durduğu yer ve ok (Gizlilik).

Ayarlar:
- Dil: tarayıcının seçim kutusu yerine kitin bayraklı `LanguagePicker` parçası.
- Müzik ve efektler: her biri bir şalter (`Toggle`) ve yüzdesini söyleyen sürgü. Çalan parça satırı kitin yuvarlak düğmeleri ve ilerleme çizgisiyle çizildi.
- Görüntü kalitesi: `Choices` ve seçilenin cümlesi.
- Kare hızı ve oyun ölçümü: şalter. Ölçüm metnine şalterin adı eklendi (6 dil); durum artık "Açık/Kapalı" cümlesi yerine şalterin lambasından okunuyor.
- Gizlilik: `SettingLink`.
- Sayfa kitin `SectionTag` parçasıyla başlıyor; gruplar plakalarda.

Galerideki menü sheet'inin başlığı oyundaki gibi çevrildi ("Your account / Commander" sabitti).

Ölçüm (`reports/ui-audit/g1f1-after-2026-11-14.md`, 6 dil × 3 boyut), G1-b'ye göre telefonda: 12 px altı metin 36 → 2, kontrast hatası 22 → 2, 44 px altı hedef 30 → 6, aralık hatası 2 → 0, tepkisiz hedef 14 → 3. Kalanların hepsi ortak sheet çerçevesinde (başlıktaki 9 px üst satır, Daralt, Geri, Kapat); G1-g'nin işi. Ayarların içinde bulgu yok.

**G1-f2 menü ✅ (2026-11-14).** Oyuncunun anı: madalyona bastı; "sıralamam ne, ödülüm var mı, ayarlar nerede?" Menüde dört ayrı öğe biçimi vardı: satır, kategori, karo ve vitrin. Ayrıca bir "N ödül hazır" satırı, Ödüller satırının sayısını tekrarlıyordu. Menünün açtığı yerler, sıraları ve gemideyken gizlenenler değişmedi.

Önce kite eklenenler (galeri: `ui-kit`, "Menü karoları"):
- `MenuTile`: menünün açtığı her yer. Kesik plakada yerin resmi, para üstünde işareti ve adı. Arkasındaki yenilik kırmızı sayı olarak görünür, uyarı çip olarak. Geniş karo yerin durumunu bir satırda söyler. Okuyucu adı ve arkasında ne olduğunu duyar. Tonlar: çelik, mağaza (altın), çağrı (kendi rengi), uyarı (sarı).
- Dar karoda para üstte, ad altta durur; uzun kelime ("Announcements", "Einstellungen") plakanın tüm genişliğini kullanır. Gerekirse kelime hecelenir, harf ortasından bölünmez. Geniş karoda para adın yanındadır.
- Resim adın altında metale doğru solar. En parlak resimde bile ad 4,5:1 kontrastın üstünde kalır.
- `TileGrid`: karoları ikişer dizer; tek kalan son karo satırı doldurur.

Menü:
- Başta komutan kartı: madalyon (üst bardakiyle aynı), bayrak, ad, klan, profile ok. Altında galaksi ve sezon süresi.
- Çağrılar en üstte, satır boyu: Sessiz Uzay'dan dönüş ve sezon kaydı.
- Gruplar `SectionTag` ile ayrıldı: **Bu sezon** (Sıralama, Ödüller), **Koleksiyon** (Mağaza, Envanter, Android'de Bildirim Merkezi), **Oyun** (Akademi, Topluluk, web'de Destek ol, Ayarlar). "Oyun" başlığı 6 dile eklendi.
- "N ödül hazır" satırı kalktı. Sayı artık Ödüller karosunun köşesinde.
- Topluluk karosu klan resmini aldı. Duyurular resmi Topluluk sayfasındaki Duyurular karosunda kaldı.
- Rakip işaretleri kit çipi oldu: rakibin rengi, adı, 44 px dokunma alanı, basınca ses ve titreşim.
- Alt şeritteki "Hızlı erişim ekle" ve "Tam ekran" düğmeleri 44 px oldu ve basınca tepki veriyor.
- Akademi ve Topluluk sayfaları da aynı karolarla çizildi; simülatör kapanınca odak açan karoya döner.

Kullanılmaz kalanlar (owner'a sorulacak, silinmedi): `shell/ShopShowcase.tsx` + `ShopShowcasePoster.tsx`, testleri `test/shop-showcase.test.tsx` ve `native-surfaces` içindeki vitrin kısmı, CSS'te `.menu-shop-*`, `.shop-showcase-*`, `.menu-collection`, `.inventory-scene`. Bu değişiklikle kullanılmaz hale gelen menü CSS'i (`[data-menu-identity]`, `[data-menu-tile]`, `.menu-avatar`, `.menu-art-tile`) silindi.

Ölçüm (`reports/ui-audit/g1f2-after-2026-11-14.md`, 4 yol × 6 dil × 3 boyut), G1-b'ye göre: 12 px altı metin 118 → 12, kontrast hatası 18 → 8, tepkisiz hedef 40 → 13, kesilen metin 10 → 0, görünen metin 206 → 186. 44 px altı hedef 20 → 20, aralık hatası 4 → 6: artış alt sayfalarda G1-f1'de galeriye gelen "Geri" düğmesinden. Kalan bulguların hepsi ortak sheet çerçevesinde: 9 px "Komutan" üst satırı (3,87:1), Daralt (16 px), Geri ve Kapat (32 px), adsız arka plan. Bunlar G1-g'nin işi; menünün içinde bulgu yok.

**G1-g1 sheet çerçevesi ✅ (2026-11-14).** Sheet'in çerçevesi oyunda neredeyse her yerde, yaklaşık 40 yüzeyde ortak. G1'deki her ölçümde kalan bulgular burada toplanıyordu. Sheet'in davranışı değişmedi: yükseklikler, çekme, Escape ve arka plana dokununca kapanma aynı. Değişen, çerçevenin parçaları:
- **Başlık resmi panele eriyor** (owner notu 1). Resmin alt kenarı keskin bir çizgiyle bitmiyor; maske resmi ve gölgesini birlikte saydamlaştırıyor. Altındaki panel v2 paneli de olsa kitin metali de olsa geçişte dikiş kalmıyor.
- **Geri ve Kapat kitin yuvarlak plakaları.** İki başlık biçiminde de dokunma alanı 44 px; düz başlıkta yüz küçük olanı. Basınca bir kez titreşiyor; sesi mikserin tıklaması. Escape, arka plan ve çekme titreşmiyor, çünkü bu basışlar o düğmeler değil.
- **Üst satır** kitin okunur satırı oldu: 9 px ve 3,87:1 yerine 12 px, `--gk-ink-2`.
- **Tutamaç** görünüşte aynı 16 px'lik satırda kalıyor. Dokunma alanı 64×44 px; Geri ile Kapat arasında başlığın boş ortasına uzanıyor. Basınca çubuk parlıyor ve uzuyor.
- **Başlık yanındaki düğmeler** (sohbetin susturma ve engel listesi) tutamaç alanının üstünde duruyor; çakıştıkları yerde basış düğmeye gidiyor.
- **Arka plan** basınca bir an koyulaşıyor, sonra sheet kapanıyor.
- Menünün alt şeridindeki yazılar 12 px'e çıktı (G1-f2'den kalan).

Eski `ui/kit/Sheet` (v1, yaklaşık 10 yüzey: araştırma, klan, ticaret, arıza…) bu birimin dışında. O yüzeyler kendi birimlerinde v2 sheet'e geçecek.

Ölçüm (`reports/ui-audit/g1g1-after-2026-11-14.md`: menü, ayarlar, Akademi, Topluluk, sezon sonu, zil, boş zil, sayaçlar; 6 dil × 3 boyut), her yolun son ölçümüne göre telefonda: 12 px altı metin 16 → 0, kontrast hatası 12 → 0, 44 px altı hedef 36 → 0, aralık hatası 12 → 0, tepkisiz hedef 24 → 0. Masaüstünde de bu ölçütlerde bulgu yok. G1'in sheet'lerinde ölçülen bulgu kalmadı. Galeride altı yüzey daha göz kontrolünden geçti: zil, zamanlayıcılar, tamirhane, Bildirim Merkezi, saldırı ve savaş raporu.

**G1-g2 masaüstü özeti ✅ (2026-11-14).** Oyuncunun anı: bilgisayarda galaksiye bakarken tek bakışta "dünyalarım ne durumda, havada ne var, hangi kuyruğum boş?" sorusunun cevabı. Asıl karar boş bir kuyruğu doldurmak ya da gelen saldırıya bakmak. Satırların açtığı yerler ve kurallar değişmedi: saldırı tek kırmızı şey, boş kuyruk sarı.

Önce kite eklenen: `SectionTag` `as`. Etiket istenince bölümünün başlığı (h2/h3) olur; okuyucu özeti başlıklarla gezer.

Özet:
- Bölümler kitin etiketiyle başlıyor; sayısı sağda.
- Dünya kitin kesik plakası: para üstünde başkent ya da koloni işareti, ad, gemiler. Ekrandaki dünya kendi renginde yanıyor. Gelen saldırı kırmızı siren ve sayı. Gemi satırı kesilmiyor, sarıyor.
- Havadakiler zamanlayıcılar sheet'inin satırları (`TimerRow`): işareti boşalan bir halkada, kalan süre ve iniş saati. Bize gelen saldırı kırmızı; dönen filo geri dönüş işareti taşıyor. İşaretler zamanlayıcılarla aynı tablodan.
- Kuyrukta her iş aynı satırla çiziliyor; arkada bekleyen iş sarı "Sırada". Boş kuyruk kitin boş yuvası gibi kesikli ve sarı, 44 px.
- Basışlar kitin sesi ve titreşimiyle cevap veriyor.
- Kit sayfasına dolu bir özet bölümü eklendi ("Masaüstü özeti"): saldırı, iki yönde uçuş, çalışan ve boş kuyruklar.

Ölçüm (`reports/ui-audit/g1g2-after-2026-11-14.md`, `gallery:store-discovery`, masaüstü, tr ve en), G1-b'ye göre: 9–10 px metin 42 → 4, kontrast hatası 18 → 6, 24–44 px hedef 12 → 0, kenardaki küçük hedef 2 → 0. Özetin içinde bulgu yok. Kalan küçük metin ve kontrast bulguları galaksi haritasının gezegen etiketleri ("Ana gezegen", komutan adı; 8–9 px), galaksi biriminin işi. Not: "IN THE AIR" etiketi 12 px, büyük harf ve üç kelime olduğu için yazım alışkanlığı kuralına takılıyor (de "IN DER LUFT", es "EN EL AIRE" de öyle). Bu bir metin kararı, owner'a soruldu.

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

**G2 iş birimleri (2026-11-14; G1 gibi her biri incele → karar ver → yap → incele döngüsünden geçer, biri bitmeden öteki başlamaz):**

Galeride 350 px'te bakıldı (`base-production`, `base-fleet`, üç kaydırma). Görülenler: alt sekmeler yalnız yazı (owner notu 3); aynı satırdaki bina kartlarının boyu farklı, kilit metni kartı uzatıyor (owner notu 4); bölümler farklı kenar boşluklarında (owner notu 2); hiçbir şey yapılmıyorken bile üç kuyruk üç satır "+ Boş hat" kutusu; Filo sekmesinde onarım kartı ve hangar çubuğu v2.

| # | Birim | Oyuncu anı | Ne değişir |
|---|---|---|---|
| G2-a | Üs kabuğu | "Hangi bölümdeyim, nereye bakmalıyım?" | Alt sekmeler iki katlı: ikon üstte, yazı altta, 44 px (owner notu 3). Üs gövdesi tek kenar çizgisinde (`--gk-gutter`, owner notu 2). Sekmenin açıklama satırı ve bölüm etiketleri aynı çizgide. |
| G2-b | Bina kartları | "Neyi yükselteyim?" | Sabit iskelet (owner notu 4): sabit resim bandı, ad, 1 satır amaç, 1 satır etki, en altta sabit fiyat satırı. Kilit ve "yetmiyor" fiyat satırının yerinde. Ayrıntı sheet'te. |
| G2-c | Kuyruklar | "Ne yapılıyor, nerede boşluk var?" | Boş hatlar tek satır sayısı; çalışan hatta yuvalar. Arıza onarım hatları aynı dilde. |
| G2-d | Arıza | "Onarmaya değer mi?" | `FaultSheet` (v1) kitte; saatlik kayıp ve fiyat yan yana; Onar 1 sn basılı tutma. |
| G2-e | Tersane | "Kaç tane, hangi gövde?" | `BuildSheet` kitin `UnitCard`/`UnitBay` parçalarıyla; uzun yığın adımlara iner; Üret 1 sn basılı tutma. Yüksek öncelik. |
| G2-f | Onarım istasyonu | "Hangi gemileri onarayım?" | Kart ve sheet kitte; tıka basa yığın sekme/adıma iner; onar ve hurda basılı tutma. Yüksek öncelik. |
| G2-g | Taktik ve Savunma özeti | "Stratejik silah üreteyim mi? Savunmam ne durumda?" | v2 `HoldButton` → kit `GameHold`; depo ve şarj kit okumalarıyla. Savunma sekmesinin başındaki özet kutuları (v2, 9 px) kitte. |
| G2-h | Filo sekmesi ve Filo sayfası | "Gemilerim nerede, kaç tane?" | Filo sekmesinin yedi bölümü ile ayrı Filo sayfasının görev paylaşımı kararı (gezinme değişebilir); `Segmented` → `GameTabs`; anıt dalgası satırları kitte. |
| G2-i | Araştırma | "Sırada hangi araştırma?" | Yıldız haritası, seçili kart ve proje sheet'i kitte; 9–10 px yazılar kalkar. de "Sprosse" / es "peldaño" (basamak) birebir çevirileri araştırma metinlerinden kalkar. |
| G2-j | Dünyalar paneli | "Hangi dünyamda ne var, kaynak aktar" | v1 → kit; iki yerli `<select>` yerine dünya seçici; aktarma basılı tutma. Yüksek öncelik. |

**G2-a Üs kabuğu ✅ (2026-11-14).** Oyuncunun anı: Üs'ü açınca "hangi bölümdeyim, nereye bakmalıyım?" sorusunun cevabı. Asıl karar bir bölüme geçmek. Sekmelerin sırası, açtığı yerler ve kurallar değişmedi.

Önce kite eklenen: `GameTabs` `stacked`. İki katlı sekme: işaret üstte, ad altta, 44 px. Seçili sekmenin işareti kendi renginde yanıyor. Bir arıza işareti köşede duruyor, böylece iki kat ortada kalıyor. `TabItem.glyph` artık `{ id, tone? }`; tonu verilmeyen işaret sekmenin yazısıyla aynı renkte.

Üs:
- Beş alt sekme iki katlı: Üretim kazma, Bilgi göz, Savunma kalkan, Taktiksel nişangâh, Filo roket.
- Üs gövdesindeki bütün bloklar (arıza onarımları, kahraman, kuyruklar, toparlanma ve EMP bantları, sekme gövdesi) tek kenar çizgisinde: `--gk-gutter`, 350 px'te soldan 13 px. Kitin bölüm bandı, bina grubu başlığı ve depo okuması kendi iç boşluklarını bıraktı, kenarı taşıyan tek şey dış çizgi. Kutuların içindeki yazılar (oda kutusu, taktik kutusu, kart içleri) kutunun kendi boşluğunda; kutunun dış kenarı çizgide.
- 350 px'te tr, en, de (PRODUKTION) ve ja sığıyor. 320 px'te Almanca beşinci sekme kesiliyor ve sıra kayıyor; kitin "uzun kelime genişliğini korur, sıra kayar" kuralı bu.

Ölçüm: `reports/ui-audit/g2a-after-2026-11-14.md` (`base-production`, `base-fleet`, `base-fleet-empty`; telefon, dar, masaüstü). G1'den sonra Üs ölçülmemişti; bu ölçüm G2'nin başlangıç ölçümü. Üretim yolu temiz: 12 px altı metin 0, kontrast hatası 0. Kalanlar sonraki birimlerin:
- Filo sekmesindeki hangar odası göstergesi (v2): 9–10 px metin, 4,1:1 kontrast, 2 yolda 15 metin. G2-h.
- Onarım istasyonu kartı basınca tepki vermiyor. G2-f. (✅ G2-f'de düzeldi.)
- Kuyruktaki "En attente" fr'de üç noktayla kesiliyor. G2-c.
- Her yolda tek bir 2×2 px adsız dokunma alanı (`root`) var. Galerinin kökü, oyunda yok.

Bina kartlarında "~53 dk sonra yeter" yazısının "~" işareti kartın yazı tipinde eksi gibi okunuyor ("-53 dk"; owner'ın ekranında "Enough in -9h 09m"). G2-b'de düzelecek.

**G2-b bina kartları ✅ (2026-11-14).** Oyuncunun anı: Üs'te kartları yan yana karşılaştırıp "neyi yükselteyim?" sorusunu cevaplamak. Her kartta aynı yerde dört şey görünüyor: ne işe yaradığı, sonraki seviyenin ne getirdiği, fiyatı ve ne zaman yeteceği. Fiyatlar, kurallar ve kartın açtığı sheet değişmedi.

Önce kite eklenen:
- Kart iskeleti (`UpgradeRow` kart düzeni, owner notu 4): resim bandı 84 px; ad; amaç (`data-card-purpose`, 1 satır); etki (`data-card-effect`, 1 satır); ayak (`data-card-foot`). Ayakta fiyat ve altında bir satır süre ya da durum var.
- Kazanca kartın kısa biçimi: `Gain.brief`, `cardEffect`.
- Kilide kartın kısa sözü: `Blocked.short`.
- Sıradaki sipariş işareti: `gk-bcard__queued`.

Kart:
- Etki satırında yalnız rakamlar var ("482/sa → 611/sa"). Etiketi okuyucu duyuyor; ne olduğunu üstteki amaç satırı söylüyor.
- Kilit fiyatın yerinde duruyor: "🔒 Döteryum Sentezi I ›".
- Sıra doluysa fiyat kalıyor, altında kum saatiyle "Sıra dolu" yazıyor.
- Kaynak yetmiyorsa süre satırında "53 dk sonra yeter" var.
- Sırada siparişi olan ve bir sonrakini de alabilen kartta sipariş resmin altında küçük bir işaret. Ayak bir sonraki siparişin fiyatı ve süresi.
- Bütün bina kartları aynı boyda: 199 px (önce 180–251 px). Gemi kartları kendi aralarında 217 px.

Metin (6 dil):
- Amaç satırları tek satıra sığacak biçimde yazıldı.
- Makine çevirisi kokan satırlar düzeldi: de "Vertieft den Shop", "Erkennen Sie Bedrohungen für Sie"; es "Profundiza la almacén", "habitación"; ja "遠くの動きを解決する"; fr "Unités 2138".
- Uzun etkilerin kart biçimi var: Depo saatleri, Hangar alanı, Teleskop ve Radar menzili, Körük, Kılavuz.
- Test: `card-copy.test.ts`, her dilde amaç ≤ 22, etki ≤ 18 sütun (Japonca karakter 2 sütun).
- "~" bütün dillerde kalktı (ja "約" bir kelime olduğu için kaldı).
- Döteryum kilidi artık öteki araştırma kapıları gibi "Döteryum Sentezi I" diyor. Eski "Bir kademe daha Döteryum Sentezi araştır" metni silindi.

Gemi kartları:
- Eski v2 kurallarından çıktı: 9 px alt satır, 12 px ad, ham renkler, sağa itilmiş süre.
- Sınıf işareti adla aynı satırda.
- Ayak bina kartıyla aynı: fiyat, altında süre.

Kit sayfasındaki "Bina kartı" bölümü yeni metinlerle güncellendi.

Ölçüm: `reports/ui-audit/g2b-after-2026-11-14.md` (`base-production`, `base-fleet`, `base-fleet-empty`).
- G2-a ile karşılaştırma: 12 px altı metin, kontrast ve hedef sayıları aynı.
- İlk "after" ölçümünde tek satır kuralı 51 metni kesiyordu (ja bekleme cümlesi, 320 px'te tr/es bekleme satırı, kilit satırının yüksekliği). Kart bekleme süresi bir saatin üstünde yukarı yuvarlanınca ("17 sa sonra yeter"; tam süre sheet'te) ve kısaltmalar yapılınca 6'ya indi.
- Kalan 4 bulgu G2-c'nin işi: fr kuyruktaki "En attente". Kalan 2 bulgu, 320 px'te ja "約17時間で足ります", "約" kalkınca giderildi.
- Denetim yalnız Üs'ün varsayılan sekmesini ölçüyor. Beş sekmenin bütün kartları ayrıca 6 dilde, 320 ve 350 px'te tarandı: kesilen metin yok (scratchpad `cutcheck.mjs`). Bu yüzden 320 px'te taşan beş satır daha kısaldı: en "Opens Telescope/Radar", de "Leichte/Schwere Bodenkanone", es "Ve movimiento lejano" ve "Enlace en órbita", ja "観測機器を解放".

Görülen ama bu birimin işi olmayanlar:
- Savunma sekmesinin başındaki özet kutuları (Ateş gücü, Savunma, Kalkan, Risk altında) v2 dilinde ve 9 px yazılı. G2-g'ye eklendi.
- es `errors.ts` `TARGET_HANGAR_FULL` metninde de "habitación" var. G4 gönderme biriminde düzelecek.

**G2-c kuyruklar ve arıza onarımları ✅ (2026-11-14).** Oyuncunun anı: Üs'e girince "ne yapılıyor, nerede boşluk var, ne bozuk?" sorusuna tek bakışta cevap. Kurallar, kuyruk sheet'i ve arıza sheet'i değişmedi.

Kuyruklar:
- Bir hat çalışırken boş kalan hat artık üç boş hücre değil, tek satır. Satır kesik çizgili ve uyarı renginde, çünkü boş hat harcanmayan zaman: "İNŞAAT ——— + 3 boş hat". Satır 44 px'lik bir kapı; basınca o hattı dolduran sekmeye geçiyor (İnşaat → Üretim, Tersane → Filo).
- Çalışan hat aynı kaldı: yuvalar halka, boşlar "Boş hat".
- Hiçbir şey çalışmıyorsa tek satır kuralı da aynı kaldı.
- Kuyruk yuvasına basınca iki ses çalıyordu: kendi sesi ve genel düğme sesi. Yuva artık kendi sesini işaretliyor (`data-own-sound`).
- fr "En attente" yerine "En file" yazıyor, yuvaya sığıyor.

Arıza onarımları (eski v1 şeridinden kite):
- Başlık uyarı renginde "ONARIM", yanında ekip sayısı.
- Ekibin çalıştığı arıza kitin zamanlayıcı satırı: dolan halka, ad, "1. ekip", kalan süre.
- Bekleyen arıza bir kapı satırı: kesik halkalı arıza işareti (başlayınca zamanlayıcıya dönüşecek boş halka), ad, altında fiyat, sağda ok. Kasanın yetmediği kaynak işaretli.
- Satırlar 52 px; basınca uyarı renginde yanıyor, ses ve titreşim veriyor.

Metin:
- Kuyruk adı ile bina adı aynı: de "Yard" yerine "Werft", es "Yarda" (uzunluk birimi) yerine "Astillero". fr'de iki ad vardı ("Chantier naval" ve "Chantier Spatial"); hepsi "Chantier spatial".
- Hangar kartındaki makine çevirileri: fr "Salle 810" (salon) yerine "810 places", de "810 Raum" yerine "810 Plätze", ja "810 ルーム" yerine "810枠", ja "いいえ 格納庫" yerine "格納庫なし". de "Sprosse" ve es "peldaño" Hangar tavanından kalktı. Araştırma metinlerinde de var; orası G2-i'de düzelecek.

Kit sayfasına `base-faults` görünümü eklendi: 1 arıza onarımda, 2 arıza bekliyor (biri kasanın ödeyemediği fiyatla). Denetim artık bunu da ölçüyor; "arıza onarım hatları" ulaşılamayan durumlar listesinden çıktı.

Ölçüm: `reports/ui-audit/g2c-after-2026-11-14.md` (aynı üç yol) ve `g2c-faults-2026-11-14.md` (`base-faults`).
- G2-b ile karşılaştırma: kesilen metin 6 → 0 (fr "En attente" ve ja bekleme cümlesi). 12 px altı metin, kontrast ve hedef sayıları aynı. Telefonda görünen metin 452 → 434: iki boş hattın altı hücresi iki satıra indi.
- `base-faults`: 12 px altı metin 0, kontrast hatası 0, kesilen metin 0. Tek bulgu galerinin kökündeki 2×2 px alan; oyunda yok.
- İlk koşuda bir ölçüm (`base-fleet` en/telefon) "boş yüzey" verdi; o tek ölçüm yeniden koşturuldu, karşılaştırma tam 42 ölçümle.

Denetim envanteri G1-b'den beri eski dosya adını (`WorksLine.tsx`) gösteriyordu; `StatusLine.tsx` olarak düzeldi. Bunu `packages/ui-audit` testleri yakaladı; o testler artık her birimin regresyonunda koşuyor.

Görülen ama bu birimin işi olmayanlar:
- 320 px'te ja üst kaynak göstergesinde "12,400" komşu kutuya değiyor (G1 üst çubuk; G1 kapandıktan sonra görüldü). ✅ G2-c'nin ardından düzeldi: ölçünce 350 px'te de taşıyordu ("12,400" 52 px, hap 49 px). Hap artık kendi genişliğini, rakam kendi uzunluğunu biliyor; yazı yalnız sığmadığında küçülüyor (350 px'te 6 haneli rakam 14,5 px, 320 px'te 12 px taban; kısa rakamlar ve 390 px 16 px kalıyor). Üst çubuk 99.999'a kadar tam rakam kuralı değişmedi.
- de metinlerde "Sie" ile "du" karışık: yaklaşık 340 "Sie/Ihre" kalıbına karşı 409 "du/dein" (Üs sekmesi açıklaması "Entwickeln Sie hier Ihre Schiffe"). Oyun tr'de "sen", fr'de "tu" diyor; de "du"ya inecek. Ayrı bir metin birimi; yardımcının sonraki partisine verilecek.

**G2-d arıza sheet'i ✅ (2026-11-14).** Oyuncunun anı: bozuk bir şeye dokundu; "onarmaya değer mi, şimdi mi?" Sheet bu soruya tek bakışta cevap veriyor. Kurallar (ekip sayısı, fiyat, süre aralığı, iptal yok) değişmedi.

- Sheet v1'den (`plate`, `legend`, v1 `Button`) kite geçti. Başlık uyarı tonunda (`kit.tone: 'warn'`, kitin yeni tonu); altında "2/3 ekip boşta".
- Ne oldu: bozuk işaretiyle tek cümle.
- Karar iki yarıda yan yana. Solda "Sana neye mal oluyor": kaynağın resmi, saatlik rakam (1.770/sa) ve iki kelime ("alaşım üretilmiyor"). Sağda "Onarım": fiyat (kasanın yetmediği kaynak işaretli) ve süre aralığı. Rakam vermeyen arızalarda (tersane isyanı gibi) fiyat tek başına duruyor; ne durduğunu üstteki cümle söylüyor.
- Döteryum rafinerisi arızası artık "her saatlik döteryum" cümlesi yerine rakam veriyor; alaşım ve kristal arızalarıyla aynı kuralla (adlık üretim × sessiz uzay temposu).
- Koloninin sadakati, kahramanla aynı ortak satırla (`LoyaltyRow`) çiziliyor; altında "2 arıza yüzünden düşüyor. Sıfırda koloniyi kaybedersin." Eski cümle yüzdeyi ve süreyi bir kez daha tekrarlıyordu.
- Onar 1 sn basılı tutma (`GameHold`, harcayan eylem ağırlığı, kaynak sesi `weld`). Üstünde uyarı renginde "Başlayan onarım iptal edilemez." Ekip yoksa ya da kasa yetmiyorsa düğme kilitli ve sebebini yüzünde söylüyor ("3 ekibin hepsi dışarıda", "Kasa yetmiyor").
- Ekip başındaysa ayakta kitin zamanlayıcı satırı: dolan halka, "Bir ekip başında", "2. ekip", kalan süre. İptal düğmesi yok; sözleşme bu.

Ortak parçalarda:
- Sadakat satırı iki katlı: ad, yüzde ve kalan süre üstte, çubuk altta tam genişlikte. Yan yana iken "BU DÜNYANIN SADAKATİ" iki satıra kırılıp çubuğu 350 px'te bir noktaya eziyordu; kahramanda da aynıydı.
- Sheet başlığının sütunu artık kapatma düğmesinin altına uzamıyor. 320 px'te de "LEGIERUNGSRAFFINERIE" düğmenin altına giriyordu; şimdi hecesinden bölünüyor (`hyphens: auto`, sayfanın dili).

Metin (6 dil): de "Was es braucht" ve es "Lo que está tardando" ("sana neye mal oluyor" anlamını vermiyordu) düzeldi. de ekip için "Besatzung" ve "Crew", es "tripulación" ve "equipo" karışıktı; de "Trupp", es "equipo" oldu. Kullanılmayan `toll.*` cümleleri, `price.crew`, `price.parts`, `running` ve `loyalty.line` silindi.

Kit sayfasına üç görünüm eklendi ve denetim bunları ölçüyor: `fault-sheet`, `fault-sheet-running`, `fault-sheet-short`. "arıza sheet'i" ulaşılamayan durumlar listesinden çıktı.

Ölçüm: `reports/ui-audit/g2d-after-2026-11-14.md` (üç görünüm, 6 dil, telefon, dar ve masaüstü; 42 ölçüm). 12 px altı metin 0, kontrast hatası 0, 44 px altı hedef 0, basınca tepkisiz hedef 0, kesilen ve kırpılan metin 0. Telefonda ekran başına 54–62 kelime (bütçe 55): tek ekranda karar için gereken her şey var, kaydırma yok. Eski sheet ölçülemiyordu (galeride yolu yoktu), karşılaştırma yok.

**Sıra değişti: G2-f ve G2-g, G2-e'den önce.** Tersane sheet'i (G2-e) ve hangar odası (G2-h) aynı parçaya dayanıyor: Hangar/zemin odası ve siparişin ondan aldığı pay. Bu çalışma ağacında o parçanın kit hâli yarım duruyor: `RoomGauge` (`game-ui/readouts.tsx`, `game-ui/index.ts`, `test/game-ui/room-gauge.test.tsx`). Başka bir oturum 2026-11-12'de eski 4.2 aşaması için başlatmış; commit edilmemiş, CSS'i yok, kullanan yer yok. Plan bu değişikliklere dokunulmamasını söylüyor.

Owner'a soru (G2-e ve G2-h'yi bekletiyor): Bu yarım `RoomGauge` işini sahiplenip G2-e/G2-h'de bitireyim mi, yoksa o oturum dönecek mi? Cevap gelmezse G2-f ve G2-g'den sonra G2-e yapılır; oda çubuğu o zamana kadar v2 `RoomBar` olarak kalır ve G2-h'de kite geçer.

**G2-f onarım istasyonu ✅ (2026-11-14).** Oyuncunun anı: savaştan yaralı gemiler döndü; "hangilerini onarıp savaşa geri sokayım, hangilerini parçalayayım, ne kadar tutar?" Kurallar (ücretsiz aktarım, ücretli onarım, sıra derinliği, iptalde yarı iade, radyasyon kapanışı, 50 grup sınırı, aynı isteğin aynı anahtarla tekrarı) değişmedi.

- Kart (Filo sekmesi, iki sütun) v2'den kitin metaline geçti: 242 px'ten 114 px'e. Tamirhane resmi kartın sağında, yazı solda metal bir örtü üstünde. Ad, sıra doluluğu (dolunca uyarı renginde), görev cümlesi, "3 gemi bekliyor" ve "4 onarımda" etiketleri, çalışan işin çubuğu ve süresi. Onarım sürerken resimdeki kaynak ışığı yanıp sönüyor. Bütün kart tek kapı: kendi sesi ve titreşimiyle açılıyor, basınca iniyor (eskiden basınca tepkisizdi).
- Sheet: 250 px'lik kahraman resmi kalktı; resim başlığın arkasında, altında "Şu an %75 ödüyorsun". Kural tek satır, ayrıntısı "?" ile açılıyor (`InfoPeek`). Üç istatistik kutusu ve iki `Segmented` kalktı.
- Yerler sekme oldu: Hangar / Tamirhane / Kuyruk 2/3. Hangar ve Tamirhane sekmesinde karar bekleyen gemi sayısı rozet olarak var (okuyucu "Hangar · 8 hasarlı gemi" duyar). Sheet karar bekleyen yerde açılıyor: önce evdeki yaralılar, sonra tamirhanede bekleyenler, sonra kuyruk.
- İş emri bir şalter (`Lever`): Hangarda Onarım / Parçalama; Tamirhanede Onarım / Geri al / Parçalama. Yer değişince seçim de iş emri de sıfırlanıyor; parçalama bir sekmeden ötekine taşınmıyor. Radyasyonda tamirhane "Geri al"da açılıyor (tahliye, radyasyonun kapatmadığı tek iş).
- Altta her zaman tek eylem: Hangarda "Tamirhaneye aktar" (ücretsiz, geri alınabilir: düz basış), Tamirhanede "N gemiyi onar" 1 sn basılı tutma (harcayan), "Hangara geri al" düz basış, Parçalama 1,5 sn kırmızı basılı tutma (kesin). Eski parçalama onay penceresi kalktı; geri dönecek kaynaklar (sıfır olanlar da) basmadan önce altta yazıyor, üstte kilit işaretiyle "Anında ve geri alınamaz". Kilitli düğme sebebini yüzünde söylüyor ("Gemi seç", "Onarılacak gemileri seç", "Kuyruk dolu · 3/3", "Kasa yetmiyor", "Radyasyon nedeniyle kapalı", "Çok fazla grup").
- Gemi grupları kitte: resim, ad ve adet, can yüzdesi, çubuk (yalnız savaşamayacak kadar yaralıyken uyarı renginde), kitin sayacı. Onarımı zaten süren grup tek satır ("Onarıma ayrıldı") ve listenin sonunda; eskiden "1 adet var" diyerek yanıltıyordu. Seçim yokken fiyat çizilmiyor ("0 sn" yazmıyor).
- Kuyruk kendi sekmesinde: halka, gemilerin adı (sekme zaten onarım dediği için "Onarım ·" öneki yok), hasar, bitiş ya da başlama süresi, İptal (iade onayı aynı).

Ortak parçalarda:
- `QuantityStepper` `look="kit"`: 44 px adımlar kendi tık sesi ve titreşimiyle; tavana ulaşan son basış ağır titreşim. Sınıfları `gk-qty*` (kitin `CountBadge`'i `gk-count` kullanıyordu, ilk denemede çakıştı).
- `GameHold` fiili uzunluğuna göre küçülüyor (`--gk-len`, kap sorgusu): "2 Schiffe reparieren" 320 px'te kesiliyordu. Kısa fiiller 24 px kalıyor.
- Çift ses düzeltildi: bina kartının açma düğmesi ve `InfoPeek`'in "?" düğmesi kendi sesini çalıyordu ama işaretsizdi; genel karıştırıcı ikinci kez tıklıyordu. `InfoPeek` kuralı artık liste taşıyabiliyor (`p` yerine `div`).
- Tip ölçeği testi: G2-c'nin arıza satırı parası (`.gk-frow__coin`) yalnız simge taşıyor; testin simge listesine eklendi (yardımcı ajan buldu).
- `atmosphere.css`: yalnız eski karttaki ve kahramandaki kurallar ve artık hiçbir yerin okumadığı `--section-material` değişkenleri silindi; başlangıç galaksisindeki `YardDeck` `.repair-scene`'i kullanmaya devam ediyor.

Metin (6 dil): yeni `damagedShips`, `maintenance.order` (İş emri), `maintenance.back` (Geri al), `maintenance.scrapSelected`, `maintenance.radiationShort`, `tooManyShort`. Kullanılmayan `statWaiting`, `statRepairing`, `queueHeading`, `maintenance.scrapAction`, `maintenance.scrapConfirm`, `maintenance.keep` silindi. Daha önce ölü olan `outOfAction` (Geri al modunun açıklaması) ve `maintenance.select` yeniden kullanılıyor.

Ölü kod adayı (benden önce de kullanılmıyordu, silinmedi; owner'a liste): `repairStation.statQueue`, `tagline`, `industrialChip`, `selectNone`, `choose`, `noneWaiting`, `share`, `selected_one/_other`.

Owner'ın bakması için: parçalama onay penceresi 1,5 sn basılı tutmaya döndü (yardımcının C4 engelleme ve C6 döteryum aktarımıyla aynı çizgi). Geri alınabilir küçük bir değişiklik.

Kit sayfasına üç görünüm eklendi ve denetim bunları ölçüyor: `repair-station-hangar`, `repair-station-queue`, `repair-station-radiation`.

Ölçüm: `reports/ui-audit/g2f-after-2026-11-14.md` (yedi görünüm, 6 dil, telefon, dar ve masaüstü; 98 ölçüm). Sheet'in son ölçümü 4.1'deydi (`reports/ui-audit/4.1-2026-11-12.md`, telefon, tr):

| `repair-station` | 4.1 | G2-f |
|---|---|---|
| 12 px altı metin | 68/81 | 0/50 |
| Kontrast hatası | 20 | 0 |
| 44 px altı hedef | 26/26 | 1/24 |
| Basınca tepkisiz | 22 | 1 |
| Kelime | 135 | 92 |

Kalan tek hedef ve tek tepkisiz alan G1 sheet çerçevesinin 2×2 px arka plan düğmesi (yardımcının C5–C7 ölçümlerinde de var). Boş istasyon 28/35 → 0/22 küçük metin, 15/15 → 0/15 küçük hedef. Kesilen ve kırpılan metin bütün dillerde ve boyutlarda 0. Ekran başına 12–20 kelime (bütçe 55). Filo sekmesinde (`base-fleet`) 12 px altı metin 15'ten 9'a indi; kalanların hepsi hangar odası çubuğunda (v2 `RoomBar`, G2-h).

Bilerek bırakılan: 0'dayken kilitli eksi düğmesinin simgesi 2,4:1. Pasif kontrol (WCAG 1.4.11 muaf); soluk görünmesi "daha aşağı inemezsin" demek.

Ölçümden sonra düzeltilenler (yeniden ölçüldü): sayaçtaki "Tümü" 26 px genişlikteydi, adım düğmeleri 43 px yüksekliğindeydi (çerçeve içinde); sayı alanına dokununca görünür bir tepki yoktu, şimdi turkuaz çerçeve yanıyor.

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

**C7 İstihbarat sayfası ve Gözlem rafı ✅ (2026-11-14, yardımcı oturum).** G3 #1–#5. Oyuncunun sorusu şu: "Komşularım hakkında ne biliyorum, kime saldırabilirim?" Teleskop, sonda ve radar kuralları değişmedi.

**İç içe sekme kalktı.** Raporlar rafının içindeki ikinci sekme çubuğu (Sondalar / Savaşlar) yok artık. Dört raf tek sıradaki kit sekmelerinde duruyor: Gözlem, Sondalar, Savaşlar, Radar. Sekmeler `GameTabs stacked`; her sekmede adın üstünde işareti var (göz, büyüteç, saldırı, siren).
- Sekmedeki ad kısa ("Sondalar"). Okuyucu tam adı duyar ("Sonda raporları").
- Bildirimden gelen savaş raporu doğrudan Savaşlar rafına iner.
- `intel.shelf.probes` ve `intel.shelf.battles` 6 dilde eklendi. Kullanılmaz hâle gelen `intel.shelf.reports` ve `intel.tabs.label` silindi.
- Japoncada Gözlem sekmesi "時計" (kol saati) yazıyordu. "監視" yapıldı.

Sayfa artık kitin başlığıyla açılıyor (`kit={{ tone: 'self' }}`).

Gözlem rafı:
- **Teleskop yuvaları:** her yuva bir mercek (`.gk-lens`).
  - Dolu mercek oyuncunun renginde parlıyor; hedefin resmi ve adı içinde.
  - Boş mercek kesik çizgili ve yavaşça yanıp sönerek bekliyor.
  - Sıradaki seviyede açılacak mercek kilitli; hangi seviyede açılacağı yazıyor.
  - Not: Üs'te `.gk-socket` adı zaten kullanılıyordu. Çakışmasın diye bu malzemenin adı `gk-lens` oldu.
- **İşaretli rakipler:** menüdeki rakip çipinin aynısı (`gk-chip gk-rival` ve 44 px'lik dokunma alanı). Bir rakip iki yerde aynı görünüyor.
- **Bildiklerin:**
  - Her satır C6'nın defter satırı ve bir kapı: basınca dünyanın dosyası açılıyor.
  - Filo durumu satırda bir etiket. "Pencere 1 sa 12 dk" oyuncunun renginde bir çip.
  - "Netlik ve yaş" kuralı yardım işaretiyle bir dokunuş derinde.
- **Radar özeti:** basılabilir bir plaka. Son 24 saatin çizgisinde son 6 saatteki temaslar kırmızı yanıyor.
- 9–10 px'lik bütün notlar 12–14 px'e çıktı.
- v2 `AgeStamp` ve `ClarityMark` 11 px'ten 12 px'e çıktı. `TargetDossier` de bu değişiklikten yararlanıyor.

Galeriye `intel-blind` görünümü eklendi: teleskop yok, radar yok, işaret yok, bilinen yok.

Ölçüm: `reports/ui-audit/c7-intel-watch-after-2026-11-14.md`, iki yol, 28 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 136 | 10 |
| Kontrastı yetmeyen metin | 72 | 4 |
| 44 px altı hedef | 22 | 6 |
| Basınca tepkisiz | 16 | 2 |
| Kesilen metin (bütün diller) | 49 | 0 |

Kalanlar:
- 12 px altındaki 10 metin, 44 px altındaki hedefler ve tepkisiz "Yörüngeyi aç" tuşu alet kartına ait (C9).
- Kalan küçük hedeflerin bir kısmı G1 sheet'inin 2×2 px'lik arka perdesi.
- Kontrastı yetmeyen 4 metnin ikisi de alet kartında.
- Diğer ikisi eski sonda raporunun yaş yazısıydı ("19 sa 00 dk önce", 3,7:1). Ölçümden sonra yaş yazısı her yaşta ikinci mürekkebe alındı; yaşı artık resmin grenli dokusu anlatıyor. Bu düzeltme yeniden ölçülmedi.

Almanca metin "Sie" diye hitap ediyor ("In jedem Slot, den Sie haben"). Bu, sıradaki Almanca hitap biriminin işi.

**C8 Sondalar rafı ✅ (2026-11-14, yardımcı oturum).** G3 #6, karar desteğinin kalbi. Oyuncunun sorusu şu: "Sonda ne getirdi, bu dünya benimkine göre büyük mü küçük mü, saldırmaya değer mi?" Aralık mantığı (`probeAxis`, sıfırdan başlayan çizgi, bantta "benim değerim") ve sonda kuralları değişmedi.

- **Anahtar satırı:** rafın tepesinde küçük turkuaz bir çizgi ve "bant onların tahmini, turkuaz çizgi senin dünyan" cümlesi. Aşağıdaki her satırın nasıl okunacağı tek yerde söyleniyor.
- **Rapor kartı:** kitin plakası (`.gk-probe`).
  - Baş: dünya resmi, ad, doğruluk, sinyal çubukları ve yaş. Dosya açılabiliyorsa başın tamamı dosyaya giden kapı.
  - Ölçümler (stok, silahlı birlik değeri, gemi) bir cam kuyuda duruyor (`.gk-readings`).
  - Bantlar 14 px'lik izde; "sen" çizgisi turkuaz ve hafif parlıyor.
  - Değerler 12 px ve kalın.
- **Kart altı:**
  - "Sondayı yakaladılar" uyarısı göz işaretiyle amber renkte.
  - "Dosyayı aç" kitin küçük tuşu. Karakol raporundaki "Saldır" kitin kırmızı tuşu.
  - İki tuş da öğreticinin işaret ettiği `data-report-open` işaretini koruyor.
- **İlk av kartı (`HuntHowTo`):** oyuncunun renginde kenarı olan bir kural kartı; yazı 9 px'ten 13–14 px'e çıktı.
- **Çeviri düzeltmeleri:**
  - Almancada "yakalandı" cümlesi bozuktu ("Sie haben es erwischt\nDie"). "Die Sonde wurde entdeckt" yapıldı.
  - Japoncada "Dosyayı aç" ses taklidiydi ("オープンドシエ"). "調査書を開く" yapıldı.
- **C7'den kalan kırık test:** C7'nin grup testlerinde `starter-outpost-reading` eksikti. Bu test hâlâ eski Raporlar sekmesini arıyordu; artık "Sonda raporları" sekmesine basıyor.
- **Galeri:** `intel-probes` görünümü eklendi.
- **Sınıf adı:** `.gk-range` Üs'te zaten kullanılıyordu. Çakışmasın diye bu malzemenin adı `.gk-reading` oldu.

Ölçüm: `reports/ui-audit/c8-intel-probes-after-2026-11-14.md`, bir yol, 14 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 50 | 0 |
| Kontrastı yetmeyen metin | 20 | 0 |
| 44 px altı hedef | 8 | 0 |
| Basınca tepkisiz | 4 | 0 |
| Kesilen metin (bütün diller) | 12 | 0 |

Doğrulanamayanlar:
- Gemideki av (karakol okuması ve "Saldır") galeride yok; yalnız testlerle doğrulandı.
- `OutpostReading` başlangıç ekranlarına ait (G15); ona dokunulmadı.

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

**C1 dönüş hikâyesi ✅ (2026-11-14, yardımcı oturum).** Oyuncunun anı: en az 30 dakika sonra oyuna dönünce, galaksi açılır açılmaz "ben yokken ne oldu?" sorusunun cevabı. Asıl karar hangi kapıdan önce gireceği: rapor, radar, rakibin dosyası ya da onarım. Hangi üç satırın, hangi sırayla söylendiği (önce tehdit, sonra kazanç, sonra fırsat) ve pencerenin ne zaman kapandığı değişmedi.

Karar: satırlar G1-e'deki zilin haber satırıyla aynı dilde olur; hikâye ayrıca bir "rapor okunuyor" hissi taşır. Eski kapılar satırın altında 20 px'lik bağlantılardı; şimdi bütün satır kapının kendisi.

Önce kite eklenen: `NewsRow` `detail` (cümlenin altında, daha sönük, neye vardığı) ve `open.shown` (satırın nereye açıldığı cümlenin altında yazılır; okuyucu bunu basışta bir kez duyar).

Dönüş hikâyesi:
- Her satır kitin haber satırı. Para satırın ağırlığını taşıyor: tehdit kırmızı, kazanç yeşil, fırsat galaksinin mavisi. Hepsi son girişten beri yeni, bu yüzden parlak ve noktalı. İşaretler: tarama nişangâh, akın kalkan, kendi akının saldırı, konvoy sandık, dönen filo geri dönüş, birikim maden, açılan sistem kilit, teleskop göz.
- Savaşın zemini nasıl gittiğini söylüyor: tutulan savunma yeşil, alınan akın kırmızı, geri püskürtülen kendi akının amber (kayıp, tehdit değil; kırmızı K2'nin).
- Bütün satır 56 px'lik tek basış. Altında "Radarı aç ›" gibi kapısı yazıyor; sesi ve titreşimi kitin.
- Satırlar sırayla, 120 ms arayla, soldan kayarak geliyor; rapor okunur gibi. İlk satır ağırlığı taşıyor: daha büyük para ve yazı. Hikâye ilk satırının ağırlığıyla açılıyor: tehditse uyarı sesi, değilse onay sesi. Gemideki hikâye kendi kahraman satırının sesini çalıyor.
- Onarım isteyen dünya kitin sarı uyarı şeridi. Başında yalnız dünyanın adı var, altında sadakat ve arıza sayısı. Yanında 44 px'lik "Onar" düğmesi. Eski hâli satır içinde 12 px altı çizili bir kelimeydi.
- Alttaki iki çıkış kitin düğmeleri: "Tümü (n)" çelik, "Galaksiye dön" turuncu eylem.
- Kit sayfasına "Dönüş hikâyesi" bölümü eklendi.

Gemideki hikâye (kahraman satırı, "Ayrıntılar" açıcısı, çevrimiçi olan sistemler) G15'te ele alınacak; yalnız açılan ayrıntı satırları bu kit satırını kullanıyor.

Ölçüm: `reports/ui-audit/c1-away-after-2026-11-14.md`, `gallery:away`, 14 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 36 | 0 |
| 44 px altı hedef | 12 | 0 |
| Basınca tepkisiz | 6 | 0 |
| Yazı alışkanlığı | 0 | 0 |

Kalan: ekran başına kelime 56 / 55. Bunlar hikâyenin kendisi (üç satır ve neye vardıkları); daha da kısaltmak satırın karar değerini düşürür. Sheet'in kararmış arka planı "adsız dokunulabilir alan" sayılıyor; sheet çerçevesinin işi, öncesinde de vardı.

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

**C2 sohbet ✅ (2026-11-14, yardımcı oturum).** Oyuncunun anı: galaksideki sohbet düğmesine basıp odaya bakmak, konuşmak ya da klanla plan yapmak. Asıl kararlar şunlar: hangi odadayım (Galaksi, Klan, Özel), galaksi odası hangi dilde, mesajı yazıp göndermek. Odaların kuralları, okunmamış sayıları ve dil tercihinin cihazda saklanması değişmedi.

Önce kite eklenenler:
- `TabItem.spoken`: sekmenin okuyucuya söylenen tam adı ("Klan — 2 okunmamış"). Göz sayıyı okur. Altındaki bir olgu (`mark`) varsa önce o söylenir.
- İki işaret: `mute` (üstü çizili hoparlör) ve `block` (giriş yok levhası).
- `.gk-langchip`: odanın bayrağı; basınca altına altı bayrak düşer (`gk-langdrop`).
- `.gk-round:disabled`: gönderecek bir şey yokken tuş söner ve basınca kıpırdamaz.
- Japonca sekme adı bölünmez (`html:lang(ja) .gk-tab`, "クラ/ン" gitti).

Sohbet:
- Sayfa başlığı artık kesilmiyor. Telefona özel sıkıştırma (12 px tutamak, 28 px tuşlar) G1-g1'in 44 px tutamağıyla başlığı sayfanın kenarının altına itiyordu; kaldırıldı. Çerçeve her sheet'teki kit çerçevesi.
- Başlıktaki iki liste (sessize alınanlar, engellenenler) kitin küçük yuvarlak tuşları ve kendi işaretleriyle.
- Odalar kitin sekmeleri: Galaksi konuşma balonu, Klan sancak, Özel mektup. Okunmamış sayısı köşedeki kırmızı sayı; okuyucu "Klan — 2 okunmamış" duyar.
- Galaksi odasının dili yerli `<select>` yerine bayrak çipi. Basınca kitin altı bayraklı dil seçicisi satırın altına açılır, bir bayrak seçince kapanır. Oyunun kendi dili değişmez. Oda değişince açık seçici kapanır.
- Boş oda kitin boş durumu: sohbet resmi süzülür; başlık "Henüz kimse konuşmadı", altında "Galaksideki ilk ses sen ol." Klan için klan resmi ve kendi cümlesi. Gizlenen mesajlar için de aynı dil ("Görünen mesaj yok" ve neden). Klansız oyuncunun kilitli odası da aynı parça.
- Yazma alanı kitin cam yuvası (44 px, metin ortada). Gönder tuşu kitin parlak yuvarlak tuşu; boşken söner, yazınca yanar. Klavye için odak koruması aynı kaldı.
- Sohbetin yazı ölçeği kitin tabanında: saat, alıntı ve notlar 12 px, adlar 13 px. Saatler, alıntılar ve kalan karakter sayısı bir ton açıldı.
- Galeriye üç görünüm eklendi (`chat`, `chat-empty`, `chat-clan`) ve denetimin sohbet yollarına yazıldı.

Ölçüm: `reports/ui-audit/c2-chat-after-2026-11-14.md`, üç yol, 42 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 56 | 0 |
| Kontrastı yetmeyen metin | 20 | 0 |
| 44 px altı hedef | 86 | 14 |
| WCAG aralık hatası | 32 | 8 |
| Basınca tepkisiz | 40 | 15 |
| Kırpılan metin | 36 | 0 |

Kalanlar mesaj balonlarının içinde ve C3'ün işi: tepki çipleri, yazar adının dünyaya uçuran bağlantısı, sezon kupası ve destekçi kalbi; uzun basışla açılan eylem çubuğu ve emoji seçici (28 px). Üç noktayla kesilen 12 metnin hepsi yanıtlanan mesajın tek satırlık alıntısı; önizleme olduğu için bilerek böyle.

**C3 sohbetin köşeleri ✅ (2026-11-14, yardımcı oturum).** G8 #2 DM paneli, #3 medya ve tepkiler, #4 içerik bildir. Oyuncunun anları şunlar: bir mesaja basılı tutup ona cevap vermek, tepki bırakmak, susturmak, bildirmek ya da engellemek; birinin tepkisine bakıp kimlerin bıraktığını görmek; yazarın adına dokunup dünyasına uçmak; özel mesajda kiminle konuştuğunu seçmek, yeni birine yazmak, gerekirse engellemek. Mesaj, tepki, bildirim ve engel kuralları değişmedi.

Önce kite eklenenler:
- Üç işaret: `react` (gülen yüz), `reply` (geri dönen ok), `flag` (bildirme flaması).
- `Choices` artık `columns={2}` alıyor; çok cevaplı bir soru iki sütuna diziliyor. Henüz cevaplanmamış bir soruda Tab ilk cevaba gidiyor; önceden klavye gruba hiç giremiyordu.
- Malzemeler:
  - `.gk-keystrip`: tutulan mesajın tuş şeridi.
  - `.gk-emoji`: 44 px emoji tuşu.
  - `.gk-react`: 28 px hap üstünde 44 px tepki tuşu.
  - `.gk-peers` / `.gk-peer`: özel mektup plakaları.
  - `.gk-contact`: yazılacak komutan satırı.
  - `.gk-pop`: yanında açılan küçük panel.
- Çok satırlı cam alan (`textarea.gk-field__input`) üstten nefes alıyor.

Sohbet:
- Basılı tutulan balon parmağın altında yavaşça çöküyor. Tuşlar açılınca balon kendi renginde yanıyor ve tuş şeridi balonun altından çıkıyor. Önceden şerit balonun yazısının üstüne biniyordu.
- Tuşlar kitin küçük yuvarlak tuşları: tepki, sustur (ortada, sahibin kararı), yanıtla, bildir, engelle (kırmızı). Önceden 28 px ve yarısı karakterden (☺ ↩) yapılmıştı.
- Emoji seçici altı adet 44 px tuş. Seçtiğin emoji kendi renginde basılı duruyor. Basınca bir tık ve bir titreşim geliyor.
- Tepkiler kitin hapları. Senin tepkin kendi renginde. Basınca tepkiyi bırakanların paneli açılıyor; kapatma tuşu kitin yuvarlak tuşu, satırlar 40 px.
- Yazar adı ve sezon kupası/destekçi kalbi 44 px tuş. Satır yüksekliği değişmedi; dokunma alanı satırın dışına taşıyor. Yazar adı dünyaya uçarken artık ses de veriyor.
- Yanıt iptali kitin küçük yuvarlak tuşu. "Daha eski mesajlar" kitin tuşu. Yazılamayan konuşmanın nedeni kilit işaretiyle 13 px.

Özel mesaj:
- Açık konuşmalar plaka. Okunmamış sayısı kırmızı sayı. Kapatma tuşu yalnız açık olanda, 44 px. Yeni konuşma tuşu kitin yuvarlak artısı.
- Hiç konuşma yoksa sekme satırı gizleniyor. Kitin boş durumu "Henüz özel mesaj yok" diyor ve altında "Yeni DM başlat" tuşu var; önceden yalnız bir cümle vardı.
- Komutan arama kitin cam alanı, "Vazgeç" kitin tuşu. Komutanlar arması, adı ve mektup işaretiyle 52 px satırlar.
- Engelleme düğmesi yazılı bir kit tuşu ("Engelle" kırmızı, "Engeli kaldır" çelik). Başlıktaki engellenenler listesinin yuvarlak tuşuyla karışmıyor. Okuyucu kimi engellediğini duyuyor. Yolda olan bir engel ikinci basışı göndermiyor.

İçerik bildir:
- İki yerli `<select>` kalktı. "Neyi bildiriyorsun?" iki plaka. Yedi neden iki sütunda.
- Gönder tuşu neden seçilene kadar "Bir neden seç" diyor. Gönderirken dönen bir işaret gösteriyor. Makbuz kitin yeşil bandı, numarası altında. Form açıkken alttaki ikinci "Kapat" kalktı; başlıktaki kapatma yetiyor.

Medya (yönetici ekler, herkes görür):
- Ekle, Fotoğraf, Video, YouTube, Ekle/İptal/Yeniden dene kitin tuşları. Bağlantı alanı cam alan.
- Tam ekran fotoğrafın kapatma tuşu kitin yuvarlak tuşu. Dikey/yatay geçişi kitin tuşu.

Galeriye sekiz görünüm eklendi: `chat-dm`, `chat-dm-empty`, `chat-dm-new`, `chat-actions`, `chat-react`, `chat-roster`, `chat-report`, `chat-media`. Basış isteyen görünüm, varınca o basışı kendisi yapıyor. Denetimin sohbet yollarına yazıldılar; "ulaşılamayan" listesinde yalnız engellenenler ve sessize alınanlar kaldı (C4).

Ölçüm: `reports/ui-audit/c3-chat-corners-after-2026-11-14.md`, dokuz yol, 126 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 28 | 2 → 0 |
| Kontrastı yetmeyen metin | 6 | 4 |
| 44 px altı hedef | 138 | 20 |
| WCAG aralık hatası | 20 | 10 |
| Basınca tepkisiz | 74 | 6 → 0 |
| Üç noktayla kesilen metin | 79 | 89 → 79 |
| 300 ms üstü geçiş | 0 | 64 → 0 |

Ölçümden sonra dört şey düzeltildi; "→" ile gösterilenler `gallery:chat` ve `gallery:chat-actions` yolları yeniden ölçülerek (28 ölçüm) ve bir sonda ile doğrulandı:
- Tepki panelinin başlığı 10 px'ti. Panel sohbetin dışına açıldığı için sohbetin yazı tabanı ona uygulanmıyordu; artık kitin 14 px'ini alıyor.
- Fransızca dar ekranda yazar adı ("Mira") sıkışıp kesiliyordu. Kupa ve kalp tuşları 44 px kalıyor ama yanlarındaki boşluktan 6'şar px ödünç alıyor.
- Yazma alanı bir etiketin içindeydi; basınca yanan kenar etikete gidiyordu. Artık alan kendi adını taşıyor.
- Balonun çökme süresi 450 ms'ten 280 ms'ye indi.

Kalanlar:
- Kontrast: tutulan mesajın tuş şeridinin altında kalan saat yazısı.
- 44 px altı: listenin tepesinde neredeyse görünmeyen balonun 14 px'lik ucu ve tepki panelinin altında kalan sekme. İkisi de gerçek bir küçük hedef değil.
- Kesilen metin: yanıtlanan mesajın tek satırlık alıntısı (bilerek böyle) ile Fransızca, İspanyolca ve Japoncada sheet başlığı ("Signaler un contenu ou un joueur"). Başlık G1'in çerçevesinin işi.

**C4 susturulanlar, engellenenler, topluluk kuralları ✅ (2026-11-14, yardımcı oturum).** G8 #5, #6, #7. Oyuncunun anları şunlar: kimi susturduğunu ya da engellediğini görüp geri almak; sohbette rahatsız eden birini engellemek; ilk kez yazmadan önce kuralları okuyup kabul etmek. Susturma, engel ve kural kabulü kuralları değişmedi.

Önce kite eklenenler:
- `GameButton.spoken`: tuşun okuyucuya söylenen tam adı. Yüzünde "Engeli kaldır", okuyucu "Vega'nın engelini kaldır" duyar. Aynı tuştan oluşan bir listede her tuş kimin olduğunu söyler.
- `PersonRow` ve `crestOf` (`screens/CommunityBlocks.tsx`): bir listedeki tek komutan; arma, ad ve yapılacak tek iş. C3'teki komutan satırı da aynı armayı kullanıyor.
- Malzemeler:
  - `.gk-person`: listedeki komutan satırı.
  - `.gk-note`: okunan dipnot (12 px, ikinci mürekkep).
  - `.gk-linkchip`: oyundan dışarı çıkan bağlantı çipi (↗).
  - `.gk-agree` ve `.gk-check`: kabul satırı ve onay kutusu. Kutu işaretlenince oyuncunun renginde yanıyor; satırın tamamı dokunma alanı.

Yüzeyler:
- **Susturulanlar ve Engellenenler:** her komutan kitin satırında, kendi tuşuyla. Liste boşsa kitin boş durumu "nasıl eklenir"i söylüyor ("Birini susturmak için mesajına basılı tut."; iki yeni anahtar ×6). Engellenenlerde alttaki ikinci "Kapat" kalktı; başlıktaki kapatma yetiyor.
- **Oyuncuyu engelle:** "Engellemek istiyorum" kutusu ve "Engeli onayla" düğmesi tek bir kırmızı basılı tutmaya dönüştü (`GameHold`, geri alınabilir ağırlık, 0,6 sn). Basılı tutmak zaten "emin misin?" demek. Klavyede Enter, sonra yine Enter. Sonuç kitin yeşil bandı. Kullanılmaz hâle gelen `moderation.blocks.confirm` anahtarı 6 dilden silindi.
- **Topluluk kuralları** (sohbet ve klan sohbeti): bağlantılar çip, kutu kitin kutusu. Kabul tuşu kutu işaretlenmeden "Önce kuralları kabul et" diyor (yeni anahtar ×6) ve gönderirken dönüyor. Kayıttaki "katılmak kabul etmektir" notu (G15) değişmedi.

Galeriye beş görünüm eklendi: `chat-muted`, `chat-muted-empty`, `chat-blocked`, `chat-block`, `chat-policy`. Denetimin sohbet yollarına yazıldılar; sohbette ulaşılamayan yüzey kalmadı.

Ölçüm: `reports/ui-audit/c4-chat-lists-after-2026-11-14.md`, beş yol, 70 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 44 | 0 |
| Kontrastı yetmeyen metin | 2 | 0 |
| 44 px altı hedef | 18 | 4 |
| WCAG aralık hatası | 4 | 0 |
| Basınca tepkisiz | 12 | 2 |
| Kırpılan metin | 0 | 5 |

Ölçümden sonra üç şey düzeltildi ve dört dilde ekran görüntüsüyle bakıldı (yeniden ölçülmedi):
- Kırpılan 5 metin, Fransızca ve Almancada basılı tutma tuşundaki "Confirmer le blocage" idi. Tuştaki söz artık tek fiil ("Engelle", "Bloquer", "Blockieren"); sheet'in başlığı zaten "Oyuncuyu engelle" diyor.
- Dar Türkçe ekranda susturulanlardaki "Kael Draven" kesiliyordu. Ad artık kesilmiyor, gerekirse ikinci satıra iniyor.
- Tepkisiz 2 hedef, kabul satırıydı. Satır basınca hafifçe aydınlanıyor.

Kalan 4 küçük hedef, sheet'in arkasında kalan sohbetin yarım görünen yazar adı. Yeni bir küçük hedef değil.

**C5 duyurular ve geri bildirim ✅ (2026-11-14, yardımcı oturum).** G8 #8 ve #9. Oyuncunun iki anı var. Birincisi ekipten yeni bir söz gelince onu ilk bakışta ayırmak. İkincisi ekibe bir şey yazmak ve gittiğini görmek. Duyuru okundu işareti ve geri bildirim gönderme kuralları (en az 3 harf, 2000 sınırı) değişmedi.

Önce kite eklenenler:
- `.gk-notice`: duyuru plakası. Yeni bir duyuru plakanın kenarında oyuncunun rengiyle yanar.
- `.gk-newtag`: yavaş parlayan "YENİ" etiketi. Duyuru okundu sayılsa da bu ziyaret boyunca yanık kalır. Oyuncu açtığı anda neyin yeni olduğunu kaybetmez.

Yüzeyler:
- **Duyurular:**
  - Her duyuru bir plaka. Başlık 16 px, metin 14 px ve ikinci mürekkepte (eskisi 13 px, soluk).
  - Boş sayfa kitin boş durumunu kullanıyor. Başlığı "Henüz duyuru yok", altında "Ekibin kısa notları ve güncellemeleri burada görünecek." Bunun için yeni `emptyTitle` anahtarı eklendi ve `empty` ikinci cümlesine indi; 6 dilde.
- **Geri bildirim:**
  - Tür seçimi kitin plakalarında (`Choices`); eski `Segmented` kalktı.
  - Mesaj kitin cam alanında.
  - Kalan karakter sayısı okunur bir dipnot.
  - Gönder tuşu eksik olanı kendisi söylüyor: "En az 3 harf yaz" (yeni `tooShort` anahtarı ×6). Gönderirken dönüyor.
  - Gönderim sonrası kitin yeşil bandı çıkıyor.

Galeriye üç görünüm eklendi: `announcements`, `announcements-empty`, `feedback`. Denetimin yollarına yazıldılar.

Ölçüm: `reports/ui-audit/c5-community-after-2026-11-14.md`, üç yol, 42 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 14 | 0 |
| Kontrastı yetmeyen metin | 4 | 0 |
| 44 px altı hedef | 6 | 0 |
| Basınca tepkisiz | 5 | 0 |
| Kesilen / kırpılan metin | 0 | 0 |
| 300 ms üstü geçiş | 0 | 0 |

Ekran görüntüleri dört dilde çekildi. Almancada gönder tuşu iki satıra iniyordu; söz "Mindestens 3 Zeichen" diye kısaltıldı. Japoncada boş sayfa cümlesinin son hecesi tek başına alt satıra düşüyordu; cümle kısaltıldı. Bu iki düzeltme ölçümden önce yapıldı.

**C6 Bildirim Merkezi ✅ (2026-11-14, yardımcı oturum).** G8 #10. Oyuncunun sorusu şu: "Saldırı gelirse haberim olur mu, bu bana kaça mal olur?" Sheet bu soruyu yukarıdan aşağıya cevaplıyor. Önce kasa ve kaç uyarıya yettiği geliyor, sonra zamanlama ve fiyatı, sonra hangi uyarıların açık olduğu. Uyarı fiyatları, kasa kuralı ve gönderim kuralları değişmedi.

Kite eklenenler (malzeme):
- `.gk-wallet`: kasa plakası. Kasa en az bir uyarıyı ödüyorsa oyuncunun renginde, ödemiyorsa amber.
- `.gk-rate`: zamanlama kadranı. Her satırda bir lamba ve o zamanlamada bir uyarının fiyatı var.
- `.gk-ledger`: sabit bir defter satırı (işaret, ad, alt satır, yan değer). Kurulmadan önceki üç ücretli tür ve son uyarılar bunu kullanıyor.
- `.gk-switches`: bir plakada toplanmış anahtarlar.
- `.gk-rules`: kuralları açan satır.
- `.gk-deut`: döteryum ve miktar.
- `.gk-center__*`: soru, uyarı ve geri alınamaz satırı.

Yüzey:
- Sheet artık kitin başlığında açılıyor; başlıkta vericinin resmi duruyor.
- 9–10 px yazıların hepsi 12–14 px'e çıktı.
- **Kur ve aktar artık basılı tutma.** Kitin "harcar" ağırlığı kullanılıyor (`GameHold`, 1 sn). G2-d'deki onarım da aynı ağırlığı kullanıyor.
  - Aktarmanın eski onay penceresi kalktı. "Kasadaki döteryum geri aktarılamaz" cümlesi artık kilit işaretiyle tuşun üstünde, harcamadan önce görünüyor.
  - Tuş eksik olanı kendisi söylüyor. Kurarken "Kaynak yetmiyor". Aktarırken "Tam bir miktar yaz" ya da "Depoda bu kadar yok".
  - Kullanılmaz hâle gelen dört anahtar 6 dilden silindi: `confirmTitle`, `confirm`, `back`, `walletAfter`.
- `buildShort` artık yalnız ne yapılacağını söylüyor: "Başka bir dünya seç ya da kaynak birikmesini bekle."
- Yeni anahtarlar, her biri 6 dilde: `buildShortReason`, `amountFirst`, `amountOver`.
- `local.section` "Sipariş hatırlatmaları" diye kısaldı. Üç kelimeden uzun, büyük harfli küçük başlık olmasın diye.
- **Zamanlama:** dört lambalı satır, her birinde uyarı başına fiyat.
- **Ücretli türler:** kitin anahtarı. Satırda türün işareti, adı ve fiyatı var.
- **Telefon izni ve geç uyarı kartları:** kitin amber bandı ve altında kitin turuncu tuşu.
- **Bekleyen ayar:** bir ayar sunucuya giderken ikinci dokunuş yok sayılıyor. Böylece iki hızlı dokunuş birbirini silemez. Yeni bir testle kontrol ediliyor.

Ölçüm: `reports/ui-audit/c6-notification-center-after-2026-11-14.md`, üç yol, 42 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 156 | 0 |
| Kontrastı yetmeyen metin | 52 | 4 |
| 44 px altı hedef | 12 | 4 |
| Basınca tepkisiz | 13 | 2 |
| Kesilen / kırpılan metin | 0 | 0 |

Kalanların hepsi G1'in sheet çerçevesine ait:
- Kontrast: kit başlığında, atmosfer resmi üstündeki göz başlığı ("Telefon uyarıları", 4,3:1).
- Küçük hedef ve tepkisiz hedef: tam ekran diyalogda neredeyse görünmeyen 2×2 px'lik arka perde düğmesi.

Ekran görüntüleri dört dilde çekildi: üst, orta, kurallar açık alt, kurulmamış merkez, geç uyarı. Ölçümden önce iki şey düzeltildi:
- Almancada son uyarılar satırındaki ad üç noktayla kesiliyordu. Ad artık kesilmiyor, alt satıra iniyor.
- Almancada geç uyarı tuşu iki satıra iniyordu. Söz "Pünktlich zustellen" diye kısaltıldı.

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
