import { vesselLook, type VesselLook, type VesselModule, type VesselSystem } from '@astera/rules';
import { useEffect, useRef, useState } from 'react';
import type { VesselView } from '../../api/starterSchemas.js';
import { hullName } from '../../i18n/names.js';
import { moduleName } from '../moduleName.js';
import { REVEAL_FLEETS_MS } from '../tutorial/sightLesson.js';
import { playScene, useDirector, type Scene } from './director.js';
import { contactScene, probeScene, rockScene, scenesFor, yardNeedScene, type ShipState } from './scenes.js';

/** Before the first look is taken: the galaxy's own opening flight settles first. */
export const FIRST_LOOK_MS = 1_200;

const stateOf = (ship: VesselView): ShipState => ({
  modules: ship.modules,
  queue: ship.queue,
  look: vesselLook({ modules: ship.modules, facts: ship.facts }),
  facts: ship.facts,
});

const has = (state: ShipState | null, module: string, stage = 1): boolean => (state?.modules[module] ?? 0) >= stage;
const asked = (state: ShipState | null, module: string): boolean => state?.queue.some(order => order.subject === module) ?? false;

/**
 * When a scene's moment has gone (owner 2026-11-18: past moments played in a burst after a page was
 * closed): the repair it shows done, the yard it asks for ordered, the dark lit, the contact gone.
 */
function withMoment(scene: Scene, now: () => { state: ShipState | null; contact: string | null; mined: boolean }): Scene {
  const work = /^repair:([A-Z_]+):(\d+):work$/u.exec(scene.id);
  if (work) {
    const [, module = '', stage = '1'] = work;
    return { ...scene, stale: () => has(now().state, module, Number(stage)) };
  }
  if (scene.id === 'yardNeed') return { ...scene, stale: () => has(now().state, 'SHIPYARD') || asked(now().state, 'SHIPYARD') };
  if (scene.id === 'dark') return { ...scene, stale: () => has(now().state, 'TELESCOPE') || asked(now().state, 'TELESCOPE') };
  if (scene.id === 'rock') return { ...scene, stale: () => now().mined };
  if (scene.id === 'contact') {
    const contact = now().contact;
    return { ...scene, stale: () => now().contact !== contact };
  }
  return scene;
}

const MODULES = new Set<string>(['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT', 'VAULT', 'SURVEY', 'SHIPYARD', 'HANGAR', 'TELESCOPE', 'RADAR', 'AEGIS']);
const isModule = (module: string): module is VesselModule => MODULES.has(module);
const nameOf = (module: string): string => (isModule(module) ? moduleName(module) : hullName(module) ?? module);

/**
 * WHERE THE SHIP'S CHANGES BECOME SCENES (plan 2026-11-18 §5). The ship is read as it changes; a repair
 * of the road ordered from the ship's page closes the page, so it is seen being done on the hull; the
 * first rock is come close to once the telescope's sky has landed, and the first radar return turned to;
 * the yard is shown empty while the probe is out, and the probe's report turned to as it comes home.
 */
export function useStarterScenes({ ship, shipOpen, onCloseShip, nearestRockId, unknownContactId, probing, probeTarget, onAwaken }: {
  ship: VesselView | undefined;
  /** The ship's own page is open over the galaxy. */
  shipOpen: boolean;
  onCloseShip: () => void;
  /** The rock a Prospector would go to first, once the telescope has shown the field. */
  nearestRockId: string | null;
  /** A radar return nobody has named yet. */
  unknownContactId: string | null;
  /** A probe of this ship's is out. */
  probing: boolean;
  /** The ship the latest probe report read, once it is home. */
  probeTarget: { id: string; name: string } | null;
  /** The bay of a system that has just come back, beating. */
  onAwaken: (system: VesselSystem, module?: VesselModule) => void;
}): VesselLook | undefined {
  const seen = useRef<{ id: string; state: ShipState } | null>(null);
  /** The look the hull shows: kept as it was while a scene that will show it turning waits for its shot. */
  const [shown, setShown] = useState<VesselLook | null>(null);
  const holding = useRef(false);
  const id = ship?.id;
  const state = ship ? stateOf(ship) : null;
  const key = state ? JSON.stringify(state) : '';
  const mined = ship ? ship.facts.includes('FIRST_MINING_SENT') || ship.facts.includes('FIRST_MINING_RETURN') : true;
  const latest = useRef({ state, shipOpen, onCloseShip, contact: unknownContactId, mined });
  latest.current = { state, shipOpen, onCloseShip, contact: unknownContactId, mined };
  const moment = useRef(() => latest.current);
  /** Asks for a scene, knowing when its moment has gone. */
  const play = useRef((scene: Scene, vesselId: string): boolean => playScene(withMoment(scene, moment.current), vesselId));
  /** The probe's first report came home during this visit: it is turned to once the report itself is here. */
  const [reportHome, setReportHome] = useState(false);

  useEffect(() => {
    const now = latest.current.state;
    if (!id || !now) return undefined;
    const before = seen.current?.id === id ? seen.current.state : null;
    if (before === null) {
      // The first look at a ship waits for the galaxy's opening flight to land. The ship counts as seen
      // only when it is looked at: an effect run twice (strict mode) must not use up its first look.
      const timer = window.setTimeout(() => {
        const first = latest.current.state ?? now;
        seen.current = { id, state: first };
        setShown(first.look);
        for (const scene of scenesFor(null, first, nameOf)) play.current(scene, id);
      }, FIRST_LOOK_MS);
      return () => { window.clearTimeout(timer); };
    }
    seen.current = { id, state: now };
    if (!before.facts.includes('FIRST_PROBE_REPORT') && now.facts.includes('FIRST_PROBE_REPORT')) setReportHome(true);
    const scenes = scenesFor(before, now, nameOf);
    // A repair ordered from the ship's page is watched on the hull: the page steps aside for it.
    if (scenes.some(scene => scene.id.endsWith(':work')) && latest.current.shipOpen) latest.current.onCloseShip();
    let turning = false;
    for (const scene of scenes) {
      // The hull keeps its old look for a scene that will show it turning, and only for one that plays.
      if (play.current(scene, id) && scene.beats.some(beat => beat.id === 'hull')) turning = true;
    }
    if (turning) holding.current = true;
    if (!holding.current) setShown(now.look);
    return undefined;
  }, [id, key]);

  const telescope = (ship?.modules.TELESCOPE ?? 0) >= 1;
  useEffect(() => {
    if (!id || mined || !telescope || nearestRockId === null) return undefined;
    // The sky lands first (the reveal), then the camera goes to the rock.
    const timer = window.setTimeout(() => { play.current(rockScene(nearestRockId), id); }, REVEAL_FLEETS_MS);
    return () => { window.clearTimeout(timer); };
  }, [id, mined, telescope, nearestRockId]);

  const radar = (ship?.modules.RADAR ?? 0) >= 1;
  useEffect(() => {
    if (!id || !radar || unknownContactId === null) return;
    play.current(contactScene({ kind: 'contact', id: unknownContactId }), id);
  }, [id, radar, unknownContactId]);

  const target = probeTarget?.id;
  const targetName = probeTarget?.name;
  useEffect(() => {
    if (!id || !reportHome || target === undefined || targetName === undefined) return;
    play.current(probeScene({ id: target, name: targetName }), id);
    setReportHome(false);
  }, [id, reportHome, target, targetName]);

  // The yard is shown empty while the probe it would follow is out, and only before it is asked for.
  const yardDue = ship !== undefined && probing && (ship.modules.SURVEY ?? 0) >= 1 && (ship.modules.SHIPYARD ?? 0) < 1
    && !ship.queue.some(order => order.subject === 'SHIPYARD');
  useEffect(() => {
    if (!id || !yardDue) return;
    play.current(yardNeedScene(), id);
  }, [id, yardDue]);

  // The bay of a repair that came back beats as the camera reaches it.
  const playing = useDirector();
  const beat = playing?.beat;
  useEffect(() => {
    if (beat?.awaken) onAwaken(beat.awaken.system, beat.awaken.module);
    if (beat?.id === 'hull') {
      holding.current = false;
      setShown(latest.current.state?.look ?? null);
    }
  }, [beat, onAwaken]);

  // A change not read yet keeps the look the hull had: the scene that shows it decides when it turns.
  return state ? (shown ?? state.look) : undefined;
}
