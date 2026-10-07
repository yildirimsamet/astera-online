# Komutan Gemisi — Gelişim ve ekonomi

> **Durum:** Çerçeve + öneri (2026-10-07). Sayılar **hipotezdir**; F8 öncesi ekonomi etüdü ve
> sahip onayı olmadan kalıcı fiyat/seviye yazılmaz.
> **Hedef okuyucu:** F8 (kalıcılık, geliştirme, tamir) ve F9 (kaynak toplama) işini yapacak agent.
> **Dayanak:** S17, S19–S21, S25, S33–S39, S41, S59 ([01](01-urun.md)); KG-K3, KG-A3, KG-A8–A11,
> KG-A17, KG-A24 ([02](02-kararlar.md)).

---

## 1. Değişmez çerçeve

- **Sezonluk** (KG-K3): seviyeler, can, yakıt sezon boyunca kalır, yeni sezonda sıfırlanır. Veri
  `commander_ships` (`player_id` = sezonluk oyuncu satırı; [05 §14](05-ag-ve-sunucu.md#kalicilik-f8)).
- **Galaksi ana oyundur** (S2): arena geliri galaksi oyunundan daha iyi bir gelir yolu olamaz ve
  arenaya girmeyen oyuncu galakside geri kalmamalı.
- **Beklemekle kazanılmaz** (`rules/src/rewards.ts`: "Nothing here can be earned by waiting").
  Zamanla ücretsiz tamir bir kazanç değil, kilit önleyicidir (S59).

## 2. Asıl ekonomik risk: kaybedilemez harcama

`packages/rules/src/rewards.ts`: kalıcı yükseltme, kozmetik veya indirim **kaybedilemez**dir ve
ekonomi değişmez tablosu yeni kaybedilemez harcamaları **adıyla reddeder**: "akının alamadığı
şey, tüm PvP modelinin dayandığı baskıyı boşaltır". Gemiye harcanan alaşım/kristal, galakside
yağmalanabilir servetten çıkar. Ölçü: **ARR** (servetin gerçekten kaybedilebilir payı), sağlıklı
bant **0,275–0,55** (`docs/balance.md`; tüm dosyayı okuma, "ARR" ile ara); orta oyunda 0,26–0,27'ye
iniyor ve kartopu denetimi kohortların tabanın altında kaldığını söylüyor. Yani bu harcamanın
payı zaten dar.

**Öneri (sahibe F8'de):** geliştirmelerin ağırlığı **yalnız arenada kazanılan yeni kaynakla**
ödenir (galaksiden yağmalanabilir serveti emmez); alaşım/kristal payı küçük tutulur. Yeni
kaynak eve taşındığında yağmalanabilir mi, yoksa yalnız gemiye mi harcanır — sahip kararı
(KG-A10). Etüt yapılmadan alaşım/kristal fiyatı yazılmaz.

## 3. Geliştirme modeli (öneri)

- 8 özellik (S19) + 3 yetenek (S25), her biri **1–10 seviye** (referans görsel "Seviye 4/10").
- **Azalan getiri:** ilk seviyeler hissedilir, son seviyeler küçük. Örnek toplam tavanlar:
  Can +%60 · Saldırı +%40 · Hız +%20 · Mermi hızı +%30 · Atış hızı +%30 · İsabet: koni
  `spreadBase → spreadMin` · Yakıt deposu +%60 · Ambar +%100 · yetenekler: süre/şarj ↑, bekleme ↓.
- **Seviye bütçesi** (kartopuna karşı, önerilen): toplam seviye sayısına tavan (ör. 80 olası
  seviyeden 40) → herkes her şeyi maksimuma çıkaramaz, **uzmanlaşma** kararı doğar (avcı / taşıyıcı / kaçak).
- **Güç farkı sınırı (S59, S75):** TTK tanımıyla aynı ölçüde (**~%60 isabet**, [04 §4](04-savas-mekanikleri.md))
  en üst seviye saldırgan başlangıç gemisini **3,5 sn'den kısa sürede** öldürememeli (eşit
  gemiler arasında ~8 sn). Örnek tavanlarla: 400 / (14 × 10,4 × 0,6) ≈ 4,6 sn ✓; %100 isabette
  ≈ 2,75 sn — bu, nişan becerisinin ödülüdür. Kaçış yetenekleri (turbo/duman/görünmezlik) saldırı
  gücüyle ölçeklenmez → zayıf oyuncu doğru oynarsa kaçabilir.
- **Maliyet eğrisi:** seviye başına geometrik artış (ör. ×1,35); ilk seviyeler erişilebilir
  kaynaklarla, son seviyeler arena kaynağı ve/veya kartla.
- **Kartlar** (S38, S41): sezonluk modelde tüketilen eşyalar — bir seviye verir veya bütçe
  tavanını aşan tek bir seviye açar. Kaynağı sonra monument ödülleri (S41). Tür ve kaynak: KG-A10.
- Arayüz: her satırda mevcut → sonraki değer + maliyet + tek cümle etki ([07 §8](07-hud-ve-ekranlar.md#yonetim-sayfasi)).

## 4. Tamir (S33, S36, S59, KG-A8, KG-A9)

- Yok edilip çekilen gemi **tamir edilmeden** giremez (S33). Kısmen hasarlı (çıkış yapmış) geminin
  girmesi: öneri **girebilir** (KG-A8).
- Öneri: **zamanla ücretsiz** tam onarım (ör. 45 dk; `repair_until`, okunurken hesaplanır) +
  **kaynakla anında** onarım (maliyet eksik cana ve seviyeye bağlı). Birkaç yenilgi oyuncuyu
  "oynayamaz" yapmaz; para harcayan hızlanır.
- Yakıt bitmesinde çekilme ücretsiz tamir değildir (S36).

## 5. Yakıt ve mühimmat (S17, S20–S21, KG-A3)

- Öneri: **tek döteryum deposu** (motor + atış). Sefer öncesi başkentin döteryumundan doldurulur;
  kullanılmayan yakıt gemide kalır (yok edilmede de korunur, S34).
- Döteryum değerli (değer ağırlığı alaşım 1 / kristal 2 / döteryum 32, `rules/valuation.ts`;
  takas 32:16:1). Depo birimi ↔ döteryum oranı etütte belirlenir; "1 birim = 1 döteryum" varsayılmaz.
- Depo büyüklüğü sortie süresini belirler (S17): başlangıçta tam gazda ~6 dk
  ([04 §13](04-savas-mekanikleri.md#baslangic-degerleri), KG-A19).

## 6. Arena geliri (F9)

- Kargo kapasitesi (`cargoCapacity`, Ambar özelliği) ve alandaki kaynak yoğunluğu, dakika başı
  getiriyi sınırlar. Hedef: arena dakika getirisi galaksideki eşdeğer oyundan **yüksek değil**;
  risk (kayıp) hesaba katılınca cazip.
- Kaynak toplama yöntemi KG-A12; düşen kargo herkes tarafından toplanır (S34) — kazananın
  ödülü kaybedenin yükü; kartopuna dikkat (aşağıda).

## 7. Kartopu ve yeni oyuncu (S59)

Riskler: güçlü olan daha çok yağmalar → daha hızlı güçlenir; arena geliri galaksi büyümesini
hızlandırır (iki döngü birbirini büyütür). Önlemler (öneri sırası): sezonluk sıfırlama (var) ·
seviye bütçesi · güç farkı sınırı · kaçış araçlarının bağımsız ölçeklenmesi · arena para
biriminin galaksiye sınırlı geçişi · yeni oyuncunun taşıdığı yükün azlığı (avlanmaya değmez).
Ölçüm araçları: `pnpm sim`, `tools/economy-design-study.ts`, `tools/economy-goal-sim.ts`,
`tools/snowball-audit.ts`.

## 8. F8 öncesi çıktı

Bu klasörde kısa bir `ekonomi-etudu.md`: önerilen fiyatlar, dakika başı arena getirisi, ARR
etkisi (simülatörle), güç farkı tablosu, tamir süreleri. Sahip onaylamadan kalıcı fiyat yok.

## 9. Monument bağlantısı (S40–S41, sonra)

Monumentlar kodda var (ruleset 16). Bağlantı yalnız ödül tarafı: monument ödüllerine kart / yeni
kaynak eklemek (mevcut ödül hattı: `reward_grants`). MVP'de yok (S42).
