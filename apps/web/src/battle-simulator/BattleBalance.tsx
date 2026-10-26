import { useTranslation } from 'react-i18next';
import { HULLS, type BattleShipSnapshot, type BattleSide, type CombatBalance, type RetreatWindow } from '@astera/rules';
import { compact } from '../lib/format.js';

/** One line: who is stronger and by how much — the strip's summary, and the replay tabs' hint. */
export function useBalanceVerdict(balance: CombatBalance | undefined) {
  const { t, i18n } = useTranslation();
  if (!balance) return undefined;
  const { attackerPower, defenderPower } = balance;
  const high = Math.max(attackerPower, defenderPower), low = Math.min(attackerPower, defenderPower);
  const ratio = low > 0 ? high / low : Infinity;
  if (!Number.isFinite(ratio)) return t('simulator.balanceNoFire', { side: t(attackerPower > 0 ? 'simulator.defender' : 'simulator.attacker') });
  if (Math.round(ratio * 10) <= 10) return t('simulator.balanceEven');
  return t('simulator.balanceStronger', { side: t(attackerPower > defenderPower ? 'simulator.attacker' : 'simulator.defender'),
    ratio: `1:${ratio.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}` });
}

/**
 * WHAT THE BATTLE WAS FOUGHT WITH (combat v3). Each side's matchup power, their ratio, the tempo
 * every shot carries and who may withdraw, and when. The replay shows what happened; this states
 * the inputs and the rule, so a player can see why a fight at 1:3 ends differently from one at 1:1.
 */
export function BattleBalance({ balance, ships }: { balance: CombatBalance; ships: readonly BattleShipSnapshot[] }) {
  const { t, i18n } = useTranslation();
  const two = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const percent = (value: number) => t('units.percent', { value: String(Math.round(value * 100)) });
  const { attackerPower, defenderPower } = balance;
  const verdict = useBalanceVerdict(balance);
  // Guns stand and support never leaves on its own: only a warship uses the window.
  const leaves = (side: BattleSide) => ships.some(ship => ship.side === side && !(ship.ground ?? HULLS[ship.hull].ground)
    && (ship.cls ?? HULLS[ship.hull].cls) !== 'SUPPORT');
  const retreat = (side: BattleSide, window: RetreatWindow | null) => window && leaves(side)
    ? t('simulator.retreatBelow', { threshold: percent(window.threshold), chance: percent(window.chance) })
    : t('simulator.neverRetreats');
  return <section className="sim-balance" aria-label={t('simulator.balanceHeading')}>
    <details><summary><strong>{t('simulator.balanceHeading')}</strong><span>{verdict}</span></summary>
      <div className="sim-balance-body">
        <p>{t('simulator.balanceTempo', { value: two(balance.tempo) })}{balance.handicap !== 1 && <> · {t('simulator.balanceHandicap', { value: two(balance.handicap) })}</>}</p>
        <dl>
          {([['ATTACK', 'simulator.attacker', attackerPower, balance.attackerRetreat], ['DEFENCE', 'simulator.defender', defenderPower, balance.defenderRetreat]] as const)
            .map(([side, label, power, window]) => <div key={side}><dt>{t(label)}</dt><dd className="sim-balance-power">{compact(power)}</dd><dd>{retreat(side, window)}</dd></div>)}
        </dl>
        <p className="sim-balance-rule">{t('simulator.balanceRule')}</p>
      </div>
    </details>
  </section>;
}
