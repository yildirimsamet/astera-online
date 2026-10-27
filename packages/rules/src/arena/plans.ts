import type { Blueprint } from './blueprints.js';

/**
 * The Rift's kit buildings (16-yarik-v6-plani §7), in the plan frame: metres, +Z the plan's
 * front (the layout turns it to face the heart). Kit ports (brief 4): corridor ±40 Z, room ±60 on
 * X and Z, mouth −20 Z (its open end at +40 Z), tee ±140 Z and +140 X, cap 0 facing +Z, collapsed room
 * ±60 Z, broken corridor ±40 Z (its breach at +45 X), hall (±60, 0, ±60) along Z and
 * (−60, 80, 0) up, hangar −80 Z (its maw at +80 Z), tower and tower top ±60 Y and +60 Z (the
 * top's upper well is a way in, not a port). Dressing (antenna, radiator, tank cluster, solar
 * stub) has no ports: it stands on a roof, its origin at its base, sunk 2 m into the roof's
 * 10 m skin (roof tops: room 60, corridor and tee 45, hall 70).
 */
export const PLANS = {
  /**
   * Karakol: a farm room (ore veins, a cargo point) between two corridors, a mouth at each end,
   * the room's side ports capped. Whoever farms inside always has a back door.
   */
  outpost: { key: 'outpost', pieces: [
    { key: 'kit_room', at: [0, 0, 0], turn: 0 },
    { key: 'kit_corridor', at: [0, 0, 100], turn: 0 },
    { key: 'kit_mouth', at: [0, 0, 160], turn: 0 },
    { key: 'kit_corridor', at: [0, 0, -100], turn: 0 },
    { key: 'kit_mouth', at: [0, 0, -160], turn: 2 },
    { key: 'kit_cap', at: [60, 0, 0], turn: 3 },
    { key: 'kit_cap', at: [-60, 0, 0], turn: 1 },
    { key: 'kit_dressing_antenna', at: [20, 58, -20], turn: 0 },
    { key: 'kit_dressing_radiator', at: [0, 43, 100], turn: 0 },
    { key: 'kit_dressing_tank_cluster', at: [0, 43, -100], turn: 1 },
  ] },
  /**
   * Harabe karakol: the outer outposts, half fallen in. A collapsed room (two veins, no side
   * ports) between a breached corridor and a whole one: the breach is a third way in.
   */
  outpostRuin: { key: 'outpostRuin', pieces: [
    { key: 'kit_room_collapsed', at: [0, 0, 0], turn: 0 },
    { key: 'kit_corridor_broken', at: [0, 0, 100], turn: 0 },
    { key: 'kit_mouth', at: [0, 0, 160], turn: 0 },
    { key: 'kit_corridor', at: [0, 0, -100], turn: 0 },
    { key: 'kit_mouth', at: [0, 0, -160], turn: 2 },
    { key: 'kit_dressing_solar_stub', at: [-20, 58, 0], turn: 0 },
    { key: 'kit_dressing_antenna', at: [0, 43, -100], turn: 1 },
  ] },
  /**
   * Liman eki: Sessiz Liman's annex. A tee from its front mouth: one arm to a farm room with its
   * own mouth, the other through a collapsed room and a breached corridor to a back mouth. Three
   * ways in, a breach, two farm rooms.
   */
  annex: { key: 'annex', pieces: [
    { key: 'kit_tee', at: [0, 0, 0], turn: 0 },
    { key: 'kit_mouth', at: [0, 0, 160], turn: 0 },
    { key: 'kit_room_collapsed', at: [0, 0, -200], turn: 0 },
    { key: 'kit_corridor_broken', at: [0, 0, -300], turn: 0 },
    { key: 'kit_mouth', at: [0, 0, -360], turn: 2 },
    { key: 'kit_room', at: [200, 0, 0], turn: 0 },
    { key: 'kit_cap', at: [200, 0, 60], turn: 2 },
    { key: 'kit_cap', at: [200, 0, -60], turn: 0 },
    { key: 'kit_mouth', at: [280, 0, 0], turn: 1 },
    { key: 'kit_dressing_tank_cluster', at: [0, 43, -80], turn: 0 },
    { key: 'kit_dressing_antenna', at: [200, 58, 0], turn: 0 },
    { key: 'kit_dressing_solar_stub', at: [0, 58, -200], turn: 1 },
  ] },
  /**
   * Tersane deposu: a farm hall with a mouth to the heart, a hangar out the back and a lookout
   * on its roof (a mouth and the top well). Four ways in at three heights, as a refinery's,
   * one storey lower.
   */
  depot: { key: 'depot', pieces: [
    { key: 'kit_hall', at: [0, 0, 0], turn: 0 },
    { key: 'kit_corridor', at: [60, 0, 100], turn: 0 },
    { key: 'kit_mouth', at: [60, 0, 160], turn: 0 },
    { key: 'kit_cap', at: [-60, 0, 60], turn: 2 },
    { key: 'kit_hangar', at: [-60, 0, -140], turn: 2 },
    { key: 'kit_cap', at: [60, 0, -60], turn: 0 },
    { key: 'kit_tower_top', at: [-60, 140, 0], turn: 0 },
    { key: 'kit_mouth', at: [-60, 140, 80], turn: 0 },
    { key: 'kit_dressing_radiator', at: [60, 68, -25], turn: 0 },
    { key: 'kit_dressing_tank_cluster', at: [60, 68, 30], turn: 2 },
  ] },
  /**
   * Rafineri: a wing of the heart's complex. A farm hall (six veins, three cargo bays) with a
   * mouth to the heart, a hangar out the back, and a two-storey tower on its roof with a mouth on
   * each storey and a well at the top: four ways in at three heights.
   */
  refinery: { key: 'refinery', pieces: [
    { key: 'kit_hall', at: [0, 0, 0], turn: 0 },
    { key: 'kit_corridor', at: [60, 0, 100], turn: 0 },
    { key: 'kit_mouth', at: [60, 0, 160], turn: 0 },
    { key: 'kit_cap', at: [-60, 0, 60], turn: 2 },
    { key: 'kit_hangar', at: [-60, 0, -140], turn: 2 },
    { key: 'kit_cap', at: [60, 0, -60], turn: 0 },
    { key: 'kit_tower', at: [-60, 140, 0], turn: 0 },
    { key: 'kit_corridor', at: [-60, 140, 100], turn: 0 },
    { key: 'kit_mouth', at: [-60, 140, 160], turn: 0 },
    { key: 'kit_tower_top', at: [-60, 260, 0], turn: 0 },
    { key: 'kit_mouth', at: [-60, 260, 80], turn: 0 },
    { key: 'kit_dressing_radiator', at: [60, 68, -25], turn: 0 },
    { key: 'kit_dressing_tank_cluster', at: [60, 68, 30], turn: 2 },
  ] },
} as const satisfies Record<string, Blueprint>;
