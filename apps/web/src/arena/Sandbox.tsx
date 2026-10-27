import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefCallback } from 'react';
import { ARENA_TUNING as T, FARM_POINTS, SHIP_CLASSES, TACTICS, createInput, createSandboxWorld, holdPoints, type Pilot, type ShipClass, type SteeringSettings,
  type Tactic, type TeamView } from '@astera/rules/arena';
import { ClassPicker, TacticPicker } from './ClassPicker.js';
import { LaunchLabel, SortieSummary, launchText } from './Hangar.js';
import { debriefText, pilotName, readDebrief, type Debrief } from './debrief.js';
import { capLeft, fetchHangar, launchBlock, refusedAtHangar, stillFlying, type HangarAnswer, type LaunchBlock } from './hangarDesk.js';
import { FARM_TONE } from './farmColors.js';
import { arenaGraphics, setArenaGraphics, type ArenaGraphicsChoice } from './graphics.js';
import { GraphicsPicker } from './GraphicsPicker.js';
import { LoopLine } from './LoopLine.js';
import { PingWheel } from './PingWheel.js';
import { placesOf } from './landmarks.js';
import { loadArenaAssets, type ArenaAssets, type LoadProgress } from './assets/load.js';
import { assetTextureBytes, releaseKtx2 } from './assets/memory.js';
import { ModePicker } from './ModePicker.js';
import { openReferenceSession } from './access.js';
import { createArenaAudio } from './audio.js';
import { createArenaClient, type ArenaClient, type HudRefs } from './client.js';
import { FlightControls } from './Controls.js';
import { ModelCredits } from './credits.js';
import { ArenaHud, type HudBind } from './Hud.js';
import { GAME_KEY, ONE_PRESS_KEYS, createControls } from './input.js';
import { createArenaNetwork, type Standing } from './network.js';
import { createHudStore } from './store.js';
import { arenaCopy, type ArenaCopy } from './copy.js';
import { createDiagnostics } from './diagnostics.js';
import TeamPanel from './TeamPanel.js';
import { SpectatorPanel } from './SpectatorPanel.js';
import { teamCopy } from './teamCopy.js';
import './arena.css';

type Screen = 'loading' | 'preflight' | 'flight' | 'spectate' | 'result';
/** Seconds the result stays up before the pilot is flown back in: the loop never stops on a menu. */
const RETURN_AFTER = 5;
/** The class picked last, remembered on this device only; the Kılavuz, the middle ship, for a first flight. */
const SHIP_KEY = 'astera-arena-ship';
function storedShip(): ShipClass {
  try { const stored = localStorage.getItem(SHIP_KEY); return SHIP_CLASSES.find(ship => ship === stored) ?? 'kilavuz'; } catch { return 'kilavuz'; }
}
/** The B slot picked last (Y4c), likewise; smoke for a first flight. */
const TACTIC_KEY = 'astera-arena-tactic';
function storedTactic(): Tactic {
  try { const stored = localStorage.getItem(TACTIC_KEY); return TACTICS.find(tactic => tactic === stored) ?? 'smoke'; } catch { return 'smoke'; }
}

function useRefList<T extends HTMLElement>(count: number): [(index: number) => RefCallback<T>, T[]] {
  const list = useMemo<T[]>(() => [], []);
  const callbacks = useMemo(() => Array.from({ length: count }, (_, i): RefCallback<T> => node => { if (node) list[i] = node; }), [count, list]);
  return [index => callbacks[index] ?? (() => undefined), list];
}

export default function Sandbox({ onLeave, credential }: { onLeave: () => void; credential?: () => Promise<string | null> }) {
  const c = arenaCopy();
  const [ship, setShip] = useState<ShipClass>(storedShip);
  const [tactic, setTactic] = useState<Tactic>(storedTactic);
  const [world] = useState(() => createSandboxWorld({ ship, tactic }));
  const [controls] = useState(createControls);
  const [store] = useState(createHudStore);
  const [audio] = useState(createArenaAudio);
  const [diag] = useState(createDiagnostics);
  const diagLines = useSyncExternalStore(listener => diag.subscribe(listener), () => diag.lines.length > 0 ? diag.lines[diag.lines.length - 1] ?? '' : '', () => '');
  const [diagOpen, setDiagOpen] = useState(() => new URLSearchParams(location.search).has('diag'));
  const [settings] = useState<SteeringSettings>(() => ({ sensitivity: 1, invertPitch: false }));
  const [graphics, setGraphics] = useState<ArenaGraphicsChoice>(arenaGraphics);
  const [network] = useState(() => createArenaNetwork(world, settings, () => { controls.clear(); }, credential));
  const connection = useSyncExternalStore(network.subscribe, network.getSnapshot, network.getSnapshot);
  // A signed-in pilot came for the shared room; solo stays one tap away for practice.
  const [mode, setMode] = useState<'online' | 'solo'>(() => credential || new URLSearchParams(location.search).get('mode') === 'online' ? 'online' : 'solo');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Y6a: a signed-in commander's shared flight is real: the hangar desk holds their ship. `?hangar` shows it in development.
  const [hangarToken] = useState(() => credential ?? ((import.meta.env.DEV || import.meta.env.VITE_VISUAL_TEST === '1')
    && new URLSearchParams(location.search).has('hangar') ? () => Promise.resolve('dev') : null));
  const [desk, setDesk] = useState<HangarAnswer | null>(null);
  /** Rejoining a ship the room still holds in the air (F22): the flight, not the preflight, follows the load. */
  const [resuming, setResuming] = useState(false);
  const resumingRef = useRef(false);
  const [deskNote, setDeskNote] = useState('');
  const [now, setNow] = useState(Date.now);
  const [screen, setScreen] = useState<Screen>('loading');
  const real = hangarToken !== null && mode === 'online';
  // F3: below the Core a ship needs, the live room is shut where it is chosen; practice is what is open.
  const coreLock = desk?.ok && desk.hangar.core < desk.hangar.minCore ? { core: desk.hangar.core, need: desk.hangar.minCore } : null;
  const coreLocked = coreLock !== null;
  useEffect(() => { if (coreLocked) setMode('solo'); }, [coreLocked]);
  const [teamView, setTeamView] = useState<TeamView | null>(null);
  const refreshDesk = useCallback((): void => {
    if (!hangarToken) return;
    void hangarToken().then(token => fetchHangar(token)).then(answer => { setDesk(answer); setNow(Date.now()); });
  }, [hangarToken]);
  // At once, too: a ship still in the air is flown on while the Yarık loads (F22).
  useEffect(() => { if (real) refreshDesk(); }, [real, refreshDesk]);
  useEffect(() => { if (real && screen === 'preflight') refreshDesk(); }, [real, screen, refreshDesk]);
  // The hangar's and the result's clocks.
  useEffect(() => {
    if (!real || (screen !== 'preflight' && screen !== 'result')) return;
    const id = setInterval(() => { setNow(Date.now()); }, 1000);
    return () => { clearInterval(id); };
  }, [real, screen]);
  const [progress, setProgress] = useState<LoadProgress>({ done: 0, total: 1, stage: 'manifest' });
  const [assets, setAssets] = useState<ArenaAssets | null>(null);
  const [warming, setWarming] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tip, setTip] = useState(0);
  // The page needs the flight's phase. The HUD numbers change ten times a second; the page
  // re-rendering for them rebuilt everything under it, most of an S22 frame (V6g).
  const phase = useSyncExternalStore(store.subscribe, () => store.getSnapshot().phase, () => store.getSnapshot().phase);
  useEffect(() => {
    let armed = '';
    return store.subscribe(() => {
      const next = `${world.pilot.ship}:${world.pilot.tactic}`;
      if (armed === next) return;
      armed = next; controls.setSignature({ aimed: world.pilot.ship !== 'akinci', self: () => world.pilot.id }); controls.setTactic(world.pilot.tactic);
    });
  }, [store, world, controls]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const client = useRef<ArenaClient | null>(null);
  const pickGraphics = (choice: ArenaGraphicsChoice): void => {
    audio.ui(); setArenaGraphics(choice); setGraphics(choice); client.current?.setGraphics(choice);
  };
  const root = useRef<HTMLElement>(null);
  const [enemyRef, enemies] = useRefList<HTMLDivElement>(12);
  const [threatRef, threats] = useRefList<HTMLDivElement>(8);
  const [placeRef, places] = useRefList<HTMLDivElement>(placesOf(world.layout).length);
  const [pingRef, pings] = useRefList<HTMLDivElement>(3);
  const refs = useRef<Partial<Record<keyof Omit<HudRefs, 'enemies' | 'threats' | 'places' | 'pings'>, HTMLElement | null>>>({});
  // The map mounts and unmounts while flying: the client reads this one object every frame.
  const mapRefs = useRef<HudRefs['map']>({ self: null, altitude: null });
  const single = useCallback((key: keyof Omit<HudRefs, 'enemies' | 'threats' | 'places' | 'pings' | 'radar'>) => (node: HTMLDivElement | null) => { refs.current[key] = node; }, []);
  const bind = useMemo<HudBind>(() => ({
    reticle: single('reticle'), lead: single('lead'), hit: single('hit'), kill: single('kill'), exit: single('exit'),
    landing: single('landing'), circle: single('circle'), incoming: single('incoming'),
    crystal: single('crystal'), damage: single('damage'),
    radar: (node: HTMLCanvasElement | null) => { refs.current.radar = node; },
    mapSelf: (node: SVGGElement | null) => { mapRefs.current.self = node; },
    mapAltitude: (node: HTMLElement | null) => { mapRefs.current.altitude = node; },
    enemies: enemyRef, threats: threatRef, places: placeRef, pings: pingRef,
  }), [single, enemyRef, threatRef, placeRef, pingRef]);

  useEffect(() => () => { audio.dispose(); network.dispose(); diag.dispose(); }, [audio, network, diag]);
  useEffect(() => { const id = setInterval(() => { setTip(n => n + 1); }, 4200); return () => { clearInterval(id); }; }, []);

  // The parent hands a fresh closure each render; the pack decision is made once.
  const [packCredential] = useState(() => credential);
  // Load everything first; a long, honest loading bar beats a stutter in the first fight.
  // A load that fails says so and can be tried again (S22: it once sat at 1% for good).
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTry, setLoadTry] = useState(0);
  useEffect(() => {
    let live = true;
    const started = performance.now();
    diag.push(`load start · ${navigator.userAgent.slice(0, 80)}`);
    const references = import.meta.env.DEV ? Promise.resolve(true)
      : packCredential ? packCredential().then(openReferenceSession) : Promise.resolve(false);
    // Not for a mount already taken back (StrictMode's in development): two packs side by side
    // killed a phone's renderer.
    // The load uses the page's one transcoder (the hangar's, already warm); the flight has no use
    // for its worker and WebAssembly heap, so they go once the load has ended, however it ended.
    const loading = references.then(on => live ? loadArenaAssets(on, 16, p => { if (live) setProgress(p); }) : null);
    void loading.finally(releaseKtx2).catch(() => undefined);
    void loading.then(result => {
      if (!live || !result) return;
      diag.push(`assets ${String(Math.round(performance.now() - started))} ms · models ${String(result.colliders.size + result.rivals.length + result.classes.size + 1)} · fx ${String(result.fx.size)} · tex ${String(Math.round(assetTextureBytes(result) / 1048576))} MB`);
      audio.setSources(result.sounds, result.music);
      setAssets(result);
    }, (error: unknown) => {
      diag.push(`load failed: ${error instanceof Error ? error.message : String(error)}`);
      if (live) setLoadFailed(true);
    });
    return () => { live = false; };
  }, [audio, packCredential, loadTry, diag]);

  useEffect(() => {
    if (!assets || !canvas.current || client.current) return;
    let created: ArenaClient;
    try {
    created = createArenaClient({
      canvas: canvas.current, assets, world, controls, audio, settings, network: () => modeRef.current === 'online' ? network : null, store,
      graphics: arenaGraphics(),
      name: (pilot: Pilot) => pilotName(pilot.id, c, world, network),
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
    void created.warm().then(() => {
      created.start(); setWarming(false);
      if (!resumingRef.current) { setScreen('preflight'); return; }
      // Back to a ship already in the air: its own throttle, its own keys.
      controls.setThrottle(world.pilot.throttle); controls.setSignature({ aimed: world.pilot.ship !== 'akinci', self: () => world.pilot.id });
      controls.setTactic(world.pilot.tactic); created.reset(); setScreen('flight');
    })
      .catch((error: unknown) => { diag.push(`warm failed: ${error instanceof Error ? error.message : String(error)}`); setDiagOpen(true); });
    return () => { created.dispose(); client.current = null; Reflect.deleteProperty(window, '__arena'); };
  }, [assets, world, controls, audio, settings, network, store, c, diag]);

  useEffect(() => {
    client.current?.setHud({
      reticle: refs.current.reticle ?? null, lead: refs.current.lead ?? null, hit: refs.current.hit ?? null, kill: refs.current.kill ?? null,
      exit: refs.current.exit ?? null, crystal: refs.current.crystal ?? null, damage: refs.current.damage ?? null,
      landing: refs.current.landing ?? null, circle: refs.current.circle ?? null, incoming: refs.current.incoming ?? null,
      radar: refs.current.radar instanceof HTMLCanvasElement ? refs.current.radar : null,
      enemies, threats, places, pings, map: mapRefs.current,
    });
  }, [screen, enemies, threats, places, pings, assets, warming]);

  // The result follows a flight that actually ended. Right after "fly again" the store can
  // still hold the last flight's end for a frame; that must not end the new one.
  const [ended, setEnded] = useState(false);
  // "Ne oldu?": read at the moment the flight ends, while the shooter is still in the world.
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const lastPhase = useRef(phase);
  // The hold as it was in flight: a destroyed ship's hold is already scattered by the time the result shows.
  const lastHold = useRef<readonly number[]>([0, 0, 0]);
  useEffect(() => store.subscribe(() => {
    const s = store.getSnapshot();
    if (s.phase === 'flying' || s.phase === 'fuelOut') lastHold.current = s.hold;
  }), [store]);
  useEffect(() => {
    const was = lastPhase.current; lastPhase.current = phase;
    const over = ['dead', 'extracted', 'towed'].includes(phase);
    if (screen === 'flight' && over && (was === 'flying' || was === 'fuelOut')) { setEnded(true); setDebrief(readDebrief(world)); }
    else if (phase === 'flying' && was !== 'flying') setDebrief(null);
  }, [screen, phase, world]);
  useEffect(() => {
    if (!ended || screen !== 'flight') return;
    controls.clear();
    const timer = setTimeout(() => { setScreen(connection.teamId && connection.watching !== null ? 'spectate' : 'result'); setEnded(false); }, phase === 'dead' ? 2600 : phase === 'extracted' ? 1500 : 800);
    return () => { clearTimeout(timer); };
  }, [ended, screen, phase, controls, connection.teamId, connection.watching]);
  useEffect(() => {
    client.current?.setSpectator(screen === 'spectate' ? connection.watching : null);
    if (screen === 'spectate' && connection.phase === 'online' && connection.received && connection.watching === null) setScreen('result');
  }, [screen, connection.watching, connection.phase, connection.received]);

  useEffect(() => {
    const clear = (): void => { controls.clear(); };
    const hidden = (): void => { if (document.hidden) { clear(); audio.silence(); } };
    const down = (event: KeyboardEvent): void => {
      if (screen !== 'flight' || menu || event.target instanceof HTMLInputElement) return;
      if (event.repeat && ONE_PRESS_KEYS.includes(event.code)) return;
      if (event.code === 'KeyL') { event.preventDefault(); client.current?.land(); return; }
      if (import.meta.env.DEV && event.code === 'KeyC') { client.current?.toggleColliders(); return; }
      if (GAME_KEY.test(event.code)) { event.preventDefault(); controls.keyDown(event.code); }
    };
    const up = (event: KeyboardEvent): void => { controls.keyUp(event.code); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', hidden);
    };
  }, [controls, audio, screen, menu]);

  useEffect(() => { client.current?.setPhase(screen === 'flight' || screen === 'spectate' ? (menu && mode === 'solo' ? 'paused' : 'flight') : 'preflight'); }, [screen, menu, mode]);

  const leave = (): void => {
    audio.ui(); controls.clear(); network.leave();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onLeave();
  };
  /** The hangar shows the picked class at once; the flight starts in it. */
  const pickShip = (next: ShipClass): void => {
    audio.ui(); setShip(next); world.pilot.ship = next;
    try { localStorage.setItem(SHIP_KEY, next); } catch { /* A private window keeps the choice for this visit only. */ }
  };
  /** The commander's ship on the desk: every choice about it is made in the hangar (the Komutan gemisi tab). */
  const owned = real && desk?.ok ? desk.hangar.ship : null;
  // Owner 2026-10-27: the preflight turned the world's default Kılavuz round the dock, not the ship flown.
  const ownedClass = owned?.class;
  useEffect(() => {
    if (!ownedClass || (screen !== 'loading' && screen !== 'preflight' && screen !== 'result')) return;
    setShip(ownedClass); world.pilot.ship = ownedClass;
  }, [ownedClass, screen, world]);
  // CR6: a share taken here shows what today's transfer cap would leave behind, as in the hangar.
  const room = desk?.ok ? { room: { left: capLeft(desk.hangar), resetsAt: desk.hangar.resetsAt } } : {};
  const block: LaunchBlock | null = real && desk?.ok ? launchBlock(desk.hangar, now) : null;
  /** A real flight launches only from a hangar that answered and holds nothing against it. */
  const inLobby = teamView?.team?.joined && teamView.team.state === 'forming';
  const grounded = real && (!desk?.ok || (block !== null && !stillFlying(desk.hangar)) || inLobby === true);
  const pickTactic = (next: Tactic): void => {
    audio.ui(); setTactic(next); world.pilot.tactic = next;
    try { localStorage.setItem(TACTIC_KEY, next); } catch { /* As the class. */ }
  };
  /** A missile goes on one press; a shield or repair is aimed (input.ts). Q and E press the B slot flown. */
  const arm = (): void => { controls.setSignature({ aimed: world.pilot.ship !== 'akinci', self: () => world.pilot.id }); controls.setTactic(world.pilot.tactic); };
  const launch = (reserved?: TeamView): void => {
    const party = reserved?.team?.joined && reserved.team.state === 'flying' ? reserved.team : null;
    if (grounded && !party) return;
    const member = party?.members.find(m => m.playerId === reserved?.playerId);
    audio.unlock(); audio.ui(true); setEnded(false); setDeskNote('');
    if (owned) { setShip(owned.class); world.pilot.ship = owned.class; }
    if (mode === 'online') network.connect(owned?.class ?? ship, member?.tactic ?? tactic, Boolean(member?.outcome));
    else Object.assign(world, createSandboxWorld({ ship: owned?.class ?? ship, tactic }));
    controls.setThrottle(0.5); arm();
    client.current?.reset();
    setScreen(member?.outcome ? 'spectate' : 'flight');
    if (root.current?.requestFullscreen && matchMedia('(pointer: coarse)').matches) void root.current.requestFullscreen().catch(() => undefined);
    const orientation: ScreenOrientation & { lock?: (value: 'portrait') => Promise<void> } = screenOrientation();
    if (orientation.lock) void orientation.lock('portrait').catch(() => undefined);
  };
  const again = (): void => {
    audio.ui(true); controls.clear(); setEnded(false);
    if (mode === 'online') network.dev('restart');
    else Object.assign(world, createSandboxWorld({ ship, tactic }));
    controls.setThrottle(0.5); arm();
    client.current?.reset();
    setScreen('flight');
  };

  /**
   * F22: the page closed mid-flight and the room still holds the ship. It is rejoined at once (the
   * room gives a reattached ship a fresh link grace) and a neutral input holds the link while the
   * Yarık still loads; the flight screen follows the load, the ship where it was.
   */
  useEffect(() => {
    if (!real || resumingRef.current || !desk?.ok || !stillFlying(desk.hangar) || !desk.hangar.ship) return;
    resumingRef.current = true; setResuming(true);
    const owned = desk.hangar.ship.class;
    setShip(owned); world.pilot.ship = owned;
    network.connect(owned, tactic);
    if (screen === 'preflight') {
      controls.setThrottle(world.pilot.throttle); controls.setSignature({ aimed: owned !== 'akinci', self: () => world.pilot.id }); controls.setTactic(world.pilot.tactic);
      client.current?.reset(); setScreen('flight');
    }
  }, [real, desk, network, world, tactic, screen, controls]);
  useEffect(() => {
    if (!resuming || screen !== 'loading') return;
    const id = setInterval(() => { network.step(createInput()); }, 250);
    return () => { clearInterval(id); };
  }, [resuming, screen, network]);

  // A launch the room refused (the ship rests, the capital is short) is the hangar's to explain.
  useEffect(() => {
    if (!real || screen !== 'flight' || connection.phase !== 'failed' || !refusedAtHangar(connection.reason)) return;
    const errors: Readonly<Record<string, string>> = teamCopy().errors;
    setDeskNote(errors[connection.reason] ?? c.kicks[connection.reason] ?? c.hangarError); network.stop(); setScreen('preflight');
  }, [real, screen, connection.phase, connection.reason, network, c]);

  const againRef = useRef(again); againRef.current = again;
  const [countdown, setCountdown] = useState(RETURN_AFTER);
  useEffect(() => {
    if (screen !== 'result' || real) return;
    setCountdown(RETURN_AFTER);
    const started = performance.now();
    const id = setInterval(() => {
      const left = RETURN_AFTER - Math.floor((performance.now() - started) / 1000);
      if (left <= 0) { clearInterval(id); againRef.current(); } else setCountdown(left);
    }, 250);
    return () => { clearInterval(id); };
  }, [screen, real]);

  const percent = Math.round(progress.done / Math.max(1, progress.total) * 100);
  const status = store.getSnapshot();
  const result = phase === 'extracted' ? 'extracted' : phase === 'dead' ? 'dead' : 'towed';
  const flown = result === 'extracted' ? status.hold : lastHold.current;
  // A recall is the server's word, after the fact; the moment of the end cannot know it.
  const what: Debrief | null = real && connection.sortie?.outcome === 'recalled' ? { kind: 'recalled' } : debrief;
  const flownPoints = holdPoints(flown);
  return <main ref={root} className={`arena-root screen-${screen}`} onContextMenu={event => { event.preventDefault(); }} data-arena="sandbox" data-screen={screen}
    onPointerDownCapture={event => {
      const now = performance.now();
      if (screen !== 'flight' || !controls.aiming(now) || (event.target instanceof Element && event.target.closest('button,input,[role="dialog"]'))) return;
      const friend = client.current?.friendAt(event.clientX, event.clientY);
      if (friend === null || friend === undefined) return;
      controls.signatureAt(friend, now); event.preventDefault(); event.stopPropagation();
    }}>
    <canvas ref={canvas} className="arena-canvas" />
    {screen === 'flight' && <>
      <PingWheel c={c} aim={(x, y) => client.current?.aim(x, y) ?? null}
        onPing={(kind, target) => { if (target) { client.current?.ping(kind, target); audio.ui(true); } }} />
      <ArenaHud store={store} bind={bind} layout={world.layout} onMenu={() => { audio.ui(); controls.clear(); setMenu(true); }}
        connection={mode === 'online' ? <div className={`ah-link is-${connection.phase}`}>
          {connection.phase === 'online' ? <><i role="img" aria-label={c.live} /><span>{standingLine(connection.board, c)}</span><small>{connection.rtt} ms</small></>
            : connection.phase === 'failed' ? <><span>{c.kicks[connection.reason] ?? c.connectionFailed}</span>
              {/* Reconnecting cannot help a refusal or an outdated page. */}
              {connection.reason !== 'denied' && connection.reason !== 'version' && <button onClick={() => { network.connect(ship, tactic); }}>{c.reconnect}</button>}</>
              : <span>{connection.phase === 'reconnecting' ? c.reconnecting : c.connecting}</span>}
        </div> : null} />
      <FlightControls controls={controls} store={store}
        onLand={() => { if (client.current?.land()) audio.ui(true); }} onCancel={() => { client.current?.cancelLanding(); audio.ui(); }} />
    </>}
    {screen === 'spectate' && connection.teamId && <SpectatorPanel world={world} store={store} network={network} teamId={connection.teamId}
      watching={connection.watching} onResults={() => { setScreen('result'); }} />}
    {screen === 'spectate' && !connection.teamId && <section className="arena-spectator">
      <p role="status">{connection.phase === 'failed' ? c.connectionFailed : c.connecting}</p>
      <button type="button" className="as-result" onClick={() => { setScreen('result'); }}>{teamCopy().results}</button>
    </section>}
    {screen === 'loading' && <section className="arena-loading">
      <div className="al-mark"><span>ASTERA</span><small>{c.brand}</small></div>
      <div className="al-progress">
        <p>{warming ? c.stages.shaders : c.stages[progress.stage]}</p>
        <i><b style={{ transform: `scaleX(${String(warming ? 1 : percent / 100)})` }} /></i>
        <strong>{warming ? 100 : percent}%</strong>
      </div>
      {loadFailed ? <div className="al-failed" role="alert">
        <p>{c.loadFailed}</p>
        <button className="ap-launch" onClick={() => { setLoadFailed(false); setProgress({ done: 0, total: 1, stage: 'manifest' }); setLoadTry(n => n + 1); }}>{c.loadRetry}</button>
        <button className="ap-leave" onClick={leave}>{c.leave}</button>
      </div> : <p className="al-tip">{c.tips[tip % c.tips.length]}</p>}
    </section>}
    {screen === 'preflight' && <section className="arena-preflight">
      <header><span>ASTERA</span><p>{c.brand}</p><small>{c.sector}</small></header>
      <div className="ap-dock">
        <LoopLine c={c} />
        {real ? <ShipLine c={c} desk={desk} note={deskNote} /> : <ClassPicker c={c} value={ship} onPick={pickShip} />}
        {!(real && inLobby) && <TacticPicker c={c} value={tactic} ship={owned?.class ?? ship} points={owned?.abilities ?? {}} onPick={pickTactic} />}
        <ModePicker c={c} mode={mode} lock={coreLock} onPick={value => { audio.ui(); setMode(value); }} />
        {/* Whatever keeps a real flight on the ground names itself here; the hangar is where it is put right. */}
        {real && <div className="ap-team"><TeamPanel credential={hangarToken} onEnter={launch} onView={setTeamView} {...room} /></div>}
        {(!real || desk?.ok) && <button className="ap-launch" onClick={() => { launch(); }} disabled={grounded}>
          {inLobby && real ? teamCopy().teamLaunch : real && desk?.ok ? stillFlying(desk.hangar) ? c.resumeFlight : <LaunchLabel {...launchText(desk.hangar, now, c)} /> : c.launch}
          {!grounded && <svg viewBox="0 0 20 20" aria-hidden><path d="M5 10h10M11 6l4 4-4 4" /></svg>}</button>}
        <button className="ap-leave" onClick={leave}>{c.leave}</button>
        <p className="ap-keys">{c.keyboard}</p>
      </div>
    </section>}
    {screen === 'result' && <section className="arena-result">
      <div className={`ar-card is-${result}`}>
        <p className="ap-eyebrow">{c.brand}</p>
        <h2>{c[result]}</h2>
        {what && <p className="ar-what" data-debrief={what.kind}><span>{c.debrief.title}</span>{debriefText(what, c, id => pilotName(id, c, world, network))}</p>}
        {real ? <SortieSummary c={c} report={connection.sortie} hold={flown} now={now} /> : <>
          <p className={`ar-points is-${result}`}>
            {flownPoints > 0 ? <><strong>{result === 'extracted' ? '+' : '−'}{flownPoints}</strong> {c.pointsShort}
              {result !== 'extracted' && <small> {c.lostPoints}</small>}</> : <small>{c.emptyHint}</small>}
          </p>
          {flownPoints > 0 && <ul className="ar-kinds">{flown.map((units, kind) => Math.floor(units) > 0 && <li key={kind} style={{ '--tone': FARM_TONE[kind] } as React.CSSProperties}>
            <i /><b>{Math.floor(units)}</b> {c.kinds[kind]} <small>×{FARM_POINTS[kind]}</small></li>)}</ul>}
        </>}
        {!(real && result === 'extracted') && what?.kind !== 'recalled' && <p>{result === 'extracted' ? flownPoints > 0 ? c.extractedHint : c.emptyHint : result === 'dead' ? c.deadHint : c.towedHint}</p>}
        <div className={`ar-stats ${real ? 'is-two' : ''}`}>
          {!real && <div><span>{c.delivered}</span><strong>{result === 'extracted' ? flownPoints : 0}</strong></div>}
          <div><span>{c.hits}</span><strong>{status.hits}</strong></div>
          <div><span>{c.kills}</span><strong>{status.kills}</strong></div>
        </div>
        {mode === 'online' && <Standings board={connection.board} c={c} />}
        {real && <div className="ap-team"><TeamPanel credential={hangarToken} claimsOnly {...room} /></div>}
        {connection.teamId && connection.watching !== null && <button className="ap-launch" onClick={() => { setScreen('spectate'); }}>{teamCopy().watch}</button>}
        {/* After a real flight the ship rests: the hangar's clock says when it flies again. */}
        {real ? <button className="ap-launch" onClick={leave}>{c.backToHangar}</button>
          : <button className="ap-launch ar-return" onClick={again} style={{ '--left': String(countdown / RETURN_AFTER) } as React.CSSProperties}>
            <span>{c.retry}</span><small>{c.returning} {countdown} {c.seconds}</small></button>}
        <button className="ap-leave" onClick={leave}>{c.leave}</button>
        <p className="ap-keys">{real ? c.resultLive : c.resultNote}</p>
      </div>
    </section>}
    {menu && <div className="arena-menu"><section role="dialog" aria-label={c.settings}>
      <h2>{c.settings}</h2>
      {mode === 'online' && <Standings board={connection.board} c={c} />}
      <label>{c.sensitivity}<input type="range" min="0.5" max="1.5" step="0.05" defaultValue={settings.sensitivity}
        onChange={event => { settings.sensitivity = Number(event.target.value); }} /></label>
      <label className="is-check"><input type="checkbox" defaultChecked={settings.invertPitch} onChange={event => { settings.invertPitch = event.target.checked; }} />{c.invert}</label>
      <GraphicsPicker c={c} value={graphics} onPick={pickGraphics} />
      <label className="is-check"><input type="checkbox" defaultChecked={audio.enabled} onChange={event => { audio.enabled = event.target.checked; }} />{c.sound}</label>
      <p className="ap-keys">{c.keyboard}</p>
      <button className="ap-launch" onClick={() => { audio.ui(); setMenu(false); }}>{c.resume}</button>
      <button className="ap-leave" onClick={leave}>{c.leave}</button>
      <ModelCredits c={c} />
    </section></div>}
    {import.meta.env.DEV && <button className="arena-dev" onClick={() => { setDiagOpen(open => !open); }}>
      fps {Math.round(client.current?.metrics.fps ?? 0)} · {T.tickRate} Hz · tanı</button>}
    {import.meta.env.DEV && diagOpen && <pre className="arena-diag" data-last={diagLines}>{diag.lines.join('\n')}</pre>}
  </main>;
}

/** The ship a real flight takes, as the hangar left it: chosen, levelled and refilled there. */
function ShipLine({ c, desk, note }: { c: ArenaCopy; desk: HangarAnswer | null; note: string }) {
  if (!desk) return <p className="hg-wait" aria-busy>{c.hangarTitle} …</p>;
  if (!desk.ok) return <p className="hg-note" role="alert">{c.kicks[desk.error] ?? c.hangarError}</p>;
  const ship = desk.hangar.ship;
  return <>
    {ship && <p className="ap-ship"><span>{c.hangarTitle}</span><b>{c.classes[ship.class].name}</b><em>{c.level(ship.level)}</em></p>}
    {note && <p className="hg-note" role="alert">{note}</p>}
  </>;
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
