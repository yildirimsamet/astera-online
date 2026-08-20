import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Unreachable, Waiting } from '../ui/kit/Surface.js';
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
} from '@astera/rules';
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
  INSTRUMENT_NEEDS_UPLINK,
  INSTRUMENT_ORDER,
  SATELLITE_ORDER,
} from '../lib/vocabulary.js';
import i18n from '../i18n/index.js';
import {
  buildingName,
  buildingTag,
  hullLabel,
  hullPitch,
  hullTag,
  instrumentLabel,
  instrumentPitch,
  instrumentTag,
  satelliteLabel,
  satelliteRole,
  satelliteTag,
} from '../i18n/names.js';
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
 * control that reorders itself destroys the muscle memory that makes it fast. The
 * section headings stay questions: a player arrives with a worry and should be
 * able to find the heading that matches it.
 *
 * NOTHING ON THE BAR GIVES ADVICE. A pip used to mark whichever problem ranked
 * highest, and it is gone by owner decision: the tabs say what they ARE and the
 * choosing is the player's. What survives of the ranking is which tab the screen
 * OPENS on, which is a default and not a second opinion.
 */

type GroupId = PlanetGroup;

/** Fixed order: the sequence a planet is actually built in. */
const TABS: GroupId[] = ['grow', 'orbit', 'defend', 'reach'];

/**
 * FOUR PROBLEMS, EACH NAMED BY THE WORRY IT ANSWERS.
 *
 * Keys rather than sentences. A heading question has one job — someone who
 * arrives worried should recognise their own worry in it — and a table of
 * finished strings built at module load would still be in the old language after
 * the switcher was pressed.
 */
const GROUPS = {
  defend: { problem: 'planet.tabs.defendProblem', question: 'planet.tabs.defendQuestion' },
  orbit: { problem: 'planet.tabs.orbitProblem', question: 'planet.tabs.orbitQuestion' },
  reach: { problem: 'planet.tabs.reachProblem', question: 'planet.tabs.reachQuestion' },
  grow: { problem: 'planet.tabs.growProblem', question: 'planet.tabs.growQuestion' },
} as const satisfies Record<GroupId, { problem: string; question: string }>;

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
  const { t } = useTranslation();
  const { data, dataUpdatedAt, isError, refetch } = usePlanet();
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

  /**
   * A FAILED READ IS NOT A SLOW ONE.
   *
   * This was `isPending || !data`, and the second half is what made it wrong: on an
   * error React Query's status becomes `error` — so `isPending` goes false — while
   * `data` stays undefined, and the screen sat on an animated "Reading planet"
   * claiming progress on a request that had already given up retrying.
   */
  if (isError) {
    return (
      <Unreachable
        what={t('surface.whatPlanet')}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!data) return <Waiting>{t('surface.waitingPlanet')}</Waiting>;

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

      <Tabs active={active} onSelect={setTab} held={held} />

      <DecisionGroup problem={t(GROUPS[active].problem)} question={t(GROUPS[active].question)}>
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
        // `data-build-sheet` is how the onboarding gate (D56) keeps this surface
        // live: it is opened BY a gated control, so sealing it would trap.
        <div data-build-sheet>
        <BuildSheet
          hull={building}
          planet={data}
          held={held}
          onClose={() => {
            setBuilding(null);
          }}
        />
        </div>
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
          {/* Which side of the figure the phrase sits on is the language's call:
              English puts "in the works" after it, Turkish puts "havuzda" before. */}
          <Trans
            i18nKey="planet.wallet.inTheWorks"
            values={{ amount: compact(waiting) }}
            components={[<span key="n" className="num text-dim" />]}
          />
        </span>
      )}
    </div>
  );
}

/**
 * FOUR TABS, FIXED ORDER, AND NO ADVICE ON THEM. Owner decision.
 *
 * A pip used to mark whichever problem the situation engine ranked highest. It is
 * gone: the screen states what each tab IS and leaves the choosing to the player,
 * rather than carrying a second opinion beside whatever else is on screen. The
 * engine still picks which tab OPENS — see `useAdvice` — because a screen has to
 * open on something, and that is a default rather than a recommendation.
 */
function Tabs({
  active,
  onSelect,
  held,
}: {
  active: GroupId;
  onSelect: (id: GroupId) => void;
  held: Projected;
}) {
  const { t } = useTranslation();
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
            // Marked so a surface outside this screen can point at a tab. The
            // onboarding lights the one a beat is working in, because a dimmed
            // screen with one live control still has to say WHERE that control is.
            data-tab={id}
            aria-current={on ? 'page' : undefined}
            onClick={() => {
              onSelect(id);
            }}
            className={`relative py-2 font-display text-[11px] uppercase tracking-[0.14em] transition-colors ${
              on ? 'bg-raised text-bone' : 'text-faint'
            }`}
          >
            {t(GROUPS[id].problem)}
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
        ? {
            reason: i18n.t('planet.blocked.core', { level: core + 1 }),
            onFix: () => { onNeed('CORE'); },
          }
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
            say(i18n.t('planet.done.raised', { name, level: r.level }));
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
      ? { reason: i18n.t('planet.blocked.maxed') }
      : needsUplink
        ? { reason: i18n.t('planet.blocked.uplink'), onFix: () => { onNeed('UPLINK'); } }
        : level >= core
          ? {
              reason: i18n.t('planet.blocked.core', { level: core + 1 }),
              onFix: () => { onNeed('CORE'); },
            }
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
            say(i18n.t('planet.done.instrument', { name, level: r.level }));
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
        ? { reason: i18n.t('planet.blocked.orbitSlot'), onFix: () => { onNeed('CORE'); } }
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
            say(i18n.t('planet.done.satellite', { name }));
          },
          onError: (err) => { say(describe(err), 'error'); },
        });
      },
    };
  };
}

/* ── the four groups ────────────────────────────────────────── */

/* ── what each structure is for, in one line ────────────────── */

const vaultRole = (): string => i18n.t('planet.roles.vault');
const shipyardRole = (): string => i18n.t('planet.roles.shipyard');
const refineryRole = (): string => i18n.t('planet.roles.refinery');
const extractorRole = (): string => i18n.t('planet.roles.extractor');

const coreRole = (capped: number): string =>
  capped > 0
    ? i18n.t('planet.roles.coreCapped', { count: capped })
    : i18n.t('planet.roles.coreClear');

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
  const { t } = useTranslation();
  const building = useBuildingAction(planet, onFlash);
  const vault = building('VAULT', buildingName('VAULT'), onNeed);
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
          name={buildingName('VAULT')}
          tag={buildingTag('VAULT')}
          level={vault.level}
          role={vaultRole()}
          onOpen={() => {
            onOpen(
              spec({ kind: 'building', id: 'VAULT' }, buildingName('VAULT'), vaultRole(), vault),
            );
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
      <Band label={t('planet.defend.groundBand')} note={t('planet.defend.groundNote')} />

      <UpgradeRow
        art={groundArt('THORN', Math.max(1, thornsStanding))}
        nextArt={nextGroundArt('THORN', thornsStanding)}
        name={hullLabel('THORN')}
        tag={hullTag('THORN')}
        stats={{ atk: thorn.atk, hp: thorn.hp, speed: thorn.speed, cargo: thorn.cargo }}
        role={
          thornsStanding === 0
            ? t('planet.defend.thornNone')
            : t('planet.defend.thornStanding', { count: thornsStanding })
        }
        gain={{
          label: t('planet.defend.thornGain'),
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
        name={hullLabel('BASTION')}
        tag={hullTag('BASTION')}
        stats={{ atk: bastion.atk, hp: bastion.hp, speed: bastion.speed, cargo: bastion.cargo }}
        role={
          ground === 0
            ? t('planet.defend.bastionNone')
            : t('planet.defend.bastionStanding', { count: bastionsStanding })
        }
        gain={{
          label: t('planet.defend.groundGain'),
          now: String(ground),
          next: String(ground + 1),
        }}
        cost={{ alloy: bastion.alloy, crystal: bastion.crystal }}
        held={held}
        income={income}
        {...(shipyard < bastion.minShipyard
          ? {
              blocked: {
                reason: t('planet.blocked.shipyard', { level: bastion.minShipyard }),
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
          {/* The instrument's own name comes out of the vocabulary, so it stays
              "Aegis" in English and "Aegis" in Turkish only because that is what
              the Turkish table says — not because it was hard-coded here. */}
          <Trans
            i18nKey="planet.defend.aegisPointer"
            values={{ name: instrumentLabel('AEGIS') }}
            components={[<span key="n" className="text-bone" />]}
          />
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
  const { t } = useTranslation();
  const orbit = useOrbitAction(planet, onFlash);
  const instrument = useInstrumentAction(planet, onFlash);
  const free = planet.orbitSlots - planet.orbit.length;

  return (
    <>
      <Band
        label={t('planet.orbit.inOrbitBand')}
        note={t('planet.orbit.inOrbitNote')}
        aside={
          <SlotPips slots={planet.orbitSlots} used={planet.orbit.length} core={planet.buildings.CORE ?? 0} />
        }
      />

      {SATELLITE_ORDER.map((id) => {
        const name = satelliteLabel(id);
        const action = orbit(id, name, onNeed);
        const role = satelliteRole(id);
        return (
          <div key={id} id={`row-${id}`}>
            <UpgradeRow
              art={SATELLITE_ART[id]}
              name={name}
              tag={satelliteTag(id)}
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
              {...(action.owned
                ? { blocked: { reason: t('planet.orbit.alreadyInOrbit') } satisfies Blocked }
                : {})}
            />
          </div>
        );
      })}

      <Band
        label={t('planet.orbit.onPlanetBand')}
        note={t('planet.orbit.onPlanetNote')}
        aside={
          <span className="num text-[11px] text-faint">
            {free > 0 ? t('planet.orbit.slotsFree', { count: free }) : t('planet.orbit.slotsNone')}
          </span>
        }
      />

      {INSTRUMENT_ORDER.map((id) => {
        const name = instrumentLabel(id);
        const action = instrument(id, name, onNeed);
        const role = instrumentPitch(id, action.level);
        const next = nextInstrumentArt(id, action.level);
        return (
          <div key={id} id={`row-${id}`}>
            <UpgradeRow
              art={instrumentArt(id, Math.max(1, action.level))}
              {...(next ? { nextArt: next } : {})}
              name={name}
              level={action.level}
              tag={instrumentTag(id)}
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
  const { t } = useTranslation();
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
        {t('planet.orbit.slotsUsed', { used, total: slots })}
        {next !== undefined && (
          <span className="text-faint">{t('planet.orbit.slotsNext', { level: next })}</span>
        )}
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
  const { t } = useTranslation();
  const building = useBuildingAction(planet, onFlash);
  const shipyard = building('SHIPYARD', buildingName('SHIPYARD'), onNeed);
  const level = planet.buildings.SHIPYARD ?? 0;

  const hull = (id: HullId) => {
    const hullSpec = HULLS[id];
    const owned = planet.fleet[id] ?? 0;
    return (
      // Wrapped and identified like every building row, so a hull can be scrolled
      // to and pointed at by anything that has to name one.
      <div key={id} id={`row-${id}`}>
      <UpgradeRow
        art={HULL_ART[id]}
        name={hullLabel(id)}
        tag={hullTag(id)}
        stats={{
          atk: hullSpec.atk,
          hp: hullSpec.hp,
          speed: hullSpec.speed,
          cargo: hullSpec.cargo,
        }}
        role={hullPitch(id)}
        gain={{ label: t('planet.reach.ownedGain'), now: String(owned), next: String(owned + 1) }}
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
                reason: t('planet.blocked.shipyard', { level: hullSpec.minShipyard }),
                onFix: () => { onNeed('SHIPYARD'); },
              } satisfies Blocked,
            }
          : {})}
        verb="build"
        onAct={() => { onBuild(id); }}
      />
      </div>
    );
  };

  return (
    <>
      <div id="row-SHIPYARD">
        <UpgradeRow
          art={buildingArt('SHIPYARD', Math.max(1, shipyard.level))}
          nextArt={nextBuildingArt('SHIPYARD', shipyard.level)}
          name={buildingName('SHIPYARD')}
          tag={buildingTag('SHIPYARD')}
          level={shipyard.level}
          role={shipyardRole()}
          onOpen={() => {
            onOpen(
              spec(
                { kind: 'building', id: 'SHIPYARD' },
                buildingName('SHIPYARD'),
                shipyardRole(),
                shipyard,
              ),
            );
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

      <Band label={t('planet.reach.warshipsBand')} note={t('planet.reach.warshipsNote')} />
      {(['WASP', 'LANCE', 'BULWARK'] as const).map(hull)}

      <Band label={t('planet.reach.supportBand')} note={t('planet.reach.supportNote')} />
      {hull('HAULER')}

      <Band label={t('planet.reach.miningBand')} note={t('planet.reach.miningNote')} />
      {hull('PROSPECTOR')}
    </>
  );
}

/**
 * WHAT EACH INSTRUMENT IS FOR, AND WHAT EACH HULL IS FOR, ARE BOTH GONE FROM HERE.
 *
 * They were two tables of prose in this file — `instrumentRole` and `HULL_PITCH` —
 * and prose is language. Both now sit beside the names they belong to, in the
 * vocabulary, reached through `instrumentPitch()` and `hullPitch()`. Nothing about
 * how they are WRITTEN changed: an instrument line is still a pair (what it buys,
 * then what it does not do), because four sentences that all mean "helps you" are
 * one option wearing four hats.
 *
 * They also had to move for the same reason the satellite lines already had: the
 * galaxy and the detail sheet read them too, and a description that lives in a
 * screen drifts from the one in orbit.
 */


function Grow({ planet, held, income, focused, flashed, onFlash, onOpen }: GroupProps) {
  // Nothing under Grow can be blocked by something on another tab: the Core is the
  // ceiling and the other two sit under it. There is no requirement to jump to.
  const noop = () => undefined;
  const building = useBuildingAction(planet, onFlash);
  const core = building('CORE', buildingName('CORE'), noop);
  const refinery = building('REFINERY', buildingName('REFINERY'), noop);
  const extractor = building('EXTRACTOR', buildingName('EXTRACTOR'), noop);
  const capped = cappedCount(planet);

  return (
    <>
      <div id="row-CORE">
        <UpgradeRow
          art={buildingArt('CORE', Math.max(1, core.level))}
          nextArt={nextBuildingArt('CORE', core.level)}
          name={buildingName('CORE')}
          tag={buildingTag('CORE')}
          level={core.level}
          role={coreRole(capped)}
          onOpen={() => {
            onOpen(
              spec({ kind: 'building', id: 'CORE' }, buildingName('CORE'), coreRole(capped), core),
            );
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

      {/*
        WRAPPED AND HIGHLIGHTABLE, like the Core above it.
        These two rows carried no `id`, so `onNeed('REFINERY')` switched to this tab
        and then scrolled to nothing — `document.getElementById('row-REFINERY')` has
        never matched. Two of the five buildings could not be pointed at.
      */}
      <div id="row-REFINERY">
      <UpgradeRow
        art={buildingArt('REFINERY', refinery.level)}
        name={buildingName('REFINERY')}
        tag={buildingTag('REFINERY')}
        level={refinery.level}
        role={refineryRole()}
        onOpen={() => {
          onOpen(
            spec(
              { kind: 'building', id: 'REFINERY' },
              buildingName('REFINERY'),
              refineryRole(),
              refinery,
            ),
          );
        }}
        gain={buildingGain('REFINERY', refinery.level, capped)}
        cost={refinery.cost}
        held={held}
        income={income}
        {...(refinery.blocked ? { blocked: refinery.blocked } : {})}
        verb="raise"
        onAct={refinery.act}
        pending={refinery.pending}
        highlighted={focused === 'REFINERY'}
        flash={flashed === 'REFINERY'}
      />
      </div>

      <div id="row-EXTRACTOR">
      <UpgradeRow
        art={buildingArt('EXTRACTOR', extractor.level)}
        name={buildingName('EXTRACTOR')}
        tag={buildingTag('EXTRACTOR')}
        level={extractor.level}
        role={extractorRole()}
        onOpen={() => {
          onOpen(
            spec(
              { kind: 'building', id: 'EXTRACTOR' },
              buildingName('EXTRACTOR'),
              extractorRole(),
              extractor,
            ),
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
        highlighted={focused === 'EXTRACTOR'}
        flash={flashed === 'EXTRACTOR'}
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
  const { t } = useTranslation();
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
      eyebrow={
        spec.ground ? t('planet.buildSheet.eyebrowGround') : t('planet.buildSheet.eyebrowMobile')
      }
      title={hullLabel(hull)}
      onClose={onClose}
      footer={
        /*
          `data-commit` is this sheet's own commitment, and `data-ready` appears
          only once the count is at the ceiling. The onboarding lights the ceiling
          option first and then moves to here, so the opening grant is spent in one
          press rather than one ship at a time.
        */
        <span data-commit {...(clamped === ceiling ? { 'data-ready': true } : {})}>
        <ActionButton
          verb="build"
          cost={{ alloy: totalAlloy, crystal: totalCrystal }}
          held={held}
          pending={build.isPending}
          full
          label={t('planet.buildSheet.build', { count: clamped })}
          onAct={() => {
            build.mutate(
              { hull, count: clamped },
              {
                onSuccess: () => {
                  say(t('planet.done.built', { count: clamped, name: hullLabel(hull) }));
                  onClose();
                },
                onError: (err) => {
                  say(describe(err), 'error');
                },
              },
            );
          }}
        />
        </span>
      }
    >
      {art && (
        <div className="art-well -mx-4 -mt-4 mb-4 flex justify-center py-4">
          <img src={art} alt={hullLabel(hull)} className="h-28 object-contain" />
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-dim">{hullPitch(hull)}</p>

      <div className="mt-4">
        <StatStrip atk={spec.atk} hp={spec.hp} speed={spec.speed} cargo={spec.cargo} size="card" />
      </div>

      <div className="mt-6">
        <p className="legend mb-2">{t('planet.buildSheet.howMany')}</p>
        {room === 0 ? (
          <p className="text-[13px] leading-relaxed text-amber">
            {t('planet.buildSheet.capped', { count: owned })}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {steps.map((n, i) => (
              <button
                key={`${String(n)}-${String(i)}`}
                type="button"
                // The ceiling, marked. It is the whole of what the opening grant
                // can buy, and the onboarding lights it so nobody spends half a
                // budget that was arithmetic to begin with.
                {...(i === steps.length - 1 ? { 'data-count-max': true } : {})}
                aria-pressed={clamped === n}
                className={`btn flex-1 ${clamped === n ? 'border-crystal/60 text-crystal' : ''}`}
                onClick={() => {
                  setCount(n);
                }}
              >
                {i === steps.length - 1 && steps.length > 1
                  ? t('planet.buildSheet.max', { count: n })
                  : String(n)}
              </button>
            ))}
          </div>
        )}
        {cap !== Number.MAX_SAFE_INTEGER && room > 0 && (
          <p className="mt-2 text-[12px] text-faint">
            {t('planet.buildSheet.heldOfMax', { owned, max: PROSPECTOR.max })}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <Price cost={{ alloy: totalAlloy, crystal: totalCrystal }} held={held} />
        <p className="num text-[12px] text-faint">
          {t('planet.buildSheet.defenceAfter', { count: defenceNow + clamped })}
        </p>
      </div>
    </Sheet>
  );
}
