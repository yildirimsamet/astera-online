import { useEffect, useMemo, useState } from 'react';
import { calculateBattleForecast, type BattleForecastRequest, type BattleForecastResult } from './battleForecast.js';

/** Cancel obsolete computations; never label a previous fleet's prediction as the current one. */
export function useBattleForecast(request: BattleForecastRequest | null) {
  // API refreshes often recreate equivalent objects. Only changed combat inputs cancel work.
  const key = JSON.stringify(request);
  const [finished, setFinished] = useState<{ key: string; result: BattleForecastResult | null } | null>(null);
  const fallback = useMemo(() => typeof Worker === 'undefined' && request ? calculateBattleForecast(request) : null, [key]);
  useEffect(() => {
    if (!request || typeof Worker === 'undefined') return;
    let stale = false;
    let worker: Worker | undefined;
    const fail = () => {
      worker?.terminate();
      if (!stale) setFinished({ key, result: null });
    };
    // Construction/postMessage failures join the same visible failure path as worker errors.
    void Promise.resolve().then(() => {
      if (stale) return;
      worker = new Worker(new URL('./battleForecast.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<BattleForecastResult>) => {
        if (!stale) setFinished({ key, result: event.data });
        worker?.terminate();
      };
      worker.onerror = event => { event.preventDefault(); fail(); };
      worker.postMessage(request);
    }).catch(fail);
    return () => { stale = true; worker?.terminate(); };
  }, [key]);
  const current = finished?.key === key ? finished : null;
  const result = fallback ?? current?.result;
  return { lines: result?.lines ?? null, loss: result?.loss ?? null,
    pending: request !== null && fallback === null && current === null,
    error: current !== null && current.result === null };
}
