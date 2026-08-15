import { useState } from 'react';
import {
  HULLS,
  fleetCount,
  fleetEntries,
  satelliteEntries,
  upgradeCost,
  type HullId,
} from '@blindspace/rules';
import { usePlanet, useBuild, useInstallSatellite, useUpgrade } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { useProjectedResources } from '../lib/projection.js';
import {
  BUILDING_NAME,
  BUILDING_ORDER,
  BUILDING_ROLE,
  HULL_ORDER,
  HULL_ROLE,
  SATELLITE_NAME,
  SATELLITE_ORDER,
  SATELLITE_ROLE,
  SATELLITE_UNAVAILABLE,
} from '../lib/vocabulary.js';
import { Note, Panel, Row, Section } from '../ui/primitives.js';
import { PlanetSigil } from '../ui/PlanetSigil.js';
import { Sheet } from '../ui/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';

export function PlanetScreen() {
  const { data, dataUpdatedAt, isPending } = usePlanet();
  const held = useProjectedResources(data?.planet, dataUpdatedAt, 5000);
  const [building, setBuilding] = useState<HullId | null>(null);

  if (isPending || !data) return <Loading />;

  const afford = (alloy: number, crystal: number): boolean =>
    held.alloy >= alloy && held.crystal >= crystal;

  return (
    <div className="px-4 pt-4">
      <Hero planet={data.planet} satellites={data.satellites} />
      <Garrison fleet={data.fleet} ground={data.ground} />
      <Works planet={data} afford={afford} />
      <Orbit planet={data} afford={afford} />
      <Shipyard planet={data} afford={afford} onBuild={setBuilding} />

      {building && (
        <BuildSheet
          hull={building}
          planet={data}
          held={held}
          onClose={() => {
            setBuilding(null);
          }}
        />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="px-4 pt-16 text-center">
      <p className="legend animate-pulse">Reading planet</p>
    </div>
  );
}

/* ── the planet itself ──────────────────────────────────────── */

function Hero({
  planet,
  satellites,
}: {
  planet: PlanetView['planet'];
  satellites: PlanetView['satellites'];
}) {
  const now = useNow(1000);
  const disruptedFor = planet.disruptedUntil
    ? planet.disruptedUntil.getTime() - now
    : 0;
  const aegis = satellites.AEGIS ?? 0;

  return (
    <div className="mb-6 flex items-center gap-4">
      <PlanetSigil seed={planet.id} size={104} shielded={planet.shield > 0} />
      <div className="min-w-0 flex-1">
        <p className="legend">Your planet</p>
        <h1 className="font-display text-[27px] leading-tight tracking-wide text-bone">
          {planet.name}
        </h1>
        <p className="num mt-1 text-[11px] text-faint">
          {planet.position.x.toFixed(0)} · {planet.position.y.toFixed(0)} ·{' '}
          {planet.position.z.toFixed(0)}
        </p>
        {aegis > 0 && (
          <p className="num mt-2 text-[12px] text-crystal">Shield {full(planet.shield)}</p>
        )}
        {disruptedFor > 0 && (
          <p className="num mt-2 text-[12px] text-alert">
            Surface works offline · {countdown(disruptedFor)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── garrison ───────────────────────────────────────────────── */

function Garrison({ fleet, ground }: { fleet: PlanetView['fleet']; ground: PlanetView['ground'] }) {
  const home = fleetCount(fleet) + fleetCount(ground);
  const entries = [...fleetEntries(fleet), ...fleetEntries(ground)];

  return (
    <Section label="Garrison" aside={`${String(home)} units home`}>
      <Panel>
        {entries.length === 0 ? (
          <p className="text-[13px] text-dim">
            Nothing is defending this planet. Anything that arrives takes what it likes.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {entries.map(([hull, count]) => (
              <li key={hull} className="flex items-baseline gap-1.5">
                <span className="num text-[17px] text-bone">{String(count)}</span>
                <span className="legend text-[10px]">{HULLS[hull].name}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  );
}

/* ── works ──────────────────────────────────────────────────── */

interface CostProps {
  alloy: number;
  crystal: number;
  affordable: boolean;
}

function Cost({ alloy, crystal, affordable }: CostProps) {
  return (
    <span className={`num text-[12px] ${affordable ? '' : 'opacity-45'}`}>
      <span className="text-alloy">{compact(alloy)}</span>
      {crystal > 0 && (
        <>
          {' · '}
          <span className="text-crystal">{compact(crystal)}</span>
        </>
      )}
    </span>
  );
}

function Works({
  planet,
  afford,
}: {
  planet: PlanetView;
  afford: (alloy: number, crystal: number) => boolean;
}) {
  const upgrade = useUpgrade();
  const say = useToast();
  const core = planet.buildings.CORE ?? 0;

  return (
    <Section label="Works" aside={`Core L${String(core)}`}>
      <Panel className="py-1">
        {BUILDING_ORDER.map((id) => {
          const level = planet.buildings[id] ?? 0;
          const cost = planet.nextCosts[id] ?? upgradeCost(level);
          const capped = id !== 'CORE' && level >= core;
          const affordable = afford(cost.alloy, cost.crystal);

          return (
            <Row
              key={id}
              label={
                <span>
                  {BUILDING_NAME[id]} <span className="num text-dim">L{String(level)}</span>
                </span>
              }
              detail={capped ? 'Raise the Command Core first' : BUILDING_ROLE[id]}
              value={<Cost alloy={cost.alloy} crystal={cost.crystal} affordable={affordable} />}
              action={
                <button
                  type="button"
                  className="btn"
                  disabled={capped || !affordable || upgrade.isPending}
                  onClick={() => {
                    upgrade.mutate(id, {
                      onSuccess: (r) => {
                        say(`${BUILDING_NAME[id]} is now L${String(r.level)}`);
                      },
                      onError: (err) => {
                        say(describe(err), 'error');
                      },
                    });
                  }}
                >
                  Raise
                </button>
              }
            />
          );
        })}
      </Panel>
    </Section>
  );
}

/* ── orbit ──────────────────────────────────────────────────── */

function Orbit({
  planet,
  afford,
}: {
  planet: PlanetView;
  afford: (alloy: number, crystal: number) => boolean;
}) {
  const install = useInstallSatellite();
  const say = useToast();
  const core = planet.buildings.CORE ?? 0;
  const owned = satelliteEntries(planet.satellites).length;
  const free = planet.satelliteSlots - owned;

  return (
    <Section label="Orbit" aside={`${String(owned)}/${String(planet.satelliteSlots)} slots`}>
      <Panel className="py-1">
        {SATELLITE_ORDER.map((id) => {
          const level = planet.satellites[id] ?? 0;
          const cost = upgradeCost(level);
          const unavailable = SATELLITE_UNAVAILABLE[id];
          const noSlot = level === 0 && free <= 0;
          const capped = level >= core;
          const affordable = afford(cost.alloy, cost.crystal);
          const blocked = Boolean(unavailable) || noSlot || capped || !affordable;

          return (
            <Row
              key={id}
              label={
                <span>
                  {SATELLITE_NAME[id]}{' '}
                  {level > 0 && <span className="num text-dim">L{String(level)}</span>}
                </span>
              }
              detail={
                unavailable ??
                (noSlot
                  ? 'No free slot — raise the Orbital Ring'
                  : capped
                    ? 'Raise the Command Core first'
                    : SATELLITE_ROLE[id])
              }
              value={<Cost alloy={cost.alloy} crystal={cost.crystal} affordable={affordable} />}
              action={
                <button
                  type="button"
                  className="btn"
                  disabled={blocked || install.isPending}
                  onClick={() => {
                    install.mutate(id, {
                      onSuccess: (r) => {
                        say(`${SATELLITE_NAME[id]} online at L${String(r.level)}`);
                      },
                      onError: (err) => {
                        say(describe(err), 'error');
                      },
                    });
                  }}
                >
                  {level === 0 ? 'Install' : 'Raise'}
                </button>
              }
            />
          );
        })}
      </Panel>
      <Note>
        Five types, and the Ring will never give you five slots. What you leave out is who you
        are for the season.
      </Note>
    </Section>
  );
}

/* ── shipyard ───────────────────────────────────────────────── */

function Shipyard({
  planet,
  afford,
  onBuild,
}: {
  planet: PlanetView;
  afford: (alloy: number, crystal: number) => boolean;
  onBuild: (hull: HullId) => void;
}) {
  const shipyard = planet.buildings.SHIPYARD ?? 0;

  return (
    <Section label="Shipyard" aside={`L${String(shipyard)}`}>
      <Panel className="py-1">
        {HULL_ORDER.map((id) => {
          const spec = HULLS[id];
          const locked = shipyard < spec.minShipyard;
          const affordable = afford(spec.alloy, spec.crystal);

          return (
            <Row
              key={id}
              label={spec.name}
              detail={locked ? `Needs Shipyard L${String(spec.minShipyard)}` : HULL_ROLE[id]}
              value={<Cost alloy={spec.alloy} crystal={spec.crystal} affordable={affordable} />}
              action={
                <button
                  type="button"
                  className="btn"
                  disabled={locked || !affordable}
                  onClick={() => {
                    onBuild(id);
                  }}
                >
                  Build
                </button>
              }
            />
          );
        })}
      </Panel>
      <Note>Construction is instant. There are no timers in this game, anywhere.</Note>
    </Section>
  );
}

function BuildSheet({
  hull,
  planet,
  held,
  onClose,
}: {
  hull: HullId;
  planet: PlanetView;
  held: { alloy: number; crystal: number };
  onClose: () => void;
}) {
  const spec = HULLS[hull];
  const build = useBuild();
  const say = useToast();

  const ceiling = Math.max(
    1,
    Math.min(
      Math.floor(held.alloy / spec.alloy),
      spec.crystal > 0 ? Math.floor(held.crystal / spec.crystal) : Number.MAX_SAFE_INTEGER,
    ),
  );
  const [count, setCount] = useState(1);
  const clamped = Math.min(count, ceiling);
  const totalAlloy = spec.alloy * clamped;
  const totalCrystal = spec.crystal * clamped;
  const defenceNow = fleetCount(planet.fleet) + fleetCount(planet.ground);

  return (
    <Sheet
      eyebrow={spec.ground ? 'Ground defence' : 'Mobile hull'}
      title={spec.name}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn w-full"
          disabled={build.isPending || clamped < 1}
          onClick={() => {
            build.mutate(
              { hull, count: clamped },
              {
                onSuccess: () => {
                  say(`${String(clamped)} × ${spec.name} built`);
                  onClose();
                },
                onError: (err) => {
                  say(describe(err), 'error');
                },
              },
            );
          }}
        >
          Build {clamped} · {full(totalAlloy)} alloy
          {totalCrystal > 0 && ` · ${full(totalCrystal)} crystal`}
        </button>
      }
    >
      <p className="text-[13px] text-dim">{HULL_ROLE[hull]}</p>

      <dl className="mt-4 grid grid-cols-4 gap-3">
        {[
          ['Attack', String(spec.atk)],
          ['Hull', String(spec.hp)],
          ['Speed', spec.speed > 0 ? String(spec.speed) : '—'],
          ['Cargo', spec.cargo > 0 ? String(spec.cargo) : '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="legend">{label}</dt>
            <dd className="num mt-0.5 text-[16px] text-bone">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <p className="legend mb-2">How many</p>
        <div className="flex items-center gap-2">
          {[1, 5, 25, ceiling].map((n, i) => (
            <button
              key={`${String(n)}-${String(i)}`}
              type="button"
              className={`btn flex-1 ${clamped === n ? 'border-crystal/60 text-crystal' : ''}`}
              onClick={() => {
                setCount(n);
              }}
            >
              {i === 3 ? `Max ${String(n)}` : String(n)}
            </button>
          ))}
        </div>
      </div>

      <p className="num mt-5 text-[12px] text-faint">
        Home defence after building: {String(defenceNow + clamped)} units
      </p>
    </Sheet>
  );
}
