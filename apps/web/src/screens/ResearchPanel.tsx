import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BUILD,
  DEUTERIUM,
  RESEARCH_PROJECTS,
  STARTER,
  type HullId,
  type ResearchProjectId,
} from '@astera/rules';
import { useCompleteResearch, usePlanet } from '../api/queries.js';
import { RESEARCH_GROUPS, hullDoor } from '../lib/constellation.js';
import { ResearchConstellation, type StarState } from '../v2/hud/ResearchConstellation.js';
import { Lane } from '../v2/shell/BaseQueues.js';
import { CostLine, GameButton, Glyph } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import type { BuildOrderView, PlanetView } from '../api/schemas.js';
import { percent } from '../lib/format.js';
import { researchQueueOrders } from '../lib/orders.js';
import { serverNow } from '../lib/clock.js';
import { clockTime, untilReady, useNow } from '../lib/time.js';
import { useProjected } from '../lib/projection.js';
import { RESEARCH_SCENES } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { HULL_ART } from '../ui/assets.js';
import { hullLabel } from '../i18n/names.js';
import { researchGain, type Gain } from '../lib/gains.js';
import { ActionButton, Price } from '../ui/Action.js';
import { CardTime, type Blocked } from '../ui/UpgradeRow.js';
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

export function ResearchPanel({ onNeed, focus }: {
  onNeed?: (id: string) => void;
  /** The project a door elsewhere asked for ("Ship Armor II first"): the map opens on it. */
  focus?: ResearchProjectId;
}) {
  const { t } = useTranslation();
  const { data, dataUpdatedAt, isError, refetch } = usePlanet();
  const held = useProjected(data?.planet, dataUpdatedAt, 5000);
  const aboard = data?.vessel !== undefined;
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
  const [selection, setSelection] = useState<{ id: ResearchProjectId | null; scroll: boolean }>({ id: focus ?? null, scroll: false });
  const picked = selection.id;
  const selectedCard = useRef<HTMLElement>(null);
  const setPicked = (id: ResearchProjectId | null): void => { setSelection({ id, scroll: true }); };
  useEffect(() => {
    if (selection.scroll) selectedCard.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selection]);

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
  const queueOrders = researchQueueOrders(researchQueue);

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
          role: aboard ? t('starter.lab.holdsRole') : t('research.holdsRole'),
          detail: aboard ? t('starter.lab.holdsRole') : t('research.holdsDetail'),
        };
      case 'CARGO_HOLDS':
        return {
          name: t('research.cargoName'),
          tag: t('research.cargoTag'),
          role: t('research.cargoRole'),
          detail: t('research.cargoDetail'),
        };
      case 'INDUSTRIAL':
        return {
          name: t('research.industrialName'),
          tag: t('research.industrialTag'),
          role: t('research.industrialRole'),
          detail: t('research.industrialDetail'),
        };
      case 'RADIATION_SHIELDING':
        return { name: t('research.shieldingName'), tag: t('research.shieldingTag'),
          role: t('research.shieldingRole'), detail: t('research.shieldingDetail') };
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
      case 'SHIP_SHIELDS':
        return { name: t('research.shipShieldsName'), tag: t('research.shipShieldsTag'),
          role: t('research.shipShieldsRole'), detail: t('research.shipShieldsDetail') };
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
    // The ship works one project at a time, and the server refuses a second one.
    if (researchQueue.length >= (aboard ? STARTER.queues.research : BUILD.queueDepth)) {
      return { reason: aboard ? t('starter.lab.queueFull') : t('research.queueFull') };
    }
    const queueAvailable = state.queueAvailable ?? state.available;
    if (!queueAvailable) {
      const isotope = planet.research.find(
        (project) => project.id === 'ISOTOPE_SPECTROMETRY',
      );
      const untilOpen = untilReady((state.availableAt.getTime() - serverNow()) / 60_000);
      if (id === 'ISOTOPE_SPECTROMETRY') {
        return { reason: t('research.at', { duration: untilOpen }) };
      }
      if (!state.discovered || !(state.queueDiscovered ?? state.discovered)) {
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
        // Industrial waits for a rung, not merely a project: say which one.
        const rung = RESEARCH_PROJECTS[id].prerequisiteLevel;
        return {
          reason: rung === undefined
            ? t('research.prerequisiteFirst', { name: copy(behind).name })
            : t('research.prerequisiteLevelFirst', { name: copy(behind).name, level: rung }),
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
    // A ship's ladder stops earlier than the main game's, and the ceiling it promises stops with it.
    const gain = researchGain(id, level, planet.vessel ? maxLevel : undefined);

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
    <div className="gk gk-research">
      <p className="gk-sub">{aboard ? t('starter.lab.premise') : t('research.premise')}</p>

      <ResearchConstellation
        stars={stars}
        selected={chosen}
        onSelect={setPicked}
      />
      {chosenSpec && (
        <ConstellationCard
          spec={chosenSpec.spec}
          cardRef={selectedCard}
          art={RESEARCH_SCENES[chosen].src}
          takes={orderMinutes('RESEARCH', chosenSpec.state.cost, planet, 1, { research: chosen, level: chosenSpec.level + 1 })}
          held={held}
          pending={research.isPending}
          prerequisite={behind !== null && behindHeld
            ? RESEARCH_PROJECTS[chosen].prerequisiteLevel === undefined
              ? copy(behind).name
              : t('research.nameAtLevel', {
                name: copy(behind).name,
                level: RESEARCH_PROJECTS[chosen].prerequisiteLevel,
              })
            : null}
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
      <section aria-label={t('research.queueTitle')} className="gk gk-rlane">
        <Lane label={aboard ? t('starter.lab.queue') : t('research.queueLane')} orders={queueOrders} now={now} onOpen={pickOrder} slots={aboard ? STARTER.queues.research : BUILD.queueDepth} />
        {running?.finishesAt ? (
          <p data-research-running className="gk-sub">
            <span className="gk-rlane__on">{t('research.runningLabel')}</span>
            {' · '}
            <span className="gk-rlane__what">{copy(running.projectId).name}</span>
            {' · '}
            <span data-research-finishes className="gk-num">
              {'pausedAt' in running && running.pausedAt ? t('vacation.paused') : t('research.runningFinishes', { time: clockTime(running.finishesAt) })}
            </span>
          </p>
        ) : (
          <p data-research-idle className="gk-sub">
            <span className="gk-rlane__what">{t('research.idleLabel')}</span>
            {' · '}
            {aboard ? t('starter.lab.idleHint') : t('research.idleHint')}
          </p>
        )}
        <p className="gk-sub gk-rlane__rule">{aboard ? t('starter.lab.queueHint') : t('research.queueGlobalHint')}</p>
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
  cardRef,
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
  cardRef: RefObject<HTMLElement | null>;
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
  const fix = useOwnPress(() => { playSound('tap'); haptic('tap'); door?.onFix?.(); });
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
  const settled = spec.completed ?? spec.queued;
  return (
    <section
      ref={cardRef}
      data-constellation-card={spec.id}
      data-progression-state={state}
      className="gk gk-rcard"
    >
      {art && <AtmosphereImage art={{ src: art, position: '60% 46%' }} />}
      <div className="gk-rcard__head">
        <h3 className="gk-rcard__name">{spec.name}</h3>
        {spec.maxLevel > 1 && <Rungs look="kit" level={spec.level} max={spec.maxLevel} next={!spec.completed} />}
      </div>
      <p className="gk-rcard__role">{spec.role}</p>
      <p className="gk-rcard__gain">
        <span className="gk-rcard__gain-label">{spec.gain.label} </span>
        <span className="gk-num">{spec.gain.now}</span>
        {!spec.gain.maxed && (
          <>
            <span className="gk-rcard__becomes" aria-label={t('upgradeRow.becomes')}>→</span>
            <span className="gk-num gk-rcard__next">{spec.gain.next}</span>
          </>
        )}
        {spec.gain.ceiling !== undefined && spec.gain.maxed !== true && (
          // the ceiling copy reads on from the figures ("10% of 25%"); only shielding's is its own clause
          <span className="gk-rcard__ceiling"> {spec.id === 'RADIATION_SHIELDING'
            ? `· ${t('research.shieldingCeiling', { rate: spec.gain.ceiling, level: spec.maxLevel })}`
            : t('upgradeRow.ceiling', { value: spec.gain.ceiling })}</span>
        )}
      </p>
      {prerequisite !== null && spec.completed === undefined && (
        <p data-prerequisite className="gk-rcard__need">
          <span className="gk-need-chip" data-met=""><Glyph id="check" />{t('researchMap.needs', { name: prerequisite })}</span>
        </p>
      )}
      {opens && (
        <div data-opens className="gk-rcard__opens">
          <span className="gk-rcard__opens-label">
            {opens.permission ? t('researchMap.opens') : t('researchMap.opensAt', { level: opens.level })}
          </span>
          {shown.map((hull) => {
            const picture = HULL_ART[hull];
            return (
              <span key={hull} data-hull={hull} className="gk-rcard__hull">
                {picture && <img src={picture} alt="" aria-hidden />}
                {hullLabel(hull)}
              </span>
            );
          })}
          {opens.hulls.length > shown.length && (
            <span className="gk-num gk-rcard__more">+{opens.hulls.length - shown.length}</span>
          )}
        </div>
      )}
      <div data-research-footer className="gk-rcard__foot">
        {!spec.completed && !door && (
          <div className="gk-rcard__price">
            <CostLine cost={spec.cost} held={held} time={takes === undefined ? undefined : <CardTime minutes={takes} />} />
          </div>
        )}
        {door && (door.onFix ? (
          <button type="button" {...OWN_SOUND} className="gk-rcard__door" onPointerDown={fix.onPointerDown} onClick={fix.onClick}>
            <Glyph id="lock" />
            <span data-blocked-reason>{door.reason}</span>
            <Glyph id="next" />
          </button>
        ) : (
          <p className="gk-rcard__door" data-still="">
            <Glyph id="lock" />
            <span data-blocked-reason>{door.reason}</span>
          </p>
        ))}
        <div className="gk-rcard__acts">
          <GameButton tone="steel" onPress={onOpen}>{t('research.details')}</GameButton>
          {settled !== undefined ? (
            <p role="status" className="gk-rcard__settled" data-tone={spec.completed ? 'good' : 'self'}>
              <Glyph id={spec.completed ? 'check' : 'timed'} />
              {settled}
            </p>
          ) : !door && (
            <GameButton
              tone="action"
              heavy
              wide
              onPress={onAct}
              pending={pending}
              disabledReason={short ? t('research.cannotAfford') : null}
            >
              {t('research.act')}
            </GameButton>
          )}
        </div>
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
        <div data-research-portrait className="item-portrait flex h-48 items-center justify-center overflow-hidden">
          <span aria-hidden className="item-portrait-orbit" />
          {spec.maxLevel > 1 && (
            <span aria-hidden className="item-portrait-index num">
              {String(Math.max(0, spec.level)).padStart(2, '0')}
            </span>
          )}
          <img
            src={RESEARCH_SCENES[spec.id].src}
            alt={spec.name}
            className={`relative z-[1] h-full w-full object-cover ${spec.level === 0 ? 'opacity-45 grayscale' : ''}`}
            decoding="async"
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
                {spec.id === 'RADIATION_SHIELDING'
                  ? t('research.shieldingCeiling', { rate: spec.gain.ceiling, level: spec.maxLevel })
                  : t('upgradeRow.ceiling', { value: spec.gain.ceiling })}
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
