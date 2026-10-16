# Radyasyon bombası üretim görünümü

Owner'ın Ölüm Yıldızı karşılaştırması üzerine küçük ikonlu stok listesi, üç ayrı tam genişlikte hangar sahnesine dönüştürüldü. L1 zeytin yeşili, L2 petrol mavisi, L3 koyu metal/bronz kimliğini korur. Her kart koruma öncesi hasarı, 30 dakikalık etkiyi, stok/üretim durumunu ve gerektiğinde fiyat, gerçek üretim süresi ile onaylı üretim düğmesini gösterir. Kilit yalnız görseli soldurur; şart ve fiyat okunur kalır. Üretim, maliyet, kapasite ve hasar kuralları değiştirilmedi.

Görseller built-in imagegen ile onaylı M1 türevleri referans alınarak üretildi. Owner'ın ek isteğiyle gövdelere radyasyon amblemleri ve sarı/siyah uyarı bantları işlendi. PNG master'lar `assets/source/premium/tactical/radiation-bomb-forge-l{1,2,3}-v1.png`; WebP teslimler `apps/web/public/assets/images/tactical/radiation-bomb-forge-l{1,2,3}.webp` altında. Tam ilk üretim ve düzenleme istemleri, referanslar, yollar ve hash'ler aynı kaynak dizinindeki `radiation-bomb-forge-provenance.json` dosyasındadır. Üç teslim toplam yaklaşık 349 KiB; kartlarda ek WebGL sahnesi çalışmaz.

Gerçek uçuş GLB'lerine de dört yüze oturan geometrik radyasyon amblemleri ve uyarı bantları eklendi. Siyah işaretler malzemeye göre birleştirilir; her seviye 8 draw call, en büyük model 3348 üçgen. Yeni doku isteği yoktur. M1 burun/egzoz yönü ve uçuş boyları korunur. Eski küçük model render'ları da güncellendi.

Doğrulamalar:

- Önce yeni sahne/durum testi ve GLB uyarı işaretleri testi RED; uygulama sonrası 3 dosyada 111 test PASS. Son type-safe test düzeltmesinden sonra GLB dosyasında 3 test tekrar PASS.
- Web typecheck PASS: `/tmp/radiation-forge-types-final.log`.
- Altı dil, 350/1280px, boş/hazır/üretimde/duraklamış/uçuşta/kilitli: 32 görsel durum PASS. Görsel kırpılmaması, taşma, çeviriler, düğmeler ve gerçek görsel yüklenmesi ölçülür: `/tmp/astera-radiation-forge-20261016-final/checks.json`.
- Telefon kontrolünde burun/kuyruk kırpılması görülüp sahne oranı 3:1 yapıldı. Son 32 durum bu düzeltmeden sonra geçti.
- Gerçek WebGL uçuş/egzoz/yüzey darbesi, radyasyon renkleri ve Aegis sis davranışı tekrar PASS: `/tmp/astera-radiation-markings-flight/checks.json`.
- İlgili 13 kod/test/locale/tool dosyası `pnpm lint` ile tam liste doğrulanarak kontrol edildi: 13/13, sıfır hata/uyarı PASS (`/tmp/radiation-forge-lint-final.log`). Diğer yerel taskların dosyaları bu CR'ye dahil değildir.

Yerel API/worker sağlık kontrolü: queue OK, worker hatası 0. Son ekran görüntüleri `.dev/radiation-forge-20261016/production-desktop.png` ve `production-mobile.png` altında.

Master'da yerel çalışma; commit, push veya deploy yapılmadı. Yeni mekanik/migration eklenmedi.
