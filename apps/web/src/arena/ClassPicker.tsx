import { CLASS_STATS, SHIP_CLASSES, TACTICS, type ShipClass, type Tactic } from '@astera/rules/arena';
import { ACTION_ICONS, SIGNATURE_ICONS } from './Controls.js';
import type { ArenaCopy } from './copy.js';

export interface ClassStatRow { key: keyof ArenaCopy['classStats']; value: (ship: ShipClass) => number; text: (value: number) => string }

/** What a pilot compares the classes on, each a number where more is better. Fire is damage a second. */
export function classStatRows(c: ArenaCopy): readonly ClassStatRow[] {
  const plain = (n: number): string => String(Math.round(n));
  return [
    { key: 'speed', value: ship => CLASS_STATS[ship].speedMax, text: n => `${plain(n)} m/s` },
    { key: 'turn', value: ship => CLASS_STATS[ship].turnRateMax * 180 / Math.PI, text: n => `${plain(n)}${c.degreesPerSecond}` },
    { key: 'hull', value: ship => CLASS_STATS[ship].hull, text: plain },
    { key: 'fire', value: ship => CLASS_STATS[ship].damage * CLASS_STATS[ship].fireRate, text: n => `${plain(n)}${c.perSecond}` },
    { key: 'cargo', value: ship => CLASS_STATS[ship].cargoCapacity, text: plain },
    { key: 'fuel', value: ship => CLASS_STATS[ship].fuelTank, text: plain },
  ];
}

/**
 * The class for the next flight (Y4): three tabs, one line on what the class is for, and six bars
 * filled against the best class with the other two marked on them, so a choice is read, not guessed.
 */
export function ClassPicker({ c, value, onPick }: { c: ArenaCopy; value: ShipClass; onPick: (ship: ShipClass) => void }) {
  const others = SHIP_CLASSES.filter(ship => ship !== value);
  return <section className="ap-class" aria-label={c.shipTitle}>
    <div className="ap-mode is-three" role="radiogroup" aria-label={c.shipTitle}>
      {SHIP_CLASSES.map(ship => <button key={ship} type="button" role="radio" aria-checked={ship === value} data-ship={ship}
        className={ship === value ? 'is-selected' : ''} onClick={() => { onPick(ship); }}>{c.classes[ship].name}</button>)}
    </div>
    <p className="ap-class-line"><b>{c.classes[value].role}</b> · {c.classes[value].line}</p>
    <p className="ap-class-signature"><i aria-hidden>{SIGNATURE_ICONS[value]}</i><b>{c.signatures[value].name}</b><span>{c.signatures[value].line}</span></p>
    <ul className="ap-class-stats">
      {classStatRows(c).map(row => {
        const best = Math.max(...SHIP_CLASSES.map(row.value));
        return <li key={row.key} style={{ '--fill': String(row.value(value) / best) } as React.CSSProperties}>
          <span>{c.classStats[row.key]}</span><strong>{row.text(row.value(value))}</strong>
          <i aria-hidden><b />{others.map(ship => <em key={ship} data-other={ship} style={{ '--at': String(row.value(ship) / best) } as React.CSSProperties} />)}</i>
        </li>;
      })}
    </ul>
    <p className="ap-class-key"><i aria-hidden />{c.classKey}</p>
  </section>;
}

/**
 * The B slot for the next flight (Y4c, plan 14 §4): one tactic, the same choice for every class.
 * Each option says what it does and how long it waits, so the pick is a plan, not a guess.
 */
export function TacticPicker({ c, value, onPick }: { c: ArenaCopy; value: Tactic; onPick: (tactic: Tactic) => void }) {
  return <section className="ap-tactic" aria-label={c.tacticTitle}>
    <p className="ap-tactic-head"><span>{c.tacticTitle}</span><small>{c.tacticKey}</small></p>
    <div className="ap-tactic-options" role="radiogroup" aria-label={c.tacticTitle}>
      {TACTICS.map(tactic => <button key={tactic} type="button" role="radio" aria-checked={tactic === value} data-tactic={tactic}
        className={tactic === value ? 'is-selected' : ''} onClick={() => { onPick(tactic); }}>
        <i aria-hidden>{ACTION_ICONS[tactic]}</i><b>{c[tactic]}</b><small>{c.tactics[tactic]}</small>
      </button>)}
    </div>
  </section>;
}
