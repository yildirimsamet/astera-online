import { useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { ARENA_TUNING as T, FARM_POINTS, MAX_REMOTE_PILOTS } from '@astera/rules/arena';
import { FARM_TONE } from './farmColors.js';
import type { HudStore, HudSnapshot } from './store.js';
import { arenaCopy, type ArenaCopy } from './copy.js';

export interface HudBind {
  reticle: Ref<HTMLDivElement>; lead: Ref<HTMLDivElement>; hit: Ref<HTMLDivElement>; kill: Ref<HTMLDivElement>;
  enemies: (index: number) => Ref<HTMLDivElement>; threats: (index: number) => Ref<HTMLDivElement>;
  exit: Ref<HTMLDivElement>; crystal: Ref<HTMLDivElement>; damage: Ref<HTMLDivElement>; rear: Ref<HTMLDivElement>;
  landing: Ref<HTMLDivElement>;
  radar: Ref<HTMLCanvasElement>;
}

const clock = (seconds: number): string => `${String(Math.floor(seconds / 60))}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function Gauge({ icon, label, value, fill, tone, alert }: { icon: ReactNode; label: string; value: string; fill: number; tone: string; alert?: boolean }) {
  return <div className={`ah-gauge ${alert ? 'is-alert' : ''}`} style={{ '--tone': tone, '--fill': String(Math.max(0, Math.min(1, fill))) } as React.CSSProperties}>
    <span className="ah-gauge-icon" aria-hidden>{icon}</span>
    <span className="ah-gauge-label">{label}</span>
    <strong>{value}</strong>
    <i aria-hidden><b /></i>
  </div>;
}

/** The hold: what it would score (the number), how full it is and of what (the bar, by kind). */
function HoldGauge({ s, c }: { s: HudSnapshot; c: ArenaCopy }) {
  const full = s.cargo >= T.cargoCapacity;
  return <div className={`ah-gauge ah-hold ${full ? 'is-full' : ''}`} style={{ '--tone': 'var(--color-v2-ink)' } as React.CSSProperties}>
    <span className="ah-gauge-icon" aria-hidden>{ICON.cargo}</span>
    <span className="ah-gauge-label">{c.cargo} · {String(Math.floor(s.cargo))}/{String(T.cargoCapacity)}</span>
    <strong>{s.points}<small> {c.pointsShort}</small></strong>
    <i aria-hidden>{s.hold.map((units, kind) => units > 0 && <b key={kind}
      style={{ width: `${String(units / T.cargoCapacity * 100)}%`, background: FARM_TONE[kind], boxShadow: `0 0 6px ${FARM_TONE[kind] ?? ''}` }} />)}</i>
  </div>;
}

const ICON = {
  hull: <svg viewBox="0 0 16 16"><path d="M8 1.5 13.5 4v4.2c0 3-2.3 5.2-5.5 6.3C4.8 13.4 2.5 11.2 2.5 8.2V4z" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>,
  fuel: <svg viewBox="0 0 16 16"><path d="M8 1.8c2.6 3.4 4.2 5.7 4.2 7.7A4.2 4.2 0 0 1 3.8 9.5c0-2 1.6-4.3 4.2-7.7z" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>,
  cargo: <svg viewBox="0 0 16 16"><path d="m8 1.5 5.6 3.2v6.6L8 14.5l-5.6-3.2V4.7zM2.6 4.8 8 8l5.4-3.2M8 8v6.3" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>,
};

/** One line that says what the pilot must know right now, and why. */
function context(s: HudSnapshot, c: ArenaCopy): { title: string; hint?: string; tone: 'self' | 'warn' | 'hostile' | 'crystal'; progress?: number } | null {
  if (s.clientPhase !== 'flight' || (s.phase !== 'flying' && s.phase !== 'fuelOut')) return null;
  if (s.linkLost > 0) return { title: c.link, hint: `${String(Math.ceil(s.linkLost))} s`, tone: 'hostile' };
  if (s.phase === 'fuelOut') return { title: c.rescue, hint: `${String(Math.ceil(s.rescue))} s`, tone: 'warn', progress: 1 - s.rescue / T.fuelOutRescueDelay };
  if (s.inExit) {
    if (s.extraction > 0) return { title: c.exitHold, hint: `${s.extraction.toFixed(1)} / ${String(T.exitHold)} s`, tone: 'self', progress: s.extraction / T.exitHold };
    if (s.damageRecent) return { title: c.exitBroken, tone: 'hostile' };
    return { title: c.exitZone, hint: c.exitStop, tone: 'self' };
  }
  if (s.landed) {
    const kind = c.kinds[s.depositKind];
    if (s.mining && kind) return { title: `${kind} · ${c.mining}`, hint: `${String(Math.floor(s.cargo))}/${String(T.cargoCapacity)} · ${c.perUnit} ${String(FARM_POINTS[s.depositKind] ?? 0)} ${c.pointsShort} · ${c.miningHint}`, tone: 'crystal', progress: s.cargo / T.cargoCapacity };
    if (s.depositKind >= 0 && s.cargo >= T.cargoCapacity) return { title: c.full, hint: c.fullHint, tone: 'warn' };
    if (s.depositKind >= 0 && s.dry) return { title: c.dry, hint: c.dryHint, tone: 'warn' };
    return { title: c.landed, hint: c.landedHint, tone: 'self' };
  }
  if (s.landing === 'approach') return { title: `${c.landingNote} · ${String(Math.round(s.landingDistance))} m`, hint: c.landingHint, tone: 'crystal' };
  if (s.cloak > 0) return { title: c.cloaked, hint: `${s.cloak.toFixed(1)} s · ${c.cloakedHint}`, tone: 'self', progress: s.cloak / T.cloakDuration };
  if (s.fuel < 15) return { title: c.lowFuel, hint: `${clock(s.remaining)} · ${c.lowFuelHint}`, tone: 'hostile' };
  if (s.boundary < T.boundaryWarn) return { title: c.boundary, hint: `${String(Math.max(0, Math.round(s.boundary)))} m`, tone: 'warn' };
  // A full hold sends you to an exit, and the spawn shield is a countdown you plan around;
  // "you can land" is last because the LAND key and the touchdown ring already say it.
  if (s.cargo >= T.cargoCapacity) return { title: c.full, hint: c.fullHint, tone: 'warn' };
  if (s.shield > 0) return { title: `${c.shield} · ${String(Math.ceil(s.shield))} s`, hint: c.shieldHint, tone: 'self', progress: s.shield / T.spawnShield };
  if (s.canLand) return { title: c.approach, hint: c.approachHint, tone: 'crystal' };
  return null;
}

export function ArenaHud({ store, bind, onMenu, connection }: { store: HudStore; bind: HudBind; onMenu: () => void; connection: ReactNode }) {
  const s = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const c = arenaCopy();
  const flight = s.clientPhase === 'flight';
  const note = context(s, c);
  const hullShare = s.hull / T.hull;
  return <div className={`ah-root ${flight ? 'is-flight' : ''}`}>
    <div className="ah-top">
      <Gauge icon={ICON.hull} label={c.hull} value={`${String(Math.round(hullShare * 100))}%`} fill={hullShare}
        tone={hullShare < 0.3 ? 'var(--color-v2-hostile)' : 'var(--color-v2-self)'} alert={hullShare < 0.3} />
      <Gauge icon={ICON.fuel} label={c.fuel} value={clock(s.remaining)} fill={s.fuel / T.fuelTank}
        tone={s.fuel < 15 ? 'var(--color-v2-hostile)' : 'var(--color-v2-deut)'} alert={s.fuel < 15} />
      <HoldGauge s={s} c={c} />
      <button className="ah-menu" aria-label={c.settings} onClick={onMenu}>
        <svg viewBox="0 0 20 20" aria-hidden><path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
    </div>
    <div className="ah-instruments">
      <div className="ah-radar"><canvas ref={bind.radar} width={132} height={132} aria-hidden /></div>
      <div ref={bind.rear} className="ah-rear" data-hit={s.damageRecent ? '' : undefined}><span>{c.rear}</span><i /><i /><i /><i /></div>
      <div className="ah-speed">
        <strong>{Math.round(s.speed)}</strong><small>{c.speed}</small>
        <em data-state={s.landed ? 'landed' : s.turboActive ? 'turbo' : s.speed === 0 ? 'stopped' : 'flying'}>
          {s.landed ? c.landedChip : s.turboActive ? c.turboChip : s.speed === 0 ? c.stopped : `${String(Math.round(s.throttle * 100))}%`}
        </em>
      </div>
    </div>
    {connection}
    {note && <div className={`ah-note tone-${note.tone}`} role="status">
      <strong>{note.title}</strong>{note.hint && <span>{note.hint}</span>}
      {note.progress !== undefined && <i><b style={{ transform: `scaleX(${String(Math.max(0, Math.min(1, note.progress)))})` }} /></i>}
    </div>}
    <div className="ah-marks" aria-hidden>
      <div ref={bind.reticle} className="ah-reticle"><i /><i /><i /><i /><b /></div>
      <div ref={bind.hit} className="ah-hit"><i /><i /><i /><i /></div>
      <div ref={bind.kill} className="ah-kill"><i /><span>{c.destroyed}</span></div>
      <div ref={bind.lead} className="ah-lead" />
      {Array.from({ length: MAX_REMOTE_PILOTS }, (_, i) => <div key={i} ref={bind.enemies(i)} className="ah-enemy">
        <i /><i /><i /><i /><span><em data-name /> <b data-distance /></span><u><b data-hull /></u>
      </div>)}
      {Array.from({ length: 8 }, (_, i) => <div key={i} ref={bind.threats(i)} className="ah-threat" />)}
      <div ref={bind.exit} className="ah-exit"><i /><span>{c.exit} <b data-distance /><em data-points /></span></div>
      <div ref={bind.landing} className="ah-landing"><i /></div>
      <div ref={bind.crystal} className="ah-crystal"><i /><span><em data-kind>{c.crystal}</em> <b data-distance /></span></div>
      <div ref={bind.damage} className="ah-damage"><svg viewBox="0 0 120 120"><path d="M30 18a52 52 0 0 1 60 0" /></svg></div>
    </div>
    <div className={`ah-vignette ${s.damageRecent ? 'is-hit' : ''} ${hullShare < 0.3 && flight ? 'is-critical' : ''}`} aria-hidden />
  </div>;
}
