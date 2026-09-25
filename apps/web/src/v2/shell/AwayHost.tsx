import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { useIntel } from '../../api/queries.js';
import { useWorld } from '../../api/world.js';
import { serverNow } from '../../lib/clock.js';
import { shouldShowAway, sightingsOf, worldCare, type AwayDoor } from '../../lib/awayStory.js';
import { AwaySheet } from '../hud/AwaySheet.js';

/**
 * THE RETURN STORY, ON ITS TERMS. E10 · K5 · S3.
 *
 * The old overlay had three faults and each has its answer here:
 *
 *   1 · IT OPENED ON NEARLY EVERY RETURN — a phone reloads a backgrounded tab. It now
 *       speaks only after `AWAY_THRESHOLD_MINUTES` with something to tell, and while
 *       the player is here the window is kept at the present, so a reload an hour into
 *       play is not mistaken for an absence.
 *   2 · IT BLOCKED THE WAY IN. It is asked for after the galaxy is up (`delayMs`), and
 *       the galaxy never waits for it.
 *   3 · ITS WORDS WERE ENGLISH. The server sends kinds and parameters; `AwaySheet`
 *       words them.
 *
 * Reading changes nothing on the server; the dismissal closes the window up to the
 * instant the story was read.
 */
export function AwayHost({
  onDoor,
  onAll,
  delayMs = 1_500,
  keepAliveMs = 5 * 60_000,
}: {
  /** A line's door; the two that name a world (a sighting's dossier, a world's repairs) carry its id. */
  onDoor: (door: AwayDoor, planetId?: string) => void;
  onAll: () => void;
  /** How long after the galaxy is up the story is asked for. */
  delayMs?: number;
  /** How often, while the player is here, the window is moved to the present. */
  keepAliveMs?: number;
}) {
  const api = useApi();
  /* What the Telescope sees out now, and the world with faults standing: read live, not stored (M4). */
  const watching = useIntel().data?.watching;
  const { worlds } = useWorld();
  const [armed, setArmed] = useState(delayMs <= 0);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (armed) return undefined;
    const timer = setTimeout(() => { setArmed(true); }, delayMs);
    return () => { clearTimeout(timer); };
  }, [armed, delayMs]);

  const story = useQuery({
    queryKey: keys.returnStory,
    queryFn: () => api.returnPayload(),
    enabled: armed,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const acknowledge = useMutation({ mutationFn: (asOf: Date) => api.acknowledgeReturn(asOf) });
  const close = useRef(acknowledge.mutate);
  close.current = acknowledge.mutate;

  const data = story.data;
  const telling = data !== undefined && !closed && shouldShowAway(data);

  // Nothing worth telling: close the window at once, so the next absence is measured from here.
  useEffect(() => {
    if (data && !shouldShowAway(data)) close.current(data.asOf);
  }, [data]);

  // While the player is here, keep the window at the present.
  useEffect(() => {
    if (!data || telling) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') close.current(new Date(serverNow()));
    }, keepAliveMs);
    return () => { clearInterval(timer); };
  }, [data, telling, keepAliveMs]);

  if (!telling) return null;

  const dismiss = (): void => {
    setClosed(true);
    acknowledge.mutate(data.asOf);
  };

  return (
    <AwaySheet
      story={data}
      sightings={watching ? sightingsOf(watching) : []}
      care={worldCare(worlds)}
      onDismiss={dismiss}
      onAll={() => {
        dismiss();
        onAll();
      }}
      onDoor={(door, planetId) => {
        dismiss();
        onDoor(door, planetId);
      }}
    />
  );
}
