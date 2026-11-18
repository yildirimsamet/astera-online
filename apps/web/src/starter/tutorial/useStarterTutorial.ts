import type { VesselView } from '../../api/starterSchemas.js';
import { z } from 'zod';
import { REPAIR_LADDER, jumpWindowOpen, nextRequiredStep } from '@astera/rules';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useGalaxy, useIntel, useMining, usePending, usePlanet } from '../../api/queries.js';
import { useProjected } from '../../lib/projection.js';
import { vesselToPlanetView } from '../adapter.js';
import { huntStage } from '../hunt.js';
import { hasOtherShip } from '../neighbour.js';
import { opportunities, opportunityKey, type Opportunity } from '../opportunities.js';
import { canPayDart, timeToAfford } from '../steps.js';
import { useAdviceMemory } from './adviceMemory.js';
import { useRockSheet } from './rockSheet.js';
import { useTargetSheet } from './targetSheet.js';
import { sceneToCome, scenePlayedFor, useDirector, useSceneToCome } from '../director/director.js';
import { JUMP_SCENE, announcedByScene, sceneAnnouncing } from '../director/scenes.js';
import { useLandingSheet } from './landingSheet.js';
import { useMigration } from '../queries.js';
import type { MigrationView } from '../../api/starterSchemas.js';
import { repairWait, tutorialStep, type JumpBlock, type TutorialInput, type TutorialAnswer, type TutorialStepId, type TutorialView, type TutorialWait } from './script.js';
import { holdFull } from '../hold.js';

/** Remembered only on this device; the ship itself carries everything else. */
const keyOf = (vesselId: string): string => `astera.starter.tutorial.${vesselId}`;

function readAcked(vesselId: string): string[] {
  try {
    const parsed = z.array(z.string()).safeParse(JSON.parse(localStorage.getItem(keyOf(vesselId)) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}

/** Marks that leave no trace on the ship: pressing them is the step. */
export const ACK_ON_PRESS: readonly TutorialStepId[] = ['collect', 'collectMine', 'openIntel', 'openReport', 'buildShip', 'jumpGo'];

/**
 * Records a pressed mark once the press is over. Recording moves the guide on, and a mark that belongs
 * to the step (the craft in the sky) leaves with it: recorded mid-press, it was gone before its own
 * handler ran (F6 walk 2026-11-08).
 */
export const ackAfterPress = (ack: (id: TutorialStepId) => void, id: TutorialStepId): void => {
  window.setTimeout(() => { ack(id); }, 0);
};

export interface StarterTutorial {
  answer: TutorialAnswer;
  /** Where the player stands: out on the galaxy, aboard, or on a page. */
  view: TutorialView;
  /** What the ship can do this moment, best first (plan F1): the advisor's offers. */
  offers: readonly Opportunity[];
  /** What the player picked from them, while it is still on offer. */
  pick?: Opportunity;
  /** Minutes until the store and works can pay the repair the player comes back for. */
  backIn: number | null;
  farewelled?: boolean;
  /** How much of the ship is repaired, in percent: what the handover says. */
  repaired?: number;
  /** The jump window is open (plan 2026-11-13 §5.1): the handover gives the player the choice, not more work. */
  windowOpen?: boolean;
  /** What holds the open jump, as the drive's panel says it: the handover says why. */
  jumpBlock?: JumpBlock;
  /** When the work a wait step is for is done, and how long it runs in all. */
  wait?: TutorialWait;
  vessel?: VesselView;
  ack: (id: TutorialStepId) => void;
}

/** The panel's reason as the guide says it; one it does not name (the road not done) is the window's own. */
const jumpBlockOf = (block: MigrationView['block']): JumpBlock | undefined => {
  switch (block?.code) {
    case 'MIGRATION_FLEET_OUT': return 'fleet';
    case 'MIGRATION_SEASON_WAIT': return 'season';
    case 'NO_FRONTIER': return 'frontier';
    default: return undefined;
  }
};

/** The tutorial's step for the ship on screen; nothing at all when there is no ship. */
export function useStarterTutorial(view: TutorialView): StarterTutorial | null {
  const planet = usePlanet();
  const vessel = planet.data?.vessel;
  const pending = usePending();
  const mining = useMining();
  const galaxy = useGalaxy();
  const intel = useIntel();
  const rockOpen = useRockSheet();
  const landing = useLandingSheet();
  // Read again as a scene starts or ends: a scene can stand in for a step (the rock's approach).
  useDirector();
  // The card of a system its scene will show waits for that scene; one let go unseen asks for the card again.
  const announcing = vessel?.unlockToAnnounce ? sceneAnnouncing(vessel.unlockToAnnounce) : null;
  const announcingToCome = useSceneToCome(vessel?.id ?? '', announcing);
  // The drive's panel is asked why the jump is held only once its window is open.
  const windowOpen = vessel ? jumpWindowOpen({ modules: vessel.modules, facts: vessel.facts }) : false;
  const migration = useMigration({ enabled: windowOpen });
  const jumpBlock = windowOpen ? jumpBlockOf(migration.data?.block ?? null) : undefined;
  // The step the player is acting on: aboard, on a page, or with a world open over the galaxy (owner phone playtest 2026-11-19).
  const targetOpen = useTargetSheet();
  const engaged = view !== 'galaxy' || targetOpen;
  const inHand = useRef<{ vesselId: string; id: TutorialStepId } | null>(null);
  const plan = useMemo(() => (vessel ? vesselToPlanetView(vessel) : null), [vessel]);
  const held = useProjected(plan?.planet, planet.dataUpdatedAt, 5_000);
  const [acked, setAcked] = useState<{ id: string; list: string[] } | null>(null);
  const vesselId = vessel?.id ?? null;
  const [advice] = useAdviceMemory(vesselId);
  const cache = useRef(new Map<string, string[]>());
  const read = (id: string): string[] => {
    let value = cache.current.get(id);
    if (!value) { value = readAcked(id); cache.current.set(id, value); }
    return value;
  };
  const list = vesselId === null ? [] : acked?.id === vesselId ? acked.list : read(vesselId);
  const ack = useCallback((id: TutorialStepId) => {
    if (vesselId === null) return;
    const next = [...new Set([...(cache.current.get(vesselId) ?? []), id])];
    try { localStorage.setItem(keyOf(vesselId), JSON.stringify(next)); } catch { /* This visit still remembers it. */ }
    cache.current.set(vesselId, next);
    setAcked({ id: vesselId, list: next });
  }, [vesselId]);
  if (!vessel || !plan) return null;
  const queued = vessel.queue.flatMap(o => REPAIR_LADDER.find(s => s.module === o.subject && s.stage === o.stage) ?? []);
  const next = nextRequiredStep({ modules: vessel.modules, facts: vessel.facts }, queued)?.step;
  const purse = { alloy: held.alloy, crystal: held.crystal, bufferAlloy: held.bufferAlloy, bufferCrystal: held.bufferCrystal };
  const income = { alloyPerHour: plan.planet.alloyPerHour, crystalPerHour: plan.planet.crystalPerHour };
  const backIn = next ? timeToAfford(next, purse, income) : 0;
  const probing = (pending.data?.pending ?? []).some(thread => thread.kind === 'probe');
  // A run that is done is home: the line counts the same way (GalaxyView).
  const out = (mining.data?.runs ?? []).some(run => run.status !== 'done');
  // Only once the map has loaded: an unread map is not an empty galaxy.
  const alone = galaxy.data !== undefined && !hasOtherShip(galaxy.data.planets, vessel.id);
  const input: TutorialInput = {
    modules: vessel.modules,
    facts: vessel.facts,
    queue: vessel.queue,
    // A system seen coming back in its scene has been announced: its card is closing itself; one still to be shown waits for it.
    unlockToAnnounce: announcedByScene(vessel.id, vessel.unlockToAnnounce) || announcingToCome ? null : vessel.unlockToAnnounce,
    works: held.bufferAlloy,
    canPayNext: backIn === 0,
    canBuildShip: canPayDart(held),
    probing,
    mining: out,
    crates: vessel.crates,
    alone,
    view,
    rockOpen,
    noRocks: mining.fieldData?.asteroids.length === 0,
    rockShown: scenePlayedFor(vessel.id, 'rock'),
    jumpWaiting: sceneToCome(vessel.id, JUMP_SCENE),
    ...(jumpBlock ? { jumpBlock } : {}),
    landing,
    acked: list,
  };
  const holding = engaged && inHand.current?.vesselId === vessel.id ? inHand.current.id : undefined;
  const answer = tutorialStep(holding ? { ...input, inHand: holding } : input);
  // Taken up as it is shown where it is done; kept while the player is on it, let go once they are not.
  const atHand = answer.kind === 'step' && (answer.step === 'press' || answer.step === 'read') && !answer.nav;
  inHand.current = atHand ? { vesselId: vessel.id, id: answer.id } : engaged ? inHand.current : null;
  const offers = opportunities({
    progress: { modules: vessel.modules, facts: vessel.facts },
    queue: vessel.queue,
    held: { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium, bufferAlloy: held.bufferAlloy, bufferCrystal: held.bufferCrystal, bufferDeuterium: held.bufferDeuterium },
    income,
    features: vessel.features,
    crateReady: vessel.crates.some(crate => crate.state === 'ready'),
    probing,
    mining: out,
    alone,
    // The same hunt the line is given, so the lit control and a pick follow it too.
    hunt: huntStage(galaxy.data?.planets ?? [], intel.data?.probeReports ?? [], pending.data?.pending ?? []),
    holdFull: holdFull({ ...held, queue: vessel.queue, crates: vessel.crates }),
  });
  const pick = advice.pick === null ? undefined : offers.find(offer => opportunityKey(offer) === advice.pick);
  const waiting = answer.kind === 'step' && answer.step === 'wait' ? answer.id : null;
  const wait = waiting === null ? null : repairWait(waiting, vessel.queue);
  return {
    answer, view, offers, ...(pick ? { pick } : {}), backIn, ack, vessel, farewelled: list.includes('farewell'),
    repaired: Math.round(vessel.progress.share * 100), windowOpen, ...(jumpBlock ? { jumpBlock } : {}), ...(wait ? { wait } : {}),
  };
}
