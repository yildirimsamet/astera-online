# Oyuncu davranışı araştırması ve ajanla oyuncu testi

**Tarih:** 2026-11-05. **Amaç:** Ajanla yapılan oyuncu testlerini gerçek oyuncu deneyimine yaklaştırmak.
Konular önem sırasındadır: en üstteki konu yanlışsa alttakilerin de değeri kalmaz.

**Kanıt düzeyleri**

- **Güçlü:** Hakemli çalışma veya büyük veriyle yapılmış ölçüm.
- **Orta:** Tanınmış kurumun araştırması veya sektör analizi; örneklem sınırlı ya da yayında ayrıntı eksik.
- **Zayıf:** Geliştirici yazısı, forum veya kaynak göstermeyen rehber.
- **Çıkarım:** Kaynaklardan bizim yaptığımız yorum. Kaynak bunu söylemiyor.

## Kendi verimiz (prod, 2026-11-05, yalnız okuma, toplu sayılar)

Analitik penceresi yaklaşık 3 gün: 2026-11-02 18:15 – 2026-11-05 18:05 UTC. Başlangıç galaksisi prod'da değil; aşağıdaki öğretici eski `training` akışıdır.

| Ölçüm | Sonuç | Dikkat |
| --- | --- | --- |
| Hesap ülkesi (botsuz) | TR 1568, ES 149, JP 42, DE 20 | `country_code` varsayılanı `TR`; TR sayısı şişkin olabilir |
| Ziyaretçi dili | tr 2710, en 217, es 97, ja 71 | Tarayıcı dili; daha güvenilir |
| Platform | web 3100, bilinmeyen 93 | Analitikte web olarak görünüyor; telefon oranı bu alandan çıkmıyor |
| Kampanya | video_music_edit 1293 ziyaretçi → 58 hesap; doğrudan 1857 → 873 | Doğrudan grup mevcut oyuncuları içerir |
| Ziyaret saati (TR) | 22–23 tepe (658), 21 (128), 00 (115) | Kampanya saati etkilemiş olabilir |
| Karşılama → oyna | 675 karşılama ekranı → 102 oyna tıklaması | Aynı pencere; yeni hesap 43 |
| Öğretici | 192 welcome → 84 resources → 55 collect → 38 core → 27 → 22 → 16 → 10; 193 başlayan, **4 bitiren** | En büyük kayıp ilk geçişte (%56) |
| Wiki | 727 galaksi görenden **7'si** Wiki açtı (yaklaşık %1) | Sahibin gözlemini doğruluyor |
| Bloklayıcı | yetersiz kaynak 90, gereksinim 84 ziyaretçi | |
| Komut | toplama 596, madencilik 195, sonda 97, saldırı 35, baskın 30 ziyaretçi | Saldırı, toplamanın yaklaşık %6'sı |
| Hata | yakalanmamış söz 43, WebGL kaybı 31, yakalanmamış hata 21, React 11 | Olay sayısı |

**Ölçülemeyen:** Gerçek D1/D7. Analitik yalnız birkaç gün saklanıyor. 14–90 günlük 1651 botsuz hesabın 47'sinin bugünkü sezonda oyuncu kaydı var; bu tutunma oranı değil, sezon sıfırlaması da etkiliyor. D1/D7 için analitiğin daha uzun saklanması veya günlük özet gerekir.

**Bizim için anlamı (çıkarım)**

- Kitle ağırlıklı Türkçe. Testler önce Türkçe yapılmalı; İspanyolca ve Japonca grupları görülür büyüklükte.
- Metinle ilerleyen öğreticide oyuncuların yarısından fazlası ilk geçişte gidiyor. Bu, "oyuncu okumuyor" tezine bizim verimizden gelen en güçlü destek. Nedeni kesin değil.
- Saldırı oyunun bahsi olduğu halde az kullanılıyor. Kitlenin yeni olması, saldırının gizli olması veya korku olabilir; bu veri ayırt etmiyor.
- Başlangıç galaksisi yayınlanınca aynı huni yeniden ölçülmeli.

## 1. Ajan testi neyi söyleyebilir, neyi söyleyemez?

**Bulgular**

- **Orta:** Yüzeysellik ve aşırı olumluluk: NN/g, sentetik kullanıcıları gerçek çalışmalarıyla karşılaştırdı. Yanıtlar çoğu zaman yüzeysel ve fazla olumluydu; "her şeyi önemsiyorlar" diyor. Davranış verisi üretemeyeceklerini, yalnız hipotez ve masa başı araştırma için uygun olduklarını, son karar için uygun olmadıklarını söylüyor. Bulgular gerçek kullanıcı bulgusu gibi sunulmamalı. ([NN/g](https://www.nngroup.com/articles/synthetic-users/))
- **Orta:** Fazla başarı: NN/g'nin aktardığına göre ChatGPT, gezinme testinde çoğu gerçek kullanıcıdan çok daha başarılıydı; bu yüzden gerçek kullanıcının yerini tutamadı. ([NN/g](https://www.nngroup.com/articles/synthetic-users/))
- **Orta:** Çok ajanla kapsam: Metin tabanlı bir oyun prototipinde 240 ajan, insan bulgularının yaklaşık %90'ını yakaladı ve orada doydu. Yerel 10 oyuncunun düzeyi için yaklaşık 128, 20 çevrimiçi oyuncunun düzeyi için yaklaşık 64 ajan gerekti. Uzmanların verdiği gerçeklik puanı ajanlarda ortalama yaklaşık 3,0, yerel insanlarda yaklaşık 4,1 (5 üzerinden; ortalamalar raporlardan hesaplandı). Yazarlar bunun genel bir kural olmadığını, geç tasarım aşamalarında insanların daha iyi olabileceğini belirtiyor. ([arXiv 2505.22981](https://arxiv.org/html/2505.22981v2))
- **Orta:** Persona kayması: Ajanın verilen personadan kayması bilinen bir sorun. Bir oyun çalışması, personayla çelişen koşuları atıp yeniden üretmiş. Başka bir çalışmada ajanın personayla ilgili söylediği inanç ile yaptığı eylem her zaman uyuşmadı. ([arXiv 2503.15514](https://arxiv.org/pdf/2503.15514))

**Bizim için anlamı (çıkarım)**

1. **Sinyal tek yönlü güçlüdür.** Ajan her yazıyı okur, sabırlıdır ve fazla başarılıdır. Ajan bile takılıyorsa gerçek oyuncunun takılma olasılığı yüksektir. Ajan geçiyorsa bu "anlaşılıyor" demek değildir.
2. **Fikrini değil davranışını say.** "Geri gelir miydim?" yanıtı zayıf kanıttır. Dokunuş sayısı, çıkmaz sokak ve bırakma noktası daha değerlidir. Bizim ajanımız görüşme yapmıyor, gerçek oyunu oynuyor; NN/g'nin eleştirdiği çalışmalardan farkı budur.
3. **Az ajanla kapsam iddia edilmez.** 4–8 koşu hipotez üretir, "bütün sorunları bulduk" dedirtmez.
4. **Persona kayması denetlenir.** Komut geçmişi ve notlar personayla karşılaştırılır; uymayan koşu atılır.
5. **Etiket kalıcıdır.** Her raporda "ajan bulgusu, gerçek oyuncuyla doğrulanmadı" yazar.

## 2. İlk oturum ve erken kayıp

**Bulgular**

- **Orta:** Büyük kayıp: Top Eleven üzerine, 2 milyon oyuncuyla yapılan çalışmanın özetine göre yeni oyuncuların %70'ten fazlası oyunu yalnız bir gün oynuyor. Ayrıntılı sayılar özette yok; veri 2015'ten ve tek oyundan. ([Tampere PlayLab](https://blogs.tuni.fi/playlab/game-research-highlights/churn-prediction-in-mobile-free-to-play-games/))
- **Orta:** İki farklı açılış: Rise of Kingdoms'ta oyuncunun ikinci eylemi yakındaki barbarlara asker göndermek. Whiteout Survival ise ilk 90 dakikada haritayı hiç göstermiyor; 4X dünyası yaklaşık dördüncü oturumda açılıyor. Analiz, bunun buna rağmen sıradan oyuncuların çoğunu tutamadığını da söylüyor. ([Naavik](https://naavik.co/deep-dives/four-x-evolution-2/))
- **Zayıf:** Sektör rehberlerine göre ilk oturumu teknik sorunlar, kafa karıştıran öğretici ve ani zorluk bitiriyor. Strateji oyunlarında D1'i asıl karmaşıklık belirliyor. Akış, tek ortalama yerine adım adım ölçülmeli. ([Roblox](https://create.roblox.com/docs/production/analytics/retention), [Playio](https://blog.playio.co/mobile-game-onboarding-retention), [AppFollow](https://appfollow.io/blog/mobile-game-retention))

**Bizim için anlamı (çıkarım)**

- Ajan testinde **"ilk anlamlı eylem"e kaç dokunuş ve kaç dakikada ulaşıldığı** ölçülmeli.
- İki kabul edilebilir yol var: saldırıyı erken öğretmek veya bilinçli olarak geciktirip bunu söylemek. **Kötü olan, oyuncunun saldırının nerede olduğunu arayıp bulamamasıdır.** Codex 39. oyun saatine geldiğinde hâlâ bu durumdaydı; bu bulgu rapor bitince yeniden değerlendirilmeli.

## 3. Oyuncular okumuyor: anlatmak yerine yaptırmak

**Bulgular**

- **Zayıf:** Metin ağırlıklı öğreticilerde oyuncular yazıları okumadan hızla dokunup geçiyor. Bu bir geliştiricinin kendi deneyimi. ([Game Developer](https://www.gamedeveloper.com/business/no-one-reads-text-in-a-tutorial))
- **Orta:** UX uzmanı Celia Hodent, metin blokları yerine oyun içi işaret ve geri bildirimi öneriyor; bir mekaniğin öğreticiden dakikalar sonra unutulabildiğini anlatıyor. Bunlar kitabın ve konuşmanın özetlerinden; aslını okumadık. ([GDC 2016 özeti](https://classcentral.com/classroom/youtube-the-gamer-s-brain-part-2-ux-of-onboarding-and-player-engagement-158058/642ff5042be47), [Creative Bloq](https://www.creativebloq.com/features/how-neuroscience-and-ux-impacts-video-game-design))
- **Kaynak bulunamadı:** Öğreticilerin etkisini oyun içinde ölçen hakemli çalışma bu turda çıkmadı. Sıkça alıntılanan "kullanıcılar metnin %20–28'ini okur" sayısı web için ve kaynağından doğrulanamadı; kullanılmamalı.

**Sahibin gözlemi:** Gerçek oyuncular Wiki'ye bakmıyor. Bu kendi başına kanıt değil ama bizim oyuncumuz hakkında en doğrudan bilgi.

**Bizim için anlamı (çıkarım)**

- Personalara **okuma kısıtı** konur: uzun metinde yalnız ilk cümle, Wiki yok.
- Denetçinin ana sorusu: "Bu kural, kararın verildiği ekranda, dokunarak öğreniliyor mu?" Bu, `CLAUDE.md`'deki Decision support ilkesiyle aynı.

## 4. Erken saldırı, çevrimdışı kayıp ve yeni oyuncu koruması

**Bulgular**

- **Zayıf:** Travian'da koruma bitince büyük hesapların yeni oyuncuyu sürekli soyması oyuncu şikâyeti olarak görülüyor. Topluluk daha uzun koruma veya yeni oyuncu sunucuları istiyor. ([Travian desteği](https://support.travian.com/support/solutions/articles/7000060689), [r/travian](https://reddit.sudovanilla.org/r/travian/hot))
- **Zayıf:** OGame rehberleri, gece kayıplarının yeni oyuncu için yaygın bir şok olduğunu ve filo saklamanın oyunun merkezinde olduğunu anlatıyor. ([Gameforge](https://gameforge.com/en-GB/games/ogame-beginner-guide.html), [OGame Wiki](https://ogame.fandom.com/wiki/Fleetsaving))
- **Kaynak bulunamadı:** Yeni oyuncu korumasının kayıp oranına etkisini ölçen veri çıkmadı. Travian'ın kendi blogu sertifika hatası yüzünden açılmadı. OGame'i neden bıraktıklarını anlatan birinci elden kaynak da çıkmadı.

**Bizim için anlamı (çıkarım)**

- "Korsan veya başka oyuncu ne zaman gelir, ne kaybederim, neyi kurtarabilirim?" **ilk saldırıdan önce** anlaşılmalı.
- Yapay oyuncu kaybı hissetmez. Bu konuda ölçülecek şey, kaybın nedenini ve sonraki adımı **doğru söyleyip söyleyemediğidir**. "Hayal kırıklığına uğradım" cümlesi kanıt değildir.

## 5. Oyuncu motivasyonu

**Bulgular**

- **Güçlü:** Dört çalışmaya dayanan makalede oyundaki özerklik ve yeterlik hissi, keyif ve oyunu tercih etmeyle ilişkili. Çok oyunculu çalışma ayrıca aidiyet ihtiyacını da ele alıyor; bu bölüm için özetler çelişkili, makalenin kendisi okunmalı. Bu, süreyi doğrudan öngören bir ölçüm değil. ([Ryan, Rigby, Przybylski 2006](https://acuresearchbank.acu.edu.au/item/8q128/the-motivational-pull-of-video-games-a-self-determination-theory-approach))
- **Orta:** Quantic Foundry 12 motivasyon tanımlıyor (Rekabet, Strateji, Keşif, Güç vb.). Yaş, motivasyonu cinsiyetten yaklaşık iki kat daha fazla açıklıyor. Bir yazının başlığına göre 4X'te genç ve erkek oyuncular askerî zaferi tercih ediyor; verinin kendisini görmedik. Örneklem kendi gelen, ağırlıklı erkek bir kitle. ([Quantic Foundry](https://quanticfoundry.com/), [2016 sunumu](https://quanticfoundry.com/wp-content/uploads/2016/04/Quantic-Foundry-2016-ECGC-Gaming-Motivation-Talk.pdf))

**Bizim için anlamı (çıkarım)**

Personalar demografiyle değil **motivasyonla** kurulur:

| Persona | Ana motivasyon | Tipik soru | Bırakma nedeni |
| --- | --- | --- | --- |
| Reklamdan gelen sıradan oyuncu | Keyif, görsellik | "Şimdi neye basacağım?" | İlk dakikalarda ödül yok, yazı çok |
| Eski OGame oyuncusu | Strateji, verim | "En iyi hamle hangisi?" | Sayıların nedeni açıklanmıyor |
| Rekabetçi oyuncu | Rekabet, güç | "Kime vurabilirim?" | Saldırı geç veya gizli, sonuç anlamsız |
| Meraklı kaşif | Keşif, merak | "Orada ne var?" | Dokunulan yerden tepki gelmiyor |

## 6. Hedef kitle ve pazar

**Bulgular**

- **Orta:** Adjust'ın 2025 ilk yarı verisinde Türkiye'de tutunma düşük: D1 %19 (dünya %26), D7 %5 (dünya %12), D30 %1 (dünya %5). Bu bütün oyunların ortalaması. Strateji, oturum süresi en uzun tür (30,5 dakika). ([GameDev Reports](https://gamedevreports.substack.com/p/adjust-the-mobile-market-of-turkiye))
- **Orta:** Türkiye'de mobil oyuncuların cinsiyet dağılımı yaklaşık eşit, %72'si her gün oynuyor; başlıca nedenler keyif (%65) ve rahatlama (%59). Veri 2023'ten ve bütün mobil oyunlar için, strateji için değil. ([PocketGamer.biz](https://www.pocketgamer.biz/81-of-adults-in-trkiye-play-mobile-games))
- **Orta:** Naavik'e göre strateji oyuncuları mobilde en çekirdek ama artık bulunması zor kitle. Bu yüzden yeni oyunlar daha geniş kitleye gidiyor ve 4X'i sonradan açıyor. Yardımlaşma, oyuncuların birlikte oynama hissini en çok kuran özellik olarak anlatılıyor. ([Naavik](https://naavik.co/deep-dives/four-x-evolution-2/))
- **Kaynak bulunamadı:** Türkiye'de strateji oyuncularının yaş, cinsiyet ve harcama kırılımı. Gaming in Türkiye raporunun tam metni okunmadı. ([Rapor](https://www.gaminginturkey.com/en/turkiye-game-market-report-2025/))

**Bizim için anlamı (çıkarım)**

- **Bizim gerçek kitlemizi bu kaynaklar söylemiyor.** İlk ölçüm yukarıdaki "Kendi verimiz" bölümünde; yaş, cinsiyet ve cihaz kırılımı yok.
- Oyun ilk günlerde tek başına oynanabilir olmalı ama yardımlaşma ve görünür başka oyuncular erken hissedilmeli. Boş sohbet bu açıdan risk.

## 7. Merak, belirsizlik ve geri dönme

**Bulgular**

- **Orta:** Loewenstein'a göre merak bilgi boşluğunu doldurma isteğidir. Boşluk çok küçükse ilgisizlik, çok büyükse kopma doğurur. ([Frontiers 2024](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1374649/full), [Tang ve Kirman 2024](https://eprints.whiterose.ac.uk/210197/1/Exploring_Curiosity_in_Games_A_Framework_and_Questionnaire_Study_of_Player_Perspectives.pdf))
- **Orta:** Anket çalışmasında oyuncular sosyal etkileşim, stratejik zorluk ve belirsizlik ile ödül beklentisi arasında denge tercih ediyor. Bu tercih bildirimi, davranış ölçümü değil. ([Tang ve Kirman 2024](https://eprints.whiterose.ac.uk/210197/1/Exploring_Curiosity_in_Games_A_Framework_and_Questionnaire_Study_of_Player_Perspectives.pdf))
- **Orta:** Top Eleven özetine göre oyun verisiyle kişiselleştirilmiş bildirim, tutunmayı "önemli ölçüde" artırdı. Sayı verilmiyor; asıl makale okunmalı. ([Tampere PlayLab](https://blogs.tuni.fi/playlab/game-research-highlights/churn-prediction-in-mobile-free-to-play-games/))

**Bizim için anlamı (çıkarım)**

Bu, oyunun "Ne oldu acaba?" hedefiyle ve "girdileri ver, cevabı verme" ilkesiyle uyumlu. Denetçi her dönüş ekranında şunu sorar: "Oyuncu gittiğinde aklında açık bir soru kaldı mı, dönünce cevabını görüp yeni bir soru edindi mi?"

## 8. Değerlendirme yöntemleri

**Bulgular**

- **Orta:** PLAY sezgiselleri oyunu dört alanda inceliyor: oynanış, kullanılabilirlik, mekanikler ve hikâye. ([PLAY/HEP](https://hci.rwth-aachen.de/materials/conferences/CHI2004/2p1509.pdf), [DiGRA](https://dl.digra.org/index.php/dl/article/view/712))
- **Orta:** Sesli düşünme, oyuncunun oynarken düşüncelerini söylemesidir; bizim notlarımız buna en yakın yöntem. ([UCSC GUR](https://gur.ucsc.edu/testing-methods))
- **Orta:** RITE'ta bulunan sorun hemen düzeltilir, düzeltme bir sonraki oturumda sınanır. ([RITE](https://en.wikipedia.org/wiki/RITE_Method)) Age of Empires vaka sayılarını doğrulayamadık.

**Bizim için anlamı (çıkarım)**

Oyuncu ve denetçi ayrı ajanlardır. Oyuncu kontrol listesini görmez; denetçi kontrol listesini izlere uygular. Düzeltmelerden sonra aynı persona yeniden oynar, yani RITE döngüsü kurulur.

## Kitin taslağı

1. **Oyuncu koşusu:** Bir persona seçilir. Sürücü ve okuma kısıtıyla oynar, Wiki kapalıdır. Çıktısı komut günlüğü, ekran görüntüleri ve notlardır.
2. **Kural denetimi:** Komut geçmişi yasaklara ve personaya uygun mu? Uymayan koşu sayılmaz.
3. **Uzman denetçi:** Oynamaz. İzleri okur, beş tasarım ilkesi ve bu belgedeki sorularla puanlar.
4. **Bulgu biçimi:** Ekran, beklenen, olan, ilke, kanıt düzeyi, kaç personada görüldüğü ve gerçek veriyle karşılaştırma.
5. **Doğrulama:** Bulgular gerçek oyuncu verisi ve sohbetlerle karşılaştırılır. Yalnız ajanda görülen bulgular hipotez olarak kalır.
6. **Yeniden oynama:** Düzeltmeden sonra aynı persona aynı yolu oynar.

**Ölçülecek davranışlar:** İlk anlamlı eyleme kadar dokunuş sayısı, sonuçsuz dokunuş, çıkmaz sokak, geri dönüş sayısı, yanlış tahminler, bırakma noktası ve kuralın karar öncesinde mi sonrasında mı öğrenildiği.

## Açık kalanlar

- Gerçek D1/D7, yaş, cinsiyet ve cihaz kırılımı (ilk ölçümde çıkmadı).
- Asıl metni okunmayanlar: Milošević ve diğerleri (Top Eleven), Medlock ve diğerleri (RITE), Ryan ve diğerleri, Hodent, Gaming in Türkiye raporu.
- Bulunamayanlar: yeni oyuncu korumasının etkisi, OGame'i bırakma nedenleri, oyun içi öğretici etkisini ölçen hakemli çalışma.
