export const notificationCenter = {
  "title": "Bildirim Merkezi",
  "eyebrow": "Telefon uyarıları",
  "menuHint": "Saldırı inmeden önce telefonuna uyarı al.",
  "menuEmpty": "Kasa boş",
  "menuEmptyHint": "Saldırı uyarısı gitmez: döteryum ekle.",
  "pushChannel": "Saldırı uyarıları",
  "pushOffTitle": "Saldırı uyarıları bu telefona gelmiyor",
  "pushOff": "Telefon bildirimlere izin vermiyor. İzin verene kadar uyarı gönderilmez ve kasadan döteryum düşmez.",
  "pushAllow": "Bildirimlere izin ver",
  "pushDenied": "Android bir daha sormayacak. Telefon ayarlarından Astera Online için bildirimlere izin ver.",
  "menuCovers_one": "{{count}} saldırı uyarısına yeter",
  "menuCovers_other": "{{count}} saldırı uyarısına yeter",
  "lead": "Radarın yaklaşan bir saldırıyı görünce merkez telefonuna uyarı gönderir; oyun kapalı olsa da. Her uyarı, merkezin kasasından döteryum harcar.",
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
    "incoming_strategic": "Yaklaşan bir Ölüm Yıldızı. Saldırı uyarısının 1,5 katı döteryum harcar.",
    "probe_detected": "Dünyalarından birinin üstünde yakalanan bir sonda. Hemen gönderilir."
  },
  "buildCost": "Kurulum bedeli",
  "buildFrom": "Bedel seçili dünyandan ödenir: {{world}}. Bir kez kurulur ve tüm dünyalarını kapsar.",
  "buildShort": "Seçili dünyada yeterli kaynak yok. Başka bir dünya seç veya bekle.",
  "build": "Merkezi kur",
  "wallet": "Kasa",
  "covers_one": "“{{timing}}” ayarıyla {{count}} saldırı uyarısına yeter",
  "covers_other": "“{{timing}}” ayarıyla {{count}} saldırı uyarısına yeter",
  "walletRule": "Tek kasa tüm uyarıları öder; her uyarı gönderildiği an kasadan düşer. Zamanlamayı değiştirmek kasayı değil, bir uyarının fiyatını değiştirir.",
  "empty": "Kasa bir sonraki saldırı uyarısını ödeyemez. Döteryum ekleyene kadar uyarı gönderilmez.",
  "unfunded_one": "Son 24 saatte {{count}} uyarı gönderilemedi: kasa yetmedi.",
  "unfunded_other": "Son 24 saatte {{count}} uyarı gönderilemedi: kasa yetmedi.",
  "transferTitle": "Döteryum ekle",
  "transferFrom": "Kaynak: {{world}}. Depoda:",
  "amount": "Aktarılacak döteryum",
  "transferPreview_one": "Aktarımdan sonra kasa: {{wallet}} · bu ayarla {{count}} saldırı uyarısına yeter",
  "transferPreview_other": "Aktarımdan sonra kasa: {{wallet}} · bu ayarla {{count}} saldırı uyarısına yeter",
  "transfer": "Aktar",
  "all": "Tümü",
  "confirmTitle": "{{amount}} döteryum aktarılsın mı?",
  "confirmBody": "Kasadaki döteryum bir dünyaya geri aktarılamaz. Yalnız uyarılara harcanır.",
  "confirm": "{{amount}} aktar",
  "back": "Geri",
  "walletAfter": "Aktarımdan sonra kasa",
  "timingTitle": "Saldırı uyarısı ne zaman gelsin?",
  "timing": {
    "T3": "3 dk",
    "T5": "5 dk",
    "T15": "15 dk",
    "RADAR": "Radarda"
  },
  "timingRule": "Uyarı ne kadar erken gelirse her biri o kadar çok döteryum harcar. Radarın filoyu daha geç görürse uyarı o an gelir.",
  "timingOption": {
    "T3": "İnişe 3 dakika kala",
    "T5": "İnişe 5 dakika kala",
    "T15": "İnişe 15 dakika kala",
    "RADAR": "Radar görür görmez"
  },
  "perAlert": "/ uyarı",
  "kindsTitle": "Radar uyarıları",
  "recentTitle": "Son uyarılar",
  "status": {
    "PENDING": "Bekliyor",
    "SENT": "Gönderildi",
    "UNFUNDED": "Kasa yetmedi",
    "CANCELLED": "Kasadan düşülmedi",
    "NO_DEVICE": "Telefon yok"
  },
  "rulesTitle": "Uyarılar nasıl çalışır",
  "ruleRadar": "Uyarı yalnız radarının gördüğü bir filo için gönderilir. Radar görmezse uyarı yok.",
  "ruleRecall": "Saldırı, uyarı gönderilmeden geri çağrılırsa kasadan döteryum düşülmez.",
  "ruleShort": "Kasa ödeyemezse uyarı gönderilmez. Burada \"Kasa yetmedi\" olarak listelenir.",
  "ruleInGame": "Oyun içindeki uyarı her zaman görünür ve döteryum harcamaz.",
  "priceRule": "Bir saldırı uyarısı, tüm dünyalarının toplam döteryum üretiminin birkaç saatlik tutarını harcar. Bu tutar alt sınırın altındaysa alt sınır harcanır. Üretimin: saatte {{rate}}.",
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
    "section": "Bu telefonda sipariş hatırlatmaları",
    "sectionBody": "Bir sipariş bitince bu telefon haber verir. Kasadan döteryum harcamaz ve yalnız bu telefonda ayarlanır.",
    "switch": "Siparişler bitince uyar",
    "denied": "Telefon bildirimlere izin vermedi. Telefon ayarlarından Astera Online için izin ver.",
    "blocked": "Astera Online uyarıları telefon ayarlarından kapatılmış. Oradan açana kadar uyarılar duraklatıldı.",
    "lateTitle": "Uyarılar geç gelebilir",
    "late": "Bu izin olmadan Android bir uyarıyı bir saate kadar geciktirebilir. Siparişin bittiği an haber almak için izin ver.",
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
