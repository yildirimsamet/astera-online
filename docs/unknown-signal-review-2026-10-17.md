# Bilinmeyen sinyal — uygulama incelemesi

Kapsam: `unknown-signal-plan-2026-10-17.md`, saf kurallar, additive migration,
sunucu işlemleri, zamanlama, kişisel yayınlar, istemci, altı dil, Wiki ve görseller.
İzlenen sıra: incele → testle/ölçümle doğrula → düzelt → regresyonu tekrar çalıştır.

## Doğrulanan ve giderilen bulgular

| Bulgu | Doğrulama ve sonuç |
| --- | --- |
| Oyuncu kilidinin gezegenden önce alınması normal emirle deadlock oluşturabilirdi. | Gerçek PostgreSQL bekleme testiyle doğrulandı. Sinyal akışı sezon → sıralı gezegenler → oyuncu → görev sırasını kullanıyor. |
| T4 koloni kaybedilirse sonraki spawn mevcut düşük Core'u okuyup zinciri sürdürebilirdi. | Core yükseltme ve ele geçirme için iki kırmızı test. T4'e ulaşılan anda kalıcı durdurma eklendi; açık sinyal korunuyor. İki test yeşil. |
| Yeni T4 durdurma kaydı Core tamamlanmasında oyuncudan önce schedule kilidi alıyordu. | PostgreSQL NOWAIT regresyonu kırmızı oldu. Durdurma artık önce oyuncu kilidini alıyor; test yeşil. Schedule yardımcıları döngüsel servis bağımlılığını büyütmemek için ayrı dosyada. |
| Tatili bitirmiş oyuncuya, tatil içindeki gecikmiş spawn çıkabiliyordu; mevcut tatilden önceki geçerli spawn ise atlanıyordu. | İki karşıt zaman çizgisi kırmızıyla doğrulandı. Kontrol mevcut bayrak yerine olayın dueAt anını gerçek tatil geçmişiyle karşılaştırıyor. İki test yeşil. |
| Ele geçirilen kalkış kolonisinin dönüş radyasyonu eski rotadan hesaplanıyordu. | Başkent rotasındaki ölüm testi. Dönüşte gerçek güvenli hedef kullanılıyor. |
| Tarafsız olmuş kalkış kolonisi varışı kilitleyebiliyordu. | Normal colony-neutral regresyonu. Varış dönüş hedefini de `safeHomePlanet` ile seçiyor. |
| Görev başkente yönlenirken istemci rotası eski koloniyi gösterebiliyor, yeni koloni sahibinin yuvası dolu sayılabiliyordu. | Pending-path ve bay ownership testleri kırmızı oldu. Özel okuma gerçek dönüş hedefini taşıyor; yuva eski görev sahibine ait kalıyor. |
| Recall süresi radyasyondan sağ kalan daha hızlı filoyu kullanmıyordu. | Yavaş savaş gemisi kaybolup yalnız Kurye kaldığında süre testi. Dönüş standart seyahat hesabından türetiliyor. |
| Gecikmiş ENERGY varışı, önceden tick edilmiş üretimde kazanılmış bonusu kaybediyordu. | Normal, mevcut pencere, disruption ve dolu collector için karşılaştırmalı dört test kırmızı oldu. Yalnız eksik üretken bonus aralığı, cap ve tempo korunarak ödeniyor. |
| Radyasyondan sonra görev kaydında eski filo listesi kalıyordu. | OUT/HOME roster regresyonları. Kaybolan gemiler görev kaydından ve özel okumadan düşüyor. |
| Kurye kaybı veya ödül gemisinin dönüşte yok olması arayüzde “yolda/teslim edildi” diye gösterilebiliyordu. | Ayrı kaynak ve derelict kart testleri kırmızı oldu. Gerçek dönüş filosuna göre kayıp metni gösteriliyor. Başlangıçtaki normal hasar, kayıp sayılmıyor. |
| Korsan patlaması soğuk asset yüklemesine takılabilirdi. | Outbound-prewarm regresyonu kırmızı oldu. Mevcut patlama kaynakları kalkışta hazırlanıyor; açık sinyalde gereksiz yükleme yok. |
| Reclaim, hesap silme ve Silent Space taşıması sinyal görevi/zamanlamasını tanımıyordu. | Aktif görev, eksik parked units ve sessiz oyuncu temizliği testleri. Uçuş açık blocker; eski açık sinyal kapanıyor, eski eventler temizleniyor, durmuş T4 zinciri yeniden açılmıyor. |
| Özel spawn olayı istemci verisini yenilemiyor; filo etiketi ham ID gösteriyor; recall genel mission API'sine gidiyordu. | Query, SSE, lokalize uçuş ve API manifest/idempotency testleri. Kişisel cache ve native signal yolu bağlandı. |
| Skin adı çeviri anahtarı gösterebiliyordu; recovery içindeki gezegenden istemci kalkış önerebiliyordu. | Gerçek kozmetik adı ve kalkış engeli testleri kırmızı oldu. Mevcut katalog/gezegen kontrolleri kullanılıyor. |
| Sinyal simgesi, alt etiketin yüksekliği nedeniyle rota ucundan yukarı kayıyordu. | Kullanıcı görüntüsü ve gerçek DOM ölçümü: işaret merkezi ile projekte nokta eşitliği önce başarısızdı. Etiket merkez geometrisinden çıkarıldı; kontrol geçti. Gerçek OwnFleets rotasıyla 350 px görüntü alındı. |

## Son kullanıcı yönlendirmeleri

17 Ekim: gönderim sonrası pencerede geri çağırma düğmesi kaldırıldı. Sinyal
penceresinin radar yönlendirme düğmesi kaldırıldı; radarın uzak sinyalleri ve
saldırıya gelen filoları algılama işlevi açıklayıcı kartta anlatılıyor. Normal
uçuş listesindeki geri çağırma yeteneği korunuyor. Bu değişiklikler ilk plandaki
radar ekranına düğme şartının yerini alır.

`signaltest` hesabındaki bildirilen menzil şüphesi sunucudan ölçüldü: kurulu
radar yok, planın seviye 1 yedeği 2700 birim, sinyal uzaklığı 2604.4126 birim.
Sinyal bu sınırın içinde. Radar 0 açıklaması altı dilde gerçek yedek menzili
söyleyecek biçimde düzeltildi. Menzil sayısı mekanik değişikliğiyle küçültülmedi.

## İncelenen ek sınırlar

- Kaynakların yedi alt kümesi, 1000 toplam/100 döteryum sınırı ve yuvarlamalar;
  sonuç/gemi tier/skin dağılımları, determinizm, T4 ve specialist dışlama.
- Bir açık sinyal DB garantisi; yinelenen olaylar; çift dispatch, expiry/send ve
  recall/arrival yarışları; idempotent tekrar; çevrimdışı birikmeme.
- Sunucuya özel HMAC seed; foreign/anonymous/malformed istekler; sahte ödül
  alanlarının reddi; public galaxy byte eşitliği; owner-only yayınlar; prod dev 404.
- Beş sonucun doğru teslim zamanı; yarışan skin satın alma unique beklemesi;
  tüm havuz sahipliyken aynı seed kaynak ödülü; tamamen ölen gidişte sonuç yok.
- T1 komutana araştırmasız T3 gemi, dolu Hangar, normal tamir maliyeti,
  builtEver değişmemesi; ödül gemisinin dönüş radyasyonuyla kaybolması.
- Collector cap, üretken dakika, recovery ×2.5, üst üste enerji max deadline,
  tatil kaydırması, sezon kapanışı, gecikmiş görev/eksik event onarımı.
- Bildirimden eski sonuca ulaşma, UUID sınırı, dinleyici temizliği, kişisel
  invalidation, ortak üretim projeksiyonu, altı dil ve Wiki metinleri.

## Doğrulama durumu

- Son sinyal+bildirim sunucu koşusu: **84/84**; ardından ek ödül gemisi
  radyasyon regresyonu **1/1** geçti. Sinyal dosyası şimdi 66 test içeriyor.
- Son hedefli web koşusu: **6 dosya, 97/97**.
- Önceki API sözleşme koşusu: **102/102**.
- İşaret geometrisi/rota ve düğmesiz gönderim sonrası pencere 350×812 DPR2
  tarayıcı kontrolünden geçti: `out/unknown-signal-route-review/`.
- Final bütün çalışma alanları typecheck, üç lint grubu ve tam normal testler
  sırada. Altı dil × telefon/masaüstü tam görsel koşusu henüz tamamlanmadı.

Başka oturumun Honor değişiklikleri korunuyor. Kısa hedefli testlerin başka
oturumun koşusuyla eşzamanlı çalışması için kullanıcı açık izin verdi; kapsamlı
kapılar yine seri bekletiliyor. Uzun ekonomi/sezon simülasyonu, commit veya
deploy yapılmadı. Ana oyun veritabanına dokunulmadı; manuel deneme ayrı
`astera_unknown_signal_visual_test`, otomatik sunucu testleri ayrı
`astera_unknown_signal_test` veritabanını kullanıyor.
