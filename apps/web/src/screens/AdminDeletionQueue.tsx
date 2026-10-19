import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import type { adminDeletionQueueSchema } from '../api/adminSchemas.js';
import { describeError } from '../i18n/errors.js';
import { matchLanguage } from '../i18n/languages.js';
import { Button, Note } from '../v2/kit/Surface.js';

const key = ['admin-account-deletion'] as const;
type Deletion = z.infer<typeof adminDeletionQueueSchema>['requests'][number];

/** Approval closes access; completion and media retries remain separate operator decisions. */
export function AdminDeletionQueue() {
  const api = useApi(); const { t } = useTranslation();
  const [notice, setNotice] = useState<{ requestId: string; message: string } | null>(null);
  const queue = useQuery({ queryKey: key, queryFn: () => api.adminDeletionQueue(), retry: false, staleTime: 0 });
  return <section className="mx-auto flex w-full max-w-xl flex-col gap-3 pt-1">
    <Note>{t('accountDeletion.admin.intro')}</Note>
    {notice && <p role="status" className="rounded-control border border-v2-self/30 bg-v2-self/5 p-3 text-caption text-v2-self">{notice.message}<span className="mt-2 block break-all font-v2-mono text-micro">{notice.requestId}</span></p>}
    {queue.isPending ? <p className="text-caption text-v2-ink-2">{t('accountDeletion.loading')}</p>
      : queue.isError ? <><p role="alert" className="text-caption text-v2-warn">{t('accountDeletion.admin.unavailable')}</p><Button onClick={() => { void queue.refetch(); }}>{t('accountDeletion.retry')}</Button></>
        : <>
          <Button size="sm" variant="ghost" disabled={queue.isFetching} onClick={() => { void queue.refetch(); }}>{t('accountDeletion.admin.refresh')}</Button>
          {queue.data.requests.length === 0 && <p className="text-caption text-v2-ink-3">{t('accountDeletion.admin.empty')}</p>}
          <ul className="grid gap-3">{queue.data.requests.map(request => <DeletionRow key={request.requestId} request={request} onCompleted={message => { setNotice({ requestId: request.requestId, message }); }} />)}</ul>
          {queue.data.mediaPending.length > 0 && <section className="grid gap-2 border-t border-v2-line pt-3">
            <h2 className="text-caption font-semibold text-v2-ink">{t('accountDeletion.admin.filesTitle')}</h2>
            <p className="text-caption text-v2-ink-2">{t('accountDeletion.admin.filesDetail')}</p>
            {queue.data.mediaPending.map(job => <MediaJob key={job.requestId} requestId={job.requestId} files={job.files} onCompleted={message => { setNotice({ requestId: job.requestId, message }); }} />)}
          </section>}
        </>}
    <SupportRequestForm onRecorded={(requestId, approved) => { setNotice({ requestId, message: t(approved ? 'accountDeletion.admin.approved' : 'accountDeletion.admin.supportRecorded') }); }} />
  </section>;
}

function SupportRequestForm({ onRecorded }: { onRecorded: (requestId: string, approved: boolean) => void }) {
  const api = useApi(); const queries = useQueryClient(); const { t, i18n } = useTranslation();
  const [username, setUsername] = useState(''); const [verified, setVerified] = useState(false);
  const active = useRef(false); const [busy, setBusy] = useState(false); const [problem, setProblem] = useState<string | null>(null);
  const record = async () => {
    if (!verified || !username.trim() || active.current) return;
    active.current = true; setBusy(true); setProblem(null);
    try {
      const result = await api.adminRecordSupportDeletion(username.trim(), matchLanguage(i18n.resolvedLanguage) ?? 'en');
      onRecorded(result.request.requestId, result.request.status === 'approved'); setUsername(''); setVerified(false);
      void queries.invalidateQueries({ queryKey: key });
    } catch (error) { setProblem(describeError(error)); }
    finally { active.current = false; setBusy(false); }
  };
  return <details className="rounded-control border border-v2-line bg-v2-deep p-3">
    <summary className="cursor-pointer text-caption font-semibold text-v2-ink">{t('accountDeletion.admin.supportTitle')}</summary>
    <form className="mt-3 grid gap-3" onSubmit={event => { event.preventDefault(); void record(); }}>
      <p className="text-caption text-v2-ink-2">{t('accountDeletion.admin.supportDetail')}</p>
      <label className="grid gap-2 text-caption text-v2-ink-2">{t('accountDeletion.admin.supportUsername')}
        <input value={username} disabled={busy} maxLength={128} autoComplete="off" spellCheck={false} onChange={event => { setUsername(event.target.value); setVerified(false); }} className="h-11 min-w-0 rounded-control border border-v2-line-hi bg-v2-panel px-3 text-caption text-v2-ink outline-none focus:border-v2-self" />
      </label>
      <label className="flex min-h-11 items-start gap-2 text-caption text-v2-ink-2"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-v2-self" checked={verified} disabled={busy} onChange={event => { setVerified(event.target.checked); }} />{t('accountDeletion.admin.supportConfirm')}</label>
      {problem && <p role="alert" className="text-caption text-v2-warn">{problem}</p>}
      <Button type="submit" disabled={!verified || !username.trim() || busy}>{t('accountDeletion.admin.supportSubmit')}</Button>
    </form>
  </details>;
}

function useDeletionAction(onCompleted: (message: string) => void) {
  const api = useApi(); const queries = useQueryClient(); const { t } = useTranslation();
  const active = useRef(false); const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = async (requestId: string, action: 'approve' | 'complete' | 'files'): Promise<boolean> => {
    if (active.current) return false;
    active.current = true; setBusy(true); setProblem(null);
    try {
      if (action === 'approve') await api.adminApproveDeletion(requestId);
      else {
        const answer = action === 'files' ? await api.adminRetryDeletionMedia(requestId) : await api.adminCompleteDeletion(requestId);
        onCompleted(t(answer.mediaCleanupPending ? 'accountDeletion.admin.filesDetail' : 'accountDeletion.admin.completed'));
      }
      // Refetch failures are displayed by the queue; they cannot undo a committed action.
      void queries.invalidateQueries({ queryKey: key });
      return true;
    } catch (error) {
      setProblem(error instanceof ApiError && error.code === 'DELETION_LEDGER_UNAVAILABLE' ? t('accountDeletion.admin.ledgerUnavailable')
        : error instanceof ApiError && ['WORLD_BUSY', 'DELETION_BUSY'].includes(error.code) ? t('accountDeletion.admin.busy') : describeError(error));
      return false;
    } finally { active.current = false; setBusy(false); }
  };
  return { run, busy, problem };
}

function DeletionRow({ request, onCompleted }: { request: Deletion; onCompleted: (message: string) => void }) {
  const { t, i18n } = useTranslation(); const action = useDeletionAction(onCompleted);
  const [confirming, setConfirming] = useState(false); const [verified, setVerified] = useState(false);
  const approved = request.status === 'approved';
  const act = async () => {
    if (!verified) return;
    if (await action.run(request.requestId, approved ? 'complete' : 'approve')) { setConfirming(false); setVerified(false); }
  };
  return <li aria-label={`${request.displayName} @${request.username}`} className="grid gap-3 rounded-control border border-v2-line bg-v2-panel p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><p className="break-words text-caption font-semibold text-v2-ink">{request.displayName} <span className="font-normal text-v2-ink-3">@{request.username}</span></p>
        <p className="mt-1 text-micro text-v2-ink-3">{new Date(request.requestedAt).toLocaleString(i18n.resolvedLanguage)}</p></div>
      <span className={`text-micro font-semibold ${approved ? 'text-v2-warn' : 'text-v2-self'}`}>{t(approved ? 'accountDeletion.admin.approved' : 'accountDeletion.admin.requested')}</span>
    </div>
    <p className="break-all select-all font-v2-mono text-micro text-v2-ink-2">{request.requestId}</p>
    {confirming ? <div className="grid gap-3 rounded-control border border-v2-warn/40 bg-v2-warn/5 p-3">
      <label className="flex min-h-11 items-start gap-2 text-caption text-v2-ink-2"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-v2-self" disabled={action.busy} checked={verified} onChange={event => { setVerified(event.target.checked); }} />{t('accountDeletion.admin.confirm')}</label>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={action.busy} onClick={() => { setConfirming(false); setVerified(false); }}>{t('accountDeletion.admin.cancel')}</Button>
        <Button disabled={!verified || action.busy} onClick={() => { void act(); }}>{t(approved ? 'accountDeletion.admin.confirmComplete' : 'accountDeletion.admin.confirmApprove')}</Button></div>
    </div> : <Button disabled={action.busy} onClick={() => { setConfirming(true); }}>{t(approved ? 'accountDeletion.admin.complete' : 'accountDeletion.admin.approve')}</Button>}
    {action.problem && <p role="alert" className="text-caption text-v2-warn">{action.problem}</p>}
  </li>;
}

function MediaJob({ requestId, files, onCompleted }: { requestId: string; files: number; onCompleted: (message: string) => void }) {
  const { t } = useTranslation(); const action = useDeletionAction(onCompleted);
  return <div className="grid gap-2 rounded-control border border-v2-warn/30 bg-v2-deep p-3">
    <p className="break-all font-v2-mono text-micro text-v2-ink-2">{requestId}</p>
    <p className="text-caption text-v2-ink-2">{t('accountDeletion.admin.files', { count: files })}</p>
    <Button disabled={action.busy} onClick={() => { void action.run(requestId, 'files'); }}>{t('accountDeletion.admin.retryFiles')}</Button>
    {action.problem && <p role="alert" className="text-caption text-v2-warn">{action.problem}</p>}
  </div>;
}
