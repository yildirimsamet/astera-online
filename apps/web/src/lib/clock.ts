/**
 * ONE CLOCK FOR THE WHOLE GALAXY, AND IT IS THE SERVER'S.
 *
 * Every craft on the disc, every rock on its orbit and every countdown in the
 * interface is drawn by comparing a server timestamp against "now". That "now" was
 * `Date.now()` — the DEVICE's clock — so a phone two minutes fast drew every fleet
 * two minutes further along its leg than it really was, every asteroid two minutes
 * around its orbit, and every countdown two minutes short. Nothing errors, nothing
 * looks broken, and two players sitting next to each other see different galaxies.
 * On a phone that has lost its network time it is not a small number.
 *
 * The fix is the cheapest one available: every response carries the server's clock,
 * so the offset is measured on traffic the client was making anyway — no extra
 * request, no handshake, no endpoint. `x-server-time` is epoch milliseconds off the
 * server's injected clock; `Date` is the HTTP-standard fallback and is used only if
 * the first is absent, because it has ONE-SECOND resolution — a tenth of the
 * engagement window, on the one cinematic in the game.
 *
 * HALF THE ROUND TRIP IS SUBTRACTED, which is the whole of NTP's idea and all of it
 * that is worth having here. `Date` is stamped when the server answers, so by the
 * time it is parsed it is already one leg of the trip old; adding back half the
 * measured round trip removes the bias. What is left is the asymmetry between the
 * two legs, which is milliseconds on any connection this game is playable on.
 *
 * SLOW SAMPLES ARE DISCARDED. A request that took three seconds says almost nothing
 * about the offset and would drag it around by seconds at a time. A phone waking
 * from sleep produces exactly that, and it is the moment the player is looking.
 *
 * IT SMOOTHS, IT DOES NOT SNAP. The offset is a property of two clocks, which drift
 * by milliseconds an hour, not of any one response. Averaging in each new sample
 * keeps a single unlucky measurement from stepping every craft in the galaxy
 * sideways mid-frame — which is visible, and reads as a stutter in the world.
 */

/** How far ahead of this device the server is, in milliseconds. */
let offset = 0;
let measured = false;

/** Samples slower than this say more about the network than about the clock. */
const MAX_ROUND_TRIP_MS = 2_000;

/** How much of a new sample is taken. Low: the truth here barely moves. */
const SMOOTHING = 0.25;

/**
 * Fold one response into the estimate.
 *
 * `stamp` is the server's own `x-server-time` in epoch milliseconds and `date` is
 * the HTTP `Date` header; `sentAt` and `receivedAt` bracket the request. Called
 * from the API client for every answer, successful or not — a 404 carries the
 * server's clock exactly as well as a 200 does.
 */
export function noteServerTime(
  stamp: string | null,
  date: string | null,
  sentAt: number,
  receivedAt: number,
): void {
  const roundTrip = receivedAt - sentAt;
  if (roundTrip < 0 || roundTrip > MAX_ROUND_TRIP_MS) return;

  const server = readStamp(stamp) ?? readDate(date);
  if (server === null) return;

  // The header was written roughly half a round trip before it was read.
  const sample = server + roundTrip / 2 - receivedAt;
  offset = measured ? offset + (sample - offset) * SMOOTHING : sample;
  measured = true;
}

const readStamp = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
};

/**
 * `Date` truncates to the second, so a header read literally is up to a second
 * EARLY and never late — a bias, not noise, which no amount of smoothing removes.
 * Half a second back is the mean of that truncation.
 */
const readDate = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms + 500 : null;
};

/**
 * The instant the SERVER is at, as well as this client can tell.
 *
 * Use this everywhere a device clock is compared against a server timestamp:
 * flight interpolation, asteroid orbits, countdowns, engagement windows. `Date.now`
 * remains correct for measuring durations that never leave the device — an
 * animation's own elapsed time, a debounce, a round trip.
 */
export const serverNow = (): number => Date.now() + offset;

/** How far off the device's own clock is. For diagnostics and tests. */
export const clockOffset = (): number => offset;

/**
 * A DEVICE-CLOCK INSTANT, MOVED ONTO THE SERVER'S EPOCH.
 *
 * There is one unavoidable source of device-clock timestamps left: React Query's
 * `dataUpdatedAt`, which records when a fetch landed and can only be measured
 * locally. Anything that compares it against a server timestamp — or against
 * `serverNow()` — has to convert it first, or it is subtracting two different
 * epochs and the difference carries the whole offset. That is not hypothetical:
 * `useProjected` did exactly that and jumped the works forward by the offset the
 * instant every fetch landed.
 */
export const toServerTime = (deviceMs: number): number => deviceMs + offset;

/** Test seam. Never called by the app. */
export function resetClock(to = 0): void {
  offset = to;
  measured = to !== 0;
}
