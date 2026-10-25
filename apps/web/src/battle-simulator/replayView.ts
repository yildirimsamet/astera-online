/** Keep chunk download failures local to the report, before opening the 3D dialog. */
export async function loadBattleReplayView() {
  return (await import('./BattleReplayDialog.js')).default;
}

/** Browsers cache a failed module import for the document lifetime; a page reload clears it. */
export function reloadReplayPage(): void { window.location.reload(); }
