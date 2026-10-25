# Atış başına on hedef ve sınıf önceliği

Kullanıcı 25 Ekim 2026'da her atışın en fazla 10 farklı rastgele hedef seçmesini,
daha yüksek sınıf çarpanıyla vurabildiği hedeflere öncelik vermesini istedi.
Yük gemisi/Hurdacı koruması korunacak. Yetki yerel uygulamadır; yayın yapılmaz.

## Uygulanacak sözleşme

- Her iki taraf, mobil gemiler ve yer topları aynı ortak seçiciyi kullanır.
- Önce silahlı hedef havuzu; yalnız bu havuz bittiğinde SUPPORT havuzu.
- Seçim önceliği sınıf çarpanı 1,6 → 1 → 0,625. Aynı öncelikte seçim
  yerine koymadan rastgeledir; gemi canı, araştırması veya sahibi ek öncelik yaratmaz.
- Tek atış boyunca en fazla 10 **farklı** hedef. Aynı hedefin taşmadan tekrar
  pay alması yeni hedef sayılmaz. Sonraki gemi kendi yeni hedeflerini seçer.
- Fazla hasar önce seçilmiş yaşayan hedeflere aktarılır. Seçilmiş bütün
  silahlılar öldüğünde diğer silahlılar varsa kargoya geçilmez. Bütün silahlılar
  öldüyse, 10 hedef sınırında kalan yer kadar kargo/Hurdacı seçilebilir.
- 10 hedefin tümü öldüyse fazlalık kullanılmamış atış hasarıdır; on birinci
  hedefe aktarılmaz. Seçilmemiş birlikler sonraki atışlarda hedef olabilir.
- Eşzamanlı ateş hakkı, altı tur, Aegis ve kişisel kalkan sırası, araştırma,
  tur sonu kaçış, sahiplik, kurtarma ve kalıcı yaralar değiştirilmez.
- Eski kayıtların açıklaması değişmez. Yeni turlar hedef sınırını kaydeder.

## TDD kapsamı ve etki

Önce başarısız kurallar testleri: 0/1/9/10/11/200 hedef, aynı sınıfta rastgele
seçim, avantajlı sınıfın önce doldurulması, ölü/kaçan hedeflerin dışlanması,
yer topları, aynı hedefin taşması, 10 hedefin ölmesi, korunan SUPPORT, kalan
kontenjanla aynı atışta kargoya geçiş, bütçe ve kimlik korunumu.

`randomBattle.ts` ve `constants.ts` hesaplamayı, `combat.ts` yeni tur bilgisini
taşır. `resolveBattle`, raid, solo/joint/support, NPC ve anıt ortak motoru
çağırır. Simülatörün ayrıca hedef hesaplaması yoktur. API/rapor ve altı dilde
kural açıklamaları yeni işareti aktarır. Eski üç tur yolu ve tarihî deney
kanıtları korunur; önceki tüm-hedef kalibrasyonu yeni kuralın altın sonucu değildir.

Söndürücü/Aegis'in global bonus önceliğindeki ayrı sapma bu değişiklikle
örtülü olarak düzeltilmez; karşılaştırma raporunda ayrıca açıklanır.
