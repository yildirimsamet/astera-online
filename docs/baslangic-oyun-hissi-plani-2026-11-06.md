# Başlangıç: oyun hissi planı (owner, 2026-11-06)

Kaynak: owner'ın 9 maddelik telefon testi. İlke: CLAUDE.md §4.6, "Biz bir OYUNUZ". Mekaniği değiştiren tek nokta B2'dir (açılış havuzu); diğerleri sunum ve yönlendirmedir.

## Faz A — Prolog (madde 1, 2, 3)

| # | Ne | Nasıl |
| --- | --- | --- |
| A1 | Galaksi canlı | Camdaki galaksi yavaşça döner (çekirdek etrafında), çok hafif nefes alır; aralarda rastgele yıldız parıltıları (ucuz CSS/canvas sprite), uzakta ara sıra kayan ışık. |
| A2 | "Yedek gücü bağla" → **şalter** | Konsolda gerçek bir kol şalter: aşağı sürüklenir (ya da dokunulur ve iner); takılır, iki kez kıvılcım çakar, tutar. Ses: metal "klak" + elektrik vızıltısı; titreşim: commit. Işık iki kez titreyip yanar. |
| A3 | Rafineri başlat → **ocak ateşlenir** | Basılı tutulan ateşleme düğmesi; bırakınca ocak resminde alev/kor dalgası, kıvılcım parçacıkları, turuncu ışık camdan köprüye vurur; uğultu sesi yükselir; bar dolarken alev nabız atar. |
| A4 | Topla | Alaşım sayısı yukarı uçan kırıntılarla sayaca akar; tık sesleri, hafif titreşim. |
| A5 | Sensör yaması | Kaynak kıvılcımları ve statik cızırtı; yama bitince radar çizgisi açılır. |
| A6 | **Bilinmeyen sinyal → gemiye warp** | Sinyale dokununca kamera ileri ışınlanır (yıldızlar çizgiye döner, ses: warp), boşlukta sahipsiz bir koloni gemisi belirir, projektör ışığıyla döner. Alt metin: "Bu gemi artık senin olabilir. Bir maceraya başla." Hak iddiası bu sahnede yapılır. Gösterilen gövde, sunucunun vereceği gövdedir (A7). |
| A7 | Gösterilen = verilen | Prolog gövdeyi seçer (SPINE/WEDGE/SEED) ve saklar; claim isteği gövdeyi gönderir; sunucu id'yi gövdesi tutana kadar üretir (`vesselHull(id)`). Sütun ve migration gerekmez. |

Ses: mevcut 10 mp3'e ek olarak `switch`, `ignite`, `warp`, `hum` WebAudio ile anında sentezlenir (asset yok, ağ yok).

## Faz B — İlk giriş (madde 4, 5)

| # | Ne | Nasıl |
| --- | --- | --- |
| B1 | Gemi ortalı değil | İlk açılış kamerası gemiyi ekranın ortasına, alttaki kartın üstüne oturtur. |
| B2 | "Alaşım topla" ama havuz boş | Açılışa küçük bir havuz (1 saatlik üretim, 60 alaşım) eklenir; ilk toplama anında olur ve öğretir. Metin "dolunca topla" anlamını da taşır. |
| B3 | Boş ekranda yönerge yok | **Görev çizgisi**: ekranın üstünde her zaman sıradaki tek adım ("Rafineriyi 2. aşamaya onar · Üs") ve bir ok/parıltı ilgili sekmeyi gösterir. Adım bitince ses, onay, sıradaki adım. |

## Faz C — Hikâye ve rehberlik (madde 6, 7, 9)

| # | Ne | Nasıl |
| --- | --- | --- |
| C1 | Ana galaksi kartı | Sezon ve dünya sayısı yerine hikâye: "Vantage — filonun hedefi. Asıl yolculuk orada başlıyor. Motoru onar, yakıtı doldur, boşluktan atla." Altında ilerleme (motor %, yakıt). |
| C2 | Menüde rehber | **Seyir defteri**: hikâye bölümleri (Güç → Rafineri → Sensörler → Savunma → Kargo → Motor → Atlayış), her birinde durum, ne işe yaradığı ve "git" kısayolu. |
| C3 | Kilit işaretleri geri | Kilitli sekmelerde kilit tekrar görünür. Açılan sekme parlar, üstünde "Yeni" etiketi ve tek cümlelik tanıtım belirir; ilk dokunuşta söner. |

## Faz D — Gemi canlılığı (madde 8)

| # | Ne | Nasıl |
| --- | --- | --- |
| D1 | Sönük gemi | Gemiye ucuz anahtar ışığı ve kenar (rim) parlaması; galakside uçan gemiler gibi ince dış çizgi. |
| D2 | Hasar görünür | Harap: birkaç noktada yanan alev, duman, kızarmış parçalar, ara sıra kıvılcım. Yamalı: daha az duman, söner gibi korlar. Yenilenmiş: temiz, sistem ışıkları. Sprite/shader, gerçek ışık yok. |

## Durum (2026-11-06, commit edilmedi, deploy yok)

- **A:** şalter (sürükle/dokun, kıvılcım, `switch` sesi, `thunk`), basılı tutma kadranları (sağda; owner ek isteği), soğuk ocak → alev, toplama uçuşu, kaynak kıvılcımı, sinyal → warp. Sesler `lib/synth.ts`'te kodla üretilir.
- **A6 (owner ek isteği):** gemi 2D resim değil, `ShipScene.tsx`: gerçek GLB model, parmakla döner, nebula + yıldızlar + uzakta dönen ana galaksi; kamera sıçrayıştan çıkıp gemiye uçar. Warp: köprü sinyale dalar, halkalar, beyaz **tutulur**; 3D sahne beyazın altında önceden açılmış olur, kokpit bir daha görünmez.
- **A7:** gösterilen gövde `vesselHull` ile claim'e gider; sunucu aynı gövdeyi verir.
- **B1:** açılış kamerası gemiyi ortalar, ana galaksi önünde ve üstte. **B2:** `STARTER.opening.works.alloy = 60` (Rafineri 1 ≈ 59,5/sa). **B3:** galaksi üstünde "Sıradaki" çizgisi (`starter/objective.ts`).
- **C1:** Vantage kartı hikâye + onarım %/yakıt ilerlemesi + "Gemiye git". **C2:** menüde Seyir defteri. **C3:** kilitli sekmede asma kilit; açılan sekme parlar ve "Yeni" yazar, ilk dokunuşta söner.
- **D:** `galaxy/VesselBody.tsx`: doku öz-ışıması (gemi soluk değil), ince ışık dış çizgisi, görünüme göre alev/duman/kıvılcım (Harap: 3 alev + kıvılcım; Yamalı: kor; Yenilenmiş: temiz). Prolog ve galaksi aynı gövdeyi çizer.

## Sıra ve doğrulama

A → B → C → D. Her faz: testler (kural/akış), 350 px'te telefon görüntüsü, ses/titreşim elle denenir. Uzun ekonomi testleri koşulmaz.
