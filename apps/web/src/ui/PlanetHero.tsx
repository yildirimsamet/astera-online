import { fleetCount, satelliteEntries } from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { ORBITAL_ART } from './assets.js';
import { PlanetSigil } from './PlanetSigil.js';

/**
 * "This is MY planet."
 *
 * The ownership pillar has to be carried by an image, not a heading. The planet is
 * the largest object in the interface, its installed satellites physically orbit
 * it, and its shield is drawn around it — so the player watches their planet
 * change as they invest in it, rather than reading that a number went up.
 *
 * Underneath it: three verdicts, not three statistics. "NONE" is a verdict.
 * "0 ground units" is a number the player has to interpret first.
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
  const output = planet.planet.alloyPerHour + planet.planet.crystalPerHour;

  return (
    <div className="mb-5">
      <div className="relative flex h-[158px] items-center justify-center">
        {/* The orbit the satellites ride. Drawn, so the ring is a place. */}
        <div className="absolute size-[150px] rounded-full border border-line-soft/70" />
        <div
          className="absolute size-[150px] motion-safe:animate-[spin_72s_linear_infinite]"
          style={{ transformOrigin: '50% 50%' }}
        >
          {orbitals.map(([type], i) => {
            const angle = (i / Math.max(1, orbitals.length)) * 360;
            return (
              <img
                key={type}
                src={ORBITAL_ART[type]}
                alt={type.toLowerCase()}
                title={type.toLowerCase()}
                className="absolute left-1/2 top-1/2 size-9 object-contain"
                style={{
                  transform: `rotate(${String(angle)}deg) translate(75px) rotate(${String(-angle)}deg) translate(-50%, -50%)`,
                }}
              />
            );
          })}
        </div>

        <PlanetSigil seed={planet.planet.id} size={118} shielded={planet.planet.shield > 0} />

        {planet.planet.shield > 0 && (
          <span className="num absolute bottom-1 rounded-full border border-crystal/40 bg-void/80 px-2 py-0.5 text-[10px] text-crystal">
            shield {compact(planet.planet.shield)}
          </span>
        )}
      </div>

      <div className="mt-1 text-center">
        <h1 className="font-display text-[26px] uppercase leading-none tracking-[0.06em] text-bone">
          {planet.planet.name}
        </h1>
        <p className="num mt-1.5 text-[11px] text-faint">
          {orbitals.length}/{planet.satelliteSlots} orbital slots · core L
          {planet.buildings.CORE ?? 0}
        </p>
      </div>

      {disruptedFor > 0 && (
        <p className="num mt-3 rounded border border-threat/40 bg-threat/10 px-3 py-2 text-center text-[12px] text-[#ff9d8f]">
          Surface works offline · nothing is being produced · {countdown(disruptedFor)}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Verdict
          label="Defence"
          value={ground === 0 ? 'None' : ground < 5 ? 'Thin' : 'Held'}
          detail={ground === 0 ? `${String(home)} ships only` : `${String(ground)} on the ground`}
          tone={ground === 0 ? 'bad' : ground < 5 ? 'warn' : 'good'}
        />
        <Verdict
          label="Output"
          value={disruptedFor > 0 ? 'Offline' : `${compact(output)}/h`}
          detail={disruptedFor > 0 ? 'raided' : 'alloy + crystal'}
          tone={disruptedFor > 0 ? 'bad' : 'good'}
        />
        <Verdict
          label="At risk"
          value={full(exposed)}
          detail={`${compact(planet.planet.vaultFloor)} safe`}
          tone={exposed > planet.planet.vaultFloor * 3 ? 'warn' : 'neutral'}
        />
      </div>
    </div>
  );
}

const TONE = {
  bad: 'text-[#ff9d8f]',
  warn: 'text-alloy',
  good: 'text-opportunity',
  neutral: 'text-bone',
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
    <div className="panel px-2.5 py-2">
      <p className="legend">{label}</p>
      <p className={`num mt-1 text-[17px] leading-none ${TONE[tone]}`}>{value}</p>
      <p className="num mt-1 text-[10px] text-faint">{detail}</p>
    </div>
  );
}
