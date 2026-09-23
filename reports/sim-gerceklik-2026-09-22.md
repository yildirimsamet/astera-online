# Simülasyon gerçeği ne kadar yansıtıyor? — 2026-09-22

**Soru (sahip):** *"Simülasyonlar ne kadar gerçek oyunu, ne kadar gerçek oyuncu davranışını simüle
ediyor incele. Saçma / tutarsız ise ne yapabiliriz — daha basit bir simülasyon mu, bazı yerleri mi
değiştirmeli? Tutarlı ise en mantıklı önerileri sun."*

**Kısa hüküm:** Simülatör **kural motoru olarak tutarlı**, **oyuncu ve gelir modeli olarak yanlış.**
Bina ilerlemesini medyanda şaşırtıcı derecede doğru tahmin ediyor. Ama gelirin yarısını, istihbarat
katmanını ve savaş sonuçlarını **ters** modelliyor. Bu yüzden SV / TAX / ARR bantları gerçek
oyunun sayıları değil. Yeniden yazmaya gerek yok; dört kalibrasyon ve bir canlı-veri ölçüm aracı
gerekiyor.

---

## 1 · Nasıl ölçüldü

- **Gerçek oyun:** EU-1 ana galaksi, canlı sezon (13 Eylül'de başladı, ölçüm anında ~9,5. gün),
  **45 gerçek oyuncu + 8 sunucu botu.** Botlar `bot_profiles` ile ayrıldı. Prod veritabanında
  yalnız `SELECT` çalıştırıldı; her oturum `default_transaction_read_only = on` ile açıldı (geçici
  bir view bile reddedildi).
- **Seviye ilerlemesi** `build_orders` (5.218 tamamlanmış bina siparişi) kayıtlarından,
  **bugünkü seviyeden geriye** hesaplandı. Geç katılanlar hazır seviyelerle başladığı için ileriye
  sayım yanlış çıkıyordu. Her oyuncu kendi katılım gününe göre normalize edildi.
- **Simülatör:** 53 oyuncu, 30 günlük sezon, `by-archetype` takvimi, 5 tohum. Sezonu kısaltmadan
  9. günü okuyabilmek için sim'e yalnız ölçüm amaçlı bir `onDay` gözlem kancası eklendi (test: sonucu
  değiştirmediği kanıtlı).

## 2 · Karşılaştırma

### Tutanlar ✅

| 9. gün, medyan | Gerçek | Sim |
|---|---|---|
| Rafineri | 11 | 11 |
| Çıkarıcı | 11 | 11 |
| Tersane | 4 | 4 |
| Döteryum tesisi | 8 | 9 |
| Rafineri, 1 / 3 / 6. gün | 6 / 9 / 11 | 4 / 8 / 10 |
| Oyuncu başına günlük PvP akını | ~2,6 | ~2,7 (8. gün 3,1) |

Eski eğride sim, gerçekteki durmayı **birebir tekrarlıyor**: Rafineri 9. günde 11'de takılıyor ve
sezon sonuna kadar orada kalıyor. **Kural motorunun kendisi** (maliyet, üretim, süre, savaş
matematiği, yakıt) doğrudan `@astera/rules`'u kullanıyor. Bugün Hangar sınırı da eklendi; sim artık
sunucunun kabul etmeyeceği bir filo kurmuyor.

### Tutmayanlar ❌

| | Gerçek | Sim | Fark |
|---|---|---|---|
| **Savaş sonucu (PvP)** | **%85 DECISIVE**, %14 püskürtüldü | **%17 DECISIVE, %75 püskürtüldü** | **ters** |
| Sonda / oyuncu / gün | **~17** | ~1 | 17× az |
| Madencilik seferi / madenci / gün | ~32 | ~5,6 | 6× az |
| Madencilik alaşımı / üretim alaşımı | **0,66** | 0,03 | 20× az |
| Korsan akını | 1.029 akın, 2,26M alaşım | **modelde yok** | — |
| Dış gelir (maden + korsan + yağma) / üretim | **~1,0** | ~0,05 | gelirin yarısı eksik |
| Saldırmayan oyuncunun akınla kaybı / üretimi (TAX) | **0,28** (hepsi 0,14) | 0,02–0,05 | 5–10× az |
| 9. gün filo | Kıyamet 509, Balista 1.172, Tempest 937 — **T3/T4 yaygın** | Rampart, Warden, Dart — **T1** | kademe yok |
| 9. gün Engineering araştırması | 23 oyuncuda medyan 2 | **hiçbir botta yok** | — |
| Oturum | günde medyan **7,6** kısa oturum, 07:00–02:00'ye yayılı | günde 4 sabit pencere | — |
| En üst oyuncu (9. gün Rafineri) | 16 | 11 | kuyruk yok |
| PvP hedeflerinin yarısı | **8 sunucu botu** | yok (hepsi aynı botlar) | — |

## 3 · Neden böyle

1. **Oyuncular sonda atıp zayıfı seçiyor, sim körlemesine saldırıyor.** Gerçek oyuncu günde ~17
   sonda atıyor ve akınların %85'ini kazanıyor; akınların yarısı kolay hedef olan sunucu botlarına
   gidiyor. Sim'de yalnız GRINDER (%12) sonda atıyor, diğerleri komşusuna kör gidiyor ve 190 bin
   filo değerli turtle garnizonlarına çarpıyor. **İstihbarat → karar → eylem döngüsü**, tasarımın
   kalbi, sim'de neredeyse yok.
2. **Gelirin yarısı modelde yok.** Sim ekonomiyi bilerek olaysız ölçüyor (asteroid yağmuru, tüccar
   ve korsan dahil değil). Ama gerçek oyuncunun alaşım gelirinin **yarısı** üretim dışından geliyor.
   Sim'deki her "servet oranı" (ARR, SV, TAX, VFR) başka bir ekonomiyi ölçüyor.
3. **Araştırma ve kademe geç.** Botların araştırma hedefleri var ama Engineering'e ilk 9 günde hiç
   ulaşmıyorlar. Gerçek oyuncular ise T3/T4'ü 9. günde yaygın kullanıyor. Savaşların kompozisyonu
   bu yüzden farklı.
4. **Nüfus elle yazılmış.** Arketip payları (%18/22/24/24/12) ve takvimler bir brief'ten geliyor,
   veriden değil. Gerçek nüfus çok daha "hardcore": 45 kişinin 39'u son 24 saatte aktif, hepsi her
   gün oynuyor.

## 4 · SV / TAX kalibrasyonu için anlamı — **kritik**

- **TAX'ı sim'e göre "düzeltmek" gerçek oyunu yanlış yöne iter.** Sim TAX'ı düşük okuyor (akınlar
  ısırmıyor). Gerçekte saldırmayan oyuncu üretiminin **%28'ini** kaybediyor. Sohbetteki *"sabah
  kalktım sıfırım"* bu. Sim'e bakıp yağma yüzdesini artırmak sorunu büyütür.
- **SV ve ARR** de aynı nedenle mutlak olarak anlamsız: servet oranlarının paydası (dış gelir
  olmadan) ve payı (başarısız akınlar) gerçekle uyuşmuyor.
- Bu yüzden **Faz 4'ün SV/TAX kalibrasyonu, sim düzeltilene ve canlı veriyle karşılaştırılana kadar
  yapılmamalı.** Bant testleri bugün "kırmızı" diyorsa bu, oyunun değil ölçüm aletinin sorunu.

## 4b · Tasarımın merkez iddiası: "bilgili oyuncu birinci olur" — **canlı oyunda doğru**

Sim'in en eski testi bunu her tohumda istiyor ve bazı tohumlarda düşüyor. Canlı veri (Dominion
sıralaması ile sonda sayısı):

| Sonda çeyreği | Ortalama sonda | Medyan Dominion sırası | Akın kazanma oranı |
|---|---|---|---|
| En çok sonda atan ¼ | 1.081 | **7** | **%96** |
| 2. ¼ | 141 | 28,5 | %92 |
| 3. ¼ | 19 | 34 | %60 |
| En az ¼ (neredeyse hiç PvP yok) | 1 | 11 | — |

Dominion sıralamasının **ilk 6'sının hepsi** en çok sonda atan çeyrekte (874–2.426 sonda). Yani
iddia gerçek oyunda tutuyor. Sim'de düşmesinin sebebi sim'in kendisi: kör saldıran botlar
püskürtülüyor ve hiç saldırmayan TURTLE kaybedilen gemilerden Dominion toplayıp birinci oluyor.
Bu testin kırmızısı bir tasarım sorunu değil, kalibrasyon 1'in (istihbarat ve hedef seçimi)
eksikliği.

## 5 · Öneriler (sırayla)

**Yeniden yazmaya gerek yok.** Daha basit bir sim, bu farkların hiçbirini kendiliğinden çözmez;
sorun motor değil, oyuncu ve gelir modeli. Önerilen yol:

1. **Canlı ölçüm aracı (en önemlisi).** `tools/live-metrics` gibi, prod'a yalnız-okuma bağlanıp
   sim'in aynı metriklerini (ARR, TAX, SV karşılıkları, seviye ilerlemesi, savaş sonucu dağılımı,
   gelir karması, sonda/maden sıklığı) gerçek veriden hesaplayan bir betik. Bu raporun sorguları
   bunun ilk hâli. Bantlar bundan sonra **gerçek sayılara** göre konur, sim ise bu sayılara
   yaklaştığı ölçüde güvenilir kabul edilir.
2. **Sim'in dört kalibrasyonu**, her biri gerçek bir sayıya hedeflenir:
   - **İstihbarat ve hedef seçimi:** saldıran her arketip sonda atsın ve zayıf hedefi seçsin.
     Hedef: DECISIVE ~%85, sonda ~15–20 / gün.
   - **Gelir karması:** madencilik sıklığı gerçeğe çekilsin, korsan şeridi eklensin (ya da ilk
     adımda gerçek orana ayarlı basit bir "dış gelir" akışı). Hedef: dış gelir / üretim ≈ 1.
   - **Araştırma temposu:** Engineering ve doktrinler gerçek zamana çekilsin. Hedef: 9. günde
     Engineering 2 oyuncuların yarısında.
   - **Takvim:** günde 4 pencere yerine gerçek dağılım (günde 5–13 kısa oturum, 07:00–02:00).
3. **Nüfus payları veriden.** 46 gerçek oyuncu davranışlarına göre (akın, madencilik, Kasa, sonda)
   kümelenip arketip payları buna göre ayarlansın. Sunucu botları da sim'e "kolay hedef" nüfusu
   olarak eklensin.
4. **Sim'in kullanımı netleşsin:**
   - **Güvenilir olduğu işler:** kural değişmezleri (Hangar, sonlanma kuralları), bina ilerlemesinin
     A/B karşılaştırması (bugünkü eğri kararı bununla ölçüldü), regresyon yakalama.
   - **Güvenilmez olduğu işler:** mutlak servet/akın bantları. Bunların bant testleri kalibrasyona
     kadar "bilgi" olarak işaretlenmeli, oyunu onlara göre ayarlamak yasak.

## 6 · Bu raporun sayıları neye dayanıyor

Tüm prod sorguları ve sim betikleri bu oturumda çalıştırıldı. Ham çıktılar oturumun scratchpad
dizininde. Prod'da hiçbir şey yazılmadı. Canlı sezon **eski eğriyle** (`8e83920` deploy edilmemiş)
koşuyor; yani gerçek sayılar eski ekonominin sayıları.
