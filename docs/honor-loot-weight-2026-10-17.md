# Honor yağma ağırlığı: %20 → %40

Kullanıcı kararı: kalıcı kayıp + yağmanın %40'ı hem misilleme hakkı doğururken hem
karşı saldırıda hak tüketirken kullanılır. Aynı zarar hesabını kullanan zayıf hedef
cezasında yağma terimi de iki katına çıkar; askerî başarıya bağlı pozitif yağma
bonusu değişmez. Süre 24 saat, kendi saldırı kaybı kesintisi ve tekrar katsayıları
korunur.

Aktif sezon için onaylanan geçiş: yalnız yeni gönderimler %40; geçmiş savaşlar,
yoldaki saldırılar ve kazanılmış bütçeler korunur. Sezonun Honor sürümünü değiştirmek
yerine ayrı yağma oranı gönderim sözleşmesinde ve savaş kanıtında dondurulur.
Eksik eski alan %20 anlamına gelir; replay olayın kendi oranını kullanır.

Dokunulacak alanlar: saf solo/ortak zarar hesabı, sezon yapılandırması ve migration,
commitment/evidence, sıralı/eşzamanlı muhasebe, kontrollü aktif sezon geçişi ve CLI,
hedef API sözleşmesi ve altı dil gönderim açıklaması. Savaş/yağma miktarı ve
Hâkimiyet hesabı değişmez. Eski kanıtların hash'i alan eklenmeden aynı kalmalıdır.

TDD kapsamı: boş/tek birim yağma; %20 eski / %40 yeni; kalıcı kayıp + karma yağma;
tam hak / yetersiz hak / kalan hak; kendi kaybı; solo/ortak uyumu; eşzamanlı tüketim;
geç olay replay; 24 saat sınırı; yeni gönderim ve eski uçuş; geçiş önizleme,
tekrar/eşzamanlı çağrı, kapalı/eksik sezon, SHADOW durumunu koruma, rollback; API ve UI oran uyumu.

Migration mevcut sezonları %20 bırakır; yeni hazırlanan sezonlar %40 başlar.
Aktif sezon geçişi, sezon satırını kilitleyerek gönderimlerle sıralanır ve yalnız
yeni gönderim oranını günceller. Puan/hak/kanıtlar yeniden hesaplanmaz.

Canlı ön kontrolde EU-1 ve EU-2 Honor v4 SHADOW. Geçiş SHADOW muhasebesinde de
çalışır; sıralamayı açmaz ve rankedAt alanını değiştirmez.
