import { probeAccuracy } from '../intel.js';
import type { SensorSphere } from '../sight.js';
import type { Vec3 } from '../types.js';
import { STARTER } from './constants.js';

const rung = (ladder: readonly number[], stage: number): number =>
  ladder[Math.max(0, Math.min(stage, ladder.length - 1))] ?? 0;

/**
 * A SHIP'S EYES, IN THE MAIN SENSOR RULE'S SHAPE. `sensorZone` runs untouched. The radii are this
 * galaxy's own: the main game's Telescope 1 already sees 2137 units, nearly all of this galaxy, and
 * nobody learns what a telescope is worth from one that sees everything.
 */
export const vesselSphere = (at: Vec3, telescopeStage: number, radarStage: number, id?: string): SensorSphere => ({
  ...(id === undefined ? {} : { planetId: id }),
  at,
  identify: Math.max(STARTER.nakedEye, rung(STARTER.telescope, telescopeStage)),
  detect: rung(STARTER.radar, radarStage),
});

/**
 * ONE RUNG BELOW THE ANTENNA'S STAGE, because accuracy stops at 0.80 and the stage read directly
 * would make the third repair buy almost nothing. The band is about 2.6 / 2.0 / 1.5 times the true
 * value wide, so a player sees why a better antenna is worth having. Plan §3.5.
 */
export const vesselProbeAccuracy = (surveyStage: number): number => probeAccuracy(surveyStage - 1, 0);
