import { ALL_HULLS, type Fleet, type SensorSphere } from '@astera/rules';
import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import type { Contact } from '../../api/schemas.js';
import { shipHullModels } from '../../galaxy/shipCosmetics.js';
import { serverNow } from '../../lib/clock.js';
import { useDirector } from './director.js';
import { RADAR_LESSON, lessonBearing, lessonFlight, stagedChangeIn, stagedContact, type LessonFlight } from './radarLesson.js';
import { RADAR_LESSON_SCENE } from './scenes.js';

/**
 * THE RADAR LESSON'S CONTACT, RIDING ITS SCENE (owner phone playtest 2026-11-18, item 28). It is laid on
 * the ship's first sensor as the scene starts, on the ship's own line (the one its camera looks across), and
 * waits there, still, while both spheres are shown; it moves once the camera has come round to its side,
 * and a hurried shot puts it straight into the telescope's sphere. After the scene it flies on out of the
 * radar's reach, and is gone. Each showing of the scene flies its own.
 */
export function useRadarLessonContact(sensor: SensorSphere | undefined): Contact | null {
  const playing = useDirector();
  const beat = playing?.scene.id === RADAR_LESSON_SCENE ? playing.beat.id : null;
  const vesselId = playing?.vesselId ?? '';
  // This showing of the scene: its first shot's key.
  const showing = playing && beat !== null ? playing.key - playing.index : null;
  const [run, setRun] = useState<{ flight: LessonFlight; since: number | null; born: number; showing: number } | null>(null);
  const [, redraw] = useState(0);
  const heard = sensor !== undefined && sensor.detect > sensor.identify;
  // A formation's first draw waits on its models: fetched as the scene starts, they are there the moment it is seen.
  useEffect(() => {
    if (showing === null) return;
    const fleet: Fleet = RADAR_LESSON.fleet;
    for (const hull of ALL_HULLS) {
      if ((fleet[hull] ?? 0) <= 0) continue;
      const { model, lodModel } = shipHullModels(hull);
      useGLTF.preload(model, false);
      useGLTF.preload(lodModel, false);
    }
  }, [showing]);
  useEffect(() => {
    if (beat === null || showing === null || !sensor || !heard) return;
    setRun((current) => {
      const now = serverNow();
      const flight = current?.showing === showing ? current : { flight: lessonFlight(sensor, lessonBearing(vesselId)), since: null, born: now, showing };
      if (beat === 'caught' && flight.since === null) return { ...flight, since: now + RADAR_LESSON.settleMs };
      // Hurried to the close shot, it comes in a moment after it starts, as it would have; past it, it is in.
      const entry = flight.since === null ? null : flight.since + RADAR_LESSON.enterMs;
      if (beat === 'seen' && (entry === null || entry > now + RADAR_LESSON.leadMs)) return { ...flight, since: now + RADAR_LESSON.leadMs - RADAR_LESSON.enterMs };
      if (beat === 'calm' && (entry === null || entry > now)) return { ...flight, since: now - RADAR_LESSON.enterMs };
      return flight;
    });
  }, [beat, showing, sensor, heard, vesselId]);
  const at = serverNow();
  const wait = run ? stagedChangeIn(run.flight, run.since, at) : null;
  const gone = run !== null && run.since !== null && wait === null;
  // The leg it is on, by when that leg ends: one contact object a leg, so the galaxy redraws nothing between.
  const legEnd = wait === null ? null : Math.round(at + wait);
  useEffect(() => {
    if (legEnd === null) return undefined;
    const timer = window.setTimeout(() => { redraw(n => n + 1); }, Math.max(0, legEnd - serverNow()) + 1);
    return () => { window.clearTimeout(timer); };
  }, [legEnd]);
  return useMemo(() => {
    if (!run || gone) return null;
    return stagedContact(run.flight, run.since, legEnd === null ? run.born : legEnd - 1);
  }, [run, gone, legEnd]);
}
