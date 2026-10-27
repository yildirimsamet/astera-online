import { useMemo, type Ref } from 'react';
import { ARENA_TUNING as T, type ArenaLayout } from '@astera/rules/arena';
import i18n from '../i18n/index.js';
import type { ArenaCopy } from './copy.js';
import { mapGrid, mapPlan, mapPoint } from './map.js';
import { teamCopy } from './teamCopy.js';

/**
 * The Rift map (owner 2026-10-22, item 9): where you are, the rough structures, exits and
 * entries. The plan comes from the layout; Y7 adds only the living clan friends the server sent.
 * Shapes are SVG in metres; labels are HTML on top, so they stay crisp at any map size.
 * The own arrow and the altitude marker are moved by the client every few frames.
 */
export function MapSheet({ layout, c, self, altitude, onClose, friends = [] }: {
  layout: ArenaLayout; c: ArenaCopy; self: Ref<SVGGElement>; altitude: Ref<HTMLElement>; onClose: () => void;
  friends?: readonly { id: number; x: number; z: number }[];
}) {
  const plan = useMemo(() => mapPlan(layout), [layout]);
  const view = plan.radius * 1.06;
  const at = (x: number, y: number) => ({ left: `${String((x + view) / (2 * view) * 100)}%`, top: `${String((y + view) / (2 * view) * 100)}%` });
  const { step, rings } = mapGrid(plan.radius);
  // Markers keep one on-screen size whatever the Rift's size: they were drawn for a 2.6 km disc.
  const k = plan.radius / 2600;
  // A name on the outer side of its mark, so the districts round the heart never print over it
  // or each other: the heart's above it, one well off the north-south line beside it.
  const side = (x: number, y: number): 'top' | 'east' | 'west' | 'south' | 'north' =>
    x === 0 && y === 0 ? 'top' : Math.abs(x) > plan.radius * 0.15 ? (x > 0 ? 'east' : 'west') : y > 0 ? 'south' : 'north';
  return <section className="ah-map" role="dialog" aria-label={c.mapTitle}>
    <header>
      <strong>{c.mapTitle}</strong>
      <small>{c.mapSector} · Ø {(plan.radius * 2 / 1000).toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })} km</small>
      <button type="button" aria-label={c.mapClose} onClick={onClose}>
        <svg viewBox="0 0 16 16" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
    </header>
    <div className="ah-map-body">
      <div className="ah-map-chart">
        <svg viewBox={`${String(-view)} ${String(-view)} ${String(view * 2)} ${String(view * 2)}`} aria-hidden>
          <defs>
            <radialGradient id="ah-map-belt"><stop offset="0" stopColor="#6d8cff" stopOpacity=".55" /><stop offset="1" stopColor="#6d8cff" stopOpacity="0" /></radialGradient>
            <radialGradient id="ah-map-dust"><stop offset="0" stopColor="#c9a46e" stopOpacity=".8" /><stop offset=".75" stopColor="#c9a46e" stopOpacity=".45" /><stop offset="1" stopColor="#c9a46e" stopOpacity="0" /></radialGradient>
            <radialGradient id="ah-map-floor"><stop offset="0" stopColor="#0f2a3c" /><stop offset="1" stopColor="#050b14" /></radialGradient>
          </defs>
          <circle r={plan.radius} fill="url(#ah-map-floor)" className="ah-map-edge" />
          {rings.map(r => <circle key={r} r={r} className="ah-map-ring" />)}
          <path d={`M0 ${String(-plan.radius)}V${String(plan.radius)}M${String(-plan.radius)} 0H${String(plan.radius)}`} className="ah-map-ring" />
          {plan.belts.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="url(#ah-map-belt)" opacity={b.dense ? 0.9 : 0.5} />)}
          {plan.dust.map((d, i) => <circle key={i} data-dust="" cx={d.x} cy={d.y} r={d.r} fill="url(#ah-map-dust)" className="ah-map-dust" />)}
          {plan.landmarks.map((l, i) => <g key={i} transform={`translate(${String(l.x)} ${String(l.y)}) rotate(${String(l.angle)})`} className={`ah-map-mark is-${l.kind}`}>
            {l.kind === 'hub' ? <><circle r={110 * k} /><circle r={36 * k} className="is-core" /></>
              // An outpost (or the harbour annex, the same kind of place): a room between two
              // mouths, its doors at both ends of the long axis.
              : l.kind === 'outpost' || l.kind === 'annex' ? <><rect x={-35 * k} y={-100 * k} width={70 * k} height={200 * k} rx={10 * k} />
                <path d={`M${String(-35 * k)} ${String(-100 * k)}H${String(35 * k)}M${String(-35 * k)} ${String(100 * k)}H${String(35 * k)}`} className="is-door" /></>
              // A refinery wing: the hall across, the tower on it towards the heart.
              : l.kind === 'refinery' ? <><rect x={-60 * k} y={-40 * k} width={120 * k} height={80 * k} rx={8 * k} />
                <rect x={-50 * k} y={-10 * k} width={40 * k} height={40 * k} className="is-core" /></>
              // Tersane: Gangut's ring, its way through towards the heart, a depot each side.
              : l.kind === 'yard' ? <><circle r={100 * k} />
                <path d={`M0 ${String(-100 * k)}V${String(100 * k)}`} className="is-door" />
                {[-1, 1].map(side => <rect key={side} x={(side * 220 - 60) * k} y={-40 * k} width={120 * k} height={80 * k} rx={8 * k} />)}</>
              : l.kind === 'wreck' ? <rect x={-l.size * 0.7 * k} y={-30 * k} width={l.size * 1.4 * k} height={60 * k} rx={24 * k} />
                // Yarık Kanyonu: a long fused mass, its fissure winding end to end (local +Z down).
                : l.kind === 'canyon' ? <g transform={`scale(${String(Math.max(l.size, 220 * k) / 100)})`}>
                  <path d="M-58 -98C-18 -106 42 -94 64 -58C92 -18 86 42 60 80C30 104 -28 102 -60 72C-92 30 -94 -40 -58 -98Z" />
                  <path d="M0 -100C-34 -62 30 -32 0 0C-30 30 34 62 0 100" className="is-way" />
                </g>
                // Petek: a honeycomb rock, its cells a maze of short links.
                : l.kind === 'honeycomb' ? <g transform={`scale(${String(Math.max(l.size, 200 * k) / 100)})`}>
                  <path d="M-88 -30C-84 -78 -30 -100 14 -96C64 -92 98 -50 96 0C94 52 56 94 6 96C-46 98 -92 60 -88 -30Z" />
                  {[[0, 0], [-46, -27], [46, -27], [-46, 27], [46, 27], [0, -54], [0, 54]].map(([x = 0, y = 0], i) =>
                    <path key={i} className="is-cell" d={`M${String(x - 22)} ${String(y)}L${String(x - 11)} ${String(y - 19)}H${String(x + 11)}L${String(x + 22)} ${String(y)}L${String(x + 11)} ${String(y + 19)}H${String(x - 11)}Z`} />)}
                </g>
                // Rock you fly into: a lumpy mass, its tunnels traced inside.
                : l.kind === 'cave' ? <g transform={`scale(${String(Math.max(l.size, 220 * k) / 100)})`}>
                  <path d="M-96 -18C-92 -64 -46 -96 4 -92C52 -98 94 -58 98 -10C102 40 70 86 18 94C-30 100 -80 74 -94 30Z" />
                  <path d="M0 -98V-40M-40 -10C-20 30 20 30 40 -10C20 -50 -20 -50 -40 -10ZM-40 -10L-98 6M40 -10L97 8M0 26L-6 96" className="is-way" />
                </g>
                  // A station: a hexagon open on one face, the hangar (local +Z) towards the heart.
                  : <g transform={`scale(${String(Math.max(l.size, 200 * k) / 100)})`}>
                    <path d="M-30 86L-86 50V-50L0 -100L86 -50V50L30 86" />
                    <path d="M-30 86H30" className="is-door" />
                    <path d="M0 86V0M-50 -20H50" className="is-way" />
                  </g>}
          </g>)}
          {plan.entries.map((e, i) => <circle key={i} data-entry="" cx={e.x} cy={e.y} r={60 * k} className="ah-map-entry" />)}
          {plan.exits.map((e, i) => <g key={i} data-exit="" transform={`translate(${String(e.x)} ${String(e.y)})`} className="ah-map-exit">
            <circle r={Math.max(T.exitRadius, 110 * k)} /><rect x={-58 * k} y={-58 * k} width={116 * k} height={116 * k} transform="rotate(45)" />
          </g>)}
          <g ref={self} data-self="" className="ah-map-self">
            <g transform={`scale(${String(k)})`}><circle r={190} /><path d="M0 -150L105 115L0 60L-105 115Z" /></g>
          </g>
          {friends.map(p => <g key={p.id} data-friend-id={p.id} transform={`translate(${String(mapPoint(p.x, p.z).x)} ${String(mapPoint(p.x, p.z).y)})`} className="ah-map-friend">
            <circle r={65 * k} /><circle r={130 * k} className="is-ring" />
          </g>)}
        </svg>
        {plan.landmarks.filter(l => l.kind !== 'outpost' && l.kind !== 'refinery' && l.kind !== 'annex').map((l, i) => <span key={i} className="ah-map-label" data-side={side(l.x, l.y)} style={at(l.x, l.y)}>{c.landmarks[l.kind]}</span>)}
        {plan.exits.map((e, i) => <span key={i} className="ah-map-label is-exit" style={at(e.x, e.y)}>{c.exit}</span>)}
        {plan.dust.map((d, i) => <span key={i} className="ah-map-label is-dust" style={at(d.x, d.y + d.r)}>{c.mapDust}</span>)}
        <span className="ah-map-scale" style={{ width: `${String(step / (2 * view) * 100)}%` }}>
          {(step / 1000).toLocaleString(i18n.resolvedLanguage, { maximumFractionDigits: 1 })} km
        </span>
      </div>
      <div className="ah-map-alt" aria-hidden>
        <span>{c.mapAltitude}</span>
        <i><b ref={altitude} /></i>
      </div>
    </div>
    <footer>
      <ul>
        <li><i className="is-self" />{c.you}</li>
        {friends.length > 0 && <li><i className="is-friend" />{teamCopy().friend}</li>}
        <li><i className="is-exit" />{c.exit}</li>
        <li><i className="is-entry" />{c.mapEntry}</li>
        <li><i className="is-belt" />{c.mapBelt}</li>
        <li><i className="is-refinery" />{c.mapRefinery}</li>
        <li><i className="is-outpost" />{c.mapOutpost}</li>
        <li><i className="is-cave" />{c.mapCave}</li>
        <li><i className="is-dust" />{c.mapDust} · {c.dustSight.toLocaleLowerCase(i18n.resolvedLanguage)} {T.dustSight} m</li>
      </ul>
      <p>{friends.length > 0 ? teamCopy().mapFriends : c.mapNoShips}</p>
    </footer>
  </section>;
}
