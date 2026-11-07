import type { StarterFeature, VesselFact } from '@astera/rules';
import type { StarterTutorialStepId } from '../../api/starterTutorialSteps.js';

/**
 * THE STARTER TUTORIAL'S ROAD (owner 2026-11-06). The FlightSchool NPC walks a new commander through
 * the real ship through the first mining haul. The farewell leaves the controls open; subsequent
 * visits offer only a single optional hint when the next action needs explanation.
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
  /** The store and the works together can pay for Refinery 3: the reason to come back. */
  canPayNext: boolean;
  probing: boolean;
  mining: boolean;
  crates: readonly { id: string; state: 'sealed' | 'ready' | 'opened' }[];
  /** No other ship is in sight: the probe lesson has no subject yet (owner playtest 2026-11-06). */
  alone?: boolean;
  view: TutorialView;
  /** Lines read and marks pressed, on this device. */
  acked: readonly string[];
}

export type TutorialStepId = StarterTutorialStepId;

/** read: a line and Next · press: the mark is the next move · wait: nothing to press while it runs. */
export type TutorialKind = 'read' | 'press' | 'wait';
/** The steps the NPC speaks; `away` is the silence between the sessions. */
export type TutorialLineId = Exclude<TutorialStepId, 'away'>;
export type TutorialChapter = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type TutorialAnswer =
  | {
    kind: 'step'; id: TutorialLineId; step: TutorialKind; marks: readonly string[]; nav?: 'openShip' | 'closePage' | 'dismissUnlock'; chapter: TutorialChapter;
    /** On the way there: what the step itself asks for, which a free hand may still press. */
    goal?: readonly string[];
  }
  | { kind: 'away' }
  | { kind: 'done' };

type Step = (
  | { id: TutorialLineId; kind: 'wait'; place: 'any' }
  | { id: TutorialLineId; kind: 'read' | 'press'; place: 'galaxy' | 'ship' | 'any' }
  | { id: 'away'; kind: 'pause'; place: 'any' }
) & {
  chapter: TutorialChapter;
  /** Where its mark lives; the road first leads there. */
  marks: readonly string[];
  /** Recorded by the ship: this step and every one before it are behind the player for good. */
  reached?: (input: TutorialInput) => boolean;
  /** True right now (the works are empty, the card was read): this step is passed over. */
  satisfied?: (input: TutorialInput) => boolean;
};

const has = (input: TutorialInput, module: string, stage: number): boolean => (input.modules[module] ?? 0) >= stage;
const ordered = (input: TutorialInput, module: string, stage: number): boolean =>
  has(input, module, stage) || input.queue.some(order => order.subject === module && order.stage >= stage);
const repair = (module: string, stage: number): string => `[data-guide="repair-order"][data-step="${module}:${String(stage)}"]`;
/** The repair's thumbnail on the strip: the way to it when the card shows another repair of the tab. */
const show = (module: string, stage: number): string => `[data-guide="repair-show"][data-step="${module}:${String(stage)}"]`;
const tab = (system: string): string => `[data-guide="system-${system}"]`;
const WORKS = '[data-guide="works"]';
/** Nothing to probe and nothing probed: the lesson is passed over, never waited on. */
const noSubject = (i: TutorialInput): boolean => i.alone === true && !i.probing && !i.facts.includes('FIRST_PROBE_REPORT');

export const ROAD: readonly Step[] = [
  // The first look (owner playtest 2026-11-06): the ship, and that the view moves. A commander who
  // already heard the welcome is past it.
  { id: 'lookAround', kind: 'read', chapter: 1, place: 'galaxy', marks: [], satisfied: i => i.acked.includes('welcome') },
  { id: 'welcome', kind: 'read', chapter: 1, place: 'any', marks: [] },
  { id: 'online', kind: 'press', chapter: 1, place: 'galaxy', marks: ['[data-guide="unlock-try"]'], satisfied: i => i.unlockToAnnounce !== 'production' },
  { id: 'collect', kind: 'press', chapter: 1, place: 'any', marks: [WORKS], satisfied: i => i.works < 1 },
  { id: 'orderRefinery', kind: 'press', chapter: 2, place: 'ship', marks: [repair('REFINERY', 2), show('REFINERY', 2), tab('REFINERY')], reached: i => ordered(i, 'REFINERY', 2) },
  { id: 'orderExtractor', kind: 'press', chapter: 2, place: 'ship', marks: [repair('EXTRACTOR', 1), show('EXTRACTOR', 1), tab('REFINERY')], reached: i => ordered(i, 'EXTRACTOR', 1) },
  { id: 'waitFirst', kind: 'wait', chapter: 2, place: 'any', marks: [], reached: i => has(i, 'REFINERY', 2) && has(i, 'EXTRACTOR', 1) },
  // The first crate is taught when the first repair frees it (owner playtest 2026-11-06: a crate left
  // unexplained for three chapters read as noise).
  { id: 'firstCrate', kind: 'press', chapter: 2, place: 'ship', marks: ['[data-guide="crate"]'], satisfied: i => !i.crates.some(c => c.id === 'REFINERY:2' && c.state === 'ready') },
  { id: 'orderAntenna', kind: 'press', chapter: 3, place: 'ship', marks: [repair('SURVEY', 1), show('SURVEY', 1), tab('SURVEY')], reached: i => ordered(i, 'SURVEY', 1) },
  { id: 'orderExtractor2', kind: 'press', chapter: 3, place: 'ship', marks: [repair('EXTRACTOR', 2), show('EXTRACTOR', 2), tab('REFINERY')], reached: i => ordered(i, 'EXTRACTOR', 2) },
  // A fast antenna must not drop the second extractor from the road (walk 2026-11-07).
  { id: 'waitAntenna', kind: 'wait', chapter: 3, place: 'any', marks: [], reached: i => has(i, 'SURVEY', 1) && ordered(i, 'EXTRACTOR', 2) },
  { id: 'intelOnline', kind: 'press', chapter: 4, place: 'galaxy', marks: ['[data-guide="unlock-try"]'], satisfied: i => i.unlockToAnnounce !== 'intel' },
  { id: 'probe', kind: 'press', chapter: 4, place: 'galaxy', marks: ['[data-guide="probe"]', '[data-guide="objective"]'], satisfied: i => i.probing || noSubject(i), reached: i => i.facts.includes('FIRST_PROBE_REPORT') },
  { id: 'probeFlying', kind: 'wait', chapter: 4, place: 'any', marks: [], satisfied: noSubject, reached: i => i.facts.includes('FIRST_PROBE_REPORT') },
  { id: 'openIntel', kind: 'press', chapter: 4, place: 'any', marks: ['[data-guide="dock-intel"]'], satisfied: noSubject },
  // The report is read where it is drawn (owner playtest 2026-11-07: a list row taught nothing). The row in
  // Intel first; outside Intel, the way back to it.
  { id: 'openReport', kind: 'press', chapter: 4, place: 'any', marks: ['[data-known="probe"] button', '[data-guide="dock-intel"]'], satisfied: noSubject },
  { id: 'report', kind: 'read', chapter: 4, place: 'galaxy', marks: ['[data-dossier-loot]'], satisfied: noSubject },
  { id: 'openCrates', kind: 'press', chapter: 5, place: 'ship', marks: ['[data-guide="crate"]'], satisfied: i => ['REFINERY:2', 'SURVEY:1'].every(id => i.crates.some(c => c.id === id && c.state === 'opened')) },
  { id: 'orderRefinery3', kind: 'press', chapter: 5, place: 'ship', marks: [repair('REFINERY', 3), show('REFINERY', 3), tab('REFINERY')], reached: i => ordered(i, 'REFINERY', 3) },
  { id: 'orderVault', kind: 'press', chapter: 5, place: 'ship', marks: [repair('VAULT', 1), show('VAULT', 1), tab('REFINERY')], reached: i => ordered(i, 'VAULT', 1) },
  { id: 'waitRefinery', kind: 'wait', chapter: 5, place: 'any', marks: [], reached: i => has(i, 'REFINERY', 3) },
  { id: 'openRefineryCrate', kind: 'press', chapter: 5, place: 'ship', marks: ['[data-guide="crate"]'], satisfied: i => i.crates.some(c => c.id === 'REFINERY:3' && c.state === 'opened') },
  { id: 'orderShipyard', kind: 'press', chapter: 5, place: 'ship', marks: [repair('SHIPYARD', 1), show('SHIPYARD', 1), tab('CARGO')], reached: i => ordered(i, 'SHIPYARD', 1) },
  { id: 'waitShipyard', kind: 'wait', chapter: 5, place: 'any', marks: [], reached: i => has(i, 'SHIPYARD', 1) },
  { id: 'openShipyardCrate', kind: 'press', chapter: 5, place: 'ship', marks: ['[data-guide="crate"]'], satisfied: i => i.crates.some(c => c.id === 'SHIPYARD:1' && c.state === 'opened') },
  { id: 'collectForExtractor', kind: 'press', chapter: 5, place: 'any', marks: [WORKS], satisfied: i => i.works < 1 },
  { id: 'orderExtractor3', kind: 'press', chapter: 5, place: 'ship', marks: [repair('EXTRACTOR', 3), show('EXTRACTOR', 3), tab('REFINERY')], reached: i => ordered(i, 'EXTRACTOR', 3) },
  { id: 'mine', kind: 'press', chapter: 6, place: 'galaxy', marks: ['[data-guide="mine"]', '[data-guide="unlock-dismiss"]', '[data-guide="objective"]'], satisfied: i => i.mining, reached: i => i.facts.includes('FIRST_MINING_RETURN') },
  { id: 'mineFlying', kind: 'wait', chapter: 6, place: 'any', marks: [], reached: i => i.facts.includes('FIRST_MINING_RETURN') },
  { id: 'collectMine', kind: 'press', chapter: 6, place: 'any', marks: [WORKS], satisfied: i => i.works < 1 },
  { id: 'farewell', kind: 'read', chapter: 6, place: 'any', marks: [] },
  { id: 'telescopeRing', kind:'read',chapter:7,place:'galaxy',marks:['[data-guide="sight-telescope"]'],satisfied:i=>!has(i,'TELESCOPE',1) },
  { id: 'telescopeTraffic', kind:'read',chapter:7,place:'galaxy',marks:['[data-guide="sight-craft"]','[data-guide="sight-telescope"]'],satisfied:i=>!has(i,'TELESCOPE',1) },
  { id: 'telescopeTrack', kind:'read',chapter:7,place:'galaxy',marks:['[data-guide="sight-craft"]','[data-guide="sight-telescope"]'],satisfied:i=>!has(i,'TELESCOPE',1) },
  { id: 'radarRing', kind:'read',chapter:8,place:'galaxy',marks:['[data-guide="sight-radar"]'],satisfied:i=>!has(i,'RADAR',1) },
  { id: 'radarContact', kind:'read',chapter:8,place:'galaxy',marks:['[data-guide="sight-unknown"]','[data-guide="sight-radar"]'],satisfied:i=>!has(i,'RADAR',1) },
  { id: 'sightTrio', kind:'read',chapter:8,place:'galaxy',marks:['[data-guide="sight-radar"]'],satisfied:i=>!has(i,'RADAR',1) },
  { id: 'away', kind: 'pause', chapter: 6, place: 'any', marks: [], satisfied: i => i.canPayNext },
];

/** How many chapters the card counts. */
export const TUTORIAL_CHAPTERS = 8;

/** The step the player is on, with the way there when its mark is somewhere else. */
export function tutorialStep(input: TutorialInput): TutorialAnswer {
  let from = 0;
  ROAD.forEach((step, index) => { if (step.reached?.(input)) from = index + 1; });
  // Older first-session ships could get a report before Extractor 2 was taught. It still pays
  // for the refinery's prerequisites; a later fact cannot make that required repair disappear.
  const extractor = ROAD.findIndex(step => step.id === 'orderExtractor2');
  if (input.facts.includes('FIRST_PROBE_REPORT') && from > extractor && !ordered(input, 'EXTRACTOR', 2)) from = extractor;
  // A newly repaired instrument returns to the radio once, even during the between-session pause.
  const lesson = ROAD.find(step => step.chapter >= 7 && !input.acked.includes(step.id) && !step.satisfied?.(input));
  for (const step of lesson ? [lesson] : ROAD.slice(from).filter(step => step.chapter < 7)) {
    if (input.acked.includes(step.id) || step.satisfied?.(input)) continue;
    if (step.kind === 'pause') return { kind: 'away' };
    const answer = { kind: 'step' as const, id: step.id, step: step.kind, chapter: step.chapter };
    if (step.kind === 'wait') return { ...answer, marks: step.marks };
    if (input.view === 'galaxy' && input.unlockToAnnounce !== null && (step.place === 'ship' || step.id === 'mine')) {
      // A focus panel hides the card on the galaxy: its close is the way to it (owner playtest 2026-11-07).
      return { ...answer, step: 'press', marks: ['[data-guide="unlock-dismiss"]', '[data-focus-close]'], nav: 'dismissUnlock', goal: step.marks };
    }
    if (step.place === 'ship' && input.view !== 'ship') {
      return input.view === 'galaxy'
        ? { ...answer, step: 'press', marks: ['[data-guide="dock-base"]'], nav: 'openShip' }
        : { ...answer, step: 'press', marks: ['[data-sheet-close]'], nav: 'closePage' };
    }
    if (step.place === 'galaxy' && input.view !== 'galaxy') {
      return { ...answer, step: 'press', marks: ['[data-sheet-close]'], nav: 'closePage' };
    }
    return { ...answer, marks: step.marks };
  }
  return { kind: 'done' };
}

/** The same road without spoken or report-reading interludes. No second progression model. */
export function tutorialAction(input: TutorialInput): TutorialAnswer {
  const answer = tutorialStep({ ...input, acked: [...input.acked, ...ROAD.filter(s => s.kind === 'read').map(s => s.id), 'openIntel', 'openReport'] });
  if (answer.kind === 'step' && !answer.nav && answer.marks[0]?.includes('repair-order') && input.works >= 1 && input.canPayNext) {
    return { ...answer, marks: [answer.marks[0], WORKS, ...answer.marks.slice(1)] };
  }
  return answer;
}

/**
 * HOW A WAIT HOLDS THE PLAYER (owner playtest 2026-11-07: "Oyuncuyu 10 sn'den fazla, bir şey yapmasına
 * izin vermeden kitleyemeyiz"). Ten seconds may be held; up to a minute the player roams with the line
 * still up; past it the NPC says when it will be back and steps aside until the work is done. Judged
 * on the wait's whole length, so the mode does not change halfway through it.
 */
export interface TutorialWait { until: Date; spanMs: number }
export type WaitMode = 'lock' | 'roam' | 'away';

/** The repairs each repair wait is for: the refinery's wait is not the vault's. */
const WAIT_ON: Partial<Record<TutorialStepId, readonly (readonly [string, number])[]>> = {
  waitFirst: [['REFINERY', 2], ['EXTRACTOR', 1]],
  waitAntenna: [['SURVEY', 1]],
  waitRefinery: [['REFINERY', 3]],
  waitShipyard: [['SHIPYARD', 1]],
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
