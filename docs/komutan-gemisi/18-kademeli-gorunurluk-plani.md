# 18 · Kademeli görünürlük planı (V6g, 2026-10-23)

Sahip: "Gemi görünürlüğünü 800 m, 1,6 km ve 2,4 km olarak üçe ayırsak, uzaklaştıkça ayrıntıyı
azaltsak? 16 anlık gemi az; en az 30, yapabilirsen 50 (sunucu kapasitesi / 2). Daha az paketle
aynı işi, daha çok oyuncuyu, daha akıcı."

## Bugün

- Sunucu her pilota 1,6 km içindeki **en yakın 12** gemiyi gönderir (`MAX_REMOTE_PILOTS`, 8 kişilik
  oda döneminden kalma; istemci fazlasını bozuk paket sayıyordu). 40 gemilik savaşta 28'i görünmez.
- Her uzak gemi **53 sayı**: yakıt, bekleme süreleri, ambar, isabet sayısı… Uzak gemiyi çizerken
  istemci bunların ~22'sini okur (`id, p, q, s, throttle, omegaYaw/Pitch, landed, n, hull, shield,
  cloak, turboActive, gun, shots, mining, phase`).
- En yakın 12 sürekli değişir (2 dk'da 163 kez); çıkan gemi silinir, giren sıfırdan kurulur.

## Hedef

- En yakın **50** gemi, **2,4 km**'ye kadar. Duman, toz ve gizlenme kuralları her kademede aynı.
- Çizim kademeleri: ≤ 800 m tam model ve efektler, 800 m–1,6 km hafif model, 1,6–2,4 km en ucuz
  model.
- Ağ: ≤ 1,6 km **tam satır** (kırpılmış, 15 Hz), 1,6–2,4 km **uzak satır** (konum, yön, hız,
  bayraklar; 5 Hz).
- 50 pilotluk referans savaşta paket ort. ≤ 4 KB (bugün 12 gemiyle 2,8 KB).
- S22'de 50 görünür gemiyle ort. ≥ 45 fps, 100 ms'yi aşan kare yok.
- Sunucu tick p95 bütçenin yarısının altında (≤ 16 ms, 100 pilot).

## Fazlar

**Faz A · Protokol 6 (rules + sunucu)**
- `packRemote`: uzak gemi için yalnız çizimde okunan alanlar, yuvarlanmış (konum cm, kuaterniyon
  4 basamak, hız 0,1). `packFar`: id, konum, yön, hız, bayrak (turbo, maden, iniş).
- Anlık görüntü: `others` (tam) ve `far` (uzak) iki ayrı dizi; toplam ≤ 50, en yakın önce.
  `far` yalnız her 3. anlık-görüntü tickinde gider (5 Hz).
- Satır metni pilot başına tick'te **bir kez** kurulur, izleyenler paylaşır (bugün her izleyici
  her satırı yeniden kurup yuvarlıyor).
- Çözücü: genişlik, toplam sınır, yinelenen id reddi. Eski istemci `kick: version`.

**Faz B · İstemci ağı**
- Kare listesi yerine **gemi başına geçmiş**: her gemi kendi örnekleri arasında ara değerlenir;
  5 Hz'lik uzak gemi aradaki paketlerde kaybolmaz.
- Silme: tam satırlı gemi ilk eksik pakette gider (bugünkü gibi: ölen, gizlenen hemen kaybolur);
  uzak gemi üç paket (200 ms) boyunca görülmezse gider.
- Kademe geçişinde konum sürekli; uzak satırın taşımadığı alanlar son bilinenden kalır.

**Faz C · İstemci çizimi**
- Gemi görselleri havuzdan: çıkan gemi gizlenir, yeni gelen boşta olanı alır (kurma/silme yok).
- Kademeye göre ayrıntı: uzakta alev izi, kalkan kabuğu, kıvılcım yok.
- Düşman işaretleri en yakın 12 ile sınırlı kalır (zaten 700 m içi); 3B'de 50 gemi görünür.
- S22 ölçümü; gerekirse uzak kademe tek çizim çağrısıyla (instancing).

**Faz D · Ölçüm:** VPS'te 100 botluk oda (tick, CPU, paket); 50 pilot savaşı önce/sonra;
S22'de 50 görünür gemi (fps, uzun kare, gemi sayısı zaman çizgisi).

**Sonraya:** ikili (binary) kodlama; görünürlük hesabı için uzaysal ızgara (ölçüm gerektirirse).

## Dikkat edilecek yerler

- **Hayalet gemi:** ölen/gizlenen tam satırlı gemi bir paketten (66 ms) uzun ekranda kalmamalı.
- **Titreme:** 5 Hz uzak gemi, aradaki paketlerde yok diye silinip yeniden çizilmemeli.
- **Kademe sınırı:** 1,6 km'de gidip gelen gemi zıplamamalı; sınırda hangi satır gelirse gelsin
  konum ve yön sürekli.
- **Kilit, nişan, işaret, radar:** yalnız tam satırlı gemiye bağlı kalır (700 m / 1 km içi).
  Uzak satırdaki gemi kilitlenmez, sesi çalmaz.
- **Ses:** `fireOther` 1,1 km'ye kadar çalar → `shots` tam satırda kalır.
- **Saldıran:** `pilot.lastAttacker` gemisi çok uzaktaysa listede olmayabilir (bugün de böyle).
- **Sunucu maliyeti:** 2,4 km × 100 pilot × görünürlük (duman/toz) — ölçülecek.
- Web ve arena **birlikte** deploy (5 → 6).

## Test edilecekler

- Satır paketleme: gidiş-dönüş, yuvarlama sınırları, uzak satırın bayrakları.
- Sunucu: en yakın 50, 2,4 km sınırı, ≤ 1,6 km tam / ötesi uzak, uzak satır yalnız her 3. pakette,
  ölü/gizli/duman arkası hiçbir kademede yok, satırlar izleyiciler arasında aynı.
- Çözücü: 50'den fazla, yanlış genişlik, yinelenen id, eski sürüm.
- İstemci: uzak gemi paketler arasında kalır; tam satırlı gemi ilk eksik pakette gider; kademe
  geçişinde konum sürekli; 120 kişilik kadroda bağlantı kopmaz.
- Ölçüm: paket boyutu, tick, S22 fps.

## Kabul edilmeyecek durumlar

- Uzaktaki geminin yanıp sönmesi; ölen geminin patlamadan sonra süzülmesi.
- Kademe sınırında zıplayan gemi; 2,4 km içinde görünür olup listede olmayan gemi (50'nin altında).
- 50 pilotluk savaşta paket ort. > 4 KB; S22'de 100 ms'yi aşan kare; tick p95 > 16 ms (100 pilot).
- Eski istemcinin sessizce bozuk paket döngüsüne girmesi.

## Sonuç (2026-10-23)

- **Protokol 7**, sahibin üç kademesiyle: ≤ 800 m 15 Hz, 800 m–1,6 km tam satır 7,5 Hz
  (`MID_EVERY` 4), 1,6–2,4 km uzak satır 5 Hz (`FAR_EVERY` 6); en yakın 50, ±50 m bant. Ayrıntı
  `05-ag-ve-sunucu.md` §9 ve KG-X26.
- **Paket:** 50 pilotluk savaşta ort. 4,33 KB (protokol 6) → **3,19 KB** (hedef ≤ 4 KB).
- **Çizim (`render/crowd.ts`):** 800 m ötesi gövdeler model başına tek instanced çizim; bütün
  parıltı ve seyir ışıkları tek `Points`; bütün izler tek şerit; bütün alevler tek batch. Işık
  700 m, alev/iz 1,2 km'ye kadar; ekran dışı iz çizilmez, yüklenmez. İsabet, kalkan, gizlenme
  anında gemi kendi görseline döner.
- **S22:** 30–39 gemide kare 26,6 → **21,9 ms (~46 fps)**, render 9,8 → 6,9 ms, çizim çağrısı
  ~220 → 92; 40–49 gemide 21,0 ms. Hedef (≥ 45 fps) bu sahnede tuttu.
- Gövdeler neredeyse bedavaydı; asıl maliyet efektlerdeydi (iz, alev, sprite).
- **Açık:** gemi görseli havuzu (giriş/çıkış kurma maliyeti), 100 botluk VPS tick ölçümü, tam 50
  görünür gemiyle S22 ölçümü, ikili kodlama, uzaysal ızgara.
