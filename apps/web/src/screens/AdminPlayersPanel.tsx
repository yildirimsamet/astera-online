import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Resources } from '@astera/rules';
import { useAdminChatScopes, useAdminModeration, useAdminPlayers } from '../api/adminQueries.js';
import { MODERATED_CHANNELS, type ModeratedChannel, type MuteDuration } from '../api/adminSchemas.js';
import { describeError } from '../i18n/errors.js';
import { currentLanguage } from '../i18n/index.js';
import { isLanguage, LANGUAGES, LANGUAGE_LABEL, type Language } from '../i18n/languages.js';
import { full } from '../lib/format.js';
import { Button, Note, SectionHead } from '../v2/kit/Surface.js';
import { Waiting, Unreachable } from '../ui/kit/index.js';

const FIELD = 'h-10 w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink outline-none focus:border-v2-self disabled:opacity-50';
const DURATIONS = ['5m', '15m', '1h', '4h', '1d', 'permanent'] as const;

export function AdminPlayersPanel() {
  const { t } = useTranslation();
  const players = useAdminPlayers();
  const scopes = useAdminChatScopes();
  const { mute, mask } = useAdminModeration();
  const [username, setUsername] = useState('');
  const [channels, setChannels] = useState<ModeratedChannel[]>(['general']);
  const [duration, setDuration] = useState<MuteDuration>('5m');
  const [maskChannel, setMaskChannel] = useState<'general' | 'clan'>('general');
  const [galaxy, setGalaxy] = useState('');
  const [clan, setClan] = useState('');
  const [language, setLanguage] = useState<Language>(currentLanguage);
  const [count, setCount] = useState('10');
  const [notice, setNotice] = useState('');
  const selectedGalaxy = scopes.data?.galaxies.some(row => row.seasonId === galaxy) ? galaxy : scopes.data?.galaxies[0]?.seasonId ?? '';
  const selectedClan = scopes.data?.clans.some(row => row.id === clan) ? clan : scopes.data?.clans[0]?.id ?? '';
  const busy = mute.isPending || mask.isPending;
  const validCount = Number.isInteger(Number(count)) && Number(count) >= 1 && Number(count) <= 500;
  const error = mute.error ?? mask.error;
  const channelName = { general: t('chat.general'), clan: t('chat.clan'), dm: t('chat.dm.title') };
  const clearResult = (): void => { setNotice(''); mute.reset(); mask.reset(); };
  const applyMute = (nextDuration: MuteDuration): void => {
    if (busy || !username.trim() || channels.length === 0) return;
    clearResult();
    mute.mutate({ username: username.trim(), channels, duration: nextDuration }, { onSuccess: () => {
      setNotice(t(nextDuration === 'remove' ? 'community.admin.ops.unmuted' : 'community.admin.ops.muted'));
    } });
  };

  return <div className="flex flex-col gap-5 pt-1">
    <section className="flex flex-col gap-2">
      <SectionHead label={t('community.admin.ops.online')} aside={<Button size="sm" disabled={players.isFetching} onClick={() => { void players.refetch(); }}>{t('community.admin.ops.refresh')}</Button>} />
      <p className="text-micro text-v2-ink-3">{t('community.admin.ops.onlineWindow', { minutes: players.data?.pages[0]?.onlineWindowMinutes ?? 5 })}</p>
      {players.isError ? <Unreachable what={t('community.admin.ops.online')} onRetry={() => { void players.refetch(); }} />
        : !players.data ? <Waiting>{t('community.admin.ops.loading')}</Waiting>
          : <>
            <p className="text-micro text-v2-ink-3">{t('community.admin.ops.measured', { time: players.data.pages[0]?.measuredAt.toLocaleTimeString() })}</p>
            {players.data.pages.every(page => page.players.length === 0) ? <Note>{t('community.admin.ops.empty')}</Note> : null}
            <div className="grid gap-2 md:grid-cols-2">
              {players.data.pages.flatMap(page => page.players).map(player => <article key={player.playerId} className="min-w-0 rounded-control border border-v2-line-hi bg-v2-panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h3 className="break-words text-caption font-semibold text-v2-ink">{player.displayName}</h3><p className="break-words text-micro text-v2-ink-3">@{player.username} · {player.galaxy}</p></div>
                  <Button size="sm" disabled={busy} ariaLabel={t('community.admin.ops.moderate', { name: player.displayName })} onClick={() => {
                    clearResult(); setUsername(player.username); setGalaxy(player.seasonId);
                    document.getElementById('admin-moderation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}>{t('community.admin.ops.manage')}</Button>
                </div>
                <div className="mt-3 grid gap-2">
                  <ResourceRow label={t('community.admin.ops.storage')} values={player.resources.storage} />
                  <ResourceRow label={t('community.admin.ops.buffer')} values={player.resources.buffer} />
                </div>
                <div className="mt-3 border-t border-v2-line pt-2 text-micro">
                  <p className="text-v2-ink-3">{t('community.admin.ops.last24h')}</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-v2-ink">
                    <p>{t('community.admin.ops.asteroids', { count: player.activity.asteroidDispatches })}<span className="block font-v2-mono text-v2-self">{t('community.admin.ops.miners', { count: player.activity.minersSent })}</span></p>
                    <p>{t('community.admin.ops.pirates', { count: player.activity.pirateDispatches })}<span className="block font-v2-mono text-v2-self">{t('community.admin.ops.ships', { count: player.activity.pirateShipsSent })}</span></p>
                  </div>
                </div>
                {player.mutes.length ? <p className="mt-2 break-words text-micro text-v2-warn">{t('community.admin.ops.activeMutes', { channels: player.mutes.map(item => `${channelName[item.channel]} · ${item.expiresAt ? item.expiresAt.toLocaleString() : t('community.admin.ops.permanent')}`).join(' / ') })}</p> : null}
              </article>)}
            </div>
            {players.hasNextPage ? <Button disabled={players.isFetchingNextPage} onClick={() => { void players.fetchNextPage(); }}>{t('community.admin.ops.more')}</Button> : null}
          </>}
    </section>

    <section id="admin-moderation" className="flex scroll-mt-3 flex-col gap-3 rounded-control border border-v2-line-hi bg-v2-deep p-3">
      <SectionHead label={t('community.admin.ops.moderation')} />
      <label className="flex flex-col gap-1 text-micro text-v2-ink-3">{t('community.admin.ops.username')}
        <input value={username} maxLength={64} disabled={busy} className={FIELD} onChange={event => { setUsername(event.currentTarget.value); clearResult(); }} />
      </label>
      <p className="text-micro text-v2-ink-3">{t('community.admin.ops.usernameHint')}</p>
      <fieldset disabled={busy} className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-2 text-micro text-v2-ink-3">{t('community.admin.ops.muteChannels')}</legend>
        {MODERATED_CHANNELS.map(channel => <label key={channel} className="flex min-h-8 items-center gap-2 text-caption text-v2-ink">
          <input type="checkbox" className="size-4 accent-cyan-400" checked={channels.includes(channel)} onChange={event => {
            const checked = event.currentTarget.checked;
            clearResult(); setChannels(current => checked ? [...current, channel] : current.filter(item => item !== channel));
          }} />{channelName[channel]}
        </label>)}
      </fieldset>
      <label className="flex flex-col gap-1 text-micro text-v2-ink-3">{t('community.admin.ops.duration')}
        <select className={FIELD} disabled={busy} value={duration} onChange={event => {
          const value = DURATIONS.find(item => item === event.currentTarget.value);
          if (value) { clearResult(); setDuration(value); }
        }}>{DURATIONS.map(value => <option key={value} value={value}>{t(`community.admin.ops.durations.${value}`)}</option>)}</select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" disabled={busy || !username.trim() || channels.length === 0} onClick={() => { applyMute(duration); }}>{t('community.admin.ops.mute')}</Button>
        <Button disabled={busy || !username.trim() || channels.length === 0} onClick={() => { applyMute('remove'); }}>{t('community.admin.ops.unmute')}</Button>
      </div>
      <div className="mt-1 border-t border-v2-line pt-3">
        <p className="mb-3 text-micro text-v2-ink-3">{t('community.admin.ops.maskHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-micro text-v2-ink-3">{t('community.admin.ops.maskChannel')}
            <select disabled={busy} className={FIELD} value={maskChannel} onChange={event => {
              if (event.currentTarget.value === 'general' || event.currentTarget.value === 'clan') { setMaskChannel(event.currentTarget.value); clearResult(); }
            }}><option value="general">{t('chat.general')}</option><option value="clan">{t('chat.clan')}</option></select>
          </label>
          <label className="flex flex-col gap-1 text-micro text-v2-ink-3">{t('community.admin.ops.messageCount')}
            <input disabled={busy} className={FIELD} type="number" min={1} max={500} step={1} value={count} onChange={event => { setCount(event.currentTarget.value); clearResult(); }} />
          </label>
        </div>
        {scopes.isError ? <Unreachable what={t('community.admin.ops.channels')} onRetry={() => { void scopes.refetch(); }} /> : null}
        {maskChannel === 'general' ? <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-micro text-v2-ink-3">{t('community.admin.ops.galaxy')}
            <select disabled={busy} className={FIELD} value={selectedGalaxy} onChange={event => { setGalaxy(event.currentTarget.value); clearResult(); }}>{scopes.data?.galaxies.map(row => <option key={row.seasonId} value={row.seasonId}>{row.name}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-micro text-v2-ink-3">{t('chat.languageLabel')}
            <select disabled={busy} className={FIELD} value={language} onChange={event => { if (isLanguage(event.currentTarget.value)) { setLanguage(event.currentTarget.value); clearResult(); } }}>{LANGUAGES.map(value => <option key={value} value={value}>{LANGUAGE_LABEL[value]}</option>)}</select>
          </label>
        </div> : <label className="mt-2 flex flex-col gap-1 text-micro text-v2-ink-3">{t('community.admin.ops.clanChannel')}
          <select disabled={busy} className={FIELD} value={selectedClan} onChange={event => { setClan(event.currentTarget.value); clearResult(); }}>{scopes.data?.clans.map(row => <option key={row.id} value={row.id}>[{row.tag}] {row.name} · {row.galaxy}</option>)}</select>
        </label>}
        <Button className="mt-3" full disabled={busy || !username.trim() || !validCount || !(maskChannel === 'general' ? selectedGalaxy : selectedClan)} onClick={() => {
          clearResult();
          mask.mutate({ username: username.trim(), count: Number(count), ...(maskChannel === 'general'
            ? { channel: 'general', seasonId: selectedGalaxy, language } : { channel: 'clan', clanId: selectedClan }) }, {
            onSuccess: result => { setNotice(t('community.admin.ops.masked', { count: result.masked })); },
          });
        }}>{t('community.admin.ops.mask')}</Button>
      </div>
      {busy ? <p className="text-caption text-v2-ink-3">{t('community.admin.ops.saving')}</p> : null}
      {error ? <p role="alert" className="text-caption text-v2-warn">{describeError(error)}</p> : null}
      {notice ? <p role="status" className="text-caption text-v2-self">{notice}</p> : null}
    </section>
  </div>;
}

function ResourceRow({ label, values }: { label: string; values: Resources }) {
  const { t } = useTranslation();
  return <div><p className="mb-1 text-micro text-v2-ink-3">{label}</p><dl className="grid grid-cols-3 gap-1 text-micro">
    {(['alloy', 'crystal', 'deuterium'] as const).map(resource => <div key={resource} className="min-w-0"><dt className="text-v2-ink-3">{t(`vocabulary.resource.${resource}`)}</dt><dd className="break-words font-v2-mono tabular-nums text-v2-ink">{full(values[resource])}</dd></div>)}
  </dl></div>;
}
