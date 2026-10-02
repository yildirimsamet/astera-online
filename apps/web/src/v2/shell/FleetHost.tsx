import { clanDefenseApplies, fleetCount } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClanSupportActions, useMySupport, usePlanet, useRecallFlight, useRecallMining } from '../../api/queries.js';
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
export function FleetHost({ onFocus, onClose, onOpenRepairStation }: {
  onFocus: (focus: StripFocus) => void;
  onClose: () => void;
  /** A world's dock count opens that world's Repair Station, in its Base (2026-09-30). */
  onOpenRepairStation: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FleetTab>('air');
  const [recalling, setRecalling] = useState<string | null>(null);
  const { items, now } = useAirborne();
  const planet = usePlanet().data;
  const { activePlanetId, capitalPlanetId, worlds } = useWorld();
  const recallFlight = useRecallFlight();
  const recallMining = useRecallMining();
  const say = useToast();
  // Klan Savunma Desteği: my waves still out, recalled from their own group — asked for only
  // in a season dealt the rule.
  const mySupport = useMySupport(clanDefenseApplies(planet?.rulesetVersion ?? 0)).data;
  const support = useClanSupportActions();
  const [recallingWave, setRecallingWave] = useState<string | null>(null);

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
        docked: fleetCount(world.fleetDocked ?? {}),
      }))}
      recalling={recalling}
      onOpenRepairStation={onOpenRepairStation}
      onFocus={(item) => {
        if (!item.focus) return;
        onClose();
        onFocus(item.focus);
      }}
      onRecall={recall}
      support={{
        waves: mySupport?.waves ?? [],
        recalling: recallingWave,
        onRecall: (waveId) => {
          setRecallingWave(waveId);
          support.recall.mutate(waveId, {
            onSuccess: () => { say(t('pendingStrip.recallFleetStarted')); },
            onError: (error: unknown) => { say(describe(error), 'error'); },
            onSettled: () => { setRecallingWave(null); },
          });
        },
      }}
      onClose={onClose}
    />
  );
}
