/**
 * THE STARTER GUIDE'S STEPS: the held core, the first session's road, then the first-time moments
 * (`starter/tutorial/script.ts`, owner 2026-11-08 N1 and N12). The admin funnel on the server counts them in this order. It lives here
 * because the server image ships only this folder of the client.
 */
export const STARTER_TUTORIAL_STEPS = [
  'online', 'collect', 'orderRefinery', 'waitFirst',
  'orderExtractor', 'orderTelescope', 'waitTelescope', 'telescopeLook', 'zoomRock', 'findRock', 'mine', 'waitMine',
  'orderRadar', 'waitRadar', 'orderSurvey', 'waitSurvey', 'probe', 'waitProbe', 'orderShipyard', 'waitYard', 'buildShip', 'farewell',
  'openCrate', 'firstCrate', 'collectMine', 'jumpAsk', 'jumpGo', 'openIntel', 'openReport', 'report',
] as const;

export type StarterTutorialStepId = (typeof STARTER_TUTORIAL_STEPS)[number];
