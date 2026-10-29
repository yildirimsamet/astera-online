# Honor görünürlük ve ekonomik etkiler — 16 Ekim 2026

Kullanıcının onayladığı yön: galakside güncel ilk üç Honor'dan; chat kupası ve mesaj kenarlığı önceki sezonun Honor ilk üçünden seçilir. Pozitif Honor iki kademeli %5/%10 tamir indirimi, negatif Honor %5/%10 tamir ek maliyeti sağlar. Konvoy ödülleri pozitif/negatif iki kademeyle değişir; trade sıfır/pozitifte komisyonsuz, negatifte iki kademeli komisyonludur.

## Görsel uygulama ve mevcut sözleşme

- Aktif Honor galaksisinde kürsü zaten Honor'dan seçiliyor. Pozitif puan gerekir; eşitlikler 1,1,3 şeklindedir. Honor kürsüsünde olmayan Hakimiyet lideri Honor rozeti alamaz.
- Chat önceki donmuş sezonun Honor derecesini zaten okuyabiliyor. Eski Honor'suz sezonların kazanılmış kupaları Hakimiyet kaydı olarak korunur; geçmiş sıralama yeniden hesaplanmaz.
- Chat kupasının yanında Honor simgesi ve mobilde açık kaynak açıklaması eklendi. Metal kenarlık aynı gerçek dereceyi kullanıyor.
- Genel/klan/DM post ve tarihçe cevaplarında derecenin kaynağı sözleşme testiyle doğrulandı. Sıfır puana, operatörlere ve SHADOW sonuçlarına kazanılmış Honor rozeti verilmez; botlar 2026-10-29'dan beri sıralama derecesine göre herkes gibi rozet alır (bkz. `docs/decisions.md` 2026-10-29).

## Kabul edilen ekonomik oranlar — henüz etkin değil

| Kademe | Tamir kaynak maliyeti | Konvoy kaynak ödülü | Trade komisyonu |
|---|---:|---:|---:|
| Pozitif II | −%10 | +%30 | %0 |
| Pozitif I | −%5 | +%15 | %0 |
| Nötr | değişmez | değişmez | %0 |
| Negatif I | +%5 | −%15 | %7 |
| Negatif II | +%10 | −%30 | %14 |

Kullanıcı konvoy ±%15/±%30 ve trade %7/%14 oranlarını seçti. Veriden önerilen +25/+75 ve −25/−100 eşiklerini de “Eşikleri onaylıyorum” diyerek onayladı. Sıfır nötrdür. Sıralama yüzdesi kullanılmaz. Kod ve testlerde entegrasyon uygulandı; canlıya açılış yapılmadı.

## Uygulanan sözleşmeler

Kullanıcının ek UI talebi: tüm avantaj/dezavantajların tek bölümde açıklanması; konvoy gönderiminde Honor nedeniyle alınacak ek/eksik kaynağın ve net toplamın yeşil/kırmızı, trade gönderiminde komisyon oranının aynı şekilde gösterilmesi. Bu yalnız yardım metninde kalmayacak. Tamir teklifinde de gerçek fiyat etkisi gösterilecek. Renk yanında işaret, açıklama ve sayı bulunacak. UI-v2 tasarım diliyle 350 px telefon üzerinde doğrulanacak; etkin olmayan politikadan gerçek avantaj varmış gibi bahsedilmeyecek.

- Tamir indirimi/ek maliyeti yalnız kaynak fiyatına uygulanır, süreye değil. Sipariş ödeme anında donar; iptal iadesi gerçekten ödenenden hesaplanır. Sonraki Honor değişimi eski siparişi yeniden fiyatlamaz. Teklif ve ödeme farklıysa yeni fiyat kullanıcıya gösterilmeden yüksek fiyat alınmaz.
- Konvoyda önerilen etki yalnız kaynak ödülüne uygulanır; gemi şansı veya gemi tier'ı büyütülmez. Etki gönderimde donar, gerçek savaşabilen filo ve mevcut kargo tavanı korunur. Pozitif ödül kargoyu aşamaz; negatif kesinti retry, yeniden hesaplama veya dönüşte ikinci kez uygulanamaz. Radyasyonla kaybedilen taşıma alanı yine ödülü sınırlar.
- Trade komisyonu mevcut sabit kurdan ayrı ve tek kez alınır. Verilen kaynak, komisyon ve net alınan kaynak gönderimden önce birlikte gösterilir. Gönderimde fiyat donar; geri çağrılan ve takas gerçekleşmemiş seferden komisyon alınmaz. Tam sayı yuvarlaması küçük işlemlere bölerek komisyonu yok edememelidir.
- Honor kapalı/SHADOW sezon, eski uçuş ve eski siparişler mevcut fiyatlarını korur. İstemci oran veya kademe göndererek fiyat seçemez. Silent Space ve sezon geçişi puanı/ücreti yanlış yarıştan okumamalıdır.
- Eksi Honor yalnız zorbalık değildir: denk rakibe başarısız saldırı da azaltabilir. Kullanıcı ekonomik negatif etkileri açıkça istedi; erişilebilir toparlanma ve nötr aralık değerlendirilmelidir.
- Önceki prod savaşlarından kesin tarihsel Honor çıkarılamadığı kaydedilmişti. Eski varsayımsal senaryo dağılımı gerçek güncel Honor dağılımı diye sunulmayacak. Eşik için kullanılacak verinin sürümü/kapsamı açıkça belirtilecek.

Kod değişiminden önce RED testleri, sonra GREEN; gerçek mobil görünüm ve sınır/tekrar kontrolleri gerekir. Production'a işlem yapılmaz; oynanabilir local sezonun verisi sıfırlanmaz ve ekonomik programı açılmaz.

## UI uygulama düzeni

1. Leaderboard Honor sekmesinde, kişisel Honor okumasının altında “Honor avantajları” bölümü. Kapalı görünüm mevcut kademeyi ve üç kişisel etkiyi gösterir: tamir, konvoy, ticaret. “Tüm kademeler” açılımı beş kademeyi ve sabit eşiklerini karşılaştırır. Hakimiyet ekranı Honor'a ait avantajı kendisininmiş gibi göstermez.
2. Konvoy seçiminde mevcut kaynak tablosu korunur; taahhüt öncesinde kaynaklar baz/“Honor avantajı +%15” veya “Honor kesintisi −%15”/net biçiminde okunur. Gerçek ek/eksik tutar kaynak bazında gösterilir. Bonus kargo sınırına takılırsa kazanılmayan miktar vaat edilmez. Gemi şansı ve tier'ı ayrı satırda kalır.
3. Trade gönderiminde tekliften sonra komisyon oranı, kesilen miktar ve eve dönecek net kaynak aynı bölümde gösterilir. Pozitif Honor için yeşil “Honor avantajı: %0 komisyon”; nötrde “%0 komisyon” olağan bilgi; negatifte kırmızı “Honor komisyonu: %7/%14”. Mevcut kur yuvarlaması ile komisyon birbirine karıştırılmaz.
4. Tamir seçiminde baz kaynak bedeli, Honor indirimi/ek maliyeti ve gerçekten ödenecek toplam footer'da görülür. Tamir süresi ayrı ve değişmeden kalır. İptal iadesi indirim öncesi bedelden hesaplanmaz.
5. Honor puanı seçim sırasında değişirse eski fiyatı sessizce uygulamak yerine teklif yenilenir ve fark gösterilir. Tamir/konvoy/trade görünümü özel Honor güncellemesinde de yenilenmelidir; yalnız savaş raporu invalidation'ı ekonomik entegrasyon için yeterli değildir.
6. Yeşil ve kırmızı UI-v2 token'ları, ana Honor simgesi, rakamlar için mono font; etki adı ve +/− işaretleri anlamı renkten bağımsız taşır. 350/1280 px, tüm diller, nötr/iki pozitif/iki negatif, kargo tavanı, küçük tam sayı, stale teklif ve mevcut sipariş/uçuş değişmezliği doğrulanır.

Ekonomik UI ve backend entegrasyonu onaylanan eşiklerle uygulandı. Mevcut sezonlar açık operasyonel etkinleştirme olmadan ekonomik programa geçmez; schema eklemek tek başına gerçek fiyatları değiştirmez. Son kod incelemesi ve **204 görünümün** doğrulaması [CR kaydında](honor-cr-2026-10-16.md).

## Veriden eşik önerisi

Öneri: pozitif +25/+75; negatif −25/−100. Aradaki açık aralık nötrdür; eşik değeri ilgili kademeye dahildir. +75 ikinci avantaj, −100 ikinci yaptırımdır. Negatif küçük yenilgiler yüzünden anında başlamaz.

12 Ekim'de local'e alınan snapshot'taki 488 uygun bireysel savaş, tarihsel fiyat kataloğuyla güncel v4 defterinde, galaksiler ayrılarak üç açık varsayım altında tekrar hesaplandı. 456 kayıtta tam kaynak türleriyle gerçek ganimet var; 32 anıt kaydında eksik ganimet sıfır kabul edildi. Bu, uzun ekonomi/sezon simülasyonu değildir. Tarihsel Navy/tier/ilişki eksikleri nedeniyle kesin eski Honor sıralaması veya gerçek kademe erişim oranı değildir. 153 gözlemlenmiş oyuncu-sezon vardır; hiç savaşa katılmamış nüfus dahil değildir.

| Varsayım | Pozitif saldırının ortanca Honor getirisi | Negatif saldırının ortanca kesintisi | +25/+75 kademesindeki oyuncu-sezon | −25/−100 kademesindeki oyuncu-sezon |
|---|---:|---:|---:|---:|
| Her hedef denk | 6,24 | 0,28 | 8 / 8 | 0 / 0 |
| Her hedef üst | 7,61 | 0,29 | 5 / 7 | 0 / 0 |
| Her hedef zayıf | 0 (pozitif saldırı yok) | 0,92 | 8 / 3 (savunma başarısı) | 3 / 5 |

Kademedeki sayılar birbirinden ayrı gruplardır; örneğin +25/+75 için ilk sayı 25≤H<75, ikincisi H≥75. Zayıf hedef varsayımındaki pozitifler saldırgana verilmez; diğer savaşlarda kendi savunma başarısı nedeniyle toplamı pozitif kalan aktörlerdir. Eşit kıyas için +50/+150 alternatifi de hesaplandı: denk varsayımında yalnız 3/6 oyuncu-sezon avantaj kademesine erişti. Daha erişilebilir ilk eşik bu nedenle +25 önerildi. Tek bir büyük savaş eşik aşabilir; “mutlaka N savaş gerekir” kuralı yoktur.

Ekonomik etkileri etkinleştirmeden bu somut eşikler kullanıcıya soruldu ve onaylandı. Ham oyuncu kimlikleri yayımlanmadı; aggregate çıktı `.dev/honor-benefits-20261016/threshold-results.json`. Replay analizi üç testle çift tavanı, galaksilerin ayrılığı, tam eşik ve boş örnek üzerinden doğrulandı.

## Uygulama ve kritik uyumluluk kontrolleri

- Ekonomik program v1 ayrı, nullable `honor_seasons.benefits_version` alanıyla açılır. SHADOW ve eski sezonlar otomatik etkinleşmez. `season honor-benefits --season UUID` yalnız preview; `--yes` bir açık ACTIVE Honor sezonunda etkinleştirir. İşlem puanı ve geçmişi değiştirmez. Açılmış program gerçek sonraki sezona taşınır; SHADOW/WAITING bunu başlatmaz.
- Tamir araştırması (INDUSTRIAL) önce mevcut kaynak ve süre hesabını üretir. Honor yalnız o kaynak bedeline çarpan uygular, son kaynak miktarı yukarı tam birime yuvarlanır. Araştırma seviyesi 0/2/4 ile gerçek ödeme, değişmeyen süre, idempotent retry, daha sonra negatif puana geçiş ve gerçek ödenen bedelin yarısı üzerinden iptal test edildi.
- Konvoyun gönderimdeki Honor kaynak çarpanı uçuşa kaydedilir. Negatif oran tavanlı gerçek baz ödüle uygulanır. Pozitif oran baz ödülü korur; yalnız bonus kalan kargoya tek kesin oranla sığdırılır. Böylece tam sayı yuvarlaması bir avantajı kaynak kaybına dönüştüremez ve daha iyi Honor hiçbir kaynak türünü azaltamaz. Dolu kargo negatif kesintiyi gizleyemez; tam dolu pozitifte taşınamayacak bonus vaat edilmez. HP sezonlarında gerçek sağ kalan savaşabilir filo için yeniden hesaplanan baz ödüle donmuş çarpan yalnız bir kez uygulanır.
- Ticarette net alınacak kaynak gönderimde hesaplanır; %7/%14 komisyon ayrı snapshot olarak kaydedilir. Gidişte kaynak kaybı ve dönüşte kargo kaybı mevcut fiziksel sınırları korur. Geri çağrılmadan gerçekleşen takasın neti sonradan değişen Honor'la yeniden kesilmez. Sıfır net öneri ödeme öncesi reddedilir. Tam birim yuvarlaması küçük işlemlerde nominal orandan daha yüksek kesinti yaratabileceği için karar ekranında bu açıkça belirtilir.
- Fiyat teklifi `expectedHonorTier` taşır; sunucu bunu bağımsız güncel Honor'la karşılaştırır. Uyuşmazlıkta ödeme/gönderim yapılmaz. Kapalı programda eski client alanı zorunlu değildir; açık programda alanı olmayan eski client yeni fiyatı görmeden işlem yapamaz.
- Ticarette mevcut brüt takas için gereken kargo alanı korunur. Komisyon sonrası net kaynak ayrı gösterilir; brüt dönüş kapasitesi yanlışlıkla net dönüş diye etiketlenmez. Tam kaynak türü üzerinden aşağı yuvarlanan net tutar işlem bölünerek artırılamaz.
- Botların tamir yolu da aynı teklif kademesini taşır ve Honor sonrası bedeli ödeyebileceğini kontrol eder. Program açılınca bot tamirlerinin kilitlenmesi RED testle yakalanıp düzeltildi.
- Bir MAIN galaksisi henüz ekonomik programı açmamışken diğerinde v1 açılması geçersiz sürüm çatışması sayılmaz. Aynı dönemde gerçekten ilan edilmiş tek desteklenen ekonomik program yeni sezona taşınır; açılmamış galaksi eski döneminde geriye dönük değiştirilmez. Çoklu galaksi regresyonu RED→GREEN doğrulandı.
- Migration `0174_shiny_hemingway.sql` yalnız üç additive alan üretir; eski uçuşlar 0 çarpanla korunur. Test komutları yalnız disposable test DB'ye yönlendirildi. Çalışan yerel geliştirme sunucusunda otomatik migration sonrası aynı alanların bulunduğu salt okunur kontrolle doğrulandı; yerelde hiçbir Honor ekonomik programı açık değil. Oynanabilir sezon sıfırlanmadı. Production'a işlem yapılmadı.

## Açılış sırası

1. Additive migration ve yeni sunucu/istemci birlikte dağıtılır; `benefits_version` boş kaldığı sürece gerçek işlem fiyatları değişmez.
2. Honor yarışı ACTIVE olmalıdır. Yeni açık SHADOW hazırlığı v4 seçer; en az 24 saat gözlem ve ayrı `honor-open --yes` işlemi olmadan görünür olmaz. Mevcut v1/v2/v3 sezonlar kendiliğinden yükseltilmez. Gerçek açılış/özel silah/ödül/devir kontrolleri [v4 release kaydında](honor-v4-release-rehearsal-2026-10-16.md).
3. `pnpm --filter @astera/server season honor-benefits --season UUID` ile program ve eşikler kontrol edilir; varsayılan yalnız preview'dur.
4. İlan edilen açılışta aynı komuta `--yes` eklenir. Önceki tamir bedelleri ve uçuşlar korunur, puanlar resetlenmez; yalnız yeni taahhütler güncel kademeyi kullanır. Bu uygulama sırasında canlıda bu adım çalıştırılmadı.

Görünürlük kontrolü: UI 195 PASS (chat, API schema, rozet ve altı dil); sunucu 20 PASS (gerçek galaksi yanıtı ve genel/klan/DM post+tarihçe dahil). Chat açıklamasının eski halindeki eksikliği altı yeni test önce RED verdi; kupa+Honor simgesi ve doğru açıklama sonrası GREEN oldu. Galaksi ve chat sıralama kaynağı için mevcut çalışan Honor seçimi değişmedi; uçtan uca testlerle doğrulandı.
