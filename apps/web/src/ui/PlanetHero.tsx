import { fleetCount, satelliteEntries } from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { powerOf } from '../lib/gains.js';
import { countdown, useNow } from '../lib/time.js';
import { BUILDING_ART, ORBITAL_ART, RESOURCE_ART } from './assets.js';
import { PlanetSigil } from './PlanetSigil.js';

/**
 * "This is MY planet."
 *
 * The ownership pillar is carried by an image, not a heading. The planet is the
 * largest object in the interface; the Orbital Ring is physically around it; the
 * satellites orbit it; the shield encloses it. A player who buys a Ring should see
 * a ring, and that is the entire feedback loop for a screen full of purchases.
 *
 * Underneath: POWER and output, then three verdicts. "None" is a verdict. "0
 * ground units" is a number the player still has to interpret.
 */
export function PlanetHero({ planet }: { planet: PlanetView }) {
  const now = useNow(1000);
  const orbitals = satelliteEntries(planet.satellites);
  const disruptedFor = planet.planet.disruptedUntil
    ? planet.planet.disruptedUntil.getTime() - now
    : 0;

  const ground = fleetCount(planet.ground);
  const home = fleetCount(planet.fleet);
  const exposed = Math.max(
    0,
    planet.planet.alloy + planet.planet.crystal - planet.planet.vaultFloor,
  );
  const ring = planet.buildings.RING ?? 0;

  return (
    <div className="mb-5">
      <div className="relative flex h-[204px] items-center justify-center">
        {/* Depth, in two layers: a far glow and a near vignette. */}
        <div
          className="pointer-events-none absolute inset-x-[-16px] inset-y-[-24px]"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 46%, rgba(46,74,120,0.30) 0%, transparent 70%)',
          }}
        />

        {/* The Ring is real hardware in this game, so it is drawn as hardware. */}
        {ring > 0 && BUILDING_ART.RING && (
          <img
            src={BUILDING_ART.RING}
            alt=""
            aria-hidden
            className="pointer-events-none absolute w-[250px] opacity-90"
            style={{ transform: 'translateY(6px)' }}
          />
        )}

        <div className="absolute size-[176px] rounded-full border border-line-soft/50" />
        <div className="absolute size-[176px] motion-safe:animate-[spin_84s_linear_infinite]">
          {orbitals.map(([type], i) => {
            const angle = (i / Math.max(1, orbitals.length)) * 360;
            return (
              <img
                key={type}
                src={ORBITAL_ART[type]}
                alt={type.toLowerCase()}
                title={type.toLowerCase()}
                className="absolute left-1/2 top-1/2 size-10 object-contain drop-shadow-[0_0_6px_rgba(111,211,224,0.35)]"
                style={{
                  transform: `rotate(${String(angle)}deg) translate(88px) rotate(${String(-angle)}deg) translate(-50%, -50%)`,
                }}
              />
            );
          })}
        </div>

        <PlanetSigil seed={planet.planet.id} size={132} shielded={planet.planet.shield > 0} />
      </div>

      <div className="mt-1 text-center">
        <h1 className="font-display text-[27px] uppercase leading-none tracking-[0.07em] text-bone">
          {planet.planet.name}
        </h1>
      </div>

      {/*
        POWER and output, side by side.

        Power is everything this planet is worth — buildings, satellites, ships and
        stock. It is the number that answers "am I getting stronger", and without it
        a player has no way to feel a season's worth of investment.
      */}
      <div className="mt-3.5 flex items-stretch gap-2">
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

      {disruptedFor > 0 && (
        <p className="num mt-2.5 rounded border border-threat/40 bg-threat/10 px-3 py-2 text-center text-[12px] text-[#ff9d8f]">
          Production stopped · raided · {countdown(disruptedFor)}
        </p>
      )}

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
