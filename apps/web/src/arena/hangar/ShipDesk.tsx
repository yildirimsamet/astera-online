import { useState, type ReactNode } from 'react';
import { ABILITIES, AFFINITY, LOADOUT, MAX_POINT_RANK, SHIP_CLASSES, abilityRank, abilityStats, pointsLeft, shipStats, type Ability, type AbilityPoints, type LoadoutPlan, type ShipClass } from '@astera/rules/arena';
import i18n from '../../i18n/index.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { Icon } from '../../v2/icons.js';
import { CostLine, GameHold, GameTabs, Glyph, SectionTag } from '../../game-ui/index.js';
import { RulesRow } from '../../ui/RulesRow.js';
import { classStatRows, type ClassStatRow } from '../ClassPicker.js';
import { ACTION_ICONS, SIGNATURE_ICONS } from '../Controls.js';
import { SHIP_TONE } from '../shipTone.js';
import type { ArenaCopy } from '../copy.js';
import { levelGains } from '../Hangar.js';
import { amount, capLeft, clockText, launchBlock, repairOffer, type Hangar } from '../hangarDesk.js';

/**
 * THE SHIP'S DESK under the hangar's bay, on the game kit (G12-d2, 2026-11-16; owner 2026-10-23:
 * "Neon = Premium mu?", then "bir icon ekle, renk ekle"): kit wells under kit tags, no glow.
 * Each class wears the colour of its A key in flight, so the hangar and the HUD speak one language;
 * teal is the ship's own growth; the one lit press is the way into the Yarık, every spend a steel hold; resources wear their own hue beside
 * their icon; warn is a gap the pilot closes by waiting. The rules sit one tap deeper.
 */

const KINDS = ['alloy', 'crystal', 'deuterium'] as const;
const one = (n: number): string => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(n);

export const shipTone = (ship: ShipClass): React.CSSProperties => ({ '--ship': SHIP_TONE[ship] } as React.CSSProperties);

/** Interface glyphs on the Gözlemevi grid (24, 1.75 stroke, round caps) for what the set has no word for. */
const glyph = (paths: React.ReactNode, className = 'size-3.5'): React.ReactNode =>
  <svg viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
const STAT_ICONS: Record<ClassStatRow['key'], React.ReactNode> = {
  speed: glyph(<path d="M5 7l5 5-5 5M12 7l5 5-5 5" />),
  turn: <Icon id="i-rotate" className="size-3.5 shrink-0" />,
  hull: glyph(<path d="M12 3.5l7 2.8v5.2c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6.3z" />),
  damage: glyph(<><path d="M13.5 3 6 13.5h5.5L10 21l8-11h-5.5z" /></>),
  fire: glyph(<><path d="M4 8h9M4 12h12M4 16h9" /><path d="M17 6l3 2-3 2M19 14l2 2-2 2" /></>),
  accuracy: <Icon id="i-attack" className="size-3.5 shrink-0" />,
  cargo: glyph(<><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>),
  fuel: glyph(<path d="M12 3.5c3.5 4.4 5.5 7.6 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.6 2-5.8 5.5-10.2z" />),
};

/** The ship's state on the bay: ready, its repair or service clock, or out in the Yarık. */
export function ShipStatus({ c, hangar, now }: { c: ArenaCopy; hangar: Hangar; now: number }) {
  const block = launchBlock(hangar, now);
  const state = block?.kind === 'ready' ? block.reason : block?.kind === 'flying' || block?.kind === 'escort' || block?.kind === 'homeward' ? block.kind : 'ready';
  const tone = state === 'ready' ? 'self' : state === 'repair' || state === 'service' ? 'warn' : undefined;
  const text = block?.kind === 'ready' ? `${block.reason === 'repair' ? c.repairing : c.servicing} · ${clockText(block.until - now)}`
    : block?.kind === 'homeward' ? `${c.homing} · ${clockText(block.until - now)}` : state === 'escort' ? c.escorting : state === 'flying' ? c.inFlight : c.ready;
  return <span className="gk-chip gk-shipstate gk-num" {...(tone ? { 'data-tone': tone } : {})}>
    <i aria-hidden />
    <span data-status={state}>{text}</span>
  </span>;
}

/**
 * The repair, when it can be shortened: a warning well with the free clock, the paid wait and its
 * price; paying spends, so it is the kit's one-second hold in steel, never a tap.
 */
export function RepairBlock({ c, hangar, now, busy, onRepair }: {
  c: ArenaCopy; hangar: Hangar; now: number; busy: boolean; onRepair: () => void;
}) {
  const offer = repairOffer(hangar, now);
  if (!offer) return null;
  const short = hangar.alloy < offer.cost.alloy || hangar.crystal < offer.cost.crystal;
  const until = Date.parse(hangar.ship?.readyAt ?? '');
  return <section data-part="repair" className="gk-well gk-deskwell" data-tone="warn">
    <SectionTag as="h3" aside={c.freeRepair(clockText(until - now))}>{c.repairTitle}</SectionTag>
    <p className="gk-sub">{hangar.ship?.away === 'homeward' ? c.repairAfterHome(offer.minutes) : c.repairWait(offer.minutes)}</p>
    <p className="gk-deskwell__price"><span className="gk-note">{c.levelCost}</span><CostLine cost={offer.cost} held={hangar} /></p>
    <GameHold weight="spends" tone="steel" size="md" glyph="repair" marks={{ 'data-hp-repair': '' }} label={c.repairFaster(offer.minutes)}
      disabledReason={short ? c.capitalShort : busy ? c.hangarBusy : null} onCommit={onRepair} />
  </section>;
}

/** Ranks as pips, so a tile reads its progress before its numbers. */
function Pips({ rank, max }: { rank: number; max: number }) {
  return <span aria-hidden className="gk-pips">
    {Array.from({ length: max }, (_, i) => <i key={i} {...(i < rank ? { 'data-on': '' } : {})} />)}
  </span>;
}

/**
 * THE ABILITIES (owner 2026-10-27: "a tap did it at once"). Six kit tiles, each with its rank; a tap
 * opens one below with what the next rank changes, and a one-second hold spends the point (B4b). The
 * reason a point cannot go, when it cannot, stands where the hold would.
 */
export function AbilitiesBlock({ c, hangar, busy, onSpend }: {
  c: ArenaCopy; hangar: Hangar; busy: boolean; onSpend: (ability: Ability) => void;
}) {
  const [picked, setPicked] = useState<Ability>('signature');
  const ship = hangar.ship;
  if (!ship) return null;
  const left = pointsLeft(ship.level, ship.abilities);
  const name = (ability: Ability): string => ability === 'signature' ? c.signatures[ship.class].name : c[ability];
  const icon = (ability: Ability): ReactNode => ability === 'signature' ? SIGNATURE_ICONS[ship.class] : ACTION_ICONS[ability];
  const rank = abilityRank(ship.class, picked, ship.abilities);
  const top = rank >= MAX_POINT_RANK;
  const current = abilityStats(ship.class, picked, rank); const next = abilityStats(ship.class, picked, Math.min(5, rank + 1));
  const grow = (before: number, after: number): string => top ? one(before) : `${one(before)} → ${one(after)}`;
  // Out in the Yarık or beside a fleet, the ship is not in the hangar to be worked on.
  const out = ship.flying ? c.blocked.flying : ship.away === 'escort' ? c.blocked.escort : null;
  const refused = out ?? (top ? c.abilityTop : left < 1 ? (ship.level < 20 ? c.pointAt(ship.level + 1) : c.pointsReady(0)) : busy ? c.hangarBusy : null);
  return <section data-part="abilities" className="gk-shipdesk">
    <SectionTag as="h3" aside={<span className="gk-num gk-shipdesk__points" {...(left > 0 ? { 'data-lit': '' } : {})}>{c.pointsReady(left)}</span>}>{c.abilitiesTitle}</SectionTag>
    <ul className="gk-abils">
      {ABILITIES.map(ability => {
        const at = abilityRank(ship.class, ability, ship.abilities);
        return <li key={ability}>
          <button type="button" data-ability={ability} aria-pressed={picked === ability} onClick={() => { setPicked(ability); }}
            className="gk-abil" {...(ability === 'signature' ? { 'data-signature': '' } : {})}>
            <span className="gk-abil__top">
              <i aria-hidden className="gk-abil__glyph hp-glyph">{icon(ability)}</i>
              <span className="gk-num gk-abil__rank">{Math.min(at, MAX_POINT_RANK)}/{MAX_POINT_RANK}</span>
            </span>
            <b className="gk-abil__name">{name(ability)}</b>
            <Pips rank={Math.min(at, MAX_POINT_RANK)} max={MAX_POINT_RANK} />
          </button>
        </li>;
      })}
    </ul>
    <div data-part="ability-detail" className="gk-well gk-deskwell">
      <p className="gk-deskwell__head">
        <b className="gk-display">{name(picked)}</b>
        <span className="gk-num gk-note">{c.abilityRank(Math.min(rank, MAX_POINT_RANK), MAX_POINT_RANK)}</span>
      </p>
      <p className="gk-sub">
        {picked === 'signature' ? c.abilityPower[ship.class] : picked === 'smoke' ? c.abilitySmokeDuration : c.abilityDuration} <b className="gk-num">{grow(current.power || current.duration, next.power || next.duration)}</b>{picked !== 'signature' && ` ${c.seconds}`}
        <span aria-hidden className="gk-deskwell__dot">·</span>{picked === 'turbo' ? c.abilityRefill : c.abilityCooldown} <b className="gk-num">{grow(current.cooldown, next.cooldown)}</b> {c.seconds}
      </p>
      {AFFINITY[ship.class] === picked && <p className="gk-note" data-tone="self">{c.affinity}</p>}
      {top && rank < 5 && <p className="gk-note" data-tone="warn">{c.abilityEssence}</p>}
      <GameHold weight="spends" tone="steel" size="md" glyph="up" marks={{ 'data-ability-confirm': '' }} disabledReason={refused}
        label={c.abilityConfirm(name(picked), Math.min(5, rank + 1))} onCommit={() => { onSpend(picked); }} />
    </div>
  </section>;
}

/**
 * THE LEVEL AS A GOAL (owner 2026-10-27): the badge, the bar towards the next level, how XP comes,
 * and the next level as a one-second hold that is always there, saying what it still needs when it cannot go.
 */
export function LevelBlock({ c, hangar, busy, onUpgrade }: { c: ArenaCopy; hangar: Hangar; busy: boolean; onUpgrade: () => void }) {
  const ship = hangar.ship; if (!ship) return null;
  const top = ship.xpNext === 0; const capped = !top && ship.level >= ship.levelCap; const full = !top && !capped && ship.xp >= ship.xpNext;
  const short = hangar.alloy < ship.upgrade.alloy || hangar.crystal < ship.upgrade.crystal;
  const share = top ? 1 : Math.min(1, ship.xp / ship.xpNext);
  const refused = ship.flying ? c.blocked.flying : ship.away === 'escort' ? c.blocked.escort : !full ? c.xpToGo(ship.xpNext - ship.xp)
    : short ? c.capitalShort : busy ? c.hangarBusy : null;
  return <section data-part="level" className="gk-well gk-deskwell">
    <div className="gk-shiplevel">
      <span aria-hidden className="gk-shiplevel__badge gk-num">{ship.level}</span>
      <div className="gk-shiplevel__track">
        <p className="gk-deskwell__head">
          <b className="gk-display">{c.level(ship.level)}{!top && <span className="gk-shiplevel__to"> → {c.level(ship.level + 1)}</span>}</b>
          <span className="gk-num gk-note">{top ? c.topLevel : c.xpBar(ship.xp, ship.xpNext)}</span>
        </p>
        <span aria-hidden className="gk-shiplevel__bar" {...(capped ? { 'data-capped': '' } : {})}>
          <span data-bar="" style={{ width: `${String(share * 100)}%` }} />
        </span>
      </div>
    </div>
    <p className="gk-note">{c.xpHow}</p>
    {capped && <p className="gk-sub" data-tone="warn">{c.levelCapLine(ship.levelCap)}</p>}
    {!top && !capped && <>
      <p className="gk-deskwell__price"><span className="gk-note">{c.levelCost}</span><CostLine cost={ship.upgrade} held={hangar} /></p>
      <GameHold weight="spends" tone="steel" size="md" glyph="up" marks={{ 'data-hp-level': '' }} label={c.upgradeTo(ship.level + 1)} disabledReason={refused} onCommit={onUpgrade} />
    </>}
  </section>;
}

/**
 * The ship's figures, each on one bar from nothing to what the class reaches at the top level: the
 * solid part is today, the light part what the next level adds (owner 2026-10-27).
 */
export function GrowthBlock({ c, ship, level }: { c: ArenaCopy; ship: ShipClass; level: number }) {
  const rows = classStatRows(c, level); const after = classStatRows(c, Math.min(20, level + 1)); const most = classStatRows(c, 20);
  const gains = new Map(levelGains(ship, level, c).map(gain => [gain.key, gain.text]));
  const at = (n: number, of: number): string => `${String(Math.max(0, Math.min(1, n / Math.max(1e-9, of))) * 100)}%`;
  return <section data-part="growth" className="gk-shipdesk">
    <SectionTag as="h3" {...(level < 20 ? { aside: c.growthKey(level + 1) } : {})}>{c.statsTitle}</SectionTag>
    <dl className="gk-growth">
      {rows.map((row, i) => {
        const now = row.value(ship); const next = after[i]?.value(ship) ?? now; const max = most[i]?.value(ship) ?? now;
        const gain = gains.get(row.key);
        return <div key={row.key} data-stat={row.key} className="gk-growth__row">
          <dt><span className="gk-growth__name">{STAT_ICONS[row.key]}<span>{c.classStats[row.key]}</span></span>
            <b className="gk-num">{row.text(now)}</b></dt>
          <dd aria-hidden className="gk-growth__bar">
            <span data-now="" style={{ width: at(now, max) }} />
            {gain && <span data-next="" style={{ width: at(next - now, max) }} />}
          </dd>
          {gain && <dd className="gk-num gk-growth__gain">{gain}</dd>}
        </div>;
      })}
    </dl>
  </section>;
}

/**
 * The class: kit tabs to look at each, one line on what it is for, its signature, and the three
 * side by side in one table, the best of each row bright (owner 2026-10-27: "the marks mean nothing").
 */
export function ClassBlock({ c, value, level, onPick, aside, children, points = {} }: {
  c: ArenaCopy; value: ShipClass; level: number; onPick?: (ship: ShipClass) => void; aside?: string; children?: ReactNode; points?: AbilityPoints;
}) {
  const signature = abilityStats(value, 'signature', abilityRank(value, 'signature', points));
  return <div data-part="class" className="gk-shipdesk gk-shipdesk--class" style={shipTone(value)}>
    <section className="gk-shipdesk">
      <SectionTag as="h3" {...(aside === undefined ? {} : { aside })}>{c.classTitle}</SectionTag>
      {onPick && <div className="gk-classtabs"><GameTabs label={c.shipTitle} value={value} onChange={onPick}
        tabs={SHIP_CLASSES.map(id => ({ id, label: c.classes[id].name,
          art: <i className="hp-glyph gk-classtabs__sig" style={{ color: SHIP_TONE[id] }}>{SIGNATURE_ICONS[id]}</i> }))} /></div>}
      {children}
      <p className="gk-sub">{c.classes[value].line}</p>
      <div className="gk-well gk-shipsig">
        <i aria-hidden className="hp-sig-icon hp-glyph">{SIGNATURE_ICONS[value]}</i>
        <p>
          <strong className="gk-shipsig__name">{c.signatures[value].name}</strong>
          <span className="gk-sub">{c.signatures[value].line(one(signature.power), one(signature.cooldown))}</span>
        </p>
      </div>
    </section>
    <section data-part="compare" className="gk-shipdesk">
      <SectionTag as="h3" aside={c.compareKey}>{c.statsTitle}</SectionTag>
      <table className="gk-compare">
        <thead><tr>
          <th scope="col"><span className="sr-only">{c.statsTitle}</span></th>
          {SHIP_CLASSES.map(ship => <th key={ship} scope="col" data-ship={ship} {...(ship === value ? { 'data-own': '' } : {})} style={shipTone(ship)}>
            <span className="gk-compare__ship"><i aria-hidden className="hp-glyph">{SIGNATURE_ICONS[ship]}</i><span>{c.classes[ship].name}</span></span>
          </th>)}
        </tr></thead>
        <tbody>
          {classStatRows(c, level).map(row => {
            const best = Math.max(...SHIP_CLASSES.map(row.value));
            return <tr key={row.key} data-stat={row.key}>
              <th scope="row"><span className="gk-compare__stat">{STAT_ICONS[row.key]}<span>{c.classStats[row.key]}</span></span></th>
              {SHIP_CLASSES.map(ship => <td key={ship} data-ship={ship} {...(row.value(ship) >= best - 1e-9 ? { 'data-best': '' } : {})}
                {...(ship === value ? { 'data-own': '' } : {})} className="gk-num">{row.text(row.value(ship))}</td>)}
            </tr>;
          })}
        </tbody>
      </table>
    </section>
  </div>;
}

/**
 * WHAT THE LAUNCH PUTS ABOARD (owner 2026-10-27): the tank in quarters, the magazine from empty.
 * Each gauge shows what is aboard, the part the launch buys and its price; a tap on a cell sets it.
 */
export function LoadoutBlock({ c, hangar, busy, onPlan }: { c: ArenaCopy; hangar: Hangar; busy: boolean; onPlan: (plan: LoadoutPlan) => void }) {
  const ship = hangar.ship; if (!ship) return null;
  const stats = shipStats(ship.class, ship.level);
  const gauge = (part: 'fuel' | 'ammo', title: string, icon: ReactNode, have: number, full: number, price: number) => {
    const aboard = Math.min(100, Math.max(0, have / full * 100)); const plan = ship.plan[part];
    return <div data-gauge={part} className="gk-gauge">
      <p className="gk-gauge__head">
        <span className="gk-gauge__name">{icon}<b>{title}</b><span className="gk-num gk-note">{c.aboard(Math.floor(have), Math.round(full))}</span></span>
        <span className="gk-num gk-gauge__price" {...(price > 0 ? { 'data-paid': '' } : {})}>{c.topUp(price)}</span>
      </p>
      <div role="radiogroup" aria-label={title} className="gk-gauge__cells">
        {LOADOUT[part].map(step => {
          const empty = step === 0;
          // A quarter more than half aboard reads as aboard: 96 % drew its last quarter empty (review 2026-10-27).
          const fill = empty ? null : step - 12.5 <= aboard + 1e-9 ? 'aboard' : step <= plan ? 'plan' : null;
          return <button key={step} type="button" role="radio" aria-checked={plan === step} aria-label={c.planSet(title, step)} disabled={busy}
            onClick={() => { if (plan !== step) onPlan({ ...ship.plan, [part]: step }); }}
            className="gk-loadcell gk-num" {...(empty ? { 'data-empty': '' } : {})} {...(fill ? { 'data-fill': fill } : {})}>
            {empty ? c.ammoNone : c.planFill(step)}
          </button>;
        })}
      </div>
    </div>;
  };
  return <section data-part="loadout" className="gk-well gk-deskwell">
    <SectionTag as="h3">{c.loadoutTitle}</SectionTag>
    {gauge('fuel', c.fuelTitle, STAT_ICONS.fuel, ship.fuel, stats.fuelTank, hangar.refill.fuel)}
    {gauge('ammo', c.ammoTitle, STAT_ICONS.fire, ship.ammo, stats.ammoCapacity, hangar.refill.ammo)}
    {ship.plan.ammo === 0 && <p className="gk-sub" data-tone="warn">{c.ammoNoneNote}</p>}
    <p className="gk-note">{c.planNote}</p>
    <p className="gk-deskwell__price gk-deskwell__total">
      <span className="gk-sub">{c.launchCost}</span>
      <span className="gk-cost"><span className="gk-cost__part gk-num" {...(hangar.refill.total > hangar.deuterium ? { 'data-short': '' } : {})}>
        <img src={RESOURCE_ART.deuterium} alt={i18n.t('vocabulary.resource.deuterium')} draggable={false} />{amount(hangar.refill.total)}
      </span></span>
    </p>
  </section>;
}

/** What the capital can still take from the Yarık today, per resource, and when that fills again. */
export function CapBlock({ c, hangar }: { c: ArenaCopy; hangar: Hangar }) {
  const left = capLeft(hangar);
  const resets = new Date(hangar.resetsAt).toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' });
  return <section data-part="cap" className="gk-shipdesk">
    <SectionTag as="h3" aside={`${c.capResets} ${resets}`}>{c.capTitle}</SectionTag>
    <ul className="gk-capcells">
      {KINDS.map((key, kind) => <li key={key} className="gk-well gk-capcell" data-kind={key} {...(left[key] > 0 ? {} : { 'data-full': '' })}>
        <img src={RESOURCE_ART[key]} alt="" draggable={false} />
        <span>
          {left[key] > 0 ? <b className="gk-num">{amount(left[key])}</b> : <b>{c.capFull}</b>}
          <small className="gk-note">{c.kinds[kind]}</small>
        </span>
      </li>)}
    </ul>
  </section>;
}

/** Why the desk reads as it does: one kit press deeper, never on the rows. */
export function RulesBlock({ c }: { c: ArenaCopy }) {
  return <div data-part="rules">
    <RulesRow glyph="help" title={c.rulesOpen}>
      <ul className="gk-shipdesk__rules">{c.rules.map(line => <li key={line}>{line}</li>)}</ul>
    </RulesRow>
  </div>;
}

/** A desk that answered no, or an order it refused: said plainly, not as an alarm (red is for harm). */
export function DeskNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" /><span>{children}</span></p>;
}
