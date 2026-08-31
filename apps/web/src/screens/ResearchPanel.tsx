import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BUILD,
  DEUTERIUM,
  RESEARCH_PROJECTS,
  type ResearchProjectId,
} from '@astera/rules';
import { useCompleteResearch, usePlanet } from '../api/queries.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';
import { percent } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { clockTime, duration, useNow } from '../lib/time.js';
import { useProjected } from '../lib/projection.js';
import { RESEARCH_ART } from '../ui/assets.js';
import { researchGain, type Gain } from '../lib/gains.js';
import { ActionButton, Price } from '../ui/Action.js';
import { Band, UpgradeRow, type Blocked } from '../ui/UpgradeRow.js';
import { describe, useToast } from '../ui/Toast.js';
import { Note, Sheet, Unreachable, Waiting } from '../ui/kit/index.js';
import { QueueStrip } from '../ui/QueueStrip.js';

/**
 * EVERY RESEARCH PROJECT, ON ONE SURFACE THAT IS NOT A WORLD. T12.
 *
 * WHY IT IS NOT ON THE PLANET SHEET. Research used to be four cards on the fleet
 * tab, and while a project was a per-planet permission that was the right shelf.
 * T7 moved the levels to the COMMANDER: one ladder, held once, applying to every
 * world at the same time. A screen that lists one world's buildings, instruments
 * and hulls is then the wrong place for the only thing on it that is not about
 * that world — and it showed, because the slot is commander-wide too and nothing
 * on the planet sheet should own it.
 *
 * WHAT WENT WRONG BEFORE THIS EXISTED. Fifteen projects were priced, queued and
 * applied by the server; four of them rendered. T5, T8, T9, T10 and T11 all
 * shipped ladders a player had no control to buy. The row list here is generated
 * from `GROUPED` and `test/research-panel` checks it against
 * `RESEARCH_PROJECT_IDS`, so a sixteenth project cannot be added without a home.
 *
 * WHERE THE ORDER ACTUALLY GOES. Onto the commander's RESEARCH queue. The world
 * in view only pays the cost and supplies its Core level; its Construction and
 * Yard queues remain independent.
 */

/**
 * FOUR GROUPS, AND NONE OF THEM HAS ONE ROW IN IT.
 *
 * The integration plan asked for five and put Cargo Holds in a "Logistics" band on
 * its own. A band with a single row under it is a heading, not a group: it costs a
 * full band of vertical space on a phone to separate one card from the three it
 * belongs with. What you make and what you carry are both industry.
 *
 * FRONTIER IS FIRST because it is the only group whose cards are FOUND rather than
 * bought, so it is the one a player has to read rather than scan.
 */
const GROUPED = [
  {
    id: 'frontier',
    label: 'research.frontierBand',
    note: 'research.frontierNote',
    projects: [
      'ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES', 'DEATH_STAR_PROTOCOL',
    ],
  },
  {
    id: 'industry',
    label: 'research.industryBand',
    note: 'research.industryNote',
    projects: ['DEUTERIUM_SYNTHESIS', 'YARD_AUTOMATION', 'PROSPECTOR_HOLDS', 'CARGO_HOLDS'],
  },
  {
    id: 'doctrine',
    label: 'research.doctrineBand',
    note: 'research.doctrineNote',
    projects: [
      'WASP_DOCTRINE', 'LANCE_DOCTRINE', 'BULWARK_DOCTRINE',
      'EMPLACEMENT_DOCTRINE', 'WEAPONS_GENERAL',
    ],
  },
  {
    id: 'strategic',
    label: 'research.strategicBand',
    note: 'research.strategicNote',
    projects: ['INTERCEPTION_GRID', 'STRATEGIC_STOCKPILE'],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  note: string;
  projects: readonly ResearchProjectId[];
}[];

interface SheetSpec {
  id: ResearchProjectId;
  name: string;
  tag: string;
  role: string;
  detail: string;
  /** What the next rung buys, in the quantity the player feels. */
  gain: Gain;
  cost: { alloy: number; crystal: number; deuterium: number };
  level: number;
  maxLevel: number;
  blocked?: Blocked;
  completed?: string;
  queued?: string;
}

export function ResearchPanel({ onNeed }: { onNeed?: (id: string) => void }) {
  const { t } = useTranslation();
  const { data, dataUpdatedAt, isError, refetch } = usePlanet();
  const held = useProjected(data?.planet, dataUpdatedAt, 5000);
  const research = useCompleteResearch();
  const say = useToast();
  const now = useNow(1000);
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  /**
   * A PREREQUISITE IS THREE ROWS UP, NOT ON ANOTHER SCREEN.
   *
   * `onNeed` hands a refusal to the host, and the Core genuinely lives there. A
   * research prerequisite does not: it is a card on this list, and sending the
   * player to the planet sheet to find it is what `TAB_OF` did by accident once
   * the cards moved — it landed them on a tab with no research on it at all.
   */
  const [focused, setFocused] = useState<ResearchProjectId | null>(null);

  useEffect(() => {
    if (!focused) return;
    document.getElementById(`row-${focused}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const id = window.setTimeout(() => { setFocused(null); }, 2600);
    return () => { window.clearTimeout(id); };
  }, [focused]);

  /**
   * WAKE ON THE MOMENTS THIS SCREEN'S OWN PAYLOAD ALREADY NAMES. D52 · D53.
   *
   * Two of them, and both are the difference between a card that opens by itself
   * and one that needs a page reload:
   *
   *   · THE ACT CLOCK. A Frontier project becomes researchable at an instant the
   *     season fixes, and `availableAt` is on the row. `PlanetScreen` has carried
   *     this wake since the cards lived there; the cards left, so the wake left
   *     with them.
   *   · THE QUEUE. When a rung lands, prerequisites and the next rung change at
   *     once, so the authoritative view is fetched at that named instant.
   *
   * `refetch` and not a poll: "the world is live; the interface never waits for
   * it" means waking at the named moment, not asking every thirty seconds whether
   * it has passed.
   */
  const wakeAt = (() => {
    const instants = [
      ...(data?.research ?? [])
        .filter((project) => !project.discovered && !project.completed)
        .map((project) => project.availableAt.getTime()),
      ...(data?.researchQueue ?? [])
        .filter((queued): queued is typeof queued & { finishesAt: Date } =>
          queued.finishesAt instanceof Date)
        .map((queued) => queued.finishesAt.getTime()),
    ].filter((instant) => instant > serverNow());
    return instants.length === 0 ? null : Math.min(...instants);
  })();

  useEffect(() => {
    if (wakeAt === null) return;
    const id = window.setTimeout(
      () => { void refetch(); },
      // +50ms so the worker's own one-second poll has landed the change first.
      Math.min(Math.max(0, wakeAt - serverNow()) + 50, 2_147_483_647),
    );
    return () => { window.clearTimeout(id); };
  }, [wakeAt, refetch]);

  if (isError) {
    return (
      <Unreachable
        what={t('surface.whatPlanet')}
        onRetry={() => { void refetch(); }}
      />
    );
  }
  if (!data) return <Waiting>{t('surface.waitingPlanet')}</Waiting>;

  const planet = data;
  const researchQueue = planet.researchQueue ?? [];
  const graviticShare = percent(DEUTERIUM.graviticDiscoveryShieldShare);
  const running = researchQueue.find((order) => order.slot === 0 && order.finishesAt instanceof Date);
  const queueOrders: BuildOrderView[] = researchQueue.map((order) => ({
    id: order.id,
    queue: 'CONSTRUCTION',
    slot: order.slot,
    kind: 'RESEARCH',
    subject: order.projectId,
    count: order.level,
    cost: order.cost,
    ...('optimistic' in order
      ? { optimistic: true as const }
      : { startedAt: order.startedAt, finishesAt: order.finishesAt }),
  }));

  const copy = (id: ResearchProjectId): { name: string; tag: string; role: string; detail: string } => {
    switch (id) {
      case 'ISOTOPE_SPECTROMETRY':
        return {
          name: t('research.isotopeName'),
          tag: t('research.isotopeTag'),
          role: t('research.isotopeRole'),
          detail: t('research.isotopeDetail'),
        };
      case 'DENSE_FUEL_CELLS':
        return {
          name: t('research.denseName'),
          tag: t('research.denseTag'),
          role: t('research.denseRole'),
          detail: t('research.denseDetail'),
        };
      case 'GRAVITIC_CHARGES':
        return {
          name: t('research.graviticName'),
          tag: t('research.graviticTag'),
          role: t('research.graviticRole', { share: graviticShare }),
          detail: t('research.graviticDetail'),
        };
      case 'DEATH_STAR_PROTOCOL':
        return {
          name: t('research.deathStarName'),
          tag: t('research.deathStarTag'),
          role: t('research.deathStarRole'),
          detail: t('research.deathStarDetail'),
        };
      case 'DEUTERIUM_SYNTHESIS':
        return {
          name: t('research.synthesisName'),
          tag: t('research.synthesisTag'),
          role: t('research.synthesisRole'),
          detail: t('research.synthesisDetail'),
        };
      case 'YARD_AUTOMATION':
        return {
          name: t('research.yardName'),
          tag: t('research.yardTag'),
          role: t('research.yardRole'),
          detail: t('research.yardDetail'),
        };
      case 'PROSPECTOR_HOLDS':
        return {
          name: t('research.holdsName'),
          tag: t('research.holdsTag'),
          role: t('research.holdsRole'),
          detail: t('research.holdsDetail'),
        };
      case 'CARGO_HOLDS':
        return {
          name: t('research.cargoName'),
          tag: t('research.cargoTag'),
          role: t('research.cargoRole'),
          detail: t('research.cargoDetail'),
        };
      case 'WASP_DOCTRINE':
        return {
          name: t('research.waspDoctrineName'),
          tag: t('research.doctrineTag'),
          role: t('research.doctrineRole'),
          detail: t('research.waspDoctrineDetail'),
        };
      case 'LANCE_DOCTRINE':
        return {
          name: t('research.lanceDoctrineName'),
          tag: t('research.doctrineTag'),
          role: t('research.doctrineRole'),
          detail: t('research.lanceDoctrineDetail'),
        };
      case 'BULWARK_DOCTRINE':
        return {
          name: t('research.bulwarkDoctrineName'),
          tag: t('research.doctrineTag'),
          role: t('research.doctrineRole'),
          detail: t('research.bulwarkDoctrineDetail'),
        };
      case 'EMPLACEMENT_DOCTRINE':
        return {
          name: t('research.groundDoctrineName'),
          tag: t('research.doctrineTag'),
          role: t('research.doctrineRole'),
          detail: t('research.groundDoctrineDetail'),
        };
      case 'WEAPONS_GENERAL':
        return {
          name: t('research.generalName'),
          tag: t('research.generalTag'),
          role: t('research.doctrineRole'),
          detail: t('research.generalDetail'),
        };
      case 'INTERCEPTION_GRID':
        return {
          name: t('research.gridName'),
          tag: t('research.gridTag'),
          role: t('research.gridRole'),
          detail: t('research.gridDetail'),
        };
      case 'STRATEGIC_STOCKPILE':
        return {
          name: t('research.stockpileName'),
          tag: t('research.stockpileTag'),
          role: t('research.stockpileRole'),
          detail: t('research.stockpileDetail'),
        };
    }
  };

  const buy = (id: ResearchProjectId, name: string): void => {
    research.mutate(id, {
      onSuccess: () => { say(t('planet.done.queuedSimple', { name })); },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };

  /**
   * WHY THIS CARD CANNOT BE PRESSED, IN ONE SENTENCE, ALWAYS.
   *
   * Interface I1: a requirement is a door, so it names its fix where there is one.
   * Ordered from the widest refusal to the narrowest, because a card should say the
   * thing that would still be true after everything else was solved.
   *
   *   1. the commander Research queue is full
   *   2. the season has not opened this act yet — no amount of building fixes it
   *   3. the discovery has not happened — a condition to play out, not to buy
   *   4. the Core is too low — the only one that is a build, so it goes last
   */
  const doorOf = (
    id: ResearchProjectId,
    state: PlanetView['research'][number],
    completed: boolean,
  ): Blocked | undefined => {
    if (completed) return undefined;
    if (researchQueue.length >= BUILD.queueDepth) {
      return { reason: t('research.queueFull') };
    }
    const queueAvailable = state.queueAvailable ?? state.available;
    if (!queueAvailable) {
      const isotope = planet.research.find(
        (project) => project.id === 'ISOTOPE_SPECTROMETRY',
      );
      const gravitic = planet.research.find((project) => project.id === 'GRAVITIC_CHARGES');
      const untilOpen = duration(
        Math.max(0, (state.availableAt.getTime() - serverNow()) / 60_000),
      );
      /*
        THE ACT CLOCK FIRST, AND FOR THE PROTOCOL SPECIFICALLY. D113: once Gravitic
        Charges is held, "research Gravitic Charges first" is a false sentence, and
        the true one is that the War act has not opened.
      */
      if (id === 'DEATH_STAR_PROTOCOL' && (gravitic?.completed ?? false)) {
        return { reason: t('research.warAt', { duration: untilOpen }) };
      }
      if (id === 'ISOTOPE_SPECTROMETRY') {
        return { reason: t('research.at', { duration: untilOpen }) };
      }
      if (!state.discovered || !(state.queueDiscovered ?? state.discovered)) {
        if (id === 'DEATH_STAR_PROTOCOL') {
          return {
            reason: t('research.graviticFirst'),
            onFix: () => { setFocused('GRAVITIC_CHARGES'); },
          };
        }
        if (!(isotope?.completed ?? false)) {
          return {
            reason: t('research.isotopeFirst'),
            onFix: () => { setFocused('ISOTOPE_SPECTROMETRY'); },
          };
        }
        return {
          reason: id === 'DENSE_FUEL_CELLS'
            ? t('research.cargoInsight')
            : t('research.shieldInsight', { share: graviticShare }),
        };
      }
      // Discovered, prerequisite met, and still not available: the act clock is
      // the only thing left that can be holding it.
      return { reason: t('research.at', { duration: untilOpen }) };
    }
    const needCore = RESEARCH_PROJECTS[id].requiredCore ?? 0;
    if ((planet.buildings.CORE ?? 0) < needCore) {
      return {
        reason: t('research.needCore', { level: needCore }),
        // The Core lives on the planet sheet. Where the host cannot take us there,
        // the REASON still stands and only the shortcut is missing.
        ...(onNeed ? { onFix: () => { onNeed('CORE'); } } : {}),
      };
    }
    return undefined;
  };

  const row = (id: ResearchProjectId) => {
    const state = planet.research.find((candidate) => candidate.id === id);
    if (!state) return null;
    const { name, tag, role, detail } = copy(id);
    const level = state.level ?? (state.completed ? 1 : 0);
    const maxLevel = state.maxLevel ?? 1;
    const completed = state.completed;
    const queued = researchQueue.some((queuedOrder) => queuedOrder.projectId === id);
    const blocked = doorOf(id, state, completed);
    /**
     * THE FIGURE, WHICH THIS ROW WAS THE ONLY LADDER IN THE GAME WITHOUT.
     *
     * Buildings, instruments and satellites all reach `UpgradeRow` with a gain;
     * research reached it with prose. See `researchGain` for what that cost.
     */
    const gain = researchGain(id, level);

    const spec: SheetSpec = {
      id,
      name,
      tag,
      role,
      detail,
      gain,
      cost: state.cost,
      level,
      maxLevel,
      ...(blocked ? { blocked } : {}),
      ...(completed ? { completed: t('research.complete') } : {}),
      ...(queued ? { queued: t('planet.queue.queued', { count: 1 }) } : {}),
    };

    return (
      <div key={id} id={`row-${id}`} data-focused={focused === id ? 'true' : undefined}>
        <UpgradeRow
          art={RESEARCH_ART[id]}
          name={name}
          level={level}
          maxLevel={maxLevel}
          tag={tag}
          role={role}
          gain={gain}
          cost={state.cost}
          held={held}
          income={{
            alloyPerHour: planet.planet.alloyPerHour,
            crystalPerHour: planet.planet.crystalPerHour,
          }}
          unowned={level === 0}
          {...(spec.blocked ? { blocked: spec.blocked } : {})}
          {...(spec.completed ? { completed: spec.completed } : {})}
          {...(spec.queued ? { queued: spec.queued } : {})}
          verb="install"
          actionLabel={t('research.act')}
          onAct={() => { buy(id, name); }}
          onOpen={() => { setSheet(spec); }}
          pending={research.isPending}
          highlighted={focused === id}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption leading-snug text-faint">{t('research.premise')}</p>

      <section className="plate plate-inset overflow-hidden" aria-label={t('research.queueTitle')}>
        <header className="flex items-baseline gap-2 border-b border-line-soft px-3 py-2">
          <h2 className="legend text-bone">{t('research.queueTitle')}</h2>
          <span className="h-px flex-1 bg-gradient-to-r from-line-soft to-transparent" />
          <span className="num text-micro text-faint">
            {t('research.queueCapacity', { count: BUILD.queueDepth })}
          </span>
        </header>
        <QueueStrip
          label={t('research.queueLane')}
          orders={queueOrders}
          now={now}
        />
        <p className="px-3 pb-3 text-label leading-snug text-faint">
          {t('research.queueGlobalHint')}
        </p>
      </section>

      {running ? (
        <div data-research-running className="plate flex flex-col gap-1 p-3">
          <p className="legend text-crystal/85">{t('research.runningLabel')}</p>
          <p className="name text-bone">{copy(running.projectId).name}</p>
          <p className="text-label text-faint">
            <span data-research-finishes className="num">
              {t('research.runningFinishes', { time: clockTime(running.finishesAt) })}
            </span>
          </p>
        </div>
      ) : (
        <div data-research-idle className="plate flex flex-col gap-1 p-3">
          <p className="legend">{t('research.idleLabel')}</p>
          <p className="text-label leading-snug text-faint">{t('research.idleHint')}</p>
        </div>
      )}

      {GROUPED.map((group) => (
        <section key={group.id} data-band={group.id} className="plate overflow-hidden">
          {/*
            The two keys are written out rather than built from `group.id`. A
            template literal would type-check as one union member and quietly stop
            checking the other three — and a missing key on this screen prints its
            own path on a phone.
          */}
          <Band label={t(group.label)} note={t(group.note)} />
          {group.projects.map(row)}
        </section>
      ))}

      <Note>{t('research.sheetOnce')}</Note>

      {sheet && (
        <ProjectSheet
          spec={sheet}
          held={held}
          pending={research.isPending}
          onAct={() => {
            buy(sheet.id, sheet.name);
            setSheet(null);
          }}
          onClose={() => { setSheet(null); }}
        />
      )}
    </div>
  );
}

/**
 * THE FULL PICTURE BEHIND ONE CARD. Moved here from `PlanetScreen` with the rest
 * of research: the row is the summary, the sheet is the decision, and after T12
 * this screen is its only caller.
 */
function ProjectSheet({
  spec,
  held,
  pending,
  onAct,
  onClose,
}: {
  spec: SheetSpec;
  held: { alloy: number; crystal: number; deuterium: number };
  pending: boolean;
  onAct: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-item-sheet>
      <Sheet
        eyebrow={spec.completed ? t('research.sheetComplete') : t('research.sheetEyebrow')}
        title={spec.name}
        onClose={onClose}
        footer={(
          <span data-act className="block">
            <ActionButton
              verb="install"
              cost={spec.cost}
              held={held}
              full
              label={t('research.act')}
              pending={pending}
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
              onAct={onAct}
            />
          </span>
        )}
      >
        {/*
          GREY MEANS "YOU DO NOT HAVE THIS", AND IT USED TO MEAN "NOT FINISHED YET".
          
          The condition here was `completed`, which is only set at the TOP of a
          ladder — so a Wasp Doctrine with three of its five rungs bought and paid
          for was drawn as though the player owned none of it. It also disagreed
          with the row the player had just tapped: `UpgradeRow` greys on `unowned`,
          which is `level === 0`, so the same project was in colour in the list and
          grey in the sheet one tap later.

          `level === 0` is the rule every other buyable in the game already uses
          (`ItemSheet`), down to the opacity. One idea, one threshold, one number.

          THE LEVEL IS DRAWN AS WELL, for the same reason the planet sheet draws it:
          research art is not tiered, so the index is the only thing that can say
          WHICH rung is held. Without it a doctrine at 1 and at 4 are the same
          picture with no way to tell them apart.
        */}
        <div className="item-portrait flex h-48 items-center justify-center overflow-hidden">
          <span aria-hidden className="item-portrait-orbit" />
          {spec.maxLevel > 1 && (
            <span aria-hidden className="item-portrait-index num">
              {String(Math.max(0, spec.level)).padStart(2, '0')}
            </span>
          )}
          <img
            src={RESEARCH_ART[spec.id]}
            alt={spec.name}
            className={`relative z-[1] h-36 object-contain ${spec.level === 0 ? 'opacity-45 grayscale' : ''}`}
          />
        </div>
        <p className="legend mt-4 text-crystal/85">{spec.tag}</p>
        <p className="mt-2 text-body leading-relaxed text-dim">{spec.role}</p>
        <p data-item-detail className="mt-2 text-caption leading-relaxed text-faint">
          {spec.detail}
        </p>
        {/*
          THE FIGURE SITS ABOVE THE PRICE, because that is the comparison being
          made. A sheet that shows a cost and no effect is asking for a decision
          with one of its two numbers missing.
        */}
        <div
          data-research-gain
          className="mt-6 flex items-baseline justify-between gap-3 border-t border-line-soft pt-3"
        >
          <span className="legend text-faint">{spec.gain.label}</span>
          <span className="num text-body">
            {spec.gain.maxed
              ? spec.gain.now
              : `${spec.gain.now} → ${spec.gain.next}`}
          </span>
        </div>
        {spec.gain.unlocks !== undefined && (
          <p className="mt-2 text-caption leading-snug text-crystal/80">{spec.gain.unlocks}</p>
        )}
        <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-4 border-y border-line-soft py-3">
          <div>
            <p className="legend">{t('research.sheetCost')}</p>
            <p className="mt-1 text-label text-faint">
              {/* A ladder says which rung is being bought; a permission has none. */}
              {spec.maxLevel > 1
                ? t('research.sheetRung', {
                    level: Math.min(spec.maxLevel, spec.level + 1),
                    max: spec.maxLevel,
                  })
                : t('research.sheetOnce')}
            </p>
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
