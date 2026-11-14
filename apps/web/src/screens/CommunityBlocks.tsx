import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { readsForPrivateEvent } from '../session/shardEvents.js';
import { Banner, EmptyState, GameButton, GameHold, artIconSrc } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';

function refreshSocialViews(queries: QueryClient) {
  for (const queryKey of readsForPrivateEvent('private:community-block') ?? []) void queries.invalidateQueries({ queryKey });
}
export interface BlockSubject { playerId: string; username: string }

/** A commander's crest in a list of names: the first letters of up to two words. */
export function crestOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0] ?? '').join('').toLocaleUpperCase();
}

/** ONE COMMANDER IN A LIST (C4): their crest, their name, and the one thing to do about them. */
export function PersonRow({ name, action }: { name: string; action: ReactNode }) {
  return (
    <li className="gk-person">
      <span className="gk-avatar gk-display gk-outlined" aria-hidden="true">{crestOf(name)}</span>
      <span className="gk-person__name">{name}</span>
      {action}
    </li>
  );
}

/**
 * BLOCKING A PLAYER (C4): what it does, then a short red hold — the hold is the "are you sure",
 * so no box to tick. The answer is the kit's good banner.
 */
export function BlockPlayerSheet({ subject, onClose, onBlocked }: { subject: BlockSubject; onClose: () => void; onBlocked?: () => void }) {
  const api = useApi(); const queries = useQueryClient(); const { t } = useTranslation();
  const [done, setDone] = useState(false); const [problem, setProblem] = useState(false); const active = useRef(false);
  const block = async () => {
    if (active.current || done) return;
    active.current = true; setProblem(false);
    try { const result = await api.blockCommunityPlayer(subject.playerId); if (!result.blocked) throw new Error('Block was not confirmed'); setDone(true); onBlocked?.(); refreshSocialViews(queries); }
    catch { setProblem(true); } finally { active.current = false; }
  };
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet title={t('moderation.blocks.action')} placement="dialog" detents={['full']} onClose={onClose} onBack={onClose}>
      <div className="gk grid gap-4 pb-3">
        <div className="grid gap-2">
          <p className="gk-display break-words text-figure">{subject.username}</p>
          <p className="gk-copy">{t('moderation.blocks.scope')}</p>
          <p className="gk-note">{t('moderation.blocks.history')}</p>
        </div>
        {done ? <>
          <Banner tone="good" glyph="check" role="status" title={t('moderation.blocks.done')} />
          <GameButton wide tone="action" onPress={onClose}>{t('moderation.close')}</GameButton>
        </> : <>
          {problem ? <p role="alert" className="text-v2-warn">{t('moderation.blocks.failed')}</p> : null}
          <GameHold tone="danger" glyph="block" weight="reversible" label={t('moderation.blocks.submit')} onCommit={() => { void block(); }} />
        </>}
      </div>
    </Sheet>
  </div>, document.body);
}

/** THE BLOCKED LIST (C4): each commander a row with their own unblock key; an empty list says how to add one. */
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
      <div className="gk grid gap-3 pb-3">
        <p className="gk-copy">{t('moderation.blocks.scope')}</p>
        <p className="gk-note">{t('moderation.blocks.legacy')}</p>
        {list.isPending ? <p className="gk-copy">{t('moderation.blocks.loading')}</p> : list.isError ? <>
          <p role="alert" className="text-v2-warn">{t('moderation.blocks.unavailable')}</p>
          <div><GameButton size="sm" glyph="refresh" onPress={() => { void list.refetch(); }}>{t('moderation.blocks.retry')}</GameButton></div>
        </> : list.data.blocks.length ? <ul className="grid gap-1.5">{list.data.blocks.map(block => (
          <PersonRow key={block.accountId} name={block.username} action={(
            <GameButton size="sm" spoken={t('moderation.blocks.unblock', { name: block.username })} pending={busy === block.accountId}
              onPress={() => { void unblock(block.accountId); }}>{t('moderation.blocks.unblockShort')}</GameButton>
          )} />
        ))}</ul> : <EmptyState art={artIconSrc('menu-friends')} title={t('moderation.blocks.empty')} body={t('moderation.blocks.emptyHint')} />}
        {problem ? <p role="alert" className="text-v2-warn">{t('moderation.blocks.unblockFailed')}</p> : null}
      </div>
    </Sheet>
  </div>, document.body);
}
