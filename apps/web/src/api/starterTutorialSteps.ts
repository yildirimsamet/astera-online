/**
 * THE STARTER GUIDE'S STEPS: the held core, then the first-time moments (`starter/tutorial/script.ts`,
 * owner 2026-11-08 N1). The admin funnel on the server counts them in this order. It lives here
 * because the server image ships only this folder of the client.
 */
export const STARTER_TUTORIAL_STEPS = [
  'online', 'collect', 'orderRefinery', 'waitFirst',
  'firstCrate', 'openIntel', 'openReport', 'report', 'mine', 'mineFlying', 'collectMine', 'farewell',
  'telescopeRing', 'telescopeTraffic', 'telescopeTrack', 'radarRing', 'radarContact', 'sightTrio',
] as const;

export type StarterTutorialStepId = (typeof STARTER_TUTORIAL_STEPS)[number];
