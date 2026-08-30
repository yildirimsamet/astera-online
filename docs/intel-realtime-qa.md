# Intel and realtime QA

This checklist proves the whole chain, not only that a marker happens to look right:

`server permission -> redacted API response -> live event -> query refresh -> Galaxy UI`

The live channel is authenticated **SSE**, not WebSocket. It announces that something changed;
the browser then asks the authoritative API for the state it is allowed to know. Fleet positions
are interpolated from server timestamps rather than streamed every frame.

## Automated acceptance

Run the focused contract first:

```sh
pnpm --filter @astera/web test -- --run \
  test/fog.test.tsx \
  test/crossing.test.ts \
  test/arrival-wakeup.test.tsx \
  test/event-stream.test.tsx \
  test/sensor-rings.test.ts \
  test/orbit-visuals.test.ts \
  test/intel-screen.test.tsx \
  test/gains.test.ts

pnpm --filter @astera/server test -- --run \
  test/intel-states.test.ts \
  test/sensor-horizon.test.ts \
  test/event-bus-reconnect.test.ts \
  test/pending.test.ts \
  test/notifications.test.ts \
  test/broadcast.test.ts
```

These tests cover:

- unknown, remembered and live world responses;
- a second probe replacing the remembered Core, satellite and shield picture while both reports
  remain in history;
- the same moving contact returning different detail to two commanders at the same instant;
- Telescope and Radar boundary wake-ups, tangent contact and overlapping sensor spheres;
- wide Radar intent without a clock and the tighter timed warning;
- `probe_report`, private and galaxy-wide event invalidation, reconnect catch-up and duplicate
  event coalescing;
- dim/frozen remembered hardware, dim shield, no breathing animation and the sensor shell/burst.

## Browser setup

Use three commanders in separate browser profiles so cookies and query caches cannot leak:

- **Observer:** the screen being checked. Keep DevTools Network open.
- **Carrier:** owns the probe or fleet being sent.
- **Destination:** allows a route to cross the Observer's sight without targeting the Observer.

In the Observer's Network panel:

1. `/api/stream` must stay pending and its response type must be `text/event-stream`.
2. Preserve the log and filter by `stream`, `galaxy`, `traffic`, `intel`, `notifications` and
   `pending`.
3. Disable cache. Do not throttle for the first pass; repeat once with a mobile profile.

## Telescope crossing

Choose Carrier and Destination worlds whose straight route crosses the Observer's drawn
Telescope sphere while both endpoints remain outside it. Send a fleet to Destination, not to
Observer.

Expected sequence:

1. After the departure concealment area, the Observer sees only an unidentified moving mark.
2. At the drawn sphere, `/api/galaxy/traffic` refetches and the mark becomes a readable craft.
   A fleet shows its exact hulls/counts, but never its owner, origin or destination.
3. The craft remains visible for exactly the part of the route inside the sphere.
4. At the exit, another traffic read turns it back into an unidentified mark.
5. It must not become “coming for you”, because its destination is the third commander.

The boundary refresh is predicted locally from the server's published motion window. It does not
wait for a new server event at the crossing itself.

## Two probes and a changed world

1. Observer probes Carrier and waits for the report. Record the remembered Core, satellites and
   shield shown on the galaxy.
2. Carrier changes all three: raise Core, add a satellite and build or raise Aegis.
3. Observer must continue seeing the old dim, frozen picture while the world is outside live
   sight. The new public shape must not leak through a galaxy-wide build event.
4. After the probe cooldown, send a second probe to the same world.
5. When it returns, the Observer's stream receives `probe_report`; `galaxy`, `intel` and
   `notifications` refetch immediately.
6. The remembered world updates to the second report, stays dim/frozen, and the Intel screen keeps
   both reports in its history.

## Radar warning

Use a fleet aimed directly at an Observer world and begin outside the wide Radar sphere.

At Radar L3 (the detection and timed-warning radii are provisionally merged):

1. Outside the level's authoritative `radarRange` there is no Radar attribution.
2. On crossing into that circle the galaxy contact turns red and explicitly says it is aimed at
   you; an `incoming_fleet` private event arrives and the pending surface gains the timed warning.

Repeat at L4 and L5:

- L4 adds rough fleet size.
- L5 may name the origin and exact force, because that is the final Radar product.

Also send a fleet past the Observer toward Destination. Proximity alone must never mark it as
incoming. Radar is checking where the hostile fleet is going, not merely whether it is nearby.

## Information-boundary check

Inspect the actual JSON; hiding text with CSS is not sufficient.

- Outside every owned sensor sphere a traffic contact is absent.
- Inside Radar but outside Telescope reach it is `unknown`; `mass` appears only at Radar L4 and
  `silhouette` only at L5, while `fleet` and `route` remain absent.
- Inside Telescope reach it may become `fleet` or `probe`; an identified fleet carries its exact
  roster in `fleet` while owner, origin, destination and cargo remain absent.
- `inbound` appears only for the commander who owns the target world and only inside that world's
  wide Radar area.
- An unknown world contains position and opaque identity only.
- A remembered world contains the frozen probe snapshot.
- A resolved world contains the current live state.

Compare the same `/api/galaxy/traffic` moment from Observer and a better-equipped fourth account.
The contact id and position should agree; the permitted fields should differ.

## Latency acceptance

“No delay” is not a valid measurable target. On an unthrottled local machine, accept:

- private events such as `probe_report` or `incoming_fleet`: event plus API round trip, normally
  under 1 second;
- galaxy-wide launch/arrival events: 250 ms coalescing plus API round trip, normally under 1
  second;
- a predicted sensor crossing: traffic request starts at the boundary plus about 50 ms;
- reconnect catch-up: within 5 seconds after the stream reopens;
- the 60-second query polling remains only a last-resort safety net.

Record event time, following request time, response time and visible change time. A marker that
changes only near 60 seconds is a failed live path even if it eventually becomes correct.

## Required manual edge passes

- Put a route tangent to a sphere: touching at one point must not flicker identity.
- Overlap two owned worlds' sensor spheres: crossing between them must not lose identity.
- Remove or disable the Uplink: Telescope and Radar effects must stop without deleting hardware.
- Background a phone, cause an event, then return: focus/visibility recovery must resync.
- Toggle offline/online during a flight: no permanently parked marker and no duplicated marker.
- Check both Turkish and English copy at phone width, including the long two-range Radar sentence.
