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
- `v2/kit/ResourceMeter.tsx`: yalnız galeri ve kendi testi. (2026-11-14'te silindi.)
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
- Savunma sekmesinin başındaki özet kutuları (Ateş gücü, Savunma, Kalkan, Risk altında) v2 dilinde ve 9 px yazılı. G2-g'ye eklendi. (✅ G2-g'de kitte.)
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

Owner'a soru (G2-e ve G2-h'yi bekletiyor): Bu yarım `RoomGauge` işini sahiplenip G2-e/G2-h'de bitireyim mi, yoksa o oturum dönecek mi? Cevap gelmezse G2-f ve G2-g'den sonra G2-e yapılır; oda çubuğu o zamana kadar v2 `RoomBar` olarak kalır ve G2-h'de kite geçer. **Yanıt (owner, 2026-11-14): benim görevim.** G2-e'de bitirildi (aşağıda).

**G2-f onarım istasyonu ✅ (2026-11-14).** Oyuncunun anı: savaştan yaralı gemiler döndü; "hangilerini onarıp savaşa geri sokayım, hangilerini parçalayayım, ne kadar tutar?" Kurallar (ücretsiz aktarım, ücretli onarım, sıra derinliği, iptalde yarı iade, radyasyon kapanışı, 50 grup sınırı, aynı isteğin aynı anahtarla tekrarı) değişmedi.

- Kart (Filo sekmesi, iki sütun) v2'den kitin metaline geçti: 242 px'ten 114 px'e. Tamirhane resmi kartın sağında, yazı solda metal bir örtü üstünde. Ad, sıra doluluğu (dolunca uyarı renginde), görev cümlesi, "3 gemi bekliyor" ve "4 onarımda" etiketleri, çalışan işin çubuğu ve süresi. Onarım sürerken resimdeki kaynak ışığı yanıp sönüyor. Bütün kart tek kapı: kendi sesi ve titreşimiyle açılıyor, basınca iniyor (eskiden basınca tepkisizdi).
- Sheet: 250 px'lik kahraman resmi kalktı; resim başlığın arkasında, altında "Şu an %75 ödüyorsun". Kural tek satır, ayrıntısı "?" ile açılıyor (`InfoPeek`). Üç istatistik kutusu ve iki `Segmented` kalktı.
- Yerler sekme oldu: Hangar / Tamirhane / Kuyruk 2/3. Hangar ve Tamirhane sekmesinde karar bekleyen gemi sayısı rozet olarak var (okuyucu "Hangar · 8 hasarlı gemi" duyar). Sheet karar bekleyen yerde açılıyor: önce evdeki yaralılar, sonra tamirhanede bekleyenler, sonra kuyruk.
- İş emri bir şalter (`Lever`): Hangarda Onarım / Parçalama; Tamirhanede Onarım / Geri al / Parçalama. Yer değişince seçim de iş emri de sıfırlanıyor; parçalama bir sekmeden ötekine taşınmıyor. Radyasyonda tamirhane "Geri al"da açılıyor (tahliye, radyasyonun kapatmadığı tek iş).
- Altta her zaman tek eylem: Hangarda "Tamirhaneye aktar" (ücretsiz, geri alınabilir: düz basış), Tamirhanede "N gemiyi onar" 1 sn basılı tutma (harcayan), "Hangara geri al" düz basış, Parçalama kırmızı basılı tutma (önce 1,5 sn; owner 2026-11-14: 0,6 sn). Eski parçalama onay penceresi kalktı; geri dönecek kaynaklar (sıfır olanlar da) basmadan önce altta yazıyor, üstte kilit işaretiyle "Anında ve geri alınamaz". Kilitli düğme sebebini yüzünde söylüyor ("Gemi seç", "Onarılacak gemileri seç", "Kuyruk dolu · 3/3", "Kasa yetmiyor", "Radyasyon nedeniyle kapalı", "Çok fazla grup").
- Gemi grupları kitte: resim, ad ve adet, can yüzdesi, çubuk (yalnız savaşamayacak kadar yaralıyken uyarı renginde), kitin sayacı. Onarımı zaten süren grup tek satır ("Onarıma ayrıldı") ve listenin sonunda; eskiden "1 adet var" diyerek yanıltıyordu. Seçim yokken fiyat çizilmiyor ("0 sn" yazmıyor).
- Kuyruk kendi sekmesinde: halka, gemilerin adı (sekme zaten onarım dediği için "Onarım ·" öneki yok), hasar, bitiş ya da başlama süresi, İptal (iade onayı aynı).

Ortak parçalarda:
- `QuantityStepper` `look="kit"`: 44 px adımlar kendi tık sesi ve titreşimiyle; tavana ulaşan son basış ağır titreşim. Sınıfları `gk-qty*` (kitin `CountBadge`'i `gk-count` kullanıyordu, ilk denemede çakıştı).
- `GameHold` fiili uzunluğuna göre küçülüyor (`--gk-len`, kap sorgusu): "2 Schiffe reparieren" 320 px'te kesiliyordu. Kısa fiiller 24 px kalıyor.
- Çift ses düzeltildi: bina kartının açma düğmesi ve `InfoPeek`'in "?" düğmesi kendi sesini çalıyordu ama işaretsizdi; genel karıştırıcı ikinci kez tıklıyordu. `InfoPeek` kuralı artık liste taşıyabiliyor (`p` yerine `div`).
- Tip ölçeği testi: G2-c'nin arıza satırı parası (`.gk-frow__coin`) yalnız simge taşıyor; testin simge listesine eklendi (yardımcı ajan buldu).
- `atmosphere.css`: yalnız eski karttaki ve kahramandaki kurallar ve artık hiçbir yerin okumadığı `--section-material` değişkenleri silindi; başlangıç galaksisindeki `YardDeck` `.repair-scene`'i kullanmaya devam ediyor.

Metin (6 dil): yeni `damagedShips`, `maintenance.order` (İş emri), `maintenance.back` (Geri al), `maintenance.scrapSelected`, `maintenance.radiationShort`, `tooManyShort`. Kullanılmayan `statWaiting`, `statRepairing`, `queueHeading`, `maintenance.scrapAction`, `maintenance.scrapConfirm`, `maintenance.keep` silindi. Daha önce ölü olan `outOfAction` (Geri al modunun açıklaması) ve `maintenance.select` yeniden kullanılıyor.

Ölü kod (benden önce de kullanılmıyordu): `repairStation.statQueue`, `tagline`, `industrialChip`, `selectNone`, `choose`, `noneWaiting`, `share`, `selected_one/_other`. Owner onayıyla 2026-11-14'te silindi (aşağıda "Temizlik").

Parçalama onay penceresi basılı tutmaya döndü (yardımcının C4 engelleme ve C6 döteryum aktarımıyla aynı çizgi). Owner, 2026-11-14: onay penceresinin yerini alan üç basılı tutma en kısa süreyi (0,6 sn) kullanır; parçalama 1,5 sn'den 0,6 sn'ye indi.

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

**G2-g taktik ve Savunma özeti ✅ (2026-11-14).** Oyuncunun anı: Taktik sekmesinde "stratejik silah üreteyim mi, ne yapar, kaça mal olur, bu dünya kaç tane tutar?"; Savunma sekmesinin başında "dünyam ne durumda, ne onu durdurur?". Kurallar (Ölüm Yıldızı, önleme şarjı, radyasyon bombası; stok, gereksinim, fiyat, süre, araştırma kapısı) değişmedi.

Ortak silah kartı (`ui/ArmCard.tsx`, kitin `gk-arm` sınıfları). Ölüm Yıldızı atölyesi, önleme bataryası ve radyasyon bombası atölyesi aynı kartı kullanıyor:
- Üstte donanımın resmi. Kilitliyken gri, bir şey üretilirken üstünde kaynak ışığı atıyor (G2-f'nin `gk-weld` ritmi).
- Ad, stok sayacı ("Stok 1/2") ve stok hücreleri: hazır dolu ve parlak, üretimde çerçeveli, durmuşsa amber, uçuşta mor. Karışık stokta altında "Hazır: 1 · Üretimde: 1"; tek durumda bu satır yok, durum satırı söylüyor.
- Durum satırı lambalı: hazır yeşil ve nabız atıyor, üretim turkuaz, duraklama / radar halkası yok amber, hiç yok sönük. Üretim kitin çubuğuyla. İkinci silah üretilirken kendi satırı ve çubuğu var; eskiden çubuk "Fırlatmaya hazır" satırının altına düşüyordu.
- Ne yaptığı iki küçük kuyuda (Ölüm Yıldızı: EMP süresi, koloni sadakat kaybı; radyasyon: korumadan önceki hasar, etki süresi).
- Kural tek satır ve "?" (`InfoPeek`). Ölüm Yıldızının 55 kelimelik paragrafı artık bir dokunuş uzakta. Yeni tek satır `planet.deathStar.rule` (6 dil): "Hedefin Aegis'ini sıfırlar, yer savunmalarını susturur." Bu satır "TAKTİKSEL EMP SİLAHI" üst satırını gereksiz kıldı; üst satır ve `planet.deathStar.eyebrow` kalktı (ilk ölçümde ekran başına 62 kelimeyle bütçeyi aşan ekranın payı).
- Gereksinimler çip: karşılanan sessiz tik, eksik olan amber; düzeltilebilecek yerde 44 px kapı (Çekirdek / Tersane → Üretim satırı; Uplink / Radar → İstihbarat).
- Fiyat kitin maliyet satırında, yanında süre ("1 sa 13 dk · tek silah · geri çağrılamaz").
- Üretim 1 sn basılı tutma (harcayan). Ölüm Yıldızı ve radyasyon bombası v2 `HoldButton`'dı; önleme şarjı düz bir düğmeydi ve tek dokunuşla kaynak harcıyordu, artık o da basılı tutma. Ses: atölye ateşleniyor (`ignite`), şarj kalkan sesiyle.
- Dolu stok araştırma kapısıyla bitiyor ("Stratejik Depo ile: dünya başına 2 ›"), kitin kapı satırı.

Radyasyon bombası atölyesi: üç tam kart (üç ekran kaydırma) tek kart ve bir seviye şalteri oldu. Şalterin yanında üç seviyenin slotu tek bakışta hücre olarak (hazır / uçuşta / boş). Atölye boş slotu olan ilk seviyede açılıyor (üretilebilecek olan). Boş slotta "Stok boş · 0/1" satırı kalktı (sayaç zaten söylüyor). Katlanmış `details` paragrafları "?" altında madde listesi; Onur kuralı sezona göre aynı.

Savunma özeti (`DefenceReadings`): dört v2 kutusu (9 px) kitin cam kuyularına geçti. Her birinin rengi ve adının yanında simgeli madalyonu var (simge yanda, böylece 320 px Almanca "VERTEIDIGUNG" kutunun tüm genişliğini alıyor): Ateş gücü, Savunma (hattın neyden oluştuğu), Kalkan (kitin bölmeli çubuğu, saatlik dolum), Risk altında. Altındaki filo (`FleetCards`) kitte: aile başlıkları 44 px kapı ve sayısını taşıyor, gemiler 20 px resim, 12 px ad, evdeki sayı, havadaki (↑) ve tamirhanedeki (anahtar) ayrı.

Silinen (bu değişiklikle kullanılmaz oldu): `ui/TacticalStock.tsx`, `v2/kit/ChargeTally.tsx` ve testi, `PlanetScreen`'deki `CapacityNext`, `ChargeProgress`, `TacticalNeed`, `PlanetHero`'daki `Firepower` ve v2 `Meter` kullanımı, `surfaces.css`'teki `.tactical-production*`, `.tactical-stock*`, `.radiation-forge*`, `.radiation-product*` kuralları ve yalnız onların okuduğu dört renk (`--color-v2-radiation-tier-1/2/3`, `--color-v2-radiation-flying`), `planet.interceptor.readyHint` (6 dilde `hint` ile birebir aynıydı), `planet.deathStar.eyebrow`.

Ölü kod (benden önce de kullanılmıyordu): `--color-v2-radiation-product-border/glow/ground/title/rate`. Owner onayıyla 2026-11-14'te silindi (aşağıda "Temizlik"). Eski görsel doğrulama betikleri `tools/tactical-production-visual.mjs`, `tools/radiation-forge-visual.mjs`, `tools/radiation-bomb-visual.mjs` ve `tools/honor-benefits-visual.mjs`'in bir adımı eski v2 seçicilerini arıyor. Owner silmeyi onayladı; ana çalışma alanında başka bir oturumun kaydedilmemiş `tools/visual.mjs` değişikliği var (bu betikleri o dosya çağırıyor), o kaydedilince silinecek.

Kit sayfasına iki görünüm eklendi ve denetim bunları ölçüyor: `strategic-radiation` (radyasyon atölyesi açık, ikinci Ölüm Yıldızı üretimde), `strategic-locked` (genç dünya, kilitli atölye).

Çeviri düzeltmeleri (savunma satırı, test eklendi): de "12 wird versendet" (12 gönderiliyor) → "12 Schiffe", "Waffe(n)" → "Bodengeschütz(e)", "Transport / transportiert in der Zeile" (metin satırında) → "Transporter in der Linie"; es "pistola(s)" (tabanca) → "cañón / cañones".

Ölçüm: `reports/ui-audit/g2g-after-2026-11-14.md` (dört görünüm, 6 dil, telefon, dar ve masaüstü; 56 ölçüm). Önceki ölçüm 4.1'de (`reports/ui-audit/4.1-2026-11-12.md`, telefon, tr):

| | Atölye 4.1 | Atölye G2-g | Savunma 4.1 | Savunma G2-g |
|---|---|---|---|---|
| 12 px altı metin | 13/65 | 0/59 | 34/91 | 13/85 |
| Kontrast hatası | 1 | 0 | 17 | 10 |
| 44 px altı hedef | 9/17 | 1/16 | 10/22 | 1/20 |
| Basınca tepkisiz | 9 | 1 | 10 | 1 |
| Kelime | 160 | 121 | 225 | 223 |

Radyasyon açık görünüm 0/72, kilitli atölye 0/61 küçük metin; ikisinde de kontrast hatası yok. Kalan tek hedef ve tek tepkisiz alan G1 sheet çerçevesinin 2×2 px arka plan düğmesi. Kesilen ve kırpılan metin bütün dillerde ve boyutlarda 0.

Savunma görünümünde kalan 13 küçük metin ve 10 kontrast hatasının hepsi yer odası çubuğunda ("Yer odası", "0 / 30", "boş 30", Kirpi / Zıpkın / Tabya çipleri, iki not satırı). O parça v2 `RoomBar`, G2-h'nin işi. Savunma özetinde ve bataryada bulgu yok.

Metin yükü: atölye ekranı ilk ölçümde ekran başına 62 kelimeydi (bütçe 55). Tekrar eden üst satır kalkınca 60,5'e indi. Kartın kendisi yaklaşık 28 kelime. Görünüm iki ekran boyunda olduğu için ortalamayı sekmelerin üstündeki Üs başlığı (depo kuralı, radyasyon koruması, koloniyi bırak, kuyruklar) belirliyor. Başlık G2-a'nın işiydi; owner'ın son bakışı için not. Kilitli 57,5, savunma 55,8, radyasyon 50,3.

**Temizlik: hiç kullanılmayan arayüz kodu (owner, 2026-11-14: "hiç kullanılmıyorsa gereksiz kodu silebilirsin").** Her parçanın kullanıcısı tek tek arandı (içe aktarma, `t('…')` anahtarı, dinamik ve önekli anahtar, galeri, araçlar):
- Onarım istasyonunun 9 anahtarı (6 dil): `statQueue`, `tagline`, `industrialChip`, `selectNone`, `choose`, `noneWaiting`, `share`, `selected_one/_other`.
- `--color-v2-radiation-product-*` (5 renk).
- `v2/kit/ResourceMeter.tsx` ve testi (yalnız v2 galerisi çiziyordu; galeri bölümü "segmented" oldu).
- `ui/RangeBand.tsx` ve testi; yalnız onun okuduğu `rangeBand.join` (6 dil; `i18n.test.ts` istisna listesinden de çıktı). `rangeBand.reading` ve `rangeBand.yours` İstihbarat'ta kullanılıyor, kaldı.
- `ui/Clarity.tsx` ve `fog.test.tsx` içindeki beş testi; yalnız onun okuduğu `clarity.backIn`, `clarity.unwatched` (6 dil). Diğer `clarity.*` anahtarları İstihbarat ve `Freshness`'te kullanılıyor, kaldı.

Kalanlar ve nedeni:
- `brand/Identity.tsx` `BrandMasthead`: marka önizleme sayfası ve `tools/fullscreen-visual.mjs` hâlâ çiziyor; kullanılıyor, silinmedi.
- Eski Akademi zinciri (`onboarding/Academy.tsx`, `Rehearsal.tsx`, `shell/StatusBar.tsx`, `ui/SignalBoostNote.tsx`, `PendingStrip`, `Signals`): durdurulan yeni oyuncu dalı (`feat/new-player-journey`) bu dosyalara dokunuyor; şimdi silmek o dalı birleştirirken çakışma çıkarır. G15'te silinecek.
- `tools/` betikleri: yukarıda, `tools/visual.mjs` kaydedilince.

**G2-e Tersane sipariş sheet'i ✅ (2026-11-14).**
- **An:** oyuncu bir gövdeye dokundu: "Bu gemiden kaç tane, ne işe yarar, kaça mal olur?" Kurallar değişmedi.
- **Değişen:**
  - Önceden iki ekran olan sheet artık tek ekranda karar veriyor.
  - Gövde kartında gemi gökyüzünde süzülüyor; üstünde sınıf ve "8 ev · 3 dış", köşesinde zıplayan "×N" var.
  - Altında güçlü/zayıf çipleri çarpanlarıyla (D124); "?" sınıf döngüsünü açıyor.
  - Altı değer kit kuyularında; gemi kalkanı ve radyasyon koruması kendi "?"'leriyle.
  - Adet, Maks ve neyin durdurduğu alt barda, fiyat ve "Yap"ın üstünde (baş parmak alanı).
  - "Yap" Yükselt gibi tek ağır basış (owner 4.1 kararı: iptal edilebilir sipariş).
  - Kilitli gövdede her gereksinim ayrı kapı çipi; adet gizli. Hangar dolu ve kaynak yetmiyor durumları Yükselt sheet'iyle aynı dilde.
  - `RoomGauge` bitirildi (CSS yazıldı); siparişin payı çizgili ve akıyor.
- **Silinen:** `HULL_SKY`, v2 `Cost`/`Icon` kullanımı. `CounterCycle` ve `ShipRadiationProtection` kite geçti. v2 `RoomBar` G2-h ve G15 için kaldı.
- **Ölçüm** (`reports/ui-audit/g2e-after-2026-11-14.md`, 6 görünüm, 84 ölçüm): 12 px altı metin 0, kontrast hatası 0. 44 px altı ve tepkisiz hedef görünüm başına 1; bu G1 çerçevesinin bilinen arka plan düğmesi. Kırpma 0. Tek kesilme Fransızca 320 px'teydi; metin kısaldı ve bir test koruyor. Ekran başına 43–65 kelime. Eski sheet galeriden ölçülemiyordu.

**G2-h1 Hangar ve yer odası ✅ (2026-11-15).** G2-h üçe bölündü: h1 odalar, h2 Filo sayfası, h3 klan savunma duruşu ve destek bölmesi.
- **An:** "Bu dünyada gemiye ve topa ne kadar yer var?"
- **Değişen:** Filo sekmesindeki hangar odası ve Savunma sekmesindeki yer odası G2-e'nin kit `RoomGauge`'una geçti. Not satırı ("Dönen filo her zaman sığar… Hangar 4 odayı 470 → 810 yapar") kartın içinde. Toplar kit çiplerinde; boş olan sönük.
- **Silinen:** `PlanetScreen`'den v2 `RoomBar`. `RoomBar` artık yalnız başlangıç galaksisinin tersanesinde (`YardDeck`, G15).
- **Ölçüm** (Türkçe; telefon, 320 ve masaüstü): `reports/ui-audit/g2h-before-2026-11-14.md` → `reports/ui-audit/g2h1-after-2026-11-15.md`. 12 px altı metin Filo sekmesinde 9→0, Savunma'da 13→0, boş filoda 8→0. Kontrast hatası 6→0, 10→0, 5→0. Kalan tek hedef G1 çerçevesi. Kesilme ve taşma 0.

**G2-h2 Filo sayfası ✅ (2026-11-15).**
- **An:** "Havada ne var, bana bir şey geliyor mu, bir filoyu geri çevirmeli miyim, yer var mı?"
- **Değişen:**
  - Kit başlığı göstergelerin ait olduğu dünyayı yazar. Saldırı gelirken başlıkta kırmızı "N saldırı geliyor" uyarısı çıkar; sanatlı başlık plakanın tonunu gizlediği için uyarı sözle verilir.
  - Sekmeler iki katlı: simge üstte, ad altta.
  - Uçuş yuvası ve Hangar göstergeleri kalan yeri sözle verir ("boş 1"). Dolunca sarıya dönüp "Dolu" yazar.
  - Uçuşlar zamanlayıcılar sayfasının halka satırlarıdır.
  - Geri çağırma, klan dalgası dahil, 0,6 sn'lik satır içi çelik basılı tutmadır; üstünde "Eve dönüş X" yazar. Kit `GameHold`'a `size: 'md'` ve `tone: 'steel'` eklendi.
  - Evde ve Hangar sekmelerinde dünya adları 44 px'lik kapılardır. Gemiler sınıf amblemleriyle, "tamirde" etiketi kit çipi olarak gösterilir.
- **Silinen:** Filo sayfasındaki v2 `Room`, `Segmented`, `ClassEmblem` ve `Icon` kullanımları (bileşenleri başka ekranlar kullanıyor, onlar kaldı). Uçuş ilerleme çizgisinin yerini halka aldı.
- **Ölçüm** (Türkçe; telefon, 320 ve masaüstü): `reports/ui-audit/g2h-before-2026-11-14.md` → `reports/ui-audit/g2h2-after-2026-11-15.md`.
  - 12 px altı metin: havada 21→0, evde 20→0, Hangar 19→0, klan 33→0.
  - Kontrast: 8/5/5/6→0. Ölçümden sonra kalan son hata başlıktaki uyarı yazısındaydı. Nabız siren ikonuna taşındı, yazı açık kırmızıya alındı; yeniden ölçümde 0 (`out/ui-audit/g2h2-recheck-2026-11-15`).
  - 44 px altı hedef: 8/6/5/6→0. Kalan tek ölçüm galerinin kök öğesi.
  - Puan: 69/53/49/69→3.
- **Açık soru:** Geri çağırma 0,6 sn tutulur (yanlış dokunuşa karşı). Daha ağır sayılırsa 1 sn yapılabilir.

**G2-h3 Savunma duruşu ve klan destek bölmesi ✅ (2026-11-15).** Bu iş G2-h'yi kapatır.
- **An:** "Ezici bir saldırıda filom kalksın mı, klan arkadaşlarım burada nöbet tutsun mu, kim burada ve bana ne kadara mal oluyor?"
- **Değişen:**
  - Duruş kartında artık "Kaydet" yok: iki kit şalteri var ve çevrilen şalter hemen uygulanır. Sunucu reddederse şalter geri döner ve sebebi yazılır.
  - Nöbetteki dalgalar varken desteği kapatmak bir uyarı şeridi ve 0,6 sn'lik "Eve gönder" basılı tutmasıyla olur. "Desteği koru" kapatmadan çıkar.
  - Klan dışındayken destek şalteri kilitli. Basınca ret sesi ve titreşimi gelir; sebebi şalterin altında yazar. Kit `Toggle`'a `locked` eklendi.
  - Bölme bir kit kuyusu. İki parçalı çubuk ve lejant var. Hâkimiyet çarpanı görünür, kuralı "?" düğmesinin arkasındadır.
  - Dalgalar Filo sayfasının halka satırlarında gösterilir. "Geri gönder" 0,6 sn basılı tutmadır; üstünde "Yakıt iade edilmez" yazar.
  - Alarm cevabı, siren ikonu atan kırmızı bir şerittir.
  - Onur notunun kit görünümü eklendi (`HonorSoloNotice look="kit"`).
- **Silinen:** `clanSupport.save`, `cancel` ve `sendBackOf` anahtarları (6 dil; başka kullanan yok). `sendBackConfirm`'ün yerini kısa `sendBackCost` aldı. Kapatma uyarısı "Kaydetmek…" yerine "Kapatmak…" diye başlar.
- **Ölçüm** (Türkçe; telefon, 320 ve masaüstü): `reports/ui-audit/g2h3-before-2026-11-15.md` → `reports/ui-audit/g2h3-after-2026-11-15.md`. Altı durumun sırası: açık, ikisi, alarm, bekle, kaçış, kilitli.
  - 12 px altı metin 34/36/39/9/8/7 → 1/2/1/1/1/1. Kalan metin Savunma sekmesinin `EscapeReadout` satırıdır; o satır G4/G5'te ele alınacak.
  - Kontrast 14/14/15/2/2/1 → 0. Masaüstünde çelik "Geri gönder" 4,48:1 ölçüldü; düğmenin yüzü biraz koyulaştırıldı.
  - 44 px altı hedef 5/5/6/2/2/3 → 0.
  - Puan 91/93/102/21/20/17 → 1/2/1/1/1/1.

**G2-i1 Araştırma haritası, seçili kart ve şerit ✅ (2026-11-15).** Proje sayfası ("Ayrıntılar") G2-i2'de.
- **An:** "Sırada ne araştırayım, ne kazandırır, önünde ne var?" Harita bakış, alttaki kart karar.
- **Değişen:**
  - Harita kit'te (`gk-cmap`). İsimler artık kesilmiyor; iki satıra kadar, 12 px dar yazıyla tam yazılıyor. Her yıldız 44 px'lik bir basma hedefi, ses ve titreşimle.
  - Kilitli yıldızda yalnız halka sönüyor, isim okunur kalıyor. Şeritteki proje atıyor, seçili olan halkalı.
  - Harita oranı 1/1.25. 320 px'te sütun 76 px, en uzun Türkçe kelime ("Spektrometrisi") 72 px. Harita sheet'in kenar boşluğunu aşıp kenardan kenara uzanıyor. Doktrin'de Kalkanlar ile İtki'nin yeri değişti (İtki'nin "← Yoğun Yakıt Hücreleri" satırı çeyreğin dibinde). Yerleşim testi artık piksel modeliyle ölçüyor.
  - Kart kit'te (`gk-rcard`): sahne sağda, isim ve kit seviye noktaları, kazanç satırı, önkoşul ✓ çipi, açtığı gemiler çip olarak, fiyat ve süre tek satırda. "Ayrıntılar" çelik, "Araştır" ağır turuncu basış. Kaynak yetmezse düğme sebebini söylüyor. Önkoşul eksikse kapı sarı kesikli bir şerit; basınca o yıldıza gidiyor.
  - Şerit, Üs'ün kit halka şeridi (`Lane` dışa açıldı). Araştırma seviye saydığı için halkada "×2" yok.
- **Silinen:** gemideki alçak harita (`compact`, iki satırlık isimlerle sığmıyordu; gemiye özel harita G15'te). atmosphere.css'teki eski kart ve bölge kuralları; bunlar yeni kartı eski renge boyuyordu. Galeri sheet'i artık gerçek uygulamadaki gibi kenar boşluklu.
- **Ayrıca:** araştırma metinlerindeki birebir "basamak" çevirileri kalktı: de "Sprosse" → "Stufe"/"Forschungsstufe", es "peldaño" → "nivel" (klan savaşındaki gerçek merdiven "peldaños" kaldı). Tavan satırındaki çift nokta ("%10 · · tavan") giderildi. Yanlış çeviriler düzeltildi: de "Prospektor hält" → "Prospektor-Laderäume", "Yard-Automatisierung" → "Werftautomatik"; es "Retenciones del prospector" → "Bodegas del prospector".
- **Ölçüm** (Türkçe; telefon, 320, masaüstü): `reports/ui-audit/g2i-before-2026-11-15.md` → `g2i-after-2026-11-15.md`.
  - 12 px altı metin 45/54 → 0. Kontrast 13 → 0. 44 px altı hedef 17/26 → 0. Kesilen 10 → 0.
  - Puan 168 → 1. Kalan 1, seçili yıldızın basış tepkisiydi; düzeltildi (seçiliyken basınca halka küçülüyor).

**G2-i2 Proje sayfası, kilitli ve duraklatılmış hâller ✅ (2026-11-15).** Bu iş G2-i'yi kapatır.
- **An:** "Bu projenin tamamı ne: ne kazandırır, nasıl işler, bu seviye neye mal olur?" Kartın bir dokunuş ötesi.
- **Değişen:**
  - "Ayrıntılar" artık bir kit sheet'i, Üs'teki bina sayfasının dilinde. Başlık şeridinde projenin etiketi var. Kahraman bölümünde projenin sahnesi, üstünde tutulan seviye ("02"), kazanç (şimdi → sonra, tavan) ve kit seviye noktaları duruyor. Altında rolü ve "nasıl işler" kuyusu.
  - Alt kısımda: o seviyenin fiyatı ve süresi, "5 seviyenin 3. seviyesi" ve tek basış. Basış kartla aynı: ağır turuncu "Araştır"; kaynak yetmezse sebep yazılıyor. Önkoşul eksikse kit kapı düğmesi; basınca sheet kapanıyor ve o yıldız seçiliyor. Sıradaysa durum plakası.
  - Tatildeyken şerit satırı "Sürüyor" demiyor, sarıyla "Duraklatıldı — tatil modu" diyor. Kit halkalarında duraklatılmış iş tek kelime: "🔒 Durdu" (6 dil); ekran okuyucu uzun cümleyi duyuyor. Bu düzeltme Üs şeritlerine de uygulandı.
  - Sırada olan projenin kartı artık fiyat göstermiyor, çünkü basış sunulmuyor.
- **Silinen:** v1 `Sheet` + `ActionButton` + `Price` kullanımı. Eski portre CSS'i (chrome.css'teki "commitment portrait" ve atmosphere.css'teki araştırma portresi; başka kullanan yok).
- **Galeri:** `base-research-sheet`, `base-research-locked`, `base-research-paused`. Envanterde ulaşılamayan iki durum ("proje sheet'i", "tatilde duraklatılmış") kapandı.
- **Ölçüm** (Türkçe; telefon, 320, masaüstü; dört görünüm): `reports/ui-audit/g2i2-after-2026-11-15.md`. 12 px altı, kontrast, 44 px altı ve tepkisiz hepsi 0. Puan 0/0/0/3; kalan 3, "Durdu" düzeltmesinden önceki kesilmeydi. Düzeltmeden sonra duraklatılmış görünüm yeniden ölçüldü: 0.

**G2-j Dünyalar paneli ✅ (2026-11-15).**
- **An:** "Hangi dünyamda ne var, oraya git ya da birinden ötekine kaynak aktar."
- **Değişen:**
  - Panel kit sheet'i oldu. Her dünya, oraya götüren bir kit kartı. Kartta isim, başkent/koloni çipi ve etkin işareti var; etkin dünyanın kenarı teal. Üs'ün depo göstergeleri burada da var: dolu/tavan, kasa payı, saatlik üretim. Altında araç sayısı ve uçuş rampaları (yanan = kalkışa boş).
  - Kolay Aktarım tek satırlık bir rota: [Nereden ▾] ⇄ [Nereye ▾]. Her uç basınca kit dünya listesi açıyor; yerli `<select>` kalmadı. Ortadaki yuvarlak düğme yönü çeviriyor (iki dünyalı komutan için tek gereken hareket). Altında ana turuncu "Aktar".
  - "Aktar" kaynak harcamıyor, yalnız aktarma sayfasını açıyor. Bu yüzden envanterdeki "aktarma basılı tutma" maddesi G4'teki `TransferSheet`'e taşındı.
- **Silinen:** v1 `Sheet`, `Meter`, `Chip`, `Tally` ve `plate/legend/slab/field` kullanımı.
- **Galeri:** `worlds` ve `worlds-one` (tek dünya, aktarma yok). Envanterde ulaşılamayan "tek dünya" durumu kapandı.
- **Ölçüm** (Türkçe; telefon, 320, masaüstü): eski panel geçici bir kopyadan ölçüldü (`g2j-before`) → `g2j-after-2026-11-15.md`. 12 px altı metin 21/34 → 0 (en küçük 9 → 12 px). Kontrast 2 → 0. 44 px altı hedef 6/14 → 0. Tepkisiz 8 → 0. Puan 47 → 0/0.
- **Açık:** ölçüm sheet'in arkasındaki karartmayı "adsız dokunma alanı" sayıyor. Bu bütün yarım boy sheet'lerin ortak çerçeve davranışı (G1 çerçevesi).

**G2 kapanışı: altı dilde telefon ölçümü (2026-11-15).** 39 görünüm × 6 dil = 234 ölçüm, 0 hata → `g2-langs-2026-11-15.md`. Yana taşma 0.
- Üç noktayla kesilen: duraklatılmış araştırma yuvasında "En pause / En pausa" → fr "Pause", es "Pausa" (aynı anlam, kısa kelime). Yuvadaki uzun araştırma adı (Blindage…) şeridin tasarımı: tam ad hemen altındaki satırda.
- Kırpılan: ja'da yalnız galerinin sabit Türkçe başlığı "Araştırma" (oyunda yok).
- Ölçüm, G2'de atlanmış bir yüzey buldu: kuyruk sayfası (`QueueSheet`, puan 36). G2-k olarak kapandı (aşağıda).

**G2-k Kuyruk sayfası ve iptal ✅ (2026-11-15).**
- **An:** şeritte bir halkaya dokundu; "bunu iptal edeyim mi, neyi kaybederim?"
- **Değişen:** sayfa kit sheet'i. Her şerit kit bölüm başlığı, yanında "09:15'te biter". Her sipariş bir satır: şeridin kendi halkası (`SlotRing`, yuvadan ortak bileşen; sırada bekleyen sarı kum saati, tatilde kilit), ad, kalan süre, 44 px "İptal".
- **İptal artık modal onay değil:** "İptal" satırın içinde yok olacak payı ve iki toplamı açıyor ("Yok olan" kırmızı, "Geri gelen"), altında "Vazgeç" ve 0,6 sn kırmızı basılı tutma "Siparişi iptal et" (sahip: eski onay = en kısa tutma). Escape önce açık iptali katlıyor, sonra sayfayı.
- Tamir istasyonunun kuyruk sekmesi aynı paneli (`CancelUndo`) kullanıyor; eski v1 `CancelConfirm` penceresi oyunda kalmadı.
- **Önceden var olan ölü kod (silinmedi):** `ui/QueueStrip.tsx` (`QueueStrip`, `CancelConfirm`) uygulamada kullanılmıyor, yalnız iki test dosyası okuyor.
- **Galeri:** `queue-cancel` (ilk satırın iptali açık).
- **Ölçüm** (Türkçe; telefon, 320, masaüstü): kuyruk 36 → 0, açık iptal 0. Satırdaki kırmızı tutmanın yazısı 4,49:1 ölçüldü; yüz bir ton koyulaştı → 4,5 üstü. Tamir kuyruğu 0 kaldı.

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

**C9 Radar rafı ve eksik alet kartı ✅ (2026-11-14, yardımcı oturum).** G3 #8/#9. Oyuncunun sorusu şu: "Beni kim tarıyor, radarım ne kadar uzağı duyuyor, bir sonraki seviye bana ne kazandırır?" Radar kuralları, menziller ve tarama günlüğü değişmedi.

- **Radar ekranı (`.gk-scope`):** disk galaksiye göre gerçek boyutunda duruyor. İçinde ince bir artı işareti var; uyarı halkasının içinde turkuaz bir tarama ışını dönüyor. Disk artık canlı bir alet, durağan bir çizim değil.
  - Yandaki açıklama:
    - Seviye başlığı 14 px.
    - Her halkanın adı ve menzili birimiyle ("4275 birim"); değer, adın altında.
    - Kesik çizgili dış halkanın ne olduğu yazıyor: "Galaksinin kenarı". Önceden halkaların neye göre ölçüldüğü söylenmiyordu.
- **Sonraki seviye:** kilit işaretli tek satır ("5. seviye çıkış dünyasının adını verir"). Yavaş filo kuralı ayrı bir not.
- **Son 24 saat:** cam kuyuda; başlık büyük harfle bağırmıyor.
- **Tarama listesi:** kitin defteri (`gk-ledger`). Her tarama tek satır ve tek kapı:
  - Radar taramayı yapanı adlandırdıysa (5. seviye) satır onun dosyasını açar; yoksa taramanın düştüğü kendi dünyanı.
  - Eskiden satır içinde iki küçük altı çizili bağlantı vardı (44 px altı).
  - Son 6 saatin taraması kırmızı noktayla atıyor.
  - Dünya adı bölünmüyor.
- **Sessiz radar:** turkuaz tikli bir "dinlemede" şeridi.
- **Eksik alet kartı (`Instrument`, `.gk-instrument`):** Teleskop, Sonda ve Radar için ortak.
  - Alet kendi yuvasında hafifçe süzülüyor.
  - "Radarın yok" satırı kilit işaretli ve amber renkte.
  - Ne vereceği 14 px; bedeli not olarak.
  - "Yörüngeyi aç" kitin turuncu ana tuşu oldu (eskiden 36 px'lik çerçeve).
- **Çeviri düzeltmeleri:**
  - Almanca "Offener Orbit" → "Orbit öffnen"; İspanyolca "Órbita abierta" → "Abrir órbita"; Japonca "オープンオービット" → "軌道を開く".
  - tr ve fr yön satırı "·" ile başlıyordu; düzeltildi.
  - Japonca: "レーダー がありません" boşluğu kaldırıldı. L2/L5 cümleleri anlamlı hâle geldi ("L5 は惑星に名前を付けます" → "L5 では発信元の惑星名がわかります").
  - Yeni anahtarlar ×6: `intel.radar.rim`, `intel.radar.reach`.
- **C7 artığı:** "Netlik ve yaş" düğmesinin alt 2 px'i alttaki satırın altında kalıyordu. Düğme öne alındı.
- **Kullanılmayan sabit:** C9'la birlikte `HEADING` ve `CARD` sabitlerini kullanan yer kalmadı; silindi.
- **Galeri:** `intel-radar`, `intel-blind-probes` ve `intel-blind-radar` görünümleri eklendi. Envanterde ulaşılamayan tek parça artık Savaşlar rafı (G5'in işi).

Ölçüm: `reports/ui-audit/c9-intel-radar-after-2026-11-14.md`, dört yol, 56 ölçüm.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 64 | 0 |
| Kontrastı yetmeyen metin | 20 | 0 |
| 44 px altı hedef | 12 | 0 (C7'nin "Netlik ve yaş" düğmesi ayrı koşuyla doğrulandı) |
| Basınca tepkisiz | 6 | 0 |
| Kesilen metin (bütün diller) | 5 | 0 |

Doğrulanamayanlar:
- Sessiz radar ve gemideki radar (onarım dili) galeride yok; yalnız testlerle doğrulandı.

**Owner sorusu:** Bir tarama satırı artık tek kapı. 5. seviyede satır, taramayı yapanın dosyasını açıyor; satırdaki kendi dünyanın adı ayrıca basılamıyor. Bunun nedeni şu: karşılık vermek için gereken bilgi o dosyada, kendi dünyanın yeri ise zaten belli. İki kapı istersen satır iki çipe bölünebilir; satır biraz uzar. → **Yanıt (owner, 2026-11-14):** iki kapı. Bkz. C11.

**C10 Görünüm sayfası ve galaksi olayları rehberi ✅ (2026-11-14, yardımcı oturum).** G3 #10/#11. Katman ve takvim kuralları değişmedi.

- **Görünüm sayfası (`ViewSheet`):**
  - Kitin boyalı başlığı var (teleskop resmi, galaksi kodu).
  - "Katmanlar" etiketinin altında iki katman kitin kollu anahtarı (`Toggle`) oldu; her birinin yanında kendi aletinin resmi var. Anahtar ses ve titreşimle yanıt veriyor; sayfa, çizilen menzil görünsün diye yine kapanıyor.
  - Akademi'nin işaret ettiği `data-sensor-toggle`, anahtarı saran kutuda duruyor. Akademi bu kutuya `closest()` ile ulaşıyor.
  - Olaylar rehberine giden yol kitin defter satırı: saat işareti, ad ve ok.
- **Galaksi olayları rehberi (`GalaxyEventsGuide`, v1'den kite):**
  - Sayfa v2 sayfasına geçti; kit başlığında kronometre resmi var.
  - "Sıradaki etkinlik" yeşil, ışıklı bir plaka. İşaret yavaşça parlıyor; parıltı yalnız saydamlık değiştirdiği için çizimi ucuz.
  - Türkiye saati ayrı bir rozet.
  - Her olay kendi renginde bir kit plakası: asteroit kristal, tüccar alaşım, konvoy düşman rengi. İşaret kutusu, başlık, kural metni ve pencereler var.
  - Gün adları büyük harfle bağırmıyor ve pencerelerin üstünde duruyor. Böylece bir satıra iki pencere sığıyor; önceden yerel saat satırı yüzünden pencereler tek tek alt alta diziliyordu.
  - Uzun "Bilinmeyen sinyal" metni, takvim olayı olmadığı için sona taşındı. Adının altında katlanıyor (`details.gk-rules`); önceden 11 satırlık bir duvardı.
  - Japonca başlık "ギャラクシーイベント" → "銀河イベント" ve üst satır → "週間カレンダー" oldu. İkisi de ses taklidiydi.
- **Galeri:** `events-guide` görünümü eklendi (sıradaki yağmur 42 dk sonra).

Ölçüm: `reports/ui-audit/c10-view-guide-chronicle-after-2026-11-14.md` (Kronik de bu raporda; notu G5'te).

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 134 | 0 |
| Kontrastı yetmeyen metin | 30 | 0 |
| 44 px altı hedef | 15 | 0 |
| WCAG 2.5.8 aralık hatası | 2 | 0 |
| Basınca tepkisiz | 8 | 0 |

Üç yüzey birlikte ölçüldü: dört yol (`view`, `events-guide`, `chronicle`, `chronicle-empty`), 56 ölçüm.

Doğrulanamayanlar:
- Cihaz saati Türkiye saatinden farklı olan bir oyuncunun "Yerel" satırı yalnız testle doğrulandı; bu makine Türkiye saatinde.

**Owner sorusu:** Cihaz saati Türkiye saatiyle aynıysa "Yerel · 20:00–20:30" satırı aynı saati ikinci kez yazıyor; Türk oyuncuların çoğu için bu bir gürültü. Yalnız saatler farklıyken gösterelim mi? Mevcut test bu satırın her zaman göründüğünü bekliyor, o yüzden bu turda dokunmadım. → **Yanıt (owner, 2026-11-14):** her oyuncu saatleri kendi saat diliminde, birincil saat olarak görsün. Bkz. C12.

**C11 Radar 5 taramasının iki kapısı ✅ (2026-11-14, yardımcı oturum).** C9 owner sorusunun yanıtı. Radar ve tarama kuralları değişmedi.

- **Ne değişti:** Radar 5 taramayı yapanı adlandırdığında satır iki ayrı basış oldu:
  - Üstteki satır (nokta, "Tarama yakalandı", yön ve taramayı yapanın adı, süre) onun dosyasını açar.
  - Altında, kesik çizgili bir dikişle bağlı ikinci kapı: hedef işareti, "Taranan dünyan" ve dünyanın adı. Kendi dünyanı açar.
  - Dünyanın adı artık üst satırda tekrar edilmiyor.
- **Ölçüler:** iki kapı da en az 44 px. Üst kapı 54 px, alt kapı 44 px.
- **Ne değişmedi:** adı bilinmeyen tarama tek kapı kaldı ve taranan dünyayı açıyor. Sunucu taranan dünyayı göndermezse (eski sunucu) adı bilinen tarama da tek kapı.
- **Tepki:** iki kapı da kitin dokunma sesi ve titreşimiyle açılıyor. Alt kapı basınca kendi rengiyle koyulaşıyor.
- Yeni anahtar ×6: `intel.radar.hitWorld`.
- Galeri: `intel-radar-named` (Radar 5, taramayı yapanın adı ve dünyası belli).

Ölçüm: `reports/ui-audit/c11-radar-scan-doors-after-2026-11-14.md`, bir yol, 14 ölçüm. Bütün ölçüler önce de sonra da 0. İlk koşuda alt kapı basınca tepkisizdi; düzeltildi ve yeniden ölçüldü.

**C12 Etkinlik saatleri oyuncunun kendi saatinde ✅ (2026-11-14, yardımcı oturum).** C10 owner sorusunun yanıtı. Takvim kuralları değişmedi; yalnız gösterim.

- **Ne değişti:**
  - Rehberdeki bütün saatler cihazın saat diliminde yazıyor. Saat dilimi `Intl`'den okunuyor.
  - Türkiye saatinin altındaki ikinci "Yerel · …" satırı kalktı. Pencere tek satır oldu, kartlar kısaldı.
  - Başlıktaki çip saat dilimini adlandırıyor: "Senin saatin (GMT+9)". Önceden "Türkiye saati (UTC+3)" yazıyordu.
- **Günler galaksinin:** "Hafta içi" ve "Hafta sonu" Türkiye günleri olarak kaldı. Tokyo'da hafta içi 20:00 yağmuru ertesi gün 02:00'de başlıyor.
  - Böyle bir pencerenin yanında amber bir "+1" ya da "−1" var. Ekran okuyucu bunu "ertesi gün" / "önceki gün" diye okuyor.
  - Böyle bir pencere varsa başlığın altında tek satır bunu açıklıyor. Türkiye saatindeki oyuncu bu satırı ve işaretleri hiç görmüyor.
  - Her gün çalışan pencerenin başka bir güne düşmesi anlamsız; ona işaret konmuyor.
- **Yaz saati:** her pencerenin bir sonraki çalışması o günkü saat dilimiyle okunuyor. New York'ta eylülde 7 saat geride (test ediliyor).
- **Sıra:** bir satırdaki pencereler oyuncunun saatine göre sıralanıyor. Gece 06:00'dan önceki saatler, önceki gibi günün sonunda okunuyor.
- **Anahtarlar ×6:** `timeZone` artık `{{zone}}` alıyor. `dayShift`, `nextDay` ve `previousDay` eklendi. Kullanılmayan `localTime` silindi.
- **Testler:** Türkiye, Tokyo, New York ve Honolulu (−1) için ayrı ayrı. Testler saat dilimini kendisi veriyor; böylece testi çalıştıran makinenin saat dilimine bağlı değiller.
- **Galeri:** `events-guide-tokyo`.

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

| # | Birim | Oyuncu anı | Ne değişir |
|---|---|---|---|
| G4-a | Odak çerçevesi (`Shell`) | "Neye dokundum, açayım mı?" | Kapalı ray ve açık dosya kitte (`ContextCard` dili): halka işaret, 12 px üst etiket, kit kapat/aç. Yapışkan eylem şeridi kit düğmeleri. Bütün odak kartları bunu kullanır. |
| G4-b | Yabancı dünya odağı | "Saldırayım mı, sonda mı, yerleşeyim mi?" | Olgular (`FactRow`), boşluklar (`GapRow` + `CloseGap`), rehber ve pencere kitte; `PlanetFocus` dosyadan ayrılır. Oyunun ana karar yüzeyi. |
| G4-c | Kendi dünyam, klan üyesi, engelli durumlar | "Burası benim / dokunamam: neden?" | `OwnedPlanetFocus`, kalkan/tatil/menzil/Sessiz Uzay notları kitte. |
| G4-d | Hedef dosyası | "Ne biliyorum, ne kadar emin?" | `TargetDossier` tahmin aralıkları kit okumalarıyla. |
| G4-e | Saldırı gönder | "Hangi gemilerle?" | `LaunchSheet` kitte; sayıcılar kit; gönder 1 sn `GameHold`. |
| G4-f | Aktar | "Ne kadar, nereye?" | `TransferSheet` kitte; `range` yerine kit kaydırıcı; aktar basılı tutma (G2-j'den taşındı). |
| G4-g | Yerleş ve sahiplen | "Koloni kurayım mı?" | `SettlementSheet` kitte; kesin eylem 1,5 sn. |
| G4-h | Asteroit, enkaz, korsan, uçuş, temas | "Kazayım / toplayayım / saldırayım / geri çağırayım" | Odak kartlarının gövdeleri kitte; `CraftPicker` kit seçici. |
| G4-i | Ticaret ve konvoy | "Takas edeyim mi, konvoya baskın?" | `TradeSheet` (iki `range`, `Segmented`) ve konvoy sheet'i kitte. |
| G4-j | Ölüm Yıldızı vuruşu | "Vurayım mı?" | `DeathStarSection`, `StrikeSheet` kitte; engeller düğmenin sebebinde. |
| G4-k | Bilinmeyen sinyal | "Sinyale gemi göndereyim mi?" | Yerli `<select>` yerine kit dünya seçici (G2-j'nin rotası); gönder basılı tutma; üç sonuç durumu galeride. |

**G4-a odak çerçevesi ✅ (2026-11-15).** Oyuncunun anı: galakside bir şeye dokundu; "bu ne, açayım mı?" Bütün odak kartları (dünya, kendi dünyam, asteroit, enkaz, korsan, uçuş, konvoy, ticaret, anıt, temas) aynı çerçeveden geçiyor.
- Kapalıyken kitin bağlam kartı dili: kesik köşeli plaka, şeyin işareti (portresi, yoksa halka içinde glifi), 12 px üst etiket, 16 px ad, 12 px tek satır. Aç ve temizle kitin basışı (ses + titreşim); temizle kitin yuvarlak düğmesi, öğretici hâlâ `data-focus-close` ile buluyor.
- Ton sahibinin rengi: kendi dünyam ve kendi uçuşlarım mavi, korsan kırmızı, gerisi çelik.
- Açıkken aynı baş dosyanın üstünde; yalnız üst köşeler kesik, dock'a oturuyor. Eylem şeridi kitin yapışkan şeridi.
- Özet artık sola yaslı (tür çipi adın altında); eski sağa yaslı düzen gezegen özetinde ortada kalıyordu.
- Kartların kendi düğmeleri (Saldırı planla, Sonda, Geri çağır, Topla…) kendi birimlerinde kite geçecek (G4-b…i). Kendi dünyamda "KOLONİN / KOLONİ" tekrarı G4-c'de.
- Galeriye `focus-closed` ve `focus-own` eklendi.
- **Ölçüm** (Türkçe; telefon, 320, masaüstü) `g4a-before` → `g4a-after-2026-11-15.md`: kendi dünyam 0, anıt 12 → 1, uçuş 24 → 15, korsan uçuşu 20 → 11. Açık dosyalar (130–141) ve kapalı yabancı dünya (15) kartların içeriğinden: değer satırı, Sonda/Saldırı düğmeleri, radyasyon çubuğu (9–10 px); G4-b, G4-d, G4-h'de.

**G4-b1 yabancı dünyanın taahhütleri ✅ (2026-11-15).** Oyuncunun anı: "sonda mı göndereyim, saldırı mı planlayayım?"
- Sonda ve saldırı kitin basışları, aynı satırda. Saldırı tek turuncu eylem (`data-attack`, `data-primary`, öğretici hâlâ buluyor). Sonda çelik; fiyatı yüzünde; geri çağrılamadığı için basışı harcama ağırlığında (onay sesi + titreşim). Sonda kendi genişliğinde, saldırı kalan yerde; 320 px'te sondanın fiyatı iki satıra yığılıyor, iki düğme de tam okunuyor.
- Reddedilen saldırı sebebini yüzünde söylüyor (koruma süresi, gelişmişlik, isyan, Sessiz Uzay); tam cümle okuyucu adında.
- Değer satırı 9 px'ten 12 px'e; yerleş, destek gönder ve klan hedefi kit düğmeleri; yerleşme sebebi, pencere açık ve radyasyon notları kitin not plakası (radyasyon uyarı tonunda, işaretli).
- Kit düğmesi `marks` aldı: dışarıdaki yüzeylerin bulduğu `data-*` işaretleri.
- **Ölçüm** `g4b1-after-2026-11-15.md`: kapalı yabancı dünya 15 → 0. Açık dosyalar 130–141 → 117–131; kalan `TargetDossier` (G4-d) ile bilinenler/boşluklar (G4-b2).

**G4-b2 bilinenler, boşluklar, rakip geçmişi ✅ (2026-11-15).** Oyuncunun anı: "ne biliyorum, neyi bilmiyorum, nasıl öğrenirim?"
- Her kaynak (herkese açık, teleskop, sonda, savaş) kitin katlanır bandı; bant artık kitin sesiyle ve titreşimiyle açılıyor (bütün `Band` kullanımları).
- Her okuma bir kit satırı: etiket ve değer aynı satırda (13 px), altında yaşı ve ne kadar keskin olduğu (12 px, bayatsa uyarı renginde), anlamı bir basış derinde. Fırsat satırı mavi kenarlı.
- Boşluk aynı satır, kesik uyarı kenarlı; neden önemli olduğu katlı, eksik bilgi ve onu kapatan düğme hiç katlanmıyor. Teleskop kur / izleme yuvası kitin düğmeleri.
- "Diğer okumalar" ve "Bu sezonki hikâyen" kitin bölüm başlığı; rakip geçmişinin sayıları kit kuyusunda.
- **Ölçüm** `g4b2-after-2026-11-15.md`: açık dosyalar 117–131 → 88–90, 44 px altı hedef 8 → 2–4. Kalanlar `TargetDossier` (G4-d), Ölüm Yıldızı (G4-j) ve strateji rehberi (G4-b3).

**G4-b3 bir dünyaya giden rota ✅ (2026-11-15).** Oyuncunun anı: "bu dünyayı nasıl alırım, ne eksik?"
- Strateji rehberi kit kuyusu: başkent kuralı (kalkan işareti), tarafsız dünyanın koloni rotası, Ölüm Yıldızı rotası; sana açılan pencere (EMP, açık hak) mavi, işaretli rakip uyarı tonunda.
- Rota adımları kit adımları: halkada numara (bitince tik), ad, katlama; sıradaki adım mavi, vuruş adımıysa uyarı renginde. Katlama kitin sesiyle.
- Yerleşme gereksinimleri kitin gereksinim çipi (G2-e) 44 px kapıda: karşılanan sessiz ve tikli, eksik uyarıda ve kilitli, bilinmeyen soru işaretli. Basınca nedeni 2 sn kitin ipucunda.
- Şerit: "Koloni kur" kendi satırında; sonda ve saldırı kapalı karttaki gibi aynı ızgarada, sondanın fiyatı her genişlikte yığılı. Hak açıkken saldırının yüzü kısa: "Tekrar akın" (cümlenin tamamı okuyucu adında; 6 dilde kısa kelime).
- Galeriye `focus-neutral` (açık hak, rota üçüncü adımda) eklendi.
- **Ölçüm** `g4b3-after-2026-11-15.md`: rehberden bulgu yok. `focus-neutral` 66, `focus-band` 85 — kalanların hepsi `TargetDossier`'ın (G4-d): güç cetveli, dağılım, "Bu nedir?" 22 px.

**G4-c kendi dünyam ✅ (2026-11-15).** Oyuncunun anı: "buraya bir şey taşıyayım."
- Başlıktaki "KOLONİN / KOLONİ" tekrarı gitti: üst satır kimin olduğunu söyler, alt satır yalnız nereden.
- Rota tek kit kuyusu: Çıkış → Hedef plakaları (hedef mavi), altında üç rakam, sonra tek cümle ipucu.
- Paylaşılan `Figure` kite geçti (`gk-figure`, 25 yer): etiket üstte, sayı tabanda; etiket iki satıra insede bir satırdaki sayılar aynı hizada.
- "Gemi ve kaynak seç" kitin ana düğmesi (kasa simgesi); çıkış toparlanıyor ya da tersane isyanda ise düğmenin yüzü nedeni söyler.
- Galeriye `focus-own-open` eklendi.
- **Ölçüm** `g4c-before` / `g4c-after-2026-11-15.md`: `focus-own` 0 → 0, `focus-own-open` 0; kesilme ve taşma yok (telefon, 320, masaüstü).

**G4-d hedef dosyası ✅ (2026-11-15).** Oyuncunun anı: "bu akına değer mi, ne götürmeliyim?"
- Baş: kit çipleri, cümle düzeninde (telefonda 2 satır). "Rakip olarak işaretle" ve kademe çipi 44 px basış, kitin sesi ve titreşimiyle.
- Sondanın bakışı cam kuyuda (göz, yaş, Teleskop çubukları); hiç bakılmadıysa uyarı renginde.
- Güç cetveli (fırlatma sayfasıyla ortak) kitte: "Bu nedir?" bağlantısı yerine kitin yuvarlak "?" düğmesi, kural cam kuyuda; şerit, eşit çizgisi ve kaçış işareti kit renklerinde.
- Okunan dağılım, ganimet, Bildirim Merkezi, koloni kuralı kitin bölüm etiketiyle; kaynak etiketi sağda.
- Eşleşme satırları telefonda sağdan kesiliyordu: artık her sınıf kendi satırında ve satırlar sarılıyor.
- Ganimet çubuğu, savaş raporundaki `.gk-loot` adıyla çakışınca görünmüyordu; ad `gk-haul` yapıldı.
- **Ölçüm** `g4d-before` / `g4d-after-2026-11-15.md`: `focus-band` 85 → 7, `focus-radiation` 76 → 0, `focus-neutral` 66 → 2. Kalanlar Ölüm Yıldızı bölümünde (G4-j).

**G4-e1 fırlatma: çerçeve, gemiler, rakamlar, gönder ✅ (2026-11-15).** Oyuncunun anı: "kanadı topla, bedeli oku, gönder."
- Kit sayfası, düşman renginde; sahibin adı kit çipinde. Yapışkan güç cetveli artık gövdenin kenarına oturuyor; kayan içerik üstünde görünmüyor.
- Her gemi kit satırı (resim, ad, sınıf, evde kaç tane) ve kitin sayacı; seçilen satır mavi ışık alıyor. Yoldaki gemiler kesik çerçeveli kit işaretleri.
- Uçuş beş kit rakamında, cam kuyuda (`v2/kit/Figure` kitte; klan dalgası da kullanıyor).
- Gönder: kitin basılı tutma düğmesi, harcama ağırlığı 1 sn, darbe sesiyle. Kapalıyken yüzü nedeni söylüyor. Kit düğmesi `data-hold` ve `data-hold-refused` işaretlerini taşıyor.
- Eşleşme işareti (✓ ×1,6) 9 px'ten kitin 12 px tabanına çıktı. Kit sayfa başlığı "İ/Ş" işaretleri için yer bırakıyor. Üst satır (korsanın "3 sa içinde gidiyor" süresi) artık kesilmiyor, sarılıyor.
- **Ölçüm** `g4e1-before` / `g4e1-after-2026-11-15.md`: `launch` 123 → 9, `launch-pirate` 143 → 8, `support-launch` 119 → 9. Kalanlar yakıt çubuğu, hız satırı (G4-e2) ve Onur satırı (G4-e3).

**G4-e2 fırlatma kontrolleri ✅ (2026-11-15).** Oyuncunun anı: "ne hızla, kiminle, hangi bedelle?"
- Uçuş hızı kitin seçim plakaları (Tam · 75 · 50 · 25 · 10 %), 320 px'te tek satır. Yakıt/süre karşılaştırması cam kuyuda, tasarruf mavi.
- Komutan gemisi eskortu kitin şalteri: geminin sınıf işareti kendi renginde, verdiği bonus şalterin altında. Tamirdeki gemi kilitli; basınca ret sesi verir ve saatini gösterir (eskiden ölü bir düğmeydi). Kit şaltere okuyucu adı (`spoken`) eklendi.
- Cetveldeki yakıt çubuğu kit renklerinde; eksik yakıt kırmızı ve miktarı yazılı. Radyasyon önizlemesi kit notları (uyarı / ölümcül).
- Gemi satırı iki katlı: ad ve sayaç üstte, "evde 6 · kargo" tam genişlikte altta. 320 px'te ad artık beş satıra bölünmüyor.
- **Ölçüm** `g4e2-before/after-*-2026-11-15.md`: `launch` 9 → 4. Aktarma (G4-f) ve anıt değişmedi. Kalan: Onur satırı (G4-e3).
- **Owner'a not:** gemiler seçilince yapışkan cetvel ile bedel/düğme arasında telefonda ~290 px kalıyor. Bedel metni K4 gereği düğmeden önce; değiştirmedim.

**G4-e3 fırlatmanın kazancı ✅ (2026-11-15).** Oyuncunun anı: "değer mi?"
- Onur kartı cam kuyuda: hedefin türü başlıkta (zayıf hedef uyarı renginde), kurallar 13 px satırlar, tek başına Onur kuralı kitin bandında. Galeride Onur verisi gelen bir görünüm yok; kart yalnız testlerle doğrulandı.
- Onur okuması gelmezse "Yeniden dene" kitin küçük düğmesi (sesli, 44 px); eskiden altı çizili 36 px bir yazıydı.
- Korsan kâr kartı cam kuyuda: kâr/zarar kenar renginde, net kazanç kalın, riskler uyarı notu. 320 px'te tablo sığıyor.
- Tempo notu (başlangıç galaksisi) kit alt satırı; savaş raporunda da aynı.
- **Ölçüm** `g4e3-after-2026-11-15.md`: `launch` 4 → 3, `launch-pirate` 8 → 3. Kalan: sayfanın adsız arka plan perdesi (bütün sayfalarda ortak, Sheet birimi) ve kapalı düğmeler.

**G4-f1 aktarma: çerçeve, gemiler, dönüş planı, gönder ✅ (2026-11-15).** Oyuncunun anı: "dünyalarım arasında gemi ve kaynak taşı."
- Kit sayfası, benim rengimde. Çıkışta kalan garnizon kit çubuğu: kalan mavi, giden alaşım rengi.
- Gemiler kit satırları ve kitin sayacı. Aktarmada satır tek katlı (~59 px): "0/40" adın altında, sayacın solunda. Olmayan gemi soluk ve "Bu dünyada yok".
- Teslimattan sonra: iki grup (yük gemileri / diğerleri) kitin seçim plakalarında, cümle düzeninde. Kit plakalarına okuyucu adı eklendi ("Yük gemileri geri dönsün").
- Varış ve yük kit rakamlarında. Gönder: kitin basılı tutma düğmesi, 1 sn (yakıt harcar).
- **Ölçüm** `g4f1-before/after-2026-11-15.md`: `transfer` 201 → 38. Kalanlar kargo kaydırıcıları, yakıt ve hedefteki yer (G4-f2).

**G4-f2 aktarma: kargo, yakıt, hedefteki yer ✅ (2026-11-15).** Oyuncunun anı: "gemilerin ambarına ne kadar kaynak koyayım?"
- Ambar durumu kit notunda (hazır / gemi yükle / ambarlı gemi yok; son ikisi sarı).
- Her kaynak bir kit kuyusu, satır ~92 px: üstte ikon, ad, depodan giden kısmı parlak çizen çubuk ve rakam tek satırda; altta kitin kaydırıcısı (−/+, Maks, klavye). "Gönderiyorsun" yalnız okuyucuya söylenir.
- Uçuş yakıtı aynı çubuk dilinde, "yarı fiyat" kuralı altında. Hedefteki hangar, Üs'ün öğrettiği yer göstergesinde (RoomGauge); dolunca sarı not.
- Eski CapacityBar ve tarayıcı range input'u bu ekrandan çıktı.
- **Ölçüm** `g4f2-after-2026-11-15.md`: `transfer` 38 → 3 (kalan: paylaşılan sayfa arka planı düğmesi).

**G4-g koloni kurma ✅ (2026-11-15).** Oyuncunun anı: "koloni kurayım mı, zamanında iner miyim?"
- Kit sayfası, benim rengimde, tam boy; başlık yalnız dünyanın adı (fiil basılı tutma düğmesinde).
- Yarış önde, bir kuyuda: kural, şimdiden yarışın sonuna uzanan çizgi ve Kuryelerin indiği yer (açılışta dolar), kendi önceliğim varsa bitişi kesik çizgiyle; altında varış / öncelik / bitiş. Öncelikte yetişirsem kuyu mavi, yetişemezsem sarı.
- Gidenler kitin rakamlarında: gemiler, kuruluş bedeli ve yakıt deponun resimleriyle; yetmeyen kaynak sarı ve noktalı.
- İki son düğmeden önce: "Kazanırsan" (bedel harcanır, koloni şu stokla açılır) ve "Kaybedersen" (Kuryeler ve bedel döner, yakıt dönmez). Uzun paragraf bu iki satıra bölündü (6 dil).
- Gönder: kitin kesin basılı tutması, 1,5 sn. Türkçede "2 Şileb" → "2 Kurye" (üç yer); de/es'te varış ve bitiş etiketleri düzeltildi.
- **Ölçüm** `g4g-before/after-2026-11-15.md`: `settlement` 32 → 0, öncelikli 32 → 0. Odak kartındaki koloni yolu G4-b3'te zaten kitteydi (2 ve 9; kalan, kapalı "Koloni kur" düğmesi).

**G4-h1 madencilik kartları: asteroit ve enkaz ✅ (2026-11-15).** Oyuncunun anı: "kazayım mı / toplayayım mı, kaç araç gitsin, yetişir mi, eve sığar mı?"
- Galeride ilk kez görünüyorlar: `focus-asteroid` (izotoplu kaya, biri yolda biri dinlenen araç, Matkap teklifi) ve `focus-debris` (kristali sığmayan yük + "Önce topla").
- Kaç araç: kitin seçim plakaları (CraftPicker); altında evdeki araçlar ve taşıma. Dinlenen araç ve yoldaki araç kit notları (kum saati / roket).
- "Yetişir mi" gönder düğmesinin hemen üstünde mavi not; gönder kitin ana düğmesi (madencilik / enkaz ikonu, sayı ve süre; engelde sebep yazar).
- Rakamlar kit kuyusunda, iki sütun. Döteryum yolu yeşil not. Sığmayan yük sarı not ve kitin "Önce topla" düğmesi; sığarsa sessiz.
- **Ölçüm** `g4h1-before/after-2026-11-15.md`: `focus-asteroid` 47 → 0, `focus-debris` 25 → 0.

**G4-h2 korsan, temas, maden seferi, uçuşum ✅ (2026-11-15).** Oyuncunun anı: "saldırayım mı, o ne, geri çağırayım mı?"
- Galeriye dört görünüm eklendi: `focus-pirate`, `focus-contact` (bana gelen radar teması), `focus-contact-fleet` (tam görüş), `focus-run` (eve dönen Kazıcılar).
- Ekipler kitin çiplerinde: geminin işareti, adı (12 px), sayısı (kalın). Korsan, temas ve uçuşum aynı çipi kullanıyor.
- Rakamlar kit kuyusunda, iki sütun (korsanda üç sütun "Bölgeden ayrılmasına"yı kelime ortasından kırıyordu).
- Notlar kit notları: korsanın hasar cezası (kalkan), izleniyor (göz), radar okuması (hedef), bana yönelmiş (kırmızı siren), eve dönen yük (sandık).
- Korsana saldır kitin ana düğmesi; akın zaten yoldaysa not. Ayrıca anıta bak kit düğmesi.
- Geri çağırma artık kitin hafif basılı tutması (0,6 sn). Bir kez yapılır ve geri alınamaz, ama harcamaz. Bekleyen şeritteki geri çağırma hâlâ dokunma; kendi biriminde gelecek. **Owner sorusu açık.**
- **Ölçüm** `g4h2-before/after-2026-11-15.md`: korsan 30 → 0, temas 19 → 0, tam filo 15 → 0, uçuş 7 → 0, korsan uçuşu 3 → 0, sefer 0 → 0.

**G4-i1 ticaret sayfası ✅ (2026-11-15).** Oyuncunun anı: "tüccarla takas edeyim mi, neyi neye?"
- Kit sayfası, benim rengimde. Üstte garnizon çubuğu (transfer'deki gibi). Konvoy kitin gemi satırlarında, ambar ve uçuş yatağı kit notları.
- Veriyorum: kitin seçim plakaları ve kit kaydırıcısı; tüccarın lotlarıyla adım adım ilerliyor, tavan ve sebebi altında.
- Alıyorum: iki uç (ucuz solda, pahalı sağda) ve tek kit kaydırıcı. Taban değerin altına inmiyor, böylece tüccara bir birim bile kalmıyor. Bacaklar ve uçuş kit kuyularında; bağlayan bacak parlak.
- Kit Slider'a `min` ve `step` eklendi (test: her hareket kendi adımında, uçlar içinde). Yerli `range`, `Segmented` ve eski HoldButton bu ekrandan çıktı. Gönder: kitin basılı tutması, 1 sn.
- Açık not: "Gidiş" iki kuyuda iki ayrı şey (hacim / süre). Eskiden de böyleydi; owner bakışında ele alınabilir.
- **Ölçüm** `g4i1-before/after-2026-11-15.md`: `trade` 147 → 3 (kalan: sayfa arka planı).

**G4-i2 konvoy akını, ticaret ve konvoy kartları ✅ (2026-11-15).** Oyuncunun anı: "konvoya vurayım mı, tüccara gitmeye değer mi?"
- Konvoy sayfası kitte, akın renginde. Önce kurallar bir kuyuda (karşılık vermez / 5 sn / geri çağrılamaz), ardından filo kitin gemi satırlarında. Eve gelecekler gerçek bir tablo: sütun başlıkları adlı, inen sütun kalın. Gönder 1 sn basılı tutma.
- Ticaret kartında eşit değer, her malın kendi renginde kit çubukları; rakamlar kuyuda. Konvoy kartı da kitte; iki kartın düğmesi kitin ana düğmesi (engelde sebep yazar).
- Galeriye `focus-trade` ve `focus-convoy` eklendi. Tüccar ve konvoy olayları ortak sabitlere alındı.
- `gk-rate` bildirim merkeziyle çakışıyordu, `gk-par` oldu. FocusPanel'in eski `BTN`/`BTN_PRIMARY` sabitleri artık kullanılmadığı için silindi.
- **Ölçüm** `g4i2-before/after-2026-11-15.md`: konvoy 154 → 3, ticaret kartı 12 → 0, konvoy kartı 6 → 0.

### G4-j — iki vuruş (Ölüm Yıldızı, radyasyon) kitte (2026-11-15)

- Ortak katlanır baş `StrikeFold`: silahın işareti, adı, hedef, "N hazır" çipi, ok. Ölüm Yıldızı kırmızı, radyasyon sarı tonda; açıkken işaret nabız atar.
- Gerçekler kit kuyusunda (`gk-strike__facts`), Honor kuralı Honor kutusunda (`gk-honor`), fırlatma kitin kesin basılı tutuşunda (1,5 sn, tehlike tonu). Sayfa hâli de (`StrikeSheet`) kit sayfası.
- Radyasyon: seviye plakaları kit sesi/titreşimiyle; koloni yükü yüzde, uzun koloni kuralı "?" arkasında; kalkan onayı kit şalteri; hata uyarı notu.
- `GameHold` `marks` aldı (`data-death-star`). Eski `strike-launch`/`radiation-launch`/`honor-note` CSS'i ve 11 kullanılmayan radyasyon token'ı silindi.
- Galeri: `focus-strike` (iki vuruş açık). Audit: strike 37 → 0, focus-strike 0; envanterden "Ölüm Yıldızı bölümü" ulaşılamazı kalktı.

### G4-k — bilinmeyen sinyal kitte (2026-11-15)

- **An:** "Sinyale gemi göndereyim mi, neyi riske atarım?"
- Kit sheet'i (kayıpta düşman tonu). Başta nefes alan bir işaret (iki halka dalgası). Kalkış dünyası yerli `<select>` yerine kit plakaları (`Choices`, görünür etiketli). Yolculuk kit kuyusunda, gemiler kit gemi plakalarında (seçili kristal ışıklı, olmayan soluk), Kurye satırı dar ekranda üret düğmesini alta alıyor.
- Beş sonuç kuyuda glyph + yüzde + ad (korsan kırmızı, sıfır olan üstü çizili), ödül ayrıntıları `RulesRow` katında. Risk düşman notu + kit maliyet satırı.
- Gönder: kitin 1 sn'lik basılı tutuşu; engelde neden düğmenin yüzünde (eski ayrı durum satırı kalktı). Sunucu hatası uyarı notu.
- Sonuçlar: korsan (kırmızı kafatası halesi), kaplama kartı, enkaz gemi — her biri kendi tonunda kit kuyusunda, buluntu görseli açılırken büyür.
- Galeri: `signal`, `signal-noship`, `signal-pirates`, `signal-skin`, `signal-derelict`; envanterdeki üç ulaşılamaz durum kapandı. Audit: 191 → 3 (kalan: ortak sheet karartması).

**C34 Ödüller ✅ (2026-11-15, yardımcı oturum).** G6 #1 `RewardsScreen` (+ galaksideki ve galerideki sac).
- **An:** "Ne kazandım, al." Sunucu ilerlemesi, kademe kimlikleri, tek istek kuralı ve taşma uyarısı değişmedi.
- **Değişen:** Alınabilir ödül varsa listenin üstünde kitin **ikmal kapsülü** (`RewardPod`): dokun, sarsılır, kapak açılır, içindeki alaşım/kristal görünür ve sıradaki alınabilir kademe alınır; 1,8 sn sonra sıradaki kapsül gelir. Her kademe yine kendi "Al" düğmesini taşıyor (kitin ana düğmesi, ağır basış, bekleyişte döner). Özet camda iki değer; her hedef kesik plaka (bekleyen yeşil kenarlı), kademe şeridi, kademeler camda, kalan yol kitin çubuğunda, "Tüm kademeler" katlama kitin basışıyla. Topluluk ödülü: ödül camda, adımlar numaralı, komutan adı seçilebilir kutuda, X bağlantısı kit satırı. Hata ve taşma banner; boş durum kitin boş-durum çizimi. Sac kitin (hediye resmi).
- **Test:** eski "beklerken gri" iddiası kitin bekleme basışına (`aria-busy`, ikinci dokunuşu yutar) çevrildi.
- **Yeni anahtar:** `rewards.openPod` (6 dil).
- **Ölçüm** (tr; telefon, dar, masaüstü): 378/376/247/9 → 3/3/3/0 (kalan 3 arkalık); 12 px altı 167→0, kontrast 57→0, 44 px altı 10→1. `reports/ui-audit/c34-rewards-after-2026-11-15.md`.

**C39 Deneme şeridi ✅ (2026-11-15, yardımcı oturum).** G6 #6 `CosmeticTrialBar`.
- **An:** "Bu görünüm gezegenimde nasıl durur?" Deneme kuralı (süre, hangi dünya, gerçek satın almaya dokunmama) değişmedi.
- **Değişen:** Şerit kitin kesik plakası (altın kenar, dock'un üstünde). Üstte küçük etiket + ürün adı görüntü yüzünde, sağda kapatma yuvarlağı (dar ekranda kaydırmasın diye uzun düğme yerine; adı "Denemeyi bitir"). Dünya seçimi yerli `select` yerine kitin seçim çipleri. "Karşılaştır/Göster" ve "Mağazaya dön" kitin düğmeleri.
- **Test:** iki testteki combobox değişimi radyo seçimine çevrildi; kit testi eklendi.
- **Galeri:** yeni görünüm `cosmetic-trial-bar` (iki dünya); envanter erişimine eklendi.
- **Ölçüm** (tr; telefon, dar, masaüstü): `cosmetic-trial-bar` 17 → 0. Akış görünümü `cosmetic-trial` 42 → 22: açıldığı mağazayı ölçüyor, mağaza C35'te. `reports/ui-audit/c39-trial-bar-before/after-2026-11-15.md`, `g6-shop-before-2026-11-15.md`.

**C40 Menüdeki mağaza vitrini 🗑 (2026-11-15, yardımcı oturum).** G6 #7 `shell/ShopShowcase` + `ShopShowcasePoster`. G1-f2'den beri hiçbir yer çizmiyordu (menü Mağaza/Envanter karolarını `MenuTile` ile çiziyor); owner'ın 2026-11-14 "hiç kullanılmıyorsa sil" onayıyla silindi.
- **Silinen:** iki dosya, `test/shop-showcase.test.tsx`, `native-surfaces` içindeki vitrin testi, CSS'te `.menu-shop-*`, `.shop-showcase-*`, `.inventory-scene`, `--menu-art-shade`, iki `--color-v2-store-*` rengi; yalnız onun okuduğu `skins.showcaseDescription`, `menu.navigation.shopHint/inventoryHint` (6 dil). Bozuk kalmış araçlar: `tools/shop-showcase-visual.mjs` ve `visual.mjs --shop-showcase`, `ufo-probe-visual.mjs` içindeki menü adımı.
- **Kalan:** `shop-showcase-static.webp` resmi (Mağaza karosu kullanıyor).

**C41 Destek ol ✅ (2026-11-15, yardımcı oturum).** G6 #8 `DonateScreen` (+ galaksideki ve galerideki sac).
- **An:** "Oyuna nasıl destek olurum, zorunlu mu?" Dört Shopier bağlantısı, iki cüzdan adresi (harfi harfine, seçilebilir) ve kopyalama kuralı (pano reddederse "Kopyalandı" demez) değişmedi.
- **Değişen:** Bölümler kitin etiketiyle; dava camda, "Geliştiriciden bir not" 44 px katlama satırı (ses + titreşim, ok döner). Dört kart resmi yine düğmenin kendisi; basınca ses, titreşim ve hafif çökme. Cüzdanlar camda, "Kopyala" kitin küçük düğmesi; kopyalanınca yeşile döner, tik gelir, adı değişir. Notlar kitin dipnotu. Sac kitin (yıldız resmi).
- **Ölçüm** (tr; telefon, dar, masaüstü): 39 → 3 (kalan 3 arkalık); 12 px altı 15→0, kontrast 5→0. `reports/ui-audit/c41-donate-after-2026-11-15.md` (önce: `g6-shop-before`).

**G4 kapanışı: altı dilde telefon ölçümü (2026-11-15).** 9 yüzey, 40 görünüm × 6 dil = 239 ölçüm (`g4-close-6lang-2026-11-15.md`). Kesilen 0, yana taşma 0. Bulunan iki şey düzeltildi (`g4-close-fix-2026-11-15.md`): Ölüm Yıldızı başlığı ve "1 hazır" çipi kendi kırmızı zemininde 4,3:1 kalıyordu → tonun açık ucu, kontrast 0. fr yerleşme tutuşu "Envoyer les vaisseaux de colonisation" kırpılıyordu → "Envoyer les colons", kırpılan 0. Kalan: yerleşme `claim-other` görünümünde 3 küçük/tepkisiz hedef (yarış satırının yanındaki başkasının hakkı), sheet'lerin ortak karartması (3 puan).

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

**C10 Kronik ✅ (2026-11-14, yardımcı oturum).** G5 #8. Zilin "Kronik" sekmesi; v1'den kite geçti. Olay gruplama (8 dakika kuralı), olay türleri ve hangi dünyaya gidilebildiği değişmedi.

- **Defter satırı:** her an kitin defterinde (`gk-ledger`) bir satır.
  - Soldaki renkli işaret haberin türünü söylüyor:
    - düşman rengi: bombardıman, Ölüm Yıldızı
    - altın: Merkez kademesi, Hakimiyet liderliği, sezon perdesi, kontrol devri
    - yeşil: tüccar, enkaz, açılan dünyalar
    - sönük: tükenen kaya ya da biten olay
  - Başlık büyük harfle bağırmıyor, 14 px ve kalın.
  - Zaman başlığın satırında, sağda; tekrar sayısı (×2) zamanın üstünde.
- **Satır bir kapı:** gidilebilen bir dünyaya ait anda satırın tamamı kapı. Ekran okuyucu satırı başlıkla adlandırıyor, hikâyeyi ve zamanı açıklama olarak okuyor. Önceden yalnız başlık basılabiliyordu ve 44 px altındaydı.
- **Boş kronik:** kitin boş durumu (galaksi resmi, "Galaksi şimdilik sakin" ve alt cümle). Yeni anahtar ×6: `chronicle.emptyTitle`; `chronicle.empty` ikinci cümleye indi.
- **Daha eski olaylar:** kitin tuşu, yüklenirken dönüyor.
- **Galeri:** `chronicle` ve `chronicle-empty` görünümleri eklendi. Zil sekmesi, örnek bir hafta (iki bombardıman tek satırda, Ölüm Yıldızı, tüccar, kademe, liderlik, tükenen kaya, Savaş perdesi).

Ölçüm: `reports/ui-audit/c10-view-guide-chronicle-after-2026-11-14.md`.

**C14 Savaş listesi ✅ (2026-11-14, yardımcı oturum).** G5 #1 ve #2. Oyuncunun anı: İstihbarat › Savaşlar'da geçmiş savaşlara bakıp hangisini açacağını seçmek. Hangi raporun listelendiği, sırası ve rapor kapısının (`BattleReportDoor`: bildirimden tek rapora, bulamazsa listeye) davranışı değişmedi.

- **Defter satırı:** her savaş kitin defterinde (`gk-ledger`) bir satır ve satırın tamamı raporun kapısı.
  - Soldaki işaret sonucun rengini taşıyor: kazanılan turkuaz, kısmi bakır, kaybedilen kırmızı. İşaretin simgesi savaşın türünü söylüyor: kendi akının saldırı, sana yapılan akın kalkan, korsan, klan desteği, Ölüm Yıldızı nişangâh, radyasyon bombası, anıt bayrak.
  - Başlık kiminle olduğunu söylüyor ("Akın ettiğin: [NOVA] VEX"). Altında aynı renkte hüküm, sonra zaman · yer · tur sayısı.
  - Onur ve Hâkimiyet değişimi tek satırda, simgeleriyle. Ekran okuyucu adlarını okuyor. Sıfır değişim yazılmıyor.
  - Önceden hüküm çerçeveli bir rozetti, puanlar sağda iki satırlık bir sütundu; stratejik satırın başlığı üç noktayla kesiliyordu.
- **Stratejik satır:** sonuç oyuncunun tarafından okunuyor. Senin isabet eden saldırın kazanç rengi, sana isabet eden kayıp rengi; önceden her isabet kırmızıydı. Hasar artık birimiyle yazıyor ("18,4K hasar"). Yeni anahtar ×6: `reports.strategicDamageShort`.
- **Boş liste:** kitin boş durumu, raporlar resmiyle. Yeni anahtar ×6: `reports.emptyTitle`.
- **Dünya kapısı:** savaşın olduğu dünya kendi kapısını koruyor. Satırın altında, kesik çizgili dikişle bağlı ikinci kapı: nişangâh ve dünyanın adı (44 px). Önceden satır içinde 12 px'lik, altı çizili bir addı.
  - Bu kapı ve C11'deki "taranan dünyan" kapısı artık aynı kit sınıfını kullanıyor: `gk-ledger__seam`.
  - Dünyanın adı bir kez yazılıyor: kapı varsa yalnız kapıda, yoksa satırda düz yazı.
- **Çeviri düzeltmeleri:** satır başlığındaki açılış sözleri birkaç dilde adla birleşiyordu ("Du hast überfallenPiratenflotte", "Dein Todesstern im VisierSable").
  - Japoncada "による襲撃" adın önüne geliyordu.
  - Japoncada "あなたの デス・スター がターゲットにされています" "Ölüm Yıldızın hedef alındı" demekti; tersi.
  - de, es ve ja açılışları "…: " biçimine getirildi. Satır, adın önüne her dilde bir boşluk koyuyor.
- **Kaldırılan:** yalnız listenin kullandığı `GradeMark` ve başlığın yanındaki "en yeni önce" (`reports.newest` ×6) kullanılmaz oldu; silindi. Liste yine en yeni önde.
- Galeri: `intel-battles` (akın, savunma, korsan, Ölüm Yıldızı, anıt).

Ölçüm: `reports/ui-audit/c14-battle-list-after-2026-11-14.md`. Sonra iki yol, 28 ölçüm: dikiş sınıfı paylaşıldığı için C11'in `intel-radar-named` görünümü de yeniden ölçüldü; değerleri C11'dekiyle aynı.

| Ölçü | Önce | Sonra |
|---|---|---|
| 12 px altı metin | 99 | 0 |
| Kontrastı yetmeyen metin | 34 | 0 |
| 44 px altı hedef | 2 | 2 |
| Aralık hatası | 0 | 2 |
| Basınca tepkisiz | 5 | 1 |
| Kesilen metin (bütün diller) | 21 | 0 |

- Sonradaki 44 px, aralık ve tepkisiz kayıtlarının hepsi aynı öğe: sayfanın arkasındaki 2×2 px'lik kapatma alanı (G1 sayfa çerçevesi). Liste ekranı doldurunca sayfa tam boy açılıyor, arkada 2 px kalıyor. Listenin kendi satırlarında bulgu yok. Sayfa çerçevesinin işi; bu birimde değiştirilmedi.

**C15a Savaş raporu: çerçeve ve sıradaki hamle ✅ (2026-11-15, yardımcı oturum).** G5 #3'ün ilk yarısı; kuvvetler ve turlar C15b'de, sahne C16'da.
- **An:** oyuncu raporu açıp "ne oldu, neden, şimdi ne yapayım?" diye okuyor; dört sorunun test edilen sırası korunuyor.
- **Değişen:** her soru kitin etiketi altında kendi bölümünde; sonuç kendi renginde plaka; rota iki 44 px dünya kapısı (önce 12 px altı çizili ad); neden, boş geçiş, Hâkimiyet dökümü, sonuçlar ve klanlar kitin camında; `SurvivorBar` kitte (`data-tone`). Yeni kapanış "Sıradaki hamlen": yeniden saldır, saldıranın dünyası, enkaza git; her kapı yalnız açılabiliyorsa görünür, korsanda yok (`reports.next.*` ×7).
- **Kaldırılan:** `battle-report.css` (seçilebilir metin kuralı `.gk-report`te).
- **Ölçüm** (tr; telefon, dar, masaüstü; 5 rapor görünümü): puan 304→193 (baskın), 219→145 (savunma), 165→122 (korsan), 131/122→77 (destek); 12 px altı 719→461, kontrast 50→32, 44 px altı 22→17, tepkisiz 28→23; kesilme ve taşma 0. Kalanların hepsi üstteki sahnede (C16) ve kuvvet/tur bloklarında (C15b); bu birimin bölümlerinde bulgu yok. Kitin büyük harfli 12 px bölüm etiketi T2'ye düşüyor (kit tercihi). `reports/ui-audit/c15a-report-sheet-after-2026-11-15.md`.
- **Açık soru:** yok. Uzunluk C15b'den sonra yeniden ölçülecek.

**C15b Savaş raporu: kuvvetler, Aegis ve turlar ✅ (2026-11-15, yardımcı oturum).** G5 #3'ün ikinci yarısı.
- **An:** oyuncu "karşıda ne vardı, kim ne zaman öldü?" diye okuyor; iki taraf aynı satırdan okunuyor.
- **Değişen:** bir gövde tek sıkı satır (solda resim; ad ve tür, etiketli üç sayı tek satırda, altında çubuk): satır ~118 → ~66 px; etiketli sayılar korunuyor (sahibin "dört sütunlu tablo okunmuyor" raporu). Aegis kitin camında, durumu sözle (çip); turlar tek kit defteri (`gk-turn`, kitte `gk-round` düğme olduğu için), her turun atış hesabı turun içinde sessiz bir kural satırı; savaş ve dağınık ateş kuralları kitin kural satırı (ses + titreşim). Destek hattı, ortak savaş, kayıp çipleri ve geri çekilme notu kitte.
- **Çeviri düzeltmesi:** de "Links"/es "Izquierda" (yön!) → "Übrig"/"Quedan"; de/es Aegis durumları İngilizceydi; ja 開催中 ("oturumda") → 健在, rapor etiketleri 投入/保有/喪失/生存. Galeri savunma örneği yeniden kurulan Tabya'yı artık gösteriyor.
- **Kaldırılan:** bu bölümlerdeki bütün v1/v2 sınıfları; adım listesinin çift numarası.
- **Ölçüm** (tr; telefon, dar, masaüstü; 5 rapor görünümü): C15a sonrasına göre puan 193→89 (baskın), 145→68 (savunma), 122→59 (korsan), 77→41 (destek); 12 px altı 461→211, kontrast 32→18, 44 px altı 17→9, tepkisiz 23→15; kesilme ve taşma 0. Kalanların hepsi üstteki sahnede (C16) ve kitin bölüm etiketinde. Savunma görünümü artık 3 gövde gösteriyor (örnek veri). `reports/ui-audit/c15b-report-forces-after-2026-11-15.md`.
- **Açık soru:** yok. ja verdict'te kalan zayıf çeviriler (yourForce "あなたの力", standing) grup sonu 6 dil turunda.

**C16a Savaş raporu: sahne ✅ (2026-11-15, yardımcı oturum).** G5 #3'ün ilk ekranı (ReportScene) ve Honor özeti; tekrar kapısı C16b'de.
- **An:** rapor açılınca ilk ekran: dünya, sonuç sözcüğü, ganimet, iki taraf, neden, bilanço ve kapılar.
- **Değişen:** sahne kitte (`gk-debrief`, kitte `gk-scene` olduğu için). Sözcük solda, dünyanın resmi sağ üstte; resim artık sözcüğün ve satırların arkasına düşmüyor (kontrast). Sözcüğün rengi `data-tone`. İki taraf kitin hayatta kalan çubuğuyla; karşı tarafın kaybı yeşil (senin ateşin), seninki kırmızı. Kapılar kitin düğmeleri; "Yeniden saldır" tek turuncu eylem. Honor özeti kitin camında, dökümü kitin kural satırı (ses + titreşim). Ganimet kayıttaki ganimet satırıyla aynı.
- **Düzeltme:** sahne korsanı sunucunun İngilizce yedek adıyla ("Pirate L2-Rook") yazıyordu; artık listedeki gibi yerel ad (D150). Tarafsız dünyada boş ad yerine "Tarafsız garnizon" (`reportScene.neutralSide` ×6).
- **Kaldırılan:** sahnedeki 12 px altı çizili dünya adı düğmesi; aynı dünyaya 44 px'lik kapı birkaç satır aşağıdaki rotada (C15a). `ReportScene.onFocusPlanet` bu yüzden kalktı.
- **Ölçüm** (tr; telefon, dar, masaüstü; 7 görünüm): C15b sonrasına göre puan 89→8 (baskın), 68→8 (savunma), 59→6 (korsan), 41→4 (destek); bağımsız sahne görünümleri 0 ve 2. 12 px altı 211→18, kontrast 18→2, 44 px altı 9→1, tepkisiz 15→6; kesilme ve taşma 0. Kalanlar: tekrar kapısı (C16b), G9'un sayı göstergesi ve galerideki sayfa arkalığı (G1 çerçevesi). `reports/ui-audit/c16a-report-scene-after-2026-11-15.md`.
- **Açık soru:** yok. `RankingScores` (Honor/Hâkimiyet sayıları) liderlik tablosuyla birlikte G9'da kite geçecek.

**C16b Savaş raporu: tekrar kapısı ve tekrar kabuğu ✅ (2026-11-15, yardımcı oturum).** G5 #5; 3B sahnenin kendisi (BattleReplay, simülatörün dili) G11'de.
- **An:** raporun en üstünde "savaşı izle / simülatörde dene"; basınca tam ekran tekrar açılır, kayıt gelene kadar bekler, gelmezse yeniden dener.
- **Değişen:** kapı tek satır: izle çelik düğme (göz), dene sessiz düğme; sayfanın tek turuncusu yine "Yeniden saldır". 3B görünüm inerken izle düğmesi döner (basış hemen yanıt alır). Kabuğun başı sayfaların kit başı: solda yuvarlak geri, "SAVAŞ TEKRARI" ve kayıt notu; bekleme ve hata kitin dilinde, sahnenin yerinde hafif ışık. Sahne `.simulator` çerçevesini kabuğun içinde korur, simülatörün düğme kuralları kit düğmelerine ulaşmaz. Galeride `replay-loading`, `replay-failed`, `replay-stage` (sonuncusu ölçülmüyor, G11 için).
- **Düzeltme:** telefon yan tutulunca eski baş tamamen gizleniyordu; geri hareketi olmayan telefonda çıkış kalmıyordu. Artık baş daralır, geri düğmesi kalır. "Kayıt yok" notu 9 px'ten 13 px'e (kontrast geçiyor).
- **Kaldırılan:** eski `sim-header` başı ve onun `simulator.css` düğme kuralı, kökteki z-index (kabuk taşıyor).
- **Ölçüm** (tr; telefon, dar, masaüstü; 7 rapor + 2 kabuk görünümü): C16a sonrasına göre 12 px altı 18→4, kontrast 2→0, tepkisiz 6→0; kesilme ve taşma 0. Kabuk görünümleri 12 ve 16 puan. Kalan 12 px altı 4 metin G9'un sayı göstergesi. `reports/ui-audit/c16b-replay-door-after-2026-11-15.md`.
- **Açık soru:** yok. de/fr/es'de iki düğme 350 px'te iki satıra iner (izle tam satır, dene altında); grup sonu 6 dil turunda daha kısa söz bakılacak.

**C17 Stratejik rapor ve anıt raporu ✅ (2026-11-15, yardımcı oturum).** G5 #4 ve G9 #8.
- **An:** Ölüm Yıldızı ya da radyasyon bombası düştü (senin ya da sana) — ne kırdı, koloni hâlâ benim mi? Anıta dalga gitti — anıt kimin, neye mal oldu?
- **Değişen:** iki sayfa kitin çerçevesinde (Ölüm Yıldızı resmi, kimin haberiyse o renk). Rota iki 44 px dünya kapısı (önce 12 px altı çizili ad). Stratejik: sonucun rengindeki plakada 2×2 rakam, altında kitin etiketleriyle madenler (resimli), gemi/savunma, düşen seviyeler, kuyruk; adlar artık oyuncunun dilinde (`SHIPYARD` → Tersane, `DEUTERIUM_PLANT` → Döteryum Rafinerisi). Bomba: plakada yalnız olanlar (sadakat, arızalar); bombanın kuralları kapalı "Bomba nasıl işler" satırında. Anıt: plaka (tarih · tur, kontrol, derece, karşı taraf), kendi gövdeleri hayatta kalan çubuğuyla, turlar ve savaş kuralları kitin kural satırlarında, "Anıta bak" kitin düğmesi. Yeni anahtar ×6: `reports.strategicFleetLost`, `reports.strategicBombRules`. `RulesRow` paylaşılan parça oldu (`ui/RulesRow.tsx`).
- **Kaldırılan:** `StrategicMetric` (v2 legend), `battleTone` (v2 renk tablosu), anıt raporundaki bütün v2 sınıfları.
- **Ölçüm** (tr; telefon, dar, masaüstü; 4 görünüm, galeriye `report-sheet-strike/-bomb/-monument` eklendi): puan 59→0 (Ölüm Yıldızı), 20→0 (bomba), 33→5 (anıt), 13→0 (EMP koloni); 12 px altı 77→2, kontrast 10→0, tepkisiz 6→1; bomba ekranı 110→55 kelime. Anıtta kalanlar `RankingScores` (C19) ve sayfa arkalığının 2×2 kapatma alanı (G1). `reports/ui-audit/c17-strategic-monument-after-2026-11-15.md`.
- **Açık soru:** yok. Anıt raporunda "Kurtardığın döteryum: 17,000" ve "%68,0000 sağlık" ondalıkları (eski, `decimal(…, 3/4)`) Türkçede binlik gibi okunuyor; G9 sonunda kısaltılabilir.

**G5 kapanışı (2026-11-15, yardımcı oturum).** 6 dil, telefon, 7 rapor görünümü (`reports/ui-audit/g5-close-6lang-2026-11-15.md`): taşma ve kırpılma 0; kesilen 3 → 0 (stratejik raporun başlık üstü satırı de/fr/es'de Ölüm Yıldızı resminin yanında kesiliyordu, artık iki satıra iner). Tekrar kapısı de/fr/es'de tek satır: "Ansehen / Simulieren", "Regarder / Simuler", "Ver / Simular". ja hüküm sözleri: 自軍, 残存, 撃破, 敵ユニット撃破, 自陣営/敵陣営 ("あなたの力", "立っている" gibi düz çeviriler gitti). Kalan 12 px altı: G9'un `RankingScores` göstergesi (C19). Geniş rapor test grubu (90 dosya) yeşil.

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

**G7 birim planı (2026-11-15):**

| Birim | Yüzey | Oyuncu anı | İş |
|---|---|---|---|
| G7-a | Yardım | "Klan arkadaşıma ne gönderebilirim?" | ✅ aşağıda |
| G7-b | Klan başlığı + sekmeler + sayfa çerçevesi | "Klanım kim, neredeyim?" | 9 px "Klan Hâkimiyeti", v2 sekmeler → kit sekmeleri |
| G7-c | Genel | "Klan ne durumda?" | koltuklar, sıralama, olaylar, arena takım paneli |
| G7-d | Güç | "Ne kadar güçlüyüz?" | |
| G7-e | Üyeler | "Kim aktif, kimi yöneteyim?" | `Confirmation` → kit basılı tutma |
| G7-f | Dışarıda | "Klana gireyim mi, kurayım mı?" | ✅ aşağıda |
| G7-g | Savaş + dalga sheet'i | "Hedefe dalga gönderelim mi?" | ✅ aşağıda |
| G7-h | Bağış sheet'i | "Hazineye ne kadar, hangi dünyadan?" | ✅ aşağıda |
| G7-i | Destek gönder | "Gemilerim klan arkadaşımın dünyasını tutabilir mi?" | ✅ aşağıda (duruş kartı Üs yüzeyinde, zaten kitte) |
| G7-j | Klan sancağı | "Klanımız sırada neyi açıyor, kim taşıyor?" | ✅ aşağıda |

**G7-a Yardım ✅ (2026-11-15).**
- **An:** "Klan arkadaşıma gemi ya da kaynak gönderebilir miyim, ne kadar, ne zaman varır?"
- Yardım almak kit şalteri (adı sabit, durumu alt satırda); 12 saatlik bekleme kuralı altında.
- Üç yerli `<select>` yerine kitin yeni `Picker`'ı: yüzünde alan adı ve seçim, basınca kit listesi düşer, seçince kapanır; tek seçenek kesik çizgili bir gerçek olarak durur. G8 ve G10'da da kullanılacak.
- Gemiler kit gövde satırlarında; evde olmayan gövde satır kaplamıyor (yoksa "evde gemi yok" notu). Kargo, Aktar sayfasının satırlarında (stoktan düşen çubuk + kit kaydırıcı, sayı kutusu yok); ambar dolu/taşma satırı canlı.
- "Uçuşu kontrol et" kit düğmesi; teklif kit kuyusunda: süre ve alıcı sınırı rakamları, alıcının uçuş rampaları hücre olarak, uyarılar notlarda, sınırlar kit maliyet satırında. Hediye geri alınamaz → kitin kesin tutuşu (1,5 sn), etiketi kısa "Yardım gönder" (eski uzun etiket 350 px'te kırpılıyordu); dönüş bilgisi üstteki çipte.
- Silinen: `SelectField`, panelin `Plate`/`Section`/`Stat`/`Tally`/`CapacityBar`/`HoldButton` kullanımı, kullanılmayan `launch`/`launchDelivery` metinleri (6 dil). Yeni: `noShips` (6 dil).
- Galeri: `clan-aid-quote` (teklifi cevaplayan sahte sunucu); `clan-aid`'e alıcı dünyaları eklendi.
- Audit: 472 → 30. Kalan: klan başlığı ve sekmeler (G7-b), devre dışı "−" düğmesinin soluk çizgisi.

**G7-b Klan başlığı, sekmeler, çerçeve ✅ (2026-11-15).**
- **An:** "Klanım hangisi, ben neredeyim?"
- Sayfa çerçevesi kit başlığı aldı (klan sancağı ikonu + atmosfer resmi). Klan kartı kitte: etiket rozeti, ad (kırpılmaz, her yerden kırılır), Lider çipi altın, slogan, ekip ve Klan Hâkimiyeti 12 px tabanda (eski 9 px).
- Beş sekme v2 `Segmented` yerine Üs'ün iki katlı kit çubuğu: işaret (ev, çubuklar, kalkan, paylaş, kırmızı saldırı) üstte, kısa ad altta; okuyucu tam adı duyar.
- Audit: yardım görünümü 30 → 3 (kalan: ortak sheet karartması). Genel sekmesinin 113 puanı içerikten (G7-c).

**G7-c Genel sekmesi ✅ (2026-11-15).**
- **An:** "Klanım ne durumda, payım ne, kim neredeyiz?"
- Beş koltuk kit madalyonları (lider altın, boş koltuk kesik çizgi, 12 px taban). Uyum durumu kit kuyusunda not.
- "Klanın ne yapıyor?" faydaları üye için `RulesRow` katında (üye bunları biliyor; her açılışta 8 kart kaydırmıyor); dışarıdakine açık durur (G7-f). Fayda işaretleri kit glyph'leri.
- 5 klan saldırısı kuralı tek satırlık uyarı notu. Sıralama kit satırları: sıra, etiket + ad, merkez çizgisinden çubuk (geride olan sola, kırmızı), işaretli puan.
- Ganimet payı kuyuda: üç kaynak hücresi, "Ana gezegene al" kit düğmesi. Kayıt kit satırları, "daha eskiler" kit düğmesi.
- Silinen: `SmallRule`, `ResourceFigure`, `RESOURCE_INK`, v2 fayda ikonları. Sınıf çakışması önlendi: `gk-event`/`gk-res` başkasının, bunlar `gk-clanlog`/`gk-depot`.
- Audit: genel 113 → 3 (kalan: ortak sheet karartması).

**G7-d Güç sekmesi ✅ (2026-11-15).**
- **An:** "Birlikte ne kadar güçlüyüz, kim ne katıyor?"
- Kahraman kuyu: klan etiketi, başlık, açıklama, iki büyük rakam (ekip Hâkimiyeti, toplam filo) ipucu alt satırlarıyla. Toplamlar tek kuyuda kit rakamları (havadaki uçuşlar tam satır).
- Filo dağılımı gemi görseli + sayı + çubuk; üye katkısı Hâkimiyet çubuğu (en güçlüye göre) + satır. Lider çipi altın.
- Sınıf çakışması önlendi: `gk-force` savaş raporunun, bunlar `gk-might`. Silinen: `Stat` kullanımı.
- Audit: güç görünümü 3 (kalan: ortak sheet karartması; eski ölçümde sekme ayrı ölçülmemişti, G0'da klanın bütünü 472'nin parçasıydı).

**G7-e Üyeler sekmesi ✅ (2026-11-15).**
- **An:** "Kim aktif, kimi yöneteyim, kimi davet edeyim?"
- Ekip listesi tek kuyuda: aktiflik lambası (yeşil parlar / gri), ad, Sen ve Lider çipleri, durum satırı; liderin iki hamlesi (Lider yap, Çıkar) her satırda kit düğmesi.
- `Confirmation` kitte: kırmızı kenarlı kuyuda ne olacağı, hamlenin kendisi kitin 0,6 sn tutuşu (owner 2026-11-14: eski onaylar 0,6 sn), yanında İptal. Çıkarma, liderlik devri, ayrılma, dağıtma ve düşman uçuşlu üye kabulü hepsi bunu kullanıyor.
- Başvurular kuyuda, Kabul / Reddet kit düğmeleri. Davet: yerli `<select>` yerine kit `Picker` (aday yoksa kesik çizgili gerçek). Ayarlar: kit metin alanı, işe alım kit şalteri, Kaydet kit düğmesi.
- Silinen: üyeler panelindeki `Plate`/`Section`/`Chip`/`Button`/`Note`/`EmptyState` ve yerli `select`/checkbox.
- Audit: üyeler 3 (kalan: ortak sheet karartması).

**G7-f Dışarıda (klansız komutan) ✅ (2026-11-15).**
- **An:** "Klana gireyim mi, hangisine, yoksa kendim mi kurayım?"
- Tanıtım klanın atmosferinde: başlık, kuruluş bedeli tam rakamla ("2K" değil), şart, iki yol (Ekibini bul / Klanını kur). Telefonda iki yol alt alta, her biri tek satır. Sayfa başlığıyla aynı "Sezonluk klanlar" üst yazısı silindi.
- İstekler kuyuda: davet Kabul / Reddet, başvuru Geri çek kit düğmeleri; kalan süre çipte. Eski ganimet kuyuda kit düğmesiyle.
- Dizin: kit arama alanı + Ara; her klan bir kapı (etiket rozeti, ad, seviye çipi, iki satır slogan, lider/üye/Hâkimiyet, ok). Başvur sağda küçük kit düğmesi; basılamıyorsa yüzünde nedeni (bekliyor, dolu, alım kapalı, kilitli).
- Klan profili kit sheet'i: slogan, seviye, kadro tek kuyuda (Lider altın çip, Hâkimiyet sütun başlığıyla), altta Başvur.
- Klan kur: Komuta Çekirdeği çipi (kilit/onay), bedel, kimlik uyarısı, ad + kısa etiket yan yana, açıklama, işe alım kit şalteri (yerli checkbox gitti). Düğme kararmak yerine eksik olanı söyler: "Önce koşulları karşıla" / "Ad ve etiket gir" (6 dil, yeni).
- Çeviri düzeltmeleri: de "Einen Clan gefunden" → "Clan gründen", es "Encontrado un clan" → "Fundar clan" (ikisi de "bir klan bulundu" diyordu); de/es dizindeki "Anwenden"/"Aplicar" → "Bewerben"/"Solicitar". Türkçe yol düğmeleri kısaldı.
- Silinen: dışarıdaki `Plate`/`Section`/`Chip`/`Button`/`Note`/`EmptyState`/`PriceTag`, `ClanIcon`/`CoreIcon`, `.clan-command-head` CSS'i. `MutationError` kit notu oldu.
- Galeri: `clan-outside` (davet, bekleyen başvuru, eski ganimet, dört klan, profil). Envanterde "dışarıda" artık ulaşılamayan değil.
- Audit (yalnız sonrası; görünüm önce galeride yoktu): 3 (kalan: ortak sheet karartması). Taşma 0, kontrast 0. Kelime yükü 77/ekran: tanıtımın fayda kartları (G7-c kararı).
- Not: topluluk sözleşmesi kapısı (`CommunityPolicyGate`) sohbetle ortak; içindeki v2 kalıntıları ve yerli onay kutusu G8'de.

**G7-g Savaş odası + dalga sayfası ✅ (2026-11-15).**
- **An:** "Hedefe dalga gönderelim mi, lider saldırıyı başlatsın mı?"
- Hedef kırmızı kenarlı kuyuda: gezegen (kırmızı hale), rakip çipi, ad, kalan süre, durum çipi. Hat: toplanmaya uçan dalgalar adları ve süreleriyle üstte, mavi iz toplanma noktasına, oradan kırmızı nabız atan hedefe. 320'de "Toplanma · Mira" ile "Hedef" çakışıyordu: toplanma adı artık düğümün soluna biter.
- Beş koltuk kit plakaları (baş harfler, payı gösteren çubuk, ad; Sen kendi renginde, boş koltuk kesik çizgi). Seçilen komutanın dalgası: gemiler, sağlık çubukları (kritik sarı), "Filomu geri çağır" kitin 0,6 sn tutuşu (eski v1 düğme). Hangar kuyuda mavi çubuk; seviye kapasite satırına indi (boş satır gitti).
- Gönder satırı: Klan sohbeti + "Gemi ekle" kit düğmeleri; basılamıyorsa yüzünde nedeni. Liderin bölümü: varış, hız, radyasyon, kit şalterleri; ortak saldırı kitin kesin tutuşu (1,5 sn, her dalga savaşa girer). "Hedefi iptal et" artık açılan pencere değil: yerinde kırmızı kuyu + 0,6 sn tutuş + Geri dön (owner 2026-11-14 kararı). Bu soru kalıbı `ClanConfirmation.tsx`'e taşındı; klanın bütün onayları onu kullanıyor.
- "Neden bu oda?" açıklaması `RulesRow` katında.
- Dalga sayfası kit sheet'i, saldırı rengi: köken kit seçenekleri, gemiler Konvoy'un kit satırlarında (seçilen / evdeki), teklif kit rakamlarında, kurallar notlarda, gönder kitin harcama tutuşu (1 sn). Yeni metin: `clanWar.waveShips` (6 dil).
- Silinen: savaş odasındaki `Plate`/`Button`/v2 `Toggle`/`HoldButton`/`Confirm`/`Icon`/`ClassEmblem` kullanımı; artık kimsenin kullanmadığı `v2/kit/Toggle.tsx`.
- Audit: 196 → 110. Kalan bulguların hepsi sancakta (9 px basamaklar, küçük basamak hedefleri; G7-j). Rakip çipi kontrastı düzeltildi. Teklifli dalga sayfası galeride fiyatlanamıyor; testlerle doğrulandı.

**G7-h Bağış sayfası ✅ (2026-11-15).**
- **An:** "Ortak hazineye ne kadar vereyim, hangi dünyadan?"
- Kit sheet'i. Dünya kit seçeneklerinde. Her kaynak Yardım sayfasının satırında: ad, hazinenin kalan ihtiyacı ("hazine 40.000 ister"), dünyanın stoğundan düşen çubuk ve seçilen miktar, kit kaydırıcı (stok ya da ihtiyaç, hangisi azsa) ve Maks.
- Bağış geri alınamaz → kitin kesin tutuşu (1,5 sn); miktar seçilmeden yüzünde "Önce miktar seç". Odanın küçülmesi korunur: gönderilen, kaydırıcının gösterdiğidir.
- Yeni metinler: `clanWar.donatePick`, `clanWar.donateNeed` (6 dil). Galeri: `clan-donate`.
- Envanter düzeltmesi: G7-g'de eklenen `ClanConfirmation.tsx` klan yüzeyine yazıldı (envanter testi kırmızıydı).
- Audit (yalnız sonrası; sayfa önce galeride yoktu): 0.

**G7-i Destek gönder ✅ (2026-11-15).**
- **An:** "Gemilerim klan arkadaşımın dünyasını tutabilir mi, hangi şartla?"
- Kit sheet'i, bizim renkte. Alarma cevapsa üstte kırmızı nabız atan şerit: "Klan alarmına cevap" ve saldırının inişine kalan süre; fiyatlanınca yeşil "zamanında" / sarı "geç" notu.
- Gemiler Konvoy/dalga sayfasının kit satırlarında ("Hattın"), komutan gemisi eşliği aynı yerde. Uçuş kit rakamlarında (yakıt, varış, ev sahibinin yeri, rampalar); bağlayan kurallar tutuştan önce kuyuda ikonlu notlar (kalış süresi, sezon kesmesi, kademe bandı, geri çekilememe, sıralama payı).
- Gönder kitin harcama tutuşu (1 sn; yakıt yanar, hat eve çağrılabilir), ilk ret yüzünde.
- Duruş kartı (`DefencePostureCard`) Üs yüzeyinin `ClanSupportBay.tsx` dosyasında ve zaten kitte; bu birimde değişmedi.
- Yeni metin: `clanSupport.lineShips` (6 dil). Silinen: kimsenin kullanmadığı `v2/kit/ChoiceChips.tsx`.
- Audit: 71 → 0.

**G7-j Klan sancağı ✅ (2026-11-15).**
- **An:** "Klanımız sırada neyi açıyor, hazine ne kadar dolu, kim taşıyor?"
- On basamak artık 20 px'lik çentik değil: kumaş üzerinde iki sıra (1–5 etekte, 6–10 direkte), her biri 44 px. Açık basamaklar mavi parlar, sıradaki nabız atar, seçilen halkalı, yükselen basamak iki kez atar; en üstte kumaş ve basamaklar altın.
- Basamak kartı tam genişlik kuyuda (kilitli olanın resmi gri); "Klanında olanlar" satırı; kese kaynak çubukları ve bağışçılara bölünmüş çubuk.
- Bağışla kit düğmesi; lider yükseltmesi kitin harcama tutuşu (1 sn; hazine harcanır), nedeni yüzünde.
- Katkı Defteri kit satırları: ad (kendi satırın renkli), eylemler tam genişlik, bağış adın altında, son 24 saat kit renklerinde.
- Sınıf çakışması önlendi: `gk-banner` kitin bildirim şeridi; bunlar `gk-standard`.
- Audit: sancak 126 → 0, altın 70 → 0, savaş odası 107 → 3 (kalan: ortak sheet karartması). G7 böylece kapanmaya hazır; 6 dilde telefon ölçümü sırada.

**G7 kapanışı (2026-11-16).** 6 dil, telefon, klan + destek yüzeyleri, 96 ölçüm (`reports/ui-audit/g7-close-6lang-2026-11-15.md`): taşma, kırpılma ve kesilme 0; 12 px altı metin 0; kontrast hatası 0. Klan görünümlerinde kalan 1 "küçük hedef" galeri kabuğunun 2×2 px kökü (oyunda yok). CDP hatası veren tek ölçüm (klan, tr) yeniden alındı: temiz.

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
- **Kur ve aktar artık basılı tutma.** Kitin "harcar" ağırlığı kullanılıyor (`GameHold`, 1 sn). G2-d'deki onarım da aynı ağırlığı kullanıyor. → owner 2026-11-14: aktarma en kısa basılı tutmaya indi (0,6 sn). Bkz. C13.
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

**Almanca hitap birimi ✅ (2026-11-14, yardımcı oturum).** Bütün oyun; G2 notundaki "de 'du'ya inecek" maddesinin işi.

Almanca metin oyuncuya iki türlü hitap ediyordu: yaklaşık 400 metin "du", 380 metin "Sie" diyordu. Bazen aynı ekranda ikisi birden vardı. Savaş raporunda "Senin tarafın" ile "Onların tarafı" aynı sözdü ("Ihre Seite").

- **Karar:** `docs/ux-writing.md` Almanca için bir şey söylemiyor. Çoğunluk "du" olduğu için oyun "du" diyor; Türkçedeki "sen"in karşılığı. Owner 2026-11-14'te onayladı.
- **Kapsam:** 15 Almanca dosyada 317 metin yeniden yazıldı; başka dile dokunulmadı.
  - Komutlar "du" kipinde ("Wähle", "Sende", "Tippe").
  - Tuşlar ve başlıklar mastarla ("Sonde senden", "Modell ansehen", "Angriff planen").
  - Bir clanın tamamına "ihr" ile sesleniliyor ("Baut gemeinsam das erste Schiff").
- **Dokunulan metinlerdeki çeviri hataları:** "Warteschlangenebene 2" → "gib Level 2 in Auftrag", "Hof" → "Werft", "Kostenvoranschlag" → "Schätzung", "abgebrannte Brennelemente" → "verbrauchter Treibstoff", "Schlachtzug" → "Überfall", "Hauptbuch" → "Bilanz". Bunlar makine çevirisi kalıntılarıydı.
- **"Sie" = "onlar" olan metinler:** 69 metin cümle başında "Sie/Ihr" ile "onlar/onların" ya da "o" diyor ("Ihre Flotte ist nicht zu Hause" = onların filosu). Bunlar İngilizce kaynağıyla tek tek okunup testte adıyla listelendi.
- **Test:** `test/german-du.test.ts`.
  - Cümle ortasındaki büyük harfli "Sie/Ihr…" yalnız resmî "siz" olabilir; böyle bir metin testi kırar.
  - Cümle başındakiler yalnız listede adı varsa geçer.
  - Listedeki her metnin hâlâ "sie/ihr" ile başladığı da denetleniyor. Böylece liste eskimez.
  - "Senin tarafın" ile "onların tarafı" artık farklı söz.
- **Denetim:** Her yeni metindeki `{{…}}` yer tutucuları ve `<0>` etiketleri hem eski metinle hem İngilizce kaynakla birebir aynı. Değişmesi istenmeyen hiçbir metin değişmedi; bu, dosyalar okunup karşılaştırılarak doğrulandı.
- **Halka açık sayfa:** Landing'in Almancası zaten "du" diyordu; dokunulmadı.
- **Ekranda görülen bir hata daha:** Sonda raporunda "fleet was out" "Flotte war ausgefallen" (filo arızalandı) diye çevrilmişti; "Flotte war unterwegs" yapıldı. Bu satır karar için önemli: dışarıdaki filo fırsat demek.

Doğrulanamayanlar:
- Almanca bir anadil konuşanı metinleri okumadı. Owner Almanca bilmiyor; yeniden yazımlar İngilizce kaynağa göre yapıldı.
- Ekran görüntüleri yalnız dört yüzeyde çekildi: sonda rafı, radar rafı, savunma raporu, saldırı sheet'i. Metinlerin çoğu kısaldı; uzayanlar tek tek bakılmadı.
- Hitapla ilgisi olmayan makine çevirisi kalıntıları hâlâ var (ör. "Wert der bewaffneten Einheit"). Ayrı bir Almanca okuma işi.

**C13 Kısa basılı tutmalar ✅ (2026-11-14, yardımcı oturum).** Owner kararı: onay penceresinden basılı tutmaya dönen eylemler en kısa ağırlığı kullanır (geri alınabilir ağırlık, 0,6 sn).
- **Döteryum aktarımı (C6):** 1 sn'lik "harcar" ağırlığından 0,6 sn'ye indi. Aktarım geri alınamıyor; kısa süre owner'ın açık kararı. "Geri alınamaz" satırı tuşun üstünde kilit işaretiyle duruyor.
- **Oyuncu engelleme (C4):** zaten 0,6 sn'ydi. Değişmedi; testte sabitlendi.
- **Tamirhanedeki parçalama:** koordinatörün işi, bu birimde dokunulmadı.
- **Testler:** iki tuşun süresi testte ölçülüyor (`--gk-hold-ms` 600 ms). Tuşun görünüşü değişmedi; yalnız dolma süresi kısaldı. Bu yüzden ölçüm (audit) koşulmadı.


**G8 kapanışı (2026-11-16).** 6 dil, telefon; sohbet, Bildirim Merkezi, duyurular, geri bildirim, 137 ölçüm (`reports/ui-audit/g8-close-6lang-b-2026-11-16.md`) ve kural kapısı (`g8-close-6lang-2026-11-16.md`).
- **Kural kapısı kitte:** `CommunityPolicyGate` son v2 boyasını bıraktı. Tek başına durduğunda (sohbetin altı, klan ayarları) kit kuyusu; kurma kuyusunun içindeyse düzleşip o kuyunun son parçası oluyor, kart içinde kart değil. Hata ve güncelleme uyarıları kit notu. Galeride ölçülebilsin diye `clan-pact` görünümü eklendi.
- **Kesilen başlık:** şikâyet sayfasının başlığı es/fr/ja'da kesiliyordu; kısaldı: "Denunciar un abuso", "Signaler un abus", "違反を通報". Yeniden ölçüldü: kalan 4 kesilme yanıtlanan mesajın bilinçli tek satırlık alıntısı.
- Taşma ve kırpılma 0; 12 px altı metin 0. Kalan küçük hedefler C3'te yazılı olanlar (balon ucu, tepki paneli altındaki sekme) ve galeri kabuğunun 2×2 px kökü. Kabul satırı basınca kutuyu işaretliyor; ölçüm aracı çocuk öğedeki tepkiyi görmüyor.

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

**C18 Sezon özeti ve sonraki sezon ✅ (2026-11-15, yardımcı oturum).** G9 #5 ve #6.
- **An:** galaksi dondu; komutanın sezon kaydı ekranı kaplar ("ne yaptım, nerede bitirdim?"), sonra yeni galaksinin ne zaman açılacağını görür ve son galaksiye döner. Unvan, sıra, hikâye seçimi ve ne zaman açıldığı değişmedi.
- **Değişen:** v1'den kite. Tepede arma: kayıtta kupa, kürsüde taç (1. altın, 2–3 gümüş) ve arkasında dönen ışık; açılırken kürsüde `rankup`, değilse onay sesi (bir kez). İki rakam kitin plakasında (sıra; Honor ve altında Hâkimiyet), sayımlar tek camda, hasarlar renkli iki satır, klan kitin amblemi ve "İlk 3 mührü" altın çerçevede, hikâyeler camda. Kapat kitin yuvarlak düğmesi, çıkış tek turuncu `GameButton` (lg). `NextSeason` kitin bilgi şeridi (saat, süre başlıkta, neden altta); galaksi katmanında ve galaksi seçiminde de aynı.
- **Kopya:** sıra plakasının etiketi kısa "Sıra" (`seasonRecap.place` ×6), "50 komutan arasında 41. sıra" altında; `seasonRecap.rankAlone` kullanılmaz oldu, silindi. Çıkış düğmesi iki satıra iniyordu: tr "Son galaksiyi gez", de "Letzte Galaxie ansehen", fr "Voir la galaxie finale", ja "最後の銀河を見る".
- **Ölçüm** (tr; telefon, dar, masaüstü; galeriye `season-recap`, `season-recap-quiet`): puan 45→0, 34→0; 12 px altı 32→0, kontrast 15→0, tepkisiz 2→0. `reports/ui-audit/c18-season-recap-after-2026-11-15.md`.
- **Açık soru:** yok.

**C19 Canlı sıralama, ödül tahtası ve puan göstergesi ✅ (2026-11-15, yardımcı oturum).** G9 #2 (+ C16a'dan kalan `RankingScores`).
- **An:** "Neredeyim, kimi geçebilirim, ne kazanırım?" Sıra, ödül hesabı (eşitlikte paylaşım dahil), aradaki puan ve arama mantığı değişmedi.
- **Değişen:** Honor/Hâkimiyet kitin sekmeleri (ses, titreşim). Kendi sıran ve Honor'un tek camda büyük rakamla, altında "X'e yetişmek için" satırı; sezon ödülü camda (kazanılan / tam paket, resimli); kurallar kapalı "Honor nasıl kazanılır?" satırında. Ödül tahtası kitin etiketiyle (kalan süre yanında), sıra tablosu 44 px'lik defter satırı. Her komutan tek defter satırı (sıra/madalya, dünya, bayrak · dünya adı, ad, puan çubuğu ve puanlar; ödül altında): satır ~200 → ~87 px. Başka komutanın adı dünyasına giden 44 px kapı (önce altı çizili ad); senin satırın yeşil kenarlı ve "SEN". Arama kitin cam alanı. `RankingScores` kitte: Honor gövde boyunda, Hâkimiyet 12 px tabanda (önce 10 px). Önceki sezon makbuzu kitin camında.
- **Kaldırılan:** `Segmented`, v1/v2 sınıfları, satır adının iki satır kırpması.
- **Ölçüm** (tr; telefon, dar, masaüstü; galeriye `leaderboard-honor`): puan 287→0 (Honor), 81→0 (Hâkimiyet); 12 px altı 155→0, kontrast 9→0, 44 px altı 30→0, tepkisiz 30→0, kesilen 32→0. Honor ekranında kelime/ekran 104→127 (satırlar sıklaştı, daha çok komutan sığıyor). `reports/ui-audit/c19-leaderboard-after-2026-11-15.md`.
- **Kalan:** `HonorBenefitsSection` (Honor kademesi kartı, galeri verisinde yok) hâlâ v2; arşiv tarafıyla (C20) birlikte bakılacak.

**C20 Sezon arşivi: sezon şeridi, biten sezonun sıralaması, galaksi kaydı ✅ (2026-11-15, yardımcı oturum).** G9 #1 ve #3.
- **An:** "Geçen sezon kim kazandı, ben neredeydim, kimin karnesine bakayım?" Hangi sezonların listelendiği, sağa kaydırınca eskilerin gelmesi, Honor/Hâkimiyet sırası, arama ve açılan karne değişmedi.
- **Değişen:** Sezon şeridi kitin çipleri (ses ve titreşimi çip veriyor; ekranın kendi `haptic` çağrısı silindi, çift titreşim yok). Başlık kitin etiketi (komutan sayısı yanında). Galaksi Kaydı kitin camında; kısa bilgiler (şampiyon altın, klan podyumu) telefonda yan yana, cümleler tam satır (tek sütuna göre ~355 → ~305 px). Arama kitin cam alanı, listenin hemen üstünde ve yapışkan. Her komutan C19'un defter satırı; satırın tamamı karneye giden kapı (`useOwnPress`, ses, titreşim); senin satırın yeşil kenarlı.
- **Kaldırılan:** `v2-segmented`, `plate`/`legend`/`name`/`num` ve v2 renk sınıfları, sigilin madalya halkası (madalya zaten sırada).
- **Ölçüm** (tr; telefon, dar, masaüstü; galeri `leaderboard-archive` görünümüne galaksi kaydı eklendi): puan 56→0; 12 px altı 35/74→0, kontrast 2→0, 44 px altı 2→0, tepkisiz 11→0, kesilen 7→0. `reports/ui-audit/c20-season-archive-after-2026-11-15.md`.
- **Kalan:** arşivdeki komutan karnesi (C21); `HonorBenefitsSection` hâlâ v2 (canlı sıralamada, galeri verisinde yok).

**C21 Arşivde komutan karnesi ve kariyer ✅ (2026-11-15, yardımcı oturum).** G9 #4.
- **An:** "Bu komutan o sezon ne yaptı, herkese göre nasıldı, kariyeri ne?" Karşılaştırmalar (oranlar, ortalamalar, çubuk ölçeği), eski sezon/eksik kayıt/erken bitiş ayrımı ve sezonlar arası geçiş değişmedi.
- **Değişen:** Baş, sezon sonu ekranıyla (C18) aynı an: ışıklı zemin, dünyanın üstünde madalya (kürsüde dönen ışık), ad büyük, "İlk %1" satırı, sıra ve Hâkimiyet/Honor kitin plakalarında. Görünümler kitin sekmeleri; geri dönüş kitin düğmesi. Her rakam kitin camında tek kart (ikon, ad, rakam, "×2,6 kat", iki çubuk, "Diğerleri"); ad artık kesilmiyor ("Sefer başına as…" gitti). Bildirimler (erken bitiş, eksik kayıt, eski sezon) kitin şeridi. Kariyer rafı tek camda beş rakam; toplamlar kitin defter tablosu; sezonlar C19/C20'nin kapı satırı. Bölüm başlarındaki v2 ikonları yerine kitin glifleri.
- **Kaldırılan:** `Segmented`, `Section`, `Stat`, `ArtWell`, v2 ikonları, `MEDAL`/`medalOf` (Tailwind halka/gölge tablosu) ve bütün v1/v2 sınıfları.
- **Ölçüm** (tr; telefon, dar, masaüstü; galeriye `leaderboard-archive-profile` ve `-career` eklendi, ui-audit'e satıra basıp sekmeye geçen iki adım; envanterdeki "komutan profili (arşiv)" artık ulaşılıyor): puan 141→0 (sezon), 65→0 (kariyer); 12 px altı 113/161→0 ve 34/72→0, kontrast 12→0, 44 px altı 4→0, tepkisiz 9→0, kesilen 2→0. Sezon sayfası 3290→3192 px (içerik aynı). `reports/ui-audit/c21-commander-record-after-2026-11-15.md`.
- **Kalan:** yok.

**C22 Anıt sayfası ve tutmaları ✅ (2026-11-15, yardımcı oturum).** G9 #7.
- **An:** "Bu anıtta ne var, oraya ne gönderirim, ne öderim, ne kaybederim?" Fiyat sorusu, iki onay, sunucuya giden istek ve kimlik anahtarları değişmedi.
- **Değişen:** Sayfa kitin çerçevesinde (rakibin anıtı kırmızı, senin anıtın yeşil kenarlı). Anıtın bilgileri kitin camında; karar rakamları (hacim, üretim, radyasyon) 13 px kalın, ikincil satırlar etiket boyunda. Gemi seçimi kitin defter satırları ve kitin sayacı. Fiyat camı: yakıt, varış, doz; kurallar ince notta; iki onay kitin şalteri. Dalga kartı, sonda ve sonda raporu kitin camında (rapor gemileri resimli). Klan hedefi kitin düğmesi; yaklaşan saldırı kitin şeridi.
- **Tutmalar:** gönder `GameHold` lg, harcar (1 sn); sonda md, harcar (1 sn); geri çağır md, geri alınabilir (0,6 sn). Eski v2 `HoldButton`, `Plate`, `Button`, `Toggle` kalktı.
- **Ölçüm** (tr; telefon, dar, masaüstü; galeriye `monument-sheet` ve `monument-sheet-quote`, ui-audit'e sayaç dolduran adım; envanterdeki "dalga beklemede" artık ulaşılıyor): puan 114→3, 142→3; 12 px altı 49/74→0 ve 64/95→0, kontrast 14→0, 44 px altı 36→2, tepkisiz 29→2. Kalan 3: sayfa arkalığının 2×2 kapatma alanı (G1). Sayfa uzadı (1561→2161 px): 10 px metinler 12–13 px'e çıktı.
- **Kalan:** kitin sayacında devre dışı "−" ikonu 2,4:1 (G2-f'nin parçası); çocuk parçalar (`TargetRadiationInstrument`, `EscortRow`, `MonumentRoutePreview`) kendi birimlerinde.


**G9-a Onur ayrıcalıkları ✅ (2026-11-16).** G9 #2'nin son v2 parçası (`ui/HonorBenefits.tsx`) ve onarım, ticaret, konvoy sayfalarındaki Onur fiyat kutusu.
- **An:** "Onurum bana ne kazandırıyor, bir sonraki kademeye ne kadar var?" Kurallar ve oranlar değişmedi.
- Bölüm kit kuyusu: kademenin kendi rozeti (hazır `HonorBadge` sanatı), adı kendi renginde; üç etki kit rakamı, her biri bana ne yaptığının renginde (ucuz onarım ve büyük konvoy yeşil, komisyon kırmızı; eskiden üçü de kademenin rengindeydi).
- Yeni satır: "Sonraki kademeye 45,9 Honor: Avantaj kademesi 2"; kesinti kademesinde "Honor -25 üstüne çık: Nötr". En üst kademede yok. 6 dilde yeni iki anahtar.
- Tüm kademeler kitin kural satırında, bir dokunuş uzakta: her basamak rozet + ad + aralık, altında üç değer; sütun başlıkları en üstte (önce hangi yüzdenin ne olduğu yazmıyordu). Şu anki basamak işaretli.
- Fiyat kutusu kit makbuzu: başlık etkinin renginde, sütunları adlı gerçek tablo; bir şey seçilmeden boş tablo çizilmiyor (kural metni duruyor).
- Kitin gemi satırı: uzun ad (Wayfarer) 320 px'te sayacın altına kayıyordu; artık ikinci satıra iniyor.
- Galeri: Onur sıralaması ve ticaret sayfası örnek Onur verisi taşıyor. Audit (tr; telefon, dar, masaüstü): sıralama 0, ticaret 3 (galeri kabuğu).


**G9 kapanışı (2026-11-16).** 6 dil, telefon; sıralama ve arşiv, sezon özeti, anıt, ticaret, 60 ölçüm (`reports/ui-audit/g9-close-6lang-2026-11-16.md`): taşma, kırpılma ve kesilme 0; 12 px altı metin 0.
- **Sıralama kitin kökünde değildi:** sayfa `gk` sınıfı olmadan açılıyordu; gövde yazısı tarayıcının yazı tipine düşüyordu. Artık kitin yazısı.
- **Onur ödülü satırı:** rapor ganimetinin `gk-haul__row` sınıfını ödünç alıyordu; o sınıf sonradan üç sütunlu ızgaraya dönüşünce "820 / 1.750" bir sonraki resmin üstüne biniyordu (sıra satırlarındaki küçük ödül de aynı sınıfı kullanıyordu). İkisi de kendi `gk-lb__purse` satırında.
- Kalan: anıt sayfasında en'de bir satır 1.97:1 ölçüldü; ekranda koyu zeminde okunuyor, tr'de geçiyor (ölçüm alttaki tutma çubuğunun gölgesine denk geldi).

**Sayfa başlıkları kitte (2026-11-16, kesişen).** Menü, sıralama, araştırma, kozmetik mağaza, envanter ve Wiki sayfaları kitin içeriğiyle ama eski düz v2 başlığıyla açılıyordu. Hepsi kitin başlık plakasında (sıralama ve araştırma kendi sanatıyla; menüde sanat yok, hemen altındaki komutan kartı madalyonu taşıyor). `test/sheet-heads.test.ts` galaksideki her sayfanın kit başlığı taşıdığını denetliyor; sırası gelmemiş üçü (G12 arena, G14 yönetim, G15 gemi) listede, liste yalnız küçülür. Görselli başlıkta üst yazı ("Yerel galaksi") gün batımı resmi üstünde 3.1:1 kalıyordu; birinci mürekkep ve gölge.

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

**C23 Profil sayfası ve komutan kartı ✅ (2026-11-15, yardımcı oturum).** G10 #1 ve #2.
- **An:** "Ben kimim, nerede duruyorum, hesabımla ne yapabilirim?" Gösterilen bilgiler, hesap kuralları ve açılan sayfalar değişmedi.
- **Değişen:** Sayfa kitin sheet'i. Komutan kartı kitin kesik plakası: gözlem odası arkada, üst çubuğun madalyonu büyük, ad görüntü harfiyle, klan etiketi metal rengini koruyor; Honor/Hâkimiyet şeridi; sıra, dünyalar, kalkan camda üç hücre (simge üstte; kalkan sürerken yeşil). Miras kapısı altın kenarlı plaka (yazı solda, sahnenin karanlık yanında). Galaksi ve sezon kitin iki sahne kartı. Tatil, kurtarma e-postası ve ülke kitin yeni **kapı satırı** (`DoorRow`): işaret, ad, durum, ok; e-posta yoksa sarı (kapatılabilir eksik), doğrulanmışsa yeşil. Yasal bağlantılar 44 px. Çıkış kitin düğmesi; **hesap silme en altta**, kırmızı kenarlı kapı.
- **Kaldırılan:** v2 `Button`/`Section`/`Note`/`Icon`, `.menu-account-scene` ve `.legacy-entry` CSS'i (kullanıcısı kalmadı), güvenlik girişindeki `ChevronIcon`.
- **Galeri:** `profile` (yeni `ProfileGallery.tsx`).
- **Ölçüm** (tr; telefon, dar, masaüstü): puan 78→3; 12 px altı 32/47→0, kontrast 9→0, 44 px altı 5→1, tepkisiz 9→1. Kalan 3: sayfa arkalığının 2×2 kapatma alanı (G1). `reports/ui-audit/c23-profile-after-2026-11-15.md`.

**C24 Tatil ✅ (2026-11-15, yardımcı oturum).** G10 #5.
- **An:** "Bir süre yokum: çıkabilir miyim, kaç gün, bana neye mal olur, ne engelliyor?" Kurallar, fiyat, engel listesi, istek kimliği (aynı teklif = aynı istek) değişmedi.
- **Değişen:** Sayfa kitin sheet'i. Kapsam kitin yeşil şeridi. Engeller sarı kenarlı camda, her biri ayrı satır. Gün seçimi kitin çipleri (tavan üstü günler sönük). Her dünya satırı ad, tür, kuralın rakamları ve döteryum resmiyle ücret. Toplam camında büyük rakam ve **harcama çubuğu** (`SpendBar`): toplam / kullanılabilir döteryum, yetmezse kırmızı. Formül kitin "?" açıklamasında.
- **Tutmalar:** tatile çıkış döteryum harcar → `GameHold` 1 sn (eskiden tek basış), yanında ücret; çıkamıyorsa tutma sebebini söyler (kontrol ediliyor / engeller / gönderiliyor). Erken dönüş eski onay penceresiydi → 0,6 sn tutma; "koruma hemen kalkar, ücret iade edilmez" tutmanın üstünde yazılı. `Confirm` kalktı; boşa düşen `vacation.endConfirm` ve `vacation.back` 6 dilden silindi.
- **Galeri:** `vacation`, `vacation-blocked`, `vacation-active`.
- **Ölçüm** (tr; telefon, dar, masaüstü): puan 49→3, 49→3, 7→0; 12 px altı 23–26→0, kontrast 5→0, tepkisiz 6–7→1. Kalan 3: sayfa arkalığı (G1). `reports/ui-audit/c24-vacation-after-2026-11-15.md`.

**C25 Hesap güvenliği, şifre sıfırlama, hesap silme ✅ (2026-11-15, yardımcı oturum).** G10 #6 (şifre sıfırlama G13 ön kapıda açılır).
- **An:** "Şifremi unutursam hesabım geri gelir mi?" ve "Hesabımı silersem ne gider, ne zaman, gerçekten istiyor muyum?" Sunucu adımları, kod süresi, yeniden gönderme beklemesi, oturumun kapanması ve silmenin ek adımları değişmedi.
- **Değişen:** Üç sayfa kitin sheet'i (silme kırmızı kenarlı). Açıklamalar kitin şeritleri (e-posta yoksa bilgi, geçiş uyarısı sarı, hata kırmızı ve `alert`). Alanlar kitin cam yuvası; kod büyük ve aralıklı; parola yanında kitin göz düğmesi (açıkken yanar). Kodun gittiği posta kutusu ve talep numarası camda. Düğmeler kitin; ölü düğme sebebini söylüyor ("6 haneli kodu yaz", "44 saniye sonra…").
- **Hesap silme:** parola ve "anlıyorum" (artık kitin şalteri) korunuyor; talep **1,5 sn kırmızı final tutma**; eksik adımı tutmanın yüzü söylüyor ("Önce mevcut parolanı yaz" / "Önce anladığını onayla"). Enter artık silme göndermiyor (form yok).
- **Kit:** `GameButton submit` (formun gönder düğmesi; alanda Enter basışla aynı işi yapar). Yeni metinler 6 dilde: `accountSecurity.codeNeeded`, `accountDeletion.needPassword`, `accountDeletion.needConfirm`. Kullanıcısı kalmayan `securityInputClass` silindi.
- **Galeri:** `account-security`, `account-security-code`, `account-deletion`, `account-deletion-sent`, `password-reset`.
- **Ölçüm** (tr; telefon, dar, masaüstü): güvenlik 13→0, kod adımı 20→0, silme 20→0, talep alındı 12→0, şifre sıfırlama 7→0; 12 px altı 7–9→0, 44 px altı 1–3→0, tepkisiz 2–6→0. `reports/ui-audit/c25-account-after-2026-11-15.md`.

**C26 Ülke seçici ✅ (2026-11-15, yardımcı oturum).** G10 #4 (kayıttaki `ClaimDialog` de aynı seçiciyi açıyor).
- **An:** "Hangi bayrağı taşıyorum?" Seçim yalnız onayla gönderiliyor; arama (Türkçe i/ı katlaması) ve seçilenin listenin başında durması değişmedi.
- **Değişen:** Seçici kitin cıvatalı plakası; başta seçilen ülke bayrağıyla büyük; arama kitin cam yuvası; liste camda, her satır 44 px (önce 40), seçilen yeşil yanıyor ve tik taşıyor; kapatma kitin yuvarlak düğmesi, onay kitin ana düğmesi. Satır basışı `useOwnPress` + ses + titreşim. `Flag`'in bayraksız yedeği kit sınıfında (`gk-flagcode`).
- **Ölçüm** (tr; telefon, dar, masaüstü): puan 2005→1; 12 px altı 501→0, kontrast 250→0, 44 px altı 251→0, tepkisiz 252→1 (arkalık). `reports/ui-audit/c26-country-after-2026-11-15.md`.

**C27 Komutan Mirası profili ✅ (2026-11-15, yardımcı oturum).** G10 #3: `LegacyProfile`, `ShowcaseEditor`, `ShowcaseShelf`, `AwardTile`, `LegacyProfileSheet`.
- **An:** "Ne kazandım, kime ne gösteriyorum?" Vitrin, sezon geçmişi, koleksiyon ve sıradaki hedefler; kurallar ve veri değişmedi.
- **Değişen:** Sayfa kitin sacı (kupa resimli başlık). Komutan plakası hesap sayfasındaki gibi (C23): madalyon, bayrak, altın unvan rozeti, dört ömür değeri camda (ikonlu, büyük harfsiz ki "En iyi Hâkimiyet" sığsın). `Segmented` → `GameTabs`; bölüm başlıkları `SectionTag`; sezonlar resimli kesik plaka, dereceler madalyayla, sayılar camda, parçalar 48 px; filtre kit çipleri; koleksiyon/hedef kutuları kitin ilerleme çubuğuyla. Vitrini düzenle ölü iken nedenini söylüyor ("Koleksiyon açılıyor…"). Düzenleyici: sayaç altın, uyarılar banner, "Hepsini kaldır" yalnız seçim varken, kaydet kitin ana düğmesi. Raftaki boş kaide 44 px altın halka (önce 32), isim levhaları 12 px (önce 9), basışta levha iniyor. Her basış `useOwnPress` + ses + titreşim.
- **Düzeltme:** `.gk-cmdr` resmi kesik plakanın yüzünün altında kalıyordu (z −2); artık görünüyor — C23 komutan kartında da.
- **Kalan:** Sayfa başlığındaki göz-çizgisi/başlık kırpılması kit sacının başlığı (G1); `LegacyPeek` (küçük vitrin) v2'de, bu birimin dışında.
- **Ölçüm** (tr; telefon, dar, masaüstü): profil 145→6 (arkalık ve sac başlığı), raf 14→0; 12 px altı 57→0, kesilen 7→1. `reports/ui-audit/c27-legacy-after-2026-11-15.md`.

**C28 Sessiz Uzay bildirimi ✅ (2026-11-15, yardımcı oturum).** G10 #6 `shell/SilentSpaceNotice` (v1 → kit).
- **An:** "30 saattir emir vermedim — neredeyim, ne kapalı, eve nasıl dönerim?" Kural (D212), bir kez gösterme, menüden açma, odak tuzağı, Escape ve telefonun Geri tuşu değişmedi.
- **Değişen:** Kitin pencere (`Dialog`) kurdelesi başlık; altında Sessiz Uzay'ın galaksi sahnesi; kapalı olanlar kilit, yarı hızdaki üretim saat işaretiyle; dönüş cümlesi kalın; sıradaki başvuru camda (sıra numarası durum olarak okunuyor); hata banner; başvur kitin ana düğmesi (dönüş ikonu, bekleme dönüşü), "Oynamaya devam et" hayalet düğme. Basışlar `useOwnPress` + ses + titreşim.
- **Kit:** `Dialog` artık `onBack` alıyor: verilirse telefonun Geri tuşu pencereyi kapatıyor (`useNativeBack`); verilmezse dokunmuyor. Testi `test/game-ui/dialog-back.test.tsx`.
- **Galeri:** `silent-space`, `silent-space-queued` (ve C29 için `servers`) `ProfileGallery`'de; envanterde erişim olarak eklendi.
- **Ölçüm** (tr; telefon, dar, masaüstü): puan 7→0 (ilk bildirim), 10→0 (sırada); 12 px altı 4–5→0, kontrast 1→0. `reports/ui-audit/c28-silent-after-2026-11-15.md`.

**C29 Galaksi seçimi ✅ (2026-11-15, yardımcı oturum).** G10 #7 `screens/ServersScreen` (v1 → kit).
- **An:** "Hangi galaksiye giriyorum?" Sıralı dolum kuralı, tek katılım, son sezon sonucunun açılışı ve "yeni galaksi açılıyor" sayacı değişmedi.
- **Değişen:** Ekran kitin karanlığında; komutan adı görüntü yazısıyla, çıkış hayalet düğme. Her galaksi kesik plaka: ad + kod, koltuklar kitin çubuğunda (dolu ise alaşım rengi) ve sayıyla, çevrimiçi sayısı yeşil; açık kapı yeşil kenarlı, "Katıl" kitin ana düğmesi (roket), basılınca beklemeye geçiyor ve ikinci basışı yutuyor. Kilitli galaksi soluk değil, yalnız adı geri çekiliyor (kontrast). Son sezon sonucu altın kapı satırı (`DoorRow`). Hatalar banner (ulaşılamıyor artık `alert`), yeniden dene düğmesi. Hesap güvenliği ve silme ekranın sonunda (önce galaksilerin üstündeydi): ekranın işi galaksi seçmek.
- **Test düzeltmesi:** `account-deletion-ui` sahte `/servers` yanıtı şemaya uymuyordu (`placement` yoktu); ekran bu testte hep "ulaşılamıyor" gösteriyormuş. Yanıta `placement: null` eklendi.
- **Ölçüm** (tr; telefon, dar, masaüstü): puan 43→0; 12 px altı 15→0, kontrast 8→0, 44 px altı 2→0. `reports/ui-audit/c29-servers-after-2026-11-15.md`.

**G10 altı dil ölçümü (2026-11-15, telefon; tr, en, fr, de, es, ja).** `reports/ui-audit/g10-langs-2026-11-15.md`.
- Raftaki uzun ödül adları (fr "Vice-champion de Domination", es "Guardián de monumentos IV") iki satıra sığmıyordu: levha artık üç satır alıyor. İngilizcede sezon kartının "Season ends in" etiketi resmin aydınlık yerine düşüp 3,5:1'e iniyordu: kartın perdesi sağ kenarda %60'a çıktı. İkisi de yeniden ölçüldü, 0.
- Kalan: kit sacının başlığında göz-çizgisi ve başlık birkaç piksel kırpılıyor (bütün dillerde, G1 sac başlığı); "Season ends in" üç kelimelik büyük harf etiket (T2, yalnız en; metin menüde de kullanılıyor, kısaltılmadı). `LegacyPeek` (61), ödül sayfası (27) ve açılış sahnesi (14) bu partinin dışında, v2'de.

**C30 Sac başlığındaki kırpılma ✅ (2026-11-15, yardımcı oturum).** G10 açık maddesi 1.
- **Kök neden:** Kitin sac başlığı değil, galerinin çerçevesi. `LegacyGallery` sahneyi galeri çubuğunun altından başlayan `relative h-dvh overflow-hidden` bir kutuya koyuyordu; sabit konumlu sac o kutunun üstüne taşınca başlığın üst pikselleri kutunun dışında kalıp "kırpılan" sayılıyordu. Gerçek oyunda sac böyle bir kutunun içinde değil.
- **Değişen:** Galeri çerçevesi ekranın tamamı (`fixed inset-0`), oyundaki galaksi gibi. Ürün kodu değişmedi; göz-çizgisinin iki satıra inmesi master'da zaten vardı.
- **Not:** `FleetTowingGallery` ve `CommanderPresenceGallery` aynı çerçeveyi kullanıyor; ölçümlerinde sac varsa aynı sahte kırpılma çıkar.
- **Ölçüm** (legacy-profile; 6 dil, telefon ve dar): kırpılan 10→0. `reports/ui-audit/c30-sheet-head-after-2026-11-15.md`.

**C31 Küçük vitrin (`LegacyPeek`) ✅ (2026-11-15, yardımcı oturum).** G10 açık maddesi 2.
- **An:** Haritada bir isme dokunan oyuncu "bu kim?" diye bakıyor: unvan, raftaki altı parça, en iyi dereceler, son iki sezon, sonra tüm miras. Okunan veri ve akış değişmedi.
- **Değişen:** Kitin kart sacı (kupa resimli başlık). Unvan altın rozet (profille aynı), sayaç kalın; raf pirinç rafta kaldı, parça adları 12 px (önce 9), adı nadirlik renginde, sezon etiketi altında; en iyi dereceler camda madalyalı; son sezonlar camda satır satır; "Tüm mirası gör" kitin ana düğmesi. Parça basışı `useOwnPress` + ses + titreşim.
- **Ortak:** `PodiumPlace` artık tek kit derecesi (profildeki sezon kartları da onu kullanıyor; kopya `SeasonPlace` silindi). Derece etiketleri büyük harfsiz, "En iyi Hâkimiyet" madalyanın yanına sığsın diye.
- **Ölçüm** (tr; telefon, dar, masaüstü): küçük vitrin 61→1 (arkalık), profil 6→3; 12 px altı 27→0, kontrast 8→0. `reports/ui-audit/c31-legacy-peek-after-2026-11-15.md`.

**C32 Ödül sayfası ✅ (2026-11-15, yardımcı oturum).** G10 açık maddesi 3: `AwardSheet`, `LockedAwardSheet`, `AwardStage` çerçevesi.
- **An:** "Bu parça ne, ne zaman kazandım, kaç kişide var, nasıl kazanılır; vitrine mi koyayım, unvan mı yapayım?" Kurallar ve istekler değişmedi.
- **Değişen:** Kitin sacı (kupa; kilitli hedefte kilit resmi). Nadirlik, sezon ve kademe kit etiketleri; aktif unvan altın rozet; bilgiler camda satır satır, sahip sayısı altın; "Nasıl kazanılır" camda, sıradaki kademe kitin çubuğunda. Vitrin ve unvan kitin düğmeleri; vitrin doluyken düğme kilit ikonuyla "Vitrin dolu" diyor (yeni kısa anahtar `legacy.award.shelfFullShort`, 6 dil), uzun açıklama altında. Hatalar banner, yeniden dene banner'ın içinde. Sahne çerçevesi kitin metali (`gk-stage`).
- **Ölçüm** (tr; telefon, dar, masaüstü): 27→3 (arkalık); 12 px altı 12→0, kontrast 3→0. `reports/ui-audit/c32-legacy-award-after-2026-11-15.md`.

**C33 Ödül açılış sahnesi ✅ (2026-11-15, yardımcı oturum).** G10 açık maddesi 4: `AwardReveal`.
- **An:** "Bir parça kazandım!" Karanlık oda, ışık çekirdeği, parlama, kıvılcımlar ve 3D parçanın yükselişi aynen kaldı (`legacy.css`); sıra, görüldü işareti, Escape, odak ve dokununca girişi bitirme değişmedi.
- **Değişen:** Yazılar kitin: sayaç kalın, göz-çizgisi kitin etiketi, ad görüntü yazısıyla 24 px, nadirlik/sezon/kategori ödül sayfasıyla aynı etiketler, kazanma kuralı 14 px. Sonraki / kalanları aç / kapat kitin ana düğmesi (ikonlu), vitrine koy kitin düğmesi; vitrinde ise altın tikli satır. Toplu açılışta parça adları 13 px.
- **Ölçüm** (tr; telefon, dar, masaüstü): 14→0; 12 px altı 8→0. `reports/ui-audit/c33-legacy-reveal-after-2026-11-15.md`.
- **Grup sonu, 6 dil (telefon; profil, küçük vitrin, ödül, açılış):** kesilme ve kırpılma 0. Kalan tek not: üç kelimelik büyük harf göz-çizgileri ("Yeni parça kazandın", "How to earn it") — kutlamanın bilinçli görünüşü, dokunulmadı. `reports/ui-audit/g10b-langs-2026-11-15.md`.

## G11. Wiki, Akademi, simülatör

Okundu: dosya haritası ve dil sayımı. Ayrıntılı okuma grubun sırası gelince.

| # | Yüzey | Dosya (satır) | Dil | Not |
|---|---|---|---|---|
| 1 | Wiki | `screens/WikiScreen` (54) + `wiki/WikiContent.tsx` (112) + içerik dosyaları (`wiki/*.ts`) | kendi `wiki-*` CSS'i | **Dördüncü dil.** Owner: oyuncular Wiki'yi açmıyor; kural yalnız orada ise anlatılmamış sayılır. Bot ifadesi yasağı burada da geçerli. |
| 2 | Akademi menüsü | `MenuPanel` › Akademi | v2 | G1'de |
| 3 | Savaş simülatörü | `battle-simulator/BattleSimulator` (141), `SimulatorDialog` (37), `SideEditor` (94), `UnitInspector` (48), `SimulationNumberInput` (25), `BattleBalance`, `RetreatRoster`, 3D `BattleStage` | kendi `simulator.css`'i (`sim-*`) | **Beşinci dil.** Tam ekran (`?simulator=1`), menü karosu, rapordan "dene". |


**G11-a Oyun içi Wiki ✅ (2026-11-16).** G11 #1, yalnız oyun içindeki oda (`WikiScreen`); yayınlanan Wiki (G13) değişmedi.
- **An:** "Aradığım kural nerede, bulup oyuna döneyim." İçerik ve arama aynı.
- Sayfa kitin başlığıyla açılıyor (önce başlık gizliydi, içeride "ASTERA / WIKI" ve dev bir "Astera Online Wiki" web başlığı vardı). Odada tekrar yok; karşılama başlığı yalnız okuyucuya.
- Araç satırı tek satır ve yapışkan: kit geri tuşu (yüzünde gidilecek yer, okuyucuya "Geri dön: …"), dil seçimi kitin seçenekleri (Türkçe büyük harf kuralı "ENGLİSH" yazmasın diye büyük harf yok). Arama kit alanı.
- İçerik yalnız `.gk.wiki-room` kapsamında giyiniyor: kitin yazısı; konu menüsü kitin kural satırı; karşılama kompakt kuyu, "İlk adımların" kitin eylem rengi; kategoriler kit kapıları; tablolar, rakamlar ve notlar kit camında; dış bağlantı kit çipi. Basılı hâller eklendi.
- Audit (tr; telefon, dar, masaüstü): 45 → 10. 12 px altı metin 10 → 0; tepkisiz hedef 23 → 4. Kalan: galeri kabuğu ve arama alanında ölçüm aracının 2 px'lik kenar kaydı.


**G11-b1 Savaş sahnesi: tekrar ve simülatörün ortak kontrolleri ✅ (2026-11-16).** G11 #3'ün sahne kısmı (`BattleReplay`, `simulator.css`); oyun içi savaş tekrarı ile simülatör aynı sahneyi kullanıyor.
- **An:** "Savaş nasıl gitti, hangi atış ne yaptı?" Oynat, adım adım ilerle, tura atla, özet ve atış dökümü.
- Sahnenin kendi paleti kitin belirteçlerine bağlandı (kendi taraf, düşman, metal, cam); yazı kitin yazısı.
- 12 px tabanı: 9–11 px'lik bütün yazılar (en küçüğü 5 px'lik "ONLINE") 12 px'e; telefonda markanın alt satırı kalktı. Büyüyen durum satırı ve Aegis satırı artık kesilmiyor, alta iniyor.
- Dokunma: oynat 48 px kitin yuvarlak ışıklı tuşu; önceki/sonraki, hız, genel görünüm, sekmeler, sayfa kapatma, döküm satırları 44 px; tur işaretleri 30 px; kaydırıcının tutamağı büyüdü. Her basışın basılı hâli var.
- Alandaki taraf işaretleri (◆/▲) yazı değil şekil: kendi tarafın elması, düşmanın üçgeni, kitin renklerinde.
- 320 px'te iki tarafın sayıları ortada çakışıyordu; göz simgesi çekiliyor, boşluklar daralıyor.
- **Hata:** atış dökümünün tur satırı savaşın sınırını sayıyordu ("Tur 1 / 8"), üstteki durum satırı yapılan turu ("Tur 1 / 4"). Artık ikisi de yapılan tur (test).
- Audit (tr, simülatör sayfası; telefon): 151 → 28; 12 px altı 56 → 0, kontrast 11 → 0, tepkisiz 20 → 4. Kalan küçük hedefler simülatörün başlığı ve araç çubuğu (G11-b2). Masaüstündeki kontrast kayıtları açık düzenleyicinin sayı alanları (G11-b2).


**G11-b2 Simülatörün sayfası ve filo düzenleyicisi ✅ (2026-11-16).** G11 #3'ün kalanı (`BattleSimulator`, `SideEditor`).
- **An:** "Bu gemileri göndersem ne olur?" Filoları kur, savaşı çalıştır, izle.
- Araç çubuğunda yalnız filo düğmesi (kurduğu savaşın sayılarıyla) ve tek ışıklı tuş: "Savaşı simüle et" kitin eylem tuşu (ayar değişince nabız atar). Eskiden üç öğe sığmıyor, tuş ince bir şeride eziliyordu.
- Savaş alanı (Gezegen/Uzay) bir senaryo ayarı: düzenleyicinin başında kitin seçenekleri; örnek savaşlar yerli açılır listeden iki sütunlu kit seçeneklerine. Elle düzenlenince hiçbiri seçili değil (özel senaryo). "EMP / savunma kapalı" ve "otomatik geri çekilme" kitin şalteri.
- Düzenleyicide her sayaç, sayı alanı, seçici, katlama ve tuş 44 px; yazılar 14–16 px.
- **Kök neden:** simülatörün genel `.simulator button` kuralı kitin tuşlarını eziyordu (renk, zemin, kenar). Artık `:where(:not([class*="gk-"]))` ile yalnız sahnenin düz tuşlarına uygulanıyor; özgüllük eskisi gibi düşük, özel kurallar bozulmadı.
- Sahne üstündeki gemi sayıları koyu plakada (parlak gezegen üstünde 1.7:1 kalıyordu).
- Kalan bilinçli: araştırma seviyesi (0–20) ve korsan seviyesi kit görünümlü seçici olarak kaldı (uzun liste).
- Audit (tr; telefon): 151 (G11-b1 öncesi) → 15. Kalan: kaydırıcı ile tur işaretleri birlikte 58 px'lik tek kontrol; masaüstündeki kontrast kayıtları sahne üstü plakalarda, ölçüm arkadaki gemi resmini örnekliyor.


**G11 kapanışı ✅ (2026-11-16).** Altı dilde telefon audit'i (oyun içi Wiki galeriden, simülatör herkese açık sayfasından ayrı koşu).
- Taşma, kesilme, yana taşma: altı dilde 0. 12 px altı metin: 0.
- Wiki: puan tr 8 / en 6. Kalan: arama alanının kenar kaydı (2 px ölçüm, alanın kendisi 46 px) ve iki kapak bağlantısı.
- Simülatör: puan tr 15 / en 10. Kalan: kaydırıcı ile tur işaretleri (tek kontrol), gezegen üstündeki hasar rozeti 4.41:1 (koyu plakada okunuyor).
- Almanca ("KAMPF SIMULIEREN") ve Japonca eylem tuşu tek satıra sığıyor; Wiki içeriği bilinçli olarak yalnız en/tr sürümünde.
- Raporlar: `reports/ui-audit/g11close-wiki-2026-11-16.md`, `reports/ui-audit/g11close-sim-2026-11-16.md`.

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


**G12 bölümleme (2026-11-16).** a: takım paneli + taktik seçici · b: uçuş öncesi ekran (sınıf, kip, başlat) · c: yükleme, sonuç, menü, izleyici · d: hangar + Komutan gemisi sayfa başı · e: uçuş HUD'u (gerçek zamanlı; başparmak alanı ve hareket halinde okuma ayrıca).
- Ölçüm önkoşulu: audit'in galeri sürücüsü hangarı ve takımı arena sunucusu olmadan ölçüyordu (ekranda yalnız "alınamadı" satırı). Sürücüye görünüm başına sabit yanıtlar eklendi (`GALLERY_ANSWERS`, araçların fotoğrafladığı aynı veri); klan sayfasındaki takım için `clan-arena` görünümü.
- Önce (tr, telefon puanı): takım 220, hangar 116, uçuş öncesi 126, maç 77.

**G12-a Takım paneli ve taktik seçici ✅ (2026-11-16).** `TeamPanel`, `TacticPicker`. Klan sayfası (hazırlan), hangar (ganimet payı) ve uçuş masası (lobi) aynı paneli kullanıyor.
- **An:** "Kim benimle uçuyor, kalkabilir miyiz?"
- Kök neden (galeri): taktik seçicinin stili yalnız uçuş ekranının `arena.css`'indeydi; o dosya yüklenmeden ikonlar ekran boyu siyah şekiller oldu. Seçici artık kitin kendi parçası (`gk-tactics`), her yerde aynı.
- Ekip kitin ekip listesinde: hazır lambası, "Sen" ve durum çipi (Hazır / Hazırlanıyor / tamir uyarısı), sınıf · seviye · yakıt; lider için her satırda kısa "Çıkar" (okuyucu kimi çıkardığını duyar).
- Her basış kit basışı ve neden basılamadığını söylüyor: "Birlikte kalk" herkes hazır olana dek "Herkes hazır olunca açılır"; tamirdeki gemi için "Hazırım" yerine "Tamir veya bakım bitmedi".
- Taktik seçenekleri hangi yuvada olduklarını E/C rozetiyle gösteriyor (önce yalnız etkin yuvanınki belliydi).
- Ganimet kuralları kitin kural satırında bir dokunuş uzakta; bağlantı hatası uyarı notunda, "Yeniden bağlan" kit basışı; pay alımı ve sınır uyarısı kit kuyusunda.
- Audit (tr): takım 220 → 0; klan sayfasındaki takım 3 (kalan sayfanın üstündeki 2 px'lik öğe, klan sayfasına ait). Uçuş öncesi ekran 126 → 96 (geri kalanı G12-b).


**G12-b Uçuş öncesi ekran ✅ (2026-11-16).** `Sandbox` (uçuş öncesi bölüm), `ClassPicker`, `ModePicker`, `LoopLine`, gemi satırı.
- **An:** "Hangi gemi, hangi uçuş, başla." Gemi ve alan resim olarak kalıyor; başlık üstte, masa başparmakların altında.
- Başlık kitin display yazısında (h1). Döngü satırı 44 px. Kitin yardım işareti sağ uca sabitlendi, 320 px'te de taşmıyor; adımlar kit kuyusunda açılıyor.
- Uçuş türü (Gerçek uçuş / Antrenman) artık masanın ilk kararı ve döngü satırının hemen altında: gerçek uçuşta sınıf paneli yerine tek satırlık gemi bilgisi geldiği için gerisi bu karardan doğuyor. Plakalar ne kazandırdığını söylüyor; çekirdeği yetmeyen için kilitli plaka hangi çekirdeği beklediğini yazıyor; grup adı "Uçuş türü".
- Sınıf kitin seçeneklerinde. Görev satırı, sınıfın kendi rengindeki imza yeteneği ve sekiz değer kitin rakamlarında, çubuklarla. Paneller sahne üstünde koyu cam (`gk-arenapanel`); gemi yazının arkasından görünmüyor.
- Başlat kitin büyük eylem tuşu. Fiyatı ve onu ödeyen kaynak ikinci satırda. Uçamıyorsa nedenini yazıyor ("Tamirde · 59:54"). Kısa telefonda masa kaydırılırken başparmak altında sabit kalıyor.
- Takım lobisinde masanın başlat tuşu yok: devre dışı bilgi tuşu takımın kendi "Hazırım / Birlikte kalk" tuşlarını örtüyordu ve lidere de yanlış şey söylüyordu. Yerine "Kalkışı klan liderin başlatır." notu geliyor.
- Kök neden notu: arena.css'in eski başlat ve dön kuralları yalnız kite geçmemiş tuşlara uygulanıyor (`:where(:not(.gk-btn))`, G12-c'ye kadar). Araçların `.ap-launch` seçicisi korundu. Uçuş öncesine ait 63 satır eski kural ve kullanılmayan `LaunchLabel` silindi.
- Audit (tr): uçuş öncesi 126 → 19. Kalanın tamamı yalnız geliştirme modunda görünen fps göstergesi. Gerçek uçuş, tamir, takım lobisi ve 320 px durumları ayrıca sahte hangar yanıtlarıyla çekildi.


**G12-c Sonuç, ayarlar, yükleme ve izleme ✅ (2026-11-16).** `Sandbox` (sonuç, menü, yükleme, sıralama), `SortieSummary`, `GraphicsPicker`, `ModelCredits`, `SpectatorPanel`.
- **An:** "Ne oldu, şimdi ne?" Sonuç kartı uçuşun nasıl bittiğini kendi renginde söylüyor: teslim yeşil, yok edilme kırmızı, çekilme sarı. "Ne oldu?" kutusu, puan/isabet/yok edilen kitin rakamlarında. Sonraki uçuş tek ışıklı tuş ve ikinci satırında geri sayım ("Alana dönüş 3 sn").
- Düzeltilen çelişki: boş ambarla düşen gemiye "Ambar boştu; bu çıkış puan getirmedi" ile "Ambarın enkazın çevresine saçıldı" birlikte yazılıyordu. Boş çıkışta da "Ambar boştu" iki kez çıkıyordu. Artık ambar boşken kayıp yoksa "Ambar boştu; kargo kaybın yok." yazıyor. Saçıldı/alanda kaldı yalnız taşınan bir şey varken söyleniyor.
- Gerçek uçuşun dönüşü: başkente gidenler, düşen kargo ve takım havuzu kitin kaynak çiplerinde; günlük sınır ve tamir saati uyarı notunda; XP kendi satırında.
- Uçuş üstü ayarlar: dönüş hassasiyeti kitin kaydırıcısı (×0,50–×1,50), ters çevirme ve ses kitin şalteri, grafik kitin seçenekleri ve neye mal olduğu notu; "Uçuşa dön" ışıklı tuş. Emeği geçenler kitin kural satırında.
- Yükleme: aşama, yüzde ve çubuk kitte; yükleme hatası uyarı notu ve "Yeniden dene" tuşu. Takım izleme: arkadaş seçici 44 px, gövde çubuğu, "Sonuca dön" kit tuşu.
- 110 eski kural silindi (ar-*, ss-*, al-*, as-*, ap-mode, ap-eyebrow, ap-keys, eski başlat/dön). `.arena-spectator` yalnız konum.
- Audit'e iki giriş yolu: `arena:menu` (antrenman + menü) ve `arena:result` (geliştirme kancasıyla gemiyi düşürür). Audit (tr): menü 68 → 19, sonuç 54 → 19; kalanın tamamı geliştirme fps göstergesi. Yükleme ekranı çok kısa sürdüğü için fotoğraflanamadı; yalnız testlerle doğrulandı.


**G12-d1 Hangarın kabuğu ✅ (2026-11-16).** `HangarPanel` (sahne plakası, masa sekmeleri, sınıf kapısı, alt dok), `ShipStatus`, `DeskNote`; Komutan gemisi sayfası kitin başlığında.
- **An:** "Gemim ne durumda, sırada ne var?"
- Sayfa başı kitte, gemi sanatıyla (`cos-ship`); `sheet-heads` testindeki istisna listesinden arena çıktı.
- Bölmede geminin rolü kendi renginde, adı kitin display yazısında, seviyesi (denemede "Önizleme") kit çipinde; durum (Hazır / Tamirde · saat / Yarık'ta) renkli lambalı kit çipi.
- Masanın üç bölümü kit sekmeleri; Yetenekler sekmesi bekleyen puan sayısını rozetle gösteriyor, okuyucu "Yetenekler — 3 puan hazır" duyuyor.
- Sınıfları karşılaştır / değiştir kitin kapı satırı (değişim süresi sarı alt satırda).
- Alt dok: "Yarık'a gir" kitin büyük tuşu; uçabiliyorsa ışıklı, yalnız antrenman açıksa çelik ve nedeni ikinci satırda. Sezonun sınıfını seçmek ve değiştirmek kitin kesin tutması (1,5 sn): geri alınmıyor. Vazgeç ve gemime dön kit tuşları.
- Masa notları kit uyarısı; "Gemini seç" ve çekirdek eksikliği kit kuyusunda.
- Audit (tr, galeri sabit yanıtlarıyla): hangar 116 → 93. Kalan masanın blokları (tamir, seviye, yetenekler, değerler, yükleme): G12-d2.


### G12-d2 — gemi masası kit'te (2026-11-16)

- Seviye, tamir, yetenek, değerler, sınıf, kalkış planı, günlük tavan ve kurallar kit kuyularına ve etiketlerine taşındı.
- Her harcama (seviye, puan, kısa tamir) 1 sn'lik çelik `GameHold`. Tek parlak düğme Yarık'a giriş.
- Bedeller artık `CostLine` ile gösteriliyor. Kurallar `RulesRow` içinde. Sınıf sekmeleri `GameTabs`; kit'e küçük bir `art` alanı eklendi, sınıf imzası sekmede kaldı.
- Denetim (tr, telefon): 93 → 9. 12 px altı yazı 36 → 0, kontrast hatası 18 → 2.
- Kalan kontrast hataları bölmenin üstündeki plaka/ipucu yazılarında ve kaydırılmış karedeki başlık altı satırda.
- Açık: galeride bölme gemi modelini göstermiyor (9 sn beklemede de boş). Bu değişiklikten bağımsız, G12 kapanışında bakılacak.


### G12-e — uçuş ekranı kit'te (2026-11-16)

- Uçuş göstergeleri, hız kutusu, bildirim, sahne işaretleri, gaz, yetenek düğmeleri, işaret çarkı ve harita kit renklerine ve yazı tipine geçti. Arenanın eski v2 adları kit'e bağlandı.
- 12 px altında yazı kalmadı. Sahne üstündeki adlar koyu konturlu; düğme etiketleri motor parlamasında da okunsun diye ince koyu zemin üstünde.
- Menü 44 px metal yuvarlak düğme oldu. Radar ve menü basınca küçülüyor. Haritanın kapatma düğmesi de 44 px.
- Harita: etiketler büyük harften çıktı (12 px'te birbirine binmesin diye). Açıklamalı lejant satırları tam satır ve asılı girintili.
- Denetim (tr, telefon): 81 → 32. 12 px altı yazı 25 → 4; kalan 4'ü yalnız geliştirmede görünen fps satırı. Kontrast 16 → 8; kalanlar mesafeyle bilerek sönen uzak yer adları.
- Galeride hangar bölmesinin boş görünmesi hata değil: yerelde gemi paketi (`/__ref/dist/v2/…`) yok, prod'da arena sunucusu veriyor.


### G12 kapanış — arena 6 dilde telefonda (2026-11-16)

- 7 arena yolu (hangar, ekip, klan-arena, uçuş masası, uçuş, menü, sonuç) tr, en, de, es, fr ve ja'da telefonda ölçüldü.
- Tek bulgu Japoncadaydı: kit'in basılı tutma etiketi harf başına 0,6 em varsayıyordu (dar Saira). Japonca yazı tipinde etiket taşıyordu. Japoncada artık harf başına 1 em hesaplanıyor ve etiket ikinci satıra geçebiliyor.
- 320 px'te hangar'ın değer adları kesiliyordu ("Ateş gücü"). Artık alt satıra geçiyor.
- Sınıf çakışmaları düzeltildi:
  - G12-d2'nin `gk-level` ve `gk-desk` sınıfları kit'in seviye rozeti ve masa sütunu kurallarını devralıyordu: seviye başlığında mavi şerit, değerlerde fazladan panel. Sınıflar `gk-shiplevel` ve `gk-shipdesk` oldu.
  - G12-c'nin `gk-haul` kuralı savaş raporu ve hedef dosyasındaki eski `gk-haul` ızgarasını eziyordu. Arena olanı `gk-arenahaul` oldu.
- Sonuç: hiçbir dilde 12 px altı yazı, kesilme ya da taşma yok. Hangar (tr) puanı 6.
- Sahibe açık konu: arena metinleri yalnız tr/en. de, es, fr ve ja oyuncuları arenayı İngilizce görüyor (`arenaCopy`). Ayrıca galerideki hangar başlığı sabit Türkçe bir test metni; oyunda `t('arena.nav')` kullanılıyor.


### G13-a — çökme, bakım, sürüm ve engellendi ekranları kit'te (2026-11-16)

- Çökme ekranı v1'den kit'e geçti: başlık kit yazı tipinde, tek parlak "Yeniden yükle" düğmesi, rapor araçları sessiz kit düğmeleri, rapor bir kit kuyusunda.
- Bakım ve "güncelleme gerekli" ekranlarında açılışın marka sahnesi korundu; yalnız yazılar ve tek düğme kit'e geçti. Android'deki mağaza bağlantısı da aynı kit düğmesi görünümünde.
- Uygulamadaki "engellendi" görünümü `App.tsx` içinde çıplak v1 idi. `shell/BlockedScreen` bileşeni oldu ve kit'e geçti; web eskisi gibi giriş sayfasını gösteriyor.
- Yükleme ekranına dokunulmadı: marka kompozisyonu, puanı zaten 0.
- Denetim (tr, 3 profil): bakım 1 → 0, güncelleme 0 → 0, çökme 9 → 0.
- `landing-api-failure` testindeki ses modülü sahtesi gerçek modülü yayacak şekilde genişletildi; kit düğmesi `OWN_SOUND`'u istiyor.


### G13-b — giriş paneli kit'te (2026-11-16)

- Giriş paneli v2'den kit'e geçti:
  - kit metal panel ve kit yazı tipiyle başlık; kapat düğmesi kit yuvarlak düğmesi;
  - iki alan kit cam yuvası, kit etiketleriyle;
  - ret, zarar renginde bir kit afişi; ilgili alanın kenarı yanıyor;
  - tek parlak "Giriş yap" düğmesi; "Parolamı unuttum" ve "Yeni komutan oluştur" sessiz kit düğmeleri.
- Davranış aynı: arka plana yanlışlıkla gelen tıklamaya karşı koruma (`useOwnPress`), geri tuşu, Esc, odak tuzağı, form tek giriş noktası.
- Şifre sıfırlama zaten kit'teydi (puan 0).
- Denetim (tr, 3 profil): giriş 23 → 2. Kalan 2 "tepkisiz" bulgusu arkadaki açılış sayfasının dil seçicisi ve Wiki bağlantısı.


### G13-c — uygulama giriş ekranı kit'te (2026-11-16)

- Android'in giriş ekranı (`CompactLandingScreen`) v2'den kit'e geçti:
  - nüfus satırı kit sayılarıyla;
  - tek parlak düğme: ilk kez gelende eğitim, daha önce komutan tutmuş cihazda geri giriş;
  - öbür kapı çelik ya da sessiz kit düğmesi;
  - ret bir kit afişi; yayıncı sayfaları sessiz kit bağlantıları, 44 px yüksekliğinde;
  - dil seçici kit camında: `LanguageSwitch`'e `kit` seçeneği eklendi, web açılışı ve simülatör eskisi gibi.
- Sahne üstündeki yazılara koyu kontur verildi; arkadan geçen parlak gezegen artık okunuşu bozmuyor.
- Web açılış sayfasına (`PublicLandingScreen`) dokunulmadı; sahibin 2026-10-18 premium tasarımı kendi CSS'iyle duruyor.
- Galeriye `front-door` görünümü eklendi (`gallery:front-door`); ekran web'de görünmediği için denetim ancak böyle ulaşabiliyor. Galeri görünümün üstüne kaynak çubuğunu da çizdiği için puan (31) şişik. Ekranın kendi bulguları: 12 px altı yazı yok, kesilme yok; kontrast bulguları konturu saymayan ölçümden.
- G13-b'de kaçan bir test (`onboarding`: giriş başlığının sınıfı) kit'e göre güncellendi.


### G13-d — adres sorusu, dönüş kartı ve hızlı erişim düğmesi kit'te (2026-11-16)

- Adres sorusu (`BrandQuiz`) kit levhası oldu:
  - önce ödül: üç kaynak kit kuyusunda, kit sayılarıyla;
  - her adres harf anahtarlı bir kit plakası; seçince dokunma sesi, yanlış seçim sarsılır ve sarı kit afişiyle doğru adresi söyler;
  - ödül verilince onay işareti büyüyerek gelir, tek parlak düğme "oyuna devam et"; atla sessiz kit düğmesi.
- Dönüş kartı (`RecallHost`) kit plakası; kapatma kit yuvarlak düğmesi; hızlı erişim düğmesi (`InstallButton`) artık kit düğmesi.
- `brand/styles.css` içindeki kullanılmayan 27 kural silindi (soru, ödül, seçim, kart).
- Bu ekranlar denetim envanterinde yok (brand klasörü listelenmiyor); `brand-preview` üzerinden telefon genişliğinde önce/sonra fotoğraflarıyla kontrol edildi. 12 px altı yazı yok, kesilme yok.
- Kaldı: kurulum talimat sayfası (Install.tsx, eski Button/Icon) ayrı birimde.
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
| `FleetCards` | 160 | 1 | v1 | kit (`gk-fleetband`, `gk-fleetchip`) | G2-g ✅ (Savunma özetinin altında, tek kullanıcısı orası) |
| `RichContent` | 120 | 2 | v1 | — | G8 |
| `SeasonRewardBoard`, `SeasonRewardReceipt` | 26–232 | 1 | v1 / v2 | `RewardPod` | G9 |
| `LanguageSwitch` | 29 | 3 | v2 | `LanguagePicker` (kitte var) | G1 |
| `FpsReadout`, `hitboxDebug` | — | — | — | geliştirici; kapsam dışı | — |

**Kitte olmayan, sık kullanılan parçalar (kit boşluğu adayları, ilk kullanan grupta önce kite eklenir):** tost (`Toast`), sayıcı (`QuantityStepper`), aralıklı okuma (`RangeRow`/aralık çubuğu, G3), onay dialogu (`Confirm`: kitte `Dialog` var, uyumu bakılacak), sekme içi seçim (iki seçenekli `Segmented` → `GameTabs` ya da `Lever`), ülke / bayrak seçici.

**Canlıda kullanılmayan (yalnız testler):** `ui/RangeBand.tsx`, `ui/Clarity.tsx` (İstihbarat `v2/kit/Freshness` kullanıyor). 2026-11-14'te silindi.

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
