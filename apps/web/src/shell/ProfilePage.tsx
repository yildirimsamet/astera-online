import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from '@astera/rules';
import { useSeason } from '../api/queries.js';
import { useNow, untilReady } from '../lib/time.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { AccountSecurityEntry } from '../screens/AccountSecuritySheet.js';
import { AccountDeletionEntry } from '../screens/AccountDeletionSheet.js';
import { VacationSheet } from '../screens/VacationSheet.js';
import { Button, Note, Section } from '../v2/kit/Surface.js';
import { CommanderHost } from '../v2/shell/CommanderHost.js';
import { CountryPicker } from '../v2/identity/CountryPicker.js';
import { Flag } from '../v2/identity/Flag.js';
import { countryName } from '../v2/identity/country.js';
import { Icon } from '../v2/icons.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';

/** The /profile route opens the shared sheet over the live galaxy, below the TopBar. */
export function ProfilePage({ name, country = 'TR', onCountryChange, onSignOut, onBack }: {
  name: string;
  country?: CountryCode;
  onCountryChange?: (country: CountryCode) => Promise<void>;
  onSignOut: () => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const season = useSeason().data;
  const now = useNow(60_000);
  const galaxy = season?.shardName ?? null;
  const shard = season?.shard ?? null;
  const ended = season?.status === 'frozen';
  const hoursLeft = season?.endsAt ? (season.endsAt.getTime() - now) / 3_600_000 : null;
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const content = useRef<HTMLElement>(null);
  useEffect(() => { content.current?.focus(); }, []);
  return (
    <Sheet title={t('menu.navigation.account')} eyebrow="Astera Online" detents={['full']} onBack={onBack} onClose={onBack}>
      <section ref={content} data-profile-page tabIndex={-1} aria-label={t('menu.navigation.account')}
        className="profile-page flex flex-col gap-4 pb-4 text-v2-ink outline-none">
        <CommanderHost name={name} country={country} />
        <button type="button" onClick={() => { setVacationOpen(true); }} className="flex min-h-14 items-center gap-3 rounded-control border border-v2-line bg-v2-panel px-3 py-2 text-left hover:bg-v2-raise focus-visible:outline-2 focus-visible:outline-v2-self" aria-label={`${t('vacation.title')}. ${t('vacation.hint')}`}>
          <Icon id="i-lock" className="size-5 shrink-0 text-v2-ink-2" /><span><span className="block text-caption font-semibold">{t('vacation.title')}</span><span className="mt-1 block text-label text-v2-ink-2">{t('vacation.hint')}</span></span><Icon id="i-chev" className="ml-auto size-4 shrink-0 text-v2-ink-3" />
        </button>
      <Section label={t('menu.accountHeading')}>
        <AccountSecurityEntry />
        <AccountDeletionEntry />
        {onCountryChange && (
          <div className="divide-y divide-v2-line overflow-hidden rounded-control border border-v2-line bg-v2-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3"><span className="text-label text-v2-ink-2">{t('country.label')}</span>
              <button
                type="button"
                className="flex items-center gap-2 text-left text-label text-v2-ink focus-visible:outline-2 focus-visible:outline-v2-self"
                onClick={() => { setCountryPickerOpen(true); }}
              >
                <Flag code={country} language={i18n.resolvedLanguage ?? 'en'} />
                <span>{countryName(country, i18n.resolvedLanguage ?? 'en')}</span>
                <span className="text-v2-ink-3">{t('country.change')}</span>
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div data-menu-galaxy className="scene-panel menu-account-scene flex flex-col gap-1 rounded-control border border-v2-line bg-v2-panel p-3">
            <AtmosphereImage art={ATMOSPHERE.galaxyAccount} />
            <p className="v2-legend">{t('galaxy.commander.galaxyLabel')}</p>
            <p className="truncate text-caption font-semibold text-v2-ink">
              {galaxy ?? t('galaxy.commander.galaxyUnknown')}
            </p>
            {shard !== null && shard !== galaxy && (
              <p className="text-label text-v2-ink-3">{shard}</p>
            )}
          </div>
          <div data-menu-season className="scene-panel menu-account-scene flex flex-col gap-1 rounded-control border border-v2-line bg-v2-panel p-3">
            <AtmosphereImage art={ATMOSPHERE.seasonAccount} />
            <p className="v2-legend">
              {ended ? t('seasonRecap.seasonLabel') : t('galaxy.commander.endsLabel')}
            </p>
            <p className="font-v2-mono text-caption font-semibold text-v2-ink">
              {ended
                ? t('seasonRecap.ended')
                : hoursLeft === null
                ? t('galaxy.commander.endsUnknown')
                : untilReady(hoursLeft * 60)}
            </p>
          </div>
        </div>
        <Note>{t('galaxy.commander.wipeNote')}</Note>

              <nav aria-label={t('landing.publicLinksLabel')} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-v2-line pt-3">
        {(
          [
            ['privacy', 'landing.privacyLink'],
            ['terms', 'landing.termsLink'],
            ['contact', 'landing.contactLink'],
          ] as const
        ).map(([page, label]) => (
          <a
            key={page}
            className="text-caption text-v2-ink-3 underline-offset-4 hover:text-v2-ink hover:underline focus-visible:outline-2 focus-visible:outline-v2-self"
            href={publisherUrl(page, i18n.resolvedLanguage)}
          >
            {t(label)}
          </a>
        ))}
      </nav>
        <Button variant="ghost" size="md" full onClick={onSignOut}>
          {t('galaxy.commander.signOut')}
        </Button>
      </Section>
        {countryPickerOpen && onCountryChange && <CountryPicker value={country} onSelect={(next) => { setCountryPickerOpen(false); void onCountryChange(next); }} onClose={() => { setCountryPickerOpen(false); }} />}
        {vacationOpen && <VacationSheet onClose={() => { setVacationOpen(false); }} />}
      </section>
    </Sheet>
  );
}
