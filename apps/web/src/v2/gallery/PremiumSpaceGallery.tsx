/** Read-only art review using the live game's renderer. This module is gallery-only. */
import { useEffect, useMemo, useState } from 'react';
import { MONUMENT_BALANCE, MONUMENT_SEASON_DEFAULTS, monumentDifficulty } from '@astera/rules';
import type { GalaxyPlanet, AsteroidView, PendingThread, PublicMonument, MiningRun } from '../../api/schemas.js';
import { GalaxyCanvas } from '../../galaxy/GalaxyCanvas.js';
import type { Focus } from '../../galaxy/FocusPanel.js';
import { serverNow } from '../../lib/clock.js';
import { playSound, type SoundCue } from '../../lib/sound.js';
import { RENDER_QUALITIES, setRenderQuality, useRenderQuality } from '../../lib/quality.js';
import type { WreckView } from '../../galaxy/Wrecks.js';
import { monumentName } from '../../i18n/names.js';

const HOME = { x: 0, y: 0, z: 0 };
const TARGET = { x: 180, y: 10, z: 95 };
const ROCK_ID = 'premium_isotope_rock01';
const MONUMENT_ORDINALS = Array.from({ length: MONUMENT_SEASON_DEFAULTS.count }, (_, index) => index + 1);
const WRECKS: WreckView[] = [{ id: 'premium-wreck', planetId: 'p-1', at: HOME, alloy: 5000, crystal: 1800, minutesLeft: 18 }];
const SOUND_CUES: readonly SoundCue[] = ['tap', 'confirm', 'alert', 'launch', 'cargo', 'weapon', 'shield', 'impact', 'strategic', 'mining'];

export function PremiumSpaceGallery() {
  const [focus, setFocus] = useState<Focus | null>({ kind: 'planet', id: 'p-1' });
  const [homeSignal, setHomeSignal] = useState(0);
  const [inspectionPlanetId, setInspectionPlanetId] = useState('p-1');
  const [cosmetic, setCosmetic] = useState(false);
  const [monumentOrdinal, setMonumentOrdinal] = useState(2);
  const [sample, setSample] = useState(() => ({ at: serverNow(), mode: 'fleet' }));
  const [miningConfirmation, setMiningConfirmation] = useState<number | null>(null);
  useEffect(() => {
    if (sample.mode !== 'mining') return;
    // Exercise the real outbound → confirmed return path, including worker/refetch delay.
    const timer = setTimeout(() => { setMiningConfirmation(sample.at); }, 2500);
    return () => { clearTimeout(timer); };
  }, [sample]);
  const [seasonStart] = useState(() => new Date(serverNow()));
  const [ready, setReady] = useState(false);
  const quality = useRenderQuality();
  const monuments = useMemo<PublicMonument[]>(() => {
    const difficulty = monumentDifficulty(monumentOrdinal);
    const balance = MONUMENT_BALANCE[difficulty];
    return [{ id: 'premium-monument', ordinal: monumentOrdinal, position: { x: -280, y: 10, z: 130 }, difficulty,
      controller: { kind: 'NEUTRAL' }, capacity: balance.capacity, used: 0, productionPerMinute: balance.productionPerMinute,
      radiationHpPerMinute: balance.intensityHpPerMinute, emptySince: null, respawnAt: null }];
  }, [monumentOrdinal]);
  const planets = useMemo<GalaxyPlanet[]>(() => [
    { id: 'p-1', name: 'Kestrel', owner: 'Astera', isSelf: true, isOwned: true, position: HOME, coreTier: 2, coreLevel: 6,
      satellites: ['FOUNDRY', 'DERRICK'], shielded: true, intel: 'RESOLVED', state: { kind: 'NORMAL' },
      ...(cosmetic ? { skin: { id: 'planet-lava', status: 'NORMAL' as const } } : {}) },
    { id: 'p-2', name: 'Tharsis', owner: 'Sable', isSelf: false, position: TARGET, coreTier: 2, coreLevel: 4,
      satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' } },
    ...Array.from({ length: 10 }, (_, i): GalaxyPlanet => ({
      id: `premium-world-${i}`, name: `Aster-${i + 1}`, owner: '', isSelf: false,
      position: { x: Math.cos(i * 2.4) * (650 + i * 70), y: (i % 3 - 1) * 150, z: Math.sin(i * 2.4) * (650 + i * 70) },
      coreTier: 1, coreLevel: 0, satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' },
    })),
  ], [cosmetic]);
  const rocks = useMemo<AsteroidView[]>(() => Array.from({ length: 8 }, (_, i) => ({
    id: i === 0 ? ROCK_ID : `premium_asteroid_${String(i).padStart(5, '0')}`,
    level: 3, ore: 2000, oreRemaining: 2000, crystalShare: 0.2, deuteriumShare: i === 0 ? 0.1 : null,
    radius: 400 + i * 65, period: 24, phase: i * 0.65, inclination: 0.07, ascendingNode: i * 0.18,
    speed: 1, appearsAt: 0, expiresAt: 100000, active: true, isotopeRich: i === 0,
  })), []);
  const pending = useMemo<PendingThread[]>(() => {
    const fleet: PendingThread = { id: 'premium-flight', kind: 'fleet', targetName: 'Tharsis', targetPlanetId: 'p-2',
      arriveAt: new Date(sample.at + 90_000), minutesRemaining: 1.5, leg: 'outbound',
      fleet: { DART: 5, VIPER: 5, TALON: 5, RAMPART: 5, STRONGHOLD: 5, LEVIATHAN: 5 },
      path: { from: HOME, to: TARGET, departAt: new Date(sample.at - 35_000), arriveAt: new Date(sample.at + 90_000) } };
    if (sample.mode === 'battle') return [fleet, { ...fleet, id: `premium-battle-${sample.at}`, fleet: { TALON: 10, BALLISTA: 5 },
      arriveAt: new Date(sample.at + 1800), path: { from: HOME, to: TARGET, departAt: new Date(sample.at - 60_000), arriveAt: new Date(sample.at + 1800) } }];
    if (sample.mode === 'strategic') return [fleet, { ...fleet, id: `premium-strategic-${sample.at}`, kind: 'death_star', fleet: {},
      arriveAt: new Date(sample.at + 1800), path: { from: HOME, to: TARGET, departAt: new Date(sample.at - 60_000), arriveAt: new Date(sample.at + 1800) } }];
    return [fleet];
  }, [sample]);
  const runs = useMemo<MiningRun[]>(() => sample.mode === 'mining' ? [{
    id: `premium-mining-${sample.at}`, planetId: 'p-1', targetKind: 'debris', asteroidId: null, debrisFieldId: 'premium-wreck',
    status: miningConfirmation === sample.at ? 'returning' : 'outbound', craft: 2, departAt: new Date(sample.at - 60_000), arriveAt: new Date(sample.at),
    homeAt: new Date(sample.at + 40_000), intercept: HOME, minedAlloy: miningConfirmation === sample.at ? 250 : 0,
    minedCrystal: miningConfirmation === sample.at ? 50 : 0, minedDeuterium: 0,
  }] : [], [sample, miningConfirmation]);
  const replay = (mode: string) => {
    setSample({ at: serverNow(), mode });
    setFocus(mode === 'mining' ? { kind: 'debris', id: 'premium-wreck' } : { kind: 'planet', id: 'p-2' });
    setInspectionPlanetId(mode === 'mining' ? 'p-1' : 'p-2');
  };
  const button = 'rounded-control border border-v2-line bg-v2-panel px-2 py-1.5 text-micro text-v2-ink-2 hover:border-v2-line-hi';
  return (
    <main className="flex h-dvh flex-col bg-v2-void text-v2-ink" data-premium-review>
      <header className="space-y-2 border-b border-v2-line p-3">
        <p className="text-caption font-semibold">Astera · görsel inceleme</p>
        <p className="text-micro text-v2-ink-3">Örnek veriler · gerçek oyun renderer’ı · sunucuya işlem gönderilmez.</p>
        <nav className="flex flex-wrap gap-1">
          <a className={button} href="?view=base-production&lng=tr">Üs ve üretim</a>
          <a className={button} href="?view=base-research&lng=tr">Araştırma</a>
          <a className={button} href="?view=menu&lng=tr">Ses ayarları</a>
        </nav>
        <div className="flex flex-wrap gap-1">
          <button className={button} onClick={() => { setFocus({ kind: 'planet', id: 'p-1' }); setInspectionPlanetId('p-1'); setHomeSignal((n) => n + 1); }}>Gezegen</button>
          <button className={button} aria-pressed={cosmetic} onClick={() => { setCosmetic(!cosmetic); }}>Lav kozmetiği</button>
          <button className={button} onClick={() => { setFocus({ kind: 'debris', id: 'premium-wreck' }); }}>Metal enkaz</button>
          <button className={button} onClick={() => { setFocus({ kind: 'asteroid', id: ROCK_ID }); }}>İzotop asteroidi</button>
          <button className={button} onClick={() => { setFocus({ kind: 'thread', key: 'premium-flight' }); }}>Filo</button>
          <button className={button} onClick={() => { setFocus({ kind: 'monument', id: 'premium-monument' }); }}>Anıt</button>
          <button className={button} onClick={() => { replay('battle'); }}>Savaş</button>
          <button className={button} onClick={() => { replay('strategic'); }}>Stratejik çarpma</button>
          <button className={button} onClick={() => { replay('mining'); }}>Madencilik</button>
          <select className={`${button} text-caption!`} value={quality} aria-label="Görüntü kalitesi"
            onChange={(event) => { const next = RENDER_QUALITIES.find((value) => value === event.target.value); if (next) setRenderQuality(next); }}>
            {RENDER_QUALITIES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <label className="flex min-w-0 items-center gap-2 text-micro text-v2-ink-3">
          Anıt modeli
          <select className={`${button} min-w-0 flex-1 text-caption!`} value={monumentOrdinal}
            onChange={(event) => {
              const ordinal = MONUMENT_ORDINALS.find(value => String(value) === event.target.value);
              if (ordinal === undefined) return;
              setMonumentOrdinal(ordinal);
              setFocus({ kind: 'monument', id: 'premium-monument' });
            }}>
            {MONUMENT_ORDINALS.map(ordinal => <option key={ordinal} value={ordinal}>
              {monumentName(ordinal)} · {monumentDifficulty(ordinal) === 'HARD' ? 'Zor' : 'Kolay'}
            </option>)}
          </select>
        </label>
      </header>
      <div className="relative min-h-0 flex-1" data-premium-scene-ready={ready ? 'true' : 'false'}>
        <GalaxyCanvas planets={planets} pending={pending} contacts={[]} asteroids={rocks} runs={runs} wrecks={WRECKS}
          monuments={monuments} homePosition={HOME} activePlanetId="p-1" aegisLevel={2} seasonStart={seasonStart}
          focus={focus} onFocus={setFocus} homeSignal={homeSignal} inspectionPlanetId={inspectionPlanetId}
          onReady={() => { setReady(true); }} />
      </div>
      <footer className="flex flex-wrap gap-1 border-t border-v2-line p-2" aria-label="Ses örnekleri">
        {SOUND_CUES.map((cue) => <button key={cue} className={button} onClick={() => { playSound(cue); }}>{cue}</button>)}
      </footer>
    </main>
  );
}
