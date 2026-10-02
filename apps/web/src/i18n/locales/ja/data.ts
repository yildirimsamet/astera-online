/**
 * THE NAMED THINGS, AND THE SENTENCES THE GAME SAYS ABOUT THEM.
 *
 * `packages/rules` owns the numbers and stays language-free (it is the shared
 * source of truth for the server and the simulator, and a translation table in
 * there would be I/O by another name). So every NAME a player reads lives here,
 * keyed by the same id the rules use.
 */

export const vocabulary = {
  building: {
    CORE: { name: "司令中枢", tag: "建物の上限を解放", role: "建物のレベル上限と建設速度を決めます。首都ではレベル9・13・16で植民地枠が開きます。", detail: "ほかの建物は司令中枢のレベルを超えられません。レベルを上げると建設時間が短くなり、所定の段階で軌道枠と飛行枠が増え、地上防衛の収容上限も広がります。研究の上限と速度を決めるのは首都の司令中枢だけです。首都のレベル9・13・16で植民地枠が順に3つ開きます。司令中枢自体は資源や戦闘力を生みません。" },
    REFINERY: { name: "合金精錬所", tag: "合金を生産", role: "時間あたりの合金生産量と貯蔵量を増やします", detail: "レベルを上げると合金の自動生産量と貯蔵上限が増えます。合金は多くの建物や船の建造に必要なので、今後の待ち時間を短縮できます。" },
    EXTRACTOR: { name: "クリスタル採掘所", tag: "クリスタルを生産", role: "時間あたりのクリスタル生産量と貯蔵量を増やします", detail: "レベルを上げるとクリスタルの自動生産量と貯蔵上限が増えます。クリスタルは上位の装置や船、研究に必要な希少資源です。" },
    VAULT: { name: "貯蔵庫", tag: "資源の収容上限を拡張", role: "貯蔵量を増やし、同レベルの合金精錬所とクリスタル採掘所を次に強化する費用に10%の余裕を確保します。下位10%は最大8時間分の生産量まで襲撃から守られます。", detail: "貯蔵庫はまず各資源の生産時間に応じて拡張されます。高レベルで容量が足りない場合、貯蔵庫Lは合金精錬所L→L+1に必要な合金とクリスタル採掘所L→L+1に必要なクリスタルの110%まで収容できるようになります。この時間枠は重水素にも適用されます。襲撃で奪われない量は、貯蔵量の下位10%と8時間分の生産量のうち少ない方です。貯蔵庫は攻撃や被害軽減には役立ちません。" },
    SHIPYARD: { name: "造船所", tag: "上位の船を解放", role: "船を解放し、船と地上防衛の建造を速め、探査機の精度と隠密性を高めます", detail: "レベルを上げると新しい船種が解放され、船と地上砲の建造時間が短くなります。探査機の測定精度も上がり、自分の探査機は発見されにくくなります。造船所を強化してもキューの枠数は増えません。" },
    HANGAR: { name: "格納庫", tag: "収容できる船を増やす", role: "この惑星の船の収容上限を決めます。司令中枢の各段階で拡張できます", detail: "すべての船は、航行中でも船体の大きさに応じて格納庫の枠を使います。地上砲は枠を使いません。満杯になると新しい船を建造・受け入れできませんが、既存の船は失われません。各段階の費用は増える収容力の3分の1に相当するため、上位の格納庫は貯蔵庫を強化していない惑星の収容資源を超える場合があります。" },
    DEUTERIUM_PLANT: { name: "重水素精製所", tag: "重水素を生産", role: "時間あたりの重水素生産量と燃料の貯蔵量を増やします。上限は重水素合成の研究で決まります", detail: "レベルを上げると重水素の自動生産量と貯蔵上限が増えます。重水素は艦隊の発進に必要な燃料です。精製所がレベル上限に達したら、重水素合成を次の段階まで研究してください。" },
  },

  instrument: {
    TELESCOPE: {
      name: "望遠鏡",
      tag: "遠くの動きを解決する",
      role:
        "到達範囲内の動きを識別します。監視スロットは、L1、L3、L5、L7 で 1、2、3、4 になります。静けさ。",
      roleNone:
        "遠方の移動を識別し、選択した世界を静かに監視して、その艦隊が本拠地にいるかどうかを知ることができます。軌道上にはアップリンクが必要です。",
      roleOwned:
        "移動中の宇宙船が識別されるエリアを拡張し、サイレントウォッチスロットを提供します。それは保護ではなく知性を与えます。",
      detail: "より多くのレベルでは、移動接触の視界が拡張され、小惑星がその領域に入ると、通過する小惑星が明らかになります。明らかにされた岩は、それがなくなるまで知られ続けます。 L1、L3、L5、および L7 には、1、2、3、および 4 つのサイレント ウォッチ スロットが用意されています。 望遠鏡 は、艦隊があなたを狙っていることを決して警告しません。",
    },
    RADAR: {
      name: "レーダー",
      tag: "あなたに対する脅威を区別してください",
      role:
        "円内の動きを検出し、プローブ検出を向上させ、この世界を狙った脅威を到着時刻でマークします。",
      roleNone:
        /*
          IT SAYS "MOST", BECAUSE A BARE WORLD IS NOT BLIND TO SCOUTS.
          `detectChance` has a floor: a world with no Radar still catches about one
          probe in seven and is told. That is deliberate — the scan notification is
          what teaches a new commander the Radar exists at all. The copy said
          "unseen", which was simply false, and a sentence that oversells a purchase
          is the one thing a decision surface may not do.
        */
        "軌道上に アップリンク が必要です。 レーダー がなければ、到着艦隊は到着警告を発せず、ほとんどのプローブは気付かれずに通過します。",
      roleOwned:
        "ETA なしでそのサークル内の動きを検出し、この世界を狙った脅威を到着時刻でマークします。 L2 は方位を追加し、L4 は大まかなサイズを追加し、L5 はオリジン ワールドとフル 艦隊を追加します。",
      detail: "すべてのレベルで、接触と時間警告の範囲が広がります。 L5 までのレベルも探査機を捕捉する可能性を高めます。L1 は到着時刻を示す到着艦隊をマークし、L2 は方位を追加し、L4 はその強さを推定し、L5 はその出発地と船を明らかにします。 L6 ～ L8 は追加のリーチを購入します。この世界を目的としない動きはETAなしで検出されます。インターセプターチャージは、レーダー 3 以上でのみ戦略兵器を攻撃できます。",
    },
    AEGIS: {
      name: "イージス",
      tag: "あなたの惑星のためのシールド",
      role: "ユニットよりも先にダメージを受け、1 時間ごとに最大値の 35% を回復する惑星のシールド。",
      roleNone:
        "船や地上砲よりも先に襲撃ダメージを吸収し、その後リソースなしで再生します。それは何のインテリジェンスも提供しません。",
      roleOwned:
        "船や地上砲の前に襲撃によるダメージを吸収し、1 時間ごとに最大値の 35% を回復します。それは何のインテリジェンスも提供しません。",
      detail: "レベルごとに最大のシールド強度が上昇します。戦闘ダメージは船や地上砲に到達する前に イージス から除去され、シールドはリソースなしで 1 時間あたり最大値の 35% を再生します。情報は集まりません。",
    },
    VEIL: {
      name: "ヴェール",
      tag: "望遠鏡から隠れる",
      role: "誰かの望遠鏡があなたについて読み取ることができる内容を劣化させます。",
      roleNone:
        "敵の 望遠鏡 に対して艦隊のステータスを読み取れなくすることができます。情報は隠蔽されますが、誤った測定値をでっち上げたり、調査を停止したりすることはありません。",
      roleOwned:
        "敵の 望遠鏡 に対して艦隊のステータスを読み取れなくすることができます。情報は隠蔽されますが、誤った測定値をでっち上げたり、調査を停止したりすることはありません。",
      detail: "より強力な ヴェール は、より強力な 望遠鏡 測定値を無効にし、同等の 造船所 プローブ精度を低下させます。それはあなたの状態を隠します。偽のデータをでっち上げたり、受信プローブをブロックしたりすることはありません。",
    },
  },

  satellite: {
    UPLINK: {
      name: "アップリンク",
      tag: "望遠鏡 および レーダー のロックを解除します",
      role:
        "望遠鏡またはレーダーをこのワールドにインストールするために必要です。軌道スロットを 1 つ使用し、生産ボーナスや防御ボーナスは提供されません。",
      blurb:
        "望遠鏡とレーダーのロックを解除する通信リレー。それ自体で視力が伸びるわけではありません。",
      detail: "一度インストールすると、望遠鏡とレーダーの構築がこのワールドで利用可能になります。 1 つの軌道スロットを使用し、独自のレベルを必要としません。",
    },
    FOUNDRY: {
      name: "鋳造所",
      tag: "1時間ごとに鉱石が増加",
      role:
        "この世界の不動態合金、結晶、重水素の生産量を 6% 増加させます。",
      blurb:
        "軌道からの生産をサポートし、3 つの時間リソース ストリームすべてと、そこから派生する作品およびストレージ容量を増加します。",
      detail: "鋳造所 は、この世界におけるパッシブ合金、クリスタル、重水素の生産に 1.06 の乗数を適用します。それらの料金から導き出される作品と保管の制限は、それに伴って増加します。貯蔵庫のRAID保護された金額はそうではありません。採掘倉や襲撃貨物には影響しません。",
    },
    DERRICK: {
      name: "採掘櫓",
      tag: "より良い採掘船",
      role:
        "この世界が所有するすべての プロスペクター に 2 倍の運搬能力と 1.5 倍の移動速度を与えます。",
      blurb:
        "この世界の採掘船を軌道上からサポートします。ホールドが大きいほど各輸送量が増加しますが、移動速度が速ければ、競合する小惑星に時間内に到達できる可能性が高くなります。",
      detail: "プロスペクターの積載量を2倍、航行速度を1.5倍にします。プロスペクター船倉の研究効果は、その後さらに乗算されます。採掘櫓は採掘艇だけを強化し、襲撃時の積載量は変えません。",
    },
    BEACON: {
      name: "ビーコン",
      tag: "より高速な艦隊",
      role:
        "ここで発進した襲撃、転送、交易、クラン支援艦隊の両脚の移動速度が 1.3 倍になります。",
      blurb:
        "襲撃、転送、交易、クラン支援艦隊の航行マーク。フライトが短いということは、守備陣が自宅から離れている時間帯が短いことを意味します。",
      detail: "速度乗数 1.3 は、ここで発進する往路と復路の襲撃、転送、交易、およびクラン支援艦隊に適用されます。入植艦隊や探鉱者には影響せず、攻撃、装甲、貨物、燃料のコストも変わりません。",
    },
  },

  /**
   * THE THREE ROLES A FIGHT IS DECIDED BY, plus the one that is prey.
   *
   * Named separately from `hull.*.family` on purpose. Family is a PURCHASING
   * taxonomy — where a hull sits in the shipyard — and it runs at right angles to
   * this one: a Pike is Offensive and a Rampart Defensive, and the Rampart beats
   * the Pike. Teaching the two with one word was how the interface came to imply
   * the opposite of the rule it enforces.
   */
  combatClass: {
    SKIRMISHER: { name: "機動型", tag: "強力 vs 防壁型;弱い vs 突撃型" },
    BULWARK: { name: "防壁型", tag: "強力 vs 突撃型;弱い vs 機動型" },
    LANCE: { name: "突撃型", tag: "強力 vs 機動型;弱い vs 防壁型" },
    SUPPORT: { name: "サポート", tag: "非武装。軍艦が生きている間はカバーされる" },
  },

  hull: {
    DART: {
      name: "ダート", tag: "フラジャイル・スピード・レイダー", role: "最速のエントリー戦闘船体。耐久性を露出時間と引き換えにします。",
      pitch: "すぐに到着して帰還したが、集中砲火を受けて折りたたまれる。",
      detail: "短い襲撃と重い船体のカウンター用の低コストの 機動型。そのスピードにより、ホームディフェンスの稼働時間が維持されます。ハルが薄いため、読み取り失敗のコストが高くなります。",
    },
    PIKE: {
      name: "パイク", tag: "エントリー 突撃型 船体", role: "ダート の価格では、攻撃がより激しく、船体が少ないため、スカーミッシャーに対してクラスアドバンテージが得られます。",
      pitch: "攻撃は船体の強度を超えます。開始一斉射撃が難しくなると、船はより壊れやすくなります。",
      detail: "パイク は、ダート や ソーン などのスカーミッシャーを狩るエントリー 突撃型 です。 ダート の価格では、攻撃力が高まり、船体が減り、飛行速度が遅くなります。 防壁型 の船体とバスティオンがそれに対抗するため、すべて パイク の艦隊は明確で効果的な答えを持っています。",
    },
    RAMPART: {
      name: "ランパート", tag: "エントリー要塞", role: "ウォーデン の価格でより多くの耐久性を購入できますが、攻撃力が低下し、艦隊の速度が低下します。",
      pitch: "突撃型 の火を効率的に吸収します。 機動型 の群れに対して脆弱です。",
      detail: "低速の防壁型クラスのライン船体。攻撃ではなく生存を重視し、編隊の保持よりも移動時間が重要でない場合に最適です。",
    },
    WARDEN: {
      name: "ウォーデン", tag: "モバイルエスコート", role: "ランパート の価格では、より強力に攻撃し、より速く飛行しますが、船体は小さくなります。",
      pitch: "要塞の耐久性の一部を攻撃と混合艦隊のテンポと交換します。",
      detail: "ウォーデン は、ランパート と同じリソース価格のモバイル 防壁型 エスコートです。素の攻撃力と速度は高くなりますが、船体の強度は低くなります。 ランパート は静的な壁に適しています。 ウォーデンはテンポを必要とする混合艦隊に適しています。",
    },
    COURIER: {
      name: "クーリエ", tag: "高速光伝送", role: "エントリー貨物船体;素早く、軽く保護され、非武装です。",
      pitch: "要塞および 突撃型 艦隊と歩調を合わせますが、最も速い 機動型 編隊の速度は低下します。",
      detail: "戦利品の運搬、惑星間の輸送、入植に使う支援船です。攻撃力はなく、護衛の戦闘艦が生き残っている間だけ守られます。",
    },
    VIPER: {
      name: "ヴァイパー", tag: "効率的なレイダー", role: "Tier 2 の速度と ダート よりも優れた生存性。",
      pitch: "耐久税の負担を軽減しながら、高速艦隊 プランを維持します。",
      detail: "研究不要のティア 2 機動型。 ダート は依然として安価ですが、どちらの船体も同じ素の速度を共有します。 ヴァイパー は、その大きな取り組みを攻撃力、船体、貨物の増加、そして等コスト戦闘効率の向上に変えます。",
    },
    TALON: {
      name: "タロン", tag: "ヘビーストライカー", role: "ヴァイパー の価格では、攻撃がかなり激しくなり、船体が少なくなり、飛行速度が遅くなり、スカーミッシャーに対抗できます。",
      pitch: "攻撃力が船体の強度を超えます。より壊れやすい船は、より高いダメージのバランスをとります。",
      detail: "開発ヤード向けの 突撃型 クラスのダメージハル。 防壁型 カウンターは、その層の利点よりも依然として重要です。",
    },
    STRONGHOLD: {
      name: "ストロングホールド", tag: "ヘビーラインハル", role: "センチネル の価格では、ティア 2 の耐久性が最も高くなりますが、攻撃力と速度は劣ります。",
      pitch: "到着時間よりも生存が重要な場合に壁を構築します。",
      detail: "要塞プロファイル 防壁型。その高い船体は艦隊を固定しますが、スカーミッシャーと長時間の露出は明らかなコストです。",
    },
    SENTINEL: {
      name: "センチネル", tag: "Tier 2 護衛", role: "ストロングホールド の価格では、より強力に攻撃し、より速く飛行しますが、船体は小さくなります。",
      pitch: "要塞の耐久性を攻撃と艦隊のテンポと引き換えにします。",
      detail: "ストロングホールド 旅行プロファイルを強制することなく輸送手段を保護するモバイル 防壁型 エスコート。",
    },
    WAYFARER: {
      name: "ウェイフェアラー", tag: "バランスの取れたトランスポート", role: "クーリエ よりも大容量。遅いですが、それでも柔軟性があります。",
      pitch: "高速 クーリエ と大容量 アトラス の中間的な選択肢です。",
      detail: "大規模な RAID と転送のための Tier 2 サポート トランスポート。非武装のままであり、戦闘護衛に依存している。",
    },
    TEMPEST: {
      name: "テンペスト", tag: "アドバンスドスピードレイダー", role: "研究ゲート型ティア 3 機動型;最速の素の戦闘速度は ダート、ヴァイパー、コルセア と共有されます。",
      pitch: "効率が向上した終盤の速度ですが、まだラインシップではありません。",
      detail: "エンジニアリングとシップパワーによってロックが解除された高度なレイダー。脆弱なプロファイルを維持するため、下層の壁やカウンターも適切なままになります。",
    },
    BALLISTA: {
      name: "バリスタ", tag: "アドバンストストライカー", role: "テンペスト の価格では、ティア 3 の 突撃型 と比べて攻撃が大幅に厳しくなり、船体が少なく、飛行速度が遅くなります。",
      pitch: "攻撃は船体の強度を超えていますが、高いダメージでは右側の 防壁型 の壁から守ることはできません。",
      detail: "エンジニアリングと船舶出力を必要とする Tier 3 ストライク船体。それは盲目的な単一艦隊の生産ではなく、情報に基づいた標的に報酬を与えます。",
    },
    LEVIATHAN: {
      name: "リヴァイアサン", tag: "高度な要塞", role: "プラエトリアン の価格では、より多くの船体を購入できますが、Tier 3 の壁としては攻撃力と速度が低下します。",
      pitch: "すべてのフライトを長い時間かけて行うゲーム終盤の壁。",
      detail: "エンジニアリングと船の装甲によってロックが解除された第 3 層の要塞。スカーミッシャーは引き続きその有効なカウンターです。",
    },
    PRAETORIAN: {
      name: "プラエトリアン", tag: "アドバンスドエスコート", role: "リヴァイアサン の価格では、より強力に攻撃し、より速く飛行しますが、船体は小さくなります。",
      pitch: "要塞の耐久性の一部を攻撃と混合艦隊のテンポと交換します。",
      detail: "エンジニアリングと船舶装甲を必要とする Tier 3 防壁型 護衛。可能な限り遅い選択になることなく貨物を保護します。",
    },
    ATLAS: {
      name: "アトラス", tag: "Tier 3 重量輸送車", role: "最大の Tier 3 ホールド。遅くて大きく、研究ゲート型です。",
      pitch: "アルゴシー のロックが解除される前に、最も効率的で安全な大量輸送。",
      detail: "エンジニアリングと推進によってロックが解除された階層 3 のサポート輸送。ダメージを与えないため、護衛の計画が不可欠になります。",
    },
    NULLIFIER: {
      name: "ヌリファイア",
      tag: "アクティブなシールドを破壊します",
      role: "攻撃主導の 突撃型 スペシャリスト: 攻撃は船体の強度を超え、アクティブなシールドに対して通常の 5 倍の効果があります。",
      pitch: "ボーナス ダメージをユニットキルに変えることなく、イージス を粉砕します。盾が立っていないと弱い。",
      detail: "そのスペシャリストチャージは、アクティブなイージスに通常の5倍の効果を与えます。シールドが落ちると、そのボーナスは船や砲に波及しないため、シールドのない目標はそのプレミアムを無駄にします。",
    },
    /** D200. `{{salvage}}` is `SALVAGE.perCollector`, filled in by `names.ts`. */
    GARBAGE_COLLECTOR: {
      name: "回収艇",
      tag: "残骸の {{salvage}} を持ち上げる",
      role: "特別支援船体: 何も発砲せず、突入した戦闘後に残骸を回収します。",
      pitch: "輸送機のようにラインの後ろを飛んで最後のショットを撮ります。軍艦をそばに置いてください。一度落ちたら獲物です。",
      detail: "戦いが終わると、生き残っているコレクターは全員、残骸の {{salvage}} 個を合金、結晶、重水素の独自の混合物で持ち上げ、残りは公共の場として漂流します。輸送物は艦隊とともに倉庫に着陸します。船倉には何も追加されず、軍艦なしでは飛行できず、残骸場や小惑星に送ることもできず、防御中に何も収集しません。",
    },
    CATACLYSM: {
      name: "カタクリズム", tag: "首都ストライカー", role: "コルセア の価格では、Tier 4 の 突撃型 よりも攻撃が大幅に厳しく、船体が少なく、飛行速度が遅くなります。",
      pitch: "攻撃力は船体の強度を超えます。より壊れやすい船とクラスカウンターがその激しい一斉射撃のバランスをとります。",
      detail: "エンジニアリング、パワー、アーマーを支える主要な 突撃型 船体。効率はより高くなりますが、ミラーリングよりも 防壁型 クラスの防御の方が優れた答えであることに変わりはありません。",
    },
    CORSAIR: {
      name: "コルセア",
      tag: "首都レイダー",
      role: "最上位層の唯一の 機動型 — 防壁型 の壁を打ち破るもの。",
      pitch: "カタクリズム の価格では、より速くて丈夫ですが、攻撃力は低く、保持力も小さくなります。",
      detail: "コルセア は Tier 4 の唯一の 機動型 であり、最高の戦闘速度を ダート、ヴァイパー、テンペスト と共有します。素の攻撃力は カタクリズム よりも劣りますが、シタデル の壁に対して 機動型 のアドバンテージを獲得します。 突撃型級ターゲットがそれに対抗する。",
    },
    CITADEL: {
      name: "シタデル", tag: "首都要塞", role: "パラディン の価格では、船体が増え、攻撃力が減り、Tier 4 の戦闘速度が最も遅くなります。",
      pitch: "コストと露出時間で支払われた最強の壁。",
      detail: "エンジニアリング、装甲、パワーを支える主要な 防壁型 船体。防御を強化しますが、機動型 カウンターに対して脆弱なままです。",
    },
    PALADIN: {
      name: "パラディン",
      tag: "首都エスコート",
      role: "シタデル の価格では、より強力に攻撃し、より速く飛行しますが、船体は小さくなります。",
      pitch: "要塞の耐久性の一部を攻撃と艦隊のテンポと引き換えにする Tier 4 護衛。",
      detail: "パラディンは防壁型クラスなので、ランスを止めてスカーミッシャーに落ちます。 シタデル が装甲に支払うプレミアムを代わりに武器に費やします。これは、Tier 4 の両極端の間の唯一の選択肢です。",
    },
    ARGOSY: {
      name: "アルゴシー",
      tag: "大型輸送艦",
      role: "ゲーム内で最も深い船倉と最も遅い船体。",
      pitch: "アトラス 3 台とほぼ同じ量を運べますが、まったく追いつくことはできません。",
      detail: "アルゴシー は、Tier 4 のトランスポートです。支援クラスなので、戦闘船体が生きている間はシールドされ、ラインがなくなると無防備になります。商人のペースはこの船体に関係しています。カタログで最も遅い船倉がそれを設定します。",
    },
    BASTION: {
      name: "バスティオン",
      tag: "重地上砲",
      role: "地上防衛 · 惑星から離れることはできません",
      pitch: "突撃型 クラスの船体に対して有利な強力な地上防御。スカーミッシャーに対して脆弱です。",
      detail: "バスティオンは惑星から離れることはありません。彼らの 防壁型 クラスは 突撃型 クラスの船体に対してアドバンテージを与え、スカーミッシャーはそれらに対してアドバンテージを受け取ります。戦闘後、破壊された地上砲の 60% (切り捨て) が復元されます。",
    },
    HARPOON: {
      name: "ハープーン", tag: "スピア地上砲", role: "地上防御 · 固定式 突撃型 砲台",
      pitch: "機動型 フォーメーションを破壊します。ブルワークに弱い。",
      detail: "銛は惑星を離れることはありません。 突撃型 クラスの船体はスカーミッシャーに対して有利ですが、防壁型 クラスの船体はスカーミッシャーに対して有利です。彼らは地上容量を使用します。破壊された地上砲の 60% は戦闘後に復元されます (切り捨て)。",
    },
    THORN: {
      name: "ソーン",
      tag: "軽地上砲",
      role: "地上防御・軽い、安い、離れない",
      pitch: "ブルワークに対して有利な低コストの地上防御。ランスに弱い。",
      detail: "いばらは惑星から離れることはありません。 機動型 クラスは 防壁型 クラスの船体に対して有利であり、突撃型 クラスの船体はそれらに対して有利です。彼らは地上容量を使用します。破壊された地上砲の 60% は戦闘後に復元されます (切り捨て)。",
    },
    PROSPECTOR: {
      name: "プロスペクター",
      tag: "小惑星の採掘艇",
      role: "基本積載量200で小惑星を採掘 · 襲撃艦隊には参加しません",
      pitch: "移動する小惑星へ向かい、採掘物を生産施設に持ち帰ります。襲撃や惑星間輸送には使えません。",
      detail: "プロスペクターは発見済みの小惑星と残骸場にだけ派遣できます。往路と空荷の復路の基本速度は619、積載した復路は309です。基本積載量は200で、採掘櫓とプロスペクター船倉の研究で強化できます。各惑星では最初に2隻まで稼働でき、プロスペクター船倉IIIで3枠目が開きます。襲撃にも現地防衛にも参加しません。",
    },
  },

  resource: {
    alloy: "合金",
    crystal: "クリスタル",
    deuterium: "重水素",
  },

  /** The four things a season can hand you, announced the moment they open. */
  unlock: {
    TELESCOPE: {
      title: "望遠鏡 ロック解除",
      body: "アップリンク と 望遠鏡 は、より遠くの動きを識別し、1 つの惑星を観察できるようにします。",
    },
    RADAR: {
      title: "レーダー ロック解除",
      body: "アップリンク および レーダー はプローブをキャッチします。 L1 からその円は、あなたを狙った脅威の到着時刻も示します。",
    },
    EXPLORER: {
      title: "エクスプローラーのロックが解除されました",
      body: "確実に知るためにプローブを送信します。彼らのレーダーがそれを捉えるかもしれない。",
    },
    VEIL: { title: "ヴェール ロック解除", body: "あなたの艦隊のステータスは、誰が見ても UNKNOWN と表示されます。" },
  },
} as const;

/** WHAT YOU GET IF YOU PRESS IT. */
export const gains = {
  rangeUnits: "{{count}} ユニット",

  core: {
    label: "天井を構築する",
    level: "L{{level}}",
    releases_one: "{{count}} でブロックされていたアップグレードをリリース",
    releases_other: "{{count}} でブロックされていたアップグレードをリリースします",
    raisesCap: "建物のレベル天井を上げる",
  },
  hangar: {
    label: "艦隊ルーム",
    value: "{{room}} ルーム",
    none: "いいえ 格納庫",
    ceiling: "最上段は {{room}} まで",
  },
  refinery: {
    label: "合金/時間",
    rate: "{{amount}}/h",
    storage: "ストレージ {{now}} → {{next}}",
  },
  extractor: {
    label: "1 時間あたりのクリスタル",
    rate: "{{amount}}/h",
    storage: "ストレージ {{now}} → {{next}}",
  },
  vault: {
    label: "貯蔵庫の深さ",
    value: "{{store}}h 貯蔵庫 · {{safe}}h 保護されています",
  },
  shipyard: {
    accuracyLabel: "プローブ精度",
    seesLabel: "ヴェール を透視して最大",
    seesValue: "L{{level}}",
    unlocksHull: "{{hull}}のロックを解除します",
    stealth: "独自のプローブの検出が困難になります",
  },

  telescope: {
    slotsLabel: "観察できる惑星",
    rangeLabel: "どこまで見えるか",
    maxed: "トップレベル: {{slots}} 時計スロットと {{range}} ユニットの可動接触照準器。銀河を越えるほどの",
    reachAndCooldown: "が {{range}} に達しました · スロットが {{hours}}h に再調整されます",
    nextSlot: "次のレベルでは {{ordinal}} スロットが追加されます",
    ordinalSecond: "2番目",
    ordinalThird: "3番目",
    ordinalFourth: "4位",
    cooldown: "スロットが {{hours}}h で再調整されます",
  },
  radar: {
    scansLabel: "スキャンを検出します",
    scansNo: "いいえ",
    scansYes: "はい",
    scansBearing: "はい、ベアリング付き",
    sweepLabel: "接触エリア・時限警告",
    sweepNone: "なし",
    reaches: "{{sense}} 連絡先 (ETA なし) · {{warn}} 時間警告",
    maxed: "トップレベル。警告により、元の世界と正確な艦隊も明らかになります",
    l1: "プローブの捕捉を開始し、受信艦隊がサークルに入ると警告します",
    bearing: "L2 も接近方向を明らかに",
    interception: "L3 は、この世界にインターセプターチャージをロードさせます (アップリンク が必要)",
    estimate: "接近する部隊の大まかなサイズを早期に表示します",
    origin: "警告では、元のワールドと正確な艦隊の名前が示されます",
  },
  aegis: {
    label: "マックスシールド",
    unlocks: "ユニットがダメージを受ける前にダメージを吸収します。毎時間最大値の {{percent}}% を回復します。",
  },
  veil: {
    label: "望遠鏡を最大までブラインドします。",
    none: "なし",
    level: "L{{level}}",
    unlocks: "プローブの精度を 造船所 と同等の {{percent}} にカットします。",
  },

  foundry: {
    label: "時間当たりのリソース生産",
    now: "電流出力",
    next: "+{{percent}}%",
    unlocks: "この世界の合金、結晶、重水素の生産に適用されます",
  },
  uplink: {
    label: "望遠鏡 および レーダー",
    now: "ロックされました",
    next: "ロック解除されました",
    unlocks: "望遠鏡とレーダーはこのワールドにインストール可能です",
  },
  derrick: {
    label: "すべての プロスペクター は、",
    now: "1×",
    next: "{{factor}}×",
    unlocks: "探鉱者も {{factor}} 倍の速度で移動します",
  },
  beacon: {
    label: "艦隊の襲撃、移送、貿易、援助",
    now: "通常速度",
    next: "{{factor}}倍高速",
    unlocks: "アウトとバック — 守備を自宅から離れて行うことで、より短い時間枠を確保",
  },
  /** Every research row names the quantity or permission the player actually buys. */
  research: {
    powerLabel: "軍艦攻撃",
    powerScope:
      "艦隊内のすべての軍艦。パワーとアーマーを合わせると、同じ予算の戦闘力が最大 56% 追加されます。輸送と地上防衛は影響を受けません。",
    armorLabel: "船体強度",
    armorScope:
      "艦隊内のすべての船舶 (輸送船を含む)。パワーとアーマーを合わせると、同じ予算の戦闘力が最大 56% 追加されます。地上防御は影響を受けません。",
    speedLabel: "艦隊速度",
    speedScope:
      "艦隊内のすべての船。混成艦隊は依然として、最も遅いメンバーの (改良された) 速度で飛行しています。探鉱者と探査機は影響を受けません。",
    engineeringLabel: "船体層アクセス",
    engineeringTier: "層 {{tier}}",
    engineeringScope:
      "Engineering I は Tier 3 を開き、Engineering II は Tier 4 を開きます。個々の船体には、電力、装甲、推進力、または重力チャージが必要になる場合もあります。",
    groundLabel: "地上防御力",
    groundScope: "{{bastion}}、{{harpoon}}、および {{thorn}} は、あなたが保持するすべてのワールドにあります。",
    yardLabel: "船の建造時間",
    robotsLabel: "構造構築時間",
    holdsLabel: "プロスペクター船倉",
    holdsScope: "軌道上の 採掘櫓 と乗算します。",
    cargoLabel: "襲撃貨物",
    cargoScope: "戦利品のみ — ワールド転送とマイニングは変更されません。",
    industrialLabel: "修理代金と時間",
    industrialScope: "修理ステーションのみ — 船の建造は変更されません。",
    refineryLabel: "製油所の天井",
    stockpileLabel: "ワールドごとのデス・スター",
    gridLabel: "ワールドごとの料金",
    /* A permission opens a door; drawing it as a ladder would invent a quantity. */
    opensLabel: "ロック解除",
    open: "開く",
    shut: "ロックされました",
    isotopeOpens: "同位体小惑星が選択可能な採掘ターゲットになります。",
    denseOpens: "船舶の推進研究が利用可能になります。",
    graviticOpens: "ヌリファイア の専門研究要件は満たされています。",
  },
  plant: {
    label: "重水素",
    value: "{{rate}}/h",
    storage: "燃料貯蔵庫 {{now}} → {{next}}",
  },
} as const;

/** The situation engine: what a competent player would be thinking about now. */
export const directives = {
  inboundTitle: "敵艦隊が接近中 · {{duration}}",
  inboundDetail:
    "資源を使う、艦隊を退避させる、迎え撃つ。ここにない資源や船は奪われません。",
  inboundAction: "今すぐ資源を使う",

  undefendedTitle: "この惑星に地上防衛はありません",
  undefendedShieldedTitle: "シールドが切れるまで{{duration}} · 地上防衛を建造しましょう",
  undefendedDetail: "資源{{amount}}は襲撃で奪われる可能性があります。ソーンかバスティオンを建造すれば継続して防衛できます。",
  undefendedAction: "地上防衛を建造",

  exposedTitle: "資源{{amount}}が襲撃で奪われる可能性があります",
  exposedDetail: "貯蔵庫が守る資源は現在{{now}}、次のレベルでは{{next}}です。",
  exposedAction: "貯蔵庫を強化",

  scannedTitle_one: "誰かがあなたをスキャンしました",
  scannedTitle_other: "{{count}} があなたに対してスキャンします",
  scannedDetail: "彼らはあなたのストックとディフェンスを学ぼうとしています。 ヴェール は、プローブが明らかにできる内容を減らします。",
  scannedAction: "ログを参照",

  windowTitle: "{{name}}の艦隊は出航中です",
  windowDetailUnknownJustNow: "たった今確認しました。帰還時刻は不明です。",
  windowDetailUnknown: "{{age}}前に確認しました。帰還時刻は不明です。",
  windowDetailEta:
    "あと約{{duration}}で帰還します。今、敵の惑星を守るのは残された戦力だけです。",
  windowAction: "攻撃の好機を確認",

  storageFullTitle: "{{amount}}を回収できません",
  storageFullDetail:
    "貯蔵庫が満杯のため、生産施設の資源を移せません。資源を使って空きを作ってから回収してください。",
  storageFullAction: "資源を使う",

  noTelescopeTitle: "今は肉眼で見える範囲だけです",
  noTelescopeDetail:
    "無料の視界でも近くを通る小惑星は発見できます。望遠鏡を設置すると発見範囲が広がり、遠くの艦船を識別できます。惑星を密かに監視して、艦隊が出航した時も分かります。",
  noTelescopeAction: "望遠鏡を設置",

  noRadarTitle: "敵艦隊が警告なしに到着する可能性があります",
  noRadarDetail: "レーダーL1があれば、探知範囲内のあなたを狙う脅威と到着時刻が分かります。レベルを上げると範囲が広がり、詳細な情報も得られます。",
  noRadarAction: "レーダーを確認",

  coreCeilingTitle: "司令中枢の上限で{{count}}件の強化が止まっています",
  coreCeilingDetail: "施設レベルは司令中枢を超えられません。司令中枢を強化すると、止まっている強化を進められます。",
  coreCeilingAction: "司令中枢を強化",

  idleTitle: "飛行中の艦隊はありません",
  idleDetailHasShips: "発進枠が空いています。襲撃、移送、採掘に使えます。探査機は発進枠を使いません。",
  idleDetailNoShips: "この惑星に艦船がいません。建造するか、帰還を待ってください。",
  idleAction: "標的を探す",

  baysFreeTitle_one: "発進枠が1つ空いています",
  baysFreeTitle_other: "発進枠が{{count}}個空いています",
  baysFreeDetail: "襲撃、移送、採掘はそれぞれ発進枠を1つ使います。探査機は使いません。",
  baysFreeAction: "行き先を探す",

  /** The card that carries the top directive. */
  kindThreat: "脅威",
  kindOpportunity: "機会",
  kindGrowth: "弱点",
  kindIdle: "保留中のものはありません",

  /** The fold. One word each way: the card is small enough that a label is the control. */
  hide: "隠す",
  show: "ショー",
} as const;

/** The seven kinds of news, turned into the sentences a player reads. */
export const notifications = {
  incomingFallback: "艦隊が到着します。",
  incomingLanded: "が着陸しました",
  incomingEta: "到着予定時刻 {{minutes}} 分",
  incomingLandsIn: "が {{duration}} に着陸します",
  incomingHead: "到着艦隊 · {{clock}}",
  strategicIncomingHead: "戦略兵器入荷・{{clock}}",
  incomingEstimate: "推定 {{count}} 隻",
  incomingFrom: "から{{origin}}",
  /** Which of the reader's own worlds is under the crosshair. Never a radar product. */
  incomingAt: "は {{world}} を対象としています",
  commanderAt: "{{username}} で {{planet}}",
  unknownCommander: "誰か",
  raidedBy: "レイダー: {{origin}} ·",
  composition: "{{count}} {{hull}}",
  join: " · ",

  raidedFallback: "襲撃されました。",
  repelledHead: "レイド撃退 · {{cost}}",
  repelledLost: "{{count}} 保持を失いました",
  repelledTheirs: "{{count}} 個が破壊されました",
  raided: "襲撃 · {{detail}}",
  raidedWorks: "は {{time}} よりも低く動作します",
  raidedTaken: "−{{amount}} が取得されました",
  raidedLost_one: "{{count}} ユニットが失われました",
  raidedLost_other: "{{count}} ユニットが失われました",
  dockedClause_one: "{{count}} 修理ステーションに発送",
  dockedClause_other: "{{count}} は修理ステーションに発送されます",
  patchedClause_one: "{{count}} パッチは無料です",
  patchedClause_other: "{{count}} パッチは無料です",
  damagedClause_one: "{{count}} が破損しています",
  damagedClause_other: "{{count}} が破損しています",
  radiationLostAll_one: "放射線により船が破壊されました {{way}}",
  radiationLostAll_other: "放射線によりすべての {{count}} 船が破壊されました {{way}}",
  radiationLost_one: "放射線破壊 {{count}}船 {{way}}・{{left}}飛行",
  radiationLost_other: "放射線破壊 {{count}}船 {{way}}・{{left}}飛行",
  radiationWay: "途中です",
  radiationWayTo: "{{name}} へ向かう途中",
  raidedNothing: "襲撃されました · 彼らは何も得られませんでした",
  /** Taktik geri çekilme, defender: the ships ran, or the tank could not lift them. */
  raidedEscaped_one: "{{count}} 船が離陸しました",
  raidedEscaped_other: "{{count}} 船が離陸しました",
  raidedStranded_one: "タンクは {{count}} 船を持ち上げることができませんでした",
  raidedStranded_other: "タンクは {{count}} 船を持ち上げることができませんでした",
  /** Taktik geri çekilme, raider: the line emptied — nothing about what it held. */
  raidTargetFled: "彼らの船は離陸しました",

  raidResultFallback: "襲撃は解決されました。",
  raidWiped: "{{target}} 保持 · あなたの艦隊は破壊されました · {{count}} 隻の船が失われました",
  raidResult: "{{grade}} で {{target}} · {{detail}} · {{count}} 船舶が失われました",
  raidNothing: "何も取得されませんでした",
  spoilAlloy: "+{{amount}} 合金",
  spoilCrystal: "+{{amount}} クリスタル",
  spoilDeuterium: "+{{amount}} 重水素",
  /** What a raid's Garbage Collectors lifted off the wreck — never counted as loot. D200. */
  spoilSalvage: "+{{amount}} サルベージ",

  fleetFallback: "艦隊は帰国しました。",
  fleetHomeLooted: "艦隊本拠地{{where}} · {{count}} 船 · +{{amount}} 略奪されました",
  fleetHomeEmpty: "艦隊ホーム{{where}}・{{count}}船・手ぶら",
  fleetHomeRecalled: "艦隊の本拠地{{where}} · {{count}} の船 · 攻撃前にコールバックされました",
  /** Nothing looted, but the collectors' salvage follows it — so not "empty-handed". */
  fleetHomeBare: "艦隊本拠地{{where}}・{{count}}艦",
  /**
   * THE MERCHANT'S OWN HOMECOMING. D166.
   *
   * A swap is not a raid, so it never borrows the plunder wording — and a
   * convoy that bought nothing is a different fact from a fleet that found
   * nothing, which is why the empty case has its own line.
   */
  tradeHome: "護送隊ホーム · {{count}} 船 · {{landed}} 購入",
  tradeHomeEmpty: "護送船団ホーム · {{count}} 船 · 何も購入されていません",
  /**
   * THE PIRATE LANE HAS ITS OWN HOMECOMING AND ITS OWN EMPTY TRIP. D177.
   *
   * A pirate is not a commander: there is no world to come back FROM by name
   * and no ledger that moved, so these never borrow the raid's wording. And a
   * flight that arrived at nothing is a different fact from one that fought and
   * lost — it names what was gone and how many craft are turning back, and never
   * who got there first.
   */
  targetGonePirate: "海賊 {{callsign}} はすでに破壊されました · {{count}} 船は引き返します",
  targetGoneAsteroid: "あなたが到着する前に岩は剥ぎ取られました · {{count}} ドリルが引き返します",
  targetGoneDebris: "残骸フィールドはすでにきれいに拾われました · {{count}} ドリルが引き返す",
  pirateHome: "レイダーの本拠地 · {{count}} 船 · +{{amount}} 略奪",
  pirateHomeEmpty: "レイダーズ ホーム · {{count}} 船 · 手ぶら",
  pirateHomeBare: "レイダース ホーム · {{count}} 船",
  pirateHomeTowed_looted: "襲撃者の本拠地 · {{count}} 船 · +{{amount}} 略奪 · {{hull}} 捕獲",
  pirateHomeTowed_empty: "レイダーのホーム · {{count}} 船 · {{hull}} 捕獲",
  fleetFrom: "から{{origin}}",
  probeLost: "あなたの探査機は失われました · その飛行は完了できませんでした",
  recalled: "{{count}} クラフトが返送されました · フライトを完了できませんでした",
  miningRecalledHome: "{{count}} プロスペクターズ ホーム · リコール完了",
  transferReturningCapacity: "{{target}}から戻る転送・目的地の定員が満たされたフライト",
  transferReturningOwnership: "{{target}}から戻ってきた転送 · 飛行中に世界が交代しました",

  salvageWord: "サルベージ",
  oreWord: "鉱石",
  haulWasted: "{{what}} ホーム · 利用可能な容量がありません · {{amount}} は破棄されました",
  haulNothing: "{{what}} 家に帰ります · 持っていくものは何もありません",
  haulPartly: "{{what}} ホーム · {{landed}} · {{amount}} 紛失、フル動作",
  haul: "{{what}} ホーム · {{landed}}",

  scanDetected: "スキャンが検出されました。誰かがあなたの世界に関する情報を収集しています。",

  probeFallback: "プローブがホームにあります。その報告書は読みやすい。",
  probeHome: "プローブホーム・{{target}} が読み取り可能です{{caught}}",
  probeCaught: "· 彼らはそれを捕まえました",

  unlock: "{{title}} — {{body}}",
  deathStarFallback: "デス・スター攻撃の結果が確定しました。",
  deathStar: {
    FIRST_STRIKE: "EMP 衝撃 · イージス が排出されました。地上防衛は1時間オフライン",
    CAPTURED: "デス・スター 衝撃・コロニー捕獲",
    INEFFECTIVE: "デス・スター 影響・影響なし",
  },
  colonyCaptured: "コロニーは確保されました · 占領保護は有効です",
  colonyLost: "{{planet}}が離脱し、中立になりました",
  colonyLostUnnamed: "植民地が離脱し、中立になりました",
  deathStarColony: "EMP着弾 · 植民地の忠誠度 {{before}}% → {{after}}%",
  deathStarSeceded: "EMP着弾 · 植民地が離脱し、中立になりました",
  colonyFault: "{{planet}} · {{fault}}",
  colonyLoyalty: "{{planet}} が滑っています — {{count}} のものが壊れており、{{time}} で独立を宣言します。",
  settlementLost: "入植競争に敗れました · クーリエと貨物が帰還中です",
  interceptedDefended: "あなたのグリッドは デス・スター {{range}} ユニットを破壊しました。",
  interceptedLost: "あなたの デス・スター は目標まで {{range}} ユニット手前で破壊されました。",
  interceptedFallback: "デス・スター は飛行中に破壊されました。",
  asteroidShowerStarted: "銀河で小惑星シャワーが始まりました。",
  asteroidShowerEnded: "小惑星シャワーは終了しました。小惑星の出現は通常に戻りました。",
  tradeShipStarted: "貿易船が銀河にあります · {{alloy}} 合金 = 1 重水素。",
  tradeShipEnded: "貿易船が銀河を去りました。",
  intergalacticConvoyStarted: "銀河間輸送船団が銀河を横断中です。",
  intergalacticConvoyEnded: "銀河間輸送船団が出発しました。",
  intergalacticConvoyResult: "輸送船団への攻撃結果が確定・{{resources}}・報酬の艦船：{{ships}}・帰還中。",
  intergalacticConvoyHome: "護送隊がホームを攻撃 · {{resources}} · 賞品: {{ships}}。",
  intergalacticConvoyNoResources: "リソースがありません",
  intergalacticConvoyNoShip: "船なし",
} as const;

/**
 * TIME AND NUMBERS.
 *
 * Format primitives rather than sentences: the unit letters a countdown is built
 * from, and the two words that carry a reading's age. Everything here is read by
 * `lib/time.ts`, which is called from a dozen surfaces and must say the same thing
 * on every one of them.
 */
export const units = {
  now: "現在",
  live: "ライブ",
  ago: "{{duration}}前",
  imminent: "今すぐ",
  todayAt: "今日 {{time}}",
  yesterdayAt: "昨日 {{time}}",
  hoursMinutes: "{{h}}時間{{m}}分",
  minutesSeconds: "{{m}}分{{s}}秒",
  hoursMinutesSeconds: "{{h}}時間{{m}}分{{s}}秒",
  seconds: "{{s}}秒",
  daysHours: "{{d}}日{{h}}時間",
  minutes: "{{m}}分",
  /** Which BCP-47 locale groups thousands and formats decimals. */
  numberLocale: "ja-JP",
  thousands: "{{value}}k",
  millions: "{{value}}M",
  percent: "{{value}}%",
  rangeJoin: "–",
  plus: "+",
  minus: "−",
} as const;
