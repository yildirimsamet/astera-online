import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { securityChallengeSchema, type SecurityChallenge } from '../api/schemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { SecurityField, useSecurityError } from './securityFields.js';
import { serverNow } from '../lib/clock.js';
import { useNow } from '../lib/time.js';
import { observeRecovery } from '../lib/playerAnalytics/recovery.js';
import { useVisibleTelemetry } from '../lib/playerAnalytics/useVisibleTelemetry.js';
import { Banner, GameButton } from '../game-ui/index.js';

const RESET_STATE = 'astera:password-reset';
function savedChallenge(): SecurityChallenge | null {
  try { const raw = sessionStorage.getItem(RESET_STATE); const parsed = securityChallengeSchema.safeParse(raw ? JSON.parse(raw) : null); return parsed.success && Date.parse(parsed.data.expiresAt) > serverNow() ? parsed.data : null; }
  catch { return null; }
}
function saveChallenge(challenge: SecurityChallenge | null): void {
  try { if (challenge) sessionStorage.setItem(RESET_STATE, JSON.stringify(challenge)); else sessionStorage.removeItem(RESET_STATE); } catch { /* Metadata is optional; a fresh request remains available. */ }
}

/**
 * THE FORGOTTEN PASSWORD (C25, 2026-11-15), from the front door: the address, then the code and
 * the new password twice. What this way can and cannot recover is said before the address.
 */
export function PasswordResetSheet({ onClose }: { onClose: () => void }) {
  const presentation = useVisibleTelemetry<HTMLFormElement>('password_recovery', 'password_reset', null);
  const api = useApi(); const { t, i18n } = useTranslation(); const describe = useSecurityError();
  const [challenge, setChallenge] = useState(savedChallenge); const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState('');
  const [problem, setProblem] = useState<string | null>(null); const [busy, setBusy] = useState(false); const active = useRef(false); const now = useNow();
  const remaining = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.resendAvailableAt) - now) / 1000)) : 0;
  const restart = (): void => { saveChallenge(null); setChallenge(null); setCode(''); setPassword(''); setRepeat(''); };
  const request = async (): Promise<void> => {
    const result = await observeRecovery('request', () => api.resetRequest(email, i18n.language.split('-')[0] ?? 'en')); setChallenge(result); saveChallenge(result); setCode('');
  };
  const submit = async (): Promise<void> => {
    if (active.current) return; active.current = true; setBusy(true); setProblem(null);
    try {
      if (!challenge) await request();
      else if (password !== repeat) setProblem(t('accountSecurity.mismatch'));
      else if (password.length < 8) setProblem(t('landing.form.shortPassword', { count: 8 }));
      else { await observeRecovery('complete', () => api.resetComplete(challenge.challengeId, code, password)); saveChallenge(null); api.endSession('password'); onClose(); }
    } catch (error) { setProblem(describe(error)); } finally { active.current = false; setBusy(false); }
  };
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet title={t('accountSecurity.resetTitle')} placement="dialog" onClose={onClose} onBack={onClose} detents={['full']} kit={{ tone: 'self' }}>
      <form ref={presentation} data-reset-sheet className="gk-acctsheet" onSubmit={event => { event.preventDefault(); event.stopPropagation(); void submit(); }}>
        <Banner tone={challenge ? 'good' : 'info'} glyph={challenge ? 'mail' : 'shield'} title={t(challenge ? 'accountSecurity.resetInfo' : 'accountSecurity.noRecovery')} />
        {!challenge ? <SecurityField label={t('accountSecurity.email')} value={email} onChange={setEmail} kind="email" autoComplete="email" disabled={busy} /> : <>
          <SecurityField label={t('accountSecurity.code')} value={code} onChange={setCode} kind="code" disabled={busy} />
          <p className="gk-acctsheet__fine">{t('accountSecurity.expireHint')}</p>
          <SecurityField label={t('accountSecurity.newPassword')} value={password} onChange={setPassword} kind="password" autoComplete="new-password" disabled={busy} />
          <SecurityField label={t('accountSecurity.repeatPassword')} value={repeat} onChange={setRepeat} kind="password" autoComplete="new-password" disabled={busy} />
        </>}
        {problem ? <Banner tone="hostile" role="alert" title={problem} /> : null}
        <GameButton submit tone="action" size="lg" wide pending={busy} onPress={() => undefined}
          disabledReason={challenge !== null && code.length !== 6 ? t('accountSecurity.codeNeeded') : null}>
          {t(challenge ? 'accountSecurity.reset' : 'accountSecurity.send')}
        </GameButton>
        {challenge ? <>
          <GameButton wide tone="ghost" pending={busy} disabledReason={remaining > 0 ? t('accountSecurity.expiry', { seconds: remaining }) : null} onPress={restart}>
            {t('accountSecurity.resend')}
          </GameButton>
          <GameButton wide tone="ghost" pending={busy} onPress={restart}>{t('accountSecurity.differentEmail')}</GameButton>
        </> : null}
      </form>
    </Sheet>
  </div>, document.body);
}
