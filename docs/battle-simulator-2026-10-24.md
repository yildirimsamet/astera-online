# Savaş simülatörü — 24 Ekim 2026

## Kapsam ve temel

Bağımsız worktree: `feature/battle-simulator-20261024`, temel `40e8c270`.
Altı tur, %25 temel gemi kalkanı, gemi bazında dağıtılan atışlar ve
mevcut kaçış tablosu bu temelde zaten uygulanmış. Dengeyi değiştirmiyoruz.
Gerçek filo, kaynak, rapor erişimi ve sunucu settlement akışları değişmez.

Oyuncu iki tarafın gemilerini, başlangıç canlarını, araştırmalarını; gezegen
savaşında Aegis seviyesini/doluluğunu, yer toplarını ve savunmanın çalışır
durumunu seçebilir. Ayrı sahiplerin araştırmaları ayrı tutulur. Aynı tohum
aynı savaşı verir. 3B sahne ve atış dökümü motorun aynı kaydını kullanır.

## Dokunulacak yerler ve doğruluk

- `packages/rules/src/randomBattle.ts`: isteğe bağlı ayrıntılı kayıt; mevcut
  aritmetik, RNG tüketimi ve sonuç alanları değişmeyecek.
- `combat.ts`: kayıt alıcısını ortak motora geçirir; eski kalkan kapalı
  tarihsel çözüm yolu korunur.
- Yeni kayıt tipleri: sabit savaş içi kimlik, sahip, giriş istatistikleri,
  her atışın her hedefe payı, yeniden dağıtım geçişi, Aegis/kişisel kalkan/
  gövde öncesi-sonrası, kullanılmayan bütçe, tur sonu kaçış ve durum.
- Web: ayrı ve tembel yüklenen simülatör girişi, sınırda Zod, Worker,
  iki taraf editörü, tekrar zaman çizelgesi, 3B sahne, altı dil.
- `tools/visual.mjs --battle-simulator`: gerçek tarayıcıda mobil ve masaüstü
  etkileşim, görüntü, hata ve GPU/yerleşim kontrolü.

Her mantık değişimi önce FAIL → uygulama → PASS. Kontroller sıralı,
tek Vitest worker ve `nice -n 10`; heap en çok 4 GiB. Uzun ekonomi/season
simülasyonları bu işin parçası değil.

## Kritik vakalar

Kayıt açık/kapalı ve aynı tohum paritesi; sahip ve kaynak/hedef kimliği;
Aegis'in bonus/normal hasarı ayrı emmesi; bonusun gövdeye taşmaması;
kişisel kalkan ve canın kesin korunması; yeniden dağıtımda bütçe;
aynı atışta ön hattan kargoya geçiş; tur içi ölenin tur başı ateş hakkı;
kaçanın sonraki tur ateş/hedef olmaması; son tur kaçış olmaması;
yer topunun kaçmaması; geri kazanımın savaş sonu olması; yaralı giriş;
EMP/devre dışı savunma; sıfır tur/boş hedef/kargo-only; ortak sahipler;
bozuk, kesirli, aşırı büyük girdiler; eski Worker yanıtının yeni sonucu
ezmemesi; duraklat/ileri/geri/hız/perspektif; görünmez sekme ve GPU hatası.

## Tasarım

Ana görsel gerçek gemilerle dikey savaş alanı. İzleyicinin tarafı altta.
Masaüstünde solda filo editörü, sağda atış dökümü; telefonda tek ayar çekmecesi,
saldıran/savunan sekmeleri. Sahne kontrolleri ve tur seçimi daima erişilebilir.
Astera tokenları: zemin #080d18, panel #0d1422, yazı #eef3ff,
kendi tarafı #2ee6c8, karşı taraf #ff4b4b, kalkan vurgusu soğuk mavi.
Archivo arayüz, IBM Plex Mono sayılar. Gemilerin kendi görünüm/ölçek/yönleri
korunur. Başlık ve ölçüler sol hizalı; sahne ana odak. Hareket vuruşun,
imhanın ve kaçışın sonucunu açıklar. Yer topları sabit mevzilerde durur.

Kalite ölçütü: kayıt oynatılınca her tur sonu motorun can/kalkan/durumuyla
eşleşir; son durum raporla aynıdır. 350×812 mobilde yatay taşma olmamalı.
Yalnız sonucun doğru çıkması atışların doğru olduğunu kanıtlamaz.

## 25 Ekim güncellemesi

Her tur saldıran gemileri, ardından savunan gemileri tek tek gösterilir. Aynı
tur ölen savunan, kayıttaki karşılık atışını yaptıktan sonra patlar. Bu yalnız
gösterim sırasıdır; hesaplamanın eşzamanlı ateş hakkı korunur. Gerçek hedefin
hasar rozeti, sabit tam can izi ve kalan/azami canı vardır. Mavi motor konileri
kaldırıldı; Söndürücü önde, yük/Hurdacı arkada durur. Gezegen ve savunanların
tamamını aynı Aegis geometrisi kapsar; lazerler bu yüzeye çarpar.

Sayı alanları yazarken boş kalabilir; boş/geçersiz değer odak çıkınca sıfırlanır.
Yeni kullanıcı kararı olan en fazla on hedef ve sınıf önceliği ortak motorda
uygulanır; [hedefleme kaydı](combat-target-selection-2026-10-25.md).
Önceki motor karşılaştırması ve ayrı Aegis sapması
[inceleme raporunda](combat-engine-comparison-2026-10-25.md) bulunur.

Yerel önizleme: `http://localhost:5184/?simulator=1`.
