import type { Fleet, Vec3 } from '@astera/rules';
import type { Contact } from '../../api/schemas.js';

/**
 * THE RADAR, SHOWN ON A STAGED CONTACT (owner phone playtest 2026-11-18, item 28). Owner decision: staged,
 * on this client only; the server sends no scout any more. A question mark in the radar's band comes into
 * the telescope's sphere in two seconds and is seen there for what it is, a fleet of Darts passing the ship
 * by; past the sphere it is a question mark again, and gone once it is out of the radar's reach. It carries
 * no `inbound`: a craft coming for the ship would have been a red warning, which is what the lesson says.
 * It is watched from the side, a little far off in the band and closer once it is in sight (owner 2026-11-18).
 */
export const RADAR_LESSON = {
  /** From the radar's edge into the telescope's sphere: long enough to take in what a question mark is (owner 2026-11-18). */
  enterMs: 4000,
  /** The camera starts closing in on it this long before it comes into sight, so the change is not missed (owner 2026-11-18). */
  leadMs: 500,
  /** Held still while the camera comes round to its side, so all of its way in is watched. */
  settleMs: 1200,
  /** Watched inside the telescope's sphere, close. */
  watchMs: 2800,
  /** Four models: the galaxy draws one per ten ships (`PER_MODEL`). */
  fleet: { DART: 40 } satisfies Fleet,
  /** Its closest pass, a share of the telescope's reach: through the sphere, never at the ship. */
  pass: 0.5,
  /** Where in the radar's band it is first heard, a share of the way out from the telescope's edge: just inside the radar's. */
  band: 0.9,
  /** Its pace inside the sphere, a share of the pace it came in at: slow enough to be watched close. */
  cruise: 0.35,
  /** How far above the ship's plane the side shots look from, as a slope: from the side, not from above. */
  lift: 0.35,
  /** Room round what a side shot holds, as a share of it. */
  room: 1.15,
  /** The band's shot stands this much farther back than the band itself: room round both edges (owner 2026-11-18). */
  far: 1.4,
  /** The shot inside the sphere, as a share of the band's: in on the question mark as it turns into what it is. */
  closer: 0.25,
} as const;

/** The staged contact's id: never a server's, so nothing else can be taken for it. */
export const RADAR_LESSON_CONTACT = 'starter-radar-lesson';

/** A bearing of its own for each ship, so two players side by side do not watch the same line. */
export const lessonBearing = (vesselId: string): number => {
  let hash = 0;
  for (const char of vesselId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 360) * Math.PI / 180;
};

export interface LessonFlight {
  start: Vec3;
  /** Where it comes into the telescope's sphere. */
  entry: Vec3;
  /** Where it leaves the sphere. */
  exit: Vec3;
  /** Where it leaves the radar's reach. */
  out: Vec3;
  /** Its pace through the radar's band. */
  unitsPerMs: number;
  /** The ship, at the heart of both spheres. */
  centre: Vec3;
}

/** The line it flies, at the angle given, in the ship's plane, with the speed that brings it in on time. */
export function lessonFlight(sensor: { at: Vec3; identify: number; detect: number }, angle: number): LessonFlight {
  const across = { x: Math.cos(angle), z: Math.sin(angle) };
  const beside = { x: -across.z, z: across.x };
  const pass = sensor.identify * RADAR_LESSON.pass;
  const heard = sensor.identify + (sensor.detect - sensor.identify) * RADAR_LESSON.band;
  // Along the line, from its closest point to the ship: the distance at which it is `r` from the ship.
  const along = (r: number): number => Math.sqrt(Math.max(0, r * r - pass * pass));
  const point = (s: number): Vec3 => ({
    x: sensor.at.x + beside.x * pass + across.x * s,
    y: sensor.at.y,
    z: sensor.at.z + beside.z * pass + across.z * s,
  });
  const start = -along(heard), entry = -along(sensor.identify);
  return {
    start: point(start), entry: point(entry), exit: point(-entry), out: point(along(sensor.detect)),
    unitsPerMs: (entry - start) / RADAR_LESSON.enterMs, centre: { ...sensor.at },
  };
}

const length = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const toward = (from: Vec3, to: Vec3, by: number): Vec3 => {
  const span = length(from, to) || 1;
  return { x: from.x + (to.x - from.x) * by / span, y: from.y + (to.y - from.y) * by / span, z: from.z + (to.z - from.z) * by / span };
};

/** Each leg of it: when it begins and ends, from where to where, and what the ship can tell of it. */
function legs(flight: LessonFlight, since: number) {
  const inside = flight.unitsPerMs * RADAR_LESSON.cruise;
  const exitAt = since + RADAR_LESSON.enterMs + length(flight.entry, flight.exit) / inside;
  const outAt = exitAt + length(flight.exit, flight.out) / inside;
  return [
    { from: flight.start, to: flight.entry, startAt: since, endAt: since + RADAR_LESSON.enterMs, seen: false },
    { from: flight.entry, to: flight.exit, startAt: since + RADAR_LESSON.enterMs, endAt: exitAt, seen: true },
    { from: flight.exit, to: flight.out, startAt: exitAt, endAt: outAt, seen: false },
  ] as const;
}

/** The contact as the galaxy draws it now: still until it moves (`since`), then leg by leg, then nothing. */
export function stagedContact(flight: LessonFlight, since: number | null, now: number): Contact | null {
  const base = { id: RADAR_LESSON_CONTACT, landing: true };
  if (since === null || now < since) return { ...base, kind: 'unknown', from: flight.start, to: flight.start, startAt: new Date(now), endAt: new Date(now) };
  const leg = legs(flight, since).find(row => now < row.endAt);
  if (!leg) return null;
  const window = { from: leg.from, to: leg.to, startAt: new Date(leg.startAt), endAt: new Date(leg.endAt) };
  return leg.seen ? { ...base, ...window, kind: 'fleet', fleet: { ...RADAR_LESSON.fleet } } : { ...base, ...window, kind: 'unknown' };
}

/** How long until the drawn contact changes: it is set off, or changes leg; nothing while it waits unset or once it is gone. */
export function stagedChangeIn(flight: LessonFlight, since: number | null, now: number): number | null {
  if (since === null) return null;
  if (now < since) return since - now;
  const leg = legs(flight, since).find(row => now < row.endAt);
  return leg ? leg.endAt - now : null;
}

/** Straight out from the ship through where it comes into the telescope's sphere, in the ship's plane. */
const outward = (flight: LessonFlight): { x: number; z: number } => {
  const x = flight.entry.x - flight.centre.x, z = flight.entry.z - flight.centre.z;
  const span = Math.hypot(x, z) || 1;
  return { x: x / span, z: z / span };
};

/**
 * The side its shots look from (owner 2026-11-18): along the telescope's sphere where it comes in, from behind
 * it and a little above. The moment it comes into sight is then the moment it crosses the sphere's outline on
 * the screen, and it flies on across the frame into the sphere.
 */
export function lessonSide(flight: LessonFlight): Vec3 {
  const normal = outward(flight);
  const heading = { x: flight.exit.x - flight.entry.x, z: flight.exit.z - flight.entry.z };
  // The sphere's own line at that point, the way it is flying: the camera stands back along it.
  const forward = normal.z * heading.x - normal.x * heading.z > 0;
  const tangent = forward ? { x: normal.z, z: -normal.x } : { x: -normal.z, z: normal.x };
  const span = Math.hypot(1, RADAR_LESSON.lift);
  return { x: -tangent.x / span, y: RADAR_LESSON.lift / span, z: -tangent.z / span };
}

/**
 * What a side shot holds: the point it looks at and the half-width either side of it. In the band, from
 * farther back, the telescope's edge where it comes in and the radar's edge straight out from there, the
 * question mark between; in the sight, in close, from where it comes in to where it is by the end of its
 * watch.
 */
export function lessonFrame(flight: LessonFlight, part: 'band' | 'sight'): { at: Vec3; half: number } {
  const normal = outward(flight);
  const gap = length(flight.centre, flight.out) - length(flight.centre, flight.entry);
  const band = gap / 2;
  const half = band * RADAR_LESSON.far;
  if (part === 'band') return { at: { x: flight.entry.x + normal.x * band, y: flight.entry.y, z: flight.entry.z + normal.z * band }, half };
  const watched = flight.unitsPerMs * RADAR_LESSON.cruise * RADAR_LESSON.watchMs;
  return { at: toward(flight.entry, flight.exit, watched / 2), half: Math.max(half * RADAR_LESSON.closer, watched / 2 * RADAR_LESSON.room) };
}
