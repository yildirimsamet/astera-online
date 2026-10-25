/**
 * THE RESEARCH SURFACE. T12.
 *
 * Its own namespace because it is its own screen. These strings lived under
 * `planet.reach` while research was four cards on the planet sheet's fleet tab —
 * and while there were four of them, that was the truth. There are fifteen now,
 * they belong to the COMMANDER rather than to a world (T7), and they moved to a
 * surface of their own.
 *
 * `planet.reach` KEPT ITS OWN COPIES of the two sentences that gate a hull
 * ("Research Dense Fuel Cells first" on the Wayfarer, the same for the Nullifier).
 * They read the same in English today and they are still two different strings on
 * two different screens — one is a door on a research card, one is a requirement
 * on a ship. The day either is reworded the other must not move with it.
 */
export const research = {
  shipShieldStage: "2 · 艦船のシールドが砲火を吸収",
  shipShieldHullDamage: "シールド通過後、防衛側の船体に{{amount}}の攻撃ダメージが到達。",
  shipShieldsName: "艦船シールド",
  shipShieldsTag: "戦闘射撃を吸収",
  shipShieldsRole: "各艦船は最大船体HPの25%に相当するシールドを持ちます。4段階の研究で基本シールドが合計25%、50%、70%、100%増加します。",
  shipShieldsDetail: "シールドは各戦闘の開始時に満タンになり、戦闘中は回復しません。船体の損傷は残ります。放射線はシールドを通過し、船体HPを直接減らします。地上防衛に個別シールドはありません。装甲は最大船体HPとシールド容量の両方を増やします。派遣艦隊は出発時の研究を維持します。",
  shipShieldGain: "艦船シールド増加",
  shipShieldScope: "すべての移動可能な艦船に適用。効果は基本シールドに対する合計増加率で、研究レベル間で乗算されません。",
  shipShieldStat: "艦船シールド (HP)",
  shipShieldRound: "このラウンドのシールド吸収量：自軍{{your}}、敵軍{{their}}。",
  shipShieldHint: "艦船シールドは各戦闘の開始時に満タンになり、ラウンド間では回復しません。放射線は船体HPを直接減らします。",
  shieldingCeiling: "レベル{{level}}：{{rate}} HP/分",
  shieldingName: "放射線防護",
  shieldingTag: "艦船の放射線ダメージを軽減",
  shieldingRole: "惑星と記念碑の放射線から艦船を守ります。研究には4つのレベルがあります。",
  shieldingDetail: "この研究は艦船のみを防護し、戦闘ダメージは軽減しません。惑星ではAegisによる追加の防護を受けられます。記念碑では艦船の放射線防護のみが適用されます。自分の惑星にいる艦船には、司令官の現在の研究レベルが適用されます。派遣した艦隊は出発時の防護を維持し、その後の研究では強化されません。研究には首都のコアレベル3が必要です。",
  shieldingRateLabel: "レベル2放射線 · HP/分",
  shieldingScope: "艦隊の防護は派遣時に記録されます。すべての放射線レベルに有効です。",
  eyebrow: "司令官",
  title: "研究",
  /** What the whole screen is for, in the one clause a player reads before scrolling. */
  premise: "一度研究すれば、保有するすべての惑星に効果が及びます。",

  /** THE QUEUE. It belongs to the commander, not to the funding world. */
  queueTitle: "研究キュー",
  queueCapacity: "{{count}}枠",
  queueLane: "司令官の研究",
  queueGlobalHint:
    "研究キューは司令官全体で共有します。開始した研究はキャンセルできません。各惑星の建設と造船所は別に進みます。",
  runningLabel: "研究中",
  runningFinishes: "{{time}}に完了",
  idleLabel: "研究中の項目はありません",
  idleHint:
    "マップ上の星を選んでください。最大3件の研究を待機させられます。",

  frontierBand: "フロンティア",
  frontierNote: "機能の解禁と放射線対策。各研究に発見条件と前提条件を表示します。",
  industryBand: "産業",
  industryNote:
    "生産量、建設と修理の時間、積載量を改善します。各研究の詳細にレベル上限と前提条件を表示します。",
  doctrineBand: "ドクトリン",
  doctrineNote: "上位艦船を解禁し、攻撃、装甲、戦闘シールド、推進を強化します。探査機で戦闘研究を確認できます。",
  strategicBand: "戦略",
  strategicNote: "各惑星が保有できるデス・スターと迎撃弾の数を増やします。",

  act: "研究",
  details: "詳細",
  cannotAfford: "資源が足りません",
  complete: "研究済み",
  /**
   * WHAT IS HAPPENING TO A PROJECT ALREADY BOUGHT. D183.
   *
   * Two words, two states: the clock is paying for one of them and the other is
   * waiting in a line of three. A row that said "1 order queued" for both hid the
   * only fact a commander choosing what to buy next needs.
   */
  rowRunning: "研究中",
  rowQueued: "順番待ち",

  needCore: "首都の司令中枢をL{{level}}まで上げてください",
  queueFull: "研究キューにはすでに3件あります。1件完了するまで待ってください。",
  at: "{{duration}}後に研究可能",
  isotopeFirst: "先に同位体分光分析を研究してください",
  prerequisiteFirst: "先に{{name}}を研究してください",
  prerequisiteLevelFirst: "先に{{name}}をレベル{{level}}まで上げてください",
  nameAtLevel: "{{name}} L{{level}}",
  cargoInsight: "戦利品が残る標的を襲撃し、1回の攻撃で船倉を満たす",
  shieldInsight: "イージスに攻撃ダメージの{{share}}以上を吸収させる",

  sheetEyebrow: "研究プロジェクト",
  sheetComplete: "研究完了",
  sheetCost: "研究費",
  sheetOnce: "司令官共通の研究キューに追加します。建設枠や造船枠は使いません。",
  sheetRung: "全{{max}}レベル中のレベル{{level}}です。各レベルは個別に購入します。",

  isotopeName: "同位体分光分析",
  isotopeTag: "重水素採掘を開放",
  isotopeRole:
    "同位体小惑星の重水素を確認し、プロスペクターを派遣できるようになります。採掘物は生産施設に入ります。",
  isotopeDetail:
    "一度研究すると、同位体小惑星を採掘先として選べます。ほかの司令官と競う重水素の採掘が可能になりますが、惑星の重水素生産量は増えません。",
  denseName: "高密度燃料電池",
  denseTag: "艦船推進の研究を開放",
  denseRole:
    "標的に戦利品が残る状態で、1回の襲撃で船倉を満杯にすると研究が現れます。研究完了後に艦船推進の段階強化が開放されます。",
  denseDetail:
    "研究を終えると、司令官全体で艦船推進を研究できるようになります。推進力は艦隊の艦船を速くし、アトラス建造の条件にもなります。プロスペクターと探査機には影響しません。",
  graviticName: "重力チャージ",
  graviticTag: "ヌリファイアを開放",
  graviticRole:
    "使用中のイージスがある惑星を攻撃し、攻撃ダメージの{{share}}以上をシールドに吸収させると研究が現れます。ダート1隻でも条件を満たせます。勝利は不要です。ヌリファイアは有効なシールドに5倍のダメージを与えます。",
  graviticDetail:
    "研究完了後、ヌリファイア建造に必要な専門研究の条件を満たします。ヌリファイアは有効なイージスへの対抗手段で、通常の攻撃力を上げる研究ではありません。シールドへの追加ダメージは艦船や地上砲には及びません。",

  synthesisName: "重水素合成",
  synthesisTag: "重水素精製所のレベル上限を引き上げる",
  synthesisRole:
    "研究1段階ごとに、保有する全惑星の重水素精製所のレベル上限が3上がります",
  synthesisDetail:
    "研究1段階ごとに、すべての惑星で重水素精製所のレベル上限が3上がります。生産量を増やすには、必要な惑星で精製所を個別に強化してください。",
  yardName: "造船所の自動化",
  yardTag: "艦船の建造時間を短縮",
  yardRole:
    "すべての惑星で、新しい艦船と地上防衛の製造時間を短縮します。",
  yardDetail:
    "各レベルで、採掘船と地上防衛を含む新しい造船所の注文時間が短くなります。表は基本時間のうち残る割合を示します。資源費用と待機列の容量は変わりません。建設と艦船修理には別の研究効果があります。",
  robotsName: "AI ロボット",
  robotsTag: "施設の建設時間を短縮",
  robotsRole:
    "建設キューの作業時間を短縮します。艦船と地上砲には影響しません",
  robotsDetail:
    "全惑星の今後の建設注文を短縮します。対象は建物、装置、衛星です。艦船や地上防衛は速くなりません。資源費と待機列の容量は変わりません。",
  industrialName: "工業化",
  industrialTag: "艦船の修理費用と時間を削減",
  industrialRole:
    "修理ステーションで行うすべての作業の費用と時間を削減します",
  industrialDetail:
    "全惑星の艦船修理の費用と時間を減らします。レベル1では通常の75%、レベル2では50%になります。艦船の建造は速くなりません。",
  holdsName: "プロスペクター船倉",
  holdsTag: "採掘艇の積載量を増やす",
  holdsRole: "各プロスペクターの船倉を拡張します。採掘櫓の容量ボーナスも加わります",
  holdsDetail:
    "研究1段階ごとに、プロスペクターが持ち帰れる量が増えます。採掘櫓のボーナスと掛け合わせて適用され、3段階目では全惑星で3隻目のプロスペクター枠が開きます。",
  cargoName: "貨物倉",
  cargoTag: "すべての船倉を拡張",
  cargoRole: "襲撃の戦利品、惑星間輸送、交易船団の積載量を増やします。小惑星採掘は別の研究です",
  cargoDetail:
    "各段階で、襲撃と惑星間輸送に使うすべての船の船倉が広がります。クーリエ、ウェイフェアラー、アトラス、アルゴシーは交易船団でも多く運べます。プロスペクターには別のプロスペクター船倉研究が適用されます。",

  engineeringName: "宇宙船工学",
  engineeringTag: "上位ティアの艦船を開放",
  engineeringRole:
    "工学Iでティア3、工学IIでティア4の艦船を建造できるようになります。各艦船の追加研究と造船所レベルは別途必要です。",
  engineeringDetail:
    "レベル1はティア3艦の工学条件を満たします。レベル2はティア4艦の同条件を満たします。艦船ごとに攻撃力、装甲、推進、重力チャージの研究も必要になる場合があります。造船所レベルの条件も満たす必要があります。",
  powerName: "艦船火力",
  powerTag: "軍艦の攻撃力を上げる",
  powerRole:
    "艦隊の全戦闘艦の攻撃力を上げ、上位の攻撃艦を建造する条件を満たします。輸送艦と地上防衛設備には影響しません。",
  powerDetail:
    "各レベルで、ヌリファイアを含む全戦闘艦の通常攻撃力が上がります。保有済みの艦船にも有効です。輸送艦に攻撃力は付きません。地上砲、プロスペクター、探査機は対象外です。攻撃側には出航時、防衛側には戦闘開始時の研究レベルを使います。",
  armorName: "艦船装甲",
  armorTag: "船体の強度を上げる",
  armorRole:
    "輸送艦を含む全艦船の船体耐久力を上げ、上位の防衛艦を建造する条件を満たします。",
  armorDetail:
    "各レベルで、輸送艦を含む全艦船の船体耐久が上がります。地上砲、プロスペクター、探査機は対象外です。攻撃側には出航時、防衛側には戦闘開始時の研究レベルを使います。",
  propulsionName: "艦船推進",
  propulsionTag: "艦隊速度を上げる",
  propulsionRole:
    "艦隊の全艦船を速くし、アトラス建造の条件にもなります。高密度燃料電池の研究後に開きます。",
  propulsionDetail:
    "4段階の各レベルで艦船の基本速度の25%が加算されます。最終レベルでは基本速度が2倍になります。混成艦隊は最も遅い艦船の速度を使います。プロスペクターと探査機は対象外です。研究完了後に開始する任務に適用されます。",
  groundDoctrineName: "地上防衛ドクトリン",
  doctrineTag: "地上防御力の向上",
  doctrineRole:
    "バスティオン、ハープーン、ソーンの攻撃力と船体耐久を上げます。地上容量、残骸回収、クラス相性は変わりません。",
  groundDoctrineDetail:
    "全惑星のバスティオン、ハープーン、ソーンの攻撃力と船体耐久を上げます。地上容量と残骸回収のルールは変わりません。防衛側は戦闘開始時の研究レベルを使います。",

  gridName: "迎撃網",
  gridTag: "各惑星に最大6発の迎撃弾",
  gridRole: "研究2段階で各惑星の迎撃弾上限が増えます：2 → 4 → 6。",
  gridDetail: "研究レベルごとに2枠追加されます。迎撃弾は無料で付与されません。有効なアップリンクとレーダー3がある惑星で各弾を建造してください。迎撃1回で1発を消費し、デス・スターか放射線爆弾を1つ止めます。標的の惑星の迎撃砲台だけが発射します。",
  stockpileName: "戦略的備蓄",
  stockpileTag: "各惑星のデス・スターを2基まで増やす",
  stockpileRole: "各惑星に置けるデス・スターの上限を1基から2基に増やします。2基目は1基目の完成後に建造できます。",
  stockpileDetail: "研究なしでは各惑星にデス・スターを1基置けます。この研究で、帝国全体ではなく各惑星の上限が2基になります。2基目も費用と建造時間を全額要し、1基目の完成後に建造します。複数の惑星から同時に攻撃すると、防衛側の迎撃弾を突破しやすくなります。",
} as const;
