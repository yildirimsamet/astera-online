# Komutan Gemisi — Güncel geliştirme kaydı

> **2026-10-08:** Yerel oynanabilir MVP v2 (3. şahıs, Subdivision paketi, iniş/kazı, nişan
> yardımı). F7 sahip incelemesi sürüyor. Bu dosya mevcut kodu anlatır;
> [12](12-yol-haritasi.md)'deki üretim kapsamının tamamlandığı anlamına gelmez.

## Çalışma alanı ve önizleme

- Dal: `feature/komutan-gemisi`, başlangıç `00a8d14`; ayrı worktree `../blindspace-komutan-gemisi`
  (KG-K8). Ana `blindspace/master` değiştirilmedi.
- Telefon (aynı Wi-Fi): **http://192.168.1.73:5198/?arena=sandbox**
- Bilgisayar: **http://localhost:5198/?arena=sandbox** — tanı paneli için sonuna `&diag`.
- Web 5198; ayrı arena süreci 3101; `/arena/ws` Vite üzerinden proxy.
- Tek PR bütün özellik için açılacak (KG-K12); henüz commit/push/PR yapılmadı.

## MVP v2'de çalışanlar

- **Alan** (KG-T33): tohumlu 2600 m yarıçaplı disk; merkez istasyon, 4 çıkış kapısı (pist),
  içine girilebilen 2 maden üssü, altından geçilen kırık enkaz, 3 röle, 3 sık kaya kuşağı,
  5 dev kaya, seyrek kayalar, 21 kristal.
- **Uçuş:** 3. şahıs gecikmeli takip kamerası (KG-T36), merkezde yumuşak / kenarda sert çubuk,
  süzülerek yavaşlama, yavaşken dar dönüş, turbo.
- **Çarpışma:** iniş hızının üstünde sekme, altında iniş; hasar yok (KG-T35).
- **İniş ve kazı:** tek dokunuşla hedefli iniş, basılı tutarak kalkış (KG-T41); kristalde kazı,
  kuruyan kristal yarıya kadar dolar.
- **Savaş:** iki namlu, fiziksel mermiler, hafif nişan mıknatısı + sunucu gimbal'ı (KG-T34),
  isabet/öldürme/hasar yönü, kalkan, turbo, duman, gizlenme.
- **Botlar:** avcı, madenci, devriye (KG-T40).
- **Döngü:** çıkışta tam duruş + 3 sn hasarsız bekleme; ölümde kargo saçılması; yakıt bitince
  kurtarma; bağlantı kopması ve devralma.
- **HUD:** ikonlu göstergeler, radar, aynalı canlı arka görüş, hız kutusu, bağlam notu, düşman
  çerçeveleri, önleme işareti, çıkış/kristal/iniş işaretleri ([07 §2](07-hud-ve-ekranlar.md)).
- **Ağ:** protokol v2 (KG-T39), 30 Hz sunucu, 15 Hz snapshot, kendi gemide tahmin + uzlaştırma,
  kendi atışlarında anında tahmini iz.

Misafir MVP hesap, ekonomi, ödül, tamir veya sortie kaydı yazmaz. Başlangıç test kargosu F9'un
gerçek kaynak üretimi değildir.

## Görsel ve ses hattı

- Referans arşivi: worktree'de **`astera-refs/`** (~12 GB, Git/ESLint/build dışında; KG-K6,
  KG-K17). Orijinal APK'lar `~/astera-ref-assets/raw/`.
- v2 paketi `prepare_v2.py` ile üretilir; içerik ve kaynak dağılımı [09 §3.1b](09-varliklar-ve-referans-cikarma.md).
- Render hattı [06 §4](06-istemci.md#render): MSAA + bloom + AgX, DPR 2'ye kadar, CPU'da
  örnek başına kırpma (kare başına 50–310 bin üçgen).
- Model galerisi: http://localhost:5198/__ref/dist/gallery.html · katalog:
  http://localhost:5198/__ref/dist/assets.html (ikisi de yalnız dev).

## Çalıştırma

Mevcut yerel veritabanı değiştirilmedi; arena ayrı `astera_arena_test` veritabanını kullanır.
Sunucu ortamında `NODE_ENV=development`, yerel test `DATABASE_URL` ve
`ARENA_ALLOWED_ORIGINS=http://localhost:5198,http://127.0.0.1:5198,http://192.168.1.73:5198`
gerekir. Ardından:

```sh
pnpm --filter @astera/server dev:arena          # ROLE=arena PORT=3101
pnpm --filter @astera/web dev --port 5198 --strictPort --host
```

Vite, worktree kökündeki `astera-refs/` paketini kendisi bulur (yoksa `ASTERA_REF_ASSETS_DIR`).
`/__ref/` yalnız dev'de çalışır. Paket yoksa sahne prosedürel yedekle açılır.

Masaüstü tuşları: `WASD` / oklar yön, `R`/`F` gaz ±, `X` dur, `Space` ateş, `Shift` turbo,
`Q` duman, `E` gizlenme, `L` iniş yardımı, `T` kalkış.

## Doğrulama (2026-10-08)

- `tsc --noEmit`: rules, server, web temiz. Arena yollarında ESLint temiz.
- Testler: rules arena 63/63, server arena 11/11 (gerçek WebSocket oda testi dahil), web arena 18/18.
  Eski istemci testleri (Codex MVP'sine bağlıydı) silindi; MVP onayından sonra yeniden yazılacak (KG-K25).
- Gerçek GPU'lu tarayıcıda senaryolar: seyir, çatışma, öldürme, yetenekler, kazı/iniş, çıkış,
  yapı turu, sık kuşak ve iki istemcili çevrimiçi oturum (RTT ~3 ms, sunucu tick P95 0,27 ms).
- Fiziksel telefon hissi, ısınma ve FPS ölçümü sahibin F7 incelemesinde yapılır.

## Sahip geri bildirimleri (2026-10-08) ve karşılıkları

| Geri bildirim | Yapılan |
|---|---|
| Kanat izleri yapmacık, bir noktada kesiliyor | kendi gemide iz kaldırıldı (KG-X17); başkalarında zamanla sönen iz |
| Model yarım görünüyor | gemi modelleri iki yüzlü çizildi, eksik arka paneller görünüyor |
| İN düğmesi butonların altında kalıyor | düğme iki başparmak arasına, çubuğun üstüne taşındı |
| Kaliteli motor alevi yok | seyirde mavi, turboda turuncu-kırmızı alev konisi + nozul parlaması |
| Dönerken nişangâh çiftleniyor | bulundu: nişangâh yönü 30 Hz simülasyondan, kamera 60 Hz ara değerden geliyordu; nişangâh kareler arasında ~23 px gidip geliyordu. Ara değerlenmiş poza bağlandı (KG-T42) |
| Ateş görünmüyor | mermi izleri iki yüzlü prosedürel çekirdekle yeniden çizildi |
| Dik temasta "dırr dırr" sesi | sürtünme kaldırıldı; sekme fiziği + tek seferlik çarpma sesi |
| Joystick fazla hassas | eğri `stickLinear` 0,15, yarıçap 64 px |
| Gaz kesince çok hızlı duruyor | `decel` 42 → 20 |
| Hızlı çarpınca sekmeli, yavaşta bir şey olmamalı | `landSpeed` altı iniş, üstü sekme (KG-T35) |
| Joystick ekranda gezinmesin | taban sol alttaki ev alanına kıstırıldı, parmağı izlemiyor |
| İniş anlaşılmıyor, yanlışlıkla KALK | hedefli iniş yardımı + İPTAL + basılı tutarak KALK (KG-T41) |

## Sahip geri bildirimleri — ikinci tur (2026-10-09)

| Geri bildirim | Yapılan |
|---|---|
| Hasardan sonra burnun önünde geçmeyen turuncu patlama | büyük kıvılcım sprite'ı kaldırıldı; ara ara kısa kıvılcım çizikleri + kritikte ince duman (KG-X19) |
| Dönerken alev motordan kayıyor | alev, ışıklar ve gövde aynı yatış grubunda; alev arkadan da okunur (çekirdek parıltılar) |
| Ölünce beyaz çizgiler havada kalıyor; hızla uzayıp kısalmalı | toz çizgileri uçuş bitince söner; uzunluk hızın karesiyle büyür (60 m/s ≈ 4 m, turbo ≈ 42 m) |
| Sis biraz büyük ve yoğun olmalı; FPS düşüyor | bulutlar büyüdü ve yoğunlaştı, kamera girmeden söner; içeride tek katman pus (KG-X20) |
| Lazer geminin arkasına uzuyor | kuyruk yalnız merminin namludan uzaklaştığı kadar |
| Uzun "dit dit dit" sesi | 7–9 sn'lik bip dizileri kaldırıldı; kısa darbe sesi, tek uyarı (KG-X21) |
| Turbo: biraz hızlı, 2 kat uzun, dolum aynı, ivme hissi yok | turbo her gazda 216 m/s, 6 sn, dolum 7,5 sn; kamera/lens/toz/alev ile his (KG-K26) |

Kıvılcımlar artık hız yönünde uzayan çizikler; eski doku kare dörtgende kahverengi kare gibi
görünüyordu (isabet ve patlama kıvılcımları da düzeldi).

## Sahip geri bildirimleri — üçüncü tur (2026-10-09)

| Geri bildirim | Yapılan |
|---|---|
| Turbo ivmelenme hissi yok | ivme 2× (60 → 216 ≈ 0,65 sn); kamera kolu ivme yayı; ateşleme parlaması; turboda yakın yoğun toz |
| Motor alevi basit, çocuksu | koni kaldırıldı; Subdivision iz dokulu, türbülanslı alev şeridi + beyaz-sıcak boğaz (KG-X22) |
| Yön değiştirme seri, nişan zor | azami dönüş %50 gazda 110 → 82°/sn, tam gazda 90 → 72°/sn; çubuk yolu 64 → 72 px |

## Genel inceleme (2026-10-09)

Bulunan ve düzeltilenler:

- Kural: inmiş gemide turbo çalışmıyordu → turbo kalkış + kaçış.
- Ağ: kuru kristal istemcide yanlış görünüyordu → `dry` protokolde. Uzak gemiler sıra kayınca bir kare
  başka geminin pozundan çiziliyordu → id ile eşleme.
- Kontrol: menü/odak kaybı gaz kolunu sıfırlıyordu. "Yeniden uç" gazı 0'da başlatıyordu. İniş yaklaşmasında
  turbo veya ölüm yardımı kesmiyordu.
- Ses: kilit sesi kilit boyunca 0,9 sn'de bir tekrar ediyordu. Düşük yakıt uyarısı 6 sn'de bir çalıyordu.
- HUD: "İnebilirsin" kalkan sayacını ve ambar dolu uyarısını eziyordu. Ekran dışı işaretler geminin
  üstüne düşüyordu. Bağlantı etiketi notun altında kalıyordu.
- Kamera: kutu yapıların duvarına girebiliyordu.
- Bellek: gemi görseli kaldırılırken sprite/kalkan/ışın malzemeleri serbest kalmıyordu. Mermi başlıkları,
  duman ve kargo her karede yeni nesne yaratıyordu → doğrudan tampon. Duman tamponu her bulutu çizecek
  kadar büyütüldü.

## Sınırlar ve sıradaki iş

- Referans varlıklar geçicidir; yayından önce hepsi sahibin yaptıracağı karşılıklarla değişir
  ([09 §10](09-varliklar-ve-referans-cikarma.md)).
- Commit'ten önce `tools/.*.tmp.mjs` geçici çekim betikleri silinir; `astera-refs/` asla eklenmez.
- **Sonraki iş:** F7 sahip incelemesi (telefonda kontrol ve savaş hissi), ardından istemci
  testlerinin yeniden yazılması; üretim auth, galaksi oda orkestrasyonu, netcode sertleştirme.
  F8–F11 bu MVP'de yoktur. KG-A27 varsayılanları onaylı canlı PvP kuralı sayılmaz.
