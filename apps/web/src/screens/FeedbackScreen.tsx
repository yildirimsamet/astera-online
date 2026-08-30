import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSendFeedback } from '../api/queries.js';
import type { FeedbackKind } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { SendIcon } from '../ui/icons/index.js';
import { Button, Segmented } from '../ui/kit/index.js';

const MAX_MESSAGE = 2_000;

export function FeedbackScreen() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<FeedbackKind>('BUG');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const submitFeedback = useSendFeedback();

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const clean = message.trim();
    if (clean.length < 3 || submitFeedback.isPending) return;
    submitFeedback.mutate({ kind, message: clean }, {
      onSuccess: () => {
        setMessage('');
        setSent(true);
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-6 pt-3">
      <p className="text-body leading-relaxed text-dim">{t('community.feedback.intro')}</p>
      <Segmented
        value={kind}
        onSelect={(next) => {
          setKind(next);
          setSent(false);
        }}
        label={t('community.feedback.kindLabel')}
        segments={[
          { id: 'BUG', label: t('community.feedback.kinds.bug') },
          { id: 'SUGGESTION', label: t('community.feedback.kinds.suggestion') },
          { id: 'PRAISE', label: t('community.feedback.kinds.praise') },
        ]}
      />
      <label className="flex flex-col gap-2">
        <span className="legend">{t('community.feedback.messageLabel')}</span>
        <textarea
          aria-label={t('community.feedback.messageLabel')}
          value={message}
          rows={8}
          maxLength={MAX_MESSAGE}
          placeholder={t('community.feedback.placeholder')}
          onChange={(event) => {
            setMessage(event.currentTarget.value);
            setSent(false);
          }}
          className="field resize-y leading-relaxed"
        />
        <span className="ml-auto text-micro text-faint">
          {t('community.feedback.remaining', { count: MAX_MESSAGE - message.length })}
        </span>
      </label>
      {submitFeedback.isError && (
        <p role="alert" className="text-caption text-threat-ink">
          {describeError(submitFeedback.error)}
        </p>
      )}
      {sent && (
        <p role="status" className="rounded-chip border border-opportunity/30 bg-opportunity/10 px-3 py-2 text-caption text-opportunity">
          {t('community.feedback.sent')}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        full
        disabled={message.trim().length < 3 || submitFeedback.isPending}
        icon={<SendIcon className="size-4" />}
      >
        {submitFeedback.isPending
          ? t('community.feedback.sending')
          : t('community.feedback.send')}
      </Button>
    </form>
  );
}
