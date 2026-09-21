# Klan Ortak Savaşı — Post-change checkpoint

Tarih: 2026-09-21

## Baseline ve kapsam

Bu feature için ilk ürün değişikliğinden önce alınmış Phase 0 test çıktısı yoktu. Artık
geriye dönük bir pre-change baseline üretilemez. Bu kayıttaki hiçbir failure
"önceden vardı" diye sınıflandırılmaz. `clan-joint-war-implementation-issues.md`
dosyasındaki 18 Phase 0–7 bulgusu kod/test değişiklikleri ve aşağıdaki doğrulamayla
ele alındı. Bu checkpoint değişiklik sonrası durumu gösterir.

Phase 8–11 geliştirme ardından ayrı code review yapıldı:

| Phase | Review sonucu ve düzeltme |
|---|---|
| 8 · Settlement | Lider başkentinden katılan filonun dönüş yolu ve savaş dönüşü bildiriminin yanlış `recalled` etiketi gerçek bug olarak doğrulandı; önce başarısız regresyon testleri, sonra düzeltmeler yapıldı. Loot, casualty, Dominion sıfır toplamı, rapor ve final return yeniden sınandı. |
| 9 · Reports/traffic | Erişim, fog, radar ve frozen clan identity testleri incelendi; yeni doğrulanmış bug çıkmadı. |
| 10 · Web | Mutation cevabındaki güncel war/traffic state'inin cache'e işlenmemesi regresyon testiyle doğrulanıp düzeltildi. Canlı 350 px quote'ta ham yakıt bacağı kodları ve çakışan sekme etiketleri görüldü; rota adları ve kısa mobil sekme etiketleri beş dile eklendi, ekran okuyucu adları tam bırakıldı ve tekrar fotoğraflandı. |
| 11 · Lifecycle | Abandon, reclaim, account deletion, season freeze/wipe ve son dönüş state'leri yeniden incelendi; yeni doğrulanmış bug çıkmadı. |

Phase 12'de `game-design.md`, `architecture.md`, `balance.md`, `battle-reports.md`,
`interface.md` ve `glossary.md` ortak savaşın güncel kurallarıyla yenilendi.
Hafif web i18n kontrolünde çıkan iki metin uyumsuzluğu da kapatıldı: Türkçe araştırma
gereksinimi çevrildi; Ölüm Yıldızı açıklaması ve testi kodun güncel bir saatlik EMP,
üretimin sürmesi ve sahipliğin değişmemesi davranışına uyarlandı.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Rules: clan-war, combat, fuel, hangar | 157/157 geçti |
| Server: clan-treasury ve altı clan-war grubu | 200/200 geçti |
| Web: joint war, clan, fog, report, i18n | 129/129 geçti |
| Web: notification routes ve signals | 66/66 geçti |
| Workspace typecheck | Geçti |
| Workspace lint | Geçti |
| `git diff --check` | Geçti |

`pnpm verify` ile bütün depo testleri ve ekonomi/snowball simülasyonları çalıştırılmadı;
bu çalışmayla ilgisiz ağır testleri atlama isteğine uygun olarak etkilenen paketlerin
hedefli testleri çalıştırıldı. Genel `tools/visual.mjs` yeni hesap açıp tüm galaksi
sahnesini gezer; bu feature için gerçek hesap, gerçek API ve 350 px Chrome ile
Clan/War/quote akışı doğrudan görüntülendi.

Canlı testin önceden yazılmış adımları ve sonuçları
[`clan-joint-war-manual-test-plan.md`](clan-joint-war-manual-test-plan.md) içinde.
`out/clan-joint-war/09-war-quote-tr-fixed.png` rota adlarını;
`10-clan-tabs-tr.png` ve `10-clan-tabs-es.png` son mobil sekmeleri gösterir. Beş dilin
tamamında tüm sekmeler 350 px içine sığdı ve sayfa genişliği 350 px kaldı. Radar L5 bildirimi
fixture zamanlaması yüzünden canlı oturumda gözlenmedi; hedefli entegrasyon testi
zamanlamayı ve gizliliği kapsıyor.

Local geliştirici veritabanında iki yeni galaksi açık; EU-1'de sekiz bot ve dört
manuel test hesabı var. Görsel doğrulama için açılan ikinci boş operasyon normal
cancel API'siyle `COMPLETED/LEADER_CANCEL` durumuna kapatıldı. Geçici hazırlık
scriptleri kaldırıldı; API/web geliştirme süreçleri durduruldu.
