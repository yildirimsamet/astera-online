# Anıt varışı ve yolda kontrol değişimi — 2026-10-15

## Sahip kararı

Anıt yolda kaç kez el değiştirirse değiştirsin filo geri dönmez. Varışta hedefin
o anki durumu, gönderim amacından (`ATTACK`/`REINFORCE`) bağımsız olarak sonucu belirler:

| Varıştaki durum | Sonuç |
| --- | --- |
| Kendi tarafın tutuyor | HOLD'a girer; kapasiteye sığmayan gemiler `CAPACITY` ile döner |
| Rakip filo tutuyor | Savaş (normal PvP: Hâkimiyet, yağma, rapor) |
| Tarafsız garnizon var (24 saatte geri gelmiş olabilir) | Garnizonla savaş |
| Boş | Savaşabilen gemi varsa ele geçirir; yalnız kargo ele geçiremez ve `DEFEAT` ile döner |

## Eski davranış ve kök neden

`advanceLockedMonument`, dost olmayan bir anıta varan `REINFORCE` dalgasını
`CONTROL_CHANGED` ile eve döndürüyordu. Son tutucu çekilince `beginMonumentReturn`
kontrolü siliyor. Bu yüzden klan arkadaşı anıttan çıkınca yoldaki takviye eve dönüyordu.
`ATTACK` için böyle bir dönüş yoktu: dost olmuş anıta katılıyor, el değiştirmiş anıtta savaşıyordu.

## Aynı incelemede düzeltilenler

- Yeni tutucular, artık düşman olan yoldaki takviye dalgaları için de `monument_inbound` uyarısı alır.
- Zaten boş anıta ele geçiremeyen bir filo (yalnız kargo veya bakım sınırındaki gemiler)
  vardığında `emptySince` sıfırlanmaz; tarafsız garnizonun 24 saatlik dönüşü ertelenmez.
- Boş anıtı ele geçirme bildiriminde ve raporunda rakip olarak "Tarafsız garnizon" yazılmaz.
- Honor açılışı yoldaki bütün anıt dalgalarını (takviye dahil) eski kaynak sayar. Aksi hâlde
  açılıştan önce kalkan takviye artık savaşabildiği için "Missing Honor monument commitment"
  hatasıyla varış işlemini kilitlerdi.
- Anıt ekranındaki yoldaki filo kartı, varıştaki sonucu şimdiki duruma göre söyler; dost gönderim
  önizlemesi kontrol değişse bile filonun dönmeyeceğini açıklar.

## Değişmeyenler

- `MEMBERSHIP`: oyuncu klandan ayrılır, atılır veya klan dağılırsa o oyuncunun yoldaki/anıttaki
  dalgaları yine döner. Bu, anıtın değil oyuncunun kendi tarafının değişmesidir.
- Gönderim kuralları (tier, dost kapasite rezervasyonu, kalkan, `MONUMENT_FRIENDLY_FIRE`) aynıdır.
- `CONTROL_CHANGED` yeni dönüş üretmez; eski kayıtlar ve bildirimler için enum ve metinleri durur.
- Varışta eski klan arkadaşı ateşkesi yeniden kontrol edilmez. Saldırı dalgası için de durum aynıydı.

## Testler

`monument-arrival.test.ts` (rakip/garnizon/boş varış, gerçek recall ile boşalan anıt, kargo ve
garnizon saati, yeni tutucu uyarısı, rapor rakipleri), `honor-monument.test.ts` (açılış öncesi/sonrası
takviye savaşı), `apps/web/test/monument-sheet.test.tsx` (varış sonucu satırı ve dost gönderim kuralı).
