import { useState, type ReactNode } from 'react';
import { ABILITIES, AFFINITY, LOADOUT, MAX_POINT_RANK, SHIP_CLASSES, abilityRank, abilityStats, pointsLeft, shipStats, type Ability, type AbilityPoints, type LoadoutPlan, type ShipClass } from '@astera/rules/arena';
import i18n from '../../i18n/index.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { Cost } from '../../v2/kit/Cost.js';
import { Segmented } from '../../v2/kit/Segmented.js';
import { HoldButton } from '../../v2/kit/HoldButton.js';
import { SectionHead } from '../../v2/kit/Surface.js';
import { Icon } from '../../v2/icons.js';
import { classStatRows, type ClassStatRow } from '../ClassPicker.js';
import { ACTION_ICONS, SIGNATURE_ICONS } from '../Controls.js';
import { SHIP_TONE } from '../shipTone.js';
import type { ArenaCopy } from '../copy.js';
import { levelGains } from '../Hangar.js';
import { amount, capLeft, clockText, launchBlock, repairOffer, type Hangar } from '../hangarDesk.js';

/**
 * THE SHIP'S DESK under the hangar's bay, in the Gözlemevi language (owner 2026-10-23: "Neon =
 * Premium mu?", then "bir icon ekle, renk ekle"): hairline sections with their glyphs, no glow.
 * Each class wears the colour of its A key in flight, so the hangar and the HUD speak one language;
 * teal is the ship's own growth and the one primary button; resources wear their own hue beside
 * their icon; warn is a gap the pilot closes by waiting. The rules sit one tap deeper.
 */

const KINDS = ['alloy', 'crystal', 'deuterium'] as const;
const KIND_INK = ['text-v2-alloy', 'text-v2-crystal', 'text-v2-deut'] as const;
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
const head = (id: 'i-spark' | 'i-base' | 'i-fleet' | 'i-info'): React.ReactNode => <Icon id={id} className="size-3" />;

/** The ship's state on the bay: ready, its repair or service clock, or out in the Yarık. */
export function ShipStatus({ c, hangar, now }: { c: ArenaCopy; hangar: Hangar; now: number }) {
  const block = launchBlock(hangar, now);
  const state = block?.kind === 'ready' ? block.reason : block?.kind === 'flying' || block?.kind === 'escort' || block?.kind === 'homeward' ? block.kind : 'ready';
  const dot = state === 'ready' ? 'bg-v2-self' : state === 'repair' || state === 'service' ? 'bg-v2-warn' : 'bg-v2-ink-3';
  const text = block?.kind === 'ready' ? `${block.reason === 'repair' ? c.repairing : c.servicing} · ${clockText(block.until - now)}`
    : block?.kind === 'homeward' ? `${c.homing} · ${clockText(block.until - now)}` : state === 'escort' ? c.escorting : state === 'flying' ? c.inFlight : c.ready;
  return <span className="hp-status flex items-center gap-1.5 rounded-full border border-v2-line bg-v2-deep/70 px-2 py-0.5 font-v2-mono text-micro tabular-nums text-v2-ink-2">
    <i aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
    <span data-status={state}>{text}</span>
  </span>;
}

/**
 * The repair, when it can be shortened: a band above the desk with the free clock, the paid wait
 * and its price; paying is a hold (ui-v2 rule 4), never a tap.
 */
export function RepairBlock({ c, hangar, now, busy, onRepair }: {
  c: ArenaCopy; hangar: Hangar; now: number; busy: boolean; onRepair: () => void;
}) {
  const offer = repairOffer(hangar, now);
  if (!offer) return null;
  const short = hangar.alloy < offer.cost.alloy || hangar.crystal < offer.cost.crystal;
  const until = Date.parse(hangar.ship?.readyAt ?? '');
  return <section data-part="repair" className="hp-card is-warn flex flex-col gap-2">
    <SectionHead label={c.repairTitle} icon={head('i-info')} aside={c.freeRepair(clockText(until - now))} />
    <p className="text-caption leading-relaxed text-v2-ink-3">{hangar.ship?.away === 'homeward' ? c.repairAfterHome(offer.minutes) : c.repairWait(offer.minutes)}</p>
    <p className="flex items-center justify-between gap-2 text-caption text-v2-ink-3"><span>{c.levelCost}</span><Cost cost={offer.cost} held={hangar} /></p>
    <HoldButton marker="hp-repair" label={c.repairFaster(offer.minutes)} disabledReason={short ? c.capitalShort : busy ? c.hangarBusy : null} onCommit={onRepair} />
  </section>;
}

/** Ranks as pips, so a tile reads its progress before its numbers. */
function Pips({ rank, max }: { rank: number; max: number }) {
  return <span aria-hidden className="flex gap-0.5">
    {Array.from({ length: max }, (_, i) => <i key={i} className={`h-1 w-2.5 rounded-full ${i < rank ? 'bg-v2-self' : 'bg-v2-line'}`} />)}
  </span>;
}

/**
 * THE ABILITIES (owner 2026-10-27: "a tap did it at once"). Six tiles, each with its rank; a tap
 * opens one below with what the next rank changes, and a hold spends the point (B4b). The reason a
 * point cannot go, when it cannot, stands where the hold would.
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
  return <section data-part="abilities" className="flex flex-col gap-2.5">
    <SectionHead label={c.abilitiesTitle} icon={head('i-spark')}
      aside={<span className={`font-v2-mono tabular-nums ${left > 0 ? 'text-v2-self' : 'text-v2-ink-3'}`}>{c.pointsReady(left)}</span>} />
    <ul className="grid grid-cols-3 gap-1.5">
      {ABILITIES.map(ability => {
        const at = abilityRank(ship.class, ability, ship.abilities);
        return <li key={ability}>
          <button type="button" data-ability={ability} aria-pressed={picked === ability} onClick={() => { setPicked(ability); }}
            className={`hp-tile flex w-full flex-col items-start gap-1.5 rounded-control border px-2 py-2 text-left ${picked === ability ? 'is-picked' : ''} ${ability === 'signature' ? 'is-signature' : ''}`}>
            <span className="flex w-full items-center justify-between gap-1">
              <i aria-hidden className="hp-glyph size-5 shrink-0">{icon(ability)}</i>
              <span className="font-v2-mono text-micro tabular-nums text-v2-ink-3">{Math.min(at, MAX_POINT_RANK)}/{MAX_POINT_RANK}</span>
            </span>
            <b className="w-full truncate text-caption font-semibold text-v2-ink">{name(ability)}</b>
            <Pips rank={Math.min(at, MAX_POINT_RANK)} max={MAX_POINT_RANK} />
          </button>
        </li>;
      })}
    </ul>
    <div data-part="ability-detail" className="hp-card flex flex-col gap-2">
      <p className="flex items-baseline justify-between gap-2">
        <b className="text-body font-semibold text-v2-ink">{name(picked)}</b>
        <span className="font-v2-mono text-micro text-v2-ink-3">{c.abilityRank(Math.min(rank, MAX_POINT_RANK), MAX_POINT_RANK)}</span>
      </p>
      <p className="text-caption leading-relaxed text-v2-ink-3">
        {picked === 'signature' ? c.abilityPower[ship.class] : picked === 'smoke' ? c.abilitySmokeDuration : c.abilityDuration} <span className="font-v2-mono text-v2-ink">{grow(current.power || current.duration, next.power || next.duration)}</span>{picked !== 'signature' && ` ${c.seconds}`}
        <span className="mx-1.5">·</span>{picked === 'turbo' ? c.abilityRefill : c.abilityCooldown} <span className="font-v2-mono text-v2-ink">{grow(current.cooldown, next.cooldown)}</span> {c.seconds}
      </p>
      {AFFINITY[ship.class] === picked && <p className="text-micro text-v2-self">{c.affinity}</p>}
      {top && rank < 5 && <p className="text-micro text-v2-warn">{c.abilityEssence}</p>}
      <HoldButton marker="ability-confirm" disabledReason={refused} label={c.abilityConfirm(name(picked), Math.min(5, rank + 1))} onCommit={() => { onSpend(picked); }} />
    </div>
  </section>;
}

/**
 * THE LEVEL AS A GOAL (owner 2026-10-27): the badge, the bar towards the next level, how XP comes,
 * and the next level as a hold that is always there, saying what it still needs when it cannot go.
 */
export function LevelBlock({ c, hangar, busy, onUpgrade }: { c: ArenaCopy; hangar: Hangar; busy: boolean; onUpgrade: () => void }) {
  const ship = hangar.ship; if (!ship) return null;
  const top = ship.xpNext === 0; const capped = !top && ship.level >= ship.levelCap; const full = !top && !capped && ship.xp >= ship.xpNext;
  const short = hangar.alloy < ship.upgrade.alloy || hangar.crystal < ship.upgrade.crystal;
  const share = top ? 1 : Math.min(1, ship.xp / ship.xpNext);
  const refused = ship.flying ? c.blocked.flying : ship.away === 'escort' ? c.blocked.escort : !full ? c.xpToGo(ship.xpNext - ship.xp)
    : short ? c.capitalShort : busy ? c.hangarBusy : null;
  return <section data-part="level" className="hp-card flex flex-col gap-2.5">
    <div className="flex items-center gap-3">
      <span aria-hidden className="hp-badge">{ship.level}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex items-baseline justify-between gap-2">
          <b className="text-body font-semibold text-v2-ink">{c.level(ship.level)}{!top && <span className="font-normal text-v2-ink-3"> → {c.level(ship.level + 1)}</span>}</b>
          <span className="font-v2-mono text-micro tabular-nums text-v2-ink-2">{top ? c.topLevel : c.xpBar(ship.xp, ship.xpNext)}</span>
        </p>
        <span aria-hidden className="relative h-1.5 overflow-hidden rounded-full bg-v2-line">
          <span data-bar="" className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${capped ? 'bg-v2-warn/70' : 'bg-v2-self'}`}
            style={{ width: `${String(share * 100)}%` }} />
        </span>
      </div>
    </div>
    <p className="text-micro leading-relaxed text-v2-ink-3">{c.xpHow}</p>
    {capped && <p className="text-caption text-v2-warn">{c.levelCapLine(ship.levelCap)}</p>}
    {!top && !capped && <>
      <p className="flex items-center justify-between gap-2 text-caption text-v2-ink-3"><span>{c.levelCost}</span><Cost cost={ship.upgrade} held={hangar} /></p>
      <HoldButton marker="hp-level" label={c.upgradeTo(ship.level + 1)} disabledReason={refused} onCommit={onUpgrade} />
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
  return <section data-part="growth" className="flex flex-col gap-2.5">
    <SectionHead label={c.statsTitle} icon={glyph(<path d="M5 19v-7M12 19V5M19 19v-10" />, 'size-3')} {...(level < 20 ? { aside: c.growthKey(level + 1) } : {})} />
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
      {rows.map((row, i) => {
        const now = row.value(ship); const next = after[i]?.value(ship) ?? now; const max = most[i]?.value(ship) ?? now;
        const gain = gains.get(row.key);
        return <div key={row.key} data-stat={row.key} className="min-w-0">
          <dt className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-caption text-v2-ink-3">{STAT_ICONS[row.key]}<span className="truncate">{c.classStats[row.key]}</span></span>
            <b className="font-v2-mono text-caption font-semibold tabular-nums text-v2-ink">{row.text(now)}</b>
          </dt>
          <dd aria-hidden className="relative mt-1.5 flex h-1 overflow-hidden rounded-full bg-v2-line">
            <span data-now="" className="hp-fill h-full" style={{ width: at(now, max) }} />
            {gain && <span data-next="" className="hp-next h-full" style={{ width: at(next - now, max) }} />}
          </dd>
          {gain && <dd className="mt-0.5 text-right font-v2-mono text-micro text-v2-self">{gain}</dd>}
        </div>;
      })}
    </dl>
  </section>;
}

/**
 * The class: the tabs to look at each, one line on what it is for, its signature, and the three
 * side by side in one table, the best of each row bright (owner 2026-10-27: "the marks mean nothing").
 */
export function ClassBlock({ c, value, level, onPick, aside, children, points = {} }: {
  c: ArenaCopy; value: ShipClass; level: number; onPick?: (ship: ShipClass) => void; aside?: string; children?: ReactNode; points?: AbilityPoints;
}) {
  const signature = abilityStats(value, 'signature', abilityRank(value, 'signature', points));
  return <div data-part="class" className="flex flex-col gap-4" style={shipTone(value)}>
    <section className="flex flex-col gap-2.5">
      <SectionHead label={c.classTitle} icon={head('i-fleet')} {...(aside === undefined ? {} : { aside })} />
      {onPick && <Segmented label={c.shipTitle} value={value} onChange={onPick} options={SHIP_CLASSES.map(id => ({ id, label: c.classes[id].name,
        icon: <i aria-hidden className={`hp-glyph size-4 ${id === value ? '' : 'opacity-55'}`} style={{ color: SHIP_TONE[id] }}>{SIGNATURE_ICONS[id]}</i> }))} />}
      {children}
      <p className="text-caption leading-relaxed text-v2-ink-2">{c.classes[value].line}</p>
      <div className="hp-sig flex items-center gap-3 rounded-control border px-2.5 py-2">
        <i aria-hidden className="hp-sig-icon hp-glyph grid size-8 shrink-0 place-items-center rounded-control">{SIGNATURE_ICONS[value]}</i>
        <p className="min-w-0 text-caption leading-snug">
          <strong className="hp-sig-name block font-semibold">{c.signatures[value].name}</strong>
          <span className="text-v2-ink-3">{c.signatures[value].line(one(signature.power), one(signature.cooldown))}</span>
        </p>
      </div>
    </section>
    <section data-part="compare" className="flex flex-col gap-2">
      <SectionHead label={c.statsTitle} icon={glyph(<path d="M5 19v-7M12 19V5M19 19v-10" />, 'size-3')} aside={c.compareKey} />
      <table className="hp-compare w-full table-fixed text-caption">
        <thead><tr>
          <th scope="col" className="w-[30%]"><span className="sr-only">{c.statsTitle}</span></th>
          {SHIP_CLASSES.map(ship => <th key={ship} scope="col" data-ship={ship} className={ship === value ? 'is-own' : ''} style={shipTone(ship)}>
            <span className="flex flex-col items-center gap-0.5"><i aria-hidden className="hp-glyph size-3.5" style={{ color: SHIP_TONE[ship] }}>{SIGNATURE_ICONS[ship]}</i>
              <span className="truncate text-micro font-semibold">{c.classes[ship].name}</span></span>
          </th>)}
        </tr></thead>
        <tbody>
          {classStatRows(c, level).map(row => {
            const best = Math.max(...SHIP_CLASSES.map(row.value));
            return <tr key={row.key} data-stat={row.key}>
              <th scope="row"><span className="flex items-center gap-1.5 font-normal text-v2-ink-3">{STAT_ICONS[row.key]}<span className="truncate">{c.classStats[row.key]}</span></span></th>
              {SHIP_CLASSES.map(ship => <td key={ship} data-ship={ship} {...(row.value(ship) >= best - 1e-9 ? { 'data-best': '' } : {})}
                className={`${ship === value ? 'is-own' : ''} font-v2-mono tabular-nums`}>{row.text(row.value(ship))}</td>)}
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
    return <div data-gauge={part} className="flex flex-col gap-1.5">
      <p className="flex items-center justify-between gap-2 text-caption">
        <span className="flex items-center gap-1.5 text-v2-ink-2">{icon}<b className="font-semibold text-v2-ink">{title}</b>
          <span className="font-v2-mono text-micro text-v2-ink-3">{c.aboard(Math.floor(have), Math.round(full))}</span></span>
        <span className={`font-v2-mono text-micro tabular-nums ${price > 0 ? 'text-v2-deut' : 'text-v2-ink-3'}`}>{c.topUp(price)}</span>
      </p>
      <div role="radiogroup" aria-label={title} className="flex gap-1">
        {LOADOUT[part].map(step => {
          const empty = step === 0;
          // A quarter more than half aboard reads as aboard: 96 % drew its last quarter empty (review 2026-10-27).
          const fill = empty ? '' : step - 12.5 <= aboard + 1e-9 ? 'is-aboard' : step <= plan ? 'is-plan' : '';
          return <button key={step} type="button" role="radio" aria-checked={plan === step} aria-label={c.planSet(title, step)} disabled={busy}
            onClick={() => { if (plan !== step) onPlan({ ...ship.plan, [part]: step }); }}
            className={`hp-cell ${empty ? 'is-empty-step' : 'flex-1'} ${fill} ${plan === step ? 'is-chosen' : ''}`}>
            <span className="font-v2-mono text-micro">{empty ? c.ammoNone : c.planFill(step)}</span>
          </button>;
        })}
      </div>
    </div>;
  };
  return <section data-part="loadout" className="hp-card flex flex-col gap-3">
    <SectionHead label={c.loadoutTitle} icon={head('i-fleet')} />
    {gauge('fuel', c.fuelTitle, STAT_ICONS.fuel, ship.fuel, stats.fuelTank, hangar.refill.fuel)}
    {gauge('ammo', c.ammoTitle, STAT_ICONS.fire, ship.ammo, stats.ammoCapacity, hangar.refill.ammo)}
    {ship.plan.ammo === 0 && <p className="text-caption text-v2-warn">{c.ammoNoneNote}</p>}
    <p className="text-micro leading-relaxed text-v2-ink-3">{c.planNote}</p>
    <p className="flex items-center justify-between gap-2 border-t border-v2-line pt-2 text-caption">
      <span className="text-v2-ink-2">{c.launchCost}</span>
      <span className={`flex items-center gap-1 font-v2-mono text-caption tabular-nums ${hangar.refill.total > hangar.deuterium ? 'text-v2-warn' : 'text-v2-ink'}`}>
        <img src={RESOURCE_ART.deuterium} alt={i18n.t('vocabulary.resource.deuterium')} className="size-3.5 shrink-0 object-contain" />{amount(hangar.refill.total)}
      </span>
    </p>
  </section>;
}

/** What the capital can still take from the Yarık today, per resource, and when that fills again. */
export function CapBlock({ c, hangar }: { c: ArenaCopy; hangar: Hangar }) {
  const left = capLeft(hangar);
  const resets = new Date(hangar.resetsAt).toLocaleTimeString(i18n.resolvedLanguage, { hour: '2-digit', minute: '2-digit' });
  return <section data-part="cap" className="flex flex-col gap-2">
    <SectionHead label={c.capTitle} icon={head('i-base')} aside={`${c.capResets} ${resets}`} />
    <ul className="grid grid-cols-3 gap-1.5">
      {KINDS.map((key, kind) => <li key={key} className="flex min-w-0 items-center gap-1.5 rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
        <img src={RESOURCE_ART[key]} alt="" className={`size-4 shrink-0 object-contain ${left[key] > 0 ? '' : 'opacity-40'}`} />
        <span className="flex min-w-0 flex-col leading-tight">
          {left[key] > 0 ? <b className={`font-v2-mono text-caption font-semibold tabular-nums ${KIND_INK[kind]}`}>{amount(left[key])}</b>
            : <b className="text-caption font-medium text-v2-ink-3">{c.capFull}</b>}
          <small className="truncate text-micro text-v2-ink-3">{c.kinds[kind]}</small>
        </span>
      </li>)}
    </ul>
  </section>;
}

/** Why the desk reads as it does: one tap deeper, never on the rows. */
export function RulesBlock({ c }: { c: ArenaCopy }) {
  const [open, setOpen] = useState(false);
  return <section data-part="rules">
    <button type="button" aria-expanded={open} aria-label={open ? c.rulesClose : c.rulesOpen} onClick={() => { setOpen(value => !value); }}
      className="flex min-h-8 w-full items-center gap-2 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">
      {head('i-info')}<span>{c.rulesOpen}</span>
      <span aria-hidden className="h-px flex-1 bg-v2-line" />
      <svg aria-hidden viewBox="0 0 12 12" className={`size-3 fill-none stroke-current transition-transform ${open ? 'rotate-180' : ''}`}><path d="M3 4.5 6 7.5 9 4.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <ul className="flex flex-col gap-1.5 pt-1 text-caption leading-relaxed text-v2-ink-2">
      {c.rules.map(line => <li key={line} className="relative pl-3 before:absolute before:left-0.5 before:top-[0.6em] before:size-1 before:rounded-full before:bg-v2-ink-3">{line}</li>)}
    </ul>}
  </section>;
}

/** A desk that answered no, or an order it refused: said plainly, not as an alarm (red is for harm). */
export function DeskNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="flex items-center gap-2 rounded-control border border-v2-line bg-v2-panel px-3 py-2 text-caption text-v2-ink-2">
    <Icon id="i-warn" className="size-3.5 shrink-0 text-v2-warn" />{children}</p>;
}
