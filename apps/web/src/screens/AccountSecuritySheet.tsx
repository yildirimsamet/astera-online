import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import type { AccountSecurityStatus, SecurityChallenge } from '../api/schemas.js';
import { securityChallengeSchema } from '../api/schemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button, Note } from '../v2/kit/Surface.js';
import { ShieldIcon, ChevronIcon } from '../ui/icons/index.js';
import { useNow } from '../lib/time.js';
import { SecurityField, useSecurityError } from './securityFields.js';

const securityKey = ['account-security'] as const;
export function AccountSecurityEntry() {
  const api = useApi(); const { t } = useTranslation(); const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: securityKey, queryFn: () => api.security(), retry: false, staleTime: 15_000,
    refetchInterval: query => open && query.state.data?.pending ? 5000 : false });
  const status = query.data;
  if (!status) return <button type="button" className="w-full rounded-control border border-v2-line px-3 py-2 text-left text-caption text-v2-ink-2"
    onClick={() => { void query.refetch(); }}>{query.isPending ? t('accountSecurity.loading') : t('accountSecurity.unavailable')}</button>;
  if (!status.enabled && status.loginMethod === 'username') return null;
  const verified = status.loginMethod === 'email';
  return <>
    <button type="button" onClick={() => { setOpen(true); }}
      className={`flex min-h-16 w-full items-center gap-3 rounded-control border px-3 py-3 text-left ${verified ? 'border-v2-self/30 bg-v2-self/5' : 'border-v2-hostile/50 bg-v2-hostile/10'}`}>
      <ShieldIcon className={`size-6 shrink-0 ${verified ? 'text-v2-self' : 'text-v2-hostile'}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={`text-caption font-semibold ${verified ? 'text-v2-self' : 'text-v2-hostile'}`}>{verified ? status.maskedEmail : status.pending ? t('accountSecurity.pending') : t('accountSecurity.missing')}</span>
        <span className="text-micro text-v2-ink-2">{verified ? t('accountSecurity.change') : t('accountSecurity.add')}</span>
      </span><ChevronIcon className="size-4 text-v2-ink-3" />
    </button>
    {open ? <AccountSecuritySheet status={status} onClose={() => { setOpen(false); }} refresh={() => query.refetch()} /> : null}
  </>;
}
function AccountSecuritySheet({ status, onClose, refresh }: { status: AccountSecurityStatus; onClose: () => void; refresh: () => Promise<unknown> }) {
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
      if (result.reauthenticate) { api.endSession('email'); onClose(); }
      else { setChallenge(securityChallengeSchema.parse(result)); await refresh(); }
    }
  };
  return createPortal(<div className="[--v2-top-h:0px] [--v2-dock-h:0px]">
    <Sheet placement="dialog" title={t('accountSecurity.title')} onBack={onClose} onClose={onClose} detents={['full']}>
      <form className="flex flex-col gap-4 pb-4" onSubmit={event => { event.preventDefault(); void perform(submit); }}>
        <div className="rounded-control border border-v2-self/25 bg-v2-self/5 p-3">
          <ShieldIcon className="mb-2 size-7 text-v2-self" />
          <p className="text-caption leading-relaxed text-v2-ink">{status.loginMethod === 'email' ? t('accountSecurity.irreversible') : t('accountSecurity.optional')}</p>
        </div>
        {status.email ? <p className="break-all font-v2-mono text-caption text-v2-self">{status.email} · {t('accountSecurity.verified')}</p> : null}
        {!status.enabled ? <Note>{t('accountSecurity.unavailable')}</Note> : <>
          {!challenge ? <>
            {status.loginMethod === 'username' ? <div className="rounded-control border border-v2-warn/40 bg-v2-warn/5 p-3 text-caption leading-relaxed text-v2-ink">
              {t('accountSecurity.transition')}
              <p className="mt-2 text-v2-ink-2">{t('accountSecurity.irreversible')}</p>
            </div> : null}
            <SecurityField label={t('accountSecurity.email')} value={email} onChange={setEmail} kind="email" autoComplete="email" disabled={busy} />
            <SecurityField label={t('accountSecurity.currentPassword')} value={password} onChange={setPassword} kind="password" autoComplete="current-password" disabled={busy} />
          </> : <>
            {challenge.purpose === 'bind' ? <p className="rounded-control border border-v2-warn/40 bg-v2-warn/5 p-3 text-caption leading-relaxed text-v2-ink">{t('accountSecurity.transition')}</p> : null}
            <p className="text-caption leading-relaxed text-v2-ink-2">{challenge.purpose === 'change_old' ? t('accountSecurity.oldCode') : challenge.purpose === 'change_new' ? t('accountSecurity.newCode') : t('accountSecurity.saved')}</p>
            <p className="break-all font-v2-mono text-caption text-v2-ink">{challenge.purpose === 'change_old' ? status.email : email}</p>
            <SecurityField label={t('accountSecurity.code')} value={code} onChange={setCode} kind="code" disabled={busy} />
            <Note>{t('accountSecurity.expireHint')}</Note>
            {status.pending?.deliveryStatus === 'failed' || status.pending?.deliveryStatus === 'cancelled' ? <p role="alert" className="text-caption text-v2-hostile">{t('accountSecurity.deliveryFailed')}</p> : null}
          </>}
          {problem ? <p role="alert" className="text-caption leading-relaxed text-v2-hostile">{problem}</p> : null}
          <Button full type="submit" variant="primary" disabled={busy || (challenge !== null && code.length !== 6)}>
            {challenge ? challenge.purpose === 'change_old' ? t('accountSecurity.confirmOld') : t('accountSecurity.verify') : t('accountSecurity.send')}
          </Button>
          {challenge ? <>
            <Button full disabled={busy || remaining > 0} onClick={() => { void perform(async () => { setChallenge(await api.securityResend(challenge.challengeId)); setCode(''); await refresh(); }); }}>
              {remaining > 0 ? t('accountSecurity.expiry', { seconds: remaining }) : t('accountSecurity.resend')}
            </Button>
            <Button full variant="ghost" disabled={busy} onClick={() => { void perform(async () => { await api.securityCancel(challenge.challengeId); setChallenge(null); setCode(''); await refresh(); }); }}>{t('accountSecurity.cancel')}</Button>
          </> : null}
        </>}
      </form>
    </Sheet>
  </div>, document.body);
}
