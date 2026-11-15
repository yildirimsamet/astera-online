import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import type { AccountSecurityStatus, SecurityChallenge } from '../api/schemas.js';
import { securityChallengeSchema } from '../api/schemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { useNow } from '../lib/time.js';
import { Banner, DoorRow, GameButton, Well } from '../game-ui/index.js';
import { SecurityField, useSecurityError } from './securityFields.js';

const securityKey = ['account-security'] as const;
export function AccountSecurityEntry() {
  const api = useApi(); const { t } = useTranslation(); const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: securityKey, queryFn: () => api.security(), retry: false, staleTime: 15_000,
    refetchInterval: query => open && query.state.data?.pending ? 5000 : false });
  const status = query.data;
  if (!status) return <DoorRow glyph="shield" title={query.isPending ? t('accountSecurity.loading') : t('accountSecurity.unavailable')}
    onPress={() => { void query.refetch(); }} />;
  if (!status.enabled && status.loginMethod === 'username') return null;
  const verified = status.loginMethod === 'email';
  return <>
    <DoorRow glyph="shield" tone={verified ? 'self' : 'warn'}
      title={verified ? status.maskedEmail : status.pending ? t('accountSecurity.pending') : t('accountSecurity.missing')}
      sub={verified ? t('accountSecurity.change') : t('accountSecurity.add')} onPress={() => { setOpen(true); }} />
    {open ? <AccountSecuritySheet status={status} onClose={() => { setOpen(false); }} refresh={() => query.refetch()} /> : null}
  </>;
}

/**
 * THE RECOVERY EMAIL (G10, C25 2026-11-15): "can I get my account back if I forget the password?"
 * What the email does and what it changes (sign-in moves to the email, it can never be removed)
 * is said before the address is typed; the code step names the mailbox it went to and what the
 * press waits for. The rules and the server's steps are unchanged.
 */
export function AccountSecuritySheet({ status, onClose, refresh }: { status: AccountSecurityStatus; onClose: () => void; refresh: () => Promise<unknown> }) {
  const api = useApi(); const { t, i18n } = useTranslation(); const describe = useSecurityError();
  const [email, setEmail] = useState(status.pending?.target ?? ''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<SecurityChallenge | null>(status.pending);
  const [problem, setProblem] = useState<string | null>(null); const [busy, setBusy] = useState(false); const active = useRef(false);
  const now = useNow();
  const remaining = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.resendAvailableAt) - now) / 1000)) : 0;
  const perform = async (action: () => Promise<void>): Promise<void> => {
    if (active.current) return; active.current = true; setBusy(true); setProblem(null);
    try { await action(); } catch (error) { setProblem(describe(error)); } finally { active.current = false; setBusy(false); }
  };
  const submit = async (): Promise<void> => {
    if (!challenge) {
      const result = await api.securityRequest(email, password, i18n.language.split('-')[0] ?? 'en', status.loginMethod === 'email');
      setChallenge(result); setPassword(''); await refresh();
    } else if (challenge.purpose !== 'reset') {
      const result = await api.securityVerify(challenge.challengeId, code, challenge.purpose);
      setCode('');
      if (result.reauthenticate) { api.endSession('email', email); onClose(); }
      else { setChallenge(securityChallengeSchema.parse(result)); await refresh(); }
    }
  };
  const verified = status.email !== null;
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet placement="dialog" title={t('accountSecurity.title')} onBack={onClose} onClose={onClose} detents={['full']} kit={{ tone: 'self' }}>
      <form data-security-sheet className="gk-acctsheet" onSubmit={event => { event.preventDefault(); void perform(submit); }}>
        <Banner tone={verified ? 'good' : 'info'} glyph="shield" title={verified ? `${status.email ?? ''} · ${t('accountSecurity.verified')}` : t('accountSecurity.missing')}
          body={status.loginMethod === 'email' ? t('accountSecurity.irreversible') : t('accountSecurity.optional')} />
        {!status.enabled ? <p className="gk-acct__note">{t('accountSecurity.unavailable')}</p> : <>
          {!challenge ? <>
            {status.loginMethod === 'username' ? <Banner tone="warn" title={t('accountSecurity.transition')} body={t('accountSecurity.irreversible')} /> : null}
            <SecurityField label={t('accountSecurity.email')} value={email} onChange={setEmail} kind="email" autoComplete="email" disabled={busy} />
            <SecurityField label={t('accountSecurity.currentPassword')} value={password} onChange={setPassword} kind="password" autoComplete="current-password" disabled={busy} />
          </> : <>
            {challenge.purpose === 'bind' ? <Banner tone="warn" title={t('accountSecurity.transition')} /> : null}
            <Well className="gk-acctsheet__mail">
              <span className="gk-acct__note">{challenge.purpose === 'change_old' ? t('accountSecurity.oldCode') : challenge.purpose === 'change_new' ? t('accountSecurity.newCode') : t('accountSecurity.saved')}</span>
              <span className="gk-acctsheet__address gk-num">{challenge.purpose === 'change_old' ? status.email : email}</span>
            </Well>
            <SecurityField label={t('accountSecurity.code')} value={code} onChange={setCode} kind="code" disabled={busy} />
            <p className="gk-acctsheet__fine">{t('accountSecurity.expireHint')}</p>
            {status.pending?.deliveryStatus === 'failed' || status.pending?.deliveryStatus === 'cancelled' ? <Banner tone="hostile" role="alert" title={t('accountSecurity.deliveryFailed')} /> : null}
          </>}
          {problem ? <Banner tone="hostile" role="alert" title={problem} /> : null}
          <GameButton submit tone="action" size="lg" wide pending={busy} onPress={() => undefined}
            disabledReason={challenge !== null && code.length !== 6 ? t('accountSecurity.codeNeeded') : null}>
            {challenge ? challenge.purpose === 'change_old' ? t('accountSecurity.confirmOld') : t('accountSecurity.verify') : t('accountSecurity.send')}
          </GameButton>
          {challenge ? <>
            <GameButton wide pending={busy} disabledReason={remaining > 0 ? t('accountSecurity.expiry', { seconds: remaining }) : null}
              onPress={() => { void perform(async () => { setChallenge(await api.securityResend(challenge.challengeId)); setCode(''); await refresh(); }); }}>
              {t('accountSecurity.resend')}
            </GameButton>
            <GameButton wide tone="ghost" pending={busy} onPress={() => { void perform(async () => { await api.securityCancel(challenge.challengeId); setChallenge(null); setCode(''); await refresh(); }); }}>
              {t('accountSecurity.cancel')}
            </GameButton>
          </> : null}
        </>}
      </form>
    </Sheet>
  </div>, document.body);
}
