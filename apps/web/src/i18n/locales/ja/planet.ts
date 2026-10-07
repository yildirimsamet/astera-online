/**
 * YOUR OWN WORLD — the four decision groups, the rows they are made of, the
 * detail sheet behind each row, and the launch planner.
 */

export const planet = {
  recovery: "復旧中 · {{duration}}後に機能が戻ります",
  empActive: "EMP · イージスは0になり、{{duration}}の間再生できません。地上防衛は攻撃も被弾もできません。",
  capacityNext: "{{name}}あり：惑星ごとに{{total}}基",
  /**
   * THE COUNTER TO THE THING ABOVE. T10 · T12.
   *
   * Its own block rather than a `deathStar` sub-key: they are two controls on two
   * different tabs, and the day either is reworded the other must not move with
   * it. `docs/interface.md` I1 — every requirement is a door and names itself.
   */
  interceptor: {
    eyebrow: "戦略兵器迎撃砲台",
    tally: "{{used}}/{{total}}発を装填済み",
    none: "迎撃弾は未装填",
    building: "装填中 · {{duration}}",
    paused: "復旧中は装填が一時停止します",
    ready: "装填済み：{{count}}発",
    noRadar: "装填済み · レーダー迎撃範囲は停止中",
    build: "迎撃弾を装填",
    started: "迎撃弾の装填開始",
    hint: "レーダーの迎撃範囲に入るか、望遠鏡で確認された最初のデス・スターを破壊します。発射すると消費されます。",
    colonyHint: "突破したデス・スター1基につき、この植民地の忠誠度は{{loss}}低下します。忠誠度が{{loss}}以下になると離脱します。",
    readyHint:
      "装填済み。レーダーの迎撃範囲に入るか、望遠鏡で確認された次のデス・スターを破壊します。",
    noRadarHint:
      "迎撃弾は装填済みですが、この惑星のレーダー迎撃範囲は使えません。アップリンクとレーダーL3を復旧してください。別の惑星の望遠鏡が標的を捉えれば発射できます。",
    needRadar: "レーダー L{{level}}",
    needUplink: "軌道上のアップリンク",
    needOperational: "惑星の機能が稼働中",
    buildTime: "{{duration}} · 迎撃弾1発 · 発射時に消費",
    buildSecond: "2発目を装填",
  },

  deathStar: {
    eyebrow: "戦術EMP兵器",
    tally: "{{used}}/{{total}}基を保有",
    none: "この惑星にデス・スターはありません",
    building: "建造中 · {{duration}}",
    paused: "復旧中は建造を一時停止します",
    ready: "発射可能",
    stock: "{{ready}}基発射可能 · {{building}}基建造中 · {{held}}/{{capacity}}",
    build: "建造",
    started: "デス・スターの建造を開始",
    dangerHint: "EMP：イージスは0になり、1時間再生できません。その間、地上防衛は攻撃も被弾もできません。植民地の忠誠度も{{loss}}低下し、{{loss}}以下になると離脱して中立になります。",
    readyHint:
      "発射可能：敵のイージスを0にし、地上防衛を1時間停止させます。停止中は攻撃も被弾もできません。",
    needCore: "司令中枢L{{level}}",
    needShipyard: "造船所 L{{level}}",
    needOperational: "惑星の機能が稼働中",
    buildTime: "{{duration}} · 兵器1基 · 呼び戻し不可",

    needs: "{{need}} が必要です",
  },
  tabs: {
    label: "惑星のカテゴリ",
    defendProblem: "防衛",
    defendQuestion: "シールド、貯蔵庫、地上砲を強化します。",
    orbitProblem: "情報",
    orbitQuestion: "ライバルを確認するのに役立つツールを構築します。",
    reachProblem: "艦隊",
    reachQuestion: "ここで船を開発し、範囲を広げます。",
    growProblem: "生産",
    growQuestion: "資源生産と建物のレベル上限を伸ばします。",
    tacticalProblem: "戦術",
    tacticalQuestion: "ここで戦術ツールを構築および管理します。",
  },


  queue: {
    /** The end of all the work in one lane, which no screen used to carry. */
    waiting: "待機中",
    ends: "{{time}}に完了",
    segment: "{{name}} · {{duration}}",
    cancelOne: "{{name}}をキャンセル",
    title: "建設キュー",
    idle: "建設中の注文はありません",
    capacity: "各{{count}}枠",
    construction: "建設",
    yard: "造船所",
    repair: "修理",
    slotFree: "空き",
    empty: "進行中の作業はありません",
    committing: "確定中…",
    staged: "受け取り後に開始",
    queued_one: "{{count}}件の注文を追加しました",
    queued_other: "{{count}}件の注文を追加しました",
    unitsQueued_one: "{{count}}基を製造キューに追加しました",
    unitsQueued_other: "{{count}}基を製造キューに追加しました",
    afterQueue: "待機列の後",
    cancel: "キャンセル",
    cancelling: "キャンセル中…",
    refund:
      "返金：{{alloy}}合金・{{crystal}}クリスタル・{{deuterium}}重水素",
    cancelled:
      "注文をキャンセルしました · 合金{{alloy}}、クリスタル{{crystal}}、重水素{{deuterium}}を返却",

    /**
     * THE SECOND BEAT ON A CANCEL. Owner report.
     *
     * The price of cancelling was on a `title` attribute — a hover tooltip, on a
     * phone — so the half that burns was not merely unconfirmed, it was never on
     * screen at all. It leads with what is DESTROYED: a refund figure alone reads
     * as a gain, because the player is being handed resources.
     */
    confirm: {
      eyebrow: "注文をキャンセルする",
      lead: "注文費用の{{share}}%を失います。残りはすぐに返却されます。",
      lost: "失う資源",
      kept: "返却される資源",
      progress: "進んだ作業も失われ、再注文すると最初からやり直しです。",
      commit: "注文をキャンセル",
      back: "注文を残す",
    },
  },

  capacity: {
    hangarBand: "艦隊の収容枠",
    hangarFull: "格納庫が満杯です：{{used}}/{{total}}枠を使用中。船を増やすには格納庫を拡張してください。",
    hullUse:
      "1基あたり{{bulk}}枠を使用 · キュー完了後は{{used}}/{{total}}枠を使用",
    full: "空きがありません：{{used}}/{{total}}枠を使用中。先に収容上限を増やしてください。",
  },

  /** What each structure is for, in one line, where the row states it. */
  roles: {
    vault:
      "各資源の貯蔵量を生産時間で決めます。下位10%は最大8時間分の生産量まで襲撃から守られます。",
    shipyard:
      "上位の船を解放し、建造を速め、送り出す探査機の精度を高めます。",
    refinery:
      "時間あたりの合金生産量を増やします。貯蔵庫の容量も生産時間に連動して増えます。多くの建物と船に合金が必要です。",
    extractor:
      "時間あたりのクリスタル生産量を増やします。貯蔵庫の容量も生産時間に連動して増えます。上位の船、装置、研究に必要です。",
    coreCapped_one:
      "司令中枢を上げるまで、建物{{count}}件をアップグレードできません。",
    coreCapped_other:
      "司令中枢を上げるまで、建物{{count}}件をアップグレードできません。",
    coreClear:
      "司令中枢は建物のレベル上限を決め、建設と研究の時間を短縮します。",
  },

  defend: {
    escapeMinimum: "戦術的撤退には戦闘艦が最低{{minimum}}隻必要 · 現在{{count}}/{{minimum}}隻",
    strategicBand: "戦略的防御",
    strategicNote:
      "迎撃弾1発で、レーダーL3の範囲に入るか望遠鏡で確認された次のデス・スター1基を破壊します。発射時に消費されます。",
    /** Taktik geri çekilme: the defender's own threshold and the fuel it takes. */
    escapeReady:
      "戦術的撤退 · 火力{{at}}以上でこの防衛線を全滅させる襲撃から、船は退避します · 重水素{{fuel}}を消費",
    escapeShort:
      "戦術的撤退には重水素{{fuel}}が必要ですが、備蓄は{{stock}}です。火力{{at}}以上の襲撃から退避できません。",
    shieldBand: "シールド",
    shieldNote:
      "イージスは船や地上砲へのダメージを先に吸収し、毎時最大値の35%を再生します。",
    groundBand: "地上防衛（司令中枢のレベルで収容上限が増加）",
    /* The figures moved into `CapacityBar`; the band keeps the RULE. */
    groundNote:
      "地上砲は惑星から移動できません。ソーンは防壁型、ハープーンは機動型、バスティオンは突撃型に有利です。",
    thornNone:
      "防壁型に有利な軽砲。突撃型には弱いです。",
    thornStanding:
      "配備数{{count}} · 防壁型に有利、突撃型に不利",
    thornGain: "ソーン",
    harpoonNone: "突撃型の地上砲。機動型に有利、防壁型に不利です。",
    harpoonStanding: "配備数{{count}} · 機動型に有利、防壁型に不利",
    harpoonGain: "ハープーン",
    bastionNone:
      "突撃型に有利な重砲。機動型には弱いです。",
    bastionStanding:
      "配備数{{count}} · 突撃型に有利、機動型に不利。戦闘後、破壊された地上砲の60%が切り捨てで復元されます。",
    groundGain: "地上ユニット",
    aegisPointer: "シールドは装置です。<0>{{name}}</0>は軌道タブにあります。",
  },

  orbit: {
    contextLabel: "軌道ネットワーク",
    networkBand: "接続",
    networkNote:
      "アップリンク は、望遠鏡 と レーダー のロックを解除するために 1 つのソケットを消費します。",
    intelBand: "プラネット計器",
    intelNote: "彼らはレベルを上げますが、軌道ソケットを消費することはありません。",
    inOrbitBand: "軌道上",
    inOrbitNote: "それぞれがスロットを取得します。一度構築すると、レベルはありません。",
    onPlanetBand: "惑星上で",
    onPlanetNote:
      "スロットは必要ありません。これらにはレベルがあり、司令中枢 が許す限りレベルを上げてください。",
    slotsFree_one: "{{count}} スロットはまだ上に空きがあります",
    slotsFree_other: "{{count}} スロットは上記でまだ空きがあります",
    slotsNone: "軌道は満杯です",
    slotsUsed: "{{used}}/{{total}}",
    slotsNext: "+1 コア L{{level}}",
    rackLabel: "オービットスロット",
    slotEmpty: "空",
    inactiveSatellite:
      "所有されていますが、司令中枢 がこの軌道スロットを再度開くまで非アクティブです。",
    inactiveUplink:
      "L{{owned}} は所有されていますが、アップリンク が再びアクティブになるまで非アクティブです。",
    inactiveCore:
      "L{{owned}} が所有されています。L{{active}} は、司令中枢 が復元されるまでアクティブです。",
    alreadyInOrbit: "はすでに軌道上にいます",
  },

  reach: {
    orbitBand: "運用衛星",
    orbitNote:
      "採掘櫓 は、この世界の探鉱者を改善します。 ビーコン は艦隊の襲撃と転送を高速化します。各衛星は 1 つの軌道スロットを使用します。",
    family: {
      OFFENSIVE: {
        label: "攻撃用船体",
        note: "レイダーはスピードを買い、ストライカーは攻撃を買います。行は Tier 1 から Tier 4 まで続きます。",
      },
      DEFENSIVE: {
        label: "防御船体",
        note: "要塞はスピードとともに耐久性を高めます。護衛は艦隊のテンポを維持します。行は層ごとに実行されます。",
      },
      CARGO: {
        label: "貨物船体",
        note: "非武装で貿易ルートを輸送すると、船倉容量に対して速度が低下し、生き残った護衛が必要になります。",
      },
      SPECIALIST: {
        label: "スペシャリスト船体",
        note: "目に見える問題に対する限定的な回答。彼らのプレミアムは間違ったターゲットに対して無駄にされています。",
      },
    },
    frontierBand: "フロンティア研究",
    frontierNote:
      "研究は指揮官全体のキューを使用します。 Construction と Yard は別々に実行され続けます。",
    isotopeName: "同位体分光分析",
    isotopeTag: "重水素マイニングのロックを解除します",
    isotopeRole:
      "同位体岩石中の重水素を表示し、探鉱者をそこに送ることができます。帰還貨物は工場に入ります。",
    denseName: "高密度燃料電池",
    denseTag: "ランナーのロックを解除します",
    denseRole:
      "それを明らかにするには、戦利品がターゲットに残っている間に、1 回の襲撃で貨物を積み込みます。ランナーはホーラーよりも速いですが、運ぶものは少なくなります。",
    graviticName: "重力電荷",
    graviticTag: "ブリーチャーのロックを解除します",
    graviticRole:
      "ロックを解除するには、アクティブな イージス で防御されたワールドを攻撃します。シールドは少なくとも {{share}} のダメージを吸収する必要があります。単一の Wasp が資格を得ることができます。勝つ必要はありません。ブリーチャーはシールドを 5 倍強く攻撃します。",
    gridName: "インターセプトグリッド",
    gridTag: "デス・スターを撃墜",
    gridRole:
      "装填されたチャージは、レーダー 3 によって検出された次の デス・スター または 望遠鏡 サイトで識別された次の デス・スター を破壊します · アップリンク が必要です",
    stockpileName: "戦略的備蓄",
    stockpileTag: "2 番目の武器をパッド上に保持します",
    stockpileRole:
      "2 番目の デス・スター、最初の デス・スター の後に構築されました。待機時間は変わりません。",
    waspDoctrineName: "ワスプ・ドクトリン",
    lanceDoctrineName: "突撃型/ブリーチャー・ドクトリン",
    bulwarkDoctrineName: "防壁型 ドクトリン",
    groundDoctrineName: "定位置原則",
    generalName: "武器と防具",
    generalTag: "所有するすべての船体を改善します",
    doctrineTag: "攻撃力と装甲が向上",
    doctrineRole:
      "クラスおよび一般ボーナスはスタックしますが、それらを合わせた戦闘倍率は 25% に制限されます。クラスカウンターの方が依然として大きな利点があります。",
    yardName: "ヤードオートメーション",
    yardTag: "艦船の建造が速くなる",
    yardRole:
      "すべての船体の建造時間を短縮します。造船所 は依然として曲線を設定します。",
    holdsName: "プロスペクター船倉",
    holdsTag: "マイニングクラフトはもっと運ぶ",
    holdsRole: "プロスペクター船倉の研究で積載量が増え、採掘櫓の2倍ボーナスも乗算されます",
    cargoName: "貨物倉",
    cargoTag: "ホールドごとにさらに多くのものが含まれます",
    cargoRole: "レイド戦利品、世界転送、貿易輸送船団を同様に調達します",
    synthesisName: "重水素の合成",
    synthesisTag: "製油所の天井を上げる",
    synthesisRole:
      "各段は、保持しているすべてのワールドでさらに 3 つの 重水素精製所 レベルを開きます",
    researchNeedCore: "司令中枢 を L{{level}} に上げます",
    researchAct: "研究",
    researchComplete: "調査済み",
    researchAt: "{{duration}}で研究可能",
    researchIsotopeFirst: "同位体分光分析の最初の研究",
    researchDenseFirst: "高密度燃料電池を最初に研究",
    researchGraviticFirst: "まずは重力電荷を研究してください",
    researchWarAt: "戦争法が{{duration}}で開幕",
    researchCargoInsight: "戦利品が残っている間に 1 回の襲撃で貨物を詰める",
    researchShieldInsight:
      "イージス にレイドダメージの少なくとも {{share}} を吸収させます",
    warshipsBand: "軍艦",
    warshipsNote: "これらの船体は攻撃と防御を行います。クラスマッチアップにより、どのターゲットに対抗するかが決まります。",
    supportBand: "サポート",
    supportNote:
      "ホーラーとランナーは襲撃または輸送貨物を運びますが、攻撃することはできません。それらは戦闘船体が生き残っている間のみ保護され続けます。",
    miningBand: "マイニング",
    miningNote: "探鉱者は、露出した小惑星または破片地帯にのみ移動し、収穫物を工場に戻します。",
    ownedGain: "あなたは持っています",
    hullAwayCount: "{{count}}離れています",
    hullLocationCounts: "{{home}} 入力 · {{away}} 出力",
    hullTier: "Lv{{tier}}",
    prospectorLimit: "{{owned}} / {{max}}・制限",
  },

  grow: {
    multiplierBand: "量産衛星",
    multiplierNote:
      "鋳造所 は、この世界の合金、結晶、重水素の生産量を 6% 増加させ、共有軌道ネットワーク内の 1 つのソケットを消費します。",
  },

  projectSheet: {
    frontier: "フロンティア研究",
    complete: "研究完了",
    cost: "研究費",
    once: "指揮官全体の研究キューに 1 回配置されます。",
  },

  /** Why a row cannot be pressed yet. Each is a door, so each names its fix. */
  blocked: {
    core: "コア L{{level}}",
    uplink: "軌道上の アップリンク",
    orbitSlot: "空き軌道スロット",
    shipyard: "造船所 L{{level}}",
    research: "{{research}} {{level}}",
    requirements: "必要条件：{{requirements}}",
    maxed: "最高レベルに到達しています",
    /** The one building with a second ceiling: its research rung. T5. */
    plantRung: "重水素合成のもう一段の研究",
    queueFull: "すでに 3 件の注文が待機中です。これを追加するには、1 つを終了またはキャンセルします。",
  },

  /** What a purchase says once it has landed. */
  done: {
    raised: "{{name}} は L{{level}} になりました",
    instrument: "{{name}} オンライン (L{{level}})",
    satellite: "{{name}} は軌道上にあります",
    built: "{{count}} × {{name}} 構築",
    researched: "{{name}} 完了",
    queued: "{{name}} L{{level}} キューに登録されました",
    queuedSimple: "{{name}} がキューに登録されました",
    unitsQueued: "{{count}} × {{name}} キューに登録されました",
  },

  buildSheet: {
    eyebrowGround: "地上防衛・惑星から移動しません",
    eyebrowMobile: "移動可能な艦船",
    howMany: "建造数",
    fewer: "{{name}}を減らす",
    more: "{{name}}を増やす",
    quantity: "{{name}}の建造数",
    max: "{{name}}を上限まで選ぶ",
    maxShort: "最大",
    /* The way back down from Max, in one press. */
    reset: "{{name}}の数を戻す",
    resetShort: "戻す",
    build: "{{count}}を建造",
    capped:
      "すでに保有上限の{{count}}に達しています。出航中の艦船も数に含まれるため、追加で建造できません。",
    heldOfMax: "上限{{max}}のうち{{owned}}を保有。出航中も数に含まれます。",
    defenceAfter: "完成後にこの惑星を守るユニット：{{count}}",
    maxOf: "上限・{{value}}",
    byPurse: "資源が足りる数まで",
    byHangar: "格納庫の空き枠まで",
    byGround: "地上設備の空き枠まで",
    byBerth: "停泊枠の空きまで",
    cycle: "艦種の相性",
    yardFill: "造船キュー{{used}}/{{total}}",
    standing: "駐留戦力{{value}}",
  },
} as const;

/** The ladder behind one row: what this thing becomes. */
export const itemSheet = {
  coreTierGuide: "コアレベルと惑星ティア",
  coreTierCurrent: "コア Lv{{level}} → ティア {{tier}}",
  coreTierRule: "コアレベルが3上がるごとに惑星ティアが1上がります。強調された行が現在のティアです。",
  coreTierLevel: "コアレベル",
  coreTierPlanet: "惑星ティア",
  coreTierRange: "Lv{{from}}–Lv{{to}}",
  eyebrowNotInOrbit: "軌道上にありません",
  eyebrowInOrbit: "軌道上",
  eyebrowNotInstalled: "未設置",
  eyebrowLevel: "レベル{{level}}",
  actPutInOrbit: "軌道上に設置",
  actAlreadyInOrbit: "軌道上に設置済み",
  actInstall: "設置",
  actRaise: "レベル{{level}}に強化",
  lockedNote: "未開放・{{reason}}が必要です。",
  /** The explanation, one tap deeper than the role. */
  howItWorks: "仕組み",
  ladderHeading: "各レベルで得られる効果",
  rungLevel: "L{{level}}",
  /** Where the render next changes: the anticipation hook. */
  nextLook: "L{{level}} の新しい外観",
  /** The construction queue the order joins, as it stands. */
  queueFill: "建設キュー{{used}}/{{total}}",
  /** The primary, when the price is not met yet. */
  affordIn: "あと約{{duration}}で資源が足ります",
  short: "資源が足りません",
  orbitalDoesHeading: "機能",
  orbitalOnce: "一度だけ建設できます · レベルは上げられません",
  orbitalFree: "軌道枠の空き{{free}}/{{total}}",
  slotHeading: "軌道枠",
  slotAfter_one: "点線の枠を使います。残りの空きは{{count}}枠です。",
  slotAfter_other: "点線の枠を使います。残りの空きは{{count}}枠です。",
  nextSlotCore: "司令中枢レベル{{level}}で次の枠が開きます。",
  orbitalNoSlot: "空き枠がありません · 司令中枢レベル{{level}}で次の枠が開きます",
  orbitalNoSlotMax: "空き枠がありません · 司令中枢で開く枠はすべて使用中です",
} as const;

/** The row. One decision, presented as a decision. */
export const upgradeRow = {
  about: "{{name}}について",
  nextTierAlt: "次のティアの{{name}}",
  becomes: "は",
  /** Where a ladder ends, so one rung of it can be judged against the whole. */
  ceiling: "/{{value}}",
  affordableIn: "現在のレートで <0>{{duration}}</0> でお手頃価格",
  /**
   * HOW LONG THE WORK ITSELF TAKES — a different clock from `affordableIn`.
   *
   * That one is a property of the wallet and only ever appeared when the player
   * was SHORT; this is a property of the item and shows whether or not they can
   * pay. A commander who can already afford a Citadel used to get no clock at all,
   * which is precisely when the wait is the only thing left to decide.
   */
  takes: "{{duration}}",
  takesLabel: "ビルドには {{duration}} がかかります",
  /** A row whose level has a top: research ladders are the only ones so far. T12. */
  ladder: "L{{level}} / {{max}}",
} as const;

/** The control at the right-hand edge of every row. */
export const action = {
  verbRaise: "レベルアップ",
  verbBuild: "建造",
  verbInstall: "設置",
  verbClaim: "回収",
  verbSend: "派遣",
  short: "不足",
  shortfallAlloy: "合金あと{{amount}}",
  shortfallCrystal: "クリスタルあと{{amount}}",
  shortfallDeuterium: "重水素あと{{amount}}",
  shortfallJoin: "と",
  shortfallLabel: "不足・{{parts}}が必要",
  statAttack: "攻撃",
  statHull: "耐久性",
  statSpeed: "速度",
  statSpeedFixed: "固定",
  statCargo: "積載量",
  statCargoNone: "—",
  /** What a Garbage Collector lifts off its battle's wreck. It takes the Cargo cell. D200. */
  statSalvage: "サルベージ",
  statRoom: "占有量",
  statFuel: "燃料",
  /** The rate carries its own span: the row form of the strip prints no labels. */
  statFuelRate: "{{value}} /1k",
  statFuelNone: "—",
} as const;

/** The portrait and the three verdicts at the top of your own planet. */
export const planetHero = {
  capital: "首都",
  colony: "植民地",
  /**
   * THE WORLD'S OWN TIER, UNDER ITS PORTRAIT. Owner report.
   *
   * The figure the whole galaxy is sorted by — the disc draws a world's size
   * from it, every dossier states it, and since D168 it decides who a commander
   * may fight. It was on screen everywhere EXCEPT a commander's own worlds.
   */
  tier: "ティア {{tier}}",
  /** The one force unit, on the one world the commander knows exactly. D199. */
  firepower: "火力",
  perHourSuffix: "/h",
  /** E5: the orbit line under the world — "Orbit 1/2 · +1 at Core L15". */
  orbit: "軌道",
  disrupted: "生産停止・襲撃・{{countdown}}",
  defence: "防御",
  defenceNone: "なし",
  defenceShips_one: "{{count}}隻の船",
  defenceShips_other: "{{count}}隻の船",
  defenceGuns_one: "地上砲{{count}}基",
  defenceGuns_other: "地上砲{{count}}基",
  defenceUnarmed_one: "防衛線に非武装輸送船{{count}}隻",
  defenceUnarmed_other: "防衛線に非武装輸送船{{count}}隻",
  defenceDocked_one: "修理ステーションに{{count}}隻 · 防衛しない",
  defenceDocked_other: "修理ステーションに{{count}}隻 · 防衛しない",
  fleetAway: "飛行中{{count}}隻",
  shield: "シールド",
  shieldNone: "なし",
  shieldNoAegis: "イージスなし",
  shieldOffline: "オフライン",
  shieldCoreOffline: "司令中枢停止 · イージス停止",
  defenceCoreOffline: "地上砲停止 · 司令中枢の故障",
  shieldValue: "{{current}} / {{max}}",
  shieldMeter: "イージスのシールド残量",
  shieldRegen: "+{{amount}}/h · 船より先に吸収",
  vaultSafe: "貯蔵庫で保護中",
  storeLabel: "貯蔵庫",
  storeRule: "貯蔵庫 レベルは、これらのバーの長さを設定します。シールドの下のブラケットは襲撃から安全です。",
  alloyStore: "{{cap}} 合金の {{held}}、{{safe}} 保護",
  crystalStore: "{{held}} の {{cap}} クリスタル、{{safe}} 保護",
  deuteriumStore: "{{held}} の {{cap}} 重水素、{{safe}} 保護",
  alloySafe: "{{amount}} 合金金庫",
  crystalSafe: "{{amount}} クリスタル金庫",
  deuteriumSafe: "{{amount}} 重水素安全",
  atRisk: "危険にさらされています",
  atRiskValue: "{{amount}} が公開されました",
  /** E5 production row: how full the store is, and the part the Vault keeps from a raid. */
  storeShare: "貯蔵庫 {{pct}}%",
  safeShare: "安全 {{pct}}%",
  storeFull: "貯蔵庫がいっぱい",
} as const;

/** The commitment. Everything here is supporting detail for one line. */
export const launch = {
  /** When the world is covered again, under the exposure: the mock's "Dönüş 23:06". */
  fuel: "燃料",
  eyebrow: "攻撃",
  /**
   * THE EYEBROW OF A COMMITMENT AGAINST A RECORD. D151.
   *
   * This sheet is where a fleet stops being recallable, and it named only the
   * action. A target under a live Telescope and a target last seen three days ago
   * opened the identical screen, so the age of the thing being bet on — which the
   * dossier had stamped on every fact row for two releases — was absent from the
   * one surface where it decides anything.
   */
  lastSeen: "最後に見たのは {{age}}",
  /**
   * A PIRATE'S CREW AND ORBIT ARE CURRENT even after Telescope discovery is
   * remembered. The urgent clock is how long the target will still be out there.
   */
  goneIn: "残り{{duration}}で消滅",
  back: "戻る",
  launching: "発進中",
  commit: "発進 · 呼び戻し不可",
  /** A raid on a world, which may be turned once while it flies (K8); a pirate raid keeps `commit`. */
  commitWorld: "発進",
  /** B14: the held commit, and the price line under the ships (K8: a world raid turns). */
  holdWorld_one: "{{count}}隻を発進",
  holdWorld_other: "{{count}}隻を発進",
  holdPirate_one: "{{count}}隻を発進 · 呼び戻し不可",
  holdPirate_other: "{{count}}隻を発進 · 呼び戻し不可",
  warningWorld: "艦隊が帰還するまで{{duration}}の間、{{world}}の防衛が薄くなります。",
  warningPirate: "呼び戻し不可。帰還するまで{{duration}}の間、{{world}}の防衛が薄くなります。",
  recallNote:
    "飛行中に一度だけ呼び戻せます。帰還には往路で経過した時間と同じだけかかります。燃料は返還されません。",
  chooseFleet: "艦隊を選択してください",
  send: "{{count}}隻を派遣",
  launched: "発進しました。{{duration}}の間、防衛が薄くなります · 残留{{count}}ユニット。",
  whileAway: "この艦隊が不在の間",
  defending: "{{count}} ユニットがホームを防衛",
  nothingSent: "まだ船を選んでいません",
  exposedFor: "防衛が薄い時間：{{duration}}",
  oneWayUnknown: "—",
  pace: "飛行速度",
  paceHint: "遅く飛ぶほど到着が遅くなり、帰還も同じ速度です。燃料は同じで、各区間は12時間を超えられません。",
  paceFull: "フル",
  /* The five reasons this commitment can be refused, each stated on the button. */
  noBay: "飛行枠に空きがありません",
  noFuel: "重水素が足りません",
  tooLate: "先になくなります",
  /** Nothing standing at this world is fast enough to catch it. */
  unreachable: "この惑星の艦船では追いつけません",
  /** Something could — just not the slowest ship in this selection. */
  tooSlow: "速度の遅い艦船を外してください",
  /** A raid at a world has to be able to shoot back. The server refuses this too. */
  noEscort: "戦闘艦を追加してください",
  shipyardRevolt: "造船所の反乱",
  cargo: "積載量",
  /** A ceiling on a wreck nobody has made yet, and only for collectors that live. D200. */
  salvage: "ガベージコレクターが生き残れば、残骸から最大{{amount}}を回収します",
  atHome: "この惑星に{{count}}隻",
  away: "{{fleet}}は出航中です。この惑星に駐留する艦船だけを派遣できます。",
  awaySeparator: " · ",
  awayHull: "{{count}} {{name}}",
  fewer: "{{name}}を減らす",
  more: "{{name}}を増やす",
  quantity: "{{name}}の隻数",
  max: "{{name}}をすべて選ぶ",
  maxShort: "最大",
  noShips:
    "自宅に船がありません。造船所で建造するか、艦隊が戻ってくるのを待ちます。",
  warning:
    "これはリコールできません。一旦出発すると、そこに何があったのかを知る唯一の方法は、着陸するのを見ることです。そして、それが戻ってくるまで、あなたの惑星は {{count}} ユニットを保持します。",
  /**
   * WHAT A RAID COSTS THE COMMANDER FOR THE REST OF THE DAY. D183.
   *
   * One sentence beside the exposure warning, because the two are halves of one
   * price. It says what is spent and what that opens — not how the rule works,
   * which is the sheet's own shape rather than a paragraph's job.
   */
  shieldWarning:
    "これにより、開始時のシールドが放棄されます。それがなくなると、他の指揮官もあなたを襲撃することができます。",
  /** The same price, on the window a heavy defeat bought rather than on the first day. */
  recoveryShieldWarning:
    "これにより、回復シールドとその +50% の出力が放棄されます。それがなくなると、他の指揮官もあなたを襲撃することができます。",
  radiationLethal_one: "このルートの放射線により、{{count}} 船が到着前に破壊されます。とにかくホールドして送信します。",
  radiationLethal_other: "このルートの放射線により、{{count}} 隻が到着前に破壊されます。とにかくホールディングは彼らを送ります。",
  radiationHpOutbound: "往路の放射線：1隻あたり {{hp}} HP。",
  radiationHpReturn: "帰還する船はさらに {{hp}} HP の損傷を受けます。",
  radiationHpHome: "帰還します。",
  radiationHpStays: "目的地に残ります。",
  radiationHpDose: "飛行中の放射線：1隻あたり {{hp}} HP。",
  radiationHpHealth: "{{count}}× {{hull}} · HP {{health}}% · {{hp}} / {{max}} HP",
  radiationHpDock: "着陸後に Repair Station が必要です。",
  radiationHpFree: "着陸時に無料で修理されます。",
  radiationHpCombat: "戦闘で追加の損傷を受ける可能性があります。",
  radiationDock: "ルートは放射線を横断します: 各船は船体の ~{{pct}}% を占めます。 20% 以上が修理ステーションで待機しています。",
  radiationPatched: "ルートは放射線を横断します。各船は船体の ~{{pct}}% を占め、着陸時にパッチが外れます。",
  fleetsave: "飛行中の船は襲撃されませんが、惑星は襲撃される可能性があります。",
  range: "範囲 {{d}}",
  arrive: "到着",
  homeLabel: "戻る",
  exposedShort: "公開された {{duration}}",
  lootSub: "戦利品 ~{{band}}",
  bay: "フライトベイ",
  bayThis: "これには 1 がかかります",
  bayNone: "空きなし",
  stays: "ステイホーム",
  staysUnits_one: "{{count}}ユニット",
  staysUnits_other: "{{count}} ユニット",
  staysPower: "パワー {{value}}",
  cargoEach: "{{amount}} 貨物各",
  cargoAdds: "+{{amount}} 貨物",
  paceBrief: "同じ燃料・最長12時間",
  warningWorldOpen: "艦隊が帰還するまで{{world}}の防衛は手薄になります。",
  warningPirateOpen: "呼び戻し不可。艦隊が帰還するまで{{world}}の防衛は手薄になります。",
} as const;

export const transfer = {
  /** What the flight burns, beside the figure. T6. */
  fuel: "飛行用燃料",
  cooldown: "荷下ろし中・残り{{duration}}",
  homewardFuel: "自分の惑星間の移送は燃料が半分です。攻撃では通常量を消費します。",
  /** Under the pace rungs: what a slower TRANSFER buys — time in the air. */
  paceHint: "低速なら到着が遅くなり、飛行中の艦船は襲撃されません。戻る艦隊も同じ速度で帰還します。燃料は同じで、各区間は最長12時間です。",
  fuelShort: "{{short}}不足",
  eyebrow: "惑星間移送",
  returnEta: "出発元への帰還まで{{duration}}・到着時刻{{time}}",
  eta: "到着予定時刻",
  capacity: "積載量",
  fleet: "艦船",
  homeDefence: "出発元に残る艦船{{ships}}隻・火力{{power}}",
  afterDelivery: "配達後",
  cargoShips: "輸送艦",
  otherShips: "その他の艦船",
  stay: "移送先に残る",
  return: "出発元へ戻る",
  returnHint: "帰還する艦船は資源を降ろしてから出発元へ戻ります。帰路の燃料は今支払います。",
  cargo: "資源",
  alloy: "合金",
  crystal: "クリスタル",
  deuterium: "重水素",
  commit: "移送を開始",
  /** B14: what stops a transfer, on the held commit rather than a grey button. */
  noRoom: "移送先の格納庫に空きがありません",
  overLoad: "積載量を超えています",
  sending: "派遣中",
  launched: "移送艦隊が出航しました・到着まで{{duration}}",
  /** The recall rule and the two limits on what moves. Faz 2A.4 made "one way" false. */
  rules: "飛行中に一度だけ呼び戻せます。戻るまでの時間は、すでに飛んだ時間と同じです。地上防衛設備は移送できません。積載量のある艦船は資源を運べます。",
  hullNone: "この惑星にいません",
  holdReady: "選んだ艦船が資源を運びます。積載量：{{capacity}}。",
  destinationLabel: "移送先の格納庫",
  holdNeedsLoad: "資源を運ぶには、上で積載量のある艦船を選んでください。",
  holdNoCarrier: "この惑星に資源を運べる艦船がいません。",
  /** Caption on the destination's room bar, which draws the figures itself. */
  /** Screen-reader sentence for the pips beside a hull. */
  hullPacked: "{{name}}{{held}}隻のうち{{packed}}隻を積載対象に選択",
  /** Caption on a cargo slider's spend bar: what this transfer takes. */
  cargoSending: "送信中",
} as const;

/**
 * THE CAPACITY CARD. Owner instruction: the design explains itself and the words
 * are captions on shapes that have already made the point.
 */
export const capacity = {
  fit: "まだ入る",
  full: "満杯",
  /* The two ends of a room card's bar, each under the part it describes. */
  used: "使用中",
  free: "空き",
  /** Screen-reader only: the bar is a picture, and a picture needs a sentence. */
  reading: "{{total}}枠中{{used}}枠を使用",
} as const;

/**
 * KOLONİ ARIZALARI — what broke, what it is taking, and what putting it right costs.
 *
 * THE VOICE IS THE FACT, NOT THE ALARM. Every one of these sentences names a thing that
 * has STOPPED and says what that stops; none of them says "warning" or "critical". A
 * colony breaking down is an ordinary part of holding three worlds, and copy that
 * shouted would either train the player to ignore it or make four broken things feel
 * like a catastrophe when they are a Tuesday.
 */
export const faults = {
  title: "故障",
  mark: "故障あり",
  launchBlock: {
    SHIPYARD_REVOLT: "造船所で反乱 · 船を発進できません",
    PROSPECTOR_FAULT: "プロスペクター施設が停止中",
  },
  /** The strip under the build queues, and the row it collapses to when idle. */
  strip: {
    title: "修理",
    capacity: "修理班{{count}}組",
    priceAlloy: "{{alloy}} 合金",
    priceBoth: "{{alloy}}合金・{{crystal}}クリスタル",
    lane: "修理班{{slot}}",
  },
  tab: "この惑星で故障中",
  /** One line per fault: the name a player sees on the row and the sheet. */
  name: {
    REFINERY_OUTAGE: "合金精錬所の停止",
    EXTRACTOR_OUTAGE: "クリスタル採掘所の停止",
    PLANT_OUTAGE: "重水素精製所の停止",
    VAULT_LEAK: "貯蔵庫からの流出",
    CORE_OUTAGE: "司令中枢の停止",
    TELESCOPE_FAULT: "望遠鏡の故障",
    SHIPYARD_REVOLT: "造船所の反乱",
    PROSPECTOR_FAULT: "プロスペクター施設の停止",
  },
  /** What it stops, in the player's terms. One sentence, no hedging. */
  stopped: {
    REFINERY_OUTAGE: "合金精錬所が停止しています。この惑星では合金を生産できません。",
    EXTRACTOR_OUTAGE: "クリスタル採掘所が停止しています。この惑星ではクリスタルを生産できません。",
    PLANT_OUTAGE: "重水素精製所が停止しています。この惑星では重水素を生産できません。",
    VAULT_LEAK: "貯蔵庫の資源が軌道へ流出しています。この惑星を望遠鏡で見られる司令官は、その資源を見つけて回収できます。",
    CORE_OUTAGE: "司令中枢が停止しています。イージスと地上砲の射撃管制は機能しません。惑星にいる船は戦えますが、今は防衛が弱まっています。",
    TELESCOPE_FAULT: "望遠鏡が故障しています。修理が終わるまで、この惑星は肉眼で見える範囲しか観測できません。",
    SHIPYARD_REVOLT: "造船所で反乱が起きています。この惑星からは襲撃、輸送、護送のいずれも発進できません。すでに飛行中の船は帰還できます。",
    PROSPECTOR_FAULT: "プロスペクター施設が停止しています。この惑星からプロスペクターを派遣できません。すでに出発した船は呼び戻せます。",
  },
  toll: {
    title: "失っているもの",
    alloy: "1時間あたり合金{{amount}}を生産できません",
    crystal: "1時間あたりクリスタル{{amount}}を生産できません",
    deuterium: "この惑星が1時間で生産するはずの重水素を失います",
    leak: "毎時{{amount}}が軌道へ流出し、この惑星を見られる司令官なら回収できます",
  },
  loyalty: {
    title: "この惑星の忠誠度",
    battleLoss: "部分的敗北 −15 · 決定的敗北 −30 · デス・スター −{{strike}}",
    line: "{{value}}% · {{count}}件の故障が続く間は低下します。このままでは{{time}}後に0となり、植民地は独立します。",
    bar: "忠誠度{{value}}%",
    left: "残り{{time}}",
  },
  price: {
    title: "修理",
    crew: "修理班",
    parts: "部品",
    takes: "所要時間は5～15分です。担当する修理班ごとに時間が決まります。",
  },
  repair: "修理班を派遣",
  running: "修理班が作業中 · {{time}}",
  noCancel: "派遣した修理班は呼び戻せません。",
  lanesFull: "{{count}}組の修理班がすべて出動中",
  started: "修理班が向かっています。",
  failed: "修理を開始できませんでした。",
} as const;
