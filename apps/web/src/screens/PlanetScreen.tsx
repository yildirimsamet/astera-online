import { useEffect, useState } from 'react';
import {
  HULLS,
  PROSPECTOR,
  fleetCount,
  instrumentCost,
  instrumentMaxed,
  satelliteCost,
  upgradeCost,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type SatelliteId,
} from '@blindspace/rules';
import {
  useGalaxy,
  useIntel,
  usePending,
  usePlanet,
  useBuild,
  useInstallSatellite,
  useRaiseInstrument,
  useUpgrade,
} from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';

import { directives, primary, type PlanetGroup } from '../lib/directives.js';
import { compact } from '../lib/format.js';
import { buildingGain, instrumentGain, satelliteGain } from '../lib/gains.js';
import { useProjected, type Projected } from '../lib/projection.js';
import {
  HULL_ART,
  RESOURCE_ART,
  SATELLITE_ART,
  buildingArt,
  groundArt,
  instrumentArt,
  nextBuildingArt,
  nextGroundArt,
  nextInstrumentArt,
} from '../ui/assets.js';
import {
  BUILDING_TAG,
  HULL_TAG,
  INSTRUMENT_NAME,
  INSTRUMENT_NEEDS_UPLINK,
  INSTRUMENT_ORDER,
  SATELLITE_NAME,
  INSTRUMENT_TAG,
  SATELLITE_ORDER,
  SATELLITE_ROLE,
  SATELLITE_TAG,
} from '../lib/vocabulary.js';
import { ActionButton, Price, StatStrip } from '../ui/Action.js';
import { ItemSheet, type ItemRef } from '../ui/ItemSheet.js';
import { PlanetHero } from '../ui/PlanetHero.js';
import { Band, DecisionGroup, UpgradeRow, type Blocked } from '../ui/UpgradeRow.js';
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
const TABS: GroupId[] = ['grow', 'orbit', 'defend', 'reach'];

const GROUPS: Record<GroupId, { problem: string; question: string }> = {
  defend: { problem: 'Defend', question: 'What survives if someone lands here?' },
  orbit: {
    problem: 'Orbit',
    question: 'Four satellites overhead, four instruments on the ground. Any of them, in any order.',
  },
  reach: { problem: 'Reach', question: 'What can you send, and how far?' },
  /**
   * "How fast does everything else arrive?" was true and abstract, and it asked
   * the player to already know that this tab is where production lives. A heading
   * question has one job: someone who arrives worried should recognise their own
   * worry in it.
   */
  grow: { problem: 'Grow', question: 'How much ore you make, and how high you can build.' },
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
  const held = useProjected(data?.planet, dataUpdatedAt, 5000);
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
    // What the works actually produce, so a row that cannot be afforded can say
    // when it will be rather than how far along the saving is.
    income: {
      alloyPerHour: data.planet.alloyPerHour,
      crystalPerHour: data.planet.crystalPerHour,
    },
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

      <Tabs active={active} recommended={recommended} onSelect={setTab} held={held} />

      <DecisionGroup problem={GROUPS[active].problem} question={GROUPS[active].question}>
        {active === 'defend' && <Defend {...shared} onBuild={setBuilding} />}
        {active === 'orbit' && <Orbit {...shared} />}
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
  VAULT: 'defend',
  TELESCOPE: 'orbit',
  RADAR: 'orbit',
  VEIL: 'orbit',
  AEGIS: 'orbit',
  // The four satellites live on the same surface as the four instruments (D25).
  UPLINK: 'orbit',
  FOUNDRY: 'orbit',
  DERRICK: 'orbit',
  BEACON: 'orbit',
  SHIPYARD: 'reach',
};

/**
 * Four problems, one at a time.
 *
 * The pip is the recommendation — the same scoring that used to reorder the
 * sections now just points at one. Advice that moves is useful; furniture that
 * moves is not.
 */
/**
 * THE WALLET TRAVELS WITH THE CATEGORIES.
 *
 * Every row on this screen is a price, and the one number needed to read a price
 * was in the header BEHIND this sheet — so deciding what to build meant closing
 * the sheet, reading the header, and opening it again. The owner hit that
 * immediately, and it is the kind of thing that only shows up in use.
 *
 * It sits in the same sticky block as the categories rather than in a strip of its
 * own, because the two answer the same question in sequence — "what can I afford"
 * then "what am I looking at" — and two separately-pinned bars would eat a third
 * of a phone screen between them.
 *
 * STORAGE ONLY, and the works named separately. What you can spend and what you
 * are holding are different numbers under D16, and running them together would
 * quietly restore the belief that the collector exists to break.
 */
function Wallet({ held }: { held: Projected }) {
  const waiting = Math.round(held.bufferAlloy + held.bufferCrystal);

  return (
    <div className="flex items-center gap-3 px-4 pb-1.5 pt-2 text-[13px]">
      <span className="flex items-center gap-1.5">
        <img src={RESOURCE_ART.alloy} alt="" aria-hidden className="size-4 object-contain" />
        <span className="num text-alloy">{compact(held.alloy)}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <img src={RESOURCE_ART.crystal} alt="" aria-hidden className="size-4 object-contain" />
        <span className="num text-crystal">{compact(held.crystal)}</span>
      </span>
      {waiting >= 1 && (
        <span className="ml-auto text-[11px] text-faint">
          <span className="num text-dim">{compact(waiting)}</span> in the works
        </span>
      )}
    </div>
  );
}

function Tabs({
  active,
  recommended,
  onSelect,
  held,
}: {
  active: GroupId;
  recommended: GroupId;
  onSelect: (id: GroupId) => void;
  held: Projected;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-5 border-y border-line-soft bg-deep/95 backdrop-blur">
      <Wallet held={held} />
      <div className="grid grid-cols-4 gap-1 px-4 pb-2">
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
  const score: Record<GroupId, number> = { defend: 0, orbit: 0, reach: 0, grow: 10 };

  const exposed = Math.max(0, planet.planet.alloy + planet.planet.crystal - planet.planet.vaultFloor);
  if (fleetCount(planet.ground) === 0) score.defend += 60;
  if (exposed > planet.planet.vaultFloor * 3) score.defend += 40;
  if ((planet.instruments.TELESCOPE ?? 0) === 0) score.orbit += 55;
  if ((planet.instruments.RADAR ?? 0) === 0) score.orbit += 25;
  if (fleetCount(planet.fleet) === 0) score.reach += 45;
  if ((planet.buildings.SHIPYARD ?? 0) === 0) score.reach += 15;

  const ids: GroupId[] = ['defend', 'orbit', 'reach', 'grow'];
  const sorted = ids.sort((a, b) => score[b] - score[a]);
  if (!focus) return sorted;
  return [focus, ...sorted.filter((id) => id !== focus)];
}

/* ── shared plumbing ────────────────────────────────────────── */

interface GroupProps {
  planet: PlanetView;
  held: { alloy: number; crystal: number };
  income: { alloyPerHour: number; crystalPerHour: number };
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
  (['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'] as const).filter(
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

/**
 * RAISING ONE OF THE FOUR ON THE GROUND. D25.
 *
 * Two refusals, and both are things a player can act on in the moment they meet
 * them. The Command Core ceiling, which the Vault and the Shipyard obey
 * identically and which is not a relationship between instruments. And the Uplink,
 * for the two that SEE — the one gate in the whole system, and the reason a
 * planet's first orbit slot is a real decision rather than a formality.
 *
 * The slot budget is gone from here entirely: an instrument does not take one.
 */
function useInstrumentAction(planet: PlanetView, onFlash: (id: string) => void) {
  const raise = useRaiseInstrument();
  const say = useToast();
  const core = planet.buildings.CORE ?? 0;
  const uplink = planet.orbit.includes('UPLINK');

  return (id: InstrumentId, name: string, onNeed: (row: string) => void) => {
    const level = planet.instruments[id] ?? 0;
    // Server-priced, for the same reason buildings are: the endpoint is the
    // authority and a screen quoting its own arithmetic can offer a purchase that
    // will be refused.
    const cost = planet.instrumentCosts[id] ?? instrumentCost(id, level);

    const needsUplink = INSTRUMENT_NEEDS_UPLINK.includes(id) && !uplink;
    /**
     * MAXED IS CHECKED FIRST, AND IT CARRIES NO WAY OUT. D36.
     *
     * The other two states are things the player can go and fix — build an Uplink,
     * raise the Core — so they hand over an `onFix` that takes them there. This one
     * is not a blockage; it is the end of the ladder, and offering a route past it
     * would be another version of the same lie the row used to tell.
     *
     * It is FIRST because a maxed instrument under a low Core would otherwise say
     * "Core L7" and send the player off to raise a Core that buys them nothing.
     */
    const blocked: Blocked | undefined = instrumentMaxed(id, level)
      ? { reason: 'at its highest level' }
      : needsUplink
        ? { reason: 'an Uplink in orbit', onFix: () => { onNeed('UPLINK'); } }
        : level >= core
          ? { reason: `Core L${String(core + 1)}`, onFix: () => { onNeed('CORE'); } }
          : undefined;

    return {
      level,
      cost,
      blocked,
      pending: raise.isPending,
      act: () => {
        raise.mutate(id, {
          onSuccess: (r) => {
            onFlash(id);
            say(`${name} online at L${String(r.level)}`);
          },
          onError: (err) => { say(describe(err), 'error'); },
        });
      },
    };
  };
}

/**
 * PUTTING ONE OF THE FOUR IN ORBIT. D25.
 *
 * Bought once, never raised, and the only thing that rations it is the SLOT — the
 * Command Core opens one at L1, L3, L5 and L9. So the refusal here is not "you
 * cannot have this", it is "not while those are up there", and it points at the
 * Core because raising it is the thing that actually fixes it.
 */
function useOrbitAction(planet: PlanetView, onFlash: (id: string) => void) {
  const install = useInstallSatellite();
  const say = useToast();
  const free = planet.orbitSlots - planet.orbit.length;

  return (id: SatelliteId, name: string, onNeed: (row: string) => void) => {
    const owned = planet.orbit.includes(id);
    const cost = planet.satelliteCosts[id] ?? satelliteCost(id);

    const blocked: Blocked | undefined =
      !owned && free <= 0
        ? { reason: 'a free orbit slot', onFix: () => { onNeed('CORE'); } }
        : undefined;

    return {
      owned,
      cost,
      blocked,
      pending: install.isPending,
      act: () => {
        install.mutate(id, {
          onSuccess: () => {
            onFlash(id);
            say(`${name} is in orbit`);
          },
          onError: (err) => { say(describe(err), 'error'); },
        });
      },
    };
  };
}

/* ── the four groups ────────────────────────────────────────── */

/* ── what each structure is for, in one line ────────────────── */

const VAULT_ROLE = 'The only stock a raid cannot touch. Everything above it is takeable.';
const SHIPYARD_ROLE = 'Unlocks heavier hulls, and sharpens every probe you send.';
const REFINERY_ROLE = 'Everything you build waits on this number.';
const EXTRACTOR_ROLE = 'Scarce. Gates the heavy hulls and every high building level.';

const coreRole = (capped: number): string =>
  capped > 0
    ? `${String(capped)} things are stuck at the ceiling until this goes up.`
    : 'Nothing may exceed the Core. It is the ceiling for everything.';

/** Where the Command Core opens another slot. Mirrors `satelliteSlots` in the rules. */
const ORBIT_UNLOCKS = [1, 3, 5, 9] as const;

function Defend({
  planet,
  held,
  income,
  focused,
  flashed,
  onNeed,
  onFlash,
  onOpen,
  onBuild,
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const building = useBuildingAction(planet, onFlash);
  const vault = building('VAULT', 'Vault', onNeed);
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const bastion = HULLS.BASTION;
  const thorn = HULLS.THORN;
  const ground = fleetCount(planet.ground);
  /**
   * How many guns of each kind are on the plate.
   *
   * The art tier is read off these rather than off a level, because a ground gun
   * has no level — a battery's only ladder is how many barrels are in it, and
   * `groundArt` renders exactly that.
   */
  const thornsStanding = planet.ground.THORN ?? 0;
  const bastionsStanding = planet.ground.BASTION ?? 0;

  return (
    <>
      <div id="row-VAULT">
        <UpgradeRow
          art={buildingArt('VAULT', Math.max(1, vault.level))}
          nextArt={nextBuildingArt('VAULT', vault.level)}
          name="Vault"
        tag={BUILDING_TAG.VAULT}
          level={vault.level}
          role={VAULT_ROLE}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'VAULT' }, 'Vault', VAULT_ROLE, vault));
          }}
          gain={buildingGain('VAULT', vault.level, cappedCount(planet))}
          cost={vault.cost}
          held={held}
          income={income}
          {...(vault.blocked ? { blocked: vault.blocked } : {})}
          verb="raise"
          onAct={vault.act}
          pending={vault.pending}
          highlighted={focused === 'VAULT'}
          flash={flashed === 'VAULT'}
        />
      </div>

      {/*
        TWO GUNS, AND THE BAND SAYS WHY THERE ARE TWO. D27.

        A defender used to have no composition choice at all — one ground hull meant
        "how much" was the whole decision. These two are opposite classes, so what a
        planet is strong AGAINST is now a choice, and it is the choice an attacker
        has to scout to discover.
      */}
      <Band
        label="On the ground"
        note="They never leave. Each is strong against what the other is weak to — build one kind and a raider who scouts you will bring its counter."
      />

      <UpgradeRow
        art={groundArt('THORN', Math.max(1, thornsStanding))}
        nextArt={nextGroundArt('THORN', thornsStanding)}
        name="Thorn"
        tag={HULL_TAG.THORN}
        stats={{ atk: thorn.atk, hp: thorn.hp, speed: thorn.speed, cargo: thorn.cargo }}
        role={
          thornsStanding === 0
            ? 'Light guns. They tear into heavy hulls, and Lances pick them off.'
            : `${String(thornsStanding)} standing. Strong against heavies, weak to Lances.`
        }
        gain={{
          label: 'Thorns',
          now: String(thornsStanding),
          next: String(thornsStanding + 1),
        }}
        cost={{ alloy: thorn.alloy, crystal: thorn.crystal }}
        held={held}
        income={income}
        verb="build"
        onAct={() => { onBuild('THORN'); }}
      />

      <UpgradeRow
        art={groundArt('BASTION', Math.max(1, bastionsStanding))}
        nextArt={nextGroundArt('BASTION', bastionsStanding)}
        name="Bastion"
        tag={HULL_TAG.BASTION}
        stats={{ atk: bastion.atk, hp: bastion.hp, speed: bastion.speed, cargo: bastion.cargo }}
        role={
          ground === 0
            ? 'Heavy guns. They break Lances, and a swarm of Wasps overwhelms them.'
            : `${String(bastionsStanding)} standing. Strong against Lances, weak to swarms. 60% of losses rebuild free.`
        }
        gain={{ label: 'Ground units', now: String(ground), next: String(ground + 1) }}
        cost={{ alloy: bastion.alloy, crystal: bastion.crystal }}
        held={held}
        income={income}
        {...(shipyard < bastion.minShipyard
          ? {
              blocked: {
                reason: `Shipyard L${String(bastion.minShipyard)}`,
                onFix: () => { onNeed('SHIPYARD'); },
              } satisfies Blocked,
            }
          : {})}
        verb="build"
        onAct={() => { onBuild('BASTION'); }}
      />

      {/*
        THE THIRD KIND OF DEFENCE IS ON ANOTHER TAB, AND SAYING SO IS CHEAPER THAN
        MOVING IT.

        A player asking "how do I not lose my things" finds the Vault and the
        Bastion here and no shield at all — the Aegis is hardware, and D22's whole
        point is that every piece of hardware is weighed against the others on one
        surface. Splitting it back out to make this tab complete would undo that.
        A pointer costs one row and keeps both true.
      */}
      <button
        type="button"
        onClick={() => { onNeed('AEGIS'); }}
        className="flex w-full items-center gap-2 border-b border-line-soft px-3.5 py-3 text-left last:border-b-0"
      >
        <span className="text-[12px] leading-snug text-dim">
          A shield is hardware — the <span className="text-bone">Aegis</span> is under Orbit.
        </span>
        <span aria-hidden className="ml-auto text-[13px] text-faint">
          →
        </span>
      </button>
    </>
  );
}

/**
 * TWO KINDS OF HARDWARE ON ONE SURFACE, AND THE DIFFERENCE IS THE POINT. D25.
 *
 * They used to be one list of five things that all behaved the same way and all
 * competed for the same slots, and the owner's verdict on it was blunt and
 * correct: it was a muddle. A telescope is not a satellite. A shield is not a
 * satellite. A drill is a craft.
 *
 * So: what is IN ORBIT comes first, because that is where the identity choice
 * lives — four satellites, four different jobs, and only as many as the Command
 * Core has opened slots for. Then what is ON THE GROUND: four levelled
 * instruments, no slot, no order, any of them at any time. Two headings and a slot
 * meter are what make those two rules legible without a paragraph of explanation.
 *
 * Neither list is a ranking, and neither reorders itself under a player's thumb.
 */
function Orbit({ planet, held, income, focused, flashed, onNeed, onFlash, onOpen }: GroupProps) {
  const orbit = useOrbitAction(planet, onFlash);
  const instrument = useInstrumentAction(planet, onFlash);
  const free = planet.orbitSlots - planet.orbit.length;

  return (
    <>
      <Band
        label="In orbit"
        note="Each one takes a slot. Built once — they have no levels."
        aside={
          <SlotPips slots={planet.orbitSlots} used={planet.orbit.length} core={planet.buildings.CORE ?? 0} />
        }
      />

      {SATELLITE_ORDER.map((id) => {
        const name = SATELLITE_NAME[id];
        const action = orbit(id, name, onNeed);
        const role = SATELLITE_ROLE[id];
        return (
          <div key={id} id={`row-${id}`}>
            <UpgradeRow
              art={SATELLITE_ART[id]}
              name={name}
              tag={SATELLITE_TAG[id]}
              role={role}
              onOpen={() => {
                onOpen(spec({ kind: 'satellite', id }, name, role, action));
              }}
              gain={satelliteGain(id)}
              cost={action.cost}
              held={held}
              income={income}
              {...(action.blocked ? { blocked: action.blocked } : {})}
              verb="install"
              onAct={action.act}
              pending={action.pending}
              highlighted={focused === id}
              flash={flashed === id}
              /**
               * A satellite that is up is DONE, and the row says so instead of
               * offering a purchase the endpoint would refuse. There is no second
               * level to sell — that is the whole difference between these four
               * and the four below.
               */
              {...(action.owned ? { blocked: { reason: 'already in orbit' } satisfies Blocked } : {})}
            />
          </div>
        );
      })}

      <Band
        label="On the planet"
        note="No slot needed. These have levels — raise them as far as your Command Core allows."
        aside={
          <span className="num text-[11px] text-faint">
            {free > 0 ? `${String(free)} slot${free === 1 ? '' : 's'} still free above` : 'orbit is full'}
          </span>
        }
      />

      {INSTRUMENT_ORDER.map((id) => {
        const name = INSTRUMENT_NAME[id];
        const action = instrument(id, name, onNeed);
        const role = instrumentRole(id, action.level);
        const next = nextInstrumentArt(id, action.level);
        return (
          <div key={id} id={`row-${id}`}>
            <UpgradeRow
              art={instrumentArt(id, Math.max(1, action.level))}
              {...(next ? { nextArt: next } : {})}
              name={name}
              level={action.level}
              tag={INSTRUMENT_TAG[id]}
              role={role}
              onOpen={() => {
                onOpen(spec({ kind: 'instrument', id }, name, role, action));
              }}
              gain={instrumentGain(id, action.level)}
              cost={action.cost}
              held={held}
              income={income}
              {...(action.blocked ? { blocked: action.blocked } : {})}
              verb={action.level === 0 ? 'install' : 'raise'}
              onAct={action.act}
              pending={action.pending}
              highlighted={focused === id}
              flash={flashed === id}
            />
          </div>
        );
      })}
    </>
  );
}

/**
 * How much room is left overhead, as a thing rather than a sentence.
 *
 * The slot count is the only rationing left in the whole hardware system, so it
 * gets a picture: filled pips for what is up, empty ones for what is open, and the
 * Core level that opens the next one. A player who reads this before shopping never
 * meets the refusal.
 */
function SlotPips({ slots, used, core }: { slots: number; used: number; core: number }) {
  const next = ORBIT_UNLOCKS.find((level) => level > core);

  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1">
        {Array.from({ length: Math.max(slots, 1) }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-5 rounded-full ${i < used ? 'bg-crystal/70' : 'bg-line-soft'}`}
          />
        ))}
      </span>
      <span className="num text-[11px] text-dim">
        {used}/{slots}
        {next !== undefined && <span className="text-faint"> · +1 at Core L{next}</span>}
      </span>
    </span>
  );
}

/**
 * WHAT YOU CAN SEND — SORTED BY WHAT IT DOES, NOT BY WHAT IT COSTS.
 *
 * The Prospector used to head this list, so the first card under "what can you
 * send" was a craft that never fights and cannot be aimed at a planet at all. A
 * player reading top to bottom learnt the wrong thing about the tab before they
 * reached anything that could raid.
 *
 * Three bands now, and each one is a different KIND of sending: the hulls that
 * fight, in ascending weight; the one that carries what they take; and the one
 * that is aimed at a rock instead of a person. The bands are the grouping — the
 * order inside each is fixed and is not a ranking.
 */
function Reach({
  planet,
  held,
  income,
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

  const hull = (id: HullId) => {
    const hullSpec = HULLS[id];
    const owned = planet.fleet[id] ?? 0;
    return (
      <UpgradeRow
        key={id}
        art={HULL_ART[id]}
        name={hullSpec.name}
        tag={HULL_TAG[id]}
        stats={{
          atk: hullSpec.atk,
          hp: hullSpec.hp,
          speed: hullSpec.speed,
          cargo: hullSpec.cargo,
        }}
        role={HULL_PITCH[id]}
        gain={{ label: 'You have', now: String(owned), next: String(owned + 1) }}
        cost={{ alloy: hullSpec.alloy, crystal: hullSpec.crystal }}
        held={held}
        income={income}
        /**
         * ONE GATE ON EVERY HULL, AND IT IS THE SHIPYARD. D25.
         *
         * The Prospector used to also demand a DRILL satellite, which was wrong
         * twice over: a drill is a craft rather than hardware holding station
         * beside a world, and gating a hull on an orbit slot made mining an
         * all-or-nothing detour. The Derrick in orbit is what makes the craft
         * BETTER; nothing makes it impossible.
         */
        {...(level < hullSpec.minShipyard
          ? {
              blocked: {
                reason: `Shipyard L${String(hullSpec.minShipyard)}`,
                onFix: () => { onNeed('SHIPYARD'); },
              } satisfies Blocked,
            }
          : {})}
        verb="build"
        onAct={() => { onBuild(id); }}
      />
    );
  };

  return (
    <>
      <div id="row-SHIPYARD">
        <UpgradeRow
          art={buildingArt('SHIPYARD', Math.max(1, shipyard.level))}
          nextArt={nextBuildingArt('SHIPYARD', shipyard.level)}
          name="Shipyard"
          tag={BUILDING_TAG.SHIPYARD}
          level={shipyard.level}
          role={SHIPYARD_ROLE}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'SHIPYARD' }, 'Shipyard', SHIPYARD_ROLE, shipyard));
          }}
          gain={buildingGain('SHIPYARD', shipyard.level, cappedCount(planet))}
          cost={shipyard.cost}
          held={held}
          income={income}
          {...(shipyard.blocked ? { blocked: shipyard.blocked } : {})}
          verb="raise"
          onAct={shipyard.act}
          pending={shipyard.pending}
          highlighted={focused === 'SHIPYARD'}
          flash={flashed === 'SHIPYARD'}
        />
      </div>

      <Band label="Warships" note="These fight. Send them at another planet." />
      {(['WASP', 'LANCE', 'BULWARK'] as const).map(hull)}

      <Band label="Support" note="Never fights. Goes along to carry what the fleet takes." />
      {hull('HAULER')}

      <Band label="Mining" note="Sent at an asteroid, not at a planet. Brings the ore home." />
      {hull('PROSPECTOR')}
    </>
  );
}

/**
 * WHAT EACH INSTRUMENT IS FOR — and what it costs you.
 *
 * Written as a pair: what it buys, and what it does not do. The second half is the
 * part that makes the choice a choice, because four sentences that all mean "helps
 * you" are one option wearing four hats.
 *
 * The satellites' own lines live in `lib/vocabulary.ts` beside their names — they
 * are read by the galaxy and the detail sheet as well as by this screen, and a
 * description that lived in a screen would drift from the one in orbit.
 */
function instrumentRole(id: InstrumentId, level: number): string {
  switch (id) {
    case 'TELESCOPE':
      return level === 0
        ? 'SEE OUT. Watch one world and know when its fleet leaves — the single most valuable fact in the game. Needs an Uplink overhead.'
        : 'SEE OUT. Watches a world silently; they are never told. Knowledge, and no protection whatsoever.';
    case 'RADAR':
      return level === 0
        ? 'BE WARNED. Right now a fleet can land here with no notice and probes come and go unseen. Needs an Uplink overhead.'
        : 'BE WARNED. Catches probes and buys minutes before a landing. Wins nothing on offence.';
    case 'VEIL':
      return 'BE UNREADABLE. Their telescope reads UNKNOWN instead of your fleet. It hides; it never lies — and it does not stop a probe.';
    case 'AEGIS':
      return 'ABSORB. Sits at the planet, not in orbit. Soaks the opening damage of a raid and regrows on its own, free. Safe, and completely blind.';
  }
}

/** What each hull is *for*, in the terms the decision is actually made in. */
const HULL_PITCH: Record<HullId, string> = {
  WASP: 'Cheapest damage, fastest home. The shortest time spent undefended.',
  LANCE: 'Hits hardest. Shreds Wasps, bounces off Bulwarks.',
  BULWARK: 'Survives what kills everything else. Nearly doubles your time away.',
  HAULER: 'Carries the loot home. Useless in the fight — escort it or lose it.',
  BASTION: 'Heavy ground guns. Break Lances; swarms overwhelm them.',
  THORN: 'Light ground guns, cheap and many. Tear into heavies; Lances pick them off.',
  PROSPECTOR: 'Flies to a passing rock and brings the ore back. Never fights.',
};

function Grow({ planet, held, income, focused, flashed, onFlash, onOpen }: GroupProps) {
  // Nothing under Grow can be blocked by something on another tab: the Core is the
  // ceiling and the other two sit under it. There is no requirement to jump to.
  const noop = () => undefined;
  const building = useBuildingAction(planet, onFlash);
  const core = building('CORE', 'Command Core', noop);
  const refinery = building('REFINERY', 'Alloy Refinery', noop);
  const extractor = building('EXTRACTOR', 'Crystal Extractor', noop);
  const capped = cappedCount(planet);

  return (
    <>
      <div id="row-CORE">
        <UpgradeRow
          art={buildingArt('CORE', Math.max(1, core.level))}
          nextArt={nextBuildingArt('CORE', core.level)}
          name="Command Core"
        tag={BUILDING_TAG.CORE}
          level={core.level}
          role={coreRole(capped)}
          onOpen={() => {
            onOpen(spec({ kind: 'building', id: 'CORE' }, 'Command Core', coreRole(capped), core));
          }}
          gain={buildingGain('CORE', core.level, capped)}
          cost={core.cost}
          held={held}
          income={income}
          verb="raise"
          onAct={core.act}
          pending={core.pending}
          highlighted={focused === 'CORE'}
          flash={flashed === 'CORE'}
        />
      </div>

      <UpgradeRow
        art={buildingArt('REFINERY', refinery.level)}
        name="Alloy Refinery"
        tag={BUILDING_TAG.REFINERY}
        level={refinery.level}
        role={REFINERY_ROLE}
        onOpen={() => {
          onOpen(spec({ kind: 'building', id: 'REFINERY' }, 'Alloy Refinery', REFINERY_ROLE, refinery));
        }}
        gain={buildingGain('REFINERY', refinery.level, capped)}
        cost={refinery.cost}
        held={held}
        income={income}
        {...(refinery.blocked ? { blocked: refinery.blocked } : {})}
        verb="raise"
        onAct={refinery.act}
        pending={refinery.pending}
        flash={flashed === 'REFINERY'}
      />

      <UpgradeRow
        art={buildingArt('EXTRACTOR', extractor.level)}
        name="Crystal Extractor"
        tag={BUILDING_TAG.EXTRACTOR}
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
        income={income}
        {...(extractor.blocked ? { blocked: extractor.blocked } : {})}
        verb="raise"
        onAct={extractor.act}
        pending={extractor.pending}
        flash={flashed === 'EXTRACTOR'}
      />


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

  /**
   * A PROSPECTOR IS RATIONED, AND THE SHEET HAS TO SAY SO.
   *
   * `PROSPECTOR.max` is a hard limit on how many a planet may OWN, so it counts
   * craft that are away mining as well as those on the ground — the server does the
   * same, and this is the only reason `fleetAway` is on the payload. Without it the
   * picker offered 1 / 5 / 25 / Max for a hull you may hold three of.
   *
   * The server refuses over the cap regardless (Principle 1 — the client never
   * decides an outcome); this exists so the control never offers what will be
   * refused.
   */
  const owned = (planet.fleet[hull] ?? 0) + (planet.fleetAway[hull] ?? 0);
  const cap = hull === 'PROSPECTOR' ? Math.max(0, PROSPECTOR.max - owned) : Number.MAX_SAFE_INTEGER;

  const affordable = Math.min(
    Math.floor(held.alloy / spec.alloy),
    spec.crystal > 0 ? Math.floor(held.crystal / spec.crystal) : Number.MAX_SAFE_INTEGER,
  );
  const room = Math.min(affordable, cap);
  const ceiling = Math.max(1, room);
  /**
   * Deduped and clamped, so the picker can never offer a number the ceiling
   * forbids. At a ceiling of 3 that is `1 · Max 3`, not `1 · 5 · 25 · Max 3`.
   */
  const steps = [...new Set([1, 5, 25, ceiling].filter((n) => n <= ceiling))].sort((a, b) => a - b);
  const [count, setCount] = useState(1);
  const clamped = Math.min(count, ceiling);
  const totalAlloy = spec.alloy * clamped;
  const totalCrystal = spec.crystal * clamped;
  const defenceNow = fleetCount(planet.fleet) + fleetCount(planet.ground);
  /**
   * The picture at the top of the sheet.
   *
   * A ground gun's render is tiered by how many are STANDING rather than by a
   * level it does not have, so the sheet shows the battery the player already
   * owns — the same picture the row they tapped was wearing.
   */
  const art =
    hull === 'BASTION' || hull === 'THORN'
      ? groundArt(hull, Math.max(1, planet.ground[hull] ?? 0))
      : HULL_ART[hull];

  return (
    <Sheet
      eyebrow={spec.ground ? 'Ground defence · never leaves' : 'Mobile hull'}
      title={spec.name}
      onClose={onClose}
      footer={
        <ActionButton
          verb="build"
          cost={{ alloy: totalAlloy, crystal: totalCrystal }}
          held={held}
          pending={build.isPending}
          full
          label={`Build ${String(clamped)}`}
          onAct={() => {
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
        />
      }
    >
      {art && (
        <div className="art-well -mx-4 -mt-4 mb-4 flex justify-center py-4">
          <img src={art} alt={spec.name} className="h-28 object-contain" />
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-dim">{HULL_PITCH[hull]}</p>

      <div className="mt-4">
        <StatStrip atk={spec.atk} hp={spec.hp} speed={spec.speed} cargo={spec.cargo} size="card" />
      </div>

      <div className="mt-6">
        <p className="legend mb-2">How many</p>
        {room === 0 ? (
          <p className="text-[13px] leading-relaxed text-amber">
            You already hold {String(owned)} — the limit. Send one out and bring it home; you
            will not be building a fourth.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {steps.map((n, i) => (
              <button
                key={`${String(n)}-${String(i)}`}
                type="button"
                className={`btn flex-1 ${clamped === n ? 'border-crystal/60 text-crystal' : ''}`}
                onClick={() => {
                  setCount(n);
                }}
              >
                {i === steps.length - 1 && steps.length > 1 ? `Max ${String(n)}` : String(n)}
              </button>
            ))}
          </div>
        )}
        {cap !== Number.MAX_SAFE_INTEGER && room > 0 && (
          <p className="mt-2 text-[12px] text-faint">
            {String(owned)} of {String(PROSPECTOR.max)} held. Three is the limit, counting the
            ones that are out.
          </p>
        )}
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <Price cost={{ alloy: totalAlloy, crystal: totalCrystal }} held={held} />
        <p className="num text-[12px] text-faint">
          Home defence after: {String(defenceNow + clamped)} units
        </p>
      </div>
    </Sheet>
  );
}
