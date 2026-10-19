import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServers } from '../../api/queries.js';
import { matchLanguage } from '../../i18n/languages.js';
import { commanderKnownHere } from '../../lib/returning.js';
import { Button } from '../../v2/kit/Surface.js';
import { LanguageSwitch } from '../../ui/LanguageSwitch.js';
import { AuthDialog } from '../../screens/LandingAuthDialog.js';
import type { LandingProps, Mode } from '../../screens/LandingScreen.js';
import { PublicLanding } from './PublicLanding.js';
import { openConsentNotice } from '../../lib/consent.js';
import { publisherUrl, publisherWikiUrl } from '../../lib/publisherPages.js';
import { LANDING_COPY, LANDING_ACTIONS } from './content.js';
import { syncDocumentLanguage } from '../../i18n/document.js';
import { useLandingConsentHost } from './ConsentPlacement.js';

/** Same account/rehearsal callbacks as native, without a WebGL/preload gate. */
export function PublicLandingScreen({ onAuthenticate, onBegin, open, knownCommander, error, securityNotice, loginEmail, onRequestLogin, onRetry }: LandingProps) {
  const { t, i18n } = useTranslation();
  const consentHostRef = useLandingConsentHost();
  const language = matchLanguage(i18n.resolvedLanguage) ?? 'tr';
  const [mode, setMode] = useState<Mode | null>(open ?? null);
  const [returning] = useState(() => (knownCommander ?? commanderKnownHere)());
  const [opening, setOpening] = useState(false);
  const starting = useRef(false);
  const primary = useRef<HTMLDivElement>(null);
  const servers = useServers();
  const commanders = servers.data?.servers.reduce((sum, server) => sum + server.planets, 0) ?? 0;
  const online = servers.data?.servers.reduce((sum, server) => sum + server.online, 0) ?? 0;
  // Suspense cleans layout effects when hiding this tree to load a game branch.
  useLayoutEffect(() => {
    document.documentElement.dataset.publicSurface = '';
    syncDocumentLanguage();
    return () => { delete document.documentElement.dataset.publicSurface; };
  }, []);
  useEffect(() => { if (open) setMode(open); }, [open]);
  const begin = (): void => {
    if (starting.current) return;
    starting.current = true;
    setMode(null);
    setOpening(true);
    void onBegin().catch(() => { starting.current = false; setOpening(false); });
  };
  const close = (): void => { setMode(null); primary.current?.querySelector<HTMLElement>('button')?.focus(); };
  const login = (): void => { if (onRequestLogin?.() !== false) setMode('login'); };
  return <>
    <PublicLanding consentHostRef={consentHostRef} language={language} languageSwitch={<LanguageSwitch compact />} entry={<div ref={primary}>
      {returning ? <>
        <p className="landing-returning-hint">{t('landing.welcomeBack')}</p>
        <Button testId="landing-primary" variant="primary" size="lg" full onClick={login}>{t('landing.signInPrimary')}</Button>
        <p className="landing-returning-hint">{t('landing.returningHint')}</p>
        <Button variant="default" size="lg" full disabled={opening} onClick={begin}>{opening ? t('landing.opening') : t('landing.newCommander')}</Button>
      </> : <>
        <Button testId="landing-primary" variant="primary" size="lg" full disabled={opening} onClick={begin}>{opening ? t('landing.opening') : LANDING_ACTIONS[language].play}</Button>
        <p className="mt-2 text-center text-caption text-v2-ink-2">{LANDING_ACTIONS[language].account}</p>
        <button className="landing-login" type="button" onClick={login}>{t('landing.signIn')}</button>
      </>}
      {error !== undefined && mode === null ? <div className="landing-connection"><p role="alert">{error}</p>{onRetry ? <Button size="sm" onClick={onRetry}>{t('app.blockedRetry')}</Button> : null}</div> : null}
      {commanders > 0 ? <p className="landing-population">{t('landing.populationHeld', { amount: commanders }).replace(/<\/?0>/g, '')}{online > 0 ? ` · ${t('landing.populationOnline', { amount: online }).replace(/<\/?0>/g, '')}` : ''}</p> : null}
    </div>} footer={<nav aria-label={t('landing.publicLinksLabel')}><a href={publisherWikiUrl(language)}>Wiki</a>{([
      ['about', 'landing.aboutLink'], ['guide', 'landing.guideLink'], ['privacy', 'landing.privacyLink'], ['terms', 'landing.termsLink'], ['refunds', 'landing.refundsLink'], ['pricing', 'landing.pricingLink'], ['contact', 'landing.contactLink'],
    ] as const).map(([page, label]) => <a key={page} href={publisherUrl(page, language)}>{t(label)}</a>)}</nav>} privacyControl={<button type="button" onClick={openConsentNotice}>{LANDING_COPY[language].privacy}</button>} />
    {mode !== null ? <AuthDialog onBegin={begin} onClose={close} onSubmit={onAuthenticate} securityNotice={securityNotice} loginEmail={loginEmail} /> : null}
  </>;
}
