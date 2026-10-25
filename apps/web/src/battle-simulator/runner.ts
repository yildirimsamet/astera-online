import type { BattleScenario, BattleSimulation } from './scenario.js';
import type { SimulationResponse } from './simulation.worker.js';

/** A new isolated worker makes cancellation release a large recording immediately. */
export function runSimulation(input: BattleScenario, signal: AbortSignal): Promise<BattleSimulation> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { clearTimeout(timeout); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('SIMULATION_TIMEOUT')); }, 30_000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<SimulationResponse>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.simulation);
      else reject(new Error('SIMULATION_FAILED'));
    };
    worker.onerror = () => { cleanup(); reject(new Error('SIMULATION_WORKER_FAILED')); };
    worker.postMessage(input);
  });
}
