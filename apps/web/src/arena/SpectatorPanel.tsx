import { useSyncExternalStore } from 'react';
import { alive, statsOf, type ArenaWorld } from '@astera/rules/arena';
import type { ArenaNetwork } from './network.js';
import type { HudStore } from './store.js';
import { teamCopy } from './teamCopy.js';
import { arenaCopy } from './copy.js';

/** Only this small overlay subscribes to live hull updates. The full flight page stays quiet. */
export function SpectatorPanel({ world, network, store, teamId, watching, onResults }: {
  world: ArenaWorld; network: ArenaNetwork; store: HudStore; teamId: string; watching: number | null; onResults: () => void;
}) {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const connection = useSyncExternalStore(network.subscribe, network.getSnapshot, network.getSnapshot);
  const t = teamCopy(); const c = arenaCopy(); const errors: Readonly<Record<string, string>> = t.errors;
  const friends = world.drones.filter(p => alive(p) && p.decoyOf < 0 && network.teamIds.get(p.id) === teamId);
  return <section className="arena-spectator" aria-label={t.watch}>
    <p role="status"><i aria-hidden />{connection.phase === 'online' ? t.watching : connection.phase === 'failed'
      ? errors[connection.reason] ?? c.kicks[connection.reason] ?? c.connectionFailed : c.reconnecting}
      <strong>{watching === null ? t.switching : network.names.get(watching) ?? t.friend}</strong></p>
    <div className="as-roster">{friends.map(p => <button key={p.id} type="button" aria-pressed={watching === p.id}
      disabled={connection.phase !== 'online'}
      onClick={() => { network.watch(p.id); }}><span>{network.names.get(p.id) ?? t.friend}</span>
      <small>{Math.round(p.hull / statsOf(p).hull * 100)}%</small><i style={{ '--hp': String(p.hull / statsOf(p).hull) } as React.CSSProperties} /></button>)}</div>
    <button type="button" className="as-result" onClick={onResults}>{t.results}</button>
    {connection.phase === 'failed' && <button type="button" className="as-result" onClick={() => { network.connect(world.pilot.ship, world.pilot.tactic, true); }}>{c.reconnect}</button>}
  </section>;
}
