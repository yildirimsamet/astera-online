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

**Canlı oyunda olmayan eski kabuk (ölü kod adayı, silinmedi):** `shell/StatusBar.tsx`, `PendingStrip` bileşeni ve sinyal düğmesi `Signals` yalnızca eski `onboarding/Academy.tsx` ve `onboarding/Rehearsal.tsx` içinde çiziliyor; bu iki dosyayı hiçbir canlı dosya içe aktarmıyor (yalnız testler). `useAirborne` ve `FlightList` canlıda kullanılıyor. Owner'a liste olarak sunulacak.

### 3.3 G1 için ilk gözlemler (ekran görüntüsü öncesi, koddan)

1. Kit kabukta hiç yok: Dock, ayarlar ve menü için kit parçaları (`BottomNav`, `Toggle`, `Slider`, `LanguagePicker`, `ListRow`) hazır duruyor.
2. Sinyal akışı v1 dilinde: kabuktaki tek "üç dil" yeri.
3. Kalkan süresi ve toplama çizgisi, önemlerine göre çok küçük.
4. Menü tek sütunda dört ayrı öğe biçimi taşıyor; kategoriler ve karolar karışık.
5. Saldırı kartı oyunun en ağır anı ama sıradan bir kart.
6. Marka şeridi her oyun ekranında yer tutuyor.

## 3A. Genel bulgu: üç tasarım dili yan yana

Ölçüldü (2026-11-13, `apps/web/src`, test/galeri/dev hariç):

| Dil | İşaret | Dosya |
|---|---|---|
| v1 | `ui/kit` (`Button`, `Sheet`, `Meter`, `Chip`), token `text-bone/faint/dim`, `plate`, `legend`, `slab`, `field` | 69 dosya v1 token'ı taşıyor, 30'u `ui/kit` içe aktarıyor |
| v2 | `v2/kit` (`Sheet`, `Segmented`, `HoldButton`, `Cost`, `NeedBar`, `RoomBar`), token `v2-*` | 88 dosya |
| Oyun kiti | `game-ui` (`gk-*`), 2. aşamanın yazı ölçeği | 11 dosya (4.1 Üs parçaları + `v2/kit/Sheet` başlığı) |

**Yazı ölçeği:** `styles.css` bugün `--text-body 12px`, `--text-label 11px`, `--text-caption 10px`, `--text-micro 9px`. Kit dışındaki her yüzey 2. aşama kararının (12 px altı yazı yok; 12/13/14/16/19/24, sayı 18) altında kalıyor. Kit kendi ölçeğini taşıyor (`--gk-t-floor`, `--gk-t-small`, `--gk-t-body`, `--gk-t-lead`, `--gk-t-title`, `--gk-t-number`). Yeniden tasarım her yüzeyi kit ölçeğine taşır; eski token'lar yüzey yüzey boşalır.

**Sonuç:** bir yüzeyi "bitti" saymak için üç dilden birinin kalıntısı kalmamalı. Ölçüm aracına "v1/v2 token'ı kaldı mı" denetimi eklenecek (4.A.4).

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
