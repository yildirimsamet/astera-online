# Canlı güncelleme (OTA) ve sürüm farkına dayanıklılık — plan (2026-11-24)

**Durum:** Plan. Owner kararları bekleniyor (§2). Kod yok.

## 1. Sorun ve hedef

Android uygulaması oyunun web kodunu içine paketliyor (`bundled: true`, `mobile-dist/native-production`). Web her gün değişiyor, Play sürümü haftalarca geride kalıyor. Sonuç:

- Her web değişikliği yeni AAB + Play incelemesi + `MIN_NATIVE_BUILD` zorlaması ister.
- Eski uygulama yeni sunucu verisini okuyamaz. 2026-11-24'te web'de bile aynı tür hata yaşandı: istemci şeması sunucunun gönderdiği alanı tanımadı (`probeMoonSchema`, `fleet` ↔ `fleetSize`) ve bütün İstihbarat sekmesi düştü.

**Hedef:**
1. Web değişikliği uygulamaya Play'e gitmeden, dakikalar içinde ulaşır. Uygulama kendi web paketini sunucudan günceller; yalnızca değişen dosyaları indirir.
2. Play'e yalnızca native kabuk değiştiğinde gidilir (izin, native eklenti, SDK). `MIN_NATIVE_BUILD` bu nadir durumun acil anahtarı olur.
3. Sunucu ile istemci arasındaki sürüm farkı tek bir alan yüzünden ekranı düşürmez; bozan değişiklik deploy'dan önce testte yakalanır.

**Değer:** RE-ENGAGEMENT (Android oyuncusu güncelleme duvarına çarpmaz), COMPETITION (herkes aynı kuralla oynar).

## 2. Owner kararları

| # | Soru | Öneri | Neden |
|---|---|---|---|
| K1 | Güncelleme sunucusu: Capgo bulutu mu, kendi VPS'imiz mi? | **Kendi VPS'imiz** | Ek ücret yok; paket zaten her web deploy'unda VPS'te üretiliyor; oyuncu verisi üçüncü tarafa gitmez. Bedeli: yayın betiğine bir adım eklenir. |
| K2 | Yeni paket ne zaman devreye girer? | **İndirme arka planda; uygulama bir sonraki açılışta yeni sürümle açılır. Kurallar değiştiyse (sunucu 426 dönerse) hemen "Güncelleniyor" ekranı, indir, yeniden başlat.** | Oyuncunun bir savaşın veya sıçramanın ortasında ekranı yenilenmez; kural değişikliğinde ise oyun çalışmaya devam edemez, beklemek anlamsız. |
| K3 | Kademeli yayın (önce %10)? | **Hayır, herkese birden; yeni paket açılamazsa otomatik eski pakete dönüş.** | 42 aktif oyuncuda yüzde dilimi anlamsız; asıl güvence açılmayan paketin kendini geri alması (EN-07). |

## 3. Bilinen gerçekler (koddan)

| # | Gerçek | Yer |
|---|---|---|
| G1 | Capacitor 8.5.3; native eklentiler: AsteraSession, AsteraDisplay, App, Network, Push, LocalNotifications. | `apps/web/package.json`, `android/app/src/main/java/...` |
| G2 | İstemci `x-astera-build` başlığında Android versionCode'u gönderir, ama değer **web paketine build anında gömülür** (`VITE_ASTERA_NATIVE_BUILD`). OTA'da web değişir, kabuk numarası değişmez: bu iki kimlik ayrılmalı. | `src/platform/updateGate.ts`, `mobileBuild.ts` |
| G3 | Sunucuda iki kapı var: `MIN_NATIVE_BUILD` (426, `x-astera-build`) ve kurallar kimliği (`x-astera-rules` ≠ `ECONOMY_PROFILE.id` → 426). | `apps/server/src/app.ts:354`, `services/placementGate.ts:158` |
| G4 | 426 gelince uygulama Play mağazasına yollar; web sayfayı yeniler. | `src/shell/UpdateRequired.tsx` |
| G5 | Paket 199 MB; JS ≈ 10 MB. Geri kalanı model (39 MB), arena (37), görsel (34), legacy (21), ref paketi (40), müzik (12). Dosya adları içerik hash'li; değişmeyen dosya aynı adla kalır, yani delta doğal olarak küçük olur. | `mobile-dist/native-production` |
| G6 | `apps/server/test/contract.test.ts` gerçek API cevaplarını web şemalarıyla zaten parse ediyor (95 test), ama ay verisi kapsanmıyor. Sonda ay okuması hatası bu boşluktan geçti. | `apps/server/test/contract.test.ts` |
| G7 | Play politikası (Device and Network Abuse): mağaza dışından çalıştırılabilir kod indirme yasağı, WebView'da çalışan JavaScript için geçerli değil. Uygulamanın amacını değiştirmeyen içerik güncellemesi serbest. | Play Console politika metni; F0'da güncel metin tekrar okunur. |

## 4. Yaklaşım

**Araç:** `@capgo/capacitor-updater` eklentisi, manuel modda, kendi sunucumuzla. Bulut hesabı kullanılmaz.
- Eklenti indirmeyi, paketi yerleştirmeyi ve "yeni paket açılmadıysa eskisine dön" işini yapar.
- Biz yalnızca "hangi sürüm var, hangi dosyalar" bilgisini VPS'ten veririz.
- **Yedek yol:** F0'da eklenti Capacitor 8 ile uyumsuz çıkarsa veya delta desteği kendi sunucuyla çalışmazsa, Capacitor çekirdeğindeki `WebView.setServerBasePath` / `persistServerBasePath` ile ince bir kendi eklentimizi yazarız. Mevcut AsteraSession eklentisiyle aynı desen.

**Akış:**
1. Web deploy'u yalnız webroot'u değil, `ota/<sha>/` altına uygulama paketini de yayınlar:
   - `manifest.json`: dosya → sha256, boyut.
   - Dosyalar içerik hash'iyle tekrar kullanılır.
   - `ota/latest.json`: `{ version: <web sha>, minShell: <versionCode>, rules: <ECONOMY_PROFILE.id>, manifest: <url> }`.
2. Uygulama açılışta ve arka plandan dönüşte (en fazla 30 dakikada bir) `latest.json`'u okur.
3. Yeni sürüm varsa ve kabuk `minShell`'i karşılıyorsa yalnızca hash'i farklı dosyaları indirir, hash'leri doğrular ve paketi hazırlar.
4. Bir sonraki açılışta yeni paketle açılır. İlk başarılı `/api/auth/me` cevabından sonra "hazırım" bildirir; bildirmezse eklenti bir sonraki açılışta eski pakete döner.
5. Sunucu 426 (kurallar değişti) dönerse "Güncelleniyor" ekranı gelir: ilerleme gösterilir, paket indirilir ve oyun hemen yeniden başlar. Play mağazası yalnızca kabuk `minShell`'in altındaysa önerilir.

**Kimlikler (G2):**
- `x-astera-build`: kabuğun gerçek versionCode'u. Çalışma anında native'den okunur, pakete gömülmez.
- `x-astera-web`: web paketinin git SHA'sı. Sunucu loglar ve Sentry `release` etiketine yazar (EN-05).
- `MIN_NATIVE_BUILD` yalnızca kabuğa bakar; anlamı değişmez.

## 5. Sürüm farkına dayanıklılık

1. **Sözleşme testleri (G6):** Ay verisi `contract.test.ts`'e eklenir: aylı dünyaya sonda, `/api/intel`, `/api/galaxy` ay listesi, gezegen ayı, Gözcü taramaları, aya saldırı raporu. Kural: sunucuya yeni bir JSON alanı ekleyen her iş, o alanı içeren gerçek cevabı web şemasıyla parse eden bir sözleşme testi de ekler (`docs/engineering-standards.md`'e yazılır).
2. **N-1 kontrolü:** Bir test betiği canlıdaki web sürümünün şemalarını (`git show <canlı sha>:apps/web/src/api/schemas.ts`) geçici bir dosyaya alır ve yeni sunucunun sözleşme cevaplarını onlarla da parse eder. Eski istemciyi kıracak değişiklik deploy'dan önce görülür. Deploy betiği bunu çalıştırır.
3. **Liste başına hoşgörü:** Sunucunun gönderdiği listeler (sonda raporları, radar kaydı, savaş raporları, bildirimler, kuyruklar) eleman eleman parse edilir:
   - Tanınmayan veya bozuk eleman atlanır ve Sentry'ye tek bir uyarı gider.
   - Sayfanın geri kalanı çalışır.
   - `chroniclePageSchema` bunu zaten yapıyor (`knownChronicleKinds`); aynı desen ortak bir yardımcıya taşınır.
   - Sayfanın kendisi bozuksa hata yine görünür. Hoşgörü yalnızca liste elemanı içindir, sessiz veri kaybı yaratılmaz.

## 6. Fazlar (adım → doğrulama)

| Faz | İş | Doğrulama |
|---|---|---|
| F0 Spike (½ gün) | Eklentiyi debug APK'ya kur. S22'de: kendi sunucudan indir, sonraki açılışta uygula, "hazırım" gelmezse geri dön, manifest ile kısmi indir. Lisans ve Capacitor 8 uyumu kontrol edilir; Play politika metni tekrar okunur. | Telefonda video veya ekran görüntüsüyle 4 senaryo; karar: eklenti mi, kendi eklentimiz mi. |
| F1 Kimlikler | `x-astera-build` native'den okunur, `x-astera-web` eklenir; Sentry release = web SHA; sunucu iki değeri loglar. | Testler: başlıklar doğru; `MIN_NATIVE_BUILD` yalnızca kabuğa bakıyor. |
| F2 Yayın | Web build betiği `ota/<sha>/manifest.json` + dosyalar + `latest.json` üretir; nginx `/ota/`'yı uzun önbellekle sunar; `latest.json` önbelleksiz. `latest.json` en son yazılır (atomik). | Betik testi: manifest hash'leri dosyalarla eşleşiyor; yarım yayın `latest.json`'u değiştirmiyor. |
| F3 İstemci | Güncelleme denetleyicisi (açılış, dönüş, 426); delta indirme; "Güncelleniyor" ekranı (mevcut marka sahnesi + ilerleme); "hazırım" bildirimi. | Birim testleri (sürüm karşılaştırma, minShell, 426 akışı) + S22'de uçtan uca: web deploy → telefon 1 dk içinde yeni sürümde. |
| F4 Dayanıklılık | §5.1–5.3. | Sözleşme testleri yeşil; N-1 betiği bugünkü `fleet` hatasını eski şemayla yakalıyor (geriye dönük kanıt). |
| F5 Geçiş | Güncelleyicili kabukla AAB v15 → Play. Yayına girince `MIN_NATIVE_BUILD=15` son kez. Sonraki web deploy'ları OTA ile gider. `deployment.md` + hafıza güncellenir. | Play'deki v15 bir web deploy'unu Play'siz alıyor. |

**Tahmini iş:** F0–F4 ≈ 3–4 gün + telefon testleri. F5 Play incelemesine bağlı.

## 7. Riskler

- **Bozuk paket:** Açılmayan paket otomatik olarak eskisine döner. Bozuk ama açılan paket için sıradaki web deploy'u düzeltir; acil durumda `latest.json` bir önceki SHA'ya çevrilir (tek adım geri dönüş).
- **Mobil veri:** İlk OTA, v15'in paketinden farkı indirir. Sonrakiler genellikle birkaç MB JS. Büyük varlık değişikliğinde (yeni model paketi) indirme Wi-Fi'ı beklemez ama ilerlemeyi gösterir. Gerekirse sonradan "büyük güncellemeyi Wi-Fi'da indir" eklenir.
- **Native–web uyumsuzluğu:** Yeni web, kabukta olmayan bir native eklentiyi çağırırsa `minShell` yükseltilir. Bu durumda uygulama Play'e yönlendirir; `MIN_NATIVE_BUILD`'in yeni rolü budur.

## 8. İlerleme

| Faz | Durum |
|---|---|
| Owner kararları K1–K3 | Bekliyor |
| F0–F5 | Başlamadı |
