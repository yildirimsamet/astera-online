export const notificationCenter = {
  "title": "Bildirim Merkezi",
  "eyebrow": "Telefon uyarıları",
  "menuHint": "Saldırı inmeden önce telefonuna uyarı al.",
  "menuEmpty": "Kasa boş",
  "lead": "Radarın yaklaşan bir saldırıyı görünce merkez telefonuna uyarı gönderir; oyun kapalı olsa da. Her uyarı, merkezin döteryum kasasından ödenir.",
  "loading": "Bildirim Merkezi yükleniyor…",
  "loadError": "Bildirim Merkezi yüklenemedi.",
  "retry": "Tekrar dene",
  "from": "en az",
  "kind": {
    "incoming_attack": "Gelen saldırı",
    "incoming_strategic": "Stratejik silah",
    "probe_detected": "Sonda tespit edildi"
  },
  "kindRule": {
    "incoming_attack": "Dünyalarından birine gelen bir filo veya ortak klan filosu.",
    "incoming_strategic": "Yaklaşan bir Ölüm Yıldızı. Saldırı uyarısının 1,5 katı tutar.",
    "probe_detected": "Dünyalarından birinin üstünde yakalanan bir sonda. Hemen gönderilir."
  },
  "installTitle": "Android uygulamasında var",
  "installBody": "Telefon uyarıları için Astera Online uygulaması gerekir. Uygulamayı kur ve merkezi kurmak için bu hesapla giriş yap.",
  "install": "Google Play'den indir",
  "buildCost": "Kurulum bedeli",
  "buildFrom": "Bedel seçili dünyandan ödenir: {{world}}. Bir kez kurulur ve tüm dünyalarını kapsar.",
  "buildShort": "Seçili dünyada yeterli kaynak yok. Başka bir dünya seç veya bekle.",
  "build": "Merkezi kur",
  "wallet": "Kasa",
  "covers_one": "Bu zamanlamada {{count}} saldırı uyarısına yeter",
  "covers_other": "Bu zamanlamada {{count}} saldırı uyarısına yeter",
  "empty": "Kasa bir sonraki saldırı uyarısını ödeyemez. Döteryum ekleyene kadar uyarı gönderilmez.",
  "unfunded_one": "Son 24 saatte {{count}} uyarı gönderilemedi: kasa yetmedi.",
  "unfunded_other": "Son 24 saatte {{count}} uyarı gönderilemedi: kasa yetmedi.",
  "transferTitle": "Döteryum ekle",
  "transferFrom": "Kaynak: {{world}}. Depoda:",
  "amount": "Aktarılacak döteryum",
  "transfer": "Aktar",
  "alerts_one": "{{count}} uyarı",
  "alerts_other": "{{count}} uyarı",
  "all": "Tümü",
  "confirmTitle": "{{amount}} döteryum aktarılsın mı?",
  "confirmBody": "Kasadaki döteryum bir dünyaya geri aktarılamaz. Yalnız uyarılara harcanır.",
  "confirm": "{{amount}} aktar",
  "back": "Geri",
  "walletAfter": "Aktarımdan sonra kasa",
  "timingTitle": "Ne zaman uyarılsın",
  "timing": {
    "T3": "3 dk",
    "T5": "5 dk",
    "T15": "15 dk",
    "RADAR": "Radarda"
  },
  "timingRule": "Saldırının inmesine kalan dakika. Erken uyarı daha pahalıdır. Radarın filoyu daha geç görürse uyarı o an gönderilir.",
  "kindsTitle": "Ücretli uyarılar",
  "recentTitle": "Son uyarılar",
  "status": {
    "PENDING": "Bekliyor",
    "SENT": "Gönderildi",
    "UNFUNDED": "Kasa yetmedi",
    "CANCELLED": "Ücret alınmadı",
    "NO_DEVICE": "Telefon yok"
  },
  "rulesTitle": "Uyarılar nasıl çalışır",
  "ruleRadar": "Uyarı yalnız radarının gördüğü bir filo için gönderilir. Radar görmezse uyarı yok.",
  "ruleRecall": "Saldırı, uyarı gönderilmeden geri çağrılırsa ücret alınmaz.",
  "ruleShort": "Kasa ödeyemezse uyarı gönderilmez. Burada \"Kasa yetmedi\" olarak listelenir.",
  "ruleInGame": "Oyun içindeki uyarı ücretsiz kalır.",
  "priceRule": "Saldırı uyarısının ücreti, tüm dünyalarının toplam döteryum üretiminin birkaç saatlik tutarıdır. Bu tutar alt sınırın altındaysa alt sınır ödenir. Üretimin: saatte {{rate}}.",
  "reading": {
    "NONE": "Kurulmamış",
    "EMPTY": "Kasa boş",
    "FEW": "Birkaç uyarılık",
    "PLENTY": "Kasa dolu",
    "UNKNOWN": "Okunamadı"
  },
  "readingMeaning": {
    "NONE": "Saldırıdan önce telefonuna uyarı gitmez.",
    "EMPTY": "Kurulu, ama kasa ödeyemediği için telefonuna uyarı gitmez.",
    "FEW": "Birkaç uyarıya yeter. Telefonuna uyarı gidebilir.",
    "PLENTY": "Çok sayıda uyarıya yeter. Telefonuna uyarı gideceğini varsay.",
    "UNKNOWN": "Sonda Bildirim Merkezini okuyamadı."
  },
  "readingRule": "Sonda okuması yanlış olabilir. Keskin bir sonda daha az yanılır.",
  "local": {
    "title": {
      "build": "İnşaat bitti",
      "research": "Araştırma bitti",
      "ships": "Gemiler hazır",
      "fleet": "Filo eve döndü"
    },
    "body": {
      "build": "{{world}}: {{name}} hazır.",
      "research": "{{name}} tamamlandı.",
      "ships": "{{world}}: {{count}} × {{name}} hazır.",
      "fleet": "Bir filo ana dünyasına döndü.",
      "unnamed": "{{world}}: bir sipariş bitti."
    },
    "section": "Bu telefona ücretsiz uyarılar",
    "sectionBody": "Bir sipariş bitince bu telefon haber verir. Ücretsizdir ve yalnız bu telefonda ayarlanır.",
    "switch": "Siparişler bitince uyar",
    "denied": "Telefon bildirimlere izin vermedi. Telefon ayarlarından Astera Online için izin ver.",
    "blocked": "Astera Online uyarıları telefon ayarlarından kapatılmış. Oradan açana kadar uyarılar duraklatıldı.",
    "late": "Uyarılar birkaç dakika gecikebilir.",
    "allowExact": "Zamanında uyarıya izin ver",
    "category": {
      "build": "İnşaat",
      "research": "Araştırma",
      "ships": "Gemiler",
      "fleet": "Dönen filolar"
    }
  },
  "hours_one": "{{count}} saat",
  "hours_other": "{{count}} saat",
  "floor": "en az {{amount}}"
};
