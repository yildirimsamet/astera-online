import type { GalaxyPlanet, GalaxyView } from '../api/schemas.js';

const NO_PLANETS: readonly GalaxyPlanet[] = [];

/**
 * Add only current clan identity to renderable world rows. `intel` is untouched:
 * an UNKNOWN clan world stays an UNKNOWN silhouette and never gains another
 * commander's sensor-derived facts.
 */
export function planetsWithClanPresence(
  galaxy: GalaxyView | undefined,
): readonly GalaxyPlanet[] {
  if (!galaxy) return NO_PLANETS;
  const presence = galaxy.clanPresence;
  if (!presence) return galaxy.planets;

  const byWorld = new Map<string, {
    playerId: string;
    username: string;
    name: string;
  }>();
  for (const member of presence.members) {
    if (member.playerId === galaxy.you.playerId) continue;
    for (const world of member.worlds) {
      byWorld.set(world.planetId, {
        playerId: member.playerId,
        username: member.username,
        name: world.name,
      });
    }
  }
  if (byWorld.size === 0) return galaxy.planets;

  return galaxy.planets.map((planet) => {
    const clanmate = byWorld.get(planet.id);
    if (!clanmate) return planet;
    return {
      ...planet,
      name: clanmate.name,
      owner: clanmate.username,
      controller: {
        kind: 'PLAYER' as const,
        playerId: clanmate.playerId,
        displayName: clanmate.username,
      },
      clan: presence.clan,
      clanmate: true,
    };
  });
}
