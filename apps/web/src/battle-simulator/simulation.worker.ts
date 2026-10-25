import { scenarioSchema, simulateScenario, type BattleSimulation } from './scenario.js';

export type SimulationResponse = { ok: true; simulation: BattleSimulation } | { ok: false };
self.onmessage = (event: MessageEvent<unknown>): void => {
  try {
    const simulation = simulateScenario(scenarioSchema.parse(event.data));
    self.postMessage({ ok: true, simulation } satisfies SimulationResponse);
  } catch {
    self.postMessage({ ok: false } satisfies SimulationResponse);
  }
};
