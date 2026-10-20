import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefCallback } from 'react';
import { ARENA_TUNING as T, FARM_POINTS, createSandboxWorld, holdPoints, type Pilot, type SteeringSettings } from '@astera/rules/arena';
import { FARM_TONE } from './farmColors.js';
import { renderPreset } from '../lib/quality.js';
import { loadArenaAssets, type ArenaAssets, type LoadProgress } from './assets/load.js';
import { openReferenceSession } from './access.js';
import { createArenaAudio } from './audio.js';
import { createArenaClient, type ArenaClient, type HudRefs } from './client.js';
import { FlightControls } from './Controls.js';
import { ArenaHud, type HudBind } from './Hud.js';
import { createControls } from './input.js';
import { createArenaNetwork, type Standing } from './network.js';
import { createHudStore } from './store.js';
import { arenaCopy, type ArenaCopy } from './copy.js';
import { createDiagnostics } from './diagnostics.js';
import './arena.css';

type Screen = 'loading' | 'preflight' | 'flight' | 'result';
/** Seconds the result stays up before the pilot is flown back in: the loop never stops on a menu. */
const RETURN_AFTER = 5;

function useRefList<T extends HTMLElement>(count: number): [(index: number) => RefCallback<T>, T[]] {
  const list = useMemo<T[]>(() => [], []);
  const callbacks = useMemo(() => Array.from({ length: count }, (_, i): RefCallback<T> => node => { if (node) list[i] = node; }), [count, list]);
  return [index => callbacks[index] ?? (() => undefined), list];
}

export default function Sandbox({ onLeave, credential }: { onLeave: () => void; credential?: () => Promise<string | null> }) {
  const c = arenaCopy();
  const [world] = useState(() => createSandboxWorld());
  const [controls] = useState(createControls);
  const [store] = useState(createHudStore);
  const [audio] = useState(createArenaAudio);
  const [diag] = useState(createDiagnostics);
  const diagLines = useSyncExternalStore(listener => diag.subscribe(listener), () => diag.lines.length > 0 ? diag.lines[diag.lines.length - 1] ?? '' : '', () => '');
  const [diagOpen, setDiagOpen] = useState(() => new URLSearchParams(location.search).has('diag'));
  const [settings] = useState<SteeringSettings>(() => ({ sensitivity: 1, invertPitch: false }));
  const [network] = useState(() => createArenaNetwork(world, settings, () => { controls.clear(); }, credential));
  const connection = useSyncExternalStore(network.subscribe, network.getSnapshot, network.getSnapshot);
  // A signed-in pilot came for the shared room; solo stays one tap away for practice.
  const [mode, setMode] = useState<'online' | 'solo'>(() => credential || new URLSearchParams(location.search).get('mode') === 'online' ? 'online' : 'solo');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [screen, setScreen] = useState<Screen>('loading');
  const [progress, setProgress] = useState<LoadProgress>({ done: 0, total: 1, stage: 'manifest' });
  const [assets, setAssets] = useState<ArenaAssets | null>(null);
  const [warming, setWarming] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tip, setTip] = useState(0);
  const status = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const canvas = useRef<HTMLCanvasElement>(null);
  const client = useRef<ArenaClient | null>(null);
  const root = useRef<HTMLElement>(null);
  const [enemyRef, enemies] = useRefList<HTMLDivElement>(12);
  const [threatRef, threats] = useRefList<HTMLDivElement>(8);
  const refs = useRef<Partial<Record<keyof Omit<HudRefs, 'enemies' | 'threats'>, HTMLElement | null>>>({});
  const single = useCallback((key: keyof Omit<HudRefs, 'enemies' | 'threats' | 'radar'>) => (node: HTMLDivElement | null) => { refs.current[key] = node; }, []);
  const bind = useMemo<HudBind>(() => ({
    reticle: single('reticle'), lead: single('lead'), hit: single('hit'), kill: single('kill'), exit: single('exit'),
    landing: single('landing'),
    crystal: single('crystal'), damage: single('damage'), rear: single('rear'),
    radar: (node: HTMLCanvasElement | null) => { refs.current.radar = node; },
    enemies: enemyRef, threats: threatRef,
  }), [single, enemyRef, threatRef]);

  useEffect(() => () => { audio.dispose(); network.dispose(); diag.dispose(); }, [audio, network, diag]);
  useEffect(() => { const id = setInterval(() => { setTip(n => n + 1); }, 4200); return () => { clearInterval(id); }; }, []);

  // The parent hands a fresh closure each render; the pack decision is made once.
  const [packCredential] = useState(() => credential);
  // Load everything first; a long, honest loading bar beats a stutter in the first fight.
  useEffect(() => {
    let live = true;
    const started = performance.now();
    diag.push(`load start · ${navigator.userAgent.slice(0, 80)}`);
    const references = import.meta.env.DEV ? Promise.resolve(true)
      : packCredential ? packCredential().then(openReferenceSession) : Promise.resolve(false);
    void references.then(on => loadArenaAssets(on, 16, p => { if (live) setProgress(p); })).then(result => {
      if (!live) return;
      diag.push(`assets ${String(Math.round(performance.now() - started))} ms · models ${String(result.rocks.length + result.rivals.length + 1)} · fx ${String(result.fx.size)}`);
      audio.setSources(result.sounds, result.music);
      setAssets(result);
    });
    return () => { live = false; };
  }, [audio, packCredential]);

  useEffect(() => {
    if (!assets || !canvas.current || client.current) return;
    let created: ArenaClient;
    try {
    created = createArenaClient({
      canvas: canvas.current, assets, world, controls, audio, settings, network: () => modeRef.current === 'online' ? network : null, store,
      quality: renderPreset(),
      name: (pilot: Pilot) => {
        const role = network.roles.get(pilot.id) ?? world.brains.get(pilot.id)?.role;
        if (role) return c.roles[role];
        return network.names.get(pilot.id) ?? `${c.rival} ${String(pilot.id)}`;
      },
      onContextLost: () => { setTimeout(() => { location.reload(); }, 1200); },
      log: line => { diag.push(line); },
    });
    } catch (error) {
      diag.push(`renderer failed: ${error instanceof Error ? error.message : String(error)}`);
      setDiagOpen(true);
      return;
    }
    client.current = created;
    if (import.meta.env.DEV || import.meta.env.VITE_VISUAL_TEST === '1') {
      Object.defineProperty(window, '__arena', { configurable: true, value: { world, controls, client: created, store, network, audio } });
    }
    setWarming(true);
    void created.warm().then(() => { created.start(); setWarming(false); setScreen('preflight'); })
      .catch((error: unknown) => { diag.push(`warm failed: ${error instanceof Error ? error.message : String(error)}`); setDiagOpen(true); });
    return () => { created.dispose(); client.current = null; Reflect.deleteProperty(window, '__arena'); };
  }, [assets, world, controls, audio, settings, network, store, c, diag]);

  useEffect(() => {
    client.current?.setHud({
      reticle: refs.current.reticle ?? null, lead: refs.current.lead ?? null, hit: refs.current.hit ?? null, kill: refs.current.kill ?? null,
      exit: refs.current.exit ?? null, crystal: refs.current.crystal ?? null, damage: refs.current.damage ?? null,
      landing: refs.current.landing ?? null,
      rear: refs.current.rear ?? null, radar: refs.current.radar instanceof HTMLCanvasElement ? refs.current.radar : null,
      enemies, threats,
    });
  }, [screen, enemies, threats, assets, warming]);

  // The result follows a flight that actually ended. Right after "fly again" the store can
  // still hold the last flight's end for a frame; that must not end the new one.
  const [ended, setEnded] = useState(false);
  const lastPhase = useRef(status.phase);
  // The hold as it was in flight: a destroyed ship's hold is already scattered by the time the result shows.
  const lastHold = useRef<readonly number[]>([0, 0, 0]);
  if (status.phase === 'flying' || status.phase === 'fuelOut') lastHold.current = status.hold;
  useEffect(() => {
    const was = lastPhase.current; lastPhase.current = status.phase;
    const over = ['dead', 'extracted', 'towed'].includes(status.phase);
    if (screen === 'flight' && over && (was === 'flying' || was === 'fuelOut')) setEnded(true);
  }, [screen, status.phase]);
  useEffect(() => {
    if (!ended || screen !== 'flight') return;
    controls.clear();
    const timer = setTimeout(() => { setScreen('result'); setEnded(false); }, status.phase === 'dead' ? 2600 : status.phase === 'extracted' ? 1500 : 800);
    return () => { clearTimeout(timer); };
  }, [ended, screen, status.phase, controls]);

  useEffect(() => {
    const clear = (): void => { controls.clear(); };
    const hidden = (): void => { if (document.hidden) { clear(); audio.silence(); } };
    const down = (event: KeyboardEvent): void => {
      if (screen !== 'flight' || menu || event.target instanceof HTMLInputElement) return;
      if (event.repeat && ['KeyQ', 'KeyE', 'KeyL', 'KeyT', 'KeyX'].includes(event.code)) return;
      if (event.code === 'KeyL') { event.preventDefault(); client.current?.land(); return; }
      if (/^(Key[WASDRFXQET]|Space|Shift(Left|Right)|Arrow(Up|Down|Left|Right))$/.test(event.code)) { event.preventDefault(); controls.keyDown(event.code); }
    };
    const up = (event: KeyboardEvent): void => { controls.keyUp(event.code); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', hidden);
    };
  }, [controls, audio, screen, menu]);

  useEffect(() => { client.current?.setPhase(screen === 'flight' ? (menu && mode === 'solo' ? 'paused' : 'flight') : 'preflight'); }, [screen, menu, mode]);

  const leave = (): void => {
    audio.ui(); controls.clear(); network.leave();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onLeave();
  };
  const launch = (): void => {
    audio.unlock(); audio.ui(true); setEnded(false);
    if (mode === 'online') network.connect();
    controls.setThrottle(0.5);
    client.current?.reset();
    setScreen('flight');
    if (root.current?.requestFullscreen && matchMedia('(pointer: coarse)').matches) void root.current.requestFullscreen().catch(() => undefined);
    const orientation: ScreenOrientation & { lock?: (value: 'portrait') => Promise<void> } = screenOrientation();
    if (orientation.lock) void orientation.lock('portrait').catch(() => undefined);
  };
  const again = (): void => {
    audio.ui(true); controls.clear(); setEnded(false);
    if (mode === 'online') network.dev('restart');
    else Object.assign(world, createSandboxWorld());
    controls.setThrottle(0.5);
    client.current?.reset();
    setScreen('flight');
  };

  const againRef = useRef(again); againRef.current = again;
  const [countdown, setCountdown] = useState(RETURN_AFTER);
  useEffect(() => {
    if (screen !== 'result') return;
    setCountdown(RETURN_AFTER);
    const started = performance.now();
    const id = setInterval(() => {
      const left = RETURN_AFTER - Math.floor((performance.now() - started) / 1000);
      if (left <= 0) { clearInterval(id); againRef.current(); } else setCountdown(left);
    }, 250);
    return () => { clearInterval(id); };
  }, [screen]);

  const percent = Math.round(progress.done / Math.max(1, progress.total) * 100);
  const result = status.phase === 'extracted' ? 'extracted' : status.phase === 'dead' ? 'dead' : 'towed';
  const flown = result === 'extracted' ? status.hold : lastHold.current;
  const flownPoints = holdPoints(flown);
  return <main ref={root} className={`arena-root screen-${screen}`} onContextMenu={event => { event.preventDefault(); }} data-arena="sandbox" data-screen={screen}>
    <canvas ref={canvas} className="arena-canvas" />
    {screen === 'flight' && <>
      <ArenaHud store={store} bind={bind} onMenu={() => { audio.ui(); controls.clear(); setMenu(true); }}
        connection={mode === 'online' ? <div className={`ah-link is-${connection.phase}`}>
          {connection.phase === 'online' ? <><i />{c.live} · {standingLine(connection.board, c)}<small>{connection.rtt} ms</small></>
            : connection.phase === 'failed' ? <><span>{c.kicks[connection.reason] ?? c.connectionFailed}</span>
              {connection.reason !== 'denied' && <button onClick={() => { network.connect(); }}>{c.reconnect}</button>}</>
              : <span>{connection.phase === 'reconnecting' ? c.reconnecting : c.connecting}</span>}
        </div> : null} />
      <FlightControls controls={controls} store={store}
        onLand={() => { if (client.current?.land()) audio.ui(true); }} onCancel={() => { client.current?.cancelLanding(); audio.ui(); }} />
    </>}
    {screen === 'loading' && <section className="arena-loading">
      <div className="al-mark"><span>ASTERA</span><small>{c.brand}</small></div>
      <div className="al-progress">
        <p>{warming ? c.stages.shaders : c.stages[progress.stage]}</p>
        <i><b style={{ transform: `scaleX(${String(warming ? 1 : percent / 100)})` }} /></i>
        <strong>{warming ? 100 : percent}%</strong>
      </div>
      <p className="al-tip">{c.tips[tip % c.tips.length]}</p>
    </section>}
    {screen === 'preflight' && <section className="arena-preflight">
      <header><span>ASTERA</span><p>{c.brand}</p><small>{c.sector}</small></header>
      <div className="ap-card">
        <p className="ap-eyebrow">{c.goalTitle}</p>
        <ol className="ap-goals">{c.goals.map(([title, detail], i) => <li key={title}><b>{String(i + 1)}</b><strong>{title}</strong><span>{detail}</span></li>)}</ol>
        <div className="ap-mode" role="radiogroup">
          {(['solo', 'online'] as const).map(value => <button key={value} role="radio" aria-checked={mode === value}
            className={mode === value ? 'is-selected' : ''} onClick={() => { audio.ui(); setMode(value); }}>{value === 'solo' ? c.solo : c.shared}</button>)}
        </div>
        <button className="ap-launch" onClick={launch}>{c.launch}<svg viewBox="0 0 20 20" aria-hidden><path d="M5 10h10M11 6l4 4-4 4" /></svg></button>
        <button className="ap-leave" onClick={leave}>{c.leave}</button>
        <p className="ap-keys">{c.keyboard}</p>
      </div>
    </section>}
    {screen === 'result' && <section className="arena-result">
      <div className={`ar-card is-${result}`}>
        <p className="ap-eyebrow">{c.brand}</p>
        <h2>{c[result]}</h2>
        <p className={`ar-points is-${result}`}>
          {flownPoints > 0 ? <><strong>{result === 'extracted' ? '+' : '−'}{flownPoints}</strong> {c.pointsShort}
            {result !== 'extracted' && <small> {c.lostPoints}</small>}</> : <small>{c.emptyHint}</small>}
        </p>
        {flownPoints > 0 && <ul className="ar-kinds">{flown.map((units, kind) => Math.floor(units) > 0 && <li key={kind} style={{ '--tone': FARM_TONE[kind] } as React.CSSProperties}>
          <i /><b>{Math.floor(units)}</b> {c.kinds[kind]} <small>×{FARM_POINTS[kind]}</small></li>)}</ul>}
        <p>{result === 'extracted' ? flownPoints > 0 ? c.extractedHint : c.emptyHint : result === 'dead' ? c.deadHint : c.towedHint}</p>
        <div className="ar-stats">
          <div><span>{c.delivered}</span><strong>{result === 'extracted' ? flownPoints : 0}</strong></div>
          <div><span>{c.hits}</span><strong>{status.hits}</strong></div>
          <div><span>{c.kills}</span><strong>{status.kills}</strong></div>
        </div>
        {mode === 'online' && <Standings board={connection.board} c={c} />}
        <button className="ap-launch ar-return" onClick={again} style={{ '--left': String(countdown / RETURN_AFTER) } as React.CSSProperties}>
          <span>{c.retry}</span><small>{c.returning} {countdown} {c.seconds}</small></button>
        <button className="ap-leave" onClick={leave}>{c.leave}</button>
        <p className="ap-keys">{c.resultNote}</p>
      </div>
    </section>}
    {menu && <div className="arena-menu"><section role="dialog" aria-label={c.settings}>
      <h2>{c.settings}</h2>
      {mode === 'online' && <Standings board={connection.board} c={c} />}
      <label>{c.sensitivity}<input type="range" min="0.5" max="1.5" step="0.05" defaultValue={settings.sensitivity}
        onChange={event => { settings.sensitivity = Number(event.target.value); }} /></label>
      <label className="is-check"><input type="checkbox" defaultChecked={settings.invertPitch} onChange={event => { settings.invertPitch = event.target.checked; }} />{c.invert}</label>
      <label className="is-check"><input type="checkbox" defaultChecked={audio.enabled} onChange={event => { audio.enabled = event.target.checked; }} />{c.sound}</label>
      <p className="ap-keys">{c.keyboard}</p>
      <button className="ap-launch" onClick={() => { audio.ui(); setMenu(false); }}>{c.resume}</button>
      <button className="ap-leave" onClick={leave}>{c.leave}</button>
    </section></div>}
    {import.meta.env.DEV && <button className="arena-dev" onClick={() => { setDiagOpen(open => !open); }}>
      fps {Math.round(client.current?.metrics.fps ?? 0)} · {T.tickRate} Hz · tanı</button>}
    {import.meta.env.DEV && diagOpen && <pre className="arena-diag" data-last={diagLines}>{diag.lines.join('\n')}</pre>}
  </main>;
}

/** "Rank 1/3 · 120 pts" — where you stand, in the number the room is won on. */
function standingLine(board: readonly Standing[], c: ArenaCopy): string {
  const index = board.findIndex(row => row.self);
  const self = board[index];
  if (!self || board.length < 2) return c.alone;
  return `${c.rank} ${String(index + 1)}/${String(board.length)} · ${String(self.points)} ${c.pointsShort}`;
}

function Standings({ board, c }: { board: readonly Standing[]; c: ArenaCopy }) {
  if (board.length === 0) return null;
  return <section className="ar-board" aria-label={c.standings}>
    <header><p className="ap-eyebrow">{c.standings}</p><small>{c.standingsRule}</small></header>
    <table>
      <thead><tr><th>#</th><th /><th>{c.pointsCol}</th><th>{c.killsCol}</th><th>{c.deathsCol}</th></tr></thead>
      <tbody>{board.map((row, i) => <tr key={row.id} className={row.self ? 'is-self' : ''}>
        <td>{i + 1}</td><td>{row.self ? `${row.name} · ${c.you}` : row.name}</td><td>{row.points}</td><td>{row.kills}</td><td>{row.deaths}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function screenOrientation(): ScreenOrientation & { lock?: (value: 'portrait') => Promise<void> } {
  return screen.orientation;
}
