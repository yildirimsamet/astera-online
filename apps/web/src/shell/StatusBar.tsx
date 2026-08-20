import { useEffect, useRef, useState } from 'react';
import { collectorCap } from '@astera/rules';
import { useCollect, usePlanet, useSeason } from '../api/queries.js';
import { compact, full } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { haptic } from '../lib/haptics.js';
import { useProjected, type Projected } from '../lib/projection.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { ChevronIcon, IntelIcon } from '../ui/icons/index.js';
import { Meter } from '../ui/Meter.js';
import { describe, useToast } from '../ui/Toast.js';
import type { PlanetView } from '../api/schemas.js';
import { Signals } from './Signals.js';
import type { Panel } from '../screens/GalaxyView.jsx';
import { serverNow } from '../lib/clock.js';

/**
 * What you hold, what is waiting, and how long the season has left.
 *
 * One of only two things left outside the galaxy (D20), so it has to earn every
 * pixel. Four jobs:
 *
 *   · WHAT IS SPENDABLE — storage, against its ceiling.
 *   · WHAT IS WAITING — the works (D16). This is the reason to open the game when
 *     nothing is in flight, so it is a control rather than a readout: one tap
 *     empties it, and when it is full it says what that is costing per hour.
 *   · WHAT IS NEW — the signals beacon.
 *   · WHO YOU ARE — the commander control, which is the whole of the account: the
 *     galaxy you are in, how long the season has, and the way out.
 */
export function StatusBar({
  commander,
  onOpen,
}: {
  /** Who is signed in. The header states it, because it is the way back out. */
  commander: string;
  onOpen: (panel: Panel) => void;
}) {
  const { data, dataUpdatedAt } = usePlanet();
  const season = useSeason();
  const held = useProjected(data?.planet, dataUpdatedAt);

  if (!data) return <div className="h-[70px]" />;

  const hoursLeft = season.data
    ? Math.max(0, (season.data.endsAt.getTime() - serverNow()) / 3_600_000)
    : null;

  return (
    <header className="relative shrink-0 border-b border-line bg-gradient-to-b from-[#0b1120] to-void px-3 pb-2 pt-[calc(10px+env(safe-area-inset-top))]">
      <div className="flex items-end gap-3">
        <Stock
          label="Alloy"
          value={held.alloy}
          cap={data.planet.alloyCap}
          rate={data.planet.alloyPerHour}
          tone="alloy"
        />
        <Stock
          label="Crystal"
          value={held.crystal}
          cap={data.planet.crystalCap}
          rate={data.planet.crystalPerHour}
          tone="crystal"
        />
        <div className="flex shrink-0 items-end gap-2 pb-0.5">
          {/**
           * THE WAY OUT SAYS YOUR NAME. Owner-reported bug: "there is no logout
           * button, I cannot sign out."
           *
           * There was one. It has always been in the commander sheet, and this
           * control has always opened that sheet — but the control said SEASON and
           * drew a duration under it, so what a player saw was a clock. It read as a
           * readout, and nobody presses a readout. D21 put the account behind the
           * season figure on the argument that "how long have I got" and "who am I,
           * and how do I leave" are the same question asked twice; that is true of
           * the SHEET and was never true of the LABEL.
           *
           * So the label is the commander now and the season stays as the figure
           * underneath. Same one control, same sheet, same width — the name is
           * capped and truncates rather than eating into the two stock columns
           * beside it, which have about ninety pixels each on a phone and need
           * every one of them. It is also the only thing in the header that is
           * about the account rather than the world, which is exactly what a player
           * hunts for when they want to leave.
           *
           * `I5` in `docs/interface.md`: a surface with no permanent way in does not
           * exist for the player, and a way in labelled as something else is not a
           * way in. It was briefly at the foot of the planet sheet, which is worse
           * again — that puts sign-out behind a hit-test against a sphere in a 3D
           * scene, and a player who cannot find their planet cannot sign out.
           */}
          <button
            type="button"
            aria-label={`Commander ${commander} — season, galaxy and sign out`}
            onClick={() => {
              haptic('tap');
              onOpen('commander');
            }}
            className="flex h-9 flex-col justify-center rounded-sm border border-line-soft bg-deep px-1.5 text-right transition-colors hover:border-line active:bg-raised/60"
          >
            <span className="flex items-center justify-end gap-0.5">
              {/* The display face, but NOT the `legend` class: that carries 0.14em of
                  tracking, which is right for a four-letter label and costs about
                  three characters of a sixteen-character name in a column this
                  narrow. A name truncated to "SHOT1E7…" identifies nobody. */}
              <span className="max-w-[76px] truncate font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.02em] text-bone">
                {commander}
              </span>
              <ChevronIcon className="size-3 shrink-0 text-faint" />
            </span>
            <span className="readout text-[12px] leading-tight text-dim">
              {hoursLeft === null ? '—' : duration(hoursLeft * 60)}
            </span>
          </button>
          {/*
            THE WAY INTO WHAT YOU KNOW. Owner-reported bug.

            The Intel centre — telescope readings, probe reports, battle reports,
            the radar log — could only be opened by tapping a NOTIFICATION of the
            right kind in Signals. A player with an empty mailbox had no route to
            it at all, which means the surface that holds "the information is the
            game" was reachable only as a side effect of somebody else acting.

            It sits beside the beacon because the two are the same subject seen
            twice: Signals is what you were TOLD, Intel is what you KNOW.
          */}
          <button
            type="button"
            aria-label="Intel — what you know"
            onClick={() => {
              haptic('tap');
              onOpen('intel');
            }}
            className="flex size-9 items-center justify-center rounded-sm border border-line-soft bg-deep text-dim transition-colors hover:border-line hover:text-bone"
          >
            <IntelIcon className="size-5" />
          </button>
          <Signals onOpen={onOpen} />
        </div>
      </div>

      <Works planet={data} held={held} onOpen={onOpen} />
    </header>
  );
}


/**
 * WHAT IS IN THE AIR, AND WHAT IS NOT. D28.
 *
 * The honest version of a return hook. Every other builder pushes a notification
 * when it wants you back; this states a fact about your own planet and lets you
 * decide what it means — a dark bay says *you have not finished your turn* without
 * a streak, a bonus or a nag, which is the line `game-design.md` draws around
 * notifications and this stays on the right side of.
 *
 * Pips rather than "2 / 4" because the count is small and a shape is read faster
 * than a fraction at a glance — and because a lit bay and a dark one are exactly
 * the two states the player cares about. The number is there for a screen reader.
 */
export function Bays({ flight }: { flight: { used: number; total: number } }) {
  if (flight.total <= 0) return null;
  const free = Math.max(0, flight.total - flight.used);
  return (
    <div
      className="flex shrink-0 flex-col justify-center gap-1 pl-1 pr-0.5 text-right"
      role="img"
      aria-label={`${String(flight.used)} of ${String(flight.total)} flight bays in use`}
    >
      <p className="legend">In flight</p>
      <div className="flex items-center justify-end gap-[3px]" aria-hidden>
        {Array.from({ length: flight.total }, (_, i) => (
          <span
            key={i}
            className={
              i < flight.used
                ? 'h-2.5 w-[5px] rounded-[1px] bg-crystal shadow-[0_0_5px_var(--color-crystal-glow)]'
                : 'h-2.5 w-[5px] rounded-[1px] bg-line'
            }
          />
        ))}
      </div>
      <p className="sr-only">{free} free</p>
    </div>
  );
}

/**
 * THE WORKS — D16, drawn as vessels rather than described in words.
 *
 * The first version was a sentence: "in the works, 1,240 alloy, full in 3h". True,
 * and it taught nobody anything. A player does not learn a loop by reading its
 * specification; they learn it by watching a container fill and noticing it stop.
 * That is how Clash of Clans teaches collectors and it never says a word.
 *
 * SO THE SHAPE CARRIES THE ARGUMENT:
 *
 *   · TWO SMALL VESSELS, beside two big storage bars. The size difference is the
 *     lesson — the thing production lands in is visibly a fraction of the thing it
 *     ends up in, so "I have to move it across, and it will not wait forever" is
 *     obvious before anyone explains it.
 *   · THE RIM IS ALWAYS DRAWN AT FULL HEIGHT. Empty space above the fill is how
 *     much room is left. A bar that only shows what is present cannot show what is
 *     about to be lost.
 *   · FULL IS A STATE CHANGE, not a bigger number. Amber, pulsing, and the
 *     inflow animation stops. Production has halted, and the picture says so.
 *
 * Always present once the planet produces anything, including when empty. A
 * control that appears only when it matters is a control nobody has learned by the
 * time it matters.
 */
function Works({
  planet,
  held,
  onOpen,
}: {
  planet: PlanetView;
  /**
   * The PROJECTED works, not the fetched ones. This is the fix for "the works
   * don't update while I play": the planet query has no poll — deliberately, a
   * timer on a game where a fleet lands in forty minutes is pure battery — so
   * without a local projection these vessels held whatever the last fetch said and
   * sat there. A vessel that never fills cannot teach that it fills.
   */
  held: Projected;
  onOpen: (panel: Panel) => void;
}) {
  const collect = useCollect();
  const say = useToast();

  const { bufferAlloyCap, bufferCrystalCap } = planet.planet;
  const { bufferAlloy, bufferCrystal } = held;
  const waiting = bufferAlloy + bufferCrystal;
  const alloyFill = bufferAlloyCap > 0 ? Math.min(1, bufferAlloy / bufferAlloyCap) : 0;
  const crystalFill = bufferCrystalCap > 0 ? Math.min(1, bufferCrystal / bufferCrystalCap) : 0;
  const full = alloyFill >= 0.995 || crystalFill >= 0.995;
  const something = waiting >= 1;

  // Whether the store can actually take it. Collecting into a full store moves
  // nothing and holds the rest back, so the button says so before it is pressed.
  const roomAlloy = Math.max(0, planet.planet.alloyCap - planet.planet.alloy);
  const roomCrystal = Math.max(0, planet.planet.crystalCap - planet.planet.crystal);
  const blocked = something && bufferAlloy > roomAlloy + 1 && bufferCrystal > roomCrystal + 1;

  return (
    <div className="mt-2 flex items-stretch gap-2">
      <button
        type="button"
        disabled={collect.isPending || !something}
        aria-label={
          full ? 'Works are full — collect now' : `Collect ${String(Math.round(waiting))}`
        }
        onClick={() => {
          haptic('commit');
          collect.mutate(undefined, {
            onSuccess: (r) => {
              const moved = Math.round(r.moved.alloy + r.moved.crystal);
              const held = Math.round(r.blocked.alloy + r.blocked.crystal);
              say(
                held > 0 ? `Collected ${compact(moved)} · ${compact(held)} would not fit` : `Collected ${compact(moved)}`,
                held > 0 ? 'error' : undefined,
              );
            },
            onError: (err) => {
              say(describe(err), 'error');
            },
          });
        }}
        className={`works ${full ? 'works-full' : ''} ${something ? '' : 'works-idle'}`}
      >
        <span className="works-vessels" aria-hidden>
          <Vessel fill={alloyFill} tone="alloy" flowing={!full && planet.planet.alloyPerHour > 0} />
          <Vessel
            fill={crystalFill}
            tone="crystal"
            flowing={!full && planet.planet.crystalPerHour > 0}
          />
        </span>

        <span className="works-body">
          <span className="legend">{full ? 'Works full' : 'Works'}</span>
          <span className={`num works-amount ${full ? 'text-alloy' : 'text-bone'}`}>
            {compact(waiting)}
          </span>
        </span>

        <span className={`works-action ${full ? 'text-alloy' : 'text-crystal'}`}>
          {something ? 'Collect' : '—'}
        </span>
      </button>

      {blocked && (
        <button
          type="button"
          onClick={() => {
            onOpen('planet');
          }}
          className="shrink-0 self-center text-[10px] leading-tight text-threat underline-offset-2 hover:underline"
        >
          Store full
        </button>
      )}

      <Bays flight={planet.flight} />
    </div>
  );
}

/** One container, with its rim drawn full height so the headroom is visible. */
function Vessel({
  fill,
  tone,
  flowing,
}: {
  fill: number;
  tone: 'alloy' | 'crystal';
  flowing: boolean;
}) {
  return (
    <span className="works-vessel">
      <span
        className={`works-fill works-fill-${tone}`}
        style={{ height: `${String(fill * 100)}%` }}
      />
      {flowing && <span className={`works-drip works-drip-${tone}`} />}
    </span>
  );
}

/**
 * ONE STORE: what is spendable, and how much room is left.
 *
 * TWO LINES, AND THE SPLIT IS THE FIX. Owner-reported bug.
 *
 * The figure and the headroom used to share a line, and they lost: two of these
 * columns divide a phone's width with the season clock and two header controls,
 * so each one had about ninety pixels for an icon, a five-digit number and the
 * words "201 free". At four digits they touched; at five they overlapped, and
 * the single most-read number in the game became unreadable at exactly the point
 * a player starts having something worth reading.
 *
 * Shrinking the type alone does not fix it — it just makes an unreadable number
 * smaller — so the headroom moved down beside the meter, which had a whole line
 * to itself and nothing on the right of it. Nothing was dropped and nothing got
 * taller. The number now has the top line to itself and stays at full size for
 * everything a season can produce.
 *
 * The `clamp()` stays as the backstop for a store nobody has seen yet, measured
 * against `cqi` — this column's own width — rather than the viewport, because
 * what the figure has to fit is its column and the column depends on the header's
 * other controls, which a media query cannot see.
 */
function Stock({
  label,
  value,
  cap,
  rate,
  tone,
}: {
  label: string;
  value: number;
  cap: number;
  rate: number;
  tone: 'alloy' | 'crystal';
}) {
  const atCap = value >= cap - 0.5;
  const near = !atCap && rate > 0 && value > cap * 0.8;
  const colour = tone === 'alloy' ? 'text-alloy' : 'text-crystal';
  const pop = useJump(value);

  return (
    <div className="min-w-0 flex-1" style={{ containerType: 'inline-size' }}>
      <div className="flex items-center gap-1.5">
        <img
          src={tone === 'alloy' ? RESOURCE_ART.alloy : RESOURCE_ART.crystal}
          alt=""
          aria-hidden
          className="size-5 shrink-0 object-contain drop-shadow-[0_0_5px_rgba(120,160,220,0.35)]"
        />
        {/*
          Still `full()` and never `compact()`. This is what the player is holding
          and what they are about to spend; a store that reads "10k" cannot be
          checked against a price of 9,240.
        */}
        <span
          className={`readout min-w-0 truncate ${colour} ${pop ? 'pop' : ''}`}
          style={{ fontSize: 'clamp(13px, 22cqi, 18px)' }}
        >
          {full(value)}
        </span>
      </div>
      <p className="sr-only">{label}</p>
      {/*
        The ceiling, stated as space rather than as a rate, on the meter's own
        line — it is a fact ABOUT the meter and it was never worth a place beside
        the figure. Production no longer flows in here on its own (D16); it
        arrives in collected lumps, so "full in 3h" would be a lie and what
        matters is whether the next collection will fit.
      */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="min-w-0 flex-1">
          <Meter value={value} cap={cap} tone={tone} cells={10} />
        </span>
        <span
          className={`num shrink-0 text-[10px] leading-none ${
            atCap ? 'text-threat' : near ? 'text-alloy' : 'text-faint'
          }`}
        >
          {atCap ? 'FULL' : `${compact(cap - value)} free`}
        </span>
      </div>
    </div>
  );
}

/**
 * True for a moment after a value jumps by more than the trickle.
 *
 * Collection moves a lump and a raid landing moves thousands; both deserve to be
 * felt. The threshold is what separates them from noise.
 */
function useJump(value: number): boolean {
  const previous = useRef(value);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const delta = Math.abs(value - previous.current);
    const material = delta > Math.max(50, previous.current * 0.04);
    previous.current = value;
    if (!material) return;

    setPopping(true);
    const id = setTimeout(() => {
      setPopping(false);
    }, 450);
    return () => {
      clearTimeout(id);
    };
  }, [value]);

  return popping;
}

/** Kept for the tests that assert the collector's ceiling maths. */
export { collectorCap };
