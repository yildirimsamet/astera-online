import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button } from '../v2/kit/Surface.js';
import { SecurityField, useSecurityError } from './securityFields.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { matchLanguage } from '../i18n/languages.js';

const deletionKey = ['account-deletion'] as const;

/** Available with or without a recovery email and before choosing a galaxy. */
export function AccountDeletionEntry() {
  const { t } = useTranslation(); const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => { setOpen(true); }} className="min-h-11 w-full rounded-control border border-v2-line bg-v2-panel px-3 text-left text-caption text-v2-ink-2 hover:border-v2-line-hi focus-visible:outline-2 focus-visible:outline-v2-self">{t('accountDeletion.title')}</button>
    {open ? <AccountDeletionSheet onClose={() => { setOpen(false); }} /> : null}
  </>;
}

function AccountDeletionSheet({ onClose }: { onClose: () => void }) {
  const api = useApi(); const queries = useQueryClient(); const { t, i18n } = useTranslation(); const describe = useSecurityError();
  const query = useQuery({ queryKey: deletionKey, queryFn: () => api.accountDeletion(), retry: false, staleTime: 0 });
  const [password, setPassword] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const active = useRef(false); const [problem, setProblem] = useState<string | null>(null);
  const request = query.data?.request;
  const submit = async (): Promise<void> => {
    if (active.current || !confirmed || !password || !query.isSuccess || request) return;
    active.current = true; setBusy(true); setProblem(null);
    try {
      const result = await api.requestAccountDeletion(password, matchLanguage(i18n.resolvedLanguage) ?? 'en');
      queries.setQueryData(deletionKey, result); setPassword('');
    } catch (error) { setProblem(describe(error)); }
    finally { active.current = false; setBusy(false); }
  };
  return createPortal(<div className="[--v2-top-h:0px] [--v2-dock-h:0px]">
    <Sheet placement="dialog" title={t('accountDeletion.title')} onBack={onClose} onClose={onClose} detents={['full']}>
      <div className="flex flex-col gap-4 pb-4">
        <p className="text-caption leading-relaxed text-v2-ink">{t('accountDeletion.scope')}</p>
        <p className="rounded-control border border-v2-warn/30 bg-v2-warn/5 p-3 text-caption leading-relaxed text-v2-ink-2">{t('accountDeletion.timing')}</p>
        <a className="min-h-11 text-caption text-v2-self underline underline-offset-4" href={publisherUrl('accountDeletion', i18n.resolvedLanguage)}>{t('accountDeletion.details')}</a>
        {query.isPending ? <p className="text-caption text-v2-ink-2">{t('accountDeletion.loading')}</p> : query.isError ? <>
          <p role="alert" className="text-caption text-v2-ink-2">{t('accountDeletion.unavailable')}</p>
          <Button onClick={() => { void query.refetch(); }}>{t('accountDeletion.retry')}</Button>
        </> : request ? <div className="rounded-control border border-v2-self/30 bg-v2-self/5 p-3">
          <p role="status" className="text-caption font-semibold text-v2-self">{t('accountDeletion.received')}</p>
          <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">{t('accountDeletion.pending')}</p>
          <p className="mt-3 text-micro text-v2-ink-2">{t('accountDeletion.receipt')}</p>
          <p className="break-all select-all font-v2-mono text-micro text-v2-ink">{request.requestId}</p>
        </div> : <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <SecurityField label={t('accountDeletion.password')} kind="password" value={password} onChange={setPassword} autoComplete="current-password" disabled={busy} />
          <label className="flex min-h-11 items-start gap-3 text-caption leading-relaxed text-v2-ink-2"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-v2-self" checked={confirmed} disabled={busy} onChange={event => { setConfirmed(event.target.checked); }} />{t('accountDeletion.confirm')}</label>
          {problem ? <p role="alert" className="text-caption text-v2-hostile">{problem}</p> : null}
          <Button type="submit" full disabled={busy || !confirmed || !password} variant="primary">{t('accountDeletion.submit')}</Button>
        </form>}
        <Button full variant="ghost" onClick={onClose}>{t('accountDeletion.close')}</Button>
      </div>
    </Sheet>
  </div>, document.body);
}
