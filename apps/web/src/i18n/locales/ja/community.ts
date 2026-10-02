export const community = {
  announcements: {
    eyebrow: "アステラコマンドより",
    title: "お知らせ",
    empty: "まだ発表はありません。チームからの最新情報がここに表示されます。",
    new: "新規",
  },
  feedback: {
    eyebrow: "ダイレクトチャンネル",
    title: "フィードバック",
    intro: "Astera チームに、何が壊れたのか、何がゲームを改善するのか、またはすでに適切だと感じていることを伝えてください。",
    kindLabel: "フィードバックタイプ",
    kinds: { bug: "バグ", suggestion: "アイデア", praise: "賛美" },
    messageLabel: "あなたのメッセージ",
    placeholder: "何が起こったのか、何を見てみたいのか説明してください…",
    remaining: "{{count}} 文字残っています",
    send: "フィードバックを送信する",
    sending: "送信中…",
    sent: "受信しました。アステラの造形にご協力いただきありがとうございます。",
  },
  admin: {
    eyebrow: "オペレーション",
    title: "管理パネル",
    menuLabel: "管理パネル",
    menuHint: "お知らせを公開し、フィードバックを読み、Shopier の注文を承認します",
    tabsLabel: "管理ツール",
    composeTab: "お知らせ",
    feedbackTab: "フィードバック",
    perfTab: "パフォーマンス",
    skinsTab: "スキン",
    grantIntro: "Shopier の命令を確認したら、メモに記載されている指揮官にその命令を与えます。同じ注文番号を再度送信しても安全です。二度許可されることはありません。",
    grantCommander: "司令官",
    grantCommanderHint: "注文メモ内の名前",
    grantItem: "見てください",
    grantPick: "選択してください…",
    grantBundle: "エレメンタルセット・4ルック",
    grantOrder: "買い物客の注文番号。",
    grantSubmit: "助成金",
    granting: "許可…",
    grantResults: "結果",
    grantDone: "許可されました",
    grantOwned: "すでに所有しています",
    grantNoAccount: "{{name}} という名前の司令官はありません。注文メモに記載されているお名前をご確認ください。",
    perfIntro: "録音を開始し、このシートを閉じて再生します。停止すると、1 秒あたり 1 つのサンプルがサーバーに送信されます。",
    perfStart: "録音開始",
    perfStop: "停止して送信",
    perfRecording: "録音中",
    perfSending: "送信中…",
    perfSent: "サーバーに保存されました",
    perfFailed: "送信できませんでした。記録は保存されます。",
    perfRetry: "再送信",
    perfFpsAvg: "平均 fps",
    perfFpsLow: "最低 5% fps",
    perfHitches: "ヒッチ (>50 ミリ秒)",
    perfFreezes: "フリーズ (>250 ミリ秒)",
    perfJankMax: "最長ストール",
    perfCalls: "描画コールの平均/ピーク",
    perfTriangles: "三角峰",
    perfHeap: "メモリ開始→終了（ピーク）",
    perfNetwork: "リクエスト/データ",
    perfWorst: "最悪の瞬間",
    perfRec: "REC",
    securityNote: "HTML はサーバーによって再度フィルタリングされました。スクリプト、イベント ハンドラー、インライン スタイル、フォーム、および YouTube 以外の埋め込みは拒否されます。",
    titleLabel: "タイトル",
    titlePlaceholder: "タイトルを更新",
    contentLabel: "コンテンツ",
    toolbarLabel: "アナウンスのフォーマット",
    tools: {
      bold: "太字", italic: "イタリック体", heading: "見出し", bullets: "リスト", quote: "見積もり",
      link: "リンク", image: "画像", video: "YouTube",
    },
    linkPrompt: "リンク URL を貼り付けてください",
    imagePrompt: "HTTPS 画像 URL を貼り付けます",
    videoPrompt: "YouTube ビデオの URL を貼り付けます",
    previewLabel: "ライブプレビュー",
    previewHint: "プレーヤーが受け取るのと同じセーフ レンダラー",
    mobilePreview: "モバイル · 360 ピクセル",
    desktopPreview: "デスクトップ · 720 ピクセル",
    previewUntitled: "お知らせタイトル",
    publish: "発表の公開",
    publishing: "公開…",
    published: "お知らせが公開されました。",
    feedbackEmpty: "プレイヤーからのフィードバックはまだ届いていません。",
  },
  donate: {
    eyebrow: "Astera Online 開発をサポート",
    title: "サポート Astera Online",
    menuLabel: "寄付する",
    menuHint: "ゲームをサポートします",
    /*
      THE ASK, IN THE DEVELOPER'S OWN VOICE.

      Written first in Turkish by the person who pays these bills, and carried
      into English rather than re-pitched: it is one human saying what the game
      costs him, not a storefront. The four paragraphs answer four questions in
      order — who funds it, what it costs, why it matters now, where the money
      goes — and `noPressure` is the one that keeps the sheet from being a demand.
    */
    intro: "私は Astera Online を完全に自分で構築しており、投資や収入はありません。",
    costs: "サーバー、AI、ドメイン、その他すべての技術コストは毎月、自腹で出ています。私は今仕事をしていないので、それらの請求書が私に重くのしかかり始めています。",
    appeal: "Astera Online を愛し、それが成長し続けることを望んでいるのであれば、たとえ少額の寄付であっても、私にとっては本当に大きな意味があります。 ❤️",
    impact: "あなたが提供したものは、ゲームのサーバーと開発コストに直接当てられ、私がゲームを構築し続けるのが容易になります。",
    supportLead: "ゲームをサポートしたい場合:",
    noPressure: "それができない場合でも、まったく問題ありません。プレイしたり、友人にそれについて話したり、フィードバックを送信したりすることも、本当の貢献です。 🪐",
    cryptoHeading: "暗号",
    cryptoTrc20: "USDT・TRC-20",
    cryptoSolana: "ソラナ",
    copy: "コピー",
    copied: "コピーされました",
    /*
      TWO CONTROLS THAT READ "Copy" ARE ONE CONTROL TO A SCREEN READER.

      The visible word stays short because the plate above it already names the
      network; the accessible name has to carry that name too, and it has to
      CHANGE with the state — otherwise the confirmation is visible only to
      players who can see it.
    */
    copyLabel: "{{label}} アドレスをコピー",
    copiedLabel: "{{label}} アドレスがコピーされました",
    cardHeading: "買い物客",
    cardLabel: "{{amount}} TL でのサポート",
    cardNote: "各カードにより、Shopier の安全な支払いページが新しいタブで開きます。",
  },
} as const;
