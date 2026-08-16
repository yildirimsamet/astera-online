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
import {
  useGalaxy,
  useIntel,
  usePending,
  usePlanet,
  useBuild,
  useInstallSatellite,
  useUpgrade,
} from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';
import { full } from '../lib/format.js';
import { directives, primary, type PlanetGroup } from '../lib/directives.js';
import { buildingGain, satelliteGain } from '../lib/gains.js';
import { useProjectedResources } from '../lib/projection.js';
import { BUILDING_ART, HULL_ART, nextSatelliteArt, satelliteArt } from '../ui/assets.js';
import { ItemSheet, type ItemRef } from '../ui/ItemSheet.js';
import { BastionMark, CoreMark, ShipyardMark, VaultMark } from '../ui/marks.js';
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
 * The second version fixed the naming and then stacked all four groups down one
 * column: sixteen rows, most of them below the fold, and no way to compare two
 * decisions without scrolling past twelve others.
 *
 * This one is four tabs (interface.md I2). The order never changes, because a
 * control that reorders itself destroys the muscle memory that makes it fast —
 * what moves is the RECOMMENDATION, a pip on whichever problem currently matters
 * most. The section headings stay questions: a player arrives with a worry and
 * should be able to find the heading that matches it.
 */

type GroupId = PlanetGroup;

/** Fixed order: the sequence a planet is actually built in. */
const TABS: GroupId[] = ['grow', 'see', 'defend', 'reach'];

const GROUPS: Record<GroupId, { problem: string; question: string }> = {
  defend: { problem: 'Defend', question: 'What survives if someone lands here?' },
  see: { problem: 'See', question: 'What can you find out — and who can see you?' },
  reach: { problem: 'Reach', question: 'What can you send, and how far?' },
  grow: { problem: 'Grow', question: 'How fast does everything else arrive?' },
};

/** Everything the detail sheet needs, gathered where the row already knows it. */
export interface SheetSpec {
  item: ItemRef;
  name: string;
  role: string;
  blocked?: Blocked;
  pending: boolean;
  act: () => void;
}

export function PlanetScreen({
  focusGroup,
  embedded = false,
}: {
  focusGroup?: GroupId;
  /** Rendered inside a panel over the live galaxy rather than as a full screen. */
  embedded?: boolean;
}) {
  const { data, dataUpdatedAt, isPending } = usePlanet();
  const held = useProjectedResources(data?.planet, dataUpdatedAt, 5000);
  const advice = useAdvice(data, held);
  const [building, setBuilding] = useState<HullId | null>(null);
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [tab, setTab] = useState<GroupId | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  // Set for a moment after a purchase lands, so the row can acknowledge it.
  const [flashed, setFlashed] = useState<string | null>(null);

  useEffect(() => {
    if (!flashed) return;
    const id = setTimeout(() => {
      setFlashed(null);
    }, 800);
    return () => {
      clearTimeout(id);
    };
  }, [flashed]);

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

  const recommended = advice ?? groupOrder(data, focusGroup)[0] ?? 'grow';
  const active = tab ?? focusGroup ?? recommended;

  const shared = {
    planet: data,
    held,
    focused,
    flashed,
    onNeed: (id: string) => {
      // The thing that unblocks you may live under a different tab. Switching to
      // it is the whole point of the requirement being a button.
      const home = TAB_OF[id];
      if (home) setTab(home);
      setFocused(id);
    },
    onFlash: setFlashed,
    onOpen: setSheet,
  };

  return (
    <div className="px-4 pt-4">
      <PlanetHero planet={data} compact={embedded} />

      <Tabs active={active} recommended={recommended} onSelect={setTab} />

      <DecisionGroup problem={GROUPS[active].problem} question={GROUPS[active].question}>
        {active === 'defend' && <Defend {...shared} onBuild={setBuilding} />}
        {active === 'see' && <See {...shared} />}
        {active === 'reach' && <Reach {...shared} onBuild={setBuilding} />}
        {active === 'grow' && <Grow {...shared} />}
      </DecisionGroup>

      {sheet && (
        <ItemSheet
          item={sheet.item}
          name={sheet.name}
          role={sheet.role}
          planet={data}
          held={held}
          {...(sheet.blocked ? { blocked: sheet.blocked } : {})}
          pending={sheet.pending}
          onAct={sheet.act}
          onClose={() => {
            setSheet(null);
          }}
        />
      )}

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
 * The recommendation, taken from the same place the banner takes it.
 *
 * The pip used to be scored separately, which produced the one thing an interface
 * must never do: two pieces of advice on the same screen disagreeing. The card at
 * the top said the planet was undefended while the pip pointed at See.
 */
function useAdvice(
  planet: PlanetView | undefined,
  held: { alloy: number; crystal: number },
): GroupId | undefined {
  const galaxy = useGalaxy();
  const intel = useIntel();
  const pending = usePending();

  if (!planet) return undefined;
  const top = primary(
    directives({
      planet,
      galaxy: galaxy.data,
      intel: intel.data,
      pending: pending.data?.pending ?? [],
      held,
    }),
  );
  return top?.action.group;
}

/** Which tab a given row lives under, so a requirement can jump to it. */
export const TAB_OF: Record<string, GroupId | undefined> = {
  CORE: 'grow',
  REFINERY: 'grow',
  EXTRACTOR: 'grow',
  RING: 'grow',
  VAULT: 'defend',
  AEGIS: 'defend',
  TELESCOPE: 'see',
  RADAR: 'see',
  VEIL: 'see',
  SHIPYARD: 'reach',
};

/**
 * Four problems, one at a time.
 *
 * The pip is the recommendation — the same scoring that used to reorder the
 * sections now just points at one. Advice that moves is useful; furniture that
 * moves is not.
 */
function Tabs({
  active,
  recommended,
  onSelect,
}: {
  active: GroupId;
  recommended: GroupId;
  onSelect: (id: GroupId) => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-5 grid grid-cols-4 gap-1 border-y border-line-soft bg-deep/95 px-4 py-2 backdrop-blur">
      {TABS.map((id) => {
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              onSelect(id);
            }}
            className={`relative py-2 font-display text-[11px] uppercase tracking-[0.14em] transition-colors ${
              on ? 'bg-raised text-bone' : 'text-faint'
            }`}
          >
            {GROUPS[id].problem}
            {id === recommended && !on && (
              <span
                aria-label="suggested"
                className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-crystal shadow-[0_0_6px_rgba(111,211,224,0.9)]"
              />
            )}
          </button>
        );
      })}
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
  flashed: string | null;
  onNeed: (id: string) => void;
  onFlash: (id: string) => void;
  onOpen: (spec: SheetSpec) => void;
}

/** Gathers a row's own knowledge into the shape the detail sheet reads. */
const spec = (
  item: ItemRef,
  name: string,
  role: string,
  action: { blocked?: Blocked; pending: boolean; act: () => void },
): SheetSpec => ({
  item,
  name,
  role,
  ...(action.blocked ? { blocked: action.blocked } : {}),
  pending: action.pending,
  act: action.act,
});

const cappedCount = (planet: PlanetView): number =>
  (['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'RING'] as const).filter(
    (id) => (planet.buildings[id] ?? 0) >= (planet.buildings.CORE ?? 0),
  ).length;

function useBuildingAction(planet: PlanetView, onFlash: (id: string) => void) {
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
            onFlash(id);
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

function useSatelliteAction(planet: PlanetView, onFlash: (id: string) => void) {
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
            onFlash(id);
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
  flashed,
  onNeed,
  onFlash,
  onOpen,
  onBuild,
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const building = useBuildingAction(planet, onFlash);
  const satellite = useSatelliteAction(planet, onFlash);
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
          role={VAULT_ROLE}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'VAULT' }, 'Vault', VAULT_ROLE, vault));
          }}
          gain={buildingGain('VAULT', vault.level, cappedCount(planet))}
          cost={vault.cost}
          held={held}
          {...(vault.blocked ? { blocked: vault.blocked } : {})}
          actionLabel="Raise"
          onAct={vault.act}
          pending={vault.pending}
          highlighted={focused === 'VAULT'}
          flash={flashed === 'VAULT'}
        />
      </div>

      <UpgradeRow
        art={satelliteArt('AEGIS', Math.max(1, aegis.level))}
        nextArt={nextSatelliteArt('AEGIS', aegis.level)}
        name="Aegis"
        level={aegis.level}
        role={AEGIS_ROLE}
        onOpen={() => {
          onOpen(spec({ kind: 'satellite', id: 'AEGIS' }, 'Aegis', AEGIS_ROLE, aegis));
        }}
        gain={satelliteGain('AEGIS', aegis.level)}
        cost={aegis.cost}
        held={held}
        {...(aegis.blocked ? { blocked: aegis.blocked } : {})}
        actionLabel={aegis.level === 0 ? 'Install' : 'Raise'}
        onAct={aegis.act}
        pending={aegis.pending}
        flash={flashed === 'AEGIS'}
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

function See({ planet, held, focused, flashed, onNeed, onFlash, onOpen }: GroupProps) {
  const satellite = useSatelliteAction(planet, onFlash);
  const telescope = satellite('TELESCOPE', 'Telescope', onNeed);
  const radar = satellite('RADAR', 'Radar', onNeed);
  const veil = satellite('VEIL', 'Veil', onNeed);

  return (
    <>
      <UpgradeRow
        art={satelliteArt('TELESCOPE', Math.max(1, telescope.level))}
        nextArt={nextSatelliteArt('TELESCOPE', telescope.level)}
        name="Telescope"
        level={telescope.level}
        role={roleFor('TELESCOPE', telescope.level)}
        onOpen={() => {
          onOpen(
            spec(
              { kind: 'satellite', id: 'TELESCOPE' },
              'Telescope',
              roleFor('TELESCOPE', telescope.level),
              telescope,
            ),
          );
        }}
        gain={satelliteGain('TELESCOPE', telescope.level)}
        cost={telescope.cost}
        held={held}
        {...(telescope.blocked ? { blocked: telescope.blocked } : {})}
        actionLabel={telescope.level === 0 ? 'Install' : 'Raise'}
        onAct={telescope.act}
        pending={telescope.pending}
        highlighted={focused === 'TELESCOPE'}
        flash={flashed === 'TELESCOPE'}
      />

      <UpgradeRow
        art={satelliteArt('RADAR', Math.max(1, radar.level))}
        nextArt={nextSatelliteArt('RADAR', radar.level)}
        name="Radar"
        level={radar.level}
        role={roleFor('RADAR', radar.level)}
        onOpen={() => {
          onOpen(
            spec({ kind: 'satellite', id: 'RADAR' }, 'Radar', roleFor('RADAR', radar.level), radar),
          );
        }}
        gain={satelliteGain('RADAR', radar.level)}
        cost={radar.cost}
        held={held}
        {...(radar.blocked ? { blocked: radar.blocked } : {})}
        actionLabel={radar.level === 0 ? 'Install' : 'Raise'}
        onAct={radar.act}
        pending={radar.pending}
        highlighted={focused === 'RADAR'}
        flash={flashed === 'RADAR'}
      />

      <UpgradeRow
        art={satelliteArt('VEIL', Math.max(1, veil.level))}
        name="Veil"
        level={veil.level}
        role={roleFor('VEIL', veil.level)}
        onOpen={() => {
          onOpen(spec({ kind: 'satellite', id: 'VEIL' }, 'Veil', roleFor('VEIL', veil.level), veil));
        }}
        gain={satelliteGain('VEIL', veil.level)}
        cost={veil.cost}
        held={held}
        {...(veil.blocked ? { blocked: veil.blocked } : {})}
        actionLabel={veil.level === 0 ? 'Install' : 'Raise'}
        onAct={veil.act}
        pending={veil.pending}
        flash={flashed === 'VEIL'}
      />
    </>
  );
}

function Reach({
  planet,
  held,
  focused,
  flashed,
  onNeed,
  onFlash,
  onOpen,
  onBuild,
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const building = useBuildingAction(planet, onFlash);
  const shipyard = building('SHIPYARD', 'Shipyard', onNeed);
  const level = planet.buildings.SHIPYARD ?? 0;

  return (
    <>
      <div id="row-SHIPYARD">
        <UpgradeRow
          mark={<ShipyardMark />}
          name="Shipyard"
          level={shipyard.level}
          role={SHIPYARD_ROLE}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'SHIPYARD' }, 'Shipyard', SHIPYARD_ROLE, shipyard));
          }}
          gain={buildingGain('SHIPYARD', shipyard.level, cappedCount(planet))}
          cost={shipyard.cost}
          held={held}
          {...(shipyard.blocked ? { blocked: shipyard.blocked } : {})}
          actionLabel="Raise"
          onAct={shipyard.act}
          pending={shipyard.pending}
          highlighted={focused === 'SHIPYARD'}
          flash={flashed === 'SHIPYARD'}
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

/**
 * What each thing is FOR — one sentence, written for the decision.
 *
 * Hoisted out of the rows because the detail sheet says the same sentence, and a
 * pitch that drifts between two surfaces is two different products.
 */
const VAULT_ROLE = 'The only stock a raid cannot touch. Everything above it is takeable.';
const AEGIS_ROLE = 'Soaks the first damage of a raid, then regrows on its own.';
const SHIPYARD_ROLE = 'Unlocks heavier hulls, and sharpens every probe you send.';
const REFINERY_ROLE = 'Everything you build waits on this number.';
const EXTRACTOR_ROLE = 'Scarce. Gates the heavy hulls and every high building level.';
const RING_ROLE =
  'Slots for satellites. You will never run all five — what you leave out is who you are.';

const coreRole = (capped: number): string =>
  capped > 0
    ? `${String(capped)} things are stuck at the ceiling until this goes up.`
    : 'Nothing may exceed the Core. It is the ceiling for everything.';

function roleFor(id: 'TELESCOPE' | 'RADAR' | 'VEIL', level: number): string {
  switch (id) {
    case 'TELESCOPE':
      return level === 0
        ? 'You cannot tell whether anyone’s fleet is home.'
        : 'Tells you the moment a watched fleet leaves. They are never told.';
    case 'RADAR':
      return level === 0
        ? 'A fleet can land here with no warning, and probes go unnoticed.'
        : 'Catches probes, and buys you minutes before a fleet lands.';
    case 'VEIL':
      return 'Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies.';
  }
}

/** What each hull is *for*, in the terms the decision is actually made in. */
const HULL_PITCH: Record<HullId, string> = {
  WASP: 'Cheapest damage, fastest home. The shortest time spent undefended.',
  LANCE: 'Hits hardest. Shreds Wasps, bounces off Bulwarks.',
  BULWARK: 'Survives what kills everything else. Nearly doubles your time away.',
  HAULER: 'Carries the loot home. Useless in the fight — escort it or lose it.',
  BASTION: 'Never leaves the planet. The cheapest hit points you can own.',
};

function Grow({ planet, held, focused, flashed, onFlash, onOpen }: Omit<GroupProps, 'onNeed'>) {
  const noop = () => undefined;
  const building = useBuildingAction(planet, onFlash);
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
          role={coreRole(capped)}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'CORE' }, 'Command Core', coreRole(capped), core));
          }}
          gain={buildingGain('CORE', core.level, capped)}
          cost={core.cost}
          held={held}
          actionLabel="Raise"
          onAct={core.act}
          pending={core.pending}
          highlighted={focused === 'CORE'}
          flash={flashed === 'CORE'}
        />
      </div>

      <UpgradeRow
        art={BUILDING_ART.REFINERY}
        name="Alloy Refinery"
        level={refinery.level}
        role={REFINERY_ROLE}
        onOpen={() => {
          onOpen(spec({ kind: 'building', id: 'REFINERY' }, 'Alloy Refinery', REFINERY_ROLE, refinery));
        }}
        gain={buildingGain('REFINERY', refinery.level, capped)}
        cost={refinery.cost}
        held={held}
        {...(refinery.blocked ? { blocked: refinery.blocked } : {})}
        actionLabel="Raise"
        onAct={refinery.act}
        pending={refinery.pending}
        flash={flashed === 'REFINERY'}
      />

      <UpgradeRow
        art={BUILDING_ART.EXTRACTOR}
        name="Crystal Extractor"
        level={extractor.level}
        role={EXTRACTOR_ROLE}
        onOpen={() => {
          onOpen(
            spec({ kind: 'building', id: 'EXTRACTOR' }, 'Crystal Extractor', EXTRACTOR_ROLE, extractor),
          );
        }}
        gain={buildingGain('EXTRACTOR', extractor.level, capped)}
        cost={extractor.cost}
        held={held}
        {...(extractor.blocked ? { blocked: extractor.blocked } : {})}
        actionLabel="Raise"
        onAct={extractor.act}
        pending={extractor.pending}
        flash={flashed === 'EXTRACTOR'}
      />

      <div id="row-RING">
        <UpgradeRow
          art={BUILDING_ART.RING}
          name="Orbital Ring"
          level={ring.level}
          role={RING_ROLE}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'RING' }, 'Orbital Ring', RING_ROLE, ring));
          }}
          gain={buildingGain('RING', ring.level, capped)}
          cost={ring.cost}
          held={held}
          {...(ring.blocked ? { blocked: ring.blocked } : {})}
          actionLabel="Raise"
          onAct={ring.act}
          pending={ring.pending}
          highlighted={focused === 'RING'}
          flash={flashed === 'RING'}
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
