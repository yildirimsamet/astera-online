import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button } from '../v2/kit/Surface.js';
import { Icon } from '../v2/icons.js';
import { BrandLockup, useBrandPanelFocus } from './Panel.js';
import { installProfile, isBraveBrowser, type InstallBrowser } from './installProfile.js';
import { copyText } from '../lib/clipboard.js';
import { findsInstalledPwa, forgetInstalledPwa, INSTALLED_PWA_KEY, rememberInstalledPwa, remembersInstalledPwa, runningAsPwa } from './installedPwa.js';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const isInstallEvent = (event: Event): event is InstallEvent =>
  typeof Reflect.get(event, 'prompt') === 'function' && Reflect.get(event, 'userChoice') instanceof Promise;
const InstallContext = createContext<{ installed: boolean; checking: boolean; desktop: boolean; request: () => void } | null>(null);
const browserNames: Record<InstallBrowser, string> = { brave: 'Brave', chrome: 'Chrome', edge: 'Edge', safari: 'Safari', firefox: 'Firefox', samsung: 'Samsung Internet', opera: 'Opera', other: '' };

/** Retain a prompt received on landing through all later session transitions. */
export function InstallProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const deferred = useRef<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => runningAsPwa() || remembersInstalledPwa());
  const [checking, setChecking] = useState(true);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [promptMessage, setPromptMessage] = useState<'dismissed' | 'failed' | null>(null);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [profile, setProfile] = useState(() => installProfile());
  const content = useBrandPanelFocus(instructions);

  useEffect(() => {
    if (!instructions || profile.browser === 'brave') return;
    let live = true;
    // Optional identification must never postpone the card or gate installation.
    void isBraveBrowser().then((brave) => {
      if (live && brave) setProfile((current) => ({ ...current, browser: 'brave' }));
    });
    return () => { live = false; };
  }, [instructions, profile.browser]);

  useEffect(() => {
    let live = true;
    let revision = 0;
    let inFlight = false;
    const confirmInstalled = () => {
      revision++;
      rememberInstalledPwa();
      setInstalled(true);
      setChecking(false);
      setInstructions(false);
      setNativeReady(false);
      deferred.current = null;
    };
    const onPrompt = (event: Event) => {
      if (!isInstallEvent(event)) return;
      event.preventDefault();
      if (runningAsPwa()) return;
      revision++;
      forgetInstalledPwa();
      setInstalled(false);
      setChecking(false);
      deferred.current = event;
      setNativeReady(true);
    };
    const onInstalled = () => { confirmInstalled(); };
    const display = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    const onDisplay = () => { if (runningAsPwa()) confirmInstalled(); };
    const checkInstalled = () => {
      if (runningAsPwa()) { confirmInstalled(); return; }
      if (inFlight) return;
      inFlight = true;
      const startedAt = revision;
      void findsInstalledPwa().then((found) => {
        if (!live) return;
        window.clearTimeout(deadline);
        // Do not let a delayed query override a newer installation/native offer.
        if (found && revision === startedAt) confirmInstalled();
        setChecking(false);
      }).finally(() => { inFlight = false; });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') checkInstalled(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === INSTALLED_PWA_KEY && remembersInstalledPwa()) confirmInstalled();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    if (display && typeof display.addEventListener === 'function') display.addEventListener('change', onDisplay);
    // Check asynchronously; never hold game loading for installation metadata.
    // A slow/missing browser API must not permanently hide a usable manual guide.
    const deadline = window.setTimeout(() => { if (live) setChecking(false); }, 1500);
    checkInstalled();
    return () => {
      live = false;
      window.clearTimeout(deadline);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      if (display && typeof display.removeEventListener === 'function') display.removeEventListener('change', onDisplay);
    };
  }, []);

  const request = (): void => {
    if (installed) return;
    setCopy('idle');
    setPromptMessage(null);
    setInstructions(true);
  };
  const launch = async (): Promise<void> => {
    if (installed || busy) return;
    const prompt = deferred.current;
    if (!prompt) return;
    deferred.current = null;
    setNativeReady(false);
    setBusy(true);
    setPromptMessage(null);
    try {
      // Called inside the click, before any await: retain the browser's user gesture.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstructions(false);
      else setPromptMessage('dismissed');
    }
    catch { setPromptMessage('failed'); }
    finally { setBusy(false); }
  };
  const copyAddress = async (): Promise<void> => {
    const previous = document.activeElement;
    setCopy(await copyText('https://asteraonline.space') ? 'copied' : 'failed');
    // The shared HTTP/webview fallback uses a temporary field; restore card focus.
    if (!content.current?.isConnected) return;
    if (previous instanceof HTMLElement && content.current.contains(previous)) previous.focus({ preventScroll: true });
    else content.current.focus({ preventScroll: true });
  };
  const nativeOffered = nativeReady || busy;
  const chromium = ['chrome', 'brave', 'edge', 'opera'].includes(profile.browser);
  const firefoxWindows = profile.browser === 'firefox' && profile.os === 'windows' && (profile.firefoxVersion ?? 0) >= 143;
  const desktop = profile.kind === 'desktop';

  return <InstallContext value={{ installed, checking, desktop, request }}>
    {children}
    {instructions && <Sheet title={t('brand.installHeading')} detents={['fit']} placement="card" quietTitle bleed onClose={() => { setInstructions(false); }}>
      <div ref={content} tabIndex={-1} className="brand-panel brand-install-panel" aria-busy={busy}>
        <BrandLockup />
        {/* The quiet Sheet title is the accessible heading; this is its visible face. */}
        <h3 className="brand-panel-heading" aria-hidden="true">{t('brand.installHeading')}</h3>
        <p className="brand-panel-description">{t(desktop ? 'brand.installBenefitDesktop' : 'brand.installBenefit')}</p>
        {nativeOffered && <Button variant="primary" disabled={busy} onClick={() => { void launch(); }}><Icon id="i-collect" className="size-4" />{t('brand.nativeInstall')}</Button>}
        {!nativeOffered && (profile.kind === 'ios' ? <>
          <ol className="brand-install-steps">{(['brand.iosShare', 'brand.iosHome', 'brand.iosAdd'] as const).map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><strong>{t(step)}</strong></li>)}</ol>
          <p className="brand-panel-note">{t('brand.iosWebApp')}</p>
          <p className="brand-panel-note">{t('brand.iosSafari')}</p>
        </> : desktop ? <>
        {profile.os === 'mac' && profile.browser === 'safari' ? <p className="brand-install-guide">{t('brand.macDock')}</p>
          : firefoxWindows ? <p className="brand-install-guide">{t('brand.firefoxWindows')}</p>
          : chromium && <p className="brand-install-guide">{t('brand.desktopInstall', { browser: browserNames[profile.browser] })}</p>}
        <div className="brand-bookmark-guide">
          <Icon id="i-spark" className="size-5 text-v2-ink-2" />
          <div><p className="brand-panel-label">{t('brand.bookmarkTitle')}</p><p className="brand-panel-note">{t('brand.bookmarkHint')}</p></div>
          <kbd>{profile.os === 'mac' ? '⌘' : 'Ctrl'}<span>+</span>D</kbd>
        </div></> : <p className="brand-install-guide">{profile.kind === 'inApp' ? t('brand.inAppSteps', { browser: profile.os === 'ios' ? 'Safari' : 'Chrome' }) : t(profile.browser === 'firefox' ? 'brand.androidFirefox' : 'brand.androidSteps')}</p>)}
        {profile.kind === 'android' && !nativeOffered && <p className="brand-panel-note">{t('brand.browserFallback')}</p>}
        {promptMessage && <p role="status" className="brand-panel-notice">{t(promptMessage === 'dismissed' ? 'brand.installDismissed' : 'brand.installFailed')}</p>}
        {busy && <p role="status" className="brand-panel-note">{t('brand.installWaiting')}</p>}
        <div className="brand-address-box"><AsteraAddress /></div>
        <Button disabled={busy} onClick={() => { void copyAddress(); }}><Icon id={copy === 'copied' ? 'i-check' : 'i-share'} className="size-4" /><span aria-live="polite">{t(copy === 'copied' ? 'brand.copied' : copy === 'failed' ? 'brand.copyFailed' : 'brand.copyAddress')}</span></Button>
      </div>
    </Sheet>}
  </InstallContext>;
}

/** A computer has no home screen: its offer is a bookmark or an installed app. */
export function useDesktopInstall(): boolean {
  return useContext(InstallContext)?.desktop ?? installProfile().kind === 'desktop';
}

/** Suppress offers for current proof or a remembered installation on this browser. */
export function useInstalled(): boolean {
  return useContext(InstallContext)?.installed ?? (runningAsPwa() || remembersInstalledPwa());
}

export function InstallButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const install = useContext(InstallContext);
  if (install ? install.installed || install.checking : runningAsPwa() || remembersInstalledPwa()) return null;
  if (!install) return <InstallProvider><InstallButton compact={compact} /></InstallProvider>;
  return <Button size={compact ? 'sm' : 'md'} variant="primary" onClick={install.request}>{t(install.desktop ? 'brand.installDesktop' : 'brand.install')}</Button>;
}

function AsteraAddress() {
  return <p className="select-all">asteraonline<span>.space</span></p>;
}
