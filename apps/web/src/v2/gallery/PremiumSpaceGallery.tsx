/** Read-only, isolated art review using the live game's components. Gallery only. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MONUMENT_BALANCE, MONUMENT_SEASON_DEFAULTS, monumentDifficulty, cosmeticsInCategory, MOBILE_HULLS, SHIP_SKIN_IDS } from '@astera/rules';
import type { GalaxyPlanet, AsteroidView, PendingThread, PublicMonument, MiningRun } from '../../api/schemas.js';
import { GalaxyCanvas } from '../../galaxy/GalaxyCanvas.js';
import type { Focus } from '../../galaxy/FocusPanel.js';
import { serverNow } from '../../lib/clock.js';
import { playSound, type SoundCue } from '../../lib/sound.js';
import { RENDER_QUALITIES, setRenderQuality, useRenderQuality } from '../../lib/quality.js';
import type { WreckView } from '../../galaxy/Wrecks.js';
import { monumentName } from '../../i18n/names.js';
import { PremiumShipInspector, INSPECTION_CRAFT, INSPECTION_ANGLES, type InspectionCraft, type InspectionAngle } from '../../galaxy/PremiumShipInspector.js';
import { cosmeticCopy } from '../../ui/cosmeticCopy.js';

const HOME = { x: -750, y: 0, z: -350 };
const TARGET = { x: 1200, y: 0, z: 900 };
const ROCK_ID = 'premium_isotope_rock01';
const ASTEROID_OPTIONS = [
  { id: 'isotope', label: 'İzotop · GD Crystal', rockId: ROCK_ID, isotopeRich: true },
  { id: '0', label: 'GD Atria · parçalı kaya', rockId: 'premium_asteroid_model_3', isotopeRich: false },
  { id: '1', label: 'GD Stone · metal asteroidi', rockId: 'premium_asteroid_model_0', isotopeRich: false },
  { id: '2', label: 'GD Atria · büyük gövde', rockId: 'premium_asteroid_model_1', isotopeRich: false },
] as const;
const DYSON_LEVELS = [6, 12, 15, 18, 24] as const;
const MONUMENT_ORDINALS = Array.from({ length: MONUMENT_SEASON_DEFAULTS.count }, (_, index) => index + 1);
const WRECKS: WreckView[] = [{ id: 'premium-wreck', planetId: null, at: TARGET, alloy: 5000, crystal: 1800, minutesLeft: 18 }];
const SOUND_CUES: readonly SoundCue[] = ['tap', 'confirm', 'alert', 'launch', 'cargo', 'weapon', 'shield', 'impact', 'strategic', 'mining'];
const ENGINE_OPTIONS = cosmeticsInCategory('ENGINE');
const SCENES = [
  ['ship', 'Gemi inceleme'], ['planet', 'Gezegen'], ['wreck', 'Enkaz'], ['asteroid', 'İzotop asteroidi'],
  ['fleet', 'Filo'], ['monument', 'Anıt'], ['battle', 'Savaş'], ['strategic', 'Stratejik çarpma'],
  ['mining', 'Madencilik'], ['probe-flight', 'Probe uçuşu'], ['strategic-flight', 'Ölüm Yıldızı uçuşu'],
] as const;
type Mode = typeof SCENES[number][0];
const queryValue = (name: string): string | null => new URLSearchParams(window.location.search).get(name);
const initialMode = (): Mode => SCENES.find(([mode]) => mode === queryValue('scene'))?.[0] ?? 'ship';
const initialRock = () => ASTEROID_OPTIONS.find(item => item.id === queryValue('asteroid')) ?? ASTEROID_OPTIONS[0];
function saveSelection(selection: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(selection)) url.searchParams.set(name, value);
  window.history.replaceState(null, '', url);
}
function sceneFocus(mode: Mode, serial: number, rockId: string): Focus | null {
  return mode === 'planet' ? { kind: 'planet', id: 'p-1' }
    : mode === 'monument' ? { kind: 'monument', id: 'premium-monument' }
    : mode === 'wreck' || mode === 'mining' ? { kind: 'debris', id: 'premium-wreck' }
    : mode === 'asteroid' ? { kind: 'asteroid', id: rockId }
    : mode === 'battle' || mode === 'strategic' ? { kind: 'planet', id: 'p-2' }
    : mode === 'ship' ? null : { kind: 'thread', key: `premium-${mode}-${String(serial)}` };
}

export function PremiumSpaceGallery() {
  const { t } = useTranslation();
  const [focus, setFocus] = useState<Focus | null>(() => sceneFocus(initialMode(), 0, initialRock().rockId));
  const [centerSignal, setCenterSignal] = useState(0);
  const [cosmetic, setCosmetic] = useState(false);
  const [coreLevel, setCoreLevel] = useState<number>(() => DYSON_LEVELS.find(level => String(level) === queryValue('dyson')) ?? 6);
  const [monumentOrdinal, setMonumentOrdinal] = useState(() => MONUMENT_ORDINALS.find(ordinal => String(ordinal) === queryValue('monument')) ?? 2);
  const [craft, setCraft] = useState<InspectionCraft>(() => INSPECTION_CRAFT.find(item => item.id === queryValue('craft'))?.id ?? 'DART');
  const [angle, setAngle] = useState<InspectionAngle>(() => INSPECTION_ANGLES.find(item => item.id === queryValue('angle'))?.id ?? 'quarter');
  const [engines, setEngines] = useState(() => queryValue('engines') !== 'off');
  const [engineId, setEngineId] = useState(() => ENGINE_OPTIONS.find(item => item.id === queryValue('engine'))?.id ?? 'native');
  const [rockChoice, setRockChoice] = useState<typeof ASTEROID_OPTIONS[number]>(initialRock);
  const [sample, setSample] = useState<{ at: number; mode: Mode; serial: number }>(() => ({ at: serverNow(), mode: initialMode(), serial: 0 }));
  const [miningConfirmation, setMiningConfirmation] = useState<number | null>(null);
  const [seasonStart] = useState(() => new Date(serverNow()));
  const [ready, setReady] = useState(false);
  const quality = useRenderQuality();
  const markReady = useCallback(() => { setReady(true); }, []);
  useEffect(() => {
    if (sample.mode !== 'mining') return;
    const timer = setTimeout(() => { setMiningConfirmation(sample.serial); }, 2500);
    return () => { clearTimeout(timer); };
  }, [sample]);
  const monuments = useMemo<PublicMonument[]>(() => {
    if (sample.mode !== 'monument') return [];
    const difficulty = monumentDifficulty(monumentOrdinal);
    const balance = MONUMENT_BALANCE[difficulty];
    return [{ id: 'premium-monument', ordinal: monumentOrdinal, position: TARGET, difficulty,
      controller: { kind: 'NEUTRAL' }, capacity: balance.capacity, used: 0, productionPerMinute: balance.productionPerMinute,
      radiationHpPerMinute: balance.intensityHpPerMinute, emptySince: null, respawnAt: null }];
  }, [monumentOrdinal, sample.mode]);
  const planets = useMemo<GalaxyPlanet[]>(() => {
    if (sample.mode === 'planet') return [{
      id: 'p-1', name: 'Kestrel', owner: 'Astera', isSelf: true, isOwned: true, position: TARGET,
      coreTier: coreLevel >= 24 ? 5 : coreLevel >= 18 ? 4 : coreLevel >= 12 ? 3 : 2, coreLevel,
      satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' },
      ...(cosmetic ? { skin: { id: 'planet-lava', status: 'NORMAL' as const } } : {}),
    }];
    if (sample.mode === 'battle' || sample.mode === 'strategic') return [{
      id: 'p-2', name: 'Tharsis', owner: 'Sable', isSelf: false, position: TARGET, coreTier: 2, coreLevel: 4,
      satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' },
    }];
    return [];
  }, [cosmetic, coreLevel, sample.mode]);
  const rocks = useMemo<AsteroidView[]>(() => sample.mode === 'asteroid' ? [{
    id: rockChoice.rockId, level: 5, ore: 2000, oreRemaining: 2000, crystalShare: 0.2, deuteriumShare: rockChoice.isotopeRich ? 0.1 : null,
    radius: 400, period: 240, phase: 0, inclination: 0.07, ascendingNode: 0,
    speed: 1, appearsAt: 0, expiresAt: 100000, active: true, isotopeRich: rockChoice.isotopeRich,
  }] : [], [sample.mode, rockChoice]);
  const pending = useMemo<PendingThread[]>(() => {
    if (!['fleet', 'battle', 'strategic', 'probe-flight', 'strategic-flight'].includes(sample.mode)) return [];
    const impact = sample.mode === 'battle' || sample.mode === 'strategic';
    const arriveAt = new Date(sample.at + (impact ? 1800 : 90_000));
    const thread: PendingThread = {
      id: `premium-${sample.mode}-${String(sample.serial)}`,
      kind: sample.mode === 'probe-flight' ? 'probe' : sample.mode.startsWith('strategic') ? 'death_star' : 'fleet',
      targetName: 'Tharsis', targetPlanetId: 'p-2', arriveAt, minutesRemaining: 1.5, leg: 'outbound',
      fleet: sample.mode === 'fleet' ? { DART: 1, COURIER: 1, TALON: 1, SENTINEL: 1, LEVIATHAN: 1 }
        : sample.mode === 'battle' ? { TALON: 1, BALLISTA: 1 } : {},
      path: { from: HOME, to: TARGET, departAt: new Date(sample.at - (impact ? 60_000 : 90_000)), arriveAt },
    };
    return [thread];
  }, [sample]);
  const runs = useMemo<MiningRun[]>(() => sample.mode === 'mining' ? [{
    id: `premium-mining-${String(sample.serial)}`, planetId: 'p-1', targetKind: 'debris', asteroidId: null, debrisFieldId: 'premium-wreck',
    status: miningConfirmation === sample.serial ? 'returning' : 'outbound', craft: 1,
    departAt: new Date(sample.at - 60_000), arriveAt: new Date(sample.at), homeAt: new Date(sample.at + 40_000), intercept: TARGET,
    minedAlloy: miningConfirmation === sample.serial ? 250 : 0, minedCrystal: miningConfirmation === sample.serial ? 50 : 0, minedDeuterium: 0,
  }] : [], [sample, miningConfirmation]);
  const replay = (mode: Mode, rockId: string = rockChoice.rockId) => {
    const serial = sample.serial + 1;
    setSample({ at: serverNow(), mode, serial });
    if (mode !== sample.mode) {
      setReady(false);
      setCenterSignal(signal => signal + 1);
    }
    setFocus(sceneFocus(mode, serial, rockId));
    saveSelection({ scene: mode });
  };
  const button = 'rounded-control border border-v2-line bg-v2-panel px-2 py-1.5 text-caption text-v2-ink-2 hover:border-v2-line-hi aria-pressed:border-v2-line-hi aria-pressed:text-v2-ink';
  const sceneLabel = sample.mode === 'asteroid' ? rockChoice.label : SCENES.find(([mode]) => mode === sample.mode)?.[1];
  const canEquipEngine = MOBILE_HULLS.some(id => id === craft) || SHIP_SKIN_IDS.some(id => id === craft);
  return (
    <main className="flex h-dvh flex-col bg-v2-void text-v2-ink" data-premium-review>
      <header className="max-h-[38dvh] shrink-0 space-y-2 overflow-y-auto border-b border-v2-line p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption font-semibold">Astera · görsel inceleme</p>
          <select className={`${button} text-caption!`} value={quality} aria-label="Görüntü kalitesi"
            onChange={(event) => { const next = RENDER_QUALITIES.find((value) => value === event.target.value); if (next) setRenderQuality(next); }}>
            {RENDER_QUALITIES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-1" aria-label="İnceleme sahnesi">
          {SCENES.map(([mode, label]) => <button key={mode} className={button} aria-pressed={sample.mode === mode}
            onClick={() => {
              if (mode === 'asteroid') {
                setRockChoice(ASTEROID_OPTIONS[0]); saveSelection({ asteroid: 'isotope' }); replay(mode, ROCK_ID);
              } else replay(mode);
            }}>{label}</button>)}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-caption text-v2-ink-3">
            Gemi
            <select className={`${button} min-w-0 flex-1 text-caption!`} value={craft} aria-label="İncelenecek gemi" onChange={event => {
              const next = INSPECTION_CRAFT.find(item => item.id === event.target.value);
              if (next) { if (next.id !== craft) setReady(false); setCraft(next.id); saveSelection({ craft: next.id }); replay('ship'); }
            }}>
              {INSPECTION_CRAFT.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button className={button} onClick={() => { replay(sample.mode); }}>Tekrar oynat</button>
        </div>
        {sample.mode === 'ship' && <div className="flex flex-wrap gap-1" aria-label="Gemi açısı">
          {INSPECTION_ANGLES.map(item => <button key={item.id} className={button} aria-pressed={angle === item.id}
            onClick={() => { setAngle(item.id); saveSelection({ angle: item.id }); }}>{item.label}</button>)}
          <button className={button} aria-pressed={engines} onClick={() => { setEngines(!engines); saveSelection({ engines: engines ? 'off' : 'on' }); }}>{engines ? 'Motoru kapat' : 'Motoru aç'}</button>
          <label className="flex items-center gap-2 text-caption text-v2-ink-3">
            Alev
            <select className={`${button} text-caption! disabled:opacity-50`} aria-label="Motor alevi" value={engineId} disabled={!canEquipEngine}
              onChange={event => {
                const id = event.target.value === 'native' ? 'native' : ENGINE_OPTIONS.find(item => item.id === event.target.value)?.id;
                if (id) { setEngineId(id); setEngines(true); saveSelection({ engine: id, engines: 'on' }); }
              }}>
              <option value="native">Standart</option>
              {ENGINE_OPTIONS.map(item => <option key={item.id} value={item.id}>{t(cosmeticCopy(item.id).nameKey)}</option>)}
            </select>
          </label>
        </div>}
        {sample.mode === 'asteroid' && <label className="flex items-center gap-2 text-caption text-v2-ink-3">
          Asteroid
          <select className={`${button} min-w-0 flex-1`} aria-label="Asteroid modeli" value={rockChoice.id} onChange={event => {
            const next = ASTEROID_OPTIONS.find(item => item.id === event.target.value);
            if (next) { setRockChoice(next); saveSelection({ asteroid: next.id }); replay('asteroid', next.rockId); }
          }}>
            {ASTEROID_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>}
        <details className="text-caption text-v2-ink-3" open={sample.mode === 'monument' || sample.mode === 'planet'}>
          <summary className="cursor-pointer py-1">Anıt, Dyson ve ses seçenekleri</summary>
          <div className="flex flex-wrap items-center gap-2 py-1">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              Anıt
              <select className={`${button} min-w-0 flex-1 text-caption!`} value={monumentOrdinal} aria-label="Anıt modeli" onChange={event => {
                const ordinal = MONUMENT_ORDINALS.find(value => String(value) === event.target.value);
                if (ordinal !== undefined) { setMonumentOrdinal(ordinal); saveSelection({ monument: String(ordinal) }); replay('monument'); }
              }}>
                {MONUMENT_ORDINALS.map(ordinal => <option key={ordinal} value={ordinal}>{monumentName(ordinal)}</option>)}
              </select>
            </label>
            <select className={`${button} text-caption!`} value={coreLevel} aria-label="Dyson seviyesi" onChange={event => {
              const level = DYSON_LEVELS.find(value => String(value) === event.target.value);
              if (level !== undefined) { setCoreLevel(level); saveSelection({ dyson: String(level) }); replay('planet'); }
            }}>
              {DYSON_LEVELS.map(level => <option key={level} value={level}>{level === 6 ? 'Dyson yok' : `Dyson · Çekirdek ${String(level)}`}</option>)}
            </select>
            <button className={button} aria-pressed={cosmetic} onClick={() => { setCosmetic(value => !value); replay('planet'); }}>Lav kozmetiği</button>
          </div>
          <div className="flex flex-wrap gap-1 py-1" aria-label="Ses örnekleri">
            {SOUND_CUES.map(cue => <button key={cue} className={button} onClick={() => { playSound(cue); }}>{cue}</button>)}
          </div>
        </details>
      </header>
      <div className="relative min-h-0 flex-1" data-premium-scene-ready={ready ? 'true' : 'false'}>
        {sample.mode === 'ship' ? <PremiumShipInspector reset={sample.serial} craft={craft} angle={angle} engines={engines} engineId={engineId === 'native' ? undefined : engineId}
          onReady={markReady} />
          : <GalaxyCanvas key={sample.mode} planets={planets} pending={pending} contacts={[]} asteroids={rocks} runs={runs}
            wrecks={sample.mode === 'wreck' || sample.mode === 'mining' ? WRECKS : []}
            monuments={monuments} homePosition={sample.mode === 'mining' ? HOME : TARGET} activePlanetId={sample.mode === 'planet' ? 'p-1' : null}
            aegisLevel={0} seasonStart={seasonStart} focus={focus} onFocus={setFocus} homeSignal={0} centerSignal={centerSignal}
            inspectionPlanetId={sample.mode === 'planet' ? 'p-1' : sample.mode === 'battle' || sample.mode === 'strategic' ? 'p-2' : undefined}
            reviewFocusDistance={sample.mode === 'wreck' ? 2.1 : sample.mode === 'asteroid' ? 2.4 : undefined} onReady={markReady} />}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap justify-between gap-1 text-caption text-v2-ink-2">
          <span className="bg-v2-void/80 px-2 py-1">{sceneLabel} · tek örnek</span>
          <span className="bg-v2-void/80 px-2 py-1">Sürükle: döndür · tekerlek / iki parmak: yakınlaş</span>
        </div>
      </div>
    </main>
  );
}
