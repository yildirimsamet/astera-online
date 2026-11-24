import type { WorldBody } from '@astera/rules';
import { useRetargetMission } from '../api/queries.js';
import { useMoonT } from '../i18n/moon.js';
import { describe, useToast } from '../ui/Toast.js';
import { RetargetButton } from './MoonControls.js';

/**
 * TURN AN OUTBOUND RAID BETWEEN A WORLD AND ITS MOON (Ay plan §6.11). Owns its own order and toast,
 * so a flight card only mounts it when the turn is on offer and pays for nothing otherwise.
 */
export function MissionRetarget({ missionId, currentBody }: { readonly missionId: string; readonly currentBody: WorldBody }) {
  const tMoon = useMoonT();
  const say = useToast();
  const retarget = useRetargetMission();
  return (
    <RetargetButton
      missionId={missionId}
      currentBody={currentBody}
      disabled={retarget.isPending}
      onRetarget={(id, body) => {
        retarget.mutate({ missionId: id, body }, {
          onSuccess: (res) => { say(tMoon(res.targetBody === 'MOON' ? 'body.retargetedToMoon' : 'body.retargetedToPlanet')); },
          onError: (error) => { say(describe(error), 'error'); },
        });
      }}
    />
  );
}
