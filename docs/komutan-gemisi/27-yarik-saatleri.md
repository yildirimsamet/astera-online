# 27 — Yarık Saatleri, Asteryum oku ve kısa oturum kalibrasyonu

> **Durum:** CANLI, 2026-11-27 08:40 UTC, `6aa22a9b` (api1-3, worker, arena, web + OTA). Migration 0275;
> EU-1/EU-2 takvimine 31'er Yarık Saati eklendi (`sync-events --kind RIFT_HOUR`, ilk 27 Kasım 14:00 UTC).
> Sahip kararı: [KG-K35](02-kararlar.md#kg-k35).

## 1. Sahibin isteği ve cevapları (2026-11-27)

1. **Asteryum bulunamıyor.** İnceleme: kod doğru çalışıyor; ilk canlı fırtınada (2026-11-26 18:00 UTC)
   en az 3 uçuş, eve inen Asteryum **0** (oyuncu stoğundaki 12 birimin 12'si aylardan). Sebep görünürlük:
   tek pilotta merkezde aynı anda 2 taş, 4 km çaplı ve 1 km yüksek bir hacimde; 9,5 m taş 500 m'de ~11 px,
   1 km'de ~5 px; radarda öteki madenlerle aynı 2 px nokta.
   - **Ok:** en yakın Asteryum taşı **500 m** içindeyse yön oku (KG-K34 "ok/işaret yok" kaldırıldı).
   - **Efekt:** fırtına kıvılcımı. Taşın üstünde ~1,5 sn'de bir kısa mor elektrik arkı (halka/hale yok).
2. **Yarık günde iki kez açık** (01-urun S26 "sürekli açık" değişti):
   - Yeni etkinlik **Yarık Saati** her gün 17:00–18:00 TR, Asteryum yok. Asteryum Fırtınası 21:00–22:00 aynen.
   - Pencere bitince giriş kapanır; içeridekilere **5 dk** çıkış süresi; sonra içeride kalan her gemi patlar
     (ambar kaybolur, gemi tamire girer). Antrenman her zaman açık.
3. **Kalibrasyon:** tamir 15 → **5 dk**; ücretli tamir **aynı** (15–30 dk teklifi yalnız Amiral'in 60 dk'lık
   eşlik kaybı tamirini kısaltır; ilk raporda yanlışlıkla "bozuk" dedim, sahip aynı kalsın dedi); bakım **5 dk** kalır; ambar **+%50** (450/600/750, 1. seviye); verim **×1,5** (kazma 6/sn, kaya 120,
   dolma ~114 sn aynı, saha parçaları 18/9/9/12). Günlük tavan (4 saat üretim) ve XP oranı değişmez.

## 2. Tasarım kararları (agent)

- Olay türü kodu `RIFT_HOUR` (Türkçe "Yarık Saati"); `GALAXY_EVENT_KINDS` sonuna eklenir (D156).
  Fırtınayla aynı ruleset'ten (SYNTHESIS 21) itibaren dağıtılır. Canlı sezona:
  `season sync-events --kind RIFT_HOUR --shard EU-1 --yes` (ayrı komut gerekmez).
- **Yarık penceresi = canlı bir sezonda açık RIFT_HOUR ya da ASTERIUM_STORM** (`riftWindow`). Oda tek ve
  ortak olduğu için fırtına anahtarı gibi küresel okunur.
- **Giriş kapısı** `launchSortieIn` içinde (DB, kesin zaman): tek uçuş ve takım kalkışı aynı yoldan geçer.
  Hata `RIFT_CLOSED` + `opensAt`.
- **Kapanış odada:** oda 5 sn'de bir pencereyi okur; son bitişten 5 dk sonra (`deadline`) `collapseRift`
  her canlı gemiyi patlatır, fırtına taşlarını siler (ertesi Yarık Saati'nde Asteryum kalmaz).
  Bitiş nedeni `closed` sonuç mesajına ve görülmemiş-uçuş bildirimine yazılır.
- Oda istemciye `rift` mesajı yollar (`open`, `closesIn`, `deadlineIn`; ms, gönderim anına göre: telefon
  saati kaysa da sayaç doğru). Protokol 20.
- **Ok:** `nearestAsterium` (istemci, 500 m). Ekranda taşın üstünde mor elmas + mesafe; ekran dışında
  kenarda ok. Ambar dolunca etiket "Ambar dolu" der (çekim yine yapılmaz, ok yine yön verir).
- **Galaksi etkinlik push'u yok** (bugün hiçbir galaksi etkinliği push atmıyor; oyun içi bildirim + kronik).
- **İnceleme düzeltmeleri (2026-11-27):** takım lobisi `RIFT_CLOSED` metni; HUD kapanış anında süreyi
  kendisi saymaya başlar (oda 5 sn'de bir okur); aktivasyon Yarık Saati'ni de ekler; sıradaki etkinlik
  sayacı sonradan açılmış Asteryum'u sayar. Sahip: çıkış işareti 2 km içinde (kapanışta her yerden), kenar okları ince-uzun.

## 3. Yapılacaklar ve ilerleme

| # | İş | Durum |
|---|---|---|
| R1 | Kalibrasyon sabitleri + testleri (`economy.ts`, `tuning.ts`, `classes.ts`, `farms.ts`) | tamam |
| R2 | `RIFT_HOUR` kuralları (`galaxyEvents.ts`, `constants.ts`) + testleri | tamam |
| R3 | `collapseRift(world)` (`arena/world.ts`) + testi | tamam |
| S1 | Migration: enum'a `RIFT_HOUR` | tamam (`0275_rift_hour`) |
| S2 | `galaxyEvents.ts` servis aynaları (effect şeması, takvim etiketi, aktif olay, bildirim yükü) | tamam |
| S3 | `riftWindow` (`arenaStorm.ts` → `arenaRift.ts`), launch kapısı, hangar `rift` alanı | tamam |
| S4 | Oda: pencere okuma, `rift` mesajı, kapanışta çöküş, `closed` sonucu/bildirimi | tamam |
| W1 | Şemalar (etkinlik türü, hangar, oda mesajı, bildirim) | tamam |
| W2 | Asteryum oku + fırtına kıvılcımı | tamam |
| W3 | HUD kapanış satırı, sonuç ekranı "Yarık kapandı" | tamam |
| W4 | Kapı/hangar kapalı durumu (`launchBlock` `closed`) | tamam (kapı saat gelince kendiliğinden açılır) |
| W5 | Etkinlik rehberi, kronik, rozet, `nowLine`, bildirim metni, Wiki, 6 dil | tamam |
| D1 | Belgeler: 01-urun S26, 02-kararlar KG-K35, bu defter | tamam |
| V | Tam test kapısı + görsel doğrulama (350 px) + N-1 (606bdf0d: 640 yük, 0 bozuk) + prod provası | tamam |

## 4. Dosya haritası

- Kurallar: `packages/rules/src/arena/{economy,tuning,classes,farms,world,protocol}.ts`,
  `packages/rules/src/{galaxyEvents,constants}.ts`.
- Sunucu: `apps/server/src/services/{arenaRift,arenaShips,arenaShipState,galaxyEvents}.ts`,
  `apps/server/src/arena/server.ts`, `apps/server/src/db/schema.ts`, `apps/server/drizzle/`.
- Web: `apps/web/src/arena/{client,compass,Hud,Sandbox,hangarDesk,network,copy,debrief}.ts(x)`,
  `apps/web/src/arena/render/ore.ts`, `apps/web/src/{api/schemas,lib/nowLine,lib/notifications}.ts`,
  `apps/web/src/screens/{GalaxyEventsGuide,ChronicleScreen}.tsx`, `apps/web/src/v2/hud/GalaxyCorners.tsx`,
  `apps/web/src/wiki/galaxy-content.ts`, `apps/web/src/i18n/locales/*/{synthesis,world}.ts`.
