# Saf yörünge tasarımı — 8 Ekim 2026

Kullanıcı önceki hacimli gezegen yaklaşımını reddetti. Yeni yön: düz, saf, siyah–turkuaz
bir yörünge amblemi. Verilen örneklerin sadelik ve dönüş fikri referans alındı.
Mevcut ASTERA SVG harfleri, ONLINE hiyerarşisi ve gerçek yükleme davranışı korundu.

Kompozisyon: iki ince dairesel yörünge, küçük merkez ışığı, dış yörüngede kendi
uydusu bulunan bir nokta. Yörüngeler aynı yönde 12,8 ve 8,4 saniyede, küçük uydu
3,6 saniyede döner. Hacimli gezegen, doku, yıldız alanı ve filo izleri kaldırıldı.
Animasyon yalnız CSS transform kullanır; ekstra indirme, kütüphane veya kare başına
JavaScript yoktur. İlk HTML ve React aynı çizimi kullanır.

Kapsam: opening-art.html ve opening.css; görsel kontrolün hedefleri yeni ambleme
uyarlandı. Yükleme mantığında değişiklik yok; bu tur tasarım değişikliğidir.
Riskler: küçük yatay ekranda taşma, amblemin markayı bastırması, fazla silik çizgiler,
bootstrap/React uyuşmazlığı, yavaş cihazlarda akıcılık. Bunlar görsel kontrolde incelendi.

`node tools/visual.mjs out/loading-pure --loading`: yedi ekran oranı, bootstrap,
ölçülü/belirsiz ilerleme ve 6× CPU kontrolü geçti. İlk ölçüm p95 16,8 ms.
Fiziksel cihaz kontrolü yapılmadı. Görsel özdeğerlendirme: 8/10; son değerlendirme
kullanıcının tercihine ve gerçek cihazda okunurluk kontrolüne bağlıdır.

Önceki tasarımın inceleme ve ölçümleri out/loading-review altında bulunur.

Son doğrulama: 44 ilgili test ve üretim derlemesi geçti. Tekrarlanan görsel ölçüm
p95 16,7 ms, 151 kare / 2,5 saniye. Hareket kaydı: out/loading-pure/orbit-motion.webm.
`pnpm verify`, görev dışında kalan TargetMapPreview.tsx:23 içindeki neutralTier
tip uyuşmazlığında durdu; tam depo doğrulaması yeşil değildir.
