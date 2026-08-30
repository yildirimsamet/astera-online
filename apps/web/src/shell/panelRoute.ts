import type { PanelStop } from '../screens/GalaxyView.jsx';

export interface PanelStopRequest {
  stop: PanelStop;
  request: number;
  reportMissionId?: string;
}

/**
 * Preserve a deep-link only for the navigation that carries it.
 *
 * A battle notification may name both the Intel shelf and one exact report. A
 * later ordinary press on Intel is a fresh visit, so it must clear that identity
 * instead of reopening yesterday's sheet.
 */
export function nextPanelStop(
  current: PanelStopRequest | null,
  stop?: PanelStop,
  reportMissionId?: string,
): PanelStopRequest | null {
  if (!stop) return null;
  return {
    stop,
    request: (current?.request ?? 0) + 1,
    ...(reportMissionId ? { reportMissionId } : {}),
  };
}
