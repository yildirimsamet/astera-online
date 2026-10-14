# Kişisel chat susturma — 2026-10-14

Sahip bu işin atmosfer değişiklikleriyle aynı worktree/release içinde olmasını istedi. Genel ve klan sohbetinde basılı tutma aksiyonları arasına kişisel susturma düğmesi gelir; kendi mesajı ve admin mesajı muaf. Mesajlar server'dan silinmez; DM'nin mevcut server-side engeli aynen ayrı kalır.

Sade uygulama: ChatHost kendi accountId kapsamındaki localStorage listesini okur; mute/unmute yerel state ve tek storage kaydı değiştirir. ChatScreen/ChannelPanel yalnız render edilen general/clan mesajlarını authorPlayerId ile süzer. Orijinal history pagination/read cursor korunur; böylece son mesaj susturulan yazardan olsa bile okunmamış işareti takılmaz. Yeni admin/self mesajları listede ID olsa da görünür. Chat başlığının yanında listedeki kişileri gösteren küçük düğme; her satırda kaldırma kontrolü. Liste bu cihazdaki aynı hesaba ait, başka hesaba taşınmaz.

Test kapsamı: basılı tutma → ortadaki düğme → tüm yazar mesajları kaybolur; self/admin düğmesi yok ve sahte stored ID'ye rağmen görünür; dil/klan değişiminde filtre; yeni/paginated mesajda aynı filtre; unmute eski mesajları geri getirir; yeniden açılışta kalıcı; başka account ayrı; DM kişisel listeyle filtrelenmez/engeli çağrılmaz; bozuk JSON/shape/storage denied gracefully; liste empty state, nested Escape yalnız listeyi kapatır; mobil/desktop ve 6 dil yerleşimi. Önce testler RED, sonra uygulama GREEN. Backend ve oyun mantığı değişmez.

## Uygulama ve kanıt

`chatMutes.ts` storage JSON'unu Zod ile doğrular, ID'leri tekilleştirir; bozuk/kapalı store oyunu bozmaz. ChatHost accountId değişince keyed personal host yeniden açılır; state ve storage tek hesap kapsamındadır. MessageRow'a server flag'leri dışında bir yetki eklenmez. ChannelPanel görünür satırları ayrı memo'da hesaplar; cursor/read/older history raw mesajları okumaya devam eder. Uygulama server DM block/unblock methodlarını çağırmaz.

İlk koşuda 6 UI beklentisi ve yeni helper suite RED verdi; uygulama sonrası chat/DM/helper üç dosyada 32 PASS, mevcut chat/Sheet/shell/i18n regresyon grubunda 241 PASS (iki yeni fixture async/refetch ayarı düzeltilmeden önce). Son kapsam genişletme tam web koşusunda doğrulanır. `node tools/visual.mjs out/chat-personal-mutes-final --chat-personal-mutes` actual ChatHost/ChatScreen ile 350/1280px × 6 dilde 12 PASS verdi: orta aksiyon, self/admin korunması, kişisel liste, kalıcılık, hesap ayrılığı, restore; hiçbir fixture dışı API isteği veya browser error olmadı. Ekran görüntüleri aynı output dizinindedir. Backend chat gönderimi veya canlı kullanıcıya mesaj yok.

## Sahibin istediği CR

Doğrulanmış bulgu: son sayfanın bütün yazar mesajları susturulduğunda log boş ve scroll edilemez oluyor; geçmişteki başka kişilerin mesajları için pagination tetiklenemiyor. Yeni regression bunu `hasNextPage=true` + tüm son sayfa gizli + eski görünür mesaj fixture'ıyla RED verdi. Fix: yalnız filtre sonucu boş ve raw sayfada cursor varsa mevcut çevrilmiş “Load older messages” düğmesini çiz; kullanıcı kontrollü tek fetch, aynı loadOlder/prepend/read yolu korunur. Son chat/research/DM regresyon grubu 5 dosyada 183 PASS.

Son browser harness aynı boş-sayfa senaryosunda mevcut localized older düğmesine basıp daha eski başka yazarın mesajını gerçek infinite-query yolundan yüklemeyi de ölçer; API tümü browser fixture, canlı mesaj göndermez.
