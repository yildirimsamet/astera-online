import { GameActions } from '../session/seasonLock.js';
import { useEffect, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Unreachable, Waiting } from '../ui/kit/Surface.js';
import {
  BUILD,
  HULLS,
  DEATH_STAR,
  PROSPECTOR,
  cancelRefund,
  fleetCount,
  instrumentCost,
  instrumentMaxed,
  satelliteSlots,
  satelliteCost,
  upgradeCost,
  type BuildingId,
  type BuildingLevels,
  type HullId,
  type InstrumentId,
  type ResearchProjectId,
  type SatelliteId,
} from '@astera/rules';
import {
  useGalaxy,
  useIntel,
  usePending,
  usePlanet,
  useBuild,
  useCancelBuildOrder,
  useCompleteResearch,
  useInstallSatellite,
  useRaiseInstrument,
  useUpgrade,
  useBuildDeathStar,
} from '../api/queries.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';

import { directives, primary, type PlanetGroup } from '../lib/directives.js';
import { compact, full } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { projectedQueueState } from '../lib/predict.js';
import { buildingGain, instrumentGain, satelliteGain } from '../lib/gains.js';
import { useProjected, type Projected } from '../lib/projection.js';
import {
  HULL_ART,
  RESEARCH_ART,
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

interface ProjectSheetSpec {
  name: string;
  tag: string;
  role: string;
  art: string;
  cost: { alloy: number; crystal: number; deuterium?: number };
  blocked?: Blocked;
  completed?: string;
  queued?: string;
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
  const [projectSheet, setProjectSheet] = useState<ProjectSheetSpec | null>(null);
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
    onOpenProject: setProjectSheet,
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

      {projectSheet && (
        <ProjectSheet
          spec={projectSheet}
          held={held}
          onClose={() => { setProjectSheet(null); }}
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
  DERRICK: 'reach',
  BEACON: 'reach',
  SHIPYARD: 'reach',
  ISOTOPE_SPECTROMETRY: 'reach',
  DENSE_FUEL_CELLS: 'reach',
  GRAVITIC_CHARGES: 'reach',
  DEATH_STAR_PROTOCOL: 'reach',
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
      <BuildQueueLane
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
      <BuildQueueLane
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

function BuildQueueLane({
  label,
  orders,
  now,
  cancelling,
  onCancel,
}: {
  label: string;
  orders: readonly BuildOrderView[];
  now: number;
  cancelling?: string;
  onCancel: (order: BuildOrderView) => void;
}) {
  const { t } = useTranslation();

  /**
   * A LANE WITH NOTHING IN IT IS ONE LINE, NOT THREE.
   *
   * I6b still holds — every slot is visible and visibly empty — but a rack shown
   * at the density of its contents is the point of a rack. Two idle lanes drawn
   * as six stacked rows put two hundred pixels of dashes between a commander and
   * the first thing they can press, on the screen where pressing something is the
   * entire job. Empty collapses to a row of cells beside the label; the moment an
   * order lands, the lane opens into rows that can carry a name and a clock.
   */
  if (orders.length === 0) {
    return (
      <div className="flex items-center gap-3 border-b border-line-soft px-3 py-3 last:border-b-0">
        <h3 className="legend text-crystal/80">{label}</h3>
        <span className="flex flex-1 gap-1" aria-label={t('planet.queue.slotFree')}>
          {Array.from({ length: BUILD.queueDepth }, (_, slot) => (
            <span
              key={slot}
              aria-hidden
              className="h-4 flex-1 rounded-cell border border-dashed border-line-soft"
            />
          ))}
        </span>
        <span className="num shrink-0 text-micro text-faint">
          0/{BUILD.queueDepth}
        </span>
      </div>
    );
  }

  return (
    <div className="border-b border-line-soft px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="legend text-crystal/80">
          {label}
        </h3>
        <span className="num text-micro text-faint">
          {orders.length}/{BUILD.queueDepth}
        </span>
      </div>
      {/*
        EVERY SLOT IS DRAWN, INCLUDING THE EMPTY ONES. `interface.md` I6b:
        anything rationed into slots is a RACK, every owned slot holds a stable
        position, and an empty slot stays visible and visibly empty. This lane
        rendered a fraction and, when nothing was queued, the sentence "No work
        committed" — an apology in the one place on the main screen where a player
        needs to see how much room they have left. The kit's own `EmptyState`
        docblock had already settled the principle: an empty state is an
        instruction, never an apology. A rack does not need either.
      */}
      <ol className="flex flex-col gap-2">
          {Array.from({ length: BUILD.queueDepth }, (_, slot) => {
            const order = orders[slot];
            if (!order) {
              return (
                <li
                  key={`empty-${String(slot)}`}
                  aria-label={t('planet.queue.slotFree')}
                  className="flex h-7 items-center gap-2 rounded-chip border border-dashed border-line-soft px-3"
                >
                  <span aria-hidden className="num text-micro text-faint">{slot + 1}</span>
                </li>
              );
            }
            const index = slot;
            return ((order) => {
            const startedAt = order.startedAt;
            const finishesAt = order.finishesAt;
            const timed = startedAt instanceof Date && finishesAt instanceof Date;
            const staged = 'staged' in order && order.staged;
            const total = timed ? finishesAt.getTime() - startedAt.getTime() : 0;
            const elapsed = timed ? now - startedAt.getTime() : 0;
            const progress = index === 0 && total > 0
              ? Math.max(0, Math.min(1, elapsed / total))
              : 0;
            const refund = cancelRefund(order.cost);
            return (
              <li key={order.id} className="rounded-chip border border-line-soft bg-void/25 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="num text-micro text-faint">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-caption text-bone">
                    {order.count > 1 ? `${String(order.count)} × ` : ''}{buildOrderName(order)}
                  </span>
                  <span className="num shrink-0 text-label text-crystal">
                    {timed
                      ? countdown(finishesAt.getTime() - now)
                      : staged
                        ? t('planet.queue.staged')
                        : t('planet.queue.committing')}
                  </span>
                  <button
                    type="button"
                    disabled={!timed || cancelling !== undefined}
                    title={t('planet.queue.refund', {
                      alloy: full(refund.alloy),
                      crystal: full(refund.crystal),
                      deuterium: full(refund.deuterium),
                    })}
                    className="legend min-h-9 shrink-0 rounded-chip px-2 text-faint transition-colors hover:bg-threat/15 hover:text-threat-ink disabled:opacity-40"
                    onClick={() => {
                      // An optimistic marker has no server id yet. Let the
                      // placement response replace it before cancellation is
                      // offered, or this button can only send a guaranteed 404.
                      if (timed) onCancel(order);
                    }}
                  >
                    {cancelling === order.id ? t('planet.queue.cancelling') : t('planet.queue.cancel')}
                  </button>
                </div>
                {index === 0 && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/45">
                    <span
                      className="block h-full bg-gradient-to-r from-crystal/45 to-crystal transition-[width] duration-1000"
                      style={{ width: `${String(Math.max(timed ? 2 : 8, progress * 100))}%` }}
                    />
                  </div>
                )}
              </li>
            );
            })(order);
          })}
        </ol>
    </div>
  );
}

function buildOrderName(order: BuildOrderView): string {
  if (order.kind === 'BUILDING') return buildingName(order.subject as BuildingId);
  if (order.kind === 'HULL') return hullLabel(order.subject as HullId);
  if (order.kind === 'INSTRUMENT') return instrumentLabel(order.subject as InstrumentId);
  if (order.kind === 'SATELLITE') return satelliteLabel(order.subject as SatelliteId);
  if (order.subject === 'ISOTOPE_SPECTROMETRY') return i18n.t('planet.reach.isotopeName');
  if (order.subject === 'DENSE_FUEL_CELLS') return i18n.t('planet.reach.denseName');
  if (order.subject === 'GRAVITIC_CHARGES') return i18n.t('planet.reach.graviticName');
  if (order.subject === 'DEATH_STAR_PROTOCOL') return i18n.t('planet.reach.deathStarName');
  return order.subject;
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
            <DeathStarNeed ok={core}>{t('planet.deathStar.needCore')}</DeathStarNeed>
            <DeathStarNeed ok={yard}>{t('planet.deathStar.needShipyard')}</DeathStarNeed>
            <DeathStarNeed ok={!recovering}>{t('planet.deathStar.needOperational')}</DeathStarNeed>
          </div>
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
  onOpenProject: (spec: ProjectSheetSpec) => void;
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
    const cost = upgradeCost(nextLevel);
    const queuedCount = orders.filter(
      (order) => order.kind === 'BUILDING' && order.subject === id,
    ).length;
    const queued = queuedCount > 0
      ? i18n.t('planet.queue.queued', { count: queuedCount })
      : undefined;
    const blocked: Blocked | undefined =
      id !== 'CORE' && nextLevel >= core
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
  const queuedThorns = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'THORN')
    .reduce((sum, order) => sum + order.count, 0);
  const queuedBastions = yardOrders
    .filter((order) => order.kind === 'HULL' && order.subject === 'BASTION')
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
 * How much room is left overhead, as a thing rather than a sentence.
 *
 * The slot count is the only rationing left in the whole hardware system, so it
 * gets a picture: filled pips for what is up, empty ones for what is open, and the
 * Core level that opens the next one. A player who reads this before shopping never
 * meets the refusal.
 */
function OrbitSlotCount({ slots, used, core }: { slots: number; used: number; core: number }) {
  const { t } = useTranslation();
  const next = ORBIT_UNLOCKS.find((level) => level > core);

  return (
    <span className="num text-label text-dim">
      {t('planet.orbit.slotsUsed', { used, total: slots })}
      {used >= slots ? (
        <span className="ml-1 text-threat-ink">· {t('planet.orbit.slotsNone')}</span>
      ) : next !== undefined && (
        <span className="text-faint">{t('planet.orbit.slotsNext', { level: next })}</span>
      )}
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
  onOpenProject,
  onBuild,
}: GroupProps & { onBuild: (hull: HullId) => void }) {
  const { t } = useTranslation();
  const building = useBuildingAction(planet, onFlash);
  const orbit = useOrbitAction(planet, onFlash);
  const completeResearch = useCompleteResearch();
  const say = useToast();
  const shipyard = building('SHIPYARD', buildingName('SHIPYARD'), onNeed);
  const level = planet.buildings.SHIPYARD ?? 0;
  const constructionOrders = planet.queues?.CONSTRUCTION ?? [];
  const yardOrders = planet.queues?.YARD ?? [];
  const yardProjection = projectedQueueState(planet, 'YARD');
  const isotope = planet.research.find((project) => project.id === 'ISOTOPE_SPECTROMETRY');
  const dense = planet.research.find((project) => project.id === 'DENSE_FUEL_CELLS');
  const gravitic = planet.research.find((project) => project.id === 'GRAVITIC_CHARGES');
  const denseComplete = dense?.completed ?? false;
  const graviticComplete = gravitic?.completed ?? false;

  const project = (id: ResearchProjectId) => {
    const state = planet.research.find((candidate) => candidate.id === id);
    if (!state) return null;
    const copy = {
      ISOTOPE_SPECTROMETRY: {
        name: t('planet.reach.isotopeName'),
        tag: t('planet.reach.isotopeTag'),
        role: t('planet.reach.isotopeRole'),
      },
      DENSE_FUEL_CELLS: {
        name: t('planet.reach.denseName'),
        tag: t('planet.reach.denseTag'),
        role: t('planet.reach.denseRole'),
      },
      GRAVITIC_CHARGES: {
        name: t('planet.reach.graviticName'),
        tag: t('planet.reach.graviticTag'),
        role: t('planet.reach.graviticRole'),
      },
      DEATH_STAR_PROTOCOL: {
        name: t('planet.reach.deathStarName'),
        tag: t('planet.reach.deathStarTag'),
        role: t('planet.reach.deathStarRole'),
      },
    } satisfies Record<ResearchProjectId, { name: string; tag: string; role: string }>;
    const discoveryReason = id === 'DENSE_FUEL_CELLS'
      ? t('planet.reach.researchCargoInsight')
      : id === 'DEATH_STAR_PROTOCOL'
        ? t('planet.reach.researchGraviticFirst')
        : t('planet.reach.researchShieldInsight');
    const { name, tag, role } = copy[id];
    const completed = state.completed ? t('planet.reach.researchComplete') : undefined;
    const queued = constructionOrders.some(
      (order) => order.kind === 'RESEARCH' && order.subject === id,
    )
      ? t('planet.queue.queued', { count: 1 })
      : undefined;
    const queueAvailable = state.queueAvailable ?? state.available;
    const warGate = id === 'DEATH_STAR_PROTOCOL' && (gravitic?.completed ?? false);
    const blocked: Blocked | undefined = completed
      ? undefined
      : constructionOrders.length >= BUILD.queueDepth
        ? { reason: t('planet.blocked.queueFull') }
      : queueAvailable
        ? undefined
        : !state.discovered
        ? {
            reason: warGate
              ? t('planet.reach.researchWarAt', {
                  duration: duration(
                    Math.max(0, (state.availableAt.getTime() - serverNow()) / 60_000),
                  ),
                })
              : id === 'ISOTOPE_SPECTROMETRY'
              ? t('planet.reach.researchAt', {
                  duration: duration(
                    Math.max(0, (state.availableAt.getTime() - serverNow()) / 60_000),
                  ),
                })
              : isotope?.completed
                ? discoveryReason
                : t('planet.reach.researchIsotopeFirst'),
            ...(id !== 'ISOTOPE_SPECTROMETRY' && !isotope?.completed
              ? { onFix: () => { onNeed('ISOTOPE_SPECTROMETRY'); } }
              : id === 'DEATH_STAR_PROTOCOL' && !gravitic?.completed
                ? { onFix: () => { onNeed('GRAVITIC_CHARGES'); } }
              : {}),
          }
        : !state.available
          ? { reason: discoveryReason }
          : undefined;

    return (
      <div key={id} id={`row-${id}`}>
        <UpgradeRow
          art={RESEARCH_ART[id]}
          name={name}
          tag={tag}
        role={role}
        onOpen={() => {
          onOpenProject({
            name,
            tag,
            role,
            art: RESEARCH_ART[id],
            cost: state.cost,
            ...(blocked ? { blocked } : {}),
            ...(completed ? { completed } : {}),
            ...(queued ? { queued } : {}),
            pending: completeResearch.isPending,
            act: () => {
              completeResearch.mutate(id, {
                onSuccess: () => {
                  onFlash(id);
                  say(t('planet.done.queuedSimple', { name }));
                },
                onError: (error) => { say(describe(error), 'error'); },
              });
            },
          });
        }}
        cost={state.cost}
          held={held}
          income={income}
          unowned={!state.completed}
          {...(blocked ? { blocked } : {})}
          {...(completed ? { completed } : {})}
          {...(queued ? { queued } : {})}
          verb="install"
          actionLabel={t('planet.reach.researchAct')}
          onAct={() => {
            completeResearch.mutate(id, {
              onSuccess: () => {
                onFlash(id);
                say(t('planet.done.queuedSimple', { name }));
              },
              onError: (error) => { say(describe(error), 'error'); },
            });
          }}
          pending={completeResearch.isPending}
          highlighted={focused === id}
          flash={flashed === id}
        />
      </div>
    );
  };

  const hull = (id: HullId) => {
    const hullSpec = HULLS[id];
    // "You have" is ownership, not readiness. A craft in flight is still owned,
    // and for the Prospector that distinction is also the hard build cap.
    const owned = (planet.fleet[id] ?? 0)
      + (planet.ground[id] ?? 0)
      + (planet.fleetAway[id] ?? 0);
    const committed = yardProjection.units[id] ?? owned;
    const prospectorCapped = id === 'PROSPECTOR' && committed >= PROSPECTOR.max;
    const queuedCount = yardOrders
      .filter((order) => order.kind === 'HULL' && order.subject === id)
      .reduce((sum, order) => sum + order.count, 0);
    const queued = queuedCount > 0
      ? t('planet.queue.unitsQueued', { count: queuedCount })
      : undefined;
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
        {...(prospectorCapped
          ? { completed: t('planet.reach.prospectorLimit', { owned: committed, max: PROSPECTOR.max }) }
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
        /**
         * ONE GATE ON EVERY HULL, AND IT IS THE SHIPYARD. D25.
         *
         * The Prospector used to also demand a DRILL satellite, which was wrong
         * twice over: a drill is a craft rather than hardware holding station
         * beside a world, and gating a hull on an orbit slot made mining an
         * all-or-nothing detour. The Derrick in orbit is what makes the craft
         * BETTER; nothing makes it impossible.
         */
        {...(id === 'RUNNER' && !denseComplete
          ? {
              blocked: {
                reason: t('planet.reach.researchDenseFirst'),
                onFix: () => { onNeed('DENSE_FUEL_CELLS'); },
              } satisfies Blocked,
            }
          : id === 'BREACHER' && !graviticComplete
          ? {
              blocked: {
                reason: t('planet.reach.researchGraviticFirst'),
                onFix: () => { onNeed('GRAVITIC_CHARGES'); },
              } satisfies Blocked,
            }
          : level < hullSpec.minShipyard
          ? {
              blocked: {
                reason: t('planet.blocked.shipyard', { level: hullSpec.minShipyard }),
                onFix: () => { onNeed('SHIPYARD'); },
              } satisfies Blocked,
            }
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

      <Band label={t('planet.reach.frontierBand')} note={t('planet.reach.frontierNote')} />
      {project('ISOTOPE_SPECTROMETRY')}
      {project('DENSE_FUEL_CELLS')}
      {project('GRAVITIC_CHARGES')}
      {project('DEATH_STAR_PROTOCOL')}

      <Band label={t('planet.reach.warshipsBand')} note={t('planet.reach.warshipsNote')} />
      {(['WASP', 'LANCE', 'BULWARK', 'BREACHER'] as const).map(hull)}

      <Band label={t('planet.reach.supportBand')} note={t('planet.reach.supportNote')} />
      {hull('HAULER')}
      {hull('RUNNER')}

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
  // Nothing under Grow can be blocked by something on another tab: the Core is the
  // ceiling and the other two sit under it. There is no requirement to jump to.
  const noop = () => undefined;
  const building = useBuildingAction(planet, onFlash);
  const orbit = useOrbitAction(planet, onFlash);
  const core = building('CORE', buildingName('CORE'), noop);
  const refinery = building('REFINERY', buildingName('REFINERY'), noop);
  const extractor = building('EXTRACTOR', buildingName('EXTRACTOR'), noop);
  const capped = cappedCountOf(core.projectedLevels);

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

function ProjectSheet({
  spec,
  held,
  onClose,
}: {
  spec: ProjectSheetSpec;
  held: GroupProps['held'];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-item-sheet>
      <Sheet
        eyebrow={spec.completed ? t('planet.projectSheet.complete') : t('planet.projectSheet.frontier')}
        title={spec.name}
        onClose={onClose}
        footer={(
          <span data-act className="block">
            <ActionButton
              verb="install"
              cost={spec.cost}
              held={held}
              full
              label={t('planet.reach.researchAct')}
              pending={spec.pending}
              {...(spec.completed ? { completed: spec.completed } : {})}
              {...(spec.queued ? { completed: spec.queued } : {})}
              {...(spec.blocked
                ? {
                    blocked: {
                      reason: spec.blocked.reason,
                      ...(spec.blocked.onFix
                        ? {
                            onFix: () => {
                              spec.blocked?.onFix?.();
                              onClose();
                            },
                          }
                        : {}),
                    },
                  }
                : {})}
              onAct={() => {
                spec.act();
                onClose();
              }}
            />
          </span>
        )}
      >
        <div className="item-portrait flex h-48 items-center justify-center overflow-hidden">
          <span aria-hidden className="item-portrait-orbit" />
          <img
            src={spec.art}
            alt={spec.name}
            className={`relative z-[1] h-36 object-contain ${spec.completed ? '' : 'opacity-60 grayscale'}`}
          />
        </div>
        <p className="legend mt-4 text-crystal/85">{spec.tag}</p>
        <p className="mt-2 text-body leading-relaxed text-dim">{spec.role}</p>
        <div className="mt-6 grid grid-cols-[1fr_auto] items-center gap-4 border-y border-line-soft py-3">
          <div>
            <p className="legend">{t('planet.projectSheet.cost')}</p>
            <p className="mt-1 text-label text-faint">{t('planet.projectSheet.once')}</p>
          </div>
          <Price cost={spec.cost} held={held} />
        </div>
        {(spec.blocked ?? spec.queued) && (
          <p className={`mt-4 border px-3 py-2 text-caption leading-snug ${spec.blocked ? 'border-threat/30 bg-threat/10 text-threat' : 'border-crystal/30 bg-crystal/10 text-crystal'}`}>
            {spec.blocked
              ? t('itemSheet.lockedNote', { reason: spec.blocked.reason })
              : spec.queued}
          </p>
        )}
      </Sheet>
    </div>
  );
}

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
  const cap = hull === 'PROSPECTOR'
    ? Math.max(0, PROSPECTOR.max - committed)
    : Number.MAX_SAFE_INTEGER;
  const prospectorCapped = hull === 'PROSPECTOR' && cap === 0;
  const denseComplete = planet.research.some(
    (project) => project.id === 'DENSE_FUEL_CELLS' && project.completed,
  );
  const graviticComplete = planet.research.some(
    (project) => project.id === 'GRAVITIC_CHARGES' && project.completed,
  );
  const shipyard = planet.buildings.SHIPYARD ?? 0;
  const blocked: Blocked | undefined = hull === 'RUNNER' && !denseComplete
    ? {
        reason: t('planet.reach.researchDenseFirst'),
        onFix: () => { onNeed('DENSE_FUEL_CELLS'); },
      }
    : hull === 'BREACHER' && !graviticComplete
      ? {
          reason: t('planet.reach.researchGraviticFirst'),
          onFix: () => { onNeed('GRAVITIC_CHARGES'); },
        }
      : shipyard < spec.minShipyard
        ? {
            reason: t('planet.blocked.shipyard', { level: spec.minShipyard }),
            onFix: () => { onNeed('SHIPYARD'); },
          }
        : (planet.queues?.YARD.length ?? 0) >= BUILD.queueDepth
          ? { reason: t('planet.blocked.queueFull') }
          : undefined;

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
      footer={prospectorCapped ? undefined : (
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
      {art && (
        <div className="art-well flex justify-center py-4">
          <img src={art} alt={hullLabel(hull)} className="h-28 object-contain" />
        </div>
      )}

      <p className="text-body leading-relaxed text-dim">{hullPitch(hull)}</p>

      {blocked && (
        <p className="mt-4 border border-threat/30 bg-threat/10 px-3 py-2 text-caption leading-snug text-threat">
          {t('itemSheet.lockedNote', { reason: blocked.reason })}
        </p>
      )}

      <div className="mt-4">
        <StatStrip atk={spec.atk} hp={spec.hp} speed={spec.speed} cargo={spec.cargo} size="card" />
      </div>

      <div className="mt-6">
        <p className="legend mb-2">{t('planet.buildSheet.howMany')}</p>
        {prospectorCapped ? (
          <p className="text-body leading-relaxed text-amber">
            {t('planet.buildSheet.capped', { count: committed })}
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
            />
          </div>
        )}
        {cap !== Number.MAX_SAFE_INTEGER && room > 0 && (
          <p className="mt-2 text-caption text-faint">
            {t('planet.buildSheet.heldOfMax', { owned: committed, max: PROSPECTOR.max })}
          </p>
        )}
      </div>

      {!prospectorCapped && <div className="mt-6 flex items-baseline justify-between gap-3">
        <Price
          cost={{ alloy: totalAlloy, crystal: totalCrystal, deuterium: totalDeuterium }}
          held={held}
        />
        <p className="num text-caption text-faint">
          {t('planet.buildSheet.defenceAfter', { count: defenceAfterQueue + clamped })}
        </p>
      </div>}
    </Sheet>
  );
}
