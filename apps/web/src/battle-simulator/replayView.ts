/** Keep chunk download failures local to the report, before opening the 3D dialog. */
export async function loadBattleReplayView() {
  return (await import('./BattleReplayDialog.js')).default;
}

/** Browsers cache a failed module import for the document lifetime; a page reload clears it. */
export function reloadReplayPage(): void { window.location.reload(); }

/** What the simulator opens on: a recorded battle (from its report), or nothing for a free scenario. */
export interface SimulatorSource { kind: 'BATTLE' | 'MONUMENT'; id: string; pirateLevel?: number }

/** The simulator is its own chunk, loaded on the first tap like the replay. */
export async function loadSimulatorView() {
  return (await import('./SimulatorDialog.js')).default;
}
