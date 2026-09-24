<!-- All done. -->

### 1. Geri çağrılan filo eski varış eventi nedeniyle anında eve dönebiliyor

  Önem: Yüksek etki, zamanlamaya bağlı yarış koşulu.

  Senaryo:

  1. Transfer filosu hedefe varmak üzereyken geri çağırma isteği başlıyor.
  2. Aynı anda worker eski mission_arrival eventini processing durumuna alıyor.
  3. Geri çağırma yeni ve ileri bir dönüş ETA’sı yazıyor; fakat yalnızca pending eventleri güncelliyor.
  4. Worker elindeki eski eventi çalıştırıp filoyu eski varış zamanında eve indiriyor.

  Testte filo hedefe varmasına 100 ms kala çağrıldı. Hesaplanan dönüş ETA’sı hâlâ gelecekte olmasına rağmen eski event çalışınca görev resolved oldu ve 10 gemi hemen ana filoya eklendi.

  Kök neden:

  - Geri çağırma yalnızca pending eventi yeniden zamanlıyor: apps/server/src/services/movement.ts:648
  - Worker eventi önceden processing yapabiliyor: apps/server/src/worker/queue.ts:26
  - Arrival handler güncel mission.arriveAt kontrolü yapmadan görevi çözüyor: apps/server/src/worker/handlers.ts:191

  Etkisi: Geri dönüş süresi ve filonun savunmasız kaldığı pencere tamamen atlanabiliyor; geri çağırma güvenli bir “anında ışınlanma”ya dönüşebiliyor.

  ### 2. Ortak savaş filosu sonradan kurulan Radar tarafından uyandırılmıyor

  Önem: Yüksek.

  Ortak savaş başlatılırken radar_warning doğru şekilde oluşturuluyor ve warning handler COMBINED_ATTACK görevini saldırı olarak tanıyor:

  - Event oluşturma: apps/server/src/services/clanWar.ts:2414
  - Handler sınıflandırması: apps/server/src/worker/handlers.ts:1515

  Ancak uçuş sırasında Radar/Uplink kurulduğunda çalışan sorgu yalnızca attack ve death_star görevlerini seçiyor; clan_war yok: apps/server/src/services/radar.ts:121. Core
  değişikliğinde warning zamanını yeniden hesaplayan sorguda da aynı eksiklik var: apps/server/src/services/radar.ts:90.

  Doğrulamada:

  - Canlı bir COMBINED_ATTACK oluşturuldu.
  - Canlı warning kalmamışken hedefe Radar 5 verildi.
  - wakeInboundRadarWarnings çalıştırıldı.
  - Oluşan yeni warning sayısı: 0.

  Etkisi: Savunmacı uçuş sırasında Radar’a yatırım yapmasına rağmen ortak savaş için hak ettiği anlık uyarıyı alamayabilir. Core değişiklikleri de warning zamanını yanlış bırakabilir.

  ### 3. Ortak savaş hedefi saldıran klana uyarısız katılabiliyor

  Önem: Yüksek.

  Klan katılımı sırasında sistem, devam edecek düşman uçuşları varsa CLAN_HOSTILE_FLIGHT_ACK_REQUIRED istemeli. Fakat kontrol yalnızca attack, probe ve death_star görevlerini sayıyor;
  ortak savaş görevini saymıyor: apps/server/src/services/clanCombat.ts:273.

  Doğrulamada:

  1. Bir klan hedef oyuncuya ortak saldırı başlattı.
  2. Saldırı havadayken hedef oyuncu saldıran klana başvurdu.
  3. Lider başvuruyu acknowledgeHostile: false ile kabul etti.
  4. Kabul başarılı oldu ve sonuç yanlış biçimde hostileFlightsContinue: false döndürdü.

  Onay kontrolü burada tamamen atlanıyor: apps/server/src/services/clan.ts:1041. Katılım sonrası iptal mekanizması da yalnızca ASSEMBLING operasyonları kapatıyor; havadaki ATTACKING
  operasyonu devam ediyor: apps/server/src/services/clanWar.ts:2048.

  Etkisi: Oyuncu saldıran klana katıldıktan sonra kendi yeni klanının ortak filosu tarafından vurulabilir; bunun için zorunlu düşman-uçuş onayı gösterilmez. Ganimet, kayıp ve Dominion
  sonucu klan içi savaş şeklinde oluşabilir.

  ### 4. Filosuz lider, gelişim bandının dışına çıktıktan sonra savaşı yine başlatabiliyor

  Önem: Yüksek — güçlü liderlerin zayıf hedeflere saldırmasını engelleyen anti-farm kuralı aşılabiliyor.

  Başlatma sırasında uygunluk kontrolü yalnızca havuzda filosu bulunan oyunculardan oluşturulan fighters listesine uygulanıyor: apps/server/src/services/clanWar.ts:2253, apps/server/
  src/services/clanWar.ts:2270.

  Filosuz lider bu kontrolden sonra katılımcı listesine ekleniyor: apps/server/src/services/clanWar.ts:2294. Sonraki prepareJointClanAttack aşaması liderin düşmanlık ve saldırı kotasını
  kontrol ediyor ancak gelişim bandını kontrol etmiyor: apps/server/src/services/clanCombat.ts:345.

  Doğrulanan senaryo:

  - Hedef Core 7, fiilen savaşan üye Core 7: saldırı bandı içinde.
  - Filosuz lider Core 16: hedefle saldırı bandının dışında.
  - Hedef, lider uygun durumdayken işaretlendi; lider daha sonra bandın dışına çıktı.
  - Ortak savaş yine de başarıyla başlatıldı.

  Mevcut test bu durumu yakalıyor gibi görünüyor: apps/server/test/clan-war-start.test.ts:301. Ancak test hedefi Core 1’e düşürdüğü için gerçek savaşçı da bandın dışına çıkıyor; reddin
  liderden kaynaklandığını kanıtlamıyor. Savaşçıyı hedefle aynı bantta tuttuğum izole senaryoda açık ortaya çıktı.

  Sonuç: Lider hedefi işaretledikten sonra bandın dışına çıkabilir ve uygun bir üyenin filosunu kullanarak normalde saldıramayacağı hedefe ortak savaş gönderebilir.