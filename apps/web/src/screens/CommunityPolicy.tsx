import { useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { policyIsAccepted, type useCommunityPolicy } from '../api/communityPolicy.js';
import { matchLanguage } from '../i18n/languages.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { GameButton } from '../game-ui/index.js';

/** A legal/community agreement is independent of advertising consent. */
export function CommunityPolicyAgreement({ checked, disabled = false, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const { t, i18n } = useTranslation();
  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-2">
      <a className="gk-linkchip" href={publisherUrl('community', i18n.resolvedLanguage)} target="_blank" rel="noopener noreferrer">{t('moderation.policy.communityLink')}</a>
      <a className="gk-linkchip" href={publisherUrl('terms', i18n.resolvedLanguage)} target="_blank" rel="noopener noreferrer">{t('moderation.policy.termsLink')}</a>
    </div>
    <label className="gk-agree"><input className="gk-check" type="checkbox" checked={checked} disabled={disabled} onChange={event => { onChange(event.target.checked); }} /><span>{t('moderation.policy.agreement')}</span></label>
  </div>;
}
/** Joining is the agreement (owner playtest 2026-11-06): the rules sit a tap away above the button. */
export function CommunityPolicyNotice() {
  const { i18n } = useTranslation();
  const link = 'text-v2-self underline underline-offset-2';
  return <p className="text-micro leading-snug text-v2-ink-2">
    <Trans i18nKey="moderation.policy.byJoining" components={{
      community: <a className={link} href={publisherUrl('community', i18n.resolvedLanguage)} target="_blank" rel="noopener noreferrer" />,
      terms: <a className={link} href={publisherUrl('terms', i18n.resolvedLanguage)} target="_blank" rel="noopener noreferrer" />,
    }} />
  </p>;
}
export function CommunityPolicyGate({ policy, children }: { policy: ReturnType<typeof useCommunityPolicy>; children: ReactNode }) {
  const api = useApi(); const queries = useQueryClient(); const { t, i18n } = useTranslation();
  const [checked, setChecked] = useState(false); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false); const active = useRef(false);
  const agree = async () => {
    if (!checked || active.current || policy.data?.version !== COMMUNITY_POLICY_VERSION) return;
    active.current = true; setBusy(true); setFailed(false);
    try {
      const result = await api.acceptCommunityPolicy({ version: COMMUNITY_POLICY_VERSION, locale: matchLanguage(i18n.resolvedLanguage) ?? 'en' });
      if (result.version !== COMMUNITY_POLICY_VERSION || result.acceptedAt === null) throw new Error('Agreement was not confirmed');
      queries.setQueryData(keys.communityPolicy, result);
    } catch { setFailed(true); } finally { active.current = false; setBusy(false); }
  };
  if (policyIsAccepted(policy)) return children;
  /* THE ROOM'S RULES (C4): read, tick, accept — on the kit; the dead key says what it still needs. */
  return <section className="gk grid shrink-0 gap-3 overflow-y-auto border-t border-v2-line bg-v2-panel px-[var(--gk-gutter)] py-3">
    <h3 className="gk-display text-title">{t('moderation.policy.title')}</h3>
    {policy.isPending ? <p className="gk-copy">{t('moderation.policy.loading')}</p> : policy.isError ? <>
      <p role="alert" className="text-v2-warn">{t('moderation.policy.unavailable')}</p>
      <GameButton wide glyph="refresh" onPress={() => { void policy.refetch(); }}>{t('moderation.blocks.retry')}</GameButton>
    </> : policy.data.version !== COMMUNITY_POLICY_VERSION ? <p role="alert" className="text-v2-warn">{t('moderation.policy.update')}</p> : <>
      <p className="gk-copy">{t('moderation.policy.summary')}</p>
      <CommunityPolicyAgreement checked={checked} onChange={setChecked} disabled={busy} />
      {failed ? <p role="alert" className="text-v2-warn">{t('moderation.policy.failed')}</p> : null}
      <GameButton wide tone="action" glyph="check" pending={busy} disabledReason={checked ? null : t('moderation.policy.agreeFirst')}
        onPress={() => { void agree(); }}>{t('moderation.policy.accept')}</GameButton>
    </>}
  </section>;
}
