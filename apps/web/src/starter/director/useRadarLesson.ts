import type { SensorSphere } from '@astera/rules';
import { useEffect, useMemo, useState } from 'react';
import type { Contact } from '../../api/schemas.js';
import { serverNow } from '../../lib/clock.js';
import { useDirector } from './director.js';
import { RADAR_LESSON, lessonBearing, lessonFlight, stagedChangeIn, stagedContact, type LessonFlight } from './radarLesson.js';
import { RADAR_LESSON_SCENE } from './scenes.js';

/**
 * THE RADAR LESSON'S CONTACT, RIDING ITS SCENE (owner phone playtest 2026-11-18, item 28). It is laid on
 * the ship's first sensor as the scene starts, on the ship's own line (the one its camera looks across), and
 * waits there, still, while both spheres are shown; it moves once the camera has come round to its side,
 * and a hurried shot puts it straight into the telescope's sphere. After the scene it flies on out of the
 * radar's reach, and is gone.
 */
export function useRadarLessonContact(sensor: SensorSphere | undefined): Contact | null {
  const playing = useDirector();
  const beat = playing?.scene.id === RADAR_LESSON_SCENE ? playing.beat.id : null;
  const vesselId = playing?.vesselId ?? '';
  const [run, setRun] = useState<{ flight: LessonFlight; since: number | null; born: number } | null>(null);
  const [, redraw] = useState(0);
  const heard = sensor !== undefined && sensor.detect > sensor.identify;
  useEffect(() => {
    if (beat === null || !sensor || !heard) return;
    setRun((current) => {
      const now = serverNow();
      const flight = current ?? { flight: lessonFlight(sensor, lessonBearing(vesselId)), since: null, born: now };
      if (beat === 'caught' && flight.since === null) return { ...flight, since: now + RADAR_LESSON.settleMs };
      // Hurried past the turn: it is already inside, where the next shot looks for it.
      const inside = flight.since !== null && now - flight.since >= RADAR_LESSON.enterMs;
      if ((beat === 'seen' || beat === 'calm') && !inside) return { ...flight, since: now - RADAR_LESSON.enterMs };
      return flight;
    });
  }, [beat, sensor, heard, vesselId]);
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
