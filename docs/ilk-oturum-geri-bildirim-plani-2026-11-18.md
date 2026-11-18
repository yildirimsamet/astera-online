# İlk oturum: owner geri bildirimi planı (2026-11-18)

Owner, Faz 5'i telefonda oynadıktan sonra 16 madde yazdı: "Tüm hepsini planla, grupla, sıraya sok ve ölç biç değerlendir. Sonra başla."

Bu belge planı ve çalışma defterini birlikte tutar. Dal: `feat/new-player-journey` (worktree `blindspace-new-player`). Önceki plan: `docs/ilk-oturum-sahneleme-plani-2026-11-18.md`. Deploy yok; owner kontrol eder.

## 1. Maddeler ve kökleri (kodda doğrulandı)

| # | Owner'ın gördüğü | Kök neden (kod) |
|---|---|---|
| 1 | Prologda ocak tutuşması uzun. Sensör onarımı basılı tutma olmasın: 3 kez basılsın, her basış bir parça onarsın. | `onboarding/prologue/world.ts`: `BURN_MS = 6000`, `PATCH_MS = 3500`. Sensör adımı `HoldControl` ile yapılıyor. |
| 2 | Gemi raporundaki etiket turu çok hızlı geçiyor; 5 sn uzasın. | `director.ts` `SHOT_MAX_MS = 3000` her çekimi 3 sn'ye kırpıyor. `shipReport` `round` çekimi 3000 ms; beş etiket bu sürede sırayla açılıyor. |
| 3 | Toplama vurgusu iki hapı da kapsasın. Hattın herhangi bir yerine basmak toplar. | `281644cf` işareti alaşım hapına daralttı. Çerçeve ve el aynı öğeyi kullanıyor (`SchoolPointer`). |
| 4 | Onarım sırasında yakın çekim daha uzun sürsün. Onarım bitene kadar beklesin, aradaki uzaklaşma olmasın. "Dokun geç" zaten var. | `work` çekimi 2,4 sn. Sonra kamera eve dönüyor; `done` sahnesi bitişte kamerayı yeniden bölmeye götürüyor. |
| 5 | Onarımdan sonra gemi sayfasının hero bölümünde onarılan kısım vurgulansın. Yüzde animasyonla artsın, kısa ve hafif bir sarsıntı olsun, sonra sıradaki ONAR'a kaydırsın. | `ShipHero` yüzdeleri düz yazıyor. Görülen son yüzdenin kaydı yok. |
| 6 | Alaşım onarımında alaşım rengi, kristal onarımında kristal rengi efekt. | Efektler sistem başına renkleniyor (`BAY_COLOUR`). Rafineri ile Kristal Ocağı aynı sistemde (REFINERY). Kaynak rengi yok. |
| 7 | Teleskop efekti radar süpürgesi gibi; teleskobumuz küre gibi. Bu efekt teleskopta da radarda da var. | `BAY_RETURN.DEFENCE = 'sweep'`. Efekt modüle göre değil, sisteme göre seçiliyor. TELESCOPE ve RADAR aynı sistemde (DEFENCE). |
| 8 | Teleskop açılınca "Tersaneden ilk gemilerin çıktı: Kazıcı ×1" diyor. Gemiler de bir yere uçup gidiyor. | `done()` herhangi bir onarımın `grants.fleet` hediyesi için `firstShips` satırını kullanıyor; TELESCOPE 1, 1 Kazıcı veriyor. `YardLaunch` her zaman 2 Ok çizip uzaklaştırıyor. |
| 9 | Hem Radar hem Keşif anteni var, oyuncunun kafası karışıyor. Biri kalksın; radar, modeldeki antene bağlansın. | RADAR (3 aşama) Savunma'da, SURVEY "Keşif anteni" (3 aşama, sondayı açar) Keşif'te. **Owner kararı gerekli (§4).** |
| 10 | "Sonda yolla" adımında açılan odak kartı bozuk, butonlar kocaman. | `FocusPanel` eylem satırında SONDA yarım genişlikte, uzun `attack-locked` notu yanında. Satır şişiyor. |
| 11 | Tersane onarımı 1 dk sürüyor, 30 sn olsun. | `ladder.ts`: `step('CARGO','SHIPYARD',1,800,300,1,…)` (dakika). |
| 12 | "İstihbarat geldi" adımında rapor vurgulanıyor. Devam'dan sonra sayfa açık kalıyor, oyuncu ne yapacağını bilmiyor. | `report` okuma adımı bitince radar adımları başlıyor. Rehber, kapanmamış dosyanın üstünde galaksideki bir şeyden söz ediyor. |
| 13 | Her şey onarılınca oyuncuya nereden ve nasıl geçeceği gösterilmiyor. "İstersen hemen geçmek zorunda değilsin" denmeli. | `UnlockMoment` `jump` için yalnız "Sonra" gösteriyor (`TRY` listesinde değil). |
| 14 | Gezegenin adı vurgulanıyor, gezegenin kendisi değil. Oyunda sayfayı gezegene dokunmak açıyor. | `OutpostGuide` bayrak ve adı gezegenin üstüne yerleştiriyor. İşaret (`data-scene-mark`) bu bayrak düğmesi. |
| 15 | 7 kutu panosu: dar ekranda taşıyor, renkler uyumsuz, kutular cansız. Aldıktan sonra alt düğme "Yükselt" oluyor. Tek kutu varken "Tümünü al · 7" yazıyor. | `LandingRewards`: alt düğme kutuları değil 7 onarım ödülünü (rewards tiers) alıyor. Alınca "spend" (Yükselt) oluyor. Pano ve onarım ödülü tek pencerede karışıyor. |
| 16 | Onboarding sonunda eski sahneler art arda hızlıca oynadı: temas, sonda, tersane işi, ilk gemiler. Bazılarını zaten görmüştüm. | Sayfa açıkken istenen sahneler kuyrukta bekliyor (`88ecea1f` bunu bilerek yaptı). Kuyruğun süre sınırı ve "an geçti mi" denetimi yok; gökyüzü açılınca bayat sahneler peş peşe oynuyor. |

## 2. Ölç biç: çatışmalar ve ödünleşimler

- **Çekim süresi kuralı (madde 2, 4).** Faz 5 planında (S2) her çekim en fazla 3 sn sürüyor ve 2026-11-07 tarihli "oyuncunun eli 10 sn'den fazla bağlanmaz" kuralına uyuyordu. Owner şimdi rapor turunu 8 sn, onarım çekimini ise onarım bitene kadar (Tersane 30 sn) istiyor. Owner'ın kendi isteği olduğu için bu kural değişikliği olarak uygulanır. "Dokun · geç" her an elde kalır; böylece el bağlanmaz, yalnız beklemek seçilebilir olur. Faz 5 planındaki S2 notu güncellenir.
- **Kuyruk ve bayat sahneler (madde 16).** `88ecea1f` sahneleri sayfa kapanana kadar bekletiyor; bu, rehberin susmasını düzeltti. Yeni kural: bekleyen sahnenin bir **ömrü** vardır. Anı geçmişse oynamaz: onarım bitmiş, sonda raporu açılmış, Tersane sipariş edilmiş vb. Ömrü dolmuşsa da oynamaz (sayfadan dönüşte en fazla ~20 sn eski). İlk gemi raporu hariç.
- **Hero animasyonu (madde 5) ve otomatik kaydırma.** Rehberin eli de kaydırıyor. Sıra şöyle: önce hero anı oynar, sonra tek kaydırma yapılır, el oradan devam eder. Kaydırma, oyuncu o sırada kendi kaydırıyorsa yapılmaz.
- **Efekt kuralları (madde 6, 7, 8, 5, 15).** Her efektin 3 satırlık VFX briefi olur ve teslimde gösterilir. Yumuşak yuvarlak parlama ve büyüyen hale yok. Teleskobun küresi, galakside teleskop menzilini çizen tel kafes kürenin aynı dili: çizgiler kendini çizer, büyüyen bir hale değil.
- **Madde 15.** S6 kararı ("iniş tek pencere") korunur. Pencerenin içinde iki an sıraya girer: önce onarım ödülü alınır, sonra 1. kutu açılır. "Tümünü al · 7" ve "Yükselt" kalkar.
- **Madde 9.** Kurallar paketini (ladder), sunucuyu (`probe.ts`, `vessel.ts`), simülasyonu ve 5 dildeki metni etkiler. Owner'a seçeneklerle sorulur (§4). Cevaba kadar diğer gruplar ilerler.

## 3. Gruplar ve sıra

Her adım TDD ile yapılır: önce kırmızı test, sonra kod, sonra yeşil. Ardından 350 px canlı deneme, sonra commit.

| Sıra | Grup | Maddeler | Neden bu sırada |
|---|---|---|---|
| 1 | **Y — Yönetmen kuyruğu ve çekimler** | 16, 4, 2 | Bayat sahne hatası her şeyi etkiliyor. Onarım çekimi ve rapor turu aynı kodda (`director.ts`, `scenes.ts`, `DirectorStage`, `GalaxyCanvas` kamera). |
| 2 | **R — Rehber işaretleri ve akış** | 3, 14, 12, 10 | Oyuncunun takıldığı yerler: yanlış vurgu, açık kalan sayfa, bozuk kart. |
| 3 | **K — Kural ve prolog süreleri** | 11, 1 | Tersane 30 sn (kurallar paketi + aynalar). Prologda yanma 3 sn, sensörde 3 basış. |
| 4 | **E — Onarım efektleri** | 8, 7, 6 | Hediye satırı ve yanaşan gemiler, teleskop küresi, kaynak renkleri. Hepsi `BayFx` / `OwnVessel` / `scenes`. |
| 5 | **G — Gemi sayfası anları** | 5, 13 | Hero onarım anı ve otomatik kaydırma. Sıçrama hazır kartında yol göstermek. |
| 6 | **Ö — İniş ödülü ve 7 kutu** | 15 | En büyük yeniden tasarım: yerleşim, renk, kutular, düğme dili. |
| 7 | **A — Radar / Keşif anteni** | 9 | Owner'ın cevabına göre. |

## 4. Owner'a soru (madde 9) — cevap: A (owner 2026-11-18)

**Karar:** Radar Keşif sistemine geçer, modeldeki anten Radar ile onarılır; "Keşif anteni" adı "Sonda rampası" olur, sonda ayrı onarım kalır.


- **A. Ad ve yer değişir (önerilen).** Radar, Keşif sistemine geçer ve modeldeki anten onarılır. "Keşif anteni"nin adı yaptığı işle değişir: "Sonda rampası". Sonda ayrı bir onarım olarak kalır.
  - Kazanç: iki radar görüntüsü kalkar. Kurallarda yalnız sistem eşlemesi ve ad değişir.
  - Bedel: onarım sayısı aynı kalır.
- **B. Birleşir.** Keşif anteni kalkar ve Radar onarımı sondayı da açar.
  - Kazanç: yol bir onarım kısalır.
  - Bedel: kurallar (`ladder.ts`: SURVEY 1–3 ve onlara bağlı gereksinimler), sunucu, simülasyon ve metinlerin tamamı değişir. Mevcut gemilerdeki SURVEY seviyeleri dönüştürülmelidir. Ana galakside oyuncu sondayı yine ayrı bir yapıda bulur.
- **C. Yalnız görsel.** Radar onarılınca modeldeki anten onarılır. İsimler aynı kalır.

## 5. Dosya haritası

- Yönetmen: `apps/web/src/starter/director/{director.ts,scenes.ts,DirectorStage.tsx,useStarterScenes.ts,director.css}`; kamera `apps/web/src/galaxy/GalaxyCanvas.tsx` (`shotPose`, `returnPose`).
- Efektler: `apps/web/src/galaxy/{BayFx.tsx,bayFx.ts,OwnVessel.tsx}`.
- Rehber: `apps/web/src/starter/tutorial/{script.ts,StarterTutorialCoach.tsx}`, `apps/web/src/onboarding/flightSchool/{SchoolPointer.tsx,SchoolHighlight.tsx}`.
- Kartlar ve sayfalar: `apps/web/src/galaxy/{FocusPanel.tsx,OutpostGuide.tsx}`, `apps/web/src/starter/{ShipHero.tsx,VesselScreen.tsx,UnlockMoment.tsx,LandingRewards.tsx}`, `apps/web/src/screens/WelcomeWeek.tsx`.
- Prolog: `apps/web/src/onboarding/prologue/{world.ts,Prologue.tsx}`.
- Kurallar: `packages/rules/src/starter/ladder.ts`; sunucu `apps/server/src/services/starter/{probe.ts,vessel.ts}`.

## 6. İlerleme

| Grup | Durum | Commit / not |
|---|---|---|
| Y | bitti | 25934b22: sahne bekleme süresi ve eski sahnelerin düşmesi (16), onarım yakınlaşması bitene kadar (4), rapor turu 8 sn (2). |
| R | bitti | 983a06fa toplama çerçevesi iki hap (3) · a1642765 gezegen kilidi, ad değil (14) · c91e79db rapor Devam'da kart kapanır (12) · 56c20a7d sonda kartı (10). |
| K | sırada | |
| E | sırada | |
| G | sırada | |
| Ö | sırada | |
| A | karar: seçenek A | |
