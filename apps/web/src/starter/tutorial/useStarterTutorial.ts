import type { VesselView } from '../../api/starterSchemas.js';
import { z } from 'zod';
import { REPAIR_LADDER, nextRequiredStep } from '@astera/rules';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useGalaxy, useMining, usePending, usePlanet } from '../../api/queries.js';
import { useProjected } from '../../lib/projection.js';
import { vesselToPlanetView } from '../adapter.js';
import { timeToAfford } from '../steps.js';
import { repairWait, tutorialAction, tutorialStep, type TutorialInput, type TutorialAnswer, type TutorialStepId, type TutorialView, type TutorialWait } from './script.js';

/** Remembered only on this device; the ship itself carries everything else. */
const keyOf = (vesselId: string): string => `astera.starter.tutorial.${vesselId}`;

function readAcked(vesselId: string): string[] {
  try {
    const parsed = z.array(z.string()).safeParse(JSON.parse(localStorage.getItem(keyOf(vesselId)) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}

/** Marks that leave no trace on the ship: pressing them is the step. */
export const ACK_ON_PRESS: readonly TutorialStepId[] = ['collect', 'collectForExtractor', 'collectMine', 'openIntel', 'openReport'];


export interface StarterTutorial {
  answer: TutorialAnswer;
  action?: TutorialAnswer;
  /** Minutes until the store and works can pay the repair the player comes back for. */
  backIn: number | null;
  farewelled?: boolean;
  homeAt?: Date;
  /** When the work a wait step is for is done, and how long it runs in all. */
  wait?: TutorialWait;
  vessel?: VesselView;
  ack: (id: TutorialStepId) => void;
}

/** The tutorial's step for the ship on screen; nothing at all when there is no ship. */
export function useStarterTutorial(view: TutorialView): StarterTutorial | null {
  const planet = usePlanet();
  const vessel = planet.data?.vessel;
  const pending = usePending();
  const mining = useMining();
  const galaxy = useGalaxy();
  const plan = useMemo(() => (vessel ? vesselToPlanetView(vessel) : null), [vessel]);
  const held = useProjected(plan?.planet, planet.dataUpdatedAt, 5_000);
  const [acked, setAcked] = useState<{ id: string; list: string[] } | null>(null);
  const vesselId = vessel?.id ?? null;
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
  const next = nextRequiredStep({ modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel }, queued)?.step;
  const purse = { alloy: held.alloy, crystal: held.crystal, bufferAlloy: held.bufferAlloy, bufferCrystal: held.bufferCrystal };
  const backIn = next ? timeToAfford(next, purse, { alloyPerHour: plan.planet.alloyPerHour, crystalPerHour: plan.planet.crystalPerHour }) : 0;
  const input: TutorialInput = {
    modules: vessel.modules,
    facts: vessel.facts,
    queue: vessel.queue,
    unlockToAnnounce: vessel.unlockToAnnounce,
    works: held.bufferAlloy,
    canPayNext: backIn === 0,
    probing: (pending.data?.pending ?? []).some(thread => thread.kind === 'probe'),
    mining: (mining.data?.runs.length ?? 0) > 0,
    crates: vessel.crates,
    // Only once the map has loaded: an unread map is not an empty galaxy.
    alone: galaxy.data !== undefined && !galaxy.data.planets.some(world => world.body === 'VESSEL' && !world.isSelf && world.id !== vessel.id),
    view,
    acked: list,
  };
  const answer = tutorialStep(input);
  const action = tutorialAction(input);
  const run = mining.data?.runs[0];
  const flight = (pending.data?.pending ?? []).find(thread => thread.kind === 'fleet');
  const homeAt = run ? run.homeAt ?? new Date(2 * run.arriveAt.getTime() - run.departAt.getTime()) : flight?.homeAt ?? (flight?.leg === 'outbound' && flight.path ? new Date(flight.arriveAt.getTime() + flight.path.arriveAt.getTime() - flight.path.departAt.getTime()) : flight?.arriveAt);
  // A probe flies there and back: a leg's own length, twice, ends when its report lands.
  const probe = (pending.data?.pending ?? []).find(thread => thread.kind === 'probe' && thread.id !== undefined && thread.path !== undefined);
  const leg = probe?.path ? probe.path.arriveAt.getTime() - probe.path.departAt.getTime() : 0;
  const probeWait = probe ? { until: new Date(probe.arriveAt.getTime() + (probe.leg === 'return' ? 0 : leg)), spanMs: 2 * leg } : null;
  const waiting = answer.kind === 'step' && answer.step === 'wait' ? answer.id : null;
  const wait = waiting === null ? null
    : repairWait(waiting, vessel.queue)
      ?? (waiting === 'mineFlying' && run && homeAt ? { until: homeAt, spanMs: homeAt.getTime() - run.departAt.getTime() } : null)
      ?? (waiting === 'probeFlying' ? probeWait : null);
  return { answer, action, backIn, ack, vessel, farewelled: list.includes('farewell'), ...(homeAt ? { homeAt } : {}), ...(wait ? { wait } : {}) };
}
