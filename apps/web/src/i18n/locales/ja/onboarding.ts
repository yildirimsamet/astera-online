/**
 * THE REHEARSAL — ninety seconds of the real game, before there is an account.
 *
 * Every line is a beat, and every beat is a thing the player is about to DO. None
 * of them explains a system: the copy names what to look for and gets out of the
 * way, because the beat only advances when the thing actually happens.
 *
 * The house style holds here as hard as anywhere — consequence first, never a
 * system name, and never a paragraph where a clause will do.
 */
export const country = {
  label: "国",
  choose: "国を選ぶ",
  searchLabel: "国名を検索",
  searchPlaceholder: "国名で検索",
  list: "国の一覧",
  confirm: "この国を選ぶ",
  change: "変更",
  saved: "国が更新されました",
} as const;

export const onboarding = {
  /** The one-line caption over the disc while the galaxy is being looked at. */
  beats: {
    wide: {
      title: "{{shard}}",
      line: "この銀河では実際のプレイヤーが活動しています。各惑星には持ち主がいて、見える船はその人たちの艦隊です。",
      action: "自分の惑星を見る",
    },
    yours: {
      title: "この星はあなたのものです",
      line: "{{name}}は保護されたあなたの首都です。資源を生産し、敵を調べ、防衛を築き、船を建造できます。惑星をタップしましょう。",
    },
    briefing: {
      title: "ゲームの流れは4段階",
      line: "資源を生産し、敵を調べ、惑星を守ります。準備ができたら艦隊を派遣しましょう。強化するたびに、このどれかが有利になります。",
      action: "最初の一歩へ",
      mapGrow: "生産",
      mapIntel: "調査",
      mapDefend: "防衛",
      mapReach: "派遣",
      mapOutcome: "調べる · 決める · 派遣する",
    },
    fog: {
      title: "まず学び、リスクは後から",
      line: "ほかの惑星をタップしましょう。レベルは見えても、資源や船、防衛は隠れています。先に情報を集め、攻撃するか判断しましょう。",
    },
    fogAlone: {
      title: "まだ他に誰もいません",
      line: "{{shard}}はまだ参加者を受け入れています。他の司令官の資源や防衛を知るには情報収集が必要です。",
      action: "わかりました",
    },
    core: {
      title: "まずレベル制限を上げてください",
      line: "司令中枢は格納庫以外の施設のレベル上限を決めます。行を開き、レベル2の効果と費用を確認してください。その後、強化を待機列に追加します。",
    },
    refinery: {
      title: "合金をもっと作る",
      line: "合金精錬所は毎時合金を生産します。多くの建物や船に必要です。項目をタップしてレベル2をキューに追加しましょう。",
    },
    extractor: {
      title: "クリスタルを作りましょう",
      line: "クリスタル採掘所は毎時クリスタルを生産します。強力な船や情報装置に必要です。項目をタップしてレベル2をキューに追加しましょう。",
    },
    fleet: {
      title: "船を2隻建造",
      line: "「艦隊」で{{ship}}の項目を開き、「最大」を選んで2隻ともキューに入れましょう。この高速艦で敵を偵察し、攻撃できます。",
    },
  },

  /** Always reachable: skip to claim, or leave for an existing account. */
  skip: "スキップ",
  haveAccount: "すでに指揮官がいます",

  /** The wall, at the one moment the player wants something. */
  claim: {
    eyebrowName: "最後のステップ",
    headingName: "司令官の名前を選択",
    lineName: "4件の指示を準備しました。{{name}}を確保すると、実際の建設時間が同時に動き始めます。",
    nameLabel: "司令官名",
    next: "続行",

    eyebrowPassword: "あと一歩",
    headingPassword: "{{name}}のパスワードを設定",
    linePassword: "別の端末で同じ司令官にログインする際に、このパスワードを使います。",
    passwordLabel: "パスワード",
    submit: "惑星を確保する",
    working: "司令官を作成中…",
    back: "戻る",
  },

  /** What the beats could not deliver, said plainly rather than swallowed. */
  trouble: {
    noFrontier: "現在、すべての銀河が満員です。次のシーズンまで練習を開始できません。",
    unreachable: "銀河に到達できませんでした。",
    retry: "もう一度試してください",
    /** One or more replayed decisions were refused once the server ran them. */
    partial: "惑星を作成しました。一部の準備した注文を開始できませんでした。現在の生産待ち一覧を確認してください。",
  },
} as const;
