import { STARTER, VESSEL_HULLS, type VesselHull } from '@astera/rules';

/**
 * THE FIRST THREE MINUTES, ON THE DEVICE. Plan §3.9. One road with no turnings, so everyone arrives at
 * the same place, and that place is what the server builds from `STARTER.opening` when the ship is
 * claimed: what the browser did here is never sent, so there is nothing to argue about.
 *
 * The signal is a ship adrift, and the view flies out to it (owner 2026-11-06): the claim is made in
 * front of it. The hull shown is the hull given, because the claim carries it (`prologueHull`).
 */
export const PROLOGUE_STAGES = ['dark', 'powered', 'burning', 'batch', 'collected', 'patching', 'signal', 'warping', 'found', 'claim'] as const;
export type PrologueStage = (typeof PROLOGUE_STAGES)[number];
export type PrologueAction = 'power' | 'burn' | 'collect' | 'patch' | 'travel' | 'claim' | 'skip';

export interface PrologueWorld { stage: PrologueStage; since: number }

/** Long enough to see a thing happen, too short to be waiting. */
export const BURN_MS = 6_000;
export const PATCH_MS = 7_000;
/** The jump to the signal: long enough to feel the distance, short enough not to wait for it. */
export const WARP_MS = 1_800;

const ROAD: Partial<Record<PrologueAction, { from: PrologueStage; to: PrologueStage }>> = {
  power: { from: 'dark', to: 'powered' },
  burn: { from: 'powered', to: 'burning' },
  collect: { from: 'batch', to: 'collected' },
  patch: { from: 'collected', to: 'patching' },
  travel: { from: 'signal', to: 'warping' },
  claim: { from: 'found', to: 'claim' },
};

export const openPrologue = (now: number, stage: PrologueStage = 'dark'): PrologueWorld => ({ stage, since: now });

/** Out of turn is nothing at all: a double tap on a button that has just moved on. */
export function prologueAct(world: PrologueWorld, action: PrologueAction, now: number): PrologueWorld {
  if (action === 'skip') return world.stage === 'claim' ? world : { stage: 'claim', since: now };
  const way = ROAD[action];
  return way?.from === world.stage ? { stage: way.to, since: now } : world;
}

/** The three things that finish on their own. A reload on any lands where it should have got to. */
export function prologueTick(world: PrologueWorld, now: number): PrologueWorld {
  if (world.stage === 'warping' && now - world.since >= WARP_MS) return { stage: 'found', since: world.since + WARP_MS };
  if (world.stage === 'burning' && now - world.since >= BURN_MS) return { stage: 'batch', since: world.since + BURN_MS };
  if (world.stage === 'patching' && now - world.since >= PATCH_MS) return { stage: 'signal', since: world.since + PATCH_MS };
  return world;
}

const reached = (world: PrologueWorld, stage: PrologueStage): boolean =>
  PROLOGUE_STAGES.indexOf(world.stage) >= PROLOGUE_STAGES.indexOf(stage);

/** Share of the work under way, 0 to 1, for the bar under it. */
export const prologueShare = (world: PrologueWorld, now: number): number => {
  if (world.stage === 'burning') return Math.min(1, (now - world.since) / BURN_MS);
  if (world.stage === 'patching') return Math.min(1, (now - world.since) / PATCH_MS);
  return reached(world, 'batch') ? 1 : 0;
};

/** What is in the holds at this moment. Skipped or played, it ends on the opening. */
export const prologueHeld = (world: PrologueWorld): { alloy: number; crystal: number } => ({
  alloy: reached(world, 'collected') ? STARTER.opening.alloy : 0,
  crystal: reached(world, 'powered') ? STARTER.opening.crystal : 0,
});

/** What the furnace has made and not yet been emptied. */
export const prologueBatch = (world: PrologueWorld, now: number): number => {
  if (world.stage === 'burning') return Math.round(STARTER.opening.alloy * prologueShare(world, now));
  return world.stage === 'batch' ? STARTER.opening.alloy : 0;
};

export const prologueLit = (world: PrologueWorld): boolean => reached(world, 'powered');
export const refineryRunning = (world: PrologueWorld): boolean => reached(world, 'burning');
export const sensorsListening = (world: PrologueWorld): boolean => reached(world, 'signal');

/** The five marks along the top: one for each thing the player does. */
export const prologueStep = (stage: PrologueStage): number =>
  ({ dark: 0, powered: 1, burning: 1, batch: 2, collected: 3, patching: 3, signal: 4, warping: 4, found: 5, claim: 5 })[stage];
export const PROLOGUE_STEPS = 5;

const KEY = 'astera.prologue';

export function restorePrologue(now: number): PrologueWorld {
  try {
    const saved = localStorage.getItem(KEY);
    const stage = PROLOGUE_STAGES.find(known => known === saved);
    // A timer that was running restarts rather than pretending: nothing in it is worth a saved clock.
    return openPrologue(now, stage ?? 'dark');
  } catch {
    return openPrologue(now);
  }
}

export function savePrologue(stage: PrologueStage): void {
  try { localStorage.setItem(KEY, stage); } catch { /* A private window plays it through once. */ }
}

export function clearPrologue(): void {
  try { localStorage.removeItem(KEY); localStorage.removeItem(HULL_KEY); } catch { /* Nothing was kept. */ }
}

const HULL_KEY = 'astera.prologue.hull';

/** The ship this player was shown, chosen once and kept, so a reload does not swap it for another. */
export function prologueHull(): VesselHull {
  try {
    const saved = VESSEL_HULLS.find(hull => hull === localStorage.getItem(HULL_KEY));
    if (saved) return saved;
    const picked = VESSEL_HULLS[Math.floor(Math.random() * VESSEL_HULLS.length)] ?? 'SPINE';
    localStorage.setItem(HULL_KEY, picked);
    return picked;
  } catch {
    return 'SPINE';
  }
}
