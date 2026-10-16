# Aktif sezonda Honor: geçmiş hesaplama ve geçiş

14 Ekim 2026, 17:27–17:30 UTC canlı incelemesi. Yalnız `READ ONLY`
transaction'larda, 8 saniyelik statement timeout ile şema ve toplu sayılar
okundu. Üretime migration, puan, konfigürasyon veya deploy yazılmadı.

## Sonuç

Aktif sezona Honor eklemek teknik olarak mümkün. Ancak sezon başlangıcından
bugüne **tasarlanan Honor'un eksiksiz ve kesin hesaplandığı** söylenemez.
Eski savaşları bugünkü hesap gücüyle veya yalnız çatışmaya katılan filo oranıyla
puanlamak, kilitli toplam askerî güç / 24 saat tepe kuralını değiştirir.

Kayıp girdiler yedeklerden veya başka değişmez kayıtlardan bulunursa geçmiş
yeniden değerlendirilebilir. Böyle bir kurtarma henüz yapılmadı; geçmişin
tamamının kurtarılabilir olduğu kanıtlanmadı. İncelenen yerel `prod.dump`
15 Eylül tarihlidir ve 4 Ekim'de başlayan mevcut sezonun yedeği değildir.

## Ölçülen kapsam

Canlı EU-1 ve EU-2 MAIN sezonları 4 Ekim–3 Kasım, ruleset 16. WAITING
sezonu puan yarışına dahil edilmez. Aşağıdaki sayılar inceleme anına aittir.

| Kayıt | Sonuç | Anlamı |
| --- | --- | --- |
| Savunanı bulunan PLAYER gezegen raporu | 706, tamamı EU-1 | İnsan ve botları içerir; 706 insan savaşı iddiası değildir. |
| İki tarafı da bot olmayan gezegen raporu | 618 | Admin/aynı hesap/ilişki uygunluğu ayrıca kontrol gerektirir. |
| Yukarıdaki 706 raporda solo yapı | 706 | Ortak saldırı yok, defender_count=1, destek sonucu yok. |
| Saldıran başlangıç filosu kaydı | 706/706 | Hesaptaki tüm sahip olunan askerî varlık değildir. |
| Taraflardan en az birinde kayıp kaydı | 425/706 | Kalıcı kayıp, bedelsiz ground yeniden yapımı çıkarılarak ayrıca hesaplanır. |
| Raporu bulunmayan Hakimiyet olayı | 5 | Dördünde kayıp değeri, beşinde yağma değeri var. Atlanmaları nötr değildir. |
| Anıt savaş kaydı | 273 | NPC dahil; insan Honor olayı sayısı değildir. |
| Tamamlanmış HULL siparişi | 7.126 | Üretim başlangıç girdisi var; bütün envanter değişimlerinin günlüğü değildir. |
| MAIN Core siparişi | 1.302; 1.295 tamamlanmış | Tier geçmişini araştırmayı destekler. |
| Core tier / kontrol değişimi public olayları | 625 / 56 | Payload isim ve tier taşır; değişmez komutan kimliği doğrudan payload'da yok. |
| Klan üyeliği / teslim edilmiş yardım | 42 / 7 | İlişki geçmişi tamamen yok denmesi doğru değildir. |
| Kapanmış sahiplik telemetri segmenti | 9 | Üretim toplamı ve shipsBuilt tutar, tam envanter zaman serisi değildir. |
| Radyasyon kaybı bildirimi | 65 | lost/left adetleri var; kaybolan gemilerin hull dağılımı yok. |
| Honor observations / commitments / events tablosu | 0 | Canlıda henüz gönderim anı Honor kanıtı veya filo tepe günlüğü tutulmuyor. |

Yereldeki 12 Ekim kesiti 520 WORLD + 32 MONUMENT olayı içerir. Bu eski
kesitin sayıları 14 Ekim canlı sayılarıyla karıştırılmamalıdır.

## Eksik bilginin puana etkisi

Bu, yalnız birkaç puan yuvarlama sorunu değildir. Örneğin aynı kayıpları
olan varsayımsal bir savaşta saldıran tier 4, savunan tier 3, K=50.000,
L=0, yağma=20.000 olsun. Toplam referanslar 100.000 / 80.000 ise ilk
zayıf hedef saldırısı ham −13,5 Honor verir. Savunanın başka yerdeki varlığı
nedeniyle referansı 150.000 ise aynı çatışma ham +52 Honor verir. Çift
sınırı henüz uygulanmamıştır. Bu örnek gerçek bir geçmiş savaşa verilmiş
puan değildir; eksik toplam güç bilgisinin işareti değiştirebildiğini gösterir.

Mevcut `units` güncel envanterdir. Uçuş ve katkı satırları süreç boyunca
güncellenebilir; radyasyonla kayıp, yerde kalan filo, dock, sahiplik değişimi,
üretim ve tüm diğer askerî kaynaklar birlikte doğrulanmadan yalnız
üretim eksi savaş kaybı hesabı yeterli değildir. 65 bildirimin yalnız toplam
adet içermesi tek başına bütün kayıpların başka kayıtlardan kurtarılamayacağını
kanıtlamaz; ancak bu bildirimler exact hull günlüğü yerine kullanılamaz.

Beş kayıp raporu sessizce atlamak da yeterli değildir: geçmiş olaylar çift
bütçesini, 24 saatlik zorbalık tekrarını ve karşılık hakkını değiştirir.
Eksik olay sonraki tam raporların hesaplarını da etkileyebilir. Yalnız
pozitifleri geçmişe yazmak veya eksik oyuncuları sıfır bırakmak tam Honor
uygulaması değildir ve ödül sıralamasında ayrı bir adalet sorunu yaratır.

## Uygulanabilir seçenekler

1. **Tam geçmiş:** Eksik raporlar ve gönderim anı T/N/ilişki girdileri
   doğrulanabilir biçimde kurtarılırsa, önce yerel kopyada kronolojik tam
   replay yapılır. Retry, aynı zamanlı olay, çift/karşılık bütçesi ve toplamlar
   doğrulanır. Verisi eksik olaylar için tahmin puanı yazılmaz. Şu anda bu
   seçeneğin veri koşulu sağlanmış değildir.
2. **Bu sezonda ilan edilmiş başlangıç:** Herkes aynı kesim anında 0 Honor
   ile başlar. O andaki gerçek sahip olunan varlık ve Core ilk referans olarak
   kaydedilir; önceki 24 saatin veya sezonun tepe değeri uydurulmaz. Eski
   uçuşlar kaynak kimliğiyle dışarıda tutulur. Hakimiyet geçmişi ve mevcut
   Hakimiyet ödül hakları korunur. Honor, açıklanan başlangıçtan sonraki
   dönem için ek yarış olur. Bu ilk dönem referansının sezon başından beri
   uygulanmış tam tarihsel Honor ile aynı olduğu iddia edilmez.
3. **Sonraki sezon:** Mevcut sezonda görünmez SHADOW gözlem, sonraki sezon
   başından itibaren bütün kayıtlarıyla ana Honor yarışı. Sezon ortası kural
   değişikliği istemiyorsak en temiz seçenek budur.

Bu sezonda görünür Honor isteniyorsa öneri 2. seçenektir. Owner 15 Ekim'de
2–3 günlük kapalı gözlemden sonra temiz görünür açılış işleminin hazırlanmasını
istedi. Canlıda uygulanmadı.

## Hazır olan ve gereken operasyon

Mevcut `honor-shadow` CLI kontrollü, idempotent SHADOW açılışı yapabilir.
Güncel sahiplerden başlangıç referansı ve eski pending saldırıların kimlik
listesi atomik alınır; eşit timestamp öncesi/sonrası yarışları testlidir.
Bu komut canlıda çalıştırılmadı.

14 Ekim incelemesinde görünür ACTIVE açılışı mevcut sezon ortasında
desteklenmiyordu. `prepareHonorSeason` guard'ı değişmedi; 15 Ekim'de ayrı,
test edilmiş `honor-open` geçişi eklendi. Gözlem geçmişini korur, puanı/bütçeyi
temiz başlatır ve eski uçuşları dışarıda tutar. Aday2 henüz açılmaz.
[Uygulama ve operasyon sınırları](honor-ranked-opening-2026-10-15.md).

Özel silah puan adaptörlerinin tamamlanması, aday v2 politika kararlarının
netleşmesi, son entegrasyon / UI / ödül / migration rehearsal kontrolleri
de sürmektedir. Bu araştırma, mevcut branch'in deploy'a hazır olduğuna
dair bir onay değildir. Geçmiş replay yapılabilse bile dağıtım öncesi
güncel tutarlı kopyada deneme ve son canlı cutover gerekir.
