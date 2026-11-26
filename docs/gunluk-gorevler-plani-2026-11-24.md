# Günlük görevler — plan ve durum (2026-11-24)

Owner isteği: günlük görevler (3 sonda gönder · Yarık'a gir · korsan avla · asteroit avla) ve günlük bedava Honor.
Owner cevapları (2026-11-24): her görevin kendi küçük ödülü ve 0,25 Honor'u olur, görev bitince alınır; gün 00:00 UTC'de yenilenir; sunucu mantığı + kompakt panel birlikte gelir.

## Yapılan (kodda, test edildi)

- **Kural:** `packages/rules/src/dailyQuests.ts` — dört görev, hedefler, UTC günü, ödül = başkentin saatlik üretiminin 0,25–0,5 saati (toplam 1,4 saat ≈ günün %6'sı). Yüzde 30'u kristal.
- **İlerleme sayılır, biriktirilmez** (`rewards.ts` ilkesi): sonda = `missions`, asteroit = `mining_runs` (ulaştı, geri çağrılmadı, enkaz değil), korsan = `battle_reports` (DECISIVE, gemi kaldı, korsan başına bir), Yarık = yeni `arena_ships.last_sortie_at`.
- **Yazılan tek şey ödül alma kaydı:** `daily_quest_claims (player, gün, görev)` birincil anahtarı ikinci ödemeyi imkânsız kılar. Göç `0265_daily_quests`.
- **API:** `GET /api/daily-quests`, `POST /api/daily-quests/claim`. Ödül başkentin deposuna girer (çalınabilir).
- **Arayüz:** Ödüller ekranında kompakt panel; "Git" düğmesi görevi yapılacak yere götürür (Yarık → komutan gemisi). Hediye simgesinin rozetine hazır görev sayısı eklendi.

## Honor (owner 2026-11-24)

**Karar:** her biten görev, ödülüyle birlikte **0,25 Honor** verir (`DAILY_QUEST_HONOR`, 250.000 mikro). Dört görev bir gün = 1 Honor; 60 günlük sezonda en çok 60 Honor. Görev bitince kaynak ve Honor aynı basışta alınır; "dört görevi bitir" kapısı yok.

**Yapıldı:** Honor talep satırına yazılır (`daily_quest_claims.honor_micros`, miktar sonradan değişse de geçmişi değiştirmez), panelde her satırda ve ödül bildiriminde görünür.

**Karar (owner 2026-11-24): A, normal Honor.** Görev Honor'u sıralamaya, podyuma, sezon sıra ödüllerine ve avantaj kademelerine savaş Honor'u gibi sayılır. Honor defteri (`honor_events`) yalnız savaş kanıtından hesaplanıp yeniden oynatılır; `honor_totals` her yerleşimde yeniden yazılır. Görev Honor'u bu yüzden defterin yanında, `honor_quest_totals` tablosunda (sezon + komutan, `honor_totals` gibi) durur; talep işleminde artar ve dört okuyucu (`readHonorPlayerPolicy`, `sealHonor`, galaksi sıralaması, `honorPodium`) onu defter toplamına ekler. Önce oyuncu satırında bir sütun denendi; incelemede komutan galaksi değiştirince (`commanderTransfer`) Honor'un onunla yeni sezona taşındığı görüldü, sezona bağlı tabloya geçildi. Talep satırlarını toplamak yerine sayaç tutuldu: sıralama okuması binlerce talep satırını toplamasın. Sıralanmış Honor'un olmadığı sezonda (Sessiz Uzay, kapanmış sezon) görev Honor vermez ve panel 0 yerine Honor'dan hiç söz etmez. Bilinen sonuçlar: yalnız görev yapan pasif oyuncu sezonda en çok 60 Honor biriktirir; eksi kademedeki oyuncu görevle cezasını silebilir; botlar görev talep etmediği için Honor'ları yalnız savaştan gelir. Değerlendirilen seçenekler:

| | Neye sayılır | Bedel |
| --- | --- | --- |
| **A. Her şeye (seçildi)** | Sıralama, podyum, sezon ödülleri, avantaj kademeleri | Dört okuyucu (galaksi sıralaması, podyum, sezon sıra ödülleri, avantaj) aynı toplamı okur. Pasif oyuncu yalnız görevle 60 Honor yapar |
| **B. Yalnız avantaj kademelerine** | Tamir/konvoy/ticaret oranları (±25, ±75 eşikleri) | Tek okuyucu (`readHonorPlayerPolicy`) değişir. Sıralama/podyum/sezon ödülü saf savaş kalır. Eksi kademedeki oyuncu görevle cezasını silebilir |
| **C. Hiçbirine** | Yalnız sayaç | Değersiz bir sayı; önerilmez |

Avantaj eşikleri: +25 ve +75 Honor (tamir %5/%10 ucuz, konvoy %15/%30 güçlü), −25 ve −100 (ters yönde ceza). Bir Ölüm Yıldızı kaybı ≈ 16 Honor (fiyat indiriminden sonra).

## Yarık erişimi

`ARENA_PILOTS` kaldırıldı (owner 2026-11-24): oturum açmış her hesap Yarık'a girer, "Yarık'a gir" görevi herkes için ulaşılabilir. Kaldırılan: env değişkeni, `admits` kapısı, kimlikteki `pilot` bayrağı ve `denied` yolu. Owner aynı gün tablonun da silinmesini onayladı ("Silelim"): `arena_pilots` tablosu (migration 0267 ile düşer), `services/arenaPilots.ts`, `GET/POST /api/admin/arena-pilots` ve eski testi kaldırıldı.

## Dikkat

- **Göç numarası:** başka bir oturum aynı anda `0265` alırsa çakışır; birleştirmeden önce `drizzle/meta/_journal.json` kontrol edilmeli.
- Deploy yapılmadı.
