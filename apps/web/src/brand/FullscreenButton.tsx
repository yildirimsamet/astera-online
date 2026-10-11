import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../v2/kit/Sheet.js';
import { installProfile } from './installProfile.js';
import { runningAsPwa } from './installedPwa.js';

interface FullscreenDocument extends Document {
  readonly webkitFullscreenEnabled?: boolean;
  readonly webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface FullscreenRoot extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
const DISPLAY_MODES = ['fullscreen', 'standalone', 'minimal-ui'] as const;

function snapshot() {
  const doc: FullscreenDocument = document;
  const root: FullscreenRoot = document.documentElement;
  // A denied standard policy must never fall through to the prefixed API.
  const standard = typeof root.requestFullscreen === 'function' && typeof doc.exitFullscreen === 'function';
  const native = standard ? doc.fullscreenEnabled
    : typeof root.webkitRequestFullscreen === 'function' && typeof doc.webkitExitFullscreen === 'function' && doc.webkitFullscreenEnabled !== false;
  const active = !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
  const mode = (value: string) => typeof window.matchMedia === 'function' && window.matchMedia(`(display-mode: ${value})`).matches;
  return { native, active, browserFullscreen: !active && mode('fullscreen'), app: runningAsPwa() || mode('minimal-ui') };
}

type Help = 'unsupported' | 'enterFailed' | 'exitFailed';
interface Transition { leaving: boolean; timer: number }

/** Document fullscreen includes every body-mounted overlay. Only a click can enter. */
export function FullscreenButton() {
  const { t } = useTranslation();
  const [view, setView] = useState(snapshot);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<Help | null>(null);
  const current = useRef<Transition | null>(null);
  const live = useRef(true);

  const finish = useCallback((operation: Transition, failed = false): void => {
    if (!live.current || current.current !== operation) return;
    window.clearTimeout(operation.timer);
    current.current = null;
    setBusy(false);
    setView(snapshot());
    if (failed) setHelp(operation.leaving ? 'exitFailed' : 'enterFailed');
  }, []);

  useEffect(() => {
    live.current = true;
    const refresh = () => { setView(snapshot()); };
    const change = () => {
      if (current.current) finish(current.current);
      else refresh();
    };
    const error = () => { if (current.current) finish(current.current, true); };
    const queries = typeof window.matchMedia === 'function'
      ? DISPLAY_MODES.map(mode => window.matchMedia(`(display-mode: ${mode})`)) : [];
    document.addEventListener('fullscreenchange', change);
    document.addEventListener('webkitfullscreenchange', change);
    document.addEventListener('fullscreenerror', error);
    document.addEventListener('webkitfullscreenerror', error);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    for (const query of queries) if (typeof query.addEventListener === 'function') query.addEventListener('change', refresh);
    return () => {
      live.current = false;
      if (current.current) window.clearTimeout(current.current.timer);
      current.current = null;
      document.removeEventListener('fullscreenchange', change);
      document.removeEventListener('webkitfullscreenchange', change);
      document.removeEventListener('fullscreenerror', error);
      document.removeEventListener('webkitfullscreenerror', error);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      for (const query of queries) if (typeof query.removeEventListener === 'function') query.removeEventListener('change', refresh);
    };
  }, [finish]);

  const toggle = (): void => {
    if (current.current) return;
    const state = snapshot();
    setView(state);
    if (state.browserFullscreen || (!state.active && !state.native && state.app)) return;
    if (!state.native) { setHelp('unsupported'); return; }
    setHelp(null);
    setBusy(true);
    const operation: Transition = { leaving: state.active, timer: 0 };
    current.current = operation;
    // Older WebKit returns void: events confirm completion; silence must not trap the button.
    operation.timer = window.setTimeout(() => { finish(operation, true); }, 5_000);
    const doc: FullscreenDocument = document;
    const root: FullscreenRoot = document.documentElement;
    try {
      const result = operation.leaving
        ? (typeof doc.exitFullscreen === 'function' ? doc.exitFullscreen() : doc.webkitExitFullscreen?.())
        : (typeof root.requestFullscreen === 'function' ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen?.());
      if (result) void result.then(() => { finish(operation); }, () => { finish(operation, true); });
    } catch { finish(operation, true); }
  };

  const appOnly = !view.active && !view.native && view.app;
  const label = t(view.active ? 'brand.fullscreen.exit' : view.browserFullscreen ? 'brand.fullscreen.already'
    : appOnly ? 'brand.fullscreen.appActive' : 'brand.fullscreen.enter');
  const profile = help ? installProfile() : null;
  return <>
    <button type="button" data-fullscreen-button className="brand-masthead-fullscreen"
      aria-label={label} title={label} aria-pressed={view.active || view.browserFullscreen || appOnly}
      aria-busy={busy} disabled={busy || view.browserFullscreen || appOnly} onClick={toggle}>
      <span className="brand-masthead-fullscreen-face">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d={view.active ? 'M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4' : 'M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5'} />
        </svg>
      </span>
    </button>
    {help && profile && createPortal(<div className="[--v2-top-h:0px] [--v2-dock-h:0px]">
      <Sheet title={t('brand.fullscreen.title')} detents={['fit']} placement="card" onClose={() => { setHelp(null); }}>
        <div className="flex flex-col gap-3 py-1 text-caption leading-snug text-v2-ink-2">
          <p role={help === 'unsupported' ? 'status' : 'alert'}>{t(`brand.fullscreen.${help}`)}</p>
          {profile.kind === 'inApp' ? <p>{t('brand.inAppSteps', { browser: profile.os === 'ios' ? 'Safari' : 'Chrome' })}</p>
            : profile.kind === 'ios' ? <>
              <ol className="list-inside list-decimal space-y-2 text-v2-ink">{(['brand.iosShare', 'brand.iosHome', 'brand.iosAdd'] as const).map(step => <li key={step}>{t(step)}</li>)}</ol>
              <p>{t('brand.iosWebApp')}</p><p>{t('brand.iosSafari')}</p><p className="text-v2-self">{t('brand.fullscreen.launchApp')}</p>
            </> : profile.kind === 'android' ? <>
              <p>{t(profile.browser === 'firefox' ? 'brand.androidFirefox' : 'brand.androidSteps')}</p>
              <p className="text-v2-self">{t('brand.fullscreen.launchApp')}</p>
            </> : <p>{t('brand.fullscreen.desktopHelp')}</p>}
        </div>
      </Sheet>
    </div>, document.body)}
  </>;
}
