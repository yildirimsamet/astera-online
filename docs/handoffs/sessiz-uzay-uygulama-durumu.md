# Sessiz Uzay — uygulama durumu

Yürürlükteki tek sözleşme: [entegrasyon planı](sessiz-uzay-entegrasyon-plani.md).
Önceki alternatifler ve onay bekleyen eski sorular geçersizdir; son politika kullanıcıca onaylandı.

- Canlı köprü: 0912992, migration 0060–0062, otomatik aktarım kapalı.
- Son uygulama izole release worktree'sinde; wiki hariç.
- 48 saat/bütün dünyalar/nötr reset/ortak koloni havuzu/kapasite üstü dönüş uygulanıyor.
- HTTP/SSE/cache, history, klan ateşkesi, cycle sonuçları ve worker cursor/expiry düzeltildi.
- İlgili testler ve CR tamamlandıktan sonra full suite, restore provası ve aktivasyon yapılacak.
- Dönüşte gelen koloni ve nötr placeholder konum değiştirir; iki UUID ve tarihsel referanslar
  korunur. Nötr placeholder WAITING'deki boşalan konuma geçer. MAIN'de kullanılmayan nötrler
  kalır. Aktif uçuşu/oyuncu gemisi/işlenmekte olan olayı bulunan nötr konum seçilmez.
- İlgili ilk test turu 46 PASS; CR'de uygun alternatif nötr konumun seçilmesi RED ile kanıtlanıp
  düzeltildi. Sonuçlar tamamlandıkça aşağıya eklenir; henüz canlı aktivasyon iddiası yoktur.
