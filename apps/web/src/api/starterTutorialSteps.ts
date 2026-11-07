/**
 * THE STARTER TUTORIAL'S STEPS, IN ROAD ORDER. The tutorial (`starter/tutorial/script.ts`) walks
 * them; the admin funnel on the server counts them. It lives here because the server image ships
 * only this folder of the client.
 */
export const STARTER_TUTORIAL_STEPS = [
  'lookAround', 'welcome', 'online', 'collect', 'orderRefinery', 'orderExtractor', 'waitFirst',
  'firstCrate', 'orderAntenna', 'orderExtractor2', 'waitAntenna', 'intelOnline', 'probe', 'probeFlying',
  'openIntel', 'openReport', 'report', 'openCrates', 'orderRefinery3', 'orderVault', 'waitRefinery',
  'openRefineryCrate', 'orderShipyard', 'waitShipyard', 'openShipyardCrate', 'collectForExtractor', 'orderExtractor3',
  'mine', 'mineFlying', 'collectMine', 'farewell',
  'telescopeRing', 'telescopeTraffic', 'telescopeTrack', 'radarRing', 'radarContact', 'sightTrio', 'away',
] as const;

export type StarterTutorialStepId = (typeof STARTER_TUTORIAL_STEPS)[number];
