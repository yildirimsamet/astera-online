import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, GameButton, RoundButton } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { isAppActive, watchAppActivity } from '../platform/activity.js';
import { findRelease, formatMegabytes, installRelease, liveUpdateEnabled, restartInto, settleLastUpdate, updater, type Release } from '../platform/liveUpdate.js';
import { shellBuild } from '../platform/updateGate.js';
import { LoadingScreen } from './LoadingScreen.js';

/** A release published while the game is open is looked for at most this often, on return to the app. */
const RESUME_CHECK_MS = 30 * 60_000;

const lookUp = (): Promise<Release | null> => findRelease({
  fetch: (input, init) => fetch(input, init), apiUrl: import.meta.env.VITE_ASTERA_API_URL ?? '',
  release: import.meta.env.VITE_ASTERA_RELEASE ?? '', shell: shellBuild(), storage: localStorage, updater,
});

/** `size` is null when the phone already holds every file: nothing to download, only to apply. */
type Phase = { name: 'checking' } | { name: 'open' } | { name: 'downloading'; size: string | null; progress: number };

/**
 * OTA F3, K2 (owner 2026-11-24): "check when entering, like popular games". The opening scene the
 * player already sees asks for the newest release; a newer one downloads on that same scene, its
 * size and progress on the rail, and the game restarts into it. No answer within the check's time,
 * no network or a failed download: the game opens with the bundle it has.
 *
 * `retryMs` keeps asking while the children show. Only the rules-change screen (426) uses it: a
 * deploy restarts the API minutes before it publishes the release that carries the new rules.
 */
export function LiveUpdateGate({ children, retryMs }: { children: ReactNode; retryMs?: number }) {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState<Phase>(() => ({ name: liveUpdateEnabled() ? 'checking' : 'open' }));
  const started = useRef(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const language = useRef(i18n.language);
  language.current = i18n.language;
  const attempt = useRef(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      const release = await lookUp();
      if (!release) { if (mounted.current) setPhase(current => current.name === 'open' ? current : { name: 'open' }); return; }
      if (mounted.current) setPhase({ name: 'downloading', size: release.bytes > 0 ? formatMegabytes(release.bytes, language.current) : null, progress: 0 });
      const id = await installRelease(release, { updater, storage: localStorage, onProgress: progress => {
        if (mounted.current) setPhase(current => current.name === 'downloading' ? { ...current, progress } : current);
      } });
      haptic('commit');
      await restartInto(release.version, id, { updater, storage: localStorage });
    } catch {
      if (mounted.current) setPhase(current => current.name === 'open' ? current : { name: 'open' });
    } finally { busy.current = false; }
  });
  useEffect(() => {
    mounted.current = true;
    if (!started.current && phase.name === 'checking') {
      started.current = true;
      settleLastUpdate(localStorage, import.meta.env.VITE_ASTERA_RELEASE ?? '');
      void attempt.current();
    }
    return () => { mounted.current = false; };
  }, [phase.name]);
  useEffect(() => {
    if (retryMs === undefined || phase.name !== 'open' || !liveUpdateEnabled()) return;
    const timer = setInterval(() => { void attempt.current(); }, retryMs);
    return () => { clearInterval(timer); };
  }, [retryMs, phase.name]);
  // The bundle came up and drew the game: the updater keeps it instead of rolling it back.
  useEffect(() => {
    if (phase.name === 'open' && liveUpdateEnabled()) void updater.notifyAppReady().catch(() => undefined);
  }, [phase.name]);
  if (phase.name === 'checking') return <LoadingScreen caption={t('loading.contact')} />;
  if (phase.name === 'downloading') {
    return <LoadingScreen caption={phase.size === null ? t('loading.updateApplying') : t('loading.update', { size: phase.size })} progress={phase.progress} />;
  }
  return children;
}

/**
 * K2, back from the background: a newer release downloads quietly and waits; the game never
 * restarts on its own. The player chooses the moment, or the next start picks it up.
 */
export function UpdateReadyCard() {
  const { t } = useTranslation();
  const [ready, setReady] = useState<{ version: string; id: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const checked = useRef(Date.now());
  const busy = useRef(false);
  useEffect(() => {
    if (!liveUpdateEnabled()) return;
    return watchAppActivity(() => {
      if (!isAppActive() || busy.current || Date.now() - checked.current < RESUME_CHECK_MS) return;
      checked.current = Date.now();
      busy.current = true;
      void lookUp()
        .then(async release => release ? { version: release.version, id: await installRelease(release, { updater, storage: localStorage }) } : null)
        .then(found => { if (found) { setReady(found); setHidden(false); } }, () => undefined)
        .finally(() => { busy.current = false; });
    });
  }, []);
  if (!ready || hidden) return null;
  return (
    <div className="gk pointer-events-none fixed inset-x-[var(--gk-gutter)] top-[calc(var(--toast-lift,calc(var(--v2-top-h,86px)+4px-env(safe-area-inset-top)))+env(safe-area-inset-top))] z-[90] flex justify-center">
      <div className="pointer-events-auto w-full max-w-sm">
        <Banner variant="toast" tone="info" glyph="refresh" title={t('app.updateReady')}
          action={<span className="flex items-center gap-2">
            <GameButton tone="action" size="sm" glyph="refresh" heavy onPress={() => {
              void restartInto(ready.version, ready.id, { updater, storage: localStorage });
            }}>{t('app.updateRestart')}</GameButton>
            <RoundButton small glyph="close" label={t('toast.dismiss')} onPress={() => { setHidden(true); }} />
          </span>} />
      </div>
    </div>
  );
}
