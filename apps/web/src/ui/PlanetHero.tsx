import { fleetCount } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { powerOf } from '../lib/gains.js';
import { countdown, useNow } from '../lib/time.js';
import { SATELLITE_ART, RESOURCE_ART } from './assets.js';
import { PlanetSigil } from './PlanetSigil.js';

/**
 * "This is MY planet."
 *
 * The ownership pillar is carried by an image, not a heading. The planet is the
 * largest object in the interface; the satellites orbit it; the shield encloses it.
 * A player who buys a satellite should see it appear overhead, and that is the
 * entire feedback loop for a screen full of purchases.
 *
 * Underneath: POWER and output, then three verdicts. "None" is a verdict. "0
 * ground units" is a number the player still has to interpret.
 */
export function PlanetHero({
  planet,
  compact: compactMode = false,
}: {
  planet: PlanetView;
  /**
   * Drops the portrait and the name. Used when this sits in a panel over the live
   * galaxy — the planet is already on screen behind the sheet, and drawing it
   * twice would be the only duplicated object in the interface.
   */
  compact?: boolean;
}) {
  const now = useNow(1000);
  const orbitals = planet.orbit;
  const disruptedFor = planet.planet.disruptedUntil
    ? planet.planet.disruptedUntil.getTime() - now
    : 0;

  const ground = fleetCount(planet.ground);
  const home = fleetCount(planet.fleet);
  const exposed = Math.max(
    0,
    planet.planet.alloy + planet.planet.crystal - planet.planet.vaultFloor,
  );

  if (compactMode) {
    return (
      <div className="mb-5">
        <Readouts planet={planet} />
        <Verdicts planet={planet} ground={ground} home={home} exposed={exposed} />
        {disruptedFor > 0 && <Disrupted ms={disruptedFor} />}
      </div>
    );
  }

  return (
    <div className="mb-5">
      {/*
        Side by side rather than stacked.
        A full-width portrait with the numbers underneath pushed every actual
        decision below the fold — the player had to scroll past their own planet
        to do anything with it. The planet keeps its presence; it just stops
        occupying the screen alone.
      */}
      <div className="flex items-center gap-3">
        <div className="relative flex size-[152px] shrink-0 items-center justify-center">
          <div
            className="pointer-events-none absolute inset-[-14px]"
            style={{
              background:
                'radial-gradient(60% 55% at 50% 46%, rgba(46,74,120,0.30) 0%, transparent 70%)',
            }}
          />


          <div className="absolute size-[132px] rounded-full border border-line-soft/50" />
          <div className="absolute size-[132px] motion-safe:animate-[spin_84s_linear_infinite]">
            {orbitals.map((type, i) => {
              const angle = (i / Math.max(1, orbitals.length)) * 360;
              return (
                <img
                  key={type}
                  src={SATELLITE_ART[type]}
                  alt={type.toLowerCase()}
                  title={type.toLowerCase()}
                  className="absolute left-1/2 top-1/2 size-8 object-contain drop-shadow-[0_0_6px_rgba(111,211,224,0.35)]"
                  style={{
                    transform: `rotate(${String(angle)}deg) translate(66px) rotate(${String(-angle)}deg) translate(-50%, -50%)`,
                  }}
                />
              );
            })}
          </div>

          <PlanetSigil seed={planet.planet.id} size={100} shielded={planet.planet.shield > 0} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[20px] uppercase leading-tight tracking-[0.06em] text-bone">
            {planet.planet.name}
          </h1>
          <div className="frame mt-2 px-3 py-2">
            <p className="legend">Power</p>
            <p className="readout mt-1 text-[24px] text-bone">{full(powerOf(planet))}</p>
          </div>
          <div className="mt-2 flex gap-3">
            <Rate art={RESOURCE_ART.alloy} value={planet.planet.alloyPerHour} tone="text-alloy" />
            <Rate
              art={RESOURCE_ART.crystal}
              value={planet.planet.crystalPerHour}
              tone="text-crystal"
            />
          </div>
        </div>
      </div>

      {disruptedFor > 0 && <Disrupted ms={disruptedFor} />}
      <Verdicts planet={planet} ground={ground} home={home} exposed={exposed} />
    </div>
  );
}

/**
 * POWER and output.
 *
 * Power is everything this planet is worth — buildings, satellites, ships and
 * stock. It answers "am I getting stronger", and without it a player has no way to
 * feel a season of investment.
 */
function Readouts({ planet }: { planet: PlanetView }) {
  return (
    <div className="mt-2 flex items-stretch gap-2">
      <div className="frame flex-1 px-3.5 py-2.5">
        <p className="legend">Power</p>
        <p className="readout mt-1.5 text-[26px] text-bone">{full(powerOf(planet))}</p>
      </div>
      <div className="frame w-[142px] px-3.5 py-2.5">
        <p className="legend">Per hour</p>
        <div className="mt-1.5 space-y-1">
          <Rate art={RESOURCE_ART.alloy} value={planet.planet.alloyPerHour} tone="text-alloy" />
          <Rate
            art={RESOURCE_ART.crystal}
            value={planet.planet.crystalPerHour}
            tone="text-crystal"
          />
        </div>
      </div>
    </div>
  );
}

function Disrupted({ ms }: { ms: number }) {
  return (
    <p className="num mt-2.5 rounded border border-threat/40 bg-threat/10 px-3 py-2 text-center text-[12px] text-[#ff9d8f]">
      Production stopped · raided · {countdown(ms)}
    </p>
  );
}

function Verdicts({
  planet,
  ground,
  home,
  exposed,
}: {
  planet: PlanetView;
  ground: number;
  home: number;
  exposed: number;
}) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <Verdict
        label="Defence"
        value={ground === 0 ? 'None' : ground < 5 ? 'Thin' : 'Held'}
        detail={ground === 0 ? `${String(home)} ships only` : `${String(ground)} on the ground`}
        tone={ground === 0 ? 'bad' : ground < 5 ? 'warn' : 'good'}
      />
      <Verdict
        label="Shield"
        value={planet.planet.shield > 0 ? compact(planet.planet.shield) : 'None'}
        detail={planet.planet.shield > 0 ? 'absorbs first' : 'no aegis'}
        tone={planet.planet.shield > 0 ? 'good' : 'neutral'}
      />
      <Verdict
        label="At risk"
        value={compact(exposed)}
        detail={`${compact(planet.planet.vaultFloor)} safe`}
        tone={exposed > planet.planet.vaultFloor * 3 ? 'warn' : 'neutral'}
      />
    </div>
  );
}

function Rate({ art, value, tone }: { art: string; value: number; tone: string }) {
  return (
    <p className={`num flex items-center gap-1.5 text-[14px] ${tone}`}>
      <img src={art} alt="" aria-hidden className="size-4 object-contain" />
      {compact(value)}
      <span className="text-[10px] text-faint">/h</span>
    </p>
  );
}

const TONE = {
  bad: 'text-[#ff9d8f]',
  warn: 'text-alloy',
  good: 'text-opportunity',
  neutral: 'text-dim',
} as const;

function Verdict({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: keyof typeof TONE;
}) {
  return (
    <div className="frame px-2.5 py-2">
      <p className="legend">{label}</p>
      <p className={`readout mt-1.5 text-[17px] ${TONE[tone]}`}>{value}</p>
      <p className="num mt-1 text-[10px] text-faint">{detail}</p>
    </div>
  );
}
