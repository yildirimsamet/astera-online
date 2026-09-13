/**
 * WHICH WORLD A RESEARCH CARD'S FIX OPENS. D209, owner instruction.
 *
 * Research is gated by the CAPITAL's Command Core on every world, so a Core
 * shortfall is answered on the capital's planet sheet — never on the colony the
 * research menu happened to be opened from, where raising the Core changes nothing
 * about the gate. Anything else stays on the current world. Null means "do not
 * change world".
 */
export function researchNeedWorld(id: string, capitalPlanetId: string | null): string | null {
  return id === 'CORE' ? capitalPlanetId : null;
}
