import { fleetCount } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanet, useRecallFlight, useRecallMining } from '../../api/queries.js';
import { useWorld } from '../../api/world.js';
import { roomOf } from '../../lib/fleetPage.js';
import { useAirborne, type AirborneItem, type StripFocus } from '../../shell/PendingStrip.js';
import { describe, useToast } from '../../ui/Toast.js';
import { FleetPage, type FleetTab } from '../hud/FleetPage.js';

/**
 * THE FLEET PAGE, WIRED. Spec E4 (docs/ui-v2/gozlemevi.md).
 *
 * The flights are the strip's own rows (`useAirborne`), so the page and the disc can
 * never disagree about what is up. The head reads the ACTIVE world — its bays and its
 * Hangar decide the next launch and the next hull — and the other two views read
 * every world. A raid or a transfer turns through the flight recall (K8), a
 * Prospector run through its own.
 */
export function FleetHost({ onFocus, onClose }: { onFocus: (focus: StripFocus) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FleetTab>('air');
  const [recalling, setRecalling] = useState<string | null>(null);
  const { items, now } = useAirborne();
  const planet = usePlanet().data;
  const { activePlanetId, capitalPlanetId, worlds } = useWorld();
  const recallFlight = useRecallFlight();
  const recallMining = useRecallMining();
  const say = useToast();

  const head = roomOf(planet?.capacity).hangar;

  const recall = (item: AirborneItem): void => {
    const settle = {
      onError: (error: unknown) => { say(describe(error), 'error'); },
      onSettled: () => { setRecalling(null); },
    };
    if (item.recallMission) {
      setRecalling(item.key);
      recallFlight.mutate(item.recallMission, { ...settle, onSuccess: () => { say(t('pendingStrip.recallFleetStarted')); } });
    } else if (item.recall) {
      setRecalling(item.key);
      recallMining.mutate(item.recall, { ...settle, onSuccess: () => { say(t('pendingStrip.recallStarted')); } });
    }
  };

  return (
    <FleetPage
      tab={tab}
      onTab={setTab}
      now={now}
      bays={planet?.flight ?? null}
      hangar={head ? { used: head.used, total: head.total } : null}
      flights={items}
      worlds={worlds.map((world) => ({
        id: world.planet.id,
        name: world.planet.name,
        capital: world.planet.id === capitalPlanetId,
        active: world.planet.id === activePlanetId,
        fleet: world.fleet,
        away: fleetCount(world.fleetAway),
        room: roomOf(world.capacity),
      }))}
      recalling={recalling}
      onFocus={(item) => {
        if (!item.focus) return;
        onClose();
        onFocus(item.focus);
      }}
      onRecall={recall}
      onClose={onClose}
    />
  );
}
