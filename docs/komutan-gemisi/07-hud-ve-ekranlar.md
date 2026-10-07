# Komutan Gemisi — HUD ve ekranlar

> **Durum:** Tasarım (2026-10-07). Görsel doğrulama zorunlu (`CLAUDE.md`: `node tools/visual.mjs`;
> arena için `tools/arena-visual.mjs`, [11](11-test-ve-playtest.md)).
> **Hedef okuyucu:** HUD'u, sonuç ekranlarını, yükleme ekranını ve yönetim sayfasını yapacak agent.
> **Dayanak:** S6–S8, S10–S11, S32, S53–S59, S69, S74–S77 ([01](01-urun.md)); CLAUDE.md "dört
> soru" (her yüzey için zorunlu); `docs/interface.md`, `docs/visual-design.md`.

---

## 1. Sahibin referans görselleri (`referans-gorseller/`)

Görseller **görsel yöndür; kontrol yerleşimleri test edilmeden aynen uygulanmaz** (S53).
PNG dosyalarını **sahip ayrıca verir**; `docs/komutan-gemisi/referans-gorseller/` altına aşağıdaki
adlarla koy. Gelene kadar aşağıdaki metin dökümleri tek kaynaktır.

`01-cikis-alani.png` — **çıkışta durmuş gemi.** Üstte üç ince çerçeveli şerit: GÖVDE (dolu
çubuk, 100), YAKIT (çubuk, 78), AMBAR (boş, 0/100). Altında geniş "ARKA GÖRÜŞ" penceresi (içinde
geriden görünen bir gemi, mavi motor ışıkları). Ortada turkuaz başlıklı panel: **"ÇIKIŞ ALANI" /
"Gemi durdu" / "Hasar almadan bekle" / büyük "2 / 3 sn" / ilerleme çubuğu / "Ana gezegene
dönülüyor"**. Panelin altında dikey ışık huzmeli bir fener nesnesi ve zeminde büyük turkuaz
halka (kesikli dış halka). Merkezde küçük nişangâh. Sol ve sağ altta turkuaz detaylı iki namlu.
Sol altta büyük dairesel joystick (yön okları), yanında ince dikey "GAZ" kolu (0'da, altında
"0"). Sağ altta üç küçük yuvarlak düğme: DUMAN (bulut), TURBO (çift ok), GİZLEN (göz); altında
büyük yuvarlak ATEŞ (nişangâh ikonu).

`02-hud-sade.png` — **uçuşta temel HUD.** Aynı üç şerit (YAKIT mavi). "ARKA GÖRÜŞ" penceresi.
Solda ekran dışı gösterge **"‹ ◇ ÇIKIŞ • 850 m"** (turkuaz elmas). Sağda düşman gemisi kırmızı
köşe çerçevesiyle, etiket **"RAKİP • 320 m"**. Merkezde ince, aralıklı artı nişangâh. Altta
ortada **"HIZ 120"** hapı. Sol altta joystick + segmentli dikey GAZ göstergesi (alt yarısı yanık);
sağ altta DUMAN · TURBO · GİZLEN ve büyük ATEŞ.

`03-hud-zengin.png` — **kalabalık sahne.** Şeritlerde ikonlar: GÖVDE (artı) %100, YAKIT (bidon)
%78, KARGO (kutu) 0/100. Arka görüşte kırmızı ışıklı bir takipçi. Solda büyük gezegen, yoğun
asteroit kuşağı, sağda istasyon yapıları; **"ÇIKIŞ • 840 m"** fener işareti dikey çizgiyle.
Düşmanın üstünde küçük can çubuğu. Altta solda dört oklu joystick, segmentli GAZ; sağda
**kırmızı** büyük ATEŞ, altında DUMAN · TURBO (şarj halkası) · GİZLEN.

`04-yonetim-sayfasi.png` — **Komutan Gemisi sayfası.** Başlık "‹ KOMUTAN GEMİSİ", sağ üstte
kaynak çipleri (alaşım 5.598, kristal 1.021, döteryum 850, "+" ile). Büyük 3D gemi, hangar
platformu üstünde, arkada gezegen. GÖVDE çubuğu %72 + sarı **"TAMİR GEREKLİ"** düğmesi. Sekmeler
**GENEL · GELİŞTİR · TAMİR**. 2×2 kutu: SALDIRI 120, HIZ 240, YAKIT 78/100, AMBAR 12/100.
"GEMİ GELİŞTİRMELERİ" + "TÜM GELİŞTİRMELER ›": görselli kartlar GÖVDE Seviye 4/10, SİLAH 3/10,
MOTOR 4/10 (segmentli). Altta **"TAMİR ET"** (birincil) ve pasif **"SAVAŞ ALANINA GİR"**. Alt dok.

**Alınacaklar:** üç şerit + ikon + sayı; arka görüş çerçevesi; çıkış paneli yapısı; fener +
halka; ekran dışı çıkış göstergesi; düşman köşe çerçevesi + mesafe; HIZ hapı; segmentli gaz;
şarj halkası; yönetim sayfasının hiyerarşisi (hero → gövde/tamir → sekmeler → istatistik →
geliştirme kartları → iki eylem). Tek etiket: **AMBAR** (görsel 03'teki KARGO değil).
**Alınmayacaklar / açık:** **kırmızı ATEŞ** (Astera'da kırmızı yalnız tehdittir; ATEŞ ekranın
birincil eylemidir → **kendi rengi** `#2EE6C8`, basılıyken dolu); merkezi kapatan
yoğunluk (S56); "+" satın alma girişleri (mağaza kararı değil); %72'de girişin pasif olması ([KG-A8](02-kararlar.md#kg-a8)).

## 2. HUD tel kafesi (350 × 812 CSS px, dikey, güvenli alan içinde)

```
┌──────────────────────────────────────────────┐
│ [♥ GÖVDE ▮▮▮▮▮▮ 400] [⛽ YAKIT ▮▮▮ 78 · 4:49] [▣ AMBAR 60/100] │  ~34 px
│          ┌──────────── ARKA GÖRÜŞ ───────────┐               │
│          │   (canlı arka kamera, yarı hız)    │  ~80 px       │
│          └───────────────────────────────────┘               │
│        [ BAĞLAM PANELİ: tek seferde bir tane ]                │  çıkış / kalkan / yakıt / bağlantı
│                                                               │
│  ‹◇ ÇIKIŞ • 850 m          ⌜ ⌝ RAKİP • 320 m                 │
│                            ⌞ ⌟  ▬▬ (izlenen hedefin gövdesi)  │
│                 ◇ (önleme işareti)                            │
│                       ┼   ← nişangâh (+ isabet X'i)           │
│                    ◜   ◝  ← hasar yönü yayları                │
│                                                               │
│ ╲ sol namlu                                   sağ namlu ╱     │  ≤ %18 yükseklik
│                                   [GİZLEN] [DUMAN] [TURBO]    │
│   ( yön çubuğu )  ║GAZ║                                       │
│                   ║ % ║          HIZ 120         (  ATEŞ  )   │
└──────────────────────────────────────────────┘
```

Merkez ~%40'lık bölge (nişangâh çevresi) yalnız nişangâh, önleme işareti, isabet işareti ve
hasar yaylarına ayrılır (S56). Sahneyi kapatan HUD öğeleri toplamda güvenli alanın ≤ %35'i
(ölçüm tanımı [03 §11](03-ucus-ve-kontroller.md#dikey-mi-yatay-mi)). Yakıt örneği "78 · 4:49":
78 birim, bu gazla kalan süre. Sağ altta TURBO ATEŞ'e en yakın, GİZLEN en uzak ([03 §6](03-ucus-ve-kontroller.md)).

## 3. Bilgi önceliği (S57)

- **Her zaman:** nişangâh; gövde; yakıt (+ **bu hızla kalan süre**); hız; gaz seviyesi; yetenek
  durumları; ambar.
- **Gerektiğinde öne çıkar (bağlam paneli, tek seferde bir; öncelik sırası):** bağlantı kopması
  sayacı > yakıt bitti / kurtarma sayacı > çıkış paneli > doğuş kalkanı sayacı > sınır uyarısı.
- **Anlık bildirimler (1,5–2 sn):** "KALKAN KALKTI — …" (nedeniyle: ateş / çıkış alanı / kargo /
  süre, [04 §5](04-savas-mekanikleri.md)), "GÖRÜNMEZLİK BOZULDU — ateş ettin", "GÖRÜNMEZLİK
  BİTTİ", "Hasar aldın — sayaç sıfırlandı", hasar yönü yayları.

## 4. Durum tablosu — renk asla tek başına değil

| Durum | Renk (token) | İkon | Metin | Sayaç |
|---|---|---|---|---|
| Gövde | kendi `#2EE6C8` | artı | GÖVDE | değer |
| Gövde düşük (< %30) | uyarı `#FFCC4D` | artı + ! | "GÖVDE DÜŞÜK" | değer |
| Yakıt normal | döteryum `#A8EA4C` | bidon | YAKIT | değer + kalan süre |
| Yakıt az (< %25) | uyarı `#FFCC4D` | bidon + ! | "YAKIT AZ" | kalan süre |
| Yakıt kritik (< %10) | uyarı, nabız | bidon + ! | "YAKIT KRİTİK" | kalan süre + bip |
| Hasar alındı | tehdit `#FF4B4B` (kenar/yay) | — | — | yay 1,5 sn |
| Doğuş kalkanı | müttefik `#5B8CFF` | kalkan | "KALKAN" | kalan sn |
| Çıkış | kendi `#2EE6C8` | fener | panel metni ([04 §6](04-savas-mekanikleri.md)) | "2 / 3 sn" + çubuk |
| Yetenek hazır | kendi | yetenek ikonu | ad | — |
| Yetenek aktif | kendi, dolu | ikon | ad | kalan sn |
| Yetenek doluyor / bekliyor | sönük | ikon | ad | halka + sn |
| Görünmez (kendin) | kendi, ekran filtresi | göz-çizgi | "GÖRÜNMEZ" | kalan sn |
| Bağlantı koptu | uyarı | sinyal | "Bağlantı koptu — gemi savunmasız" | 30 → 0 |
| Kurtarma yolda | uyarı | çekici | "Yakıt bitti — kurtarma yolda" | 10 → 0 |
| Alan sınırı | uyarı | sınır | "Alan sınırı" | mesafe |

## 5. Göstergeler

- **Nişangâh:** ince aralıklı artı, beyaz çekirdek + koyu kontur (her zeminde okunur, S53).
  Onaylı isabette beyaz **X**; öldürmede büyük X + halka.
- **Düşman çerçevesi:** kırmızı köşe çerçevesi + "RAKİP • 320 m" (izlenen hedefte komutan adı
  ve küçük gövde çubuğu — "kaçayım mı savaşayım mı" kararı için, S74). Diğer görünür düşmanlarda
  yalnız çerçeve + mesafe. Duman arkasında veya görünmezde **hiçbiri** (S76–S77).
- **Önleme işareti:** küçük içi boş elmas, kendi rengi; nişangâhtan ayırt edilir ([03 §9](03-ucus-ve-kontroller.md)).
- **Ekran dışı:** çıkışlar her zaman (turkuaz elmas + mesafe); görünür düşmanlar
  `offscreenEnemyDist` içinde kenarda kırmızı ok.
- **Hasar yönü:** nişangâh çevresinde saldırgan yönüne yay; arkadan geliyorsa alt yay +
  arka görüş çerçevesi bir an parlar.
- **Arka görüşte:** düşmanlara küçük köşe çerçevesi, isim yok.

<a id="sonuc-ekranlari"></a>
## 6. Sonuç ekranları (S32, S35–S37, KG-K5)

Her biri: **ne oldu · neden · ne kazandın/kaybettin · sıradaki karar**. Birincil düğme
**"Ana gezegene dön"** (prototip: galaksiye; F8: Komutan Gemisi sayfasına). Dev'de "Tekrar gir".

| Sonuç | Başlık | İçerik |
|---|---|---|
| Çıkış başarılı | "Ana gezegene ulaştın" | eve giden kargo (F9 öncesi: "60 TEST kargo kurtarıldı — test yükü, kaynağa eklenmez") · kalan yakıt · alınan hasar · vuruşlar |
| Yok edildi | "Gemin patladı" | seni kim, kaç metreden vurdu · kaybedilen kargo (sahaya saçıldı) · korunan yakıt/mühimmat · "Gemi çekildi — tamir gerekli" |
| Yakıt bitti | "Yakıtın bitti" | kargo o noktada kaldı · hasar korunur, ücretsiz tamir yok · sonraki sefer için yakıt |
| Bağlantı koptu | "Bağlantın koptu" | 30 sn dolmadan dönmedin · gemi yakıt bitmiş gibi çekildi · kargo düştü |
| Geri çağrıldı | "Geri çağrıldın" | neden (sezon sonu / bakım / galaksi değişimi) · yeni hasar yok · kargo ambarda kaldı, eve ulaşmadı — eve yalnız çıkış götürür ([KG-A15](02-kararlar.md#kg-a15)) |

Patlama: önce patlama efekti (~1,5 sn), sonra sonuç ekranı (S32).

## 7. Yükleme ekranı (S8)

Dürüst adımlar (kod → modeller n/m → sesler → büyük **"BAŞLA"**), sahte yüzde yok. BAŞLA'dan sonra
kısa "Bağlanıyor…" ve doğuş ([06 §3](06-istemci.md#uygulama-dali)). Altta tek satır kontrol
ipucu dönüşümlü ("Sol başparmak yön verir, bırakınca gemi düz gider" vb.). Hata: neden +
"Tekrar dene" + "Geri dön".

<a id="yonetim-sayfasi"></a>
## 8. Komutan Gemisi yönetim sayfası (F8; S6–S8, S59)

- Yer: Üs → `BaseSwitch` üçüncü seçenek; alt dokta Üs seçili kalır.
- **Hero:** 3D gemi, hangar platformunda, yavaş dönen (örnek: `screens/SkinPreview.tsx`
  yaklaşımı — saydam canvas, DPR ≤ 1,5; Subdivision'ın hangarı referans, [10](10-referans-oyunlar.md)).
- **Gövde satırı:** çubuk + yüzde; hasarlıysa "TAMİR GEREKLİ" (uyarı rengi).
- **Sekmeler:** GENEL (özet kutular: saldırı, hız, yakıt, ambar…) · GELİŞTİR · TAMİR.
- **Geliştirme satırı (S59):** satırda **mevcut değer → sonraki değer** ve **maliyet** görünür
  (repo kuralı: "maliyet asla bir dokunuş arkasında değil"); kural açıklaması bir dokunuş
  derindeki sayfada (kademeli gösterim); onay sayfadan. Satırda "neye yarar" tek cümle
  (ör. "İsabet: mermiler nişangâha daha yakın gider. Kontrolü değiştirmez.").
- **Tamir:** ücretsiz süre sayacı + kaynakla anında tamir (KG-A9 cevabına göre).
- **Hazırlık:** yakıt doldurma (maliyet + tahmini uçuş süresi) — KG-A3'e göre.
- **"Savaş alanına gir":** 0,6 sn basılı tutma (`v2/kit/HoldButton.tsx`; repo kuralı: kalkışlar
  basılı tutmayla) yükleme ekranını açar. Tam ekran ve ses, yükleme sonundaki BAŞLA dokunuşunda
  açılır (basılı tutma kullanıcı etkinleştirmesi vermez, [03 §10](03-ucus-ve-kontroller.md)).
  Giremiyorsa nedeni düğmenin altında yazılı (KG-A8).

## 9. Dört soru (CLAUDE.md) — her yüzeyde kontrol

1. **Netlik:** her sayı "ne, büyüğü iyi mi, benimkiyle kıyas, neyle ilişkili, hangi karar" sorusunu
   karşılar (ör. yakıt → kalan süre; düşman gövdesi → benim gövdemin yanında).
2. **Öngörülebilirlik:** oyuncu sonucu tahmin edebilir ama bilemez (TTK, menzil, turbo süresi
   görünür; kimin kazanacağı görünmez).
3. **Karar desteği:** kural kullanıldığı yerde (çıkış paneli neden başlamadığını söyler; yetenek
   düğmesi bekleme süresini gösterir; geliştirme satırı etkisini söyler).
4. **Etkileşim maliyeti:** savaşta tek dokunuş; menüde sonraki değer ve maliyet satırda.

## 10. Görsel kurallar (repo)

- Token'lar `v2/tokens.css`: zemin void/deep/panel; **kendi** `#2EE6C8` (sen / birincil eylem,
  ekranda tek birincil); **tehdit** `#FF4B4B` (yalnız tehdit: düşman çerçevesi, hasar, düşman izi);
  uyarı `#FFCC4D`; müttefik `#5B8CFF`; alaşım `#F2A14A`, kristal `#7FD0FF`, döteryum `#A8EA4C`.
  "Parıltı bir durumdur, süs değil."
- Uçuşta okunabilirlik galaksiden yüksek olmalı (S53): metin arkasında yarı saydam panel zemini,
  sayılar IBM Plex Mono, kritik sayılar `readout` rolünde.
- Tipografi rolleri: hero 46 · readout 27 · figure 18 · title 16 · body 12 · caption 10 ·
  label 11 · micro 9; serbest boyut yok (ESLint). Fontlar: Archivo, IBM Plex Mono.
- İkonlar 24 px ızgara, ince çizgi, `currentColor`; durum ikonu her zaman metin/sayaçla.
- Dokunma hedefi ≥ 44 px (repo); savaş düğmeleri ≥ 56 px, ATEŞ ≥ 84 px ([03 §6](03-ucus-ve-kontroller.md)).
