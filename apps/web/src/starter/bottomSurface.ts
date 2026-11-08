/** One owner for the bottom edge: pages, selections, destination, then the next action. */
export function bottomSurface(input: { page: boolean; selected: boolean; destination: boolean; starter: boolean; context: boolean }): 'selection' | 'destination' | 'starter' | 'context' | null {
  if (input.page) return null;
  if (input.selected) return 'selection';
  if (input.destination) return 'destination';
  if (input.starter) return 'starter';
  return input.context ? 'context' : null;
}

/**
 * A selection on a flight that has ended draws no card (its host returns nothing), so it must not keep
 * the foot of the screen: the next step and a system's note would stay hidden behind nothing.
 */
export function selectionGone(focus: { kind: string; id?: string; key?: string } | null, live: { runs: readonly string[]; threads: readonly string[]; contacts: readonly string[] }): boolean {
  if (focus?.kind === 'run') return !live.runs.includes(focus.id ?? '');
  if (focus?.kind === 'contact') return !live.contacts.includes(focus.id ?? '');
  if (focus?.kind === 'thread') return !live.threads.includes(focus.key ?? '');
  return false;
}
