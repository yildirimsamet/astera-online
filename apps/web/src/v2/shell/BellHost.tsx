import { useGalaxy } from '../../api/queries.js';
import { useWorld } from '../../api/world.js';
import { ChronicleScreen } from '../../screens/ChronicleScreen.js';
import { SignalsFeed, type SignalGo } from '../../shell/Signals.js';
import { BellSheet, type BellTab } from '../hud/BellSheet.js';

export interface BellHostProps {
  tab: BellTab;
  onTab: (tab: BellTab) => void;
  onClose: () => void;
  /** Ids this opening marked read (`useOpenSignals`); they stay lit and their count heads the sheet. */
  justRead: ReadonlySet<string>;
  /** A signal's destination: a panel, its shelf, a report. */
  onGo: SignalGo;
  /** Fly the camera to a world. */
  onFocusPlanet: (planetId: string) => void;
  onFocusMonument?: (monumentId: string) => void;
  /** Open the base: the chronicle's line about the player's own active world lands there. */
  onOpenPlanet: () => void;
}

/**
 * THE BELL SHEET, WIRED. Decision K1 (docs/ui-v2/gozlemevi.md).
 *
 * Each tab draws the screen that already exists for it — `SignalsFeed` and the
 * galaxy chronicle — and every way out of them closes the sheet first so the camera
 * move is seen. Chat is a page of its own (`ChatHost`).
 */
export function BellHost({ tab, onTab, onClose, justRead, onGo, onFocusPlanet, onFocusMonument, onOpenPlanet }: BellHostProps) {
  const { activePlanetId } = useWorld();
  const galaxy = useGalaxy();
  const planetIds = galaxy.data?.planets.map((planet) => planet.id);

  const fly = (planetId: string): void => {
    onClose();
    onFocusPlanet(planetId);
  };

  return (
    <BellSheet
      tab={tab}
      onTab={onTab}
      onClose={onClose}
      unseen={justRead.size}
      signals={(
        <SignalsFeed
          onFocusMonument={onFocusMonument ? (id) => { onClose(); onFocusMonument(id); } : undefined}
          justRead={justRead}
          onGo={(panel, stop, reportMissionId, focus) => {
            onClose();
            onGo(panel, stop, reportMissionId, focus);
          }}
          onFocusPlanet={fly}
        />
      )}
      chronicle={(
        <ChronicleScreen
          {...(planetIds ? { focusablePlanetIds: planetIds } : {})}
          onFocusPlanet={(planetId) => {
            if (planetId === activePlanetId) {
              onClose();
              onOpenPlanet();
              return;
            }
            fly(planetId);
          }}
        />
      )}
    />
  );
}
