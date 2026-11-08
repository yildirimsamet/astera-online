/** Where the first hunt stands: an outpost to probe, probes in the air, both guards read, a fleet on its way. */
export type HuntStage = { stage: 'probe'; target: string } | { stage: 'retry'; target: string; name: string } | { stage: 'probing' | 'decide' | 'raid' };

/**
 * THE FIRST HUNT, READ OFF THE MAP (plan §5, F4e). The server marks the ship's two first outposts on the
 * map until the first outpost victory, so the hunt is on exactly while a mark is. Each step after that is
 * a fact the client already holds: a current report per outpost, and this ship's own flights to them.
 */
export function huntStage(
  planets: readonly { id: string; firstHunt?: boolean; huntLost?: boolean; name?: string }[],
  reports: readonly { targetPlanetId: string; spatiallyCurrent?: boolean }[],
  threads: readonly { kind: string; targetPlanetId?: string; leg?: 'outbound' | 'return' }[],
): HuntStage | null {
  const posts = planets.filter(planet => planet.firstHunt === true).map(planet => planet.id);
  if (posts.length === 0) return null;
  const toPost = (thread: { targetPlanetId?: string }) => thread.targetPlanetId !== undefined && posts.includes(thread.targetPlanetId);
  if (threads.some(thread => thread.kind === 'fleet' && thread.leg !== 'return' && toPost(thread))) return { stage: 'raid' };
  const read = new Set(reports.filter(report => report.spatiallyCurrent !== false).map(report => report.targetPlanetId));
  const probing = new Set(threads.filter(thread => thread.kind === 'probe' && toPost(thread)).map(thread => thread.targetPlanetId));
  const unread = posts.filter(id => !read.has(id));
  const target = unread.find(id => !probing.has(id));
  if (target) return { stage: 'probe', target };
  if (unread.length > 0) return { stage: 'probing' };
  // A fight not won (owner 2026-11-09): the other guard next, the same one only if there is no other.
  const lost = new Set(planets.filter(planet => planet.huntLost === true).map(planet => planet.id));
  if (lost.size === 0) return { stage: 'decide' };
  const next = posts.find(id => !lost.has(id)) ?? posts[0];
  const place = planets.find(planet => planet.id === next);
  return place ? { stage: 'retry', target: place.id, name: place.name ?? '' } : { stage: 'decide' };
}
