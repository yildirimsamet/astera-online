import { useEffect, useState } from 'react';
import { galaxyFrames, useFpsMeterEnabled } from '../lib/fpsMeter.js';
import { usePerfSession } from '../lib/perfSession.js';
import { useTranslation } from 'react-i18next';

/** How often the number changes. Twice a second is readable; every frame is not. */
const REFRESH_MS = 500;

/**
 * THE FPS READOUT, UNDER THE DISC READOUT. Owner request, 2026-09-19.
 *
 * A caption, not a panel: the same micro type and faint tone as the line above it,
 * so it never competes with the worlds. Only there while the menu switch is on.
 */
/** Minutes and seconds, for the recording's running time. */
export const formatClock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;

export function FpsReadout() {
  const { t } = useTranslation();
  const perf = usePerfSession();
  const recording = perf.status === 'recording';
  // A running recording shows the rate too: the owner is watching both at once.
  const on = useFpsMeterEnabled() || recording;
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!on) return undefined;
    const timer = setInterval(() => {
      setFps(galaxyFrames.read(performance.now()));
    }, REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [on]);

  if (!on) return null;
  return (
    <span data-fps-readout className="num mt-0.5 flex items-center gap-2 px-1 text-micro text-faint" aria-live="off">
      <span>{`${String(fps)} fps`}</span>
      {recording && (
        <span className="text-threat-ink">{`● ${t('community.admin.perfRec')} ${formatClock(perf.seconds)}`}</span>
      )}
    </span>
  );
}
