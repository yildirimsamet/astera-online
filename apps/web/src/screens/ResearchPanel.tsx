import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BUILD,
  DEUTERIUM,
  RESEARCH_PROJECTS,
  FEATURE_FLAGS,
  type HullId,
  type ResearchProjectId,
} from '@astera/rules';
import { useCompleteResearch, usePlanet } from '../api/queries.js';
import { RESEARCH_GROUPS, hullDoor } from '../lib/constellation.js';
import { ResearchConstellation, type StarState } from '../v2/hud/ResearchConstellation.js';
import { QueueLane } from '../v2/kit/QueueLane.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';
import { percent } from '../lib/format.js';
import { serverNow } from '../lib/clock.js';
import { clockTime, untilReady, useNow } from '../lib/time.js';
import { useProjected } from '../lib/projection.js';
import { HULL_ART, RESEARCH_ART } from '../ui/assets.js';
import { hullLabel } from '../i18n/names.js';
import { researchGain, type Gain } from '../lib/gains.js';
import { ActionButton, Price, TimeCost } from '../ui/Action.js';
import type { Blocked } from '../ui/UpgradeRow.js';
import { Rungs } from '../ui/Rungs.js';
import { orderMinutes } from '../lib/orderTime.js';
import { describe, useToast } from '../ui/Toast.js';
import { Sheet, Unreachable, Waiting } from '../ui/kit/index.js';

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
 * shipped ladders a player had no control to buy. The map here is drawn from
 * `RESEARCH_GROUPS` and `test/research-panel` checks its stars against
 * `RESEARCH_PROJECT_IDS`, so a sixteenth project cannot be added without a home.
 *
 * WHAT IT LOOKS LIKE (E8 · K9). A constellation — a star per project, a quarter of
 * the sky per group — and under it the card of the selected one, which is the
 * decision. It replaced four folding bands of rows: "what is next?" at one glance,
 * where the list took a scroll per group to answer it.
 *
 * WHERE THE ORDER ACTUALLY GOES. Onto the commander's RESEARCH queue. The world
 * in view only pays the cost and supplies its Core level; its Construction and
 * Yard queues remain independent.
 */

/**
 * THE THREE PROJECTS THAT BELONG TO THE WEAPON, AND ONE PLACE THAT SAYS SO.
 *
 * `STRATEGIC_RESEARCH_ENABLED` is a release switch, not a deletion. While it is off
 * the server refuses these three (`services/research.ts`), so they stay on the map,
 * dim, and their card says closed before anything else: nothing below that door can
 * open them, which makes it the widest refusal `doorOf` has.
 */
const strategicOnly = (id: ResearchProjectId): boolean =>
  !FEATURE_FLAGS.STRATEGIC_RESEARCH_ENABLED
  && (id === 'DEATH_STAR_PROTOCOL' || id === 'INTERCEPTION_GRID' || id === 'STRATEGIC_STOCKPILE');

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
   * THE STAR THE COMMANDER TAPPED; until then the card follows what is next.
   *
   * A PREREQUISITE IS ON THIS MAP, NOT ON ANOTHER SCREEN. `onNeed` hands a refusal
   * to the host, and the Core genuinely lives there. A research prerequisite does
   * not: it is a star a few stars away, so a door that names one selects it —
   * sending the player to the planet sheet is what `TAB_OF` once did by accident,
   * and it landed them on a tab with no research on it at all.
   */
  const [picked, setPicked] = useState<ResearchProjectId | null>(null);

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
  /**
   * IS THIS PROJECT ON THE COMMANDER'S QUEUE, AND IN WHICH OF THE TWO WAYS. D183.
   *
   * `running` is the slot the clock is actually paying for; everything else on the
   * queue is WAITING. Both are "bought" as far as the refusal ladder is concerned,
   * which is why `doorOf` returns early on either — but they are different facts to
   * a reader, so the row prints different words for them.
   */
  const queuedState = (id: ResearchProjectId): 'running' | 'queued' | null => {
    const order = researchQueue.find((candidate) => candidate.projectId === id);
    if (!order) return null;
    return order.slot === 0 ? 'running' : 'queued';
  };
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
      case 'AI_ROBOTS':
        return {
          name: t('research.robotsName'),
          tag: t('research.robotsTag'),
          role: t('research.robotsRole'),
          detail: t('research.robotsDetail'),
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
      case 'SHIP_POWER':
        return {
          name: t('research.powerName'),
          tag: t('research.powerTag'),
          role: t('research.powerRole'),
          detail: t('research.powerDetail'),
        };
      case 'SHIP_ARMOR':
        return {
          name: t('research.armorName'),
          tag: t('research.armorTag'),
          role: t('research.armorRole'),
          detail: t('research.armorDetail'),
        };
      case 'SHIP_PROPULSION':
        return {
          name: t('research.propulsionName'),
          tag: t('research.propulsionTag'),
          role: t('research.propulsionRole'),
          detail: t('research.propulsionDetail'),
        };
      case 'EMPLACEMENT_DOCTRINE':
        return {
          name: t('research.groundDoctrineName'),
          tag: t('research.doctrineTag'),
          role: t('research.doctrineRole'),
          detail: t('research.groundDoctrineDetail'),
        };
      case 'STARSHIP_ENGINEERING':
        return {
          name: t('research.engineeringName'),
          tag: t('research.engineeringTag'),
          role: t('research.engineeringRole'),
          detail: t('research.engineeringDetail'),
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
   *   0. the release switch is off — the server refuses the project outright
   *   1. the commander Research queue is full
   *   2. the season has not opened this act yet — no amount of building fixes it
   *   3. the discovery has not happened — a condition to play out, not to buy
   *   4. the project in front of this one is not held — a purchase, so it follows
   *   5. the Core is too low — the only one that is a build, so it goes last
   *
   * AND EVERY ONE OF THEM HAS TO STILL BE TRUE TO BE SAID. Step 2 used to be the
   * catch-all for anything that reached the end of the list, which put a spent
   * countdown on five cards whose only real gate was step 4.
   */
  const doorOf = (
    id: ResearchProjectId,
    state: PlanetView['research'][number],
    completed: boolean,
  ): Blocked | undefined => {
    if (completed) return undefined;
    if (strategicOnly(id)) return { reason: t('researchMap.shut') };
    /*
      A PROJECT ALREADY ON THE QUEUE HAS NO DOOR LEFT. D183, owner report:
      *"Que'da olan bir araştırma menü item'da 'birazdan sonra araştırılabilir'
      yazısı 'araştırılıyor' ile değişmeli."*

      Every refusal below describes something the commander has yet to do, and a
      project that is BOUGHT and running has none of them — but the act clock this
      ladder falls through to was still literally true, so a paid-for project on
      the commander's own queue was labelled "researchable in 4h". That is the
      ladder answering a question nobody asked: not "when could I start this" but
      "what is happening to it right now". `queuedState` answers the second one.
    */
    if (queuedState(id) !== null) return undefined;
    if (researchQueue.length >= BUILD.queueDepth) {
      return { reason: t('research.queueFull') };
    }
    const queueAvailable = state.queueAvailable ?? state.available;
    if (!queueAvailable) {
      const isotope = planet.research.find(
        (project) => project.id === 'ISOTOPE_SPECTROMETRY',
      );
      const gravitic = planet.research.find((project) => project.id === 'GRAVITIC_CHARGES');
      const untilOpen = untilReady((state.availableAt.getTime() - serverNow()) / 60_000);
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
            onFix: () => { setPicked('GRAVITIC_CHARGES'); },
          };
        }
        if (!(isotope?.completed ?? false)) {
          return {
            reason: t('research.isotopeFirst'),
            onFix: () => { setPicked('ISOTOPE_SPECTROMETRY'); },
          };
        }
        return {
          reason: id === 'DENSE_FUEL_CELLS'
            ? t('research.cargoInsight')
            : t('research.shieldInsight', { share: graviticShare }),
        };
      }
      /*
        THE ACT CLOCK ONLY WHILE IT IS GENUINELY AHEAD. It used to catch every row
        that fell this far, and a spent countdown is not a refusal: a live commander
        was told the Interception Grid was researchable "in 0m" two days after the
        War act opened. D113's ordering is kept — an act nobody can build their way
        past outranks a project — but it now has to still be true to be said.
      */
      if (state.availableAt.getTime() > serverNow()) {
        return { reason: t('research.at', { duration: untilOpen }) };
      }
      /*
        WHAT IS LEFT IS THE PROJECT IN FRONT OF THIS ONE, and for the three stat
        ladders and the two strategic projects it is the ONLY gate they ever have:
        `discovered` is true for everything outside the Frontier four, so none of
        them reaches the discovery branches above. A brand new commander meets three
        of these on their first visit to this screen.

        The fix stays here rather than going to the host — the card it names is a
        few rows up, and `onNeed` would close this screen for it.
      */
      const behind = state.prerequisite;
      if (behind !== null && !(state.queuePrerequisiteMet ?? state.prerequisiteMet ?? true)) {
        return {
          reason: t('research.prerequisiteFirst', { name: copy(behind).name }),
          onFix: () => { setPicked(behind); },
        };
      }
      return { reason: t('research.at', { duration: untilOpen }) };
    }
    const needCore = RESEARCH_PROJECTS[id].requiredCore ?? 0;
    // The capital's Core gates research on every world (D209).
    if (planet.researchCore < needCore) {
      return {
        reason: t('research.needCore', { level: needCore }),
        // The Core lives on the planet sheet. Where the host cannot take us there,
        // the REASON still stands and only the shortcut is missing.
        ...(onNeed ? { onFix: () => { onNeed('CORE'); } } : {}),
      };
    }
    return undefined;
  };

  /** Everything a project's row and the constellation's card both draw, derived once. */
  const specFor = (id: ResearchProjectId) => {
    const state = planet.research.find((candidate) => candidate.id === id);
    if (!state) return null;
    const { name, tag, role, detail } = copy(id);
    const level = state.level ?? (state.completed ? 1 : 0);
    const maxLevel = state.maxLevel ?? 1;
    const completed = state.completed;
    const onQueue = queuedState(id);
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
      /*
        RUNNING AND WAITING ARE NOT ONE STATE. Running is being paid for by the
        clock; waiting is a place in a line of three. A row that called both
        "queued" would hide the only fact a commander deciding what to buy next
        actually needs — and this row used to say "1 order queued" for both.
      */
      ...(onQueue
        ? { queued: t(onQueue === 'running' ? 'research.rowRunning' : 'research.rowQueued') }
        : {}),
    };
    return { state, name, tag, role, level, maxLevel, gain, spec };
  };

  /*
    THE CONSTELLATION (E8 · K9): what is next, at one glance. The selection opens on the
    project in the lane, else the first one a commander can start now, else the first.
  */
  const firstOpen = RESEARCH_GROUPS.flatMap((group) => [...group.projects])
    .find((id) => {
      const derived = specFor(id);
      return derived !== null && !derived.spec.blocked && !derived.spec.completed && !derived.spec.queued;
    });
  const chosen: ResearchProjectId = picked ?? running?.projectId ?? firstOpen ?? 'ISOTOPE_SPECTROMETRY';
  const chosenSpec = specFor(chosen);
  /** E8: the card names the prerequisite once it is held; a missing one is the card's door. */
  const behind = RESEARCH_PROJECTS[chosen].prerequisite;
  const behindHeld = behind !== null
    && (chosenSpec?.state.queuePrerequisiteMet ?? chosenSpec?.state.prerequisiteMet ?? true);
  const opens = chosenSpec ? hullDoor(chosen, chosenSpec.level) : null;
  /** The lane's cells select their project: the lane is the map's other index. */
  const pickOrder = (order: BuildOrderView): void => {
    const id = researchQueue.find((candidate) => candidate.id === order.id)?.projectId;
    if (id) setPicked(id);
  };
  const stars: StarState[] = RESEARCH_GROUPS.flatMap((group) => [...group.projects]).flatMap((id) => {
    const derived = specFor(id);
    if (!derived) return [];
    return [{
      id,
      name: derived.name,
      level: derived.level,
      maxLevel: derived.maxLevel,
      locked: derived.spec.blocked !== undefined && !derived.spec.completed,
      running: researchQueue.some((order) => order.projectId === id),
    }];
  });

  return (
    <div className="flex flex-col gap-3 font-v2-ui">
      <p className="text-caption leading-snug text-v2-ink-2">{t('research.premise')}</p>

      <ResearchConstellation
        stars={stars}
        selected={chosen}
        onSelect={setPicked}
        dimStrategic={!FEATURE_FLAGS.STRATEGIC_RESEARCH_ENABLED}
      />
      {chosenSpec && (
        <ConstellationCard
          spec={chosenSpec.spec}
          art={RESEARCH_ART[chosen]}
          takes={orderMinutes('RESEARCH', chosenSpec.state.cost, planet, 1, { research: chosen, level: chosenSpec.level + 1 })}
          held={held}
          pending={research.isPending}
          prerequisite={behind !== null && behindHeld ? copy(behind).name : null}
          opens={opens === null ? null : { ...opens, permission: chosenSpec.maxLevel === 1 }}
          onOpen={() => { setSheet(chosenSpec.spec); }}
          onAct={() => { buy(chosen, chosenSpec.name); }}
        />
      )}

      {/*
        THE LANE (E8: "Araştırma hattı (3 yuva) görünür"). One queue for every world
        the commander holds, drawn as the Base draws its own (B12); research cannot be
        cancelled, so a cell selects its project on the map instead of opening a sheet.
      */}
      <section aria-label={t('research.queueTitle')} className="flex flex-col gap-1.5">
        <QueueLane label={t('research.queueLane')} orders={queueOrders} now={now} onOpen={pickOrder} />
        {running ? (
          <p data-research-running className="text-micro leading-snug text-v2-ink-2">
            <span className="text-v2-self">{t('research.runningLabel')}</span>
            {' · '}
            <span className="text-v2-ink">{copy(running.projectId).name}</span>
            {' · '}
            <span data-research-finishes className="font-v2-mono">
              {t('research.runningFinishes', { time: clockTime(running.finishesAt) })}
            </span>
          </p>
        ) : (
          <p data-research-idle className="text-micro leading-snug text-v2-ink-2">
            <span className="text-v2-ink">{t('research.idleLabel')}</span>
            {' · '}
            {t('research.idleHint')}
          </p>
        )}
        <p className="text-micro leading-snug text-v2-ink-3">{t('research.queueGlobalHint')}</p>
      </section>

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
 * THE CARD UNDER THE CONSTELLATION (E8): the selected project's name and rungs, what
 * it does, what the next rung buys and where the ladder ends, the prerequisite it
 * stands on, the ships its next door opens, its price and time — and the press.
 *
 * A REFUSAL IS SAID ONCE, WHERE THE PRESS WOULD BE. The sheet's `ActionButton` does
 * the same: a door with a fix is a button that takes it (yellow, a gap you can close
 * — K2), one without is the sentence in the button's place. The research press only
 * appears when there is nothing in front of it.
 */
function ConstellationCard({
  spec,
  art,
  takes,
  held,
  pending,
  prerequisite,
  opens,
  onOpen,
  onAct,
}: {
  spec: SheetSpec;
  art: string | undefined;
  takes: number | undefined;
  held: { alloy: number; crystal: number; deuterium: number };
  pending: boolean;
  /** The project in front of this one, by name, once it is held. */
  prerequisite: string | null;
  /** The next rung that opens a hull, and which; `permission` when the project has one rung. */
  opens: { level: number; hulls: readonly HullId[]; permission: boolean } | null;
  onOpen: () => void;
  onAct: () => void;
}) {
  const { t } = useTranslation();
  const short = spec.cost.alloy > held.alloy || spec.cost.crystal > held.crystal || spec.cost.deuterium > held.deuterium;
  const door = spec.completed === undefined && spec.queued === undefined ? spec.blocked : undefined;
  const state = spec.completed
    ? 'complete'
    : spec.queued
      ? 'queued'
      : spec.blocked
        ? 'locked'
        : spec.level === 0
          ? 'available-unowned'
          : 'owned';
  const shown = opens?.hulls.slice(0, 4) ?? [];
  return (
    <section
      data-constellation-card={spec.id}
      data-progression-state={state}
      className="flex flex-col gap-2 rounded-control border border-v2-line bg-v2-panel p-3"
    >
      <div className="flex items-start gap-3">
        {/* Grey means "you do not have this": the sheet's rule and its number (`ItemSheet`). */}
        {art && (
          <img
            src={art}
            alt=""
            aria-hidden
            className={`size-14 shrink-0 object-contain ${spec.level === 0 ? 'opacity-45 grayscale' : ''}`}
          />
        )}
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="v2-name min-w-0 text-caption">{spec.name}</h3>
            {spec.maxLevel > 1 && <Rungs level={spec.level} max={spec.maxLevel} next={!spec.completed} />}
          </div>
          <p className="text-micro leading-snug text-v2-ink-2">{spec.role}</p>
          <p className="font-v2-mono text-micro text-v2-ink-2">
            <span className="font-v2-ui text-v2-ink-3">{spec.gain.label} </span>
            {spec.gain.maxed ? spec.gain.now : (
              <>
                {spec.gain.now} <span className="text-v2-ink-3">→</span> <span className="text-v2-self">{spec.gain.next}</span>
              </>
            )}
            {spec.gain.ceiling !== undefined && spec.gain.maxed !== true && (
              <span className="text-v2-ink-3"> · {t('upgradeRow.ceiling', { value: spec.gain.ceiling })}</span>
            )}
          </p>
          {prerequisite !== null && spec.completed === undefined && (
            <p data-prerequisite className="text-micro text-v2-ink-3">
              {t('researchMap.needs', { name: prerequisite })} <span className="text-v2-self">✓</span>
            </p>
          )}
        </div>
      </div>
      {opens && (
        <div data-opens className="flex flex-wrap items-center gap-1.5">
          <span className="text-micro text-v2-ink-3">
            {opens.permission ? t('researchMap.opens') : t('researchMap.opensAt', { level: opens.level })}
          </span>
          {shown.map((hull) => {
            const picture = HULL_ART[hull];
            return (
              <span
                key={hull}
                data-hull={hull}
                className="flex items-center gap-1 rounded-chip border border-v2-line bg-v2-raise/60 py-0.5 pr-1.5 pl-0.5 text-micro text-v2-ink"
              >
                {picture && <img src={picture} alt="" aria-hidden className="size-4 object-contain" />}
                {hullLabel(hull)}
              </span>
            );
          })}
          {opens.hulls.length > shown.length && (
            <span className="font-v2-mono text-micro text-v2-ink-3">+{opens.hulls.length - shown.length}</span>
          )}
        </div>
      )}
      {!spec.completed && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Price cost={spec.cost} held={held} layout="row" />
          {takes === undefined ? null : <TimeCost minutes={takes} />}
        </div>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          data-open-item
          onClick={onOpen}
          className="min-h-10 rounded-control border border-v2-line-hi bg-v2-raise/60 px-3 text-caption font-semibold text-v2-ink"
        >
          {t('research.details')}
        </button>
        {door ? (
          door.onFix ? (
            <button
              type="button"
              onClick={door.onFix}
              className="min-h-10 rounded-control border border-v2-warn/50 px-3 py-1.5 text-left text-caption leading-snug font-semibold text-v2-warn"
            >
              <span data-blocked-reason>{door.reason}</span> →
            </button>
          ) : (
            <p className="flex min-h-10 items-center rounded-control border border-v2-line px-3 py-1.5 text-caption leading-snug text-v2-ink-2">
              <span data-blocked-reason>{door.reason}</span>
            </p>
          )
        ) : (
          <button
            type="button"
            data-primary
            disabled={spec.completed !== undefined || spec.queued !== undefined || short || pending}
            onClick={onAct}
            className="min-h-10 rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink disabled:bg-v2-raise disabled:text-v2-ink-3"
          >
            {spec.completed ?? spec.queued ?? (short ? t('research.cannotAfford') : t('research.act'))}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * THE FULL PICTURE BEHIND ONE CARD. Moved here from `PlanetScreen` with the rest
 * of research: the card is the decision, the sheet behind "Details" the whole of
 * it — the long explanation, the ceiling, the rung being paid for.
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
        <p className="legend mt-2 text-crystal/85">{spec.tag}</p>
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
          className="mt-6 flex items-baseline justify-between gap-2 border-t border-line-soft pt-3"
        >
          <span className="legend text-faint">{spec.gain.label}</span>
          <span className="num text-body">
            {spec.gain.maxed
              ? spec.gain.now
              : `${spec.gain.now} → ${spec.gain.next}`}
            {spec.gain.ceiling !== undefined && spec.gain.maxed !== true && (
              <span className="ml-2 text-faint">
                {t('upgradeRow.ceiling', { value: spec.gain.ceiling })}
              </span>
            )}
          </span>
        </div>
        {spec.gain.unlocks !== undefined && (
          <p className="mt-2 text-caption leading-snug text-crystal/80">{spec.gain.unlocks}</p>
        )}
        <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-4 border-y border-line-soft py-3">
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
          <p className={`mt-2 border px-3 py-2 text-caption leading-snug ${spec.blocked ? 'border-threat/30 bg-threat/10 text-threat' : 'border-crystal/30 bg-crystal/10 text-crystal'}`}>
            {spec.blocked
              ? t('itemSheet.lockedNote', { reason: spec.blocked.reason })
              : spec.queued}
          </p>
        )}
      </Sheet>
    </div>
  );
}
