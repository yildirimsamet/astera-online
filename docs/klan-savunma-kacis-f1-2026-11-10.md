# Klan desteğiyle birlikte kaçış — F1 planı (2026-11-10)

Owner kararlarıyla yazıldı. Davet sistemi ve klan perkleri (F2+) bu planın dışındadır.

## Neden

Klan savunma desteği neredeyse hiç kullanılmıyor. Kök neden:

1. Her dünya `ESCAPE` duruşuyla başlıyor. Destek yalnız `SUPPORT` dünyasına inebiliyor (`clanSupport.ts` `gatherSupport`).
2. `SUPPORT` taktik geri çekilmeyi kapatıyor. Oyuncu kaçışı kaybetmemek için desteği açmıyor; saldırı gelince arkadaşı destek göndermek istese de sunucu reddediyor.
3. İlk kural ("destek varsa kaçmaz") bu yüzden toggle'a çevrilmişti: küçük bir destek dalgası çevrimdışı bir ev sahibinin filosunu kapana kıstırabiliyordu.

F1 bu çatışmayı kaldırır: destek kaçışı engellemez, hat birlikte kaçar.

## Owner kararları (2026-11-10)

| # | Karar |
|---|---|
| F1-K1 | Kaçış savaş anında **ev sahibi + bütün nöbetteki destek** toplam gücüne göre değerlendirilir. Mevcut kural aynen: saldıran ≥ `ESCAPE.ratio` (bugün 3) × hat gücü **ve** duran savaş DECISIVE **ve** en az 5 savaş gemisi (ruleset 13+; sayım ortak hat üzerinden). |
| F1-K2 | Kaçış olursa **ev sahibinin filosu da destek filoları da kaçar.** Savaşı yalnız ev sahibinin aktif kara silahları ve Aegis yapar. |
| F1-K3 | Yakıt bugünkü gibi yalnız **ev sahibinin kendi kaçan gemileri** için, ev sahibinin deposundan kesilir (`escapeFuel`). Destek gemilerinin kaçışı yakıt kesmez. Ev sahibinin kaçan gemisi yoksa yakıt 0'dır ve destek kaçabilir. |
| F1-K4 | Ev sahibinin deposu yetmezse (`STRANDED`) **bütün hat kalır ve savaşır**, destek dahil. |
| F1-K5 | Az destek oranı eşiğin altına indirip kaçışı engelleyebilir. Bu kuralın parçasıdır, ayrıca önlem yok. |
| F1-K6 | Hat kaçtıysa destek çarpanı **D = 1**, destekçi kaybı 0. Sonraki her hesap gerçekten olan savaşı okur. |
| F1-K7 | İki anahtar bağımsızdır. Yeni duruş `ESCAPE_SUPPORT` (ikisi açık). `ESCAPE`, `SUPPORT` (kaçmaz), `HOLD` aynen kalır. `POSTURE_CONFLICT` kalkar. |
| F1-K8 | Klan üyesinin dünyalarında **destek kabul varsayılan açıktır** (owner: "Açık, mevcutlar da"). Uygulama: saklanan varsayılan herkes için `ESCAPE_SUPPORT`; destek yalnız komutan bir klandayken etkilidir (`effectivePosture`). Klan dışında dünya herkese — sahibine, probe'a, saldırana — `ESCAPE` okunur; klana girince yazma olmadan açılır. Migration mevcut bütün `ESCAPE` dünyalarını `ESCAPE_SUPPORT` yapar; `SUPPORT`/`HOLD` seçilmiş olduğu için değişmez. Klan dışında destek anahtarı kilitli olduğundan, o sırada yapılan kayıt saklanan destek bitini değiştirmez. Botlar insanlarla aynı kurala tabidir. (Katılımda gezegen satırı yazmak kilit sırasını — gezegen → klan — ters çevirirdi; bu yüzden tembel varsayılan.) |
| F1-K9 | Mevcut sezonda canlı açılır. Yeni ruleset yok; kural `clanDefenseApplies` olan her sezonda geçerli. Desteksiz savaşlar ve `SUPPORT`/`HOLD` dünyaları bit düzeyinde aynı sonuç verir. |

Değişmeyenler: K1 (destek bölmesi = ev sahibinin Hangar odası), K2, K3 (±1 kademe), K5/K6 (D formülü, destekçinin Dominion'u değişmez), K7 (12 saat, recall, geri gönder), K8 (uçuş yuvası), K9 (probe duruşu kesin okur), K10 (gelen saldırı uyarısı klana düşmez — F2'de perk olarak ele alınacak).

## Davranış ayrıntısı

- **Kaçan destek nöbette kalır.** Bugün kaçan ev sahibi gemileri haritada hareket etmez, savaştan sonra evde durur. Kaçan destek dalgası da aynı biçimde STATIONED kalır; hasar almaz, gemi kaybetmez, 12 saatlik süresi değişmez.
- **Duruş geçişleri:** destek kabul eden (`SUPPORT`, `ESCAPE_SUPPORT`) bir duruştan kabul etmeyene (`ESCAPE`, `HOLD`) geçiş dalgaları `HOST_CLOSED` ile eve gönderir. `SUPPORT` ↔ `ESCAPE_SUPPORT` geçişi dalgalara dokunmaz.
- **Klandan ayrılma / atılma / dağılma:** `SUPPORT` → `ESCAPE_SUPPORT` (çekilme geri gelir; klan dışında kapı kapalı okunur) ve `defence_posture_reset` bildirimi. `ESCAPE_SUPPORT` zaten çekilme açık olduğundan sessiz kalır; `HOLD` değişmez.
- **Dünya el değiştirince:** saklanan duruş `ESCAPE_SUPPORT`; yeni sahibin klanı kapının açık olup olmadığını belirler.
- **Rapor ve bildirim:** kaçış, desteksiz bir savaş olarak yazılır: yalnız silahlar savaşır, D = 1, `clan_support_battle_results` satırı yok, `defenderCount` 1. Ev sahibinin raporu kaçan gemilerin yanında "N klan gemisi seninkilerle ücretsiz kalktı" der. Destekçiye yeni `clan_support_lifted` bildirimi gider (gemi sayısı, dünya; "hâlâ orada duruyor"); savaş raporu erişimi yoktur, çünkü gemileri savaşmadı. Saldıran yalnız gemilerin kaçtığını görür (bugünkü kural).
- **Önceden var olan hata (düzeltildi):** `/api/intel` probe raporlarında `posture` ve `support` alanlarını hiç göndermiyordu; saldıranın duruş/destek okuması istemciye ulaşmıyordu. Artık `posture` (eski 3 değer), `stance` ve `support` gönderilir.
- **Saldıranın ekranı:** probe `ESCAPE_SUPPORT` okuduysa kaçış hükmü ve oran çizgisi destek bandını da içeren hat gücüne göre çizilir. `SUPPORT`/`HOLD` bugünkü gibi "geri çekilmez".
- **Ev sahibinin ekranı:** kaçış eşiği ve yakıt satırı "sen + destek" toplamını anlatır; yakıt yalnız kendi gemilerin için yazılır. Depo yetmiyorsa satır "destek dahil tüm hat savaşır" der.

## Uyumluluk (eski Android paketleri)

Mağazadaki paketler web kodunu içinde taşır ve `posture` alanını `ESCAPE | SUPPORT | HOLD` enum'uyla parse eder. Bilinmeyen değer yüzeyi bozar. Bu yüzden:

- API'nin mevcut `posture` alanları (`defencePosture.posture`, probe raporu `posture`) `ESCAPE_SUPPORT` için **`ESCAPE`** gönderir.
- Kesin değer yeni, isteğe bağlı bir `stance` alanında gelir. Yeni istemci `stance ?? posture` okur.
- `escape`/`support` boolean'ları ve `clanPresence.supportOpen` gerçeği söyler (`supportOpen` her iki kabul eden duruşta true).
- Eski istemcinin gönderdiği `{escape, support}` gövdesi aynen kabul edilir.

## Ayna listesi (kural değişikliği burada yaşar)

| Yer | İş |
|---|---|
| `packages/rules/src/clanSupport.ts` | `ESCAPE_SUPPORT`, `postureFromToggles` (throw yok), `togglesOf`, `escapeAllowed`, yeni `supportAccepted(posture)` |
| `packages/rules/src/escape.ts` | `resolveRaid` destekli kaçış dalı, `escapeVerdict` yeni duruş, sonuçta kaçan destek yığınları |
| `apps/server/src/worker/handlers.ts` | Normal baskın: kaçışta dalgalar dokunulmadan kalır, D = 1, destek kaybı 0, rapor, bildirim |
| `apps/server/src/services/clanWarSettlement.ts` | Ortak savaş: aynı |
| `apps/server/src/services/clanSupport.ts`, `defenderLine.ts`, `clan.ts`, `defencePosture.ts`, `planetView.ts`, `intel.ts`, `planet.ts` | Kabul kontrolü, geçişler, katılım/ayrılma/el değiştirme varsayılanları, görünümler, probe |
| `apps/server/src/db/schema.ts` + migration | İki CHECK kısıtına yeni değer; mevcut klan üyelerinin `ESCAPE` dünyaları → `ESCAPE_SUPPORT` |
| Bot muhakemesi, `packages/sim` | Kaçış hükmü/duruş okuyucuları yeni duruşu bilir (uzun simülasyon çalıştırılmaz) |
| `apps/web` | Şemalar (`stance`), duruş anahtarları, `EscapeReadout`, `useTargetReading`/`ForceRuler`/LaunchSheet, rapor görünümü, `GallerySupport` |
| 6 dil (`tr, en, de, es, fr, ja`), Wiki `clan-and-season.ts` | Yeni duruş, birlikte kaçış, yakıt satırı, destekçi bildirimi; bot ifadesi yok |
| `docs/game-design.md`, `docs/glossary.md` | Duruş ve kaçış bölümleri |

## Kabul ölçütleri (her biri bir test)

Kurallar:
1. Destek + `escape: true` artık throw etmez.
2. Ortak hat eşiğin (3×) altında → savaşılır, kaçış null.
3. Ortak hat ≥ 3× ve DECISIVE → `ESCAPED`; sonuçta yalnız ev sahibi yığını (kara silahları); kaçan destek yığınları sonuçta listelenir.
4. Eşik ortak güçle ölçülür: saldıran ortak hattın 3 katıysa kaçılır, ev sahibinin tek başına 3 katı olması yetmez.
5. Ev sahibi tek başına ≥ 3× olurdu, destek oranı 3× altına indirir → savaşılır (F1-K5).
6. Yakıt = yalnız ev sahibinin kaçan gemileri; destek yakıt eklemez.
7. Ev sahibinin kaçan gemisi yok, yalnız destek + silahlar → yakıt 0, kaçış olur.
8. Depo yetmez → `STRANDED`, sonuçta ev sahibi ve bütün destek yığınları savaşmış.
9. 5 savaş gemisi alt sınırı ortak hat üzerinden sayılır.
10. Desteksiz savaş ve `SUPPORT`/`HOLD` savaşı bugünkü sonuçla bit düzeyinde aynı (aynı seed).
11. `postureFromToggles` 4 kombinasyon, `togglesOf` ters dönüşüm, `escapeAllowed` ve `supportAccepted` tabloları, `escapeVerdict` `ESCAPE_SUPPORT` = `ESCAPE`.

Sunucu:
12. `ESCAPE_SUPPORT` dünyasına destek gönderilebilir; `ESCAPE`/`HOLD` dünyasına `CLAN_SUPPORT_CLOSED`.
13. Kaçışta dalgalar STATIONED kalır, gemi/hasar/expiry değişmez; destekçiye `clan_support_lifted`, `clan_support_result` gitmez.
14. Kaçışta D = 1, destek kaybı 0, ev sahibinin Dominion'u yalnız silahların savaşından; ortak savaşta da aynı.
15. Yakıt yalnız ev sahibinin deposundan, kaçan kendi gemileri kadar.
16. `STRANDED` → bütün hat savaşır, mevcut destekli savaş yolu.
17. Duruş geçişleri: kabul → kabul etmeyen `HOST_CLOSED`; `SUPPORT` ↔ `ESCAPE_SUPPORT` dalgalara dokunmaz; klansız `support: true` → `NOT_IN_CLAN`; `POSTURE_CONFLICT` artık yok.
18. Yeni dünya `ESCAPE_SUPPORT` saklanır; klan dışında görünüm `ESCAPE` + destek kilitli, klan içinde `ESCAPE_SUPPORT` + kapı açık; ayrılınca `SUPPORT` → `ESCAPE_SUPPORT` + bildirim, `ESCAPE_SUPPORT` sessiz; el değiştirmede `ESCAPE_SUPPORT`.
19. Migration 0247: bütün `ESCAPE` dünyaları `ESCAPE_SUPPORT`, `SUPPORT`/`HOLD` değişmez; bot ve insan aynı; `notification_kind` + `clan_support_lifted`; iki CHECK kısıtı dört değer.
20. Uyumluluk: `posture` alanları `ESCAPE_SUPPORT` için `ESCAPE`, `stance` kesin değer; `supportOpen` doğru; eski gövde kabul.
21. Probe raporu etkili duruşu kesin kaydeder (klansız dünya `ESCAPE`, destek okuması yok) ve `/api/intel` onu gönderir.

Web:
22. Anahtarlar bağımsız; dört kombinasyon kaydedilir; metinler doğru duruşu anlatır.
23. Saldırı ekranı `ESCAPE_SUPPORT` hedefte hükmü destekli hat oranından verir; `SUPPORT`/`HOLD` "geri çekilmez".
24. Eski şekilli yanıt (`stance` yok) parse edilir.
25. 6 dilde anahtarlar eksiksiz (i18n testi).

Görsel: anahtarlar, `EscapeReadout`, saldırı ekranı notu ve rapor 350 × 812'de (DPR 2) `tools/visual.mjs` ve galeri görünümleriyle kontrol edilir.

## İnceleme (2026-11-10)

Teslimden sonraki inceleme dört eksik buldu; hepsi testle kapatıldı:

26. Savun sekmesindeki 5 gemi alt sınırı, savaş gibi ortak hatta sayılır (`EscapeReadout` nöbetteki dalgaların gemilerini alır); kendi gemisi olmayan ev sahibinde de satır görünür.
27. Savaş simülatörü müttefik kanadı ev sahibiyle birlikte değerlendirip kaldırır; kanat eklemek otomatik geri çekilmeyi kapatmaz. "N gemi çekildi" satırı kanatları da sayar.
28. `/api/intel` duruş, `stance` ve destek okumasını gönderir (route düzeyinde test).
29. `wiki/guides.ts` ve geri çekilme makalesindeki "iki duruş birlikte açık olamaz" metni güncellendi.

Bilerek açık bırakılanlar:
- Kaydedilmiş savaş tekrarı yalnız ev sahibinin kaçan gemilerini taşır. Destek bileşimini saldırana göstermek yeni bir istihbarat kararıdır; owner'a sorulmadan eklenmedi.
- Migration 0247, `ESCAPE`'i bilerek seçmiş oyuncuyu da `ESCAPE_SUPPORT` yapar (owner: "mevcutlar da"); iki durum veride ayırt edilemez.
- Eski worker `ESCAPE_SUPPORT`'u kaçışsız okur: migration'dan önce bütün API ve worker'lar durdurulmalıdır (`deploy.sh` bunu yapar).
