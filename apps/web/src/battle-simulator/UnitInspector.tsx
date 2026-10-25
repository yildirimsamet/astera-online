import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BATTLE_REPLAY_RESEARCH, HULLS, type BattleReplayData, type BattleShipSnapshot } from '@astera/rules';
import { hullLabel, researchName } from '../i18n/names.js';
import { HULL_ART } from '../ui/assets.js';
import { ClassChip, CounterLine } from '../ui/CounterMark.js';
import type { ReplayFrame } from './timeline.js';
import { combatNumber } from './presentation.js';

export function UnitInspector({ ship, frame, simulation, ownership, onClose, onFocus, onReplayRetreat }: {
  ownership?: 'YOU' | 'ALLY' | 'ENEMY'; ship: BattleShipSnapshot; frame: ReplayFrame; simulation: BattleReplayData;
  onClose: () => void; onFocus: () => void; onReplayRetreat: (at: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const card = useRef<HTMLElement>(null);
  useEffect(() => { card.current?.focus({ preventScroll: true }); }, [ship.id]);
  const state = frame.ships.get(ship.id)!, hull = HULLS[ship.hull];
  const owner = simulation.owners.find(owner => owner.side === ship.side && owner.stackId === ship.stackId);
  const cls = ship.cls ?? hull.cls, ground = ship.ground ?? hull.ground;
  const retreat = frame.retreats.find(event => event.shipId === ship.id);
  return <section ref={card} tabIndex={-1} aria-label={t('simulator.selected')} className="sim-selected">
    <div className="sim-selected-heading"><img src={HULL_ART[ship.hull] ?? undefined} alt="" /><div>
      <span>{t(ship.side === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender')} · {t('simulator.wing', { number: owner?.wing ?? 1 })}</span>
      <strong>{hullLabel(ship.hull)} <small>#{ship.id}</small></strong>
      <ClassChip cls={cls} />
    </div><button type="button" aria-label={t('simulator.closeUnit')} onClick={onClose}>×</button></div>
    {ownership && <p className={`sim-ownership is-${ownership.toLowerCase()}`}>{t(ownership === 'YOU' ? 'simulator.yourFleet' : ownership === 'ALLY' ? 'simulator.alliedFleet' : 'simulator.enemyFleet')}</p>}
    <div className={`sim-unit-status is-${state.status.toLowerCase()}`}>{frame.pendingFire.has(ship.id) ? t('simulator.pendingFire')
      : t(state.status === 'RETREATED' ? 'simulator.retreatedUnit' : state.status === 'DESTROYED' ? 'simulator.destroyed' : 'simulator.active')}</div>
    <div className="sim-unit-vitals"><label>{t('simulator.hull')}<b>{combatNumber(state.hp, i18n.language)} <small>/ {combatNumber(ship.maxHp, i18n.language)}</small></b><meter min={0} max={ship.maxHp} value={state.hp} /></label>
      <label>{t('simulator.shield')}{ship.maxShield > 0 ? <><b>{combatNumber(state.shield, i18n.language)} <small>/ {combatNumber(ship.maxShield, i18n.language)}</small></b><meter min={0} max={ship.maxShield} value={state.shield} /></> : <b>{t('simulator.noPersonalShield')}</b>}</label>
    </div>
    {ship.side === 'DEFENCE' && simulation.aegisCapacity > 0 && state.status === 'ACTIVE' && <p className="sim-shared-aegis">{t('simulator.sharedAegis')} <b>{combatNumber(frame.aegis, i18n.language)} / {combatNumber(simulation.aegisCapacity, i18n.language)}</b></p>}
    <p className="sim-base-attack">{t('simulator.baseAttack')} <b>{combatNumber(ship.attack, i18n.language)}</b></p>
    <details className="sim-unit-mechanics"><summary>{t('simulator.roleAndClass')}</summary><CounterLine cls={cls} />
      {ground && <p>{t('simulator.groundRole')}</p>}
      {ship.hull === 'NULLIFIER' && <p>{t('simulator.nullifierRole')}</p>}
      {cls === 'SUPPORT' && <><p>{t('simulator.supportRole')}</p><p>{t(ship.hull === 'GARBAGE_COLLECTOR' ? 'simulator.collectorRole' : 'simulator.cargoRole')}</p><p>{t('simulator.settlementScope')}</p></>}
      {!ship.canFire && cls !== 'SUPPORT' && <p>{t('simulator.disabledFire')}</p>}
    </details>
    {owner && <details className="sim-unit-research"><summary>{t('simulator.research')} · {t('simulator.wing', { number: owner.wing })}</summary>
      {BATTLE_REPLAY_RESEARCH.map(id => <span key={id}>{researchName(id)} <b>{owner.research[id] ?? 0}</b></span>)}
    </details>}
    <div className="sim-unit-actions"><button type="button" onClick={onFocus}>{t('simulator.focus')}</button>
      {retreat && <button type="button" onClick={() => { onReplayRetreat(retreat.at - .2); }}>{t(retreat.afterBattle ? 'simulator.replayAftermath' : 'simulator.replayRetreat', { round: retreat.round })}</button>}
    </div>
  </section>;
}
