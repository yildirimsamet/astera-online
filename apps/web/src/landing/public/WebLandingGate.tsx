import { LandingScreen, type LandingProps } from '../../screens/LandingScreen.js';
import { useEffect, useRef, useState } from 'react';

export function WebLandingGate({ restoring, ...props }: LandingProps & { restoring: boolean }) {
  const [loginQueued, setLoginQueued] = useState(false);
  const pending = useRef<{ promise: Promise<void>; resolve: () => void; reject: (reason: unknown) => void } | null>(null);
  const begin = (): Promise<void> => {
    setLoginQueued(false);
    if (!restoring) return props.onBegin();
    if (pending.current) return pending.current.promise;
    let resolve = (): void => undefined;
    let reject = (_reason: unknown): void => undefined;
    const promise = new Promise<void>((accept, refuse) => { resolve = accept; reject = refuse; });
    pending.current = { promise, resolve, reject };
    return promise;
  };
  useEffect(() => {
    if (restoring || !pending.current) return;
    const intent = pending.current;
    pending.current = null;
    void props.onBegin().then(intent.resolve, intent.reject);
  }, [restoring, props.onBegin]);
  useEffect(() => () => { pending.current?.reject(new Error('Landing closed before restoration')); pending.current = null; }, []);
  return <LandingScreen {...props} onBegin={begin} {...(!restoring && loginQueued ? { open: 'login' } : {})} onRequestLogin={() => {
    if (!restoring) return true;
    if (pending.current) return false;
    setLoginQueued(true);
    return false;
  }} />;
}
