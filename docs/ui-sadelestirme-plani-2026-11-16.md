# Arayüz sadeleştirme planı — 2026-11-16

Owner'ın 17 maddelik incelemesinden (2026-11-16) doğan iş. Aşama 4'ün ekran dönüşümü üstüne gelir: ekranlar kite boyandı ama eski boyut, düzen ve metinleri kaldı. Bu plan onları yeniden kurar.

## Amaç (owner, 2026-11-16)

1. **Oyuncu ferahlasın, daralmasın.** Boşa giden dikey alan geri alınır; oyuncunun geldiği şey (gemi, bina, hedef) kaydırmadan görünür.
2. **Bilgi yağmuru yok.** Gereksiz yazı silinir, uzun yazı kısaltılır, yine uzun kalan **infobox / akordiyon** arkasına saklanır: isteyenin önünde durur ama görmek için basmak gerekir.

Her yüzeyin ölçütü: **350×812 ve 375×667'de kaydırmadan ne görünüyor?** Aynı bilgi ekranda tek bir yerde görünür.

## Aşamalar

| # | İş | Owner maddesi | Durum |
|---|---|---|---|
| S1 | Tek başlık standardı: sheet başlığı en fazla 48 px; ikon 32, tek satır başlık, bir satır üst yazı, kapat/geri 40 px; resimli başlık aynı 48 px'in zemini | 5, 10, 15 | bitti |
| S2 | Sekme çubuğu: eşit genişlik, tek satır, 40 px; menü sekmeleri Gezegen / Araştırma / Gemi | 11 | bitti |
| S3 | Kompakt bağlam kartı (alt kart): saldırı, etkinlik, öneri; yazı ve düğme küçülür, dikeyde ~%40 kısalır | 1 | bitti (saldırı/öneri 175→108 px, olay 118→96) |
| S4 | Görsel kart oranı: kart resminin %70–80'i görünür, kart gereksiz uzamaz | 7 | bitti (menü karosu tam genişlik, bina kartı 16:9 pencere; mağaza/envanter zaten tam) |
| S5 | Kit'e standart `Fold` (akordiyon) ve `InfoPeek` kullanımı; uzun kural metni bunların arkasına | 2. amaç | bekliyor |
| S6 | Yazım kuralı: bilineni yazma, tek cümle, kural ⓘ'de (`docs/ux-writing.md`'ye ek) | 17 | bekliyor |
| H1 | Galaksi HUD bölgeleri: status bar altı tam genişlikte uçuş şeridi + toast; sol sütun durum rozetleri (sıkı); sağ üst bulunabilecekler; altında 2×2 araç (teleskop, dünyalar, market, zil); çevrimiçi sayısı gizli; etkinlik bitiş şeridi olduğu gibi | 2, 3, 4 | bitti |
| H2 | Eve dön düğmesi: zaten evdeyken ne yaptığı görünür olsun ya da gizlensin | 12 | bitti (her basışta evde halka + "Buradasın"; HUD harita etiketlerinin üstünde) |
| E1 | Filo sekmesi: Onur/duruş bloğu akordiyona, gemiler kaydırmadan görünür; gemi kartında saldırı/savunma/hız | 8, 9 | bitti (kit `Fold`; duruş ve klan desteği tek satır, alarmda açık; kartta saldırı/defans/hız; sekme tanıtım cümlesi ve Hangar odasının tekrar eden cümlesi kalktı) |
| E2 | Gemi üretim kartı baştan | 10 | bekliyor |
| E3 | Saldırı sheet'i baştan (owner, 2026-11-16 ek): kit'in basılı tutmalı gemi kartları (`UnitCard`), hız ilerleme çubuğu gibi (solda solucan/yavaş renk, sağda roket/alev), kısa ekranda gemi alanı korunur, uyarılar tek satır + ⓘ | 16, 17, ek | bitti (kartlar, gaz kolu tüm uçuşlarda, tek satır fiyat, kısa ekranda cetvel kayar, eşleşme payları ⓘ'de) |
| E7 | Focus: Ölüm Yıldızı akordiyonu silah yokken de görünür (kırmızı, radyasyon sarı), açınca üretim şartı | ek | bitti |
| E4 | Klan sheet'i sekmelere (Bul / Kur / Neden); kuramayan oyuncuya form kilitli | 6 | bekliyor |
| E5 | Ödüller: hangi ödülün açıldığı belli; parlama kutuya sıkışmaz; bir ödül alınırken diğerleri pasif, yükleniyor değil | 13, 14 | bekliyor |
| E6 | Kalan oyun ekranlarında metin taraması (altı dil) | 17 | bekliyor |
| O1 | Anıt: galaksideki etiket ve alt kartta radyasyon ikonu | ek-1 | bekliyor |
| O2 | Anıt focus sheet'i: alta uzayan tek sütun yerine sekme / ⓘ / akordiyon | ek-2 | bekliyor |
| O3 | Çökme: "useToast called outside ToastProvider" (arka plandan dönüşte) — kök neden + düzelt; bir yüzeyin hatası bütün oyunu düşürmesin (yüzey başına hata sınırı) | ek-3 | bekliyor |
| O4 | Liderlik tablosu: sıralama ilk ekranda; ödül ve kural metni ⓘ / sekmeye (CoC, Survivor.io, Whiteout Survival incelenir) | ek-4 | bekliyor |
| O5 | Klan sheet'i sekmelere: ara / listele / kur / klanım (E4 ile birleşik) | ek-5 | bekliyor |
| O6 | Savaş raporu baştan: sonuç önce, kısa, soru bırakmayan | ek-6 | bekliyor |
| O7 | Galaksi sol üst zaman rozetleri türüne göre renkli (kalkan yeşil, ticaret sarı, konvoy kırmızı…) | ek-7 | bekliyor |
| O8 | Profil sayfasının sonu: hesabı sil sakin, çıkış en altta; kırmızı tehlike düğmeleri kibar | ek-8 | bekliyor |
| O9 | Saldırı sheet'i: kart içi satırlar yan kartla hizalı, kargo rengi, hız çubuğunu sola sürükleme hatası, kalkan uyarısı kırmızı ve üst boşluğu az | ek-9 | bekliyor |
| O10 | Sınıf üstünlüğü (counter) bilgi elemanları küçülür | ek-10 | bekliyor |
| O11 | Üst bilgi şeritleri (uçuş/iş bitiyor) daha ince; altındaki rozetlerle 8 px; sol ve sağ rozetler aynı hizada | ek-11 | bekliyor |
| O12 | Filo sekmesi toplanır (E1) | ek-12 | bitti (E1) |
| O13 | Gezegen / Araştırma / Gemi geçişinde sekme çubuğunun genişliği ve yan boşluklar sabit (Gezegen'deki gibi) | ek-13 | bekliyor |
| O14 | Birden fazla gezegende sol üstteki gezegen düğmesi kompakt ve kit'e uygun | ek-14 | bekliyor |
| O15 | Mağaza kategori kutuları kompakt | ek-15 | bekliyor |
| O16 | Komutan menüsü: "Oyuna dön" kalkar; yanındaki iki düğme düzgün | ek-16 | bekliyor |
| O17 | Komutan gemisi: "Yarık'a gir" düğmesinin altındaki boşluk kapanır | ek-17 | bekliyor |
| K | Kapanış: altı dil, 350/375×667/masaüstü, tam test, görsel denetim | — | bekliyor |

Sıra: S1 → S2 → S3 → H1 → H2 → S4 → S5/S6 → E1 → E2 → E3 → E4 → E5 → E6 → K.

Owner'ın ikinci listesi (ek-1…ek-17, 2026-11-17) eklendi. Yeni sıra: O3 (çökme) → O9 → O11 → O7 → O13 → O8 → O16 → O17 → O14 → O15 → O10 → O1 → O2 → O4 → O5/E4 → O6 → E2 → E5 → E6 → K.

**Genel kural (owner, ek-2):** alta doğru uzayan tek sütun section yığını yanlıştır, hiçbir yerde kullanılmaz. Bir yüzey çok uzuyorsa sekme, ⓘ ya da akordiyonla çözülür. Her birim: incele → test (mantık için TDD) → yap → ölç/fotoğrafla → commit → master.

## Kapsam: oyunun tamamı (owner, 2026-11-16)

> "Bir kaç yeri düzeltip diğer yerleri, oyunun yarısını unutma."

Owner'ın gösterdiği ekranlar örnektir. Her standart (S1–S6) ve her yazı taraması **aşağıdaki bütün yüzeylere** uygulanır; bir standart ancak bütün satırlarda doğrulanınca kapanır. Bu iş boyunca çekilmiş fotoğraflar (`out/ui-audit/*`, `out/galaksi-her-sey/`) ve galeri görünümlerinin tamamı her standart için yeniden taranır.

Yüzeyler (`packages/ui-audit/src/inventory.ts`, G14/G15 hariç), parantezde ekrana özel maddeler:

G1 galaxy-hud (H1, H2, S3) · G1 bell · G1 menu (S2, S4: menü kartları) · G1 now-line · G1 outline
G2 fleet (E1) · G2 planet (E1, E2, S4) · G2 queue · G2 research (S2) · G2 worlds
G3 events-guide · G3 intel (S2) · G3 view-sheet
G4 convoy · G4 focus · G4 launch (E3) · G4 peek · G4 settlement · G4 strike · G4 trade · G4 transfer · G4 unknown-signal
G5 away · G5 battle-replay · G5 chronicle · G5 reports
G6 cosmetic-trial · G6 donate · G6 inventory · G6 rewards (E5) · G6 shop
G7 clan (E4) · G7 clan-support
G8 announcements · G8 chat · G8 feedback · G8 notifications
G9 leaderboard · G9 monument · G9 season-recap
G10 legacy · G10 profile · G10 servers · G10 silent-space
G12 arena
Son sırada: G11 simulator / wiki-sheet / wiki-public · G13 faults / landing / loading (yalnız denetim)

| Standart | Nasıl doğrulanır | Durum |
|---|---|---|
| S1 başlık 48 px | `Sheet` bileşeninden gelir; 48 galeri görünümünde ölçüm (yükseklik + kesilme) tr/de/fr/ja; bütün oyun için sabit başlık uzunluğu testi (`sheet-head-copy.test.ts`) | bitti (rapor başlığı ve dinamik uzun başlıklar E3/rapor biriminde) |
| S2 sekme | `GameTabs` kullanan her yüzey; eşit genişlik ölçümü | bitti (5 dilde ölçüldü) |
| S3 alt kart | `ContextCard` / `ContextStrip` her hâli (saldırı, etkinlik, öneri, seçili) | bitti (tr/de/ja ölçüldü) |
| S4 görsel kart | resimli her kart (bina, gemi, menü, mağaza, araştırma) — görünen resim oranı ölçülür | bitti (ölçüldü; mağaza karosunun kare resmi %47, bilinçli) |
| S5/S6 yazı | her yüzeyin her paragrafı: sil / kısalt / ⓘ ya da akordiyona; altı dil | bekliyor |

## Not defteri

### Dosya haritası
- Sheet başlığı: `apps/web/src/v2/kit/Sheet.tsx` (~257, kit başlığı; `quietTitle` ve kit'siz düz başlık ayrı dallar). CSS: `game-ui/game-ui.css` `.gk-sheet__head/__art/__eyebrow/__title/__meta` (~4529), resimli başlık `styles/atmosphere.css` `.sheet-art-head`.
- Kit'in sunum kopyası: `game-ui/surfaces.tsx` `SheetFrame` (aynı sınıflar).
- Bağlam kartı: `game-ui/surfaces.tsx` `ContextCard`, `ContextStrip`; yerleşim `v2/hud/ContextSlot.tsx`.
- HUD: `v2/shell/HudTop.tsx` (StatusLine, NowLine), `v2/hud/GalaxyCorners.tsx` (GalaxyReadout, HomeChip, ViewChip, EventChips), `screens/GalaxyView.tsx` (~1345 köşe düğmeleri, ~1360 readout).
- Bilgi açma: `game-ui/controls.tsx` `InfoPeek`.
- Galeride tam dolu galaksi: `?view=hud-everything` / `hud-everything-calm` (`v2/gallery/hudEverything.ts`).

### Doğrulanmış olgular
- Bugünkü kit başlığı: tutamak satırı ~16 px + başlık (4 margin + 8+8 padding + 58 px resim) ≈ 96–100 px; başlık 24 px büyük harf ve sarar.
- 41 dosya `kit={{…}}` ile sheet açıyor, 49 dosya `<Sheet` kullanıyor.

### Kurallar
- TDD: CSS/className hariç her değişiklik önce test.
- Admin (G14) ve onboarding/starter (G15) bu planın dışında.
- Metin değişikliği altı dilde birlikte yapılır.

## İlerleme
- 2026-11-16: plan yazıldı; S1 başladı.
- 2026-11-16: S1, S2, H1 bitti (başlık 48 px, yumuşak geçiş, eşit boşluk; sekmeler eşit; HUD bölgeleri, araçlar 2×2, tek araç sağda). E7 bitti. Sıradaki: S3, E3.
- 2026-11-16: E3 bitti (saldırı sheet'i: basılı tutmalı gemi kartları, solucan→roket hız çubuğu, tek satır fiyat + ⓘ); S3 bitti (alt kartlar ~%40 kısa). Sıradaki: H2, S4.
- 2026-11-16: H2 bitti; ayrıca harita etiketleri HUD araçlarını örtüyordu (z-index), düzeltildi. Sıradaki: S4.
- 2026-11-16: S4 bitti. Üs'ün beşli sekmesinde kelime ortadan kırılıyordu: sekme 1 px yan boşluk + 0 harf aralığı, uzun kelimeler kısaldı (Taktik, Economy, Ausbau, Fábricas, Usines; akademi metni de). Sıradaki: S5/S6, E1.
- 2026-11-17: E1 bitti: kit'e `Fold` (S5'in ilk parçası; Ölüm Yıldızı/radyasyon katlanırları da bunu kullanıyor). Owner'ın ikinci 17 maddelik listesi plana eklendi (O1–O17). Sıradaki: O3.
