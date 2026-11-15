import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { SecurityField, useSecurityError } from './securityFields.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { matchLanguage } from '../i18n/languages.js';
import { Banner, DoorRow, GameButton, GameHold, Toggle, Well } from '../game-ui/index.js';

const deletionKey = ['account-deletion'] as const;

/** Available with or without a recovery email and before choosing a galaxy. */
export function AccountDeletionEntry() {
  const { t } = useTranslation(); const [open, setOpen] = useState(false);
  return <>
    <DoorRow glyph="block" tone="hostile" title={t('accountDeletion.title')} onPress={() => { setOpen(true); }} />
    {open ? <AccountDeletionSheet onClose={() => { setOpen(false); }} /> : null}
  </>;
}

/**
 * DELETING THE ACCOUNT (G10, C25 2026-11-15): "what goes, when, and is this really what I want?"
 * What is deleted and when is said first; the steps before the request stay — the current
 * password and the switch that says the commander understands — and the request itself is the
 * kit's final hold (1.5 s, red), since it cannot be undone. No key press sends it.
 */
export function AccountDeletionSheet({ onClose }: { onClose: () => void }) {
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
  const waiting = busy ? t('accountDeletion.loading') : !password ? t('accountDeletion.needPassword') : !confirmed ? t('accountDeletion.needConfirm') : null;
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet placement="dialog" title={t('accountDeletion.title')} onBack={onClose} onClose={onClose} detents={['full']} kit={{ tone: 'hostile' }}>
      <div data-deletion-sheet className="gk-acctsheet">
        <p className="gk-copy">{t('accountDeletion.scope')}</p>
        <Banner tone="warn" glyph="clock" title={t('accountDeletion.timing')} />
        <a className="gk-acct__link" href={publisherUrl('accountDeletion', i18n.resolvedLanguage)}>{t('accountDeletion.details')}</a>
        {query.isPending ? <p className="gk-acct__note">{t('accountDeletion.loading')}</p> : query.isError ? <>
          <Banner tone="hostile" role="alert" title={t('accountDeletion.unavailable')} />
          <GameButton wide onPress={() => { void query.refetch(); }}>{t('accountDeletion.retry')}</GameButton>
        </> : request ? <>
          <Banner tone="good" role="status" title={t('accountDeletion.received')} body={t('accountDeletion.pending')} />
          <Well className="gk-acctsheet__mail">
            <span className="gk-label">{t('accountDeletion.receipt')}</span>
            <span className="gk-acctsheet__address gk-acctsheet__receipt gk-num">{request.requestId}</span>
          </Well>
        </> : <div className="gk-acctsheet__form">
          <SecurityField label={t('accountDeletion.password')} kind="password" value={password} onChange={setPassword} autoComplete="current-password" disabled={busy} />
          <Toggle checked={confirmed} label={t('accountDeletion.confirm')} locked={busy} onChange={setConfirmed} />
          {problem ? <Banner tone="hostile" role="alert" title={problem} /> : null}
          <GameHold weight="final" tone="danger" glyph="block" label={t('accountDeletion.submit')} disabledReason={waiting} onCommit={() => { void submit(); }} />
        </div>}
        <GameButton wide tone="ghost" onPress={onClose}>{t('accountDeletion.close')}</GameButton>
      </div>
    </Sheet>
  </div>, document.body);
}
