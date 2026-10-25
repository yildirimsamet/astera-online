# İki savaş motorunun davranış karşılaştırması

25 Ekim 2026. İnceleme motor davranışını değiştirmeden yapıldı. Sonraki kullanıcı
talebi olan on hedef/sınıf önceliği ayrı [uygulama kaydı](combat-target-selection-2026-10-25.md).

## Hangi sürümler?

- Ana dizindeki `master`, `50ccc660`: üç turlu, gövde/sahip kohortlarıyla hesap.
- Simülatörün temeli `40e8c270`: altı turlu `resolveRandomBattle` ve gemi bazında
  dağıtım/kaçış. Bu motor simülatör için icat edilmedi; önceki savaş dalından geldi.
- [Yayın kaydı](six-round-combat-integration-2026-10-23.md#yayın-kabulü), altı turlu
  kaynağın `3b953f9f` ile yayımlandığını söylüyor. Bu incelemede canlıya bağlanılmadı;
  yerelde eski master bulunması, canlıda eski motorun çalıştığını göstermez.
- Simülatör `resolveBattle` çağırıyor. Kayıt açık/kapalı aynı sayısal sonucu ve RNG
  tüketimini veriyor. Görsel sıra hesaplama sonucunu değiştirmiyor.
- Ana çalışma dizininin başka işe ait kirli sabitlerinden etkilenmemek için
  karşılaştırma tabanı `git archive 50ccc660 packages/rules/src` ile donduruldu.

## Doğrulanan farklar

| Konu | Eski kohort motoru | İncelenen altı turlu motor |
|---|---|---|
| Tur | En fazla 3 | En fazla 6 |
| Hedefleme | Hedef türü/sahip kohortunun toplam azami HP payına göre | Her atış bütün uygun canlı birimlere yeni rastgele ağırlıklarla |
| Bireysel hasar | Kohortta yaralı/öndeki birime yoğunlaşır | Birçok geminin ayrı canı/kalkanı azalır |
| Ateş sırası | Taraf hasarı birlikte toplanır | Her tarafın atıcıları seeded rastgele sıralanır |
| Söndürücü bonusu | Bütün Söndürücülerin toplam bonusu normal hasardan önce Aegis'e uygulanır | Atıcının ve hedef payının sırası geldiğinde, o payın normal hasarından hemen önce |
| Aegis normal emişi | Toplam normal hasardan emilir; kalan oran bütün hedef paylarına uygulanır | Sıradaki hedefin payını emer; bitince sonraki hedefler doğrudan kişisel kalkan/can kaybeder |
| Kişisel kalkan | Araştırmalı azami HP'nin %100'ü × kalkan araştırması | %25'i × aynı araştırma |
| Fazla hasar | Hedef türü/kohortu bittikten sonra başka türe otomatik aktarılmaz | Temel hasara geri çevrilir, uygun canlı hedeflere yeniden dağıtılır |
| Kargo/Hurdacı | Tur başındaki silahlı koruma bütün tur sürer | Son silahlı hedef ölünce aynı atışın fazlası ve sonraki atışlar kargoya geçebilir |
| Tur sonu kaçış | Yok | 1–5. tur sonunda gemi bazında; yer topları hariç |
| Sonuç | Savunanın fiziksel kaybına göre | Kaçanlar da aktif savunmadan çıkartılır; imha/enkaz sayılmaz |
| Sahip katkısı | Kohort hasarı/imhası üzerinden paylaştırılır | Gerçekte vurulan gövde hasarı, ateş eden geminin sahibine yazılır |
| RNG | Varyans akışı | Ayrı varyans, hedefleme ve kaçış akışları; aynı tohum eskiyle aynı sonucu vermez |
| Rapor hasarı | Bazı alanlar gövde fazla hasarını içerir | Uygulanan gerçek hasar; yeniden dağıtılan fazla hasar iki kez sayılmaz |
| Savaş öncesi otomatik kaçış | Dondurulmuş commit'te 3,5× | Yeni dalda 4×; tur sonu kaçıştan ayrı sistem |

Kişisel kalkanlar iki modelde de savaş içinde yenilenmiyor. Sınıf çarpanları
1,6 / 1 / 0,625, aynı tur öldürülenin ateş hakkı, sahip araştırmaları, Aegis'in
önce emmesi ve Söndürücü bonusunun yalnız Aegis'e işlemesi korunuyor.
Araştırma/HP kaynakları aynı; hasarın paylaşımı değiştiği için fiziksel kayıplar
aynı olmak zorunda değil. Anıt kontrolü yeni modelde kaçanları dışlıyor.

## Söndürücü/Aegis: ayrı sapma — 25 Ekim düzeltildi

Owner, 25 Ekim: “Eski önceliği geri getir: ilk turda önce tüm Söndürücü bonusları.”
Bu açık seçimden sonra yeni motorda global ön faz geri getirildi. Aegis kaldığı
sürece her tur başındaki bonus normal atışların tamamından önce uygulanır; eski
kuraldaki araştırmalı azami HP/sınıf ağırlığı korunur. Bonus yalnız Aegis'e gider;
10 gemilik normal atış hedefleme kuralı ve kargo koruması değişmez. Kayıtta ayrı
`aegisStrikes` olayları vardır; normal gemi hasarı gibi gösterilmez. Aşağıdaki
iki örnek artık regresyon testidir (`nullifier-opening.test.ts`).

İnceleme anındaki bulgu:

Bu öncelik değişimi sadece animasyon değildir ve dokümanlarda ayrıca onaylandığını
bulamadım. İki bağımsız kontrollü örnekle doğrulandı; kişisel kalkanlar kapatıldı,
varyans 1'e sabitlendi, hasarlar sınıf çarpanından sonra belirtilen miktarlara ayarlandı:

1. 300 Aegis, 100 normal hasarlı bir gemi ve 100 normal + 400 yalnız-kalkan
   bonuslu Söndürücü. Eskide bonus önce bütün 300'ü tüketir, gövdeye 200 ulaşır.
   Yenide normal gemi önce ateş ederse 100 Aegis'e harcanır, Söndürücü bonusu
   kalan 200'ü tüketir, gövdeye yalnız 100 ulaşır. Söndürücü önceyse 200 ulaşır.
2. Yalnız bir Söndürücü, iki aynı tür hedefe 100'er normal pay, 800 Aegis.
   Eskide 800 bonus önce tüketilir, toplam 200 gövde hasarı olur. Yenide ilk
   pay 400 bonus + 100 normal emer; ikinci payın bonusu kalan 300'ü tüketir.
   Sonuç 700 bonus, 100 normal emiş, 100 gövde hasarıdır.

Dolayısıyla yalnız Söndürücüleri atıcı sırasının başına taşımak eski global bonus
fazını geri getirmez. Ayrıca normal emişin hedefler arasında orantılı/ardışık
olması farklı bir davranış farkıdır. On hedef talebi bu sapmayı örtülü değiştirmez.

## Yer savunması ve üç koltuk

Üç **tür** var: Tabya/BASTION (BULWARK), Zıpkın/HARPOON (LANCE), Kirpi/THORN
(SKIRMISHER). Her iki motor da gerçek adetlerini hesaba katar; üç toplam birim,
üç can havuzu veya değişmez üç muharebe koltuğu kuralı yoktur.

- Eski motor `adet × atak` ve `adet × azami HP` ile kohort hesaplar. Hasar önce
  Aegis tarafından karşılanır; topların kişisel kalkanı yoktur. Kalan hasar hedef
  türünün HP payı ve sınıf çarpanı üzerinden uygulanır; kohort içinde can birikir,
  yeterli hasarda adet eksilir.
- Yeni motor her gerçek top için ayrı HP, atış ve kimlik yaratır. Mobil savaş
  gemileriyle aynı uygun silahlı hedef havuzundadır; hepsine rastgele pay verilir.
  Filo hayattayken topları ayrıca koruyan veya önce bütün gemileri öldürmeyi
  gerektiren bir kural yoktur. Görsel önde/arkada durmak hedef önceliği yaratmaz.
- Topların atak ve canını `EMPLACEMENT_DOCTRINE` etkiler; SHIP_POWER, SHIP_ARMOR
  ve SHIP_SHIELDS topa uygulanmaz. Toplar kaçmaz, anıta veya müttefik destek
  dalgasına taşınamaz. EMP/savunma arızası varsa sunucu onları savaş hattına katmaz;
  bu dışarıda kalmış toplar savaş yüzünden silinmez.
- Tur başında yaşayan top o tur yok edilse de karşılık verebilir; uygun düşman
  hedefi kalmadığında kalan boş atışlar uygulanmaz.
- İki modelde de savaş sonunda yok edilen her top türünün `floor(kayıp × 0,60)`
  kadarı kurtarılır. Savaş ortasında dirilmez. Sağ kalan yer toplarının kısmi
  can hasarı kalıcı gemi yara listesine yazılmaz.

Hasar paylaşımı önemli: 5 Tabya'ya toplam 1500 hasarlı kontrollü ilk atışta
eski yoğunlaşma 1 Tabya öldürdü; yeni eşit pay örneğinde beşinin de canı 700'e
indi ve hiçbiri ölmedi. Bu adet sınırı değil, yoğunlaşma/dağılım farkıdır.

Simülatör kaynak kodu her gerçek top için ayrı konum, model instance'ı ve can
etiketi yaratıyor. Mantık kontrolünde tür başına 1/5/20 top, sırasıyla 3/15/60
ayrı kimlik, konum ve ilk tur ateş hakkı verdi. Gerçek tarayıcıda tür başına
1 → 5 değiştirip yeniden simüle edince 3 → 15 savunan ve 3 → 15 ayrı can etiketi
görüldü. Üçte sabit kalan durum tekrar üretilemedi. Ayar değişikliği mevcut
oynatımı değiştirmez; «Savaşı simüle et» ile yeni kayıt oluşur. Ayrıca platform
tabanları dekor olarak kayıplardan sonra kalabilir; aktif birlik sayısı değildir.

## 200 hedef ve sonraki karar

İncelenen tüm-hedef motorunda tek Ok, 200 uygun hedefin tamamına pay ayırıyordu.
Örnekte 20 hasar, eşit ağırlık ve kalkan/sınıf farkı olmadan 200 hedefe 0,1'er
dağıldı. On hedefe dağıtıldığında pay 2 olur. Bu, kalkanları tüketme ve gövde
kaybı ihtimalini değiştirir. Kullanıcı ardından en fazla 10 hedef ve avantajlı
sınıf önceliğini açıkça istedi; bu yeni karar ayrı uygulama kaydındadır.

## Kanıt

[Kontrollü sonuçlar ve tarayıcı sayımları](evidence/combat-engine-comparison-2026-10-25.json).
Bu kanıt yeni on-hedef değişikliğinden önceki altı-turlu davranışın kaydıdır.
İlgili altı rules dosyası 82/82 geçti: dağıtım, kaçış, kayıt eşliği, destek,
kişisel kalkanlar ve tarihî replay digesti. Bu başarı, eski ve yeni motorların
aynı davrandığı anlamına gelmez; doğrulanan farklar yukarıda belirtilmiştir.
