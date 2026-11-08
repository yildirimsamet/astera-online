/** The word above a name. A ship is its commander's home, and it is called a ship (owner 2026-11-09). */
export function worldKindKey(place: { kind?: 'CAPITAL' | 'COLONY' | 'NEUTRAL' | undefined; body?: string | undefined }): 'kindVessel' | 'kindCapital' | 'kindColony' | 'kindNeutral' {
  if (place.kind === 'CAPITAL') return place.body === 'VESSEL' ? 'kindVessel' : 'kindCapital';
  return place.kind === 'COLONY' ? 'kindColony' : 'kindNeutral';
}
