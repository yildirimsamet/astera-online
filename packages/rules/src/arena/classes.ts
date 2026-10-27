import type { Capsule } from './hull.js';
import { ARENA_TUNING, type FlightTuning } from './tuning.js';

/** Order is the wire index (`packPilot`) and the asset manifest's. */
export const SHIP_CLASSES = ['akinci', 'muhafiz', 'kilavuz'] as const;
export type ShipClass = typeof SHIP_CLASSES[number];
export type ClassStats = Pick<FlightTuning, 'speedMax' | 'turnRateMax' | 'hull' | 'damage' | 'fireRate' | 'spreadBase' | 'fuelTank'
  | 'cargoCapacity' | 'ammoCapacity'>;

const DEG = Math.PI / 180;
/** Owner 2026-10-24: accuracy starts a little worse; every class's cone is 15 % wider at level one. */
const WIDER = 1.15;
/**
 * Y4 (plan 14 §3.1), owner 2026-10-23: the plan's ratios scaled to the ship of today, which is the
 * Kılavuz; the Akıncı is the fastest at the KG-X25 cap. Turbo doubles each one's own speed; the
 * magazine is 60 s of fire. Owner 2026-10-27: every hull 50 % stronger ("gemiler biraz çabuk ölüyor").
 * At 60 % hits: Akıncı mirror 7.3 s, Kılavuz 12.5 s, Muhafız 15.2 s.
 */
export const CLASS_STATS: Readonly<Record<ShipClass, Readonly<ClassStats>>> = Object.freeze({
  akinci: Object.freeze({ speedMax: 80, turnRateMax: 82 * DEG, hull: 510, damage: 13, fireRate: 9, spreadBase: 1.3 * DEG * WIDER, fuelTank: 220,
    cargoCapacity: 300, ammoCapacity: 540 }),
  muhafiz: Object.freeze({ speedMax: 60, turnRateMax: 58 * DEG, hull: 900, damage: 18, fireRate: 5.5, spreadBase: 1.8 * DEG * WIDER, fuelTank: 280,
    cargoCapacity: 500, ammoCapacity: 330 }),
  kilavuz: Object.freeze({ speedMax: 72, turnRateMax: ARENA_TUNING.turnRateMax, hull: ARENA_TUNING.hull, damage: ARENA_TUNING.damage,
    fireRate: ARENA_TUNING.fireRate, spreadBase: ARENA_TUNING.spreadBase * WIDER, fuelTank: ARENA_TUNING.fuelTank,
    cargoCapacity: ARENA_TUNING.cargoCapacity, ammoCapacity: ARENA_TUNING.ammoCapacity }),
});

const capsule = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): Readonly<Capsule> =>
  Object.freeze({ ax, ay, az, bx, by, bz, r });
/** A capsule on the right (+X) and its mirror on the left. */
const pair = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): Readonly<Capsule>[] =>
  [capsule(ax, ay, az, bx, by, bz, r), capsule(-ax, ay, az, -bx, by, bz, r)];
/**
 * Y4b (plan 14 §8): each class's hull, fitted by tools/arena-hulls.mjs to its LOD0 surface at 15 m
 * (nose +Z, metres): the least volume with no point of the model more than 0.45 m outside it,
 * no capsule thinner than 0.7 m. A fuselage plus two mirrored pairs; a pair whose ends meet is a ball.
 */
export const CLASS_HULLS: Readonly<Record<ShipClass, readonly Readonly<Capsule>[]>> = Object.freeze({
  // Wide flat body tapering to the nose, side intakes, two tail fins.
  akinci: Object.freeze([capsule(0, 0.19, -4.48, 0, 0.19, 6.16, 1.79), ...pair(2.46, 0.22, 2.29, 3.28, -0.23, -1.83, 0.85),
    ...pair(1.96, -0.1, -6.24, 1.96, -0.1, -6.24, 0.82)]),
  // Narrow nose, a broad engine block aft (the two tanks), short canards amidships.
  muhafiz: Object.freeze([capsule(0, 0.1, -2.58, 0, 0.1, 5.42, 1.85), ...pair(3.08, -0.14, -3.13, 2.54, 0.09, -5.41, 2.41),
    ...pair(3.5, -0.21, 0.23, 3.52, -0.19, 0.25, 1.39)]),
  // Slim fuselage, forward-swept wings out to 8.9 m, a broad tail block.
  kilavuz: Object.freeze([capsule(0, -0.68, -6.4, 0, -0.68, 5.95, 1.28), ...pair(4.94, -1.62, -0.7, 7.99, -1.92, 3.47, 1.02),
    ...pair(3.06, -0.38, -2.07, 3.01, -0.6, -4.23, 2.44)]),
});

const tuned = (ship: ShipClass): Readonly<FlightTuning> => Object.freeze({ ...ARENA_TUNING, ...CLASS_STATS[ship], capsules: CLASS_HULLS[ship] });
const TUNINGS: Readonly<Record<ShipClass, Readonly<FlightTuning>>> = { akinci: tuned('akinci'), muhafiz: tuned('muhafiz'), kilavuz: tuned('kilavuz') };
/** The arena tuning as one class flies it. */
export const classTuning = (ship: ShipClass): Readonly<FlightTuning> => TUNINGS[ship];
