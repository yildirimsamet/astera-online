export const notificationCenter = {
  "title": "通知センター",
  "eyebrow": "スマホ通知",
  "menuHint": "攻撃が着弾する前にスマホへ通知します。",
  "menuEmpty": "金庫不足",
  "menuEmptyHint": "攻撃通知は送られません。重水素を追加してください。",
  "pushChannel": "攻撃通知",
  "pushOffTitle": "攻撃通知がこの端末に届きません",
  "pushOff": "この端末は通知を許可していません。許可するまで通知は送られず、金庫の重水素も減りません。",
  "pushAllow": "通知を許可",
  "pushDenied": "Androidは再度確認しません。端末の設定でAstera Onlineの通知を許可してください。",
  "menuCovers_one": "攻撃通知{{count}}件分",
  "menuCovers_other": "攻撃通知{{count}}件分",
  "lead": "レーダーが接近中の攻撃を捉えると、ゲームを閉じていてもセンターがスマホに通知を送ります。通知1件ごとに、センターの金庫の重水素を消費します。",
  "loading": "通知センターを読み込み中…",
  "loadError": "通知センターを読み込めませんでした。",
  "retry": "再試行",
  "from": "最低",
  "kind": {
    "incoming_attack": "接近中の攻撃",
    "incoming_strategic": "戦略兵器",
    "probe_detected": "探査機を検知"
  },
  "kindRule": {
    "incoming_attack": "あなたのワールドへ向かう艦隊、またはクラン合同艦隊。",
    "incoming_strategic": "接近中のデス・スター。攻撃通知の1.5倍の重水素を消費します。",
    "probe_detected": "あなたのワールド上空で探査機を検知。すぐに送信されます。"
  },
  "buildCost": "建設コスト",
  "buildFrom": "選択中のワールド「{{world}}」から支払います。一度建てればすべてのワールドが対象です。",
  "buildShort": "選択中のワールドの資源が足りません。別のワールドを選ぶか、待ってください。",
  "build": "センターを建設",
  "wallet": "金庫",
  "covers_one": "「{{timing}}」で攻撃通知{{count}}件分",
  "covers_other": "「{{timing}}」で攻撃通知{{count}}件分",
  "walletRule": "金庫は1つで、すべての通知を送信時に支払います。タイミングを変えると変わるのは1件の料金で、金庫ではありません。",
  "empty": "金庫では次の攻撃通知を支払えません。重水素を追加するまで通知は送信されません。",
  "unfunded_one": "直近24時間で{{count}}件の通知が送信されませんでした（金庫不足）。",
  "unfunded_other": "直近24時間で{{count}}件の通知が送信されませんでした（金庫不足）。",
  "transferTitle": "重水素を追加",
  "transferFrom": "{{world}}から。貯蔵量：",
  "amount": "送る重水素",
  "transferPreview_one": "送金後の金庫: {{wallet}} · このタイミングで攻撃通知{{count}}件分",
  "transferPreview_other": "送金後の金庫: {{wallet}} · このタイミングで攻撃通知{{count}}件分",
  "transfer": "送る",
  "all": "全部",
  "confirmTitle": "重水素{{amount}}を送りますか？",
  "confirmBody": "金庫の重水素はワールドに戻せません。通知にのみ使われます。",
  "confirm": "{{amount}}を送る",
  "back": "戻る",
  "walletAfter": "送金後の金庫",
  "timingTitle": "攻撃通知をいつ受け取りますか？",
  "timing": {
    "T3": "3分前",
    "T5": "5分前",
    "T15": "15分前",
    "RADAR": "レーダー捕捉時"
  },
  "timingRule": "通知が早いほど、1件あたりの重水素が増えます。レーダーが艦隊を捉えるのが遅れた場合は、捉えた時点で届きます。",
  "timingOption": {
    "T3": "着弾の3分前",
    "T5": "着弾の5分前",
    "T15": "着弾の15分前",
    "RADAR": "レーダーが捉えた時点"
  },
  "perAlert": "/ 件",
  "kindsTitle": "レーダー通知",
  "recentTitle": "最近の通知",
  "status": {
    "PENDING": "待機中",
    "SENT": "送信済み",
    "UNFUNDED": "金庫不足",
    "CANCELLED": "消費なし",
    "NO_DEVICE": "端末なし"
  },
  "rulesTitle": "通知のしくみ",
  "ruleRadar": "通知はレーダーが捉えた艦隊にだけ送られます。レーダーが捉えなければ通知はありません。",
  "ruleRecall": "通知の送信前に攻撃が呼び戻された場合、金庫の重水素は減りません。",
  "ruleShort": "金庫で支払えない場合、通知は送信されず、ここに「金庫不足」と表示されます。",
  "ruleInGame": "ゲーム内の警告は常に表示され、重水素を消費しません。",
  "priceRule": "攻撃通知は、全ワールドの重水素生産量の数時間分を消費します。最低量の方が多い場合は最低量になります。あなたの生産量：毎時{{rate}}。",
  "reading": {
    "NONE": "未建設",
    "EMPTY": "金庫が空",
    "FEW": "数件分",
    "PLENTY": "十分",
    "UNKNOWN": "読み取れず"
  },
  "readingMeaning": {
    "NONE": "攻撃前にスマホ通知は届きません。",
    "EMPTY": "建設済みですが、金庫で支払えないためスマホ通知は送られません。",
    "FEW": "数件分の通知を支払えます。スマホに警告が届く可能性があります。",
    "PLENTY": "多くの通知を支払えます。スマホに警告が届くと考えてください。",
    "UNKNOWN": "探査機は通知センターを読み取れませんでした。"
  },
  "readingRule": "探査機の読み取りは誤ることがあります。精度の高い探査機ほど誤りは少なくなります。",
  "local": {
    "title": {
      "build": "建設完了",
      "research": "研究完了",
      "ships": "艦船完成",
      "fleet": "艦隊が帰還"
    },
    "body": {
      "build": "{{world}}の{{name}}が完成しました。",
      "research": "{{name}}が完了しました。",
      "ships": "{{world}}で{{name}} ×{{count}}が完成しました。",
      "fleet": "艦隊が母星に帰還しました。",
      "unnamed": "{{world}}の注文が完了しました。"
    },
    "section": "このスマホでの注文リマインダー",
    "sectionBody": "注文が完了するとこのスマホに通知します。金庫の重水素は消費せず、このスマホでのみ設定します。",
    "switch": "注文の完了を通知する",
    "denied": "スマホが通知を許可していません。スマホの設定で Astera Online の通知を許可してください。",
    "blocked": "Astera Online の通知はスマホの設定でオフになっています。設定でオンにするまで通知は停止します。",
    "lateTitle": "通知が遅れることがあります",
    "late": "この許可がないと、Android が通知を最大1時間遅らせることがあります。注文の完了をすぐに知るには許可してください。",
    "allowExact": "時間どおりの通知を許可",
    "category": {
      "build": "建設",
      "research": "研究",
      "ships": "艦船",
      "fleet": "帰還する艦隊"
    }
  },
  "hours_one": "{{count}}時間",
  "hours_other": "{{count}}時間",
  "floor": "最低{{amount}}"
};
