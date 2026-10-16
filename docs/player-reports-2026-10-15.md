# Oyuncu bildirimleri — 15 Ekim 2026

İnceleme, bu çalışma alanındaki kod ve ayrı test veritabanındaki senaryolara dayanır.
Oyuncunun canlı hesabı incelenmedi. Aşağıdaki teşhis, değişiklik öncesindeki durumu
anlatır. Sonraki oyuncu talebiyle 12 saatlik koloni arıza koruması uygulanmıştır;
[uygulama kapsamı](colony-fault-protection-2026-10-15.md). Döteryum konusu rapor kapsamındadır.

`git fetch origin` sonrasında yerel `master`, `origin/master` dalından 23 commit
önde ve 0 commit geride. Yerel uç `a08c5f27`, origin ucu `b8d6ed0e`.
Origin'deki `faults.ts` ve `buildQueue.ts` de ayrıca incelendi; orada da geliştirme
sonrası 12/24 saat erteleme yok. Bütün uzak dalların uçları yerel geçmişte mevcut.

## Döteryum Sentezi ve rafineri sınırı

**Doğrulandı: tamamlanmış araştırmaya yönlendiren arayüz hatası var.**

- Döteryum Sentezi en fazla **5 seviye**. Her seviye rafineri sınırına 3 seviye
  ekliyor; tam araştırmada sınır **15**. Çekirdek 18 olması bu ikinci sınırı kaldırmıyor.
- Rafineri kartı, araştırma seviyesinin en üstte olup olmadığını kontrol etmeden
  `plantRung` mesajını ve araştırmaya giden eylemi gösteriyor. Bu mesaj Türkçede
  “Bir kademe daha Döteryum Sentezi araştır”.
- Araştırma ekranındaki “Rafineri seviye sınırı 15” mevcut kuralla tutarlı.
  Araştırma zaten tamamlandığı için bu ekranda yapılabilecek bir sonraki seviye yok.
- Ayrı veritabanında Çekirdek 18 / Rafineri 16 / Sentez 5 durumu kuruldu.
  Rafineriyi yükseltmek `RESEARCH_CEILING { rung: 5, ceiling: 15 }`; sentezi yeniden
  araştırmak `RESEARCH_ALREADY_COMPLETE` döndürdü.
- Bildirilen mevcut rafineri seviyesi 16, bugünkü araştırma sınırını aşıyor.
  Oyuncunun bu seviyeye hangi sürümde veya işlemle ulaştığı canlı kayıt olmadan
  kesinleştirilemez. Mevcut 16 seviyesini otomatik düşürmek bu incelemenin sonucu değildir.

Önerilen düzeltme: sentez tamamlanmışsa kartta gerçek azami sınırı göster ve yeni
araştırma öneren eylemi kaldır. Rafineri 15 üzerini desteklemek isteniyorsa ayrıca
araştırma/progresyon kuralı kararı gerekir; yalnız mesajı düzeltmek 17. seviyeyi açmaz.

Kod: [araştırma sınırı](../packages/rules/src/research.ts),
[rafineri kartı](../apps/web/src/screens/PlanetScreen.tsx),
[sunucu geliştirme kontrolü](../apps/server/src/services/build.ts),
[araştırma kontrolü](../apps/server/src/services/research.ts).

## Kolonilerde geliştirmeyle arıza erteleme

**İlk incelemede doğrulandı: geliştirmeyle 12 veya 24 saat erteleme yoktu.**

- Arızalar yalnız Çekirdek 6 ve üzerindeki kolonilerde başlar.
- Geliştirme emri, oyuncunun ilerleme zamanını kaydeder. Bu kayıt Sessiz Uzay
  hareketsizlik kontrolü içindir; koloni arıza sayacını yenilemez.
- Çekirdek geliştirmesi tamamlandığında `armFaults` çağrılır. Bekleyen veya
  işlenen bir arıza olayı varsa fonksiyon hemen çıkar; mevcut zamanını ileri taşımaz.
  Diğer bina geliştirmeleri tamamlandığında bu çağrı bile yapılmaz.
- Ayrı veritabanında bekleyen arıza olayı olan bir koloniye rafineri geliştirmesi
  verildi. Olayın `resolveAt` değeri hem emirden hem tamamlanmadan sonra aynı kaldı.
- Yeni arıza aralığı rastgele seçiliyor: %30 olasılıkla ortalaması **25 dakika**
  olan kısa aralık; diğer kolda ortalama **12,7 saat**. Karışımın ortalaması yaklaşık
  **9 saat**; asgari aralık **1 dakika**. Bunların hiçbiri geliştirme sonrası koruma değildir.
- Koddaki **12 saat**, sekiz arızayla sadakat çöküşü ve arızasız sadakat toparlanması
  içindir. Arıza erteleme süresi değildir.
- Ağır saldırı yenilgisi de zamanlayıcıdan ayrı bir arıza kaynağıdır. İleride bir
  geliştirme koruması eklenecekse savaş kaynaklı arızaların kapsamı ayrıca belirlenmelidir.

Sonuç: “24 saat erteleme çalışmıyor” bildirimi, mevcut kodda böyle bir korumanın
uygulanmamasıyla açıklanıyor. Bu yalnız zaman gösterimi hatası değil; belirtilen
davranış isteniyorsa zamanlayıcıya ve olay işleyicisine kural eklenmesi gerekiyor.

Kod: [bina tamamlanması](../apps/server/src/services/buildQueue.ts),
[arıza zamanlayıcısı](../apps/server/src/services/faults.ts),
[rastgele aralık](../packages/rules/src/faults.ts),
[sabitler](../packages/rules/src/constants.ts),
[ilerleme kaydı](../apps/server/src/services/waitingRoom.ts).

Yerel kanıt: `out/player-reports-2026-10-15/diagnostic.ts` ve `diagnostic.log`.
Senaryo yalnız ayrı, silinebilir test veritabanında çalışır.
