# Klan Perkleri — F2 planı · 2026-11-10

Durum: **plan, bütün owner kararları verildi** (§6). Kod yazılmadı. F1 (`klan-savunma-kacis-f1-2026-11-10.md`) worktree'de bitti, commit/deploy yok. **Mevcut sezonda açılır** (owner).

## 1. Neden

Bugün klan seviyesi (1–10) tek bir şey alıyor: ortak savaşın Klan Hangarı. Kasa yalnız bunun için doluyor. Üyeler birbirine saldırı geldiğini görmüyor (K10). Destek ancak önceden konuşlanırsa işe yarıyor.

F2 hedefi:
- Bir üyeye saldırı geldiğinde klan **birlikte ve zamanında** tepki verebilsin.
- Destek, oyuncunun bir grubun parçası olduğunu hissettirsin (owner: klan kurulur kurulmaz).
- Kasa bağışı somut şeyler açsın.
- Kim ne yapıyor görünsün; oyuncu kendini sorumlu hissetsin.

Değişmeyen ilke: perk'ler **savaş istatistiğini değiştirmez**. Hız, süre, bilgi ve ekonomi değişir; saldırı, zırh ve kalkan değişmez.

## 2. Ölçüm: hangi hız yetiştirir?

Kural: destek, radar uyarısından sonra yola çıkıp saldırıdan önce varır mı? `D_destek / k < min(radar menzili, D_saldıran)`. Varsayımlar: aynı gemi hızları; galaksi yarıçapı 4500; komutanlar dış %35 kabukta; klan üyeleri rastgele yerleşik (en kötü durum). Ortanca klan arkadaşı uzaklığı 5453. Ev sahibi Radar 3.

| Saldıran nereden | ×1,1 (bugün) | ×2 | ×3 | ×4 | ×5 |
|---|---|---|---|---|---|
| Galaksinin herhangi bir yerinden | 26% | 82% | 95% | 97% | 99% |
| 4000 birim içinden | 16% | 54% | 81% | 90% | 95% |
| 2500 birim içinden (yakın komşu) | 5% | 25% | 52% | 75% | 86% |

Yakın saldırıda radar seviyesi önemsizleşir, çünkü uçuşun tamamı menzil içindedir. Gerçek saldırı uzaklıkları prod'dan salt-okur bir sorguyla ölçülebilir (owner izniyle).

## 3. F2 içeriği

### P1 — Klan Sancağı: perk merdiveni

Mevcut klan seviyesi ve kasa kullanılır. Seviye atlayınca perk kendiliğinden açılır.

**Fiyatlar yarıya iner (owner 1-1).** Seviye fiyatı = kişisel Hangar fiyatı × 1 (bugün × 2). Bu, 2026-09-22 kuralını ("klan odasının birimi kişisel odanınkiyle aynı fiyat") değiştirir: Klan Hangarı odası artık kişiselin yarı fiyatına gelir. `hangar-price.test.ts` eşitliği yeni orana güncellenir.

| Seviye | Fiyat (önceki seviyeden; alaşım + kristal) | Açılan |
|---|---|---|
| 1 | kuruluş | **Klan Koridoru ×2** (varsayılan, owner) |
| 2 | 556 + 150 | **Klan Alarmı** |
| 3 | 2.260 + 609 | Koridor **×3** |
| 4 | 8.548 + 2.302 | **Uzun Nöbet**: 12 → 18 saat |
| 5 | 31.324 + 8.434 | Koridor **×4** |
| 6 | 71.760 + 17.940 | **Klan Rafinerisi I** |
| 7 | 136.509 + 36.400 | Koridor **×5** |
| 8 | 163.324 + 43.550 | **Uzun Nöbet II**: 24 saat |
| 9 | 190.138 + 50.700 | **Klan Rafinerisi II** |
| 10 | 219.390 + 58.500 | **Altın Sancak** (kozmetik) |

Toplam 1 → 10: yaklaşık 824k alaşım + 219k kristal (bugün bunun iki katı).

Mevcut sezonda geçiş:
- Seviye düşmez, iade yok.
- Kasa tavanı yeni fiyata iner. Tavanı aşan kasa harcanabilir (lider hemen seviye atlatabilir), ama tavanın altına inene kadar bağış kabul edilmez. Fazlası silinmez.
- Bugün yüksek seviyeli klanlar perk'leri anında alır.

### P2 — Klan Alarmı (Seviye 2)

- **Ne zaman:** Bir üyenin dünyası düşman filo için radar uyarısı aldığında. Radarsız dünya alarm vermez.
- **Kapı:** Destek kabul etmeyen dünya alarm vermez; alarmın amacı yardım çağırmaktır. Klan üyelerinde varsayılan kapı açık (F1).
- **İçerik (owner 2):** Ev sahibinin aldığı uyarının aynısı. Radar seviyesi neyi okuduysa arkadaşlar da onu görür: varış anı, hedef dünya, Radar 4'te güç tahmini, Radar 5'te köken ve gemiler, eşlik eden komutan gemisi.
- **Kime:** Olgun üyeler (12 saat), bildirim merkezi üzerinden. Push sonra açılacak (owner 7): Android kapalı testi bitip canlıya çıkarken.
- **Gürültü:** Bir saldırı için bir alarm. Aynı dünyaya gelen dalgalar tek kartta birleşir.
- Mevcut `incoming_fleet` uyarısı tek kaynak kalır; alarm onun payload'unu klana kopyalar. Böylece iki ekran asla farklı şey söylemez.

### P3 — Klan Koridoru (kuruluş ×2, Seviye 3 / 5 / 7: ×3 / ×4 / ×5)

**Owner 3:** Klan arkadaşları arasında gönderilen her filonun **yalnız ilk bacağı** hızlanır:
- **Klan yardımı:** kaynak ve gemi; çıkış → alıcı.
- **Destek dalgası:** çıkış → ev sahibi.
- **Ortak savaş:** çıkış → liderin hazırlık dünyası (`ORIGIN_TO_STAGING`).

Hızlanmayanlar:
- Dönüş bacakları bugünkü klan şeridi hızıyla döner (×1,1).
- Ortak savaşın saldırı bacağı (`STAGING_TO_TARGET`) ve dönüşü normal hızda kalır.
- Liderin kendi hazırlık katkısının ilk bacağı yoktur.

Koridor bugünkü ×1,1 yardım hızının **yerine** geçer, üstüne eklenmez: kuruluşta ×2 = normal hızın iki katı.

- **Yakıt:** Değişmez; yakıt uzaklıktan hesaplanır, hızdan değil.
- **Geri çağırma:** Hızlanmış ilk bacakta geri çağrılan filo, uçtuğu süre kadar normal klan hızıyla döner.
- **Görünürlük:** Galakside uçuş çizgisi kalkış/varış anından çizildiği için hız kendiliğinden doğru görünür.

Denge notu: ortak savaşın toplanması da hızlanır, yani hücum da güçlenir. Owner bunu bilerek dahil etti. E5 saldıranın bu riski görmesini sağlar.

### P4 — Uzun Nöbet (Seviye 4: 18 saat, Seviye 8: 24 saat)

Konuşlanma süresi 12 saatten uzar; önleyici savunmayı yeniden gönderme yükü azalır.

### P5 — Klan Rafinerisi V1 "Ortak Ocak" (Seviye 6 / 9; owner 4)

- Her üyenin kaynak üretimi, son 24 saatte emir vermiş her üye için artar:
  - Seviye 6: üye başına +%1, en fazla +%5.
  - Seviye 9: üye başına +%2, en fazla +%10.
- "Emir verdi" ölçüsü mevcut Silent Space son-emir saatinden okunur; ikinci bir aktiflik tanımı açılmaz.
- Kişisel fayda (kendi üretimin), ortak fayda (herkesin aktifliği büyütür) ve geri dönme nedeni birlikte gelir.
- Ekonomiye eklenen üretim küçüktür. Uzun ekonomi simülasyonu yalnız owner isterse koşulur.

### P6 — Klan Katkı Defteri (owner 1-2)

Klan sayfasında "Katkılar" bölümü: her üyenin bu sezonki katkısı yan yana. Yalnız klan üyeleri görür.

| Sütun | Kaynak |
|---|---|
| Kasaya bağış (A / C / D) | `clan_treasury_events` |
| Destek: gönderilen dalga, gemi, savaşılan ve püskürtülen akın | `clan_support_waves`, `clan_support_battle_results` |
| Klan yardımı: gönderilen kaynak ve gemi | klan yardımı kayıtları |
| Ortak savaş katkısı: dalga ve gemi | `clan_war_contributions` |
| Alarma cevap: alarm sonrası yola çıkan ve yetişen dalgalar | yeni (P2 ile gelir) |

- Varsayılan sıralama: toplam katkı.
- Her satırın yanında "son 24 saat" mini çizgisi.
- Herkes kendini öbürleriyle aynı tabloda görür.
- Klan ekranında, sıradaki seviyeye kalan kasa çubuğu "kim ne kadar doldurdu" renkleriyle bölünür.

## 4. Ek öneriler — hepsi F2'ye girer (owner 5)

| # | Öneri |
|---|---|
| E1 | **Alarmdan tek dokunuşla destek.** Alarm kartı destek sayfasını hedef seçili açar. Her filo için "saldırıdan 4 dk önce varır / 6 dk geç kalır" hükmü yazar. |
| E2 | **Klan sohbetine savaş akışı.** Alarm, kalkış, savunma sonucu, seviye atlama otomatik sistem mesajı olur ("Ayşe'nin desteği Kuzgun'u kurtardı: 120 gemi düştü"). |
| E3 | **Nöbet şanı.** Destekçi raporda "kahraman" satırıyla, sezon özetinde ("7 nöbet, 3 püskürtme") ve klan sıralamasında savunma katkısıyla görünür. Destekçinin Hâkimiyeti değişmez (K5/K6). |
| E4 | **Zafer kasası.** Destekli bir savunma kazanılırsa enkaz alanının yarısı klan kasasına gider (kasa tavanına kadar; fazlası alanda kalır). |
| E5 | **Saldıran riski görür.** Sonda raporu ve hedef kartı klanın alarm ve koridor seviyesini yazar ("bu klanda alarm var · destek ×4 hızla gelir"). |
| E6 | **Ev sahibi cevabı görür.** "2 arkadaşın alarmı gördü · 1 dalga yolda, saldırıdan 3 dk önce iner." F1 kaçış satırı yetişecek desteği hesaba katar. |

## 5. Tasarım: oyuncu anları

- **Sancak (klan ekranı):** Dikey sancak, 10 çentik. Açık perk'ler parlar; sıradaki kilitli perk ne açacağını ve kasanın yüzde kaçının dolduğunu söyler. Lider seviye atlatırken basılı tutar: sancak yükselir, yeni perk ışıyarak kendini tanıtır. Ses ve titreşim eşlik eder.
- **Katkı Defteri:** Sancağın altında üye satırları. Bağış çubuğu renkli dilimler. Kendi satırın vurgulu.
- **Alarm:** Galakside alarm altındaki dünyada kırmızı nabız atan halka. Radar kökeni okuduysa saldırı izi görünür. Bildirim kartı: "Klan alarmı · Ayşe · Kuzgun · 14:32 varış". Tek dokunuş → destek sayfası ve "yetişir / yetişmez" hükmü.
- **Koridor:** Klan uçuşlarının izi klan renginde ve hızlı akar. Varış saati, varsa saldırı saatinin yanında yazar.
- **Ev sahibi:** Savun sekmesinde "yolda olan destek" satırı.
- **Doğrulama:** 350 px, Türkçe ve İngilizce; galeri ve `tools/visual.mjs`.

## 6. Kararlar

Verildi (2026-11-10):
- **Teslim sonrası (owner):** Ölüm Yıldızı saldırısı klan alarmı üretmez. Klan etiketi her yerde (galaksi, sohbet, sıralama, profil) seviyeye göre renklenir: L3 bronz, L6 gümüş, L10 altın (Altın Sancak). Sunucu yalnız kademeyi gönderir, seviyeyi değil.
- **1-1:** Fiyatlar yarıya.
- **1-2:** Katkı Defteri (P6).
- **2:** Alarm = ev sahibinin radar okuması.
- **3:** Koridor tüm klan içi filolarda, yalnız ilk bacakta.
- **Not:** Koridor kuruluşta ×2, sonra ×3 / ×4 / ×5.
- **4:** Rafineri V1.
- **5:** E1–E6 hepsi.
- **6:** Mevcut sezon.
- **7:** Push sonra.

Açık sorular da cevaplandı (2026-11-10):
- Yarı fiyat Klan Hangarı odasını da yarıya indirir; tek merdiven kalır.
- Koridor ×3 / ×4 / ×5, Seviye 3 / 5 / 7'de açılır.
- Koridor bugünkü ×1,1'in **yerine** geçer: ilk bacak ×2'den başlar, dönüş ×1,1 kalır.

Plan uygulamaya hazır.

Not: botlar klana girmez; perk'ler için bot davranışı gerekmez.

## 8. Uygulama sırası (TDD, her adımda önce test)

1. **Rules:** perk tablosu (`clanPerks(level)`), yarı fiyat, koridor çarpanı, nöbet süresi, rafineri çarpanı.
2. **Sunucu:** koridor ilk bacakları (yardım, destek, ortak savaş), nöbet süresi, rafineri üretimi, alarm (radar uyarısından klana), E4 enkaz payı, E5 sonda alanı, E6 ve P6 okumaları.
3. **Migration:** alarm bildirim türü, kasa tavanı geçişi; katkı okuması mevcut tablolardan, yeni tablo gerekirse yalnız alarm cevapları için.
4. **Web:** Sancak, Katkı Defteri, alarm kartı ve E1 hükmü, E2 sohbet mesajları, E3 rapor ve sezon satırları, E5 sonda satırı, E6 Savun satırı; 6 dil.
5. **Wiki ve belgeler:** `game-design.md` klan bölümü (K10 değişir), sözlük.
6. **Kapı:** typecheck, lint, rules + web + 4 parça sunucu testleri, 350 px görsel kontrol.
