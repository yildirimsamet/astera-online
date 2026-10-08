import {
  ABUSE, ANTI_STRATEGIC, BUILD, COMBAT, CORE_TOP_LEVEL, DEATH_STAR, DEUTERIUM,
  DISRUPTION, ECON, ESCAPE, FAULT, HANGAR, HULLS, INSTRUMENT_MAX_LEVEL, MULTI_WORLD,
  PROBE, PROSPECTOR, PIRATE, RESEARCH_PROJECTS, SEASON, SHIP_DAMAGE, SALVAGE, CLAN,
  CLAN_SUPPORT, CLAN_LEVEL_MAX, GALAXY_EVENTS, TRADE, MONUMENT_SEASON_DEFAULTS,
  CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION, INACTIVITY_MS, SILENT_SPACE, SETTLEMENT_CLAIM_MINUTES, SETTLEMENT_PRIORITY_MINUTES, TRAVEL,
  alloyRate, buildingCost, buildingMinutes, crystalRate, deuteriumRate,
  flightSlots, groundSlots, hangarCapacity, hullBulk, shipyardTimeReduction, instrumentCost, radarRange,
  researchEffectAt, satelliteCost, satelliteSlots, shieldHp, telescopeSlots,
  telescopeRange, telescopeWatchRange, telescopeCooldownHours, researchMinutes,
  clanHangarCapacity, clanLevelUpgradeCost, seasonRankRewardProgram, storageHours,
  type Resources,
} from '@astera/rules';
import { type WikiBlock, type WikiLanguage, type WikiSection, type WikiSubject } from './model.js';
import { wikiLabels } from './labels.js';
import { vocabulary as en } from '../i18n/locales/en/data.js';
import { vocabulary as tr } from '../i18n/locales/tr/data.js';

export const number = (value: number, language: WikiLanguage): string => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
const hours = (value: number, language: WikiLanguage): string => `${number(value, language)} ${language === 'en' ? 'h' : 'sa'}`;
const percent = (value: number, language: WikiLanguage): string => language === 'tr' ? `%${number(value * 100, language)}` : `${number(value * 100, language)}%`;
const label = (language: WikiLanguage, en: string, tr: string): string => language === 'en' ? en : tr;
const costCells = (cost: Resources, language: WikiLanguage): string[] => [cost.alloy, cost.crystal, cost.deuterium].map(v => number(v, language));
const resourceColumns = (language: WikiLanguage): string[] => language === 'en' ? ['Alloy', 'Crystal', 'Deuterium'] : ['Alaşım', 'Kristal', 'Döteryum'];
const table = (caption: string, columns: readonly string[], rows: readonly (readonly string[])[]): WikiBlock => ({ kind: 'table', caption, columns, rows });
const pairs = (language: WikiLanguage, caption: string, rows: readonly (readonly string[])[]): WikiBlock => table(caption, [label(language, 'Rule', 'Kural'), label(language, 'Value', 'Değer')], rows);

export function subjectReference(subject: WikiSubject, language: WikiLanguage): WikiSection {
  const words = wikiLabels[language];
  let blocks: WikiBlock[];
  const n = (v: number): string => number(v, language);
  const level = label(language, 'Level reached', 'Ulaşılan seviye');
  switch (subject.kind) {
    case 'hull': {
      const h = HULLS[subject.id];
      blocks = [{ kind: 'note', text: words.ruleNote }, { kind: 'stats', items: [
        { key: 'attack', label: label(language, 'Attack', 'Saldırı'), value: n(h.atk) },
        { key: 'hull', label: label(language, 'Hull strength (HP)', 'Gövde dayanımı (HP)'), value: n(h.hp) },
        { key: 'speed', label: label(language, 'Speed (map units/min)', 'Hız (harita birimi/dakika)'), value: h.ground ? label(language, 'Cannot fly', 'Uçamaz') : n(h.speed / TRAVEL.distanceFactor) },
        { key: 'cargo', label: label(language, 'Cargo capacity (resources)', 'Kargo kapasitesi (kaynak)'), value: n(h.cargo) },
        { key: 'bulk', label: h.ground ? label(language, 'Ground capacity used', 'Kullanılan yer kapasitesi') : label(language, 'Hangar room used', 'Kullanılan Hangar alanı'), value: n(hullBulk(h.id)) },
      ] }, table(label(language, 'Cost of one unit', 'Bir birimin bedeli'), resourceColumns(language), [costCells(h, language)])];
      break;
    }
    case 'research': {
      const project = RESEARCH_PROJECTS[subject.id];
      blocks = [{ kind: 'note', text: label(language, 'Each row is the separate cost of reaching that level. Research time uses your capital’s Core even when a colony pays the bill.', "Her satır o seviyeye ulaşmak için ayrı ödenecek bedeldir. Ödemeyi koloni yapsa da araştırma süresi ana gezegenindeki Çekirdeğe bağlıdır.") }, table(label(language, 'Research levels', 'Araştırma seviyeleri'),
        [level, ...resourceColumns(language), label(language, 'Effect', 'Etki')],
        Array.from({ length: project.maxLevel }, (_, index) => {
          const rung = index + 1;
          const effect = researchEffectAt(subject.id, rung);
          let text = n(effect);
          if (subject.id === 'YARD_AUTOMATION' || subject.id === 'AI_ROBOTS') text = label(language, `${n(effect * 100)}% of base build time`, `Temel üretim süresinin %${n(effect * 100)}’i`);
          if (subject.id === 'PROSPECTOR_HOLDS') text = label(language, `${n(effect)}× mining capacity`, `${n(effect)} kat maden kapasitesi`);
          if (subject.id === 'CARGO_HOLDS') text = label(language, `${n(effect)}× cargo capacity`, `${n(effect)} kat kargo kapasitesi`);
          if (subject.id === 'SHIP_POWER') text = label(language, `${n(effect)}× ship attack`, `${n(effect)} kat gemi saldırısı`);
          if (subject.id === 'SHIP_ARMOR') text = label(language, `${n(effect)}× hull strength`, `${n(effect)} kat gövde dayanımı`);
          if (subject.id === 'SHIP_PROPULSION') text = label(language, `${n(effect)}× ship speed`, `${n(effect)} kat gemi hızı`);
          if (subject.id === 'EMPLACEMENT_DOCTRINE') text = label(language, `${n(effect)}× ground attack and hull strength`, `${n(effect)} kat yer savunması saldırısı ve dayanımı`);
          if (subject.id === 'INDUSTRIAL') text = label(language, `${n(effect)}% of repair cost & time`, `Onarım bedeli ve süresinin %${n(effect)}’i`);
          if (subject.id === 'STARSHIP_ENGINEERING') text = label(language, `Engineering requirement for tier ${rung + 2} ships met`, `${rung + 2}. kademe gemilerin mühendislik koşulu karşılanır`);
          if (['ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES'].includes(subject.id)) text = label(language, 'Unlocks the feature described above', 'Yukarıda açıklanan özelliği açar');
          if (subject.id === 'DEUTERIUM_SYNTHESIS') text = label(language, `Maximum Deuterium Refinery level: ${n(effect)}`, `Döteryum Rafinerisi seviye sınırı: ${n(effect)}`);
          if (subject.id === 'STRATEGIC_STOCKPILE') text = label(language, `${n(effect)} weapons per world`, `Gezegen başına ${n(effect)} silah`);
          if (subject.id === 'INTERCEPTION_GRID') text = label(language, `${n(effect)} charges per world`, `Gezegen başına ${n(effect)} önleyici şarj`);
          return [n(rung), ...costCells(project.costAt(rung), language), text];
        })), pairs(language, label(language, 'Research availability', 'Araştırma uygunluğu'), [
          [label(language, 'Available after season starts', 'Sezon başladıktan sonra açılır'), hours(project.availableAtMinutes / 60, language)],
          [label(language, 'Capital Core requirement', "Ana gezegen Çekirdeği şartı"), project.requiredCore ? n(project.requiredCore) : label(language, 'No additional level requirement', 'Ek seviye koşulu yok')],
          [label(language, 'L1 time at capital Core 1', "Ana gezegen Çekirdeği 1 iken ilk seviye süresi"), `${n(researchMinutes(project.costAt(1), 1))} min`],
        ])];
      break;
    }
    case 'building': {
      const id = subject.id;
      const max = id === 'HANGAR' ? HANGAR.maxLevel : id === 'DEUTERIUM_PLANT' ? DEUTERIUM.plantLevelsPerResearch * RESEARCH_PROJECTS.DEUTERIUM_SYNTHESIS.maxLevel : CORE_TOP_LEVEL;
      const effectName = id === 'HANGAR' ? label(language, 'Hangar room', 'Hangar alanı') : id === 'VAULT' ? label(language, 'Base storage hours', 'Temel depolama saati') : id === 'SHIPYARD' ? label(language, 'Production time saved vs previous level', 'Önceki seviyeye göre üretim süresindeki azalma') : label(language, 'Production per hour', 'Saatlik üretim');
      const effect = (rung: number): string => {
        if (id === 'HANGAR') return n(hangarCapacity(rung));
        if (id === 'VAULT') return n(storageHours(rung));
        if (id === 'SHIPYARD') return percent(Math.round(shipyardTimeReduction(rung - 1) * 1000) / 1000, language);
        return n(id === 'REFINERY' ? alloyRate(rung) : id === 'EXTRACTOR' ? crystalRate(rung) : deuteriumRate(rung));
      };
      blocks = [{ kind: 'note', text: words.priceNote }, table(label(language, 'Upgrade reference levels', 'Yükseltme referans seviyeleri'),
        [level, ...resourceColumns(language), ...(id === 'CORE' ? [label(language, 'Flight bays', 'Uçuş rampaları'), label(language, 'Orbit slots', 'Yörünge yuvaları'), label(language, 'Ground-defence capacity', 'Yer savunması kapasitesi')] : [effectName]), label(language, 'Base build minutes', 'Temel kurulum dakikası')],
        Array.from({ length: max }, (_, index) => { const rung = index + 1; return [n(rung), ...costCells(buildingCost(id, rung - 1), language), ...(id === 'CORE' ? [n(flightSlots(rung)), n(satelliteSlots(rung)), n(groundSlots(rung))] : [effect(rung)]), n(buildingMinutes(id, rung, {}))]; })),
        { kind: 'note', text: label(language, 'The table shows reference levels, not a universal building cap. The Hangar has its own fixed top; other local buildings obey the Core, and Deuterium Refinery also obeys Synthesis. Production rows exclude satellites and temporary effects.', 'Tablo referans seviyelerini gösterir; tüm binalara ortak tavan değildir. Hangarın sabit kendi tavanı vardır; diğer yerel binalar Çekirdeğe, Döteryum Rafinerisi ayrıca Senteze bağlıdır. Üretim satırları uydu ve geçici etki içermez.') }];
      if (id === 'SHIPYARD') blocks.unshift({ kind: 'note', text: label(language, 'Time saved applies to ships and ground defences. Each row compares with the previous Shipyard level, with the same research bonuses.', 'Süre azalması gemiler ve yer savunmaları için geçerlidir. Her satır, araştırma bonusları aynı kalırken bir önceki Tersane seviyesiyle karşılaştırılır.') });
      break;
    }
    case 'instrument': {
      const id = subject.id;
      const max = INSTRUMENT_MAX_LEVEL[id];
      const columns = [level, ...resourceColumns(language)];
      if (id === 'TELESCOPE') columns.push(label(language, 'Contact range (map units)', 'Tanımlama menzili (harita birimi)'), label(language, 'Watch range (map units)', 'Gözlem menzili (harita birimi)'), label(language, 'Watch slots', 'Gözlem yuvası'), label(language, 'Cooldown hours', 'Bekleme saati'));
      if (id === 'RADAR') columns.push(label(language, 'Warning range (map units)', 'Uyarı menzili (harita birimi)'));
      if (id === 'AEGIS') columns.push(label(language, 'Maximum shield strength (HP)', 'Azami kalkan dayanımı (HP)'));
      blocks = [table(label(language, 'Instrument levels', 'Gezegen cihazı seviyeleri'), columns,
        Array.from({ length: max ?? 8 }, (_, index) => {
          const rung = index + 1; const cells = [n(rung), ...costCells(instrumentCost(id, rung - 1), language)];
          if (id === 'TELESCOPE') cells.push(n(telescopeRange(rung)), n(telescopeWatchRange(rung)), n(telescopeSlots(rung)), n(telescopeCooldownHours(rung)));
          if (id === 'RADAR') cells.push(n(radarRange(rung)));
          if (id === 'AEGIS') cells.push(n(shieldHp(rung)));
          return cells;
        })), { kind: 'note', text: max === null ? label(language, 'These are example levels. This instrument has no fixed maximum level, but cannot exceed the local Command Core level.', 'Bunlar örnek seviyelerdir. Bu cihazın sabit bir seviye sınırı yoktur; gezegenin Komuta Çekirdeği seviyesini aşamaz.') : label(language, `This instrument can reach level ${n(max)}. The local Command Core must also support the level you want to build.`, `Bu cihaz en fazla ${n(max)}. seviyeye yükseltilebilir. Kurmak istediğin seviyeye gezegenin Komuta Çekirdeği de izin vermelidir.`) }];
      break;
    }
    case 'satellite':
      blocks = [table(label(language, 'One-time installation cost', 'Bir defalık kurulum bedeli'), resourceColumns(language), [costCells(satelliteCost(subject.id), language)]),
        { kind: 'note', text: label(language, 'Each world can install one of each satellite type. Every satellite uses one orbit slot. Its effect applies only to its own world and the actions described above.', 'Her gezegene her uydu türünden bir tane kurulabilir. Her uydu bir yörünge yuvası kullanır. Etkisi yalnız kurulduğu gezegene ve yukarıda açıklanan işlemlere uygulanır.') }];
  }
  return { id: 'reference', title: words.numbers, blocks };
}

export function conceptReference(id: string, language: WikiLanguage): WikiSection | undefined {
  const n = (v: number): string => number(v, language);
  const t = (en: string, tr: string): string => label(language, en, tr);
  let blocks: WikiBlock[] = [];
  if (id === 'fleet.flights') blocks = [pairs(language, t('Choosing a slower flight', 'Daha yavaş uçuş seçmek'), [
    [t('Maximum duration of each slowed leg', 'Yavaşlatılan her uçuş bölümünün süre sınırı'), hours(TRAVEL.pacedFlightCapMinutes / 60, language)],
  ])];
  if (id === 'worlds.settlement') blocks = [pairs(language, t('Settlement requirements', 'Yerleşim şartları'), [
    [t('Capital Core for each colony slot', "Her koloni yuvası için ana gezegen Çekirdeği"), MULTI_WORLD.colonyCoreThresholds.map(n).join(' / ')],
    [t('Couriers required', 'Gereken Kurye sayısı'), n(MULTI_WORLD.settlement.transports)],
    [t('Settlement period after victory', 'Zaferden sonra yerleşim süresi'), `${n(SETTLEMENT_CLAIM_MINUTES)} min`], [t('Raid winner’s settlement priority', 'Akın galibinin yerleşim önceliği'), `${n(SETTLEMENT_PRIORITY_MINUTES)} min`],
    [t('Occupation protection', 'İşgal koruması'), hours(MULTI_WORLD.occupationMinutes / 60, language)],
  ]), table(t('Founding charge, excluding flight fuel', 'Uçuş yakıtı hariç kuruluş bedeli'), resourceColumns(language), [costCells(MULTI_WORLD.settlement.charge, language)])];
  if (id === 'economy.queues') blocks = [pairs(language, t('Queue limits', 'Sipariş sırası sınırları'), [
    [t('Orders per queue, including the active order', 'Aktif iş dahil sıra başına sipariş'), n(BUILD.queueDepth)], [t('Cancellation refund', 'İptal iadesi'), percent(BUILD.cancelRefund, language)],
  ])];
  if (id === 'economy.collectors') blocks = [pairs(language, t('Works capacity', 'Havuz kapasitesi'), [[t('Hours of production that fit in the Works', 'Havuza sığan saatlik üretim'), n(ECON.collectorHours)]])];
  if (id === 'combat.counters') blocks = [table(t('Damage matchup', 'Hasar eşleşmesi'), [t('Firing class', 'Ateş eden sınıf'), t('Strong against', 'Güçlü olduğu'), t('Weak against', 'Zayıf olduğu')], [
    [t(en.combatClass.SKIRMISHER.name, tr.combatClass.SKIRMISHER.name), `${t(en.combatClass.BULWARK.name, tr.combatClass.BULWARK.name)} ×${n(COMBAT.strongMult)}`, `${t(en.combatClass.LANCE.name, tr.combatClass.LANCE.name)} ×${n(COMBAT.weakMult)}`],
    [t(en.combatClass.BULWARK.name, tr.combatClass.BULWARK.name), `${t(en.combatClass.LANCE.name, tr.combatClass.LANCE.name)} ×${n(COMBAT.strongMult)}`, `${t(en.combatClass.SKIRMISHER.name, tr.combatClass.SKIRMISHER.name)} ×${n(COMBAT.weakMult)}`],
    [t(en.combatClass.LANCE.name, tr.combatClass.LANCE.name), `${t(en.combatClass.SKIRMISHER.name, tr.combatClass.SKIRMISHER.name)} ×${n(COMBAT.strongMult)}`, `${t(en.combatClass.BULWARK.name, tr.combatClass.BULWARK.name)} ×${n(COMBAT.weakMult)}`],
  ])];
  if (id === 'combat.model' || id === 'combat.loot') blocks = [pairs(language, t('Battle outcome rules', 'Savaş sonuç kuralları'), [
    [t('Maximum rounds', 'Azami tur'), n(COMBAT.rounds)],
    [t('Partial: defending value destroyed', 'Kısmi: yok edilen savunma değeri'), percent(COMBAT.partialThreshold, language)],
    [t('Decisive victory: exposed loot taken', 'Kesin zaferde alınan korumasız ganimet'), percent(COMBAT.lootDecisive, language)],
    [t('Partial success: exposed loot taken', 'Kısmi başarıda alınan korumasız ganimet'), percent(COMBAT.lootPartial, language)],
    [t('Uncollected production exposed to raids', 'Akınla alınabilecek Havuz payı'), percent(COMBAT.lootBufferShare, language)],
    [t('Production pause after decisive victory', 'Kesin zaferden sonra üretim durması'), `${n(DISRUPTION.decisiveMinutes)} min`],
    [t('Production pause after partial success', 'Kısmi başarıdan sonra üretim durması'), `${n(DISRUPTION.partialMinutes)} min`],
    [t('Ground losses rebuilt free', 'Ücretsiz yenilenen yer kaybı'), percent(COMBAT.defenceSalvage, language)],
    [t('Wreck resources per surviving Garbage Collector', 'Sağ kalan Hurdacı başına enkaz kaynağı'), n(SALVAGE.perCollector)],
  ])];
  if (id === 'combat.eligibility') blocks = [pairs(language, t('PvP boundaries', 'PvP sınırları'), [
    [t('Development tier', 'Gelişim kademesi'), t('Highest owned Core level ÷ 3, rounded up', 'Sahip olduğun en yüksek Çekirdek seviyesi ÷ 3; yukarı yuvarlanır')],
    [t('Maximum tier difference', 'İzin verilen kademe farkı'), `±${n(ABUSE.tierBand)}`],
    [t('Personal raids on one commander', 'Aynı komutana kişisel akın sınırı'), `${n(ABUSE.bashLimit)} / ${hours(ABUSE.bashWindowMinutes / 60, language)}`],
    [t('Clan raids on one commander', 'Aynı komutana klan akını sınırı'), `${n(CLAN.attackLimit)} / ${hours(CLAN.attackWindowMinutes / 60, language)}`],
    [t('Newcomer shield', 'Yeni oyuncu kalkanı'), hours(ABUSE.newcomerShieldHours, language)],
    [t('Recovery shield when granted', 'Verildiğinde toparlanma kalkanı'), hours(ABUSE.recoveryShieldHours, language)],
  ])];
  if (id === 'combat.retreat') blocks = [pairs(language, t('Retreat inputs', 'Çekilme girdileri'), [
    [t('Minimum fighting ships', 'Asgari savaş gemisi'), n(ESCAPE.minimumCombatShips)], [t('Attacking armed-unit value / defending armed-unit value', 'Saldıran silahlı birimlerin değeri / savunan silahlı birimlerin değeri'), `${n(ESCAPE.ratio)}×`],
  ])];
  if (id === 'combat.death-star') blocks = [pairs(language, t('Strategic weapon requirements', 'Stratejik silah şartları'), [
    [t('Local Command Core level', 'Gezegenin Komuta Çekirdeği seviyesi'), n(DEATH_STAR.requiredCore)],
    [t('Local Shipyard level', 'Gezegenin Tersane seviyesi'), n(DEATH_STAR.requiredShipyard)],
    [t('Build minutes per weapon', 'Silah başına kurulum dakikası'), n(DEATH_STAR.buildMinutes)],
    [t('EMP duration', 'EMP süresi'), `${n(DEATH_STAR.empMinutes)} min`],
    [t('Colony loyalty loss per hit', 'Vuruş başına koloni sadakat kaybı'), n(DEATH_STAR.colonyLoyaltyLoss)],
    [t('Weapons per world without Strategic Stockpile', 'Stratejik Stok olmadan gezegen başına silah'), n(DEATH_STAR.perWorld.base)],
    [t('Weapons per world with Strategic Stockpile', 'Stratejik Stok ile gezegen başına silah'), n(DEATH_STAR.perWorld.researched)],
  ]), table(t('One weapon, excluding flight fuel', 'Uçuş yakıtı hariç bir silah'), resourceColumns(language), [costCells(DEATH_STAR.cost, language)])];
  if (id === 'combat.interception') blocks = [pairs(language, t('Interceptor requirements', 'Önleyici şartları'), [
    [t('Required local Radar with Uplink', 'Antenle gereken yerel Radar'), n(ANTI_STRATEGIC.requiredRadar)],
    [t('Charges per world without Interception Grid', 'Önleme Ağı olmadan gezegen başına şarj'), n(ANTI_STRATEGIC.charges.base)],
    [t('Charges per world with Interception Grid', 'Önleme Ağı ile gezegen başına şarj'), n(ANTI_STRATEGIC.charges.researched)],
    [t('Build minutes per charge', 'Şarj başına kurulum dakikası'), n(ANTI_STRATEGIC.buildMinutes)],
  ]), table(t('One charge', 'Bir şarj'), resourceColumns(language), [costCells(ANTI_STRATEGIC.cost, language)])];
  if (id === 'fleet.repairs') blocks = [pairs(language, t('Repair threshold', 'Onarım eşiği'), [
    [t('Free landing repair: damage at most', 'Ücretsiz iniş onarımı: en çok hasar'), `${n(SHIP_DAMAGE.autoRepairMaxBp / 100)}%`],
    [t('Repair orders, including the active order', 'Aktif iş dahil onarım siparişi sınırı'), n(BUILD.queueDepth)],
  ])];
  if (id === 'intel.probes') blocks = [table(t('Resource cost of one planet probe', 'Bir gezegen sondasının kaynak bedeli'), resourceColumns(language), [costCells({ alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 }, language)])];
  if (id === 'worlds.colonies') blocks = [pairs(language, t('Colony maintenance', 'Koloni bakımı'), [
    [t('Faults possible from local Core', 'Arıza çıkabilen yerel Çekirdek'), n(FAULT.minCoreLevel)],
    [t('Full loyalty', 'Tam sadakat'), n(FAULT.loyaltyMax)],
    [t('Loyalty points lost after a decisive defeat', 'Kesin yenilgide kaybedilen sadakat puanı'), n(FAULT.battleLoyaltyLoss.DECISIVE)],
    [t('Loyalty points lost after a partial breach', 'Kısmi başarıya karşı kaybedilen sadakat puanı'), n(FAULT.battleLoyaltyLoss.PARTIAL)],
    [t('Fault repair queue depth', "Arıza onarım sırası"), n(FAULT.repairSlots)],
    [t('Fault repair time range', 'Arıza onarım süre aralığı'), `${n(FAULT.repairMinMinutes)}–${n(FAULT.repairMaxMinutes)} min`],
  ])];
  if (id === 'galaxy.trade') blocks = [pairs(language, t('Equal trade value', 'Eşit ticaret değeri'), [
    [t('Alloy / crystal / deuterium', 'Alaşım / kristal / döteryum'), `${n(TRADE.rate.deuterium / TRADE.rate.alloy)} / ${n(TRADE.rate.deuterium / TRADE.rate.crystal)} / 1`],
  ])];
  if (id === 'galaxy.mining') blocks = [pairs(language, t('Base Prospector reference', 'Temel Kazıcı referansı'), [
    [t('Base mining hold', 'Temel maden ambarı'), n(PROSPECTOR.hold)],
    [t('Prospectors per world without research', 'Araştırma olmadan gezegen başına Kazıcı'), n(PROSPECTOR.max)],
    [t('Prospector Holds level that opens the third slot', 'Üçüncü yuvayı açan Kazıcı Ambarları seviyesi'), n(PROSPECTOR.thirdCraftRung)],
    [t('Outbound speed (map units/min)', 'Gidiş hızı (harita birimi/dakika)'), n(PROSPECTOR.speed / TRAVEL.distanceFactor)],
    [t('Loaded return speed (map units/min)', 'Yüklü dönüş hızı (harita birimi/dakika)'), n(PROSPECTOR.speed * PROSPECTOR.returnSpeedFactor / TRAVEL.distanceFactor)],
    [t('Trips shorter than this trigger a cooldown', 'Bu süreden kısa seferlerde bekleme uygulanır'), `${n(PROSPECTOR.shortTripMinutes)} min`],
    [t('Cooldown after a short trip', 'Kısa seferden sonra yeniden gönderim beklemesi'), `${n(PROSPECTOR.shortTripCooldownMinutes)} min`],
  ])];
  if (id === 'galaxy.pirates') blocks = [table(t('Pirate levels · capture chance after a decisive win', 'Korsan seviyeleri · kesin zaferden sonra ele geçirme şansı'), [t('Level', 'Seviye'), t('Pirate damage multiplier', 'Korsan hasar çarpanı'), t('Captured ship chance', 'Ele geçirilen gemi şansı')], ([1, 2, 3, 4] as const).map(level => [n(level), `${n(PIRATE.damageMult[level])}×`, percent(PIRATE.captureChance[level], language)]))];
  if (id === 'galaxy.monuments') blocks = [pairs(language, t('Default monument reference', 'Temel anıt referansı'), [
    [t('Monuments per galaxy', 'Galaksi başına anıt'), n(MONUMENT_SEASON_DEFAULTS.count)],
    [t('Deuterium per minute per monument', 'Anıt başına dakikalık döteryum'), n(MONUMENT_SEASON_DEFAULTS.productionPerMinute)],
    [t('Hull strength lost per ship per minute (HP)', 'Gemi başına dakikalık dayanım kaybı (HP)'), n(MONUMENT_SEASON_DEFAULTS.intensityHpPerMinute)],
    [t('Holding fleet capacity', 'Anıtta kalan filo kapasitesi'), n(MONUMENT_SEASON_DEFAULTS.capacity)],
    [t('Probe loss chance', 'Sonda kayıp şansı'), '90%'],
  ])];
  if (id === 'clan.membership') blocks = [pairs(language, t('Membership reference', 'Üyelik referansı'), [
    [t('Members including leader', 'Lider dahil üyeler'), n(CLAN.maxMembers)], [t('Founder capital Core', "Kurucu ana gezegen Çekirdeği"), n(CLAN.founderCoreLevel)],
    [t('Waiting period for aid and joint attacks', 'Yardım ve ortak saldırı için üyelik beklemesi'), hours(CLAN.adaptationMinutes / 60, language)],
    [t('Membership lock', 'Üyelik kilidi'), hours(CLAN.membershipLockMinutes / 60, language)],
    [t('Ceasefire with former clanmates', 'Eski klan arkadaşlarıyla ateşkes'), hours(CLAN.ceasefireMinutes / 60, language)],
  ]), table(t('Founding cost', 'Kuruluş bedeli'), resourceColumns(language), [costCells(CLAN.creationCost, language)])];
  if (id === 'clan.aid') blocks = [pairs(language, t('Aid and shared-loot reference', 'Yardım ve ortak yağma referansı'), [
    [t('Period counted in the aid allowance', 'Yardım limitinde hesaba katılan süre'), hours(CLAN.aidWindowMinutes / 60, language)],
    [t('Aid policy cooldown', 'Yardım tercihi beklemesi'), hours(CLAN.aidPolicyCooldownMinutes / 60, language)],
    [t('Aid speed', 'Yardım hızı'), `${n(CLAN.aidSpeedMultiplier)}×`],
    [t('Extra aid flight bays', 'Ek yardım uçuş yuvası'), n(CLAN.extraAidBays)],
    [t('Share of returned raid loot sent to the depot', 'Akından dönen ganimetin Yağma Deposuna ayrılan payı'), percent(CLAN.raidLootShare, language)],
    [t('Minimum members past the waiting period for loot sharing', 'Ganimet paylaşımı için beklemeyi tamamlamış asgari üye'), n(CLAN.minimumLootRoster)],
  ])];
  if (id === 'clan.support') blocks = [pairs(language, t('Support reference', 'Destek referansı'), [[t('Maximum stay', 'Azami kalış'), hours(CLAN_SUPPORT.stationHours, language)], [t('Host power factor cap', 'Ev sahibi güç çarpanı tavanı'), `${n(CLAN_SUPPORT.maxDominionFactor)}×`]])];
  if (id === 'clan.joint-war') blocks = [table(t('Shared Hangar upgrades', 'Ortak Hangar yükseltmeleri'), [levelLabel(language), ...resourceColumns(language), t('Clan room', 'Klan alanı')], Array.from({ length: CLAN_LEVEL_MAX }, (_, index) => { const rung = index + 1; return [n(rung), ...costCells(rung === 1 ? { alloy: 0, crystal: 0, deuterium: 0 } : clanLevelUpgradeCost(rung - 1), language), n(clanHangarCapacity(rung))]; }))];
  if (id === 'season.cycle') blocks = [pairs(language, t('Season reference', 'Sezon referansı'), [[t('Season days', 'Sezon günü'), n(SEASON.days)], ...SEASON.actBoundaries.map(act => [t(`Act: ${act.id}`, `Evre: ${act.id}`), t(`Day ${n(SEASON.days * act.share)}`, `Gün ${n(SEASON.days * act.share)}`)]), [t('Afterglow minutes', 'Kapanış aralığı dakikası'), n(SEASON.afterglowMinutes)]])];
  if (id === 'season.silent-space') blocks = [pairs(language, t('Silent Space reference', 'Sessiz Uzay referansı'), [
    [t('Time without an order before the move', 'Taşınmadan önce emirsiz süre'), hours(SILENT_SPACE.idleMs / 3_600_000, language)],
    [t('Orders that reset it', 'Sayacı sıfırlayan emirler'), t('Attack, building upgrade, research, ship or defence order', 'Saldırı, bina geliştirme, araştırma, gemi veya savunma üretimi')],
    [t('Resource production in Silent Space', 'Sessiz Uzay’da kaynak üretimi'), percent(SILENT_SPACE.productionPace, language)],
    [t('Return application expires after', 'Dönüş başvurusunun sona erdiği hareketsizlik'), hours(INACTIVITY_MS / 3_600_000, language)],
  ])];
  if (id === 'season.rewards') {
    const programme = seasonRankRewardProgram(CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION);
    if (programme) blocks = [table(t('Rank reward for the next cycle', 'Sonraki döngü için derece ödülü'), [t('Reward place', 'Ödül sırası'), ...resourceColumns(language)], programme.tiers.map(row => [n(row.place), ...costCells(row.reward, language)]))];
  }
  if (id === 'galaxy.events') {
    const day = (value: string | undefined): string => value === 'WEEKEND' ? t('Weekend', 'Hafta sonu') : value === 'WEEKDAY' ? t('Weekdays', 'Hafta içi') : t('Every day', 'Her gün');
    const time = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const windows: string[][] = [];
    for (const row of GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows) windows.push([t('Asteroid Shower', 'Asteroit Yağmuru'), day(row.days), `${time(row.startsAtLocalMinute)}–${time(row.endsAtLocalMinute)}`, `×${n(row.effect.asteroidSpawnMultiplier)}`]);
    for (const row of GALAXY_EVENTS.definitions.TRADE_SHIP.windows) windows.push([t('Trade Ship', 'Ticaret Gemisi'), day(undefined), `${time(row.startsAtLocalMinute)}–${time(row.endsAtLocalMinute)}`, t('Equal-value exchange', 'Eşit değer değişimi')]);
    for (const row of GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows) windows.push([t('Intergalactic Convoy', 'Galaksilerarası Konvoy'), day(row.days), `${time(row.startsAtLocalMinute)}–${time(row.endsAtLocalMinute)}`, t(`${hours(row.effect.resourceCapHours, language)} of origin-world production at most`, `En fazla çıkış gezegeninin ${hours(row.effect.resourceCapHours, language)} üretimi`)]);
    blocks = [table(t('Weekly schedule · Türkiye (UTC+3)', 'Haftalık takvim · Türkiye (UTC+3)'), [t('Event', 'Etkinlik'), t('Days', 'Günler'), t('Active hours', 'Etkinlik saatleri'), t('Effect', 'Etki')], windows)];
  }
  return blocks.length === 0 ? undefined : { id: 'reference', title: wikiLabels[language].numbers, blocks };
}
const levelLabel = (language: WikiLanguage): string => label(language, 'Level reached', 'Ulaşılan seviye');
