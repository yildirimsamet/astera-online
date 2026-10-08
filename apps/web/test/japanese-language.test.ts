import { afterEach, describe, expect, it } from 'vitest';
import { CHAT_LANGUAGES } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { setLanguage } from '../src/i18n/document.js';
import { ja } from '../src/i18n/locales/ja/index.js';
import {
  detectLanguage,
  LANGUAGE_LABEL,
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  LANGUAGE_SHORT,
  matchLanguage,
} from '../src/i18n/languages.js';

describe('Japanese language support', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
    document.documentElement.lang = 'en';
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    document.head.querySelector('meta[name="description"]')?.remove();
    document.head.querySelector('link[rel="manifest"]')?.remove();
  });

  it('recognises the browser and a saved choice, and offers a Japanese chat room', () => {
    expect(LANGUAGES).toContain('ja');
    expect(CHAT_LANGUAGES).toContain('ja');
    expect(LANGUAGE_LABEL.ja).toBe('日本語');
    expect(LANGUAGE_SHORT.ja).toBe('JA');
    expect(matchLanguage('ja-JP')).toBe('ja');
    expect(detectLanguage({ language: 'ja-JP', languages: ['ja-JP', 'en-US'] })).toBe('ja');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'ja');
    expect(detectLanguage({ language: 'tr-TR', languages: ['tr-TR'] })).toBe('ja');
  });

  it('renders Japanese copy, Japanese numbers, and both plural counts', async () => {
    await i18n.changeLanguage('ja');
    const text = i18n.t('landing.register');
    expect(text).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/u);
    expect(i18n.t('units.numberLocale')).toBe('ja-JP');
    expect(i18n.t('landing.form.passwordPlaceholder', { count: 8 })).toContain('8');
    for (const count of [1, 2]) {
      const copy = i18n.t('galaxy.fleetAway', { count });
      expect(copy).not.toContain('galaxy.fleetAway');
      expect(copy).toContain(String(count));
    }
  });

  it('synchronises the page language, description, and install manifest', async () => {
    const description = document.createElement('meta');
    description.name = 'description';
    document.head.append(description);
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    document.head.append(manifest);

    await setLanguage('ja');

    expect(document.documentElement.lang).toBe('ja');
    expect(description.content).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/u);
    expect(manifest.getAttribute('href')).toBe('/manifest.ja.webmanifest');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('ja');
  });

  it('uses game meanings for capital, settlement, stores, and remaining time', () => {
    expect(ja.galaxy.kindCapital).toBe('首都');
    expect(ja.vocabulary.building.VAULT.name).toBe('貯蔵庫');
    expect(ja.galaxy.settlementAway).toContain('入植隊');
    expect(ja.research.holdsName).toBe('プロスペクター船倉');
    expect(ja.trade.chipRemaining).not.toContain('左');
    expect(ja.galaxy.settlementAway).not.toContain('決済');
    expect(JSON.stringify(ja)).not.toMatch(/資本金|地球|横桟/u);
  });

  it('explains defensive weapons with their actual counts and effects', () => {
    expect(ja.planet.interceptor.ready).toContain('{{count}}');
    expect(ja.planet.interceptor.build).toContain('迎撃弾');
    expect(ja.planet.interceptor.hint).toContain('デス・スター');
    expect(ja.planet.deathStar.none).toContain('この惑星');
    expect(ja.planet.deathStar.dangerHint).toContain('1時間');
    expect(ja.planet.deathStar.dangerHint).toContain('{{loss}}');
  });

  it('uses game meanings in the first lesson, capacity, battle, and clan war', () => {
    expect(ja.academy.steps.production).toContain('生産');
    expect(ja.academy.steps.pirate).toContain('海賊');
    expect(ja.capacity.used).toBe('使用中');
    expect(ja.capacity.free).toBe('空き');
    expect(ja.reports.force.left).toBe('残存');
    expect(ja.vocabulary.hull.ARGOSY.tag).toBe('大型輸送艦');
    expect(ja.planetHero.defenceShips_other).toContain('隻');
    expect(ja.planetHero.defenceDocked_other).toContain('防衛しない');
    expect(ja.planetHero.vaultSafe).toContain('貯蔵庫');
    expect(ja.launch.commit).toContain('発進');
    expect(ja.itemSheet.orbitalFree).toContain('空き');
    expect(ja.dossier.interceptorEmpty).toContain('迎撃弾');
    expect(ja.errors.TIER_BAND).toContain('2ティア以上');
    expect(ja.errors.TIER_BAND_WEAK).toContain('2ティア以上');
    expect(ja.faults.name.SHIPYARD_REVOLT).toContain('造船所');
    expect(ja.clanWar.composer).toContain('攻撃隊');
    expect(ja.clanWar.seatNoWave).toContain('攻撃隊');
    expect(ja.focus.planet.settle).toContain('入植');
    expect(ja.focus.planet.settlementConfirm.race).toContain('2隻');
    expect(ja.reports.effects.shieldTheirs).toContain('吸収');
    expect(ja.reports.effects.shieldYours).toContain('吸収');
    expect(ja.planet.blocked.requirements).not.toContain('\n');
    expect(ja.upgradeRow.about).not.toContain('\n');
    expect(ja.notifications.intergalacticConvoyNoShip).not.toContain('\n');
  });

  it('uses Japanese time units and readable captions on the 350px galaxy screen', async () => {
    await i18n.changeLanguage('ja');
    expect(i18n.t('units.daysHours', { d: 1, h: 2 })).toBe('1日2時間');
    expect(i18n.t('units.minutesSeconds', { m: 2, s: 34 })).toBe('2分34秒');
    expect(ja.now.work).toBe('作業完了');
    expect(ja.galaxy.online).toContain('人がオンライン');
    expect(ja.galaxy.worlds).toContain('惑星');
    expect(ja.directives.undefendedShieldedTitle).toContain('シールドが切れるまで');
  });

  it('uses clear actions while the new commander claims a planet', () => {
    expect(ja.onboarding.claim.submit).toBe('惑星を確保する');
    expect(ja.onboarding.claim.lineName).toContain('{{name}}');
    expect(ja.onboarding.beats.briefing.mapOutcome).toContain('決める');
    expect(ja.onboarding.beats.fleet.title).toContain('2隻');
  });

  it('explains refusals with the game action and its consequence', () => {
    expect(ja.errors.NO_ACTIVE_CLAIM).toContain('入植');
    expect(ja.errors.CLAIM_EXPIRED).toContain('入植');
    expect(ja.errors.SETTLEMENT_REQUIREMENTS).toContain('クーリエ2隻');
    expect(ja.errors.BAD_FLEET).toContain('船数');
    expect(ja.errors.BASH_LIMIT).toContain('襲撃');
    expect(ja.errors.SHIELD_WOULD_DROP).toContain('シールドが解除');
    expect(ja.errors.CLAN_DEPOT_NO_ROOM).toContain('クランの資源');
    expect(ja.errors.INSUFFICIENT_FUEL).toContain('重水素');
  });

  it('keeps battle comparisons and flight direction meaningful in Japanese', () => {
    expect(ja.flightBar.out).toContain('出航');
    expect(ja.flightBar.back).toContain('帰還');
    expect(ja.flightBar.incoming).toContain('接近');
    expect(ja.counter.even).toBe('互角');
    expect(ja.counter.compareTheirs).toContain('現地');
    expect(ja.counter.escapeRun).toContain('燃料');
    expect(ja.counter.escapeRule).toContain('地上砲');
    expect(ja.counter.noteSomeAway).toContain('観測時');
    expect(ja.counter.matchupRemainder).toContain('強い艦種');
    expect(ja.counter.matchupProbe).toContain('探査機');
    expect(ja.spend.readingShort).toContain('不足');
  });

  it('states trade, convoy, and reward decisions without mistranslating actions', () => {
    expect(ja.trade.rateHeading).toContain('交換');
    expect(ja.trade.leavesIn).toContain('出発');
    expect(ja.trade.giveSpend).toContain('貯蔵庫');
    expect(ja.trade.noStock).toContain('貯蔵庫');
    expect(ja.trade.warning).toContain('呼び戻せません');
    expect(ja.convoy.open).toContain('攻撃');
    expect(ja.convoy.engagementLabel).toContain('攻撃');
    expect(ja.convoy.irreversible).toContain('呼び戻せません');
    expect(ja.convoy.landed).toContain('獲得');
    expect(ja.convoy.home).toContain('帰還');
    expect(ja.rewards.claim).toBe('受け取る');
    expect(ja.rewards.claimed).toBe('受取済み');
    expect(ja.rewards.social.handle).toBe('@JoinAstera');
    expect(ja.rewards.intro).toContain('略奪');
  });

  it('names clan actions and public events as game events', () => {
    expect(ja.clan.found.heading).toContain('設立');
    expect(ja.clan.found.submit).toContain('設立');
    expect(ja.clan.directory.apply).toBe('申請する');
    expect(ja.clan.requests.status.CLOSED).toBe('終了');
    expect(ja.clan.applications.heading).toBe('加入申請');
    expect(ja.clan.aid.toCommander).toContain('宛て');
    expect(ja.clan.aid.fromCommander).toContain('差出人');
    expect(ja.chronicle.launcherQuiet).toContain('静か');
    expect(ja.chronicle.neutralClaim).toContain('入植');
    expect(ja.chronicle.act.war.title).toContain('戦争期');
  });

  it('keeps settlement, launch, and transfer instructions actionable', () => {
    expect(ja.focus.planet.claimRaceExplain).toContain('クーリエ2隻');
    expect(ja.focus.planet.raidFleetExplain).toContain('クーリエ');
    expect(ja.focus.planet.settlementAwayExplain).toContain('呼び戻せません');
    expect(ja.focus.planet.claimRaidStillOpen).toContain('入植競争');
    expect(ja.action.short).toBe('不足');
    expect(ja.launch.away).toContain('出航中');
    expect(ja.transfer.fuelShort).toContain('不足');
    expect(ja.transfer.paceHint).toContain('12時間');
    expect(ja.transfer.rules).toContain('呼び戻せます');
    expect(ja.reports.effects.fled).toContain('燃料');
    expect(ja.directives.storageFullDetail).toContain('生産');
  });

  it('describes research gates and cosmetic purchases without literal mistranslations', () => {
    expect(ja.research.isotopeTag).toContain('採掘');
    expect(ja.research.yardTag).toContain('艦船');
    expect(ja.research.powerName).toContain('火力');
    expect(ja.research.industrialTag).toContain('修理');
    expect(ja.research.gridDetail).toContain('迎撃弾');
    expect(ja.research.stockpileDetail).toContain('迎撃弾');
    expect(ja.skins.oneTime).toContain('運営期間中');
    expect(ja.skins.shopierNote).toContain('{{commander}}');
    expect(ja.skins.worldsHint).toContain('外せます');
    expect(ja.seasonRecap.clan.recordOnly).toContain('戦力');
  });

  it('makes return from Silent Space a galaxy transfer request', () => {
    expect(ja.silentSpace.apply).toBe('帰還を申請');
    expect(ja.silentSpace.queued).toContain('帰還申請');
    expect(ja.silentSpace.queueHint).toContain('優先順位');
    expect(ja.silentSpace.unavailable).toContain('帰還申請');
  });

  it('keeps the command HUD and repair threshold precise', () => {
    expect(ja.fleetPage.shipsHome_one).toContain('駐留');
    expect(ja.reportScene.landing).toContain('20%を超');
    expect(ja.reportScene.intel).toContain('防衛情報');
    expect(ja.repairStation.outOfAction).toContain('20%を超');
    expect(ja.repairStation.ends).toContain('完了まで');
    expect(ja.away.scanDetail).toContain('情報');
    expect(ja.slot.dismiss).toBe('閉じる');
  });

  it('states colony costs and construction limits in the correct units', () => {
    expect(ja.focus.planet.settlementFuelExplain).toContain('クーリエ2隻');
    expect(ja.focus.planet.foundingAlloyExplain).toContain('返還');
    expect(ja.focus.planet.occupationProtected).toContain('占領');
    expect(ja.planet.buildSheet.yardFill).toContain('造船');
    expect(ja.planet.buildSheet.byBerth).toContain('停泊枠');
    expect(ja.planet.buildSheet.build).toContain('建造');
    expect(ja.dossier.surfaceGapLabel).toContain('惑星');
  });

  it('keeps flight recall, salvage timing, and target intelligence actionable', () => {
    expect(ja.pendingStrip.incomingFromAt).toContain('接近');
    expect(ja.pendingStrip.recallingProspectors).toContain('呼び戻し');
    expect(ja.pendingStrip.recallFleetStarted).toContain('帰還');
    expect(ja.pendingStrip.recallFleetStarted).toContain('飛行した時間');
    expect(ja.focus.asteroid.leavesIn).toContain('通過');
    expect(ja.focus.asteroid.noCraft).toContain('惑星');
    expect(ja.focus.debris.goneIn).toContain('消滅');
    expect(ja.focus.debris.noCraft).toContain('艦');
    expect(ja.dossier.hardwareNote).toContain('探査機');
    expect(ja.dossier.fleetGapRange).toContain('{{reach}}');
    expect(ja.dossier.stockNote).toContain('貯蔵庫');
    expect(ja.dossier.stockNote).toContain('船倉');
    expect(ja.signals.eyebrowUnread).toContain('新着');
    expect(ja.signals.status.disruptedLine).toContain('生産');
  });

  it('labels the persistent controls and map contacts with the right game actions', () => {
    expect(ja.statusBar.works.hintFull).toContain('生産');
    expect(ja.statusBar.works.collectedPartly).toContain('残っています');
    expect(ja.surface.waitingPlanet).toContain('惑星');
    expect(ja.menu.rewardsHint).toContain('報酬');
    expect(ja.menu.announcementsWaiting).toContain('新着');
    expect(ja.focus.run.homeIn).toContain('帰還');
    expect(ja.focus.thread.outbound).toContain('呼び戻');
    expect(ja.focus.contact.titleBattle).toContain('攻撃');
    expect(ja.focus.contact.eyebrowInbound).toContain('接近');
    expect(ja.focus.contact.unknownHint).toContain('艦船');
    expect(ja.focus.contact.boundaryBattle).toContain('不明');
  });

  it('contains no recurring literal machine translations of game terms', () => {
    const copy = JSON.stringify(ja).replaceAll('この世界', '');
    const mistranslations = ['この世', '出荷', 'ストライキ', '返品', '戦車', '飛行機', '閉店', '偶数'];
    expect(mistranslations.filter((term) => copy.includes(term))).toEqual([]);
  });
});
