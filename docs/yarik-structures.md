# Yarık yapıları — Review 8, Review 7 ve Brief 4 §2

2026-10-22 · Blender 5.2.2 LTS · canlı Blender MCP · metre / glTF Y-up. Proje testleri ve git çalıştırılmadı. Yalnız `assets/source/yarik/`, `tools/yarik-blender.py` ve bu rapor değiştirildi.

Gangut düzeltildi; kitin 17 parçası yeniden dışa aktarıldı; Halka Harabe ve iki kayalık teslim edildi. Önceki Review 3 çalışmasının Sessiz Liman / İskele bölümü hâlâ bekliyor; bu tur o iki varlığa dokunulmadı.

## Dosyalar ve doğrulama

Her parça klasöründe GLB (`collider`, `lod0`, `lod1`, `lod2` ve işaretçiler), rota/port JSON’u, `validation.json`, `provenance.json` ve 1600×1000 iki PNG önizleme var. Kitin düzenlenebilir kaynağı `assets/source/yarik/yarik-kit.blend`; 17 parça ve test montajı ayrı sahnelerde. Her parça sonrasında kaydedildi. Dört modelin kendi klasöründe ayrıca kendi `.blend` dosyası ve dört 1024 px PBR PNG’si var.

Kitin tamamı bir malzeme ve `kit_shared/kit_{base,normal,orm,emissive}.png` dosyalarını paylaşır. Kit GLB’lerini paketlerken `kit_shared/` göreli yolunu koruyun. Dört büyük modelin GLB’leri dört PNG’yi gömülü taşır. Kaynak model kredileri/lisansları ve çıktı SHA-256 değerleri provenance dosyalarında. Yeniden üretim aracı PyMeshFix 0.18.1 gerektirir; araç/kurulum artıkları oyuna paketlenmez.

21 GLB dosyadan tekrar okundu: bütün colliderlarda tek bağlı bileşen; açık/non-manifold kenar, winding hatası, sıfır alanlı üçgen, loose vertex ve öz-kesişim 0. Uzaklıklar 50.000 alan ağırlıklı nokta/yön ve kaynak köşeleriyle denetlendi; aşağıdaki uzaklıklar seri GLB üzerindeki ölçümdür. Bu örneklemli kontrolü matematiksel bir “her noktada” ispatı olarak sunmuyoruz.

## Gangut ve yeni modeller

| Parça | Collider | LOD0 / LOD1 / LOD2 | En dar rota (m) | LOD0→C / C→LOD0 (m) |
|---|---:|---:|---:|---:|
| gangut | 12000 | 21650 / 7584 / 2166 | 69.783 | 0.6183 / 0.5945 |
| halka_harabe | 8536 | 8536 / 2988 / 854 | 69.642 | 0.0007 / 0.0007 |
| kayalik_1 | 6250 | 6250 / 2188 / 624 | 63.965 | 0.0242 / 0.0242 |
| kayalik_4 | 7122 | 7122 / 2492 / 712 | 63.833 | 0.2179 / 0.2179 |

**Gangut:** ±Z ekseninde iki 96×96 m nominal geçit; kapalı zırhlı uçlar, 2 m hazard dudağı ve geçit başına dört tompa amber lamba. Halka/göbek taşınmadı; gövde yük yolları geçidin yanından yaklaşık 8 m kesitle devam ediyor. Collider 12.000 üçgene indirildi; küçük siluet ayrıntıları ve rota yakınları ölçülerek korundu. Ana JSON rotası +320→−320 m, Y=55 m: 641 adet 1 m aralıklı örnekte minimum **71,361 m**. Önceden uzatılmış eksenin 17 örneği katı içindeydi; tam eksen açıklığı 0→71,361 m. Halka içi eski rota 69,776→69,783 m. Kalan halkada 78 kesitte minimum kalınlık 13,759 m; altı kiriş ölçümünün minimumu 7,999 m. ±85 m girişleri, yük cebi ve cevher işaretçisi korundu. Kapalı hayalet boşluk: 0. Önizleme: dış görünüş ve halkanın dışından geçit içinden göbeğe bakış.

**Halka Harabe:** uzaktaki parçacıklar çıkarıldı; iki eğik halka, kırık bağlantılar ve sanatçının UV/normal ayrıntısı korundu. Açık panellere 2 m backing, kirişlere 1,2 m yüzey genişletmesi ve 43 küçük panel cebine görünür katı dolgu yapıldı. 600 m uçuş hattı 35,980→69,642 m; dört tanımlanan kiriş merkezinde iki enine kesitten minimum 3,690 m. Yük cebinin yarıçap açıklığı 45,672 m. En büyük kapatılan cep **8,744 m**, glTF konumu **[-14,16467; 65,56424; 57,41046]**. Bu sayı 43 tespit edilen karşılıklı panel cebinin kontrolüdür; bütün kafes için eksiksiz bir 10 m altı boşluk sertifikası yok.

**Kayalık 1 / 4:** kaynak taramanın ana silueti, koyu uzay-bazalt paleti ve geniş kırık yüzeyli tek derin yarık. Yaklaşık boyutlar sırasıyla 573×798×554 m ve 797×658×494 m. Yarık tasarım genişliği 63,4–78,6 m; derinlik 574,38 / 473,42 m; alt gövde iki tarafı tek kapalı katıda bağlar. Normal haritaları sırasıyla **1.999.976 / 1.999.996** kaynak üçgenden 19 ayrı kısa bake ile 1024 px’e aktarıldı. Aynı anda yalnız bir kaynak parçası tutuldu; her bake sonrasında kaldırılıp orphan purge yapıldı. Yeni varlıkların önceki kabul edilmiş rotası olmadığından before alanı null. Collider ve LOD0 aynı ana retopolojiden; görünmez kapatılmış boşluk 0.

## Kit — Review 7

Geniş dış kaplama albedosu yaklaşık 0,35–0,38; büyük plakalar, 20 m rib ritmi, borular ve ince iç hazard dudağı korundu. Bütün render LOD’larında dış pencere grupları ve düşük amber seyir ışıkları var. Portların yanındaki dik kolon yüzeyleri ayrıca kontrol edildi. Ortak atlas pencere emission RGB’si 0,32/0,44/0,52; dış amber 0,17/0,055/0,006; güç 3. İç mekân ışık dili korunuyor.

`kit_tower_top` üst kuyusu exporter tarafından `top_well` **entrance** olarak yazılır: [0,60,0], +Y. İki port kalır. Port/giriş/cevher/yük/pad dönüşümleri, rota verileri ve collider geometrileri bu görünüş turunda korunur; tek sınıflandırma değişikliği üst kuyudur.

| Parça (`kit_`) | Collider | LOD0 / LOD1 / LOD2 | Min. rota m | L0→C / C→L0 m | Not |
|---|---:|---:|---:|---:|---|
| corridor | 32 | 2844 / 1027 / 344 | 70.000 | 7.000 / 5.641 | — |
| bend | 400 | 4018 / 1362 / 541 | 69.963 | 7.258 / 5.786 | Y |
| tee | 192 | 4212 / 1407 / 502 | 70.000 | 7.000 / 7.142 | Y |
| cross | 252 | 4156 / 1472 / 716 | 70.000 | 7.000 / 0.000 | Y |
| room | 104 | 5400 / 1909 / 641 | 66.156 | 4.999 / 6.102 | Y |
| cap | 12 | 564 / 296 / 172 | — | 0.200 / 0.150 | D |
| mouth | 32 | 2956 / 1109 / 428 | 70.000 | 5.433 / 5.657 | — |
| hall | 156 | 11036 / 3786 / 1222 | 66.156 | 5.210 / 6.372 | H |
| hangar | 48 | 6768 / 2493 / 867 | 70.000 | 5.670 / 9.425 | — |
| tower | 140 | 5178 / 1866 / 613 | 66.156 | 4.996 / 7.391 | Y, K |
| tower_top | 180 | 5004 / 1824 / 624 | 66.156 | 5.445 / 6.644 | Y, K |
| corridor_broken | 76 | 3996 / 1431 / 486 | 64.000 | 7.000 / 5.686 | R |
| room_collapsed | 146 | 5080 / 1889 / 666 | 70.000 | 4.996 / 1.730 | Y |
| dressing_antenna | 94 | 210 / 118 / 84 | — | 4.472 / 0.212 | D |
| dressing_solar_stub | 68 | 252 / 113 / 63 | — | 4.035 / 0.236 | D |
| dressing_radiator | 228 | 472 / 195 / 87 | — | 4.000 / 0.212 | D |
| dressing_tank_cluster | 296 | 936 / 379 / 164 | — | 4.000 / 0.244 | D |

**Kitte izin verilen geometri istisnası:** Review 5 basit tüp/kutu colliderı koruyup 6 m’den az rib/boru çıkıntısı, 6–8 m ağır port çerçevesi ve 8–12 m dış şev istedi. Bu yüzden tablodaki kit ölçümleri katı 0,75 m çift yönlü sınırı sağlamaz; bu tur colliderlar değiştirilmedi. `strict_075m_rule_met` ve gerçek uzaklıklar validation dosyalarında açık. Hazard yalnız ince iç dudakta; tüm LOD’larda ölçülen maksimum 2,901 m’nin altında.

**Y:** yaklaşık Review 5 LOD0 hedefinden sapma; gerçek değer tabloda. Dirsek/T/kavşak 4k civarının biraz üstünde; oda/çökmüş oda/kule/kule tepesi 6k alt sınırının altında. Brief 4’ün sert üst üçgen bütçeleri geçilmedi.

**H:** salonun 140 m gövdesine 20 m port ızgarası için 10 m üst bilezik eklenmiş; toplam collider yüksekliği 150 m. **K:** 80 m kule gövdesi + iki 20 m bilezik; yığma adımı 120 m. **R:** kırık 80 m koridorun 64 m yan giriş kolu, ana rota ile birleşirken içeride 60 m yarıçaplı tam dönüş barındırmaz; yerinde yön değiştirme gerekir. Bunlar önceki teslimden taşınan boyut/rota istisnalarıdır, Review 7’de değiştirilmedi. **D:** katı kapak/ekipmanın iç mekânı yok; ikinci görüntü yakın dış detaydır. Ekipmanda `mount` boş nesnesi kasıtlı ızgara bağlantı çıpasıdır.

**Test montajı:** ağız → koridor → T → oda ve salon → hangar; üç kullanılmayan oda portu kapalı. 9 örnek, 5 ana birleşim, maksimum port merkezi hatası 0.00000000 m, pozitif hacimli collider AABB çakışması 0, render 34.908 üçgen. Salonun kullanılmayan 3/4/5 portları açık. Son tek montaj önizlemesi yeni ışık/kaplamayla güncellendi; `.blend` içinde ayrı sahne.

## Açık sınırlar ve çalışma kaydı

- Sürecin kümülatif tepe RSS değeri **2.425,766 MiB = 2,54359 GB**. Ondalık 2,5 GB sınırı yaklaşık **43,6 MB** aşıldı; 2,5 GiB yorumunda sınır altında. İlk yüksek kayıt Halka işlemi sırasında görüldü. Son kit/montaj RSS’si 1.963,918 MiB. Bu aşım gizlenmedi; validation dosyalarındaki tepe değeri varlık başına bağımsız ölçüm değildir.
- Gangut uzaklık denetiminde bir MCP çağrısı ağaç verisini her köşe için yeniden hesapladığı için uzun sürdü. Hesap tamamlandı; sonraki kontroller tek BVH kullanır. Kısa çağrı koşulu bu tek çağrıda karşılanmadı.
- Halka Harabe küçük boşluk kontrolü 43 tanımlanan cebe, kiriş kalınlığı kontrolü dört tanımlanan kiriş merkezine dayanır; tüm kafesi kapsayan eksiksiz bir minimum özellik boyutu ispatı verilmedi.
- Önizlemeler incelendi: fazla açık kayalık tonu/aydınlatması ve düz yarık duvarları düzeltildi; kitte boş kalan dik yüzeylere pencere sıraları eklendi. Son görüntüler teslimdeki son sürümü gösterir.
- Proje testleri ve git kullanılmadı. Oyun kodu/exporter dosyaları değiştirilmedi; üst kuyu sınıflandırması izin verilen Blender exporter tarifinde ve varlık JSON’unda düzeltildi.

## Collider precision follow-up — Halka Harabe

Only the collider changed. All original GLB binary bytes (including every LOD buffer, material and texture), nodes and gameplay JSON were preserved. Sub-centimetre slivers were widened locally while retaining the original closed topology; every accepted move was checked for intersections. A final 20 mm distance weld and degenerate cleanup leave 8,536 triangles. No corner is within 27.9996 mm of another; minimum triangle altitude is 30.0186 mm, or 26.4411 mm after the importer’s exact int16 rounding (6.37095 mm grid, radius 208.736 m). Quantisation loses zero corners or triangles, leaves zero bad edges and zero nonincident triangle intersections. All prior previews remain unchanged because the render meshes are unchanged. See validation.json for the serialized distance and before/after clearance measurements.

Limit not met: an abandoned global remesh exceeded the decimal 2.5 GB memory cap (observed process peak 3,279.867 MiB). It was discarded; Blender was restarted and the delivered repair uses local edits only. No project tests or git commands were run.

## Reduced queue: Kovuk and Review 9 delivered

Owner stopped further appearance iterations. Kovuk now uses a continuous Nordic scan island at 32m per tile, seven fused planar masses, large fracture bays and 25/32/38m strata steps. Collider/LOD0/1/2: 15744/16093/5647/1952; minimum route 70.2292m, maximum fork LOS 136m. Serialized LOD0→collider / collider→LOD0: 0.5472 / 0.4003m. Navigation unchanged. Principal-axis profiles each contain six recesses; arbitrary directions are not exhaustively proven.

Kayalik 1 and 4 retain their JSON routes and all entrance transforms. New crack shelves, overhangs and lip damage stay outside a 66.8m corridor. Each 2048 atlas retains the old outer 1024 pixels and adds a tone-matched crop from the same licensed Alaskan scan for the walls; the UV densities are 0.4972 and 0.6264 texels/m. Counts collider/LOD0/1/2: 7648/7648/2676/764 and 7600/7600/2660/760. Both are closed single solids without nonincident self-intersections; exact importer quantisation has zero bad edges. Kayalik 4 needed exterior-only reduction of 728 triangles and tiny precision repairs to satisfy the hard budget and remove degenerate faces. No second appearance pass was made.

Enkaz brightness and the remaining Review 3 work are dropped for now by the owner. Brief 3 is now complete below.


## Daraltılmış kuyruk tamamlandı — Brief 3

Kovuk → Kayalık 1 → Kayalık 4 → Yarık Kanyonu → Petek sırası tamamlandı. Her varlık sonrası kaynak `.blend` kaydedildi; GLB yeniden okunarak kapalı collider, öz-kesişim, rota açıklığı, işaretçi yönleri, gömülü dokular ve önizlemeler denetlendi. Yeni iki varlıkta 1 km, 300 m ve iki iç görünüş olmak üzere dörder 1600×1000 PNG var. Görüntüler incelendi; ikinci estetik tur yapılmadı. GLB/JSON/doku/önizleme/kaynak blend hashleri son dosyalarla eşleşiyor. Geçici onarım ve kurulum dosyaları kaldırıldı.

| Varlık | Collider | LOD0 / LOD1 / LOD2 | Min. rota m | P5 m | GLB L0→C / C→L0 m |
|---|---:|---:|---:|---:|---:|
| Kovuk | 15744 | 16093 / 5647 / 1952 | 70.2292 | 77.2989 | 0.5472 / 0.4003 |
| Kayalık 1 | 7648 | 7648 / 2676 / 764 | 66.8000 | — | 0.0760 / 0.0760 |
| Kayalık 4 | 7600 | 7600 / 2660 / 760 | 66.8000 | — | 0.1916 / 0.1916 |
| Yarık Kanyonu | 13988 | 14036 / 4944 / 1446 | 78.5304 | 79.2017 | 0.0451 / 0.0054 |
| Petek | 13142 | 13302 / 4760 / 1474 | 70.1130 | 70.8265 | 0.0451 / 0.0412 |

Tablodaki rota min/P5 değerleri 2 m örnekleme kullanan kaynak geometriden; GLB uzaklıkları seri verinin alan ağırlıklı örneklemesinden. Kayalıklarda önceki doğrulama biçimi yalnız minimumu tutar. Beş collider da tek bağlı kapalı katı: bozuk kenar, winding, sıfır alanlı üçgen ve nonincident öz-kesişim sayısı 0. Beşinde de oyunun int16 nicemleme/kenar denetimi geçti. Yeni varlıklarda collider ile render arasındaki kapatılan boşluk 0 m, konum yok; önceki rota olmadığı için before=null, after yukarıdaki minimumlar. Kayalık JSON’ları ve bütün giriş dönüşümleri birebir korundu; Kovuk’un dokuz rota açıklığı ve işaretçileri korundu.

**Yarık Kanyonu:** altı kaynaşmış, her biri 290×250×280 m nominal kaya; son kütle glTF X/Y/Z sırasıyla 430.22×293.02×752.96 m. Kırık düzlemler, fiziksel tabaka basamakları ve 32 m ölçekli gerçek Nordic tarama PBR’si dışta ve içte. Üç örtülü bölüm 119’ar m; gökyüzüne açık oran %52.4634. Örneklenen duvar tepesi–zemin derinliği 186.688–244.443 m; minimum dönüş yarıçapı 62.067 m. Dört giriş, altı duvar cevher çıpası; ana giriş +Z. Yan döngünün ortası ile ana yarığın karşılık gelen noktası arasında görüş kapalı; grafik döngü sayısı 1. Kaynak: `yarik_kanyonu/yarik_kanyonu.blend`.

**Petek:** 533.61×506.10×501.66 m asimetrik, kraterli kaya. Üç katta dokuz hücre; giriş konileri dışındaki 192 yönlü duvar örneklemesinde hücre çapları 120.511–124.523 m. On beş kıvrımlı geçit; hücreler dışında uzunluklar 77.288–118.475 m, 2 m aralıklı açıklık ölçümleri 70.113–72.026 m. En küçük dönüş yarıçapı 62.133 m. Grafik döngü sayısı 7; hücre dereceleri 3–4. 36 hücre çiftinde iki yönlü 72 görüş ışını: görünür çift 0. Beş ağız (yukarı/aşağı dahil), ana ağız +Z; tam iki cevher çıpası. Hücre başına iki, toplam 18 dışarı açık ışık çatlağı; tasarım çapı 4.3 m, eksenlerin tamamı dış uzaya açık. Kaynak: `petek/petek.blend`.

**Karşılanmayan kurallar ve ölçüm sınırları:** yeni iki varlıkta ölçülen sayısal kural ihlali yok. Kovuk’ta altı ana yöndeki profillerde en az altı derin girinti var; Review 4’ün her olası yönden en az üç girinti koşulu için eksiksiz ispat verilmedi. İki kayalıkta doku yoğunluğu dış yüzeyle eşlendiği için yakın duvar görüntüsü yumuşak kalıyor; ikinci estetik tur yapılmadı. Uzaklıklar tüm yüzey için matematiksel ispat değil, 50.000 alan örneği/yön ve köşe denetimidir. Önizlemelerde sekme ışığını temsil eden nokta ışıkları GLB’ye girmez; gerçek açıklıklar ve emissive yüzeyler girer.

Bu daraltılmış kuyrukta Blender süreç tepe belleği `/proc/self/status` VmHWM ölçümüyle 1,978,168 KiB = **2.02564 GB**, son RSS yaklaşık 1.563 GB; 2.5 GB altında. Önceki, terk edilmiş Halka remesh denemesinin 3,279.867 MiB aşımı yukarıda kayıtlıdır. Proje testleri ve git çalıştırılmadı; düşürülen Enkaz ve Review 3 işlerine dokunulmadı.
