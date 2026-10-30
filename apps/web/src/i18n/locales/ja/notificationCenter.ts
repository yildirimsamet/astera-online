export const notificationCenter = {
  "title": "通知センター",
  "eyebrow": "スマホ通知",
  "menuHint": "攻撃が着弾する前にスマホへ通知します。",
  "menuEmpty": "金庫不足",
  "lead": "レーダーが接近中の攻撃を捉えると、ゲームを閉じていてもセンターがスマホに通知を送ります。通知1件ごとに、センターの重水素金庫から支払われます。",
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
    "incoming_strategic": "接近中のデス・スター。攻撃通知の1.5倍の料金です。",
    "probe_detected": "あなたのワールド上空で探査機を検知。すぐに送信されます。"
  },
  "installTitle": "Androidアプリで利用できます",
  "installBody": "スマホ通知には Astera Online アプリが必要です。インストールしてこのアカウントでログインし、センターを建設してください。",
  "install": "Google Play で入手",
  "buildCost": "建設コスト",
  "buildFrom": "選択中のワールド「{{world}}」から支払います。一度建てればすべてのワールドが対象です。",
  "buildShort": "選択中のワールドの資源が足りません。別のワールドを選ぶか、待ってください。",
  "build": "センターを建設",
  "wallet": "金庫",
  "covers_one": "このタイミングで攻撃通知{{count}}件分",
  "covers_other": "このタイミングで攻撃通知{{count}}件分",
  "empty": "金庫では次の攻撃通知を支払えません。重水素を追加するまで通知は送信されません。",
  "unfunded_one": "直近24時間で{{count}}件の通知が送信されませんでした（金庫不足）。",
  "unfunded_other": "直近24時間で{{count}}件の通知が送信されませんでした（金庫不足）。",
  "transferTitle": "重水素を追加",
  "transferFrom": "{{world}}から。貯蔵量：",
  "amount": "送る重水素",
  "transfer": "送る",
  "alerts_one": "{{count}}件",
  "alerts_other": "{{count}}件",
  "all": "全部",
  "confirmTitle": "重水素{{amount}}を送りますか？",
  "confirmBody": "金庫の重水素はワールドに戻せません。通知にのみ使われます。",
  "confirm": "{{amount}}を送る",
  "back": "戻る",
  "walletAfter": "送金後の金庫",
  "timingTitle": "通知のタイミング",
  "timing": {
    "T3": "3分前",
    "T5": "5分前",
    "T15": "15分前",
    "RADAR": "レーダー捕捉時"
  },
  "timingRule": "攻撃が着弾するまでの分数です。早い通知ほど高くなります。レーダーが艦隊を捉えるのが遅れた場合は、捉えた時点で送信します。",
  "kindsTitle": "有料通知",
  "recentTitle": "最近の通知",
  "status": {
    "PENDING": "待機中",
    "SENT": "送信済み",
    "UNFUNDED": "金庫不足",
    "CANCELLED": "請求なし",
    "NO_DEVICE": "端末なし"
  },
  "rulesTitle": "通知のしくみ",
  "ruleRadar": "通知はレーダーが捉えた艦隊にだけ送られます。レーダーが捉えなければ通知はありません。",
  "ruleRecall": "通知の送信前に攻撃が呼び戻された場合、料金はかかりません。",
  "ruleShort": "金庫で支払えない場合、通知は送信されず、ここに「金庫不足」と表示されます。",
  "ruleInGame": "ゲーム内の警告は引き続き無料です。",
  "priceRule": "攻撃通知の料金は、全ワールドの重水素生産量の一定時間分です。最低料金の方が高い場合は最低料金になります。あなたの生産量：毎時{{rate}}。",
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
    "section": "このスマホへの無料通知",
    "sectionBody": "注文が完了するとこのスマホに通知します。無料で、このスマホでのみ設定します。",
    "switch": "注文の完了を通知する",
    "denied": "スマホが通知を許可していません。スマホの設定で Astera Online の通知を許可してください。",
    "blocked": "Astera Online の通知はスマホの設定でオフになっています。設定でオンにするまで通知は停止します。",
    "late": "通知が数分遅れて届くことがあります。",
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
