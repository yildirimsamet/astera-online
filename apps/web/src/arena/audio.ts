import { ARENA_TUNING as T, type ArenaWorld, type Pilot, type Vec3 } from '@astera/rules/arena';

interface Loop { source: AudioBufferSourceNode; gain: GainNode }
interface Listener { x: number; y: number; z: number; rx: number; ry: number; rz: number }

/**
 * Arena sound: layered engine loops, positional enemy fire and explosions, and a
 * distinct voice for "you fired", "you hit", "you were hit" and "you killed" (S58, S69).
 * Every event is derived from state changes, so prediction rewinds never replay one.
 */
export function createArenaAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let sfx: GainNode | null = null;
  let music: HTMLAudioElement | null = null;
  let raw = new Map<string, ArrayBuffer[]>();
  let tracks: string[] = [];
  const buffers = new Map<string, AudioBuffer[]>();
  const loops = new Map<string, Loop>();
  const shotsSeen = new Map<number, number>();
  const flybys = new Map<number, number>();
  const explosionSeen = new Float64Array(48 * 4).fill(-1);
  const listener: Listener = { x: 0, y: 0, z: 0, rx: 1, ry: 0, rz: 0 };
  const last = { shots: 0, hits: 0, kills: 0, damage: -100000, cargo: 0, turbo: false, cloak: 0, smokeReady: true,
    cloakReady: true, landed: 0, extraction: 0, phase: 'flying', warnAt: 0, lockAt: 0, mining: false, bumpAt: 0, critical: false };
  let round = 0;

  /** `cut`: hard stop (seconds, short fade) for a sample longer than the moment it marks. */
  const play = (id: string, volume: number, options: { pan?: number; rate?: number; lowpass?: number; variant?: number; cut?: number } = {}): void => {
    const list = buffers.get(id);
    if (!context || !sfx || !list || list.length === 0) return;
    const buffer = list[(options.variant ?? round++) % list.length];
    if (!buffer) return;
    const node = context.createBufferSource(); const gain = context.createGain();
    const pan = context.createStereoPanner(); const filter = context.createBiquadFilter();
    node.buffer = buffer; node.playbackRate.value = options.rate ?? 1;
    gain.gain.value = volume; pan.pan.value = options.pan ?? 0;
    filter.type = 'lowpass'; filter.frequency.value = options.lowpass ?? 20000;
    node.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(sfx);
    node.onended = () => { node.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect(); };
    node.start();
    if (options.cut !== undefined) {
      const end = context.currentTime + options.cut;
      gain.gain.setValueAtTime(volume, end - 0.08); gain.gain.linearRampToValueAtTime(0, end); node.stop(end + 0.01);
    }
  };
  const at = (p: Vec3, id: string, volume: number, reach: number, rate = 1): void => {
    const dx = p.x - listener.x; const dy = p.y - listener.y; const dz = p.z - listener.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > reach) return;
    const near = 1 - distance / reach;
    const pan = distance > 1 ? Math.max(-0.9, Math.min(0.9, (dx * listener.rx + dy * listener.ry + dz * listener.rz) / distance)) : 0;
    play(id, volume * near * near, { pan, rate, lowpass: 900 + near * near * 19000 });
  };
  const loop = (id: string): Loop | null => {
    const existing = loops.get(id);
    if (existing) return existing;
    const buffer = buffers.get(id)?.[0];
    if (!context || !master || !buffer) return null;
    const source = context.createBufferSource(); const gain = context.createGain();
    source.buffer = buffer; source.loop = true; gain.gain.value = 0;
    source.connect(gain); gain.connect(master); source.start();
    const created = { source, gain }; loops.set(id, created);
    return created;
  };
  const level = (id: string, value: number, rate?: number, time = 0.12): void => {
    const node = loop(id);
    if (!node || !context) return;
    node.gain.gain.setTargetAtTime(value, context.currentTime, time);
    if (rate !== undefined) node.source.playbackRate.setTargetAtTime(rate, context.currentTime, 0.25);
  };

  const audio = {
    enabled: true,
    get loadedSamples(): number { return buffers.size; },
    setSources(sounds: ReadonlyMap<string, ArrayBuffer[]>, music: readonly string[]): void { raw = new Map(sounds); tracks = [...music]; },
    unlock(): void {
      if (!context && typeof window.AudioContext === 'function') {
        context = new window.AudioContext();
        master = context.createGain(); master.gain.value = 0.85;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -10; limiter.ratio.value = 6; limiter.attack.value = 0.002; limiter.release.value = 0.18;
        sfx = context.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
        master.connect(limiter); limiter.connect(context.destination);
        const active = context;
        for (const [id, list] of raw) {
          void Promise.all(list.map(data => active.decodeAudioData(data.slice(0)).catch(() => null))).then(decoded => {
            const ok = decoded.filter((buffer): buffer is AudioBuffer => buffer !== null);
            if (ok.length > 0 && context === active) buffers.set(id, ok);
          });
        }
        if (tracks[0]) { music = new Audio(tracks[0]); music.loop = true; music.volume = 0.22; }
      }
      if (context) void context.resume().catch(() => undefined);
      if (music && audio.enabled) void music.play().catch(() => undefined);
    },
    silence(): void { if (context && master) master.gain.setTargetAtTime(0, context.currentTime, 0.03); music?.pause(); },
    ui(confirm = false): void { play(confirm ? 'uiConfirm' : 'uiClick', 0.5); },
    lock(): void {
      const now = performance.now();
      if (now - last.lockAt > 900) { last.lockAt = now; play('lock', 0.28); }
    },
    /** Places the listener at the camera, facing its right vector. */
    listen(x: number, y: number, z: number, rx: number, ry: number, rz: number): void {
      listener.x = x; listener.y = y; listener.z = z; listener.rx = rx; listener.ry = ry; listener.rz = rz;
    },
    update(world: ArenaWorld, running: boolean): void {
      if (!context || !master) return;
      const on = audio.enabled && running && !document.hidden;
      master.gain.setTargetAtTime(on ? 0.85 : 0, context.currentTime, 0.08);
      if (music) { if (on && music.paused) void music.play().catch(() => undefined); if (!on && !music.paused) music.pause(); }
      const pilot = world.pilot;
      const flying = pilot.phase === 'flying' || pilot.phase === 'fuelOut';
      const thrust = flying && !pilot.landed ? pilot.throttle : 0;
      level('ambience', on ? 0.22 : 0, undefined, 0.5);
      level('engine', flying ? 0.28 + thrust * 0.35 : 0, 0.75 + thrust * 0.45 + (pilot.turboActive ? 0.25 : 0));
      level('thrust', flying ? thrust * 0.32 + (pilot.turboActive ? 0.25 : 0) : 0, 0.85 + thrust * 0.3);
      level('turboLoop', pilot.turboActive ? 0.55 : 0, 1, 0.06);
      level('mining', pilot.mining ? 0.35 : 0, 1.6, 0.2);
      if (world.shots > last.shots) play('fireOwn', 0.42, { rate: 0.94 + Math.random() * 0.12 });
      if (pilot.hits > last.hits) { play('hitConfirm', 0.75); play('hitMetal', 0.35, { rate: 1.1 }); if (typeof navigator.vibrate === 'function' && audio.enabled) navigator.vibrate(10); }
      if (pilot.kills > last.kills) play('kill', 0.9);
      if (pilot.lastDamage > last.damage) {
        play('damage', 0.85, { rate: 0.9 + Math.random() * 0.15, cut: 0.6 });
        if (typeof navigator.vibrate === 'function' && audio.enabled) navigator.vibrate([18, 24, 12]);
      }
      // Crossing into critical hull warns once; it re-arms only after a repair or respawn.
      const critical = flying && pilot.hull < T.hull * 0.3;
      if (critical && !last.critical) play('warn', 0.45, { cut: 0.9 });
      last.critical = critical;
      if (pilot.cargo > last.cargo + 0.9 && !pilot.mining) play('cargo', 0.5);
      if (pilot.turboActive && !last.turbo) { play('turboStart', 0.7); play('whoosh', 0.45); }
      if (pilot.smokeCooldown > 0 && last.smokeReady) play('smoke', 0.7);
      if (pilot.cloak > 0 && last.cloak === 0) play('cloakOn', 0.6);
      if (pilot.cloak === 0 && last.cloak > 1) play('cloakBreak', 0.5);
      if ((pilot.smokeCooldown === 0 && !last.smokeReady) || (pilot.cloakCooldown === 0 && !last.cloakReady)) play('abilityReady', 0.35);
      if (pilot.landed && !last.landed) play('land', 0.7);
      // One knock per real impact; a graze stays silent (no rattling on a scrape).
      if (pilot.bump > 0.3 && performance.now() - last.bumpAt > 450) { last.bumpAt = performance.now(); play('bump', 0.35 + pilot.bump * 0.55, { rate: 0.9 + (1 - pilot.bump) * 0.3, cut: 0.8 }); }
      if (pilot.extraction > 0 && Math.floor(pilot.extraction / T.tickRate) > Math.floor(last.extraction / T.tickRate)) play('tick', 0.55);
      if (pilot.phase === 'extracted' && last.phase !== 'extracted') play('warp', 0.9);
      if (pilot.phase === 'dead' && last.phase !== 'dead') { play('shipExplode', 1); play('explosionNear', 0.8); }
      // Low fuel: once on the way down, then a reminder every 20 s (the HUD carries the count).
      if (flying && pilot.fuel < 15 && performance.now() - last.warnAt > 20000) { last.warnAt = performance.now(); play('warn', 0.4, { cut: 0.9 }); }
      if (pilot.fuel >= 15) last.warnAt = 0;
      for (const drone of world.drones) {
        const seen = shotsSeen.get(drone.id);
        if (seen !== undefined && drone.shots > seen) at(drone.p, 'fireOther', 0.55, 1100, 0.95 + Math.random() * 0.1);
        shotsSeen.set(drone.id, drone.shots);
        flyby(drone);
      }
      world.impacts.forEach((hit, i) => {
        if (!hit.active || hit.kind !== 'explosion') return;
        const k = i * 4;
        const fresh = explosionSeen[k] !== hit.p.x || explosionSeen[k + 1] !== hit.p.y || explosionSeen[k + 2] !== hit.p.z;
        explosionSeen[k] = hit.p.x; explosionSeen[k + 1] = hit.p.y; explosionSeen[k + 2] = hit.p.z;
        if (!fresh || hit.age > 0.3) return;
        const dx = hit.p.x - listener.x; const dy = hit.p.y - listener.y; const dz = hit.p.z - listener.z;
        at(hit.p, Math.sqrt(dx * dx + dy * dy + dz * dz) < 450 ? 'explosionNear' : 'explosionFar', 1, 2600);
      });
      last.shots = world.shots; last.hits = pilot.hits; last.kills = pilot.kills; last.damage = pilot.lastDamage;
      last.cargo = pilot.cargo; last.turbo = pilot.turboActive; last.cloak = pilot.cloak; last.landed = pilot.landed;
      last.smokeReady = pilot.smokeCooldown === 0; last.cloakReady = pilot.cloakCooldown === 0;
      last.extraction = pilot.extraction; last.phase = pilot.phase; last.mining = pilot.mining;

      function flyby(drone: Pilot): void {
        const dx = drone.p.x - pilot.p.x; const dy = drone.p.y - pilot.p.y; const dz = drone.p.z - pilot.p.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const now = performance.now();
        if (distance < 70 && drone.s > 60 && now - (flybys.get(drone.id) ?? 0) > 2500) { flybys.set(drone.id, now); at(drone.p, 'flyby', 0.8, 300); }
      }
    },
    dispose(): void {
      for (const node of loops.values()) { node.source.stop(); node.source.disconnect(); node.gain.disconnect(); }
      loops.clear(); buffers.clear(); music?.pause(); music = null;
      if (context) void context.close().catch(() => undefined);
      context = null; master = null; sfx = null;
    },
  };
  return audio;
}
export type ArenaAudio = ReturnType<typeof createArenaAudio>;
