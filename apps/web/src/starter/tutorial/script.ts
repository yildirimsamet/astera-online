import { REPAIR_LADDER, type StarterFeature, type VesselFact } from '@astera/rules';
import type { StarterTutorialStepId } from '../../api/starterTutorialSteps.js';
import type { Opportunity } from '../opportunities.js';
import type { HuntStage } from '../hunt.js';
import type { SightNow } from './sightLesson.js';

/**
 * THE STARTER GUIDE (owner 2026-11-08, N1 and N12). A short core is held: the power card, the first
 * collect and the first repair with its five seconds. After it one road walks the game's mechanics in
 * order, in the first minutes: crystal, telescope and radar, the rocks and a Prospector, the other
 * ships and a probe, the yard and a ship of one's own, then what the ship still needs to leave. It
 * points and never holds. A few first-time moments speak over it when they happen: a crate, a probe
 * report, a haul, a contact on the sensors. Once it is walked the advisor's list is all that is left.
 *
 * WHERE THE PLAYER IS COMES FROM THE SHIP. A step whose result the ship records (an order, a module,
 * a fact) is behind them for good, on any phone. Only reading a line and pressing a mark are
 * remembered on the device, and a ship further along than either makes them moot.
 */
export type TutorialView = 'galaxy' | 'ship' | 'other';

export interface TutorialInput {
  modules: Readonly<Record<string, number>>;
  facts: readonly VesselFact[];
  queue: readonly { subject: string; stage: number }[];
  unlockToAnnounce: StarterFeature | null;
  /** Alloy waiting in the works, projected to now. */
  works: number;
  /** The store and the works together can pay the next required repair. */
  canPayNext: boolean;
  /** The store pays for a Dart, as the yard's own button asks. */
  canBuildShip: boolean;
  probing: boolean;
  mining: boolean;
  crates: readonly { id: string; state: 'sealed' | 'ready' | 'opened' }[];
  /** No other ship is in sight: a probe report has no subject yet (owner playtest 2026-11-06). */
  alone?: boolean;
  view: TutorialView;
  /** A rock's sheet is open on the galaxy: what the Prospector is sent from. */
  rockOpen?: boolean;
  /** The field has loaded and holds no rock: nothing to come closer to. */
  noRocks?: boolean;
  /** What the live sky holds: a sensor lesson waits for its subject (plan F6). None means nothing in sight. */
  sight?: SightNow;
  /** Lines read and marks pressed, on this device. */
  acked: readonly string[];
}

export type TutorialStepId = StarterTutorialStepId;

/** read: a line and Next · press: the mark is the next move · wait: nothing to press while it runs · gesture: the scene answers it. */
export type TutorialKind = 'read' | 'press' | 'wait' | 'gesture';
export type TutorialLineId = TutorialStepId;
/** The card's heading: which part of the ship's story the line belongs to. */
export type TutorialChapter = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TutorialNav = 'openShip' | 'closePage' | 'dismissUnlock';

export type TutorialAnswer =
  | {
    kind: 'step'; id: TutorialLineId; step: TutorialKind; marks: readonly string[]; nav?: TutorialNav; chapter: TutorialChapter;
    /** The core holds every other control; a moment only points. */
    strict: boolean;
  }
  /** Nothing to teach: the advisor offers what this ship can do, and the player chooses. */
  | { kind: 'advise' };
export type TutorialStep = Extract<TutorialAnswer, { kind: 'step' }>;

type Place = 'galaxy' | 'ship' | 'any';
interface Step {
  id: TutorialStepId;
  kind: TutorialKind;
  place: Place;
  chapter: TutorialChapter;
  /** Where its mark lives; the way there comes first. */
  marks: readonly string[];
  /** Recorded by the ship: this step and every one before it in its part are behind the player. */
  reached?: (input: TutorialInput) => boolean;
  /** True right now (the works are empty, the card was read): this step is passed over. */
  satisfied?: (input: TutorialInput) => boolean;
  /** The moment for it has come: until then its part waits here and says nothing. */
  ready?: (input: TutorialInput) => boolean;
}
/** A run of steps that speaks once, when its moment comes, and in order. */
interface Part { strict: boolean; due: (input: TutorialInput) => boolean; steps: readonly Step[] }

const has = (input: TutorialInput, module: string, stage: number): boolean => (input.modules[module] ?? 0) >= stage;
const ordered = (input: TutorialInput, module: string, stage: number): boolean =>
  has(input, module, stage) || input.queue.some(order => order.subject === module && order.stage >= stage);
const repair = (module: string, stage: number): string => `[data-guide="repair-order"][data-step="${module}:${String(stage)}"]`;
/** The repair's thumbnail on the strip: the way to it when the card shows another repair of the tab. */
const show = (module: string, stage: number): string => `[data-guide="repair-show"][data-step="${module}:${String(stage)}"]`;
const tab = (system: string): string => `[data-guide="system-${system}"]`;
const WORKS = '[data-guide="works"]';
const CRATE = '[data-guide="crate"]';
const OBJECTIVE = '[data-guide="objective"]';
const hasReady = (i: TutorialInput): boolean => i.crates.some(c => c.state === 'ready');
/** Hours past the road, on any phone: nothing about the first session is told to this ship again. */
const seasoned = (i: TutorialInput): boolean => ordered(i, 'SURVEY', 2) || ordered(i, 'HANGAR', 2);
const noRadar = (i: TutorialInput): boolean => !has(i, 'RADAR', 1);
/** Only with the sky in front of them: a flight crossing the ring must not pull a player off a page. */
const inSight = (what: keyof SightNow) => (i: TutorialInput) => i.view === 'galaxy' && i.sight?.[what] === true;
const CRAFT = '[data-guide="sight-craft"]';
const hasMined = (i: TutorialInput): boolean => i.mining || i.facts.includes('FIRST_MINING_RETURN');
const UNKNOWN = '[data-guide="sight-unknown"]';

/** Power, the first collect and the first repair: the one moment the guide holds (N1). */
const CORE: Part = {
  strict: true,
  due: i => !has(i, 'REFINERY', 2),
  steps: [
    // The welcome is spoken over the power card (owner 2026-11-08: one way in, no second greeting).
    { id: 'online', kind: 'press', chapter: 1, place: 'galaxy', marks: ['[data-guide="unlock-try"]'], satisfied: i => i.unlockToAnnounce !== 'production' },
    { id: 'collect', kind: 'press', chapter: 1, place: 'any', marks: [WORKS], satisfied: i => i.works < 1 },
    { id: 'orderRefinery', kind: 'press', chapter: 2, place: 'ship', marks: [repair('REFINERY', 2), show('REFINERY', 2), tab('REFINERY')], reached: i => ordered(i, 'REFINERY', 2) },
    { id: 'waitFirst', kind: 'wait', chapter: 2, place: 'any', marks: [], reached: i => has(i, 'REFINERY', 2) },
  ],
};

/** A repair of the road: lit on the ship, behind the player as soon as it is on the queue. */
const orderStep = (id: TutorialStepId, module: string, stage: number, system: string, chapter: TutorialChapter): Step => ({
  id, kind: 'press', chapter, place: 'ship', marks: [repair(module, stage), show(module, stage), tab(system)], reached: i => ordered(i, module, stage),
});
const waitFor = (id: TutorialStepId, module: string, chapter: TutorialChapter): Step => ({ id, kind: 'wait', chapter, place: 'any', marks: [], reached: i => has(i, module, 1) });

/**
 * THE FIRST SESSION'S ROAD (owner 2026-11-08, N12). The server opens these repairs in this order; a
 * flight never stops it, so the antenna goes on while the Prospector is out and the yard while the
 * probe is.
 */
const FIRST_ROAD: Part = {
  strict: false,
  due: () => true,
  steps: [
    orderStep('orderExtractor', 'EXTRACTOR', 1, 'REFINERY', 2),
    orderStep('orderTelescope', 'TELESCOPE', 1, 'DEFENCE', 3),
    waitFor('waitTelescope', 'TELESCOPE', 3),
    // The field is looked through, a rock found by hand, and only then is the Prospector named (owner playtest 2026-11-08).
    { id: 'telescopeLook', kind: 'read', chapter: 7, place: 'galaxy', marks: [], reached: hasMined },
    // At the opening distance a rock is a few pixels: it is come closer to by hand first (owner playtest 2026-11-09).
    { id: 'zoomRock', kind: 'gesture', chapter: 6, place: 'galaxy', marks: [], satisfied: i => i.noRocks === true || i.rockOpen === true, reached: hasMined },
    { id: 'findRock', kind: 'press', chapter: 6, place: 'galaxy', marks: ['[data-guide="sight-rock"]', OBJECTIVE], satisfied: i => i.rockOpen === true, reached: hasMined },
    { id: 'mine', kind: 'press', chapter: 6, place: 'galaxy', marks: ['[data-guide="mine"]', OBJECTIVE], reached: hasMined },
    // The radar waits for the telescope's lesson (owner playtest 2026-11-09). Ordered early, it does not pass over that lesson.
    { ...orderStep('orderRadar', 'RADAR', 1, 'DEFENCE', 3), reached: i => hasMined(i) && ordered(i, 'RADAR', 1) },
    { ...waitFor('waitRadar', 'RADAR', 3), reached: i => hasMined(i) && has(i, 'RADAR', 1) },
    orderStep('orderSurvey', 'SURVEY', 1, 'SURVEY', 4),
    waitFor('waitSurvey', 'SURVEY', 4),
    { id: 'probe', kind: 'press', chapter: 4, place: 'galaxy', marks: ['[data-guide="probe"]', OBJECTIVE], satisfied: i => i.alone === true, reached: i => i.probing || i.facts.includes('FIRST_PROBE_REPORT') },
    orderStep('orderShipyard', 'SHIPYARD', 1, 'CARGO', 5),
    waitFor('waitYard', 'SHIPYARD', 5),
    { id: 'buildShip', kind: 'press', chapter: 5, place: 'ship', marks: ['[data-commit] button', '[data-testid="yard-hull"][data-hull="DART"] button', '#ship-deck-yard'], satisfied: i => seasoned(i) || (!i.canBuildShip && !hasReady(i)) },
    { id: 'farewell', kind: 'read', chapter: 9, place: 'ship', marks: ['[data-testid="ship-repair"]'], satisfied: seasoned },
  ],
};

/** The road's prices count on the crates: a ready one is the way to the next repair, each time. */
const OPEN_CRATE: Step = { id: 'openCrate', kind: 'press', chapter: 2, place: 'ship', marks: [CRATE] };

/** The first-time moments, in the order they go before the road. Each speaks once and holds nothing. */
const MOMENTS: readonly Part[] = [
  // Only the first crate is taught (plan F3); the rest are opened by the same hold.
  {
    strict: false, due: i => hasReady(i) && !i.crates.some(c => c.state === 'opened'),
    steps: [{ id: 'firstCrate', kind: 'press', chapter: 2, place: 'ship', marks: [CRATE] }],
  },
  // The report is read where it is drawn (owner playtest 2026-11-07: a list row taught nothing).
  {
    strict: false, due: i => i.facts.includes('FIRST_PROBE_REPORT'),
    steps: [
      { id: 'openIntel', kind: 'press', chapter: 4, place: 'any', marks: ['[data-guide="dock-intel"]'] },
      { id: 'openReport', kind: 'press', chapter: 4, place: 'any', marks: ['[data-known="probe"] button, [data-report-open]', '[data-guide="dock-intel"]'] },
      { id: 'report', kind: 'read', chapter: 4, place: 'galaxy', marks: ['[data-dossier-loot]'] },
    ],
  },
  // The first haul, when it is home.
  {
    strict: false, due: i => i.facts.includes('FIRST_MINING_RETURN'),
    steps: [{ id: 'collectMine', kind: 'press', chapter: 6, place: 'any', marks: [WORKS], satisfied: i => i.works < 1 }],
  },
  // THE RADAR, ON A REAL CONTACT (plan F6): nothing is made up for a lesson; an empty sky only means
  // it waits, and the road goes on meanwhile. The scout comes to every Radar 1 owner who is there and has flown something.
  {
    strict: false, due: i => has(i, 'RADAR', 1) && hasMined(i),
    steps: [
      { id: 'radarRing', kind: 'read', chapter: 8, place: 'galaxy', marks: [UNKNOWN], satisfied: noRadar, ready: inSight('unknown') },
      { id: 'radarContact', kind: 'read', chapter: 8, place: 'galaxy', marks: [UNKNOWN], satisfied: noRadar, ready: inSight('unknown') },
      // Closed once the telescope has named a craft in its ring: what the radar asked, answered.
      { id: 'sightTrio', kind: 'read', chapter: 8, place: 'galaxy', marks: [CRAFT], satisfied: noRadar, ready: inSight('traffic') },
    ],
  },
];

/** Every step the guide can speak, in the order the server's funnel counts them. */
export const ROAD: readonly Step[] = [...CORE.steps, ...FIRST_ROAD.steps, OPEN_CRATE, ...MOMENTS.flatMap(part => part.steps)];

/** The core's chapters, which the card counts; a first-time moment is no chapter of a road. */
export const CORE_CHAPTERS = 2;

/** The galaxy steps an "online" note would cover; the rest of the galaxy's lines speak over it. */
const NOTE_HIDES: readonly TutorialStepId[] = ['telescopeLook', 'zoomRock', 'findRock', 'mine', 'probe'];

/** Where a step is, with the way there when its mark is somewhere else. */
function locate(step: Step, input: TutorialInput, strict: boolean): TutorialAnswer {
  const answer = { kind: 'step' as const, id: step.id, step: step.kind, chapter: step.chapter, strict };
  if (step.kind === 'wait') return { ...answer, marks: step.marks };
  if (input.view === 'galaxy' && input.unlockToAnnounce !== null && (step.place === 'ship' || NOTE_HIDES.includes(step.id))) {
    // A note hides the card on the galaxy: its close is the way to it (owner playtest 2026-11-07).
    return { ...answer, step: 'press', marks: ['[data-guide="unlock-dismiss"]', '[data-focus-close]'], nav: 'dismissUnlock' };
  }
  if (step.place === 'ship' && input.view !== 'ship') {
    return input.view === 'galaxy'
      ? { ...answer, step: 'press', marks: ['[data-guide="dock-base"]'], nav: 'openShip' }
      : { ...answer, step: 'press', marks: ['[data-sheet-close]'], nav: 'closePage' };
  }
  if (step.place === 'galaxy' && input.view !== 'galaxy') return { ...answer, step: 'press', marks: ['[data-sheet-close]'], nav: 'closePage' };
  return { ...answer, marks: step.marks };
}

/** The part's next step, or nothing when the ship and the device are past all of it. */
function nextIn(part: Part, input: TutorialInput): TutorialAnswer | null {
  let from = 0;
  // A step the ship records, or one read further on, puts everything before it behind the player.
  part.steps.forEach((step, index) => { if (step.reached?.(input) || input.acked.includes(step.id)) from = index + 1; });
  const step = part.steps.slice(from).find(s => !input.acked.includes(s.id) && !s.satisfied?.(input));
  // Its moment has not come: the part waits here, it does not skip ahead.
  if (step?.ready && !step.ready(input)) return null;
  return step ? locate(step, input, part.strict) : null;
}

/** The step the player is on: the core while it lasts, then a moment that is due, then the road, else the advisor. */
export function tutorialStep(input: TutorialInput): TutorialAnswer {
  if (CORE.due(input)) {
    const core = nextIn(CORE, input);
    if (core) return core;
  }
  for (const part of MOMENTS) {
    if (!part.due(input)) continue;
    const moment = nextIn(part, input);
    if (moment) return moment;
  }
  const road = nextIn(FIRST_ROAD, input);
  // Only when what comes next costs: rocks and probes are not held up for a crate (walk 2026-11-08).
  const shortOfIt = road?.kind === 'step' && ((road.id.startsWith('order') && !input.canPayNext) || (road.id === 'buildShip' && !input.canBuildShip));
  if (shortOfIt && hasReady(input)) return locate(OPEN_CRATE, input, false);
  return road ?? { kind: 'advise' };
}

const SYSTEM_OF = new Map(REPAIR_LADDER.map(s => [`${s.module}:${String(s.stage)}`, s.system]));
const NOWHERE = { marks: [] as readonly string[] };
const aboard = (view: TutorialView, marks: readonly string[]) => view === 'ship' ? { marks } : view === 'galaxy'
  ? { marks: ['[data-guide="dock-base"]'], nav: 'openShip' as const }
  : { marks: ['[data-sheet-close]'], nav: 'closePage' as const };
const outside = (view: TutorialView, marks: readonly string[]) => view === 'galaxy' ? { marks } : { marks: ['[data-sheet-close]'], nav: 'closePage' as const };

/**
 * WHERE THE HAND GOES FOR WHAT THE PLAYER CHOSE (N1: it points at the pick and nothing else). A state
 * the advisor only says (a wait, a deed under way, a price to save for) has nothing to press.
 */
export function adviceMarks(choice: Opportunity, view: TutorialView): { marks: readonly string[]; nav?: TutorialNav } {
  switch (choice.kind) {
    case 'repair': {
      const at = `${choice.step.module}:${String(choice.step.stage)}`;
      return aboard(view, [repair(choice.step.module, choice.step.stage), show(choice.step.module, choice.step.stage), tab(SYSTEM_OF.get(at) ?? choice.step.system)]);
    }
    case 'collect': return { marks: [WORKS] };
    case 'crate': return aboard(view, [CRATE]);
    case 'probe': return outside(view, ['[data-guide="probe"]', '[data-guide="objective"]']);
    case 'mine': return outside(view, ['[data-guide="mine"]', '[data-guide="objective"]']);
    case 'fuel': return aboard(view, ['[data-guide="fuel"]', tab('DRIVE')]);
    case 'jump': return aboard(view, [tab('DRIVE')]);
    case 'hunt': return huntMarks(choice.hunt, view);
    case 'save': case 'wait': case 'underway': case 'fact': case 'parts': return NOWHERE;
  }
}

/** The first hunt: the probe on an open outpost, else that outpost's flag; the choice is on the line. */
function huntMarks(hunt: HuntStage, view: TutorialView): { marks: readonly string[]; nav?: TutorialNav } {
  if (hunt.stage === 'probe') return outside(view, ['[data-guide="probe"]', `[data-outpost-guide="${hunt.target}"]`, '[data-guide="objective"]']);
  // The reports are where the choice is made: a player reading them is not led out.
  return hunt.stage === 'decide' && view === 'galaxy' ? { marks: ['[data-guide="objective"]'] } : NOWHERE;
}

/**
 * HOW A WAIT HOLDS THE PLAYER (owner playtest 2026-11-07: "Oyuncuyu 10 sn'den fazla, bir şey yapmasına
 * izin vermeden kitleyemeyiz"). Ten seconds may be held; up to a minute the player roams with the line
 * still up; past it the NPC says when it will be back and steps aside until the work is done. Judged
 * on the wait's whole length, so the mode does not change halfway through it.
 */
export interface TutorialWait { until: Date; spanMs: number }
export type WaitMode = 'lock' | 'roam' | 'away';

/** The repairs each repair wait is for. */
const WAIT_ON: Partial<Record<TutorialStepId, readonly (readonly [string, number])[]>> = {
  waitFirst: [['REFINERY', 2]],
  waitTelescope: [['TELESCOPE', 1]],
  waitRadar: [['RADAR', 1]],
  waitSurvey: [['SURVEY', 1]],
  waitYard: [['SHIPYARD', 1]],
};

export function repairWait(id: TutorialStepId, queue: readonly { subject: string; stage: number; startedAt: Date; readyAt: Date }[]): TutorialWait | null {
  const awaited = (WAIT_ON[id] ?? []).flatMap(([module, stage]) => queue.filter(order => order.subject === module && order.stage === stage));
  if (awaited.length === 0) return null;
  return {
    until: new Date(Math.max(...awaited.map(order => order.readyAt.getTime()))),
    spanMs: Math.max(...awaited.map(order => order.readyAt.getTime() - order.startedAt.getTime())),
  };
}

/** A wait that cannot be timed is never held: holding is the one thing past ten seconds that is forbidden. */
export const waitMode = (wait: TutorialWait | null | undefined): WaitMode =>
  !wait ? 'roam' : wait.spanMs >= 60_000 ? 'away' : wait.spanMs > 10_000 ? 'roam' : 'lock';
