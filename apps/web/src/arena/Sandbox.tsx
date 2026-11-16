import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefCallback } from 'react';
import { ARENA_TUNING as T, FARM_POINTS, SHIP_CLASSES, TACTICS, alive, createInput, createSandboxWorld, holdPoints, sameSide, type ArenaWorld, type Pilot, type ShipClass,
  type SteeringSettings, type Tactic, type TeamView } from '@astera/rules/arena';
import { GameButton, Glyph, Slider, Toggle } from '../game-ui/index.js';
import { ClassPicker, TacticPicker } from './ClassPicker.js';
import { SortieSummary, launchText } from './Hangar.js';
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
import { FlightControls, aimKey } from './Controls.js';
import { ModelCredits } from './credits.js';
import { ArenaHud, type HudBind } from './Hud.js';
import { GAME_KEY, MOUSE_POINTER, ONE_PRESS_KEYS, createControls } from './input.js';
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
  const [tactic2, setTactic2] = useState<Tactic>(() => {
    try { const saved = localStorage.getItem(`${TACTIC_KEY}-2`); return TACTICS.find(t => t === saved && t !== storedTactic()) ?? (storedTactic() === 'cloak' ? 'smoke' : 'cloak'); }
    catch { return storedTactic() === 'cloak' ? 'smoke' : 'cloak'; }
  });
  const [world] = useState(() => createSandboxWorld({ ship, tactic, tactic2 }));
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
  // Owner 2026-10-27, the desktop: M opens the map, Tab holds the list up, a click in the sky takes the mouse.
  const [map, setMap] = useState(false);
  const [board, setBoard] = useState(false);
  const [mouse, setMouse] = useState(false);
  // While the wheel's button holds the ping wheel open, the mouse chooses a call and the ship flies on as it was.
  const pingHeld = useRef(false);
  const [tip, setTip] = useState(0);
  // The page needs the flight's phase. The HUD numbers change ten times a second; the page
  // re-rendering for them rebuilt everything under it, most of an S22 frame (V6g).
  const phase = useSyncExternalStore(store.subscribe, () => store.getSnapshot().phase, () => store.getSnapshot().phase);
  useEffect(() => {
    let armed = '';
    return store.subscribe(() => {
      const next = `${world.pilot.ship}:${world.pilot.tactic}:${world.pilot.tactic2}`;
      if (armed === next) return;
      armed = next; controls.setSignature(signatureMode(world)); controls.setTactic(world.pilot.tactic, world.pilot.tactic2);
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
      controls.setThrottle(world.pilot.throttle); controls.setSignature(signatureMode(world));
      controls.setTactic(world.pilot.tactic, world.pilot.tactic2); created.reset(); setScreen('flight');
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
    const clear = (): void => { controls.clear(); setBoard(false); };
    const hidden = (): void => { if (document.hidden) { clear(); audio.silence(); } };
    const down = (event: KeyboardEvent): void => {
      if (screen !== 'flight' || menu || event.target instanceof HTMLInputElement) return;
      if (event.code === 'Escape' && document.pointerLockElement) { document.exitPointerLock(); return; }
      if (event.code === 'Tab') event.preventDefault();
      if (event.repeat && ONE_PRESS_KEYS.includes(event.code)) return;
      if (event.code === 'KeyL') { event.preventDefault(); client.current?.land(); return; }
      if (event.code === 'KeyM') { event.preventDefault(); setMap(open => !open); return; }
      if (event.code === 'Tab') { setBoard(true); return; }
      if (aimKey(controls, store.getSnapshot(), event.code, performance.now())) { event.preventDefault(); return; }
      if (import.meta.env.DEV && event.altKey && event.code === 'KeyC') { event.preventDefault(); client.current?.toggleColliders(); return; }
      if (GAME_KEY.test(event.code)) { event.preventDefault(); controls.keyDown(event.code); }
    };
    const up = (event: KeyboardEvent): void => { if (event.code === 'Tab') setBoard(false); controls.keyUp(event.code); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', hidden);
    };
  }, [controls, audio, screen, menu, store]);

  // The desktop's mouse: it steers and fires only while the page holds the pointer; Esc (the
  // browser's own) lets it go, and with it the ship. A menu or the flight's end lets it go too.
  useEffect(() => {
    const changed = (): void => {
      const held = document.pointerLockElement !== null && document.pointerLockElement === canvas.current;
      controls.steerWithMouse(held); setMouse(held);
      if (!held) controls.actionUp('fire', MOUSE_POINTER, performance.now());
    };
    const move = (event: MouseEvent): void => { if (!pingHeld.current) controls.mouseMove(event.movementX, event.movementY); };
    const press = (event: MouseEvent): void => {
      if (event.button === 0 && controls.mouseSteering) controls.actionDown('fire', MOUSE_POINTER, event.timeStamp);
    };
    const release = (event: MouseEvent): void => { if (event.button === 0) controls.actionUp('fire', MOUSE_POINTER, event.timeStamp); };
    document.addEventListener('pointerlockchange', changed); document.addEventListener('mousemove', move);
    document.addEventListener('mousedown', press); document.addEventListener('mouseup', release);
    return () => {
      document.removeEventListener('pointerlockchange', changed); document.removeEventListener('mousemove', move);
      document.removeEventListener('mousedown', press); document.removeEventListener('mouseup', release);
    };
  }, [controls]);
  useEffect(() => {
    if ((screen !== 'flight' || menu) && document.pointerLockElement) document.exitPointerLock();
    if (screen !== 'flight') { setMap(false); setBoard(false); }
  }, [screen, menu]);

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
  // The launch's face: the action with its price and what pays it; or, grounded, why it cannot go.
  const launchFace: { line: string; note: string | null } = real && desk?.ok
    ? stillFlying(desk.hangar) ? { line: c.resumeFlight, note: null } : launchText(desk.hangar, now, c) : { line: c.launch, note: null };
  const pickTactic = (next: Tactic, second: Tactic): void => {
    audio.ui(); setTactic(next); setTactic2(second); world.pilot.tactic = next; world.pilot.tactic2 = second;
    try { localStorage.setItem(TACTIC_KEY, next); localStorage.setItem(`${TACTIC_KEY}-2`, second); } catch { /* As the class. */ }
  };
  /**
   * Owner 2026-10-27: on a desktop the flight takes the mouse with the very click that launched it
   * (the browser allows a pointer lock only inside a click). A touch screen never asks.
   */
  const takeMouse = (): void => {
    if (typeof matchMedia !== 'function' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    void Promise.resolve(canvas.current?.requestPointerLock()).catch(() => undefined);
  };
  /** A missile goes on one press; a shield or repair is aimed (input.ts). Q casts the signature; E and C cast the two tactics. */
  const arm = (): void => { controls.setSignature(signatureMode(world)); controls.setTactic(world.pilot.tactic, world.pilot.tactic2); };
  const launch = (reserved?: TeamView): void => {
    const party = reserved?.team?.joined && reserved.team.state === 'flying' ? reserved.team : null;
    if (grounded && !party) return;
    const member = party?.members.find(m => m.playerId === reserved?.playerId);
    audio.unlock(); audio.ui(true); setEnded(false); setDeskNote('');
    if (owned) { setShip(owned.class); world.pilot.ship = owned.class; }
    if (mode === 'online') network.connect(owned?.class ?? ship, member?.tactic ?? tactic, Boolean(member?.outcome), member ? member.tactic2 ?? null : tactic2);
    else Object.assign(world, createSandboxWorld({ ship: owned?.class ?? ship, tactic, tactic2, bots: T.practiceBots }));
    controls.setThrottle(0.5); arm();
    client.current?.reset();
    setScreen(member?.outcome ? 'spectate' : 'flight');
    if (!member?.outcome) takeMouse();
    if (root.current?.requestFullscreen && matchMedia('(pointer: coarse)').matches) void root.current.requestFullscreen().catch(() => undefined);
    const orientation: ScreenOrientation & { lock?: (value: 'portrait') => Promise<void> } = screenOrientation();
    if (orientation.lock) void orientation.lock('portrait').catch(() => undefined);
  };
  const again = (): void => {
    audio.ui(true); controls.clear(); setEnded(false);
    if (mode === 'online') network.dev('restart');
    else Object.assign(world, createSandboxWorld({ ship, tactic, tactic2, bots: T.practiceBots }));
    controls.setThrottle(0.5); arm();
    client.current?.reset();
    setScreen('flight'); takeMouse();
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
    network.connect(owned, tactic, false, tactic2);
    if (screen === 'preflight') {
      controls.setThrottle(world.pilot.throttle); controls.setSignature(signatureMode(world, owned)); controls.setTactic(world.pilot.tactic, world.pilot.tactic2);
      client.current?.reset(); setScreen('flight');
    }
  }, [real, desk, network, world, tactic, tactic2, screen, controls]);
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
    onPointerDown={event => {
      // A click in the sky takes the mouse for steering (desktop); a key, the menu or a finger never does.
      if (screen !== 'flight' || menu || mouse || event.pointerType !== 'mouse' || event.button !== 0
        || (event.target instanceof Element && event.target.closest('button,input,a,[role="dialog"],[role="slider"],[role="group"]'))) return;
      void Promise.resolve(canvas.current?.requestPointerLock()).catch(() => undefined);
    }}
    onPointerDownCapture={event => {
      const now = performance.now();
      if (screen !== 'flight' || !controls.aiming(now) || (event.target instanceof Element && event.target.closest('button,input,[role="dialog"]'))) return;
      // Under the mouse's lock the cursor is hidden: the click means the crosshair.
      const friend = mouse ? client.current?.friendAt(window.innerWidth / 2, window.innerHeight / 2) : client.current?.friendAt(event.clientX, event.clientY);
      if (friend === null || friend === undefined) return;
      controls.signatureAt(friend, now); event.preventDefault(); event.stopPropagation();
    }}>
    <canvas ref={canvas} className="arena-canvas" />
    {screen === 'flight' && <>
      <PingWheel c={c} aim={(x, y) => client.current?.aim(x, y) ?? null} locked={mouse} onHold={held => { pingHeld.current = held; }}
        onPing={(kind, target) => { if (target) { client.current?.ping(kind, target); audio.ui(true); } }} />
      <ArenaHud store={store} bind={bind} layout={world.layout} map={map} onMap={setMap} onMenu={() => { audio.ui(); controls.clear(); setMenu(true); }}
        connection={mode === 'online' ? <div className={`ah-link is-${connection.phase}`}>
          {connection.phase === 'online' ? <><i role="img" aria-label={c.live} /><span>{standingLine(connection.board, c)}</span><small>{connection.rtt} ms</small></>
            : connection.phase === 'failed' ? <><span>{c.kicks[connection.reason] ?? c.connectionFailed}</span>
              {/* Reconnecting cannot help a refusal or an outdated page. */}
              {connection.reason !== 'denied' && connection.reason !== 'version' && <button onClick={() => { network.connect(ship, tactic, false, tactic2); }}>{c.reconnect}</button>}</>
              : <span>{connection.phase === 'reconnecting' ? c.reconnecting : c.connecting}</span>}
        </div> : null} />
      <FlightControls controls={controls} store={store} nameOf={id => pilotName(id, c, world, network)}
        onLand={() => { if (client.current?.land()) audio.ui(true); }} onCancel={() => { client.current?.cancelLanding(); audio.ui(); }} />
      {!mouse && !menu && <p className="arena-mouse-hint">{c.mouseHint}</p>}
      {board && <div className="arena-board-peek" role="dialog" aria-label={c.standings}>
        {mode === 'online' && connection.board.length > 0 ? <Standings board={connection.board} c={c} />
          : <header><p className="gk-label">{c.standings}</p><small className="gk-sub">{c.practiceBoard}</small></header>}
        <p className="gk-label">{c.keysTitle}</p>
        <dl className="ab-keys">{c.keyList.map(([key, what]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{what}</dd></div>)}</dl>
      </div>}
    </>}
    {screen === 'spectate' && connection.teamId && <SpectatorPanel world={world} store={store} network={network} teamId={connection.teamId}
      watching={connection.watching} onResults={() => { setScreen('result'); }} />}
    {screen === 'spectate' && !connection.teamId && <section className="arena-spectator gk gk-arenacard gk-watch">
      <p role="status" className="gk-watch__status">{connection.phase === 'failed' ? c.connectionFailed : c.connecting}</p>
      <div className="gk-watch__acts"><GameButton size="sm" glyph="back" onPress={() => { setScreen('result'); }}>{teamCopy().results}</GameButton></div>
    </section>}
    {screen === 'loading' && <section className="arena-loading gk">
      <div className="gk-arenahead"><span className="gk-arenahead__brand">ASTERA</span><p className="gk-display gk-arenahead__title">{c.brand}</p></div>
      <div className="gk-arenaload">
        <p className="gk-sub">{warming ? c.stages.shaders : c.stages[progress.stage]}</p>
        <strong className="gk-num">{warming ? 100 : percent}%</strong>
        <i aria-hidden><b style={{ transform: `scaleX(${String(warming ? 1 : percent / 100)})` }} /></i>
      </div>
      {loadFailed ? <div className="gk-arenaload__failed" role="alert">
        <p className="gk-inote" data-tone="warn"><Glyph id="warn" /><span>{c.loadFailed}</span></p>
        <GameButton tone="action" size="lg" wide glyph="refresh" onPress={() => { setLoadFailed(false); setProgress({ done: 0, total: 1, stage: 'manifest' }); setLoadTry(n => n + 1); }}>{c.loadRetry}</GameButton>
        <GameButton size="sm" tone="ghost" glyph="home" className="gk-arenadock__leave" onPress={leave}>{c.leave}</GameButton>
      </div> : <p className="gk-sub gk-arenaload__tip">{c.tips[tip % c.tips.length]}</p>}
    </section>}
    {screen === 'preflight' && <section className="arena-preflight gk">
      <header className="gk-arenahead"><span className="gk-arenahead__brand">ASTERA</span><h1 className="gk-display gk-arenahead__title">{c.brand}</h1>
        <small className="gk-label gk-arenahead__sector">{c.sector}</small></header>
      <div className="gk-arenadock">
        <LoopLine c={c} />
        {/* The first decision: what the flight is worth; the rest of the desk follows from it. */}
        <ModePicker c={c} mode={mode} lock={coreLock} onPick={value => { audio.ui(); setMode(value); }} />
        {real ? <ShipLine c={c} desk={desk} note={deskNote} /> : <ClassPicker c={c} value={ship} onPick={pickShip} />}
        {!(real && inLobby) && <div className="gk-arenapanel"><TacticPicker c={c} value={tactic} value2={tactic2} ship={owned?.class ?? ship} points={owned?.abilities ?? {}} onPick={pickTactic} /></div>}
        {/* Whatever keeps a real flight on the ground names itself here; the hangar is where it is put right. */}
        {real && <div className="gk-arenapanel"><TeamPanel credential={hangarToken} onEnter={launch} onView={setTeamView} {...room} /></div>}
        {/* In a team lobby the team's own presses launch; the desk only says who starts it. */}
        {real && inLobby && <p className="gk-inote gk-inote--plate"><Glyph id="support" /><span>{teamCopy().teamLaunch}</span></p>}
        {(!real || desk?.ok) && !(real && inLobby) && <GameButton tone="action" size="lg" wide glyph="rocket" className="ap-launch" heavy={real}
          disabledReason={grounded ? launchFace.line : null} {...(launchFace.note ? { detail: launchFace.note } : {})}
          onPress={() => { launch(); }}>{launchFace.line}</GameButton>}
        <GameButton size="sm" tone="ghost" glyph="back" className="gk-arenadock__leave" onPress={leave}>{c.leave}</GameButton>
        <p className="gk-note gk-arenadock__keys">{c.keyboard}</p>
      </div>
    </section>}
    {screen === 'result' && <section className="arena-result gk">
      <div className="gk-arenacard" data-tone={result === 'extracted' ? 'self' : result === 'dead' ? 'hostile' : 'warn'}>
        <p className="gk-label">{c.brand}</p>
        <h2 className="gk-display gk-arenacard__title">{c[result]}</h2>
        {what && <p className="gk-arenacard__what" data-debrief={what.kind}><span className="gk-label">{c.debrief.title}</span>{debriefText(what, c, id => pilotName(id, c, world, network))}</p>}
        {real ? <SortieSummary c={c} report={connection.sortie} hold={flown} now={now} /> : flownPoints > 0 && <>
          <p className="gk-arenacard__points" data-tone={result === 'extracted' ? 'self' : 'hostile'}>
            <strong className="gk-num">{result === 'extracted' ? '+' : '−'}{flownPoints}</strong> {c.pointsShort}
            {result !== 'extracted' && <small> {c.lostPoints}</small>}
          </p>
          <ul className="gk-haul">{flown.map((units, kind) => Math.floor(units) > 0 && <li key={kind} className="gk-haulchip" style={{ '--tone': FARM_TONE[kind] } as React.CSSProperties}>
            <i aria-hidden /><b className="gk-num">{Math.floor(units)}</b> {c.kinds[kind]} <small>×{FARM_POINTS[kind]}</small></li>)}</ul>
        </>}
        {/* What the ending meant for the hold: nothing is said scattered or left behind when nothing was carried. */}
        {!(real && result === 'extracted') && what?.kind !== 'recalled' && <p className="gk-sub">{result === 'extracted' ? flownPoints > 0 ? c.extractedHint : c.emptyHint
          : flownPoints > 0 ? result === 'dead' ? c.deadHint : c.towedHint : c.emptyLoss}</p>}
        <dl className="gk-figures gk-arenacard__stats">
          {!real && <div className="gk-figure"><dt className="gk-label">{c.delivered}</dt><dd className="gk-num gk-figure__value">{result === 'extracted' ? flownPoints : 0}</dd></div>}
          <div className="gk-figure"><dt className="gk-label">{c.hits}</dt><dd className="gk-num gk-figure__value">{status.hits}</dd></div>
          <div className="gk-figure"><dt className="gk-label">{c.kills}</dt><dd className="gk-num gk-figure__value">{status.kills}</dd></div>
        </dl>
        {mode === 'online' && <Standings board={connection.board} c={c} />}
        {real && <div className="gk-arenapanel"><TeamPanel credential={hangarToken} claimsOnly {...room} /></div>}
        {connection.teamId && connection.watching !== null && <GameButton wide glyph="eye" onPress={() => { setScreen('spectate'); }}>{teamCopy().watch}</GameButton>}
        {/* After a real flight the ship rests: the hangar's clock says when it flies again. */}
        {real ? <GameButton tone="action" size="lg" wide glyph="back" onPress={leave}>{c.backToHangar}</GameButton>
          : <GameButton tone="action" size="lg" wide glyph="rocket" detail={`${c.returning} ${String(countdown)} ${c.seconds}`} onPress={again}>{c.retry}</GameButton>}
        <GameButton size="sm" tone="ghost" glyph="home" className="gk-arenadock__leave" onPress={leave}>{c.leave}</GameButton>
        <p className="gk-note gk-arenadock__keys">{real ? c.resultLive : c.resultNote}</p>
      </div>
    </section>}
    {menu && <div className="arena-menu gk"><section role="dialog" aria-label={c.settings} className="gk-arenacard">
      <h2 className="gk-display gk-arenacard__title">{c.settings}</h2>
      {mode === 'online' && <Standings board={connection.board} c={c} />}
      <FlightSettings c={c} settings={settings} audio={audio} graphics={graphics} onGraphics={pickGraphics} />
      <p className="gk-note gk-arenadock__keys">{c.keyboard}</p>
      <GameButton tone="action" size="lg" wide glyph="rocket" onPress={() => { audio.ui(); setMenu(false); takeMouse(); }}>{c.resume}</GameButton>
      <GameButton size="sm" tone="ghost" glyph="home" className="gk-arenadock__leave" onPress={leave}>{c.leave}</GameButton>
      <ModelCredits c={c} />
    </section></div>}
    {import.meta.env.DEV && <button className="arena-dev" onClick={() => { setDiagOpen(open => !open); }}>
      fps {Math.round(client.current?.metrics.fps ?? 0)} · {T.tickRate} Hz · tanı</button>}
    {import.meta.env.DEV && diagOpen && <pre className="arena-diag" data-last={diagLines}>{diag.lines.join('\n')}</pre>}
  </main>;
}

/** The settings over a flight: the steering's feel, the picture's cost and the sound, each a kit control that acts at once. */
function FlightSettings({ c, settings, audio, graphics, onGraphics }: {
  c: ArenaCopy; settings: SteeringSettings; audio: { enabled: boolean }; graphics: ArenaGraphicsChoice; onGraphics: (choice: ArenaGraphicsChoice) => void;
}) {
  const [sensitivity, setSensitivity] = useState(() => Math.round(settings.sensitivity * 100));
  const [invert, setInvert] = useState(settings.invertPitch);
  const [sound, setSound] = useState(audio.enabled);
  return <>
    <div className="gk-arenaset">
      <p className="gk-label">{c.sensitivity}</p>
      <Slider label={c.sensitivity} value={sensitivity} min={50} max={150} step={5} readout={`×${(sensitivity / 100).toFixed(2)}`}
        onChange={next => { setSensitivity(next); settings.sensitivity = next / 100; }} />
    </div>
    <Toggle checked={invert} label={c.invert} onChange={next => { setInvert(next); settings.invertPitch = next; }} />
    <GraphicsPicker c={c} value={graphics} onPick={onGraphics} />
    <Toggle checked={sound} label={c.sound} onChange={next => { setSound(next); audio.enabled = next; }} />
  </>;
}

/** The ship a real flight takes, as the hangar left it: chosen, levelled and refilled there. */
function ShipLine({ c, desk, note }: { c: ArenaCopy; desk: HangarAnswer | null; note: string }) {
  if (!desk) return <p className="gk-sub gk-shipline" aria-busy>{c.hangarTitle} …</p>;
  if (!desk.ok) return <p className="gk-inote gk-shipline" data-tone="warn" role="alert"><Glyph id="warn" /><span>{c.kicks[desk.error] ?? c.hangarError}</span></p>;
  const ship = desk.hangar.ship;
  return <>
    {ship && <p className="gk-arenapanel gk-shipline"><span className="gk-label">{c.hangarTitle}</span><b className="gk-display">{c.classes[ship.class].name}</b>
      <span className="gk-chip gk-num">{c.level(ship.level)}</span></p>}
    {note && <p className="gk-inote" data-tone="warn" role="alert"><Glyph id="warn" /><span>{note}</span></p>}
  </>;
}

/** The A slot as the flight flies it: a shield or repair is aimed, at whichever friend lives now (input.ts). */
function signatureMode(world: ArenaWorld, ship: ShipClass = world.pilot.ship) {
  return { aimed: ship !== 'akinci', self: () => world.pilot.id,
    friends: () => world.drones.filter(drone => drone.decoyOf < 0 && alive(drone) && sameSide(world.pilot, drone)).length };
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
  return <section className="gk-arenaboard" aria-label={c.standings}>
    <header><p className="gk-label">{c.standings}</p><small className="gk-sub">{c.standingsRule}</small></header>
    <table>
      <thead><tr><th scope="col">#</th><th scope="col" /><th scope="col">{c.pointsCol}</th><th scope="col">{c.killsCol}</th><th scope="col">{c.deathsCol}</th></tr></thead>
      <tbody>{board.map((row, i) => <tr key={row.id} {...(row.self ? { 'data-self': '' } : {})}>
        <td className="gk-num">{i + 1}</td><td>{row.self ? `${row.name} · ${c.you}` : row.name}</td><td className="gk-num">{row.points}</td><td className="gk-num">{row.kills}</td><td className="gk-num">{row.deaths}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function screenOrientation(): ScreenOrientation & { lock?: (value: 'portrait') => Promise<void> } {
  return screen.orientation;
}
