import { BattleEnemyFleet, BattleIntelNotice } from '../ui/BattleEnemyFleet.js';
import { BattleReplayAction } from '../battle-simulator/BattleReplayAction.js';
import { BattleRetreatNote } from '../ui/BattleRetreatNote.js';
import { fleetCount, fleetEntries, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { MonumentBattleReport } from '../api/schemas.js';
import { hullLabel, monumentName } from '../i18n/names.js';
import { decimal } from '../lib/format.js';
import { dayClock } from '../lib/time.js';
import { serverNow } from '../lib/clock.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { HonorBattleSummary } from '../ui/HonorBattleSummary.js';
import { RankingScores } from '../ui/RankingScores.js';
import { RulesRow } from '../ui/RulesRow.js';
import { SurvivorBar } from '../ui/SurvivorBar.js';
import { HULL_ART } from '../ui/assets.js';
import { GameButton } from '../game-ui/buttons.js';
import { SectionTag } from '../game-ui/surfaces.js';
import { battleOutcome, monumentControlKey, monumentGradeKey, type BattleOutcome } from '../lib/battleOutcome.js';
import { MonumentBattleRules } from './MonumentBattleRules.js';
import { ADMIRAL_WAIT } from '@astera/rules/arena/ui';
import { arenaCopy } from '../arena/copy.js';

/** The verdict plate's colour, from the side's result (the same reading the battle list's mark wears). */
const PLATE_TONE: Record<BattleOutcome, 'good' | 'partial' | 'threat' | 'neutral'> = {
  win: 'good', partial: 'partial', loss: 'threat', neutral: 'neutral',
};

/**
 * A WAVE INTO A MONUMENT, AND WHAT CAME OF IT (C17, G9 #8), on the battle report's kit.
 *
 * The moment: the wave has fought — is the monument ours, what did it cost, should the next
 * wave go? One plate in the colour of the side's result (control, grade, a wiped fleet), the
 * Honor it moved, who stood against it, then each own hull as a survivor row, the enemy board,
 * the haul, and the rounds and rules each one rules row away. The door back to the monument
 * closes it.
 */
export function MonumentReportSheet({ report, onClose, onFocusMonument }: {
  report: MonumentBattleReport; onClose: () => void; onFocusMonument?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const name = monumentName(report.monument.ordinal);
  const fleetLine = (fleet: Fleet) => fleetEntries(fleet).map(([hull, count]) => `${String(count)} ${hullLabel(hull)}`).join(' · ');
  const wiped = fleetCount(report.yourSurvivors) === 0;
  const outcome = battleOutcome({ ...report, survivors: fleetCount(report.yourSurvivors), losses: fleetCount(report.yourLosses) });
  // A cached report can predate the opponent field even though the current schema
  // defaults it. Treat that legacy wire shape as an empty roster at the boundary.
  const rawOpponents: unknown = (report as unknown as { opponents?: unknown }).opponents;
  const opponents = Array.isArray(rawOpponents)
    ? rawOpponents as NonNullable<MonumentBattleReport['opponents']>
    : [];
  return <Sheet title={name} onClose={onClose} detents={['full']} kit={{ tone: outcome === 'loss' ? 'hostile' : 'self' }}>
    <div data-monument-report className="gk-report">
      <BattleReplayAction kind="MONUMENT" id={report.id} status={report.replayStatus} />
      <section data-battle-outcome={outcome} data-tone={PLATE_TONE[outcome]} className="gk-well gk-report__verdict">
        <p className="gk-report__label gk-num">{dayClock(report.at, serverNow())} · {t('reports.rounds', { count: report.roundCount })}</p>
        <h3 className="gk-report__subhead">{t(monumentControlKey(report))}</h3>
        <p className="gk-report__copy" data-strong="">{t(monumentGradeKey(report))}</p>
        {wiped && fleetCount(report.yourLosses) > 0 && <p className="gk-report__copy" data-tone="threat" data-strong="">{t('monument.battleResult.wiped')}</p>}
        {opponents.length > 0 && <p className="gk-report__copy">{t('monument.reportOpponents', { names: opponents.map((opponent) => opponent.kind === 'NEUTRAL'
          ? t('monument.neutral') : opponent.clanTag ? `${opponent.name} [${opponent.clanTag}]` : opponent.name).join(' · ') })}</p>}
      </section>
      <HonorBattleSummary receipt={report.honor} dominion={report.dominion} />
      {!report.honor ? <RankingScores dominion={report.dominion} /> : null}
      {(report.admirals ?? []).map((admiral, index) => {
        // Y9: a capture leaves the fleet in the monument and sends the escort home alone; a loss repairs it.
        const values = { ship: arenaCopy().classes[admiral.ship].name, level: arenaCopy().level(admiral.level) };
        const won = report.control === 'ATTACKER';
        return <p key={`admiral:${String(index)}`} data-effect="admiral" className="gk-report__note"
          data-tone={!report.attacking ? 'plain' : won ? 'good' : 'warn'}>
          {!report.attacking ? t('reports.effects.admiralRaider', values)
            : won ? t('reports.effects.admiralHeld', values) : t('reports.effects.admiralRepair', { ...values, minutes: ADMIRAL_WAIT.repairMinutes })}
        </p>;
      })}

      <section className="gk-report__part">
        <SectionTag as="h2">{t('reports.q.who')}</SectionTag>
        <p className="gk-report__copy">{t('monument.reportOwn', { sent: fleetCount(report.yourFleet), left: fleetCount(report.yourSurvivors), lost: fleetCount(report.yourLosses) })}</p>
        <div className="gk-ledger gk-forces">
          {fleetEntries(report.yourFleet).map(([hull, sent]) => <div key={hull} data-own-hull={hull} className="gk-force">
            <span className="gk-force__hull">
              {HULL_ART[hull] && <img src={HULL_ART[hull]} alt="" width={32} height={32} />}
              <span className="gk-force__name"><span className="gk-report__subhead">{hullLabel(hull)}</span></span>
            </span>
            <SurvivorBar compactRow sent={sent} lost={report.yourLosses[hull] ?? 0} side="yours"
              sentLabel={t('reports.verdict.sent')} leftLabel={t('reports.force.left')} />
          </div>)}
        </div>
        <BattleRetreatNote fleet={report.yourRetreated} enemyCount={report.theirRetreatedCount} />
        {report.yourDamage.map((lot, index) => <p key={`${lot.hull}:${String(index)}`} className="gk-report__copy">
          {t('monument.reportHealth', { count: lot.count, hull: hullLabel(lot.hull), health: decimal((10_000 - lot.damageBp - lot.remainderBp) / 100, 4) })}
        </p>)}
        {report.enemyFleetVisibility === 'FULL'
          ? <BattleEnemyFleet fleet={report.theirFleet} losses={report.theirLosses} attacking={report.attacking} />
          : <><BattleIntelNotice visibility={report.enemyFleetVisibility} />
            {fleetCount(report.theirLosses) > 0 && <p className="gk-report__copy">{t('monument.reportEnemyLosses', { fleet: fleetLine(report.theirLosses) })}</p>}</>}
        <p className="gk-report__copy" data-strong="">{t('monument.reportLoot', { amount: decimal(report.lootDeuterium, 3) })}</p>
      </section>

      {report.rounds && report.rounds.length > 0 && <RulesRow glyph="clock" title={t('reports.howItWent')}>
        <div className="gk-mrounds">
          {report.rounds.map(round => <section key={round.round} data-monument-round={round.round} className="gk-mround">
            <h3 className="gk-report__subhead">{t('reports.calculation.round', { round: round.round })}</h3>
            <p>{t('reports.roundLossesYours')}: {fleetLine(round.yourLosses) || t('reports.roundNoCasualties')}</p>
            <p>{t('reports.roundLossesTheirs')}: {fleetLine(round.theirLosses) || t('reports.roundNoCasualties')}</p>
            <BattleRetreatNote fleet={round.yourRetreated} enemyCount={round.theirRetreatedCount} />
          </section>)}
        </div>
      </RulesRow>}
      <MonumentBattleRules targetLimit={report.rounds?.find(round => round.targetLimit !== undefined)?.targetLimit ?? null} />
      {onFocusMonument && <GameButton wide glyph="target" onPress={() => { onClose(); onFocusMonument(report.monument.id); }}>
        {t('monument.look', { name })}
      </GameButton>}
    </div>
  </Sheet>;
}
