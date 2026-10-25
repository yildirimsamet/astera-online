import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GROUND_HULLS, HULLS, MOBILE_HULLS, RESEARCH_PROJECTS, fleetCount, hullTech, type HullId } from '@astera/rules';
import { hullLabel, researchName } from '../i18n/names.js';
import { HULL_ART } from '../ui/assets.js';
import { COMBAT_RESEARCH, SIMULATION_UNIT_LIMIT, type BattleScenario, type SimulationParticipant } from './scenario.js';
import { SimulationNumberInput } from './SimulationNumberInput.js';
import { ClassChip } from '../ui/CounterMark.js';

export const SideEditor = memo(function SideEditor({ side, scenario, update, invalidFields }: {
  side: 'attackers' | 'defenders'; scenario: BattleScenario; update: (mutate: (draft: BattleScenario) => void) => void;
  invalidFields: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const owners = scenario[side];
  const editOwner = (index: number, change: (owner: SimulationParticipant) => void) => { update(draft => { change(draft[side][index]!); }); };
  const rows = (owner: SimulationParticipant, index: number, hulls: readonly HullId[]) => hulls.map(hull => {
    const name = hullLabel(hull), quantity = owner.fleet[hull] ?? 0;
    const factors = hullTech(owner.tech, hull);
    const suffix = index === 0 ? '' : ` · ${t('simulator.wing', { number: index + 1 })}`;
    const healthPath = `${side}.${index}.health.${hull}`, quantityPath = `${side}.${index}.fleet.${hull}`;
    const invalidHealth = invalidFields.has(healthPath), invalidQuantity = invalidFields.has(quantityPath);
    const healthErrorId = `sim-health-error-${side}-${index}-${hull}`, quantityErrorId = `sim-quantity-error-${side}-${index}-${hull}`;
    return <div className={`sim-unit-row ${quantity > 0 ? 'is-fielded' : ''}`} key={hull}>
      <img src={HULL_ART[hull] ?? undefined} alt="" loading="lazy" />
      <span className="sim-unit-name"><strong>{name}</strong><ClassChip cls={HULLS[hull].cls} /><small>{t('simulator.baseAttack')} {Math.round(HULLS[hull].atk * factors.atk)} · {Math.round(HULLS[hull].hp * factors.hp)} HP</small></span>
      <SimulationNumberInput aria-label={`${name} · ${t('simulator.quantity')}${suffix}`} min={0} max={SIMULATION_UNIT_LIMIT}
        data-sim-field={quantityPath} aria-invalid={invalidQuantity} aria-describedby={invalidQuantity ? quantityErrorId : undefined}
        value={quantity} onValueChange={value => { editOwner(index, row => { row.fleet[hull] = value; }); }} />
      {invalidQuantity && <small id={quantityErrorId} className="sim-field-error">{t('simulator.invalidValue', { min: 0, max: SIMULATION_UNIT_LIMIT })}</small>}
      {(quantity > 0 || invalidHealth) && <label className="sim-health"><span>{t('simulator.health')}</span><SimulationNumberInput
        aria-label={`${name} · ${t('simulator.health')}${suffix}`} min={1} max={100} value={owner.health[hull] ?? 100}
        data-sim-field={healthPath} aria-invalid={invalidHealth} aria-describedby={invalidHealth ? healthErrorId : undefined}
        onValueChange={value => { editOwner(index, row => { row.health[hull] = value; }); }} /><span>%</span>
        {invalidHealth && <small id={healthErrorId} className="sim-field-error">{t('simulator.invalidValue', { min: 1, max: 100 })}</small>}</label>}
    </div>;
  });
  return <div className="sim-side-editor">
    {side === 'defenders' && scenario.environment === 'PLANET' && <fieldset className="sim-planet-settings">
      <legend>{t('simulator.ground')}</legend>
      <div className="sim-fields">
        <label>{t('simulator.aegisLevel')}<SimulationNumberInput aria-label={t('simulator.aegisLevel')} min={0} max={20} value={scenario.aegisLevel}
          onValueChange={n => { update(d => { d.aegisLevel = n; }); }} /></label>
        <label>{t('simulator.aegisCharge')}<SimulationNumberInput aria-label={t('simulator.aegisCharge')} min={0} max={100} integer={false} value={scenario.aegisCharge}
          onValueChange={n => { update(d => { d.aegisCharge = n; }); }} /></label>
      </div>
      <label className="sim-check"><input type="checkbox" checked={scenario.defenceOffline} onChange={event => { const value = event.currentTarget.checked; update(d => { d.defenceOffline = value; }); }} />{t('simulator.offline')}</label>
      <label className="sim-check"><input type="checkbox" checked={scenario.automaticEscape} disabled={owners.length > 1} onChange={event => {
        const value = event.currentTarget.checked; update(d => { d.automaticEscape = value; });
      }} />{t('simulator.automaticEscape')}</label>
      {scenario.automaticEscape && <label className="sim-setting">{t('simulator.escapeFuel')}<SimulationNumberInput min={0} max={1_000_000_000} value={scenario.deuterium}
        onValueChange={n => { update(d => { d.deuterium = n; }); }} /></label>}
    </fieldset>}
    {owners.map((owner, index) => <section className="sim-wing" key={owner.id}>
      <div className="sim-section-title"><h3>{t('simulator.wing', { number: index + 1 })}</h3><span>{t('simulator.total', { number: fleetCount(owner.fleet) })}</span>
        {index > 0 && <button type="button" aria-label={t('simulator.removeWing')} onClick={() => { update(d => { d[side].splice(index, 1); }); }}>×</button>}
      </div>
      <details className="sim-research" open={index === 0}>
        <summary>{t('simulator.research')}</summary>
        <div className="sim-fields">{COMBAT_RESEARCH.map(id => <label key={id}>{researchName(id)}
          <select aria-label={`${researchName(id)}${index === 0 ? '' : ` · ${t('simulator.wing', { number: index + 1 })}`}`}
            value={owner.tech[id]} onChange={event => { const value = Number(event.currentTarget.value); editOwner(index, row => { row.tech[id] = value; }); }}>
            {Array.from({ length: RESEARCH_PROJECTS[id].maxLevel + 1 }, (_, level) => <option key={level} value={level}>{level}</option>)}
          </select></label>)}</div>
      </details>
      <div className="sim-section-title"><h3>{t('simulator.ships')}</h3><button type="button" onClick={() => { editOwner(index, row => { row.fleet = {}; row.health = {}; }); }}>{t('simulator.clear')}</button></div>
      {rows(owner, index, MOBILE_HULLS)}
      {side === 'defenders' && index === 0 && scenario.environment === 'PLANET' && <><h3 className="sim-ground-heading">{t('simulator.ground')}</h3>{rows(owner, index, GROUND_HULLS)}</>}
    </section>)}
    {owners.length < 5 && <button type="button" className="sim-add-wing" onClick={() => { update(d => {
      let id = 1; while (d[side].some(row => row.id === String(id))) id++;
      d[side].push({ id: String(id), fleet: {}, health: {}, tech: { SHIP_POWER: 0, SHIP_ARMOR: 0, SHIP_SHIELDS: 0, EMPLACEMENT_DOCTRINE: 0 } });
      if (side === 'defenders') d.automaticEscape = false;
    }); }}>+ {t('simulator.addWing')}</button>}
    <p className="sim-caption">{t('simulator.limit', { limit: SIMULATION_UNIT_LIMIT })}</p>
  </div>;
});
