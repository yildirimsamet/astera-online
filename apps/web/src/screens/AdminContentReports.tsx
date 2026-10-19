import { AdminReportMedia } from './AdminReportMedia.js';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { useApi } from '../api/context.js';
import type { contentReportQueueSchema } from '../api/contentReportSchemas.js';
import { Button, Note } from '../v2/kit/Surface.js';

const key = ['admin-content-reports'] as const;
type Report = z.infer<typeof contentReportQueueSchema>['reports'][number];
export function AdminContentReports() {
  const api = useApi(); const { t } = useTranslation(); const [saved, setSaved] = useState<string | null>(null);
  const query = useQuery({ queryKey: key, queryFn: () => api.adminContentReports(), retry: false });
  return <section className="grid gap-3 py-2">
    <Note>{t('moderation.admin.intro')}</Note>
    <Button onClick={() => { void query.refetch(); }}>{t('moderation.admin.refresh')}</Button>
    {saved ? <p role="status" className="break-all text-caption text-v2-self">{t('moderation.admin.saved')} · {saved}</p> : null}
    {query.isPending ? <p className="text-caption text-v2-ink-2">{t('moderation.admin.loading')}</p>
      : query.isError ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.admin.unavailable')}</p>
      : query.data.reports.length ? <ul className="grid gap-3">{query.data.reports.map(report => <ReportRow key={report.id} report={report} onSaved={setSaved} />)}</ul>
        : <p className="text-caption text-v2-ink-2">{t('moderation.admin.empty')}</p>}
  </section>;
}
function ReportRow({ report, onSaved }: { report: Report; onSaved: (id: string) => void }) {
  const api = useApi(); const queries = useQueryClient(); const { t, i18n } = useTranslation();
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [problem, setProblem] = useState(false); const active = useRef(false);
  const decide = async (action: 'MASK' | 'DISMISS') => {
    if (!confirmed || active.current) return;
    active.current = true; setBusy(true); setProblem(false);
    try { await api.adminResolveContentReport(report.id, action); onSaved(report.id); void queries.invalidateQueries({ queryKey: key }); }
    catch { setProblem(true); }
    finally { active.current = false; setBusy(false); setConfirmed(false); }
  };
  return <li className="grid gap-3 rounded-control border border-v2-line bg-v2-deep p-3">
    <div><p className="break-words text-caption font-semibold text-v2-ink">{report.evidence.username}{report.targetUsername ? ` @${report.targetUsername}` : ''}</p>
      <p className="mt-1 text-micro text-v2-ink-3">{report.createdAt.toLocaleString(i18n.resolvedLanguage)}</p></div>
    <p className="text-caption text-v2-self">{t(`moderation.reasons.${report.reason}`)} · {t(report.kind === 'message' ? 'moderation.message' : 'moderation.player')}</p>
    {report.evidence.content ? <blockquote className="whitespace-pre-wrap break-words rounded-cell border-l-2 border-v2-line-hi bg-v2-panel p-3 text-caption text-v2-ink">{report.evidence.content}</blockquote> : null}
    {report.evidence.media ? <div className="grid gap-2"><p className="text-caption text-v2-ink-2">{t('moderation.admin.media')}</p><AdminReportMedia reportId={report.id} media={report.evidence.media} /></div> : null}
    {report.details ? <p className="whitespace-pre-wrap break-words text-caption text-v2-ink-2">{report.details}</p> : null}
    <p className="break-all select-all font-v2-mono text-micro text-v2-ink-3">{report.id}</p>
    {report.kind === 'player' ? <Note>{t('moderation.admin.profile')}</Note> : null}
    <label className="flex min-h-11 items-start gap-2 text-caption text-v2-ink-2"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-v2-self" disabled={busy} checked={confirmed} onChange={event => { setConfirmed(event.target.checked); }} />{t('moderation.admin.confirm')}</label>
    {problem ? <p role="alert" className="text-caption text-v2-warn">{t('moderation.admin.failed')}</p> : null}
    <div className="flex flex-wrap gap-2">
      {report.kind === 'message' ? <Button disabled={!confirmed || busy} onClick={() => { void decide('MASK'); }}>{t('moderation.admin.mask')}</Button> : null}
      <Button variant="ghost" disabled={!confirmed || busy} onClick={() => { void decide('DISMISS'); }}>{t('moderation.admin.dismiss')}</Button>
    </div>
  </li>;
}
