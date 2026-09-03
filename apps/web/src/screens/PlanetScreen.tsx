import { GameActions } from '../session/seasonLock.js';
import { useEffect, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Unreachable, Waiting } from '../ui/kit/Surface.js';
import {
  ANTI_STRATEGIC,
  BUILD,
  HULLS,
  RESEARCH_PROJECTS,
  DEATH_STAR,
  MULTI_WORLD,
  PROSPECTOR,
  buildingCost,
  fleetCount,
  groundLoad,
  groundSlots,
  hangarCapacity,
  hangarLoad,
  hullBulk,
  hullFuelRate,
  instrumentCost,
  instrumentMaxed,
  interceptionRange,
  plantCeiling,
  productionMult,
  satelliteSlots,
  satelliteCost,
  type BuildingId,
  type BuildingLevels,
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
  useBuildInterceptor,
  useCancelBuildOrder,
  useInstallSatellite,
  useRaiseInstrument,
  useUpgrade,
  useBuildDeathStar,
} from '../api/queries.js';
import type { PlanetView } from '../api/schemas.js';

import { directives, primary, type PlanetGroup } from '../lib/directives.js';
import { compact, full } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { duration, useNow } from '../lib/time.js';
import { projectedQueueState, type ProjectedQueueState } from '../lib/predict.js';
/*
  THE CATALOGUE'S BANDS ARE THE ROSTER'S BANDS. Owner instruction.
  Both the order and the membership come from `lib/roster.ts`, which the launch
  picker reads too: the two surfaces ask one question twice, and a player who
  learns the roles here must find them in the same order at the moment the fleet
  actually leaves.
*/
import { FLEET_FAMILY_ORDER, HULLS_BY_FAMILY } from '../lib/roster.js';
import { buildingGain, instrumentGain, satelliteGain } from '../lib/gains.js';
import { useProjected, type Projected } from '../lib/projection.js';
import {
  HULL_ART,
  RESEARCH_ART,
  RESOURCE_ART,
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
import { ActionButton, Price, StatStrip } from '../ui/Action.js';
import { ItemSheet, type ItemRef } from '../ui/ItemSheet.js';
import { PlanetHero } from '../ui/PlanetHero.js';
import { CapacityBar } from '../ui/CapacityBar.js';
import { QueueStrip } from '../ui/QueueStrip.js';
import { Band, DecisionGroup, UpgradeRow, type Blocked } from '../ui/UpgradeRow.js';
import { describe, useToast } from '../ui/Toast.js';
import { Sheet } from '../ui/kit/index.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { Button, Segmented } from '../ui/kit/index.js';

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
  completed?: string;
  queued?: string;
  pending: boolean;
  act: () => void;
}

export function PlanetScreen({
  focusGroup,
  embedded = false,
  onOpenResearch,
}: {
  focusGroup?: GroupId;
  /** Rendered inside a panel over the live galaxy rather than as a full screen. */
  embedded?: boolean;
  /**
   * Take the player to the research surface. T12.
   *
   * The Runner and the Breacher are gated on research, and the refusal offers to
   * go and open it — which `TAB_OF` used to do, because the cards were on this
   * sheet. They are not any more, and a jump that fell through to `'grow'` left
   * the player standing on the Command Core with no idea why.
   */
  onOpenResearch?: () => void;
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
    const queueInstants = data?.queues
      ? [...data.queues.CONSTRUCTION, ...data.queues.YARD].map((order) => order.finishesAt)
      : [];
    const instants = [
      data?.planet.recoveryUntil,
      data?.strategic?.status === 'BUILDING' ? data.strategic.readyAt : null,
      ...queueInstants,
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
  }, [data?.planet.recoveryUntil, data?.queues, data?.strategic, refetch]);

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
  const recovering = data.planet.recoveryUntil !== null
    && data.planet.recoveryUntil !== undefined
    && data.planet.recoveryUntil.getTime() > serverNow();

  const goToNeed = (id: string): void => {
    // A research project is not on this screen at all. Hand it to the host, which
    // is the only thing that can open the surface it IS on.
    if (Object.hasOwn(RESEARCH_PROJECTS, id)) {
      onOpenResearch?.();
      return;
    }
    const home = TAB_OF[id];
    if (home) setTab(home);
    setFocused(id);
  };

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
    // The thing that unblocks you may live under a different tab. Switching to
    // it is the whole point of the requirement being a button.
    onNeed: goToNeed,
    onFlash: setFlashed,
    onOpen: setSheet,
  };

  return (
    <GameActions>
      {/*
        WHO OWNS THE INSET. The sheet bleeds and this screen pads, block by block,
        because ONE thing here has to run edge to edge: the sticky category bar.
        It used to reach the edges with a `-mx-4` that cancelled a `px-4` the sheet
        had applied and this screen had re-applied — three declarations for one
        sixteen-pixel gutter, and no owner to change when it was wrong.
      */}
      <div className="flex flex-col gap-4 pb-4">
      <div className="px-4 pt-4">
        <PlanetHero planet={data} compact={embedded} />
      </div>

      <div className="px-4">
        <BuildQueues planet={data} />
      </div>

      {recovering && (
        <div className="mx-4 rounded-chip border border-alert/40 bg-alert/10 px-3 py-2 text-caption text-threat-ink">
          {t('planet.recovery', { duration: duration((data.planet.recoveryUntil!.getTime() - serverNow()) / 60_000) })}
        </div>
      )}

      {data.strategic && (
        <div className="px-4">
          <DeathStarForge planet={data} held={held} recovering={recovering} />
        </div>
      )}

      <Tabs
        active={active}
        onSelect={setTab}
        held={held}
      />

      <div className="flex flex-col gap-4 px-4">
      <OrbitContext planet={data} />

      {active === 'reach' && !data.strategic && (
        <DeathStarForge planet={data} held={held} recovering={recovering} />
      )}

      <div
        id={`planet-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`planet-tab-${active}`}
        className={recovering ? 'pointer-events-none opacity-50' : ''}
        aria-disabled={recovering}
      >
      <DecisionGroup problem={t(GROUPS[active].problem)} question={t(GROUPS[active].question)}>
        {active === 'defend' && <Defend {...shared} onBuild={setBuilding} />}
        {active === 'orbit' && <Orbit {...shared} />}
        {active === 'reach' && <Reach {...shared} onBuild={setBuilding} />}
        {active === 'grow' && <Grow {...shared} />}
      </DecisionGroup>
      </div>
      </div>

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
    </GameActions>
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
  AEGIS: 'defend',
  UPLINK: 'orbit',
  FOUNDRY: 'grow',
  DEUTERIUM_PLANT: 'grow',
  DERRICK: 'reach',
  BEACON: 'reach',
  SHIPYARD: 'reach',
  HANGAR: 'reach',
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
  const { t } = useTranslation();
  const waiting = Math.round(held.bufferAlloy + held.bufferCrystal + held.bufferDeuterium);

  /*
    `full()` AND NEVER `compact()`. The header's own store already carried that
    rule and its reason — "a store that reads 10k cannot be checked against a
    price of 9,240" — and this strip, which exists precisely so a price can be
    checked without closing the sheet, was rendering the same three numbers
    compacted. Both were on screen at once: 1,303 above and 1.3k below.
  */
  return (
    <div className="flex items-center gap-3 px-4 pb-2 pt-2 text-body">
      <span className="flex items-center gap-2">
        <img src={RESOURCE_ART.alloy} alt="" aria-hidden className="size-4 object-contain" />
        <span className="num text-alloy">{full(held.alloy)}</span>
      </span>
      <span className="flex items-center gap-2">
        <img src={RESOURCE_ART.crystal} alt="" aria-hidden className="size-4 object-contain" />
        <span className="num text-crystal">{full(held.crystal)}</span>
      </span>
      <span
        className="flex items-center gap-2"
        aria-label={t('statusBar.deuteriumLabel')}
      >
        <img src={RESOURCE_ART.deuterium} alt="" aria-hidden className="size-4 object-contain" />
        <span className="num text-deuterium">{full(held.deuterium)}</span>
      </span>
      {waiting >= 1 && (
        <span className="ml-auto text-label text-faint">
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

/** Two independent commitments, kept visible while the player makes the next one. */
function BuildQueues({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const cancel = useCancelBuildOrder();
  const say = useToast();
  const queues = planet.queues ?? { CONSTRUCTION: [], YARD: [] };

  return (
    <section className="plate plate-inset overflow-hidden" aria-label={t('planet.queue.title')}>
      <header className="flex items-baseline gap-2 border-b border-line-soft px-3 py-2">
        <h2 className="legend text-bone">
          {t('planet.queue.title')}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-line-soft to-transparent" />
        <span className="num text-micro text-faint">
          {t('planet.queue.capacity', { count: BUILD.queueDepth })}
        </span>
      </header>
      <QueueStrip
        label={t('planet.queue.construction')}
        orders={queues.CONSTRUCTION}
        now={now}
        cancelling={cancel.isPending ? cancel.variables : undefined}
        onCancel={(order) => {
          cancel.mutate(order.id, {
            onSuccess: (result) => {
              say(t('planet.queue.cancelled', {
                alloy: full(result.refund.alloy),
                crystal: full(result.refund.crystal),
                deuterium: full(result.refund.deuterium),
              }));
            },
            onError: (error) => { say(describe(error), 'error'); },
          });
        }}
      />
      <QueueStrip
        label={t('planet.queue.yard')}
        orders={queues.YARD}
        now={now}
        cancelling={cancel.isPending ? cancel.variables : undefined}
        onCancel={(order) => {
          cancel.mutate(order.id, {
            onSuccess: (result) => {
              say(t('planet.queue.cancelled', {
                alloy: full(result.refund.alloy),
                crystal: full(result.refund.crystal),
                deuterium: full(result.refund.deuterium),
              }));
            },
            onError: (error) => { say(describe(error), 'error'); },
          });
        }}
      />
    </section>
  );
}

function DeathStarForge({
  planet,
  held,
  recovering,
}: {
  planet: PlanetView;
  held: Projected;
  recovering: boolean;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const strategicBuild = useBuildDeathStar();
  const protocol = planet.research.some(
    (project) => project.id === 'DEATH_STAR_PROTOCOL' && project.completed,
  );
  const core = (planet.buildings.CORE ?? 0) >= DEATH_STAR.requiredCore;
  const yard = (planet.buildings.SHIPYARD ?? 0) >= DEATH_STAR.requiredShipyard;
  const affordable = held.alloy >= DEATH_STAR.cost.alloy
    && held.crystal >= DEATH_STAR.cost.crystal
    && held.deuterium >= DEATH_STAR.cost.deuterium;
  const live = planet.strategic !== null && planet.strategic !== undefined;

  return (
    <div
      data-strategic-state={planet.strategic?.status ?? 'LOCKED'}
      className={`death-star-forge ${planet.strategic?.status === 'READY' ? 'death-star-forge-ready' : ''}`}
    >
      <div className="relative z-[1] flex items-start gap-3">
        <div className={`death-star-art relative grid shrink-0 place-items-center overflow-hidden rounded-chip ${live ? 'size-[72px]' : 'size-24'}`}>
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-alloy/70 to-transparent" />
          <img
            src={RESEARCH_ART.DEATH_STAR_PROTOCOL}
            alt=""
            aria-hidden
            className={`${live ? 'size-16' : 'size-[88px]'} object-contain`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="death-star-danger-light" aria-hidden />
            <p className="legend text-alloy">
              {t('planet.deathStar.eyebrow')}
            </p>
          </div>
          <p className="headline mt-1 text-bone">
            {planet.strategic?.status === 'READY'
              ? t('planet.deathStar.ready')
              : planet.strategic?.status === 'PAUSED'
                ? t('planet.deathStar.paused')
                : planet.strategic?.status === 'BUILDING'
                  ? t('planet.deathStar.building', {
                      duration: planet.strategic.readyAt
                        ? duration(Math.max(0, planet.strategic.readyAt.getTime() - serverNow()) / 60_000)
                        : duration((planet.strategic.remainingSeconds ?? 0) / 60),
                    })
                  : t('planet.deathStar.none')}
          </p>
          <p className="mt-1 text-caption leading-snug text-dim">
            {t(planet.strategic?.status === 'READY'
              ? 'planet.deathStar.readyHint'
              : 'planet.deathStar.dangerHint')}
          </p>
        </div>
      </div>

      {!live && (
        <div className="relative z-[1] mt-3 border-t border-line-soft pt-3">
          <div className="grid grid-cols-2 gap-2" role="list">
            <DeathStarNeed ok={protocol}>{t('planet.deathStar.needProtocol')}</DeathStarNeed>
            <DeathStarNeed ok={core}>
              {t('planet.deathStar.needCore', { level: DEATH_STAR.requiredCore })}
            </DeathStarNeed>
            <DeathStarNeed ok={yard}>
              {t('planet.deathStar.needShipyard', { level: DEATH_STAR.requiredShipyard })}
            </DeathStarNeed>
            <DeathStarNeed ok={!recovering}>{t('planet.deathStar.needOperational')}</DeathStarNeed>
          </div>
          <DeathStarEffects />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <Price cost={DEATH_STAR.cost} held={held} />
              <p className="legend mt-1">
                {t('planet.deathStar.buildTime')}
              </p>
            </div>
            {/*
              THE SAME SLAB EVERY OTHER PURCHASE USES, IN THE STRATEGIC HUE.

              This was a fifth button system — its own amber gradient, its own
              2.5px radius, its own 0.68rem type and its own disabled state — so
              the most expensive thing a commander ever buys did not look like a
              purchase at all. The plate around it already carries the weight
              (mass, material, the danger light); `visual-design.md` is explicit
              that strategic red stays a restrained accent rather than a costume.
            */}
            <Button
              variant="commit"
              disabled={recovering || strategicBuild.isPending || !protocol
                || !core || !yard || !affordable}
              onClick={() => { strategicBuild.mutate(undefined, {
                onSuccess: () => { say(t('planet.deathStar.started')); },
                onError: (error) => { say(describe(error), 'error'); },
              }); }}
            >
              {t('planet.deathStar.build')}
            </Button>
          </div>
        </div>
      )}

      {planet.strategic?.status === 'BUILDING' && (
        <div className="relative z-[1] mt-3 h-1.5 overflow-hidden rounded-full bg-black/45">
          <span
            className="block h-full bg-gradient-to-r from-alloy/45 via-alloy to-bone"
            style={{ width: `${String(Math.max(2, Math.min(100,
              100 * (1 - (planet.strategic.remainingSeconds ?? 3600) / 3600))))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * WHAT AN IMPACT DOES, ON THE CARD THAT SELLS IT. D113.
 *
 * The forge said "devastates" and left the rest to be discovered by being on the
 * receiving end. Five consequences and one survival line, every number read from
 * `DEATH_STAR` and `MULTI_WORLD` so the card cannot drift from the strike.
 */
function DeathStarEffects() {
  const { t } = useTranslation();
  const lines = [
    t('planet.deathStar.effectFleet'),
    t('planet.deathStar.effectStock'),
    t('planet.deathStar.effectCore'),
    t('planet.deathStar.effectAegis', { levels: DEATH_STAR.aegisLevelsLost }),
    t('planet.deathStar.effectDark', { duration: duration(MULTI_WORLD.recoveryMinutes) }),
  ];
  /**
   * `plate-inset` and NOT `plate-threat`. The lit states are reserved for a plate
   * that is doing something right now — this one explains, which is reference and
   * not state, so it is machined into the same face with no lift and no glow. The
   * red lives where red belongs: on the marks and the legend, as `threat-ink`.
   */
  return (
    <div className="plate plate-inset mt-3 flex flex-col gap-2 p-3">
      <p className="legend text-threat-ink">{t('planet.deathStar.effectsTitle')}</p>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li key={line} className="flex gap-2 text-caption text-bone">
            <span aria-hidden className="text-threat-ink">▪</span>
            <span>{line}</span>
          </li>
        ))}
        {/* What a strike CANNOT take, in the opposite hue. Half of understanding
            a weapon is knowing where it stops. */}
        <li className="flex gap-2 text-caption text-dim">
          <span aria-hidden className="text-opportunity">▪</span>
          <span>{t('planet.deathStar.effectSurvives')}</span>
        </li>
      </ul>
    </div>
  );
}

function DeathStarNeed({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      role="listitem"
      data-met={ok ? 'true' : 'false'}
      className="legend death-star-need flex min-h-9 items-center gap-2 rounded-chip border px-2 py-1"
    >
      <span aria-hidden>{ok ? '●' : '○'}</span>
      {children}
    </span>
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
  // Opaque, because it is sticky: at 95% the rows scrolling underneath ghosted
  // through the wallet figures, which are the one thing on it a player reads
  // against a price.
  return (
    <div className="sticky top-0 z-20 border-y border-line-soft bg-deep">
      <Wallet held={held} />
      {/*
        `data-tab` is how a surface outside this screen points at a category: the
        onboarding lights the one a beat is working in, because a dimmed screen
        with one live control still has to say WHERE that control is.
      */}
      <Segmented
        flush
        marker="tab"
        role="tablist"
        label={t('planet.tabs.label')}
        segments={TABS.map((id) => ({ id, label: t(GROUPS[id].problem) }))}
        value={active}
        onSelect={onSelect}
        tabId={(id) => `planet-tab-${id}`}
        panelId={(id) => `planet-panel-${id}`}
      />
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

  const exposed = Math.max(
    0,
    planet.planet.alloy
      + planet.planet.crystal
      + planet.planet.deuterium
      - planet.planet.vaultFloor,
  );
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
  (['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'HANGAR'] as const).filter(
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
    const blocked: Blocked | undefined =
      id !== 'CORE' && nextLevel >= core
        ? {
            reason: i18n.t('planet.blocked.core', { level: core + 1 }),
            onFix: () => { onNeed('CORE'); },
          }
        : orders.length >= BUILD.queueDepth
          ? { reason: i18n.t('planet.blocked.queueFull') }
        : plantCapped
          ? {
              reason: i18n.t('planet.blocked.plantRung'),
              onFix: () => { onNeed('DEUTERIUM_SYNTHESIS'); },
            }
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
    const blocked: Blocked | undefined = completed
      ? undefined
      : needsUplink
        ? { reason: i18n.t('planet.blocked.uplink'), onFix: () => { onNeed('UPLINK'); } }
        : nextLevel >= core
          ? {
              reason: i18n.t('planet.blocked.core', { level: core + 1 }),
              onFix: () => { onNeed('CORE'); },
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
 * Command Core opens one at L1, L3, L5 and L9. So the refusal here is not "you
 * cannot have this", it is "not while those are up there", and it points at the
 * Core because raising it is the thing that actually fixes it.
 */
function useOrbitAction(planet: PlanetView, onFlash: (id: string) => void) {
  const install = useInstallSatellite();
  const say = useToast();
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const free = satelliteSlots(projected.buildings.CORE) - projected.orbit.length;
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
  const { t } = useTranslation();
  const name = satelliteLabel(id);
  const role = satelliteRole(id);
  const inactive = planet.orbit.includes(id)
    && !(planet.effectiveOrbit ?? planet.orbit).includes(id);
  return (
    <div id={`row-${id}`}>
      <UpgradeRow
        art={SATELLITE_ART[id]}
        name={name}
        tag={satelliteTag(id)}
        role={role}
        onOpen={() => { onOpen(spec({ kind: 'satellite', id }, name, role, action)); }}
        gain={satelliteGain(id)}
        cost={action.cost}
        held={held}
        income={income}
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
  const instrument = useInstrumentAction(planet, onFlash);
  const vault = building('VAULT', buildingName('VAULT'), onNeed);
  const aegis = instrument('AEGIS', instrumentLabel('AEGIS'), onNeed);
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const bastion = HULLS.BASTION;
  const thorn = HULLS.THORN;
  const yardOrders = planet.queues?.YARD ?? [];
  const yardProjection = projectedQueueState(planet, 'YARD');
  const queuedThorns = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'THORN')
    .reduce((sum, order) => sum + order.count, 0);
  const queuedBastions = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'BASTION')
    .reduce((sum, order) => sum + order.count, 0);
  const ground = fleetCount(planet.ground);
  const groundCapacity = planet.capacity?.ground ?? groundSlots(planet.buildings.CORE ?? 0);
  const groundUsed = groundLoad(yardProjection.units);
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

      <Band label={t('planet.defend.shieldBand')} note={t('planet.defend.shieldNote')} />
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

      {/*
        TWO GUNS, AND THE BAND SAYS WHY THERE ARE TWO. D27.

        A defender used to have no composition choice at all — one ground hull meant
        "how much" was the whole decision. These two are opposite classes, so what a
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
      <div className="px-3 py-2">
        <CapacityBar
          total={groundCapacity}
          used={groundUsed}
          incoming={0}
          label={t('planet.defend.groundBand')}
        />
      </div>

      <div id="row-THORN">
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

      <div id="row-BASTION">
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

      <Band
        label={t('planet.defend.strategicBand')}
        note={t('planet.defend.strategicNote')}
      />
      <InterceptorBattery planet={planet} held={held} onNeed={onNeed} />
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
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const charge = planet.interceptor ?? null;
  const grid = planet.research.some(
    (project) => project.id === ANTI_STRATEGIC.requiredResearch && project.completed,
  );
  const uplink = projected.effectiveOrbit.includes('UPLINK');
  const radar = uplink
    ? Math.min(projected.instruments.RADAR ?? 0, projected.buildings.CORE)
    : 0;
  const radarReady = interceptionRange(radar) > 0;
  const recovering = planet.planet.recoveryUntil !== null
    && planet.planet.recoveryUntil !== undefined
    && planet.planet.recoveryUntil.getTime() > serverNow();
  const affordable = held.alloy >= ANTI_STRATEGIC.cost.alloy
    && held.crystal >= ANTI_STRATEGIC.cost.crystal
    && held.deuterium >= ANTI_STRATEGIC.cost.deuterium;
  const state = charge
    ? charge.status
    : grid && radarReady
      ? 'AVAILABLE'
      : 'LOCKED';

  return (
    <div
      data-interceptor-state={state}
      className="plate flex flex-col gap-2 border-b border-line-soft p-3 last:border-b-0"
    >
      <div className="flex items-center gap-3">
        <img
          data-interceptor-art
          src={STRATEGIC_ART.interceptor}
          alt=""
          aria-hidden
          className="size-16 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="legend text-crystal/85">{t('planet.interceptor.eyebrow')}</p>
          <p className="headline text-bone">
            {charge?.status === 'READY'
              ? t('planet.interceptor.ready')
              : charge?.status === 'PAUSED'
                ? t('planet.interceptor.paused')
                : charge?.status === 'BUILDING'
                  ? t('planet.interceptor.building', {
                      duration: charge.readyAt
                        ? duration(Math.max(0, charge.readyAt.getTime() - serverNow()) / 60_000)
                        : duration((charge.remainingSeconds ?? 0) / 60),
                    })
                  : t('planet.interceptor.none')}
          </p>
          <p className="text-caption leading-snug text-dim">
            {t(charge?.status === 'READY'
              ? 'planet.interceptor.readyHint'
              : 'planet.interceptor.hint')}
          </p>
        </div>
      </div>

      {/*
        THE REQUIREMENTS STAY ON SCREEN UNTIL A CHARGE EXISTS, and each is a door
        rather than an alarm: the research and the Radar both point at the surface
        that would close them.
      */}
      {charge === null && (
        <>
          <div className="grid grid-cols-2 gap-2" role="list">
            <DeathStarNeed ok={grid}>{t('planet.interceptor.needResearch')}</DeathStarNeed>
            <DeathStarNeed ok={uplink}>{t('planet.interceptor.needUplink')}</DeathStarNeed>
            <DeathStarNeed ok={radarReady}>
              {t('planet.interceptor.needRadar', { level: ANTI_STRATEGIC.requiredRadar })}
            </DeathStarNeed>
            <DeathStarNeed ok={!recovering}>
              {t('planet.interceptor.needOperational')}
            </DeathStarNeed>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>
              <Price cost={ANTI_STRATEGIC.cost} held={held} />
              <p className="legend mt-1">
                {t('planet.interceptor.buildTime', {
                  duration: duration(ANTI_STRATEGIC.buildMinutes),
                })}
              </p>
            </div>
            <Button
              variant="commit"
              disabled={recovering || load.isPending || !grid || !radarReady || !affordable}
              onClick={() => {
                if (!grid) { onNeed('RADAR'); return; }
                load.mutate(undefined, {
                  onSuccess: () => { say(t('planet.interceptor.started')); },
                  onError: (error) => { say(describe(error), 'error'); },
                });
              }}
            >
              {t('planet.interceptor.build')}
            </Button>
          </div>
        </>
      )}
    </div>
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

      <Band
        label={t('planet.orbit.intelBand')}
        note={t('planet.orbit.intelNote')}
      />

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
    </>
  );
}

/**
 * WHAT THE RACK BELOW CANNOT SAY, AND NOTHING IT ALREADY SAYS. D142.
 *
 * This docblock used to promise "filled pips for what is up, empty ones for what
 * is open" and the code printed `2 / 4 slots used` — a description of a picture
 * that had been replaced by its own caption. It was also the THIRD statement of
 * the same fact on one header: `OrbitRack` sits directly underneath and draws
 * every socket at full size, with its art in the taken ones and a dashed outline
 * on the free ones.
 *
 * So the fraction is gone and what is left is the half no rack can draw: that
 * there are no sockets left, or which Core level opens the next one. A player who
 * reads this before shopping never meets the refusal — which was always the point
 * of the line, and never the point of the numbers in it.
 */
function OrbitSlotCount({ slots, used, core }: { slots: number; used: number; core: number }) {
  const { t } = useTranslation();
  const next = ORBIT_UNLOCKS.find((level) => level > core);

  return (
    <span className="num text-label text-dim">
      {used >= slots ? (
        /*
          AMBER, NOT RED (interface.md I0/I1). A full rack is a ceiling the
          commander can raise by building a Core level; it is not something being
          done to them, and threat red spent here is threat red a player learns to
          ignore where it means an attack.
        */
        <span className="text-alloy">{t('planet.orbit.slotsNone')}</span>
      ) : next !== undefined ? (
        <span className="text-faint">{t('planet.orbit.slotsNext', { level: next })}</span>
      ) : null}
      <span className="sr-only">{t('planet.orbit.slotsUsed', { used, total: slots })}</span>
    </span>
  );
}

function OrbitRack({ slots, orbit }: { slots: number; orbit: SatelliteId[] }) {
  const { t } = useTranslation();
  return (
    <div
      className="grid gap-2 border-b border-line-soft bg-void/15 p-3"
      style={{ gridTemplateColumns: `repeat(${String(Math.max(1, slots))}, minmax(0, 1fr))` }}
      aria-label={t('planet.orbit.rackLabel')}
    >
      {Array.from({ length: Math.max(1, slots) }, (_, index) => {
        const satellite = orbit[index];
        return (
          <div
            key={index}
            className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center rounded-chip border px-1 py-2 ${ satellite ? 'border-crystal/30 bg-crystal/[0.06]' : 'border-dashed border-line bg-void/30' }`}
          >
            <span className="num absolute left-1.5 top-1 text-micro text-faint">{index + 1}</span>
            {satellite ? (
              <>
                <img
                  src={SATELLITE_ART[satellite]}
                  alt=""
                  aria-hidden
                  className="size-8 object-contain"
                />
                <span className="legend mt-1 w-full truncate text-center text-bone">
                  {satelliteLabel(satellite)}
                </span>
              </>
            ) : (
              <span className="text-micro text-faint">{t('planet.orbit.slotEmpty')}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * THE SHARED COST OF FOUR DECISIONS.
 *
 * Satellites now live beside the outcome they create, but all four still consume
 * the same scarce sockets. Keeping the rack above every category makes that trade
 * visible before a player opens any one of them (D108).
 */
function OrbitContext({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const projected = projectedQueueState(planet, 'CONSTRUCTION');
  const slots = satelliteSlots(projected.buildings.CORE);
  return (
    <section className="plate plate-inset overflow-hidden" aria-label={t('planet.orbit.contextLabel')}>
      <div className="flex items-baseline gap-2 border-b border-line-soft bg-void/30 px-3 py-2">
        <h2 className="legend text-crystal/85">
          {t('planet.orbit.contextLabel')}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-line-soft to-transparent" />
        <OrbitSlotCount slots={slots} used={projected.orbit.length} core={projected.buildings.CORE} />
      </div>
      <OrbitRack slots={slots} orbit={projected.orbit} />
    </section>
  );
}

const RESEARCH_RUNG = ['', 'I', 'II', 'III', 'IV', 'V'] as const;

/** First actionable catalog gate for a hull; no hull identity is hard-coded here. */
function hullAccessBlock(
  id: HullId,
  shipyard: number,
  state: ProjectedQueueState,
  onNeed: (id: string) => void,
): Blocked | undefined {
  const missing = HULLS[id].requiredResearch.find(
    ({ project, level }) => (state.research.get(project) ?? 0) < level,
  );
  if (missing) {
    return {
      reason: i18n.t('planet.blocked.research', {
        research: researchName(missing.project),
        level: RESEARCH_RUNG[missing.level] ?? `L${String(missing.level)}`,
      }),
      onFix: () => { onNeed(missing.project); },
    };
  }
  const minimum = HULLS[id].minShipyard;
  if (shipyard < minimum) {
    return {
      reason: i18n.t('planet.blocked.shipyard', { level: minimum }),
      onFix: () => { onNeed('SHIPYARD'); },
    };
  }
  return undefined;
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
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const { t } = useTranslation();
  const building = useBuildingAction(planet, onFlash);
  const orbit = useOrbitAction(planet, onFlash);
  const shipyard = building('SHIPYARD', buildingName('SHIPYARD'), onNeed);
  const hangar = building('HANGAR', buildingName('HANGAR'), onNeed);
  const level = planet.buildings.SHIPYARD ?? 0;
  const yardOrders = planet.queues?.YARD ?? [];
  const yardProjection = projectedQueueState(planet, 'YARD');
  const hangarTotal = planet.capacity?.hangar ?? hangarCapacity(planet.buildings.HANGAR ?? 0);
  const hangarUsed = hangarLoad(yardProjection.units);
  const groundTotal = planet.capacity?.ground ?? groundSlots(planet.buildings.CORE ?? 0);
  const groundUsed = groundLoad(yardProjection.units);
  const hull = (id: HullId) => {
    const hullSpec = HULLS[id];
    const home = (planet.fleet[id] ?? 0) + (planet.ground[id] ?? 0);
    const away = planet.fleetAway[id] ?? 0;
    // "You have" is ownership, not readiness. A craft in flight is still owned,
    // and for the Prospector that distinction is also the hard build cap.
    const owned = home + away;
    const committed = yardProjection.units[id] ?? owned;
    const prospectorCapped = id === 'PROSPECTOR' && committed >= PROSPECTOR.max;
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
        art={HULL_ART[id]}
        name={hullLabel(id)}
        nameAside={t('planet.reach.hullLocationCounts', { home: full(home), away: full(away) })}
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
        gain={{
          label: queued ? t('planet.queue.afterQueue') : t('planet.reach.ownedGain'),
          now: String(queued ? committed : owned),
          next: String(committed + 1),
        }}
        {...(prospectorCapped || capacityCapped
          ? {
              completed: prospectorCapped
                ? t('planet.reach.prospectorLimit', { owned: committed, max: PROSPECTOR.max })
                : t('planet.capacity.full', { used: poolUsed, total: poolTotal }),
            }
          : {})}
        cost={{
          alloy: hullSpec.alloy,
          crystal: hullSpec.crystal,
          deuterium: hullSpec.deuterium,
        }}
        held={held}
        income={income}
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
      <div id="row-SHIPYARD">
        <UpgradeRow
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

      <div id="row-HANGAR">
        <UpgradeRow
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
        THE HANGAR, AND THE FIGURE ON IT USED TO BE IN THE WRONG UNIT. Owner report.

        This passed `hangarTotal - hangarUsed` — a quantity of SPACE — into `fits`,
        which the card renders at readout size under the words "more fit". So a
        commander with 185 units of deck free read "185 more fit" and reasonably
        concluded they could build a hundred and eighty-five ships. The ground band
        beside it passed a real Thorn count into the same slot: one label, two
        units, on two cards a thumb-scroll apart.

        Nothing is being chosen on this tab, so it is a ROOM card: the bar, and
        space used against space free. A count of ships belongs where a ship has
        been named, which is the craft sheet.
      */}
      <Band label={t('planet.capacity.hangarBand')} />
      <div className="px-3 py-2">
        <CapacityBar
          total={hangarTotal}
          used={hangarUsed}
          incoming={0}
          label={t('planet.capacity.hangarBand')}
        />
      </div>

      <Band label={t('planet.reach.orbitBand')} note={t('planet.reach.orbitNote')} />
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

      {FLEET_FAMILY_ORDER.map((family) => (
        <section
          key={family}
          data-hull-family-group={family}
          style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 720px' }}
        >
          <Band
            label={t(`planet.reach.family.${family}.label`)}
            note={t(`planet.reach.family.${family}.note`)}
          />
          {HULLS_BY_FAMILY[family].map(hull)}
        </section>
      ))}

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


function Grow({ planet, held, income, focused, flashed, onNeed, onFlash, onOpen }: GroupProps) {
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
  const capped = cappedCountOf(core.projectedLevels);
  const production = productionMult(
    projectedQueueState(planet, 'CONSTRUCTION').effectiveOrbit,
  );

  return (
    <>
      <div id="row-CORE">
        <UpgradeRow
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
        )}
        cost={refinery.cost}
        held={held}
        income={income}
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
        )}
        cost={extractor.cost}
        held={held}
        income={income}
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
        )}
        cost={plant.cost}
        held={held}
        income={income}
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

      <Band label={t('planet.grow.multiplierBand')} note={t('planet.grow.multiplierNote')} />
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
    </>
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

  /**
   * A PROSPECTOR IS RATIONED, AND THE SHEET HAS TO SAY SO.
   *
   * `PROSPECTOR.max` is a hard limit on how many a planet may OWN, so it counts
   * craft that are away mining as well as those on the ground — the server does the
   * same, and this is the only reason `fleetAway` is on the payload. Without it the
   * picker offered 1 / 5 / 25 / Max for a hull you may hold two of.
   *
   * The server refuses over the cap regardless (Principle 1 — the client never
   * decides an outcome); this exists so the control never offers what will be
   * refused.
   */
  const yardProjection = projectedQueueState(planet, 'YARD');
  const owned = (planet.fleet[hull] ?? 0)
    + (planet.ground[hull] ?? 0)
    + (planet.fleetAway[hull] ?? 0);
  const committed = yardProjection.units[hull] ?? owned;
  const countCap = hull === 'PROSPECTOR'
    ? Math.max(0, PROSPECTOR.max - committed)
    : Number.MAX_SAFE_INTEGER;
  const poolTotal = spec.ground
    ? planet.capacity?.ground ?? groundSlots(planet.buildings.CORE ?? 0)
    : planet.capacity?.hangar ?? hangarCapacity(planet.buildings.HANGAR ?? 0);
  const poolUsed = spec.ground
    ? groundLoad(yardProjection.units)
    : hangarLoad(yardProjection.units);
  const bulk = hullBulk(hull);
  const spaceCap = Math.max(0, Math.floor((poolTotal - poolUsed) / bulk));
  const cap = Math.min(countCap, spaceCap);
  const prospectorCapped = hull === 'PROSPECTOR' && countCap === 0;
  const capacityCapped = spaceCap === 0;
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const accessBlock = hullAccessBlock(hull, shipyard, yardProjection, onNeed);
  const blocked: Blocked | undefined = accessBlock
    ?? ((planet.queues?.YARD.length ?? 0) >= BUILD.queueDepth
      ? { reason: t('planet.blocked.queueFull') }
      : undefined);

  const affordable = Math.min(
    Math.floor(held.alloy / spec.alloy),
    spec.crystal > 0 ? Math.floor(held.crystal / spec.crystal) : Number.MAX_SAFE_INTEGER,
    spec.deuterium > 0
      ? Math.floor(held.deuterium / spec.deuterium)
      : Number.MAX_SAFE_INTEGER,
  );
  const room = Math.min(affordable, cap);
  const ceiling = Math.max(1, room);
  const [count, setCount] = useState(1);
  const clamped = Math.min(count, ceiling);
  const totalAlloy = spec.alloy * clamped;
  const totalCrystal = spec.crystal * clamped;
  const totalDeuterium = spec.deuterium * clamped;
  const defenceAfterQueue = fleetCount(yardProjection.units);
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
      footer={prospectorCapped || capacityCapped ? undefined : (
        /*
          `data-commit` is this sheet's own commitment, and `data-ready` appears
          only once the count is at the ceiling. The onboarding lights the ceiling
          option first and then moves to here, so the opening grant is spent in one
          press rather than one ship at a time.
        */
        <span data-act data-commit {...(clamped === ceiling ? { 'data-ready': true } : {})}>
        <ActionButton
          verb="build"
          cost={{ alloy: totalAlloy, crystal: totalCrystal, deuterium: totalDeuterium }}
          held={held}
          pending={build.isPending}
          {...(blocked
            ? {
                blocked: {
                  reason: blocked.reason,
                  ...(blocked.onFix
                    ? {
                        onFix: () => {
                          blocked.onFix?.();
                          onClose();
                        },
                      }
                    : {}),
                },
              }
            : {})}
          full
          label={t('planet.buildSheet.build', { count: clamped })}
          onAct={() => {
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
          }}
        />
        </span>
      )}
    >
      <div data-build-art className="art-well relative flex justify-center py-4">
        {art ? <img src={art} alt={hullLabel(hull)} className="h-28 object-contain" /> : null}

        {!prospectorCapped && !capacityCapped ? (
          <div data-build-price className="absolute left-1 top-1">
            <Price
              cost={{ alloy: totalAlloy, crystal: totalCrystal, deuterium: totalDeuterium }}
              held={held}
            />
          </div>
        ) : null}

        <div
          data-build-stats
          className="absolute right-1 top-1 origin-top-right scale-50"
        >
          <StatStrip
            atk={spec.atk}
            hp={spec.hp}
            speed={spec.speed}
            cargo={spec.cargo}
            fuel={hullFuelRate(hull)}
            // The same figure this sheet caps the order with, a dozen lines up.
            room={bulk}
            size="card"
          />
        </div>
      </div>

      <p className="legend text-crystal/85">{hullTag(hull)}</p>
      <p className="mt-2 text-body leading-relaxed text-dim">{hullPitch(hull)}</p>
      <p data-item-detail className="mt-2 text-caption leading-relaxed text-faint">
        {hullDetail(hull)}
      </p>

      {/*
        A REQUIREMENT IS A DOOR, NOT AN ALARM (interface.md I1), and this was the
        build sheet's copy of the same red the item sheet had. Amber is the game's
        word for a gap the commander can close; red is reserved for something that
        can harm them.
      */}
      {blocked && (
        <p className="mt-4 border border-alloy/30 bg-alloy/10 px-3 py-2 text-caption leading-snug text-alloy">
          {t('itemSheet.lockedNote', { reason: blocked.reason })}
        </p>
      )}

      <div className="mt-6">
        <p className="legend mb-2">{t('planet.buildSheet.howMany')}</p>
        {prospectorCapped || capacityCapped ? (
          <p className="text-body leading-relaxed text-amber">
            {prospectorCapped
              ? t('planet.buildSheet.capped', { count: committed })
              : t('planet.capacity.full', { used: poolUsed, total: poolTotal })}
          </p>
        ) : (
          <div className="mb-1">
            <QuantityStepper
              value={clamped}
              min={1}
              max={ceiling}
              onChange={setCount}
              decreaseLabel={t('planet.buildSheet.fewer', { name: hullLabel(hull) })}
              increaseLabel={t('planet.buildSheet.more', { name: hullLabel(hull) })}
              valueLabel={t('planet.buildSheet.quantity', { name: hullLabel(hull) })}
              maxLabel={t('planet.buildSheet.max', { name: hullLabel(hull) })}
              maxText={t('planet.buildSheet.maxShort')}
              resetLabel={t('planet.buildSheet.reset', { name: hullLabel(hull) })}
              resetText={t('planet.buildSheet.resetShort')}
            />
          </div>
        )}
        {cap !== Number.MAX_SAFE_INTEGER && room > 0 && (
          <p className="mt-2 text-caption text-faint">
            {t('planet.buildSheet.heldOfMax', { owned: committed, max: PROSPECTOR.max })}
          </p>
        )}
        {/*
          THE ROOM, AS A PICTURE. Owner instruction.

          This was one line of small grey text carrying three numbers — what one of
          these takes, what is used, and the ceiling — and the report was that none
          of the three questions it answers could be answered from it at a glance.
          `CapacityBar` draws them instead, and the segment for THIS order moves
          under the stepper directly above it, so pressing "+" and watching the room
          go is the rule teaching itself.
        */}
        <div className="mt-3">
          <CapacityBar
            total={poolTotal}
            used={poolUsed}
            incoming={prospectorCapped || capacityCapped ? 0 : bulk * clamped}
            bulk={bulk}
            fits={spaceCap}
            {...(art ? { icon: (
              <img src={art} alt="" aria-hidden className="size-8 shrink-0 object-contain" />
            ) } : {})}
          />
        </div>
      </div>

      {!prospectorCapped && !capacityCapped && (
        <p className="num mt-6 text-caption text-faint">
          {t('planet.buildSheet.defenceAfter', { count: defenceAfterQueue + clamped })}
        </p>
      )}
    </Sheet>
  );
}
