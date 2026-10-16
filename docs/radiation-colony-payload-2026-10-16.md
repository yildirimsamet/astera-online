# Radyasyon bombası koloni etkisi — 2026-10-16

İstenen: başarılı L1/L2/L3 isabetinde koloniden sırasıyla 5/10/15 sadakat puanı düşer; en fazla 0/1/2 yeni rastgele arıza oluşur. Ana gezegen, tarafsız gezegen ve anıtta bu ek etkiler yoktur. Radyasyon hasarı, süre, maliyet ve Honor hesabı değişmez.

Ölüm Yıldızı'nın mevcut yolu kullanılacak: güncel sadakat, sıfırda mevcut kopuş olayı; arıza için `breakFaults` STRIKE havuzu. Çekirdek seviyesi, arıza koruması, kurulmamış döteryum tesisi ve mevcut arızalar aynı kurallara tabidir. Sadakati sıfırlayan isabette yeni arıza oluşturulmaz. Aegis yalnız radyasyon HP hasarını azaltır; sadakat/arıza yükünü engellemez.

Kontroller: üç seviye, sıfır sınırı, peş peşe/eşzamanlı isabet, tekrar teslim, uçuşta sahip değişimi, sonradan saldırı koruması, önleme, arıza havuzunun dolu/kısmen dolu olması, genç/arıza korumalı koloni, ana gezegen/tarafsız/anıt, Aegis'in tüm radyasyonu engellemesi, tembel sadakat ve geç işlenen olayda saat geri almama.

Dokunulacak yerler: ortak bomba kataloğu, atomik isabet işlemi, üretim/fırlatma açıklamaları, mevcut tek isabet bildirimi ve altı dil. Arıza isimleri yalnız savunucuya gösterilir; ayrı arıza bildirimi üretilmez. Sadakat sıfırda mevcut koloni kaybı bildirimi korunur. Riskli bağımlılıklar: kopuş/filo tahliyesi, arıza kaynaklı Aegis/sensör/üretim değişimi, onarım iptali, sezon sınırı, Honor ve idempotans. Bu yolların mevcut servisleri yeniden kullanılacak; yeni arıza veya sahiplik sistemi kurulmayacak.

## Doğrulama

- TDD: yeni mekanikler önce kırmızı testlerle doğrulandı; uygulama sonrası yeşil.
- Ortak kurallar: 134 dosya / 2.360 test geçti.
- Radyasyon/arıza/Ölüm Yıldızı/Aegis/Honor regresyonu: 30 dosyada, henüz uygulanmamış rapor alanını yakalayan yeni test hariç 312 test geçti. Rapor düzeltmesi sonrası ilgili 5 dosyada 80 test geçti (20 koloni testi dahil).
- Arayüz/bildirim/rapor/Wiki/çeviri: 5 dosyada 209 test geçti.
- Rules/server/web tip kontrolleri geçti. Değişiklik kapsamındaki 20 dosya lint: 0 hata, 0 uyarı.
- 350 px Türkçe üretim kartları görsel olarak incelendi: sadakat/arıza satırı okunur, stok ve seviye ayrımı korunuyor.
- Altı dilde 350/1280 px: 24 üretim/savunma ve 48 fırlatma/rapor kontrolü geçti. Yeni kartlar, sadakat sonuçları ve arıza isimleri taşmıyor; tercüme anahtarı sızmıyor. Önceden bilinen Fransızca kara savunması başlık taşması bu değişiklik kapsamı dışındadır. Ekran görüntüleri: `/tmp/astera-radiation-colony-production-20261016` ve `/tmp/astera-radiation-colony-20261016`.
- Canlıya dağıtım ve sezon sıfırlama yapılmadı; master üzerinde çalışıldı. Yerel API güncel kodla 3100 portunda çalışıyor; sağlık kontrolünde veritabanı sağlıklı, başarısız olay/stratejik olay ve sahipsiz uçuş sayıları sıfır.


## Uygulama ve verimlilik

İsabet, hedef/füze kilitleri altında tek atomik işlemde uygulanır. Tekrar teslim terminal uçuşa dokunmaz. Gecikmiş işleme, gözlenmiş ekonomi saatini geri almaz; radyasyonun gerçek varış ve bitiş zamanı ayrı korunur. Kaynak, arıza kaynaklı Aegis değişimi işlenmeden önce yazılır; böylece Aegis arızası geç işlenen isabetin önceki radyasyon dozunu atlamaz.

Üretim kartında ve gezegene fırlatma onayında seviye bazında sadakat/azami arıza gösterilir. Altı dilde açıklamalar, isabet bildirimi ve İngilizce/Türkçe Wiki güncellenir. Mevcut bildirim makbuzu rapora indeksli join ile taşınır; rapor okumasında hedefin güncel gizli arıza durumuna bakılmaz. Eski isabetlere geriye dönük ek hasar/sadakat/arıza uygulanmaz.

| Seviye | Alaşım / kristal / döteryum | Korumasız 30 dakikalık HP/gemi | Sadakat | Azami yeni arıza |
| --- | --- | --- | --- | --- |
| L1 | 30.000 / 20.000 / 2.000 | 270 | −5 | 0 |
| L2 | 40.000 / 28.000 / 2.500 | 375 | −10 | 1 |
| L3 | 50.000 / 35.000 / 3.000 | 540 | −15 | 2 |

Üç kaynağı eşit ağırlıkla toplayan basit ölçüde, L1'e göre HP/kaynak L2'de %2,44 ve L3'te %18,18 artar. Sadakat/kaynak ise sırasıyla %47,52 ve %77,27 artar. Kaynakların oyuncu için kıtlığı eşit değildir; bu oran tek bir ekonomik döviz kurunu iddia etmez. Honor değerlemesinin 1/2/32 ağırlıkları kullanılırsa HP/kaynak artışı %5,74 ve %24,07 olur. Ham hasar/üretim süresinde L3, L1 ile eşit; L2 yaklaşık %7,41 düşüktür. Aegis, araştırma, geminin hedefte kaldığı süre, kalan HP ve 50 HP/dk toplam sınırı gerçek verimi değiştirir. Arızaların ekonomik zararı sabit bir HP değerine çevrilmez.
