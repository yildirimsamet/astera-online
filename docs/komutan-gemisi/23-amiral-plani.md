# 23 · Amiral (Y9) — bağlama planı (2026-10-25)

Kurallar: [22-ilk-surum-mantigi.md](22-ilk-surum-mantigi.md) "Amiral kuralları" ve "Amiral savaşmaz"
(sahip, 2026-10-25). Bu dosya yalnız uygulama sırası, testler ve dokunulan yerlerdir.

## Kapsam

Amiral, yalnız **gönderilen** dört filoya eşlik eder: oyuncu baskını (`mission` attack), korsan
baskını (`pirate`), anıt saldırısı (`monument`), klan savunma desteği (`defence`). Maden, ticaret,
konvoy ve sinyal uçuşlarına gitmez. Yalnız ruleset ≥ 19 sezonlarda (yeni sezonla gelir).

## Kural özeti (kodda tek yer: `packages/rules/src/arena/admiral.ts`)

| Konu | Kural |
|---|---|
| Savaş | Birim değil: ateş etmez, hedef olmaz, kayıp listesinde yok. Yalnız `withAdmiral` çarpanı |
| Bonus | Akıncı hasar +%2→5 · Muhafız gövde+kalkan +%2→5 · Kılavuz yol −%3→6, yakıt −%5→10 (sv1→20) |
| Tamir | Baskında/anıtta/korsanda saldıran **kaybederse** (REPELLED) ya da filo tamamen yok olursa 60 dk; savunma desteğinde **kesin yenilgide** (DECISIVE) 60 dk; aksi 10 dk bakım |
| Anıt | Kazanılırsa filo anıta girer, amiral eve döner (tutma kapasitesinde yer kaplamaz) |
| XP | Savaşta: iki tarafın kaybettiği gemi değeri (alaşım+kristal+döteryum) / 200, en az 10, en çok 100. Savaşsız: 5. Seviye tavanı (CM) geçerli. Sayılar ilk değer; sahip ayarlayabilir |
| Görünürlük | Savaş raporu ve gelen filo radar uyarısı "Amiral: Akıncı Sv 7" yazar |
| Galaksi | Amiral filonun en arkasında çizilir |

## Aşamalar (her biri: kırmızı test → kod → yeşil → görsel)

1. **Kural** — `admiralXp`, `admiralReturn(kind, grade, landedShips)`; Kılavuz süre/yakıt çarpanı
   yardımcıları. Saf testler.
2. **Baskın** — `launchAttack(admiral)`; teklif (`quote`) ve yakıt/süre; savaşta `withAdmiral`;
   dönüş bacağı süresi; dönüşte `finishAdmiralLeg`; rapor ve radar alanı. DB testleri.
3. **Korsan** — aynı zincir `pirateRaid.ts`.
4. **Anıt** — `sendMonument`; kazanınca amiral bacağının ayrı dönüşü.
5. **Klan desteği** — `sendClanSupport`; istasyon yığını `withAdmiral`; DECISIVE'de tamir.
6. **Ekran** — gönderim sayfasında "Amiral eşlik etsin" anahtarı (bonus, kilit, tamir bedeli;
   gemi yoksa/tamirdeyse nedeni); rapor ve radar satırı; galakside filonun arkasında gemi.
   6 dil.

## Aynalar (her kural değişikliğinde)

server dispatch + quote · worker dönüş/savaş · rules · web teklif/gönderim · rapor · radar ·
galaksi çizimi · 6 dil metni · testler.

## İlerleme

| # | Aşama | Durum |
|---|---|---|
| 1 | Kural | ✓ `admiralXp`, `admiralDefeated`, yeni `admiralOutcome`; migration 0203 (`lost`, `lost_value`, `won` silindi, rapor `admirals`) |
| 2 | Baskın | ✓ sunucu: gönderim, Kılavuz süre/yakıt (dönüş dahil), savaşta `withAdmiral`, nötr dünya, dokunulmadan dönüş, geri çağırma, radyasyon/terk, rapor + radar alanı (`arena-admiral-raid` 7/7). ✓ web: gönderim satırı (`EscortRow`), rota/yakıt teklifi, rapor satırı, radar metni, 6 dil |
| 3 | Korsan | ✓ gönderim (Kılavuz buluşması kendi hızında çözülür: `/api/pirates` `escortReach`), yakıt, dönüş/geri çağırma süresi, savaşta `withAdmiral`, rapor; filo yok olursa tek başına dönüp tamir (`arena-admiral-pirate` 6/6). Web: anahtar korsanda da, `escortReach` teklifi, `admiral` gönderimi (`launch-escort` 3/3) |
| 4 | Anıt | ✓ gönderim + teklif (`previewAdmiral` rezerv yapmaz), Kılavuz **yalnız gidiş** bacağında (dönüş filonun kendi yolu), savaşta `withAdmiral`, katılımcı `admiral` kolonu (0203'e eklendi), rapor; kazanınca filo anıtta kalır, amiral tek başına dönüp bakıma; kaybedilirse/yok olursa tamir; geri çağırma, takviye, sezon kapanışı (`arena-admiral-monument` 8/8). Web: `MonumentSheet` anahtarı, rapor satırı (`admiralHeld`), 6 dil |
| 5 | Klan desteği | ✓ gönderim + teklif, Kılavuz iki bacak + yakıt, istasyon yığını `withAdmiral`, `settleStations` savaşı kaydeder (yalnız DECISIVE tamir), dalga yok olursa tek başına dönüş, eve inişte `finishAdmiralLeg`; raporda savunma satırı (baskın + klan savaşı). Web: destek sayfasında anahtar + savunma kuralı metni (`escortRuleDefence`), 6 dil |
| 6 | Galakside filonun arkasında çizim | ✓ `pendingThreads` kendi uçuşlarında `admiral` (baskın, korsan, destek bacakları); `Flight` grubu içinde `escortSlot` (en arka slotun gerisi, merkez çizgide), sınıf modeli en kaba LOD, motor ışığı açık; ayrı vuruş kutusu yok |

Notlar:
- ✓ (2026-10-25) Tek başına eve dönen amiral galakside çizilir: `admiralHomeward` dönüş anını
  `arena_admirals.home_depart_at`'e yazar (0204); `/api/commander-ship` o sürede `status: 'admiral'` ve
  `homeward` yolunu (asıl uçuşun rotasında dönüş anındaki nokta → çıkış dünyası) döner; `HomewardShip`
  filodaki eskort boyunda, motorlar açık çizer, inişte park görünümüne geçer (`refreshAfter` varışta sorar).
- ✓ Kendi anıt dalgaları sahip-özel anıt görünümünden çizilir; dalga `admiral` taşır, eskort arkada çizilir.
- ✓ Gönderim ekranının tahmini (`useTargetReading` → `ForecastInput.attackerDamageMult/HullMult`) amiral
  bonusuyla savaşır; Kılavuz savaşa bir şey katmaz.
- `radiation-bomb-neutral` "fights with the NPC's radiation wounds" testi de kırmızı: 70 Dart artık Citadel'i
  öldürüyor (`{}` ≠ `{ CITADEL: 0 }`); fikstür yorumu 2026-10-20 kalibrasyonunu söylüyor, amiralsiz yol. Aynı sınıf.
- `pending` "catches every fleet at the same distance out" VPS'te 30 sn sınırını aşıyor (180 sn sınırla 66 sn'de geçiyor);
  savunanın okuması amiral sorgusunu hiç çalıştırmıyor (kendi uçuşu yoksa sorgu atlanır).
- `radiation-flights` "worn down" testi kırmızı (3/3 koşu). Amiralsiz baskında yeni kod savaşa dokunmuyor
  (`withAdmiral(side, null)` aynı nesneyi döndürür); olası neden `50ccc660` (kalkanlar raunt boyunca taşınır)
  savaş sonucunu değiştirdi ve bu fikstür güncellenmedi. Taban çizgisiyle doğrulanmadı.
