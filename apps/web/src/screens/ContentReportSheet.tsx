import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import { REPORT_REASONS, reportReasonSchema } from '../api/contentReportSchemas.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button } from '../v2/kit/Surface.js';

const field = 'min-h-11 min-w-0 w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink outline-none focus:border-v2-self';
export interface ReportSubject { channel: 'general' | 'clan' | 'dm'; messageId: string; playerId: string; username: string }

/** The server retrieves evidence; a reporter supplies only the selector and explanation. */
export function ContentReportSheet({ subject, onClose }: { subject: ReportSubject; onClose: () => void }) {
  const api = useApi(); const { t } = useTranslation();
  const id = useId();
  const [kind, setKind] = useState<'message' | 'player'>('message'); const [reason, setReason] = useState(''); const [details, setDetails] = useState('');
  const [receipt, setReceipt] = useState<string | null>(null); const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const active = useRef(false);
  const submit = async () => {
    const parsed = reportReasonSchema.safeParse(reason);
    if (active.current || !parsed.success || receipt || details.length > 1000) return;
    active.current = true; setBusy(true); setProblem(null);
    try {
      const target = kind === 'message' ? { kind, channel: subject.channel, messageId: subject.messageId } : { kind, playerId: subject.playerId };
      const result = await api.reportContent(target, parsed.data, details.trim()); setReceipt(result.report.id);
    } catch (error) { setProblem(t(error instanceof ApiError && error.code === 'RATE_LIMITED' ? 'moderation.limited' : 'moderation.failed')); }
    finally { active.current = false; setBusy(false); }
  };
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet placement="dialog" title={t('moderation.title')} onClose={onClose} onBack={onClose} detents={['full']}>
      <div className="grid gap-3 pb-3">
        <p className="break-words text-caption font-semibold text-v2-ink">{subject.username}</p>
        <p className="text-caption leading-relaxed text-v2-ink-2">{t('moderation.explanation')}</p>
        {receipt ? <div className="rounded-control border border-v2-self/30 bg-v2-self/5 p-3">
          <p role="status" className="text-caption font-semibold text-v2-self">{t('moderation.received')}</p>
          <p className="mt-2 text-caption text-v2-ink-2">{t('moderation.receivedDetail')}</p>
          <p className="mt-3 break-all select-all font-v2-mono text-micro text-v2-ink">{receipt}</p>
        </div> : <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <div className="grid gap-1.5 text-caption text-v2-ink-2"><label htmlFor={`${id}-target`}>{t('moderation.target')}</label>
            <select id={`${id}-target`} className={field} value={kind} disabled={busy} onChange={event => { setKind(event.target.value === 'player' ? 'player' : 'message'); }}>
              <option value="message">{t('moderation.message')}</option><option value="player">{t('moderation.player')}</option>
            </select>
          </div>
          <div className="grid gap-1.5 text-caption text-v2-ink-2"><label htmlFor={`${id}-reason`}>{t('moderation.reason')}</label>
            <select id={`${id}-reason`} className={field} value={reason} disabled={busy} required onChange={event => { setReason(event.target.value); }}>
              <option value="" disabled>{t('moderation.chooseReason')}</option>
              {REPORT_REASONS.map(value => <option key={value} value={value}>{t(`moderation.reasons.${value}`)}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5 text-caption text-v2-ink-2"><label htmlFor={`${id}-details`}>{t('moderation.details')}</label>
            <textarea id={`${id}-details`} className={`${field} min-h-24 py-2`} value={details} disabled={busy} maxLength={1000} onChange={event => { setDetails(event.target.value); }} />
          </div>
          {problem ? <p role="alert" className="text-caption text-v2-warn">{problem}</p> : null}
          <Button type="submit" full variant="primary" disabled={busy || !reason}>{t('moderation.submit')}</Button>
        </form>}
        <Button full variant="ghost" onClick={onClose}>{t('moderation.close')}</Button>
      </div>
    </Sheet>
  </div>, document.body);
}
