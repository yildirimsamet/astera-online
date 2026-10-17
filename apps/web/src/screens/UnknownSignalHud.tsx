import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import type { MobileHullId, UnknownSignalWarshipHull } from '@astera/rules';
import type { PlanetView, UnknownSignalView, unknownSignalsSchema } from '../api/schemas.js';
import { countdown, useNow } from '../lib/time.js';
import { UnknownSignalGlyph, UnknownSignalSheet } from './UnknownSignalSheet.js';

export function UnknownSignalHud({ data, planet, worlds, focusedId, busy, error, onFocus, onClose, onSend,
  onOrigin, onBuild, onSkins, onDetected }: {
  data?: z.infer<typeof unknownSignalsSchema>; planet?: PlanetView; worlds: readonly PlanetView[]; focusedId: string | null;
  busy?: boolean; error?: string | null; onFocus: (id: string) => void; onClose: () => void;
  onSend: (id: string, hull: UnknownSignalWarshipHull) => void;
  onOrigin: (id: string) => void; onBuild: (hull: MobileHullId) => void; onSkins: () => void; onDetected: () => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const seen = useRef<Set<string> | null>(null);
  const [snapshot, setSnapshot] = useState<UnknownSignalView | null>(null);
  const current = data?.signals.find(signal => signal.id === focusedId);
  const selected = current ?? (snapshot?.id === focusedId ? snapshot : null);
  const open = data?.signals.find(signal => signal.status === 'open' && signal.expiresAt.getTime() > now);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.signals.filter(signal => signal.status === 'open' && signal.expiresAt.getTime() > now).map(signal => signal.id));
    if (seen.current && [...ids].some(id => !seen.current?.has(id))) onDetected();
    seen.current = ids;
  }, [data, onDetected]);
  useEffect(() => { if (current) setSnapshot(current); else if (!focusedId) setSnapshot(null); }, [current, focusedId]);
  return <>
    {open && <button type="button" data-unknown-signal-chip="" onClick={() => { onFocus(open.id); }}
      className="pointer-events-auto relative z-10 flex max-w-[15rem] items-center gap-1.5 rounded-control border border-v2-crystal/30 bg-v2-deep/90 px-2 py-1 text-caption text-v2-crystal shadow-[0_0_18px_#5edcff12]">
      <UnknownSignalGlyph className="size-5 shrink-0" /><span className="truncate">{t('unknownSignal.title')}</span>
      <span className="font-v2-mono text-micro text-v2-ink-2">{countdown(open.expiresAt.getTime() - now)}</span>
    </button>}
    {selected && planet && <UnknownSignalSheet key={selected.id} signal={selected} planet={planet} now={now}
      radar={data?.radar ?? { level: 0, range: 2700 }} tier={data?.tier ?? 1} busy={busy} error={error}
      origins={worlds.map(world => ({ id: world.planet.id, name: world.planet.name }))} onOrigin={onOrigin} onClose={onClose}
      onSend={hull => { onSend(selected.id, hull); }} onBuild={onBuild} onSkins={onSkins} />}
  </>;
}
