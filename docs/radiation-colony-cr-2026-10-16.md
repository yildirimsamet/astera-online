# Koloni radyasyon yükü CR — 2026-10-16

Kapsam: son eklenen L1/L2/L3 sadakat ve arıza yükü, ilgili üretim/fırlatma açıklamaları, bildirim ve rapor. Diğer yerel çalışmaların değişiklikleri kapsam dışı; master üzerinde çalışılıyor.

## Doğrulama yaklaşımı

- Gerçek DB ve servislerle aynı isabetten gelen CORE_OUTAGE → Aegis kapanışı → onarım iptali/iadesi → tek isabet bildirimi zinciri.
- Sadakat sıfırında geciken kopuş işleyicisi; araya giren gezegen okumasının koloniyi yeniden canlandırmaması.
- Koruma/önleme, tekrar teslim, eşzamanlı isabet, mevcut arıza havuzu, hedef sahipliği, Aegis dozu ve rapor gizliliği.
- Arıza eşiğinin (hedef koloni Çekirdek 6) bomba üretim eşiğiyle (fırlatan gezegen Çekirdek 13) karıştırılmaması.

Henüz doğrulanmayan varsayımlar bulgu olarak sunulmayacak. Başarısız testle doğrulanan hatalar önce kaydedilip sonra düzeltilecek.

## Doğrulanan bulgu — P2

Çekirdek arızası `refreshPlanetAegis → beginPlanetRadiationBoundary` içinde onarımları iptal edip iade eder. İsabetin sonraki `cancelRepairsForRadiation` çağrısı artık iş bulamaz; bildirime iptal sayısı/iade yazılmaz. Gerçek L2 isabeti + Aegis 18 + tek uygun CORE_OUTAGE + ödenmiş onarım ile yeniden üretildi. İşin CANCELLED olması doğrulandı; tek isabet bildirimindeki `repairsCancelled: 1` ve fatura tutarı beklentisi başarısız oldu. Düzeltme: arıza yan etkisinin onarım makbuzunu çağırana döndürmek; sonraki boş iptal çağrısının bu makbuzu silmemesi. Yeni SQL sorgusu veya ek bildirim eklenmez.

## Hata olmadığı doğrulanan şüphe

L1/L2/L3 ile tam sıfırlanan, arızasız kolonide kopuş 1 dakika geç işlenirken araya `loadLocked` girse de sadakat sıfırda kalıyor ve mevcut işleyici koloniyi tarafsızlaştırıyor. Üç test geçti. `advanceLoyalty` zaten sıfırı terminal kabul ediyor; bu yol değiştirilmedi.

## Düzeltmenin kapsamı ve risk kontrolü

- `beginPlanetRadiationBoundary` ve `refreshPlanetAegis` zaten üretilen iptal/iade makbuzunu döndürüyor. Mevcut çağıranlar aynı yan etkileri almaya devam ediyor.
- `breakFaults` mevcut çağıranlarına aynı `FaultKind[]` sözleşmesini koruyor. `breakFaultsWithEffects` radyasyon isabetine arızalarla birlikte onarım sonucunu veriyor.
- İsabet içindeki ikinci iptal çağrısı boşsa ilk makbuz korunuyor. Kaynak iadesi tekrar çalıştırılmıyor; arıza isimleri yalnız savunucuda ve tek isabet bildiriminde kalıyor.
- Yeni sorgu, tablo, zamanlayıcı veya bildirim eklenmedi. Ek işlem yalnız mevcut sonucu taşımak; diğer yerel değişiklikler geri alınmadı.

## İncelenen diğer sınırlar

Koruma/önleme kontrolü yükten önce, terminal uçuş kontrolü işlem kilidi altında. Ana gezegen, tarafsız gezegen ve anıt koloni yüküne girmiyor. Arıza seçim havuzu aktif arızaları ve arıza korumasını dikkate alıyor. Rapor yalnız okuyanın isabet makbuzunu alıyor; sonradan hedefi alan oyuncuya özel arıza bilgisi verilmez. Geciken isabette ekonomi saati geri alınmaz; radyasyon sınırı ayrı tutulur. Bu noktalarda yeni doğrulanmış hata bulunmadı.

## Son doğrulama

- Kırmızı test: `/tmp/radiation-colony-cr-confirm.log` — 23 geçti, iade makbuzu testi beklenen nedenle başarısız oldu.
- Düzeltme sonrası: `/tmp/radiation-colony-cr-green.log` — 5 dosya / 100 test geçti. Koloni yükü (24), evde radyasyon/onarımlar (22), arıza saldırıları (23), Ölüm Yıldızı sadakati (22), Aegis (9).
- Server TypeScript: `/tmp/radiation-colony-cr-typecheck.log` — geçti.
- Değiştirilen 5 kod/test dosyası: `/tmp/radiation-colony-cr-lint.log` — 0 hata, 0 uyarı. `git diff --check` temiz.
- Bu düzeltmede UI yerleşimi ve metinler değişmedi; mevcut bildirimin zaten desteklediği iptal/iade alanı doğru dolduruldu. Önceki görsel kanıtlar geçerlidir.

Sonuç: bu CR kapsamındaki bir P2 hata doğrulanıp düzeltildi. Diğer incelenen senaryolarda yeni doğrulanmış hata yok. Tüm depo testleri bu CR'de yeniden çalıştırılmadı; değişen arıza/radyasyon yolunun 100 testi ve server tip/lint kontrolleri çalıştırıldı. Canlıya deploy yapılmadı.
