import { isScenarioActive, type NewcomerScenarioStep } from '@astera/rules';
import type { HudTourStep } from './MainHudTour.js';

/** -1: the founding-hour card has the screen; 0–3: the tour's step; 4: the whole HUD. */
export type HudStage = -1 | HudTourStep | 4;

/**
 * THE HUD'S OPENING REVEAL (playtest 2026-11-23 item 5). The landing card hides the HUD; after it the tour
 * opens it piece by piece. Review 2026-11-23: a first game whose card is gone tours whether or not its start
 * has been answered — a failed start must not leave the HUD, and the card's own start key, hidden for good.
 */
export function hudStageOf(input: {
  aboard: boolean;
  step: NewcomerScenarioStep | null;
  arrivalPending: boolean;
  tourDone: boolean;
  tourStep: HudTourStep;
}): HudStage {
  const { step } = input;
  if (input.aboard || step === null || !isScenarioActive(step) || input.tourDone) return 4;
  if (step === 'LANDING' && input.arrivalPending) return -1;
  return step === 'LANDING' || step === 'MINE' ? input.tourStep : 4;
}
