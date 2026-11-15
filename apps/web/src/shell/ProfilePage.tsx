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
import { CommanderHost } from '../v2/shell/CommanderHost.js';
import { CountryPicker } from '../v2/identity/CountryPicker.js';
import { Flag } from '../v2/identity/Flag.js';
import { countryName } from '../v2/identity/country.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import { ATMOSPHERE, type AtmosphereArt } from '../ui/atmosphere.js';
import { LegacyEntryCard, LegacyProfileSheet } from '../legacy/LegacyPeek.js';
import { DoorRow, GameButton, SectionTag } from '../game-ui/index.js';

/**
 * THE ACCOUNT PAGE (G10, C23 2026-11-15): who I am and what I hold over my account. The
 * commander first, then the Legacy, the galaxy and the season left in it, the account's doors,
 * and at the foot what ends the session or the account — deletion last, away from the thumb.
 * The /profile route opens it over the live galaxy, below the top bar.
 */
export function ProfilePage({ name, country = 'TR', onCountryChange, onSignOut, onBack }: {
  name: string;
  country?: CountryCode;
  onCountryChange?: (country: CountryCode) => Promise<void>;
  onSignOut: () => void;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const season = useSeason().data;
  const now = useNow(60_000);
  const galaxy = season?.shardName ?? null;
  const shard = season?.shard ?? null;
  const ended = season?.status === 'frozen';
  const hoursLeft = season?.endsAt ? (season.endsAt.getTime() - now) / 3_600_000 : null;
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const content = useRef<HTMLElement>(null);
  useEffect(() => { content.current?.focus(); }, []);
  const where = countryName(country, language);
  return (
    <Sheet title={t('menu.navigation.account')} eyebrow="Astera Online" detents={['full']} onBack={onBack} onClose={onBack} kit={{ tone: 'self' }}>
      <section ref={content} data-profile-page tabIndex={-1} aria-label={t('menu.navigation.account')} className="gk-acct">
        <CommanderHost name={name} country={country} />
        <LegacyEntryCard onOpen={() => { setLegacyOpen(true); }} />
        <div className="gk-acct__season">
          <Place marks={{ 'data-menu-galaxy': '' }} art={ATMOSPHERE.galaxyAccount} label={t('galaxy.commander.galaxyLabel')}
            value={galaxy ?? t('galaxy.commander.galaxyUnknown')} sub={shard !== null && shard !== galaxy ? shard : undefined} />
          <Place marks={{ 'data-menu-season': '' }} art={ATMOSPHERE.seasonAccount} label={ended ? t('seasonRecap.seasonLabel') : t('galaxy.commander.endsLabel')}
            value={ended ? t('seasonRecap.ended') : hoursLeft === null ? t('galaxy.commander.endsUnknown') : untilReady(hoursLeft * 60)} />
        </div>
        <p className="gk-acct__note">{t('galaxy.commander.wipeNote')}</p>

        <SectionTag as="h3">{t('menu.accountHeading')}</SectionTag>
        <div className="gk-acct__doors">
          <DoorRow glyph="lock" title={t('vacation.title')} sub={t('vacation.hint')} spoken={`${t('vacation.title')}. ${t('vacation.hint')}`}
            onPress={() => { setVacationOpen(true); }} />
          <AccountSecurityEntry />
          {onCountryChange && (
            <DoorRow lead={<Flag code={country} language={language} />} title={t('country.label')} value={where}
              spoken={`${t('country.label')}: ${where}. ${t('country.change')}`} onPress={() => { setCountryPickerOpen(true); }} />
          )}
        </div>

        <nav aria-label={t('landing.publicLinksLabel')} className="gk-acct__links">
          {([['privacy', 'landing.privacyLink'], ['terms', 'landing.termsLink'], ['contact', 'landing.contactLink']] as const).map(([page, label]) => (
            <a key={page} className="gk-acct__link" href={publisherUrl(page, i18n.resolvedLanguage)}>{t(label)}</a>
          ))}
        </nav>
        <GameButton tone="ghost" wide glyph="back" onPress={onSignOut}>{t('galaxy.commander.signOut')}</GameButton>
        <AccountDeletionEntry />
        {countryPickerOpen && onCountryChange && <CountryPicker value={country} onSelect={(next) => { setCountryPickerOpen(false); void onCountryChange(next); }} onClose={() => { setCountryPickerOpen(false); }} />}
        {vacationOpen && <VacationSheet onClose={() => { setVacationOpen(false); }} />}
        {legacyOpen && <LegacyProfileSheet source={{ kind: 'me' }} name={name} onClose={() => { setLegacyOpen(false); }} />}
      </section>
    </Sheet>
  );
}

/** Where the commander stands in time and space: a painted scene behind what it is, its name, a note. */
function Place({ art, label, value, sub, marks }: { art: AtmosphereArt; label: string; value: string; sub?: string; marks: Record<`data-${string}`, string> }) {
  return (
    <div className="gk-acct__place" {...marks}>
      <AtmosphereImage art={art} />
      <span className="gk-label">{label}</span>
      <span className="gk-acct__placevalue gk-display gk-num gk-outlined">{value}</span>
      {sub !== undefined && <span className="gk-acct__placesub">{sub}</span>}
    </div>
  );
}
