# Astera landing görsel kaydı

Mod: built-in image_gen. Yeni tanıtım illüstrasyonu; oyun ekran görüntüsü değildir. Sayfadaki açıklama bu ayrımı belirtir. Mevcut logo ve gerçek gemi renderları değiştirilmedi.

Orijinal üretim: `out/landing-premium-2026-10-18/art/orbit-hero-v1-original.png` (yerel çalışma çıktısı). Kalıcı web assetleri: `apps/web/public/assets/images/landing/orbit-hero-v1.webp` ve `orbit-hero-mobile-v1.webp`. ImageMagick yalnız teknik boyutlandırma/WebP kodlama için kullanıldı; kompozisyon değiştirilmedi.

## Final prompt

```text
Use case: ads-marketing
Asset type: original cinematic hero background for Astera Online, a persistent multiplayer space strategy game website.
Primary request: premium, restrained, spectacular orbital photograph-like illustration. A vast inhabited rocky planet occupies the RIGHT half, luminous delicate pale teal atmosphere, warm amber continents at dusk and subtle believable city lights, immense scale. A small formation of three coherent angular blue-grey armored spacecraft with understated cyan engines approaches its orbit in the right-middle foreground. Ships are tangible functional spacecraft, not fighter aircraft. A distant small moon and sparse realistic stars. This is aspirational promotional illustration, not a fake gameplay screenshot.
Composition: very wide landscape 16:9. Left 45 percent is quiet nearly black midnight navy negative space for actual HTML headline and buttons; no prominent bright stars, ships or planet across that text area. Planet partially cropped by right edge, its curved horizon unmistakable. Strong visual depth with controlled contrast, clear forms even at mobile sizes.
Style: high-end art-directed NASA-like cinematic space image, physically believable light, rich fine surface texture, restrained atmospheric haze. Utopian, epic, mysterious, not dystopian destruction. Sophisticated near-black navy, desaturated steel blue, luminous ice teal and small warm bronze accents.
Constraints: no text, no typography, no numbers, no UI, no brand marks, no watermark, no grid, no neon purple, no giant explosions, no oversaturated nebula, no noisy particle cloud. Preserve generous quiet negative space. High quality finished web campaign art.
```

## Bölüm görselleri — owner bulanıklık geri bildirimi

18 Ekim: önceki 768×259 filo banner'ı yaklaşık630×468 alana cover ile büyüyünce etkin yatay detay yaklaşık350px'e düşüyordu. Galaksi görseli de gereksiz crop uygulanıyordu. Yeni üretim yapmadan depodaki kaliteli orijinaller değerlendirildi: `assets/source/atmosphere/core-t3-v2.png`, `galaxy-account-v1.png` (1916×821), `praetorian-scene-v1.png` ve `astera-orbital-deck-v1.png` (1536×1024). Eski ortak oyun assetleri değiştirilmedi.

Kalıcı web dosyaları `apps/web/public/assets/images/landing/chapter-{worlds,intelligence,fleet,clans}-v1-{768,1536}.webp`. Bunlar mevcut orijinallerin teknik WebP88 kodlamalarıdır; ImageMagick ile yalnız downsample/encode, sanatsal düzenleme veya upscale yok. İki boyut `srcset/sizes` ile seçilir; sabit cover/aspect crop kaldırılır, orijinal oran korunur. Yeni AI üretim prompt'u yok; mevcut kaynakların kökeni `assets/source/atmosphere/provenance.json`. Boyut/hash/byte kanıtı `out/landing-premium-2026-10-18/art/chapter-asset-provenance.json`.
