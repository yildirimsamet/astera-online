# Stratejik Honor için inceleme adayı — henüz onaylanmadı

Gerçek ACTIVE/v18 manuel denemesi (`manual-strategic-audit.json`) üç açık
gösterdi: denk EMP, zayıf koloniye EMP ve interceptor başarısı Honor journal'ına
bağlı değil. Zayıf koloni 100→80 sadakat kaybediyor; bunun normal gemi kaybı
olmadığı, yöntemin zorbalığı görünmez kılmaması gerektiği açık.

## Basit aday

- N'ye tamamlanmış/hazır ve uçuşta stratejik askerî varlıklar da eklenir.
  Üretimde/paused stok sayılmaz. Hazır varlığın sahibi güncel dünya sahibi;
  uçuşta silahın sahibi görevdeki gerçek komutan. Aynı varlık iki kez sayılmaz.
  Bu, sadece interceptor'u olan savunmacının token bir DART almak zorunda
  kalmadan gerçek savunma başarısına katılmasını sağlar. Normal savaşların
  karşılaştırması da bu askerî stokları dikkate alır; core politika değişikliğidir.
- Denk/üst hedefe başarılı EMP: **0 Honor**. Taktik hazırlık kalıcı imha değildir;
  silahın başarılı ateşlenmesini başarısız saldırı kaybı saymayız.
- Zayıf hedefe gerçekten etkili EMP/sadakat darbesi: ilk olay **−21,6 Honor**,
  ikinci **−32,4**, üçüncü ve sonrası **−43,2**. Başlangıç cezası silahın donmuş
  ortak değerinin %10 / 1000'idir. Bu ölçülmüş optimum değil, mevcut başarısız
  saldırı risk katsayısıyla tutarlı tasarım adayıdır.
- Etkisiz saldırı, korumaya çarpma, hedef sahibinin değişmesi, NPC/admin (bot 2026-10-29'dan beri yalnız bot-bot savaşta):
  puan ve baskı bütçesi yok. Olay tekrarı bir kez settlement üretir.
- Önceki gerçek zarar için dar karşılık mevcut tüketilen bütçeyi kullanır.
  Basınç olayı için bütçe eşdeğeri 432.000 fifth (86.400 ortak değer), mevcut
  zayıf-hedef katsayısında −21,6'ya karşılık gelir. Bu **kalıcı kayıp veya elde
  edilmiş kaynak değildir**; ayrı baskı delili/rapor alanıdır. Kullanılmamış
  baskı karşılığı 24h sonra biter; harcanan karşılık yeni karşılık basmaz.
- Interceptor bir DS'yi gerçekten yok ettiğinde savunmacı: K=216.000,
  verimlilik maliyeti=71.710, normal tier/bant/ilişki/çift indirimi. Harcanan
  interceptor saldırana imha kredisi üretmez. Yok olan DS saldırana **−21,6**
  kayıp kesintisi yazar; gerçekleşmeyen EMP ayrıca baskı cezası üretmez.
- Aynı rakipte normal/stratejik kaynak türü değiştirmek çift veya zayıf tekrar
  sayacını sıfırlamaz. İlişkili oyuncunun gerçek zararı ceza muafiyeti değildir;
  ilişkili interception pozitif Honor üretmez.

İzole aritmetik prototipi `.dev/honor-20261014/strategic-policy-prototype.ts`.
Üretim kuralına/DB writer'ına bağlanmadı. Gerçek normal/stratejik denemelerin
JSON'ları ile aday matematik testleri ayrıdır. Bu sayılar mevcut canlı oyuncuya
uygulanmış gibi sunulmaz. Normal güncel Hakimiyet hesabı değişmez.

## Uygulamada gerekli sınırlı değişiklikler

Sezon kataloğuna donmuş stratejik fiyat, stok gözlemine doğru tek sahip sayımı;
build-ready/fire/impact/control-transition noktalarında gözlem; dispatch'te
STRATEGIC_IMPACT commitment; interception aynı görev snapshot'ını kullanır.
Yeni ayrı basınç ve verimlilik maliyeti delili, ortak accounting içinde mevcut
tekrar/karşılık/çift kilidi. İki sonuç birbirini dışlar. Rapor ve launch yüzeyinde
aynı kural 6 dilde açık anlatılır. Başarılı EMP sonrası raid ayrıca yalnız kendi
gerçek kalıcı kaybını sayar; EMP'nin hazırlık katkısı ikinci imha gibi fiyatlanmaz.

Yeni kurallar onaylanmadan bu adapter'lar canlı puan yazımına eklenmeyecek.
CLAUDE.md core PvP/risk-reward değişiklikleri öncesi owner kararını şart koşar.

## Kullanıcının “başarılı EMP neden 0?” sorusu sonrası ikinci aday

İlk aday onaylanmadı. Kalıcı imha dışındaki gerçek taktik başarıyı sıfıra
eşitlemek, her şeyi yok etmeye yöneltmeme hedefini daraltabilir. Üretim
değişmeden ayrı effect-weight prototipi deneniyor:

```
E = Aegis yatırım değeri × gerçekten boşaltılan kapasite oranı
  + işlevsel ground değeri × yeni eklenen blackout süresi / 60 dakika
  + silahın sabit değeri × gerçekten kaybedilen sadakat / 100

denk/üst ham taktik Honor = min(10, E × 0,1 / 1000) × tier bonusu × askerî bant
zayıf ham Honor          = −E × 0,25 / 1000 × mevcut tekrar katsayısı
```

Mevcut ilişki/çift/karşılık kuralları aynı. E bir **taktik etki ağırlığıdır**,
kalıcı kayıp/ganimet değildir. Pozitif EMP için imha uydurulmaz. İlk baştan
boş kalkan, ground bulunmaması, zaten devam eden blackout'a sıfır ek süre veya
sıfır sadakat kaybı o bileşende 0 üretir. Gerçek sadakat kaybı ayrı etki olarak
sayılır; 5 ardışık vuruşun her biri gerçekten 20 puan götürüyorsa her birinde
aynı koloni hasarı gerçek kalır. Koruma/değişen hedef/NPC yine dışarıda.

Sabit 3 veya 5 “başarılı füze” puanı alternatifi, tek küçük savunma parçasını
aynı tam taktik başarı saydığı için ilk tercihim değil. Etki ağırlığı adayı
üç mevcut fiziksel sonuçtan oluşuyor; yeni kaynak, yetenek, saldırı izni veya
PvP kuralı eklemiyor. En çok 10×1,25 ham Honor, tek 216.000 değer silahın
%1,2'sinden düşük maksimum yeni kaynak ödülü sağlar (ilk çift indirimi dahil).
Bu sadece kaynak-feed üst sınırıdır; davranışsal istismarı kesin teşhis etmez.

Mevcut stratejik rapor shield/loyalty sonuçlarını tutuyor; aktif ground ve eski
EMP sınırının gerçek impact-anı snapshot'ı ayrıca gerekir. Yeni ölçüm gerçek
settlement'ta alınmalı; bugünkü ground'u eski strike'a uygulayarak puan üretilemez.
Bu alternatif de henüz üretime bağlanmadı veya nihai plan diye kilitlenmedi.

Tekrar kontrolü ek RED → GREEN: zaten EMP altında çalışmayan ground'un
karanlığını uzatmak **yeni pozitif hazırlık kredisi üretmez**. Gerçek uzatma
zayıf hedef baskısı ve dar karşılık bütçesinde yalnız ek süre kadar dikkate
alınır. İlk yeni ground karartması, gerçekten boşaltılan yeni kalkan ve yeni
sadakat kaybı pozitif adayın girdileridir. Böylece aynı çalışmayan hattı
ikinci kez kapattım diye tam ground değeri veya küçük pozitif tekrar yazılmaz.

## Sürekli fiyatlama adayı elendi; daha sade ve mahremiyetli aday

Gerçek v18 etkilerinde önceki aday denk +4,836445, üst +6,009227, koloni
+8,865122, zaten karanlık ikinci vuruş 0 ve zayıf -12,39075 üretti. Bunlar
oyuna yazılan puanlar değil, gerçek sonuçlar üzerinde ayrı aday hesapları.
Ancak tam ground yatırımını/kapasite oranını kullanmak Honor delta'sından
gizli savunma değerini veya Aegis seviyesini geri çıkarmaya izin verebilir.
Bu aday kilitlenmedi. Yeni prototip iki zaten açık sonuç + tek kaba ground bandı:

| Gerçek yeni etki | Ham taktik katkı |
| --- | ---: |
| Boşaltılan Aegis | Her 250 gerçek HP'ye 1 Honor; en fazla 2 |
| Yeni kapatılan silahlı ground; değer <5.000 | 0 |
| Yeni kapatılan ground; değer 5.000–24.999 | 1 |
| Yeni kapatılan ground; değer 25.000–99.999 | 2 |
| Yeni kapatılan ground; değer ≥100.000 | 3 |
| Gerçek sadakat kaybı | Her 5 yüzde puanına 1 Honor; en fazla 4 |

Toplam en çok 9; denk/üst için mevcut tier/askerî bant/ilişki/çift hesabı
uygulanır. Böylece en güçlü üst-taktik başarı en çok 11,25 ham Honor'dur.
İlk çiftte bile yeni kaynak ödemesi silah tüketiminin %1'inden düşüktür.
Zayıf hedefte aynı etki ağırlığının **2 katı negatif**; mevcut 1/1,5/2 tekrar
ve tüketilen karşılık kuralı uygulanır. Karanlığı uzatmanın baskı ağırlığı da
aynı KABA ground bandından yalnız ek süre kadar türetilir. Pozitif ground
katkısı yeniden verilmez. Böylece süreyi değiştirerek tam ground değerini
debit'ten geri çıkarmak da engellenir; yine kaba bandın kendisi sınırlı bilgi açar.

Bu bir yeni ceza tasarım adayıdır, önceki sabit -21,6 EMP adayıyla aynı kural
değildir. Yok edilen Death Star'ın -21,6 kalıcı kayıp kuralı önerisi ayrı kalır.
Interception ve askerî N'ye stratejik stok ekleme önerileri de ayrıca owner
kararını bekliyor. Ground değerleri yeni sezon kataloğundan; kalkan/sadakat
yalnız mevcut raporun zaten açıklamakta olduğu gerçek etki bilgilerinden gelir.
Yazım ve UI'da ground kesin sayısı, Aegis yatırımı ve eşdeğer kaynak E gösterilmez.

Saf aday artık `packages/rules/src/honorTactical.ts` içinde32testle doğrulandı;
henüz stratejik puan writer'ına bağlanmadı. Basınç toplamı/tüketilen karşılık
ayrı alanlardır. Gerçek Core-outage koloni denemesi legacy raporun karanlık
kubbenin stored charge'ını da shieldDestroyed içinde tuttuğunu gösterdi.
Honor input'unda yalnız aktif/usable kalkan ve çalışan Core'un ground'u
sayılmalı; rapor alanı doğrudan taktik başarı değildir. Sekiz yeni gerçek
impact ile aday saf kural test edildi; hiçbir puan oyuna yazılmadı.
