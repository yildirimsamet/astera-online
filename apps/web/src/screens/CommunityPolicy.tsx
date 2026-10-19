import { useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { policyIsAccepted, type useCommunityPolicy } from '../api/communityPolicy.js';
import { matchLanguage } from '../i18n/languages.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { Button } from '../v2/kit/Surface.js';

/** A legal/community agreement is independent of advertising consent. */
export function CommunityPolicyAgreement({ checked, disabled = false, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const { t, i18n } = useTranslation();
  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-x-4 text-caption text-v2-self">
      <a className="flex min-h-11 items-center underline underline-offset-4" href={publisherUrl('community', i18n.resolvedLanguage)} target="_blank" rel="noopener noreferrer">{t('moderation.policy.communityLink')}</a>
      <a className="flex min-h-11 items-center underline underline-offset-4" href={publisherUrl('terms', i18n.resolvedLanguage)} target="_blank" rel="noopener noreferrer">{t('moderation.policy.termsLink')}</a>
    </div>
    <label className="flex min-h-11 items-start gap-3 text-caption leading-relaxed text-v2-ink-2"><input className="mt-1 size-5 shrink-0 accent-v2-self" type="checkbox" checked={checked} disabled={disabled} onChange={event => { onChange(event.target.checked); }} />{t('moderation.policy.agreement')}</label>
  </div>;
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
  return <section className="grid shrink-0 gap-2 overflow-y-auto border-t border-v2-line bg-v2-panel px-3 py-3">
    <h3 className="text-caption font-semibold text-v2-ink">{t('moderation.policy.title')}</h3>
    {policy.isPending ? <p className="text-caption text-v2-ink-2">{t('moderation.policy.loading')}</p> : policy.isError ? <>
      <p role="alert" className="text-caption text-v2-warn">{t('moderation.policy.unavailable')}</p>
      <Button size="lg" onClick={() => { void policy.refetch(); }}>{t('moderation.blocks.retry')}</Button>
    </> : policy.data.version !== COMMUNITY_POLICY_VERSION ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.policy.update')}</p> : <>
      <p className="text-caption leading-relaxed text-v2-ink-2">{t('moderation.policy.summary')}</p>
      <CommunityPolicyAgreement checked={checked} onChange={setChecked} disabled={busy} />
      {failed ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.policy.failed')}</p> : null}
      <Button size="lg" full variant="primary" disabled={!checked || busy} onClick={() => { void agree(); }}>{t('moderation.policy.accept')}</Button>
    </>}
  </section>;
}
