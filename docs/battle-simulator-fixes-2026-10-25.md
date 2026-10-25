# Simülatör inceleme düzeltmeleri

Sonraki gerçek savaş bağlantısı, K01 kararı ve genişletilmiş inceleme:
[güncel doğrulama raporu](battle-replay-review-2026-10-25.md).

Owner tüm inceleme bulgularını sırayla düzeltmeyi onayladı. Çalışma izole
`feature/battle-simulator-20261024` worktree'sinde; yayınlama/birleştirme kapsam dışı.

## Kabul ve bağımlılıklar

- F01–F09: tek zaman kaynağı; atış seç/ileri/geri/başa/sona sarma eşliği,
  karşılıklı imha, son tur ve GPU iyileşmesi. Mobil panel açma/resize duraklatır.
- F10–F16: kaçanlar hayatta ve savaş dışında kalır; geri sarma alanı geri alır.
  Taraf/filo/sınıf/rol açık, kamera seçili gemiye odaklanır ve genel görünüme döner.
  Can ve kişisel kalkan ayrı; yer topunda kalkan yok; Aegis/EMP kapsamı açık.
- F17–F24: gelecek atış ayrı; eşzamanlı hesap açıklaması; filo araştırmaları;
  alan bazlı hata, özel senaryo, mobil örnekler ve hesaplama hatası durumu.
- F25–F26: yatay telefon kullanılabilir; atış ilerlemesi ve detay inceleme akışı.
- Görseller: aynı Astera renk/font dili, gemiler ana odak; anlaşılır temas,
  Aegis kırılması, imha ve kaçış. 350 px gerçek tarayıcı kabulü.

Her mantık grubu önce başarısız regresyon testi, sonra uygulama ve yeşil test.
Etkilenen alanlar: simülatör bileşenleri/timeline/yerleşim ve altı dilde metinler.
Motor sonuçları sunum tarafından yeniden hesaplanmaz. K01 global Söndürücü bonus
önceliği ayrıca izlenir; savaş dengesi değişikliği görsel düzeltmeye gizlenmez.
Normal kurallar/rapor/worker sözleşmeleri korunur. Uzun ekonomi testleri çalıştırılmaz.

## İlerleme

- [x] Durum doğruluğu F01–F09
- [x] Kamera, kimlik ve kaçanlar alanı F10–F12 / F19
- [x] Mekanik anlatımı F13–F20
- [x] Editör, hata, mobil örnekler F21–F24
- [x] Yatay görünüm ve tempo F25–F26
- [x] Görsel kabul, regresyon, typecheck ve lint
- [x] K01'in açık motor sorunu olduğu ve bu grubun kapsamı raporlandı

## Uygulanan düzeltmeler

| Bulgular | Yeni davranış |
|---|---|
| F01–F02 | Atış ayrıntısı doğrudan oynatım anından türetilir. Seç/ileri/geri/başa sarınca eski atış sabit kalmaz. Çizginin son native adımı kesin bitişe oturur. |
| F03 | Karşılıklı imha ve kendi filonun imhası ayrı sonuçtur. Anıtın kimde kaldığı, fiziksel imha mesajı gösterildiğinde de ayrıca görünür. Savaş öncesi kaçanlar hayatta sayılır. |
| F04 | İki tarafın özeti üst şerittedir. Gemilerde kalıcı taraf işareti ve farklı can çubuğu rengi vardır; dünyaya bağlı isimler kamera ile hareket eder. Dost/düşman ışın ve safha renkleri bakış açısına uyar. |
| F05 | GPU kaybı oynatımı durdurur; geri geliş sahneyi aynı kayıt/zamanda kurar. Elle yeniden açma da vardır. Yüklenemeyen glTF/efekt dosyalarının başarısız önbelleği yeniden denemede temizlenir. |
| F06 | Pozitif küçük hasar «−0» olmaz; «−<0,1» görünür. Ayrıntıdaki küçük değerler dört basamağa kadar veya daha küçük sınırla gösterilir. |
| F07–F08 | Mobil atış dökümü alanın alt bölümünde açılır; oynatımı kapatmaz. Sabit kapatma, Escape ve odak geri dönüşü vardır. Hedef seçimi paneli kapatır ve gemiye odaklanır. Açık editörle mobil genişliğe geçmek duraklatır. |
| F09 | Son turun bitişi kaçış safhası olarak adlandırılmaz. |
| F10 | Gemiler kaçış yönüne dönüp kendi park alanlarına uçar; küçülüp silinmez. Kalıcı listede taraf, filo, kimlik, kaçış turu ve gerçek kalan can bulunur. Gemiye bakma ve kaçış anını tekrar izleme mümkündür. Geri sarma listeyi, sayacı ve 3B konumu geri alır. |
| F11 | Doğrudan seçimde odaklanma; isimle gemi seçici, genel görünüm ve yakınlaştırma düğmeleri vardır. Sürükleme, kaydırma ve kıstırma yardımı mobilde de erişilebilir. |
| F12 | Gezegen küçültülüp karartıldı; formasyon aralıkları ve gemi ölçeği yeniden düzenlendi. Küçük gemilerde sayı kalabalığı yerine çubuklar görünür; seçili/ateş eden/hasar alan geminin sayıları öne çıkar. Yakın bakış ayrıntı panelinin üstüne kadrajlanır. Neon seçme halkası yerine gövde silueti vurgulanır. |
| F13–F15 | Sınıf ve güçlü/zayıf eşleşme, temel saldırı ve tur çarpanı ayrıdır. Yer topunun saldırısı «Temel saldırı»dır; kişisel kalkan yoksa açıkça belirtilir. Aegis, gemi kalkanı ve can ayrı anlatılır; kırılma ve yalnız Aegis'e işleyen Söndürücü bonusu görünür. |
| F16 | EMP/kapalı savunma açıklaması Aegis kapasitesinden bağımsız görünür. |
| F17–F18 | Gelecek atış «Sırada»dır; gerçekleşmemiş hasar sonuçları gizlenir. Tur başındaki eşzamanlı ateş hakkı ile sıralı animasyon farkı aynı yüzeyde açıklanır. Açıklamayı açmak duraklatır. |
| F19–F20 | Kart tarafı, filo numarasını ve o filonun araştırmalarını gösterir. Destek, yük, hurdacı, yer topu ve Söndürücü rolleri açıklanır. Ganimet/enkaz toplamanın oyun içindeki savaş sonrası kapsamı belirtilir; hesaplanmamış ekonomi sonucu uydurulmaz. |
| F21–F24 | Geçersiz can/adet alanı aralığıyla işaretlenip odaklanır. Boş yazım/blur normalleştirmesi korunur. Elle değişen örnek «Özel senaryo» olur. Örnekler mobil ayar panelindedir. İlk worker hatası yükleniyor görünümünden ayrılır; tekrar deneme vardır. |
| F25–F26 | Yatay telefonda üst/alt dekor ve kontroller sıkıştırılır. Atış ilerlemesi, tur sonuna gitme ve detaylı tek-atış inceleme vardır. Zaman «İzleme» süresidir; yüksek hızda inceleme yöntemi açıklanır. |

## Sınırlar ve motor bulgusu

- Bu aşama serbest filolu, yerel simülatördür. Gerçek savaş raporlarına bağlama,
  görünürlük/istihbarat yetkisi ve kayıtların sunucuda saklanması ayrı aşamadır.
- 400 birlik, bu editörün kayıt/gösterim sınırıdır; oyundaki filo sınırı değildir.
- Gemi sayısı yüksekken genel görünüm filo bütününü gösterir; tek geminin ayrıntısı
  seçim/odaklanmayla incelenir. Fiziksel telefon performansı ölçülmedi.
- **K01 bu inceleme anında açıktı; sonraki açık owner kararıyla düzeltildi:** eski motorun Söndürücü için bütün normal atışlardan önce uyguladığı
  global Aegis bonusu ile yeni motorun hedef/atış içinde uyguladığı bonus farklıdır.
  Bu düzeltme grubunda PvP kuralı değiştirilmedi. Simülatör mevcut motorun gerçek
  kaydını gösterir. İki karşı örnek ve kaynaklar
  [motor karşılaştırmasında](combat-engine-comparison-2026-10-25.md).

## Doğrulama

- Mantık düzeltmeleri başarısız regresyonlarla yeniden üretildi; sonra yeşile alındı.
- Son 13 dosyalık simülatör/yerelleştirme kontrolü: **172 test geçti**.
- Tam web TypeScript kontrolü ve değişen simülatör/dil/test/araç dosyalarının lint
  kontrolü temiz. Son kaynaklarla üretim derlemesi ve önizleme doğrulandı.
- Gerçek tarayıcıda kontrollü model indirme hatası: dosya iki kez istendi, worker
  yalnız bir kez çalıştı; 12,5 saniyedeki kayıt/zaman korunarak geri geldi.
- Gerçek End tuşu, atış seç/ileri/başa sarma, kamerayı yaklaşık 180° çevirme,
  genel görünüme dönme, mobil odak/döküm/Escape, resize duraklatması, kaçış/geri
  sarma, GPU kaybı/geri gelişi doğrulandı. Yatay 812×350 görünümünde savaş alanı
  34 px yerine **194 px**. Son sahnenin can/kalkan/durumları motor kaydıyla eşit.
- Normal görsel kontroller ve GPU deneyi: **0 tarayıcı/shader hatası, 0 oyuncu API
  isteği**. Dosya hatası deneyi ayrıca kasıtlı başarısız indirmeyi içerir.

## Önizleme ve kanıtlar

- Son önizleme: `http://localhost:5184/?simulator=1`. Aynı adres son doğrulanan
  derlemeye geçirildi; açık sayfayı yenilemek yeterli.
- [20 ekran görüntüsü ve gözlem kayıtları](evidence/battle-simulator-fixes-2026-10-25/).
- [Standart masaüstü/mobil sahneler](evidence/battle-simulator-fixes-2026-10-25/standard/evidence.json),
  [durum/kamera/kaçış/GPU](evidence/battle-simulator-fixes-2026-10-25/review/evidence.json),
  [başarısız model indirmesinden geri dönüş](evidence/battle-simulator-fixes-2026-10-25/asset-retry/evidence.json),
  [doğrulama özeti](evidence/battle-simulator-fixes-2026-10-25/verification.json).
- Kalıcı tarayıcı regresyonları `node tools/visual.mjs <dizin>` ile
  `--battle-simulator`, `--battle-simulator-review`,
  `--battle-simulator-asset-retry` seçeneklerinden biri kullanılarak ayrı ayrı çalışır.
