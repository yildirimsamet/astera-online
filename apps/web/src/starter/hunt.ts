/** Where the first hunt stands: an outpost to probe, probes in the air, both guards read, a fleet on its way. */
export type HuntStage = { stage: 'probe'; target: string } | { stage: 'probing' | 'decide' | 'raid' };

/**
 * THE FIRST HUNT, READ OFF THE MAP (plan §5, F4e). The server marks the ship's two first outposts on the
 * map until the first outpost victory, so the hunt is on exactly while a mark is. Each step after that is
 * a fact the client already holds: a current report per outpost, and this ship's own flights to them.
 */
export function huntStage(
  planets: readonly { id: string; firstHunt?: boolean }[],
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
  return unread.length > 0 ? { stage: 'probing' } : { stage: 'decide' };
}
