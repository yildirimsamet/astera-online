import { useTranslation } from 'react-i18next';
import type { BattleShipSnapshot, BattleSide } from '@astera/rules';
import { hullLabel } from '../i18n/names.js';
import { HULL_ART } from '../ui/assets.js';
import type { ReplayFrame } from './timeline.js';
import { combatNumber } from './presentation.js';

export function RetreatRoster({ frame, ships, viewer, ownership, wingNumber, onInspect }: {
  ownership?: (ship: BattleShipSnapshot) => 'YOU' | 'ALLY' | 'ENEMY' | undefined; frame: ReplayFrame; ships: ReadonlyMap<string, BattleShipSnapshot>; viewer: BattleSide; wingNumber: (ship: BattleShipSnapshot) => number; onInspect: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  if (frame.retreats.length === 0) return null;
  return <section className="sim-retreat-roster" aria-label={t('simulator.aliveRetreated')}>
    <p className="sim-pane-title">↗ {t('simulator.retreated')} <b>{frame.retreats.length}</b><small>{t('simulator.outOfCombat')}</small></p>
    <div className="sim-retreat-scroll">{(['ATTACK', 'DEFENCE'] as const).map(side => {
      const entries = frame.retreats.filter(event => ships.get(event.shipId)?.side === side);
      if (entries.length === 0) return null;
      return <div key={side} className={side === viewer ? 'is-self' : 'is-enemy'}><h3>{t(side === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender')} <b>{entries.length}</b></h3>
        {entries.map(event => {
          const ship = ships.get(event.shipId)!;
          return <button key={ship.id} type="button" aria-label={t('simulator.inspect', { name: `${hullLabel(ship.hull)} #${ship.id}` })} onClick={() => { onInspect(ship.id); }}>
            <img src={HULL_ART[ship.hull] ?? undefined} alt="" /><span><strong>{hullLabel(ship.hull)} <small>#{ship.id}</small></strong>
              <small>{ownership?.(ship) === 'YOU' ? `${t('simulator.yourFleet')} · ` : ownership?.(ship) === 'ALLY' ? `${t('simulator.alliedFleet')} · ` : ''}{t('simulator.wing', { number: wingNumber(ship) })} · {t(event.afterBattle ? 'simulator.afterCombat' : 'simulator.retreatedAt', { round: event.round })}</small>
              <small>{combatNumber(frame.ships.get(ship.id)!.hp, i18n.language)} / {combatNumber(ship.maxHp, i18n.language)} HP</small></span>
          </button>;
        })}
      </div>;
    })}</div>
  </section>;
}
