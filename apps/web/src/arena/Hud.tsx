import { memo, useState, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { ARENA_TUNING as T, lowFuel, shipStats, shipTuning, type ArenaLayout } from '@astera/rules/arena';
import { FARM_TONE } from './farmColors.js';
import { ENEMY_MARKS } from './marks.js';
import type { HudStore, HudSnapshot } from './store.js';
import { arenaCopy, type ArenaCopy } from './copy.js';
import { MapSheet } from './MapSheet.js';
import { placesOf } from './landmarks.js';
import { PING_KINDS } from './pings.js';
import { PING_ICONS } from './PingWheel.js';

export interface HudBind {
  reticle: Ref<HTMLDivElement>; lead: Ref<HTMLDivElement>; hit: Ref<HTMLDivElement>; kill: Ref<HTMLDivElement>;
  enemies: (index: number) => Ref<HTMLDivElement>; threats: (index: number) => Ref<HTMLDivElement>;
  places: (index: number) => Ref<HTMLDivElement>;
  pings: (index: number) => Ref<HTMLDivElement>;
  exit: Ref<HTMLDivElement>; crystal: Ref<HTMLDivElement>; damage: Ref<HTMLDivElement>;
  landing: Ref<HTMLDivElement>; circle: Ref<HTMLDivElement>;
  /** Where whatever aims at the pilot sits: a lock or a missile (Y4c). */
  incoming: Ref<HTMLDivElement>;
  radar: Ref<HTMLCanvasElement>;
  /** The map's own arrow and altitude marker (moved by the client while the map is open). */
  mapSelf: Ref<SVGGElement>; mapAltitude: Ref<HTMLElement>;
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

/**
 * Hull, and the shield layer over it while the ship has one (owner 2026-10-21: separate
 * pools): its own line above the hull's and its own number, in the shield's colour.
 */
function HullGauge({ s, c }: { s: HudSnapshot; c: ArenaCopy }) {
  const share = s.hull / shipStats(s.ship, s.level).hull;
  const shielded = s.shieldMax > 0;
  return <div className={`ah-gauge ah-hull ${share < 0.3 ? 'is-alert' : ''} ${shielded ? 'has-shield' : ''}`}
    style={{ '--tone': share < 0.3 ? 'var(--color-v2-hostile)' : 'var(--color-v2-self)', '--fill': String(Math.max(0, Math.min(1, share))),
      '--shield': String(shielded ? Math.max(0, Math.min(1, s.shieldHp / s.shieldMax)) : 0) } as React.CSSProperties}>
    <span className="ah-gauge-icon" aria-hidden>{ICON.hull}</span>
    <span className="ah-gauge-label">{c.hull}</span>
    <strong>{String(Math.round(share * 100))}%{shielded && <small data-shield>
      <span className="ah-gauge-label">{c.shieldLayer}</span>{ICON.shield}{String(Math.ceil(s.shieldHp))}</small>}</strong>
    <i aria-hidden><b /></i>
    {shielded && <em aria-hidden><b /></em>}
  </div>;
}

/**
 * The hold: how much is aboard against the hold, as it would land in the capital (Y6a: one for
 * one); the bar splits it by kind, and under it each kind's own count in its colour (owner
 * 2026-10-27: the colours alone gave no numbers).
 */
function HoldGauge({ s, c }: { s: HudSnapshot; c: ArenaCopy }) {
  const hold = shipStats(s.ship, s.level).cargoCapacity;
  const full = s.cargo >= hold;
  const aboard = s.hold.flatMap((units, kind) => units >= 1 ? [`${String(Math.floor(units))} ${c.kinds[kind] ?? ''}`] : []);
  return <div className={`ah-gauge ah-hold ${full ? 'is-full' : ''}`} style={{ '--tone': 'var(--color-v2-ink)' } as React.CSSProperties}>
    <span className="ah-gauge-icon" aria-hidden>{ICON.cargo}</span>
    <span className="ah-gauge-label">{c.cargo} · {String(Math.floor(s.cargo))}/{String(hold)}</span>
    <strong aria-label={aboard.join(' · ') || undefined}>{Math.floor(s.cargo)}<small>/{hold}</small></strong>
    <i aria-hidden>{s.hold.map((units, kind) => units > 0 && <b key={kind}
      style={{ width: `${String(units / hold * 100)}%`, background: FARM_TONE[kind], boxShadow: `0 0 6px ${FARM_TONE[kind] ?? ''}` }} />)}</i>
    <span className="ah-hold-kinds">{FARM_TONE.map((tone, kind) => {
      const units = Math.floor(s.hold[kind] ?? 0);
      return <b key={kind} className={units < 1 ? 'is-empty' : undefined} style={{ '--tone': tone } as React.CSSProperties}
        aria-label={`${String(units)} ${c.kinds[kind] ?? ''}`}>{units}</b>;
    })}</span>
  </div>;
}

const ICON = {
  // Hull: a plated hexagon with a repair cross. The shield outline is the shield layer's alone.
  hull: <svg viewBox="0 0 16 16"><path d="M8 1.6 13.6 4.8v6.4L8 14.4 2.4 11.2V4.8z" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5.4v5.2M5.4 8h5.2" stroke="currentColor" strokeWidth="1.5" /></svg>,
  shield: <svg viewBox="0 0 16 16"><path d="M8 1.5 13.5 4v4.2c0 3-2.3 5.2-5.5 6.3C4.8 13.4 2.5 11.2 2.5 8.2V4z" fill="currentColor" /></svg>,
  fuel: <svg viewBox="0 0 16 16"><path d="M8 1.8c2.6 3.4 4.2 5.7 4.2 7.7A4.2 4.2 0 0 1 3.8 9.5c0-2 1.6-4.3 4.2-7.7z" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>,
  cargo: <svg viewBox="0 0 16 16"><path d="m8 1.5 5.6 3.2v6.6L8 14.5l-5.6-3.2V4.7zM2.6 4.8 8 8l5.4-3.2M8 8v6.3" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>,
};

/** One line that says what the pilot must know right now, and why. */
export function hudContext(s: HudSnapshot, c: ArenaCopy): { title: string; hint?: string; tone: 'self' | 'warn' | 'hostile' | 'crystal'; progress?: number } | null {
  if (s.clientPhase !== 'flight' || (s.phase !== 'flying' && s.phase !== 'fuelOut')) return null;
  const hold = shipStats(s.ship, s.level).cargoCapacity;
  if (s.linkLost > 0) return { title: c.link, hint: `${String(Math.ceil(s.linkLost))} s`, tone: 'hostile' };
  if (s.phase === 'fuelOut') return { title: c.rescue, hint: `${String(Math.ceil(s.rescue))} s`, tone: 'warn', progress: 1 - s.rescue / T.fuelOutRescueDelay };
  // Someone aiming at you outranks everything you are doing: it is the one line you can still act on in time.
  if (s.threat > 0) return { title: c.threats[s.threat] ?? '', hint: c.threatHints[s.threat] ?? '', tone: s.threat === 1 || s.threat === 4 ? 'warn' : 'hostile' };
  if (s.inExit) {
    if (s.extraction > 0) return { title: c.exitHold, hint: `${s.extraction.toFixed(1)} / ${String(T.exitHold)} s`, tone: 'self', progress: s.extraction / T.exitHold };
    if (s.damageRecent) return { title: c.exitBroken, tone: 'hostile' };
    return { title: c.exitZone, hint: c.exitStop, tone: 'self' };
  }
  if (s.landed) {
    const kind = c.kinds[s.depositKind];
    if (s.mining && kind) return { title: `${kind} · ${c.mining}`, hint: `${String(Math.floor(s.cargo))}/${String(hold)} · ${c.miningHint}`, tone: 'crystal', progress: s.cargo / hold };
    if (s.depositKind >= 0 && s.cargo >= hold) return { title: c.full, hint: c.fullHint, tone: 'warn' };
    if (s.depositKind >= 0 && s.dry) return { title: c.dry, hint: c.dryHint, tone: 'warn' };
    // F19: a rock with no vein is a landing, never a mine; say so, and what a mine looks like.
    if (s.landedOn === 'rock' && s.depositKind < 0) return { title: c.noOre, hint: c.noOreHint, tone: 'warn' };
    return { title: c.landed, hint: c.landedHint, tone: 'self' };
  }
  if (s.landing === 'approach') return { title: `${c.landingNote} · ${String(Math.round(s.landingDistance))} m`, hint: c.landingHint, tone: 'crystal' };
  if (s.cloak > 0) return { title: c.cloaked, hint: `${s.cloak.toFixed(1)} s · ${c.cloakedHint}`, tone: 'self', progress: s.cloak / T.cloakDuration };
  if (s.illusion > 0) return { title: `${c.illusion} · ${String(Math.ceil(s.illusion))} s`, hint: c.illusionHint, tone: 'self', progress: s.illusion / T.illusionDuration };
  if (s.scan > 0) return { title: `${c.radar} · ${String(Math.ceil(s.scan))} s`, hint: c.radarHint, tone: 'self', progress: s.scan / T.radarDuration };
  if (lowFuel(s.fuel, shipTuning(s.ship, s.level))) return { title: c.lowFuel, hint: `${clock(s.remaining)} · ${c.lowFuelHint}`, tone: 'hostile' };
  if (s.boundary < T.boundaryWarn) return { title: c.boundary, hint: `${String(Math.max(0, Math.round(s.boundary)))} m`, tone: 'warn' };
  if (s.inDust) return { title: c.dust, hint: `${c.dustSight} ${String(T.dustSight)} m · ${c.dustHint}`, tone: 'self' };
  // A full hold sends you to an exit, and the spawn shield is a countdown you plan around;
  // "you can land" is last because the LAND key and the touchdown ring already say it.
  if (s.cargo >= hold) return { title: c.full, hint: c.fullHint, tone: 'warn' };
  if (s.ammo < 1) return { title: c.noAmmo, hint: c.noAmmoHint, tone: 'warn' };
  if (s.ward > 0) return { title: `${c.signatures.muhafiz.name} · ${String(Math.ceil(s.ward))} s`, hint: c.wardHint, tone: 'self', progress: s.ward / T.wardDuration };
  if (s.mend > 0) return { title: `${c.signatures.kilavuz.name} · ${String(Math.ceil(s.mend))} s`, hint: c.mendHint, tone: 'self', progress: s.mend / T.mendDuration };
  if (s.shield > 0) return { title: `${c.shield} · ${String(Math.ceil(s.shield))} s`, hint: c.shieldHint, tone: 'self', progress: s.shield / T.spawnShield };
  if (s.canLand) return { title: c.approach, hint: c.approachHint, tone: 'crystal' };
  return null;
}

export function ArenaHud({ store, bind, layout, onMenu, connection }: { store: HudStore; bind: HudBind; layout: ArenaLayout; onMenu: () => void; connection: ReactNode }) {
  const s = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [map, setMap] = useState(false);
  const c = arenaCopy();
  const flight = s.clientPhase === 'flight';
  const note = hudContext(s, c);
  const hullShare = s.hull / shipStats(s.ship, s.level).hull;
  const low = lowFuel(s.fuel, shipTuning(s.ship, s.level));
  return <div className={`ah-root ${flight ? 'is-flight' : ''}`}>
    <div className="ah-top">
      <HullGauge s={s} c={c} />
      <Gauge icon={ICON.fuel} label={c.fuel} value={clock(s.remaining)} fill={s.fuel / shipStats(s.ship, s.level).fuelTank}
        tone={low ? 'var(--color-v2-hostile)' : 'var(--color-v2-deut)'} alert={low} />
      <HoldGauge s={s} c={c} />
      <button className="ah-menu" aria-label={c.settings} onClick={onMenu}>
        <svg viewBox="0 0 20 20" aria-hidden><path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
    </div>
    <div className="ah-instruments">
      <button type="button" className="ah-radar" aria-label={c.mapOpen} aria-expanded={map} onClick={() => { setMap(open => !open); }}>
        <canvas ref={bind.radar} width={132} height={132} aria-hidden />
        <span className="ah-radar-hint" aria-hidden><svg viewBox="0 0 10 8"><path d="M.5 1.5 3.5.5l3 1 3-1v6l-3 1-3-1-3 1z M3.5.5v6M6.5 1.5v6" fill="none" stroke="currentColor" strokeWidth=".9" /></svg></span>
      </button>
      <div className="ah-speed">
        <strong>{Math.round(s.speed)}</strong><small>{c.speed}</small>
        <em data-state={s.landed ? 'landed' : s.turboActive ? 'turbo' : s.speed === 0 ? 'stopped' : 'flying'}>
          {s.landed ? c.landedChip : s.turboActive ? c.turboChip : s.speed === 0 ? c.stopped : `${String(Math.round(s.throttle * 100))}%`}
        </em>
      </div>
    </div>
    {connection}
    {map && <MapSheet layout={layout} c={c} self={bind.mapSelf} altitude={bind.mapAltitude} friends={s.friends} onClose={() => { setMap(false); }} />}
    {note && <div className={`ah-note tone-${note.tone}`} role="status">
      <strong>{note.title}</strong>{note.hint && <span>{note.hint}</span>}
      {note.progress !== undefined && <i><b style={{ transform: `scaleX(${String(Math.max(0, Math.min(1, note.progress)))})` }} /></i>}
    </div>}
    <HudMarks bind={bind} layout={layout} c={c} />
    <div className={`ah-vignette ${s.damageRecent ? 'is-hit' : ''} ${hullShare < 0.3 && flight ? 'is-critical' : ''}`} aria-hidden />
  </div>;
}

/**
 * The markers the client moves by hand every frame (reticle, enemies, threats, landmarks, pings):
 * built once. Rebuilt at the HUD's ten updates a second, they cost most of an S22 frame (V6g).
 */
const HudMarks = memo(function HudMarks({ bind, layout, c }: { bind: HudBind; layout: ArenaLayout; c: ArenaCopy }) {
  return <div className="ah-marks" aria-hidden>
    <div ref={bind.circle} className="ah-circle"><svg viewBox="0 0 100 100">
      <path d="M10.68 22.47A48 48 0 0 0 10.68 77.53M89.32 22.47A48 48 0 0 1 89.32 77.53" />
      <path className="ah-circle-tick" d="M2 50h6M92 50h6" />
    </svg></div>
    <div ref={bind.reticle} className="ah-reticle"><i /><b /></div>
    <div ref={bind.hit} className="ah-hit"><i /><i /><i /><i /></div>
    <div ref={bind.kill} className="ah-kill"><i /><span>{c.destroyed}</span></div>
    <div ref={bind.lead} className="ah-lead" />
    {Array.from({ length: ENEMY_MARKS }, (_, i) => <div key={i} ref={bind.enemies(i)} className="ah-enemy">
      <i /><i /><i /><i /><span><em data-name /> <b data-distance /></span><u><b data-hull /></u>
    </div>)}
    {Array.from({ length: 8 }, (_, i) => <div key={i} ref={bind.threats(i)} className="ah-threat" />)}
    {placesOf(layout).map((place, i) => <div key={i} ref={bind.places(i)} className="ah-place"><i /><span>{c.landmarks[place.kind]} <b data-distance /></span></div>)}
    {Array.from({ length: 3 }, (_, i) => <div key={i} ref={bind.pings(i)} className="ah-ping"><i>{PING_KINDS.map(kind => <b key={kind} className={`is-${kind}`}>{PING_ICONS[kind]}</b>)}</i>
      <span><em data-kind /> <b data-distance /></span></div>)}
    <div ref={bind.exit} className="ah-exit"><i /><span>{c.exit} <b data-distance /><em data-points /></span></div>
    <div ref={bind.landing} className="ah-landing"><i /></div>
    <div ref={bind.crystal} className="ah-crystal"><i /><span><em data-kind>{c.crystal}</em> <b data-distance /></span></div>
    <div ref={bind.incoming} className="ah-incoming"><i /></div>
    <div ref={bind.damage} className="ah-damage"><svg viewBox="0 0 120 120"><path d="M30 18a52 52 0 0 1 60 0" /></svg></div>
  </div>;
});
