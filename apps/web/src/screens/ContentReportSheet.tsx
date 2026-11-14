import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import { REPORT_REASONS, reportReasonSchema, type ReportReason } from '../api/contentReportSchemas.js';
import { Banner, Choices, GameButton } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';

export interface ReportSubject { channel: 'general' | 'clan' | 'dm'; messageId: string; playerId: string; username: string }

/**
 * The server retrieves evidence; a reporter supplies only the selector and explanation.
 * ON THE KIT (C3, 2026-11-14): what and why are the kit's plates — a press answers each, the
 * seven reasons two to a row — the send key says what it still needs, and the receipt is the
 * kit's good banner with its number.
 */
export function ContentReportSheet({ subject, onClose }: { subject: ReportSubject; onClose: () => void }) {
  const api = useApi(); const { t } = useTranslation();
  const id = useId();
  const [kind, setKind] = useState<'message' | 'player'>('message'); const [reason, setReason] = useState<ReportReason | ''>(''); const [details, setDetails] = useState('');
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
  const question = 'gk-copy font-semibold';
  return createPortal(<div className="[--v2-dock-h:0px]">
    <Sheet placement="dialog" title={t('moderation.title')} onClose={onClose} onBack={onClose} detents={['full']}>
      <div className="gk grid gap-4 pb-3">
        <div>
          <p className="gk-display break-words text-figure">{subject.username}</p>
          <p className="gk-copy mt-1">{t('moderation.explanation')}</p>
        </div>
        {receipt ? <>
          <Banner tone="good" glyph="check" role="status" title={t('moderation.received')} body={<>
            {t('moderation.receivedDetail')}
            <span className="mt-2 block select-all break-all font-v2-mono text-v2-ink">{receipt}</span>
          </>} />
          <GameButton wide tone="action" onPress={onClose}>{t('moderation.close')}</GameButton>
        </> : <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <div className="grid gap-1.5">
            <p className={question} aria-hidden="true">{t('moderation.target')}</p>
            <Choices label={t('moderation.target')} value={kind} onChange={setKind}
              options={[{ id: 'message', label: t('moderation.message') }, { id: 'player', label: t('moderation.player') }]} />
          </div>
          <div className="grid gap-1.5">
            <p className={question} aria-hidden="true">{t('moderation.reason')}</p>
            <Choices<ReportReason | ''> columns={2} label={t('moderation.reason')} value={reason} onChange={setReason}
              options={REPORT_REASONS.map(value => ({ id: value, label: t(`moderation.reasons.${value}`) }))} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-details`} className={question}>{t('moderation.details')}</label>
            <textarea id={`${id}-details`} className="gk-field__input min-h-24" value={details} disabled={busy} maxLength={1000} onChange={event => { setDetails(event.target.value); }} />
          </div>
          {problem ? <p role="alert" className="text-v2-warn">{problem}</p> : null}
          <GameButton wide tone="action" glyph="flag" pending={busy} disabledReason={reason === '' ? t('moderation.chooseReason') : null} onPress={() => { void submit(); }}>
            {t('moderation.submit')}
          </GameButton>
        </form>}
      </div>
    </Sheet>
  </div>, document.body);
}
