# Savaş Sistemi v3 — Plan Taslağı (2026-10-25)

**Durum:** K1–K7 owner tarafından cevaplandı (2026-10-25, ✔ işaretli). Uygulama TDD ile başladı.
Prototip motor ve betikler oturum çalışma alanındaydı; kalibrasyon aracı Faz 3'te repoya taşınır.

Kapsam: savaş motoru (kim kime nasıl ateş eder), savaş içi kaçış, savaş öncesi filo kaçışı,
göreceli savaş gücü, sonda doğruluğu (%80 tavan), saldırı ekranı.

---

## 1. Bugün canlıda ne oluyor (3b953f9f)

Canlıdaki sistem 6 turludur. Her gemi ateşini rakibin bütün savaş gemilerine rastgele dağıtır,
tur sonlarında hasarlı gemiler kaçabilir.

| Sorun | Sonuç |
| --- | --- |
| Hasar herkese yayılıyor, kimse ölmüyor; ölüm ancak herkes aynı anda eşiği geçince geliyor | Güçlü taraf 1:1,4 ve üstünde **hiç gemi kaybetmiyor**, güçsüz topluca siliniyor (vantasia vakası: 0 kayıp) |
| Kale/Hisar gibi zırhlı filolar 6 turda birbirini öldüremiyor | 100 Kale – 100 Kale: kimse ölmüyor |
| Kıyamet/Balista gibi ağır silahlı filolar 1–2 turda bitiyor | Kaçış penceresi gelmeden filo yok oluyor |
| Kaçış zarı savaş bittikten sonra da atılıyor | Kazanan gemiler "kaçmış" sayılıyor, ganimet kargosu kayboluyor |
| "Ateş gücü" = silahlı gemilerin **maliyeti** | Counter, araştırma, kalkan, Aegis hesaba girmiyor |
| Sonda %100'e kadar kesin; araştırmaları tam seviye gösteriyor | Oyuncu garantiye oynuyor |
| Saldırı ekranı kayıp yüzdesi + "temizler/kırar" çizgileri gösteriyor | Garanti yoksa saldırılmıyor (owner gözlemi) |

**Canlı veri (son 30 gün, salt okunur):** 1.230 PvP savaşı yapılmış. Bunların 490'ında savunanın
silahlı hattı yokmuş. Silahlı 740 savaşın güçsüz tarafın değerine göre dağılımı şöyle:

| Güç aralığı | Savaş sayısı | Pay |
| --- | --- | --- |
| 0–25k | 535 | %72 |
| 25–100k | 160 | %22 |
| 100–300k | 34 | %5 |
| 300k+ | 11 | %1,5 |

Oranlara göre dağılım:

| Oran | Pay |
| --- | --- |
| 1:1–1:1,8 | %26 |
| 1:2 | %17 |
| 1:3 | %21 |
| 1:3,5 ve üstü | %36 |

---

## 2. Ölçümün ana bulgusu: fizik sınırı

**Kaçış, güçsüzün ateşini de götürür.** Güçsüz taraf filosunun yarısını kurtarmak için erken kaçarsa,
kaçan gemiler artık ateş etmez. Bu yüzden ek bir kural olmadan güçlü taraf çok az kayıp verir.

Tablondaki sağdaki sayı ("güçlü en az ne kadar kaybetsin") iki şekilde okunabiliyor:

- **Okuma A:** Güçlünün **kendi filosunun yüzdesi**. 1:2'de 200 gemiden 60'ı.
- **Okuma B:** Güçsüzün **filosu kadar**. 1:2'de 100 gemilik güçsüze karşı 30 gemi, yani 200'ün %15'i.

Ölçülen sonuçlar 24 senaryonun ortalamasıdır: 4 güç aralığı, saf/karma/counter filolar, araştırma
farkları. Her hücre **güçsüzde kalan % / güçlünün kaybı %** biçimindedir.

| Oran | Hedef (A) | Hedef (B) | Doğal kurallar | Törpü α=1,25 | Törpü α=1,75 | Canlı bugün |
| --- | --- | --- | --- | --- | --- | --- |
| 1:1,2 | 20 / 80 | 20 / 67 | 18 / 35 | 19 / 56 | 20 / 73 | – |
| 1:1,4 | 25 / 65 | 25 / 46 | 24 / 18 | 24 / 42 | 25 / 64 | – |
| 1:1,6 | 30 / 50 | 30 / 31 | 30 / 8 | 30 / 31 | 32 / 53 | – |
| 1:1,8 | 40 / 40 | 40 / 22 | 37 / 4 | 41 / 23 | 41 / 45 | – |
| 1:2 | 50 / 30 | 50 / 15 | 46 / 3 | 48 / 16 | 51 / 33 | 5 / 0 |
| 1:3 | ? | ? | 43 / 1 | 66 / 3 | 69 / 22 | 30 / 0 |

- **Doğal kurallar:** güçsüzde kalan oran tutuyor, ama güçlü neredeyse bedava kazanıyor.
- **Üstünlük törpüsü (α):** güçlü tarafın hasarı, savaş başındaki güç oranının (R) α kuvveti kadar azaltılır.
  - α=1,25: Okuma B'yi tutturuyor. 1:2'de etkin oran 1:1,3'e iner.
  - α=1,75: Okuma A'yı tutturuyor. Ama güçlü taraf her oranda güçsüzden **daha çok gemi** kaybeder.
    1:3'te bile güçlü %22 kaybeder; savaş neredeyse eşit hasar takasına döner.
- **Sapma:** kompozisyon ortalamadan ±10–15 puan saptırıyor. Mızrak ağırlıklı güçsüz filolar daha çok
  hasar verir; saf Sur ve saf Akıncı filolar daha az.
- **vantasia – emrah savaşı:** maliyet oranı 1,44, yeni güç oranı 1,56. Canlıda vantasia 0 gemi
  kaybetti. Doğal kurallarda %15, α=1,25'te %35, α=1,75'te %52 kaybederdi. emrah'ta %17–25 kalırdı.

✔ **K1 (owner, 2026-10-25):**
- Sağdaki sayı, güçlünün savaşta **en az** kaybetmesi istenen kendi filo oranıdır (Okuma A).
- Soldaki sayı, güçsüzün elinde ortalama **en az** kalması istenen filo oranıdır.
- Başlangıç değeri α≈1,75. Kalibrasyonda oran başına ince ayar yapılabilir.
- Sonucu: güçlü taraf kazandığı savaşta güçsüzden daha çok gemi kaybeder. Kalibrasyon raporunda
  ayrıca gösterilecek.

---

## 3. Önerilen savaş motoru (v3)

### 3.1 Tur akışı

```
savaş başında:
  R = göreceli güç oranı (bölüm 4), güçlü/güçsüz taraf, kademe (güçsüzün gücü)
  tempo = iki filonun birbirini öldürme hızının geometrik ortalamasından hesaplanan hasar ölçeği
tur 1..8:
  iki taraf AYNI ANDA ateş eder (tur başındaki gemilerle)
    her silahlı gemi: rakibin savaş gemileri arasından 1 rastgele hedef seçer
      hasar = saldırı × (0,92–1,08 zar) × counter (1,6 / 1,0 / 0,625) × tempo × törpü (yalnız güçlü taraf)
      hedef: önce counter sınıfı (×1,6 → ×1 → ×0,625), aynı öncelikte rastgele
      sıra: Aegis → gemi kalkanı → gövde; hedef ölürse artan hasar başka rastgele hedefe geçer
    yük/destek gemileri, savaş gemileri bitene kadar hedef olmaz (bugünkü kural)
  kritik hasar: bu tur gövdesine hasar alan ve gövdesi %70'in altında kalan gemi (1 − gövde%) ihtimalle patlar
    (vurulmayan, önceden yaralı gemi kendiliğinden patlamaz)
  iki tarafta da silahlı aktif gemi kaldıysa ve son tur değilse: kaçış zarları (3.4)
bitiş: bir taraf yok oldu/kaçtı veya 8 tur doldu → derece, ganimet ve hasar bugünkü kurallarla
```

### 3.2 Hedef seçimi: tek hedef, sınıf önceliği korunur

- **Tek hedef:** Her gemi her turda tek bir hedefe ateş eder. Hedef ölürse artan hasar aynı
  kuralla seçilen yeni hedefe geçer. Sonuç gemi sayısından bağımsızdır: 3–3, 10–10 ve 100–100
  Kargı – Ok aynı sonucu verdi (%35–39).
- **Sınıf önceliği (owner, 25 Ekim — Codex işi):** Atıcı önce ×1,6 vurduğu sınıfı, yoksa ×1'i,
  en son ×0,625'i seçer; aynı öncelikte rastgele. Ölçüm (tek hedef, sıkı öncelik): karma
  counter filolarda sonucu en çok ±13 puan oynatıyor, gemi sayısından bağımsızlığı bozmuyor.
- **10 hedef kuralı kalkar:** 3 gemilik savaşta herkese, 100 gemilikte onda birine yayıldığı için
  sonuç gemi sayısına bağlı kalıyordu. Owner'ın "aynı güç, farklı sayı" testini geçmiyor.
- **Söndürücü ön ateşi korunur** (owner, 25 Ekim): Aegis varken her tur başında tüm Söndürücü
  bonusları normal atışlardan önce Aegis'e işler.
- **Yük/Hurdacı koruması aynı:** silahlı hedef kaldıkça hedef olmazlar.

### 3.3 Savaş temposu ✔

- **Sorun:** Gemi profillerinin öldürme hızı 5 kat farklı. Kıyamet aynası 1 turda biter, Kale
  aynası 6 turda bitmez. Bu yüzden kaçış bir filoda çalışır, ötekinde hiç çalışmaz.
- **Kural:** Her savaşta hasarlar tek bir ölçekle çarpılır. Böylece iki filonun ortalama tempoda
  turda dayanıklılıklarının ~%20'sini kaybetmesi sağlanır. Oranlar ve counter'lar korunur; yalnız
  savaşın hızı ayarlanır.
- **Etki:** 1:1 sonuçlarının sapması 1–50 aralığından 4–29 aralığına iner.
- **Oyuncuya görünüm:** Savaş raporunda "Savaş temposu ×0,46" satırı ve bir cümlelik açıklama.
- **Alternatifler:**
  - Mızrak statlarını yumuşatmak: denendi, sapma çok azalmadı.
  - Hiçbir şey yapmamak: Mızrak filoları kaçamaz.
- ✔ **K2 (owner, 2026-10-25):** Evet, tempo kuralı uygulanacak.

### 3.4 Savaş içi kaçış

- Her turun sonunda, son tur hariç, güçsüz tarafın her gemisi için zar atılır: gövdesi
  **eşik**in altındaysa **şans** ihtimalle kaçar. Yer savunmaları kaçmaz.
- Eşik ve şans güç oranına bağlıdır. Ara oranlar tablodan **doğrusal ara değerle** okunur;
  kova sınırında sıçrama olmaz.
- **Güçlü taraf kaçmaz** (R ≥ 1,2). 1:1 bandında iki taraf da aynı kademe değerlerini kullanır.
- Sabit kesim yerine yumuşak geçiş: 1,0–1,2 arasında güçlünün kaçış şansı sıfıra iner.
- **Hata düzeltmesi:** Rakipte aktif gemi kalmadıysa kaçış zarı atılmaz.
- Kalibre edilecek tablo şekli aşağıda. Örnek değerler α=1,25 ölçümünden; kesin değerleri Faz 3 belirler.

| Oran | Güçsüz: kaçış eşiği (gövde ≤) | Kaçış şansı/tur |
| --- | --- | --- |
| 1:1 (0–25k) | %30 | %30 (iki taraf) |
| 1:1 (25–100k) | %45 | %60 (iki taraf) |
| 1:1 (100–300k) | %60 | %30 (iki taraf) |
| 1:1 (300k+) | %90 | %20 (iki taraf) |
| 1:1,2 | %90 | %20 |
| 1:1,6 | %75 | %60 |
| 1:2 | %90 | %60 |
| 1:3 | %100 | %45 |

- **Kademe** = güçsüz tarafın göreceli gücü. Yalnız 1:1 bandında fark yaratır, çünkü tablonda
  1:1,2 ve sonrası her kademede aynı.

### 3.4b Törpünün sönmesi (2026-10-25, ölçümden çıkan zorunluluk)

- Sabit α her oranda uygulanırsa 1:10'da bile güçlünün hasarı ~%2'ye iner. Savaş 8 turda
  bitmez, kesin zafer gelmez. Evde 4 gemi tutan (filo kaçışı için en az 5 gerekir) ya da
  kaçış duruşu seçmeyen biri yağmalanamaz hâle gelir. Tersi de bozuk: tek gemiyle dev bir
  gezegene saldıran sağ kalır.
- **Kural:** α, 1:2'ye kadar tam uygulanır. 1:2 ile 1:3 (filo kaçışı oranı) arasında doğrusal
  olarak 0'a iner. 1:3 ve üstünde törpü yoktur; güçlü taraf ezer, güçsüz taraf kaçışla kurtarır.
- **Sonuç:** Etkin oran R^(1 − α/2) her yerde artan kalır. Güçlünün kaybı 1:2'de ~%30'dan
  1:3'te ~%1'e iner. Tablonun eğilimi de bu: oran büyüdükçe güçlü daha az öder.

### 3.5 Tur sayısı: 8

- 6 tur tempo kuralıyla mümkün ama 1:1'de iki tarafın %10–25'e inmesi için az yer kalıyor.
- 8 turda 1:1 savaşlar ~7 tur, dengesiz savaşlar 3–6 tur sürüyor.
- Rapor ve galaksi savaş görseli 8 turu göstermeli. `engagementSeconds` değişmez; görsel
  turları sığdırır.

### 3.6 Savaş öncesi filo kaçışı (taktik geri çekilme)

- Kural aynı kalır: savunan, en az 5 savaş gemisi, yakıt, kesin yenilgi.
- Oran artık maliyete göre değil, **göreceli güç oranına** göre hesaplanır.
- Öneri **3×**. Bunun üstünde savaş içi kaçışla hedef tutsa bile güçlü taraf anlamlı kayıp
  vermiyor (α=1,25'te %1–3). Tam kaçış daha temiz.
- ✔ **K3 (owner, 2026-10-25):** 3×.
- 1:2 ile 1:3 arasındaki hedefler uzatılarak kalibre edilir: 1:2,5'te %60, 1:3'te %70 kalan.

### 3.7 Gemi statları

- Hedefleri statlar engellemiyor; tempo kuralı profil farkını nötrlüyor. **Değişiklik önerilmiyor.**
- Araştırmanın güce etkisi (P5/A5/S4): ×1,37. Counter: ×1,6. Kademe verimi: T4'te ×1,09.
  Counter > araştırma > kademe sıralaması korunur.

---

## 4. Göreceli savaş gücü

- **Formül (Lanchester):**
  ```
  P = K × √( DPS × EHP )
    DPS = Σ saldırı × araştırma × (rakibin sınıf payına göre ortalama counter çarpanı)
    EHP = Σ (gövde + gemi kalkanı)   (+ savunanda Aegis)
  ```
- **Birim:** K, araştırmasız bir Ok gücü = fiyatı (425) olacak şekilde seçilir. Böylece
  0–25k / 25–100k / 100–300k / 300k+ aralıkları bugünkü sayılarla aynı anlamı taşır.
- **Doğrulama:** Formülün ilk hâli counter'ı iki kez sayıyordu, düzeltildi. Aynı R'de güçlünün
  kaybı Korsan, Kale, karma, counter, araştırma farkı ve 300 Ok – 18 Korsan senaryolarında
  birbirine yakın çıkıyor. Kıyamet sapması tempo kuralıyla kapanıyor.
- **Nerede kullanılır:**
  - savaş içi kaçış tablosu ve törpü
  - filo kaçışı oranı
  - saldırı ekranı ve dosyadaki güç karşılaştırması
- **Maliyet nerede kalır:** "Ne kadar filo var" anlamında kullanılan yerler aynı kalır: konvoy
  ödülü, anıt kapasitesi, botlar, sıralama.
- **Aralık:** Rakibin sayı/değer bandı, sınıf payı aralıkları, araştırma aralıkları ve Aegis
  bandının **köşe durumları** hesaplanır. En kötü ve en iyi R gösterilir. Benim gücüm de bir
  aralıktır, çünkü counter rakibin kompozisyonuna bağlı.

---

## 5. Sonda: en fazla %80 doğruluk

- **Doğruluk formülü:** `clamp(0,55 + 0,12 × (Tersane − Örtü), 0,30, 0,80)`. Tavan 1,00'dan
  0,80'e iner.
- ✔ **K5 (owner, 2026-10-25):** Bugünkü eğim. Eşit seviyede %55, +1'de %67, +2'de %79, +3'te %80.

| Okuma | %80'de | %55'te (eşit seviye) | %30'da |
| --- | --- | --- | --- |
| Silahlı değer, gemi sayısı, Aegis, yağmalanabilir kaynak | ±%20 (bant 1,5×) | bant 3,4× | bant 5,7× |
| Sınıf payları (Akıncı/Sur/Mızrak) | her biri ±10 puan | ±22 puan | ±35 puan |
| Savaş araştırmaları (Güç/Zırh/Kalkan/Doktrin) | 2 seviyelik pencere ("3–4") | 3 seviye ("2–4") | 5 seviye (≈ bilinmiyor) |

- **Gerçek değer her zaman bandın içindedir.** Bandın konumu rastgele seçilir; ortası gerçeği
  göstermez. Bu bugünkü `fuzzBand` kuralıdır.
- **Sınıf okuması:** Bugünkü UNREAD / EVEN / DOMINANT / SHARES basamakları yerine her doğrulukta
  pay aralıkları verilir. Tek kural, tek görünüm.
- **Geriye uyum:** Eski sonda kayıtları eski biçimle okunmaya devam eder. Yeni alanlar opsiyoneldir.

---

## 6. Saldırı ekranı

- ✔ **K4 (owner, 2026-10-25) — kalkar:**
  - "Senin tahmini kaybın: filonun %X'i" ve "hiçbir gemin dönmeyebilir" uyarısı
  - "Kazanır / kırar" çizgileri (`forecastLines`, `forecastLoss`)
- **Kalır:**
  - Kargo altındaki ganimet aralığı: sondanın okuduğu kaynak, savaş tahmini değil
  - Korsan "Tahmini net kazanç" kartı. Kayıp terimi v3 motorundan hesaplanır; korsan
    kompozisyonu bilindiği için sonda belirsizliği yoktur.
- **Kalır / eklenir:**
  - "Bu hedefe karşı gücün: 41k–47k · Onların: 28k–39k · Oran 1:1,1 – 1:1,7 senin lehine"
  - Kaçış çizgisi (3×)
  - Sondanın yaşı
- **Kural sayfası (bir dokunuş):** Güce nelerin girdiğini (counter, araştırma, kalkan, Aegis, yer
  topları) ve oran–kaçış tablosunu anlatır. Sonucu söylemez; kuralı ve girdileri verir.
- **Dosya ekranı:** Sonda aralıkları gösterilir: sayı, değer, sınıf payları, araştırma pencereleri.
- **Kaçış kararı:** `escapeVerdict` artık yalnız oran aralığına bakar. Bugün tahmin çizgilerini
  kullanıyor.

---

## 7. Kalibrasyon hedefleri ve test matrisi

| | 0–25k | 25–100k | 100–300k | 300k+ |
| --- | --- | --- | --- | --- |
| 1:1 (iki taraf da kalan) | %10 | %15 | %20 | %25 |

| | 1:1,2 | 1:1,4 | 1:1,6 | 1:1,8 | 1:2 |
| --- | --- | --- | --- | --- | --- |
| Güçsüzde kalan | %20 | %25 | %30 | %40 | %50 |
| Güçlünün en az kaybı | %80 | %65 | %50 | %40 | %30 |

- ✔ **K6 (owner, 2026-10-25) — süreklilik:** Güçsüzde kalan, kendi kademesinin 1:1 değerinin
  altına düşmez. 300k+ için 1:1,2'de %25, 100–300k için %20. Kaçış tablosu bu yüzden kademe
  başına tutulur.
- 1:2 sonrası (K3): 1:2,5'te %60, 1:3'te %70 kalan. Güçlünün kaybı için alt sınır yok.
- **Test matrisi (her biri ≥40 tohum):**
  - 4 kademe × oranlar 1; 1,2; 1,4; 1,6; 1,8; 2; 2,5; 3; 4
  - Kompozisyonlar: saf Akıncı / Mızrak / Sur, karma, counter ve ters counter, alt kademe
    sürüsü – üst kademe (300 Ok – 18 Korsan)
  - Gemi sayıları 3 / 10 / 50 / 100 / 300
  - Araştırma farkları
  - Yer topları + Aegis'li gezegen, klan desteği, korsan ve anıt savaşları

---

## 8. Dokunulacak yerler (aynalar)

- **rules:**
  - `randomBattle.ts`: motor
  - `battleRetreat.ts`: oran tablosu
  - `escape.ts`: oran ve karar
  - `combat.ts`: tur sayısı, rapor alanları
  - yeni `matchupPower`
  - `forecast.ts`: tahmin çizgileri kalkar, `matchupsAgainst` kalır
  - `intel.ts`: tavan, aralıklar
  - `tech.ts`, `constants.ts`
  - `monumentCombat`, `intergalacticConvoy`: güç kullanımı gözden geçirilir
- **server:**
  - `services/intel.ts`: sonda raporu yeni alanları
  - `worker/handlers.ts`: akın, tarafsız, korsan, klan savaşı, anıt yolları
  - `defenderLine`, `bots/judgement.ts`: tahmine dayanıyorsa güç oranına geçer
  - savaş raporu
- **web:**
  - `LaunchSheet`, `ForceRuler`, `ForceCompare`, `battleForecast`, `useTargetReading`
  - `TargetDossier`, `EscapeReadout`, `PirateProfitCard`
  - savaş raporu ekranı: 8 tur, patlama, tempo, kaçanlar
  - Wiki ve yardım metinleri, **6 dil**
- **sim paketi:** bot kararları ve kalibrasyon aracı.
- **docs:** `decisions.md`, `balance.md`, `game-design.md`.
- **Kural sürümü:** ayrı bir ruleset kapısı yok. Sahip kararı (2026-10-25): v3 canlı sezona açılır.

---

## 9. Uygulama sırası (her faz TDD: önce test, sonra kod)

| Faz | İş | Doğrulama |
| --- | --- | --- |
| 0 | ✔ K7: canlı dal (40e8c270) + Codex simülatör/tekrar işi master'a alındı (840f459a, ac4582b6) | typecheck temiz, rules 2931/2931 |
| 1 | `matchupPower` + testleri | Aynı R'de sonuç tutarlılığı, birim = Ok fiyatı |
| 2 | Motor v3 | Belirlenimcilik, sayı bağımsızlığı, oran monotonluğu, HP/kredi korunumu, katkı payları, kaçış hata düzeltmesi |
| 3 | Kalibrasyon aracı (repoya) → kaçış tablosu + α kesinleşir | Owner onayı |
| 4 | Filo kaçışı yeni oranla | escape testleri |
| 5 | Sonda %80 + aralıklar (rules + server + eski kayıt uyumu) | intel testleri |
| 6 | Web: saldırı ekranı, dosya, rapor, metinler | `tools/visual.mjs` ile 350px ekran görüntüsü |
| 7 | Server yolları + botlar + sim | İlgili server testleri (seri) |
| 8 | Tam kapı (`pnpm verify`, seri, heap ≤4 GiB), docs, yayın planı | Yeşil kapı |

---

## 10. Açık sorular

- ✔ **K1** Okuma A: güçlünün kendi filosunun yüzdesi, α≈1,75 ile başlanır — §2
- ✔ **K2** Tempo kuralı: evet — §3.3
- ✔ **K3** Filo kaçışı: 3× — §3.6
- ✔ **K4** Kayıp tahmini + kazanır/kırar çizgileri kalkar; ganimet aralığı ve korsan kâr kartı kalır — §6
- ✔ **K5** Sonda: bugünkü eğim, tavan %80 — §5
- ✔ **K6** 1:1,2'de güçsüz, kademesinin 1:1 değerinin altına düşmez — §7
- ✔ **K7** Canlı dal + Codex işi master'da — §9
- ⚑ **Açık:** yayın zamanı (3 Kasım yeni sezonla mı, sezon ortasında mı)
