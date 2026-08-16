import { upgradeCost, type BuildingId, type SatelliteId } from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { buildingGain, satelliteGain, type Gain } from '../lib/gains.js';
import { BUILDING_ART, RESOURCE_ART, satelliteArt, tierOf } from './assets.js';
import { CoreMark, ShipyardMark, VaultMark } from './marks.js';
import { Sheet } from './Sheet.js';
import type { Blocked } from './UpgradeRow.js';

/**
 * WHAT THIS THING BECOMES.
 *
 * The row on the planet screen answers "what does one more level cost and give".
 * This answers the question that actually pulls a player up a tech tree: *where
 * does this end up*. Three levels ahead, each with its number, its price and the
 * art it will be wearing — so a Telescope at L1 is visibly a small dish that
 * becomes an array, and the player can see the array before paying for it.
 *
 * It is also the commit surface. Construction is instant (D4), so a purchase gets
 * its weight from being considered rather than from being waited out: you open the
 * thing, you see the before and the after, you press once.
 */

export type ItemRef =
  | { kind: 'building'; id: BuildingId }
  | { kind: 'satellite'; id: SatelliteId };

/** How many levels ahead the ladder shows. Past three, nobody is planning. */
const HORIZON = 3;

export function ItemSheet({
  item,
  name,
  role,
  planet,
  held,
  blocked,
  pending,
  onAct,
  onClose,
}: {
  item: ItemRef;
  name: string;
  role: string;
  planet: PlanetView;
  held: { alloy: number; crystal: number };
  blocked?: Blocked;
  pending: boolean;
  onAct: () => void;
  onClose: () => void;
}) {
  const level = levelOf(planet, item);
  const cost = costFor(planet, item, level);
  const short = {
    alloy: Math.max(0, cost.alloy - held.alloy),
    crystal: Math.max(0, cost.crystal - held.crystal),
  };
  const affordable = short.alloy === 0 && short.crystal === 0;

  const rungs = Array.from({ length: HORIZON }, (_, i) => level + 1 + i);

  return (
    <Sheet
      eyebrow={level === 0 ? 'Not installed' : `Level ${String(level)}`}
      title={name}
      onClose={onClose}
      footer={
        blocked ? (
          <button
            type="button"
            className="btn w-full"
            disabled={!blocked.onFix}
            onClick={() => {
              haptic('tap');
              blocked.onFix?.();
              onClose();
            }}
          >
            {blocked.onFix ? `Go to ${blocked.reason}` : blocked.reason}
          </button>
        ) : (
          <button
            type="button"
            className="btn w-full"
            disabled={!affordable || pending}
            onClick={() => {
              haptic('commit');
              onAct();
              onClose();
            }}
          >
            {level === 0 ? 'Install' : `Raise to L${String(level + 1)}`} · {compact(cost.alloy)}{' '}
            alloy
            {cost.crystal > 0 && ` · ${compact(cost.crystal)} crystal`}
          </button>
        )
      }
    >
      <Portrait item={item} level={level} />

      <p className="mt-4 text-[13px] leading-relaxed text-dim">{role}</p>

      {blocked && (
        <p className="mt-3 border border-threat/30 bg-threat/10 px-3 py-2 text-[12px] text-threat">
          Locked — needs {blocked.reason}.
        </p>
      )}

      {!blocked && !affordable && (
        <p className="mt-3 text-[12px] text-alloy">
          Short {short.alloy > 0 && `${compact(short.alloy)} alloy`}
          {short.alloy > 0 && short.crystal > 0 && ' and '}
          {short.crystal > 0 && `${compact(short.crystal)} crystal`}.
        </p>
      )}

      <div className="mt-6">
        <p className="legend mb-2">What each level buys</p>
        <div className="frame">
          {rungs.map((rung) => (
            <Rung
              key={rung}
              item={item}
              level={rung}
              cost={costFor(planet, item, rung - 1)}
              next={rung === level + 1}
              // Several levels of the same instrument sell the same capability,
              // and printing that sentence three times turns the ladder into
              // wallpaper. A rung states its unlock only when it is a new one.
              repeats={rung > level + 1 && gainFor(item, rung - 1).unlocks === gainFor(item, rung - 2).unlocks}
            />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** The current tier, at the size the art was drawn for. */
function Portrait({ item, level }: { item: ItemRef; level: number }) {
  const art = artFor(item, Math.max(1, level));
  const mark = markFor(item);

  return (
    <div className="art-well -mx-4 -mt-4 flex h-40 items-center justify-center">
      {art ? (
        <img
          src={art}
          alt=""
          aria-hidden
          className={`h-32 object-contain ${level === 0 ? 'opacity-45 grayscale' : ''}`}
        />
      ) : (
        <div className={level === 0 ? 'opacity-45 grayscale' : ''}>{mark}</div>
      )}
    </div>
  );
}

/**
 * One level of the ladder.
 *
 * The next one is lit and priced; the two beyond it are dimmer but still fully
 * legible — they are the reason to keep going, not decoration. Art appears only on
 * the rungs where it actually changes, which is what makes those rungs feel like
 * arriving somewhere.
 */
function Rung({
  item,
  level,
  cost,
  next,
  repeats,
}: {
  item: ItemRef;
  level: number;
  cost: { alloy: number; crystal: number };
  next: boolean;
  /** True when this rung's unlock line is the same one the rung above already made. */
  repeats: boolean;
}) {
  const gain = gainFor(item, level - 1);
  const art = tierChangesAt(item, level) ? artFor(item, level) : null;

  return (
    <div
      className={`flex items-start gap-3 border-b border-line-soft p-3 last:border-b-0 ${
        next ? '' : 'opacity-65'
      }`}
    >
      <div className="w-9 shrink-0 pt-0.5">
        <span className={`num text-[13px] ${next ? 'text-crystal' : 'text-faint'}`}>
          L{level}
        </span>
      </div>

      {art && (
        <div className="art-well flex size-11 shrink-0 items-center justify-center rounded">
          <img src={art} alt="" aria-hidden className="size-10 object-contain" loading="lazy" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="num text-[13px]">
          <span className="text-faint">{gain.label} </span>
          <span className={next ? 'text-bone' : 'text-dim'}>{gain.next}</span>
        </p>
        {gain.unlocks && !repeats && (
          <p className="mt-1 text-[11px] leading-snug text-crystal/80">{gain.unlocks}</p>
        )}
      </div>

      <span className="num shrink-0 pt-0.5 text-right text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <img src={RESOURCE_ART.alloy} alt="alloy" className="size-3.5 object-contain" />
          {compact(cost.alloy)}
        </span>
        {cost.crystal > 0 && (
          <span className="mt-0.5 flex items-center gap-1 text-crystal/70">
            <img src={RESOURCE_ART.crystal} alt="crystal" className="size-3.5 object-contain" />
            {compact(cost.crystal)}
          </span>
        )}
      </span>
    </div>
  );
}

/* ── the two kinds, in one place ────────────────────────────── */

const levelOf = (planet: PlanetView, item: ItemRef): number =>
  (item.kind === 'building' ? planet.buildings[item.id] : planet.satellites[item.id]) ?? 0;

/**
 * The server's own price for the next step, and the rules' price beyond it.
 *
 * `nextCosts` is authoritative and may include modifiers the client does not know
 * about, so it wins wherever it applies — which is only ever the very next level.
 */
function costFor(
  planet: PlanetView,
  item: ItemRef,
  from: number,
): { alloy: number; crystal: number } {
  if (item.kind === 'building' && from === (planet.buildings[item.id] ?? 0)) {
    return planet.nextCosts[item.id] ?? upgradeCost(from);
  }
  return upgradeCost(from);
}

const gainFor = (item: ItemRef, level: number): Gain =>
  item.kind === 'building' ? buildingGain(item.id, level, 0) : satelliteGain(item.id, level);

function artFor(item: ItemRef, level: number): string | null {
  return item.kind === 'satellite' ? satelliteArt(item.id, level) : BUILDING_ART[item.id];
}

/** Buildings have one render; satellites re-tier at L3 and L5. */
const tierChangesAt = (item: ItemRef, level: number): boolean =>
  item.kind === 'satellite' && tierOf(level) !== tierOf(level - 1);

function markFor(item: ItemRef) {
  if (item.kind !== 'building') return null;
  switch (item.id) {
    case 'CORE':
      return <CoreMark />;
    case 'VAULT':
      return <VaultMark />;
    case 'SHIPYARD':
      return <ShipyardMark />;
    default:
      return null;
  }
}
