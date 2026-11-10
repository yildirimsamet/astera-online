# H. Güvenlik (FAZ 4)

- **Dayanak:** ADR-11.
- **Bulgular:** Y5 (superuser, bütün sırlar her süreçte), O2 (refresh token), O3 (Valkey ve giriş), O4 / S11 (çoklu hesap), S10 (kişisel veri ve arşiv).

## 1. Veritabanı erişimi

| Rol | Kim kullanır | Yetki |
| --- | --- | --- |
| `astera` (sahip, superuser) | Migration ve tek seferlik bakım konteyneri | DDL; sürekli çalışan hiçbir süreç kullanmaz |
| `astera_app` | API | `public` üzerinde DML; arşive yalnız ekleme |
| `astera_worker` | Worker | DML; arşive ekleme ve okuma |
| `astera_arena` | Arena | DML; ileride arena tablolarına daraltılır |
| `astera_readonly` | Ölçüm, yönetici raporları | Okuma ve `pg_read_all_stats` |

- DDL ve `GRANT` ifadeleri E §8'de.
- **Etki:** Bir SQL enjeksiyonu artık süper kullanıcı yetkisi kazanmaz: dosya okuyamaz, rol değiştiremez, arşivi silemez.
- **Kod kuralı:** `sql.raw` yalnız kapalı listeden değer alır (bugün de böyle). Bir lint kuralı bunu korur.

## 2. Sırlar

Compose'daki ortak `*api-environment` bloğu role göre bölünür.

| Sır | API | Worker | Arena |
| --- | --- | --- | --- |
| DB parolası | kendi rolü | kendi rolü | kendi rolü |
| JWT anahtarı | ✓ | — | ✓ (token'lar HS256, simetrik; ileride asimetrik anahtara geçilirse arena yalnız açık anahtarı alır) |
| Polar, Shopier | ✓ (webhook ve ödeme) | yalnız teslimat işi gerekiyorsa | — |
| Resend (e-posta) | — | ✓ (outbox) | — |
| FCM servis hesabı | — | ✓ (outbox) | — |
| pgBackRest ve R2 | — | — | — (yalnız PG konteyneri) |

Paddle sırları ve kodu kaldırılır (S13).

## 3. Kimlik ve oturum

- **Erişim token'ı:** Kısa ömürlü (bugünkü gibi).
- **Refresh token ailesi (O2):**

  ```sql
  CREATE TABLE refresh_families (
    id          uuid PRIMARY KEY,
    account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    current_jti uuid NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    revoked_at  timestamptz
  );
  CREATE INDEX refresh_families_account_idx ON refresh_families (account_id) WHERE revoked_at IS NULL;
  ```

  - Her yenilemede `current_jti` değişir.
  - Eski bir `jti` tekrar gelirse token çalınmış sayılır, bütün aile iptal edilir.
  - "Bütün oturumlarımı kapat" (`auth_version`) bugünkü gibi kalır.
  - Ek yük: yenilemede tek satır, yani saatte bir kez kullanıcı başına.
- **Anahtar değişimi:** Token başlığına `kid` eklenir. Yeni anahtar eklenir, eskisi bir token ömrü boyunca doğrulamada kalır. Bugün anahtar değişimi herkesin oturumunu kapatıyor.
- **Native oturumlar:** Cihaz bazlı iptal bugünkü gibi kalır.

## 4. Hız sınırı ve kötüye kullanım

- **Valkey düşerse (O3):** Bugün şu işlemler tamamen kapanıyor: web ve native giriş, kayıt, onboarding, hesap güvenliği ve hesap silme isteği.
  - Açık olan oyuncular etkilenmiyor. Token yenileme bu sınırlayıcının arkasında değil; oynanış sınırlayıcısı hata durumunda açık kalıyor.
  - Owner kapatmayı sakıncalı buldu (2026-11-06). Karar: yedek sınırlayıcı.

  Hedef:
  - Süreç içi yedek sınırlayıcıya geçilir. Daha sıkı ama çalışır durumda kalır.
  - Valkey dönünce paylaşılan sayaca geri dönülür.
  - Kötüye kullanıma karşı koruma sürer, oyuncu da giriş yapabilir.
  - Üç API süreci ayrı sayar. Bu yüzden yedek sınırlar paylaşılan sınırın üçte biri kadar sıkıdır.
  - Yedeğe geçiş alarm üretir.
- **Kayıt dalgası:** `RATE_LIMIT_SIGNUP_MAX` (18) reklam kampanyasından önce yük testiyle ayarlanır (I).
- **Girdi doğrulama:** Bütün güvenilmeyen girdiler Zod ile ayrıştırılır (bugünkü kural). Yeni çerçeve türleri ve komut zarfı da aynı kurala uyar.

## 5. Kişisel veri ve arşiv (S10)

| Veri | Saklama |
| --- | --- |
| Oyun olguları (dünya satırları, defter, raporlar) | Süresiz, `archive.world_rows`'ta; hesap silinince anonimleşir |
| Sohbet, DM, medya | Bugünkü kural; arşive girmez |
| IP, cihaz, analitik ziyaret | Bugünkü saklama süresi; arşive girmez |
| `request_log` yanıtları | 48 saat |

Hesap silme akışına (`accountDeletion.ts`) arşiv anonimleştirme adımı eklenir. Bunun için bir test yazılır: silinen hesabın adı arşivde kalmaz.

## 6. Çoklu hesap (S11)

Yalnız ölçüm ve yönetici raporu yapılır; otomatik ceza yok. Yeni kişisel veri toplanmaz. Rapor mevcut sinyallerle kurulur:
- Hesaplar arası tek yönlü kaynak akışı: kaynak defteri, yağma ve ticaret.
- Aynı analitik ziyaret izi.
- Saldırıların hep aynı hedefe gitmesi.

Rapor `astera_readonly` rolüyle çalışır.

## 7. Yönetim ve denetim

- Yönetici işlemleri `admin_actions` tablosuna yazılır (bugün var).
- Tek seferlik canlı betikler: bugünkü "salt okunur varsayılan, `--commit` ile yaz" deseni korunur.
- Bu blueprint kapsamındaki her VPS işlemi için owner onayı gerekir (CLAUDE.md ve hafıza kuralı).
