import { motionPositionAt, type MonumentMotion, type Vec3 } from '@astera/rules';
import { useTranslation } from 'react-i18next';
/** One selected route, in a fixed isometric projection: the amber curve is the
* real future motion, the blue line the immutable flight to its meeting point. */
export function MonumentRoutePreview({ from, motion, arriveAt, now }: {
  from: Vec3;
  motion: MonumentMotion;
  arriveAt: number;
  now: number;
}) {
  const { t } = useTranslation();
  const end = Math.max(now, arriveAt);
  const curve = Array.from({ length: 33 }, (_, i) => motionPositionAt(motion, now + (end - now) * i / 32));
  const aim = motionPositionAt(motion, end);
  const project = (p: Vec3) => ({ x: p.x - p.z * 0.65, y: -p.y * 0.8 + (p.x + p.z) * 0.3 });
  const points = [from, ...curve].map(project);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const scale = Math.min(264 / Math.max(1, maxX - minX), 116 / Math.max(1, maxY - minY));
  const map = (p: Vec3) => { const q = project(p); return { x: 28 + (q.x - minX) * scale, y: 20 + (q.y - minY) * scale }; };
  const a = map(from), b = map(aim), c = map(curve[0]!);
  return <div data-testid="monument-route-preview" className="overflow-hidden rounded-control border border-v2-line bg-v2-deep/70">
  <svg viewBox="0 0 320 156" role="img" aria-label={t('monument.routePreview')} className="block w-full">
   <path d={curve.map((p, i) => { const q = map(p); return `${i === 0 ? 'M' : 'L'}${q.x},${q.y}`; }).join(' ')} fill="none" stroke="var(--color-v2-alloy)" strokeWidth="2" strokeDasharray="4 4"/>
   <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-v2-crystal)" strokeWidth="2"/>
   <circle cx={a.x} cy={a.y} r="4" fill="var(--color-v2-crystal)"/>
   <circle cx={c.x} cy={c.y} r="5" fill="var(--color-v2-alloy)"/>
   <circle cx={b.x} cy={b.y} r="7" fill="none" stroke="var(--color-v2-self)" strokeWidth="2"/>
  </svg>
  <div className="flex justify-between gap-2 px-3 pb-2 text-micro">
   <span className="text-v2-crystal">{t('monument.routeHome')}</span>
   <span className="text-v2-alloy">{t('monument.routeNow')}</span>
   <span className="text-v2-self">{t('monument.routeMeeting')}</span>
  </div>
 </div>;
}
