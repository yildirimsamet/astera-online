/**
 * THE DISC AND EVERYTHING ON IT — the galaxy's own chrome, the commander sheet,
 * and the focus rail that answers "what is this, and what do I know about it".
 */

export const galaxy = {
  settlementAway: "{{world}}に向けて入植隊を派遣しました",
  deathStarAway: "{{world}}に向けてデス・スターが発射されました",
  /**
   * Its own key rather than a reuse of the server list's, because nothing is
   * shared between surfaces (D55): this one sits at 8px in the corner of the
   * disc and the other is a row in a list, and they are free to diverge.
   */
  online: "{{count}}人がオンライン",
  /** The same population over a day, so an off-peak galaxy still reads as inhabited. */
  onlineToday: "過去24時間に{{count}}人",
  worlds: "{{count}}個の惑星",
  fleetAway_one: " · 出航中の艦隊{{count}}隊",
  fleetAway_other: " · 出航中の艦隊{{count}}隊",
  rocks_one: " · 小惑星{{count}}個",
  rocks_other: " · 小惑星{{count}}個",
  pirates_one: " · 海賊{{count}}件",
  pirates_other: " · 海賊{{count}}件",
  wrecks_one: " · 残骸{{count}}件",
  wrecks_other: " · 残骸{{count}}件",
  targetOre: "{{amount}} 鉱石が残っています",
  targetResources: "{{amount}} リソースが残っています",
  targetMinutes: "{{count}} 分残り",
  asteroidShower: "小惑星群",
  asteroidShowerStatus: "出現数 ×{{multiplier}} · 残り{{remaining}}",
  intergalacticConvoy: "銀河間コンボイ",
  intergalacticConvoyStatus: "銀河を通過中 · 残り{{remaining}}",
  openIntel: "情報",
  /**
   * THE PLANET GLYPH IS A CAMERA MOVE NOW, AND THE SHEET HAS ITS OWN MARK. D163.
   *
   * `openWorlds` is gone with the tap that opened a list from a glyph that looked
   * like "go to my planet"; the list itself is the transfer sheet and is named
   * for what a commander opens it to DO.
   */
  goHome: "あなたの活動的な惑星を拡大してください",
  openTransfer: "あなたの世界間の転送",
  /* The two sensor switches under the disc readout. `aria-label` only. */
  showTelescope: "望遠鏡 リーチを表示",
  hideTelescope: "望遠鏡 リーチを非表示",
  showRadar: "レーダー リーチを表示",
  hideRadar: "レーダー リーチを非表示",
  eventsGuide: {
    open: "銀河イベントを表示",
    eyebrow: "ウィークリーカレンダー",
    title: "ギャラクシーイベント",
    intro: "平日と週末に繰り返されるウィンドウ。",
    timeZone: "トゥルキエ時間 (UTC+3)",
    nextLabel: "次のイベント",
    nextUpcoming: "{{event}} · {{duration}}",
    localTime: "ローカル · {{time}}",
    event: {
      ASTEROID_SHOWER: "小惑星シャワー",
      TRADE_SHIP: "貿易船",
      INTERGALACTIC_CONVOY: "銀河間コンボイ",
    },
    dailyNote: "平日は月曜日から金曜日、週末は土曜日から日曜日です。時間はトゥルキエ時間です。",
    days: {
      WEEKDAY: "平日",
      WEEKEND: "週末",
      EVERY_DAY: "毎日",
    },
    asteroid: {
      title: "小惑星シャワー",
      summary: "1 時間ごとに、過去 1 時間にプレイした司令官ごとに 1 つの小惑星が到着します。シャワーはその窓の効果を何倍にもします。既存の小惑星は有効期限が切れるまで残ります。",
    },
    trade: {
      title: "貿易船",
      summary: "銀河マップ上の船を選択して、必要な資源と交換します。",
      rate: "固定レート: 32 合金 = 16 クリスタル = 1 重水素。",
    },
    convoy: {
      title: "銀河間コンボイ",
      summary: "艦隊を航海中に送り、世界の生産を最大 4 時間行い、火力に応じて船を回収する機会を与えます。",
      note: "輸送船団は反撃しないため、艦隊は損失を被りません。各ワールドは、交差点ごとに 1 回攻撃できます。",
    },
  },
  /* Screen-reader names for the marks on the disc. Nothing is painted. */
  openResearch: "研究",
  openClan: "クラン",
  kindCapital: "首都",
  kindColony: "コロニー",
  kindNeutral: "ニュートラル T{{tier}}",
  /** A world nobody has surveyed. The only honest thing to print about it. D127. */
  /** What a remembered world's bottom line says: the record, and how old it is. D151. */
  recordAge: "記録 · {{age}}",
  unsurveyed: "未調査",
  owned: "あなたのもの",
  clanmate: "クランメイト",
  rival: "ライバル",
  recovery: "リカバリ違反",
  emp: "EMP ブラックアウト",
  claimOpen: "申請受付中",

  /** What a launch says as it leaves. */
  harvestAway: "回収艇{{count}}隻が航行中 · 残骸まで{{minutes}}分",
  miningAway: "{{count}} 離れて · {{minutes}}m で岩に出会う",

  panelPlanetEyebrow: "あなたの惑星",
  panelCommanderEyebrow: "司令官",
  panelIntelEyebrow: "あなたが知っていること",
  panelIntelTitle: "情報",

  commander: {
    galaxyLabel: "ギャラクシー",
    galaxyUnknown: "—",
    endsLabel: "シーズンは に終了します",
    endsUnknown: "—",
    wipeNote: "ワイプではすべての銀河がリセットされ、全員が再びスタートします。",
    signOut: "サインアウト",
  },
} as const;

/**
 * THE LIST OF WHAT YOU HOLD. T3.
 *
 * Its own namespace and not a reuse of `galaxy`'s world words: this surface names
 * a capital in a row you can press, and the disc names one in a caption. They are
 * free to diverge, and D55 says they must be able to.
 */
export const worlds = {
  eyebrow: "あなたの保有資産",
  title: "ワールド",
  /** Names the list itself, so the rows are not three unlabelled buttons. */
  list: "あなたの世界",
  active: "アクティブ",
  kindCapital: "首都",
  kindColony: "コロニー",
  craft_one: "{{count}} クラフト",
  craft_other: "{{count}} クラフト",
  bays: "ベイ",
  sendTitle: "クイック転送",
  /**
   * THE TWO ENDS OF ONE SENTENCE, AND THE BUTTON THAT COMMITS IT. D163.
   *
   * The labels are visually hidden — the arrow between the dropdowns says which is
   * which, and two words above two controls that already read `Kestrel-12 → Haven`
   * would be the interface writing out what it has just drawn. They stay for the
   * screen reader, where there is no arrow to see.
   */
  sendFrom: "から",
  sendTo: "へ",
  send: "転送",
  /** Screen-reader readings for the two pictures on a row. */
  store: "{{resource}}: {{amount}}/{{cap}}",
  baysReading: "{{used}}/{{total}} フライトベイが使用中",
  alloy: "合金",
  crystal: "クリスタル",
  deuterium: "重水素",
} as const;

export const focus = {
  /** The rail itself. */
  shellLabel: "{{title}} — フォーカス",
  clear: "選択をクリア",

  /** One known thing, with where it came from stamped on it. */
  unknown: "不明",

  planet: {
    transfer: "転送",
    settle: "入植する",
    settleNeedSlot: "入植 · 植民地の枠が満杯",
    settleNeedBay: "入植 · 飛行枠が満杯",
    settleNeedCourier: "入植 · クーリエが2隻必要",
    settleNeedAlloy: "入植 · 合金が不足",
    settleNeedCrystal: "入植 · クリスタルが不足",
    settleNeedFuel: "入植 · 重水素が不足",
    settleTooLate: "入植 · 期限までに到着できません",
    settleRecovering: "入植 · 出発地が復旧中",
    settleWhy: {
      recovering: "出発地が復旧中です。今は艦隊を発進できません。",
      colonyCore: "次の植民地には司令中枢レベル{{required}}が必要 · 現在{{current}}",
      colonyMax: "植民地の上限{{max}}に達しています。",
      flightBay: "すべての飛行枠が使用中です。艦隊が帰還してから派遣できます。",
      courier: "クーリエが{{need}}隻必要 · 現在{{have}}隻",
      alloy: "合金{{need}}が必要 · この惑星には{{have}}",
      crystal: "クリスタル{{need}}が必要 · この惑星には{{have}}",
      fuel: "重水素{{need}}が必要 · この惑星には{{have}}",
      tooLate: "ここからクーリエを送っても、入植期限に間に合いません。",
    },
    settlementConfirm: {
      eyebrow: "入植競争",
      title: "{{world}}に入植",
      unsurveyedTitle: "この惑星に入植",
      race: "有効なクーリエ2隻の艦隊を最初に到着させた司令官が、この惑星を獲得します。",
      noRecall:
        "入植艦隊は呼び戻せません。先に到着して入植できれば、創設費用を払い、そのティアに応じた資源を持つ植民地を得ます。ほかの司令官が先に入植した場合はクーリエと創設費用が戻りますが、使用した燃料は戻りません。",
      transports: "入植艦隊",
      foundingCost: "創設費用",
      opensWith: "入植後の資源",
      cargoValue: "{{alloy}} 合金・{{crystal}} クリスタル",
      stockValue: "{{alloy}} 合金・{{crystal}} クリスタル・{{deuterium}} 重水素",
      fuel: "飛行用燃料",
      arrives: "到着まで",
      closes: "入植期限まで",
      confirm: "入植艦隊を派遣",
      confirming: "派遣中…",
    },
    deathStar: "デス・スター",
    deathStarStrike: "デス・スター · EMPストライク",

    /**
     * THE SECOND BEAT ON A STRIKE. Owner report: *"yanlışlıkla"*.
     *
     * The most expensive single action a commander takes, consuming the weapon,
     * offered as one slab in a wrapped row of four whose neighbour is an ordinary
     * raid. It names the WORLD, because a mis-tap sends it to the wrong one, and
     * it states the outage rather than arguing for the rocket — the essay about
     * what a strike does belongs beside the forge that builds one.
     */
    strikeConfirm: {
      eyebrow: "戦術EMPストライク",
      title: "{{world}} の抑制",
      lead: "デス・スター がストライクにより消費されました。それを思い出すことはできず、何も取り戻すことはできません。",
      outage: "EMP ブラックアウト",
      keeps: "イージス が空のため、1 時間再生成できません。地上防御はオフラインのままであり、ダメージを受けません。コロニーは {{loss}} の忠誠心を失います。 {{loss}} 以下では離脱してニュートラルになります。",
      commit: "EMPの起動",
      loyalty: "コロニーへの忠誠心",
      loyaltyRead: "{{value}}% · {{hits}}",
      hits_one: "このヒットはかかります",
      hits_other: "{{count}} 件のヒット",
      loyaltyUnknown: "不明 — まず調べてください",
      charges: "インターセプター料金",
      chargesRead_one: "{{count}}料金・{{needed}}は必ず同時到着",
      chargesRead_other: "{{count}} 料金・{{needed}} は必ず一緒に到着する必要があります",
      chargesNone: "何もロードされていません",
      probeAge: "最後のプローブから · {{age}}",
    },
    deathStarUnavailable: "デス・スター の準備ができていません",
    deathStarProtected: "デス・スター · ターゲットは保護されています",
    deathStarOutOfBand: "デス・スター · 発達しすぎています",
    deathStarNeedBay: "デス・スター · フライトベイがいっぱいです",
    deathStarTooLate: "デス・スター · 到着が遅すぎます",
    deathStarNeedSlot: "デス・スター · コロニー スロットがいっぱいです",
    deathStarOriginRecovering: "デス・スター · 原点復帰中",
    kindCapital: "首都",
    kindColony: "コロニー",
    kindNeutral: "ニュートラル",
    capitalProtected: "奪えない資本",
    capitalProtectedHint:
      "デス・スター は イージス を空にし、その再生を 1 時間ブロックします。地上防御はオフラインのままであり、ダメージを受けません。",
    /**
     * WHAT A CAPITAL IS WHILE THE WEAPON IS OFF. `STRATEGIC_CRAFTING_ENABLED`.
     *
     * `capitalProtectedHint` above is the flag-ON sentence and stays exactly as
     * written for the day it flips back. This is the same slot said in the rules
     * a commander can currently reach: a raid, loot, and a world that never moves.
     */
    capitalRaidOnlyHint:
      "襲撃にはリソースだけが必要です。首都は、そこに何が着陸しても決して所有者を変えることはありません。",
    capitalRecovering: "資本回収中・回収不可",
    capitalRecoveringHint:
      "別の EMP 攻撃により、1 時間の鎮圧が再開されます。コントロールはまだ変更できません。",
    capitalEmp: "EMP の資本",
    capitalEmpHint: "イージス は空で、地上防御はオフラインであり、1 時間の EMP が終了するまで無敵です。",
    yourCapital: "あなたの保護された首都",
    yourColony: "あなたのコロニー",
    transferHint: "クラフトとリソースをここに移動し、どの船が戻るかを選択してください。",
    transferRoute: "ワールド転送",
    transferOrigin: "原点",
    transferTarget: "ターゲット",
    transferFrom: "から {{origin}}",
    transferCraft: "クラフト準備完了",
    transferPrepare: "艦船と資源を選ぶ",
    transferRecovering: "出発元の惑星は回復中です",
    colonyRoute: "植民地を作る手順",
    claimOpen: "入植競争が開催中",
    settlementInFlight: "入植艦隊が飛行中",
    claimRaceExplain: "まだ誰の惑星でもありません。条件を満たすクーリエ2隻が最初に到着した司令官のものになります。",
    colonySlots: "植民地枠{{used}}/{{total}}",
    routeRaid: "決定的な襲撃に勝つ",
    routeRaidDetail: "戦闘艦で攻撃し、すべての防衛艦とシールドを破壊します。",
    routeClaim: "入植競争が自動的に始まる",
    routeClaimDetail: "ここでは艦船も資源も送る必要はありません。決定的な襲撃だけで公開の入植競争が始まります。",
    routeSettle: "入植艦隊を派遣",
    routeSettleDetail: "この段階で初めて入植用の艦船と資源を送ります。条件を満たす艦隊が最初に到着すれば勝利です。",
    routeSettleInFlightDetail: "あなたの入植艦隊は飛行中です。条件を満たす艦隊が最初に到着すれば勝利です。",
    raidFleetBadge: "襲撃艦隊",
    raidFleetExplain:
      "襲撃画面で戦闘艦を選び、すべての防衛艦とシールドを破壊します。この段階ではクーリエ、入植用の資源、植民地枠は必要ありません。",
    automaticBadge: "自動",
    automaticExplain:
      "決定的な襲撃によって入植競争が自動的に始まります。この段階で別の艦船や資源を送る必要はありません。",
    settlementAwayBadge: "飛行中",
    settlementAwayExplain:
      "クーリエ2隻と入植用の資源が出航しました。呼び戻せません。条件を満たす艦隊が最初に到着すれば、この惑星を入植できます。",
    claimCloses: "{{duration}}で閉じる",
    claimRaidStillOpen:
      "もう一度襲撃できますが、入植競争の期限は延長されません。",
    openColonySlot: "コロニースロット",
    colonySlotExplain:
      "入植艦隊を出す段階でだけ必要です。艦隊の出航時に、首都の司令中枢が未使用の植民地枠を提供している必要があります。",
    captureColonySlotExplain:
      "植民地の設立には必要ですが、攻撃には不要です。デス・スター攻撃で所有権は移りません。",
    openFlightBay: "空き発進枠1つ",
    flightBayExplain:
      "入植艦隊を出す段階でだけ必要です。クーリエ2隻の片道飛行は、中立惑星に到着するまで発進枠を1つ使います。",
    courierCount: "クーリエ2隻",
    haulerExplain:
      "入植用のクーリエは、襲撃で競争が始まってから別に派遣します。襲撃そのものには不要です。",
    foundingAlloy: "{{amount}} 合金",
    foundingAlloyExplain:
      "合金{{amount}}は植民地の設立時に消費されます。入植競争に負けた場合は返還されます。襲撃の費用ではありません。",
    foundingCrystal: "{{amount}} クリスタル",
    foundingCrystalExplain:
      "クリスタル{{amount}}は植民地の設立時に消費されます。入植競争に負けた場合は返還されます。襲撃の費用ではありません。",
    settlementFuel: "{{amount}} 重水素",
    settlementFuelExplain:
      "クーリエ2隻は入植時の片道飛行で重水素{{amount}}を消費します。必要量は距離によって変わります。",
    settlementArrivalExplain:
      "入植艦隊の飛行時間は{{duration}}です。入植競争の終了前に到着する必要があり、条件を満たす最初の艦隊が勝ちます。",
    arrivesIn: "到着まで{{duration}}",
    deathStarRoute: "デス・スター攻撃の効果",
    /** The clock a defender is racing, named for what runs out at the end of it. */
    recoveryBreach: "回復中・惑星の機能停止",
    empBreach: "EMP停止中・地上防衛は無効",
    occupationProtected: "占領保護",
    protectedFor: "あと{{duration}}は攻撃も占領もできません。",
    firstImpact: "イージスの残量がゼロ・EMPは{{duration}}続きます",
    firstImpactColony: "植民地の忠誠度も{{loss}}低下します。忠誠度が{{loss}}以下になると離脱して中立になります。",
    secondImpact: "EMP終了・防御復帰",
    deathStarReadyRequirement: "デス・スターの準備完了",
    deathStarReadyExplain:
      "攻撃には、発進元の惑星で完成済みのデス・スターが待機している必要があります。",
    /**
     * WHAT THE CLOCK ACTUALLY COSTS, WHERE THE DEFENDER IS LOOKING AT IT. D179.
     *
     * It read "land a ship here or this colony stops being yours" until D179
     * removed the drop. There is nothing to race any more, so the line states the
     * real price instead — the world produces nothing and can launch nothing — and
     * says the one thing a struck commander most needs to hear.
     */
    recoveryDropWarning:
      "停止はあと{{duration}}続きます。その間は資源を生産できず、艦隊も発進できません。惑星の所有権はあなたのままで、艦隊も損傷しません。",
    empWarning:
      "EMPはあと{{duration}}続きます。イージスは回復せず、地上防衛設備は攻撃も被弾もしません。",

    eyebrow: "{{owner}} が保有",
    location: "ワールド · {{planet}}",
    /** A world outside every reach and never probed. It has no other name. D127. */
    unsurveyedEyebrow: "世界・未調査",
    unsurveyedTitle: "ここを見たことがありません",
    /* Paired side by side on the rail, so the verb is the label and the cost is
       its own micro line. See `ProbeControl`. */
    /**
     * A WORLD THAT CANNOT BE RAIDED YET. D183.
     *
     * Names the CLOCK rather than the rule: "Protected · 4h" is something a
     * commander can plan against, where "that commander is new" is trivia about
     * somebody else. One label for both sources of the state — an occupation window
     * and a first-day shield mean the same thing to a raider.
     */
    /**
     * THE HALF OF THE BAND FOG CAN PROVE. D168 · D127.
     *
     * The short form rides the control and must be ONE LINE — about 129px at
     * 350. The long form is the accessible name, where there is room to say why.
     * Both state only "too developed": the "too weak" direction cannot be proved
     * from a fogged disc, so it stays with the server's refusal.
     */
    attackOutOfBandShort: "発達しすぎています",
    attackOutOfBand:
      "その司令官はあなたよりもさらに成長しています - レイドは最大でも 1 層に及びます",
    attackProtected: "保護中 — この世界はまだ襲撃できません",
    attackProtectedShort: "保護されています · {{duration}}",
    attackShort: "攻撃を計画する",
    probeShort: "プローブ",
    probeCoolingShort: "{{duration}} のプローブ",
    attack: "攻撃を計画する",
    attackNeutralAgain: "再びレイド · 主張は変更されていない",
    attackOriginRecovering: "攻撃・原点回復",
    attackShipyardRevolt: "攻撃不可・造船所の反乱",
    attackShipyardRevoltShort: "造船所 の反乱",
    radiationHere: "放射線雲: ここにいるすべての船は 1 分間に船体の {{pct}}% を失います。 20%を超えると修理ステーションを待ちます。",
    radiationShelter: "放射線雲の中ですが、避難所の下にあります。ここの船は線量を受けません。",
    windowOpen:
      "彼らの艦隊は家にいません。これがゲーム全体のウィンドウです。",
    distance: "距離",
    reach: "あなたの到達範囲",
    reachUnknown: "—",

    headlineFleetAway: "艦隊を離れてください",
    headlineFleetHome: "艦隊帰郷",
    headlineVeiled: "ベールド",
    headlineProbed: "プローブ済み {{age}}",
    headlineFought: "{{age}} と戦いました",
    headlineNone: "情報なし",

    installTelescope: "望遠鏡 をインストールします",
    watchSlot: "ウォッチ・スロット {{slot}}",
    replaceSlot: "スロット {{slot}} · {{target}} を置き換えます",
    watching: "{{target}} を見ています",
    sendProbe: "プローブを送る · {{alloy}} 合金 · {{crystal}} クリスタル",
    probeAway: "プローブを実行します · {{duration}} でレポートを返します",
    /*
      ONE LOOK PER WORLD PER HOUR (D121). The control says which world is closed
      and for how long, rather than letting the player spend the tap to find out.
    */
    probeCooling: "ここを見ました · {{duration}} の別のプローブ",
    markRival: "マークライバル",
    rivalMarkedAction: "ライバル",
    rivalMarked: "{{commander}} があなたのライバルになりました。",
    rivalCleared: "{{commander}} はライバルとしてマークされなくなりました。",
    rivalHeading: "今シーズンのあなたのストーリー",
    rivalMarkedBadge: "マークされたライバル",
    rivalEncounters: "出会い",
    rivalYourRaids: "あなたの襲撃",
    rivalTheirRaids: "彼らの襲撃",
    rivalDominion: "ドミニオン",
    rivalDominionValue: "+{{gained}} · −{{lost}}",
    rivalLastContact: "最後の連絡先 {{age}}",
    rivalProbeOnly:
      "あなたはこの世界を見てきましたが、どちらの側もまだ発砲していません。",
    rivalNoContact:
      "あなたはこの指揮官をマークしました。あなたの間の最初の動きはまだ待っています。",
    rivalAhead:
      "あなたはエッジを握っています。彼らはあなたから取り戻せるドミニオンをもっと持っています。",
    rivalBehind: "彼らは優位性を保っています。借金はまだ残っています。",
    rivalEven:
      "あなたとの間の台帳は均衡しています。次の出会いがそれを打ち破る。",
    rivalFeud: "{{count}} との遭遇により、これは 1 回の襲撃以上のものになりました。",
    rivalPurpose:
      "この司令官とあなたの共有シーズン記録をピン留めします。戦闘ボーナスや知力ボーナスは得られません。",
  },

  asteroid: {
    eyebrow: "レベル{{level}}の小惑星",
    title: "通過中の小惑星",
    summaryOre: "鉱石{{amount}}",
    summaryAnomaly: "鉱石{{amount}} · 同位体反応あり",
    working_one: "{{count}}隻が採掘中 · {{state}}",
    working_other: "{{count}}隻が採掘中 · {{state}}",
    stateReturning: "帰還中",
    stateInbound: "向かっています",
    noCraft: "惑星にプロスペクターがいません",
    tooLate: "到着する前に小惑星が通過します",
    researchNeeded: "先に同位体分光分析を研究してください",
    /**
     * THE MINUTE AFTER A TRIP THAT COST NOTHING. D183.
     *
     * The wait is the whole message, so the wait is the whole sentence — a rail
     * that spent a line explaining the rule would be a paragraph doing a design's
     * job. Where the rule came from belongs in the docs, not on the control.
     */
    resting: "艦船の休息中 · {{duration}}",
    send: "{{count}}隻を派遣 · {{duration}}",
    oreLeft: "残りの鉱石",
    leavesIn: "通過まで",
    composition: "組成",
    compositionValue: "クリスタル{{percent}}%",
    compositionUnknown: "同位体の組成は不明",
    compositionIsotope: "クリスタル{{crystal}}% · 重水素{{deuterium}}%",
    deuteriumRoute:
      "プロスペクターを派遣すると重水素を回収できます。帰還後は生産施設に届くので、貯蔵庫へ回収してください。",
    speed: "採掘速度",
    speedValue: "{{rate}}/分",
    spill:
      "生産施設の空きは残り{{room}}です。この採掘分の約{{lost}}は帰還時に失われます。先に資源を回収してください。",
    taken: "すでに誰かが{{amount}}を採掘しました。",
    untouched: "まだ手つかずです。最初に到着した艦船が、積める分を採掘できます。",
    // "{{total}} between them" is nonsense about a single craft, in either language.
    fleetLine_one: "{{count}}隻のプロスペクターが惑星に待機 · 積載量{{hold}}",
    fleetLine_other:
      "{{count}}隻のプロスペクターが惑星に待機 · 1隻あたり{{hold}} · 合計{{total}}",
    derrickPitch:
      "軌道に<0>{{name}}</0>を建設すると、1隻あたりの積載量が<1>{{hold}}</1>になり、到着も早まります。",
    intercept:
      "艦船は{{reach}}後に到着します。小惑星の通過まで残り{{spare}}です。",
  },

  craftPicker: {
    label: "派遣する艦船の数",
  },

  debris: {
    eyebrow: "残骸",
    titleUnknown: "残骸フィールド",
    titleOver: "{{planet}}上空の残骸",
    summarySalvage: "回収可能な資源{{amount}}",
    working_one: "{{count}}隻が回収中 · {{state}}",
    working_other: "{{count}}隻が回収中 · {{state}}",
    stateReturning: "帰還中",
    stateInbound: "向かっています",
    noCraft: "惑星に派遣可能な艦船がありません",
    tooLate: "到着する前に残骸が消滅します",
    resting: "艦船の休息中 · {{duration}}",
    send: "{{count}}隻を派遣 · {{duration}}",
    alloyLeft: "残りの合金",
    crystalLeft: "残りのクリスタル",
    deuteriumLeft: "残りの重水素",
    goneIn: "消滅まで",
    yourHold: "船倉容量",
    spill:
      "生産施設の空きは残り{{room}}です。回収分の約{{lost}}は帰還時に失われます。先に資源を回収してください。",
    body: "ここで誰かが艦隊を失いました。残骸は消えつつあり、誰でも見えます。最初に到着した艦船が、積める分を回収できます。",
  },

  run: {
    eyebrowHome: "帰還中",
    eyebrowSalvage: "残骸回収中",
    eyebrowOutbound: "出航中",
    title_one: "{{count}}隻のプロスペクター",
    title_other: "{{count}}隻のプロスペクター",
    homeIn: "帰還まで",
    reachesIn: "到着まで",
    meetsRockIn: "小惑星に到着するまで",
    target: "目標",
    targetWreck: "{{planet}}上空の残骸",
    targetWreckAnon: "惑星上空の残骸",
    targetDecayed: "残骸フィールドは消滅しました",
    targetRock: "レベル{{level}}の小惑星",
    targetRockGone: "小惑星は通過しました",
    carrying: "{{alloy}} 合金と {{crystal}} クリスタルを搭載。",
    carryingDeuterium:
      "{{alloy}} 合金、{{crystal}} クリスタル、{{deuterium}} 重水素を搭載。",
    emptySalvage:
      "到着時には残骸がすでに回収されていました。何も積まずに帰還します。",
    emptyRock: "到着時には小惑星がすでに採掘されていました。何も積まずに帰還します。",
    salvageNote:
      "残骸は動かず、誰でも見えます。{{clock}}最初に到着した艦船が、積める分を回収できます。",
    salvageClock: "あと{{duration}}で消滅します。",
    miningNote:
      "小惑星の現在地ではなく、到着時にいる位置へ向かいます。最初に着いた艦船が、積める分を採掘できます。",
  },

  thread: {
    eyebrowProbeHome: "探査機が帰還中",
    eyebrowProbeOut: "探査機が出航中",
    eyebrowFleetHome: "艦隊が帰還中",
    eyebrowFleetOut: "艦隊が出航中",
    arrivesIn: "到着まで",
    craft: "艦船",
    craftUnknown: "—",
    returning: "帰還中です。追加の操作はありません。",
    outbound: "出航した艦隊は呼び戻せません。",
  },

  contact: {
    eyebrowBattle: "襲撃が始まっています",
    eyebrowInbound: "この艦船はあなたの惑星に接近中です",
    eyebrowSalvage: "誰かが残骸を回収中です",
    eyebrowMining: "誰かが採掘中です",
    eyebrowProbe: "誰かが偵察しています",
    eyebrowMoving: "誰かが動いています",
    titleUnknown: "不明",
    eyebrowUnknown: "未確認の動きがあります",
    unknownHint:
      "望遠鏡の視界外です。視界に入ると艦船の種類が分かり、艦隊なら艦種と隻数も確認できます。",
    /**
     * RADAR L5 NAMES THE KIND WITHOUT NAMING THE CRAFT.
     *
     * The top of the ladder, paying out on ordinary traffic rather than only on a
     * raid aimed at you. It has to say WHERE the reading came from, or the panel
     * would be claiming sight it does not have — and the fog hides, never lies.
     */
    radarKind: "レーダーは{{kind}}と判定しています。この距離では詳細は分かりません。",
    titleBattle: "攻撃中",
    titleFleet: "艦隊",
    titleProbe: "探査機",
    titleMining: "採掘中",
    titleHarvest: "残骸回収中",
    titleDeathStar: "デス・スター",
    titlePirate: "海賊船団",
    eyebrowPirate: "海賊が出没",
    boundaryPirate:
      "海賊とその艦船は確認できますが、出発地と軌道は分かりません。見えているのは現在位置だけです。",
    working: "作業中",
    craftCount: "{{count}}隻",
    /**
     * A SILHOUETTE, NOT A ROSTER. D123.
     *
     * The panel used to name every hull in somebody else's squadron, which is what
     * Radar L4 and L5 are sold for. What a stranger reads now is roughly how much
     * is out there — and the word chosen has to make clear it is an estimate, or
     * the interface is quietly claiming a precision the payload does not have.
     */
    massLight: "小型艦隊",
    massMedium: "中型艦隊",
    massHeavy: "大艦隊",
    massHint: "この距離で分かるのは艦隊の規模だけです。艦種と隻数は不明です。",
    inboundHint:
      "レーダーは保有惑星のどれかが狙われていると検知しています。到着時刻は別の警報で通知されます。",
    bombarding: "砲撃",
    settling: "入植中",
    unattributed: "所属不明",
    arrivalUnknown: "到着時刻不明",
    inboundNoClock: "保有惑星に接近中 · 到着時刻不明",
    craftLabel: "艦船",
    craftUnknown: "—",
    statusLabel: "ステータス",
    statusLanded: "到着済み",
    arrivesIn: "到着まで",
    arrivesUnknown: "不明",
    boundaryBattle:
      "その惑星の上空で艦隊が攻撃中です。望遠鏡の視界内なら艦種と隻数が見えますが、所有者、出発地、勝敗は不明です。",
    boundarySalvage:
      "残骸フィールドと消滅までの時間は誰でも確認できます。回収艦の経路と持ち帰る量は見えません。",
    boundaryMining:
      "発見した小惑星の位置と通過までの時間は確認できます。採掘艦の経路と回収量は公開されません。",
    boundaryFleet:
      "望遠鏡の視界内なら艦種を識別でき、艦隊の構成と隻数も分かります。所有者、出発地、目的地は分かりません。",
    boundaryUnknown:
      "動きだけが見えています。艦船の種類、規模、所有者、出発地、目的地は分かりません。",
    telescopeHint:
      "惑星を観測すると、艦隊が駐留中か出航中か分かります。出航中は防衛の隙を狙える可能性があります。",
    wreckHint:
      "残骸は誰でも確認できます。まもなく両艦隊の残骸が軌道上に残り、誰でも回収に向かえます。",
  },
} as const;

/**
 * KORSAN FİLOLARI — the third thing in the galaxy worth flying at. D150.
 *
 * Every line here has to make the RULE visible: the level, the handicap it buys,
 * the deadline and the odds of towing a ship home. A rule the player cannot see is
 * not a usable rule (D124), and this is the only surface any of them appear on.
 */
export const pirate = {
  title: "海賊船団",
  /** Level and callsign together. The callsign is season-unique and leaks no index. */
  name: "海賊船隊L {{level}} - {{callsign}}",
  level: "レベル{{level}}",
  eyebrow: "レベル{{level}}の海賊",
  /** The one combat modifier in the feature, stated as a number the player can price. */
  damagePenalty: "この艦隊が与えるダメージは{{percent}}%減少します",
  /** Opens the same commitment sheet a raid on a world opens. D150. */
  attack: "攻撃",
  yourFleet: "艦隊",
  atHome: "{{count}} 自宅",
  fewer: "より少ない{{name}}",
  more: "その他の{{name}}",
  quantity: "{{name}}さんの人数",
  max: "{{name}}ごとに送信",
  maxShort: "マックス",
  noShipsAtHome: "この世界には送る船がありません。",
  eyebrowUnknown: "身元不明の連絡先",
  pickShips: "少なくとも1隻の船を選択してください",
  fuelCost: "重水素{{amount}}個の燃料",
  noFuel: "往復に十分な重水素がありません",
  noBay: "フリーフライトベイがありません",
  tooSlow: "一番遅い船に追いつくことができません",
  roster: "乗組員",
  rosterUnknown: "この範囲では乗組員は不明です",
  unknownContact: "身元不明の連絡先",
  mass: "質量",
  leavesIn: "そのまま残します",
  reach: "{{duration}}で届きます",
  reachLabel: "到着まで：",
  /**
   * WHAT THE CREW IS WORTH, ON THE SHEET'S OWN AXIS. D183.
   *
   * "Strength" rather than "value": both numbers on the comparison a tap later are
   * resource value, and a rail that named the unit would be explaining arithmetic
   * where the player only needs to know which figure is bigger.
   */
  strengthLabel: "火力",
  tooLate: "それはあなたがそれに到達することができる前にエリアを離れる",
  unreachable: "この世界では何もそれを捕まえることはできませんでした",
  alreadyRaiding: "この世界にはすでに襲撃があります",
  outOfSight: "センサーにはありません",
  noShips: "自宅に船がありません",
  captureHint: "決定的な勝利は、乗組員から1隻の船を手に入れる可能性があります",
  captured: "{{hull}}を捕獲しました",
  captureMissed: "牽引する価値のあるものは何も残っていません",
  send: "{{count}}・{{duration}}を送信",
  outbound: "進水した艦隊はリコールできません。",
  /**
   * YOU CANNOT SEE THIS ONE — WHICH IS NOT THE SAME AS "THIS IS OLD". D160.
   *
   * The line says what the faded craft on the disc says: no circle of yours covers
   * it, and it is here because you identified it once. The figures are still
   * current — an orbit is solvable and the crew is the lane's live state, exactly
   * as a rock you have found keeps reporting its remaining ore.
   */
  remembered: "あなたがそれを識別したので追跡されました·今はあなたのセンサーではありません",
  /** The boundary, stated — the same job the contact panel's last line does. */
  boundary:
    "あなたが特定した海賊は、あなたが見つけた岩のように、死ぬか時間がなくなるまでこのリストに残ります。その軌道は解決可能なので、トラックと乗組員の数を範囲外に保ちます。あなたが失うのは目であり、痕跡ではありません。",
  hoardHint: "持ち帰ったものは、持ち込んだホールドによって制限されます。",
} as const;
