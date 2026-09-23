# Astera Online — Oyuncu Sohbet Analizi ve Kök Neden Raporu

**Tarih:** 21 Eylül 2026
**Kaynak:** `~/Desktop/astera-chat-20260921` — genel-sohbet (4.996 satır), klan-sohbet (1.420 satır), geri-bildirimler (63 kayıt). Tamamı okundu.
**Ek kaynak:** Dosyalarda yer almayan 3 doğrudan oyuncu geri bildirimi (sahip tarafından iletildi, 21 Eylül). Üçü de ölçülerek doğrulandı; biri canlı sunucuda **deploy edilmemiş bir düzeltme** ortaya çıkardı (bkz. §0.5).
**Doğrulama:** Her sayısal iddia `packages/rules` üzerinden çalıştırılarak ölçüldü. Ölçüm çıktıları metnin içinde.
**Kanıt seviyeleri:** **[KOD]** = çalışan koddan doğrudan hesaplandı · **[ÇIKARIM]** = kuralların zorladığı rasyonel davranış · **[ÖLÇÜLMELİ]** = telemetri gerekiyor.

---

## 0 · Yöntem notu: neyi saymadım

Chat'te en çok geçen kelime "filo" (399). Ama kelime sayısı şikâyet değil. Aşağıdaki gruplamada bir konuyu "sorun" saymam için şu üçünden biri gerekti:

1. **Farklı oyuncular, farklı günlerde, birbirinden bağımsız olarak aynı şeyi söyledi.**
2. **Oyuncu davranışı değişti** (oyunu bıraktı, stratejisini değiştirdi, "bırakıyorum" dedi).
3. **Kod ölçümü şikâyeti doğruladı.**

Sadece bir kişinin bir kez söylediği ve kodun desteklemediği şeyler Bölüm 7'de "gürültü" olarak ayrıldı.

---

## 0.5 · ÖNCE BUNU OKU: canlı sunucu, HEAD'de çözülmüş bir sorunu yaşıyor **[KOD]**

Bir oyuncunun gönderdiği hesap:

> *"Benim alaşım 13 lvl şuan. 2100 veriyor saatlik. 14 yapınca 2300 verecek. Basmak için 47k alaşım 5900 kristal istiyor. Yani yaklaşık 60k alaşım. Saatte 200 daha fazla kazanabilmek için 60000 harcıyom. 300 saatte amorti ediyor kendini. Oyun zaten 1 aylık yani toplam 720 saat."*

**Oyuncunun aritmetiği kusursuz. Ama HEAD'deki kod bu sayıları vermiyor:**

| | Oyuncunun bildirdiği | HEAD (`PRODUCER_LATE_CURVE` var) | HEAD'den `PRODUCER_LATE_CURVE` çıkarılınca |
|---|---|---|---|
| Rafineri 13→14 alaşım | **47.000** | 32.878 | **47.344** |
| Rafineri 13→14 kristal | **5.900** | 4.110 | **5.918** |
| Saatlik kazanç | **+200** | +340 | **+199** |

**Üç sayı da %1 içinde eşleşiyor.** `PRODUCER_LATE_CURVE` (L12 üstü rungların maliyet büyümesini 1,5 → 1,25'e indiren, çıktıya seviye başına +%6 ekleyen kural) `8e83920` — *"Apply combat, recovery, orbit, and economy feedback"*, **2026-09-20** — ile commit edilmiş.

> **Sonuç: canlı sezon bu düzeltme olmadan koşuyor.**

Farkın büyüklüğü (alaşım-üzerinden amortisman):

| Rung | HEAD | **CANLI (deploy edilmemiş)** |
|---|---|---|
| L10→11 | 2,9 gün | 2,9 gün |
| L12→13 | 3,4 gün | **6,6 gün** |
| L13→14 | 4,0 gün | **9,9 gün** |
| L15→16 | 5,6 gün | **22,3 gün** |
| L18→19 | 9,4 gün | **75,4 gün** |

720 saatlik bir sezonda L15→16'nın 536 saatte amorti etmesi, yatırımın **tanım gereği** zarar olması demektir. yasin'in sezon boyunca söylediği *"1 aylik sezon uretim lwelleri 10dan sonrasi bosa gidiyor"* tespiti, canlı sayılarla **birebir doğru**.

**Aksiyon:** Bölüm 7'deki (Grup E) eğri önerilerine geçmeden önce **`8e83920`'yi deploy et.** Bu, tasarım kararı değil, bekleyen bir düzeltmedir ve tek başına canlı ekonominin en büyük şikâyetini yarıya indiriyor.

---

## 0.6 · İKİNCİ DERECE ETKİ ANALİZİ — önerilerin sınavı

Sahip uyarısı, 21 Eylül: *"Bir öneride bulunurken dokunduğu konuları düşünüyor musun?"*

Haklı. Önerilerin çoğu birinci dereceydi. Hepsini ikinci derece etkilerine karşı test ettim. **Dördü çürüdü, biri tersine döndü.**

### Ç1 · `COMBAT.rounds` 3 → 5: **HİÇBİR ETKİSİ YOK** — geri çekildi **[KOD]**

Sabiti runtime'da değiştirip ölçtüm:

| rounds | 240 gemi | 400 | 600 | 800 |
|---|---|---|---|---|
| 3 | 631.777 | 631.777 | 631.777 | 631.777 |
| 4 | 631.777 | 631.777 | 631.777 | 631.777 |
| 5 | 631.777 | 631.777 | 631.777 | 631.777 |
| 6 | 631.777 | 631.777 | 631.777 | 631.777 |

**Neden:** savunan 1. turda zaten siliniyor; 2.–6. turlarda ateş edecek kimse kalmıyor. Sabit mutlak kayıp **tamamen 1. turun eşzamanlı atışından** geliyor. Tur sayısı bu sorunun kaldıracı değil.

### Ç2 · "Yakıtı %36 ucuzlat": **lokaliteyi kırıyor** — hedeflenmiş versiyonla değiştirildi **[KOD]**

Yakıt mesafede **doğrusal**:

| Mesafe | 200 Balista gidiş-dönüş |
|---|---|
| 300u | 252 D |
| 1.500u | 1.260 D |
| 4.000u | 3.360 D |

> Bugün **mesafe bir korumadır.** Uzaktaki küçük oyuncuyu koruyan şey yakıt faturasıdır.

`b` bunu chat'te kendi ağzıyla söylüyor: *"1500 döt yakıp haritanın öbür ucuna gidiyorum mağdur olmasın aynı kişiler diye."*

**Küresel bir indirim, uzak hedefi de aynı oranda ucuzlatır** → büyük filo tüm haritayı farmlamaya başlar. Ayrıca döteryum fazlası tüccarda 32:1 alaşıma dönüşür → **enflasyon kanalı**.

**Yerine:** `FUEL.perValue` sabit kalsın; indirim **yalnızca kendi dünyalarına giden seferlere** uygulansın. Böylece kaçış (fleetsave) ucuzlar, uzun menzilli saldırganlık ucuzlamaz.

### Ç3 · "Enkazın tamamı savunana": **akran PvP'sini tamamen öldürüyor** — ❌ **SAHİP KARARIYLA KAPANDI (2026-09-21)** **[KOD]**

> **Karar:** *"Bu madde yapılmasın. Hurdacıyı düzenleriz kalibre ederiz, gerekirse farklı level'lar falan ekleriz.
> Herkesin kendi enkazını alması saçma olur."*
> Enkaz **kamusal alan** olarak kalır. C1b'nin çözümü **hurdacının kendisinde** aranacak (kalibrasyon /
> kademeler), enkazın kime yazıldığında değil.

600 Balista vs 200 Balista, saldıranın NET değeri:

| Kural | Saldıranın neti |
|---|---|
| **Bugün** (hurdacı hepsini alır) | **+319.816** |
| **Ç3 ilk hâli** (hepsi savunana) | **−45.577** |
| **Köken ayrımı** (herkes kendi ölüsünün enkazını alır) | **+143.956** |

> **Hurdacı, bugün akran dövüşünü kârlı kılan TEK şey.** Onu karşılıksız almak PvP'yi bitirir.

Ölçüm **köken ayrımını** bir orta yol gibi gösteriyordu (+143.956; savunan kaybının %30'u geri, 200v20'de
saldıranın neti 32.864 → 15.278). İki bağımsız gerekçeyle düştü:

1. **Ölçümle:** 200v200 akran dövüşünde net **−486.463** — bugünden kötü (§15.2).
2. **Sahip kararıyla:** enkazın kökenini izlemek oyunun "enkaz kamusal alandır, gidip toplayan alır"
   kuralını yıkıyor; **saçma.**

**Geriye kalan gerçek sorun C1b'dir** (hurdacı enkazın %100'ünü savaş anında alıyor, savunan kendi
yörüngesindeki enkaza erişemiyor bile). Sahip yönü: **hurdacı gövdesinin kendisi kalibre edilsin** —
kapasite/hız/maliyet ve gerekirse kademeler — böylece "tek hurdacı bir savaşta kendini ödüyor ve
sonsuza kadar bedava" durumu satın alınabilir bir ilerlemeye döner.

### Ç4 · "Savaş matematiği akran dövüşünü cezalandırıyor": **YANLIŞ TESPİT** — tersine döndü **[KOD]**

Aynı savunana (200 Balista / LANCE), **aynı bütçeyle**, farklı sınıf:

| Saldıran | Sınıf | Kayıp | NET (bugün) |
|---|---|---|---|
| 600 Balista | LANCE *(ayna)* | 631.777 | +319.816 |
| 600 Tempest | SKIRMISHER | 512.852 | +403.064 |
| 479 Praetorian | **BULWARK** ✅ | **221.274** | **+607.168** |
| 189 Citadel | **BULWARK** ✅ | **159.289** | **+650.558** |

> **Doğru karşı-sınıf, saldıranın kaybını 4 KAT düşürüyor ve neti iki katına çıkarıyor.**

Savaş sistemi bozuk değil. **Bilgisiz akran dövüşünü cezalandırıyor, bilgili olanı cömertçe ödüllendiriyor.** Sorun matematikte değil, kuralın hiçbir yerde gösterilmemesinde.

Ve bilgi **zaten oyuncunun elinde**: `classMajorityAccuracy = 0.55`, eşit seviyedeki sondanın doğruluğu da tam 0,55. Yani par bir sonda **çoğunluk sınıfını söylüyor.** Eksik olan tek şey, o sınıfın ne anlama geldiği:

| Tersane − Perde | Doğruluk | Güç bandı | Çoğunluk sınıfı | Tam dağılım |
|---|---|---|---|---|
| +0 | 0,55 | ×2,64 | **VAR** | YOK |
| +2 | 0,79 | ×1,53 | VAR | **VAR** |

Chat bunu birebir doğruluyor — bilenler kazanıyordu:
> `vantasia: sonda atınca orada güç dağılımı var, %80 akıncı diyorsa buna %80 mızrak gönderirsin`
> `yasin: Carpan varda o carpanin oranini bilen de yok`

> **Sonuç: F1 (karşı-sınıf çarpanını saldırı ekranında göstermek) bu raporun en yüksek kaldıraçlı maddesi.** Ekonomiye hiç dokunmadan, oyuncunun elindeki bilgiyi −45.577'lik bir dövüşten +650.558'lik bir dövüşe çeviriyor.

---

## 0.6b · ÜÇ HAREKET ÖNERİSİ — birlikte incelenmesi

*(1) kendi dünyasına giden sefer geri çağrılabilsin · (2) uçuş hızı seçilebilsin · (3) transfer sonrası kısa cooldown*

### Her birinin dokunduğu sistemler

| | Geri çağırma | Hız seçimi | Transfer cooldown |
|---|---|---|---|
| **Fleetsave** | açar (çevrimiçiyken) | açar (**çevrimdışıyken**) | sınırlar |
| **"Filoyu dışarıda yakala" taktiği** | **zayıflatır** | etkilemez | korur |
| **Radar ihbarı** | etkilemez | **kendiliğinden dengeler** (yavaş = çok ihbar) | etkilemez |
| **Yakıt** | zaten kalkışta ödendi | ⚠ **DÜZELTME (2026-09-21, koddan):** "yavaş = ucuz" **mevcut kural DEĞİL.** `missionFuel = kütle × mesafe / scale × bacak` — sefer temposu terimi yok. `hullFuelMass`'taki `pivotRoundTrip / hullRoundTrip` bir **gövde katalog hızı** eğimi (hızlı gövde çok içer), sefer hızı değil. Hız seçimi **yalnızca SÜREYİ** değiştirir; yakıtı değiştirirse 2A.4'ün "saldırı yakıtı sabit kalır" kısıtı ve §15.2'nin ölü "küresel yakıt indirimi" maddesi arka kapıdan geri gelir | etkilemez |
| **Kovalamaca oyunu** | mümkün kılar | derinleştirir | **bozabilir** |
| **Klan ortak saldırı** | etkilemez | **kolaylaştırır** (senkron varış) | etkilemez |
| **Dominion** | hiçbiri puan üretmiyor | — | — |

### Kritik ayrım: ikisi farklı oyuncuya hizmet ediyor

> **Geri çağırma, EKRANIN BAŞINDAKİ oyuncuyu korur. Hız seçimi, UYUYAN ya da İŞTEKİ oyuncuyu korur.**

Hedef kitle 30–40 yaş, çalışan (sahip beyanı). **O hâlde asıl madde (2), (1) değil.** Geri çağırma en çok 18–22 saat oynayan ilk 3 oyuncuya yarar — ki onlar zaten kazanıyor. Önceliğim bu yüzden tersine döndü.

### Zorunlu kısıtlar (yoksa her biri istismar olur)

| Öneri | Kısıt | Neden |
|---|---|---|
| Geri çağırma | Dönüş, **uçulmuş süre kadar** sürsün (anında değil) | Aksi hâlde "filoyu dışarıda yakala" taktiği tamamen ölür. OGame kuralı |
| Geri çağırma | Dönen filo hangara **her zaman sığsın** | Chat: `hangar dolu diye geri donuyordu` |
| Hız seçimi | Maksimum süre **~12 saat** ile sınırlı | Sınırsızsa filo sonsuza kadar uzayda park eder, dokunulmaz olur |
| Transfer cooldown | **Varışa** uygulansın, kalkışa değil; geri çağırma cooldown'a takılmasın | Kaçış korunur, zıp-zıp kapanır. Dalgalar 15–20 dk arayla geldiği için 5 dk kovalamacayı bozmaz |

### Paketin güçlü–güçsüz dengesine etkisi

1. Zayıf oyuncu **filosunu kurtarabilir** → yok edilmek yerine **soyulur**.
   Chat'te insanlar **filoları** öldüğünde bırakıyor (`FevziYRT: Ben sabah kalktım sıfırım. Hiç birşeyim kalmamış`), madenleri gittiğinde değil. Bu doğrudan elde tutma kazancı.
2. Güçlünün zayıftan getirisi **yağmaya iner** — ki `protectedShare` + 8 saat tavanı onu zaten küçük tutuyor.
3. Güçlü, mecburen **birbirine döner.**

> **AMA 3. adım ancak akran dövüşü kârlıysa gerçekleşir.** Ve Ç4'e göre kârlı olması **karşı-sınıfı okumaya** bağlı.

### Bağımlılık zinciri — paketin ŞARTI

```
(2) hız seçimi + (1) geri çağırma  →  zayıf filosunu kurtarır
                                    →  güçlünün zayıftan getirisi düşer
                                    →  güçlü akranına yönelmek zorunda
                                    →  akran dövüşü KÂRLI olmalı
                                    →  F1 (karşı-sınıf kuralını göster) ŞART
                                    →  yoksa: güçlü hiç savaşmaz, PvP ölür
```

> **Bu üç madde F1 olmadan gönderilemez.** Tek başlarına gönderilirse sonuç "kimse kimseye dokunamıyor" olur — Grup B'nin (yakıt) zaten ürettiği *"maliyet yüzünden barış var"* durumunun daha kötüsü.

### Birlikte gitmesi gereken paket

| Sıra | Madde | Rolü |
|---|---|---|
| 1 | **F1** — karşı-sınıf çarpanını saldırı ekranında göster | Akran dövüşünü kârlı kılar. **Ön şart** |
| ~~2~~ | ~~**Enkaz köken ayrımı** (Ç3)~~ | ❌ **Yapılmayacak** — sahip kararı 2026-09-21; yerine hurdacı kalibrasyonu |
| 3 | **Hız seçimi** (≤12 saat) | Çevrimdışı savunma. Hedef kitlenin maddesi |
| 4 | **Kendi dünyasına geri çağırma** (uçulmuş süre kadar) | Çevrimiçi savunma |
| 5 | **Transfer cooldown** (varışta, ~5 dk) | 3–4'ün açtığı istismarı kapatır |
| 6 | **Kendi dünyasına yakıt indirimi** (Ç2) | 3–4'ü hedef kitle için ödenebilir kılar, lokaliteyi bozmaz |

**1 olmadan 3–4–5 gönderilmemeli. 3–4 olmadan 5 anlamsız. 2 tek başına gönderilebilir.**

---

## 0.7 · EKONOMİK MODELİN ŞEKLİ — "model mi yanlış?" sorusunun cevabı **[KOD]**

### Aile yanlış değil. **ORAN** yanlış.

```
amortisman(L) = maliyet(L) / marjinal_kazanç(L)
maliyet ~ c^L , kazanç ~ g^L   =>   amortisman ~ (c/g)^L
```

| Terim | Kod | Rung başına büyüme |
|---|---|---|
| Gelir | `profileIncome = 100 × L^1.3` → marjinal ≈ `L^0.3` | **×1,07** (neredeyse düz) |
| Fatura | `horizon = 0.5 × 1.5^(L−1)` | **×1,55** (L>12'de ×1,27) |
| **Amortisman** | | **×1,45 / rung** |

> **Amortisman ÜSTEL büyüyor, sezon ise SABİT 720 saat. Sorun budur.**

Bu bir ayar kayması değil, **şeklin kendisi**. Ve kaynağı belli: OGame'in `üretim 30·L·1,1^L` / `maliyet 1,5^L` oranı (≈1,30) devralınmış — ama **OGame'in sezonu yıllarca sürer, orada gün batımı hiç gelmez.** Astera aynı oranı 30 günlük bir kutuya koydu.

### Sezonu uzatmak neden kurtarmıyor **[KOD]**

`stretch() = gün/14` faturayı **sabit bir çarpanla** (30 gün için 2,14) büyütüyor. Üstel bir eğriye sabit çarpan uygulamak:

```
log(2,14) / log(1,5) = 1,88 rung
```

> **Sezonu iki katına çıkarmak, üretici merdiveninde 2 rungdan az kazandırıyor.**

Ölçülen "son kârlı rung": 14 günlük sezonda L20, 30 günlükte L24. İki kat süre, dört rung.

### Eğri tek parça değil — tasarlanmamış bir ölü bölge var **[KOD]**

| L | Marjinal kazanç | Marjinal büyüme | Maliyet | Amortisman |
|---|---|---|---|---|
| 5 | 190 | ×1,062 | 1.411 | **7 s** |
| 6 | 145 | **×0,762** | 2.225 | 15 s |
| 7 | 132 | ×0,917 | 3.485 | 26 s |
| 8 | 118 | ×0,894 | 5.427 | 46 s |
| 9 | 103 | ×0,867 | 8.416 | **82 s** |
| 10 | 184 | **×1,795** | 13.009 | 71 s |
| 12 | 312 | **×1,648** | 25.702 | 82 s |

**L5–L9 arasında her seviye bir öncekinden AZ veriyor** (190 → 103) ve 6 kat pahalanıyor. Amortisman 4 rungda **7 saatten 82 saate** çıkıyor — 12 kat kötüleşme. Bu `alloyLift`'in sönmesi ve **tam olarak yeni oyuncunun 1.–2. gününe denk geliyor.** Chat'in "çok yavaş" patlaması burada.

Sonra iki yama geliyor: L10'da lift bitiyor (×1,795 sıçrama), L12'de `PRODUCER_LATE_CURVE` (×1,648). **Eğri üç ayrı şekil, iki süreksizlikle dikilmiş.**

### Ne olmalı: aileyi değil, fatura büyümesini değiştir

`profileIncome`'un polinom (`L^1.3`) olması **doğru ve korunmalı** — depo, kasa koruması, bina fiyatı, araştırma sahnesi, hepsi ona göre fiyatlanıyor; ayrıca polinom gelir **kaçamaz**. Değişmesi gereken tek şey fatura büyümesi.

`costGrowth` taraması (tüm runglara düz uygulanınca, L12 istisnası silinerek):

| costGrowth | L8 | L12 | L16 | L20 |
|---|---|---|---|---|
| 1,55 *(bugün)* | 60 s | 147 s | 669 s | **3.194 s** |
| 1,45 | 35 s | 66 s | 230 s | 841 s |
| 1,38 | 24 s | 36 s | 104 s | 313 s |
| **1,32** | **16 s** | **21 s** | **51 s** | **129 s** |
| 1,25 | 11 s | 11 s | 21 s | 43 s |

**Öneri: `costGrowth` 1,5 → 1,32, düz, tüm runglara; `PRODUCER_LATE_CURVE` istisnası silinsin.**

Sonuç: amortisman L20'de 129 saat = 5,4 gün. 30 günlük sezonun **24. gününde** gün batımı gelir — yani gün batımı korunur, ama doğru yerde. Süreksizlikler kalkar. `alloyLift` ölü bölgesi de aynı hamlede kapanır.

> **Bu değişiklik `pnpm sim` olmadan yapılmamalı.** ARR, TAX ve informed-archetype kapıları bu eğriye göre kalibre edilmiş. 1,35 daha muhafazakâr bir ilk adım.

---

## 0.8 · GÜÇLÜ–GÜÇSÜZ: koruma bir HIZ SINIRI, fren değil **[KOD]**

### Bant yanlış ekseni ölçüyor

`ABUSE.tierBand = 1`, `coreTier` üzerinden — ve **Core ekonomi eksenidir. Askerî güç bandın içinde hiç yok.**

Sonuç: 10 kat ateş gücü olan biri, eşit Core'daki birine serbestçe dalabiliyor. OwnedBy bunu açıkça istismar etti:

> `OwnedBy: Mesela komutayı da bilerek yükseltmedim 9 da bıraktım seviye arttıkça saldırabildiğin kişi sayısı azalıyor cunku`

Hangar bunu filo boyutunu Core'a bağlayarak yamamaya çalıştı — **ama bandın ölçtüğü şeyi değiştirmedi**, sadece Core'u herkes için zorunlu kıldı (bkz. 0.9).

### "Bekle → tekrar farmla" döngüsü: evet, içindeyiz **[KOD]**

| | |
|---|---|
| `bashLimit` | 12 saatte 3 saldırı |
| `recoveryShieldHours` | 8 saat |
| **24 saatte aynı kurbana** | **3 kalkan döngüsü × 3 = 9 saldırıya kadar** |

Ve `recoveryLossHours = 4` eşiğinin **altında** kalan küçük akınlar hiç kalkan doğurmuyor. 6 saatlik lookback bunun için eklendi ama saldıranın kendi yağma kârını düşüyor.

> **Koruma, ilişkiyi bitirmiyor; sadece hızını sınırlıyor. Kurbanın tek çıkışı, alınmaya değer bir şeyi kalmaması.**

Chat'te bu döngüyü yaşayıp bırakanlar: Foxystellar (*"5 saatte bir dalinirsa ne ara filo bascaz"*), tera (*"hergün hergün defalarca saldırı yapmak ile olmaz"*), paliqo (*"bi toparlanamadim"*).

**Öneri:** aynı saldıran–kurban çifti için **artan bir bedel** (cooldown ya da azalan ganimet), bandın kendisine ise Core'un yanına **ateş gücü** terimi. yasin tam bunu önerdi (*"500 k gucu olan 100 k gucu olana dalamasin"*); admin'in itirazı (*"onu neye gore olcucez"*) **sert bir bant** için geçerli, **azalan getiri** için değil.

---

## 0.9 · TEK EKSENLİ OYUN: filocu diye bir yol yok **[KOD]**

Oyuncu geri bildirimi, yapısal cevabın kendisi:

> *"Hangarı basmak için 263k alaşım lazım, ama bu alaşımı saklayabilmem için RAFİNERİ'yi arttırmam gerekiyor. Depoyu arttırmak yetmiyor."*

**Doğru, ve sebebi tek satır:**

```
storageCap = storageHours(kasa) × alloyRate(RAFİNERİ)
```

Depo, **üretim saati** cinsinden ölçülüyor. Rafineri yükselmezse kasa ne kadar yükselirse yükselsin tavan yerinde sayıyor:

| kasa \ rafineri | L4 | L10 | L13 | L18 |
|---|---|---|---|---|
| 10 | 36.207 | 95.324 | 142.113 | ~263.000 |
| 15 | 61.273 | 161.317 | 240.498 | |
| 20 | 111.405 | 293.304 | | |

**Hangar L6→7 = 263.137 alaşım.** Bunu tutabilmek için: kasa 10 ise **rafineri en az 18**; rafineri 10 ise **kasa en az 20**.

Ve "sadece kasa bas" bir kaçış değil — kasa merdiveni rafineriden dik:

| Kasa | Kümülatif maliyet |
|---|---|
| 10 | 22.680 |
| 15 | 206.484 |
| **20** | **1.743.662** |
| 25 | 14.298.446 |

### Her kapasite neye bağlı

| Kapasite | Eksen |
|---|---|
| Hangar tavanı | **CORE** |
| Uçuş yuvası (rampa) | **CORE** |
| Yer savunma yuvası | **CORE** |
| Uydu yuvası | **CORE** |
| Koloni hakkı | **CORE** |
| Saldırı bandı | **CORE** |
| Depo tavanı | **KASA × RAFİNERİ** |
| Kasa koruması | **KASA × RAFİNERİ** |
| Works tamponu | **RAFİNERİ** |
| Bina fiyatı | **üretim** (`profileIncome`) |
| Araştırma fiyatı | **üretim** (`profileIncome`) |

**Tersane yalnızca üretim HIZI ve gövde kilidi satıyor. Hiçbir kapasite vermiyor.**

> **Filocu için bağımsız bir eksen yok. Oyun tek eksenli, ve o eksen ekonomi.** OwnedBy'ın *"kimi kademecidir, kimi filocudur"* itirazı bir tercih değil, **var olmayan bir seçeneğin talebi.**

### Öneri

| | Öneri | Not |
|---|---|---|
| **Acil** | Hangar fiyatına, üreticilerde zaten uygulanan invariant'ı uygula: **hiçbir satın alma, erişilebilir depodan büyük olamaz** (`producerUpgradeStorageMargin`, `tempo.test.ts`) | Bugün rafineride `cost/storage` tavanı 0,305; hangarda **2,76** |
| **Yapısal** | `hangarCeiling` = `max(coreGate, shipyardGate)` — filocu, Hangar rungunu **Tersane** ile de açabilsin | İki gerçek yol doğar; Tersane nihayet bir kapasite satar |
| **Yapısal** | Depoya üretimden bağımsız **mutlak** bir terim ekle: `storageHours(kasa) × rate + kasaSabit(kasa)` | Kasa ağırlıklı, rafineri hafif oynanış mümkün olur |

---

## 1 · TEK KÖK NEDEN

Chat'teki şikâyetlerin çoğunluğu birbirinden bağımsız değil. Hepsi tek bir yapısal tercihten çıkıyor:

> **Asteroid ve korsanın SAYISI oyuncu başına üretiliyor, ama YERİ galaksiye rastgele düşüyor ve HAKKI ilk varana veriliyor. Üç farklı kapsam, tek sistemde.**
>
> *(Works ve event takvimi bu tespitin dışındadır — sahip kararıyla kapalıdır; bkz. A0.)*

Kod, bu akışı şöyle dağıtıyor: **[KOD]**

| Kaynak | Dağıtım kuralı | Sahiplik |
|---|---|---|
| Asteroid | `ASTEROID_DYNAMIC.perPlayerPerHour = 1` — aktif oyuncu başına saatte 1 kaya, **galaksinin ortak havuzuna** | İlk varan alır |
| Korsan | `0.06 / koltuk / saat` → 300 koltukta saatte 18 korsan, ortak havuza | İlk varan alır |
| Asteroid yağmuru | Takvimde sabit saat, çarpan 2×–5× | O anda ekranda olan alır |
| Ticaret gemisi | Günde 4 pencere × 2,5 saat | O anda ekranda olan alır |
| Galaktik konvoy | Günde 1–2 pencere × 3 saat | O anda ekranda olan alır |
| Works (pasif üretim) | 10 saatlik sert tampon, dolunca **durur** | Toplayan alır |

**Sonuç:** Oyunda gelir, oynanan saatle doğrusal değil; **kesintisiz ekran başında olunan saatle** doğrusal. İki farklı şey.

### Kanıt: Admin'in kendi verisi (hile soruşturmasından, genel-sohbet 3871)

> `x: 5 günde 1166 asteroid'e gitmiş 157 korsan kesmiş. Ona en yakın Sakince: 865 asteroid 2 korsan`
> `x: z: 528 asteroid 24 korsan`

5 günde galaksiye dağıtılan toplam kaya, ~30 aktif oyuncuda **~3.600 adet**. **[KOD]**
- 1. oyuncu: 1.166 (%32)
- 2. oyuncu: 865 (%24)
- **İkisi toplam: %56.**

Geriye kalan ~28 oyuncu, toplam kaya arzının %44'ünü paylaşıyor. Bu, "kaya yok admin" şikâyetinin (chat'te 112 geçiş) matematiksel cevabıdır: **kaya var, ama sistem onu dağıtmıyor, yarıştırıyor.**

### Bunun neden bu kadar büyük bir fark yarattığı **[KOD]**

Ortalama kaya: 1.624 cevher (`levelWeights` × `asteroidOreByLevel`).
4 gezegenli, rafineri/kristal 12 seviye bir komutanın pasif geliri: **7.081 alaşım + 3.540 kristal/saat**.

- **Adil pay** (saatte 1 kaya): 1.624/saat → pasif gelirin **%15'i**. Önemsiz, doğru ölçek.
- **Gerçekleşen** (saatte ~10 kaya): 16.240/saat → pasif gelirin **%150'si**. Yani ekonomiyi **2,5 katına çıkarıyor** ve bunu **diğer herkesin payını sıfırlayarak** yapıyor.

> **NEDEN "aktif oyuncu ile farmer arasında uçurum var"?**
> Çünkü asteroid ve korsan, oyuncu sayısına göre üretiliyor ama **oyuncuya göre değil, kapana göre** tüketiliyor. Üretim per-player, tüketim first-come. Bu ikisi aynı sistemde olamaz.

---

## 2 · SORUN GRUPLARI VE ARALARINDAKİ BAĞLANTI

Aşağıdaki şema, şikâyetlerin neden bağımsız olmadığını gösteriyor:

```
              [A] DİKKAT EKONOMİSİ (kök neden)
               akış temelli dağıtım + 10s works + takvim + koloni arızaları
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
   [B] DÖTERYUM = PvP'nin gerçek freni     [E] ÜRETİM EĞRİSİ ↔ SEZON UYUMSUZ
   bir akın = 7-14 saatlik tüm döteryum     L9+ amortisman 3-15 gün
                │                            araştırma 200k alaşım
                ▼                                   │
   [C] SAVAŞ MATEMATİĞİ eşit dövüşü cezalandırır ◄──┘
   3× filo = %36 kayıp · sonda bandı 2,64× geniş
                │
                ▼
   [D] SONUÇ: TEK KÂRLI HEDEF = ZAYIF OYUNCU  →  "farm meta"
                │
                ▼
   [D2] BUNU DURDURMAK İÇİN SEZON ORTASINDA HANGAR  →  güven kaybı + filocu rolünün ölümü
                │
                ▼
   [F] OYUNCU BUNLARIN HİÇBİRİNİ EKRANDA GÖREMİYOR → "anlamadım", "neden"
```

Aşağıda her grup ayrı ayrı, **kanıt + neden + ne yapmalı** sırasıyla.

---

## 3 · GRUP A — DAĞITIM: sayı senin, yer ve hak başkasının *(KRİTİK)*

### A0 · Sahip kararı, 21 Eylül 2026 — kapanan iki madde

Aşağıdaki ikisi **tartışmaya kapalıdır** ve bu raporun geri kalanı onları veri olarak kabul eder:

- **Works'ün 10 saatlik tamponu kalır.** Yapısal bir ekonomi sorunu değil; oyuncuyu geri çağıran bilinçli re-engagement kurgusudur. 10 saatte bir giremeyen oyuncunun bir miktar olumsuz etkilenmesi **istenen** davranıştır.
- **Event takvimi kalır.** Event'ler tüm oyuncuyu aynı anda oyuna çeken, ödül veren ve aktifliği toplayan mekanizmadır ve zaten ortak erişilebilir saatlere (sabah işe giderken, öğle arası, akşam evde) yerleştirilmiştir.

Sahip ayrıca şunu sordu: *"Eğer sorun: verdikleri kaynak miktarı sağladıkları fayda ise → event sayılarını çarpanlarını azaltabiliriz."*

**Cevap: hayır, azaltılmamalı — ölçüm bunun ters yönde çalıştığını gösteriyor.** Aşağıda A2.

### A1 · Gerçek kusur: bir sistemde ÜÇ FARKLI KAPSAM **[KOD]**

Sahip, asteroid ve korsan oranını zaten oyuncu başına çevirmiş. Kusur oranda **değil**:

| Aşama | Kapsam | Nerede |
|---|---|---|
| **Kaç tane üretilecek** | **Aktif oyuncu başına** — `perPlayerPerHour = 1`, korsan `dynamic.perActivePlayerPerHour = 0.25` | `planAsteroidHour` |
| **Nereye düşecek** | **Galaksiye tamamen rastgele** — `radius`, `inclination`, `ascendingNode`, `phase` hepsi bağımsız rng | `generateAsteroidHour` |
| **Kim alacak** | **İlk varan** — hak, rezervasyon, kilit yok | mining claim |

> **Senin ürettiğin kaya, senin görüş alanınla hiçbir ilgisi olmayan bir yere düşüyor.**

### A2 · Bunun büyüklüğü: iki ölçüm **[KOD]**

**(1) Görüş kapsaması.** 400 komutan, `strata.commander` (0,65–1,0 × 3000) kabuğunda hacimce düzgün; kayalar `asteroidOrbitRadius` (600–3000, r⁴ dağılımı). 200.000 örnek:

| Teleskop | Bir komutanın görebildiği kaya oranı (medyan) |
|---|---|
| L1 (1425) | **%7,1** |
| L3 (1875) | **%13,3** |
| L4 (2175) | %18,6 |
| L5 (2400) | %23,0 |
| L6 (3750) | %58,3 |

Yani Teleskop 3'teki bir oyuncu, **kendi ürettiği kayayı %13 ihtimalle görüyor.** Kalan %87'yi başkası için üretiyor. Teleskop 6'ya çıkan oyuncu %58 görüyor — **aynı oyuncu sayısıyla 4,4 kat daha fazla fırsat.** Uçurumun bir kısmı doğrudan burada.

**(2) Arzın ne kadarı event dışında dağıtılıyor.**

| Gün | Toplam kaya-saati / oyuncu | Event payı |
|---|---|---|
| Hafta içi | 22 normal + (1s×2) + (1s×3) = **27** | **%18,5** |
| Hafta sonu | 22 normal + (1s×3) + (1s×5) = **30** | %26,7 |

> **Hafta içi arzın %81,5'i hiçbir event penceresinin dışında dağıtılıyor.**

### A3 · Event'ler neden azaltılmamalı — tam tersi

Bir event penceresinde "ilk varan alır" **adil bir yarıştır**: herkes aynı anda ekranda, herkes aynı kurala tabi, ve yarışın kendisi sahip'in istediği "toplanma" içeriğidir.

Saat 04:00'te 3 kişi onlineyken "ilk varan alır" **yarış değil, özel bir çiftliktir.**

Ve arzın %81,5'i ikinci durumda dağıtılıyor.

> **Event çarpanlarını düşürmek, arzın daha da büyük bir kısmını yarışsız saatlere kaydırır — yani sorunu büyütür.** Ölçüm bu yönde net.

### A4 · Kanıt: admin'in kendi hile soruşturması verisi (genel-sohbet 3871)

> `x: 5 günde 1166 asteroid'e gitmiş 157 korsan kesmiş. Ona en yakın Sakince: 865 asteroid 2 korsan`
> `x: z: 528 asteroid 24 korsan`

~30 aktif oyuncuda 5 günde dağıtılan toplam ~3.600 kaya. İlk iki oyuncu **%56'sını** aldı.

Ortalama kaya 1.624 cevher; 4 gezegenli, üretici 12 seviye bir komutanın pasif geliri 7.081 A + 3.540 C/saat.

- **Adil pay** (saatte 1 kaya): pasif gelirin **%15'i** — doğru ölçek, sorun yok.
- **Gerçekleşen** (saatte ~10 kaya): pasif gelirin **%150'si** — ekonomiyi 2,5 katına çıkarıyor ve bunu **diğer herkesin payını sıfırlayarak** yapıyor.

### A5 · Öneri: sadece TEK bir şey değişsin — event dışı kayanın YERİ

Works'e, event takvimine, spawn oranına, çarpanlara **dokunmadan**:

| | Event penceresi içinde (%18,5) | Event penceresi dışında (%81,5) |
|---|---|---|
| **Bugün** | rastgele yer, ilk varan | rastgele yer, ilk varan |
| **Öneri** | **aynen kalsın** — yarış burada gerçek ve içerik | kaya, **onu üreten komutanın görüş alanı içinde** doğsun ve **ilk N dakika ona rezerve** olsun; süre dolunca herkese açılsın |

Neden bu şekil:

1. **Sahip'in iki kararına da dokunmuyor.** Works aynı, event takvimi aynı, event ödülü aynı.
2. **Yarışı öldürmüyor, doğru yere taşıyor.** Kapışma event penceresinde kalıyor; asenkron saatlerde herkesin bir tabanı oluyor.
3. **Script'in getirisini aynı hamlede siliyor.** Rezerve pencerede bot, sadece *kendi* payını daha erken alır — başkasının payını alamaz. Grup H'nin aciliyeti düşer.
4. **"Kaya yok" şikâyetini teleskop seviyesinden bağımsız çözüyor.** Bugün Teleskop 3'teki oyuncu kendi kayasının %87'sini göremiyor; öneriyle %100'ünü görüyor. Teleskop hâlâ değerli — *başkasının* kayasını ve event kayalarını görmek için.
5. **Toplam arz değişmiyor.** Bir denge dial'i değil, bir teslimat düzeltmesi.

**Ayarlanacak tek yeni sayı:** rezervasyon süresi. Başlangıç önerisi **10 dakika** — kazıcının tipik bir kayaya gidiş süresinin üstünde, kayanın 2,5–5 saatlik ömrünün çok altında.

**Aynısı korsan için geçerli:** `PIRATE.dynamic.perActivePlayerPerHour = 0.25` zaten oyuncu başına, ama yerleşim yine tamamen rastgele ve görüşe bağlı. `Atakan34100: Korsan var diye yazıyor arıyorum tarıyorum boş` — admin de kabul etti. Aynı düzeltme korsanı da çözer.

### A6 · Koloni arızaları ile toparlanma kalkanı birbirini iptal ediyor **[KOD]**

*(Bu, dikkat ekonomisinden bağımsız ayrı bir çelişki — works/event kararlarıyla ilgisi yok.)*

`ABUSE.recoveryShieldHours = 8` + `recoveryProductionMult = 1.5` → ağır yenilgi sonrası 8 saat kalkan ve %50 üretim.
`FAULT.attackFaults = 2` → **aynı tetikleyici**, 2 rastgele arıza.

8 arıza türünden 3'ü üretimi durduruyor. 2 çekilişte en az birinin gelme olasılığı **%64**.

> **Dayak yiyen oyuncunun %64 ihtimalle üretimi %50 artarken duruyor.**

> `Mr_Ged: kalkan devreye girmiş tükenmiş... akın yedim üretim 15 dk durdu diyor millete boost bana anti boost sanırım :))`
> `b: saldırı yiyen insanların kazıcıları niye bozuluyor adam bari hurdayı toplayabilsin`

Arızalar sadece KOLONİ'de ve Core ≥ 6'da; başkent muaf. Ama akınların çoğu koloniye geliyor.

**Düzeltme (tek satır):** `attackFaults` ile `recoveryShield` aynı olayda tetiklenmesin.

**Ek — ölü kod, ama zararsız (21 Eylül düzeltmesi):** `applyDisruption` hiçbir yerden çağrılmıyor ve `disrupted_until`'e **hiçbir yer gelecek tarih yazmıyor** (yalnızca `null`'a çekiliyor). Banner `> now` koşuluna bağlı olduğu için **hiç tetiklenmiyor** — oyuncuya yalan söylemiyor. Mr_Ged'in gördüğü "üretim 15 dk durdu" disruption değil, **arızanın tamir süresiydi**; yani A6'nın ta kendisi. Temizlik, o dosyalara başka bir iş için dokunulduğunda yapılsın.

### A7 · Koloni arıza sıklığı **[KOD]** *(orta öncelik, ayrı konu)*

`calmMeanHours = 12.7` + `burstChance = 0.30` → koloni başına ortalama 9 saat. 3 koloni → **günde ~8 arıza olayı**. Chat'te 16 geçiş, hiçbiri olumlu.

---

## 4 · GRUP B — DÖTERYUM: PvP'nin gerçek freni *(KRİTİK)*

Chat'te döteryum 147 kez geçiyor — yakıt/mazot eşanlamlılarıyla birlikte **168**. Kaya'dan (112) ve hangar'dan (101) fazla. **Bu, sohbetin en çok dönüp durduğu tek konu ve şu ana kadar en az müdahale edileni.**

### Ölçüm **[KOD]**

4 gezegen, rafineri/kristal 12, döteryum tesisi 10:

| Kalem | Değer |
|---|---|
| Günlük döteryum üretimi (4 gezegen) | **4.260 D** |
| 200 Balista ile 1.500 birimlik akın | **1.260 D** (gidiş-dönüş) |
| Aynı akın, 3.000 birim mesafe | **2.520 D** |
| 400 Balista, 1.500 birim | **2.520 D** |

> **Tek bir ciddi akın = tüm imparatorluğun 7–14 saatlik döteryum üretimi.**
> Tüccardan satın alınırsa (32:1): 1.260 D = **40.320 alaşım** = tüm alaşım gelirinin **6 saati**.

Bu yüzden şunlar söylendi ve hepsi doğru:

> `b: kanka bide şuan döteryum sefer maliyeti inanilmaz yüksek... adamin 600 filosu var bende ona gidecem diyelim gidemiyorum. 6000 bin dot yetmiyor`
> `img: Maaliyet yüzünden barış var 😃`
> `vantasia: döteryum maliyetini düşürmen laızm oynanmıyor böyle... hareket etmek ceza gibi oluyor`
> `yasin: Baya bi yuksek dot yok kimse kimseye saldirmaz oyle kaya kovalar gelisim kademe yapar boyle`

### NEDEN bu kadar kötü? Üç kural aynı yöne bastırıyor **[KOD]**

1. **Tesis amorti etmiyor.** Döteryum tesisi L10 → L11 yükseltmesi 9.757 A + 9.757 C; kazanç +5,4 D/saat. `resourceValue` ağırlığıyla (1 : 2 : 32) geri ödeme **~172 saat = 7,2 gün**. 30 günlük sezonda hiç kimse bunu almaz. Oyuncular da almıyor — hepsi alaşımı tüccarda bozduruyor.
2. **Korsan yakıt vermiyor, bilinçli olarak.** `hoardShare.deuterium = 0.01125`. Docblock bunu açıkça savunuyor: *"A hoard that hands the tank back turns the pirate lane into a loop that funds its own next trip."* Mantık doğru — **ama o zaman yakıtın başka gerçek bir kaynağı olmalı, yok.**
3. **Tüccar günde sadece 4 × 2,5 saat açık** ve bir uçuş yuvası + yakıt istiyor. Yani yakıt almak için yakıt harcıyorsun.

### B4 · Ticaret ekranında GERÇEK BİR HATA *(doğrulandı)* **[KOD]**

llEmre'nin dediği doğru, admin chat'te yanlış cevap verdi:

> `llEmre: 3400 gemi yerim var 106 döt verip 1696 kristal alabiliyorum ama 212 verip 3400 alabilmeliyim`
> `x: 106x16 1696 kristal işte. Kesinti yok ki`

`apps/web/src/lib/trade.ts:163` → `offerCeiling` teklif tavanını **en ucuz malı geri alacakmış gibi** hesaplıyor:

```
byConvoy = min(hold, hold × rate[cheapest] / rate[give])
         = min(3400, 3400 × 1 / 32) = 106
```

Yani oyuncu **kristal** istediğini söylese bile tavan **alaşım** üzerinden kuruluyor ve ambarının yarısı boş dönüyor. Döteryum isterse 1/32'si.

Kod bunu bilerek yapıyor (D166 docblock'u: slider'ın her noktası legal olsun diye). Ama **bedeli oyuncuya anlatılmıyor ve kaçış yolu yok.** Oyuncunun "kristal istiyorum" demesi tavanı yükseltmeli.

### Öneri (B grubu)

| Öneri | Etki | Risk |
|---|---|---|
| `FUEL.perValue` 0,0055 → **0,0035** (%36 indirim) | 200 Balista akını 1.260 → 800 D. Akın günlük üretimin %19'una düşer. | Düşük. Tek dial, D195 zaten her gövdeyi buradan geçiriyor. |
| Döteryum tesisi çıktısını **×1,6** | L10: 44 → 71 D/saat. Amortisman 7,2 → 4,5 gün. Hâlâ kötü ama tesis "alınabilir" olur. | Düşük |
| Korsan `hoardShare.deuterium` 0,01125 → **0,03** | L4 korsan ~900 → ~2.400 D. Tam bir akını karşılamaz, ama bir akını *mümkün* kılar. | Orta — docblock'un uyardığı "kendini fonlayan döngü" riski. 0,03'te bir akın hâlâ 2 korsan ediyor, döngü kapanmıyor. |
| `offerCeiling` istenen mala göre hesaplansın | Ticaret ambarı %100 kullanılır | Yok — UI hatası düzeltmesi |

**Neden yakıt, hangar'dan daha önemli:** Hangar filonun *boyutunu* sınırlıyor. Yakıt filonun *kullanılıp kullanılmayacağını* belirliyor. Chat'te "filom var ama gidemiyorum" diyen oyuncu sayısı, "filom sığmıyor" diyenden fazla.

---

## 5 · GRUP C — SAVAŞ MATEMATİĞİ eşit dövüşü cezalandırıyor *(KRİTİK)*

### C1 · Ölçüm — ve gerçek bulgu yasin'in söylediğinden ağır **[KOD]**

İlk ölçümümde yüzde kaybı öne çıkarmıştım; **doğru çerçeve bu değil.** Savunan 200 Balista sabit, saldıran değişken, 40 tohum:

| Saldıran | Saldıranın değeri | **MUTLAK kayıp** | % | Yok ettiği değer | **NET** |
|---|---|---|---|---|---|
| 200 | 586.200 | 585.907 | %100 | 586.053 | +147 |
| 240 | 703.440 | **631.777** | %90 | 586.200 | **−45.577** |
| 320 | 937.920 | **631.777** | %67 | 586.200 | **−45.577** |
| 600 | 1.758.600 | **631.777** | %36 | 586.200 | **−45.577** |
| 800 | 2.344.800 | **631.777** | %27 | 586.200 | **−45.577** |

> **Saldıranın mutlak kaybı SABİT.** `COMBAT.rounds = 3` olduğu için savunanın 3 turda verdiği toplam hasar, saldıranın kaç gemisi olduğuna bakmadan aynı sayıda gemiyi öldürüyor. Daha fazla gemi getirmek yüzdeyi düşürüyor, **mutlak kaybı hiç düşürmüyor.**

Ve o sabit kayıp (631.777), yok edilen değerden (586.200) **%7,8 BÜYÜK.**

> **Eşit kademedeki bir rakibe saldırmak, getirdiğin filo ne kadar büyük olursa olsun, her zaman değer olarak zarardır.**

Savunan 10 Tabya da eklerse net −57.465'e çıkıyor.

Yani bir akının kâr edebileceği yalnızca **iki** kanal kalıyor:
1. **Yağma** — ama `protectedShare` + `protectedHoursCap = 8s` bunu sınırlıyor ve hedefin gerçekten açıkta madeni olması gerekiyor.
2. **Enkaz** — 600v200'de **365.393 birim.**

**Enkaz, eşit dövüşteki tek güvenilir kâr kanalı.** Ve C1b bunun tamamını saldırana veriyor.

### C1b · Hurdacı, enkazın tamamını saldırana veriyor **[KOD]** — *"eşit güçteysek bile adam kafa atıp geçiyor"*

Doğrudan oyuncu geri bildirimi:

> *"Filo yapamıyorum, sürekli birileri dalıyor filo yok oluyor. Hurdacı ile de tüm hurdayı topluyor. Eşit güçteysek bile ben AFK iken adam kafa atıyor, hurdacı ile toplayıp geçiyor."*

`settleWreck` (`salvage.ts`): saldıranın **hayatta kalan hurdacıları enkazdan İLK ÖNCE alıyor — savaşın çözüldüğü anda**, kamusal alan daha var olmadan. Docblock bunu açıkça söylüyor: *"One transaction, no second race."*

| | Saldıranın Hurdacısı | Savunanın Kazıcısı |
|---|---|---|
| Sefer başına | **15.000 birim** (`SALVAGE.perCollector`) | 1.000 birim (200 temel × Holds L5 ×2,5 × Derrick ×2) |
| Ne zaman | Savaş çözüldüğü **an**, kuyruksuz | Gidiş-dönüş + **1 dk cooldown** (`shortTripCooldownMinutes`) |
| Adet sınırı | Yok | Dünya başına **2** (Holds L3 ile 3) |
| **Oran** | **1 hurdacı = 15 kazıcı seferi** | |

Hurdacı 13.000 A + 6.500 C = 19.500 birim; **tek bir savaşta kendini ödüyor** ve sonsuza kadar tekrar kullanılıyor.

200'e 200 dövüşünde: iki taraf da filosunu tamamen kaybediyor, enkaz 351.588 birim. Hurdacılı saldıranın net kaybı **234.319**, savunanın **586.053** — yani **her iki filo da yok olduğu bir dövüşte saldıran 2,5 kat önde çıkıyor.**

> **NEDEN bu bir çelişki?** `DEBRIS` docblock'unun kendi gerekçesi: *"the loser is partly refunded, so a lost fleet is not a total write-off."* Hurdacı (D200) tam olarak bu özelliği siliyor. Savunan, kendi gezegeninin yörüngesindeki kendi enkazına **erişemiyor bile** — kamusal alan hiç oluşmuyor.

**Düzeltme (A5 ile AYNI mekanik):** Bir komutanın **kendi dünyası üzerinde** oluşan enkaz, ilk N dakika **savunana rezerve** olsun; süre dolunca herkese açılsın. Nötr dünya, korsan ve üçüncü taraf savaşlarındaki enkazda hurdacı aynen bugünkü gibi çalışmaya devam etsin.

### C2 · Sonda bandı, filo boyutlandırmayı imkânsız kılıyor **[KOD]**

`accuracy = 0.55 + 0.12 × (tersane − perde)`, eşit seviyede **0,55**.
`fuzzBand`: `width = (1+e)/(1−e)` ile `e = 0.45` → **bant 2,64× geniş.**

Oyuncular bunu kendi başlarına tersine mühendislikle buldu:

> `yasin: Bu sonda raporunda iki aralik veriyor ya guc icin hep en dusugu cikiyor galiba 110la 290diyor`
> `b: tersane ayni seviyeyse %50 altı gosteriyor sanirim... minimum %30 üstü doğru tahmin gibi 100/200 arasi diyosa 130 dan aşağı değildir`

Bandı 1,5×'e daraltmak için tersanenin hedefin perdesinden **2+ seviye** yukarıda olması gerekiyor. Sezonun büyük kısmında bu sağlanmıyor.

### C3 · İkisi birleşince ortaya çıkan zorunlu strateji **[ÇIKARIM]**

```
Gücü ±%30 bilemiyorum  →  güvenli olmak için 3× yollarım
3× yollarsam            →  %36 filo kaybederim
%36 kaybı karşılamak için →  ganimet çok büyük olmalı
Eşit rakipte ganimet küçük (vault %10 koruyor, stok da eşit)
────────────────────────────────────────────────────────
⇒  TEK KÂRLI HEDEF: çok daha zayıf oyuncu
```

Bu bir oyuncu ahlaksızlığı değil; **kuralların ödediği baskın strateji.** Chat bunun kanıtıyla dolu:

> `vantasia: t1 bile değmiyor abi. 5k geldi 6 gemi gitti 2.5 3k gitti`
> `b: ben bilerek saldirmiyorum şuan kimseye farkli farkli kişi arıyorum ki toparlansinlar diye`
> `b: şuan tek tabanca 3/5 kişi anaokulunda diğer cocuklara zorbalik yapan haytalar gibi olduk`
> `Ohanoluyolan: 3 gündür oyundayım... çat dibindeki komşun geliyor herşeyini alıp gidiyor, eee ben ne anladım bu işten`

`dominion` formülü bunu ayrıca **ödüllendiriyor** **[KOD]**: `loot + savunanın kalıcı kaybı − saldıranın kalıcı kaybı`. Zayıfın 50 gemisini 2 gemi kaybederek yok etmek, eşit rakibin 200 gemisini 150 gemi kaybederek yok etmekten **puan olarak daha verimli.**

### Öneri (C grubu)

| Öneri | Etki | Risk |
|---|---|---|
| `COMBAT.rounds` 3 → **5** | Üstün taraf üstünlüğünü kullanacak tur kazanır. 3×'te kayıp ~%36 → ~%18 bandına iner. **Ölçülmeli.** | Orta — tüm savaş dengesini kaydırır, `sim` ile koşulmalı |
| `INTEL.accuracyBase` 0,55 → **0,68** | Eşit seviyede bant 2,64× → 1,88×. Hâlâ belirsiz, ama filo boyutlandırılabilir. | Düşük — istihbarat katmanı ölmüyor, sadece okunabiliyor |
| Dominion'a **güç farkı ağırlığı** | Çok zayıfa dalmak puan olarak verimsizleşir | Orta — sıralamanın anlamını değiştirir, sahip kararı |
| Savaş ekranında **karşı-sınıf çarpanını göster** | %6 vs %36 farkını oyuncu görür | Yok — sadece UI, D124'ün zaten tespit ettiği eksik |

**En ucuz ve en yüksek getirili tek hamle:** karşı-sınıf çarpanını saldırı ekranında göstermek. Tablo yukarıda: doğru sınıfla %6, yanlışla %36. Oyuncu bu bilgiyi bugün sadece **savaş raporundan, filosunu kaybettikten sonra** öğreniyor. Chat'te oyuncular bunu birbirlerine öğretiyor (`FevziYRT: muhafız > mızrak` / `y: Akıncı > muhafız`) — oyun öğretmiyor.

---

## 6 · GRUP D — KADEME / HANGAR: doğru teşhis, yanlış zamanlama *(YÜKSEK)*

### D1 · İstismar gerçekti **[KOD]**

`ABUSE.tierBand = 1`, `coreTier` Core'u üçerli gruplar. Oyuncular bunu keşfetti ve kullandı:

> `OwnedBy: Mesela komutayı da bilerek yükseltmedim 9 da bıraktım seviye arttıkça saldırabildiğin kişi sayısı azalıyor cunku`
> `yasin: 1 kademe alti ustune saldirilsin dedik kurali kotuye kullandilar`
> `vantasia: kademe yükseltmeden kademe 3leri 3 saatte bir farmliyorsun`

Hangar yok + kademe düşük = **sınırsız filo + hep zayıf hedef.** Teşhis doğruydu.

### D2 · Ama çözüm sezon ortasında geldi ve oyuncuların ödediği emeği geçersiz kıldı

> `yasin: 810 alanin 3300 u dolu diyor 😂`
> `yasin: Valla sezon ortasi bu kural cok sacma oldu`
> `z: Oyun bitti arkadaşlar saçma oldu` *(ve oyunu bıraktı)*
> `OwnedBy: Madem böyle olacaktı başta olsaydı da o kadar zamanımı boşa harcamasaydım yolda kural degisiyo`

**Bu raporun en önemli süreç bulgusu:** Sezon ortasında gelen kural değişikliği, denge kazancından daha fazla oyuncu kaybettirdi. Aynı konuşmada `b` bunu önceden söylemişti (2578–2620) ve kimse itiraz etmemişti — sonra can yanınca herkes itiraz etti.

### D3 · Yeni duvar: Hangar fiyatı depoyu aşıyor *(aritmetik olarak satın alınamaz)* **[KOD]**

`HANGAR.coreGate = [0,1,4,7,10,13,16,16,16,16,16]` → **6'dan 10'a kadar tüm basamaklar Core 16 istiyor.**

| Adım | Alaşım maliyeti | 4 gezegenlik tüm alaşım gelirinin kaç günü |
|---|---|---|
| Core 13→14 | 38.467 | 0,23 gün |
| Core 15→16 | 90.214 | 0,53 gün |
| Hangar 5→6 | **112.768** | 0,66 gün |
| Hangar 6→7 | **263.137** | **1,55 gün** |
| **Core 13→16 + Hangar 5→6 toplamı** | **300.400** | **1,77 gün** — karşılığı **+740 oda (%48)** |

**Ve depo yetmiyor:** Vault 10 + Rafineri 10'da alaşım deposu **95.324**. Hangar 6→7'nin fiyatı 263.137. Oyuncu bu parayı **fiziksel olarak biriktiremiyor.**

OwnedBy bunu tam olarak tespit etti, tahmin ederek değil sayarak:

> `OwnedBy: Sen 16 kademede depo kapasitesini 90 bin yapıyorsun örnek veriyorum. Ama hangar 350k istiyor. Ben 350k hangara kaynak harcıcam depom yetmez günlerce üretimden kalacam 3-5 gemi basınca yine kitlenecem`

`ECON.storageHoursLadder` docblock'u bu "kesişim"i (`upgradeCost > storageCap`) rafineri için özenle engelliyor — **ama Hangar o kontrolün dışında kalmış.** `costAlloy / storageCap` rafineri için 0,305'te tutuluyor; hangar için **2,76.**

### D4 · Meşru bir oynanış biçimi yok edildi

> `OwnedBy: Kimi kademecidir arastırma üretim savunma kasar ondan zevk alır. Kimi filocudur hangar maliyet depo maliyet ona göredir... Kademe basmak zorunda değildir herkes aynı sekilde`
> `OwnedBy: Ben 3-5 gemi daha basabilmek icin 300-400k alasım yapıp hangar basmak zorunda olmamalıyım sacmalık`
> `OwnedBy: Aşırı zevksiz oldu benim acımdan`

Bu, chat'teki **en olgun tasarım geri bildirimi.** Oyuncu şunu söylüyor: oyun iki strateji vadediyor (ekonomici / filocu) ama tek bir strateji dayatıyor.

### Öneri (D grubu)

| Öneri | Etki |
|---|---|
| `HANGAR.coreGate` 6–10 arası basamakları **kademelendir** (16,17,18,19,20 gibi) | Core 16'daki duvar kalkar, ilerleme sürekli olur |
| Hangar fiyatını **depo tavanının altına** kilitle (rafineriyle aynı invariant) | "Satın alınamayan seviye" durumu biter. `tempo.test.ts`'e Hangar da eklenmeli |
| Filo alanını **sadece Core'a değil, Tersane + Hangar'a** bağla | Filocu, tersaneyi yükselterek ilerleyebilir; ekonomici Core'la. İki yol açılır |
| **Kural değişikliği politikası:** denge değişiklikleri sezon başında | Güven maliyeti sıfırlanır. Sezon 30 gün, bu artık mümkün |

---

## 7 · GRUP E — ÜRETİM EĞRİSİ ↔ 30 GÜNLÜK SEZON UYUMSUZLUĞU *(YÜKSEK)*

Kullanıcının sorusu: *"bir sonraki level'a upgrade etmek kendisini 3-5 günde amorti edecekse bu saçmalık."* **Haklı ve durum bundan kötü.**

### E1 · Rafineri amortisman tablosu **[KOD]**

| Seviye | Üretim/saat | Yükseltme (A) | Amortisman |
|---|---|---|---|
| 5 | 709 | 1.411 | 8,4 saat |
| 8 | 1.176 | 5.427 | 2,1 gün |
| **9** | 1.294 | 8.416 | **3,8 gün** |
| **11** | 1.581 | 20.054 | **5,0 gün** |
| **15** | 2.792 | 53.546 | **6,3 gün** |
| **18** | 4.078 | 110.284 | **10,6 gün** |
| 20 | 5.090 | 177.709 | 15,1 gün |

Kristal çıkarıcı daha kötü: L10'da **5,1 gün**, L15'te **9,8 gün**, L20'de **23,4 gün**.

Yani **30 günlük sezonun 10. gününde rafineri 11'in üstünde her yatırım zarar.** Oyuncular bunu sezgiyle buldu:

> `yasin: Ornek 15 lwl alasim 70 k alasim istiyor ne icin saatte 2.5 uretsin diye onceki kac 2.3 fark yok ki niye basayim 70 k alasim. 6 ay yada suresiz sezon oynamiyoruz ki kademe basalim. 1 aylik sezon uretim lwelleri 10dan sonrasi bosa gidiyor`

Yasin'in "10'dan sonrası boşa" tespiti, koddan çıkan **11** rakamıyla neredeyse birebir.

> **NEDEN?** `upgradeCost` 1,54 büyürken üretim `L × 1,10^L` büyüyor. Kod bunu biliyor ve docblock'ta *"THAT DRIFT IS WHAT STOPS A 14-DAY SEASON RUNNING AWAY"* diye savunuyor. **Eğri 14 günlük sezon için tasarlanmış, oyun 30 gün oynanıyor.** `PRODUCER_LATE_CURVE` (L12'den sonra `costGrowth 1.25`) bunu yamamaya çalışıyor ama yetmiyor — tabloda L12'de amortisman 3,9 güne düşüp sonra tekrar tırmanıyor.

### E2 · Araştırma maliyeti = 34 Kıyamet gemisi **[KOD]**

Kıyamet'i (Cataclysm) açmak için gereken tüm araştırma:

| Proje | Alaşım | Kristal |
|---|---|---|
| STARSHIP_ENGINEERING L1+L2 | 81.151 | 62.424 |
| SHIP_POWER L1–L4 | 103.890 | 79.916 |
| SHIP_ARMOR L1–L2 | 15.383 | 11.833 |
| **TOPLAM** | **~200.000** | **~154.000** |

Bir Kıyamet 5.850 alaşım. Yani **açılış maliyeti = 34 gemi.** Oyuncu birebir bunu söyledi:

> `Atakan34100: Aşırı maliyetli araştırmalar bugün 200k gitmiştir araştırmaya kıyameti yeni açtım`
> `b: Araştırmaya ayırdığım kanalla bi bu kadar daha filo yapardım. Bana da mantıksız geldi biraz. Bu kadar araştırma geliştirmeye karşılık saatlik üretim o kadar artmıyor`

Üstüne Tersane 6 ve Hangar gereksinimleri:
> `yasin: Gemi gücünü 4 e getirdim ben şimdide tersane 6 istiyor... oda hangarda 100 bin alaşım istiyor. Abuk sabuk oldu durumlar`

### E3 · Alaşım/kristal oranı: gelir 2:1, harcama 4:1 **[KOD]**

| | Alaşım : Kristal |
|---|---|
| **GELİR** (rafineri/çıkarıcı aynı seviye) | **2,00** |
| Rafineri yükseltmesi | 8,00 |
| Pike / Balista / Kıyamet | 5,00 / 4,00 / 3,75 |
| Core / Hangar | 3,71 |
| Tersane | 2,60 |
| *Çıkarıcı* | *1,33* |
| *Döteryum tesisi* | *1,00* |
| *Araştırma* | *1,30* |

**Filo oynayan oyuncunun harcaması ~4:1, geliri 2:1 → kristal, harcandığının iki katı hızda birikiyor.** estel'in geri bildirimi tam olarak bu:

> `estel: kristal fazla kalır depo taşıyo toplama yapamıyoz... ana üretim merkezi hep alaşım istiyor kaç katı yani... alaşım çok lazım oluyor kristala göre 7x üretmeli`

**Ama tersi de doğru:** araştırma safhasındaki oyuncu (1,3:1) kristal darboğazına giriyor. Yani **sabit gelir oranı (2:1), oynanış biçimine göre 1:1 ile 8:1 arasında değişen bir harcama oranıyla karşılaşıyor.** Dengeleme aracı sadece tüccar, o da günde 4 pencere.

### Öneri (E grubu)

| Öneri | Etki |
|---|---|
| `PRODUCER_LATE_CURVE.startsAfter` 12 → **8**, `outputLiftPerLevel` 0,06 → **0,10** | Amortisman L9–L18 bandında ~%40 kısalır; L15 → ~4 gün. Sezon boyunca inşa etmek rasyonel kalır |
| Araştırma maliyetini **%40 düşür** (`profileResearch` `hours` çarpanı) | T4 açılışı 200k → 120k. Hâlâ ciddi bir yatırım, ama 20 gemi eder, 34 değil |
| Gelir oranını **2:1 → 2,6:1** (alaşım lehine) *veya* gemi maliyetlerini 4:1 → 3:1 | Kristal taşması biter. İkisinden biri, ikisi birden değil |
| Tüccarı **pasif ve sürekli** yap (oran biraz kötü), pencereler bonus kalsın | Oran dengeleme, takvime bağımlı olmaktan çıkar → **Grup A'yı da hafifletir** |

---

## 8 · GRUP F — OYUNCU GÖRDÜĞÜNÜ BİLİR: bilgi/öğretme hataları *(YÜKSEK, ucuz)*

Bu grup teknik olarak küçük, **etkisi olarak büyük**: chat'in çok büyük bir kısmı oyuncuların birbirine kuralları öğretmesi. Oyun öğretmiyor.

| # | Sorun | Kanıt | Durum |
|---|---|---|---|
| F1 | Karşı-sınıf çarpanı hiçbir yerde gösterilmiyor | `yasin: Carpan varda o carpanin oranini bilen de yok` — sonra `oguz: 1.6 oran` | **Açık.** D124'te tespit edilmiş, hâlâ var |
| F2 | "Kaç gemi göndermeliyim" sorusunun cevabı yok | `Atakan34100: %0 kayıp diyor saldırırken onun ne kadar üstüne çıkmam lazım` · `Berat12 (geri bildirim): 3000-4000 savunma puanı + 4 gemisi olan kişiye neyle nasıl saldırmak lazım` | **Açık.** `forecastLoss` var ama bandı çok geniş (C2) |
| F3 | Arıza tamir butonu bulunamıyor | `Mr_Ged: tamir et butonu vs. yok... ben hiç bir yere basamıyorum bi işaret ikon falan varmı` | **Açık** (`FaultSheet.tsx` var, keşfedilemiyor) |
| F4 | Ticaret tavanı yanlış mala göre | llEmre, Bölüm 4'te doğrulandı | **Gerçek hata** |
| F5 | Korsan bildirimi var, korsan görünmüyor | `Atakan34100: Korsan var diye yazıyor arıyorum tarıyorum boş` — admin: *"Evet onu bende fark ettim... Not ettim duzelticem"* | **Admin kabul etti** |
| F6 | Savaş raporunda düşman gemi sayıları yok | `GWAYNE: saldırı yiyorum savaş raporunda kaç gemi olduğu yok` | **Açık** |
| F7 | Keşfedilen gezegene geri dönülemiyor | `Mr_Ged: istihbaratta kaydı var ama tıklayınca gitme yok` (2 kez sordu) | **Açık** — NEUTRAL gezegenler işaretlenemiyor |
| F8 | Koloni sadakat/arıza sistemi hiç anlatılmamış | Oyuncular arızayı "bug" sanıyor | **Açık** |
| F9 | Kazıcı dönüş süresi gönderirken gösterilmiyor | `DarthVaderJK: gidiş süresi görünüyor ama git+gel de görünmeli... Süreyi bilsem uzak taşa göndermezdim` | **Açık** |

> **NEDEN bu grup bu kadar önemli?**
> Oyuncular "daha çok kaynak ver" diye bağırıyor. Ama bir kısmı aslında **elindeki kaynağı karara çeviremediği için** bağırıyor. 200 Balista'yı doğru sınıfa gönderen %6, yanlış sınıfa gönderen %36 kaybediyor — yani **doğru bilgi, %30 kaynak hediyesine eşdeğer.** F1'i çözmek, ekonomiyi hiç ellemeden aynı rahatlamayı verir.

---

## 9 · GRUP G — ETKİLEŞİM MALİYETİ *(ORTA — ucuz, motivasyonu doğrudan etkiliyor)*

Hepsi geri bildirim formundan ve hepsi tekrarlanmış:

| Sorun | Kim | Not |
|---|---|---|
| Gemi üretiminde **sayı girilemiyor**, tek tek + basılıyor | llEmre, GWAYNE (`3k gemi için 3k tıklama gerekiyor`) | 2 ayrı oyuncu, 2 ayrı ekran (üretim + transfer) |
| Koloniler arası transferde aynı sorun | llEmre, GWAYNE | |
| **Filo geri çağırma yok** | GWAYNE, trnoctyras, Sakince | `planet.ts:331` — *bilinçli tasarım kararı* ("IRREVERSIBLE by design"). Ama oyuncuya **neden** olduğu hiçbir yerde söylenmiyor |
| İptal edilen inşaatta kaynak kaybı | GWAYNE | `cancelRefund` var — oranı ekranda yazmıyor |
| Butonlar çok büyük, gereksiz scroll | Berat12, img (`Paddingler bol keseden`) | CLAUDE.md'nin kendi "interaction cost" kuralı |
| Filo hızını yavaşlatma yok | GWAYNE | Taktiksel derinlik isteği — Sakince'nin kaçma oyununda tam da bu eksik çıktı |
| Kolonide filo bölme sonrası geri alamama | yasin (`Kuryeleri koloniye gondersem geri alamicam`) | Hangar değişikliğinin yan etkisi |

**Not:** "Filo geri çağırma" 3 farklı oyuncudan geldi ve kod bunu bilinçli reddediyor. Bu bir hata değil — **ama açıklanmamış bir kısıt, hata gibi hissettiriyor.** Launch ekranına tek cümle: *"Kalkan filo geri çağrılamaz — bu yüzden gönderdiğin an bir bahis."*

---

## 10 · GRUP H — GÜVEN VE İSTİSMAR *(YÜKSEK — sezonu tek başına bitirebilir)*

Chat'te "hile / script / yan hesap" 36 kez geçiyor ve **bir akşamın tamamını yedi** (genel-sohbet 3745–4020).

| Olay | Kanıt |
|---|---|
| Script/bot ile asteroid+korsan farmı | bednieri: 5 günde 1166 asteroid, 157 korsan, günde 20–22 saat "oyun süresi". IP ban atıldı |
| Yan hesapla kendini farmlama | `vantasia: birileri işin hilesini bulmuş, ikinci üçüncü hesapları açıp, ana hesap gezegenine saldırıyor, hurda topluyor` · Alaz→bednieri, oguz→vantasia iddiaları |
| Çift hesap şüphesi (kanıtsız) | yasin, Jeos, Ohanoluyolan ayrı ayrı bildirdi |
| XSS denemesi | `KATSURA (geri bildirim): <script>alert("XSS")</script>` |

> **NEDEN bu kadar kolay?**
> Admin'in kendi cevabı: `x: Şuanda kayit icin ek bir onay gerekmediginden abuse'a cok acik`
> Ve: **akış temelli dağıtım (Grup A) script'i doğrudan ödüllendiriyor.** Saatte 1 kaya, ilk varana — bir script her zaman ilk varır. Kök neden aynı.

**Kritik bağlantı:** Grup A'yı düzeltmek (oyuncu başına *hak*, ortak havuz değil) **botun getirisini de büyük ölçüde siler.** Hak tabanlı bir dağıtımda script, sadece oyuncunun kendi payını daha erken alır — başkasının payını çalamaz.

**Ayrıca:** `Ohanoluyolan`'ın telif uyarısı (`kullandığınız müzikler ünlü bir müzisyene ait`) — admin müzikleri değiştirdi (`x: muzikleri degistirdim`). **Kapandı.**

---

## 10.5 · GRUP I — "KENDİMİ NASIL KORUYACAĞIM?" cevapsız *(KRİTİK)*

Bu grup, sahip tarafından iletilen uzun oyuncu geri bildiriminden çıktı ve chat'in tamamıyla örtüşüyor. Oyuncunun sorusu tek cümle:

> *"Oyunda sanırım bir mantık boşluğu var, basit bir soru cevapsız kalıyor: kendimi nasıl koruyacağım?"*

### I1 · Mevcut savunma araçlarının tam envanteri **[KOD]**

| Araç | Ne veriyor | Kısıt |
|---|---|---|
| **Kasa koruması** | Rafineri 13 / Kasa 12'de **16.658 A + 8.329 C** | `protectedHoursCap = 8` — kasa ne kadar büyürse büyüsün **8 saati** geçmiyor |
| **Yeni oyuncu kalkanı** | 24 saat dokunulmazlık | **Sadece ilk gün.** Bir kez |
| **Toparlanma kalkanı** | 8 saat + %50 üretim | **Sadece ağır yenilgiden SONRA.** Önceden alınamıyor |
| **Aegis** | L1 90 HP · L5 456 · L8 **1.538** HP | 1 Balista 305 vuruyor → **5 Balista, tam gelişmiş Aegis'i bir turda siliyor** |
| **Yer savunması** | Core 16'da 180 yuva = **10 Tabya** (1.180 atk / 9.060 HP) | 200 Balista'nın 61.000 atk'ına karşı ölçüsüz |
| **Bash limiti** | 12 saatte 3 saldırı | 3 saldırı her şeyi almaya fazlasıyla yeter |

> **Envanterdeki her koruma ya TEPKİSEL (yenildikten sonra) ya da ilk güne kilitli. Oyuncunun önceden seçebileceği, satın alabileceği, planlayabileceği hiçbir savunma yok.**

### I2 · Kasa koruması gerçekten "devede kulak" **[KOD]**

Oyuncunun ifadesi: *"kasa koruması özellikle 5. kademe ve sonrasında araştırma veya filo için gereken maden miktarları yanında devede kulak kalıyor."* Ölçüm:

| Korunan (rafineri 13 / kasa 12) | 16.658 alaşım |
|---|---|
| Bir rafineri yükseltmesi (13→14, canlı) | 47.344 alaşım |
| Bir araştırma adımı (SHIP_POWER L4) | 56.714 alaşım |

Korunan miktar, **tek bir bina adımının üçte biri.** Oyuncu haklı.

Ve `protectedHoursCap = 8`'in docblock'taki gerekçesi şu: *"Eight hours is a NIGHT... sleep and your ore is safe; go to work and some of it is not."* **Gerekçe bir GECE için yazılmış; oyuncunun şikâyeti bir HAFTA SONU için.** 8 saat, cumartesiyi karşılamıyor.

### I3 · Kök neden: Astera fleetsave'i kaldırdı ve yerine bir şey koymadı **[ÇIKARIM]**

Oyuncunun ilk maddesi: *"filoyu sürekli gezegende tutmak zorundayım (uzun bir seyahat şansımız yok), biri mutlaka fark edip büyüyemeden yok ediyor."*

OGame tarzı oyunlarda çevrimdışı savunmanın **tek** yöntemi fleetsave'dir: filoyu uzun bir sefere yolla, sen döndüğünde o da dönsün. Astera'da bu mümkün değil, çünkü üç kural aynı anda kapatıyor:

1. **Geri çağırma yok** (`routes/planet.ts:331` — *"IRREVERSIBLE, by design"*). Bu bilinçli bir karar ve saldırı için **doğru** bir karar.
2. **Yakıt mesafeye göre fiyatlanıyor** (Grup B). Uzun bir "kaçış" seferi, akın fiyatına mal oluyor.
3. **Filo hızı seçilemiyor.** GWAYNE tam bunu istedi: *"Filonun hızını yavaşlatabilmeliyiz."*

Sonuç: filo evde duruyor ve hedef oluyor. Oyuncunun kendi vardığı sonuç da bu:

> *"Benim aklıma gelen tek ihtimal uzaklarda bir koloni bulup filoyu ve madenleri oraya yığmak ve koloni bulunmasın diye dua etmek :))"*

**Bu, beceri değil şans.** Ve chat bunu doğruluyor — Sakince'nin bütün akşamı filosunu kaçırmakla geçti (`vantasia: drift yapa yapa kaçtı adam valla`), ve ikisi de bunun en eğlenceli an olduğunu söyledi:

> `Sakince: aga, sadece vurmak değil, bu şekilde heyecanlı oluyor..sevdim..`
> `Sakince: oyundan ilk kez zevk aldım..çok iyiydi. sadece olacak olanı geciktirdim`

**Oyunun en çok eğlendiren anı, kuralların desteklemediği bir kaçış oyunuydu.**

### I4 · Oyuncunun "satın alınabilir daimi kalkan" önerisi — kısmen hayır

Öneri: komuta kademesine göre maden karşılığı daimi kalkan; kalkanlıyken saldırılamaz; süresi rakibe gösterilmez; saldıran kalkanını kaybeder; madencilik/ticaret devam eder.

**Bunu olduğu gibi öneremem.** Açık uçlu, satın alınabilir bir kalkan, sezon sonunda liderin skorunu bankaya yatırmasına izin verir — bu, `reports/temel-oyun-sorunlari-analizi` raporunun zaten *"Final, lideri görünür bir risk almaya zorlamıyor"* diye işaretlediği kritik sorunu büyütür. Ayrıca D14'ün reddettiği "ulaşılamayan oyuncu" durumunu geri getirir.

**Ama önerinin ALTINDAKİ ihtiyaç gerçek ve karşılanmalı:** planlı yokluk, bir beceri olmalı — bir satın alma değil.

### I5 · Öneri: fleetsave'i geri getir, saldırının geri alınamazlığını koru

| Öneri | Neden güvenli |
|---|---|
| **Kendi dünyalarına giden seferler geri çağrılabilsin.** Saldırı seferleri aynen geri çağrılamaz kalsın | P3'ün bahsi (*"gönderdiğin an bir bahis"*) **saldırı** hakkındadır. Kendi kolonine yük taşırken bahis yok. Bu, fleetsave'i tek bir kuralla geri getirir |
| **Uçuş hızı seçilebilsin** (~~yavaş = ucuz yakıt~~, uzun süre) | GWAYNE'in isteği. Fleetsave'in ikinci yarısı: "ben 9 saat sonra döneceğim, filo da 9 saat sonra dönsün". ⚠ **"Grup B'yi hafifletir" kısmı düşürüldü:** yavaş seferin ucuz olması saldırı yakıtını da düşürür ve §15.2'de ölen küresel yakıt indirimiyle aynı şey olur. Hız **yalnızca süreyi** değiştirir |
| **`protectedHoursCap` 8 → 20 saat**, `protectedShare` 0,10'da kalsın | Docblock'un kendi mantığı "bir gece" diyor; hedef kitle hafta sonu bir gün giremiyor. 20 saat bir iş gününü + uykuyu karşılar, iki günü karşılamaz — yani yokluk hâlâ bir maliyet |
| **Koloni terk etme** | 2 ayrı oyuncudan geldi (`Sakince: admin, sömürgeyi iptal edebiliyor muyuz? T2-16`; uzun geri bildirim). Sadakat çöküşü pasif olarak zaten var; iradi terk yok. "Küçükler kaçar, büyükler kovalar" oyununu açar |

**Daimi kalkan yerine bunlar, çünkü:** kalkan oyuncuyu tahtadan çıkarır, fleetsave onu tahtada tutar ve **bir karar** ister — ne zaman döneceğini doğru tahmin etmek. Bu, oyunun zaten sattığı şeydir: bilgi ve zamanlama.

### I6 · Referans notu

Aynı oyuncu **Last War: Survival Game**'i (`lastwar.com`) oyuncu tutma mekanikleri için referans gösterdi ve *"bazı etkinlikler 25-20 günde bir olabiliyor"* dedi. Bu, kendi başına bir aksiyon maddesi değil; ama **uzun aralıklı, beklenen, takvimli büyük olay** fikri Astera'nın 30 günlük sezonunda karşılığı olmayan bir boşluğa denk geliyor (sezon finali dışında hiçbir "büyük an" yok). Sezon sonu tasarımı gündeme geldiğinde bakılmalı. **[ÖLÇÜLMELİ]**

---

## 11 · ÖNEMSİZ / GÜRÜLTÜ *(bilinçli olarak yapılmayacaklar)*

Bunlar chat'te geçti ama ya tek kişiden geldi, ya oyunun tanımına aykırı, ya da zaten doğru çalışıyor:

| Talep | Neden yapılmamalı |
|---|---|
| "Savunmacı kaybettiği filonun %60-70'ini geri alsın" (FevziYRT) | Kalıcı kayıp çekirdek döngünün bahsi. `a` ve admin aynı anda reddetti — doğru karar |
| "Ölüm yıldızı geri gelsin" (scoobydogg) | Zaten sezon başında oylanarak çıkarıldı |
| "Hediye/bağış sistemi" (Atakan34100, Mr_Ged) | Admin doğru reddetti: `x: Hediye sistemi kötü niyetli kullanim olabilecegi için`. Yan hesap ekonomisi açar |
| "Klan ortak filo saldırısı" (z, Atakan34100) | Admin doğru erteledi: `x: O birleşik filo yollama olayi çok fazla güçlü olur`. 20 aktif oyuncuda savunulamaz. `clanWar.ts` hazır, **sonraki sezon** |
| "Tabya/kirpi filo yeri kaplamasın" (estel) | Savunma ile saldırı arasındaki takas, tasarımın kendisi |
| "Hızlı sunucu / 1-2 saatlik sezon" (z) | Ayrı ürün. Belki ileride, şimdi değil |
| "PC/masaüstü tasarımı" (ArgaKhan) | Gerçek ama ayrı iş kalemi; hafızada zaten kayıtlı |
| Performans/ısınma (CaptainZovi iPhone 15 Pro Max, vantasia MacBook M4) | **Gürültü değil — ayrı ve ciddi bir teknik konu.** 2 bağımsız rapor, ikisi de üst segment cihaz. Bu raporun kapsamı dışında ama takip edilmeli |

---

## 12 · ÖNCELİK TABLOSU

| # | Sorun | Grup | Kanıt | Maliyet | Etki |
|---|---|---|---|---|---|
| **0** | **`8e83920`'yi DEPLOY ET** — `PRODUCER_LATE_CURVE` canlıda yok; L15→16 amortismanı 22,3 gün yerine 5,6 gün olur | 0.5 | KOD | **Sıfır (kod hazır)** | **Çok yüksek** — tasarım kararı değil, bekleyen düzeltme |
| 1 | **Event dışı kaya/korsan üreticinin görüş alanında doğsun + 10 dk rezerve** | A5 | KOD | Orta | **Çok yüksek** — farmer uçurumunu, "kaya yok"u ve bot getirisini aynı anda çözer; works'e ve event takvimine dokunmaz |
| 2 | **Yakıt indirimi — YALNIZCA kendi dünyalarına giden seferlerde** *(küresel indirim lokaliteyi kırıyor, Ç2)* | B/Ç2 | KOD | Düşük | **Yüksek** — kaçışı ödenebilir kılar, uzun menzilli saldırganlığı ucuzlatmaz |
| ~~2b~~ | ~~**Enkaz KÖKEN AYRIMI**~~ → **HURDACI KALİBRASYONU** | Ç3/C1b | KOD | Düşük | Köken ayrımı **iptal** (sahip kararı). Enkaz kamusal kalır; hurdacının kapasite/maliyet/kademe dengesi Faz 3'te ele alınır |
| 2c | **Kendi dünyalarına giden seferler geri çağrılabilsin + uçuş hızı seçilebilsin** (saldırı geri alınamaz kalır) | I5 | ÇIKARIM | Orta | **Çok yüksek** — çevrimdışı savunmayı (fleetsave) geri getirir; "kendimi nasıl korurum" sorusunu cevaplar |
| **1b** | **Karşı-sınıf çarpanını saldırı ekranında göster** *(Ç4: doğru sınıf kaybı 4 KAT düşürüyor — raporun en yüksek kaldıracı; 3/4/5 nolu hareket maddelerinin ÖN ŞARTI)* | F1/Ç4 | KOD | Çok düşük | **Çok yüksek** |
| 4 | **Hangar fiyatını depo tavanının altına kilitle + Core 16 duvarını kademelendir** | D3 | KOD | Düşük | Yüksek — "satın alınamayan seviye" biter |
| 5 | **`attackFaults` ile toparlanma kalkanını ayır** | A6 | KOD | Çok düşük | Yüksek — tasarımın kendi sözünü tutması |
| 6 | **`costGrowth` 1,5 → 1,32 düz, L12 istisnası silinsin** *(sim şart)* | 0.7 | KOD | Orta | **Çok yüksek** — amortisman üsteli kırılır, L5–L9 ölü bölgesi ve iki süreksizlik birlikte kapanır |
| 6b | **Hangar fiyatına depo invariant'ı** + `hangarCeiling = max(core, tersane)` | 0.9 | KOD | Düşük | **Çok yüksek** — filocu yolunu var eder |
| 6c | **Saldırı bandına ateş gücü terimi + aynı çifte artan bedel** | 0.8 | KOD | Orta | Yüksek — "bekle, tekrar farmla" döngüsünü kırar |
| 7 | **Araştırma maliyeti −%40** | E2 | KOD | Düşük | Yüksek — T4 erişilebilir olur |
| 8 | **`offerCeiling` istenen mala göre** | B4 | KOD | Çok düşük | Orta — gerçek hata |
| 9 | **Sonda doğruluğu 0,55 → 0,68** | C2 | KOD | Düşük | Orta-yüksek — **ölçülmeli**, istihbarat katmanını öldürmemeli |
| ~~10~~ | ~~Savaş turu 3 → 5~~ — **GERİ ÇEKİLDİ**, ölçüldü: hiçbir etkisi yok (Ç1) | — | — | — | — |
| 11 | **Alaşım/kristal oran uyumsuzluğu** | E3 | KOD | Düşük | Orta |
| 12 | **Sayı girerek gemi üretimi/transferi** | G | Chat×2 | Düşük | Orta — motivasyona doğrudan etki |
| 12b | **`protectedHoursCap` 8 → 20 saat** | I5 | KOD | Çok düşük | Orta-yüksek — hafta sonu bir gün girememek sezonu silmesin |
| 12c | **Koloni terk etme** (iradi) | I5 | Chat×2 | Düşük | Orta — "küçükler kaçar" oyununu açar |
| 13 | **Koloni arıza sıklığı (9 saat → 14 saat)** | A7 | KOD | Çok düşük | Orta |
| 14 | **Arıza tamir butonunun keşfedilebilirliği** | F3 | Chat | Çok düşük | Orta |
| 15 | **Kayıt doğrulaması (bot/çoklu hesap)** | H | Chat | Orta | Orta — #1 yapılırsa aciliyeti düşer |
| 16 | **Savaş raporunda düşman gemi dökümü** | F6 | Chat | Düşük | Orta |
| 17 | **Sezon ortası kural değişikliği yasağı (politika)** | D2 | Chat | Sıfır | **Yüksek** — güven, dengeden önce gelir |

---

## 13 · ÜÇ CÜMLELİK ÖZET

1. **Oyunun asıl sorunu "kaynak az" değil, kaynağın TESLİMATI.** Asteroid ve korsanın *sayısı* zaten oyuncu başına üretiliyor — ama *yeri* galaksiye tamamen rastgele ve *hakkı* ilk varana. Teleskop 3'teki bir oyuncu kendi ürettiği kayayı yalnızca %13 ihtimalle görüyor; kalan %87'yi başkası için üretiyor. Bu yüzden 2 oyuncu galaksinin madeninin %56'sını aldı ve geri kalan herkes "kaya yok" dedi.

2. **PvP'yi öldüren şey hangar değil; döteryum ve savaşın mutlak kayıp matematiği.** Bir akın, dört gezegenli bir imparatorluğun 7–14 saatlik tüm yakıt üretimine mal oluyor; ve eşit kademedeki bir rakibe saldırmak — **getirdiğin filo ne kadar büyük olursa olsun** — her zaman değer olarak zarar, çünkü saldıranın mutlak kaybı (631.777) yok ettiği değerden (586.200) %7,8 büyük ve filo büyüklüğüyle hiç değişmiyor. Geriye tek kâr kanalı olarak enkaz kalıyor, Hurdacı da onun %100'ünü saldırana veriyor. Bu üçü birleşince tek rasyonel hedef zayıf oyuncu kalıyor — bu bir oyuncu kusuru değil, kuralların ödediği baskın strateji.

3. **Hangar teşhisi doğruydu, zamanlaması ve fiyatı yanlıştı.** Sezon ortasında geldi, ödenmiş emeği geçersiz kıldı, ve Core 16'da depoya sığmayan bir duvar kurarak "filocu" oynanış biçimini tamamen kapattı — oysa oyuncular bize bunu kapatmamızı değil, zayıfa dalmayı durdurmamızı söylemişti.

---

## 14 · PLAN — ne yapılacak, ne yapılmayacak, ve neyi çözecek

### 14.0 · Planı değiştiren iki son ölçüm **[KOD]**

**(a) Dış gelir SABİT, üretim POLİNOM büyüyor → filocunun yakıtı kuruyor.**

| Rafineri | Üretim/saat | Ortalama kaya (1.624) kaç saatlik üretim? |
|---|---|---|
| L5 | 993 | **1,64 saat** |
| L10 | 2.095 | 0,78 saat |
| L16 | 4.786 | 0,34 saat |
| L20 | 7.635 | **0,21 saat (12 dk)** |

Kaya cevheri (800–4.000), korsan hoard'u (sabit gövde değerinden), hurdacı (15.000) — **hepsi sabit sayı.** Üretim `L^1.3` büyüyor. OwnedBy'ın *"kaya var korsan var savaş var, tek yol üretim değil ki"* çıkışı **geç oyunda matematiksel olarak kapanıyor.**

**(b) Akran akını KAYNAK olarak zararda — doğru counter'la bile.**

189 Citadel vs 200 Balista (doğru karşı-sınıf), köken ayrımı uygulanmış:

```
gemi kaybı                        −159.289
kendi enkazı                       +47.787
hedefin açık stoğundan yağma       +94.950
────────────────────────────────────────────
KAYNAK NET                         −16.552
```

Daha önce yazdığım +650.558 **Dominion'dur** (yok edilen değer), kaynak değil. Düzeltme:

> **Akran akınıyla filo fonlanamaz.** Akran PvP'si bir *sıralama yarışı*dır, gelir kaynağı değil — ki tasarımın kendi sözü de budur (*"Dominion is the ladder, wealth is displayed"*).

**Sonuç:** (a) + (b) birlikte, §0.9'un bulgusunu ikinci bir yönden doğruluyor: **filocu için bağımsız bir gelir yolu da yok.** Ve kritik etkileşim:

> ⚠ **Rafineriyi ucuzlatmak (§0.7), dış gelirin göreli değerini DAHA HIZLI eritir → filocu yolunu DAHA ÇOK kapatır.** İkisi birlikte gitmek zorunda.

### 14.1 · Bir ölçüm daha çürüdü: `protectedHoursCap` 8 → 20 **[KOD]**

| Durum | Yağmalanabilir stok düşüşü |
|---|---|
| Rafineri 8 / kasa 6 *(zayıf oyuncu)* | **%0** |
| Rafineri 13 / kasa 12 | %1 |
| Rafineri 16 / kasa 15 | %3 |

`protectedHours = min(cap, depoSaati × 0,10)`. Zayıf oyuncunun kasası küçük olduğu için **8 saatlik tavan zaten bağlayıcı değil** — `0,10` payı bağlıyor. Tavanı yükseltmek tam da yardım etmesi gereken yerde hiçbir şey yapmıyor. **Geri çekildi.**

Ve zaten gerek yok: yağma **kendini sınırlıyor.**

| Akın | Zayıf oyuncudan alınan |
|---|---|
| 1. | −29.996 |
| 2. | −11.998 |
| 3. | −4.799 |

3 akında havuz tükeniyor. **Güçsüzün asıl kaybı maden değil, FİLO.** Bu da paketi doğruluyor.

---

### 14.2 · YAPILACAKLAR

#### Faz 0 — Bugün, tartışmasız

| # | İş | Neden | Risk |
|---|---|---|---|
| **0.1** | ✅ **KARAR (sahip, 2026-09-22): (a) bekle** — `8e83920` canlı sezona ayrıca deploy edilmeyecek; eğri düzeltmesi yeni sezonda Faz 4 ile birlikte gelir | `PRODUCER_LATE_CURVE` canlıda yok. L15→16 amortismanı 22,3 → 5,6 gün | Yok, kod hazır |
| **0.2** | ✅ **YAPILDI** — `attackFaults` ile `recoveryShield` ayrıldı | Aynı olay hem +%50 üretim hem %64 ihtimalle üretimi durduran arıza veriyor | Yok, çelişki düzeltmesi |

#### Faz 1 — Bilgi katmanı *(ekonomiye hiç dokunmaz, en yüksek kaldıraç)*

| # | İş | Neden |
|---|---|---|
| **1.1** | ✅ **YAPILDI** — karşı-sınıf çarpanı saldırı ekranında | Doğru sınıf kaybı **4 kat** düşürüyor (159.289 vs 631.777). Bilgi zaten sondada var, sonucu gösterilmiyor |
| **1.2** | **Beklenen kayıp bandını sınıf bilgisiyle birlikte ver** | `forecastLoss` var; oyuncu "neden bu kadar geniş" diye soruyor |
| **1.3** | **Savaş raporunda düşman gemi dökümü** | GWAYNE. Karşı-sınıf dersini geri besler |
| **1.4** | **Arıza tamir butonunun keşfedilebilirliği** | Mr_Ged bulamadı |

> **1.1, Faz 2'nin ÖN ŞARTIDIR.** Filo kurtarılabilir hâle gelince güçlü akranına yönelmek zorunda kalacak; akran dövüşünün okunabilir olması gerekiyor.

#### Faz 2 — Hareket paketi *(güçsüzün nefes alması)*

| # | İş | Kısıt |
|---|---|---|
| **2.1** | **Uçuş hızı seçimi** | Maks. ~12 saat. *Hedef kitlenin (çalışan) maddesi* |
| **2.2** | **Kendi dünyasına geri çağırma** | Dönüş **uçulmuş süre kadar**; hangara her zaman sığar |
| **2.3** | **Transfer cooldown** (varışta ~5 dk) | Geri çağırma cooldown'a takılmaz |
| **2.4** | **Kendi dünyasına giden seferde yakıt indirimi** | Saldırı yakıtı **sabit kalır** — lokalite korunur |
| ~~**2.5**~~ | ~~**Enkaz köken ayrımı**~~ | ❌ **YAPILMAYACAK** — sahip kararı 2026-09-21. Enkaz kamusal kalır; C1b hurdacının kendi dengesinden çözülür |

#### Faz 3 — İki yol *(filocu/farmer ayrımı)*

| # | İş | Neden |
|---|---|---|
| **3.1** | **`hangarCeiling = max(coreGate, tersaneGate)`** | Tersane nihayet bir kapasite satar; filocunun ikinci ekseni doğar |
| **3.2** | **Hangar fiyatına depo invariant'ı** | Bugün `cost/storage` rafineride 0,305, hangarda **2,76** — satın alınamayan seviye |
| **3.3** | **Dış gelir sezonla ölçeklensin** (kaya cevheri / korsan hoard'u sezon gününe göre) | 14.0(a): sabit dış gelir filocu yolunu kapatıyor. **3.4 ile birlikte zorunlu** |
| **3.4** | **Ayrı sıralamalar** (Dominion · üretim · filo) | OwnedBy'ın isteği. Farmer'ın tanınması; ucuz |
| **3.5** | **İradi koloni terki** | 2 oyuncudan geldi |

#### Faz 4 — Ekonomik eğri *(sim şartı)*

| # | İş | Şart |
|---|---|---|
| **4.1** | **`costGrowth` 1,5 → ~1,32 düz; L12 istisnası silinsin** | **`pnpm sim` olmadan gönderilmez.** ARR/TAX kapıları bu eğriye kalibre |
| **4.2** | **`alloyLift` ölü bölgesi (L5–L9) kapatılsın** | 4.1 ile aynı pakette; ayrı yama olmasın |
| **4.3** | **Alaşım/kristal oranı** — gelir 2:1, harcama 4:1 | Tek yönlü: ya gelir 2,6:1 ya gemi maliyeti 3:1 |

> ⚠ **4.1, 3.3 olmadan gönderilmemeli.** Üretimi ucuzlatmak dış gelirin göreli değerini eritir ve filocu yolunu daha da kapatır.

#### Faz 5 — Dağıtım *(ayrı tasarım turu)*

| # | İş |
|---|---|
| **5.1** | Event dışı kaya/korsan, üreten komutanın görüş alanında doğsun + ~10 dk rezerve |
| **5.2** | Saldırı bandına ateş gücü terimi; aynı saldıran–kurban çiftine artan bedel |

---

### 14.3 · YAPILMAYACAKLAR *(ve neden)*

| Öneri | Neden hayır |
|---|---|
| ~~`COMBAT.rounds` 3→5~~ | **Ölçüldü: sıfır etki.** Savunan 1. turda siliniyor |
| ~~Küresel yakıt indirimi~~ | Lokaliteyi kırar (uzak küçük oyuncu korumasını siler) + tüccar üzerinden enflasyon |
| ~~Enkazın tamamı savunana~~ | Akran PvP'sini öldürür (+319.816 → −45.577) |
| ~~`protectedHoursCap` 8→20~~ | Zayıf oyuncuda **%0 etki**; pay bağlıyor, tavan değil |
| ~~Satın alınabilir daimi kalkan~~ | Lider skorunu bankaya yatırır; D14'ün reddettiği "ulaşılamaz oyuncu" |
| ~~Event çarpanlarını azaltmak~~ | Arzın %81,5'i zaten event dışında; azaltmak sorunu büyütür |
| ~~Works'ün 10 saatlik tamponu~~ | Sahip kararı, kapalı |
| ~~Klan ortak saldırı (bu sezon)~~ | 20 aktif oyuncuda savunulamaz. `clanWar.ts` hazır, sonraki sezon |
| ~~Hediye/bağış sistemi~~ | Yan hesap ekonomisi açar |
| ~~Kaybedilen filonun %60'ı geri~~ | Kalıcı kayıp çekirdek döngünün bahsi |

---

### 14.4 · SORULARIN CEVABI: bu plan neyi çözüyor?

#### S1 · "Güçsüzler durmadan dayak yiyip toparlanamıyor" — **ÇÖZÜLÜR**

| Kayıp kalemi | Bugün | Plan sonrası |
|---|---|---|
| **Filo** | Tamamen gider. *İnsanlar bu yüzden bırakıyor* | **2.1–2.2 ile kurtarılabilir.** Havadaki filoya saldırılamaz |
| **Maden** | 3 akında %84'ü gider | Değişmez — ama **zaten kendini sınırlıyor** ve kalkan+boost 8 saatte 12 saatlik üretim veriyor |
| **Binalar** | Hiç risk altında değil | Değişmez |
| **Enkaz** | %100 saldırana | **Değişmez** — köken ayrımı iptal (sahip kararı). Hurdacı dengesi Faz 3'te ayrıca ele alınır |

> Güçsüzün sonucu **"yok edilmek"ten "soyulmak"a** döner. Chat'te insanlar filoları öldüğünde bırakıyor, madenleri gittiğinde değil.

**Tam çözüm değil:** güçlü hâlâ 12 saatte 3 kez girebiliyor. 5.2 (artan bedel) bunu kapatır, ama ayrı bir tasarım turu.

#### S2 · "Filocu/farmer zorla bir şeye itiliyor mu?" — **BUGÜN EVET, PLAN SONRASI KISMEN**

Bugün filocu **üç ayrı yerden** ekonomiye zorlanıyor:
1. Hangar'ı alabilmek için depo, depo için **rafineri** (§0.9)
2. Dış gelir sabit, üretim polinom → geç oyunda **kaya/korsan anlamsızlaşıyor** (14.0a)
3. Akran akını kaynakta zararda → **akınla filo fonlanamıyor** (14.0b)

Plan üçünü de hedefliyor: **3.1+3.2** (1), **3.3** (2). (3) hedeflenmiyor — ve hedeflenmemeli: akran PvP'sinin ödülü **Dominion**, tasarımın kendi kararı.

> **Dürüst sonuç: filocu her zaman biraz üretim basmak zorunda kalacak. Ama "5 gün kademe basmadan 50 gemi basamıyorum" durumu bitecek.**

Farmer kaynak için savaşmaya zorlanmıyor; **tanınmak** için zorlanıyor — tek sıralama Dominion. **3.4** bunu çözüyor.

#### S3 · "Ekonomik denge oturacak mı?" — **BÜYÜK ÖLÇÜDE, sim şartıyla**

| Sorun | Çözüm | Sonuç |
|---|---|---|
| L13→14 amortismanı **9,9 gün** | 0.1 deploy | **4,0 gün** |
| L15→16 **22,3 gün** | 0.1 deploy | **5,6 gün** |
| Hâlâ 4–9 gün (sahip: *"3-5 gün saçmalık"*) | 4.1 costGrowth 1,32 | **L12 ~1 gün, L16 ~2 gün, L20 5,4 gün** |
| L5–L9 ölü bölgesi (kazanç 190→103 düşerken maliyet 6× artıyor) | 4.2 | Kapanır |
| L10 ve L12'deki iki süreksizlik | 4.1 (istisna silinir) | Tek parça eğri |
| Kristal taşması (gelir 2:1, harcama 4:1) | 4.3 | Oturur |

> Gün batımı korunuyor ama **doğru yere** taşınıyor: 30 günlük sezonun ~24. günü.

#### S4 · "Absürt upgrade maliyetleri / ani verimlilik düşüşü" — **EVET**

İkisi de aynı kökten: **maliyet ×1,55 büyürken marjinal kazanç ×1,07 büyüyor → amortisman ×1,45/rung, üstel.** Sezon ise sabit 720 saat.

Ve bu sezon uzatılarak çözülemez: `log(2,14)/log(1,5) = 1,88` — **sezonu iki katına çıkarmak 2 rungdan az kazandırıyor.**

4.1 bu oranı 1,45'ten ~1,20'ye indiriyor. Kök neden ortadan kalkıyor, semptom yamanmıyor.

---

### 14.5 · Sıralama gerekçesi

```
Faz 0  → bekleyen düzeltmeler, risk yok
Faz 1  → ekonomiye dokunmaz; Faz 2'nin ÖN ŞARTI
Faz 2  → güçsüz nefes alır; güçlü akranına yönelir (Faz 1 olmadan PvP ölür)
Faz 3  → iki yol açılır (3.3 olmadan Faz 4 filocuyu boğar)
Faz 4  → eğri düzelir (sim şartı; 3.3 ön şart)
Faz 5  → dağıtım; ayrı tasarım turu
```

**Atlanmaması gereken üç bağımlılık:**
1. **1.1 olmadan 2.1–2.2 gönderilmez** → "kimse kimseye dokunamıyor"
2. **3.3 olmadan 4.1 gönderilmez** → filocu yolu tamamen kapanır
3. **2.2 olmadan 2.3 anlamsız** → kapatacak istismar yok

---

# 15 · FİNAL PLAN — Codex ile 4 turluk tartışma sonrası

**Yöntem:** Codex bağımsız analiz yaptı (benim bulgularım verilmeden), sonra 4 tur karşılıklı
itiraz. Her iki tarafın da iddiaları koddan doğrulandı. Aşağıdaki plan o tartışmanın çıktısıdır ve
**tartışma sırasında ölümüne itiraz edilmiş** hâlidir.

## 15.1 · Konsept sorusunun cevabı

> **Ekonomik zaman Astera'nın MUHASEBE DİLİDİR, değer teorisi değil.**

İkimiz de bağımsız olarak aynı yere vardık. Astera bunu zaten kısmen uyguluyor
(`profileInvoice(income, hours)`). Tutmamasının sebebi birim değil, **oran**: maliyet ×1,55/rung,
marjinal kazanç ×1,07/rung → amortisman ×1,45/rung üstel. Saat cinsinden yazmak bunu engellemedi.

**Zaman AKIŞI fiyatlar; kapasite, kilit ve koşullu değer STOKTUR.** Onları zamanla fiyatlamak için
kur uydurmak gerekir (`HANGAR_PRICE_STAGE`) ve her uydurma kur ölçülmemiş bir denge kararıdır.

**İkinci bir "muharebe zamanı" para birimi ÖNERİLMİYOR.** Bir uçuş-saatinin sabit değeri yok:
hedef kompozisyonuna bağlı. 51/49 duvar vakası bunu kanıtlıyor. Muharebe zamanı bir **KPI/payda**
olarak kalır, numeraire olarak değil.

## 15.2 · Tartışmada ölen öneriler *(geri getirilmeyecek)*

| Öneri | Sahibi | Nasıl öldü |
|---|---|---|
| `COMBAT.rounds` 3→5 | Claude | Ölçüldü: 3/4/5/6 turda mutlak kayıp aynı |
| Küresel yakıt indirimi | Claude | Mesafe-koruma ilişkisini kırıyor + tüccar enflasyonu |
| Enkaz köken ayrımı | Claude | 200v200'de −486.463, bugünden kötü. **Sahip 2026-09-21'de ayrıca kapattı:** enkaz kamusal kalır, çözüm hurdacının kalibrasyonudur |
| `extraRepair = k×min(kayıplar)` | Codex | Aritmetik iki tabanı karıştırıyor; k=1,153 gerekir |
| `protectedHoursCap` 8→20 | Claude | Zayıf oyuncuda %0 etki |
| Savunan karma-kompozisyon vergisi | (tartışıldı) | Deterministik mono-duvarı teşvik eder |
| "Counter gradyanı tersine çevirir" | Claude | Kargo + hurdacı maliyeti sayılmadan kanıtlanamaz |

## 15.3 · Faz 0 — Yanlış olanı düzelt *(tasarım kararı yok)*

| # | İş | Not |
|---|---|---|
| **0.1** ✅ | `FAULT.attackSpares` — ağır yenilgi, kalkanın söz verdiği üretimi kıramaz | **Yapıldı** |
| **0.2** ⚠ | **`matchupsAgainst` + saldırı ekranı kusuru** — bugün gönderdiğim kod 51/49 duvarı 100/0 gibi gösteriyor (Citadel kaybı 256.277 → 504.946 AE, **aynı tavsiye**) | **Düzeltilecek**, aşağıda |
| **0.3** | `paybackHours()` → `producerPaybackHours(building, level)`; `buildingCost` + o üreticinin kendi marjinal vektörü; Rafineri/Çıkarıcı/Tesis ayrı | L8'de 0,40×, L25'te 5,66× yanlış |
| **0.4** ✅ | `worthInvesting`'i üretici-dışına uygulamayı bırak **ve yerine amaç-özel sonlanma kuralı koy** (Core: tamamlanıp kullanılabilecekse · Tersane: açtığı gövde üretilebilecekse · Hangar: kapasite bağlayıcıysa · Kasa: beklenen taşma/yağma maruziyeti maliyeti aşıyorsa) | Aksi hâlde botlar wipe'tan hemen önce Kasa/Hangar alır. **İlk hâli yalnızca Core'u yaptı, kalanı tek 6 saatlik pencereye bağladı** (sahip review'u); `stillWorthBuilding` export edilip dördü de yazıldı, `termination-rules.test.ts` 13 test. Kasa'nın "kendini ödesin" hâli ölçülüp **geri çekildi** — bir sonlanma kuralı değil optimize edici; detay `reports/faz-0-1-code-review-2026-09-21.md` |
| **0.5** | `economy-goal-sim.ts` Core 12 + 4 uydu istiyor, `satelliteSlots(12)=3` | FAIL'i harness hatası |

### 0.2'nin doğru şekli

`forecastLines`/`shapesFor` **zaten doğru**: `DOMINANT` için saf duvarı ve her iki 50/50 kenarını
modelliyor. Kusur, benim o bilgiyi tek sınıfa çökertmem. Aynı makineyi kullanacak:

- **`DOMINANT`** → *"Ağırlıklı Mızrak — yarıdan fazla. Sur, bilinen çoğunluğu karşılar; kalan
  ölçülmedi ve Sur'u karşılayabilir."* Filo neredeyse saf counter ise: *"Gizli kalan kayıpları
  ciddi artırabilir — üst kayıp tahminine göre boyutlandır."*
- **`EVEN`** → *"Karma savunma — hiçbir sınıf %50'nin üstünde değil. Tek bir sert counter yok.
  Karma filo gönder ya da üst kayıp tahminine göre boyutlandır."* + *"Hedefin perdesinden 2 tersane
  seviyesi yukarıdaki bir sonda dağılımı açar."*
- **`SHARES`** → dağılımı olduğu gibi göster (*"%60 Mızrak · %40 Akıncı — Sur: %60'a güçlü, %40'a
  zayıf"*), tek ağırlıklı çarpana indirgeme.

**Özellik testleri:** okumayla tutarlı her gerçek duvar tahmin aralığında olmalı · daha iyi bir
okuma aralığı asla genişletmemeli · `DOMINANT` tavsiyesi 100/0, 60/40 ve 51/49'da doğru kalmalı ·
`SHARES` sıfır olmayan hiçbir sınıfı sessizce atmamalı.

## 15.4 · Faz 1 — Ölçüm omurgası *(hiçbir denge değişikliği öncesinde)*

**1.1 · Muhasebe defteri — üç ayrı şey, tek fonksiyon değil** ✅ **YAPILDI**

| Katman | İçerik | Durum |
|---|---|---|
| **Yetkili settlement** | Ortak saf primitifler; sunucu yolları onları tüketsin. **Paralel bir tahminci yazılmayacak.** PvP/korsan/nötr/klan kuralları farklı | ✅ `services/raidLedger.ts` işlenmiş settlement'ı (`missions` + `battleReports`) **okur**, ikinci bir savaş modeli yok. PvP şeridine kapsanmış; korsan akını kendi okuyucusunu ve yakıt sütununu istiyor (docblock'ta yazılı) |
| **Ekonomik muhasebe** | Gerçekleşen sonuçtan türet: `likit dönüş` (yağma+kurtarma−yakıt) · `yenileme-düzeltilmiş` (−kalıcı gövde kaybı) · `servet` (+ele geçirilen gövde). **Kamusal enkaz, biri gidip toplayana kadar saldıranın geliri değildir** | ✅ `rules/raid-ledger.ts`. `salvage` alanının sözleşmesi: *"Resources the surviving collectors actually lifted. NOT the field they left behind."* `denied` üç görünümün hiçbirinde yok — Dominion girdisi, saldıran geliri değil |
| **Deneme toplayıcı** | Varyans/yüzdelik/CVaR ayrı bir örnekleyicide. Tek defter varyans döndüremez | ✅ `rules/raid-trials.ts`: `distribution` (n · ortalama · popülasyon sd · p10/p50/p90 · CVaR) · `catastrophicShare` · `raidTrials`. **Örneklemez** — denemeleri çağıran üretir, içeride Rng yok, yoksa aracın kendi rastlantısı okumanın parçası olur |

Ek: **sıradan misyonda `fuelPaid` kalkışta kalıcılaştırılsın** (klan savaşı zaten yapıyor).
Kaynak vektörleri birincil kalsın — pozitif `netAE` yine de filocuyu yakıtsız bırakabilir.
✅ **Yapıldı** — `missions.fuel_paid` (migration `0107`, üç adımlı geri doldurma). Ödeyen yollar
(`mission.ts:377` · `movement.ts:286/386` · `clanAid.ts:477`) gerçek yakıtı yazıyor; sıfır yazan her
yol gerekçeli (sonda döteryum yakmaz · dönüş bacağı kalkışta tam ödenmiş · Ölüm Yıldızı'nda silahın
kendisi maliyet). Geri doldurulmuş eski satırlar **defter için kabul edilemez** (`fuelPaid <= 0` reddedilir).

**Filo-saati tanımı** *(Codex tur 4, tek tanım)*: `başlangıçta taahhüt edilen filo AE × planlanan
gidiş-dönüş süresi` — **hurdacı ve nakliye dâhil**, çünkü uçan bir ambar ne evi savunuyor ne bir şey
üretiyor. `perFleetHour` **yenileme görünümünden** bölünür; likit görünümden bölmek, yağmayla ama
filosuz dönen akını ucuz ve sağlam dönenin üstüne çıkarırdı. `perSlotHour` = aynı dönüş / saat.

**1.2 · Simülatör önkoşulu — faktöriyel koşudan ÖNCE** ✅ **YAPILDI**
`sim/season.ts` casusa **tam kompozisyonu** veriyordu (`composition: {...fleet, ...ground}`),
`probeAccuracy`/`classReading` kullanmıyordu. Bu hâliyle "hedefe özel counter" deneyi **her şeyi
bilmeyi** ölçüyordu.

Yapılan: `SimPlayer.intel` artık `SimIntel { stock, defence, reading: ClassReading, at }` taşıyor.
`probeIntel(scoutShipyard, hedef, t)` sunucunun `resolveProbe`'u gibi `garrisonOf(fleet, ground)`
hattını `probeAccuracy(SHIPYARD, VEIL)` ile okuyor; `expectedDefence` roster ortalaması yerine
**sınıf okumalarını** `expectedLineFromReadings` ile topluyor, hiçbir okuma sınıf çözmediyse
(`EVEN`/`UNREAD`/`NONE`) komutan kendi alışkanlığına düşüyor. Böylece Veil, simülasyonda da bir
duvara mahremiyet satıyor.

**Sahip review'u sonrası (2026-09-22) ikinci tur:** stok da ürün-sadık yapıldı. `probeIntel` artık
`computeLoot(..., vaultProtects(...), 'DECISIVE', MAX)` → `fuzzBand(...)` sırasını sunucunun
`resolveProbe`'u gibi izliyor; alan `stock` → **`takeable`**. Hedef seçimi de taranmış hedefin
**kendi Kasa/üretici seviyelerini okumayı bıraktı** (hiçbir sondanın bildirmediği olgular).

> ⚠ **AÇIK KALAN TEK ALAN — ateş gücü bandı.** `SimIntel.defence` hâlâ `fleetValue(line)`, yani
> kesin; sunucu onu `fuzzBand(combatValue, accuracy)` ile banda çeviriyor. Bu **bilinçli bir
> boşluktur, kapatılmış bir karar değil:** üç yeri birden oynatır (hedef seçimi, `defence × 1.8`
> vazgeçme eşiği, `commit` boyutlandırması) ve SV zaten sonda fixiyle beş tohumda bant altına
> indi. İki denge değişikliğini biri ölçülmeden üst üste bindirmemek için **Faz 4'ün eşli-tohum
> kalibrasyonuna** bırakıldı. Kompozisyon deneyi buna dayanmıyor; **akın sıklığı ve hedef seçimi
> deneyleri dayanır** — Faz 4'ten önce kapatılmalı.

**1.3 · Kabul kuralı**
> Faz 2–4'te hiçbir denge değişikliği, defterden gelen ön-kayıtlı senaryo matrisi ve **ürün-sadık
> istihbaratla** eşli-tohum sezon simülasyonu olmadan gönderilmez. Medyan yetmez: p10/p50/p90 +
> felaket kayıp oranı.

## 15.5a · Faz 2A — HAREKET PAKETİ *(oyuncuyu elde tutan madde)*

> **Bu bölüm Codex tartışmasında düşmüştü ve geri kondu.** Tartışma tamamen ekonomi/fiyatlama
> üzerineydi; bu maddeler onun çerçevesi dışında kaldığı için yeniden yazımda kayboldu. Chat
> analizinin **en güçlü elde-tutma bulgusu** buna bağlı: insanlar madenleri gittiğinde değil,
> **filoları öldüğünde** bırakıyor — `FevziYRT: Ben sabah kalktım sıfırım. Hiç birşeyim kalmamış`.

| # | İş | Kısıt |
|---|---|---|
| **2A.1** | **Uçuş hızı seçimi** | Maks. ~12 saat. *Çevrimdışı savunma — çalışan hedef kitlenin maddesi*. **SAHİP KARARI 2026-09-21: TÜM seferlerde açık, saldırı dâhil.** Klan ortak saldırısı senkron varış kazanır; bedeli, saldıranın varış saatini seçebilmesidir — plan bunu `yavaş = çok radar ihbarı` ile kendiliğinden dengelenmiş sayıyor. **Hız yalnızca SÜREYİ değiştirir, yakıtı asla** |
| **2A.2** | **Kendi dünyasına geri çağırma** | Dönüş **uçulmuş süre kadar** (anında değil, yoksa "filoyu dışarıda yakala" taktiği ölür); dönen filo hangara her zaman sığar |
| **2A.3** | **Transfer cooldown** (varışta ~5 dk) | Geri çağırma cooldown'a takılmaz. Dalgalar 15–20 dk arayla geldiği için kovalamacayı bozmaz, `zıp-zıp` istismarını kapatır |
| **2A.4** | **Kendi dünyasına giden seferde yakıt indirimi** | **SAHİP KARARI 2026-09-21: %50.** Saldırı yakıtı **sabit kalır** — mesafe-koruma ilişkisi korunur. Gecelik fleetsave ödenebilir olur ama hâlâ bir maliyet taşır, yani içinde karar kalır |

**2A.1 DURUM ✅ — ne yapıldı:** `MISSION_PACES = [1, 0.75, 0.5, 0.25, 0.1]` + `FlightModifiers.pace`
(opsiyonel; atlanırsa tam hız — mevcut her çağıranın zaten uçtuğu hız) + `allowedPaces(dist, fleet,
mods)`, `TRAVEL.pacedFlightCapMinutes = 720`. Tavan **seçimi** sınırlar, uçuşu değil: tam hız hep
açık kalır, yoksa bin kişilik galaksinin hâlihazırda 12 saati aşan geçişleri yasaklanırdı.
`missions.pace` sütunu (migration `0108`, `DEFAULT 1`) — dönüş bacakları **her zaman 1**, çünkü
komutan varışı seçer, dönüşü değil ve saldırı geri çağrılamaz. Hız doğrulaması **yakıt kontrolünden
önce** çalışır: hiç yasal olmayan bir emir "paran yetmiyor" diye dönmemeli. Arayüz: `data-launch-pace`
satırı, seçilen rung tek-yön figürünü anında oynatıyor + iki kuralı satırda söylüyor (yakıt değişmez,
12 saat tavanı).

> ⚠ **Açık kalan — korsan şeridi.** Korsan kapalı yörüngede, bacağı bir **buluşma çözümü**; yavaşlatmak
> saati değil buluşma NOKTASINI oynatır ve `/api/pirates/raid` pace almıyor. Rungs orada gösterilseydi
> ekrandaki dakika değişir, sunucu tam hızda uçardı — yani ekran yalan söylerdi. Bu yüzden satır
> **yalnızca dünya hedeflerinde**. Korsan şeridi, intercept çözümü pace'i öğrendiğinde alacak.

**2A.2 DURUM ✅ — geri çağırma.** `POST /api/fleet/:missionId/recall` → `recallTransfer`. Yalnızca
**transfer**; saldırı geri alınamaz kalır (o geri alınabilirse akın bir bahis olmaktan çıkar).
Dönüş **uçulmuş süre kadar** — anlık dönüş "filoyu dışarıda yakala"yı silerdi, yani paketin
kendisini bir güvenlik düğmesine çevirirdi. Dönen filo **her zaman sığar** (`landingBlock` atlanır;
chat: `hangar dolu diye geri donuyordu`). Yakıt ne alınır ne iade edilir: uçuş kalkışta ödendi ve
havadaki filonun depoya erişimi yok. İki sütun: `missions.recalledAt` + `recallFrom` (Vec3) —
dönüş **döndüğü noktadan** çizilir; yoksa disk filoyu eski hedefine ışınlayıp oradan eve uçururdu.
`arriveAt` yeni inişle **üzerine yazılır**, böylece kuyruk/radar/geri sayım tek alan okur.
Arayüz: uçuş şeridinde Prospector geri çağırma satırının **birebir aynı şekli** — ikinci bir kontrol
öğretilmiyor. Buton yalnızca sunucu `recallable: true` derse çıkar; istemci tahmin etmez.

**2A.3 DURUM ✅ — transfer cooldown.** `TRANSFER_COOLDOWN_MINUTES = 5`, `planets.transferReadyAt`.
**Varışta** damgalanır (geri çağrılan iniş dâhil — zıp-zıp iki yönde de işler), **kalkışta** reddedilir.
Yalnızca transfer şeridi: takviye alan dünyanın oradan savaşamaması sürpriz bir nerf olurdu. Geri
çağırma bu duraklamaya **takılmaz**. Arayüz: transfer sayfası kalan süreyi buton üzerinde söylüyor —
yalnızca commit'te reddedilen bir kural, oyuncunun bir kararı kaybederek öğrendiği kuraldır.

**2A.4 DURUM ✅ — %50 yakıt.** `FUEL.laneShare = { HOSTILE: 1, HOMEWARD: 0.5 }`, `missionFuel`'e
opsiyonel `lane`. Pay **bacak başına yuvarlamanın İÇİNDE** uygulanır: en kısa sıçrama bile bir damla
öder ve `fuelMass` tamsayı kalır. Yalnızca transfer (iki ucu da aynı komutanın dünyası, kodda
zaten doğrulanmış). Transfer sayfasında tek satır neden ucuz olduğunu ve **sınırını** söylüyor.

> ⚠ **Ölçülecek etkileşim (sahibe not):** 2A.1'in 12 saat tavanı **tek bacağı** sınırlar. Geri
> çağırma ile azami havada kalma ~2× tavana çıkar (12 sa dışarı + 12 sa geri). Filo havadayken
> vurulamadığı için bu, yarım bacak yakıta ~24 saatlik dokunulmazlık demek. 2A.3 tekrarı kapatıyor
> ama süreyi kapatmıyor. Plan bunu böyle istiyordu ("dönüş uçulmuş süre kadar" ŞARTI); yine de
> Faz 4 eşli simülasyonunda **ölçülmesi gereken** bir sayı.

**Ön şart: 0.2 (counter yüzeyi).** Filo kurtarılabilir hâle gelince güçlü, akranına yönelmek
zorunda kalır; akran dövüşünün okunabilir olmaması hâlinde sonuç *"kimse kimseye dokunamıyor"*
olur — Grup B'nin (yakıt) zaten ürettiği *"maliyet yüzünden barış var"* durumunun daha kötüsü.

**Neden fiyat değişikliklerinden daha güvenli:** kimse "geri çağırma yok" için eski bir fiyat
ödemedi. Kohort adaletsizliği yaratmıyor, dolayısıyla koşan sezona girebilecek tek Sınıf B
maddesi bu.

**Ölçülecek:** p50/p90 yenilgiden sonra yeniden inşa saati · tekrar saldırıya uğradığında hâlâ
toparlanma altında olanların oranı · filo kaybı sonrası churn.

## 15.5b · Faz 2B — Filo yolu BANKALANABİLİRLİĞİ *(sıra: invariant → kapı → fiyat, tek paket)*

| # | İş |
|---|---|
| **2B.1** | **Bankalanabilirlik invariantı**, AE değil **kaynak başına**: `hangarCost.alloy ≤ marj × alloyCap(filo-yolu referans durumu)` ve kristal/döteryum için aynısı. "Erişilebilir depo" yetersiz — Rafineri 18 teknik olarak erişilebilir ama ekonomi-yolu sorununu korur |
| **2B.2** ✅ | **Kapı mimarisi**: Tersane = fiziksel tier kapısı · Engineering = gövde izni · doktrin **L2'de rol-ilgili tek bir gereksinim** gövdeyi açar · L3–5 opsiyonel uzmanlaşma. *(Örn. Citadel: Engineering 2 + Zırh 2, bugünkü Zırh 4 + Güç 2 yerine.)* **Doktrini tamamen opsiyonel yapmak test edilmeden gönderilmez** — evrensel karma rostere iter ve alt-teknolojili T4'ü "hazır" gibi gösterir. **Yapıldı**, aşağıda |
| **2B.3** ✅ | **Hangar fiyatı**, yeniden tasarlanmış merdivenden türetilir: rung başına **yazılı referans formasyon** (Core kapısının desteklemeyi amaçladığı muharebe tier'ı), `HULLS`'tan dinamik "en ucuz" okuma **yok** — bir gövde dengesi değişikliği altyapıyı sessizce yeniden fiyatlandırmasın |
| **2B.4** ✅ | **Core 16 uçurumu**: H7–H10 hepsi Core 16'da açılıyor (2.290 → 7.270, ×3,17). Bugün onları yalnızca aşırı fiyat pacing'liyor. Ucuzlatırken ya kapıları sonraki Core'lara yay, ya Core-içi anlamlı bir fiyat/zaman rampası bırak |
| **2B.5** ✅ | **Klan etkisi before/after'a dahil**: klan hangarı kişisel odanın tam iki katı ve **kişisel `buildingCost('HANGAR')`'ı yeniden kullanıyor**. Kişiseli ucuzlatmak klan kapasitesini bedava ikiye katlar. Transfer/klan hediyesi de alıcının hangar tavanını zorluyor |

**Ölçüm birimi:** "ilk işe yarar donanma" paketi — `Core + Tersane + Engineering + gerekli doktrin
+ Hangar artışı + muharebe kanadı + kargo + hurdacı + ilk on kalkışın yakıtı + kuyruk süreleri`.
Filo yolunun gerçek bariyeri budur; parçalar ayrı ölçülmez.

### 2B.6 ✅ **YAPILDI** — Hangar'ın Komuta Merkezi bağı kesildi *(sahip kararı 2026-09-22)*

> *"Komuta merkezini level atlamadan istedigim gibi hangar'ı level atlatabileyim. Yoksa filocu olan
> kullanıcılar komuta merkezi level atlatmak zorunda kalıyor… Tier atlamadan bir kullanıcı filocu
> olabilmeli."*

Kapı 2026-09-18'de **bilerek** konmuştu: komutanlar Core'u düşük tutup yeni oyuncu bandında kalarak
sınırsız filo basıyordu. Bunu sahibe hatırlattım; cevabı: *"Komuta Merkezine level atlatmayan
kullanıcı rafinerilerine de level atlatamaz ve çok fazla filo basamaz."*

**Ölçüldü, argüman doğrulandı.** Core 4'te (Rafineri de en fazla 4 olabilir, çünkü hiçbir bina
Core'u aşamaz):

| | Hangar 1→10 merdiveni | Dolu hangar (908 Balista) | **Toplam** |
|---|---|---|---|
| Core 4 | 64,7 gün | 166,9 gün | **231,6 gün** |
| Core 7 | 32,9 gün | 124,7 gün | 157,6 gün |

Sezon ~30 gün. Üstelik Core 4'te depo tavanı **8.355**, geç bir rungun fiyatı 71.760 — o fiyatı
**bir anda tutamıyor** bile. Yani Core kapısı, üretim eğrisinin zaten reddettiği şeyi ikinci kez
reddediyormuş. İki sınır yerine bir sınır kaldı: **cevher.**

**Yapılan:** `hangarCeiling` artık her Core'da merdivenin tepesini döndürüyor; sunucudaki
`assertHangarRung` yalnızca "en üstte" refüzünü tutuyor; arayüzde Hangar satırı Core gereksinimi
yazmıyor. `HANGAR.coreGate` tablosu **satın alma kapısı olmaktan çıkıp aşama haritası oldu** —
`hangarSeedLevel` (bir dünyaya *hediye edilen* rung: nötr şablonlar, göç eden dünyalar) ve
`NAVY_RUNG_TIER` onu okumaya devam ediyor.

> ⚠ **Yakalanan yan etki:** `hangarSeedLevel` `hangarCeiling`'den türüyordu; kapı kalkınca
> galaksideki **her dünyaya bedava rung 6** verecekti. Kendi Core eşlemesine bağlandı.

`hangar-free-of-core.test.ts` (5 test) ölçümü tutuyor: bir üretici yeniden ayarı düşük Core'u bu
merdiveni sezon içinde tırmanabilecek kadar zenginleştirirse, eski kapının kapattığı istismar geri
gelir ve **orada kırmızıya döner.**

### 2B.3 + 2B.4 + 2B.5 ✅ **YAPILDI** — Hangar fiyatı, Core 16 uçurumu, klan bağı

**Sahip kararı 2026-09-22.** Ölçülen kusur: bir rungun fiyatı, açtığı yere sığan filonun
**%5 · %4 · %13 · %14 · %51 · %60 · %77 · %100 · %133**'ü. Son rung, içine koyacağın her gemiden
**üçte bir fazla**; ve Core 16'da komutanın tüm alaşım deposu 50.252 iken fiyat 931.263 — **on sekiz
depo dolusu**. Depo tavanını aşan üretim taşıp kaybolduğu için bunlar pahalı rung değil,
**satın alınamaz** rungdu.

**Kural:** açılış rungları aynen kalır (yeni oyuncu bu düzeltmenin bedelini ödemez); **6'dan
itibaren bir rung, açtığı yere sığan formasyonun ÜÇTE BİRİ kadar tutar**, formasyonun kendi
kaynak karışımında.

| Sv | Toplam yer | Toplam Citadel | Bugün A/C | Yeni A/C | Değişim |
|---|---|---|---|---|---|
| 2–5 | 180–1.550 | 10–91 | — | **değişmedi** | %0 |
| 6 | 2.290 | 134 | 112.768 / 30.361 | 71.760 / 17.940 | −%35 |
| 7 | 3.250 | 191 | 263.137 / 70.845 | 136.509 / 36.400 | −%45 |
| 8 | 4.400 | 258 | 401.341 / 108.054 | 163.324 / 43.550 | −%57 |
| 9 | 5.740 | 337 | 611.596 / 164.661 | 190.138 / 50.700 | −%67 |
| 10 | 7.270 | 427 | 931.263 / 250.725 | 219.390 / 58.500 | −%75 |

**Fiyat YAZILI, çalışma anında hesaplanmıyor** (`HANGAR_LATE_COST`, `economy-profile.ts`) — 2B.3
bunu açıkça istiyor: bir gövde dengelemesi altyapıyı sessizce yeniden fiyatlandırmasın. Üçte bir
ilişkisi `hangar-price.test.ts` ile bağlı, yani bir dengeleme testi **kırmızıya** çevirir (gürültülü)
ekonomiyi sessizce oynatmaz.

> **Bu kararın oyuna yazdığı cümle:** *gemileri koyacak yerin varsa, cevheri koyacak yerin de
> olmalı.* Kasa yapmayan komutanın deposu 50.252; 6. rung bile 71.760 istiyor, sığmıyor. Kasa'yı
> Core'la büyüten komutanın deposu 402.019 — **artık tüm merdiven sığıyor.** Filocu Kasa'yı
> atlayamaz; karşılığında üst Hangar seviyeleri gerçekten alınabilir hâle gelir.

**2B.4 — Core 16 uçurumu: fiyat rampasıyla çözüldü, kapılar yayılmadı.** Ölçüm: 6→10 kümesi
781.121 alaşım = Core 16'da **10,2 günlük üretim** (sezon ~30 gün), üstelik odayı dolduracak tek bir
gemi yapılmadan önce. Süre pacing'i yok (`buildMinutes` beşinde de `BUILD.capMinutes` tavanında) —
**pacing cevherde.** Kapıları 17–20'ye yaymak ölçüldü ve bırakıldı: bankalanabilirliği %8'den ancak
%12'ye çıkarıyor, yani tek başına çözmüyordu ve onaylanan fiyat değişikliğinin üstüne ikinci bir
değişiklik bindirecekti.

**2B.5 — klan bağı: fiyat ayrıldı ve 2× yapıldı** (sahip kararı). Klan rungu iki kat oda alıp
kişisel faturayı ödüyordu; kişisel merdiveni %35–75 ucuzlatmak klanlara aynı indirimi **bedava
ikinci kez** verecekti. Artık klan iki kat oda için iki kat ödüyor: **birim oda başına fiyat
kişiselle birebir aynı**, her rungda — ve kişisel merdiven bundan sonra ne yaparsa yapsın öyle kalır.

### 2B.2 ✅ **YAPILDI** — kapı mimarisi

**T3 zaten uyuyordu**; uymayan T4'tü. Dört gövde iki doktrin taşıyordu, üçü birini **L4'te** —
yani "T4 duvarını aç" pratikte "araştırma ağacının çoğunu satın al" demekti.

| Gövde | Önce | Sonra |
|---|---|---|
| CATACLYSM | ENG2 + Güç **4** + Zırh 2 | ENG2 + **Güç 2** |
| CORSAIR | ENG2 + Güç 2 + İtki **4** | ENG2 + **Güç 2** |
| CITADEL | ENG2 + Zırh **4** + Güç 2 | ENG2 + **Zırh 2** *(planın örneği)* |
| PALADIN | ENG2 + Zırh 2 + Güç 2 | ENG2 + **Zırh 2** |
| ARGOSY | ENG2 + İtki 2 | değişmedi |

Rol eşlemesi T3'ün zaten kurduğu kural: **Hücum → Güç · Savunma → Zırh · Kargo → İtki**
(`DOCTRINE_OF_FAMILY`, `DOCTRINE_OPENS_AT = 2`, `hullDoctrine`). Uzmanlar istisna ve yazılı:
Nullifier'ın izni taşıdığı silahtır (Gravitic Charges), Hurdacı'nınki yalnızca ENG.

**Doktrin opsiyonel YAPILMADI** — plan bunu açıkça yasaklıyor. Kural şu hâlde: her T3+ gövde
**tam olarak bir** doktrin ister, ve **hiçbir gövde açılış rungunun üstünde doktrin istemez**
(L3–5 artık gerçekten uzmanlaşma). `gate-architecture.test.ts` bunu kural olarak tutuyor (10 test).

**Ölçülen etki — T4 paketi:**

| | Önce | Sonra |
|---|---|---|
| Doktrin | 336.947 AE (%15,7) | **43.465 AE (%2,4)** |
| **Toplam** | 2.140.599 AE | **1.847.117 AE** (−%13,7) |
| Kuyruk | 75,1 sa | 67,7 sa |
| Üretimle kazanma (Core 6) | 87,1 gün | 46,6 gün |

> Hâlâ tek başına üretimle ulaşılamaz — çünkü Hangar (%34,9) ve kanat dokunulmadı. Kapı
> değişikliği kendi işini yaptı ve geri kalanı çözüyormuş gibi yapmadı: **adım 7 (Hangar fiyatı)
> ve adım 8 (dış gelir)** duruyor.

**Fiyat değişmedi** — bu adım yalnızca araştırma kapılarına dokundu.

### 2B.1 + ölçüm birimi ✅ **YAPILDI** — `packages/rules/src/navy-package.ts`

İki alet, 14 test (`navy-package.test.ts`). **Hiçbir fiyat değişmedi**; bu adım yalnızca ölçer.

**(a) Bankalanabilirlik invariantı.** `fleetPathReference(core, vault=0)` → üreticiler **Core'a
sabitlenir** (oyun zaten bir binanın Core'u aşmasına izin vermiyor, yani bu filo yolunun
*en cömert* hâli; burada sığmayan hiçbir yerde sığmaz). "Erişilebilir depo" reddedildi: Rafineri 18
teknik olarak erişilebilir ama o, ekonomi yolunun dünyasını ölçmek olurdu. Kasa bir **girdi**,
varsayım değil — filocunun atladığı tek bina odur ve Core 16'da tavanı 8 kat oynatır.

`hangarBankability(rung, ref)` → **kaynak başına**, AE değil. Ölçüm:

| Rung | Core | Kasa 0: A oranı | Kasa=Core: A oranı |
|---|---|---|---|
| H4→5 | 13 | 0,96 | 0,16 |
| **H5→6** | 16 | **2,24** | 0,28 |
| **H6→7** | 16 | **5,24** | 0,65 |
| **H7→8** | 16 | **7,99** | 1,00 |
| **H8→9** | 16 | **12,17** | 1,52 |
| **H9→10** | 16 | **18,53** | 2,32 |

> **Bu "pahalı" değil, "imkânsız".** Depo tavanı aşıldığında üretim taşar ve **kaybolur** — yani
> fiyatı tam deposundan büyük bir rung, sabırla alınabilen bir rung değildir. Filo yolunda
> **6. rungdan itibaren beş rung satın alınamaz**; Kasa'yı da tam yapan komutan için bile 9 ve 10
> imkânsız kalır. Chat'in *"satın alınamayan seviye"* dediği şey bu, artık kaynak başına ve bir
> Core seviyesine çivilenmiş hâlde.

**(b) İlk işe yarar donanma, tek figür.** Referans formasyon **yazılı** (`NAVY_RUNG_TIER` +
`NAVY_TIER_HULL`) — `HULLS`'tan "en ucuz" okuma yok; okusaydı her rungda DART derdi ve geç rungları
tier-1 kanadına göre fiyatlardı (Codex turundaki 3 kat sapmanın sebebi buydu).

| | T2 (58 Viper) | T3 (92 Balista) | T4 (56 Citadel) |
|---|---|---|---|
| **Toplam** | **168.741 AE** | **669.717 AE** | **2.140.599 AE** |
| Kuyruk | 5,5 sa | 30,4 sa | 75,1 sa |
| Muharebe kanadı | %51,8 | %50,9 | **%31,4** |
| Hangar | %2,6 | %9,8 | **%30,1** |
| Araştırma (Eng + doktrin) | %0 | %16,0 | **%25,3** |
| Yakıt (10 kalkış) | **%27,7** | %14,3 | %6,3 |
| Hurdacı | **%15,4** | %3,9 | %1,2 |

> **YENİ BULGU — bariyer tier'a göre YER DEĞİŞTİRİYOR.** T2'de gemi değil **yakıt + hurdacı**
> (%43,1); T3'te **kanadın kendisi**; T4'te **altyapı + araştırma** (%55,4, kanadın neredeyse iki
> katı). Tek bir "hangar pahalı" cümlesi üçünü birden açıklamıyor, ve üçü ayrı ilaç istiyor.

**Kazanma süresi** (paketi üretimle ödemek, tutulan Core'a göre, alaşım/kristal hattının yavaş olanı):

| | C4 | C7 | C10 | C13 | C16 |
|---|---|---|---|---|---|
| T2 | 5,9 g | 3,0 g | 2,2 g | 1,5 g | 1,0 g |
| T3 | 25,9 g | 13,2 g | 9,8 g | 6,6 g | 4,3 g |
| **T4** | 87,1 g | **44,3 g** | 33,1 g | 22,2 g | **14,5 g** |

> Sezon ~30 gün. **T4 donanması, kapının gerektirdiği Core'da (6) tek başına üretimle
> ulaşılamaz** — C16'da bile sezonun yarısı. Filocu yolunun dış gelire (Faz 3) bağımlılığı bir
> tercih değil, aritmetik bir zorunluluk. **4.1'i (üretici eğrisi) 3.3 olmadan göndermeme kuralı
> bu tabloyla doğrulandı.**

#### ⚠️ Düzeltme 2026-09-22 — paket kendi kapılarından geçmiyordu (review #5 + #6)

Yukarıdaki iki tablo (ve 2B.2'deki "Sonra" sütunu) **eski paketle** ölçüldü; eski paket iki
hatalıydı: (1) yalnızca savaş gövdesinin araştırmasını sayıyordu — kargo ve hurdacının kapıları
(Tersane 4 + Engineering 1; Atlas için `SHIP_PROPULSION 2 ← DENSE_FUEL_CELLS ← ISOTOPE_SPECTROMETRY`)
pakette yoktu, yani **ürünün üretemeyeceği bir filo** fiyatlanıyordu; (2) süreleri ürünün
kuyruk formülleriyle değil genel `buildMinutes`/profil dakikasıyla alıyordu. Şimdi paket her
gövdenin kapısını, önkoşul zincirini ve araştırmanın `requiredCore`'unu birleştiriyor; binalar
`buildingMinutes(tür, seviye+1)`, araştırma `researchMinutes(costAt(seviye), Core)` ile. Pakete
`fleet/core/shipyard/hangar/research` alanları eklendi; testler her tier'da her gövdenin
`hullBuildable` olduğunu, önkoşulların ödendiğini ve filonun Hangar'a sığdığını şart koşuyor.

| | T1 (1 Rampart) | T2 (58 Viper) | T3 (92 Balista) | T4 (56 Citadel) |
|---|---|---|---|---|
| Core / Tersane | 4 / 4 | 4 / 4 | 4 / 4 | 6 / 6 |
| **Toplam** | **123.653 AE** | **240.949 AE** | **747.797 AE** | **1.646.307 AE** |
| Kuyruk (iş toplamı) | 4,5 sa | 7,9 sa | 29,7 sa | 49,7 sa |
| Muharebe kanadı | %0,6 | %36,3 | %45,5 | %40,9 |
| Hangar | %0 | %1,8 | %8,8 | %23,2 |
| Araştırma (toplam) | %30,8 | %15,8 | %22,2 | %17,7 |
| ↳ kargo/hurdacı araştırması | — | — | %9,5 | %4,3 |
| Yakıt (10 kalkış) | %32,1 | %27,4 | %15,4 | %9,4 |
| Hurdacı | %21,0 | %10,8 | %3,5 | %1,6 |
| Kazanma C4 / C7 / C16 | 4,1 / 2,0 / 0,6 g | 7,9 / 4,0 / 1,3 g | 27,8 / 14,2 / 4,6 g | 67,7 / 34,4 / 11,3 g |

> **Yön değişmedi, büyüklük değişti.** T2 ve T1 artık hurdacı yüzünden Tersane 4 + Engineering
> 1 ister (Engineering 1 tek başına 38.055 AE); bu, "ilk filo"nun en ucuz basamağının bile bir
> araştırma bariyeri olduğunu gösteriyor. T3'te kargo zinciri paketin %9,5'i. T4'ün C16
> kazanma süresi ilk ölçümdeki 14,5 günden 11,3 güne indi (2B.2 kapısı + 2B.3 Hangar fiyatı + bu
> düzeltme birlikte). **T3/T4 ayrıca bedelsiz
> iki kapıya takılır:** Isotope Spectrometry sezon saatiyle (35. saat) açılır, Dense Fuel Cells
> kargo-sınırlı bir akınla keşfedilir — Atlas bu ikisinin arkasında. Bunlar maliyet değil zaman
> ve oyun kapısıdır; pakette fiyatlanmaz, burada not edilir.

## 15.6 · Faz 3 — Dış gelir *(TEK çarpan değil, ÜÇ ayrı deney)*

| Sistem | Karar |
|---|---|
| **Asteroid** | Act/referans-aşama ölçeklemesi uygun. **Sybil sınırı şart**: ölçek **spawn anında** dondurulup versiyonlanır (claim'de değil) · yeni hesap 24 saat / küçük Core eşiği geçene kadar **küresel spawn arzına katkı vermez** · ham 1 saatlik login yerine yuvarlanan/tavanlı uygun-aktif nüfus · korumalı/yeni oyuncu kaynağının klan yardımı ve transferle dışa akışı denetlenir |
| **Korsan** | **Act çarpanı YOK.** Hoard zaten roster değerinden ölçekleniyor; çarpan aynı riske daha çok ödül verir. Bunun yerine roster tier dağılımı / filo boyutu / spawn karışımı kaydırılır, mevcut roster→hoard ilişkisi fiyatı kendisi belirler. *"Doğru kompozisyon pozitif, yanlış negatif"* kuralı korunur |
| **Kurtarma (salvage)** ✅ **YAPILDI** | Dış gelir değil **lojistik**. Saat-tabanlı bedava çarpan, her eski hurdacıyı bir gecede kat kat değerli yapar. Yerine **satın alınabilir ilerleme**: üst tier hurdacı ya da kapasite merdiveni, açık maliyet/hacim/yakıt ilişkisiyle. **C1b'nin sahibi bu satırdır** — sahip 2026-09-21'de köken ayrımını kapatıp yönü buraya verdi: bugün 19.500 birimlik tek hurdacı ilk savaşta kendini ödüyor ve sonsuza kadar bedava çalışıyor; kademelendirilecek ve fiyatlandırılacak olan budur |

### Faz 3 · Kurtarma ✅ **YAPILDI** — hurdacı kalibrasyonu *(sahip kararı 2026-09-22)*

Sahip 2026-09-21'de enkaz köken ayrımını kapatıp yönü buraya vermişti (*"Hurdacıyı düzenleriz
kalibre ederiz"*). Verilen üç sayı: **taşıma 15.000 → 7.500 · kart yakıtı 50 → 100 · hangar alanı
14 → 40.** Fiyat değişmedi (13.000 alaşım + 6.500 kristal).

**Neden gerekiyordu, ölçümle:** hurdacı 26.000 AE'ye mal oluyor, seferde 15.000 kaldırıyor,
1.920 AE yakıt yakıyordu — yani **iki seferde kendini ödeyip sonsuza kadar bedava çalışıyordu.**
Chat'in *"eşit güçteysek bile adam kafa atıp geçiyor, hurdacı ile toplayıp geçiyor"* şikâyeti enkaz
kuralının değil bu aritmetiğin sonucuydu.

| | Önce | Sonra |
|---|---|---|
| Bir seferin net getirisi | 13.080 AE | **3.660 AE** |
| Kendini ödeme | 2,0 sefer | **7,1 sefer** |
| 600k'lık savaşın enkazı için gereken hurdacı | 12 | **24** |
| …gövde maliyeti | 312.000 AE | **624.000 AE** |
| …hangar alanı | 168 | **960** *(sv10 hangarın %13'ü)* |
| …seferin yakıtı | 69.120 AE | **92.160 AE** |

> Enkaz **kamusal kalıyor** ve **saldıranın alması engellenmiyor** — sahip kararı buydu. Değişen,
> almanın neye mal olduğu: artık hangarda savaş gemisiyle yarışan, her uçuşta döteryum yakan ve
> kendini yedi seferde ödeyen bir gövde. Yani bir karar.

`collector-calibration.test.ts` (7 test) sayıları ve gerekçeyi tutuyor. Eski figürleri sabitleyen
altı test sabitlerden türetilir hâle getirildi — bir sonraki kalibrasyonda "kural bozuldu" diye
kırmızıya dönmesinler diye.

**Kalan iki deney:** asteroid (Act ölçeklemesi + Sybil sınırı) ve korsan (çarpan YOK, roster
dağılımı kaydırılır).

## 15.7 · Faz 4 — Üretici eğrisi *(en son, eşli simülasyonla)*

- **`costGrowth` düz 1,32 mütevazı değil.** HEAD zaten L12'ye kadar 1,50, sonra 1,25. Düz 1,32
  HEAD'e göre: L5 **0,60×**, L12 **0,25×**, L20 **0,38×** — yani **ladder boyunca %40-75 fiyat
  kesintisi**, "L12 istisnasını silmek" değil. Toptan yeniden fiyatlama olarak tanımlanıp simüle
  edilecek.
- **"Medyan edinme anında kalan sezonun %65'i" kuralı döngüseldir**: fiyatı düşürmek edinmeyi öne
  çeker, kalan süreyi artırır, daha yüksek fiyata izin verir. **İteratif kalibrasyon** + p25/p50/p75
  edinme zamanı, rungun rasyonel olduğu aktif oyuncu payı, kaynağın bir sonraki en iyi kullanımına
  karşı net faydası, depolama/kadans sonrası gerçekleşen toplama.
- **Faz 3 ile Faz 4 birlikte simüle edilir.** Ucuz üretici, oyuncuyu daha erken yüksek seviyeye
  çıkarır ve sabit act ödüllerine göre pasif geliri kaydırır.
- **Sahip kararı 2026-09-22: (a) bekle.** Canlı sezona ayrı bir eğri deploy'u yok; Faz 4 yeni sezonla gelir.
- **`8e83920` deploy'u buraya taşındı** *(Faz 0'dan çıkarıldı)*: 83 dosyaya dokunuyor, Faz 1 ölçüm
  kapısından önce bir denge değişikliği ve Faz 4'ün değiştireceği eğriyi deploy ediyor. Sezon
  ortasında kohort adaletsizliği yaratır (L16'yı eski faturayla alan vs yenisiyle alan). Acil
  görülüyorsa: **yalnız o değişiklik izole edilir, versiyonlanır, önceki alıcılara telafi kararı
  verilir ve "acil denge değişikliği" olarak duyurulur** — "yanlışı düzeltme" olarak değil.

### Faz 4.1 + 4.2 ✅ **YAPILDI** — tek üretici eğrisi *(sahip kararı 2026-09-22)*

**Sahip yönü:** *"3-5 gün saçmalık"* derken kastedilen L10–12. Bunlar bu ekonominin planında
**düşük** seviyeler; orada 3–5 günlük geri ödeme saçma. *"Önerileri dene ve planımıza uygun bir
ayar yap."* **0.1 kararı: (a) bekle.** Eğri yeni sezonda gelir.

**Canlı veri (EU-1, 45 gerçek oyuncu, `build_orders`'tan):** medyan Rafineri 4. günde 10'a, 5.
günde 11'e, 5,7. günde 12'ye çıkmış, sonra alan durmuş (L13'e 11 kişi, L14'e 4, L16'ya 1). Önde
24 gün sezon var. Eski eğride sim bu durmayı birebir tekrarlıyor (9. günde 11'de takılıyor).

**Ne yapıldı** (`ECONOMY_CURVE`, `economy-profile.ts`):
- **Tek eğri:** açılış (rung ≤6) kalibre edildiği gibi ×1,5. Sonrasında her rungun geri ödeme
  saati **×1,16** büyüyor. L12 fiyat istisnası silindi.
- **Her üretici rungu gerçekten eklediği üretime göre fiyatlanıyor.** Rafinerideki açılış
  takviyesinin sönmesi (ölü bölge, 4.2) ve L12 sonrası çıktı takviyesi artık geri ödeme eğrisini
  bükmüyor.
- **Geç çıktı takviyesi (sahip isteği 2026-09-20) KORUNDU.** Rafineri 14 ≥ 2.400/sa ve 15 ≥
  2.750/sa sahibin kendi isteği; ilk denemede silmiştim, `owner-request-2026-09-20.test.ts`
  yakaladı ve geri koydum. Planın "L12 istisnası" maddesi fiyat tarafını kastediyordu; raporun
  1,32 tablosu da takviye korunarak hesaplanmıştı.
- **Core kendi, daha yumuşak eğrisinde (×1,35) — sahip kararı 2026-09-23.** Hiçbir üretici Core'u
  geçemediği için tavana dayanan dünya her seviye için Core rungunu da ödüyor:
  - **Core eski eğride (×1,5) kalırsa:** simde üreticiler Core 12'de takıldı, değişiklik hiçbir
    şey yapmadı.
  - **Core üreticiyle aynı eğride (×1,16) olursa:** Core medyanı 30. günde 25'e çıktı. Zemin
    yuvası, uçuş yuvası, saldırı kademesi ve koloni sadakati Core **seviyesine** bağlı ve ~12–18
    için dengelenmiş; hepsinin yeniden ayarlanması gerekirdi.
  - **Karar:** Core, canlı oyunun zaten oynandığı aralıkta kalsın (canlıda 9. gün medyan 13, en
    üst 17). Sim 30. gün: medyan 17, en üst %10 19. Seviyeye bağlı hiçbir kural değişmiyor.
  - **Core'un açılış sonrası tarifi kristale kaydı (0,65/0,35 → 0,55/0,45).** Değer, geri ödeme ve
    süre aynı. Daha dik eğride Core bir seviyenin fiyatının çoğu olunca, kristal harcamasını
    `invariants.test.ts`'in tuttuğu tabanın (gelişin 0,6'sı) altına itiyordu; bu, sohbetteki
    "kristal birikiyor" şikâyetini büyütürdü. Oran artık 1–20. seviyelerde 0,74–0,93.
  - **Tavandaki bir dünyada seviyenin tamamı** (Core + Rafineri + Çıkarıcı): Core 12'de 2,6 gün,
    16'da 5,7 gün, 20'de 13 gün. L10–12'de oyuncular çoğunlukla Core'un altında (canlıda 9. gün
    Core 13, Rafineri 11), orada geçerli olan üretici amortismanı 1,0–1,4 gün.
- **Değişmeyenler:** açılış rungları (1–5), Kasa, Tersane, Hangar fiyatları. Testlerle sabit.
- **Oyuncu görüyor:** her üretici rungunun altında **"Kendini X içinde öder"** (ayrıntı ekranı,
  5 dil). Bu, oyuncunun sohbette elle yaptığı hesabın oyunun kendi aritmetiğiyle gösterilmesi.

| Rafineri rungu | Eski (HEAD) | **Yeni** |
|---|---|---|
| 6→7 | 19 sa | **13,5 sa** |
| 9→10 *(ölü bölge)* | 102 sa | **21 sa** |
| 10→11 | 88 sa (3,7 g) | **24 sa (1,0 g)** |
| 11→12 | 132 sa (5,5 g) | **28 sa (1,2 g)** |
| 12→13 | 103 sa | **33 sa (1,4 g)** |
| 15→16 | 168 sa (7 g) | **51 sa (2,1 g)** |
| 20→21 | 402 sa (16,7 g) | **108 sa (4,5 g)** → R20 dünyası için gün batımı **23,6. gün** |

**Sim (53 oyuncu, 30 gün, 5 tohum) — son ayar:**

| | Eski eğri | Core de ×1,16 (denendi) | **Son ayar (Core ×1,35)** |
|---|---|---|---|
| Rafineri medyanı 6 / 9 / 12 / 30. gün | 10 / 11 / 11 / 11 | 15 / 17 / 20 / 22 | **13 / 15 / 16 / 17** (en üst %10: 19) |
| Core medyanı 30. gün (en üst %10) | 12 (14) | 25 (26) | **17 (19)** |
| Zemin yuvası medyanı 30. gün | 140 | 270 | **190** |
| 30. günde filo değeri (medyan) | 12k | 60k | **28k** |
| Toplam akın | 21,4k | 24,1k | **24,3k** |
| ARR (bant 0,275–0,55) | 0,28–0,31 | 0,20–0,22 | **0,285–0,296 ✓** |
| TAX (bant 0,04–0,45) | 0,04–0,08 | 0,02–0,045 | **0,05–0,12 ✓** |
| SV (bant 0,10–0,30) | 0,045–0,050 | 0,086–0,093 | 0,049–0,055 |

Bu tablo yalnız **göreli** karşılaştırma içindir. `reports/sim-gerceklik-2026-09-22.md`'ye göre
sim'in servet/akın bantları gerçek oyunu ölçmüyor (gerçek TAX 0,14–0,28); **bantlara bakarak oyun
ayarlanmamalı.**

**Testler:** `producer-curve.test.ts` (12: eğri, gün batımı, Core'un kendi eğrisi, Core tarifi,
dokunulmayanlar) ve sim `core-range.test.ts` (30. günde Core medyanı 14–18, en üst %10 ≤ 20).
Güncellenen: `economy`, `deuterium`, `yard-ladder`, `invariants` (bilgi katmanının çapası Core
fiyatı yerine üretim saati), `hangar` (Hangar fiyatları sahibin koyduğu değerlerde sabit),
`termination-rules` (Core öncülü Tesis'e taşındı). Sim `season` ilerleme sınırı eski değerinde
(≤18) kaldı: 14 günlük test sezonunda en yüksek Core 15–16. Durum: rules 7 → 4 kırmızı (kalan
dördü eğriyle ilgisiz), sim 3 → 2 (TAX ve bilgili oyuncu — aşağıda §17.2), web 168 (yeni kırmızı
yok), sunucu 43 → 42 (yeni kırmızı yok), `pnpm typecheck` 0 hata, `pnpm lint` temiz.

## 15.8 · Her değişiklik için zorunlu rollout semantiği

- Bu sezon mu, sonraki sezon mu?
- Spawn / kalkış / satın alma anında ne donduruluyor?
- Mevcut satın almalar ve kuyruktaki emirler ne olacak?
- Üretilmiş asteroid, korsan ve raporlar için ruleset sürümü?

*(Bu depo üretilmiş nesne kimliğini denge değişiklikleri boyunca bilerek koruyor; act ölçeklemesi
aynı disipline uymak zorunda.)*

## 15.9 · Güçlü–güçsüz: ölçülecek metrikler

Ortalama akın P&L yetmez:

- savunanın servet ondalığına göre aldığı saldırı sayısı
- tekrar-vuruş yoğunlaşması
- p50/p90 yenilgiden sonra yeniden inşa saati
- tekrar saldırıya uğradığında hâlâ toparlanma altında olanların oranı
- hedef gücüne göre saldıranın filo-saati başına dönüşü
- yenilgi sonrası kalıcı churn *(canlı telemetri varsa)*

> **Tier bandı, bash limiti ve toparlanma kalkanı, bu ölçümler gereksiz olduklarını söyleyene kadar
> KALIR.** Counter döngüsünün savunmalı hedefi ekonomik kılması, mağdur dışsallıklarını
> fiyatlamaz.

## 15.10 · Uygulama sırası

```
1. 0.2 · 0.3 · 0.4 · 0.5   (kusur + ölçüm aracı + simülatör sonlanma politikaları)   ✅
2. Muhasebe defteri + deneme toplayıcı; kalkışta fuelPaid kalıcılaştır               ✅
3. Simülatör istihbaratını gerçek sonda doğruluğuna uydur                            ✅
4. Hareket paketi (2A) — 0.2 bittikten sonra, tek merge                              ✅
5. T3/T4 "ilk işe yarar donanma" paketlerini ve bankalanabilirlik invariantını tanımla ✅
6. Kapı gereksinimlerini yeniden tasarla                                             ✅
7. Hangar fiyatını ve geç-rung pacing'ini o paketlerden türet                        ✅
8. Asteroid / korsan / kurtarma: üç ayrı değişiklik, arz sınırlarıyla                ← SIRADAKİ
9. TEK üretici eğrisi kalibre et (HEAD'in geç eğrisi + sonra bir başkası DEĞİL), eşli simülasyon
10. Açık sezon/ruleset rollout kararıyla gönder
```

**Settlement, koruma, yakıt ve karma-kompozisyon "yapılmayacaklar" listesi, bu ölçümler oluşana
kadar aynen kalır.**

---

# 16 · ZAMAN-MERKEZLİ EKONOMİ MODELİ — hüküm

*Sahip brief'i (10 soru) + Codex ile 4 turluk tartışma. Her iki taraf da bağımsız olarak aynı
cümleye vardı.*

> **Ekonomik zaman Astera'nın MUHASEBE DİLİDİR, değer teorisi değil.**

Ve bu bir öneri değil **mevcut durum**: `profileInvoice(income, hours)` binaları ve araştırmaları
zaten saat cinsinden fiyatlıyor.

## 16.1 · Üç eleştiri, hepsi ölçülmüş

**(a) Birim, eğriyi belirlemez.** Rafineri yükseltmesi baştan sona saat cinsinden fiyatlı; yine de
L5'te kendi üretiminin **2,0 saati**, L20'de **34,9 saati**. Ölçek-değişmezlik gelmedi çünkü saat
tarifesi üstel seçilmiş (`0.5 × 1.5^(L-1)`), gelir polinom (`L^1.3`):
`amortisman büyümesi = 1,55 / 1,07 = ×1,45 per rung`. **Oranı yine sen seçiyorsun; tasarım orada.**

**(b) Zaman akışı fiyatlar, kapasite stoktur.** Hangar oda üretir, oran değil — fatura edilecek
gelir deltası yok, bu yüzden kod kur uyduruyor (`HANGAR_PRICE_STAGE`). Sonuç: oda başına alaşım
**6 → 456**, ve `cost/storageCap` üreticide 0,305, hangarda **2,76**.

**(c) Koşullu değer tek sayıyla fiyatlanamaz.** `SHIP_POWER` ve `SHIP_ARMOR` fiyatları birebir aynı
(L4 = 56.714A + 43.626C):

| | Saldıranın kendi kaybı | Savunanın kaybı | Grade |
|---|---|---|---|
| ARMOR 4 | **−%16,7** her ölçekte | 0 | değişmez |
| POWER 4 | **%0,0** her ölçekte | +%20 | 180v200'de PARTIAL→DECISIVE (yağma ×2) |

Değerleri oynanış biçimine göre ayrık, fiyatları aynı. **Ama bugünkü metaya bakıp POWER'ı
ucuzlatmak metayı pekiştirir** (Codex itirazı, kabul edildi): önce karşılaşma teşvikleri, sonra
fiyat.

## 16.2 · Yarım uygulama, hiç uygulamamaktan kötü

Saat cinsinden olan değerini korur; olmayan tam `rate(L20)/rate(L5)` = **7,2 kat** erir:

| | Rafineri 5 | Rafineri 20 |
|---|---|---|
| 1 Ballista | 3,30 saat | 0,46 saat |
| ortalama kaya | 2,29 saat | 0,32 saat |
| 1 hurdacı seferi | 21,16 saat | 2,95 saat |

Geminin erimesi **doğru** (ilerleme). Kayanın erimesi **ölümcül** (filocunun gelirini kapatır).
Aynı mekanizma, zıt arzu edilirlik.

> **"Her şeyi zamana bağla" yanlış.** Asıl soru her sistem için ayrı: *bu şey değerini korusun mu,
> erisin mi?* Brief bu soruyu gizliyor.

## 16.3 · Reddedilen: ikinci bir "muharebe zamanı" para birimi

Claude önerdi, Codex karşı çıktı, **Claude'un kendi ölçümü öldürdü**: referans angajmanda her gövde
sınıfı negatif çıktı, ve 51/49 duvarı bir uçuş-saatinin sabit değeri olmadığını kanıtladı — par
sondanın **aynı** okuduğu iki duvara karşı Citadel kaybı **256.277 → 504.946 AE**.

**Muharebe zamanı KPI/payda olarak kalır, numeraire olarak değil.**

## 16.4 · Hangi sistem hangi tabandan fiyatlanmalı

| Sistem | Taban |
|---|---|
| Üretici · depo/works · yakıt · kayıp · toparlanma | **Üretim-saati** ✅ doğru birim |
| **Hangar kapasitesi** | Eklenen odayı dolduran **yazılı referans formasyonun** %25-35'i. "En ucuz legal" değil (Core 16'da Ok legal → 43.680 AE), `HULLS`'tan dinamik okuma hiç değil |
| **Kilitler/kapılar** | **İlk işe yarar formasyona oran.** Bugün T3 = 3,0× · T4 = 6,1×. Hedef ≤0,5–1,5× |
| **Saldırı/zırh araştırması** | Eşli-tohum savaş simülasyonu; kalan-sezon beklenen faydanın %30-60'ı. **Oynanış biçimleri arasında asla ortalanmaz** |
| **Yeni mekanik** | Sıfır fiyatla prototip → ölç → fiyatla |

Kaynağa çevirirken: oyuncunun **canlı gelirine göre fiyatlama yok** (sandbagging'i teşvik eder),
sabit referans kohort. `1:2:32` evrensel değil — L12'de tam, L6'da `1:2,5:37,4`.

## 16.5 · Çalışmanın en değerli çıktısı

Astera'da **"ekonomik zaman"ın birbiriyle uyumsuz birden fazla anlamı var**:

- `paybackHours()` legacy eğriyi okuyor → L8'de gerçeğin **0,40×**'i, L25'te **5,66×**'sı — ve bunu
  kullanan `worthInvesting`, **simülatörün inşaat kararlarını** veriyor
- `fleetValue` = **A+C+D**, `resourceValue` = **A+2C+32D** — bu oturumda Claude ikisini aynı tabloda
  karıştırdı, Codex yakaladı; akın kârlılık tablosunun tamamı yeniden hesaplandı

> **Kimsenin zorlamadığı ortak birim, hiç birim olmamasından kötüdür** — çünkü herkes sayıların
> karşılaştırılabilir olduğuna inanır.

Planın omurgasının (§15.4) neden "tek muhasebe defteri" olduğu budur. Konsept doğru; eksik olan onu
**zorlayan** yapı.

## 16.6 · Tartışmada ölçümle çöken yedi öneri

Beşi Claude'un, ikisi Codex'in. Ayrıntı §15.2'de. Kayda değer olan: **ikimiz de kendi
önerilerimizin çoğunu kendi ölçümümüzle öldürdük** — plan bu yüzden tartışma öncesi hâlinden
küçük ve daha ihtiyatlı.

## 16.7 · Açık kalan tek büyük soru

Doğru counter'la akın gradyanının tersine dönüp dönmediği **kanıtlanamadı**. Ayna kompozisyonda
akın yalnızca ≤10 savunan gemiye karşı kârlı (maksimum kâr **sıfır savunanda**); doğru counter'la
ölçüm +126.234'e çıkıyor **ama** kargo sınırı ve 24 hurdacılık enkaz maliyeti hesaba katılmamış.
§15.4'teki defter bu sorunun cevabını verecek. **O cevap gelene kadar tier bandı, bash limiti ve
toparlanma kalkanı yerinde kalır.**

---

# 17 · KIRMIZI TEST ENVANTERİ — hangi faz sahibi

*Sahip kuralı: sırası gelmeden dokunma. Bu tablo, her kırmızı testin hangi fazda ele alınacağını
kaydeder; o faza gelindiğinde testin GÜNCELLENMESİ mi, BIRAKILMASI mı, SİLİNMESİ mi gerektiği orada
karara bağlanır. Körlemesine yeşile boyanmayacak.*

## 17.1 · `packages/rules` — **4 kırmızı** *(12'ydi; `valuation` Faz 1.1'de, eğri testleri Faz 4.1'de kapandı)*

| Test | Sahip faz | Neden |
|---|---|---|
| ~~`economy.test.ts › lifts the opening Alloy ladder 25% … by L10`~~ | **Faz 4.2** ✅ | **KAPANDI — güncellendi.** L10–12 profil; L13+ sahibin 2026-09-20 geç takviyesini taşıyor |
| `economy-profile.test.ts › links the other purchases and moving targets` | **BIRAKILDI** | Eğriyle ilgisi yok: kırılan satır `START` türetimi (açılış paketi, sahibin +%30 gövde metal geçişi). Açılış fiyatları değişmedi — `producer-curve.test.ts` kanıtlıyor |
| ~~`deuterium.test.ts › uses the monthly plant curve independently of contested mining`~~ | **Faz 4.1** ✅ | **KAPANDI — güncellendi.** 0,7 üretim kesintisinden önceki rakamı sabitliyordu; artık iki sahip çarpanını (kesinti + geç takviye) taşıyor |
| ~~`hull-deuterium.test.ts` (üç test)~~ | **Faz 2B.2** ✅ | **KAPANDI.** Kapılarla ilgisi yokmuş — üçü de D208 göçünün donmuş fiyat anlık görüntüsüydü. `CALIBRATED` artık **hangi gövdelerin** izotop ödediğini tutuyor, **ne kadar** ödediğini değil; onun yerine kalıcı kural yazıldı: *aile içinde tier başına tek figür, tier ile artar* (Hücum 0·2·6·20 · Savunma 0·3·8·25 · Kargo 0·12·48·130). Üçüncüsü **silindi** — göç günü yazılmış "bu değişiklik tek sütun geniş" muhafızıydı, göç bitti |
| ~~`valuation.test.ts › does not silently reprice the current Dominion fleet value`~~ | **Faz 1.1** ✅ | **KAPANDI — güncellendi.** Sabit fiyat (420/360) yerine **ilişki** doğrulanıyor; gövde dengelemesi artık valuation değişikliği gibi okunmuyor |
| ~~`yard-ladder.test.ts › charges a constant number of production-hours past the gate`~~ | **Faz 4.1** ✅ | **KAPANDI — güncellendi.** Kanarya öngörüsü yarı doğruydu: bükülme sahibin geç çıktı takviyesinden geliyor ve takviye korundu. Tersane yeniden fiyatlanmadı (tüm merdiven bir sezona sığma kuralını bozuyordu); sabit saat, Tersane'nin fiyatlandığı profil saatinde tutuluyor, geç dünya kendi saatinde biraz daha ucuza alıyor — açıkça yazıldı |
| `transport-ladder.test.ts › carries more than it cost, at every rung` | ~~Faz 2B.3~~ → **Faz 4.3** | **YENİDEN ATANDI (ölçümle).** Hangar formasyon referansıyla ilgisi yok; bu bir **gövde fiyat/hacim** kusuru. Ölçüm — hold/değer: COURIER **0,855** · WAYFARER 1,008 · ATLAS 1,078 · ARGOSY 1,149. Yani **açılış nakliyesi dolu hâlinde boş hâlinden ucuz**: 1.000 taşıyor, 1.170 ediyor. Testin kendi docblock'u bu kusurun bir kez düzeltildiğini yazıyor (*"a first rung that punishes the player for taking it"*) — geri gelmiş. Düzeltmek ya hold'u ya fiyatı oynatmayı gerektiriyor; ikisi de **4.3'ün (alaşım/kristal oranı) konusu**, ve bugünkü dört denge değişikliğinin üstüne beşincisini bindirmemek için oraya bırakıldı. **Canlı bir kusurdur, unutulmamalı.** |
| `pirates.test.ts › caps the deuterium a hoard can carry at a tankful` | **Faz 3.1** | korsan ödülü roster'dan ölçeklenecek |
| `intergalactic-convoy.test.ts › uses combat-only firepower …` | **Faz 3.1** | dış gelir yüzeyi |
| `academy.test.ts › makes the Academy exit whole for the rewards its lessons claimed` | **BIRAKILDI** | Teşhis edildi: çıkış kristali 1.461 < 1.600 — Akademi ödül tablosu, eğriyle ilgisi yok (açılış rungları değişmedi) |

## 17.2 · `packages/sim` — **2 kırmızı** *(HEAD 24 → 0.3+0.4 sonrası 9 → 1.2 sonrası 8 → review fixleri sonrası 7 → sim Hangar sınırı (review #7) sonrası 3 → Faz 4.1 son ayarı sonrası 2)*

> **2026-09-22 — sim artık Hangar'ı uyguluyor** (review #7): 14. günde Hangar'ını aşan bot 104/250 → 0/250.
>
> **2026-09-23 — Faz 4.1 son ayarından sonra** SV tohum testleri yeşil. Kalan iki kırmızı: **TAX** (50 oyunculuk sabit düzende) ve **bilgili oyuncu**. İkisi de sim'in gerçekle uyuşmayan yerlerinden geliyor (`reports/sim-gerceklik-2026-09-22.md`): sim TAX'ı 0,02–0,05 okuyor, gerçekte 0,14 (saldırmayanlarda 0,28); sim'de saldırıların %75'i püskürtülüyor, gerçekte %14. Oyun bu iki teste göre ayarlanmaz; önce sim düzeltilir.

| Test | Sahip faz | Neden |
|---|---|---|
| ~~`fleet-calibration.test.ts` (üç test)~~ | **Faz 1.1** ✅ | **KAPANDI — üçü de güncellendi.** Üçü de aynı kök nedendi: hatırlanmış fiyat sabitleri (`840`, `419`, `{750,180,2}`, `-420`). Hepsi `HULLS`'tan türetildi |
| `season.test.ts › SV holds its band` *(**5/5 tohum**)* | **Faz 4** | beş-tohum kapısı, eşli simülasyondan sonra. Sahip review'undaki sonda-sadakati fixi (kesin ham stok → `computeLoot` + `fuzzBand`) SV'yi beş tohumda **birlikte** 0,094–0,097'ye indirdi; bant `[0,10–0,30]`. Yani dağılım **daraldı** (daha sadık modelden beklenen) ve tümü tabanın %3–6 altında kaldı. `lootDecisive`'i şimdi oynatmak bir denge değişikliğini test düzeltmesi kılığında göndermek olur |
| `season.test.ts › TAX holds its band` | **Faz 4** | aynı |
| `season.test.ts › the informed archetype reaches the top rank on every seed` | **Sim kalibrasyonu** | **Tasarımın merkez iddiası, gevşetilmez** — testin kendi docblock'u *"her tohumda"* istiyor ve düşmesini *"tasarım hakkında bir bulgu"* sayıyor. Buraya daha önce yazdığım *"bulgu, hata değil; başa baş"* yorumu yanlıştı, geri alındı. **Canlı veri iddiayı doğruluyor** (2026-09-23, EU-1): Dominion sıralamasının ilk 6'sı en çok sonda atan çeyrekte (874–2.426 sonda), o çeyreğin medyan sırası 7 ve kazanma oranı %96. Sim'de 7 ve 99. tohumlarda birinci olan TURTLE: sim'in saldırganları kör gidiyor, %75'i püskürtülüyor (gerçekte %14) ve savunmacı kaybedilen gemilerden Dominion topluyor. Yani kırmızı, sim'in istihbarat modelindeki kusurdan geliyor (`sim-gerceklik` raporu, kalibrasyon 1). Oyun dengesi bu teste göre ayarlanmaz; sim düzeltilince yeşile dönmesi beklenir |

## 17.3 · `apps/server` ve `apps/web`

- `apps/server`: `fault-attack.test.ts › Death Star ilk vuruşu koloniye iki arıza bırakır` —
  HEAD'de birebir aynı mesajla kırmızı. Sahip faz: **bakılacak**, Ölüm Yıldızı yolu Faz 0'ın
  dışında.
- `apps/server`: **tam koşu 44 kırmızı / 2153 yeşil** (2026-09-22). Hiçbiri bu planın fazlarına
  bağlı değil ve 2A ile review fixleri arasında **tek satır değişmedi** (iki JSON koşusu
  birebir aynı küme). Üç ayrı terk edilmiş yönün artığı:
  - **"Hangar bir bina değil" yönü — 7 test.** `fleet-ceiling.test.ts` (6) `BUILDING_IDS`'in HANGAR
    içermemesini bekliyor; `contract.test.ts › GET /api/planet parses` gövdede `{ground, groundUsed}`
    bekleyip `{hangar, hangarUsed, …}` alıyor. Hangar hâlâ bir bina.
  - **"Ölüm Yıldızı / interceptor route'ları kapalı" yönü — 3 test.** `contract.test.ts` 404
    bekliyor, route'lar 200 dönüyor.
  - **Sensör erişimi / koloni slotu / nötr sahiplik — geri kalan.** `intel-states.test.ts` (3)
    RESOLVED bekleyip REMEMBERED/UNKNOWN alıyor (bin kişilik katmanlı galaksi erişimi),
    `world-memory.test.ts` (2), `fault-attack.test.ts` (1, yukarıda), ve
    checkpoint/speedrun/onboarding ölçüm harness'ları.

  Sahip faz: **ayrı temizlik işi.** (§17.3 envanteri ilk yazıldığında tam sunucu koşusu
  yapılmamıştı; bu döküm 2026-09-22'de iki tam koşuyla çıkarıldı.)
- `apps/web`: 36 dosya / 168 test, HEAD ile **birebir aynı**. Hiçbiri bu planın fazlarına bağlı
  değil; ayrı bir temizlik işi.

