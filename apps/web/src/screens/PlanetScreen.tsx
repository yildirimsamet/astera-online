import { useEffect, useState } from 'react';
import {
  HULLS,
  fleetCount,
  satelliteEntries,
  upgradeCost,
  type BuildingId,
  type HullId,
  type SatelliteId,
} from '@blindspace/rules';
import { usePlanet, useBuild, useInstallSatellite, useUpgrade } from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { full } from '../lib/format.js';
import type { PlanetGroup } from '../lib/directives.js';
import { buildingGain, satelliteGain } from '../lib/gains.js';
import { useProjectedResources } from '../lib/projection.js';
import { BUILDING_ART, HULL_ART, satelliteArt } from '../ui/assets.js';
import { BastionMark, CoreMark, RingMark, ShipyardMark, VaultMark } from '../ui/marks.js';
import { PlanetHero } from '../ui/PlanetHero.js';
import { DecisionGroup, UpgradeRow, type Blocked } from '../ui/UpgradeRow.js';
import { describe, useToast } from '../ui/Toast.js';
import { Sheet } from '../ui/Sheet.js';

/**
 * MY PLANET.
 *
 * The first version of this screen was three lists named after the code that
 * produced them — Works, Orbit, Shipyard — each a column of identical rows with
 * identical buttons. It answered "what exists". It never answered "what should I
 * do, and why", which is the only question a player actually has.
 *
 * This version groups every decision by the PROBLEM it solves, orders those groups
 * by what currently matters, and states what each purchase changes in numbers. The
 * section headings are questions on purpose: a player scanning the screen should
 * find the heading that matches the worry they arrived with.
 */

type GroupId = PlanetGroup;

const GROUPS: Record<GroupId, { problem: string; question: string }> = {
  defend: { problem: 'Defend', question: 'What survives if someone lands here?' },
  see: { problem: 'See', question: 'What can you find out — and who can see you?' },
  reach: { problem: 'Reach', question: 'What can you send, and how far?' },
  grow: { problem: 'Grow', question: 'How fast does everything else arrive?' },
};

export function PlanetScreen({ focusGroup }: { focusGroup?: GroupId }) {
  const { data, dataUpdatedAt, isPending } = usePlanet();
  const held = useProjectedResources(data?.planet, dataUpdatedAt, 5000);
  const [building, setBuilding] = useState<HullId | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  // Sending the player to the thing that is blocking them is only useful if they
  // can see it when they arrive.
  useEffect(() => {
    if (!focused) return;
    document.getElementById(`row-${focused}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const id = setTimeout(() => {
      setFocused(null);
    }, 2600);
    return () => {
      clearTimeout(id);
    };
  }, [focused]);

  if (isPending || !data) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="legend animate-pulse">Reading planet</p>
      </div>
    );
  }

  const order = groupOrder(data, focusGroup);

  return (
    <div className="px-4 pt-4">
      <PlanetHero planet={data} />

      {order.map((id) => (
        <DecisionGroup key={id} problem={GROUPS[id].problem} question={GROUPS[id].question}>
          {id === 'defend' && (
            <Defend planet={data} held={held} focused={focused} onNeed={setFocused} onBuild={setBuilding} />
          )}
          {id === 'see' && <See planet={data} held={held} focused={focused} onNeed={setFocused} />}
          {id === 'reach' && (
            <Reach planet={data} held={held} focused={focused} onNeed={setFocused} onBuild={setBuilding} />
          )}
          {id === 'grow' && <Grow planet={data} held={held} focused={focused} />}
        </DecisionGroup>
      ))}

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

/**
 * Which worry comes first.
 *
 * A planet with no ground defence and a full vault has a different most-important
 * screen than one that cannot see anybody. Fixed section order would be right for
 * exactly one of them.
 */
function groupOrder(planet: PlanetView, focus?: GroupId): GroupId[] {
  const score: Record<GroupId, number> = { defend: 0, see: 0, reach: 0, grow: 10 };

  const exposed = Math.max(0, planet.planet.alloy + planet.planet.crystal - planet.planet.vaultFloor);
  if (fleetCount(planet.ground) === 0) score.defend += 60;
  if (exposed > planet.planet.vaultFloor * 3) score.defend += 40;
  if ((planet.satellites.TELESCOPE ?? 0) === 0) score.see += 55;
  if ((planet.satellites.RADAR ?? 0) === 0) score.see += 25;
  if (fleetCount(planet.fleet) === 0) score.reach += 45;
  if ((planet.buildings.SHIPYARD ?? 0) === 0) score.reach += 15;

  const ids: GroupId[] = ['defend', 'see', 'reach', 'grow'];
  const sorted = ids.sort((a, b) => score[b] - score[a]);
  if (!focus) return sorted;
  return [focus, ...sorted.filter((id) => id !== focus)];
}

/* ── shared plumbing ────────────────────────────────────────── */

interface GroupProps {
  planet: PlanetView;
  held: { alloy: number; crystal: number };
  focused: string | null;
  onNeed: (id: string) => void;
}

const cappedCount = (planet: PlanetView): number =>
  (['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'RING'] as const).filter(
    (id) => (planet.buildings[id] ?? 0) >= (planet.buildings.CORE ?? 0),
  ).length;

function useBuildingAction(planet: PlanetView) {
  const upgrade = useUpgrade();
  const say = useToast();
  const core = planet.buildings.CORE ?? 0;

  return (id: BuildingId, name: string, onNeed: (row: string) => void) => {
    const level = planet.buildings[id] ?? 0;
    const cost = planet.nextCosts[id] ?? upgradeCost(level);
    const blocked: Blocked | undefined =
      id !== 'CORE' && level >= core
        ? { reason: `Core L${String(core + 1)}`, onFix: () => { onNeed('CORE'); } }
        : undefined;

    return {
      level,
      cost,
      blocked,
      pending: upgrade.isPending,
      act: () => {
        upgrade.mutate(id, {
          onSuccess: (r) => {
            say(`${name} is now L${String(r.level)}`);
          },
          onError: (err) => {
            say(describe(err), 'error');
          },
        });
      },
    };
  };
}

function useSatelliteAction(planet: PlanetView) {
  const install = useInstallSatellite();
  const say = useToast();
  const core = planet.buildings.CORE ?? 0;
  const owned = satelliteEntries(planet.satellites).length;
  const free = planet.satelliteSlots - owned;

  return (id: SatelliteId, name: string, onNeed: (row: string) => void) => {
    const level = planet.satellites[id] ?? 0;
    const cost = upgradeCost(level);

    const blocked: Blocked | undefined =
      id === 'DRILL'
        ? { reason: 'Not built yet' }
        : level === 0 && free <= 0
          ? { reason: 'Needs a slot', onFix: () => { onNeed('RING'); } }
          : level >= core
            ? { reason: `Core L${String(core + 1)}`, onFix: () => { onNeed('CORE'); } }
            : undefined;

    return {
      level,
      cost,
      blocked,
      pending: install.isPending,
      act: () => {
        install.mutate(id, {
          onSuccess: (r) => {
            say(`${name} online at L${String(r.level)}`);
          },
          onError: (err) => {
            say(describe(err), 'error');
          },
        });
      },
    };
  };
}

/* ── the four groups ────────────────────────────────────────── */

function Defend({
  planet,
  held,
  focused,
  onNeed,
  onBuild,
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const building = useBuildingAction(planet);
  const satellite = useSatelliteAction(planet);
  const vault = building('VAULT', 'Vault', onNeed);
  const aegis = satellite('AEGIS', 'Aegis', onNeed);
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const bastion = HULLS.BASTION;
  const ground = fleetCount(planet.ground);

  return (
    <>
      <div id="row-VAULT">
        <UpgradeRow
          mark={<VaultMark />}
          name="Vault"
          level={vault.level}
          role="The only stock a raid cannot touch. Everything above it is takeable."
          gain={buildingGain('VAULT', vault.level, cappedCount(planet))}
          cost={vault.cost}
          held={held}
          {...(vault.blocked ? { blocked: vault.blocked } : {})}
          actionLabel="Raise"
          onAct={vault.act}
          pending={vault.pending}
          highlighted={focused === 'VAULT'}
        />
      </div>

      <UpgradeRow
        art={satelliteArt('AEGIS', Math.max(1, aegis.level))}
        name="Aegis"
        level={aegis.level}
        role="Soaks the first damage of a raid, then regrows on its own."
        gain={satelliteGain('AEGIS', aegis.level)}
        cost={aegis.cost}
        held={held}
        {...(aegis.blocked ? { blocked: aegis.blocked } : {})}
        actionLabel={aegis.level === 0 ? 'Install' : 'Raise'}
        onAct={aegis.act}
        pending={aegis.pending}
      />

      <UpgradeRow
        mark={<BastionMark />}
        name="Bastion"
        role={
          ground === 0
            ? 'You have none. Anything that arrives takes what it likes.'
            : `${String(ground)} standing. 60% of any losses rebuild free from wreckage.`
        }
        gain={{ label: 'Ground units', now: String(ground), next: String(ground + 1) }}
        cost={{ alloy: bastion.alloy, crystal: bastion.crystal }}
        held={held}
        {...(shipyard < bastion.minShipyard
          ? {
              blocked: {
                reason: `Shipyard L${String(bastion.minShipyard)}`,
                onFix: () => { onNeed('SHIPYARD'); },
              } satisfies Blocked,
            }
          : {})}
        actionLabel="Build"
        onAct={() => { onBuild('BASTION'); }}
      />
    </>
  );
}

function See({ planet, held, focused, onNeed }: GroupProps) {
  const satellite = useSatelliteAction(planet);
  const telescope = satellite('TELESCOPE', 'Telescope', onNeed);
  const radar = satellite('RADAR', 'Radar', onNeed);
  const veil = satellite('VEIL', 'Veil', onNeed);

  return (
    <>
      <UpgradeRow
        art={satelliteArt('TELESCOPE', Math.max(1, telescope.level))}
        name="Telescope"
        level={telescope.level}
        role={
          telescope.level === 0
            ? 'You cannot tell whether anyone’s fleet is home.'
            : 'Tells you the moment a watched fleet leaves. They are never told.'
        }
        gain={satelliteGain('TELESCOPE', telescope.level)}
        cost={telescope.cost}
        held={held}
        {...(telescope.blocked ? { blocked: telescope.blocked } : {})}
        actionLabel={telescope.level === 0 ? 'Install' : 'Raise'}
        onAct={telescope.act}
        pending={telescope.pending}
        highlighted={focused === 'TELESCOPE'}
      />

      <UpgradeRow
        art={satelliteArt('RADAR', Math.max(1, radar.level))}
        name="Radar"
        level={radar.level}
        role={
          radar.level === 0
            ? 'A fleet can land here with no warning, and probes go unnoticed.'
            : 'Catches probes, and buys you minutes before a fleet lands.'
        }
        gain={satelliteGain('RADAR', radar.level)}
        cost={radar.cost}
        held={held}
        {...(radar.blocked ? { blocked: radar.blocked } : {})}
        actionLabel={radar.level === 0 ? 'Install' : 'Raise'}
        onAct={radar.act}
        pending={radar.pending}
        highlighted={focused === 'RADAR'}
      />

      <UpgradeRow
        art={satelliteArt('VEIL', Math.max(1, veil.level))}
        name="Veil"
        level={veil.level}
        role="Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies."
        gain={satelliteGain('VEIL', veil.level)}
        cost={veil.cost}
        held={held}
        {...(veil.blocked ? { blocked: veil.blocked } : {})}
        actionLabel={veil.level === 0 ? 'Install' : 'Raise'}
        onAct={veil.act}
        pending={veil.pending}
      />
    </>
  );
}

function Reach({
  planet,
  held,
  focused,
  onNeed,
  onBuild,
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const building = useBuildingAction(planet);
  const shipyard = building('SHIPYARD', 'Shipyard', onNeed);
  const level = planet.buildings.SHIPYARD ?? 0;

  return (
    <>
      <div id="row-SHIPYARD">
        <UpgradeRow
          mark={<ShipyardMark />}
          name="Shipyard"
          level={shipyard.level}
          role="Unlocks heavier hulls, and sharpens every probe you send."
          gain={buildingGain('SHIPYARD', shipyard.level, cappedCount(planet))}
          cost={shipyard.cost}
          held={held}
          {...(shipyard.blocked ? { blocked: shipyard.blocked } : {})}
          actionLabel="Raise"
          onAct={shipyard.act}
          pending={shipyard.pending}
          highlighted={focused === 'SHIPYARD'}
        />
      </div>

      {(['WASP', 'LANCE', 'BULWARK', 'HAULER'] as const).map((id) => {
        const spec = HULLS[id];
        const owned = planet.fleet[id] ?? 0;
        return (
          <UpgradeRow
            key={id}
            art={HULL_ART[id]}
            name={spec.name}
            role={HULL_PITCH[id]}
            gain={{ label: 'You have', now: String(owned), next: String(owned + 1) }}
            cost={{ alloy: spec.alloy, crystal: spec.crystal }}
            held={held}
            {...(level < spec.minShipyard
              ? {
                  blocked: {
                    reason: `Shipyard L${String(spec.minShipyard)}`,
                    onFix: () => { onNeed('SHIPYARD'); },
                  } satisfies Blocked,
                }
              : {})}
            actionLabel="Build"
            onAct={() => { onBuild(id); }}
          />
        );
      })}
    </>
  );
}

/** What each hull is *for*, in the terms the decision is actually made in. */
const HULL_PITCH: Record<HullId, string> = {
  WASP: 'Cheapest damage, fastest home. The shortest time spent undefended.',
  LANCE: 'Hits hardest. Shreds Wasps, bounces off Bulwarks.',
  BULWARK: 'Survives what kills everything else. Nearly doubles your time away.',
  HAULER: 'Carries the loot home. Useless in the fight — escort it or lose it.',
  BASTION: 'Never leaves the planet. The cheapest hit points you can own.',
};

function Grow({ planet, held, focused }: Omit<GroupProps, 'onNeed'>) {
  const noop = () => undefined;
  const building = useBuildingAction(planet);
  const core = building('CORE', 'Command Core', noop);
  const refinery = building('REFINERY', 'Alloy Refinery', noop);
  const extractor = building('EXTRACTOR', 'Crystal Extractor', noop);
  const ring = building('RING', 'Orbital Ring', noop);
  const capped = cappedCount(planet);

  return (
    <>
      <div id="row-CORE">
        <UpgradeRow
          mark={<CoreMark />}
          name="Command Core"
          level={core.level}
          role={
            capped > 0
              ? `${String(capped)} things are stuck at the ceiling until this goes up.`
              : 'Nothing may exceed the Core. It is the ceiling for everything.'
          }
          gain={buildingGain('CORE', core.level, capped)}
          cost={core.cost}
          held={held}
          actionLabel="Raise"
          onAct={core.act}
          pending={core.pending}
          highlighted={focused === 'CORE'}
        />
      </div>

      <UpgradeRow
        art={BUILDING_ART.REFINERY}
        name="Alloy Refinery"
        level={refinery.level}
        role="Everything you build waits on this number."
        gain={buildingGain('REFINERY', refinery.level, capped)}
        cost={refinery.cost}
        held={held}
        {...(refinery.blocked ? { blocked: refinery.blocked } : {})}
        actionLabel="Raise"
        onAct={refinery.act}
        pending={refinery.pending}
      />

      <UpgradeRow
        art={BUILDING_ART.EXTRACTOR}
        name="Crystal Extractor"
        level={extractor.level}
        role="Scarce. Gates the heavy hulls and every high building level."
        gain={buildingGain('EXTRACTOR', extractor.level, capped)}
        cost={extractor.cost}
        held={held}
        {...(extractor.blocked ? { blocked: extractor.blocked } : {})}
        actionLabel="Raise"
        onAct={extractor.act}
        pending={extractor.pending}
      />

      <div id="row-RING">
        <UpgradeRow
          mark={<RingMark />}
          name="Orbital Ring"
          level={ring.level}
          role="Slots for satellites. You will never run all five — what you leave out is who you are."
          gain={buildingGain('RING', ring.level, capped)}
          cost={ring.cost}
          held={held}
          {...(ring.blocked ? { blocked: ring.blocked } : {})}
          actionLabel="Raise"
          onAct={ring.act}
          pending={ring.pending}
          highlighted={focused === 'RING'}
        />
      </div>
    </>
  );
}

/* ── building units ─────────────────────────────────────────── */

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
      eyebrow={spec.ground ? 'Ground defence · never leaves' : 'Mobile hull'}
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
      {HULL_ART[hull] && (
        <div className="art-well -mx-4 -mt-4 mb-4 flex justify-center py-4">
          <img src={HULL_ART[hull]} alt={spec.name} className="h-28 object-contain" />
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-dim">{HULL_PITCH[hull]}</p>

      <dl className="mt-4 grid grid-cols-4 gap-3">
        {[
          ['Attack', String(spec.atk)],
          ['Hull', String(spec.hp)],
          ['Speed', spec.speed > 0 ? String(spec.speed) : 'fixed'],
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
