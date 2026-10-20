import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { readsForPrivateEvent } from '../session/shardEvents.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button } from '../v2/kit/Surface.js';

function refreshSocialViews(queries: QueryClient) {
  for (const queryKey of readsForPrivateEvent('private:community-block') ?? []) void queries.invalidateQueries({ queryKey });
}
export interface BlockSubject { playerId: string; username: string }
export function BlockPlayerSheet({ subject, onClose, onBlocked }: { subject: BlockSubject; onClose: () => void; onBlocked?: () => void }) {
  const api = useApi(); const queries = useQueryClient(); const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [problem, setProblem] = useState(false); const active = useRef(false);
  const block = async () => {
    if (!confirmed || active.current || done) return;
    active.current = true; setBusy(true); setProblem(false);
    try { const result = await api.blockCommunityPlayer(subject.playerId); if (!result.blocked) throw new Error('Block was not confirmed'); setDone(true); onBlocked?.(); refreshSocialViews(queries); }
    catch { setProblem(true); } finally { active.current = false; setBusy(false); }
  };
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet title={t('moderation.blocks.action')} placement="dialog" detents={['full']} onClose={onClose} onBack={onClose}>
      <div className="grid gap-3 pb-3">
        <p className="break-words text-caption font-semibold text-v2-ink">{subject.username}</p>
        <p className="text-caption leading-relaxed text-v2-ink-2">{t('moderation.blocks.scope')}</p>
        <p className="text-caption leading-relaxed text-v2-ink-2">{t('moderation.blocks.history')}</p>
        {done ? <p role="status" className="rounded-control border border-v2-self/30 bg-v2-self/5 p-3 text-caption font-semibold text-v2-self">{t('moderation.blocks.done')}</p> : <>
          <label className="flex min-h-11 items-start gap-3 text-caption text-v2-ink-2"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-v2-self" checked={confirmed} disabled={busy} onChange={event => { setConfirmed(event.target.checked); }} />{t('moderation.blocks.confirm')}</label>
          {problem ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.blocks.failed')}</p> : null}
          <Button full variant="primary" disabled={!confirmed || busy} onClick={() => { void block(); }}>{t('moderation.blocks.submit')}</Button>
        </>}
        <Button full variant="ghost" onClick={onClose}>{t('moderation.close')}</Button>
      </div>
    </Sheet>
  </div>, document.body);
}
export function BlockedPlayersSheet({ onClose }: { onClose: () => void }) {
  const api = useApi(); const queries = useQueryClient(); const { t } = useTranslation();
  const list = useQuery({ queryKey: keys.communityBlocks, queryFn: () => api.communityBlocks(), retry: false, staleTime: 0 });
  const [busy, setBusy] = useState<string | null>(null); const [problem, setProblem] = useState(false); const active = useRef(false);
  const unblock = async (accountId: string) => {
    if (active.current) return; active.current = true; setBusy(accountId); setProblem(false);
    try { const result = await api.unblockCommunityAccount(accountId); if (result.blocked) throw new Error('Unblock was not confirmed'); refreshSocialViews(queries); }
    catch { setProblem(true); } finally { active.current = false; setBusy(null); }
  };
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet title={t('moderation.blocks.title')} placement="dialog" detents={['full']} onClose={onClose} onBack={onClose}>
      <div className="grid gap-3 pb-3">
        <p className="text-caption leading-relaxed text-v2-ink-2">{t('moderation.blocks.scope')}</p>
        <p className="text-caption leading-relaxed text-v2-ink-3">{t('moderation.blocks.legacy')}</p>
        {list.isPending ? <p className="text-caption text-v2-ink-2">{t('moderation.blocks.loading')}</p> : list.isError ? <>
          <p role="alert" className="text-caption text-v2-warn">{t('moderation.blocks.unavailable')}</p>
          <Button onClick={() => { void list.refetch(); }}>{t('moderation.blocks.retry')}</Button>
        </> : list.data.blocks.length ? <ul className="grid gap-2">{list.data.blocks.map(block => <li key={block.accountId} className="flex min-w-0 items-center gap-3 rounded-control border border-v2-line bg-v2-deep p-3">
          <span className="min-w-0 flex-1 break-words text-caption font-semibold text-v2-ink">{block.username}</span>
          <Button disabled={busy !== null} ariaLabel={t('moderation.blocks.unblock', { name: block.username })} onClick={() => { void unblock(block.accountId); }}>{t('moderation.blocks.unblockShort')}</Button>
        </li>)}</ul> : <p className="py-4 text-center text-caption text-v2-ink-2">{t('moderation.blocks.empty')}</p>}
        {problem ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.blocks.unblockFailed')}</p> : null}
        <Button full variant="ghost" onClick={onClose}>{t('moderation.close')}</Button>
      </div>
    </Sheet>
  </div>, document.body);
}
