import { SHIP_CLASSES, TACTICS, abilityRank, abilityStats, hitShare, shipStats, type AbilityPoints, type ShipClass, type Tactic } from '@astera/rules/arena';
import { ACTION_ICONS, SIGNATURE_ICONS } from './Controls.js';
import i18n from '../i18n/index.js';
import type { ArenaCopy } from './copy.js';

export interface ClassStatRow { key: keyof ArenaCopy['classStats']; value: (ship: ShipClass) => number; text: (value: number) => string }
const one = (n: number): string => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(n);

/**
 * What a pilot compares the classes on, each a number where more is better, at a level (Y6b). Fire
 * is damage a second; damage is one shot's; accuracy is the share of shots on a ship (`hitShare`).
 */
export function classStatRows(c: ArenaCopy, level = 1): readonly ClassStatRow[] {
  const plain = (n: number): string => String(Math.round(n));
  const at = (ship: ShipClass) => shipStats(ship, level);
  return [
    { key: 'speed', value: ship => at(ship).speedMax, text: n => `${plain(n)} m/s` },
    { key: 'turn', value: ship => at(ship).turnRateMax * 180 / Math.PI, text: n => `${plain(n)}${c.degreesPerSecond}` },
    { key: 'hull', value: ship => at(ship).hull, text: plain },
    { key: 'damage', value: ship => at(ship).damage, text: one },
    { key: 'fire', value: ship => at(ship).damage * at(ship).fireRate, text: n => `${plain(n)}${c.perSecond}` },
    { key: 'accuracy', value: ship => hitShare(at(ship).spreadBase) * 100, text: n => c.percent(plain(n)) },
    { key: 'cargo', value: ship => at(ship).cargoCapacity, text: plain },
    { key: 'fuel', value: ship => at(ship).fuelTank, text: plain },
  ];
}

/**
 * The class for the next flight (Y4): three tabs, one line on what the class is for, and the bars
 * filled against the best class, a star where this one is the best (owner 2026-10-27: the marks
 * for the other two classes read as nothing).
 */
export function ClassPicker({ c, value, onPick }: { c: ArenaCopy; value: ShipClass; onPick: (ship: ShipClass) => void }) {
  const signature = abilityStats(value, 'signature', 1);
  return <section className="ap-class" aria-label={c.shipTitle}>
    <div className="ap-mode is-three" role="radiogroup" aria-label={c.shipTitle}>
      {SHIP_CLASSES.map(ship => <button key={ship} type="button" role="radio" aria-checked={ship === value} data-ship={ship}
        className={ship === value ? 'is-selected' : ''} onClick={() => { onPick(ship); }}>{c.classes[ship].name}</button>)}
    </div>
    <p className="ap-class-line"><b>{c.classes[value].role}</b> · {c.classes[value].line}</p>
    <p className="ap-class-signature"><i aria-hidden>{SIGNATURE_ICONS[value]}</i><b>{c.signatures[value].name}</b><span>{c.signatures[value].line(one(signature.power), one(signature.cooldown))}</span></p>
    <ul className="ap-class-stats">
      {classStatRows(c).map(row => {
        const best = Math.max(...SHIP_CLASSES.map(row.value));
        return <li key={row.key} style={{ '--fill': String(row.value(value) / best) } as React.CSSProperties}>
          <span>{c.classStats[row.key]}{row.value(value) >= best - 1e-9 && <em data-best="" aria-hidden> ★</em>}</span><strong>{row.text(row.value(value))}</strong>
          <i aria-hidden><b /></i>
        </li>;
      })}
    </ul>
    <p className="ap-class-key">{c.classKey}</p>
  </section>;
}

/**
 * The B slot for the next flight (Y4c, plan 14 §4): one tactic, the same choice for every class.
 * Each option says what it does and how long it waits, so the pick is a plan, not a guess.
 */
export function TacticPicker({ c, value, onPick, ship = 'kilavuz', points = {} }: {
  c: ArenaCopy; value: Tactic; onPick: (tactic: Tactic) => void; ship?: ShipClass; points?: AbilityPoints;
}) {
  return <section className="ap-tactic" aria-label={c.tacticTitle}>
    <p className="ap-tactic-head"><span>{c.tacticTitle}</span><small>{c.tacticKey}</small></p>
    <div className="ap-tactic-options" role="radiogroup" aria-label={c.tacticTitle}>
      {TACTICS.map(tactic => {
        const skill = abilityStats(ship, tactic, abilityRank(ship, tactic, points));
        return <button key={tactic} type="button" role="radio" aria-checked={tactic === value} data-tactic={tactic}
        className={tactic === value ? 'is-selected' : ''} onClick={() => { onPick(tactic); }}>
        <i aria-hidden>{ACTION_ICONS[tactic]}</i><b>{c[tactic]}</b><small>{c.tactics[tactic](one(skill.duration), one(skill.cooldown))}</small>
      </button>;
      })}
    </div>
  </section>;
}
