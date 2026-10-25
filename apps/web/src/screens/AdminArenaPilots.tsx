import { useId, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminArenaPilots, useAdminSetArenaPilot } from '../api/adminQueries.js';
import { ApiError } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { Button, Note, SectionHead } from '../v2/kit/Surface.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';

const FIELD = 'h-10 min-w-0 flex-1 rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self disabled:opacity-50';

/**
 * KOMUTAN GEMISI SEATS, BY NAME (owner 2026-10-20). A seated commander sees "Join" in
 * the menu and may fly the playtest arena; nobody else sees the door at all.
 */
export function AdminArenaPilots() {
  const { t } = useTranslation();
  const id = useId();
  const pilots = useAdminArenaPilots();
  const seat = useAdminSetArenaPilot();
  const [commander, setCommander] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const change = (username: string, pilot: boolean, onDone?: () => void): void => {
    if (seat.isPending) return;
    setNotice(null);
    seat.mutate({ username, pilot }, {
      onSuccess: result => {
        onDone?.();
        setNotice({ tone: 'ok', text: t(pilot ? 'community.admin.arena.added' : 'community.admin.arena.removed', { name: result.username }) });
      },
      onError: fault => {
        setNotice({ tone: 'error', text: fault instanceof ApiError && fault.code === 'ACCOUNT_NOT_FOUND'
          ? t('community.admin.arena.noAccount', { name: username }) : describeError(fault) });
      },
    });
  };
  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const username = commander.trim();
    if (username.length < 2) return;
    change(username, true, () => { setCommander(''); });
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pt-1">
      <Note>{t('community.admin.arena.intro')}</Note>
      <form onSubmit={submit} className="flex flex-col gap-1.5" aria-busy={seat.isPending}>
        <label htmlFor={id} className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('community.admin.arena.commander')}</label>
        <div className="flex gap-2">
          <input id={id} value={commander} maxLength={32} autoComplete="off" disabled={seat.isPending} className={FIELD}
            placeholder={t('community.admin.arena.placeholder')}
            onChange={event => { setCommander(event.currentTarget.value); setNotice(null); }} />
          <Button type="submit" variant="primary" disabled={seat.isPending || commander.trim().length < 2}>{t('community.admin.arena.add')}</Button>
        </div>
      </form>
      {notice?.tone === 'error' && <p role="alert" className="text-caption text-v2-warn">{notice.text}</p>}
      {notice?.tone === 'ok' && <p role="status" className="text-caption text-v2-self">{notice.text}</p>}

      <section className="flex flex-col gap-2">
        <SectionHead label={t('community.admin.arena.listLabel')} aside={pilots.data ? String(pilots.data.pilots.length) : undefined} />
        {pilots.isError ? <Unreachable what={t('community.admin.arena.listLabel')} onRetry={() => { void pilots.refetch(); }} />
          : !pilots.data ? <Waiting>{t('community.admin.arena.loading')}</Waiting>
            : pilots.data.pilots.length === 0 ? <p className="text-caption text-v2-ink-3">{t('community.admin.arena.empty')}</p>
              : <ul aria-label={t('community.admin.arena.listLabel')} className="flex flex-col divide-y divide-v2-line rounded-control border border-v2-line-hi bg-v2-panel">
                {pilots.data.pilots.map(pilot => (
                  <li key={pilot.accountId} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-caption font-semibold text-v2-ink">{pilot.name}</span>
                      <span className="block truncate text-micro text-v2-ink-3">
                        @{pilot.username} · {t('community.admin.arena.since', { date: pilot.grantedAt.toLocaleDateString() })}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" disabled={seat.isPending}
                      ariaLabel={t('community.admin.arena.remove', { name: pilot.name })}
                      onClick={() => { change(pilot.username, false); }}>{t('community.admin.arena.removeShort')}</Button>
                  </li>
                ))}
              </ul>}
      </section>
    </div>
  );
}
