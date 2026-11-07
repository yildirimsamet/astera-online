/** One owner for the bottom edge: pages, selections, destination, then the next action. */
export function bottomSurface(input: { page: boolean; selected: boolean; destination: boolean; starter: boolean; context: boolean }): 'selection' | 'destination' | 'starter' | 'context' | null {
  if (input.page) return null;
  if (input.selected) return 'selection';
  if (input.destination) return 'destination';
  if (input.starter) return 'starter';
  return input.context ? 'context' : null;
}
