import { GameActions } from '../session/seasonLock.js';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Unreachable, Waiting } from '../ui/kit/Surface.js';
import {
  ANTI_STRATEGIC,
  FEATURE_FLAGS,
  BUILD,
  COMBAT,
  HULLS,
  DEATH_STAR,
  FAULT,
  FAULT_KINDS,
  PROSPECTOR,
  buildingCost,
  counteredBy,
  counters,
  fleetCount,
  HANGAR,
  groundLoad,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
  hullFuelRate,
  salvageCapacity,
  instrumentCost,
  instrumentMaxed,
  interceptionRange,
  plantCeiling,
  productionMult,
  prospectorCeiling,
  prospectorRoom,
  satelliteSlots,
  satelliteCost,
  interceptorCapacity,
  strategicStockpile,
  fleetEscapeApplies,
  shipDamageApplies,
  type BuildingId,
  type BuildingLevels,
  type HullClass,
  type HullId,
  type InstrumentId,
  type SatelliteId,
  type FaultKind,
  type ResearchProjectId,
} from '@astera/rules';
import { isResearchProject } from '../lib/researchNeed.js';
import {
  usePlanet,
  useBuild,
  useBuildInterceptor,
  useInstallSatellite,
  useRaiseInstrument,
  useUpgrade,
  useBuildDeathStar,
} from '../api/queries.js';
import type { FaultView, PlanetView } from '../api/schemas.js';
import { FaultMark } from '../ui/marks.js';
import { FaultSheet } from './FaultSheet.js';
import { FaultProvider, useFaults } from './faultScope.js';

import type { PlanetGroup } from '../lib/directives.js';
import { compact, decimal, factor, full } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { countdown, duration, untilReady, useNow } from '../lib/time.js';
import { projectedQueueState, type ProjectedQueueState } from '../lib/predict.js';
import { buildShare, deathStarsOf, interceptorsOf } from '../lib/strategic.js';
/** The commander's research ladders, off the payload the screen already holds. */
import { techOf } from '../lib/navigation.js';
/*
  THE CATALOGUE'S BANDS ARE THE ROSTER'S BANDS. Owner instruction.
  Both the order and the membership come from `lib/roster.ts`, which the launch
  picker reads too: the two surfaces ask one question twice, and a player who
  learns the roles here must find them in the same order at the moment the fleet
  actually leaves.
*/
import { FLEET_FAMILY_ORDER, HULLS_BY_FAMILY } from '../lib/roster.js';
import { buildingGain, instrumentGain, productionPaceOf, satelliteGain } from '../lib/gains.js';
import { useProjected, type Projected } from '../lib/projection.js';
import {
  HULL_ART,
  SATELLITE_ART,
  STRATEGIC_ART,
  buildingArt,
  groundArt,
  instrumentArt,
  nextBuildingArt,
  nextGroundArt,
  nextInstrumentArt,
} from '../ui/assets.js';
import {
  INSTRUMENT_NEEDS_UPLINK,
} from '../lib/vocabulary.js';
import i18n from '../i18n/index.js';
import {
  buildingName,
  buildingRole,
  buildingTag,
  combatClassLabel,
  hullLabel,
  hullPitch,
  hullDetail,
  hullTag,
  instrumentLabel,
  instrumentPitch,
  instrumentTag,
  satelliteLabel,
  satelliteRole,
  satelliteTag,
  researchName,
} from '../i18n/names.js';
import { useOrderDuration } from '../ui/Action.js';
import { ItemSheet, type ItemRef } from '../ui/ItemSheet.js';
import { DefenceReadings, PlanetHero } from '../ui/PlanetHero.js';
import { EscapeReadout } from '../ui/EscapeReadout.js';
import { Band, DecisionGroup, UpgradeRow, type Blocked } from '../ui/UpgradeRow.js';
import { ClassChip, CounterCycle } from '../ui/CounterMark.js';
import { orderMinutes } from '../lib/orderTime.js';
import { useAccordion } from '../lib/accordion.js';
import { academyGroup, useAcademyLesson } from '../onboarding/lessonScope.js';
import { describe, useToast } from '../ui/Toast.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Segmented } from '../ui/kit/index.js';
import { affordWait } from '../lib/afford.js';
import { roomParts } from '../lib/room.js';
import { Icon } from '../v2/icons.js';
import { ChargeTally } from '../v2/kit/ChargeTally.js';
import { ClassEmblem } from '../v2/kit/ClassEmblem.js';
import { HoldButton } from '../v2/kit/HoldButton.js';
import { Cost } from '../v2/kit/Cost.js';
import { NeedBar } from '../v2/kit/NeedBar.js';
import { RoomBar } from '../v2/kit/RoomBar.js';
import { Sheet as V2Sheet } from '../v2/kit/Sheet.js';
import { BaseQueues } from '../v2/shell/BaseQueues.js';
import { REPAIR_STATION_ITEM } from '../lib/repairStation.js';
import { RepairStationCard, RepairStationSheet } from './RepairStation.js';
import { ClanSupportBay, DefencePostureCard } from './ClanSupportBay.js';

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
 * This one is five tabs (interface.md I2). The order never changes, because a
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

/** The order the Academy reveals them in: the sequence a planet is actually built in. */
const REVEAL: GroupId[] = ['grow', 'orbit', 'defend', 'reach', 'tactical'];

/** The order on the bar (owner, 2026-09-25): Production · Intel · Defend · Tactical · Fleet. */
const TABS: GroupId[] = ['grow', 'orbit', 'defend', 'tactical', 'reach'];

/** What a lesson has revealed so far, laid out in the bar's order. */
const lessonTabs = (group: GroupId): GroupId[] => {
  const revealed = REVEAL.slice(0, REVEAL.indexOf(group) + 1);
  return TABS.filter((id) => revealed.includes(id));
};

/**
 * FIVE PROBLEMS, EACH NAMED BY THE WORRY IT ANSWERS.
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
  tactical: { problem: 'planet.tabs.tacticalProblem', question: 'planet.tabs.tacticalQuestion' },
} as const satisfies Record<GroupId, { problem: string; question: string }>;

/** Everything the detail sheet needs, gathered where the row already knows it. */
export interface SheetSpec {
  item: ItemRef;
  name: string;
  role: string;
  blocked?: Blocked;
  completed?: string;
  queued?: string;
  pending: boolean;
  act: () => void;
}

export function PlanetScreen({
  focusGroup,
  focusItem,
  onOpenResearch,
}: {
  focusGroup?: GroupId;
  /**
   * ONE ROW, NAMED BY SOMETHING OUTSIDE THIS SCREEN. Koloni arızaları.
   *
   * `focusGroup` gets the reader to the right tab and this gets them to the right line
   * on it. It feeds the same `focused` state a requirement-jump already uses, so the
   * highlight and the scroll are the ones this screen has always done — what is new is
   * only who is allowed to ask for them.
   */
  focusItem?: string;
  /**
   * Take the player to the research surface. T12.
   *
   * The Runner and the Breacher are gated on research, and the refusal offers to
   * go and open it — which `TAB_OF` used to do, because the cards were on this
   * sheet. They are not any more, and a jump that fell through to `'grow'` left
   * the player standing on the Command Core with no idea why.
   */
  onOpenResearch?: (project: ResearchProjectId) => void;
}) {
  const { t } = useTranslation();
  const { data, dataUpdatedAt, isError, refetch } = usePlanet();
  const lesson = useAcademyLesson();
  const held = useProjected(data?.planet, dataUpdatedAt, 5000);
  const [building, setBuilding] = useState<HullId | null>(null);
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [faultSheet, setFaultSheet] = useState<string | null>(null);
  /** The Repair Station's menu (Kalıcı gemi hasarı): a door, not a ladder. */
  const [station, setStation] = useState(false);
  const [tab, setTab] = useState<GroupId | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  // Set for a moment after a purchase lands, so the row can acknowledge it.
  const [flashed, setFlashed] = useState<string | null>(null);

  // The first project opens on the shared season clock. Wake on that exact
  // instant so the row becomes actionable without a poll or a page reload.
  useEffect(() => {
    const isotope = data?.research.find(
      (project) => project.id === 'ISOTOPE_SPECTROMETRY',
    );
    if (!isotope || isotope.discovered || isotope.completed) return;
    const delay = Math.max(0, isotope.availableAt.getTime() - serverNow());
    const id = window.setTimeout(() => {
      void refetch();
    }, Math.min(delay, 2_147_483_647));
    return () => { window.clearTimeout(id); };
  }, [data?.research, refetch]);

  // Private strategic readiness and recovery are both server-authoritative, but
  // their payload already names the exact instant. Wake there even if SSE is late.
  useEffect(() => {
    // A repair's end brings its ships home, so it wakes the screen like any other lane.
    const queueInstants = data?.queues
      ? [...data.queues.CONSTRUCTION, ...data.queues.YARD, ...(data.queues.REPAIR ?? [])].map((order) => order.finishesAt)
      : [];
    const strategicInstants = data
      ? [...deathStarsOf(data), ...interceptorsOf(data)]
        .filter((asset) => asset.status === 'BUILDING' && asset.readyAt !== null)
        .map((asset) => asset.readyAt)
      : [];
    const repairInstants = (data?.faults ?? []).flatMap((fault) =>
      fault.repair === null ? [] : [fault.repair.readyAt]);
    const instants = [
      data?.planet.recoveryUntil,
      data?.planet.empUntil,
      ...strategicInstants,
      ...queueInstants,
      ...repairInstants,
    ]
      .filter((instant): instant is Date => instant instanceof Date)
      .map((instant) => instant.getTime())
      .sort((a, b) => a - b);
    if (instants.length === 0) return;

    let stopped = false;
    let timer: number | null = null;
    let overdueAttempts = 0;
    const arm = (): void => {
      const now = serverNow();
      const overdue = instants.some((instant) => instant <= now);
      const next = instants.find((instant) => instant > now);
      if (!overdue && next === undefined) return;

      // A wake can beat the worker's one-second poll and receive the unchanged
      // active order. Retry overdue state with a bounded backoff instead of
      // leaving a 00:00 queue parked until SSE or a page reload rescues it.
      const delay = overdue
        ? Math.min(1000 * 2 ** overdueAttempts++, 10_000)
        : Math.min(Math.max(0, next! - now) + 50, 2_147_483_647);
      timer = window.setTimeout(() => {
        void refetch();
        if (!stopped) arm();
      }, delay);
    };
    arm();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [data?.deathStars, data?.interceptors, data?.interceptor, data?.faults, data?.planet.recoveryUntil, data?.planet.empUntil, data?.queues, data?.strategic, refetch]);

  useEffect(() => {
    if (!flashed) return;
    const id = setTimeout(() => {
      setFlashed(null);
    }, 800);
    return () => {
      clearTimeout(id);
    };
  }, [flashed]);

  /*
    A CALLER NAMED A ROW, so this screen points at it exactly as a requirement-jump
    does. Owner instruction: the notification takes the reader to the world, the tab AND
    the row — and the third move is this one.

    It writes into `focused` rather than owning a second highlight, so the row it lands
    on looks the same as the row a blocked purchase sends you to. One appearance, one
    fade, one rule.
  */
  useEffect(() => {
    if (focusItem) setFocused(focusItem);
    // The Repair Station is a door: named from outside (the Fleet page's dock count), it opens.
    if (focusItem === REPAIR_STATION_ITEM) setStation(true);
  }, [focusItem]);

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

  /*
    THE SHEET OPENS ON PRODUCTION, ALWAYS. D170, owner instruction:
    *"Menü üretim tab'ı ile açılsın. Şuanda kafasına göre takılıyor."*

    It used to open on `advice` — whatever a recommendation engine judged most
    urgent that minute — which meant the same tap landed on a different tab each
    time and the sheet could not be navigated by habit. Habit is the only thing
    that makes a four-tab sheet cheap to use on a phone, and a screen that guesses
    is a screen that has to be re-read before it can be touched.

    A CALLER THAT NAMES A TAB STILL WINS. `focusGroup` is not the screen guessing;
    it is something else saying where to go — a build row pointed at from the map,
    a queue tapped in the strip — and answering that is the whole point of it.
  */
  const active = lesson ? focusGroup ?? 'grow' : tab ?? focusGroup ?? 'grow';
  const recovering = data.planet.recoveryUntil !== null
    && data.planet.recoveryUntil !== undefined
    && data.planet.recoveryUntil.getTime() > serverNow();
  const empActive = data.planet.empUntil !== null
    && data.planet.empUntil !== undefined
    && data.planet.empUntil.getTime() > serverNow();

  const goToNeed = (id: string): void => {
    // A research project is not on this screen at all. Hand it to the host, which
    // is the only thing that can open the surface it IS on.
    if (isResearchProject(id)) {
      // Named, so the map opens on the project this door asked for (E8).
      onOpenResearch?.(id);
      return;
    }
    const home = TAB_OF[id];
    if (home) setTab(home);
    setFocused(id);
  };

  /*
    WHICH ROW IS BROKEN, KEYED BY THE ID THE ROW ALREADY CARRIES.

    `FAULT_ITEM` is the client's half of the same map the server puts in the
    notification payload, and the two are asserted against each other in the tests. It is
    duplicated rather than derived because the server's copy must travel WITH the
    notification — a client that worked it out locally would be a second table to keep in
    step, and the failure mode (the wrong tab opens) is silent.
  */
  const faults = data.faults ?? [];
  const faultOf = new Map(faults.map((fault) => [FAULT_ITEM[fault.kind], fault]));
  const brokenGroups = [...new Set(
    faults.map((fault) => TAB_OF[FAULT_ITEM[fault.kind]]).filter((id): id is GroupId => !!id),
  )];

  const shared = {
    planet: data,
    /*
      A BROKEN ROW OPENS THE REPAIR, NOT THE UPGRADE. Owner instruction: *"Tıklayınca:
      alttan geliştirme tab'ı degil yeni tasarlayacagın fixle sheeti çıkmalı."* The row
      keeps its name, its price and its art at full strength — what changes is the door.
    */
    faultOf,
    onOpenFault: (id: string) => { setFaultSheet(id); },
    held,
    // What the works actually produce, so a row that cannot be afforded can say
    // when it will be rather than how far along the saving is.
    income: {
      alloyPerHour: data.planet.alloyPerHour,
      crystalPerHour: data.planet.crystalPerHour,
    },
    focused,
    flashed,
    // The thing that unblocks you may live under a different tab. Switching to
    // it is the whole point of the requirement being a button.
    onNeed: goToNeed,
    onFlash: setFlashed,
    /*
      THE DOOR IS DECIDED HERE AND NOWHERE ELSE.

      Every row in this screen already routes its press through one callback carrying the
      subject it is about, so a broken subject can be sent somewhere else without any of
      the fourteen rows knowing the fault system exists. Owner instruction: *"Tıklayınca:
      alttan geliştirme tab'ı degil yeni tasarlayacagın fixle sheeti çıkmalı."*
    */
    onOpen: (next: SheetSpec) => {
      const broken = faultOf.get(next.item.id);
      if (broken) setFaultSheet(broken.id);
      else setSheet(next);
    },
  };

  /*
    THE SECOND DOOR, AND IT IS A SEPARATE ONE BECAUSE A HULL IS NOT AN `ItemRef`.

    `ItemRef` covers buildings, instruments and satellites — the three things with a
    LADDER — and a craft has none, so a hull row opens `BuildSheet` through `onBuild`
    instead. `PROSPECTOR_FAULT` names a craft, which means it is the one fault of the
    eight whose row never passes the interception above: the wash and the mark landed on
    it and the press still opened the forge.
  */
  const openBuild = (hull: HullId): void => {
    const broken = faultOf.get(hull);
    if (broken) setFaultSheet(broken.id);
    else setBuilding(hull);
  };

  return (
    <GameActions>
      <FaultProvider faults={faultOf}>
      {/*
        WHO OWNS THE INSET. The sheet bleeds and this screen pads, block by block,
        because ONE thing here has to run edge to edge: the sticky category bar.
        It used to reach the edges with a `-mx-4` that cancelled a `px-2` the sheet
        had applied and this screen had re-applied — three declarations for one
        sixteen-pixel gutter, and no owner to change when it was wrong.
      */}
      <div className="flex flex-col gap-3 pb-2">
        {/*
          WHAT IS BROKEN LEADS (E5: "arıza ve sadakat bloğu en üstte"). A fault is the
          first thing to do on a world that has one, so it sits above the world itself,
          with the loyalty line the hero opens on right under it.
        */}
        {(data.faults?.length ?? 0) > 0 && (
          <div className="px-2 pt-2">
            <FaultRepairs planet={data} onOpen={(fault) => { setFaultSheet(fault.id); }} />
          </div>
        )}

        {!lesson && <div className="flex flex-col gap-2 px-2 pt-2">
          <PlanetHero planet={data} />
        </div>}

        <div className="flex flex-col gap-2 px-2">
          <BaseQueues planet={data} />
        </div>

        {recovering && (
          <div className="mx-2 rounded-chip border border-v2-hostile/40 bg-v2-hostile/10 px-3 py-2 font-v2-ui text-caption text-v2-hostile">
            {t('planet.recovery', { duration: duration((data.planet.recoveryUntil!.getTime() - serverNow()) / 60_000) })}
          </div>
        )}

        {empActive && (
          <div className="mx-2 rounded-chip border border-v2-hostile/40 bg-v2-hostile/10 px-3 py-2 font-v2-ui text-caption text-v2-hostile">
            {t('planet.empActive', { duration: duration((data.planet.empUntil!.getTime() - serverNow()) / 60_000) })}
          </div>
        )}

        <Tabs
          active={active}
          onSelect={setTab}
          broken={brokenGroups}
        />

        <div className="flex flex-col gap-4 px-2">
          <div
            id={`planet-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`planet-tab-${active}`}
            className={recovering ? 'pointer-events-none opacity-50' : ''}
            aria-disabled={recovering}
          >
            <DecisionGroup problem={t(GROUPS[active].problem)} question={t(GROUPS[active].question)}>
              {active === 'defend' && <Defend {...shared} onBuild={openBuild} />}
              {active === 'orbit' && <Orbit {...shared} />}
              {active === 'reach' && <Reach {...shared} onBuild={openBuild} onStation={() => { setStation(true); }} />}
              {active === 'grow' && <Grow {...shared} />}
              {!lesson && active === 'tactical' && (
                <DeathStarForge planet={data} held={held} recovering={recovering} onNeed={goToNeed} />
              )}
            </DecisionGroup>
          </div>
        </div>

        {faultSheet && faults.some((fault) => fault.id === faultSheet) && (
          <FaultSheet
            fault={faults.find((fault) => fault.id === faultSheet)!}
            planet={data}
            onClose={() => { setFaultSheet(null); }}
          />
        )}

        {sheet && (
          <ItemSheet
            item={sheet.item}
            name={sheet.name}
            role={sheet.role}
            planet={data}
            held={held}
            {...(sheet.blocked ? { blocked: sheet.blocked } : {})}
            {...(sheet.completed ? { completed: sheet.completed } : {})}
            {...(sheet.queued ? { queued: sheet.queued } : {})}
            pending={sheet.pending}
            onAct={sheet.act}
            onClose={() => {
              setSheet(null);
            }}
          />
        )}

        {station && shipDamageApplies(data.rulesetVersion ?? 0) && (
          <RepairStationSheet planet={data} held={held} onClose={() => { setStation(false); }} />
        )}

        {building && (
          // `data-build-sheet` is how the onboarding gate (D56) keeps this surface
          // live: it is opened BY a gated control, so sealing it would trap.
          <div data-build-sheet>
            <BuildSheet
              hull={building}
              planet={data}
              held={held}
              onNeed={(id) => {
                setBuilding(null);
                goToNeed(id);
              }}
              onClose={() => {
                setBuilding(null);
              }}
            />
          </div>
        )}
      </div>
      </FaultProvider>
    </GameActions>
  );
}


/**
 * WHICH ROW EACH FAULT MARKS. The client's half of `FAULT_LOCATION` on the server.
 *
 * THE ITEM IS THE BROKEN HARDWARE, NOT THE AFFECTED ONE. A `CORE_OUTAGE` puts the Aegis
 * out, and it marks the Command Core: the Aegis is working perfectly and saying
 * otherwise would send the player to buy a level that fixes nothing. The Prospector
 * fault marks the craft rather than the Derrick, because a world may have no Derrick.
 *
 * Asserted against the server's copy in `faults.test.tsx`; a drift here opens the wrong
 * tab, which is the kind of failure nothing else would catch.
 */
export const FAULT_ITEM: Record<FaultKind, string> = {
  REFINERY_OUTAGE: 'REFINERY',
  EXTRACTOR_OUTAGE: 'EXTRACTOR',
  PLANT_OUTAGE: 'DEUTERIUM_PLANT',
  VAULT_LEAK: 'VAULT',
  CORE_OUTAGE: 'CORE',
  TELESCOPE_FAULT: 'TELESCOPE',
  SHIPYARD_REVOLT: 'SHIPYARD',
  PROSPECTOR_FAULT: 'PROSPECTOR',
};

/** Which tab a given row lives under, so a requirement can jump to it. */
export const TAB_OF: Record<string, GroupId | undefined> = {
  CORE: 'grow',
  REFINERY: 'grow',
  EXTRACTOR: 'grow',
  VAULT: 'grow',
  TELESCOPE: 'orbit',
  RADAR: 'orbit',
  VEIL: 'orbit',
  AEGIS: 'defend',
  UPLINK: 'orbit',
  FOUNDRY: 'grow',
  DEUTERIUM_PLANT: 'grow',
  DERRICK: 'reach',
  BEACON: 'reach',
  SHIPYARD: 'reach',
  HANGAR: 'reach',
  /*
    THE PROSPECTOR IS A HULL AND IT IS ON `reach` WITH THE REST OF THE YARD.

    It was missing, and nothing had ever asked for it: this table's only readers were a
    blocked purchase and a research requirement, and neither can be blocked on a craft.
    A fault can — `PROSPECTOR_FAULT` names this row — and a missing entry here is the
    silent kind: the notification opens the sheet on Production and the reader is left
    looking for a broken pit among the refineries.
  */
  PROSPECTOR: 'reach',
};

/**
 * Four problems, one at a time.
 *
 * The pip is the recommendation — the same scoring that used to reorder the
 * sections now just points at one. Advice that moves is useful; furniture that
 * moves is not.
 */
/** Two independent commitments, kept visible while the player makes the next one. */
/**
 * ÜÇ ONARIM LANE'İ, AYNI ANDA KOŞAR. Koloni arızaları.
 *
 * Sits directly under `BuildQueues` and wears the same plate, because it is the same
 * kind of thing: work this world has already paid for, with an instant attached. What
 * makes it a separate section rather than a third lane in that one is that these run in
 * PARALLEL and cannot be cancelled, and a queue whose lanes obeyed opposite rules would
 * need a flag on every row.
 *
 * NOTHING BROKEN DRAWS NOTHING. The same lesson `BuildQueues` was corrected on — *"üretim
 * yoksa bile full section açık bom bom duruyor"* — and it matters more here: most
 * sessions on most worlds have no faults at all, and three empty sockets under a heading
 * would be a permanent monument to a system that is not currently doing anything.
 *
 * BROKEN BUT UNATTENDED IS ONE LINE, not three empty sockets either. What the player
 * needs then is the count and the cheapest way in, which is what the row says.
 */
function FaultRepairs({
  planet,
  onOpen,
}: {
  planet: PlanetView;
  onOpen: (fault: FaultView) => void;
}) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const faults = planet.faults ?? [];
  if (faults.length === 0) return null;

  /*
    EVERY FAULT IS A ROW, AND EVERY ROW IS A DOOR. Code review.

    The unattended state used to collapse to one line — "3 waiting · from 300 alloy" — with
    nothing on it to press, so the only way to a broken thing was to hunt through four tabs
    for a marked row. Listing them costs a line each and buys the thing the four questions
    ask for: the player can COMPARE what is broken, and what each costs, on one screen.

    Running crews first, in lane order, because those are the ones with a clock; then what
    is still waiting, in the fixed fault order so a list re-read after a repair does not
    shuffle under the reader's thumb. This is not the empty-section clutter the build queue
    was corrected for: a broken system is never nothing.
  */
  const running = faults
    .filter((fault) => fault.repair !== null)
    .toSorted((a, b) => (a.repair?.slot ?? 0) - (b.repair?.slot ?? 0));
  const waiting = faults
    .filter((fault) => fault.repair === null)
    .toSorted((a, b) => FAULT_KINDS.indexOf(a.kind) - FAULT_KINDS.indexOf(b.kind));

  return (
    <section className="overflow-hidden rounded-control border border-v2-warn/40 bg-v2-panel font-v2-ui" aria-label={t('faults.strip.title')}>
      <header className="flex items-baseline gap-2 border-b border-v2-line px-3 py-2">
        <h2 className="v2-legend flex items-center gap-1 text-v2-warn">
          <FaultMark className="size-[13px]" />
          {t('faults.strip.title')}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-v2-line to-transparent" />
        <span className="font-v2-mono text-micro text-v2-ink-3">
          {t('faults.strip.capacity', { count: FAULT.repairSlots })}
        </span>
      </header>
      <ul className="flex flex-col">
        {running.map((fault) => (
          <li key={fault.id}>
            {/*
              NO CANCEL CONTROL, and its absence is the contract. `QueueStrip` takes an
              optional `onCancel` for exactly this reason and the build queue passes one;
              this lane does not, and neither does commander research.
            */}
            <button
              type="button"
              data-fault-lane="running"
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
              onClick={() => { onOpen(fault); }}
            >
              <span className="v2-legend shrink-0 text-v2-ink-3">
                {t('faults.strip.lane', { slot: (fault.repair?.slot ?? 0) + 1 })}
              </span>
              <span className="min-w-0 flex-1 truncate text-caption text-v2-ink-2">
                {t(`faults.name.${fault.kind}`)}
              </span>
              <span className="shrink-0 font-v2-mono text-caption text-v2-ink">
                {fault.repair ? countdown(fault.repair.readyAt.getTime() - now) : ''}
              </span>
            </button>
          </li>
        ))}
        {waiting.map((fault) => (
          <li key={fault.id}>
            <button
              type="button"
              data-fault-lane="waiting"
              className="flex w-full items-center gap-2 border-t border-v2-line px-3 py-2 text-left first:border-t-0"
              onClick={() => { onOpen(fault); }}
            >
              <span className="min-w-0 flex-1 truncate text-caption text-v2-ink">
                {t(`faults.name.${fault.kind}`)}
              </span>
              <span className="shrink-0 font-v2-mono text-caption text-v2-ink-3">
                {fault.cost.crystal > 0
                  ? t('faults.strip.priceBoth', {
                    alloy: full(fault.cost.alloy),
                    crystal: full(fault.cost.crystal),
                  })
                  : t('faults.strip.priceAlloy', { alloy: full(fault.cost.alloy) })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}


/**
 * THE DEATH STAR FORGE, ON THE TACTICAL TAB (09c0bb5). D3.
 *
 * The weapon's slots as charges (loaded, building, empty), what it does in one line,
 * and — while a slot is free — what the build still needs as doors, its price and its
 * time, and a HOLD to build: a Death Star cannot be cancelled, so it is never a tap (K4).
 * A refused hold says the first thing it needs rather than going dead.
 */
function DeathStarForge({
  planet,
  held,
  recovering,
  onNeed,
}: {
  planet: PlanetView;
  held: Projected;
  recovering: boolean;
  onNeed: (id: string) => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const strategicBuild = useBuildDeathStar();
  const now = useNow(1000);
  const weapons = deathStarsOf(planet);
  const primary = weapons[0];
  // One per world, two with the commander's Stockpile (owner, 2026-10-01).
  const stockpileLevel = researchLevel(planet, 'STRATEGIC_STOCKPILE');
  const stockpile = strategicStockpile(stockpileLevel);
  // A captured pad can hold more than its new owner may build; the tally counts what stands.
  const pad = Math.max(stockpile, weapons.length);
  const readyCount = weapons.filter((asset) => asset.status === 'READY').length;
  const buildingCount = weapons.filter((asset) => asset.status !== 'READY').length;
  const activeBuild = weapons.find((asset) => asset.status === 'BUILDING');
  const progress = activeBuild ? buildShare(activeBuild, DEATH_STAR.buildMinutes, now) : null;
  const core = (planet.buildings.CORE ?? 0) >= DEATH_STAR.requiredCore;
  const yard = (planet.buildings.SHIPYARD ?? 0) >= DEATH_STAR.requiredShipyard;
  const short = {
    alloy: Math.max(0, DEATH_STAR.cost.alloy - held.alloy),
    crystal: Math.max(0, DEATH_STAR.cost.crystal - held.crystal),
    deuterium: Math.max(0, DEATH_STAR.cost.deuterium - held.deuterium),
  };
  const live = weapons.length > 0;
  const room = weapons.length < stockpile;
  const needCore = t('planet.deathStar.needCore', { level: DEATH_STAR.requiredCore });
  const needShipyard = t('planet.deathStar.needShipyard', { level: DEATH_STAR.requiredShipyard });
  const needOperational = t('planet.deathStar.needOperational');
  const refusal = !core
    ? t('planet.deathStar.needs', { need: needCore })
    : !yard
      ? t('planet.deathStar.needs', { need: needShipyard })
      : recovering
        ? t('planet.deathStar.needs', { need: needOperational })
        : shortfall(short, planet);

  return (
    <section
      data-strategic-state={primary?.status ?? 'LOCKED'}
      data-strategic-count={weapons.length}
      data-strategic-capacity={stockpile}
      className={`flex flex-col gap-2.5 rounded-control border border-v2-line bg-v2-panel p-3 font-v2-ui ${FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED ? '' : 'hidden'}`}
    >
      <div className="flex items-start gap-3">
        <img
          src={STRATEGIC_ART.deathStar}
          alt=""
          aria-hidden
          className={`size-[70px] shrink-0 object-contain ${live ? '' : 'opacity-60 grayscale'}`}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2">
            <span className={TACTICAL_HEADING}>{t('planet.deathStar.eyebrow')}</span>
            <ChargeTally
              ready={readyCount}
              loading={buildingCount}
              total={pad}
              label={t('planet.deathStar.tally', { used: weapons.length, total: pad })}
            />
          </p>
          <p className="mt-0.5 text-body font-semibold leading-snug text-v2-ink">
            {primary?.status === 'READY'
              ? t('planet.deathStar.ready')
              : primary?.status === 'PAUSED'
                ? t('planet.deathStar.paused')
                : primary?.status === 'BUILDING'
                  ? t('planet.deathStar.building', {
                    duration: primary.readyAt
                      ? untilReady((primary.readyAt.getTime() - now) / 60_000)
                      : duration((primary.remainingSeconds ?? 0) / 60),
                  })
                  : t('planet.deathStar.none')}
          </p>
          {live && (
            <p className="font-v2-mono text-micro text-v2-ink-3" data-strategic-stock>
              {t('planet.deathStar.stock', {
                ready: readyCount,
                building: buildingCount,
                held: weapons.length,
                capacity: pad,
              })}
            </p>
          )}
          {progress !== null && <ChargeProgress share={progress} mark="data-strategic-progress" />}
          <p className="mt-1 text-caption leading-snug text-v2-ink-2">
            {t(readyCount > 0 ? 'planet.deathStar.readyHint' : 'planet.deathStar.dangerHint', {
              loss: DEATH_STAR.colonyLoyaltyLoss,
            })}
          </p>
        </div>
      </div>

      {!room && stockpileLevel < 1 && (
        <CapacityNext
          project="STRATEGIC_STOCKPILE"
          total={strategicStockpile(1)}
          onOpen={() => { onNeed('STRATEGIC_STOCKPILE'); }}
        />
      )}
      {room && (
        <>
          <ul className="flex flex-wrap gap-1.5">
            <TacticalNeed ok={core} onFix={() => { onNeed('CORE'); }}>{needCore}</TacticalNeed>
            <TacticalNeed ok={yard} onFix={() => { onNeed('SHIPYARD'); }}>{needShipyard}</TacticalNeed>
            <TacticalNeed ok={!recovering}>{needOperational}</TacticalNeed>
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Cost cost={DEATH_STAR.cost} held={held} />
            <span className="flex items-center gap-1 font-v2-mono text-micro text-v2-ink-3">
              <Icon id="i-clock" className="size-3 shrink-0" />
              {t('planet.deathStar.buildTime', { duration: duration(DEATH_STAR.buildMinutes) })}
            </span>
          </div>
          <div data-act>
            <HoldButton
              label={t('planet.deathStar.build')}
              disabledReason={strategicBuild.isPending ? t('planet.deathStar.started') : refusal}
              onCommit={() => {
                strategicBuild.mutate(undefined, {
                  onSuccess: () => { say(t('planet.deathStar.started')); },
                  onError: (error) => { say(describe(error), 'error'); },
                });
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}

const TACTICAL_HEADING = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';

/** The commander's rung of one research project, as this world's view reports it. */
const researchLevel = (planet: PlanetView, id: ResearchProjectId): number =>
  planet.research.find((project) => project.id === id)?.level ?? 0;

/**
 * A FULL PAD, AND THE RESEARCH THAT MAKES IT BIGGER. Owner, 2026-10-01.
 *
 * Said where the limit is met rather than on the research map: the commander who has
 * just filled the pad is the one asking "how do I hold more", and a quiet full panel
 * does not answer it. Neutral rather than warn — nothing is wrong, there is a next step.
 */
function CapacityNext({ project, total, onOpen }: {
  project: ResearchProjectId;
  total: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-capacity-next={project}
      onClick={onOpen}
      className="flex min-h-9 w-full items-center justify-between gap-2 rounded-control border border-v2-line bg-v2-deep/40 px-2.5 text-left text-caption text-v2-ink-2"
    >
      <span>{t('planet.capacityNext', { name: researchName(project), total })}</span>
      <span aria-hidden="true" className="text-v2-ink-3">›</span>
    </button>
  );
}

/** What a purse that cannot pay says in place of the commit: when, or that it cannot tell. */
function shortfall(
  short: { alloy: number; crystal: number; deuterium: number },
  planet: PlanetView,
): string | null {
  if (short.alloy === 0 && short.crystal === 0 && short.deuterium === 0) return null;
  // Deuterium has no rate on this payload, so a fuel shortfall says so rather than when.
  const wait = short.deuterium > 0
    ? null
    : affordWait(short, { alloyPerHour: planet.planet.alloyPerHour, crystalPerHour: planet.planet.crystalPerHour });
  return wait === null ? i18n.t('itemSheet.short') : i18n.t('itemSheet.affordIn', { duration: duration(wait) });
}

/** A build under way, in your colour: never the grey fill round 2 retired. */
function ChargeProgress({ share, mark }: { share: number; mark: 'data-strategic-progress' | 'data-charge-progress' }) {
  return (
    <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-v2-line">
      <span {...{ [mark]: '' }} className="block h-full bg-v2-self" style={{ width: `${String(share)}%` }} />
    </span>
  );
}

/**
 * ONE REQUIREMENT, AS A CHIP. Met reads quiet; unmet is warn — a gap the commander can
 * close, never red (I1) — and where there is somewhere to close it, it is the door.
 */
function TacticalNeed({ ok, onFix, children }: { ok: boolean; onFix?: () => void; children: ReactNode }) {
  const chip = 'flex items-center gap-1 rounded-chip border px-2 py-0.5 text-micro';
  if (ok) {
    return (
      <li data-met="true" className={`${chip} border-v2-line text-v2-ink-2`}>
        <span aria-hidden="true" className="text-v2-self">✓</span>
        {children}
      </li>
    );
  }
  return (
    <li data-met="false" className="flex">
      {onFix ? (
        <button type="button" onClick={onFix} className={`${chip} border-v2-warn/50 font-semibold text-v2-warn`}>
          <span aria-hidden="true">○</span>
          {children} ›
        </button>
      ) : (
        <span className={`${chip} border-v2-warn/50 text-v2-warn`}>
          <span aria-hidden="true">○</span>
          {children}
        </span>
      )}
    </li>
  );
}

/**
 * FIVE TABS, FIXED ORDER, AND NO ADVICE ON THEM. Owner decision.
 *
 * A pip used to mark whichever problem the situation engine ranked highest. It is
 * gone: the screen states what each tab IS and leaves the choosing to the player,
 * rather than carrying a second opinion beside whatever else is on screen.
 *
 * AND THE ENGINE IS GONE WITH IT. D170: it used to choose which tab OPENED, which
 * meant the same tap landed somewhere different each time and the sheet could not
 * be learned. Production opens, always, unless a caller names a tab.
 */
function Tabs({
  active,
  onSelect,
  broken = [],
}: {
  active: GroupId;
  onSelect: (id: GroupId) => void;
  /** Which categories hold something broken. A FACT, never a ranking — see `Segment.mark`. */
  broken?: readonly GroupId[];
}) {
  const { t } = useTranslation();
  const lesson = useAcademyLesson();
  // Opaque, because it is sticky: at 95% the rows scrolling underneath ghosted
  // through the wallet figures, which are the one thing on it a player reads
  // against a price.
  return (
    <>
    <div
      data-category-bar=""
      className="sticky top-0 z-20 border-y border-line-soft bg-deep"
    >
      {/*
        NO WALLET HERE ANY MORE (M5). It rode the categories because the purse was in a
        header BEHIND this sheet; the page now stands under the top bar, which shows the
        purse whole to 99,999, and every price already marks the part the purse cannot
        meet — so a second copy of three numbers was height with no purpose.
      */}
      {/*
        `data-tab` is how a surface outside this screen points at a category: the
        onboarding lights the one a beat is working in, because a dimmed screen
        with one live control still has to say WHERE that control is.
      */}
      <Segmented
        flush
        className="mx-3 my-2"
        marker="tab"
        role="tablist"
        label={t('planet.tabs.label')}
        segments={(lesson ? lessonTabs(academyGroup(lesson)) : TABS).map((id) => ({
          id,
          label: t(GROUPS[id].problem),
          /*
            NO COUNT. The glyph says "something under here has stopped", which is the
            one thing a player cannot find out without opening all four tabs. HOW MANY
            is a question the tab's own contents answer, and a number on the bar would
            turn a fact back into the ranking D170 removed.
          */
          ...(broken.includes(id)
            ? {
              mark: <FaultMark className="size-[13px] text-bone" />,
              // The glyph is `aria-hidden`; without this the mark is silent to a reader.
              hint: `${t(GROUPS[id].problem)} — ${t('faults.tab')}`,
            }
            : {}),
        }))}
        value={active}
        onSelect={onSelect}
        tabId={(id) => `planet-tab-${id}`}
        panelId={(id) => `planet-panel-${id}`}
      />
    </div>
    </>
  );
}

/* ── shared plumbing ────────────────────────────────────────── */

interface GroupProps {
  planet: PlanetView;
  held: { alloy: number; crystal: number; deuterium: number };
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
  action: {
    blocked?: Blocked;
    completed?: string;
    queued?: string;
    pending: boolean;
    act: () => void;
  },
): SheetSpec => ({
  item,
  name,
  role,
  ...(action.blocked ? { blocked: action.blocked } : {}),
  ...(action.completed ? { completed: action.completed } : {}),
  ...(action.queued ? { queued: action.queued } : {}),
  pending: action.pending,
  act: action.act,
});

const cappedCountOf = (levels: BuildingLevels): number =>
  (['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'] as const).filter(
    (id) => levels[id] >= levels.CORE,
  ).length;

function useBuildingAction(planet: PlanetView, onFlash: (id: string) => void) {
  const upgrade = useUpgrade();
  const say = useToast();
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const core = projected.buildings.CORE;
  const orders = planet.queues?.CONSTRUCTION ?? [];

  return (id: BuildingId, name: string, onNeed: (row: string) => void) => {
    const level = planet.buildings[id] ?? 0;
    const nextLevel = projected.buildings[id];
    const cost = buildingCost(id, nextLevel);
    const queuedCount = orders.filter(
      (order) => order.kind === 'BUILDING' && order.subject === id,
    ).length;
    const queued = queuedCount > 0
      ? i18n.t('planet.queue.queued', { count: queuedCount })
      : undefined;
    /*
      THE SECOND CEILING, AND ONLY ONE BUILDING HAS ONE. T5.

      A Deuterium Refinery may not pass its research rung — three levels per rung of
      Deuterium Synthesis — and `build.ts` refuses with `RESEARCH_CEILING`. The row
      had no sentence for it, which at rung zero means the card offered the building
      that the entire fuel economy runs on and the server refused every press.

      Read off the PROJECTED rung, like the server: a research order already ahead in
      this same queue counts.
    */
    // `nextLevel` is the PROJECTED CURRENT level, which is exactly what `build.ts`
    // compares — `level >= ceiling` there and here, so the two cannot drift.
    const plantCapped = id === 'DEUTERIUM_PLANT'
      && nextLevel >= plantCeiling(projected.research.get('DEUTERIUM_SYNTHESIS') ?? 0);
    /*
      THE HANGAR'S RUNGS OPEN AT THE CORE'S TIER CHANGES — 4, 7, 10, 13, 16 — not one
      per Core level, so the generic "Core L{{core + 1}}" would send a Core-5
      commander to raise a Core 6 that buys them nothing. Maxed first, as the
      instruments do: a ladder that is over offers no way past it.
    */
    const hangarMaxed = id === 'HANGAR' && nextLevel >= HANGAR.maxLevel;
    /*
      THE HANGAR ASKS NOTHING OF THE CORE ANY MORE. Owner decision, 2026-09-22 — a fleet-path
      commander must be able to buy room without being pushed up the tier band for it. Every other
      building still may not exceed the Core.
    */
    const coreGate = id === 'HANGAR' || id === 'CORE'
      ? null
      : nextLevel >= core ? core + 1 : null;
    const prerequisites = [
      ...(coreGate === null ? [] : [i18n.t('planet.blocked.core', { level: coreGate })]),
      ...(plantCapped ? [i18n.t('planet.blocked.plantRung')] : []),
    ];
    const blocked: Blocked | undefined = hangarMaxed
      ? { reason: i18n.t('planet.blocked.maxed') }
      : prerequisites.length > 0
        ? {
          reason: i18n.t('planet.blocked.requirements', { requirements: prerequisites.join(' · ') }),
          onFix: () => { onNeed(coreGate !== null ? 'CORE' : 'DEUTERIUM_SYNTHESIS'); },
        }
        : orders.length >= BUILD.queueDepth
          ? { reason: i18n.t('planet.blocked.queueFull') }
          : undefined;

    return {
      level,
      actionLevel: nextLevel,
      projectedLevels: projected.buildings,
      cost,
      blocked,
      queued,
      pending: upgrade.isPending,
      act: () => {
        upgrade.mutate(id, {
          onSuccess: (r) => {
            onFlash(id);
            say(i18n.t('planet.done.queued', { name, level: r.level }));
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
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const core = projected.buildings.CORE;
  const uplink = projected.effectiveOrbit.includes('UPLINK');
  const orders = planet.queues?.CONSTRUCTION ?? [];

  return (id: InstrumentId, name: string, onNeed: (row: string) => void) => {
    const level = planet.instruments[id] ?? 0;
    const nextLevel = projected.instruments[id] ?? level;
    // Server-priced, for the same reason buildings are: the endpoint is the
    // authority and a screen quoting its own arithmetic can offer a purchase that
    // will be refused.
    const cost = instrumentCost(id, nextLevel);
    const queuedCount = orders.filter(
      (order) => order.kind === 'INSTRUMENT' && order.subject === id,
    ).length;
    const queued = queuedCount > 0
      ? i18n.t('planet.queue.queued', { count: queuedCount })
      : undefined;

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
    const completed = instrumentMaxed(id, nextLevel)
      ? i18n.t('planet.blocked.maxed')
      : undefined;
    const needsCore = nextLevel >= core;
    const prerequisites = [
      ...(needsUplink ? [i18n.t('planet.blocked.uplink')] : []),
      ...(needsCore ? [i18n.t('planet.blocked.core', { level: core + 1 })] : []),
    ];
    const blocked: Blocked | undefined = completed
      ? undefined
      : prerequisites.length > 0
        ? {
          reason: i18n.t('planet.blocked.requirements', { requirements: prerequisites.join(' · ') }),
          onFix: () => { onNeed(needsUplink ? 'UPLINK' : 'CORE'); },
        }
        : orders.length >= BUILD.queueDepth
          ? { reason: i18n.t('planet.blocked.queueFull') }
          : undefined;

    return {
      level,
      actionLevel: nextLevel,
      cost,
      blocked,
      ...(completed ? { completed } : {}),
      queued,
      pending: raise.isPending,
      act: () => {
        raise.mutate(id, {
          onSuccess: (r) => {
            onFlash(id);
            say(i18n.t('planet.done.queued', { name, level: r.level }));
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
 * Command Core opens them at L1, L9, L15 and L18. So the refusal here is not "you
 * cannot have this", it is "not while those are up there", and it points at the
 * Core because raising it is the thing that actually fixes it.
 */
function useOrbitAction(planet: PlanetView, onFlash: (id: string) => void) {
  const install = useInstallSatellite();
  const say = useToast();
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const free = Math.max(0, satelliteSlots(projected.buildings.CORE) - projected.orbit.length);
  const orders = planet.queues?.CONSTRUCTION ?? [];

  return (id: SatelliteId, name: string, onNeed: (row: string) => void) => {
    const owned = planet.orbit.includes(id);
    const queued = orders.some(
      (order) => order.kind === 'SATELLITE' && order.subject === id,
    )
      ? i18n.t('planet.queue.queued', { count: 1 })
      : undefined;
    const cost = planet.satelliteCosts[id] ?? satelliteCost(id);

    const blocked: Blocked | undefined =
      !owned && free <= 0
        ? { reason: i18n.t('planet.blocked.orbitSlot'), onFix: () => { onNeed('CORE'); } }
        : orders.length >= BUILD.queueDepth
          ? { reason: i18n.t('planet.blocked.queueFull') }
          : undefined;

    return {
      owned,
      cost,
      blocked,
      ...(owned ? { completed: i18n.t('planet.orbit.alreadyInOrbit') } : {}),
      queued,
      pending: install.isPending,
      act: () => {
        install.mutate(id, {
          onSuccess: () => {
            onFlash(id);
            say(i18n.t('planet.done.queuedSimple', { name }));
          },
          onError: (err) => { say(describe(err), 'error'); },
        });
      },
    };
  };
}

type OrbitAction = ReturnType<ReturnType<typeof useOrbitAction>>;
type InstrumentAction = ReturnType<ReturnType<typeof useInstrumentAction>>;

function SatelliteItemRow({
  id,
  planet,
  action,
  held,
  income,
  focused,
  flashed,
  onOpen,
}: {
  id: SatelliteId;
  planet: PlanetView;
  action: OrbitAction;
  held: GroupProps['held'];
  income: GroupProps['income'];
  focused: string | null;
  flashed: string | null;
  onOpen: GroupProps['onOpen'];
}) {
  const faults = useFaults();
  const { t } = useTranslation();
  const name = satelliteLabel(id);
  const role = satelliteRole(id);
  const inactive = planet.orbit.includes(id)
    && !(planet.effectiveOrbit ?? planet.orbit).includes(id);
  return (
    <div id={`row-${id}`}>
      <UpgradeRow
        layout="card"
        faulty={!!faults.get(id)}
        art={SATELLITE_ART[id]}
        name={name}
        tag={satelliteTag(id)}
        role={role}
        onOpen={() => { onOpen(spec({ kind: 'satellite', id }, name, role, action)); }}
        gain={satelliteGain(id)}
        cost={action.cost}
        held={held}
        income={income}
        takes={orderMinutes('SATELLITE', action.cost, planet, 1, { satellite: id })}
        unowned={!action.owned}
        {...(inactive ? { inactive: t('planet.orbit.inactiveSatellite') } : {})}
        {...(action.blocked ? { blocked: action.blocked } : {})}
        verb="install"
        onAct={action.act}
        pending={action.pending}
        highlighted={focused === id}
        flash={flashed === id}
        {...(action.completed ? { completed: action.completed } : {})}
        {...(action.queued ? { queued: action.queued } : {})}
      />
    </div>
  );
}

function InstrumentItemRow({
  id,
  planet,
  action,
  held,
  income,
  focused,
  flashed,
  onOpen,
}: {
  id: InstrumentId;
  planet: PlanetView;
  action: InstrumentAction;
  held: GroupProps['held'];
  income: GroupProps['income'];
  focused: string | null;
  flashed: string | null;
  onOpen: GroupProps['onOpen'];
}) {
  const faults = useFaults();
  const { t } = useTranslation();
  const name = instrumentLabel(id);
  const role = instrumentPitch(id, action.level);
  const next = nextInstrumentArt(id, action.actionLevel);
  const effectiveLevel = planet.effectiveInstruments?.[id] ?? action.level;
  const inactive = action.level > effectiveLevel;
  const inactiveReason = (id === 'TELESCOPE' || id === 'RADAR')
    && !(planet.effectiveOrbit ?? planet.orbit).includes('UPLINK')
    ? t('planet.orbit.inactiveUplink', { owned: action.level })
    : t('planet.orbit.inactiveCore', { owned: action.level, active: effectiveLevel });
  return (
    <div id={`row-${id}`}>
      <UpgradeRow
        layout="card"
        faulty={!!faults.get(id)}
        art={instrumentArt(id, Math.max(1, action.level))}
        {...(next ? { nextArt: next } : {})}
        name={name}
        level={action.level}
        tag={instrumentTag(id)}
        role={role}
        onOpen={() => { onOpen(spec({ kind: 'instrument', id }, name, role, action)); }}
        gain={instrumentGain(id, action.actionLevel)}
        cost={action.cost}
        held={held}
        income={income}
        takes={orderMinutes('INSTRUMENT', action.cost, planet)}
        unowned={action.level === 0}
        {...(inactive ? { inactive: inactiveReason } : {})}
        {...(action.blocked ? { blocked: action.blocked } : {})}
        {...(action.completed ? { completed: action.completed } : {})}
        {...(action.queued ? { queued: action.queued } : {})}
        queuedActionable
        verb={action.actionLevel === 0 ? 'install' : 'raise'}
        onAct={action.act}
        pending={action.pending}
        highlighted={focused === id}
        flash={flashed === id}
      />
    </div>
  );
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
  const faults = useFaults();
  const { t } = useTranslation();
  const lesson = useAcademyLesson();
  const instrument = useInstrumentAction(planet, onFlash);
  const aegis = instrument('AEGIS', instrumentLabel('AEGIS'), onNeed);
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const bastion = HULLS.BASTION;
  const harpoon = HULLS.HARPOON;
  const thorn = HULLS.THORN;
  const yardOrders = planet.queues?.YARD ?? [];
  const queuedThorns = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'THORN')
    .reduce((sum, order) => sum + order.count, 0);
  const queuedBastions = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'BASTION')
    .reduce((sum, order) => sum + order.count, 0);
  const queuedHarpoons = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'HARPOON')
    .reduce((sum, order) => sum + order.count, 0);
  const ground = fleetCount(planet.ground);
  /**
   * How many guns of each kind are on the plate.
   *
   * The art tier is read off these rather than off a level, because a ground gun
   * has no level — a battery's only ladder is how many barrels are in it, and
   * `groundArt` renders exactly that.
   */
  const thornsStanding = planet.ground.THORN ?? 0;
  const harpoonsStanding = planet.ground.HARPOON ?? 0;
  const bastionsStanding = planet.ground.BASTION ?? 0;
  // Taktik geri çekilme: stated on this tab only in a season dealt the rule.
  const escapeRuled = fleetEscapeApplies(planet.rulesetVersion ?? 0);

  return (
    <>
      {/* What stands here and what a raid could take: the tab's question, answered first (E5). */}
      {!lesson && <DefenceReadings planet={planet} />}
      {escapeRuled && (
        <EscapeReadout fleet={planet.fleet} ground={planet.ground} deuterium={planet.planet.deuterium}
          rulesetVersion={planet.rulesetVersion ?? 0} posture={planet.defencePosture?.posture} />
      )}

      <Band label={t('planet.defend.shieldBand')} note={t('planet.defend.shieldNote')} />
      <div className="grid grid-cols-2 gap-2">
        <InstrumentItemRow
          id="AEGIS"
          planet={planet}
          action={aegis}
          held={held}
          income={income}
          focused={focused}
          flashed={flashed}
          onOpen={onOpen}
        />
      </div>

      {/*
        THREE GUNS COMPLETE THE COUNTER TRIANGLE.

        A defender used to have no composition choice at all — one ground hull meant
        "how much" was the whole decision. These three span every combat class, so what a
        planet is strong AGAINST is now a choice, and it is the choice an attacker
        has to scout to discover.
      */}
      <Band label={t('planet.defend.groundBand')} note={t('planet.defend.groundNote')} />
      {/*
        THE GROUND IS A ROOM HERE, NOT A PURCHASE. Owner instruction: the "one
        takes" block belongs on the craft sheet, where a hull is actually being
        chosen. On a band nobody is shopping — the question is how big this
        world's battery may be and how much of it is spoken for — so the card
        drops the block and the per-hull count and states its space as space.
      */}
      <GroundRoom planet={planet} />

      <div className="grid grid-cols-2 gap-2">
      <div id="row-THORN">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('THORN')}
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
          takes={orderMinutes('DEFENCE', { ...thorn, deuterium: 0 }, planet, 1, { hull: 'THORN' })}
          unowned={thornsStanding === 0}
          onOpen={() => { onBuild('THORN'); }}
          verb="build"
          onAct={() => { onBuild('THORN'); }}
          {...(yardOrders.length >= BUILD.queueDepth
            ? { blocked: { reason: t('planet.blocked.queueFull') } satisfies Blocked }
            : {})}
          {...(queuedThorns > 0
            ? { queued: t('planet.queue.unitsQueued', { count: queuedThorns }) }
            : {})}
          queuedActionable
        />
      </div>

      <div id="row-HARPOON">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('HARPOON')}
          art={groundArt('HARPOON', Math.max(1, harpoonsStanding))}
          nextArt={nextGroundArt('HARPOON', harpoonsStanding)}
          name={hullLabel('HARPOON')}
          tag={hullTag('HARPOON')}
          stats={{ atk: harpoon.atk, hp: harpoon.hp, speed: harpoon.speed, cargo: harpoon.cargo }}
          role={harpoonsStanding === 0
            ? t('planet.defend.harpoonNone')
            : t('planet.defend.harpoonStanding', { count: harpoonsStanding })}
          gain={{ label: t('planet.defend.harpoonGain'), now: String(harpoonsStanding), next: String(harpoonsStanding + 1) }}
          cost={{ alloy: harpoon.alloy, crystal: harpoon.crystal }}
          held={held}
          income={income}
          takes={orderMinutes('DEFENCE', { ...harpoon, deuterium: 0 }, planet, 1, { hull: 'HARPOON' })}
          unowned={harpoonsStanding === 0}
          onOpen={() => { onBuild('HARPOON'); }}
          {...(shipyard < harpoon.minShipyard
            ? { blocked: {
              reason: t('planet.blocked.shipyard', { level: harpoon.minShipyard }),
              onFix: () => { onNeed('SHIPYARD'); },
            } satisfies Blocked }
            : yardOrders.length >= BUILD.queueDepth
              ? { blocked: { reason: t('planet.blocked.queueFull') } satisfies Blocked }
              : {})}
          {...(queuedHarpoons > 0 ? { queued: t('planet.queue.unitsQueued', { count: queuedHarpoons }) } : {})}
          queuedActionable
          verb="build"
          onAct={() => { onBuild('HARPOON'); }}
        />
      </div>

      <div id="row-BASTION">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('BASTION')}
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
          takes={orderMinutes('DEFENCE', { ...bastion, deuterium: 0 }, planet, 1, { hull: 'BASTION' })}
          unowned={bastionsStanding === 0}
          onOpen={() => { onBuild('BASTION'); }}
          {...(shipyard < bastion.minShipyard
            ? {
              blocked: {
                reason: t('planet.blocked.shipyard', { level: bastion.minShipyard }),
                onFix: () => { onNeed('SHIPYARD'); },
              } satisfies Blocked,
            }
            : yardOrders.length >= BUILD.queueDepth
              ? {
                blocked: { reason: t('planet.blocked.queueFull') } satisfies Blocked,
              }
              : {})}
          {...(queuedBastions > 0
            ? { queued: t('planet.queue.unitsQueued', { count: queuedBastions }) }
            : {})}
          queuedActionable
          verb="build"
          onAct={() => { onBuild('BASTION'); }}
        />
      </div>
      </div>

      {/* <Band
        label={t('planet.defend.strategicBand')}
        note={t('planet.defend.strategicNote')}
      /> */}
      {!lesson && <InterceptorBattery planet={planet} held={held} onNeed={onNeed} />}
    </>
  );
}

/**
 * ONE CHARGE, AND THE ONLY THING IN THE GAME THAT STOPS A DEATH STAR. T10 · T12.
 *
 * ON DEFEND, NOT ON REACH. The forge is on the fleet tab because building a
 * strategic weapon is an offensive project; this is hardware that stands on your
 * own world and fires along your own radar circle, so it belongs where the Aegis
 * and the ground guns are. A player looking for "what stops one of those" looks
 * here.
 *
 * IT READS `interceptor` AND NOT `strategic`. Those were one field until T12 —
 * both kinds of asset came back under one key, newest first — so a charge started
 * after a Death Star reported itself as the weapon. Two keys, and neither is
 * inferred from the other.
 *
 * THE RADAR RUNG IS THE EFFECTIVE ONE. An Uplink gates the Radar, so a Radar 5
 * with none has a reach of zero and draws no circle at all — the handler that
 * fires reads exactly that effective figure, and `buildInterceptor` refuses on it.
 * Checking the installed level here would sell a charge that could never go off,
 * which is the one failure its owner could never diagnose.
 */
function InterceptorBattery({
  planet,
  held,
  onNeed,
}: {
  planet: PlanetView;
  held: { alloy: number; crystal: number; deuterium: number };
  onNeed: (id: string) => void;
}) {
  const { t } = useTranslation();
  const load = useBuildInterceptor();
  const say = useToast();
  const now = useNow(1000);
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const charges = interceptorsOf(planet);
  const charge = charges[0] ?? null;
  const loaded = charges.filter((asset) => asset.status === 'READY').length;
  const loading = charges.find((asset) => asset.status !== 'READY');
  // Two per world, four with the commander's Grid (owner, 2026-10-01).
  const gridLevel = researchLevel(planet, 'INTERCEPTION_GRID');
  const capacity = interceptorCapacity(gridLevel);
  const pad = Math.max(capacity, charges.length);
  const room = charges.length < capacity;
  const uplink = projected.effectiveOrbit.includes('UPLINK');
  const radar = uplink
    ? Math.min(projected.instruments.RADAR ?? 0, projected.buildings.CORE)
    : 0;
  const radarLevelMet = (projected.instruments.RADAR ?? 0) >= ANTI_STRATEGIC.requiredRadar;
  const radarReady = interceptionRange(radar) > 0;
  const recovering = planet.planet.recoveryUntil !== null
    && planet.planet.recoveryUntil !== undefined
    && planet.planet.recoveryUntil.getTime() > serverNow();
  const short = {
    alloy: Math.max(0, ANTI_STRATEGIC.cost.alloy - held.alloy),
    crystal: Math.max(0, ANTI_STRATEGIC.cost.crystal - held.crystal),
    deuterium: Math.max(0, ANTI_STRATEGIC.cost.deuterium - held.deuterium),
  };
  const noRadarProtection = charge?.status === 'READY' && !radarReady;
  const state = noRadarProtection
    ? 'NO_RADAR'
    : charge
      ? charge.status
      : radarReady
        ? 'AVAILABLE'
        : 'LOCKED';
  const needUplink = t('planet.interceptor.needUplink');
  const needRadar = t('planet.interceptor.needRadar', { level: ANTI_STRATEGIC.requiredRadar });
  const needOperational = t('planet.interceptor.needOperational');
  // The effective rung is what fires (see above), so an Uplink missing is named first.
  const refusal = !uplink
    ? t('planet.deathStar.needs', { need: needUplink })
    : !radarReady
      ? t('planet.deathStar.needs', { need: needRadar })
      : recovering
        ? t('planet.deathStar.needs', { need: needOperational })
        : shortfall(short, planet);
  const needs = (
    <ul className="flex flex-wrap gap-1.5">
      <TacticalNeed ok={uplink} onFix={() => { onNeed('UPLINK'); }}>{needUplink}</TacticalNeed>
      <TacticalNeed ok={radarLevelMet} onFix={() => { onNeed('RADAR'); }}>{needRadar}</TacticalNeed>
      {room && !noRadarProtection && <TacticalNeed ok={!recovering}>{needOperational}</TacticalNeed>}
    </ul>
  );

  return (
    <section
      data-interceptor-state={state}
      className={`flex flex-col gap-2.5 rounded-control border border-v2-line bg-v2-panel p-3 font-v2-ui ${FEATURE_FLAGS.STRATEGIC_CRAFTING_ENABLED ? '' : 'hidden'}`}
    >
      <div className="flex items-start gap-3">
        <img
          data-interceptor-art
          src={STRATEGIC_ART.interceptor}
          alt=""
          aria-hidden
          className={`size-[70px] shrink-0 object-contain ${charges.length > 0 ? '' : 'opacity-60 grayscale'}`}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2">
            <span className={TACTICAL_HEADING}>{t('planet.interceptor.eyebrow')}</span>
            <ChargeTally
              ready={loaded}
              loading={charges.length - loaded}
              total={pad}
              label={t('planet.interceptor.tally', { used: charges.length, total: pad })}
            />
          </p>
          <p className="mt-0.5 text-body font-semibold leading-snug text-v2-ink">
            {noRadarProtection
              ? t('planet.interceptor.noRadar')
              : charge?.status === 'READY'
                ? t('planet.interceptor.ready', { count: loaded })
                : charge?.status === 'PAUSED'
                  ? t('planet.interceptor.paused')
                  : charge?.status === 'BUILDING'
                    ? t('planet.interceptor.building', {
                      duration: charge.readyAt
                        ? untilReady((charge.readyAt.getTime() - now) / 60_000)
                        : duration((charge.remainingSeconds ?? 0) / 60),
                    })
                    : t('planet.interceptor.none')}
          </p>
          {loading && (
            <ChargeProgress share={buildShare(loading, ANTI_STRATEGIC.buildMinutes, now)} mark="data-charge-progress" />
          )}
          <p className="mt-1 text-caption leading-snug text-v2-ink-2">
            {t(noRadarProtection
              ? 'planet.interceptor.noRadarHint'
              : charge?.status === 'READY'
                ? 'planet.interceptor.readyHint'
                : 'planet.interceptor.hint')}
          </p>
          {/* Why a colony wants one: what every weapon that gets through costs it. */}
          {planet.planet.kind === 'COLONY' && (
            <p data-interceptor-colony className="mt-1 text-micro leading-snug text-v2-ink-3">
              {t('planet.interceptor.colonyHint', { loss: DEATH_STAR.colonyLoyaltyLoss })}
            </p>
          )}
        </div>
      </div>

      {/*
        THE REQUIREMENTS STAY ON SCREEN UNTIL A CHARGE EXISTS, and each is a door
        rather than an alarm: the Uplink and the Radar both point at the row that
        would close them. A loaded charge whose ring went dark shows them again.
      */}
      {!room && gridLevel < 1 && (
        <CapacityNext
          project="INTERCEPTION_GRID"
          total={interceptorCapacity(1)}
          onOpen={() => { onNeed('INTERCEPTION_GRID'); }}
        />
      )}
      {room && !noRadarProtection && (
        <>
          {needs}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Cost cost={ANTI_STRATEGIC.cost} held={held} />
            <span className="flex items-center gap-1 font-v2-mono text-micro text-v2-ink-3">
              <Icon id="i-clock" className="size-3 shrink-0" />
              {t('planet.interceptor.buildTime', { duration: duration(ANTI_STRATEGIC.buildMinutes) })}
            </span>
          </div>
          <span data-act className="block">
            <button
              type="button"
              disabled={refusal !== null || load.isPending}
              onClick={() => {
                load.mutate(undefined, {
                  onSuccess: () => { say(t('planet.interceptor.started')); },
                  onError: (error) => { say(describe(error), 'error'); },
                });
              }}
              className="min-h-10 w-full rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-2"
            >
              {refusal ?? (charges.length > 0 ? t('planet.interceptor.buildSecond') : t('planet.interceptor.build'))}
            </button>
          </span>
        </>
      )}
      {charge !== null && !radarReady && needs}
    </section>
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

  return (
    <>
      <Band
        label={t('planet.orbit.networkBand')}
        note={t('planet.orbit.networkNote')}
      />
      <div className="grid grid-cols-2 gap-2">
        <SatelliteItemRow
          id="UPLINK"
          planet={planet}
          action={orbit('UPLINK', satelliteLabel('UPLINK'), onNeed)}
          held={held}
          income={income}
          focused={focused}
          flashed={flashed}
          onOpen={onOpen}
        />
      </div>

      <Band
        label={t('planet.orbit.intelBand')}
        note={t('planet.orbit.intelNote')}
      />

      <div className="grid grid-cols-2 gap-2">
        {(['TELESCOPE', 'RADAR', 'VEIL'] as const).map((id) => (
          <InstrumentItemRow
            key={id}
            id={id}
            planet={planet}
            action={instrument(id, instrumentLabel(id), onNeed)}
            held={held}
            income={income}
            focused={focused}
            flashed={flashed}
            onOpen={onOpen}
          />
        ))}
      </div>
    </>
  );
}

const RESEARCH_RUNG = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

/** Every catalog gate for a hull, with the first one retained as the fix target. */
function hullAccessBlock(
  id: HullId,
  shipyard: number,
  state: ProjectedQueueState,
  onNeed: (id: string) => void,
): Blocked | undefined {
  const missing = HULLS[id].requiredResearch.filter(
    ({ project, level }) => (state.research.get(project) ?? 0) < level,
  );
  const minimum = HULLS[id].minShipyard;
  const needsShipyard = shipyard < minimum;
  if (!needsShipyard && missing.length === 0) return undefined;
  const requirements = [
    ...(needsShipyard ? [i18n.t('planet.blocked.shipyard', { level: minimum })] : []),
    ...missing.map(({ project, level }) => i18n.t('planet.blocked.research', {
      research: researchName(project),
      level: RESEARCH_RUNG[level] ?? `L${String(level)}`,
    })),
  ];
  return {
    reason: i18n.t('planet.blocked.requirements', { requirements: requirements.join(' · ') }),
    onFix: () => { onNeed(needsShipyard ? 'SHIPYARD' : missing[0]!.project); },
  };
}

/**
 * WHAT YOU CAN SEND — SORTED BY WHAT IT DOES, NOT BY WHAT IT COSTS.
 *
 * The Prospector used to head this list, so the first card under "what can you
 * send" was a craft that never fights and cannot be aimed at a planet at all. A
 * player reading top to bottom learnt the wrong thing about the tab before they
 * reached anything that could raid.
 *
 * Fleet V2 uses four authored families. Rows stay tier-ascending inside each
 * family, so the player can compare the cheap expression of a tactic with the
 * researched version without losing the counter class beneath it.
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
  onStation,
}: GroupProps & { onBuild: (hull: HullId) => void; onStation: () => void }) {
  const faults = useFaults();
  const { t } = useTranslation();
  /**
   * WHICH HULL FAMILIES ARE SHOWING THEIR ROWS.
   *
   * Offensive is the seed because it is first in `FLEET_FAMILY_ORDER` and is what a
   * commander opens the tab for; the rest arrive shut with their counts on them.
   *
   * A SET, so opening one never shuts another. An accordion that allows a single
   * open group would make the one comparison this screen exists for — a Skirmisher
   * against the Bulwark that beats it — impossible without scrolling between two
   * taps, which is the interaction cost the fold was supposed to remove.
   */
  // `slice(0, 1)` rather than `[FLEET_FAMILY_ORDER[0]]`: the order is the single
  // statement of which band leads, and an index read is `| undefined` here.
  const families = useAccordion('fleet', FLEET_FAMILY_ORDER.slice(0, 1));
  const lesson = useAcademyLesson();
  const building = useBuildingAction(planet, onFlash);
  const orbit = useOrbitAction(planet, onFlash);
  const shipyard = building('SHIPYARD', buildingName('SHIPYARD'), onNeed);
  const hangar = building('HANGAR', buildingName('HANGAR'), onNeed);
  const level = planet.buildings.SHIPYARD ?? 0;
  const yardOrders = planet.queues?.YARD ?? [];
  const yardProjection = projectedQueueState(planet, 'YARD');
  /** The commander's own ladders — what the Prospector berth count is bought with. */
  const tech = techOf(planet);
  const groundTotal = planet.capacity?.ground ?? groundSlots(planet.buildings.CORE ?? 0);
  const groundUsed = groundLoad(yardProjection.units);
  const hangarTotal = planet.capacity?.hangar ?? hangarCapacity(planet.buildings.HANGAR ?? 0);
  const hangarUsed = hangarLoad(yardProjection.units);
  const hull = (id: HullId) => {
    const hullSpec = HULLS[id];
    const home = (planet.fleet[id] ?? 0) + (planet.ground[id] ?? 0);
    const away = planet.fleetAway[id] ?? 0;
    // "You have" is ownership, not readiness. A craft in flight is still owned,
    // and for the Prospector that distinction is also the hard build cap.
    const owned = home + away;
    const committed = yardProjection.units[id] ?? owned;
    /*
      THE BERTH COUNT IS THE COMMANDER'S, NOT THE CONSTANT'S. D170.

      `prospectorCeiling` reads the third rung of Prospector Holds and the build
      endpoint has honoured it since the day it shipped; this row read the bare
      `PROSPECTOR.max` and told a commander who had paid 6,000 alloy for a third
      berth that they were at "2 / 2 · limit". `prospectorRoom` is the single
      statement of the arithmetic (D131), so every figure on this row comes off it.
    */
    const prospectorCeilingHere = prospectorCeiling(tech);
    const prospectorCapped = id === 'PROSPECTOR'
      && prospectorRoom(committed, tech) === 0;
    // Each hull answers to its own pool: a gun to the ground, a ship to the Hangar.
    const poolTotal = hullSpec.ground ? groundTotal : hangarTotal;
    const poolUsed = hullSpec.ground ? groundUsed : hangarUsed;
    const capacityCapped = poolUsed + hullBulk(id) > poolTotal;
    const queuedCount = yardOrders
      .filter((order) => order.kind === 'HULL' && order.subject === id)
      .reduce((sum, order) => sum + order.count, 0);
    const queued = queuedCount > 0
      ? t('planet.queue.unitsQueued', { count: queuedCount })
      : undefined;
    const accessBlock = hullAccessBlock(id, level, yardProjection, onNeed);
    return (
      // Wrapped and identified like every building row, so a hull can be scrolled
      // to and pointed at by anything that has to name one.
      <div
        key={id}
        id={`row-${id}`}
        {...(hullSpec.tier === null
          ? {}
          : {
            'data-hull-id': id,
            'data-hull-family': hullSpec.family,
            'data-hull-tier': hullSpec.tier,
          })}
      >
        <UpgradeRow
          layout="card"
          /*
            THE HULL ROWS NEEDED THIS BY HAND. Every other row on this screen sits in a
            one-line \`<div id="row-…">\` and got its mark in one sweep; this wrapper spreads
            its data attributes over several lines, the sweep did not match it, and the
            Prospector — the one craft a fault can name — drew no wash at all while its
            press already went to the repair sheet.
          */
          faulty={!!faults.get(id)}
          art={HULL_ART[id]}
          name={hullLabel(id)}
          /*
            THE ROLE IT FIGHTS AS, beside the name. D124.

            This tab bands hulls by FAMILY, which is where a ship lives in the
            catalogue and says nothing about how it fights: Pike is Offensive,
            Rampart is Defensive, and the Rampart beats the Pike. Until this chip
            existed the only taxonomy a commander could see pointed the wrong way,
            and `HullClass` appeared nowhere in the client at all.

            A Prospector has a class too and it means the same thing on a run, so
            no hull is excluded.
          */
          nameBadge={<ClassChip cls={hullSpec.cls} />}
          /*
            ONLY THE HALF THE ROW DOES NOT ALREADY SAY.

            BOTH HALVES, BACK, AND SHORTER. Owner report: the line that said
            *"3 evde 2 dışarıda"* had gone.

            It had, and on purpose — it read "(Home: 1, Away: 0)" beside every
            hull while the gain line two rows down already said "You have 1 → 2",
            which is the same fact twice, and between them they left the NAME about
            fifty pixels at 350. But the width was the problem, not the
            information: where a commander's craft ARE is the question this tab
            exists to answer, and half an answer is what sent them to count rows.

            So the fix is the SHAPE. `{{home}} ev · {{away}} dış` is eleven
            characters at its widest and carries no parentheses, no labels spelled
            out in words and no comma — the numbers say what they are by standing
            where they stand. Zero away is drawn rather than hidden, because
            "everything I own is here" is a real answer to the question and a row
            that goes silent instead makes the reader check whether it is broken.
          */
          nameAside={t('planet.reach.hullLocationCounts', { home, away })}
          {...(hullSpec.tier === null
            ? {}
            : { tierMark: t('planet.reach.hullTier', { tier: hullSpec.tier }) })}
          tag={hullTag(id)}
          stats={{
            atk: hullSpec.atk,
            hp: hullSpec.hp,
            /**
             * A PROSPECTOR DOES NOT FLY AT ITS HULL SPEED. D25.
             *
             * Mining reads `PROSPECTOR.speed` — a separate constant, tied to how fast
             * a rock moves so interception stays exact — and `fleetSpeed` never
             * touches the hull field at all. The card was printing the hull number,
             * which drifted from the authoritative value. D74 locks the duplicate in
             * `HULLS` to this same value too. The Derrick's lift is deliberately not
             * shown; this is the shipyard, and what it sells is the craft.
             */
            speed: id === 'PROSPECTOR' ? PROSPECTOR.speed : hullSpec.speed,
            cargo: hullSpec.cargo,
          }}
          role={hullPitch(id)}
          /*
            NO GAIN LINE ON A HULL ROW. D170, owner instruction.

            It read "You have 0 → 1", which is the same holding the line above now
            states as `5 in · 6 out` — the same fact twice, in two shapes, on a row
            that is already the tightest in the game. And it was the weaker of the
            two: a count with no location answers "how many", where a commander
            standing on a shipyard is asking "how many are HERE".

            Buildings keep theirs. There the gain is a RATE that changes — +58/h →
            +84/h — which is a fact nothing else on the row carries.
          */
          {...(prospectorCapped || capacityCapped
            ? {
              completed: prospectorCapped
                ? t('planet.reach.prospectorLimit', {
                  owned: committed,
                  max: prospectorCeilingHere,
                })
                : hullSpec.ground
                  ? t('planet.capacity.full', { used: groundUsed, total: groundTotal })
                  : t('planet.capacity.hangarFull', { used: hangarUsed, total: hangarTotal }),
            }
            : {})}
          cost={{
            alloy: hullSpec.alloy,
            crystal: hullSpec.crystal,
            deuterium: hullSpec.deuterium,
          }}
          held={held}
          income={income}
          takes={orderMinutes(hullSpec.ground ? 'DEFENCE' : 'HULL', hullSpec, planet, 1, { hull: id })}
          unowned={owned === 0}
          onOpen={() => { onBuild(id); }}
          {...(accessBlock
            ? { blocked: accessBlock }
            : yardOrders.length >= BUILD.queueDepth
              ? {
                blocked: { reason: t('planet.blocked.queueFull') } satisfies Blocked,
              }
              : {})}
          {...(queued ? { queued } : {})}
          queuedActionable
          verb="build"
          onAct={() => { onBuild(id); }}
        />
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
      <div id="row-SHIPYARD">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('SHIPYARD')}
          art={buildingArt('SHIPYARD', Math.max(1, shipyard.level))}
          nextArt={nextBuildingArt('SHIPYARD', shipyard.actionLevel)}
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
          gain={buildingGain(
            'SHIPYARD',
            shipyard.actionLevel,
            cappedCountOf(shipyard.projectedLevels),
            shipyard.projectedLevels,
          )}
          cost={shipyard.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', shipyard.cost, planet, 1, { building: 'SHIPYARD', level: shipyard.actionLevel + 1 })}
          unowned={shipyard.level === 0}
          {...(shipyard.blocked ? { blocked: shipyard.blocked } : {})}
          {...(shipyard.queued ? { queued: shipyard.queued } : {})}
          queuedActionable
          verb="raise"
          onAct={shipyard.act}
          pending={shipyard.pending}
          highlighted={focused === 'SHIPYARD'}
          flash={flashed === 'SHIPYARD'}
        />
      </div>

      {/*
        THE HANGAR, AND THE ROOM IT HOLDS, BESIDE THE YARD THAT FILLS IT. 2026-09-18.

        The row sells the next rung — its gain is room now → room next, and its
        requirement names the Core gate that rung waits on. The card under it is the
        deck itself: what is spoken for and what is free, counting ships away from
        home and every order already in the yard.
      */}
      <div id="row-HANGAR">
        <UpgradeRow
          layout="card"
          art={buildingArt('HANGAR', Math.max(1, hangar.level))}
          nextArt={nextBuildingArt('HANGAR', hangar.actionLevel)}
          name={buildingName('HANGAR')}
          tag={buildingTag('HANGAR')}
          level={hangar.level}
          role={buildingRole('HANGAR')}
          onOpen={() => {
            onOpen(
              spec(
                { kind: 'building', id: 'HANGAR' },
                buildingName('HANGAR'),
                buildingRole('HANGAR'),
                hangar,
              ),
            );
          }}
          gain={buildingGain(
            'HANGAR',
            hangar.actionLevel,
            cappedCountOf(hangar.projectedLevels),
            hangar.projectedLevels,
          )}
          cost={hangar.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', hangar.cost, planet, 1, { building: 'HANGAR', level: hangar.actionLevel + 1 })}
          unowned={hangar.level === 0}
          {...(hangar.blocked ? { blocked: hangar.blocked } : {})}
          {...(hangar.queued ? { queued: hangar.queued } : {})}
          queuedActionable
          verb="raise"
          onAct={hangar.act}
          pending={hangar.pending}
          highlighted={focused === 'HANGAR'}
          flash={flashed === 'HANGAR'}
        />
      </div>

      {/*
        THE REPAIR STATION, ACROSS BOTH COLUMNS UNDER THE YARD AND THE HANGAR. Owner
        instruction, 2026-09-30. It has no ladder, so the card opens the station itself.
        A season dealt before ship damage has none, and the card is not drawn.
      */}
      {shipDamageApplies(planet.rulesetVersion ?? 0) && (
        <RepairStationCard
          dock={planet.dock}
          repairs={planet.queues?.REPAIR ?? []}
          highlighted={focused === REPAIR_STATION_ITEM}
          onOpen={onStation}
        />
      )}
      </div>
      <HangarRoom planet={planet} />
      {/*
        KLAN SAVUNMA DESTEĞİ (K1 · K4): the retreat-or-support toggles and the support bay,
        under the Hangar because the bay is the Hangar's own second room. Neither draws in
        a season dealt before the rule.
      */}
      <DefencePostureCard planet={planet} />
      <ClanSupportBay planet={planet} />

      {/*
        THE CATALOGUE FOLDS. Owner instruction.

        Nineteen hull rows at ~98px is close to two thousand pixels — about four
        screens of the 350-wide phone this game is designed against, before a
        commander has seen the roster once. The alternative was shrinking the row,
        and `visual-design.md` forbids it in as many words: the renders are the most
        expensive thing this project owns and a 40px one "reads as a favicon".

        So the height stays and the LIST gets shorter. One band is open on arrival
        and the other three state their counts, which puts the shape of the whole
        catalogue on one screen and the ships a commander is actually shopping for
        one tap away.

        The band's NOTE only draws while the band is open. A shut band is a heading
        and a number; a paragraph under it would give back the height the fold just
        saved.
      */}
      {FLEET_FAMILY_ORDER.map((family) => {
        const open = lesson ? family === 'OFFENSIVE' || (lesson === 'courier' && family === 'CARGO') : families.isOpen(family);
        return (
          <section
            key={family}
            data-hull-family-group={family}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 720px' }}
          >
            <Band
              label={t(`planet.reach.family.${family}.label`)}
              {...(open ? { note: t(`planet.reach.family.${family}.note`) } : {})}
              count={HULLS_BY_FAMILY[family].length}
              open={open}
              onToggle={() => { if (!lesson) families.toggle(family); }}
            />
            {open ? <div className="grid grid-cols-2 gap-2">{HULLS_BY_FAMILY[family].map(hull)}</div> : null}
          </section>
        );
      })}

      <Band label={t('planet.reach.miningBand')} note={t('planet.reach.miningNote')} />
      <div className="grid grid-cols-2 gap-2">{hull('PROSPECTOR')}</div>

      {/*
        THE TWO ORBITAL SATELLITES, LAST, BESIDE THE CRAFT THEY SERVE. D170.

        They used to open the tab, above nineteen hull rows — so the first thing a
        commander read under "what can I reach" was a pair of purchases they make
        once a season and then never think about again. The Derrick exists to raise
        the Prospector's yield and the Beacon to speed the fleet that was just
        listed, so both are footnotes to what is above them rather than a preamble
        to it, and a reader arrives here having already passed what they came for.
      */}
      {!lesson && <Band label={t('planet.reach.orbitBand')} note={t('planet.reach.orbitNote')} />}
      <div className="grid grid-cols-2 gap-2">
        {(['DERRICK', 'BEACON'] as const).map((id) => (
          <SatelliteItemRow
            key={id}
            id={id}
            planet={planet}
            action={orbit(id, satelliteLabel(id), onNeed)}
            held={held}
            income={income}
            focused={focused}
            flashed={flashed}
            onOpen={onOpen}
          />
        ))}
      </div>
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


function Grow({ planet, held, income, focused, flashed, onNeed, onFlash, onOpen }: GroupProps) {
  const faults = useFaults();
  const { t } = useTranslation();
  // The Core is the ceiling and the two ore streams sit under it, so neither has a
  // requirement to jump to. The Refinery does: its ladder is on the research
  // surface, which `onNeed` is the only way to reach from here.
  const noop = () => undefined;
  const building = useBuildingAction(planet, onFlash);
  const orbit = useOrbitAction(planet, onFlash);
  const core = building('CORE', buildingName('CORE'), noop);
  const refinery = building('REFINERY', buildingName('REFINERY'), noop);
  const extractor = building('EXTRACTOR', buildingName('EXTRACTOR'), noop);
  const plant = building('DEUTERIUM_PLANT', buildingName('DEUTERIUM_PLANT'), onNeed);
  // D190: the store lives with the production that fills it, not with the guns.
  const vault = building('VAULT', buildingName('VAULT'), onNeed);
  const capped = cappedCountOf(core.projectedLevels);
  const production = productionMult(
    projectedQueueState(planet, 'CONSTRUCTION').effectiveOrbit,
  );

  return (
    <>
      {/* E5: the buildings as cards, two to a row, the render on top (the mock's Base). */}
      <div className="grid grid-cols-2 gap-2">
      <div id="row-CORE">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('CORE')}
          art={buildingArt('CORE', Math.max(1, core.level))}
          nextArt={nextBuildingArt('CORE', core.actionLevel)}
          name={buildingName('CORE')}
          tag={buildingTag('CORE')}
          level={core.level}
          role={coreRole(capped)}
          onOpen={() => {
            onOpen(
              spec({ kind: 'building', id: 'CORE' }, buildingName('CORE'), coreRole(capped), core),
            );
          }}
          gain={buildingGain('CORE', core.actionLevel, capped, core.projectedLevels)}
          cost={core.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', core.cost, planet, 1, { building: 'CORE', level: core.actionLevel + 1 })}
          unowned={core.level === 0}
          verb="raise"
          onAct={core.act}
          pending={core.pending}
          {...(core.queued ? { queued: core.queued } : {})}
          queuedActionable
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
          layout="card"
          faulty={!!faults.get('REFINERY')}
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
          gain={buildingGain(
            'REFINERY',
            refinery.actionLevel,
            capped,
            refinery.projectedLevels,
            production,
            productionPaceOf(planet),
          )}
          cost={refinery.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', refinery.cost, planet, 1, { building: 'REFINERY', level: refinery.actionLevel + 1 })}
          unowned={refinery.level === 0}
          {...(refinery.blocked ? { blocked: refinery.blocked } : {})}
          {...(refinery.queued ? { queued: refinery.queued } : {})}
          queuedActionable
          verb="raise"
          onAct={refinery.act}
          pending={refinery.pending}
          highlighted={focused === 'REFINERY'}
          flash={flashed === 'REFINERY'}
        />
      </div>

      <div id="row-EXTRACTOR">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('EXTRACTOR')}
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
          gain={buildingGain(
            'EXTRACTOR',
            extractor.actionLevel,
            capped,
            extractor.projectedLevels,
            production,
            productionPaceOf(planet),
          )}
          cost={extractor.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', extractor.cost, planet, 1, { building: 'EXTRACTOR', level: extractor.actionLevel + 1 })}
          unowned={extractor.level === 0}
          {...(extractor.blocked ? { blocked: extractor.blocked } : {})}
          {...(extractor.queued ? { queued: extractor.queued } : {})}
          queuedActionable
          verb="raise"
          onAct={extractor.act}
          pending={extractor.pending}
          highlighted={focused === 'EXTRACTOR'}
          flash={flashed === 'EXTRACTOR'}
        />
      </div>

      {/*
        THE THIRD PRODUCER, and it was simply not here. T5 gave it an id, art, both
        languages, a server path and an economy; four rows rendered and it was not
        one of them, so the only steady source of fuel could not be built at all.
        It sits after the two ore streams because it is the one with a research
        ladder in front of it — the last thing a commander reaches for, not the
        first.
      */}
      <div id="row-DEUTERIUM_PLANT">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('DEUTERIUM_PLANT')}
          art={buildingArt('DEUTERIUM_PLANT', plant.level)}
          name={buildingName('DEUTERIUM_PLANT')}
          tag={buildingTag('DEUTERIUM_PLANT')}
          level={plant.level}
          role={buildingRole('DEUTERIUM_PLANT')}
          onOpen={() => {
            onOpen(
              spec(
                { kind: 'building', id: 'DEUTERIUM_PLANT' },
                buildingName('DEUTERIUM_PLANT'),
                buildingRole('DEUTERIUM_PLANT'),
                plant,
              ),
            );
          }}
          gain={buildingGain(
            'DEUTERIUM_PLANT',
            plant.actionLevel,
            cappedCountOf(plant.projectedLevels),
            plant.projectedLevels,
            production,
            productionPaceOf(planet),
          )}
          cost={plant.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', plant.cost, planet, 1, { building: 'DEUTERIUM_PLANT', level: plant.actionLevel + 1 })}
          unowned={plant.level === 0}
          {...(plant.blocked ? { blocked: plant.blocked } : {})}
          {...(plant.queued ? { queued: plant.queued } : {})}
          queuedActionable
          verb="raise"
          onAct={plant.act}
          pending={plant.pending}
          highlighted={focused === 'DEUTERIUM_PLANT'}
          flash={flashed === 'DEUTERIUM_PLANT'}
        />
      </div>

      <div id="row-VAULT">
        <UpgradeRow
          layout="card"
          faulty={!!faults.get('VAULT')}
          art={buildingArt('VAULT', Math.max(1, vault.level))}
          nextArt={nextBuildingArt('VAULT', vault.actionLevel)}
          name={buildingName('VAULT')}
          tag={buildingTag('VAULT')}
          level={vault.level}
          role={vaultRole()}
          onOpen={() => {
            onOpen(
              spec({ kind: 'building', id: 'VAULT' }, buildingName('VAULT'), vaultRole(), vault),
            );
          }}
          gain={buildingGain(
            'VAULT',
            vault.actionLevel,
            cappedCountOf(vault.projectedLevels),
            vault.projectedLevels,
          )}
          cost={vault.cost}
          held={held}
          income={income}
          takes={orderMinutes('BUILDING', vault.cost, planet, 1, { building: 'VAULT', level: vault.actionLevel + 1 })}
          unowned={vault.level === 0}
          {...(vault.blocked ? { blocked: vault.blocked } : {})}
          {...(vault.queued ? { queued: vault.queued } : {})}
          queuedActionable
          verb="raise"
          onAct={vault.act}
          pending={vault.pending}
          highlighted={focused === 'VAULT'}
          flash={flashed === 'VAULT'}
        />
      </div>

      </div>

      <Band label={t('planet.grow.multiplierBand')} note={t('planet.grow.multiplierNote')} />
      <div className="grid grid-cols-2 gap-2">
        <SatelliteItemRow
          id="FOUNDRY"
          planet={planet}
          action={orbit('FOUNDRY', satelliteLabel('FOUNDRY'), onNeed)}
          held={held}
          income={income}
          focused={focused}
          flashed={flashed}
          onOpen={onOpen}
        />
      </div>
    </>
  );
}

/* ── the room sections (D2) ─────────────────────────────────── */

/**
 * THE HANGAR, PART BY PART, AND WHAT ITS NEXT RUNG DOES TO IT. D2 (owner, round 2: no
 * grey fill). Ships away keep their room for the whole round trip, which is why a
 * returning fleet always fits — said here, where a full Hangar would otherwise worry.
 */
function HangarRoom({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const room = roomParts(planet, false);
  // The rung an order placed now would buy: whatever is queued lands first.
  const level = projectedQueueState(planet, 'CONSTRUCTION').buildings.HANGAR;
  const next = level < HANGAR.maxLevel ? level + 1 : null;
  return (
    <div data-hangar-room className="flex flex-col gap-1.5">
      <RoomBar label={t('roomBar.hangar')} total={room.total} home={room.home} away={room.away} queued={room.queued} />
      <p className="px-1 text-micro leading-snug text-v2-ink-2">
        {t('roomBar.returnFits')}
        {next !== null && (
          <> {t('roomBar.nextHangar', { level: next, from: compact(hangarCapacity(level)), to: compact(hangarCapacity(next)) })}</>
        )}
      </p>
    </div>
  );
}

/** The three guns, in the order the Defend tab sells them. */
const GUNS = ['THORN', 'HARPOON', 'BASTION'] as const;

/**
 * THE GROUND, WITH ITS GUNS NAMED AND NO GUN'S PICTURE (owner, round 2: the room is not
 * one gun's), and which Command Core grows it and by how much.
 */
function GroundRoom({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const room = roomParts(planet, true);
  const core = projectedQueueState(planet, 'CONSTRUCTION').buildings.CORE;
  let next: number | null = null;
  for (let level = core + 1; level <= core + 40 && next === null; level += 1) {
    if (groundSlots(level) > groundSlots(core)) next = level;
  }
  return (
    <div data-ground-room className="flex flex-col gap-1.5">
      <RoomBar label={t('roomBar.ground')} total={room.total} home={room.home} away={room.away} queued={room.queued}>
        <p className="flex flex-wrap gap-1.5 pt-0.5">
          {GUNS.map((gun) => {
            const standing = planet.ground[gun] ?? 0;
            return (
              <span
                key={gun}
                className={`rounded-chip border border-v2-line px-1.5 py-0.5 text-micro ${standing > 0 ? 'text-v2-ink' : 'text-v2-ink-3'}`}
              >
                {hullLabel(gun)} <span className="font-v2-mono">{standing}</span>
              </span>
            );
          })}
        </p>
      </RoomBar>
      <p className="px-1 text-micro leading-snug text-v2-ink-2">
        {t('roomBar.gunsStay')}
        {next !== null && (
          <> {t('roomBar.nextCore', { level: next, from: compact(groundSlots(core)), to: compact(groundSlots(next)) })}</>
        )}
      </p>
    </div>
  );
}

/* ── building units ─────────────────────────────────────────── */

function BuildSheet({
  hull,
  planet,
  held,
  onNeed,
  onClose,
}: {
  hull: HullId;
  planet: PlanetView;
  held: { alloy: number; crystal: number; deuterium: number };
  onNeed: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const spec = HULLS[hull];
  const build = useBuild();
  const say = useToast();
  const lesson = useAcademyLesson();
  const [explained, setExplained] = useState(false);
  const [cycle, setCycle] = useState(false);
  // The hand points straight to Build. Offer the authored quantity, not the
  // live game's default of one, which the local lesson correctly refuses.
  const lessonCount = hull === 'DART' && (lesson === 'darts' || lesson === 'reinforcements') ? 2
    : (hull === 'PROSPECTOR' && lesson === 'prospector') || (hull === 'COURIER' && lesson === 'courier') ? 1 : null;

  /**
   * A PROSPECTOR IS RATIONED, AND THE SHEET HAS TO SAY SO.
   *
   * The ceiling is a hard limit on how many a planet may OWN, so it counts craft
   * that are away mining as well as those on the ground — the server does the
   * same, and this is the only reason `fleetAway` is on the payload.
   *
   * AND IT IS A CEILING THE COMMANDER CAN BUY. D170: the third rung of Prospector
   * Holds opens a third berth on every world they hold; `prospectorRoom` and
   * `prospectorCeiling` are the single statement of the arithmetic (D131).
   *
   * The server refuses over the cap regardless (Principle 1 — the client never
   * decides an outcome); this exists so the control never offers what will be
   * refused, and never withholds what will be allowed.
   */
  const yardProjection = projectedQueueState(planet, 'YARD');
  const tech = techOf(planet);
  const owned = (planet.fleet[hull] ?? 0)
    + (planet.ground[hull] ?? 0)
    + (planet.fleetAway[hull] ?? 0);
  const committed = yardProjection.units[hull] ?? owned;
  const prospectorMax = prospectorCeiling(tech);
  const countCap = hull === 'PROSPECTOR'
    ? prospectorRoom(committed, tech)
    : Number.MAX_SAFE_INTEGER;
  // A ship answers to the Hangar and a gun to the ground; the berth cap is its own.
  const bulk = hullBulk(hull);
  const room = roomParts(planet, spec.ground);
  const poolUsed = room.home + room.away + room.queued;
  const spaceCap = Math.max(0, Math.floor((room.total - poolUsed) / bulk));
  const cap = Math.min(countCap, spaceCap);
  const prospectorCapped = hull === 'PROSPECTOR' && countCap === 0;
  const capacityCapped = spaceCap === 0;
  const capped = prospectorCapped || capacityCapped;
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const accessBlock = hullAccessBlock(hull, shipyard, yardProjection, onNeed);
  const yardOrders = planet.queues?.YARD.length ?? 0;
  const blocked: Blocked | undefined = accessBlock
    ?? (yardOrders >= BUILD.queueDepth
      ? { reason: t('planet.blocked.queueFull') }
      : undefined);

  const affordable = Math.min(
    Math.floor(held.alloy / spec.alloy),
    spec.crystal > 0 ? Math.floor(held.crystal / spec.crystal) : Number.MAX_SAFE_INTEGER,
    spec.deuterium > 0
      ? Math.floor(held.deuterium / spec.deuterium)
      : Number.MAX_SAFE_INTEGER,
  );
  const fits = Math.min(affordable, cap);
  const ceiling = Math.max(1, fits);
  // What stops Max where it stops: the purse, the berths, or the room.
  const bound = affordable <= cap
    ? t('planet.buildSheet.byPurse')
    : countCap <= spaceCap
      ? t('planet.buildSheet.byBerth')
      : spec.ground ? t('planet.buildSheet.byGround') : t('planet.buildSheet.byHangar');
  const [count, setCount] = useState(1);
  const clamped = lessonCount ?? Math.min(count, ceiling);
  const total = { alloy: spec.alloy * clamped, crystal: spec.crystal * clamped, deuterium: spec.deuterium * clamped };
  const short = {
    alloy: Math.max(0, total.alloy - held.alloy),
    crystal: Math.max(0, total.crystal - held.crystal),
    deuterium: Math.max(0, total.deuterium - held.deuterium),
  };
  const canPay = short.alloy === 0 && short.crystal === 0 && short.deuterium === 0;
  // Deuterium has no rate on this payload, so a fuel shortfall says so rather than when.
  const wait = canPay || short.deuterium > 0
    ? null
    : affordWait(short, { alloyPerHour: planet.planet.alloyPerHour, crystalPerHour: planet.planet.crystalPerHour });
  const takes = useOrderDuration(orderMinutes(
    spec.ground ? 'DEFENCE' : 'HULL',
    { alloy: spec.alloy, crystal: spec.crystal, deuterium: spec.deuterium },
    planet,
    clamped,
    { hull: spec.id },
  ));
  /**
   * The picture at the top of the sheet. A ground gun's render is tiered by how many
   * are STANDING rather than by a level it does not have, so the sheet shows the
   * battery the player already owns — the same picture the row they tapped wore.
   */
  const art =
    hull === 'BASTION' || hull === 'HARPOON' || hull === 'THORN'
      ? groundArt(hull, Math.max(1, planet.ground[hull] ?? 0))
      : HULL_ART[hull];
  const home = spec.ground ? planet.ground[hull] ?? 0 : planet.fleet[hull] ?? 0;
  const away = planet.fleetAway[hull] ?? 0;

  const commit = (): void => {
    build.mutate(
      { hull, count: clamped },
      {
        onSuccess: () => {
          say(t('planet.done.unitsQueued', { count: clamped, name: hullLabel(hull) }));
          onClose();
        },
        onError: (err) => {
          say(describe(err), 'error');
        },
      },
    );
  };

  return (
    <V2Sheet
      detents={['fit']}
      eyebrow={
        spec.ground ? t('planet.buildSheet.eyebrowGround') : t('planet.buildSheet.eyebrowMobile')
      }
      title={hullLabel(hull)}
      onClose={onClose}
      footer={capped ? undefined : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span data-build-price className="flex min-w-0 items-center gap-2">
              <span className="font-v2-mono text-micro text-v2-ink-3">{clamped} ×</span>
              <Cost cost={total} held={held} />
              {/*
                AND WHAT THE BATCH COSTS IN TIME. Owner report. It moves with the
                stepper: ten Darts is a different evening from one.
              */}
              <span
                data-testid="build-sheet-time"
                className="flex items-center gap-1 whitespace-nowrap font-v2-mono text-micro text-v2-ink-2"
                aria-label={t('upgradeRow.takesLabel', { duration: takes })}
              >
                <Icon id="i-clock" className="size-3 shrink-0" />
                {takes}
              </span>
            </span>
            <span data-queue-fill className="shrink-0 text-micro text-v2-ink-3">
              {t('planet.buildSheet.yardFill', { used: yardOrders, total: BUILD.queueDepth })}
            </span>
          </div>
          {/*
            `data-commit` is this sheet's own commitment, and `data-ready` appears
            only once the count is at the ceiling. The onboarding lights the ceiling
            option first and then moves to here, so the opening grant is spent in one
            press rather than one ship at a time.
          */}
          <span data-act data-commit className="block" {...(clamped === ceiling ? { 'data-ready': true } : {})}>
            {blocked ? (
              // A REQUIREMENT IS A DOOR, NOT AN ALARM (I1): warn, and it goes where the fix is.
              <button
                type="button"
                data-lock-state="closed"
                disabled={!blocked.onFix}
                onClick={() => {
                  blocked.onFix?.();
                  onClose();
                }}
                className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-control border border-v2-warn/50 px-3 text-caption font-semibold text-v2-warn disabled:border-v2-line disabled:text-v2-ink-2"
              >
                <Icon id="i-lock" className="size-3.5 shrink-0" />
                {blocked.reason}
                {blocked.onFix && ' →'}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canPay || build.isPending}
                onClick={commit}
                className="min-h-10 w-full rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-2"
              >
                {canPay
                  ? t('planet.buildSheet.build', { count: clamped })
                  : wait === null
                    ? t('itemSheet.short')
                    : t('itemSheet.affordIn', { duration: duration(wait) })}
              </button>
            )}
          </span>
        </div>
      )}
    >
      <div className="flex flex-col gap-3 pt-1">
        <section
          data-build-art
          className="relative rounded-control border border-v2-line bg-v2-deep px-3 pb-3 pt-2.5"
          style={HULL_SKY}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 rounded-chip border border-v2-line-hi bg-v2-raise/60 px-1.5 py-0.5 text-micro font-semibold text-v2-ink-2">
              <ClassEmblem cls={spec.cls} decorative />
              {combatClassLabel(spec.cls)}
            </span>
            <span className="font-v2-mono text-micro text-v2-ink-2">
              {/* A gun never leaves, so it is only ever standing. */}
              {spec.ground
                ? t('planet.buildSheet.standing', { value: home })
                : t('planet.reach.hullLocationCounts', { home, away })}
            </span>
          </div>
          {art && <img src={art} alt={hullLabel(hull)} className="mx-auto mt-1 h-24 w-40 object-contain" />}
          <p className="text-center text-caption text-v2-ink-2">{hullTag(hull)}</p>
          <HullStats hull={hull} />
        </section>

        <div className="flex flex-col gap-1.5">
          <p className="text-caption leading-snug text-v2-ink-2">
            <span>{hullPitch(hull)}</span>{' '}
            <button
              type="button"
              aria-expanded={explained}
              onClick={() => { setExplained((open) => !open); }}
              className="font-semibold text-v2-self"
            >
              {t('itemSheet.howItWorks')} ›
            </button>
          </p>
          {explained && <p data-item-detail className="text-caption leading-snug text-v2-ink-3">{hullDetail(hull)}</p>}
        </div>

        {/*
          THE RULE WHERE THE HULL IS CHOSEN. D124: the multipliers existed on one
          screen in the game — the battle report, after the fleet was lost. The line
          states what this hull beats and what beats it, with the numbers the resolver
          uses; the whole cycle is one tap deeper.
        */}
        <section data-counter-cycle className="flex flex-col gap-1.5 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
          <p className="flex items-center justify-between gap-2">
            <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('counter.heading')}</span>
            <button
              type="button"
              aria-expanded={cycle}
              onClick={() => { setCycle((open) => !open); }}
              className="text-micro font-semibold text-v2-self"
            >
              {t('planet.buildSheet.cycle')} ›
            </button>
          </p>
          <HullMatchup cls={spec.cls} />
          {cycle && <CounterCycle highlight={spec.cls} />}
        </section>

        <section className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-v2-ink-3">
            {t('planet.buildSheet.howMany')}
            <span aria-hidden="true" className="h-px flex-1 bg-v2-line" />
          </p>
          {capped ? (
            <p className="text-caption leading-snug text-v2-warn">
              {prospectorCapped
                ? t('planet.buildSheet.capped', { count: committed })
                : spec.ground
                  ? t('planet.capacity.full', { used: poolUsed, total: room.total })
                  : t('planet.capacity.hangarFull', { used: poolUsed, total: room.total })}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <QuantityStepper
                look="v2"
                value={clamped}
                min={lessonCount ?? 1}
                max={lessonCount ?? ceiling}
                onChange={setCount}
                decreaseLabel={t('planet.buildSheet.fewer', { name: hullLabel(hull) })}
                increaseLabel={t('planet.buildSheet.more', { name: hullLabel(hull) })}
                valueLabel={t('planet.buildSheet.quantity', { name: hullLabel(hull) })}
                maxLabel={t('planet.buildSheet.max', { name: hullLabel(hull) })}
                // Max says how many; the line beside it, what stops it there. In a
                // lesson the authored count is the whole offer, and no reason applies.
                maxText={lessonCount !== null
                  ? t('planet.buildSheet.maxOf', { value: lessonCount })
                  : fits > 0 ? t('planet.buildSheet.maxOf', { value: fits }) : t('planet.buildSheet.maxShort')}
              />
              {lessonCount === null && fits > 0 && (
                <span data-fits className="min-w-0 text-right text-micro leading-snug text-v2-ink-3">{bound}</span>
              )}
            </div>
          )}
          {hull === 'PROSPECTOR' && fits > 0 && (
            <p className="text-micro text-v2-ink-3">
              {t('planet.buildSheet.heldOfMax', { owned: committed, max: prospectorMax })}
            </p>
          )}
        </section>

        {/*
          THE ROOM, AS A PICTURE, IN YOUR COLOUR. The order's own share moves under
          the stepper directly above it, so pressing "+" and watching the room go is
          the rule teaching itself.
        */}
        <RoomBar
          label={t(spec.ground ? 'roomBar.ground' : 'roomBar.hangar')}
          total={room.total}
          home={room.home}
          away={room.away}
          queued={room.queued}
          incoming={capped ? 0 : bulk * clamped}
        />

        {!capped && !blocked && !canPay && (
          <div className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-deep/60 px-3 py-2.5">
            {short.alloy > 0 && <NeedBar resource="alloy" have={held.alloy} need={total.alloy} />}
            {short.crystal > 0 && <NeedBar resource="crystal" have={held.crystal} need={total.crystal} />}
            {short.deuterium > 0 && <NeedBar resource="deuterium" have={held.deuterium} need={total.deuterium} />}
          </div>
        )}
      </div>
    </V2Sheet>
  );
}

/** The still sky behind a hull: decoration, never a meaning. */
const HULL_SKY = {
  backgroundImage:
    'radial-gradient(70% 90% at 60% 45%, color-mix(in srgb, var(--color-v2-sky-blue) 30%, transparent), transparent 75%)',
};

/**
 * THE SIX FIGURES A HULL IS COMPARED BY, labelled in every cell: attack, durability,
 * speed, cargo (or salvage), the room it takes and the fuel it burns. A gun never
 * moves, so its speed says "fixed" and its fuel says nothing, rather than nought.
 */
function HullStats({ hull }: { hull: HullId }) {
  const spec = HULLS[hull];
  const salvage = salvageCapacity({ [hull]: 1 });
  const fuel = hullFuelRate(hull);
  const cells: { id: string; label: string; value: string }[] = [
    { id: 'attack', label: i18n.t('action.statAttack'), value: compact(spec.atk) },
    { id: 'hull', label: i18n.t('action.statHull'), value: compact(spec.hp) },
    { id: 'speed', label: i18n.t('action.statSpeed'), value: spec.speed === 0 ? i18n.t('action.statSpeedFixed') : compact(spec.speed) },
    salvage > 0
      ? { id: 'salvage', label: i18n.t('action.statSalvage'), value: compact(salvage) }
      : { id: 'cargo', label: i18n.t('action.statCargo'), value: spec.cargo === 0 ? i18n.t('action.statCargoNone') : compact(spec.cargo) },
    { id: 'room', label: i18n.t('action.statRoom'), value: compact(hullBulk(hull)) },
    {
      id: 'fuel',
      label: i18n.t('action.statFuel'),
      value: fuel <= 0 ? i18n.t('action.statFuelNone') : i18n.t('action.statFuelRate', { value: decimal(fuel) }),
    },
  ];
  return (
    <dl data-build-stats className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
      {cells.map((cell) => (
        <div key={cell.id} data-stat={cell.id} className="min-w-0 text-center">
          <dt className="truncate text-micro text-v2-ink-3">{cell.label}</dt>
          <dd className="font-v2-mono text-caption tabular-nums text-v2-ink">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * WHAT THIS HULL BEATS AND WHAT BEATS IT, with the multipliers the resolver applies
 * to its fire. Strong wears your colour; weak is a gap to plan around, not a threat,
 * so it is warn and never hostile red (K2). Support is outside the cycle.
 */
function HullMatchup({ cls }: { cls: HullClass }) {
  const { t } = useTranslation();
  const prey = counters(cls);
  const predator = counteredBy(cls);
  if (prey === null || predator === null) {
    return <p data-testid="counter-support" className="text-caption leading-snug text-v2-ink-2">{t('counter.supportNote')}</p>;
  }
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
      <span data-testid="counter-strong" className="flex items-center gap-1 text-v2-self">
        <ClassEmblem cls={prey} decorative />
        {t('counter.strongVs', { class: combatClassLabel(prey) })}
        <span className="font-v2-mono">{factor(COMBAT.strongMult)}</span>
      </span>
      <span data-testid="counter-weak" className="flex items-center gap-1 text-v2-warn">
        <ClassEmblem cls={predator} decorative />
        {t('counter.weakVs', { class: combatClassLabel(predator) })}
        <span className="font-v2-mono">{factor(COMBAT.weakMult)}</span>
      </span>
    </p>
  );
}
